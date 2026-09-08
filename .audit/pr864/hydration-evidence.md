# PR 864 hydration evidence

Evidence paths below are relative to F:/My Github Repos/Closed Source Repos/krabiclaw. The original failure capture is retained; the follow-up adds local runtime proof.

September 7 follow-up closes the local seconds/fractions gap. `verify-time-format.mjs`
executes the canonical formatter in Node 24.18.1 and Chromium 151.0.7922.34.
All 16 comparisons match across en-US, th, de-DE and ar-EG with inputs 12:00,
19:30, 22:00:45.123456789 and 22:00:00.000000001. The assertions preserve seconds
and all nine fraction digits and reject remaining U+00A0/U+202F. Exact outputs
and codepoints are in `time-format-runtime.json`. The 70-case Worker browser run
also passed the affected tenant rendering, navigation and localization workflows.
The historical preview timeout limitation below remains open.

- .audit/pr864/ci-34117369033.log:2777-2778 preserves Pottery server \u escapes: 12:00\u202FPM \u2013 7:30\u202FPM. Client: 12:00\u0020PM \u2013 7:30\u0020PM.
- Lines 2787-2788 preserve Kikuzuki server: 2:00\u202FPM \u2013 11:00\u202FPM. Client: 2:00\u0020PM \u2013 11:00\u0020PM.
- .audit/pr864/observability.json correlates Pottery application request e8b69a83-25b0-43a4-b92b-925ab8530334 and Ray a3759384b916d8ab with Worker request f8f594b1bd8a900863a9014a87d11866, trace 898c5cad46562f66963d8589390b1f48, HTTP 200, CPU 252ms, wall 3824ms.
- utils/timezone.ts:66 is canonical formatTime. shared/reservation-hours.ts:169 calls it for today hours; utils/formatters.ts:25 for weekly hours; shared/posts.ts:154 for event schedules. The e841e765 diff changes only final U+00A0/U+202F replacement to U+0020. Validation, locale selection, meaningful seconds and fraction logic stay unchanged.
- .audit/pr864/final-checks.log proves Node 24.18.1 output for 12:00, 19:30 and 22:00:45.123456789 in en-US. The four tests in tests/unit/formatters.test.ts do not test formatTime; they test date/instant/DST behavior. At that checkpoint, precise-second non-English runtime output remained a gap, now closed by time-format-runtime.json. The proposed probe was: existing formatter with 22:00:45.123456789 and 22:00:00.000000001 in en-US and th; capture outputs/codepoints and compare pre/post modulo specified whitespace normalization.
- .audit/pr864/independent-preview-timeout-observability.json records a candidate canceled Worker invocation at 36983ms wall time. Browser supplied no request identifier, so attribution remains uncertain. Retrospective inspection does not repair the missed inspection-before-retry ordering.
