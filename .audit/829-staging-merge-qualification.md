# Staging merge qualification

This review integrates staging `3894f251d0f846d7a999bed56f3bcd550295bd2f` into PR #848. It records local qualification, not permission to promote or a substitute for exact-head CI and deployed-preview browser checks.

Staging's explicit Localize dialogs, dirty-draft protection, independent editor request generations, shipped Thai interface catalog and session-aware account navigation are retained. Their owners use the consolidated document/product model. Retired database catalog endpoints, page and billing utilities are removed.

The merge fixes the Experiences marketing parent route that intercepted tenant booking routes, the page editor's incorrect version field, pre-hydration remembered-profile clicks, and client navigation validation against the page being left. Translation source identity is relational for every block type. The canonical writer atomically rejects a source type change while translations still reference it.

The normal Drizzle baseline and actual-source transfer are documented in [the consolidation contract](../docs/database/epoch-5-consolidation.md) and [aggregate transfer evidence](829-transfer-summary.json). All nine existing Thai blocks retain exact authored source identity; ambiguous mappings fail the transfer.

Local validation completed on the combined application:

- Full quality chain and production Worker build passed; schema drift, seed and MCP/submission checks passed.
- 223 unit/integration checks passed. Fifteen migration/source-transfer checks passed after the final projection change. The subsequent source-type integrity regression reproduced the defect and passed against real D1, including rollback and explicit translation deletion.
- Full local Chromium suite: 71 passed, one HTTPS-only CIMD private-key/replay case skipped. Two paid media-upload cases were excluded on the command line; test code was not skipped or weakened.
- Codex browser: normal local developer sign-in and direct post-login redirect, Better Auth tenant impersonation with three Today bookings, English source page editor and Thai mobile menu rendering without overflow.

Testing used disposable local fixtures through `local:setup`. A single normal billing-catalog GET read Stripe products/prices into local cache; its temporary credential-bearing Worker was stopped immediately. Subsequent tests used the isolated Worker with a nonfunctional Stripe key and log-only delivery. No OG/social-card generator was run, and no live provider, staging or production mutation occurred.

Remaining release gates: exact pushed-head CI, deployed-preview Codex browser verification, and the canonical staging/cutover process before any production decision.
