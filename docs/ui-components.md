# UI Components Documentation

This document describes the Blaze templates and components used in Splitly's frontend.

## Table of Contents

- [Overview](#overview)
- [Layout](#layout)
- [Pages](#pages)
- [Components](#components)
- [Routing](#routing)
- [Styling](#styling)
- [Best Practices](#best-practices)

---

## Overview

Splitly uses **Blaze** as its template engine, offering reactive data binding and simple event handling.

**Key Technologies:**
- **Blaze:** Meteor's reactive templating system
- **Bootstrap 5:** UI framework with responsive grid
- **Bootstrap Icons:** Icon library
- **jQuery:** DOM manipulation (via Bootstrap)

---

## Layout

### MainLayout Template

**File:** `/imports/ui/blaze/layout.html` & `layout.js`

**Purpose:** Main application shell with navigation, alerts, and modals.

**Structure:**
```html
<template name="MainLayout">
  <div class="app-container">
    <!-- Top Navigation (Desktop) -->
    <nav class="top-nav">...</nav>
    
    <!-- Alert System -->
    <template name="Alerts">...</template>
    
    <!-- Page Content -->
    <main>{{> Template.dynamic template=yield}}</main>
    
    <!-- Bottom Navigation (Mobile) -->
    <nav class="bottom-nav">...</nav>
    
    <!-- Modals -->
    <div id="confirmModal">...</div>
  </div>
</template>
```

**Reactive Variables:**
- `alertsVar`: Array of active alerts
- `initialLoadState`: First-time data loading state

**Helpers:**
```javascript
notReady() // Show loading spinner
isActive(path) // Highlight active nav item
navItems() // Navigation menu items
currentUser() // Current authenticated user
userInitial() // User's first letter for avatar
```

**Events:**
```javascript
'click #headerLogoutBtn' // Logout user
'click .btn-close' // Dismiss alert
```

---

### Alert System

**Function:** `pushAlert(type, msg)`

**Purpose:** Display temporary toast notifications.

**Types:**
- `error` → Red (danger)
- `warning` → Yellow
- `info` → Blue
- `success` → Green

**Example:**
```javascript
import { pushAlert } from '/imports/ui/blaze/layout';

pushAlert('success', 'Bill created successfully!');
pushAlert('error', 'Failed to save changes');
```

**Auto-dismiss:** Alerts disappear after 6 seconds.

---

### Confirm Dialog

**Function:** `showConfirm(message, options)`

**Purpose:** Show confirmation dialog with custom buttons.

**Returns:** `Promise<boolean>`

**Options:**
```javascript
{
  okText: 'Delete',           // OK button text
  cancelText: 'Cancel',        // Cancel button text
  okButtonClass: 'btn-danger', // Button style
  dismissible: true            // Allow backdrop click to dismiss
}
```

**Example:**
```javascript
import { showConfirm } from '/imports/ui/blaze/layout';

const confirmed = await showConfirm(
  'Are you sure you want to delete this bill?',
  { okText: 'Delete', okButtonClass: 'btn-danger' }
);

if (confirmed) {
  // Delete bill
}
```

---

## Pages

### Dashboard Page

**File:** `/imports/ui/blaze/pages/dashboard.html` & `dashboard.js`

**Route:** `/`

**Purpose:** Main landing page with bill creation and list.

**Features:**
- Create new bill (manual or OCR)
- Upload receipt image
- View recent bills
- Quick actions (view, delete)
- PWA install prompt

**Key Functions:**

#### `compressImage(imageDataUrl, maxWidth, quality)`

Compress uploaded receipt images before OCR.

**Parameters:**
- `imageDataUrl`: Base64 image
- `maxWidth`: Max width in pixels (default: 1600)
- `quality`: JPEG quality 0-1 (default: 0.85)

**Returns:** `Promise<string>` - Compressed image

---

#### Receipt Upload Flow

```
User Clicks "Scan Receipt"
  ↓
File Picker Opens
  ↓
Image Selected
  ↓
Image Compressed (max 1600px, 0.85 quality)
  ↓
Bill Created (empty)
  ↓
OCR Method Called with base64 image
  ↓
Items Extracted and Added to Bill
  ↓
Navigate to Split Page
```

**Code:**
```javascript
const input = document.getElementById('receiptInput');
input.click();

input.onchange = async (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  
  reader.onload = async () => {
    const compressed = await compressImage(reader.result);
    const billId = await Meteor.callAsync('bills.insert', { /*...*/ });
    const itemCount = await Meteor.callAsync('ocr.extractFromImage', billId, compressed);
    FlowRouter.go(`/split/${billId}`);
  };
  
  reader.readAsDataURL(file);
};
```

---

**Reactive Variables:**
- `ocrProcessing`: Boolean for OCR in progress
- `ocrProgress`: Progress percentage (0-100)
- `ocrStatus`: Status message
- `showInstallPrompt`: PWA install banner visibility

**Helpers:**
```javascript
bills() // All user's bills sorted by date
recentBills() // Last 5 bills
hasBills() // User has at least one bill
billSummary(bill) // Computed expense summary
```

**Events:**
```javascript
'click #createBillBtn' // Create manual bill
'click #scanReceiptBtn' // Upload receipt for OCR
'click .delete-bill' // Delete bill with confirmation
'click .view-bill' // Navigate to split page
'click #installBtn' // Install PWA
```

---

### Split Page

**File:** `/imports/ui/blaze/pages/splitPage.html` & `splitPage.js`

**Route:** `/split/:id`

**Purpose:** Assign people to items and calculate splits.

**Features:**
- Add/edit/delete items
- Add/remove people
- Toggle user assignment per item
- Advanced split modes (equal, percent, fixed)
- Real-time expense calculation
- Tax adjustment
- Total mismatch warnings

**Reactive Variables:**
- `showAddForm`: Show add item form
- `showDeleteButtons`: Delete mode active
- `showSplitMode`: Assignment mode active
- `showHelpInfo`: Show help tooltips

**Helpers:**
```javascript
bill() // Current bill document
items() // Items with computed properties
totalDifference() // Receipt vs calculated difference
summary() // Expense summary per person
formattedTotal() // Total with currency format
hasTaxMismatch() // Tax calculation warning
```

**Events:**
```javascript
'click #addItemBtn' // Show add item form
'click #saveItemBtn' // Save new item
'click .user-chip' // Toggle user on item
'click .delete-item' // Delete item
'click #editModeBtn' // Toggle assignment mode
'input #taxInput' // Update tax amount
```

---

#### Split Mode UI

When split mode is active:
- User chips become clickable
- Selected users highlighted with blue background
- Click to toggle assignment
- Changes saved immediately to database

**Visual States:**
```css
.user-chip.selected {
  background-color: var(--bs-primary);
  color: white;
}

.user-chip:hover {
  transform: scale(1.05);
  cursor: pointer;
}
```

---

### History Page

**File:** `/imports/ui/blaze/pages/history.html` & `history.js`

**Route:** `/history`

**Purpose:** View all past bills with filtering and search.

**Features:**
- Search bills by store name or date
- Sort by date or amount
- Filter by date range
- View expense summaries
- Quick navigation to split page

**Helpers:**
```javascript
allBills() // All bills with summaries
filteredBills() // Bills matching search
hasHistory() // User has bills
totalSpent() // Sum of all bills
```

---

### Analysis Page

**File:** `/imports/ui/blaze/pages/analysis.html` & `analysis.js`

**Route:** `/analysis`

**Purpose:** Visualize spending patterns and statistics.

**Features:**
- Total spending by store
- Spending over time (chart)
- Most frequent stores
- Average bill amount
- Top spenders

**Helpers:**
```javascript
totalSpent() // Total across all bills
storeBreakdown() // Spending per store
averageBillAmount() // Mean bill value
topStores() // Most shopped stores
```

---

### Settings Page

**File:** `/imports/ui/blaze/pages/settings.html` & `settings.js`

**Route:** `/settings`

**Purpose:** App configuration and account management.

**Features:**
- Theme toggle (light/dark)
- IndexedDB cache toggle
- Clear all data (dev only)
- Account management
- Logout

**Events:**
```javascript
'click #themeToggle' // Switch theme
'click #cacheToggle' // Enable/disable offline cache
'click #clearDataBtn' // Clear all bills
'click #logoutBtn' // Sign out
```

---

### Login Page

**File:** `/imports/ui/blaze/pages/login.html` & `login.js`

**Route:** `/login`

**Purpose:** User authentication.

**Features:**
- Google OAuth login
- Email/password login (if configured)
- Guest mode (future feature)

**Events:**
```javascript
'click #googleLoginBtn' // Sign in with Google
```

---

### Profile Page

**File:** `/imports/ui/blaze/pages/profile.html` & `profile.js`

**Route:** `/profile`

**Purpose:** User profile management.

**Features:**
- Edit display name
- Change bio
- Upload avatar
- Delete account

---

## Components

### User Modal

**File:** `/imports/ui/blaze/components/userModal.html` & `userModal.js`

**Purpose:** Manage global user directory.

**Features:**
- Add new users
- Edit user names
- Delete users
- Sync changes to all bills

**Reactive Variables:**
- `editingUserId`: ID of user being edited
- `operationInProgress`: Prevent duplicate requests

**Helpers:**
```javascript
users() // All global users
hasUsers() // Directory not empty
isEditing(userId) // User in edit mode
```

**Events:**
```javascript
'click #addUserModalBtn' // Add new user
'click .remove-user' // Delete user
'click .editable-name' // Enter edit mode
'click .save-edit-user' // Save changes
'click #saveUsersBtn' // Sync to all bills
```

**Usage:**
```html
<!-- Trigger modal -->
<button data-bs-toggle="modal" data-bs-target="#userModal">
  Manage People
</button>

<!-- Modal template -->
{{> UserModal}}
```

---

## Routing

**File:** `/imports/startup/client/routes.js`

**Router:** FlowRouter Extra

### Route Definitions

```javascript
// Public routes
FlowRouter.route('/login', { ... });

// Protected routes (require authentication)
FlowRouter.route('/', { name: 'dashboard', triggersEnter: [requireAuth] });
FlowRouter.route('/split/:id', { name: 'splitPage', triggersEnter: [requireAuth] });
FlowRouter.route('/history', { name: 'history', triggersEnter: [requireAuth] });
FlowRouter.route('/analysis', { name: 'analysis', triggersEnter: [requireAuth] });
FlowRouter.route('/settings', { name: 'settings', triggersEnter: [requireAuth] });
FlowRouter.route('/profile', { name: 'profile', triggersEnter: [requireAuth] });
```

### Middleware

**Authentication Guard:**
```javascript
function requireAuth(context, redirect) {
  if (!Tracker.nonreactive(() => Meteor.userId())) {
    redirect('/login');
  }
}
```

**Usage in Templates:**
```javascript
// Navigate programmatically
FlowRouter.go('/split/abc123');

// Get route parameters
const billId = FlowRouter.getParam('id');

// Check current route
const currentPath = FlowRouter.current().path;
```

---

## Styling

### Global Styles

**File:** `/client/styles/global.css`

**Features:**
- CSS variables for theming
- Dark mode support
- Responsive breakpoints
- Custom scrollbars

**Theme Variables:**
```css
:root {
  --primary-color: #0d6efd;
  --background-color: #ffffff;
  --text-color: #212529;
  --card-background: #f8f9fa;
}

[data-bs-theme="dark"] {
  --background-color: #1a1a1a;
  --text-color: #e9ecef;
  --card-background: #2d2d2d;
}
```

---

### Page-Specific Styles

- **dashboard.css:** Bill cards, grid layout
- **splitPage.css:** Item cards, user chips, split controls
- **analysis.css:** Charts, statistics cards
- **login.css:** Login form, OAuth buttons

---

### Responsive Design

**Breakpoints:**
- **Mobile:** < 768px (bottom nav, stacked layout)
- **Tablet:** 768px - 992px (2-column grid)
- **Desktop:** > 992px (top nav, 3-column grid)

**Mobile Optimizations:**
- Bottom navigation bar
- Swipeable cards
- Larger touch targets
- Reduced padding

---

## Best Practices

### 1. Reactive Data Flow

**✅ Good:**
```javascript
Template.myTemplate.helpers({
  bills() {
    return Bills.find({}, { sort: { createdAt: -1 } });
  }
});
```

**❌ Bad:**
```javascript
Template.myTemplate.helpers({
  bills() {
    const bills = Bills.find().fetch();
    return bills.sort((a, b) => b.createdAt - a.createdAt);
  }
});
```

---

### 2. Event Handlers

**✅ Good:**
```javascript
Template.myTemplate.events({
  async 'click #myBtn'(e, tpl) {
    e.preventDefault();
    try {
      await Meteor.callAsync('myMethod');
      pushAlert('success', 'Done!');
    } catch (error) {
      pushAlert('error', error.reason);
    }
  }
});
```

**❌ Bad:**
```javascript
Template.myTemplate.events({
  'click #myBtn'(e, tpl) {
    Meteor.call('myMethod'); // No error handling
  }
});
```

---

### 3. Template Lifecycle

**onCreated:** Subscribe to publications, initialize reactive vars
**onRendered:** DOM manipulation, event listeners
**onDestroyed:** Cleanup (usually automatic in Meteor)

```javascript
Template.myTemplate.onCreated(function() {
  this.subscribe('myData');
  this.myVar = new ReactiveVar(false);
});

Template.myTemplate.onRendered(function() {
  // Initialize tooltips, etc.
});

Template.myTemplate.onDestroyed(function() {
  // Manual cleanup if needed
});
```

---

### 4. Modals

**Bootstrap 5 Modal API:**
```javascript
const modalEl = document.getElementById('myModal');
const modal = new bootstrap.Modal(modalEl, {
  backdrop: 'static',  // Prevent dismiss on click outside
  keyboard: false      // Prevent dismiss on ESC
});

modal.show();
modal.hide();
```

---

### 5. Accessibility

- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add ARIA labels for screen readers
- Ensure keyboard navigation works
- Maintain color contrast ratios

```html
<button aria-label="Delete bill" class="btn btn-danger">
  <i class="bi bi-trash" aria-hidden="true"></i>
</button>
```

---

## Troubleshooting

### Issue: Template not rendering

**Solutions:**
1. Check template is imported in routes.js
2. Verify template name matches `<template name="...">`
3. Check for JavaScript errors in console

---

### Issue: Data not reactive

**Solutions:**
1. Ensure subscription is active in `onCreated`
2. Use `.find()` not `.fetch()` in helpers
3. Check MongoDB collection is published

---

### Issue: Bootstrap components not working

**Solutions:**
1. Verify Bootstrap JavaScript is loaded
2. Check `window.bootstrap` is available
3. Ensure DOM elements have correct IDs

---

## Future Enhancements

- [ ] Convert to React (for better ecosystem)
- [ ] Add component unit tests
- [ ] Improve accessibility (WCAG AA)
- [ ] Add animations and transitions
- [ ] Implement drag-and-drop for item reordering
- [ ] Add keyboard shortcuts
- [ ] Improve mobile gestures
- [ ] Add more chart visualizations

---

## Resources

- [Blaze Documentation](https://docs.meteor.com/api/blaze.html)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)
- [FlowRouter Extra](https://github.com/veliovgroup/flow-router)
