## Disclaimer & Independent Project Notice

**TCO Logbook is an independent, non-commercial personal software project developed for educational, portfolio, and aviation enthusiast purposes.**

**This project is NOT affiliated with, sponsored by, endorsed by, authorized by, or officially associated with:**

- **HAS by Cathay (Hong Kong Airport Services Limited)**
- **Cathay Pacific Airways**
- **Air Hong Kong**
- **Hong Kong Express (HK Express)**
- **Airport Authority Hong Kong**
- **Any other airline, airport operator, ground handling company, or aviation organization**

TCO Logbook is not an official airline, airport, or ground handling operational system.

Any references to airline names, airport facilities, aircraft types, airline identifiers, logos, or aviation-related terminology are included solely for identification, reference, demonstration, or educational purposes.

All third-party airline names, trademarks, logos, and other brand assets remain the property of their respective rights holders. The presence of any airline branding does not imply a commercial relationship, endorsement, sponsorship, or official authorization.

**This disclaimer does not itself grant permission to reproduce or redistribute third-party intellectual property. Such assets remain subject to applicable rights and permissions.**

All publicly distributed demonstration records and operational scenarios are synthetic and do not represent an official HAS or airline operational database. No confidential employer information, real passenger information, internal company documents, or proprietary operational records are intended for public distribution.

**TCO Logbook is a personal software prototype and must not be used as an official operational, safety-critical, or production aviation management system.**

---

# TCO Logbook

**A personal aviation operations logbook and career development companion.**

TCO Logbook is an independently developed aviation-oriented web application prototype for organizing, reviewing, and reflecting on aircraft handling assignments, duty shifts, recorded flight activity, and professional experiences. The current **v0.1.1** runs locally with synthetic demonstration data.

## About the Project

Inspired by an interest in aviation and ground operations, this project explores how a structured personal record can turn experience into meaningful statistics and career reflections. It is designed for aviation enthusiasts and people interested in a modern, mobile-friendly digital logbook.

This is a non-commercial personal portfolio project. It was not commissioned by, developed for, or endorsed by an aviation organization.

## Features

- **Aircraft Handling Logbook:** Full Turnaround, Departure Only and Arrival Only assignments; Primary Coordinator, Supporting Coordinator and Training / Observation roles; Draft and Confirmed records; airline/aircraft details plus optional registration, flight and parking-bay fields under demo privacy controls. Every Aircraft save requires Review → Confirm & Save. Arrival and Departure statuses remain separate.
- **Duty Management:** Multiple duties on one date, optional shift times, cross-midnight shift grouping and linked aircraft records. Trashing a duty preserves its aircraft records and offers explicit reconnection when restored.
- **Dashboard:** Home totals, recent activity and an animated decorative radar with reduced-motion support. It is not live radar or flight tracking.
- **Statistics:** Date and combined filters, airline/aircraft rankings, monthly trends, role breakdowns and three mutually exclusive handling types. One Full Turnaround counts as one assignment. Logged includes Training; Handled and career coordinated counts exclude Training. Primary is a subset, not an extra amount to add to Handled.
- **Career Journal:** Standalone or linked reflections, STAR-style fields, competencies, Draft/Confirmed status and optional self-reported outcomes. Journal entries do not increase aircraft handling counts.
- **Reports and local controls:** Privacy Preview, reviewed JSON, counts-only CSV and browser Print / Save as PDF; local Trash/restore and confirmed Seed/Reset actions. These are demo tools, not full backups or automatic anonymization.
- **User experience:** Home | Logbook | Add | Statistics | Journal, separate Settings, responsive desktop/mobile layouts, English / Traditional Chinese interface and system light/dark themes. Entered content and standard aviation references retain their original language.

## Screenshots / Preview

Screenshots will be added after manual visual acceptance using synthetic data only. No screenshots are included or linked here yet.

Run the local prototype with the instructions below. The [visual acceptance checklist](docs/V0_1_1_VISUAL_ACCEPTANCE.md) covers both themes, reduced motion and seven viewport widths. Automated tests do not establish actual iPhone or pixel-layout acceptance.

## Technology Stack

React 19, TypeScript 5.9, Vite 7, plain CSS/design tokens, Lucide React icons and browser localStorage. Tests use Vitest 4 with jsdom and React Testing Library. ESLint and Prettier provide code checks. There is no backend framework or external data service.

## Getting Started

Use **Node.js 24 LTS**, npm, Git and a modern Edge/Chrome browser. This preparation was tested with Node.js 24.20.0. No environment variables, accounts or database setup are needed.

For a new checkout, once you have repository access:

```powershell
git clone https://github.com/kabi1119/TCO-Logbook.git
cd TCO-Logbook
npm.cmd ci
npm.cmd run dev
```

For the existing Windows checkout, open PowerShell in `C:\Projects\TCO-Logbook`, run `npm.cmd ci` if needed, then `npm.cmd run dev`. Using `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue without changing system policy.

Open the address printed by Vite, normally `http://127.0.0.1:5173/`. If that port is occupied, use the address actually printed. Stop with `Ctrl+C`.

### Checks and local build preview

```powershell
npm.cmd audit
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run format:check
npm.cmd run preview
```

Tests run once; `npm.cmd run test:watch` starts watch mode. The build runs TypeScript checks and writes local files to ignored `dist/`; it does not deploy. Preview normally uses `http://127.0.0.1:4173/`. On other operating systems use `npm` in place of `npm.cmd`.

### Try the prototype

1. Review the three different Home totals and recent synthetic records.
2. Add an Aircraft; use Back to Edit or cancel the Review sheet, then explicitly confirm a save.
3. Try the two duties on `2026-10-16` and the overnight duty on `2026-10-15`.
4. In Settings, enable optional synthetic fields to try separate leg statuses, flight numbers and custom parking bays.
5. Switch Timeline/Calendar, combine filters and inspect Statistics.
6. Create a Journal reflection; review selected stories in Privacy Preview before exporting.
7. Use Seed Demo Data or Reset Demo Data only after reading the replacement confirmation.

### iPhone / LAN testing

An iPhone's localhost is the iPhone itself. Optional testing on the same trusted Wi-Fi uses:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Open the Windows LAN address printed by Vite on the phone; allow private-network firewall access only as needed. This exposes the development server to that network. It is not public hosting. LAN HTTP is not a validated HTTPS/iOS PWA environment.

## Project Status

- **v0.1.0:** Initial interactive frontend prototype and domain workflows.
- **v0.1.1:** Visual/theme enhancements, decorative radar, responsive navigation and airline reference/fallback components. This publication preparation updates documentation and the development test toolchain.
- **Not implemented:** Production backend, real authentication/passkeys, cloud synchronization, encrypted backup, full import/restore, Service Worker/offline reload and validated iOS PWA installation.
- **Manual acceptance pending:** Real browser/iPhone layout, animation, focus, download and print checks. No deployment has been performed.

The approved PRD describes a larger future product. It does not mean all production features are complete. See [prototype status](PROTOTYPE_STATUS.md), [manual acceptance](docs/MANUAL_ACCEPTANCE.md) and [publication preparation](docs/PUBLICATION_PREPARATION.md).

## Privacy & Data Handling

Only synthetic data may be used in the public demonstration. The initial fixture has 6 duties, 18 aircraft assignments (17 Confirmed + 1 Draft) and 3 Journal entries.

Changes persist in this browser origin's **unencrypted localStorage**, key `tco-logbook-demo-v0.1`. Local Storage is not secure production cloud storage, authentication, access control or backup. Browser clearing, private browsing and storage failures can lose data; other browsers, devices, ports and origins have separate data. Multi-tab conflict handling is not implemented.

Do not enter confidential workplace records, employee/passenger information, internal screenshots or proprietary procedures. Appropriate authorization would be necessary before any real workplace use; the prototype's privacy switches do not provide that authorization.

Optional field groups start disabled. **Archive/hide retains underlying values; it does not physically delete or encrypt them.** The explicit local field-deletion option is separate. Previously downloaded copies remain outside the app.

Privacy filters and report field allowlists **do not sanitize arbitrary Journal free text automatically**. Review every story and export before sharing. JSON contains selected counts/stories; CSV contains counts; browser PDF is a print workflow. None is a secure full backup or employer-verified report. Thirty-day Trash eligibility is a demo rule, not an automatic purge or retention guarantee.

## Airline Branding & Trademark Notice

The owner has chosen to retain **24 existing airline PNGs** in `public/assets/airlines/` for the intended public portfolio release. **Their public redistribution permissions remain unverified.** Retaining them is the owner's publication decision, not evidence of authorization; non-commercial use and this disclaimer do not establish permission.

The supplied source pages identify CX (Seeklogo), LH (PlusPNG) and 9G (CDNLogo). Exact individual pages for the remaining images are unknown; the owner reports that most came from Seeklogo. A download site is not automatically the rights holder.

The existing component still displays code/name fallbacks until its approval gate is satisfied; no unverified permission flag has been approved. **Images in Vite's public directory are copied into builds and are directly accessible even when the component does not display them.** Future builds therefore contain these retained files. No runtime request is made to the download sites.

See the complete [asset audit](docs/AIRLINE_ASSET_AUDIT.md) and [checksum inventory](docs/AIRLINE_ASSET_INVENTORY.json). CX, LD (Air Hong Kong) and HX (Hong Kong Airlines) are distinct. The nine app references are not an exhaustive HKIA or HAS ramp/TCO customer list, and no handling affiliation is verified.

## Source Code & Usage

This repository is intended to be publicly available for personal portfolio, educational viewing, and demonstration purposes. Its current GitHub visibility is managed separately by the owner.

**No open-source software licence is currently granted for the original TCO Logbook source code.**

Unless otherwise required by applicable law or the GitHub Terms of Service, all rights in the original project code are reserved. Public visibility does not by itself grant broad reuse, modification, redistribution or commercial sublicensing rights. GitHub's applicable platform-level viewing and forking permissions remain unaffected.

Third-party packages, trademarks, logos and other assets remain subject to their respective licences and rights. They are not relicensed by this notice. See [third-party notices](THIRD_PARTY_NOTICES.md). No standalone project LICENSE has been added.

## Development Roadmap

**Planned only, subject to separate approval:** policy/provider/cost decisions, real authentication, durable backend storage, offline synchronization/conflicts, public aircraft lookup, validated import/restore, encrypted backups and production/iPhone PWA acceptance. These are future phases of the approved PRD, not delivered v0.1.1 features.

This preparation does not add v0.1.2 features, monthly batch rosters, new Aircraft Detail screens or a new live clock.
