<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- An item is open: my list is the index column, the item is the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="location-product-category">
    <template #header>
      <UDashboardNavbar :title="categoryName" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="productsPath" :label="presentation.collectionLabel" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        show-desktop-detail
        :dismiss-to="categoryPath"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <ProductItemList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <ProductItemList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import ProductItemList from '~/components/dashboard/ProductItemList.vue'
import { requireProductPresentation } from '~/utils/product-presentation'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.products' })

const route = useRoute()
const { locationPaths } = useDashboardSiteLinks()
const categoryId = computed(() => String(route.params.categoryId ?? ''))
const productsPath = computed(() => locationPaths.value?.products ?? '')
const categoryPath = computed(() => `${productsPath.value}/${categoryId.value}`)
// `useEditorFrame` provides and injects, so it must run while setup is still
// synchronous. Awaiting before it binds the frame to nothing: the mode never
// resolves and this level silently drops out of the chain.
const frame = useEditorFrame(categoryPath)

const siteId = await useDashboardSiteId()
const dashboard = useDashboardSite()
const dashboardLocation = useDashboardLocation()

const vertical = dashboard.site.value?.vertical
if (!vertical) throw createError({ statusCode: 500, statusMessage: 'Site vertical is not configured' })
const presentation = requireProductPresentation(vertical)

const locationId = computed(() => dashboardLocation.currentLocation.value?.id ?? null)

// The same catalog the two lists read, so titling this column costs no request.
const catalog = useLocationProductCatalog(siteId, locationId)

const categoryName = computed(() =>
  catalog.categories.value.find(row => row.id === categoryId.value)?.name ?? presentation.collectionLabel)
</script>
