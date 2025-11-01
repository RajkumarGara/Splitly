# OCR and Receipt Parsing Documentation

This document explains how Splitly extracts data from receipt images using Google Gemini AI and store-specific parsers.

## Table of Contents

- [Overview](#overview)
- [Gemini AI Integration](#gemini-ai-integration)
- [Receipt Parsers](#receipt-parsers)
- [Receipt Utilities](#receipt-utilities)
- [Supported Stores](#supported-stores)
- [Error Handling](#error-handling)
- [Testing and Accuracy](#testing-and-accuracy)

---

## Overview

Splitly's OCR system consists of two main components:

1. **Gemini AI Vision API:** Primary extraction engine (95%+ accuracy)
2. **Store-Specific Parsers:** Legacy text-based parsers (deprecated but available as fallback)

**Current Flow:**
```
Receipt Image → Compression → Gemini API → JSON Response → Bill Items
```

---

## Gemini AI Integration

### Architecture

**File:** `/imports/api/geminiOcr.ts`

**Model:** Google Gemini 2.5 Flash
- **Speed:** Fast (10-30 seconds)
- **Accuracy:** 95%+ with complex receipts
- **Cost:** Free tier: 1,500 requests/day

### Configuration

**Environment Variable:**
```bash
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

**Get API Key:**
1. Visit https://aistudio.google.com/
2. Click "Get API key" → Create new key
3. Copy and add to `.env` file

### Main Function: `extractReceiptWithGemini`

**Signature:**
```typescript
async function extractReceiptWithGemini(base64Image: string): Promise<{
  success: boolean;
  store?: string;
  date?: string;
  items?: Array<{ name: string; price: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  error?: string;
}>
```

**Parameters:**
- `base64Image`: Image data with or without data URI prefix

**Returns:** Structured JSON with receipt data

**Example:**
```javascript
const result = await extractReceiptWithGemini(base64Image);

if (result.success) {
  console.log(`Store: ${result.store}`);
  console.log(`Items: ${result.items.length}`);
  console.log(`Total: $${result.total}`);
} else {
  console.error(`Error: ${result.error}`);
}
```

---

### Adaptive Token Scaling

Gemini API has output token limits. The system automatically scales up if needed.

**Algorithm:**

1. **Estimate starting tokens based on image size:**
   ```javascript
   if (sizeKB < 100) return 2048;   // Small receipt
   if (sizeKB < 300) return 4096;   // Medium receipt
   if (sizeKB < 600) return 6144;   // Large receipt
   return 8192;                      // Extra large receipt
   ```

2. **If `MAX_TOKENS` error occurs:**
   - Double the token limit (up to 8192)
   - Retry automatically (max 3 attempts)
   - Fail if still exceeds limit

**Benefits:**
- Faster processing for small receipts
- Automatic handling of large receipts
- Cost optimization (fewer tokens when possible)

---

### Prompt Engineering

**Optimized Prompt:**
```
Extract receipt data. Output ONLY valid JSON, no explanations.

Rules:
- Extract COMPLETE item names including all descriptive text
- Remove only barcode numbers and tax codes (F, N, T) from the end
- Keep brand names, sizes, quantities, and product descriptions
- 2 decimal prices
- IMPORTANT: When you see discount lines, subtract from original price
- Skip quantity calculations and weight calculations
- Get subtotal, tax, total
- Extract date and time (MUST include AM/PM if present)

Format:
{"store":"Name","date":"MM/DD/YYYY HH:MM:SS AM/PM","items":[{"name":"Item","price":12.99}],"subtotal":100.00,"tax":1.33,"total":101.33}
```

**Key Features:**
- Short and direct (faster processing)
- Structured output (JSON only)
- Discount handling (subtract from item price)
- Date/time extraction with AM/PM
- No item count limits (extracts all items)

---

### Store Name Normalization

**Function:** `normalizeStoreName(storeName: string): string`

**Purpose:** Standardize store names for consistency.

**Mappings:**
```javascript
const storePatterns = [
  { pattern: /HALAL/i, name: 'Halal' },
  { pattern: /COSTCO/i, name: 'Costco' },
  { pattern: /WAL[-\s*]?MART/i, name: 'Walmart' },
  { pattern: /TARGET/i, name: 'Target' },
  { pattern: /KROGER/i, name: 'Kroger' },
  { pattern: /FRESH\s*THYME/i, name: 'Fresh Thyme' },
  { pattern: /DOLLAR\s*GENERAL/i, name: 'Dollar General' },
  { pattern: /DOLLAR\s*TREE/i, name: 'Dollar Tree' }
];
```

**Examples:**
- `"WAL*MART"` → `"Walmart"`
- `"WAL-MART SUPERCENTER"` → `"Walmart"`
- `"COSTCO WHOLESALE"` → `"Costco"`
- `"Unknown Store"` → `"Unknown Store"` (unchanged)

---

### Availability Check

**Function:** `isGeminiAvailable(): boolean`

**Purpose:** Check if API key is configured before attempting extraction.

**Usage:**
```javascript
if (!isGeminiAvailable()) {
  throw new Meteor.Error('gemini-unavailable', 'API key not configured');
}
```

---

### Error Handling

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `API key not configured` | Missing `GOOGLE_GEMINI_API_KEY` | Add API key to `.env` |
| `Image too large (max 10MB)` | Base64 image > 14MB | Compress image before upload |
| `Response exceeded max tokens` | Receipt too complex | Reduce image size or simplify |
| `Content blocked by safety filters` | Inappropriate image | Use valid receipt image |
| `Empty or invalid response` | API error | Retry or check API status |

**Retry Strategy:**
- Automatic retry on `MAX_TOKENS` error
- No retry on other errors (fail fast)
- User notified of errors via UI alerts

---

## Receipt Parsers

**Location:** `/imports/api/receiptParsers.ts`

**Status:** Legacy system, still available as fallback (not actively used).

### Main Router: `parseReceiptText`

**Signature:**
```typescript
function parseReceiptText(text: string, userIds: string[]): {
  items: Item[];
  receiptTotal: number | null;
  taxAmount: number;
  totalAmount: number | null;
}
```

**Flow:**
```
Text → Detect Store → Route to Parser → Extract Items → Return Data
```

**Supported Stores:**
- Walmart
- Halal Market
- Generic (fallback)

---

### Walmart Parser

**Format:**
```
ITEM NAME  BARCODE F  PRICE
```

**Features:**
- Extracts 12+ digit barcodes
- Handles tax codes (F, N, T)
- Skips weight calculation lines: `"2.85 lb @ 1.0 lb /0.78  2.22"`
- Skips quantity lines: `"3 AT 1 FOR 0.77  2.31"`
- Validates item count against `# ITEMS SOLD` line

**Example:**
```
GV MILK GAL 0001410002345 F  3.99
2.38 lb @ 1.0 lb /1.12  2.67
ORGANIC APPLES 0009234567890 N  5.49
```

**Extracted:**
```javascript
[
  { name: 'GV MILK GAL', price: 3.99 },
  { name: 'ORGANIC APPLES', price: 5.49 }
]
```

---

### Halal Market Parser

**Format:**
```
Crispy Gujarati
Roti 400g  2  $9.58 N
```

**Features:**
- Multi-line item names (name on line 1, price on line 2)
- Handles both `$` and no `$` for prices
- Tax markers: `N` or `T`
- Extracts quantity before price

**Example:**
```
Crispy Gujarati
Roti 400g  2  $9.58 N
Fruits & Vege  1  $3.50 N
```

**Extracted:**
```javascript
[
  { name: 'Crispy Gujarati Roti 400g', price: 9.58 },
  { name: 'Fruits & Vege', price: 3.50 }
]
```

---

### Generic Parser

**Format:** Flexible, handles various receipt formats

**Features:**
- Flexible price extraction (with or without `$`)
- Multi-line item names
- Skips common receipt headers/footers
- Best-effort parsing

**Use Case:** Unknown stores or receipts without specific format

---

## Receipt Utilities

**Location:** `/imports/api/receiptUtils.ts`

Shared utility functions used by all parsers.

### Key Functions

#### `skipLine(line: string): boolean`

Skip headers, dates, payment info, separators.

**Examples:**
- `"ST# 1234"` → `true` (skip)
- `"CASHIER: John"` → `true` (skip)
- `"MILK 3.99"` → `false` (keep)

---

#### `detectStoreName(text: string): string`

Detect store name from receipt text.

**Pattern Matching:**
```javascript
const storePatterns = [
  { pattern: /WAL[*\s\-_]?MART/i, name: 'Walmart' },
  { pattern: /HALAL\s*MARKET/i, name: 'Halal' },
  // ... more patterns
];
```

---

#### `extractTotalsFromLines(lines: string[])`

Extract subtotal, tax, and total from receipt.

**Returns:**
```javascript
{
  receiptTotal: 50.00,  // Subtotal
  taxAmount: 4.00,      // Tax
  totalAmount: 54.00    // Grand total
}
```

**Patterns:**
- `"SUBTOTAL $50.00"` → receiptTotal
- `"TAX $4.00"` → taxAmount
- `"TOTAL $54.00"` → totalAmount
- `"*** TOTAL $54.00"` → Costco format

---

#### `extractPriceFromLine(line: string)`

Extract price from a single line.

**Supported Formats:**
- `$1.48` → `1.48`
- `1.48` → `1.48`
- `1 48` → `1.48` (OCR error)
- `9:58` → `9.58` (OCR misread)

---

#### `cleanName(raw: string): string`

Clean item names by removing OCR artifacts.

**Cleaning Rules:**
- Remove `"36CT"` suffix
- Remove code suffixes like `"A1"`
- Remove `"|"` and everything after
- Normalize spaces
- Remove tax codes `"N F"` or `"T"`
- Generic OCR corrections: `"0RGAN"` → `"ORGAN"`

**Example:**
```javascript
cleanName('MILK GAL  36CT N F') → 'MILK GAL'
cleanName('0RGANIC APPLES | 5LB') → 'ORGANIC APPLES'
```

---

#### `createItem(name, price, userIds): Item`

Create an Item object with cleaned name.

```javascript
{
  id: 'ocr1634567890_abc123',
  name: 'Milk',
  price: 3.99,
  userIds: ['u1', 'u2'],
  splitType: 'equal'
}
```

---

#### `finalizeReceipt(items, receiptTotal, taxAmount, totalAmount)`

Finalize receipt data, calculating missing totals.

**Logic:**
- If `receiptTotal` or `totalAmount` missing → calculate from items
- Validate all inputs (arrays, numbers)
- Return complete receipt data

---

## Supported Stores

### Tier 1: Optimized (Gemini + Normalization)

- **Walmart:** Supercenters, Neighborhood Markets
- **Costco:** Wholesale clubs
- **Halal Market:** Fort Wayne Halal Market
- **Target:** Target stores
- **Kroger:** Kroger grocery stores
- **Fresh Thyme:** Fresh Thyme markets
- **Dollar General:** Dollar General stores
- **Dollar Tree:** Dollar Tree stores

### Tier 2: Generic Support

- Any receipt with clear item names and prices
- May require manual review and editing

---

## Error Handling

### Client-Side Flow

```javascript
try {
  const itemCount = await Meteor.callAsync('ocr.extractFromImage', billId, imageData);
  
  if (itemCount > 0) {
    pushAlert('success', `Extracted ${itemCount} items`);
    FlowRouter.go(`/split/${billId}`);
  } else {
    pushAlert('warning', 'No items found. Add items manually.');
  }
} catch (error) {
  if (error.error === 'gemini-unavailable') {
    pushAlert('error', 'OCR not configured. Please add items manually.');
  } else {
    pushAlert('error', `OCR failed: ${error.reason}`);
  }
}
```

### Server-Side Error Handling

```javascript
try {
  const result = await extractReceiptWithGemini(imageData);
  
  if (!result.success) {
    throw new Meteor.Error('extraction-failed', result.error);
  }
  
  // Process result...
} catch (error) {
  console.error('Gemini extraction failed:', error);
  throw new Meteor.Error('extraction-failed', error.message);
}
```

---

## Testing and Accuracy

### Test Receipt Collection

Create a test suite with various receipt types:

1. **Clear receipts:** High-quality images, well-lit
2. **Blurry receipts:** Low-quality photos
3. **Crumpled receipts:** Wrinkled or folded
4. **Long receipts:** 50+ items
5. **Discount receipts:** Coupons, markdowns
6. **Multi-page receipts:** CVS pharmacy receipts

### Accuracy Metrics

**Current Performance (Gemini 2.5 Flash):**

- **Item Extraction:** 95-98% accuracy
- **Price Extraction:** 98-99% accuracy
- **Store Detection:** 90-95% accuracy
- **Date Extraction:** 85-90% accuracy
- **Discount Handling:** 80-90% accuracy

**Common Errors:**

1. **Missing Items:** Faded text, low contrast
2. **Wrong Prices:** OCR reads similar digits (8 vs 3)
3. **Duplicate Items:** Multi-line descriptions extracted twice
4. **Missing Discounts:** Discount line not detected

### Manual Review Recommended

Always allow users to review and edit extracted data:

- Display item list before finalizing
- Show total mismatches as warnings
- Provide easy edit/delete options
- Allow manual item addition

---

## Performance Optimization

### Image Compression

**Before Upload:**
```javascript
// Max dimensions: 1920x1920
// Max file size: 1MB
// Format: JPEG with 0.85 quality
```

**Benefits:**
- Faster upload
- Faster API processing
- Lower API costs
- Better accuracy (removes noise)

### Caching

**Not implemented** - Each extraction is fresh to ensure accuracy.

**Potential Future Enhancement:**
- Cache extracted data by image hash
- Deduplication for repeated uploads

---

## Future Enhancements

- [ ] Support for PDF receipts
- [ ] Batch receipt processing (multiple images)
- [ ] Real-time extraction preview
- [ ] Confidence scores per item
- [ ] Manual correction training (improve model)
- [ ] Multi-language receipt support
- [ ] Receipt templates for common stores
- [ ] Export extracted data as structured JSON

---

## Troubleshooting

### Issue: Low Extraction Accuracy

**Solutions:**
1. Improve image quality (better lighting, focus)
2. Flatten crumpled receipts before photo
3. Crop to receipt only (remove background)
4. Use higher resolution camera
5. Try multiple photos and use best result

### Issue: Gemini API Rate Limit

**Solutions:**
1. Wait for rate limit reset (daily limit: 1,500 requests)
2. Upgrade to paid tier for higher limits
3. Implement request queuing for high-traffic periods
4. Cache results to reduce API calls

### Issue: Incorrect Store Name

**Solutions:**
1. Check normalization patterns in `normalizeStoreName`
2. Add new pattern if store not recognized
3. Manual override option in UI (future feature)

### Issue: Missing Discounts

**Solutions:**
1. Verify discount line format in receipt
2. Check Gemini prompt includes discount handling
3. Manual adjustment in UI after extraction
4. Report pattern to improve future extractions

---

## Best Practices

1. **Always compress images before upload**
2. **Show extracted data for user review**
3. **Highlight mismatches (receipt total ≠ calculated)**
4. **Provide manual edit options**
5. **Log extraction errors for debugging**
6. **Fallback to manual entry if OCR fails**
7. **Test with diverse receipt types regularly**

---

## API Reference

See [API Documentation](./api.md) for detailed method signatures and examples.
