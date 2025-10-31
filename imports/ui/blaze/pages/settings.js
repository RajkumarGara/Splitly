/* eslint-env browser */
import './settings.html';
import { Template } from 'meteor/templating';
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
});

