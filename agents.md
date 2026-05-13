Never add fallbacks ever.

## MCP Requirements
- Nuxt UI MCP server required
- Provides UI components, docs, and examples
- Used for building UI components with Nuxt UI integration

---

## Stack

- **Nuxt 4** + **Nitro** with `cloudflare-pages` preset
- **D1** (SQLite) via `@atinux/kysely-d1` — single binding: `REVIEWS_DB`
- **Better Auth 1.6+** — Google OAuth + `organization` plugin; `phoneNumber` plugin for WhatsApp OTP
- **Stripe** — subscriptions, entitlements
- **Cloudflare Workers** — serverless runtime
- Commands: `yarn dev` (local, port 3000), `yarn build`, `yarn deploy`

---

## Critical Wrangler Rules

- Always use `nodejs_compat_v2` (not `nodejs_compat`) in `wrangler.toml` — Better Auth 1.6+ requires it
- `yarn dev` runs `nuxt dev` — secrets are read from `.env`. `.dev.vars` is only used by `wrangler pages dev` (not the default dev command here)
- Never rely on `process.env` alone in server code — always merge with `event.context.cloudflare?.env` via `cloudflareEnv()` in `server/utils/api-response.ts`
- Schema application: `yarn schema:local` / `yarn schema:remote`
- Current deploys require patching the generated Nitro/Cloudflare process shim before `wrangler pages deploy`; use `yarn deploy` so this step is not skipped

## Stripe Local Development

- Run `yarn stripe:listen` in a second terminal to forward Stripe webhooks to `localhost:3000/api/billing/webhook`
- The CLI outputs a signing secret (`whsec_...`) — set this as `STRIPE_WEBHOOK_SECRET` in `.env` while developing locally
- The dashboard webhook secret (set in Stripe → Developers → Webhooks) is for production only; swap back before deploying
- Install CLI once: `brew install stripe/stripe-cli/stripe && stripe login`

---

## Auth

- Single catch-all handler: `server/api/auth/[...].ts`
- Auth factory: `server/utils/auth.ts` — `createAuth(env: CloudflareEnv)` — takes full CF env
- WeakMap cache keyed on the D1 binding instance — safe for Worker lifecycle
- Google OAuth (social sign-in) + `organization` plugin + `phoneNumber` plugin (WhatsApp OTP delivery)
- Account linking enabled for Google as trusted provider
- Client: `lib/auth-client.ts` → `createAuthClient` from `better-auth/client`
- `authClient` is auto-imported via Nuxt plugin — no explicit import needed in `<script setup>`

---

## Database Schema Workflow

1. `schema.sql` is the single source of truth — edit this, never add numbered migration files
2. Apply locally: `yarn schema:local` — remotely: `yarn schema:remote`
3. Greenfield — drop and recreate freely when a rebuild is cleaner
4. No inline migration blocks, compatibility columns, duplicate indexes, or legacy aliases in `schema.sql`
5. Better Auth tables (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`) must use Better Auth's exact camelCase column names; app-owned tables use snake_case
6. Any schema change must be checked against current server queries before finishing

---

## Multi-Tenancy

- Organizations map 1:1 with restaurant owners (Better Auth `organization` plugin)
- Sites belong to an org; multiple sites per org supported
- Tenant resolution: `server/middleware/tenant-resolution.ts`
  - `localhost` / `krabiclaw.com` = platform routes
  - `*.krabiclaw.com` or custom domains = tenant sites
- Unknown domains → 404

---

## File Conventions

- `server/utils/auth.ts` — `createAuth(env)` — always takes full CF env
- `server/utils/api-response.ts` — `cloudflareEnv(event)` — use for all DB access
- `server/middleware/tenant-resolution.ts` — runs on every request
- `lib/auth-client.ts` — client-side Better Auth instance
- `composables/` — Nuxt auto-imported
- `schema.sql` — canonical D1 schema
