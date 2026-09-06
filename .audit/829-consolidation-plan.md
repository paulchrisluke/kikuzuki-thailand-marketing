# Epoch 5 structural consolidation rework

## Acceptance

The owner's [review target](https://github.com/paulchrisluke/krabiclaw/pull/848#issuecomment-5562248633)
rejects the 94-table result. Total table count is an explicit design constraint;
the target is the 60s or fewer wherever required behavior permits. Every retained
application table must explain what relational integrity, query, concurrency,
retention or provider contract would be lost by folding it. Better Auth's 18
package-owned tables keep their documented contracts.

There is no backward compatibility requirement. Migrate every reader and writer,
delete replaced paths in the same change, and preserve retained source facts
through the canonical epoch transfer. No handwritten migration SQL is permitted.
Keep the generated unreleased Epoch 5 baseline; released archives remain immutable.

Delivery is an open PR ready for review. No merges, staging initialization,
staging writes, production binding changes, live provider changes or issue closure.
The green CI on `2e9e5c88` qualifies the prior implementation only.

## Workflow

- [x] Read the Superdev Principles section in full.
- [x] Phase A: Frame. Treat all 76 application-owned tables as challenged; preserve
  the green implementation and private data-transfer source as the comparison.
- [ ] Phase B: Design the workflow. Ground active callers and compare two shapes
  per partition before selecting ownership, JSON and ledger boundaries.
- [ ] Architect: Ground, Sketch, Agree, Implement, Scrap. Agreement proceeds
  autonomously under the owner's concrete target; redesign if runtime constraints
  invalidate a selected fold.
- [ ] Phase C: Run the loop. Implement coherent partition changes, remove old
  callers and definitions, and verify each against real D1/runtime boundaries.
- [ ] Consolidate site configuration, domains, locales and provider connections.
- [ ] Consolidate bookings, experience products, policies and guest events.
- [ ] Consolidate analytics and special content into canonical models.
- [ ] Archive dead history outside the live schema and remove operational evidence.
- [ ] Regenerate the sole baseline, canonical fixtures and source transfer; prove
  all retained facts, archive dispositions, foreign keys and invariants.
- [ ] Phase D: Keep the audit trail. Update `.audit/829-decisions.tsv`, whole-table
  dispositions and counts when evidence settles each choice.
- [ ] Phase E: Verify and hand back. Local quality, meaningful D1/transfer/E2E,
  independent review, one completed push, scheduled exact-head CI and deployed
  Codex browser/MCP evidence. Keep the PR open for the owner.

## Throughput and shared state

Three read-only design partitions cover owner/config/domain/provider state,
booking/guest state, and content/analytics state. The root owns global table
accounting, transfer verification and integration. Implementation workers get
isolated worktrees and explicit file ownership after the target shape is agreed.
The root serializes canonical schema, generated baseline and fixture integration.
No worker may push or mutate a shared remote environment.

This is a full schema and caller rewrite, not a timeout correction. The hard
unknowns are atomic booking capacity, provider/domain claims, lossless analytics
projection and historical retention outside runtime tables. Those decide the
design before implementation effort is spent.
