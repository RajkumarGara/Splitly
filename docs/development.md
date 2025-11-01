# Development Guide

This guide covers setting up a local development environment and development workflows for Splitly.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)

---

## Getting Started

### Prerequisites

**Required:**
- **Node.js:** v18 or higher
- **npm:** v8 or higher
- **Meteor:** v3.x
- **Git:** Latest version

**Optional:**
- **MongoDB Compass:** Database GUI
- **VS Code:** Recommended IDE
- **Docker:** For production builds

---

### Installation

#### 1. Install Meteor

```bash
# macOS/Linux
curl https://install.meteor.com/ | sh

# Windows (use Chocolatey)
choco install meteor

# Verify installation
meteor --version
```

---

#### 2. Clone Repository

```bash
git clone https://github.com/RajkumarGara/Splitly.git
cd Splitly
```

---

#### 3. Install Dependencies

```bash
meteor npm install
```

---

#### 4. Configure Environment

Create `.env` file in project root:

```bash
# Google Gemini API Key (optional for OCR)
GOOGLE_GEMINI_API_KEY=your_api_key_here

# Google OAuth (optional for authentication)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

**Get API keys:**
- Gemini: https://aistudio.google.com/
- Google OAuth: https://console.cloud.google.com/

---

#### 5. Start Development Server

```bash
npm start
# or
meteor run
```

**Server starts on:** http://localhost:3000

**Hot reload enabled:** Changes automatically refresh browser.

---

## Development Environment

### Recommended IDE: VS Code

**Extensions:**
- ESLint (code linting)
- Prettier (code formatting)
- Meteor Toolbox (Meteor support)
- TypeScript (type checking)
- GitLens (Git integration)

**Settings (.vscode/settings.json):**
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

### Database: MongoDB

**Meteor uses embedded MongoDB by default:**
- Starts automatically with `meteor run`
- Data stored in `.meteor/local/db`
- No separate installation needed

**Access MongoDB shell:**
```bash
meteor mongo
```

**Connect with MongoDB Compass:**
- **Connection String:** `mongodb://localhost:3001/meteor`
- **Database:** `meteor`

---

### Browser DevTools

**Recommended Browser:** Chrome or Edge

**Useful DevTools:**
- **Console:** View logs and errors
- **Network:** Monitor API calls and DDP messages
- **Application:** Inspect localStorage, IndexedDB, Service Worker
- **Performance:** Profile rendering and JavaScript execution

---

## Project Structure

```
Splitly/
├── .meteor/              # Meteor configuration
│   ├── packages          # Meteor packages
│   └── versions          # Package versions
├── client/               # Client entry point
│   ├── main.js          # App initialization
│   ├── main.html        # HTML root
│   └── styles/          # Global CSS
├── server/               # Server entry point
│   └── main.ts          # Server initialization
├── imports/              # Application code
│   ├── api/             # Backend (methods, publications)
│   ├── ui/blaze/        # Frontend (templates, components)
│   ├── infra/           # Infrastructure (IndexedDB, etc.)
│   └── startup/         # Initialization code
├── public/               # Static assets
│   ├── manifest.json    # PWA manifest
│   ├── service-worker.js # Service worker
│   └── icons/           # App icons
├── config/               # Configuration files
│   └── app.config.json  # Feature flags
├── docs/                 # Documentation
├── scripts/              # Build scripts
├── .env                  # Environment variables (not committed)
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── eslint.config.mjs     # ESLint config
```

---

## Development Workflow

### Feature Development

#### 1. Create Feature Branch

```bash
git checkout -b feature/my-new-feature
```

---

#### 2. Make Changes

Edit files in `imports/` directory.

**Example: Add new Meteor method**

```typescript
// imports/api/bills.ts
Meteor.methods({
  async 'bills.myNewMethod'(param) {
    check(param, String);
    // Implementation
  }
});
```

---

#### 3. Test Locally

```bash
npm start
# Test in browser at http://localhost:3000
```

---

#### 4. Lint and Fix

```bash
npm run lint        # Check for errors
npm run lint:fix    # Auto-fix errors
```

---

#### 5. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

**Commit message format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

#### 6. Push and Create PR

```bash
git push origin feature/my-new-feature
```

Create Pull Request on GitHub.

---

### Code Review Process

1. **Automated Checks:** ESLint runs on PR
2. **Manual Review:** Team reviews code
3. **Approval:** At least 1 approval required
4. **Merge:** Squash and merge to main

---

## Code Standards

### JavaScript/TypeScript

**Style Guide:** Based on Airbnb JavaScript Style Guide

**Key Rules:**
- **Indentation:** 2 spaces (tabs)
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Line length:** Max 120 characters
- **Naming:**
  - camelCase for variables/functions
  - PascalCase for classes/components
  - UPPER_CASE for constants

**Example:**
```javascript
// ✅ Good
const myVariable = 'value';

function myFunction() {
  return true;
}

// ❌ Bad
const my_variable = "value"

function MyFunction() 
{
  return true
}
```

---

### TypeScript Types

**Always use types for:**
- Function parameters
- Return values
- Interface definitions
- Complex objects

**Example:**
```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
}

function getUser(id: string): User | null {
  return Users.findOne(id);
}

// ❌ Bad
function getUser(id) {
  return Users.findOne(id);
}
```

---

### Blaze Templates

**Naming convention:**
- Template name matches file name
- PascalCase for template names
- camelCase for helper/event names

**Example:**
```html
<!-- dashboard.html -->
<template name="Dashboard">
  <div>{{myHelper}}</div>
</template>
```

```javascript
// dashboard.js
Template.Dashboard.helpers({
  myHelper() {
    return 'value';
  }
});
```

---

### CSS

**BEM methodology:**
```css
/* Block */
.item-card { }

/* Element */
.item-card__title { }

/* Modifier */
.item-card--highlighted { }
```

**Use CSS variables for theming:**
```css
:root {
  --primary-color: #0d6efd;
}

.my-element {
  color: var(--primary-color);
}
```

---

## Testing

### Manual Testing

**Test checklist for new features:**
- [ ] Works on desktop (Chrome, Firefox, Safari)
- [ ] Works on mobile (iOS Safari, Chrome Android)
- [ ] Works offline (if applicable)
- [ ] Error handling works
- [ ] Loading states display correctly
- [ ] Data persists after refresh

---

### Browser Testing

**Supported Browsers:**
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS 14+)
- Chrome Android (latest)

**Testing tools:**
- BrowserStack (cross-browser testing)
- Chrome DevTools device emulation

---

### Unit Testing (Future)

**Planned test framework:** Mocha + Chai

**Example test structure:**
```javascript
describe('computeExpenseSummary', function() {
  it('should calculate equal split correctly', function() {
    const bill = { /* test data */ };
    const summary = computeExpenseSummary(bill);
    expect(summary.grandTotal).to.equal(30.00);
  });
});
```

---

## Debugging

### Server-Side Debugging

**Console logging:**
```javascript
console.log('Debug:', variable);
console.error('Error:', error);
```

**Meteor shell:**
```bash
meteor shell
```

```javascript
// In Meteor shell
Bills.find().fetch()  // Query database
Meteor.users.find().count()  // Count users
```

---

### Client-Side Debugging

**Browser console:**
```javascript
// Access collections
Bills.find().fetch()

// Check current user
Meteor.userId()
Meteor.user()

// Inspect reactive variables
Template.instance().myVar.get()
```

**Blaze debugging:**
```javascript
// View template data
Blaze.getView(document.querySelector('.my-element')).templateInstance()
```

---

### DDP Debugging

**Monitor DDP messages:**
```javascript
Meteor.connection._stream.on('message', function(msg) {
  console.log('DDP:', msg);
});
```

**Check subscriptions:**
```javascript
Meteor.connection._subscriptions
```

---

### Network Debugging

**Chrome DevTools → Network tab:**
- Filter by `WebSocket` to see DDP messages
- Check API calls to Gemini
- Monitor image uploads

---

## Common Tasks

### Add New Meteor Method

1. **Define method in API file:**
```typescript
// imports/api/bills.ts
Meteor.methods({
  async 'bills.myMethod'(param) {
    check(param, String);
    // Implementation
    return result;
  }
});
```

2. **Call from client:**
```javascript
const result = await Meteor.callAsync('bills.myMethod', 'value');
```

---

### Add New Page

1. **Create template files:**
```html
<!-- imports/ui/blaze/pages/mypage.html -->
<template name="MyPage">
  <div>My content</div>
</template>
```

```javascript
// imports/ui/blaze/pages/mypage.js
import './mypage.html';

Template.MyPage.onCreated(function() {
  // Initialization
});

Template.MyPage.helpers({
  myData() {
    return 'data';
  }
});
```

2. **Add route:**
```javascript
// imports/startup/client/routes.js
FlowRouter.route('/mypage', {
  name: 'mypage',
  triggersEnter: [requireAuth],
  action() { render('MyPage'); }
});
```

3. **Add navigation link:**
```html
<!-- imports/ui/blaze/layout.html -->
<a href="/mypage">My Page</a>
```

---

### Add New Component

1. **Create component:**
```html
<!-- imports/ui/blaze/components/mycomponent.html -->
<template name="MyComponent">
  <div>{{title}}</div>
</template>
```

```javascript
// imports/ui/blaze/components/mycomponent.js
import './mycomponent.html';

Template.MyComponent.helpers({
  title() {
    return 'Component Title';
  }
});
```

2. **Use component:**
```html
<template name="MyPage">
  {{> MyComponent}}
</template>
```

---

### Update Dependencies

```bash
# Update Meteor
meteor update

# Update npm packages
meteor npm update

# Check for outdated packages
meteor npm outdated

# Update specific package
meteor npm install package@latest
```

---

### Clear Cache

**Clear Meteor build cache:**
```bash
meteor reset
```

**Clear browser cache:**
- Chrome: Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
- Clear Service Worker cache in DevTools → Application → Service Workers

---

### Run Production Build Locally

```bash
# Build app
npm run build

# Navigate to build output
cd ../output/bundle

# Install dependencies
cd programs/server
npm install --production
cd ../..

# Set environment variables and run
MONGO_URL=mongodb://localhost:3001/meteor \
ROOT_URL=http://localhost:3000 \
PORT=3000 \
node main.js
```

---

## Git Workflow

### Branch Naming

- `main` - Production branch
- `develop` - Development branch
- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/topic` - Documentation updates

---

### Commit Messages

**Format:**
```
type(scope): subject

body (optional)

footer (optional)
```

**Example:**
```
feat(bills): add bulk delete functionality

- Add checkbox selection to bill list
- Implement multi-delete API method
- Update UI with delete confirmation

Closes #123
```

---

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested locally
- [ ] Tested on mobile
- [ ] Added/updated tests

## Screenshots
(if applicable)
```

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URL` | Yes (prod) | MongoDB connection | `mongodb://...` |
| `ROOT_URL` | Yes (prod) | App URL | `https://app.com` |
| `PORT` | No | Server port | `3000` |
| `GOOGLE_GEMINI_API_KEY` | No | OCR API key | `AIza...` |
| `GOOGLE_CLIENT_ID` | No | OAuth client ID | `1234...` |
| `GOOGLE_CLIENT_SECRET` | No | OAuth secret | `GOCSPX...` |
| `NODE_ENV` | No | Environment | `production` |

---

## Troubleshooting Development Issues

### Issue: `meteor: command not found`

**Solution:**
```bash
# Reinstall Meteor
curl https://install.meteor.com/ | sh

# Or add to PATH (if installed)
export PATH="$HOME/.meteor:$PATH"
```

---

### Issue: Port 3000 already in use

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
meteor --port 3001
```

---

### Issue: Hot reload not working

**Solution:**
1. Restart Meteor server
2. Clear browser cache
3. Check for JavaScript errors in console
4. Disable browser extensions

---

### Issue: MongoDB connection failed

**Solution:**
```bash
# Reset Meteor database
meteor reset

# Or start with fresh database
rm -rf .meteor/local/db
meteor
```

---

## Resources

- [Meteor Guide](https://guide.meteor.com/)
- [Blaze Tutorial](https://www.meteor.com/tutorials/blaze/creating-an-app)
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
