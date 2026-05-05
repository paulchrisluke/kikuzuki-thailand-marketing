import { createAuthClient } from "better-auth/client"

export const authClient = createAuthClient({
  baseURL: process.env.NUXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:8788',
  basePath: '/api/auth'
})
