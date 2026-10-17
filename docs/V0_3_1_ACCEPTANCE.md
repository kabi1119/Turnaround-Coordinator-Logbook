# v0.3.1 focused UI acceptance

Started on clean main / f5a2a11 (committed v0.3.0). No commit/push/history rewrite, deployment, new service/dependency or storage/schema migration.

## Delivered presentation

- Home: Log a Handling Task / 記錄航機處理任務. Entry interfaces: New Handling Record / 新增航機處理紀錄, Edit Handling Record / 編輯航機處理紀錄, Review Handling Record / 覆核航機處理紀錄. Detail, add-menu and linked-Duty entry actions use Handling Record. Statistics uses Handling Assignments / 航機處理任務. Aircraft / 航機 remains the aircraft identity/category concept; TypeScript types, JSON keys, storage keys and saved airline/Duty values are not renamed.
- src/data/airlineCatalogue.ts exports one non-mutating orderAirlines helper. Empty-query options start CX, UO, LD; the remaining 21 use English-name A–Z order with an IATA tie-break. Active queries filter names, codes and aliases first, then sort matching results alphabetically without priority pinning. Both new/edit forms reuse AirlineCombobox; all 24 local logos/fallbacks and custom text remain.
- dutyOptionText retains Hong Kong shift-start YYYY-MMM-DD, 24-hour times, missing-time em dashes and overnight (+1), but omits record status. Planned displays Scheduled / 已排班, Worked displays Worked / 已工作. Missing workState displays Work state not recorded / 未記錄工作進度. No elapsed-date inference, state mutation or statistical reclassification; underlying Draft/Confirmed and Planned/Worked retain v0.3.0 semantics. Review uses the same formatter.

## Regression and manual acceptance

1. In English and Traditional Chinese, click the Home action; verify New Handling Record, complete a Full Turnaround and save. Review Handling Record must appear before persistence. Back to Edit preserves input. Confirm once increases assignments by one; arrival/departure legs do not double it. Detail → Edit uses the new label. Try central Add and Logbook entry as well.
2. Open the airline list in both new/edit forms. Verify first CX/UO/LD, then all 21 A–Z with no duplicate. Search CX, Lufthansa German, Hong Kong Express and an unknown custom name. Arrow keys/Enter/Escape, mouse and emulated touch retain expected behavior and logos/fallbacks.
3. Duty choices must show Worked or Scheduled, not Confirmed/Planned. Test overnight (+1), incomplete historical time values and missing workState. A past Planned duty must still say Scheduled; historical counting rules remain unchanged.
4. Check 320/375/390/393/414/430 px and desktop, both themes/languages. Long Home actions, entry/review headings and wrapping Duty options should fit without horizontal overflow. Confirm focus, background scroll locking and vertical modal scroll.
5. Run full regression including Training, Arrival Only, Departure Only, cancellation, local persistence, v0.3.0 backup/restore and LAN HTTP UUID behavior. All old fixture/backup IDs remain stable. No actual user browser records are reset to test fresh samples.

## Verification

- npm.cmd run test: **200 passed / 16 files**. Lint: zero warnings. TypeScript/Vite build: passed. Format check: passed. npm.cmd audit: **0 vulnerabilities**. Tests retain Full Turnaround single-assignment counts, legacy states/preferences, all existing v0.3.0 backup and UUID regressions.
- Isolated Edge: **196 layout checks** at 320/375/390/393/414/430/1440 px × English/Traditional Chinese × Light/Dark across Home, new/edit/review, airline/Duty options and Statistics. No page/dialog/control horizontal overflow. Representative 320 px review screenshots were inspected. All 24 PNGs loaded, the default order matched exactly, emulated touch selected UO, and no JavaScript exceptions occurred on real insecure LAN HTTP. Stored synthetic records were byte-for-byte unchanged through preview/cancel/layout checks.
- Original models, storage/backup implementation, fixture payloads, UUID utility, PNGs and rights/provenance files are unchanged. Only presentation and version/docs/tests changed; no automatic data migration. Git: main / f5a2a11; all changes unstaged/uncommitted, no push.
- Edge viewport emulation is not physical iPhone Safari/Chrome verification. The owner should verify actual touch keyboard, safe areas and iOS file handling before release acceptance.

## Suggested release commit (not executed)

v0.3.1 - Refined Handling Terminology, Airline Selection and Duty Labels

User Interface:

- Adopt Handling Task terminology for the Home action
- Rename aircraft entry and review interfaces to Handling Record
- Preserve Handling Assignment terminology in statistics
- Maintain bilingual and responsive layouts

Airline Selection:

- Prioritize CX, UO and LD in the airline dropdown
- Sort remaining airlines alphabetically
- Preserve all 24 local logo options and searchable identities

Duty Management:

- Simplify Duty Picker status labels to Scheduled and Worked
- Retain overnight date indicators and 24-hour formatting
- Preserve underlying Duty states and legacy data compatibility

Quality:

- Expand regression coverage
- Preserve existing v0.3.0 features and JSON backup compatibility
- Verify tests, lint, build, formatting and npm audit
