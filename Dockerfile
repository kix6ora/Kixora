# syntax=docker/dockerfile:1

# ---- Builder Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install ALL deps (dev + prod) needed for build
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .
# Live-data production gate inputs (scripts/flags.ts).
# Values come from --build-arg; builder stage only, never runtime.
ARG VITE_USE_SUPABASE_CATALOG
ARG VITE_USE_SUPABASE_DROPS
ARG VITE_USE_SUPABASE_CART
ARG VITE_USE_SUPABASE_WISHLIST
ARG VITE_USE_SUPABASE_ORDERS
ARG VITE_USE_SUPABASE_CHECKOUT
ARG VITE_USE_SUPABASE_AUTH
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_USE_SUPABASE_CATALOG=$VITE_USE_SUPABASE_CATALOG \
    VITE_USE_SUPABASE_DROPS=$VITE_USE_SUPABASE_DROPS \
    VITE_USE_SUPABASE_CART=$VITE_USE_SUPABASE_CART \
    VITE_USE_SUPABASE_WISHLIST=$VITE_USE_SUPABASE_WISHLIST \
    VITE_USE_SUPABASE_ORDERS=$VITE_USE_SUPABASE_ORDERS \
    VITE_USE_SUPABASE_CHECKOUT=$VITE_USE_SUPABASE_CHECKOUT \
    VITE_USE_SUPABASE_AUTH=$VITE_USE_SUPABASE_AUTH \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
