# Audit artifact handling

The exact reviewed commit allowlist is [829-commit-files.txt](829-commit-files.txt), containing 35 files. It includes reproducible code, aggregate source/target schemas, table/field hashes and counts, disposition matrices, SQL records, attributed review and sanitized findings. Census source_file values contain filenames only. No credentials, raw production rows, email tokens or absolute private export paths are included. Source field names such as privateKey are schema metadata, not key values.

The production-source candidate summary proves 94 tables / 42,244 rows against its recorded baseline hash. The separate NCLS fixture check proves all nine invariants and FK checks pass. Its 30 :media:index names reference real CTA blocks and are retained; they are not the 30 missing-owner relationships removed from the production transform.

829-site-scope-census.json records the observed Epoch 4 source checks, not the generated target enforcement. Current composite FKs and CHECKs are in 829-target-schema.json. Historical design and independent-review reports retain their original scope and attribution; current release gates are in 829-checklist.md.

## Private local probes (do not commit)

- canonicalize-ncls.mjs
- field-audit.mjs
- google-evidence.mjs
- google-location.mjs
- google-review-history.mjs
- tighten-defaults.mjs

These are one-off investigation or mutation scripts. Some read private exports or live provider credentials in process. They are not release commands; keep them outside the commit. The NCLS canonicalizer deliberately rejected the proposed deletion because no missing-owner fixture rows qualified.

## Superseded scratch output (do not commit)

- 829-column-audit-run.txt
- 829-fixed-query-proof.json
- 829-removed-column-query-candidates.json

The final per-field SQL scan, full SQL preparation output and review replace these scratch snapshots. Existing issue-820.tsv is historical issue evidence already tracked; no new disposition is required. All raw exports, complete transfer manifests, provider plans and per-row evidence remain in the existing private evidence directory outside Git.
