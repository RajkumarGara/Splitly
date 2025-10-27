import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Bills } from '/imports/api/bills';
import { cacheBills, loadCachedBills } from '/imports/infra/indexedDb';
import config from '/config/app.config.json';
import './layout.html';
import './components/userModal';

const alertsVar = new ReactiveVar([]);

function mapType(type) {
	switch (type) {
		case 'error': return 'danger';
		case 'warn':
		case 'warning': return 'warning';
		case 'info': return 'info';
		case 'success': return 'success';
		default: return 'secondary';
	}
}

function pushAlert(type, msg) {
	const list = alertsVar.get();
	list.push({ id: Math.random().toString(36).slice(2), type, msg, typeClass: mapType(type) });
	alertsVar.set(list);
	setTimeout(() => {
		const cur = alertsVar.get();
		cur.shift();
		alertsVar.set(cur);
	}, 6000);
}

let confirmResolver = null;
export function showConfirm(message, options = {}) {
	return new Promise(resolve => {
		const modalEl = document.getElementById('confirmModal');
		const hasBootstrap = typeof window !== 'undefined' && window.bootstrap?.Modal;
		if (!modalEl || !hasBootstrap) {
			resolve(window.confirm(message));
			return;
		}
		confirmResolver = resolve;
		const msgEl = document.getElementById('confirmModalMessage');
		if (msgEl) {
			// Convert line breaks to <br> for proper HTML rendering
			msgEl.innerHTML = message.replace(/\n/g, '<br>');
		}
		const okBtn = document.getElementById('confirmOkBtn');
		if (okBtn) {
			okBtn.textContent = options.okText || 'OK';
			// Change button style based on action type
			okBtn.className = 'btn ' + (options.okButtonClass || 'btn-danger');
		}
		const cancelBtn = document.getElementById('confirmCancelBtn');
		if (cancelBtn) {
			cancelBtn.textContent = options.cancelText || 'Cancel';
		}
		wireConfirmHandlers();

		// Allow dismissible modals for non-critical confirmations
		const modalOptions = options.dismissible ?
			{ backdrop: true, keyboard: true } :
			{ backdrop: 'static', keyboard: false };

		new window.bootstrap.Modal(modalEl, modalOptions).show();
	});
}

function wireConfirmHandlers() {
	const okBtn = document.getElementById('confirmOkBtn');
	const cancelBtn = document.getElementById('confirmCancelBtn');
	const modalEl = document.getElementById('confirmModal');
	if (!okBtn || !cancelBtn || !modalEl) {
		return;
	}
	okBtn.onclick = () => {
		const modal = window.bootstrap ? window.bootstrap.Modal.getInstance(modalEl) : null;
		modal?.hide();
		confirmResolver?.(true);
		confirmResolver = null;
	};
	cancelBtn.onclick = () => {
		const modal = window.bootstrap ? window.bootstrap.Modal.getInstance(modalEl) : null;
		modal?.hide();
		confirmResolver?.(false);
		confirmResolver = null;
	};
	modalEl.addEventListener('hidden.bs.modal', () => {
		confirmResolver?.(false);
		confirmResolver = null;
	});
}

Template.MainLayout.onRendered(function () {
	wireConfirmHandlers();
	// Populate IndexedDB cache when bills are ready (if enabled)
	this.autorun(() => {
		const flag = localStorage.getItem('flag_indexedDbSync');
		const enabled = flag === null ? config.features?.indexedDbSync : flag === 'true';
		if (this.subHandle.ready() && enabled) {
			const allBills = Bills.find({}).fetch();
			if (allBills.length > 0) {
				cacheBills(allBills).catch(err => console.error('IndexedDB cache error:', err));
			}
		}
	});
});
// Track if we've ever had a successful bills subscription
const initialLoadState = new ReactiveVar(false);

Template.MainLayout.onCreated(function () {
	this.subHandle = this.subscribe('bills.all');

	// Add production debugging
	console.log('🔍 Layout created, starting subscription...');

	// Mark as loaded once we have data or the subscription is ready
	this.autorun(() => {
		const isReady = this.subHandle.ready();
		const billCount = Bills.find({}).count();
		
		console.log('📊 Subscription state:', { 
			ready: isReady, 
			billCount,
			initialLoaded: initialLoadState.get() 
		});

		if (isReady || billCount > 0) {
			if (!initialLoadState.get()) {
				console.log('✅ Marking as loaded');
				initialLoadState.set(true);
			}
		}
	});

	// Production fallback: Force load after 10 seconds to prevent infinite spinner
	this.loadTimeout = setTimeout(() => {
		if (!initialLoadState.get()) {
			console.warn('⚠️ Force loading due to timeout - subscription may have failed');
			initialLoadState.set(true);
		}
	}, 10000);

	// Try loading cached bills if offline/slow (if enabled)
	const flag = localStorage.getItem('flag_indexedDbSync');
	const enabled = flag === null ? config.features?.indexedDbSync : flag === 'true';
	if (enabled) {
		loadCachedBills()
			.then(cached => {
				console.log('💾 Cached bills loaded:', cached.length);
				if (cached.length > 0) {
					// Bills loaded from IndexedDB cache, mark as loaded
					initialLoadState.set(true);
				}
			})
			.catch(err => console.error('IndexedDB load error:', err));
	}
});

Template.MainLayout.helpers({
	notReady() {
		// Don't show layout spinner on split page - it has its own loading state
		const currentPath = FlowRouter.current().path;
		if (currentPath.startsWith('/split/')) {
			return false;
		}

		// Don't show spinner during normal navigation between main pages
		const isMainNavPage = ['/', '/history', '/analysis', '/settings'].includes(currentPath);
		if (isMainNavPage && initialLoadState.get()) {
			return false;
		}

		// Only show spinner if we've never loaded bills data before
		// This prevents the flicker on navigation
		return !initialLoadState.get() && !Template.instance().subHandle.ready();
	},
	isActive(path) {
		const currentPath = FlowRouter.current().path;
		// Handle root path and analysis path matching
		if (path === '/' && currentPath === '/') {return 'active';}
		if (path !== '/' && currentPath.startsWith(path)) {return 'active';}
		return '';
	},
	alerts() {
		return alertsVar.get();
	},
});

Template.Alerts.events({
	'click .btn-close'(e) {
		const id = e.currentTarget.getAttribute('data-id');
		alertsVar.set(alertsVar.get().filter(a => a.id !== id));
	},
});

Template.MainLayout.onDestroyed(function () {
	// Clear timeout to prevent memory leaks
	if (this.loadTimeout) {
		clearTimeout(this.loadTimeout);
	}
	// Template cleanup - the subscription will be automatically handled by Meteor
});

export { pushAlert };
