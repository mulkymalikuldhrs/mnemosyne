# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in Nanggroe IoT, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues by emailing:

**Mulky Malikul Dhaher** — mulkymalikuldhaher@email.com

### What to Include

Please include the following information in your report:

1. **Description** — A clear description of the vulnerability
2. **Impact** — What an attacker could achieve by exploiting this vulnerability
3. **Reproduction Steps** — Step-by-step instructions to reproduce the issue
4. **Affected Versions** — Which versions are affected
5. **Suggested Fix** — If you have ideas for how to fix the issue (optional)
6. **Your Contact** — How we can reach you for follow-up questions

### Response Timeline

| Stage | Expected Time |
|-------|--------------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 5 business days |
| Status Update | Every 7 days until resolved |
| Fix Delivery | Depends on severity and complexity |

### Severity Levels

| Level | Description |
|-------|-------------|
| **Critical** | Remote code execution, hardware access, or data breach |
| **High** | Privilege escalation or significant information disclosure |
| **Medium** | Limited information disclosure or denial of service |
| **Low** | Minor information leakage or cosmetic issues |

### Scope

**In Scope:**
- Nanggroe IoT core application code
- API endpoints and authentication
- Hardware communication protocols
- Database access controls
- Desktop (Tauri) and mobile (Capacitor) packaging
- Multi-agent system communication

**Out of Scope:**
- Third-party library vulnerabilities (report to library maintainers)
- Social engineering attacks
- Physical access attacks on robotics hardware
- Denial of service via network flooding

### Responsible Disclosure

We ask that you:

1. **Do not exploit** the vulnerability beyond what is needed to demonstrate it
2. **Do not access** or modify other users' data
3. **Do not disclose** the vulnerability publicly until a fix is released
4. **Provide reasonable time** for us to address the issue before any public disclosure

We are committed to working with security researchers to resolve issues quickly and will credit reporters (with permission) in our security advisories.

---

## Security Measures

### API Key Authentication

Nanggroe IoT uses API key authentication to protect critical routes. The `NANGGROE_API_KEY` environment variable must be set in production.

**Implementation** (`src/lib/auth.ts`):
- Validates `x-api-key` header
- Validates `Authorization: Bearer` header
- Validates `api_key` query parameter
- In development without key: requests are allowed (for convenience)
- In production without key: returns `401 Unauthorized`

**Protected Routes**:
- `POST /api/mcp` — MCP tool execution
- `POST /api/system` — System configuration updates
- `POST /api/flash` — Firmware flashing
- `POST /api/hardware-bridge` — Hardware bus operations

**Setup**:
```bash
# Generate a secure API key
export NANGGROE_API_KEY=$(openssl rand -hex 32)
```

### Command Injection Protection

All routes that handle hardware communication implement command injection protection:

- **No shell execution** — Routes never use `exec()`, `spawn()`, or similar functions with user input
- **Input sanitization** — All user-provided strings are validated before use
- **Serial port library** — Direct communication via `serialport` package (no shell commands)
- **Type validation** — Input types are validated with Zod schemas

### Content Security Policy (CSP)

Tauri desktop builds include Content Security Policy headers:

- Restricts script sources to trusted origins
- Prevents inline script execution (where possible)
- Limits style sources
- Blocks unauthorized network connections
- Configured in `src-tauri/capabilities/default.json`

### Input Validation

Critical API routes use Zod schema validation:

| Route | Validated Fields |
|-------|-----------------|
| `POST /api/missions` | `name` (string, required), `type` (enum), `altitude` (number), `speed` (number) |
| `POST /api/navigation` | `name` (string), `type` (enum), `waypoints` (JSON) |
| `POST /api/mcp` | `tool` (string, required), `arguments` (object) |
| `POST /api/hardware` | `name` (string), `deviceType` (enum), `protocol` (enum) |
| `POST /api/agents/chat` | `prompt` (string), `agent` (string) |
| `POST /api/system` | `configs` (array of key-value pairs) |

### Rate Limiting

Rate limiting is recommended in production via the Caddy reverse proxy:

```caddy
rate_limit {
    zone nanggroe_zone {
        key    {remote_host}
        events 100
        window 1m
    }
}
```

**Recommended Limits**:

| Endpoint Category | Rate Limit |
|-------------------|------------|
| General API | 100 requests/minute |
| Agent Chat | 10 requests/minute |
| MCP Tools | 20 requests/minute |
| SSE Streams | 5 concurrent connections |

### SQL Injection Prevention

Nanggroe IoT uses Prisma ORM with parameterized queries:
- All database queries are automatically parameterized
- No raw SQL queries in the codebase
- Prisma client provides type-safe query building

### Cross-Site Scripting (XSS) Prevention

- React auto-escapes rendered content
- CSP headers restrict script execution (Tauri)
- Input validation prevents script injection in stored data
- `dangerouslySetInnerHTML` is not used in the codebase

### Error Handling

- React error boundaries catch component crashes gracefully
- API routes return structured error responses without stack traces in production
- Database errors are caught and return generic error messages
- No sensitive information is leaked in error responses

---

## Security Best Practices for Deployers

When deploying Nanggroe IoT:

### Essential

- **Set `NANGGROE_API_KEY`** — Generate a strong, unique key for production
- **Enable HTTPS** — Use Caddy, Nginx, or Vercel for TLS termination
- **Keep `.env` secure** — Never commit it to version control
- **Restrict serial port access** — Only authorized users should access hardware
- **Update dependencies** — Run `bun update` regularly

### Recommended

- **Configure rate limiting** — Protect against abuse via Caddy or Nginx
- **Set up monitoring** — Monitor `/api` health endpoint and logs
- **Regular backups** — Back up the SQLite database file regularly
- **Review logs** — Check for suspicious API activity patterns
- **Network isolation** — Place IoT devices on a separate VLAN
- **Firewall rules** — Only expose necessary ports (80, 443)

### Hardware Security

- **Physical access** — Restrict physical access to Raspberry Pi and connected devices
- **USB devices** — Use udev rules to control which USB devices are recognized
- **Serial permissions** — Only add trusted users to the `dialout` group
- **GPIO protection** — Ensure GPIO pins are properly configured to prevent short circuits

### Database Security

- **File permissions** — Set SQLite database file to `600` (owner read/write only)
- **Directory protection** — Ensure the `db/` directory is not web-accessible
- **Backup encryption** — Encrypt database backups if they contain sensitive data
- **WAL mode** — SQLite WAL mode is used for concurrent read/write performance

---

*Thank you for helping keep Nanggroe IoT and its users safe.*
