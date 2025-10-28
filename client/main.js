import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/global.css';
// Import Bootstrap components individually to ensure they're available
import { Modal, Collapse, Dropdown } from 'bootstrap';
import { Meteor } from 'meteor/meteor';

// Initialize theme before anything else
function initTheme() {
	const theme = localStorage.getItem('theme') || 'light';
	document.documentElement.setAttribute('data-bs-theme', theme);
}

// Initialize theme immediately
initTheme();

// Make Bootstrap components available globally
Meteor.startup(() => {
	if (typeof window !== 'undefined') {
		window.bootstrap = window.bootstrap || {};
		window.bootstrap.Modal = Modal;
		window.bootstrap.Collapse = Collapse;
		window.bootstrap.Dropdown = Dropdown;
	}

	// Register Service Worker for PWA
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js')
			.then((registration) => {
				// Check for updates on page load and focus
				registration.update();
				window.addEventListener('focus', () => {
					registration.update();
				});

				// Handle updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New version available - reload gracefully
							window.location.reload();
						}
					});
				});
			})
			.catch((error) => {
				console.error('Service Worker registration failed:', error);
			});
	}
});

// Blaze layout & routes are defined under imports/startup/client.
import '/imports/startup/client/routes';
