interface Env {
  REVIEWS_DB: D1Database
  TURNSTILE_SECRET_KEY?: string
}

type ReviewStatus = 'pending' | 'approved' | 'rejected'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers
    }
  })

const badRequest = (message: string) => json({ error: message }, { status: 400 })

const cleanString = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const hashIp = async (ip: string) => {
  if (!ip) return null
  const bytes = new TextEncoder().encode(ip)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const verifyTurnstile = async (request: Request, token: string, secret?: string) => {
  if (!secret) return true
  if (!token) return false

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') ?? ''
    })
  })

  const result = await response.json<{ success?: boolean }>()
  return Boolean(result.success)
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const slug = cleanString(url.searchParams.get('slug'), 120)

  if (!slug) return badRequest('Missing menu item slug.')

  const { results } = await env.REVIEWS_DB.prepare(
    `SELECT id, menu_item_slug AS menuItemSlug, author, rating, title, content, created_at AS createdAt
     FROM reviews
     WHERE menu_item_slug = ? AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT 50`
  ).bind(slug).all()

  return json({ reviews: results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body.')
  }

  const menuItemSlug = cleanString(body.menuItemSlug, 120)
  const author = cleanString(body.author, 80)
  const title = cleanString(body.title, 120)
  const content = cleanString(body.content, 1200)
  const rating = Number(body.rating)
  const turnstileToken = cleanString(body.turnstileToken, 2048)

  if (!menuItemSlug) return badRequest('Missing menu item slug.')
  if (!author) return badRequest('Please enter your name.')
  if (!title) return badRequest('Please add a short review title.')
  if (content.length < 10) return badRequest('Review text must be at least 10 characters.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return badRequest('Rating must be between 1 and 5.')

  const turnstileOk = await verifyTurnstile(request, turnstileToken, env.TURNSTILE_SECRET_KEY)
  if (!turnstileOk) return json({ error: 'Turnstile verification failed.' }, { status: 403 })

  const id = crypto.randomUUID()
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP') ?? '')
  const userAgent = cleanString(request.headers.get('User-Agent'), 300)
  const status: ReviewStatus = 'pending'

  await env.REVIEWS_DB.prepare(
    `INSERT INTO reviews (id, menu_item_slug, author, rating, title, content, status, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, menuItemSlug, author, rating, title, content, status, ipHash, userAgent).run()

  return json({
    review: { id, menuItemSlug, author, rating, title, content, status },
    message: 'Thanks. Your review is pending moderation.'
  }, { status: 201 })
}
