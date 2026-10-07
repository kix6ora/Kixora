# syntax=docker/dockerfile:1

# ---- Builder Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install ALL deps (dev + prod) needed for build
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# ---- Runtime Stage ----
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Re-install ONLY production dependencies (separate layer for cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Security: run as non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
