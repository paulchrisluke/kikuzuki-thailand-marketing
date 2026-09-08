# PR 864 publication batch completion

Recorded September 8, 2026 after the final combined local run. This record supersedes earlier local-completion claims that omitted the edited publication request. It covers the implementation committed with this file over `64d5ab164455b40fb52529d8673f32ce5d7e7afd`. Deployed qualification and production cutover are separate, still-open release gates.

Every current owner implementation request is accounted for in [publication-comment-audit.md](publication-comment-audit.md), including the publication and ownership comments missed by the earlier audit. All 15 issue comments, seven inline comments and five reviews were retrieved with complete current bodies. The refresh at 06:27:08 UTC found no additions, removals or edits. A further refresh is required immediately before Ready.

The batch implements draft creation, scheduled and permanent published states, independent public/unlisted discovery, and real signed one-hour article previews. Saya, Blawby and platform reads share the canonical authorization and persistence paths. The generated baseline and declared offline transfer admit social visibility and preserve the measured retained data. The earlier timestamp, retirement, Markdown, CMS and nullable notification work remains included in this PR.

The #868 boundary is retained. Its dashboard publishing controls and image slash-menu defect remain with that PR. This batch includes the explicitly requested draft type unions and the preview adapters needed to make returned URLs usable. Runtime qualification also required fixes to shared header hydration, canonical platform source-locale provisioning, final preview response headers, Blawby client error propagation, and review-request error hydration.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Canonical fresh setup, quality and production build | Passed with Node 24.18.1 and Corepack Yarn | Private setup, quality and build logs retained locally |
| Unit, real D1, offline epoch tests | 185, 23 and 16 passed | Local publication test logs; real HMAC/D1 and social lifecycle matrices |
| Final retained Chromium suite | 90 passed, one HTTPS-only skip, zero retries | [publication-retained-browser-proof.json](publication-retained-browser-proof.json) |
| Authenticated HTTP and SSR publication | Three scopes, 119 sanitized records, 12 canaries deleted and absence verified | [publication-http-proof.json](publication-http-proof.json) |
| Signed previews through client navigation | All three scopes passed; invalid tokens denied and prior bodies removed | [article-preview-browser-proof.json](article-preview-browser-proof.json) |
| Expanded routes | 544 cases covered, zero unresolved | [publication-route-coverage.json](publication-route-coverage.json) |
| NCLS embedded video | Desktop and narrow playback advanced by at least one second | [ncls-youtube-playback-classified-pass.json](ncls-youtube-playback-classified-pass.json) |
| Focused header and media checks | 15 passed | [publication-focused-evidence.json](publication-focused-evidence.json) |
| MCP catalog and submission | 96 registered, 95 exposed, two retired tools, 35 changed retained schemas; five positive and three negative cases passed | [publication-contract-diff.json](publication-contract-diff.json) |
| Offline production rehearsal | 52 tables, 42,429 retained rows, 15 social visibility projections, 264 Markdown reclassifications | [publication-rehearsal.md](publication-rehearsal.md) |
| New staging database candidate | 52 initially empty tables; 2,816 imported fixture rows verified by re-export | [publication-staging-summary.json](publication-staging-summary.json) |

The retained suite ran from fresh canonical fixtures on build `f1893229-472f-4b19-9edc-2524bc872a36`, verified before and after. The previous attempt failed fixture setup because a prior full run had left fixed Thai variants. Its state was archived and canonical setup initialized a fresh database. No application row patch, weakened assertion or retry concealed that failure.

Expanded route coverage is composite. The complete sweep on `dad9de8a-b5e8-40ea-9204-0e22b7f89f38` passed 533 of 544 cases. Eight review-request cases exposed the corrected hydration defect. The other three failures required precise observation of a resumed hero-media range request and paired third-party YouTube GPU warnings. All 12 affected and companion cases passed on `f1893229-472f-4b19-9edc-2524bc872a36`. This is not a claim that one later 544-case sweep passed. Actual video playback was separately verified; unknown console warnings and first-party failures remain blocking.

Final cleanup removed three narration-only comment lines. The product-model guard passed afterward. No runtime behavior changed after the final built-browser run. Independent diff and comment reviews found no further demonstrated implementation blocker.

Ready authorizes exact-candidate preview qualification only. Staging Worker deployment, post-start initialization, authenticated deployed checks, the authorized production freeze and fresh export, verified transfer, binding cutover, and post-deployment verification remain required by the canonical release contracts. Local synthetic billing does not prove a paid account. Manual ChatGPT checks remain unverified and the owner handles portal resubmission. Production remains Epoch 5, rollback resources are retained, and #829 stays open.
