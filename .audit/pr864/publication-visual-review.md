# Publication visual review

This is a bounded review of 12 preserved Pottery House screenshots from the
local expanded-route run. It is not an all-route visual qualification and did
not open a browser or rerun a route.

| View | Preserved screenshot | Observation |
| --- | --- | --- |
| Desktop home | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-desktop--chromium/full-page.png` | Hero, experience cards, locations, updates, reviews, blog, calls to action, and footer render coherently with first-party media. |
| Narrow home | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-narrow--chromium/full-page.png` | Sections stack without horizontal clipping; navigation, calls to action, reviews, and footer remain legible. |
| Desktop experience list | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-desktop-experiences-chromium/full-page.png` | Four experience cards show distinct media, facts, and links with no visible collision. |
| Narrow experience list | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-narrow-experiences-chromium/full-page.png` | Cards become a single column and retain images, prices, duration, capacity, and links. |
| Desktop experience detail | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-ho-45f03-eriences-beachfront-pottery-chromium/full-page.png` | Gallery, booking card, body, policy, meeting location, and footer are complete and aligned. |
| Narrow experience detail | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-ho-13ef1-eriences-beachfront-pottery-chromium/full-page.png` | Content and meeting card are complete; the captured mobile booking bar appears over an internal point in the stitched full-page image. |
| Desktop location | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-desktop-locations-krabi-chromium/full-page.png` | Location hero, hours, contact, experiences, updates, reviews, related location, and footer render coherently. |
| Narrow location | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-narrow-locations-krabi-chromium/full-page.png` | The same sections stack cleanly with usable navigation and calls to action. |
| Desktop blog | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-desktop-blog-chromium/full-page.png` | The single featured article and footer render correctly; the sparse catalog leaves substantial whitespace. |
| Narrow blog | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-narrow-blog-chromium/full-page.png` | Featured copy and media stack without clipping; footer links remain legible. |
| Desktop social-post detail | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-desktop-posts-post-ph-1-chromium/full-page.png` | Source media, post metadata, copy, address, share action, and footer are visible. |
| Narrow social-post detail | `.tmp/pr864-publication-expanded-local-results/expanded-routes-pottery-house-narrow-posts-post-ph-1-chromium/full-page.png` | Media and text stack inside the card; address, share action, navigation, and footer remain visible. |

The narrow experience-detail capture does not establish an overlap defect.
`pages/experiences/[slug].vue` deliberately renders the mobile action at
`fixed bottom-0`, while the main section reserves `pb-28` on mobile. Playwright's
full-page stitching can place a fixed element at an internal viewport boundary.
A normal-viewport observation would be required to call this a runtime failure.

No other concrete visual defect was found in these 12 captures.
