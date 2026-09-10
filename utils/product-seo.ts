import type { Product } from '~/server/types/products'
import { formatProductPriceLabel } from '~/utils/product-money'
import { DESCRIPTION_MAX_LENGTH, truncateForSeo } from '~/utils/social-metadata'

/**
 * Product-page SEO derived entirely from data the MCP already writes (#SEO dish
 * pages). Nothing here asks an owner to author per-product content: name,
 * description, category, price and location are the only inputs, so every
 * current and future tenant gets the same treatment the moment its catalogue is
 * imported.
 */

/**
 * A catalogue row with no customer-facing price at all — neither a numeric
 * Price nor an explicit `price-note` detail — is a placeholder, not something
 * the business is offering. Those rows still render (owners see their own
 * catalogue as it is) but they canonicalise to the collection index instead of
 * competing with it as a standalone result.
 */
export function isOfferedProduct(product: Pick<Product, 'price' | 'details'>): boolean {
  return formatProductPriceLabel(product) !== null
}

export interface ProductCategorySibling {
  id: string
  name: string
  slug: string
}

/** Links per product page. Bounded so a 60-item category does not turn every
 *  page into a full menu dump. */
export const CATEGORY_SIBLING_LIMIT = 8

/**
 * Other offerings in the same category at the same location.
 *
 * The window rotates: it starts at the item after the current one and wraps, so
 * consecutive dishes in a large category link to overlapping-but-different
 * neighbours. That reaches every item in the category through internal links
 * instead of pointing all of them at the same first eight, and it makes the
 * rendered list differ between sibling pages.
 *
 * `products` is expected in catalogue order (category sort order, then product
 * sort order) — the order the collection page renders — so the list a visitor
 * sees here matches the menu they just came from.
 */
export function selectProductCategorySiblings(
  products: readonly Product[],
  product: Product,
  limit: number = CATEGORY_SIBLING_LIMIT,
): ProductCategorySibling[] {
  const inCategory = products.filter(candidate => candidate.location_id === product.location_id
    && candidate.category_id === product.category_id
    && isOfferedProduct(candidate))
  const index = inCategory.findIndex(candidate => candidate.id === product.id)
  const rotated = index === -1
    ? inCategory
    : [...inCategory.slice(index + 1), ...inCategory.slice(0, index)]
  return rotated.slice(0, limit).map(({ id, name, slug }) => ({ id, name, slug }))
}

/** Everything the composed description reads. All of it is product data. */
export type ProductSeoSubject = Pick<Product, 'name' | 'description' | 'seo_description' | 'category' | 'price' | 'details'>

export interface ProductSeoDescriptionInput {
  /** The product, already localized for the rendering locale. */
  product: ProductSeoSubject
  /** The location this product is sold at, already localized. */
  locationTitle: string
}

/** Translator shape supplied by the caller's `useI18n()`. */
export type ProductSeoTranslate = (key: string, named: Record<string, string>) => string

/** Shortest description fragment worth appending to the composed frame. */
const MIN_DETAIL_BUDGET = 8

/** A trailing sentence stop would double up against the template's own. */
function withoutTrailingStop(text: string): string {
  return text.trim().replace(/[.\s]+$/u, '')
}

/**
 * The product's own subject line. `seo_description` and `description` are the
 * same concept at different specificity — the description to show a search
 * engine, and the description to show a reader — so the more specific one wins
 * when it exists. A product with neither is described by its category, which it
 * always has. None of the three is another resource's data, so no page can
 * inherit the site blurb the way it did before.
 */
function productSubjectLine(product: ProductSeoSubject): string {
  if (product.seo_description?.trim()) return withoutTrailingStop(product.seo_description)
  if (product.description.trim()) return withoutTrailingStop(product.description)
  return withoutTrailingStop(product.category.name)
}

/**
 * The meta description for a product page, composed from the product's own
 * data. A product page never inherits the site blurb: doing so gave hundreds of
 * Kikuzuki dish pages one identical description.
 *
 * The template frame (name, price, location) is measured first and the
 * product's own subject line gets whatever budget is left, so the
 * distinguishing facts survive truncation instead of being cut off by a long
 * description.
 */
export function composeProductSeoDescription(
  input: ProductSeoDescriptionInput,
  translate: ProductSeoTranslate,
): string {
  // Formatted exactly as the page body formats it, so the tag and the rendered
  // price never disagree.
  const priceLabel = formatProductPriceLabel(input.product)
  const key = priceLabel
    ? 'saya.product_detail.meta_description_priced'
    : 'saya.product_detail.meta_description'
  const named = {
    name: input.product.name.trim(),
    location: input.locationTitle.trim(),
    ...(priceLabel ? { price: priceLabel.trim() } : {}),
  }
  const detailBudget = DESCRIPTION_MAX_LENGTH - translate(key, { ...named, detail: '' }).length
  // Under a word's worth of budget the frame alone already fills the tag; adding
  // an ellipsis-only fragment would just be noise.
  const detail = detailBudget < MIN_DETAIL_BUDGET
    ? ''
    : truncateForSeo(productSubjectLine(input.product), detailBudget) ?? ''
  const composed = truncateForSeo(translate(key, { ...named, detail }), DESCRIPTION_MAX_LENGTH)
  if (!composed) throw new Error('Product SEO description composed to an empty string')
  return composed
}
