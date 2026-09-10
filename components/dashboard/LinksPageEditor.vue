<template>
  <!--
    With no section open the links page is the site hub's detail column, so it
    renders its rows and nothing else — no panel, no navbar. It becomes the
    index column only once a section is open.
  -->
  <div v-if="frame.mode.value === 'index'">
    <div v-if="!editorReady" class="space-y-3">
      <USkeleton v-for="index in 5" :key="index" class="h-20 rounded-2xl" />
    </div>
    <EditorNavigationList v-else :groups="navigationGroups" />
  </div>

  <UDashboardPanel v-else-if="!itemId" id="site-links">
    <template #header>
      <UDashboardNavbar title="Links page" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="sitePath" label="Site" />
        </template>
        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-copy"
            :disabled="!publicLinksUrl"
            @click="copyPublicUrl"
          >
            Copy URL
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-external-link"
            :to="publicLinksUrl || undefined"
            target="_blank"
            :disabled="!publicLinksUrl"
          >
            Open
          </UButton>
          <DashboardResourceLocalization
            v-if="form.id"
            :site-id="siteId"
            resource-type="content_document"
            :resource-id="form.id"
            resource-label="links page"
            :fields="linksPageLocalizationFields"
            :load-values="loadLinksLocalization"
            :save-values="saveLinksLocalization"
            :route-path="localizedLinksPath"
            :language-settings-path="siteLocalizationSettingsPath"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        show-actions
        :saving="saving"
        :save-disabled="!sectionValid"
        :detail-title="SECTION_LABELS[editorKey]"
        :hide-detail-heading="editorKey === 'links'"
        :dismiss-to="linksPath"
        @cancel="cancelEditor"
        @save="save"
      >
        <template #index>
          <EditorNavigationList :groups="navigationGroups" :active-item="editorKey" />
        </template>

        <template #detail>
          <UAlert
            v-if="errorMessage"
            class="mb-6"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :description="errorMessage"
          />

          <div v-if="!editorReady" class="space-y-4">
            <USkeleton class="h-10" />
            <USkeleton class="h-14" />
          </div>

          <!-- Title -->
          <UFormField v-else-if="editorKey === 'title'" label="Title" required>
            <UInput v-model="form.title" aria-label="Links page title" size="xl" maxlength="160" autofocus class="w-full" />
          </UFormField>

          <!-- Robots -->
          <UFormField
            v-else-if="editorKey === 'robots'"
            label="Robots"
            description="Whether search engines may index and follow the links page."
          >
            <USelect v-model="form.robots" :items="ROBOTS_OPTIONS" size="xl" class="w-full" />
          </UFormField>

          <!-- SEO title -->
          <UFormField v-else-if="editorKey === 'seo-title'" label="SEO title">
            <UInput v-model="form.seo_title" size="xl" maxlength="200" autofocus class="w-full" />
          </UFormField>

          <!-- SEO description -->
          <UFormField v-else-if="editorKey === 'seo-description'" label="SEO description">
            <UInput v-model="form.seo_description" size="xl" maxlength="500" autofocus class="w-full" />
          </UFormField>

          <!-- Links -->
          <DashboardListEditor
            v-else-if="editorKey === 'links'"
            v-model:editing="editing"
            title="Links"
            description="Add, hide, and reorder the buttons shown on /links."
            :items="listItems"
            empty-title="No links yet"
            empty-icon="i-lucide-link"
            add-label="Add a link"
            reorderable
            @add="openNewItem"
            @open="openItem"
            @remove="removeItem"
            @move="move"
          >
            <template #item="{ item }">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
                <UBadge v-if="item.row.status === 'hidden'" color="neutral" variant="soft" size="sm">hidden</UBadge>
              </div>
              <p class="mt-1 truncate text-sm text-muted">{{ item.row.destination || 'No destination yet' }}</p>
            </template>
          </DashboardListEditor>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <!--
    A link is a record of its own, at `links/links/<id>`, with one leaf per
    field. Adding is the same screen at `links/links/new`, so there is nothing
    a sheet did that a URL does not.
  -->
  <UDashboardPanel v-else id="site-links-item">
    <template #header>
      <UDashboardNavbar :title="isNewItem ? 'New link' : itemForm.label || 'Link'" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="itemsPath" label="Links" />
        </template>
        <template #right>
          <DashboardResourceLocalization
            v-if="itemRecord"
            :site-id="siteId"
            resource-type="content_block"
            :resource-id="itemRecord.id"
            resource-label="link"
            :fields="linkItemLocalizationFields"
            :load-values="locale => loadLinksLocalization(locale, itemId)"
            :save-values="(locale, values) => saveLinksLocalization(locale, values, itemId)"
            :language-settings-path="siteLocalizationSettingsPath"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="Boolean(itemLeaf)"
        :show-actions="Boolean(itemLeaf)"
        :saving="saving"
        :save-disabled="itemSaveDisabled"
        :save-label="itemSaveLabel"
        :detail-title="ITEM_SECTION_LABELS[openItemKey]"
        :dismiss-to="itemPath"
        @cancel="cancelItemEditor"
        @save="saveItemSection"
      >
        <template #index>
          <UAlert
            v-if="errorMessage"
            class="mb-6"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :description="errorMessage"
          />
          <div v-if="!editorReady" class="space-y-3">
            <USkeleton v-for="index in 3" :key="index" class="h-20 rounded-2xl" />
          </div>
          <template v-else>
            <div v-if="isNewItem" class="mb-6 flex justify-end">
              <UButton :label="createItemActionLabel" :loading="saving" @click="startOrCreateItem" />
            </div>
            <EditorNavigationList :groups="itemNavigationGroups" :active-item="itemLeaf" />
          </template>
        </template>

        <template #detail>
          <!-- The record's own values are still in flight; an input bound to the
               empty draft would take a keystroke and then lose it. -->
          <div v-if="!editorReady" class="space-y-4">
            <USkeleton class="h-10" />
            <USkeleton class="h-14" />
          </div>

          <UFormField v-else-if="openItemKey === 'label'" label="Label" required>
            <UInput v-model="itemForm.label" maxlength="120" size="xl" autofocus class="w-full" />
          </UFormField>

          <UFormField v-else-if="openItemKey === 'destination'" label="Destination" required>
            <UInput
              v-model="itemForm.destination"
              placeholder="/reservations or https://example.com"
              maxlength="2048"
              size="xl"
              autofocus
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-else-if="openItemKey === 'status'"
            label="Status"
            description="A hidden link stays on the page's list and off the public page."
          >
            <USelect v-model="itemForm.status" :items="ITEM_STATUS_OPTIONS" size="xl" class="w-full" />
          </UFormField>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import EditorNavigationList, { type EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardResourceLocalization from '~/components/dashboard/DashboardResourceLocalization.vue'

const dashboardApi = useDashboardApi()
const route = useRoute()

type ItemStatus = 'active' | 'hidden'

interface LinksPage {
  id: string
  title: string
  robots: string
  seo_title: string
  seo_description: string
}

interface LinkItem {
  id: string
  label: string
  destination: string
  sort_order: number
  status: ItemStatus
}

interface ApiLinksPage extends Omit<LinksPage, 'seo_title' | 'seo_description'> {
  seo_title: string | null
  seo_description: string | null
}

type ApiLinkItem = LinkItem

const isLinksResponse = (
  value: unknown,
): value is { page: ApiLinksPage; items: ApiLinkItem[] } =>
  isRecord(value)
  && isRecord(value.page)
  && typeof value.page.title === 'string'
  && Array.isArray(value.items)
  && value.items.every(item =>
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.label === 'string'
    && typeof item.destination === 'string'
    && typeof item.sort_order === 'number'
    && typeof item.status === 'string',
  )

// The frame comes first, and before any `await`. `useEditorFrame` provides and
// injects, which Vue only binds to this instance while setup is still
// synchronous; called after an await it silently binds to nothing, the mode
// never resolves, and the server renders an empty node where this should be.
const linksPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/links`)
const frame = useEditorFrame(linksPath)

const siteId = await useDashboardSiteId()
const dashboard = useDashboardSite()
const { sitePaths } = useDashboardSiteLinks()
const toast = useToast()
const saving = ref(false)
const errorMessage = ref('')

const sitePath = computed(() => sitePaths.value?.site ?? '')

// ── Which leaf is open ──────────────────────────────────
// One leaf per field: a leaf edits one concern, and the hub is read by scanning
// what each row currently holds.
const SECTION_KEYS = ['title', 'robots', 'seo-title', 'seo-description', 'links'] as const
type SectionKey = typeof SECTION_KEYS[number]

const SECTION_LABELS: Record<SectionKey, string> = {
  'title': 'Title',
  'robots': 'Robots',
  'seo-title': 'SEO title',
  'seo-description': 'SEO description',
  'links': 'Links',
}

const ITEM_SECTION_LABELS = { label: 'Label', destination: 'Destination', status: 'Status' } as const
type ItemSectionKey = keyof typeof ITEM_SECTION_LABELS

const isSectionKey = (value: string): value is SectionKey => SECTION_KEYS.some(key => key === value)
const isItemSectionKey = (value: string): value is ItemSectionKey => value in ITEM_SECTION_LABELS
const detailKey = computed(() => frame.childSegment.value)
// Only read while a section is open; nothing defaults a section into the pane.
const editorKey = computed<SectionKey>(() => (detailKey.value ?? 'title') as SectionKey)

// ── The link record below the links leaf ────────────────
// `links/links/<id>` and `links/links/<id>/<field>` are two more levels of the
// same chain. This level owns the chrome for both: the leaf above it has
// yielded, so nothing else is drawing a panel around them.
const itemsPath = computed(() => `${linksPath.value}/links`)
const itemId = computed(() => (frame.rest.value[0] === 'links' && frame.rest.value.length > 1 ? String(frame.rest.value[1]) : ''))
const itemLeaf = computed(() => (frame.rest.value.length > 2 ? String(frame.rest.value[2]) : null))
const itemPath = computed(() => `${itemsPath.value}/${itemId.value}`)
const isNewItem = computed(() => itemId.value === 'new')
/** With nothing open the pane still shows the first field rather than empty space. */
const openItemKey = computed<ItemSectionKey>(() => (itemLeaf.value ?? 'label') as ItemSectionKey)

// An unsupported route 404s rather than silently showing the first section. A
// watcher rather than a setup-time check, because moving between leaves reuses
// this component without running setup again.
watchEffect(() => {
  const rest = frame.rest.value
  if (rest.length === 0) return
  if (rest.length === 1) {
    if (!isSectionKey(rest[0]!)) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    return
  }
  if (rest[0] !== 'links' || rest.length > 3 || (rest.length === 3 && !isItemSectionKey(rest[2]!))) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})

const ITEM_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Hidden', value: 'hidden' },
]
const ROBOTS_OPTIONS = [
  { label: 'No index, follow', value: 'noindex,follow' },
  { label: 'Index, follow', value: 'index,follow' },
  { label: 'Index, no follow', value: 'index,nofollow' },
  { label: 'No index, no follow', value: 'noindex,nofollow' },
]
const form = reactive<LinksPage>({
  id: '',
  title: '',
  robots: 'noindex,follow',
  seo_title: '',
  seo_description: '',
})
const items = ref<LinkItem[]>([])
const linksPageLocalizationFields = computed(() => [
  { key: 'title', label: 'Title', source: data.value?.page.title },
  { key: 'seo_title', label: 'SEO title', source: data.value?.page.seo_title },
  { key: 'seo_description', label: 'SEO description', source: data.value?.page.seo_description, multiline: true },
])
const itemRecord = computed(() => data.value?.items.find(item => item.id === itemId.value) ?? null)
const linkItemLocalizationFields = computed(() => [
  { key: 'label', label: 'Label', source: itemRecord.value?.label },
])
const siteLocalizationSettingsPath = computed(() => `/dashboard/${route.params.orgSlug}/sites/${route.params.siteSlug}/settings/localization`)
function localizedLinksPath(locale: string): string {
  return `/${locale}/links`
}

const listItems = computed(() => items.value.map(row => ({
  id: row.id,
  title: row.label || 'Untitled link',
  row,
})))

const editing = ref(false)

/**
 * The record's draft outlives any one leaf: moving between leaves remounts this
 * component, so a plain `reactive` would lose the label on the way to the
 * destination — which is the whole of the create walk.
 */
const emptyItemDraft = () => ({
  label: '',
  destination: '',
  status: 'active' as ItemStatus,
})
const itemForm = useState(`links-item-draft-${siteId}-${itemId.value}`, emptyItemDraft).value

/**
 * `new` is one key for every link ever added here, so leaving that screen has
 * to empty it. Left behind, the next Add opened pre-filled with the last link
 * and reported nothing outstanding, which created a duplicate on one click.
 */
function clearItemDraft() {
  Object.assign(itemForm, emptyItemDraft())
}

// A row and the add control go to the record rather than opening a sheet over
// the list, so a link has an address and adding and editing are one screen.
function openNewItem() {
  void navigateTo(`${itemsPath.value}/new`)
}

function openItem(item: { id: string }) {
  void navigateTo(`${itemsPath.value}/${item.id}`)
}

/**
 * Removing and reordering stay draft edits applied by the Links leaf's own
 * Save, which is what this list has always meant by an edit.
 */
function removeItem(item: { id: string }) {
  items.value = items.value
    .filter(entry => entry.id !== item.id)
    .map((entry, sortOrder) => ({ ...entry, sort_order: sortOrder }))
}

function move(item: { id: string }, direction: -1 | 1) {
  const index = items.value.findIndex(entry => entry.id === item.id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(nextIndex, 0, moved)
  items.value = next.map((entry, sortOrder) => ({ ...entry, sort_order: sortOrder }))
}

const { data, pending } = await useAsyncData(
  `links-page-editor-${siteId}`,
  () => dashboardApi<{ page: ApiLinksPage; items: ApiLinkItem[] }>(
    `/api/editor/sites/${siteId}/links-page`,
    { validate: isLinksResponse },
  ),
  { server: false },
)

interface LinksTranslation {
  title: string | null
  seo_title: string | null
  seo_description: string | null
  updated_at: string
  content_blocks: Array<{ id?: string; source_block_id: string | null; type: 'cta'; data: Record<string, unknown> }>
}
const linkLocalizationStates = new Map<string, { locale: string; translation: LinksTranslation | null }>()
const linkLocalizationGenerations = new Map<string, number>()
function isLinksTranslation(value: unknown): value is { localization: LinksTranslation } {
  return isRecord(value) && isRecord(value.localization) && typeof value.localization.updated_at === 'string' && Array.isArray(value.localization.content_blocks)
}
async function loadLinksLocalization(locale: string, linkItemId?: string): Promise<Record<string, unknown>> {
  const key = linkItemId ?? form.id
  const generation = (linkLocalizationGenerations.get(key) ?? 0) + 1
  linkLocalizationGenerations.set(key, generation)
  let translation: LinksTranslation | null = null
  try {
    const response = await dashboardApi<{ localization: LinksTranslation }>(
      `/api/editor/sites/${siteId}/localization/content_document/${form.id}/${encodeURIComponent(locale)}`, { validate: isLinksTranslation })
    translation = response.localization
  } catch (cause) {
    if (!isRecord(cause) || cause.statusCode !== 404) throw cause
  }
  if (generation !== linkLocalizationGenerations.get(key)) return {}
  linkLocalizationStates.set(key, { locale, translation })
  if (linkItemId) return { label: translation?.content_blocks.find(block => block.source_block_id === linkItemId)?.data.label }
  return { title: translation?.title, seo_title: translation?.seo_title, seo_description: translation?.seo_description }
}
async function saveLinksLocalization(locale: string, submitted: Record<string, unknown>, linkItemId?: string): Promise<void> {
  const key = linkItemId ?? form.id
  const state = linkLocalizationStates.get(key)
  if (!state || state.locale !== locale) throw new Error('Choose the language again before saving.')
  const values = { title: state.translation?.title ?? null, seo_title: state.translation?.seo_title ?? null, seo_description: state.translation?.seo_description ?? null }
  let blocks = structuredClone(state.translation?.content_blocks ?? [])
  if (linkItemId) {
    const existing = blocks.find(block => block.source_block_id === linkItemId)
    const label = typeof submitted.label === 'string' ? submitted.label.trim() : ''
    blocks = blocks.filter(block => block.source_block_id !== linkItemId)
    if (label) blocks.push({ id: existing?.id, source_block_id: linkItemId, type: 'cta', data: { label } })
  } else {
    for (const field of ['title', 'seo_title', 'seo_description'] as const) values[field] = typeof submitted[field] === 'string' ? submitted[field] : null
  }
  const response = await dashboardApi<{ localization: LinksTranslation }>(
    `/api/editor/sites/${siteId}/localization/content_document/${form.id}/${encodeURIComponent(locale)}`, {
      method: 'PUT', body: { values, route_path: `/${locale}/links`, content_blocks: blocks,
        ...(state.translation ? { expected_updated_at: state.translation.updated_at } : {}) }, validate: isLinksTranslation,
    })
  linkLocalizationStates.set(key, { locale, translation: response.localization })
}

function loadForm(value: { page: ApiLinksPage; items: ApiLinkItem[] }) {
  Object.assign(form, {
    ...value.page,
    seo_title: value.page.seo_title ?? '',
    seo_description: value.page.seo_description ?? '',
  })
  items.value = value.items
}

let openedLocalizationTarget = ''
watch(data, (value) => {
  if (!value) return
  loadForm(value)
  const target = typeof route.query.localize === 'string' ? route.query.localize : ''
  if (target.startsWith('content_block:') && target !== openedLocalizationTarget) {
    const item = value.items.find(row => target === `content_block:${row.id}`)
    if (item) {
      openedLocalizationTarget = target
      void navigateTo(`${itemsPath.value}/${item.id}`)
    }
  }
}, { immediate: true })

function loadItemForm(row: LinkItem) {
  itemForm.label = row.label
  itemForm.destination = row.destination
  itemForm.status = row.status
}

watch(itemRecord, (row) => {
  if (row) loadItemForm(row)
}, { immediate: true })

// `pending` is the only signal needed: the fetch is client-only, so it is true
// through SSR and the first paint and false once the rows have data.
const editorReady = computed(() => !pending.value)
const sectionValid = computed(() => editorKey.value !== 'title' || Boolean(form.title.trim()))
const publicLinksUrl = computed(() => {
  const base = dashboard.site.value?.public_url || ''
  return base ? `${base.replace(/\/+$/, '')}/links` : ''
})

// ── The hub ─────────────────────────────────────────────
const robotsLabel = computed(() => ROBOTS_OPTIONS.find(option => option.value === form.robots)?.label ?? form.robots)

function linksSummary(): string {
  if (!items.value.length) return 'No links yet'
  const hidden = items.value.filter(item => item.status === 'hidden').length
  const active = items.value.length - hidden
  const parts = [`${active} active`]
  if (hidden) parts.push(`${hidden} hidden`)
  return parts.join(' · ')
}

const navigationGroups = computed<EditorNavigationGroup[]>(() => [
  {
    id: 'page',
    items: [
      { id: 'title', label: 'Title', summary: form.title || 'Not named yet', placeholder: !form.title, to: `${linksPath.value}/title` },
      { id: 'links', label: 'Links', summary: linksSummary(), placeholder: !items.value.length, to: `${linksPath.value}/links` },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    items: [
      { id: 'robots', label: 'Robots', summary: robotsLabel.value, to: `${linksPath.value}/robots` },
      { id: 'seo-title', label: 'SEO title', summary: form.seo_title || 'Falls back to the title', placeholder: !form.seo_title, to: `${linksPath.value}/seo-title` },
      {
        id: 'seo-description',
        label: 'SEO description',
        summary: form.seo_description || 'Nothing written yet',
        placeholder: !form.seo_description,
        to: `${linksPath.value}/seo-description`,
      },
    ],
  },
])

const itemNavigationGroups = computed<EditorNavigationGroup[]>(() => [
  {
    id: 'link',
    items: [
      { id: 'label', label: 'Label', summary: itemForm.label.trim() || 'Not named yet', placeholder: !itemForm.label.trim(), to: `${itemPath.value}/label` },
      { id: 'destination', label: 'Destination', summary: itemForm.destination.trim() || 'No destination yet', placeholder: !itemForm.destination.trim(), to: `${itemPath.value}/destination` },
      { id: 'status', label: 'Status', summary: itemForm.status === 'hidden' ? 'Hidden' : 'Active', to: `${itemPath.value}/status` },
    ],
  },
])

/**
 * Creating walks the fields the endpoint will not accept empty, naming where it
 * is going, and saves once nothing is outstanding. Status has a default, so the
 * walk never stops on it.
 */
const REQUIRED_ORDER: ItemSectionKey[] = ['label', 'destination']
const outstanding = computed(() => REQUIRED_ORDER.filter(key => !itemForm[key].trim()))
const nextOutstanding = computed(() => outstanding.value.find(key => key !== openItemKey.value) ?? null)

const createItemActionLabel = computed(() => {
  const next = outstanding.value[0]
  return next ? `Start with ${ITEM_SECTION_LABELS[next]}` : 'Create link'
})

function startOrCreateItem() {
  const next = outstanding.value[0]
  if (next) return void navigateTo(`${itemPath.value}/${next}`)
  void saveItemSection()
}

const openItemSectionIncomplete = computed(() => outstanding.value.includes(openItemKey.value))
// A new record's Save advances the walk, so only the open field has to be
// filled in. An existing one is being saved outright: a required field cleared
// on another leaf would otherwise go back empty and read as "Untitled link".
const itemSaveDisabled = computed(() => saving.value || !editorReady.value
  || (isNewItem.value ? openItemSectionIncomplete.value : outstanding.value.length > 0))

const itemSaveLabel = computed(() => {
  if (!isNewItem.value) return undefined
  return nextOutstanding.value ? `Next: ${ITEM_SECTION_LABELS[nextOutstanding.value]}` : 'Create link'
})

// ── Save / cancel ───────────────────────────────────────
async function copyPublicUrl() {
  if (!publicLinksUrl.value) return
  try {
    await navigator.clipboard.writeText(publicLinksUrl.value)
    toast.add({ description: 'Links page URL copied', color: 'success' })
  } catch {
    toast.add({ description: 'Unable to copy the links page URL', color: 'error' })
  }
}

/**
 * The page and its links are one document behind one endpoint, so a link's own
 * Save sends the page beside it. The response is the document as stored, which
 * is where a newly created link picks up its id.
 */
async function persist(nextItems: LinkItem[]) {
  const response = await dashboardApi<{ page: ApiLinksPage; items: ApiLinkItem[] }>(`/api/editor/sites/${siteId}/links-page`, {
    method: 'PATCH',
    body: {
      page: {
        title: form.title,
        robots: form.robots,
        seo_title: form.seo_title,
        seo_description: form.seo_description,
      },
      items: nextItems.map((item, index) => ({
        id: item.id,
        label: item.label,
        destination: item.destination,
        sort_order: index,
        status: item.status,
      })),
    },
    validate: isLinksResponse,
  })
  data.value = response
  return response
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  try {
    await persist(items.value)
    toast.add({ description: 'Links page saved', color: 'success' })
    await navigateTo(linksPath.value)
  } catch (error) {
    errorMessage.value = error instanceof ApiClientError
      ? error.message
      : error instanceof Error ? error.message : 'Unable to save links page'
    toast.add({ description: errorMessage.value, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function saveItemSection() {
  if (itemSaveDisabled.value) return
  if (isNewItem.value && nextOutstanding.value) {
    await navigateTo(`${itemPath.value}/${nextOutstanding.value}`)
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const known = new Set(items.value.map(item => item.id))
    const nextItems: LinkItem[] = isNewItem.value
      ? [...items.value, {
          id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label: itemForm.label,
          destination: itemForm.destination,
          sort_order: items.value.length,
          status: itemForm.status,
        }]
      : items.value.map(item => item.id === itemId.value
        ? { ...item, label: itemForm.label, destination: itemForm.destination, status: itemForm.status }
        : item)
    const response = await persist(nextItems)
    if (isNewItem.value) {
      const created = response.items.find(item => !known.has(item.id))
      clearItemDraft()
      toast.add({ description: 'Link created', color: 'success' })
      await navigateTo(created ? `${itemsPath.value}/${created.id}` : itemsPath.value)
      return
    }
    toast.add({ description: `${ITEM_SECTION_LABELS[openItemKey.value]} saved`, color: 'success' })
    await navigateTo(itemPath.value)
  } catch (error) {
    errorMessage.value = error instanceof ApiClientError
      ? error.message
      : error instanceof Error ? error.message : 'Unable to save link'
  } finally {
    saving.value = false
  }
}

/** Dismissing a leaf discards its draft, matching the settings sheets. */
async function cancelEditor() {
  errorMessage.value = ''
  if (data.value) loadForm(data.value)
  await navigateTo(linksPath.value)
}

function cancelItemEditor() {
  errorMessage.value = ''
  if (isNewItem.value) {
    clearItemDraft()
    void navigateTo(itemsPath.value)
    return
  }
  const row = itemRecord.value
  if (row) loadItemForm(row)
  void navigateTo(itemPath.value)
}

useSeoMeta({ title: 'Links page | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
