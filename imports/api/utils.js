/**
 * Utility functions for bill calculations
 */

/**
 * Format a number as money string with 2 decimal places
 * @param {number|string} value - Value to format
 * @returns {string} Formatted money string (e.g., "12.50")
 */
export function formatMoney(value) {
	if (value === null || value === undefined || value === '') { return '0.00'; }
	const num = Number(parseFloat(value).toFixed(2));
	return num.toFixed(2);
}

/**
 * Calculate tax share per user in a bill
 * @param {Object} bill - Bill object with taxAmount and users
 * @returns {number} Tax amount per user
 */
export function taxPerUser(bill) {
	if (!bill || !bill.taxAmount) { return 0; }
	const count = (bill.users || []).length;
	if (!count || count <= 0) { return 0; }
	return parseFloat(bill.taxAmount) / count;
}

/**
 * Calculate total amount per user including tax share
 * @param {Object} bill - Bill object
 * @param {number|string} userSubtotal - User's subtotal amount
 * @returns {number} Total with tax share
 */
export function totalPerUserWithTax(bill, userSubtotal) {
	if (!bill) { return 0; }
	const share = taxPerUser(bill);
	const base = parseFloat(userSubtotal || 0);
	const total = base + share;
	return Number(total.toFixed(2));
}

/**
 * Calculate percentage of bill (including tax) for a given amount
 * @param {number|string} amount - Amount to calculate percentage for
 * @param {Object} bill - Bill object
 * @param {number|string} grandTotal - Grand total of all items
 * @returns {string} Percentage as string with 2 decimal places
 */
export function percentageInclusive(amount, bill, grandTotal) {
	if (!bill) { return '0.00'; }
	const baseItems = parseFloat(grandTotal || 0);
	if (!baseItems || baseItems <= 0) { return '0.00'; }
	if (!bill.taxAmount) { return ((parseFloat(amount || 0) / baseItems) * 100).toFixed(2); }
	const share = taxPerUser(bill);
	const totalWithTaxAll = baseItems + parseFloat(bill.taxAmount);
	if (!totalWithTaxAll || totalWithTaxAll <= 0) { return '0.00'; }
	return (((parseFloat(amount || 0) + share) / totalWithTaxAll) * 100).toFixed(2);
}
