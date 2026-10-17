# TCO Logbook v0.3.1 Pre-release status

## v0.3.1 terminology, airline ordering and Duty labels — 2026-10-18 (Hong Kong)

Started on clean main / f5a2a11 (v0.3.0). Final bilingual Handling Task/Record/Assignment terminology is wired to Home, entry/review/detail actions and Statistics. One non-mutating shared ordering helper presents CX/UO/LD then 21 English-name A–Z choices; active search has no unrelated pinned entries. Duty labels show Scheduled/Worked or explicit unknown progress, preserving times/overnight markers and all underlying states/statistics. Both new/edit forms share the same airline component.

No model/schema/key/record migration, dependency/service change, PNG/provenance change, commit or push. v0.3.0 full JSON backup compatibility and LAN UUID remain. See docs/V0_3_1_ACCEPTANCE.md for checks and owner acceptance; previous sections below are historical.

Verification: **200 tests passed / 16 files**; lint zero warnings, TypeScript/Vite build and format check passed; npm audit **0 vulnerabilities**. Edge in an isolated temporary synthetic profile completed **196 layout checks** across 320/375/390/393/414/430/1440 px, both languages and Light/Dark: Home action, new/edit/review dialogs, airline/Duty options and Statistics. All 24 logos loaded; emulated touch selected HK Express; LAN HTTP ran with randomUUID absent; review/cancel interactions left stored records unchanged. No detected horizontal overflow or runtime exceptions. Real iPhone Safari/Chrome, screen reader and physical touch/keyboard remain owner acceptance. No commit, push, staged changes or user-browser reset.

## v0.3.0 Aircraft entry, mobile UX and data management — 2026-10-18 (Hong Kong)

Started on clean main / 0582658 (committed v0.2.0d). All nine requested improvements are implemented locally: shrinkable mobile forms; wrapping Duty picker without implicit Duty creation; stacked dependent Airbus/Boeing identity fields; entered-duration delay severity preserving old impact; full-width mobile Journal search; Settings library removal; bilingual Coming Soon; validated full JSON export/replace restore; fresh-only enabled optional fields.

Storage schema/key/IDs and old preferences remain. New aircraftType/delayMinutes are optional; no automatic migration or reset. The numeric package/UI version is 0.3.0. No new dependency, PNG modification, licensing change, backend, cloud, authentication, deployment, automatic commit or push.

See docs/V0_3_0_ACCEPTANCE.md for execution results/limits, docs/JSON_BACKUP_RESTORE.md for strict format/safety rules and docs/AIRCRAFT_CATALOGUE.md for primary manufacturer references. Earlier sections below are historical; v0.3.0 supersedes their missing-backup/fresh-privacy/implicit-duty statements.

Final checks: **190 tests passed / 15 files**, lint passed with zero warnings, TypeScript/Vite production build passed, format check passed, npm audit **0 vulnerabilities**. Isolated Windows Edge completed 39 layout/workflow checks at 320/375/390/393/414/430/1440 px, including Light/Dark expanded Aircraft/Duty controls, Journal search, bilingual backup dialogs and actual full JSON download/restore on LAN HTTP. No unintended page/dialog/control overflow or runtime exceptions observed. Physical iPhone Safari/Chrome acceptance remains pending. Opening README disclaimer, original logo assets/rights, frozen sample fingerprints and UUID utility are unchanged. All changes remain uncommitted and unstaged.

## v0.2.0d LAN HTTP compatibility — 2026-10-18 (Hong Kong)

- src/lib/uuid.ts prefers native crypto.randomUUID when available and otherwise uses crypto.getRandomValues for 16 random bytes with RFC 4122 version-4 and variant bits. Missing secure randomness throws an explicit error; no Math.random fallback or dependency.
- The existing domain id entry point delegates to the shared utility, covering Aircraft, Duties, Journal, disruptions and batch roster IDs. Seed/sample-refresh module initialization no longer requires a secure-context-only API. No other direct application randomUUID calls remain.
- Storage key/schema, existing IDs and relationships are unchanged; no automatic migration, reset or regeneration. UI/docs use v0.2.0d; the numeric npm version remains 0.2.0 rather than introducing an unagreed SemVer encoding for the project's custom suffix.
- Verification: 139 tests passed across 14 files, including native/fallback UUIDs, format/uniqueness, deterministic version/variant bit cases, unavailable randomness, module initialization and stored-ID/link preservation. Lint, build and format checks passed; npm audit found 0 vulnerabilities. The existing acceptance document needed whitespace-only formatting. Generated isolated browser profile artifacts were moved outside the source tree before lint; no lint rules were weakened.
- Isolated Windows Edge verified both http://localhost:5173/ (secure context, native randomUUID) and http://192.168.1.2:5173/ (insecure context, randomUUID undefined, getRandomValues available). Both loaded four initial samples, created and saved Duty/Aircraft records, enforced Aircraft review, retained stored records byte-for-byte on reload and preserved Duty/Journal links. No JavaScript runtime exceptions. No insecure-context browser flags or randomUUID polyfill were used. The already-running development server was left running; the owner's browser/storage was not accessed.
- Physical iPhone Safari/Chrome acceptance remains with the owner. HTTP LAN and localhost have separate origin storage; this fix does not synchronize or transfer data between them. No commit, push, deployment or history rewrite.

## v0.2.0 UI and sample refinement — 2026-10-17 (Hong Kong)

Built on the existing checkout at committed v0.1.5a (29c9fbc), preserving all in-progress v0.2.0 changes and the owner's earlier Lufthansa asset replacement. No automatic commit/push, history rewrite, deployment or production service is authorized.

- Larger full-name upper-left brand, short name elsewhere; removed the upper prototype/data/device strip. Subtle version/device/Hong Kong metadata is in the lower desktop sidebar and the small mobile/tablet footer.
- Decorative local SVG East Asia / Western Pacific map with China, Korea, Japan, Taiwan, northern Philippines and Vietnam silhouettes; plane, rings and CSS sweep share the Hong Kong-area anchor. No external map assets/services. Reduced-motion and pause while dialogs are open remain.
- Four fictional Aircraft / three Duties / two Journals replace the fresh showcase collection, covering all requested statuses, handling types/roles and relationship/timing scenarios with 4 Logged / 3 Handled / 2 Primary. Existing persisted records are not automatically replaced.
- Settings sample refresh previews aircraft, duty and journal changes and replaces only exact known untouched fixtures. Personal records/settings remain; edited samples, duplicate IDs and retained links block updates. Frozen legacy/v0.1.4 seeds remain compatibility fixtures. Same version-1 storage key/schema; no migration/reset on load.
- New visible labels and sample values omit DEMO. Settings and exports retain fictional/local-only disclosures. Existing user text is preserved verbatim, including old labels if the owner has edited/retained them.
- Removed only the batch chosen-hours acknowledgement; valid times, final review/save, duplicate/overlap checks and explicit overlap override remain.
- No new dependency or external asset. Existing logo bytes and unresolved rights stay intact; existing inventory/bounds corrections for the owner's LH replacement are preserved.

Verification: see docs/V0_2_0_ACCEPTANCE.md for executed checks and browser limits. Older sections below are historical and do not describe the current four-record fresh dataset.

## Historical v0.1.4 status

## Interrupted implementation recovery — 2026-10-17 (Hong Kong)

Recovery started with HEAD 4e607f4417ee4a4c3ce23c9abfa84c2c611116e4 on main (v0.1.3): 33 files already staged, five files with unstaged edits, 34 distinct changed paths and no untracked files. No v0.1.4 commit existed. Existing implementation and the index were preserved; no add/reset/commit/push/history rewrite was performed during recovery.

- Audited all six v0.1.4 requirements against actual source, UI integration and tests. The catalogue/combobox, 24-record seed, reviewed refresh, clock, previous-duty navigation and version convention were already present. Recovery did not rebuild them.
- Fixed one misleading refresh state: an edited current demo could be blocked while also showing the dataset as current. That success message now requires zero blockers; confirmation remains disabled and user edits stay intact. English guidance no longer suggests a full-data export that the prototype does not provide. Added two EN/zh-HK regression cases.
- Fixed the literal newline escape joining two README bullets. Updated AGENTS and VERSIONING to the latest recovery instruction: wait for explicit owner approval before any commit or push. The earlier automatic-commit authorization is superseded.
- Final recovery tests: **120 passed / 12 files**, lint zero warnings, TypeScript/Vite build passed, formatting passed and npm audit **0 vulnerabilities**. The 24 source PNGs and build copies match HEAD byte-for-byte; opening disclaimer, PRD/brief, third-party notices, provenance/rights inventory, historical seed body and dependency content are unchanged.
- Repeated Edge QA in a new isolated synthetic profile: seven widths in both themes; 24 loaded option logos; name/code search; native mouse/keyboard and emulated touch selection; safe cancel/refresh/retry with custom examples preserved; history/detail navigation; future Planned exclusion; overnight batch persistence; stable detail scroll through clock ticks; blocked preview without a false current-data claim. No app runtime errors or external HTTP asset requests. Physical iPhone/Safari and screen-reader acceptance remain pending.

The **working tree** is verified for owner manual acceptance. Existing staging is deliberately unchanged and does not contain all final fixes: review/include the remaining unstaged edits before any later approved commit. Full checklist, file lists, limitations and Windows acceptance steps: docs/V0_1_4_ACCEPTANCE.md. No automatic commit or push.

## Original v0.1.4 implementation — 2026-10-17 (Hong Kong)

Built on the clean, committed v0.1.3 baseline 4e607f4 on main. The original implementation task authorized a local release commit, but it was interrupted before a commit occurred. The subsequent recovery request requires verification and explicit owner approval before any commit or push. No amend, history rewrite, visibility change or deployment is authorized. Work is exclusively in Turnaround-Coordinator-Logbook.

- AirlineCombobox replaces native datalist: exactly 24 local image/name/IATA options; searchable name/code/aliases; editable historical/custom text; arrows, Enter, Escape, mouse/touch and focus behavior. AirlineLogo retains code fallback and separate unresolved legal status.
- seedDatabase now generates exactly 24 Confirmed synthetic assignments, one per catalogue airline, on 24 distinct fixed HK dates (12 August–16 October 2026). Flights, registrations and bays are explicitly DEMO; selected gate times and independent statuses demonstrate existing features. Appropriate type illustrations include B737-800 and A330-300F entry options. Original eight variant choices are frozen in legacySeed to preserve recognition fingerprints.
- Six original duties and three Journal payloads/IDs remain; nineteen date-specific demo duties are added, giving 25 duties. All nine role/type combinations remain represented. Counts derive from actual rows: 24 Logged, 18 Handled, 9 Primary, eight per handling type. Home/Statistics label the unchanged current-demo subset separately from overall totals.
- Settings safe refresh previews replacements/generated rows and dates, new duties/required journals, retained Journal aircraft references and disruption counts. Full recursive match against frozen v0.1.1–v0.1.3 payloads is required. No automatic migration/reset/write on load. Existing duties/journals/settings/custom records remain; eligible Aircraft IDs are retained while their scenario content/date/Duty may change as explicitly previewed. Repeated refresh does not duplicate records/events. Edited/deleted-field/unknown target IDs, duplicate IDs or different-date/trashed required duties block the whole transaction. A stale preview also fails safely.
- Clock typography is 24 px time / 14 px date desktop and 18 px / 12 px mobile. Asia/Hong_Kong seconds, current-system-time recomputation, resume/focus cleanup and isolated renders are preserved.
- Home replaces only the redundant section New Duty shortcut with bilingual View All Previous Duties. Small modal reuses duty-row/Badge/Modal and existing details callbacks; sorts by past HK start time, retains same-day shifts and Planned/Worked labels, excludes future and Trash, and includes an empty state. Prominent duty actions and five tabs remain.
- docs/VERSIONING.md, README and AGENTS document the owner's custom multi-digit vMAJOR.MINOR.PATCH[letter], explicit production approval, scope-based future proposals and version-first English release commits. Package/root lock version is 0.1.4; no dependency change.
- README opening disclaimer, source-available/non-open-source terms, all PNG bytes/provenance and unresolved rights remain intact. Historical entries below describe earlier releases.

Executed verification: **118 tests passed across 12 files**; lint zero warnings, TypeScript/Vite build passed, format:check passed, npm audit **0 vulnerabilities**. Isolated Windows headless Edge passed seven widths in both themes, keyboard/emulated-touch logo selection, cancellation and reviewed legacy refresh with custom records preserved, idempotency, duty-history ordering/detail access, overnight batch save/reload and stable detail scroll through clock updates. No runtime exception or external HTTP asset request. Representative screenshots were visually inspected; QA artifacts remain ignored under .checkpoints. Full results: docs/V0_1_4_ACCEPTANCE.md.

Real iPhone/Safari and physical touch remain untested. Ambiguous required IDs deliberately block refresh rather than overwrite potential user edits; fixed synthetic dates do not roll forward automatically. Legacy Draft duties without work progress show Not Recorded in the new history instead of inferring completed work. No automatic storage migration, browser-data reset or deployment runs. No v0.1.4 commit exists at recovery start; approval is required before any future commit or push. Recovery findings and final verification are recorded below and in docs/V0_1_4_ACCEPTANCE.md.

## Historical v0.1.3 status

Updated: 2026-10-17 (Asia/Hong_Kong). Baseline: approved PRD v1.5 + prototype implementation brief. This is a frontend demonstration with synthetic data only. No Phase 2 work has started.

## v0.1.3 implementation — 2026-10-17 (Hong Kong)

Built on committed v0.1.2 c0070ab on main; working tree was clean at start. No amend/reset/history rewrite/commit/push, visibility change or deployment. Only the current Turnaround-Coordinator-Logbook checkout is used. No dependency upgrades or production services are added.

- One owner-defined catalogue supplies exactly the 24 requested identities, default suggestions, IATA/name/alias search and PNG mappings. NH/SQ/HX/EK are removed from defaults/fresh samples, while historical lookup and custom entry remain available. Original nine source/legal records remain preserved separately; new catalogue entries have no fabricated verification date/source or HAS affiliation.
- Fresh synthetic fixtures keep 18 assignments, duty/journal relationships and all role/type/status scenarios, substituting only allowed airlines. No automatic storage migration runs. Settings provides a preview/confirmation refresh for exact complete legacy-fixture matches; only approved airline fields change. User edits, deleted fields, custom IDs and unknown payloads are excluded. IDs/links/counts remain stable; retries are idempotent and no records are added/deleted. Existing Seed/Reset replacement controls remain separate.
- Measured all 24 source PNG bounds without changing files. CSS uses padded artwork bounds and uniform sizing in compact, card/list and detail frames (desktop cards 112×56, detail 144×72; phone cards 96×52, detail 128×64). Empty neutral/transparent margins are not treated as artwork; original aspect ratios and all visible artwork are retained. No derivative image or pixel edit, no new download or permission change. Representative CX/UO/LH/LD/JL/QR were visually reviewed in Edge light/dark.
- Inspected clock/effects/scroll and profiled Chromium traces before/after. The clock was already isolated; no scroll/layout loop was found. Baseline headless run did not reproduce the reported stutter. Confirmed background conditions were animated radar plus blur(4px). Removed backdrop blur, paused radar while any nested modal is open, and lock/restore body scrolling with nested-modal accounting. No speculative memoization, virtualization or GPU hacks.
- Short trace callback P95: baseline 16.8 ms, final 16.7 ms; final callback max 33.2 ms versus 16.8 baseline. Paint CPU totals 1.899 ms baseline / 0.918 ms final, but run variation is substantial (intermediate A/B up to 2.321 ms). These are not GPU FPS or proof of a universal speedup. Full conditions/results at docs/V0_1_3_ACCEPTANCE.md.
- Edge observed scrollTop 200 preserved across clock ticks, background position unchanged, overflow lock active, blur none, radar paused. Representative gallery passed seven widths in both themes with loaded images/no horizontal overflow. Actual iPhone/Safari and owner's original hardware/input stutter still require manual acceptance.
- Added 10 tests for exact catalogue/exclusions/search, real editor compatibility, new seed scope, conservative refresh/idempotence/links, actual Home detail render isolation, nested modal/focus/Escape and padded bounds. Existing role/type/status/review/roster/privacy regressions remain. Catalogue policy assertions were updated to the owner's new requirements; permission assertions retained. Final command results are recorded below after execution.

Final verification: npm.cmd run test **100/100 passed across 11 files**; npm.cmd run lint **passed, zero warnings**; npm.cmd run build **passed**; npm.cmd run format:check **passed**; npm.cmd audit **0 known vulnerabilities**. Git whitespace check passed. All 24 original PNGs and dist copies match the unchanged inventory hashes; README disclaimer is still first and THIRD_PARTY_NOTICES.md is unchanged. Local QA scripts were fixed to meet the existing lint rules rather than disabling rules.

Actual Home/card/detail and batch regression checks also passed seven widths in both themes: no horizontal overflow/clock collision, loaded logos, grouped mobile detail, two Planned duties persisted/reloaded while 18 Aircraft and 3 Journals remained; no runtime exceptions or external app requests. Original PNGs were not overwritten, renamed or deleted. The separate Edge instance and local server were stopped.

Final Git state: main, HEAD c0070ab8ecf025c0afc1cba7b013f2282b6b1620 unchanged; 18 modified tracked paths and 7 new untracked source/test/document paths, nothing staged. No automatic commit/push or other remote/history mutation.

Known limits: refresh deliberately skips edited/unrecognized old samples; no blanket data cleanup. Browser datalist appearance depends on the browser. Copyright/trademark permissions remain unresolved; source-available disclaimer/notices remain intact. Performance traces are short, headless and GPU-disabled, not a guarantee for normal Edge or iPhone. No actual measured GPU FPS claim is made. Earlier v0.1.2 sections are historical.

## Historical v0.1.2 implementation — 2026-10-17 (Hong Kong)

This section supersedes older workflow/display/version statements below. Work was performed exclusively in C:\Projects\Turnaround-Coordinator-Logbook; the retired checkout was not accessed. Initial Git state: clean main, HEAD f6322c9, origin https://github.com/kabi1119/Turnaround-Coordinator-Logbook.git. No automatic staging, commit, push, history rewrite, visibility change or deployment.

### Delivered scope

1. Shared Aircraft cards show applicable actual AIBT/AOBT, otherwise explicitly scheduled SIBT/SOBT; absent time has a clean fallback and privacy-hidden time is labeled hidden. Never substitutes Duty/created/updated timestamps. Cross-date times retain their Hong Kong dates. Prominent airline/flight and role/type/registration hierarchy stays intact.
2. Existing detail modal now uses grouped AircraftDetails: all applicable user fields, separate leg flights/times/status/source, actual handling, bay, family/ICAO, full events/notes, linked Duty and Journal navigation, created/updated metadata. Technical IDs are not dumped. Disabled privacy groups remain hidden/archived; edit/review remains the only save path.
3. Home Add Duty / Batch Add Duties, interactive month/year calendar, multi-date selection across months, blank user-defined Day/Evening/Night/Custom templates with explicit hours confirmation, pending editing/removal/notes, totals and review. New batch entries are Confirmed + Planned; exact duplicates block saving, timed overlaps require explicit override. Stable pending IDs and guarded confirmation prevent repeated creation; storage failure keeps pending edits. Same-date shifts append independently. Hong Kong start date controls cross-midnight/month/year boundaries.
4. Optional Duty workState and shiftType extend schema version 1 without rewriting existing data. Missing legacy workState preserves original Confirmed-duty statistics; Planned is excluded indefinitely. Worked requires explicit user action and a completed shift; future/unfinished new Worked entries are rejected. Aircraft/Journal counts, IDs, associations and trash/reconnect semantics stay independent and intact.
5. All 24 existing original PNGs enabled by a separate local display manifest. Exact filename inventory is injected at build time; invalid/missing/disabled/error mappings fall back to text. Shared AirAsia/Jetstar artwork does not establish operator identity. Original reference/permission records remain unchanged and unverified. Shared component covers cards, detail, Logbook, rankings and existing editor previews. Original PNG hashes and third-party notices remain intact.
6. Header Hong Kong clock uses Intl / Asia/Hong_Kong, seconds, tabular numerals, device-clock accuracy disclosure, current-time refresh each second and on resume/focus. Cleanup removes timer/listeners; updates stay within the clock component. Bilingual new controls and responsive styling preserve five-tab navigation, radar, reduced-motion and themes.

### Compatibility and verification

- No schema rewrite/migration is needed: workState/shiftType are optional; existing version-1 payloads load idempotently and remain byte-for-byte unchanged until an explicit normal save. No reset, seed replacement, browser profile read or user data deletion is performed. Same browser origin/storage key is required; do not downgrade to v0.1.1 for Planned roster data, which that version cannot interpret.
- Baseline: 65 tests / 6 files passed before implementation. v0.1.2: **90 tests / 10 files passed**, including original Aircraft review/counting/status/filter/lifecycle checks and new card/detail, roster/conflict/compatibility, PNG and clock coverage. Two former code-only logo assertions were updated to the explicitly requested local-display policy; independent legal-approval assertions remain.
- TypeScript caught a new empty-array test-fixture inference issue; it was corrected to Database, without weakening assertions. Lint, build and formatting are run against final changes; results reported in delivery. Package and lockfile release version is 0.1.2; no dependency upgrade or additional framework/library was needed.
- Real Edge headless production preview: 375/390/430/768/1024/1440/1920 widths, light/dark; no document overflow or clock/Settings collision, loaded logos, no runtime exception or external app request. Mobile batch review/detail contained within viewport; two overnight Planned shifts persisted/reloaded while original 18 Aircraft and 3 Journals stayed unchanged. Clock advanced. Screenshots were visually inspected; ignored QA files stay under .checkpoints/v012-*.
- The first dev-server browser attempt collided with an Edge profile cache lock under .checkpoints; UI checks used production preview instead. Vite now excludes ignored .checkpoints artifacts from its development watcher so the local QA profile cannot cause that lock failure. QA browser/profile is separate from personal browser data and is stopped after verification.
- Original 24 PNG byte/hash integrity and build copies are checked; no image deletion, rename, move, compression or replacement. No additional image download or invented logo. No new open-source licence; README opening disclaimer preserved.
- New acceptance document: docs/V0_1_2_ACCEPTANCE.md. Asset audit/inventory and public asset guide updated without altering legal/provenance evidence. Restored the missing publication-document link target with current source-available boundaries; older v0.1.1 documentation below is historical.

### Known limits

Final executed checks: npm.cmd run test **90/90 passed (10 files)**; npm.cmd run lint **passed / zero warnings**; npm.cmd run build **passed**; npm.cmd run format:check **passed**; npm.cmd audit **0 known vulnerabilities**. Git diff whitespace check passed. Final original and dist PNGs match all 24 inventory hashes; THIRD_PARTY_NOTICES.md and the original AircraftEditor/seed/business regression test files remain unchanged. Development server returned HTTP 200 after watcher fix. Test servers and the separate Edge instance were stopped.

Final Git state: main, HEAD f6322c9bc805874f4310c2c2d6a87159cc9982f2 (unchanged), 23 modified tracked paths and 13 new untracked source/test/document paths; nothing staged. Generated dist/node_modules/QA artifacts remain ignored. No commit/push or other remote mutation occurred.

Actual iPhone/Safari/physical touch and full keyboard, print/download acceptance remain manual. Desktop Edge viewport emulation is not an iPhone test. Templates persist only within the open batch dialog; saved duties retain type/times/notes. Overlap detection requires recorded start/end times; untimed legacy duties cannot establish a timed overlap. localStorage remains unencrypted/origin-specific and lacks multi-tab conflict handling. Clock depends on device accuracy. Airline redistribution rights remain unverified despite owner-enabled display. No backend/auth/cloud, OCR/Excel/HR import, deployment or unrelated feature was added.

## Historical v0.1.1 public portfolio preparation — 2026-10-17

This section supersedes the historical asset-distribution statements below. The owner intends a public, source-available, non-commercial personal portfolio with retained airline PNGs; no open-source licence is granted and no standalone LICENSE is added. Publication itself is not performed here.

- README now begins with the full independent-project disclaimer, followed immediately by the TCO Logbook introduction. HAS by Cathay, Cathay Pacific, Air Hong Kong, HK Express and Airport Authority Hong Kong are explicitly named. Features, future roadmap, Windows commands, privacy limitations and source-available rights are separated accurately.
- Inventoried and visually inspected all **24 existing PNGs** in public/assets/airlines. Preserved exact filenames and SHA-256 bytes; no image deleted, moved, renamed, compressed, recolored or replaced. All remain untracked and intentionally eligible for a later reviewed commit. Source pages were supplied for CX/LH/9G; all other exact source pages are unknown. All public redistribution permissions remain unverified. See docs/AIRLINE_ASSET_AUDIT.md and docs/AIRLINE_ASSET_INVENTORY.json.
- Existing AirlineLogo, runtime registry and fallback behavior remain unchanged; zero logo paths are approved for display. Settings now distinguishes this from the owner-retained files distributed by Vite. A future separation of display enablement from redistribution permission is proposed in the asset audit, not implemented by falsely approving rights.
- Security-focused development update: Vitest **3.2.7 → 4.1.11**, @vitest/mocker **3.2.7 → 4.1.11**; tinypool **1.1.1 removed** by the updated upstream worker implementation. Version 4.1.11 supports existing Vite 7, Node 24 and jsdom; no application/test-suite restructuring or framework upgrade was needed. Existing 62 tests passed immediately after the update.
- Added 3 publication-integrity tests: exhaustive case-sensitive asset inventory, original PNG dimensions/bytes/checksums, and permission/path checks. Initial filesystem URL use failed under jsdom and was corrected to ordinary Node filesystem paths; final **65 tests pass across 6 files**.
- Added THIRD_PARTY_NOTICES.md for runtime packages and a build-only Vite hook that emits the same notice as dist/THIRD_PARTY_NOTICES.txt. This does not license airline assets or original project code. No backend, auth, live data, v0.1.2 feature or deployment was introduced.
- The owner supplied a noreply address after being asked to copy it from GitHub Settings; the migration proposal records this origin and separate-approval boundaries. No Git config or author/committer metadata was changed. The only reachable commit is still 00db414e1dcb555c3ac7c68c212c32b64cfa89d0; its personal author/committer email remains a release gate. No Gmail is printed in new documentation. See docs/PUBLICATION_PREPARATION.md for exact metadata-preserving migration, explicit remote lease verification, rollback and residual-copy limitations.

### Executed preparation checks

- Node.js **24.20.0**, npm **11.19.0**.
- npm.cmd audit — **0 known vulnerabilities**, including development dependencies (2026-10-17). This is an advisory-database snapshot, not proof that all possible security defects are absent.
- npm.cmd run test — **65 passed / 6 files** after correcting the new asset test's jsdom URL issue; all original 62 tests retained.
- npm.cmd run lint — passed with zero warnings; final verification repeated after the test-path correction.
- npm.cmd run build — TypeScript + Vite 7.3.7 passed. Local dist contains all 24 PNGs and THIRD_PARTY_NOTICES.txt. Every copied PNG matches the original SHA-256; emitted notice matches its source exactly.
- npm.cmd run format:check — passed, including new public-preparation documentation. Approved PRD and prototype brief remain excluded from formatting.
- SHA-256 comparison confirms AGENTS.md, approved PRD, prototype brief, seed data, model, selectors, storage, AirlineLogo and airline registry are byte-for-byte unchanged.
- Updated secret/identity scan: **55 owned text files plus 51 reachable text blobs**; no credential/private-key candidates, personal home paths, HKID or unexpected email addresses found. The intentionally supplied noreply address is documented. Historical personal email exists only in commit metadata, which has not been changed. No tracked/untracked .env file was found.
- Inspected all PNG chunk structures: no EXIF; KE Software metadata says Adobe ImageReady, no personal identifier; other 23 have no text metadata. Original metadata remains intact.
- No app-source network, unsafe HTML/eval sink or console logging calls were detected. No real staff/passenger records or internal operational documents were identified; public synthetic fixtures remain unchanged. This source review does not inspect browser-local user records or employer authorization.
- git ls-remote --symref origin read-only check: advertised HEAD/master still match 00db414; no other branch/tag was advertised. No fetch/push or remote-content change. Hidden refs, GitHub artifacts and authenticated visibility settings are not covered.
- Git diff whitespace check and final status recorded at completion. No staging, commit, history rewrite, force push, visibility change, deployment or destructive cleanup. Ignored local outputs/checkpoints are not intended release contents. No new actual-browser/iPhone acceptance claimed.

**Readiness:** local technical preparation completed; keep private pending separately approved and verified noreply migration, review of the final committed release candidate, and unresolved third-party rights decisions. The owner's intention to retain images is documented without treating it as legal permission.

## Historical v0.1.1 enhancement decisions (before owner asset additions)

- Preserved the existing app and business rules. Storage key `tco-logbook-demo-v0.1`, schema version 1 and seeded fixture identities/order are unchanged; no browser data reset or migration is performed. Existing user changes were left uncommitted and no destructive Git commands ran.
- Created `.checkpoints/v0.1-before-v0.1.1-20261017-020330.zip` before editing (source/config/tests/docs only, no node_modules/dist/Git/browser records). It is a local source checkpoint, not a cloud/data backup.
- Fixed the root cause of dark-theme inheritance: root foreground/background now use `--text`/`--bg` rather than fixed light-theme colors. Theme/action/disabled/focus roles live in `src/styles/tokens.css`; `.surface-dark` provides primary/secondary/muted/accent context. KPI and Duty surfaces use it; ordinary dark-mode cards receive system theme roles. No opacity fade for disabled text.
- Kept action backgrounds independent of the accent token, avoiding white text on a pale dark-mode accent. Added selected-hover colors for Timeline/Calendar. All configured text role/surface pairs meet ≥4.5:1; focus roles ≥3:1 in arithmetic tests. Real rendered contrast remains part of manual QA.
- Extracted `Radar`: stationary rings/grid/aircraft, circle-clipped CSS conic-gradient trailing fan, thin luminous beam, restrained blur, six-second transform-only linear loop. Pointer events are disabled on the decorative container. Reduced-motion removes continuous animation, with a static sweep retained. No JS animation loops or live radar data.
- One shared navigation DOM and one set of handlers: persistent desktop rail at ≥1024px; tablet layout at 768–1023px; mobile single-column content and five-item safe-area bottom navigation at ≤767px. No user-agent detection, duplicated app or data path. Forms are single-column/16px on phones; desktop dialogs and filters use available width.
- Added `src/data/airlines.ts`, `AirlineLogo`, and an owner-facing Settings reference list. **Nine name/code references, zero approved airline images bundled.** CX and LD explicitly included; LD/AHK confirmed by IATA; HX remains distinct. Aliases resolve without overwriting historical names. Manual airline entry still works.
- Asset authenticity, bundling permission and handling affiliation have separate metadata. All image permissions remain unverified, and every ramp/TCO relationship remains unverified; the HKIA source is passenger-handling information. No exhaustive HAS list is claimed. See [asset audit](docs/AIRLINE_ASSET_AUDIT.md).
- Only approved constrained local asset paths can render; unapproved/missing/error cases fall back to code/name. No runtime external logo requests. Three sizes preserve actual asset colors/proportions. SVG safety/optimization instructions are documented for future owner-supplied, licensed files; no invented test logo is shipped.
- Browser inventory again returned no apps/browsers. **No screenshots, actual viewport overflow checks, animated-frame inspection, iPhone tests or real-logo visual checks were performed.** CSS contracts do not replace a rendering engine. Exact manual matrix at 375, 390, 430, 768, 1024, 1440 and 1920px, both themes and reduced-motion: [visual acceptance](docs/V0_1_1_VISUAL_ACCEPTANCE.md).

The workflow table below continues to describe the preserved v0.1 functionality. The verification history below is labeled by version; future production items remain deferred.

## v0.1.1 executed verification

- Baseline before edits: `npm.cmd run test` — all **47** tests passed. SHA-256 comparisons against the source checkpoint confirmed the original three test files/setup, AGENTS.md, approved PRD and implementation brief remain byte-for-byte unchanged.
- Final `npm.cmd run test` — **62 passed across 5 files**: the original 47 plus 7 airline registry/fallback tests and 8 design/contrast/radar/responsive-contract tests. Palette math reads the shipped CSS; selected-hover/disabled checks substitute real theme values and pseudo-state classes because jsdom does not resolve CSS variables/real pointer states. No claim of actual pixel-layout testing.
- `npm.cmd run lint` — passed, zero warnings.
- `npm.cmd run build` — TypeScript and Vite succeeded. Added `@types/node` v24 as a development-only dependency for tests that read CSS files; no runtime service/library added. Final emitted frontend CSS 35.79 kB and JS 324.23 kB before gzip.
- `npm.cmd run format:check` — passed after the dependency/lockfile update. No original requirement documents are included in the formatter command.
- `npm.cmd run dev` and `npm.cmd run preview` — started locally at 127.0.0.1:5173 and :4173; HTML plus emitted JS/CSS returned **200**. Verification servers stopped after checks; start again with the README commands.
- Browser visual checks / actual animation frames / 375–1920px overflow measurements / iPhone / real-logo screenshots — **not performed** because no browser surface is available. See the exact [manual matrix](docs/V0_1_1_VISUAL_ACCEPTANCE.md). Zero airline images are bundled pending permission evidence, rather than implying a completed logo licence audit approved them.

## Workflow coverage

`Implemented` means functional local UI and state; `Demo-only` means deliberately limited simulation; `Deferred` is outside v0.1.

| Workflow                                   | Status      | Behavior / limits                                                                                                                                  |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home and five-item navigation              | Implemented | Home / Logbook / Add / Statistics / Journal; Settings separate; generic aircraft icon                                                              |
| Home totals and recent records             | Implemented | Derived Logged, Handled, Primary in required order; recent Duty and consistent Aircraft cards                                                      |
| English / Traditional Chinese              | Implemented | Navigation, labels, controls and domain choices switch immediately; user/demo content and standard references remain as entered                    |
| System light / dark and responsive shell   | Implemented | CSS system theme, mobile breakpoints, native dialogs, reduced-motion and print styles; visual verification pending                                 |
| Duty create / edit / detail                | Implemented | Stable IDs, same-day multiple Duties, optional shift times, +1-day display; fixed HK grouping                                                      |
| Duty selection from Quick Add              | Implemented | Unique same-date candidate auto-selected; multiple candidates require choice; user may explicitly create new Draft Duty                            |
| New Draft Duty timing                      | Implemented | No Duty created during editing or review; creation is atomic with Confirm & Save                                                                   |
| Aircraft create / edit / Draft             | Implemented | Four core fields plus editable HK Handling Date; missing fields / no actual handling cannot be Confirmed                                           |
| Review for every Aircraft save             | Implemented | Save & Close / Add Next / Draft all review; Back preserves form; cancel does not write; guarded single confirmation                                |
| Duplicate advisory                         | Implemented | Date, Duty, type, airline/variant plus enabled registration or relevant flight match; explicit keep-separate checkbox; stable-ID upsert            |
| Aircraft cards                             | Implemented | Airline + permitted flight(s) title; Role · Variant (permitted Registration) subtitle; no empty parentheses                                        |
| Registration history / lookup              | Implemented | Local matching history suggests snapshot airline/variant; user explicitly adopts; history counts and first/last confirmed encounter                |
| Public database lookup                     | Deferred    | Disabled button; no network calls or vendor decision                                                                                               |
| Optional Parking Bay                       | Demo-only   | Native searchable datalist plus custom text, uppercase with suffixes retained; small illustrative, non-verified catalog                            |
| Independent leg statuses                   | Implemented | Applicable legs only; Early / On Time / Delayed / Cancelled / Other / Not Recorded; explicit manual origin                                         |
| Gate time proposals                        | Demo-only   | HK dated SIBT/AIBT and SOBT/AOBT; exact second boundaries; explicit adoption, mismatch warning; never chocks/runway substitution                   |
| Disruption events                          | Implemented | Multiple events, category/involvement/impact/resolution, optional gated notes and Journal link; Normal + events warning                            |
| Timeline / Calendar / search               | Implemented | Newest-first by Duty date; multiple Duties per day; month navigation, selected-day list; no day-off inference                                      |
| Combined filters                           | Implemented | Handling Date, airline, family, variant, role, handling type, permitted independent statuses, disruption; private identifiers excluded from search |
| Aircraft trash / restore                   | Implemented | Confirmation with record review, recalculated stats; restore from Settings within demo 30-day window                                               |
| Duty trash / restore                       | Implemented | Preserves Aircraft and Journal, unlinks and records original association; explicit restore preview; never overwrites new links                     |
| Revision history                           | Demo-only   | Timestamp/action metadata for reviewed Aircraft saves; no previous payload snapshots or rollback/retention guarantee                               |
| Statistics                                 | Implemented | Pure selectors, disjoint type counts, Logged / Handled / Primary scope, role breakdown, rankings, monthly chart and separate leg status categories |
| Unique registrations                       | Implemented | Trim + uppercase; preserves significant separators/suffixes; ignores blanks; metric hidden while disabled                                          |
| Duty Shifts                                | Implemented | Confirmed Duties only; date filter applies independently, explicitly labeled; Aircraft in Draft Duty still count                                   |
| Disruption statistics                      | Implemented | Event count vs count of unique Confirmed assignments with events, separately from assignment disruption status                                     |
| Career Journal                             | Implemented | Create/edit/search/date/competency, Draft/Confirmed, STAR fields, tags, outcomes/unit/contribution/source/verification                             |
| Journal relations                          | Implemented | Standalone, one Duty OR multiple Aircraft; editable/unlinkable; never contributes to aircraft statistics                                           |
| Sensitive field defaults                   | Demo-only   | All six optional field groups off initially; no input/display/search/filter of disabled data; synthetic archived values retained                   |
| Field disable impact                       | Demo-only   | Count preview; choose archive/hide or explicit local field deletion; not security or company-policy authorization                                  |
| Privacy Preview                            | Implemented | Separate period, Primary vs Primary+Supporting, selected count categories and Confirmed sanitized stories; explicit review required                |
| Career counts                              | Implemented | Three distinct coordinated figures; Training excluded; Supporting scope disclosed; no Full Turnaround doubling                                     |
| JSON / CSV / PDF                           | Demo-only   | Allowlisted count/story JSON, counts-only CSV, browser print/PDF; no raw operational identifiers or links; not full backup                         |
| Seed / Reset                               | Implemented | Explicit replacement confirmation, retains language/privacy; unknown/corrupt stored copy preserved until explicit reset                            |
| Local persistence                          | Demo-only   | Validated versioned localStorage; small synthetic datasets, quota failures do not report success; no multi-tab conflict solution                   |
| PWA shell                                  | Demo-only   | Manifest, generic airplane SVG, viewport and safe-area support; not a validated installable/offline iPhone PWA                                     |
| Auth / cloud / conflict / encrypted backup | Deferred    | Clearly unavailable Settings rows; no accounts, secrets, backend, providers or external integrations                                               |
| Production import / restore / deployment   | Deferred    | No full import, hosting, paid services or production readiness claims                                                                              |

## Decisions and deliberate boundaries

- Existing repo root retained; no nested Git repository. Original requirements were not modified.
- React + Vite + TypeScript, Lucide icons, plain CSS design tokens; no chart engine needed for small derived bar charts.
- localStorage is appropriate for a bounded demo and easy Windows setup. It can be cleared by the browser; it is not cloud backup or access control.
- HK handling dates use explicit date strings; dated mock gate times are parsed with `+08:00`. Duty shift start date controls grouping, even when a matching Aircraft handling date falls on the following day. Filtered matching records remain visible under their original Duty group.
- Separate optional arrival/departure flight fields use `ARR / DEP` order in a full-turnaround card. Historical airline, variant, family and ICAO values are per-assignment snapshots.
- An incomplete Draft may have no Handling Date; review clearly marks it as an unlinked undated Draft and creates no invalid-date Duty. Timeline has a separate undated-draft group. Confirmed records always require a date.
- Seed has 6 Duties (2 on 16 October, overnight on 15 October, Draft on 14 October), 18 Aircraft, all 9 role × type combinations, repeated and missing registrations, optional flights, suffix/custom bays, a two-event assignment, a Normal-with-events warning fixture, standalone and linked Journals. All dates/shifts and `DEMO-*` identifiers are fictional, not certified actual registrations or flights.
- Cancelled status does not assert no work occurred: all Confirmed cancellation illustrations explicitly have synthetic actual handling. Unchecking actual handling forces Draft.
- Disabled values remain archived on an edit; no new disabled values enter storage. Privacy deletion clears the chosen field across records only after impact confirmation. Reports intentionally omit operational fields regardless of toggle state.
- Duplicate matching uses only permitted identifiers; if all distinguishing identifiers are disabled, the detector does not guess solely from airline/type. Advisory matching cannot prove whether real assignments duplicate one another.
- Disrupted Assignments means unique Confirmed assignments with events; the independent Normal/Disrupted/Unknown field is a separate filter. Observed events are never described as personally resolved.
- Journal entries are linked to a Duty OR an Aircraft set. Restoring a Duty does not overwrite a Journal now linked to Aircraft.
- Revision metadata is not full version history. Trash eligibility is checked at 30 days; no scheduler or permanent automatic purge is implemented.
- Report stories are selected and reviewed by the user; free text is not automatically redacted. Only synthetic text may be entered. CSV intentionally exports counts only. Browser print is the optional PDF path; no server PDF engine.
- Unsaved Aircraft, Duty and Journal changes have discard confirmation. Native modal dialogs supply browser focus containment/Escape handling; actual keyboard/focus QA is pending.

## v0.1 baseline verification history

- `npm.cmd install --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000`: succeeded, 276 packages installed; a later `npm.cmd install --save-dev prettier --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000` added the formatter. Registry/cache access required sandbox escalation. Lockfile retained.
- `npm.cmd run test`: **47 tests passed across 3 files** (domain, UI review/persistence/privacy, cross-feature lifecycle/report workflows, including undated Drafts).
- `npm.cmd run lint`: passed with 0 warnings after fixing a test variable declaration.
- `npm.cmd run build`: TypeScript + Vite succeeded; no CSS build warning after removing an empty import. Build artifacts in ignored `dist/`.
- `npm.cmd run format:check`: passed. Source, tests and app configuration use consistent Prettier formatting; original requirement documents excluded.
- `npm.cmd run dev`: Vite served `http://127.0.0.1:5173/`; HTTP check returned **200**.
- `npm.cmd run preview`: the built frontend served `http://127.0.0.1:4173/`; HTML and its emitted JavaScript/CSS assets returned **200**. Development/preview processes were stopped after verification; use the README commands to start them again.
- Browser smoke / screenshots: **not performed**. Computer-use inventory returned no available browsers/apps; in-app browser unavailable. No visual rendering or real download/print behavior claimed.
- Real Windows browser, 375px rendering, system dark contrast, native focus behavior and iPhone: **owner manual acceptance pending**, see `docs/MANUAL_ACCEPTANCE.md`.

## v0.1 vs future production

Production requires separate approval and decisions for cloud/vendor/cost/region, authentication and session security, company policy, verified/licensed reference assets/catalog, durable relational storage, true offline queues and sync/conflicts, encryption/backups/import/restore validation, full version history, HTTPS hosting and iPhone PWA validation. None are silently implemented or presented as finished here.

Historical v0.1 record: the initial scaffolding did not create a remote, push or deploy. The repository now has the owner's existing origin remote and root commit. For the current publication preparation, no staging, commit or push is authorized; follow the separate-approval boundaries in docs/PUBLICATION_PREPARATION.md.
