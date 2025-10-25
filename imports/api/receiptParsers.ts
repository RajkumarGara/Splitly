import type { Item } from './models';
import {
	detectStoreName,
	skipLine,
	extractTotalsFromLines,
	extractPriceFromLine,
	createItem,
	finalizeReceipt,
} from './receiptUtils';

/**
 * Main receipt parser (router)
 * Routes to store-specific parsers based on detected store name
 */

/**
 * Parse receipt text and extract items
 * @param text - OCR extracted text from receipt
 * @param userIds - Array of user IDs to assign to items
 * @returns Parsed receipt data with items and totals
 */
export function parseReceiptText(text: string, userIds: string[]) {
	const storeName = detectStoreName(text);

	switch (storeName) {
		case 'Walmart':
			return parseWalmartReceipt(text, userIds);
		case 'Halal':
			return parseHalalMarketReceipt(text, userIds);
		case 'Costco':
			return parseCostcoReceipt(text, userIds);
		default:
			return parseGenericReceipt(text, userIds);
	}
}

/**
 * Walmart-specific receipt parser
 *
 * Format: "ITEM NAME  BARCODE F  PRICE"
 * - Items have 12+ digit barcodes followed by tax code (F, N, etc.)
 * - Prices don't have $ symbol
 * - Weight lines: "2.85 lb @ 1.0 lb /0.78  2.22" (skip these)
 * - Quantity lines: "3 AT 1 FOR 0.77  2.31" (skip these)
 *
 * @param text - Receipt text
 * @param userIds - User IDs to assign to items
 * @returns Parsed receipt data
 */
function parseWalmartReceipt(text: string, userIds: string[]) {
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	const items: Item[] = [];

	const { receiptTotal, taxAmount, totalAmount } = extractTotalsFromLines(lines);
	const usedLines = new Set<number>();

	for (let i = 0; i < lines.length; i++) {
		if (usedLines.has(i)) {
			continue;
		}

		const line = lines[i];
		const upperLine = line.toUpperCase();

		if (skipLine(line) || upperLine.match(/^(SUB.*?TOTAL|TAX|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|APPROVED|THANK|MASTERCARD|#\s*ITEMS\s*SOLD)/i)) {
			continue;
		}

		if (/^[\d.]+\s*lb\s*[@e]/i.test(line) || /^\d+\s+AT\s+\d+\s+FOR/i.test(line)) {
			continue;
		}

		const priceMatch = line.match(/\s+(\d+\.\d{2})\s*$/);
		if (!priceMatch) {
			continue;
		}

		const price = parseFloat(priceMatch[1]);
		const priceIndex = line.lastIndexOf(priceMatch[1]);

		let beforePrice = line.substring(0, priceIndex).trim();

		beforePrice = beforePrice
			.replace(/\s+\d{12,}\s*[A-Z]?\s*$/i, '')
			.replace(/\s+[A-Z]\s*$/i, '')
			.trim();

		let name = beforePrice;

		name = name.replace(/^[0-9/\s]+/, '').trim();

		if (i < lines.length - 1) {
			const nextLine = lines[i + 1].trim();
			if (/^[\d.]+\s*lb\s*[@e]/i.test(nextLine) || /^\d+\s+AT\s+\d+\s+FOR/i.test(nextLine)) {
				usedLines.add(i + 1);
			}
		}

		if (name.length < 2 || name.length > 60) {
			continue;
		}
		if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|ST#|OP#|TE#|TR#)$/i)) {
			continue;
		}

		items.push(createItem(name, price, userIds));
	}

	return finalizeReceipt(items, receiptTotal, taxAmount, totalAmount);
}

/**
 * Halal Market-specific receipt parser
 *
 * Format: Two patterns:
 * 1. Multi-line: "Crispy Gujarati" (line 1) then "Roti 400g  2  $9.58 N" (line 2)
 * 2. Single-line: "Fruits & Vege  1  $3.50 N"
 * - Prices end with N or T tax marker
 * - May have $ symbol but not always
 * - Quantity before price
 *
 * @param text - Receipt text
 * @param userIds - User IDs to assign to items
 * @returns Parsed receipt data
 */
function parseHalalMarketReceipt(text: string, userIds: string[]) {
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	const items: Item[] = [];

	const { receiptTotal, taxAmount, totalAmount } = extractTotalsFromLines(lines);
	const usedLines = new Set<number>();

	for (let i = 0; i < lines.length; i++) {
		if (usedLines.has(i)) {
			continue;
		}

		const line = lines[i];
		const upperLine = line.toUpperCase();

		if (skipLine(line) || upperLine.match(/^(SUB.*?TOTAL|TAX|TOTAL|BALANCE|CHANGE|THANK)/i)) {
			continue;
		}

		const priceMatch = line.match(/[$§]?(\d+\.\d{2})\s*[NT]\s*$/i);

		if (priceMatch) {
			const price = parseFloat(priceMatch[1]);
			const priceIndex = line.indexOf(priceMatch[0]);
			let beforePrice = line.substring(0, priceIndex).trim();

			const qtyMatch = beforePrice.match(/^(.*?)\s+(\d{1,2})$/);
			let name = beforePrice;
			if (qtyMatch) {
				name = qtyMatch[1].trim();
			}

			if (i > 0 && !usedLines.has(i - 1)) {
				const prevLine = lines[i - 1].trim();
				const prevUpper = prevLine.toUpperCase();

				const prevHasPrice = /\$?\d+\.\d{2}\s*[NT]?\s*$/i.test(prevLine);
				const prevIsHeader = skipLine(prevLine) || prevUpper.match(/^(PRODUCT|QTY|AMT|CUSTOMER|CASHIER|REG)/i);

				if (!prevHasPrice && !prevIsHeader && prevLine.length < 40) {
					name = `${prevLine} ${name}`;
					usedLines.add(i - 1);
				}
			}

			name = name.replace(/^[0-9/\s]+/, '').trim();

			if (name.length < 3 || name.length > 80) {
				continue;
			}
			if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE)$/i)) {
				continue;
			}

			items.push(createItem(name, price, userIds));
		}
	}

	return finalizeReceipt(items, receiptTotal, taxAmount, totalAmount);
}

/**
 * Costco-specific receipt parser
 *
 * Format: "E  1892398 SMOOTHIES  16.99"
 * - Optional E prefix or other OCR garbage (EER, AUS i f, etc.)
 * - Item code (6+ digits)
 * - Item name
 * - Price at end
 * - Quantity lines: "2 @ 3.99" (skip these)
 *
 * @param text - Receipt text
 * @param userIds - User IDs to assign to items
 * @returns Parsed receipt data
 */
function parseCostcoReceipt(text: string, userIds: string[]) {
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	const items: Item[] = [];

	const { receiptTotal, taxAmount, totalAmount } = extractTotalsFromLines(lines);
	const usedLines = new Set<number>();

	for (let i = 0; i < lines.length; i++) {
		if (usedLines.has(i)) {
			continue;
		}

		const line = lines[i];
		const upperLine = line.toUpperCase();

		if (skipLine(line) || upperLine.match(/^(SUB.*?TOTAL|TAX|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|APPROVED|THANK|\*{3,}|CV Member|SELF-CHECKOUT)/i)) {
			continue;
		}

		const priceMatch = line.match(/\s+(-?\d+\.\d{2})\s*$/);
		if (!priceMatch) {
			continue;
		}

		const price = Math.abs(parseFloat(priceMatch[1]));
		const priceIndex = line.lastIndexOf(priceMatch[1]);

		let beforePrice = line.substring(0, priceIndex).trim();

		beforePrice = beforePrice
			.replace(/^[A-Z]{1,5}\s+/i, '')
			.replace(/^[a-z\s]+/i, '')
			.replace(/^\d{6,}\s+/, '')
			.trim();

		let name = beforePrice;

		if (i < lines.length - 1) {
			const nextLine = lines[i + 1].trim();
			const nextQtyMatch = nextLine.match(/^(\d+)\s*@\s*(\d+\.\d{2})\s*$/);
			if (nextQtyMatch) {
				usedLines.add(i + 1);
			}
		}

		if (name.length < 2 || name.length > 60) {
			continue;
		}
		if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|FID|Seq|App#)$/i)) {
			continue;
		}

		items.push(createItem(name, price, userIds));
	}

	return finalizeReceipt(items, receiptTotal, taxAmount, totalAmount);
}

/**
 * Generic receipt parser (fallback)
 *
 * Used when store is not recognized
 * Handles various receipt formats with flexible price extraction
 * Supports multi-line item names
 *
 * @param text - Receipt text
 * @param userIds - User IDs to assign to items
 * @returns Parsed receipt data
 */
function parseGenericReceipt(text: string, userIds: string[]) {
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	const items: Item[] = [];

	const { receiptTotal, taxAmount, totalAmount } = extractTotalsFromLines(lines);
	const usedLines = new Set<number>();

	for (let i = 0; i < lines.length; i++) {
		if (usedLines.has(i)) {
			continue;
		}

		const line = lines[i];
		const upperLine = line.toUpperCase();

		if (skipLine(line) || upperLine.match(/^(SUB.*?TOTAL|TAX|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|APPROVED|THANK)/i)) {
			continue;
		}

		const priceData = extractPriceFromLine(line);
		if (!priceData) {
			continue;
		}

		let name = line.substring(0, priceData.priceIndex).trim();

		name = name
			.replace(/^[EOX]\s+/, '')
			.replace(/^[0-9/\s]+/, '')
			.replace(/\s+@.*$/, '')
			.replace(/\s+[A-Z]\d+$/i, '')
			.trim();

		if (name.length >= 3 && i < lines.length - 1) {
			const nextLine = lines[i + 1].trim();
			const hasPrice = /\d{1,4}[.\s:]\d{2}/.test(nextLine);
			const isShort = nextLine.length < 30;
			const startsLower = /^[a-z]/.test(nextLine);
			const endsWithUnits = /\d+g$|\d+lb$/i.test(nextLine);

			if (!hasPrice && isShort && (startsLower || endsWithUnits)) {
				name = `${name} ${nextLine}`;
				usedLines.add(i + 1);
			}
		}

		if (name.length < 3 || name.length > 60) {
			continue;
		}
		if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|DAIRY|FROZEN|POULTRY|PRODUCE|SEAFOOD|BAKERY|MEAT|DELI)$/i)) {
			continue;
		}

		items.push(createItem(name, priceData.price, userIds));
	}

	return finalizeReceipt(items, receiptTotal, taxAmount, totalAmount);
}
