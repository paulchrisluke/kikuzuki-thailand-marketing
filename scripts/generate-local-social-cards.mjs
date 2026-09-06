#!/usr/bin/env node
/**
 * Generates the social cards a seeded local database has none of.
 *
 * Seeds and imports write media_placements as SQL, which never reaches the
 * generator, so a freshly set-up database serves no og:image at all. In a
 * deployed environment the scheduled social-card-backfill task closes that gap
 * on its own; locally there is no cron, so this runs the same regeneration
 * through the endpoint the dashboard's own button uses.
 *
 * Requires `yarn dev` to be running, because rendering a card needs the Worker.
 *
 *   corepack yarn local:cards
 *   corepack yarn local:cards --base-url http://localhost:3100
 */
import { parseArgs } from 'node:util'
import { credentialSession } from './utils/e2e-auth.mjs'

// A site with a full menu is a hundred renders in one request, which runs past
// fetch's five-minute headers timeout. Rather than reach for undici to disable
// it — undici is only a transitive dependency here — a site that times out is
// reported and the run continues. Cards that already match are reused, so
// re-running picks up where this left off.

const { values: args } = parseArgs({
  options: {
    'base-url': { type: 'string', default: 'http://localhost:3000' },
    email: { type: 'string', default: 'developer@playwright.example' },
    password: { type: 'string' },
  },
})

const baseURL = args['base-url']
const password = args.password || process.env.E2E_TEST_PASSWORD
if (!password) {
  console.error('[local:cards] A password is required. Pass --password with the value local:setup printed,')
  console.error('              or set E2E_TEST_PASSWORD. Re-run `corepack yarn local:setup` to mint a new one.')
  process.exit(1)
}

let cookie
try {
  cookie = (await credentialSession(baseURL, { email: args.email, password })).cookie
} catch (error) {
  console.error(`[local:cards] Could not sign in at ${baseURL}. Is \`yarn dev\` running?`)
  console.error(`              ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

// Every organization the developer account belongs to, since the local database
// carries several curated tenants and all of them render cards. Better Auth owns
// membership, so the list comes from it rather than from a query of our own.
const list = await fetch(new URL('/api/auth/organization/list', baseURL), { headers: { cookie } })
if (!list.ok) {
  console.error(`[local:cards] Could not list organizations: ${list.status}`)
  process.exit(1)
}
const organizations = await list.json()
if (!Array.isArray(organizations) || organizations.length === 0) {
  console.error('[local:cards] The developer account belongs to no organizations. Re-run `corepack yarn local:setup`.')
  process.exit(1)
}
let generated = 0
let failed = 0

for (const organization of organizations) {
  const scoped = await fetch(new URL(`/api/dashboard/context?org=${encodeURIComponent(organization.slug)}`, baseURL), { headers: { cookie } })
  if (!scoped.ok) continue
  for (const site of (await scoped.json()).sites ?? []) {
    // One site failing must not end the run: the rest of the tenants still
    // need their cards, and a second run picks up whatever this one missed
    // because regeneration reuses cards that already match.
    try {
      const response = await fetch(new URL(`/api/editor/sites/${site.id}/social-cards/regenerate`, baseURL), {
        method: 'POST',
        headers: { cookie },
      })
      if (!response.ok) {
        console.error(`[local:cards] ${organization.slug}/${site.id}: ${response.status}`)
        failed += 1
        continue
      }
      const results = (await response.json()).results ?? []
      const made = results.filter(result => result.kind === 'generated').length
      generated += made
      failed += results.filter(result => result.kind === 'failed').length
      console.log(`[local:cards] ${organization.slug}/${site.id}: ${made} generated, ${results.length} owners`)
    } catch (error) {
      failed += 1
      console.error(`[local:cards] ${organization.slug}/${site.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

console.log(`[local:cards] Done. ${generated} cards generated, ${failed} failed.`)
if (failed > 0) console.error('[local:cards] Re-run to retry the failures; cards that already match are reused.')
process.exit(failed > 0 ? 1 : 0)
