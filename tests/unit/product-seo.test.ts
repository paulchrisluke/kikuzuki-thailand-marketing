import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Product } from '../../server/types/products.ts'
import {
  CATEGORY_SIBLING_LIMIT,
  composeProductSeoDescription,
  isOfferedProduct,
  selectProductCategorySiblings,
} from '../../utils/product-seo.ts'
import en from '../../i18n/locales/en.ts'

// The real English messages, interpolated the way vue-i18n interpolates them,
// so the composed length and wording are measured against what ships.
const messages = en.saya.product_detail as Record<string, string>
const translate = (key: string, named: Record<string, string>) => {
  const message = messages[key.replace('saya.product_detail.', '')]
  if (!message) throw new Error(`Missing test message: ${key}`)
  return message.replace(/\{(\w+)\}/g, (_match, name: string) => named[name] ?? '')
}

// Intl renders currency with a non-breaking space; collapse it so the
// assertions read the way the tag does.
const readable = (text: string) => text.replaceAll('\u00a0', ' ')

function product(overrides: Partial<Product> & { id: string; name: string }): Product {
  return {
    location_id: 'loc-1',
    category_id: 'cat-1',
    category: { id: 'cat-1', name: 'Sashimi', slug: 'sashimi', sort_order: 0 },
    slug: overrides.name.toLowerCase().replaceAll(' ', '-'),
    description: '',
    price: { amount_minor: 32000, currency: 'THB', compare_at_amount_minor: null },
    details: [],
    seo_description: null,
    ...overrides,
  } as unknown as Product
}

test('a dish with no description of its own is described by its category, price and location', () => {
  const description = composeProductSeoDescription({
    product: product({ id: 'p-1', name: 'Sprite', category: { id: 'cat-2', name: 'Soft Drinks', slug: 'soft-drinks', sort_order: 1 } }),
    locationTitle: 'Kikuzuki Ao Nang',
  }, translate)
  assert.equal(readable(description), 'Sprite — Soft Drinks. THB 320.00 at Kikuzuki Ao Nang.')
})

test('two dishes at the same location get different descriptions', () => {
  const shared = { locationTitle: 'Kikuzuki Ao Nang' }
  const sprite = composeProductSeoDescription({ ...shared, product: product({ id: 'p-1', name: 'Sprite' }) }, translate)
  const akagai = composeProductSeoDescription({
    ...shared,
    product: product({ id: 'p-2', name: 'Akagai Sashimi', description: 'Ark shell clam.' }),
  }, translate)
  assert.notEqual(sprite, akagai)
  assert.match(akagai, /Ark shell clam/)
})

test('the price and location survive a description far longer than the tag', () => {
  const description = composeProductSeoDescription({
    product: product({ id: 'p-3', name: 'Omakase', description: 'Chef selection '.repeat(40) }),
    locationTitle: 'Kikuzuki Ao Nang',
  }, translate)
  assert.ok(description.length <= 160, `composed ${description.length} characters`)
  assert.match(readable(description), /at Kikuzuki Ao Nang\.$/)
  // Truncated on a word boundary, never mid-word.
  assert.match(readable(description), / Chef…\. THB 320\.00 at /)
})

test('a row with no price at all is described without one and is not an offering', () => {
  const unpriced = product({ id: 'p-4', name: 'Market Fish', price: null })
  assert.equal(isOfferedProduct(unpriced), false)
  assert.equal(
    readable(composeProductSeoDescription({ product: unpriced, locationTitle: 'Kikuzuki Ao Nang' }, translate)),
    'Market Fish — Sashimi. Available at Kikuzuki Ao Nang.',
  )
})

test('an explicit price note is a real offering even without a numeric price', () => {
  const noted = product({ id: 'p-5', name: 'Market Fish', price: null, details: [{ key: 'price-note', label: 'Price', values: ['Market price'] }] })
  assert.equal(isOfferedProduct(noted), true)
  assert.match(
    readable(composeProductSeoDescription({ product: noted, locationTitle: 'Kikuzuki Ao Nang' }, translate)),
    /Market price at Kikuzuki Ao Nang\.$/,
  )
})

test('category siblings exclude the page itself, other categories and unpriced rows', () => {
  const catalogue = [
    product({ id: 'p-1', name: 'Akagai' }),
    product({ id: 'p-2', name: 'Maguro' }),
    product({ id: 'p-3', name: 'Placeholder', price: null }),
    product({ id: 'p-4', name: 'Sprite', category_id: 'cat-2', category: { id: 'cat-2', name: 'Soft Drinks', slug: 'soft-drinks', sort_order: 1 } }),
    product({ id: 'p-5', name: 'Elsewhere', location_id: 'loc-2' }),
  ]
  assert.deepEqual(
    selectProductCategorySiblings(catalogue, catalogue[0]!).map(sibling => sibling.name),
    ['Maguro'],
  )
})

test('the sibling window rotates and stays bounded so a large category is fully linked', () => {
  const catalogue = Array.from({ length: 20 }, (_item, index) => product({ id: `p-${index}`, name: `Dish ${index}` }))
  const first = selectProductCategorySiblings(catalogue, catalogue[0]!).map(sibling => sibling.name)
  const middle = selectProductCategorySiblings(catalogue, catalogue[10]!).map(sibling => sibling.name)
  assert.equal(first.length, CATEGORY_SIBLING_LIMIT)
  assert.equal(middle.length, CATEGORY_SIBLING_LIMIT)
  assert.deepEqual(first, ['Dish 1', 'Dish 2', 'Dish 3', 'Dish 4', 'Dish 5', 'Dish 6', 'Dish 7', 'Dish 8'])
  assert.deepEqual(middle, ['Dish 11', 'Dish 12', 'Dish 13', 'Dish 14', 'Dish 15', 'Dish 16', 'Dish 17', 'Dish 18'])
  // The last item wraps to the front rather than returning a short list.
  assert.deepEqual(
    selectProductCategorySiblings(catalogue, catalogue[19]!).map(sibling => sibling.name),
    ['Dish 0', 'Dish 1', 'Dish 2', 'Dish 3', 'Dish 4', 'Dish 5', 'Dish 6', 'Dish 7'],
  )
})
