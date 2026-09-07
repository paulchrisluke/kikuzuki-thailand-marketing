# Issue 829 current qualification checklist

The target is the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md): **53 tables and 826 columns**. Earlier checkmarks for the rejected 94-table proposal are historical evidence, not qualification of this revision.

The stopping point is **PR #848 ready for review**. Do not merge to staging or production, initialize staging cards, deploy, make further staging writes, or close issue #829. Earlier staging-release instructions are superseded.

## Completed audit and transfer evidence

- [x] Preserve the 96-table / 1,373-column Epoch 4 source census and immutable migration archive evidence.
- [x] Account for all 53 retained target tables in the consolidation contract and regenerate every target column, FK, index and table constraint from the canonical baseline.
- [x] Match the private production-source manifest to the generated baseline; verify 41,544 target rows, matching declared hashes and nine zero-violation invariants.
- [x] Recheck candidate table counts, zero foreign-key violations and SQLite integrity without changing data.
- [x] Preserve historical review attribution and distinguish superseded 94-table evidence from current results.

## Final application qualification

- [x] Complete application quality/build and real runtime qualification: 186 unit, 22 real D1, 15 migration/source-transfer and 64 local E2E cases pass. The final broad E2E run passed 63; the corrected Kikuzuki hydration journey passed its focused rerun. One HTTPS-only skip and two excluded paid media-upload cases remain for normal preview CI.
- [x] Complete direct Codex browser checks against the final built Worker: configured sign-in/post-login, Today, Inbox, CMS/media reads and public/localized routes. MCP workflows have real Worker E2E coverage. Two paid media-upload tests are excluded locally; OG/social-card generation will not be rerun at the owner's request.
- [x] Finish independent review of the final consolidated revision and record any remaining limitations in the consolidation contract.
- [ ] Push once after all changes and local checks are complete; use a scheduled CI follow-up rather than continuous polling.
- [ ] Verify exact-head CI and deployed preview, then hand back the open PR for user review.

Root owns these application/release evidence gates. This documentation update does not rerun or certify them. The previously prepared 94-table staging candidate and old browser/CI results do not qualify the 53-table revision.
