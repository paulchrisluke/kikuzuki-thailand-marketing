import { expect, test, type APIResponse, type Browser } from '@playwright/test'
import { openTenantPage, potteryHouseBaseURL, potteryHouseExtraHeaders } from './helpers'
import { loginAs } from './helpers/auth'
import { kikuzukiTestBaseUrl, kikuzukiTestExtraHeaders, testBaseUrl } from './test-env'

type Metrics = { lcp: number; cls: number; fontBytes: number; fontRequests: number }

async function expectStatus(response: APIResponse, status: number) {
  expect(response.status(), await response.text()).toBe(status)
}

async function coldMobileSample(browser: Browser, url: string, preset: 'default' | 'mali'): Promise<Metrics> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  })
  try {
    const page = await context.newPage()
    const origin = new URL(url).origin
    const headers = kikuzukiTestExtraHeaders()
    if (Object.keys(headers).length) {
      await page.route(`${origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } }))
    }
    const session = await context.newCDPSession(page)
    await session.send('Network.enable')
    await session.send('Network.setCacheDisabled', { cacheDisabled: true })
    await session.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750,
    })
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0 }
      ;(window as Window & { fontMetrics?: typeof metrics }).fontMetrics = metrics
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) metrics.lcp = entry.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      let sessionValue = 0
      let sessionStart = 0
      let lastShift = 0
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
          if (shift.hadRecentInput) continue
          if (shift.startTime - lastShift < 1000 && shift.startTime - sessionStart < 5000) sessionValue += shift.value
          else { sessionValue = shift.value; sessionStart = shift.startTime }
          lastShift = shift.startTime
          metrics.cls = Math.max(metrics.cls, sessionValue)
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    const response = await page.goto(url, { waitUntil: 'load' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('.tenant-layout')).toHaveAttribute('data-font-preset', preset)
    await expect(page.locator('.tenant-layout')).toHaveCSS('font-family', preset === 'mali' ? /Mali/ : /Poppins/)
    await expect(page.locator('.tenant-layout')).toHaveAttribute('data-hydrated', 'true')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    // Observe post-font layout without clicking consent, scrolling, or ending LCP.
    await page.waitForTimeout(1500)
    const metrics = await page.evaluate(() => {
      const value = (window as Window & { fontMetrics?: { lcp: number; cls: number } }).fontMetrics
      if (!value) throw new Error('Font performance observers were not installed')
      const fonts = performance.getEntriesByType('resource')
        .filter(entry => /\.woff2(?:\?|$)/.test(entry.name)) as PerformanceResourceTiming[]
      return { ...value, fontBytes: fonts.reduce((total, font) => total + font.transferSize, 0), fontRequests: fonts.length }
    })
    expect(metrics.lcp).toBeGreaterThan(0)
    return metrics
  } finally {
    await context.close()
  }
}

function median(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!
}

test('Mali saves through Brand, renders before hydration, and stays within the cold-mobile regression budget', async ({ browser, playwright }, testInfo) => {
  test.setTimeout(600_000)
  const siteId = 'site-kikuzuki'
  const baseURL = testBaseUrl()
  const owner = await playwright.request.newContext({ baseURL })
  await loginAs(owner, baseURL, 'user-e2e-kikuzuki-owner')
  const settingsUrl = `/api/sites/${siteId}/settings`
  const initial = await owner.get(settingsUrl)
  await expectStatus(initial, 200)
  const original = (await initial.json() as { settings: { font_preset: 'default' | 'mali'; brand_color: string } }).settings
  const localePath = `/api/editor/sites/${siteId}/locales`
  const localesBefore = await owner.get(localePath)
  await expectStatus(localesBefore, 200)
  const hadThai = (await localesBefore.json() as { languages: Array<{ locale: string; status: string }> })
    .languages.some(language => language.locale === 'th' && language.status === 'published')
    const performanceRoutes = {
      home: `${kikuzukiTestBaseUrl()}/`,
      menu: `${kikuzukiTestBaseUrl()}/menu`,
      reservations: `${kikuzukiTestBaseUrl()}/th/reservations`,
    } as const
    const measurements: Record<keyof typeof performanceRoutes, Record<'default' | 'mali', Metrics[]>> = {
      home: { default: [], mali: [] },
      menu: { default: [], mali: [] },
      reservations: { default: [], mali: [] },
    }
  const patch = async (data: Record<string, unknown>) => expectStatus(await owner.patch(settingsUrl, { data }), 200)
  const dashboard = await browser.newContext({ baseURL, storageState: await owner.storageState(), viewport: { width: 1280, height: 900 } })
  try {
    await patch({ font_preset: 'default', brand_color: '' })
    const cms = await dashboard.newPage()
    const brandPath = `${baseURL}/dashboard/org-bVY8SxxUuG6Ctk2CQnfCk8T2cPsj4jJX/sites/kikuzuki-krabi-thailand/brand/font`
    // The dashboard is not a tenant surface and carries no Zaraz consent gate.
    await cms.goto(brandPath, { waitUntil: 'load' })
    await cms.getByRole('combobox').click()
    await cms.getByRole('option', { name: 'Mali (Thai and English)', exact: true }).click()
    await expect(cms.getByTestId('site-font-preview')).toHaveCSS('font-family', /Mali/)
    const saved = await Promise.all([
      cms.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === '/api/dashboard/settings'),
      cms.getByRole('button', { name: 'Save', exact: true }).click(),
    ]).then(([response]) => response)
    expect(saved.status(), await saved.text()).toBe(200)
    await expect(cms.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    const persisted = await owner.get(settingsUrl)
    await expectStatus(persisted, 200)
    expect(await persisted.json()).toMatchObject({ settings: { font_preset: 'mali', brand_color: '' } })
    await expectStatus(await owner.patch(settingsUrl, { data: { font_preset: 'https://example.com/font.css' } }), 400)
    await expectStatus(await owner.post(`${localePath}/th/enable`), 200)

    for (const path of ['/', '/menu', '/th/reservations', '/contact']) {
      const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
      try {
        const page = await guest.newPage()
        const errors: string[] = []
        const fontUrls: string[] = []
        page.on('console', message => { if (/hydration.*mismatch|mismatch.*hydration/i.test(message.text())) errors.push(message.text()) })
        page.on('pageerror', error => errors.push(error.message))
        page.on('request', request => {
          const url = new URL(request.url())
          if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) errors.push(`External font request: ${url}`)
          if (url.pathname.includes('/assets/fonts/mali-')) fontUrls.push(request.url())
        })
        const response = await openTenantPage(page, `${kikuzukiTestBaseUrl()}${path}`, kikuzukiTestExtraHeaders())
        expect(response?.status(), path).toBe(200)
        const html = await response!.text()
        expect(html).toContain('data-font-preset="mali"')
        expect(html).toContain('--font-saya:')
        expect(html).toContain('@font-face{font-family:"Mali"')
        await expect(page.locator('.tenant-layout')).toHaveAttribute('data-hydrated', 'true')
        await expect(page.locator('.tenant-layout')).toHaveCSS('font-family', /Mali/)
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        expect(fontUrls.some(url => url.includes('-latin-'))).toBe(true)
        if (path.startsWith('/th/')) expect(fontUrls.some(url => url.includes('-thai-'))).toBe(true)
        expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family.replaceAll('"', '') === 'Mali' && font.status === 'loaded'))).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        for (const url of new Set(fontUrls)) {
          expect(new URL(url).origin).toBe(new URL(kikuzukiTestBaseUrl()).origin)
          const font = await guest.request.get(url, { headers: kikuzukiTestExtraHeaders() })
          await expectStatus(font, 200)
          expect(font.headers()['cache-control']).toMatch(/max-age=31536000/)
          expect(Array.from((await font.body()).subarray(0, 4))).toEqual([0x77, 0x4f, 0x46, 0x32])
        }
        expect(errors).toEqual([])
      } finally { await guest.close() }
    }

    const other = await browser.newContext()
    try {
      const page = await other.newPage()
      const fonts: string[] = []
      page.on('request', request => { if (request.url().includes('/assets/fonts/mali-')) fonts.push(request.url()) })
      const response = await openTenantPage(page, `${potteryHouseBaseURL}/`, potteryHouseExtraHeaders)
      expect(response?.status()).toBe(200)
      expect(await response!.text()).not.toContain('@font-face{font-family:"Mali"')
      await expect(page.locator('.tenant-layout')).toHaveAttribute('data-font-preset', 'default')
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      expect(fonts).toEqual([])
    } finally { await other.close() }

    // Alternate presets to reduce ordering bias. Every sample has a new browser
    // context, disabled browser cache, 4x CPU slowdown and 1.6 Mbps / 150 ms RTT.
    for (let run = 0; run < 3; run++) {
      for (const preset of (run % 2 ? ['mali', 'default'] : ['default', 'mali']) as Array<'default' | 'mali'>) {
        await patch({ font_preset: preset })
        for (const [route, url] of Object.entries(performanceRoutes) as Array<[keyof typeof performanceRoutes, string]>) {
          measurements[route][preset].push(await coldMobileSample(browser, url, preset))
        }
      }
    }
    const report = {
      samples: measurements,
      routes: Object.fromEntries(Object.entries(measurements).map(([route, samples]) => [route, {
        medianDefaultLcp: median(samples.default.map(value => value.lcp)),
        medianMaliLcp: median(samples.mali.map(value => value.lcp)),
        medianDefaultCls: median(samples.default.map(value => value.cls)),
        medianMaliCls: median(samples.mali.map(value => value.cls)),
      }])),
    }
    console.info('[font-performance]', JSON.stringify(report))
    await testInfo.attach('cold-mobile-fonts.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
    for (const route of Object.values(report.routes)) {
      expect(route.medianMaliLcp - route.medianDefaultLcp).toBeLessThanOrEqual(Math.max(250, route.medianDefaultLcp * 0.1))
      expect(route.medianMaliCls).toBeLessThanOrEqual(0.1)
      expect(route.medianMaliCls - route.medianDefaultCls).toBeLessThanOrEqual(0.02)
    }

    await patch({ font_preset: 'default' })
    const reset = await playwright.request.newContext({ extraHTTPHeaders: kikuzukiTestExtraHeaders() })
    try {
      const response = await reset.get(`${kikuzukiTestBaseUrl()}/contact`)
      await expectStatus(response, 200)
      expect(await response.text()).toContain('data-font-preset="default"')
      expect(await response.text()).not.toContain('@font-face{font-family:"Mali"')
    } finally { await reset.dispose() }
  } finally {
    await patch({ font_preset: original.font_preset, brand_color: original.brand_color })
    await expectStatus(await owner.post(`${localePath}/th/${hadThai ? 'enable' : 'disable'}`), 200)
    await dashboard.close()
    await owner.dispose()
  }
})
