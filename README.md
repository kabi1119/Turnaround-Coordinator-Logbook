## Disclaimer & Independent Project Notice

**TCO Logbook is an independent, non-commercial personal software project developed for educational, portfolio, and aviation enthusiast purposes.**

**This project is NOT affiliated with, sponsored by, endorsed by, authorized by, or officially associated with:**

- **HAS by Cathay (Hong Kong Airport Services Limited)**
- **Cathay Pacific Airways**
- **Hong Kong Express (HK Express)**
- **Air Hong Kong**
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

TCO Logbook is an independently developed aviation-oriented web application prototype for organizing, reviewing, and reflecting on aircraft handling assignments, duty shifts, recorded flight activity, and professional experiences. The current **v0.2.0 Pre-release** runs locally with fictional sample records.

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

## v0.2.0 Pre-release

- The larger header brand reads **Turnaround Coordinator Logbook**; other UI uses **TCO Logbook**. The upper showcase strip is removed. Release/local-storage/Hong Kong metadata sits quietly at the bottom of the desktop sidebar, with a compact content footer on smaller screens.
- An original local SVG outline of East Asia / the Western Pacific replaces the plain radar hero. The aircraft and CSS sweep share a Hong Kong-area anchor. Geography is approximate decoration, not navigation, live radar or a GIS product. No map service, tiles, third-party map artwork or network request is used. Reduced-motion and modal animation pause remain.
- The compact fictional collection has **4 Confirmed Aircraft, 3 Duties (2 Worked / 1 Planned) and 2 Journals**. Six applicable flight legs cover Early, On Time, Delayed, Cancelled, Not Recorded and Other; all three roles/handling types, actual/scheduled/missing times, a custom bay, a disruption, linked/standalone journals, multiple aircraft per duty and an overnight duty are covered. Derived counts are **4 Logged / 3 Handled / 2 Primary**. Identifiers look like personal records but are invented; no employer operations or official schedules are represented.
- Repeated visible DEMO labels and prefixes are removed from current UI and new samples. A concise Settings disclosure and exported report notice still identify fictional samples and local-only limitations. Privacy fields stay off by default; enable them only to inspect authorized fictional values.
- Batch Add Duties no longer requires the chosen-hours acknowledgement checkbox. Entered valid hours, conflict detection, overlap override, review, explicit final confirmation and Planned classification remain.
- Existing storage is loaded unchanged. **Settings → Refresh sample records** previews replacement of complete, unchanged historical fixtures with the smaller collection. Custom records/settings are retained; edited samples, duplicate IDs and retained personal links to removed samples block the whole transaction. No automatic refresh or full database clear runs. Existing user-entered or edited legacy labels remain as entered until reviewed; display cleanup never rewrites personal text.
- All 24 catalogue choices and local airline PNGs remain available; the four sample airlines are not a limit on selectable airlines or user records. Logo display still does not establish redistribution rights.

See [v0.2.0 acceptance](docs/V0_2_0_ACCEPTANCE.md). This remains a local frontend pre-release, not a production aviation system. No authentication, backend, cloud sync, deployment or additional service was introduced. No automatic commit or push.

## Historical v0.1.4 Improvements

- **Airline image combobox:** all 24 catalogue options show a local logo, full name and IATA code. Search names/codes, use arrows/Enter/Escape, or retain historical/custom text. Closed fields preview the selected identity. Mouse and touch share the same selection behavior.
- **24 synthetic assignments on 24 dates:** one per catalogue airline, all Confirmed, covering nine role/type combinations with visibly fictional flights/registrations. Frozen Hong Kong dates span 12 August–16 October 2026. Derived totals: **24 Logged / 18 Handled / 9 Primary**; each handling type contributes 8 assignments. There are 25 duties (including the original six, two on one date and an overnight example) and 3 journals.
- **Safe refresh:** Settings → **Refresh sample records** now previews full scenario replacement, generated rows, new duties and Journal/disruption impact. Unchanged v0.1.1–v0.1.3 samples are recognized by complete payload equality. IDs and Journal references remain; scenario dates, airline, timings and Duty links may change as previewed. Existing Duty/Journal payloads, unrelated records and settings stay intact. Edited/unrecognized required IDs or different-date/trashed Duty collisions block the whole transaction; nothing is overwritten. Repeated refresh does not accumulate rows. Never use Seed/Reset to refresh a mixed collection.
- **Dashboard:** larger 24 px desktop / 18 px mobile HKT clock; Home → **View All Previous Duties** opens descending HK start-date history with details and Planned/Worked badges. Future shifts stay in Logbook. Add Duty, Batch Add Duties and the central Add tab remain.
- **Version policy:** [VERSIONING.md](docs/VERSIONING.md) defines the owner's custom `vMAJOR.MINOR.PATCH[letter]` convention (not strict SemVer), production approval and version-first English release commits. Future work proposes a scope-appropriate version; agreed versions never change silently.

Home and Statistics describe overall totals separately from the exact unchanged v0.1.4 demo subset. Edited/historical/custom records remain in overall totals. Existing browser storage is loaded unchanged; no automatic refresh, migration or reset occurs. See [v0.1.4 acceptance](docs/V0_1_4_ACCEPTANCE.md).

## Historical v0.1.3 Improvements

- **Readable airline logos:** card frames are 112 × 56 px on desktop and 96 × 52 px on phones; detail frames are 144 × 72 / 128 × 64 px. Compact views remain 56 × 36 px. Measured, padded artwork bounds adjust CSS placement/uniform scale so transparent or neutral margins do not shrink the artwork. All original PNGs and licensing records are unchanged; no derivative image is generated.
- **Owner-defined 24-airline catalogue:** one identity/asset source drives default selection, IATA/name/alias search, registry and PNG mapping. NH / SQ / HX / EK are excluded from defaults and fresh samples, while historical/custom records remain visible and editable. Inclusion is not a verified HAS customer relationship. See [catalogue](docs/AIRLINE_CATALOGUE.md).
- **Safe old-demo refresh:** Settings → Refresh sample records previews only full-content matches to untouched legacy synthetic fixtures. Confirmation changes only listed airline fields. Edited/custom/unrecognized samples and privacy-deleted fields are never inferred from IDs or DEMO labels alone; no records, links or storage are cleared. Refresh is idempotent. Existing Seed/Reset remain separate, explicit replacement actions.
- **Detail scrolling:** removed live backdrop blur, paused decorative radar while any modal is open and locked background scrolling until the last nested modal closes. The clock was already isolated; tests verify actual Home detail does not rerender/reset scroll on ticks. Short Edge traces did not reproduce the reported hardware stutter, so these changes reduce confirmed avoidable work without claiming a universal FPS fix.

See [v0.1.3 acceptance and profiling notes](docs/V0_1_3_ACCEPTANCE.md). Earlier v0.1.2 workflows below remain implemented.

## v0.1.2 Workflows

### Aircraft details and Recent Aircraft times

Recent Aircraft cards now prefer actual AIBT / AOBT for the applicable leg(s). If only scheduled data exists, the card says Scheduled SIBT / SOBT. No aircraft time is derived from Duty, creation or update timestamps. Missing values show Time not recorded; privacy-disabled values are explicitly hidden. Next-day events retain their dates.

Open an Aircraft card for grouped assignment, arrival, departure, Duty/Journal relationships, full disruption details, notes and record activity. Flight number, registration, bay and leg data still follow Settings privacy switches; enable them only for synthetic or appropriately authorized demonstrations. Aircraft edits still require Review / Double-check.

### Monthly / batch roster

On Home choose **Add Duty** or **Batch Add Duties**; the central Add navigation is preserved.

1. Choose a month/year and select multiple calendar dates. Selection and pending entries can span months.
2. Choose Day / Evening / Night / Custom, enter your own start/end times. There are no official or prefilled employer shift hours.
3. Apply the template. Repeat with other templates/dates; edit or remove individual pending entries and add synthetic notes.
4. Review dates, types, times, next-day end dates and conflicts. Identical shifts must be edited/removed; overlaps require a separate explicit keep-separate confirmation.
5. Confirm once to save all entries locally. Failed storage writes retain pending entries for retry; no saved Duty is replaced by matching date.

Batch duties are **Confirmed + Planned**, where Confirmed describes record state and Planned describes work progress. Planned never contributes to Worked Duty Shifts, even after its date passes. In Duty → Edit Duty, mark Worked explicitly after completion. A future or unfinished shift cannot be newly marked Worked. Aircraft assignment counts remain independent of a Duty's work progress.

A Duty's date is always its Hong Kong shift-start date. End earlier than start means next day, including month/year boundaries; equal start/end is rejected. Day / Evening / Night are personal labels. Templates are remembered only while the batch dialog is open, not as a permanent template library.

Existing v0.1.1 Duties without the new optional workState retain their original Confirmed-duty counting semantics. No automatic data rewrite, reset or reseeding occurs. Keep the same browser origin/port to access the same localStorage; a repository rename does not move browser data between origins. Older app versions do not understand Planned work progress, so use v0.1.2 for roster records.

### Local airline logos

All 24 existing local PNGs have explicit case-sensitive display mappings. Aircraft cards/detail, Logbook, airline rankings and existing selection previews reuse AirlineLogo. Name/code identifies the operator independently of shared AirAsia/Jetstar artwork. Disabled, invalid, unavailable or failed images use code/name fallback. No new images were downloaded.

**Display enabled is not legal permission.** All previously unverified rights/provenance remain unverified; the README disclaimer and third-party notices remain applicable.

### Hong Kong live clock

The header shows Hong Kong date, weekday and HH:mm:ss HKT using Asia/Hong_Kong. It refreshes from current device time each second and when the tab resumes/focuses; only the clock component updates. Accuracy depends on the device clock, with no authoritative time-server synchronization.

## Screenshots / Preview

Screenshots will be added after manual visual acceptance using synthetic data only. No screenshots are included or linked here yet.

Run the local prototype with the instructions below. The [v0.1.2 acceptance checklist](docs/V0_1_2_ACCEPTANCE.md) covers all new workflows. Local Edge checks exercised seven viewport widths in both themes, batch save/reload and grouped details without horizontal overflow. These checks do not establish actual iPhone/Safari acceptance.

## Technology Stack

React 19, TypeScript 5.9, Vite 7, plain CSS/design tokens, Lucide React icons and browser localStorage. Tests use Vitest 4 with jsdom and React Testing Library. ESLint and Prettier provide code checks. There is no backend framework or external data service.

## Getting Started

Use **Node.js 24 LTS**, npm, Git and a modern Edge/Chrome browser. This preparation was tested with Node.js 24.20.0. No environment variables, accounts or database setup are needed.

For a new checkout, once you have repository access:

```powershell
git clone https://github.com/kabi1119/Turnaround-Coordinator-Logbook.git
cd Turnaround-Coordinator-Logbook
npm.cmd ci
npm.cmd run dev
```

For the existing Windows checkout, open PowerShell in `C:\Projects\Turnaround-Coordinator-Logbook`, run `npm.cmd ci` if needed, then `npm.cmd run dev`. Using `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue without changing system policy.

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
7. Use Refresh sample records for safe reviewed replacement. Load sample records / Clear local records replace all records only after an explicit confirmation; avoid these on mixed collections.

### iPhone / LAN testing

An iPhone's localhost is the iPhone itself. Optional testing on the same trusted Wi-Fi uses:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Open the Windows LAN address printed by Vite on the phone; allow private-network firewall access only as needed. This exposes the development server to that network. It is not public hosting. LAN HTTP is not a validated HTTPS/iOS PWA environment.

## Project Status

- **v0.1.0:** Initial interactive frontend prototype and domain workflows.
- **v0.1.1:** Visual/theme enhancements, decorative radar, responsive navigation and airline reference/fallback components. This publication preparation updates documentation and the development test toolchain.
- **v0.1.2:** Complete applicable Aircraft details and gate-time card summaries; reviewed monthly/batch planned duties with conflict checks; owner-enabled local PNGs with independent rights status; live Hong Kong device clock.
- **v0.1.3:** Larger margin-aware logo presentation, unified 24-airline defaults, conservative reviewed legacy-demo airline refresh and targeted modal scroll/compositing changes.
- **v0.1.4:** Accessible image combobox, one synthetic assignment per 24 catalogue airlines on distinct dates, reviewed dataset refresh, prominent HKT clock, previous-duty history and permanent version/commit conventions.
- **v0.1.5 (documentation only):** Added an equivalent Traditional Chinese (Hong Kong) README and an English-language precedence notice; application features remain at v0.1.4.
- **v0.2.0 Pre-release:** Refined brand/sidebar metadata, local East Asia radar map, compact fictional records, quieter UI and simplified batch roster entry.
- **Not implemented:** Production backend, real authentication/passkeys, cloud synchronization, encrypted backup, full import/restore, Service Worker/offline reload and validated iOS PWA installation.
- **Verification:** Local Edge viewport/layout and new workflow checks completed; actual iPhone/Safari, physical touch/keyboard, download and print acceptance remains pending. No deployment has been performed.

The approved PRD describes a larger future product. It does not mean all production features are complete. See [prototype status](PROTOTYPE_STATUS.md), [manual acceptance](docs/MANUAL_ACCEPTANCE.md) and [publication preparation](docs/PUBLICATION_PREPARATION.md).

## Privacy & Data Handling

Only synthetic data may be used in the public demonstration. The v0.2.0 initial fixture has 3 duties, 4 Confirmed aircraft assignments and 2 Journal entries. The former 18- and 24-assignment fixtures are retained solely for historical recognition and compatibility tests.

Changes persist in this browser origin's **unencrypted localStorage**, key `tco-logbook-demo-v0.1`. Local Storage is not secure production cloud storage, authentication, access control or backup. Browser clearing, private browsing and storage failures can lose data; other browsers, devices, ports and origins have separate data. Multi-tab conflict handling is not implemented.

Do not enter confidential workplace records, employee/passenger information, internal screenshots or proprietary procedures. Appropriate authorization would be necessary before any real workplace use; the prototype's privacy switches do not provide that authorization.

Optional field groups start disabled. **Archive/hide retains underlying values; it does not physically delete or encrypt them.** The explicit local field-deletion option is separate. Previously downloaded copies remain outside the app.

Privacy filters and report field allowlists **do not sanitize arbitrary Journal free text automatically**. Review every story and export before sharing. JSON contains selected counts/stories; CSV contains counts; browser PDF is a print workflow. None is a secure full backup or employer-verified report. Thirty-day Trash eligibility is a demo rule, not an automatic purge or retention guarantee.

## Airline Branding & Trademark Notice

The owner has chosen to retain **24 existing airline PNGs** in `public/assets/airlines/` for the intended public portfolio release. **Their public redistribution permissions remain unverified.** Retaining them is the owner's publication decision, not evidence of authorization; non-commercial use and this disclaimer do not establish permission.

The supplied source pages identify CX (Seeklogo), LH (PlusPNG) and 9G (CDNLogo). Exact individual pages for the remaining images are unknown; the owner reports that most came from Seeklogo. A download site is not automatically the rights holder.

The owner-enabled display manifest now maps all 24 original PNGs independently of the unchanged legal permission records. Missing, disabled, invalid or failed image mappings use code/name fallback; no unverified permission flag has been approved. **Images in Vite's public directory are copied into builds and are directly accessible even when the component does not display them.** Future builds therefore contain these retained files. No runtime request is made to the download sites.

See the complete [asset audit](docs/AIRLINE_ASSET_AUDIT.md) and [checksum inventory](docs/AIRLINE_ASSET_INVENTORY.json). CX, LD (Air Hong Kong) and HX (Hong Kong Airlines) are distinct. The 24-entry owner-defined default catalogue is not an exhaustive HKIA or HAS ramp/TCO customer list. Original historical reference records are preserved separately; no handling affiliation is verified.

## Source Code & Usage

This repository is intended to be publicly available for personal portfolio, educational viewing, and demonstration purposes. Its current GitHub visibility is managed separately by the owner.

**No open-source software licence is currently granted for the original TCO Logbook source code.**

Unless otherwise required by applicable law or the GitHub Terms of Service, all rights in the original project code are reserved. Public visibility does not by itself grant broad reuse, modification, redistribution or commercial sublicensing rights. GitHub's applicable platform-level viewing and forking permissions remain unaffected.

Third-party packages, trademarks, logos and other assets remain subject to their respective licences and rights. They are not relicensed by this notice. See [third-party notices](THIRD_PARTY_NOTICES.md). No standalone project LICENSE has been added.

## Development Roadmap

**Planned only, subject to separate approval:** policy/provider/cost decisions, real authentication, durable backend storage, offline synchronization/conflicts, public aircraft lookup, validated import/restore, encrypted backups and production/iPhone PWA acceptance. These are future phases of the approved PRD, not delivered v0.2.0 features.

v0.2.0 remains a local frontend pre-release. OCR/Excel roster import, HR integration, cloud services and production features remain deferred.

## Language Precedence

This README is provided in English and Traditional Chinese (Hong Kong) for accessibility and reference. Both versions are intended to convey the same information. **In the event of any discrepancy, ambiguity, or inconsistency between the two versions, the English version shall prevail.**

---

## 免責聲明與獨立項目聲明

**TCO Logbook 是一個獨立、非商業性質的個人軟件項目，開發目的為學習、作品集展示及航空愛好。**

**本項目與以下機構並無任何從屬、贊助、背書、授權或其他官方關聯：**

- **HAS by Cathay（香港機場地勤服務有限公司，Hong Kong Airport Services Limited）**
- **國泰航空（Cathay Pacific Airways）**
- **華民航空（Air Hong Kong）**
- **香港快運航空（Hong Kong Express／HK Express）**
- **香港機場管理局（Airport Authority Hong Kong）**
- **任何其他航空公司、機場營運機構、地勤服務公司或航空相關組織**

TCO Logbook 並非任何航空公司、機場或地勤服務機構的官方營運系統。

本項目提及航空公司名稱、機場設施、機型、航空公司識別碼、標誌或其他航空術語，均僅用作識別、參考、示範或教育用途。

所有第三方航空公司名稱、商標、標誌及其他品牌資產，均屬其各自權利持有人所有。項目出現任何航空公司品牌元素，均不代表存在商業關係、認可、贊助或官方授權。

**本免責聲明本身並不授予複製或再分發第三方知識產權的許可；該等資產仍受適用權利及許可條款約束。**

所有公開發佈的示範紀錄及營運情境均為虛構資料，並非 HAS 或任何航空公司的官方營運資料庫。本項目無意公開分發僱主機密資料、真實乘客資料、公司內部文件或專有營運紀錄。

**TCO Logbook 是個人軟件原型，不得用作航空公司、機場或地勤服務機構的官方營運系統、安全關鍵系統或正式生產環境的航空管理系統。**

---

# TCO Logbook

**個人航空營運紀錄及職涯發展助手。**

TCO Logbook 是一個獨立開發的航空主題網頁應用程式原型，用於整理、查閱及反思航機地勤處理任務、工作更次、已記錄的航班活動及職涯經驗。目前的 **v0.2.0 Pre-release** 在本機執行，使用虛構樣本紀錄。

## 關於本項目

本項目源於對航空及地面營運的興趣，探索如何透過有系統的個人紀錄，將經驗整理成具意義的統計數據和職涯反思。項目適合航空愛好者，以及對現代化、適合手機使用的數碼 Logbook 感興趣的人士。

這是一個非商業個人作品集項目，並非受任何航空機構委託、為其開發或獲其認可。

## 功能特色

- **航機處理紀錄（Aircraft Handling Logbook）：** 支援 Full Turnaround（完整過站）、Departure Only（僅離港）及 Arrival Only（僅抵港）任務；Primary Coordinator（主要協調員）、Supporting Coordinator（支援協調員）及 Training / Observation（培訓／觀察）角色；Draft（草稿）及 Confirmed（已確認）紀錄。可記錄航空公司與機型，以及在示範私隱控制下選填註冊編號、航班及停機位資料。每次儲存 Aircraft 紀錄前均須經過 Review → Confirm & Save；抵港與離港狀態分別記錄。
- **更次管理（Duty Management）：** 支援同一天多個更次、選填上下班時間、跨午夜更次歸類，以及關聯航機紀錄。將 Duty 移至垃圾桶不會刪除其航機紀錄；還原時可經明確確認後重新連結。
- **主頁儀表板（Dashboard）：** 顯示 Home 統計總數、最近活動及支援減少動態效果偏好設定的裝飾性雷達動畫。該雷達並非即時雷達或航班追蹤功能。
- **統計（Statistics）：** 日期及組合篩選、航空公司／機型排名、每月趨勢、角色分佈，以及三種互斥的處理類型。一次 Full Turnaround 只計算一筆任務。Logged 包含 Training；Handled 與職涯協調任務統計則排除 Training。Primary 是 Handled 的子集，不應額外加在 Handled 總數之上。
- **職涯日誌（Career Journal）：** 支援獨立或關聯式反思、STAR 結構欄位、能力標籤、Draft／Confirmed 狀態及可選填的自行申報成果。Journal 紀錄不會增加航機處理任務數量。
- **報告與本機控制：** Privacy Preview（私隱預覽）、經覆核的 JSON、僅含數量統計的 CSV、瀏覽器 Print / Save as PDF、本機垃圾桶／還原，以及須確認的 Seed／Reset 操作。這些是示範工具，不是完整備份或自動匿名化功能。
- **使用者體驗：** Home | Logbook | Add | Statistics | Journal 五個主分頁，另設 Settings；具備桌面／手機響應式版面、英文／繁體中文介面，以及跟隨系統的淺色／深色主題。使用者輸入內容及標準航空參考資料均保留其原有語言。

## v0.2.0 預發佈版

- 左上角放大的品牌名稱為 **Turnaround Coordinator Logbook**，其他介面維持 **TCO Logbook**。移除上方狀態列；版本、本機儲存及香港時區資料移至桌面側欄底部，較小螢幕則於內容底部顯示。
- 原創本機 SVG 東亞／西太平洋輪廓取代原本雷達背景，飛機及 CSS 掃描中心位於香港附近。地圖僅屬概略裝飾，並非導航、即時雷達或 GIS；沒有地圖服務、圖磚或外部請求。保留減少動態效果及對話框開啟時暫停動畫。
- 精簡虛構資料包含 **4 筆 Confirmed Aircraft、3 個 Duty（2 Worked／1 Planned）及 2 篇 Journal**。六個適用航段涵蓋 Early、On Time、Delayed、Cancelled、Not Recorded、Other；涵蓋全部三種角色及處理類型、實際／表定／缺少時間、自訂停機位、突發事件、關聯／獨立日誌、同更多架航機及通宵更次。統計由資料計算：**4 Logged／3 Handled／2 Primary**。識別資料均為虛構，不代表僱主營運或官方更表。
- 移除目前介面及新樣本中重複的 DEMO 標示；Settings 及報告仍簡要說明虛構樣本與僅限本機的限制。私隱欄位預設關閉，只應為查看獲准的虛構值而啟用。
- Batch Add Duties 移除自行選定時數的聲明核取方塊；有效時間、衝突檢查、重疊更次明確確認、覆核、最後確認及 Planned 分類均保留。
- 既有儲存資料原樣載入。**Settings → Refresh sample records** 先預覽以精簡樣本取代完整且未改動的歷史樣本。保留自訂紀錄及設定；如樣本曾被編輯、ID 重複或個人紀錄仍參照將被移除的樣本，會阻止整個更新。不會自動更新或清空資料庫；使用者已輸入或修改的舊文字亦不會被擅自清理。
- 保留全部 24 間航空公司選項及本機 PNG；四間樣本航空公司並非使用上限。啟用 Logo 顯示仍不等於取得再分發許可。

詳見 [v0.2.0 驗收清單](docs/V0_2_0_ACCEPTANCE.md)。此版本仍為本機前端預發佈版，並非正式航空營運系統。沒有新增身份驗證、後端、雲端同步、部署或服務，亦不會自動 Commit／Push。

## 過往 v0.1.4 改進內容

- **附圖片的航空公司組合選擇框：** 24 個目錄選項均顯示本機 Logo、完整名稱及 IATA 代碼。可按名稱／代碼搜尋，以方向鍵、Enter、Escape 操作，亦可保留歷史／自訂文字。關閉的選擇欄位會預覽已選航空公司；滑鼠及觸控使用相同選取邏輯。
- **24 個日期的 24 筆虛構航機任務：** 目錄內每間航空公司各一筆，全部為 Confirmed，涵蓋九種角色／處理類型組合，並使用明顯虛構的航班號及註冊編號。固定的香港日期橫跨 2026 年 8 月 12 日至 10 月 16 日。依據資料計算的總數為 **24 Logged / 18 Handled / 9 Primary**；三種處理類型各有 8 筆任務。另有 25 個 Duty（包括原本六個、同一天兩更及一個通宵更次範例）與 3 篇 Journal。
- **安全更新示範資料：** Settings → **Refresh sample records** 會先預覽整個情境資料的替換內容、產生的紀錄、新增 Duty，以及對 Journal／突發事件的影響。v0.1.1–v0.1.3 未改動的樣本，會以完整資料內容相等作識別。ID 及 Journal 參照維持不變；情境日期、航空公司、時間及 Duty 關聯則可能按預覽更改。既有 Duty／Journal 內容、無關紀錄及設定維持不變。如必要 ID 曾被編輯／無法辨識，或出現日期不符／已移至垃圾桶的 Duty 衝突，整個交易會被阻止，不會覆寫任何資料。重複更新不會累積重複紀錄。切勿使用 Seed／Reset 更新混合了個人紀錄的資料集合。
- **主頁儀表板：** HKT 時鐘字體加大至桌面 24 px／手機 18 px；Home → **View All Previous Duties** 可開啟按香港更次開始日期倒序排列的歷史紀錄，並顯示詳情及 Planned／Worked 標籤。未來更次仍在 Logbook 顯示。Add Duty、Batch Add Duties 及中央 Add 分頁保留。
- **版本管理政策：** [VERSIONING.md](docs/VERSIONING.md) 定義項目擁有者自訂的 `vMAJOR.MINOR.PATCH[letter]` 格式（並非嚴格遵循 SemVer）、正式版批准機制，以及版本號置前的英文 Release Commit 格式。往後開發會按更新規模建議版本號，已同意的版本不得擅自更改。

Home 及 Statistics 會將整體總數與未經修改的 v0.1.4 示範資料子集分開說明。已編輯、歷史及自訂紀錄仍計入整體總數。瀏覽器既有儲存資料會原樣載入，不會自動更新、遷移或重設。詳見 [v0.1.4 驗收清單](docs/V0_1_4_ACCEPTANCE.md)。

## 過往 v0.1.3 改進內容

- **更清晰的航空公司 Logo：** 桌面卡片圖片框為 112 × 56 px、手機為 96 × 52 px；詳細資料框為 144 × 72／128 × 64 px；Compact 顯示維持 56 × 36 px。程式會測量圖片中帶有留白的可見內容邊界，再調整 CSS 位置及等比例縮放，避免透明或中性背景留白令 Logo 顯得太細。24 張原始 PNG 與授權紀錄均不變，亦沒有產生衍生圖片。
- **使用者指定的 24 間航空公司目錄：** 由同一份航空公司身份／資產資料來源支援預設選項、IATA／名稱／別名搜尋、Registry 及 PNG 對應。NH／SQ／HX／EK 不再出現在預設選項及新生成的示範紀錄，但歷史／自訂紀錄仍可查看及編輯。列入目錄不等於已核實其與 HAS 的客戶關係。詳見 [航空公司目錄](docs/AIRLINE_CATALOGUE.md)。
- **安全更新舊示範資料：** Settings → Refresh sample records 只預覽與未修改的舊版虛構測試資料在完整內容上相符的紀錄。確認後僅更改清單中的航空公司欄位。已編輯／自訂／無法識別的樣本，以及經私隱功能刪除的欄位，均不會只憑 ID 或 DEMO 標記推斷；亦不會清除任何紀錄、關聯或儲存內容。更新操作具冪等性。原有 Seed／Reset 仍屬獨立且需明確確認的替換操作。
- **詳細資料捲動：** 移除即時背景模糊效果，在任何 Modal 開啟時暫停裝飾性雷達，並在最後一個巢狀 Modal 關閉前鎖定背景頁面捲動。時鐘原本已獨立運作；測試確認時鐘跳秒不會令 Home 的詳細資料重新渲染或重設捲動位置。簡短 Edge 效能紀錄未能重現所回報的硬件掉幀，因此這些調整只是減少已確認可避免的運算負擔，並非保證所有裝置均達到某個 FPS。

詳見 [v0.1.3 驗收及效能分析備註](docs/V0_1_3_ACCEPTANCE.md)。下方較早期的 v0.1.2 操作流程仍然適用。

## v0.1.2 操作流程

### Aircraft 詳情與 Recent Aircraft 時間

Recent Aircraft 卡片會優先顯示適用航段的實際 AIBT／AOBT。如只有表定資料，則明確標示 Scheduled SIBT／SOBT。不會以 Duty、建立或更新時間冒充航機時間。缺少時間會顯示 Time not recorded；因私隱設定停用的資料則明確標示為隱藏。翌日發生的事件會保留其正確日期。

開啟 Aircraft 卡片後，可分組查看任務、抵港、離港、Duty／Journal 關聯、完整突發事件資料、筆記及紀錄活動。航班號、註冊編號、停機位及航段資料仍受 Settings 私隱開關控制；只應在虛構示範或獲適當授權的情況下啟用。編輯 Aircraft 時仍必須經過 Review／Double-check。

### 每月／批次更表

在 Home 選擇 **Add Duty** 或 **Batch Add Duties**；中央 Add 導航分頁維持不變。

1. 選擇月份／年份及多個日曆日期。已選日期及待儲存項目可以跨月。
2. 選擇 Day／Evening／Night／Custom，自行輸入開始與結束時間。系統不提供任何官方或預設的僱主更次時間。
3. 套用範本。可為其他範本／日期重複操作；儲存前可逐筆修改或移除待處理項目，並加入虛構筆記。
4. 覆核日期、類型、時間、翌日結束日期及衝突。完全相同的更次必須修改或移除；時段重疊則須另行明確確認保留為獨立更次。
5. 確認一次後，將所有項目儲存至本機。若寫入儲存空間失敗，待處理項目會保留供重試；系統不會因日期相同而取代已存在的 Duty。

批次建立的 Duty 為 **Confirmed + Planned**：Confirmed 指紀錄狀態，Planned 指實際工作進度。即使日期已過，Planned 亦不會計入 Worked Duty Shifts。完成更次後可於 Duty → Edit Duty 明確標記為 Worked；未來或未完成的更次不能新標記為 Worked。航機任務數量的計算獨立於 Duty 的工作進度。

Duty 日期一律以香港時間的更次開始日期為準。如結束時間早於開始時間，則視為翌日結束，包括跨月／跨年；開始與結束時間相同則會被拒絕。Day／Evening／Night 僅屬個人標籤。範本只會在目前批次視窗開啟期間保留，並非永久範本庫。

舊版 v0.1.1 Duty 如果沒有新的選填 `workState` 欄位，會保留原本按 Confirmed Duty 統計的含義。系統不會自動改寫資料、重設或重新生成種子資料。要存取同一份 localStorage，請使用相同的瀏覽器來源（origin）及 Port；重新命名 Repository 不會令資料跨來源搬移。舊版 App 不理解 Planned 工作進度，因此更表紀錄應使用 v0.1.2 或更新版本。

### 本機航空公司 Logo

全部 24 張現有本機 PNG 均設有明確、區分大小寫的顯示對應。Aircraft 卡片／詳情、Logbook、航空公司排名及現有選擇預覽均重用 AirlineLogo。即使 AirAsia／Jetstar 使用共通品牌圖片，仍以名稱／代碼獨立識別實際航空公司。圖片停用、無效、不可使用或載入失敗時，會改用代碼／名稱顯示。沒有下載新圖片。

**啟用顯示不等於取得法律使用許可。** 所有先前未核實的授權及來源仍維持未核實狀態；README 免責聲明與第三方通知仍然適用。

### 香港即時時鐘

Header 透過 `Asia/Hong_Kong` 顯示香港日期、星期及 HH:mm:ss HKT。系統每秒及在分頁恢復／重新取得焦點時，會以裝置當前時間重新計算；只有時鐘元件會更新。準確度取決於裝置時鐘，並未與權威時間伺服器同步。

## 截圖／預覽

使用虛構資料完成手動視覺驗收後，會加入截圖。目前尚未加入或連結任何截圖。

請按下列步驟在本機執行原型。[v0.1.2 驗收清單](docs/V0_1_2_ACCEPTANCE.md) 涵蓋全部新操作流程。本機 Edge 已在淺色及深色主題下測試七種視窗寬度，以及批次儲存／重新載入和分組詳情，未發現水平溢出。但這些檢查不代表已完成實體 iPhone／Safari 驗收。

## 技術架構

React 19、TypeScript 5.9、Vite 7、原生 CSS／設計 Token、Lucide React 圖示，以及瀏覽器 localStorage。測試使用 Vitest 4、jsdom 及 React Testing Library。ESLint 和 Prettier 用於程式碼檢查。項目沒有後端框架或外部資料服務。

## 開始使用

請使用 **Node.js 24 LTS**、npm、Git 及較新的 Edge／Chrome 瀏覽器。準備工作已在 Node.js 24.20.0 測試。毋須設定環境變數、帳戶或資料庫。

如要首次取得 Repository，並已擁有存取權限：

```powershell
git clone https://github.com/kabi1119/Turnaround-Coordinator-Logbook.git
cd Turnaround-Coordinator-Logbook
npm.cmd ci
npm.cmd run dev
```

如已在 Windows 擁有本機 Project，請在 `C:\Projects\Turnaround-Coordinator-Logbook` 開啟 PowerShell；有需要時先執行 `npm.cmd ci`，然後執行 `npm.cmd run dev`。使用 `npm.cmd` 可以避開 PowerShell 的 `npm.ps1` 執行原則問題，而不需改動系統政策。

開啟 Vite 顯示的網址，通常為 `http://127.0.0.1:5173/`；如果 Port 已被佔用，請以終端機實際顯示的網址為準。按 `Ctrl+C` 停止。

### 檢查及本機 Build 預覽

```powershell
npm.cmd audit
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run format:check
npm.cmd run preview
```

Tests 會執行一次；`npm.cmd run test:watch` 會啟動監察模式。Build 會進行 TypeScript 檢查，並將檔案寫入被 Git 忽略的 `dist/`，不會進行部署。Preview 通常使用 `http://127.0.0.1:4173/`。在其他作業系統可用 `npm` 代替 `npm.cmd`。

### 試用原型

1. 查看 Home 上三種不同統計總數及最近的虛構紀錄。
2. 新增 Aircraft；在 Review 畫面選擇 Back to Edit 或取消，然後再明確確認儲存。
3. 試看 `2026-10-16` 的日更、`2026-10-15` 的通宵更次，以及未計入已工作統計的 Planned 更次。
4. 在 Settings 啟用選填的虛構資料欄位，測試獨立航段狀態、航班號及自訂停機位。
5. 切換 Timeline／Calendar、組合篩選條件及查看 Statistics。
6. 新增 Journal 反思紀錄；匯出前在 Privacy Preview 覆核選定的故事。
7. 更新舊樣本時使用 Refresh sample records，先覆核變更清單。Load sample records／Clear local records 是另行確認的整體替換操作，不應用於混合了個人紀錄的資料集合。

### iPhone／區域網絡測試

iPhone 上的 localhost 指向 iPhone 本身。要在同一個可信任 Wi-Fi 網絡測試，可選擇執行：

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

在手機開啟 Vite 顯示的 Windows 區域網絡網址；只在需要時允許防火牆的私人網絡存取。這會向同一網絡開放開發伺服器，並非公開網站託管。區域網絡 HTTP 測試並不等於經驗證的 HTTPS／iOS PWA 環境。

## 項目狀態

- **v0.1.0：** 初始互動式前端原型及核心領域操作流程。
- **v0.1.1：** 視覺／主題改進、裝飾性雷達、響應式導航，以及航空公司參考資料／Fallback 元件。公開準備工作亦更新了文件及開發測試工具鏈。
- **v0.1.2：** 完整顯示適用的 Aircraft 詳情與停機位相關時間摘要；經覆核的每月／批次 Planned Duty，附設衝突檢查；由擁有者啟用的本機 PNG，授權狀態獨立記錄；香港裝置時鐘即時顯示。
- **v0.1.3：** 更大的 Logo 顯示、按圖片邊距調整、統一的 24 間航空公司預設目錄、保守且須覆核的舊 Demo 航空公司更新，以及針對 Modal 捲動／合成繪製的優化。
- **v0.1.4：** 可無障礙操作的圖片組合選擇框、24 間航空公司各一筆且分佈於不同日期的虛構任務、經覆核的資料集更新、更突出的 HKT 時鐘、過往 Duty 歷史，以及永久版本號／Commit 規則。
- **v0.1.5（僅文件更新）：** 新增內容對應的繁體中文（香港）README 及英文版本優先聲明；應用程式功能仍維持 v0.1.4。
- **v0.2.0：** 精簡預發佈介面、本機 SVG 東亞雷達地圖、四筆虛構航機任務、經覆核的安全樣本更新，以及批次更表聲明簡化。
- **尚未實作：** 正式後端、真實身份驗證／Passkey、雲端同步、加密備份、完整匯入／還原、Service Worker／離線重新載入，以及經驗證的 iOS PWA 安裝。
- **驗證：** 已完成本機 Edge 不同視窗尺寸／排版及新功能流程檢查；實體 iPhone／Safari、實際觸控／鍵盤、下載及列印驗收仍有待完成。項目尚未部署。

已批准的 PRD 描述的是更完整的未來產品，並不代表所有正式版功能已經完成。詳見 [原型狀態](PROTOTYPE_STATUS.md)、[人工驗收](docs/MANUAL_ACCEPTANCE.md) 及 [公開準備](docs/PUBLICATION_PREPARATION.md)。

## 私隱與資料處理

公開展示只能使用虛構資料。v0.2.0 初始樣本包含 3 個 Duty、4 筆 Confirmed Aircraft 任務及 2 篇 Journal。舊版 18／24 筆任務資料只保留作歷史識別及相容性測試；新樣本數量不是使用者紀錄上限。既有儲存資料不會被自動取代。

修改內容儲存在此瀏覽器來源（origin）的**未加密 localStorage**，Key 為 `tco-logbook-demo-v0.1`。Local Storage 並非安全的正式雲端儲存、身份驗證、存取控制或備份。清除瀏覽器資料、私人瀏覽模式或儲存失敗都可能導致資料遺失；不同瀏覽器、裝置、Port 及來源各自使用獨立資料。尚未實作多分頁衝突處理。

請勿輸入機密工作紀錄、員工／乘客資料、內部截圖或專有程序。任何真實工作用途均須先取得適當授權；原型的私隱開關並不構成該等授權。

選填欄位群組預設停用。**封存／隱藏只會保留但不顯示底層資料，不會實際刪除或加密。** 明確的本機欄位刪除功能是另一項獨立操作。先前已下載的副本不受 App 控制。

私隱篩選及報告欄位白名單**不會自動清理 Journal 任意自由文字中的敏感內容**。分享前應逐篇覆核故事及匯出內容。JSON 包含選定的統計及故事；CSV 只包含數量統計；瀏覽器 PDF 是列印流程。以上均非安全的完整備份或經僱主核實的報告。三十日垃圾桶適用期限只是示範規則，並非自動清除或資料保留保證。

## 航空公司品牌及商標聲明

項目擁有者決定在預期公開的作品集版本中保留 `public/assets/airlines/` 內**現有的 24 張航空公司 PNG**。**其公開再分發許可仍未核實。** 保留圖片是擁有者的發布決定，不構成獲授權的證據；非商業用途及本免責聲明均不等於取得許可。

目前提供的來源頁可識別 CX（Seeklogo）、LH（PlusPNG）及 9G（CDNLogo）。其他圖片的確切下載頁未知；擁有者表示大部分來自 Seeklogo。提供下載的網站不一定是權利持有人。

由擁有者啟用的圖片顯示清單，現已獨立於未變更的法律授權紀錄，對應全部 24 張原始 PNG。缺少、停用、無效或載入失敗的圖片，會以代碼／名稱作替代顯示；沒有將任何未核實的許可標記為已獲批准。**Vite 的 public 目錄內的圖片會被複製進 Build，即使元件沒有顯示，也可以直接存取。** 因此未來 Build 會包含這批保留的圖片。執行時不會向下載來源網站發出請求。

詳見完整的 [圖片資產審核](docs/AIRLINE_ASSET_AUDIT.md) 及 [校驗碼清單](docs/AIRLINE_ASSET_INVENTORY.json)。CX、LD（華民航空）及 HX（香港航空）是不同航空公司。由擁有者指定的 24 間航空公司預設目錄，並非完整的香港國際機場或 HAS 停機坪／TCO 客戶名單；原有歷史參考紀錄另行保留，並未核實任何地勤服務關係。

## 原始碼與使用條款

本 Repository 擬公開供個人作品集、教育性閱讀及示範用途。實際 GitHub 可見性由擁有者另外管理。

**目前並無就 TCO Logbook 原創原始碼授予任何開源軟件許可。**

除適用法律或 GitHub 服務條款另有規定外，項目原創程式碼的所有權利均予保留。Repository 公開可見本身不代表授予廣泛的使用、修改、再分發或商業再授權權利。GitHub 平台條款下適用的查看及 Fork 權限不受影響。

第三方套件、商標、標誌及其他資產仍受各自許可及權利約束，本聲明不會重新授權該等內容。詳見 [第三方聲明](THIRD_PARTY_NOTICES.md)。項目並未新增獨立的 `LICENSE` 檔案。

## 開發路線圖

**僅屬計劃，須另行批准：** 公司政策／供應商／成本決策、真實身份驗證、持久後端儲存、離線同步與衝突處理、公開航機資料查詢、經驗證的匯入／還原、加密備份，以及正式版／iPhone PWA 驗收。這些是已批准 PRD 的未來階段，並非已交付的 v0.2.0 功能。

v0.2.0 仍是本機前端預發佈版。OCR／Excel 更表匯入、人力資源系統整合、雲端服務及正式生產功能均繼續延後。

## 語言版本效力

本 README 同時提供英文及繁體中文（香港）版本，以方便不同語言的讀者閱讀及參考。兩個版本旨在傳達相同內容。**如兩個版本之間出現任何差異、歧義或不一致之處，概以英文版本為準。**
