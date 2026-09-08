
import { computed, watch } from 'vue'
import { authClient } from '~/lib/auth-client'

export function useAuth() {
  const session = authClient.useSession()

  async function refreshSession() {
    await session.value?.refetch()
  }

  async function waitForSession(sessionId: string) {
    if (session.value.data?.session.id === sessionId) return
    await new Promise<void>((resolve, reject) => {
      const stop = watch(session, (current) => {
        if (!current.error && current.data?.session.id !== sessionId) return
        stop()
        clearTimeout(timeout)
        if (current.error) reject(new Error(current.error.message ?? 'Session refresh failed'))
        else resolve()
      }, { flush: 'sync' })
      const timeout = setTimeout(() => {
        stop()
        reject(new Error('Session change did not complete'))
      }, 15_000)
    })
  }

  const sessionData = computed(() => session.value?.data ?? null)
  const sessionLoading = computed(() => session.value?.isPending ?? true)
  const sessionError = computed(() => session.value?.error ?? null)

  const user = computed(() => sessionData.value?.user ?? null)
  const isAuthenticated = computed(() => !!user.value)

  return {
    session,
    data: sessionData,
    sessionData,
    sessionLoading,
    sessionError,
    user,
    isAuthenticated,
    signOut: authClient.signOut,
    signIn: authClient.signIn,
    refreshSession,
    waitForSession,
  }
}

export const signOutUser = async () => {
  await authClient.signOut()
  await navigateTo('/login')
}
