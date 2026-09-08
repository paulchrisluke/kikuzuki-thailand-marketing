Case 85, Kikuzuki desktop home: the existing strict classifier rejected an initial video range cancellation before its replacement response arrived.

- Initial bytes=0- response: 206, bytes 0-3107470/3107471, started 2026-09-08T05:45:01.970Z.
- Initial cancellation: 05:45:02.973Z.
- Replacement bytes=65536- request: started 05:45:02.983Z; still pending with no response headers at the assertion.
- The classifier recorded no playback observations: it exited before video sampling because the exact replacement 206 had not arrived.
- Therefore this failed case does not prove playback failure or healthy playback.

Proposed patch waits at most ten seconds for the same already-required exact replacement response, then executes unchanged same-element readiness, media-error, opacity, unpaused, dimensions, and currentTime advancement checks. No request failure is suppressed by waiting. HTTP errors, missing replacement responses, and unhealthy playback remain failures. The running audit sources are unchanged; apply only after the immutable sweep finishes and run the failed hero case again.

Evidence: kikuzuki-desktop-case85-media-diagnosis.json. Proposed patch: kikuzuki-range-response-wait-proposed.patch.
