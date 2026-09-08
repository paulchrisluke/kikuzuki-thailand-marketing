# Review request hydration mismatch

Observed during the complete route qualification on build `dad9de8a-b5e8-40ea-9204-0e22b7f89f38`. Pottery desktop `/locations/klong-muang-beach/review-submit` reported a Vue hydration mismatch: the server rendered an error panel while the client expected a form. The private failure snapshot confirmed the form was visible with no request location or business content. The `/locations/krabi/review-submit` route also produced a failure directory.

A separate anonymous HTTP GET with the canonical `x-preview-tenant: pottery-house` header returned 200, included “This review link is not available”, and did not include “How was your visit?”. This reproduces the server side without a browser or any review mutation.

The page was unchanged in the current working diff before this correction; its preceding Git change was `37e88e15`. It is a pre-existing application failure directly blocking the requested complete route qualification, not a selector or timing error in the audit.

The validation handler assigned a local `loadError` ref when its server request failed. Nuxt serialized the async-data error, but hydration initialized the separate ref to an empty string and did not rerun the handler. The client therefore chose the form branch. The canonical correction removes that side effect and derives the visible error state from the serialized async-data error. The existing generic unavailable-link copy is retained as the explicit denial message; no substitute request data is introduced.

The same request previously passed a computed ref object as its token query value. The request now passes the token string, and its reactive async-data key includes that token so separate review links cannot reuse another link's validation result. Other review form behavior is unchanged.

Scoped ESLint passed. Runtime qualification of the correction awaits a rebuilt Worker; the ongoing full route run remains on the original immutable build. The required follow-up is both Pottery review-submit routes at desktop/mobile, confirming the no-token error panel remains stable through hydration with no form and no console mismatch. A valid review token workflow must use a canonical issued request, since successful validation marks the request clicked; no fabricated token, direct database write, or review submission was performed for this diagnosis.
