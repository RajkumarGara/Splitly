# Splitly Documentation

Welcome to the Splitly documentation! This directory contains comprehensive guides covering all aspects of the application.

## 📚 Documentation Index

### Core Documentation

1. **[Overview](./overview.md)** - Project overview, architecture, and technology stack
   - Introduction and features
   - Tech stack breakdown
   - Architecture diagrams
   - Project structure
   - Design decisions

2. **[Development Guide](./development.md)** - Setup and development workflow
   - Getting started
   - Development environment setup
   - Code standards and best practices
   - Common development tasks
   - Debugging techniques

3. **[Deployment](./deployment.md)** - Production deployment guide
   - Render.com deployment
   - Docker configuration
   - Environment variables
   - Monitoring and troubleshooting

---

### Technical Documentation

4. **[API Documentation](./api.md)** - Meteor methods and publications
   - Bill management methods
   - User management methods
   - OCR extraction methods
   - Account management
   - Publications and subscriptions

5. **[Database Schema](./database.md)** - MongoDB collections and models
   - Collection structures
   - Data models and interfaces
   - Indexes and queries
   - Calculations and validations

6. **[OCR & Receipt Parsing](./ocr-receipt-parsing.md)** - AI-powered receipt extraction
   - Gemini AI integration
   - Store-specific parsers
   - Receipt utilities
   - Accuracy and testing

---

### Feature Documentation

7. **[Authentication](./authentication.md)** - User authentication and security
   - Google OAuth setup
   - Account management
   - Security features
   - Session management

8. **[UI Components](./ui-components.md)** - Frontend templates and components
   - Blaze templates
   - Page components
   - Routing
   - Styling and responsive design

9. **[Offline Support](./offline-support.md)** - PWA and offline capabilities
   - Service Worker implementation
   - IndexedDB caching
   - Installation guide
   - Cache management

---

## 🚀 Quick Start

New to Splitly? Start here:

1. Read the **[Overview](./overview.md)** to understand the project
2. Follow the **[Development Guide](./development.md)** to set up your environment
3. Explore the **[API Documentation](./api.md)** to understand available methods
4. Check the **[UI Components](./ui-components.md)** to work with the frontend

---

## 🔍 Find What You Need

### I want to...

**Set up the development environment**
→ [Development Guide](./development.md#getting-started)

**Deploy to production**
→ [Deployment](./deployment.md)

**Understand the database structure**
→ [Database Schema](./database.md)

**Add a new feature**
→ [Development Guide](./development.md#feature-development)

**Configure Google OAuth**
→ [Authentication](./authentication.md#google-oauth-integration)

**Improve OCR accuracy**
→ [OCR & Receipt Parsing](./ocr-receipt-parsing.md#testing-and-accuracy)

**Create a new page**
→ [UI Components](./ui-components.md#add-new-page)

**Enable offline mode**
→ [Offline Support](./offline-support.md#indexeddb-caching)

---

## 📖 Documentation Structure

Each documentation file follows a consistent structure:

- **Overview** - Introduction and purpose
- **Table of Contents** - Quick navigation
- **Detailed Sections** - In-depth explanations
- **Code Examples** - Practical usage
- **Troubleshooting** - Common issues and solutions
- **Best Practices** - Recommended approaches
- **Future Enhancements** - Planned improvements
- **Resources** - External links

---

## 🛠️ Technology Stack Reference

| Component | Technology | Documentation |
|-----------|-----------|---------------|
| **Backend** | Meteor + TypeScript | [API](./api.md), [Database](./database.md) |
| **Frontend** | Blaze + Bootstrap 5 | [UI Components](./ui-components.md) |
| **Database** | MongoDB | [Database Schema](./database.md) |
| **AI/OCR** | Google Gemini | [OCR](./ocr-receipt-parsing.md) |
| **Auth** | OAuth 2.0 | [Authentication](./authentication.md) |
| **Hosting** | Render.com + Docker | [Deployment](./deployment.md) |
| **Offline** | Service Worker + IndexedDB | [Offline Support](./offline-support.md) |

---

## 📝 Code Examples

### Create a Bill

```javascript
const billId = await Meteor.callAsync('bills.insert', {
  users: [],
  items: [],
  createdAt: new Date(),
  storeName: 'Walmart',
  taxAmount: 0
});
```

See: [API Documentation](./api.md#billsinsert)

---

### Extract Receipt with OCR

```javascript
const itemCount = await Meteor.callAsync(
  'ocr.extractFromImage', 
  billId, 
  base64Image
);
```

See: [OCR Documentation](./ocr-receipt-parsing.md#gemini-ai-integration)

---

### Add User to Bill

```javascript
await Meteor.callAsync('bills.addUser', billId, {
  id: 'user123',
  name: 'John Doe',
  contact: 'john@example.com'
});
```

See: [API Documentation](./api.md#billsadduser)

---

## 🐛 Common Issues

### Build Fails
→ [Deployment Troubleshooting](./deployment.md#issue-build-fails)

### OCR Not Working
→ [OCR Troubleshooting](./ocr-receipt-parsing.md#troubleshooting)

### OAuth Login Fails
→ [Authentication Troubleshooting](./authentication.md#issue-google-oauth-popup-blocked)

### App Not Loading Offline
→ [Offline Troubleshooting](./offline-support.md#issue-data-not-available-offline)

---

## 🔄 Keeping Documentation Updated

When making code changes:

1. **Update relevant documentation** if APIs change
2. **Add examples** for new features
3. **Update troubleshooting** sections with new solutions
4. **Keep code samples** in sync with actual code
5. **Review and test** documentation before committing

---

## 🤝 Contributing to Documentation

Documentation improvements are welcome! 

**Guidelines:**
- Use clear, concise language
- Include code examples where helpful
- Add troubleshooting tips from real issues
- Keep formatting consistent
- Test all code examples

**Process:**
1. Create feature branch
2. Edit relevant `.md` files
3. Test examples work
4. Submit Pull Request

---

## 📚 External Resources

### Meteor
- [Official Documentation](https://docs.meteor.com/)
- [Meteor Guide](https://guide.meteor.com/)
- [Meteor Forums](https://forums.meteor.com/)

### MongoDB
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [MongoDB University](https://university.mongodb.com/)

### Blaze
- [Blaze Guide](https://blazejs.org/guide/introduction.html)
- [Template API](https://docs.meteor.com/api/templates.html)

### Web Technologies
- [MDN Web Docs](https://developer.mozilla.org/)
- [Web.dev](https://web.dev/)

---

## 📞 Support

- **GitHub Issues:** Report bugs and request features
- **Discussions:** Ask questions and share ideas
- **Email:** Contact maintainer for security issues

---

## 📄 License

This documentation is part of the Splitly project and is licensed under the MIT License.

---

**Last Updated:** November 2024

**Documentation Version:** 1.0.0

**Project Version:** See [package.json](../package.json)
