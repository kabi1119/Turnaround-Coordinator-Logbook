# TCO Logbook

**A personal aviation logbook and career development companion.**

[Open the live application](https://app.tcologbook.workers.dev/) · [English](#english) · [繁體中文（香港）](#繁體中文香港)

## English

### Live Application

**[app.tcologbook.workers.dev](https://app.tcologbook.workers.dev/)** — v0.9.3a Pre-release. Available as a browser application and installable PWA; Account access is invitation-only.

### About the Project

I develop TCO Logbook as an independent, non-commercial personal project for learning, my portfolio and my interest in aviation. It helps me organize handling assignments, review experience and reflect on professional growth. It is a personal logbook, not an official aviation operational or safety-critical system.

### Key Features

- **Aircraft Handling Records:** arrival-only, departure-only and full-turnaround records, incomplete Drafts and reviewed confirmation.
- **Duty management:** shift calendar, scheduled/worked duties and linked handling records.
- **Home dashboard:** upcoming shift, handling insights, unfinished records and up to four recent aircraft within today and the preceding six Hong Kong calendar days. Older records remain in the Logbook.
- **Statistics and Career Journal:** review recorded experience and keep personal reflections.
- **Guest and Cloud Account workspaces:** local Guest use or authenticated cross-device synchronization, with reviewed migration.
- **Recovery:** independent Full Local JSON Backup and validated, explicitly confirmed Restore; privacy-reviewed report exports are separate from full backups.
- **English and Traditional Chinese:** responsive interface with offline/PWA support, subject to the limitations below.
- **Aviation references:** local airline references/logos and a decorative radar illustration. The radar is **not live aircraft tracking**.

### Guest Mode vs Cloud Account

|                      | Guest Mode               | Cloud Account                                                       |
| -------------------- | ------------------------ | ------------------------------------------------------------------- |
| Sign-in              | Not required             | Invitation-only Supabase authentication                             |
| Storage              | This browser/device only | Server-readable cloud records and a plaintext offline cache         |
| Synchronization      | None                     | Automatic synchronization with acknowledged server updates          |
| Moving existing data | Stays local              | Guest import and Legacy Vault conversion require consent and review |

Signing in never automatically uploads Guest records. Pending edits, conflicts and migration recovery require the appropriate safeguards; network connectivity alone does not mean records are synchronized.

### Data Storage, Privacy & Backup

**Cloud Account storage is server-readable and is NOT end-to-end encrypted. Its offline cache is plaintext.** Legacy encrypted Vaults remain separately recoverable; decrypting and converting them requires the original passphrase, informed security-model consent and review. Their original ciphertext and recovery protections are retained.

Automatic Cloud Sync supports everyday cross-device use; it does **not** replace independent backups. Full Local Backup downloads an **unencrypted JSON file that may contain sensitive and privacy-hidden information**. Keep it private and secure. Import / Restore validates the file and requires review and explicit confirmation, including additional safeguards for synchronized Accounts. A privacy-reviewed JSON/CSV/PDF report is not a complete restorable backup. A separate Encrypted Cloud Backup service is no longer planned.

Guest data and Account caches depend on browser storage. Changing devices or origins, clearing site data, or removing an installed PWA may affect local data. Keep a verified independent backup before destructive browser changes. Offline access depends on an available application shell, supported storage and an existing local workspace; it is not guaranteed on every device or launch. Reconnect to complete pending synchronization and check its actual status.

I am responsible for deciding what information I may store remotely. Encryption, a disclaimer or a personal account does not grant permission to upload confidential employer information. Do not enter or publish passenger details, confidential employer information, internal documents or proprietary procedures.

See [JSON backup and restore](docs/JSON_BACKUP_RESTORE.md), [Cloud Account architecture](docs/V0_9_0_ARCHITECTURE.md) and [rollout/recovery guidance](docs/V0_9_0_ROLLOUT.md).

### Technology Stack

React, TypeScript and Vite; Cloudflare Workers Static Assets hosting; Supabase Authentication and PostgreSQL for Cloud Accounts; browser-local storage and a service worker for supported offline use. Vitest and Testing Library provide automated regression checks.

For development and hosting instructions, see [deployment documentation](docs/CLOUDFLARE_DEPLOYMENT.md). The normal local checks are `npm run check:release`; Production builds validate the configured project and public-key fingerprint. Credentials belong in local ignored configuration or hosting build settings, never source code.

### Project Status & Limitations

This is a deployed **v0.9.3a pre-release**, not an official operational service. I continue to evaluate physical-device behavior, recovery and near-capacity scenarios; automated/browser tests do not prove every iPhone or hosted-service condition. Independent backups remain essential. Passkey Authentication and Live Public Aircraft Lookup remain planned and unavailable. No official operational, safety, employer-policy compliance or uninterrupted-availability guarantee is made.

### Independent Project Disclaimer

TCO Logbook is **not affiliated with, sponsored by, endorsed by, authorized by or officially associated with HAS by Cathay (Hong Kong Airport Services Limited), Cathay Pacific Airways, Hong Kong Express (HK Express), Air Hong Kong, Airport Authority Hong Kong, or any other airline, airport operator, ground handling company or aviation organization**.

Airline names, identifiers, facilities, aircraft types and terminology are used for identification, reference, demonstration or education. Any sample records I publish are fictional, not an official HAS or airline operational database. I do not intend to publish confidential employer information, real passenger information, internal company documents or proprietary operational records.

**This personal portfolio/logbook must not be used as an official operational, safety-critical or production aviation management system.** Non-commercial intent and disclaimers do not themselves grant permission to reproduce or redistribute third-party intellectual property.

### Airline Logos, Branding & Trademark Notice

The repository includes **24 airline PNG assets** under `public/assets/airlines/`. Airline names, trademarks, logos and other brand assets remain the property of their respective rights holders. Public display does not imply affiliation, authorization, endorsement, sponsorship or a commercial relationship.

**I have not verified permission to publicly redistribute these image assets.** Non-commercial intent and disclaimers do not themselves grant permission. Enabling local display does not establish legal redistribution rights. A downloaded image's source website is not necessarily its trademark or copyright owner, and source attribution does not establish permission.

According to my own sourcing records, **23 images were obtained from Seeklogo; the 9G / Sun PhuQuoc Airways image was obtained from CDNLogo**. The **Lufthansa / LH image is among those attributed to Seeklogo, not PlusPNG**. Individual download-page URLs have not all been provided or verified. These are sourcing records, not new licensing conclusions.

The airline catalogue is my product selection, **not a verified list of HAS or HKIA handling customers**. See the [asset audit](docs/AIRLINE_ASSET_AUDIT.md), [asset inventory](docs/AIRLINE_ASSET_INVENTORY.json) and [third-party notices](THIRD_PARTY_NOTICES.md).

### Source Code & Usage

I make this repository publicly visible as a personal portfolio for educational viewing and demonstration. It is **source-available, not open-source software**: I have not granted an open-source software licence.

Unless otherwise required by applicable law or the GitHub Terms of Service, I reserve all rights in my original project code. Public visibility does not itself grant broad reuse, modification, redistribution or commercial sublicensing rights. GitHub's applicable platform-level viewing and forking permissions remain unaffected. Third-party assets retain their separate rights and restrictions.

### Language Precedence

This README is provided in English and Traditional Chinese (Hong Kong) for accessibility and reference. Both versions are intended to convey the same information. **In the event of any discrepancy, ambiguity, or inconsistency between the two versions, the English version shall prevail.**

---

## 繁體中文（香港）

### 正式網站

**[app.tcologbook.workers.dev](https://app.tcologbook.workers.dev/)** — v0.9.3a 預發佈版。支援瀏覽器及安裝為 PWA；帳戶只限受邀人士使用。

### 關於這個項目

我獨立開發 TCO Logbook，作為非商業個人項目，用於學習、作品集及實踐對航空的興趣。它協助我整理航機處理任務、回顧經驗及反思職涯成長。這是個人 Logbook，並非官方航空操作或安全關鍵系統。

### 主要功能

- **航機處理紀錄：** 記錄只處理抵港、只處理離港及完整過站任務，支援未完整草稿及覆核後確認。
- **更次管理：** 更次日曆、預定／已工作更次，以及相關航機處理紀錄。
- **首頁概覽：** 即將開始的更次、處理統計、未完成紀錄，以及香港今天與之前六個曆日內最多四筆最近航機紀錄。較舊紀錄仍可在 Logbook 查閱。
- **統計與職涯日誌：** 回顧已記錄經驗及保存個人反思。
- **訪客與雲端帳戶工作區：** 本機訪客模式，或登入後跨裝置同步；資料轉移須經覆核。
- **復原：** 獨立完整本機 JSON 備份，以及經驗證及明確確認的還原；經私隱審核的報告匯出與完整備份分開。
- **英文及繁體中文：** 響應式介面及離線／PWA 支援，受下述限制約束。
- **航空參考：** 本機航空公司資料／標誌及裝飾雷達圖像。雷達**並非即時航機追蹤**。

### 訪客模式與雲端帳戶

|              | 訪客模式           | 雲端帳戶                               |
| ------------ | ------------------ | -------------------------------------- |
| 登入         | 不需要             | 受邀人士透過 Supabase 驗證             |
| 儲存         | 僅限此瀏覽器／裝置 | 伺服器可讀的雲端紀錄及明文本機離線快取 |
| 同步         | 不提供             | 自動同步，須取得伺服器更新確認         |
| 轉移既有資料 | 保持本機           | 訪客匯入及舊版資料庫轉換須同意及覆核   |

登入不會自動上傳訪客紀錄。待同步修改、衝突及轉移復原均保留相應保護；連上網絡不代表紀錄已同步。

### 資料儲存、私隱與備份

**雲端帳戶資料為伺服器可讀，並非端對端加密（NOT E2EE）；本機離線快取為明文。** 舊版加密資料庫仍可獨立復原；解密及轉換須使用原有密語、知情同意新的安全模式並覆核。原有密文及復原保護保持不變。

自動雲端同步處理日常跨裝置使用，**不能取代獨立備份**。完整本機備份會下載**未加密的 JSON 檔案，可能包含敏感及私隱隱藏欄位資料**，請妥善保密保存。匯入／還原須驗證檔案、覆核及明確確認，同步帳戶另有保護。經私隱審核的 JSON／CSV／PDF 報告並非完整可還原備份。不再計劃獨立的加密雲端備份服務。

訪客資料及帳戶快取依賴瀏覽器儲存。轉換裝置或網站來源、清除網站資料，或移除已安裝 PWA，可能影響本機資料；進行破壞性瀏覽器操作前，請保留已驗證的獨立備份。離線使用取決於可用的應用程式外殼、受支援儲存及既有本機工作區，不能保證每部裝置或每次啟動都可離線使用。重新連線後請完成待同步修改，並核對實際狀態。

我須自行判斷哪些資料獲准儲存於遠端。加密、免責聲明或個人帳戶不代表獲准上傳僱主機密資料。請勿輸入或公開乘客資料、僱主機密、內部文件或專有程序。

參閱 [JSON 備份與還原](docs/JSON_BACKUP_RESTORE.md)、[雲端帳戶架構](docs/V0_9_0_ARCHITECTURE.md)及[推出／復原指引](docs/V0_9_0_ROLLOUT.md)。

### 技術組合

React、TypeScript 及 Vite；以 Cloudflare Workers Static Assets 寄存；雲端帳戶使用 Supabase Authentication 及 PostgreSQL；瀏覽器本機儲存與 Service Worker 支援適用的離線使用。Vitest 及 Testing Library 提供自動回歸檢查。

開發及寄存步驟見[部署文件](docs/CLOUDFLARE_DEPLOYMENT.md)。一般本機檢查為 `npm run check:release`；正式建置會驗證項目設定及公開金鑰指紋。憑證須放在被 Git 忽略的本機設定或寄存建置設定中，不得放入原始碼。

### 項目狀態與限制

這是已部署的 **v0.9.3a 預發佈版**，並非官方操作服務。我仍會評估實體裝置、復原及接近容量上限的情況；自動／瀏覽器測試不能證明所有 iPhone 或寄存服務情況。獨立備份仍然重要。通行密鑰身份驗證及即時公開航機查詢仍在規劃中，尚未提供。不保證官方操作、安全、僱主政策合規或持續可用性。

### 獨立項目免責聲明

TCO Logbook **與 HAS by Cathay（Hong Kong Airport Services Limited）、Cathay Pacific Airways（國泰航空）、Hong Kong Express（香港快運）、Air Hong Kong（香港華民航空）、Airport Authority Hong Kong（香港機場管理局），或任何其他航空公司、機場營運商、地勤公司或航空機構，均無隸屬、贊助、認可、授權或官方關聯**。

航空公司名稱、識別碼、設施、機型及術語僅作識別、參考、示範或教育用途。我公開的示範紀錄均屬虛構，並非 HAS 或航空公司的官方操作資料庫。我無意公開僱主機密、真實乘客資料、公司內部文件或專有操作紀錄。

**這個個人作品集／Logbook 不得用作官方操作、安全關鍵或正式航空管理系統。** 非商業意圖及免責聲明本身並不授予複製或再分發第三方知識產權的許可。

### 航空公司標誌、品牌及商標聲明

Repository 在 `public/assets/airlines/` 包含 **24 張航空公司 PNG 圖片**。航空公司名稱、商標、標誌及其他品牌資產仍屬各自權利持有人所有。公開展示不代表隸屬、授權、認可、贊助或商業關係。

**我尚未核實公開再分發這些圖片的許可。** 非商業意圖及免責聲明本身不構成許可；啟用本機展示亦不代表取得合法再分發權。圖片下載網站不一定是商標或著作權持有人，註明來源亦不代表取得許可。

根據我自己的來源紀錄，**23 張圖片來自 Seeklogo；9G／Sun PhuQuoc Airways 圖片來自 CDNLogo**。**Lufthansa／LH 圖片亦屬 Seeklogo 來源，並非 PlusPNG**。個別下載頁網址尚未全部提供或核實；以上僅為來源紀錄，並非新的授權結論。

航空公司目錄是我的產品選擇，**並非經核實的 HAS 或 HKIA 地勤客戶名單**。參閱[圖片審核](docs/AIRLINE_ASSET_AUDIT.md)、[圖片清單](docs/AIRLINE_ASSET_INVENTORY.json)及[第三方聲明](THIRD_PARTY_NOTICES.md)。

### 原始碼與使用權

我公開此 Repository 作為個人作品集，供教育性閱讀及示範。這是 **source-available（原始碼可供查看），並非開源軟件**；我未授予開源軟件授權。

除適用法律或 GitHub 服務條款另有規定外，我保留原創程式碼的一切權利。公開可見本身不代表授予廣泛的重用、修改、再分發或商業再授權權利。GitHub 平台條款下適用的查看及 Fork 權限不受影響；第三方資產仍有各自權利及限制。

### 語言版本效力

本 README 同時提供英文及繁體中文（香港）版本，以方便不同語言的讀者閱讀及參考。兩個版本旨在傳達相同內容。**如兩個版本之間出現任何差異、歧義或不一致之處，概以英文版本為準。**
