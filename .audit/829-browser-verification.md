# Epoch 5 local browser verification

The root agent used the Codex browser against the production Nuxt/Nitro output
served by local Wrangler on September 6, 2026. These checks exercised the local
canonical fixtures. They do not qualify the deployed preview or staging build.

- Signed in through the normal credential form and opened the tenant dashboard.
- Inspected both Kikuzuki locations, the 77-item menu and canonical weekly hours.
- Changed the first opening time from 14:00 to 14:15 through the CMS, saved,
  reloaded and verified persistence. Restored 14:00 and confirmed the location
  summary again displayed 2:00 PM to 11:00 PM.
- Created an offer through the CMS with a complete location-local event schedule
  and no coupon, terms or redemption URL. The saved editor retained all dates
  and times, the body and intentional empty optional fields. Deleted the
  verification post through the CMS afterward.
- Ran the canonical social-card regeneration endpoint over all tenant fixtures.
  Its completed pass generated 112 cards, reused 169 earlier generated cards,
  skipped five owners without source media and reported zero failures. Every
  returned image was fetched and checked as a 1200 by 630 PNG.
- Created a disposable platform document through the authenticated content API
  with the existing platform logo explicitly assigned as its featured media.
  Generated and inspected its card, then deleted the document through that API.
- Visually inspected a rendered card for every owner type: site, location,
  product, experience, offering, post, blog post, review, tenant page and platform
  document. Each showed its own title and selected source media.
- Captured all three customer fixture homepages at desktop and narrow widths.
  All six responses were HTTP 200. The independent review records the pre-existing
  Pottery review-chip overflow and the image-loading follow-up separately.

The fresh full local run passed 65 tests, failed one pre-hydration language-menu
interaction and skipped one HTTPS-only private-key JWT case. The corrected
Kikuzuki test then passed in a focused run, giving 66 locally passing tests.
Deployed preview must qualify the HTTPS-only case and the final release build. Screenshots, traces and raw logs remain in the private local
evidence directory; they are not CI artifacts or production verification.
