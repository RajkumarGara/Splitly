/* eslint-env browser */
import { Template } from 'meteor/templating';
import './userModal.html'; // ensure template is registered
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { GlobalUsers } from '/imports/api/users';
import { pushAlert } from '/imports/ui/blaze/layout';

Template.UserModal.onCreated(function () {
	this.subscribe('globalUsers.all');
	this.editingUserId = new ReactiveVar(null);
	this.clickLock = false; // guard rapid double submissions
});

Template.UserModal.helpers({
	users() {
		return GlobalUsers.find({}, { sort: { createdAt: 1 } }).fetch();
	},
	hasUsers() {
		return GlobalUsers.find().count() > 0;
	},
	isEditing(userId) {
		return Template.instance().editingUserId.get() === userId;
	},
});

Template.UserModal.events({
	async 'click #addUserModalBtn'(e, tpl) {
		if (tpl.clickLock) {
			return;
		}
		const input = tpl.find('#userNameModalInput');
		const name = input.value.trim();
		if (!name) {
			pushAlert('error', 'Please enter a name');
			return;
		}
		tpl.clickLock = true;
		try {
			await Meteor.callAsync('globalUsers.insert', { name });
			pushAlert('success', 'Person added');
			input.value = '';
		} catch (err) {
			pushAlert('error', err.reason || 'Could not add person');
		} finally {
			tpl.clickLock = false;
		}
	},
	async 'click .remove-user'(e) {
		const userId = e.currentTarget.getAttribute('data-id');
		try {
			await Meteor.callAsync('globalUsers.remove', userId);
			pushAlert('success', 'Person removed');
		} catch (err) {
			pushAlert('error', err.reason || 'Could not remove person');
		}
	},
	'keypress #userNameModalInput'(e, tpl) {
		if (e.which === 13) {
			e.preventDefault();
			tpl.find('#addUserModalBtn').click();
		}
	},
	'click .editable-name'(e, tpl) {
		const userId = e.currentTarget.getAttribute('data-id');
		tpl.editingUserId.set(userId);
		Meteor.setTimeout(() => {
			const input = tpl.find(`.edit-user-input[data-id="${userId}"]`);
			if (input) {
				input.focus();
				input.select();
			}
		}, 100);
	},
	async 'click .save-edit-user'(e, tpl) {
		if (tpl.clickLock) {
			return;
		}
		const userId = e.currentTarget.getAttribute('data-id');
		const input = tpl.find(`.edit-user-input[data-id="${userId}"]`);
		const newName = input.value.trim();
		if (!newName) {
			pushAlert('error', 'Name cannot be empty');
			return;
		}
		tpl.clickLock = true;
		try {
			await Meteor.callAsync('globalUsers.update', userId, { name: newName });
			pushAlert('success', 'Name updated');
			tpl.editingUserId.set(null);
		} catch (err) {
			pushAlert('error', err.reason || 'Could not update name');
		} finally {
			tpl.clickLock = false;
		}
	},
	'click .cancel-edit-user'(e, tpl) {
		tpl.editingUserId.set(null);
	},
	'keypress .edit-user-input'(e, tpl) {
		if (e.which === 13) {
			e.preventDefault();
			const userId = e.currentTarget.getAttribute('data-id');
			tpl.find(`.save-edit-user[data-id="${userId}"]`).click();
		} else if (e.which === 27) {
			e.preventDefault();
			tpl.editingUserId.set(null);
		}
	},
	async 'click #saveUsersBtn'(e) {
		const tpl = Template.instance();
		const editingId = tpl.editingUserId.get();
		if (editingId) {
			const input = tpl.find(`.edit-user-input[data-id="${editingId}"]`);
			if (input) {
				const newName = input.value.trim();
				if (!newName) {
					pushAlert('error', 'Name cannot be empty');
					return;
				}
				try {
					await Meteor.callAsync('globalUsers.update', editingId, { name: newName });
					tpl.editingUserId.set(null);
				} catch (err) {
					pushAlert('error', err.reason || 'Update failed');
					return;
				}
			}
		}
		const users = GlobalUsers.find().fetch();
		for (const u of users) {
			await Meteor.callAsync('bills.syncUserName', u._id, u.name);
		}
		pushAlert('success', 'Users saved & synced!');
		e.currentTarget.blur();
		const modalEl = document.getElementById('userModal');
		if (modalEl && window.bootstrap) {
			(window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).hide();
		}
	},
	'click #cancelUsersBtn'(e) {
		e.currentTarget.blur();
		const modalEl = document.getElementById('userModal');
		if (modalEl && window.bootstrap) {
			(window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).hide();
		}
	},
	'click #closeUsersBtn'(e) {
		e.currentTarget.blur();
		const modalEl = document.getElementById('userModal');
		if (modalEl && window.bootstrap) {
			(window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).hide();
		}
	},
});

if (typeof window !== 'undefined') {
	document.addEventListener('hidden.bs.modal', (ev) => {
		if (ev.target && ev.target.id === 'userModal') {
			try {
				const view = Blaze.getView(document.getElementById('userModal'));
				const instance = view?.templateInstance?.();
				if (instance?.editingUserId) {
					instance.editingUserId.set(null);
				}
			} catch {
				/* noop */
			}
		}
	});
}
