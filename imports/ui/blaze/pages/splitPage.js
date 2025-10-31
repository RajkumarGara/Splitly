/* eslint-env browser */
import './splitPage.html';
import '/client/styles/splitPage.css';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Bills } from '/imports/api/bills';
import { GlobalUsers } from '/imports/api/users';
import { computeExpenseSummary } from '/imports/api/models';
import { formatMoney } from '/imports/api/utils';
import { pushAlert, showConfirm } from '../layout';

Template.SplitPage.onCreated(function () {
	this.billId = FlowRouter.getParam('id');
	this.showAddForm = new ReactiveVar(false);
	this.showDeleteButtons = new ReactiveVar(false);
	this.showSplitMode = new ReactiveVar(false);
	const savedPref = localStorage.getItem('splitly_showHelp');
	this.showHelpInfo = new ReactiveVar(savedPref === null ? true : savedPref === 'true');

	// Track subscription ready state
	this.subscriptionsReady = new ReactiveVar(false);

	this.autorun(() => {
		const sub1 = this.subscribe('bills.all');
		const sub2 = this.subscribe('globalUsers.all');
		this.subscriptionsReady.set(sub1.ready() && sub2.ready());
	});
});

Template.SplitPage.helpers({
	isLoading() {
		return !Template.instance().subscriptionsReady.get();
	},
	bill() {
		try {
			if (!Bills) {return null;}
			return Bills.findOne(Template.instance().billId);
		} catch (_error) {
			return null;
		}
	},
	showHelpInfo() {
		return Template.instance().showHelpInfo.get();
	},
	showAddForm() {
		return Template.instance().showAddForm.get();
	},
	showDeleteButtons() {
		return Template.instance().showDeleteButtons.get();
	},
	showSplitMode() {
		return Template.instance().showSplitMode.get();
	},
	isEditMode() {
		return Template.instance().showSplitMode.get() || Template.instance().showDeleteButtons.get();
	},
	hasItems() {
		const b = Bills.findOne(Template.instance().billId);
		return !!(b?.items?.length);
	},
	hasPeople() {
		const b = Bills.findOne(Template.instance().billId);
		return !!(b?.users?.length);
	},
	items() {
		const bill = Bills.findOne(Template.instance().billId);
		const items = bill?.items || [];
		const showSplitMode = Template.instance().showSplitMode.get();
		const showDeleteButtons = Template.instance().showDeleteButtons.get();
		const hasMoreThanFourUsers = (bill?.users?.length || 0) > 4;

		// Get users directly - no transformation needed
		const users = bill?.users || [];

		// Add computed properties to each item for the template
		return items.map(item => {
			const userChipsClass = `user-chips-container-wrap${hasMoreThanFourUsers ? ' wrap-enabled' : ''}${!showSplitMode ? ' invisible' : ''}`;

			// Add item ID and selected state to each user for this item
			const usersWithState = users.map(user => ({
				...user,
				isSelected: item.userIds?.includes(user.id) || false,
				itemId: item.id,
			}));

			return {
				...item,
				itemCardClass: `item-card-content${showSplitMode ? ' split-mode-active' : ''}${hasMoreThanFourUsers ? ' wrap-enabled' : ''}`,
				userChipsClass: userChipsClass,
				showDeleteBtn: showDeleteButtons,
				users: usersWithState,  // Users with selection state
			};
		});
	},
	itemIndex(index) {
		return index + 1;
	},
	totalDifference() {
		const b = Bills.findOne(Template.instance().billId);
		if (!b?.totalAmount || !b?.calculatedWithTax) {
			return null;
		}
		const diff = Math.abs(b.totalAmount - b.calculatedWithTax);
		return diff > 0.01 ? Number(diff.toFixed(2)).toFixed(2) : null;
	},
	formatMoney(value) {
		return formatMoney(value);
	},
	billUsers() {
		const bill = Bills.findOne(Template.instance().billId);
		const users = bill?.users || [];
		// Add first letter to each user
		return users.map(user => ({
			...user,
			firstLetter: user.name ? user.name.charAt(0).toUpperCase() : '',
		}));
	},
	hasMoreThanFourUsers() {
		const bill = Bills.findOne(Template.instance().billId);
		return (bill?.users?.length || 0) > 4;
	},
	firstLetter(name) {
		return name ? name.charAt(0).toUpperCase() : '';
	},
	getUserChipClass(userId, itemId) {
		const bill = Bills.findOne(Template.instance().billId);
		const item = bill?.items?.find(i => i.id === itemId);
		const isActive = item?.userIds?.includes(userId) || false;
		return isActive ? 'active' : '';
	},
	isUserSelected(userId, itemId) {
		const bill = Bills.findOne(Template.instance().billId);
		const item = bill?.items?.find(i => i.id === itemId);
		return item?.userIds?.includes(userId) || false;
	},
	finalPerUserRows() {
		const b = Bills.findOne(Template.instance().billId);
		if (!b) {
			return [];
		}
		const summary = computeExpenseSummary(b);
		const users = b.users || [];
		const tax = Number(b.taxAmount || 0);
		const billTotal = typeof b.calculatedWithTax === 'number' ? b.calculatedWithTax : Number((summary.grandTotal + tax).toFixed(2));
		if (!users.length) {
			return [];
		}
		const taxShare = users.length ? tax / users.length : 0;
		const perUserMap = new Map(summary.perUser.map(p => [p.userId, p.amount]));
		const rows = users.map(u => {
			const itemsSubtotal = Number((perUserMap.get(u.id) || 0).toFixed(2));
			return { userId: u.id, name: u.name, itemsSubtotal, taxShareRaw: taxShare, totalRaw: itemsSubtotal + taxShare };
		});
		rows.forEach(r => {
			r.taxShare = Number(r.taxShareRaw.toFixed(2));
			if (tax > 0 && Math.abs(r.totalRaw - r.itemsSubtotal) < 0.0001) {
				r.totalRaw = r.itemsSubtotal + taxShare;
			}
			r.totalRounded = Number(r.totalRaw.toFixed(2));
		});
		const sumRounded = Number(rows.reduce((s, r) => s + r.totalRounded, 0).toFixed(2));
		const diff = Number((billTotal - sumRounded).toFixed(2));
		if (Math.abs(diff) >= 0.01) {
			const sorted = [...rows].sort((a, b) => (b.totalRaw - Math.floor(b.totalRaw)) - (a.totalRaw - Math.floor(a.totalRaw)));
			sorted[0].totalRounded = Number((sorted[0].totalRounded + diff).toFixed(2));
		}
		rows.forEach(r => {
			r._exactShare = billTotal > 0 ? (r.totalRounded / billTotal) * 100 : 0;
		});
		if (billTotal > 0 && rows.length && rows.every(r => r._exactShare === 0)) {
			rows.forEach(r => {
				r._exactShare = (r.itemsSubtotal / (summary.grandTotal || 1)) * 100;
			});
		}
		const floorPercents = rows.map(r => Math.floor(r._exactShare));
		let allocated = floorPercents.reduce((s, v) => s + v, 0);
		let remaining = 100 - allocated;
		const remainders = rows.map((r, i) => ({ i, remainder: r._exactShare - floorPercents[i] })).sort((a, b) => b.remainder - a.remainder);
		for (let k = 0; k < remainders.length && remaining > 0; k++) {
			floorPercents[remainders[k].i] += 1;
			remaining--;
		}
		rows.forEach((r, i) => {
			r.sharePercentageInt = floorPercents[i];
		});
		return rows;
	},
});

Template.SplitPage.onRendered(function() {
	const _template = this;

	// Store event handler references for cleanup
	this.escapeHandler = function(e) {
		if (e.key === 'Escape') {
			// Find any open modals and close them
			const openModals = document.querySelectorAll('.modal.show');
			openModals.forEach(modal => {
				const modalInstance = window.bootstrap.Modal.getInstance(modal);
				if (modalInstance && !modal.hasAttribute('data-bs-backdrop-static')) {
					modalInstance.hide();
				}
			});
		}
	};

	// Ensure modal dismissal works properly
	this.autorun(() => {
		Tracker.afterFlush(() => {
			// Add ESC key listener for modals
			document.addEventListener('keydown', this.escapeHandler);
		});
	});
});

Template.SplitPage.onDestroyed(function() {
	// Clean up event listeners
	if (this.escapeHandler) {
		document.removeEventListener('keydown', this.escapeHandler);
	}
});

Template.SplitPage.events({
	'click #hideHelpBtn'(e, tpl) {
		tpl.showHelpInfo.set(false);
		localStorage.setItem('splitly_showHelp', 'false');
	},
	'click #showAddFormBtn'(e, tpl) {
		e.preventDefault();
		tpl.showAddForm.set(!tpl.showAddForm.get());
	},
	'click #hideAddFormBtn'(e, tpl) {
		e.preventDefault();
		tpl.showAddForm.set(false);
	},
	async 'click #toggleSplitBtn'(e, tpl) {
		e.preventDefault();
		const bill = Bills.findOne(tpl.billId);
		const newState = !tpl.showSplitMode.get();

		// If trying to enter split mode but no people exist, show warning
		if (newState && (!bill?.users?.length)) {
			const shouldAddPeople = await showConfirm(
				'Ready to split items?\n\nFirst, add people to share the bill with. You can add them from your saved contacts or create new ones.',
				{
					okText: 'Add People',
					cancelText: 'Skip for Now',
					okButtonClass: 'btn-purple',
					dismissible: true,
				},
			);

			if (shouldAddPeople) {
				// Try to add global users first
				const globalUsers = GlobalUsers.find().fetch();
				if (globalUsers.length > 0) {
					try {
						for (const user of globalUsers) {
							await Meteor.callAsync('bills.addUser', tpl.billId, { id: user._id, name: user.name });
						}
						pushAlert('success', 'People added to bill');
						// Now enable split mode
						tpl.showSplitMode.set(true);
						tpl.showDeleteButtons.set(false);
					} catch (err) {
						pushAlert('error', err.reason || 'Could not add people');
						return;
					}
				} else {
					// No global users, open the user modal to add some
					pushAlert('info', 'Add people first using Manage People');
					const modalEl = document.getElementById('userModal');
					if (modalEl && window.bootstrap?.Modal) {
						const modal = new window.bootstrap.Modal(modalEl, {
							keyboard: true,    // Allow ESC key to close
							backdrop: true,     // Allow clicking backdrop to close
						});
						modal.show();
					}
					return;
				}
			} else {
				return; // User cancelled
			}
		} else {
			tpl.showSplitMode.set(newState);
			// Turn off delete mode when entering split mode
			if (newState) {
				tpl.showDeleteButtons.set(false);
			}
		}

		// Close add form when clicking split button
		tpl.showAddForm.set(false);
	},
	'click #toggleDeleteBtn'(e, tpl) {
		e.preventDefault();
		const newState = !tpl.showDeleteButtons.get();
		tpl.showDeleteButtons.set(newState);
		// Turn off split mode when entering delete mode
		if (newState) {
			tpl.showSplitMode.set(false);
		}
		// Close add form when clicking delete button
		tpl.showAddForm.set(false);
	},
	async 'click .user-chip'(e, tpl) {
		e.preventDefault();
		const btn = e.currentTarget;
		const itemId = btn.getAttribute('data-item-id');
		const userId = btn.getAttribute('data-user-id');
		const billId = tpl.billId;

		try {
			await Meteor.callAsync('bills.toggleUserOnItem', billId, itemId, userId);
		} catch (err) {
			pushAlert('error', err.reason || 'Could not update item');
		}
	},
	async 'click #addItemBtn'(e, tpl) {
		const name = tpl.find('#newItemName').value.trim();
		const price = parseFloat(tpl.find('#newItemPrice').value);
		if (!name) {
			pushAlert('error', 'Please enter an item name');
			return;
		}
		if (!price || price <= 0) {
			pushAlert('error', 'Please enter a valid price');
			return;
		}
		const billId = Template.instance().billId;
		const bill = Bills.findOne(billId);
		const item = { id: `item${Date.now()}`, name, price, userIds: bill.users.map(u => u.id), splitType: 'equal', shares: [] };
		try {
			await Meteor.callAsync('bills.addItem', billId, item);
			pushAlert('success', 'Item added');
			tpl.find('#newItemName').value = '';
			tpl.find('#newItemPrice').value = '';
			tpl.showAddForm.set(false);
		} catch (err) {
			pushAlert('error', err.reason || 'Could not add item');
		}
	},
	'keypress #newItemName, #newItemPrice'(e, tpl) {
		if (e.which === 13) {
			e.preventDefault();
			tpl.find('#addItemBtn').click();
		}
	},
	async 'click #addPeopleFromSplit'(e, tpl) {
		e.preventDefault();
		const globalUsers = GlobalUsers.find().fetch();
		if (!globalUsers.length) {
			pushAlert('error', 'Please add people in Settings first');
			return;
		}
		const billId = tpl.billId;
		try {
			for (const user of globalUsers) {
				await Meteor.callAsync('bills.addUser', billId, { id: user._id, name: user.name });
			}
			pushAlert('success', 'People added to bill');
		} catch (err) {
			pushAlert('error', err.reason || 'Could not add people');
		}
	},
	'click #managePeopleBtn'(e, tpl) {
		e.preventDefault();

		// Open the user modal
		const modalEl = document.getElementById('userModal');
		if (!modalEl || !window.bootstrap?.Modal) {
			pushAlert('error', 'Modal not available');
			return;
		}
		try {
			const modal = new window.bootstrap.Modal(modalEl, {
				keyboard: true,    // Allow ESC key to close
				backdrop: true,     // Allow clicking backdrop to close
			});

			// Listen for when the modal is closed to sync users
			modalEl.addEventListener('hidden.bs.modal', async function syncUsers() {
				// Remove the listener after first use
				modalEl.removeEventListener('hidden.bs.modal', syncUsers);

				// Sync bill users with global users
				const billId = tpl.billId;
				const bill = Bills.findOne(billId);
				const globalUsers = GlobalUsers.find().fetch();

				if (!bill) {return;}

				// Get current bill user IDs
				const billUserIds = bill.users.map(u => u.id);
				const globalUserIds = globalUsers.map(u => u._id);

				// Remove users from bill that are no longer in global list
				const usersToRemove = billUserIds.filter(id => !globalUserIds.includes(id));
				for (const userId of usersToRemove) {
					try {
						await Meteor.callAsync('bills.removeUser', billId, userId);
					} catch (err) {
						console.error('Failed to remove user from bill:', err);
					}
				}

				// Add new users from global list that aren't in the bill
				// bills.addUser will automatically add them to all items
				const usersToAdd = globalUsers.filter(u => !billUserIds.includes(u._id));
				for (const user of usersToAdd) {
					try {
						await Meteor.callAsync('bills.addUser', billId, { id: user._id, name: user.name });
					} catch (err) {
						console.error('Failed to add user to bill:', err);
					}
				}

				if (usersToRemove.length > 0 || usersToAdd.length > 0) {
					pushAlert('success', 'Bill users updated');
				}
			});

			modal.show();
		} catch (_error) {
			pushAlert('error', 'Failed to open modal');
		}
	},
	async 'click [id^="removeItem-"]'(e) {
		const itemId = e.currentTarget.getAttribute('data-id');
		const b = Bills.findOne(Template.instance().billId);
		const itemNameEl = e.currentTarget.closest('.item-card')?.querySelector('.item-name');
		const itemName = itemNameEl ? itemNameEl.textContent.trim() : 'item';
		const ok = await showConfirm(`Remove "${itemName}"? This cannot be undone.`, { okText: 'Delete', cancelText: 'Keep' });
		if (!ok) {
			return;
		}
		try {
			await Meteor.callAsync('bills.removeItem', b._id, itemId);
			pushAlert('success', 'Item removed');
		} catch (err) {
			pushAlert('error', err.reason || 'Could not remove item');
		}
	},
	'click #saveReceiptBtn'() {
		const b = Bills.findOne(Template.instance().billId);
		for (const item of b.items) {
			if (item.splitType === 'percent' && item.shares?.length) {
				const total = item.shares.reduce((sum, s) => sum + s.value, 0);
				if (total < 99 || total > 101) {
					pushAlert('error', `Item "${item.name}" percentages must total ~100% (currently ${total}%)`);
					return;
				}
			}
		}
		pushAlert('success', 'Receipt saved!');
		FlowRouter.go('/history');
	},
	async 'click #cancelBtn'(e, tpl) {
		const ok = await showConfirm('Discard this receipt? All unsaved changes will be lost.', { okText: 'Discard', cancelText: 'Cancel' });
		if (!ok) {
			return;
		}
		const billId = tpl.billId;
		if (!billId) {
			FlowRouter.go('/');
			return;
		}
		try {
			await Meteor.callAsync('bills.remove', billId);
			FlowRouter.go('/');
		} catch (err) {
			pushAlert('error', err.reason || 'Could not remove bill');
		}
	},
	'click #backBtn'() {
		FlowRouter.go('/');
	},
});
