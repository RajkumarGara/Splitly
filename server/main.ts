import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';

// Load environment variables FIRST, before any other imports
// This MUST run before importing accounts module
if (Meteor.isServer) {
	try {
		const fs = require('fs');
		const path = require('path');
		const envPath = path.resolve(process.cwd(), '../../../../../.env');

		if (fs.existsSync(envPath)) {
			console.log('📁 Loading .env file from:', envPath);
			const envContent = fs.readFileSync(envPath, 'utf8');
			let loadedCount = 0;
			envContent.split('\n').forEach((line: string) => {
				const match = line.match(/^([^#=]+)=(.*)$/);
				if (match) {
					const key = match[1].trim();
					const value = match[2].trim();
					if (key && !process.env[key]) {
						process.env[key] = value;
						loadedCount++;
					}
				}
			});
			console.log(`✅ Loaded ${loadedCount} environment variables`);
		} else {
			console.warn('⚠️ .env file not found at:', envPath);
		}
	} catch (err) {
		console.error('❌ Could not load .env file:', err);
	}
}

// Now import modules that depend on environment variables
// Using require() to ensure they load AFTER the code above runs
require('/imports/api/bills');
require('/imports/api/users');
require('/imports/api/accounts');
require('/imports/api/publications');

// Configure security headers
WebApp.connectHandlers.use((req: any, res: any, next: any) => {
	// Skip strict security headers for OAuth callback routes
	const isOAuthRoute = req.url?.includes('/_oauth/') || req.url?.includes('/_ufs/');

	// Content Security Policy - allow Google OAuth domains
	res.setHeader(
		'Content-Security-Policy',
		"default-src 'self'; " +
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com; " +
		"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; " +
		"font-src 'self' https://cdn.jsdelivr.net data:; " +
		"img-src 'self' data: blob: https://*.googleusercontent.com https://accounts.google.com; " +
		"connect-src 'self' ws: wss: https://accounts.google.com https://oauth2.googleapis.com; " +
		"frame-src https://accounts.google.com; " +
		"frame-ancestors 'none';",
	);

	// X-Frame-Options (clickjacking protection) - allow Google to frame OAuth pages
	if (isOAuthRoute) {
		res.setHeader('X-Frame-Options', 'ALLOWALL');
	} else {
		res.setHeader('X-Frame-Options', 'DENY');
	}

	// X-Content-Type-Options (MIME sniffing protection)
	res.setHeader('X-Content-Type-Options', 'nosniff');

	// Referrer Policy
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

	// Permissions Policy (limit features)
	res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

	// Note: COOP and HSTS headers removed for development to allow OAuth popups
	// Add them back in production with proper HTTPS setup

	next();
});

Meteor.startup(() => {
	// API initialization - log critical config only
	if (!process.env.GOOGLE_GEMINI_API_KEY) {
		console.warn('⚠️ Google Gemini API key not configured - receipt scanning disabled');
	}

	// Server started - production ready
});
