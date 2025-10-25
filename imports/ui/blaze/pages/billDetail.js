import './billDetail.html';
import { Template } from 'meteor/templating';
import { Bills } from '/imports/api/bills';
import { computeExpenseSummary } from '/imports/api/models';
import { showConfirm, pushAlert } from '../layout';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
Template.BillDetail.helpers({
	bill() {
		const id = FlowRouter.getParam('id');
		return Bills.findOne(id);
	},
	updatedAt() {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		return b?.updatedAt ? new Date(b.updatedAt).toLocaleString() : b?.createdAt?.toLocaleString();
	},
	perUser() {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		if (!b) {
			return [];
		}
		const summary = computeExpenseSummary(b);
		return summary.perUser.map(p => ({ name: (b.users.find(u => u.id === p.userId) || { name: p.userId }).name, amount: p.amount.toFixed(2) }));
	},
	grandTotal() {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		if (!b) {
			return '0.00';
		}
		const summary = computeExpenseSummary(b);
		return summary.grandTotal.toFixed(2);
	},
	itemCount() {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		return b?.items?.length || 0;
	},
	userCount() {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		return b?.users?.length || 0;
	},
});
Template.BillDetail.events({
	'click #exportJson'(_e) {
		const id = FlowRouter.getParam('id');
		const b = Bills.findOne(id);
		if (!b) {
			return;
		}
		const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(b, null, 2));
		const a = document.createElement('a');
		a.href = dataStr;
		a.download = `bill_${b._id}.json`;
		a.click();
	},
	'click #editReceiptBtn'() {
		const id = FlowRouter.getParam('id');
		FlowRouter.go(`/split/${id}`);
	},
	async 'click #deleteReceiptBtn'(_e) {
		const ok = await showConfirm('Delete this receipt? This cannot be undone.', { okText: 'Delete', cancelText: 'Cancel' });
		if (!ok) {
			return;
		}
		const id = FlowRouter.getParam('id');
		try {
			await Meteor.callAsync('bills.remove', id);
			FlowRouter.go('/history');
		} catch (err) {
			pushAlert('error', 'Could not delete receipt: ' + (err.reason || err.message));
		}
	},
});
