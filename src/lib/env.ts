import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  NANGGROE_API_KEY: z.string().optional(),
  ZAI_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  SERIAL_PORT: z.string().default('/dev/ttyUSB0'),
  SERIAL_BAUD_RATE: z.coerce.number().default(115200),
  MCP_PORT: z.coerce.number().default(8080),
  EXTENSION_WS_PORT: z.coerce.number().default(8081),
  HARDWARE_BRIDGE_MODE: z.enum(['simulation', 'real']).default('simulation'),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
      const errors = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
      throw new Error(`Environment validation failed:\n${errors}`)
    }
    _env = result.data
  }
  return _env
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production'
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development'
}
