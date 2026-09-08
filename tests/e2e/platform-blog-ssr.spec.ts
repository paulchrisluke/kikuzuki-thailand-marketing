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
