import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Bills } from '/imports/api/bills';
import { GlobalUsers } from '/imports/api/users';
import { computeExpenseSummary } from '/imports/api/models';
import './dashboard.html';
import '/client/styles/dashboard.css';
import { pushAlert } from '../layout';

// Import OCR service
import { ocrService } from '/imports/services/ocr/ocrService.js';

/**
 * Compress and resize image for faster OCR processing
 * @param {string} imageDataUrl - Original image data URL
 * @param {number} maxWidth - Maximum width (default: 1600px)
 * @param {number} quality - JPEG quality (default: 0.85)
 * @returns {Promise<string>} - Compressed image data URL
 */
async function compressImage(imageDataUrl, maxWidth = 1600, quality = 0.85) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			// Calculate new dimensions
			let width = img.width;
			let height = img.height;

			if (width > maxWidth) {
				height = (height * maxWidth) / width;
				width = maxWidth;
			}

			// Create canvas and resize
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, width, height);

			// Convert to compressed JPEG
			resolve(canvas.toDataURL('image/jpeg', quality));
		};
		img.onerror = reject;
		img.src = imageDataUrl;
	});
}

/* ===== TEMPLATE LIFECYCLE ===== */

Template.Dashboard.onCreated(function () {
	this.subscribe('globalUsers.all');

	// Reactive variables
	this.ocrProcessing = new ReactiveVar(false);
	this.ocrProgress = new ReactiveVar(0);
	this.ocrStatus = new ReactiveVar('');
	this.showHelpInfo = new ReactiveVar(
		localStorage.getItem('splitly_showHelp') !== 'false',
	);
	this.actionLock = false;
});

Template.Dashboard.onDestroyed(function () {
	// Cleanup if needed
});

Template.Dashboard.onRendered(function () {
	const tpl = this;

	// Handle button disabled states
	this.autorun(() => {
		const isProcessing = tpl.ocrProcessing.get();
		Tracker.afterFlush(() => {
			const scanBtn = document.getElementById('scanReceiptBtn');
			const uploadBtn = document.getElementById('uploadReceiptBtn');
			if (scanBtn) {scanBtn.disabled = isProcessing;}
			if (uploadBtn) {uploadBtn.disabled = isProcessing;}
		});
	});
});

/* ===== TEMPLATE HELPERS ===== */

Template.Dashboard.helpers({
	showHelpInfo() {
		return Template.instance().showHelpInfo.get();
	},
	hasRecentBills() {
		return Bills.find().count() > 0;
	},
	recentBills() {
		return Bills.find({}, { sort: { createdAt: -1 }, limit: 1 })
			.fetch()
			.map(b => ({
				_id: b._id,
				createdAt: b.date || b.createdAt.toLocaleString(),
				total: computeExpenseSummary(b).grandTotal.toFixed(2),
				itemCount: b.items?.length || 0,
				userCount: b.users?.length || 0,
				storeName: b.storeName,
			}));
	},
	ocrProcessing() {
		return Template.instance().ocrProcessing.get();
	},
	ocrProgress() {
		return Template.instance().ocrProgress.get();
	},
	ocrStatus() {
		return Template.instance().ocrStatus.get() || 'Processing receipt...';
	},
});

/* ===== TEMPLATE EVENTS ===== */

Template.Dashboard.events({
	'click #addPeopleBtn'(e) {
		e.preventDefault();
		const modalEl = document.getElementById('userModal');
		if (!modalEl || !window.bootstrap?.Modal) {
			pushAlert('error', 'Modal not available');
			return;
		}
		try {
			const modal = new window.bootstrap.Modal(modalEl);
			modal.show();
		} catch (_error) {
			pushAlert('error', 'Failed to open modal');
		}
	},

	'click #hideHelpBtn'(e, tpl) {
		tpl.showHelpInfo.set(false);
		localStorage.setItem('splitly_showHelp', 'false');
	},

	'click #scanReceiptBtn'(e, tpl) {
		if (tpl.ocrProcessing.get() || tpl.actionLock) {return;}
		if (!GlobalUsers.find().count()) {
			pushAlert('error', 'Please add people first');
			return;
		}
		tpl.find('#scanFileInput').click();
	},

	'click #uploadReceiptBtn'(e, tpl) {
		if (tpl.ocrProcessing.get() || tpl.actionLock) {return;}
		if (!GlobalUsers.find().count()) {
			pushAlert('error', 'Please add people first');
			return;
		}
		tpl.find('#receiptFileInput').click();
	},

	async 'change #scanFileInput'(e, tpl) {
		await handleFileUpload(e, tpl);
	},

	async 'change #receiptFileInput'(e, tpl) {
		await handleFileUpload(e, tpl);
	},
});

/* ===== HELPER FUNCTIONS ===== */

async function handleFileUpload(e, tpl) {
	const file = e.target.files?.[0];
	if (!file) {return;}
	if (tpl.ocrProcessing.get()) {
		e.target.value = '';
		return;
	}

	// Validate file type
	const fileName = file.name.toLowerCase();
	const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' ||
		fileName.endsWith('.heic') || fileName.endsWith('.heif');

	if (isHEIC) {
		pushAlert('warning', 'HEIC format not supported. Please convert to JPEG/PNG first.');
		e.target.value = '';
		return;
	}
	if (!file.type.startsWith('image/')) {
		pushAlert('error', 'Please select an image file (JPEG, PNG, etc.)');
		e.target.value = '';
		return;
	}

	tpl.ocrProcessing.set(true);
	tpl.ocrProgress.set(0);
	tpl.ocrStatus.set('Loading image...');
	tpl.actionLock = true;
	pushAlert('info', 'Scanning receipt...');

	try {
		// Convert file to data URL
		tpl.ocrProgress.set(5);
		tpl.ocrStatus.set('Reading image file...');
		const reader = new window.FileReader();
		let imageData = await new Promise((resolve, reject) => {
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
		tpl.ocrProgress.set(10);

		// Compress image for faster processing (reduces API time by 30-50%)
		tpl.ocrStatus.set('Optimizing image...');
		imageData = await compressImage(imageData, 1600, 0.85);
		tpl.ocrProgress.set(15);

		// Run OCR with progress tracking
		tpl.ocrProgress.set(20);
		tpl.ocrStatus.set('Creating bill...');

		// Try Gemini AI first (faster and more accurate)
		try {
			const billId = await Meteor.callAsync('bills.insert', {
				createdAt: new Date(),
				users: GlobalUsers.find().fetch().map(u => ({ id: u._id, name: u.name })),
				items: [],
			});

			tpl.ocrProgress.set(30);
			tpl.ocrStatus.set('🤖 Analyzing receipt with AI...');

			// Simulate progress during Gemini processing (it doesn't provide progress callbacks)
			const progressInterval = window.setInterval(() => {
				const current = tpl.ocrProgress.get();
				if (current < 85) {
					tpl.ocrProgress.set(current + 15);
					// Update status messages during processing
					if (current < 45) {
						tpl.ocrStatus.set('🤖 AI reading receipt...');
					} else if (current < 70) {
						tpl.ocrStatus.set('📊 Extracting items...');
					} else {
						tpl.ocrStatus.set('💰 Calculating totals...');
					}
				}
			}, 800); // Update every 0.8 seconds for smoother progress

			try {
				// Try Gemini extraction
				const count = await Meteor.callAsync('ocr.extractFromImage', billId, imageData);

				// Clear progress interval
				window.clearInterval(progressInterval);

				tpl.ocrProgress.set(100);
				tpl.ocrStatus.set('✅ Receipt processed!');
				tpl.ocrProcessing.set(false);
				tpl.ocrProgress.set(0);
				tpl.actionLock = false;

				if (count > 0) {
					pushAlert('success', `✨ AI found ${count} item${count > 1 ? 's' : ''}!`);
				} else {
					pushAlert('warning', 'No items detected. Please add items manually.');
				}
				FlowRouter.go(`/split/${billId}`);
				e.target.value = '';
				return;
			} catch (_geminiError) {
				// Clear progress interval on error
				window.clearInterval(progressInterval);
				// Gemini not available, falling back to Tesseract
				tpl.ocrProgress.set(20);
				tpl.ocrStatus.set('⚠️ Switching to backup OCR...');
			}
		} catch (_outerError) {
			tpl.ocrProcessing.set(false);
			tpl.ocrProgress.set(0);
			tpl.ocrStatus.set('');
			tpl.actionLock = false;
			pushAlert('error', 'Failed to create bill. Please try again.');
			e.target.value = '';
			return;
		}

		// Fallback: Use Tesseract
		tpl.ocrStatus.set('📝 Reading receipt text...');
		const result = await ocrService.recognizeText(imageData, (progress) => {
			const currentProgress = tpl.ocrProgress.get();
			if (progress > currentProgress) {
				tpl.ocrProgress.set(progress);
				// Update status based on progress
				if (progress < 30) {
					tpl.ocrStatus.set('📝 Scanning receipt...');
				} else if (progress < 60) {
					tpl.ocrStatus.set('🔍 Recognizing text...');
				} else {
					tpl.ocrStatus.set('📊 Extracting items...');
				}
			}
		});

		if (!result.success) {
			tpl.ocrProcessing.set(false);
			tpl.ocrProgress.set(0);
			tpl.ocrStatus.set('');
			tpl.actionLock = false;
			pushAlert('error', 'Could not read receipt clearly. Please try:\n• Better lighting\n• Clearer photo\n• Or enter items manually');
			e.target.value = '';
			return;
		}

		try {
			// Create bill
			if (tpl.ocrProgress.get() < 75) {
				tpl.ocrProgress.set(75);
			}
			tpl.ocrStatus.set('💾 Saving data...');

			const billId = await Meteor.callAsync('bills.insert', {
				createdAt: new Date(),
				users: GlobalUsers.find().fetch().map(u => ({ id: u._id, name: u.name })),
				items: [],
			});

			try {
				tpl.ocrProgress.set(85);
				tpl.ocrStatus.set('🛒 Extracting items...');
				const count = await Meteor.callAsync('ocr.extract', billId, result.text);

				tpl.ocrProgress.set(100);
				tpl.ocrStatus.set('✅ Receipt processed!');
				tpl.ocrProcessing.set(false);
				tpl.ocrProgress.set(0);
				tpl.actionLock = false;

				if (count > 0) {
					pushAlert('success', `Found ${count} item${count > 1 ? 's' : ''}!`);
				} else {
					pushAlert('warning', 'No items detected. Please add items manually.');
				}
				FlowRouter.go(`/split/${billId}`);
			} catch (_err2) {
				tpl.ocrProcessing.set(false);
				tpl.ocrProgress.set(0);
				tpl.ocrStatus.set('');
				tpl.actionLock = false;
				pushAlert('error', 'Error extracting items. Please try again or add manually.');
			}
		} catch (_err) {
			tpl.ocrProcessing.set(false);
			tpl.ocrProgress.set(0);
			tpl.ocrStatus.set('');
			tpl.actionLock = false;
			pushAlert('error', 'Failed to create bill. Please try again.');
		}
	} catch (_err) {
		tpl.ocrProcessing.set(false);
		tpl.ocrProgress.set(0);
		tpl.ocrStatus.set('');
		tpl.actionLock = false;
		pushAlert('error', 'Failed to process image. Please try again.');
	} finally {
		e.target.value = '';
	}
}
