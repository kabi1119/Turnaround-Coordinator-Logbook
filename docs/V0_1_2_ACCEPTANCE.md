# v0.1.2 acceptance checklist

Use synthetic records only. Start from this repository with Node 24 and npm.cmd ci, then npm.cmd run dev. Keep the same origin/port for existing browser records. Do not clear storage or seed/reset as part of upgrade testing.

## Aircraft cards and detail

- Enable optional synthetic flight/registration/bay/status/gate fields in Settings. Open each handling type from Home, Timeline and Calendar.
- Arrival Only shows AIBT or explicitly Scheduled SIBT; Departure Only shows AOBT or Scheduled SOBT; Full Turnaround shows both applicable events while counting once.
- Remove actual times on a synthetic test record; scheduled times must be labeled. Remove both; Time not recorded appears. A Duty shift time or creation timestamp must never replace a missing aircraft time.
- Disable privacy groups: card/detail/editor/review must hide archived values without deleting them. A hidden time is labeled hidden, not missing.
- Detail groups show airline/code, date, type/variant/family/ICAO, optional identifiers, role, state, actual handling, separate legs/status sources, all event participation/impact/resolution/notes, Journal links and creation/update times.
- Open linked Duty/Journal, edit a synthetic Aircraft, Back to Edit/close Review without saving, then Confirm & Save. No pre-confirm write or duplicate submission. Test long notes and empty optional fields.

## Monthly roster

- Home Add Duty and Batch Add Duties work on mobile/desktop; central Add and all five navigation items remain.
- Choose November 2026; select 5, 6 and 30. Day/Evening/Night/Custom start blank. Enter arbitrary personal test hours, explicitly confirm them, then apply. Repeat with another template; switching/editing template hours requires renewed confirmation.
- Change an individual pending date/type/start/end/note; remove another entry. Switch months without losing pending entries. Back from Review retains edits. Close/discard saves nothing.
- Use 30 November 22:00 → 06:00: review must say 1 December 06:00, Duty date remains 30 November HKT. Repeat 31 December → 1 January. Equal start/end is invalid.
- Add two non-overlapping shifts on one date: both save. Exact duplicate pending/saved shifts block final confirmation until edited/removed.
- Test same-day and cross-date overlaps against pending and saved Duties. Explicit overlap override is required in Review; adjacent end/start boundaries are allowed. Trashed shifts do not create conflicts.
- Confirm batch once and double-click: exactly one set of stable IDs is created. Reload: all remain, Aircraft/Journal relationships unchanged. A failed storage write must retain pending entries without claiming success.
- New batch is Confirmed + Planned, excluded from Worked Duty Shifts. Elapsed dates do not automatically mark Worked. Edit a completed past shift to Worked, then verify counts; future/unfinished Worked entry is rejected. Legacy v0.1.1 Confirmed Duty counts retain their original meaning.

## Logos and clock

- Verify CX, LD and UO original PNGs; HX has no image and shows HX. Check each mapped code against the inventory. AK/QZ/Z2 names remain distinct despite identical brand artwork; GK means Jetstar Japan, not JQ/3K.
- Test light/dark frame, small/medium/large sizes, long airline names and manual selection preview. Simulate image failure in DevTools: code fallback, no broken image. All logo requests stay same-origin; legal permissions remain unverified.
- Header shows Hong Kong date/weekday and seconds HKT beside Settings. Set a different device timezone: Hong Kong output stays correct. Test device-clock adjustment, midnight rollover and a suspended/background tab returning to focus. Device clock accuracy limitation remains visible/available.

## Responsive and accessibility

- Inspect widths 375, 390, 430, 768, 1024, 1440 and 1920 in both themes. No horizontal overflow or clock/Settings overlap; batch/calendar/pending/review/detail dialogs scroll vertically and actions remain reachable.
- Verify keyboard date selection, focus containment/Escape, 44px controls, readable normal text, reduced-motion radar and safe areas. Change to Traditional Chinese and repeat new workflows.
- Real iPhone Safari/physical touch acceptance is separate from desktop Edge viewport emulation. Do not claim device verification from these screenshots.

## Executed local evidence

2026-10-17: Edge headless production preview at 127.0.0.1:5174 checked the seven widths above in light/dark. DOM measurements found no document overflow or clock/Settings intersection; displayed logos loaded. Mobile batch edit/review and Aircraft detail stayed within the viewport without horizontal overflow. A two-night-shift batch persisted as 8 total Duties / 2 Planned, preserving 18 Aircraft and 3 Journals; reload worked. Clock advanced; no runtime exceptions or external application requests were observed.

Local screenshots and the CDP check script are ignored under .checkpoints/v012-*. They are QA artifacts, not public screenshots. Selected mobile/light, desktop/dark and mobile batch-review screenshots were visually inspected. An initial development-server watcher collided with the separate Edge profile cache; checks used production preview instead. Neither personal browser profile nor real records were accessed. Further real-browser keyboard/touch, print/download and iPhone testing remains manual.
