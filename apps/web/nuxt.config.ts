import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolveVercelPreviewUrl } from '@nuxt-app/env'
import { loadRootEnv } from '@nuxt-app/layer-base/load-root-env'
import { parsePublicUrl } from '@nuxt-app/types'

loadRootEnv()

export default defineNuxtConfig({
  extends: ['@nuxt-app/layer-base'],
  alias: {
    '@web': fileURLToPath(new URL('./app', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      appUrl: parsePublicUrl(
        process.env.NUXT_PUBLIC_APP_URL || process.env.APP_URL || resolveVercelPreviewUrl('nuxt-app-app'),
        'http://localhost:3001',
      ),
    },
  },
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },
  routeRules: {
    '/**': { prerender: true },
  },
})
