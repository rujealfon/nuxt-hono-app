import type { Env } from 'hono'
import type { AppEnv } from '#api/types.js'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createFactory } from 'hono/factory'
import defaultHook from 'stoker/openapi/default-hook'

export const factory = createFactory<AppEnv>()

export function createRouter<E extends Env = AppEnv>() {
  return new OpenAPIHono<E>({
    strict: false,
    defaultHook,
  })
}
