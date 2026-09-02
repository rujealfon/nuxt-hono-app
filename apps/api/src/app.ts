import { AUTH_MOUNT } from '@nuxt-app/types'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'
import { allowedOrigins, isDev } from '#api/env.js'
import { createRouter } from '#api/factory.js'
import { onError } from '#api/middleware/error.js'
import { pinoLogger } from '#api/middleware/pino-logger.js'
import { rateLimit } from '#api/middleware/rate-limit.js'
import { sessionMiddleware } from '#api/middleware/session.js'
import { adminRoutes } from '#api/modules/admin/routes.js'
import { authRoutes } from '#api/modules/auth/routes.js'
import { configureOpenAPI } from '#api/modules/docs/routes.js'
import { healthRoutes } from '#api/modules/health/routes.js'
import { resolveCorsOrigin } from '#api/request-policy.js'

const base = createRouter()

base.use('*', requestId())
base.use('*', pinoLogger())
base.use('*', secureHeaders(isDev
  ? {
      contentSecurityPolicy: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.jsdelivr.net'],
        styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.jsdelivr.net', 'https://fonts.scalar.com'],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        fontSrc: ['\'self\'', 'data:', 'https://cdn.jsdelivr.net', 'https://fonts.scalar.com'],
        connectSrc: ['\'self\'', 'https://cdn.jsdelivr.net'],
      },
    }
  : undefined))
base.use(
  '*',
  cors({
    origin: resolveCorsOrigin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)
base.use('*', csrf({ origin: allowedOrigins }))
base.use('*', bodyLimit({
  maxSize: 64 * 1024,
  onError: c => c.json({ message: HttpStatusPhrases.REQUEST_TOO_LONG }, HttpStatusCodes.REQUEST_TOO_LONG),
}))
base.use('*', rateLimit)
base.use('*', sessionMiddleware)
base.onError(onError)
base.notFound(c => c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND))

if (isDev)
  configureOpenAPI(base)

const v1 = createRouter()
  .route(AUTH_MOUNT, authRoutes)
  .route('/admin', adminRoutes)

const app = base
  .route('/', healthRoutes)
  .route('/v1', v1)

export type AppType = typeof app

export default app
