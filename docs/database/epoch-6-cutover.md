# Database Epoch 6: canonical date and time

Status: authorized; qualification in progress. PR #864, issue #829.

The owner explicitly authorized the epoch, the private production export and
subsequently the qualified production freeze, fresh export, verified transfer and
binding cutover. This does not waive the release checks.

Follow [the release contract](../operations/release-and-outage-prevention.md) and
[the date/time contract](date-time-contract.md). Never apply the new baseline to
an Epoch 5 database. Epoch 5's complete migration history remains byte-for-byte
in `migrations-archive/epoch-5`; its live production database remains rollback state.

| Resource | D1 ID | Role |
| --- | --- | --- |
| `krabiclaw-db-epoch5-production` | `58c0932a-fe6e-4062-8155-1bfd8a86c495` | Live source; retain for rollback |
| `krabiclaw-db-staging-epoch5-final` | `e1683b37-39cb-4d46-b299-7cf0b4401147` | Retained released staging |
| `krabiclaw-db-epoch6-production` | `c38458ef-eb4f-4bc2-8922-13cec27237dd` | Empty production candidate |
| `krabiclaw-db-staging-epoch6` | `e93edb59-fe24-4da4-99df-0957be6e6660` | Retained pre-consolidation candidate; superseded |
| `krabiclaw-db-staging-epoch6-combined` | `bc837e8a-b103-42e8-aecb-2c715a156e8f` | Retained 53-table candidate; superseded by credit retirement |
| `krabiclaw-db-staging-epoch6-retirement` | `880e144d-30c8-42a9-b11c-412df4d5ad00` | Retained retirement-only fixtures; superseded by editor-mode correction |
| `krabiclaw-db-staging-epoch6-editor-mode` | `aa9db76b-b698-4c92-8cf3-c140321a064c` | Retained editor-mode candidate; superseded by publication-state schema |
| `krabiclaw-db-staging-epoch6-publication` | `a19e76f9-44d2-45aa-9e94-eccbcfb1452e` | Qualified publication-state staging candidate; not deployed |
| Existing configured preview | `d2f7a4a0-d6b8-493b-b484-8c0ead1ff83b` | Reset in place through the existing preview command |

The generated baseline retains 52 tables. It removes the customer
`last_booking_at` and `last_review_at` duplicate summaries and enforces canonical
UTC instants throughout application-owned timestamp columns and price validity.
Booking dates and slots have civil
value checks. Better Auth continues to own its integer-backed date fields.

Epoch 5 already reduced 96 tables to 53 (18 Better Auth-owned and 35 application-owned).
Epoch 6 adds no tables or columns. It removes the two customer summaries and
`usage_quota_grants`. The owner authorized complete credit-system retirement in
[the PR #864 comment](https://github.com/paulchrisluke/krabiclaw/pull/864#issuecomment-5572050864).
All `usage_events` history remains, including historical credit consumption.
MCP telemetry and scheduled Google Places usage still write that ledger.

The owner also authorized Markdown editor-mode reclassification in
[the September 8 scope addition](https://github.com/paulchrisluke/krabiclaw/pull/864#issuecomment-5577976570).
This changes `content_blocks.data_json`, not the schema. Ordinary prose moves
from `source` to `rich`; Markdown tables and raw HTML retain `source` because
the visual editor cannot round-trip them. The Markdown splitter, validation, seeds and
offline transfer share `shared/markdown-editor-mode.ts` as the classification rule.
The transfer changes only the top-level `editor_mode` value and preserves every
other JSON byte, including whitespace, escaping and other keys. Its manifest
records the source census and reclassified count; `verify` compares the target
with the exact source-derived projection and rejects any other content change.

The owner authorized the article and social-post publication model in
[the September 8 publication scope](https://github.com/paulchrisluke/krabiclaw/pull/864#issuecomment-5578745078).
Article and social-post roots use `draft`, `scheduled`, and `published` lifecycle
states and independent `public` or `unlisted` visibility. Q&A remains published
only. Published roots cannot return to draft. Article previews use a signed,
article-scoped URL with a one-hour expiry; public reads continue to exclude draft
and scheduled articles without a valid preview token. Existing root social posts
have `NULL` visibility in Epoch 5. The offline transfer projects every such value
to `public`, records the source and projected counts, and rejects any unexpected
non-null legacy value instead of inferring a mapping.

A fresh September 8 Epoch 5 export has SHA-256
`03ca012a59b10cde0c812670d286536cab04ff8b58bb8922187a90d0305ac8e0`.
The publication-state rehearsal verified 53 source tables and 42,442 rows, then
passed `transform` and `verify` against baseline SHA-256
`f19f1e02f818f65ced0d7769ee5665bdfd188b83542423ed36ff5c2a19195bc0`.
The target retains 52 tables and 42,429 rows after retiring 13 quota-grant rows.
It projects all 15 root social-post visibility values from `NULL` to `public`.
The export contains 268 source-mode Markdown blocks: four require source mode
and 264 qualify for reclassification. The manifest's `content_documents`
projected SHA-256 is
`06094d6a964d7cfe521a28af0e9182ada6b8527125ee0a6b0e5bad5b852fcd0c`;
its retained-value SHA-256 is
`b57c27cbce66d7a429b7bcd4d79c7dfabc3e6df1d5bd157f00e34eedcac52357`.
Exact projections, foreign keys, integrity, and all nine domain invariants pass.
These are rehearsal counts. Remeasure the fresh frozen export during cutover and
require its counts and hashes to match the transfer manifest. The prior staging
candidates and data hashes do not qualify the publication-state schema. No
production write freeze, remote export, binding change, or data mutation occurred.

`scripts/epoch6-data.mjs` is an offline, one-time transfer, never a runtime reader.
It replaces the retired Epoch 5 transfer tool and its obsolete conversion tests. The released implementation remains in Git history. It refuses an existing output file, undeclared table/column changes, invalid or
unexplained timestamp shapes, target schema differences, lost rows, changed
retained values, foreign-key failures and domain invariant failures. It records
changed-column counts and retained/projected hashes in a private manifest.
The manifest also records the retired grants table's row count and hash of every
source column. Retirement accepts only `ai_inference` grants measured in `credit`
with a `plan`, `reset`, or `manual` grant type. An unknown resource, unit, grant type,
table, or column fails the transfer and requires an explicit mapping decision.
Legacy SQL timestamp writers are UTC; their values are converted once. Explicit
offsets are normalized to the canonical stored representation. The removed
customer summaries are not copied or recreated; requests and reviews remain.

Run `transform` and then `verify` against the private export and candidate.
Keep all exports, candidate databases, manifests and credentials outside Git.
The September 7 rehearsal verified the earlier 53-table baseline and 42,211 rows.
It predates credit retirement and does not qualify the current baseline or replace
a final frozen-source export.

The post-retirement rehearsal exported live Epoch 5 on September 7 and passed
both `transform` and `verify` against the current generated baseline. It retained
42,400 rows across 52 tables, with exact projected and retained-value hashes,
matching schema, clean foreign keys and domain invariants. The manifest accounts
for 13 retired quota grants and hashes every source column. Source export SHA-256
is `ec88b502657c2f5176230d2fecf34248e0be9f47934944cd7d3ee62dfd358f28`;
baseline SHA-256 is `7c76a4988b3ef7e05c39783092c16cac89c79356c34a6b6b1e8861901c3f5ebb`.
Private exports and manifests remain outside Git. No production freeze or binding
change occurred. A fresh frozen-source export remains mandatory for cutover.

Staging uses the existing epoch fixture preparation and bulk-import procedure
in [Epoch 5](epoch-5-cutover.md#staging-preparation), substituting the Epoch 6
resource and generated baseline. Prepare fixtures through `e2e:local:prepare`;
export before any mutating tests, import only to the empty staging candidate,
and verify schema, rows and foreign keys. Production data is never staging seed.

September 7 combined staging preparation completed: the remote re-export matches all 53
application and Better Auth tables and 2,863 untouched fixture rows by exact hashes, matches the
generated baseline schema, and has no foreign-key violations. The Worker has not
yet been promoted to this binding. This earlier qualification predates credit
retirement. Rebuild and requalify the unreleased staging candidate against the
current generated baseline before promotion.

The replacement `krabiclaw-db-staging-epoch6-retirement` is prepared. A pristine
same-drive checkout passed canonical `e2e:local:prepare`, including the production
build, and `fixtures:verify:local`. Before import, the new remote database had
52 empty application and Better Auth tables and only the generated baseline in
its migration ledger. The imported fixtures and remote re-export match exactly
across all 52 tables and 2,740 rows, including column/storage census and logical
hashes. Both candidates pass all nine ownership/domain invariants, foreign-key
checks and SQLite integrity checks. The remote export SHA-256 is
`26d2ba6100291f18bcd824b057f6bd8a01d9c7f35980f496e4cce7fa9457a417`.
Only the `env.staging` binding changed in source. No Worker deployment or
post-start social-card initialization has occurred for this candidate.

PR #864 incorporates #866's CMS editor/list work and #865's demo content. The
superseded editor and date conversion helpers are deleted. Demo representations
contain only localized copy, explicit routes and root references; publication
state and schedules remain on roots. Invalid fixture inserts fail instead of
being ignored. The fixture compiler uses the runtime localization validator.
The demo's active Growth fixture grants its published Thai language through the
existing billing source. Ten translated article, experience and post routes pass
against the local production Worker.

Preview qualification must exercise the affected booking, post/blog scheduling,
MCP contract, public renderer and date displays. Follow the representative tenant
matrix and expand published-route checks for this shared formatter change. Run
local CLI reviews and resolve first-party failures before promotion. Remote E2E
checks use the requested 30-minute wakeups.

After qualification, perform the documented maintenance deployment with the old
production binding and `DB_WRITE_FROZEN = "true"`; wait at least 60 seconds for
in-flight requests to drain. Export the frozen source, transform and verify it,
apply the generated baseline to the empty production candidate and import the
verified data-only payload. Re-export and verify exact projected rows, schema and
foreign keys before cutting the normal production binding to Epoch 6 and removing
the freeze. If the cutover cannot finish promptly, restore the prior Worker.
Never rewrite a migration ledger or patch the old production data.

Repeat affected read-only production browser/MCP checks after deployment. The owner
cancelled the ChatGPT review and will handle resubmission after production; the
contributor must keep the MCP catalog and submission artifacts current and verify
the deployed contract. Keep #829 open until its definition of done is evidenced.

The editor-mode fixture replacement is prepared in
`krabiclaw-db-staging-epoch6-editor-mode`,
`aa9db76b-b698-4c92-8cf3-c140321a064c`. A separate checkout passed immutable
installation, canonical `e2e:local:prepare`, and `fixtures:verify:local` before
any browser or API writes. Its standard data-only dump passed exact offline
replay verification. The new remote resource contained 52 empty tables and only
the generated baseline ledger entry before import. Its re-export matches all
2,816 fixture rows, column/storage and logical hashes, baseline schema, foreign
keys, integrity and all nine ownership invariants. Three source-mode blocks
remain, all required by the shared predicate; none is misclassified. Remote
export SHA-256 is
`d3533d8b64ac0cfe369e3a1463c1932a0fdae188d56e921fa717d2d0c5d6cad6`.
Only the staging binding changed. Prior resources remain retained. This
candidate is superseded by the publication-state schema and must not be promoted.

The replacement publication-state candidate is prepared in
`krabiclaw-db-staging-epoch6-publication`,
`a19e76f9-44d2-45aa-9e94-eccbcfb1452e`. The isolated checkout captured
`64d5ab164455b40fb52529d8673f32ce5d7e7afd` plus tracked working-tree patch
SHA-256
`20309896ecfe57692659f1f6e22785dde17949db8530f9a0739e9c906d2c1a7d`.
Pinned Node 24.18.1 immutable installation, canonical `e2e:local:prepare`, and
`fixtures:verify:local` passed before export. The generated baseline created 52
empty tables with only `0000_epoch_6_baseline.sql` in the migration ledger. The
data-only replay and the imported candidate re-export match the 2,816 fixture
rows exactly across schema, column storage, row counts and logical hashes.
Foreign-key and integrity checks pass, and all nine domain invariants have zero
violations. The remote re-export SHA-256 is
`51501babc5ab68fd3ef4c2f8d7833f5fa8f4b70d1cdabe13ff7eb1762c49b73c`.
Prior staging resources remain retained. No staging Worker deployment or
post-start initialization has occurred for this candidate.
