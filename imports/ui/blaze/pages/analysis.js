import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import './analysis.html';
import '/client/styles/analysis.css';
import { Bills } from '/imports/api/bills';
import { computeExpenseSummary } from '/imports/api/models';

// Aggregate spending analytics across all bills, optionally filtered by users
function computeGlobalAnalytics(bills, filterUserIds = []) {
	const perUserMap = new Map();
	const userNameMap = new Map();
	let itemTotal = 0;
	let taxTotal = 0;
	const monthMap = new Map();
	const itemMap = new Map();
	const storeMap = new Map();

	bills.forEach(bill => {
		if (!bill?.items) {
			return;
		}

		// Filter bills by user participation if filter is active
		if (filterUserIds.length > 0) {
			const billUserIds = (bill.users || []).map(u => u.id);
			const hasFilteredUser = filterUserIds.some(uid => billUserIds.includes(uid));
			if (!hasFilteredUser) {
				return; // Skip this bill if none of the filtered users are in it
			}
		}

		const billSummary = computeExpenseSummary(bill);
		const thisTax = Number(bill.taxAmount || 0);
		const taxPerUser = bill.users?.length ? thisTax / bill.users.length : 0;

		// Only aggregate spending for filtered users (or all users if no filter)
		billSummary.perUser.forEach(entry => {
			if (filterUserIds.length === 0 || filterUserIds.includes(entry.userId)) {
				perUserMap.set(entry.userId, (perUserMap.get(entry.userId) || 0) + entry.amount + taxPerUser);
			}
		});

		// Track all users' names for filter chips
		(bill.users || []).forEach(u => {
			if (!userNameMap.has(u.id)) {
				userNameMap.set(u.id, u.name);
			}
		});

		// Only count items and tax for filtered users
		let billItemTotal = 0;
		let billTaxTotal = 0;
		let billItemCount = 0;

		// Track items - only count items that filtered users are assigned to
		bill.items.forEach(it => {
			if (filterUserIds.length > 0) {
				// Only count item if at least one filtered user is assigned to it
				const hasFilteredUser = filterUserIds.some(uid => it.userIds?.includes(uid));
				if (!hasFilteredUser) {
					return;
				}
			}

			const rec = itemMap.get(it.name) || { total: 0, count: 0 };
			rec.total += it.price;
			rec.count += 1;
			itemMap.set(it.name, rec);

			billItemTotal += it.price;
			billItemCount += 1;
		});

		// Only count tax if filtering and user participated
		if (filterUserIds.length === 0 || billItemCount > 0) {
			billTaxTotal = taxPerUser * (filterUserIds.length || bill.users?.length || 1);
		}

		itemTotal += billItemTotal;
		taxTotal += billTaxTotal;

		const receiptDate = bill.createdAt instanceof Date ? bill.createdAt : new Date();
		const key = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;
		monthMap.set(key, (monthMap.get(key) || 0) + billItemTotal + billTaxTotal);

		// Track stores - only count for filtered items
		if (billItemCount > 0) {
			const storeName = bill.storeName || 'Unknown Store';
			const storeRec = storeMap.get(storeName) || { total: 0, count: 0, itemCount: 0 };
			storeRec.total += billItemTotal + billTaxTotal;
			storeRec.count += 1;
			storeRec.itemCount += billItemCount;
			storeMap.set(storeName, storeRec);
		}
	});

	const totalSpent = itemTotal + taxTotal;
	const perUser = Array.from(perUserMap.entries()).map(([userId, amount]) => ({ userId, name: userNameMap.get(userId) || userId, amount: Number(amount.toFixed(2)) }));
	const grand = totalSpent || 0.00001;
	perUser.sort((a, b) => b.amount - a.amount);
	perUser.forEach(p => {
		p.percent = Number(((p.amount / grand) * 100).toFixed(2));
	});

	const monthly = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total: Number(total.toFixed(2)) })).sort((a, b) => a.month.localeCompare(b.month));

	// Most valuable items (by total spending)
	const mostValuable = Array.from(itemMap.entries())
		.map(([name, rec]) => ({ name, total: Number(rec.total.toFixed(2)), count: rec.count }))
		.sort((a, b) => b.total - a.total)
		.slice(0, 5);

	// Most frequently purchased items (by count)
	const mostFrequent = Array.from(itemMap.entries())
		.map(([name, rec]) => ({ name, total: Number(rec.total.toFixed(2)), count: rec.count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 5);

	// Store-wise breakdown
	const storeBreakdown = Array.from(storeMap.entries())
		.map(([name, rec]) => ({
			name,
			total: Number(rec.total.toFixed(2)),
			count: rec.count,
			itemCount: rec.itemCount,
			avgPerVisit: Number((rec.total / rec.count).toFixed(2)),
		}))
		.sort((a, b) => b.total - a.total);

	const receiptCount = bills.filter(b => {
		if (filterUserIds.length === 0) {return true;}
		const billUserIds = (b.users || []).map(u => u.id);
		return filterUserIds.some(uid => billUserIds.includes(uid));
	}).length;

	const avgPerReceipt = receiptCount ? Number((totalSpent / receiptCount).toFixed(2)) : 0;

	return {
		totalSpent: Number(totalSpent.toFixed(2)),
		totalItemSpent: Number(itemTotal.toFixed(2)),
		taxTotal: Number(taxTotal.toFixed(2)),
		perUser,
		monthly,
		mostValuable,
		mostFrequent,
		storeBreakdown,
		receiptCount,
		avgPerReceipt,
	};
}

Template.Analysis.onCreated(function () {
	this.filter = new ReactiveVar([]);
	this.global = new ReactiveVar(null);
	this.allUsers = new ReactiveVar([]);

	// Track subscription ready state
	this.subscriptionReady = new ReactiveVar(false);

	// Subscribe and track ready state
	this.autorun(() => {
		const handle = this.subscribe('bills.all');
		this.subscriptionReady.set(handle.ready());

		// Use data immediately if available from main subscription
		if (handle.ready()) {
			const bills = Bills.find({}, { sort: { createdAt: -1 } }).fetch();
			const filter = this.filter.get(); // React to filter changes

			// Compute analytics with current filter
			this.global.set(computeGlobalAnalytics(bills, filter));

			// Always keep all users list for filter chips (computed without filter)
			if (filter.length === 0) {
				const allAnalytics = computeGlobalAnalytics(bills, []);
				this.allUsers.set(allAnalytics.perUser);
			}
		}
	});
});

Template.Analysis.helpers({
	subscriptionReady() {
		return Template.instance().subscriptionReady.get();
	},
	hasData() {
		const inst = Template.instance();
		// Use cached data if available, don't wait for subscription
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
		const grand = g.totalSpent || 1;
		return g.perUser.map(p => ({ ...p, barWidth: (p.amount / grand) * 100 }));
	},
	filterUsers() {
		const inst = Template.instance();
		// Show all users for filter chips, not just filtered ones
		const allUsers = inst.allUsers.get();
		if (allUsers && allUsers.length > 0) {
			return allUsers;
		}
		// Fallback to current global if allUsers not set yet
		const g = inst.global.get();
		return g ? g.perUser : [];
	},
	hasFilter() {
		return Template.instance().filter.get().length > 0;
	},
	activeClass(userId) {
		return Template.instance().filter.get().includes(userId);
	},
	monthlyBreakdown() {
		const g = Template.instance().global.get();
		return g ? g.monthly : [];
	},
	mostValuable() {
		const g = Template.instance().global.get();
		return g ? g.mostValuable : [];
	},
	mostFrequent() {
		const g = Template.instance().global.get();
		return g ? g.mostFrequent : [];
	},
	storeBreakdown() {
		const g = Template.instance().global.get();
		return g ? g.storeBreakdown : [];
	},
	incIndex(index) {
		return index + 1;
	},
});

Template.Analysis.events({
	'click .filter-chip[data-id]'(e, t) {
		const id = e.currentTarget.getAttribute('data-id');
		const cur = t.filter.get();
		// Single-select: if clicking the same user, deselect (clear filter), otherwise select only this user
		t.filter.set(cur.includes(id) && cur.length === 1 ? [] : [id]);
	},
	'click #clearFilter'(e, t) {
		t.filter.set([]);
	},
});
