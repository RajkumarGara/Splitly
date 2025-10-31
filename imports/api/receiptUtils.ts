import type { Item } from './models';

/**
 * Shared utility functions for receipt parsing
 * Used by all store-specific parsers
 */

/**
 * Check if a line should be skipped during parsing
 * Skips headers, dates, times, separators, payment info, etc.
 * @param line - Receipt line to check
 * @returns True if line should be skipped
 */
export function skipLine(line: string) {
	return !!(
		line.match(/^(ST#|OP#|TE#|TR#|TC#|TID|PID|AID|TVR|TSI|CV Member|Seq|App#|Tran ID|RRN|FID)/i) ||
		line.match(/^(STORE|CASHIER|CUSTOMER|CASH|REG|INVOICE|SALE|SELF-CHECKOUT|Resp:)/i) ||
		line.match(/^(Sales Check #|Entry Method|FTFM|APPROVED)/i) ||
		line.match(/^(WAL\*MART|Save money|Live better)/i) || // Store headers
		line.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/) || // dates
		line.match(/^\d{2}:\d{2}/) || // times
		line.match(/^[\d\s:]+$/) || // only digits and spaces
		line.match(/^[|\-*=_]+$/) || // separators
		line.match(/^[A-Z]{1,3}:\s*$/) || // single letters with colon
		line.match(/^\d{10,}$/) || // long number strings (barcodes, IDs)
		line.match(/^(DISCOVER|AID|TVR|TSI|APPROVED|Entry Method|FTFM|Resp:|AMOUNT|CHANGE)/i) || // payment info
		line.match(/^(Visa|VISA|MASTERCARD|DEBIT|CREDIT|TEND)/i) || // payment types
		line.match(/^(DAIRY|FROZEN|PRODUCE|POULTRY|SEAFOOD|BAKERY|MEAT|DELI)$/i) || // section headers
		line.match(/^[XE]\s*$/) || // Single letter lines
		line.match(/^(Thank You|Have A Nice Day|For Your Business)/i) || // Receipt footer
		line.match(/^\*{3,}/) || // Stars for credit card numbers
		line.match(/^#\s*ITEMS\s*SOLD/i) || // Walmart item count
		line.match(/^TC#\s*\d+/) || // Transaction numbers
		line.match(/^[\d.]+\s*lb\s*[@e]/i) || // Weight calculation lines: "2.68 lb @ 1.0 lb"
		line.match(/^\d+\s+AT\s+\d+\s+FOR/i) || // Quantity lines: "3 AT 1 FOR 0.77"
		line.length < 2
	);
}

/**
 * Detect store name from receipt text
 * Checks for store-specific patterns in order of specificity
 * @param text - Full receipt text
 * @returns Store name or 'Receipt' if not recognized
 */
export function detectStoreName(text: string): string {
	const upperText = text.toUpperCase();

	const storePatterns = [
		{ pattern: /WAL[*\s\-_]?MART/i, name: 'Walmart' },
		{ pattern: /HALAL\s*MARKET|FORT\s*WAYNE\s*HALAL|FWHALALMARKET|FWHALALMARKET@GMAIL|fwhalalmarket@gmail/i, name: 'Halal' },
		{ pattern: /TARGET/i, name: 'Target' },
		{ pattern: /KROGER/i, name: 'Kroger' },
		{ pattern: /FRESH\s*THYME|FRESHTHYME\.COM/i, name: 'Fresh Thyme' },
		{ pattern: /DOLLAR\s*GENERAL/i, name: 'Dollar General' },
		{ pattern: /DOLLAR\s*TREE/i, name: 'Dollar Tree' },
	];

	for (const { pattern, name } of storePatterns) {
		if (pattern.test(upperText)) {
			return name;
		}
	}

	return 'Receipt';
}

/**
 * Extract date from receipt lines
 * Supports multiple date/time formats:
 * - MM/DD/YYYY HH:MM:SS AM/PM
 * - MM/DD/YY HH:MM:SS
 * - MM/DD/YYYY HH:MM
 * - MM-DD-YYYY
 * - YYYY-MM-DD
 * @param lines - Array of receipt lines
 * @returns Date string or null if not found
 */
export function extractDateFromLines(lines: string[]): string | null {
	// Date patterns to match various receipt formats
	const datePatterns = [
		// MM/DD/YYYY HH:MM:SS AM/PM (Halal: 10/17/2025 12:01:17 PM)
		/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/i,
		// MM/DD/YY HH:MM:SS (Walmart: 10/14/25 18:21:40)
		/(\d{1,2}\/\d{1,2}\/\d{2})\s+(\d{1,2}:\d{2}:\d{2})/,
		// MM/DD/YYYY HH:MM (Costco: 03/14/2025 17:34)
		/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})/,
		// MM/DD/YY HH:MM (Generic)
		/(\d{1,2}\/\d{1,2}\/\d{2})\s+(\d{1,2}:\d{2})/,
		// MM-DD-YYYY or MM-DD-YY
		/(\d{1,2}-\d{1,2}-\d{2,4})/,
		// YYYY-MM-DD
		/(\d{4}-\d{1,2}-\d{1,2})/,
	];

	for (const line of lines) {
		for (const pattern of datePatterns) {
			const match = line.match(pattern);
			if (match) {
				return match[0]; // Return the full matched date string
			}
		}
	}

	return null;
}

/**
 * Extract subtotal, tax, and total from receipt lines
 * @param lines - Array of receipt lines
 * @returns Object with receiptTotal, taxAmount, and totalAmount
 */
export function extractTotalsFromLines(lines: string[]) {
	let receiptTotal: number | null = null;
	let taxAmount = 0;
	let totalAmount: number | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const upperLine = line.toUpperCase();

		// Match SUBTOTAL
		if (!receiptTotal && upperLine.match(/SUB.*?TOTAL/i)) {
			const match = line.match(/[$]?(\d+[.,]\d{2})/);
			if (match) {
				receiptTotal = parseFloat(match[1].replace(',', '.'));
			}
		}

		// Match TAX (but not TOTAL or subtotal lines)
		if (upperLine.match(/TAX/i) && !upperLine.match(/TOTAL|SUBTOTAL/i)) {
			const match = line.match(/[$]?(\d+[.,]\d{2})/);
			if (match) {
				taxAmount += parseFloat(match[1].replace(',', '.'));
			}
		}

		// Match TOTAL (including Costco's "*** TOTAL" format)
		if (!totalAmount && upperLine.match(/^\*+\s*TOTAL|^(?!.*SUB).*TOTAL|DEBIT|VISA|CREDIT|PAID|AMOUNT DUE|BALANCE DUE/i)) {
			const match = line.match(/[$]?(\d+[.,]\d{2})/);
			if (match) {
				const amount = parseFloat(match[1].replace(',', '.'));
				if (amount > 0) {
					totalAmount = amount;
				}
			}
		}
	}

	return { receiptTotal, taxAmount, totalAmount };
}

/**
 * Extract price from a receipt line
 * Handles various price formats: $X.XX, X.XX, X:XX (OCR misread)
 * @param line - Receipt line
 * @returns Price and position, or null if no valid price found
 */
export function extractPriceFromLine(line: string): { price: number; priceIndex: number } | null {
	const pricePatterns = [
		/[$§](\d+)[.\s](\d{2})/g,           // $1.48, $1 48, §2
		/\b(\d{1,4})\.(\d{2})\b/g,          // 4.99, 50.35
		/(\d{1,4})\.(\d{2})\s+[A-Z]\s*[A-Z]?$/g,  // 4.99 N F
		/\b(\d{1,4}):(\d{2})\b/g,           // 9:58 (OCR misread)
	];

	let foundPrice: number | null = null;
	let priceIndex = 0;

	for (const pattern of pricePatterns) {
		const matches = Array.from(line.matchAll(pattern));

		for (const match of matches) {
			if (!match.index) {
				continue;
			}

			const dollars = match[1];
			const cents = match[2];
			const price = parseFloat(`${dollars}.${cents}`);

			if (price > 0 && price < 1000) {
				if (match.index >= priceIndex) {
					foundPrice = price;
					priceIndex = match.index;
				}
			}
		}
	}

	if (!foundPrice) {
		return null;
	}
	return { price: foundPrice, priceIndex };
}

/**
 * Create an item object with cleaned name
 * @param name - Raw item name from receipt
 * @param price - Item price
 * @param userIds - User IDs to assign to item
 * @returns Item object
 */
export function createItem(name: string, price: number, userIds: string[]): Item {
	return {
		id: `ocr${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		name: cleanName(name),
		price,
		userIds,
		splitType: 'equal',
	};
}

/**
 * Finalize receipt data
 * If totals not found in receipt, calculate from items
 * @param items - Extracted items
 * @param receiptTotal - Subtotal from receipt
 * @param taxAmount - Tax from receipt
 * @param totalAmount - Total from receipt
 * @returns Complete receipt data
 */
export function finalizeReceipt(items: Item[], receiptTotal: number | null, taxAmount: number, totalAmount: number | null) {
	// Validate inputs
	if (!Array.isArray(items)) {
		items = [];
	}
	taxAmount = Number(taxAmount) || 0;

	// Calculate totals from items if not found
	if ((!receiptTotal || !totalAmount) && items.length > 0) {
		receiptTotal = receiptTotal || parseFloat(items.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2));
		totalAmount = totalAmount || receiptTotal + taxAmount;
	}

	return { items, receiptTotal, taxAmount, totalAmount };
}

/**
 * Clean item name
 * Removes OCR artifacts, codes, and standardizes format
 * Uses only generic patterns, not product-specific replacements
 * @param raw - Raw item name from receipt
 * @returns Cleaned item name
 */
export function cleanName(raw: string) {
	let name = raw.trim();

	// Remove common OCR artifacts and formatting
	name = name.replace(/\s+\d{1,3}CT$/i, '');  // "36CT" suffix
	name = name.replace(/\s+[A-Z]\d+$/i, '');   // Code suffixes like "A1"
	name = name.replace(/\s+[|/].*$/, '');      // Remove | or / and everything after
	name = name.replace(/\s+[$§]\s*$/, '');     // Trailing $ or §
	name = name.replace(/\s{2,}/g, ' ');        // Normalize spaces
	name = name.replace(/\s+[A-Z]$/, '');       // Single letter at end (N, F, T)
	name = name.replace(/\s+\d+$/, '');         // Trailing quantity numbers
	name = name.replace(/\s+[NTF]F?$/i, '');    // Tax codes "N F" or "T"

	// Generic OCR corrections (not product-specific)
	name = name.replace(/0RGAN/gi, 'ORGAN');    // 0 -> O
	name = name.replace(/0RG/gi, 'ORG');        // 0 -> O
	name = name.replace(/(\w+)\s+\1/gi, '$1');  // Remove duplicates (ITEM ITEM -> ITEM)

	return name.trim();
}
