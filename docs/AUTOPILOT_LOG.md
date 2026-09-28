# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(HAWT,設計風速靜態彎矩/軸力/撓度)

- 做了什麼:接續上一次完成的截面性質,做 ROADMAP 3「載重」子項的第一步——HAWT、設計風速下的靜態結構分析。`src/geo.js` 新增 `bladeStructural(rows, afs, desElems, mat, omega, rhoAir, Rhub)`:對每個 BEM 截面(`rows[i]` 的 `r/dr/c` 與 `desElems[i]` 的 `phi/cl/cd/W`)算出揮舞方向(垂直轉子面,推力方向)分布氣動力,以離散點載荷方式向根部積分得到各截面彎矩,並用每站質量(沿用與質量估計相同的 `mat.fill` 縮放實心翼型剖面近似)乘 `omega²r` 積分得到離心軸向力;再用 `M·yMax/Ixx` 與 `N/area` 算彎曲應力與軸向應力(保守取同側疊加)與安全係數,以及用歐拉-伯努利梁方程(`M/EI` 二次梯形積分,葉根固定)算葉尖撓度。`src/core.js` 的 `MATERIALS` 新增 `E`(楊氏係數)與 `sigmaAllow`(容許應力,已含保守安全係數)兩欄,五種材料皆給常見文獻量級預設值(玻纖 20 GPa/80 MPa、木材 10 GPa/40 MPa、鋁 69 GPa/110 MPa、PLA 1 GPa/15 MPa、碳纖 60 GPa/200 MPa),非特定產品實測。`designHAWT()` 尾端呼叫並寫入 `G.struct`;`designVAWT()` 明確設 `G.struct = null`(VAWT 離心力沿半徑向外,不是軸向拉伸,結構模型需另外做,已記錄為下一子項)。
- 為什麼:上次盤點過 ROADMAP 1(Vite/ESM 遷移,沒有零風險中間態,需使用者選一個選項)與 ROADMAP 2(XFOIL,容器內 PACC 批次極線會 crash)都卡在需要使用者決定或環境限制,依 AUTOPILOT.md「何時停下來」規則已經跳過,這兩項狀態沒有變化,不重複踩點。ROADMAP 3 的截面性質已完成,載重是接下來最自然的一步,且不需要新的外部工具或使用者決定——材料楊氏係數/容許應力雖然原本的「下一步」筆記說需要決定,但比照這個專案既有的做法(例如極曲線半經驗模型、材料密度/填充係數都是先給合理預設值、可日後開放 UI 覆寫),直接採用常見文獻量級預設值並在程式與文件中清楚註明是近似值,不阻塞進度。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(16/16,新增 `tests/loads.test.mjs` 2 個測試:等分布載重懸臂梁的根部彎矩 wL²/2 與葉尖撓度 wL⁴/8EI 解析解、等線質量離心力積分 ω²(R²−Rhub²)/2 解析解,皆與 BEM/desElems 的實際數值無關,只驗證 `bladeStructural` 本身的樑理論與積分邏輯)、`npm run build`(255 KB)、`npm run test:e2e`(全過:3 種匯出、HAWT/VAWT × po/tsr/ot × 6/9 m/s 追蹤率 92–97%)。桌面 1440×900 與手機 390×844 的風洞畫面截圖(e2e 產生)確認排版正常,本次未觸碰 UI,無畫面差異。
- 已知限制:目前用 `mat.fill` 縮放實心翼型剖面近似截面積/慣性矩,不是真正殼厚模型(`sectionProperties` 已支援真實殼厚,但還沒接上每站厚度設定,兩者是獨立近似、彼此不保證一致);只算設計風速(`h.Vd`)的穩態彎矩,還沒有極端風速/停機工況;只算揮舞方向彎矩,擺振方向彎矩與離心力和揮舞彎矩的耦合暫未考慮;葉根截面剛度用最內側 BEM 站位近似,沒有模擬實際葉根接頭;`G.struct` 目前沒有任何 UI 顯示,只是內部資料,供之後的「結構」卡片與報告使用。
- 下一步:VAWT 的結構模型(離心力方向不同)、極端風速/停機工況、疲勞(雨流計數)、單葉片工作區「結構」卡片與報告新增一節。ROADMAP 1、2 仍在等使用者對已列出的選項做一次決定,詳見 `docs/ROADMAP.md` 對應項目。

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
