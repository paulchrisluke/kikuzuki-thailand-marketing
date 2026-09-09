// Server-side auth check for the dashboard route middleware. Called directly so
// nested SSR does not self-fetch and lose Cloudflare bindings.
import type { H3Event } from 'nitro'
import { cloudflareEnv } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'

export type RouteAccessResult =
  | { status: 'unauthenticated' }
  | { status: 'ok', allowed: boolean }

export async function resolveAccountAccessForEvent(event: H3Event): Promise<RouteAccessResult> {
  const env = cloudflareEnv(event)
  const session = await getAuthSession(event, env)
  if (!session?.user) return { status: 'unauthenticated' }
  return { status: 'ok', allowed: true }
}
