import { getGoogleBusinessSnapshot } from '../../_shared/google-business'

interface Env {
  REVIEWS_DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const snapshot = await getGoogleBusinessSnapshot(env)
  return new Response(JSON.stringify(snapshot ?? {
    business: null,
    reviews: [],
    media: [],
    posts: [],
    errors: [],
    syncedAt: null
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  })
}
