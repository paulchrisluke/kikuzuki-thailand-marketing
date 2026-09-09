# KrabiClaw — Product Context

## What It Is

**Website builder for local and professional-service businesses** — multi-tenant SaaS where owners get a subdomain site and build their web presence completely through conversation with ChatGPT (via MCP) or the dashboard CMS. SSR-rendered, SEO-optimised sites. The ChatGPT plugin is the primary creation surface. Supports the `restaurant`, `experience`, and `service` verticals today, with the model designed to easily accommodate more local-business categories over time.

---

## MCP Surfaces

KrabiClaw now ships two separate MCP apps.

### Client MCP

Customer-facing ChatGPT app for tenant site management.

- OAuth2 authorization at `/api/auth/oauth2/` — ChatGPT handles auth before any tool call
- MCP endpoint at `/api/mcp` (`server/api/mcp.post.ts`)
- Scope: `tenant`
- MCP capabilities cover site setup, locations, menus, experiences, posts, media, locale management, Google Places, Facebook, and analytics. Priority-support work requests (Growth plan) are a dashboard-only feature, not exposed on the free ChatGPT-facing MCP surface. The generated catalog is authoritative.
- Every public tool rejects unknown top-level arguments and declares explicit `readOnlyHint`, `openWorldHint`, and `destructiveHint` values. `server/utils/mcp-tools/shared.ts` contains the reviewed per-tool table.
- Location-scoped mutations require an explicit `location_id`. Product-by-ID mutations resolve the Product's stored owning location.
- `chatgpt-app-submission.json` contains the review import data. Run `node --experimental-strip-types scripts/generate-chatgpt-app-submission.mjs` after changing the public tool catalog.
- Widget system is legacy/deprecated for client uploads; Client MCP should ask users to attach files directly in ChatGPT and then call `upload_user_media` once with the resolved native file argument. `list_sites`, `import_from_maps`, `show_generated_images`, and onboarding return plain text.
- Image generation via ChatGPT's native `image_generation` Responses API tool (`gpt-image-1` / `gpt-image-2`) — not DALL-E
- Plugin landing page at `/plugin`

### Platform Admin MCP

Internal ChatGPT app for KrabiClaw operators only.

- MCP endpoint at `/api/mcp/platform` (`server/api/mcp/platform.post.ts`)
- Scope: `platform_admin`
- Auth requires the Better Auth Admin plugin platform-admin permission path
- Tools limited to platform blog/docs operations for `krabiclaw.com/blog` and `krabiclaw.com/docs`, plus read-only categorized release data from merged GitHub pull requests

The dashboard is still the home for billing, org settings, unified inbox (contact, reservations, bookings, reviews), and analytics. MCP and dashboard operate on the same D1 backend with no forked business logic.

See `docs/mcp-surface-split.md` for the canonical split rules.

---

## Verticals

KrabiClaw supports multiple business verticals. ChatGPT asks the user directly during onboarding (plain text) and passes the chosen vertical to `create_site`; the dashboard onboarding wizard and multi-site "Add a site" picker offer the same three choices.

| Vertical (app-level) | Description | DB-stored as |
|----------|-------------|-------------|
| `restaurant` | Food & beverage — menus, reviews, hours, reservations | `restaurant` |
| `experience` | Activity-based businesses — experiences, bookings, classes | `experience` |
| `service` | Legal and other professional/advisory services — offerings (practice areas), consultations, pricing/donate pages | `service` |

`service` is the canonical professional-service vertical across the application, database, and import pipeline.

Experiences are one-to-one booking extensions of canonical Products and retain the same stable ID. Product owns shared title/slug/content/visibility/order/SEO/Price fields; `experiences`, `experience_bookings`, experience-specific MCP tools (`list_experiences`, `create_experience`, `list_experience_bookings`, etc.), and Saya routes at `/experiences/[slug]` own the booking-specific behavior.

Professional-service tenants render through the Blawby template (see "Public Templates" below) rather than Saya, and don't yet have a first-class offerings/practice-areas content model in the dashboard CMS — that's tracked separately (issue #278).

---

## Business Model

Recurring amounts and plan IDs are intentionally fixed in the reviewed Stripe
catalog contract (`scripts/lib/stripe-catalog-plan.mjs`). Customer-facing
billing surfaces load the canonical plan details from `GET /api/billing/plans`.

| Tier | Price | Key Features |
|------|-------|-------------|
| Free (Starter) | $0 | Subdomain, Saya theme, manual editor, 1 locale |
| Growth | $49/mo or $588/year | Custom domain + SSL, Google Places imports, post-booking review requests, manual locale editing, Priority Support |

One Better Auth organization subscription covers every site in the organization.
One-time credit purchases, service add-ons,
and automatic top-ups are retired. The 2026-08-09 production/provider census
found no customer purchase, fulfillment, or outstanding-obligation history for
those products. The active schema removes their unused tables and columns;
immutable applied migrations retain the historical definitions only.

**Upgrade modal** triggers on: Google Places import, custom domain setup, removing KrabiClaw branding.

**Starter and Growth are the complete runtime plan model.** Managed and SEO
Accelerator were created as Stripe catalog products but were never purchased or
subscribed to. They are provider-retirement records only and must be archived;
they are not runtime plan identities, historical entitlements, or fulfillment
obligations.

Growth includes priority-support work requests and Facebook integration. The
internal `managed_service` entitlement is the capability key used by those
Growth features; it is not a plan identity. `MANAGED_SERVICE_ENABLED` controls
whether Growth support intake is open and must never expose another plan in a
checkout, transfer, upsell, or catalog surface.

Pending site handoffs do not pause or delete the source owner's custom domains.
Reminders are informational; payment gates ownership acceptance, not the
current customer's live website. Acceptance and cancellation own the
compare-and-set restoration/cleanup saga, including recovery of legacy paused
domain markers.

### Locale model

Non-source locales are manually authored variants. The editor and MCP expose
explicit locale-variant records; there is no automated translation job, review
queue, or translation entitlement in the active product surface.

---

## Current Clients

| Client | Vertical | Template | Locations |
|--------|----------|----------|-----------|
| **Kikuzuki** | Restaurant | Saya | 2 locations — Ao Nang + Krabi Town |
| **Pottery House Krabi** | Experience | Saya | 2 locations — main + beachfront |
| **NCLS** (North Carolina Legal Services) | Professional service | Blawby | Statewide/remote service area — cutover-ready per #194; production DNS cutover is a separate, deliberate follow-up step |

---

## Public Templates

Template selection is registry-driven (`utils/template-registry.ts`'s `publicTemplateRegistry`, resolved via `resolvePublicTemplate()`), not a hardcoded per-vertical `if` chain — a tenant's `theme_id` + `vertical` map to exactly one template definition, and a future third template only needs a new registry entry.

### Saya (restaurant, experience)

Default template for restaurant/experience tenants. SSR-rendered, SEO-first, editorial typography. Location-centric with vertical-aware routing.

#### URL Structure

```
/                              → Home: hero + location/experience entry points + brand feed
/locations                     → All locations grid
/locations/[slug]              → Location home: hours, address, map, menu preview
/locations/[slug]/menu         → Full menu
/locations/[slug]/reviews      → Reviews: aggregate score + star distribution + owner replies
/locations/[slug]/photos       → Photo gallery by category
/locations/[slug]/qa           → Q&A: owner-answered pairs
/locations/[slug]/contact      → Map embed, hours, address, directions CTA
/experiences                   → All experiences grid
/experiences/[slug]            → Experience detail: description, pricing, bookings CTA
/about                         → Brand story
/contact                       → Brand contact form
/reservations                  → Reservation form
/posts                         → Posts / news feed
/menu                          → Site-level menu when published; location menus live under /locations/[slug]/menu
```

Nav: Logo | Locations (dropdown) | Story | Contact | **RESERVE** (primary CTA). Locations dropdown built at runtime from `business_locations`.

### Blawby (service)

Template for professional-service tenants, proven first against NCLS (#194). Offerings default to site-level (not location-scoped), since many professional-service tenants serve a statewide/remote area rather than a single storefront.

#### URL Structure

```text
/                              → Home
/about                         → Brand story, compliance/organization info
/services                      → Offerings index (practice areas)
/services/[slug]               → Offering detail
/pricing                       → Pricing/eligibility, optional structured calculator component
/donate                        → External donation CTA (no native payment processing)
/schedule                      → Consultation entry point (external URL, e.g. Clio Grow, for now)
/contact                       → Brand contact form
/blog                          → Article index
/article/[slug]                → Article detail (canonical — preserved for SEO parity with the NCLS source site)
/policies/privacy, /policies/terms, /third-party-notices → Tenant-owned legal pages
```

Both Saya and Blawby support a blog: Saya's is the shared `posts` primitive rendered at `/posts`; Blawby's is `/blog` + `/article/[slug]`. Structured data for Blawby tenants is generated from platform models (`utils/professional-service-schema.ts`), never pasted as raw tenant JSON-LD.

---

## Integrations

| Integration | Status |
|-------------|--------|
| Google OAuth (login) | ✅ Live |
| WhatsApp OTP login | ✅ Built — blocked on real number registration |
| Stripe billing | ✅ Live |
| WhatsApp Business API | ✅ Built — blocked on real number |
| Facebook / Instagram Graph API | ✅ OAuth + Pages sync + publish built |
| Google Places API sync | ✅ Live — hours, address, rating, reviews (up to 5) |
| Google Places API | ✅ Live — location autocomplete + `import_from_maps` MCP tool |
| Cloudflare R2 media host | ✅ Built — video upload/playback |
| ChatGPT Client MCP | ✅ Live — primary customer creation surface |
| ChatGPT Platform Admin MCP | ✅ Live — internal platform operations only |
| ChatGPT image generation | ✅ Live — `gpt-image-1`/`gpt-image-2` via Responses API |

---

## Architecture

- MCP server is the canonical creation surface; dashboard CMS and ChowBot are secondary
- Short updates use `posts`; long-form articles use `blog_posts` with canonical content documents and blocks.
- `posts` owns website publication. `post_channel_jobs` records only Facebook and Instagram delivery outcomes.
- All location data is CRUD-available in D1; Google Places import is additive and read-only with respect to Google
- Notification delivery is channel-agnostic — `notifications.channel` column means email/push can be added with no schema change
- WhatsApp and Instagram both go through the same Facebook app — single OAuth covers both
- ChowBot is the owner of AI conversations; dashboard and WhatsApp are interfaces over the same D1-backed backend
- Image generation: ChatGPT generates natively → `save_generated_image_file` persists via Cloudflare Images → `show_generated_images` renders the widget. Never pass raw base64 to MCP tools.

---

## Dashboard Model

- **Organization** is the site/brand workspace and billing/team boundary — vertical-neutral: an org can hold a restaurant, an experience business, or a professional-service firm, and (per "One org can have multiple sites" below) can even hold a mix.
- **One org can have multiple sites** — there is no unique-per-org constraint on sites. Sites are explicit everywhere — there is no "first site in org" fallback in dashboard routing or billing.
- One Better Auth organization subscription covers every site in the organization. A new site inherits the organization's effective plan without another checkout. `organization_billing` is the slim sessionless access/payment reconciliation projection of that organization-level authority; authenticated billing management reads Better Auth's documented subscription API.
- Capabilities are computed only from `getPlanEntitlements(effectivePlan)`. There are no site plan, site billing, site entitlement, or organization entitlement projections.
- **Sites** are the primary day-to-day dashboard context and selector. A location becomes the working context only inside that site's location workspace. For Saya (restaurant/experience) sites this is a physical location; Blawby's offerings are site-level by default and don't require a location to have a public street address (a professional-service tenant may serve a statewide/remote area).
- Public tenant routes are template-specific: Saya remains location/experience-centric under `/locations/[slug]` and `/experiences/[slug]`; Blawby is offering-centric under `/services/[slug]` (see "Public Templates" above).
- Dashboard routes follow the Vercel-style workspace shape, with an explicit site segment:
  - `/dashboard/{orgSlug}` — org root; lists sites, auto-redirects to the single site if the org has exactly one
  - `/dashboard/{orgSlug}/sites/{siteSlug}` — site workspace (`siteSlug` is the site's `subdomain`)
  - `/dashboard/{orgSlug}/sites/{siteSlug}/locations/{locationSlug}` — location workspace
  - `/dashboard/{orgSlug}/sites/new` — create another site under this org
  - `/dashboard/{orgSlug}/settings/billing` — the organization's subscription, invoices, and plan management
  - `/dashboard/account/settings` — personal account settings
- App-facing dashboard APIs use `/api/dashboard/*`; the active org/site are resolved server-side from explicit `org`/`site` query params (attached by `dashboardFetch` in `composables/dashboardFetch.ts` based on the route's `orgSlug`/`siteSlug`), not by guessing the org's oldest site.
- **Site transfers move only the site and its tenant data.** Neither organization's subscription nor billing customer moves. After acceptance, the recipient organization's effective plan immediately governs the transferred site; the transfer does not rebuild billing projections.
- Dashboard is home for: billing, org settings, unified inbox (contact inquiries, reservations, bookings, reviews), analytics.

## Language

**Professional-service tenant**:
A tenant whose public site sells expertise, consultation, representation, care, or advisory work rather than food, hospitality, retail inventory, or bookable activities. Legal-services tenants are one kind of professional-service tenant.

**Tenant vertical (canonical contract)**:
The business category that controls public copy, route expectations, schema defaults, onboarding language, and verification rules for a tenant. A vertical is broader than a template and must not be used to hardcode one client.

`SiteVertical` in `utils/vertical-copy.ts` defines the supported values `restaurant`, `experience`, and `service`. The dashboard, onboarding, import pipeline, template registry, and database use these values directly. `service` covers legal and other professional services; it is not a separate template. Do not introduce storage aliases or a client-specific vertical. Readers must preserve all supported verticals rather than narrowing to restaurant and experience.

**Professional-service empty state**:
Fallback or edit-mode copy shown when professional-service tenant content is missing. It may use neutral professional examples in owner-facing edit mode, but public production pages must not leak restaurant, hospitality, retail, or experience wording.
_Avoid_: restaurant fallback, experience fallback, demo tenant copy

**Template**:
A reusable public-site presentation system for a tenant vertical or family of tenant needs. A template may read shared platform content models, but it must not create a separate business model for the same concept.
_Avoid_: theme when referring to rendered page behavior, hardcoded client site

**Template registry**:
The central mapping from a tenant's selected public template to its layouts, route components, navigation/footer components, copy rules, and supported content models. Template dispatch belongs in the registry, not as scattered vertical checks in public pages.
_Avoid_: page-level template branching, hardcoded tenant routes

**Blawby**:
The first KrabiClaw public template for professional-service tenants, beginning with legal-service sites such as NCLS. Blawby is a reusable template, not NCLS-specific behavior.
_Avoid_: legal template, NCLS template, professional template

**Theme token**:
A reviewed template setting that controls presentation values such as typography, colors, spacing, and radii within a supported public template. Theme tokens are platform data with validation, not arbitrary CSS or custom head code.
_Avoid_: custom CSS, tenant stylesheet, hardcoded client styling

**Practice area**:
A legal-facing name for an offering that describes an area of expertise or client need, such as family law or immigration help. Practice areas are not restaurant menus, bookable experiences, or locations.
_Avoid_: menu item, experience, location

**Offering**:
A reusable professional-service content item describing something a tenant can help a client with. Offerings are site-level by default and may optionally be associated with a location; legal templates may label offerings as practice areas.
_Avoid_: experience, menu item, legal service table

**Location**:
A tenant presence used for contact, office, service-area, hours, and routing context. For professional-service tenants, a location may omit a public street address when it represents a service-area or remote/contact presence rather than a physical storefront.
_Avoid_: storefront-only location, fake address, required Google Places location

**Dine-in order**:
A guest order intended for on-site fulfillment at a restaurant location, associated with a service point such as a table or pickup zone. It is distinct from a reservation, a delivery order, and a payment transaction.
_Avoid_: restaurant reservation, delivery order, payment

**Anonymous ordering session**:
The Better Auth Anonymous user/session used to provide guest identity and continuity for native ordering without requiring sign-in or PII. Cart and Order records may reference that Better Auth user; KrabiClaw does not create a second guest-session principal or session table. A QR credential separately authorizes the service point and is not the guest identity.
_Avoid_: custom guest session, ordering context, QR as authentication

**Ordering QR credential**:
A generated, revocable QR credential that routes an order to an explicit fixed Service Point, Service Area, or pickup queue. Businesses may print it on any physical medium—card, disk, table marker, sticker, or sign. The medium is presentation, not the domain object; the QR is not a Better Auth identity or session.
_Avoid_: ordering card as the canonical model, QR as guest identity, arbitrary location note as fulfillment routing

**Service Point**:
A location-scoped, user-named physical or operational target for a Dine-in order, such as a table, seat, bar position, patio spot, pickup point, or named service area. The name is presentation; the point’s stable ID and Ordering QR credential provide routing context. It is not a kitchen station or a guest identity.
_Avoid_: fixed bar-seat type, ordering card, QR as authentication, kitchen station

**Ordering menu**:
The interactive menu used by a guest to build and submit Dine-in orders. It is distinct from the SEO/public menu presentation, even when both are generated from the same published Product/Price catalog.
_Avoid_: SEO menu as the cart, menu item as the whole product model, separate catalog for QR ordering

**Product**:
The stable catalog identity and content record for a sellable offering. Product content is separate from Menu placement, location/channel availability, inventory quantity, and Price records.
_Avoid_: menu item as the combined product/price/placement model

**Price**:
The organization/site/location-scoped sellable monetary definition for a Product. A Price stores an integer minor-unit amount, ISO currency, structured unit (`item`, `person`, or `table`), tax behavior, optional compare-at amount, immutable provenance, and an ISO validity interval. Repricing closes the current interval and inserts a new Price; intervals for one Product may be scheduled but must not overlap. A site's default currency is only a creation default and never rewrites existing Prices. Order lines snapshot the Price and displayed values; changing an amount never rewrites historical order data.
_Avoid_: mutable price field on an immutable order, sale as an untracked total override

**Experience**:
A booking-specific one-to-one extension of Product that uses the same stable ID. Product owns the Experience title, slug, description, visibility, availability, ordering, SEO, audit fields, and Price; Experience owns duration, capacity, slots, inclusions, meeting point, booking data, and other experience-only fields. An inquiry-only Experience has no active Price and may carry one concise `pricing_note`.
_Avoid_: separate experience catalog identity, duplicated title or slug, free-text per-person pricing

**Organization access projection**:
The slim, sessionless application projection of subscription access used by cron and queue work. Better Auth is the subscription authority and authenticated billing management reads its documented subscription APIs; `organization_billing` stores only payment/reconciliation evidence, the correlated subscription ID, `access_plan`, and `access_expires_at`. Capabilities are derived from `getPlanEntitlements(effectivePlan)` rather than persisted entitlement rows.
_Avoid_: site billing, site entitlement, mutable capability projection, direct runtime SQL against Better Auth tables

**Organization activity event**:
An auditable organization-owned action stored in `organization_events`. `organization_id` is required; `site_id` and `location_id` are nullable so membership, invitations, and organization-only work can be represented without assigning an arbitrary primary site. Site dashboards show their scoped activity, while the organization feed includes both organization-only and site events.
_Avoid_: site event for organization-only work, arbitrary primary-site resolution, conversion click duplicated into activity

**Platform scope**:
The reserved organization and site identified by `PLATFORM_ORGANIZATION_ID` and `PLATFORM_SITE_ID`. Platform blog, redirect, and analytics data use these ordinary non-null scopes and the same canonical writers and query paths as tenant data; platform behavior is selected by the reserved site ID rather than a null owner.
_Avoid_: null platform scope, media-only platform constants, parallel platform analytics table

**Order round**:
One immutable guest submission from the current Cart. Multiple Order rounds may accumulate on one open Invoice/check; each round is independently delivered to the merchant handoff and independently idempotent.
_Avoid_: one order per prep station, a new guest session per round, separate invoice for every round

**Invoice/check**:
The canonical running commercial record that groups Order rounds, line items, tax, service charge, discounts, payments, and balance. “Check” is the customer/venue presentation; `Invoice` is the canonical commerce term. It may remain a draft/open unpaid check while the guest continues ordering.
_Avoid_: payment transaction as the order, payment pending as the invoice lifecycle, separate check for each round

**Merchant handoff**:
The boundary where KrabiClaw delivers a canonical restaurant order to one configured external operational receiver and mirrors the receiver’s status. It follows the Uber Eats restaurant integration pattern—notify/fetch, accept or deny, ready-time, ready, cancel, complete—and stops before the receiver’s POS/KDS/kitchen workflow.
_Avoid_: native KDS, station router, fallback kitchen queue, automatic alternate receiver

**Integration destination**:
One location-scoped, Better Auth-authorized external receiver for native order handoff. A location has one active merchant handoff destination and fails closed when it cannot receive orders; KrabiClaw does not silently fail over to another destination.
_Avoid_: provider enum as the order model, multiple automatic receivers, fallback routing

**Tenant page**:
A URL-bearing public page owned by one tenant, such as a privacy policy, disclaimer, notice, or other static legal/compliance page. Tenant pages are not articles and are not reusable field-level content.
_Avoid_: blog post, site content field, platform page

**Blog post**:
Editorial content owned by either the platform or one tenant. A blog post has a draft, published, or scheduled lifecycle and one public path. Platform and tenant repositories share the post contract but keep their authorization transports separate.
_Avoid_: platform blog input for shared post data, tenant page, documentation page

**Redirect manifest**:
A reviewable import artifact that maps legacy tenant URLs to their intended KrabiClaw destination or retirement behavior. It is the source of truth for preserving SEO and conversion paths during a tenant cutover.
_Avoid_: ad-hoc redirects, implicit route compatibility

**Conversion event**:
A tenant-owned visitor action that indicates commercial or operational intent, such as clicking a consultation CTA. Conversion events are first-party KrabiClaw analytics concepts and may be mirrored to configured external analytics destinations.
_Avoid_: tenant-specific tracking hook, custom script snippet

**Site-level review**:
Approved customer feedback about a tenant as a whole rather than one location. A site-level review has no location association but still requires a 1-5 rating.
_Avoid_: testimonial, locationless location review, synthetic review

**Owner-entered review**:
A review collected outside KrabiClaw and entered by an authorized tenant owner with its collection method, attribution, and publication-authority attestation. It is not a verified review unless KrabiClaw collected it directly.
_Avoid_: verified review, unattributed testimonial, ghost review

**Site-level Q&A**:
An owner-maintained question and answer that applies to the tenant as a whole rather than one location. It shares KrabiClaw's Q&A workflow but has no location association.
_Avoid_: location FAQ, Blawby FAQ, static testimonial question

**Consultation**:
A professional-service intake or appointment path for a prospective client. A consultation may be handled by KrabiClaw-native booking or by an external URL, but it is not a restaurant reservation or an experience booking.
_Avoid_: table reservation, experience booking, Calendly-specific booking

**Confirmation page**:
A noindex public success page shown after a visitor submits a contact, reservation, booking, consultation, or other tenant form. Confirmation pages may use short-lived client-side handoff details when available, but they must still render a safe generic success state when the handoff is missing.
_Avoid_: thank-you route as the domain concept, indexed success page, URL-only receipt

**Tenant compliance**:
Tenant-owned legal, regulatory, entity, nonprofit, disclaimer, and notice information that can be rendered by templates and linked from public pages. Tenant compliance is platform data, not legal-template configuration.
_Avoid_: template disclaimer fields, hardcoded legal footer

**Pricing page**:
A tenant-owned public page that explains pricing, payment paths, aid tiers, or service costs. A pricing page may include static sections and optional configured components, but it is not a native payment processor by itself.
_Avoid_: Stripe checkout page, donation page, hardcoded client pricing

**Calculator component**:
An optional configured content component that helps visitors estimate eligibility, cost, or fit using reviewed tenant-specific rules. A calculator component is not arbitrary client-side code.
_Avoid_: custom script, hidden NCLS logic, payment calculation

**Cutover gate**:
A required verification boundary before moving a tenant's production DNS to KrabiClaw. Passing the cutover gate means the agreed route, SEO, media, tracking, content, redirect, and editing checks have passed.
_Avoid_: smoke test, visual approval, soft launch

**Structured data**:
Machine-readable schema.org metadata generated from KrabiClaw's tenant, location, offering, article, compliance, and template models. Professional-service structured data may render legal-service concepts, but it is generated from platform data rather than copied as raw tenant JSON-LD. `utils/professional-service-schema.ts` is the single canonical graph builder for professional-service tenants (see ADR 0016): every route emits a linked `@graph` with stable, canonical-origin `Organization`/`WebSite` `@id`s, `nonprofit_status` is normalized to schema.org's enum (e.g. `https://schema.org/Nonprofit501c3`) at the write layer rather than stored as free text, and a `PostalAddress` is only included when `tenant_compliance.address_visibility` explicitly allows it — resolved from the offering's explicit `business_locations` owner. The shared Organization node has no postal address.
_Avoid_: pasted JSON-LD blob, restaurant schema fallback, template-only metadata, free-text nonprofit status, a second address field on `tenant_compliance`
