# PR 864 current publication and owner-comment audit

Retrieved at 2026-09-08T04:59:15.000Z through fresh `gh api --paginate --slurp` calls to all three endpoints: issue comments, pull-request review comments, and reviews. The result contains 15 issue comments, 7 inline comments, and 5 reviews. The full bodies, author, endpoint type, URL, timestamps, and SHA-256 body hashes are retained in `current-comment-index.json`. This reads current edited bodies, not an append-only comment-ID ledger. Review objects expose submitted time rather than an updated_at field; their current body hashes are retained as the edit-sensitive evidence.

GitHub currently reports OPEN and Draft, with pushed head `64d5ab164455b40fb52529d8673f32ce5d7e7afd`. This audit reviews that head plus the current uncommitted implementation batch. It is not a qualification verdict for a future commit. The earlier `full-obligation-audit.md` omitted owner comments 5578745078 and 5578932432 and is superseded as a completeness claim.

## Verdict

No additional missing owner-requested source change was demonstrated in this pass. The publication implementation is present across canonical schema, transfer, domain functions, API/MCP contracts, and public preview adapters. Runtime qualification of the combined batch remains pending. The local Worker was found to be using an older initialized schema; root is correcting the local setup through the canonical path. That is not evidence that a current draft write succeeds. Do not mark Ready or push for qualification on this audit alone.

## Publication request 5578745078

| Obligation | Source inspected | Finding |
| --- | --- | --- |
| 1. Permit article and social-post draft roots in schema and regenerated baseline | `server/db/schema.ts:1349`, `migrations/0000_epoch_6_baseline.sql`, generated metadata | Both root kinds admit draft. Q&A remains outside this publication check. The social schedule check explicitly requires draft to have no scheduled/published timestamp. Schema generation artifacts are present; do not apply the changed baseline over initialized resources. |
| 1. Do not invent a status backfill | `scripts/epoch6-data.mjs:96-153` | The new projection changes social visibility only. It does not rewrite publication status. Existing timestamp and Markdown transformations remain explicit. |
| 2. Require public/unlisted on social roots | `server/db/schema.ts:1351`, `shared/posts.ts:45`, `server/utils/post-management.ts:330`, `seed-definitions/contracts.ts:225` | Visibility check includes articles and social posts. Social create defaults to public; the write contract admits public/unlisted and reads return the value. |
| 2. Project legacy social NULL to public, with declared column and count | `scripts/epoch6-data.mjs:105-108`, `:126-131`, `:150`, `docs/database/epoch-6-cutover.md:51-66` | Source census requires the known NULL shape, projection declares visibility as changed, and manifest count is checked against the source census. Unexpected source values fail rather than fall back. The owner's 7 rows is not a fixed expected count; the current cutover document records a newer 15-row rehearsal. Frozen-export counts must be measured again. |
| 2. Keep new imported/fixture social rows valid | `server/utils/facebook-pages.ts:443,531`, `server/api/dashboard/onboarding/drafts/[draftId]/commit.post.ts:278`, seed contracts/generation and demo/Pottery definitions | Canonical social writers set public visibility. No manual staging/production data repair is part of this implementation. |
| 2. Remove unlisted social posts from discovery, retain direct URLs | `server/utils/post-management.ts:709,743,778`, `server/plugins/sitemap.ts:160` | The shared published collection requires public visibility. Direct root and localized detail still require published status without requiring public visibility. Sitemap excludes unlisted social roots. Visibility updates invalidate the shared public resource cache. |
| 3. Signed one-hour article preview URLs | `server/utils/platform-content.ts:539-560` and its list/detail/create callers | `contentReviewUrls` signs scope article and root ID for one hour. Non-published public_url remains null. Missing signing configuration fails explicitly before an unpublished create persists. |
| 3. Actually render previews | `getPublicSiteBlogPost`, `getPublicLocalizedSiteBlogPost`, `getPublicPlatformBlogPost` in `platform-content.ts`; platform/tenant blog APIs; Saya/platform blog pages; `useBlawbyDocument.ts`, `public-blawby-document.ts`, `professional-services.ts` | Existing reads accept a token after tenant/slug/category scoping and verify against the stored root ID before loading content. Platform, Saya, and Blawby adapters propagate token. All old read names were migrated without aliases. |
| 3. Keep preview separate from published/unlisted access | `preview-token.ts`, `public-blawby-document.ts`, `seo-indexing.ts`, `public-html-cache.ts`, existing HTML KV middleware/plugin | Invalid/expired/wrong-article/wrong-scope tokens cannot authorize draft data. Token requests bypass shared document/HTML caching and receive private/no-store and noindex headers. Client cache keys include token; canonical SEO paths do not. Public indexes receive no token exception. |
| 4. Article create defaults to draft | `server/utils/platform-content.ts:984-1002`, `platform-content-request.ts`, `server/types/platform-content.ts`, tenant/platform MCP create schemas | Default is draft; a future schedule yields scheduled; explicit published is accepted. Conflicting status/schedule combinations fail. Both publication timestamps are null until first publication. |
| 5. Widen specified unions and add draft listing | `platform-content.ts:204,784`, `post-management.ts` Post type, `seed-definitions/contracts.ts:225`, `lib/components/workspace/blog/types.ts:22,101`, `pages/admin/blog/index.vue:55`, MCP list schemas | All six requested type sites include draft. The canonical article list filters draft explicitly. New dashboard controls remain #868. |
| Published never becomes draft or scheduled | `updatePlatformBlogLifecycle` around `platform-content.ts:1040-1075`, `post-management.ts:418-421`, `shared/posts.ts` | Article lifecycle mutation accepts only draft/scheduled source rows. Content updates cannot smuggle lifecycle fields through the ordinary editor patch. Social writes reject rescheduling published rows and clearing an existing schedule. Visibility changes preserve publication history. |
| Draft can schedule; scheduled can publish | Same lifecycle function, `publishDueBlogPosts` in `blog-publishing.ts:7-25`, social scheduler and publish functions | Article draft can enter scheduled directly. Due scheduler sets first publication time once and clears scheduled_for. Social create/update/publish paths retain matching semantics. |
| Q&A unchanged | Schema publication/visibility predicates and Q&A writers | No requested draft lifecycle or visibility change was applied to Q&A. |

The real D1 preview matrix in `article-preview-d1.log` passed with the current schema and real HMAC utility. It proves canonical authorization, not HTTP header behavior or rendered client navigation. Full API/SSR/CSR proof on a freshly initialized current-schema Worker remains a gate.

## Ownership request 5578932432

The owner explicitly assigns the image slash-menu asset_id defect to #868. `BlogPostEditor.vue` was not changed in the current batch. The previous reactive-clone and second-version-token fixes in c38d16fb were accepted by #868 and must not be reimplemented here.

The current client exceptions are named and inseparable: draft type unions explicitly requested by publication item 5; public preview query propagation needed for returned URLs to work; and the independently reproduced global-header hydration fix in `layouts/saya.vue` and `SayaHeader.vue`. No new blog list filter UI, publishing leaf, visibility control, or image-menu fix was added. Root must include these precise exceptions in the final PR comment so #868 can take the canonical changes on rebase.

## Earlier owner obligations rechecked

| Owner source | Current evidence and remaining obligation |
| --- | --- |
| 5570026523 full release handoff | Remains binding for sole-PR consolidation, canonical generated schema/transfer, optional tooling policy, 30-minute qualified CI cadence, exact-head preview/manual MCP, staging, authorized production freeze/export/transfer/cutover, rollback retention and post-production verification. These release actions remain incomplete. Old c5c45cc1 CI and counts are historical. |
| 5572050864 retirement and batch hold; review 5132892027 | Active server searches find no callAiGateway, chargeCredits, hasCredits, extractProductsFromMediaAsset, analyze_document registration, or import_products_from_media registration. Schema/transfer retires only the credit-grant table and preserves retained usage accounting. Draft hold and complete-batch local validation remain required. Final regenerated contract counts and schema deltas must be recomputed for the publication batch. |
| Inline 3950485039 retirement | Same canonical retirement work. Remaining Anthropic/Gateway strings are historical incident comments, released Epoch 5 documentation, audit history, negative guards, and historical-retention disclosure in privacy.vue. They are not active provider wiring or a current product promise. Historical provider records must not be falsely claimed deleted. |
| Inline 3950491540 whitespace justification | `utils/timezone.ts:72` normalizes only U+00A0/U+202F separator spaces at the formatter boundary. Existing evidence records Node/Chromium character differences and preserved localized seconds/fractions. Current header mismatch has a different root cause and its own source fix; do not treat the formatter proof as that fix's verification. |
| Inline 3950499799 sync_products claim | `server/utils/mcp-tools/products.ts:120` explicitly conditions omitted-product unavailability on set_missing_unavailable. Existing generator justification was corrected to its own effects. There is no retired-credit suffix authorizing unrelated effects. |
| 5577976570 Markdown addition | Shared predicate lives in `shared/markdown-editor-mode.ts`; shared splitter uses it for prose and empty content; API uses the same predicate; demo/Pottery construction and NCLS snapshot are corrected. Offline `reclassifyMarkdown` only replaces the top-level editor_mode token and records measured counts. Cutover document explicitly describes the transformation. Existing local proof is historical supporting evidence; fresh frozen production transform and deployed checks remain required. |

Non-owner inline CodeRabbit 3947871619 remains addressed by nullable notification_phone schema and location update handling. The bot's current summary is not an independent review of the uncommitted publication batch. Contributor comments are evidence reports rather than new owner scope; 5578767056's all-work-complete claim is superseded by the missed publication request and 5579393869's restored Draft hold. Empty contributor review shells add no approval.

## Claims retired from current status

The following are historical, not current qualification requirements: 53 tables, 98 registry/97 exposed tools, 2,863 staging rows, 42,211 transferred rows, the owner's original 7 social rows, old local suite counts, and any Ready/green claim for earlier heads. The retirement-only 96/95 tool count may remain numerically correct, but the publication batch changes schemas and must receive a fresh submitted-contract comparison. Previously prepared editor-mode staging data does not qualify a new publication baseline. Production remains uncut-over until its actual frozen export and verified binding transition complete.

## Outstanding gates

1. Fresh canonical local setup on the current generated baseline, combined quality/build and full affected runtime matrix, including all publication writes/transitions, signed preview paths, unlisted discovery/direct access, cache headers, and retained CMS/MCP/guest paths.
2. Independent final diff/comment review, regenerated catalog/submission check and current contract delta, concrete PR body/completion matrix tied to the final commit.
3. Fresh comment/body-hash retrieval immediately before a Ready transition, so edits or late owner comments cannot be missed again. No CI watch while Draft.
4. Exact-candidate preview CI on the required cadence, build/asset convergence, full route/manual authenticated browser/MCP qualification, and specific disposition of every retained failure. The media cancellation classifier still needs reviewed runtime execution; it must report classified events rather than claim no network events.
5. New-baseline staging candidate proof and ordinary qualified staging deployment. Then the authorized frozen production export, exact data projection verification, canonical cutover, full read-only production browser/MCP/provider/auth/billing proof, and issue #829 completion evidence. Real-account/host-only access limitations must remain explicit. The owner operates the ChatGPT review portal.

No GitHub writes, review resolution, CI rerun, worker start, browser operation, source edit, push, or Ready transition occurred in this audit.

## Owner body hashes

| Record | Updated or submitted UTC | SHA-256 of exact current body |
| --- | --- | --- |
| 5570026523 | 2026-09-07T14:29:14Z | 0a935884f2c38b292a2621d78cb2d0f9942b9892c277cd6c56f4ace7894b443d |
| 5572050864 | 2026-09-07T14:30:20Z | 9cef2998055bb7d5b09b1afcab6c59d8cce6cf5165c9c970e114c4cbf53342ca |
| 5577976570 | 2026-09-08T02:02:34Z | 373e4417d782e556fe25360083f7fa1ec28bc4fc30a6118bb686c5e3a21a1736 |
| 5578745078 | 2026-09-08T03:47:09Z | 048ea5dd4cf553f441295991957b1fb274593cd5edc2ec68f8841c967953e0ec |
| 5578932432 | 2026-09-08T03:56:53Z | 7bf39260fd54b944c83ac18149146823e443d736baef2a6f703f26f156ca12e4 |
| 3950485039 | 2026-09-07T14:15:26Z | 86fdce4faa856ee777594585862c52c239c5a7ed44f67bb24ad78c136e146b8c |
| 3950491540 | 2026-09-07T14:15:26Z | b04b5b8234f35843257a552dad4bdf1d40a014fd515bc99d5afed14abb67a970 |
| 3950499799 | 2026-09-07T14:15:26Z | c2ec31ee3244c189a18783f590ec8b0c3452b0d98734d0584971206e55822a74 |
| 5132892027 | 2026-09-07T14:15:26Z | af08b37f834a3efc1f662d26d58ecb0d1cb69b08517e07dca64b80c68db86feb |

## Superseding completion status

The pending local-runtime findings described above were subsequently resolved
and verified. Comment refresh
`comment-refresh-2026-09-08T06-27-08-591Z-diff.json` compared all 27 current
issue comments, inline comments, and reviews and found no additions, removals,
timestamp changes, or body edits.

| Owner obligation | Current disposition |
| --- | --- |
| 5570026523 release handoff | Pre-review source and local work is complete. Exact-candidate preview, staging Worker deployment, production cutover, deployed verification, #829 completion, and owner-operated portal resubmission remain release work. |
| 5572050864 provider/credit retirement | Implemented and verified with retained auth, billing, explicit media/product, Places, WhatsApp, and usage-event contracts. Current catalog/submission evidence is recorded in the PR body. |
| 3950485039, 3950491540, 3950499799 and review 5132892027 | Provider retirement, formatter-boundary normalization, truthful `sync_products` omission semantics, and nullable notification recipient handling remain addressed. |
| 5577976570 Markdown/editor-mode transfer | Shared predicate, seed/demo corrections, byte-preserving transform, measured production rehearsal, and fresh staging candidate are complete. Frozen production counts remain a cutover gate. |
| 5578745078 publication state | Schema, generated baseline, transfer projection, server/shared/API/MCP contracts, signed preview reads, cache/SEO policy, lifecycle transitions, and real HTTP/SSR/CSR checks are complete. |
| 5578932432 #868 boundary | Dashboard controls and image slash-menu work remain assigned to #868. Only the required type/token/error propagation and runtime-blocking hydration corrections are present here. |

No additional owner-requested source omission is demonstrated by the current
comment set. The fresh retained browser suite passed 90 cases with one
HTTPS-only skip, zero failures, and zero retries on build
`f1893229-472f-4b19-9edc-2524bc872a36`. Composite route evidence covers the 533
original passes plus 12 affected follow-up passes; it is not represented as one
later green 544-case sweep. The publication-state staging D1 candidate is fully
prepared and data-qualified, but no Worker has deployed to it.
