# Build stage
FROM geoffreybooth/meteor-base:3.3.2 as builder

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install npm dependencies before building
RUN meteor npm install

# Copy rest of application files
COPY . .

# Build the Meteor application
RUN meteor build --directory /build --server-only --architecture os.linux.x86_64

# Production stage
FROM node:18-bullseye-slim

# Install runtime dependencies with updated OpenSSL
RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Set OpenSSL configuration for better compatibility
ENV OPENSSL_CONF=/etc/ssl/openssl.cnf
ENV NODE_OPTIONS="--tls-min-v1.0"
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy built bundle from builder
COPY --from=builder /build/bundle /app

# Set working directory
WORKDIR /app/programs/server

# Install npm dependencies
RUN npm install --production

# Set working directory to app root
WORKDIR /app

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "main.js"]
