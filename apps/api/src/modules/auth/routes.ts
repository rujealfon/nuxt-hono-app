import { createRoute } from '@hono/zod-openapi'
import { authHttp, authResponseSchema, loginSchema, meResponseSchema, registerSchema } from '@nuxt-app/types'
import { HTTPException } from 'hono/http-exception'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import createErrorSchema from 'stoker/openapi/schemas/create-error-schema'
import createMessageObjectSchema from 'stoker/openapi/schemas/create-message-object'
import { createRouter } from '#api/factory.js'
import { authRateLimit } from '#api/middleware/rate-limit.js'
import { attachSessionCookie, endSession } from '#api/modules/auth/cookies.js'
import { createUser, signIn } from '#api/modules/auth/identity.js'

const tags = ['Auth']

const register = createRoute({
  path: authHttp.register.route,
  method: 'post',
  tags,
  summary: 'Register',
  middleware: [authRateLimit],
  request: {
    body: jsonContentRequired(registerSchema, 'Registration payload'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema('Registered successfully'),
      'Registered',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(registerSchema),
      'Validation error',
    ),
  },
})

const login = createRoute({
  path: authHttp.login.route,
  method: 'post',
  tags,
  summary: 'Log in',
  middleware: [authRateLimit],
  request: {
    body: jsonContentRequired(loginSchema, 'Login payload'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(authResponseSchema, 'Logged in'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema('Invalid email or password'),
      HttpStatusPhrases.UNAUTHORIZED,
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema('This account is not an admin.'),
      HttpStatusPhrases.FORBIDDEN,
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(loginSchema),
      'Validation error',
    ),
  },
})

const logout = createRoute({
  path: authHttp.logout.route,
  method: 'post',
  tags,
  summary: 'Log out',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Logged out'), 'Logged out'),
  },
})

const me = createRoute({
  path: authHttp.me.route,
  method: 'get',
  tags,
  summary: 'Current user',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(meResponseSchema, 'Session user, or null'),
  },
})

export const authRoutes = createRouter()
  .openapi(register, async (c) => {
    const { email, password, name } = c.req.valid('json')
    await createUser({ email, password, name })
    return c.json({ message: 'Registered successfully' }, HttpStatusCodes.OK)
  })
  .openapi(login, async (c) => {
    const { email, password, requireRole } = c.req.valid('json')
    const result = await signIn(email, password, requireRole)
    if (!result) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
        message: 'Invalid email or password',
      })
    }
    if ('denied' in result) {
      throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
        message: result.message,
      })
    }
    attachSessionCookie(c, result.sessionId)

    return c.json({
      user: result.user,
      message: 'Logged in successfully',
    }, HttpStatusCodes.OK)
  })
  .openapi(logout, async (c) => {
    await endSession(c)
    return c.json({ message: 'Logged out' }, HttpStatusCodes.OK)
  })
  .openapi(me, (c) => {
    return c.json({ user: c.get('user') }, HttpStatusCodes.OK)
  })
