import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import type { BillDoc, UserProfile, Item } from './models';
import { extractReceiptWithGemini, isGeminiAvailable } from './geminiOcr';

/**
 * MongoDB collection for bills
 * Stores receipt information, items, and user splits
 */
export const Bills = new (Mongo as any).Collection('bills');

/**
 * Verify that the current user owns the specified bill
 * @param billId - ID of the bill to check
 * @param userId - ID of the current user
 * @throws Meteor.Error if not authorized or bill not found
 */
async function verifyBillOwnership(billId: string, userId: string | null) {
	if (!userId) {
		throw new Meteor.Error('not-authorized', 'You must be logged in');
	}

	const bill = await Bills.findOneAsync(billId);
	if (!bill) {
		throw new Meteor.Error('not-found', 'Bill not found');
	}

	if ((bill as any).userId && (bill as any).userId !== userId) {
		throw new Meteor.Error('not-authorized', 'You can only modify your own bills');
	}

	return bill;
}

Meteor.methods({
	/**
	 * Insert a new bill into the database
	 * @param bill - Bill document to insert
	 * @returns {Promise<string>} - ID of the inserted bill
	 */
	async 'bills.insert'(bill: BillDoc) {
		check(bill, Object);

		// Require authentication
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in to create bills');
		}

		// Sanitize and validate input
		if (!Array.isArray(bill.users)) { bill.users = []; }
		if (!Array.isArray(bill.items)) { bill.items = []; }
		bill.createdAt = bill.createdAt || new Date();
		bill.updatedAt = bill.createdAt;

		// Validate store name if provided
		if (bill.storeName && typeof bill.storeName !== 'string') {
			throw new Meteor.Error('invalid-storeName', 'Store name must be a string');
		}

		// Add userId to bill for ownership
		const billWithOwner = {
			...bill,
			userId: this.userId,
		};

		return await Bills.insertAsync(billWithOwner);
	},

	/**
	 * Add a user to an existing bill
	 * @param billId - ID of the bill
	 * @param user - User profile to add
	 */
	async 'bills.addUser'(billId: string, user: UserProfile) {
		check(billId, String);
		check(user, Object);

		// Require authentication
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		// Validate user data
		if (!user.name?.trim()) {
			throw new Meteor.Error('invalid-user', 'User name required');
		}

		const existing = await Bills.findOneAsync(billId);
		if (!existing) {
			throw new Meteor.Error('not-found', 'Bill not found');
		}

		// Verify ownership
		if ((existing as any).userId !== this.userId) {
			throw new Meteor.Error('not-authorized', 'You can only modify your own bills');
		}

		// Check for duplicate user name (case-insensitive)
		const normalizedName = user.name.trim().toLowerCase();
		if (existing.users.some((u: UserProfile) => u.name.trim().toLowerCase() === normalizedName)) {
			throw new Meteor.Error('duplicate-user', 'User name already exists');
		}

		// Sanitize user name
		const sanitizedUser = {
			...user,
			name: user.name.trim(),
			contact: user.contact?.trim(),
		};

		// Add user to all existing items
		const updatedItems = existing.items.map((item: Item) => ({
			...item,
			userIds: [...item.userIds, sanitizedUser.id],
		}));

		await Bills.updateAsync(billId, {
			$push: { users: sanitizedUser },
			$set: {
				items: updatedItems,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Remove a user from a bill and all associated items
	 * @param billId - ID of the bill
	 * @param userId - ID of the user to remove
	 */
	async 'bills.removeUser'(billId: string, userId: string) {
		check(billId, String);
		check(userId, String);

		const existing = await verifyBillOwnership(billId, this.userId);

		// Remove user from bill and all items
		await Bills.updateAsync(billId, {
			$set: {
				users: existing.users.filter((u: UserProfile) => u.id !== userId),
				items: existing.items.map((i: Item) => ({
					...i,
					userIds: i.userIds.filter((id: string) => id !== userId),
				})),
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Add an item to a bill
	 * @param billId - ID of the bill
	 * @param item - Item to add
	 */
	async 'bills.addItem'(billId: string, item: Item) {
		check(billId, String);
		check(item, Object);

		// Validate item data
		if (!item.name?.trim()) {
			throw new Meteor.Error('invalid-item', 'Item name is required');
		}
		if (typeof item.price !== 'number' || item.price < 0) {
			throw new Meteor.Error('invalid-price', 'Item price must be a non-negative number');
		}
		if (item.price === 0) {
			throw new Meteor.Error('invalid-price', 'Item price must be greater than zero');
		}

		await verifyBillOwnership(billId, this.userId);

		// Sanitize item name and price
		const sanitizedItem = {
			...item,
			name: item.name.trim().substring(0, 100), // Limit name length
			price: Number(item.price.toFixed(2)),
		};

		await Bills.updateAsync(billId, {
			$push: { items: sanitizedItem },
			$set: { updatedAt: new Date() },
		});
	},

	/**
	 * Remove an item from a bill
	 * @param billId - ID of the bill
	 * @param itemId - ID of the item to remove
	 */
	async 'bills.removeItem'(billId: string, itemId: string) {
		check(billId, String);
		check(itemId, String);

		const existing = await verifyBillOwnership(billId, this.userId);

		await Bills.updateAsync(billId, {
			$set: {
				items: existing.items.filter((i: Item) => i.id !== itemId),
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Delete a bill
	 * @param billId - ID of the bill to delete
	 */
	async 'bills.remove'(billId: string) {
		check(billId, String);

		await verifyBillOwnership(billId, this.userId);

		await Bills.removeAsync(billId);
	},

	/**
	 * Update all items in a bill
	 * @param billId - ID of the bill
	 * @param items - Array of items to replace existing items
	 */
	async 'bills.updateItems'(billId: string, items: Item[]) {
		check(billId, String);
		check(items, Array);

		await verifyBillOwnership(billId, this.userId);

		// Validate and sanitize all items
		const sanitizedItems = items.map(item => ({
			...item,
			name: item.name?.trim() || '',
			price: Number(item.price?.toFixed(2) || 0),
		}));

		await Bills.updateAsync(billId, {
			$set: {
				items: sanitizedItems,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Update tax amount for a bill
	 * @param billId - ID of the bill
	 * @param taxAmount - New tax amount
	 */
	async 'bills.updateTax'(billId: string, taxAmount: number) {
		check(billId, String);
		check(taxAmount, Number);

		if (taxAmount < 0) {
			throw new Meteor.Error('invalid-tax', 'Tax amount cannot be negative');
		}

		await verifyBillOwnership(billId, this.userId);

		await Bills.updateAsync(billId, {
			$set: {
				taxAmount: Number(taxAmount.toFixed(2)),
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Toggle a user's participation in an item
	 * @param billId - ID of the bill
	 * @param itemId - ID of the item
	 * @param userId - ID of the user to toggle
	 */
	async 'bills.toggleUserOnItem'(billId: string, itemId: string, userId: string) {
		check(billId, String);
		check(itemId, String);
		check(userId, String);

		const existing = await verifyBillOwnership(billId, this.userId);

		const item = existing.items.find((i: Item) => i.id === itemId);
		if (!item) {
			throw new Meteor.Error('not-found', 'Item not found');
		}

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

		await Bills.updateAsync(billId, {
			$set: {
				items: updatedItems,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Sync a user's name across all bills
	 * @param userId - ID of the user
	 * @param newName - New name for the user
	 * @returns {Promise<boolean>} - Success status
	 */
	async 'bills.syncUserName'(userId: string, newName: string) {
		check(userId, String);
		check(newName, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		if (!newName.trim()) {
			throw new Meteor.Error('invalid-name', 'User name cannot be empty');
		}

		// Update all bills owned by current user containing this user id
		const cursor = Bills.find({
			'users.id': userId,
			userId: this.userId, // Only update current user's bills
		});
		const bills = await cursor.fetchAsync();

		for (const bill of bills) {
			const newUsers = bill.users.map((u: UserProfile) =>
				u.id === userId ? { ...u, name: newName.trim() } : u,
			);
			await Bills.updateAsync(bill._id, {
				$set: {
					users: newUsers,
					updatedAt: new Date(),
				},
			});
		}

		return true;
	},
});

/**
 * OCR text extraction methods
 * Extract items, prices, and totals from receipt images using Gemini AI
 */
Meteor.methods({
	/**
	 * Extract items from receipt image using Gemini AI
	 * @param billId - ID of the bill to add items to
	 * @param imageData - Base64 encoded image data
	 * @returns {Promise<number>} - Number of items extracted
	 */
	async 'ocr.extractFromImage'(billId: string, imageData: string) {
		check(billId, String);
		check(imageData, String);

		// This method should only run on the server
		if (Meteor.isClient) {
			return 0; // Client simulation - return 0 items
		}

		const existing = await verifyBillOwnership(billId, this.userId);

		// Use Gemini AI for extraction
		if (!isGeminiAvailable()) {
			throw new Meteor.Error('gemini-unavailable', 'Gemini AI not configured. Please set GOOGLE_GEMINI_API_KEY.');
		}

		const geminiResult = await extractReceiptWithGemini(imageData);

		if (!geminiResult.success) {
			throw new Meteor.Error('extraction-failed', geminiResult.error || 'Failed to extract receipt data');
		}

		if (!geminiResult.items || geminiResult.items.length === 0) {
			return 0;
		}

		const userIds = existing.users.map((u: UserProfile) => u.id);

		// Convert Gemini items to our Item format
		const items: Item[] = geminiResult.items.map((item, idx) => ({
			id: `gemini${Date.now()}_${idx}`,
			name: item.name,
			price: Number(item.price.toFixed(2)),
			userIds,
			splitType: 'equal' as const,
		}));

		const calculatedItemsTotal = items.reduce((sum, item) => sum + item.price, 0);
		const taxAmount = geminiResult.tax || 0;
		const calculatedTotal = calculatedItemsTotal + taxAmount;

		await persistParsedReceipt(
			billId,
			items,
			geminiResult.subtotal || calculatedItemsTotal,
			taxAmount,
			geminiResult.total || calculatedTotal,
			geminiResult.store || 'Receipt',
			geminiResult.date || null,
		);

		return items.length;
	},
});

/**
 * Persist parsed receipt data to the database
 * Calculates totals and mismatches between OCR and calculated values
 * @param billId - ID of the bill to update
 * @param items - Extracted items from receipt
 * @param receiptTotal - Subtotal from receipt
 * @param taxAmount - Tax amount from receipt
 * @param totalAmount - Total amount from receipt
 * @param storeName - Detected store name
 * @param receiptDate - Receipt date string
 */
async function persistParsedReceipt(
	billId: string,
	items: Item[],
	receiptTotal: number | null,
	taxAmount: number,
	totalAmount: number | null,
	storeName?: string,
	receiptDate?: string | null,
) {
	// Calculate totals from extracted items
	const calculatedTotal = Number(items.reduce((s, it) => s + it.price, 0).toFixed(2));

	// Check for mismatches (tolerance of $0.05 for rounding differences)
	const totalMismatch = receiptTotal && Math.abs(calculatedTotal - receiptTotal) > 0.05;
	const calculatedWithTax = Number((calculatedTotal + taxAmount).toFixed(2));
	const totalWithTaxMismatch = totalAmount && Math.abs(calculatedWithTax - totalAmount) > 0.05;

	await Bills.updateAsync(billId, {
		$push: { items: { $each: items } },
		$set: {
			updatedAt: new Date(),
			storeName: storeName || 'Receipt',
			date: receiptDate || undefined,
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

/**
 * Data management methods
 */
Meteor.methods({
	/**
	 * Clear all bills and users from the database
	 * WARNING: This is a destructive operation
	 * Only available in development environment for safety
	 * @returns {Promise<{success: boolean}>}
	 */
	async 'clearAllData'() {
		// Protect production environment - only allow in development
		if (process.env.NODE_ENV === 'production') {
			throw new Meteor.Error('forbidden', 'Data clearing is disabled in production');
		}

		// Import GlobalUsers to clear it too
		const { GlobalUsers } = await import('./users');

		// Remove all bills
		await Bills.removeAsync({});

		// Remove all global users
		await GlobalUsers.removeAsync({});

		return { success: true };
	},
});
