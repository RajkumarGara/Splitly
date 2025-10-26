/* eslint-env browser */
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { Bills } from '/imports/api/bills';
import { computeExpenseSummary } from '/imports/api/models';
import './history.html';
import { pushAlert, showConfirm } from '../layout';

Template.History.onCreated(function () {
	this.selectedReceipts = new ReactiveVar([]);
	const savedPref = localStorage.getItem('splitly_showHelp');
	this.showHelpInfo = new ReactiveVar(savedPref === null ? true : savedPref === 'true');
});

Template.History.helpers({
	bills() {
		return Bills.find({}, { sort: { createdAt: -1 } }).fetch().map(b => {
			const date = b.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
			const time = b.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
			return { _id: b._id, storeName: b.storeName || 'Receipt', createdAt: `${date} ${time}`, total: computeExpenseSummary(b).grandTotal.toFixed(2), itemCount: b.items?.length || 0, users: b.users.map(u => u.name).join(', ') };
		});
	},
	hasBills() {
		return Bills.find().count() > 0;
	},
	showHelpInfo() {
		return Template.instance().showHelpInfo.get();
	},
	hasSelection() {
		return Template.instance().selectedReceipts.get().length > 0;
	},
	selectedCount() {
		return Template.instance().selectedReceipts.get().length;
	},
	isSelected(id) {
		return Template.instance().selectedReceipts.get().includes(id);
	},
	checkedIfSelected(id) {
		return Template.instance().selectedReceipts.get().includes(id) ? 'checked' : '';
	},
	checkedIfAllSelected() {
		const allBills = Bills.find().fetch();
		const selected = Template.instance().selectedReceipts.get();
		return allBills.length > 0 && selected.length === allBills.length ? 'checked' : '';
	},
});

Template.History.onRendered(function () {
	const tpl = this;
	// Handle checkbox states with autorun to avoid Blaze attribute issues
	this.autorun(() => {
		const selected = tpl.selectedReceipts.get();
		const allBills = Bills.find().fetch();

		// Update individual checkboxes
		document.querySelectorAll('.receipt-checkbox').forEach(cb => {
			const id = cb.getAttribute('data-id');
			cb.checked = selected.includes(id);
		});

		// Update select all checkbox
		const selectAllCb = document.getElementById('selectAllCheckbox');
		if (selectAllCb) {
			selectAllCb.checked = allBills.length > 0 && selected.length === allBills.length;
		}
	});
});

Template.History.events({
	'click #hideHelpBtn'(e, tpl) {
		tpl.showHelpInfo.set(false);
		localStorage.setItem('splitly_showHelp', 'false');
	},
	'change #selectAllCheckbox'(e, tpl) {
		if (e.target.checked) {
			tpl.selectedReceipts.set(Bills.find().fetch().map(b => b._id));
		} else {
			tpl.selectedReceipts.set([]);
		}
	},
	'change .receipt-checkbox'(e, tpl) {
		const id = e.target.getAttribute('data-id');
		const selected = tpl.selectedReceipts.get();
		tpl.selectedReceipts.set(e.target.checked ? [...selected, id] : selected.filter(s => s !== id));
	},
	async 'click #deleteSelectedBtn'(e, tpl) {
		const selected = tpl.selectedReceipts.get();
		const count = selected.length;
		const ok = await showConfirm(`Delete ${count} receipt${count > 1 ? 's' : ''}? This cannot be undone.`, { okText: 'Delete', cancelText: 'Cancel' });
		if (!ok) {
			return;
		}

		let errors = 0;
		for (const id of selected) {
			try {
				await Meteor.callAsync('bills.remove', id);
			} catch (_err) {
				errors++;
			}
		}

		tpl.selectedReceipts.set([]);
		if (!errors) {
			pushAlert('success', `Deleted ${count} receipt${count > 1 ? 's' : ''}`);
		} else {
			pushAlert('error', `Failed to delete ${errors} receipt${errors > 1 ? 's' : ''}`);
		}
	},
	async 'click .delete-single-btn'(e, tpl) {
		const id = e.currentTarget.getAttribute('data-id');
		const ok = await showConfirm('Delete this receipt? This cannot be undone.', { okText: 'Delete', cancelText: 'Cancel' });
		if (!ok) {
			return;
		}
		Meteor.call('bills.remove', id, err => {
			if (err) {
				pushAlert('error', err.reason || 'Failed to delete receipt');
			} else {
				pushAlert('success', 'Receipt deleted');
				tpl.selectedReceipts.set(tpl.selectedReceipts.get().filter(s => s !== id));
			}
		});
	},
});
