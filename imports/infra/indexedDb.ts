import { openDB } from 'idb';
import type { BillDoc } from '../api/models';
import type { GroceryListDoc } from '../api/groceries';

const DB_NAME = 'splitly_local';
const BILLS_STORE = 'bills';
const GROCERY_STORE = 'groceryList';

async function getDB() {
	return openDB(DB_NAME, 2, {
		upgrade(db, oldVersion, newVersion, transaction) {
			// Create bills store if it doesn't exist (from version 0 or 1)
			if (!db.objectStoreNames.contains(BILLS_STORE)) {
				db.createObjectStore(BILLS_STORE, { keyPath: '_id' });
			}
			// Create grocery list store if it doesn't exist (new in version 2)
			if (!db.objectStoreNames.contains(GROCERY_STORE)) {
				db.createObjectStore(GROCERY_STORE, { keyPath: '_id' });
			}
		},
	});
}

export async function cacheBills(bills: BillDoc[]) {
	const db = await getDB();
	const tx = db.transaction(BILLS_STORE, 'readwrite');
	const store = tx.store;
	await Promise.all(bills.map(b => store.put(b)));
	await tx.done;
}

export async function loadCachedBills(): Promise<BillDoc[]> {
	const db = await getDB();
	return await db.getAll(BILLS_STORE);
}

export async function cacheGroceryList(groceryList: GroceryListDoc) {
	const db = await getDB();
	const tx = db.transaction(GROCERY_STORE, 'readwrite');
	await tx.store.put(groceryList);
	await tx.done;
}

export async function loadCachedGroceryList(): Promise<GroceryListDoc | undefined> {
	const db = await getDB();
	const allLists = await db.getAll(GROCERY_STORE);
	return allLists[0]; // User only has one grocery list
}
