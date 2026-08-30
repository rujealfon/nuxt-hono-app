import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { apiProxyTarget, resolveApiProxyOrigin, vercelProtectionBypassHeaders } from '../server/utils/api-proxy'

const envKeys = ['VERCEL_ENV', 'VERCEL_BRANCH_URL', 'NUXT_PUBLIC_API_URL'] as const
const saved: Partial<Record<typeof envKeys[number], string | undefined>> = {}

function setEnv(env: Partial<Record<typeof envKeys[number], string | undefined>>) {
  for (const key of envKeys) {
    if (!(key in saved))
      saved[key] = process.env[key]
    const value = env[key]
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
}

afterEach(() => {
  for (const key of envKeys) {
    const value = saved[key]
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
    delete saved[key]
  }
})

describe('apiProxyTarget', () => {
  it('strips /__api and keeps the query string', () => {
    expect(apiProxyTarget(
      'https://nuxt-app-api-git-feature-vercel-preview-rujealfons-projects.vercel.app',
      'https://nuxt-app-app-git-feature-vercel-preview-rujealfons-projects.vercel.app/__api/auth/me?fresh=1',
    )).toBe('https://nuxt-app-api-git-feature-vercel-preview-rujealfons-projects.vercel.app/auth/me?fresh=1')
  })

  it('maps /__api to the API origin root', () => {
    expect(apiProxyTarget('http://localhost:3000', 'http://localhost:3001/__api')).toBe('http://localhost:3000/')
  })
})

describe('resolveApiProxyOrigin', () => {
  it('uses the sibling preview API when the baked URL is localhost', () => {
    setEnv({
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'nuxt-app-app-git-feature-vercel-preview-rujealfons-projects.vercel.app',
      NUXT_PUBLIC_API_URL: undefined,
    })

    expect(resolveApiProxyOrigin('http://localhost:3000'))
      .toBe('https://nuxt-app-api-git-feature-vercel-preview-rujealfons-projects.vercel.app')
  })

  it('lets an explicit NUXT_PUBLIC_API_URL win', () => {
    setEnv({
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'nuxt-app-app-git-feat.vercel.app',
      NUXT_PUBLIC_API_URL: 'https://api.nuxt-app.com',
    })

    expect(resolveApiProxyOrigin('http://localhost:3000')).toBe('https://api.nuxt-app.com')
  })
})

describe('vercelProtectionBypassHeaders', () => {
  it('sends the bypass header only to a vercel.app API', () => {
    expect(vercelProtectionBypassHeaders('s3cret', 'nuxt-app-api-git-feat.vercel.app'))
      .toEqual({ 'x-vercel-protection-bypass': 's3cret' })
  })

  it('does not send the secret when it is unset', () => {
    expect(vercelProtectionBypassHeaders(undefined, 'nuxt-app-api-git-feat.vercel.app')).toEqual({})
    expect(vercelProtectionBypassHeaders('', 'nuxt-app-api-git-feat.vercel.app')).toEqual({})
  })

  it('does not send the secret to a non-Vercel API', () => {
    expect(vercelProtectionBypassHeaders('s3cret', 'api.nuxt-app.com')).toEqual({})
  })
})
