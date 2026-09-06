# Issue 829 implementation checklist

- [x] Read the Superdev Principles section in full.
- [x] Phase A: Frame scope and preserve unrelated work.
- [x] Phase B: Review the design and canonical ownership contracts.
- [ ] Phase C: Complete PR review qualification; implementation/local qualification are complete, corrected-head remote qualification remains.
- [x] Phase D: Maintain sanitized decisions, inventories, transfer proof and attributed review evidence.
- [ ] Phase E: Complete Codex browser, provider ingress and CI verification; hand back the open PR.

The latest user instruction changes the stopping point to PR #848 ready for review. Do not merge to staging or production, initialize staging cards, or make further staging writes. Issue 829 remains open. The earlier staging release instructions are superseded.

## Completed implementation and local evidence

- [x] Pinned immutable installation and initial unchanged schema-drift preflight.
- [x] Inventory all 96 source tables / 1,373 columns and all 94 target tables / 1,331 columns; record all 328 source index dispositions.
- [x] Consolidate post topics, hours/availability, ownership, provider/auth, transfer, domain and reply-address contracts; delete replaced paths.
- [x] Preserve archived Epoch 4 baseline hashes and generate one canonical Epoch 5 baseline.
- [x] Transform and verify the production source: 42,244 target rows, exact declared hashes and nine zero-violation invariants; explicit 30 relationship deletions preserve all assets/blocks.
- [x] Correct stale scheduled-task, QA and experience SQL; record static preparation and unresolved dynamic-template limits separately from the inventory.
- [x] Root-reported local gates: production build, 16 D1, eight transfer/migration and 187 unit tests.

## Release gates still requiring completion

- [x] Codex browser checks against the built Worker and authenticated CMS/MCP journeys, including rendered social cards.
- [x] Real inbound email/Stripe signature and canonical owner continuity checks.
- [x] Provision the final staging database and verify all 94 tables / 2,820 fixture rows through the documented release flow.
- [x] Push the completed implementation once and open PR #848 against staging; schedule CI follow-up instead of continuous polling.
- [x] Diagnose all three failed preview tests; fix the booking invalidation failure and two cumulative test timeouts without removing assertions or adding retries.
- [x] Fix the confirmed Pottery review-chip overflow under the expanded bug-fix instruction.
- [ ] Push the consolidated corrections after final local checks and independent review.
- [ ] Qualify exact-head CI and deployed preview, then hand back the open PR for user review.

Staging deployment, standalone social-card initialization and read-only staging verification remain documented future steps for the owner; they are outside the current PR-only authorization.

No entry above declares staging ready or authorizes production changes.
