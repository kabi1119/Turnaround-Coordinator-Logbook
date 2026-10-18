# v0.4.2 — Handling Form & Duty Status Refinement

## Audit and scope

Started on clean `main`, HEAD `50a7c35` (v0.4.1). Reused the existing React state/database, airline catalogue/combobox, type/variant controls, shared native Modal/sheets, privacy controls, selectors and full calendar. Existing functionality already supported incomplete Drafts, review, separate legs, local IDs/storage and schedule grouping; this release refines those paths rather than introducing new infrastructure.

No backend, login, cloud, deployment, dependency addition, sample replacement, asset/provenance change, automatic commit or push. README's opening independent-project disclaimer and source-available rights remain. v0.4.1 stable-gutter, nested lock, animation and radar safeguards are retained.

## Form and conditional validation

Desktop order is date/Duty (two columns), airline (full width), Handling Type (full width), applicable flight numbers, aircraft type/variant (two columns), Role (full width), More Details/notices/actions. Narrow screens stack the paired controls. No empty flight row exists before Handling Type selection. New editor records begin with blank type/role; historical fixtures and low-level fixture defaults remain unchanged. Type options are Full Turnaround, Arrival Only, Departure Only, with an explicit placeholder.

Confirmed saves validate date, airline, handling, aircraft type/variant and role, plus applicable privacy-enabled flights. A separate non-mutating validator keeps these new save rules distinct from legacy loading/statistics. The summary and per-field red errors update with the actual configuration, use accessible control labels/descriptions and focus/scroll the first invalid control. Required asterisks use a theme-aware danger token, without HTML required attributes blocking Draft. The top explanation replaces obsolete four-core-field copy. Existing custom aircraft snapshots remain editable; invalid new type/variant pairs remain blocked.

Only applicable legs participate in validation, review and status controls. New records do not save inapplicable leg data. Unsaved input survives switching back before saving. Changing a saved type warns before discarding inapplicable flight/status/time values, explicitly including archived values, and Cancel preserves the type. Those values are cleared only by an explicitly reviewed type-change save. Same-type edits retain historical inapplicable/archived values; shared search does not expose inapplicable flight numbers.

## Fixed IATA prefix policy

Prefixes come from the existing catalogue/reference lookup, including existing recognized historical aliases. No lookup network request, invented code or licensing change occurs. Known prefixes are non-editable text adjoining the input. The app's documented personal input format is **1–4 digits, optionally followed by one ASCII letter**; this is not a claim of a universal airline operational standard.

Matching pasted full values normalize once (`CX450` → CX + 450), and digit/suffix portions remain independent across legs and airline changes (`CX450` → `UO450`). Intermediate typed airline search text retains the last recognized identity for safe conversion once a new known identity is selected. Prefix-only, conflicting and unfamiliar values remain verbatim with guidance, block Confirmed completeness and remain preservable as Draft. They are never guessed/truncated or silently rewritten to another airline's identity. A custom airline without a known code uses an explicit full-number path: two user-entered alphanumeric code characters + the same numeric portion/suffix. No fixed code is fabricated. Untouched unfamiliar legacy values remain available for correction or Draft saving.

## Draft / Pending / Confirmed

- Save Draft bypasses business completeness, allowing no airline, handling type, flights, type/variant or role, and supports the existing undated Draft path. It clears business-validation errors, preserves entered applicable values and still requires Review → Confirm & Save. System IDs/metadata, date validity, new Duty/Journal references, successful local writes and repeated-submit protection remain.
- An empty business Draft appears as **Untitled Draft** in cards/details, remains accessible to Edit, and contributes zero confirmed Handling totals.
- Future HK dates cannot be saved through Confirmed actions. Future Drafts display **Pending** in cards, details and review, while serializing status Draft. Passing a date never confirms a record or writes attendance/progress.
- Later manual completion requires valid applicable enabled fields, a non-future HK date, the mandatory Review Sheet and a fresh explicit checkbox attesting that handling occurred. Final confirmation revalidates live date/privacy/links before writing. Failed writes retain the same ID, review and retryable values without success; repeated submission does not duplicate a saved assignment.
- Legacy Confirmed snapshots are not demoted, deleted or reclassified on load. Current-rule inconsistencies are flagged in details for owner review. Their existing counting semantics remain compatible; new saves/transitions enforce the new restrictions. No automatic inference of actual work is introduced.
- Full Turnaround remains one assignment; existing role/training, independent leg statuses, leave and actual-work calculations stay unchanged. All newly saved Confirmed handling explicitly records actualHandling true; Draft/Pending/Trash remain excluded.

## Privacy and compatibility

Disabled flights are hidden, unrequired and absent from validation/review. New saves do not collect them. Same-type edits preserve previously archived values from the original snapshot; changing airline while flights are disabled does not rewrite those archived values. Re-enabling privacy during review requires current-field revalidation instead of submitting stale data. Existing privacy-reviewed cards, search, Statistics and reports retain their controls. Explicit full unencrypted backups intentionally retain archived values, with their existing separate disclosure.

Stored schema, key, record fields, IDs, Duty/Journal links and backup envelope remain unchanged. Local loading stays permissive and non-destructive. Strict backup identity validation now accepts a known aircraft type with missing variant for Draft or trashed former Draft only; Confirmed identity and orphan/duplicate checks remain strict. This is needed because the newly emphasized incomplete-Draft flow must remain restorable. Use v0.4.2+ to restore such partial structured Drafts; an older strict validator may reject them. No migration, reset, reseed or ID rewrite runs.

## Home and Full Calendar

The existing schedule selector is reused by a small non-mutating presentation helper. Eligible schedules remain confirmed Planned, non-leave and valid HK dates. No current interval and a later date → Upcoming Shift; a same-day pre-start/unknown-hours candidate → Today's Scheduled Shift; `start <= now < end` for a complete scheduled interval → Current Shift. The primary retains Scheduled, never a verified attendance or Worked claim. When a primary today/current group exists, Next Shift contains the following eligible group, excluding all primary IDs. No empty secondary is rendered. All overlapping current/tied start candidates stay individually accessible. Overnight intervals retain their HK shift-start date, including month boundaries. Ending an interval advances presentation without writing actual hours or progress.

Full Calendar removes only Return to Home and its wrapper spacing, retaining the existing X, month/date selection, return source, historical duties, detail navigation, one date marker, AL/SL precedence and shared legend. Existing synthetic saved samples already have explicitly Worked past duties and Planned future duties; the separate fictional preview stays read-only. No real Scheduled record is converted based on its date and no empty calendar date is populated.

## Acceptance coverage

| Owner cases                                                         | Automated evidence                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1–11 layout, explicit type choice and applicable legs               | `v042` form/order/type cases; responsive browser matrix                                                         |
| 12–18 prefixes, paste, change and custom/legacy paths               | `v042` normalization/conflict/prefix/custom cases; browser workflow                                             |
| 19–26 red markers, specific errors, focus and privacy               | `v042` validation/privacy/stale-review cases; browser theme checks                                              |
| 27–37 incomplete Draft, review, IDs, Edit and counts                | `v042` empty/partial Draft, backup and lifecycle cases; retained `ui`, `v040` repeated-submit/persistence cases |
| 38–43 future block, Pending and manual completion                   | `v042` date/revalidation/manual completion/failed-write cases                                                   |
| 44–54 Home time titles, next group, overnight and retained removals | `v042`, retained `v041`/`v034` schedule/integration cases                                                       |
| 55–60 Calendar X/selection/markers/data                             | `v042`, retained `v033`/`v034` and reactive `v040` cases                                                        |
| 61–66 compatibility, themes/languages and full regression           | Full suite, quality commands and isolated Edge checks recorded below/status                                     |

Existing workflow tests now choose the explicitly required type/role/flights and operate the actual attestation checkbox, keeping original review, privacy, duplicate, storage, failure and return-state assertions. Removed Calendar actions are replaced with its real X. No production validator is bypassed, assertion weakened, test skipped or fixture data replaced.

## Owner manual acceptance

1. Central Add → New Handling Record: inspect field order, blank type/role, option order and top required explanation. Save & Close should list actual missing fields and focus the first. Correct one field at a time and check errors clear. Repeat both languages/themes on desktop and narrow mobile.
2. Choose each Handling Type. Check only applicable flights/statuses; switch back before saving and recover temporary numbers. Edit a saved Full Turnaround with both legs: Cancel the type-change warning, then explicitly change and review. Confirm a single updated record ID and no inapplicable submitted leg.
3. Select CX, enter 450 / 451A, paste CX450 and change to UO. Inspect fixed prefixes, retained portions and reviewed full numbers. Try prefix-only, conflicting UO450 while CX is selected and unfamiliar historical text; Confirmed must be blocked, Draft must preserve the text. Test the full-number custom-airline path.
4. Save an entirely empty/undated Draft through review, inspect Untitled Draft and Edit, then try a type-only partial Draft. Export/preview its full backup using an isolated test profile. Never restore over wanted records without a separate backup and explicit approval.
5. Save a fully populated future Draft: Pending, no confirmed-count increase. Reopen later with a non-future date, complete fields and review. Confirm & Save must remain disabled until explicit actual-handling attestation; successful save updates the same ID and reactive counts. Time alone never confirms it.
6. Disable flights using existing preserve/archive safeguards. Check no flight input, error, review disclosure, search result or report leakage. Other valid fields still permit reviewed confirmation. Reopen historical records without silently renaming or deleting values.
7. Inspect a future-day duty, today's pre-start duty, active interval, ended interval, overnight shift, missing hours and overlapping/tied duties. Check correct title, distinct Next, preserved Scheduled work state and exact Duty/linked Aircraft access.
8. Open Full Calendar, select a date/month, open Duty and return, close with X, reopen and check selection. No Return to Home button; one marker/date with leave priority and unchanged legend.
9. Recheck nested review/discard locking, no desktop horizontal shift, reduced motion, conditional radar, HKT clock, Logbook/Statistics/Journal, keyboard focus, physical iPhone Safari/Chrome, safe areas and VoiceOver. Headless Edge is not physical WebKit or a screen-reader test.

## Verification and files

Final checks: **322 tests passed / 23 files**, with 34 new v0.4.2 cases. `npm.cmd run lint`, `npm.cmd run build` and `npm.cmd run format:check` passed; `npm.cmd audit` reported **0 vulnerabilities**. No dependencies changed. Isolated LAN HTTP headless Edge passed **336 matrix layout checks**, plus **4 populated-form screenshot/layout checks**, across 320/375/390/430/768/1440 px, both languages/themes and motion preferences. No page/dialog overflow or runtime exceptions. The matrix covers Home, blank/invalid/full/arrival-only forms, mandatory attestation review and Calendar X; stored bytes stayed unchanged through navigation. A separate real-browser workflow verified stored prefix conversion to UO450/UO451A, future-confirmation rejection, Pending Draft count exclusion, later explicit same-ID completion with reactive totals 04 → 05, unchanged Duty/Journal data, and an empty undated Untitled Draft in Logbook with no confirmed-count increase. Desktop and mobile populated-form screenshots were visually inspected. All browser persistence tests used only an isolated temporary synthetic profile. See `PROTOTYPE_STATUS.md` for the final evidence summary. Physical iPhone/WebKit, native keyboard/safe areas and VoiceOver remain owner acceptance; no authoritative operations, attendance, FPS or production-readiness claim is made.

- Form/domain: `src/features/AircraftEditor.tsx`, `src/components/FlightNumberField.tsx`, `src/domain/handlingForm.ts`, `src/components/AircraftTypeFields.tsx`, `src/components/AirlineCombobox.tsx`, `src/components/ui.tsx`.
- Presentation: `src/features/AircraftDetails.tsx`, `src/domain/selectors.ts` (applicable-leg search only), `src/i18n.tsx`, `src/styles/v0_4_2.css`, `src/main.tsx`.
- Duty/calendar: `src/domain/homeDuty.ts`, `src/features/UpcomingShift.tsx`, `src/features/FullDutyCalendar.tsx`.
- Compatibility: `src/lib/backup.ts`.
- Tests: `tests/v042.test.tsx`, `tests/handlingHelpers.ts`, `tests/ui.test.tsx`, `tests/v014.test.tsx`, `tests/v020.test.tsx`, `tests/v030.test.tsx`, `tests/v031.test.tsx`, `tests/v034.test.tsx`, `tests/v040-integration.test.tsx`, `tests/v040-motion.test.tsx`, `tests/v041.test.tsx`.
- Release/docs: `src/App.tsx` (displayed version), `index.html`, `package.json`, `package-lock.json` (root versions only), `README.md`, `AGENTS.md`, `PROTOTYPE_STATUS.md`, `docs/JSON_BACKUP_RESTORE.md`, this document.

Suggested commit title, not executed: `v0.4.2 - Refine Handling Forms and Duty Status Logic`.
