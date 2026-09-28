# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:載重(一)樑靜力學工具 + BEM 逐站出力

- 做了什麼:上一步「截面性質」完成後,「載重」子項需要 BEM 的 dT/dr、dQ/dr 才能算彎矩,但 `bemPoint` 原本只回傳每站的攻角/入流角/Cl/Cd 等細節,沒有暴露每站對推力/扭矩的貢獻。`src/aero.js` 的 `bemPoint` 現在在每一站的 `elems[i]` 多回傳 `dT`/`dQ`(該環帶對全部 B 支葉片合計的推力/扭矩貢獻,單位 N / N·m,即原本用來累加成 `T`/`Q` 的中間值)。`src/geo.js` 新增三個純樑靜力學函式,不涉及材料選擇或翼型細節,任何懸臂樑結構都能用:`beamMoment(stations)`(外側集中力算彎矩,`M(r_i)=Σ_{j>i} F_j·(r_j-r_i)`,揮舞向、擺振向都能用同一個函式,只是餵不同的力)、`centrifugalForce(stations, omega)`(外側集中質量在轉速下的離心軸向拉力,`N(r_i)=Σ_{j>i} m_j·ω²·r_j`)、`beamDeflection(stations)`(給定各站 M 與 EI,對曲率 M/EI 做梯形法二次數值積分,配合懸臂邊界條件(根部斜率、撓度皆為零)求沿展長撓度)。
- 為什麼:ROADMAP 3「載重」子項需要「BEM dT/dr、dQ/dr → 彎矩 → 應力/撓度」這條計算鏈,但實際串到 `G.rows`/`G.desElems` 並算出應力,還需要先決定材料參數(楊氏係數、密度、容許應力)怎麼給——這屬於 `docs/AUTOPILOT.md`「何時停下來」列的「需要使用者決定」情況(材料資料庫/預設值選擇)。因此這次先把不依賴材料選擇、純數值的樑靜力學工具做完並用解析解驗證,把「串接 `G.rows` + 材料參數 + 結構卡片」留給下一步,並在 `docs/ROADMAP.md` 列出材料參數的三個選項待使用者決定,不卡住整個 ROADMAP 3。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(19/19:既有 14 個 + `tests/aero.test.mjs` 新增的 dT/dQ 加總斷言(驗證各站 dT/dQ 加總等於轉子總推力/扭矩,容差 1e-6 相對)+ `tests/geo.test.mjs` 新增 5 個:尖端集中載重彎矩(對比 `M=P(L-r)`)、均佈載重彎矩(對比 `wL²/2`)、離心力(對比均質量懸臂 `mω²L²/2`)、尖端集中載重撓度(對比 `PL³/3EI`)、均佈載重撓度(對比 `wL⁴/8EI`),數值積分用 400–2000 站離散,容差 1–2%)、`npm run build`(253 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%,環境用 `npm pack three@0.128.0` 取 `THREE_LOCAL`、暫時 symlink 全域 `node_modules` 跑 Playwright,完成後已刪除 symlink,未提交)。桌面 1440×900 與手機 390×844 的風洞/單葉片/流場/報告畫面截圖確認排版正常(這次改動未觸碰 UI,預期無畫面差異)。
- 已知限制:`beamMoment`/`centrifugalForce`/`beamDeflection` 目前是通用樑靜力學工具,還沒有接到實際的葉片設計(`G.rows`、翼型、材料);`aero.js` 新增的 `dT`/`dQ` 是全部 B 支葉片合計,結構分析要除以 B 才是單支葉片承受的力,這個換算留給下一步做。
- 下一步:ROADMAP 3 —「載重(二)串接實際設計」,把這次的樑靜力學工具接上 `G.rows`(每站翼型/弦長 → `sectionProperties` 算 Ixx/Iyy)與 `G.desElems`(每站 dT/dQ 換算成單支葉片的揮舞力/擺振力),並決定材料參數怎麼給(`docs/ROADMAP.md` 列了三個選項,需要使用者選一個或給修改意見),之後才是極端風速/停機工況與單葉片工作區「結構」卡片。

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
