# Date and time contract

Status: Epoch 6 authorized; local implementation and qualification in progress.

`utils/timezone.ts` owns validation, JSON Schema primitives, civil formatting and
zone conversion. `server/db/schema.ts` owns persistence constraints. Dashboard,
public pages, ChowBot and MCP must use these contracts rather than permissive readers.

| Value | Canonical representation | Zone source |
| --- | --- | --- |
| Calendar date | Gregorian `YYYY-MM-DD` | No conversion |
| Booking slot / opening hour | `HH:mm`, 24-hour wall time | Explicit selected location |
| Precise event wall time | `HH:mm:ss` with optional fractional seconds | Explicit selected location |
| Application instant | UTC `YYYY-MM-DDTHH:mm:ss.SSSZ` in storage | API requires an explicit offset before normalization |
| Provider timestamp | Provider's documented type and unit at its adapter boundary | Provider contract |
| Analytics day | Gregorian civil day in the report timezone | Selected site's analytics configuration |
| Organization analytics range | One shared Gregorian range, ending on the current UTC date unless explicitly supplied | UTC defines range labels; each site measures those dates in its configured timezone |
| Publication scheduling | Explicit instant; editor labels UTC | Explicit editor zone |

Human formatting is locale-aware and Gregorian. Zero seconds are omitted;
meaningful seconds remain visible for precise wall times. Formatting never changes
the stored value. Civil dates never pass through a browser timezone. Missing
values show named empty states; invalid values fail. Booking times that fall in
DST gaps or overlaps fail rather than choosing an instant. Reporting boundaries
include the entire civil day using explicit calendar-boundary transition semantics.
The installed `@internationalized/date` library owns transition resolution; see
[its documented conversion policies](https://react-aria.adobe.com/internationalized/date/CalendarDateTime#conversion).

## September 7 aggregate audit

A read-only production audit checked 106 application-owned timestamp columns.
Twenty-two columns contain values outside the canonical UTC millisecond shape.
No tenant rows, identifiers or auth records were exported for this audit.

Most discrepancies are SQL timestamps with a space and no offset. Legacy writer
provenance must establish UTC before conversion. `customers.last_booking_at`
was a different defect: all 12 populated values were offsetless local timestamps.
Both it and `customers.last_review_at` were duplicate summaries with no UI
consumers. Epoch 6 deletes these columns and every runtime writer/reader; the
actual request and review records remain the source. No compatibility projection
replaces them. Some imported review timestamps had excess fractional precision;
the application instant contract stores milliseconds, while precise event wall
times retain the domain's fractional precision.

Current changes delete the duplicate customer date writers and correct SQL timestamp writers and lexical
comparisons. They deliberately do not add readers accepting the old formats.
Existing production values must be corrected before those readers are released.

## Authorized database epoch

Adding the customer timestamp checks through the pinned Drizzle generator produced
`DROP TABLE customers`. The existing migration lint rejected the referenced-parent
rebuild. The generated SQL was neither committed nor applied. A normal migration
cannot deliver this constraint safely under the repository contract.

The owner authorized Epoch 6 under
[the release contract](../operations/release-and-outage-prevention.md#migration-and-content-safety):
retain the released Epoch 5 database and history, generate a fresh schema baseline,
transfer every retained value into a new resource with one-time UTC normalization, verify
row identities, constraints and foreign keys, qualify preview and staging, then
perform the documented production write freeze and binding cutover. No custom
migration or in-place production patch is permitted. The owner explicitly approved the private production export and subsequently the qualified production freeze, fresh export, verified transfer and binding cutover.

Issue #829 and PR #864 must remain open. The earlier MCP-only validation does not
qualify this broader date/time change. Remote E2E checks use 30-minute wakeups.
ChatGPT resubmission waits until the corrected production MCP contract is deployed.


The September 7 rehearsal exported production into a private local file and
verified a fresh Epoch 6 target: 53 tables, 42,211 rows, exact retained values,
foreign keys and domain invariants. Production was unchanged. The final cutover
still requires a fresh export after the documented write freeze and completed
runtime qualification; the rehearsal is not a production deployment.
