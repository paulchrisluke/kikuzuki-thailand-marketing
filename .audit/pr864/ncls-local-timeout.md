# NCLS local detail-route timeout evidence

## Scope

This note records the read-only diagnosis of the Chromium timeout for `North Carolina Legal Services renders home and detail routes on desktop` in the final local browser run. It uses `.audit/pr864/retirement-browser-final.log`, `.tmp/pr864-worker-final.log`, and `test-results/tenant-rendering-North-Car-73616-nd-detail-routes-on-desktop-chromium/trace.zip`. Cookies and request headers are intentionally omitted.

No browser retry or source/runtime change was performed during this diagnosis.

## Correlated timeline

- The test started its detail navigation at `2026-09-08T00:27:20.324Z` with `page.goto("http://localhost:3107/services/family", { waitUntil: "load" })`. The call remained open for 28,034 ms until the test's overall 30-second budget expired.
- The Playwright network trace contains the detail document response: HTTP 200, `text/html;charset=utf-8`, 345,586 bytes, and 135.1 ms total (`wait` 123.37 ms; `receive` 11.73 ms).
- The matching Worker entry is request ID `36e7b68a-1978-4124-9c8d-fa1e2594803c`: D1 8 ms, Worker total 117 ms, 345,586 response bytes, status 200, and no error code. Wrangler separately logged `GET /services/family 200 OK (122ms)`. There is no matching Worker exception.
- The failure snapshot contains the rendered NCLS page shell and Family law detail content, including navigation, service media, description, features, testimonials, FAQs, and related services. The document therefore reached and rendered in Chromium before the timeout.
- All traced localhost resources requested after the detail document completed successfully: 151 preload/other resources, 58 scripts, three fonts, two fetches, and one stylesheet. The last recorded localhost completion was around `2026-09-08T00:27:21.763Z`.
- Sixteen detail-page image requests to `https://media.krabiclaw.com` started at `2026-09-08T00:27:20.482Z` through `00:27:20.566Z` but had no response when the context was torn down. Playwright records each with `status: -1`, `time: -1`, no response timing, and no failure text. Exact examples are:
  - `https://media.krabiclaw.com/sites/site-ncls-blawby/media/imports/c48b4d590eecc120f76e.svg`, the site logo rendered as an eager image.
  - `https://media.krabiclaw.com/sites/site-ncls-blawby/media/imports/e5c69cf788b3fd2728e3.webp`, used by the selected service media with `fetchpriority="high"`.
- The trace contains no browser console error or page error. Its only errors are the test timeout and the resulting `page.goto` timeout.

## Finding

The evidence rules out a stalled application document and Worker/D1 latency for this occurrence. The only observed unfinished requests are the 16 external media images, including an eager logo and a high-priority service image, so they are the evidence-backed candidate for preventing the browser `load` event. The trace does not isolate one image as the sole blocker and does not establish why the media origin failed to respond; CDN/network root cause remains unresolved pending a separate direct probe or clean-fixture rerun.

This timeout is separate from the Thai CMS 409 in the same suite. That failure followed a rerun against fixtures mutated by the earlier test pass and is addressed by canonical setup before the next fresh suite; no assertion or navigation timeout was weakened.

## Follow-up result

After this diagnosis, a direct HEAD request to the exact logo SVG returned HTTP 200 in 1.007647 seconds, with CF-Ray a379e08f7cd46e36-OMA. Canonical local setup refreshed the curated fixtures, then the unchanged browser suite passed 72 cases with one HTTPS-only skip. Evidence is ncls-media-probe.log and retirement-browser-clean.log. The original trace was inspected before the rerun but was not copied out of Playwright's replaceable test-results directory. This sanitized note and the Worker/test logs preserve the findings. The clean result does not establish the earlier media network cause.
