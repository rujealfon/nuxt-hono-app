import type { AuthUser, LoginInput, RegisterInput } from '@nuxt-app/types'
import { createAuthClient } from '@nuxt-app/auth'
import { defineQuery, useMutation, useQuery, useQueryCache } from '@pinia/colada'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

function runtimeAuthClient() {
  const config = useRuntimeConfig()
  const apiUrl = String(config.public.apiUrl || 'http://localhost:3000')
  const pageHref = import.meta.client ? window.location.href : undefined
  return createAuthClient(apiUrl, pageHref)
}

const useAuthMe = defineQuery(() => {
  return useQuery({
    key: authKeys.me,
    async query() {
      const res = await runtimeAuthClient().me()
      return res.user
    },
  })
})

export function useAuth() {
  const me = useAuthMe()
  const queryCache = useQueryCache()
  const error = ref<string | null>(null)

  function setUser(user: AuthUser | null) {
    queryCache.setQueryData(authKeys.me, user)
  }

  function fail(e: unknown): never {
    error.value = e instanceof Error ? e.message : 'Request failed'
    throw e
  }

  const loginMutation = useMutation({
    mutation: (input: LoginInput) => runtimeAuthClient().login(input),
    onSuccess(res) {
      setUser(res.user)
    },
  })

  const registerMutation = useMutation({
    mutation: (input: RegisterInput) => runtimeAuthClient().register(input),
  })

  async function fetchUser() {
    error.value = null
    try {
      await me.refetch()
      return me.data.value ?? null
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Request failed'
      setUser(null)
      return null
    }
  }

  async function login(input: LoginInput) {
    error.value = null
    try {
      return await loginMutation.mutateAsync(input)
    }
    catch (e) {
      fail(e)
    }
  }

  async function register(input: RegisterInput) {
    error.value = null
    try {
      return await registerMutation.mutateAsync(input)
    }
    catch (e) {
      fail(e)
    }
  }

  async function logout(redirectTo = '/login') {
    await runtimeAuthClient().logout()
    setUser(null)
    if (redirectTo)
      await navigateTo(redirectTo)
  }

  const user = computed(() => me.data.value ?? null)

  return {
    user,
    error,
    fetchUser,
    login,
    register,
    logout,
  }
}
