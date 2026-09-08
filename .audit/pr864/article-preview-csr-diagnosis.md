# Article preview client navigation diagnosis

Local build `9ebaf2ce-a851-430a-8301-6e0063591d03`, 2026-09-08. The public browser stayed anonymous; a separate canonical Better Auth request context created each draft and deleted its explicit ID followed by GET 404 and sign-out. One browser page ran at a time.

The initial probe incorrectly awaited a transient Vue Router promise directly through Playwright evaluate. Playwright reported “Resulting promise was garbage collected” even though its page snapshot contained the draft title and body. The audit now retains the actual router promise and completion/error state on the page, waits for completion, and propagates rejection. It does not replace navigation or alter production code.

Saya passed signed and invalid token client transitions. Platform independently passed both transitions: signed API 200, invalid API 404, draft body removed, no document navigation or uncaught browser errors. Its only denial console message was the expected resource 404.

Blawby failed the invalid-token transition. The canonical document API returned 200 for the valid token and 404 for the invalid token, with zero document navigations. The old draft body remained visible and Vue logged `null.post` and `undefined.shell` dereferences. Sanitized observations and exact-ID cleanup evidence are in `article-preview-blawby-failure-evidence.json`; original failed run reports remain private under `.tmp`.

Nuxt's reactive async-data key already includes the token. Its error path assigns the error, then clears data. `useBlawbyDocument` only checked errors during initial setup, so a later denial reached consumers that require a valid document. The canonical composable now watches its error synchronously and calls Nuxt `showError` through the captured app context. This propagates the explicit denial before absent data is rendered. Initial setup validation remains intact, with no substitute content or nullable shell model.

Scoped ESLint passed. The complete three-case run passed on rebuilt Worker `dad9de8a-b5e8-40ea-9204-0e22b7f89f38` at 05:41 UTC in 10.7 seconds. All three scopes rendered draft content through a signed client fetch, denied invalid-token reads with 404, and removed the draft body. Each recorded zero document navigations, no uncaught errors, and only the expected resource 404 console message during denial. All exact-ID deletions returned 200 and subsequent reads returned 404; all request sessions signed out. The browser closed. Sanitized final evidence is `article-preview-browser-proof.json`.
