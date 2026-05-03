import { clearAdminSessionCookie } from '../../_shared/admin-auth'

export const onRequestPost: PagesFunction = async () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Set-Cookie': clearAdminSessionCookie()
    }
  })
