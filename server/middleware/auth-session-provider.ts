import { defineHandler } from 'nitro'
import { getAuthSession } from '~/server/utils/auth'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineHandler((event) => {
  // Keep Better Auth on the original Worker request, where bindings and cookies exist.
  event.context.authSessionProvider = () => getAuthSession(event, cloudflareEnv(event))
})
