/**
 * OCR Service
 * Handles Tesseract.js OCR processing with image preprocessing
 */

import Tesseract from 'tesseract.js';
import { ImagePreprocessor } from './imagePreprocessing.js';

export class OCRService {
	constructor() {
		this.worker = null;
	}

	/**
	 * Process image with OCR - tries multiple preprocessing strategies
	 * @param {string} imageData - Base64 image data
	 * @param {Function} progressCallback - Progress callback (percentage: number)
	 * @returns {Promise<{text: string, confidence: number, success: boolean}>}
	 */
	async recognizeText(imageData, progressCallback = null) {
		try {
			// Load and scale image
			const imgEl = await this._loadImage(imageData);
			if (progressCallback) {progressCallback(10);}

			const scaledCanvas = ImagePreprocessor.scaleImage(imgEl, 1800);
			if (progressCallback) {progressCallback(15);}

			// Create preprocessing variations
			const minimalCanvas = this._cloneCanvas(scaledCanvas);
			const processed1 = ImagePreprocessor.preprocessForOCR(minimalCanvas, { skipThreshold: true });

			const thresholdCanvas = this._cloneCanvas(scaledCanvas);
			const processed2 = ImagePreprocessor.preprocessForOCR(thresholdCanvas, { skipThreshold: false });

			if (progressCallback) {progressCallback(20);}

			// Configure Tesseract
			const worker = await Tesseract.createWorker('eng', 1, {
				logger: m => {
					if (m.status === 'recognizing text' && progressCallback) {
						const progress = 20 + Math.floor(m.progress * 45);
						progressCallback(progress);
					}
				},
			});

			await worker.setParameters({
				tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
				preserve_interword_spaces: '1',
				tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,:%&/-() ',
			});

			// Try strategies: minimal preprocessing first (fastest), then original, then threshold
			const strategies = [
				{ canvas: processed1, name: 'minimal' },
				{ canvas: scaledCanvas, name: 'original' },
				{ canvas: processed2, name: 'threshold' },
			];

			let bestResult = null;
			let bestScore = -1;

			for (const strategy of strategies) {
				const result = await worker.recognize(strategy.canvas);
				const conf = result.data.confidence || 0;
				const text = result.data.text || '';
				const len = text.length;

				// Score based on: confidence, text length, and number of price patterns found
				const priceMatches = text.match(/\$?\d+\.\d{2}/g) || [];
				const priceCount = priceMatches.length;
				const score = conf * Math.sqrt(len) * (1 + priceCount * 2);

				if (score > bestScore && len >= 30) {
					bestScore = score;
					bestResult = { data: result.data, name: strategy.name };
				}

				// Early exit on excellent results
				if (conf > 70 && priceCount >= 3 && len >= 100) {
					break;
				}
			}

			await worker.terminate();

			if (!bestResult) {
				throw new Error('All OCR strategies failed to produce valid results');
			}

			if (progressCallback) {progressCallback(70);}

			const text = bestResult.data.text || '';
			const confidence = bestResult.data.confidence || 0;
			const success = text.length >= 30 && confidence >= 15;

			return { text, confidence, success };
		} catch (err) {
			console.error('OCR error:', err);
			return {
				text: '',
				confidence: 0,
				success: false,
				error: err.message,
			};
		}
	}

	_cloneCanvas(canvas) {
		const clone = document.createElement('canvas');
		clone.width = canvas.width;
		clone.height = canvas.height;
		const ctx = clone.getContext('2d');
		ctx.drawImage(canvas, 0, 0);
		return clone;
	}

	/**
	 * Load image from data URL
	 * @param {string} dataUrl - Image data URL
	 * @returns {Promise<HTMLImageElement>}
	 * @private
	 */
	_loadImage(dataUrl) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = (_err) => reject(new Error('Failed to load image'));
			img.src = dataUrl;
		});
	}
}

// Singleton instance
export const ocrService = new OCRService();
