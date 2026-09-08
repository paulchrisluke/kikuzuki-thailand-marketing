The Markdown addition in owner comment 5577976570 is implemented and locally verified. This completes that implementation batch, not the full PR release gates. The PR remains Draft. No Ready transition or CI watch has been started.

| Work | Evidence |
| --- | --- |
| Shared classification | Validation, the moved canonical Markdown splitter, seeds and transfer use one predicate. Ordinary prose is rich; tables and raw HTML stay source. |
| Demo content | Four English and three Thai article representations contain heading/prose/image blocks. Only duplicate opening H1s were removed. Seven explicit image placements reuse four existing assets. |
| Exact transfer | Fresh production-export rehearsal: 268 source blocks, four retained as source, 264 reclassified. Every other JSON byte is preserved. Transform/verify, all nine invariants and exact projection pass for 52 tables / 42,429 retained rows. A fresh frozen export is still mandatory for cutover. |
| Staging fixtures | New isolated D1 aa9db76b-b698-4c92-8cf3-c140321a064c re-export exactly matches 52 tables / 2,816 pristine fixture rows. Three genuine source blocks remain; zero misclassifications. No staging Worker deployment. |
| Runtime fixes | Fixed nested Vue proxy snapshots, false edits on mount, the obsolete second article version token, and rejection of intentionally stored site-root canonical URLs. Existing URL bytes remain unchanged by fixtures/transfer. |
| Local verification | Final quality/build, 16 migration tests, two content/discovery D1 cases, 16 real API create/update cases, rich/HTML/table save-reload and all seven demo article representations pass. Local canary content was restored. |
| Review | Independent gpt-5.6-sol review and Comment Sicko. Captured browser warnings remain documented; successful save/reload paths produced no new DataCloneError. Public style warnings identify Dark Reader injection. |

Preview exact-head qualification, authenticated remote CMS/MCP, staging Worker preparation, and production freeze/fresh export/verified cutover/post-deploy checks remain open. Earlier retirement-only E2E results are not claimed for this new candidate. No production content writes, merge or promotion occurred. Issue #829 stays open. The three-tab limit was maintained.
