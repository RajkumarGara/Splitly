import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

export interface GlobalUser {
	_id?: string;
	name: string;
	email?: string;
	createdAt: Date;
	updatedAt?: Date;
}

export const GlobalUsers = new (Mongo as any).Collection('globalUsers');

Meteor.methods({
	async 'globalUsers.insert'(user: Omit<GlobalUser, '_id' | 'createdAt' | 'updatedAt'>) {
		check(user, Object);
		if (!user.name?.trim()) { throw new Meteor.Error('invalid-name', 'User name required'); }
		const existing = await GlobalUsers.findOneAsync({ name: user.name.trim() });
		if (existing) { throw new Meteor.Error('duplicate-name', 'User name already exists'); }
		const doc: GlobalUser = {
			name: user.name.trim(),
			email: user.email?.trim(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		return await GlobalUsers.insertAsync(doc);
	},
	async 'globalUsers.update'(userId: string, updates: Partial<GlobalUser>) {
		check(userId, String);
		check(updates, Object);
		const existing = await GlobalUsers.findOneAsync(userId);
		if (!existing) { throw new Meteor.Error('not-found', 'User not found'); }
		if (updates.name && updates.name !== existing.name) {
			const duplicate = await GlobalUsers.findOneAsync({ name: updates.name.trim(), _id: { $ne: userId } });
			if (duplicate) { throw new Meteor.Error('duplicate-name', 'User name already exists'); }
		}
		await GlobalUsers.updateAsync(userId, {
			$set: {
				...(updates.name && { name: updates.name.trim() }),
				...(updates.email !== undefined && { email: updates.email?.trim() }),
				updatedAt: new Date(),
			},
		});
	},
	async 'globalUsers.remove'(userId: string) {
		check(userId, String);
		const existing = await GlobalUsers.findOneAsync(userId);
		if (!existing) { throw new Meteor.Error('not-found', 'User not found'); }
		await GlobalUsers.removeAsync(userId);
	},
});
