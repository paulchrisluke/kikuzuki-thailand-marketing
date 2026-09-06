# Issue 829 implementation checklist

- [x] Read the Superdev Principles section in full.
- [x] Phase A: Frame scope and preserve unrelated work.
- [x] Phase B: Review the design and canonical ownership contracts.
- [ ] Phase C: Complete the release loop; implementation/local qualification are complete, remote qualification remains.
- [x] Phase D: Maintain sanitized decisions, inventories, transfer proof and attributed review evidence.
- [ ] Phase E: Complete Codex browser, provider ingress, CI and staging verification; then hand back.

The stopping point is qualified staging. Production promotion and testing belong to the owner. Issue 829 remains open for production gates.

## Completed implementation and local evidence

- [x] Pinned immutable installation and initial unchanged schema-drift preflight.
- [x] Inventory all 96 source tables / 1,373 columns and all 94 target tables / 1,331 columns; record all 328 source index dispositions.
- [x] Consolidate post topics, hours/availability, ownership, provider/auth, transfer, domain and reply-address contracts; delete replaced paths.
- [x] Preserve archived Epoch 4 baseline hashes and generate one canonical Epoch 5 baseline.
- [x] Transform and verify the production source: 42,244 target rows, exact declared hashes and nine zero-violation invariants; explicit 30 relationship deletions preserve all assets/blocks.
- [x] Correct stale scheduled-task, QA and experience SQL; record static preparation and unresolved dynamic-template limits separately from the inventory.
- [x] Root-reported local gates: production build, 15 D1, eight transfer/migration and 187 unit tests.

## Release gates still requiring completion

- [x] Codex browser checks against the built Worker and authenticated CMS/MCP journeys, including rendered social cards.
- [x] Real inbound email/Stripe signature and canonical owner continuity checks.
- [x] Provision the final staging database and verify all 94 tables / 2,820 fixture rows through the documented release flow.
- [ ] Qualify its deployed Worker and complete post-start social-card initialization.
- [ ] Push only after final changes; create the staging PR and schedule CI follow-up instead of continuous polling.
- [ ] Review CI and deployed preview evidence; merge only after those gates pass.
- [ ] Verify staging and hand over exact commits, bindings, private evidence locations and the production procedure.

No entry above declares staging ready or authorizes production changes.
