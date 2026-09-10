import { expect, test } from '@playwright/test'
import { collectPageErrors, dismissPreviewToolbar } from './helpers'
import { loginAs } from './helpers/auth'

// The manual-name path of the new-site wizard, driven the way an owner drives
// it: every step through the real UI, the draft preview rendering in its iframe,
// and the commit creating a NEW organization that becomes the session's active
// one. The fixture user owns one more organization per run; reset-e2e-artifacts
// sweeps non-fixture organizations older than two hours.
test('a new owner builds a draft and creates a site through the wizard', async ({ page, baseURL }) => {
  test.setTimeout(180_000)
  await dismissPreviewToolbar(page)
  await loginAs(page.request, baseURL!, 'user-e2e-onboarding-wizard')
  const errors = collectPageErrors(page)
  const name = `E2E Wizard ${Date.now().toString(36)}`

  await page.goto('/dashboard/onboarding')
  await page.getByRole('button', { name: 'Start building' }).click()
  await page.getByRole('button', { name: /Restaurant, café or bar/ }).click()
  await page.getByRole('button', { name: /Start manually/ }).click()
  await page.getByPlaceholder('Your business name…').fill(name)
  await page.keyboard.press('Enter')

  // The first save creates the draft and the pane switches to its live preview.
  const previewFrame = page.locator('iframe[title="Site preview"]')
  await expect(previewFrame).toHaveAttribute('src', /\/preview\/draft\//)
  const preview = page.frameLocator('iframe[title="Site preview"]')
  await expect(preview.locator('body')).toContainText(name)
  await expect(preview.locator('body')).not.toContainText('did not match its contract')

  // Location: the country is asked once, as a picker that arrives on the product
  // default (United States) and is changed here.
  const locationCard = page.locator('.onboarding-step-widget').last()
  await page.getByPlaceholder('123 Main Street').fill('88 Moo 2, Ao Nang Beach Road')
  await page.getByPlaceholder('City').fill('Ao Nang')
  await locationCard.getByText(/United States/).click()
  await page.getByPlaceholder('Search country...').fill('Thailand')
  await page.getByRole('option', { name: /Thailand/ }).click()
  await page.getByRole('button', { name: 'Save location' }).click()

  // Contact: the phone picker arrives seeded with that country, and the number
  // is accepted the way a Thai owner writes it, trunk zero included.
  const phone = page.getByPlaceholder('Phone number')
  await expect(phone).toBeEnabled()
  await phone.fill('0812345678')
  await expect(phone).toHaveValue('081 234 5678')
  await page.getByRole('button', { name: 'Save contact' }).click()

  // Currency: USD is the product default, shown selected for the owner to confirm.
  const currencyCard = page.locator('.onboarding-step-widget').last()
  await expect(currencyCard).toContainText('US Dollar (USD)')
  await page.getByRole('button', { name: 'Use this currency' }).click()

  // Hours: the timezone follows the single-zone country the owner named.
  await expect(page.locator('.onboarding-step-widget').last()).toContainText('Asia/Bangkok')
  await page.getByRole('button', { name: 'Continue without hours' }).click()
  await page.getByRole('button', { name: 'Save brand' }).click()
  await page.getByRole('button', { name: 'Save hero' }).click()

  await page.getByRole('button', { name: 'Create site', exact: true }).click()
  await expect(page.getByText('Done. Your workspace is live at')).toBeVisible({ timeout: 90_000 })

  // The commit created a new organization named after the business and made it
  // the session's active one, so post-login lands there.
  const session = await (await page.request.get('/api/auth/get-session')).json() as { session: { activeOrganizationId: string | null } }
  const organizationId = session.session.activeOrganizationId
  expect(typeof organizationId).toBe('string')
  const organizations = await (await page.request.get('/api/auth/organization/list')).json() as Array<{ id: string; name: string; slug: string }>
  const created = organizations.find(organization => organization.id === organizationId)
  expect(created?.name).toBe(name)
  const postLogin = await page.request.get('/api/post-login', { maxRedirects: 0 })
  expect(postLogin.status()).toBe(302)
  expect(postLogin.headers().location).toBe(`/dashboard/${created!.slug}`)

  // The pane now frames the live site itself, at the subdomain the wizard announced
  // (the site subdomain and the organization slug are derived separately).
  const liveAt = await page.getByText(/^Done\. Your workspace is live at /).locator('strong').textContent()
  const subdomain = liveAt!.split('.')[0]
  await expect(previewFrame).toHaveAttribute('src', new RegExp(`^https?://${subdomain}\\.`))
  await page.getByRole('button', { name: 'Open my dashboard' }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/${created!.slug}/sites/${subdomain}$`))
  expect(errors).toEqual([])
})
