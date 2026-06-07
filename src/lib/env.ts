import { z } from 'zod'

const DEV_SECRET = 'dev-secret-change-in-production'

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./dev.db'),
  NEXTAUTH_SECRET: z.string().default(DEV_SECRET),
  NEXTAUTH_URL: z.string().default('http://localhost:3000'),
  OPENROUTER_API_KEY: z.string().optional(),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  MCP_SERVER_PORT: z.string().default('4000'),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  EMBEDDING_DIMENSION: z.string().default('768'),
  EMBEDDING_API_URL: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  mnemosyne_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  // Production safety check: NEXTAUTH_SECRET must not be the default value
  if (process.env.NODE_ENV === 'production' && parsed.data.NEXTAUTH_SECRET === DEV_SECRET) {
    throw new Error(
      'FATAL: NEXTAUTH_SECRET is using the default dev value in production. ' +
      'Set a strong, unique NEXTAUTH_SECRET environment variable before deploying. ' +
      'You can generate one with: openssl rand -base64 32'
    )
  }

  return parsed.data
}

export const env = validateEnv()
