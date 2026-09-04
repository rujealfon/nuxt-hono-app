import type { AuthUser } from '@nuxt-app/types'
import type { PinoLogger } from 'hono-pino'

export interface AppEnv {
  Variables: {
    user: AuthUser | null
    logger: PinoLogger
  }
}

/** Routers mounted behind `requireAdmin`, which guarantees a signed-in admin. */
export type AdminEnv = AppEnv & { Variables: { user: AuthUser } }
