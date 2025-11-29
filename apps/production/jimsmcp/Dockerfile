FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/
COPY src/ ./src/

# Run as non-root user
USER node

# Expose port for MCP HTTP server
EXPOSE 3000

# Start the HTTP server
CMD ["node", "dist/http-server.js"]
