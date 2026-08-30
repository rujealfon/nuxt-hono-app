import process from 'node:process'
import { API_PROXY_PREFIX, isVercelPreviewHost } from '@nuxt-app/auth'
import { resolveVercelPreviewUrl } from '@nuxt-app/env'
import { parsePublicUrl } from '@nuxt-app/types'

/** Prefer an explicit env, then this request's sibling preview API, then the baked runtimeConfig. */
export function resolveApiProxyOrigin(bakedApiUrl: string): string {
  return parsePublicUrl(
    process.env.NUXT_PUBLIC_API_URL || resolveVercelPreviewUrl('nuxt-app-api') || bakedApiUrl,
    bakedApiUrl || 'http://localhost:3000',
  )
}

export function apiProxyTarget(apiUrl: string, requestHref: string): string {
  const incoming = new URL(requestHref)
  const destPath = incoming.pathname.startsWith(API_PROXY_PREFIX)
    ? incoming.pathname.slice(API_PROXY_PREFIX.length) || '/'
    : incoming.pathname
  return new URL(`${destPath}${incoming.search}`, apiUrl).toString()
}

export function vercelProtectionBypassHeaders(
  secret: string | undefined,
  targetHostname: string,
): Record<string, string> {
  if (!secret)
    return {}
  if (!isVercelPreviewHost(targetHostname))
    return {}
  return { 'x-vercel-protection-bypass': secret }
}
