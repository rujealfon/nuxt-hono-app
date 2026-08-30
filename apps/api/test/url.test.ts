import { describe, expect, it } from 'vitest'
import {
  isPooledConnectionString,
  replaceDatabaseName,
  resolveDatabaseUrl,
  resolveMigrationDatabaseUrl,
  TEST_DATABASE_NAME,
} from '#api/db/url.js'
import { env, envSchema, isPlainRedisToUpstash } from '#api/env.js'

const neonPooled = 'postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=verify-full'
const neonDirect = 'postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech:5432/neondb?sslmode=verify-full'
const local = 'postgres://nuxt_app_postgres_user:nuxt_app_postgres_password@localhost:5433/nuxt_app_db'

describe('isPooledConnectionString', () => {
  it('detects a Neon pooler hostname', () => {
    expect(isPooledConnectionString(neonPooled)).toBe(true)
  })

  it('detects pgbouncer=true', () => {
    expect(isPooledConnectionString(`${local}?pgbouncer=true`)).toBe(true)
  })

  it('detects PgBouncer port 6432', () => {
    expect(isPooledConnectionString('postgres://nuxt_app_postgres_user:nuxt_app_postgres_password@localhost:6432/nuxt_app_db')).toBe(true)
  })

  it('does not treat a Neon direct host as pooled', () => {
    expect(isPooledConnectionString(neonDirect)).toBe(false)
  })

  it('does not treat local Compose as pooled', () => {
    expect(isPooledConnectionString(local)).toBe(false)
  })
})

describe('resolveDatabaseUrl', () => {
  it('uses DATABASE_URL_TEST when set in test', () => {
    expect(env.NODE_ENV).toBe('test')
    if (env.DATABASE_URL_TEST)
      expect(resolveDatabaseUrl()).toBe(env.DATABASE_URL_TEST)
    else
      expect(resolveDatabaseUrl()).toBe(replaceDatabaseName(env.DATABASE_URL, TEST_DATABASE_NAME))
  })
})

describe('resolveMigrationDatabaseUrl', () => {
  it('uses the test database in test, not DATABASE_URL_UNPOOLED', () => {
    expect(resolveMigrationDatabaseUrl({
      nodeEnv: 'test',
      databaseUrl: local,
      databaseUrlTest: 'postgres://nuxt_app_postgres_user:nuxt_app_postgres_password@localhost:5433/nuxt_app_db_test',
      databaseUrlUnpooled: neonDirect,
    })).toBe('postgres://nuxt_app_postgres_user:nuxt_app_postgres_password@localhost:5433/nuxt_app_db_test')
  })

  it('prefers DATABASE_URL_UNPOOLED outside test', () => {
    expect(resolveMigrationDatabaseUrl({
      nodeEnv: 'production',
      databaseUrl: neonPooled,
      databaseUrlUnpooled: neonDirect,
    })).toBe(neonDirect)
  })

  it('falls back to DATABASE_URL when the runtime URL is not pooled', () => {
    expect(resolveMigrationDatabaseUrl({
      nodeEnv: 'production',
      databaseUrl: local,
    })).toBe(local)
  })

  it('requires DATABASE_URL_UNPOOLED in production when DATABASE_URL is pooled', () => {
    expect(() => resolveMigrationDatabaseUrl({
      nodeEnv: 'production',
      databaseUrl: neonPooled,
    })).toThrow(/DATABASE_URL_UNPOOLED is required/)
  })

  it('does not require DATABASE_URL_UNPOOLED in development when DATABASE_URL is pooled', () => {
    expect(resolveMigrationDatabaseUrl({
      nodeEnv: 'development',
      databaseUrl: neonPooled,
    })).toBe(neonPooled)
  })
})

describe('isPlainRedisToUpstash', () => {
  it('flags redis:// to an Upstash host', () => {
    expect(isPlainRedisToUpstash('redis://default:pass@ready-os-12345.upstash.io:6379')).toBe(true)
  })

  it('accepts rediss:// to Upstash', () => {
    expect(isPlainRedisToUpstash('rediss://default:pass@ready-os-12345.upstash.io:6379')).toBe(false)
  })

  it('does not treat local Compose Redis as Upstash', () => {
    expect(isPlainRedisToUpstash('redis://localhost:6380')).toBe(false)
    expect(isPlainRedisToUpstash('redis://redis:6379')).toBe(false)
  })
})

describe('envSchema', () => {
  it('requires every service URL in production', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/database',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path[0])).toEqual([
        'APP_URL',
        'ADMIN_URL',
        'WEB_URL',
        'REDIS_URL',
      ])
    }
  })

  it('keeps local service defaults outside production', () => {
    const result = envSchema.parse({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/database',
    })

    expect(result.API_URL).toBe('http://localhost:3000')
    expect(result.APP_URL).toBe('http://localhost:3001')
    expect(result.ADMIN_URL).toBe('http://localhost:3002')
    expect(result.WEB_URL).toBe('http://localhost:3003')
    expect(result.REDIS_URL).toBe('redis://localhost:6380')
  })
})
