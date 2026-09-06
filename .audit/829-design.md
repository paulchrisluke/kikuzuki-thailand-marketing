# Candidate A. Typed JSON contracts and one booking decision

Historical design proposal. Final implementation and verification dispositions are recorded in 829-findings.md, 829-column-audit.md and 829-sql-consumer-review.md. Proposed signatures below are not a second supported API.

## Phase position

Ground used the fresh production export; its final reproducible inventory is 829-column-audit.md. Sketch is this artifact. Agree belongs to the parent's candidate synthesis. Implementation is outside this delegated task. Scrap applies if comparison or runtime proof invalidates this shape.

## Problem

Owners need one post and schedule contract across CMS, MCP, imports and public bookings. Writers currently persist incompatible hours forms. Availability and submission disagree. Existing experience starts can intentionally differ from normal location hours. Preserve those offered starts while making explicit location closures authoritative and every booking write safe against concurrent owner edits.

## Usage, caller's view

```ts
const calendar = await readAvailability(db, {
  organization_id, site_id,
  owner: { kind: 'location', location_id },
  dates: ['2026-09-08'],
});
return calendar.days;

const booking = await createReservation(db, {
  organization_id, site_id, location_id, date: '2026-09-08', time: '14:00',
  guests: 2, customer_id, guest, cancellation,
});
await respondToBookingChange(db, env, { request_id, decision: 'accept' });

const post = await createPost(db, organization_id, site_id, {
  post_type: 'offer', body: 'Owner-authored content', location_id,
  event: {
    title: 'Owner-authored event name',
    schedule: {
      start_date: '2026-09-08', start_time: '12:00:00',
      end_date: '2026-09-08', end_time: '22:30:00',
    },
  },
  offer: { redeem_online_url: 'https://tenant.example/offer' },
}, user_id, env);
```

Public, CMS and MCP readers use the same owner/date calculation. Public request handlers never compute slots or capacity. Existing booking-change acceptance invokes the same internal atomic availability predicate. Both post boundaries pass the same application input to the domain.

## Shape

JSON schemas define authoritative validation. Types and MCP schema fragments derive from them. The Google importer translates its documented wire response once, then calls the location domain. Google payloads are never accepted as application write payloads.

```ts
type Weekday = 'sunday'|'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday';
type DateOnly = string;
type SlotTime = string;
type EventTime = string;
type WeekPoint = { day: 0|1|2|3|4|5|6; hour: number; minute: number };
type WeeklyPeriod = { open: WeekPoint; close: WeekPoint }
  | { open: { day: 0; hour: 0; minute: 0 }; close?: never };
type OpeningHours = { periods: WeeklyPeriod[] } | null;
type DatePeriod = { open_time: SlotTime; close_time: SlotTime; close_day_offset: 0|1 };
type SpecialHours = Array<
  | { kind: 'closure'; starts_on: DateOnly; ends_on: DateOnly|null; note: string|null }
  | { kind: 'hours'; date: DateOnly; periods: DatePeriod[]; note: string|null }
> | null;
type RecurringSlots = Partial<Record<Weekday, SlotTime[]>> | null;
type AvailabilityOwner = { kind: 'location'; location_id: string }
  | { kind: 'experience'; experience_id: string };
type AvailabilityDay = {
  date: DateOnly; schedule_state: 'unknown'|'closed'|'scheduled';
  closure_note: string|null; slots: PublicAvailabilitySlot[];
};
function readAvailability(db: DbClient, input: {
  organization_id: string; site_id: string; owner: AvailabilityOwner; dates: DateOnly[];
}): Promise<{ timezone: string; days: AvailabilityDay[] }> { throw new Error('not implemented'); }
function createReservation(db: DbClient, input: ReservationInput): Promise<ReservationRecord>
  { throw new Error('not implemented'); }
function createExperienceBookingClaimingCapacity(db: DbClient, input: ExperienceBookingInput)
  : Promise<ExperienceBooking|null> { throw new Error('not implemented'); }
function bookingClaimPredicate(snapshot: AvailabilitySnapshot, requested: BookingClaim)
  : { sql: string; params: unknown[] } { throw new Error('not implemented'); }
```

DateOnly validates a real YYYY-MM-DD day. SlotTime validates HH:MM. EventTime validates HH:MM:SS with optional 1-9 fractional digits. Numeric endpoints have schema bounds. Add primitive brands only where they improve actual call-site proof. Reject unknown keys, invalid dates/timezones, duplicates, overlaps and invalid whole-week periods. Canonical serialization sorts periods/keys and removes duplicate starts. It never invents an opening period.

Opening hours preserve Places weekly endpoint semantics. Null means unknown. Present periods=[] means never open. Sunday 00:00 without close means always open. Finite periods preserve both weekdays and midnight/week rollover. Special hours remain application-owned dated overrides and closure notes. Require starts_on explicitly; the CMS may initialize it using location civil date before submitting. MCP must send it. This eliminates a server-timezone default.

Recurring slots are the sole experience schedule. Null means unknown schedule; {} means explicitly no regular starts. Lowercase weekday names are the only stored keys. CMS can apply selected times to several weekdays without a persisted flat mode.

### Exact precedence

1. Inactive location or hidden/unavailable experience product prevents new public bookings.
2. A closure containing the requested local date blocks both booking types, including open overrides. End dates are inclusive. Null ends_on means indefinite.
3. Dated hours replace weekly intervals for reservations. They constrain that date's recurring or explicitly added experience starts. Empty dated periods close both booking types.
4. Regular location hours generate reservation starts only. Experience recurrence remains independent of regular location hours. Actual data proves this distinction is needed.
5. Closed slot override removes a start. Open override may add a start outside the regular schedule but cannot defeat closure or a dated-hours exclusion. Owners reopen dated hours or clear the closure explicitly.
6. Capacity override replaces owner capacity. Count existing commitments using the current domain's counted statuses.
7. Private calendars preserve commitments after schedule changes. A historical booking never makes its slot newly bookable.

Unknown regular hours never generate reservation starts. An explicit open override can deliberately offer one. Unknown location hours do not erase known experience recurrence. Location timezone resolves through the existing location/site configuration owner. Missing timezone is a configuration error where civil time affects booking; never write a guessed UTC value.

Project weekly periods across requested local-day bounds, including previous-day overnight tails. Preserve the real closing endpoint for last seating. Use location calendar dates, not server or visitor weekdays. Skip nonexistent DST civil times. A repeated fall-back HH:MM remains one capacity bucket, matching current booking ownership; do not invent offset slot identifiers and sell it twice.

### Post shape

```ts
type CallToAction = { action_type: 'call' }
  | { action_type: 'book'|'order'|'shop'|'learn_more'|'sign_up'; url: string };
type Recurrence = { series_end_time?: string } & (
  | { kind: 'daily' }
  | { kind: 'weekly'; days_of_week: Weekday[] }
  | { kind: 'monthly'; day_of_month: number }
  | { kind: 'monthly'; day_of_week_occurrence: 'first'|'second'|'third'|'fourth'|'last' }
);
type PostEvent = {
  title: string;
  schedule: { start_date: DateOnly; start_time: EventTime; end_date: DateOnly; end_time: EventTime };
  recurrence_info?: Recurrence;
};
type PostTopic =
  | { post_type: 'standard'; call_to_action?: CallToAction|null }
  | { post_type: 'event'; event: PostEvent; call_to_action?: CallToAction|null }
  | { post_type: 'offer'; event: PostEvent; offer: {
      coupon_code?: string; redeem_online_url?: string; terms_conditions?: string;
    } }
  | { post_type: 'alert'; alert_type: 'covid_19'; call_to_action?: CallToAction|null };
type PostWrite = PostTopic & PostExistingWebsiteFields;
function parsePostWrite(input: unknown, existing?: Post): PostWrite
  { throw new Error('not implemented'); }
```

Retain post_type plus JSON event, offer, call_to_action and scalar alert_type. Delete seven flattened fields. Update validates a complete merged record and writes the complete topic projection atomically. Changing type requires a complete valid replacement topic, clearing the old topic's fields. No runtime aliases survive.

All link fields require absolute http/https. CALL requires the explicitly scoped location's canonical phone and renders tel from it. CALL never stores a URL or selects a primary location. Body remains the sole summary field. Source-locale content uses existing localization ownership. Event and offer require title and all schedule fields. Offer fields are optional; CTA is rejected. Alert is a documented topic, with summary/CTA only, no event/offer/media. Website authoring never claims Google publishing availability.

Event recurrence is content metadata rendered as the event's repeating schedule. It creates neither duplicate website posts nor speculative Google jobs. Series end limits occurrences using the location timezone. Weekly [] means the initial occurrence's weekday. Monthly selector fields are mutually exclusive in schema validation. Post local times retain seconds/fractions; Places hours remain minute-based.

Preserve website scheduled_for, published_at and post_channel_jobs. Provider resource names, state, search URL, timestamps and recurring-instance times remain unavailable provider output facts. No GBP publisher is added.

### Atomic submission and booking-change enforcement

readAvailability loads one scoped owner/location snapshot with raw canonical JSON and every field affecting the decision. This is ephemeral request data, never a new table/version/cache. Final write predicates compare those raw fields with IS against the current row. Include opening_hours, special_hours, timezone, recurring_slots, product visibility/availability, owner location and effective site timezone configuration. An intervening owner or schedule mutation returns a conflict and requires a fresh read.

The same statement reads current override state and aggregates current counted bookings. Capacity comes from current row/override values, never previously returned slot capacity. Pure snapshot eligibility is usable only while snapshot comparison holds. Compare exact override fields/existence to detect creation, change or deletion after the read. Aggregate capacity live, excluding the source booking during a move or party-size change.

Reservation and experience INSERT SELECT statements retain their capacity-safe pattern. Routes stop calculating hours. Booking-change acceptance uses the identical predicate in its existing acceptance-entry INSERT, then updates the booking inside the existing atomic executeBatch. A failed predicate inserts no acceptance entry and changes no booking. Existing dedupe semantics keep retries safe.

## Module map and removals

- shared/reservation-hours.ts owns hours schemas, dated-period evaluation, open-now inputs and recurrence lookup. Delete normalizeOpeningHours and runtime prose parsing. utils/formatters.ts becomes presentation over typed results; delete GoogleRegularHours/GoogleSpecialHours shadow types.
- server/utils/availability.ts owns scoped schedule loading, slot calculation and atomic predicate. Delete divergent calculation in reservations.ts and experiences.ts after migrating all callers. Keep their actual booking operations.
- location-management.ts parses/writes canonical JSON. Remove prose/string-array/weekdayDescriptions acceptance and specialHourPeriods serialization. location-payload.ts returns validated null/object values.
- google-places.ts normalizes v1 periods/timezone then uses location-management. client-import.mjs retires legacy Places calls and uses the same v1 contract at its existing import boundary.
- Post validation must occupy one browser-safe shared schema definition, reused by post-management, CMS and MCP. No duplicated schemas in server and editor files.
- Remove posts.cta_type, cta_url, event_title, event_start, event_end, offer_coupon, offer_terms and experiences.time_slots. Remove update topic, get_offer CTA, flat editor mode, title-cased recurrence keys, weekdayDescriptions and specialHourPeriods writes.
- Update LocationSettingsPage, HoursTimezoneCard, onboarding drafts/commit, ExperienceEditorPage/useExperienceEditor, PostEditor/useLocationPostEditor, public renderers, MCP schemas/executors, localization registry, imports, fixtures and generated catalogs in the same wave.
- Database CHECKs validate enums, topic relationships, JSON envelopes and required scalar paths. Deep arrays/calendar/overlap checks belong to the canonical boundary schema and candidate verifier. SQLite CHECK subqueries are unavailable; do not promise them or add custom migrations.

## Fresh production conversion evidence

Parsed the private export into in-memory SQLite. The export has 15 posts, 13 locations and 12 experiences. No customer IDs/messages entered tool output.

- Seven posts are update, eight standard. Event/offer fields are all null. One update carries book CTA. Convert seven update values once; move the one CTA pair into call_to_action; preserve IDs, content, scope, publication and media. Reject unexpected event/offer values in the final export rather than inventing schedules.
- Locations have three structured arrays, six weekdayDescriptions objects, four SQL nulls and no special_hours. Preserve every structured minute, including 23:59. Never reinterpret 23:59 as midnight.
- Four prose schedules fully specify AM/PM. Two compress endpoints. Existing Thai localization independently states 14:00-23:00 and 12:00-22:30 Tuesday-Sunday, Monday closed. Join that evidence by the same location IDs before accepting explicit conversion. This is corroborated data, not AM/PM guessing.
- Two localized opening_hours values exist. After proving interval equivalence, remove these redundant values_json keys and the input registry field. Derive localized weekday/time display from canonical periods. Stop on any non-equivalent custom note rather than discard content.
- Experiences have seven flat-only arrays, two recurring schedules including one dual-column row, one literal JSON null and two SQL-null schedules. Existing recurrence wins. Lowercase keys; expand flat arrays over seven days; normalize both null forms. Record the superseded dual-row flat value in private disposition evidence.
- Four actual weekly experience starts occur outside regular location hours, 15:00 Monday-Thursday against 16:00 opening. Regular-hour intersection would remove valid current offerings. Independent recurrence plus explicit location closures preserves them.
- One location with hours has neither location timezone nor site default timezone. Preserve its periods. Determine actual booking use and authoritative location data before qualification. No UTC guess is proposed.

Transfer evidence records shape counts, private mapped row IDs, removed keys/columns and projected logical hashes. Compare seven days of old/new offered starts. Preserve existing booking commitments byte-for-byte for unchanged fields. Reject new ambiguous rows at final export.

## Tradeoffs accepted

- JSON envelope CHECKs plus deep shared validation avoid several new schedule tables and arbitrary row limits.
- Conservative 409 conflicts during schedule edits preserve one pure decision calculation and atomic writes.
- Independent experience recurrence preserves actual service availability; closures and dated exceptions govern both booking types.
- Event inputs preserve seconds/fractions while reservation slots remain minute-based.

## Alternatives considered

Normalized period/closure/event tables improve relational checks but spread one location/post write across more rows and expose reconciliation to import/CMS callers. Typed JSON fits the existing ownership boundary with fewer tables and a smaller interface.

One weekly location schedule intersected with every experience initially looks smaller. Actual existing starts disprove that ownership model. It is rejected.

Stored complete Google response blobs would preserve unused provider output while creating shadow state and unsupported integration claims. They are rejected.

## Synthesis decision

Pending parent comparison. Recommend endpoint periods, independent recurrence, explicit dated closures and one atomic booking predicate. Model the Domain removed the parallel schedule forms; Type System Discipline made post topics validate as complete variants.

## Risks to resolve in implementation

The export is moving source data, so final transfer must reject new unsupported forms. Resolve the one scheduled location without timezone from evidence. Browser-proof recurrence rendering, including monthly rules and edits. The Google review/photo attribution audit remains a separate assigned workstream.

## Next implementation step

Define shared runtime schemas and pure schedule projection, then validate a private conversion probe against every affected row before editing schema.ts.

## Adopted synthesis

Candidate A is the base. Keep readable weekly endpoint periods and separate post event/offer/CTA JSON fields. Preserve independent experience recurrence based on the four existing starts outside location hours.

Graft exact decision-input equality with live capacity in one atomic claim; every later booking-change write depends on a successful claim. Compare the full weekly minute set during hours conversion. Validate RFC3339 recurrence series limits and exact monthly rules. A date override also overrides incoming spill from the previous date.

The existing shared/domain owners remain. No new service layer, persisted revision field, second scheduler or compatibility parser is authorized by this design.
