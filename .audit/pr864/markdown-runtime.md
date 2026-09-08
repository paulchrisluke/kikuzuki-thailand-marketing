# Markdown editor runtime verification

The Markdown batch is uncommitted on top of 62931b62. All checks below use the built production Worker locally, canonical local setup/sign-in and Better Auth impersonation of the NCLS owner. No production content was edited. PR #864 remains Draft and CI qualification is suspended by user instruction.

## Failures reproduced before the fixes

Opening the reclassified NCLS divorce article rendered eight visual editors and one HTML source editor. It incorrectly showed Unsaved changes on load. A deep watcher threw DataCloneError in buildSaveSnapshot because renderer emissions retained nested Vue proxies and toRaw unwrapped only the outer array. The first attempted save never reached the API. A probe using actual Vue reactive objects reproduced the exception and verified that a JSON snapshot preserves nested content/media independently of later edits.

The two outbound create/update snapshots now serialize their HTTP JSON domain. No recursive proxy adapter or dependency was added. The shared RichTextEditor disables Tiptap trailingNode, because the parent owns article blocks. The first rebuilt page showed Published / Saved and a disabled Save live changes button without an edit.

That build reached the article update API, which returned 400 for the obsolete expected_document_updated_at field. Request 2110fb07-e91a-4f43-a7d0-45440bde78f5 wrote zero rows. The canonical server owns one content_documents.updated_at token. The client now sends and receives that single version for saves and lifecycle actions. Its response contract requires updated_at, so missing versions fail at the response boundary. Two interim typechecks exposed the formerly nullable response type while this correction was being applied; final checks supersede those attempts.

## Review and remaining checks

Independent gpt-5.6-sol review confirmed the proxy diagnosis, trailing-node initialization cause, and single-version queue/publish ordering. It requested the required response version contract, which was applied. Comment Sicko found no added comments or suppressions in the batch.

Final quality/build, rich/source save and reload, and all seven demo article browser checks passed. Earlier browser console errors are timestamped before the fix and must not be counted as fresh failures. The browser also reported Reka hydration ID mismatches and duplicate prosemirror-model. No failure from those warnings occurred in the completed save/reload workflows.

The next API failure was canonical_url validation, request 61a50cef-9919-457b-bbdf-101c1032cc8b, status 400 and zero writes. NCLS deliberately stores /article/... canonical paths, which existing public SEO resolves against the tenant origin. Independent review confirmed this domain. The shared validator now accepts origin-preserving site-root paths without normalizing their bytes. Protocol-relative and authority-changing paths fail. A local UI diagnostic with an absolute canonical URL successfully saved the prose marker; the original relative value was then restored and verified after the final build.

## Final built-Worker results

Verified 2026-09-08T03:00:53.776Z. The rebuilt article opens as Published / Saved with Save live changes disabled. Rich prose edits persisted across a full reload. Raw HTML and Markdown table source each persisted byte-exactly, including their added canary text. The canaries were restored through the editor. The original NCLS root-relative canonical URL was restored and saved unchanged after the validator correction. These are local fixture writes only.

All four English demo articles and all three Thai representations rendered their split headings and an actual loaded content image from the existing assets. Thai pages declare lang=th. The local Worker was first configured for localhost CMS and then for demo.localhost public checks using Wrangler's host option. An initial demo-host request with the CMS forwarding host returned 404; the canonical tenant-header HTTP probe returned 200, identifying the local forwarding mismatch. No product code was changed for that test setup. The three-tab cap was maintained.

The isolated real D1 probe passed 16 create/update cases and foreign keys. It calls the actual server functions. Rich prose, source tables/HTML, site-root paths and absolute URLs persist unchanged. Rich tables/HTML and protocol-relative or slash-backslash authorities return 400 without modifying records. Run from the repository root with Node 24.18.1: node --experimental-strip-types --import ./tests/unit/support/register-aliases.mjs --test .audit/pr864/verify-markdown-api.mjs.

No fresh DataCloneError occurred in the successful save window. The public browser warning explicitly names Dark Reader-injected style variables. Earlier editor Reka ID and duplicate-ProseMirror warnings remain recorded; the tested editing/persistence workflows passed. This is local scoped evidence, not full exact-head preview, staging Worker, production or authenticated ChatGPT qualification. PR remains Draft.
