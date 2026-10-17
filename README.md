## Disclaimer & Independent Project Notice

**I develop TCO Logbook as an independent, non-commercial personal software project for learning, my portfolio, and my interest in aviation.**

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

All sample records and operational scenarios I publish are fictional. They do not represent an official HAS or airline operational database. I do not intend to publish confidential employer information, real passenger information, internal company documents, or proprietary operational records.

**TCO Logbook is a personal software prototype and must not be used as an official operational, safety-critical, or production aviation management system.**

---

# TCO Logbook

**A personal aviation operations logbook and career development companion.**

I built TCO Logbook as an aviation-oriented web application for organizing, reviewing, and reflecting on aircraft handling assignments, duty shifts, recorded flight activity, and professional experiences. The current **v0.2.0 Pre-release** runs locally with fictional sample records. **v0.2.0c is a documentation-only refinement**; it does not change the application features.

## About the Project

My interest in aviation and ground operations inspired me to explore how structured personal records can turn experience into useful statistics and career reflections. I designed the app as a modern, mobile-friendly logbook for myself and others interested in aviation.

I develop and maintain this project independently as a non-commercial portfolio project. No aviation organization commissioned, sponsored, or endorsed its development.

## Features

- **Aircraft Handling Logbook:** Full Turnaround, Departure Only and Arrival Only assignments; Primary Coordinator, Supporting Coordinator and Training / Observation roles; Draft and Confirmed records; airline/aircraft details plus optional registration, flight and parking-bay fields under privacy controls. Every Aircraft save requires Review → Confirm & Save. Arrival and Departure statuses remain separate.
- **Duty Management:** Multiple duties on one date, optional shift times, cross-midnight shift grouping and linked aircraft records. Trashing a duty preserves its aircraft records and offers explicit reconnection when restored.
- **Dashboard:** Home totals, recent activity and a locally rendered, animated East Asia radar map with reduced-motion support. It is decorative, not live radar, flight tracking or navigation.
- **Statistics:** Date and combined filters, airline/aircraft rankings, monthly trends, role breakdowns and three mutually exclusive handling types. One Full Turnaround counts as one assignment. Logged includes Training; Handled and career coordinated counts exclude Training. Primary is a subset, not an extra amount to add to Handled.
- **Career Journal:** Standalone or linked reflections, STAR-style fields, competencies, Draft/Confirmed status and optional self-reported outcomes. Journal entries do not increase aircraft handling counts.
- **Reports and local controls:** Privacy Preview, reviewed JSON, counts-only CSV and browser Print / Save as PDF; local Trash/restore and explicitly confirmed sample-load/reset actions. These tools are not full backups or automatic anonymization.
- **User experience:** Home | Logbook | Add | Statistics | Journal, separate Settings, responsive desktop/mobile layouts, English / Traditional Chinese interface and system light/dark themes. Entered content and standard aviation references retain their original language.

## v0.2.0 Pre-release

- **Branding and layout:** I made the header brand more prominent and use the full name **Turnaround Coordinator Logbook** there. The rest of the interface uses **TCO Logbook**. I removed the upper showcase status strip and moved release, local-storage and Hong Kong metadata to the desktop sidebar footer (or a compact content footer on smaller screens).
- **East Asia radar map:** An original local SVG outline of East Asia / the Western Pacific replaces the plain radar background. The aircraft and CSS sweep share an approximate Hong Kong-area anchor. This is decorative geography, not navigation, live radar or a GIS product. It uses no external map service, tiles, third-party map artwork or network requests. Reduced-motion support and pausing animations while dialogs are open remain in place.
- **Compact fictional samples:** I reduced the initial sample set to **4 Confirmed aircraft assignments, 3 duties (2 Worked / 1 Planned) and 2 journals**. Six applicable flight legs cover Early, On Time, Delayed, Cancelled, Not Recorded and Other; the samples also cover all three roles and handling types, actual/scheduled/missing times, a custom bay, a disruption, linked and standalone journals, multiple aircraft per duty and an overnight duty. Derived counts are **4 Logged / 3 Handled / 2 Primary**. All identifiers are invented; I am not presenting employer operations or official rosters.
- **Quieter interface:** I removed repetitive visible DEMO labels from new screens and sample records. A concise Settings disclosure and export notice still identify fictional samples and local-only limitations. Optional privacy fields remain off by default and should only be enabled for appropriately authorized fictional demonstrations.
- **Simpler batch entry:** Batch Add Duties no longer asks users to acknowledge that shift hours are self-chosen. Valid time entry, conflict checks, explicit overlap override, review, final confirmation and Planned classification remain intact.
- **Safe sample refresh:** Existing browser storage loads unchanged. Settings → **Refresh sample records** previews replacement of complete, unmodified historical fixtures with the smaller set. Custom records and settings remain. Edited samples, duplicate IDs and personal records linked to samples being removed block the whole transaction. No automatic refresh or wholesale database reset occurs. User-entered or edited legacy text stays as entered until explicitly reviewed; visual cleanup never rewrites personal text.
- **Existing catalogue:** All 24 selectable airlines and local PNGs remain available. The four sample airlines are not a limit on selectable airlines or user records. Enabling logo display still does not establish redistribution rights.

See [v0.2.0 acceptance](docs/V0_2_0_ACCEPTANCE.md). This is a local frontend pre-release, **not** a production aviation system. I have not introduced authentication, a backend, cloud synchronization, deployment or other external services as part of this release.

## Historical v0.1.4 Improvements

- **Airline image combobox:** all 24 catalogue options show a local logo, full name and IATA code. Search names/codes, use arrows/Enter/Escape, or retain historical/custom text. Closed fields preview the selected identity. Mouse and touch share the same selection behavior.
- **24 synthetic assignments on 24 dates:** one per catalogue airline, all Confirmed, covering nine role/type combinations with visibly fictional flights/registrations. Frozen Hong Kong dates span 12 August–16 October 2026. Derived totals: **24 Logged / 18 Handled / 9 Primary**; each handling type contributes 8 assignments. There are 25 duties (including the original six, two on one date and an overnight example) and 3 journals.
- **Safe refresh:** Settings → **Refresh sample records** now previews full scenario replacement, generated rows, new duties and Journal/disruption impact. Unchanged v0.1.1–v0.1.3 samples are recognized by complete payload equality. IDs and Journal references remain; scenario dates, airline, timings and Duty links may change as previewed. Existing Duty/Journal payloads, unrelated records and settings stay intact. Edited/unrecognized required IDs or different-date/trashed Duty collisions block the whole transaction; nothing is overwritten. Repeated refresh does not accumulate rows. Never use Seed/Reset to refresh a mixed collection.
- **Dashboard:** larger 24 px desktop / 18 px mobile HKT clock; Home → **View All Previous Duties** opens descending HK start-date history with details and Planned/Worked badges. Future shifts stay in Logbook. Add Duty, Batch Add Duties and the central Add tab remain.
- **Version policy:** [VERSIONING.md](docs/VERSIONING.md) defines my custom `vMAJOR.MINOR.PATCH[letter]` convention (not strict SemVer), production approval and version-first English release commits. Future work proposes a scope-appropriate version; agreed versions never change silently.

Home and Statistics describe overall totals separately from the exact unchanged v0.1.4 demo subset. Edited/historical/custom records remain in overall totals. Existing browser storage is loaded unchanged; no automatic refresh, migration or reset occurs. See [v0.1.4 acceptance](docs/V0_1_4_ACCEPTANCE.md).

## Historical v0.1.3 Improvements

- **Readable airline logos:** card frames are 112 × 56 px on desktop and 96 × 52 px on phones; detail frames are 144 × 72 / 128 × 64 px. Compact views remain 56 × 36 px. Measured, padded artwork bounds adjust CSS placement/uniform scale so transparent or neutral margins do not shrink the artwork. All original PNGs and licensing records are unchanged; no derivative image is generated.
- **My curated 24-airline catalogue:** one identity/asset source drives default selection, IATA/name/alias search, registry and PNG mapping. NH / SQ / HX / EK are excluded from defaults and fresh samples, while historical/custom records remain visible and editable. Inclusion is not a verified HAS customer relationship. See [catalogue](docs/AIRLINE_CATALOGUE.md).
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
2. Choose Day / Evening / Night / Custom and enter your own start/end times. There are no official or prefilled employer shift hours.
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
3. Inspect a day duty, an overnight duty and a Planned duty that is excluded from Worked statistics.
4. In Settings, enable optional synthetic fields to try separate leg statuses, flight numbers and custom parking bays.
5. Switch Timeline/Calendar, combine filters and inspect Statistics.
6. Create a Journal reflection; review selected stories in Privacy Preview before exporting.
7. Use **Refresh sample records** for reviewed changes to recognized samples. **Load sample records** and **Clear local records** replace records only after separate explicit confirmation; avoid them in mixed personal collections.

### iPhone / LAN testing

An iPhone's localhost is the iPhone itself. Optional testing on the same trusted Wi-Fi uses:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Open the Windows LAN address printed by Vite on the phone; allow private-network firewall access only as needed. This exposes the development server to that network. It is not public hosting. LAN HTTP is not a validated HTTPS/iOS PWA environment.

## Project Status

- **v0.1.0:** Initial interactive frontend prototype and domain workflows.
- **v0.1.1:** Visual/theme enhancements, decorative radar, responsive navigation and airline reference/fallback components. This publication preparation updates documentation and the development test toolchain.
- **v0.1.2:** Complete applicable Aircraft details and gate-time card summaries; reviewed monthly/batch planned duties with conflict checks; local PNG display enabled by me with independent rights status; live Hong Kong device clock.
- **v0.1.3:** Larger margin-aware logo presentation, unified 24-airline defaults, conservative reviewed legacy-demo airline refresh and targeted modal scroll/compositing changes.
- **v0.1.4:** Accessible image combobox, one synthetic assignment per 24 catalogue airlines on distinct dates, reviewed dataset refresh, prominent HKT clock, previous-duty history and permanent version/commit conventions.
- **v0.1.5 (documentation only):** Added an equivalent Traditional Chinese (Hong Kong) README and an English-language precedence notice; application features remained at v0.1.4.
- **v0.2.0 Pre-release:** Refined branding and footer metadata, local SVG East Asia radar map, compact fictional records, quieter interface and simpler batch scheduling acknowledgement.
- **v0.2.0c (documentation only):** Reworked owner statements into my first-person voice in English and Traditional Chinese, and corrected the recorded logo download sources. Application functionality remains at v0.2.0.
- **Not implemented:** Production backend, real authentication/passkeys, cloud synchronization, encrypted backup, full import/restore, Service Worker/offline reload and validated iOS PWA installation.
- **Verification:** Local Edge viewport/layout and new workflow checks completed; actual iPhone/Safari, physical touch/keyboard, download and print acceptance remains pending. No deployment has been performed.

The approved PRD describes a larger future product. It does not mean all production features are complete. See [prototype status](PROTOTYPE_STATUS.md), [manual acceptance](docs/MANUAL_ACCEPTANCE.md) and [publication preparation](docs/PUBLICATION_PREPARATION.md).

## Privacy & Data Handling

I only use fictional data in public demonstrations. The v0.2.0 initial sample set contains **3 duties, 4 Confirmed aircraft assignments and 2 journal entries**. The former 18- and 24-assignment fixtures are retained solely for historical recognition and compatibility tests. The sample size does not limit personal records, and existing stored records are not automatically replaced.

Changes persist in this browser origin's **unencrypted localStorage**, key `tco-logbook-demo-v0.1`. Local Storage is not secure production cloud storage, authentication, access control or backup. Browser clearing, private browsing and storage failures can lose data; other browsers, devices, ports and origins have separate data. Multi-tab conflict handling is not implemented.

**I do not use this public prototype to collect confidential workplace records, employee/passenger information, internal screenshots or proprietary procedures, and I ask users not to enter them.** Any actual workplace use would require appropriate authorization; the privacy switches do not grant it.

Optional field groups start disabled. **Archive/hide retains underlying values; it does not physically delete or encrypt them.** The explicit local field-deletion option is separate. Previously downloaded copies remain outside the app.

Privacy filters and report field allowlists **do not sanitize arbitrary Journal free text automatically**. I recommend reviewing every story and export before sharing. JSON contains selected counts/stories; CSV contains counts; browser PDF is a print workflow. None is a secure full backup or employer-verified report. Thirty-day Trash eligibility is a demo rule, not an automatic purge or retention guarantee.

## Airline Branding & Trademark Notice

I have chosen to retain **24 airline PNG files** in `public/assets/airlines/` for my public portfolio. **I have not verified permission to redistribute these images publicly.** My decision to include them does not establish authorization; neither non-commercial use nor this disclaimer grants permission.

**Source correction (v0.2.0c):** According to my own asset sourcing records, **23 of the 24 PNGs were obtained from Seeklogo, and the 9G (Sun PhuQuoc Airways) PNG was obtained from CDNLogo**. This includes the LH logo among those sourced from Seeklogo; my earlier README incorrectly listed PlusPNG for LH. I have not provided verified individual download-page URLs for all the files. The website where I downloaded an image is not necessarily its trademark or copyright owner, and the source attribution does not establish redistribution rights.

I enabled a local display manifest for all 24 original PNGs without changing the separate records of legal permission. Missing, disabled, invalid or failed mappings fall back to an airline code/name; **I have not marked any unverified redistribution permission as approved**. Vite copies files in `public/` into application builds, where they are directly accessible even if a component never displays them. The builds therefore include these images. The app does not request them from their download websites at runtime.

See the [asset audit](docs/AIRLINE_ASSET_AUDIT.md) and [checksum inventory](docs/AIRLINE_ASSET_INVENTORY.json). CX, LD (Air Hong Kong) and HX (Hong Kong Airlines) are distinct. **My 24-airline default catalogue is my own product selection, not a verified or exhaustive HKIA / HAS ramp or TCO customer list.** Historical reference records remain available separately; I have not verified handling affiliations.

## Source Code & Usage

I maintain this repository as a publicly accessible personal portfolio for educational viewing and demonstration. I manage its GitHub visibility separately.

**I have not granted an open-source software licence for my original TCO Logbook source code.**

Unless otherwise required by applicable law or the GitHub Terms of Service, I reserve all rights in my original project code. Public visibility does not by itself grant broad reuse, modification, redistribution or commercial sublicensing rights. GitHub's applicable platform-level viewing and forking permissions remain unaffected.

Third-party packages, trademarks, logos and other assets remain subject to their respective licences and rights. **I do not relicense them by making this notice.** See [third-party notices](THIRD_PARTY_NOTICES.md). I have not added a standalone project `LICENSE` file.

## Development Roadmap

**My future roadmap, subject to separate decisions and approval:** organizational policy, providers/costs, real authentication, durable backend storage, offline synchronization/conflicts, public aircraft lookup, validated import/restore, encrypted backups and production/iPhone PWA acceptance. These are future phases described by the approved PRD, not delivered v0.2.0 functionality.

I am keeping v0.2.0 as a local frontend pre-release. OCR/Excel roster imports, HR integrations, cloud services and production features remain deferred.

## Language Precedence

This README is provided in English and Traditional Chinese (Hong Kong) for accessibility and reference. Both versions are intended to convey the same information. **In the event of any discrepancy, ambiguity, or inconsistency between the two versions, the English version shall prevail.**

---

## 免責聲明與獨立項目聲明

**我以學習、個人作品集展示及航空興趣為目的，獨立開發 TCO Logbook 這個非商業性質的個人軟件項目。**

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

我公開發佈的所有樣本紀錄及營運情境均為虛構資料，並非 HAS 或任何航空公司的官方營運資料庫。我無意公開僱主機密資料、真實乘客資料、公司內部文件或專有營運紀錄。

**TCO Logbook 是個人軟件原型，不得用作航空公司、機場或地勤服務機構的官方營運系統、安全關鍵系統或正式生產環境的航空管理系統。**

---

# TCO Logbook

**個人航空營運紀錄及職涯發展助手。**

我獨立開發 TCO Logbook 這個航空主題網頁應用程式，用來整理、查閱及反思航機地勤處理任務、工作更次、已記錄的航班活動及職涯經驗。目前的 **v0.2.0 Pre-release** 在本機執行，使用虛構樣本紀錄；**v0.2.0c 只更新文件**，不改動應用程式功能。

## 關於本項目

我對航空及地面營運的興趣啟發我開發這個項目，希望透過有系統的個人紀錄，將經驗整理成有意義的統計數據與職涯反思。我希望它既可成為自己的數碼 Logbook，也能讓有相同興趣的人參考。

我獨立開發及維護這個非商業個人作品集項目，並未接受任何航空機構委託、贊助或認可。

## 功能特色

- **航機處理紀錄（Aircraft Handling Logbook）：** 支援 Full Turnaround（完整過站）、Departure Only（僅離港）及 Arrival Only（僅抵港）任務；Primary Coordinator（主要協調員）、Supporting Coordinator（支援協調員）及 Training / Observation（培訓／觀察）角色；Draft（草稿）及 Confirmed（已確認）紀錄。可記錄航空公司與機型，以及在私隱控制下選填註冊編號、航班及停機位資料。每次儲存 Aircraft 紀錄前均須經過 Review → Confirm & Save；抵港與離港狀態分別記錄。
- **更次管理（Duty Management）：** 支援同一天多個更次、選填上下班時間、跨午夜更次歸類，以及關聯航機紀錄。將 Duty 移至垃圾桶不會刪除其航機紀錄；還原時可經明確確認後重新連結。
- **主頁儀表板（Dashboard）：** 顯示 Home 統計總數、最近活動，以及使用本機 SVG 繪製的東亞雷達地圖與動畫，支援減少動態效果偏好設定。地圖純屬裝飾，並非即時雷達、航班追蹤或導航功能。
- **統計（Statistics）：** 日期及組合篩選、航空公司／機型排名、每月趨勢、角色分佈，以及三種互斥的處理類型。一次 Full Turnaround 只計算一筆任務。Logged 包含 Training；Handled 與職涯協調任務統計則排除 Training。Primary 是 Handled 的子集，不應額外加在 Handled 總數之上。
- **職涯日誌（Career Journal）：** 支援獨立或關聯式反思、STAR 結構欄位、能力標籤、Draft／Confirmed 狀態及可選填的自行申報成果。Journal 紀錄不會增加航機處理任務數量。
- **報告與本機控制：** Privacy Preview（私隱預覽）、經覆核的 JSON、僅含數量統計的 CSV、瀏覽器 Print / Save as PDF、本機垃圾桶／還原，以及須另外確認的樣本載入／清除操作。這些功能並非完整備份或自動匿名化工具。
- **使用者體驗：** Home | Logbook | Add | Statistics | Journal 五個主分頁，另設 Settings；具備桌面／手機響應式版面、英文／繁體中文介面，以及跟隨系統的淺色／深色主題。使用者輸入內容及標準航空參考資料均保留其原有語言。

## v0.2.0 預發佈版

- **品牌與版面：** 我將左上角品牌放大，並改用完整名稱 **Turnaround Coordinator Logbook**；其他介面仍使用 **TCO Logbook**。我移除上方的展示狀態列，將版本、本機儲存及香港時區資訊移至桌面側欄底部；較小螢幕則於內容頁尾顯示。
- **東亞雷達地圖：** 我以原創的本機 SVG 東亞／西太平洋輪廓取代原本的純雷達背景，讓飛機圖示與 CSS 掃描動畫以香港附近為中心。地圖地理位置僅屬概略裝飾，並非導航、即時雷達或 GIS 產品；不使用外部地圖服務、圖磚、第三方地圖素材或網絡請求。減少動態效果支援，以及開啟對話框時暫停動畫的安排均保留。
- **精簡虛構樣本：** 我將初始樣本精簡為 **4 筆 Confirmed Aircraft 任務、3 個 Duty（2 Worked／1 Planned）及 2 篇 Journal**。六個適用航段涵蓋 Early、On Time、Delayed、Cancelled、Not Recorded、Other，以及三種角色與處理類型、實際／表定／缺少時間、自訂停機位、突發事件、關聯／獨立日誌、同一更次多架航機和通宵更次。依資料計算的總數為 **4 Logged／3 Handled／2 Primary**。所有識別資料均為虛構，並非僱主營運資料或官方更表。
- **更簡潔的介面：** 我移除新介面及樣本中重複的 DEMO 標記；Settings 的簡短說明及匯出報告通知仍清楚交代樣本虛構及僅限本機使用的限制。選填的私隱欄位預設關閉，只應用於獲適當授權的虛構示範。
- **簡化批次更表：** Batch Add Duties 不再要求確認「更次時數由自己選擇」的核取方塊；有效時間、衝突檢查、明確的重疊確認、覆核、最終確認及 Planned 分類均保留。
- **安全更新樣本：** 瀏覽器既有資料會原樣載入。Settings → **Refresh sample records** 會先預覽以精簡樣本取代完整且未經修改的歷史樣本。自訂紀錄及設定會保留；如樣本被編輯、ID 重複，或個人紀錄仍參照將被移除的樣本，整個更新會被阻止。不會自動更新或清空資料庫；使用者曾輸入或修改的舊文字會保留至經明確覆核為止，介面清理不會擅自改寫個人內容。
- **保留航空公司目錄：** 24 間航空公司選項及本機 PNG 均繼續提供。四間樣本航空公司並非可選擇的航空公司或個人紀錄數量上限。啟用 Logo 顯示仍不等於取得再分發許可。

詳見 [v0.2.0 驗收清單](docs/V0_2_0_ACCEPTANCE.md)。此版本仍為本機前端預發佈版，**並非**正式航空營運系統。我沒有在這個版本加入身份驗證、後端、雲端同步、部署或其他外部服務。

## 過往 v0.1.4 改進內容

- **附圖片的航空公司組合選擇框：** 24 個目錄選項均顯示本機 Logo、完整名稱及 IATA 代碼。可按名稱／代碼搜尋，以方向鍵、Enter、Escape 操作，亦可保留歷史／自訂文字。關閉的選擇欄位會預覽已選航空公司；滑鼠及觸控使用相同選取邏輯。
- **24 個日期的 24 筆虛構航機任務：** 目錄內每間航空公司各一筆，全部為 Confirmed，涵蓋九種角色／處理類型組合，並使用明顯虛構的航班號及註冊編號。固定的香港日期橫跨 2026 年 8 月 12 日至 10 月 16 日。依據資料計算的總數為 **24 Logged / 18 Handled / 9 Primary**；三種處理類型各有 8 筆任務。另有 25 個 Duty（包括原本六個、同一天兩更及一個通宵更次範例）與 3 篇 Journal。
- **安全更新示範資料：** Settings → **Refresh sample records** 會先預覽整個情境資料的替換內容、產生的紀錄、新增 Duty，以及對 Journal／突發事件的影響。v0.1.1–v0.1.3 未改動的樣本，會以完整資料內容相等作識別。ID 及 Journal 參照維持不變；情境日期、航空公司、時間及 Duty 關聯則可能按預覽更改。既有 Duty／Journal 內容、無關紀錄及設定維持不變。如必要 ID 曾被編輯／無法辨識，或出現日期不符／已移至垃圾桶的 Duty 衝突，整個交易會被阻止，不會覆寫任何資料。重複更新不會累積重複紀錄。切勿使用 Seed／Reset 更新混合了個人紀錄的資料集合。
- **主頁儀表板：** HKT 時鐘字體加大至桌面 24 px／手機 18 px；Home → **View All Previous Duties** 可開啟按香港更次開始日期倒序排列的歷史紀錄，並顯示詳情及 Planned／Worked 標籤。未來更次仍在 Logbook 顯示。Add Duty、Batch Add Duties 及中央 Add 分頁保留。
- **版本管理政策：** 我在 [VERSIONING.md](docs/VERSIONING.md) 定義自己採用的 `vMAJOR.MINOR.PATCH[letter]` 格式（並非嚴格遵循 SemVer）、正式版批准機制，以及版本號置前的英文 Release Commit 格式。往後開發會按更新規模建議版本號，已同意的版本不得擅自更改。

Home 及 Statistics 會將整體總數與未經修改的 v0.1.4 示範資料子集分開說明。已編輯、歷史及自訂紀錄仍計入整體總數。瀏覽器既有儲存資料會原樣載入，不會自動更新、遷移或重設。詳見 [v0.1.4 驗收清單](docs/V0_1_4_ACCEPTANCE.md)。

## 過往 v0.1.3 改進內容

- **更清晰的航空公司 Logo：** 桌面卡片圖片框為 112 × 56 px、手機為 96 × 52 px；詳細資料框為 144 × 72／128 × 64 px；Compact 顯示維持 56 × 36 px。程式會測量圖片中帶有留白的可見內容邊界，再調整 CSS 位置及等比例縮放，避免透明或中性背景留白令 Logo 顯得太細。24 張原始 PNG 與授權紀錄均不變，亦沒有產生衍生圖片。
- **我指定的 24 間航空公司目錄：** 由同一份航空公司身份／資產資料來源支援預設選項、IATA／名稱／別名搜尋、Registry 及 PNG 對應。NH／SQ／HX／EK 不再出現在預設選項及新生成的示範紀錄，但歷史／自訂紀錄仍可查看及編輯。列入目錄不等於已核實其與 HAS 的客戶關係。詳見 [航空公司目錄](docs/AIRLINE_CATALOGUE.md)。
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
3. 試看一個日更、一個通宵更次，以及不計入已工作統計的 Planned Duty。
4. 在 Settings 啟用選填的虛構資料欄位，測試獨立航段狀態、航班號及自訂停機位。
5. 切換 Timeline／Calendar、組合篩選條件及查看 Statistics。
6. 新增 Journal 反思紀錄；匯出前在 Privacy Preview 覆核選定的故事。
7. 更新舊樣本時使用 **Refresh sample records**，先覆核變更清單。**Load sample records**／**Clear local records** 是須另行明確確認的整體替換操作，不應用於混合了個人紀錄的資料集合。

### iPhone／區域網絡測試

iPhone 上的 localhost 指向 iPhone 本身。要在同一個可信任 Wi-Fi 網絡測試，可選擇執行：

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

在手機開啟 Vite 顯示的 Windows 區域網絡網址；只在需要時允許防火牆的私人網絡存取。這會向同一網絡開放開發伺服器，並非公開網站託管。區域網絡 HTTP 測試並不等於經驗證的 HTTPS／iOS PWA 環境。

## 項目狀態

- **v0.1.0：** 初始互動式前端原型及核心領域操作流程。
- **v0.1.1：** 視覺／主題改進、裝飾性雷達、響應式導航，以及航空公司參考資料／Fallback 元件。公開準備工作亦更新了文件及開發測試工具鏈。
- **v0.1.2：** 完整顯示適用的 Aircraft 詳情與停機位相關時間摘要；經覆核的每月／批次 Planned Duty，附設衝突檢查；我啟用的本機 PNG 顯示與授權狀態分開記錄；香港裝置時鐘即時顯示。
- **v0.1.3：** 更大的 Logo 顯示、按圖片邊距調整、統一的 24 間航空公司預設目錄、保守且須覆核的舊 Demo 航空公司更新，以及針對 Modal 捲動／合成繪製的優化。
- **v0.1.4：** 可無障礙操作的圖片組合選擇框、24 間航空公司各一筆且分佈於不同日期的虛構任務、經覆核的資料集更新、更突出的 HKT 時鐘、過往 Duty 歷史，以及永久版本號／Commit 規則。
- **v0.1.5（僅文件更新）：** 新增內容對應的繁體中文（香港）README 及英文版本優先聲明；當時應用程式功能仍維持 v0.1.4。
- **v0.2.0 Pre-release：** 更新品牌／頁尾資料、本機 SVG 東亞雷達地圖、精簡虛構樣本、簡化介面及批次更表操作。
- **v0.2.0c（僅文件更新）：** 我將中英文 README 涉及項目決策及責任的敘述改成第一人稱，並更正 Logo 下載來源紀錄；App 功能仍維持 v0.2.0。
- **尚未實作：** 正式後端、真實身份驗證／Passkey、雲端同步、加密備份、完整匯入／還原、Service Worker／離線重新載入，以及經驗證的 iOS PWA 安裝。
- **驗證：** 已完成本機 Edge 不同視窗尺寸／排版及新功能流程檢查；實體 iPhone／Safari、實際觸控／鍵盤、下載及列印驗收仍有待完成。項目尚未部署。

已批准的 PRD 描述的是更完整的未來產品，並不代表所有正式版功能已經完成。詳見 [原型狀態](PROTOTYPE_STATUS.md)、[人工驗收](docs/MANUAL_ACCEPTANCE.md) 及 [公開準備](docs/PUBLICATION_PREPARATION.md)。

## 私隱與資料處理

我在公開示範中只使用虛構資料。v0.2.0 初始樣本包含 **3 個 Duty、4 筆 Confirmed Aircraft 任務及 2 篇 Journal**。舊版 18／24 筆任務資料僅保留作歷史識別及相容性測試。樣本數量並非個人紀錄的上限；瀏覽器既有資料不會自動被替換。

修改內容儲存在此瀏覽器來源（origin）的**未加密 localStorage**，Key 為 `tco-logbook-demo-v0.1`。Local Storage 並非安全的正式雲端儲存、身份驗證、存取控制或備份。清除瀏覽器資料、私人瀏覽模式或儲存失敗都可能導致資料遺失；不同瀏覽器、裝置、Port 及來源各自使用獨立資料。尚未實作多分頁衝突處理。

**我不會使用這個公開原型收集機密工作紀錄、員工／乘客資料、內部截圖或專有程序，也請使用者不要輸入此類資料。** 任何真實工作用途均須先取得適當授權；應用程式的私隱開關並不構成相關授權。

選填欄位群組預設停用。**封存／隱藏只會保留但不顯示底層資料，不會實際刪除或加密。** 明確的本機欄位刪除功能是另一項獨立操作。先前已下載的副本不受 App 控制。

私隱篩選及報告欄位白名單**不會自動清理 Journal 任意自由文字中的敏感內容**。我建議使用者在分享前逐篇覆核故事及匯出內容。JSON 包含選定的統計及故事；CSV 只包含數量統計；瀏覽器 PDF 是列印流程。以上均非安全的完整備份或經僱主核實的報告。三十日垃圾桶適用期限只是示範規則，並非自動清除或資料保留保證。

## 航空公司品牌及商標聲明

我決定在公開的個人作品集中保留 `public/assets/airlines/` 內**現有的 24 張航空公司 PNG 圖片**。**我尚未核實公開再分發這些圖片所需的許可。** 保留圖片是我自己的發布決定，不代表已取得授權；非商業用途及本免責聲明亦不會自動授予相關許可。

**來源更正（v0.2.0c）：** 根據我自己的圖片下載紀錄，**24 張 PNG 當中有 23 張來自 Seeklogo，只有 9G（Sun PhuQuoc Airways）來自 CDNLogo**。這亦包括 LH（Lufthansa）的圖片；舊版 README 誤將 LH 標示為 PlusPNG。部分圖片的確切下載頁網址尚未逐一提供或核實。下載網站不一定是商標或著作權的持有人，註明下載來源亦不代表我取得了再分發許可。

我已為全部 24 張原始 PNG 啟用本機圖片顯示對應，同時保留獨立的法律授權紀錄。缺少、停用、無效或載入失敗的圖片會改用代碼／名稱顯示；**我沒有將任何未核實的再分發許可標記為已批准。** Vite 會將 `public/` 內的圖片複製到 Build，即使元件沒有顯示，也可以直接存取；因此 Build 仍會包含這些圖片。應用程式執行時不會向原下載網站發出請求。

詳見 [圖片資產審核](docs/AIRLINE_ASSET_AUDIT.md) 及 [校驗碼清單](docs/AIRLINE_ASSET_INVENTORY.json)。CX、LD（華民航空）與 HX（香港航空）是三間不同航空公司。**我指定的 24 間航空公司預設目錄，只是我為這個項目選定的清單，並非已核實或完整的香港國際機場／HAS 停機坪或 TCO 客戶名單。** 原有歷史參考紀錄另行保留；我並未核實各航空公司的地勤服務關係。

## 原始碼與使用條款

我將這個 Repository 作為公開的個人作品集，供教育性閱讀及示範用途。我會自行管理其 GitHub 可見性。

**我目前並未就自己編寫的 TCO Logbook 原始碼授予任何開源軟件許可。**

除適用法律或 GitHub 服務條款另有規定外，我保留自己原創程式碼的一切權利。Repository 公開可見本身不代表授予廣泛的使用、修改、再分發或商業再授權權利。GitHub 平台條款下適用的查看及 Fork 權限不受影響。

第三方套件、商標、標誌及其他資產仍受各自許可及權利約束；**我不會因為作出本聲明而重新授權這些內容。** 詳見 [第三方聲明](THIRD_PARTY_NOTICES.md)。我亦沒有加入獨立的 `LICENSE` 檔案。

## 開發路線圖

**我的未來開發計劃，須另行決定及批准：** 公司政策、供應商／成本、真實身份驗證、持久後端儲存、離線同步與衝突處理、公開航機資料查詢、經驗證的匯入／還原、加密備份，以及正式版／iPhone PWA 驗收。這些是已批准 PRD 所描述的未來階段，並非已交付的 v0.2.0 功能。

我暫時將 v0.2.0 維持為本機前端預發佈版；OCR／Excel 更表匯入、人力資源系統整合、雲端服務及正式生產功能均繼續延後。

## 語言版本效力

本 README 同時提供英文及繁體中文（香港）版本，以方便不同語言的讀者閱讀及參考。兩個版本旨在傳達相同內容。**如兩個版本之間出現任何差異、歧義或不一致之處，概以英文版本為準。**
