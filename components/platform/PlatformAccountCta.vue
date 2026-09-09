<template>
  <span v-if="sessionError" role="alert" class="text-sm text-error">Unable to load account</span>
  <div v-else-if="account" v-bind="$attrs" class="flex items-center gap-2">
    <!-- Signed in: the avatar is the whole control, the way it is on every
         consumer app an owner already uses. No label, because a word in English
         is not something a Thai-speaking owner can act on; their own face is. -->
    <details v-if="user" ref="accountMenu" class="relative">
      <summary
        class="flex cursor-pointer list-none items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
        :aria-label="`Account: ${user.name}`"
      >
        <UAvatar :src="user.image ?? undefined" :alt="user.name" size="sm" />
      </summary>
      <div class="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-default bg-default p-1.5 shadow-xl">
        <div class="flex items-center gap-2.5 rounded-xl px-3 py-2">
          <UAvatar :src="user.image ?? undefined" :alt="user.name" size="sm" />
          <div class="min-w-0">
            <div class="truncate text-[13px] font-semibold text-default">{{ user.name }}</div>
            <div class="truncate text-[11px] text-muted">{{ user.email }}</div>
          </div>
        </div>
        <NuxtLink :to="postLoginUrl" external class="block rounded-xl px-3 py-2 text-[13px] font-medium text-default no-underline transition-colors hover:bg-muted" @click="closeMenu">
          Dashboard
        </NuxtLink>
        <NuxtLink to="/dashboard/account/profile" class="block rounded-xl px-3 py-2 text-[13px] font-medium text-default no-underline transition-colors hover:bg-muted" @click="closeMenu">
          Account settings
        </NuxtLink>
        <button type="button" class="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-[13px] font-medium text-default transition-colors hover:bg-muted" @click="signOut">
          Log out
        </button>
      </div>
    </details>
    <!-- Signed out but recognised: the loud button belongs to the account they
         already have. Leading with "Start free" is what walked a returning owner
         into a second account when she could not read either label. -->
    <template v-else-if="remembered">
      <NuxtLink :to="to" class="text-sm font-semibold no-underline">{{ label }}</NuxtLink>
      <PlatformButton to="/login" size="md" :aria-label="`Sign in as ${remembered.name ?? remembered.identifier}`">
        <UAvatar v-if="remembered.image" :src="remembered.image" :alt="remembered.name ?? ''" size="2xs" />
        <PlatformGoogleIcon v-else-if="remembered.method === 'google'" class="size-4 shrink-0" />
        <UIcon v-else :name="remembered.method === 'email' ? 'i-lucide-mail' : 'i-lucide-message-circle'" class="size-4 shrink-0" />
        <span class="max-w-40 truncate">{{ remembered.name ?? remembered.identifier }}</span>
      </PlatformButton>
    </template>
    <template v-else>
      <NuxtLink to="/login" class="text-sm font-semibold no-underline">Sign in</NuxtLink>
      <PlatformButton :to="to" size="sm">{{ label }}</PlatformButton>
    </template>
  </div>
  <PlatformButton
    v-else
    :to="inlineTarget"
    :external="Boolean(user)"
    :aria-label="remembered && !user ? `Sign in as ${remembered.identifier}` : undefined"
    v-bind="$attrs"
  >
    <span class="max-w-56 truncate">{{ inlineLabel }}</span>
  </PlatformButton>
</template>

<script setup lang="ts">
import { buildPostLoginUrl } from '~/shared/auth/return-target'
import { LAST_LOGIN_METHOD_COOKIE, REMEMBERED_PROFILE_COOKIE, readRememberedProfile } from '~/shared/auth/remembered-profile'
import { signOutUser } from '~/composables/useAuth'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ account?: boolean, to?: string, label?: string }>(), {
  account: false,
  to: '/signup',
  label: 'Start free',
})
// The canonical Better Auth session is shared and hydrated from the Nuxt payload.
const { user, sessionError } = await useAuthSession()
const selectedPlan = computed(() => new URL(props.to, 'https://krabiclaw.internal').searchParams.get('plan'))
const postLoginUrl = computed(() => buildPostLoginUrl({ plan: selectedPlan.value ?? undefined }))

// Display-only browser hints. They never establish identity or authorize a
// request; /login still requires the full credential.
const lastMethod = useCookie<string | null>(LAST_LOGIN_METHOD_COOKIE)
const lastIdentifier = useCookie<string | null>(REMEMBERED_PROFILE_COOKIE)
const remembered = computed(() => readRememberedProfile(lastMethod.value, lastIdentifier.value))

const accountMenu = ref<HTMLDetailsElement | null>(null)
function closeMenu() {
  if (accountMenu.value) accountMenu.value.open = false
}
async function signOut() {
  closeMenu()
  await signOutUser()
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!accountMenu.value?.open) return
  if (!accountMenu.value.contains(event.target as Node)) closeMenu()
}
function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})

const inlineTarget = computed(() => {
  if (user.value) return postLoginUrl.value
  // A plan-carrying CTA is a purchase intent, so it keeps its own destination.
  return remembered.value && !selectedPlan.value ? '/login' : props.to
})
const inlineLabel = computed(() => {
  if (user.value) return selectedPlan.value ? props.label : 'Dashboard'
  if (!remembered.value || selectedPlan.value) return props.label
  return remembered.value.name ?? remembered.value.identifier
})
</script>
