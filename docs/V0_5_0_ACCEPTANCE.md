# v0.5.0 — Offline-first foundation

Local development branch: `feature/v0.5.0-offline-foundation`, baseline `1cf8cbf` (v0.4.6). No production push, merge or deployment is authorized.

## Architecture and safeguards

- Production-only root Service Worker. Vite emits a bounded asset manifest from the actual dist output: HTML, compiled JS/CSS, app icons, 24 local airline PNGs and notices. Each download must match its build SHA-256 before installation succeeds. Failed installs discard only their candidate cache and keep the prior worker.
- Cache names depend on all asset bytes, worker source and response-header policy. Navigations and known assets use the active generation. An evicted entry is repaired only with matching bytes; unavailable/mixed generations return an explicit 503. No arbitrary runtime/API/operational-data caching, background sync or upload.
- No skipWaiting, clients.claim or forced reload. Updates wait until old controlled windows close. Save drafts and close all app tabs/Home Screen windows before reopening to adopt a waiting update. Reload alone can retain the old version. Activation deletes only obsolete `tco-logbook-shell-v1-` caches, never localStorage or other apps' caches.
- Registration/installation failures show a bilingual critical notice. CSP permits same-origin worker/asset connections only; sw.js is revalidated. PNG PWA/Home Screen icons are native rasterizations of the existing airplane.svg. Development mode does not register a worker.
- Schema 1, storage key, IDs, links and backup format 1 remain unchanged. Writes validate the serialized shape/unique record IDs, reject a changed raw snapshot or unavailable initial read, and update UI/success only after setItem succeeds. Cross-tab storage events warn without replacing in-memory edits. This is a conservative stale-page check, **not** a cross-tab transaction or a guarantee against simultaneous races.
- Restore retains strict parse/preview/confirmation and stale-preview checks, then replaces one localStorage key. Invalid input or failed writes preserve the stored copy. This is a single browser API write, not a transactional multi-key database. Backup export blocks unreadable/stale browser data rather than exporting fallback samples as if they were the user's records. Full backups remain unencrypted.

## Mandatory lean acceptance

A. Run `npm.cmd run check:release`: tests, lint, production build, static guard and formatting.

B. Production build in an isolated browser: load online, await complete worker installation, disconnect network, reload/reopen. Confirm shell/assets/records/navigation load from the offline cache.

C. Offline: save a blank Handling Draft through mandatory Review, reopen/edit/reload and verify ID/content/status persistence. Edit a Duty while retaining its work/status classification. Drafts remain excluded from confirmed counts.

D. Export a full JSON backup, restore valid data through preview + explicit confirmation, reject malformed JSON and verify no database change.

E. Simulate storage quota failure: no saved-success indication, no database change, review/edit values remain retryable; retry creates only one record. Test stale-tab and unreadable-source protection.

F. Smoke Home, Logbook, Statistics, Journal, Calendar and Handling/Duty interactions. Verify update waits while a form is open, then activates on a new visit after old windows close, without changing local records or unrelated caches.

## Recorded verification — 2026-10-19

- A: 385 tests / 28 files passed; lint, production build, static guard and format passed. npm audit: 0 vulnerabilities. Wrangler static dry-run passed; nothing deployed. The browser-discovered redirect fix required one additional build; no repeated cosmetic build cycles.
- B–C: isolated native Edge / local Workers, 33 installed assets including all 24 airline PNGs. Stopped the HTTP server, then reloaded offline. Existing records, navigation, reviewed blank Draft creation, edit/reload, stable IDs/status and unchanged confirmed counts passed. Duty edit retained Planned classification; Calendar smoke passed.
- D–E: real UI exported all data/settings, rejected malformed JSON without any write, required acknowledgement and restored valid full backup; reload retained it. Injected quota failure caused no false success or overwrite; retry retained content without duplicate creation. Unit tests cover stale tabs/unreadable storage.
- F/lifecycle: a simulated next worker waited with the unsaved form and data unchanged. After closing the old tab it activated, cleaned only old owned cache and retained an unrelated sentinel cache and the complete stored database. Zero observed page startup exceptions in the successful offline workflow.
- Cloudflare redirects /index.html to /. The worker converts a redirected verified response into a fresh response with the same bytes/status/headers before caching; unit and native offline acceptance cover this transport detail.
- This is desktop native-browser acceptance, not a physical iPhone or newly deployed HTTPS verification.

## User notes and limits

First use must be online until all offline assets install. Offline availability depends on browser Cache Storage/localStorage support and retention; clearing site data, private browsing, eviction, device loss or OS policies can remove it. Keep full JSON backups privately. No claim of permanent storage, cloud backup or cross-device sync. Localhost, LAN, Workers URL and other devices remain separate origins/stores.

The owner must separately test physical iPhone Safari/Chrome, Add to Home Screen, airplane-mode relaunch and OS eviction behavior. Desktop automation is not real iPhone verification. v0.5.1 may add noncritical status/update UI and capacity guidance; no essential data safety is deferred.

Existing Cloudflare Worker `app`, static `./dist` and Git deployment workflow are retained. A local release commit is authorized only after A–F pass; no push/production deployment without further approval.
