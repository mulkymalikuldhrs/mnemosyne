// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Environment Configuration
// Zod-validated env vars inspired by 9drive (https://github.com/mulkymalikuldhrs/9drive)
// Fail-fast on missing/misconfigured secrets in production
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

const DEV_SECRET = 'dev-secret-change-in-production'
const DEV_ENCRYPTION_KEY = 'dev-encryption-key-change-in-production-32ch'

const envSchema = z.object({
  // ─── Core ───
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  PORT: z.coerce.number().default(3000),

  // ─── Authentication ───
  NEXTAUTH_SECRET: z.string().min(1).default(DEV_SECRET),
  NEXTAUTH_URL: z.string().default('http://localhost:3000'),

  // ─── Encryption (inspired by 9drive's TOKEN_ENCRYPTION_KEY) ───
  TOKEN_ENCRYPTION_KEY: z.string().min(1).default(DEV_ENCRYPTION_KEY),

  // ─── Token TTL (inspired by 9drive's configurable token lifetimes) ───
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),    // 15 minutes
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),       // 30 days

  // ─── LLM Providers ───
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),

  // ─── MCP Server ───
  MCP_SERVER_PORT: z.coerce.number().default(4000),
  MNEMOSYNE_API_KEY: z.string().optional(),

  // ─── Embeddings ───
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  EMBEDDING_DIMENSION: z.coerce.number().default(768),
  EMBEDDING_API_URL: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),

  // ─── Redis (for production rate limiting) ───
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // ─── Storage Providers ───
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  // ─── Upload Limits (inspired by 9drive's MAX_UPLOAD_BYTES) ───
  MAX_UPLOAD_BYTES: z.coerce.number().default(100 * 1024 * 1024), // 100MB

  // ─── Rate Limiting ───
  LLM_RATE_LIMIT_RPM: z.coerce.number().default(20),
  STORAGE_RATE_LIMIT_RPM: z.coerce.number().default(10),
  AUTH_RATE_LIMIT_RPM: z.coerce.number().default(5),
  MCP_RATE_LIMIT_RPM: z.coerce.number().default(60),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  // Production safety checks (inspired by 9drive's startup validation)
  if (process.env.NODE_ENV === 'production') {
    if (parsed.data.NEXTAUTH_SECRET === DEV_SECRET) {
      throw new Error(
        'FATAL: NEXTAUTH_SECRET is using the default dev value in production. ' +
        'Set a strong, unique NEXTAUTH_SECRET environment variable before deploying. ' +
        'Generate one with: openssl rand -base64 32'
      )
    }
    if (parsed.data.TOKEN_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
      throw new Error(
        'FATAL: TOKEN_ENCRYPTION_KEY is using the default dev value in production. ' +
        'Set a strong, unique TOKEN_ENCRYPTION_KEY (min 32 characters) before deploying. ' +
        'Generate one with: openssl rand -base64 32'
      )
    }
    if (!parsed.data.MNEMOSYNE_API_KEY) {
      throw new Error(
        'FATAL: MNEMOSYNE_API_KEY must be set in production for MCP server authentication. ' +
        'Generate one with: openssl rand -base64 32'
      )
    }
  }

  return parsed.data
}

export const env = validateEnv()
