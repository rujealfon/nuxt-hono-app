import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { attachSessionCookie, SESSION_COOKIE } from '#api/modules/auth/cookies.js'

const sessionId = '01936c5a-7c3a-7c3a-8c3a-7c3a7c3a7c3a'

async function setCookieHeader(
  cookieEnv: { nodeEnv: string, cookieDomain?: string },
) {
  const app = new Hono()
  app.get('/set', (c) => {
    attachSessionCookie(c, sessionId, cookieEnv)
    return c.body(null)
  })
  const res = await app.request('/set')
  return res.headers.getSetCookie?.().find(value => value.startsWith(`${SESSION_COOKIE}=`))
    ?? res.headers.get('set-cookie')
    ?? ''
}

describe('attachSessionCookie', () => {
  it('uses first-party SameSite=Lax; Secure in production without COOKIE_DOMAIN', async () => {
    const setCookie = await setCookieHeader({ nodeEnv: 'production' })
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).not.toMatch(/Domain=/i)
  })

  it('uses SameSite=Lax when COOKIE_DOMAIN ties sibling hosts', async () => {
    const setCookie = await setCookieHeader({
      nodeEnv: 'production',
      cookieDomain: '.nuxt-app.com',
    })
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).toMatch(/Domain=\.nuxt-app.com/i)
  })

  it('uses SameSite=Lax without Secure in development', async () => {
    const setCookie = await setCookieHeader({
      nodeEnv: 'development',
      cookieDomain: 'localhost',
    })
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).not.toMatch(/Secure/i)
    expect(setCookie).toMatch(/Domain=localhost/i)
  })
})
