# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:薄殼截面幾何性質(面積/形心/慣性矩)

- 做了什麼:ROADMAP 1 剩下的子項目是「把 `src/*.js` 改成 ES modules,用 Vite 建置」——這是牽動全部 9 個檔案、目前靠全域變數溝通的架構性重寫(見 `CLAUDE.md` 的資料流說明),真的動手做會動到 script 載入順序與時機這種難以只靠自動化 smoke test 完全把關的細節,所以先用 GitHub issue 記錄風險評估與建議的分階段做法(見下),本次改做 ROADMAP 3(葉片結構分析)的第一個子項目,兩者互不相依。
  在 `src/aero.js` 新增 `shellSectionProps(pts, t)`(通用薄殼多邊形截面性質:面積、形心、Ixx/Iyy/Ixy,分段積分法,常見於複材葉片殼/翼樑截面估算)與 `sectionProps(af, chord, tShell)`(套用在翼型外形上,先轉成物理座標再呼叫前者)。
- 為什麼:ROADMAP 第 3 項第一條「截面性質:依翼型外形 + 殼厚/材料計算面積、慣性矩、形心(可用多邊形積分)」,是後續根部彎矩/應力/撓度計算的基礎,且是純函式、可在 Node 直接單元測試,風險低、與其他模組無相依,適合當一個獨立小步。
- 驗證:
  - `npm run check`:9 個檔案全過。
  - `npm test`:11/11(新增 3 個測試 — 薄圓環解析解 I=πR³t 在 1e-6~1e-8 誤差內吻合、對稱翼型形心在弦線上且弦向 Iyy 遠大於厚度向 Ixx、弦長加倍/殼厚加倍的縮放律 area∝chord¹∝t¹、I∝chord³∝t¹ 都在 2% 內)。
  - `npm run build`:249 KB。
  - `npm run test:e2e`(`CHROME_PATH` 用容器內建 chromium、`THREE_LOCAL` 用 `npm pack three@0.128.0` 解出的 three.min.js):全過,含桌面/手機截圖、3 種匯出、12 組 MPPT 追蹤率回歸 95–97%。另外用 Playwright 截圖桌面 1440×900 與手機 390×844 的水平軸風洞畫面,確認排版正常、翼型/性能圖表照常繪製。
- 已知限制:
  - 只做到截面「幾何」性質,還沒接材料的楊氏模數/容許應力(`core.js` 的 `MATERIALS` 目前只有 `rho`、`fill`),也還沒有根部彎矩、應力、撓度計算,更沒有 UI 卡片或報告章節——這些留給後續 autopilot 執行,已在 ROADMAP 用 `- [ ]` 記錄順序。
  - ROADMAP 1 的 ES modules + Vite 遷移仍未開始;已開 [GitHub issue #6](https://github.com/dofliu/bladeDesignNumericalTools/issues/6) 說明風險與建議的分階段做法,等使用者確認後再排入之後的自動執行。
- 下一步:先處理 ROADMAP 3 的「`MATERIALS` 補上 E / 容許應力」與「由 BEM 載重算根部彎矩、應力、撓度」;ES modules/Vite 遷移待使用者回覆 issue 後再排入。

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
