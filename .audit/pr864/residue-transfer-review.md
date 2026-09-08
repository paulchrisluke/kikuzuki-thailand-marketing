# Epoch 6 residue reconciliation

The revised offline projection implements owner comments 5580658022 and 5580729953 without adding a block type. The former schedule type restoration is superseded.

- Source SHA-256: `03ca012a59b10cde0c812670d286536cab04ff8b58bb8922187a90d0305ac8e0`.
- Generated baseline SHA-256: `6caaf8aa51cd49168b22723f2a29a431357c5388caf2836647cba6be0da4adba`.
- Verified target SHA-256: `f385d86861a915def1a6375a61c08c81c59a0213c7e3e69b8139f7a9af36ea8b`.
- Exact projection: 52 tables, 42,429 rows, zero foreign-key or domain violations.
- Markdown: 264 source-to-rich changes and 48 missing modes filled (47 rich, 1 source). The earlier 47 missing-mode census excluded the structural row and is superseded. All 316 resulting Markdown rows satisfy the shared classifier: 311 rich, 5 source.
- Headings: 23 normalized, including 7 escaped punctuation cases; zero remaining measured heading markers.
- Residue: 13 rows changed, removing 5 legacy_type keys, 5 nested type keys and 8 image alt keys; one flattened Markdown payload retains its existing content string as markdown and retains decoration. Its row type is unchanged.
- The union is 347 data_json changes, with one explicitly counted overlap between missing-mode backfill and residue cleanup.
- Media: the owner's exact SQL predicate selects 144 machine alt values across all sites. All become NULL; the other 197 alt values remain identical. Media placement values and every other undeclared media field remain identical apart from existing epoch timestamp normalization.

All 9 real SQLite transfer integration cases and focused ESLint pass. Corruption checks reject altered content, numeric lexemes, nested values, editor modes, residue key sets, residue discriminators, duplicate deletion keys and unrelated prose alt values. Root-field deletion is exercised at first, middle and last positions, including nested arrays/objects. A single-field deletion cannot occur under the accepted source shapes, which retain at least one field.

The final rename uses the same depth-aware root-token scan as replacement and deletion. The retained-decoration fixture includes a nested content key and passes. Repeating the complete transform and verify after this correction produced the identical target SHA-256 above.

The private source export and target remain outside the repository. Sanitized counts and hashes are in residue-rehearsal-final.json. No browser, remote database, deployment or PR status action was performed.
