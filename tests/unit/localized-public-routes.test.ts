import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateLocaleCatalog } from '../../shared/platform-locale-catalog.ts'
import { projectExactLocalizedResource } from '../../server/utils/public-localization.ts'
import { resolveTenantLocalePath } from '../../utils/tenant-locale-path.ts'
import { tenantBlogPostPath } from '../../utils/tenant-blog-route.ts'

test('catch-all locale classification uses the tenant published-locale set', () => {
  assert.deepEqual(resolveTenantLocalePath('/th/contact', ['th']), {
    localeSegment: 'th',
    sourcePath: '/contact',
    publicPath: '/th/contact',
  })
  for (const path of ['/faq', '/app', '/art']) {
    assert.deepEqual(resolveTenantLocalePath(path, ['th']), {
      localeSegment: null,
      sourcePath: path,
      publicPath: path,
    })
  }
})

test('localized projection clears untranslated localizable fields', () => {
  const projected = projectExactLocalizedResource(
    'experience',
    { id: 'experience-1', title: 'English title', tagline: 'English tagline', price: { amount_minor: 2500 } },
    {
      resourceType: 'experience',
      resourceId: 'experience-1',
      locale: 'th',
      routePath: '/th/experiences/lesson',
      values: { title: 'บทเรียน' },
    },
  )

  assert.equal(projected.title, 'บทเรียน')
  assert.equal(projected.tagline, undefined)
  assert.deepEqual(projected.price, { amount_minor: 2500 })
})

test('localized link-page SEO stays within its nullable public contract', () => {
  const projected = projectExactLocalizedResource(
    'site_link_page',
    {
      id: 'links-1',
      title: 'Helpful links',
      seo_title: 'Helpful links',
      seo_description: 'English description',
    },
    {
      resourceType: 'site_link_page',
      resourceId: 'links-1',
      locale: 'th',
      routePath: '/th/links',
      values: { title: 'ลิงก์ภาษาไทย' },
    },
  )

  assert.equal(projected.title, 'ลิงก์ภาษาไทย')
  assert.equal(projected.seo_title, 'ลิงก์ภาษาไทย')
  assert.equal(projected.seo_description, null)
})

test('professional-service blog paths use the Blawby article route', () => {
  assert.equal(tenantBlogPostPath({ vertical: 'professional_service' }, 'thai-law'), '/article/thai-law')
})

test('platform catalog validation rejects placeholder drift', () => {
  assert.deepEqual(
    validateLocaleCatalog({ greeting: 'Hello {name}' }, { greeting: 'สวัสดี' }, { complete: true }),
    {
      ok: false,
      issue: { kind: 'placeholder', key: 'greeting', expected: ['name'], actual: [] },
    },
  )
})
