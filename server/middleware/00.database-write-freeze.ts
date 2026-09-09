import { defineHandler } from 'nitro'
import { isRequestFrozen, type DatabaseWriteFreezeEnv } from '~/server/utils/database-write-freeze'

export default defineHandler((event) => {
  const env = event.req.runtime?.cloudflare?.env as DatabaseWriteFreezeEnv | undefined
  if (!isRequestFrozen(env, event.req.method)) return

  return new Response(
    JSON.stringify({
      error: 'Service temporarily unavailable during database maintenance',
    }),
    {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'retry-after': '300',
      },
    },
  )
})
