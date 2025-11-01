import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { check, Match } from 'meteor/check';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';

/**
 * User profile interface extending Meteor's default user object
 */
export interface UserProfile {
	firstName?: string;
	lastName?: string;
	displayName?: string;
	bio?: string;
	avatar?: string;
}

/**
 * Extended Meteor user type with custom profile
 */
export interface ExtendedUser extends Meteor.User {
	profile?: UserProfile;
}

/**
 * Account configuration and setup
 */
if (Meteor.isServer) {
	// Configure account creation
	Accounts.config({
		sendVerificationEmail: false,
		forbidClientAccountCreation: false,
		loginExpirationInDays: 30,
	});

	// Configure Google OAuth
	// You can set these via environment variables or Meteor settings
	const googleClientId = process.env.GOOGLE_CLIENT_ID || (Meteor as any).settings?.google?.clientId;
	const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || (Meteor as any).settings?.google?.clientSecret;

	if (googleClientId && googleClientSecret) {
		// Use await with upsertAsync for Meteor 3.x
		Meteor.startup(async () => {
			await ServiceConfiguration.configurations.upsertAsync(
				{ service: 'google' },
				{
					$set: {
						clientId: googleClientId,
						secret: googleClientSecret,
						loginStyle: 'popup',
					},
				},
			);
			console.log('✅ Google OAuth configured');
		});
	} else {
		console.warn('⚠️ Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
	}

	// Customize user fields on creation
	Accounts.onCreateUser((options, user) => {
		// Initialize profile with default values
		const profile: UserProfile = {
			displayName: '',
			firstName: '',
			lastName: '',
			bio: '',
			avatar: '',
		};

		// For Google OAuth users, extract profile info
		if (user.services?.google) {
			profile.displayName = user.services.google.name || user.services.google.email?.split('@')[0] || 'User';
			profile.firstName = user.services.google.given_name || '';
			profile.lastName = user.services.google.family_name || '';
			profile.avatar = user.services.google.picture || '';
		} else if (options.email) {
			// For email/password users
			profile.displayName = options.email.split('@')[0] || 'User';
		}

		// Merge with any provided profile data
		if (options.profile) {
			Object.assign(profile, options.profile);
		}

		return {
			...user,
			profile,
		};
	});

	// Rate limiting for security

	// Get list of all method names to apply rate limiter
	const ACCOUNT_METHODS = [
		'updateUserProfile',
		'user.changePassword',
		'deleteAccount',
	];

	DDPRateLimiter.addRule(
		{
			type: 'method',
			name(name) {
				return ACCOUNT_METHODS.includes(name);
			},
		},
		5, // Max 5 calls
		60000, // per 60 seconds
	);

	// Rate limit login attempts
	DDPRateLimiter.addRule(
		{
			type: 'method',
			name: 'login',
		},
		5, // Max 5 attempts
		60000, // per 60 seconds
	);
}

/**
 * Meteor methods for account management
 */
Meteor.methods({
	/**
	 * Update user profile information
	 * @param updates - Partial profile data to update
	 */
	async updateUserProfile(updates: Partial<UserProfile>) {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in to update your profile');
		}

		check(updates, {
			firstName: Match.Optional(String),
			lastName: Match.Optional(String),
			displayName: Match.Optional(String),
			bio: Match.Optional(String),
			avatar: Match.Optional(String),
		});

		// Sanitize inputs
		const sanitized: Partial<UserProfile> = {};
		if (updates.firstName !== undefined) {
			sanitized.firstName = updates.firstName.trim().substring(0, 50);
		}
		if (updates.lastName !== undefined) {
			sanitized.lastName = updates.lastName.trim().substring(0, 50);
		}
		if (updates.displayName !== undefined) {
			sanitized.displayName = updates.displayName.trim().substring(0, 50);
		}
		if (updates.bio !== undefined) {
			sanitized.bio = updates.bio.trim().substring(0, 500);
		}
		if (updates.avatar !== undefined) {
			sanitized.avatar = updates.avatar.trim().substring(0, 500);
		}

		// Update user profile
		await Meteor.users.updateAsync(this.userId, {
			$set: Object.keys(sanitized).reduce((acc, key) => {
				acc[`profile.${key}`] = sanitized[key as keyof UserProfile];
				return acc;
			}, {} as Record<string, any>),
		});

		return { success: true };
	},

	/**
	 * Change user password (custom wrapper around Accounts.changePassword)
	 * @param oldPassword - Current password
	 * @param newPassword - New password
	 */
	async 'user.changePassword'(oldPassword: string, newPassword: string) {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in to change your password');
		}

		check(oldPassword, String);
		check(newPassword, String);

		// Validate new password strength
		if (newPassword.length < 8) {
			throw new Meteor.Error('weak-password', 'Password must be at least 8 characters long');
		}

		// This method only runs on the server
		if (Meteor.isServer) {
			// Verify old password
			const user = await Meteor.users.findOneAsync(this.userId);
			if (!user) {
				throw new Meteor.Error('user-not-found', 'User not found');
			}

			// Check old password
			const result = await Accounts._checkPasswordAsync(user, oldPassword);
			if (result.error) {
				throw new Meteor.Error('incorrect-password', 'Current password is incorrect');
			}

			// Set new password
			await Accounts.setPasswordAsync(this.userId, newPassword);
		}

		return { success: true };
	},

	/**
	 * Delete user account
	 * @param password - User password for confirmation
	 */
	async deleteAccount(password: string) {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in to delete your account');
		}

		check(password, String);

		if (Meteor.isServer) {
			const user = await Meteor.users.findOneAsync(this.userId);
			if (!user) {
				throw new Meteor.Error('user-not-found', 'User not found');
			}

			// Verify password
			const result = await Accounts._checkPasswordAsync(user, password);
			if (result.error) {
				throw new Meteor.Error('incorrect-password', 'Password is incorrect');
			}

			// Delete all user's bills
			const { Bills } = await import('./bills');
			await Bills.removeAsync({ userId: this.userId });

			// Delete user account
			await Meteor.users.removeAsync(this.userId);
		}

		return { success: true };
	},

	/**
	 * Get current user's full profile
	 */
	async getUserProfile() {
		if (!this.userId) {
			throw new Meteor.Error('not-authorized', 'You must be logged in');
		}

		const user = await Meteor.users.findOneAsync(
			this.userId,
			{ fields: { profile: 1, emails: 1, createdAt: 1 } },
		);

		if (!user) {
			throw new Meteor.Error('user-not-found', 'User not found');
		}

		return {
			profile: user.profile,
			email: user.emails?.[0]?.address,
			createdAt: user.createdAt,
		};
	},
});

/**
 * Publications for user data
 */
if (Meteor.isServer) {
	// Publish current user's profile
	Meteor.publish('userData', function() {
		if (!this.userId) {
			return this.ready();
		}

		return Meteor.users.find(
			{ _id: this.userId },
			{ fields: { profile: 1, emails: 1, createdAt: 1 } },
		);
	});
}
