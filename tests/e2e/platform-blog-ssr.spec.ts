import { expect, test } from '@playwright/test'

test('platform blog renders its public API posts in server HTML', async ({ request }) => {
  const api = await request.get('/api/public/blog')
  expect(api.ok()).toBe(true)
  const { posts } = await api.json()
  expect(Array.isArray(posts)).toBe(true)

  const response = await request.get('/blog')
  expect(response.ok()).toBe(true)
  const html = await response.text()
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  expect(markup.includes('Blog unavailable'), 'SSR must not render the blog error state').toBe(false)
  expect(markup.includes('Loading posts...'), 'SSR must finish loading the blog').toBe(false)
  if (posts.length === 0) {
    expect(markup).toContain('No posts yet')
  }
  for (const post of posts.filter((post: { hide_from_nav: boolean }, index: number) => index === 0 || !post.hide_from_nav)) {
    const title = post.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
    expect(markup).toContain(title)
  }
})

test('platform documentation renders its docs collection in server HTML', async ({ request }) => {
  const api = await request.get('/api/public/blog?collection=docs')
  expect(api.ok()).toBe(true)
  const { posts } = await api.json()
  expect(Array.isArray(posts)).toBe(true)
  for (const post of posts) expect(post.collection).toBe('docs')

  const index = await request.get('/docs')
  expect(index.ok()).toBe(true)
  const markup = (await index.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  for (const post of posts) {
    const title = post.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
    expect(markup).toContain(title)
  }

  const blog = await request.get('/api/public/blog')
  const blogPosts = (await blog.json()).posts as Array<{ collection: string }>
  for (const post of blogPosts) expect(post.collection).toBe('blog')
})
