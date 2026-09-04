import type { AuthUser } from '@nuxt-app/types'
import { authUserSchema } from '@nuxt-app/types'
import { and, eq, gt, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, sessions, users } from '#api/db/index.js'

const sessionIdSchema = z.uuid()
const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000

function asSessionId(sessionId: string | undefined): string | undefined {
  const parsed = sessionIdSchema.safeParse(sessionId)
  return parsed.success ? parsed.data : undefined
}

export async function deleteExpiredSessions(now = new Date()) {
  await db.delete(sessions).where(lte(sessions.expiresAt, now))
}

export async function issueSession(userPk: string): Promise<string> {
  const now = new Date()
  await deleteExpiredSessions(now)
  const [session] = await db.insert(sessions).values({
    userId: userPk,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  }).returning({ id: sessions.id })

  if (!session)
    throw new Error('Failed to create session')

  return session.id
}

export async function readSessionUser(sessionId: string): Promise<AuthUser | null> {
  const id = asSessionId(sessionId)
  if (!id)
    return null

  const result = await db
    .select({
      publicId: users.publicId,
      email: users.email,
      name: users.name,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1)

  const row = result[0]
  if (!row)
    return null

  return toAuthUser(row)
}

export function toAuthUser(user: {
  publicId: string
  email: string
  name: string
  role: string
}): AuthUser {
  return authUserSchema.parse({
    id: user.publicId,
    email: user.email,
    name: user.name,
    role: user.role,
  })
}

export async function revokeSession(sessionId: string) {
  const id = asSessionId(sessionId)
  if (!id)
    return
  await db.delete(sessions).where(eq(sessions.id, id))
}
