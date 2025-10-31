import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

/**
 * Global user profile interface
 * Represents users that can be reused across multiple bills
 */
export interface GlobalUser {
	_id?: string;
	name: string;
	email?: string;
	createdAt: Date;
	updatedAt?: Date;
}

/**
 * MongoDB collection for global users
 * Stores user profiles that persist across bills
 */
export const GlobalUsers = new (Mongo as any).Collection('globalUsers');

/**
 * Global user management methods
 */
Meteor.methods({
	/**
	 * Insert a new global user
	 * @param user - User data (name and optional email)
	 * @returns {Promise<string>} - ID of inserted user
	 */
	async 'globalUsers.insert'(user: Omit<GlobalUser, '_id' | 'createdAt' | 'updatedAt'>) {
		check(user, Object);

		// Validate user name
		if (!user.name?.trim()) {
			throw new Meteor.Error('invalid-name', 'Name is required');
		}

		// Check for duplicate name (case-insensitive)
		const normalizedName = user.name.trim().toLowerCase();
		const existing = await GlobalUsers.findOneAsync({
			name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
		});
		if (existing) {
			throw new Meteor.Error('duplicate-name', 'This name already exists');
		}

		// Create sanitized user document
		const doc: GlobalUser = {
			name: user.name.trim(),
			email: user.email?.trim(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		return await GlobalUsers.insertAsync(doc);
	},

	/**
	 * Update an existing global user
	 * @param userId - ID of the user to update
	 * @param updates - Partial user data to update
	 */
	async 'globalUsers.update'(userId: string, updates: Partial<GlobalUser>) {
		check(userId, String);
		check(updates, Object);

		const existing = await GlobalUsers.findOneAsync(userId);
		if (!existing) {
			throw new Meteor.Error('not-found', 'User not found');
		}

		// Check for duplicate name if name is being updated (case-insensitive)
		if (updates.name && updates.name !== existing.name) {
			const normalizedName = updates.name.trim().toLowerCase();
			const duplicate = await GlobalUsers.findOneAsync({
				name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
				_id: { $ne: userId },
			});
			if (duplicate) {
				throw new Meteor.Error('duplicate-name', 'This name already exists');
			}
		}

		await GlobalUsers.updateAsync(userId, {
			$set: {
				...(updates.name && { name: updates.name.trim() }),
				...(updates.email !== undefined && { email: updates.email?.trim() }),
				updatedAt: new Date(),
			},
		});
	},

	/**
	 * Remove a global user
	 * @param userId - ID of the user to remove
	 */
	async 'globalUsers.remove'(userId: string) {
		check(userId, String);

		const existing = await GlobalUsers.findOneAsync(userId);
		if (!existing) {
			throw new Meteor.Error('not-found', 'User not found');
		}

		await GlobalUsers.removeAsync(userId);
	},
});
