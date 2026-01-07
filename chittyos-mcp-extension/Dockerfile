# ChittyOS MCP Extension Docker Image
# Multi-stage build for minimal production image

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY chittymcp.js manifest.json ./

# Install mcpb bundler globally
RUN npm install -g @anthropic-ai/mcpb

# Validate and build the extension
RUN mcpb validate manifest.json && \
    mcpb pack

FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tini

# Copy built extension and dependencies
COPY --from=builder /app/chittyos-mcp-extension.mcpb ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/chittymcp.js ./
COPY --from=builder /app/manifest.json ./
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S chitty && \
    adduser -u 1001 -S chitty -G chitty && \
    chown -R chitty:chitty /app

USER chitty

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./chittymcp.js'); console.log('healthy');" || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the MCP server
CMD ["node", "chittymcp.js"]

# Expose metadata
LABEL org.opencontainers.image.title="ChittyOS MCP Extension" \
      org.opencontainers.image.description="Enterprise-grade legal and business infrastructure with §36 compliance" \
      org.opencontainers.image.version="1.0.1" \
      org.opencontainers.image.vendor="ChittyOS Team" \
      org.opencontainers.image.source="https://github.com/chittyos/cli"