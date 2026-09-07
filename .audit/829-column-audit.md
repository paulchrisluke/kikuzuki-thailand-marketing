# Current Epoch 5 target census and historical source inventory

The generated target at root revision `097aec98` contains **53 tables and 826 columns**. [Target columns](829-target-columns.tsv) lists their SQLite types, nullability, defaults, primary keys, column indexes and FK groups. [Target schema](829-target-schema.json) preserves full CREATE TABLE and index SQL, including CHECKs and expression indexes that cannot be assigned to a single column.

Regenerate both target artifacts from the repository root with `node .audit/829-column-audit.mjs`. The optional first argument selects a generated baseline to inspect. This script executes that baseline only in memory and writes the two target artifacts; it does not infer liveness, field ownership or unchanged-value preservation from matching names.

Current ownership and fold decisions are in the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md); the canonical projection is `scripts/epoch5-data.mjs`. The [sanitized transfer summary](829-transfer-summary.json) matches the baseline hash and records 41,544 target rows with declared hash parity and nine clear invariants. Census coverage is not SQL or application behavior qualification.

The historical [source columns](829-columns.tsv), [tables](829-tables.tsv), [indexes](829-indexes.tsv), source census and consumer snapshots preserve the original 96-table / 1,373-column / 328-index audit. Their source observations remain valid for that snapshot. Their old target dispositions, 94-table counts, liveness decisions and zero-followup claims are superseded; do not apply them to the current target. The [SQL review](829-sql-consumer-review.md) is also evidence for its recorded earlier revision only.
