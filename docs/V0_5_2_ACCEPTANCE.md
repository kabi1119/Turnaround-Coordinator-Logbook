# v0.5.2 — Home layout, connection badge and safe area

Baseline: 6b06436 (v0.5.1). Continued the existing uncommitted draft on feature/v0.5.2-home-layout; no automatic commit, push, deployment or history rewrite.

## Changes

- Connection hint retains all existing events/meaning and device-only text. The 17px icon and compact green Online / red Offline badge identify state using both text and color. No alarms, probing requests, animations or new connectivity logic.
- Home document order: existing hero/radar, full-width Upcoming/Today's/Current Shift, three statistics, then recent records/reflection. The shift summary groups its date/month/year, HKT hours, linked record count and View Duty action; ties, empty states, missing hours, Next Shift and overnight handling remain unchanged.
- Home-only statistics use three separate cards on desktop and one column on phones. Labels/details stay readable, with value alongside on mobile; no carousel or horizontal scroll is required. Metric meanings and current non-interactive behavior are unchanged.
- The final mobile header rule uses 18px + env(safe-area-inset-top), correcting a later padding shorthand that overwrote the earlier safe inset. Standalone mobile PWA adds 8px breathing room (26px + inset). Zero-inset browser layouts retain their previous 18px padding; desktop is unaffected. Existing viewport-fit=cover and side/bottom safe areas remain.
- Worker, update logic, icon assets/URLs, storage, backup, models, selectors, samples and Cloudflare configuration are unchanged. No new dependency or data migration.

## Focused acceptance

1. Run the existing release gate and dependency audit.
2. Native production browser at desktop, iPhone portrait and 320px: confirm actual section order, one-column phone metrics, readable badge/shift, no horizontal overflow and View Duty/Calendar navigation.
3. Toggle browser connectivity: green versus red, 17px icon, no header-height jump. Verify normal text contrast in both themes and languages.
4. Simulate a top safe inset where the browser tooling permits; verify brand begins below it. Separately identify whether standalone media emulation is available.
5. Install online assets, stop the local server, reload offline, save/reopen/edit a reviewed Draft and a Duty; preserve counts/status/local records. Existing backup/storage/worker tests remain passing.

## Recorded verification — 2026-10-19

- **395 tests / 30 files passed**, including three focused Home/status/shift cases. Lint, production build, static guard and formatting passed; npm audit reports **0 vulnerabilities**. An older ignored Git audit helper initially blocked lint; its missing Node globals were corrected without changing application lint rules, then lint and the remaining release checks passed.
- Native Edge/local Workers: 1440px/light/English, 390px/dark/English, 393px/light/Traditional Chinese and 320px/dark/English passed actual section order, contained cards, one-column phone statistics, unchanged 04/03/02 counts, 17px icon, distinct green/red backgrounds and normal-text contrast >=4.5:1. Connection changes caused no header-height jump. View Duty and Full Calendar opened correctly; desktop/mobile screenshots were inspected.
- Native safe-area override: a 59px top inset produced 77px header padding and placed branding below the inset. Zero-inset mobile retained 18px and desktop retained 0px top padding. This Edge version did not emulate display-mode:standalone, so the extra 8px standalone rule remains for physical-device acceptance rather than a claimed native installed-PWA test.
- Installed all 33 offline assets, stopped the actual local HTTP server, then passed offline reload/navigation, reviewed blank Draft creation/edit/reload, stable ID/Draft status and unchanged confirmed counts, Planned Duty edit, full backup export, malformed rejection, confirmed valid restore, and quota-failure/retry without false success or duplication. No startup exceptions were observed in that successful workflow.
- Confirmed no diff in worker/update logic, storage/backup engines, domain rules, app icons, airline assets, manifest identity or Cloudflare configuration. Dependency entries are unchanged. All v0.5.2 work remains local and uncommitted.

## Physical iPhone acceptance

This session cannot establish a Dynamic Island compositor/blur fix on a physical device. After an authorized release, test Safari and Home Screen on the owner's iPhone: portrait launch, top spacing in both themes, English/Traditional Chinese, green/red badge, all three stats through vertical scrolling, View Duty/Calendar and offline save/reopen. Ensure no excessive top gap on a non-notched device. Keep a JSON backup; do not clear site data for a visual refresh.

The status remains a browser connection hint, not proof of internet connectivity, sync or offline cache readiness. Browser caches and local storage can be evicted. Existing safe update instructions still apply.
