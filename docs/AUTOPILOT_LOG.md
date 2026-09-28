# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(設計點,HAWT 彎矩/離心力/撓度)

- 做了什麼:接續上次「截面性質」之後的下一個子項——載重。`core.js` 新增 `bladeStructural()`:由 `designHAWT()` 已經算好的設計點 BEM 元素(`G.desElems` 的 cl/cd/phi/W)在每一截面重建片向(flapwise,推力方向)與弦向(edgewise,扭矩方向)的分布力(轉成每一站的集中力,和 BEM 本身以環帶為單位的離散化一致),再用既有質量模型(材料密度 × 填充率 × 翼型面積)反推等效殼厚——`geo.js` 新增 `solveThicknessForArea(af, chord, targetArea)`,對 `sectionProperties` 的面積二分求解,讓這次新增的結構模型與現有已驗證的質量/慣量計算(影響控制器時間常數與 MPPT 回歸)保持一致、不去動原本的公式。有了每一站的殼厚,呼叫 `sectionProperties` 取得 Ixx/Iyy 與(新增的)極端纖維距離 `xLE/xTE/yTop/yBot`,再乘上離心力算出的分布力,得到片向/弦向彎矩與離心軸力。`geo.js` 新增懸臂梁力學:`momentAt`/`sumAt`(由外往內累加點載重與力臂,求任意半徑處的內力彎矩/軸力)與 `beamDeflection`(對曲率 M/EI 做梯形法雙重積分,固定端在葉根)。`MATERIALS`(`core.js`)補上楊氏係數 `E` 與容許應力 `sigma`(五種材料,工程手冊量級的合理預設值,非特定標準文獻值,PR 內文已註明)。
- 為什麼:ROADMAP 3 的既定下一步;不需要新的建置工具或外部程式,BEM 元素與截面性質都已經有,可以純 JS 獨立驗證。刻意把範圍限制在「設計點單一風速/尖速比、只做 HAWT」,把 IEC 停機/極端陣風工況、VAWT、疲勞、UI 結構卡片留給後續各自獨立的小步(見下方已知限制),避免一次做太大。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(19/19,新增 6 個測試:`sectionProperties` 的極端纖維距離、`solveThicknessForArea` 反推目標面積、`momentAt`/`sumAt` 對簡單 3 站手算驗證、`beamDeflection` 對懸臂梁尖端點載重 PL³/3EI 與均佈載重 wL⁴/8EI 解析解在 400 站離散化下誤差 < 2%、`bladeStructural()` 對參考轉子(3 葉 R1.5 m λd 7)的正負號/截面性質為正/彎矩沿展長遞減/根部軸力等於全葉片離心力總和/VAWT 回傳 null 的整合驗證)、`npm run build`(257 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%,因為只新增了 core.js 裡的一個獨立函式與 geo.js 的純函式,不影響既有設計/模擬路徑,回歸數值與上次一致)。桌面 1440×900 與手機 390×844 的單葉片工作區截圖(e2e 產生)確認排版正常,這次改動未觸碰 UI,預期無畫面差異。
- 已知限制(誠實列出,供下一步接續):(a) 只算設計點(單一風速/λd),沒有 IEC 小型風機 Class II 的 Vref 與停機工況;(b) 只支援 HAWT,VAWT 回傳 `null`;(c) 純翼型薄殼模型,沒有翼樑帽(spar cap),片向剛度(Ixx)相對真實葉片會被低估——這是誠實揭露的模型限制,不是 bug;(d) 疲勞完全還沒做;(e) 沒有接到任何 UI(單葉片工作區「結構」卡片)或報告,`bladeStructural()` 目前只能從 `core.js` 的 API 呼叫,使用者在介面上還看不到。
- 下一步:ROADMAP 3 ——可選其一接續(不相依,可任選):(1) 把 `bladeStructural()` 接上單葕片工作區的「結構」卡片(面積/Ixx/Iyy/彎矩/撓度沿展長圖);(2) 擴充到極端風速/停機工況(需要決定 IEC class 或直接讓使用者輸入 Vref);(3) VAWT 版本的載重估計。ROADMAP 1(Vite/ESM 遷移路線選擇)與 2(XFOIL 批次極線的容器繪圖問題)仍卡在需要使用者決定,已列在 ROADMAP.md 對應項目下,尚未收到回覆。

## 2026-09-27 — ROADMAP 3:葉片截面性質(多邊形積分)

- 做了什麼:先依序踩了 ROADMAP 1(Vite/ES modules 遷移)與 2(XFOIL 整合)的下一步,兩項都遇到本次執行修不完的環境/架構問題(細節與建議寫在 `docs/ROADMAP.md` 對應項目下的「排程踩點」)——Vite 的 HTML 進入點只認 `type="module"`,無法在不改 9 個 src 檔案全域變數寫法的前提下換建置工具;這個容器裝得起 `xfoil` 套件,但一開啟極線累積(`PACC`)就會 `Cannot open display` 或 SIGFPE 當掉,批次產生極線不可靠。兩項改動都已還原、不影響現有 dist,依 AUTOPILOT.md「何時停下來」改做下一個不相依的項目:ROADMAP 3 葉片結構分析的第一個子項「截面性質」。`src/geo.js` 新增 `polygonMoments`(封閉多邊形對原點的面積/一次矩/二次矩,自動處理任意繞向)、`aboutCentroid`(移軸到形心)、`offsetPolygon`(等厚度向內偏移,近似薄殼內壁,頂點法線平分角度做斜接)、`sectionProperties(af, chord, thickness)`(外形減內形得到殼截面,回傳實際單位的面積/形心/Ixx/Iyy/Ixy)。
- 為什麼:ROADMAP 3 第一個子項,且不需要新建置工具或外部程式,純 JS 數值方法,可以獨立驗證,風險最低。之後「載重」子項要接上 BEM 的 dT/dr、dQ/dr 與材料參數,會用到這裡的截面性質。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(14/14,新增 `tests/geo.test.mjs` 6 個測試:正方形解析解、任意繞向、正 360 邊形近似圓盤面積與 Ixx、offsetPolygon 產生的圓環面積/Ixx 對比解析解、NACA 0012 實心截面積對比文獻常數 0.6851×t/c、NACA 4412 薄殼面積對比周長×厚度估計)、`npm run build`(251 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%)。桌面 1440×900 與手機 390×844 的風洞/單葉片畫面截圖確認排版正常(這次改動未觸碰 UI,預期無畫面差異)。
- 已知限制:`sectionProperties` 只吃單一厚度與一個 `af`,還沒有材料密度/楊氏係數,也還沒接到 `G.rows`(每一站各自的厚度設定)或任何 UI;`offsetPolygon` 是簡化的頂點法線斜接偏移,對厚殼或尖銳凹角沒有處理自相交的保護。
- 下一步:ROADMAP 3 —「載重」子項(BEM dT/dr、dQ/dr + 離心力 → 根部彎矩、各截面應力、葉尖撓度),需要先決定材料參數(E、密度、容許應力)怎麼設定(每一站可調,或先給合理預設);之後才是疲勞與 UI「結構」卡片。ROADMAP 1、2 的踩點結論列在 `docs/ROADMAP.md`,需要使用者對其中列出的選項做一次決定。

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
