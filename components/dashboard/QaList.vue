<template>
  <div class="space-y-6">
    <!-- Which page these questions belong to. It was in the navbar, which the
         shell now owns, so it sits with the section it filters. -->
    <div class="flex justify-end">
      <USelect v-model="selectedPagePath" :items="pageScopes" class="w-48" aria-label="Q&A page scope" />
    </div>

  <DashboardListEditor
    v-model:editing="editing"
    title="Q&A"
    description="Manage general questions or questions tailored to a public page."
    :items="listItems"
    :pending="pending"
    :error="qaError ? getErrorMessage(qaError, 'Q&A request failed') : null"
    empty-title="No site Q&A yet"
    empty-icon="i-lucide-circle-help"
    add-label="Add a question"
    reorderable
    :removing-id="removingId"
    @add="openNew"
    @open="openExisting"
    @remove="removeItem"
    @move="move"
  >
    <template #item="{ item }">
      <p class="text-sm font-medium text-highlighted">{{ item.title }}</p>
      <p class="mt-1 line-clamp-2 text-sm text-muted">{{ item.summary }}</p>
    </template>
  </DashboardListEditor>
  </div>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import { getErrorMessage } from '~/utils/errors'
import { isQaDeleted, type QaRow } from '~/utils/site-qa'
const dashboardApi = useDashboardApi()



const route = useRoute()
const siteId = await useDashboardSiteId()
const toast = useToast()
const selectedPagePath = ref('general')

const STANDARD_ROUTES = ['/', '/about', '/services', '/pricing', '/contact', '/schedule', '/blog', '/donate'] as const

const requestEvent = useRequestEvent()
// tenantPages, existingQaScopes, and the main qa query below are independent of
// each other (none reads another's result) — issue them together instead of
// sequentially awaiting each one, which otherwise turns three independent
// requests into a waterfall during SSR.
const tenantPagesAsyncData = useAsyncData(
  () => `dashboard-tenant-pages-${siteId}`,
  async () => {
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const [{ cloudflareEnv }, { getTenantPages }] = await Promise.all([
        import('~/server/utils/api-response'),
        import('~/server/utils/qa-dashboard'),
      ])
      const db = cloudflareEnv(requestEvent).db
      if (!db) throw createError({ statusCode: 500, statusMessage: 'Database not available' })
      return await getTenantPages(db, siteId)
    }
    return await dashboardApi<Array<{ path: string; title: string }>>(
      `/api/editor/sites/${siteId}/tenant-pages`,
      {
        validate: (value): value is Array<{ path: string; title: string }> =>
          Array.isArray(value)
          && value.every(page =>
            isRecord(page)
            && typeof page.path === 'string'
            && typeof page.title === 'string',
          ),
      },
    )
  },
)

const existingQaScopesAsyncData = useAsyncData(
  () => `dashboard-qa-scopes-${siteId}`,
  async () => {
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const [{ cloudflareEnv }, { getQaScopes }] = await Promise.all([
        import('~/server/utils/api-response'),
        import('~/server/utils/qa-dashboard'),
      ])
      const db = cloudflareEnv(requestEvent).db
      if (!db) throw createError({ statusCode: 500, statusMessage: 'Database not available' })
      return await getQaScopes(db, siteId)
    }
    return await dashboardApi<Array<{ page_path: string | null }>>(
      `/api/editor/sites/${siteId}/qa/scopes`,
      {
        validate: (value): value is Array<{ page_path: string | null }> =>
          Array.isArray(value)
          && value.every(scope =>
            isRecord(scope)
            && (scope.page_path === null || typeof scope.page_path === 'string'),
          ),
      },
    )
  },
)

const pagePath = computed(() => selectedPagePath.value === 'general' ? null : selectedPagePath.value)
const qaAsyncData = useAsyncData(
  () => `dashboard-site-qa-${siteId}-${selectedPagePath.value}`,
  async () => {
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const [{ cloudflareEnv }, { getSiteQa }] = await Promise.all([
        import('~/server/utils/api-response'),
        import('~/server/utils/qa-dashboard'),
      ])
      const db = cloudflareEnv(requestEvent).db
      if (!db) throw createError({ statusCode: 500, statusMessage: 'Database not available' })
      const qa = await getSiteQa(db, siteId, pagePath.value)
      return { qa }
    }
    return await dashboardApi<{ qa: QaRow[] }>(
      `/api/editor/sites/${siteId}/qa`,
      {
        query: pagePath.value ? { page_path: pagePath.value } : undefined,
        validate: (value): value is { qa: QaRow[] } =>
          isRecord(value)
          && Array.isArray(value.qa)
          && value.qa.every(item =>
            isRecord(item)
            && typeof item.id === 'string'
            && typeof item.question === 'string'
            && (item.answer === null || typeof item.answer === 'string')
            && (item.status === 'published' || item.status === 'hidden')
            && typeof item.sort_order === 'number'
            && (item.page_path === null || typeof item.page_path === 'string'),
          ),
      },
    )
  },
)

const [
  { data: tenantPages },
  { data: existingQaScopes },
  { data, pending, refresh, error: qaError },
] = await Promise.all([tenantPagesAsyncData, existingQaScopesAsyncData, qaAsyncData])

const pageScopes = computed(() => {
  const scopes = new Map<string, string>()
  scopes.set('general', 'General fallback')

  for (const path of STANDARD_ROUTES) {
    scopes.set(path, path === '/' ? 'Home' : path)
  }

  for (const page of tenantPages.value ?? []) {
    if (page.path && !scopes.has(page.path)) {
      scopes.set(page.path, page.title || page.path)
    }
  }

  for (const scope of existingQaScopes.value ?? []) {
    if (scope.page_path && !scopes.has(scope.page_path)) {
      scopes.set(scope.page_path, scope.page_path)
    }
  }

  return Array.from(scopes.entries()).map(([value, label]) => ({ label, value }))
})
const qaRows = computed(() => data.value?.qa ?? [])
const listItems = computed(() => qaRows.value.map(row => ({
  id: row.id,
  title: row.question,
  summary: row.answer || 'No answer yet.',
})))

const editing = ref(false)
const removingId = ref<string | null>(null)

const qaPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/qa`)

// A question opens its own level rather than a sheet over the list, so the
// record has a URL and adding and editing are the same screen. The page the
// list is filtered to rides along as the new record's intended scope.
function openNew() {
  void navigateTo({ path: `${qaPath.value}/new`, query: pagePath.value ? { page_path: pagePath.value } : undefined })
}

function openExisting(item: { id: string }) {
  void navigateTo(`${qaPath.value}/${item.id}`)
}

async function removeItem(item: { id: string }) {
  removingId.value = item.id
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/qa/${item.id}`, {
      method: 'DELETE',
      query: pagePath.value ? { page_path: pagePath.value } : undefined,
      validate: isQaDeleted,
    })
    await refresh()
  } catch (error) {
    toast.add({ description: error instanceof Error ? error.message : 'Failed to remove question', color: 'error' })
  } finally {
    removingId.value = null
  }
}

async function move(item: { id: string }, direction: -1 | 1) {
  const index = qaRows.value.findIndex(row => row.id === item.id)
  const current = qaRows.value[index]
  const target = qaRows.value[index + direction]
  if (!current || !target) return
  await dashboardApi(`/api/editor/sites/${siteId}/qa/reorder`, {
    method: 'POST',
    body: { page_path: pagePath.value, updates: [{ id: current.id, sort_order: target.sort_order }, { id: target.id, sort_order: current.sort_order }] },
    validate: (value): value is { updated: number } =>
      isRecord(value) && typeof value.updated === 'number',
  })
  await refresh()
}

// Switching scope shows a different list, so the edit state goes with it.
watch(selectedPagePath, () => {
  editing.value = false
})
</script>
