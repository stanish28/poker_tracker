# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build client
RUN cd client && npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S poker -u 1001

# Set working directory
WORKDIR /app

# Copy server dependencies
COPY --from=builder /app/server/package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy server source
COPY --from=builder /app/server ./

# Copy built client
COPY --from=builder /app/client/build ./public

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R poker:nodejs /app

# Switch to non-root user
USER poker

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
