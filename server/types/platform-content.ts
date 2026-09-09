import type { ContentBlockInput } from '~/server/utils/content/documents'
import type { PlatformBlogCreateInput } from '~/server/utils/content/publishing'

export interface PlatformContentNavRequestBody {
  nav_section?: string | null
  nav_title?: string | null
  nav_order?: number | null
  nav_section_order?: number | null
  hide_from_nav?: boolean | number | null
  featured_order?: number | null
}

export interface PlatformBlogPostRequestBody extends PlatformContentNavRequestBody {
  status?: PlatformBlogCreateInput['status']
  title?: string
  slug?: string | null
  content_blocks?: ContentBlockInput[]
  expected_updated_at?: string
  excerpt?: string
  category?: string
  tags?: string[] | null
  seo_title?: string | null
  seo_description?: string
  seo_keywords?: string
  canonical_url?: string
  robots?: string
  visibility?: 'public' | 'unlisted'
  scheduled_for?: string | null
}

export interface PlatformDocRequestBody extends PlatformContentNavRequestBody {
  title?: string
  content_blocks?: ContentBlockInput[]
  expected_updated_at?: string
  excerpt?: string
  category?: string
  seo_description?: string
  seo_keywords?: string
  canonical_url?: string
  robots?: string
  difficulty_level?: string
  sort_order?: number
}
