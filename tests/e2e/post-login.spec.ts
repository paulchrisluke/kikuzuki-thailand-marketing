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
