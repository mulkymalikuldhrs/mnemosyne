# Memorix Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Memorix, please report it responsibly:

- **Email:** mulkymalikuldhaher@email.com
- **GitHub:** Open a private security advisory at [github.com/mulkymalikuldhrs/memorix/security](https://github.com/mulkymalikuldhrs/memorix/security)

**Please do not disclose security vulnerabilities publicly until they have been addressed.**

---

## Security Measures

### Authentication & Authorization
- **Password Hashing:** User passwords are hashed with bcryptjs (cost factor 12)
- **Session Management:** JWT-based sessions via NextAuth.js
- **API Key Authentication:** MCP server requires API key validation (plain text in DB — see Known Issues)
- **Production Guard:** NEXTAUTH_SECRET must be changed from default in production (enforced at startup)
- **MCP Server Auth:** Refuses to start in production without MEMORIX_API_KEY

### API Security
- **Rate Limiting:** Per-route rate limiting enforced at middleware level (10-60 req/min depending on endpoint)
- **Input Validation:** All API inputs validated with Zod schemas
- **Error Sanitization:** Internal error details are not exposed to clients in production
- **Security Headers:** X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy applied globally
- **CORS:** Restricted via CSP connect-src directive

### Data Protection
- **User Isolation:** All database queries are scoped to the authenticated user's ID
- **Ownership Checks:** All mutations verify resource ownership before modification/deletion
- **API Key Masking:** API keys are masked when listed (only full key shown once at creation)

---

## Known Security Issues & Limitations

### API Keys Stored in Plain Text (MEDIUM)
API keys are currently stored as plain text in the `ApiKey` table and looked up directly via `findUnique({ where: { key } })`.

**Risk:** If the database is compromised, all API keys are exposed.

**Planned Fix:** Store API keys as SHA-256 hashes. The lookup should hash the incoming key and search by hash. A migration strategy will support both hash lookup (new) and plain text lookup (legacy) during transition.

### In-Memory Rate Limiting (LOW)
Rate limiting uses in-memory stores which do not persist across server instances. In multi-instance deployments (e.g., Kubernetes), each instance maintains its own rate limit counters.

**Mitigation:** Configure `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` for production Redis-backed rate limiting.

### SQLite Limitations (LOW)
SQLite does not support native vector search. Embeddings are stored as JSON strings and similarity search is performed in application memory. This limits scalability for very large note collections (>50K notes per user).

**Mitigation:** For production at scale, migrate to PostgreSQL with pgvector extension.

### MCP Server Single-User Mode (LOW)
The MCP server authenticates a single user per process via the API key. Multiple concurrent users require separate MCP server instances.

### Demo Credentials (INFO)
The seed script creates a demo user with known credentials (`demo@memorix.ai` / `demo123`). These should only be used in local development and changed immediately in any shared environment.

---

## Deployment Security Checklist

- [ ] Set `NEXTAUTH_SECRET` to a cryptographically random value (use `openssl rand -base64 32`)
- [ ] Set `MEMORIX_API_KEY` for MCP server authentication
- [ ] Remove or change demo user credentials
- [ ] Configure Redis for production rate limiting
- [ ] Enable HTTPS/TLS termination (via reverse proxy like Caddy or Nginx)
- [ ] Review CSP headers for your deployment needs
- [ ] Set `NODE_ENV=production` to disable stack trace leaking
- [ ] Restrict database file permissions (SQLite)
- [ ] Regularly update dependencies (`bun audit`)

---

*Last updated: 2026-06-05 by AGENT-01 (Dhaher Corporation)*
