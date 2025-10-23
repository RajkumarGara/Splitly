# Build stage
FROM geoffreybooth/meteor-base:2.15 as builder

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
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache bash

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
