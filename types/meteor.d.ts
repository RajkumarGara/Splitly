// Ambient Meteor + Project types
// Minimal augmentation to reduce implicit any usage in JS/TS parts
// These declarations assist mixed JS/TS without forcing full type coverage.

// Declare Meteor namespace
declare module 'meteor/meteor' {
	export namespace Meteor {
		function callAsync(method: string, ...args: any[]): Promise<any>;
		function call(method: string, ...args: any[]): void;
		function startup(func: () => void): void;
		function methods(methods: Record<string, Function>): void;
		class Error {
			constructor(error: string, reason?: string, details?: any);
			error: string;
			reason?: string;
			details?: any;
		}
		function defer(func: () => void): void;
		function setTimeout(func: () => void, delay: number): number;
	}
	export namespace Subscription {
		function ready(): boolean;
	}
}

declare module 'meteor/mongo' {
	export namespace Mongo {
		class Collection<T = any> {
			constructor(name: string, options?: any);
			find(selector?: any, options?: any): any;
			findOne(idOrSelector: any, options?: any): Promise<T | undefined>;
			findOneAsync(idOrSelector: any, options?: any): Promise<T | undefined>;
			insert(doc: T): string;
			insertAsync(doc: T): Promise<string>;
			update(idOrSelector: any, modifier: any, options?: any): number;
			updateAsync(idOrSelector: any, modifier: any, options?: any): Promise<number>;
			remove(idOrSelector: any): number;
			removeAsync(idOrSelector: any): Promise<number>;
		}
	}
}

declare module 'meteor/check' {
	export function check(value: any, pattern: any): void;
}

// Declare minimal Mongo namespace to satisfy Collection generic reference when types not available.
declare namespace Mongo {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	class Collection<T = any> {
		find(selector?: any, options?: any): any;
		findOne(idOrSelector: any, options?: any): T | undefined;
		insert(doc: T): string;
		update(idOrSelector: any, modifier: any, options?: any): number;
		remove(idOrSelector: any): number;
		forEach?(): void; // placeholder
	}
}

interface GlobalUserDoc {
	_id?: string;
	name: string;
	email?: string;
	createdAt: Date;
	updatedAt?: Date;
}

interface BillUserProfile { id: string; name: string; }
interface BillItemSharePercent { userId: string; type: 'percent'; value: number; }
interface BillItemShareFixed { userId: string; type: 'fixed'; value: number; }
interface BillItem {
	id: string;
	name: string;
	price: number;
	userIds: string[];
	splitType?: 'equal' | 'percent' | 'fixed';
	shares?: (BillItemSharePercent | BillItemShareFixed)[];
}
interface BillDoc {
	_id?: string;
	createdAt: Date;
	updatedAt?: Date;
	users: BillUserProfile[];
	items: BillItem[];
	receiptTotal?: number | null;
	calculatedTotal?: number | null;
	calculatedWithTax?: number | null;
	taxAmount?: number | null;
	totalAmount?: number | null;
	currency?: string;
}

declare const Bills: Mongo.Collection<BillDoc>;
declare const GlobalUsers: Mongo.Collection<GlobalUserDoc>;
