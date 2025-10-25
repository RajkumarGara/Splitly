/**
 * Data models and types for Splitly application
 */

/**
 * User profile within a bill
 */
export interface UserProfile {
	id: string;
	name: string;
	contact?: string;
	preferences?: Record<string, unknown>;
}

/**
 * Item split type
 */
export type SplitType = 'equal' | 'percent' | 'fixed';

/**
 * Percentage-based split share
 */
export interface ItemSplitSharePercent {
	userId: string;
	type: 'percent';
	value: number;
}

/**
 * Fixed amount split share
 */
export interface ItemSplitShareFixed {
	userId: string;
	type: 'fixed';
	value: number;
}

/**
 * Union type for split shares
 */
export type ItemSplitShare = ItemSplitSharePercent | ItemSplitShareFixed;

/**
 * Bill item
 */
export interface Item {
	id: string;
	name: string;
	price: number;
	userIds: string[]; // for equal split
	splitType?: SplitType;
	shares?: ItemSplitShare[]; // for percent/fixed
}

/**
 * Bill document stored in database
 */
export interface BillDoc {
	_id?: string;
	createdAt: Date;
	updatedAt?: Date;
	date?: string; // Receipt date from OCR
	storeName?: string; // Detected store name
	users: UserProfile[];
	items: Item[];
	receiptTotal?: number | null; // Subtotal from receipt
	calculatedTotal?: number; // Calculated from items
	totalMismatch?: boolean; // If receipt vs calculated differs
	taxAmount?: number;
	totalAmount?: number | null; // Total from receipt
	calculatedWithTax?: number; // Calculated total + tax
	totalWithTaxMismatch?: boolean; // If receipt total vs calculated differs
	currency?: string;
}

/**
 * Expense summary entry for a user
 */
export interface ExpenseSummaryEntry {
	userId: string;
	amount: number;
}

/**
 * Complete expense summary for a bill
 */
export interface ExpenseSummary {
	billId: string;
	grandTotal: number;
	perUser: ExpenseSummaryEntry[];
}

/**
 * Compute expense summary for a bill
 * Calculates how much each user owes based on item assignments and split types
 * @param bill - Bill document
 * @returns Expense summary with per-user amounts
 */
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
