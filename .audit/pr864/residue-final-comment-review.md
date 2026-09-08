# Comment Sicko review

Scope: tracked working diff against `245f1f2be51a1cd75b8fc588cedee25281fb5199`, after the transfer root-depth correction and seed residue edits settled, plus `schedule-guidance-cms.spec.ts` and `schedule-guidance-cms.config.ts` in this directory.

- Touched files: this report only. No application or test files edited.
- Comment deletions: 0. No added narration, banners, commented-out code, or workaround explanations found.
- Suppressions: 0 added. No added `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or equivalent suppression found.
- `MUST KILL` flags: none.
- Skips: tenant content strings containing URLs are data, not comments; unchanged comments outside the diff were not reviewed. Superseded restoration proposals and unrelated untracked files were outside scope. Generated baseline files had no content diff against the reviewed HEAD.

Reviewed production and transfer files: the five changed Blawby components, `pages/article/[slug].vue`, `scripts/epoch6-data.mjs`, both changed seed definitions, `server/utils/public-tenant-pages.ts`, and `utils/tenant-page-blocks.ts`. Also reviewed `tests/integration/epoch6-data.test.mjs` and both explicitly scoped CMS verification files. This review covers comments and suppressions only; it does not claim functional validation.

## Dashboard follow-up

Added scope: `yarn.lock`, `composables/useAuth.ts`, `layouts/dashboard.vue`, and `pages/admin/index.vue`, `clients.vue`, and `users.vue`, with the explanation in `dashboard-cms-hydration-diagnosis.md`.

Comment deletions remain 0; no added suppressions or `MUST KILL` flags. No concrete deslop or correctness finding in this added scope. No source edits were made.

The additional correctness inspection followed the installed Better Auth Vue store and session atom. The store replaces its shallow ref when the SDK updates, so `watch(session)` observes those changes. The already-matched session ID returns before allocating resources. Watch registration is not immediate and has no asynchronous gap before timeout assignment, so the callback cannot run against uninitialized `stop` or `timeout` bindings on this path. Subsequent matching state resolves; SDK errors reject; both stop the watcher and clear the timer. Timeout stops the watcher and rejects. The four callers retain their existing failure handling and wait before navigation without issuing a competing session fetch. The lockfile consolidates the Vue runtime/compiler family at 3.5.42 within the existing dependency ranges.

This inspection does not replace the rebuilt CMS save/reload/restoration run or its strict console/network gate. Root owns that verification.

## WebSocket exit follow-up

Reviewed the two-line follow-up in `layouts/dashboard.vue` and `composables/useDashboardInvalidations.ts` against `stopImpersonating`, `resetConnection`, the reconnect/heartbeat timers, socket callbacks, and unmount cleanup. No added comments or suppressions; no deletions, `MUST KILL` flags, or concrete deslop/correctness finding. No source edits.

Setting the existing `stoppingImpersonation` state now makes the declared realtime organization null. The synchronous watcher runs the existing reset before the admin request starts: it clears both timers, detaches the active socket, closes it, and clears event state. The detached socket's close callback cannot schedule a reconnect because its identity no longer matches. Manual, online, and timer-driven connection paths also require a non-null organization. The existing `finally` restores eligibility when the exit operation ends; a remaining dashboard can reconnect through the same reset path, while a completed route change has no organization and unmount stops the connection. No parallel socket lifecycle was introduced.

The rebuilt browser's impersonation-exit and strict console/network result remains required to validate the observed failure is fixed.

## Final router identity correction

Reviewed the final `layouts/dashboard.vue` change to derive only realtime organization identity from `router.currentRoute.value.params.orgSlug`, leaving the existing Nuxt `useRoute()` consumers intact. No added comments, suppressions, or concrete correctness finding; no source edits.

The installed Nuxt router plugin uses memory history on the server, pushes the initial request URL, and awaits router readiness before rendering. Reading its current route here does not access browser-only state, and the invalidation provider still opens sockets only on the client. Nuxt's injected page route can retain the outgoing page while the router has already completed navigation. The current router ref therefore supplies the relevant completed navigation identity for this connection lifecycle. After successful navigation to `/admin/users`, clearing `stoppingImpersonation` cannot restore the outgoing tenant slug through that delayed page route. If navigation remains on the dashboard, clearing the flag resumes the existing connection path for the actual current route.

The normal and rapid impersonation-exit browser cases remain the final runtime gate; this verdict is a scoped source and installed-framework inspection.
