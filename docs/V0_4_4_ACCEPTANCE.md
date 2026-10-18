# v0.4.4 — Online preview acceptance

## Scope and evidence

Repository preparation only until an authenticated Cloudflare deployment and its HTTPS URL have been verified. Native Git configuration is documented, not remotely applied. No backend, schema migration, record rewrite, authentication, service worker, paid plan, automatic Git commit or push.

## Local checks

Run `npm.cmd ci`, `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run check:static`, `npm.cmd run format:check`, `npm.cmd audit`, `npm.cmd run deploy:check`. Run `npm.cmd run cf:dev` to verify the real static-asset runtime/headers, document fallback, JS/CSS/PNG MIME and local browser data persistence. A simulator is not a verified public HTTPS deployment.

## Owner's online acceptance (use fictional information)

1. **Independent launch:** record the actual successful Cloudflare URL; stop the Windows dev server; open HTTPS on iPhone Safari using mobile data. Confirm Home, JS/CSS/logo assets and v0.4.4 without startup errors. Repeat on Windows Edge/Chrome. Directly open and refresh a document path; the SPA shell should load (tabs remain in-memory).
2. **Handling persistence:** central Add → New Handling Record → enter fictional data → Save Draft → mandatory Review → Confirm & Save. Reload/close/reopen the same origin: Draft remains Draft, future Pending remains a Draft, no automatic confirmation. Complete a valid record through explicit actual-handling attestation and confirm counts once. Inspect AIBT/AOBT and independent arrival/departure statuses.
3. **Duty/calendar:** add/edit a Scheduled duty, test overnight month boundary, batch entries and explicit review; inspect linked Aircraft/Journal return navigation, calendar and statistics. Never infer Worked from elapsed time; leave remains separate. Reload and check IDs/links/counts.
4. **Device/origin separation:** open the same HTTPS URL on Windows and iPhone. Records do not synchronize. Existing localhost records remain only on their old origin. To transfer, back up both databases, use Full JSON Restore preview and explicitly approve replacement on the target; never use report exports for restore.
5. **UI regression:** English/Traditional Chinese, Light/Dark, reduced motion, narrow portrait/landscape, large text, modal scrolling, keyboard Next/Done, native date/time controls and safe areas. Test Safari Home Screen launch where supported; offline launch is not guaranteed. A physical iPhone is required for actual keyboard/PWA acceptance.
6. **Reports/privacy:** render all logos/fallbacks, print/PDF, CSV/report JSON and full backup; inspect CSP errors and Network for unintended external loads. Hidden values and full unencrypted backups retain existing privacy limitations.
7. **Updates and rollback:** merge an owner-approved feature-branch change to main, confirm quality gate/deployment succeeds, verify actual HTTPS change and unchanged saved data. A failed quality build must not replace the last successful deployment. Review a previous successful version, explicitly roll back and verify active assets/data; do not rewrite Git history.
8. **Exposure:** inspect bundled fictional samples, opening README disclaimer, notices and unresolved logo permissions before publication. `noindex` is not private access. Confirm any separately requested Cloudflare Access protection on every URL.

Record each as pass/fail/not tested, browser/device/version and actual URL. Do not equate Edge emulation with physical iPhone testing, or a dry run with live deployment.

## Recorded local release verification — 2026-10-19

- Clean-install npm ci succeeded. Tests: **346 passed / 25 files**; lint, build, format:check and check:static passed; npm audit: **0 vulnerabilities**. Eight deployment tests exercise the guard against missing entry files, maps, development URLs and credential output, plus SPA/no-backend configuration and CSP policy. Existing lifecycle/data tests remain enabled.
- Wrangler 4.151.1 deploy --dry-run succeeded with 35 static asset files and no bindings. whoami reported not authenticated. No public deployment or HTTPS/device verification occurred.
- Isolated Edge against local Workers: 24 layout checks at 375/1440 pixels, Light/Dark, five-tab navigation; mandatory reviewed blank Draft save; reload/direct-document navigation; previous fixture records/IDs preserved; zero runtime exceptions and zero CSP violations. This release-specific browser matrix used English; automated regression retains bilingual coverage, while deployed Chinese/real-iPhone checks remain owner acceptance.
- Local HTTP checks: root/deep document, manifest, icon, robots, compiled JS/CSS and security headers. All 24 served PNG hashes match the retained inventory. Missing asset paths also return SPA HTML 200 (documented platform behavior without a script); nosniff/MIME blocks execution as JavaScript. No backend was added to alter this behavior.
- Source/history audit: 162 initially tracked files, 429 reachable historical text blobs scanned for common key/token/secret-assignment patterns; no matches. No root .env files and no configured Cloudflare credential variables were present. Manual source review confirms fictional bundled examples, local persistence and no record-upload implementation. This limited scan cannot prove absence of confidential free text or unreferenced remote history.
- Historical privacy finding: b68fe8d and 7606ddc contain one non-noreply author/committer identity. The value is deliberately not republished here. It is already part of reachable public history; owner should review its exposure. No automatic rewrite/deletion is authorized or performed.
- Existing third-party risk: all 24 airline PNG redistribution permissions remain unverified. Files/inventory/provenance were not changed; the deployment includes them under the existing owner display policy. Public-site activation does not grant rights. README independent-project and source-available notices remain intact.
- npm ci notes deprecated ESLint 9 support and package install-script notices for new esbuild/workerd tooling. Actual build/emulation/dry-run succeeded; no business test was weakened or skipped.
