# Final publication HTTP verification

The complete request-only matrix passed on local built Worker `dad9de8a-b5e8-40ea-9204-0e22b7f89f38`. The build identity was verified before and after the run. `publication-http-proof.json` contains 119 sanitized records, no recorded failures, and no credentials or signed URLs.

Saya/Pottery House, Blawby/NCLS, and platform scopes all passed draft defaults and null publication timestamps; signed API and HTML preview reads; private/no-store, noindex and no-referrer response headers; missing, invalid, expired, wrong-entity and cross-tenant token denial; draft listing and public exclusion; valid and contradictory scheduling inputs; explicit published/scheduled creation; publication transitions; stale-edit rejection; published reschedule rejection; and published unlisted direct access with discovery omission and preserved first-publication history. The NCLS document adapter was also exercised directly.

All 12 uniquely created canaries were deleted through their explicit canonical API IDs. Each deletion returned 200 and each subsequent authenticated read returned 404. The Better Auth proof session signed out successfully.

This is actual HTTP/SSR evidence, not client-navigation or remote deployment qualification. Local sitemap XML is excluded from this proof; the public list endpoints and reviewed sitemap predicates are separate evidence. Production-host sitemap and authenticated deployed qualification remain release gates.

Two root causes were fixed before this result: platform scope provisioning now includes its required English source locale and the request resolver recognizes incomplete locale setup; final-response SEO policy now runs after Nuxt robots middleware so its HTML headers cannot be overwritten. Earlier failed runs and their cleanup evidence remain preserved under explicitly named historical artifacts.

## Superseding client and route evidence

The later client-navigation matrix passed three of three cases on built Worker
`dad9de8a-b5e8-40ea-9204-0e22b7f89f38`. Saya, Blawby, and platform drafts
rendered through their signed URLs. Replacing each valid token with an invalid
one returned 404, removed the draft body without a document navigation, and
produced no uncaught error. Every exact-ID canary was deleted, absence was
verified, and each session signed out. This closes the client-navigation limit
named above for the local build; it does not qualify a deployed preview.

Full-route evidence is composite. The original 544-case sweep on `dad9de8a`
passed 533 cases with zero retries and exposed eight review-submit hydration
cases plus three third-party media classifications. After the review-submit
source correction and bounded diagnostic changes, all 12 affected desktop and
narrow cases passed on `f1893229-472f-4b19-9edc-2524bc872a36`, also with zero
retries. This does not claim that a single 544-case sweep passed on the later
build. Two separate NCLS playback cases on `f1893229` proved decoded video
advanced beyond one second at both widths while preserving the exact reviewed
YouTube GPU warnings in evidence.

The fresh canonical-fixture retained suite then passed 90 of 91 Chromium cases
on `f1893229`, with one HTTPS-only `private_key_jwt` skip, zero failures, and
zero retries from 06:25:22 through 06:27:31 UTC. Build identity matched before
and after. Production deployment, the HTTPS-only case, and deployed browser/MCP
qualification remain release gates.
