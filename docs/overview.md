# Splitly - Project Overview

## Introduction

Splitly is a full-stack web application for splitting expenses and bills among multiple people. It features AI-powered receipt scanning using Google Gemini, offline support, and a mobile-friendly interface built with Meteor, Blaze, and Bootstrap.

## Live Application

**URL:** https://splitly-ryao.onrender.com

## Core Features

### 1. AI-Powered Receipt Scanning
- **OCR Engine:** Google Gemini 2.5 Flash
- **Accuracy:** 95%+ recognition rate
- **Processing Time:** 10-30 seconds
- **Supported Formats:** JPEG, PNG
- **Smart Features:**
  - Automatic store name detection (Walmart, Costco, Halal Market, etc.)
  - Discount handling (subtracts discounts from item prices)
  - Date and time extraction
  - Tax calculation and validation

### 2. Bill Management
- Create bills with multiple items and users
- Edit items, prices, and tax amounts
- Delete bills with confirmation
- Historical bill tracking
- Receipt date and store name metadata

### 3. Flexible Splitting Options
- **Equal Split:** Divide items equally among selected users
- **Percentage Split:** Assign custom percentages to each user
- **Fixed Amount Split:** Set specific dollar amounts per user
- **Hybrid Splitting:** Mix different split types within one bill

### 4. Offline Support
- **IndexedDB Caching:** Bills cached locally for offline access
- **Service Worker:** PWA support with background sync
- **Automatic Sync:** Data syncs when connection restored
- **Manual Cache Management:** Option to disable caching in settings

### 5. User Management
- Google OAuth authentication
- User profiles with display names
- Global user directory (reuse users across bills)
- Account deletion and data export

## Technology Stack

### Backend
- **Framework:** Meteor 3.x
- **Language:** TypeScript + JavaScript
- **Database:** MongoDB (NoSQL)
- **Authentication:** Accounts-base + OAuth
- **API:** Meteor Methods and Publications

### Frontend
- **Template Engine:** Blaze
- **UI Framework:** Bootstrap 5
- **Icons:** Bootstrap Icons
- **Routing:** Flow Router Extra
- **State Management:** ReactiveVar

### AI & OCR
- **Provider:** Google Generative AI (Gemini 2.5 Flash)
- **Features:** Vision API, structured output, adaptive token scaling
- **Fallback:** Client-side validation and error handling

### Infrastructure
- **Hosting:** Render.com (Docker-based deployment)
- **Uptime Monitoring:** UptimeRobot (prevents cold starts)
- **Container:** Docker multi-stage build
- **CDN:** Render's built-in CDN

### Offline & Storage
- **PWA:** Service Worker with cache-first strategy
- **Local Storage:** IndexedDB via `idb` library
- **Cache Invalidation:** Version-based with automatic updates

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Blaze     │  │  IndexedDB  │  │   Service   │     │
│  │  Templates  │  │   Cache     │  │   Worker    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                         │
                         │ DDP (WebSocket)
                         │
┌─────────────────────────────────────────────────────────┐
│                    Meteor Server                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Methods   │  │ Publications│  │  Accounts   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐ ┌─────▼─────┐ ┌───────▼────────┐
│    MongoDB     │ │  Gemini   │ │  Google OAuth  │
│   Database     │ │   AI API  │ │    Provider    │
└────────────────┘ └───────────┘ └────────────────┘
```

## Project Structure

```
Splitly/
├── client/                 # Client entry point
│   ├── main.js            # App initialization, PWA setup
│   └── styles/            # Global CSS files
├── server/                 # Server entry point
│   └── main.ts            # Environment setup, security headers
├── imports/
│   ├── api/               # Backend logic
│   │   ├── models.ts      # TypeScript interfaces and data models
│   │   ├── bills.ts       # Bill CRUD methods
│   │   ├── users.ts       # User management methods
│   │   ├── accounts.ts    # Authentication configuration
│   │   ├── publications.ts # Data publications
│   │   ├── geminiOcr.ts   # Gemini AI integration
│   │   ├── receiptParsers.ts # Store-specific parsers
│   │   └── receiptUtils.ts # Parsing utility functions
│   ├── ui/blaze/          # Frontend UI
│   │   ├── layout.html/js # Main layout and navigation
│   │   ├── components/    # Reusable UI components
│   │   └── pages/         # Page templates
│   ├── infra/             # Infrastructure code
│   │   └── indexedDb.ts   # Offline caching
│   └── startup/           # Initialization code
│       └── client/routes.js # Client-side routing
├── config/                 # Configuration files
│   └── app.config.json    # Feature flags
├── docs/                   # Documentation (this folder)
├── public/                 # Static assets
│   ├── manifest.json      # PWA manifest
│   ├── service-worker.js  # Service worker for offline
│   └── icons/             # App icons
├── scripts/                # Build scripts
│   └── update-cache-version.js # Cache busting
├── Dockerfile             # Docker build configuration
├── render.yaml            # Render deployment blueprint
└── package.json           # Dependencies and scripts
```

## Key Design Decisions

### 1. Meteor Framework
- **Why:** Full-stack JavaScript, real-time data sync, easy deployment
- **Benefits:** DDP protocol, reactive data, built-in auth, MongoDB integration
- **Trade-offs:** Smaller ecosystem than React/Next.js, learning curve

### 2. Blaze Template Engine
- **Why:** Native Meteor integration, simple syntax, fast rendering
- **Benefits:** Minimal boilerplate, reactive helpers, event handling
- **Trade-offs:** Less popular than React, fewer third-party components

### 3. MongoDB Database
- **Why:** Flexible schema, JSON-like documents, native Meteor support
- **Benefits:** Easy to iterate on data models, no migrations needed
- **Trade-offs:** No foreign keys, eventual consistency

### 4. Google Gemini AI
- **Why:** Best-in-class vision API, structured output, generous free tier
- **Benefits:** 95%+ accuracy, handles discounts, fast processing
- **Trade-offs:** Requires API key, rate limits, internet connection

### 5. Render.com Hosting
- **Why:** Free tier, Docker support, automatic deployments
- **Benefits:** Zero-config CI/CD, managed MongoDB, SSL included
- **Trade-offs:** Cold starts (mitigated with UptimeRobot)

## Data Flow Examples

### Creating a Bill with OCR
1. User uploads receipt image on dashboard
2. Client compresses image and sends to server via `ocr.extractFromImage` method
3. Server calls Gemini AI API with adaptive token scaling
4. Gemini returns structured JSON with items, prices, and totals
5. Server creates bill document with extracted data
6. Bill published to client via DDP subscription
7. IndexedDB cache updated for offline access
8. User navigates to split page to assign users

### Splitting a Bill
1. User assigns people to items on split page
2. Client calculates expense summary using `computeExpenseSummary`
3. User can adjust split types (equal, percent, fixed)
4. Changes saved to MongoDB via `bills.updateItems` method
5. Summary updated reactively in UI
6. Bill visible in history page with full breakdown

## Security Features

### Content Security Policy
- Strict CSP headers preventing XSS attacks
- Whitelisted domains for Google OAuth
- Frame-ancestors protection

### Authentication
- OAuth 2.0 via Google
- Password hashing with bcrypt
- Rate limiting on login attempts (5 per minute)
- CSRF protection via Meteor's built-in tokens

### Data Validation
- Input sanitization on all methods
- Type checking with `check` package
- Length limits on user input
- SQL injection prevention (NoSQL database)

### Ownership Verification
- Bills tied to user accounts
- Authorization checks on all mutations
- No public bill sharing (private by default)

## Performance Optimizations

### Client-Side
- Lazy loading of routes and templates
- Image compression before upload (max 1MB)
- IndexedDB caching for offline access
- Service worker cache-first strategy
- Debouncing on search inputs

### Server-Side
- Efficient MongoDB queries with indexes
- Adaptive token scaling for Gemini API
- Rate limiting to prevent abuse
- Gzip compression on responses
- Minimal publications (user's bills only)

### Build-Time
- Multi-stage Docker build (smaller image)
- Tree-shaking and minification
- Cache busting with version numbers
- CDN-hosted Bootstrap and icons

## Browser Support

- **Chrome/Edge:** Full support (recommended)
- **Firefox:** Full support
- **Safari:** Full support with minor PWA limitations
- **Mobile Safari:** Full support
- **Chrome Android:** Full support with PWA

## Known Limitations

1. **OCR Accuracy:** Dependent on image quality and receipt format
2. **Cold Starts:** First request after 15 minutes of inactivity takes ~30 seconds
3. **Mobile Camera:** iOS Safari requires https for camera access
4. **Offline Editing:** Changes made offline sync on reconnection (no conflict resolution)
5. **Bill Sharing:** No collaborative editing (single-owner only)

## Future Enhancements

- [ ] Real-time collaborative bill editing
- [ ] PDF receipt support
- [ ] Export bills to CSV/Excel
- [ ] Multi-currency support
- [ ] Payment integration (Venmo, PayPal)
- [ ] Receipt history and analytics
- [ ] Push notifications for bill updates
- [ ] Dark mode improvements
- [ ] Email/SMS reminders for outstanding balances
- [ ] Split bill links (shareable URLs)

## Contributing

See the main [README.md](../README.md) for contribution guidelines.

## License

MIT License - see [LICENSE](../LICENSE) file
