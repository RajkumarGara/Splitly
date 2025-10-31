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
				console.info('[SW] Service Worker registered successfully');

				// Version tracking: ask active worker for its version
				let knownVersion = localStorage.getItem('swVersion');
				let pendingPrompt = false;

				function requestVersion() {
					if (registration.active) {
						registration.active.postMessage({ type: 'GET_VERSION' });
					}
				}

				// Listen for messages (version or custom events)
				navigator.serviceWorker.addEventListener('message', (e) => {
					if (e.data?.type === 'SW_VERSION') {
						const version = e.data.version;
						if (!knownVersion) {
							knownVersion = version;
							localStorage.setItem('swVersion', version);
						} else if (version !== knownVersion && !pendingPrompt) {
							pendingPrompt = true;
							// Non-intrusive prompt: user can refresh manually
							console.info('[SW] New version available:', version);
							// Dynamically import pushAlert to avoid circular dependency
							import('/imports/ui/blaze/layout').then(module => {
								if (module.pushAlert) {
									module.pushAlert('info', 'New version available. Reload to update.');
								}
							}).catch(err => {
								console.error('[SW] Failed to load pushAlert:', err);
							});
						}
					}
				});

				// Updatefound: monitor installing worker state, request version when installed
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					if (!newWorker) {return;}
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed') {
							requestVersion();
						}
					});
				});

				// Initial version request
				requestVersion();

				// Light-touch update check every 5 minutes while tab focused
				let lastUpdateCheck = Date.now();
				window.addEventListener('focus', () => {
					const now = Date.now();
					if (now - lastUpdateCheck > 5 * 60 * 1000) {
						lastUpdateCheck = now;
						registration.update();
					}
				});
			})
			.catch((error) => {
				console.error('[SW] Service Worker registration failed:', error);
			});
	}
});

// Blaze layout & routes are defined under imports/startup/client.
import '/imports/startup/client/routes';
