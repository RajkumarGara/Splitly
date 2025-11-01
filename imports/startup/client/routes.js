import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import '/imports/ui/blaze/layout';
import '/imports/ui/blaze/components/userModal';
import '/imports/ui/blaze/pages/dashboard';
import '/imports/ui/blaze/pages/splitPage';
import '/imports/ui/blaze/pages/history';
import '/imports/ui/blaze/pages/analysis';
import '/imports/ui/blaze/pages/settings';
import '/imports/ui/blaze/pages/login';
import '/imports/ui/blaze/pages/profile';

function render(templateName, data = {}) {
	Meteor.defer(() => {
		const host = document.getElementById('app');
		if (!host || !Template[templateName] || !Template.MainLayout) {return;}

		if (host._blazeView) {
			Blaze.remove(host._blazeView);
			host._blazeView = null;
		}
		const view = Blaze.renderWithData(Template.MainLayout, { yield: templateName, ...data }, host);
		host._blazeView = view;
	});
}

function renderPublic(templateName, data = {}) {
	Meteor.defer(() => {
		const host = document.getElementById('app');
		if (!host || !Template[templateName]) {return;}

		if (host._blazeView) {
			Blaze.remove(host._blazeView);
			host._blazeView = null;
		}
		const view = Blaze.renderWithData(Template[templateName], data, host);
		host._blazeView = view;
	});
}

// Middleware to require authentication
function requireAuth(context, redirect) {
	// Use Tracker.nonreactive to prevent reactive changes from triggering route actions multiple times
	if (!Tracker.nonreactive(() => Meteor.userId()) && !Tracker.nonreactive(() => Meteor.loggingIn())) {
		redirect('/login');
	}
}

// Public routes (no authentication required)
FlowRouter.route('/login', {
	name: 'login',
	action() {
		// If already logged in, redirect to dashboard
		if (Meteor.userId()) {
			FlowRouter.go('/');
			return;
		}
		renderPublic('Login');
	},
});

// Protected routes (authentication required)
FlowRouter.route('/', {
	name: 'dashboard',
	triggersEnter: [requireAuth],
	action() { render('Dashboard'); },
});

FlowRouter.route('/split/:id', {
	name: 'splitPage',
	triggersEnter: [requireAuth],
	action(params) { render('SplitPage', { billId: params.id }); },
});

FlowRouter.route('/history', {
	name: 'history',
	triggersEnter: [requireAuth],
	action() { render('History'); },
});

FlowRouter.route('/analysis', {
	name: 'analysis',
	triggersEnter: [requireAuth],
	action() { render('Analysis'); },
});

FlowRouter.route('/settings', {
	name: 'settings',
	triggersEnter: [requireAuth],
	action() { render('Settings'); },
});

FlowRouter.route('/profile', {
	name: 'profile',
	triggersEnter: [requireAuth],
	action() { render('Profile'); },
});

