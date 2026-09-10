import { expect, test, type APIResponse } from '@playwright/test'
import { openTenantPage } from './helpers'
import { loginAs } from './helpers/auth'
import { kikuzukiTestBaseUrl, kikuzukiTestExtraHeaders, testBaseUrl } from './test-env'

async function expectStatus(response: APIResponse, status: number) {
  expect(response.status(), await response.text()).toBe(status)
}

test('Japanese is a second secondary language and keeps its public shell through hydration', async ({ playwright, page }) => {
  test.setTimeout(180_000)
  const siteId = 'site-kikuzuki'
  const baseURL = testBaseUrl()
  const owner = await playwright.request.newContext({ baseURL })
  await loginAs(owner, baseURL, 'user-e2e-kikuzuki-owner')
  const localePath = `/api/editor/sites/${siteId}/locales`
  const before = await owner.get(localePath)
  await expectStatus(before, 200)
  const original = await before.json() as { languages: Array<{ locale: string; status: string }> }
  const hadJapanese = original.languages.some(language => language.locale === 'ja' && language.status === 'published')
  const hydrationErrors: string[] = []
  page.on('console', message => {
    if (/hydration.*mismatch|mismatch.*hydration/i.test(message.text())) hydrationErrors.push(message.text())
  })
  page.on('pageerror', error => hydrationErrors.push(error.message))

  try {
    await expectStatus(await owner.post(`${localePath}/th/enable`), 200)
    await expectStatus(await owner.post(`${localePath}/ja/enable`), 200)
    // Re-enabling an already published language does not consume another slot.
    await expectStatus(await owner.post(`${localePath}/ja/enable`), 200)
    const enabled = await owner.get(localePath)
    await expectStatus(enabled, 200)
    const settings = await enabled.json() as { languages: Array<{ locale: string; status: string }> }
    expect(settings.languages.filter(language => language.status === 'published').map(language => language.locale).sort()).toEqual(['en', 'ja', 'th'])

    await expectStatus(await owner.put(`/api/editor/sites/${siteId}/localization/site/${siteId}/ja`, {
      data: { values: { brand_name: '菊月 クラビ', brand_description: 'クラビの日本料理店' } },
    }), 200)
    await expectStatus(await owner.put(`/api/editor/sites/${siteId}/localization/business_location/loc-kikuzuki/ja`, {
      data: {
        route_path: '/ja/locations/kikuzuki-japanese-robatayaki-izakaya',
        values: {
          title: '菊月 炉端焼き・居酒屋', address: '325 アオナン、クラビ 81180 タイ',
          city: 'アオナン', description: 'クラビの日本料理店', short_description: '炉端焼きと寿司',
        },
      },
    }), 200)

    for (const path of ['/ja/reservations', '/ja/contact', '/ja/experiences']) {
      const response = await openTenantPage(page, `${kikuzukiTestBaseUrl()}${path}`, kikuzukiTestExtraHeaders())
      expect(response?.status(), path).toBe(200)
      const html = await response!.text()
      expect(html).toMatch(/<html[^>]*lang="ja"/)
      expect(html).toContain('席を予約する')
      expect(html).not.toContain('Reserve a table')
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
      await expect(page.locator('.tenant-layout')).toHaveAttribute('data-hydrated', 'true')
      await expect(page.getByRole('navigation', { name: 'メインナビゲーション' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: '席を予約する' }).first()).toBeVisible()
      if (path === '/ja/contact') {
        await expect(page.getByText('各店舗の営業時間・住所・電話番号。', { exact: true })).toBeVisible()
      }
    }
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page.getByRole('link', { name: '席を予約する' }).first()).toBeVisible()
    expect(hydrationErrors).toEqual([])

    await expectStatus(await owner.post(`${localePath}/ja/disable`), 200)
    const remaining = await owner.get(localePath)
    await expectStatus(remaining, 200)
    const after = await remaining.json() as { languages: Array<{ locale: string; status: string }> }
    expect(after.languages.filter(language => language.status === 'published').map(language => language.locale).sort()).toEqual(['en', 'th'])
    await openTenantPage(page, `${kikuzukiTestBaseUrl()}/reservations`, kikuzukiTestExtraHeaders())
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('link', { name: 'Reserve a table' }).first()).toBeVisible()
  } finally {
    await expectStatus(await owner.post(`${localePath}/ja/${hadJapanese ? 'enable' : 'disable'}`), 200)
    await owner.dispose()
  }
})
