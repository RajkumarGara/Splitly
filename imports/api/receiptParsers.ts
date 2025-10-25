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
 * - Validates using "# ITEMS SOLD" count from receipt
 *
 * @param text - Receipt text
 * @param userIds - User IDs to assign to items
 * @returns Parsed receipt data
 */
function parseWalmartReceipt(text: string, userIds: string[]) {
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	const items: Item[] = [];

	const { receiptTotal, taxAmount, totalAmount } = extractTotalsFromLines(lines);

	// Extract expected item count from "# ITEMS SOLD" line
	let expectedItemCount: number | null = null;
	for (const line of lines) {
		const itemsSoldMatch = line.match(/#\s*ITEMS\s*SOLD[:\s]*(\d+)/i);
		if (itemsSoldMatch) {
			expectedItemCount = parseInt(itemsSoldMatch[1], 10);
			console.log(`📋 Walmart receipt expects ${expectedItemCount} items`);
			break;
		}
	}

	const usedLines = new Set<number>();
	const skippedLinesWithPrices: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		if (usedLines.has(i)) {
			continue;
		}

		const line = lines[i];
		const upperLine = line.toUpperCase();

		if (skipLine(line) || upperLine.match(/^(SUB.*?TOTAL|TAX|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|APPROVED|THANK|MASTERCARD|#\s*ITEMS\s*SOLD)/i)) {
			continue;
		}

		// Check if this is a weight/quantity calculation line (skip it completely)
		// Handles OCR errors: ".38 1lbe 1.0 1b 2.67" instead of "2.38 lb @ 1.0 lb /1.12  2.67"
		// These lines should never be extracted as items
		// OCR variations: lb → 1b, ib, lbe, 1be, 1lbe (all variations of lowercase L and b)
		const isWeightCalcLine = /^\.?\d+\.?\d*\s*(lb|1b|ib|lbe|1be|1lbe|llb|i1b)[\s@e1]/i.test(line);
		const isQtyCalcLine = /^\d+\s+AT\s+\d+\s+FOR/i.test(line);

		if (isWeightCalcLine || isQtyCalcLine) {
			// Debug: Log skipped weight lines
			if (isWeightCalcLine) {
				console.log(`   ⏭️  Skipped weight line: "${line}"`);
			}
			continue;
		}

		// Check if next line is a weight/quantity calculation line
		// If so, this line is the item name and next line has the price
		if (i < lines.length - 1) {
			const nextLine = lines[i + 1].trim();
			// More flexible weight matching for OCR errors: "2.38 lb @ 1.0 lb" or ".38 1lbe 1.0 1b"
			// Extract the last price on the line (final calculated price)
			const isWeightLine = /^\.?\d+\.?\d*\s*(lb|1b|ib|lbe|1be|1lbe|llb|i1b)[\s@e1]/i.test(nextLine);
			const isQtyLine = /^\d+\s+AT\s+\d+\s+FOR/i.test(nextLine);

			if (isWeightLine || isQtyLine) {
				// Extract the last price from the calculation line
				const priceMatches = nextLine.match(/(\d+\.\d{2})/g);
				if (priceMatches && priceMatches.length > 0) {
					const finalPrice = parseFloat(priceMatches[priceMatches.length - 1]);

					// Extract item name from current line (has barcode but no price)
					let name = line
						.replace(/\s+\d{12,}\s*[A-Z]?\s*$/i, '')  // Remove barcode
						.replace(/\s+[A-Z]\s*$/i, '')              // Remove tax code
						.replace(/^[0-9/\s]+/, '')                 // Remove leading numbers
						.trim();

					if (name.length >= 2 && name.length <= 60 && !name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|ST#|OP#|TE#|TR#)$/i)) {
						items.push(createItem(name, finalPrice, userIds));
						usedLines.add(i + 1);  // Mark calculation line as used
					}
					continue;  // Move to next line
				}
			}
		}

		// Regular item with price on the same line
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

		if (name.length < 2 || name.length > 60) {
			skippedLinesWithPrices.push(`❌ Name too short/long (${name.length} chars): "${line}"`);
			continue;
		}
		if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|ST#|OP#|TE#|TR#)$/i)) {
			skippedLinesWithPrices.push(`❌ Invalid name pattern: "${line}"`);
			continue;
		}

		items.push(createItem(name, price, userIds));
	}

	// Validate item count against receipt's "# ITEMS SOLD"
	if (expectedItemCount !== null && items.length !== expectedItemCount) {
		console.log(`⚠️  Item count mismatch: Expected ${expectedItemCount}, found ${items.length} (${expectedItemCount - items.length} missing)`);
		if (skippedLinesWithPrices.length > 0) {
			console.log('📝 Lines with prices that were skipped:');
			skippedLinesWithPrices.forEach(line => console.log('  ', line));
		}
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
 * - Optional E prefix or other OCR garbage (EER, AUS i f, k WRI FT, etc.)
 * - Item code (6+ digits or 4-5 digits)
 * - Item name
 * - Price at end
 * - Discount lines: "0000360878 /1491866 3.60-" (subtract from previous item)
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

		// Skip header/footer lines and totals
		if (skipLine(line)) {
			continue;
		}

		// Skip common non-item lines
		if (upperLine.match(/^(SUB.*?TOTAL|.*?TAX.*?%|TAX\s*$|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|DISCOVER|APPROVED|THANK|PURCHASE|\*{3,}|CV\s*Member|SELF-CHECKOUT|NUMBER\s*OF\s*ITEMS|# ITEMS SOLD|FID:|Seq#|App#|Resp:|Tran\s*ID|AMOUNT|CHANGE|XXXX|Payment|Visa)/i)) {
			continue;
		}

		// Check for discount lines (ends with minus: "3.60-" or "1.50-")
		const discountMatch = line.match(/(\d+\.\d{2})-\s*$/);
		if (discountMatch) {
			const discountAmount = parseFloat(discountMatch[1]);
			// Apply discount to the last item added
			if (items.length > 0) {
				const lastItem = items[items.length - 1];
				lastItem.price = parseFloat((lastItem.price - discountAmount).toFixed(2));
				console.log(`   💰 Applied $${discountAmount.toFixed(2)} discount to "${lastItem.name}" → $${lastItem.price.toFixed(2)}`);
			}
			continue;
		}

		// Check for quantity calculation lines (2 @ 3.99 or 2 E 3.99)
		if (/^\d+\s*[@E]\s*\d+\.\d{2}\s*$/.test(line)) {
			continue;
		}

		// Extract price from end of line
		const priceMatch = line.match(/\s+(\d+\.\d{2})\s*$/);
		if (!priceMatch) {
			continue;
		}

		const price = parseFloat(priceMatch[1]);
		const priceIndex = line.lastIndexOf(priceMatch[1]);
		let beforePrice = line.substring(0, priceIndex).trim();

		// Clean up the item name by removing:
		// 1. Item codes (6+ digits or 4-5 digits)
		// 2. OCR garbage prefixes
		// 3. Leading/trailing special characters

		let name = beforePrice;

		// Remove 6+ digit item codes (1892398, 1309922, 1491866, etc.)
		name = name.replace(/\d{6,}\s+/, '');

		// Remove 4-5 digit item codes (8789, 4032, 27003, etc.)
		name = name.replace(/\d{4,5}\s+/, '');

		// Remove OCR garbage patterns at the start
		// Examples: "EER ", "AUS i f ", "k WRI FT ", "C5 AGE", "Ek Lg E ", "e SE ", "ASHEi ", "am ", etc.
		name = name.replace(/^[A-Za-z]{1,3}(\s+[A-Za-z]{1,3}){0,4}\s+/, '');

		// Remove any remaining leading/trailing special characters
		name = name.replace(/^[^A-Z]+/i, '').trim();

		// Skip if name is too short or matches known patterns
		if (name.length < 2 || name.length > 60) {
			continue;
		}

		// Skip if it's a system field
		if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|FID|Seq|App|Resp|Tran|SUBTOTAL|TAX|TOTAL|WHOLESALE|Member|SELF|CHECKOUT)$/i)) {
			continue;
		}

		items.push(createItem(name, price, userIds));
	}

	console.log(`📋 Costco: Extracted ${items.length} items`);
	return finalizeReceipt(items, receiptTotal, taxAmount, totalAmount);
}/**
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
