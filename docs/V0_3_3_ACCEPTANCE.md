# v0.3.3 — Calendar & Duty Management Refinement

Local frontend only. No automatic commit, push, deployment, data reset or load-time migration. All published examples are fictional; existing independent-project, source-available and unverified third-party rights notices remain applicable.

## Delivered behavior

- Home, Logbook and Add Duties reuse `DutyCalendar` and `resolveDutyDay`. A date has at most one marker: SL, AL, unresolved Scheduled/Currently Working, explicitly Worked, then unclassified. SL wins if conflicting historical AL/SL rows coexist; every underlying record remains accessible. Scheduled stays Scheduled after its date passes. An active confirmed Scheduled time range can show Currently Working without persisting a different work state. Overnight shifts belong to their HKT start date.
- Green Worked, red Scheduled, yellow Currently Working; AL/SL are black in Light and white in Dark. A hollow neutral marker means work state not recorded or incomplete; no marker means no saved Duty. Date tooltips, accessible labels/descriptions, a legend, selection outlines and today's underlined date complement color. Calendar time refresh is local to calendar consumers, approximately once a minute and on visibility resume.
- Central Add → Add Duties supports one or multiple dates with one immutable pending-batch classification: Scheduled, Worked, AL or SL. Remove every pending entry to change classification. Apply/clear unapplied date selections before review. Review, Back to Edit, discard confirmation, storage-failure retry and repeat-submit guard remain.
- AL is date-based, has blank start/end and contributes no duty hours. Future dates are allowed. AL conflicts with same-day entries and previous-night shifts extending into that date block saving until the pending dates or existing records are explicitly resolved. Existing duties are never automatically deleted.
- SL only converts a confirmed, non-trashed, timed Planned duty without an existing leave classification. Several candidates on one date require an explicit duty ID selection. Conversion adds only `leave: "SL"`, retaining the original ID, date, times, notes, shift type, metadata and Aircraft/Journal links. No standalone SL, guessed choice, new ID or overwritten planned information. SL editor shows preserved information read-only; unchecking its explicit classification restores Scheduled, after which the ordinary editor can update the shift.
- All pending entries are validated before one database write. Invalid dates, mixed types, duplicate IDs, stale SL sources, exact duplicate shifts and unresolved AL conflicts block the entire batch. Ordinary overlapping separate shifts require explicit review acknowledgement; same-day nonoverlapping shifts remain separate.
- Home redundant creation buttons are removed; its Handling quick action and five-tab navigation remain. View Calendar opens the existing Logbook calendar. Home selection lists every saved duty on that date, including leave, with detail/edit access.
- The Add Duties sheet uses small CSS opacity/translation animations, keeps the background locked through closing, honors reduced motion and safe areas, and tracks VisualViewport height where available for keyboard resizing. No animation dependency was added.
- Statistics add confirmed Scheduled hours, actual Worked hours, Scheduled SL hours, AL dates, SL dates and confirmed Worked shifts. Date filters apply to duty start dates. Missing times add no hours. Unique leave dates are counted once. Draft/Trash, leave and planned records cannot inflate Worked counts; existing legacy confirmed-duty counting semantics remain. Aircraft metrics are unchanged and independent.

## Data compatibility and fictional calendar examples

Storage schema and backup envelope remain version 1; storage key stays `tco-logbook-demo-v0.1`. `Duty.leave?: "AL" | "SL"` is additive. Old records with no leave/work progress retain their IDs, values, links and historical statistics; calendars do not invent an explicit Worked state for absent progress. Loading does not rewrite storage. Strict full backups accept and validate the new field; use v0.3.3 or newer to restore backups containing it, because earlier app versions reject unknown fields.

Home → **Fictional calendar preview** is a read-only example calendar generated for the viewed month relative to Hong Kong today. Ordinary past dates are Worked, future dates Scheduled, today is an active Scheduled example, the 5th is AL and the 9th has SL plus a separate shift. Leave wins over ordinary markers. These generated examples never enter the user's database or statistics. The existing stable sample scenario and fingerprint-based reviewed refresh are deliberately preserved: moving fixture dates every day would invalidate safe-refresh recognition or silently change existing user records. This separation demonstrates the new statuses without guessing whether saved records belong to the owner.

## Automated verification

`tests/v033.test.tsx` covers centralized deterministic resolution, dynamic months/leap February and the mixed 9th; HKT overnight active ranges; empty/unknown/Trash cases; multi-date selection and immutable batch type; AL without hours; eligible/invalid/stale SL and preservation of every original field/link; atomic invalid-batch rejection; AL overnight conflicts; exact duplicates and explicit overlap override; separate statistics; legacy byte-preserving load and strict backup roundtrip; connected calendar updates; editable leave; reduced-motion/timer/scroll cleanup; viewport listener cleanup; bilingual labels and central Add/navigation.

Existing suites retain Aircraft mandatory review, complete details/timings, handling/status/role classification, Duty Trash/restore links, roster, Journal, storage, UUID/LAN compatibility and all airline integrity/normalization assertions. Previous Home-action assertions now test the requested central Add workflow; no tests were disabled or weakened.

Final command results and browser checks are recorded in `PROTOTYPE_STATUS.md`.

## Owner manual acceptance

1. On Home select dates with multiple shifts; open every individual detail. Choose View Calendar, navigate months, and switch to Timeline. Confirm no record is hidden by the single date marker.
2. Central Add → Add Duties: select dates across months, enter custom Scheduled hours, apply, edit/remove pending rows, review/back/review/save. Repeat for past completed Worked shifts and month-boundary overnight shifts.
3. Create future AL without hours. Try AL on an existing duty and on the end date of an overnight duty: confirm clear conflict and no save/deletion. Resolve explicitly, then save a valid date.
4. Choose SL on an empty date: confirm blocked. On a date with two Scheduled shifts explicitly choose one. Review/save, inspect the same duty ID/times/notes/links and verify the other shift is unchanged. Uncheck SL in Edit to restore Scheduled if desired.
5. Check Home/Add/Logbook markers immediately after saving. Past Scheduled stays red; a mixed completed/Scheduled date cannot appear fully completed. AL/SL have no extra dots. Open the read-only fictional preview and inspect the 9th and relative past/future dates.
6. In Statistics check Scheduled, Worked, SL and AL values separately; verify Aircraft and Journal counts did not change from leave operations. Export/import a full backup containing leave only after reviewing the explicit replacement preview; retain a backup before replacement.
7. On a physical iPhone Safari/PWA-style viewport and Windows Edge, test both themes/languages, safe areas, keyboard-open scrolling, sticky actions, close/Escape/backdrop/discard and reduced motion. Cancel or dismiss pending work and verify nothing is written. Confirm repeated final clicks cannot duplicate records.

Headless Edge viewport emulation does not verify physical iPhone Safari/WebKit, installed PWA behavior, native keyboard geometry or VoiceOver. Those remain owner acceptance. No authoritative employer leave policy, automatic attendance determination or live operational data is supplied.

## Changed files

- Domain: src/domain/model.ts, src/domain/roster.ts, src/domain/dutyCalendar.ts.
- Shared UI/time/persistence: src/components/DutyCalendar.tsx, src/components/DutyPicker.tsx, src/components/ui.tsx, src/lib/useCalendarNow.ts, src/lib/storage.ts, src/lib/backup.ts.
- Screens/integration: src/App.tsx, src/features/HomeCalendar.tsx, src/features/BatchDutyEditor.tsx, src/features/DutyEditor.tsx, src/features/Logbook.tsx, src/features/Statistics.tsx, src/i18n.tsx, src/main.tsx, src/styles/v0_3_3.css.
- Tests: tests/v033.test.tsx, tests/v012-roster.test.tsx, tests/v014.test.tsx, tests/v020.test.tsx, tests/workflows.test.tsx.
- Release/docs: package.json, package-lock.json, index.html, README.md, AGENTS.md, PROTOTYPE_STATUS.md, docs/JSON_BACKUP_RESTORE.md, docs/V0_3_3_ACCEPTANCE.md.

Private .checkpoints browser probes/results/screenshots are ignored verification artifacts and are not release files. No dependency versions, logo files, inventory/checksums or legal/provenance records were changed.
