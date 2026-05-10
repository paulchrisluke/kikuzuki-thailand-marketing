export interface Post {
  id: string
  organization_id: string
  site_id: string
  title: string | null
  body: string
  image_url: string | null
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  scheduled_for: string | null
  published_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PostChannelJob {
  id: string
  post_id: string
  organization_id: string
  channel: 'site' | 'gmb' | 'instagram' | 'facebook'
  status: 'pending' | 'published' | 'failed' | 'skipped'
  provider_post_id: string | null
  error: string | null
  published_at: string | null
  created_at: string
}

export interface PostWithChannels extends Post {
  channels: PostChannelJob[]
}

export async function listPosts(
  db: any,
  organizationId: string,
  siteId: string,
  status?: string
): Promise<Post[]> {
  let query = `
    SELECT * FROM posts
    WHERE organization_id = ? AND site_id = ?
  `
  const params: string[] = [organizationId, siteId]
  if (status) {
    query += ` AND status = ?`
    params.push(status)
  }
  query += ` ORDER BY updated_at DESC LIMIT 100`
  const result = await db.prepare(query).bind(...params).all()
  return result.results ?? []
}

export async function getPost(
  db: any,
  organizationId: string,
  siteId: string,
  postId: string
): Promise<PostWithChannels | null> {
  const post = await db.prepare(`
    SELECT * FROM posts WHERE id = ? AND organization_id = ? AND site_id = ? LIMIT 1
  `).bind(postId, organizationId, siteId).first()
  if (!post) return null

  const jobs = await db.prepare(
    `SELECT * FROM post_channel_jobs WHERE post_id = ? ORDER BY channel`
  ).bind(postId).all()

  return { ...post, channels: jobs.results ?? [] }
}

export async function createPost(
  db: any,
  organizationId: string,
  siteId: string,
  data: { title?: string; body: string; image_url?: string; scheduled_for?: string },
  createdBy: string
): Promise<Post> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO posts (id, organization_id, site_id, title, body, image_url, status, scheduled_for, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).bind(
    id, organizationId, siteId,
    data.title ?? null, data.body, data.image_url ?? null,
    data.scheduled_for ?? null, createdBy, now, now
  ).run()

  return await db.prepare('SELECT * FROM posts WHERE id = ? LIMIT 1').bind(id).first()
}

export async function updatePost(
  db: any,
  organizationId: string,
  siteId: string,
  postId: string,
  data: { title?: string; body?: string; image_url?: string; scheduled_for?: string | null },
  updatedBy: string
): Promise<Post | null> {
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const params: any[] = [now]

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title ?? null) }
  if (data.body !== undefined) { sets.push('body = ?'); params.push(data.body) }
  if (data.image_url !== undefined) { sets.push('image_url = ?'); params.push(data.image_url ?? null) }
  if (data.scheduled_for !== undefined) { sets.push('scheduled_for = ?'); params.push(data.scheduled_for ?? null) }

  params.push(postId, organizationId, siteId)
  await db.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ? AND organization_id = ? AND site_id = ?`)
    .bind(...params).run()

  return await db.prepare('SELECT * FROM posts WHERE id = ? LIMIT 1').bind(postId).first()
}

export async function publishPost(
  db: any,
  organizationId: string,
  siteId: string,
  postId: string,
  channels: Array<'site' | 'gmb' | 'instagram' | 'facebook'>
): Promise<PostWithChannels | null> {
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE posts SET status = 'published', published_at = ?, updated_at = ?
    WHERE id = ? AND organization_id = ? AND site_id = ?
  `).bind(now, now, postId, organizationId, siteId).run()

  // Create a channel job for each requested channel
  const jobs = channels.map(channel =>
    db.prepare(`
      INSERT INTO post_channel_jobs (id, post_id, organization_id, channel, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
      ON CONFLICT DO NOTHING
    `).bind(crypto.randomUUID(), postId, organizationId, channel, now)
  )
  if (jobs.length > 0) await db.batch(jobs)

  // 'site' channel publishes immediately — nothing async needed, post is live via public API
  await db.prepare(`
    UPDATE post_channel_jobs SET status = 'published', published_at = ?
    WHERE post_id = ? AND channel = 'site'
  `).bind(now, postId).run()

  return getPost(db, organizationId, siteId, postId)
}

export async function deletePost(
  db: any,
  organizationId: string,
  siteId: string,
  postId: string
): Promise<void> {
  await db.prepare(
    'DELETE FROM posts WHERE id = ? AND organization_id = ? AND site_id = ?'
  ).bind(postId, organizationId, siteId).run()
}

/** Public: published posts for the site, formatted for SayaPosts component */
export async function getPublishedPosts(
  db: any,
  siteId: string,
  limit = 20
): Promise<any[]> {
  const result = await db.prepare(`
    SELECT id, title, body, image_url, published_at, created_at
    FROM posts
    WHERE site_id = ? AND status = 'published'
    ORDER BY published_at DESC
    LIMIT ?
  `).bind(siteId, limit).all()

  return (result.results ?? []).map((p: any) => ({
    name: `posts/${p.id}`,
    title: p.title ?? '',
    summary: p.body,
    createTime: p.published_at ?? p.created_at,
    media: p.image_url ? [{ googleUrl: p.image_url, mediaFormat: 'IMAGE' }] : [],
  }))
}
