import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Bills } from '/imports/api/models';
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
	if (!msg || typeof msg !== 'string') {
		console.warn('[pushAlert] Invalid message:', msg);
		return;
	}
	const list = alertsVar.get();
	list.push({ id: Math.random().toString(36).slice(2), type, msg, typeClass: mapType(type) });
	alertsVar.set(list);
	setTimeout(() => {
		const cur = alertsVar.get();
		if (cur.length > 0) {
			cur.shift();
			alertsVar.set(cur);
		}
	}, 6000);
}

let confirmResolver = null;
export function showConfirm(message, options = {}) {
	// Validate message
	if (!message || typeof message !== 'string') {
		console.warn('[showConfirm] Invalid message:', message);
		return Promise.resolve(false);
	}

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
			// Safely handle line breaks - escape HTML to prevent XSS
			const escapedMessage = message
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.substring(0, 500); // Limit message length
			msgEl.innerHTML = escapedMessage.replace(/\n/g, '<br>');
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
		if (this.subHandle.ready() && enabled && Bills) {
			try {
				const allBills = Bills.find({}).fetch();
				if (allBills.length > 0) {
					cacheBills(allBills).catch(err => {
						if (process.env.NODE_ENV !== 'production') {
							console.error('[IndexedDB] Cache error:', err);
						}
					});
				}
			} catch (error) {
				if (process.env.NODE_ENV !== 'production') {
					console.warn('[IndexedDB] Bills collection not ready for caching:', error.message);
				}
			}
		}
	});
});
// Track if we've ever had a successful bills subscription
const initialLoadState = new ReactiveVar(false);

Template.MainLayout.onCreated(function () {
	this.subHandle = this.subscribe('bills.all');

	// NOTE: Removed problematic reload detection that was triggering on normal navigation
	// The original infinite reload issue was resolved by PWA cache optimizations

	// Clean up any existing reload tracking data
	if (typeof window !== 'undefined' && !window.__splitlyCleanupDone) {
		window.__splitlyCleanupDone = true;
		try {
			window.sessionStorage.removeItem('reload_count');
			window.sessionStorage.removeItem('last_load_time');
			window.sessionStorage.removeItem('disable_auto_navigation');
		} catch (error) {
			// sessionStorage may not be available (privacy mode, etc.)
			console.warn('Could not clear sessionStorage:', error);
		}
	}

	// Mark as loaded once we have data or the subscription is ready
	this.autorun(() => {
		try {
			if (this.subHandle.ready() || (Bills && Bills.find({}).count() > 0)) {
				initialLoadState.set(true);
			}
		} catch (_error) {
			// Collection not ready yet, wait for subscription
			if (this.subHandle.ready()) {
				initialLoadState.set(true);
			}
		}
	});

	// Try loading cached bills if offline/slow (if enabled)
	const flag = localStorage.getItem('flag_indexedDbSync');
	const enabled = flag === null ? config.features?.indexedDbSync : flag === 'true';
	if (enabled) {
		loadCachedBills()
			.then(cached => {
				if (cached.length > 0) {
					// Bills loaded from IndexedDB cache, mark as loaded
					initialLoadState.set(true);
				}
			})
			.catch(err => {
				if (process.env.NODE_ENV !== 'production') {
					console.error('[IndexedDB] Load error:', err);
				}
			});
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
	// Centralized navigation items so we can render both top (desktop) and bottom (mobile) navs
	navItems() {
		return [
			{ label: 'Home', path: '/', icon: 'bi-house-door' },
			{ label: 'History', path: '/history', icon: 'bi-clock-history' },
			{ label: 'Analysis', path: '/analysis', icon: 'bi-graph-up' },
			{ label: 'Settings', path: '/settings', icon: 'bi-gear' },
		];
	},
	alerts() {
		return alertsVar.get();
	},
	currentUser() {
		return Meteor.user();
	},
	isGuestUser() {
		const user = Meteor.user();
		return user?.profile?.isGuest === true;
	},
	userInitial() {
		const user = Meteor.user();
		const displayName = user?.profile?.displayName || user?.emails?.[0]?.address || 'U';
		return displayName.charAt(0).toUpperCase();
	},
	userDisplayName() {
		const user = Meteor.user();
		return user?.profile?.displayName || user?.emails?.[0]?.address?.split('@')[0] || 'User';
	},
	userDisplayNameOrEmail() {
		const user = Meteor.user();
		// For guest accounts or users with displayName, show displayName
		if (user?.profile?.displayName) {
			return user.profile.displayName;
		}
		// Otherwise show email
		return user?.emails?.[0]?.address || 'User';
	},
	userEmail() {
		const user = Meteor.user();
		return user?.emails?.[0]?.address || '';
	},
});

Template.Alerts.events({
	'click .btn-close'(e) {
		const id = e.currentTarget.getAttribute('data-id');
		alertsVar.set(alertsVar.get().filter(a => a.id !== id));
	},
});

Template.MainLayout.events({
	'click #headerLogoutBtn, click #topNavLogoutBtn'(e) {
		e.preventDefault();
		Meteor.logout((error) => {
			if (error) {
				pushAlert('error', 'Logout failed');
			} else {
				pushAlert('success', 'Logged out successfully');
				FlowRouter.go('/login');
			}
		});
	},
});

Template.MainLayout.onDestroyed(function () {
	// Template cleanup - the subscription will be automatically handled by Meteor
});

export { pushAlert };
