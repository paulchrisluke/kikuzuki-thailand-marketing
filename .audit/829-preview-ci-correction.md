# PR 848 preview CI correction

> Historical evidence from the superseded 94-table proposal. This document's implementation, test and review claims apply only to its recorded revision, not the current [53-table consolidation contract](../docs/database/epoch-5-consolidation.md). Current authorization is PR #848 ready for review only: no staging/production merge, deployment, initialization or further staging writes. Current gates are in [829-checklist.md](829-checklist.md).


The latest user instruction limits this work to an open PR ready for review.
Do not merge to staging or production, initialize staging cards, mutate live
providers, or close #829. The previously prepared staging database remains
undeployed. Earlier staging-release instructions are superseded.

## Failure evidence

Run `34046306757`, candidate `67828d06eed2217f788bc341557404d7483fb72f`,
passed static checks and preview deployment. Chromium finished with 63 passes,
three failures and one intentional local-only cancellation-validation skip.
The HTTPS ChatGPT-shaped CIMD private-key JWT and replay test passed.

1. Kikuzuki exhausted a 120-second test budget shared by approximately 41 seconds
   of fixture setup and the browser journey. The final navigation returned HTTP
   200 near the deadline. Fixture setup now has its own bounded `beforeAll`
   lifecycle; browser assertions and its 120-second budget are unchanged. A
   separate read-only run against the deployed preview completed all five
   navigations and localization assertions in 80.040 seconds without retries.
2. Signed email ingress exhausted the default 30-second budget after setup/auth
   and its first accepted reply. That request took 6,492 ms, including 5,669 ms
   attributed to D1, versus 7 ms of SQL execution. The duplicate request had no
   completed response in the examined logs; its outcome was not assumed. The
   multi-request test now has a 90-second budget, a bounded authentication step,
   15-second request limits, no retries, and phase/request/Ray-ID diagnostics.
   Transport failures omit request headers and credentials from test errors.
3. Pottery booking committed D1 state, then failed while broadcasting a dashboard
   invalidation. Request `5153ddf3-7f3f-47f1-a479-22b177891b89`, Ray
   `a36f163df8484649`, at 2026-09-06 17:10:30 UTC correlated with Durable Object
   `/broadcast` request `bbf04ae53119c11bb974c95a1a42df24` and an internal storage
   reset. The booking request wrote 28 rows; no missing-table/column error was
   present. The canonical publisher now logs fetch failures and HTTP 5xx without
   turning committed mutations into failures. Binding lookup, serialization,
   HTTP 4xx and D1 errors remain exposed. There is no retry, second publisher,
   outbox or compatibility path. Dashboard reconnect/manual refresh already
   reloads authoritative HTTP state.

## Additional confirmed bug

The user's expanded bug-fix instruction includes the previously reported Pottery
review-card overflow. The compact footer now wraps and bounds the complete
location label to the card. The original deployed page expanded a 390px viewport
to 445px. Against the rebuilt Worker, all three beachfront labels fit their
footer at 1280px and 390px; document width equals the viewport. The complete
  location remains visible, wrapping to two lines on mobile.

## Correction verification

- Pinned Node 24.18.1 / Yarn 4.18.0 production build and full quality chain pass.
- All 16 real D1 integration tests pass, including a retained real Miniflare
  Durable Object fault test. Healthy publication delivers the exact payload;
  actual storage reset, thrown transport failure and HTTP 503 remain nonfatal.
  HTTP 403, missing binding and a real D1 missing-table query reject. The same
  storage-reset assertion fails against the original publisher from `67828d06`.
- All seven affected local Chromium tests pass in 17.1 seconds against the final
  production build: Kikuzuki localization, both provider ingress tests, booking,
  reservation, contact and destructive cancellation validation. No retries or
  assertion removals were used. Booking returns 201, persists and creates the
  expected log-only owner/guest dispatches.
- Direct Codex browser inspection of the rebuilt Pottery page passes at 1280px
  and 390px. Native scrollbars leave client/scroll widths of 1265/1265 and
  375/375 respectively; all three complete location labels fit their footers.
  The temporary read-only local tenant-header proxy was stopped afterward.
- Codex browser completed a preview Pottery booking on the original deployed
  candidate and saw the received/confirmation page. This establishes the
  original failure was intermittent; it does not qualify the correction's
  deployment. Exact corrected-head CI and deployed-preview verification remain
  pending until the consolidated correction push.
- Independent reviewer `comment_review` approved correction candidate
  `41bc003540fdb50a58f15354092538ffc5aae7e3` across all eight changed files, with
  no remaining implementation blocker. The final evidence additions change
  only this report; the reviewed and built application/test sources are fixed.
  Exact-head remote CI and preview verification still gate PR-ready handoff.

Raw CI logs, observability exports, fault-test before/after logs, screenshots and
phase reports remain under the private local `krabiclaw-829-private` directory.
No credentials or customer exports are included in these audit artifacts.
