import type { AdminEnv } from '#api/types.js'
import { createRoute, z } from '@hono/zod-openapi'
import { authUserSchema } from '@nuxt-app/types'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'
import { jsonContent } from 'stoker/openapi/helpers'
import createMessageObjectSchema from 'stoker/openapi/schemas/create-message-object'
import { createRouter } from '#api/factory.js'
import { requireAdmin } from '#api/middleware/require-admin.js'

const adminDashboardSchema = z.object({
  message: z.string(),
  user: authUserSchema,
})

const dashboard = createRoute({
  path: '/dashboard',
  method: 'get',
  tags: ['Admin'],
  summary: 'Admin dashboard',
  middleware: [requireAdmin],
  security: [{ sessionCookie: [] }],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(adminDashboardSchema, 'Admin only'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.UNAUTHORIZED),
      HttpStatusPhrases.UNAUTHORIZED,
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.FORBIDDEN),
      HttpStatusPhrases.FORBIDDEN,
    ),
  },
})

export const adminRoutes = createRouter<AdminEnv>()
  .openapi(dashboard, (c) => {
    return c.json({
      message: 'Welcome to admin dashboard',
      user: c.get('user'),
    }, HttpStatusCodes.OK)
  })
