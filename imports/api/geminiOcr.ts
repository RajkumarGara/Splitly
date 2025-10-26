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
		{ pattern: /HALAL/i, name: 'Halal' },
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
 * Estimate optimal starting maxOutputTokens based on image size
 * @param base64Image - Base64 encoded image
 * @returns Recommended starting maxOutputTokens value
 */
function estimateStartingTokens(base64Image: string): number {
	// Remove data URI prefix if present
	const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

	// Estimate based on image size (larger image = more items likely)
	const sizeKB = (imageData.length * 3) / 4 / 1024;

	// Start with appropriate tier, leaving room to scale up if needed
	if (sizeKB < 100) {return 2048;}  // Small receipt
	if (sizeKB < 300) {return 4096;}  // Medium receipt
	if (sizeKB < 600) {return 6144;}  // Large receipt
	return 8192;  // Extra large receipt
}

/**
 * Internal extraction with adaptive token retry
 * @param base64Image - Base64 encoded image (with or without data URI prefix)
 * @param maxTokens - Maximum output tokens for this attempt
 * @param attempt - Current attempt number
 * @returns Parsed receipt data with items and totals
 */
async function extractWithTokens(
	base64Image: string,
	maxTokens: number,
	attempt: number = 1,
): Promise<{
	success: boolean;
	store?: string;
	date?: string;
	items?: Array<{ name: string; price: number }>;
	subtotal?: number;
	tax?: number;
	total?: number;
	error?: string;
}> {
	const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

	if (!apiKey) {
		return { success: false, error: 'API key not configured' };
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({
		model: 'gemini-2.5-flash',
		generationConfig: {
			temperature: 0.1,
			topP: 0.95,
			topK: 40,
			maxOutputTokens: maxTokens,
		},
	});

	// Remove data URI prefix if present
	const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

	// Optimized shorter prompt for faster processing
	const prompt = `Extract receipt data. Output ONLY valid JSON, no explanations.

Rules:
- Clean item names (remove codes/numbers)
- 2 decimal prices
- Apply discounts (lines with "-")
- Skip quantity calculations
- Get subtotal, tax, total
- Extract date and time from receipt (MUST include AM/PM if present)

Format:
{"store":"Name","date":"MM/DD/YYYY HH:MM:SS AM/PM","items":[{"name":"Item","price":12.99}],"subtotal":100.00,"tax":1.33,"total":101.33}`;

	const result = await model.generateContent([
		prompt,
		{
			inlineData: {
				data: imageData,
				mimeType: 'image/jpeg',
			},
		},
	]);

	// Check for blocked content or safety issues
	const candidates = result.response.candidates;
	if (!candidates || candidates.length === 0) {
		throw new Error('No response candidates from Gemini API');
	}

	const finishReason = candidates[0].finishReason;

	// Handle MAX_TOKENS with adaptive retry
	if (finishReason === 'MAX_TOKENS') {
		const nextTokens = Math.min(maxTokens * 2, 8192);

		if (nextTokens > maxTokens && attempt < 3) {
			return extractWithTokens(base64Image, nextTokens, attempt + 1);
		} else {
			throw new Error('Response exceeded max tokens even at 8192 (receipt too complex)');
		}
	}

	if (finishReason !== 'STOP') {
		if (finishReason === 'SAFETY') {
			throw new Error('Content blocked by safety filters');
		}
		throw new Error(`Unexpected finish reason: ${finishReason}`);
	}

	const response = result.response.text();

	// Clean response (remove markdown code blocks if present)
	let jsonText = response.trim();
	jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
	jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');

	// Validate JSON before parsing
	if (!jsonText || jsonText.length < 10) {
		throw new Error('Empty or invalid response from Gemini');
	}

	const data = JSON.parse(jsonText);

	// Validate response structure
	if (!data.items || !Array.isArray(data.items)) {
		throw new Error('Invalid response structure: missing items array');
	}

	// Normalize store name
	const normalizedStore = normalizeStoreName(data.store || 'Receipt');

	return {
		success: true,
		store: normalizedStore,
		date: data.date || null,
		items: data.items,
		subtotal: data.subtotal || null,
		tax: data.tax || 0,
		total: data.total || null,
	};
}

/**
 * Extract receipt data using Gemini AI vision with adaptive token scaling
 * @param base64Image - Base64 encoded image (with or without data URI prefix)
 * @returns Parsed receipt data with items and totals
 */
export async function extractReceiptWithGemini(base64Image: string): Promise<{
	success: boolean;
	store?: string;
	date?: string;
	items?: Array<{ name: string; price: number }>;
	subtotal?: number;
	tax?: number;
	total?: number;
	error?: string;
}> {
	const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

	if (!apiKey) {
		return { success: false, error: 'API key not configured' };
	}

	try {
		// Estimate optimal starting tokens based on image size
		const startingTokens = estimateStartingTokens(base64Image);
		const result = await extractWithTokens(base64Image, startingTokens);
		return result;
	} catch (error) {
		console.error('Gemini extraction failed:', error instanceof Error ? error.message : 'Unknown error');
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
