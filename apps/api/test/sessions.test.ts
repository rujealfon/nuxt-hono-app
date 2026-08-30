import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import app from '#api/app.js'
import { db, sessions, users } from '#api/db/index.js'
import { createUser } from '#api/modules/auth/identity.js'
import { deleteExpiredSessions } from '#api/modules/auth/session.js'

async function login(email: string, password: string) {
  return app.request('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

function sessionCookie(res: Response): string | undefined {
  const header = res.headers.getSetCookie?.().find(value => value.startsWith('nuxt_app_session='))
    ?? res.headers.get('set-cookie')
    ?? undefined
  return header?.split(';')[0]
}

describe('sessions', () => {
  it('sets a session cookie on login, reads it on /me, and clears it on logout', async () => {
    const email = `sess-http-${Date.now()}@example.com`
    const password = 'password12'
    await createUser({ email, password, name: 'Sess' })

    const loggedIn = await login(email, password)
    expect(loggedIn.status).toBe(200)
    const setCookie = loggedIn.headers.getSetCookie?.().find(value => value.startsWith('nuxt_app_session='))
      ?? loggedIn.headers.get('set-cookie')
      ?? ''
    expect(setCookie).toMatch(/^nuxt_app_session=/)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).not.toMatch(/Secure/i)
    const cookie = sessionCookie(loggedIn)

    const me = await app.request('/v1/auth/me', { headers: { Cookie: cookie! } })
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({
      user: { email, name: 'Sess', role: 'user' },
    })

    const logout = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie!,
        Origin: 'http://localhost:3001',
      },
    })
    expect(logout.status).toBe(200)

    const after = await app.request('/v1/auth/me', { headers: { Cookie: cookie! } })
    expect(await after.json()).toEqual({ user: null })
  })

  it('removes expired rows instead of only filtering them', async () => {
    const email = `sess-${Date.now()}@example.com`
    await createUser({ email, password: 'password12', name: 'Sess' })
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    expect(user).toBeDefined()

    const now = new Date()
    const [expired] = await db.insert(sessions).values({
      userId: user!.id,
      expiresAt: new Date(now.getTime() - 1000),
      createdAt: now,
    }).returning({ id: sessions.id })
    const [fresh] = await db.insert(sessions).values({
      userId: user!.id,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    }).returning({ id: sessions.id })

    await deleteExpiredSessions(now)

    const remaining = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user!.id))
    expect(remaining.map(row => row.id)).toEqual([fresh.id])
    expect(remaining.some(row => row.id === expired.id)).toBe(false)
  })

  it('sweeps expired sessions when logging in', async () => {
    const email = `sess-login-${Date.now()}@example.com`
    const password = 'password12'
    await createUser({ email, password, name: 'Sess' })
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    const now = new Date()
    await db.insert(sessions).values({
      userId: user!.id,
      expiresAt: new Date(now.getTime() - 1000),
      createdAt: now,
    })

    const loggedIn = await login(email, password)
    expect(loggedIn.status).toBe(200)

    const remaining = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user!.id))
    expect(remaining).toHaveLength(1)
  })
})
