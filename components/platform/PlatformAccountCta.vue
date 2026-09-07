<template>
  <span v-if="sessionError" role="alert" class="text-sm text-error">Unable to load account</span>
  <div v-else-if="account" v-bind="$attrs" class="flex items-center gap-2">
    <template v-if="user">
      <NuxtLink :to="postLoginUrl" external class="flex items-center gap-2 no-underline" :aria-label="`Account: ${user.name}`">
        <UAvatar :src="user.image ?? undefined" :alt="user.name" size="sm" />
        <span class="hidden xl:inline max-w-32 truncate text-sm">{{ user.name }}</span>
      </NuxtLink>
      <PlatformButton :to="postLoginUrl" external size="sm">Dashboard</PlatformButton>
    </template>
    <template v-else>
      <NuxtLink to="/login" class="text-sm font-semibold no-underline">Sign in</NuxtLink>
      <PlatformButton :to="to" size="sm">{{ label }}</PlatformButton>
    </template>
  </div>
  <PlatformButton v-else :to="user ? postLoginUrl : to" :external="Boolean(user)" v-bind="$attrs">
    {{ user && !selectedPlan ? 'Dashboard' : label }}
  </PlatformButton>
</template>

<script setup lang="ts">
import { buildPostLoginUrl } from '~/shared/auth/return-target'

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
</script>
