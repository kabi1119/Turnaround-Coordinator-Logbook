# v0.6.1 — Home summary, icon and safe-area refinement

Baseline: clean main / a590dc9 (v0.6.0), matching origin/main. The owner authorizes one ordinary commit with the supplied message and a normal main push after essential checks. No force push, history rewrite or merge.

## Scope and data safety

- Home reuses the same Metric components and authoritative selector values inside one named summary region, stacked on desktop and mobile with two horizontal dividers. Each row retains title, value and explanation. Existing metrics had no click handler; no new navigation or misleading button is added. The separate Statistics screen is unaffected.
- The original local SVG is the master: deep teal rounded square, white side-profile transport silhouette and uniform -25-degree nose-up rotation. Visible white bounds are centered; the existing developer-only browser/canvas pipeline exports opaque 180/192/512 PNGs without stretching. Favicon/header, Apple icon and manifest references use v0.6.1. App name, manifest id/scope/start URL and purpose remain unchanged. No airline images or provenance are changed.
- At <=767px in standalone display mode, header top padding is 36px + env(safe-area-inset-top): existing base 18px + extra 18px, compared with extra 8px before. Normal mobile browsers remain 18px + inset; desktop is unaffected. This uses the existing small-screen installed-app condition, not user-agent sniffing or a global margin.
- No schema/key/record/ID/link, selector, business rule, handling form, Service Worker algorithm, storage safeguard, backup format, dependency graph or Cloudflare configuration change. No reset/reseed/cloud/auth/upload.

## Focused acceptance

1. Check Home in English/Traditional Chinese and Light/Dark at 320/390/1440px: one grouped card, three rows/two dividers, readable labels/subtitles/numbers, no horizontal scroll, unchanged metrics and Home ordering. Check Statistics retains its layout.
2. Inspect icon at 32/48/180/512px, verify all PNG dimensions and SVG/Apple/manifest wiring. The plane should be centered, legible and point upwards toward the right.
3. Check normal browser and standalone header spacing with zero and a representative 59px safe inset; installed small-screen extra should be 18px, without affecting desktop. Report any forced media condition separately from physical PWA testing.
4. Build/install in an isolated native browser, stop the local server, reload offline and perform reviewed Handling Draft save/reopen. Verify v0.6.0 Bay/time/Duty flows remain covered by regression tests.
5. Run test/lint/build/static/format and npm audit; use a dry-run for static deployment validation. After the authorized main push, report actual Cloudflare check and HTTPS results independently.

## Device and icon limits

No physical iPhone is available in this environment. Safari/Chrome, Dynamic Island appearance, Home Screen cropping/caching and keyboard interactions need owner acceptance. Native Edge mobile viewports do not constitute physical-device validation.

iOS may retain an old Home Screen icon even with versioned asset URLs. Save work, make a private full JSON backup and follow the existing waiting-update instructions (close all app windows, then reopen). Never clear site data or casually uninstall the app to refresh an icon. Local records are browser/origin-specific and are not cloud-synchronized; storage/cache retention is not guaranteed.

## Recorded verification

- **412 tests / 32 files passed**. Lint, production build, static guard and formatting passed. npm audit: **0 vulnerabilities**. Wrangler dry-run validated 40 static files with no bindings. Dependency package entries are unchanged.
- Native isolated Edge/local Workers passed **12** English/Traditional Chinese, Light/Dark, 320/390/1440px layout combinations. One shared card, three vertical rows/two horizontal dividers, readable >=12px explanations, unchanged 04/03/02 sample counts, no horizontal overflow and unchanged aircraft/Duty records. Separate Statistics retains its original three-column layout. Actual summary/header/icon screenshots were inspected.
- Native safe-area override of 59px gives normal mobile 77px header padding. Edge cannot natively emulate standalone display mode here; explicitly forcing only the existing stylesheet media condition verifies 95px with the same inset and 36px with zero inset, while desktop remains 0px. This is a CSS acceptance simulation, not physical standalone-PWA or Dynamic Island validation.
- Original SVG exports at 180/192/512px have centered visible white bounds (512px: x75–435, y169–341) and no proportional distortion. All app icon references use v0.6.1; manifest identity and the 24 airline assets/provenance are unchanged.
- With the actual server stopped, the production shell reloads offline. An empty Handling Draft still requires review, persists/reopens with the same ID, does not change existing records or confirmed metrics, and direct linked Duty navigation works offline. No observed startup exceptions. Existing v0.6.0 handling/time/Bay/privacy/review/backup regressions remain covered by the passing suite.
- Git publication and actual Cloudflare/HTTPS verification are reported separately after the authorized push. No physical iPhone test was performed.
