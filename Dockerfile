# Multi-stage build for production-ready TTS API
FROM node:20-alpine AS base

# Install required system dependencies for TTS
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Create app directory and user
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code and TTS files
COPY . .

# Production stage
FROM base AS production
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/index.js ./
COPY --from=builder /app/piper_total ./piper_total

# Make Piper binary executable
RUN chmod +x ./piper_total/piper_new

# Set environment variables
ENV NODE_ENV=production
ENV LD_LIBRARY_PATH=/app/piper_total/piper:$LD_LIBRARY_PATH

# Create directory for temporary audio files
RUN mkdir -p /app/temp && chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application with dumb-init for proper signal handling
CMD ["dumb-init", "node", "index.js"]