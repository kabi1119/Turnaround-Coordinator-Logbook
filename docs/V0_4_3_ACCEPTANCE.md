# v0.4.3 — iPhone Keyboard & Form UX Optimization

## Investigation and compatibility

Started on clean `main`, HEAD `ccced85` (v0.4.2). The existing native Modal already had a header/body split, reference-counted body overflow locking, stable root scrollbar space, safe-area styling, reduced motion and nested review. The previous sheet listener tracked Visual Viewport **height only**; it did not account for its top offset or reveal focused controls after keyboard settling. The dialog itself scrolled, while sticky actions could cover the last fields. Validation and listbox arrows used ancestor-scrolling `scrollIntoView()`, and nested focus restoration used bare `focus()`. Aircraft/record navigation remembered the dialog scroll position. These are identified interaction risks in the code; they are not a claim of reproducing the owner's physical iOS issue.

This incremental fix reuses the existing header/body DOM structure and shared Modal. No form or application rewrite, keyboard package, native wrapper, dependency, model/schema/key, stored ID/relationship, sample, asset, privacy, statistics, attendance or lifecycle change. No migration, reset, reseed, backend, deployment, automatic commit or push. README's opening independent-project disclaimer and source-available position remain intact. Radar and clock implementations are unchanged.

## Shared implementation

- **One scroll surface:** dialog shell is a bounded flex column with hidden overflow, a stable non-scrolling header and independently scrollable `.modal-body`. Forms do not gain their own vertical scroll area. Native multiline text and scrollable option lists retain their normal inner behavior. Existing root gutter/body lock remains. Record navigation and nested reviews now remember the body surface, not the shell.
- **Viewport fitting:** the shared hook reads Visual Viewport height and `offsetTop`, calculating remaining bottom occlusion from layout dimensions. Mobile/touch portrait and landscape dialogs fit that visible range. Normal window dimensions are the optional-API fallback. Native safe-area insets remain; no fixed keyboard height, global zoom restriction or new autofocus is used. Short landscape headers retain an accessible X. Geometry changes do not remount forms or restart sheet animations.
- **Visibility only when necessary:** after focus, one queued frame checks the label, input and hint/error when they fit. Resize/viewport-scroll events update geometry and coalesce a trailing 100 ms check, rather than assuming a fixed keyboard animation duration. The calculation corrects only the body scroll position, with up to 20 px clearance and reduced clearance in small spaces. An already visible field is not recentered. Oversized field groups prioritize the control and label where feasible. Open airline choices take priority over lower-priority hint text.
- **Respect user actions:** touch/wheel scrolling cancels pending correction and suppresses automatic repositioning until another explicit field focus/reveal/tap. There is no input/keystroke measurement listener, polling, continuous RAF loop or React keyboard state. Pinch zoom is left to the browser; custom fitting and focus correction are skipped while zoomed. All viewport/window/dialog listeners and queued timers/frames clean up on unmount.
- **Save footer:** a conservative inference requires editable focus, a small/touch layout and visible height below 75% of layout height, not just a resize. During such occlusion the sticky actions become ordinary content at the end of the form. They are **not hidden or disabled**; this avoids removing keyboard/screen-reader access or changing content height. Desktop/hardware-keyboard focus and toolbar/whole-window resizes do not alone trigger the mode. This is an inference, not an OS keyboard-presence API. If a browser resizes both viewports together, fitting and visibility checks still operate; conservative footer mode may remain sticky and the reveal calculation accounts for it.
- **Next/Done:** eligible single-line text fields get a Next or Done hint on focus. Unhandled Enter advances to the next visible editable text field or blurs the final one, preventing implicit form submit. Hidden, disabled, read-only and collapsed-detail fields are skipped. Textarea Enter retains line breaks; IME composition and combobox-handled Enter remain untouched. Native date/time/select pickers keep their own keyboard behavior and receive visibility protection. Flight input stays alphanumeric with spellcheck off and fixed IATA prefixes.
- **Dropdowns and nested dialogs:** touch airline selection does not refocus a dismissed input. Touch option lists stay in the body flow with viewport-relative maximum height. Arrow navigation scrolls only the listbox, never its ancestors. Opening options requests a single visibility check; changing text does not repeatedly recenter. Review/confirmation return uses `preventScroll` and the remembered parent body position. The shared behavior also applies to Duty, batch Duty, Journal and other Modal consumers without copying controllers into each form.
- **Validation:** Aircraft's existing first-invalid-field action requests the shared post-render reveal instead of global `scrollIntoView()`. No business rule changed. Draft can still be empty; enabled/applicable flights, fixed prefixes, future Pending, explicit actual-handling attestation, mandatory review, failure/retry and statistics exclusions remain v0.4.2 behavior.

## Automated coverage

`tests/v043.test.tsx` adds 16 cases for height/offset fitting, hidden/visible fields, unchanged focus/node identity, no per-keystroke measurements, resize coalescing, manual-scroll priority, keyboard close, tiny viewports, desktop/hardware/toolbar exclusions, pinch/orientation, optional-API fallback, listener/queued-work cleanup, native picker visibility, visible options, Next/Done, multiline/IME, hidden/disabled fields, list-local scroll, touch selection, nested return and incomplete Draft preservation.

Existing business/asset/storage/backup suites remain. The historical ArrowUp test now checks actual list-local scroll and absence of global scrolling, preserving active-option/selection/Escape assertions. Record-return tests assert the actual body scroll surface. A v0.4.2 fixture now explicitly uses its frozen test date instead of the real next day's date, keeping date-sensitive validation deterministic. No assertions are bypassed, weakened or skipped.

Owner criteria map:

| Criteria                                                                   | Evidence                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1–7 visibility, labels, keyboard close, no typing recenter                 | New viewport/visibility tests; controlled browser probe                      |
| 8–15 stable header/surface/lock/nested return/layout                       | Shared lifecycle tests; real DOM bounds and repeated desktop cycles          |
| 16–22 Next/Done, suffix/prefix/focus and conditional legs                  | New keyboard/combobox tests; native Edge key dispatch; retained v0.4.2 tests |
| 23–30 Draft/review/validation/duplicates/failure                           | Retained v0.4.2 and integration/motion suites plus new Draft return case     |
| 31–40 themes, localization, viewport/orientation, data and legacy behavior | Full regression and bilingual browser matrix; real iPhone/PWA limits below   |

Final results: **338 tests passed / 24 files** (16 new keyboard cases); `npm.cmd run lint` passed with zero warnings; `npm.cmd run build` and `npm.cmd run format:check` passed; `npm.cmd audit` reported **0 vulnerabilities**. No dependencies changed. The final results are also recorded in `PROTOTYPE_STATUS.md`.

## Browser evidence and testing limits

An isolated Windows Edge profile on private LAN HTTP port 5189 passed **336 layout checks** across 320/375/390/430/768/1440 px, English/Traditional Chinese, Light/Dark and normal/reduced motion. It covers Home, empty/invalid/full/arrival-only Handling forms, confirmed review and Full Calendar, with no horizontal/dialog overflow or runtime exceptions, and unchanged stored bytes during navigation.

A separate controlled Visual Viewport **mock in Edge** passed portrait 390 × 844 and landscape 844 × 390 checks with reduced visible heights/offsets. At simulated height 320 / offset 40, the visual bottom was 360 px; the Arrival control bottom was 303.78 px, header top 49 px, dialog shell scroll 0, background scroll 0, body overflow auto and footer position static. Verified visible airline options, real key-dispatched Arrival → Departure → Done without submit, Notes line breaks/focus, zero measured-control reads while typing, manual scroll suppression, keyboard-close preservation, exact nested review return and unchanged storage. Three real desktop Add open/close cycles retained identical header/Home/metrics/sidebar x/width. Light/Dark simulated-keyboard screenshots were visually inspected. The screenshots show a constrained visible region, not a real iOS keyboard. No FPS or real-device smoothness guarantee is claimed.

**Not executed:** physical iPhone Safari/Chrome keyboards, Home Screen installation/standalone keyboard transitions, native iOS date/select panels, device rotation/toolbars, predictive text/autofill/hardware keyboards, WebKit rubber-banding and VoiceOver. The existing manifest declares standalone mode; fitting does not depend on browser-versus-standalone UA detection. This is a compatibility assessment, not a successful installed-PWA test. Windows Chrome was not independently exercised; actual browser checks used Edge. Very small visible regions may only fit the control, not its full label/hint; native scroll clamping can adjust the position as space expands. Keep pinch zoom and the X usable. Confirm these behaviors on the target phone before declaring the iOS issue resolved.

## Short real-iPhone acceptance plan

### A — New Handling

Open on iPhone Safari → central Add → New Handling Record. It should not open the keyboard automatically. Select an airline and Full Turnaround, tap Arrival and enter `450A`, use Next to reach Departure, then Done. Inspect fixed prefixes and retained values; Done must not save. Change airline and try Arrival/Departure-only; hidden fields must stay unrequired. The active control/label and options should be reachable without repeated manual repositioning.

### B — Long form and orientation

Expand More Details. Edit Registration, custom Bay, native date/time controls and Notes; type multiple lines. Open/close the keyboard and deliberately scroll away, then tap the active field again. Check no fight with manual scrolling, no repeated scroll during typing, no lost focus/values, accessible header/X and no background Home movement. Repeat portrait/landscape, small/large text, Light/Dark, both languages and Reduced Motion. When space is short, save controls should flow below the form rather than cover the field.

### C — Review and persistence

Save an incomplete Draft through the existing review; reopen and edit it. Enter review, go Back to Edit and check fields and appropriate scroll position. Attempt Confirmed save with missing fields; only applicable enabled errors should appear, and the first invalid field should be visible. Confirmed work still requires explicit attestation/review; future records stay Draft/Pending. Check no duplicate or false success. Use synthetic records only; export a separate backup before intentional data replacement.

### D — Home Screen PWA and other forms

Repeat A–C in the installed Home Screen PWA, noting differences from Safari toolbar mode. Check Edit Handling, Add/Edit Duty, batch Duty and Career Journal long fields, nested options/review, native pickers and an external keyboard if available. Do not interpret a simulated display size as installed-PWA verification.

### E — Desktop regression

On Windows Edge (and Chrome separately), open/close Add repeatedly, including a long scrolled Home/Logbook. Verify no width shift, no false keyboard mode, normal Tab/Next/Done behavior, textarea newlines, shared body scrolling, nested lock and successful reviewed saves. Stored records, confirmed totals, privacy, calendar and radar should remain unchanged.

## Changed files

- Shared interaction: `src/lib/modalInteraction.ts`, `src/lib/useModalViewport.ts`, `src/components/ui.tsx`, `src/lib/useRecordNavigation.ts`, `src/styles/v0_4_3.css`, `src/main.tsx`.
- Focus/input integrations: `src/features/AircraftEditor.tsx` (validation focus only), `src/components/AirlineCombobox.tsx`, `src/components/DutyPicker.tsx`, `src/components/FlightNumberField.tsx`.
- Tests: `tests/v043.test.tsx`, `tests/v014.test.tsx`, `tests/v040-motion.test.tsx`, `tests/v042.test.tsx`, `tests/v020.test.tsx` (version label).
- Release/docs: `src/App.tsx` (displayed version only), `index.html`, `package.json`, `package-lock.json` (root versions only), `README.md`, `AGENTS.md`, `PROTOTYPE_STATUS.md`, this document.

Suggested title, not executed: `v0.4.3 - Optimize iPhone Keyboard and Form Interactions`.
