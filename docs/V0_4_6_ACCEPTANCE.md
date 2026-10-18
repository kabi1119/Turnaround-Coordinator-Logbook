# v0.4.6 — Radar scan coverage and center marker

## Scope and baseline

Started from clean main / **238bd19**, matching origin/main after the owner's historical-message cleanup. The application baseline is v0.4.5a. This task does not push, rewrite history, change Cloudflare settings or publish automatically.

Only the radar presentation, release metadata, tests and documentation change. Geographic data/projection/bounds, ring sizing, other Home cards, record/business/privacy/storage/backup logic, airline assets, PWA and Worker **app** configuration remain unchanged.

## Implementation

- Move the existing single CSS sweep outside the circular ring disc into a full-card `.radar-scan-viewport`. Its inner circular sweep has `inset: -25%`: diameter **150%** of card width, radius **75%**, exceeding the center-to-corner distance of approximately 70.71%. The beam and existing trailing fan therefore reach the four corners. The range rings remain at the v0.4.5a 92.12% outer-ring width.
- The full-card scan viewport uses `overflow: hidden`, inherited rounded corners and paint containment. The existing outer card also retains rounded clipping/isolation. A static radial alpha mask softens the scan toward the corners without removing corner illumination. No animated glow or beam should paint beyond the card.
- Keep rings, hub, Plane and HKG / VHHH in a stable layer above the scan. Their center remains the unchanged projected HKG coordinate. No map drawing, React update or geometry calculation is added per frame. The six-second CSS rotation and existing inactive/hidden/modal pause, reduced-motion and print rules remain authoritative.
- Plane rendered dimensions change from **46×46px to 25.3×25.3px**, exactly **55%**. Retain its existing styling/rotation and center; bring the label from 32px to **20px below center**, leaving a clear gap. HKG / VHHH wording stays unchanged.
- Remove the top-left **TCO Logbook / ASIA** element entirely. No replacement heading, country/city label, border or route is added. Existing bottom coordinate annotation remains.

## Verification

Run `npm.cmd run check:release`, `npm.cmd run deploy:check`, `npm.cmd audit`.

Targeted tests cover a single independently clipped scan, caption removal, preserved label and sweep DOM identity, corner-reaching radius, inherited rounded clipping, unchanged ring geometry and 55% marker sizing. Existing geographic, visibility cleanup, modal, lifecycle, data and application tests remain enabled.

Isolated Edge/local Workers production-build checks cover 320×800, 390×844, 844×390 and 1440×1000, both languages/themes and normal/reduced motion: **32 combinations**. Measure square layout, unchanged ring coverage, 55% actual computed marker width, common HKG/icon/disc center, label alignment, clipping/mask, no caption or page overflow, preserved modal/inactive rules, unchanged stored data, CSP and network behavior.

Additional screenshot comparisons use three sizes (390 portrait, 844 landscape, 1440 desktop), both themes and four diagonal sweep phases: **24 pixel comparisons**. Hide the scan for a baseline, pause the real CSS animation at 45/135/225/315 degrees, and compare rendered pixels. Require positive illumination in each corresponding inner corner patch and zero significant pixel changes outside the rounded card (excluding a small antialiasing tolerance). Inspect the actual screenshots as well as the measurements.

These tests do not establish physical iPhone frame rate. Safari's real compositor, Home Screen mode and scrolling remain owner acceptance.

## Manual acceptance and deployment

1. In iPhone portrait/landscape and desktop, watch a complete sweep: all corners should feel included, with no glow spilling beyond rounded edges or over adjacent content.
2. Check the smaller Plane remains recognizable, centered on HKG, with a clear stable HKG / VHHH label; no top-left caption should remain.
3. Confirm existing geographic framing and circle positions are unchanged. Open/close Calendar and record dialogs, switch tabs, background/resume and toggle Reduce Motion. Test real-device scroll/keyboard performance.
4. Inspect Light/Dark and both languages. Existing saved Handling, Duty, Journal, links and counts must remain available after reload; no reset/import/migration is required.
5. After an owner-approved commit/push through the existing workflow, verify the Cloudflare build result and actual HTTPS v0.4.6 sidebar/footer at https://app.tcologbook.workers.dev/. A local build/dry-run is not a deployment.

No automatic commit or push is authorized by this release request.

## Recorded results

- **377 tests passed / 27 files**, including three new scan/marker tests. Lint, build, format:check, static checks and Wrangler dry-run passed. npm audit: **0 vulnerabilities**. No dependency changes.
- The default format check initially reported 137 files because the Windows checkout uses CRLF. An end-of-line-only diagnostic passed the complete content/style check. Git HEAD bytes were verified identical for unrelated files and their expected checkout line endings were restored; Prettier endOfLine:auto now permits consistent LF or CRLF while retaining every other style check. No test or content assertion was skipped or weakened.
- All **32 Edge layout combinations** passed, including 25.3px computed marker width, unchanged outer rings, common anchor, label placement and no caption/page overflow/CSP exceptions/external requests. Existing stored records remained unchanged.
- **24 rendered screenshot comparisons** passed: each diagonal phase illuminates its corresponding corner patch, and zero significant changed pixels appear outside the rounded square. Real portrait/desktop screenshots inspected. No physical iPhone performance claim is made.
- Existing https://app.tcologbook.workers.dev/ responded HTTPS 200 and v0.4.5a. No v0.4.6 commit, push or deployment occurred; existing hosting configuration is unchanged.
