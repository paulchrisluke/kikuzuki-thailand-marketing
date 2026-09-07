> Historical issue specification captured before the final consolidation and PR-only steering. Implementation scope remains comprehensive; the latest instruction stops at PR #848 ready for review. No staging/production merge, deployment, initialization or further staging writes are authorized. See the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md) and [current checklist](829-checklist.md).

## Outcome

Finish the comprehensive schema simplification that Epoch 4 was intended to deliver. Audit and resolve the entire current schema, remove obsolete tables/columns and replaced runtime paths, correct posts and all hours/availability contracts, and qualify the result through MCP, CMS, public journeys, and the normal staging-to-main release flow. Use a controlled Epoch 5 replacement where the canonical migration rules require it. Do not ship another partial cleanup that leaves the named work for a later epoch.

## Repository-owner authorization � 6 September 2026

The repository owner, @paulchrisluke, explicitly authorized this issue and all work described here:

> �we need to maintain consistant casing, dont just change casing for google if it breaks consistancy. i approve the rest, we need to be comprehensive. and make a git issue that approves ALL of this work. do NOT defer anything. we keep doing epochs to solve/simplify our db and we keep running into this drift because items are deferred or waiting for human approval. I, the repo owner approve all of this . the issue must be llm implementation ready, as I will hand it to a different chat�

This authorizes the comprehensive audit, design decisions, implementation, removal of obsolete schema and runtime code, necessary verified data conversion, controlled Epoch 5 preparation/cutover, and normal branch/PR/staging/main release work needed to complete this issue. Do not ask again for permission to inspect code/data/errors/logs, make routine design decisions, or perform the approved work. Retaining an item because it is a valid current domain requirement requires evidence; calling obsolete work �future work,� �awaiting approval,� or opening a follow-up does not complete this issue.

This authorization does not turn a failing verifier into a passing one. Preserve customer content, auth ownership, rollback resources, and the repository's migration/release safeguards. Do not fabricate missing business data, bypass a known failure, or hand-patch production to make the application appear correct. Resolve blockers within this work; if truly unknowable customer information or unavailable external access prevents completion, document the exact evidence and keep the issue open rather than claiming completion or asking for blanket approval again.

## Starting state and evidence

- Audited baseline: `b2468bdc5658f611703dc796199c0196c92ed94e`, which was both main and staging at audit time. Fetch current refs before starting; preserve subsequent work and hotfixes.
- Local task branch: `codex/google-posts-structured-hours`. No implementation was committed or pushed by the audit. A documentation commit was explicitly undone at the owner's request. Do not try to cherry-pick `9e5dc39d`.
- An untracked local report may exist at `docs/database/schema-audit-2026-09-06.md`. It predates the comprehensive approval/casing correction; this issue supersedes its �candidate only / not approved� wording. This issue contains the handoff evidence and must not depend on that local file or `/tmp` artifacts.
- Production Epoch 4 D1 at audit: `krabiclaw-db-epoch4-final`, `736830db-4922-4594-bca6-731df2450a23`.
- Staging at audit: `krabiclaw-db-staging-epoch4-final`, `ec6c7ee3-a75f-4445-b445-1addfe78482f`.
- Retained production Epoch 3 rollback D1: `4a02e2ec-6fb0-4bed-96ab-925ec1e508df`. Preserve existing rollback resources; Epoch 5 must retain Epoch 4 too.
- The obsolete pre-cutover candidate `73d8e172-b7a0-45b3-b200-ae052de52e57` is not a valid source or candidate.
- All 96 production application tables matched the committed Epoch 4 `table_info` and `foreign_key_list`; no extra/missing tables and zero foreign-key violations. CHECK/index equivalence and semantic correctness were not proven by that comparison.
- 74 additional scope queries: 73 returned zero mismatches. One `usage_events` organization/site mismatch is consistent with the explicit retained-history transfer policy. Do not rewrite historical ownership to satisfy a blanket constraint.
- Unchanged schema-drift preflight, Better Auth boundary guard, Product model guard and MCP catalog guard passed. These checks did not detect the behavior defects below.
- Minimal post-enum schema changes caused Drizzle to generate a referenced-parent `DROP TABLE posts` rebuild. `lint:migrations` correctly rejected it because `post_channel_jobs` references posts. Probe output was removed and never applied. Epoch 4 is already released and immutable; do not rewrite it or disable the guard.

## Binding implementation rules

Read and follow `AGENTS.md`, `CONTEXT.md`, relevant ADRs, `docs/database/migrations.md`, `docs/database/epoch-4-cutover.md`, `docs/operations/release-and-outage-prevention.md`, `docs/operations/release-flow.md`, `docs/testing-strategy.md`, `docs/local-development.md`, and `DESIGN.md`.

- `server/db/schema.ts` remains the only schema source of truth. Use generator-owned schema output and the documented explicit epoch procedure. This issue does not authorize hand-authored migrations or unsafe referenced-parent rebuilds.
- Delete, reuse, modify, then add. Reuse canonical domain/validation/import/release paths. Remove the implementation being replaced in the same change. Net handwritten production code should decrease for this cleanup.
- No legacy aliases, dual reads/writes, runtime compatibility maps, frontend fallbacks, shadow schemas, silent empty success states, or permanent backfill-on-request behavior.
- One-time, explicit, verified conversion during epoch transfer is authorized and necessary to preserve existing records. It is not a runtime compatibility mechanism. Reject ambiguous conversion rather than inventing values or silently discarding content.
- Better Auth owns identity, sessions, OAuth clients/scopes, organizations, members, Teams and subscriptions where configured. Use supported APIs/adapters and ownership boundaries; do not replace them with auth SQL or custom membership/permission state.
- Shared server/domain utilities must serve CMS, tenant MCP, ChowBot dashboard and WhatsApp where applicable. Google approval is absent: do not add or pretend to test a Google Business Profile publishing integration.

## 1. Consistent casing and Google semantics

Use the established application casing throughout owned persistence/domain/CMS/MCP contracts: snake_case field names and lowercase enum values. Do not selectively convert our enums to uppercase or our fields to camelCase just because Google uses that wire format. Do not globally rename Better Auth/Stripe-owned contracts to impose our convention either.

For posts, keep canonical values such as `standard`, `event`, `offer` and fixed CTA values `book`, `order`, `shop`, `learn_more`, `sign_up`, `call`. Delete the invented `update` topic; do not retain it as an accepted alias. Review any additional currently supported Google topic against official documentation rather than treating an authoring restriction as deprecation.

Match Google's supported value set, meaning, field relationships and validation while preserving our casing. Native third-party payloads at an existing API boundary retain their documented casing; any necessary boundary serialization is explicit and does not create a second stored model or accept old runtime shapes. Do not build a speculative Google publisher/adapter merely to justify casing conversion.

Verify current official sources during implementation:
- LocalPost: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
- Posts guide: https://developers.google.com/my-business/content/posts-data
- Places hours: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#OpeningHours
- Business Information location hours: https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations

## 2. Posts: one canonical content contract

Required files/consumers include `server/db/schema.ts`, `server/utils/post-management.ts`, `server/utils/mcp-tools/posts.ts`, `server/utils/mcp-tools/shared.ts`, `server/utils/mcp-executor/posts.ts`, editor post API routes, dashboard location post pages/editors, `components/saya/SayaPostDetail.vue`, `components/saya/SayaPosts.vue`, public post routes, localization/resource contracts, imports, seeds and scheduling jobs. Search the full repository for additional consumers.

- [ ] Fixed CTA enum with shared runtime validation and database enforcement; no free strings or deprecated `get_offer`.
- [ ] Correct event/offer content shape, using consistent application casing and one source of truth. Replace obsolete flattened fields where the new model supersedes them; do not retain parallel representations.
- [ ] Match documented event title/schedule requirements, local dates/times and topic relationships; resolve the current missing offer schedule and optional event-end behavior.
- [ ] Remove the false rule requiring an offer coupon or terms. Support the documented optional redemption URL and other offer fields.
- [ ] Apply documented OFFER/CTA behavior. Render CALL from the canonical location phone without requiring a CTA URL. Reject unsupported combinations with explicit errors shared by MCP and CMS.
- [ ] Review summary/body, language, media, event scheduling/recurrence and every current LocalPost field for supported applicability; record supported, output-only and unavailable-provider distinctions. Do not leave the comparison at the CTA enum.
- [ ] Keep website publication/scheduling and Facebook/Instagram job outcomes as intentional internal facts. Do not label website publication Google LIVE or fabricate Google IDs/timestamps/state.
- [ ] Remove old tool descriptions, types, constraints, fixtures, localization keys and consumers in the same change.

Production audit: 14 posts; 7 `standard` with no CTA, 6 `update` with no CTA, 1 `update` with `book`. Preserve content, IDs, scope, publication state and media through explicit conversion. Recount from a fresh export before transfer.

## 3. Hours, closures and all availability

Required consumers include `server/utils/google-places.ts`, `server/utils/location-management.ts`, `shared/reservation-hours.ts`, `utils/formatters.ts`, `server/utils/reservations.ts`, `server/utils/experiences.ts`, shared availability calculations, public reservation availability/submission routes, public experience booking routes, CMS hours/availability editors, MCP locations/experiences/availability schemas and executors, public opening-hours/closure rendering and structured data, onboarding/imports/copy operations and all fixture generators.

- [ ] Name the actual Google API contract used. The current importer uses Places, but the code mixes weekday-description strings, structured arrays, and Business Information-style objects. Choose one canonical application structure matching the applicable source's semantics with consistent casing; delete all hybrid/legacy shapes.
- [ ] Preserve machine-readable periods instead of throwing them away during Places import. Display descriptions are not the scheduling source of truth. Delete runtime prose parsers after verified transfer.
- [ ] Replace MCP's instruction to convert structured hours to weekday-description strings; fully describe the same structured input/output validated by the domain and CMS.
- [ ] Distinguish unknown hours from explicitly closed hours. Cover split shifts, overnight/week-boundary periods, 24-hour opening, midnight, location timezone and DST where applicable. No invented default opening periods.
- [ ] Resolve regular hours, date-specific hours, temporary/indefinite closures and booking-slot overrides into an explicit precedence contract used by all surfaces. Local closure notes are application facts, not invented Google fields.
- [ ] Fix indefinite closures: `getActiveSpecialClosure` currently substitutes startDate for missing endDate. A direct call with an indefinite closure starting 2026-09-01 returns inactive on 2026-09-06. MCP currently promises indefinite behavior.
- [ ] Fix reservations ignoring closures: both public reservation routes and shared reservation availability currently omit `special_hours`. Availability and final submission must enforce the same decision, including concurrent changes and capacity checks. Experience bookings must agree too.
- [ ] Retain a single experience schedule. Remove either obsolete `time_slots` or its replacement as the design requires; do not leave recurring-else-flat behavior. Current canonical direction is recurring schedules, with flat-only data explicitly converted once.
- [ ] Keep all existing booking commitments and valid availability decisions; validate conversion by rendered/open/bookable behavior, not just JSON parse success.

Production audit: 13 locations (3 array hours, 6 object hours, 4 null), no special-hours rows at audit; 11 experiences, including 8 flat-only schedules and 1 with both schedule columns. These are observations, not permission to skip closure behavior or invent missing hours.

Customer regressions to prevent: Kikuzuki and Take Me Away reservation slots must remain available on their real opening days; reservation CTA remains �Request reservation� in English/Thai; no loss of existing story/media, translations or responsive NCLS/Blawby navigation from the recent hotfixes.

## 4. Comprehensive schema review and removal � all findings in scope

For EVERY current table and column, produce a final disposition with its owner, readers/writers (including scripts, imports, cron, OAuth adapter, MCP and CMS), data shape, constraints, indexes, retention and transfer behavior. Extend the audit beyond the table/column/FK comparison to CHECKs, indexes, defaults, JSON validation, enum consistency, uniqueness, nullability and orphan/tenant-scope invariants. Resolve additional obsolete/duplicate schema and contract defects discovered by this audit in this issue; do not defer them to the next epoch. This is comprehensive schema work, not unrelated feature development.

The following are required implementation workstreams, not �review later� suggestions:

- [ ] **Retired tables:** `dashboard_preferences` has two production rows and no discovered read/create path, only a transfer UPDATE. Complete consumer verification, remove it and its transfer statement if retired, and account explicitly for discarded obsolete preference rows. Inspect all other low-reference/empty tables without assuming they are unused; Better Auth and canary tables have indirect/script consumers.
- [ ] **Primary location is a UI fallback:** remove `business_locations.is_primary` and every consumer. The column is `numeric()` defaulting to false, nullable, with no unique index, so nothing prevents zero or thirteen primaries on one site; a discriminator the application depended on would carry a partial unique index as `booking_policies.scope_type` does. All 8 reads are `locations.find(l => l.is_primary) ?? locations[0]` (`useDashboardSiteLinks.ts:12`, `public-page.ts:678`, `public-shell-query.ts:159`, `SayaFooter.vue:262`, `dashboard/onboarding.vue:305,359`, `[orgSlug]/onboarding.vue:211`, `locations/new.vue:143`) � a fallback whose second operand already answers the question. All 18 SQL sites use it only as `ORDER BY is_primary DESC, <tiebreak>`, and every one already carries a deterministic second key, so ordering stays stable after the leading term is dropped; public location and product ordering does change, which is expected and must be verified rather than preserved. Remove the 5 writers in the same change: the `LocationSettingsPage.vue` checkbox, `onboarding.vue:149`, `onboarding-drafts.ts:307`, the draft commit route, and `client-import.mjs`. Onboarding may and should change: it currently hardcodes `is_primary: true` for the first location, which is where the value originates for nearly every tenant. The owner has confirmed organizations do not need an address, which retires the ADR-0016 org-level `PostalAddress` consumer; amend that ADR in the same change.

  There is no exception requiring a replacement mechanism. `contact-resolution.ts:19` appears to select a record rather than order one, but that branch is unreachable: `resolveLocationContact` has exactly two callers and both always pass a real location id. `reservations.post.ts:182` passes `resolvedLocationId`, and line 76 returns a 400 when it is absent under a comment stating no site shape has a reservation untied to a location and that it must never fall back to a primary or first location � the caller was already corrected and the helper's fallback branch was left behind. `experiences/[slug]/book.post.ts:154` passes `experience.location_id`, which is `notNull()`. The site-wide contact form does not use this helper at all; `contact.post.ts` calls `resolveContactSubmissionAssignment`, which returns `assignedLocationId: null` when the guest supplies neither location nor experience and stores a null `location_id`, which is the correct honest-absence model for NCLS and any other single-form tenant. Change `locationId` to a required `string`, delete the `ORDER BY is_primary DESC` branch and the parameter conditional. Delete the `contactEmail: loc?.email ?? site?.contact_email` chain on line 25 in the same change. Each field has one owner and each surface declares which owner it reads. Reservations and experience bookings show the location's contact, so they read `business_locations.email` and render an explicit empty state when it is missing; the Blawby/NCLS contact form shows the site's contact, so it reads `sites.contact_email` and only that. Merging them makes one field mean two different things depending on data the reader cannot see, and hides a missing location email instead of surfacing it. After both removals `resolveLocationContact` is a single scoped query with a required `locationId`. Surfaces that currently render a site address where a location has no email will change; that is the intended outcome, not a regression to patch. Verify the reservation email, the experience booking email and the NCLS contact form each against the owner it is supposed to read.

- [ ] **Social cards are not being generated, and a fallback hid it:** `resolveSocialImageFromMedia` resolved a resource's OG image as own `social_card` ? site `social_card` ? site `social_share` ? site `logo`. Because the last step almost always succeeded, every surface rendered a plausible image and nobody saw that no Satori card existed. On the local seeded database, `media_placements` holds 588 active rows across 10 owner types and **zero** with `slot = 'social_card'` � site, business_location, product, experience, offering, post, blog_post and review all at zero. Seeds insert placements through raw SQL and would not invoke the generator, so confirm the real production count before concluding scope; the owner reports OG images are wrong in production, which is consistent. The reader-side fallback is already removed on `feat/sites-locations-overview` (the resolver now returns the owner's own card or null, and the dead site-media queries in `dashboard-context.ts` and `public-social-image.ts` are deleted), so the absence is now visible. This workstream is the generator half: establish why `social_card` placements are not produced for any owner type, whether `regenerate.post.ts` and the placement-change triggers in `social-card.ts` actually run for each `OWNER_SOURCE_SLOTS` entry, and make seeds and imports produce cards the same way runtime does. Verify a rendered card per owner type against the Satori renderers rather than only asserting a row exists. Do not restore a reader-side fallback to make pages look correct.

- [ ] **Billing duplication:** eliminate obsolete subscription/customer mirrors and legacy fallback reads between Better Auth `subscription`, `organization_billing`, `billing-webhook-app-events.ts`, `better-auth-stripe.ts`, and subscription reconciliation. Preserve intentional payment evidence, event ordering/idempotency and access/grant facts under their correct owner. Prove webhook replay, entitlements and existing customer subscription continuity. Do not blindly delete the whole billing table or replace Better Auth.
- [ ] **OAuth scope backfill:** retire request-time legacy scope handling in `auth.ts` through supported Better Auth lifecycle/API work, preserving existing tenant MCP OAuth clients, consent and refresh behavior. No auth SQL backfill or custom scope model.
- [ ] **Transfers and provider metadata:** resolve older transfer/onboarding and Stripe metadata representations in `shared/transfer-onboarding-query.ts`, transfer onboarding context, site-transfer acceptance/domain code, and billing/reconciliation code. Inventory outstanding transfers/provider state, normalize through supported canonical paths, remove obsolete branches, and prove accept/cancel/retry/payment/ownership continuity.
- [ ] **Issued reply addresses:** resolve old token/address acceptance in `server/utils/reply-address.ts` and all inbound paths. An epoch cannot rewrite already sent emails. Establish and execute an explicit retirement/continuity policy for issued links and replies; do not silently invalidate active guest conversations or retain the compatibility branch indefinitely. Any intentionally supported external address contract must be justified as a current contract with evidence, not relabeled legacy work deferred beyond this issue.
- [ ] **Polymorphic ownership:** validate and enforce owner existence/type/scope for `content_documents`, `resource_localizations`, media and other polymorphic stores. Check localized resource ownership and tenant isolation through real mutation/deletion/transfer paths.
- [ ] **Document hierarchy:** `content_blocks.parent_block_id` currently has no FK. Enforce parent existence and same-document ownership, valid hierarchy/cycle behavior and cleanup through the existing document domain/schema mechanisms.
- [ ] **Page variants:** enforce page/site/organization/locale ownership consistently; individual FKs alone permit mismatched parents. Preserve routes, SEO, documents and localization. Validate source-locale completeness.
- [ ] **Defaults/nullability/enums:** audit the 38 defaulted-but-nullable columns and all unconstrained status/type/JSON fields. Resolve accidental nullability and malformed state, while preserving intentional null and provider-owned schemas. Current examples include location/site status, review source/status, analytics counters and domain timestamps. Better Auth-owned user defaults are not ours to tighten arbitrarily.
- [ ] **Other Google differences:** inspect location details, categories, reviews, media, dates/language/attribution and imported fields against the actual API used. Resolve lossy or misleading contracts and obsolete fields uncovered, preserving application-owned facts such as direct reviews and bookings. Do not convert the entire application into a Google response blob or add unapproved publishing capabilities.
- [ ] **Historical ownership:** honor explicit retain/reparent/revoke policies. Investigate the one usage-history mismatch rather than rewriting historical billing/usage ownership to pass a naive constraint.
- [ ] **Retired Epoch 3 runtime/resources:** inspect stale references, while retaining rollback-critical resources required by the current runbook. Rollback retention is an intentional safety contract, not active legacy business logic. Do not delete retained D1/DO/queue state to make a grep clean.

For each retained structure, explain its present responsibility. For each removal, enumerate removed consumers and data disposition. No unresolved finding may be hidden behind a passing static guard.

## 5. Epoch implementation and release sequence

- [ ] Start from latest staging with pinned toolchain; immutable install and unchanged `lint:schema-drift` BEFORE editing schema. Diagnose unexpected generation rather than rewriting metadata.
- [ ] Finish the complete schema/consumer audit and final design before freezing the new generated baseline. Prepare the Epoch 5 procedure by reusing the existing epoch mechanism; do not invent a second deployment/transfer framework.
- [ ] Generate the final baseline for a NEW epoch without rewriting committed Epoch 4 history on production/rollback resources. Update schema, seeds, transfer policy, invariants and runtime together. No unsafe parent DROP on the live resource, no hand-edited migration ledger.
- [ ] Implement an explicit transfer/verifier using the existing epoch tooling pattern: census every source/destination table/column, fail unmapped rows, preserve counts and typed logical hashes for all unchanged data, verify projected changed fields and customer-visible behavior. Do not repeat Epoch 4's history-discard policies automatically; current messages, deliveries, notifications, auth, bookings and client content must be preserved unless their obsolete-data disposition is specifically established.
- [ ] Build/rebuild the candidate only from the exact final committed baseline. Verify actual candidate CHECKs/indexes/FKs and migration metadata, not just the name �Epoch 5.� Reject a stale prepared database.
- [ ] Qualify local and disposable preview first; use the documented standalone staging epoch procedure and normal PR to staging. Keep production on Epoch 4 while qualifying. Preview is reset in place, not replaced as a workaround.
- [ ] Before production binding/promotion: verify exact candidate SHA and resource IDs, execute documented write freeze and request drain, take the final production export, transform/import into the empty correct candidate, re-export and verify complete parity/invariants. Retain Epoch 4 for rollback.
- [ ] Only after all pre-merge data and runtime gates pass, promote staging to main through the normal PR flow. Deployment changes the binding immediately; post-merge tests cannot substitute for candidate correction/verification.
- [ ] Run production read-only browser/MCP verification against the exact deployed build. If a gate fails, inspect logs and fix the cause. Do not blindly retry/redeploy. Follow rollback/write-reconciliation procedures if needed; retaining the old database alone does not reconcile writes made after cutover.

Owner authorization is already present. Normal CI/data/release gates remain requirements, not a reason to request the same scope approval again.

## 6. Required proof and definition of done

- [ ] Full table/column disposition and before/after schema diff, no deferred findings or stale runtime consumers. CHECK/index/FK/JSON/tenant invariants verified against the actual candidate.
- [ ] Canonical schema drift/migration, Better Auth, Product, MCP catalog/submission and relevant quality/build checks pass. Regenerate existing MCP/catalog artifacts via canonical commands where needed.
- [ ] Meaningful direct tests for pure validation/calculation invariants only when existing coverage does not prove them. No source-text tests or mocked internal modules. Use real local D1/Worker for persistence, atomicity and concurrency.
- [ ] Real authenticated MCP create/get/update flows for all affected domains: posts (valid and invalid topics/CTA/event/offer), locations/hours/closures, experience schedules/availability; verify stored state, round-trip output and public rendering. Read-only MCP smoke on staging/production. Actual ChatGPT host session for discovery/selection/host-specific arguments as required; a static catalog pass is not sufficient.
- [ ] CMS edits produce the same canonical records and validation as MCP. ChowBot dashboard/WhatsApp reuse the same domain behavior, permissions and state.
- [ ] Booking proof covers closed/unknown/overnight/split/24-hour schedules, indefinite/date-bounded closures, reopening, timezones, overrides, capacity and concurrent updates. Verify both availability and submission, not only rendered slot lists.
- [ ] Browser verification uses production Nuxt/Nitro output through local Wrangler and then deployed preview. Run all release-required customer site, localization, navigation, content and guest journeys; preserve the recent production hotfixes.
- [ ] Billing/OAuth/transfer/inbound-reply workstreams have runtime continuity evidence, including existing records/provider state; passing unrelated site rendering does not qualify them.
- [ ] No real Google Business Profile post sent or claimed while access is unavailable. Provider sending checks only to the owner's previously authorized self-test recipients, never clients: email `paulchrisluke@gmail.com`, WhatsApp `+14233585761`. Verify current recipient configuration before using a canary; the existing notification canary may target another demo owner and must not be run unchanged. Distinguish provider acceptance, delivery and receipt; redact message content/secrets from logs.
- [ ] Attach sanitized test/transfer evidence, exact SHAs/resource bindings and rollback procedure to the release PR/issue. Preserve private exports outside Git. Do not expose credentials, tokens or customer data in CI artifacts.
- [ ] Production cutover and exact-build verification complete, rollback state retained, final issue checklist resolved. Do not close this issue at �audit done,� �code done,� �CI passed,� or �ready for another chat.�

Related background: #820 and #788. This issue covers the comprehensive approved schema work; do not assume either older issue's historical deferrals limit this authorization.

<details>
<summary>Complete 96-table starting census (live observations on 6 September; recount before cutover)</summary>

| Table | Columns | Production rows | Literal runtime files |
| --- | ---: | ---: | ---: |
| `account` | 14 | 17 | 46 |
| `availability_overrides` | 14 | 0 | 5 |
| `blog_posts` | 28 | 26 | 20 |
| `booking_policies` | 18 | 11 | 4 |
| `business_locations` | 48 | 13 | 86 |
| `canary_runs` | 8 | 188 | 1 |
| `chowbot_channel_state` | 8 | 3 | 2 |
| `chowbot_conversations` | 10 | 13 | 3 |
| `chowbot_messages` | 13 | 42 | 2 |
| `contact_submissions` | 13 | 6 | 7 |
| `content_blocks` | 9 | 679 | 35 |
| `content_documents` | 5 | 60 | 12 |
| `customers` | 21 | 12 | 25 |
| `dashboard_preferences` | 6 | 2 | 1 |
| `domain_reconciliation_jobs` | 8 | 4 | 1 |
| `experience_bookings` | 26 | 3 | 22 |
| `experiences` | 16 | 11 | 103 |
| `facebook_pages_connections` | 14 | 0 | 5 |
| `google_analytics_connections` | 16 | 1 | 6 |
| `guest_thread_deliveries` | 10 | 0 | 4 |
| `guest_thread_entries` | 13 | 0 | 10 |
| `guest_threads` | 10 | 0 | 10 |
| `invitation` | 9 | 15 | 10 |
| `jwks` | 7 | 2 | 3 |
| `location_qa` | 18 | 34 | 16 |
| `mcp_tool_call_events` | 28 | 1422 | 4 |
| `mcp_workspace_preferences` | 6 | 6 | 5 |
| `media_assets` | 23 | 336 | 39 |
| `media_placements` | 11 | 637 | 38 |
| `member` | 5 | 24 | 116 |
| `notification_reads` | 3 | 0 | 4 |
| `notifications` | 13 | 0 | 48 |
| `oauthAccessToken` | 15 | 2 | 0 |
| `oauthClient` | 36 | 31 | 1 |
| `oauthClientAssertion` | 2 | 100 | 0 |
| `oauthClientResource` | 5 | 0 | 0 |
| `oauthConsent` | 9 | 38 | 0 |
| `oauthRefreshToken` | 19 | 396 | 0 |
| `oauthResource` | 15 | 2 | 0 |
| `offerings` | 25 | 6 | 28 |
| `onboarding_drafts` | 13 | 1 | 6 |
| `organization` | 7 | 14 | 146 |
| `organization_billing` | 12 | 5 | 19 |
| `organization_events` | 10 | 370 | 5 |
| `platform_contact_submissions` | 12 | 0 | 1 |
| `platform_docs` | 22 | 9 | 7 |
| `platform_locale_catalogs` | 11 | 1 | 2 |
| `platform_locale_messages` | 5 | 318 | 1 |
| `post_channel_jobs` | 8 | 0 | 2 |
| `posts` | 24 | 14 | 114 |
| `prices` | 15 | 623 | 36 |
| `product_categories` | 12 | 62 | 6 |
| `products` | 26 | 487 | 104 |
| `public_resource_cache_invalidations` | 9 | 314 | 1 |
| `rate_limits` | 4 | 736 | 3 |
| `reservation_submissions` | 25 | 15 | 25 |
| `resource_localizations` | 13 | 597 | 13 |
| `review_requests` | 20 | 0 | 14 |
| `reviews` | 29 | 58 | 82 |
| `session` | 11 | 184 | 148 |
| `site_analytics_daily` | 12 | 99 | 2 |
| `site_analytics_dimension_daily` | 10 | 436 | 2 |
| `site_analytics_page_daily` | 8 | 364 | 2 |
| `site_analytics_sessions` | 23 | 1035 | 4 |
| `site_config` | 5 | 16 | 15 |
| `site_consultation_settings` | 13 | 1 | 5 |
| `site_conversion_events` | 29 | 128 | 4 |
| `site_domain_events` | 12 | 21 | 4 |
| `site_domains` | 39 | 16 | 16 |
| `site_language_licenses` | 15 | 1 | 5 |
| `site_link_items` | 11 | 0 | 5 |
| `site_link_pages` | 11 | 0 | 5 |
| `site_locales` | 9 | 12 | 14 |
| `site_pageview_events` | 19 | 31144 | 3 |
| `site_redirects` | 14 | 8 | 7 |
| `site_theme_tokens` | 9 | 1 | 4 |
| `site_transfer_requests` | 24 | 2 | 13 |
| `sites` | 33 | 11 | 207 |
| `spent_subdomains` | 4 | 0 | 2 |
| `stripe_ga4_subscription_intents` | 20 | 0 | 2 |
| `stripe_invoice_payments` | 17 | 5 | 5 |
| `stripe_subscription_versions` | 4 | 3 | 2 |
| `stripe_webhook_events` | 13 | 29 | 6 |
| `subscription` | 20 | 3 | 28 |
| `team` | 6 | 23 | 29 |
| `teamMember` | 5 | 4 | 0 |
| `tenant_compliance` | 24 | 1 | 7 |
| `tenant_page_variants` | 16 | 25 | 17 |
| `tenant_pages` | 11 | 23 | 4 |
| `themes` | 8 | 2 | 2 |
| `usage_events` | 13 | 42 | 5 |
| `usage_quota_grants` | 14 | 12 | 4 |
| `user` | 15 | 27 | 191 |
| `verification` | 6 | 4 | 14 |
| `work_requests` | 14 | 0 | 6 |
| `zaraz_sync_lock` | 2 | 1 | 1 |

Literal runtime file counts are search leads, not evidence of unused tables. Counts are not a frozen transfer manifest.

</details>
