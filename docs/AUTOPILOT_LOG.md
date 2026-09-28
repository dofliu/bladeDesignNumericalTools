# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 4:切出風速與重新啟動邏輯

- 做了什麼:ROADMAP 3 的「載重」子項需要先決定材料參數(E、密度、容許應力)怎麼設定,屬於需要使用者決定的項目,依 AUTOPILOT.md 規則跳到下一個不相依的項目——ROADMAP 4「額定以上控制與保護狀態機」的第一個子項:切出風速與重新啟動邏輯。`src/core.js`:`S.load` 新增 `cutout`(預設開啟)、`Vcutout`(預設 22 m/s)、`Vrestart`(預設 18 m/s);`simStep` 新增 20 秒時間常數的滑動平均風速 `SIM.VslowAvg`(與既有控制迴路用的 1 秒平均 `SIM.Vmeas` 分開,不受陣風/瞬時紊流擾動),平均風速超過切出風速就把 `SIM.cutoutLatch` 設為 true 併入既有 `brake` 條件停機煞車,直到平均風速降回重新啟動風速以下才解除,解除後控制器照現有邏輯自行從靜止重新啟動(與既有啟動測試路徑相同,不需額外重置)。`src/ui.js` 保護分組新增開關與兩個滑桿(僅開啟時顯示),並把 `resetSim`/`spinUp`/`assistStart`/`setMode` 等原本會清除超速保護 `SIM.latch` 的地方一併清除新的 `SIM.cutoutLatch` 與同步 `SIM.VslowAvg`;`src/report.js` 自動測試的 `reset()` 也一併清除,避免跨測試階段殘留誤判。
- 為什麼:不需要材料資料庫或其他需使用者決定的輸入,純粹是控制邏輯,可以獨立在 Node 驗證,風險低;也是 ROADMAP 4 驗收項「16–25 m/s 不再反覆跳脫」的第一塊拼圖(furling、變槳仍待後續執行)。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(16/16,新增 `tests/core.test.mjs` 2 個測試:定常 26 m/s 風速下只切出一次且維持停機到 90 秒;切出後把風速降到 8 m/s,150 秒內平均風速降到重新啟動風速以下、轉子自行重新加速)、`npm run build`(252 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 94–97%,桌面/手機 4 個工作區截圖無錯誤)。另外用 Playwright 手動截圖桌面 1440×900 與手機 390×844 的「負載」設定面板(捲到保護分組),確認新的切出風速開關與滑桿排版正常、不破版(手機版也正常收合)。
- 已知限制:目前只有切出/重新啟動,沒有側偏收尾(furling)與變槳,定槳距轉子在額定以上仍只能靠既有的軟失速降轉速,若平均風速停在切出與重新啟動門檻之間(未達真正切出)還是可能反覆觸發原本的超速/超功率保護;ROADMAP 4 的驗收(16–25 m/s 不再反覆跳脫)要等 furling/變槳做完才算完整。切出/重新啟動風速門檻目前是全域常數(不隨海拔、空氣密度等調整),20 秒平均是簡化值,不是 IEC 標準的 10 分鐘平均。
- 下一步:ROADMAP 4 — 側偏收尾(furling)模型與變槳選項;或回頭處理 ROADMAP 3 的「載重」子項(仍需使用者對材料參數/資料庫做一次決定,見 ROADMAP 1、2、3 已列出的待決策選項)。

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
