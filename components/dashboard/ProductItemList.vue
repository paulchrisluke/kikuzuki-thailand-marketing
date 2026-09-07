<template>
  <UDashboardPanel id="location-product-category">
    <template #header>
      <UDashboardNavbar :title="category?.name ?? presentation.collectionLabel" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="productsPath" :label="presentation.collectionLabel" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <DashboardListEditor
        v-model:editing="editing"
        v-model:selected="selected"
        :title="category?.name ?? presentation.collectionLabel"
        :description="`Customers see ${presentation.itemLabelPlural.toLowerCase()} in this order.`"
        :items="listItems"
        :pending="pending"
        :error="loadError"
        :empty-title="`No ${presentation.itemLabelPlural.toLowerCase()} here yet`"
        empty-icon="i-lucide-utensils"
        :add-label="`Add a ${presentation.itemLabel.toLowerCase()}`"
        reorderable
        selectable
        @add="openNew"
        @open="openExisting"
        @move="moveProduct"
      >
        <template #selection-actions>
          <UButton label="Move" color="neutral" variant="soft" data-testid="product-move-open" @click="moveDialogOpen = true" />
        </template>

        <template #item="{ item }">
          <button type="button" class="flex w-full items-center gap-4 text-left" :data-testid="`product-${item.id}`" @click="openExisting(item)">
            <DashboardMediaThumb :asset="item.row.image" :label="item.row.name" fallback-icon="i-lucide-image" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-highlighted">{{ item.row.name }}</span>
              <span class="mt-1 block text-sm tabular-nums" :class="priceLabel(item.row) ? 'text-muted' : 'italic text-muted'">
                {{ priceLabel(item.row) || 'No price set' }}
              </span>
            </span>
          </button>
        </template>
      </DashboardListEditor>

      <!-- Move is its own action, exactly as it is on Airbnb: it changes which
           category items belong to, never their order inside one. -->
      <DashboardListItemDialog
        v-model:open="moveDialogOpen"
        :title="`Move ${selected.length === 1 ? presentation.itemLabel.toLowerCase() : `${selected.length} ${presentation.itemLabelPlural.toLowerCase()}`}`"
        :removable="false"
        :saving="moving"
        :save-disabled="!moveTargetId"
        save-label="Move"
        @save="moveSelected"
      >
        <UFormField :label="`Choose a ${presentation.categoryLabel.toLowerCase()}`">
          <div class="space-y-2">
            <label
              v-for="option in moveTargets"
              :key="option.id"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-default px-3 py-2"
              :class="moveTargetId === option.id ? 'border-primary' : ''"
            >
              <input v-model="moveTargetId" type="radio" :value="option.id" :name="`move-target`">
              <span class="text-sm text-highlighted">{{ option.name }}</span>
            </label>
            <p v-if="!moveTargets.length" class="text-sm text-muted">
              There is nowhere else to move these yet. Add another {{ presentation.categoryLabel.toLowerCase() }} first.
            </p>
          </div>
        </UFormField>
      </DashboardListItemDialog>

      <DashboardListItemDialog
        v-model:open="newDialogOpen"
        :title="`Add a ${presentation.itemLabel.toLowerCase()}`"
        :removable="false"
        :saving="creating"
        :save-disabled="!newName.trim()"
        save-label="Add"
        @save="createProduct"
      >
        <UFormField label="Name" required>
          <UInput v-model="newName" size="xl" autofocus class="w-full" @keydown.enter="createProduct" />
        </UFormField>
        <p class="text-sm text-muted">
          You'll land on this {{ presentation.itemLabel.toLowerCase() }}'s own page, where its photo, price,
          description, tags and availability are each a section you can fill in.
        </p>
      </DashboardListItemDialog>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
// One category's items. Rendered by `[categoryId].vue`, which owns the frame.
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardMediaThumb from '~/components/dashboard/DashboardMediaThumb.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'
import type { Product } from '~/server/types/products'
import { getErrorMessage } from '~/utils/errors'
import { formatProductPriceLabel } from '~/utils/product-money'
import { requireProductPresentation } from '~/utils/product-presentation'


const route = useRoute()
const dashboardApi = useDashboardApi()
const toast = useToast()
const { locationPaths } = useDashboardSiteLinks()
const siteId = await useDashboardSiteId()
const dashboard = useDashboardSite()
const dashboardLocation = useDashboardLocation()

const vertical = dashboard.site.value?.vertical
if (!vertical) throw createError({ statusCode: 500, statusMessage: 'Site vertical is not configured' })
const presentation = requireProductPresentation(vertical)
const categoryId = computed(() => String(route.params.categoryId ?? ''))
const locationId = computed(() => dashboardLocation.currentLocation.value?.id ?? null)
const productsPath = computed(() => locationPaths.value?.products ?? '')
const categoryPath = computed(() => `${productsPath.value}/${categoryId.value}`)

const catalog = useLocationProductCatalog(siteId, locationId)
const categories = catalog.categories
const pending = catalog.pending
const loadError = computed(() => (catalog.error.value ? getErrorMessage(catalog.error.value, `Failed to load ${presentation.itemLabelPlural.toLowerCase()}`) : null))

// Reorder is a mode: the local order stands while the edit state is open and
// commits once when it closes, so it is held apart from the shared catalog.
const localOrder = ref<Product[] | null>(null)
const products = computed(() => localOrder.value ?? catalog.products.value.filter(row => row.category_id === categoryId.value))
const editing = ref(false)
const selected = ref<string[]>([])
const orderDirty = ref(false)

const category = computed(() => categories.value.find(row => row.id === categoryId.value) ?? null)
const listItems = computed(() => products.value.map(row => ({ id: row.id, title: row.name, row })))
const moveTargets = computed(() => categories.value.filter(row => row.id !== categoryId.value))

useSeoMeta({ title: () => `${category.value?.name ?? presentation.collectionLabel} | KrabiClaw Dashboard`, robots: 'noindex, nofollow' })

function priceLabel(product: Product) {
  return formatProductPriceLabel(product)
}

function isOne(value: unknown): value is { success: true; product: Product } {
  return isRecord(value) && isRecord(value.product)
}

const load = catalog.refresh

// A category that is not in the catalog is not a page.
watchEffect(() => {
  if (!catalog.pending.value && catalog.categories.value.length && !category.value) {
    throw createError({ statusCode: 404, statusMessage: 'Product category not found' })
  }
})

/** Local while the edit state is open; committed once when it closes. */
function moveProduct(item: { row: Product }, direction: -1 | 1) {
  const index = products.value.findIndex(row => row.id === item.row.id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= products.value.length) return
  const next = [...products.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  localOrder.value = next
  orderDirty.value = true
}

async function commitOrder() {
  const id = locationId.value
  if (!id || !orderDirty.value) return
  orderDirty.value = false
  const order = products.value.map(row => row.id)
  localOrder.value = null
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/order`, {
      method: 'PUT',
      body: { category_id: categoryId.value, product_ids: order },
      validate: isRecord,
    })
  } catch (error) {
    toast.add({ description: getErrorMessage(error, 'Failed to save the new order'), color: 'error' })
    await load()
  }
}

watch(editing, (value, previous) => {
  if (previous && !value) void commitOrder()
})

const moveDialogOpen = ref(false)
const moveTargetId = ref('')
const moving = ref(false)

watch(moveDialogOpen, (open) => {
  if (open) moveTargetId.value = ''
})

async function moveSelected() {
  const id = locationId.value
  if (!id || !moveTargetId.value || !selected.value.length) return
  moving.value = true
  try {
    // Commit any pending reorder first. Closing the edit state below would
    // otherwise fire commitOrder with the pre-move list, sending IDs that no
    // longer belong to this category.
    await commitOrder()
    await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/move`, {
      method: 'POST',
      body: { product_ids: selected.value, category_id: moveTargetId.value },
      validate: isRecord,
    })
    moveDialogOpen.value = false
    selected.value = []
    editing.value = false
    await load()
  } catch (error) {
    toast.add({ description: getErrorMessage(error, `Failed to move ${presentation.itemLabelPlural.toLowerCase()}`), color: 'error' })
  } finally {
    moving.value = false
  }
}

// Adding asks only for what names the item. Photo, price, description, tags and
// the rest are sections of the item once it exists, so Add is not a wall of
// fields before there is anything to attach them to.
const newDialogOpen = ref(false)
const newName = ref('')
const creating = ref(false)

function openNew() {
  newName.value = ''
  newDialogOpen.value = true
}

async function createProduct() {
  const id = locationId.value
  if (!id || !newName.value.trim()) return
  creating.value = true
  try {
    const response = await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products`, {
      method: 'POST',
      body: {
        name: newName.value.trim(),
        category_id: categoryId.value,
        description: '',
        price: null,
        order_url: null,
        tags: [],
        details: [],
        is_visible: true,
        available: true,
        featured: false,
      },
      validate: isOne,
    })
    newDialogOpen.value = false
    await navigateTo(`${categoryPath.value}/${response.product.id}`)
  } catch (error) {
    toast.add({ description: getErrorMessage(error, `Failed to add ${presentation.itemLabel.toLowerCase()}`), color: 'error' })
  } finally {
    creating.value = false
  }
}

/** An item is its own screen now, so opening one is navigation, not a sheet. */
function openExisting(item: { row: Product }) {
  return navigateTo(`${categoryPath.value}/${item.row.id}`)
}

// A ?localize= deep link names an item, and the item's translations live on its
// own page, so the link resolves to that page rather than opening anything here.
watch(products, (rows) => {
  const target = typeof route.query.localize === 'string' ? route.query.localize : ''
  if (!target.startsWith('product:')) return
  const product = rows.find(row => target === `product:${row.id}`)
  if (product) void navigateTo(`${categoryPath.value}/${product.id}`)
}, { immediate: true })

watch([locationId, categoryId], () => {
  editing.value = false
  moveDialogOpen.value = false
  selected.value = []
  void load()
}, { immediate: true })

</script>
