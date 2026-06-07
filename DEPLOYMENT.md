# Memorix — Deployment Guide

> Comprehensive deployment guide for Memorix v4.0 — The Biggest Free Multi-LLM Hub

---

## Table of Contents

- [Web Deployment](#web-deployment)
- [Docker Compose Setup](#docker-compose-setup)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Security Hardening](#security-hardening)
- [SaaS/IaaS Deployment Considerations](#saasiaas-deployment-considerations)
- [Scaling Considerations](#scaling-considerations)

---

## Web Deployment

### Vercel (Recommended for Web)

The easiest way to deploy the Memorix web dashboard. Ideal for the free tier and BYOK use cases.

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Vercel Dashboard Configuration**:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `bun run build` |
| Output Directory | `.next` |
| Install Command | `bun install` |
| Node.js Version | 18.x |

**Environment Variables** (set in Vercel dashboard):

- `DATABASE_URL` — SQLite path (use Turso or PlanetScale for serverless)
- `NEXTAUTH_SECRET` — NextAuth session encryption key
- `NEXTAUTH_URL` — Your deployment URL
- `MEMORIX_API_KEY` — API authentication key

### Docker

Build and run Memorix as a Docker container:

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build
RUN bun run build

# Expose port
EXPOSE 3000

# Start
CMD ["bun", "run", "start"]
```

```bash
# Build image
docker build -t memorix .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=file:./data/memorix.db \
  -e NEXTAUTH_SECRET=your-secret-here \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e MEMORIX_API_KEY=your-api-key \
  -v memorix-data:/app/data \
  memorix
```

### Standalone (Node.js / Bun)

```bash
# Install dependencies
bun install

# Initialize database
bun run db:push
bun run db:generate

# Build
bun run build

# Start production server
bun run start
```

The standalone server uses Next.js built-in server with output optimization.

---

## Docker Compose Setup

The `docker-compose.yml` provides a complete production-ready setup with both the app and MCP server:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/memorix.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET in .env}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
      - MEMORIX_API_KEY=${MEMORIX_API_KEY:-}
    volumes:
      - memorix-data:/app/data
    restart: unless-stopped

  # MCP server uses stdio (stdin/stdout), not HTTP
  # Run with: docker compose run --rm -i mcp
  # Or standalone: docker run -i --rm memorix-mcp
  mcp:
    build:
      context: .
      dockerfile: Dockerfile.mcp
    stdin_open: true
    environment:
      - DATABASE_URL=file:/app/data/memorix.db
      - MEMORIX_API_KEY=${MEMORIX_API_KEY:-}
    volumes:
      - memorix-data:/app/data:ro
    profiles:
      - mcp

volumes:
  memorix-data:
```

### Running with Docker Compose

```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your values

# Start the application
docker compose up -d

# View logs
docker compose logs -f app

# Run MCP server on demand
docker compose run --rm -i mcp

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```

### Adding a Reverse Proxy (Caddy)

For HTTPS and custom domains, add Caddy to your Docker Compose:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/memorix.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=https://memorix.yourdomain.com
    volumes:
      - memorix-data:/app/data
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app
    restart: unless-stopped

volumes:
  memorix-data:
  caddy-data:
  caddy-config:
```

**Caddyfile**:

```
memorix.yourdomain.com {
    reverse_proxy app:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

---

## Environment Variables

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./data/memorix.db` (SQLite) or `postgresql://...` |
| `NEXTAUTH_SECRET` | NextAuth session encryption key | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your Memorix instance | `https://memorix.yourdomain.com` |
| `MEMORIX_API_KEY` | API authentication key | Generate with `openssl rand -hex 32` |

### Optional — BYOK Provider Keys

| Variable | Description | Provider |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key (`sk-...`) | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-...`) | Anthropic |
| `GOOGLE_API_KEY` | Google AI API key (`AIza...`) | Google Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek API key (`sk-...`) | DeepSeek |
| `OPENROUTER_API_KEY` | OpenRouter API key (`sk-or-...`) | OpenRouter |

### Optional — Infrastructure

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MCP_SERVER_PORT` | MCP server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `UPSTASH_REDIS_URL` | Redis URL for rate limiting | — |
| `UPSTASH_REDIS_TOKEN` | Redis token for rate limiting | — |

### Optional — Embedding

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_MODEL` | Embedding model name | `nomic-embed-text` |
| `EMBEDDING_DIMENSION` | Embedding vector dimension | `768` |
| `EMBEDDING_API_URL` | External embedding API URL | — |
| `EMBEDDING_API_KEY` | Embedding service API key | — |

### Generating Secure Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate MEMORIX_API_KEY
openssl rand -hex 32

# Example output: a1b2c3d4e5f6... (64 hex characters)
```

---

## Production Checklist

### Pre-Deployment

- [ ] Set `NODE_ENV=production`
- [ ] Set `NEXTAUTH_SECRET` to a strong, unique key (not the default)
- [ ] Set `NEXTAUTH_URL` to your public URL
- [ ] Set `MEMORIX_API_KEY` to a strong, unique key
- [ ] Run `bun run lint` — no errors
- [ ] Run `bun run test` — all tests pass
- [ ] Run `bun run build` — build succeeds
- [ ] Database migrations applied (`bun run db:push`)
- [ ] Prisma client generated (`bun run db:generate`)
- [ ] `.env` file is not committed to version control
- [ ] All secrets are in environment variables, not in code

### Security

- [ ] API key is set and tested (`MEMORIX_API_KEY`)
- [ ] HTTPS is enabled (via Caddy, Nginx, or Vercel)
- [ ] CORS is configured for allowed origins only
- [ ] Rate limiting is configured (Upstash Redis recommended)
- [ ] Input validation is active on all API routes (Zod schemas)
- [ ] API keys (BYOK) are encrypted at rest
- [ ] No sensitive data in client-side JavaScript bundles

### Monitoring

- [ ] Health check endpoint (`GET /api`) is accessible
- [ ] Health check endpoint (`GET /api/health`) returns database status
- [ ] Log rotation is configured
- [ ] Uptime monitoring is set up (UptimeRobot, BetterUptime, etc.)
- [ ] Alert notifications are configured for downtime
- [ ] Database backup schedule is set
- [ ] Error reporting is configured (optional: Sentry, etc.)

### Performance

- [ ] Static assets are cached (CDN or reverse proxy)
- [ ] Image optimization is enabled (Next.js Image component)
- [ ] Bundle size is reasonable (< 500KB initial JS)
- [ ] Lighthouse score > 90 (Performance)
- [ ] API response times are acceptable (< 3s for chat, < 500ms for models)

---

## Security Hardening

### API Key Authentication

Memorix validates API keys on protected endpoints via `src/lib/auth.ts`:

```typescript
// Authentication methods (checked in order):
// 1. x-api-key header
// 2. Authorization: Bearer header
// 3. api_key query parameter

// In development without MEMORIX_API_KEY: all requests allowed
// In production without MEMORIX_API_KEY: 401 Unauthorized
```

### HTTPS Configuration

Always use HTTPS in production. Caddy provides automatic HTTPS with Let's Encrypt:

```
memorix.yourdomain.com {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
}
```

### Rate Limiting

#### Application-Level (Upstash Redis)

Memorix includes built-in rate limiting via `src/lib/rate-limit.ts`:

```bash
# Configure in .env
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

#### Proxy-Level (Caddy)

```
memorix.yourdomain.com {
    reverse_proxy localhost:3000

    rate_limit {
        zone memorix_zone {
            key    {remote_host}
            events 100
            window 1m
        }
    }
}
```

### Input Validation

All critical API routes use Zod schema validation:

- Chat API: validates model, messages, temperature, maxTokens
- Agent API: validates message, model, tool selection
- Notes API: validates title, content, tags
- Search API: validates query, limit
- Compare API: validates model list, prompt

### Database Security

- SQLite file permissions: `600` (owner read/write only)
- No raw SQL queries — Prisma parameterized queries only
- Database directory not web-accessible
- Regular backups with rotation
- For production: migrate to PostgreSQL with SSL connections

### CORS Configuration

Configure allowed origins in your reverse proxy or Next.js middleware:

```typescript
// next.config.ts or middleware.ts
const allowedOrigins = [
  'https://memorix.yourdomain.com',
  'https://app.memorix.yourdomain.com',
]
```

---

## SaaS/IaaS Deployment Considerations

### Multi-Tenancy Architecture

When deploying Memorix as a SaaS platform (v5.0+):

1. **Database Isolation**: Use PostgreSQL with schema-per-tenant or database-per-tenant
2. **API Gateway**: Deploy a dedicated API gateway (Kong, Traefik) for request routing
3. **Billing Integration**: Integrate Stripe for subscription management
4. **Rate Limiting**: Per-tenant rate limits using Redis with tenant-specific keys

### API Gateway Setup

```yaml
# Example: Kong API Gateway configuration
services:
  kong:
    image: kong:latest
    ports:
      - "8000:8000"   # Proxy
      - "8443:8443"   # Proxy HTTPS
      - "8001:8001"   # Admin API
    environment:
      - KONG_DATABASE=postgres
      - KONG_PG_HOST=postgres
```

### Stripe Integration

```bash
# Required for SaaS billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

### Custom Domain Support

For SaaS deployments allowing custom domains:

1. Use a wildcard SSL certificate (`*.memorix.yourdomain.com`)
2. Configure DNS CNAME for each tenant
3. Route requests based on Host header
4. Apply tenant-specific configuration dynamically

---

## Scaling Considerations

### SQLite → PostgreSQL Migration

For production deployments with multiple users, migrate from SQLite to PostgreSQL:

```bash
# 1. Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# 2. Create database
sudo -u postgres createdb memorix

# 3. Update DATABASE_URL
DATABASE_URL="postgresql://memorix:password@localhost:5432/memorix"

# 4. Run migrations
bun run db:push
bun run db:generate
```

### Redis for Rate Limiting and Caching

Add Upstash Redis for production rate limiting:

```bash
# Configure in .env
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

Benefits:
- Distributed rate limiting across multiple instances
- Session caching for faster authentication
- Model response caching for repeated queries
- Agent state management for long-running tasks

### Horizontal Scaling

For high-traffic deployments:

1. **Multiple App Instances**: Deploy behind a load balancer (Nginx, Caddy, Cloudflare)
2. **Shared Database**: Use PostgreSQL with connection pooling (PgBouncer)
3. **Shared Cache**: Use Redis for session and response caching
4. **CDN**: Use Cloudflare or Vercel Edge for static assets
5. **Object Storage**: Use S3 for file attachments and backups

```yaml
# Example: Multi-instance deployment
services:
  app-1:
    build: .
    environment:
      - DATABASE_URL=postgresql://...
    restart: unless-stopped

  app-2:
    build: .
    environment:
      - DATABASE_URL=postgresql://...
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app-1
      - app-2
```

### Monitoring and Observability

For production monitoring:

- **Health Checks**: `GET /api` and `GET /api/health` endpoints
- **Logging**: Structured JSON logging with Pino or Winston
- **Metrics**: Prometheus + Grafana dashboards (optional)
- **Alerting**: PagerDuty or Opsgenie for critical alerts
- **Uptime**: UptimeRobot or BetterUptime for external monitoring

---

*Document Version: 4.0.0 | Last Updated: March 2025*
