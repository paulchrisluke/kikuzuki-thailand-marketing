# Why

Epoch 6 standardizes timestamps and civil time, removes duplicate customer
summaries, consolidates #865 and #866, and retires AI Gateway document
extraction and AI-credit accounting. The later owner requests add correct
Markdown editor classification and a consistent draft, scheduled, published,
public, and unlisted publication model for articles and social posts.

# Scope

- Remove provider extraction, credit charging, balances, grants, gates, tools,
  UI, configuration, and product promises. Retain Better Auth, subscriptions,
  explicit product/media writes, Places, WhatsApp, and operational usage events.
- Create articles and social posts as drafts unless callers explicitly publish
  or schedule them. Keep publication permanent; visibility controls discovery
  independently. Signed one-hour article previews use the canonical public read
  paths and remain private, uncached, and non-indexable.
- Use one shared Markdown eligibility predicate in runtime validation, fixture
  generation, and the offline transfer. Demo articles now contain real heading,
  prose, and image blocks. The transfer reclassifies only eligible blocks and
  preserves all other JSON bytes.
- Regenerate the single 52-table Epoch 6 baseline and project legacy root social
  visibility from `NULL` to `public` through the declared offline transfer.
- Fix runtime blockers exposed by qualification: server/client location-header
  disagreement, incomplete platform English-locale provisioning, late Nuxt SEO
  header overwrite, stale Blawby client preview content, and the review-submit
  SSR/client error-state mismatch.

# Tradeoffs

Published content cannot return to draft or scheduled state. It can become
unlisted without breaking its direct URL or first-publication history. Q&A stays
published-only. Preview tokens do not create an alternate reader, cache, or
content model.

PR #868 owns dashboard publication controls and the image slash-menu fix. This
PR includes only the explicitly requested shared draft type unions and the
client token/error propagation required for signed previews to work. It also
includes the independently reproduced shared-header and review-submit hydration
corrections that blocked full-route qualification. No custom migration,
compatibility path, manual tenant-data patch, or replacement AI provider is
introduced.

# Blast Radius

The change affects the generated D1 baseline and offline transfer, article and
social lifecycle APIs, MCP schemas, public article/post discovery, sitemaps,
preview headers and cache policy, fixture content, and the generated ChatGPT
submission artifact. Existing billing, auth, product/media, Places, WhatsApp,
and retained usage-event behavior remains on its canonical implementation.

# Verification

- Pinned Node 24.18.1 canonical setup, quality, typecheck/lint, production build,
  185 unit tests, 23 serial real-D1 tests, and 16 migration/epoch tests passed.
- Catalog/submission checks pass with 96 registry tools, 95 exposed tools, two
  removed tools, 35 changed retained schemas, output schemas present, and five
  positive plus three negative review cases.
- The authenticated HTTP/SSR lifecycle matrix passed on build
  `dad9de8a-b5e8-40ea-9204-0e22b7f89f38`: three scopes, 119 sanitized records,
  12 exact-ID canaries deleted, every absence verified, and the session signed
  out.
- Signed client-navigation preview checks passed three of three on build
  `dad9de8a-b5e8-40ea-9204-0e22b7f89f38`: valid drafts rendered, invalid tokens
  returned 404 and removed the prior body, no document navigation or uncaught
  error occurred, and all canaries were deleted.
- Route coverage is composite. The complete 544-case sweep on build `dad9de8a`
  passed 533 and exposed 11 cases. After the review-submit correction and
  bounded media diagnostics, all 12 affected cases passed on build `f1893229`
  with zero retries. This is not a claim that one later 544-case sweep passed.
  The two NCLS desktop/narrow playback checks separately proved decoded video
  advanced beyond one second while recording the reviewed YouTube GPU warnings.
- The fresh clean-fixture retained 91-case Chromium suite passed 90 cases with
  one HTTPS-only `private_key_jwt` skip, zero failures, and zero retries on build
  `f1893229-472f-4b19-9edc-2524bc872a36`. Build identity matched before and
  after the 06:25:22 to 06:27:31 UTC run.
- The fresh staging D1 candidate
  `krabiclaw-db-staging-epoch6-publication`
  (`a19e76f9-44d2-45aa-9e94-eccbcfb1452e`) has the generated baseline and an
  exact 52-table, 2,816-row fixture re-export. Schema, column storage, row
  counts, logical hashes, foreign keys, integrity, and all nine invariants pass.
  No staging Worker has deployed to it.
- The offline production-export rehearsal retained 42,429 rows, projected 15
  social visibility values, and reclassified 264 of 268 source-mode Markdown
  blocks while retaining four as source. Frozen-cutover counts must be measured
  again from the final production export.

The complete pre-review source and local verdict is recorded in
`publication-local-completion.md`. A 06:27:08 UTC refresh found no changes
across the 27 reviewed comments and reviews. Exact-candidate preview, staging
deployment, production cutover, deployed browser/MCP checks, real-account
auth/billing proof, and #829 completion remain release gates. The owner handles
ChatGPT portal resubmission.
