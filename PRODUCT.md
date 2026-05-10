# KrabiClaw — Product Context & Roadmap

## What It Is

**Shopify for restaurants** — a multi-tenant SaaS where restaurant owners sign up free, get a subdomain site, and build their web presence with a visual editor. SSR-ready, SEO-optimized restaurant websites powered by Google Business data.

---

## Business Model

| Tier | Price | Features |
|------|-------|---------|
| Free | $0 | Subdomain (`name.krabiclaw.com`), Saya theme, manual editor |
| Paid | ~$25/mo | Custom domain (BYOD), SSL via Cloudflare, Google Business sync |
| Upsell (TBD) | TBD | AI agent site management, multi-language, Instagram/Facebook sync, marketing services, additional themes |

---

## Current Clients

- **Client 1**: Japanese restaurant brand, 2 locations, both invited to Google Business

---

## Theme: Saya

- Default theme for all tenants
- SSR-rendered, SEO-first
- Inline editor for manual content updates
- Google Business data auto-populates content when connected

---

## Integration Status

| Integration | Status |
|-------------|--------|
| Google OAuth (login) | ✅ Live |
| Stripe (billing) | ✅ Live |
| Google Business Profile API | ⏳ API approval pending; client has invited us as manager to 2 locations |
| WhatsApp Business API | ✅ App created and ready |
| Facebook / Instagram Graph API | ✅ App created and ready |
| Cloudflare AI Gateway | ✅ Live — menu extraction, credit billing, usage logging |

---

## Build Roadmap

Priority order — each item unblocks or feeds into the next.

### 1. Cloudflare AI Gateway + first AI actions
**Why first:** Biggest differentiator. Existing menu/content APIs are complete — an agent just needs to call them. Cloudflare AI Gateway is free config that gives usage logging, caching, and rate limiting across any model.

First actions:
- **Menu from PDF/photo** — parse uploaded file, call existing `POST /api/editor/sites/[siteId]/menus/[menuId]/items`
- **Post to Google Business** — generate copy from a menu item, call existing GMB posts utility once API is approved
- **Blog/event post** — generate content from prompt, save to site content via existing draft/publish flow

#### Menu Extraction — Key Design Notes

**Input friction is the #1 problem.** Owners send photos and PDFs. Photos are increasingly AI-generated (Midjourney/DALL-E food shots with text overlay) — OCR/vision must handle this, not just scanned documents. Approach:
- Use a vision-capable model (Claude claude-sonnet-4-6 via AI Gateway) for both photos and PDF-converted images
- For PDFs: convert pages to images server-side (pdf-to-image via Wasm or Cloudflare Worker), then pass to vision model
- Structured output: model returns JSON matching `menu_items` schema (section, name, description, price) — validated before writing
- AI-generated food photography often has stylized/embedded text; prompt must instruct model to extract visible text only, not infer

**Draft-first, always.** Agent writes to the draft layer (`menus.status = 'draft'`, `site_content_drafts`), never directly to published. Owner sees a preview diff in the dashboard before confirming. No AI action publishes without an explicit owner approval click.

**Preview/approval flow:**
1. Owner uploads PDF/photo → agent extracts → creates draft menu items
2. Dashboard shows side-by-side: extracted items vs. current published menu
3. Owner edits inline if needed, then clicks "Publish" — calls existing publish endpoint
4. Agent actions that fail validation are surfaced as warnings, not silent drops

#### Credit / Token Billing System

All AI calls route through **Cloudflare AI Gateway** — this is the single metering point. Gateway logs tokens in/out per request with metadata we attach (org_id, site_id, action_type).

**Credit model:**
- 1 credit = 1,000 tokens (input + output combined, weighted — output costs ~3× more, so normalize)
- Free tier: 500 credits on signup (~500K tokens, enough for ~10 menu extractions)
- Paid tier ($25/mo): 5,000 credits/mo included; overage billed at cost + markup
- Image/video generation: paid tier only; charged at a higher credit rate (images are expensive)
- Multiplier on Anthropic/CF cost: target ~2–3× pass-through (covers infra margin + support)

**Schema additions needed:**
- `ai_credits` table: `org_id`, `balance`, `lifetime_used`, `last_topped_up_at`
- `ai_usage_log` table: `org_id`, `site_id`, `action`, `model`, `input_tokens`, `output_tokens`, `credits_charged`, `cf_gateway_log_id`, `created_at`
  - `cf_gateway_log_id` links back to Cloudflare AI Gateway log entry for reconciliation

**Gateway tracking:**  
Cloudflare AI Gateway exposes per-request logs via the REST API (`GET /accounts/{id}/ai-gateway/gateways/{gateway}/logs`). A nightly worker reconciles gateway logs → `ai_usage_log` to catch any drift. Custom metadata (org_id, action) is passed as request headers through the gateway so logs are attributable.

**Enforcement:** Middleware on all `/api/ai/*` routes checks `ai_credits.balance > 0` before forwarding to gateway. On credit exhaustion, return a 402 with upgrade prompt.

### 2. WhatsApp notification foundation
**Why second:** Unblocks the agent confirmation loop (agent acts → tenant gets WhatsApp message). Start with send-only, no login yet.

- `notifications` table (channel, org_id, template, payload, status, sent_at)
- `server/utils/whatsapp.ts` wrapping Meta Cloud API (app is ready)
- First triggers: draft published, new review received, reservation alert

#### WhatsApp Notification — Key Design Notes

**Send-only first.** The Meta Cloud API (WhatsApp Business) app is already created. No webhook/receive flow yet — just outbound messages. Receive flow comes in Priority 3 (login OTP).

**Template messages only until messaging window opens.** WhatsApp only allows free-form messages within 24 hours of a customer reply. For system notifications to restaurant owners (not customers), we use pre-approved template messages. Templates must be submitted to Meta for approval — plan for 24–72h approval time.

**Notification templates needed (submit to Meta):**
- `draft_published` — "Your [site name] menu has been published. View it at [url]."
- `new_review` — "A new [rating]-star review was posted on [site name]: '[excerpt]'"
- `ai_action_complete` — "Your AI assistant completed: [action summary]. [Preview link]"
- `low_credits` — "You have [n] AI credits remaining. [Upgrade link]"

**Phone number storage.** Restaurant owners provide their WhatsApp number during onboarding. Store normalized (E.164 format, e.g. `+66812345678`) in `organization_settings` key `whatsapp_phone`. No separate table needed yet — reuses the existing `site_config` KV pattern.

**Delivery reliability.** Meta Cloud API returns a `message_id` on success. Store it in `notifications.provider_message_id` for debugging. Mark status `sent` on 2xx, `failed` on error — no retry queue yet (keep it simple; manual retry from dashboard is acceptable for v1).

**Schema additions needed:**
```sql
notifications (
  id, organization_id, site_id,
  channel TEXT DEFAULT 'whatsapp',   -- email later, no schema change
  template TEXT NOT NULL,
  payload TEXT,                       -- JSON: template variables
  status TEXT DEFAULT 'pending',      -- pending | sent | failed
  provider_message_id TEXT,           -- WhatsApp message_id
  error TEXT,
  sent_at TEXT,
  created_at TEXT
)
```

**First triggers to wire:**
1. `POST /api/editor/sites/[siteId]/content/publish` → fire `draft_published`
2. New review saved → fire `new_review` (once review ingestion is live)
3. AI extraction complete (from Priority 1 `extract.post.ts`) → fire `ai_action_complete`
4. Credit balance drops below 50 after a charge → fire `low_credits`

**Env vars needed:**
- `WHATSAPP_PHONE_NUMBER_ID` — from Meta app dashboard (the sending number)
- `WHATSAPP_ACCESS_TOKEN` — permanent system user token from Meta Business Manager
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — for template management API calls

### 3. WhatsApp login
**Why here (not earlier):** Better Auth's `phoneNumber` plugin handles OTP natively. Since the WhatsApp Business app is already set up, implementation is: configure the plugin, swap SMS delivery for a WhatsApp message send via the utility built in step 2. Much simpler than a custom OAuth provider.

### 4. Posts Foundation + Social Channel Publishing
**Why before GMB-specific:** Posts are a platform primitive. A post lives in our system first (`posts` table), then gets pushed to channels. Social integrations (GMB, Instagram, Facebook) become adapters on top — channel stubs exist in `post_channel_jobs` now and drain when each integration is connected.

**Built:**
- `posts` + `post_channel_jobs` tables — post is source of truth, one channel-job row per channel per publish
- Full CRUD: `GET/POST /api/editor/sites/[siteId]/posts`, `GET/PATCH/DELETE/publish /api/editor/sites/[siteId]/posts/[postId]`
- Public API: `GET /api/public/sites/[siteId]/posts` — returns posts in SayaPosts-compatible format
- AI generation: `POST /api/ai/[siteId]/posts/generate` — prompt + optional image → Claude drafts title + body, uses credit system
- Dashboard Posts page: AI composer (prompt + photo attachment), draft list with tabs, inline editor, channel checkbox selector, live preview

**Next — channel adapters (when integrations connected):**
- Site: immediate (already live on publish)
- GMB: `post_channel_jobs` status = `pending` → drain when GMB API approved
- Instagram/Facebook: same pattern, drain when Meta OAuth connected

### 4b. Google Business post scheduling from dashboard
**Why here:** GMB API approval is pending but the UI and queue can be built now. Add a Posts section per location that queues posts with `pending_publish` status. When API is approved the worker drains the queue. AI agent flow feeds directly into this.

### 5. Facebook / Instagram content sync
Meta Graph API for Instagram posting. Entitlement-gated paid feature. Pattern is identical to GMB posting — generate copy → post to channel. Build after GMB flow is proven.

### 6. Tenant MCP / API
Per-tenant API key system so restaurant owners can connect their own AI (Claude, ChatGPT) to manage their site via MCP. Most complex, most premium. Build last once agent actions are proven and used by real clients.

---

## Key Architectural Notes for Future Builds

- All AI calls route through Cloudflare AI Gateway — never call model APIs directly
- Notification delivery is channel-agnostic by design — the `notifications` table stores `channel` so email can be added later without schema changes
- WhatsApp and Instagram both go through the same Facebook app — single OAuth connection covers both
- Agent actions should write through existing editor APIs, not bypass them — keeps audit trail and draft/publish workflow intact
