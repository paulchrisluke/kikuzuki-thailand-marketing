# KIKUZUKI Thailand Marketing Website

A Nuxt 4 application for KIKUZUKI Japanese Restaurant in Krabi, Thailand. Deployed on **Cloudflare Pages** with a **D1 SQLite** database.

## Package Manager

**This project uses yarn.** Do not use npm or pnpm — they will generate conflicting lockfiles.

```bash
yarn install
```

## Architecture

- **Runtime**: Cloudflare Pages + Pages Functions (Nitro `cloudflare-pages` preset)
- **Database**: Cloudflare D1 (`REVIEWS_DB` binding — one database, all tables)
- **Auth**: better-auth with multi-tenant support running inside Pages Functions
- **Styling**: Tailwind CSS v3
- **Languages**: English, Thai, Japanese, Arabic (nuxt-i18n)

There is **no separate Worker** — everything runs as Pages Functions inside the same Cloudflare Pages project.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Nuxt dev server (localhost:3000). No D1 bindings — DB calls will error. Use for UI/styling only. |
| `yarn build` | Production build with `cloudflare_pages` preset → outputs to `dist/` |
| `yarn build:cf` | Alias for `nuxt build` (same preset) |
| `yarn dev:cf` | Run `dist/` through Wrangler Pages dev with real D1 bindings (localhost:8788). Requires a prior build. |
| `yarn preview` | Nuxt preview server |

## Local Development with D1

### 1. Database Setup (D1)

The project uses Cloudflare D1. For local development, migrations are applied to a local SQLite file managed by Wrangler.

```bash
# Apply migrations locally
yarn wrangler d1 migrations apply REVIEWS_DB --local
```

> [!NOTE]
> Since this is a greenfield project, migrations have been consolidated into `0001_initial_schema.sql` for stability.

### 2. Environment Variables

Create a `.env` file with the following (see `.env.example`):
- `BETTER_AUTH_SECRET`: Generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL`: `http://localhost:8788` (for local dev)
- `GOOGLE_CLIENT_ID` / `SECRET`: From Google Cloud Console

### 3. Development Server

We use `wrangler pages dev` to simulate the Cloudflare environment locally, including D1 bindings.

```bash
# 1. Build the project
yarn build

# 2. Run the local Cloudflare Pages server
yarn dev:cf
```

The app will be available at `http://localhost:8788`.

When you change server code, stop wrangler, rebuild, then restart:

```bash
yarn build && yarn dev:cf
```

### EMFILE fix (macOS)

macOS defaults to 256 open files which crashes the watcher. Run this in your terminal before starting the dev server, or add it to your shell profile (`~/.zshrc`):

```bash
ulimit -n 65536
```

For a permanent fix (requires sudo, survives reboots):

```bash
sudo tee /Library/LaunchDaemons/limit.maxfiles.plist > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
      <string>launchctl</string><string>limit</string>
      <string>maxfiles</string><string>65536</string><string>200000</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>ServiceIPC</key><false/>
  </dict>
</plist>
EOF
sudo launchctl load -w /Library/LaunchDaemons/limit.maxfiles.plist
```

## Migrations

All schema lives in `migrations/`. Files are applied in numeric order.

| File | What it creates |
|---|---|
| `0001_reviews.sql` | `reviews` table |
| `0002_google_business_sync.sql` | `google_business_snapshots`, `google_oauth_tokens` |
| `0003_site_config.sql` | `site_config` table |
| `0004_content_management.sql` | `site_content`, `staff_profiles`, `awards_recognition` |
| `0005_content_drafts.sql` | `site_content_drafts` |
| `0006_content_schema_v2.sql` | Schema v2 columns |
| `0007_saas_platform_foundation.sql` | Multi-tenant: `organizations`, `sites`, `users` |
| `0008_google_business_integration.sql` | `google_business_connections`, `business_locations` |
| `0009_billing_entitlements.sql` | `subscriptions`, `entitlements` |
| `0010_domains_onboarding.sql` | `custom_domains`, `onboarding_state` |
| `0011_menu_management.sql` | `menu_items`, `menu_categories` |

### Apply locally

```bash
wrangler d1 migrations apply REVIEWS_DB --local
```

### Apply to production

```bash
wrangler d1 migrations apply REVIEWS_DB --remote
```

### Run a specific migration manually (if needed)

```bash
wrangler d1 execute REVIEWS_DB --local --file migrations/0011_menu_management.sql
```

## Deployment

```bash
# Build
yarn build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

Cloudflare Pages CI/CD will also trigger automatically on pushes to the connected branch.

## Environment Variables

Set these in Cloudflare Pages dashboard → Settings → Environment Variables.

```bash
# Google OAuth (admin login via better-auth)
NUXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Google Business API (auto-sync reviews/data)
GOOGLE_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_REDIRECT_URI=
GOOGLE_BUSINESS_ACCOUNT_ID=
GOOGLE_PUBSUB_TOPIC=

# Analytics
NUXT_PUBLIC_GA4_PROPERTY_ID=

# Cloudflare Turnstile (contact form bot protection)
NUXT_PUBLIC_TURNSTILE_SITE_KEY=

# Stripe (billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

For local development, copy `.env.example` to `.env`.

## Admin Panel

Access at `/admin` — requires Google OAuth sign-in via better-auth.

## Database Schema (summary)

- `reviews` — customer reviews with moderation status
- `google_business_snapshots` — cached Google Business API data
- `google_oauth_tokens` — stored OAuth refresh tokens
- `google_business_connections` — per-organization Google Business connections
- `business_locations` — synced location data
- `site_content` / `site_content_drafts` — CMS draft/publish workflow
- `staff_profiles` / `awards_recognition` — team and achievements content
- `organizations` / `sites` / `users` — multi-tenant SaaS foundation
- `subscriptions` / `entitlements` — billing and plan management
- `custom_domains` — custom domain management per site
- `menu_items` / `menu_categories` — restaurant menu management
