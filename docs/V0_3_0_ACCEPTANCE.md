# v0.3.0 acceptance

Built on main / 0582658 (v0.2.0d), initially clean. Preserve the LAN HTTP cryptographic UUID fallback. No commit/push/history rewrite, deployment, backend, login, cloud or new dependency.

## Delivered scope

1. Aircraft modal uses bounded border-box controls, zero minimum inline size for native date/time fields, shrinkable tracks and wrapping text, safe-area width and a vertical mobile action layout. No overflow-x hiding is used to mask control sizing. Existing native-dialog focus restoration/background locking remain.
2. Duty choices use wrapping, labeled keyboard-operable combobox/listbox options: YYYY-MMM-DD HH:MM–HH:MM(+1) · RecordState/WorkState. Missing times remain em dashes; absent historical work state is explicitly Legacy. Sort: descending shift-start date/start, stable ID tie-break. No hidden implicit Draft Duty creation; review may explicitly show Unlinked. Helper points to Add Duty.
3. Stacked dependent model/variant fields with centralized curated Airbus/Boeing catalogue. A321 model stays separate from A320 family; legacy/custom strings and IDs remain. See AIRCRAFT_CATALOGUE.md.
4. Calculated Delay Severity uses entered whole disruption-delay minutes only: 0–14 below threshold, 15–60 Minor, 61–180 Moderate, 181+ Major, unknown/invalid Undetermined. Historical operational impact remains independently preserved. Cancellation/missing times never imply Major; cross-midnight flight times are not used to infer duration or causation.
5. Journal search and competency use separate full-width mobile rows; desktop retains a compact grid.
6. Settings removes the visible airline-library block only. All 24 PNGs, registry, dropdown logos and legal/provenance records remain.
7. Future Protection — Coming Soon is bilingual and explicitly unavailable. Production encryption/authentication/cloud backup are still deferred; local full JSON restore is now implemented separately.
8. Versioned, unencrypted full JSON backup and reviewed atomic Restore / Replace, with strict validation and stale-preview/quota safeguards. Existing privacy-reviewed reports/PDF remain separate. No complex merge. See JSON_BACKUP_RESTORE.md.
9. Only a genuinely missing local database gets six optional fields enabled. Existing settings, disabled/deleted fields and invalid stored originals are not reset. No load-time write/migration/reseed. Seed fixture fingerprints remain stable.

## Manual acceptance

- Test 320, 375, 390, 393, 414, 430 px, desktop and both themes. Open Aircraft More Details, arrival/departure datetime controls, disruptions, airline options, Duty options, Review and import/export dialogs. Check all control borders, labels, focus and vertical scrolling. Keyboard navigation/Enter/Escape should keep selection and review safe.
- At mobile Journal, search has its own full row above Competency. Type a story term, combine competency/date filters, clear and reopen an entry.
- Create an unlinked Confirmed Aircraft after completing required fields. No Duty is created. Add Duty separately, then link it. Overnight options show (+1); missing historical times and work state remain explicit.
- Choose A321 → A321XLR, then B787: old variant clears. Save/review B787-9; inspect details/type ranking. Edit unknown legacy text and verify unchanged metadata until explicitly replaced.
- Enter disruption durations 14/15/60/61/180/181; verify reactive severity and preserved historical impact. Cancelled flights with unknown duration remain Undetermined.
- Export a full JSON file, keep it private, import and inspect full replacement lists; cancel without writes, then confirm. Test report/PDF rejection, malformed/missing-link files, repeated restore and quota failure. Retained IDs, Trash, journals, settings, cross-midnight dates and Planned counts must match.
- Fresh origin: optional fields enabled. Existing origin: disabled preferences remain disabled. Do not clear an owner's browser to simulate a fresh install; use an isolated profile.
- Test localhost and LAN HTTP; owner separately verifies actual iPhone Safari/Chrome, file download/picker, keyboard, touch and safe areas.

## Evidence and limits

- Automated regression: **190 passed / 15 files**; npm.cmd run lint, npm.cmd run build and npm.cmd run format:check passed. npm.cmd audit found **0 vulnerabilities**. Build checks both source and test TypeScript. No new dependency or weakened lint rule.
- Final automated results are recorded in PROTOTYPE_STATUS.md after execution. Edge ran 39 layout/workflow checks using an isolated temporary profile: widths 320/375/390/393/414/430/1440, Light/Dark expanded Aircraft and Duty choices, mobile Journal layout, full export/import/restore and Traditional Chinese import. No page/dialog/control overflow was detected. Real local JSON download and confirmed round-trip preserved data; preview did not write storage. No runtime exceptions on LAN HTTP with randomUUID absent. Screenshots at 320 px were visually inspected.
- Existing logo PNGs, provenance/rights, frozen seed/reference fixtures and UUID utility are unchanged. Existing user browser data was not accessed; the pre-existing 5173 development server was left running.
- Edge device metrics are not an actual iOS Safari engine. The reported physical iPhone issue cannot be assigned a uniquely proven Safari engine root cause without that device; the sizing paths inspected above were corrected directly and tested without concealing horizontal overflow. Actual iPhone Safari/Chrome, screen reader, touch/keyboard, download and safe-area acceptance remain with the owner.

## Changed files

- Shell/version: src/App.tsx, src/main.tsx, src/i18n.tsx, index.html, package.json, package-lock.json.
- Domain/storage: src/domain/model.ts, src/domain/roster.ts, src/domain/selectors.ts, src/lib/storage.ts.
- New entry components: src/components/AircraftTypeFields.tsx, src/components/DutyPicker.tsx.
- New classification: src/data/aircraftCatalogue.ts, src/domain/delaySeverity.ts.
- Features: src/features/AircraftEditor.tsx, src/features/AircraftDetails.tsx, src/features/Journal.tsx, src/features/Settings.tsx, src/features/Statistics.tsx, src/features/BackupManager.tsx (new).
- New backup/style: src/lib/backup.ts, src/styles/v0_3_0.css.
- Tests: tests/domain.test.ts, tests/ui.test.tsx, tests/v020.test.tsx, tests/v030.test.tsx (new).
- Guidance/docs: AGENTS.md, README.md, PROTOTYPE_STATUS.md, docs/AIRCRAFT_CATALOGUE.md, docs/JSON_BACKUP_RESTORE.md, docs/V0_3_0_ACCEPTANCE.md (last three new).

Git: main, HEAD 0582658 (v0.2.0d). 21 tracked modifications and 11 new files; none staged. No commit/push/history rewrite.
