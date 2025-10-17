import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import type { BillDoc, UserProfile, Item } from './models';
// Using loose any collection due to temporary ambient types; can be replaced with proper generics once types fixed.
export const Bills = new (Mongo as any).Collection('bills');

Meteor.methods({
	async 'bills.insert'(bill: BillDoc) {
		check(bill, Object);
		if (!Array.isArray(bill.users)) { bill.users = []; }
		if (!Array.isArray(bill.items)) { bill.items = []; }
		bill.createdAt = bill.createdAt || new Date();
		bill.updatedAt = bill.createdAt;
		return await Bills.insertAsync(bill);
	},
	async 'bills.addUser'(billId: string, user: UserProfile) {
		check(billId, String); check(user, Object);
		if (!user.name?.trim()) { throw new Meteor.Error('invalid-user', 'User name required'); }
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		if (existing.users.some((u: UserProfile) => u.name === user.name)) { throw new Meteor.Error('duplicate-user', 'User name already exists'); }
		await Bills.updateAsync(billId, { $push: { users: user }, $set: { updatedAt: new Date() } });
	},
	async 'bills.removeUser'(billId: string, userId: string) {
		check(billId, String); check(userId, String);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.updateAsync(billId, { $set: { users: existing.users.filter((u: UserProfile) => u.id !== userId), items: existing.items.map((i: Item) => ({ ...i, userIds: i.userIds.filter((id: string) => id !== userId) })), updatedAt: new Date() } });
	},
	async 'bills.addItem'(billId: string, item: Item) {
		check(billId, String); check(item, Object);
		if (!item.name?.trim()) { throw new Meteor.Error('invalid-item', 'Item name required'); }
		if (typeof item.price !== 'number' || item.price <= 0) { throw new Meteor.Error('invalid-price', 'Item price must be > 0'); }
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.updateAsync(billId, { $push: { items: item }, $set: { updatedAt: new Date() } });
	},
	async 'bills.removeItem'(billId: string, itemId: string) {
		check(billId, String); check(itemId, String);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.updateAsync(billId, { $set: { items: existing.items.filter((i: Item) => i.id !== itemId), updatedAt: new Date() } });
	},
	async 'bills.remove'(billId: string) {
		check(billId, String);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.removeAsync(billId);
	},
	async 'bills.updateItems'(billId: string, items: Item[]) {
		check(billId, String);
		check(items, Array);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.updateAsync(billId, { $set: { items, updatedAt: new Date() } });
	},
	async 'bills.updateTax'(billId: string, taxAmount: number) {
		check(billId, String);
		check(taxAmount, Number);
		if (taxAmount < 0) { throw new Meteor.Error('invalid-tax', 'Tax amount cannot be negative'); }
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		await Bills.updateAsync(billId, { $set: { taxAmount: Number(taxAmount.toFixed(2)), updatedAt: new Date() } });
	},
	async 'bills.toggleUserOnItem'(billId: string, itemId: string, userId: string) {
		check(billId, String);
		check(itemId, String);
		check(userId, String);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		const item = existing.items.find((i: Item) => i.id === itemId);
		if (!item) { throw new Meteor.Error('not-found', 'Item not found'); }

		// Toggle user: add if not present, remove if present
		const userIds = item.userIds || [];
		const index = userIds.indexOf(userId);
		const newUserIds = index >= 0
			? userIds.filter((id: string) => id !== userId)
			: [...userIds, userId];

		// Update the items array
		const updatedItems = existing.items.map((i: Item) =>
			i.id === itemId ? { ...i, userIds: newUserIds } : i,
		);

		await Bills.updateAsync(billId, { $set: { items: updatedItems, updatedAt: new Date() } });
	}
	, async 'bills.syncUserName'(userId: string, newName: string) {
		check(userId, String); check(newName, String);
		// Update all bills containing this user id
		const cursor = Bills.find({ 'users.id': userId });
		const bills = await cursor.fetchAsync();
		for (const bill of bills) {
			const newUsers = bill.users.map((u: any) => u.id === userId ? { ...u, name: newName } : u);
			await Bills.updateAsync(bill._id, { $set: { users: newUsers, updatedAt: new Date() } });
		}
		return true;
	},
});

// OCR text parser: extract items and prices from receipt text with intelligent filtering
Meteor.methods({
	async 'ocr.extract'(billId: string, text: string) {
		check(billId, String); check(text, String);
		console.log('ocr.extract called with billId:', billId);
		console.log('ocr.extract text length:', text.length);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) { throw new Meteor.Error('not-found', 'Bill not found'); }
		const storeName = detectStoreName(text);
		console.log('Detected store name:', storeName);
		const { items, receiptTotal, taxAmount, totalAmount } = parseReceiptText(text, existing.users.map((u: any) => u.id));
		console.log('parseReceiptText returned items count:', items.length);
		if (!items.length) { return 0; }
		await persistParsedReceipt(billId, items, receiptTotal, taxAmount, totalAmount, storeName);
		return items.length;
	},
});

// --- OCR Parsing Helpers (modularized) ---
function detectStoreName(text: string): string {
	const upperText = text.toUpperCase();
	
	// Check for common store patterns (prioritize specific matches first)
	const storePatterns = [
		{ pattern: /COSTCO\s*WHOLESALE/i, name: 'Costco' },
		{ pattern: /WAL[\*\s]?MART/i, name: 'Walmart' },
		{ pattern: /TARGET/i, name: 'Target' },
		{ pattern: /KROGER/i, name: 'Kroger' },
		{ pattern: /WHOLE\s*FOODS/i, name: 'Whole Foods' },
		{ pattern: /TRADER\s*JOE/i, name: 'Trader Joe\'s' },
		{ pattern: /ALDI/i, name: 'Aldi' },
		{ pattern: /FRESH\s*THYME/i, name: 'Fresh Thyme' },
		{ pattern: /HOBBY\s*LOBBY/i, name: 'Hobby Lobby' },
		{ pattern: /HOME\s*DEPOT/i, name: 'Home Depot' },
		{ pattern: /LOWE'?S/i, name: 'Lowe\'s' },
		{ pattern: /CVS/i, name: 'CVS' },
		{ pattern: /WALGREENS/i, name: 'Walgreens' },
		{ pattern: /DOLLAR\s*GENERAL/i, name: 'Dollar General' },
		{ pattern: /DOLLAR\s*TREE/i, name: 'Dollar Tree' },
		{ pattern: /SAFEWAY/i, name: 'Safeway' },
		{ pattern: /PUBLIX/i, name: 'Publix' },
		{ pattern: /MEIJER/i, name: 'Meijer' },
		{ pattern: /HALAL\s*MARKET/i, name: 'Halal Market' },
	];

	for (const { pattern, name } of storePatterns) {
		if (pattern.test(upperText)) {
			return name;
		}
	}

	return 'Receipt'; // Default name if no store detected
}

function parseReceiptText(text: string, userIds: string[]) {
	console.log('parseReceiptText called, userIds:', userIds.length);
	const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
	console.log('parseReceiptText lines:', lines.length);
	const items: Item[] = [];
	let receiptTotal: number | null = null;
	let taxAmount = 0;
	let totalAmount: number | null = null;

	// First pass: Extract subtotal, tax, and total - more aggressive pattern matching
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Match SUBTOTAL with very loose patterns to handle OCR errors
		// Handles: SUB TOTAL, SUBTOTAL, Sub Total, se dil (garbled), etc.
		if (!receiptTotal) {
			const subtotalMatch = line.match(/(?:SUB|se|Sub|TOTA?L?)[\s\w]*?[:\s]+.*?[$§]?(\d+[.,]\d{2})/i);
			if (subtotalMatch && line.match(/sub|total|se.*?dil/i)) {
				receiptTotal = parseFloat(subtotalMatch[1].replace(',', '.'));
				console.log('Found subtotal:', receiptTotal, 'from line:', line);
			}
		}
		
		// Match TAX with various formats
		// Handles: TAX, TAXES, Taxes:, etc.
		const taxMatch = line.match(/TAX(?:ES)?[:\s]+.*?[$§]?(\d+[.,]\d{2})/i);
		if (taxMatch) {
			taxAmount += parseFloat(taxMatch[1].replace(',', '.'));
			console.log('Found tax:', taxMatch[1], 'from line:', line);
		}
		
		// Match TOTAL (but not SUBTOTAL)
		// Handles: TOTAL, Total, TOTA, etc.
		if (!totalAmount) {
			const totalMatch = line.match(/^(?!.*SUB)(?!.*se).*?(?:TOTA?L?|Total)[:\s]+.*?[$§]?(\d+[.,]\d{2})/i);
			if (totalMatch && !line.match(/sub|se.*?dil/i)) {
				totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
				console.log('Found total:', totalAmount, 'from line:', line);
			}
		}
		
		// Also look for patterns like "Debit $4.47" or "Change Due $0.00"
		if (!totalAmount && line.match(/debit|paid|amount|cash/i)) {
			const amountMatch = line.match(/[$§]?(\d+[.,]\d{2})/);
			if (amountMatch) {
				const amount = parseFloat(amountMatch[1].replace(',', '.'));
				if (amount > 0) {
					totalAmount = amount;
					console.log('Found total from payment line:', totalAmount, 'from line:', line);
				}
			}
		}
	}

	// If we didn't find subtotal/total, calculate from items after extraction
	const shouldCalculateTotals = !receiptTotal && !totalAmount;

	// Second pass: Extract items - use flexible pattern matching
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		console.log(`Line ${i}: "${line}"`);
		
		// Skip header/footer lines
		if (skipLine(line)) {
			console.log('  -> Skipped (header/footer)');
			continue;
		}
		
		// Stop at summary section
		if (line.match(/^(SUB\s*TOTA?L?|TAX(?:ES)?|TOTA?L|BALANCE|CHANGE|VISA|CREDIT|DEBIT|CASH|CARD|APPROVED|THANK|se.*?dil)/i)) {
			console.log('  -> Stopped at summary section');
			break;
		}

		// Try all extraction patterns
		const extracted = tryExtractItem(line, lines, i, userIds);
		if (extracted) {
			items.push(extracted);
			console.log('  -> Extracted:', extracted.name, extracted.price);
		}
	}

	// Calculate totals from items if not found in receipt
	if (shouldCalculateTotals && items.length > 0) {
		receiptTotal = parseFloat(items.reduce((sum, item) => sum + item.price, 0).toFixed(2));
		totalAmount = receiptTotal + taxAmount;
		console.log('Calculated totals from items - subtotal:', receiptTotal, 'total:', totalAmount);
	}
	
	console.log('parseReceiptText finished, total items found:', items.length);
	return { items, receiptTotal, taxAmount, totalAmount };
}

function skipLine(line: string) {
	return !!(
		line.match(/^(ST#|OP#|TE#|TR#|TC#|EAN|UPC|STORE|CASHIER|CUSTOMER|REG|INVOICE|RRN|SALE|SELF-CHECKOUT|CV Member|Seq|App#|Tran ID|PID|AID|TVR|TSI)/i) ||
		line.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || // dates
		line.match(/^\d{2}:\d{2}/) || // times
		line.match(/^[\d\s:]+$/) || // only digits and spaces
		line.match(/^[\|\-\*=_]+$/) || // separators
		line.match(/^[A-Z]{1,3}:\s*$/) || // single letters with colon
		line.match(/^\d{10,}$/) || // long number strings (barcodes, IDs)
		line.match(/^(DISCOVER|AID|TVR|TSI|APPROVED|Entry Method|FTFM|Resp:|AMOUNT|CHANGE|Visa)/i) || // payment info
		line.match(/^[XE]\s*$/) || // Single letter lines
		line.length < 3
	);
}

function tryExtractItem(line: string, lines: string[], index: number, userIds: string[]): Item | null {
	// Universal price extraction - handles multiple formats:
	// Format 1: NAME 4.99 N F  (Freshthyme)
	// Format 2: NAME $1.48 N   (Fort Wayne Halal)
	// Format 3: NAME     7.84  (Walmart simple)
	// Format 4: NAME @ price/unit  final_price (Walmart weight)
	// Format 5: 0 NAME  4.99 N F (with leading zero/count)
	// Format 6: NAME  1  $1.48 N (with quantity)
	// Format 7: 1892398 SMOOTHIES  16.99 (Costco - code + name + price)
	// Format 8: 2 @ 3.99           5.89 (quantity @ unit price = total)
	
	// Extract all numbers that could be prices from the line
	const pricePatterns = [
		// Pattern 1: Dollar sign prices with space or decimal: $1 48, $0.33, §2
		/[$§](\d+)[.\s](\d{2})/g,
		// Pattern 2: Simple decimal prices: 4.99, 50.35, 151.12
		/\b(\d{1,4})\.(\d{2})\b/g,
		// Pattern 3: Prices at end with letter flags: 4.99 N F
		/(\d{1,4})\.(\d{2})\s+[A-Z]\s*[A-Z]?$/g,
	];

	let foundPrice: number | null = null;
	let priceMatch: RegExpMatchArray | null = null;
	let priceIndex = 0;

	// Try each pattern and find the LAST (rightmost) price on the line
	// This handles lines like "2 @ 3.99    5.89" where 5.89 is the actual price
	for (const pattern of pricePatterns) {
		const matches = Array.from(line.matchAll(pattern));
		for (const match of matches) {
			let price: number;
			if (match[0].includes('$') || match[0].includes('§')) {
				// Dollar format
				price = parseInt(match[1]) + parseInt(match[2]) / 100;
			} else {
				// Decimal format
				price = parseFloat(match[1] + '.' + match[2]);
			}
			
			// Validate price range
			if (price > 0.10 && price < 2000) {
				const matchIndex = match.index || 0;
				// Prefer rightmost price
				if (!foundPrice || matchIndex > priceIndex) {
					foundPrice = price;
					priceMatch = match;
					priceIndex = matchIndex;
				}
			}
		}
	}

	if (!foundPrice || !priceMatch) {
		return null;
	}

	// Extract item name (everything before the price)
	const pricePosition = priceIndex;
	let name = line.substring(0, pricePosition).trim();
	
	// Clean up the name
	name = name
		.replace(/^E\s+/, '') // Remove leading 'E' (Costco item marker)
		.replace(/^[0-9\/\s]+/, '') // Remove leading numbers/codes/quantity
		.replace(/\s+@.*$/, '') // Remove @ price per unit
		.replace(/\s{2,}/g, ' ') // Normalize spaces
		.replace(/^[A-Z]$/, '') // Remove single letter
		.trim();

	// Validate name
	if (name.length < 3) {
		// Try to get name from previous line (multi-line items)
		if (index > 0) {
			const prevLine = lines[index - 1];
			if (prevLine && prevLine.length >= 3 && !prevLine.match(/\d+\.\d{2}/)) {
				name = prevLine.trim();
			}
		}
	}

	// Final name validation
	if (name.length < 3 || name.length > 60) {
		return null;
	}

	// Additional filtering: skip if name looks like a header or total line
	if (name.match(/^(PRODUCT|QTY|AMT|ITEM|PRICE|RODUCT|DAIRY|FROZEN|POULTRY|PRODUCE|SEAFOOD|SUBTOTAL|TAX|TOTAL)$/i)) {
		return null;
	}

	return {
		id: `ocr${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		name: cleanName(name),
		price: foundPrice,
		userIds,
		splitType: 'equal'
	};
}

function pushItem(items: Item[], name: string, price: number, userIds: string[]) {
	console.log('pushItem called:', { name, price, valid: (price > 0 && price < 10000) });
	if (price > 0 && price < 10000) {
		items.push({ id: `ocr${Date.now()}_${items.length}`, name, price, userIds, splitType: 'equal' });
		console.log('Item pushed successfully');
	}
}

function tryMultiLineItem(lines: string[], i: number, items: Item[], userIds: string[]) {
	const line = lines[i];
	const isItemName = line.match(/^[A-Z][A-Z\s\d&\-']{2,}$/);
	if (!isItemName) { return false; }
	const next1 = lines[i + 1] || '';
	const next2 = lines[i + 2] || '';
	const next3 = lines[i + 3] || '';
	const barcodeMatch = next1.match(/^(\d{12,})\s*([A-Z])?$/);
	const priceMatch = next2.match(/^(\d+\.?\d{1,2})$/);
	if (barcodeMatch && priceMatch) {
		pushItem(items, cleanName(line), parseFloat(priceMatch[1]), userIds);
		return true;
	}
	const priceMatch2 = next3.match(/^(\d+\.?\d{1,2})$/);
	if (barcodeMatch && priceMatch2) {
		pushItem(items, cleanName(line), parseFloat(priceMatch2[1]), userIds);
		return true;
	}
	const direct = next1.match(/^(\d+\.?\d{1,2})$/);
	if (direct && !barcodeMatch) {
		pushItem(items, cleanName(line), parseFloat(direct[1]), userIds);
		return true;
	}
	return false;
}

function tryPatternSingleLine(line: string, items: Item[], userIds: string[]) {
	let match = line.match(/^([A-Z][A-Z\s\d&]{2,40}?)\s+(\d{12,})\s+[A-Z]\s+(\d+\.?\d{1,2})$/);
	if (match) { pushItem(items, cleanName(match[1]), parseFloat(match[3]), userIds); return true; }
	match = line.match(/^([A-Z][A-Z\s\d&]{2,40}?)\s+(\d{12,})\s+(\d+\.?\d{1,2})$/);
	if (match) { pushItem(items, cleanName(match[1]), parseFloat(match[3]), userIds); return true; }
	return false;
}

function tryWeightLine(line: string, lines: string[], i: number, items: Item[], userIds: string[]) {
	const match = line.match(/^(\d+\.\d+\s+l?1?b\s+@.+?)\s+(\d+\.?\d{1,2})$/i);
	if (!match) { return false; }
	const price = parseFloat(match[2]);
	const prev = i > 0 ? lines[i - 1] : '';
	const prevMatch = prev.match(/^([A-Z][A-Z\s&]+)/);
	const name = prevMatch ? prevMatch[1].trim() : match[1].trim();
	pushItem(items, name, price, userIds);
	return true;
}

function trySimpleFormat(line: string, items: Item[], userIds: string[]) {
	const match = line.match(/^([A-Z][A-Z\s&\-']{2,40}?)\s{2,}(\d+\.?\d{1,2})$/);
	if (!match) { return false; }
	pushItem(items, match[1].trim(), parseFloat(match[2]), userIds);
	return true;
}

function tryPriceAtEnd(line: string, items: Item[], userIds: string[]) {
	const match = line.match(/^([A-Z][A-Z\s&\-']{2,40}?)\s+(\d+\.?\d{1,2})$/);
	if (!match) { return false; }
	const name = match[1].trim();
	const price = parseFloat(match[2]);
	const hasValidName = name.length >= 4 && name.split(' ').length >= 2;
	const hasValidPrice = price >= 0.10 && price < 10000;
	if (hasValidName && hasValidPrice) { pushItem(items, name, price, userIds); }
	return true;
}

function tryDollarSignPrice(line: string, items: Item[], userIds: string[]) {
	// Match lines like "RUITS & VEGE $1 48 N" or "LINTRO ! $0.33 N" or "AMOSA 2 §2 N"
	// Handle both $X.XX and $X XX (space instead of decimal) and §X variants
	const match = line.match(/^([A-Z][A-Z\s&\-'!]{2,40}?)\s+[$§](\d+)[.\s](\d{2})\s+[A-Z]?$/i);
	if (match) {
		const name = match[1].trim();
		const dollars = parseInt(match[2]);
		const cents = parseInt(match[3]);
		const price = dollars + (cents / 100);
		console.log('tryDollarSignPrice matched:', { name, price });
		pushItem(items, name, price, userIds);
		return true;
	}
	// Also try simpler pattern: "NAME $X.XX" or "NAME $X XX"
	const match2 = line.match(/^([A-Z][A-Z\s&\-'!]{2,40}?)\s+[$§](\d+)[.\s](\d{2})$/i);
	if (match2) {
		const name = match2[1].trim();
		const dollars = parseInt(match2[2]);
		const cents = parseInt(match2[3]);
		const price = dollars + (cents / 100);
		console.log('tryDollarSignPrice matched (pattern 2):', { name, price });
		pushItem(items, name, price, userIds);
		return true;
	}
	return false;
}

function cleanName(raw: string) {
	let name = raw.trim();
	// Remove common OCR artifacts and formatting
	name = name.replace(/\s+\d{1,3}CT$/i, ''); // Remove "CT" count suffix
	name = name.replace(/\s+[A-Z]\d+$/i, ''); // Remove code suffixes
	name = name.replace(/\s+[|/].*$/, ''); // Remove | or / and everything after
	name = name.replace(/\s+[$§]\s*$/, ''); // Remove trailing $ or §
	name = name.replace(/\s{2,}/g, ' '); // Normalize spaces
	name = name.replace(/\s+[A-Z]$/, ''); // Remove single letter at end (like "N")
	
	// Fix common OCR errors in item names
	name = name.replace(/^ruts/i, 'Fruits'); // "ruts" -> "Fruits"
	name = name.replace(/^1intro/i, 'Intro'); // "1intro" -> "Intro"
	name = name.replace(/whosa/i, 'Samosa'); // "whosa" -> "Samosa"
	
	return name.trim();
}

async function persistParsedReceipt(billId: string, items: Item[], receiptTotal: number | null, taxAmount: number, totalAmount: number | null, storeName?: string) {
	const calculatedTotal = Number(items.reduce((s, it) => s + it.price, 0).toFixed(2));
	const totalMismatch = receiptTotal && Math.abs(calculatedTotal - receiptTotal) > 0.05;
	const calculatedWithTax = Number((calculatedTotal + taxAmount).toFixed(2));
	const totalWithTaxMismatch = totalAmount && Math.abs(calculatedWithTax - totalAmount) > 0.05;
	await Bills.updateAsync(billId, {
		$push: { items: { $each: items } },
		$set: {
			updatedAt: new Date(),
			storeName: storeName || 'Receipt',
			receiptTotal: receiptTotal ? Number(receiptTotal.toFixed(2)) : null,
			calculatedTotal: Number(calculatedTotal.toFixed(2)),
			totalMismatch,
			taxAmount: Number(taxAmount.toFixed(2)),
			totalAmount: totalAmount ? Number(totalAmount.toFixed(2)) : null,
			calculatedWithTax: Number(calculatedWithTax.toFixed(2)),
			totalWithTaxMismatch,
		},
	});
}

// OCR file stub: accept file metadata and generate sample items based on file characteristics
Meteor.methods({
	async 'ocr.extractFromFile'(billId: string, fileInfo: { name: string; size: number; type?: string }) {
		check(billId, String); check(fileInfo, Object);
		const existing = await Bills.findOneAsync(billId);
		if (!existing) {
			throw new Meteor.Error('not-found', 'Bill not found');
		}

		// Generate sample items based on file size (simulating OCR extraction)
		// In production, this would use actual OCR to extract text and parse items
		const sampleItems = [
			{ name: 'Main Course', price: 18.99 },
			{ name: 'Side Dish', price: 6.50 },
			{ name: 'Beverage', price: 3.99 },
			{ name: 'Dessert', price: 7.50 },
			{ name: 'Appetizer', price: 8.99 },
		];

		// Generate 2-4 items based on file size
		const numItems = Math.min(Math.max(2, Math.floor(fileInfo.size / 50000)), 4);
		const items: Item[] = [];

		for (let i = 0; i < numItems; i++) {
			const sample = sampleItems[i % sampleItems.length];
			// Add some randomness to prices
			const randomPrice = (sample.price + (Math.random() * 5 - 2.5)).toFixed(2);
			items.push({
				id: `ocr${Date.now()}_${i}`,
				name: sample.name,
				price: parseFloat(randomPrice),
				userIds: existing.users.map((u: any) => u.id),
				splitType: 'equal',
			});
		}

		await Bills.updateAsync(billId, { $push: { items: { $each: items } }, $set: { updatedAt: new Date() } });
		return { itemCount: items.length, totalAmount: items.reduce((sum, item) => sum + item.price, 0).toFixed(2) };
	},
});

// Clear all data method
Meteor.methods({
	async 'clearAllData'() {
		// Only allow in development or with proper authentication
		// In production, you might want to add user authentication check here

		// Import GlobalUsers to clear it too
		const { GlobalUsers } = await import('./users');

		// Remove all bills
		await Bills.removeAsync({});

		// Remove all global users
		await GlobalUsers.removeAsync({});

		console.log('All data cleared from database (bills and users)');
		return { success: true };
	},
});
