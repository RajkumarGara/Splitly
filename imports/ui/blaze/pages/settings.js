/* eslint-env browser */
import './settings.html';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { pushAlert, showConfirm } from '../layout';
import config from '/config/app.config.json';

function getFlag(name, def) {
	const stored = localStorage.getItem('flag_' + name);
	if (stored === 'true') {
		return true;
	}
	if (stored === 'false') {
		return false;
	}
	return (config.features || {})[name] ?? def;
}

Template.Settings.helpers({
	showHelpEnabled() {
		const saved = localStorage.getItem('splitly_showHelp');
		return saved === null ? true : saved === 'true';
	},
	analysisEnabled() {
		return getFlag('analysisPage', true);
	},
	indexedEnabled() {
		return getFlag('indexedDbSync', true);
	},
});

Template.Settings.events({
	'change #showHelpSwitch'(e) {
		localStorage.setItem('splitly_showHelp', e.currentTarget.checked);
	},
	'change #analysisPageSwitch'(e) {
		localStorage.setItem('flag_analysisPage', e.currentTarget.checked);
	},
	'change #indexedSwitch'(e) {
		localStorage.setItem('flag_indexedDbSync', e.currentTarget.checked);
	},
	async 'click #clearCacheBtn'() {
		const confirmed = await showConfirm(
			'Are you sure you want to clear all data?\n\nThis will permanently delete:\n\n• All receipts and bills\n• All items\n• All people\n• All analytics data\n• IndexedDB cache\n\nThis action CANNOT be undone!',
			{
				okText: 'Yes, Delete Everything',
				cancelText: 'Cancel'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			// Clear all data from the server
			await Meteor.callAsync('clearAllData');

			// Clear IndexedDB cache
			if (window.indexedDB) {
				try {
					await indexedDB.deleteDatabase('splitly-bills');
				} catch (err) {
					console.error('Error clearing IndexedDB:', err);
				}
			}

			// Clear localStorage preferences (optional - keeping settings intact)
			// localStorage.clear();

			pushAlert('success', 'All data has been cleared successfully');

			// Redirect to home page
			setTimeout(() => {
				FlowRouter.go('/');
			}, 1000);
		} catch (err) {
			pushAlert('error', err.reason || 'Failed to clear data');
		}
	},
});
