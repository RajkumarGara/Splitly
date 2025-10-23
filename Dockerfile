# Use Node.js LTS version
FROM node:18-alpine

# Install Meteor
RUN apk add --no-cache curl bash && \
    curl https://install.meteor.com/ | sh

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy the entire application
COPY . .

# Build the Meteor application
RUN meteor build --directory /build --server-only

# Switch to the built bundle
WORKDIR /build/bundle/programs/server

# Install production dependencies
RUN npm install

# Switch back to bundle root
WORKDIR /build/bundle

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "main.js"]
