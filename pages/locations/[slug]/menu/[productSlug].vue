<template>
  <ProductDetailPage :site-id="siteId" :vertical="detail.vertical" :product="detail.product" :location="detail.location" :reviews="detail.reviews" :category-siblings="detail.categorySiblings" :currency="detail.currency" :presentation="presentation" />
</template>

<script setup lang="ts">
import ProductDetailPage from '~/components/products/ProductDetailPage.vue'
import { requireProductPresentation } from '~/utils/product-presentation'
import { normalizeRobotsIntent } from '~/shared/robots-directive'
import { composeProductSeoDescription, isOfferedProduct } from '~/utils/product-seo'

definePageMeta({ layout: 'saya' })
const resolved = await usePublicProductDetail('menu')
const siteId = resolved.siteId
const detail = computed(() => resolved.detail.value)
const presentation = requireProductPresentation(detail.value.vertical)
if (presentation.locationCollectionSegment !== 'menu') throw createError({ statusCode: 404 })
const { localePath, t } = useI18n()
useSocialMetadata(() => ({
  path: presentation.productPath(detail.value.location.slug, detail.value.product.slug),
  // A row with no price at all is a placeholder, not an offering, so it points
  // at the index instead of competing with it. Data-driven: nothing lists which
  // products this applies to. Kikuzuki prices every product today, so this is
  // currently a no-op there.
  canonicalPath: isOfferedProduct(detail.value.product) ? undefined : localePath(presentation.collectionPath),
  title: detail.value.product.seo_title || detail.value.product.name,
  description: composeProductSeoDescription({
    product: detail.value.product,
    locationTitle: detail.value.location.title,
  }, t),
  robots: normalizeRobotsIntent(detail.value.product.robots),
  socialImage: detail.value.product.social_image,
  brand: { siteName: detail.value.brandName },
}))
</script>
