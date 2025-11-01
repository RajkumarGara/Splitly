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
		// Prevent duplicate message listeners
		let messageListenerAttached = false;

		// Listen for storage events to coordinate updates across tabs
		window.addEventListener('storage', (e) => {
			if (e.key === 'swVersion' && e.oldValue && e.newValue && e.oldValue !== e.newValue) {
				// Another tab updated the version - reload this tab too
				console.info('[SW] Version updated by another tab, reloading...');
				setTimeout(() => {
					window.location.reload();
				}, 500);
			}
		});

		navigator.serviceWorker.register('/service-worker.js')
			.then((registration) => {
				console.info('[SW] Service Worker registered successfully');

				// Version tracking: ask active worker for its version
				// Use localStorage to prevent duplicate prompts (not sessionStorage - see below)
				let pendingPrompt = false;
				let versionRequestPending = false;
				let reloadScheduled = false;

				function requestVersion(worker) {
					if (!worker || worker.state === 'redundant' || versionRequestPending) {
						return;
					}

					// Only request from active workers (not installing or waiting)
					if (worker.state !== 'activated' && worker.state !== 'activating') {
						console.warn('[SW] Cannot request version from worker in state:', worker.state);
						return;
					}

					versionRequestPending = true;
					worker.postMessage({ type: 'GET_VERSION' });

					// Reset flag after timeout
					setTimeout(() => {
						versionRequestPending = false;
					}, 5000);
				}

				// Listen for messages (version or custom events) - only attach once
				if (!messageListenerAttached) {
					messageListenerAttached = true;
					navigator.serviceWorker.addEventListener('message', (e) => {
						if (e.data?.type === 'SW_VERSION') {
							versionRequestPending = false; // Clear pending flag
							const version = e.data.version;

							// Always read fresh from localStorage in case another tab updated it
							const currentKnown = localStorage.getItem('swVersion');
							console.info('[SW] Received version:', version, '(known:', currentKnown, ')');

							if (!currentKnown) {
								// First time - just store version
								localStorage.setItem('swVersion', version);
								console.info('[SW] Initial version set:', version);
							} else if (version !== currentKnown && !pendingPrompt && !reloadScheduled) {
								// Check if we recently scheduled a reload (prevent rapid double-updates)
								const lastReloadTime = localStorage.getItem('swLastReloadTime');
								const now = Date.now();
								if (lastReloadTime && (now - parseInt(lastReloadTime, 10)) < 10000) {
									console.info('[SW] Reload was recent, skipping duplicate update');
									return;
								}

								// New version detected - this tab will handle it
								pendingPrompt = true;
								reloadScheduled = true;
								localStorage.setItem('swLastReloadTime', now.toString());

								console.info('[SW] New version available:', version, '(current:', currentKnown + ')');

								// Show update notification with fallback
								const showUpdateAndReload = () => {
									// Use setTimeout to allow current operation to complete
									setTimeout(() => {
										// Update version BEFORE reload so storage event fires correctly
										localStorage.setItem('swVersion', version);

										// Modern hard reload approach - clear caches then reload
										if ('caches' in window) {
											// Clear all caches before reload for hard refresh
											caches.keys().then(names => {
												return Promise.all(
													names.map(name => caches.delete(name)),
												);
											}).then(() => {
												window.location.reload();
											}).catch(err => {
												// Cache clear failed (private mode?), just reload anyway
												console.warn('[SW] Cache clear failed:', err);
												window.location.reload();
											});
										} else {
											// No cache API, just reload
											window.location.reload();
										}
									}, 2500);
								};

								// Try to show toast, but don't block on failure
								try {
									import('/imports/ui/blaze/layout').then(module => {
										if (module.pushAlert) {
											module.pushAlert('success', '🎉 New version available! Refreshing...');
										}
										showUpdateAndReload();
									}).catch(err => {
										console.warn('[SW] Could not load pushAlert:', err);
										// Show native alert as fallback (non-blocking in Safari)
										if ('Notification' in window && Notification.permission === 'granted') {
											new Notification('Splitly Update', {
												body: 'New version available! Refreshing...',
												icon: '/icons/icon-192x192.svg',
											});
										}
										showUpdateAndReload();
									});
								} catch (err) {
									console.warn('[SW] Update notification error:', err);
									showUpdateAndReload();
								}
							}
						} else if (e.data?.type === 'SW_ACTIVATED') {
							// New service worker activated - this happens after skipWaiting
							console.info('[SW] Service worker activated:', e.data.version);
							// Request version from the newly activated worker
							setTimeout(() => {
								if (registration.active) {
									requestVersion(registration.active);
								}
							}, 100);
						}
					});
				}

				// Updatefound: monitor installing worker state
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					if (!newWorker) {return;}

					console.info('[SW] Update found, new worker installing...');

					newWorker.addEventListener('statechange', () => {
						console.info('[SW] New worker state:', newWorker.state);

						if (newWorker.state === 'installed') {
							if (navigator.serviceWorker.controller) {
								// New SW installed, existing page - tell it to skip waiting
								console.info('[SW] New version installed, activating...');
								newWorker.postMessage({ type: 'SKIP_WAITING' });

								// Request version from the currently active worker (not the new one)
								// The new worker will send SW_ACTIVATED when it takes over
								setTimeout(() => {
									if (registration.active) {
										requestVersion(registration.active);
									}
								}, 1000);
							} else {
								// First install, no existing controller
								console.info('[SW] First install complete');
								// Wait for it to activate
								setTimeout(() => {
									if (registration.active) {
										requestVersion(registration.active);
									}
								}, 500);
							}
						} else if (newWorker.state === 'activated') {
							console.info('[SW] New worker activated');
							// Request version from newly activated worker
							if (registration.active) {
								requestVersion(registration.active);
							}
						}
					});
				});

				// Initial version request - handle both new install and existing SW
				if (registration.active) {
					requestVersion(registration.active);
				} else if (registration.installing) {
					// Wait for initial install to complete
					registration.installing.addEventListener('statechange', function onStateChange() {
						if (this.state === 'activated') {
							requestVersion(registration.active);
							this.removeEventListener('statechange', onStateChange);
						}
					});
				} else if (registration.waiting) {
					// Waiting worker exists - activate it
					console.info('[SW] Waiting worker found, activating...');
					registration.waiting.postMessage({ type: 'SKIP_WAITING' });
					// Don't request version from waiting worker - wait for it to activate
					// The activate event will trigger SW_ACTIVATED message
				}

				// Aggressive update check: every 2 minutes while tab focused
				let lastUpdateCheck = Date.now();
				const UPDATE_INTERVAL = 2 * 60 * 1000; // 2 minutes

				const checkForUpdate = () => {
					const now = Date.now();
					if (now - lastUpdateCheck > UPDATE_INTERVAL) {
						lastUpdateCheck = now;
						console.info('[SW] Checking for updates...');
						registration.update().catch(err => {
							console.warn('[SW] Update check failed:', err);
						});
					}
				};

				window.addEventListener('focus', checkForUpdate);

				// Also check on page visibility change
				document.addEventListener('visibilitychange', () => {
					if (!document.hidden) {
						checkForUpdate();
					}
				});

				// Safari-specific: check on page show event (bfcache)
				window.addEventListener('pageshow', (event) => {
					if (event.persisted) {
						// Page was restored from bfcache (back/forward)
						console.info('[SW] Page restored from cache, checking for updates...');
						checkForUpdate();
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
