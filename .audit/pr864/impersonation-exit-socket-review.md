# Impersonation exit socket lifecycle

The real CMS test on build 81b26fb7 completed its content restoration and actual Exit to Admin workflow. Its strict console gate caught an authenticated tenant WebSocket starting during the identity transition.

Preserved trace timings establish the order: stop-impersonating at 6053.493 returned 200; a tenant socket handshake began at 6087.146; authentication failed at 6161.813; the SDK's session read at 6173.567 returned 200. Earlier tenant socket handshakes returned 101. Sanitized observations are retained in impersonation-exit-socket-diagnosis.json.

The dashboard's realtime provider owns the socket and its reconnect timers. Its existing nullable organization scope resets and closes them, but the layout previously kept that scope active until navigation, while waiting for the SDK session to change. The old tenant route therefore remained eligible to connect after the authentication cookie changed.

The layout now sets that existing scope to null while stoppingImpersonation is true. The provider's existing scope watcher flushes synchronously, closing the socket and clearing reconnect/health timers before the SDK operation starts. Navigation or the existing failure path determines the next route scope. No authentication bypass, secondary socket owner, lifecycle API or warning exemption was added.

Actual rebuilt Exit to Admin verification remains the runtime gate. Root owns that browser run.

The follow-up instrumentation on build ab22e07e-d138-4e94-bac3-30a36031bef1 distinguished three explicit scope-reset closures from browser reload teardown. An initial connection was closed after 11.4ms; a connection started after successful impersonation exit was closed after 0.2ms. Both observed intermediate values from Nuxt's deferred page-route state under the synchronous watcher. The middle closure canceled a CONNECTING socket before authentication changed, which is the required security ordering.

Realtime scope now reads the router's committed currentRoute atomically, while page rendering continues using Nuxt's deferred useRoute. The stopping flag still clears the socket scope synchronously before the SDK operation. No handshake is allowed to remain open merely to avoid a cancellation warning.

The normal CMS proof now waits for the current document's observed socket OPEN event before exercising Exit and checks that no tenant socket is created after the stop request starts. Its strict console/network gate remains unchanged. The failed lifecycle observations are preserved in cms-socket-lifecycle-failed-ab22e07e.json.

Final build bb52bb9e-51b2-4843-be1d-561ece4ad3a4 passed the normal CMS journey with no console or network exemption. Exactly three sockets opened across the initial page and two reloads. The real Exit control closed the open socket before the stop request and created none afterward. The complete block-data restoration hash matched.

Separate rapid pointer and keyboard exits passed on the same build. The pointer exit closed an open connection without warnings. The keyboard exit closed the still-CONNECTING socket at 1788856159908, before the stop request at 1788856159910.222. It never opened, and no replacement connection started. The one native cancellation warning was paired with that exact pre-authentication close; unknown warnings and request failures remained blocking. See residue-cms-browser-proof.json, fast-impersonation-exit-pointer.json and fast-impersonation-exit.json.
