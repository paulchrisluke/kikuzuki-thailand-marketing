import { authClient } from '~/lib/auth-client'

type Session = typeof authClient.$Infer.Session

export async function useAuthSession() {
  const event = useRequestEvent()
  const result = await useAsyncData('auth-session', async () => {
    if (import.meta.server) {
      const provider = event?.context.authSessionProvider as (() => Promise<Session | null>) | undefined
      if (!provider) throw createError({ statusCode: 500, statusMessage: 'Auth session provider unavailable' })
      return { session: await provider() }
    }
    const response = await authClient.getSession()
    if (response.error) throw createError({ statusCode: response.error.status, statusMessage: response.error.message })
    // Keep the envelope non-null so an anonymous SSR result also hydrates without a refetch.
    return { session: response.data }
  })
  const sessionData = computed(() => result.data.value?.session ?? null)
  const user = computed(() => sessionData.value?.user ?? null)
  return {
    sessionData,
    user,
    isAuthenticated: computed(() => Boolean(user.value)),
    sessionLoading: computed(() => result.status.value === 'pending'),
    sessionError: computed(() => result.error.value ?? null),
  }
}
