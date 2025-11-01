# Database Schema Documentation

This document describes the MongoDB collections and data models used in Splitly.

## Table of Contents

- [Overview](#overview)
- [Collections](#collections)
- [Data Models](#data-models)
- [Indexes](#indexes)
- [Data Validation](#data-validation)
- [Calculations](#calculations)

---

## Overview

Splitly uses MongoDB as its database, accessed through Meteor's Minimongo client-side cache and server-side MongoDB driver. The database stores bills, users, and account information.

**Database Connection:**
- Configured via `MONGO_URL` environment variable
- Connection pooling handled by Meteor
- Automatic reconnection on failure

**Collections:**
- `bills` - Bill documents with items and users
- `globalUsers` - Reusable user profiles
- `users` - Meteor accounts (managed by accounts-base)

---

## Collections

### Bills Collection

**Name:** `bills`

**Description:** Stores receipt/bill information, items, and user assignments.

**Access:**
```javascript
import { Bills } from '/imports/api/bills';
```

**Example Document:**
```javascript
{
  _id: 'abc123',
  userId: 'user_xyz789',  // Owner of the bill
  createdAt: ISODate('2024-10-15T10:30:00Z'),
  updatedAt: ISODate('2024-10-15T11:45:00Z'),
  date: '10/14/2024 18:21:40',  // Receipt date from OCR
  storeName: 'Walmart',
  users: [
    {
      id: 'u1',
      name: 'Alice',
      contact: 'alice@example.com'
    },
    {
      id: 'u2',
      name: 'Bob'
    }
  ],
  items: [
    {
      id: 'item1',
      name: 'Milk',
      price: 3.99,
      userIds: ['u1', 'u2'],
      splitType: 'equal'
    },
    {
      id: 'item2',
      name: 'Bread',
      price: 2.49,
      userIds: ['u1'],
      splitType: 'percent',
      shares: [
        { userId: 'u1', type: 'percent', value: 100 }
      ]
    }
  ],
  receiptTotal: 6.48,      // Subtotal from OCR
  calculatedTotal: 6.48,   // Calculated from items
  totalMismatch: false,
  taxAmount: 0.52,
  totalAmount: 7.00,       // Total from OCR
  calculatedWithTax: 7.00,
  totalWithTaxMismatch: false,
  currency: 'USD'
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | Yes | MongoDB ObjectId |
| `userId` | string | Yes | Owner's Meteor user ID |
| `createdAt` | Date | Yes | Bill creation timestamp |
| `updatedAt` | Date | No | Last modification timestamp |
| `date` | string | No | Receipt date/time from OCR |
| `storeName` | string | No | Detected store name |
| `users` | UserProfile[] | Yes | People splitting the bill |
| `items` | Item[] | Yes | Items on the bill |
| `receiptTotal` | number | No | Subtotal from OCR (null if not scanned) |
| `calculatedTotal` | number | No | Sum of all item prices |
| `totalMismatch` | boolean | No | True if receiptTotal ≠ calculatedTotal |
| `taxAmount` | number | No | Tax amount |
| `totalAmount` | number | No | Grand total from OCR |
| `calculatedWithTax` | number | No | calculatedTotal + taxAmount |
| `totalWithTaxMismatch` | boolean | No | True if totalAmount ≠ calculatedWithTax |
| `currency` | string | No | Currency code (default USD) |

---

### GlobalUsers Collection

**Name:** `globalUsers`

**Description:** Global user directory for reusing user profiles across multiple bills.

**Access:**
```javascript
import { GlobalUsers } from '/imports/api/users';
```

**Example Document:**
```javascript
{
  _id: 'gu123',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: ISODate('2024-10-15T10:30:00Z'),
  updatedAt: ISODate('2024-10-15T10:30:00Z')
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | Yes | MongoDB ObjectId |
| `name` | string | Yes | User's display name |
| `email` | string | No | Contact email |
| `createdAt` | Date | Yes | User creation timestamp |
| `updatedAt` | Date | No | Last modification timestamp |

---

### Users Collection (Meteor Accounts)

**Name:** `users`

**Description:** Meteor's built-in accounts collection. Stores authenticated user accounts.

**Access:**
```javascript
Meteor.users
```

**Example Document:**
```javascript
{
  _id: 'user_abc123',
  emails: [
    {
      address: 'user@example.com',
      verified: false
    }
  ],
  services: {
    google: {
      id: 'google_user_id',
      email: 'user@example.com',
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://...',
      accessToken: '...',
      expiresAt: 1634567890000
    }
  },
  profile: {
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    bio: 'Loves splitting bills',
    avatar: 'https://...'
  },
  createdAt: ISODate('2024-10-15T10:30:00Z')
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | User ID |
| `emails` | array | Email addresses and verification status |
| `services` | object | OAuth service data (google, etc.) |
| `profile` | object | Custom user profile data |
| `createdAt` | Date | Account creation timestamp |

---

## Data Models

### BillDoc Interface

**Location:** `/imports/api/models.ts`

```typescript
interface BillDoc {
  _id?: string;
  userId?: string;
  createdAt: Date;
  updatedAt?: Date;
  date?: string;
  storeName?: string;
  users: UserProfile[];
  items: Item[];
  receiptTotal?: number | null;
  calculatedTotal?: number;
  totalMismatch?: boolean;
  taxAmount?: number;
  totalAmount?: number | null;
  calculatedWithTax?: number;
  totalWithTaxMismatch?: boolean;
  currency?: string;
}
```

---

### UserProfile Interface

```typescript
interface UserProfile {
  id: string;           // Unique user ID within the bill
  name: string;         // Display name
  contact?: string;     // Email or phone
  preferences?: Record<string, unknown>;  // Future use
}
```

---

### Item Interface

```typescript
interface Item {
  id: string;                    // Unique item ID
  name: string;                  // Item name
  price: number;                 // Item price
  userIds: string[];             // Users (for equal split)
  splitType?: SplitType;         // 'equal' | 'percent' | 'fixed'
  shares?: ItemSplitShare[];     // For percent/fixed splits
}
```

---

### ItemSplitShare Union Type

```typescript
type ItemSplitShare = ItemSplitSharePercent | ItemSplitShareFixed;

interface ItemSplitSharePercent {
  userId: string;
  type: 'percent';
  value: number;  // 0-100
}

interface ItemSplitShareFixed {
  userId: string;
  type: 'fixed';
  value: number;  // Dollar amount
}
```

**Examples:**

**Equal Split:**
```javascript
{
  id: 'item1',
  name: 'Pizza',
  price: 20.00,
  userIds: ['u1', 'u2', 'u3'],
  splitType: 'equal'
}
// Each user pays: $6.67
```

**Percentage Split:**
```javascript
{
  id: 'item2',
  name: 'Wine',
  price: 30.00,
  splitType: 'percent',
  shares: [
    { userId: 'u1', type: 'percent', value: 70 },  // $21.00
    { userId: 'u2', type: 'percent', value: 30 }   // $9.00
  ]
}
```

**Fixed Amount Split:**
```javascript
{
  id: 'item3',
  name: 'Appetizer',
  price: 15.00,
  splitType: 'fixed',
  shares: [
    { userId: 'u1', type: 'fixed', value: 5.00 },
    { userId: 'u2', type: 'fixed', value: 10.00 }
  ]
}
```

---

### ExpenseSummary Interface

```typescript
interface ExpenseSummary {
  billId: string;
  grandTotal: number;
  perUser: ExpenseSummaryEntry[];
}

interface ExpenseSummaryEntry {
  userId: string;
  amount: number;
}
```

**Example:**
```javascript
{
  billId: 'abc123',
  grandTotal: 50.00,
  perUser: [
    { userId: 'u1', amount: 30.00 },
    { userId: 'u2', amount: 20.00 }
  ]
}
```

---

## Indexes

MongoDB indexes improve query performance. Currently, no explicit indexes are defined beyond the default `_id` index.

**Recommended Indexes (Future Optimization):**

```javascript
// Bills collection
Bills.createIndex({ userId: 1, createdAt: -1 });  // User's bills sorted by date
Bills.createIndex({ 'users.id': 1 });             // Find bills by participant

// GlobalUsers collection
GlobalUsers.createIndex({ name: 1 });              // Alphabetical sorting
```

**Index Management:**

Indexes can be added via Meteor shell or MongoDB Compass:

```javascript
// In Meteor shell
db.bills.createIndex({ userId: 1, createdAt: -1 });
```

---

## Data Validation

### Server-Side Validation

All data mutations go through Meteor methods with validation using the `check` package:

```javascript
import { check } from 'meteor/check';

Meteor.methods({
  'bills.insert'(bill) {
    check(bill, Object);
    // Additional validation...
  }
});
```

**Common Validation Rules:**

- **Strings:** Trimmed, max length enforced
- **Numbers:** Non-negative, rounded to 2 decimals
- **Arrays:** Must be arrays, element validation
- **Ownership:** User must own bill to modify

### Client-Side Validation

Client-side validation provides immediate feedback:

```javascript
// Example from splitPage.js
if (!itemName.trim()) {
  pushAlert('error', 'Item name cannot be empty');
  return;
}

if (isNaN(itemPrice) || itemPrice <= 0) {
  pushAlert('error', 'Price must be a positive number');
  return;
}
```

---

## Calculations

### Expense Summary Calculation

**Function:** `computeExpenseSummary(bill: BillDoc): ExpenseSummary`

**Location:** `/imports/api/models.ts`

**Algorithm:**

1. **For each item in the bill:**
   
   - **Equal Split:**
     ```javascript
     userAmount = itemPrice / userIds.length
     ```
   
   - **Percent Split:**
     ```javascript
     totalPercent = sum of all shares.value
     scale = 100 / totalPercent  // Normalize to 100%
     userAmount = itemPrice * (share.value * scale / 100)
     ```
   
   - **Fixed Split:**
     ```javascript
     allocatedAmount = sum of all shares.value
     remainder = max(0, itemPrice - allocatedAmount)
     extraPerUser = remainder / shares.length
     userAmount = share.value + extraPerUser
     ```

2. **Aggregate amounts per user:**
   ```javascript
   perUserMap[userId] += userAmount
   ```

3. **Round to 2 decimal places:**
   ```javascript
   amount = Number(amount.toFixed(2))
   ```

**Example Calculation:**

```javascript
const bill = {
  items: [
    { id: '1', name: 'Pizza', price: 20.00, userIds: ['u1', 'u2'], splitType: 'equal' },
    { id: '2', name: 'Salad', price: 10.00, userIds: ['u1'], splitType: 'equal' }
  ]
};

// Result:
{
  grandTotal: 30.00,
  perUser: [
    { userId: 'u1', amount: 20.00 },  // Pizza: $10 + Salad: $10
    { userId: 'u2', amount: 10.00 }   // Pizza: $10
  ]
}
```

---

### Total Mismatch Detection

**Purpose:** Detect when OCR-extracted totals don't match calculated totals.

**Tolerance:** ±$0.05 (to account for rounding differences)

```javascript
const totalMismatch = receiptTotal && 
  Math.abs(calculatedTotal - receiptTotal) > 0.05;

const totalWithTaxMismatch = totalAmount && 
  Math.abs(calculatedWithTax - totalAmount) > 0.05;
```

**Use Cases:**
- Missing items in extraction
- OCR errors in price reading
- Discounts not properly applied
- Multiple tax rates

---

## Data Migration

Currently, no migration system is in place. Schema changes are handled manually.

**Best Practices for Schema Changes:**

1. **Add new fields as optional:**
   ```javascript
   interface BillDoc {
     newField?: string;  // Optional
   }
   ```

2. **Default values in code:**
   ```javascript
   const storeName = bill.storeName || 'Receipt';
   ```

3. **Migration scripts (if needed):**
   ```javascript
   // In Meteor shell
   Bills.find({}).forEach(bill => {
     if (!bill.currency) {
       Bills.update(bill._id, { $set: { currency: 'USD' } });
     }
   });
   ```

---

## Data Backup and Restore

### Backup

**Using mongodump:**
```bash
mongodump --uri="mongodb://..." --out=/backup/$(date +%Y%m%d)
```

**Automated Backups:**
- Render.com provides automatic daily backups for paid plans
- Manual exports via MongoDB Compass or Atlas

### Restore

```bash
mongorestore --uri="mongodb://..." /backup/20241015
```

---

## Performance Considerations

### Query Optimization

**Good Practices:**

```javascript
// ✅ Efficient - uses index on userId
Bills.find({ userId: Meteor.userId() }, { sort: { createdAt: -1 } });

// ✅ Efficient - limits fields returned
Bills.find({}, { fields: { items: 1, users: 1 } });
```

**Avoid:**

```javascript
// ❌ Inefficient - scans all documents
Bills.find({ 'items.name': /milk/i });

// ❌ Returns unnecessary data
Bills.find({});  // No field projection
```

### Data Size Management

- **Item names:** Max 100 characters (enforced in validation)
- **User names:** Max 50 characters
- **Bio:** Max 500 characters
- **Images:** Compressed before upload, not stored in DB

---

## Security

### Collection Security

**Server-side only access:**
```javascript
// Client cannot directly insert/update/remove
Bills.deny({
  insert: () => true,
  update: () => true,
  remove: () => true
});
```

**All mutations through Meteor methods:**
- Authentication required
- Ownership verification
- Input validation
- Rate limiting

### Data Isolation

- Users only see their own bills (via publications)
- Bills filtered by `userId` in publication
- No direct database access from client

---

## Troubleshooting

### Common Issues

**Issue:** Bill not appearing after creation

**Solution:**
- Check subscription is ready: `this.subHandle.ready()`
- Verify bill has correct `userId`
- Check browser console for errors

**Issue:** Total mismatch warning

**Solution:**
- Review extracted items for missing/duplicate entries
- Check for discounts or coupons on receipt
- Manually adjust tax amount if needed

**Issue:** User name conflict

**Solution:**
- User names must be unique per bill (case-insensitive)
- Choose different name or add suffix (e.g., "John 2")

---

## Future Enhancements

- [ ] Add compound indexes for performance
- [ ] Implement data migration system
- [ ] Add bill versioning/history
- [ ] Support multiple currencies
- [ ] Add bill templates
- [ ] Implement soft deletes (trash/archive)
- [ ] Add bill sharing between users
- [ ] Export data as JSON/CSV
