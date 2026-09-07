# Issue 829 design cross-judge

> Historical evidence from the superseded 94-table proposal. This document's implementation, test and review claims apply only to its recorded revision, not the current [53-table consolidation contract](../docs/database/epoch-5-consolidation.md). Current authorization is PR #848 ready for review only: no staging/production merge, deployment, initialization or further staging writes. Current gates are in [829-checklist.md](829-checklist.md).


## Verdict

Use Candidate A as the base. It is the only candidate that resolves the live availability evidence correctly and carries the fresh production census through a concrete conversion. Graft four proof obligations from Candidate B, then tighten one boundary in A. Do not average the storage shapes.

## Evidence that controls the decision

- The private census has 15 posts, 13 locations, and 12 experiences. That matches Candidate A's fresh counts and supersedes the older issue counts.
- Four valid weekly experience starts are at 15:00 Monday through Thursday while the owning location opens at 16:00. Regular location hours therefore cannot be a blanket intersection for experience recurrence.
- Explicit whole-location closures and dated closed hours still block both reservation and experience sales. Unknown regular hours do not erase a known experience schedule.
- Google Places weekly hours are open/close weekday points. Missing periods means unknown, an empty periods list means closed, and Sunday 00:00 without a close means always open.
- Google's current LocalPost contract requires event data for event and offer, ignores CTA for offer, leaves CALL URL unset, makes offer fields optional, and models recurrence as daily, weekly, or monthly under the event.

## Scores, 0 to 5

| Criterion | Candidate A | Candidate B | Judgment |
| --- | ---: | ---: | --- |
| Google semantics | 5.0 | 4.0 | A preserves Places endpoint periods and separates provider wire casing from application casing. B is semantically convertible but stores opaque week-relative minute offsets. |
| One canonical owner, no legacy | 4.5 | 4.0 | A names one schedule owner, one availability owner, one shared post schema, and explicit deletions. B's `OpenPeriod` has two coordinate systems, weekly absolute and dated relative. |
| Verified lossless conversion | 5.0 | 3.5 | A uses fresh row counts, enumerates every observed shape, preserves 23:59, resolves prose only with corroborating tenant evidence, compares offered starts, and requires logical hashes. B mostly describes a future census and leaves live policy open. |
| Atomic booking correctness | 4.5 | 4.5 | Both use a pure decision plus exact snapshot guards and live capacity in the write statement. A lists more decision inputs. B states the zero-row batch failure requirement more clearly. |
| Minimum reader burden and deletions | 4.5 | 3.5 | A keeps imported hours recognizable and concentrates calculation in existing modules. B deletes more post columns, but pushes routine queries into JSON extraction and makes stored hours hard to inspect. |
| Total | **23.5** | **19.5** | **Candidate A wins.** |

## Keep from Candidate A

1. Keep Places-like weekly open/close points as the canonical `opening_hours` value. Preserve close weekday and week rollover instead of converting persistence to offsets.
2. Keep application-owned dated hours and closures distinct from Google Places data. Require `starts_on`; never derive it from server time.
3. Keep `recurring_slots` as the sole experience schedule. Regular weekly location hours generate reservation starts only. Explicit closures and dated exclusions govern both booking types.
4. Keep one `readAvailability` decision for public, CMS, MCP, and booking-change paths. Final writes compare every raw decision input and count commitments live.
5. Keep the shared discriminated post write schema, complete topic replacement, and deletion of flattened fields and runtime aliases.
6. Keep A's evidence-led transfer. Stop on new ambiguous rows instead of guessing or retaining a compatibility parser.

## Graft from Candidate B

1. Prove weekly-hours conversion by comparing the open interval set at every minute across the full wrapped week. Test intended fixes, such as the prior-day overnight tail and unknown versus closed, separately from lossless equivalence.
2. Make a zero-row guarded claim abort every dependent mutation. In booking-change acceptance, all later statements must depend on the inserted acceptance entry, and the caller must verify that entry before email or projection effects. Guard the current booking row/version and exclude it from destination capacity when appropriate.
3. Validate `series_end_time` as an RFC 3339 instant. Encode the Google rules that empty weekly days derive from the event start weekday and monthly ordinal weekday also derives from the event start weekday.
4. State the dated-spill rule explicitly: an explicit override for the next local date replaces any weekly or dated period spilling into that date.

## Revise in Candidate A

- Keep `bookingClaimPredicate` private to `availability.ts`. Returning SQL text as a public domain interface leaks storage mechanics and creates a pass-through seam.
- Define one canonical absence form for optional nested post values at persistence. The parser may accept the chosen API absence form, but serialization must not preserve both missing and null variants.
- State that an open and close at the same civil time is invalid unless the representation explicitly means a full-day interval. Preserve source 23:59 exactly.

## Reject from Candidate B

- Reject the unresolved experience-hours policy. Its open risk asks for evidence already available, and a blanket regular-hours intersection would delete four valid offerings.
- Reject persisted week-relative `start_minute` and `duration_minutes`. The representation hides weekday meaning, overloads `OpenPeriod` for two coordinate systems, and adds formatting work to every inspection path.
- Reject moving stable `post_type` and `body` into one `content_json` blob. The shared discriminated schema and atomic complete projection already enforce topic validity; JSON extraction would spread storage knowledge through list, localization, rendering, and database checks.
- Reject generic transfer promises where A already supplies a row-by-row shape plan grounded in the fresh export.

## Verification bar for the synthesized design

The conversion verifier must reject unmapped records, compare typed logical hashes, compare seven days of experience starts, compare full-week location intervals minute by minute, and preserve existing booking commitments. Runtime proof must show the same result through availability and final submission, including a concurrent closure, schedule edit, override creation/deletion, capacity race, and booking-change acceptance. The four 15:00 experience starts must remain bookable unless an explicit closure or dated exclusion blocks their local dates.

Official reference checked: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts, last updated 2026-04-15 UTC.
