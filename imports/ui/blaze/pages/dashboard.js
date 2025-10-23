import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Bills } from '/imports/api/bills';
import { GlobalUsers } from '/imports/api/users';
import { computeExpenseSummary } from '/imports/api/models';
import './dashboard.html';
import { pushAlert } from '../layout';
import Tesseract from 'tesseract.js';

Template.Dashboard.onCreated(function () {
	this.subscribe('globalUsers.all');
	this.ocrProcessing = new ReactiveVar(false);
	this.cameraActive = new ReactiveVar(false);
	this.capturedImage = new ReactiveVar(null);
	this.ocrRunning = new ReactiveVar(false);
	this.ocrProgress = new ReactiveVar(0);
	this.captureBillId = new ReactiveVar(null);
	this.mediaStream = null;
	const savedPref = localStorage.getItem('splitly_showHelp');
	this.showHelpInfo = new ReactiveVar(savedPref === null ? true : savedPref === 'true');
	this.actionLock = false;
	this.autorun(() => {
		const routeName = FlowRouter.current()?.route?.name;
		if (routeName !== 'dashboard' && this.mediaStream) {
			try {
				this.mediaStream.getTracks().forEach(t => t.stop());
			} catch {
				/* ignore */
			}
			this.mediaStream = null;
			this.cameraActive.set(false);
		}
	});
});

Template.Dashboard.onRendered(function () {
	const tpl = this;
	// Handle disabled state for buttons based on reactive state
	this.autorun(() => {
		const isProcessing = tpl.ocrProcessing.get();
		Tracker.afterFlush(() => {
			const scanBtn = document.getElementById('scanBillBtn');
			const uploadBtn = document.getElementById('uploadReceiptBtn');
			if (scanBtn) {
				scanBtn.disabled = isProcessing;
			}
			if (uploadBtn) {
				uploadBtn.disabled = isProcessing;
			}
		});
	});
});

Template.Dashboard.helpers({
	showHelpInfo() {
		return Template.instance().showHelpInfo.get();
	},
	hasRecentBills() {
		return Bills.find().count() > 0;
	},
	recentBills() {
		return Bills.find({}, { sort: { createdAt: -1 }, limit: 3 }).fetch().map(b => ({ _id: b._id, createdAt: b.createdAt.toLocaleString(), total: computeExpenseSummary(b).grandTotal.toFixed(2), itemCount: b.items?.length || 0, userCount: b.users?.length || 0 }));
	},
	ocrProcessing() {
		return Template.instance().ocrProcessing.get();
	},
	cameraActive() {
		return Template.instance().cameraActive.get();
	},
	capturedImage() {
		return Template.instance().capturedImage.get();
	},
	ocrRunning() {
		return Template.instance().ocrRunning.get();
	},
	ocrProgress() {
		return Template.instance().ocrProgress.get();
	},
});

Template.Dashboard.events({
	'click #addPeopleBtn'(e, _tpl) {
		e.preventDefault();
		const modalEl = document.getElementById('userModal');
		if (!modalEl) {
			console.error('UserModal element not found');
			pushAlert('error', 'Modal not available');
			return;
		}
		if (!window.bootstrap || !window.bootstrap.Modal) {
			console.error('Bootstrap Modal not available');
			pushAlert('error', 'Bootstrap not loaded');
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
	'click #showHelpBtn'(e, tpl) {
		tpl.showHelpInfo.set(true);
		localStorage.setItem('splitly_showHelp', 'true');
	},
	'click #hideHelpBtn'(e, tpl) {
		tpl.showHelpInfo.set(false);
		localStorage.setItem('splitly_showHelp', 'false');
	},
	'click #uploadReceiptBtn'(e, tpl) {
		if (tpl.ocrProcessing.get() || tpl.actionLock) {
			return;
		}
		if (!GlobalUsers.find().count()) {
			pushAlert('error', 'Please add people first');
			return;
		}
		tpl.find('#receiptFileInput').click();
	},
	async 'change #receiptFileInput'(e, tpl) {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		if (tpl.ocrProcessing.get()) {
			e.target.value = '';
			return;
		}
		const fileName = file.name.toLowerCase();
		const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || fileName.endsWith('.heic') || fileName.endsWith('.heif');
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
		tpl.actionLock = true;
		pushAlert('info', 'Reading receipt with OCR...');
		try {
			const result = await Tesseract.recognize(file, 'eng');
			const text = result.data.text;
			try {
				const billId = await Meteor.callAsync('bills.insert', { createdAt: new Date(), users: GlobalUsers.find().fetch().map(u => ({ id: u._id, name: u.name })), items: [] });
				try {
					const count = await Meteor.callAsync('ocr.extract', billId, text);
					tpl.ocrProcessing.set(false);
					tpl.actionLock = false;
					if (count > 0) {
						pushAlert('success', `Extracted ${count} item${count > 1 ? 's' : ''}!`);
					} else {
						pushAlert('warning', 'No items found. Please add items manually.');
					}
					FlowRouter.go(`/split/${billId}`);
				} catch (err2) {
					tpl.ocrProcessing.set(false);
					tpl.actionLock = false;
					pushAlert('error', err2.reason || 'Could not parse items from receipt');
				}
			} catch (err) {
				pushAlert('error', err.reason || 'Could not create receipt');
				tpl.ocrProcessing.set(false);
				tpl.actionLock = false;
			}
		} catch (error) {
			console.error('OCR Error:', error);
			pushAlert('error', 'Failed to read receipt.');
			tpl.ocrProcessing.set(false);
			tpl.actionLock = false;
		}
		e.target.value = '';
	},
	async 'click #scanBillBtn'(e, tpl) {
		if (tpl.cameraActive.get() || tpl.actionLock) {
			return;
		}
		if (!GlobalUsers.find().count()) {
			pushAlert('error', 'Please add people first');
			return;
		}
		tpl.actionLock = true;
		try {
			const billId = await Meteor.callAsync('bills.insert', { createdAt: new Date(), users: GlobalUsers.find().fetch().map(u => ({ id: u._id, name: u.name })), items: [] });
			tpl.captureBillId.set(billId);
			tpl.cameraActive.set(true);
			tpl.capturedImage.set(null);
			tpl.ocrRunning.set(false);
			tpl.ocrProgress.set(0);
			navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
				tpl.mediaStream = stream;
				const videoEl = tpl.find('#receiptVideo');
				if (videoEl) {
					videoEl.srcObject = stream;
				}
				tpl.actionLock = false;
			}).catch(async () => {
				pushAlert('error', 'Camera access denied');
				tpl.cameraActive.set(false);
				await Meteor.callAsync('bills.remove', billId);
				tpl.actionLock = false;
			});
		} catch (err) {
			pushAlert('error', err.reason || 'Could not create receipt');
			tpl.actionLock = false;
		}
	},
	'click #cancelCaptureBtn'(e, tpl) {
		tpl.actionLock = false;
		const billId = tpl.captureBillId.get();
		if (tpl.mediaStream) {
			tpl.mediaStream.getTracks().forEach(t => t.stop());
			tpl.mediaStream = null;
		}
		if (!tpl.ocrRunning.get() && billId) {
			Meteor.call('bills.remove', billId);
		}
		tpl.cameraActive.set(false);
		tpl.capturedImage.set(null);
		tpl.ocrRunning.set(false);
		tpl.ocrProgress.set(0);
		tpl.captureBillId.set(null);
	},
	'click #captureFrameBtn'(e, tpl) {
		if (tpl.actionLock) {
			return;
		}
		tpl.actionLock = true;
		const videoEl = tpl.find('#receiptVideo');
		if (!videoEl) {
			pushAlert('error', 'Video element missing');
			tpl.actionLock = false;
			return;
		}
		try {
			if (!videoEl.videoWidth || !videoEl.videoHeight) {
				pushAlert('info', 'Initializing camera...');
				setTimeout(() => {
					if (!videoEl.videoWidth) {
						pushAlert('error', 'Camera not ready');
						tpl.actionLock = false;
						return;
					}
					const canvas = document.createElement('canvas');
					canvas.width = videoEl.videoWidth;
					canvas.height = videoEl.videoHeight;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(videoEl, 0, 0);
					if (tpl.mediaStream) {
						tpl.mediaStream.getTracks().forEach(t => t.stop());
						tpl.mediaStream = null;
					}
					tpl.capturedImage.set(canvas.toDataURL('image/jpeg', 0.88));
					tpl.actionLock = false;
				}, 800);
				return;
			}
			const canvas = document.createElement('canvas');
			canvas.width = videoEl.videoWidth;
			canvas.height = videoEl.videoHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(videoEl, 0, 0);
			if (tpl.mediaStream) {
				tpl.mediaStream.getTracks().forEach(t => t.stop());
				tpl.mediaStream = null;
			}
			tpl.capturedImage.set(canvas.toDataURL('image/jpeg', 0.92));
			tpl.actionLock = false;
		} catch (ex) {
			pushAlert('error', ex.message || 'Capture failed');
			tpl.actionLock = false;
		}
	},
	'click #retakeBtn'(e, tpl) {
		if (tpl.actionLock) {
			return;
		}
		tpl.actionLock = true;
		tpl.capturedImage.set(null);
		tpl.ocrRunning.set(false);
		tpl.ocrProgress.set(0);
		navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
			tpl.mediaStream = stream;
			const videoEl = tpl.find('#receiptVideo');
			if (videoEl) {
				videoEl.srcObject = stream;
			}
			tpl.actionLock = false;
		}).catch(() => {
			pushAlert('error', 'Camera access denied');
			tpl.cameraActive.set(false);
			tpl.actionLock = false;
		});
	},
	'click #continueOcrBtn'(e, tpl) {
		if (tpl.actionLock) {
			return;
		}
		tpl.actionLock = true;
		const imgData = tpl.capturedImage.get();
		const billId = tpl.captureBillId.get();
		if (!imgData || !billId) {
			pushAlert('error', 'Nothing captured');
			tpl.actionLock = false;
			return;
		}
		tpl.ocrRunning.set(true);
		tpl.ocrProgress.set(0);
		const prepCanvas = document.createElement('canvas');
		const imgEl = new Image();
		imgEl.onload = async () => {
			try {
				// Stage 1: Image preprocessing (0-20%)
				console.log('OCR Progress: 10% - Starting preprocessing');
				tpl.ocrProgress.set(10);
				await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to see progress
				
				const scale = 2.0;
				prepCanvas.width = Math.floor(imgEl.width * scale);
				prepCanvas.height = Math.floor(imgEl.height * scale);
				const pctx = prepCanvas.getContext('2d');
				pctx.drawImage(imgEl, 0, 0, prepCanvas.width, prepCanvas.height);
				
				console.log('OCR Progress: 15% - Scaling image');
				tpl.ocrProgress.set(15);
				await new Promise(resolve => setTimeout(resolve, 100));
				
				const imageData = pctx.getImageData(0, 0, prepCanvas.width, prepCanvas.height);
				const d = imageData.data;
				
				// Convert to grayscale and enhance contrast
				for (let i = 0; i < d.length; i += 4) {
					const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
					// Increase contrast
					const contrast = 1.5;
					const factor = (259 * (contrast + 1)) / (259 - contrast);
					const enhanced = factor * (gray - 128) + 128;
					const clamped = Math.max(0, Math.min(255, enhanced));
					d[i] = d[i + 1] = d[i + 2] = clamped;
				}
				pctx.putImageData(imageData, 0, 0);
				console.log('OCR Progress: 20% - Preprocessing complete');
				tpl.ocrProgress.set(20);
				await new Promise(resolve => setTimeout(resolve, 100));
				
				// Stage 2: OCR text recognition (20-70%)
				console.log('OCR Progress: 20% - Starting text recognition');
				const worker = await Tesseract.createWorker('eng', 1, {
					logger: m => {
						console.log('Tesseract logger:', m);
						if (m.status === 'recognizing text') {
							// Map Tesseract progress (0-1) to our range (20-70%)
							const progress = 20 + Math.floor(m.progress * 50);
							console.log('OCR Progress:', progress + '% - Recognizing text');
							tpl.ocrProgress.set(progress);
						}
					}
				});
				
				const { data } = await worker.recognize(prepCanvas);
				console.log('OCR Progress: 70% - Text recognition complete');
				tpl.ocrProgress.set(70);
				await new Promise(resolve => setTimeout(resolve, 100));
				
				let text = (data.text || '').toUpperCase();
				console.log('OCR Text extracted:', text);
				console.log('OCR Text length:', text.length);
				
				// Stage 3: Parsing items (70-90%)
				console.log('OCR Progress: 75% - Parsing items');
				tpl.ocrProgress.set(75);
				await new Promise(resolve => setTimeout(resolve, 100));
				
				try {
					const count = await Meteor.callAsync('ocr.extract', billId, text);
					console.log('OCR extract returned count:', count);
					console.log('OCR Progress: 90% - Items extracted');
					tpl.ocrProgress.set(90);
					await new Promise(resolve => setTimeout(resolve, 100));
					
					// Stage 4: Complete (90-100%)
					console.log('OCR Progress: 100% - Complete!');
					tpl.ocrProgress.set(100);
					await new Promise(resolve => setTimeout(resolve, 500)); // Longer pause to show 100%
					
					tpl.ocrRunning.set(false);
					tpl.actionLock = false;
					if (count > 0) {
						pushAlert('success', `Extracted ${count} item${count > 1 ? 's' : ''}`);
						tpl.cameraActive.set(false);
						tpl.capturedImage.set(null);
						tpl.captureBillId.set(null);
						FlowRouter.go(`/split/${billId}`);
					} else {
						// Try fallback parser with universal price extraction
						console.log('No items extracted by OCR, trying fallback parser');
						const fallbackLines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
						console.log('Fallback lines:', fallbackLines.length);
						const simpleItems = [];
						
						for (const line of fallbackLines) {
							// Skip header/footer lines
							if (line.match(/^(SUBTOTAL|TAX|TOTAL|BALANCE|CHANGE|VISA|CREDIT|DEBIT|CASH|STORE|CASHIER|DATE|TIME|SELF-CHECKOUT)/i)) {
								continue;
							}
							
							// Universal price patterns
							const patterns = [
								/[$§](\d+)[.\s](\d{2})/,  // $1.48 or $1 48
								/\b(\d{1,4})\.(\d{2})\s*[A-Z]?\s*[A-Z]?$/,  // 4.99 N F
								/\b(\d{1,4})\.(\d{2})\s*$/  // 4.99
							];
							
							let matched = false;
							for (const pattern of patterns) {
								const matches = Array.from(line.matchAll(new RegExp(pattern.source, 'g')));
								// Get the last (rightmost) price match
								const m = matches.length > 0 ? matches[matches.length - 1] : null;
								if (m) {
									let price;
									if (m[0].includes('$') || m[0].includes('§')) {
										price = parseInt(m[1]) + parseInt(m[2]) / 100;
									} else {
										price = parseFloat(m[1] + '.' + m[2]);
									}
									
									if (price > 0.10 && price < 2000) {
										const pricePos = m.index || 0;
										let name = line.substring(0, pricePos).trim();
										name = name.replace(/^[E0-9\/\s]+/, '').replace(/\s{2,}/g, ' ').trim();
										
										if (name.length >= 3 && name.length <= 60) {
											console.log('Fallback matched:', { line, name, price });
											simpleItems.push({ id: `fb${Date.now()}_${simpleItems.length}`, name, price });
											matched = true;
											break;
										}
									}
								}
							}
						}
						console.log('Fallback found items:', simpleItems.length);
						if (simpleItems.length) {
							const existing = Bills.findOne(billId);
							const users = existing?.users || [];
							const mapped = simpleItems.map(i => ({ id: i.id, name: i.name, price: i.price, userIds: users.map(u => u.id), splitType: 'equal' }));
							await Meteor.callAsync('bills.updateItems', billId, [...(existing?.items || []), ...mapped]);
							pushAlert('warning', `OCR fallback added ${mapped.length} item${mapped.length > 1 ? 's' : ''}`);
							tpl.cameraActive.set(false);
							tpl.capturedImage.set(null);
							tpl.captureBillId.set(null);
							FlowRouter.go(`/split/${billId}`);
						} else {
							pushAlert('warning', 'No items found. Please add manually.');
							tpl.cameraActive.set(false);
							tpl.capturedImage.set(null);
							tpl.captureBillId.set(null);
							FlowRouter.go(`/split/${billId}`);
						}
					}
				} catch (err2) {
					tpl.ocrRunning.set(false);
					tpl.ocrProgress.set(0);
					tpl.actionLock = false;
					pushAlert('error', err2.reason || 'Could not parse items');
				}
			} catch (err) {
				tpl.ocrRunning.set(false);
				tpl.ocrProgress.set(0);
				console.error('OCR worker error', err);
				pushAlert('error', 'OCR failed');
				tpl.actionLock = false;
			} finally {
				try {
					await worker.terminate();
				} catch {
					/* ignore */
				}
			}
		};
		imgEl.onerror = () => {
			tpl.ocrRunning.set(false);
			tpl.ocrProgress.set(0);
			pushAlert('error', 'Could not load captured image');
			tpl.actionLock = false;
		};
		imgEl.src = imgData;
	},
});
