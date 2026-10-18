# v0.4.5 — Radar map visual and geographic refinement

## Baseline and scope

Started on clean `main` / **f44b9aa**, committed v0.4.4a. The existing Worker name is **app**. A read-only request to https://app.tcologbook.workers.dev/ returned HTTPS 200 and its compiled JavaScript displayed **v0.4.4** during this session. That verifies the existing deployment, not deployment of this release. No automatic commit, push or remote release is performed.

The old 600×400 decorative manually drawn map and unrelated circle center are replaced with a 600×600 local Natural Earth-derived map and one geographic HKG anchor. Existing radar component/effect, CSS sweep duration, pause/reduced-motion rules, Home layout and data flows are retained. See [data/projection/rights and generation](RADAR_GEOGRAPHY.md).

## Automated and production-build checks

Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run format:check`, `npm.cmd run check:static`, `npm.cmd run deploy:check`, `npm.cmd audit`.

The geographic suite tests square projection corners, local scale consistency, HKG location, contained rings, required regional landmarks, sea/island separation, bounded generated geometry and pinned-source metadata, actual rendered paths/label and preserved DOM nodes. Existing visibility-listener cleanup, modal lifecycle, storage, handling, Duty and privacy regression tests remain enabled. Browser computed geometry/motion is checked separately because jsdom cannot establish layout or CSS animation behavior.

## Browser inspection

Use an isolated Edge profile against the built application on the local Workers runtime, not only Vite source. Representative sizes: **320×800, 390×844, 844×390, 1440×1000**, both languages, both themes, normal/reduced motion. Verify:

- The actual radar's width equals height; the page has no horizontal overflow. Rounded corners do not circularly clip the map.
- Projected SVG HKG, disc and icon centers coincide; label is horizontally centered below the icon. Disc/rings fit inside the square.
- Natural Earth geometry visibly distinguishes India/Bay of Bengal, mainland China, Indochina, Korea, Japan/Hokkaido, Taiwan, Hainan, Philippines, Malay Peninsula, Borneo and northern Indonesian islands. No country borders, routes or live targets are added.
- Normal motion uses the existing six-second circular sweep; reduced motion is static. Mobile dialogs pause, desktop fine-pointer dialogs retain their established motion, inactive Home/hidden document pause and resume without remounting.
- No external network requests, CSP violations or startup exceptions; switching layout/theme/navigation does not change stored records.
- Inspect actual desktop and mobile screenshots; automated coordinate assertions alone are insufficient for visual acceptance.

These are desktop browser simulations, not physical iPhone measurements or proof of a particular mobile frame rate.

## Owner's deployment and physical iPhone checklist

1. Review and commit this release only when approved; push/merge through the existing production-branch workflow. Keep Worker **app**, `./dist` and current SPA/security configuration.
2. Confirm the Cloudflare build and deployment logs succeed. Open https://app.tcologbook.workers.dev/ independently of localhost, refresh and check sidebar/mobile footer **v0.4.5 Pre-release**. A currently live v0.4.4 bundle is not evidence that v0.4.5 has deployed.
3. On physical iPhone Safari/Chrome and Home Screen launch, inspect portrait/landscape square geometry, recognizable islands, readable HKG / VHHH, scrolling and keyboard/modal behavior. Check Light/Dark, both languages and system Reduce Motion. Verify the sweep pauses/resumes appropriately; inspect smoothness on the real device.
4. Open Handling/Duty/Calendar/Journal and verify existing records, relationships, Draft/Confirmed behavior and counts after a page reload. Do not clear storage or import/reset samples to refresh the UI.
5. Check Network/Console for missing bundled JS/CSS, map errors or CSP violations. If an old version appears, inspect the active Cloudflare deployment and cache; do not clear site data as a cache fix.

The release adds no storage migration, cloud database, authentication, synchronization, new offline promise, map API or real aviation feed. Airline PNGs and unresolved permissions are unchanged. Physical iPhone and newly deployed v0.4.5 acceptance remain owner tasks.

## Recorded final results

- **370 tests passed / 26 files** (24 new geographic cases); existing tests remain enabled. Lint, production build, format:check, check:static and Wrangler dry-run passed. npm audit: **0 vulnerabilities**.
- Pinned source regeneration produces identical checked-in geographic bytes. Production bundle contains the regional vectors; source/world GeoJSON is not shipped. Final JS: 482.03KB / 160.72KB gzip, versus approximately 132.97KB gzip before the update.
- Edge/local Workers: **32 combinations**, all four sizes, both languages/themes/motion modes. Square canvas; marker/disc/Plane center errors below 0.5px; label centered below Plane; rings circular and contained; no page overflow, startup exceptions, CSP violations or external requests; modal and inactive-Home rules and original stored records preserved. Actual 390px Dark and 1440px Light radar screenshots were inspected.
- A separate real-browser sample confirms CSS sweep transforms advance while the static geographic SVG receives zero mutations; reduced-motion transform remains unchanged. No physical iPhone frame-rate claim is made.
- Existing HTTPS preview responded 200 with v0.4.4. No v0.4.5 commit, push or deployment occurred. Cloudflare/Git settings were not changed. Remaining owner acceptance: publish through the existing workflow, verify v0.4.5 at the actual origin, test physical iPhone portrait/landscape/scroll/keyboard/Home Screen and standard record workflows.
