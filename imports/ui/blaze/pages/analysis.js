import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import './analysis.html';
import { Bills } from '/imports/api/bills';
import { computeExpenseSummary } from '/imports/api/models';

// Aggregate spending analytics across all bills
function computeGlobalAnalytics(bills) {
	const perUserMap = new Map();
	const userNameMap = new Map();
	let itemTotal = 0;
	let taxTotal = 0;
	const monthMap = new Map();
	const itemMap = new Map();
	bills.forEach(bill => {
		if (!bill?.items) {
			return;
		}
		const billSummary = computeExpenseSummary(bill);
		const thisTax = Number(bill.taxAmount || 0);
		taxTotal += thisTax;
		const taxPerUser = bill.users?.length ? thisTax / bill.users.length : 0;
		billSummary.perUser.forEach(entry => {
			perUserMap.set(entry.userId, (perUserMap.get(entry.userId) || 0) + entry.amount + taxPerUser);
		});
		(bill.users || []).forEach(u => {
			if (!userNameMap.has(u.id)) {
				userNameMap.set(u.id, u.name);
			}
		});
		itemTotal += billSummary.grandTotal;
		const receiptDate = bill.createdAt instanceof Date ? bill.createdAt : new Date();
		const key = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;
		monthMap.set(key, (monthMap.get(key) || 0) + billSummary.grandTotal + thisTax);
		bill.items.forEach(it => {
			const rec = itemMap.get(it.name) || { total: 0, count: 0 };
			rec.total += it.price;
			rec.count += 1;
			itemMap.set(it.name, rec);
		});
	});
	const totalSpent = itemTotal + taxTotal;
	const perUser = Array.from(perUserMap.entries()).map(([userId, amount]) => ({ userId, name: userNameMap.get(userId) || userId, amount: Number(amount.toFixed(2)) }));
	const grand = totalSpent || 0.00001;
	perUser.sort((a, b) => b.amount - a.amount);
	perUser.forEach(p => {
		p.percent = Number(((p.amount / grand) * 100).toFixed(2));
	});
	const monthly = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total: Number(total.toFixed(2)) })).sort((a, b) => a.month.localeCompare(b.month));
	const topItems = Array.from(itemMap.entries()).map(([name, rec]) => ({ name, total: Number(rec.total.toFixed(2)), count: rec.count })).sort((a, b) => b.total - a.total).slice(0, 10);
	const receiptCount = bills.length;
	const avgPerReceipt = receiptCount ? Number((totalSpent / receiptCount).toFixed(2)) : 0;
	return { totalSpent: Number(totalSpent.toFixed(2)), totalItemSpent: Number(itemTotal.toFixed(2)), taxTotal: Number(taxTotal.toFixed(2)), perUser, monthly, topItems, receiptCount, avgPerReceipt };
}

Template.Analysis.onCreated(function () {
	this.filter = new ReactiveVar([]);
	this.global = new ReactiveVar(null);
	this.sub = this.subscribe('bills.all');
	this.autorun(() => {
		if (!this.sub.ready()) {
			return;
		}
		const bills = Bills.find({}, { sort: { createdAt: -1 } }).fetch();
		this.global.set(computeGlobalAnalytics(bills));
	});
});

Template.Analysis.helpers({
	hasData() {
		const inst = Template.instance();
		if (!inst.sub.ready()) {
			return false;
		}
		const g = inst.global.get();
		return !!(g && g.receiptCount > 0);
	},
	global() {
		return Template.instance().global.get();
	},
	perUserGlobal() {
		const inst = Template.instance();
		const g = inst.global.get();
		if (!g) {
			return [];
		}
		const filter = inst.filter.get();
		const grand = g.totalSpent || 1;
		return g.perUser.filter(p => !filter.length || filter.includes(p.userId)).map(p => ({ ...p, barWidth: (p.amount / grand) * 100 }));
	},
	filterUsers() {
		const g = Template.instance().global.get();
		return g ? g.perUser : [];
	},
	hasFilter() {
		return Template.instance().filter.get().length > 0;
	},
	activeClass(userId) {
		return Template.instance().filter.get().includes(userId) ? 'btn-primary' : 'btn-outline-secondary';
	},
	monthlyBreakdown() {
		const g = Template.instance().global.get();
		return g ? g.monthly : [];
	},
	topItems() {
		const g = Template.instance().global.get();
		return g ? g.topItems : [];
	},
});

Template.Analysis.events({
	'click .filter-btn'(e, t) {
		const id = e.currentTarget.getAttribute('data-id');
		const cur = t.filter.get();
		t.filter.set(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
	},
	'click #clearFilter'(e, t) {
		t.filter.set([]);
	},
});
