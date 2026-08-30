import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_PROXY_PREFIX } from '../src/api-url'
import { createAuthClient } from '../src/client'

const user = {
  id: 'V1StGXR8_Z5jdHi6B-myT',
  email: 'ada@example.com',
  name: 'Ada',
  role: 'user' as const,
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createAuthClient', () => {
  const fetchMock = vi.fn()
  const authClient = createAuthClient('http://localhost:3000')

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts login with credentials and returns the user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user, message: 'ok' }))

    const result = await authClient.login({
      email: 'ada@example.com',
      password: 'password12',
    })

    expect(result.user).toEqual(user)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('http://localhost:3000/v1/auth/login')
    expect(init.credentials).toBe('include')
    expect(init.redirect).toBe('manual')
    expect(init.method?.toUpperCase()).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'ada@example.com',
      password: 'password12',
    })
  })

  it('constructs a client for a given base URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient('https://constructed.example')

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('https://constructed.example/v1/auth/me')
  })

  it('throws the first validation issue from a failed login', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, {
      error: { issues: [{ message: 'Email and password are required' }] },
    }))

    await expect(authClient.login({ email: '', password: '' }))
      .rejects
      .toThrow('Email and password are required')
  })

  it('throws the message field when the API returns one', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Invalid credentials' }))

    await expect(authClient.login({ email: 'ada@example.com', password: 'nope' }))
      .rejects
      .toThrow('Invalid credentials')
  })

  it('posts register and returns the success message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { message: 'Registered successfully' }))

    await expect(authClient.register({
      email: 'ada@example.com',
      password: 'password12',
      name: 'Ada',
    })).resolves.toEqual({ message: 'Registered successfully' })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('/auth/register')
  })

  it('posts logout', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { message: 'Logged out' }))

    await expect(authClient.logout()).resolves.toEqual({ message: 'Logged out' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/auth/logout')
    expect(init.credentials).toBe('include')
  })

  it('calls me through /__api when the page is a distinct vercel.app host', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient(
      'https://nuxt-app-api-git-feat.vercel.app',
      'https://nuxt-app-app-git-feat.vercel.app/login',
    )

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain(`${API_PROXY_PREFIX}/v1/auth/me`)
  })

  it('keeps sibling custom domains so COOKIE_DOMAIN can share the Session', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient(
      'https://api.nuxt-app.com',
      'https://app.nuxt-app.com/login',
    )

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('https://api.nuxt-app.com/v1/auth/me')
  })

  it('uses the proxy when a vercel.app page calls a custom API host', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient(
      'https://api.nuxt-app.com',
      'https://nuxt-app-app-git-feat.vercel.app/login',
    )

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain(`${API_PROXY_PREFIX}/v1/auth/me`)
  })

  it('keeps a same-origin API URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient(
      'https://app-preview.vercel.app',
      'https://app-preview.vercel.app/login',
    )

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('https://app-preview.vercel.app/v1/auth/me')
  })

  it('keeps local host ports', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))
    const client = createAuthClient(
      'http://localhost:3000',
      'http://localhost:3001/login',
    )

    await client.me()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('http://localhost:3000/v1/auth/me')
  })

  it('returns the current user from me', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user }))

    await expect(authClient.me()).resolves.toEqual({ user })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(String(url)).toContain('/auth/me')
  })

  it('returns a null user when me succeeds without a session', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: null }))

    await expect(authClient.me()).resolves.toEqual({ user: null })
  })

  it('does not follow a Vercel SSO redirect on me', async () => {
    fetchMock.mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: 'https://vercel.com/sso-api?url=https://app.example/__api/auth/me' },
    }))

    await expect(authClient.me()).resolves.toEqual({ user: null })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
  })

  it('tells the user to sign in to Vercel when login hits SSO', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 307 }))

    await expect(authClient.login({ email: 'ada@example.com', password: 'password12' }))
      .rejects
      .toThrow(/sign in to Vercel/)
  })

  it('throws when me returns a server error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'boom' }))

    await expect(authClient.me()).rejects.toThrow('boom')
  })

  it('throws when me cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(authClient.me()).rejects.toThrow('network down')
  })

  it('throws when me returns a malformed user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: { ...user, role: 'nope' },
    }))

    await expect(authClient.me()).rejects.toThrow('Invalid response')
  })

  it('throws when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('nope', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    await expect(authClient.me()).rejects.toThrow('Request failed')
  })
})
