import { factory } from '#api/factory.js'
import { currentUser } from '#api/modules/auth/cookies.js'
import { skipPublic } from '#api/request-policy.js'

export const sessionMiddleware = factory.createMiddleware(async (c, next) => {
  if (skipPublic(c)) {
    c.set('user', null)
    await next()
    return
  }

  c.set('user', await currentUser(c))
  await next()
})
