import type { AppType } from '@nuxt-app/api/app'
import type { LoginInput, RegisterInput } from '@nuxt-app/types'
import type { ClientResponse } from 'hono/client'
import { messageFromFailedBody } from '@nuxt-app/types'
import { hc } from 'hono/client'
import { resolveAuthApiBase } from './api-url'

const protectionRedirectMessage = 'Preview is locked. Open this URL in the address bar and sign in to Vercel, then retry.'

function isProtectionRedirect(res: Response) {
  return res.type === 'opaqueredirect' || res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308
}

function isProtectionRedirectError(error: unknown) {
  return error instanceof Error && error.message === protectionRedirectMessage
}

const rpcFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    redirect: 'manual',
    headers,
  })

  if (isProtectionRedirect(res))
    throw new Error(protectionRedirectMessage)

  if (!res.ok)
    throw new Error(messageFromFailedBody(await res.json().catch(() => null)))

  return res
}

async function json<T>(res: ClientResponse<T, 200, 'json'>): Promise<T> {
  return res.json().catch(() => {
    throw new Error('Request failed')
  })
}

export function createAuthClient(apiUrl: string, pageHref?: string) {
  const baseUrl = resolveAuthApiBase(apiUrl, pageHref)
  const client = hc<AppType>(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, { fetch: rpcFetch })

  return {
    async login(input: LoginInput) {
      const res = await client.v1.auth.login.$post({ json: input })
      if (res.status !== 200)
        throw new Error('Request failed')
      return json(res)
    },

    async register(input: RegisterInput) {
      const res = await client.v1.auth.register.$post({ json: input })
      if (res.status !== 200)
        throw new Error('Request failed')
      return json(res)
    },

    async logout() {
      const res = await client.v1.auth.logout.$post({})
      if (res.status !== 200)
        throw new Error('Request failed')
      return json(res)
    },

    async me() {
      try {
        const res = await client.v1.auth.me.$get()
        if (res.status !== 200)
          throw new Error('Request failed')
        return await json(res)
      }
      catch (error) {
        if (isProtectionRedirectError(error))
          return { user: null }
        throw error
      }
    },
  }
}

export type AuthClient = ReturnType<typeof createAuthClient>
