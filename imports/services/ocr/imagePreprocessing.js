/**
 * Image Preprocessing Service
 * Handles all image enhancement operations for OCR
 */

export class ImagePreprocessor {
	/**
	 * Apply comprehensive preprocessing to improve OCR accuracy
	 * @param {HTMLCanvasElement} canvas - Canvas containing the image
	 * @param {Object} options - Preprocessing options
	 * @returns {HTMLCanvasElement} - Processed canvas
	 */
	static preprocessForOCR(canvas, options = {}) {
		const { skipThreshold = false } = options;

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		const width = canvas.width;
		const height = canvas.height;
		const imageData = ctx.getImageData(0, 0, width, height);
		const pixels = imageData.data;

		// Apply preprocessing pipeline
		this._convertToGrayscale(pixels);
		this._enhanceContrast(pixels);
		this._sharpenImage(pixels, width, height);

		if (!skipThreshold) {
			this._applyAdaptiveThreshold(pixels, width, height);
		}

		ctx.putImageData(imageData, 0, 0);
		return canvas;
	}

	/**
	 * Scale image to optimal size for OCR
	 * @param {HTMLImageElement} imgEl - Source image
	 * @param {number} maxDimension - Maximum width or height
	 * @returns {HTMLCanvasElement} - Scaled canvas
	 */
	static scaleImage(imgEl, maxDimension = 2000) {
		let targetWidth = imgEl.width;
		let targetHeight = imgEl.height;

		if (targetWidth > maxDimension || targetHeight > maxDimension) {
			const scale = maxDimension / Math.max(targetWidth, targetHeight);
			targetWidth = Math.floor(targetWidth * scale);
			targetHeight = Math.floor(targetHeight * scale);
		}

		const canvas = document.createElement('canvas');
		canvas.width = targetWidth;
		canvas.height = targetHeight;

		const ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(imgEl, 0, 0, targetWidth, targetHeight);

		return canvas;
	}

	// Private helper methods

	static _convertToGrayscale(pixels) {
		for (let i = 0; i < pixels.length; i += 4) {
			const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
			pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
		}
	}

	static _enhanceContrast(pixels) {
		// Find min and max values
		let min = 255, max = 0;
		for (let i = 0; i < pixels.length; i += 4) {
			const val = pixels[i];
			if (val < min) {min = val;}
			if (val > max) {max = val;}
		}

		// Stretch histogram
		const range = max - min;
		if (range > 0) {
			for (let i = 0; i < pixels.length; i += 4) {
				const stretched = ((pixels[i] - min) / range) * 255;
				pixels[i] = pixels[i + 1] = pixels[i + 2] = stretched;
			}
		}
	}

	static _sharpenImage(pixels, width, height) {
		const sharpenKernel = [
			0, -1, 0,
			-1, 5, -1,
			0, -1, 0,
		];

		const tempData = new Uint8ClampedArray(pixels);

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				let sum = 0;
				for (let ky = -1; ky <= 1; ky++) {
					for (let kx = -1; kx <= 1; kx++) {
						const idx = ((y + ky) * width + (x + kx)) * 4;
						const kernelIdx = (ky + 1) * 3 + (kx + 1);
						sum += tempData[idx] * sharpenKernel[kernelIdx];
					}
				}
				const idx = (y * width + x) * 4;
				const sharpened = Math.max(0, Math.min(255, sum));
				pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = sharpened;
			}
		}
	}

	static _applyAdaptiveThreshold(pixels, width, height) {
		const blockSize = 15; // Reduced from 25 for finer detail
		const C = 5; // Reduced from 10 for less aggressive thresholding

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				// Calculate local mean in block
				let sum = 0;
				let count = 0;

				const yStart = Math.max(0, y - blockSize);
				const yEnd = Math.min(height, y + blockSize);
				const xStart = Math.max(0, x - blockSize);
				const xEnd = Math.min(width, x + blockSize);

				for (let by = yStart; by < yEnd; by++) {
					for (let bx = xStart; bx < xEnd; bx++) {
						sum += pixels[(by * width + bx) * 4];
						count++;
					}
				}

				const mean = sum / count;
				const idx = (y * width + x) * 4;
				const value = pixels[idx] > (mean - C) ? 255 : 0;
				pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = value;
			}
		}
	}
}
