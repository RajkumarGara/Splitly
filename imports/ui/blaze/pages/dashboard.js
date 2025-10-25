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

/* ===== TEMPLATE LIFECYCLE ===== */

Template.Dashboard.onCreated(function () {
	this.subscribe('globalUsers.all');

	// Reactive variables
	this.ocrProcessing = new ReactiveVar(false);
	this.ocrProgress = new ReactiveVar(0);
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
				createdAt: b.createdAt.toLocaleString(),
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
		} catch (error) {
			console.error('Error opening modal:', error);
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
		pushAlert('warning', 'HEIC format detected. Please convert to JPEG first.');
		e.target.value = '';
		return;
	}
	if (!file.type.startsWith('image/')) {
		pushAlert('error', 'Please upload an image file');
		e.target.value = '';
		return;
	}

	tpl.ocrProcessing.set(true);
	tpl.ocrProgress.set(0);
	tpl.actionLock = true;
	pushAlert('info', 'Reading receipt with OCR...');

	try {
		// Convert file to data URL for OCR service
		tpl.ocrProgress.set(5);
		const reader = new window.FileReader();
		const imageData = await new Promise((resolve, reject) => {
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
		tpl.ocrProgress.set(10);

		// Use OCR service with multiple strategies and progress callback
		// Only allow progress to increase, never decrease
		const result = await ocrService.recognizeText(imageData, (progress) => {
			const currentProgress = tpl.ocrProgress.get();
			if (progress > currentProgress) {
				tpl.ocrProgress.set(progress);
			}
		});

		if (!result.success) {
			tpl.ocrProcessing.set(false);
			tpl.ocrProgress.set(0);
			tpl.actionLock = false;
			pushAlert('error', 'Could not read receipt. Please try again or enter items manually.');
			e.target.value = '';
			return;
		}

		try {
			// Ensure we're at least at 75%
			if (tpl.ocrProgress.get() < 75) {
				tpl.ocrProgress.set(75);
			}
			const billId = await Meteor.callAsync('bills.insert', {
				createdAt: new Date(),
				users: GlobalUsers.find().fetch().map(u => ({ id: u._id, name: u.name })),
				items: [],
			});

			try {
				tpl.ocrProgress.set(85);
				const count = await Meteor.callAsync('ocr.extract', billId, result.text);
				tpl.ocrProgress.set(100);
				tpl.ocrProcessing.set(false);
				tpl.ocrProgress.set(0);
				tpl.actionLock = false;

				if (count > 0) {
					pushAlert('success', `Extracted ${count} item${count > 1 ? 's' : ''}!`);
				} else {
					pushAlert('warning', 'No items found. Please add items manually.');
				}
				FlowRouter.go(`/split/${billId}`);
			} catch (err2) {
				tpl.ocrProcessing.set(false);
				tpl.ocrProgress.set(0);
				tpl.actionLock = false;
				pushAlert('error', err2.reason || 'Could not parse items from receipt');
			}
		} catch (err) {
			tpl.ocrProcessing.set(false);
			tpl.ocrProgress.set(0);
			tpl.actionLock = false;
			pushAlert('error', err.reason || 'Failed to create bill');
		}
	} catch (err) {
		console.error('OCR error:', err);
		tpl.ocrProcessing.set(false);
		tpl.ocrProgress.set(0);
		tpl.actionLock = false;
		pushAlert('error', 'OCR failed to read the image');
	} finally {
		e.target.value = '';
	}
}
