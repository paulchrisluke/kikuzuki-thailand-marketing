## Why

Epoch 6 standardizes timestamps and civil time, removes duplicate customer summaries, consolidates #865 and #866, and retires AI Gateway document extraction and AI-credit accounting. The owner additions correct Markdown editing and make article and social publication explicit.

## Scope

Articles and social posts start as drafts unless explicitly published or scheduled. Published content keeps its URL and history when unlisted. One-hour signed article previews work through the canonical Saya, Blawby and platform reads and remain private, uncached and non-indexable. Q&A retains its existing publication model.

The shared Markdown classifier governs fixtures and the offline epoch transfer. The transfer fills missing editor modes, reclassifies eligible source blocks and removes Markdown syntax from the affected plain-text headings while preserving unrelated JSON bytes. It deletes legacy block discriminators, duplicate data types, stale image alt fields and the one scheduling row's flattened component fields. That row's existing content moves unchanged into canonical Markdown. Its type, ownership, order and media remain intact. No new block type or schema change is needed.

Machine-key media alt values become NULL under the owner's exact SQL predicate. Prose descriptions remain untouched. Missing content-image descriptions remain a real client-handoff blocker; this backfill does not invent replacements.

Provider extraction, credit charging, balances, grants, gates, two tools and their product promises are retired. Better Auth, subscriptions, explicit product/media writes, Places, WhatsApp and operational usage events remain. The generated baseline has 52 tables, with all production projections declared in the offline transfer.

## Tradeoffs

#868 owns the blog dashboard publishing controls, image slash-menu correction, shared field-format enforcement and per-block alt writer/renderer removal. This PR includes the requested shared draft types, working preview adapters and the independently reproduced runtime blockers. Scheduling now uses the existing Markdown editor and renderer. Canonical block selectors replace the deleted legacy discriminators, and Contact renders card-bearing rows as a collection while selecting its consultation CTA by the existing section identifier. The canonical page seed generator also uses `editorModeFor`, so freshly generated fixtures satisfy the same contract. #868 can reuse those shared corrections on rebase.

The later correction in comment 5580729953 makes residue removal part of this epoch. The projection asserts the measured source key sets before deleting them. No general naming framework, custom migration, replacement provider, compatibility storage, fabricated Markdown or manual tenant-data patch is introduced.

## Blast Radius

The change touches generated D1 schema and offline transfer, publication APIs and MCP contracts, public discovery and preview authorization, fixture generation, and retained CMS rendering. Runtime verification also corrected shared header hydration, canonical platform locale provisioning, preview response headers, Blawby client errors and review-request hydration. The final local follow-up deduplicates the installed Vue runtime, waits for Better Auth's canonical session signal during impersonation transitions, and clears the old tenant realtime scope synchronously during Exit to Admin.

## Verification

The latest runtime correction keeps Vue's server-prefetch registration in the client bundle so async IDs match SSR. WebSocket upgrades bypass header mutation, and ordinary Durable Object responses are normalized at the forwarding boundary. Booking-note drafts survive background refreshes and retain their original revision. Concurrent edits return the canonical 409 response and reload instruction while preserving the unsaved draft.

The final runtime correction passes build and quality. Earlier unchanged schema, transfer and retained-domain checks passed 185 unit tests, 23 real D1 tests and 17 migration tests, plus catalog, submission and contract checks.

Runtime evidence is composite. Local build `584932fb-9c67-4351-98e8-ac4457db5031` passed 90 retained browser cases with one HTTPS-only skip, the strict CMS persistence/restoration and Exit-to-Admin workflow, WebSocket and ordinary-response header verification, and 22 affected public routes. Build `35b4d707-23c3-46a9-ba08-bd420150e5be` passed the existing Today reservation-change case and the strict workflow at three speed profiles without console warnings or errors. Final build `088ec842-264d-4f65-aec3-2f6062808b68` passed both controlled late-response note cases, including persistence and concurrent-edit conflict handling. These are not claims of one full suite on the final build.

The exact c7 preview passed all 544 expanded public-route cases with zero retries or skips on Nuxt build `cc7cfc87-4bc0-48e3-883a-c24f2b714411`. NCLS video playback was also verified in Chrome. Separate headless player failures remain recorded with their cause unproven. The next pushed SHA requires its own normal CI and affected preview qualification.

The retained production-export rehearsal preserves 42,429 rows across 52 tables. All 316 Markdown blocks satisfy the classifier; 347 distinct block JSON rows change with one counted overlap. The projection removes residue from 13 blocks and sets exactly 144 machine-key alt values to NULL while preserving 197 prose values and media placements. The reconciled staging candidate passed exact remote re-export verification of 52 tables and 2,816 fixture rows, clean foreign keys/integrity and nine zero-violation invariants. It remains undeployed.

The 10:31:56 UTC comment audit found no changes across all 32 current comments and reviews. Independent source, deslop and Comment Sicko reviews found no actionable findings. CodeRabbit CLI remained unavailable while signed out; that skip does not replace review. Detailed evidence is in `.audit/pr864/runtime-corrections-completion.md`.

Credentialed deployed CMS/OAuth/MCP and real-account billing/provider checks, staging Worker qualification and initialization, and the authorized production freeze/export/verified transfer/cutover remain release gates. Production still uses Epoch 5. Rollback resources are retained and #829 stays open. The owner handles ChatGPT portal resubmission.
