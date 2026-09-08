# ChatGPT MCP tool scope audit

The September 7 retirement candidate has 96 registry tools and 95 exposed by
default. `analyze_document` and `import_products_from_media` are removed.
The earlier four-tool scope decision below remains historical evidence.

2026-09-06 · `codex/chatgpt-app-submission` · base `002f289c`

This is a source-based product-scope audit, not a completed security or runtime certification. Reviewed the 101 tools in the default conversational submission set, their canonical input schemas, and the lifecycle/deletion implementation paths relevant to the recommendations. `get_site_domains` is a separate, disabled-by-default read tool. The approved four-tool removal has now been implemented. Both generated artifacts were rebuilt with the existing scripts; neither JSON file was hand-edited.

## Recommended boundary

Use the MCP app to manage content and daily operations for an explicitly selected existing business. Keep business provisioning and deletion in the CMS, where the user can inspect ownership, affected records, and setup requirements.

This is a product recommendation based on this implementation, not an OpenAI rule prohibiting creation/deletion tools.

## Approved removal from MCP; preserve CMS operations

| Tool | Observed behavior | Recommendation |
| --- | --- | --- |
| `create_site` | Provisions a site, locale, team, and onboarding content; can choose an organization or resume a failed site implicitly. | Remove. The caller provides no explicit organization or retry-site target. |
| `create_location` | Creates a location, but at a limit can substitute an update to the sole existing active location. | Remove, including the MCP-only overwrite helper. |
| `delete_location` | Deletes the location, placements, related guest threads, and clears workspace/conversation location selections. | Remove. This is an operational container deletion, not a routine content edit. |
| `copy_location_batch` | Copies multiple entity types and can create a new location through `new_location_title`. | Remove the whole MCP tool. Otherwise it retains an indirect location-creation path; narrowing it is unnecessary complexity for this submission. |

There is **no `delete_site` MCP tool** in the current registry or executor. `delete_site_qa` deletes a Q&A entry, not a site.

These four removals reduced the default catalog from 101 to 97 tools at the
September 6 checkpoint. Provider retirement subsequently reduced it to 95.

## Daily workflow tools retained

The user explicitly retained `delete_media_asset` and `delete_experience` as daily workflows. Both remain registered and dispatchable, with their existing destructive annotations and CMS/domain implementations. The current catalog contains 95 default tools, plus the disabled-by-default `get_site_domains` read tool.

## Keep, with targeted review before submission

| Tool family | Assessment |
| --- | --- |
| Site/location reads and workspace selection | Essential for explicit targeting; preserve these. Removing creation must also remove instructions that tell a new user to create through MCP. An empty account should explain that setup is required in the CMS. |
| `update_location` | Keep ordinary hours, temporary closure, contact information, and public links. Review notification routing, capacity, and timezone changes distinctly; these affect operations, not just page text. |
| Products and categories | Keep creation, editing, ordering, and bounded deletion. `sync_products` marks omitted products unavailable only when `set_missing_unavailable === true`; review that choice and supply an explicit location. |
| Posts, blog, pages, translations, Q&A | Core content workflows. Keep public-write hints and accurate publication descriptions. Preview requested draft copy in chat; do not claim `create_post` saves an unpublished draft. |
| Media upload, assignment, removal, ordering | Keep. Clearly disclose public media storage and distinguish removing a placement from deleting the underlying asset. |
| Experiences and booking reads | Keep. Scheduling, pricing, and capacity edits need explicit user intent. Customer contact information must remain permission-scoped. |
| `update_experience_booking` | Keep if booking triage is part of the intended app; make cancellation/confirmation explicit and test the real authorization boundary. It is not required to remove this merely because it changes state. |
| `update_booking_policy` | Higher-impact operational settings. Review cancellation/deposit changes with the user before writes; do not remove automatically as part of the site/location scope change. |
| `update_site_settings`, `set_default_currency` | Review before shipping: settings include tracking, verification, canonical/indexing controls, and currency. Removing only `set_default_currency` would not remove that capability because `update_site_settings.default_currency` also exposes it. Narrow fields only if a CMS-only settings boundary is selected. |
| `change_tenant_page_path` | URL changes warrant review, but removing this tool alone would not remove path editing: `update_tenant_page.path` also exposes it. Check all fields if restricting this capability. |
| Owner-entered reviews and replies | Useful, but preserve attribution/provenance and real publication authorization. These must not become a way to fabricate customer reviews. |
| AI imports/document analysis | Internal AI product extraction and document analysis are retired. `import_from_maps` retrieves business details through Google Places. |

No additional removals are required by this retained-tool scope review. Explicit effects now cover the complete default catalog in the existing generator. Production reviewer credentials, test fixtures, privacy facts, deployment, and authenticated scan are separate outstanding readiness gates.

## Implemented scope

- Delete the selected MCP definitions, annotation entries, and dispatcher branches; do not merely omit them from submission JSON or hide them in a feature flag.
- Preserve canonical domain functions and CMS API handlers that implement the corresponding CMS operations.
- Delete the now-unused `hydrateSeededLocationForOnboarding` helper when `create_location` is removed; it has only the MCP creation caller.
- Update MCP initialization instructions, prompts, schema descriptions, and empty-account messaging so they do not call removed tools. The onboarding prompt currently explicitly invokes `create_site` and `create_location`.
- Update existing runtime checks that provision data through removed MCP tools to use the approved setup/CMS boundary. Verify removed names are absent from `tools/list` and rejected by `tools/call`; a listing-only filter is insufficient.
- Refresh the canonical catalog snapshot and submission artifact through their existing generators. Verify CMS lifecycle workflows remain available.
- Use canonical release procedures and rescan the deployed catalog before uploading submission materials. Local generation does not update the deployed endpoint or the portal automatically.

## JSON generation: no hand editing

The OpenAI Developers `chatgpt-app-submission` skill instructs Codex to inspect implementations and produce a submission file. It is an agent workflow, not a background service that watches the repository or a deterministic compiler supplied by the plugin.

This repository already supplies that deterministic build step in `scripts/generate-chatgpt-app-submission.mjs`. It imports the canonical tool registry and conversational filter, reads annotation values, constructs listing/test copy, validates against the published JSON schema, and writes the output.

Use that path after changes:

```sh
corepack yarn mcp:catalog:write
corepack yarn mcp:catalog
corepack yarn chatgpt:submission:write
corepack yarn chatgpt:submission:check
```

The generator now contains explicit reviewed effects and revised test prompts. Maintain those authoring inputs in the generator, then run it. Do not manually patch `chatgpt-app-submission.json`. Regeneration reflects registry changes automatically, but it cannot infer improved explanations or repair authored test scenarios by itself. The check command validates the schema and verifies that the committed output matches regeneration; it does not prove real tool behavior.

The generated JSON now reflects the approved scope. It remains a submission draft until the deployed catalog, OAuth scan, domain verification, reviewer access, and listing review are complete.
