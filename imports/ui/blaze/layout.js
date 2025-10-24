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
		}
		const cancelBtn = document.getElementById('confirmCancelBtn');
		if (cancelBtn) {
			cancelBtn.textContent = options.cancelText || 'Cancel';
		}
		wireConfirmHandlers();
		new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false }).show();
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
Template.MainLayout.onCreated(function () {
	this.subHandle = this.subscribe('bills.all');
	// Try loading cached bills if offline/slow (if enabled)
	const flag = localStorage.getItem('flag_indexedDbSync');
	const enabled = flag === null ? config.features?.indexedDbSync : flag === 'true';
	if (enabled) {
		loadCachedBills()
			.then(cached => {
				if (cached.length > 0 && !this.subHandle.ready()) {
					// Bills loaded from IndexedDB cache
					// Bills collection will be populated from subscription when ready
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
		return !Template.instance().subHandle.ready();
	},
	isActive(path) {
		return FlowRouter.current().path === path ? 'active' : '';
	},
	showAnalysis() {
		return !!config.features?.analysisPage;
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

export { pushAlert };
