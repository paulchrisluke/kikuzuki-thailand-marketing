# Epoch 6 markdown editor mode transfer

Owner authorization is [comment 5577976570](https://github.com/paulchrisluke/krabiclaw/pull/864#issuecomment-5577976570).

The transfer imports the shared `editorModeFor` predicate. It changes only markdown blocks whose current mode is `source` and whose content is eligible for `rich`. It replaces the top-level mode value token directly. Every other byte of `data_json` is retained, including whitespace, numeric spelling, escaped strings, key order and nested values. Ambiguous duplicate mode keys fail the eligible-row transformation.

The source census uses the canonical predicate before projection. The number of changed `data_json` values must equal the eligible source count. Both commands record `markdown_editor_modes` in their manifests. Verification compares complete target rows against the exact source projection, including `data_json`.

## Offline production export rehearsal

This export was taken before a write freeze. These counts are rehearsal evidence. Cutover still requires a fresh frozen export and new transform and verification runs.

| Check | Result |
| --- | --- |
| Source export SHA-256 | `03ca012a59b10cde0c812670d286536cab04ff8b58bb8922187a90d0305ac8e0` |
| Local baseline SHA-256 | `7c76a4988b3ef7e05c39783092c16cac89c79356c34a6b6b1e8861901c3f5ebb` |
| Tables and retained rows | 52 tables, 42,429 rows |
| Content blocks | 690 |
| Source markdown blocks before transfer | 268 |
| Blocks requiring source mode | 4 |
| Reclassified blocks | 264 |
| Transform and verify | Passed |
| Domain invariants | All 9 passed |
| Foreign keys and database integrity | Passed |
| Content block exact projection SHA-256 | `fcf2ad0d99fdd066647ee3856b874f3221a7f232712aafd8b711c899cbbb90f9` |

The local baseline hash includes CRLF bytes. The committed LF baseline hash remains `fd011b00cba758cff2e8cdf4dbef1b24807913f886db297e1c7b3b82d5fac80b`.

## Integration evidence

The transfer integration suite passed all 8 tests on Node 24.18.1. The retained-record workflow now exercises ordinary and empty prose, nested mode fields, escaped key and value tokens, first-line tables, raw HTML, existing rich blocks and other block types. It verifies the source census and both manifests.

The complete `yarn test:migrations` suite passed all 16 tests without skips. The local log is `markdown-transfer-migration-tests.log` beside this file.

Deliberately changing markdown, another nested key, numeric spelling from `1e3` to `1000`, or the expected reclassified mode makes `verify` fail its exact-projection check. The numerical change has equal parsed JSON value and still fails because the owner requires byte preservation.



This subtask made no remote writes, created no migration, and changed no PR or CI status.
