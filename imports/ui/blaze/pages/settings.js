/* eslint-env browser */
import './settings.html';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { pushAlert } from '/imports/ui/blaze/layout';
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

function getTheme() {
	return localStorage.getItem('theme') || 'light';
}

function applyTheme(theme) {
	document.documentElement.setAttribute('data-bs-theme', theme);
}

Template.Settings.helpers({
	currentUser() {
		return Meteor.user();
	},
	userEmail() {
		const user = Meteor.user();
		return user?.emails?.[0]?.address || '';
	},
	userDisplayNameOrEmail() {
		const user = Meteor.user();
		// For guest accounts or users with displayName, show displayName
		if (user?.profile?.displayName) {
			return user.profile.displayName;
		}
		// Otherwise show email
		return user?.emails?.[0]?.address || 'User';
	},
	isThemeLight() {
		return getTheme() === 'light';
	},
	isThemeDark() {
		return getTheme() === 'dark';
	},
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
	'change input[name="themeRadio"]'(e) {
		const theme = e.currentTarget.value;
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	},
	'change #showHelpSwitch'(e) {
		localStorage.setItem('splitly_showHelp', e.currentTarget.checked);
	},
	'change #analysisPageSwitch'(e) {
		localStorage.setItem('flag_analysisPage', e.currentTarget.checked);
	},
	'change #indexedSwitch'(e) {
		localStorage.setItem('flag_indexedDbSync', e.currentTarget.checked);
	},
	'click #logoutSettingsBtn'(e) {
		e.preventDefault();
		Meteor.logout((error) => {
			if (error) {
				pushAlert('error', 'Logout failed');
			} else {
				pushAlert('success', 'Logged out successfully');
				FlowRouter.go('/login');
			}
		});
	},
});

