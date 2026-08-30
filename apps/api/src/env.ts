import process from 'node:process'
import { resolveVercelPreviewUrl } from '@nuxt-app/env'
import { z } from 'zod'
import { loadEnv } from '#api/load-env.js'

loadEnv()

export function isPlainRedisToUpstash(connectionString: string) {
  let url: URL
  try {
    url = new URL(connectionString)
  }
  catch {
    return false
  }

  return url.protocol === 'redis:' && url.hostname.endsWith('.upstash.io')
}

const productionRequired = ['APP_URL', 'ADMIN_URL', 'WEB_URL', 'REDIS_URL'] as const

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_URL: z.url().optional(),
  APP_URL: z.url().optional(),
  ADMIN_URL: z.url().optional(),
  WEB_URL: z.url().optional(),
  COOKIE_DOMAIN: z.string().optional().transform(value => value || undefined),
  REDIS_URL: z.url().optional().refine(
    value => !value || !isPlainRedisToUpstash(value),
    { error: 'Use rediss:// (TLS), not redis://, with Upstash — its endpoints enforce TLS.' },
  ),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  TRUST_PROXY: z.string().optional().transform((value) => {
    if (!value)
      return false
    return ['1', 'true', 'yes'].includes(value.trim().toLowerCase())
  }),
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url().optional(),
  DATABASE_URL_UNPOOLED: z.url().optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production')
    return

  for (const key of productionRequired) {
    if (!env[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required in production`,
      })
    }
  }
}).transform(env => ({
  ...env,
  API_URL: env.API_URL ?? 'http://localhost:3000',
  APP_URL: env.APP_URL ?? 'http://localhost:3001',
  ADMIN_URL: env.ADMIN_URL ?? 'http://localhost:3002',
  WEB_URL: env.WEB_URL ?? 'http://localhost:3003',
  REDIS_URL: env.REDIS_URL ?? 'redis://localhost:6380',
}))

const parsed = envSchema.safeParse({
  ...process.env,
  APP_URL: process.env.APP_URL || resolveVercelPreviewUrl('nuxt-app-app'),
  ADMIN_URL: process.env.ADMIN_URL || resolveVercelPreviewUrl('nuxt-app-admin'),
  WEB_URL: process.env.WEB_URL || resolveVercelPreviewUrl('nuxt-app-web'),
})

if (!parsed.success) {
  console.error('❌ Invalid env:')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data

export const isDev = env.NODE_ENV === 'development'

export const allowedOrigins = [
  env.APP_URL,
  env.ADMIN_URL,
  env.WEB_URL,
  ...(isDev ? [env.API_URL] : []),
]
