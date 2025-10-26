/* eslint-env serviceworker */
/* global self, caches, fetch, Response, Headers */

// Splitly Service Worker - Handles offline caching and PWA functionality
const CACHE_NAME = 'splitly-v1';
const RUNTIME_CACHE = 'splitly-runtime-v1';

// Assets to cache on install
const PRECACHE_URLS = [
	'/',
	'/manifest.json',
	'/favicon.svg',
	'/icons/icon-192x192.svg',
	'/icons/icon-512x512.svg',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
					.map((name) => caches.delete(name)),
			);
		}).then(() => self.clients.claim()),
	);
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http(s) requests
	if (!event.request.url.startsWith('http')) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached response if found
			if (cachedResponse) {
				// Update cache in background
				fetch(event.request).then((response) => {
					if (response && response.status === 200) {
						caches.open(RUNTIME_CACHE).then((cache) => {
							cache.put(event.request, response);
						});
					}
				}).catch(() => {
					// Network failed, but we have cache
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
				// Could return a custom offline page here
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
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
