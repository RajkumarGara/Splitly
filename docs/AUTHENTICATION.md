# Authentication Documentation

This document covers user authentication and account management in Splitly.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Google OAuth Integration](#google-oauth-integration)
- [User Accounts](#user-accounts)
- [Security](#security)
- [Account Management](#account-management)

---

## Overview

Splitly uses Meteor's **accounts-base** package for authentication, with **Google OAuth** as the primary login method.

**Authentication Features:**
- Google OAuth 2.0 login
- User profiles with custom fields
- Session management (30-day expiration)
- Account deletion
- Password management (for email/password users)

**Security Features:**
- Rate limiting on login attempts
- CSRF protection
- Secure session cookies
- Password hashing with bcrypt

---

## Authentication Methods

### Supported Methods

#### 1. Google OAuth (Primary)

**Benefits:**
- No password management needed
- Trusted authentication provider
- User email verification included
- Profile picture and name available

**Flow:**
```
User clicks "Sign in with Google"
  ↓
OAuth popup opens
  ↓
User authorizes app
  ↓
Google returns access token
  ↓
Meteor creates/updates user account
  ↓
User logged in automatically
```

---

#### 2. Email/Password (Optional)

**Not currently configured**, but Meteor supports it:

```javascript
// Server-side configuration
Accounts.config({
  forbidClientAccountCreation: false
});

// Client-side usage
await Accounts.createUserAsync({
  email: 'user@example.com',
  password: 'securepassword'
});
```

---

## Google OAuth Integration

### Configuration

**File:** `/imports/api/accounts.ts`

**Environment Variables:**
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

---

### Setup Google OAuth

#### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Create new project: "Splitly"
3. Enable APIs:
   - Google+ API
   - People API (optional)

---

#### Step 2: Configure OAuth Consent Screen

1. Navigate to **OAuth consent screen**
2. Choose **External** user type
3. Fill in app information:
   - **App name:** Splitly
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Save and continue

---

#### Step 3: Create OAuth Credentials

1. Navigate to **Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://your-app.onrender.com` (production)
5. Authorized redirect URIs:
   - `http://localhost:3000/_oauth/google` (development)
   - `https://your-app.onrender.com/_oauth/google` (production)
6. Save credentials

**Copy Client ID and Client Secret** to `.env` file.

---

### Server-Side Configuration

**Code in `/imports/api/accounts.ts`:**

```typescript
import { ServiceConfiguration } from 'meteor/service-configuration';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  Meteor.startup(async () => {
    await ServiceConfiguration.configurations.upsertAsync(
      { service: 'google' },
      {
        $set: {
          clientId: googleClientId,
          secret: googleClientSecret,
          loginStyle: 'popup'  // or 'redirect'
        }
      }
    );
    console.log('✅ Google OAuth configured');
  });
}
```

---

### Client-Side Login

**Login Button:**

```html
<button id="googleLoginBtn" class="btn btn-primary">
  <i class="bi bi-google"></i>
  Sign in with Google
</button>
```

**Event Handler:**

```javascript
Template.Login.events({
  'click #googleLoginBtn'(e) {
    e.preventDefault();
    
    Meteor.loginWithGoogle({
      requestPermissions: ['email', 'profile']
    }, (error) => {
      if (error) {
        pushAlert('error', 'Login failed: ' + error.reason);
      } else {
        pushAlert('success', 'Welcome!');
        FlowRouter.go('/');
      }
    });
  }
});
```

---

### OAuth Data Structure

**User document after Google OAuth:**

```javascript
{
  _id: 'user_abc123',
  emails: [
    {
      address: 'user@gmail.com',
      verified: true
    }
  ],
  services: {
    google: {
      id: 'google_user_id_12345',
      email: 'user@gmail.com',
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://lh3.googleusercontent.com/...',
      locale: 'en',
      accessToken: 'ya29.a0...',
      idToken: 'eyJh...',
      expiresAt: 1634567890000,
      refreshToken: '1//0g...'
    }
  },
  profile: {
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://lh3.googleusercontent.com/...'
  },
  createdAt: ISODate('2024-10-15T10:30:00Z')
}
```

---

## User Accounts

### User Profile Structure

**Interface:** `/imports/api/accounts.ts`

```typescript
interface UserProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
}
```

---

### Account Creation Hook

**Customize user on creation:**

```typescript
Accounts.onCreateUser((options, user) => {
  const profile: UserProfile = {
    displayName: '',
    firstName: '',
    lastName: '',
    bio: '',
    avatar: ''
  };

  // Extract from Google OAuth
  if (user.services?.google) {
    profile.displayName = user.services.google.name;
    profile.firstName = user.services.google.given_name;
    profile.lastName = user.services.google.family_name;
    profile.avatar = user.services.google.picture;
  }

  // Merge with provided profile
  if (options.profile) {
    Object.assign(profile, options.profile);
  }

  return { ...user, profile };
});
```

---

### Session Management

**Configuration:**

```typescript
Accounts.config({
  loginExpirationInDays: 30,  // Sessions expire after 30 days
  sendVerificationEmail: false,
  forbidClientAccountCreation: false
});
```

**Check login state:**

```javascript
// Reactive (re-runs when state changes)
if (Meteor.userId()) {
  console.log('User is logged in');
}

// Non-reactive (single check)
const userId = Tracker.nonreactive(() => Meteor.userId());
```

---

## Security

### Password Hashing

**Algorithm:** bcrypt (Meteor default)

**Rounds:** 10 (configurable)

**Server-only:** Passwords never sent to client

```javascript
// Set password (server-side only)
await Accounts.setPasswordAsync(userId, newPassword);

// Verify password (server-side only)
const result = await Accounts._checkPasswordAsync(user, password);
```

---

### Rate Limiting

**Prevent brute-force attacks:**

```typescript
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';

// Limit login attempts
DDPRateLimiter.addRule(
  {
    type: 'method',
    name: 'login'
  },
  5,      // Max 5 attempts
  60000   // per 60 seconds
);
```

**Also applies to:**
- `updateUserProfile`
- `user.changePassword`
- `deleteAccount`

---

### CSRF Protection

**Meteor includes CSRF protection by default:**
- Method calls require valid connection token
- Token rotates on login/logout
- Cannot be called from external domains

---

### Content Security Policy

**Configured in `/server/main.ts`:**

```javascript
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://accounts.google.com; " +
  "connect-src 'self' https://accounts.google.com; " +
  "frame-src https://accounts.google.com;"
);
```

**Allows:**
- Google OAuth popup
- Google APIs
- Self-hosted scripts only

---

### Secure Cookies

**Meteor sets secure cookies automatically:**
- `HttpOnly` flag (prevents JavaScript access)
- `Secure` flag (HTTPS only in production)
- `SameSite=Lax` (CSRF protection)

---

## Account Management

### Update Profile

**Method:** `updateUserProfile`

**Usage:**

```javascript
await Meteor.callAsync('updateUserProfile', {
  displayName: 'Jane Smith',
  bio: 'Expense tracking enthusiast'
});
```

**Validation:**
- All fields optional
- String fields trimmed
- Length limits enforced:
  - Name fields: 50 chars
  - Bio: 500 chars
  - Avatar URL: 500 chars

---

### Change Password

**Method:** `user.changePassword`

**Usage:**

```javascript
try {
  await Meteor.callAsync('user.changePassword', oldPass, newPass);
  pushAlert('success', 'Password changed');
} catch (error) {
  pushAlert('error', error.reason);
}
```

**Requirements:**
- New password ≥ 8 characters
- Old password must be correct

---

### Delete Account

**Method:** `deleteAccount`

**Usage:**

```javascript
const confirmed = await showConfirm(
  'Are you sure? This will delete all your bills and cannot be undone.',
  { okText: 'Delete Account', okButtonClass: 'btn-danger' }
);

if (confirmed) {
  try {
    await Meteor.callAsync('deleteAccount', password);
    pushAlert('success', 'Account deleted');
    FlowRouter.go('/login');
  } catch (error) {
    pushAlert('error', error.reason);
  }
}
```

**Side effects:**
- Deletes all bills owned by user
- Removes user account
- Logs out user
- **Cannot be undone**

---

### Logout

**Client-side:**

```javascript
Meteor.logout((error) => {
  if (error) {
    pushAlert('error', 'Logout failed');
  } else {
    pushAlert('success', 'Logged out');
    FlowRouter.go('/login');
  }
});
```

**Server-side force logout:**

```javascript
// Invalidate all sessions for user
await Meteor.users.updateAsync(userId, {
  $set: { 'services.resume.loginTokens': [] }
});
```

---

## Route Protection

**Middleware in `/imports/startup/client/routes.js`:**

```javascript
function requireAuth(context, redirect) {
  if (!Tracker.nonreactive(() => Meteor.userId()) && 
      !Tracker.nonreactive(() => Meteor.loggingIn())) {
    redirect('/login');
  }
}

// Apply to protected routes
FlowRouter.route('/dashboard', {
  triggersEnter: [requireAuth],
  action() { render('Dashboard'); }
});
```

**Auto-redirect:**
- Unauthenticated users → `/login`
- Authenticated users at `/login` → `/`

---

## User Publication

**Subscribe to current user data:**

```javascript
Template.myTemplate.onCreated(function() {
  this.subscribe('userData');
});
```

**Publication (server-side):**

```typescript
Meteor.publish('userData', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find(
    { _id: this.userId },
    { fields: { profile: 1, emails: 1, createdAt: 1 } }
  );
});
```

**Filters:**
- Only current user's data
- Limited fields (no sensitive data)
- Services data excluded

---

## Best Practices

### 1. Always Check Authentication

```javascript
// ✅ Good - server-side method
Meteor.methods({
  async 'myMethod'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'Login required');
    }
    // Method logic
  }
});

// ❌ Bad - no auth check
Meteor.methods({
  async 'myMethod'() {
    // Anyone can call this!
  }
});
```

---

### 2. Use Non-Reactive Checks in Triggers

```javascript
// ✅ Good - prevents multiple redirects
function requireAuth(context, redirect) {
  if (!Tracker.nonreactive(() => Meteor.userId())) {
    redirect('/login');
  }
}

// ❌ Bad - reactive, causes issues
function requireAuth(context, redirect) {
  if (!Meteor.userId()) {  // Reactive!
    redirect('/login');
  }
}
```

---

### 3. Handle Login Errors

```javascript
// ✅ Good - proper error handling
Meteor.loginWithGoogle({}, (error) => {
  if (error) {
    if (error.error === 'Accounts.LoginCancelledError') {
      // User closed popup - don't show error
      return;
    }
    pushAlert('error', error.reason || 'Login failed');
  } else {
    pushAlert('success', 'Welcome!');
  }
});
```

---

### 4. Validate Profile Updates

```javascript
// ✅ Good - client-side validation first
const displayName = input.value.trim();
if (!displayName || displayName.length > 50) {
  pushAlert('error', 'Name must be 1-50 characters');
  return;
}

await Meteor.callAsync('updateUserProfile', { displayName });
```

---

## Troubleshooting

### Issue: Google OAuth popup blocked

**Cause:** Browser popup blocker

**Solutions:**
1. Click login button (user-initiated action)
2. Use `loginStyle: 'redirect'` instead of `'popup'`
3. Whitelist domain in browser settings

---

### Issue: "Redirect URI mismatch" error

**Cause:** OAuth redirect URI not configured correctly

**Solutions:**
1. Check Google Cloud Console credentials
2. Verify redirect URI matches exactly:
   - Development: `http://localhost:3000/_oauth/google`
   - Production: `https://your-domain.com/_oauth/google`
3. No trailing slashes
4. Protocol must match (http vs https)

---

### Issue: User logged out unexpectedly

**Possible causes:**
1. Session expired (30 days)
2. User cleared cookies/cache
3. Server restart invalidated sessions

**Solutions:**
- Increase `loginExpirationInDays`
- Implement "Remember Me" checkbox
- Show login prompt when session expires

---

### Issue: Rate limit error

**Cause:** Too many login attempts

**Solutions:**
- Wait 60 seconds
- Implement better error messages
- Add captcha for repeated failures (future enhancement)

---

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Email/password login option
- [ ] Social login (Facebook, GitHub)
- [ ] Account recovery (forgot password)
- [ ] Email verification
- [ ] Session management UI (view/revoke sessions)
- [ ] Login activity log
- [ ] Anonymous/guest mode

---

## Resources

- [Meteor Accounts Documentation](https://docs.meteor.com/api/accounts.html)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
