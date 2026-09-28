# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(第一版,設計點單一工況)

- 做了什麼:接續上次「截面性質」之後的下一步。`src/geo.js` 新增 `beamBending(r, dr, w, EI, r0)`:懸臂梁在分布載重 `w`(N/m,依各站 `dr` 折算成集中力)下的剪力 `V`、彎矩 `M`(逐站對所有外側集中力求和,對線性彎矩臂的部分是精確解,與站點密度無關)、以及對曲率 `M/EI` 做梯形法二次積分得到斜率與撓度(固定端 r0 處 y=y'=0)。`src/core.js` 新增 `computeStruct()`,只在 HAWT 模式執行(VAWT 設 `G.struct = null`,結構分析先不做垂直軸),在 `designHAWT()` 算完 `G.rows`/`G.afs`/`G.desElems` 之後呼叫:對每一站用 `sectionProperties(af, c, shellT)` 算 Ixx/Iyy/面積與翼型外緣到形心的距離(揮舞向用 y 方向、擺振向用 x 方向的極值),用 BEM 設計點(`h.tsr`,`h.Vd`)的 `cl`/`cd`/`W`/`phi` 算每站分布氣動力(法向→揮舞向 `qFlap`、切向→擺振向 `qEdge`),餵給 `beamBending` 分別算揮舞/擺振彎矩與撓度,再疊加離心力沿展長累加後的軸向應力,存進 `G.struct`(含 `sigma`、`sigmaMax`、`tipDeflFlap`、`tipDeflEdge`、`safetyFactor = mat.allow/sigmaMax` 等)。材料庫 `MATERIALS` 每個材料補上楊氏係數 `E` 與容許應力 `allow`(GFRP 18 GPa/80 MPa、木材 11 GPa/40 MPa、鋁 69 GPa/90 MPa、PLA 2.3 GPa/25 MPa、CFRP 70 GPa/250 MPa,皆為量級估計,不是特定材料手冊數值,PR 內文已註明)。新增 `S.hawt.shellT`(預設殼厚 3 mm),暫時沒有 UI 控制項(下一步再加)。
- 為什麼:ROADMAP 3 第二個子項,銜接上次的截面性質函式,先做「設計點單一工況」這個最小可驗證版本(極端風速/停機工況、逐站殼厚與 UI 卡片留給下一步),符合 AUTOPILOT「一次一小步」的要求。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(18/18,新增 `tests/geo.test.mjs` 2 個 `beamBending` 測試——均布載重懸臂梁在細網格下精確符合解析解 `M0=w0L²/2`、`tipDefl=w0L⁴/8EI`(誤差 <0.1%),在實際 16 站網格下誤差 <5%——與 `tests/core.test.mjs` 2 個測試,檢查參考轉子(3 葉 R1.5 m λd 7)`G.struct` 數值有限且非負、根部揮舞彎矩 ≥ 葉尖、撓度遠小於半徑(實際算出約 28 mm,半徑 1.5 m 的 1.9%)、安全係數 >1(實際約 7.1,預設 GFRP 3 mm 殼),以及 VAWT 模式下 `G.struct` 為 `null`)、`npm run build`(256 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 94–98%,此次改動未觸碰控制器邏輯)。桌面 1440×900 與手機 390×844 的風洞/單葉片畫面截圖確認排版正常(這次改動沒有動 UI,預期無畫面差異,實際截圖也確認如此)。
- 已知限制:目前只算「設計點」這一個工況(對應 `h.tsr`/`h.Vd`),還沒有極端風速(IEC Class II Vref)或停機工況;揮舞/擺振彎矩用絕對值直接相加,沒有考慮兩軸夾角或組合應力的正確疊加方式;殼厚 `S.hawt.shellT` 全展長均一,還沒有逐站覆寫;`MATERIALS` 的 `E`/`allow` 是粗略量級預設,不是材料手冊數值,需要使用者在正式設計前自行核對;質量計算(`fill` 填充率模型,`designHAWT` 裡原有的 `mat.rho*mat.fill*airfoilArea*c²*dr`)與這次的結構分析(`sectionProperties` 薄殼模型)用的是兩套不同的截面積假設,尚未統一;完全沒有 UI 呈現(`G.struct` 目前只有 Node 測試在讀)。
- 下一步:ROADMAP 3 —「載重第二版」(極端風速/停機工況、逐站殼厚覆寫)與「單葉片工作區結構卡片」(把 `G.struct` 畫成沿展長的 Ixx/Iyy/應力/撓度圖,材料與殼厚 UI 控制項);之後才是「疲勞」子項。ROADMAP 1、2 的踩點結論(Vite 遷移路線、XFOIL 容器繪圖模組當掉)仍待使用者對其中列出的選項做一次決定。

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
