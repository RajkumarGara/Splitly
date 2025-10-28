import { Meteor } from 'meteor/meteor';
import '/imports/api/bills';
import '/imports/api/users';
import '/imports/api/publications';

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
		console.warn('⚠️ Google Gemini API key not configured - using Tesseract fallback');
	}

	// Production debugging for reload issues
	console.log('🚀 Server started at:', new Date().toISOString());
});
