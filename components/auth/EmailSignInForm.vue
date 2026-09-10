<template>
  <form method="post" class="space-y-3" @submit.prevent="submit">
    <UFormField label="Email" name="login-email" size="lg">
      <UInput v-model="email" type="email" placeholder="you@example.com" :disabled="loading" autocomplete="email" size="lg" class="w-full" />
    </UFormField>
    <UFormField label="Password" name="login-password" size="lg">
      <UInput v-model="password" type="password" placeholder="••••••••" :disabled="loading" autocomplete="current-password" size="lg" class="w-full" />
    </UFormField>
    <div class="flex items-center justify-between gap-3 text-sm">
      <NuxtLink to="/forgot-password" class="text-primary font-medium hover:underline no-underline">Forgot password?</NuxtLink>
      <div class="flex items-center gap-2">
        <UBadge v-if="lastUsed" color="primary" variant="soft" size="sm">Last used</UBadge>
        <UButton type="submit" size="lg" :loading="loading">Sign in with email</UButton>
      </div>
    </div>
    <UAlert v-if="error" color="error" variant="soft" :description="error" />
  </form>
</template>

<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { requiresEmailVerification } from '~/shared/auth/email-sign-in'

const props = withDefaults(defineProps<{ callbackUrl: string; initialEmail?: string; lastUsed?: boolean }>(), { initialEmail: '', lastUsed: false })
const emit = defineEmits<{ verificationRequired: [email: string] }>()
const email = ref(props.initialEmail)
const password = ref('')
const { loading, error, run } = useAuthOperation()

async function submit() {
  const normalizedEmail = email.value.trim()
  const result = await run(() => authClient.signIn.email({ email: normalizedEmail, password: password.value, callbackURL: props.callbackUrl }), 'Sign in failed. Please try again.')
  if (result?.error) {
    error.value = result.error.message || 'Sign in failed. Please try again.'
    if (requiresEmailVerification(result.error)) emit('verificationRequired', normalizedEmail)
  }
}
</script>
