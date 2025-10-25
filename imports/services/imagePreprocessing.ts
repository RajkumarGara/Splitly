import sharp from 'sharp';

/**
 * Image preprocessing service to improve OCR accuracy
 * Applies various transformations to enhance text readability
 */

/**
 * Preprocess image for better OCR results
 * @param imageBuffer - Original image buffer
 * @returns Processed image buffer optimized for OCR
 */
export async function preprocessImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
	try {
		console.log('📸 Starting image preprocessing...');

		// Get image metadata
		const metadata = await sharp(imageBuffer).metadata();
		console.log(`   Original: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

		// Apply preprocessing pipeline
		const processed = await sharp(imageBuffer)
			// 1. Resize if too large (keep aspect ratio)
			.resize({
				width: 2000,
				height: 2000,
				fit: 'inside',
				withoutEnlargement: true,
			})
			// 2. Convert to grayscale (improves text detection)
			.grayscale()
			// 3. Increase contrast and brightness
			.normalize() // Auto-adjust levels
			.linear(1.2, -(128 * 1.2) + 128) // Increase contrast by 20%
			// 4. Sharpen text
			.sharpen({
				sigma: 1,
				m1: 1.0,
				m2: 0.5,
			})
			// 5. Convert to high-quality PNG
			.png({
				compressionLevel: 0,
				quality: 100,
			})
			.toBuffer();

		console.log('   ✅ Preprocessing complete');
		return processed;
	} catch (error) {
		console.error('   ❌ Preprocessing failed:', error);
		// Return original buffer if preprocessing fails
		return imageBuffer;
	}
}

/**
 * Advanced preprocessing with adaptive thresholding
 * Use this for very poor quality images
 * @param imageBuffer - Original image buffer
 * @returns Processed image buffer
 */
export async function preprocessImageAdvanced(imageBuffer: Buffer): Promise<Buffer> {
	try {
		console.log('📸 Starting advanced preprocessing...');

		// First pass: basic cleanup
		const firstPass = await sharp(imageBuffer)
			.resize({
				width: 2500,
				height: 2500,
				fit: 'inside',
				withoutEnlargement: true,
			})
			.grayscale()
			.normalize()
			.toBuffer();

		// Second pass: aggressive sharpening and contrast
		const processed = await sharp(firstPass)
			.linear(1.5, -(128 * 1.5) + 128) // Stronger contrast
			.sharpen({
				sigma: 2,
				m1: 1.5,
				m2: 0.7,
			})
			// Apply slight blur to reduce noise before final sharpening
			.blur(0.3)
			.sharpen()
			.png({ quality: 100 })
			.toBuffer();

		console.log('   ✅ Advanced preprocessing complete');
		return processed;
	} catch (error) {
		console.error('   ❌ Advanced preprocessing failed:', error);
		return imageBuffer;
	}
}

/**
 * Auto-rotate image based on EXIF orientation
 * Many phones add rotation metadata instead of rotating pixels
 * @param imageBuffer - Original image buffer
 * @returns Rotated image buffer
 */
export async function autoRotateImage(imageBuffer: Buffer): Promise<Buffer> {
	try {
		return await sharp(imageBuffer).rotate().toBuffer();
	} catch (error) {
		console.error('Auto-rotate failed:', error);
		return imageBuffer;
	}
}
