# v0.4.4 — Cloudflare Workers Static Assets

## Current v0.4.4a hosting update

The owner committed the Worker rename to **app** in f44b9aa. During v0.4.5 development, https://app.tcologbook.workers.dev/ returned HTTPS 200 and the served bundle displayed v0.4.4. Preserve the existing Git integration and account subdomain. v0.4.5 has not been published by this session. The original no-authorization status below records the initial preparation session, not the current site availability.

## Verified repository and architecture

Source: https://github.com/kabi1119/Turnaround-Coordinator-Logbook — **public**, default branch **main**, inspected at `5d40651` before this release. `package.json`'s `private: true` prevents npm publication; it does not describe GitHub visibility. No visibility changes, GitHub Pages, commits or pushes are performed by this implementation.

React 19 / TypeScript / Vite 7, npm lockfile, Node **24** recommended (Wrangler requires >=22). `npm run build` runs `tsc -b && vite build` and emits **dist/**. All navigation is in-memory React state, not URL-based routing. SPA fallback returns the application shell for direct document navigation; it does not make tab state bookmarkable. Public asset paths are root-relative and case-sensitive. As of v0.5.0, the build also emits a root Service Worker and hash-verified offline asset manifest; see docs/V0_5_0_ACCEPTANCE.md. First use requires successful online installation.

`wrangler.jsonc` pins a supported compatibility date, names the Worker `app`, enables workers.dev/version preview URLs and points Static Assets at `./dist` with `single-page-application` fallback. There is no Worker script, database binding or backend. Name availability and the actual workers.dev subdomain remain account-dependent. No public URL has been confirmed.

**Status: configured locally; not deployed.** Wrangler reported “You are not authenticated.” No temporary account is used. Native Git integration and remote branch settings cannot be configured without the owner's Cloudflare/GitHub authorization.

## Data boundary — read before using the online origin

Localhost, LAN IP, workers.dev, preview URLs, custom domains and different browsers/devices have **separate browser-local storage**. Opening a new URL does not move or synchronize records. This release leaves schema 1, storage key, IDs, relationships, samples, privacy and Draft/Confirmed behavior unchanged. Nothing uploads Aircraft, Duty or Journal data. Cloudflare still receives ordinary static HTTP request metadata; this is not a promise of anonymous hosting.

Before changing origins, use Settings → Full JSON Backup, keep the unencrypted file private, and retain the original browser records. On the target origin, first back up any existing target records; use the existing Full JSON Restore preview and explicit Replace confirmation only if intended. Restore replaces the target database; it is not a merge. Report JSON/CSV/PDF cannot restore a database. See [backup instructions](JSON_BACKUP_RESTORE.md). No automatic migration/reset is introduced. Rolling back frontend code does not roll back browser data.

## First deployment and native Git builds

1. Sign in to your Cloudflare account in the dashboard. Use Workers & Pages → Create application → connect/import an existing Git repository (Workers, **not Pages**). Authorize the Cloudflare GitHub app only for `kabi1119/Turnaround-Coordinator-Logbook`. Do not change repository visibility. Stay on the available free plan; stop if paid approval is requested.
2. Select project name **app**, repository root `/`, production branch **main**. If the name is already used, inspect the existing Worker before replacing anything; choose and consistently update an owner-approved name if needed.
3. Use npm/lockfile dependency installation, Node **24** (`NODE_VERSION=24` in build settings if necessary), with devDependencies available. Set Build command to **`npm run check:release`**, Deploy command to **`npx wrangler deploy`**. The quality gate tests, lints, builds, checks deployable assets and checks formatting before publishing. It must succeed before the Deploy step. Do not use a Pages “output directory” workflow or add a competing GitHub Actions workflow.
4. Settings → Build → Branch control: keep **main** as production; enable preview builds for approved development branches. Use feature/release branches and a reviewed PR to main; do not develop directly on a branch that automatically publishes. For new Workers, use Cloudflare's current **`npx wrangler preview`** preview command, which does not promote to production. Existing projects may offer the older version-URL workflow; inspect settings before changing it, since switching preview models can be irreversible. `preview_urls` alone does not configure Git branch builds.
5. Review the public exposure and unresolved logo permissions below before activating the first build. After the owner commits/pushes the reviewed release, run/retry the Git build. A successful build does not prove a successful deployment: verify the deployment log, active version, HTTPS URL and acceptance tests separately. A failed build must leave the previous successful active deployment in place; confirm this in Deployments.
6. Copy the **actual** HTTPS URL from Cloudflare's successful deployment. Record it here only after browser verification. No example workers.dev hostname in this document is an asserted live URL.

The repository-side setup does not itself establish this remote connection. GitHub app installation/Cloudflare project selection and branch controls are **remaining owner actions**. Never paste passwords, OAuth tokens or API secrets into chat, frontend variables or tracked files.

## Windows commands and local simulation

```powershell
cd C:\Projects\Turnaround-Coordinator-Logbook
npm.cmd ci
npm.cmd run dev
# Production assets served by the local Workers runtime (separate terminal):
npm.cmd run cf:dev
# No account/publication required:
npm.cmd run deploy:check
npm.cmd audit
```

The simulator uses http://127.0.0.1:8787 and tests Cloudflare routing/headers. Vite development on 5173 does not apply `_headers`. Stop only your own test process after use.

For an explicitly chosen manual deployment, outside native Git auto-builds:

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
npm.cmd run deploy
```

Login uses Cloudflare's browser authorization; secrets remain outside source. `deploy` runs the complete release gate before `wrangler deploy`. It can publish uncommitted local files, so use only an owner-reviewed revision. Do not run both manual and automatic publication for the same change accidentally. `deploy:check` is a dry run, not proof of authentication, upload, remote availability or HTTPS success. Do not use a temporary preview account as a substitute for the owner's account.

## Online-preview security and asset review

The GitHub repository and the hosting endpoint are public. Obscurity, robots.txt and `X-Robots-Tag: noindex, nofollow, noarchive` are **not access controls**. If private preview access is wanted, configure Cloudflare Access separately with owner authorization and test workers.dev and all preview aliases; do not invent frontend login protection.

`public/_headers` supplies nosniff, frame denial, no-referrer, restricted camera/microphone/geolocation and CSP. Scripts are same-origin, network connections are disabled, and objects/forms/frame ancestors are blocked. Inline **styles** remain allowed for existing React sizing/positioning; inline scripts/eval are not allowed. Local/data/blob images support existing rendering without external asset services. Default Cloudflare ETag/revalidation is retained rather than indefinitely caching mutable logo filenames. Test print/report, backup/restore and image normalization against the real CSP after release. Hosting is HTTPS; no guessed custom-domain redirects or wildcard credentials are configured.

`check:static` rejects missing build files/entry assets, source maps/key-file names, common credential patterns and development/LAN HTTP URLs. This is a limited guard, not a proof of absence of secrets or confidential free text. Review source, generated files and reachable Git history as well. If a credential is discovered, revoke/rotate it; deleting HEAD alone does not remove past exposure. History rewrites require separate approval.

**All 24 airline PNG redistribution permissions remain unverified.** The owner has retained these images in the public portfolio and enabled local display. This release preserves their bytes, provenance, fallback and inventory, and the static build contains them. Their inclusion does not establish legal authorization for website redistribution. Resolve rights or explicitly choose an asset-isolation policy before public activation if that unresolved exposure is unacceptable. No logo is marked Approved/Verified, downloaded or replaced. See [asset audit](AIRLINE_ASSET_AUDIT.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

## Rollback

In the Worker's Deployments view, identify a previous successful version and use Cloudflare's rollback action; verify the active version and URL afterward. CLI alternatives: `npx wrangler deployments list`, `npx wrangler rollback <verified-version-id>`. Never guess a version ID. This changes served assets, not localStorage. A subsequent main build can redeploy the newer revision: coordinate approved follow-up changes or temporarily disable automatic builds. Do not reset/force-push Git history. Keep a backup before testing compatibility across releases.

## Troubleshooting and future origin decisions

- Build failure: use Node 24, `npm ci`, include devDependencies, inspect the first failed quality command; do not skip failing assertions. Verify root and lockfile.
- Missing assets/blank screen: inspect Network and Console, exact uppercase PNG names, deployed index/hashed JS/CSS, MIME and CSP. Rebuild before deployment; never upload source or depend on localhost. `check:static` catches common accidental development URLs.
- Direct refresh failure: confirm `assets.directory` is dist and SPA fallback enabled, and test a document navigation. With no Worker script, the platform also returns the HTML shell for missing asset paths; nosniff and text/html prevent that response from executing as JavaScript. This fallback can hide missing files behind HTTP 200, so verify exact asset URLs/MIME and check:static rather than status alone. Current tabs do not have URL routes.
- Authorization failure: sign in to the intended Cloudflare account, recheck GitHub app repository scope/account permissions, and inspect build authorization in the dashboard. Do not commit tokens. No Cloudflare API binding is needed by the browser.
- Old UI/cache: confirm active deployment/version, reload and inspect response cache/ETag; do not clear site storage just to refresh code. From v0.5.0, save work and close all app tabs/Home Screen windows before reopening to adopt a waiting worker. Do not clear site data or operational storage to refresh code.
- Missing records: verify the exact origin/profile/device. Return to the old origin and use supported full backup/restore deliberately; do not reseed or claim synchronization.

Choose a stable long-term domain **before real personal data accumulates**. Changing origin later affects storage, PWA identity, authentication redirect allowlists and WebAuthn/passkey RP IDs. Future v1.0 may add Supabase Auth (email verification, possible passkeys), PostgreSQL and cross-device synchronization; it will need separately reviewed CSP connect destinations, redirect URLs, public-vs-secret key handling and an explicit data migration plan. No Supabase project, privileged key, auth, database, telemetry or record-upload endpoint is introduced. v0.5.0 provides a device-local offline foundation; it does not add synchronization or permanent storage guarantees.

Official references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [branch previews](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/), [headers](https://developers.cloudflare.com/workers/static-assets/headers/), [rollback](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/).
