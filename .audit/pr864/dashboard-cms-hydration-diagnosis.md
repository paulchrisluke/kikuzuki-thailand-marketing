# Dashboard CMS reload diagnosis

The preserved CMS trace on build `17ef7490` completed Markdown edit, save, reload and restoration, then failed its strict console gate. Both reload responses rendered the location navigation without its destination and with the generic Locations label. The client expected the site-specific office/service-area label and destination. The same responses serialized a populated dashboard context, so the data existed by payload emission.

The built server contained two Vue implementations. Nuxt's useState and payload state imported Vue 3.5.41; the dashboard's computed values imported Vue 3.5.42. The layout reads its empty context before awaiting the existing refresh. A computed from one implementation cannot track reactive state from the other. A fresh child computed created after loading can read the populated state, explaining the valid editor alongside stale server navigation.

An installed-runtime probe reproduced this directly, with no application mocks: Nuxt reactive state changed from null to an object, but the application computed remained null. After canonical Yarn deduplication, both consumers resolve Vue 3.5.42 and the same probe updates correctly. Evidence is retained in dashboard-reactivity-diagnosis.json and dashboard-reactivity-dedupe-pass.json. The lockfile removes duplicate Vue runtime/compiler families; no layout loading workaround was added.

The aborted session request had a separate application cause. Better Auth's admin client declares session-signal invalidation for impersonate-user and stop-impersonating. Its proxy schedules that signal after success; the session refresh manager invokes its fetch, whose session atom aborts any previous fetch. Our callers also invoked refreshSession immediately after the admin response. In the trace, one get-session request at monotonic 2542 was aborted when the next started at 2552 and completed successfully 22ms later.

The four admin entry/exit callers now wait for the SDK's session state to match the session ID returned by the successful operation. The observer in useAuth does not fetch, write state or alter cookies. It resolves immediately for an already matched session, rejects SDK errors, and rejects after 15 seconds if the state never converges. It removes its watcher and timer when settled. Existing explicit refreshSession callers outside these operations remain unchanged.

The deduplication check and installed-runtime probe pass. Actual rebuilt CMS reload and strict network/console verification remain required; root owns that browser run.
