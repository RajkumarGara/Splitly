import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini AI service for receipt OCR extraction
 * Uses Google's Gemini 2.5 Flash model for fast, accurate receipt parsing
 */

/**
 * Normalize store names to match internal naming conventions
 * @param storeName - Raw store name from Gemini
 * @returns Normalized store name
 */
function normalizeStoreName(storeName: string): string {
	const normalized = storeName.trim();
	const upperNormalized = normalized.toUpperCase();

	// Pattern-based matching for flexible store name recognition
	const storePatterns = [
		{ pattern: /HALAL/i, name: 'Halal Market' },
		{ pattern: /COSTCO/i, name: 'Costco' },
		{ pattern: /WAL[-\s*]?MART/i, name: 'Walmart' },
		{ pattern: /TARGET/i, name: 'Target' },
		{ pattern: /KROGER/i, name: 'Kroger' },
		{ pattern: /FRESH\s*THYME/i, name: 'Fresh Thyme' },
		{ pattern: /DOLLAR\s*GENERAL/i, name: 'Dollar General' },
		{ pattern: /DOLLAR\s*TREE/i, name: 'Dollar Tree' },
	];

	// Find matching pattern
	for (const { pattern, name } of storePatterns) {
		if (pattern.test(upperNormalized)) {
			return name;
		}
	}

	// Return original if no pattern matches
	return normalized;
}

/**
 * Extract receipt data using Gemini AI vision
 * @param base64Image - Base64 encoded image (with or without data URI prefix)
 * @returns Parsed receipt data with items and totals
 */
export async function extractReceiptWithGemini(base64Image: string): Promise<{
	success: boolean;
	store?: string;
	items?: Array<{ name: string; price: number }>;
	subtotal?: number;
	tax?: number;
	total?: number;
	error?: string;
}> {
	const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

	if (!apiKey) {
		console.log('⚠️  Gemini API key not found, skipping AI extraction');
		return { success: false, error: 'API key not configured' };
	}

	try {
		console.log('🤖 Starting Gemini AI extraction...');
		const startTime = Date.now();

		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				temperature: 0.1, // Lower temperature for more consistent, faster responses
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 4096, // Increased for large receipts (was 2048)
			},
		});

		// Remove data URI prefix if present
		const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

		// Optimized shorter prompt for faster processing
		const prompt = `Extract receipt data as JSON. Rules:
1. Clean item names (no codes)
2. Prices with 2 decimals
3. Apply discounts (lines ending with "-")
4. Skip quantity calc lines
5. Extract SUBTOTAL, TAX, TOTAL

JSON format only:
{"store":"Name","items":[{"name":"Item","price":12.99}],"subtotal":100.00,"tax":1.33,"total":101.33}`;

		const result = await model.generateContent([
			prompt,
			{
				inlineData: {
					data: imageData,
					mimeType: 'image/jpeg',
				},
			},
		]);

		const elapsed = Date.now() - startTime;
		console.log(`   ⏱️  Gemini processing time: ${(elapsed / 1000).toFixed(2)}s`);

		// Check for blocked content or safety issues
		const candidates = result.response.candidates;
		if (!candidates || candidates.length === 0) {
			console.error('   ⚠️  No candidates in response. Full response:', JSON.stringify(result.response, null, 2));
			throw new Error('No response candidates from Gemini API');
		}

		const finishReason = candidates[0].finishReason;
		if (finishReason !== 'STOP') {
			console.error(`   ⚠️  Unexpected finish reason: ${finishReason}`);
			if (finishReason === 'SAFETY') {
				throw new Error('Content blocked by safety filters');
			} else if (finishReason === 'MAX_TOKENS') {
				throw new Error('Response exceeded max tokens (try a clearer receipt image)');
			}
		}

		const response = result.response.text();

		// Clean response (remove markdown code blocks if present)
		let jsonText = response.trim();
		jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
		jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');

		// Validate JSON before parsing
		if (!jsonText || jsonText.length < 10) {
			console.error('   ⚠️  Empty response. Raw response:', response);
			throw new Error(`Empty or invalid response from Gemini: "${jsonText}"`);
		}

		const data = JSON.parse(jsonText);

		// Validate response structure
		if (!data.items || !Array.isArray(data.items)) {
			throw new Error('Invalid response structure: missing items array');
		}

		// Normalize store name
		const normalizedStore = normalizeStoreName(data.store || 'Receipt');

		console.log(`   ✅ Gemini extracted ${data.items.length} items`);
		return {
			success: true,
			store: normalizedStore,
			items: data.items,
			subtotal: data.subtotal || null,
			tax: data.tax || 0,
			total: data.total || null,
		};
	} catch (error) {
		console.error(`   ❌ Gemini extraction failed:`, error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Check if Gemini API is available and configured
 * @returns True if API key is set
 */
export function isGeminiAvailable(): boolean {
	return !!process.env.GOOGLE_GEMINI_API_KEY;
}
