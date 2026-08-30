import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import app from '#api/app.js'
import { db, sessions, users } from '#api/db/index.js'
import { createUser } from '#api/modules/auth/identity.js'

async function json(path: string, init?: RequestInit) {
  const res = await app.request(path, init)
  return { res, body: await res.json() as Record<string, unknown> }
}

describe('api', () => {
  it('returns health', async () => {
    const { res, body } = await json('/health')
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })

  it('returns service status on /', async () => {
    const { res, body } = await json('/')
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok', service: 'nuxt-app-api' })
  })

  it('does not expose Scalar outside development', async () => {
    const { res, body } = await json('/openapi.json')
    expect(res.status).toBe(404)
    expect(body).toEqual({ message: 'Not Found' })
  })

  it('returns 404 json', async () => {
    const { res, body } = await json('/nope')
    expect(res.status).toBe(404)
    expect(body).toEqual({ message: 'Not Found' })
  })

  it('rejects empty register payload', async () => {
    const { res, body } = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Email, password and name are required')
  })

  it('rejects short register password', async () => {
    const { res, body } = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: 'short', name: 'A' }),
    })
    expect(res.status).toBe(422)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Password must be at least 8 characters')
  })

  it('rejects a register password longer than 72 bytes', async () => {
    const { res, body } = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: 'a'.repeat(73), name: 'Ada' }),
    })
    expect(res.status).toBe(422)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Password must be at most 72 bytes')
  })

  it('rejects a malformed register email', async () => {
    const { res, body } = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x', password: 'password12', name: 'Ada' }),
    })
    expect(res.status).toBe(422)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Invalid email')
  })

  it('rejects empty login payload', async () => {
    const { res, body } = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Email and password are required')
  })

  it('compares a password hash even when the email is unknown', async () => {
    const compare = vi.spyOn(bcrypt, 'compare')
    try {
      const { res, body } = await json('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `nouser-${Date.now()}@example.com`,
          password: 'password12',
        }),
      })
      expect(res.status).toBe(401)
      expect(body).toEqual({ message: 'Invalid email or password' })
      expect(compare).toHaveBeenCalled()
    }
    finally {
      compare.mockRestore()
    }
  })

  it('rejects a login password longer than 72 bytes', async () => {
    const { res, body } = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ada@example.com',
        password: 'a'.repeat(73),
      }),
    })
    expect(res.status).toBe(422)
    expect((body.error as { issues: Array<{ message?: string }> }).issues[0]?.message)
      .toBe('Password must be at most 72 bytes')
  })

  it('returns null user when unauthenticated', async () => {
    const { res, body } = await json('/v1/auth/me')
    expect(res.status).toBe(200)
    expect(body).toEqual({ user: null })
  })

  it('treats a malformed session cookie as no session', async () => {
    const cookie = 'nuxt_app_session=not-a-uuid'
    const me = await json('/v1/auth/me', { headers: { Cookie: cookie } })
    expect(me.res.status).toBe(200)
    expect(me.body).toEqual({ user: null })

    const logout = await json('/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:3001',
      },
    })
    expect(logout.res.status).toBe(200)
    expect(logout.body).toEqual({ message: 'Logged out' })
  })

  it('rejects unauthenticated admin routes', async () => {
    const { res, body } = await json('/v1/admin/dashboard')
    expect(res.status).toBe(401)
    expect(body).toEqual({ message: 'Unauthorized' })
  })

  it('generates an OpenAPI spec from registered routes', async () => {
    const document = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'nuxt-app API', version: '0.0.0' },
    })
    const paths = Object.keys(document.paths ?? {})
    expect(paths).toEqual(expect.arrayContaining([
      '/health',
      '/v1/auth/register',
      '/v1/auth/login',
      '/v1/auth/logout',
      '/v1/auth/me',
      '/v1/admin/dashboard',
    ]))
  })

  it('fills public_id from the SQL nanoid() default on raw insert', async () => {
    const { pool } = await import('#api/db/index.js')
    const email = `sql-id-${Date.now()}@example.com`
    const result = await pool.query<{ public_id: string }>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING public_id`,
      [email, 'SqlId', 'x'],
    )
    expect(result.rows[0].public_id).toMatch(/^[\w-]{21}$/)
  })

  it('returns public_id as user.id and never the uuid pk', async () => {
    const email = `pub-${Date.now()}@example.com`
    const password = 'password12'
    const registered = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Pub' }),
    })
    expect(registered.res.status).toBe(200)
    expect(registered.body).toEqual({ message: 'Registered successfully' })

    const { res, body } = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(res.status).toBe(200)
    const user = body.user as { id: string }
    expect(user.id).toMatch(/^[\w-]{21}$/)
    expect(user.id).not.toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('does not reveal whether an email is already registered', async () => {
    const email = `dup-${Date.now()}@example.com`
    const payload = JSON.stringify({ email, password: 'password12', name: 'Dup' })
    const first = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
    const second = await json('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
    expect(first.res.status).toBe(200)
    expect(second.res.status).toBe(200)
    expect(first.body).toEqual(second.body)
    expect(first.body).toEqual({ message: 'Registered successfully' })
  })

  it('does not start a Session when requireRole does not match', async () => {
    const email = `admin-deny-${Date.now()}@example.com`
    const password = 'password12'
    await createUser({ email, password, name: 'Regular' })

    const { res, body } = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, requireRole: 'admin' }),
    })
    expect(res.status).toBe(403)
    expect(body).toEqual({ message: 'This account is not an admin.' })
    expect(res.headers.getSetCookie?.().some(value => value.startsWith('nuxt_app_session='))
      ?? res.headers.get('set-cookie')).toBeFalsy()

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user!.id))
    expect(rows).toHaveLength(0)
  })

  it('rejects a signed-in non-admin from admin routes', async () => {
    const email = `admin-403-${Date.now()}@example.com`
    const password = 'password12'
    await createUser({ email, password, name: 'Regular' })

    const loggedIn = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const cookie = loggedIn.res.headers.getSetCookie?.().find(value => value.startsWith('nuxt_app_session='))
      ?? loggedIn.res.headers.get('set-cookie')
      ?? ''

    const { res, body } = await json('/v1/admin/dashboard', {
      headers: { Cookie: cookie.split(';')[0]! },
    })
    expect(res.status).toBe(403)
    expect(body).toEqual({ message: 'Forbidden' })
  })

  it('lets an admin into admin routes', async () => {
    const email = `admin-200-${Date.now()}@example.com`
    const password = 'password12'
    await createUser({ email, password, name: 'Operator', role: 'admin' })

    const loggedIn = await json('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, requireRole: 'admin' }),
    })
    expect(loggedIn.res.status).toBe(200)
    const cookie = loggedIn.res.headers.getSetCookie?.().find(value => value.startsWith('nuxt_app_session='))
      ?? loggedIn.res.headers.get('set-cookie')
      ?? ''

    const { res, body } = await json('/v1/admin/dashboard', {
      headers: { Cookie: cookie.split(';')[0]! },
    })
    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      message: 'Welcome to admin dashboard',
      user: { email, name: 'Operator', role: 'admin' },
    })
  })
})
