# v0.4.5a — Radar framing and regional coverage

## Scope and implementation

Started from clean main / **676c21f** (committed v0.4.5). Only radar framing, generated regional geometry, release display, targeted tests and documentation change. No record/schema/ID/link, business logic, samples, airline assets, keyboard behavior, hosting configuration or dependency change.

The same Mercator projection is now framed symmetrically around HKG at **113.918°E, 22.308°N**. Longitude span is 68°; bounds are **79.918°E–147.918°E, 11.0371323°S–49.3438451°N**. HKG, icon, label, disc, rings and sweep all share **50% / 50%**. The northern limit falls from 57.15°N to 49.34°N, removing excess far north while retaining Hokkaido. The southern limit extends from 5°S to 11.04°S, including Java, Bali and Timor. India remains partially visible on the west; it is not a whole-India map. A tiny far-southern Australian tip may occur at the bottom edge, but Australia is not the focus.

The radar disc is **94%** of the viewport width. The existing outer ring is 98% of that disc, yielding **92.12%** of the square width (previously approximately 69%). Each edge has about **3.94%** margin. The sweep uses the enlarged disc and keeps its six-second CSS animation, existing pause/resume and Reduced Motion. The square card size, rounded corners, colors, icon and HKG / VHHH label remain unchanged.

**No interior boundaries were added.** Reframing, the larger scan and the existing grid provide context without political borders or extra labels.

Natural Earth source commits and checksums remain unchanged. The regional geometry is regenerated with 0.65 logical-unit simplification tolerance: less than 0.5 screen pixel at the maximum 440px radar size. This keeps the existing <75,000-character path budget without weakening the assertion. Output: **240 polygon subpaths / 342 coastline segments**, two static SVG paths and approximately **67KB** data/metadata. No map request, new package, per-frame projection/React loop or extra blur is added. See [geographic source and generation](RADAR_GEOGRAPHY.md).

The owner-defined release identifier is **v0.4.5a** in UI/docs. npm's numeric package version remains **0.4.5**, following the existing v0.4.4a numeric-package precedent; no new SemVer encoding is introduced.

## Verification

Run `npm.cmd run check:release`, `npm.cmd run deploy:check`, `npm.cmd audit`.

The geographic tests retain square/projection-scale, coastline/sea separation, clipped-data size, source metadata and no-network rendering checks. Added tests establish near-full outer ring coverage from the actual CSS ring-width rule, centered HKG, reduced north/south framing and Java/Bali/Timor land coverage. Existing application and visibility/modal tests remain enabled.

Isolated Edge against the production build/local Workers runtime checks **32 combinations**: 320×800, 390×844, 844×390 and 1440×1000; both languages, themes and normal/reduced motion. It measures square geometry, actual outer ring ratio/margins, common HKG/icon/disc centers, contained circles and label alignment. Dialog and inactive-Home behavior, unchanged browser records, startup errors, CSP and external network requests are checked. Actual 390px Dark and 1440px Light radar screenshots are inspected.

Physical iPhone Safari/Chrome/Home Screen and actual mobile frame rate/scroll smoothness remain owner acceptance; desktop simulation does not establish those results.

## Owner acceptance and deployment

1. Review the square radar on desktop and iPhone portrait/landscape: circle nearly fills the card with small equal margins, no awkward clipping or surrounding layout changes.
2. Inspect Hokkaido/Japan, Taiwan, Philippines, partial India/Bay of Bengal and fuller Indonesia. Confirm the northern landmass is reduced and no interior borders were added.
3. Confirm HKG / VHHH remains centered below the icon, readable as the sweep passes, and aligned with all circles.
4. Open Calendar/record dialogs, switch tabs, background/resume the app and toggle Reduce Motion. Test real-device scrolling and existing form keyboard behavior.
5. Confirm saved records/links/counts remain unchanged. No reset, migration or import is required.
6. Publish only through the owner's existing reviewed Git/Cloudflare workflow. Preserve Worker **app**, `./dist`, SPA fallback and CSP. Confirm the deployment log and actual HTTPS version **v0.4.5a** at https://app.tcologbook.workers.dev/; do not infer success from a local build.

No automatic commit, push or deployment is performed by this implementation.

## Recorded results

- **374 tests passed / 26 files**; four new framing/Indonesian island cases. Lint, production build, formatting and static checks passed. Wrangler deploy --dry-run succeeded with 35 asset files/no bindings; npm audit **0 vulnerabilities**.
- Regenerating the clipped geography produces identical bytes. Existing geometry-size assertion remains unchanged. JS gzip **157.29KB**, approximately 3.4KB smaller than v0.4.5.
- Edge/local Workers: all **32 combinations** passed, including actual outer-ring width 88–94%, approximately equal 3–6% margins, exact geographic/radar centering, square canvas, contained rings and label alignment; no page overflow, runtime exceptions, CSP violations or external requests. Existing saved records are unchanged by layout/navigation. Mobile and desktop screenshots visually inspected.
- Read-only HTTPS verification returned 200 and **v0.4.5** from the existing public bundle. This session did not commit, push or deploy v0.4.5a. Physical iPhone Safari/Chrome/Home Screen and real scrolling/animation smoothness remain owner testing.
