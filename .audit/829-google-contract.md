# Google contracts for Epoch 5

> Historical Epoch 4 source/provider observations. Source facts remain evidence for the audited snapshot; runtime ownership, release scope and qualification are governed by the [53-table consolidation contract](../docs/database/epoch-5-consolidation.md) and [current checklist](829-checklist.md). This report does not authorize provider mutations or qualify the consolidated application.


Observed 2026-09-06 against the production Epoch 4 export and the current Places API v1 reference.

## Runtime and data changes

- Place imports preserve provider text in its original script. A Maps URL must contain an explicit place ID; URL-name searches no longer choose the first result.
- Google reviews use one parser for the server and the approved import CLI. It preserves the provider review name, author name, rating, full text, exact publish timestamp and Maps URI. Existing columns hold those facts. One nullable metadata object holds author profile/avatar attribution, text languages and original text, reporting URI and visit year/month.
- Google review upserts match organization, site, location and provider review ID. Provider refresh updates provider facts without changing moderation, owner replies, IDs or creation history. Location sync and its reviews commit in one batch.
- Public review queries and cards expose the provider attribution, source link, original text and visit month. Provider avatar URLs are attribution assets, not tenant-owned media. Review lists order provider reviews by their original publish timestamp.
- Application categories and price levels remain application-owned. `business_locations.attributes` has no reader or writer outside the schema and can be removed.
- The client import uploads every approved owner-supplied image to the configured R2 bucket before writing its asset and placement rows. `--images-place-id` selects the location explicitly. File hashes and the media manifest are part of approval. The former three-image truncation and stock-image override are removed. The onboard wrapper forwards the explicit place ID.

## Source evidence and transfer

Production contains no duplicate non-null Google review IDs within the proposed four-column scope. Eighteen reviews have `status=published, source=google_places`. Commit `ca4daf92d21d740dedb51b71173041d36b9b245a` introduced this exact importer state and the deterministic Google review ID format. The importer assigned provider publish time to `created_at`. These rows require a one-time `published` to `approved` conversion; no runtime status alias is retained. Preserve exact timestamp text, including nanoseconds. New provider metadata remains null where the historical importer discarded it; no attribution is invented.

The hours-bearing Rosetta location has no location timezone, site default timezone, Google place ID, Maps URL or address, and no linked committed onboarding draft. A business-name search cannot establish its identity. Its timezone remains unknown; it must not be populated from geographical inference.

## Provider constraints

[Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) restrict caching and storage apart from explicit exceptions and require attribution for reviews and photos. The [Places v1 review schema](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#Review) supplies author attribution, Maps links, publish timestamps and language metadata. Google photos are no longer requested merely to save an unused photo manifest. No photo ownership or storage entitlement has been established, so Google photo bytes are not copied into the tenant media store. Existing owner-supplied media remains in place. This work does not claim that attribution alone establishes indefinite storage rights for all historical Places content.

## Verification

- Full typecheck and changed-file ESLint pass.
- Three direct parser tests prove non-Latin content and nanosecond timestamp preservation, nullable provider facts, and invalid identity/rating/URL rejection.
- The real CLI dry-run with an external-provider test response produced four asset inserts, four explicit placements and a review with its exact nanosecond timestamp. No provider or remote database writes occurred.
- Integrated Epoch 5 D1 upserts, actual R2/asset delivery, CMS/public browser rendering and final social-card refresh require the parent's frozen schema and built Worker. The old Epoch 4 schema intentionally cannot execute the new metadata column or scoped conflict target.
