# Agent Instructions — TCO Logbook

This repo is the **TCO Logbook Interactive Prototype v0.1**, not production.

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
- Do not start Phase 2 without explicit user approval.

Document decisions in `PROTOTYPE_STATUS.md` and execute relevant tests before completion.

## Permanent version and release commits
- Current agreed release: v0.1.4. Work only in the current Turnaround-Coordinator-Logbook repository; the former TCO-Logbook directory is retired.
- Follow [docs/VERSIONING.md](docs/VERSIONING.md): custom vMAJOR.MINOR.PATCH[letter], not strict SemVer; unrestricted numeric component widths; lowercase sequential suffixes for tiny fixes.
- Propose future versions by scope; never silently change an agreed version. Stage 0 is prototype; stage 1 requires explicit project-owner production approval. Larger feature iterations increment MINOR and reset PATCH; smaller enhancements increment PATCH.
- Release commit titles start with the version: vX.Y.Z[a] - Descriptive English Title. No feat:/fix: title prefix. Include a detailed English body covering delivered changes, compatibility and actual verification.
- Commit/push only within the current user's authorization. v0.1.4 authorizes one new local release commit after passing checks; no automatic push or history rewrite.
- The owner's explicit local-PNG display policy supersedes the earlier display-only licensing gate above; all redistribution permissions remain unverified. Preserve assets, provenance and the opening README disclaimer.
