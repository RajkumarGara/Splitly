#!/usr/bin/env node

/**
 * Automatically updates the service worker cache version
 * Run this before deploying to invalidate client caches
 */

const fs = require('fs');
const path = require('path');

const SERVICE_WORKER_PATH = path.join(__dirname, '../public/service-worker.js');

try {
	let content = fs.readFileSync(SERVICE_WORKER_PATH, 'utf8');

	// Extract current version
	const versionMatch = content.match(/const CACHE_VERSION = ['"]v([\d.]+)['"]/);
	if (!versionMatch) {
		console.error('❌ Could not find CACHE_VERSION in service-worker.js');
		process.exit(1);
	}

	const currentVersion = versionMatch[1];
	const versionParts = currentVersion.split('.').map(Number);

	// Increment patch version
	versionParts[2] = (versionParts[2] || 0) + 1;
	const newVersion = versionParts.join('.');

	// Replace version in file
	const newContent = content.replace(
		/const CACHE_VERSION = ['"]v[\d.]+['"]/,
		`const CACHE_VERSION = 'v${newVersion}'`,
	);

	fs.writeFileSync(SERVICE_WORKER_PATH, newContent, 'utf8');

	console.log(`✅ Cache version updated: v${currentVersion} → v${newVersion}`);
	console.log(`📦 Service worker will invalidate all client caches on next deployment`);
} catch (error) {
	console.error('❌ Error updating cache version:', error.message);
	process.exit(1);
}
