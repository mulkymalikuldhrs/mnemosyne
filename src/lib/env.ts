import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./dev.db'),
  NEXTAUTH_SECRET: z.string().default('dev-secret-change-in-production'),
  NEXTAUTH_URL: z.string().default('http://localhost:3000'),
  OPENROUTER_API_KEY: z.string().optional(),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  MCP_SERVER_PORT: z.string().default('4000'),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  EMBEDDING_DIMENSION: z.string().default('768'),
  EMBEDDING_API_URL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }
  return parsed.data
}

export const env = validateEnv()
