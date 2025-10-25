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
			// Load image
			const imgEl = await this._loadImage(imageData);

		if (progressCallback) {progressCallback(10);}
		console.log('OCR: Starting preprocessing...');

		// Scale to optimal size for OCR (balance between quality and speed)
		const scaledCanvas = ImagePreprocessor.scaleImage(imgEl, 1800);
		if (progressCallback) {progressCallback(15);}		console.log('OCR: Trying multiple preprocessing strategies...');

		// Strategy 1: Minimal preprocessing (best for good quality images)
		const minimalCanvas = this._cloneCanvas(scaledCanvas);
		const processed1 = ImagePreprocessor.preprocessForOCR(minimalCanvas, { skipThreshold: true });

		// Strategy 2: With adaptive thresholding (best for poor lighting)
		const thresholdCanvas = this._cloneCanvas(scaledCanvas);
		const processed2 = ImagePreprocessor.preprocessForOCR(thresholdCanvas, { skipThreshold: false });

		// Strategy 3: Original with just scaling (sometimes works best)
		const processed3 = scaledCanvas;

		if (progressCallback) {progressCallback(20);}

		// Run OCR with strategies (stop early if we get a good result)
		console.log('OCR: Running text recognition with smart strategy selection...');

		const worker = await Tesseract.createWorker('eng', 1, {
			logger: m => {
				if (m.status === 'recognizing text' && progressCallback) {
					const progress = 20 + Math.floor(m.progress * 45);
					progressCallback(progress);
				}
			},
		});

		// Configure for receipt recognition with optimal settings
		await worker.setParameters({
			tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
			preserve_interword_spaces: '1',
			tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,:%&/-() ',
		});

		// Try strategies in order of speed/likelihood
		const strategies = [
			{ canvas: processed1, name: 'minimal' },
			{ canvas: processed3, name: 'original' },
			{ canvas: processed2, name: 'threshold' },
		];

		let bestResult = null;
		let bestScore = -1;

		for (const strategy of strategies) {
			console.log(`OCR: Trying strategy - ${strategy.name}`);
			const result = await worker.recognize(strategy.canvas);
			
			const conf = result.data.confidence || 0;
			const len = (result.data.text || '').length;
			const text = result.data.text || '';

			// Count number of price patterns (better indicator of quality)
			const priceMatches = text.match(/\$?\d+\.\d{2}/g) || [];
			const priceCount = priceMatches.length;

			// Score = confidence * text length * price count weight
			const score = conf * Math.sqrt(len) * (1 + priceCount * 2);

			console.log(`Strategy ${strategy.name}:`, len, 'chars,', conf.toFixed(1), '% conf,', priceCount, 'prices, score:', score.toFixed(1));

			if (score > bestScore && len >= 30) {
				bestScore = score;
				bestResult = { data: result.data, name: strategy.name };
			}

			// Early exit if we got excellent results (high confidence + prices found)
			if (conf > 70 && priceCount >= 3 && len >= 100) {
				console.log('OCR: Excellent result found, stopping early!');
				break;
			}
		}

		await worker.terminate();

		if (!bestResult) {
			throw new Error('All OCR strategies failed to produce valid results');
		}

		console.log(`OCR: Best strategy was "${bestResult.name}" with score ${bestScore.toFixed(1)}`);
		if (progressCallback) {progressCallback(70);}

		const text = bestResult.data.text || '';
		const confidence = bestResult.data.confidence || 0;

		console.log('===== OCR RESULTS =====');
		console.log('SELECTED STRATEGY:', bestResult.name);
		console.log('Text length:', text.length);
		console.log('Confidence:', confidence.toFixed(1), '%');
		console.log('Text preview:', text.substring(0, 250));

			// Success if we have reasonable text
			const success = text.length >= 30 && confidence >= 15;

			return {
				text,
				confidence,
				success,
			};
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
