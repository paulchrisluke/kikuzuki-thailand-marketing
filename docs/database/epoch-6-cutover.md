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
| `krabiclaw-db-staging-epoch6` | `e93edb59-fe24-4da4-99df-0957be6e6660` | Fixture-initialized staging candidate |
| Existing configured preview | `d2f7a4a0-d6b8-493b-b484-8c0ead1ff83b` | Reset in place through the existing preview command |

The generated baseline retains 53 tables. It removes the customer
`last_booking_at` and `last_review_at` duplicate summaries and enforces canonical
UTC instants throughout application-owned timestamp columns, price validity and
quota periods. Quota end times are mandatory; booking dates and slots have civil
value checks. Better Auth continues to own its integer-backed date fields.

`scripts/epoch6-data.mjs` is an offline, one-time transfer, never a runtime reader.
It replaces the retired Epoch 5 transfer tool and its obsolete conversion tests. The released implementation remains in Git history. It refuses an existing output file, undeclared table/column changes, invalid or
unexplained timestamp shapes, target schema differences, lost rows, changed
retained values, foreign-key failures and domain invariant failures. It records
changed-column counts and retained/projected hashes in a private manifest.
Legacy SQL timestamp writers are UTC; their values are converted once. Explicit
offsets are normalized to the canonical stored representation. The removed
customer summaries are not copied or recreated; requests and reviews remain.

Run `transform` and then `verify` against the private export and candidate.
Keep all exports, candidate databases, manifests and credentials outside Git.
The September 7 rehearsal verified 53 tables and 42,211 rows; it does not replace
a final frozen-source export.

Staging uses the existing epoch fixture preparation and bulk-import procedure
in [Epoch 5](epoch-5-cutover.md#staging-preparation), substituting the Epoch 6
resource and generated baseline. Prepare fixtures through `e2e:local:prepare`;
export before any mutating tests, import only to the empty staging candidate,
and verify schema, rows and foreign keys. Production data is never staging seed.

September 7 staging preparation completed: the remote re-export matches all 53
application tables and 2,669 untouched fixture rows by exact hashes, matches the
generated baseline schema, and has no foreign-key violations. The Worker has not
yet been promoted to this binding; this is resource qualification only.

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

Repeat affected read-only production browser/MCP checks after deployment. Refresh
the existing ChatGPT review draft's tool scan and submission artifacts after the
corrected endpoint is live. Keep #829 open until its definition of done is evidenced.
