export const CONTENT_DOCUMENT_KINDS = [
  'page',
  'article',
  'platform_doc',
  'social_post',
  'qa',
  'locale_catalog',
] as const

export type ContentDocumentKind = typeof CONTENT_DOCUMENT_KINDS[number]

export const PUBLICATION_CONTENT_BLOCK_TYPES = [
  'heading',
  'markdown',
  'image',
  'gallery',
  'faq',
  'how_to',
  'divider',
  'ai_assistance',
  'cta',
  'callout',
] as const

export type PublicationContentBlockType = typeof PUBLICATION_CONTENT_BLOCK_TYPES[number]

export type LocalizedContentFieldSegment = string | '*'

// This is the publication block contract for tenant-authored text. Structural
// fields, URLs, flags, and media references are intentionally absent.
export const PUBLICATION_CONTENT_BLOCK_LOCALIZED_FIELDS = {
  heading: [['text']],
  markdown: [['markdown']],
  image: [['alt'], ['caption']],
  gallery: [],
  faq: [['label'], ['items', '*', 'question'], ['items', '*', 'answer']],
  how_to: [
    ['label'], ['estimated_time'], ['tool_items', '*'], ['supply_items', '*'],
    ['steps', '*', 'name'], ['steps', '*', 'text'],
  ],
  divider: [],
  ai_assistance: [
    ['label'], ['intro'], ['prompts', '*', 'title'], ['prompts', '*', 'prompt'],
    ['prompts', '*', 'description'], ['prompts', '*', 'copy_label'],
  ],
  cta: [['title'], ['description'], ['label']],
  callout: [['title'], ['markdown'], ['text']],
} as const satisfies Record<PublicationContentBlockType, readonly (readonly LocalizedContentFieldSegment[])[]>

export const CONTENT_BLOCK_TYPES = [
  ...PUBLICATION_CONTENT_BLOCK_TYPES,
  'hero',
  'button_group',
  'feature_grid',
  'testimonial_grid',
  'contact_cta',
  'booking_cta',
  'donation_choices',
  'offering_grid',
  'location_grid',
] as const

export type ContentBlockType = typeof CONTENT_BLOCK_TYPES[number]

export const LOCALIZED_RESOURCE_TYPES = [
  'site', 'business_location', 'product', 'product_category', 'offering', 'media_asset',
] as const

export type LocalizedResourceType = typeof LOCALIZED_RESOURCE_TYPES[number]
