import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import '/imports/ui/blaze/layout';
import '/imports/ui/blaze/components/userModal';
import '/imports/ui/blaze/pages/dashboard';
import '/imports/ui/blaze/pages/splitPage';
import '/imports/ui/blaze/pages/history';
import '/imports/ui/blaze/pages/analysis';
import '/imports/ui/blaze/pages/settings';

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

FlowRouter.route('/', { name: 'dashboard', action() { render('Dashboard'); } });
FlowRouter.route('/split/:id', { name: 'splitPage', action(params) { render('SplitPage', { billId: params.id }); } });
FlowRouter.route('/history', { name: 'history', action() { render('History'); } });
FlowRouter.route('/analysis', { name: 'analysis', action() { render('Analysis'); } });
FlowRouter.route('/settings', { name: 'settings', action() { render('Settings'); } });

