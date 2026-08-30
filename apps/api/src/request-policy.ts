import type { Context } from 'hono'
import { allowedOrigins } from '#api/env.js'

const fallbackOrigin = allowedOrigins[0] ?? 'http://localhost:3001'

export function resolveCorsOrigin(origin: string): string {
  if (origin && allowedOrigins.includes(origin))
    return origin
  return fallbackOrigin
}

export function skipPublic(c: Context) {
  if (c.req.method === 'OPTIONS')
    return true
  const path = c.req.path
  return path === '/' || path === '/health' || path === '/docs' || path === '/openapi.json'
}
