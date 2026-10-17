# v0.1 人工驗收清單

尚未完成人工驗收。自動測試已覆蓋計算與元件互動，但不等同實際 Windows／iPhone 渲染。以下均只輸入合成資料。PRD 14 中正式 Auth／Sync／Conflict／Production Import／Backup 驗收不屬此版。

## Windows Edge／Chrome

先執行 `npm.cmd run dev`，開啟終端網址；另以 `npm.cmd run build` + `npm.cmd run preview` 檢查建置版本。

- [ ] **PRD 2.1–2.4、14.1–3**：五個底部項目皆可進入；Add 有 Aircraft／Duty／Journal 三種選擇；Settings 是右上角入口；飛機 icon；純 Airline／IATA 文字，沒有仿製航空公司 Logo。
- [ ] **PRD 2.3、5.1**：首次 demo Home = Logged **17**、Handled **12**、Primary **6**。三者不可相加。預載共 18 項，另 1 項是 Draft。
- [ ] **PRD 2.1**：Settings 切繁體中文，重新整理後保留；改 Windows 系統明暗主題，確認字色、表單、badge、圖表可讀。
- [ ] **PRD 4.1、14.4**：新增 Aircraft 只填 Airline／Variant，確認其餘兩個預選值及日期；漏填 Airline／Variant 按 Save & Close 不可 Confirmed；Save Draft 仍須 Review。
- [ ] **PRD 4.1A、14.24、28**：所有三種 Save 均先出現 Review；Back to Edit 保留欄位；Review 的 X／Esc／取消不新增紀錄或 Duty；只有 Confirm & Save 寫入；雙擊不能多一條。
- [ ] **PRD 4.1A**：Save & Add Next 確認後清空新航機欄位並保留所選 Duty；儲存訊息為「Saved on this device (prototype)」。
- [ ] **PRD 3.1、4.1、15.2**：日期改 `2026-10-16` 時有兩個 Duty，要求明確選擇；從 Duty Detail 新增會預選該 Duty；沒有適合更次時，直到最後確認才新增 Draft Duty。
- [ ] **PRD 3.2、14.6**：14 October Draft Duty 的 Confirmed Aircraft 仍計 Aircraft 統計；Draft Duty 不計 Duty Shifts。首次 demo Duty Shifts = **5**。
- [ ] **PRD 3.1、6、14.7**：15 October `22:00–06:00 (+1)` 按 15 October 開更日期分組；另新增 Handling Date=16 October 並選此 Duty，按 16 October 篩選後仍可在原更次看到。
- [ ] **PRD 2.4、14.1**：開啟 Flight Number／Registration 開關後，卡片首行為 Airline + Flight(s)，次行 Role · Variant (Registration)；缺少選填值沒有空括號；Home／Timeline／Calendar／Duty／搜尋均一致。
- [ ] **PRD 3.2A–B、14.26–29**：啟用 Flight Status／Gate Times。Arrival-only 只有 Arrival；Departure-only 只有 Departure；Full Turnaround 可設 Arrival Delayed + Departure On Time，覆核及儲存後仍獨立。
- [ ] **PRD 3.2A–B、14.27**：表定 gate `10:00:00`，實際 `09:44:59`=Early、`09:45:00`=On Time、`10:14:59`=On Time、`10:15:00`=Delayed；建議不會覆寫手動值，必須按 Use suggestion explicitly。
- [ ] **PRD 3.2A–B**：輸入跨午夜的 dated gate times，確認香港 +08:00；文字標明 SIBT/AIBT、SOBT/AOBT，並非 Chocks／Landing／Take-off。
- [ ] **PRD 3.2A**：取消且沒有實際處理時，在 More Details 取消 actual handling 勾選，不可儲存 Confirmed；可經 Review 存 Draft。
- [ ] **PRD 3.6、14.23**：停機位原生搜尋建議含 S25／S25R／W121L，保留前後綴；輸入 `DEMO-CUSTOM-121L` 可儲存；清單明確不是正式完整 HKIA catalog。
- [ ] **PRD 4.2、14.12**：啟用 Registration／Flight Number，新增同日期、更次、機型、類型和識別值，Review 顯示重複警告；勾 Keep as separate assignment 後可保存。
- [ ] **PRD 7、14.18**：Registration `DEMO-001` 顯示本機歷史建議；只有主動採用才更新 Airline／Variant；仍可手動改；Search Public Database 禁用。Detail → Aircraft History 有多次接觸及首末日期。
- [ ] **PRD 6**：Logbook 預設 Timeline，Calendar 可換月份及展開日期；無紀錄沒有標為休假。搜尋／日期／角色／機型／類型／兩個狀態／異常可組合，清除可回復。
- [ ] **PRD 5、14.8–11、19A**：Statistics 的 type breakdown 切 Logged／Handled／Primary；三項相加等於同口徑總數。Full Turnaround 不重複；Training 包含於 Logged 排名但不進 Handled／職涯報告；Arrival／Departure status legs 不能當兩項 assignments。
- [ ] **PRD 3.3、15.2**：第一條 Cathay demo assignment 有 2 events → 2 events、1 assignment with events。Normal 但已有事件會提示、不刪事件。新增事件可選 involvement／impact／resolution／Journal。
- [ ] **PRD 3.4**：Journal 新增 STAR 欄位、能力標籤及成果；存 Draft／Confirmed、搜尋能力及日期、編輯；可獨立、連一個 Duty 或多個 Aircraft，再解除連結；Aircraft totals 不變。
- [ ] **PRD 4.3、14.16**：Duty 移至 Trash 後 Aircraft／Journal 仍存在、顯示 Unlinked；Settings 還原先有關聯預覽及明確勾選；已改連其他更次／航機的關聯不可覆寫。
- [ ] **PRD 4.3**：Aircraft Trash 後統計減少；Settings 覆核還原後恢復原狀態及計數；查看修改活動摘要。30 日示範期限不等於完整版本回復。
- [ ] **PRD 10、14.17**：六項敏感開關初始關閉。啟用再停用會顯示影響數量；封存後普通輸入、卡片、詳情、搜尋、篩選不可見；再啟用可看到保留值；Delete 選項確認後只清除指定欄位。
- [ ] **PRD 11.1、14.19／19A**：Privacy Preview 選期間、Primary／Primary+Supporting、三種計數、故事；資料只含合成摘要；改選項要重新覆核；JSON／CSV 下載可開啟，無機身／航班／bay／gate／link IDs。CSV 只含計數；Print / Save as PDF 只有報告，無導覽或控制欄。
- [ ] **PRD 13.1、14.22**：重新整理保留已確認的本機修改；Settings 的 Reset／Seed 先確認，取消不取代資料；顯示本機限定，未聲稱雲端、登入、備份或公司安全認證。

## 375px 窄畫面與鍵盤

- [ ] 在 Edge／Chrome DevTools 設 375 × 812；所有五個分頁、Filters、三種表單、Review／Detail、Privacy Preview 沒有水平捲動，長航班／航機標題及自訂字串可換行。
- [ ] 對話框可向下捲至最後操作；底部導覽不遮住主要內容；觸控操作容易點選；日期與 datetime 輸入不超出容器。
- [ ] 以 Tab／Shift+Tab／Enter 操作，對話框開啟後焦點留在內部；Esc 關閉 Review 不保存；回編輯時值及焦點合理；編輯中關閉要確認捨棄。
- [ ] Light／Dark 均檢查細字、表單框線、錯誤及狀態標籤；系統 Reduce Motion 不影響操作。

## iPhone（待日後安排）

- [ ] 同 Wi-Fi 使用 Windows LAN URL；參閱 README 的 host／防火牆說明。iPhone 的 localhost 不是 Windows。
- [ ] Safari 375px 等實際裝置寬度、safe area、軟鍵盤、表單／Review 捲動、返回／Esc 替代行為、語言及深色外觀。
- [ ] 重新整理及重開相同 origin 的 Safari 時，本機示範資料仍可讀；不要視為備份保證。
- [ ] HTTPS／加入主畫面／真正離線重新載入與雲端重試尚未實作，不以此版通過 Production PWA 驗收。

驗收者：________　日期（香港）：________　瀏覽器／裝置：________　發現問題：________
