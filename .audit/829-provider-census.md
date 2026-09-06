# Issue 829 provider continuity census

Read-only checks completed on 2026-09-06 using the existing worktree .env credentials. No email, charge, provider metadata, webhook configuration, customer data or auth state was changed. Credentials and raw email content were never written to evidence. Detailed provider IDs and associations are in the private directory outside Git.

## Stripe

The credential is live-mode and `/v1/account` succeeded. Account fingerprint is `cfec2dbd53d69c8a`. Every retrieved customer and subscription reports `livemode=true`.

| Object | Count | Observed ownership |
| --- | ---: | --- |
| Organization customers | 5 | All use `organization_id`; none has `organizationId` or `customerType` |
| Active subscriptions | 3 | All use `organization_id` and `plan`; all match one canonical Better Auth subscription |
| Canceled subscriptions | 1 | Uses `organization_id` and `plan`; no local Better Auth row |
| Historical transfer Checkout | 1 | Expired, unpaid, subscription mode, no subscription created |
| Enabled webhook endpoints | 1 | `https://krabiclaw.com/api/billing/webhook` |

All customer metadata organization IDs match the existing Better Auth Organization identity. Every subscription customer matches that organization's canonical customer. The canceled subscription is historical provider evidence. Do not create active local access for it or delete its paid invoice history. There are no provider subscriptions on the two free organizations.

All four retrieved latest invoices are paid. Three belong to current active subscriptions and one belongs to the canceled subscription. Subscription item quantity is one and billing interval is monthly for each. The historical transfer Checkout has no `client_reference_id` and uses old owner metadata. It cannot be paid now, and its expired provider resource needs no compatibility completion path. Preserve its historical ID/status evidence in the transfer disposition.

The live webhook endpoint is enabled and has no explicit API-version override. All 12 retained local event payloads were rendered as `2025-11-17.clover`, matching the current declared webhook contract. The endpoint enables ten checkout/subscription/invoice events. Its existing ID, event list, status and signing secret must remain unchanged when changing its URL through Stripe's supported update API. The ordinary endpoint update does not expose an `api_version` update field; do not silently invent a version mutation alongside URL normalization. [Stripe endpoint update](https://docs.stripe.com/api/webhook_endpoints/update)

### Dead letters

Nineteen local events are dead-lettered.

- Seventeen have no payload after retention cleanup. Their historical dates span June 22 through August 4. Each provider event retrieval now returns HTTP 404 `resource_missing`. Preserve their event IDs, statuses and reason as historical processing evidence. They cannot honestly be marked replayed, and a bulk requeue would only repeat missing-payload failure.
- Two events from September 4 retain payloads and remain retrievable from Stripe. One `customer.subscription.updated` and one `invoice.paid` failed because old code inserted `organization_billing.id`, a column already removed. Both associate with a present active subscription. The invoice is paid. Their required remedy is the existing signed-event/dead-letter or invoice-replay operator path after fixing the stale writer, preserving dedupe and monotonic ordering. Replay twice in the disposable runtime and compare final payment/access state before owner production replay.

The provider census itself performed no retry, requeue, or replay. Subsequent
qualification replayed one retained invoice event in an isolated local D1 copy,
as recorded below. Production event state remains unchanged.

### Epoch 5 runtime qualification

The generated Epoch 5 baseline and all 42,244 verified production rows were
loaded into isolated local D1. The original verified candidate was kept
immutable. The existing development-auth provisioner added only its local
developer fixture through `--local-dev --user-id user-local-developer
--persist-to <private-directory>`. A copied production Worker build ran on
port 3107 with the same isolated persistence directory. Email, WhatsApp and
Discord delivery were `log_only`; both GA4 configuration values were empty.
The source contained no Facebook/Instagram connection rows.

Read-only Stripe retrieval found three available retained `invoice.paid`
events: two processed and one dead-lettered. All three provider subscriptions
were active and matched retained Better Auth customer identities. Three older
invoice events returned 404 `resource_missing`.

The dead-lettered invoice passed the actual authenticated operator preview and
apply endpoints, then the existing hourly scheduled processor. The event
became processed with attempt count one. Its new paid invoice row contained
the exact period from the retained provider invoice line; organization
`paid_through` matched that period end and access remained Growth. A correctly
signed duplicate of the exact retained payload returned 200 and left the
entire billing-state response unchanged.

Only that event's status, error, dead-letter timestamp and attempt count
changed; its payload and the other 28 event rows were unchanged. The actual D1
foreign-key check returned zero violations. Logical hashes remained identical
for 86 of 94 tables, including all subscriptions, content and media. The eight
changed tables were the expected local auth fixture/session/OAuth resource
registration and billing/event projections. No provider write, charge,
notification delivery or analytics request was performed.

Both processed-invoice repair previews returned 409
`reconciliation_evidence_mismatch`. The actual customers still expose
`organization_id`, without the `organizationId` and `customerType` required by
the canonical reconciliation report. This is the known provider normalization
prerequisite, not evidence of lost database identity. The supported ownership
cutover must also normalize active subscription ownership to `referenceId`
and move the existing webhook URL. No compatibility reader or fabricated
provider metadata was added to make these previews pass.

On the separate fixture Worker, the existing OAuth discovery suite passed
eight tests, including credentialed authorization, PKCE, one-time code
exchange, remembered consent and scoped UserInfo. The public CIMD test also
passed actual refresh exchange, replacement refresh-token rotation,
bearer-only MCP `tools/list`, and rejection of the consumed refresh token with
`invalid_grant`. Rotation and strict replay rejection follow the configured
provider's zero reuse interval. [Better Auth refresh grant](https://better-auth.com/docs/plugins/oauth-provider#refresh-token-grant)
The refresh assertions run before authorization-code replay, because that
replay revokes the code's issued grants. Its private JWT assertion test
explicitly skips HTTP and remains a required HTTPS preview check. Retained
sessions, credentials and OAuth grant columns passed transfer
hash parity; exercising a retained session or refresh token also requires the
original client-held cookie/token. Those credentials were unavailable, so
fresh credentialed OAuth success is not presented as a retained-token replay.

`tests/e2e/provider-ingress.spec.ts` passed both actual Worker tests: signed
Stripe ingress persists one processed event across duplicate delivery and
rejects an invalid signature; a public contact submission becomes an owner-
visible thread, accepts a compact signed email reply once, and rejects an
altered token and wrong-domain address without adding entries. The contact
used the release owner's email with delivery in `log_only` mode. The dev
endpoint reports an altered HMAC as 500 through its existing domain error;
the assertion proves rejection and persistence integrity, not a polished HTTP
error contract. This test does not exercise the external MIME transport.

### Reversible normalization plan

The exact private plan is `829-stripe-normalization-plan.json`. It records expected account, object IDs, current owner metadata, proposed metadata-only request bodies and inverse request bodies. It does not contain credentials. No plan was applied.

1. Immediately before the owner's production cutover, re-read the same live account, all five customers, all four subscriptions and the webhook endpoint. Require unchanged canonical organization/customer associations and resolve any changed object before proceeding.
2. On each existing customer, call `stripe.customers.update(id, {metadata: {organizationId: canonicalOrganizationId, customerType: 'organization', organization_id: ''}})`. This preserves unrelated metadata and unsets only the retired owner key.
3. On each of the three active subscriptions, call `stripe.subscriptions.update(id, {metadata: {referenceId: canonicalOrganizationId, organization_id: ''}})`. Preserve `plan`, prices, items, quantities, periods, discounts, cancellation state and invoices. Do not pass billing or proration parameters. Stripe prohibits metadata changes on canceled subscriptions. Retain the canceled record as immutable provider history. Scope that history using its customer identity matched to the canonical Better Auth Organization customer, rather than reading its old owner metadata as a fallback. Never attempt to reactivate or recreate it. [Canceled subscription contract](https://docs.stripe.com/billing/subscriptions/cancel) [Stripe metadata](https://docs.stripe.com/api/metadata), [subscription update](https://docs.stripe.com/api/subscriptions/update)
4. Re-read all objects and compare every non-owner field to the before snapshot. Run the canonical subscription reconciliation report. Removing old reader keys is safe only after these exact updates and proof pass.
5. Change the existing webhook endpoint URL to `https://krabiclaw.com/api/auth/stripe/webhook` using `stripe.webhookEndpoints.update`. Preserve the endpoint ID, event selection, status and signing secret. Verify the direct Better Auth handler accepts the correct signed event and rejects invalid signatures before deleting `server/api/billing/webhook.post.ts` from the release. Update `shared/stripe-contract.ts`, tests and every webhook URL consumer together. The direct handler already exists on Epoch 4, so URL normalization can precede the new build's deployment within the owner-controlled maintenance procedure.
6. If maintenance aborts, use the recorded inverse metadata and endpoint URL requests only after comparing live state again. This metadata rollback does not alter invoice history or reverse any payment. Coordinate it with the documented database/Worker rollback, not a separate cutover mechanism.

For staging qualification, use the same canonical metadata representation and direct webhook URL in disposable/test provider state. Do not retain runtime dual reads merely because production normalization is scheduled for the owner's later cutover. Production remains on Epoch 4 until then.

## Issued email reply addresses

Resend access succeeds. Exhaustive `GET /emails?limit=100` returned 16 records in one page with `has_more=false`, spanning August 10 through September 6. Seven records carry compact reply addresses, three for contact submissions and four for reservations. All seven report provider last_event=delivered, which establishes delivery status rather than only provider acceptance. All seven source submissions still exist and have status `new`. No old-format address appears in the retained list. No reply token, recipient, subject, body or full address is present in this sanitized report. Private evidence stores provider email ID, timestamps, last event, parsed source association and a hash of the address, not its HMAC.

This is complete evidence for the retained API window only. Resend retains email data for 30 days unless an enterprise retention agreement applies. It cannot establish whether old-format replies were issued in July. The list endpoint exposes `reply_to` directly, so retrieving full bodies was unnecessary. [Sent email list](https://resend.com/docs/api-reference/emails/list-emails), [pagination](https://resend.com/docs/api-reference/pagination), [retention](https://resend.com/docs/dashboard/webhooks/how-to-store-webhooks-data)

### Old engagement checks

Four surviving reservations predate the compact-address source commit. Their service dates are June 28, June 30, July 4 and July 8. All four remain `new`; their `updated_at` equals `created_at`; none has `completed_at`, `completion_source`, a used cancellation token, a sent review request, or a submitted review. Cancellation links expired between July 28 and August 3. One of these reservations was created during the source-commit interval in which the old address builder existed. A surviving July 1 contact also remains `new`.

There is no future booking commitment in those four records, but there is no explicit resolution evidence either. Cancellation token expiry governs cancellation links, not reply addresses. The current guest-thread state machine reopens resolved conversations on an inbound guest email. Therefore neither past service date, expired cancellation link, nor zero present guest threads establishes authority to invalidate a sent reply address.

### Disposition

Current compact addresses must survive the epoch with their submission IDs,
source ownership and EMAIL_REPLY_SECRET intact. The current dev inbound route
now parses the supplied address and invokes the same token-verifying domain
ingress as the Cloudflare email hook. Its signed-address, dedupe and rejection
checks passed as recorded above. An actual inbound MIME delivery through the
provider and Cloudflare hook remains a separate owner-controlled production
transport check.

There is a real evidence limit for retiring the old address contract. Available provider history does not cover issuance and the remaining source records do not prove closure. Do not claim no old address was issued. Do not invent a completion timestamp or arbitrary expiry. The final policy in docs/database/epoch-5-cutover.md retires old reply formats under the owner's explicit no-backwards-compatibility instruction. Preserve these unresolved historical facts; do not represent the policy decision as proof that the old engagements completed.

## Private evidence files

All are under `%TEMP%/krabiclaw-829-private` and must remain outside Git.

- `829-stripe-provider.json` contains account, customer/subscription ownership, invoice and replay associations.
- `829-stripe-webhook-endpoints.json` contains current endpoint identity/configuration.
- `829-stripe-dead-letter-errors.json` contains existing detailed failure evidence.
- `829-stripe-normalization-plan.json` contains exact reversible metadata and endpoint requests, unexecuted.
- `829-resend-provider.json` contains retained sent-email header classifications and source associations.
- `829-provider-read.cjs` and `829-stripe-replay-read.cjs` are local read-only probes. They load existing environment credentials in process, use only GET provider operations and write private evidence.
- `epoch5-stripe-invoice-readonly.json` and `epoch5-stripe-customer-readonly.json` retain the later provider GET evidence.
- `epoch5-invoice-runtime-proof.json` records the successful retained invoice processing and duplicate delivery assertions.
- `epoch5-invoice-target-parity.json` records all 94 source/qualification table comparisons and the foreign-key result.
- `epoch5-invoice-reconciliation-results.json` and `epoch5-invoice-preview-results.json` record the exact metadata prerequisite failures.
- `epoch5-oauth-refresh-playwright-b.log` and `epoch5-provider-ingress-c.log` record the final local Worker test results. Raw traces, operator tokens and local credentials remain private.

Provider credentials are available. Production prerequisites are the reviewed
metadata/webhook normalization, original client-held credentials for retained
token replay, and an owner-controlled live MIME transport check. The old reply
format retirement policy has been decided explicitly; unavailable historical
issuance evidence remains an honest limitation.
