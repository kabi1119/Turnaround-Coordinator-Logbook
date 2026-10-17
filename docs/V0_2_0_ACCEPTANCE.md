# v0.2.0 Pre-release acceptance

This is a local-only frontend refinement built on the existing v0.1.5a checkout and in-progress changes. No automatic commit/push, backend, auth, cloud sync or deployment.

## Design and samples

- Header only: enlarged original airplane mark and Turnaround Coordinator Logbook. Other contexts: TCO Logbook. The upper status strip is removed. Desktop release/device/Hong Kong metadata lives at the bottom of the sidebar; tablet/mobile use a compact lower content footer.
- Local hand-drawn SVG silhouettes approximate East/South China, Korea, Japan, Taiwan, northern Philippines and Vietnam. The map's 600×400 coordinate system and 3:2 container share the Hong Kong anchor (220,260) with the plane/radar center (36.667%,65%). This is decorative, not navigation/GIS/live tracking. CSS sweep, reduced-motion and modal pause remain; no external maps or tile requests.
- Four assignments provide six applicable legs: two Full Turnarounds, one Arrival Only and one Departure Only. This is the smallest practical collection covering all six status categories while retaining both single-leg types. Roles: two Primary, one Supporting, one Training/Observation. Counts derive from rows: Logged 4 / Handled 3 / Primary 2.
- Three duties: worked day and overnight shifts plus one Planned shift. Two journals: linked and standalone. Samples include actual, scheduled-only and missing times, two aircraft under one duty, custom bay NORTH-REMOTE and a linked disruption. A cancelled departure follows actual coordination; it is not a cancelled-only flight counted without handling.
- Flights and X-TCL registrations are invented examples. They do not assert real operations, valid actual registrations, employer customer relationships or official roster hours. Settings and report notices retain a concise fictional-data disclosure. Sensitive fields remain off by default.

## Data compatibility

Storage key tco-logbook-demo-v0.1 and schema version 1 remain unchanged; no automatic migration, storage clear or reseed runs. Existing data loads as stored. Settings → Refresh sample records shows removals/additions across aircraft, duties and journals before explicit confirmation. Complete equality to known frozen legacy/v0.1.4/current samples is required; IDs or text labels alone never establish identity. User edits, duplicate IDs and personal references to removed parents block the whole transaction. Unrelated personal records and settings remain. Repeated refresh does not accumulate samples or break links.

Existing user-entered or edited old DEMO text is never silently stripped; it may remain visible until the owner reviews it. Use the safe sample refresh for untouched old samples. Load sample records / Clear local records are separately confirmed replacement actions and should not be used on mixed collections. Reports remain sanitized summaries, not complete backups; no new import/restore facility is implied.

The owner's already committed v0.1.5a LH image replacement and existing inventory/bounds corrections are retained. This release does not modify/download PNGs or approve redistribution rights. Opening README disclaimer and source-available/non-open-source terms remain.

## Acceptance workflows

1. Run npm.cmd run dev in C:\Projects\Turnaround-Coordinator-Logbook, keeping the same origin/port for existing storage. Verify full header name, short names elsewhere, no upper strip, subtle lower metadata and Settings access at desktop/tablet/mobile widths.
2. Inspect the map and Hong Kong plane/radar anchor in both themes. Enable reduced-motion: sweep is static. Open a modal: sweep pauses. No external map requests.
3. Fresh sample Home shows 4/3/2. Enable fictional optional fields in Settings; inspect actual AIBT/AOBT, scheduled-only and missing-time cards/details. Check independent Early/On Time, Delayed/Cancelled, Not Recorded and Other legs; check overnight grouping and linked/standalone journals.
4. Batch Add Duties: select dates, enter custom hours and apply immediately without an acknowledgement checkbox. Review before saving; overnight end date is correct. Exact duplicates require resolution; legitimate overlaps still require explicit override. Planned shifts do not increase Worked Duty counts.
5. Refresh unchanged historical samples using Settings; Cancel writes nothing, Confirm produces the compact collection and repeat refresh is a no-op. Check custom records and preferences survive. Edited samples or personal links must show blockers and remain unchanged. Never use the full replacement buttons to test mixed-record preservation.
6. Switch English/繁體中文 and Light/Dark; verify all five navigation items, add/review/save, details, roster, Journal, privacy and export preview. Fresh sample UI should not display DEMO wording; user-authored historical text remains as entered.

## Verification

- Automated regression: 131 tests passed across 13 files; lint, TypeScript/Vite production build and format check passed. No new dependency.
- Edge with an isolated synthetic profile: 375 / 390 / 430 / 768 / 1024 / 1440 / 1920 px in both Light and Dark (14 layouts). No horizontal overflow; brand, clock and Settings fit. Aircraft icon and radar center match the Hong Kong anchor within one CSS pixel. Representative desktop/mobile screenshots were visually reviewed.
- Browser workflows: reduced-motion disables the sweep; batch overnight review/save works without hours acknowledgement; aircraft review leaves storage untouched until confirmation; safe refresh preserves custom aircraft/duty/journal rows and links, cancellation writes nothing and repeat refresh is a no-op. English and Traditional Chinese checked. No application runtime errors or external HTTP asset requests observed.
- Browser checks use synthetic data only. Real iPhone/Safari, physical touch, screen readers and universal hardware performance require separate manual acceptance. This is not production deployment or authoritative radar/clock verification.

## Recommended commit (not executed)

v0.2.0 - Refined Pre-release UI and Fictional Sample Records

Refine the local personal-tool presentation with a full-name header brand, quiet footer metadata and an original SVG East Asia radar map. Replace fresh showcase data with four fictional assignments covering core manual-test scenarios. Add reviewed, idempotent sample refresh while preserving custom records and blocking unsafe linked replacements. Remove repetitive DEMO labels and the batch hours acknowledgement while retaining Aircraft review, roster conflicts, privacy and Planned/Worked rules. Document actual checks and remaining device limitations. No backend, cloud service, deployment or automatic commit/push.
