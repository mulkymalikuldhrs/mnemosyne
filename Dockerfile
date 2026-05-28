# ============================================================
# NANGGROE IOT — Multi-stage Dockerfile
# Stage 1: Install dependencies
# Stage 2: Build Next.js
# Stage 3: Production image (slim)
# ============================================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lockb* ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bun run db:generate

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

# Build the application
RUN bun run build

# --- Stage 3: Production image (slim) ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and migrations for runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create directories for data and uploads
RUN mkdir -p /app/db /app/uploads && \
    chown -R nextjs:nodejs /app/db /app/uploads

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
