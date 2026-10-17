# v0.1.4 acceptance and verification

Baseline: committed v0.1.3 (`4e607f4`) on `main`, initially clean. Target remains a local frontend prototype. No dependencies were added. Results below are completed after execution; physical iPhone/Safari acceptance is separate.

## Automated contracts

- `tests/v014.test.tsx`: 24 unique image options and local code/name mapping; unchanged rights flags; name/code search; ArrowDown/Up/Enter/Escape (including scrolling the last option into view when opening with ArrowUp); mouse/touch selection and focus; historical/custom names; image error fallback.
- Exactly 24 deterministic Confirmed synthetic assignments, one per catalogue airline and 24 different Hong Kong dates; all nine role/type pairs; explicit DEMO flights/registrations; applicable timed status consistency; stable duties, journals and disruptions.
- Derived 24 Logged / 18 Handled / 9 Primary, with 8 assignments per mutually exclusive type. Mixed overall totals include custom records while the unchanged current-demo subset remains separate.
- Full-content legacy recognition, no write on load, reviewed replacement, user-created rows/Journal text and old duties preserved; retries do not duplicate; deleted-field/edited/duplicate-ID/Duty conflicts block; changed preview fails; double-submit and persistence failure handling.
- Past-start HK Duty ordering; same-day multiple shifts; future/Trash exclusion; Planned badges remain Planned; overnight end dates, details navigation and bilingual empty state.
- Historical fixtures moved unchanged to `legacySeed.ts`; prior domain/lifecycle/review tests retain their old scenario assertions. Fresh-App persistence/Seed expectations now use 24 rows. Existing independent statuses, exact classification boundaries, review for every Aircraft save, roster conflicts, privacy, logos and isolated clock tests remain enabled.

## Data compatibility

Storage key `tco-logbook-demo-v0.1`, schema version 1 and existing models are unchanged. No startup migration or browser data clearing runs. The safe Settings refresh previews full scenario replacements, their generated dates/identities, inserted duties, retained Journal references and disruption event counts before explicit approval. Aircraft IDs a1–a18 remain stable, a19–a24 are added, and nineteen new date-specific duties are inserted for a complete legacy fixture. The six old duties and three journals remain intact, including a same-day pair and an overnight shift.

Only exact unchanged historical payloads are eligible. User/custom records are never inferred from a DEMO prefix or ID. A required ID occupied by an edited/unrecognized record blocks the whole refresh; such records may contain real user edits and cannot safely be automatically replaced. Existing out-of-catalogue custom/historical entries remain visible. Repeated refresh leaves the 24-row demo subset unchanged. Refresh changes eligible scenario dates, airline, times and Duty links; retained Journal aircraft references now describe those reviewed new synthetic scenarios. Existing Journal text is never edited.

The fixtures use fixed representative dates (2026-08-12 through 2026-10-16), not rolling dates. Initial sensitive fields stay disabled; enable them in Settings to inspect fictional times/flights/registrations. No official schedule, fleet feed, customer relationship or verified redistribution right is claimed.

## Windows / Edge manual acceptance

1. In the existing repository run `npm.cmd ci` if needed, then `npm.cmd run dev`. Use the same browser origin/port to retain existing localStorage. Do not Seed/Reset a mixed collection.
2. Home → Log an Aircraft → Airline. Open all 24 options; check full names, codes and logos. Search CX and phuquoc; select by mouse/touch, ArrowDown/ArrowUp + Enter. Escape closes the list only. Tab proceeds through the form. Custom/historical text stays editable. Every save still requires Review / Double-check.
3. Settings → Refresh obsolete demo airlines. Inspect replacements/generated rows and date/link/disruption counts; Cancel writes nothing. For an untouched historical collection, confirm; check 24 airline assignments on different dates in Logbook and 24/18/9 demo totals. Repeat: no more rows. With user records, verify those remain and overall totals differ. With an edited required sample, verify the explicit blocking warning and unchanged data.
4. Home clock: clear date, live HH:mm:ss HKT, Settings accessible. Switch tabs/minimize and return; seconds recompute. Open an Aircraft, scroll and wait through clock ticks; the dialog should retain position.
5. Home → View All Previous Duties. Latest past start first, same-day separate rows, overnight +1 end date and Draft/Confirmed plus Planned/Worked labels. Open details/edit/back. Future planned shifts remain in Logbook; they never increase Worked Duty Shifts. Home Add Duty / Batch Add Duties and central Add remain functional.
6. Switch English/繁體中文 and Light/Dark; inspect 375, 390, 430, 768, 1024, 1440 and 1920 px. Check dropdown scrolling, long names, touch targets, visible focus, header/Settings spacing and no horizontal overflow. Check reduced-motion radar and modal background locking.

## Pre-interruption executed results — 2026-10-17 (Hong Kong)

| Check                      | Result                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- |
| `npm.cmd run test`         | **118 passed, 12 files**, including all prior 100 tests and 18 new v0.1.4 cases. |
| `npm.cmd run lint`         | Passed, zero errors/warnings.                                                    |
| `npm.cmd run build`        | Passed TypeScript + Vite; CSS 39.59 kB, JS 357.02 kB before gzip.                |
| `npm.cmd run format:check` | Passed full configured scope.                                                    |
| `npm.cmd audit`            | **0 vulnerabilities**, unchanged dependencies.                                   |

Isolated headless Windows Edge: 375/390/430/768/1024/1440/1920 widths in Light and Dark, no document horizontal overflow or clock/Settings overlap, local logos loaded; computed clock sizes 24/14 px desktop and 18/12 px mobile. Dropdown exposed all 24 image options; native keyboard events and CDP-emulated touch selected the expected identities. Representative Home, dropdown, grouped detail and Traditional Chinese history screenshots were visually inspected.

Browser refresh acceptance used only an isolated synthetic profile: 18 legacy samples + 1 custom Aircraft + 1 custom Journal and 2 extra duties. Cancel preserved 19 Aircraft. Confirm produced **24 current-demo + 1 preserved custom Aircraft**, 27 duties and 4 journals with valid links; repeat refresh was disabled. History excluded the future plan, retained the past Planned badge and opened existing details. Two more overnight Planned duties persisted through reload, giving 29 duties / 25 Aircraft / 4 journals; all custom examples remained. Detail scrollTop stayed 220 through a clock tick. No runtime exceptions or external HTTP asset requests occurred. QA screenshots/scripts/browser profile are ignored local artifacts under `.checkpoints/`, not release contents.

Final production-preview follow-up verified first ArrowUp opens the list with Philippines AirAsia (Z2) visible (list scrollTop 1278), input focus retained, 24 options, a focus-token outline and Enter confirmation. Its regression test observes the scroll request after options mount.

No actual iPhone/Safari or physical-touch testing was performed. Edge emulation and jsdom do not establish screen-reader, physical device, download/print or universal performance acceptance. No live/company data, personal browser profile or remote service was used. Browser/server processes were stopped after verification. Release staging/commit review is performed separately after these checks; no push is authorized.

## Interrupted implementation recovery audit — 2026-10-17 (Hong Kong)

### Recovery baseline and scope

Actual repository: `C:\Projects\Turnaround-Coordinator-Logbook`, branch `main`, HEAD `4e607f4417ee4a4c3ce23c9abfa84c2c611116e4` (v0.1.3). Recovery began with 33 staged files, 5 files containing unstaged changes, 34 distinct changed paths and 0 untracked files. No v0.1.4 commit was found in local refs. The original six enhancements were already implemented; the final keyboard scroll/contrast fix and its test were present only in the working tree. Recovery preserved both snapshots, without staging, unstaging, committing or rewriting history.

### Requirement checklist

| Requirement                                                        | Initial status            | Recovery action / evidence                                                                                          | Final status              |
| ------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Exactly 24 name/code/local-logo options                            | COMPLETE                  | Verified hardcoded catalogue codes, mappings, local assets and 24 loaded images in Edge                             | COMPLETE                  |
| Name/code search and selected value                                | COMPLETE                  | Tested phuquoc, CX, LD and JL through the actual editor                                                             | COMPLETE                  |
| Keyboard, focus, mouse and touch                                   | COMPLETE                  | Retained the unstaged mounted-option scroll fix; unit tests plus native mouse/keyboard and emulated touch           | COMPLETE                  |
| Fallbacks and rights separation                                    | COMPLETE                  | Existing fallback tests and original PNG/rights integrity checks                                                    | COMPLETE                  |
| Fresh demo: 24 assignments / airlines / distinct HK dates          | COMPLETE                  | Determinism, one-per-airline, DEMO identifiers, nine role/type pairs and all links verified                         | COMPLETE                  |
| Actual-data statistics                                             | COMPLETE                  | 24 Logged / 18 Handled / 9 Primary; each handling type 8; mixed totals preserve extra records                       | COMPLETE                  |
| Reviewed legacy refresh and user-data preservation                 | COMPLETE                  | Exact fixtures only; browser Cancel/Confirm/retry, custom examples preserved; stale/ambiguous payload tests         | COMPLETE                  |
| Blocked current-demo feedback                                      | BROKEN                    | Removed contradictory up-to-date success message and unavailable full-export advice; added EN/zh-HK regressions     | COMPLETE                  |
| Header clock and isolated updates                                  | COMPLETE                  | 24/14 px desktop, 18/12 px mobile; HKT/seconds/resume/cleanup/rollover tests and stable detail scroll               | COMPLETE                  |
| Previous Duties navigation                                         | COMPLETE                  | Descending past-start history, detail opening, future Planned exclusion, work badges and bilingual empty state      | COMPLETE                  |
| Aircraft review/details, batch roster, Journal/privacy/persistence | COMPLETE                  | Full regression suite and overnight roster save/reload in Edge                                                      | COMPLETE                  |
| Custom version and commit convention                               | PARTIAL                   | Policy already present; corrected stale commit authorization to require owner approval                              | COMPLETE                  |
| README / release status                                            | PARTIAL                   | Repaired literal newline escape, distinguished inherited results from recovery evidence, documented partial staging | COMPLETE                  |
| Responsive Light/Dark UI                                           | COMPLETE                  | Repeated 375/390/430/768/1024/1440/1920 widths in both themes                                                       | COMPLETE                  |
| Actual iPhone/Safari, physical input and screen reader             | NEEDS MANUAL VERIFICATION | No physical-device acceptance claimed                                                                               | NEEDS MANUAL VERIFICATION |

### Corrections made during recovery

- `src/features/DemoAirlineRefresh.tsx`: a zero-generation plan with blockers no longer claims the dataset is current. The disabled save and preservation behavior remain unchanged. Blocked English guidance now asks users to review listed records, avoiding a misleading suggestion that the sanitized export is a full backup.
- `tests/v014.test.tsx`: two new localized cases assert that a current sample with user-edited notes stays blocked, never calls persistence, preserves the database and shows no false success message.
- `README.md`: repaired a literal `\n` joining v0.1.4 and Not implemented bullets; opening disclaimer unchanged.
- `AGENTS.md`, `docs/VERSIONING.md`, `PROTOTYPE_STATUS.md`: the latest recovery request overrides the interrupted automatic-commit authorization. No automatic commit/push; existing staged/unstaged work is preserved.
- This acceptance document records the recovery checklist, verification and Git handoff. No domain/schema, persistence, logo or dependency changes were required.

### Recovery verification results

| Command                         | Result                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run test`              | **120 passed / 12 files**; inherited 118 plus two localized blocked-preview tests                                                                                                                     |
| `npm.cmd run lint`              | Passed; zero errors/warnings                                                                                                                                                                          |
| `npm.cmd run build`             | TypeScript + Vite passed; CSS 39.59 kB / JS 357.04 kB before gzip                                                                                                                                     |
| `npm.cmd run format:check`      | Passed                                                                                                                                                                                                |
| `npm.cmd audit`                 | **0 vulnerabilities**                                                                                                                                                                                 |
| Git diff whitespace checks      | Staged and working-tree checks passed                                                                                                                                                                 |
| Immutable references and assets | All 24 original PNGs and built copies match HEAD; approved PRD/brief, source notices, rights inventory and opening disclaimer unchanged; historical seed body preserved; dependency content unchanged |

New isolated Windows Edge profile on local port 5178 / CDP 9334: all 14 viewport/theme combinations passed without horizontal overflow or clock/Settings collision. All 24 dropdown PNGs loaded. Name/code search, native mouse and keyboard, and emulated-touch selection passed. Safe legacy refresh retained a custom Aircraft and Journal: 24 current-demo + 1 custom Aircraft, 27 duties, 4 journals and valid links. Cancel made no changes; repeat refresh was disabled. Past Planned duties remained Planned, future plans were excluded from history, and details opened. Two overnight Planned duties persisted after reload: 29 duties / 25 Aircraft / 4 journals. Detail scrollTop 220 remained stable through a clock tick. No app runtime errors or external HTTP asset requests were observed. The edited-current-demo browser case showed a blocker, disabled confirmation, no up-to-date claim and unchanged synthetic user notes. Representative Home, dropdown and blocked-preview screenshots were visually inspected.

QA scripts/screenshots/profiles are ignored `.checkpoints/` artifacts. They use synthetic fixtures only and do not access personal browser profiles. Device-clock accuracy, actual iPhone/Safari, screen reader, physical touch/keyboard, download/print and universal hardware performance remain manual checks. Existing ambiguous target IDs deliberately block refresh; no user-data deletion or automatic migration is inferred. Fixed demo dates do not roll forward automatically. The existing multi-tab/localStorage limitations are unchanged.

### Git handoff

HEAD remains `4e607f4417ee4a4c3ce23c9abfa84c2c611116e4` on `main`. No v0.1.4 commit exists. There are **33 staged paths and 10 unstaged paths, 34 distinct changed paths, 0 untracked paths** (ignored QA artifacts excluded). The staged index is unchanged from recovery start, verified by its `git ls-files --stage` SHA-256 fingerprint. **The existing index alone is not the final tested release.** Review and include the remaining unstaged edits only as part of a later owner-approved commit.

Staged paths inherited from the interrupted session:

```text
AGENTS.md
PROTOTYPE_STATUS.md
README.md
docs/AIRLINE_CATALOGUE.md
docs/V0_1_4_ACCEPTANCE.md
docs/VERSIONING.md
package-lock.json
package.json
src/App.tsx
src/components/AirlineCombobox.tsx
src/components/DemoScope.tsx
src/data/demoDatasetRefresh.ts
src/data/demoRefresh.ts
src/data/legacySeed.ts
src/data/reference.ts
src/data/seed.ts
src/domain/roster.ts
src/features/AircraftEditor.tsx
src/features/DemoAirlineRefresh.tsx
src/features/DutyHistory.tsx
src/features/Settings.tsx
src/features/Statistics.tsx
src/main.tsx
src/styles/v0_1_2.css
src/styles/v0_1_4.css
tests/airlines.test.tsx
tests/domain.test.ts
tests/ui.test.tsx
tests/v012-aircraft.test.tsx
tests/v012-roster.test.tsx
tests/v013.test.tsx
tests/v014.test.tsx
tests/workflows.test.tsx
```

Paths with unstaged edits:

```text
AGENTS.md
PROTOTYPE_STATUS.md
README.md
docs/V0_1_4_ACCEPTANCE.md
docs/VERSIONING.md
src/components/AirlineCombobox.tsx
src/features/DemoAirlineRefresh.tsx
src/styles/v0_1_4.css
tests/setup.ts
tests/v014.test.tsx
```

The working tree is ready for owner manual acceptance using the Windows / Edge steps above. Wait for explicit approval before committing or pushing; no deployment or visibility change was performed.
