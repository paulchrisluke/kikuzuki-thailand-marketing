# SQL consumer verification after column inventory

> Historical evidence from the superseded 94-table proposal. This document's implementation, test and review claims apply only to its recorded revision, not the current [53-table consolidation contract](../docs/database/epoch-5-consolidation.md). Current authorization is PR #848 ready for review only: no staging/production merge, deployment, initialization or further staging writes. Current gates are in [829-checklist.md](829-checklist.md).


The initial inventory had zero missing evidence entries but still missed retired billing projections in scheduled tasks. Inventory completeness is not SQL compilation or behavior proof. The six affected task projections and unused DTO fields were deleted; QA scopes and two experience readers were also corrected to their existing canonical tables and product state.

The final scan reads all 1,279 TypeScript, JavaScript, Vue script, SQL, fixture, and seed files under server, scripts, tests, seed-definitions, pages, components, lib, utils, and shared. It extracts strings and templates, expands finite conditional branches, and prepares SQL against the generated Epoch 5 baseline in SQLite. [Full records](829-sql-consumers.json) retain each location, statement, and result; [scan code](829-sql-consumer-audit.mjs) is rerunnable.

- 1,293 statements prepare successfully, including all corrected task, QA, module-guard, and sitemap queries.
- Five booking-claim statement shells prepare with their explicit claim marker replaced by `1` solely to check columns. This does not prove the runtime atomic availability predicate.
- 203 templates contain unresolved runtime expressions; they are recorded as dynamic, not passed.
- Six remaining extraction errors were reviewed: two deliberately construct Epoch 4 source fixtures in epoch5-data.test.mjs; one selects Wrangler-owned d1_migrations; three are ordinary MCP descriptions misclassified by conservative SQL extraction. None is a failing current application query.

[All 49 removed source fields](829-removed-column-sql-scan.tsv) are checked across the extracted SQL, including tasks and scripts. Remaining dynamic name coincidences were reviewed: demo seed `theme` occurs within the literal theme ID and `public_url` belongs to media_assets; guest-thread `status` refers to reservation and experience booking aliases, not contact_submissions. Better Auth's case-correct fields, canonical Facebook connection IDs, media public_url, and provider payload properties remain valid independently of similarly named retired fields. Actual public URL reads now prepare as derived canonical site_domains projections.

This scan proves the recorded statement preparation and records the dynamic coverage limit. It does not replace browser checks, live runtime calls, tenant authorization checks, or the transfer verifier. The former Epoch 3-to-4 converter and its sole category planner/test have been retired; immutable historical links remain in the Epoch 4 runbook.
