/* eslint-disable no-console */
/**
 * Create or promote an admin user (not a data dump).
 * Run: ADMIN_PASSWORD=... pnpm db:ensure-admin
 */
import process from 'node:process'
import { registerSchema } from '@nuxt-app/types'
import { pool } from '#api/db/index.js'
import { ensureAdmin } from '#api/modules/auth/identity.js'

export function resolveAdminPassword(env: NodeJS.Dict<string> = process.env): string {
  const password = env.ADMIN_PASSWORD
  if (!password?.trim()) {
    throw new Error(
      'ADMIN_PASSWORD is required to create or update an admin user. Set it explicitly, e.g. ADMIN_PASSWORD=... pnpm db:ensure-admin',
    )
  }

  const parsed = registerSchema.shape.password.safeParse(password)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'ADMIN_PASSWORD is invalid')
  }

  return parsed.data
}

export function resolveAdminEmail(env: NodeJS.Dict<string> = process.env): string {
  const email = (env.ADMIN_EMAIL?.trim() || 'admin@nuxt-app.com').toLowerCase()
  const parsed = registerSchema.shape.email.safeParse(email)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'ADMIN_EMAIL is invalid')
  }

  return parsed.data
}

export async function ensureAdminFromEnv(env: NodeJS.Dict<string> = process.env) {
  const email = resolveAdminEmail(env)
  const name = env.ADMIN_NAME || 'Admin'
  const password = resolveAdminPassword(env)

  const result = await ensureAdmin({ email, password, name })

  if (result.created) {
    console.log('Admin user created:')
    console.log(`  Email:    ${result.user.email}`)
    console.log(`  Role:     ${result.user.role}`)
    return
  }

  const action = result.alreadyAdmin
    ? 'password reset'
    : 'password reset and promoted to admin'
  console.log(`User ${email} already exists; ${action}.`)
}

const invokedDirectly = process.argv[1]?.endsWith('ensure-admin.ts')
if (invokedDirectly) {
  ensureAdminFromEnv()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
