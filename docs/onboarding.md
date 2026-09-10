# Onboarding

## Principle

Global first, local second, persistent after that.

- **Site/org level** (once per site): brand, currency, timezone default, team, ChatGPT app, socials, core offering.
- **Location level** (once per location, repeats on every new location): hours, contact, notification destination, location hero/media, location-specific copy.
- Onboarding is not a single linear wizard that ends at "Create site." The wizard collects the first handful of critical steps; everything else is done from the dashboard after the site exists. The wizard itself loads no checklist; `server/utils/onboarding-checklist.ts` feeds the organization analytics report only.

## Current flow

The flow is draft-first, and this is the one and only new-site creation path:

`OnboardingWizard.vue`: `welcome → vertical → source → url/manual name → confirm → location → contact → currency → hours → brand → hero → draft_ready → create → imported`. The `imported` step offers one action, "Open my dashboard"; there are no post-creation handoff cards.

- The first real business identity creates an active draft through `POST /api/dashboard/onboarding/drafts/active`: manual name entry creates a manual draft, and confirming a Google listing creates a Google Places draft. Completed onboarding sections patch that same active draft, and the preview renders from `/preview/draft/:draftId` until commit.
- `commitDraft()` turns that draft into a real site via `POST /api/dashboard/onboarding/drafts/[draftId]/commit`, which calls the same `runSiteCreation()` used by the only other site-creation entry point, `POST /api/sites` (the dashboard's "add a site to this organization" form). Both pass the target organization explicitly: `/dashboard/onboarding` is the "New Organization" entry point, so a draft never carries an organization and the commit creates a new one named after the brand (recorded on the draft so a retried commit reuses it) and makes it the session's active organization; `POST /api/sites` takes the organization from the dashboard route's `org` query or an explicit `organizationId`.
- Adding a location to an *existing* site is a separate mode of the same `OnboardingWizard.vue` component (`mode="add-location"`), and creates exclusively through `POST /api/dashboard/locations/add` — that endpoint owns both the Places-preview lookup and the mutation for add-location.

## Content state model

Generated placeholder rows are no longer part of onboarding or site creation. Tenant pages, menu items, and media are either owner/imported records or absent. Missing content is omitted or returned as an explicit empty/error state.

## Step inventory

### Site-level (once per site)

| # | Step | Required | Lands on |
|---|---|---|---|
| 1 | Business basics (Maps import or manual: name, vertical, address, contact) | Required | Wizard |
| 2 | Draft preview (private, current architecture) | Proposed (not currently step 2) | Wizard → `/preview/draft/...` |
| 3 | Brand — brand color and logo | Optional (skippable) | Wizard active draft |
| 4 | Homepage hero — hero photo, headline, and description | Optional (skippable) | Wizard active draft |
| 5 | Operations — timezone, currency, notification phone | Required | Wizard |
| 6 | Core offering — menu (restaurant), experiences (experience vertical); professional-service offerings | Required, most prominent step | Wizard, deep-linkable to dashboard CMS later |
| 7 | Story — about, founder story, FAQ seeds | Optional | Dashboard CMS |
| 8 | Channels — Facebook/Instagram, ChatGPT app install, ChowBot intro | Optional | Dashboard (not part of the wizard) |
| 9 | Team — invite admins/editors | Optional, explicitly skippable | Dashboard settings |
| 10 | Launch readiness — domain, final review, publish | Required to go live, not required to keep working in draft | `/dashboard/[orgSlug]/sites/[siteSlug]/domains` |

### Location-level (once per location, including the first)

Only asked again on **add-location** (`OnboardingWizard.vue` `mode="add-location"`), never re-collects site-level brand/ops:

- Location title, address, hours, phone
- Notification routing for this location
- Location hero/media (uses location media only; it remains empty until supplied)
- Optional location-specific notes/social
