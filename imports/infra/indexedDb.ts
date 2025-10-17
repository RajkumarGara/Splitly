import { openDB } from 'idb';
import type { BillDoc } from '../api/models';

const DB_NAME = 'splitly_local';
const STORE = 'bills';

async function getDB() {
	return openDB(DB_NAME, 1, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: '_id' });
			}
		},
	});
}

export async function cacheBills(bills: BillDoc[]) {
	const db = await getDB();
	const tx = db.transaction(STORE, 'readwrite');
	const store = tx.store;
	await Promise.all(bills.map(b => store.put(b)));
	await tx.done;
}

export async function loadCachedBills(): Promise<BillDoc[]> {
	const db = await getDB();
	return await db.getAll(STORE);
}
