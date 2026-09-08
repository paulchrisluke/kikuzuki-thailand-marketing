import type { HTTPEvent } from 'nitro/h3'
import { definePlugin } from 'nitro'
import { isNonIndexableHost, isPrivateSeoPath, isTechnicalAssetSeoPath } from '~/server/utils/seo-policy'
import { hostnameOf, isPreviewContext } from '~/server/utils/tenant-hosts'

const PRODUCTION_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300, max-age=0'
const NON_PRODUCTION_CACHE_CONTROL = 'private, no-store, max-age=0'

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('response', (response, event: HTTPEvent) => {
    if (response.status === 101) return
    const request = event.req
    const url = new URL(request.url)
    const pathname = url.pathname
    const privatePath = isPrivateSeoPath(pathname) || url.searchParams.has('token')
    if (isNonIndexableHost(url.hostname) || privatePath || isTechnicalAssetSeoPath(pathname)) {
      response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
    }
    if (privatePath) response.headers.set('cache-control', NON_PRODUCTION_CACHE_CONTROL)
    if (url.searchParams.has('token')) response.headers.set('referrer-policy', 'no-referrer')

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return
    if (privatePath) return

    const hostname = hostnameOf(request.headers.get('host') || '')
    const nonProduction = isPreviewContext(hostname) || isNonIndexableHost(hostname)
    const hasSession = (request.headers.get('cookie') ?? '').includes('better-auth.session_token')

    response.headers.set('cache-control', nonProduction || hasSession ? NON_PRODUCTION_CACHE_CONTROL : PRODUCTION_CACHE_CONTROL)
    if (nonProduction) {
      response.headers.set('pragma', 'no-cache')
      response.headers.set('expires', '0')
    }
  })
})
