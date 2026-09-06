// Signs the local developer in by navigating to a URL, so a browser-driving
// agent or a fresh profile does not have to retype the password local:setup
// printed. Better Auth still performs the sign-in: this route only supplies
// the credential the machine already generated, and forwards its cookies.
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { assertDevRouteAllowed } from '~/server/utils/dev-route-auth'
import { createAuth } from '~/server/utils/auth'
import { defineHandler } from 'nitro'
import { getQuery } from 'nitro/h3'

export default defineHandler(async (event) => {
  assertDevRouteAllowed(event)
  const env = cloudflareEnv(event)

  // Read from the environment rather than config/development-auth-fixtures: that
  // module belongs to scripts and tests, and server code is linted away from it.
  const email = typeof env.LOCAL_DEVELOPER_EMAIL === 'string' ? env.LOCAL_DEVELOPER_EMAIL.trim() : ''
  const password = typeof env.LOCAL_DEVELOPER_PASSWORD === 'string' ? env.LOCAL_DEVELOPER_PASSWORD.trim() : ''
  if (!email || !password) {
    return jsonResponse({
      error: 'LOCAL_DEVELOPER_EMAIL and LOCAL_DEVELOPER_PASSWORD must both be set',
      detail: 'Set them in .env, re-run `corepack yarn local:setup` so the hash matches, then restart `yarn dev`.',
    }, { status: 400 })
  }

  const signIn = await createAuth(env).api.signInEmail({
    body: { email, password, rememberMe: false },
    asResponse: true,
  })
  if (!signIn.ok) {
    return jsonResponse({
      error: 'Better Auth rejected the local developer credential',
      status: signIn.status,
      detail: 'The configured credential and the provisioned hash disagree. Re-run `corepack yarn local:setup`.',
    }, { status: 401 })
  }

  const redirectTo = String(getQuery(event).next || '/dashboard')
  // Only same-origin paths: a bare "/path", never "//host" or "/\host".
  const location = /^\/(?![/\\])/.test(redirectTo) ? redirectTo : '/dashboard'

  const response = new Response(null, { status: 302, headers: { location } })
  for (const cookie of signIn.headers.getSetCookie()) response.headers.append('set-cookie', cookie)
  return response
})
