# v0.5.1 — Offline UX, updates and app icon

Baseline: clean main, 0e05392 (v0.5.0). Work branch: feature/v0.5.1-offline-ux. No commit, push, merge or deployment is authorized by this task.

## Delivered scope

- An original vector master, public/airplane.svg: deep teal rounded square, large white airplane pointing upper-right, subtle gradient, no text/radar or third-party branding. Favicon, header identity, Apple touch icon and manifest icons share this design. Opaque 180/192/512 PNG backgrounds avoid transparent corners on Home Screen. App name, manifest id/scope/start URL remain unchanged; no new maskable purpose is claimed.
- Reproduce PNGs with npm.cmd run dev, then open /scripts/generate-app-icons.html on the local dev server. Export each size and save the matching file in public/assets/pwa/. This developer-only browser/canvas exporter is not copied to dist. Versioned icon URLs encourage refresh but cannot force an installed iPhone icon to update.
- A small bilingual Online / Offline · Device only label below the clock. It follows browser online/offline/pageshow/visibility events, sends no probe requests, blocks no functionality and does not indicate synchronization or cache readiness. Event listeners are cleaned up; clock updates remain isolated.
- A bilingual, dismissible Update ready notice for an actual waiting replacement, including a worker that was already waiting on launch. Save work, close **all** app tabs/Home Screen windows, then reopen. Dismissal lasts for that candidate during the current mounted session; a different candidate can notify again. First installation is not an update. There is no activate/reload action, skipWaiting, activation message or forced navigation; the v0.5.0 worker is unchanged.
- Export result means **download requested**: users must save/check the JSON in Files/Downloads. Successful restore explicitly identifies local replacement and unchanged other devices. File selection is preview-only, Cancel preserves current records, and unreadable/stale source messages advise retaining site data. Existing strict validation, confirmation, preview/retry, backup format and storage protections remain.

## Focused acceptance

1. Run npm.cmd run check:release and npm.cmd audit. No new dependencies.
2. Check PNG dimensions, versioned Apple/manifest/favicon wiring and SVG/PNG appearance. Inspect compact and desktop header layout in both themes/languages.
3. Install production assets online in an isolated native browser; disconnect, reload, save/reopen/edit a Handling Draft and a Duty. Confirm local IDs/status/relationships and statistics remain correct; reconnect and verify the connection hint changes.
4. Simulate a next worker with a form open. Verify waiting notice, retained edits, safe dismissal, no forced activation and activation only after old windows close. Verify records and unrelated caches survive.
5. Export backup and inspect download wording. Reject malformed JSON without writes, review a valid restore, require acknowledgement, simulate write failure/retry and verify the local restore result.

## Recorded verification — 2026-10-19

- Release gate: **392 tests / 29 files passed**, including 7 new focused tests and stronger existing backup-result assertions. Lint, production build, static guard and format passed. npm audit: **0 vulnerabilities**. Wrangler dry-run passed; no deployment.
- Native isolated Edge / local Workers: 33 cached assets; manifest accepted. Desktop 1440/light and mobile 390/dark plus 320/Traditional Chinese passed header/icon/connection checks, without overflow or connection-driven header height changes. Desktop/mobile screenshots and the 512px icon were visually inspected.
- With the actual HTTP server stopped: offline reload, existing data/navigation, reviewed Draft creation/edit/reload, unchanged confirmed counts, Planned Duty edit, full backup export, malformed rejection, confirmed valid restore and quota failure/retry passed. No observed startup exceptions in the successful workflow.
- Native next-worker simulation: reconnect hint, Calendar, waiting notice with an unsaved form intact, successful reviewed save, Dismiss without activation and activation only after closing the old client passed. Records and unrelated cache survived; only obsolete owned cache was removed.
- Existing worker source, storage/schema/business rules, Cloudflare configuration and all 24 airline assets/provenance are unchanged. v0.5.1 remains uncommitted on the local development branch, with no push/merge/deployment or physical iPhone test in this session.

## Limits and owner checks

The owner reports v0.5.0 passed physical iPhone Add to Home Screen and airplane-mode Draft testing. This does not verify the new v0.5.1 icon/status/update UX. Test the new version on a physical iPhone after an authorized release: light/dark, English/Traditional Chinese, airplane-mode relaunch/save, reconnection and waiting-update instructions.

Apple may retain an old Home Screen icon despite versioned links. Back up first; check the new icon in Safari and consider adding a separate Home Screen shortcut. Never clear site data or uninstall as a casual icon-refresh workaround; local records are not cloud-backed. Browser storage/cache retention is not guaranteed.

An already open v0.5.0 page still runs the old UI and cannot show the new v0.5.1 notice. Save and close all its windows once before reopening into v0.5.1; the new notice then explains subsequent waiting updates. Dismissal is session-only and may appear again on a later visit while the same update is still waiting.

The connection hint is intentionally approximate ([navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)); a LAN connection does not prove internet access. Updates use the browser's [waiting worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/waiting) lifecycle. No polling, cloud/auth/backend, record uploads, storage migration, worker-cache redesign or aviation business-rule changes.
