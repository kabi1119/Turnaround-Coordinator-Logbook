# v0.6.0 — Handling entry and linked Duty navigation

Baseline: clean main / 11d919d (v0.5.2), matching origin/main after fetch. The owner authorizes one ordinary version commit with the supplied message and a normal push after essential verification. No history rewrite, force-push, merge, reset or new backend is authorized.

## Entry/detail comparison

| Data shown in samples/details                                   | Entry after this update                                                                                  | Preservation / derivation                                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Airline, applicable flights, type/variant, handling, role, date | Existing direct controls                                                                                 | Existing prefix, conditional validation and classification rules                                           |
| Registration                                                    | Direct Aircraft Registration input; local history suggestion retained                                    | Existing uppercase handling; no permanent lookup helper or external lookup                                 |
| Parking Bay                                                     | Direct free text; required for Confirm only while privacy-enabled                                        | No catalogue/case conversion; edited input trims outer whitespace; untouched historical bytes retained     |
| AIBT / AOBT                                                     | Independent optional HH:mm controls and explicit HK date per event, directly visible for applicable legs | Dates default to Handling Date only as an input aid; no timestamp is created without a time                |
| SIBT / SOBT                                                     | Independent optional minute/date controls, alongside the actual event                                    | Never substituted into actual values                                                                       |
| Arrival/departure performance                                   | Existing independent manual status and explicitly adopted timing suggestion                              | No automatic status assignment; same early/on-time/delayed boundaries, including offset-bearing timestamps |
| Linked Duty                                                     | Existing picker; direct date/time button in details                                                      | Exact stable ID and existing return trail; missing/trashed links show unavailable without relinking        |
| Notes, disruptions, Journal references                          | Existing More Details editor                                                                             | Existing privacy, event IDs and Journal links retained                                                     |
| Family / ICAO, delay severity                                   | Derived from selected type/variant or entered disruption minutes                                         | No duplicate independently editable metrics                                                                |
| Status provenance, IDs, revisions, creation/update metadata     | Internal or existing read-only metadata                                                                  | Status source hidden in ordinary entry/review/details; original origin values remain in storage/backups    |

## Time and data convention

Schema/key and backup format stay at 1, with no migration or reseed. A new or explicitly edited timestamp uses YYYY-MM-DDTHH:mm:00+08:00. Each event has its own date, so midnight/month boundaries are explicit; no arrival-to-departure same-date ordering constraint is imposed. Time inputs display fixed 24-hour HH:mm text independently of browser locale, with a numeric mobile keyboard and automatic colon insertion for four digits (2355 → 23:55). Native date pickers remain. Optional actual times can remain independently empty. If a time is entered but its date is missing/invalid, save is blocked without discarding the form. Date-only input creates no actual timestamp.

Untouched historical timestamps retain their exact seconds, timezone and string representation even when another field is edited. Display converts valid times to Hong Kong HH:mm; clock seconds and record-activity metadata are unchanged. Unsupported historical time text is retained until explicitly edited/cleared. Privacy-disabled values remain archived; validation never requires disabled Bay or timing fields. Empty Draft and future Draft/Pending still require Review but not business completeness; Confirm still requires actual-handling acknowledgement.

## Focused acceptance

- Verify plain Bay without list/arrow/helper; blank/whitespace blocks Confirm, empty Draft works, custom case survives, disabled Bay is neither exposed nor required.
- Enter AIBT and AOBT independently with different dates across midnight/month boundaries; edit only one and verify the other raw timestamp remains unchanged. Confirm no automatic status changes or scheduled-to-actual substitution.
- Review, save and reopen; check minute-only cards, full details and History, retained IDs/links/provenance, valid full JSON backup round-trip, and old records with missing optional fields.
- Activate the linked Duty row with keyboard/touch; check correct target and return navigation. Missing or trashed references must not navigate or mutate data.
- Check desktop and 320/390px forms/details, both languages, 24-hour numeric time/date sizing and modal scrolling. Install assets online, stop the local server, reload offline and verify reviewed create/edit, persistence and Duty navigation.
- Run existing test/lint/build/static/format gates and npm audit. Push only a fully verified release; confirm main/origin alignment and report actual Cloudflare availability separately from deployment/build metadata.

Physical iPhone Safari/Chrome, picker appearance and installed-PWA keyboard behavior require device acceptance; desktop mobile emulation is not a physical iPhone test. Storage/cache retention is not guaranteed, and local data remains separate per browser/origin. No cloud/auth/upload/sync or asset/licensing changes are introduced.

## Verification results

410 tests / 31 files passed; lint, production build, static guard and formatting passed. npm audit reports zero vulnerabilities; Wrangler dry-run validates 40 static files and no bindings. Dependencies and the 24 airline assets/provenance remain unchanged.

Native isolated Edge against local Workers verified required free-text Bay, reviewed confirmed creation, independent overnight minute/date edits, explicit status adoption, unchanged Full Turnaround counts and stable record/Duty IDs. Keyboard Enter opens the exact linked Duty and returns without writing. English/Traditional Chinese forms fit 1440/390/320px widths with no horizontal overflow and mobile inputs at least 16px; actual screenshots were inspected. The final time control visibly shows 23:55 rather than a locale-dependent AM/PM value.

With the actual server stopped, offline launch, reviewed Draft/confirmed edits and reload persistence passed. Backup export, malformed rejection, explicit valid restore and quota-failure/retry safety passed in the isolated synthetic profile. The final build installed as a waiting update, activated after the old client closed, and preserved the complete stored database byte-for-byte. A final server-stopped reload and numeric 0013 → 00:13 reviewed edit/reload retained the unchanged arrival timestamp and Duty relationship. No observed startup exceptions. No real user profile or records were accessed.

These are local build/browser results; Git publication and the actual production HTTPS verification are reported separately after release. Physical iPhone Safari/Chrome and Home Screen keyboard/picker behavior remain unverified.
