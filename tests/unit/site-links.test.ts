import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDashboardSitePageDestination } from '../../composables/useDashboardSiteLinks.ts'
import { SiteLinksValidationError, validateLinkDestination } from '../../server/utils/site-links.ts'

test('site link destinations validate URLs and require concrete dashboard location scope', () => {
  assert.equal(validateLinkDestination('/reservations'), '/reservations')
  assert.equal(validateLinkDestination('/contact?from=links'), '/contact?from=links')
  assert.equal(validateLinkDestination('https://example.com/path'), 'https://example.com/path')
  assert.equal(validateLinkDestination('http://example.com'), 'http://example.com/')
  assert.equal(validateLinkDestination('mailto:hello@example.com'), 'mailto:hello@example.com')
  assert.equal(validateLinkDestination('tel:+15551234567'), 'tel:+15551234567')
  for (const destination of ['', 'not a url', '//evil.example/path', '\\contact', 'javascript:alert(1)', 'data:text/html,test']) {
    assert.throws(() => validateLinkDestination(destination), SiteLinksValidationError)
  }

  const sitePath = '/dashboard/acme/sites/cafe'
  const locationsPath = `${sitePath}/locations`

  // A page edited per location opens the list so the tenant chooses. It must not
  // resolve one for them: this used to pick a "primary" location, or the first
  // row when none was flagged, and a multi-location tenant never saw the choice.
  for (const path of ['/menu', '/products', '/reservations', '/experiences']) {
    assert.equal(resolveDashboardSitePageDestination(path, sitePath, locationsPath), locationsPath)
  }

  assert.equal(resolveDashboardSitePageDestination('/blog', sitePath, locationsPath), `${sitePath}/blog`)
  assert.equal(resolveDashboardSitePageDestination('/order', sitePath, locationsPath), `${sitePath}/orders`)
  for (const path of ['/services', '/pricing', '/donate', '/schedule']) {
    assert.equal(resolveDashboardSitePageDestination(path, sitePath, locationsPath), `${sitePath}/professional-services`)
  }
})
