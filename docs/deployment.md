# Deployment Documentation

This guide covers deploying Splitly to production using Render.com and Docker.

## Table of Contents

- [Overview](#overview)
- [Render.com Deployment](#rendercom-deployment)
- [Docker Configuration](#docker-configuration)
- [Environment Variables](#environment-variables)
- [Build Process](#build-process)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Overview

Splitly is deployed to **Render.com** using a Docker-based deployment strategy with automatic builds from GitHub.

**Current Production URL:** https://splitly-ryao.onrender.com

**Hosting Details:**
- **Platform:** Render.com
- **Plan:** Free tier (with cold starts)
- **Region:** Oregon (us-west)
- **Container:** Docker (Node.js 18)
- **Database:** MongoDB Atlas (free tier)
- **Uptime Monitor:** UptimeRobot (pings every 5 minutes)

---

## Render.com Deployment

### Prerequisites

1. **GitHub Repository:** Code pushed to GitHub
2. **Render Account:** Sign up at https://render.com
3. **MongoDB Database:** MongoDB Atlas or other provider
4. **API Keys:** Google Gemini API key (optional)

---

### Initial Setup

#### Step 1: Create New Web Service

1. Log in to Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository
4. Select repository: `RajkumarGara/Splitly`
5. Configure service:
   - **Name:** `splitly`
   - **Region:** Oregon (or closest to users)
   - **Branch:** `main` (or `user-profile`)
   - **Environment:** `Docker`

#### Step 2: Configure Environment Variables

Add the following environment variables in Render Dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `MONGO_URL` | `mongodb+srv://...` | MongoDB connection string |
| `ROOT_URL` | `https://splitly-ryao.onrender.com` | App URL |
| `PORT` | `3000` | Server port |
| `GOOGLE_GEMINI_API_KEY` | `your_key_here` | Gemini API key (optional) |
| `NODE_ENV` | `production` | Environment |

**Note:** Mark `MONGO_URL` and `GOOGLE_GEMINI_API_KEY` as **secret** (not synced from `.env`).

#### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render automatically builds and deploys
3. Monitor build logs in real-time
4. Access app at assigned URL

---

### Automatic Deployments

**Render automatically deploys when:**
- Code pushed to `main` branch
- `render.yaml` file modified
- Manual deploy triggered in dashboard

**Build triggers:**
- Git push
- Manual trigger via Render API
- Scheduled rebuilds (optional)

**Deploy time:** ~5-10 minutes (full Docker build)

---

## Docker Configuration

### Dockerfile

**File:** `/Dockerfile`

**Multi-stage build:**
1. **Builder stage:** Build Meteor app
2. **Production stage:** Run Node.js server

**Key steps:**
```dockerfile
# Stage 1: Build
FROM geoffreybooth/meteor-base:3.3.2 as builder
WORKDIR /app
COPY package*.json ./
RUN meteor npm install
COPY . .
RUN meteor build --directory /build --server-only --architecture os.linux.x86_64

# Stage 2: Production
FROM node:18-bullseye-slim
COPY --from=builder /build/bundle /app
WORKDIR /app/programs/server
RUN npm install --production
WORKDIR /app
CMD ["node", "main.js"]
```

**Benefits:**
- Smaller final image (excludes build tools)
- Faster deployments (production dependencies only)
- Better security (minimal attack surface)

---

### render.yaml

**File:** `/render.yaml`

**Blueprint configuration:**
```yaml
services:
  - type: web
    name: splitly
    env: docker
    region: oregon
    plan: free
    envVars:
      - key: MONGO_URL
        sync: false
      - key: ROOT_URL
        value: https://splitly-ryao.onrender.com
      - key: PORT
        value: 3000
      - key: GOOGLE_GEMINI_API_KEY
        sync: false
```

**Blueprint benefits:**
- Infrastructure as code
- Easy to recreate service
- Version control for deployment config

---

## Environment Variables

### Required Variables

#### `MONGO_URL`

MongoDB connection string.

**Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
```

**Get MongoDB URL:**
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create free cluster (M0 tier)
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow all)
5. Copy connection string

---

#### `ROOT_URL`

Full URL where app is accessible.

**Example:**
```
https://splitly-ryao.onrender.com
```

**Important:** Must match actual domain for OAuth and DDP to work.

---

### Optional Variables

#### `GOOGLE_GEMINI_API_KEY`

API key for Gemini AI OCR.

**Get API Key:**
1. Visit https://aistudio.google.com/
2. Create new API key
3. Free tier: 1,500 requests/day

**Without this:** OCR disabled, manual item entry only.

---

#### `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`

OAuth credentials for Google login.

**Setup:**
1. Go to https://console.cloud.google.com/
2. Create new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-app.onrender.com/_oauth/google`

---

## Build Process

### Local Build (Testing)

```bash
# Build Docker image
docker build -t splitly .

# Run container
docker run -p 3000:3000 \
  -e MONGO_URL="mongodb://..." \
  -e ROOT_URL="http://localhost:3000" \
  -e PORT=3000 \
  splitly

# Access app
open http://localhost:3000
```

---

### Render Build Process

1. **Clone repository** from GitHub
2. **Detect Dockerfile** and build image
3. **Execute multi-stage build:**
   - Install Meteor and dependencies
   - Build production bundle
   - Create minimal runtime image
4. **Start container** on port 3000
5. **Run health checks** (HTTP GET on `/`)
6. **Deploy to CDN** (if configured)

**Build logs available in Render Dashboard.**

---

## Monitoring

### Render Built-in Monitoring

**Metrics:**
- CPU usage
- Memory usage
- Request count
- Response times
- Error rates

**Logs:**
- Application logs (stdout/stderr)
- Build logs
- Deployment history

**Alerts:**
- Email notifications on deploy success/failure
- Slack integration available

---

### UptimeRobot Configuration

**Purpose:** Keep app awake on free tier (prevents cold starts).

**Setup:**
1. Sign up at https://uptimerobot.com/
2. Add new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://splitly-ryao.onrender.com`
   - **Interval:** 5 minutes
   - **Alert Contacts:** Your email
3. Save monitor

**Benefits:**
- App stays warm (15-minute idle shutdown avoided)
- Uptime tracking
- Downtime alerts

---

### Custom Monitoring (Optional)

**Tools:**
- **Sentry:** Error tracking
- **LogRocket:** Session replay
- **Google Analytics:** User analytics
- **Datadog:** Full-stack monitoring

---

## Troubleshooting

### Issue: Build Fails

**Common Causes:**
1. Missing dependencies in `package.json`
2. Meteor version mismatch
3. Docker base image outdated

**Solutions:**
```bash
# Test build locally
docker build -t splitly .

# Check Meteor version
meteor --version

# Update dependencies
meteor npm install
```

---

### Issue: App Won't Start

**Symptoms:**
- Container crashes immediately
- Health checks fail
- "Application Error" page

**Check:**
1. Environment variables set correctly
2. MongoDB connection string valid
3. Port 3000 exposed
4. `ROOT_URL` matches actual URL

**Debug:**
```bash
# View logs in Render Dashboard
# Or run container locally with verbose logging
docker run -e DEBUG=* splitly
```

---

### Issue: Cold Starts (15-30 seconds)

**Cause:** Free tier shuts down after 15 minutes of inactivity.

**Solutions:**
1. **UptimeRobot** (recommended): Pings every 5 minutes
2. **Upgrade to paid plan:** No cold starts
3. **Cron job:** Scheduled wake-up pings

---

### Issue: Database Connection Fails

**Symptoms:**
- "Cannot connect to MongoDB"
- Slow queries or timeouts

**Check:**
1. MongoDB Atlas cluster running
2. IP whitelist includes `0.0.0.0/0`
3. Database user credentials correct
4. Connection string format valid

**Test connection:**
```bash
# Using MongoDB Compass or mongosh
mongosh "mongodb+srv://..."
```

---

### Issue: OAuth Login Fails

**Symptoms:**
- "Redirect URI mismatch" error
- "Invalid client" error

**Check:**
1. Google OAuth credentials configured
2. Redirect URI matches: `https://your-app.onrender.com/_oauth/google`
3. OAuth consent screen configured
4. `ROOT_URL` environment variable correct

---

## Performance Optimization

### 1. Enable Gzip Compression

Already enabled in Meteor by default.

### 2. Use CDN for Static Assets

**Bootstrap and icons loaded from CDN:**
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
```

### 3. Minimize Docker Image Size

**Current optimizations:**
- Multi-stage build
- Production dependencies only
- Slim base image (Node 18 Bullseye Slim)

**Image size:** ~250MB (down from ~1GB without optimization)

---

### 4. Database Indexing

**Add indexes for common queries:**
```javascript
// In Meteor shell or MongoDB Atlas
db.bills.createIndex({ userId: 1, createdAt: -1 });
```

---

## Scaling

### Horizontal Scaling

**Render supports:**
- Multiple instances (paid plans)
- Load balancing
- Auto-scaling based on CPU/memory

**Configuration:**
```yaml
services:
  - type: web
    name: splitly
    env: docker
    scaling:
      minInstances: 2
      maxInstances: 10
```

---

### Database Scaling

**MongoDB Atlas:**
- Upgrade cluster tier (M10, M20, etc.)
- Enable sharding
- Add read replicas
- Use connection pooling

---

## Backup and Disaster Recovery

### Database Backups

**MongoDB Atlas (Free Tier):**
- Automatic daily snapshots
- 1-day retention

**Manual Backup:**
```bash
mongodump --uri="mongodb+srv://..." --out=backup-$(date +%Y%m%d)
```

---

### Application Backup

**Code:**
- Git repository (GitHub)
- Deployment blueprint (render.yaml)

**Environment Variables:**
- Export from Render Dashboard
- Store securely (password manager)

**Recovery:**
1. Clone repository
2. Create new Render service
3. Import environment variables
4. Deploy from Git

---

## Cost Considerations

### Free Tier (Current)

**Included:**
- 750 hours/month (enough for 1 service)
- Automatic SSL
- Automatic deploys from Git
- Basic monitoring

**Limitations:**
- Cold starts after 15 minutes inactivity
- Lower CPU/memory priority
- Shared resources

---

### Paid Plans (Optional Upgrades)

**Starter ($7/month):**
- No cold starts
- Dedicated resources
- Better performance

**Standard ($25/month):**
- Auto-scaling
- Custom domains
- Advanced monitoring

---

## Security Best Practices

### 1. Environment Variables

- Never commit secrets to Git
- Use Render's secret management
- Rotate API keys regularly

### 2. HTTPS

- Enabled by default on Render
- SSL certificates auto-renewed

### 3. Content Security Policy

Already configured in `/server/main.ts`:
```javascript
res.setHeader('Content-Security-Policy', "default-src 'self'; ...");
```

### 4. Rate Limiting

Implemented in Meteor methods (5 requests per 60 seconds).

---

## CI/CD Pipeline

**Current Setup:**
```
Git Push → GitHub → Render Webhook → Docker Build → Deploy
```

**Future Enhancements:**
- GitHub Actions for testing
- Automated security scanning
- Staging environment
- Blue-green deployments

---

## Useful Commands

### Render CLI

```bash
# Install Render CLI
npm install -g @render-cli/render-cli

# Login
render login

# Deploy
render deploy

# View logs
render logs -f

# Restart service
render restart
```

---

### Docker Commands

```bash
# Build locally
docker build -t splitly .

# Run locally
docker run -p 3000:3000 -e MONGO_URL="..." splitly

# View logs
docker logs <container_id>

# Shell into container
docker exec -it <container_id> /bin/bash

# Clean up
docker system prune -a
```

---

## Resources

- [Render Documentation](https://render.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Meteor Deployment Guide](https://docs.meteor.com/deploy.html)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
