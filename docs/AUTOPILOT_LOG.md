# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(BEM 彎矩 + 離心力,HAWT 設計點)

- 做了什麼:上一步做完的「截面性質」是地基,這次接上 ROADMAP 3 的「載重」子項(HAWT、設計操作點,還沒做極端風速/停機工況與 VAWT)。`aero.js` 的 `bemPoint` 每一站的回傳新增 `dT`(單一葉片該環形的集中推力,N,已含 dr)與 `dQ`(集中扭矩,Nm),供結構計算把 BEM 的分布載重當作集中力使用(標準葉片元素簡化)。`geo.js` 新增四個純函式:`bendingMomentProfile`(懸臂樑集中力彎矩,從葉尖往葉根累加)、`axialForceProfile`(離心力沿展長由外往內累加成軸向拉力)、`beamCurvatureDeflection`(M/EI 梯形法雙重積分,從固定端算出斜率與撓度)、`sectionSeries`(逐站二分法找殼厚,讓 `sectionProperties` 的面積對齊質量模型已經在用的 `mat.fill`,兩者維持一致;`mat.fill≥0.98` 如木材直接用實心截面),整合成 `bladeStructure(rows, afs, elems, mat, omega)`,回傳每站彎矩/軸力/應力(彎曲+軸向)與根部彎矩、葉尖撓度、最大應力、安全係數(容許應力/最大應力)。`core.js` 的 `MATERIALS` 補上 `E`(楊氏係數,Pa)與 `sigmaAllow`(容許應力,Pa)兩個欄位(五種材料,文獻常見數量級的參考預設值);`designHAWT()` 在算完質量/慣量後,用同一個材料與設計點的 BEM 結果(`resD.elems`,即 `G.desElems`)呼叫 `GEO.bladeStructure`,存進新的 `G.structure`。
- 為什麼:`docs/AUTOPILOT_LOG.md` 上一筆記錄的既定下一步。材料參數(E、容許應力)原本需要使用者決定「每一站可調,或先給合理預設」——採用「先給合理預設」這個選項,因為只是新增 `MATERIALS` 既有五種材料的兩個欄位、不影響任何既有行為或介面,且已在 PR 內文清楚標示為參考預設值、非特定產品實測值,屬於可以之後再調整的工程假設,不是「放棄 claude.ai 相容」或「選哪個付費材料資料庫」那種需要停下來問使用者的重大取捨。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(19/19;新增:`aero.test.mjs` 驗證每站 `dT`/`dQ` 加總 ×B 等於 BEM 回傳的總推力/總轉矩;`geo.test.mjs` 新增 4 個測試——等分布載重懸臂樑的彎矩與撓度解析解(`w(L-x)^2/2`、`wL^4/(8EI)`,離散化誤差 <1%)、等線密度旋轉桿的離心力解析解(`ρω²(L²-r²)/2`)、參考轉子(3 葉 R1.5 m λ7,CLAUDE.md 表列的同一顆)算出的根部彎矩(63.6 Nm)與彎矩/軸力沿展長遞減、撓度 < 0.1R、安全係數 >1 的物理合理性檢查)、`npm run build`(256 KB)、`npm run test:e2e`(全過:3 種匯出、12 組追蹤率回歸 94–97%,本次未改控制器/模擬邏輯,回歸數值與上次一致)。桌面 1440×900 與手機 390×844 截圖確認排版正常(這次未改 UI,無畫面差異,截圖僅作回歸確認,無 pageerror)。
- 已知限制:彎曲只考慮繞截面自身弦向軸,沒有依當地扭角把彎矩向量轉到局部截面主軸(簡化,葉片扭角較大時會有誤差);沒算擺振/扭矩造成的彎曲;沒有極端風速(IEC Vref)與停機工況;沒有動態放大、疲勞、軸向拉力造成的剛化效應;VAWT 完全沒做(DMST 非定常負載與幾何跟 HAWT 差很多,需要另外設計);`G.structure` 目前只是資料,單葉片工作區還沒有「結構」卡片顯示;`E`/`sigmaAllow` 是文獻常見數量級參考值而非特定產品實測,使用者若要接近實際材料應自行核對或未來加上可調欄位。
- 下一步:ROADMAP 3 剩下的子項——極端風速(IEC Class II Vref)與停機工況下的載重、VAWT 載重估算、疲勞(雨流計數)、單葉片工作區「結構」卡片(面積/Ixx/Iyy/應力/撓度沿展長圖)與報告新增一節。ROADMAP 1、2 仍卡在需要使用者決定的岔路(Vite/ESM 遷移方案、XFOIL 在此容器環境不可靠的替代做法),詳見 `docs/ROADMAP.md` 對應項目。

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
