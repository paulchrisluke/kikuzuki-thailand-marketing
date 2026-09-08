# Final tracked-diff review and comment refresh

Reviewed the current uncommitted tracked batch over pushed head 64d5ab164455b40fb52529d8673f32ce5d7e7afd, including the later platform-media, public blog listing, and retained MCP E2E changes. This is a source-review verdict, not a replacement for root's running combined validation.

Verdict: no concrete additional missing owner-requested source change or blocking defect was demonstrated.

The new `ensurePlatformMediaScope` edit provisions the required English source locale in the same D1 batch as the canonical platform site. It uses the existing platform IDs and existing site_locales schema. Better Auth organization creation remains through its adapter. The uniqueness conflict is idempotent and does not choose an alternate tenant/locale or manufacture fallback content. The schema requires an English row to be the published source, so retaining an existing matching locale row does not silently preserve an invalid English-source configuration. This fixes creation of the canonical platform scope rather than patching an article after failure.

The public tenant blog collection now explicitly selects article roots. This is necessary because social posts now also carry public visibility; the old status/site/visibility predicate would admit those newly valid social rows into the article feed. The corrected predicate excludes representations and other content kinds while retaining the existing publication and visibility checks. No parallel listing path or fallback was added.

The retained MCP social test now proves draft creation, null publication time/public URL, unauthenticated 404 before publication, explicit publication, public media persistence, and idempotent repeat publishing. The old immediate-publication assertion conflicted with the owner-approved lifecycle. Existing rejection of clearing a schedule and the article draft preview assertions match the changed contract. This is expectation alignment against real API behavior, not a source-text test or an ignored failure.

The earlier publication source review remains applicable: three canonical signed article reads, token propagation and cache isolation, public/unlisted filtering, explicit draft transitions, generated schema/transfer declarations, and the requested type unions. No new image slash-menu/editor implementation was added across the #868 ownership boundary. Previously named inseparable preview adapters and the independently diagnosed header hydration fix remain visible in the diff.

## Ready-time refresh

Run from the repository root immediately before deciding whether the completed batch can become Ready:

```powershell
& '.tmp/node-v24.18.1-win-x64/node.exe' .audit/pr864/refresh-comment-audit.mjs
```

The script reads all pages from issue comments, review comments and reviews concurrently through GitHub's API. It hashes exact current bodies and compares IDs, hashes and updated/submitted timestamps with `current-comment-index.json`. It detects additions, removals and body edits, including edits that retain the same timestamp. It writes a timestamped complete snapshot and comparison without overwriting the reviewed baseline or changing GitHub state.

Exit 0 means no comment changes against that baseline. Exit 2 means any change requires inspection. Other failures mean the refresh did not complete. A changed comment is not automatically a code defect, but the script never silently waives it. After reviewing a changed snapshot, root can supply that explicitly reviewed snapshot path as the optional first argument for a later comparison. Neither exit code marks the PR Ready or waives runtime/release gates.

The script's syntax check passed. A real read-only execution at 2026-09-08T05:11:51.447Z returned exit 0 with 15 issue comments, 7 inline comments, 5 reviews, and no additions, removals, timestamp changes or body edits. Evidence is `comment-refresh-2026-09-08T05-11-51-447Z-diff.json`. This timestamp does not replace the final refresh immediately before Ready.

No source changes, GitHub writes, browser tabs, worker starts, retries or CI actions were performed in this review.

## Platform scope completeness follow-up

Inspected the later `server/middleware/tenant-resolution.ts` diff. The existing platform scope query now reads whether the same platform site owns its required published English source locale. Its existing initializer runs when that canonical record is absent, then reloads and requires the complete scope. This makes the earlier `ensurePlatformMediaScope` locale provisioning reachable for an already initialized site with a name and logo. It does not select a different site, infer a locale from tenant content, or treat absence as successful empty data. Better Auth identity ownership remains unchanged. No blocking defect was demonstrated in this bounded source review; actual platform create now has independent HTTP evidence, while the client-navigation run is still underway.

## Client error lifecycle ownership exceptions

The signed article preview client proof subsequently demonstrated that a Blawby invalid-token refetch correctly returned 404 but left the previous draft body rendered because its document consumers crashed after async-data cleared. The minimal `useBlawbyDocument` change propagates subsequent errors through the existing Nuxt global error boundary, synchronously and within the captured app context. It preserves initial validation, the canonical token-inclusive key, and the one server document source. This is inseparable from completing the owner's signed article preview request; it adds no editor UI, alternate content, or nullable shell fallback. The complete Saya/Blawby/platform client preview run passed on build `dad9de8a-b5e8-40ea-9204-0e22b7f89f38`, with invalid-token denial, removed bodies, clean error handling, and canonical canary cleanup (`article-preview-browser-proof.json`).

The full route qualification then exposed a pre-existing review-submit SSR hydration error. Its page-local error ref was mutated only inside the server async-data handler; hydration reset that ref and incorrectly displayed the form. The scoped correction derives the existing unavailable-link panel from Nuxt's serialized async-data error, removes the handler side effect, sends the token string rather than its computed wrapper, and keys validation by that token. This page edit is a direct qualification blocker exception, not work on #868's editor or image slash menu. No review submission, media behavior, styling, tenant content, or alternate source was introduced. Scoped ESLint passed; runtime verification awaits the rebuilt page. The exact preceding failure and eight-case follow-up plan are retained in `review-submit-hydration-diagnosis.md` and `review-submit-follow-up-plan.md`.

## Superseding final verdict

The rebuilt review-submit matrix passed all eight affected routes. The complete
12-case follow-up also passed both Kikuzuki home widths and both NCLS home widths
on build `f1893229-472f-4b19-9edc-2524bc872a36`, with no retries. Separate NCLS
desktop and narrow diagnostics proved decoded YouTube playback advanced beyond
one second while retaining the reviewed GPU warnings. The final canonical-fixture
retained Chromium run passed 90 cases with one HTTPS-only skip and no failures or
retries on the same build; identity matched before and after.

The 544-route result remains accurately composite: the original complete sweep
on `dad9de8a` supplied 533 passes, and the later 12-case run closed every affected
case. It is not evidence of a single later 544-case sweep.

Authenticated HTTP/SSR passed 119 records on `dad9de8a`; signed client navigation
passed all three scopes on `dad9de8a`, including valid-to-invalid token changes
that removed the draft body. The fresh publication-state staging D1 candidate
`a19e76f9-44d2-45aa-9e94-eccbcfb1452e` passed exact 52-table, 2,816-row remote
parity, foreign keys, integrity, and nine invariants. Cross-model review of that
database evidence passed with the explicit limitation that no staging Worker is
deployed.

The 06:27:08 UTC refresh found no change across the same 27 comments and reviews.
No additional owner-requested source change or pre-review local blocker is
demonstrated. Exact-candidate preview and the documented staging/production
release sequence remain separate gates.
