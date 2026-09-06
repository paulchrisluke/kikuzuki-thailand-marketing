import { expect, test } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('a verified user without an organization starts onboarding and can explicitly visit their profile', async ({ request, baseURL }) => {
  await loginAs(request, baseURL!, 'user-e2e-oauth-private-cimd')

  const destination = await request.get('/api/post-login', { maxRedirects: 0 })
  expect(destination.status()).toBe(302)
  expect(destination.headers().location).toBe('/dashboard/onboarding')

  const profile = await request.get('/api/post-login?redirect=/dashboard/account/profile', { maxRedirects: 0 })
  expect(profile.status()).toBe(302)
  expect(profile.headers().location).toBe('/dashboard/account/profile')
})

for (const width of [390, 1280]) {
  test(`public auth CTAs reflect the SSR session at ${width}px`, async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/docs']) {
      await page.goto(path)
      const header = page.locator('header').first()
      await expect(header.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible()
      await expect(header.getByRole('link', { name: 'Start free', exact: true }).first()).toBeVisible()
    }
    for (const path of ['/login', '/signup']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: path === '/login' ? 'Sign in' : 'Create your account', exact: true })).toBeVisible()
    }

    await loginAs(page.request, baseURL!, 'user-e2e-oauth-private-cimd')
    const session = await (await page.request.get('/api/auth/get-session')).json()
    for (const path of ['/', '/docs', '/plugin', '/features', '/pricing', '/templates/saya']) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      const html = await response!.text()
      expect(html).toContain(`Account: ${session.user.name}`)
      expect(html).not.toContain('href="/signup')
      expect(response!.headers()['cache-control']).toContain('no-store')
      const header = page.locator('header').first()
      await expect(header.getByRole('link', { name: `Account: ${session.user.name}`, exact: true }).first()).toBeVisible()
      await expect(header.getByRole('link', { name: 'Dashboard', exact: true }).first()).toHaveAttribute('href', '/api/post-login')
      await expect(page.locator('a[href^="/signup"]')).toHaveCount(0)
      if (width === 390 && path === '/') {
        await header.getByLabel('Toggle menu').click()
        await expect(page.locator('#mobile-menu').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
      }
    }
    for (const path of ['/login', '/signup']) {
      const response = await page.request.get(path, { maxRedirects: 0 })
      expect(response.status()).toBe(302)
      expect(response.headers().location).toBe('/api/post-login')
      const target = '/dashboard/account/profile'
      const redirected = await page.request.get(`${path}?redirect=${encodeURIComponent(target)}`, { maxRedirects: 0 })
      expect(redirected.headers().location).toBe(`/api/post-login?redirect=${encodeURIComponent(target)}`)
      const unsafe = await page.request.get(`${path}?redirect=https://example.com`, { maxRedirects: 0 })
      expect(unsafe.headers().location).toBe('/api/post-login')
      await page.goto(path)
      await expect(page).toHaveURL(/\/dashboard\/onboarding$/)
    }
    await page.goto('/oauth/login')
    await expect(page.getByRole('button', { name: /^Continue as / })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in with a different account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sign in to connect', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/oauth\/login$/)
  })
}
