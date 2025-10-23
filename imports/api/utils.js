// Formatting & tax helpers.

export function formatMoney(value) {
	if (value === null || value === undefined || value === '') { return '0.00'; }
	const num = Number(parseFloat(value).toFixed(2));
	return num.toFixed(2);
}

export function taxPerUser(bill) {
	if (!bill || !bill.taxAmount) { return 0; }
	const count = (bill.users || []).length;
	if (!count) { return 0; }
	return parseFloat(bill.taxAmount) / count;
}

export function totalPerUserWithTax(bill, userSubtotal) {
	if (!bill) { return 0; }
	const share = taxPerUser(bill);
	const base = parseFloat(userSubtotal || 0);
	const total = base + share; // round after addition
	return Number(total.toFixed(2));
}

export function percentageInclusive(amount, bill, grandTotal) {
	if (!bill) { return '0.00'; }
	const baseItems = parseFloat(grandTotal || 0);
	if (!baseItems) { return '0.00'; }
	if (!bill.taxAmount) { return ((parseFloat(amount || 0) / baseItems) * 100).toFixed(2); }
	const share = taxPerUser(bill);
	const totalWithTaxAll = baseItems + parseFloat(bill.taxAmount);
	if (!totalWithTaxAll) { return '0.00'; }
	return (((parseFloat(amount || 0) + share) / totalWithTaxAll) * 100).toFixed(2);
}
