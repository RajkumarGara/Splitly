import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { GroceryLists } from '/imports/api/groceries';
import { pushAlert, showConfirm } from '../layout';
import './groceryList.html';
import '/client/styles/groceryList.css';

// Import Sortable.js for drag and drop
let Sortable = null;

Template.GroceryList.onCreated(function() {
	this.subscribe('groceryList');
	this.currentStoreId = new ReactiveVar(null);

	// Load Sortable.js dynamically
	if (typeof window !== 'undefined' && !window.Sortable) {
		import('sortablejs').then(module => {
			Sortable = module.default;
			this.autorun(() => {
				if (this.subscriptionsReady()) {
					Meteor.defer(() => this.initSortable());
				}
			});
		});
	}
});

Template.GroceryList.onRendered(function() {
	this.initSortable = () => {
		if (!Sortable) {return;}

		// Initialize store sorting
		const storesContainer = document.getElementById('storesContainer');
		if (storesContainer && !storesContainer._sortableInstance) {
			storesContainer._sortableInstance = new Sortable(storesContainer, {
				animation: 150,
				handle: '.store-drag-handle',
				ghostClass: 'sortable-ghost',
				forceFallback: false,
				fallbackTolerance: 5,
				touchStartThreshold: 5,
				delay: 200,
				delayOnTouchOnly: true,
				onEnd: async (evt) => {
					if (evt.oldIndex === evt.newIndex) {return;}

					const storeOrders = Array.from(storesContainer.children).map((el, index) => ({
						id: el.dataset.storeId,
						order: index,
					}));

					try {
						await Meteor.callAsync('groceries.updateStoreOrder', storeOrders);
					} catch (error) {
						pushAlert('error', error.reason || 'Failed to reorder stores');
					}
				},
			});
		}

		// Initialize item sorting for each store
		const itemsContainers = document.querySelectorAll('.items-container');
		itemsContainers.forEach(container => {
			if (!container._sortableInstance) {
				container._sortableInstance = new Sortable(container, {
					group: 'items',
					animation: 150,
					handle: '.item-drag-handle',
					ghostClass: 'sortable-ghost',
					forceFallback: false,
					fallbackTolerance: 5,
					touchStartThreshold: 5,
					delay: 200,
					delayOnTouchOnly: true,
					onEnd: async (evt) => {
						const toStoreId = evt.to.dataset.storeId;
						const fromStoreId = evt.from.dataset.storeId;
						const itemId = evt.item.dataset.itemId;

						try {
							// Move to different store if needed
							if (fromStoreId !== toStoreId) {
								await Meteor.callAsync('groceries.moveItem', fromStoreId, toStoreId, itemId);
							}

							// Update item order
							const itemOrders = Array.from(evt.to.children).map((el, index) => ({
								id: el.dataset.itemId,
								order: index,
							}));
							await Meteor.callAsync('groceries.updateItemOrder', toStoreId, itemOrders);
						} catch (error) {
							pushAlert('error', error.reason || 'Failed to move item');
							// Revert on error
							evt.item.remove();
							evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex]);
						}
					},
				});
			}
		});
	};

	// Initialize sortable and sync checkbox states when ready
	if (Sortable) {
		this.autorun(() => {
			if (this.subscriptionsReady()) {
				Meteor.defer(() => {
					this.initSortable();

					// Sync checkbox states
					document.querySelectorAll('.item-check').forEach(checkbox => {
						checkbox.checked = checkbox.dataset.checked === 'true';
					});
				});
			}
		});
	}
});

Template.GroceryList.helpers({
	isLoading() {
		return !Template.instance().subscriptionsReady();
	},
	groceryList() {
		return GroceryLists.findOne();
	},
	stores() {
		const list = GroceryLists.findOne();
		return list?.stores?.sort((a, b) => a.order - b.order) || [];
	},
	hasStores() {
		const list = GroceryLists.findOne();
		return list?.stores?.length > 0;
	},
	hasCheckedItems() {
		const list = GroceryLists.findOne();
		return list?.stores?.some(store =>
			store.items.some(item => item.checked),
		);
	},
	checkedClass() {
		return this.checked ? 'checked' : '';
	},
});

Template.GroceryList.events({
	'click #addStoreBtn, click #addFirstStoreBtn'(e) {
		e.preventDefault();
		e.stopPropagation();

		const modalElement = document.getElementById('addStoreModal');
		if (!modalElement) {return;}

		// Dispose existing modal instance
		const existingModal = window.bootstrap.Modal.getInstance(modalElement);
		if (existingModal) {
			existingModal.dispose();
		}

		// Create modal
		const modal = new window.bootstrap.Modal(modalElement, {
			backdrop: 'static',
			keyboard: true,
		});
		modal.show();

		// Fix z-index stacking issue
		Meteor.setTimeout(() => {
			const backdrop = document.querySelector('.modal-backdrop');
			if (backdrop && modalElement) {
				backdrop.parentNode.insertBefore(modalElement, backdrop.nextSibling);

				// Re-attach save button handler
				const saveBtn = document.getElementById('saveStoreBtn');
				if (saveBtn) {
					const newBtn = saveBtn.cloneNode(true);
					saveBtn.parentNode.replaceChild(newBtn, saveBtn);

					newBtn.addEventListener('click', async () => {
						const input = document.getElementById('storeNameInput');
						const storeName = input.value.trim();

						if (!storeName) {
							pushAlert('error', 'Please enter a store name');
							return;
						}

						try {
							await Meteor.callAsync('groceries.addStore', storeName);
							input.value = '';
							window.bootstrap.Modal.getInstance(modalElement)?.hide();
							pushAlert('success', 'Store added');
						} catch (error) {
							pushAlert('error', error.reason || 'Failed to add store');
						}
					});
				}
			}
		}, 50);

		// Focus input
		Meteor.setTimeout(() => {
			document.getElementById('storeNameInput')?.focus();
		}, 500);
	},

	'keypress #storeNameInput'(e) {
		if (e.which === 13) {
			e.preventDefault();
			document.getElementById('saveStoreBtn')?.click();
		}
	},

	async 'keypress .add-item-input'(e) {
		if (e.which === 13) {
			e.preventDefault();
			const input = e.currentTarget;
			const itemName = input.value.trim();
			const storeId = input.dataset.storeId;

			if (!itemName) {return;}

			try {
				await Meteor.callAsync('groceries.addItem', storeId, itemName);
				input.value = '';
			} catch (error) {
				pushAlert('error', error.reason || 'Failed to add item');
			}
		}
	},

	async 'change .item-check'(e) {
		const checkbox = e.currentTarget;
		const itemId = checkbox.dataset.itemId;
		const storeId = checkbox.dataset.storeId;

		try {
			await Meteor.callAsync('groceries.toggleItem', storeId, itemId);
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to toggle item');
			checkbox.checked = !checkbox.checked;
		}
	},

	async 'click .remove-item-btn'(e) {
		e.preventDefault();
		const button = e.currentTarget;
		const itemId = button.dataset.itemId;
		const storeId = button.dataset.storeId;

		try {
			await Meteor.callAsync('groceries.removeItem', storeId, itemId);
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to remove item');
		}
	},

	async 'click .remove-store-btn'(e) {
		e.preventDefault();
		const button = e.currentTarget;
		const storeId = button.dataset.storeId;

		const list = GroceryLists.findOne();
		const store = list?.stores?.find(s => s.id === storeId);

		if (store?.items?.length > 0) {
			const confirmed = await showConfirm(`Remove "${store.name}" and all its items?`);
			if (!confirmed) {return;}
		}

		try {
			await Meteor.callAsync('groceries.removeStore', storeId);
			pushAlert('success', 'Store removed');
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to remove store');
		}
	},

	async 'click #clearCheckedBtn'(e) {
		e.preventDefault();
		const confirmed = await showConfirm('Clear all checked items?');
		if (!confirmed) {return;}

		try {
			await Meteor.callAsync('groceries.clearChecked');
			pushAlert('success', 'Checked items cleared');
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to clear items');
		}
	},

	'click .rename-store-btn'(e) {
		e.preventDefault();
		e.stopPropagation();

		const storeId = e.currentTarget.dataset.storeId;
		const list = GroceryLists.findOne();
		const store = list?.stores?.find(s => s.id === storeId);

		if (!store) {return;}

		Template.instance().currentStoreId.set(storeId);

		const modalElement = document.getElementById('renameStoreModal');
		const input = document.getElementById('renameStoreInput');
		input.value = store.name;

		const modal = new window.bootstrap.Modal(modalElement, {
			backdrop: 'static',
			keyboard: true,
		});
		modal.show();

		// Fix z-index and focus
		Meteor.setTimeout(() => {
			const backdrop = document.querySelector('.modal-backdrop');
			if (backdrop && modalElement) {
				backdrop.parentNode.insertBefore(modalElement, backdrop.nextSibling);
			}
			input.focus();
			input.select();
		}, 100);
	},

	async 'click #saveRenameBtn'(e) {
		e.preventDefault();

		const storeId = Template.instance().currentStoreId.get();
		const newName = document.getElementById('renameStoreInput').value.trim();

		if (!newName) {
			pushAlert('error', 'Please enter a store name');
			return;
		}

		try {
			await Meteor.callAsync('groceries.renameStore', storeId, newName);
			const modal = window.bootstrap.Modal.getInstance(document.getElementById('renameStoreModal'));
			modal?.hide();
			pushAlert('success', 'Store renamed');
		} catch (error) {
			pushAlert('error', error.reason || 'Failed to rename store');
		}
	},

	'keypress #renameStoreInput'(e) {
		if (e.which === 13) {
			e.preventDefault();
			document.getElementById('saveRenameBtn')?.click();
		}
	},
});
