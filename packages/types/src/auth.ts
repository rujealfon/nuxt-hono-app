import { z } from 'zod'

const registerRequired = 'Email, password and name are required'
const loginRequired = 'Email and password are required'
const invalidEmail = 'Invalid email'
const bcryptMaxBytes = 72
const passwordTooLong = 'Password must be at most 72 bytes'

export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const userRoleSchema = z.enum(USER_ROLES)

function emailField(required: string) {
  return z.string(required).min(1, required).pipe(z.email(invalidEmail))
}

function fitsBcrypt(password: string) {
  return new TextEncoder().encode(password).byteLength <= bcryptMaxBytes
}

export const registerSchema = z.object({
  email: emailField(registerRequired),
  password: z.string(registerRequired)
    .min(8, 'Password must be at least 8 characters')
    .refine(fitsBcrypt, { error: passwordTooLong }),
  name: z.string(registerRequired).min(1, registerRequired),
})

export const loginSchema = z.object({
  email: emailField(loginRequired),
  password: z.string(loginRequired)
    .min(1, loginRequired)
    .refine(fitsBcrypt, { error: passwordTooLong }),
  requireRole: userRoleSchema.optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

export const authUserSchema = z.object({
  id: z.nanoid(),
  email: z.email(),
  name: z.string().min(1),
  role: userRoleSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>

export const authResponseSchema = z.object({
  user: authUserSchema,
  message: z.string().optional(),
})

export const meResponseSchema = z.object({
  user: authUserSchema.nullable(),
})

export const messageResponseSchema = z.object({
  message: z.string(),
})

export type AuthResponse = z.infer<typeof authResponseSchema>

export const AUTH_MOUNT = '/auth'

export const authHttp = {
  register: { route: '/register' },
  login: { route: '/login' },
  logout: { route: '/logout' },
  me: { route: '/me' },
} as const

export function matchesRequiredRole(
  user: AuthUser,
  requireRole?: AuthUser['role'],
): boolean {
  if (!requireRole)
    return true
  return user.role === requireRole
}

export function parsePublicUrl(value: string | undefined, fallback: string): string {
  return z.url().parse((value || fallback).replace(/\/$/, ''))
}
