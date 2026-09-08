# Publication batch focused rendering verification

The 15-case suite passed on local built Worker `46bd2231-2ed8-4ae3-84e6-115da6f004bc`, using one Chromium page and no retries. Ten cases compare the actual server-rendered header CTA against the hydrated DOM on desktop and narrow viewports. Five cases inspect rendered home/menu media, including the same decoded video element advancing playback after its initial byte-range replacement.

The strict network checker classified two known hero video initial-range cancellations only after matching their subsequent 206 response and proving continued playback. They are recorded explicitly in `publication-focused-evidence.json`; this is not a claim that no network cancellation occurred. Every unclassified first-party failure remained blocking.

Root visually inspected the final narrow Kikuzuki hero frame and narrow Pottery House Krabi header screenshot: tenant imagery and text render, the location navigation and booking CTA remain visible, and neither image shows horizontal clipping. Earlier menu image inspection remains supporting evidence. Automated image decoding does not substitute for visual review of every full-route screenshot.

The later final-response SEO policy move requires separate header verification; these focused checks do not qualify that change or any deployed build. The complete route inventory and signed client-navigation preview cases remain separate gates.
