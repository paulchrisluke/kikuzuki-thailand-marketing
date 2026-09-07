# ChatGPT submission readiness review

## Epoch 5 contract correction — 2026-09-07

The portal shows version 1.0.0 in Review. The September 6 submission source
(`0c51d393`) and Epoch 5 main (`f7e2d899`) retain all 98 registry tool names
(97 exposed by default), but 28 tools changed input or output schemas.
Posts, hours, experience schedules, media ownership, localization, concurrency
arguments, booking statuses, and primary-location projections changed. The
submitted metadata must be rescanned after the corrected release reaches
production; unchanged tool names do not establish contract compatibility.

The correction removes obsolete `document_updated_at` from the shared blog
output schema, leaving the canonical `updated_at` token. Booking transitions
advertise `openWorldHint: true` and disclose guest confirmation/cancellation
emails. Location notification-phone metadata states that site-wide recipients
are configured independently; it no longer promises a fallback. The existing
page-edit verification script now supplies `expected_updated_at`.

Both generated artifacts were regenerated through the canonical commands.
Local validation passed quality, 187 unit tests, 23 D1 integration tests,
8 migration integration tests, catalog/submission checks, schema drift,
migration and seed guards, and 13 MCP content/owner Playwright workflows against
the production Worker build. The existing blog workflow now validates the real
response against its authenticated `tools/list` output schema.

Release and portal work remain pending. After production verification, cancel
the current review, rescan the same version draft, import the current submission
artifact, review the changed metadata and reviewer cases, and resubmit. Do not
restore retired fields or owner aliases for the old snapshot. This MCP check
does not establish completion of the broader #829 release checklist.

The September 6 review below is historical evidence, not the current portal status.

Reviewed 2026-09-06 against `origin/main` commit `002f289c` in branch `codex/chatgpt-app-submission`.

**Status: approved source changes implemented; portal submission remains pending.** Removed `create_site`, `create_location`, `delete_location`, and `copy_location_batch` from the MCP registry and dispatcher. Deleted the MCP-only location-overwrite helper. Retained media and experience deletion as requested. CMS creation/deletion handlers and their canonical domain operations remain available.

See the [tool scope audit](chatgpt-mcp-tool-audit.md) for the approved boundary. The canonical catalog snapshot and root submission JSON were regenerated using the repository scripts, not hand-edited. No deployment, portal upload, or final submission was performed.

## Existing JSON and generator findings

The regenerated JSON covers 97 default tools, five positive cases, and three negative cases. The canonical schema snapshot contains 98 tools; `get_site_domains` is intentionally excluded by the default conversational feature flag. Compare the authenticated production scan with the final generated set before upload.

The generator now describes existing-site management and sends business setup/deletion requests to the CMS. Positive scenarios require explicit site/location selection; the product synchronization case supplies the full intended list; the post case previews copy in chat before calling the immediately publishing `create_post`. Negative scenarios cover site creation, location duplication, and location deletion.

The generator now requires an explicit reviewed effect for each exposed tool and records credit consumption, external processing, public storage, cascading deletions, and customer-data access. Newly exposed tools without an effect entry fail regeneration. Schema validation does not prove authenticated production readiness.

## Browser draft findings

The supplied OpenAI Platform draft was opened and inspected in Chrome.

- Set and saved the canonical tenant endpoint `https://krabiclaw.com/api/mcp` and selected OAuth. Do not use the internal platform-admin MCP endpoint.
- Starting Scan Tools saved the draft and opened **Authorize MCP**. The scan has not completed; the authorization dialog remains for continuation. No OAuth consent was granted during this review.
- Domain verification remains required. The portal generated a challenge for `https://krabiclaw.com/.well-known/openai-apps-challenge`; a public HTTP check returned 404. Serve the portal's exact current token through the repository's canonical release flow, then verify in the portal. Do not substitute JSON or multiple tokens.
- Corrected and saved the portal listing: existing-site content and booking management, explicit site/location selection, public publication effects, and AI-credit disclosure. Removed unsupported one-step site creation, Google synchronization, and default social-publication promises. Subtitle is “Manage your business website”; category is “Business & Operations”.
- Corrected and saved Plugin Author to `PAUL CHISTOPHER LUKE`, matching the exact selected verified individual identity displayed by OpenAI. The spelling comes from the verified identity, not an invented company name.
- Website, support, privacy, terms, and a YouTube demo URL are already populated. Support, privacy, and terms URLs returned HTTP 200. The live privacy text was reviewed: it lacks retention timelines and explicit MCP customer-data access, public media storage, and AI-provider processing disclosures. The demo plays an unlisted 4:24 recording; sampled footage shows the older KrabiClawAug app adding menu products to Kikuzuki, not the complete current reviewer test suite. Full revised-test coverage and unauthenticated video access remain unverified.
- Directory and composer icons show upload controls. All four populated previews were visually verified in light and dark mode. The existing repository logo is a 512 × 512 PNG; no replacement icon upload was needed.
- Reviewer account access, fixture availability, country availability, starter prompts, skills, and final attestations remain to be reviewed. Do not mark them complete based on source inspection.

## Suggested listing copy

Name: **KrabiClaw**

Subtitle: **Manage your business website** (28 characters)

Category: **Business**

Description:

> Manage your KrabiClaw business website from ChatGPT. Choose a site and location, edit products and experiences, publish announcements and blog articles, update page content and translations, and upload or assign media. Review customer inquiries and experience bookings from your connected workspace. Publishing and content changes can appear on your public website. Some imports and document analysis use AI credits. A KrabiClaw account with access to the selected business is required.

Review this copy against the final deployed catalog and reviewer account before importing it.

## Review checks and limits

- **Sensitive input solicitation:** a field-name scan of the canonical input schemas found no password, API secret, SSN, passport, biometric, credit-card, or MFA fields. This is a supporting scan, not a complete privacy/security audit. The page-replacement `confirmation_token` is an application confirmation value, not an authentication secret.
- **Customer data:** `get_contact_inquiries`, `get_reservation_inquiries`, `list_experience_bookings`, `list_all_experience_bookings`, and `update_experience_booking` expose customer contact/booking information. Their descriptions acknowledge that data. The final privacy review and tests must cover authorized access and prevent cross-tenant/location disclosure.
- **Attachments and external processing:** `upload_user_media` persists files and returns public media URLs. `analyze_document` sends supported document content to the configured AI service and charges credits. `import_products_from_media` sends an image/PDF to AI, charges credits, and persists extracted products. Justifications and reviewer scenarios need to describe these differences accurately. Avoid using private customer documents in reviewer fixtures.
- **Naming/descriptions:** The misleading location-creation tool and its overwrite branch have been removed. The saved portal listing still needs correction as noted above.
- **Widget CSP:** the current tenant endpoint returns an empty resource list, rejects resource reads, and does not emit a widget resource URI in `tools/list`. No tenant widget CSP is exposed to audit; do not claim that a widget UI has passed testing.
- **Output schemas:** every tool in the committed canonical tenant schema snapshot has an `outputSchema`. Presence is not proof that real results conform; authenticated runtime validation remains outstanding.
- **Live auth discovery:** protected-resource metadata returned HTTP 200 and the correct tenant resource URL. OpenID metadata returned HTTP 200 and advertised UserInfo, `openid`, `email`, `email_verified`, and PKCE S256. An unauthenticated `tools/list` returned HTTP 401 with the expected OAuth discovery challenge. A real UserInfo email-verification response and authenticated tool calls have not been tested.
- **Scope of review:** inspected the tool registry, shared annotation table, schema snapshot, generator, transport, all domain executor families except deeper helper paths not needed to establish the blocking finding, and selected domain helpers. This is a blocker review, not a completed audit of every transitive helper. Validation of the approved changes is recorded below.

## Remaining sequence

1. Finish the retained-tool justification and privacy review.
2. Follow the canonical release contracts for the reviewed source and domain verification challenge.
3. Complete OAuth authorization and Scan Tools in the portal; compare the deployed catalog with the generated artifact.
4. Complete reviewer access, identity, icons, demo, policy, prompt, and availability review.
5. Upload the regenerated JSON only after these blockers are resolved, then review the imported draft before final submission.

## Validation of the approved source change

- Node 24.18.1; immutable dependency installation and canonical `local:setup` completed in the isolated worktree.
- Typecheck and focused ESLint passed.
- All 196 unit tests passed.
- All 15 tests in `mcp-owner-tools`, `mcp-content`, `mcp-product-large-batch`, and `mcp-product-nullable-price` passed against the locally built production Worker on port 3107. The original checkout's port 3000 server was left running.
- Runtime coverage confirms CMS location creation/deletion, omission and rejection of all four retired MCP names, and continued discovery of media/experience deletion. Existing daily product, post, media, and experience workflows passed the selected suite.
- `mcp:catalog` and `chatgpt:submission:check` passed after regeneration. The default submission set contains 97 tools, including `delete_media_asset` and `delete_experience`, with five positive and three negative cases.
- No deployed-preview, staging, production, authenticated portal-scan, or final submission validation was performed. The local test server exited after the suite.

## Official guidance consulted

- [Submit plugins](https://developers.openai.com/plugins/deploy/submission): current form, tool hints, five positive/three negative test cases, reviewer access, publisher identity, domain challenge, and OAuth UserInfo requirements.
- Requested skill: `/Users/paulchrisluke/.codex/plugins/cache/openai-curated/openai-developers/11c74d6b/skills/chatgpt-app-submission/SKILL.md`.

The skill was found in the local OpenAI Developers plugin cache. No plugin installation was needed.

## Pre-push gate update — 6 September 2026

The owner explicitly authorized bypassing staging for this submission release, conditional on reviewer credentials, demo, icons, privacy disclosures, listing corrections, and retained-tool review before pushing main. This is a user-directed release exception; no production incident is claimed. No migration or database change is included. No push or deployment has happened.

- **Reviewer access is blocked:** the portal Testing page's Test credentials field is empty. The corrected reviewer account is being created through the normal email signup flow; credentials and fixture access have not yet been tested. Never substitute the owner's production account or a customer's site. All five scenarios must run against the eventual sample-only reviewer workspace.
- **Domain challenge prepared:** `public/.well-known/openai-apps-challenge` contains the exact token shown in the portal and owner screenshot. The production build includes it unchanged. Live deployment and Verify Domain remain outstanding.
- **Icons and listing:** complete as described above; saved status was observed after the corrections.
- **Tool effects:** retained-tool source review now includes localization authoring reads, analytics reads, workspace preference writes, product/category cascade deletion, review replies, and booking cancellation. Analytics reads do not run the aggregation writer. Localization reads do not provision missing records. Review replies update the website record, not Google. Booking cancellation revokes the associated review request. No additional tool removals or hint changes were required by this scope review.
- **Validation:** regenerated submission schema/check and focused generator lint pass. The production build and local Worker challenge check passed after supplying the same explicit public environment variables as Playwright: HTTP 200 and an exact token-byte match. The initial standalone launch omitted those build-time variables and failed; the corrected launch succeeded.

### Privacy and reviewer follow-up

- Owner authorized preparing a new reviewer account and keeping credentials in a private `.env`. Existing `CANARY_LOGIN_EMAIL` and `CANARY_LOGIN_PASSWORD` are empty. The reviewer identity was corrected at the owner's request to `bamboo.chow+chatgpt-review@gmail.com`; account creation, email verification, non-admin authorization, and sample workspace are pending. The private file is ignored by Git and mode 0600. No password is stored in this report or submission JSON.
- The first live signup navigation displayed Error 500. A diagnostic reload rendered the signup form successfully. No matching exception was captured by the subsequently attached tail; cause is unresolved, so this is not a verified bug fix. A later account screen showed the owner's existing Google identity, not proof of reviewer creation. The owner session was signed out in the in-app browser and the corrected email signup was prepared.
- Live Cloudflare AI Gateway settings were read through its API using existing credentials, without reading request payloads or changing settings: collection enabled, 100,000-entry limit, `DELETE_OLDEST`, no Logpush, cache TTL 0. This does not establish a fixed maximum age.
- The privacy page now has a source-supported draft covering customer information, OpenAI tool results, public media URLs, Anthropic/Cloudflare processing, current retention, backups, and user controls. It explicitly discloses that application tool/usage records and deleted-media metadata have no automatic expiry. It does not falsely claim the suggested 30-day log policy is implemented. Cloudflare D1 recovery can retain history for up to 30 days; separate release copies have no automatic removal schedule. The updated page was built, served with HTTP 200, and visually inspected in the local Worker. No production retention changes or deletion jobs were added.
- References: https://developers.cloudflare.com/api/resources/ai_gateway/ ; https://developers.cloudflare.com/d1/reference/time-travel/ ; https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data .

Final local check: challenge HTTP 200, `Content-Type: text/plain; charset=utf-8`, exact token bytes; privacy HTTP 200 with provider and retention disclosures. Latest production build, focused page/generator lint, submission consistency check, and `git diff --check` pass. A fetch confirmed no newer commits on `origin/main` at this checkpoint. Nothing has been pushed or deployed.

### Verified reviewer membership and onboarding routing

The owner verified `bamboo.chow+chatgpt-review@gmail.com` and explicitly authorized sending its demo invitation as Admin. The invitation was sent through the existing organization Members UI, then accepted through Better Auth using that account’s own credential session. A fresh login verified email verification, platform role `user`, organization membership only in `org-demo` (Ember & Slice), organization role `admin`, and a default redirect to `/dashboard/ember-slice-demo`. This does not grant platform-admin access. Credentials remain only in the ignored, mode-0600 `.env`.

Before membership, the default login router sent this verified, organization-less account to `/dashboard/account/profile`. The source now sends users without organizations to the existing `/dashboard/onboarding` page. Explicit safe return targets, including profile, are preserved. A new real local Worker test passed both routes; focused ESLint and `git diff --check` passed. This fix remains undeployed.

Authenticated production MCP reads `get_workspace_context` and `list_sites` succeeded with the reviewer credential session and returned only `site-demo`, with Brooklyn and West Village demo locations; `isPlatformAdmin` was false. An initial diagnostic used the nonexistent name `get_context` and correctly received an unknown-tool protocol error; the canonical name then passed. OAuth/ChatGPT host testing and the revised five-case workflow remain separate outstanding checks.

### Explicit release authorization

The owner accepted the existing demo video as representative of the app’s MCP capabilities and explicitly instructed “you can push to main now.” This confirms the earlier staging bypass for this submission release. Preview/staging qualification and the revised five-case reviewer run are incomplete and are not represented as passed. No incident is claimed. The reviewed source has passed the local build, 196 unit tests, 15 focused MCP runtime tests, the onboarding runtime test, and catalog/submission consistency checks.

After the normal main-branch deployment, verify the public domain challenge and privacy page, authenticated reviewer tool discovery and tenant reads, and the production CI customer-domain verification. Domain verification, final portal scan/import, and submission remain separate from this push. No schema migration or production fixture seeding is included.

### Production and submission continuation

Commit `dba9a0b0` was pushed to main under the owner's explicit staging-bypass authorization and deployed successfully. CI run https://github.com/paulchrisluke/krabiclaw/actions/runs/34026544662 passed Checks and Deploy production. Production verification passed 12/13 customer tests; Pottery House `/th/about` returned 200 with English content instead of 404. The owner requested that issue be tracked separately and submission continue: https://github.com/paulchrisluke/krabiclaw/issues/843 . No locale fix or weakened test was included.

Live challenge token bytes and text/plain content type matched, the privacy page served the new disclosures, and OpenAI Platform displayed Domain verified. Reviewer-authenticated production tools/list returned exactly the generated 97-tool set. Context/site reads returned only the demo site.

Reviewer runtime checks used org-demo/site-demo/loc-demo-2 (Ember & Slice West Village). Discovery, category/product creation with null price and Market Price wording, complete catalog reconciliation with THB 80/60/20 inclusive prices, post creation, and experience creation with 120 minutes/THB 1500 per person excluding tax succeeded. Reconciliation omission behavior passed, and original demo product availability was restored through update_product. The first cleanup request included unsupported location_id and was rejected; corrected canonical arguments succeeded and readback confirmed all eight demo products available. Sample Submission Sushi/Drinks categories, Chef's Choice, three drinks, Submission test post, and Submission cooking class remain as reviewer sample content. No customer site was written. These were direct MCP runtime tests, not evidence of ChatGPT confirmation gating or tool selection.

Portal rescan OAuth returned to the form. JSON browser-file upload failed with an extension file-access restriction. The native picker selected the generated JSON, but no import success or populated testing fields was verified. Desktop click/scroll subsequently reported no usable window; continuation requires a working foreground desktop surface. Do not call the draft imported or submitted based on file selection alone.

## Submitted for review — 2026-09-06

OpenAI confirmed “KrabiClaw submitted for review” and displayed the locked review version. The owner explicitly approved all final publisher attestations. The OAuth scan returned 97 tools; all 291 annotation explanations were filled from the reviewed generator. Domain verification, reviewer credentials, five positive cases, three negative cases, and release notes were included. JSON was regenerated from source but not imported, per owner direction.

The final positive cases cover menu creation, menu price/description updates, sold-out availability, experience content, and experience price/duration. All five operations succeeded through production MCP using the dedicated demo reviewer identity, with readback confirming their results. This is MCP runtime evidence, not a real ChatGPT-host test. The newly created test item was removed and Tea availability restored so reviewers can repeat the create and sold-out cases. Translation is excluded from the review cases because the demo has English only.
