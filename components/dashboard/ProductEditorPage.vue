<template>
  <!--
    With no section open this item is its parent's detail column, so it renders
    its rows and nothing else — no panel, no navbar, and no section opened on
    its behalf. It becomes the index column only once a section is open.
  -->
  <div v-if="frame.mode.value === 'index'">
    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="`${presentation.itemLabel} could not be loaded`"
      :description="loadError"
    />
    <template v-else>
      <div v-if="isNew" class="mb-6 flex justify-end">
        <UButton :label="createActionLabel" :loading="saving" @click="startOrCreate" />
      </div>
      <EditorNavigationList :groups="navigationGroups" @select="openMove" />
    </template>
  </div>

  <UDashboardPanel v-else id="location-product-detail">
    <template #header>
      <!--
        The navbar names the index level and the way up from it. When a section
        is open the index column is still this item's own hub, so the title
        stays the item's name — the open section names itself in the pane.
      -->
      <UDashboardNavbar :title="form.name || presentation.itemLabel" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="categoryPath" :label="category?.name ?? presentation.collectionLabel" />
        </template>
        <template v-if="product" #right>
          <DashboardResourceLocalization
            :site-id="siteId"
            resource-type="product"
            :resource-id="productId"
            :resource-label="presentation.itemLabel.toLowerCase()"
            :fields="productLocalizationFields"
            :load-values="loadProductLocalization"
            :save-values="saveProductLocalization"
            :language-settings-path="siteLocalizationSettingsPath"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="loadError"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="`${presentation.itemLabel} could not be loaded`"
        :description="loadError"
      />

      <EditorPaneShell
        v-else
        has-detail
        :show-actions="editorKey !== 'photo'"
        :saving="saving"
        :save-disabled="saveDisabled"
        :save-label="saveLabel"
        :detail-title="sectionLabels[editorKey]"
        :dismiss-to="itemPath"
        @cancel="cancelEditor"
        @save="saveCurrentEditor"
      >
        <template #index>
          <EditorNavigationList :groups="navigationGroups" :active-item="detailKey" @select="openMove" />
        </template>

        <template #detail>
          <!-- Photo -->
          <div v-if="editorKey === 'photo'" class="space-y-4">
            <p class="text-base text-muted">The picture guests recognise this by, in the list and on your site.</p>
            <DashboardCoverPhotoField
              :site-id="siteId"
              :location-id="locationId"
              :model-value="form.image_asset_id"
              :preview-url="product?.image?.public_url ?? null"
              :preview-alt="product?.image?.alt_text || form.name"
              :title="`${presentation.itemLabel} photo`"
              testid="product-photo"
              @update:model-value="setPrimaryImage"
            />
            <p class="text-sm text-muted">A photo saves as soon as you choose it.</p>
          </div>

          <!-- Name -->
          <UFormField v-else-if="editorKey === 'name'" label="Name" required>
            <UInput v-model="form.name" size="xl" autofocus class="w-full" />
          </UFormField>

          <!--
            Price is one three-way choice — amount, wording, or nothing — because
            those are the only three states the server accepts.
          -->
          <div v-else-if="editorKey === 'price'" class="space-y-5">
            <URadioGroup v-model="form.price_mode" :items="priceModes" :ui="{ fieldset: 'flex flex-wrap gap-4' }" />
            <UFormField v-if="form.price_mode === 'amount'" :label="`Amount (${currency})`">
              <UInput v-model="form.price_major" inputmode="decimal" placeholder="280" class="w-full" />
            </UFormField>
            <UFormField
              v-else-if="form.price_mode === 'wording'"
              label="Wording"
              description="Shown to customers in place of a number."
            >
              <UInput v-model="form.price_note" placeholder="Market price" class="w-full" />
            </UFormField>
          </div>

          <!-- Description -->
          <UFormField v-else-if="editorKey === 'description'" label="Description">
            <UTextarea v-model="form.description" :rows="10" autofocus class="w-full" />
          </UFormField>

          <!-- Order link -->
          <UFormField v-else-if="editorKey === 'order-url'" label="Order URL" description="Where a customer goes to order this.">
            <UInput v-model="form.order_url" type="url" placeholder="https://…" class="w-full" />
          </UFormField>

          <!-- Tags -->
          <UFormField v-else-if="editorKey === 'tags'" label="Tags">
            <UInputTags
              v-model="form.tags"
              placeholder="Add a tag"
              :max="PRODUCT_LIMITS.tags"
              :max-length="PRODUCT_LIMITS.tag"
              delimiter=","
              add-on-blur
              add-on-paste
              class="w-full"
            />
          </UFormField>

          <!--
            Details are the labelled facts under the item on the public page —
            allergens, ingredients, spice level. The stored kebab-case key is
            derived from the label rather than typed: no customer ever sees it.
          -->
          <div v-else-if="editorKey === 'details'" class="space-y-3">
            <p class="text-base text-muted">Extra facts shown under this {{ presentation.itemLabel.toLowerCase() }} on your site.</p>
            <div
              v-for="(group, index) in form.details"
              :key="index"
              class="space-y-2 rounded-lg border border-default p-3"
              :data-testid="`product-detail-${index}`"
            >
              <div class="flex items-center gap-2">
                <UInput
                  v-model="group.label"
                  placeholder="Allergens"
                  :maxlength="PRODUCT_LIMITS.detailLabel"
                  class="flex-1"
                  aria-label="Detail name"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Remove ${group.label || 'detail'}`"
                  :data-testid="`product-detail-remove-${index}`"
                  @click="form.details.splice(index, 1)"
                />
              </div>
              <UInputTags
                v-model="group.values"
                placeholder="Add a value"
                :max="PRODUCT_LIMITS.detailValues"
                :max-length="PRODUCT_LIMITS.detailValue"
                delimiter=","
                add-on-blur
                add-on-paste
                class="w-full"
              />
            </div>
            <p v-if="incompleteDetail" class="text-sm text-muted">
              Give every detail a name and at least one value, or remove it.
            </p>
            <UButton
              v-if="form.details.length < PRODUCT_LIMITS.detailGroups"
              label="Add a detail"
              icon="i-lucide-plus"
              color="neutral"
              variant="soft"
              data-testid="product-detail-add"
              @click="form.details.push({ key: null, label: '', values: [] })"
            />
          </div>

          <!-- Availability -->
          <div v-else-if="editorKey === 'availability'" class="space-y-4">
            <UCheckbox v-model="form.is_visible" label="Visible" description="Shown on your site at all." />
            <UCheckbox v-model="form.available" label="Available" description="Orderable right now." />
            <UCheckbox v-model="form.featured" label="Featured" description="Promoted ahead of the rest." />
          </div>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <!--
    Move is its own action: it changes which category this belongs to, never its
    order inside one.
  -->
  <DashboardListItemDialog
    v-model:open="moveDialogOpen"
    :title="`Move ${presentation.itemLabel.toLowerCase()}`"
    :removable="false"
    :saving="moving"
    :save-disabled="!moveTargetId"
    save-label="Move"
    @save="moveProduct"
  >
    <UFormField :label="`Choose a ${presentation.categoryLabel.toLowerCase()}`">
      <div class="space-y-2">
        <label
          v-for="option in moveTargets"
          :key="option.id"
          class="flex cursor-pointer items-center gap-3 rounded-lg border border-default px-3 py-2"
          :class="moveTargetId === option.id ? 'border-primary' : ''"
        >
          <input v-model="moveTargetId" type="radio" :value="option.id" name="move-target">
          <span class="text-sm text-highlighted">{{ option.name }}</span>
        </label>
        <p v-if="!moveTargets.length" class="text-sm text-muted">
          There is nowhere else to move this yet. Add another {{ presentation.categoryLabel.toLowerCase() }} first.
        </p>
      </div>
    </UFormField>
  </DashboardListItemDialog>
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import EditorNavigationList, { type EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'
import DashboardCoverPhotoField from '~/components/dashboard/DashboardCoverPhotoField.vue'
import DashboardResourceLocalization from '~/components/dashboard/DashboardResourceLocalization.vue'
import type { Product, ProductCategory } from '~/server/types/products'
import type { ProductDetailDraft } from '~/utils/product-fields'
import { fromProductDetailDrafts, normalizeProductTags, toProductDetailDrafts } from '~/utils/product-fields'
import { PRODUCT_LIMITS } from '~/shared/product-limits'
import { isCurrencyCode } from '~/shared/currencies'
import { majorAmountToMinor, minorAmountToMajor } from '~/shared/prices'
import { formatProductPriceLabel } from '~/utils/product-money'
import { requireProductPresentation } from '~/utils/product-presentation'
import { getErrorMessage, isNotFoundError } from '~/utils/errors'

const route = useRoute()
const dashboardApi = useDashboardApi()
const toast = useToast()
const categoryId = computed(() => String(route.params.categoryId ?? ''))
const productId = computed(() => String(route.params.productId ?? ''))
// The path comes from the route this screen is mounted on, not from the
// location selector: an unresolved selector left it empty, and an empty path is
// a link to nowhere and, where it roots the editor frame, a frame rooted at ''.
const locationPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/locations/${String(route.params.locationSlug)}`)
const productsPath = computed(() => `${locationPath.value}/products`)
const categoryPath = computed(() => `${productsPath.value}/${categoryId.value}`)
const itemPath = computed(() => `${categoryPath.value}/${productId.value}`)
const frame = useEditorFrame(itemPath)

const siteId = await useDashboardSiteId()
const dashboard = useDashboardSite()
const dashboardLocation = useDashboardLocation()

const vertical = dashboard.site.value?.vertical
if (!vertical) throw createError({ statusCode: 500, statusMessage: 'Site vertical is not configured' })
const presentation = requireProductPresentation(vertical)
const rawCurrency = dashboard.site.value?.default_currency
if (!isCurrencyCode(rawCurrency)) throw createError({ statusCode: 500, statusMessage: 'Unsupported site currency' })
const currency = rawCurrency

const locationId = computed(() => dashboardLocation.currentLocation.value?.id ?? null)

// ── Which leaf is open ──────────────────────────────────
// A plain list, not derived from loaded data: the route is checked at setup,
// before the item is fetched.
const SECTION_KEYS = ['photo', 'name', 'price', 'description', 'order-url', 'tags', 'details', 'availability'] as const
type SectionKey = typeof SECTION_KEYS[number]

const sectionLabels: Record<SectionKey, string> = {
  'photo': 'Photo',
  'name': 'Name',
  'price': 'Price',
  'description': 'Description',
  'order-url': 'Order link',
  'tags': 'Tags',
  'details': 'Details',
  'availability': 'Availability',
}

const detailKey = computed(() => frame.childSegment.value)
// Only read while a section is open; nothing defaults a section into the pane.
const editorKey = computed<SectionKey>(() => (detailKey.value ?? 'photo') as SectionKey)

/**
 * Creating asks only for what the POST will not accept an item without. The
 * photo, the price and the rest each need a saved id, so they are sections of
 * the item once it exists — and a route naming one before then is not a page.
 */
const NEW_SECTION_KEYS: readonly SectionKey[] = ['name']
const isNew = computed(() => productId.value === 'new')
const openSections = computed<readonly SectionKey[]>(() => (isNew.value ? NEW_SECTION_KEYS : SECTION_KEYS))

// An unsupported route 404s rather than silently showing the first section.
if (frame.rest.value.length > 1 || (detailKey.value && !openSections.value.some(key => key === detailKey.value))) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// ── Load ────────────────────────────────────────────────
const categories = ref<ProductCategory[]>([])

const product = ref<Product | null>(null)
const loadError = ref<string | null>(null)
const saving = ref(false)

function isCategoryList(value: unknown): value is { categories: ProductCategory[] } {
  return isRecord(value) && Array.isArray(value.categories)
}
function isProductList(value: unknown): value is { success: true, products: Product[] } {
  return isRecord(value) && Array.isArray(value.products)
}
function isOne(value: unknown): value is { success: true, product: Product } {
  return isRecord(value) && isRecord(value.product)
}

const category = computed(() => categories.value.find(row => row.id === categoryId.value) ?? null)
const moveTargets = computed(() => categories.value.filter(row => row.id !== categoryId.value))

async function load() {
  const id = locationId.value
  if (!id || isNew.value) return
  loadError.value = null
  try {
    const [categoryResponse, productResponse] = await Promise.all([
      dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/categories`, { validate: isCategoryList }),
      dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products`, { validate: isProductList }),
    ])
    categories.value = categoryResponse.categories
    const found = productResponse.products.find(row => row.id === productId.value)
    // An item that is not there is not a page; a request that failed is a state.
    if (!found) return showError(createError({ statusCode: 404, statusMessage: `${presentation.itemLabel} not found` }))
    product.value = found
    loadForm(found)
  } catch (error) {
    if (isNotFoundError(error)) return showError(createError({ statusCode: 404, statusMessage: `${presentation.itemLabel} not found` }))
    loadError.value = getErrorMessage(error, `Failed to load this ${presentation.itemLabel.toLowerCase()}`)
  }
}

onMounted(load)
watch(locationId, load)

// ── The form ────────────────────────────────────────────
/** The three states the server accepts; nothing else is representable. */
type PriceMode = 'amount' | 'wording' | 'none'
const priceModes = [
  { label: 'Amount', value: 'amount' },
  { label: 'Wording', value: 'wording' },
  { label: 'No price', value: 'none' },
]

const form = reactive({
  name: '',
  price_major: '',
  price_mode: 'amount' as PriceMode,
  price_note: '',
  description: '',
  order_url: '',
  tags: [] as string[],
  details: [] as ProductDetailDraft[],
  is_visible: true,
  available: true,
  featured: false,
  image_asset_id: null as string | null,
})

function loadForm(row: Product) {
  form.name = row.name
  form.price_major = row.price ? minorAmountToMajor(row.price.amount_minor, row.price.currency) : ''
  form.price_note = row.details.find(detail => detail.key === 'price-note')?.values[0] ?? ''
  form.price_mode = row.price !== null ? 'amount' : (form.price_note ? 'wording' : 'none')
  form.description = row.description
  form.order_url = row.order_url ?? ''
  form.tags = [...row.tags]
  form.details = toProductDetailDrafts(row.details)
  form.is_visible = row.is_visible
  form.available = row.available
  form.featured = row.featured
  form.image_asset_id = row.image?.asset_id ?? null
}

// A half-filled group cannot be saved, and is not silently dropped either: the
// tenant typed it, so the save waits rather than discarding their work.
const incompleteDetail = computed(() => form.details.some(group =>
  !group.label.trim() || !group.values.some(value => value.trim())))

const sectionValid = computed(() => {
  if (editorKey.value === 'name') return Boolean(form.name.trim())
  if (editorKey.value === 'price') return form.price_mode !== 'amount' || Boolean(form.price_major.trim())
  if (editorKey.value === 'details') return !incompleteDetail.value
  return true
})

// ── The hub ─────────────────────────────────────────────
function listSummary(values: readonly string[], empty: string) {
  return values.length ? values.join(', ') : empty
}

const navigationGroups = computed<EditorNavigationGroup[]>(() => {
  const image = product.value?.image
  // Photo, price, tags and the rest are sections of an item once it exists.
  if (isNew.value) return [{
    id: 'item',
    items: [{ id: 'name', label: 'Name', summary: form.name || 'Not named yet', placeholder: !form.name, to: `${itemPath.value}/name` }],
  }]
  return [
    {
      id: 'item',
      items: [
        {
          id: 'photo',
          label: 'Photo',
          summary: image ? '' : 'No photo yet',
          placeholder: !image,
          to: `${itemPath.value}/photo`,
          previews: image?.thumbnail_url || image?.public_url ? [String(image.thumbnail_url ?? image.public_url)] : undefined,
        },
        { id: 'name', label: 'Name', summary: form.name || 'Not named yet', placeholder: !form.name, to: `${itemPath.value}/name` },
        {
          id: 'price',
          label: 'Price',
          summary: product.value ? (formatProductPriceLabel(product.value) || 'No price set') : '',
          placeholder: Boolean(product.value) && !formatProductPriceLabel(product.value!),
          to: `${itemPath.value}/price`,
        },
        {
          id: 'description',
          label: 'Description',
          summary: form.description || 'Nothing written yet',
          placeholder: !form.description,
          to: `${itemPath.value}/description`,
        },
      ],
    },
    {
      id: 'more',
      label: 'More',
      items: [
        // Membership is a navigable row, not a field: the free-text box it
        // replaced silently forked a new category on a typo.
        { id: 'category', label: presentation.categoryLabel, summary: category.value?.name ?? '' },
        { id: 'order-url', label: 'Order link', summary: form.order_url || 'No link', placeholder: !form.order_url, to: `${itemPath.value}/order-url` },
        { id: 'tags', label: 'Tags', summary: listSummary(form.tags, 'No tags'), placeholder: !form.tags.length, to: `${itemPath.value}/tags` },
        {
          id: 'details',
          label: 'Details',
          summary: listSummary(form.details.map(group => group.label).filter(Boolean), 'None added'),
          placeholder: !form.details.length,
          to: `${itemPath.value}/details`,
        },
        { id: 'availability', label: 'Availability', summary: availabilitySummary(), to: `${itemPath.value}/availability` },
      ],
    },
  ]
})

function availabilitySummary(): string {
  if (!form.is_visible) return 'Hidden from your site'
  const parts = ['Visible']
  if (!form.available) parts.push('not orderable')
  if (form.featured) parts.push('featured')
  return parts.join(' · ')
}

// ── Save / cancel ───────────────────────────────────────
function payload() {
  // An amount mode with no amount is not an amount. Converting an empty string
  // threw "USD amounts must use at most 2 fraction digits", which surfaced as a
  // save that failed for a reason the owner had no way to act on — and made a
  // brand-new item, which starts in amount mode with nothing typed,
  // impossible to create at all.
  const price = form.price_mode === 'amount' && form.price_major.trim()
    ? { amount_minor: majorAmountToMinor(form.price_major, currency), currency, unit: 'item' as const, tax_behavior: 'unspecified' as const }
    : null
  const details = fromProductDetailDrafts(form.details)
  // Wording is dropped unless it is the chosen mode, so switching to an amount
  // cannot leave a stale note behind for the server to reject.
  const priceNote = form.price_mode === 'wording' ? form.price_note.trim() : ''
  return {
    name: form.name.trim(),
    description: form.description,
    price,
    order_url: form.order_url || null,
    tags: normalizeProductTags(form.tags),
    details: priceNote ? [...details, { key: 'price-note', label: 'Price', values: [priceNote] }] : details,
    is_visible: form.is_visible,
    available: form.available,
    featured: form.featured,
  }
}

const { createActionLabel, saveLabel, saveDisabled, save: saveCurrentEditor, startOrCreate } = useCreateWalk({
  recordPath: itemPath,
  isNew,
  openKey: editorKey,
  labels: sectionLabels,
  order: ['name'],
  missing: () => !form.name.trim(),
  noun: presentation.itemLabel.toLowerCase(),
  saving,
  existingBlocked: () => !sectionValid.value,
  commit,
})

async function commit() {
  const id = locationId.value
  if (!id) return
  saving.value = true
  try {
    if (isNew.value) {
      const created = await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products`, {
        method: 'POST', body: { ...payload(), category_id: categoryId.value }, validate: isOne,
      })
      await navigateTo(`${categoryPath.value}/${created.product.id}`)
      return
    }
    await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/${productId.value}`, {
      method: 'PATCH', body: payload(), validate: isOne,
    })
    await load()
    await navigateTo(itemPath.value)
  } catch (error) {
    toast.add({ description: getErrorMessage(error, `Failed to save ${presentation.itemLabel.toLowerCase()}`), color: 'error' })
  } finally {
    saving.value = false
  }
}

/** Dismissing a leaf discards its draft, matching the settings sheets. */
async function cancelEditor() {
  if (product.value) loadForm(product.value)
  await navigateTo(itemPath.value)
}

async function setPrimaryImage(assetId: string | null) {
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/media/placements`, {
      method: 'PUT',
      body: { placement: { owner_type: 'product', owner_id: productId.value, slot: 'image' }, asset_id: assetId },
      validate: isRecord,
    })
    form.image_asset_id = assetId
    await load()
  } catch (error) {
    toast.add({ description: getErrorMessage(error, 'Failed to update the photo'), color: 'error' })
  }
}

// ── Move ────────────────────────────────────────────────
const moveDialogOpen = ref(false)
const moveTargetId = ref('')
const moving = ref(false)

watch(moveDialogOpen, (open) => {
  if (open) moveTargetId.value = ''
})

function openMove(id: string) {
  if (id === 'category') moveDialogOpen.value = true
}

async function moveProduct() {
  const id = locationId.value
  if (!id || !moveTargetId.value) return
  moving.value = true
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/locations/${id}/products/move`, {
      method: 'POST',
      body: { product_ids: [productId.value], category_id: moveTargetId.value },
      validate: isRecord,
    })
    moveDialogOpen.value = false
    // The item now lives under a different category, so its own route moves too.
    await navigateTo(`${productsPath.value}/${moveTargetId.value}/${productId.value}`)
  } catch (error) {
    toast.add({ description: getErrorMessage(error, `Failed to move ${presentation.itemLabel.toLowerCase()}`), color: 'error' })
  } finally {
    moving.value = false
  }
}

// ── Localization ────────────────────────────────────────
// Details are translated field by field, so each stored detail contributes a
// label and a values entry rather than one opaque JSON blob.
function productDetailFieldKey(kind: 'label' | 'values', key: string): string {
  return `detail:${kind}:${key}`
}

const productLocalizationFields = computed(() => {
  const row = product.value
  const fields: Array<{ key: string, label: string, source: string | readonly string[] | null | undefined, kind?: 'string-list', multiline?: boolean, rows?: number }> = [
    { key: 'name', label: 'Name', source: row?.name },
    { key: 'description', label: 'Description', source: row?.description, multiline: true, rows: 4 },
    { key: 'tags_json', label: 'Tags', source: row?.tags, kind: 'string-list' },
  ]
  row?.details.forEach((detail) => {
    fields.push({ key: productDetailFieldKey('label', detail.key), label: `${detail.label} label`, source: detail.label })
    fields.push({ key: productDetailFieldKey('values', detail.key), label: `${detail.label} values`, source: detail.values, kind: 'string-list' })
  })
  return fields
})

const siteLocalizationSettingsPath = computed(() => `/dashboard/${route.params.orgSlug}/sites/${route.params.siteSlug}/settings/localization`)

function localizedProductPath(locale: string): string {
  const row = product.value
  if (!row) throw new Error(`The ${presentation.itemLabel.toLowerCase()} is no longer available.`)
  return `/${locale}${presentation.productPath(String(route.params.locationSlug), row.slug)}`
}

function isProductLocalizationResponse(value: unknown): value is { localization: { values: Record<string, unknown> } } {
  return isRecord(value) && isRecord(value.localization) && isRecord(value.localization.values)
}

async function loadProductLocalization(locale: string): Promise<Record<string, unknown>> {
  try {
    const response = await dashboardApi<{ localization: { values: Record<string, unknown> } }>(
      `/api/editor/sites/${siteId}/localization/product/${productId.value}/${encodeURIComponent(locale)}`,
      { validate: isProductLocalizationResponse },
    )
    const values = { ...response.localization.values }
    const details = Array.isArray(values.details_json) ? values.details_json : []
    for (const detail of details) {
      if (!isRecord(detail) || typeof detail.key !== 'string') continue
      if (typeof detail.label === 'string') values[productDetailFieldKey('label', detail.key)] = detail.label
      if (Array.isArray(detail.values)) values[productDetailFieldKey('values', detail.key)] = detail.values
    }
    return values
  } catch (cause) {
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode === 404) return {}
    throw cause
  }
}

async function saveProductLocalization(locale: string, submitted: Record<string, unknown>): Promise<void> {
  const row = product.value
  if (!row) throw new Error(`The ${presentation.itemLabel.toLowerCase()} is unavailable.`)
  const values: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'tags_json']) {
    if (Object.hasOwn(submitted, key)) values[key] = submitted[key]
  }
  const hasDetailTranslation = row.details.some(detail =>
    Object.hasOwn(submitted, productDetailFieldKey('label', detail.key))
    || Object.hasOwn(submitted, productDetailFieldKey('values', detail.key)))
  if (hasDetailTranslation) {
    values.details_json = row.details.map((detail) => {
      const label = submitted[productDetailFieldKey('label', detail.key)]
      const detailValues = submitted[productDetailFieldKey('values', detail.key)]
      if (typeof label !== 'string' || !label.trim() || !Array.isArray(detailValues) || detailValues.length === 0) {
        throw new Error(`Translate the complete ${detail.label} detail before saving.`)
      }
      return { key: detail.key, label: label.trim(), values: detailValues }
    })
  }
  await dashboardApi(`/api/editor/sites/${siteId}/localization/product/${row.id}/${encodeURIComponent(locale)}`, {
    method: 'PUT',
    body: { values, route_path: localizedProductPath(locale) },
    validate: isProductLocalizationResponse,
  })
}

useSeoMeta({ title: () => `${form.name || presentation.itemLabel} | KrabiClaw Dashboard`, robots: 'noindex, nofollow' })
</script>
