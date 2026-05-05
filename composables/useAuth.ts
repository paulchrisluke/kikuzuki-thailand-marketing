import { createAuthClient } from 'better-auth/client'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8788',
  plugins: [organizationClient()]
})

// Compatibility wrappers if needed, but better to use authClient directly
export const useAuth = () => {
  return authClient.useSession()
}

export const signOut = async () => {
  await authClient.signOut()
  await navigateTo('/login')
}

export const signInWithGoogle = async (callbackURL?: string) => {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: callbackURL || '/dashboard'
  })
}
