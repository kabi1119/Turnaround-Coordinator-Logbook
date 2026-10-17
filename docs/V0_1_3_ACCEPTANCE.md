# v0.1.3 acceptance and scroll profiling

Scope: the three requested improvements only, on top of committed v0.1.2. Use synthetic test records and preserve the normal browser origin. No reset/seed is needed for upgrade.

## Manual workflows

- On New Aircraft with empty Airline, verify exactly 24 default entries from AIRLINE_CATALOGUE.md. Search LD, UO, Jetstar and AirAsia; distinct codes/operators remain. NH/SQ/HX/EK are absent from defaults, while typing/editing historical or custom values still works.
- Inspect compact previews, Home/Logbook cards, detail headers and airline rankings in light/dark. CX/UO/LH/LD/JL/QR should be legible, proportionate and uncropped. Simulate a missing file/image error: text fallback. Do not alter original PNGs.
- With an existing mixed database, open Settings → Refresh obsolete demo airlines. Check the preview, cancel and verify no change; then confirm only if the listed untouched synthetic samples are appropriate. Edited/custom/deleted-field records must remain unchanged. Repeat: no duplicate or extra change. Duty/Journal links and workload totals remain intact.
- Open Aircraft detail from a scrolled Home page. Wheel/touch/keyboard scroll through every section to actions, including separate AIBT/AOBT labels and complete events/notes. Background page must not move; clock must keep updating without resetting dialog position. Escape/close restores focus and background scrolling. Open nested Aircraft Review and close only the inner modal: background remains locked.
- Verify v0.1.2 batch roster, Planned/Worked counts, midnight boundaries, mandatory Aircraft review, privacy/export, Statistics, Journal and five-item navigation. Switch Traditional Chinese and reduced motion.

## Investigation and actual measurements

Inspected AircraftDetails, Modal, App, isolated HongKongClock, Radar and CSS. No scroll handler, layout read loop or application-wide one-second state update was found. The clock was already local to its own component. Original dialog backdrop had blur(4px), and the decorative radar remained animated behind it. These are confirmed avoidable compositing conditions, **not proof of the reported machine-specific bottleneck**.

2026-10-17 local Edge headless (GPU disabled), 390 × 850, six alternating synthesized wheel gestures per trace, using Chromium devtools.timeline traces plus requestAnimationFrame callback intervals:

| Condition                             | Callback interval P95 | Callback max | Paint events | Paint CPU total |
| ------------------------------------- | --------------------- | ------------ | ------------ | --------------- |
| v0.1.2 baseline: blur + radar running | 16.8 ms               | 16.8 ms      | 10           | 1.899 ms        |
| Temporary no-blur A/B                 | 16.7 ms               | 16.8 ms      | 12           | 1.513 ms        |
| Temporary no-blur + paused radar A/B  | 16.8 ms               | 16.8 ms      | 12           | 2.321 ms        |
| Final source changes                  | 16.7 ms               | 33.2 ms      | 10           | 0.918 ms        |

The short baseline did not reproduce obvious stutter. Counts/CPU vary across runs and trace overhead/headless rendering differ from normal hardware. Callback timing is **not measured GPU presentation FPS**; no sustained 60 FPS or percentage improvement is claimed. Final changes remove backdrop blur, pause radar while any modal remains open, and lock/restore background scroll with nested-modal accounting. No GPU hacks, new will-change, virtualization or speculative memoization were added.

Actual Edge check: dialog scrollTop stayed 200 across clock ticks, page scroll stayed unchanged, body was locked, backdrop was none and radar paused. React Profiler tests include actual Home → detail and verify clock ticks do not rerender detail. Nested-modal close, Escape cancellation and focus restoration are covered by tests.

Representative logo gallery was rendered in 375/390/430/768/1024/1440/1920 widths, both themes; all images loaded, aspect ratios remained intact and no horizontal overflow was measured. Mobile/light and desktop/dark screenshots were visually inspected. Traces, screenshot gallery and scripts are local ignored .checkpoints/v013-* QA artifacts, not public product files.

## Remaining verification

Reproduce the original issue on the owner's ordinary Edge/GPU setup, including long records and the original scroll input. Physical keyboard/touch and actual iPhone Safari performance remain manual; desktop headless emulation is not device testing. Unverified airline IP rights remain unresolved. All five required commands are recorded in PROTOTYPE_STATUS.md after final execution.
