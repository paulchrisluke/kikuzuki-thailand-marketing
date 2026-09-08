# Runtime corrections after c7 preview qualification

All owner source requests remain covered. The 2026-09-08 10:31:56 UTC audit compared all 32 current comments and reviews with the reviewed snapshot and found no changes. Owner comment 5582909193 conditionally authorizes staging and main after qualification. No merge or production cutover has occurred.

The final correction contains seven application files. It preserves client lifecycle registration needed for matching Vue async IDs, excludes WebSocket upgrades from response-header mutation, and normalizes ordinary Durable Object responses at their forwarding boundary. Notes now retain their draft and original revision through background refreshes. The ledger exposes its existing dedupe conflict as a specific error type; the note write maps that error to 409. The note endpoint uses the same canonical error response adapter as reservation changes, so the conflict instruction reaches the user.

The final diff adds no suppression, fabricated data, fallback source, custom migration, or new transport. Independent source, deslop and Comment Sicko reviews found no actionable findings. Build and quality passed after the last endpoint correction.

## Runtime evidence

Evidence is composite and tied to the build that exercised each change. Later changes were limited to the note lifecycle and its error response. No single final-build full-suite result is claimed.

| Build | Result |
| --- | --- |
| Preview c7, Nuxt cc7cfc87-4bc0-48e3-883a-c24f2b714411 | Full expanded public sweep passed 544 of 544 cases with zero retries or skips. All expected screenshots exist. Route inventory and exact asset convergence were verified. |
| Local 584932fb-9c67-4351-98e8-ac4457db5031 | Retained suite passed 90 cases with one HTTPS-only skip. CMS save, reload, exact restoration and Exit to Admin passed. WebSocket 101 and ordinary 426 response proof passed without immutable-header errors. The 22 affected public-route cases passed. |
| Local 35b4d707-23c3-46a9-ba08-bd420150e5be | Existing Today case passed, including one reservation-change request. The strict Today workflow passed baseline, 4x CPU and 8x CPU profiles with zero console warnings, errors or page errors. |
| Local 088ec842-264d-4f65-aec3-2f6062808b68 | Both controlled note cases passed. A real delayed booking response does not erase the draft. A new note persists. A concurrent edit submits the original revision, receives 409 and the exact reload instruction, keeps the unsaved draft and preserves the concurrent backend edit. |

The controlled note probe obtains real backend responses and delays their delivery; it does not fabricate payloads. Its first run proved the new-note wipe on build 584. A separate existing-note setup race was corrected by loading the committed seed and observing the real socket handshake. Original failed artifacts are retained. Later failures exposed the ledger's generic 500 and then the noncanonical error envelope; both were fixed at their owning boundaries before the final pass.

The preview NCLS video played in Chrome with readyState 4, decoded dimensions 640 by 360, no media error, and time advancing from 17.787992 to 29.227954 seconds. The separate headless playback failures remain recorded and their cause is unproven. The third task tab was closed after this check.

## Remaining release evidence

This batch is ready for one push. The new SHA still requires its normal checks and exact-preview qualification. The old CI missing-heading cause is not claimed proven or dismissed as slow. Credentialed deployed CMS, OAuth/MCP and real billing/provider checks still require authorized access. The preview sign-in tab remains pending. Staging initialization and production freeze, fresh export, verified transfer and cutover remain governed by the canonical release contracts. Production remains on Epoch 5 and issue 829 stays open.
