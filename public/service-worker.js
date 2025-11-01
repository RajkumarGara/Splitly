/* eslint-env serviceworker */
/* global self, fetch, Response, Headers */

// Splitly Service Worker - Handles offline caching and PWA functionality
// IMPORTANT: Update CACHE_VERSION when deploying new code to invalidate old caches
const CACHE_VERSION = 'v1.0.2'; // Change this version number on each deployment
const CACHE_NAME = `splitly-${CACHE_VERSION}`;
const RUNTIME_CACHE = `splitly-runtime-${CACHE_VERSION}`;

// Assets to cache on install
const urlsToCache = [
	'/',
	'/manifest.json',
	'/favicon.svg',
	'/icons/icon-192x192.svg',
	'/icons/icon-512x512.svg',
];

// Install event - cache core files
self.addEventListener('install', event => {
	console.info('[SW] Installing service worker, version:', CACHE_VERSION);
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(urlsToCache))
			.catch(error => {
				console.error('[SW] Cache installation failed:', error);
				throw error;
			}),
	);
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
	console.info('[SW] Activating service worker, version:', CACHE_VERSION);
	event.waitUntil(
		Promise.all([
			// Clean up ALL old caches - both static and runtime
			caches.keys().then(cacheNames => {
				const deletionPromises = cacheNames.map(cacheName => {
					// Delete any cache that doesn't match current version
					if (!cacheName.includes(CACHE_VERSION)) {
						console.info('[SW] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				}).filter(Boolean);
				return Promise.all(deletionPromises);
			}),
			// Take control of all clients immediately
			// This ensures new SW handles all requests right away
			self.clients.claim().then(() => {
				console.info('[SW] Claimed all clients');
				// Notify all clients about the new version
				return self.clients.matchAll().then(clients => {
					clients.forEach(client => {
						client.postMessage({
							type: 'SW_ACTIVATED',
							version: CACHE_VERSION,
						});
					});
				});
			}),
		]),
	);
});

// Fetch event - network first for HTML, cache first for assets
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http(s) requests
	if (!event.request.url.startsWith('http')) {
		return;
	}

	const url = new URL(event.request.url);

	// Network-first strategy for HTML and API calls to always get fresh content
	const isHtmlOrApi = event.request.headers.get('accept')?.includes('text/html') ||
		url.pathname.startsWith('/api') ||
		url.pathname.startsWith('/sockjs');

	if (isHtmlOrApi) {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					// Cache successful HTML responses
					if (response && response.status === 200) {
						const responseToCache = response.clone();
						caches.open(RUNTIME_CACHE).then(cache => {
							cache.put(event.request, responseToCache);
						});
					}
					return response;
				})
				.catch(() => {
					// Network failed, try cache
					return caches.match(event.request).then(cachedResponse => {
						if (cachedResponse) {
							return cachedResponse;
						}
						// No cache either
						return new Response('Offline - Please check your connection', {
							status: 503,
							statusText: 'Service Unavailable',
							headers: new Headers({
								'Content-Type': 'text/plain',
							}),
						});
					});
				}),
		);
		return;
	}

	// Cache-first strategy for static assets (CSS, JS, images, fonts)
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached response if found
			if (cachedResponse) {
				// Update cache in background for next time
				fetch(event.request).then((response) => {
					if (response && response.status === 200) {
						caches.open(RUNTIME_CACHE).then((cache) => {
							cache.put(event.request, response);
						});
					}
				}).catch(() => {
					// Network failed, but we have cache - no action needed
				});
				return cachedResponse;
			}

			// Not in cache, fetch from network
			return fetch(event.request).then((response) => {
				// Don't cache non-successful responses
				if (!response || response.status !== 200 || response.type === 'error') {
					return response;
				}

				// Clone the response
				const responseToCache = response.clone();

				// Cache the fetched resource
				caches.open(RUNTIME_CACHE).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			}).catch(() => {
				// Network failed and no cache
				return new Response('Offline - Please check your connection', {
					status: 503,
					statusText: 'Service Unavailable',
					headers: new Headers({
						'Content-Type': 'text/plain',
					}),
				});
			});
		}),
	);
});

// Handle messages from the client
self.addEventListener('message', (event) => {
	if (!event.data) {return;}

	if (event.data.type === 'SKIP_WAITING') {
		console.info('[SW] Received SKIP_WAITING message, activating new version immediately');
		// Skip waiting and activate immediately
		self.skipWaiting();
	}

	if (event.data.type === 'GET_VERSION') {
		// Respond back to client with current cache version
		try {
			if (event.source) {
				event.source.postMessage({
					type: 'SW_VERSION',
					version: CACHE_VERSION,
				});
				console.info('[SW] Sent version to client:', CACHE_VERSION);
			}
		} catch (err) {
			// Silently handle postMessage errors (client may have closed)
			console.warn('[SW] Could not send version to client:', err.message);
		}
	}
});
