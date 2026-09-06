import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import thaiPlatformMessages from '../../i18n/catalogs/th.json' with { type: 'json' }
import { openTenantPage } from './helpers'
import { loginAs } from './helpers/auth'
import { kikuzukiTestBaseUrl, kikuzukiTestExtraHeaders, testBaseUrl } from './test-env'

const siteId = 'site-kikuzuki'
const locale = 'th'

async function expectStatus(response: APIResponse, expected: number) {
  const body = response.status() === expected ? '' : await response.text()
  expect(response.status(), body).toBe(expected)
}

async function putLocalization(
  request: APIRequestContext,
  resourceType: string,
  resourceId: string,
  body: Record<string, unknown>,
) {
  await expectStatus(await request.put(
    `/api/editor/sites/${siteId}/localization/${resourceType}/${resourceId}/${locale}`,
    { data: body },
  ), 200)
}

async function expectLocalizedMenu(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt')
    return root && '__vue_app__' in root && Boolean(root.__vue_app__)
  })
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.getByRole('navigation', { name: 'การนำทางหลัก' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'การนำทางหลัก' }).getByRole('link', { name: 'เมนู', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'จองโต๊ะ' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kikuzuki กระบี่ ประเทศไทย' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ซูชิ' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'ซูชิทูน่า' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /🇹🇭 th/ })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Tuna Sushi')
}

test.beforeAll(async ({ playwright }, testInfo) => {
  testInfo.setTimeout(120_000)
  const baseURL = testBaseUrl()
  const admin = await playwright.request.newContext({ baseURL })
  const owner = await playwright.request.newContext({ baseURL })
  await loginAs(admin, baseURL, 'user-e2e-platform-admin')
  await loginAs(owner, baseURL, 'user-e2e-kikuzuki-owner')

  try {
    const catalogsResponse = await admin.get('/api/admin/localization')
    await expectStatus(catalogsResponse, 200)
    const catalogs = await catalogsResponse.json() as { catalogs: Array<{ locale: string }> }
    if (!catalogs.catalogs.some(catalog => catalog.locale === locale)) {
      await expectStatus(await admin.post('/api/admin/localization', {
        data: { locale, label: 'ไทย', direction: 'ltr' },
      }), 200)
    }
    await expectStatus(await admin.post(`/api/admin/localization/${locale}/publish`, {
      data: { messages: thaiPlatformMessages },
    }), 200)
    await expectStatus(await owner.post(`/api/editor/sites/${siteId}/locales/${locale}/enable`, {
      data: { label: 'ไทย' },
    }), 200)

    await putLocalization(owner, 'site', siteId, {
      values: {
        brand_name: 'Kikuzuki กระบี่ ประเทศไทย',
        brand_description: 'อาหารญี่ปุ่นต้นตำรับในกระบี่',
      },
    })
    const locationResponse = await owner.get('/api/sites/site-kikuzuki/locations/loc-kikuzuki')
    await expectStatus(locationResponse, 200)
    expect(await locationResponse.json()).toMatchObject({
      location: {
        opening_hours: {
          periods: expect.arrayContaining([1, 2].map(day => ({
            open: { day, hour: 14, minute: 0 }, close: { day, hour: 23, minute: 0 },
          }))),
        },
      },
    })
    await putLocalization(owner, 'business_location', 'loc-kikuzuki', {
      route_path: '/th/locations/kikuzuki-japanese-robatayaki-izakaya',
      values: {
        title: 'Kikuzuki โรบาตายากิและอิซากายะญี่ปุ่น',
        address: '325 ตำบลอ่าวนาง กระบี่ 81180 ประเทศไทย',
        city: 'ตำบลอ่าวนาง',
        description: 'ร้านอาหารญี่ปุ่นใจกลางกระบี่',
        short_description: 'โรบาตายากิและซูชิในอ่าวนาง',
      },
    })
    await putLocalization(owner, 'product_category', 'category-loc-kikuzuki-sushi', {
      values: { name: 'ซูชิ' },
    })
    await putLocalization(owner, 'product', 'item-kiku-tuna-sushi', {
      route_path: '/th/locations/kikuzuki-japanese-robatayaki-izakaya/menu/tuna-sushi',
      values: {
        name: 'ซูชิทูน่า',
        description: 'ทูน่า',
        tags_json: [],
        details_json: [],
      },
    })
  } finally {
    await admin.dispose()
    await owner.dispose()
  }
})

test('Kikuzuki keeps its Thai shell and category translations on a hard load', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000)
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const response = await openTenantPage(page, `${kikuzukiTestBaseUrl()}/th/menu`, kikuzukiTestExtraHeaders())
  expect(response?.status()).toBeLessThan(400)
  await expectLocalizedMenu(page)
  await page.reload()
  await expectLocalizedMenu(page)

  await page.getByRole('button', { name: /🇹🇭 th/ }).click()
  await page.getByRole('menuitem', { name: /🇺🇸/ }).click()
  await expect(page).toHaveURL(`${kikuzukiTestBaseUrl()}/menu`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tuna Sushi' }).first()).toBeVisible()

  await page.getByRole('button', { name: /🇺🇸 en/ }).click()
  await page.getByRole('menuitem', { name: /🇹🇭/ }).click()
  await expect(page).toHaveURL(`${kikuzukiTestBaseUrl()}/th/menu`)
  await expectLocalizedMenu(page)

  const contactResponse = await openTenantPage(page, `${kikuzukiTestBaseUrl()}/th/contact`, kikuzukiTestExtraHeaders())
  expect(contactResponse?.status()).toBeLessThan(400)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.getByText('ติดต่อเรา', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /🇹🇭 th/ })).toBeVisible()
  expect(errors.filter(message => message.includes('Localized route representation was not found'))).toEqual([])

  const locationPageResponse = await openTenantPage(
    page,
    `${kikuzukiTestBaseUrl()}/th/locations/kikuzuki-japanese-robatayaki-izakaya`,
    kikuzukiTestExtraHeaders(),
  )
  expect(locationPageResponse?.status()).toBeLessThan(400)
  for (const day of ['วันจันทร์', 'วันอังคาร']) {
    const hoursRow = page.getByText(day, { exact: true }).locator('..')
    await expect(hoursRow).toContainText('14:00')
    await expect(hoursRow).toContainText('23:00')
  }

  for (const path of ['/th/reservations', '/th/experiences']) {
    const builtInResponse = await openTenantPage(page, `${kikuzukiTestBaseUrl()}${path}`, kikuzukiTestExtraHeaders())
    expect(builtInResponse?.status()).toBeLessThan(400)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.getByRole('navigation', { name: 'การนำทางหลัก' }).getByRole('link', { name: 'เมนู', exact: true })).toBeVisible()
  }
})
