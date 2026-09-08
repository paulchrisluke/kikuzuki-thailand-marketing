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

The current tree passes quality and typecheck, 185 unit tests, 23 real D1 tests, 17 migration tests, and the migration, catalog, submission and contract checks. The final retained browser run passed 90 cases with one HTTPS-only skip and no retries on build `81b26fb7-9376-43e4-9ef2-e28d5d0bb007`. Authenticated publication HTTP/SSR checks passed 119 sanitized records across three scopes, and all three signed client-navigation previews passed with canonical canary cleanup.

CodeRabbit CLI was signed out and skipped. The full OpenAI developer plugin was unavailable; the installed local submission skill and official OpenAI documentation were used for the submission checks.

Expanded route coverage is composite. The complete 544-case sweep passed 533 cases. A fresh 16-case affected public-route run passed on final build `ab22e07e-d138-4e94-bac3-30a36031bef1`, and all 23 corrected headings passed HTTP verification on the same build. This is not a claim of a later single green 544-case sweep. Actual NCLS video playback was separately verified at both widths.

The later block-contract follow-up passed its nine real transfer tests and full retained-export transform/verify. It retains 42,429 rows across 52 tables, repairs 48 missing modes, reclassifies 264 source blocks, normalizes 23 headings and removes residue from 13 blocks. All 316 Markdown blocks satisfy the classifier. The 347 changed block JSON rows include one explicitly counted overlap. Exactly 144 machine-key alt values become NULL; the other 197 alt values and all media placements are preserved.

The final reconciled staging candidate passed canonical preparation and exact remote re-export qualification: 52 tables, 2,816 fixture rows, clean foreign keys and integrity, nine zero-violation invariants, 283 correctly classified Markdown blocks, 251 plain headings, and no block residue or machine-key alt text. It remains undeployed.

The normal CMS workflow passed its strict console and network gate with no socket-warning exemption on build `bb52bb9e-51b2-4843-be1d-561ece4ad3a4`. The test saved and reloaded the edit, restored the exact original block-data hash, exited through the real Better Auth transition, reached the admin page with the impersonation banner gone, created no socket after stop began, and preserved the public schedule content. Both rapid-exit probes also passed. The pointer path closed an open socket without warnings. The keyboard path deliberately closed one tracked socket while it was still connecting and observed exactly its correlated browser-native cancellation warning, with no post-stop connection and no other console, network or HTTP failure. All source and local verification gates are complete. The 08:29:48 UTC audit compared all 30 current comment/review bodies and found no changes or unaddressed source work.

Exact-candidate preview, staging Worker deployment, the authorized production freeze/export/verified transfer/cutover, deployed browser/MCP and real-account auth/billing checks remain release gates. Production still uses Epoch 5. Rollback resources are retained and #829 stays open. The owner handles ChatGPT portal resubmission.
