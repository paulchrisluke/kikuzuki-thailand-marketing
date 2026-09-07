# Platform admin route audit

Issue #855 defines the platform-admin information architecture. `DESIGN.md` remains the interaction source of truth.

| Current route | Actual job | Current shape | Target type | Proposed route | Shared primitives | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Browse organizations | Single-purpose organization browser at the hub URL | Browse | `/admin/organizations` | `EditorNavigationList`, `EditorPaneShell` | Move the all-organizations job to the canonical Organizations browser |
| None | Navigate platform operations, people, publishing, and insights | No grouped admin entry point | Hub | `/admin` | `EditorNavigationList` | Add grouped hub at the existing admin root |
| `/admin/clients` | Browse client organizations | Duplicate client collection | Filtered browse | `/admin/organizations?view=clients` | `EditorNavigationList`, `EditorPaneShell` | Merge into Organizations and remove route |
| Inline organization expansion and client actions | Inspect an organization and operate its workspace | Detail state was coupled to the old collection pages | Durable leaf | `/admin/organizations/:id` | `EditorNavigationList`, `EditorPaneShell` | Move to one refresh-safe organization detail route |
| Inline client billing | Inspect subscription and pending-transfer state | Billing was nested inside the duplicate Clients collection | Durable leaf | `/admin/organizations/:id/billing` | `EditorPaneShell` | Move under the canonical organization record |
| Inline client handoff | Send a client transfer invitation | Handoff was nested inside the duplicate Clients collection | Durable task | `/admin/organizations/:id/handoff` | `EditorPaneShell` | Move under the canonical organization record |
| `/admin/work` | Triage support requests | Inline-edit list | Hub → leaf | `/admin/work`, `/admin/work/:id` | `EditorNavigationList`, `EditorPaneShell` | Replace |
| `/admin/domains` | Monitor and sync domains | List plus global event stream | Hub → leaf | `/admin/domains`, `/admin/domains/:id` | `EditorNavigationList`, `EditorPaneShell` | Replace |
| `/admin/users` | Find and impersonate users | Table with inline action | Hub → leaf | `/admin/users`, `/admin/users/:id` | `EditorNavigationList`, `EditorPaneShell` | Replace |
| `/admin/members` | Review and add platform staff | Bespoke card and inline form | Browse + transient task | `/admin/members`, invite modal | `EditorNavigationList`, `UModal` | Replace |
| `/admin/analytics` | Read platform metrics | Standalone report | Report | `/admin/analytics` | Existing report cards | Keep |
| `/admin/content` | Edit platform singleton media | Standalone singleton form | Singleton editor | `/admin/content` | `PlatformMediaPicker` | Keep |
| `/admin/blog` | Browse and maintain posts | Bespoke rows | List editor | `/admin/blog` | `DashboardListEditor` | Replace list; keep editor routes |
| `/admin/blog/new` | Create a post | Shared editor | Create | `/admin/blog/new` | `BlogPostEditor` | Keep |
| `/admin/blog/:id` | Edit a post | Shared editor | Durable editor | `/admin/blog/:id` | `BlogPostEditor` | Keep |
| `/admin/docs` | Browse and maintain docs | Bespoke rows | List editor | `/admin/docs` | `DashboardListEditor` | Replace list |
| `/admin/docs/new` | Create documentation | Duplicate full-page form | Create | `/admin/docs/new` | Unified documentation editor, `PlatformMediaPicker` | Merge implementation |
| `/admin/docs/:id` | Edit documentation | Duplicate full-page form | Durable editor | `/admin/docs/:id` | Unified documentation editor, `PlatformMediaPicker` | Merge implementation |

The documentation form remains a single route-owned editor because FAQ and How-To blocks are ordered parts of the document draft, not independent records. Removing the outer card prevents the whole editor from reading as one giant contained object while preserving the established inline ordering controls.

The tenant CMS remains unchanged. Both platform and tenant surfaces continue to consume the dashboard layout, semantic tokens, and established shared editor components.
