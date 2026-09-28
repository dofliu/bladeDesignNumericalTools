# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-27 — ROADMAP 3:葉片結構分析「載重」子項(水平軸,設計點穩態)

- 做了什麼:先確認 repo 裡沒有未合併的 `[autopilot]` PR,依規則接著做 ROADMAP 3(葉片結構分析)已完成「截面性質」之後的下一個子項「載重」。`src/geo.js` 新增 `solveShellThickness(af, chord, targetArea)`,由目標截面積反解對應的殼厚。開發過程中發現 `sectionProperties` 的殼厚偏移演算法只在 `offsetPolygon` 自相交之前的一段範圍內,area(t) 才是嚴格遞增且 Ixx/Iyy 為正;超過該範圍(仍遠小於 t = chord 的實心界線)area 會先回跌、Ixx/Iyy 甚至可能因自相交多邊形的 shoelace 加總算出負值,才在 t = chord 附近由 `sectionProperties` 自身的判斷式收斂回實心值。原本以 `t = chord` 為二分搜尋上界會落入這段不穩定區間;改成先用粗掃描找出「area 仍遞增且 Ixx、Iyy 皆為正」的安全上界,再對該安全區間二分搜尋。`src/core.js` 新增 `computeBladeLoads()`:取設計點(`h.Vd`、`h.tsr`)的 `G.desElems`,由每一截面的 cl/cd/φ/W 算推力與切向分布力,由葉尖往輪轂積分成揮舞(flap)與擺振(edge)彎矩;殼厚由目標截面積反解,目標面積沿用 `designHAWT` 既有的質量模型(`mat.fill × airfoilArea × c²`),確保結構分析與 `G.bladeMass` 的質量分布一致;離心力沿同一質量分布積分成軸向拉力;合成應力取彎曲應力(絕對值疊加,忽略扭轉造成主軸旋轉的簡化)加離心軸向應力;彎矩/EI 沿展長雙重積分(梯形法,根部零位移零斜率)得揮舞/擺振葉尖撓度。`MATERIALS` 補上概估的楊氏模數 `E` 與容許應力 `sigAllow`(量級估計值,非特定材料資料表)。只實作水平軸(VAWT 支撐路徑不同,`designVAWT()` 直接把 `G.struct` 設為 null),且只算設計點穩態,不含極端風速停機工況與疲勞。UI:`src/bench.js` 新增 `drawStruct()` 與「結構概估」卡片(合成應力 vs 容許應力圖 + 根部彎矩/離心力/最大應力/安全係數/葉尖撓度摘要),水平軸單葉片工作區可見;`src/report.js` 在「葉片幾何」段落後新增對應小節,並在「模型說明與限制」補充簡化事項的誠實說明。
- 為什麼:ROADMAP 3 排在「截面性質」之後的既定下一步,且不需要新建置工具或外部程式;過程中發現的殼厚反解不穩定區間如果不修,會讓某些材料(尤其填充率高、接近實心的 wood)算出物理上不合理的應力(見下方測試發現的迴歸)。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(18/18,新增 `tests/struct.test.mjs` 3 個測試 —— 均布假想載重下根部彎矩、葉尖撓度對比懸臂梁解析解在 2% 內;VAWT 模式或缺設計資料時 `G.struct` 為 null;掃描全部 5 種材料驗證面積/Ixx/Iyy 恆正、應力有限,此測試曾在開發過程中抓到 wood 材料因浮點誤差落入不穩定區間、算出負 Iyy 導致應力暴衝到 54 萬 MPa 的迴歸,修正 `solveShellThickness` 的安全上界搜尋後全部通過;`tests/geo.test.mjs` 新增 `solveShellThickness` 往返驗證)、`npm run build`(259 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%)。另外用 Playwright 對 dist 手動截圖桌面 1440×900 與手機 390×844 的單葉片工作區(捲動到「結構概估」卡片),確認新卡片版面正常、無破版;並在瀏覽器內產生一次完整報告,確認新增的結構概估小節能正確產生且無 JS 錯誤。
- 已知限制:僅支援水平軸;僅計算設計點穩態工況,未涵蓋停機/極端風速(IEC Vref)與疲勞;合成應力用絕對值疊加彎曲與軸向應力(保守但非精確相位疊加),且忽略扭角造成的結構主軸旋轉(以翼型弦向/厚度方向近似擺振/揮舞軸);材料楊氏模數與容許應力為概估量級值,非特定資料表數值,不能直接用於實際製造判斷。
- 下一步:ROADMAP 3 —「疲勞」(以紊流測試時間序列雨流計數估計根部疲勞壽命)與「極端風速/停機工況」;或依 ROADMAP 1、2 之前踩點記錄的選項請使用者決定後再繼續(Vite/ESM 遷移的範圍取捨、XFOIL 批次產生極線的環境問題)。

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
