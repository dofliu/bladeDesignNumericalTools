# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-27 — ROADMAP 1:charts.js / geo.js 改成真正的 ES modules(Vite 打包)

- 做了什麼:ROADMAP 第 1 項「把 `src/*.js` 改成 ES modules,用 Vite 建置」拆成子步驟(見 `docs/ROADMAP.md`),先完成風險最低的第一步。實測發現 Vite 只會處理 `type="module"` 的 `<script>`,不會幫忙串接一般全域腳本,所以要用 Vite 就必須先有真正的 ES module 原始碼;因此選了兩個完全沒有跨檔案全域依賴的葉節點模組 `charts.js`(`Plot`)與 `geo.js`(`GEO`)動手,改寫成 `src/charts.mjs`/`src/geo.mjs`(具名 `export`,拿掉舊的 IIFE 包裝)。`scripts/build.mjs` 新增 `moduleSource()`:對 `ESM_GLOBAL = {charts:'Plot', geo:'GEO'}` 裡的模組,呼叫 Vite 的 `build({ build: { write:false, lib: {entry, formats:['iife'], name} } })` 把 `.mjs` 打包成對應全域名稱的 IIFE 字串,其餘檔案仍用原本 `readFileSync` 讀取;串接順序、`/* ==== name.js ==== */` 註解與最終 `<script>` 輸出結構不變。`scripts/check.mjs` 一併掃 `.mjs`。新增 `vite` 為 devDependency。
- 為什麼:這是「工程基礎整理」大項目裡風險最小、可獨立驗證的第一刀 —— 先在不影響其餘 7 個檔案、不改變任何執行期行為的前提下,把 Vite 接進建置流程並產出兩個貨真價實的 ES module,驗證「Vite lib 模式打包成指定全域名稱的 IIFE」這個技術路徑可行(已用 prototype 確認具名 export 會攤平成 `Global.fnName`,不會多包一層 `.default`,`Plot.draw.force` 這種掛在函式物件上的屬性也維持同一個物件參照)。其餘 7 個檔案彼此透過 `S`/`G`/`SIM`/`AERO` 等全域大量互相依賴,一次全部轉換風險與 diff 都太大,故按 `docs/AUTOPILOT.md` 規則拆成多個子步驟,已在 ROADMAP 記錄下一步(`scene.js` → `aero.js`/`core.js` → `ui.js`/`bench.js`/`flow.js`/`report.js` → 最後把 `scripts/build.mjs` 整個換成 `vite-plugin-singlefile`)。
- 驗證:`npm run check`(9 個檔案全過,含新的 `charts.mjs`/`geo.mjs`)、`npm test`(8/8,HAWT 95–97%、VAWT 92–97%)、`npm run build`(241 KB)、`npm run test:e2e`(全過:桌面/手機 4 個工作區無 console error、STL/CSV/ZIP 三種匯出檔名與大小正確、manual 文字備援、12 組瀏覽器版 MPPT 追蹤率 92–97%)。桌面 1440×900 與手機 390×844 的單葉片/風洞畫面截圖確認翼型圖表(`Plot`)與 3D 模型排版正常。
- 已知限制:`scene.js`、`aero.js`、`core.js`、`ui.js`、`bench.js`、`flow.js`、`report.js` 這 7 個檔案仍是全域腳本串接,尚未變成 ES module;`vite-plugin-singlefile` 尚未接入,`scripts/build.mjs` 仍是手動字串串接 + 針對已轉換模組的 Vite lib 打包混合做法,是過渡態。
- 下一步:ROADMAP 1 子步驟 2 —— 把 `scene.js` 用同樣模式轉成 ES module(先確認它對其他全域的依賴方向)。

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
