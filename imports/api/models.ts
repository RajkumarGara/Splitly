export interface UserProfile {
	id: string;
	name: string;
	contact?: string;
	preferences?: Record<string, unknown>;
}
export type SplitType = 'equal' | 'percent' | 'fixed';
export interface ItemSplitSharePercent { userId: string; type: 'percent'; value: number; }
export interface ItemSplitShareFixed { userId: string; type: 'fixed'; value: number; }
export type ItemSplitShare = ItemSplitSharePercent | ItemSplitShareFixed;
export interface Item {
	id: string;
	name: string;
	price: number;
	userIds: string[]; // for equal split
	splitType?: SplitType;
	shares?: ItemSplitShare[]; // for percent/fixed
}
export interface BillDoc {
	_id?: string;
	createdAt: Date;
	updatedAt?: Date;
	date?: string;
	users: UserProfile[];
	items: Item[];
	currency?: string;
}
export interface ExpenseSummaryEntry { userId: string; amount: number; }
export interface ExpenseSummary { billId: string; grandTotal: number; perUser: ExpenseSummaryEntry[]; }

export function computeExpenseSummary(bill: BillDoc): ExpenseSummary {
	const perUserMap = new Map<string, number>();
	let grandTotal = 0;
	bill.items.forEach(item => {
		grandTotal += item.price;
		if (item.splitType === 'percent' && item.shares) {
			const percentShares = item.shares.filter(s => s.type === 'percent');
			const sumPercent = percentShares.reduce((a, b) => a + b.value, 0) || 100;
			const scale = 100 / sumPercent;
			percentShares.forEach(s => {
				const amt = item.price * (s.value * scale / 100);
				perUserMap.set(s.userId, (perUserMap.get(s.userId) || 0) + amt);
			});
		} else if (item.splitType === 'fixed' && item.shares) {
			const fixedShares = item.shares.filter(s => s.type === 'fixed');
			let allocated = 0;
			fixedShares.forEach(s => {
				allocated += s.value;
				perUserMap.set(s.userId, (perUserMap.get(s.userId) || 0) + s.value);
			});
			const remainder = Math.max(0, item.price - allocated);
			if (remainder > 0 && fixedShares.length) {
				const extra = remainder / fixedShares.length;
				fixedShares.forEach(s => {
					perUserMap.set(s.userId, (perUserMap.get(s.userId) || 0) + extra);
				});
			}
		} else if (item.userIds.length) {
			const share = item.price / item.userIds.length;
			item.userIds.forEach(uid => perUserMap.set(uid, (perUserMap.get(uid) || 0) + share));
		}
	});
	return {
		billId: bill._id || 'local',
		grandTotal: Number(grandTotal.toFixed(2)),
		perUser: Array.from(perUserMap.entries()).map(([userId, amount]) => ({ userId, amount: Number(amount.toFixed(2)) })),
	};
}
