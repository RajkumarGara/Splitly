import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/global.css';
// Import Bootstrap components individually to ensure they're available
import { Modal, Collapse, Dropdown } from 'bootstrap';
import { Meteor } from 'meteor/meteor';

// Make Bootstrap components available globally
Meteor.startup(() => {
	if (typeof window !== 'undefined') {
		window.bootstrap = window.bootstrap || {};
		window.bootstrap.Modal = Modal;
		window.bootstrap.Collapse = Collapse;
		window.bootstrap.Dropdown = Dropdown;
	}
});

// Blaze layout & routes are defined under imports/startup/client.
import '/imports/startup/client/routes';
