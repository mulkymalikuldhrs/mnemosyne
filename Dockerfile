# ============================================================
# Mnemosyne AI Memory SaaS — Multi-stage Dockerfile
# Stage 1: Install dependencies
# Stage 2: Build Next.js
# Stage 3: Production image (minimal)
# ============================================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install bun for dependency installation
RUN npm install -g bun

# Copy package files
COPY package.json bun.lockb* ./

# Copy Prisma schema for client generation
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN npx prisma generate

# --- Stage 2: Build Next.js ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY . .

# Set environment for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./db/build.db

# Build the Next.js application (standalone output)
RUN bun run build

# --- Stage 3: Production image (minimal) ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone Next.js server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and runtime client for database access
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data

# Run as non-root user
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
