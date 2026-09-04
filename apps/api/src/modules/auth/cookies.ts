import type { AuthUser } from '@nuxt-app/types'
import type { Context } from 'hono'
import type { CookieOptions } from 'hono/utils/cookie'
import type { AppEnv } from '#api/types.js'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from '#api/env.js'
import { readSessionUser, revokeSession } from '#api/modules/auth/session.js'

export const SESSION_COOKIE = 'nuxt_app_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function sessionCookieOptions(input: {
  nodeEnv: string
  cookieDomain?: string
} = {
  nodeEnv: env.NODE_ENV,
  cookieDomain: env.COOKIE_DOMAIN,
}): CookieOptions {
  const isProd = input.nodeEnv === 'production'

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    domain: input.cookieDomain,
  }
}

export function attachSessionCookie(
  c: Context,
  sessionId: string,
  cookieEnv?: { nodeEnv: string, cookieDomain?: string },
) {
  setCookie(c, SESSION_COOKIE, sessionId, sessionCookieOptions(cookieEnv))
}

function clearSessionCookie(c: Context<AppEnv>) {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions()
  deleteCookie(c, SESSION_COOKIE, options)
}

function readSessionCookie(c: Context<AppEnv>) {
  return getCookie(c, SESSION_COOKIE)
}

export async function endSession(c: Context<AppEnv>) {
  const sessionId = readSessionCookie(c)
  if (sessionId)
    await revokeSession(sessionId)
  clearSessionCookie(c)
}

export async function currentUser(c: Context<AppEnv>): Promise<AuthUser | null> {
  return readSessionUser(readSessionCookie(c) || '')
}
