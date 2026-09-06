# Adversarial review report

## Verdict

**Approve with conditions.** Three proven runtime SQL findings were accepted, corrected, and independently rechecked at `dd5712068f3aea548a7bdabfea4d4b56c606648d`. No unresolved implementation blocker remains from this review. This verdict requires the root agent's final build, full D1 suite, Codex browser checks, and scheduled CI verification before declaring staging ready. It does not authorize production promotion.

## Review contract

- **Known:** Review target is issue #829, integration worktree `krabiclaw-829`, initially `6a8fc889b5ca7a9608871fa5543b99d344be09b9` against `cef114150de67cd8bb51a6896b57c097c8f7960a`, with accepted corrections inspected through `dd5712068f3aea548a7bdabfea4d4b56c606648d`.
- **Known:** User requires a complete Epoch 5 schema/runtime cleanup, no backward compatibility, preserved data and provider continuity, browser evidence, one completed push followed by scheduled CI checking, and staging only. Production review/promotion belongs to the user.
- **Known:** Applicable contracts are AGENTS.md, release-flow, release-and-outage-prevention, testing-strategy, `.audit/issue-829.md`, and `docs/database/epoch-5-cutover.md`. No application or migration edits were made by this review.
- **Known:** The generated baseline has 94 tables. This reviewer previously exercised baseline constraints through SQLite and baseline-dependent workflows through real D1, and reviewed the closed-vocabulary source/writer evidence. Root owns the final expanded D1 run and transformed-export report.
- **Known:** Runtime source inspection and fresh SQLite execution are direct evidence in this report. Root's production transform hash/FK/invariant PASS and pending browser/build results are attributed evidence, not independently repeated claims.
- **Inferred:** All registered cron paths will execute against the same active epoch schema; they must compile even when their candidate tables are empty.
- **Unknown at review completion:** Final production bundle success, final full D1 result, authenticated browser behavior, staged provider/webhook behavior, and final remote CI outcome. These are release gates with the root agent as owner.

## Decision register

| Decision | Purpose | Assumptions | Failure probes | Evidence | Simpler alternative |
| --- | --- | --- | --- | --- | --- |
| Replace the active baseline and retire obsolete columns | One schema/runtime contract with no compatibility path | Every active SQL reader and writer matches Epoch 5 | Prepare static queries; trace dynamic projections; compare retired identifiers with callers | 1,007 static SQL candidates inspected against fresh baseline; three findings resolved; two dynamic sendDue branches executed | Delete stale projections and use existing canonical tables, as implemented |
| Structured post topics and shared validation | Same standard/event/offer/alert shape across dashboard, MCP, and public rendering | Stored records and all writers use the canonical topic union | Invalid topic fields, event schedules, CALL location, alert media, sparse type changes, scheduling | `shared/posts.ts`, `post-management.ts`, MCP/post routes, topic CHECKs; no additional proven failure found | Keep the single validator and existing placement API |
| Shared availability calculation plus conditional booking claim | Prevent stale advertised slots and concurrent overbooking | Claims enforce current schedule, override, capacity, and owner state atomically | Hours changed after read; capacity contention; DST gap; exception/closure; accepted proposal retry | `availability.ts`, public reservation/experience writers, guest-thread booking changes; predicate is included in the insert; subsequent writes depend on the inserted decision row | Existing single calculator and D1 batch; no second booking model |
| Scoped content documents and polymorphic media ownership | Prevent dangling/cross-site ownership through edits, deletion, and transfer | Owner registry and actual owner queries agree; writes guard live ownership | Owner deletion/transfer between read and insert; invalid active asset; reorder race; alert cover | `content-documents.ts`, media placement owner query and guarded insert, replacement/reorder paths, transfer table policy | Existing owner registry, FK scope, and conditional insert |
| Reparent owned data and explicitly retain/revoke other transfer resources | Preserve records without transferring organization-owned authority | Reparent list matches schema; billing snapshot and transfer state remain current | Concurrent accept/cancel; changed billing; locale/license ownership; source organization changed | `site-transfer.ts`, `shared/site-transfer-policy.ts`, deferred FK batch and final assertions inspected | One existing transfer transaction; no historical compatibility branch |
| Better Auth owns provider identity while application billing remains a projection | Preserve authentication, paid access, and inbound continuity across cutover | Provider ownership is normalized before production drops legacy reader | Missing billing IDs, raw token history, webhook transition, cron projection | Cutover prerequisites and canonical billing reader; cron stale columns found and removed | Delete unused cron fields; no additional Stripe lookup or provider write |

## Resolved findings

### AR-01. Registered scheduled integrations selected removed billing columns

| Field | Detail |
| --- | --- |
| Severity / confidence | High / high confidence |
| Scenario | After Epoch 5 binding, weekly Places sync and hourly Instagram/review automation prepared queries selecting `ob.stripe_customer_id` and `ob.stripe_subscription_id`, removed from `organization_billing`. Query compilation failed before processing candidates, including empty tables. |
| Evidence | Original `google-places-sync.ts:76`, `instagram-sync-process.ts:70`, `review-request-automation.ts:82,115,152,166`; registration in `server/scheduled-tasks.ts:33-34`. Exact first queries reproduced `no such column: ob.stripe_customer_id` on the generated baseline. |
| Impact | Location sync, social sync, booking completion, and review request scheduling fail after cutover. |
| Correction | Removed both unused DTO fields and SQL projections in all three task files. `scheduled-billing-access.ts` continues to validate the canonical organization billing projection. |
| Verification | Repeated static-query preparation after integration returned no missing columns. Both dynamic `sendDue` branches (`first`, `reminder`) executed successfully against fresh Epoch 5. Resolved at reviewed head. |

### AR-02. Tenant sitemap queried product fields from experiences

| Field | Detail |
| --- | --- |
| Severity / confidence | High / high confidence |
| Scenario | Public tenant sitemap generation entered its parallel query set and selected `slug`, `status`, and `robots` from `experiences`, where these fields belong to the canonical product row. |
| Evidence | Original `server/plugins/sitemap.ts:254`; exact `cef114150` query reproduced `no such column: slug` against both archived Epoch 4 and Epoch 5. `experiences.location_id` is valid and was not the defect. |
| Impact | Tenant sitemap generation fails, including sites with no experience rows, because SQL compilation fails. This was pre-existing, accepted by root as a direct blocker to complete schema/runtime cleanup. |
| Correction | Join `experiences` to its scoped `products` row; select product slug/update time and filter canonical visibility/robots. |
| Verification | Corrected query prepares successfully against Epoch 5. Public sitemap browser/HTTP verification remains part of root release verification. |

### AR-03. Dashboard QA scope enumeration referenced retired table

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / high confidence |
| Scenario | Dashboard QA page called `/api/editor/sites/:siteId/qa/scopes`; the authorized endpoint queried nonexistent `site_qa`. |
| Evidence | Original `server/api/editor/sites/[siteId]/qa/scopes.get.ts:9`, active caller `pages/dashboard/[orgSlug]/sites/[siteSlug]/qa.vue:121`; exact original query failed against both Epoch 4 and Epoch 5 with `no such table: site_qa`. |
| Impact | Dashboard QA scope enumeration fails. This was pre-existing, accepted by root within the full schema/runtime audit. |
| Correction | Use existing `location_qa`, retaining site and page-scope predicates. |
| Verification | Corrected query prepares successfully against Epoch 5. Dashboard QA browser verification remains part of root release verification. |

## Cleared concerns

- Public and guest-thread booking paths use the shared availability snapshot and the same SQL claim predicate. Accepted-proposal source updates depend on the newly inserted decision entry; a lost claim does not silently update the booking. No separate capacity algorithm was found in the reviewed paths.
- Media placement inserts check live owner scope and active asset status in SQL, including the alert-post restriction. Reorder membership checks and uniqueness constraints preserve the current collection instead of restoring a stale client list.
- Transfer uses explicit reparent/retain/revoke lists and a deferred-FK transaction with source, billing, and pending-transfer assertions. Canonical content-document site scope follows the retained site; historical organization-owned communications are deliberately retained rather than rewritten.
- Retired-column searches distinguished valid DTO projections (`public_url`, custom-domain state), distinct provider-owned customer/invoice fields, and historical transform input from stale runtime SQL. No compatibility reader was added to fix the cron failure.
- Closed enum restrictions were based on owned writer sets. Historical ChowBot/provider vocabularies, legal entity schema types, and offering schema types remain deliberately open; no speculative enum restriction was requested.

## Comment Sicko follow-up

No new narrative comment blocks were introduced in the inspected late domain/media/transfer diff, so this read-only follow-up deleted zero comments. The `availability_claim` SQL marker is functional and must remain. The retained three-line `oauthAccessToken.scopes` comment referring to the now-retired `oauthClient.scopesJson` workaround was flagged to root for deletion. Earlier comment-only cleanup and contact-state cleanup were already integrated and are not counted again.

## Coverage and limits

Applied code-change and operating-contract review to post/hour contracts, atomic booking claims, content/media ownership and transfer, retained auth/billing/inbound continuity, schema/runtime SQL, fixtures, and stale compatibility paths. Read the cutover and issue audit, canonical source modules, relevant route callers, task registration, transfer policy, and baseline constraints. Prepared 1,007 static SQL candidates in an ephemeral SQLite database and separately executed both dynamic review-request SQL branches. This is an audit probe, not a committed test that inspects production source text.

The static scan excludes interpolated SQL that cannot be resolved without runtime inputs and only reports missing table/column and foreign-key mismatch classes; it does not prove all query semantics. Reviewed dynamic ownership and booking paths by source trace. No network provider mutations, pushes, schema edits, or browser operations were performed by this reviewer. Root is responsible for final build/D1/browser results and the scheduled remote CI gate. Production promotion is explicitly outside this review's authorization.

## Late runtime fix review

Reviewed the social-card owner pagination working diff and `nuxt.config.ts` after `9554d2c2e2d37fb691db71f7736b93d18f590836`.

The prior ten-owner compound query exceeded the local D1 compound-SELECT limit during root's `local:cards` runtime check. The replacement keeps the existing registry and performs one bounded query per owner type. Lexical sorting of the current ASCII owner keys agrees with the original SQL type order; per-owner IDs remain ordered by SQLite. Every query applies the same exclusive `type:id` cursor. Empty owner types do not consume the remaining page limit, the page stops exactly when full, and omitted limit remains SQLite's unlimited `-1` for brand refresh. The existing regeneration caller still fetches one extra row and returns the last processed cursor only when another row exists. No fallback or duplicate query path was introduced. No source-level correctness finding was identified; direct D1 pagination evidence is recorded below when complete.

For the SSR fix, `makeAbsoluteExternalsRelative: false` changes how Rollup emits resolved external paths without changing the existing external matcher. Rollup documents that this setting preserves resolved absolute paths rather than recalculating them relative to a guessed bundle root. This matches the reported intermediate SSR path failure. [Rollup configuration reference](https://rollupjs.org/configuration-options/#makeabsoluteexternalsrelative)

Independently inspected the generated `.output/server/_libs/@nuxt/nitro-server.mjs`: both shared registry modules are bundled into the server output, and the emitted server files contain no top-level imports of those registry source paths or the local workspace absolute path. Root reports the production build passed after the setting; browser/card-generation rerun remains root-owned. The stale OAuth `scopesJson` workaround comment is now deleted.

**Direct D1 verification: PASS.** Imported the actual `listSocialCardOwners` implementation through the repository's existing Node alias hook, created a fresh Miniflare D1 database from the full Epoch 5 baseline, and seeded synthetic organization/site/location/platform-document owners. Fifty-four assertions covered an independent expected global owner sequence, unlimited reads, page sizes 1/2/3/5/6/20, concatenation across owner-type boundaries, empty owner types, platform-document scope, absent sites, limit zero, exact/between/past-end continuation cursors, and site isolation. All passed without mocking internal modules or inspecting source text in a committed test. The ephemeral probe is outside the repository; no application/test edits were made.

**Late-fix verdict: approve with the existing release conditions.** No new implementation findings remain from these two changes. Root's full runtime card generation and browser/CI gates still apply.

## Final pinned validation

Ran all commands through Node `24.18.1` at `C:/Users/Admin/AppData/Local/npm-cache/_npx/24aa3b703aefc117/node_modules/node/bin/node.exe` and `C:/Program Files/nodejs/node_modules/corepack/dist/corepack.js`, with the same Node directory first on PATH for child commands.

- Unit suite: 187 passed, 0 failed, 0 skipped. Unit policy: 41 files, 187 tests, 3163 lines.
- MCP catalog, ChatGPT submission artifacts, seed guardrails, migration guardrails, and Epoch 5 schema drift: all passed.
- Quality chain: all static guards, Thai catalog validation, and typecheck passed. ESLint identified one unused `test` import left by the root's Playwright startTime logging removal. Removed that unused import and corrected a lone carriage return in `tests/e2e/helpers.ts`; restored its original LF formatting so the diff remains focused. The full lint rerun then passed with zero warnings/errors.
- `git diff --check`: passed. No build, fixture reset, D1 mutation, provider call, or application edit was performed during this validation task.
- Late deslop inspection: no material implementation issue found. Only the test import/line-ending cleanup above was needed; existing review gates still apply.

Private command logs are in the local TEMP directory with prefix `829-final-`; they are not repository artifacts.

## Public homepage visual follow-up

Viewed all six root-supplied full-page screenshots for Pottery House, Kikuzuki, and NCLS at 1280px and 390px. Repeated read-only local browser navigation with tenant-scoped request headers for Pottery House and Kikuzuki, scrolled their pages to activate lazy content, waited for image decoding, and viewed four additional settled screenshots. Both sites then had zero broken or pending images. The previously blank Pottery post/blog images and Kikuzuki location/story images appeared after scrolling. Kikuzuki measured exactly the viewport width at both sizes.

Pottery House has a **pre-existing adjacent layout defect**, not a capture-only artifact: document width settled to 1287px at a 1280px viewport and 445px at a 390px viewport. The concrete overflowing element is the compact review card's long location chip, `Pottery House — Beachfront at Klong Muang`, styled `shrink-0` inside an unwrapped flex footer (`components/saya/SayaReviewCard.vue:15-23`). Both this exact layout and the location title existed at `cef114150`. The issue diff only adds Google attribution below that footer; it does not change the overflowing layout or label. No adjacent CSS fix was made under the bounded review instruction.

NCLS supplied desktop/mobile screenshots were inspected. Its additional settled-image run was stopped before completion so root could stop the Worker and reset local D1; no claim of completed NCLS image decoding is made. All reviewer browser processes were terminated before root's reset. No fixture/data/build/application changes were made in this visual task. Private captures are under TEMP `krabiclaw-829-private/visual`, including the four `*-settled.png` captures.
