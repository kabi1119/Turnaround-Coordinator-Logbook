# Agent Instructions — TCO Logbook

This repo is **TCO Logbook v0.3.1 Pre-release**, a local frontend personal-tool prototype, not production.

## Required reading

1. `docs/TCO_Logbook_PRD_v1.5_APPROVED.md` — authoritative approved PRD (product rules).
2. `docs/Codex_Prototype_v0.1_Prompt.md` — implementation contract and v0.1 scope.

## Non-negotiables

- Do not use real or user-specific HAS operational information. Synthetic demo data only.
- Never invent airline brand logos. Use text/IATA-code fallback unless official licensed assets are verified.
- A Full Turnaround is **one** Handling Assignment. Departure-only and Arrival-only are separate mutually exclusive handling types; all 3 contribute to Logged. Training does not contribute to Handled or Career coordinated counts.
- Preserve Arrival and Departure statuses separately; early < -15 minutes, on time from -15 inclusive to +15 exclusive, delayed >= +15 minutes; use stand/gate times, not chocks/landing/takeoff interchangeably.
- Every Aircraft save requires explicit review sheet + confirm.
- Parking Bay is optional, search suggestions + custom input; no invented 'official complete' HKIA catalog.
- v0.1 uses local demo storage only; do not claim cloud sync/auth/backup/privacy guarantees.
- UI: Home | Logbook | Add | Statistics | Journal; Settings separate; airplane icon; two-line Aircraft cards with Airline+FlightNo title.
- Keep project code outside OneDrive, in current repo root, and do not create nested Git repo.
- Do not start Phase 2 without explicit user approval. v0.3.0 includes only local UI, aircraft classification and explicit full JSON backup/restore; it does not authorize production/backend work.

Document decisions in `PROTOTYPE_STATUS.md` and execute relevant tests before completion.

## Permanent version and release commits

- Current agreed release: v0.3.1 Pre-release. Work only in the current Turnaround-Coordinator-Logbook repository; the former TCO-Logbook directory is retired.
- Follow [docs/VERSIONING.md](docs/VERSIONING.md): custom vMAJOR.MINOR.PATCH[letter], not strict SemVer; unrestricted numeric component widths; lowercase sequential suffixes for tiny fixes.
- Propose future versions by scope; never silently change an agreed version. Stage 0 is prototype; stage 1 requires explicit project-owner production approval. Larger feature iterations increment MINOR and reset PATCH; smaller enhancements increment PATCH.
- Release commit titles start with the version: vX.Y.Z[a] - Descriptive English Title. No feat:/fix: title prefix. Include a detailed English body covering delivered changes, compatibility and actual verification.
- Commit/push only within the current user's authorization. The v0.3.1 request does not authorize an automatic commit or push. Preserve existing changes and history.
- The owner's explicit local-PNG display policy supersedes the earlier display-only licensing gate above; all redistribution permissions remain unverified. Preserve assets, provenance and the opening README disclaimer.

## v0.2.0 presentation and samples

- Full product name only in the upper-left brand; TCO Logbook elsewhere. Release metadata belongs in the lower sidebar/footer, not an upper status strip.
- Use local SVG/CSS for the decorative approximate East Asia radar map; no map API/tiles or live tracking claim.
- Keep new sample data fictional without visible DEMO prefixes. Preserve disclosure in Settings, report notices and documentation; never strip or rewrite user-entered text automatically.
- Keep frozen historical fixtures for safe reviewed sample refresh. Only exact unchanged fixtures may be replaced; user edits and retained links block removal. No automatic reseed/reset on upgrade.
- Batch hours require valid input and final review/save, without the former chosen-hours acknowledgement checkbox. Keep duplicate/overlap handling and Planned/Worked rules.

## v0.3.0 owner-approved scope

- Latest owner instructions supersede old implicit Draft Duty creation and off-by-default fresh field preferences. Save unlinked Aircraft through mandatory review; fresh installations enable six fields, existing preferences and deleted values stay unchanged.
- Preserve native/getRandomValues UUID compatibility on LAN HTTP. New aircraftType/delayMinutes and historical impact are optional; no automatic storage migration or ID rewrite.
- Use centralized Airbus/Boeing type/variant references. Never silently rename historical/custom identity snapshots.
- Delay severity uses entered whole disruption minutes, never inferred flight causation; preserve historical operational impact independently.
- Full backups are explicitly unencrypted and separate from report exports. Strict validate/preview/confirm before atomic Restore / Replace; block unsafe versions, keys, IDs, links, stale previews and failures. Never clear storage or partially import. No PDF import or complex merge.

## v0.3.1 presentation rules

- Home action: Log a Handling Task. New/edit/review interface: Handling Record. Formal statistics: Handling Assignments. Preserve Aircraft models, backup JSON keys, local storage and all saved values.
- Use the shared non-mutating airline ordering helper: default CX/UO/LD then 21 English names A–Z; active search filters matches without pinned unrelated identities. Preserve logos, aliases and custom text.
- Duty-picker labels show work progress only: Planned → Scheduled, Worked → Worked; absent progress is explicitly not recorded. Never infer Worked from dates or change legacy statistics. Keep HK shift-start date, 24-hour times and overnight (+1).
