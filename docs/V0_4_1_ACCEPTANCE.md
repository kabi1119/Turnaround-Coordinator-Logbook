# v0.4.1 — Home Dashboard & UI Fixes

## Scope and compatibility

Started on clean `main`, HEAD `21a5c88` (v0.4.0). This is a local-only presentation refinement. No models, schema, storage key, stored IDs, relationships, backup format, privacy, statistics definitions, fixtures, PNGs or legal/provenance metadata changed. There is no migration, reseed, attendance system, backend, dependency addition, automatic commit or push. The README's opening independent-project disclaimer and source-available position remain intact.

Home reuses the existing deep-green Duty card in its left column beside Recent Aircraft. The hero creation action and standalone Most Recent Duty section are removed without removing their records. Central Add, Logbook and Duty-originated Handling entry remain. View Full Calendar reuses the unchanged full calendar and its selection/return state; historical duties remain reachable there and in Logbook.

## Schedule presentation

- Eligible schedules: Confirmed + Planned, valid Hong Kong start date, no AL/SL or Trash. The Home card shows **Scheduled** only; record Draft/Confirmed remains unchanged in storage/details.
- No current interval: Upcoming Shift shows the next schedule, or a concise empty state. Complete intervals use `start <= now < end`; the start date remains the duty date for overnight/month-boundary shifts.
- Within a valid complete interval: Today's Scheduled Shift uses the primary card, with a smaller Next Shift only if another future duty exists. Time never establishes Worked/In Progress. No explicit in-progress state exists in the current model, so none was introduced.
- Missing hours never establish a current interval. Known future start times and future/undated-hours schedules display only their recorded fields, with intentional missing-time text. A past known start with no end is not inferred to be current.
- Multiple overlapping current schedules and tied next start times (including missing starts) expose all candidates as individually actionable rows. No arbitrary record ID silently selects the duty. Non-overlapping same-day shifts retain chronological order; current and next cannot share an ID.
- The clock hook updates this component approximately once a minute and on visibility change. No attendance/progress/persistence writes occur. The header seconds clock remains isolated.
- Counts are actual linked non-Trashed Aircraft records, including inspectable Drafts. Drafts remain excluded from confirmed Handling totals. View Duty opens the exact ID, retaining details, linked Aircraft navigation, editing and reviewed creation for that Duty.

## Measured desktop layout cause and fix

Before the fix, isolated Windows Edge at 1440 px had a 15 px classic scrollbar. Add changed document client width from 1425 to 1440 px: header width grew 1425 → 1440, Home/metrics 1100.21875 → 1115.21875, and the old Duty card 401.578125 → 407.25 px. Closing reversed the shift. Body overflow locking was the cause; no portal or offset rewrite was required.

Root `scrollbar-gutter: stable` now retains scrollbar space while the existing reference-counted shared Modal locks body scrolling. There is no forced `overflow: scroll` or hardcoded compensation. Three real browser open/close cycles produced identical before/during/after x/width measurements for the header, hero, metrics, Duty card and sidebar. Nested Aircraft review kept body locked after Back to Edit and restored the original overflow only after the final close. Automated nested lifecycle checks also retain the root modal class until final cleanup. Current Edge/Chrome support stable gutters; older desktop engines without support remain a compatibility limit. Overlay-scrollbar mobile layouts need no width compensation.

## Radar assessment and safeguard

The radar is an existing six-second CSS transform animation, with local SVG geography and no JS animation loop. Two alternating two-second isolated Edge samples each showed 2 layouts with the sweep paused or running. Main-thread TaskDuration was 6.26–6.84 ms paused versus 9.00–9.37 ms running over each two-second window; RecalcStyleDuration was 0 ms versus 0.12–0.24 ms. These are short synthetic desktop main-thread measurements, not frame-rate, GPU, energy or real-device smoothness guarantees.

The modal pause is relaxed only at desktop widths >=1024 px with fine pointer, hover and normal motion. Mobile/coarse-pointer and smaller layouts retain the original modal pause. Hidden documents and inactive Home always pause. Reduced Motion remains a static radar; print stays static. A cleanup-safe visibility listener updates only a decorative data attribute, without per-frame or application-wide React updates. Native animation startTime stayed unchanged through all three modal cycles. The sweep DOM also remains stable in component tests.

## Automated and browser evidence

`tests/v041.test.tsx` adds 14 regressions: eligibility, half-open interval boundaries, HKT overnight/month boundaries, incomplete/invalid times, overlapping/tied candidates, actual Draft counts, bilingual current/next cards, exact-duty actions, clock/resume with no writes, Draft detail/edit/review flow, central Add, radar visibility/listener cleanup, and nested modal lifecycle. Existing tests use the retained Add/Logbook entries in place of removed Home shortcuts and retain their review, failure, persistence and return-state assertions. The earlier upcoming-at-start assertion now expects the requested scheduled-current presentation.

Isolated headless Edge used a private LAN HTTP port and temporary synthetic browser profile, never the owner's browser data. **160 layout checks** passed: 320/375/390/430/1440 px × English/Traditional Chinese × Light/Dark × normal/reduced motion × Home current/next, Full Calendar, Add and nested review. No page/dialog horizontal overflow or runtime exceptions. Verified one dark primary card, real linked Draft count, Scheduled-only presentation, unchanged five-group/single-marker calendar, nested lock, correct current Duty/Draft navigation, originating-Duty preselection, conditional radar playback, reduced-motion static behavior and byte-identical storage through navigation. Hidden/visible radar handling used a controlled visibility-event probe; actual OS background suspension remains manual acceptance.

Final quality checks: **288 tests passed / 22 files**; `npm.cmd run lint` passed with zero warnings; `npm.cmd run build` passed (TypeScript/Vite); `npm.cmd run format:check` passed; `npm.cmd audit` reported **0 vulnerabilities**. No assertions were skipped or weakened.

## Owner manual acceptance

1. Home: no Log a Handling Task or Most Recent Duty. Central Add → New Handling Record still requires Review → Confirm & Save. Check retained Logbook and Duty-originated creation.
2. Add a future Scheduled duty, inspect its dark Upcoming card, date, HKT hours/overnight marker, real associated record count and View Duty. No Confirmed label on the Home card. Inspect/edit linked Drafts without counting them as completed work.
3. For an isolated test schedule spanning the present Hong Kong time, check Today's Scheduled Shift and smaller Next Shift. With no next shift, no empty secondary appears. Confirm the stored progress remains Planned. Check midnight, overlapping duties and tied future starts; each candidate must open the exact record.
4. View Full Calendar → select a historical date → Duty → Aircraft → back; edit and return to the same selected date. Preserve marker colors, AL/SL theme text, one marker per date, multiple duties and month navigation.
5. On desktop with a classic scrollbar, open/close Add repeatedly; header and cards must not move. Open an editor and nested review/discard; scrolling remains locked until the final dialog closes, then restores. Repeat on long Logbook/Statistics pages.
6. Normal desktop mouse layout: sweep continues subtly behind Add without restarting. Mobile/touch layout: it pauses during dialogs. Reduced Motion: static radar. Switch tabs/background the browser and return; check visibility resume, clock and interactions without attributing a measured FPS guarantee.
7. Check both languages/themes on physical iPhone Safari/Chrome, keyboard resizing, safe areas, scrolling and VoiceOver. Headless Edge viewport tests do not verify physical iPhone/WebKit behavior or low-end device performance.

## Changed files

- Home/presentation: `src/App.tsx`, `src/features/UpcomingShift.tsx`, `src/domain/homeDuty.ts`, `src/components/Radar.tsx`, `src/styles.css`, `src/styles/radar.css`, `src/styles/v0_4_1.css`, `src/main.tsx`.
- Regressions: `tests/v041.test.tsx`, `tests/v034.test.tsx`, `tests/v040-motion.test.tsx`, `tests/v040-integration.test.tsx`, `tests/ui.test.tsx`, `tests/v031.test.tsx`, `tests/v020.test.tsx`.
- Release/docs: `package.json`, `package-lock.json` (root version entries only), `index.html`, `README.md`, `AGENTS.md`, `PROTOTYPE_STATUS.md`, this acceptance document.

Suggested release title (not executed): `v0.4.1 - Refine Home Duty Cards and Fix Modal Layout Shifts`.
