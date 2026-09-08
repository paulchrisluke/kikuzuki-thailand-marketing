# NCLS sequential route budget

The independent preview representative run at `64d5ab16` passed 12 cases and exhausted the final NCLS test's shared 30-second budget at 03:53:07 UTC on 2026-09-08. Switching six parallel pages to sequential navigation preserved local assertions and the user's tab limit, but coupled six remote navigations to one timeout. The local corrected desktop case took 8.8 seconds; the remote run took more than 30 seconds in total.

Completed stages were home (4.7 seconds), pricing (5.8), article (6.7), contact (5.6), schedule (4.0) and blog (3.4). All completed document requests and assertions passed. The trace contains no donation request. The next helper call reached `page.addInitScript` after the test-wide deadline. No server failure or asset failure was demonstrated by this timeout.

Cloudflare Observability confirms the last blog request, Ray `a37b0105fbac6d27`, application request `cb20d78d-4e71-485b-8f59-8eefc38b3f5d`, completed at 03:53:06.524 UTC. It returned 200 in 2,758 milliseconds, read 31 D1 rows, wrote zero rows and recorded no error code. The Worker outcome was `ok`. Private raw records remain in `.tmp/pr864-observability-matching-private.json`; representative trace evidence remains in `.tmp/pr864-final-representative-results/`.

The correction separates responsive header/footer checks and the six route checks into seven cases. Each route keeps its original desktop viewport, response assertion, strict warning/error collection, 250-millisecond observation window and content regex. The existing 30-second timeout and zero retries remain. The group uses Playwright `mode: 'default'` so cases run sequentially without cascading skips after a failed case; qualification commands use one worker across the whole run.

Independent design review accepted this structure. Focused lint and discovery pass with seven cases. Runtime validation of the corrected cases is pending the browser slot. This diagnosis does not resolve the separately discovered location hydration failures.
