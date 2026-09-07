# Audit artifact scope and handling

Current ownership is defined by the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md). The current work prepares the merged PR #848 candidate for review and qualification. No audit artifact authorizes a staging or production action.

## Current target evidence

- [Target schema](829-target-schema.json) and [target columns](829-target-columns.tsv) are regenerated from the canonical merged baseline (integration parent `774d4c12`, staging parent `3894f251`): **53 tables, 826 columns**. Baseline SHA-256 is `5076888343c439db5821336e9395fdc56dc02fdf52f2e375bc23f4d8191afc92`.
- [Transfer summary](829-transfer-summary.json) is an explicit aggregate-only projection of the final merged candidate manifest generated at 2026-09-07T00:54:14.087Z: **41,543 rows**, 53 matching table hashes, nine clear invariants and 96 archived source-table hashes. Independent read-only checks at 2026-09-07T00:57:38.607Z matched the baseline/schema hashes, every table count/logical hash, foreign keys and integrity. The candidate contains 110 editorial documents, 679 blocks and 339 media assets; nine authored translation-source mappings are recorded by aggregate count and evidence hash. This is transfer evidence, not application/CI qualification.
- [Findings](829-findings.md), [column audit](829-column-audit.md) and [checklist](829-checklist.md) distinguish current census/transfer facts from pending runtime gates.
- [Decisions](829-decisions.tsv) and [consolidation plan](829-consolidation-plan.md) are maintained by the integration owner.

## Historical evidence

The original 96-table source census, `829-columns.tsv`, `829-tables.tsv`, `829-indexes.tsv`, `829-site-scope-census.json`, `829-owned-json-shapes.json`, `829-json-aggregate.json` and `829-epoch4-archive-hashes.json` retain the audited source observations. Source data/schema facts remain valid for that snapshot. Any target declarations, disposition decisions or runtime ownership claims embedded in them describe the superseded 94-table proposal.

`829-table-evidence.json`, `829-sql-consumers.json`, `829-sql-consumer-run.json`, `829-removed-column-sql-scan.tsv`, `829-column-followups.txt` and their review reports are static evidence for the earlier recorded tree. They are not a current consumer scan. `829-ncls-fixture-verification.json` records the earlier fixture check, not the consolidated fixture state. `829-commit-files.txt` is the historical 35-file review allowlist, not the current commit manifest.

The design, independent final review, browser verification, preview-CI correction, provider and Google reports retain their original attribution and observations with explicit historical scope. Their old approvals, release plans and passing results cannot qualify the consolidated application. Previous contents of regenerated target artifacts remain available in Git history; they are not a supported second target model.

## Private evidence boundary

Raw exports, complete candidate manifests, typed source archives, provider IDs/plans, per-row dispositions and private probes remain outside Git. The committed transfer summary includes only allowlisted schema names, columns, aggregate counts, hashes and invariant outcomes. Census source filenames contain no absolute private paths. Schema field names are metadata, not secret values.

One-off canonicalizers, provider probes and mutation scripts are not release commands and are not included. Use only the repository's canonical release and cutover procedures when separately authorized.
