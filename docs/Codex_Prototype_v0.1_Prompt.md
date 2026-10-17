# CODEX IMPLEMENTATION BRIEF — TCO LOGBOOK INTERACTIVE PROTOTYPE v0.1

**Project:** TCO Logbook — Personal Aviation Turnaround Logbook
**Phase:** v0.1 INTERACTIVE FRONTEND PROTOTYPE ONLY
**Source of truth:** `docs/TCO_Logbook_PRD_v1.5_APPROVED.md` (approved by project owner)
**Target:** Windows 11 + VS Code + Node.js 24 LTS + npm + Git; iPhone Safari / home-screen experience later
**Working directory:** repository root, expected `C:\Projects\TCO-Logbook`
**Language:** Deliver UI supporting English and Traditional Chinese (Hong Kong); report to user in Traditional Chinese / Cantonese where practical.

## 0. Your operating instructions — read before doing anything

1. Inspect the current repo, existing files, Git status, package configuration and approved PRD. **Do not skip reading the full PRD**. If not present at expected relative path, stop and ask the user to place it there; do not generate an imagined PRD.
2. Summarize a **concise implementation plan** with proposed structure, chosen packages, 3–5 implementation milestones and prototype exclusions. Then **proceed to implement without needing approval for ordinary local code edits or npm package installation**, subject to your execution permissions. Ask before paying for services, creating external accounts, publishing, accessing sensitive work data, or deleting existing user data.
3. Respect precedence: latest explicit user-approved decisions and this **prototype scope** govern implementation. PRD v1.5 controls product definitions. `[TECH TBD]` items remain unresolved; avoid pretending they were finalized. If there are nonblocking UI ambiguities, choose simple reversible mock behavior and document it. Ask the owner only for genuine blockers.
4. Build a **working app**, not a stack of inert visual placeholders. Every primary tab, important button and form state must be functional using **synthetic demo data**. Ensure calculations derive from current records, not hard-coded totals.
5. Work incrementally; run tests/build/lint after substantive changes, fix your own errors, and show exact commands to run. Do not claim tests pass without executing them.
6. Do not connect to external services, real work systems, Supabase/Firebase/Vercel, live airline data, cloud auth, paid products or production deployment during v0.1.
7. Do **not** begin Phase 2 or 3 until the user has reviewed and approved the prototype.

## 1. Deliverable and non-negotiable scope

Build a modern, polished, **mobile-first, responsive** interactive PWA-shaped frontend prototype that runs fully locally in a browser. All five bottom navigation items must be usable:

**Home | Logbook | Add (prominent center action) | Statistics | Journal**

Settings is accessible from a Home/header account or settings icon, **not** a fifth content tab. English and 繁體中文 (Hong Kong) are switchable; system light/dark theme supported. Use an original **simple airplane icon** for the TCO Logbook app. Use premium clean aviation aesthetics inspired by modern airline apps, but do not copy Cathay branding, logos, protected UI designs or trademarks.

**v0.1 is a FRONTEND PROTOTYPE:** local mock storage and local demo interactions only. Make this highly visible in Settings and relevant status displays: **“Prototype v0.1 · Demo Data · Stored on this device only · Not cloud synced.”** Never use plain `Synced`, `Cloud Backup Complete`, `Signed in via Face ID`, or other real-security claims when only mocked.

### In scope for v0.1
- Functional Home dashboard and recent Duty / Aircraft cards;
- Duty list/detail, multiple shifts on one day, midnight-crossing shifts;
- Quick Add Aircraft and New Duty, validation, Draft, duplicate warning, **mandatory Review Sheet before saving**;
- Editable Aircraft detail, Flight Statuses, Parking Bay, optional Flight No/Registration;
- Timeline-first Logbook, toggle to month Calendar and usable Search/filters;
- Aircraft History by registration and local-history autofill suggestions;
- Statistics including role totals, 3-way handling-type breakdown, airline/aircraft/registration ranking, date/role/status filters;
- Disruption events and linked/self-standing Career Journal with competency tags;
- Settings demo controls for language, system theme indication, simulated privacy toggles, demo data reset, demo-only export preview;
- Local persistence suitable for small synthetic datasets, and a clearly marked demo-only simulated 'no network' scenario if helpful;
- Unit tests for key counts and flight status boundary rules.

### Explicitly out of scope for v0.1
- Real backend, cloud DB, external hosting/domain, GitHub deployment, staging/prod environments;
- Real Email OTP/Magic Links, passkeys/Face ID, 30-day authenticated sessions or access-control guarantees;
- Production-grade offline sync queues, multi-device conflict resolution, server backups, secure encryption, fully trusted import/restore, scheduled backup tests;
- Live airline/airport APIs, real-time aircraft lookup, scraping HKIA operational information, integration with company systems;
- Official HKIA all-stand catalog unless independently verified and reuse permitted; a **clearly labeled small illustrative demo list** is acceptable with custom input;
- Generative AI resume writing, outbound requests to ChatGPT/LLMs;
- Public website/accounts, payment, analytics trackers, or collection of actual job information.

Provide nonfunctional Phase 2 features in Settings as **clearly disabled “Planned for future version” items**, not buttons that misleadingly simulate real cloud backups/login.

## 2. Suggested tech approach (adapt only with explanation)

- Prefer **React + Vite + TypeScript**, with clean feature-based components and centralized typed domain models.
- Style with a maintainable utility CSS/design-token approach (e.g. Tailwind CSS) or equally maintainable alternative; use **Lucide** icons. Charts may use Recharts or similarly appropriate library.
- Use browser storage (**IndexedDB** via a modest wrapper, or localStorage if justified for a limited prototype) for persisted demo records/settings across page refresh. The solution must clearly warn that browser/device storage is **not cloud backup** and can be cleared.
- All application state updates should be deterministic. Keep a single source of truth for records and derived statistics (pure selector/helper functions rather than duplicated count state).
- Implement form validation and accessible modal/dialog behavior: mobile scroll, visible focus, Esc/close handling, do not lose unsaved data unexpectedly.
- Avoid large or unnecessary dependencies, secrets, `.env` credentials, project telemetry, external assets from uncertain sources, and hardcoded real user personal information.
- Maintain a sensible file structure such as `src/components`, `src/features`, `src/domain`, `src/data`, `src/lib`, `src/i18n`, `src/styles`, `tests`; adapt to chosen setup.
- Include useful project scripts: `npm run dev`, `npm run build`, `npm run test` and ideally `npm run lint`, `npm run preview`.
- Add `.gitignore` for `node_modules`, dist/build outputs, secrets and temporary files. Keep all source within existing repo root; **do not create a nested repository**.
- Do not call `git reset --hard`, remove unrelated files or overwrite the PRD. Ask before potentially destructive changes.

## 3. Domain model and business logic — MUST MATCH APPROVED PRD

### 3.1 Duty Logs
- Each Duty has immutable internal ID; **Duty Date** determined by shift start date in **Asia/Hong_Kong**. Shift times optional; may cross midnight. Duty `Draft | Confirmed`; notes optional.
- **Multiple Duties on the same date permitted.** Duty Shifts count only confirmed Duties.
- When adding Aircraft from an existing Duty, that Duty is selected. Otherwise choose unique plausible Duty; if no suitable Duty create a **Draft Duty at save confirmation**, not while user is merely editing the form. If multiple candidate Duties fit, **ask user to choose**; never silently guess.
- Delete Duty: move Duty to demo Trash (30-day rule illustrated) and **preserve linked Aircraft/Journal**, with Aircraft assigned an `Unlinked` warning and original association retained for possible restore preview. Restore Duty: preview associations and require explicit reconnection confirmation; never overwrite relationships now linked elsewhere.

### 3.2 Aircraft Handling Record
- One actual **Aircraft Handling Assignment = one Record** (with unique stable ID). Not one record per leg; a Full Turnaround is **never doubled**.
- `Handling Type`: **Full Turnaround | Departure Only | Arrival Only** as three mutually exclusive types.
- `My Role`: **Primary Coordinator | Supporting Coordinator | Training / Observation**.
- Required for Confirmed: **Handling Date, Airline, Aircraft Type (variant), Handling Type, My Role**. Optional: registration, arrival/departure flight numbers, parking bay, notes, flight statuses, disruption status and permitted gate times. If required fields missing, allow **Draft**; exclude Draft from all formal workload totals.
- Confirmed Aircraft Record counts in aircraft stats even if linked Duty remains Draft. Trashed records do not count.
- Status (`Draft | Confirmed | Trashed`) and local storage/display status are separate concepts.
- Same registration may have multiple genuine assignments. Duplicate detection should warn about closely matching Duty/Registration/Flight Number/Handling Type but let user **confirm keeping it**.
- Don't silently normalize away significant registration or parking stand prefixes/suffixes. Preserve the stored encounter's airline/variant snapshot; later reference changes must not rewrite history.

### 3.3 Required Aircraft Card design — exact content hierarchy

Prominent large bold title: **`Cathay Pacific CX450`**
Smaller subtitle: **`Primary Coordinator · A350-1000 (B-LXI)`**

Apply consistently in **Home, Duty detail, Timeline, expanded Calendar day and Search results**.
- If no flight number: title `Cathay Pacific`.
- If no registration: subtitle `Primary Coordinator · A350-1000`; no empty parentheses.
- If full turnaround has 2 flight numbers: suggested compact title `Cathay Pacific CX450 / CX451`; store separate optional arrival/departure flight-number fields and test truncation/wrapping on narrow mobile screens.
- All examples are **synthetic illustrations**. Do not present them as factual real operations.

### 3.4 Flight Status vs Disruption Status
- Separate **Arrival Flight Status** and **Departure Flight Status**. For Arrival-only show/allow arrival; for Departure-only show/allow departure; for Full Turnaround allow both independently.
- Options for each: **Early | On Time | Delayed | Cancelled | Other | Not Recorded**, default **Not Recorded**, all optional.
- Separate independent Assignment-level **Disruption Status: Normal | Disrupted | Unknown**; default Unknown. An On-Time flight may still have disruptions, and delay does not imply a recorded disruption event. If Disruption Events exist but Assignment marked Normal, show an inconsistency warning, don't auto-delete.
- Optional gate/stand scheduled/actual times (where enabled) are **not** the 4 required Quick Add fields. Gate arrival = scheduled in-block vs AIBT; gate departure = scheduled off-block vs AOBT; **chocks on/off are not automatically interchangeable with gate time**, and runway landing/takeoff is not used for this classification.
- Exact personal classification using *actual minus scheduled* in seconds:
  - Delta **< -900 seconds** -> Early
  - **-900 <= Delta < 900** -> On Time
  - **Delta >= 900** -> Delayed
  - E.g. scheduled 10:00:00; 09:40 Early, **09:45 On Time**, 10:14:59 On Time, **10:15:00 Delayed**.
- Distinguish `manual/self-reported` statuses from statuses proposed using mock scheduled/actual gate times. If both populated, display suggested classification with explicit origin and manual confirmation; never quietly overwrite a user's selection. Support passing date/time across midnight in HK timezone.
- These labels are **personal logbook categories**, not HAS or airline official OTP figures. Cancelled/Other/Not Recorded separate; no unfounded airline-wide KPI.
- Do not record cancelled-only flights as Confirmed Handling Assignments when no actual handling occurred.

### 3.5 Parking Bay
- Optional search-and-select **Combobox** plus free text entry (case normalization where sensible). Preserve `S25` vs `S25R`, `W121L` etc. Allow values absent from catalog; don't block save.
- You may seed a **small expressly non-exhaustive illustrative list** of known-shaped bay identifiers with disclaimer `Demo suggestions only — not a verified current HKIA stand catalog`. Do not invent a complete airport database or scrape sources for the prototype.
- Make parking bay subject to privacy toggle; disabled -> no new entry, display or export of existing restricted field in ordinary views.

### 3.6 Disruption Events
- One Aircraft Record may have several events. Categories: Weather; ATC Restrictions; Late Inbound; Aircraft Technical; Baggage/Loading; Passenger/Boarding; Ground Handling; Other Operational.
- Involvement: Observed | Assisted | Coordinated | Escalated. Impact: Minor | Moderate | Major (subjective, nonofficial). Resolution: Resolved | Escalated | Handed Over.
- Distinguish **Disruption Events count** from **Disrupted Assignments count**, which is count of unique confirmed assignments with >=1 event.
- Allow sanitized synthetic notes and a link to Career Journal. Do not imply observed = personally resolved.

### 3.7 Career Experience Journal
- Standalone or linked to one Duty **or multiple Aircraft Records**. Work experiences outside HAS TCO allowed here, but excluded from TCO aircraft metrics.
- Fields: Title/date, Status Draft/Confirmed, Situation, Challenge, My Responsibility, My Actions, Result, Learning, competency tags and optional quantified outcomes, units, personal contribution, evidence/source/verification classification.
- Suggested competencies: Problem-solving, Decision-making, Leadership, Communication, Organising, Safety Awareness, Stakeholder Coordination, Time Management, Customer Service, Continuous Improvement.
- Entries can be created, edited, searched, linked and unlinked. No AI writer.

## 4. Home and navigation behavior

- **Home** first presents app name/airplane icon, date (Hong Kong), account/Settings, three prominently labeled metrics in this order: **Total Aircraft Logged, Total Aircraft Handled, Primary Coordinator**. These are different metrics; do not add them together.
- Current/Recent Duty card shows date, optional shift times, linked record counts/status. Recent Aircraft cards use exact 2-line hierarchy. Quick access to add Aircraft/Duty/Journal. Optional small activity preview.
- **Logbook** opens in **Timeline** mode by default, newest first, grouped by Duty date with multiple Duty rows per date. Switch to Calendar. Dates with no record aren't automatically “day off”. Search and filters operate on current local records, not static examples.
- **Add** center navigation action opens choice/modal for `New Aircraft`, `New Duty`, `New Career Journal` (or straight to Quick Add with obvious alternative actions), with obvious back navigation.
- **Statistics** shows basic totals, period filters (lifetime/year/month/custom as feasible), airline/type/variant/family/registration rankings, monthly trend, role breakdown, 3-way type breakdown, arrival/departure statuses separately, disruptions; supports combined filters.
- **Journal** shows entries/drafts, search by competencies and date, create/edit/detail. Counts do not pollute aircraft statistics.
- **Settings** offers language switch, system-theme status, mock privacy field toggles, local demo-reset with confirmation, prototype disclaimer; show future auth/sync/cloud features as clearly `Not available in v0.1`.

## 5. Quick Add must be truly usable

- Mobile-first single-screen form; visible **four required core fields** (Airline, Aircraft Type, Handling Type, My Role), default Hong Kong handling date editable; keep optional flight number near Airline while visually unobtrusive; expandable More Details for Registration, Parking Bay, Arrival/Departure Status, permitted gate times, Disruption, notes.
- Registration manual lookup in **local seeded history** can suggest last known Airline/Type; user can override. `Search Public Database` is **disabled with “Future feature — not connected in prototype”** rather than making real network calls.
- For Arrival-only, render Arrival Status only; Departure-only, Departure Status only; Full Turnaround, both independently. Display optional flight numbers accordingly.
- `Save & Close`, `Save & Add Next`, `Save Draft` must all route through a **mandatory working confirmation sheet** showing date, selected Duty (or Draft Duty to be made), airline + flight numbers, aircraft type + optional registration, role, handling type, parking bay if enabled, relevant leg statuses, other selected details, expected Draft/Confirmed status.
- Actions: `Back to Edit` must preserve entered form fields, `Cancel/close` must never write, `Confirm & Save` is sole point writing to local demo storage. `Save & Add Next` resets the form after confirmed save while preserving user-chosen Duty and helpful safe recents. A fully missing required field cannot become Confirmed; user can save Draft via review.
- Duplicate warning before the final confirmation when likely duplicate, with explicit `Keep as separate assignment` option.
- When saving, display **`Saved on this device (prototype)`**, not `Cloud Synced`. Never falsely claim offline cloud upload.
- Support edit existing Aircraft records, trash/restoration with confirm, and corresponding stat recalculation.

## 6. Statistics — strict identities (implement in pure functions + tests)

All workload sums consider **Confirmed AND non-Trashed Aircraft Assignments**, respecting active filters, and distinguish role. Draft, Trashed and Career Journal entries do not contribute.

- `P` = Primary; `S` = Supporting; `T` = Training/Observation.
- **Total Logged = P + S + T**.
- **Total Handled = P + S**.
- **Primary = P**, already included in Logged and Handled; never add to Handled as an extra component.
- **Full Turnaround Count**, **Departure-only Count**, **Arrival-only Count** are disjoint counts per assignment and should each offer `Logged | Handled | Primary only` views.
- At same filter scope, three Handled breakdown counts sum exactly to Total Handled, and all Logged type breakdown counts sum to Total Logged.
- Sample with *handled-only*: 40 full + 25 dep-only + 15 arr-only = **80 handled**, not 120. Add 10 Training -> **90 logged**, still 80 handled. Never count turnaround's arrival/departure legs as separate assignments.
- Regression fixture Primary 300 + Supporting 100 + Training 50 -> Logged **450**, Handled **400**, Primary **300**.
- Unique Aircraft counts distinct normalized nonblank registrations; without registration still in Logged/Handled but excluded from unique registration count.
- Ranking and 'for fun' counts include all three Handling Types and also Training if view is Logged/encounter view. Be honest about whether count is unique airframe or encounters.
- Arrival status counts include arrival-only + full turnaround *arrival legs*; departure status counts include departure-only + full turnaround *departure legs*. A full turnaround contributes at most one arrival category AND one departure category; **this does NOT increment assignment count twice**.
- Disruption Event count vs unique disrupted assignment count separately; one confirmed assignment with 2 disruption events => 2 events, 1 disrupted assignment.
- Filters for date range, airline, aircraft family/variant, role, handling type, Arrival Status, Departure Status, disruption status must compose correctly. Under date filter, use Handling Date/Duty Date semantics, never record creation timestamp.
- Career-related summary/report demo shows **three distinct figures**: `Full Turnarounds Coordinated`, `Departure-only Assignments Coordinated`, `Arrival-only Assignments Coordinated`; default exclude Training and indicate whether includes Supporting. Avoid generating a CV claim that implies supervision of work only observed.

## 7. Privacy / reports / demo export UI

- Start with **restrictive, off-by-default toggles** for work-sensitive optional data: Registration, Flight Number(s), Parking Bay, fine-grained Gate Times, Flight Statuses, detailed Disruption Notes. These are **UI/demo field controls only**, not a promise of real-world security. If field disabled, do not offer it for input or regular display/filter/AI-friendly export. Offer demo-only archive/delete-preview path rather than silently erasing existing values when toggled off.
- All data must be **synthetic** (including dates, roles, flights, registrations, parking stands, notes). Public airline names/types are fine, but demonstrate no actual shift worked by the user. Do not seed actual personal information or proprietary operational facts.
- No airline brand logo should be synthesized or approximated. **Default to Airline Name / IATA Code only** unless verified, properly licensed official image assets already exist. App logo is a generic aircraft icon.
- Demonstrate a working **Privacy Preview** screen choosing period, role scope, count categories and selected sanitized Career Journal stories. Clearly label as demo and include example three-way career counts.
- For prototype, exporting a **sanitized demo JSON/CSV** is helpful if straightforward; optional PDF via browser Print/Save as PDF from preview is acceptable (no heavy server PDF engine). **Never label this as secure full backup**, or claim these documents are employer-verified. Future full backup/restore/cloud backup remains Phase 2.
- Provide one-click **Reset Demo Data** and Seed Demo Data, both with explicit confirmation to prevent accidental loss.

## 8. Demo data and usability test fixtures

Seed enough plausible but **clearly synthetic** examples for visual interest and edge cases:
- At least 2 Duties on same day, 1 midnight-crossing Duty, 1 Draft Duty, and 1 confirmed Aircraft linked to Draft Duty;
- All 3 Handling Types x all 3 Roles, with early/on-time/delayed/cancelled/not-recorded statuses represented where logically applicable;
- At least one Full Turnaround with arrival delayed and departure on time;
- Optional flight numbers and registrations both present and missing, including a registration repeated for separate assignments;
- Stand examples with letter suffixes (`S25R`, `W121L`) and a non-listed custom entry; mark list illustrative, **not verified comprehensive HKIA data**;
- A single assignment with 2 disruption events; a few career stories (standalone and multi-linked); duplicates possible for warning tests;
- Include date ranges supporting charts/filters and sample cards with believable airline/aircraft types, but use visibly fake flight/registration/shift combinations and `DEMO` labels.

If demo placeholders do not satisfy real-world registration patterns, do not imply they are certified valid aircraft registrations; permit mock values in `demoMode` and document that choice.

## 9. Quality, accessibility, tests

### Automated tests (at minimum)
1. 15-minute Flight Status edge boundaries `-15m-1sec`, `-15m`, `+14m59s`, `+15m`.
2. Full Turnaround single assignment vs split leg statuses.
3. 40/25/15 handled = 80; 10 training -> 90 logged / 80 handled.
4. P=300, S=100, T=50 -> 450/400/300.
5. Unique Registration normalization and missing registration.
6. Draft/Trashed excluded, Confirmed Aircraft linked to Draft Duty included in Aircraft stats, Draft Duty excluded from Duty Shifts.
7. 2 Disruption Events for same assignment => Event Count 2, Disrupted Assignments 1.
8. Combined filters correctness for date/type/role and arrival/departure statuses.
9. Saving requires review confirmation: Back to Edit preserves form; cancel makes no record; Confirm saves once; Save & Add Next follows proper flow.
10. Duplicate warning is advisory and allows legitimate separate assignment.
11. Disabled privacy field not included in standard demo report/export, no empty parentheses in cards.
12. Multiple Duties per date, midnight grouping to Shift Start Date in Asia/Hong_Kong.

Use Vitest (and React Testing Library where worthwhile) or equivalent. For UI, provide a manual test checklist for iPhone narrow viewport and Windows. If practical, run browser smoke tests and capture a screenshot; do not claim having physically tested on iPhone unless that happened.

Accessibility: labeled inputs, keyboard navigation, touch targets >= ~44px, focus management and close behavior for modals, contrast in both themes, no horizontal overflow at 375px mobile width, useful empty states.

## 10. Work plan and completion definition

**Milestone 1 — Scaffold and design system:** Package setup, scripts, tokens, fonts/system-theme, i18n, responsive shell + 5-tab navigation + landing demo Home. Confirm build works.

**Milestone 2 — Typed data + local persistence + core forms:** Models, seeded synthetic data, Duty and Aircraft CRUD, Quick Add, review-before-save, draft/duplicate, parking bay combobox, flight status, card display.

**Milestone 3 — Logbook, filters, stats:** Timeline/Calendar, Aircraft history, fully derived role/type counts, rankings, leg-status filters and chart(s).

**Milestone 4 — Journal, privacy demo, QA:** Linked Journal, disruptions, demo privacy/export preview, reset demo data, accessible UI, robust tests and README.

Implement and test milestone-by-milestone. If a large PRD feature is intentionally represented by a demo/nonproduction interaction, identify it clearly and explain why; don't silently skip it.

At the end deliver:
- A running app (`npm run dev`), build/test/lint output (show exact commands and observed results);
- Short **README.md**: prerequisites, setup, run, project structure, test, demo-data reset, current limitations and iPhone LAN/HTTPS limitations;
- `PROTOTYPE_STATUS.md` tracking each requested UI workflow as `Implemented / Demo-only / Deferred`, and a clear **v0.1 vs Future Production** gap list;
- A **manual acceptance checklist** referencing PRD sections;
- Summary in Traditional Chinese/Cantonese explaining what changed, what to review on Windows, and how owner can test iPhone later;
- Git checkpoint suggestion/commit as permitted by repository/tool permissions; no forced pushes or remote creation.

**Stop after v0.1.** Do not commence backend, cloud integration, real authentication, or paid/deployed infrastructure without owner approval.
