# Location header hydration diagnosis

## Scope

This record covers the Pottery House location hydration failures on preview candidate `64d5ab164455b40fb52529d8673f32ce5d7e7afd`. The run used extension-free Chromium. This record contains no credentials or request headers.

## Failure

The expanded preview run reported the same Vue warning on these desktop routes:

| Route | Request ID | Cloudflare Ray | Result |
| --- | --- | --- | --- |
| `/locations/klong-muang-beach` | `03ac14a1-a38a-4a41-82dd-763f1e38369d` | `a37b06c55c4ea635-OMA` | HTTP 200, hydration expected an `a` node |
| `/locations/krabi` | `1e56e9a3-da7c-49c8-8029-97a17d62a2cb` | `a37b06fa19b06e38-OMA` | HTTP 200, hydration expected an `a` node |
| `/locations/krabi/experiences` | `fe941ba3-ad9f-4b56-9650-29356b75923c` | `a37b07321ff66d28-OMA` | HTTP 200, hydration expected an `a` node |

The narrow run reproduced the warning on the same three routes. `/locations` passed at both widths.

Cloudflare Observability found status 200, no error code, one attempt, and zero D1 writes for each desktop request. The request records are in `preview-location-observability.json`. The browser output is in `expanded-preview-runtime.log`.

## SSR and client evidence

The `/locations/krabi` trace contains the original server response and a DOM snapshot after hydration. The server response has 39 anchors. Its first anchors are `/`, `/experiences`, and `/locations`. It has no header CTA after them. The hydrated snapshot has 41 anchors and inserts `/locations/krabi/experiences` at anchor index 3.

The Klong Muang trace shows the same structural change. The server response has 37 anchors. The hydrated snapshot has 39 anchors and inserts `/experiences/beachfront-pottery` at anchor index 3.

That position matches the conditional header CTA in `components/saya/SayaHeader.vue`. Vue reported `rendered on server: JSHandle@node` and `expected on client: a` when the client inserted the link.

The preserved traces are:

- `.tmp/pr864-expanded-preview-results/expanded-preview-routes-po-b3e65-use-desktop-locations-krabi-chromium/trace.zip`
- `.tmp/pr864-expanded-preview-results/expanded-preview-routes-po-e5722-locations-klong-muang-beach-chromium/trace.zip`
- `.tmp/pr864-expanded-preview-results/expanded-preview-routes-po-d45e6-locations-krabi-experiences-chromium/trace.zip`

## Cause

`layouts/saya.vue` read `experiencesList` from `nuxtApp.payload.data[activePageKey]` to calculate a location-specific header CTA. During SSR, the child page had not populated that payload when the persistent layout rendered. The layout therefore omitted the CTA. The serialized response still contained `experiencesList`, so the client calculated the location-specific path before hydration and expected an anchor.

The route check explains the affected set. Location detail routes have a location slug and request the CTA calculation. `/locations` has no location slug and stayed stable.

## Pending correction

The working tree removes the route-payload lookup from `layouts/saya.vue` and removes `experienceCtaPath` from `components/saya/SayaHeader.vue`. The header now reads the site-wide CTA from `getVerticalCopy`. The experience vertical declares `/experiences` as that route. Header and footer feature visibility still read `shell.hasExperiences`.

This correction has passed source review only. Runtime verification is pending.

## Required verification

Verify the rebuilt Worker with zero retries:

1. Hard-load the three failed routes at desktop and narrow widths. Require HTTP 200 and no browser warning or error.
2. Compare the server HTML and hydrated DOM. Require the header CTA to use `/experiences` in both representations.
3. Load `/experiences` and confirm that the site-wide CTA still reaches the published experience collection.
4. Load one restaurant tenant. Confirm that order and reservation CTA selection is unchanged.
