# v0.4.0 — Functional Integration & Motion Enhancement

## Integration audit and delivered scope

Baseline: clean `main`, `18be651`, committed v0.3.4. The existing single React database state, local persistence, Full Calendar, batch validation, review-before-save, field privacy, handling calculations, Duty Trash/reconnect preview and v0.3.4 compact Home already worked and were retained.

The audit identified two integration defects: automatic Duty matching included AL/SL, and changing a Handling date could silently replace an existing/chosen Duty. It also found that a single overlay slot lost the originating record after navigating or editing. These are fixed without changing any persisted data model.

- Automatic matching considers only same-Hong-Kong-date, non-Trashed, non-leave duties. One candidate can be preselected; several require a choice; none stays unlinked. Existing legacy/Draft candidate semantics remain. Explicit links, explicit unlinks and existing associations survive subsequent handling-date changes. An explicit overnight link keeps its start-date grouping while the Handling date remains independent.
- Before review and again on confirmation, new/changed links must still reference an eligible duty. Existing historical associations are preserved; the update does not silently detach a linked record merely because its Duty was later classified SL.
- An in-memory return trail connects Duty → Handling creation/detail/edit → Duty and Handling → linked Duty. Returning to an existing frame trims redundant loops. Add remains a launcher. Closing or saving an editor returns to its source; record back buttons explain the destination. Dialog scroll positions are restored. Full Calendar retains month/day state.
- Visited page views remain mounted but hidden when inactive, preserving search/filter/calendar inputs; page scroll positions are restored on tab changes. All views still read the same authoritative database. A successful write updates that database once; failed writes retain the current database and form/review data. No navigation state enters localStorage or full backups.
- Duty and Journal editors now guard repeated submissions during successful dismissal, complementing the existing Aircraft/batch guards. A failed write re-enables retry and removes any stale success toast. Success is announced only after local persistence succeeds; no cloud/sync claim is introduced.
- Home remains compact: three aircraft metrics, Upcoming Shift, View Full Calendar, recent Handling cards and the five-tab navigation. Timeline remains the Logbook default. Scheduled/Worked, Draft/Confirmed/Trashed, AL/SL, roles, handling types, flight legs and disruptions remain independent.

## Motion and performance

- Shared CSS tokens: 150 ms feedback, 200 ms entrance, 180 ms dismissal, with restrained easing. Page/card/dialog/calendar/chart feedback uses CSS; there is no new dependency, count-up loop or continuous JavaScript animation.
- Shared dismissal keeps sheets/dialogs mounted, inert and scroll-locked through the exit; Back/Cancel/discard guards remain explicit. Timers are cleaned on unmount. Aircraft review Back preserves every input; successful Save & Add Next retains its established reviewed workflow and selected Duty.
- Aircraft, batch Duty, Duty and Journal sheets share the existing safe-area and VisualViewport sizing system. Native dialog layering, focus handling and the radar's dialog-pause behavior remain.
- Calendar month transitions affect the grid only; pending multi-date selection stays in editor state. Date selection/status feedback does not animate all markers continuously. Full Calendar date lists have restrained entrance feedback; existing single-marker and neutral AL/SL rules are unchanged.
- Statistics continue to use the existing `stats`, `ranking` and `dutyTotals` definitions. Filtered rows/totals are memoized using their actual record/preferences/filter dependencies. Charts animate transform-based presentation; displayed numbers are the authoritative final values immediately, including decreases and reduced motion. The isolated Hong Kong clock does not drive page/chart/form renders.
- Reduced motion disables nonessential movement and chart/card transitions; close actions become immediate. Focus outlines, labels, selections and accurate numbers remain. The decorative radar's existing reduced-motion support remains.

## Compatibility

No schema change, migration, ID rewrite, automatic sample refresh or storage reset. Database schema 1, backup envelope 1 and `tco-logbook-demo-v0.1` remain. Frozen sample fixtures, privacy preferences, archived disabled fields and all 24 PNGs/provenance/checksums remain unchanged. The source-available/non-open-source position and opening independent-project disclaimer remain.

Navigation state exists only in memory for the current session; reloading resets view history/filters without altering saved records. As before, different browser origins/profiles have different localStorage. No cross-tab synchronization or production data concurrency guarantee has been added.

## Acceptance coverage

| Owner cases                                                                                        | Evidence                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1–7 Duty/Handling links, return context, ambiguity, progress and HKT grouping                      | `v040-integration`, `v040-motion`, existing `ui`, `workflows`, `domain`, `v012-roster` tests                            |
| 8–14 mutually exclusive calendar states, leave, Home and Full Calendar                             | Existing `v033`/`v034` tests plus the reactive integration workflow in `v040-motion`                                    |
| 15–22 handling roles/types, planned/leave hours, edits, Trash/restore and exclusions               | Existing `domain`, `workflows`, `v033`, `v012-roster`; updated count/chart and deletion/restore integration assertions  |
| 23–30 page state, sheet locking, month selection, chart values, genuine success and reduced motion | `v040-motion`, retained `v033`/`v034` tests and actual browser checks recorded in status                                |
| 31–37 old storage, links, samples, failed/repeated saves, legacy progress and other screens        | Existing storage, backup, sample-refresh, Journal and classification suites plus new persistence/navigation regressions |

No existing test is skipped or weakened. The v0.3.4 edit-return assertion now expects Edit → Duty → Calendar, preserving its original no-write/date-selection checks. Exact final commands/counts and browser results are in `PROTOTYPE_STATUS.md`.

## Manual acceptance

1. Home → View Full Calendar → select a date → Duty → New Handling Record for this Duty. Confirm preselection, enter four core fields, Review → Back to Edit, review again and Confirm & Save. Verify return to the same Duty and the new linked card. Test Save Draft and Save & Add Next separately.
2. Open that card, use Open Duty/Back to Duty, edit the record and change its Handling date. The existing Duty must remain linked until explicitly changed. Create two duties on one date; new Quick Add must require a choice. Test no-duty and leave-only dates: no implicit Duty or leave association should be created.
3. Edit a completed Scheduled duty to Worked and save. Check its detail, Full Calendar marker, Logbook, Upcoming Shift and Statistics without reloading. Past Scheduled must remain Scheduled until explicitly changed. Repeat AL and eligible SL checks, including original planned times and separate SL hours.
4. Set Logbook/Statistics/Journal filters, change tabs and return. Check retained controls and appropriate scroll. Open/close related records and confirm return context. New data should update saved-record views without resetting their filters.
5. Trash a Duty with linked Aircraft/Journal records: retain those records and their independent dates, display unlinked state, and keep confirmed Aircraft counts. In Settings preview restore and explicitly reconnect eligible original links; a newer relationship must not be overwritten. Check Aircraft Trash/restore counts independently.
6. Simulate a storage failure in an isolated test profile. Review and entered values must remain, stored bytes must be unchanged, no success should appear, and retry/repeated clicks must not create duplicates. Export a full backup before any manual data replacement.
7. Test both languages/themes at desktop and iPhone-sized widths. Check page/card feedback, keyboard focus, month transitions during selection, sheet open/close/discard, nested review, safe areas and keyboard resizing. Enable system Reduced Motion and verify immediate accurate numbers, minimal movement and usable controls.
8. Leave Statistics or a long record open through clock ticks and tab suspension/resume. Values/form input/scroll should remain stable. Review real-device smoothness without assuming a measured FPS improvement.

Physical iPhone Safari/WebKit, installed PWA, native keyboard/safe-area behavior and VoiceOver require owner acceptance. Headless Windows Edge viewport checks are not equivalent to testing those platforms. No FPS guarantee or production readiness is claimed.

## Modified files

- Integration/state: `src/App.tsx`, `src/lib/useRecordNavigation.ts`, `src/domain/selectors.ts` (Duty matching only), `src/features/AircraftEditor.tsx`, `src/features/DutyEditor.tsx`, `src/features/Journal.tsx`.
- Motion/presentation: `src/lib/useMotionClose.ts`, `src/components/ui.tsx`, `src/components/DutyCalendar.tsx`, `src/features/BatchDutyEditor.tsx`, `src/features/FullDutyCalendar.tsx`, `src/features/Statistics.tsx`, `src/styles/v0_4_0.css`, `src/main.tsx`.
- Tests: `tests/v040-integration.test.tsx`, `tests/v040-motion.test.tsx`, `tests/v034.test.tsx`, `tests/v020.test.tsx` (displayed version only).
- Release/docs: `package.json`, `package-lock.json`, `index.html`, `README.md`, `AGENTS.md`, `PROTOTYPE_STATUS.md`, this file. Private `.checkpoints` verification helpers/results/screenshots are ignored and are not release artifacts.

Suggested release title (not executed): `v0.4.0 - Integrate Duty and Aircraft Workflows with Motion Enhancements`.
