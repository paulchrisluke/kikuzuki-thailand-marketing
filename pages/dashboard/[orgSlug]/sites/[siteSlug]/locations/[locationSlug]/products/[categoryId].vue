<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!--
    The category's own level: creating one at `new`, or its Name leaf. Both are
    the category record, so this page owns the chrome and the field.
  -->
  <UDashboardPanel v-else-if="isNew || openLeaf" id="location-product-category" :ui="{ body: 'min-h-0 gap-0! overflow-hidden! p-0! sm:p-0!' }">
    <template #header>
      <UDashboardNavbar :title="isNew ? `New ${presentation.categoryLabel.toLowerCase()}` : categoryName" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="productsPath" :label="presentation.collectionLabel" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="Boolean(openLeaf)"
        :detail-title="CATEGORY_LABELS.name"
        :dismiss-to="categoryPath"
        show-actions
        :saving="saving"
        :save-disabled="saveDisabled"
        :save-label="saveLabel"
        @cancel="closeLeaf"
        @save="saveLeaf"
      >
        <template #index>
          <UAlert v-if="errorMessage" class="mb-6" color="error" variant="soft" icon="i-lucide-triangle-alert" :description="errorMessage" />
          <template v-if="isNew">
            <div class="mb-6 flex justify-end">
              <UButton :label="createActionLabel" :loading="saving" @click="startOrCreate" />
            </div>
            <EditorNavigationList :groups="categoryNavigation" :active-item="openLeaf" />
          </template>
          <ProductItemList v-else />
        </template>
        <template #detail>
          <UFormField label="Name" required>
            <UInput v-model="form.name" :placeholder="presentation.categoryLabel === 'Section' ? 'Appetizers' : 'Accessories'" size="xl" autofocus class="w-full" />
          </UFormField>
          <DashboardResourceLocalization
            v-if="!isNew"
            class="mt-6"
            :site-id="siteId"
            resource-type="product_category"
            :resource-id="categoryId"
            :resource-label="presentation.categoryLabel.toLowerCase()"
            :fields="categoryLocalizationFields"
            :language-settings-path="siteLocalizationSettingsPath"
          />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

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
import EditorNavigationList, { type EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import DashboardResourceLocalization from '~/components/dashboard/DashboardResourceLocalization.vue'
import ProductItemList from '~/components/dashboard/ProductItemList.vue'
import { getErrorMessage } from '~/utils/errors'
import { requireProductPresentation } from '~/utils/product-presentation'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.products' })

const route = useRoute()
const toast = useToast()
const dashboardApi = useDashboardApi()
const categoryId = computed(() => String(route.params.categoryId ?? ''))
// The path comes from the route this screen is mounted on, not from the
// location selector: an unresolved selector left it empty, and an empty path is
// a link to nowhere and, where it roots the editor frame, a frame rooted at ''.
const locationPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/locations/${String(route.params.locationSlug)}`)
const productsPath = computed(() => `${locationPath.value}/products`)
const categoryPath = computed(() => `${productsPath.value}/${categoryId.value}`)
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
const category = computed(() => catalog.categories.value.find(row => row.id === categoryId.value) ?? null)
const categoryName = computed(() => category.value?.name ?? presentation.collectionLabel)

// ── The category record ─────────────────────────────────
const isNew = computed(() => categoryId.value === 'new')
const CATEGORY_LABELS = { name: 'Name' } as const
type CategoryLeaf = keyof typeof CATEGORY_LABELS
/** The category's own leaf, as opposed to a product open beneath it. */
const openLeaf = computed<CategoryLeaf | null>(() => (frame.childSegment.value === 'name' ? 'name' : null))
const openKey = computed<CategoryLeaf>(() => openLeaf.value ?? 'name')

watchEffect(() => {
  if (isNew.value && (frame.rest.value.length > 1 || (frame.childSegment.value && !openLeaf.value))) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})

// Keyed to the record so the draft survives the remount between sections.
const form = useState(`product-category-draft-${siteId}-${categoryId.value}`, () => ({ name: '' })).value
watch(category, (row) => { if (row) form.name = row.name }, { immediate: true })
// Nuxt reuses this page across categories; a record that has not arrived leaves nothing behind.
watch(categoryId, () => { form.name = category.value?.name ?? '' })

const saving = ref(false)
const errorMessage = ref('')

const categoryNavigation = computed<EditorNavigationGroup[]>(() => [{
  id: 'category',
  items: [{ id: 'name', label: 'Name', summary: form.name.trim() || 'Not named yet', placeholder: !form.name.trim(), to: `${categoryPath.value}/name` }],
}])
const categoryLocalizationFields = computed(() => [{ key: 'name', label: 'Name', source: category.value?.name }])
const siteLocalizationSettingsPath = computed(() => `/dashboard/${route.params.orgSlug}/sites/${route.params.siteSlug}/settings/localization`)

const { createActionLabel, saveLabel, saveDisabled, save: saveLeaf, startOrCreate } = useCreateWalk({
  recordPath: categoryPath,
  isNew,
  openKey,
  labels: CATEGORY_LABELS,
  order: ['name'],
  missing: () => !form.name.trim(),
  noun: presentation.categoryLabel.toLowerCase(),
  saving,
  commit,
})

const isCategoryCreated = (value: unknown): value is { category: { id: string } } =>
  isRecord(value) && isRecord(value.category) && typeof value.category.id === 'string'

async function commit() {
  const location = locationId.value
  if (!location) return
  saving.value = true
  errorMessage.value = ''
  try {
    const endpoint = `/api/editor/sites/${siteId}/locations/${location}/products/categories`
    if (isNew.value) {
      const created = await dashboardApi(endpoint, { method: 'POST', body: { name: form.name.trim() }, validate: isCategoryCreated })
      form.name = ''
      await catalog.refresh()
      toast.add({ description: `${presentation.categoryLabel} created`, color: 'success' })
      await navigateTo(`${productsPath.value}/${created.category.id}`)
      return
    }
    await dashboardApi(`${endpoint}/${categoryId.value}`, { method: 'PATCH', body: { name: form.name.trim() }, validate: isRecord })
    await catalog.refresh()
    toast.add({ description: 'Name saved', color: 'success' })
    await navigateTo(categoryPath.value)
  } catch (error) {
    // The index column, where the alert lives, is under the detail sheet on narrow screens.
    errorMessage.value = getErrorMessage(error, `Failed to save ${presentation.categoryLabel.toLowerCase()}`)
    toast.add({ description: errorMessage.value, color: 'error' })
  } finally {
    saving.value = false
  }
}

function closeLeaf() {
  if (category.value) form.name = category.value.name
  void navigateTo(categoryPath.value)
}
</script>
