# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片結構分析 —「載重」(設計點,單一操作工況)

- 做了什麼:接續上一次「截面性質」,`src/geo.js` 新增梁力學與載重計算,全部是與 UI/`core.js` 無關的純函式:
  - `sectionProperties` 補上 `xMax`/`yMax`(外形對形心的弦向/厚度向最大距離),供彎曲應力的 `M*y/I` 用。
  - `cumulativeMoment(r, w)`:懸臂梁上每站的彎矩(該站外側所有集中載重的貢獻)。
  - `cumulativeAxialForce(r, mass, omega)`:每站外側質量在轉速 ω 下的離心軸向拉力。
  - `cantileverDeflection(r, M, EI)`:曲率 M/EI 沿展長梯形法雙重積分,求撓度分布(根部零撓度零斜率)。
  - `bladeStructuralLoads(rows, afs, desElems, opts)`:由 `AERO.bemPoint` 回傳的 `desElems`(cl/cd/phi/W)還原單一葉片(不乘葉片數 B)的揮舞向(thrust 方向)與擺振向(扭矩反作用力方向)分布力,疊加各站殼質量的離心拉力,對每一站算組合應力(彎曲 + 軸向疊加,保守估計)、安全係數,並回傳葉尖揮舞向撓度。
- 為什麼:ROADMAP 3 排定的下一子項。刻意只做「設計點單一操作工況」的力學核心,不含材料資料庫/UI 卡片/極端風速與停機工況——那些需要先決定材料參數怎麼接(每站可調 vs. 先給預設)與新增畫面,拆成下一步比較安全,能各自獨立驗證。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(19/19,新增 7 個 `tests/geo.test.mjs` 測試:NACA 0012 的 xMax/yMax 範圍、端點集中力的懸臂梁彎矩/撓度解析解、均佈載重根部彎矩解析解、均佈質量離心力解析解、以及一個真實 `designHAWT()` 設計配合代表性 GFRP 材料參數〔E=20 GPa、密度 1850 kg/m³、容許應力 100 MPa〕算出的結構結果做合理性檢查:應力/安全係數皆為正、彎矩由根到尖遞減、撓度遠小於葉片半徑)、`npm run build`(255 KB)、`npm run test:e2e`(全過:3 種匯出、12 組追蹤率回歸 95–97%,本次改動未觸碰任何既有程式路徑,回歸值與上次一致)。桌面 1440×900 與手機 390×844 的風洞/單葉片畫面截圖確認排版正常(這次改動未觸碰 UI,無畫面差異)。
- 已知限制:材料參數(E、密度、容許應力)目前只在測試裡以代表性 GFRP 預設值傳入,還沒接上 `core.js` 的 `MATERIALS`(目前只有 rho/fill,缺 E 與容許應力)或任何 UI 面板/報告;殼厚沿展長仍是單一常數(呼叫端指定),還沒有讀 `G.rows` 各站個別厚度;只算了額定風速、設計轉速這一個穩態操作點,還沒有 IEC 小型風機 Class II Vref 的極端陣風與停機(順槳/自由轉)工況,也沒有陣風動態放大;離心力採集中質量(lumped mass)近似,重力與塔影等時變效應未建模;`bladeStructuralLoads` 對彎曲/軸向應力採簡單線性疊加,並非同時發生的真實最惡劣組合。
- 下一步:(a) `core.js` 的 `MATERIALS` 補上每種材料的 E 與容許應力,把 `bladeStructuralLoads` 接上 `computePerf` 流程並在單葉片工作區新增「結構」卡片(沿展長彎矩/應力圖 + 安全係數警示);(b) 加上 IEC Class II Vref 停機/極端陣風工況與動態放大係數;(c) 之後才是疲勞(雨流計數)與報告新增結構一節。

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
