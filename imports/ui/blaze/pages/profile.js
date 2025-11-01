/* eslint-env browser */
import './profile.html';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { pushAlert, showConfirm } from '/imports/ui/blaze/layout';

Template.Profile.onCreated(function () {
	this.subscribe('userData');
	this.editingProfile = new ReactiveVar(false);
	this.changingPassword = new ReactiveVar(false);
	this.loading = new ReactiveVar(false);
	this.processing = new ReactiveVar(false);

	// Redirect if not logged in
	this.autorun(() => {
		if (!Meteor.userId() && !Meteor.loggingIn()) {
			FlowRouter.go('/login');
		}
	});
});

Template.Profile.helpers({
	loading() {
		return Template.instance().loading.get();
	},
	editingProfile() {
		return Template.instance().editingProfile.get();
	},
	changingPassword() {
		return Template.instance().changingPassword.get();
	},
	profile() {
		const user = Meteor.user();
		return user?.profile || {};
	},
	hasGoogleAvatar() {
		const user = Meteor.user();
		return user?.profile?.avatar && user?.profile?.avatar.startsWith('http');
	},
	email() {
		const user = Meteor.user();
		return user?.emails?.[0]?.address || 'No email';
	},
	createdAt() {
		const user = Meteor.user();
		return user?.createdAt;
	},
	formatDate(date) {
		if (!date) {return 'Unknown';}
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	},
});

Template.Profile.events({
	'click #editProfileBtn'(e, tpl) {
		e.preventDefault();
		tpl.editingProfile.set(true);
	},

	'click #cancelEditBtn'(e, tpl) {
		e.preventDefault();
		tpl.editingProfile.set(false);
	},

	async 'submit #profileForm'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		const displayName = tpl.find('#displayName').value.trim();
		const firstName = tpl.find('#firstName').value.trim();
		const lastName = tpl.find('#lastName').value.trim();
		const bio = tpl.find('#bio').value.trim();

		tpl.processing.set(true);
		const saveBtn = tpl.find('#saveProfileBtn');
		if (saveBtn) {
			saveBtn.disabled = true;
			saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
		}

		try {
			await Meteor.callAsync('updateUserProfile', {
				displayName,
				firstName,
				lastName,
				bio,
			});
			pushAlert('success', 'Profile updated successfully');
			tpl.editingProfile.set(false);
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to update profile');
		} finally {
			tpl.processing.set(false);
			if (saveBtn) {
				saveBtn.disabled = false;
				saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Save Changes';
			}
		}
	},

	'click #changePasswordBtn'(e, tpl) {
		e.preventDefault();
		tpl.changingPassword.set(true);
	},

	'click #cancelPasswordBtn'(e, tpl) {
		e.preventDefault();
		tpl.changingPassword.set(false);
		// Clear form
		const form = tpl.find('#passwordForm');
		if (form) {form.reset();}
	},

	async 'submit #passwordForm'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		const currentPassword = tpl.find('#currentPassword').value;
		const newPassword = tpl.find('#newPassword').value;
		const confirmPassword = tpl.find('#confirmPassword').value;

		if (newPassword.length < 8) {
			pushAlert('error', 'New password must be at least 8 characters');
			return;
		}

		if (newPassword !== confirmPassword) {
			pushAlert('error', 'New passwords do not match');
			return;
		}

		tpl.processing.set(true);
		const saveBtn = tpl.find('#savePasswordBtn');
		if (saveBtn) {
			saveBtn.disabled = true;
			saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
		}

		try {
			await Meteor.callAsync('user.changePassword', currentPassword, newPassword);
			pushAlert('success', 'Password updated successfully');
			tpl.changingPassword.set(false);
			const form = tpl.find('#passwordForm');
			if (form) {form.reset();}
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to update password');
		} finally {
			tpl.processing.set(false);
			if (saveBtn) {
				saveBtn.disabled = false;
				saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Update Password';
			}
		}
	},

	async 'click #deleteAccountBtn'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		const confirmed = await showConfirm(
			'Delete your account? This cannot be undone.',
			{
				okText: 'Delete Account',
				okButtonClass: 'btn-danger',
				cancelText: 'Cancel',
			},
		);

		if (!confirmed) {return;}

		// Ask for password confirmation
		const password = window.prompt('Please enter your password to confirm account deletion:');
		if (!password) {
			pushAlert('info', 'Account deletion cancelled');
			return;
		}

		tpl.processing.set(true);

		try {
			await Meteor.callAsync('deleteAccount', password);
			pushAlert('success', 'Your account has been deleted');
			Meteor.logout(() => {
				FlowRouter.go('/login');
			});
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to delete account');
			tpl.processing.set(false);
		}
	},
});
