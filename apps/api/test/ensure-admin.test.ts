import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import app from '#api/app.js'
import { db, users } from '#api/db/index.js'
import { ensureAdminFromEnv, resolveAdminEmail, resolveAdminPassword } from '#api/ensure-admin.js'
import { createUser } from '#api/modules/auth/identity.js'

async function login(email: string, password: string) {
  return app.request('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

async function loginJson(email: string, password: string) {
  const res = await login(email, password)
  return { status: res.status, body: await res.json() as { user?: { email: string, name?: string, role: string } } }
}

function sessionCookie(res: Response): string | undefined {
  const header = res.headers.getSetCookie?.().find(value => value.startsWith('nuxt_app_session='))
    ?? res.headers.get('set-cookie')
    ?? undefined
  return header?.split(';')[0]
}

describe('resolveAdminPassword', () => {
  it('rejects a missing password', () => {
    expect(() => resolveAdminPassword({})).toThrow(/ADMIN_PASSWORD is required/)
  })

  it('rejects a whitespace-only password', () => {
    expect(() => resolveAdminPassword({ ADMIN_PASSWORD: '   ' })).toThrow(/ADMIN_PASSWORD is required/)
  })

  it('rejects a short password', () => {
    expect(() => resolveAdminPassword({ ADMIN_PASSWORD: 'short' })).toThrow(
      'Password must be at least 8 characters',
    )
  })

  it('returns an explicit password', () => {
    expect(resolveAdminPassword({ ADMIN_PASSWORD: 'correct-horse' })).toBe('correct-horse')
  })

  it('preserves leading and trailing spaces', () => {
    expect(resolveAdminPassword({ ADMIN_PASSWORD: '  correct-horse  ' })).toBe('  correct-horse  ')
  })
})

describe('resolveAdminEmail', () => {
  it('defaults to the documented admin address', () => {
    expect(resolveAdminEmail({})).toBe('admin@nuxt-app.com')
  })

  it('trims whitespace and lowercases', () => {
    expect(resolveAdminEmail({ ADMIN_EMAIL: '  Admin@Nuxt-App.COM  ' })).toBe('admin@nuxt-app.com')
  })

  it('rejects a malformed email', () => {
    expect(() => resolveAdminEmail({ ADMIN_EMAIL: 'not-an-email' })).toThrow('Invalid email')
  })
})

describe('ensureAdminFromEnv', () => {
  it('does not create an admin when ADMIN_PASSWORD is unset', async () => {
    const email = `admin-${Date.now()}@nuxt-app.com`
    await expect(ensureAdminFromEnv({ ADMIN_EMAIL: email, ADMIN_NAME: 'Admin' })).rejects.toThrow(
      /ADMIN_PASSWORD is required/,
    )

    expect((await loginJson(email, 'unique-pass-99')).status).toBe(401)
  })

  it('creates an admin when ADMIN_PASSWORD is set', async () => {
    const email = `admin-ok-${Date.now()}@nuxt-app.com`
    await ensureAdminFromEnv({
      ADMIN_EMAIL: email,
      ADMIN_NAME: 'Admin',
      ADMIN_PASSWORD: 'unique-pass-99',
    })

    const { status, body } = await loginJson(email, 'unique-pass-99')
    expect(status).toBe(200)
    expect(body.user).toMatchObject({ email, name: 'Admin', role: 'admin' })
  })

  it('does not promote a pre-existing account when ADMIN_PASSWORD is unset', async () => {
    const email = `admin-pre-${Date.now()}@nuxt-app.com`
    await createUser({ email, password: 'attacker-pass', name: 'Pre' })

    await expect(ensureAdminFromEnv({ ADMIN_EMAIL: email, ADMIN_NAME: 'Admin' })).rejects.toThrow(
      /ADMIN_PASSWORD is required/,
    )

    const { status, body } = await loginJson(email, 'attacker-pass')
    expect(status).toBe(200)
    expect(body.user).toMatchObject({ email, role: 'user' })
  })

  it('resets the password and sessions when promoting a pre-existing account', async () => {
    const email = `admin-takeover-${Date.now()}@nuxt-app.com`
    await createUser({ email, password: 'attacker-pass', name: 'Pre' })
    const loggedIn = await login(email, 'attacker-pass')
    const cookie = sessionCookie(loggedIn)
    expect(cookie).toBeTruthy()
    expect((await (await app.request('/v1/auth/me', { headers: { Cookie: cookie! } })).json())).toMatchObject({
      user: { email, role: 'user' },
    })

    await ensureAdminFromEnv({
      ADMIN_EMAIL: email,
      ADMIN_NAME: 'Admin',
      ADMIN_PASSWORD: 'operator-pass-99',
    })

    expect((await loginJson(email, 'attacker-pass')).status).toBe(401)
    const promoted = await loginJson(email, 'operator-pass-99')
    expect(promoted.status).toBe(200)
    expect(promoted.body.user).toMatchObject({ email, role: 'admin' })
    expect(await (await app.request('/v1/auth/me', { headers: { Cookie: cookie! } })).json()).toEqual({
      user: null,
    })
  })

  it('finds an existing user when ADMIN_EMAIL differs only by case', async () => {
    const local = `admin-case-${Date.now()}`
    const email = `${local}@nuxt-app.com`
    await createUser({ email, password: 'attacker-pass', name: 'Pre' })

    await ensureAdminFromEnv({
      ADMIN_EMAIL: `${local.toUpperCase()}@Nuxt-App.COM`,
      ADMIN_NAME: 'Admin',
      ADMIN_PASSWORD: 'operator-pass-99',
    })

    const { status, body } = await loginJson(email, 'operator-pass-99')
    expect(status).toBe(200)
    expect(body.user).toMatchObject({ email, role: 'admin' })
  })

  it('leaves a usable admin if two ensure-admin runs race on the same email', async () => {
    const email = `admin-race-${Date.now()}@nuxt-app.com`
    await Promise.all([
      ensureAdminFromEnv({ ADMIN_EMAIL: email, ADMIN_NAME: 'Admin', ADMIN_PASSWORD: 'password-aaa' }),
      ensureAdminFromEnv({ ADMIN_EMAIL: email, ADMIN_NAME: 'Admin', ADMIN_PASSWORD: 'password-bbb' }),
    ])

    const matchesAaa = await loginJson(email, 'password-aaa')
    const matchesBbb = await loginJson(email, 'password-bbb')
    const winner = matchesAaa.status === 200 ? matchesAaa : matchesBbb
    expect(winner.status).toBe(200)
    expect(winner.body.user?.role).toBe('admin')
  })

  it('does not create an admin when ADMIN_EMAIL is malformed', async () => {
    await expect(ensureAdminFromEnv({
      ADMIN_EMAIL: 'not-an-email',
      ADMIN_NAME: 'Admin',
      ADMIN_PASSWORD: 'unique-pass-99',
    })).rejects.toThrow('Invalid email')

    const existing = await db.query.users.findFirst({
      where: eq(users.email, 'not-an-email'),
    })
    expect(existing).toBeUndefined()
  })
})
