import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import '/imports/api/bills';
import '/imports/api/users';
import '/imports/api/publications';

// Configure security headers
WebApp.connectHandlers.use((req, res, next) => {
	// Content Security Policy
	res.setHeader(
		'Content-Security-Policy',
		"default-src 'self'; " +
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
		"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
		"font-src 'self' https://cdn.jsdelivr.net data:; " +
		"img-src 'self' data: blob:; " +
		"connect-src 'self' ws: wss:; " +
		"frame-ancestors 'none';"
	);
	
	// HTTP Strict Transport Security (HSTS)
	res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	
	// X-Frame-Options (clickjacking protection)
	res.setHeader('X-Frame-Options', 'DENY');
	
	// X-Content-Type-Options (MIME sniffing protection)
	res.setHeader('X-Content-Type-Options', 'nosniff');
	
	// Referrer Policy
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	
	// Permissions Policy (limit features)
	res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
	
	next();
});

// Load environment variables
if (Meteor.isServer) {
	// Meteor automatically loads from settings.json or environment variables
	// For .env file support, we can manually load it
	try {
		// Try to read .env file if it exists
		const fs = require('fs');
		const path = require('path');
		const envPath = path.resolve(process.cwd(), '../../../../../.env');

		if (fs.existsSync(envPath)) {
			const envContent = fs.readFileSync(envPath, 'utf8');
			envContent.split('\n').forEach((line: string) => {
				const match = line.match(/^([^#=]+)=(.*)$/);
				if (match) {
					const key = match[1].trim();
					const value = match[2].trim();
					if (key && !process.env[key]) {
						process.env[key] = value;
					}
				}
			});
		}
	} catch (err) {
		console.error('Could not load .env file:', err);
	}
}

Meteor.startup(() => {
	// API initialization - log critical config only
	if (!process.env.GOOGLE_GEMINI_API_KEY) {
		console.warn('⚠️ Google Gemini API key not configured - receipt scanning disabled');
	}

	// Server started - production ready
});
