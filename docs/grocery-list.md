# Grocery List Feature

## Overview

The Grocery List feature is a mobile-first shopping list manager integrated into Splitly. It allows users to organize grocery items by store, with drag-and-drop sorting, quick add/remove actions, and persistent storage in MongoDB.

## Features

### Core Functionality
- **Store Organization**: Group items by store (Walmart, Costco, etc.)
- **Quick Add**: Enter item name and press Enter - minimal taps
- **One-Tap Toggle**: Check/uncheck items as you shop
- **Drag-and-Drop**: Reorder items within stores or move between stores
- **Store Sorting**: Reorder stores to match your shopping route
- **Compact UI**: Optimized to show maximum items on mobile screens

### User Actions
- **Add Store**: Tap "+ Store" button, enter name
- **Add Item**: Type in the input field below each store, press Enter
- **Check Item**: Tap checkbox to mark as purchased
- **Remove Item**: Tap X button on any item
- **Clear Checked**: Bulk remove all checked items
- **Rename Store**: Tap pencil icon on store header
- **Remove Store**: Tap X on store header (confirms if items exist)
- **Reorder**: Drag stores or items using grip handles

## Database Schema

### Collection: `groceryLists`

```typescript
interface GroceryListDoc {
  _id: string;
  userId: string;          // Owner of the list
  stores: GroceryStore[];  // Array of stores
  createdAt: Date;
  updatedAt: Date;
}

interface GroceryStore {
  id: string;              // Unique store identifier
  name: string;            // Store name (e.g., "Walmart")
  items: GroceryItem[];    // Items in this store
  order: number;           // Sort order
}

interface GroceryItem {
  id: string;              // Unique item identifier
  name: string;            // Item name (e.g., "Milk")
  checked: boolean;        // Purchased status
  order: number;           // Sort order within store
}
```

### Storage Strategy
- One document per user (prevents multiple lists)
- Stores and items stored as embedded arrays
- Orders tracked numerically for sorting
- Auto-creates list on first access

## API Methods

### `groceries.getList()`
Get or create user's grocery list.

**Returns**: `GroceryListDoc`

### `groceries.addStore(storeName: string)`
Add a new store to the list.

**Parameters**:
- `storeName` - Store name (e.g., "Costco")

**Returns**: Store ID

### `groceries.addItem(storeId: string, itemName: string)`
Add item to a specific store.

**Parameters**:
- `storeId` - Target store ID
- `itemName` - Item name

**Returns**: Item ID

### `groceries.toggleItem(storeId: string, itemId: string)`
Toggle item checked state.

### `groceries.removeItem(storeId: string, itemId: string)`
Remove an item.

### `groceries.removeStore(storeId: string)`
Remove a store and all its items.

### `groceries.updateStoreOrder(storeOrders: Array<{id, order}>)`
Update store sort order after drag-and-drop.

### `groceries.updateItemOrder(storeId: string, itemOrders: Array<{id, order}>)`
Update item sort order within a store.

### `groceries.moveItem(fromStoreId: string, toStoreId: string, itemId: string)`
Move item between stores.

### `groceries.clearChecked()`
Remove all checked items from all stores.

### `groceries.renameStore(storeId: string, newName: string)`
Rename a store.

## UI Components

### Template: `GroceryList`
Main grocery list page with stores and items.

**Key Elements**:
- Header with "Clear Checked" and "Add Store" buttons
- Store cards with headers (drag handle, name, actions)
- Items container with drag-and-drop support
- Quick add input at bottom of each store
- Empty state for first-time users

### Drag-and-Drop
Powered by **SortableJS**:
- Store sorting: Drag stores by header grip handle
- Item sorting: Drag items by item grip handle
- Cross-store moves: Drag items between stores
- Ghost effect during drag
- Auto-saves order to database

### Styling
File: `/client/styles/groceryList.css`

**Mobile Optimizations**:
- Compact padding (0.5rem on mobile)
- Small font sizes (0.85-0.9rem)
- Tight spacing to maximize items per screen
- Touch-friendly tap targets (44px minimum)
- Responsive breakpoints

**Visual Design**:
- Store headers: Primary color background
- Items: Clean list with hover effects
- Checked items: 50% opacity with strikethrough
- Drag handles: Subtle gray icons
- Dark mode support

## Technical Implementation

### Client-Side
- **Reactive Data**: Meteor reactive subscriptions
- **Sortable.js**: Dynamic import for drag-and-drop
- **Bootstrap Modals**: Add/rename store dialogs
- **Enter Key**: Quick add items without button taps

### Server-Side
- **Meteor Methods**: All mutations via async methods
- **Publication**: `groceryList` - user-specific data
- **Validation**: Input sanitization with `check()`
- **Auto-create**: List created on first method call

### Security
- User authentication required
- User-specific data isolation
- Input validation on all methods
- Rate limiting via Meteor's built-in protection

## Usage Examples

### Add Store and Items
```javascript
// Add store
const storeId = await Meteor.callAsync('groceries.addStore', 'Walmart');

// Add items
await Meteor.callAsync('groceries.addItem', storeId, 'Milk');
await Meteor.callAsync('groceries.addItem', storeId, 'Bread');
await Meteor.callAsync('groceries.addItem', storeId, 'Eggs');
```

### Check Items While Shopping
```javascript
// Mark item as purchased
await Meteor.callAsync('groceries.toggleItem', storeId, itemId);

// Later, clear all checked items
await Meteor.callAsync('groceries.clearChecked');
```

### Organize Stores by Route
```javascript
// Reorder stores to match shopping route
await Meteor.callAsync('groceries.updateStoreOrder', [
  { id: 'store1', order: 0 },  // Walmart first
  { id: 'store2', order: 1 },  // Costco second
  { id: 'store3', order: 2 },  // Target third
]);
```

## Mobile UX Best Practices

### Implemented
✅ **Enter key submit** - No need to tap "Add" button
✅ **Large tap targets** - Checkboxes and buttons sized for thumbs
✅ **Inline actions** - Delete buttons visible without long-press
✅ **Instant feedback** - Checkmarks toggle immediately
✅ **Minimal modals** - Only for store add/rename
✅ **Swipe-free** - All actions accessible with taps
✅ **Compact layout** - 8-12 items visible on mobile screen

### Mobile-First Design Decisions
- Store name in header (not repeated per item)
- Grip handles subtle but touch-friendly
- Input fields auto-focus after modal open
- No confirmation dialogs for check/uncheck
- Confirm only for destructive actions (delete store)

## Performance

### Optimizations
- Embedded documents (no joins required)
- Single subscription per user
- Reactive updates only for current user's list
- Minimal DOM updates with Blaze reactivity
- Lazy-load SortableJS library

### Scalability
- Expected usage: 3-10 stores, 20-100 items per user
- Document size: ~10-50KB per user
- Query performance: O(1) user lookup
- Update performance: Full document update (acceptable for size)

## Future Enhancements

### Potential Features
- [ ] Item suggestions based on history
- [ ] Duplicate detection
- [ ] Share lists with family members
- [ ] Item categories (produce, dairy, etc.)
- [ ] Price tracking
- [ ] Quantity field for items
- [ ] Notes per item
- [ ] Multiple lists per user
- [ ] Import items from recipe
- [ ] Export to notes app

### Known Limitations
- One list per user (by design for simplicity)
- No offline support yet (could add IndexedDB cache)
- No item search (not needed for typical list size)
- No voice input (browser API available if needed)

## Testing Checklist

### Functional Tests
- [ ] Create new store
- [ ] Add items to store
- [ ] Check/uncheck items
- [ ] Remove items
- [ ] Remove store with items (confirm dialog)
- [ ] Rename store
- [ ] Drag items within store
- [ ] Drag items between stores
- [ ] Drag stores to reorder
- [ ] Clear all checked items
- [ ] Empty state displays correctly
- [ ] Navigation to/from groceries page

### Mobile Tests
- [ ] Tap targets are thumb-friendly
- [ ] Input keyboard shows immediately
- [ ] Enter key works for quick add
- [ ] Drag handles work on touch screens
- [ ] Modals display correctly on small screens
- [ ] Page doesn't scroll when full
- [ ] Portrait and landscape modes

### Edge Cases
- [ ] Empty store name validation
- [ ] Empty item name validation
- [ ] Long store names truncate
- [ ] Long item names wrap
- [ ] Many items per store (50+)
- [ ] Many stores (10+)
- [ ] Network errors during save
- [ ] Concurrent edits (unlikely but possible)

## File Structure

```
/imports/api/
  groceries.ts                    # API methods and collection

/imports/ui/blaze/pages/
  groceryList.html                # Template
  groceryList.js                  # Template logic

/client/styles/
  groceryList.css                 # Styles

/imports/startup/client/
  routes.js                       # Route: /groceries

/server/
  main.ts                         # Import API module
```

## Related Documentation

- [API Documentation](./api.md) - All Meteor methods
- [Database Schema](./database.md) - MongoDB collections
- [UI Components](./ui-components.md) - Blaze templates
- [Development Guide](./development.md) - Setup and workflow
