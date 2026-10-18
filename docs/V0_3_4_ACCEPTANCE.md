# v0.3.4 — Home & Calendar UI Refinement

This is a local UI refinement of v0.3.3. No backend, authentication, synchronization, new data model, storage migration, attendance conversion, leave-policy change or Statistics change. Existing independent-project and source-available notices and unresolved airline redistribution permissions remain applicable.

## Delivered changes

- Home has no monthly calendar grid. A compact **Upcoming Shift** card shows the next confirmed Planned duty that has not started, its date, recorded times, overnight indicator and Scheduled/Confirmed labels. Leave, Worked, Draft, Trash and elapsed shifts are excluded from this upcoming presentation only; their saved states are untouched. Unknown times are stated explicitly. Same-day shifts retain distinct IDs and sort by date, time and ID; the card notes additional upcoming shifts, all available in Full Calendar.
- **View Full Calendar**, at the right of the Upcoming Shift header, opens the existing shared calendar and date-record list in a native dialog. Close/Escape/backdrop and **Return to Home** return to the underlying Home screen. Month/date state remains in memory across closing/reopening and viewing/editing a duty; no persistent view state or database writes are introduced. Switching navigation closes the dialog.
- Full Calendar retains month navigation, Hong Kong current-date indication, selection, all duties on the chosen date, detail/edit access and immediate updates after saves. Logbook and Add Duties continue to use the same calendar component and unchanged v0.3.3 status resolver. A date still has at most one marker; leave takes precedence and a past Planned shift never becomes Worked automatically.
- The shared legend directly below every calendar grid is a semantic list of five icon/label groups: red Scheduled, green Worked, yellow Currently Working, AL Annual Leave and SL Sick Leave. Icons precede readable 14 px labels. Flex wrapping and spacing work on narrow screens; neutral AL/SL text remains black in Light and white in Dark. No-duty/unclassified-marker explanations and selection instructions are separate secondary text. Accessible date labels, descriptions, selection outlines and current-date marking remain.
- **Fictional calendar preview** moves inside Full Calendar with an explicit read-only synthetic notice. Its dynamic examples, month navigation and single-marker rule are retained. Opening, navigating or cancelling a view never writes these examples to saved duties or Statistics.

## Changed files

- `src/features/HomeCalendar.tsx` → `src/features/FullDutyCalendar.tsx`: reuse the existing calendar/date-detail/fictional-preview implementation in a persistent-state dialog.
- `src/features/UpcomingShift.tsx`: compact read-only upcoming presentation using existing Duty/date helpers.
- `src/App.tsx`: Home composition, dialog visibility/detail return and displayed version.
- `src/components/DutyCalendar.tsx`, `src/styles/v0_3_4.css`, `src/main.tsx`: shared structured legend and responsive card styling.
- `tests/v034.test.tsx`: new UI and navigation regressions; `tests/v033.test.tsx`, `tests/v014.test.tsx`, `tests/v020.test.tsx`: retained assertions adapted to the new Home entry/version.
- `package.json`, `package-lock.json`, `index.html`, `README.md`, `AGENTS.md`, `PROTOTYPE_STATUS.md` and this acceptance document: version, guidance and release documentation. No dependency versions are changed.

## Regression and manual acceptance

1. Home: confirm Upcoming Shift replaces the grid, includes View Full Calendar at the header's right and has a concise empty state when appropriate. Inspect complete, absent and partial times and an overnight example; no fabricated hours should appear.
2. With two upcoming duties on one date, confirm the first is selected deterministically and the additional count remains visible. Open Full Calendar and inspect each separate record.
3. Navigate months, choose a date, open a duty, edit or cancel, then return: month/day and records should remain selected. Close to Home and reopen; view state should remain during this app session. Navigation must not change stored data.
4. Check five clearly separated legend groups immediately below the grid. At 320/375 px and desktop width, confirm natural wrapping, no horizontal overflow and marker-before-label alignment in English and Traditional Chinese.
5. Switch system Light/Dark: verify AL/SL are black/white in both date cells and legend, have no extra dots, and text is readable on selected cells. Inspect the fictional 9th: no simultaneous red/green markers.
6. Open the relocated fictional preview, read its notice, navigate and close; verify saved records and Statistics remain unchanged.
7. Central Add → Add Duties: confirm Scheduled/Worked/AL/eligible SL, multi-date selection, review/save/cancel, duplicate/overlap handling and existing sheet transitions still work. Existing Aircraft review, Logbook, Statistics, Journal and local backup flows remain covered by the full regression suite.
8. On a physical iPhone Safari and PWA-style viewport, verify header wrapping, safe areas, modal scrolling, keyboard/focus handling and returning to Home. Browser viewport emulation does not establish physical iPhone/WebKit/PWA or VoiceOver compatibility.

Automated results and actual browser verification are recorded in `PROTOTYPE_STATUS.md`. Private `.checkpoints` probes/screenshots are ignored verification artifacts, not release files. No automatic commit, push or deployment is authorized.
