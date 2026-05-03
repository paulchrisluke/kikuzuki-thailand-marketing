import { isAdminRequest } from '../../_shared/admin-auth'

interface Env {
  AUTH_COOKIE_SECRET?: string
  GOOGLE_ADMIN_EMAILS?: string
  REVIEWS_DB: D1Database
  REVIEWS_ADMIN_TOKEN?: string
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers
    }
  })

const cleanStatus = (status: string | null) =>
  ['pending', 'approved', 'rejected'].includes(status ?? '') ? status : 'pending'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await isAdminRequest(request, env))) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const status = cleanStatus(url.searchParams.get('status'))
  const slug = url.searchParams.get('slug')?.trim()

  const query = slug
    ? `SELECT id, menu_item_slug AS menuItemSlug, author, rating, title, content, status, created_at AS createdAt
       FROM reviews
       WHERE status = ? AND menu_item_slug = ?
       ORDER BY created_at DESC
       LIMIT 100`
    : `SELECT id, menu_item_slug AS menuItemSlug, author, rating, title, content, status, created_at AS createdAt
       FROM reviews
       WHERE status = ?
       ORDER BY created_at DESC
       LIMIT 100`

  const statement = env.REVIEWS_DB.prepare(query)
  const { results } = slug ? await statement.bind(status, slug).all() : await statement.bind(status).all()

  return json({ reviews: results ?? [] })
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await isAdminRequest(request, env))) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; status?: string }

  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const id = body.id?.trim()
  const status = body.status?.trim()

  if (!id) return json({ error: 'Missing review id.' }, { status: 400 })
  if (!['approved', 'rejected', 'pending'].includes(status ?? '')) {
    return json({ error: 'Invalid review status.' }, { status: 400 })
  }

  const result = await env.REVIEWS_DB.prepare(
    `UPDATE reviews
     SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(status, id).run()

  return json({ ok: true, changes: result.meta.changes })
}
