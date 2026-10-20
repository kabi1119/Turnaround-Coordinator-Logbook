# Agent Instructions — TCO Logbook

This repo is **TCO Logbook v0.6.4 Pre-release**, a local frontend personal-tool prototype, not production.

## Required reading

1. `docs/TCO_Logbook_PRD_v1.5_APPROVED.md` — authoritative approved PRD (product rules).
2. `docs/Codex_Prototype_v0.1_Prompt.md` — implementation contract and v0.1 scope.

## Non-negotiables

- Do not use real or user-specific HAS operational information. Synthetic demo data only.
- Never invent airline brand logos. Use text/IATA-code fallback unless official licensed assets are verified.
- A Full Turnaround is **one** Handling Assignment. Departure-only and Arrival-only are separate mutually exclusive handling types; all 3 contribute to Logged. Training does not contribute to Handled or Career coordinated counts.
- Preserve Arrival and Departure statuses separately; early < -15 minutes, on time from -15 inclusive to +15 exclusive, delayed >= +15 minutes; use stand/gate times, not chocks/landing/takeoff interchangeably.
- Every Aircraft save requires explicit review sheet + confirm.
- From v0.6.0, Parking Bay is free text and required for Confirm only when privacy-enabled; empty Drafts remain allowed. No catalogue restriction or automatic case conversion.
- v0.1 uses local demo storage only; do not claim cloud sync/auth/backup/privacy guarantees.
- UI: Home | Logbook | Add | Statistics | Journal; Settings separate; airplane icon; two-line Aircraft cards with Airline+FlightNo title.
- Keep project code outside OneDrive, in current repo root, and do not create nested Git repo.
- Do not start Phase 2 without explicit user approval. v0.3.0 includes only local UI, aircraft classification and explicit full JSON backup/restore; it does not authorize production/backend work.

Document decisions in `PROTOTYPE_STATUS.md` and execute relevant tests before completion.

## Permanent version and release commits

- Current agreed release: v0.6.4 Pre-release. Work only in the current Turnaround-Coordinator-Logbook repository; the former TCO-Logbook directory is retired.
- Follow [docs/VERSIONING.md](docs/VERSIONING.md): custom vMAJOR.MINOR.PATCH[letter], not strict SemVer; unrestricted numeric component widths; lowercase sequential suffixes for tiny fixes.
- Propose future versions by scope; never silently change an agreed version. Stage 0 is prototype; stage 1 requires explicit project-owner production approval. Larger feature iterations increment MINOR and reset PATCH; smaller enhancements increment PATCH.
- Release commit titles start with the version: vX.Y.Z[a] - Descriptive English Title. No feat:/fix: title prefix. Include a detailed English body covering delivered changes, compatibility and actual verification.
- Commit/push only within the current user's authorization. The v0.3.2 request does not authorize an automatic commit or push. Preserve existing changes and history.
- The owner's explicit local-PNG display policy supersedes the earlier display-only licensing gate above; all redistribution permissions remain unverified. Preserve assets, provenance and the opening README disclaimer.

## v0.2.0 presentation and samples

- Full product name only in the upper-left brand; TCO Logbook elsewhere. Release metadata belongs in the lower sidebar/footer, not an upper status strip.
- Use local SVG/CSS for the decorative approximate East Asia radar map; no map API/tiles or live tracking claim.
- Keep new sample data fictional without visible DEMO prefixes. Preserve disclosure in Settings, report notices and documentation; never strip or rewrite user-entered text automatically.
- Keep frozen historical fixtures for safe reviewed sample refresh. Only exact unchanged fixtures may be replaced; user edits and retained links block removal. No automatic reseed/reset on upgrade.
- Batch hours require valid input and final review/save, without the former chosen-hours acknowledgement checkbox. Keep duplicate/overlap handling and Planned/Worked rules.

## v0.3.0 owner-approved scope

- Latest owner instructions supersede old implicit Draft Duty creation and off-by-default fresh field preferences. Save unlinked Aircraft through mandatory review; fresh installations enable six fields, existing preferences and deleted values stay unchanged.
- Preserve native/getRandomValues UUID compatibility on LAN HTTP. New aircraftType/delayMinutes and historical impact are optional; no automatic storage migration or ID rewrite.
- Use centralized Airbus/Boeing type/variant references. Never silently rename historical/custom identity snapshots.
- Delay severity uses entered whole disruption minutes, never inferred flight causation; preserve historical operational impact independently.
- Full backups are explicitly unencrypted and separate from report exports. Strict validate/preview/confirm before atomic Restore / Replace; block unsafe versions, keys, IDs, links, stale previews and failures. Never clear storage or partially import. No PDF import or complex merge.

## v0.3.1 presentation rules

- Home action: Log a Handling Task. New/edit/review interface: Handling Record. Formal statistics: Handling Assignments. Preserve Aircraft models, backup JSON keys, local storage and all saved values.
- Use the shared non-mutating airline ordering helper: default CX/UO/LD then 21 English names A–Z; active search filters matches without pinned unrelated identities. Preserve logos, aliases and custom text.
- Duty-picker labels show work progress only: Planned → Scheduled, Worked → Worked; absent progress is explicitly not recorded. Never infer Worked from dates or change legacy statistics. Keep HK shift-start date, 24-hour times and overnight (+1).

## v0.3.2 QR integrity reconciliation

- Owner-approved QR replacement is intentional. Reconcile only QR's current byte size/SHA-256 to the actual preserved PNG; other 23 asset entries/checksums and all unverified source/permission evidence remain unchanged.
- Preserve all uncommitted normalization work and the existing integrity assertion. Never restore an old image or weaken tests to match outdated inventory. No automatic commit/push.

## v0.3.3 owner-approved calendar and leave scope

- Reuse one shared date resolver and calendar across Home, Logbook and Add Duties. One marker per day: SL/AL before unresolved Scheduled, active Scheduled and explicitly Worked. Never convert elapsed Planned records automatically; legacy absence remains unclassified in calendars and original legacy statistics remain compatible.
- Central Add → Add Duties is the creation entry. Every reviewed batch has exactly one type: Scheduled, Worked, AL or SL. Invalid/stale entries block the whole write. Keep duplicate/overlap handling and all same-day records.
- Duty.leave is optional AL/SL under schema 1. AL is date-only/no hours and conflicts require resolution. SL only classifies an eligible existing confirmed Planned duty, preserving its ID, times, notes, metadata and links; require explicit target selection if several exist. Never add Other Leave or overwrite planned information.
- Keep Scheduled, actual Worked and Scheduled SL hours separate; AL has no hours, leave does not inflate Worked or Aircraft counts. Preserve Draft/Confirmed and legacy counting semantics.
- Fictional calendar preview is dynamic and read-only, separate from saved records/statistics. Preserve stable sample-refresh fingerprints and never infer attendance or reseed on upgrade.
- Sheet transitions must retain scroll locking through close, honor reduced motion and safe areas, clean up timers/listeners and support visual viewport resizing. No automatic commit/push. See docs/V0_3_3_ACCEPTANCE.md.

## v0.3.4 owner-approved Home and calendar UI

- This UI-only refinement supersedes the v0.3.3 inline Home calendar placement. Home uses a compact Upcoming Shift card and View Full Calendar action; no monthly grid on Home.
- Reuse the full calendar/date records in a dialog with a clear return to Home, keeping month/day state across closing and duty detail/edit navigation. Keep fictional preview inside Full Calendar with its read-only disclosure.
- Shared legends use five icon-and-label groups below the grid, naturally wrapping with readable typography; neutral black/white AL/SL, separate instructions and accessible status descriptions remain.
- Do not change Duty/Aircraft models, Scheduled/Worked conversions, leave rules, Statistics or saved sample data for this release. No automatic commit/push. See docs/V0_3_4_ACCEPTANCE.md.

## v0.4.0 integration and motion

- Reuse the single authoritative database and existing selectors. Keep persisted models/schema, legacy progress, leave, counting, privacy, sample-refresh and restore rules unchanged.
- New date-based Duty auto-matching excludes leave/Trash and selects only a single unambiguous candidate. Existing or explicitly chosen/unlinked associations survive date edits; validate new links again before reviewed confirmation. Never create an implicit Duty.
- Related record navigation uses an in-session return trail and dialog scroll restoration. Visited pages retain local filters and tab scroll; navigation state is never persisted or exported. Home remains compact and Timeline remains the default Logbook view.
- Shared 150/200/180 ms CSS motion and dismissal retain scroll locking, focus, safe areas and explicit discard/review rules. Closing dialogs are inert. Reduced motion skips nonessential effects and waits. No animation library or count-up loop; statistics always display authoritative values.
- Show local success only after a successful write, clear stale success after failure, retain retryable forms and guard repeated submissions. Preserve clock isolation and radar pause/reduced motion.
- See docs/V0_4_0_ACCEPTANCE.md for audit, compatibility and regression/manual acceptance. No automatic commit/push. Release title: v0.4.0 - Integrate Duty and Aircraft Workflows with Motion Enhancements.

## v0.4.1 Home and dialog refinement

- This release supersedes the historical Home Log a Handling Task action and standalone Most Recent Duty: central Add is the general creation entry. Reuse the dark-green card for Upcoming / Today's Scheduled Shift, showing Scheduled only. Full Calendar and Logbook retain history.
- Derive current/next presentation only from eligible confirmed Planned, non-leave schedules, HKT intervals and valid dates. Incomplete hours never establish a current shift. Expose overlapping current/tied next candidates for explicit inspection; never infer Worked/In Progress or write attendance/progress. Preserve Draft inspection and existing statistics/privacy.
- Keep root scrollbar-gutter stable with the existing reference-counted modal lock. No fixed compensation offsets, forced permanent scrollbar or modal rewrite.
- CSS radar may continue behind dialogs only at desktop >=1024px with fine pointer, hover and normal motion. Coarse/mobile dialog pause remains; hidden documents and inactive Home always pause. Visibility listeners clean up; never add per-frame React updates or restart the animation on modal toggles. Reduced motion remains static. See docs/V0_4_1_ACCEPTANCE.md for measured scope and physical-device limits.
- No schema/key migration, reseed, asset/provenance change, automatic commit or push. Suggested release title: v0.4.1 - Refine Home Duty Cards and Fix Modal Layout Shifts.

## v0.4.2 Handling form and Duty status refinement

- New editor records explicitly start with no Handling Type or Role. Form order: date/Duty, airline, Handling Type, applicable flights, aircraft type/variant, role, More Details/notices/actions. Do not change historical fixtures or low-level fixture defaults to implement UI defaults.
- This release supersedes the historical optional-flight and four-core-field copy. Confirmed saves validate airline, handling, compatible aircraft type/variant, role, date and applicable privacy-enabled flights. Never validate hidden/disabled flights. Red markers/errors follow current configuration; focus the first invalid control.
- Catalogue IATA prefixes are fixed, not editable overrides. Personal input format: 1–4 digits and optional ASCII letter; matching pasted prefix is stripped once. Retain conflicting/unfamiliar values verbatim with guidance; custom airlines use full two-character code plus that portion. No new external identity lookup or invented code.
- Save Draft skips business completeness, including an empty form, but retains safe dates/IDs/references and mandatory review. New future saves stay Draft, display Pending and never auto-confirm. All Confirmed saves revalidate at final save and require explicit review attestation of actual handling. Preserve existing Confirmed snapshots and flag inconsistencies instead of demoting/reclassifying them on load.
- Preserve temporary flight/leg input on type switches; warn before a saved leg (including archived private data) becomes inapplicable. Only an explicitly reviewed type-change save clears those inapplicable values. Same-type edits preserve historical/archived values. Drafts remain excluded from confirmed statistics.
- Schema/key remain unchanged. Strict backup identity validation also accepts known aircraft type + missing variant in Draft / trashed former Draft, without weakening Confirmed identity validation or reference checks.
- Home titles now mean Upcoming (future day), Today's Scheduled Shift (today pre-start/unknown hours), Current Shift (complete active scheduled interval). Retain Scheduled label, HKT overnight start date, explicit overlapping/tied choices and distinct Next Shift; never infer actual attendance/Worked. Full Calendar closes with its existing X, retaining source/month/date; no second Return to Home action.
- Preserve v0.4.1 stable gutter and radar safeguards, assets/privacy/disclaimers, existing sample data and local-only scope. See docs/V0_4_2_ACCEPTANCE.md. No automatic commit/push. Suggested title: v0.4.2 - Refine Handling Forms and Duty Status Logic.

## v0.4.3 keyboard and form UX

- Shared Modal uses a stable header and one .modal-body scroll surface. Record return trails and nested dialogs remember this surface, never the background document. Preserve root stable scrollbar space and reference-counted body lock.
- Use the lifecycle-scoped Visual Viewport hook for height/offset fitting and focused-field visibility. No polling, per-keystroke measurements, global React keyboard state or continuous animation loop. Coalesce settling events, do not recenter visible fields, respect manual scroll, skip pinch-zoom correction and cancel all listeners/queued work on cleanup.
- Keyboard inference requires editable focus, a touch/small layout and substantial visual/layout occlusion. Do not infer it from every resize. Prefer accessible save actions flowing below content to hiding controls; native date/time/select behavior stays intact. No hardcoded keyboard height or user-zoom restriction.
- Single-line text Next/Done must not implicitly submit; multiline Notes keep newlines and IME composition is respected. Preserve alphanumeric flight suffixes and fixed prefixes. Touch airline choice must not unnecessarily refocus input; dropdown arrows scroll only their list.
- Shared behavior covers Handling, Duty/batch and Journal forms. Keep mobile editable text >=16px, portrait/landscape usability, Reduced Motion, v0.4.2 lifecycle/privacy/business rules and existing sample data unchanged. No schema/asset/dependency/backend change.
- Report physical iPhone Safari/Chrome and Home Screen PWA testing separately from Edge viewport simulations. See docs/V0_4_3_ACCEPTANCE.md. No automatic commit/push. Suggested title: v0.4.3 - Optimize iPhone Keyboard and Form Interactions.

## v0.4.4 static HTTPS hosting

- The owner authorizes Cloudflare Workers Static Assets hosting preparation/deployment only; this supersedes the historical local-hosting restriction without authorizing a backend, authentication, database or synchronization. GitHub source is public; never change visibility.
- Preserve schema, storage key, records, samples, IDs/links, all lifecycle/privacy/statistics rules and all original PNG/provenance bytes. Never migrate/reset/reseed on deployment. Different origins/devices have separate storage.
- Use wrangler.jsonc, pinned Wrangler, dist assets and no Worker script. Follow docs/CLOUDFLARE_DEPLOYMENT.md and docs/V0_4_4_ACCEPTANCE.md. Native Git main/preview branch settings require account authorization; never equate local configuration with a live deployment.
- Keep preview noindex/security headers tested against actual build, including inline React styles, print and logo normalization. No secrets in frontend or Git. Unverified airline redistribution permissions remain unresolved. No automatic commit/push or history rewrite.

## v0.4.5 radar geography

- Visual-only Home radar update: square geographic viewport, local Natural Earth 1:50m vectors and a consistent Mercator HKG anchor shared by icon, rings and sweep. Preserve CSS animation identity/duration, document/inactive/modal safeguards and reduced motion. No per-frame React/projection loop or map API.
- Preserve Worker app, wrangler.jsonc/dist/SPA/security headers, all storage/schema/IDs/relationships/business rules and airline assets. Geography is public-domain data; it does not change the source-available app policy or airline permissions. See docs/RADAR_GEOGRAPHY.md and docs/V0_4_5_ACCEPTANCE.md.
- Do not automatically commit, push or claim v0.4.5 deployment. Existing HTTPS v0.4.4 baseline and local tests are distinct from a newly verified release and physical iPhone acceptance.

## v0.4.5a radar framing

- Supersedes the previous off-center radar framing: symmetric 68-degree Mercator span around HKG, square canvas, 94% disc / 92.12% outer ring. Keep actual coordinate alignment, small equal margins, existing sweep/marker/label and all pause/reduced-motion rules. Reframe south and regenerate only the clipped local vectors; no invented coastlines or interior boundaries.
- Preserve data/business logic, airline assets, Worker app, wrangler/security/SPA configuration and existing deployment workflow. No automatic commit/push/deployment. See docs/V0_4_5A_ACCEPTANCE.md.
- UI/docs release is v0.4.5a; keep the existing numeric npm package version 0.4.5, matching the prior suffix-release package convention.

## v0.4.6 radar scan and marker

- Preserve the v0.4.5a geography/projection and 92.12% outer ring. Keep one circular CSS sweep in an independent rounded-square clip, sized to reach the corners; no glow may spill outside the card. Retain existing six-second animation and all pause/reduced-motion rules.
- Render the existing Plane at 25.3px (55% of 46px), keep HKG / VHHH centered 20px below center and remove the radar top-left caption without replacement. Preserve other Home content, records/business rules, privacy, assets and Cloudflare configuration. No automatic commit/push/deploy. See docs/V0_4_6_ACCEPTANCE.md.

## v0.5.0 offline-first foundation

- This owner-approved milestone adds production offline caching only, without auth/backend/sync or schema migration. Preserve existing record semantics, IDs, relationships, privacy and backup format. See docs/V0_5_0_ACCEPTANCE.md.
- Keep version-coherent, hash-verified bounded app-shell caching, no private/user/API caches and no forced worker activation/reload. Cache cleanup never clears operational storage. CSP may allow same-origin worker/asset fetching only.
- Require successful local persistence before success UI. Preserve retryable edits and block stale snapshots/unreadable storage. Strict reviewed single-key backup restore remains; do not claim cross-tab transactions or permanent browser storage.
- Work on feature/v0.5.0-offline-foundation. The owner explicitly authorizes a local v0.5.0 release commit only after mandatory acceptance passes. No push, merge, force-push or production deployment without separate approval.

## v0.5.1 offline UX and icon

- Preserve the v0.5.0 worker/cache/storage/backup engine. Connection status is a browser hint only, never a sync/cache-readiness claim or a reason to disable local work. No probing requests or polling.
- A waiting-update notice may be dismissed but never force activation/reload or interrupt edits. Explain saving and closing all app windows before reopening; do not announce first installation as an update.
- Original teal/white airplane SVG is the master for all app identity icons. Use the local browser/canvas exporter for PNG sizes, preserve manifest identity and all airline/provenance assets. Never clear site data to refresh an icon.
- Distinguish download requested from a saved backup file; retain strict reviewed replacement, stale-source/write-failure protection and format/schema compatibility. See docs/V0_5_1_ACCEPTANCE.md. No automatic commit, push, merge or deployment.

## v0.5.2 Home and safe-area refinement

- Preserve all v0.5.1 offline/worker/update/icon/storage/backup/business behavior. Home order is hero, prominent shift, statistics, secondary content. Phone statistics use a single column without horizontal scrolling; preserve selectors and exact Duty actions.
- Connection badge uses a 17px icon, green Online/red Offline, text plus color and existing device-only messaging. Never change detection logic or block offline work.
- Final mobile padding must retain env(safe-area-inset-top) after earlier shorthands; standalone mobile adds only 8px extra breathing room. Keep desktop unchanged. Native emulation is not physical Dynamic Island verification. See docs/V0_5_2_ACCEPTANCE.md.
- Owner's updated policy supersedes earlier final-output commit-message requirements: do not generate or suggest commit titles/bodies in development reports. Report test/Git/deployment status separately. Any separately authorized future commit description excludes test counts, build results, deployment status and "not pushed" statements. No automatic commit/push/deploy or history rewrite.

## v0.6.0 complete Handling entry

- Direct registration/Bay/applicable leg entry. Bay validation respects privacy and Draft/Pending; preserve untouched historical text and trim only edited outer whitespace. Keep local registration history, omit redundant helper/source UI.
- Reuse schema-1 leg timestamps and origin metadata. Independent HK date + HH:mm inputs; explicit edits write seconds 00 with +08:00, untouched values keep original bytes. No guessed actual times, same-day constraint, automatic flight-status claim or new counting rule. Timing suggestions require explicit adoption.
- Linked Duty itself is a semantic, focusable date/time button using the existing stable-ID return trail. Missing/trash references never navigate or get rewritten. Preserve worker/storage/backup/privacy/icons/Cloudflare configuration.
- The v0.6.0 owner request explicitly authorizes direct-to-main development and one ordinary commit/push after checks with the supplied message; it supersedes older no-commit/push guidance for this task. Fetch first, require fast-forward compatibility, stop on divergence/unrelated changes, never force-push/rewrite/merge. Do not repeat or suggest commit messages in the final report; keep test/deployment status out of commit descriptions. See docs/V0_6_0_ACCEPTANCE.md.

## v0.6.1 Home summary, icon and safe area

- Home only: one accessible dark summary card with three stacked metrics and two horizontal dividers. Preserve labels, subtitles, selector values, ordering and the separate Statistics layout. No new metric/navigation behavior.
- Original teal/white SVG side-profile airplane, centered with nose-up rotation. Regenerate 180/192/512 PNGs with the existing browser/canvas exporter, update all versioned icon references, preserve manifest identity and all airline assets/provenance. Never clear site data to refresh an iOS icon.
- Small-screen standalone header uses safe-area inset plus base 18px and extra 18px (previously extra 8px). Normal browser mobile/desktop spacing and all offline/storage/backup/handling/Cloudflare engines stay unchanged. Physical iPhone appearance remains separate acceptance.
- The current owner explicitly authorizes one supplied v0.6.1 commit and ordinary main push after essential checks, superseding older task-specific restrictions. Fetch/check scope first, stop on divergence/unrelated work/failures, never merge/force-push/rewrite. Final reports omit the supplied commit message. See docs/V0_6_1_ACCEPTANCE.md.

## v0.6.2 Home layout and standalone rendering

- Keep full-width Upcoming Shift above a Home-only B/C grid: one shared three-row stats card left, Recent Aircraft right at >=1200px; stack on narrower content. Secondary Journal comes after both. Preserve selectors, card navigation, icons and radar.
- Desktop connectivity sits alongside the clock inside the existing 88px header; mobile placement is unchanged. Standalone phones reserve one normal-flow opaque safe-area strip outside the header, with base 18px header padding. Explicit Apple status-bar default requests non-translucent presentation. Do not accumulate old standalone offsets or claim OS blur elimination without a physical iPhone.
- The current owner supersedes prior commit/push authorization: leave v0.6.2 changes local, no staging/commit/push/merge/deployment/history rewrite. Provide the owner-supplied message at the end of the final report, overriding earlier no-message reporting guidance. Use focused tests and one successful build, no repeated audit/dry-run or unrelated testing.

## v0.6.3 Home alignment and reflection

- Reuse SectionTitle for Handling Statistics / 處理統計 with the same heading row as Recent Aircraft. Keep one three-row statistics card at natural height. Grid areas place the single reflection component under stats on wide desktop, after Recent Aircraft on mobile; no duplicate rendering or positional offsets.
- Preserve v0.6.2 Header/standalone/badge, radar/icon, all navigation/data/statistics/offline/backup/Cloudflare logic. Manual commit/push only; leave changes unstaged. Use focused tests, 1440/390px browser checks and one production build, no audit/dry-run/full-suite repeats. Final report ends with the exact owner-supplied v0.6.3 message.

## v0.6.3a desktop status and Home verification

- Keep the already implemented v0.6.3 heading/card baselines and natural-height stats/reflection Grid. Verify the reflection gap with different Recent Aircraft counts rather than duplicating or rewriting correct components.
- At >=1024px only, stack Online/Offline above Device only, centered with a 3px gap; hide only the decorative separator. Mobile keeps its horizontal separator, icon/colors/text and safe-area behavior. No detection/storage/cloud changes. UI release uses v0.6.3a while the npm package remains numeric 0.6.3, following prior suffix releases.
- Manual Git/deployment only: leave changes unstaged. Final report ends with the supplied exact v0.6.3a commit message. One production build, focused existing tests and desktop/mobile checks only; no audit/dry-run/new framework.

## v0.6.3b Home palette

- Reuse surface-dark for the Home reflection and Recent Aircraft panel, plus Upcoming Shift empty/next panels, matching the existing shift/summary primary tone. Preserve layout, wording and interactions. Scope odd/even dark-surface/dark-raised backgrounds and dark-hover/focus-visible to .home-recent rows only; preserve logo light plates and visible focus outlines. No new color shades or global striping.
- Keep all Header/safe-area/status, models/calculations/records, offline/backup/worker, PWA icons/metadata and Cloudflare logic unchanged. UI v0.6.3b retains numeric npm 0.6.3. Manual release only, unstaged local changes; final report ends with the supplied exact message. One build, focused tests and desktop/mobile visual checks only.

## v0.6.4 Home insights and unfinished work

- Home lifetime count reuses established Confirmed Primary/Supporting Handled eligibility. Thirty-day rankings use today plus 29 preceding HK operational dates, exclude future records and use canonical airline/variant identities. Tie-break: frequency, latest operational date, then canonical key ascending. Missing identities never invent a winner. Keep comprehensive Statistics unchanged.
- Draft/Pending counts and Logbook status scopes reuse handlingDisplayStatus; Pending remains derived from a future-dated Draft, with no new stored state/schema. Home shortcuts reset conflicting filters and open the existing timeline. Do not blend samples with another dataset or write records to compute summaries.
- Keep one combined card, unfinished work then reflection on the desktop left; mobile places reflection after Recent Aircraft. Four desktop Recent Aircraft rows use content-driven Grid plus scoped resize calibration to remove fractional rounding; sparse lists/mobile retain natural height. Preserve palette, header/safe-area, worker/storage/backup and Cloudflare behavior.
- Manual Git/deployment only; leave all changes unstaged. Focused tests, 1440/390px checks and one successful build; no audit/dry-run or new framework. Final report ends with the exact owner-supplied message.
