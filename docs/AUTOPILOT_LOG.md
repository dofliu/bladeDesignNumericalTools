# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片結構分析的截面性質核心

- 做了什麼:新增 `src/struct.js`,提供薄殼截面性質函式 `sectionProps(pts, t)`——輸入一組閉合多邊形頂點(翼型或任意截面外形)與均勻殼厚,對每一段用「細長矩形」的方式做線段積分,回傳面積、形心 (xc, yc) 與對形心的慣性矩 (Ixx, Iyy, Ixy)。直線段的結果是精確解,曲線外形則隨分段數收斂。`scripts/build.mjs` 的 `ORDER` 加入 `struct`(排在 `aero` 之後),`tests/struct.test.mjs` 用矩形管與圓管的解析解(`Ixx = t·h²(3w+h)/6` 等、圓管 `Ixx=Iyy=πr³t`)驗證,並額外測試整個外形平移時形心跟著平移、慣性矩不變。
- 為什麼:`docs/ROADMAP.md` 第 3 項「葉片結構分析」的第一個子項——目前排程還無法安全地在同一次執行內把這個算法接上翼型幾何、殼厚/材料設定與單葉片工作區的 UI(牽涉到 `core.js` 的 rebuild 流程與新的面板控制項,範圍較大),所以這次先把數學核心獨立做完、用已知解析解驗證,不動到任何既有檔案的行為,風險很低、可以完全靠 Node 測試驗證。同時發現 ROADMAP 第 1 項剩下的「ES modules + Vite」子項牽涉全部 9 個檔案共用全域作用域(尤其 `ui.js` 直接在頂層定義大量函式,不是單一命名空間物件),要換成 `import`/`export` 需要逐一盤點跨檔案呼叫並同步修改,在「全自動、無人先審查」的排程下風險偏高,已在 ROADMAP 該項下方註記備註與建議,本次先跳過、改做這個不相依的項目。
- 驗證:`npm run check`(10 個檔案全過,含新增的 `struct.js`)、`npm test`(11/11,含 3 個新增的結構測試)、`npm run build`(249 KB)、`npm run test:e2e`(全過,含桌面/手機截圖、3 種匯出、12 組瀏覽器版 MPPT 追蹤率回歸 94–97%——這次改動不影響任何既有行為,數字與上次執行一致)。桌面 1440×900 與手機 390×844 的單葉片工作區截圖確認排版與上次相同(本次沒有任何 UI 變動)。
- 已知限制:`struct.js` 目前完全獨立,還沒有任何程式碼呼叫它;還不支援非均勻殼厚(例如翼梁局部補強)或多層複材疊層(只做單層等厚薄殼近似)。
- 下一步:ROADMAP 3 — 把 `sectionProps` 接上 `G.afs` 的翼型座標(乘以各站弦長)與使用者輸入的殼厚/材料密度,逐展長站算出面積/形心/慣性矩,並在單葉片工作區新增「結構」卡片顯示;之後才是載重、應力、疲勞。ROADMAP 1 的 Vite/ES modules 遷移留給使用者確認要不要用一般(有人審查)工作階段來做。

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
