# v0.1.1 視覺／響應式人工驗收

> 此為 v0.1.1 歷史清單。v0.1.2 已另作本機 Edge 檢查及啟用本機 PNG 顯示，最新流程及限制見 [V0_1_2_ACCEPTANCE.md](V0_1_2_ACCEPTANCE.md)。以下舊版「零圖片／未有瀏覽器」描述不代表目前狀態。

**狀態：尚未完成實際瀏覽器及 iPhone 驗收。** 本次 Computer Use 回傳 `apps: [] / browsers: []`。已執行 CSS token 對比計算、元件與 CSS media contract 測試，但 jsdom 不提供真實版面、像素截圖或動畫幀驗證，不能據此聲稱沒有水平溢位。

## Windows 啟動

```powershell
cd C:\Projects\TCO-Logbook
npm.cmd run dev
```

使用現有瀏覽器及**相同網址／port**開啟 `http://127.0.0.1:5173/`，保留之前的示範紀錄。不要按 Reset／Seed。F12 開啟 Edge／Chrome DevTools，`Ctrl+Shift+M` 開啟裝置工具列，選 Responsive 並輸入寬度。以 DevTools → More tools → Rendering 切換 `prefers-color-scheme` 與 `prefers-reduced-motion` 模擬。

## 必測尺寸矩陣

每格驗收 Home、Logbook（Filters 展開／Calendar）、Statistics、Journal、Settings、Aircraft form、Review、Aircraft detail。高度可先使用 900px，手機另用 844px。選單、日期輸入及軟鍵盤仍須實機覆核。

| 寬度 | 預期配置 | Light | Dark | 無水平捲動 | 未被導航遮蓋 |
|---:|---|---|---|---|---|
| 375 | 單欄、220px 雷達、五項底部導航、單欄表單 | [ ] | [ ] | [ ] | [ ] |
| 390 | 同上，中央 Add 突出 | [ ] | [ ] | [ ] | [ ] |
| 430 | 同上，卡片長文字自然換行 | [ ] | [ ] | [ ] | [ ] |
| 768 | 雙欄 hero／卡片、浮動底部導航、雙欄篩選 | [ ] | [ ] | [ ] | [ ] |
| 1024 | 224px 固定側欄、寬版 Dashboard、無底部導航 | [ ] | [ ] | [ ] | [ ] |
| 1440 | 寬版雙欄 hero、三欄 Journal、較寬圖表 | [ ] | [ ] | [ ] | [ ] |
| 1920 | 同上，使用橫向空間，內容不局限於手機寬度 | [ ] | [ ] | [ ] | [ ] |

- [ ] 即時調整 767→768→1024px，路由、紀錄、表單值不變；只有呈現配置改變。五項導覽為同一 DOM／操作來源。
- [ ] DevTools Console 執行 `document.documentElement.scrollWidth <= document.documentElement.clientWidth` 應為 `true`；實際左右捲動確認。對話框另檢查 `document.querySelector('dialog[open]').scrollWidth <= document.querySelector('dialog[open]').clientWidth`。
- [ ] 使用很長的合成航班／航空公司名稱、自訂停機位測試換行；不要輸入真實營運資料。
- [ ] 手機日期／datetime 控制不超出容器；輸入字體 16px，確認 Safari 不因過小字體自動縮放。

## 深色表面及互動狀態

- [ ] Home／Statistics KPI 的所有數字、標籤及說明立刻可讀；Recent Duty 日期、狀態、時間及 View Duty 可讀。
- [ ] Recent Aircraft、Logbook、Journal、Settings、form／Review 在 Dark Mode 不再繼承深色 root 字色。每個標題、細字、狀態及日期均可讀。
- [ ] 檢查 normal、hover、Tab focus、pressed、selected、disabled；禁用按鈕不以低 opacity 淡出，也不可點擊。
- [ ] 焦點框可見，側欄／底欄當前頁明確。尤其測試 selected Calendar day／Timeline toggle 的 hover。
- [ ] CSS 對比測試涵蓋所有一般角色配對 ≥4.5:1，焦點 ≥3:1。下表是固定深色表面在兩個系統主題共用的計算值；不代替實際渲染檢查。

| 文字 token | 深色底 #133d43 | Raised #1d4b50 | Hover #24545a |
|---|---:|---:|---:|
| Primary #f7f5ed | 10.83:1 | 8.85:1 | 7.72:1 |
| Secondary #dbe8e1 | 9.37:1 | 7.65:1 | 6.68:1 |
| Muted #b9cfc6 | 7.21:1 | 5.89:1 | 5.14:1 |
| Accent #b5e2cf | 8.30:1 | 6.78:1 | 5.92:1 |

## 雷達

- [ ] 預設開啟 Home 後觀看至少 12 秒：六秒一圈、勻速旋轉兩圈；可見寬扇形漸層尾跡及薄亮前緣，並非只有一條旋轉線。
- [ ] 飛機、同心環、crosshair、HKG／HKIA 標記保持靜止；掃描層在飛機下方且被圓形區域裁切。
- [ ] 0／360° 接縫沒有明顯跳動；光暈克制，無閃爍、位移或佈局跳動；不能阻擋按鈕或捲動。
- [ ] Rendering → `prefers-reduced-motion: reduce` 後掃描靜止；飛機／刻度／漸層仍在。切回 no-preference 後旋轉恢復。
- [ ] 1440px／390px 各截一張 Light／Dark Home；另截約 0、3、6 秒畫面比較掃描方向。不要把靜態截圖當流暢度驗證。

## 航空公司資料庫及 fallback

- [ ] Settings 顯示九項參考資料與零個獲批標誌；CX、LD、HX 清楚區分，所有 Ramp／TCO 關係未核實。
- [ ] New Aircraft 的原生搜尋建議有 Air Hong Kong，label 含 LD；手動輸入其他航空公司仍可保存，必經 Review。
- [ ] Home／Timeline／Calendar／Duty／Aircraft detail 的代碼與名稱 fallback 正常；原有 `Airline + Flight(s)`／`Role · Variant (Registration)` 層級不變。
- [ ] DevTools Network 清除後切頁，沒有向外部 logo 服務或航空網站請求圖片。現時沒有獲批圖片，因此只顯示 fallback。
- [ ] 將來有合法獲批檔案後，另測本機圖片在 Light／Dark 的原色、比例、三種尺寸；模擬 404 後回復 code，不顯示破圖。此分支目前只有元件測試，沒有真實航空圖片的視覺驗收。

## iPhone

同一信任 Wi-Fi 可由 Windows 執行 `npm.cmd run dev -- --host 0.0.0.0`，按需要允許私人網絡防火牆，在 Safari 開啟 Windows 的 LAN IP。勿使用 iPhone 的 localhost。不同 origin 有獨立儲存，LAN URL 不會自動帶入 Windows localhost 的紀錄。

- [ ] 使用 390px 左右實機，檢查 safe area、底部 home indicator、軟鍵盤與 Review 捲動。
- [ ] iOS Settings → Accessibility → Motion → Reduce Motion 後雷達停止；關閉後恢復。
- [ ] 明暗外觀、雷達至少 12 秒流暢度、長字卡片、日期控制及中央 Add 可操作。

LAN HTTP 只是本機示範；未新增 HTTPS hosting、Service Worker、離線重載、auth 或雲端同步。繼續用 [原本 PRD 人工驗收清單](MANUAL_ACCEPTANCE.md) 驗證業務功能。
