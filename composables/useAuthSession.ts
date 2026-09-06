import { authClient } from '~/lib/auth-client'

type Session = typeof authClient.$Infer.Session

export async function useAuthSession() {
  const nuxtApp = useNuxtApp()
  if (import.meta.client) {
    const { data } = useNuxtData<{ session: Session | null }>('auth-session')
    if (nuxtApp.isHydrating && data.value) authClient.hydrateSession(data.value.session)
    const session = authClient.useSession()
    return {
      sessionData: computed(() => session.value.data),
      user: computed(() => session.value.data?.user ?? null),
      isAuthenticated: computed(() => Boolean(session.value.data?.user)),
      sessionLoading: computed(() => session.value.isPending),
      sessionError: computed(() => session.value.error),
    }
  }
  const event = useRequestEvent()
  const result = await useAsyncData('auth-session', async () => {
    const provider = event?.context.authSessionProvider as (() => Promise<Session | null>) | undefined
    if (!provider) throw createError({ statusCode: 500, statusMessage: 'Auth session provider unavailable' })
    return { session: await provider() }
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
