# Canonical block consumers

The epoch deletes legacy block discriminators. `findTenantPageBlock` now requires a canonical block type, returns null when none matches, and rejects multiple matches. Its legacy-type branch and the `legacy_type` metadata field were removed.

All six callers now pass canonical types directly: schedule, contact, blog index, offerings index, offering detail, and article detail. Their string-alias mapping wrappers were deleted. Schedule template and Markdown rendering changes owned by the root agent were preserved.

Contact renders all card-bearing `contact_cta` rows as a collection, preserving each row's title, description, and cards. Its consultation CTA filters the existing `section: 'consultation'` value before canonical selection. No first-match inference, new section mapping, migrated row ID, or new model was introduced.

The dead `selectPublicTenantPageBlocks` filter was deleted. Hydration uses its input blocks directly. The removed filter depended solely on `data.type === 'legal_meta'`; the generic callout renderer already omits a row lacking title and body.

Validation: scoped ESLint passed across all eight touched files; `corepack yarn typecheck` passed; scoped `git diff --check` passed. Log: `.tmp/pr864-canonical-selector-checks.log`. Browser verification remains part of the root agent's combined runtime pass.

Net line change for this selector/filter work: -28 lines. The current combined eight-file diff against `245f1f2b` is +40/-99 (-59), including the root agent's separate schedule Markdown simplification (-31). No per-block alt changes were made; those remain owned by #868.
