# Platform admin CMS redesign brief

**Issue:** #855  
**Status:** Approved  
**Design source of truth:** `DESIGN.md`

## Job and audience

Platform administrators need to find a platform record, understand its state, and complete the relevant operational or publishing task without scanning pages that keep every record in edit mode.

This work applies the tenant CMS's existing navigation and editing model to `/admin/**`. It does not create an admin design system and does not redesign the tenant CMS.

## Outcome and proof

The redesign is successful when:

- `/admin` has one job: the grouped Platform Admin hub.
- Each durable admin record has a clear browse-to-detail path and a stable URL where detail is meaningful.
- Mobile uses the existing hub/list plus sheet behavior; desktop uses the same component as an index plus detail pane.
- Browse screens prioritize scanning. Editing controls appear in a leaf or a genuinely transient task.
- Organizations and Clients no longer compete as separate ways to find the same organization.
- Blog keeps the shared `BlogPostEditor`; documentation create and edit share one editor implementation.
- Dark mode reads as neutral charcoal/slate through shared semantic tokens, while light mode and a representative tenant CMS flow remain correct.
- No tenant CMS route, information architecture, interaction, editor behavior, or feature scope changes.

## Selected direction: tenant CMS canon

Use the current tenant CMS exactly as the interaction and visual reference:

- `DESIGN.md` defines root, hub, leaf, and responsive presentation semantics.
- `layouts/dashboard.vue` remains the only dashboard shell.
- `useDashboardMenu.ts` remains the only dashboard navigation source.
- `EditorNavigationList` renders grouped hub navigation.
- `EditorPaneShell` owns one detail surface that becomes a sheet below `lg` and a pane at `lg` and above.
- `DashboardListEditor`, `DashboardGridEditor`, `DashboardListItemDialog`, and `useListEditor` provide browse/edit/select/reorder behavior where their existing contracts fit.
- `DashboardNavbarLeading` preserves explicit parent navigation.
- `ExperienceEditorPage.vue`, `OrganizationSettingsShell.vue`, Products, and Settings are the implementation references for deeper chains and sectioned records.
- `BlogPostEditor` remains the blog authoring surface.

Do not introduce an `AdminLayout`, admin-only sidebar, duplicated breakpoint logic, viewport-specific copies, or aliases such as `AdminListEditor` that restyle an existing dashboard primitive.

## Information architecture

`/admin` is a root-level Platform Admin hub using `EditorNavigationList` with the `rows` presentation. The labels below are navigation groups, not intermediate routes.

### Operations

- Organizations
- Work Queue
- Domains

### People & access

- Users
- Team Members

### Publishing

- Platform Content
- Blog
- Documentation

### Insights

- Analytics

Navigation rows may include concise current-state summaries or problem counts when the underlying route already provides trustworthy data. Do not turn the hub into a KPI card dashboard or add new aggregation APIs solely to decorate it.

## Route decisions

| Current route | Actual job | Current shape | Target type | Proposed route | Shared primitives | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Browse organizations and enter workspaces; also serves as the mobile admin menu destination | Nested cards | Root | `/admin` | `EditorNavigationList`, shared dashboard shell | Replace with the grouped Platform Admin hub |
| `/admin/clients` | Find paid organizations and operate billing, handoff, transfer, and workspaces | List with durable workflows in modals | Filter plus organization state | `/admin/organizations?view=clients` and `/admin/organizations/[organizationId]` | `EditorPaneShell`, `EditorNavigationList` | Merge into Organizations; Clients is a filtered view, not a competing resource |
| — | Browse organizations | Currently embedded in `/admin` | Hub | `/admin/organizations` | Existing CMS list/navigation vocabulary | Add explicit organization hub |
| — | Inspect and operate one organization/client | Currently split across nested cards and client modals | Sub-hub/leaf chain | `/admin/organizations/[organizationId]` and meaningful child sections | `EditorPaneShell`, `EditorNavigationList` | Add stable record route; place durable billing, handoff, transfer, sites, and locations in the record chain |
| `/admin/users` | Find platform users and impersonate when authorized | Table with inline operation | Hub | `/admin/users` | Existing CMS list/navigation vocabulary | Keep as browse route; rows identify and open users |
| — | Inspect and operate one user | Missing | Leaf | `/admin/users/[userId]` | `EditorPaneShell` | Add stable user detail; keep only genuinely one-click operations in the list |
| `/admin/members` | View platform team and invite members | List plus inline invitation form | Hub plus transient task | `/admin/members` | CMS list vocabulary, existing dialog/sheet primitives | Keep route; invitation becomes a transient task, not a permanent editor |
| `/admin/work` | Scan and operate work requests | Every row permanently exposes status controls | Hub → leaf | `/admin/work` and `/admin/work/[requestId]` | `EditorPaneShell`, CMS list vocabulary | Move details, notes, state changes, and workspace actions into the request leaf |
| `/admin/domains` | Scan domains, status, sync state, errors, and events | List plus global event block | Hub → leaf | `/admin/domains` and `/admin/domains/[domainId]` | `EditorPaneShell`, CMS list vocabulary | Put domain-specific operations and event history with the domain |
| `/admin/analytics` | Review platform metrics | Analytical dashboard | Canvas | `/admin/analytics` | Shared dashboard chrome and semantic surfaces | Keep pushed analytical page; do not force into list/editor abstractions |
| `/admin/content` | Manage platform social-sharing media and regeneration | One broad content card | Leaf | `/admin/content` | `PlatformMediaPicker`, shared form/surface primitives | Keep route but label it Platform Content on the hub; no empty intermediate Publishing route |
| `/admin/blog` | Browse posts | Bespoke index | Hub | `/admin/blog` | CMS list vocabulary | Keep route family and align browse behavior |
| `/admin/blog/new` | Create a post | Shared editor | Editor | `/admin/blog/new` | `BlogPostEditor` | Keep |
| `/admin/blog/[postId]` | Edit a post | Shared editor | Editor | `/admin/blog/[postId]` | `BlogPostEditor` | Keep |
| `/admin/docs` | Browse documentation | Bespoke index | Hub | `/admin/docs` | CMS list vocabulary | Keep and align browse behavior |
| `/admin/docs/new` | Create documentation | Large page-specific editor | Editor | `/admin/docs/new` | Shared documentation editor component | Keep route; use the same implementation as edit |
| `/admin/docs/[docId]` | Edit documentation | Large duplicated editor | Sub-hub/editor | `/admin/docs/[docId]` with durable section URLs where applicable | `EditorPaneShell`, `EditorNavigationList`, `DashboardListEditor`, `useListEditor` | Consolidate with create and divide substantial sections using the tenant CMS pattern |

Old `/admin/clients` links should resolve canonically to the Organizations clients view through the routing mechanism already used by this application. Do not retain two implementations or a shadow Clients screen.

## Organization record model

An organization row opens the organization record. The record is a hub when it routes to independently meaningful state such as overview, sites/locations, billing, handoff, or transfer; otherwise it is a leaf. Billing and handoff stay in a dialog only for a short confirmation or data-entry step. Durable status and history live in the organization route.

The client view is a filter over the same organization collection and the same organization record. It must not introduce a second fetch model, record type, or operation implementation.

Entering a tenant workspace continues to use the existing Better Auth impersonation and permission path. Platform admin status alone does not grant tenant ownership.

## Documentation editor model

Create one reusable documentation editor implementation used by both new and existing routes. For an existing document, organize durable editor sections using the `ExperienceEditorPage.vue` pattern:

- Content
- Navigation
- SEO
- Featured media
- FAQ
- How-To

The document route is a hub when it lists these sections; each section is the leaf that edits and commits its part. Section selection must be represented in the URL for existing documents so direct links, refresh, browser Back, and explicit Close work consistently.

FAQ entries and How-To steps use the established list editing concepts for add, remove, and local reorder followed by one complete-order commit. Do not keep a second bespoke reorder path if the current `DashboardListEditor`/`useListEditor` contract fits. Creating a new document may remain a full editor until the record has an ID; after creation, navigate to its canonical record route.

## Interaction and responsive behavior

- Below `md`, use the existing bottom navigation. The Admin/Menu destination opens `/admin`.
- At and above `md`, use the existing top navigation.
- Below `lg`, selecting a durable record opens the existing detail surface as a full sheet over its list.
- At and above `lg`, the same detail surface appears beside the list.
- Use CSS breakpoints already owned by the shared shell; do not reproduce breakpoint values in JavaScript.
- A navbar Back action goes to the semantic parent. A sheet Close action dismisses to the list route. They are not interchangeable.
- Unsupported routes return 404 through the existing dashboard capability/routing behavior.
- Browse rows open records. Edit mode disables navigation so unfinished edits cannot be stranded.
- Critical actions are visible without hover.
- Reorder remains local until a complete order is committed.
- Empty, loading, and error states are explicit; do not fabricate records or return silent empty success.

## Visual direction

The admin uses the tenant CMS's existing typography, radius, spacing, control, divider, and surface hierarchy. No new visual language is introduced.

The only shared visual change is the approved dark-theme token pass in `.dark .platform-theme`:

- Replace the navy cast with near-black neutral/slate background values.
- Use small luminance steps for elevated, muted, and accented surfaces.
- Make default and muted text neutral rather than blue-grey.
- Keep borders restrained and neutral.
- Keep the coral brand accent and recognizable semantic status colors.
- Review shadows, inputs, cards, sheets, panes, dialogs, navigation chrome, hover/selected states, and editor surfaces through semantic tokens.

Avoid page-specific dark utility overrides. Light-mode semantic tokens remain unchanged unless browser verification identifies a regression that directly blocks this work.

## Scope boundaries

- No tenant CMS IA, route, component contract, layout, spacing, interaction, or editor behavior changes.
- No backend, schema, migration, or data-model cleanup.
- No direct access to Better Auth-owned tables or custom impersonation path.
- No new unit tests.
- No extra route depth unless the child is independently meaningful.
- No parallel admin-specific copies of shared CMS components.
- No draft PR. Complete and verify the implementation before opening a ready-for-review PR.

## Required verification

Use the real local application and documented Better Auth development login. Verify the admin hub and every affected route family at mobile, mid-width, and desktop presentations as applicable. For hub/leaf flows, exercise list open, direct deep link, refresh, browser Back, explicit Close, save, cancel, empty, loading, and practical error states.

Verify admin light and dark modes, sheet/pane/dialog/form surfaces, hover and selected states, and status colors. Also verify one representative tenant CMS route in both themes because the semantic dark tokens are shared. Check the browser console throughout.

Run `corepack yarn quality`. Do not use the full E2E suite as the implementation loop and do not add unit tests.

## Open implementation decisions

- Choose the smallest existing list primitive that fits each resource after comparing its actual row and selection behavior; reuse is required, but forcing unlike data into one abstraction is not.
- Choose the exact organization child-section URLs from the durable operations already present in the current Organizations and Clients implementations. The route chain must reflect real records and tasks, not visual grouping.
- Confirm whether documentation section URLs use nested route files or the repository's existing catch-all segment pattern. The user-visible behavior and canonical URLs are fixed; file placement follows the current routing conventions.
