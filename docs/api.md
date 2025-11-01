# API Documentation

This document describes all Meteor methods and publications available in the Splitly application.

## Table of Contents

- [Bill Methods](#bill-methods)
- [User Methods](#user-methods)
- [Account Methods](#account-methods)
- [OCR Methods](#ocr-methods)
- [Publications](#publications)

---

## Bill Methods

All bill methods require user authentication and verify bill ownership before performing operations.

### `bills.insert`

Create a new bill.

**Parameters:**
- `bill` (BillDoc): Bill document to insert

**Returns:** `Promise<string>` - ID of the inserted bill

**Example:**
```javascript
const billId = await Meteor.callAsync('bills.insert', {
  users: [],
  items: [],
  createdAt: new Date(),
  storeName: 'Walmart',
  taxAmount: 0
});
```

**Validation:**
- Requires authentication
- `users` and `items` must be arrays
- `storeName` must be a string if provided
- Automatically adds `userId` for ownership
- Sets `createdAt` and `updatedAt` timestamps

---

### `bills.addUser`

Add a user to an existing bill.

**Parameters:**
- `billId` (string): ID of the bill
- `user` (UserProfile): User profile to add

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.addUser', billId, {
  id: 'user123',
  name: 'John Doe',
  contact: 'john@example.com'
});
```

**Validation:**
- Requires authentication and bill ownership
- User name is required and must be non-empty
- Prevents duplicate user names (case-insensitive)
- Automatically adds user to all existing items

**Errors:**
- `not-authorized`: Not logged in or not bill owner
- `not-found`: Bill not found
- `invalid-user`: Missing or empty user name
- `duplicate-user`: User name already exists in bill

---

### `bills.removeUser`

Remove a user from a bill and all associated items.

**Parameters:**
- `billId` (string): ID of the bill
- `userId` (string): ID of the user to remove

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.removeUser', billId, 'user123');
```

**Side Effects:**
- Removes user from bill's user list
- Removes user from all item assignments
- Updates `updatedAt` timestamp

---

### `bills.addItem`

Add an item to a bill.

**Parameters:**
- `billId` (string): ID of the bill
- `item` (Item): Item to add

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.addItem', billId, {
  id: 'item123',
  name: 'Milk',
  price: 3.99,
  userIds: ['user1', 'user2'],
  splitType: 'equal'
});
```

**Validation:**
- Item name required and non-empty (max 100 chars)
- Price must be non-negative number
- Price must be greater than zero
- Price rounded to 2 decimal places
- Name trimmed and sanitized

---

### `bills.removeItem`

Remove an item from a bill.

**Parameters:**
- `billId` (string): ID of the bill
- `itemId` (string): ID of the item to remove

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.removeItem', billId, 'item123');
```

---

### `bills.remove`

Delete an entire bill.

**Parameters:**
- `billId` (string): ID of the bill to delete

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.remove', billId);
```

**Warning:** This action is irreversible. The UI should confirm before calling.

---

### `bills.updateItems`

Update all items in a bill (bulk update).

**Parameters:**
- `billId` (string): ID of the bill
- `items` (Item[]): Array of items to replace existing items

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.updateItems', billId, [
  { id: 'item1', name: 'Milk', price: 3.99, userIds: ['user1'] },
  { id: 'item2', name: 'Bread', price: 2.49, userIds: ['user1', 'user2'] }
]);
```

**Validation:**
- All items sanitized (name trimmed, price rounded)
- Updates `updatedAt` timestamp

---

### `bills.updateTax`

Update the tax amount for a bill.

**Parameters:**
- `billId` (string): ID of the bill
- `taxAmount` (number): New tax amount

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.updateTax', billId, 5.47);
```

**Validation:**
- Tax amount cannot be negative
- Rounded to 2 decimal places

---

### `bills.toggleUserOnItem`

Toggle a user's participation in an item (add if not present, remove if present).

**Parameters:**
- `billId` (string): ID of the bill
- `itemId` (string): ID of the item
- `userId` (string): ID of the user to toggle

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('bills.toggleUserOnItem', billId, 'item123', 'user123');
```

**Behavior:**
- If user is assigned to item → removes them
- If user is not assigned → adds them
- Used for quick selection in UI

---

### `bills.syncUserName`

Sync a user's name across all bills owned by the current user.

**Parameters:**
- `userId` (string): ID of the user
- `newName` (string): New name for the user

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
await Meteor.callAsync('bills.syncUserName', 'user123', 'Jane Smith');
```

**Use Case:** When user updates their profile name, propagate to all bills.

**Validation:**
- Requires authentication
- New name cannot be empty
- Only updates bills owned by current user

---

### `clearAllData`

**⚠️ DEVELOPMENT ONLY**

Clear all bills and users from the database.

**Parameters:** None

**Returns:** `Promise<{success: boolean}>`

**Example:**
```javascript
await Meteor.callAsync('clearAllData');
```

**Security:**
- Only available in development environment
- Throws error in production
- Clears Bills and GlobalUsers collections

---

## OCR Methods

### `ocr.extractFromImage`

Extract items from receipt image using Gemini AI.

**Parameters:**
- `billId` (string): ID of the bill to add items to
- `imageData` (string): Base64 encoded image data

**Returns:** `Promise<number>` - Number of items extracted

**Example:**
```javascript
const itemCount = await Meteor.callAsync('ocr.extractFromImage', billId, base64Image);
console.log(`Extracted ${itemCount} items`);
```

**Process:**
1. Verifies bill ownership
2. Validates image data (max 10MB)
3. Calls Gemini AI API with adaptive token scaling
4. Parses structured JSON response
5. Creates items with equal split among all users
6. Calculates totals and detects mismatches
7. Updates bill with items, totals, store name, and date

**Validation:**
- Only runs on server
- Client simulation returns 0
- Requires Gemini API key configuration
- Throws error if API unavailable or extraction fails

**Errors:**
- `gemini-unavailable`: API key not configured
- `extraction-failed`: Gemini API error or parsing failure

---

## User Methods

Methods for managing global users (reusable across bills).

### `globalUsers.insert`

Create a new global user.

**Parameters:**
- `user` (Omit<GlobalUser, '_id' | 'createdAt' | 'updatedAt'>): User data

**Returns:** `Promise<string>` - ID of inserted user

**Example:**
```javascript
const userId = await Meteor.callAsync('globalUsers.insert', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

**Validation:**
- Name required and non-empty
- Prevents duplicate names (case-insensitive)
- Trims and sanitizes input
- Sets timestamps automatically

---

### `globalUsers.update`

Update an existing global user.

**Parameters:**
- `userId` (string): ID of the user to update
- `updates` (Partial<GlobalUser>): Partial user data to update

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('globalUsers.update', userId, {
  name: 'Jane Smith',
  email: 'jane@example.com'
});
```

**Validation:**
- User must exist
- If name changes, checks for duplicates
- Updates `updatedAt` timestamp

---

### `globalUsers.remove`

Remove a global user.

**Parameters:**
- `userId` (string): ID of the user to remove

**Returns:** `Promise<void>`

**Example:**
```javascript
await Meteor.callAsync('globalUsers.remove', userId);
```

**Note:** This does NOT remove the user from existing bills. Only deletes from global directory.

---

## Account Methods

Methods for user account management and authentication.

### `updateUserProfile`

Update the current user's profile information.

**Parameters:**
- `updates` (Partial<UserProfile>): Partial profile data to update

**Returns:** `Promise<{success: boolean}>`

**Example:**
```javascript
await Meteor.callAsync('updateUserProfile', {
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'JohnD',
  bio: 'Avid bill splitter',
  avatar: 'https://example.com/avatar.jpg'
});
```

**Validation:**
- Requires authentication
- All fields optional
- String fields trimmed and length-limited:
  - firstName, lastName, displayName: max 50 chars
  - bio: max 500 chars
  - avatar: max 500 chars (URL)

---

### `user.changePassword`

Change the current user's password.

**Parameters:**
- `oldPassword` (string): Current password
- `newPassword` (string): New password

**Returns:** `Promise<{success: boolean}>`

**Example:**
```javascript
await Meteor.callAsync('user.changePassword', 'oldpass123', 'newpass456');
```

**Validation:**
- Requires authentication
- Verifies old password is correct
- New password must be at least 8 characters
- Only runs on server

**Errors:**
- `incorrect-password`: Old password is wrong
- `weak-password`: New password too short

---

### `deleteAccount`

Delete the current user's account and all associated data.

**Parameters:**
- `password` (string): User password for confirmation

**Returns:** `Promise<{success: boolean}>`

**Example:**
```javascript
await Meteor.callAsync('deleteAccount', 'mypassword');
```

**Side Effects:**
- Deletes all bills owned by user
- Removes user account
- Cannot be undone

**Validation:**
- Requires authentication
- Verifies password is correct
- Only runs on server

---

### `getUserProfile`

Get the current user's full profile.

**Parameters:** None

**Returns:** `Promise<{profile, email, createdAt}>`

**Example:**
```javascript
const userProfile = await Meteor.callAsync('getUserProfile');
console.log(userProfile.profile.displayName);
console.log(userProfile.email);
```

**Fields Returned:**
- `profile`: UserProfile object
- `email`: Primary email address
- `createdAt`: Account creation date

---

## Publications

Publications provide reactive data subscriptions to clients.

### `bills.all`

Subscribe to all bills owned by the current user.

**Parameters:** None

**Returns:** Cursor of bills where `userId` matches current user

**Example:**
```javascript
// In Blaze template
Template.myTemplate.onCreated(function() {
  this.subscribe('bills.all');
});

Template.myTemplate.helpers({
  bills() {
    return Bills.find({}, { sort: { createdAt: -1 } });
  }
});
```

**Security:** Only returns bills owned by the authenticated user.

---

### `globalUsers.all`

Subscribe to all global users.

**Parameters:** None

**Returns:** Cursor of all global users

**Example:**
```javascript
Template.myTemplate.onCreated(function() {
  this.subscribe('globalUsers.all');
});

Template.myTemplate.helpers({
  users() {
    return GlobalUsers.find({}, { sort: { name: 1 } });
  }
});
```

**Note:** Currently returns all users. Could be filtered by owner in future versions.

---

### `userData`

Subscribe to current user's profile data.

**Parameters:** None

**Returns:** User document with profile, emails, and createdAt fields

**Example:**
```javascript
Template.myTemplate.onCreated(function() {
  this.subscribe('userData');
});

Template.myTemplate.helpers({
  currentUser() {
    return Meteor.user();
  }
});
```

**Security:** Only returns data for the authenticated user.

---

## Rate Limiting

All methods are rate-limited for security:

- **Account methods:** 5 calls per 60 seconds
- **Login attempts:** 5 attempts per 60 seconds
- **Other methods:** No explicit limit (Meteor default rate limiting applies)

Rate limits are per client IP address and reset after the time window expires.

---

## Error Handling

All methods throw `Meteor.Error` objects with the following structure:

```javascript
{
  error: 'error-code',
  reason: 'Human-readable message',
  details: 'Optional additional details'
}
```

**Common Error Codes:**

- `not-authorized`: User not logged in or lacks permission
- `not-found`: Requested resource doesn't exist
- `invalid-*`: Validation failed (invalid-user, invalid-price, etc.)
- `duplicate-*`: Attempting to create duplicate resource
- `gemini-unavailable`: OCR service not configured

**Client-Side Error Handling:**

```javascript
try {
  await Meteor.callAsync('bills.insert', bill);
} catch (error) {
  if (error.error === 'not-authorized') {
    // Redirect to login
  } else {
    // Show error message
    console.error(error.reason);
  }
}
```

---

## Best Practices

### 1. Always Use Async/Await

```javascript
// ✅ Good
const billId = await Meteor.callAsync('bills.insert', bill);

// ❌ Bad (old callback style)
Meteor.call('bills.insert', bill, (error, result) => { ... });
```

### 2. Handle Errors Gracefully

```javascript
try {
  await Meteor.callAsync('bills.addUser', billId, user);
} catch (error) {
  showAlert('error', error.reason || 'An error occurred');
}
```

### 3. Validate Input Client-Side First

```javascript
// Client-side validation
if (!user.name || !user.name.trim()) {
  showAlert('error', 'User name is required');
  return;
}

// Then call method
await Meteor.callAsync('bills.addUser', billId, user);
```

### 4. Use Subscriptions Efficiently

```javascript
// ✅ Good - subscribe once in onCreated
Template.myTemplate.onCreated(function() {
  this.subscribe('bills.all');
});

// ❌ Bad - subscribing in helper (runs repeatedly)
Template.myTemplate.helpers({
  bills() {
    Meteor.subscribe('bills.all'); // Don't do this!
    return Bills.find({});
  }
});
```

### 5. Clean Up Subscriptions

```javascript
// Meteor handles cleanup automatically when template is destroyed
// But for manual subscriptions:
const handle = Meteor.subscribe('bills.all');

// Later...
handle.stop();
```
