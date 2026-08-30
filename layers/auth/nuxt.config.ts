import process from 'node:process'
import { resolveVercelPreviewUrl } from '@nuxt-app/env'
import { loadRootEnv } from '@nuxt-app/layer-base/load-root-env'
import { parsePublicUrl } from '@nuxt-app/types'
import { defineNuxtConfig } from 'nuxt/config'

loadRootEnv()

const apiUrl = parsePublicUrl(
  process.env.NUXT_PUBLIC_API_URL || resolveVercelPreviewUrl('nuxt-app-api'),
  'http://localhost:3000',
)

export default defineNuxtConfig({
  $meta: { name: 'auth' },
  modules: ['@pinia/nuxt', '@pinia/colada-nuxt'],
  runtimeConfig: {
    // API project's Protection Bypass secret (not this app's). Preview only.
    apiProtectionBypass: process.env.NUXT_API_PROTECTION_BYPASS || '',
    public: {
      apiUrl,
    },
  },
})
