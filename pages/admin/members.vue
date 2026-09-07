<template>
  <UDashboardPanel id="admin-members">
    <template #header>
      <UDashboardNavbar title="Team Members">
        <template #trailing>
          <UButton size="sm" icon="i-lucide-user-plus" label="Add team member" @click="inviteOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-[var(--ws-page-narrow,45rem)] space-y-3">
        <div class="flex items-end justify-between gap-3">
          <div><h2 class="font-semibold text-highlighted">KrabiClaw Team</h2><p class="mt-1 text-sm text-muted">Platform admins with full access.</p></div>
          <UBadge :label="`${team.length}`" color="neutral" variant="soft" />
        </div>
        <UCard v-if="membersLoading" variant="subtle"><div class="space-y-3"><USkeleton v-for="index in 3" :key="index" class="h-16 rounded-lg" /></div></UCard>
        <UAlert v-else-if="membersError" color="error" variant="soft" :description="membersError" />
        <UCard v-else-if="team.length === 0" variant="subtle"><p class="text-sm text-muted">No platform team members.</p></UCard>
        <EditorNavigationList v-else :groups="memberGroups" variant="rows" />
      </div>
    </template>
  </UDashboardPanel>

  <DashboardListItemDialog
    v-model:open="inviteOpen"
    title="Add team member"
    save-label="Add to team"
    :saving="invitingTeam"
    :save-disabled="!teamInviteEmail.trim()"
    @save="inviteTeamMember"
  >
    <p class="text-sm text-muted">Give a colleague platform administrator access.</p>
    <UFormField label="Email" required><UInput v-model="teamInviteEmail" type="email" placeholder="name@email.com" class="w-full" @keyup.enter="inviteTeamMember" /></UFormField>
    <UFormField label="Name"><UInput v-model="teamInviteName" placeholder="Optional" class="w-full" @keyup.enter="inviteTeamMember" /></UFormField>
    <UAlert v-if="teamInviteResult" :color="teamInviteResult.error ? 'error' : 'success'" variant="soft" :description="teamInviteResult.message" />
  </DashboardListItemDialog>
</template>

<script setup lang="ts">
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'
import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Members | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()

interface TeamMember { id: string; name: string | null; email: string; image: string | null; role: string; createdAt: string }

const team = ref<TeamMember[]>([])
const inviteOpen = ref(false)
const membersLoading = ref(false)
const membersError = ref('')
const teamInviteEmail = ref('')
const teamInviteName = ref('')
const invitingTeam = ref(false)
const teamInviteResult = ref<{ error?: boolean; message: string } | null>(null)
const memberGroups = computed<EditorNavigationGroup[]>(() => [{
  id: 'team',
  items: team.value.map(member => ({ id: member.id, label: member.name || 'Unnamed team member', summary: member.email, to: `/admin/users/${encodeURIComponent(member.id)}` })),
}])

const isMembersResponse = (value: unknown): value is { team: TeamMember[] } =>
  isRecord(value)
  && Array.isArray(value.team)
  && value.team.every(member =>
    isRecord(member) && typeof member.id === 'string' && typeof member.email === 'string'
    && (member.name === null || typeof member.name === 'string')
    && (member.image === null || typeof member.image === 'string')
    && typeof member.role === 'string' && typeof member.createdAt === 'string',
  )
const isTeamInviteResponse = (value: unknown): value is { action: string; email: string } =>
  isRecord(value) && typeof value.action === 'string' && typeof value.email === 'string'

watch(inviteOpen, (open) => {
  if (open) teamInviteResult.value = null
})

async function loadMembers() {
  membersLoading.value = true
  membersError.value = ''
  try {
    const res = await applicationFetch<{ team: TeamMember[] }>('/api/admin/members', { validate: isMembersResponse })
    team.value = res.team
  } catch {
    membersError.value = 'Failed to load team members.'
  } finally {
    membersLoading.value = false
  }
}

async function inviteTeamMember() {
  const email = teamInviteEmail.value.trim()
  if (!email) return
  invitingTeam.value = true
  teamInviteResult.value = null
  try {
    const res = await applicationFetch<{ action: string; email: string }>('/api/admin/invite/team', {
      method: 'POST',
      body: { email, name: teamInviteName.value.trim() || undefined },
      validate: isTeamInviteResponse,
    })
    const verb = res.action === 'promoted' ? 'promoted to admin' : 'created as admin'
    teamInviteResult.value = { message: `${res.email} ${verb}` }
    teamInviteEmail.value = ''
    teamInviteName.value = ''
    await loadMembers()
    inviteOpen.value = false
    toast.add({ title: 'Team member added', color: 'success' })
  } catch (err: unknown) {
    teamInviteResult.value = { error: true, message: getErrorMessage(err, 'Failed to add team member') }
  } finally {
    invitingTeam.value = false
  }
}

onMounted(loadMembers)
</script>
