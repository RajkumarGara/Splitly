import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

/**
 * Grocery item interface
 */
export interface GroceryItem {
	id: string;
	name: string;
	checked: boolean;
	order: number;
}

/**
 * Grocery store interface
 */
export interface GroceryStore {
	id: string;
	name: string;
	items: GroceryItem[];
	order: number;
}

/**
 * Grocery list document stored in database
 */
export interface GroceryListDoc {
	_id?: string;
	userId: string;
	stores: GroceryStore[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * MongoDB collection for grocery lists
 */
export const GroceryLists = new (Mongo as any).Collection('groceryLists');

/**
 * Get or create grocery list for user
 */
async function getOrCreateList(userId: string): Promise<string> {
	const list = await GroceryLists.findOneAsync({ userId });

	if (!list) {
		return await GroceryLists.insertAsync({
			userId,
			stores: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

	return list._id;
}

Meteor.methods({
	/**
	 * Get user's grocery list
	 */
	async 'groceries.getList'() {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		return await GroceryLists.findOneAsync(listId);
	},

	/**
	 * Add a new store
	 */
	async 'groceries.addStore'(storeName: string) {
		check(storeName, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		if (!storeName.trim()) {
			throw new Meteor.Error('invalid-name', 'Store name is required');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const newStore: GroceryStore = {
			id: `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			name: storeName.trim(),
			items: [],
			order: list.stores.length,
		};

		await GroceryLists.updateAsync(listId, {
			$push: { stores: newStore },
			$set: { updatedAt: new Date() },
		});

		return newStore.id;
	},

	/**
	 * Add item to store
	 */
	async 'groceries.addItem'(storeId: string, itemName: string) {
		check(storeId, String);
		check(itemName, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		if (!itemName.trim()) {
			throw new Meteor.Error('invalid-name', 'Item name is required');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const store = list.stores.find((s: GroceryStore) => s.id === storeId);
		if (!store) {
			throw new Meteor.Error('not-found', 'Store not found');
		}

		const newItem: GroceryItem = {
			id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			name: itemName.trim(),
			checked: false,
			order: store.items.length,
		};

		const updatedStores = list.stores.map((s: GroceryStore) =>
			s.id === storeId ? { ...s, items: [...s.items, newItem] } : s,
		);

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});

		return newItem.id;
	},

	/**
	 * Toggle item checked state
	 */
	async 'groceries.toggleItem'(storeId: string, itemId: string) {
		check(storeId, String);
		check(itemId, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) => {
			if (s.id === storeId) {
				return {
					...s,
					items: s.items.map((item: GroceryItem) =>
						item.id === itemId ? { ...item, checked: !item.checked } : item,
					),
				};
			}
			return s;
		});

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Remove item
	 */
	async 'groceries.removeItem'(storeId: string, itemId: string) {
		check(storeId, String);
		check(itemId, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) =>
			s.id === storeId
				? { ...s, items: s.items.filter((item: GroceryItem) => item.id !== itemId) }
				: s,
		);

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Remove store
	 */
	async 'groceries.removeStore'(storeId: string) {
		check(storeId, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.filter((s: GroceryStore) => s.id !== storeId);

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Update store order
	 */
	async 'groceries.updateStoreOrder'(storeOrders: Array<{ id: string; order: number }>) {
		check(storeOrders, Array);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) => {
			const newOrder = storeOrders.find(so => so.id === s.id);
			return newOrder ? { ...s, order: newOrder.order } : s;
		}).sort((a: GroceryStore, b: GroceryStore) => a.order - b.order);

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Update item order within or across stores
	 */
	async 'groceries.updateItemOrder'(storeId: string, itemOrders: Array<{ id: string; order: number }>) {
		check(storeId, String);
		check(itemOrders, Array);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) => {
			if (s.id === storeId) {
				const updatedItems = s.items.map((item: GroceryItem) => {
					const newOrder = itemOrders.find(io => io.id === item.id);
					return newOrder ? { ...item, order: newOrder.order } : item;
				}).sort((a, b) => a.order - b.order);
				return { ...s, items: updatedItems };
			}
			return s;
		});

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Move item to different store
	 */
	async 'groceries.moveItem'(fromStoreId: string, toStoreId: string, itemId: string) {
		check(fromStoreId, String);
		check(toStoreId, String);
		check(itemId, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const fromStore = list.stores.find((s: GroceryStore) => s.id === fromStoreId);
		const toStore = list.stores.find((s: GroceryStore) => s.id === toStoreId);

		if (!fromStore || !toStore) {
			throw new Meteor.Error('not-found', 'Store not found');
		}

		const item = fromStore.items.find((i: GroceryItem) => i.id === itemId);
		if (!item) {
			throw new Meteor.Error('not-found', 'Item not found');
		}

		const updatedStores = list.stores.map((s: GroceryStore) => {
			if (s.id === fromStoreId) {
				return { ...s, items: s.items.filter((i: GroceryItem) => i.id !== itemId) };
			}
			if (s.id === toStoreId) {
				return { ...s, items: [...s.items, { ...item, order: s.items.length }] };
			}
			return s;
		});

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Clear all checked items
	 */
	async 'groceries.clearChecked'() {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) => ({
			...s,
			items: s.items.filter((item: GroceryItem) => !item.checked),
		}));

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Rename store
	 */
	async 'groceries.renameStore'(storeId: string, newName: string) {
		check(storeId, String);
		check(newName, String);

		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		if (!newName.trim()) {
			throw new Meteor.Error('invalid-name', 'Store name is required');
		}

		const listId = await getOrCreateList(this.userId);
		const list = await GroceryLists.findOneAsync(listId);

		const updatedStores = list.stores.map((s: GroceryStore) =>
			s.id === storeId ? { ...s, name: newName.trim() } : s,
		);

		await GroceryLists.updateAsync(listId, {
			$set: {
				stores: updatedStores,
				updatedAt: new Date(),
			},
		});
	},
});

/**
 * Publications
 */
if (Meteor.isServer) {
	Meteor.publish('groceryList', function(this: Meteor.SubscriptionHandle) {
		if (!this.userId) {
			return this.ready();
		}
		return GroceryLists.find({ userId: this.userId });
	});
}
