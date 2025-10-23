# Splitly (Meteor Expense Splitting App)

Offline-friendly expense splitting app built with Meteor + Blaze + Bootstrap.

## Features

- ✅ Create and manage expense bills with multiple users
- ✅ Split expenses equally among selected users per item
- ✅ Add/remove users dynamically in edit mode
- ✅ OCR receipt scanning with Tesseract.js
- ✅ Offline support with IndexedDB caching
- ✅ Responsive mobile-first design
- ✅ Real-time updates with Meteor reactivity
- ✅ Bill history and analysis views
- ✅ Settings management

## Structure (flattened root)
```
.meteor/                         # Meteor internal config
package.json                     # App dependencies
config/app.config.json           # Feature flags & provider stubs
client/main.js                   # Client entrypoint (imports routes)
server/main.ts                   # Server startup & publications import
imports/
  api/                           # Collections, models, publications, methods
    models.ts                    # Data interfaces + computeExpenseSummary()
    bills.ts                     # Bills collection + Meteor methods
    publications.ts              # Meteor.publish definitions
  infra/
    indexedDb.ts                 # Offline cache (IndexedDB via idb)
  startup/client/routes.js       # FlowRouter + BlazeLayout route definitions
  ui/blaze/                      # Blaze UI layer
    layout.{html,js}             # Main layout (navbar, alerts, spinner)
    pages/                       # Dashboard, NewBill, History, Analysis, BillDetail, Settings
types/ (legacy shims)            # Ambient TS shims (React removed)
```

## Core Features
| Feature | Status |
|---------|--------|
| Routing & Navigation (FlowRouter + Blaze) | ✅ |
| MongoDB persistence | ✅ |
| IndexedDB offline cache (flagged) | ✅ (basic sync) |
| Feature flags (config + localStorage overrides) | ✅ |
| Equal / Percent / Fixed splits (UI + logic) | ✅ (percent validates ~100%) |
| Share editor per item | ✅ |
| OCR stub ingestion (textarea parse) | ✅ (stub; real OCR pending) |
| Multi-bill history + detail view | ✅ |
| Analysis page (filter + inline bar) | ✅ (charts enhancement pending) |
| Settings page | ✅ |
| Alerts (success/error toasts, Blaze) | ✅ |
| Loading indicators (initial sync / OCR) | ✅ |

## Data Model Summary
- UserProfile: `{ id, name, contact?, preferences? }`
- Item: `{ id, name, price, userIds[], splitType?, shares? }` where `splitType` in `equal|percent|fixed` and `shares` entries each carry `type` + `value`.
- BillDoc: `{ _id?, createdAt, updatedAt?, users[], items[], currency? }`
- ExpenseSummary: derived totals per user; percent shares auto-scaled if not exactly 100%; fixed remainder distributed evenly.

## Offline Flow
1. On initial load (subscription not ready & empty Minimongo): load cached bills from IndexedDB.
2. When subscription becomes ready: cache latest bills back to IndexedDB.
3. Future: diff/merge strategy & stale detection.

## Running

```bash
# Install dependencies
meteor npm install

# Start development server
npm start
# or
meteor run

# Lint code
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Build for production
npm run build

# Deploy to Meteor servers (optional)
npm run deploy
```

Open: http://localhost:3000

## Configuration Flags
`config/app.config.json`
```json
{
	"features": { "indexedDbSync": true, "analysisPage": true },
	"api": { "ocrProvider": "stub" }
}
```
Disable Analysis Page by setting `analysisPage: false`.

Feature flags are read in Blaze templates (`layout.js`, `settings.js`) via localStorage overrides (`flag_<name>`). A refresh applies route gating changes.

## Next Enhancements
1. Real OCR (image/PDF upload + provider integration).
2. User rename + reuse across bills; bill title field.
3. More robust percent/fixed validation UI (visual totals meter).
4. Advanced Analysis (pie chart, time series, multi-bill aggregates).
5. Offline merge conflict & stale detection strategy.
6. Tests: unit (computeExpenseSummary), methods validation, offline loader.
7. Decide on TypeScript retention vs full JS (Blaze code uses plain JS modules; models/methods remain TS for now).
8. Import/export (CSV), multi-currency support.
9. Authentication & per-user ownership.
10. Performance tuning & Lighthouse pass.

## Contributing Guidelines
- Keep features incremental; one page / one method at a time.
- Maintain data model single source (`models.ts`).
- Add tests alongside new logic.
- Avoid silent failures; surface errors in UI.
- Remove temporary type shims once real types integrated.

## License
TBD (add license file if distributing publicly).

---
Legacy React layer removed; repository now focuses on a lean Meteor + Blaze implementation.
