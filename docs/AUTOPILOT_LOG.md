# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-27 — ROADMAP 7:風速 Weibull 參數與容量因數

- 做了什麼:`docs/ROADMAP.md` 第 1 項剩下的子步驟(把 `src/*.js` 改成 ES modules、用 Vite 建置)牽動全部 9 個檔案間的全域變數溝通與載入順序,且目前自動化測試(`npm test` 的控制器回歸 + `tests/e2e.smoke.mjs` 的畫面/匯出檢查)無法涵蓋 UI 大部分互動路徑,單次排程執行盲改風險過高、出錯也不易由測試抓到,因此本次改做風險較低、可獨立驗證的第 7 項:原本「性能曲線」分頁與「方案比較」分頁的年發電量(AEP)都是寫死 k=2 的 Rayleigh 分布(`ui.js` 兩處各自內嵌同一條公式),且未提供容量因數。新增 `core.js` 的 `gammaFn`(Lanczos 近似)、`weibullPdf(v, meanV, k)`(一般 Weibull 分布,k=2 時代數上與原本的 Rayleigh 公式完全等價)、`capacityFactor(aepKWh, ratedW)`;`S.perf.k` 預設 2(維持原行為不變);「性能曲線」與「方案比較」分頁新增「Weibull k」輸入框(1.2–3.5),取代原本寫死公式;年發電量圖表標題、方案比較表格新增容量因數欄、報告摘要卡新增容量因數卡片。順手修掉一個既有的 CSS bug:手機版工具列 `.opts` 的樣式規則只在巢狀於 `.ctabs` 時生效(`.ctabs .opts{...}`),但手機版會把整個 `#copts` 節點搬到 `#mopts` 下,搬走後不再匹配該選擇器,兩個 `<label>` 就沒有 flex/gap,黏在一起變成「m/sWeibull k」;改成不限父層的基底 `.opts{display:flex;gap:8px;...}` 規則。
- 為什麼:ROADMAP 第 7 項已註明可用「匯入風速時間序列或 Weibull 參數」任一種方式;Weibull 參數法工作量小、可完全用既有 Node 測試模式驗證(純函式、無 DOM 依賴),且 k=2 時與原始 Rayleigh 數值逐點相等,不會改變任何既有預設輸出。ES modules/Vite 遷移仍在 ROADMAP 第 1 項,留給後續排程,屆時建議先補齊 UI 層的自動化涵蓋率(目前 e2e 只涵蓋風洞/單葉片/流場/報告四個工作區的基本頁面截圖與匯出,不涵蓋方案比較、報告產生等互動),再分小步進行,降低整批 9 檔重寫的回歸風險。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(12/12,新增 4 個測試涵蓋 `gammaFn` 已知值、`weibullPdf` 在 k=2 與原 Rayleigh 公式逐點相等、`weibullPdf` 對多組 k 積分為 1 且平均值符合 meanV、`capacityFactor` 邊界)、`npm run build`(249 KB)、`npm run test:e2e`(全過,12 組追蹤率 94–97%,3 種匯出正常)。另外用 Playwright 手動截圖桌面 1440×900 與手機 390×844 的「性能曲線」「方案比較」「報告」畫面,確認 Weibull k 輸入框、容量因數欄位/卡片版面正常,且調整 k 後圖表與數字會即時更新;截圖也確認了上述手機版 CSS bug 修好後兩個輸入框有正常間距。
- 已知限制:容量因數與 AEP 都是「理想 MPPT、未考慮風向/紊流損失」的粗估,與既有 AEP 假設一致;尚未支援直接匯入實測風速時間序列(ROADMAP 第 7 項的另一種做法)。
- 下一步:ROADMAP 第 7 項可選擇補時間序列匯入,或轉回第 1 項的 ES modules + Vite 遷移(建議先補 UI 互動的自動化測試涵蓋率,降低該項風險)。

## 2026-09-27 — ROADMAP 1:MPPT 回歸移到 Node 單元測試

- 做了什麼:把 `src/core.js` 包成與 `src/aero.js` 相同的 Node/瀏覽器雙模組匯出(IIFE,Node 用 `module.exports`,瀏覽器用 `Object.assign(root, API)` 把所有原本的全域名稱原樣裝回去),串接組建(`scripts/build.mjs`)後的行為不變。新增 `tests/core.test.mjs`,直接在 Node `require` `core.js`(先設定 `global.AERO = require('../src/aero.js')`),重現 `tests/e2e.smoke.mjs` 那組 HAWT/VAWT × po/tsr/ot × 6/9 m/s 的 MPPT 追蹤率回歸,門檻同為 ≥ 90%。
- 為什麼:`docs/ROADMAP.md` 第 1 項的既定下一步;`simStep` 等控制邏輯原本只能靠啟動瀏覽器(Playwright)才能驗證,`npm test` 現在幾百毫秒內就能抓到控制器回歸,`npm run test:e2e` 則繼續驗證建置後 dist 成品的端對端行為(畫面、匯出、Three.js 場景)。這一步不做完整的 ES modules + Vite 遷移(風險與工作量都大很多),留給下一次執行。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(8/8,含新增的 2 個 Node MPPT 測試,HAWT 95–97%、VAWT 94–98%)、`npm run build`(247 KB)、`npm run test:e2e`(全過,含桌面/手機截圖、3 種匯出、12 組瀏覽器版追蹤率回歸 94–98%)。桌面 1440×900 與手機 390×844 的風洞畫面截圖確認排版正常。
- 已知限制:core.js 仍非 ES module,只是額外包了一層 IIFE 相容 Node/瀏覽器;完整的 Vite 遷移(ROADMAP 1 第一條)還沒做。
- 下一步:ROADMAP 1 — 把 `src/*.js` 改成 ES modules,用 Vite + `vite-plugin-singlefile` 建置,仍輸出單一 HTML。

## 2026-09-27 — 設定排程

- 匯入 v0.9.0 原始碼;完成 ROADMAP 1 的「匯出 Blob 下載備援」(e2e 已涵蓋)。
- 建立每 6 小時一次的自動開發排程與本規則文件。
- 驗證:`npm run check`、`npm test`(6/6)、`npm run build`、`npm run test:e2e`(全數通過)。
- 下一步:ROADMAP 1 — 把 `src/*.js` 改成 ES modules + Vite(輸出仍為單一 HTML),再把 `core.js` 的模擬邏輯拆成不依賴 DOM 的模組、MPPT 回歸移到 Node 測試。
