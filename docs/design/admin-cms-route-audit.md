# Platform admin route audit

Issue #855 defines the platform-admin information architecture. `DESIGN.md` remains the interaction source of truth.

| Route | Role | Pattern and decision |
| --- | --- | --- |
| `/admin` | Hub | Grouped navigation for Operations, People & access, Publishing, and Insights. |
| `/admin/organizations` | Browse | Canonical organization collection with an in-place Clients filter. Replaces the duplicate Clients collection. |
| `/admin/organizations/:id` | Durable detail | Organization, site, location, and client status in `EditorPaneShell`. |
| `/admin/organizations/:id/billing` | Durable detail | Billing identifiers, subscription status, and pending transfer resolution. |
| `/admin/organizations/:id/handoff` | Durable task | Existing client handoff operation, linked from the organization detail. |
| `/admin/clients` | Compatibility entry | Redirects to `/admin/organizations?view=clients`; it owns no data or UI. |
| `/admin/work` | Browse | Scan-only work queue using the shared row vocabulary. |
| `/admin/work/:id` | Durable detail | Status and internal notes editor in the paired pane/sheet shell. |
| `/admin/domains` | Browse | Scan-only custom-domain list. |
| `/admin/domains/:id` | Durable detail | Domain status, Cloudflare identifier, sync operation, and domain-scoped activity. |
| `/admin/users` | Browse | Searchable user list. |
| `/admin/users/:id` | Durable detail | User identity, role, ban state, and impersonation action. |
| `/admin/members` | Browse + transient task | Team list; adding a member is a modal because the form has no durable state. |
| `/admin/content` | Singleton editor | Platform social-card asset and regeneration operation; retains `PlatformMediaPicker`. |
| `/admin/blog` | Browse | Shared row navigation into the existing `BlogPostEditor` routes. |
| `/admin/blog/new` | Create | Existing shared blog editor. |
| `/admin/blog/:id` | Durable editor | Existing shared blog editor. |
| `/admin/docs` | Browse | Shared row navigation for documentation. |
| `/admin/docs/new` | Create | The same documentation editor implementation used by edit mode. |
| `/admin/docs/:id` | Durable editor | The same documentation editor implementation used by create mode. |
| `/admin/analytics` | Report | Read-only platform metrics; no editor shell required. |

The tenant CMS remains unchanged. Both platform and tenant surfaces continue to consume the dashboard layout, semantic tokens, and established shared editor components.
