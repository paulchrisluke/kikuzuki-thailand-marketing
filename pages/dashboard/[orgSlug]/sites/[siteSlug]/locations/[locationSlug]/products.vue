<template>
  <!--
    The open level is deeper than one of my children, so neither column is
    mine. Rendering my index anyway is what put a third column on screen.
  -->
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- A category is open: I am the index column, it is the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="location-products">
    <template #header>
      <UDashboardNavbar :title="presentation.collectionLabel" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="locationPath" label="Location" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        show-desktop-detail
        :dismiss-to="productsPath"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <ProductCategoryList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <!-- Nothing below me is open, so I am my parent's detail column. -->
  <ProductCategoryList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import ProductCategoryList from '~/components/dashboard/ProductCategoryList.vue'
import { requireProductPresentation } from '~/utils/product-presentation'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.products' })

const route = useRoute()
const { locationPaths } = useDashboardSiteLinks()
const dashboard = useDashboardSite()

const vertical = dashboard.site.value?.vertical
if (!vertical) throw createError({ statusCode: 500, statusMessage: 'Site vertical is not configured' })
const presentation = requireProductPresentation(vertical)

const productsPath = computed(() => locationPaths.value?.products ?? '')
const locationPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/locations/${String(route.params.locationSlug)}`)
const frame = useEditorFrame(productsPath)
</script>
