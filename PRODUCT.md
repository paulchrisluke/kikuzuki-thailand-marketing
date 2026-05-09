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
| Cloudflare AI Gateway | 🔲 Not started |

---

## Build Roadmap

Priority order — each item unblocks or feeds into the next.

### 1. Cloudflare AI Gateway + first AI actions
**Why first:** Biggest differentiator. Existing menu/content APIs are complete — an agent just needs to call them. Cloudflare AI Gateway is free config that gives usage logging, caching, and rate limiting across any model.

First actions:
- **Menu from PDF/photo** — parse uploaded file, call existing `POST /api/editor/sites/[siteId]/menus/[menuId]/items`
- **Post to Google Business** — generate copy from a menu item, call existing GMB posts utility once API is approved
- **Blog/event post** — generate content from prompt, save to site content via existing draft/publish flow

### 2. WhatsApp notification foundation
**Why second:** Unblocks the agent confirmation loop (agent acts → tenant gets WhatsApp message). Start with send-only, no login yet.

- `notifications` table (channel, org_id, template, payload, status, sent_at)
- `server/utils/whatsapp.ts` wrapping Meta Cloud API (app is ready)
- First triggers: draft published, new review received, reservation alert

### 3. WhatsApp login
**Why here (not earlier):** Better Auth's `phoneNumber` plugin handles OTP natively. Since the WhatsApp Business app is already set up, implementation is: configure the plugin, swap SMS delivery for a WhatsApp message send via the utility built in step 2. Much simpler than a custom OAuth provider.

### 4. Google Business post scheduling from dashboard
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
