# Publication work added after the missed comment audit

Owner comment 5578745078 was created at 2026-09-08T03:37:15Z and last edited at 03:47:09Z. The prior pre-Ready audit did not include it. The PR was restored to Draft on discovery. No further qualification push is permitted until this scope and the known runtime findings are implemented and verified together.

- [x] Read the SuperDev Principles and applicable domain, architecture and verification rules.
- [x] Ground the existing article and social-post writes, public reads, scheduler, tokens and epoch transfer.
- [x] Sketch canonical-reader token support versus duplicated preview reads. Choose canonical reads, migrate callers and delete old names.
- [x] Complete the lifecycle and preview contract, social visibility filters, generated baseline and declared offline transfer.
- [ ] Independently review the combined diff and all owner comments including edited bodies.
- [ ] Regenerate fixtures, run quality, real D1/epoch/MCP and full built-Worker browser verification.
- [ ] Run corrected route/media checks and prove the three location hydration fixes.
- [ ] Update exact counts and the completion audit, commit and push one complete batch, then mark Ready.
- [ ] Qualify the exact deployed build and continue only through the authorized canonical release gates.

Ownership follows owner comment 5578932432. PR 864 owns server/shared/schema/seed/transfer contracts. PR 868 owns dashboard controls and its image-block insertion fix. Inseparable public article token propagation is included here. No custom migration, preview rendering duplicate, fallback content, new cache mechanism or production mutation is authorized by this addition.

The known header/NCLS fix batch passed fresh quality/setup/build and 90 of 91 local browser cases, with the HTTPS-only assertion flow skipped locally. Ten additional SSR/client header comparisons and both second-restaurant menu media checks passed. Three home-media diagnostics failed because their selectors matched no cards; they did not reach playback verification. These results precede the publication implementation and do not qualify it.

Publication validation checkpoint: 185 unit, 23 serial D1, and 16 migration tests passed. Catalog and submission artifacts were regenerated and checked. The real HMAC/D1 article preview matrix passed. The original local initialized database retained the old baseline constraints; its state was preserved under `.tmp/pr864-pre-publication-local-state`, then canonical setup initialized a fresh database and actual CHECK definitions were verified. The first full fresh-schema browser run finished with 89 passes, one HTTPS-only skip, and one stale social test expecting immediate publication. That test now exercises draft creation followed by explicit publication and repeated idempotent publication.

Authenticated HTTP verification then exposed a canonical platform provisioning defect: the platform site had no required English source locale. `ensurePlatformMediaScope` now creates that locale atomically with its existing site upsert. An isolated real Better Auth/D1/R2 proof confirmed initial setup, unchanged locale records on repeated calls, successful platform draft persistence, and clean foreign keys. Combined quality passed after this fix; the final build and runtime validation are still pending. These partial results do not authorize Ready.

The helper-only fix was incomplete: platform request resolution invoked setup only for missing brand/logo. The canonical completeness query now also requires the English source locale. Real authenticated HTTP then created six drafts across Saya, Blawby, and platform, served signed API/HTML previews, and verified cleanup of all six. The full browser suite passed 90 cases with one HTTPS-only skip before that request-path completion; the 15 focused header/media cases passed after it. HTTP then exposed Nuxt robots middleware overwriting HTML no-index headers. The canonical SEO policy moved to the existing final-response hook and its old middleware was deleted; quality passed, final built-response proof is pending. The first client-navigation preview probe used incorrect global tenant headers/network-idle waiting and timed out on its index page; that artifact is being corrected to use the canonical navigation helper, with canary cleanup independently verified.

## Superseding status

The source and pre-review local work above is complete. Independent combined-diff
and owner-comment reviews found no additional required source change. Canonical
setup, quality/build, 185 unit, 23 serial real-D1, 16 migration/epoch, catalog,
submission, authenticated HTTP/SSR, and three-scope client preview checks pass.
The retained clean-fixture Chromium suite passed 90 cases with one HTTPS-only
skip, zero failures, and zero retries on build
`f1893229-472f-4b19-9edc-2524bc872a36`.

The 544-route record is composite: 533 cases passed in the original complete
sweep on `dad9de8a`; all 12 affected cases passed on `f1893229` after the
review-submit correction and bounded media diagnostics. Two focused NCLS cases
separately proved playback at both widths. No single later 544-case green sweep
is claimed.

The fresh publication-state staging D1 candidate
`a19e76f9-44d2-45aa-9e94-eccbcfb1452e` passed empty-baseline and exact
52-table, 2,816-row remote re-export qualification. No staging Worker has been
deployed to it. The 06:27:08 UTC comment refresh found the same 27 objects with
no body changes.

The final commit/push and exact-candidate preview qualification remain next.
Staging Worker deployment, production freeze/export/verified transfer/cutover,
deployed browser and MCP checks, real-account auth/billing proof, and #829
closure remain release work.
