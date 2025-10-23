# Splitly

A simple, offline-friendly expense splitting app built with Meteor, Blaze, and Bootstrap.

## 🚀 Live Demo

**App URL:** https://splitly-ryao.onrender.com

> Note: Free tier sleeps after 15 minutes of inactivity. First request may take ~30 seconds to wake up.

## ✨ Features

- **Split Bills Easily** - Add items and split costs among multiple people
- **Flexible Splitting** - Equal, percentage, or fixed amount splits per item
- **OCR Receipt Scanning** - Extract items from receipts using Tesseract.js
- **Offline Support** - Works offline with IndexedDB caching
- **Bill History** - View and manage past bills
- **Analysis Dashboard** - Track spending patterns
- **Mobile Friendly** - Responsive design that works on any device

## 🛠️ Tech Stack

- **Framework:** Meteor
- **Frontend:** Blaze + Bootstrap 5
- **Database:** MongoDB
- **Offline Storage:** IndexedDB
- **OCR:** Tesseract.js

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/RajkumarGara/Splitly.git
cd Splitly

# Install dependencies
meteor npm install

# Start development server
npm start
```

Open http://localhost:3000 in your browser.

## 🏗️ Project Structure

```
client/                 # Client-side entry point
server/                 # Server-side code
imports/
  api/                  # Collections, methods, publications
  ui/blaze/            # Blaze templates and components
  infra/               # IndexedDB and infrastructure
  startup/             # App initialization
config/                 # Configuration files
```

## 🚢 Deployment

This app is deployed on Render.com using Docker. To deploy your own instance:

1. Fork this repository
2. Sign up at [Render.com](https://render.com)
3. Create a new Blueprint
4. Connect your forked repository
5. Render will automatically detect the `render.yaml` and deploy

## 📝 Scripts

```bash
npm start          # Start development server
npm run lint       # Check code quality
npm run lint:fix   # Fix linting issues
npm run build      # Build for production
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.
