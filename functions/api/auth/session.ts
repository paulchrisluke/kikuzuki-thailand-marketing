import { readAdminSession } from '../../_shared/admin-auth'

interface Env {
  AUTH_COOKIE_SECRET?: string
  GOOGLE_ADMIN_EMAILS?: string
  REVIEWS_ADMIN_TOKEN?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await readAdminSession(request, env)
  return new Response(JSON.stringify({
    authenticated: Boolean(session),
    email: session?.email ?? null
  }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
