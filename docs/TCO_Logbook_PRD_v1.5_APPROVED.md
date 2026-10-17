# TCO Logbook

**Product Requirements Document (PRD) · v1.5 Approved Baseline**  
**狀態：已獲使用者批准（APPROVED · 2026-10-17）**  
**日期：2026-10-17**  
**用途：供 TCO Logbook Prototype v0.1 開發參考的已批准產品需求文件；非程式碼**


**v1.3 更新摘要 [CONFIRMED]**：使用者明確選擇 15分鐘分類門檻：Early 早超過15分鐘、On Time 早15分鐘以內至遲少於15分鐘、Delayed 遲15分鐘或以上；Arrival / Departure 保持獨立狀態欄位。v1.5 已於 2026-10-17 獲使用者整體批准；此為歷史版本更新摘要。

**v1.4 更新摘要**：保持使用者已確認之 `Early / On Time / Delayed` 15分鐘門檻不變；補充 Arrival/Departure 的 **Gate/Stand Time (AIBT/AOBT)** 與 **Chocks On/Off** 的嚴謹區分。Gate/Stand 用作準點判斷基準；Chocks 時間如日後需要，必須以不同欄位、明確來源保存，絕不無條件視為相同時間。本段屬對已確認分類嘅技術規格澄清，無強制新增時間輸入欄位。v1.5 其後已於 2026-10-17 獲使用者整體批准。

**v1.5 更新摘要 [CONFIRMED]**：新增 **Handling Type 獨立計數與職涯量化匯出**：每條已確認 Aircraft Handling Assignment 按 `Full Turnaround`、`Departure`（Departure-only）、`Arrival`（Arrival-only）歸入互斥分類，各計1次。三者均納入航空迷 Logged／Rankings／Timeline；Handled 排除 Training/Observation；CV／PDF Career Report 須分開呈列三個 Handling Type 嘅實際協調數字，唔將一條 Full Turnaround 拆成兩次 Handling Assignment。仍保持 Arrival／Departure Flight Status 可以按各自 Leg 統計。v1.5 其後已於 2026-10-17 獲使用者整體批准。

> **Approved baseline note (2026-10-17):** 使用者已明確批准 PRD v1.5，並要求開始 **Interactive Prototype v0.1**。本文件內保留咗部分歷史 `[REVIEW]`、待批 checklist 或產品敘述，用作追溯各版本來源；只要唔同已確定要求抵觸，15.2 四項一致性護欄可按批准基線實作。`[TECH TBD]`（供應商、收費、正式 Passkey／雲端／外部 API／官方 stand catalog 授權）**仍未批准實施**。Prototype 開發範圍以同資料夾嘅 `Codex_Prototype_v0.1_Prompt.md` 為準，不能將本 PRD 的未來 Production 要求誤當作 v0.1 要立即建成。

> **產品願景**：一個 iPhone + Windows 都容易使用嘅私人 Aircraft Handling Logbook，記錄 HAS TCO 每次 Handling Assignment、分析個人航空數據，並以獨立 Career Journal 累積可供日後整理嘅職涯經驗。日常新增一條記錄以約 15–30 秒作為 UX 目標，而唔係硬性效能保證。

## 0. 閱讀指南及需求狀態

- **[CONFIRMED] 已確認**：使用者過往選定，除非再次提出修改，視為產品方向。
- **[REVIEW] 待審核細則**：由一致性檢查衍生，尚待使用者批准；Codex 不應自行假設。
- **[TECH TBD] 待技術評估**：供應商、成本、API 授權、部分 iOS PWA 行為等，必須比較方案再作決定。
- **[POLICY GATE] 公司政策前提**：不得假設 HAS 容許私人保存、上傳或向第三方輸出工作相關資料。開發原型只使用虛構資料。

此份文件係各輪討論嘅**已批准 v1.5 基線**；Prototype v0.1 由另外的 Codex 專用 Prompt 定義實作範圍。本文例子全部屬模擬資料，唔代表任何實際工作紀錄、航班執行資料或使用者已開始相關工作。

## 1. 產品定位與邊界

### 1.1 目標 [CONFIRMED]

1. **航空紀錄**：記錄每次本人參與嘅 HAS Turnaround Coordinator (TCO) Aircraft Handling Assignment，包括航空公司、航機型號、可選 Registration／Flight Number、Arrival / Departure Flight Status、Handling Type 及本人 Role。
2. **個人統計**：支援 Duty Shifts、Aircraft Assignments、Primary／Supporting／Training 分類、Airline／Aircraft Type／Registration 排名、年度及月份趨勢，以及獨立 Disruption 指標。
3. **職涯紀錄**：透過 Career Journal 記錄 Situation、Challenge、Responsibility、Actions、Result、Learning、Competency Tags 及可選成果／核實狀態。
4. **長期保存**：雲端同步、離線快速新增、版本歷史、每日備份、匯出與還原，以便跨年持續使用。
5. **獨立個人 App**：單人私人使用，iPhone 與 Windows；介面易於快速輸入及日後翻查。

### 1.2 產品範圍 [CONFIRMED]

- **Aircraft Handling Logbook 僅記錄 HAS TCO**，不設跨僱主 Aircraft Handling Tracking。
- **獨立 Career Journal** 可以記錄其他工作／職涯經驗；此等紀錄不得混入 HAS TCO Aircraft Handling Statistics。
- 不建構公開社交社群、公司內部管理平台、航班營運控制系統、航班追蹤服務或實際航空公司系統整合。
- **不內建 AI CV／Interview Writer**；由使用者將經過審核嘅 PDF／JSON 等資料自行提供畀外部 AI。
- 不自動分享、公開發佈或接駁公司內部資料系統。

### 1.3 私隱與政策 [POLICY GATE]

工作中取得嘅 Flight Number、Registration、Parking Bay、實際及表定 Gate Times、航班狀態、特定 Duty 日期／組合、Disruption、營運過程及成果，是否可儲存在私人雲端，須按 HAS 政策及適用要求決定。**公開可以查到 Registration，並不等於個人工作接觸紀錄可私人雲端保存。** 不得儲存乘客／同事個資、未公開調查報告、內部訊息、機密程序、公司系統截圖或其他未獲授權內容。正式用真實資料之前須完成政策確認。

## 2. 使用平台、導覽及 UI 設計

### 2.1 Platform [CONFIRMED]

- Responsive **Progressive Web App (PWA)**，優先設計 iPhone Safari／加入主畫面後嘅體驗，同時完整支援 Windows 桌面瀏覽器。
- 五個底部分頁：**Home｜Logbook｜Add（中央主要按鈕）｜Statistics｜Journal**。
- Settings 經 Home／Account 入口進入，**唔係第五個分頁**。
- Premium Aviation Design：現代航空營運 Dashboard + 傳統 Logbook 元素；簡潔、白色與深藍綠等高級航空感設計；可參考 Cathay UX 審美，**不得直接複製品牌介面及商標**。
- **System Light / Dark Theme**；**English / 繁體中文** 即時切換；航空標準術語、Registration 及 ICAO Code 保持標準寫法。

### 2.2 App Icon 與 Airline Logos [CONFIRMED · 最新修改]

- TCO Logbook **自家 App Icon 使用簡單飛機圖示**，不要抽象仿航空公司標誌。
- Aircraft Card 中如顯示 Airline Logo，**只使用已核實來源、真實官方品牌素材，並檢查授權及使用條件**；禁止以生成式 AI 憑印象製作或變造官方 Logo。
- 缺乏可用／可授權嘅品牌素材時，**只顯示 Airline Name 或 IATA Code**，唔用「貌似官方」嘅假 Logo。
- 該規則同時適用 Home、Logbook、Search Result、Aircraft Detail 及日後任何匯出模板。

### 2.3 Home Screen 資訊排序 [CONFIRMED]

1. App 名稱、簡單飛機 Icon、當日日期／帳戶或 Settings 入口。
2. **三個核心統計：Total Aircraft Logged、Total Aircraft Handled、Primary Coordinator**（唔以 Duty Hours 取代）。
3. Current / Most Recent Duty：Duty Date、可選 Shift Times、Record 數量／狀態。
4. Recent Aircraft Records：優先顯示新近已記錄 Assignments，點按可進入 Aircraft Detail。
5. 快捷新增 Aircraft / Duty / Journal；可顯示簡單趨勢／最近 Journal 捷徑，避免首頁過度擁擠。
6. 五個已確認底部分頁；中央 Add 較突出。

### 2.4 Aircraft Record Card 顯示規則 [CONFIRMED · 最新修改]

**第一行：大字、突出** → `Cathay Pacific CX450`  
**第二行：細字、次要資訊** → `Primary Coordinator · A350-1000 (B-LXI)`

- 第一行以 **Airline Name + Flight Number** 為主，不再以 `Cathay Pacific A350-1000` 作為大標題。
- 第二行顯示 **My Role + Aircraft Variant +（可選 Registration）**。
- 若 Flight Number 未提供／功能停用，第一行只顯示 `Cathay Pacific`。
- 若 Registration 未提供／功能停用，第二行顯示 `Primary Coordinator · A350-1000`，不可出現空括號。
- Full Turnaround 如有兩個獲准保存嘅 Flight Numbers，可採 `Cathay Pacific CX450 / CX451` 顯示方式 **[REVIEW：雙航班顯示屬已討論建議，仍須以實際欄位設計落實]**；不影響「一個 Assignment 計一次」。
- Home／Duty Detail／Timeline／Calendar 展開清單／Search Results 的 Card 規格一致；大字過長時需優雅換行／截斷，細節仍可完整查看。
- **Flight Number、Registration、Parking Bay 均選填，且受欄位私隱開關限制。**

## 3. 資料模型與關聯

### 3.1 Duty Log [CONFIRMED]

| 欄位 | 規則／備註 |
|---|---|
| Duty ID | 系統唯一識別碼，不要求使用者手動輸入 |
| Duty Date | 必填；以所屬 Shift Start Date／香港時間理解 |
| Shift Start / End | 選填；可跨午夜 |
| Duty Status | Draft 或 Confirmed |
| Duty Notes | 選填，按資料政策限制內容 |
| Associated Aircraft | 一個 Duty 可有零至多條 Handling Records |

- **同一日期可有多個 Duty Logs**；Duty Shifts 以實際已確認 Duty 數量計，唔等同「有紀錄日期」數。
- 夜更跨午夜時，整個 Duty 放在 Shift Start Date；時間顯示採 **Asia/Hong_Kong**，避免旅行／時區轉換改變日期。
- 若開始時間未知，日期由使用者確認；不能假設系統本機日期必然等同實際工作日期。

### 3.2 Aircraft Handling Record [CONFIRMED]

| 欄位 | 必填？ | 規則／備註 |
|---|---|---|
| Record ID | 系統 | 唯一 ID；防止同步重試造成重複 |
| Handling Date | 是 | 預設香港當日，可修改；不可只依靠 created_at 統計 |
| Airline | 是 | 搜尋式標準化選單，可擴充 |
| Aircraft Type / Variant | 是 | 優先指定具體 Variant，可衍生 Family／ICAO Code |
| Handling Type | 是 | Arrival / Departure / Full Turnaround（3個互斥 Assignment Types；UI 可寫 Arrival Only / Departure Only） |
| My Role | 是 | Primary Coordinator / Supporting Coordinator / Training & Observation |
| Status | 系統／用戶 | Draft、Confirmed、Trashed；Sync Status 獨立 |
| Duty Link | 系統／用戶 | 一般連結一個 Duty；刪除上層時可 Unlinked |
| Registration | 否 | 獨立私隱開關，可被禁用；用於 Unique Aircraft |
| Flight Number(s) | 否 | 獨立私隱開關；Full Turnaround 可支援 Arrival／Departure 兩個可選值 [REVIEW] |
| Parking Bay / Aircraft Stand | 否 | HKIA 可搜尋建議清單 + 自由輸入；保留字母前綴／後綴及當次填寫值；受欄位私隱開關限制 |
| Arrival Flight Status | 否 | Arrival / Full Turnaround 可選；Early / On Time / Delayed / Cancelled / Other / Not Recorded；預設 Not Recorded |
| Departure Flight Status | 否 | Departure / Full Turnaround 可選；同上，與 Arrival Status 各自獨立保存 |
| Scheduled / Actual Gate/Stand Times | 否 | 有明確時間來源及政策許可先可選填；Arrival 應用 SIBT/STA 與 AIBT，Departure 應用 SOBT/STD 與 AOBT；Chocks On/Off 不得自動視作 Gate Time；缺少時間可手動選 Status |
| Disruption Status | 否 | Normal / Disrupted / Unknown，不應把未填當 Normal |
| Notes | 否 | 不儲存未獲授權嘅內部營運資訊 |
| Timestamps / Revision | 系統 | created_at、updated_at、版本／編輯歷史 |

- **一個真實 Aircraft Handling Assignment = 一條 Record**。Full Turnaround 不會自動拆成 Arrival + Departure 兩條。
- **Handling Type 單一歸類 [CONFIRMED v1.5]**：`Full Turnaround`、`Departure` (Departure-only)、`Arrival` (Arrival-only) 每條正式 Record **只屬其中一種**，亦只貢獻 **1 個 Assignment**。Full Turnaround 同時包含入港／離港工作範圍，但 **唔會額外產生 Departure-only 或 Arrival-only Assignment**；同一天真正獨立執行嘅多個 Assignment 仍可分開記錄。
- 同一 Registration 不同時間可以係不同 Assignment。避免用 Registration 作唯一主鍵。
- 必要資料不足時可儲存 Draft，**Draft 不進入正式工作量／排行榜**。
- Confirmed Record 即使所屬 Duty 仍係 Draft，**Aircraft 指標仍計入**；Duty Shifts 指標則只計 Confirmed Duty。
- Record 可能喺刪除 Duty 後暫時 Unlinked；不得因此丟失 Aircraft Record。[REVIEW：同意刪除保留，但 Unlinked 提醒 UI 與詳細行為待最後確認]

### 3.2A Flight Status — Arrival / Departure [CONFIRMED: TWO SEPARATE FIELDS · NEW]

- **Flight Status 與 Disruption Status 分開。** Flight Status 描述航班到達／離開停機位相對時間表之表現；Disruption Status 則描述 Handling Assignment 是否有營運異常事件。準點航班亦可遇到 disruption，延誤亦不代表本人實際參與處理過事件。
- `Handling Type = Arrival`：只顯示 **Arrival Status**。`Handling Type = Departure`：只顯示 **Departure Status**。`Handling Type = Full Turnaround`：**Arrival Status + Departure Status 分別記錄**，可出現 `Delayed Arrival + On Time Departure`；仍然只係一條 Handling Assignment。
- 每個適用 Flight Status 下拉選單包含 **Early / On Time / Delayed / Cancelled / Other / Not Recorded**。全部選填，預設 **Not Recorded**；不得自動當作 On Time。Other 可提供選填、政策允許嘅簡短說明。
- Arrival／Departure 可選 Flight Number (如獲准保存) 係對應 status 的識別資訊；不要求必填。Full Turnaround 同一條記錄可以有兩個 Flight Numbers，Card 可顯示 `CX450 / CX451` [REVIEW: Card 排列／詳細 Flight No. 欄位待最後核對]。

**準點門檻 [CONFIRMED：15 分鐘個人分類口徑]**

- 常見業界 **OTP-15** 以停機位／登機閘的 Gate Times 對比表定時間。參考 OAG：遲 **少於 15 分鐘**屬 On Time；遲 **15 分鐘或以上**屬 Delayed。這是常見統計口徑，**並非 HAS 或航空公司官方績效**。
- 使用者已確認個人 Logbook 採用以下分類：`Early` = 比表定時間早**超過15分鐘**；`On Time` = 早15分鐘以內，或晚少於15分鐘；`Delayed` = 晚15分鐘或以上。**Early 嘅提前超過15分鐘門檻係本產品自訂分類，唔係行業統一規定。**
- **精確判斷方式**：設 `Δt = Actual Gate/Stand Time − Scheduled Gate/Stand Time`，以分鐘／秒精度比較：`Δt < −15分鐘` → **Early**；`−15分鐘 ≤ Δt < +15分鐘` → **On Time**；`Δt ≥ +15分鐘` → **Delayed**。不可先四捨五入再分類，避免邊界誤判。
- **邊界示例**：表定10:00，實際09:40→Early；**09:45→On Time**（剛好早15分鐘）；09:55→On Time；10:10→On Time；**10:14:59→On Time**；**10:15:00→Delayed**。如果來源只有整分鐘精度，09:44→Early、09:45→On Time、10:14→On Time、10:15→Delayed。
- Arrival: 應比較 `Scheduled Gate / Stand Arrival` 與 `Actual Gate / Stand Arrival`；Departure: 比較 `Scheduled Gate / Stand Departure` 與 `Actual Gate / Stand Departure`。**不可把 Landing Time／Take-off Time 直接當 Gate Time**。
- 以上 scheduled / actual fields 都唔強制新增，更不可假設可保存公司內部數據；若只手動揀 Flight Status，須視為 **Self-reported**，不得聲稱為時間自動驗證結果。當日後獲准提供具體時間，先可考慮衍生自動狀態並容許確認；若資料矛盾應警告，不靜默覆寫。
- `Cancelled` 必須與 `Delayed` 分開。假如取消航班前完全**冇實際 Aircraft Handling Assignment**，不應為了計數而建立 Confirmed Handling Record；如確實執行過相關職務則按實際 Role／Assignment 記錄。Other / Not Recorded 不能假設準時。
- **15分鐘分類門檻已確認，但未批准將個人手動 Status 換算成官方 OTP Rate。** 若將來顯示個人準點比例，須顯示統計分母及 missing/cancelled 資料處理規則，唔可直接命名為官方 OTP。

**非內部官方口徑之背景來源（查閱 2026-10-17）：**
- OAG, *Defining Late: On-Time Performance in the Aviation Industry*: https://www.oag.com/blog/defining-late-on-time-performance-in-the-aviation-industry
- OAG, *Airline On-Time Performance — Defining Late*: https://www.oag.com/airline-on-time-performance-defining-late
- Cirium, *On-Time Performance FAQ*: https://www.cirium.com/resources/on-time-performance/on-time-performance-faq/

### 3.2B Gate / Stand Time vs Chocks On / Off [CLARIFIED · NO NEW MANDATORY FIELDS]

**建議作本 Logbook 唯一 Flight Status 自動分類之時間基準：Gate / Stand (Block) Times。** 目前只確認 status 與 15分鐘門檻；Scheduled／Actual Time 全屬選填並受公司政策限制。不可為咗計算準點率強迫使用者記錄營運時間。

| 名稱 | 航空營運時間點 | 本產品處理 |
|---|---|---|
| Scheduled In-Block / Scheduled Gate Arrival (STA / SIBT，視乎資料來源之定義) | 預定航機到達停機位時間 | Arrival `Scheduled` 基準；需確認來源係 Gate／Stand 而非落地時間 |
| Actual In-Block Time (AIBT / Gate IN) | 實際於抵達停機位完成停泊；EUROCONTROL 定義為 Parking Brakes 已啟用 | Arrival `Actual` 基準 |
| Chocks On | 地勤將輪擋放妥嘅實際操作時間 | 可能與 AIBT 接近，但不可強制視為 AIBT；如有需要只可另設選填欄位 |
| Scheduled Off-Block / Scheduled Gate Departure (STD / SOBT，視乎資料來源之定義) | 預定離開停機位時間 | Departure `Scheduled` 基準；需確認非預計起飛時間 |
| Chocks Off | 地勤移除輪擋嘅實際操作時間 | 可早於 AOBT；不得用它代替實際離位時間 |
| Actual Off-Block Time (AOBT / Gate OUT) | 航機開始 Pushback 或自行離開 Parking Stand | Departure `Actual` 基準 |
| Actual Landing / Take-off (ALDT / ATOT) | 航機跑道著陸／起飛時間 | **唔用**作本 Logbook Gate OTP-15 自動分類 |

- **Arrival Status**：比較 `Actual In-Block (AIBT)` − `Scheduled In-Block (SIBT/STA)`；**Departure Status**：比較 `Actual Off-Block (AOBT)` − `Scheduled Off-Block (SOBT/STD)`。同一方向必須使用同一類 scheduled/actual time；若資料語義不一致，應停用自動分類並請使用者確認。
- **Chocks On ≠ 必然 AIBT；Chocks Off ≠ 必然 AOBT**：業務口語上可能互用「on/off-block」，但兩個實際事件及時間戳可以存在差距。若特定航空公司／地勤流程另有明確定義，應標明採用之來源及定義，不能假設所有供應商相同。
- **時間欄位建議為 Future Optional / More Details，而非四個核心 Quick Add 欄位**：可手動選擇 Arrival/Departure Flight Status；無可核實 Gate Times 時標記 `Self-reported`；有獲准保存且語義一致嘅數據時，先可提出自動分類建議，使用者最後確認。
- **時間與時區**：Duty Start/End 係工作更次時間、Record Created Time 係系統保存時間，均**唔係** Gate Time；若記錄實際時間，需保存日期及香港時區（Asia/Hong_Kong）以處理跨午夜，避免只存 `HH:MM` 導致錯配。
- **15分鐘邊界 [CONFIRMED，維持不變]**：`Δt < -15m` = Early；`-15m ≤ Δt < +15m` = On Time；`Δt ≥ +15m` = Delayed。Early 提前門檻係個人 Logbook 自訂，唔代表 HAS 官方標準。
- **取消航班** 不應嘗試以欠缺嘅 AIBT/AOBT 計算 Early/On Time/Delayed；保持 `Cancelled` 與 `Other`、`Not Recorded` 獨立。
- **政策限制**：表定及實際 Gate／Chocks 時間、Parking Bay、班機記錄等可能涉及受限制營運資訊。未經 HAS 政策確認，維持欄位關閉／只用模擬資料。亦唔應聲稱本 App 計出官方 OTP。

**公開參考資料（用於定義，不代表 HAS 自家規程）**：EUROCONTROL, *Specification for Airport Operator Data Flow*, §§5.9–5.14, https://www.eurocontrol.int/sites/default/files/content/documents/single-sky/specifications/EUROCONTROL%20Specification%20APDF%20Edition%201.0%20final%20web.pdf ；OAG, *On-Time Performance*, https://www.oag.com/blog/defining-late-on-time-performance-in-the-aviation-industry ；OAG, *Understanding Flight Status States*, https://knowledge.oag.com/docs/understanding-flight-status-states 。

### 3.3 Disruption Record [CONFIRMED，高層結構]

- 同一 Aircraft Handling Record 可有**多個** Disruption Events。
- 分類選擇：Weather、ATC Restrictions、Late Inbound、Aircraft Technical、Baggage / Loading、Passenger / Boarding、Ground Handling、Other Operational。
- 個人參與：Observed / Assisted / Coordinated / Escalated。
- 影響程度：Minor / Moderate / Major（主觀分類，**並非公司官方 Severity**）。
- 結果：Resolved / Escalated / Handed Over；避免將 Observer 當作主動解決問題。
- 內容須去識別化及遵守公司政策；可連結相關 Journal。
- **Disruption Events** = 事件總數；**Disrupted Assignments** = 至少有一個事件嘅不重複 Assignment 數，兩者絕不可互換。

### 3.4 Career Experience Journal [CONFIRMED]

- 可獨立新增，也可連結一個 Duty，或者**多條 Aircraft Records**；不得強制每個故事都要關聯航機。
- STAR-ish 欄位：Situation、Challenge、My Responsibility、My Actions、Result、Learning。
- Competency Tags：Problem-solving、Decision-making、Leadership、Communication、Organising、Safety Awareness、Stakeholder Coordination、Time Management、Customer Service、Continuous Improvement。
- 支援 Draft；可加成果數值、單位、個人貢獻、資料來源／核實狀態。核實狀態為個人紀錄標籤，不代表僱主背書。
- 其他職位經驗只進 Career Journal；唔計 HAS TCO Aircraft Handling Workload。
- 不設 AI Writer；日後透過經篩選匯出自行整理 CV／面試答案。

### 3.5 Aircraft Reference Data [CONFIRMED]

- 包含 Airline、Aircraft Family、Aircraft Variant、ICAO Aircraft Type Code，可有 Registration → Airline／Type 參考映射。
- **歷史 Aircraft Record 要保存當次確認嘅 Airline／Type 值**：航空公司變更、機隊資料更新，不可靜默覆蓋舊記錄。
- 正規化 Registration 用於搜尋及 Unique 計算；儲存與顯示應保留合適格式，避免錯把不同機身當成同一架。

### 3.6 HKIA Parking Bay / Aircraft Stand Reference [CONFIRMED FEATURE; TECH TBD CATALOG]

- 新增 Aircraft Record 選填欄位 **Parking Bay / Aircraft Stand**。使用者希望先從 HKIA 正式停機位編號選擇；如清單無該編號，必須可自行輸入，不可因查不到而阻止儲存。
- **已核實存在官方資料來源**：香港民航處 AIP VHHH AD 2.24 收錄 *Aircraft Parking/Docking Chart - ICAO*，圖號 **AD 2-VHHH-ADC-4**；VHHH AD 2.23 亦載有不同 apron 與 stand suffix 資料。來源：`https://www.ais.gov.hk/eaip_20261001/2026-10-01-000000/html/eAIP/VH-AD-2-VHHH-en-US.html`（查閱 2026-10-17，2026-10-01 有效版）。
- 官方文本可直接核對嘅**示例**包括 `S25`、`S25R`、`W121L`、`W123R`、`D301` 至 `D310`、`L421` 至 `L426` 等；**並非完整、已驗證的 2026 年停機位總表**。不得憑連續數字自行補齊未查證的 stand identifiers。
- **預期控件：Searchable Combobox**：搜尋式 dropdown + `Enter custom Parking Bay`，兼容完整字母前綴／後綴，大小寫自動正規化、保留有意義字元。避免單純數字化，如 `S25` ≠ `S25R`。
- 建議支援本機／離線使用已下載嘅合法參考清單；來源記錄 `source`、`effective_date`／`last_verified`，將來可人工更新而唔改寫歷史 Record。**靜態 catalog 唔代表即時 stand allocation、可用性或機型相容性判斷。**
- HKIA AIP 網站提醒下載副本不再受控，亦應參考 AIP SUP／NOTAM。**完整清單提取、正確性覆核、再使用條款及更新方法均 [TECH TBD]**，Codex 應先評估，再啟用正式清單。未能取得可靠完整資料時只提供手動輸入／最近使用值。
- Parking Bay 可能揭示個別航班／工作動線，作 **可關閉、預設限制嘅工作相關欄位**；是否能私人保存／雲端同步須按 HAS 政策確認；未獲准時不得從公司內部系統匯入資料。

## 4. 新增、編輯與 Duty 關聯流程

### 4.1 Quick Add [CONFIRMED]

- 單頁四個核心必填欄位：**Airline、Aircraft Type、Handling Type、My Role**；日期預設香港當日並可改。
- Registration、Flight Number、Parking Bay、Arrival / Departure Flight Status、Notes、Disruption 等放「More Details」可展開區；**由於 Flight Number 係 Card 第一行主資訊，應擺近 Airline，容易快速輸入，但保持選填**。
- 支援 `Save & Close`、`Save & Add Next`、`Save Draft`。
- Quick Add 自動預選唯一適合嘅 Duty；如果冇，就建立 Draft Duty。**如果同日有多個可能 Duty，應要求確認而非亂配** [REVIEW：一致性補充]。
- 從當日 Duty Detail 新增時，預選該 Duty；無須輸入 Record ID。
- Offline 亦可新增 Duty、Aircraft Record 及簡短 Notes。

### 4.1A Mandatory Review Before Save [CONFIRMED · NEW]

**每次提交完整 Aircraft Handling Record 前都必須顯示 Double-check / Confirm Entry 視窗**。`Save & Close` 和 `Save & Add Next` 均先顯示 Review Sheet，使用者明確確認後才寫入；`Save Draft` 亦顯示簡化預覽或同等確認，不能無提示直接儲存。

建議 iPhone 使用可捲動 Bottom Sheet／Modal，依序列出：

1. Handling Date、Duty Date／已選 Duty（若為自動 Draft Duty，明確標示）；
2. **Airline + Flight Number(s)**；
3. **Aircraft Type + Registration**；
4. **My Role + Handling Type**；
5. **Parking Bay**（如已填寫）；
6. **適用嘅 Arrival Status／Departure Status**（缺少時顯示 Not Recorded）、Disruption Status、Notes 摘要（只有已允許且有值時顯示）；
7. 完成度：`Confirmed` 或 `Draft`，以及是否 `Pending Sync`（如離線）。

操作：`Back to Edit`、`Confirm & Save`；若原本按 `Save & Add Next`，確認後返回已預選 Duty 嘅清空新增表單；若原本按 `Save & Close`，確認後返回來源頁。Cancel／關閉確認 Sheet 不得儲存。**任何未確認資料都不得直接轉為 Confirmed Record**。

系統儲存成功／離線本機保存後，再顯示準確狀態 `Synced` 或 `Saved Locally / Pending Sync`，不能預先宣稱已雲端同步。若欄位遭私隱政策停用，視窗不能洩漏封存資料。Prototype 必須實際模擬 Review → Edit → Confirm 路徑。

### 4.2 Duplicate Warning [CONFIRMED]

- 同 Duty、同 Registration／機型、Handling Type、Flight Number 等高度近似時**提示可能重複**，但**不得自動攔截**；使用者可保留真實不同 Assignment。
- 後端同步重試同匯入重試使用唯一 Record ID／冪等操作以防**技術重複**；唔等於阻止真實業務重複。

### 4.3 Editing / Deletion / Restore [CONFIRMED]

- 支援 Edit、修改歷史、30日垃圾桶、Restore；Trashed 不計統計。
- 刪除 Duty 後保留下層 Records、解除連結，並提示重新整理。
- 還原 Duty 前提供「原有關聯」預覽，使用者確認後才重新連結；若原紀錄已有新連結，不可強制覆蓋。
- 修改歷史嘅精確保留期**尚未決定**，唔應自行假設等於30日垃圾桶。

## 5. 統計及篩選定義

### 5.1 三大核心指標 [CONFIRMED]

- **Total Aircraft Logged = Primary + Supporting + Training / Observation**；只計 Confirmed、非 Trashed Assignments。
- **Total Aircraft Handled = Primary + Supporting**；唔計純 Training / Observation。
- **Primary Coordinator = Primary**；係前兩項嘅子集，**不可三項相加**。

**假設**：Primary 300、Supporting 100、Training 50 → Logged **450**、Handled **400**、Primary **300**（純示例）。

### 5.1A Handling Type Breakdown — 三種工作量獨立計數 [CONFIRMED v1.5]

- `Full Turnaround Count` = Confirmed、非 Trashed，且 Handling Type = Full Turnaround 嘅 **Assignment 數目**。
- `Departure-only Count` = Confirmed、非 Trashed，且 Handling Type = Departure 嘅 **Assignment 數目**；**唔包括** Full Turnaround 嘅 Departure Leg。
- `Arrival-only Count` = Confirmed、非 Trashed，且 Handling Type = Arrival 嘅 **Assignment 數目**；**唔包括** Full Turnaround 嘅 Arrival Leg。
- 三種互斥分類均應顯示 `Logged`（Primary + Supporting + Training）、`Handled`（Primary + Supporting）及可按需要顯示 `Primary Only`。其 `Handled` Breakdown 三項相加 = `Total Aircraft Handled`；其 `Logged` Breakdown 三項相加 = `Total Aircraft Logged`（在相同日期／Airline／Role 等 Filters 下）。
- **虛構例子**：Primary/Supporting 嘅 Full Turnaround 40、Departure-only 25、Arrival-only 15 ⇒ `Total Aircraft Handled = 80`，唔係 120；如再有 Training 10 條 ⇒ `Total Aircraft Logged = 90`。
- **航空迷統計全數包含**三種 Handling Types：Airline / Aircraft Type / Registration Frequency、Encounter History、Rankings、Year/Month Trend 同 Milestones；Training/Observation 可計入收藏／Logged，並以 Role Filter 同 Handled 指標明確區分。不得默默排除單獨 Arrivals 或 Departures。
- **注意 Flight Leg 指標不可與 Assignment 指標混淆**：如日後另外提供 `Arrival-side Encounters`，可用 `Full Turnaround + Arrival-only`；`Departure-side Encounters` 可用 `Full Turnaround + Departure-only`，但這兩個數字相加 **不得再當作 Total Aircraft Handled**，亦不可用 `flights` 字眼混稱唯一航班數。


### 5.2 其他統計 [CONFIRMED]

- Duty Shifts：Confirmed Duty Logs 數目；Draft Duty 不計 Duty Shifts。
- Unique Aircraft：有效 Registration 經標準化後不重複數目；無 Registration 不計該指標，但仍計 Logged／Handled。
- Airline／Aircraft Type／Family／Variant／Registration 排名、First Encounter／Last Encounter／Encounter Frequency、年／月趨勢及個人里程碑。
- Disruption Events 與 Disrupted Assignments 分開。
- Career Journal 統計與 TCO 工作量統計分開；Competency Tags、個人經驗、OJT／Coaching 只能按實際記錄及定義計算。
- 基於 **Handling Date／Duty Date** 統計，而唔係資料輸入時間；可按日期範圍、Airline、Type、Role、Handling Type、**Arrival Flight Status、Departure Flight Status**、Disruption Status 組合篩選。
- 新增 **Arrival Status / Departure Status 分開嘅 Category Counts**；只有該 Handling Type 包含嘅 Leg 先進入對應分類，Full Turnaround 兩個 Leg 可分別計入各自分類，但整個 Assignment 仍只計一條。**Not Recorded、Other、Cancelled 需獨立統計**；不可以據此宣稱航空公司或 HAS 官方準點率。
- **Handling Type Breakdown** 須作為 Statistics 內獨立視圖／圖表：Full Turnaround、Departure-only、Arrival-only（Logged、Handled、Primary 可切換／篩選）。Flight Status Leg 分類雖可將 Full Turnaround 分別納入 Arrival/Departure 狀態分布，並不構成 Departure-only / Arrival-only 工作紀錄。
- 有衝突時暫以最後確認嘅正式版本作穩定雲端統計，待解決後重新計算 [REVIEW：衝突展示細則]。

## 6. Timeline、Calendar、Search、Aircraft History

- **Logbook 預設 Timeline**：最新 Duty／Aircraft Records 優先，按 Duty Date 分組，展開查看細節。
- Calendar 可切換：有記錄日期可顯示標記；**冇記錄唔代表 Day Off**。
- 同日多個 Duty 應分別展示；跨午夜 Duty 依 Shift Start Date 分組，香港時區固定。
- Search 支援 Airline、Flight Number、Aircraft Type／Family、Registration、日期、Role、Handling Type、Arrival Status、Departure Status、Disruption、Competency 等有權限嘅欄位；可組合 Filters。
- Aircraft History 按 Registration 顯示 Encounter Timeline、總數／Handled／Primary、First／Last Seen；Registration 功能關閉時，該頁相關查詢也應關閉。
- **Aircraft Cards 全站一致使用 `Airline + Flight No.` 大字；`Role · Type (Registration)` 細字**。

## 7. Aircraft Lookup [CONFIRMED]

**流程：已保存個人 Aircraft History → 使用者手動按「Search Public Database」→ Manual Override。**

- 過往 Registration 符合時，優先自動建議歷史 Airline／Type。
- **不得在鍵入 Registration 時自動向第三方發送請求**；只有使用者主動按鍵、且相關功能獲允許時，才查公開資料庫。
- API 最小化只傳查詢必要資料（通常 Registration）；不得傳 Duty、Journal、Disruption 或個人工作時序。
- 外部服務查詢失敗、資料過時、未授權使用 Logo、Operator 轉變等情況，不能阻止手動儲存。
- 實際 Public API、License、更新頻率、費用及覆蓋範圍 [TECH TBD]。

## 8. Authentication、Passkey 與 Session

### 8.1 Login [CONFIRMED]

- 首次使用 Email OTP／Magic Link 進行 Passwordless 註冊／登入；用戶最新明確確定 **Email OTP + iPhone Passkey** 作主流程。
- 第一次完成 Email OTP 後，提供註冊 Passkey；iPhone 可透過 Face ID／裝置密碼認證。**App 本身不讀取或儲存 Face ID 生物特徵**。
- **30日 Persistent Login 為受信任 Session 設計目標**；未過期開 App 可直接進入，不要求每次 Face ID。
- Session 到期／手動登出時可用 Passkey 重新登入；Email OTP 保留作恢復途徑。若系統不支援 Passkey，須有安全後備登入。
- Windows 可透過其支援嘅 Passkey／跨裝置認證／Email OTP 登入。
- 可管理／撤銷登入 Session；保護伺服器權限、Session、HTTPS、資料庫安全。
- 使用者**不需要額外 App PIN／每次開啟 App Lock**；只依賴裝置本身鎖定。敏感操作可要求重新認證。
- Passkey、iPhone 已安裝 PWA／Safari Cookie 分隔、正式網域穩定性及 Auth Provider 相容性 [TECH TBD／實機驗收]。

## 9. Offline Quick Add & Cloud Sync

- **離線範圍係 Quick Add**：新增／暫存 Duty、Aircraft Records、簡短 Notes；唔要求完整離線搜尋、分析、Journal 編輯或所有歷史紀錄。
- 顯示獨立同步狀態：`Saved Locally`、`Pending Sync`、`Synced`、`Sync Failed`、`Conflict`，並提供 Last Synced／Retry。
- iOS PWA 可能無法喺完全關閉時可靠地進行背景同步；應喺恢復連線、App 回前景或重新開啟時重試。
- 本機暫存不是長期備份；Safari 網站資料清除、移除 PWA、裝置損壞都可能令未同步資料消失。同步前不可向使用者聲稱已備份。
- Session 過期時仍保存 Pending Records；身份重新驗證成功後再同步。登出、切換帳戶、清除快取前須提示本機未同步風險。
- **衝突政策**：盡可能合併不同欄位修改；同一欄位衝突則保留兩個版本，由使用者選擇。未解決衝突不可靜默覆寫。
- 用唯一 ID／冪等性保證同步重試唔會多生一條 Assignment。

## 10. 私隱控制與資料生命週期

- **安全預設 + 欄位級權限開關**：Registration、Flight Number、Parking Bay、可識別航班嘅時間及 Flight Status、Disruption Details 等按政策容許程度啟用；預設限制敏感資料。
- 停用欄位後，阻止新資料輸入、外部查詢（相關資料）、普通搜尋展示及對外匯出。
- 對既有資料提供數量／影響預覽，由使用者決定**封存或刪除**；封存唔等於刪除。正式資料刪除後，備份副本可能仍依保留期存在，必須清楚告知。
- 私隱開關**不代表公司批准**；不應設計成讓使用者迴避政策限制嘅機制。若某類資料不允許私人儲存，應禁止收集或協助清除。
- Cloud data region 優先亞洲／Singapore；第三方登入電郵、備份、觀測記錄等可能使用不同地區，須一併評估 [TECH TBD]。
- 不設 Public Profile／公開分享；資料隔離只准本帳戶存取。

## 11. Export、Import、Restore、Backup

### 11.1 Export [CONFIRMED]

| Export | 用途與原則 |
|---|---|
| CSV | 個人表格分析，按有權限資料選取欄位 |
| JSON Full Backup | 完整私人備份，含關聯 ID 與資料結構；需適當加密保護及安全處理 |
| JSON AI-friendly | **與 Full Backup 分開**；預設去識別化、排除敏感欄位，選擇日期／統計／Journal |
| PDF Career Report | 自選 Statistics、Competency Tags、獲准披露 Career Stories；預覽、遮蓋、確認後匯出 |

**Handling Type 分類的 Career Report [CONFIRMED v1.5]**：

- PDF Career Report 與經選擇／Privacy Preview 後嘅 JSON AI-friendly Export，提供 `Full Turnarounds Coordinated`、`Departure-only Assignments Coordinated`、`Arrival-only Assignments Coordinated` **三個分開欄位**，連同期間、Role Scope（Primary Only／Primary + Supporting）、Training 排除規則、統計來源和核實標記；可按選擇顯示 Logged 收藏版（含 Training），但不得作為 Coordinated CV 指標。
- CV 英文寫法只係**資料呈現示例而非內建 AI Writer**：`Coordinated 40 aircraft turnarounds, 25 departure flights, and 15 arrival flights.` 此句中的 departure flights / arrival flights 專指獨立 Departure-only / Arrival-only Assignments，不包括 Full Turnaround 嘅兩個環節。用戶可交畀外部 AI 改寫，但不可擅自把三類相加變成「120 handled aircraft」或「120 flights」。
- 如含 Supporting Role，措辭需要反映真實參與程度；可選 Primary Only 或將 Supporting 獨立披露，唔得暗示全部獨立主導。只可使用確實參與、可支持、獲公司政策允許披露嘅數字；**不得將訓練觀察、已取消且冇實際處理嘅班機、Draft 或 Trashed Record** 當成 CV 協調工作量。
- 每次勾選職涯匯出時，提供分類核對表／預覽，使用者最後確認準確性及保密合規。

- **不內建 AI 文案生成**。不得擅自把 Self-reported 數字寫成僱主官方認證指標。
- 任何匯出畀外部 AI 的內容由使用者先審閱並確認符合公司政策。

### 11.2 Import & Restore [CONFIRMED]

- 支援 JSON Restore（完整結構）與 CSV Import（欄位對應、資料格式檢查、日期／Role／Type 驗證、防重複）。
- 正式匯入前顯示新增／更新／可能覆蓋數量、衝突提示與預覽，再由使用者確認。
- Restore 時保留 Duty／Aircraft／Disruption／Journal 關聯，不可憑顯示文字猜測 Record ID。
- 資料版本、Schema 升級需可追溯，避免將舊備份直接覆蓋新資料。

### 11.3 Backup / Deletion [CONFIRMED]

- 每日自動雲端備份，**目標保留30日**，另有手動下載備份；實際供應商能力／成本 [TECH TBD]。
- 所有正式上線前及每季進行 Staging／隔離還原測試；不得不必要地複製機密工作資料到 Staging。
- 30日 Trash 為操作資料回復期限；Daily Backups、Trash、Revision History 係三種不同機制。
- 停用／刪除敏感欄位後，備份殘留、到期刪除及 Restore 再帶回資料嘅風險須明確管理。

## 12. Cloud Infrastructure / Deployment [CONFIRMED + TECH TBD]

| 項目 | 決定／技術待辦 |
|---|---|
| Cloud / Database | **Codex 先研究比較，再由使用者選定**；不預設 Vercel、Supabase、Firebase |
| Monthly Budget | 比較真實月費、OTP Email、DB、Storage、Backup、Staging 成本後再定 |
| Domain | **只用免費子網域**；正式 Passkey 所屬網域要保持穩定 |
| Data Region | 優先亞洲／Singapore，可評估可靠性及資料流向 |
| Environments | 分離 Staging / Production，使用不同資料庫、Auth 設定及 Secrets |
| PWA | iPhone Safari 安裝指引、Home Screen Icon、Standalone UI、Offline／Sync 狀態、新版本提示 |
| Source Control | Git，正式發布流程應有測試、審核及可回退策略 |

任何付費項目、服務供應商同正式部署，都必須先經使用者確認。Prototype 階段不需正式 Cloud、Passkey 或 Backup 運作。

## 13. Prototype → Full Product → Production

### Phase 1 — Interactive Prototype [CONFIRMED]

- 五個底部分頁全部可以操作，以**合成虛構資料**模擬 Home、Duty、Quick Add、Timeline、Calendar、Aircraft Detail／History、Statistics、Journal、Search／Filters 及 Settings 基本頁面。
- Light／Dark、雙語切換、Aircraft Card 排版、真實航企 Logo Asset Policy（未核實一律 fallback Airline Name／IATA Code）。
- 可以模擬 Record 新增、Draft、Duplicate Warning、關聯 Duty、編輯／刪除／還原與數據更新；**不能將前端 Mock 狀態偽裝成正式雲端備份及登入**。
- 目標係用 iPhone／Windows 實測：快速、易讀、直觀、操作步驟合理；用戶批准 Prototype 後先投入 Backend。

### Phase 2 — Functional Development [CONFIRMED]

完成正式 Auth／Passkey、關聯式資料保存、資料庫權限、離線 Quick Add + 同步、Conflict、航空資料庫查詢、匯入／匯出、備份及私隱規則。Cloud Provider 須先評估及經批准。

### Phase 3 — QA & Production [CONFIRMED]

完成 iPhone 主畫面 PWA、Safari、Windows、備份還原、安全、衝突、時區／跨午夜、離線／重開 App、各種缺少選填資料等驗收後正式上線。

## 14. 驗收測試（Acceptance Criteria）

1. **Aircraft Card**：`Cathay Pacific CX450` 主標題；`Primary Coordinator · A350-1000 (B-LXI)` 次標題；無 Flight Number／Registration 時正確省略。
2. **App Icon**：簡單飛機圖示；航空公司未核實嘅 Logo 不出現，fallback 至名稱／IATA Code。
3. **五個分頁**：Home、Logbook、中央 Add、Statistics、Journal，Settings 另外入口。
4. **Quick Add**：四項核心必填可儲存 Confirmed；缺任何必填則保存 Draft，不計正式統計。
5. **Duty**：同日可兩個不同 Duty；只有一個合理 Duty 可自動預選，多個候選要求確認。
6. **Draft Duty**：Confirmed Aircraft 連結 Draft Duty 時仍計入 Aircraft Statistics，Draft Duty 不計 Duty Shifts。
7. **夜更**：跨午夜 Duty 按 Shift Start Date／香港時間歸組。
8. **Handling Unit**：Full Turnaround 一條 Assignment，只計一次 Logged／Handled。
8A. **Three-type breakdown [CONFIRMED v1.5]**：Full Turnaround=40、Departure-only=25、Arrival-only=15（均 Confirmed Primary/Supporting），Logged=Handled=80；分類總和=80；Full Turnaround 唔會成為 Departure-only／Arrival-only 子分類。
8B. **Include Training without CV inflation**：上述80條 + 10條 Training ⇒ Logged=90、Handled=80；收藏排名可包含全部90條，CV Coordinated Breakdown 只用可證實參與嘅80條並保留 Role 區分。
9. **Metrics**：Primary 300、Supporting 100、Training 50 → Logged 450、Handled 400、Primary 300。
10. **Unique Aircraft**：相同有效 Registration 重複 Assignment 僅計一次；Registration 缺失不計 Unique，但不影響 Logged。
11. **Disruption**：同一 Assignment 有兩個 Events → Events=2、Disrupted Assignments=1。
12. **Duplicate Warning**：提示疑似重複，但容許使用者確認保留不同 Assignment；同步重試不可重複插入同一 ID。
13. **Offline**：iPhone 離線新增5條 Records，重新開啟後顯示 Pending，連線恢復成功同步一次，不丟失／不多生。
14. **Auth**：初次 Email OTP、設置 Passkey、30日受信任登入目標、過期透過 Passkey 重新登入、Email OTP 恢復。
15. **Conflict**：iPhone／Windows 同欄位不同修改時保留兩個版本，未確認不可靜默覆寫。
16. **Duty Delete**：下層 Aircraft／Journal 仍存在；Restore 時可預覽及確認重新連結。
17. **Privacy**：關閉 Registration 後不能新增／外傳，舊資料提供封存／刪除選擇，備份殘留提示清楚。
18. **Lookup**：先查本人歷史；第三方查詢需主動點擊；查詢失敗仍可手動完成。
19. **Export**：PDF Career Report 自選 Statistics + Career Stories，先 Privacy Preview；AI-friendly JSON 不含已停用／未獲准欄位。
19A. **Career Type Reporting [CONFIRMED v1.5]**：Career PDF／經審核 JSON 分別列示 Full Turnarounds、Departure-only、Arrival-only（及 Role Filter），唔把 Full Turnaround 乘2；同一份報告嘅 Breakdown Sum 要與同口徑 Total Handled 一致。
20. **Import**：JSON Restore／CSV Import 先預覽、防重複、資料驗證及關聯檢查。
21. **Restore Test**：正式發布前及每季可喺隔離環境驗證資料及關聯完整性。
22. **Prototype**：所有演示數據皆虛構，不聲稱提供正式 Cloud Sync／真實工作紀錄。
23. **Parking Bay**：支援可搜尋 dropdown 與自由輸入；能保留 `S25R`、`W121L` 等前／後綴，未列於清單嘅 Bay 亦可保存；停用敏感欄位時不可查詢、保存或匯出。
24. **Save Confirmation**：輸入 Aircraft 資料後，不論按 `Save & Close` 或 `Save & Add Next`，必須先出現 Review Sheet；`Back to Edit` 可修改；只有 `Confirm & Save` 才真正儲存。
25. **Offline Confirmation**：離線亦須完成 Review，再儲存本機；確認成功後顯示 `Pending Sync`，不能誤報 `Synced`.

26. **Two Leg Flight Statuses**：Arrival-only 僅一個 Arrival Status；Departure-only 僅一個 Departure Status；Full Turnaround 有獨立 Arrival / Departure Status，不會把一個 Flight Status 套用兩段航班。
27. **15-minute Threshold Boundary [CONFIRMED]**：假設10:00 Gate Time：09:40 Early；09:45 On Time；10:14:59 On Time；10:15:00 Delayed。若只具整分鐘時間，10:14 On Time、10:15 Delayed。時間來源如不完整，仍可手動選擇但標示 Self-reported。
28. **Review Window**：喺 Save 確認視窗正確顯示所有適用 Status，兩項狀態不同亦無法互相覆蓋。
29. **Statistics Filter**：Arrival Status 與 Departure Status 可獨立篩選／統計，不得重複計 Aircraft Handling Assignments；Not Recorded 不等於 On Time。

## 15. 最後一致性檢查、已採納規則與技術待辦

### 15.1 無根本衝突、已清晰解決 [CONFIRMED]

- **Aircraft Logbook 限 HAS TCO** 與 **Career Journal 可獨立記錄其他經驗**可以並存；外部經驗不進 TCO 工作量統計。
- **Draft Duty** 可與 **Confirmed Aircraft** 共存；兩者按各自 Status 計數。
- **離線 Quick Add** 同 **Passkey 登入**可並行；離線資料待重新驗證身份後同步。
- **真實航空公司 Logo** 係獨立品牌素材要求，不可用 AI 概念圖作官方 Logo。
- **Flight Number 位於 Card 第一行** 不代表必填；如停用就只顯示 Airline Name。
- **15分鐘 Flight Status 門檻由使用者確認**：Early 早超過15分鐘；On Time 早15分鐘以內至遲少於15分鐘；Delayed 遲15分鐘或以上。僅作個人分類，並非 HAS／航空公司官方 KPI。
- **Gate/Stand 基準之操作定義已澄清**：AIBT/AOBT 用於 Arrival/Departure 狀態比較；Chocks On/Off 不與 AIBT/AOBT 無條件等同；詳細時間欄位仍係選填、受公司政策限制。
- **Handling Type 互斥分類已由使用者確認 [v1.5]**：Full Turnaround、Departure-only、Arrival-only 各計一個真實 Assignment；收藏數據三者俱全；CV 協調成果分三個數字，並排除純 Training／Observation。

### 15.2 四項一致性規則 [ADOPTED UNDER v1.5 APPROVAL]

1. **HAS TCO Scope Guardrail**：其他職位可寫獨立 Career Journal，唔可混入 TCO Aircraft Metrics（從已確認 Scope 直接推導）。
2. **Multiple Duty Ambiguity**：同日有多個可選 Duty 時，Quick Add 必須提示選擇，唔能夠自動亂配。
3. **Orphan Handling**：刪除 Duty 後下層 Aircraft Record 暫列為 `Unlinked`，仍保留獨立 Handling Date，同時提醒重新關聯；可計數與否按 Record 自身 Confirmed 狀態。
4. **Disruption Consistency Warning**：若有 Disruption Event 但上層 Assignment 標成 Normal，提醒修正；未知狀態不可當 Normal。

### 15.3 技術評估及產品細則未鎖定 [TECH TBD / FUTURE]

- **Cloud Stack、實際月費、OTP／Passkey Provider、備份30日成本、Staging 成本、地區及 API 授權**：先比較，再批准。
- **兩個 Flight Status 欄位**：已由使用者確認 Arrival／Departure 分開記錄；唯 Full Turnaround Card 兩個 Flight Numbers 嘅排列屬最後 UI [REVIEW]。
- **修改歷史保留期**：已確認需要修改歷史，但未決定保留幾耐；30日係垃圾桶期限而唔係編輯歷史期限。
- **Registration、Parking Bay 等敏感欄位最終可否啟用**：取決於 HAS 政策，未確認前應維持限制。
- **iOS PWA Passkey / 30日登入／Offline 持久化**：按選用供應商及實機能力驗證。
- **HKIA Parking Bay 清單**：已找到民航處官方 AIP／Chart，但未完成可重用、全面核實的結構化清單提取；需覆核授權／版本更新後才可宣稱完整下拉選單可用，手動輸入必須一直可用。
- **Disruption 必填欄位嘅最終 Validation 細則**：目前確定分類及選項，但尚未決定每項是否全部必填；建議先容許 Draft。

## 16. 最終批准檢查清單

- [ ] 已核對產品用途、HAS TCO 範圍、獨立 Career Journal。
- [ ] 已核對五個底部分頁、Home 核心 Statistics 同航空卡片兩行排版。
- [ ] 已核對 App 飛機 Icon、Airline Logo 只限官方可用素材。
- [ ] 已核對 Duty／Aircraft／Disruption／Journal 關聯及離線、刪除、還原規則。
- [ ] 已核對數字統計定義：Logged、Handled、Primary、Duty、Unique、Disruption。
- [x] 已確認 **Full Turnaround / Departure-only / Arrival-only 獨立計數**；航空迷收藏統計全部納入，CV/PDF 輸出分三種工作類型並嚴格按 Role、完整性及可披露範圍過濾；本份 PRD 整體仍未批准。
- [ ] 已核對 Passkey／30日 Session、Offline、衝突處理、私隱及匯出。
- [ ] 已核對 **Parking Bay 可搜尋 dropdown／手動輸入**，同時確認實際官方清單資料來源、授權及完整度仍待評估。
- [ ] 已核對 **Aircraft Save 前必須 Double-check Review Sheet**，支援返回修改及離線 Pending Sync 顯示。
- [x] 已確認 **Arrival / Departure Flight Status 兩個獨立欄位**，以及 **15分鐘 Early / On Time / Delayed 個人分類門檻**、操作入口和統計篩選；整體 PRD 仍待另外批准。
- [x] 已釐清 **Gate/Stand (AIBT/AOBT) 與 Chocks On/Off 有關連但不可無條件視作同一時間**；不將任何額外時間設為必填。
- [ ] 已核對 **15.2 四項建議規則** 是否同意納入。
- [ ] 已知 **15.3 技術與欄位待決事項** 不由 Codex 默默決定，需提出建議供批准。
- [ ] 確認只先開發 **全五分頁可操作 Interactive Prototype**，正式 Backend 等 Prototype 批准後才進行。

**Approval Status: APPROVED (2026-10-17).** Prototype v0.1 Codex Prompt is a separate companion document. Technical/provider decisions remain open for future phases. No production code was created as part of approving this PRD.
