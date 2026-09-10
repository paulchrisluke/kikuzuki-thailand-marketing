<template>
  <ProductDetailPage
    site-id=""
    :vertical="vertical"
    :product="product"
    :location="productLocation"
    :reviews="[]"
    :category-siblings="categorySiblings"
    :currency="currency"
    :presentation="presentation"
    :analytics-enabled="false"
  />
</template>

<script setup lang="ts">
import ProductDetailPage from '~/components/products/ProductDetailPage.vue'
import { isCurrencyCode } from '~/shared/currencies'
import { requireProductPresentation } from '~/utils/product-presentation'
import { composeProductSeoDescription, selectProductCategorySiblings } from '~/utils/product-seo'

const props = defineProps<{ routeKind: 'menu' | 'products' }>()
const route = useRoute()
const { products, location, config, site } = await usePublicPageData({ lazy: false })
if (!location.value) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
const productSlug = typeof route.params.productSlug === 'string' ? route.params.productSlug : ''
const product = products.value.find(candidate => candidate.location_id === location.value?.id && candidate.slug === productSlug)
if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
const vertical = String(site.value?.vertical ?? '')
const presentation = requireProductPresentation(vertical)
if (presentation.locationCollectionSegment !== props.routeKind) throw createError({ statusCode: 404 })
const rawCurrency = config.value.default_currency
if (!isCurrencyCode(rawCurrency)) throw createError({ statusCode: 500, statusMessage: 'Unsupported site currency' })
const currency = rawCurrency
const productLocation = {
  id: String(location.value.id),
  slug: String(location.value.slug),
  title: String(location.value.title),
}

const categorySiblings = selectProductCategorySiblings(products.value, product)
const { t } = useI18n()

useSocialMetadata(() => ({
  path: presentation.productPath(productLocation.slug, product.slug),
  title: product.seo_title || product.name,
  description: composeProductSeoDescription({
    product,
    locationTitle: productLocation.title,
  }, t),
  robots: 'noindex,nofollow',
  brand: { siteName: String(site.value?.brand_name ?? '') },
}))
</script>
