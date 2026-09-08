import satori, { init as initSatori } from 'satori/standalone'
import { Resvg, type InitInput } from '@resvg/resvg-wasm'
import type { ReactNode } from 'react'
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, type SocialCardRenderPayload } from '~/utils/social-metadata'
import { getOgImageFonts } from './fonts.ts'
import { resolveOgImageRenderer } from './renderers/index.ts'
import { fetchTransformedImageAsDataUri } from './fetch-image.ts'
import { ensureResvgInitialized, loadLocalWasmModule } from '~/server/utils/resvg-runtime'
import platformLogoBase64 from '~/server/assets/platform-logo'

// A same-zone self-fetch (this Worker requesting its own krabiclaw.com/krabi-claw-logo.png)
// was found to silently fail in production while third-party image URLs fetch fine — see
// server/assets/platform-logo.ts. Resolve the platform's own logo from the bundled asset
// instead of going through the Images binding whenever the URL points at that file, so the
// brand mark on platform-template cards never depends on that self-fetch succeeding.
function resolveLogoDataUri(
  images: ImagesBinding,
  logoUrl: string | null | undefined,
  platformDomain?: string,
): Promise<string | null> {
  if (logoUrl) {
    try {
      const url = new URL(logoUrl)
      if (platformDomain) {
        const platformOrigin = platformDomain.startsWith('http') ? platformDomain : `https://${platformDomain}`
        if (url.pathname === '/krabi-claw-logo.png' && url.origin === new URL(platformOrigin).origin) {
          return Promise.resolve(`data:image/png;base64,${platformLogoBase64}`)
        }
      }
    } catch {
      // The fetch helper rejects invalid and non-public URLs.
    }
  }
  return fetchTransformedImageAsDataUri(images, logoUrl, { width: 160, height: 160, fit: 'contain' }, { format: 'image/png' }, { timeoutMs: 4000 })
}

// initWasm() may only run once per isolate. Cached at module scope so repeated renders in
// the same Worker isolate (or the same test process) reuse the initialized module.
let satoriInit: Promise<void> | null = null

async function loadBundledYogaWasm(): Promise<WebAssembly.Module> {
  if (import.meta.dev) return await loadLocalWasmModule('satori/yoga.wasm')
  const { default: wasmModule } = await import('satori/yoga.wasm')
  return wasmModule
}

async function ensureSatoriInitialized(wasmModule?: InitInput): Promise<void> {
  if (!satoriInit) {
    satoriInit = Promise.resolve(wasmModule ?? loadBundledYogaWasm())
      .then(module => initSatori(module))
      .catch((error) => {
        satoriInit = null
        throw error
      })
  }
  await satoriInit
}

export interface RenderOgImageDeps {
  images: ImagesBinding
  /**
   * Tests and local scripts can provide raw bytes. Deployed Workers omit this so Wrangler
   * supplies the statically imported file as a precompiled WebAssembly.Module.
   */
  wasmModule?: InitInput
  yogaModule?: InitInput
  platformDomain?: string
}

/** Renders one OG image payload to real, decodable 1200×630 PNG bytes. */
export async function renderOgImagePng(
  payload: SocialCardRenderPayload,
  deps: RenderOgImageDeps,
): Promise<Uint8Array> {
  await Promise.all([
    ensureResvgInitialized(deps.wasmModule),
    ensureSatoriInitialized(deps.yogaModule),
  ])

  const [backgroundImageDataUri, logoDataUri] = await Promise.all([
    fetchTransformedImageAsDataUri(deps.images, payload.backgroundImageUrl, {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fit: 'cover',
    }, {
      format: 'image/jpeg',
      quality: 85,
    }, {
      timeoutMs: 4000,
      acceptedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
    }),
    resolveLogoDataUri(deps.images, payload.logoUrl, deps.platformDomain),
  ])
  if (!backgroundImageDataUri) {
    throw new Error(`OG page media could not be loaded: ${payload.backgroundImageUrl}`)
  }
  if (payload.logoUrl && !logoDataUri) throw new Error(`OG logo could not be loaded: ${payload.logoUrl}`)
  const renderer = resolveOgImageRenderer(payload.template)
  const tree = renderer({ ...payload, backgroundImageDataUri, logoDataUri })

  const svg = await satori(tree as unknown as ReactNode, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: getOgImageFonts(),
  })

  // Resvg/RenderedImage hold WASM linear memory that isn't GC'd by JS — free()
  // both regardless of outcome so repeated renders in the same Worker isolate
  // (resvgInit is cached at module scope) don't leak memory across requests.
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_IMAGE_WIDTH } })
  try {
    const rendered = resvg.render()
    try {
      return rendered.asPng()
    } finally {
      rendered.free()
    }
  } finally {
    resvg.free()
  }
}
