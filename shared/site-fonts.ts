export const SITE_FONT_PRESETS = ['default', 'mali'] as const
export type SiteFontPreset = typeof SITE_FONT_PRESETS[number]

export const SITE_FONT_OPTIONS: Array<{ label: string; value: SiteFontPreset }> = [
  { label: 'Default', value: 'default' },
  { label: 'Mali (Thai and English)', value: 'mali' },
]

export function isSiteFontPreset(value: unknown): value is SiteFontPreset {
  return value === 'default' || value === 'mali'
}

// An absent optional setting means the template's existing typography. Invalid
// stored values are errors, never arbitrary CSS or a substitute font choice.
export function resolveSiteFontPreset(value: unknown): SiteFontPreset {
  if (value === undefined) return 'default'
  if (!isSiteFontPreset(value)) throw new Error('Unsupported site font preset')
  return value
}

export const MALI_ASSET_BASE = '/assets/fonts/mali-aead5de0'
// One webfont, then the generic category. A chain of named system faces is a
// fallback chain: each named face has different metrics, so which one paints
// during the swap period changes how far the text reflows when Mali arrives.
export const MALI_FONT_FAMILY = '"Mali", sans-serif'

// Same manifest drives build-time asset copying and the SSR font declarations.
// No locale gating: an English page can contain Thai names and vice versa.
const MALI_SUBSETS = {
  thai: 'U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
} as const
const MALI_FACES = [
  { weight: 400, style: 'normal' },
  { weight: 500, style: 'normal' },
  { weight: 600, style: 'normal' },
  { weight: 700, style: 'normal' },
  { weight: 400, style: 'italic' },
] as const

export const MALI_FONT_FILES = MALI_FACES.flatMap(face => Object.entries(MALI_SUBSETS).map(([subset, unicodeRange]) => ({
  ...face,
  unicodeRange,
  filename: `mali-${subset}-${face.weight}-${face.style}.woff2`,
})))

// Injected only on a Mali-selected Saya surface. Not a global stylesheet or a
// second render-blocking CSS request; the browser selects used faces/subsets.
export const MALI_FONT_CSS = MALI_FONT_FILES.map(face => `@font-face{font-family:"Mali";font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url("${MALI_ASSET_BASE}/${face.filename}") format("woff2");unicode-range:${face.unicodeRange};}`).join('\n')
  + '\n.saya-theme[data-font-preset="mali"] :is(.saya-display,.saya-display-lg,.saya-display-md,.saya-display-sm,[data-saya-critical-title]){letter-spacing:normal;line-height:1.3;}'

export function siteFontStyles(preset: SiteFontPreset): Record<string, string> {
  if (preset === 'default') return {}
  if (preset !== 'mali') throw new Error('Unsupported site font preset')
  return {
    '--font-saya': MALI_FONT_FAMILY,
    '--font-sans': MALI_FONT_FAMILY,
    'font-family': MALI_FONT_FAMILY,
  }
}
