# v0.1.4 acceptance and verification

Baseline: committed v0.1.3 (`4e607f4`) on `main`, initially clean. Target remains a local frontend prototype. No dependencies were added. Results below are completed after execution; physical iPhone/Safari acceptance is separate.

## Automated contracts

- `tests/v014.test.tsx`: 24 unique image options and local code/name mapping; unchanged rights flags; name/code search; ArrowDown/Up/Enter/Escape; mouse/touch selection and focus; historical/custom names; image error fallback.
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

## Executed results — 2026-10-17 (Hong Kong)

| Check                      | Result                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- |
| `npm.cmd run test`         | **118 passed, 12 files**, including all prior 100 tests and 18 new v0.1.4 cases. |
| `npm.cmd run lint`         | Passed, zero errors/warnings.                                                    |
| `npm.cmd run build`        | Passed TypeScript + Vite; CSS 39.50 kB, JS 357.01 kB before gzip.                |
| `npm.cmd run format:check` | Passed full configured scope.                                                    |
| `npm.cmd audit`            | **0 vulnerabilities**, unchanged dependencies.                                   |

Isolated headless Windows Edge: 375/390/430/768/1024/1440/1920 widths in Light and Dark, no document horizontal overflow or clock/Settings overlap, local logos loaded; computed clock sizes 24/14 px desktop and 18/12 px mobile. Dropdown exposed all 24 image options; native keyboard events and CDP-emulated touch selected the expected identities. Representative Home, dropdown, grouped detail and Traditional Chinese history screenshots were visually inspected.

Browser refresh acceptance used only an isolated synthetic profile: 18 legacy samples + 1 custom Aircraft + 1 custom Journal and 2 extra duties. Cancel preserved 19 Aircraft. Confirm produced **24 current-demo + 1 preserved custom Aircraft**, 27 duties and 4 journals with valid links; repeat refresh was disabled. History excluded the future plan, retained the past Planned badge and opened existing details. Two more overnight Planned duties persisted through reload, giving 29 duties / 25 Aircraft / 4 journals; all custom examples remained. Detail scrollTop stayed 220 through a clock tick. No runtime exceptions or external HTTP asset requests occurred. QA screenshots/scripts/browser profile are ignored local artifacts under `.checkpoints/`, not release contents.

No actual iPhone/Safari or physical-touch testing was performed. Edge emulation and jsdom do not establish screen-reader, physical device, download/print or universal performance acceptance. No live/company data, personal browser profile or remote service was used. Browser/server processes were stopped after verification. Release staging/commit review is performed separately after these checks; no push is authorized.
