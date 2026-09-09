# KrabiClaw — development instructions

## Canonical operating contracts

Database and release work must follow:
- [docs/operations/release-and-outage-prevention.md](docs/operations/release-and-outage-prevention.md)
- [docs/operations/release-flow.md](docs/operations/release-flow.md)

Do not invent alternative deployment, migration, rollback, or environment-management mechanisms.

Custom database migrations are prohibited. If an LLM proposes, generates, or edits one, stop and require human review. Do not commit or apply it.

- Fix the canonical API, schema, or domain source of truth. Do not add frontend fallbacks, guards, shadow models, compatibility branches, or silent empty success states unless nullable behavior is intentional and documented.
- Do not hand-mutate staging or production data or schema to mask application failures.
- Do not broaden the task to adjacent defects, but scope is not a place to leave one standing. If the defect blocks the requested change, or sits in code the change already edits, fix it through the same canonical path rather than creating another mechanism. Otherwise file it, with the query or reproduction that found it. "Pre-existing", "not mine", and "future work" are not dispositions: a defect is fixed or filed.

## Evidence

A claim about data comes from a query. A claim about a surface comes from loading
it. A claim about behavior comes from running it. Say how you know in the same
breath as the claim, so the reader can re-run it.

Count rows before describing a shape. `SELECT DISTINCT` and `group_concat(DISTINCT
...)` describe the union across rows, never any single row; reading one as a census
turns five stale rows into a fictional migration.

`typecheck`, `lint`, and `build` prove the code compiles. They are not evidence
that it does the thing, and never stand in for loading the surface or reading the
rows.

## No fallbacks

Every value has exactly one source. Every surface declares which source it reads.
When that source is empty, the surface shows an explicit empty or error state.

Never substitute a second source. No `a ?? b`, no `a || b`, no
`find(...) ?? items[0]`, no "if this is missing, use that instead" anywhere —
schema, API, domain utility, composable, or component. A `??` guarding a genuinely
optional value against `null`/`undefined` is fine; a `??` that reaches for
different data is not.

Also banned, as the same thing in other clothes:

- Ordering a query so a `LIMIT 1` picks something — `ORDER BY is_primary DESC`.
  Sorting for presentation is fine; sorting to make a choice is not.
- A `primary` / `default` / `main` flag added so a surface has something to show
  when it was given nothing. Build the selector instead.
- Inferring a target the caller did not pass: the current site, the last-used
  item, the one row that happens to exist today.
- Placeholder or example content standing in for absent tenant data.

**A fallback is not a safety net. It is a bug report you decided not to file.**
Everything after the `??` runs precisely when something upstream is broken, and
it makes the failure invisible at exactly the moment it needs to be loud. Two
examples from this repository:

- The ChatGPT MCP app edited the wrong products in production because a tool
  resolved an ambiguous target instead of refusing it.
- Location social cards are not being generated. Nobody knew, because
  `resolveSocialImageFromMedia` fell through to the site logo, so every location
  rendered a plausible-looking image and the missing Satori card never surfaced.

If a value is missing, the correct outcomes are: fail the request, render an
empty state that names what is absent, or fix the source. Never paper over it.

Breaking a surface that currently depends on a fallback is the intended outcome
of removing it, not a regression to patch. The surface was already broken; the
fallback was hiding it. Carrying these across epochs is how the schema drifted.

## Complexity control

Default order: delete, reuse, modify, add.

Before adding code, find the existing implementation of the behavior. There must be one canonical implementation, not parallel paths.

Do not add a helper, wrapper, service, repository, composable, endpoint, schema field/table, state model, compatibility path, dependency, or infrastructure resource when an existing path can be deleted or modified.

A refactor must remove the implementation it replaces in the same change. Do not leave dual reads, dual writes, aliases, temporary fallbacks, or "migration" compatibility code behind.

One concept, one name. If two files, functions, types, or tools describe the same thing, they are the same thing: pick the name and delete the other. A caller's identity does not belong in the name — `platform-content` alongside `tenant-pages` over one content model is what produced three hand-written schemas for a single executor. Rename in the change that finds the duplication.

Do not implement adjacent cleanup, TODOs, "future work," roadmap ideas, or reviewer suggestions unless they are required to complete the requested task. Repairing something the change already had to touch is not adjacent cleanup.

For cleanup/refactor work, net handwritten production code should decrease.

## Test discipline

Follow [docs/testing-strategy.md](docs/testing-strategy.md). Do not add a test by
default. Unit tests may not inspect production source text or mock internal
application modules. Prove UI, persistence, and MCP workflows through their real
runtime boundaries.

## Platform and authorization boundaries

KrabiClaw supports the ChatGPT MCP app, dashboard CMS, ChowBot in the dashboard, and ChowBot over WhatsApp where applicable. These surfaces must use shared server/domain utilities and the same canonical state. Do not fork business logic or create shadow data models.

Better Auth owns identity, sessions, OAuth provider state, organizations, members, roles, permissions, impersonation, and Teams.

- Use documented Better Auth Admin, Organization, Teams, impersonation, access-control, and OAuth resource-server APIs.
- Do not add direct SQL against Better Auth-owned auth tables in normal runtime code.
- Do not add custom role parsers, tenant bypasses, custom impersonation proxies, manual OAuth token verification, shadow membership or scope tables, or undocumented support principals or cookies.
- Tenant dashboard, ChowBot, WhatsApp, and tenant MCP access must use shared permission utilities backed by Better Auth organization permissions and Teams.
- Platform admin access is not tenant owner access unless the user is a tenant member or is impersonating one through Better Auth.

## Client-site integrity

Saya public surfaces render only validated tenant content. Missing content is omitted or shown as an explicit empty or error state; fabricated example content and tenant fallback copy are not rendered.

Use the approved client onboarding and import pipeline. Never manually seed or patch D1, invent client data, use stock images when client media exists, or leave tenant media on third-party hosts. A client site is not complete until `client:verify` passes and `client-handoff.md` is generated.

## Agent documentation

Each root document owns one thing, and nothing duplicates another's contents.
`CLAUDE.md` is a symlink to this file, so both names resolve to the same
development instructions.

- **[PRODUCT.md](PRODUCT.md)** — what the product is, and its domain language.
  Also see `docs/adr/`.
- **[DESIGN.md](DESIGN.md)** — how the CMS behaves: hub and leaf, leaf size, the
  editor frame and its columns, creating, committing, naming.
- **AGENTS.md** (this file, and `CLAUDE.md`) — development instructions.
- **[README.md](README.md)** — setup and navigation.

`PRD.md` is reserved for product requirements and does not exist yet. DESIGN.md
was briefly filed there; requirements and design contracts are different things,
and naming a composable or a breakpoint is the tell that a document is design.

Local setup and signing in: [docs/local-development.md](docs/local-development.md)

## Local development contract

Use `corepack yarn local:setup`, then `corepack yarn dev`. Sign in only as
`developer@playwright.example` with the freshly generated password and prefilled
URL printed by setup. Do not run seed or auth-provisioning scripts individually.
Dashboard `siteSlug` URL segments contain `sites.subdomain`, not `sites.slug`;
follow dashboard links instead of guessing a route.
