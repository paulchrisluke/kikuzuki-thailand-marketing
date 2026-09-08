# Epoch 6 publication-state rehearsal

The September 8 offline rehearsal used the existing private production export.
It made no remote export, database, binding, deployment, or data change. Raw SQL,
the transformed SQLite database, and command logs remain outside Git.

## Source qualification

| Check | Result |
| --- | --- |
| Source export SHA-256 | `03ca012a59b10cde0c812670d286536cab04ff8b58bb8922187a90d0305ac8e0` |
| Epoch 5 schema evidence | 53 tables, including `usage_quota_grants`; legacy customer summary columns present |
| Source rows | 42,442 |
| Retired quota-grant rows | 13 |
| Root social-post visibility census | 15 `NULL`, 0 non-null |
| Source-mode Markdown blocks | 268 |

The source was inspected before transformation. The transformed output was not
used as the source census.

## Projection and verification

The canonical `scripts/epoch6-data.mjs transform` and `verify` commands ran into
a new private output directory. Both manifests agree on every value below.

| Check | Result |
| --- | --- |
| Generated baseline SHA-256 | `f19f1e02f818f65ced0d7769ee5665bdfd188b83542423ed36ff5c2a19195bc0` |
| Target tables and rows | 52 tables, 42,429 rows |
| Social visibility projection | 15 source `NULL` values projected to `public` |
| Markdown classification | 264 reclassified to `rich`; 4 retained as `source` |
| `content_documents` rows | 111 |
| `content_documents` projected SHA-256 | `06094d6a964d7cfe521a28af0e9182ada6b8527125ee0a6b0e5bad5b852fcd0c` |
| `content_documents` retained-value SHA-256 | `b57c27cbce66d7a429b7bcd4d79c7dfabc3e6df1d5bd157f00e34eedcac52357` |
| Foreign keys and SQLite integrity | Passed |
| Domain invariants | All 9 passed with 0 violations |

These are rehearsal counts. Cutover still requires a fresh frozen export and a
new canonical transform and verification. The editor-mode staging candidate
`aa9db76b-b698-4c92-8cf3-c140321a064c` predates the publication-state schema and
is superseded. No replacement staging resource has been provisioned or recorded.
