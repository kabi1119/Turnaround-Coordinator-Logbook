# Prototype v0.1.1 status

Updated: 2026-10-17 (Asia/Hong_Kong). Baseline: approved PRD v1.5 + prototype implementation brief. This is a frontend demonstration with synthetic data only. No Phase 2 work has started.

## Public portfolio preparation — 2026-10-17

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

| Workflow | Status | Behavior / limits |
|---|---|---|
| Home and five-item navigation | Implemented | Home / Logbook / Add / Statistics / Journal; Settings separate; generic aircraft icon |
| Home totals and recent records | Implemented | Derived Logged, Handled, Primary in required order; recent Duty and consistent Aircraft cards |
| English / Traditional Chinese | Implemented | Navigation, labels, controls and domain choices switch immediately; user/demo content and standard references remain as entered |
| System light / dark and responsive shell | Implemented | CSS system theme, mobile breakpoints, native dialogs, reduced-motion and print styles; visual verification pending |
| Duty create / edit / detail | Implemented | Stable IDs, same-day multiple Duties, optional shift times, +1-day display; fixed HK grouping |
| Duty selection from Quick Add | Implemented | Unique same-date candidate auto-selected; multiple candidates require choice; user may explicitly create new Draft Duty |
| New Draft Duty timing | Implemented | No Duty created during editing or review; creation is atomic with Confirm & Save |
| Aircraft create / edit / Draft | Implemented | Four core fields plus editable HK Handling Date; missing fields / no actual handling cannot be Confirmed |
| Review for every Aircraft save | Implemented | Save & Close / Add Next / Draft all review; Back preserves form; cancel does not write; guarded single confirmation |
| Duplicate advisory | Implemented | Date, Duty, type, airline/variant plus enabled registration or relevant flight match; explicit keep-separate checkbox; stable-ID upsert |
| Aircraft cards | Implemented | Airline + permitted flight(s) title; Role · Variant (permitted Registration) subtitle; no empty parentheses |
| Registration history / lookup | Implemented | Local matching history suggests snapshot airline/variant; user explicitly adopts; history counts and first/last confirmed encounter |
| Public database lookup | Deferred | Disabled button; no network calls or vendor decision |
| Optional Parking Bay | Demo-only | Native searchable datalist plus custom text, uppercase with suffixes retained; small illustrative, non-verified catalog |
| Independent leg statuses | Implemented | Applicable legs only; Early / On Time / Delayed / Cancelled / Other / Not Recorded; explicit manual origin |
| Gate time proposals | Demo-only | HK dated SIBT/AIBT and SOBT/AOBT; exact second boundaries; explicit adoption, mismatch warning; never chocks/runway substitution |
| Disruption events | Implemented | Multiple events, category/involvement/impact/resolution, optional gated notes and Journal link; Normal + events warning |
| Timeline / Calendar / search | Implemented | Newest-first by Duty date; multiple Duties per day; month navigation, selected-day list; no day-off inference |
| Combined filters | Implemented | Handling Date, airline, family, variant, role, handling type, permitted independent statuses, disruption; private identifiers excluded from search |
| Aircraft trash / restore | Implemented | Confirmation with record review, recalculated stats; restore from Settings within demo 30-day window |
| Duty trash / restore | Implemented | Preserves Aircraft and Journal, unlinks and records original association; explicit restore preview; never overwrites new links |
| Revision history | Demo-only | Timestamp/action metadata for reviewed Aircraft saves; no previous payload snapshots or rollback/retention guarantee |
| Statistics | Implemented | Pure selectors, disjoint type counts, Logged / Handled / Primary scope, role breakdown, rankings, monthly chart and separate leg status categories |
| Unique registrations | Implemented | Trim + uppercase; preserves significant separators/suffixes; ignores blanks; metric hidden while disabled |
| Duty Shifts | Implemented | Confirmed Duties only; date filter applies independently, explicitly labeled; Aircraft in Draft Duty still count |
| Disruption statistics | Implemented | Event count vs count of unique Confirmed assignments with events, separately from assignment disruption status |
| Career Journal | Implemented | Create/edit/search/date/competency, Draft/Confirmed, STAR fields, tags, outcomes/unit/contribution/source/verification |
| Journal relations | Implemented | Standalone, one Duty OR multiple Aircraft; editable/unlinkable; never contributes to aircraft statistics |
| Sensitive field defaults | Demo-only | All six optional field groups off initially; no input/display/search/filter of disabled data; synthetic archived values retained |
| Field disable impact | Demo-only | Count preview; choose archive/hide or explicit local field deletion; not security or company-policy authorization |
| Privacy Preview | Implemented | Separate period, Primary vs Primary+Supporting, selected count categories and Confirmed sanitized stories; explicit review required |
| Career counts | Implemented | Three distinct coordinated figures; Training excluded; Supporting scope disclosed; no Full Turnaround doubling |
| JSON / CSV / PDF | Demo-only | Allowlisted count/story JSON, counts-only CSV, browser print/PDF; no raw operational identifiers or links; not full backup |
| Seed / Reset | Implemented | Explicit replacement confirmation, retains language/privacy; unknown/corrupt stored copy preserved until explicit reset |
| Local persistence | Demo-only | Validated versioned localStorage; small synthetic datasets, quota failures do not report success; no multi-tab conflict solution |
| PWA shell | Demo-only | Manifest, generic airplane SVG, viewport and safe-area support; not a validated installable/offline iPhone PWA |
| Auth / cloud / conflict / encrypted backup | Deferred | Clearly unavailable Settings rows; no accounts, secrets, backend, providers or external integrations |
| Production import / restore / deployment | Deferred | No full import, hosting, paid services or production readiness claims |

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
