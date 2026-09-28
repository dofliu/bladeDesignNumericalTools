# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(設計點,水平軸根部彎矩/應力/撓度)

- 做了什麼:ROADMAP 3「葉片結構分析」的第二個子項。`src/geo.js` 新增兩個通用懸臂梁工具:`beamInternalLoads(stations)`(點力近似下,由外側往根部累加剪力 V 與彎矩 M)與 `beamDeflection(stations)`(曲率 M/EI 沿展長做兩次梯形積分,從根部固定端算出斜率與撓度)。`src/core.js` 新增 `bladeSpanwiseLoads(rows, afs, mat, elems, omega, rhoAir, Rhub)`:取設計點 BEM 結果(`G.desElems`,已有的 `cl/cd/phi/W`)算每一站揮舞向(法向)與擺振向(切向)的分布氣動力、用葉片質量分布算離心力,分別用上面的梁工具積分成彎矩與軸力,再用既有的 `GEO.sectionProperties` 算出的截面幾何(面積、Ixx/Iyy、以形心量測的極端纖維距離)換算應力與安全係數(`容許應力/總應力`),並對揮舞向彎矩做撓度積分;結果存在 `G.struct`,在 `designHAWT()` 尾端自動算好。`MATERIALS`(既有的 5 種材料,UI 上原本就可選)補上 `E`(楊氏係數)與 `allow`(容許應力,已含安全/疲勞餘裕)兩個文獻典型值欄位——沒有另外做「材料資料庫」的選型決策,只是把既有可選材料的物理性質補齊。
- 為什麼:ROADMAP 3 排定順序的下一步,且不需要新建置工具或外部程式;沿用上次(截面性質)的做法,先做可獨立驗證的計算核心,UI「結構」卡片與 VAWT/極端風速工況留給後續步驟(見下方「已知限制」)。殼厚選擇「固定 2% 弦長(實心材料退回實心截面)」而非再開一輪「材料資料庫」式的使用者決定——`docs/AUTOPILOT.md`「何時停下來」把「材料資料庫選型」列為需要使用者決定的例子,但這裡只是替換既有材料清單補兩個典型物理量,不是新增/選擇資料庫,判斷不需要為此停下來開票。
- 驗證:
  ```
  npm run check   → 9 個檔案全過
  npm test        → 18/18(新增 tests/geo.test.mjs 2 個懸臂梁解析解測試〔點載重 P L^3/(3EI)、均布載重 w L^4/(8EI)〕
                     + tests/core.test.mjs 2 個結構回歸測試〔G.struct 根部彎矩為正/沿展長遞減/安全係數為正有限/
                     撓度遠小於半徑;CFRP 撓度小於 PLA〕)
  npm run build   → dist/wind-turbine-designer.html 256 KB
  npm run test:e2e→ 全過(3 種匯出、HAWT/VAWT × po/tsr/ot × 6/9 m/s 追蹤率 92–97%)
  ```
  桌面 1440×900 與手機 390×844 的風洞畫面截圖(`tests/output/*.png`)確認排版正常(本次未觸碰 UI,預期無畫面差異)。
- 已知限制:殼厚是固定 2% 弦長常數(`STRUCT_TOC`),沒有依站或依材料調整;應力用揮舞向、擺振向、離心軸向三個應力的絕對值直接相加(保守估計,沒有考慮同一截面上這三者實際上不一定同相位疊加);撓度只算揮舞向(擺振向撓度未積分,只算了彎矩本身);只算設計風速這一個運轉點,還沒有 IEC 小型風機 Class II Vref 等極端風速與停機工況;垂直軸(VAWT)完全還沒接上這套結構模型;`G.struct` 目前沒有任何 UI 顯示(單葉片工作區「結構」卡片留給下一步)。
- 下一步:單葉片工作區新增「結構」卡片(面積/Ixx/Iyy/彎矩/應力/撓度沿展長圖 + 安全係數低於門檻時的警告),殼厚換成可依 `G.rows` 逐站調整的介面;之後是極端風速/停機工況、VAWT 結構模型,最後是疲勞估計(雨流計數)。

## 2026-09-27 — ROADMAP 3:葉片截面性質(多邊形積分)
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
