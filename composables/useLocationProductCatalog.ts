import type { Ref } from 'vue'
import type { Product, ProductCategory } from '~/server/types/products'

/**
 * One location's categories and items, fetched once.
 *
 * Three levels of the menu chain need this data at the same time — the category
 * list, one category's item list, and the level that titles the column — and
 * each used to fetch it for itself. Keyed `useAsyncData` means they share one
 * request and one cache entry, and a write in any of them refreshes all three.
 */
export function useLocationProductCatalog(siteId: string, locationId: Ref<string | null>) {
  const dashboardApi = useDashboardApi()

  const isCategoryList = (value: unknown): value is { categories: ProductCategory[] } =>
    isRecord(value) && Array.isArray(value.categories)
  const isProductList = (value: unknown): value is { success: true, products: Product[] } =>
    isRecord(value) && Array.isArray(value.products)

  const { data, pending, error, refresh } = useAsyncData(
    computed(() => `location-product-catalog:${siteId}:${locationId.value ?? 'missing'}`),
    async () => {
      const id = locationId.value
      // No location resolved yet is not an error — it is a request that has
      // nothing to ask for. The surfaces render their own empty state.
      if (!id) return { categories: [] as ProductCategory[], products: [] as Product[] }
      const [categoryResponse, productResponse] = await Promise.all([
        dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/categories`, { validate: isCategoryList }),
        dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products`, { validate: isProductList }),
      ])
      return { categories: categoryResponse.categories, products: productResponse.products }
    },
    { watch: [locationId] },
  )

  const categories = computed(() => data.value?.categories ?? [])
  const products = computed(() => data.value?.products ?? [])

  return { categories, products, pending, error, refresh }
}
