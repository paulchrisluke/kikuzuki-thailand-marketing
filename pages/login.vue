<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Sign in</h1>

    <UAlert v-if="notice" color="success" variant="soft" :description="notice" class="mt-4" />
    <UAlert v-if="operationError" color="error" variant="soft" :description="operationError" class="mt-4" />

    <div v-if="rememberedProfile && showRememberedProfile" class="mt-8 space-y-5">
      <PlatformButton variant="outline" size="xl" block :loading="googleLoading" class="min-h-20 text-left" @click="continueRememberedProfile">
        <PlatformGoogleIcon v-if="rememberedProfile.method === 'google'" class="size-6 shrink-0" />
        <UIcon v-else :name="rememberedProfile.method === 'email' ? 'i-lucide-mail' : 'i-lucide-message-circle'" class="size-6 shrink-0" />
        <span class="min-w-0 flex-1 truncate">{{ rememberedProfile.identifier }}</span>
        <UBadge color="primary" variant="soft" class="shrink-0">Last used</UBadge>
        <UIcon name="i-lucide-arrow-right" class="size-5 shrink-0" />
      </PlatformButton>
      <USeparator label="or" />
      <UButton block size="xl" @click="chooseAnotherProfile">Log in with another profile</UButton>
      <UButton block color="neutral" variant="link" size="sm" @click="forgetProfile">Forget this profile</UButton>
    </div>

    <AuthPhoneOtpForm v-else-if="isWhatsAppMode" default-country="TH" class="mt-6" @verified="finishPhoneSignIn" />

    <div v-else class="mt-6 space-y-3">
      <template v-if="!selectedProfile">
        <AuthGoogleAuthButton :loading="googleLoading" @activate="signInWithGoogle(postLoginUrl)" />
        <WhatsAppAuthButton @activate="showPhone = !showPhone" />
        <AuthPhoneOtpForm v-if="showPhone" default-country="TH" @verified="finishPhoneSignIn" />
        <USeparator label="or" />
      </template>
      <AuthPhoneOtpForm v-if="selectedProfile?.method === 'whatsapp'" :fixed-phone="selectedProfile.identifier" @verified="finishPhoneSignIn" />
      <AuthEmailSignInForm v-else :key="emailForSignIn" :callback-url="postLoginUrl" :initial-email="emailForSignIn" @verification-required="showVerification" />

      <UButton v-if="selectedProfile" block color="neutral" variant="ghost" @click="chooseAnotherProfile">Log in with another profile</UButton>

      <UAlert v-if="verificationEmail" color="neutral" variant="soft" description="Verify your email before signing in.">
        <template #actions>
          <UButton variant="outline" :loading="resending" @click="resendVerification">Resend verification</UButton>
        </template>
      </UAlert>
    </div>

    <p v-if="!isWhatsAppMode" class="mt-6 text-center text-sm text-muted">Don't have an account? <NuxtLink :to="signupUrl" class="font-semibold text-primary">Sign up</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import WhatsAppAuthButton from '~/components/auth/WhatsAppAuthButton.vue'
import { LAST_LOGIN_METHOD_COOKIE, REMEMBERED_PROFILE_COOKIE, readRememberedProfile } from '~/shared/auth/remembered-profile'
import { authClient } from '~/lib/auth-client'
import { buildPostLoginUrl, validatedInternalPath } from '~/shared/auth/return-target'

definePageMeta({ layout: 'access', auth: false })
useSeoMeta({ robots: 'noindex, nofollow' })

const route = useRoute()
const queryEmail = typeof route.query.email === 'string' ? route.query.email : ''
const isWhatsAppMode = computed(() => route.query.mode === 'whatsapp')
const redirect = computed(() => validatedInternalPath(route.query.redirect))
const postLoginUrl = computed(() => buildPostLoginUrl({ redirect: redirect.value }))
const signupUrl = computed(() => redirect.value ? { path: '/signup', query: { redirect: redirect.value } } : '/signup')
const showPhone = ref(false)
const lastMethod = useCookie<string | null>(LAST_LOGIN_METHOD_COOKIE)
const lastIdentifier = useCookie<string | null>(REMEMBERED_PROFILE_COOKIE)
const rememberedProfile = computed(() => readRememberedProfile(lastMethod.value, lastIdentifier.value))
const showRememberedProfile = ref(!isWhatsAppMode.value && !queryEmail && !route.query.signup && !route.query.verified && !route.query.reset)
const selectedProfile = ref<ReturnType<typeof readRememberedProfile>>(null)
const emailForSignIn = computed(() => selectedProfile.value?.method === 'email' ? selectedProfile.value.identifier : queryEmail)

function chooseAnotherProfile() {
  showRememberedProfile.value = false
  selectedProfile.value = null
  showPhone.value = false
}

function forgetProfile() {
  lastMethod.value = null
  lastIdentifier.value = null
  chooseAnotherProfile()
}

async function continueRememberedProfile() {
  const profile = rememberedProfile.value
  if (!profile) return
  if (profile.method === 'google') {
    await signInWithGoogle(postLoginUrl.value, profile.identifier)
    return
  }
  selectedProfile.value = profile
  showRememberedProfile.value = false
}

const verificationEmail = ref('')
const resending = ref(false)
const notice = ref<string | null>(null)
const operationError = ref<string | null>(null)
const { loading: googleLoading, error: googleError, signInWithGoogle } = useAuthOperation()
watch(googleError, value => { operationError.value = value })

if (route.query.signup === 'success') notice.value = queryEmail ? `Check ${queryEmail} to verify your email.` : 'Check your email to verify your account.'
else if (route.query.verified === '1') notice.value = 'Your email is verified. You can sign in now.'
else if (route.query.reset === 'success') notice.value = 'Your password was updated. Sign in with your new password.'

const { isAuthenticated } = await useAuthSession()
if (isAuthenticated.value) await navigateTo(postLoginUrl.value, { external: true })

function finishPhoneSignIn() {
  window.location.href = postLoginUrl.value
}

function showVerification(email: string) {
  verificationEmail.value = email
}

async function resendVerification() {
  if (!verificationEmail.value || resending.value) return
  resending.value = true
  operationError.value = null
  try {
    const result = await authClient.sendVerificationEmail({ email: verificationEmail.value, callbackURL: `${window.location.origin}/login?verified=1` })
    if (result?.error) operationError.value = result.error.message || 'Could not resend verification email.'
    else notice.value = `If ${verificationEmail.value} is registered, a fresh verification email is on the way.`
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Could not resend verification email.'
  } finally {
    resending.value = false
  }
}
</script>
