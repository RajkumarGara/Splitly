# Splitly

A simple, offline-friendly expense splitting app built with Meteor, Blaze, and Bootstrap.

## 🚀 Live Demo

**App URL:** https://splitly-ryao.onrender.com

## ✨ Features

- 🧾 **AI-Powered Receipt Scanning** - Extract items automatically using Google Gemini AI with 95%+ accuracy
- 💰 **Split Bills Easily** - Add items and split costs among multiple people
- 🎯 **Flexible Splitting** - Equal, percentage, or fixed amount splits per item
- 📱 **Mobile Friendly** - Scan receipts with your phone camera
- 🔌 **Offline Support** - Works offline with IndexedDB caching
- 📊 **Bill History** - View and manage past bills
- 🏪 **Smart Store Detection** - Automatically recognizes Walmart, Costco, and more

## 🛠️ Tech Stack

### **Hosting & Infrastructure**
- **Hosting:** Render.com (dynamic app with server-side processing)
- **Uptime:** UptimeRobot (keeps app awake since the Render app sleeps after 15 minutes of inactivity and takes around 30 seconds to wake up)
- **Deployment:** Docker-based with `render.yaml` blueprint

### **Core Technologies**
- **Framework:** Meteor (full-stack JavaScript)
- **Language:** JavaScript + TypeScript
- **Frontend:** Blaze + Bootstrap 5 + Bootstrap Icons
- **Database:** MongoDB (NoSQL)
- **Offline Storage:** IndexedDB
- **Routing:** Flow Router Extra

### **OCR (Optical Character Recognition)**
- **Primary:** Gemini 2.5 Flash (fast, accurate, handles discounts)
  - 📝 Client-side OCR
  - 🔄 Automatic fallback when Gemini unavailable
  - ⏱️ 10-30 second processing

### **Receipt Intelligence**
- Custom parsers for Walmart, Costco, Halal Market, and generic receipts
- Automatic store name detection and normalization
- Image optimization (compression before OCR for faster processing)
- Discount and tax calculation handling

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/RajkumarGara/Splitly.git
cd Splitly

# Install dependencies
meteor npm install

# Create .env file for Google Gemini API key (optional)
echo "GOOGLE_GEMINI_API_KEY=your_api_key_here" > .env

# Start development server
npm start
```

Open http://localhost:3000 in your browser.

### **Getting Google Gemini API Key (Free)**

1. Visit https://aistudio.google.com/
2. Click "Get API key" → Create new API key
3. Copy the key and add it to your `.env` file
4. Free tier: 1,500 requests/day, no credit card required

## 🏗️ Project Structure

```
client/                 # Client-side entry point
server/                 # Server-side code
imports/
  api/                  # Collections, methods, publications
    geminiOcr.ts       # Google Gemini AI integration
    receiptParsers.ts  # Store-specific receipt parsers
    bills.ts           # Bill management methods
    users.ts           # User management
  ui/blaze/            # Blaze templates and components
  infra/               # IndexedDB and infrastructure
  startup/             # App initialization
config/                 # Configuration files
.env                    # Environment variables (API keys)
```

## 🚢 Deployment

This app is deployed on Render.com using Docker. To deploy your own instance:

1. Fork this repository
2. Sign up at [Render.com](https://render.com)
3. Add your Google Gemini API key as environment variable
4. Create a new Blueprint and connect your forked repository
5. Render will automatically detect `render.yaml` and deploy

### **Environment Variables**
```bash
GOOGLE_GEMINI_API_KEY=your_api_key_here  # Required for AI-powered OCR
```

## 📝 Scripts

```bash
npm start          # Start development server
npm run lint       # Check code quality with ESLint
npm run lint:fix   # Auto-fix linting issues
npm run build      # Build for production
```

## 🎯 How It Works

1. **📸 Scan/Upload Receipt** - Take a photo or upload an image
2. **🤖 AI Processing** - Gemini AI extracts items, prices, and totals
3. **✅ Review & Edit** - Verify extracted items and make adjustments
4. **👥 Add People** - Select who participated in the bill
5. **💸 Split Costs** - Assign items to people (equal, percentage, or fixed splits)
6. **📊 View Summary** - See who owes what with automatic tax calculation

## 🔧 Development

### **Code Quality**
- ESLint with TypeScript support
- Type safety with TypeScript definitions
- Automatic code formatting

### **Testing Locally**
```bash
# Start MongoDB and Meteor
npm start

# Test receipt scanning with sample images
# Upload receipts from Walmart, Costco, or any store
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Google Gemini AI for intelligent receipt processing
- Meteor community for the excellent framework
- Bootstrap team for the beautiful UI components
