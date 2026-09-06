# Schema audit — 6 September 2026

Status: pre-refactor audit; not an Epoch 5 release qualification or cutover approval.

Audited commit: `b2468bdc5658f611703dc796199c0196c92ed94e`.
Production D1: `736830db-4922-4594-bca6-731df2450a23`.

## What was verified

All 96 application tables were inventoried against the committed Epoch 4 baseline.
Live production has no extra or missing application tables, no differences in
SQLite `table_info` or `foreign_key_list`, and zero `foreign_key_check` violations.
This comparison does not prove CHECK/index equivalence, semantic correctness,
polymorphic ownership, tenant scope, or customer journeys. Counts below are live
read-only observations, not a frozen transfer manifest.

A further 74 read-only scope queries checked organization/site and location/site
pairs, page-variant ownership, and content-block parent existence/document scope.
73 returned zero mismatches. One `usage_events` row retains an organization that
differs from its site's current organization; `SITE_TRANSFER_RETAIN_TABLES` explicitly
retains usage history at transfer. Treat this as a historical-ownership review, not
a reason to rewrite billing history or add a blanket ownership constraint.

The unchanged schema drift preflight, Better Auth boundary guard, Product model
guard, and MCP catalog guard passed. The catalog guard proves synchronization of
our definitions; it does not validate them against Google or prove tool behavior.

A reversible generator probe confirmed that changing the post enums rebuilds
`posts`. The migration guard correctly rejected its referenced-parent DROP.
The generated output was removed; no schema change was applied or baseline rewritten.
Follow [migrations.md](migrations.md) and the explicit epoch procedure for any
replacement. Do not bypass the guard or hand-edit a migration.

## Confirmed changes needed

| Finding | Evidence | Required correction |
| --- | --- | --- |
| Post contract differs from Google | `schema.ts`, `post-management.ts`, MCP `posts.ts`: lowercase types including `update`; arbitrary CTA; flattened event/offer fields | One canonical Google post content contract across persistence, domain, CMS, MCP and public rendering. Remove the `update` topic and old fields in the same refactor. |
| Event/offer validation differs | Offers require coupon or terms; events allow no end; offer schedules absent | Validate the documented Google event and offer structures. Preserve existing content during explicit transfer; fail on information that cannot be derived. |
| CALL cannot render normally | `SayaPostDetail.vue` requires `cta_url` | Render the supported CALL action using the location phone; Google says URL is unset for CALL. |
| Places import discards machine-readable hours | `google-places.ts:normalizeDetail` retains only weekday descriptions | Preserve structured periods from the actual Places API. Remove prose-to-hours parsing and mixed legacy representations after explicit transfer. |
| MCP teaches the lossy representation | `mcp-tools/shared.ts:openingHoursInputSchema` tells ChatGPT to convert structured objects to strings | Replace the input and output schemas together and verify real tools/call persistence. |
| Reservations ignore temporary closures | Public reservation routes and `reservations.ts` read only regular hours and slot overrides | Apply the same location closure decision to availability and submission, including concurrency checks. |
| Indefinite closures expire after one day | `getActiveSpecialClosure` substitutes startDate for absent endDate, while MCP promises indefinite closure | Replace the conflicting special-hours contract. Direct execution with start 2026-09-01 and evaluation 2026-09-06 returned false for an indefinite closure. |
| Experience schedules have two writable sources | `experiences.time_slots`, `recurring_slots`; runtime chooses recurring else flat | Retain one schedule model and delete the other field and all readers/writers. Production has 8 flat-only rows and 1 row with both populated. |
| Dashboard preferences appear retired | Repository search found only schema and a transfer-time UPDATE, no read/create path | Candidate for removal after confirming the two production rows have no supported consumer. Remove the transfer statement with the table. |
| `business_locations.is_primary` is a UI fallback, not a business fact | `schema.ts:75` declares it nullable with no uniqueness; 8 reads are `find(is_primary) ?? locations[0]`; 18 SQL sites use it only as `ORDER BY is_primary DESC, <existing tiebreak>` | Remove the column and every consumer. See below for the one load-bearing use that needs a replacement decision. |

The hours refactor must cover closed days, explicitly unknown hours, overnight
periods, 24-hour opening, split shifts, date-specific changes and the location's
timezone. An empty schedule must not turn into invented opening hours.

## Primary location

`business_locations.is_primary` is `numeric()` defaulting to false, nullable, with
no unique index. Nothing prevents a site from having zero primaries or thirteen.
A discriminator the application actually depended on would carry a partial unique
index, as `booking_policies.scope_type` does.

Every read confirms it is a presentation default rather than a fact about the
business:

- **8 fallback reads** of the form `locations.find(l => l.is_primary) ?? locations[0]`:
  `useDashboardSiteLinks.ts:12`, `public-page.ts:678`, `public-shell-query.ts:159`,
  `SayaFooter.vue:262`, `dashboard/onboarding.vue:305,359`,
  `[orgSlug]/onboarding.vue:211`, `locations/new.vue:143`. A fallback guarding a
  fallback: the second operand already answers the question.
- **18 SQL sites** use it only as `ORDER BY is_primary DESC, <tiebreak>`. Every one
  already carries a deterministic second key (`title ASC`, `created_at ASC`, or
  `title, id`), so removing the leading term leaves ordering deterministic. Public
  surfaces are included — `public/sites/[siteId]/locations.get.ts`,
  `public-products.ts`, `professional-services.ts`, `public-shell-query.ts` — so
  location and product ordering on live sites changes even though it stays stable.
- **5 writers**: the `LocationSettingsPage.vue` checkbox, `onboarding.vue:149`,
  `onboarding-drafts.ts:307`, the draft commit route, and `client-import.mjs`.
  Onboarding hardcodes `is_primary: true` for the first location, which is where
  the value comes from for nearly every tenant.

The owner has confirmed that organizations do not need an address, which retires
the ADR-0016 org-level `PostalAddress` use. Update that ADR in the same change.

### The last apparent exception is dead code

`contact-resolution.ts:19` looks like the one consumer where the column selects a
record rather than orders one. It is not: the branch is unreachable.

`resolveLocationContact` has exactly two callers, and both always pass a real
location id:

- `public/sites/[siteId]/reservations.post.ts:182` passes `resolvedLocationId`.
  Line 76 returns a 400 when the request omits it, under a comment stating that no
  site shape has a reservation untied to a location and that it must never fall
  back to a primary or first location. The caller was already corrected; the
  fallback branch inside the helper was left behind.
- `public/sites/[siteId]/experiences/[slug]/book.post.ts:154` passes
  `experience.location_id`, which is `notNull()` in `experiences`.

The site-wide contact form does not use this helper. `contact.post.ts` calls
`resolveContactSubmissionAssignment`, which returns `assignedLocationId: null` when
the guest supplies neither a location nor an experience, and stores a null
`location_id` on `contact_submissions`. That is an honest absent value, not a
guess, and it is the correct model for NCLS and any other single-form tenant.

So there is no routing decision to make. Change `locationId` to a required
`string`, delete the `ORDER BY is_primary DESC` branch and its parameter
conditional, and `is_primary` loses its last non-ordering consumer.

The `contactEmail: loc?.email ?? site?.contact_email` chain on line 25 goes in the
same change. Each field has one owner and each surface declares which owner it
reads. A reservation or experience booking shows the location's contact, so it
reads `business_locations.email` and renders an explicit empty state when that is
missing — it must not silently show a different mailbox. The Blawby/NCLS contact
form shows the site's contact, so it reads `sites.contact_email` and only that.
Merging them makes one returned field mean two different things depending on data
the reader cannot see, and hides a missing location email instead of surfacing it.

After both removals `resolveLocationContact` is a single scoped query with a
required `locationId`. Surfaces that currently render a site address where a
location has no email will change; that is the intended outcome. Verify the
reservation and experience booking emails and the NCLS contact form against the
owner each is supposed to read.

## Google boundary

Use Google's non-deprecated CTA values: BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP,
CALL. GET_OFFER is deprecated. `update` is our invented topic, not Google's
STANDARD. Do not call ALERT deprecated merely because its authoring availability
is restricted. OFFER ignores callToAction and requires event information; offer
coupon, redemption URL and terms are optional fields.

Google reference: [LocalPost](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts).

Hours currently come from [Places OpeningHours](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#OpeningHours),
whose numeric day/hour/minute periods differ from Business Information's weekday
and TimeOfDay shape. Do not label a hybrid structure "Google hours". The final
contract must name its API source. Local booking policy and closure notes are
application facts; do not disguise them as Google response fields.

There is no Google Business Profile publisher in this checkout. Google output-only
identifiers and publication states must not be fabricated. Website publication
and Facebook/Instagram jobs remain explicit application state. Identity, billing,
bookings, CMS documents and tenant ownership are not Google response resources.

## Other schema-wide review findings

These are review candidates, not authorization to delete live provider contracts:

- Billing duplicates subscription/customer identifiers in Better Auth subscription
  state and `organization_billing`. `billing-webhook-app-events.ts` explicitly
  falls back to the latter. Payment evidence/access grants have different ownership
  from provider subscription state; inspect that distinction before dropping columns.
- OAuth client scope backfill remains in `auth.ts`. Retirement must use Better Auth
  APIs and prove existing MCP OAuth clients remain usable; never patch auth SQL.
- Transfer onboarding and Stripe metadata still accept older representations.
  Inventory outstanding transfers/provider metadata before retiring those branches.
- Reply addresses accept old issued token/address formats. Removing this code can
  invalidate emails already sent; a database reset does not update those emails.
- `content_documents` and `resource_localizations` use polymorphic owner references;
  `content_blocks.parent_block_id` has no FK. Table-level foreign-key success does
  not prove owner existence, document-local parents, or tenant isolation.
- `tenant_page_variants` has individual site/page references, not a composite
  page/site ownership FK. Validate scope in the existing invariant path and inspect
  real data before claiming an epoch candidate is clean.
- 38 columns have defaults but permit SQL NULL, including location/site status,
  review source/status and analytics counters. Better Auth-owned user fields are
  included in that count and must not be tightened arbitrarily. Decide intentional
  nullability per domain; a default alone does not enforce it.
- Low literal-reference counts are not evidence that a table is dead: Better Auth
  loads tables through its adapter, and canary tables are written by operator scripts.

## Qualification required before a baseline is frozen

1. Resolve every proposed removal and every semantic ownership finding; enumerate
   changed fields and all runtime, CMS, MCP, seed, import and localization consumers.
2. Build one final canonical schema. Generate it through the documented epoch
   procedure; remove replaced code in the same candidate. No runtime aliases or
   dual reads/writes. One-time data conversion is explicit, verified transfer work,
   not a permanent compatibility layer and not permission to discard client content.
3. Verify counts, typed logical hashes, tenant scope and polymorphic ownership against
   a production export. Unchanged tables must be identical. Reject ambiguous values.
4. Prove post create/get/update, CTA rejection, event/offer validation, location hours,
   closures and reservation/experience availability through real local Worker/D1 and
   authenticated MCP calls. Inspect resulting public pages and CMS through the browser.
5. Run deployed preview and normal staging PR qualification. No Google publishing
   test while API access is unavailable. Production cutover is a later gated action,
   retaining Epoch 4 and freezing writes before the final export.

## Complete table census

Every current table is listed below. Literal runtime references are discovery leads,
not semantic sign-off. Better Auth adapter use and operator scripts are not counted.
A zero row count alone never authorizes removal. All tables remain retained unless
an explicit disposition above is validated in the final change.

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
