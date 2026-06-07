# Mnemosyne — SaaS/IaaS Deployment Guide

> How to deploy mnemosyne as a SaaS (Software as a Service) or IaaS (Infrastructure as a Service) LLM platform.

---

## SaaS Model Overview

mnemosyne can be deployed as a multi-tenant SaaS platform, offering LLM access, AI agent execution, and memory services to end-users through a subscription model. The architecture supports three tiers:

### Free Tier

- **LLM Access**: 500+ models via Puter.js (user-pays model)
- **Memory**: Up to 1,000 notes per user
- **AI Agent**: Basic agent with 7 built-in tools
- **MCP Access**: Single MCP connection
- **API Rate Limits**: 60 requests/minute
- **Storage**: Puter.js cloud storage + local SQLite

### Pro Tier ($19/month)

- **LLM Access**: Free tier + BYOK support (user provides their own API keys)
- **Memory**: Unlimited notes
- **AI Agent**: Custom agents with user-defined tools and system prompts
- **MCP Access**: Up to 5 concurrent MCP connections
- **API Rate Limits**: 300 requests/minute
- **Storage**: Multi-cloud storage (Google Drive, S3, TeraBox)
- **Priority Support**: Email and Discord

### Enterprise Tier ($99/month)

- **LLM Access**: Free tier + BYOK + dedicated model instances
- **Memory**: Unlimited notes with team sharing
- **AI Agent**: Unlimited custom agents with orchestration
- **MCP Access**: Unlimited concurrent connections
- **API Rate Limits**: 1,000 requests/minute
- **Storage**: All cloud providers + on-premise option
- **SLA**: 99.9% uptime guarantee
- **Support**: Dedicated account manager, priority issue resolution

---

## IaaS: mnemosyne as an API Gateway

mnemosyne can serve as an LLM API gateway (Infrastructure as a Service), similar to OpenRouter but with a free tier. Other applications can consume mnemosyne's API endpoints directly:

### Universal Chat API

```bash
curl -X POST https://your-mnemosyne-instance.com/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mx_your_api_key" \
  -d '{
    "model": "openai/gpt-5.4-nano",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Agent Execution API

```bash
curl -X POST https://your-mnemosyne-instance.com/api/llm/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mx_your_api_key" \
  -d '{
    "message": "Search my notes about machine learning and summarize the key points",
    "model": "openai/gpt-5.4-nano",
    "tools": ["memory_search", "memory_insights"]
  }'
```

### Multi-Model Comparison API

```bash
curl -X POST https://your-mnemosyne-instance.com/api/llm/compare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mx_your_api_key" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "models": ["openai/gpt-5.4-nano", "anthropic/claude-sonnet-4-6", "google/gemini-3.1-flash-lite"]
  }'
```

---

## Multi-Tenancy Architecture

For SaaS deployment, Mnemosyne supports multi-tenancy through user isolation:

### Database Isolation

Each user's data is scoped by `userId` in all Prisma queries. No cross-user data access is possible.

### API Key Management

- Each user gets unique API keys (`mx_` prefix)
- API keys are stored as SHA-256 hashes in production
- Rate limiting is per-API-key, not per-instance

### Session Management

- NextAuth.js handles user sessions with JWT tokens
- Session includes user ID, plan type, and rate limit tier
- Sessions expire after configurable duration

---

## Billing Integration

### Stripe Integration (Recommended)

1. Create Stripe account and obtain API keys
2. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to environment
3. Configure subscription products for Free, Pro, and Enterprise tiers
4. Webhook endpoint: `POST /api/subscription/webhook`

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

---

## Rate Limiting per Tier

| Tier | LLM Chat | Agent | Compare | Search | MCP |
|------|----------|-------|---------|--------|-----|
| Free | 60/min | 10/min | 5/min | 30/min | 20/min |
| Pro | 300/min | 60/min | 30/min | 120/min | 60/min |
| Enterprise | 1000/min | 200/min | 100/min | 500/min | 200/min |

### Redis-Backed Rate Limiting (Production)

For multi-instance deployments, use Upstash Redis for shared rate limiting:

```env
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

---

## Monitoring and Analytics

### Health Check Endpoint

```bash
curl https://your-mnemosyne-instance.com/api/health
```

Returns system status, version, uptime, and model availability.

### Metrics to Track

- Total API requests per tier
- LLM model usage distribution
- Agent execution success rate
- Average response latency per model
- Memory storage utilization
- Active user count by tier

### Recommended Tools

- **Uptime**: UptimeRobot or BetterStack
- **Metrics**: Prometheus + Grafana
- **Logs**: Loki or ELK Stack
- **Errors**: Sentry

---

## Scaling Strategy

### Single Instance (0 — 1,000 users)

- One Next.js instance with SQLite
- Puter.js handles LLM scaling automatically
- Sufficient for most use cases

### Multi-Instance (1,000 — 10,000 users)

- Multiple Next.js instances behind a load balancer
- PostgreSQL with pgvector instead of SQLite
- Redis for shared rate limiting and sessions
- S3-compatible storage for file uploads

### Distributed (10,000+ users)

- Kubernetes deployment with horizontal pod autoscaling
- PostgreSQL cluster with read replicas
- Redis cluster for caching and rate limiting
- CDN for static assets
- Dedicated model instances for Enterprise tier

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `NEXTAUTH_SECRET`
- [ ] Set `mnemosyne_API_KEY` for MCP auth
- [ ] Configure Stripe for billing
- [ ] Set up Redis for rate limiting
- [ ] Enable HTTPS via Caddy/Nginx
- [ ] Configure CORS for allowed origins
- [ ] Set up monitoring and alerting
- [ ] Configure database backups
- [ ] Test all API endpoints
- [ ] Review security headers
- [ ] Load test with expected traffic

---

*Last updated: 2026 · Mnemosyne v1.0.0*
