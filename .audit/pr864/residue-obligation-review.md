# PR 864 residue obligation review

The current source satisfies the additional implementation scope in owner comments 5580407133, 5580658022 and 5580729953. I found no remaining source blocker in this bounded review. This is not permission to mark Ready: combined local runtime verification, final staging fixture qualification, current release documentation, and a fresh comment refresh remain pending.

Reviewed the 30 current comment/review objects in `comment-refresh-2026-09-08T07-37-42-323Z.json`, the prior publication comment audit and completion record, the current diff over `245f1f2be51a1cd75b8fc588cedee25281fb5199`, and the residue transfer, rehearsal, fixture and canonical-selector evidence. The publication and retirement work already proved at 245 remains historical evidence with its recorded limits. This pass does not repeat or extend those runtime claims.

| Owner obligation | Current implementation and assessment |
| --- | --- |
| Missing Markdown modes | `scripts/epoch6-data.mjs` uses the existing `editorModeFor` for missing/null modes and prior source reclassification. Invalid modes, non-string Markdown and rich-mode tables/HTML reject. No blanket rich default. Source counts remain measured rather than hard-coded to the owner's local fixture census. |
| Plain heading text | Only the observed balanced outer emphasis form is normalized. The existing Markdown-to-plain utility must produce exactly delimiter removal and punctuation unescaping. Other root and nested values retain their bytes. The rehearsal reports all 23 headings, including seven escaped punctuation cases. |
| Machine media alt values | The exact owner SQL predicate is used for the census and asserted again before changing a value. Only `media_assets.alt_text` becomes NULL. No title, offering name, reviewer name or other substitute is written. The rehearsal reports 144 cleared values and 197 other alt values unchanged. Missing real image descriptions remain a separate client handoff failure; this review does not waive that gate. |
| Stored residue | Exact accepted key sets and discriminator values are asserted before deleting root `legacy_type`, nested `type`, image `alt`, and the one flattened Markdown payload's component keys. Unexpected shapes and ambiguous deletion keys reject. Nested retained values and numeric lexemes remain unchanged. |
| No new model | The abandoned `schedule_guidance` type/schema/editor additions are absent from the current diff. The one existing Markdown row retains its row type, its existing content string becomes `markdown`, and its decoration remains. The schedule renderer reads that canonical Markdown field through the existing rich-text renderer. No new content is synthesized. |
| Explicit transfer accounting | The source census records each projection, the union of changed block IDs, and the overlap count. The shared `changes.data_json` assertion equals that union, so the flattened row's mode addition is not double-counted. Exact projected table digests, retained-column digests, foreign keys and domain invariants remain enforced. |
| Fixtures do not recreate defects | NCLS snapshot corrections and the existing tenant-page seed generator cover modes, headings, residue and machine alt values. The generator uses `editorModeFor` and no longer emits image `alt`. No runtime seeding or row patch is introduced. |
| Immediate consumers | All six `findTenantPageBlock` consumers now name canonical types. Duplicate matches reject rather than choose an arbitrary row. Contact renders card-bearing blocks as a collection and selects its CTA by the existing consultation section. The obsolete legal metadata filter and legacy selector branch are deleted with their replacement. |

The verified production-export rehearsal has 52 tables and 42,429 rows. It reports 264 source-to-rich changes, 48 missing modes filled, 23 headings normalized, and 13 residue rows changed. The union is 347 changed block JSON values with one overlap. All 316 resulting Markdown blocks satisfy the shared classifier, with 311 rich and five source. Target SHA-256 is `f385d86861a915def1a6375a61c08c81c59a0213c7e3e69b8139f7a9af36ea8b`; baseline SHA-256 is `6caaf8aa51cd49168b22723f2a29a431357c5388caf2836647cba6be0da4adba`.

I independently compared the NCLS fixture's parsed rows against 245. Only `media_assets.alt_text` and `content_blocks.data_json` differ. The fixture contains 141 alt changes, each satisfying the owner's predicate and becoming NULL. Its 46 changed block values contain 23 heading changes, ten mode additions and 14 residue rows with one overlap. These fixture counts are separate from the production export counts. All row counts and other row fields remain unchanged.

Ownership with #868 was checked against fetched head `7dffdd1e6285bac1c2189d5f1bbc18a2fc141de4`. That head now contains the shared Markdown contract in the renamed `server/utils/content/documents.ts`, text-format declarations in `shared/content-registries.ts`, and equivalent tenant-page generator corrections. #864 does not duplicate the shared-writer/registry change or the blog image-menu fix. The canonical public-selector and schedule-renderer changes are inseparable consumers of residue removal and must be named in the final handoff for #868's rebase. Backfill must land before or with shared enforcement. #868 must not deploy enforcement against the unreconciled database.

Before the final completion claim, retire the stale work-plan paragraphs that still call residue optional, propose a schedule block type, or identify 73362be3 as the latest #868 head. The opening supersession notice is correct, but the final PR body and cutover record must describe the resulting implementation and final staging resource without requiring readers to reconstruct abandoned work.

Current owner body hashes:

| Comment | Updated UTC | SHA-256 |
| --- | --- | --- |
| 5580407133 | 2026-09-08T06:34:28Z | `81259fec6d17cffc6bae1968a25a02a1f6d87840f1267a40914cd7f5bba3a452` |
| 5580658022 | 2026-09-08T06:55:46Z | `5e6d3809e4e867834be11d09c5babdd4d63f1a273e124c77252156aca40b2228` |
| 5580729953 | 2026-09-08T07:02:02Z | `f1a71ffc5b51d01250ae2ec15b09ddb14a0ed2772db66fdce303379c63cceab7` |

No application source edit, browser operation, remote database action, GitHub write, push, or PR state transition occurred in this review. Runtime and staging results being collected by the root agent are not claimed here. Exact-candidate preview, deployed staging checks, the fresh frozen production export and verified cutover, and post-deployment checks remain later release gates.
