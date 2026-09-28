# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-27 — ROADMAP 3:葉片載重(BEM 設計點 + 離心力 → 根部彎矩/應力/撓度)

- 做了什麼:接續上一輪完成的「截面性質」,做 ROADMAP 3 的第二個子項「載重」。`src/core.js` 的 `MATERIALS` 補上 `E`(楊氏係數)、`sigmaAllow`(容許應力)、`tRatio`(殼厚/弦長比,用來餵給 `sectionProperties`,實心材料如木材/PLA 給一個會讓外形-內形偏移後內形消失、退化成實心截面的大比例)——目前是查文獻/工程經驗給的合理估計值,不是特定材料的測試數據。`src/geo.js` 新增 `beamResponse(rows, secs, E, load, rhoMat, omega)`:每站的氣動負載(來自 `designHAWT()` 已算好的 BEM 設計點 `G.desElems`,把 cl/cd/W/phi 換算成揮舞向 qN、擺振向 qT 兩個方向的分布力,N/m)當成集中力(像既有 BEM annulus 的處理方式一樣用 `dr` 做離散化)疊加,得到沿展長的彎矩分布,再用梯形法對曲率 M/(E·I) 積分兩次得到斜率與撓度(從根部固定端開始積分);另外用各站的殼截面積(`sectionProperties` 算出的真實面積,不是既有質量估算用的 `fill` 比例)乘上材料密度、ω²、r,算出離心軸向力沿展長的分布。`src/core.js` 新增 `computeBladeStructure(omega)`,在 `designHAWT()` 設計完成、`G.desElems` 算好之後立刻執行,對每一站呼叫 `GEO.sectionProperties` 建立殼截面性質,結合上面的負載算出 `G.struct`(彎矩、離心軸向力、撓度、每站應力估計、最大應力、對容許應力的安全係數)——這次先只讓資料算出來、存進 `G.struct`,還沒有接任何 UI 或報告(ROADMAP 該項的「單葉片工作區新增結構卡片」是下一個獨立子項,留給下一次執行)。
- 為什麼:ROADMAP 3 的既定下一步;有了上一輪的 `sectionProperties`,加上既有的 BEM 設計點與離心力公式,可以先把「彎矩/應力/撓度怎麼算」這個核心數值方法做出來並用解析解驗證,UI 呈現是完全獨立、風險不同的另一塊,分開做比較安全。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(17/17,新增 `tests/geo.test.mjs` 2 個測試:等剖面均布載重懸臂梁比對 M(root)=wL²/2 與撓度=wL⁴/(8EI) 的解析解、等剖面旋轉桿件比對根部離心軸向力 N(0)=μω²L²/2 的解析解;新增 `tests/core.test.mjs` 1 個測試:預設 3 葉 R1.5 λd7 設計跑完 `designHAWT()` 後 `G.struct` 各站截面性質為正、根部彎矩非零、葉尖撓度為正且遠小於葉片半徑、`sigmaMax` 落在物理合理量級)、`npm run build`(256 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–98%,因為這次改動完全沒碰 UI/模擬/控制器邏輯,只是在既有設計流程尾端多算一份結構資料)。桌面 1440×900 與手機 390×844 截圖確認排版與前一輪一致(預期無畫面差異,`G.struct` 還沒有任何畫面在讀)。
- 已知限制:只做 HAWT(VAWT 的載重與截面性質留待之後);只算穩態設計操作點,還沒有極端風速(IEC 小型風機 Class II 的 Vref)與停機工況;忽略重力(邊緣向 1P 循環彎矩的主要來源之一)、預掃/預錐角、揮舞—擺振彈性耦合;`tRatio` 是全展長固定比例(乘上各站當地弦長),還沒有每站各自可調的厚度/材料設定(這是之後 UI「結構」卡片要接上的);離散化把根部邊界取在第一個截面站(BEM annulus 中心),不是精確在輪轂 `Rhub` 處,會讓根部彎矩略微低估;combined 應力用揮舞應力絕對值 + 擺振應力絕對值 + 軸向應力直接相加,是保守的上界估計而非精確的雙軸彎曲+軸力複合應力。
- 下一步:ROADMAP 3 — 「單葉片工作區新增結構卡片」(面積/Ixx/Iyy/彎矩/應力/撓度沿展長圖)+ 報告新增一節,把已經算好的 `G.struct` 呈現出來;之後才是疲勞分析。ROADMAP 1、2 的踩點結論(Vite/ESM 遷移的兩難、xfoil 在此容器裡開 PACC 會當掉)仍列在 `docs/ROADMAP.md`,需要使用者對其中列出的選項做一次決定,這兩項目前排定為「跳過等決定」。

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
