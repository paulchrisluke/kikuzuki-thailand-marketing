# Audit artifact scope and handling

Current ownership is defined by the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md). Current authorization stops at PR #848 ready for review. No audit artifact authorizes a staging or production action.

## Current target evidence

- [Target schema](829-target-schema.json) and [target columns](829-target-columns.tsv) are regenerated from the canonical baseline inspected at root revision `097aec98`: **53 tables, 826 columns**. Baseline SHA-256 is `dee2b633866e7cf0701a6d7df7dd5b08f6f37de3a68759a16d6788d71445b3a7`.
- [Transfer summary](829-transfer-summary.json) is an explicit aggregate-only projection of the matching private final candidate manifest: **41,544 rows**, 53 table hashes, nine invariants and 96 archived source-table hashes. Read-only candidate checks independently matched table counts, FK checks and integrity. This is transfer evidence, not application/CI qualification.
- [Findings](829-findings.md), [column audit](829-column-audit.md) and [checklist](829-checklist.md) distinguish current census/transfer facts from pending runtime gates.
- [Decisions](829-decisions.tsv) and [consolidation plan](829-consolidation-plan.md) are maintained by the integration owner.

## Historical evidence

The original 96-table source census, `829-columns.tsv`, `829-tables.tsv`, `829-indexes.tsv`, `829-site-scope-census.json`, `829-owned-json-shapes.json`, `829-json-aggregate.json` and `829-epoch4-archive-hashes.json` retain the audited source observations. Source data/schema facts remain valid for that snapshot. Any target declarations, disposition decisions or runtime ownership claims embedded in them describe the superseded 94-table proposal.

`829-table-evidence.json`, `829-sql-consumers.json`, `829-sql-consumer-run.json`, `829-removed-column-sql-scan.tsv`, `829-column-followups.txt` and their review reports are static evidence for the earlier recorded tree. They are not a current consumer scan. `829-ncls-fixture-verification.json` records the earlier fixture check, not the consolidated fixture state. `829-commit-files.txt` is the historical 35-file review allowlist, not the current commit manifest.

The design, independent final review, browser verification, preview-CI correction, provider and Google reports retain their original attribution and observations with explicit historical scope. Their old approvals, release plans and passing results cannot qualify the consolidated application. Previous contents of regenerated target artifacts remain available in Git history; they are not a supported second target model.

## Private evidence boundary

Raw exports, complete candidate manifests, typed source archives, provider IDs/plans, per-row dispositions and private probes remain outside Git. The committed transfer summary includes only allowlisted schema names, columns, aggregate counts, hashes and invariant outcomes. Census source filenames contain no absolute private paths. Schema field names are metadata, not secret values.

One-off canonicalizers, provider probes and mutation scripts are not release commands and are not included. Use only the repository's canonical release and cutover procedures when separately authorized.
