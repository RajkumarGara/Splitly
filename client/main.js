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
				if (process.env.NODE_ENV !== 'production') {
					console.log('Service Worker registered:', registration);
				}

				// Check for updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New service worker available, could show update notification
							if (process.env.NODE_ENV !== 'production') {
								console.log('New service worker available');
							}
						}
					});
				});
			})
			.catch((error) => {
				if (process.env.NODE_ENV !== 'production') {
					console.error('Service Worker registration failed:', error);
				}
			});
	}
});

// Blaze layout & routes are defined under imports/startup/client.
import '/imports/startup/client/routes';
