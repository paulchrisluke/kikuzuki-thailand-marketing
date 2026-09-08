# Controlled Kikuzuki hero cancellation classification

The two controlled local probes establish that the reported cancellation occurs during a successful replacement of the initial media range. Neither probe failed decoding, visibility, or playback. Both failed only the generic network-failure assertion at the end.

| Evidence | Desktop | Narrow |
| --- | --- | --- |
| Initial 206, bytes 0–3107470 of 3107471 | 04:41:44.050 UTC | 04:41:48.492 UTC |
| Initial bytes=0- request aborted | 04:41:44.251 UTC | 04:41:48.692 UTC |
| Replacement 206, bytes 65536–3107470 of 3107471 | 04:41:44.739 UTC | 04:41:49.205 UTC |
| State after abort | readyState 4, 1280×720, no error, playing | readyState 4, 1280×720, no error, playing |
| Measured playback advancement | 0 to 0.546271 seconds | 0 to 0.211697 seconds |
| Final opacity | 1 | 1 |

The same element retained the exact reported `441c05bf-99be-430c-8092-004a23c8d609.mp4` source. The first state timestamps, 04:41:44.621 and 04:41:49.008, are already after their corresponding abort. The later playback attachment records advancement. The readiness assertion also explicitly required `element.error === null`, although JSON omits its undefined error code field.

This is a successful media-range cancellation, not evidence of a failed user-visible video. The exact Chromium internal reason for switching ranges is not recorded, so this report does not claim a specific decoder implementation. The original deployed trace still requires its own same-build playback evidence before being declared qualified.

## Precise artifact rule

Classify an abort as a verified range replacement only when every condition holds:

1. The request belongs to the exact selected hero video's currentSrc. It is a media GET with `net::ERR_ABORTED` and the captured initial `Range: bytes=0-`.
2. That request already received a 206 whose Content-Range starts at zero and supplies the total byte count.
3. The same source subsequently receives a 206 for `Range: bytes=65536-`, with Content-Range beginning at 65536 and ending at the same total minus one. This is the exact observed replacement, not a generic media success.
4. After the abort, the same video remains connected, has no media error, is unpaused, has decoded dimensions, and has readyState at least 2. Its currentTime increases across two measurements after the abort, and opacity reaches 1.
5. Preserve the aborted request, both response ranges, timestamps, and post-abort state in the evidence attachment. Mark that one event as a verified replacement. Do not discard it.
6. Keep every unmatched request failure as a failure, including another abort for the same URL. Match events by request identity where available. If the generic error list has strings only, consume exactly one occurrence per independently verified cancellation and require counts to agree.

Do not alter the shared strict collector to ignore media or ERR_ABORTED. Apply this classification only in the focused video probe after its positive playback checks pass. The broad route sweep must retain its original cancellation result until a same-build focused proof qualifies it.

Source evidence is `hero-video-controlled-evidence.json`, extracted from the retained JSON report. Original logs and traces remain under `qualification-fix-hero-video.log` and `.tmp/pr864-qualification-fix-hero-video-results`. No source edit, browser navigation, or retry was performed during this diagnosis.

## Implemented artifact rule and limits

`expanded-route-support.ts` now collects failures by Playwright Request identity and returns an awaited final assertion. The active expanded and focused artifacts both call it. The original 64d5ab16 sweep artifacts remain unchanged. The previous shared support is preserved in `expanded-route-support-before-range-classification.txt`.

The classifier checks only the exact known Kikuzuki home MP4. It requires the initial request's captured 206 before its abort, a different request's resumed 206 after that abort with the observed byte offset and matching end/total, then two healthy samples from the same ElementHandle 250 ms apart. Both samples must be after the abort, connected, on the exact currentSrc, decoded, unpaused, error-free and fully opaque. Time must increase. A removed or replaced element cannot qualify. Every other failed Request stays in the assertion, even one for the same asset URL. Console warnings/errors and HTTP failures remain unchanged.

Every finalization attaches `strict-network-observations` with all failed requests, their classification, and positive evidence for classified cancellations. A passing route can contain a recorded verified cancellation; it must not be described as having zero network events.

Limits reviewed: this proves playback continues after the observed initial-range cancellation, not uninterrupted playback for the entire file. A later stall, different range strategy, changed asset URL, duplicate video, replaced element, unsupported response headers, zero-opacity video, paused video, or resumed-range abort remains a failure. A future Chromium change may require a new evidence-based classification; this implementation deliberately does not infer one.

Focused lint passed for the three edited audit files, and Playwright discovered all 15 focused cases without opening a browser. Root must independently review and run the artifact before runtime success is claimed.
