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
| `krabiclaw-db-staging-epoch6-retirement` | `880e144d-30c8-42a9-b11c-412df4d5ad00` | Verified 52-table fixtures; Worker qualification pending |
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
