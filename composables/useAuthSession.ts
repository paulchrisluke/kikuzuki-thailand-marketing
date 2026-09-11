import { authClient } from '~/lib/auth-client'

type Session = typeof authClient.$Infer.Session

/** The payload key the session is fetched under, so it can be refetched by name. */
const AUTH_SESSION_KEY = 'auth-session'

/**
 * The session, on the server and the client, through Better Auth's own Nuxt
 * support: its Vue client's `useSession` takes Nuxt's `useFetch` and does the
 * SSR fetch, the hydration and the re-fetch on session change itself
 * (better-auth/dist/client/vue/index.mjs — it calls
 * `useFetch(baseURL + '/get-session', { ref: $sessionSignal })`).
 *
 * This used to be hand-rolled: a server middleware that hung a session provider
 * on the request context, a useAsyncData around it, and a manual
 * hydrateSession() on the client. That was a second implementation of a
 * documented API.
 */
export async function useAuthSession() {
  // The server render has to carry the browser's cookie. BETTER_AUTH_URL is
  // absolute, so Better Auth asks for an absolute /get-session, and Nuxt only
  // forwards request headers to internal (relative) calls — without this the
  // session resolved to null on the server and every signed-in field appeared
  // only after hydration.
  // useFetch is called through a narrowed signature: inferring its own types
  // against Better Auth's session shape and Nitro's typed route table together
  // hits "type instantiation is excessively deep".
  // Better Auth still owns the request — its own URL, its own session signal.
  // This only wraps useFetch to add the cookie, and narrows useFetch's type on
  // the way through: inferring its generics against Better Auth's session shape
  // and Nitro's typed route table together hits "type instantiation is
  // excessively deep".
  const cookieAwareFetch = ((url: string, options?: Record<string, unknown>) =>
    (useFetch as unknown as (u: string, o: Record<string, unknown>) => unknown)(url, {
      ...options,
      // An explicit key, because useFetch derives one from the url *and the
      // options*: the cookie header is only present on the server, so the
      // generated keys differed and the client missed the SSR payload and
      // hydrated against an empty session.
      key: AUTH_SESSION_KEY,
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })) as never

  const { data, error, isPending } = await authClient.useSession(cookieAwareFetch) as {
    data: Ref<Session | null>
    error: Ref<unknown>
    isPending: boolean
  }
  const sessionData = computed(() => data.value ?? null)
  const user = computed(() => sessionData.value?.user ?? null)
  return {
    sessionData,
    user,
    isAuthenticated: computed(() => Boolean(user.value)),
    sessionLoading: computed(() => isPending),
    sessionError: computed(() => error.value ?? null),
    /**
     * Re-read the session after an operation that changed it — signing in,
     * switching organization, starting or stopping impersonation. Nuxt refetches
     * the keyed payload; nothing here watches or polls for the change.
     */
    refresh: () => refreshNuxtData(AUTH_SESSION_KEY),
  }
}
