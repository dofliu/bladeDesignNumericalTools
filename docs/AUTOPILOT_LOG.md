# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片應力與撓度

- 做了什麼:承接上一筆「分布載重與彎矩」(`bladeLoads`/`G.rows.{Mflap,Medge,Fax}`),完成 ROADMAP 3「載重」子項的第二部分——應力與撓度,採用上一筆 PR 內文建議的做法。`src/geo.js` 新增 `equivalentThickness(af, chord, targetArea)`(對 `sectionProperties(af,chord,t).area` 做二分搜尋反解殼厚 `t`,呼叫端傳入 `MATERIALS[x].fill * airfoilArea(af) * c²` 當目標面積,對齊既有質量模型,不新增使用者可調欄位)、`sectionProperties` 補上 `yMax`/`xMax`(形心到外緣的最大距離,彎曲應力算式要用)、`beamDeflection(rows, M, EI)`(彎矩/EI 曲率由固定端(根部)往葉尖梯形積分兩次)。`src/core.js` 的 `bladeLoads` 延伸:對每一站反解等效殼厚 → `sectionProperties` 取得 Ixx/Iyy → 算揮舞彎曲應力(`Mflap·yMax/Ixx`)、擺振彎曲應力(`Medge·xMax/Iyy`)、離心軸向應力(`Fax/area`),三者絕對值保守相加成 `x.stress`,安全係數 `x.safety = mat.allow/x.stress`;揮舞撓度 `x.defl` 用 `beamDeflection` 積分。`MATERIALS` 補上楊氏模數 `E`、容許應力 `allow`(合理文獻預設值:玻纖 20 GPa/100 MPa、木材 11 GPa/40 MPa、鋁 69 GPa/110 MPa、PLA 2.3 GPa/20 MPa、碳纖 70 GPa/250 MPa)。`G.loads` 新增 `tipDefl`、`minSafety`。
- 中途插曲:排程開始後(已 fetch 最新 main、讀完文件)才發現另一個並行的自動開發工作階段在同一時段也選了 ROADMAP 3「載重」子項,搶先把「分布載重與彎矩」合併成 #4,導致本次原本獨立做的彎矩/離心力實作(放在 `geo.js` 的 `beamMoment`/`axialForce`)與 #4 的 `aero.js` `cumulativeMoment`/`cumulativeOutboard` + `core.js` `bladeLoads` 重複且與新 `main` 衝突。已把那個衝突的 PR(#21)關閉且不合併(留言說明原因),重新從新 `main` 出發,改成本篇「應力與撓度」——正好是 #4 PR 內文本來就留下的下一步建議,避免了重工。
- 為什麼:「應力與撓度」是 #4 明確列出的下一步,沿用它已經驗證過的 `Mflap/Medge/Fax` 與建議的等效殼厚做法,是風險最小、與既有實作最一致的延伸;不採用先前(已放棄)的獨立幾何函式版本,避免同一件事在 `aero.js`/`geo.js` 兩處各有一套彼此不相容的懸臂梁力學。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(21/21,新增 6 個:`tests/geo.test.mjs` 的 `yMax`/`xMax` 外緣距離驗證、`equivalentThickness` 面積回代驗證、均布載重與懸臂梁末端集中力兩個解析解驗證 `beamDeflection`〔w·L⁴/8EI、P·L³/3EI〕;`tests/core.test.mjs` 新增「HAWT 設計點應力/撓度/安全係數沿展長合理性」,檢查撓度根部固定為 0 且單調遞增、應力非負、安全係數處處為正〔葉尖因彎矩/軸力剛好為 0 而安全係數為 Infinity,是預期行為,已排除在「必須有限」的斷言外,只要求根部有限〕)、`npm run build`(257 KB)、離線 `npm run test:e2e`(`THREE_LOCAL`/`CHROME_PATH` 見下方環境備忘,全過,3 種匯出、12 組追蹤率回歸 92–97%)。桌面 1440×900 與手機 390×844 截圖確認排版正常(未改動 UI,預期且實際無畫面差異)。
- 已知限制:與 #4 相同——只有 HAWT、只在設計風速/設計轉速這一個穩態工況,還沒有極端風速(IEC Class II Vref)與停機工況;應力採三分量絕對值直接相加的保守估計,沒有考慮相位對齊或工況組合係數;殼厚是由 `fill` 反解的單一等效值,不是使用者可調的逐站厚度;還沒有任何 UI 或報告顯示這些數字(單葉片工作區的「結構」卡片留給下一步);VAWT 沒有結構模型。
- 下一步:ROADMAP 3 —「極端風速(IEC Class II Vref)與停機工況的載重」,或直接跳到「單葉片工作區新增結構卡片」(先把現有 `G.rows.{stress,safety,defl}` 畫成沿展長圖,材料/厚度可調留到之後),兩者皆可獨立驗證,下次執行擇一;之後才是疲勞分析。ROADMAP 1(Vite/ESM 遷移)、2(XFOIL 整合)仍卡在需要使用者決定,見 `docs/ROADMAP.md` 對應項目的「排程踩點」。

## 2026-09-28 — ROADMAP 4:切出風速與重新啟動邏輯

- 做了什麼:啟動時 main 上還沒有未完成的 `[autopilot]` PR,ROADMAP 3「載重」子項當時看起來需要先決定材料參數(E、密度、容許應力)才能繼續,依 AUTOPILOT.md「何時停下來」跳到下一個不相依項目:ROADMAP 4 額定以上控制與保護狀態機的第一個子步驟——切出風速與重新啟動邏輯。開發期間另一次排程執行已完成並合併了下面「葉片分布載重與彎矩」那一筆(見下),與本次改動的檔案不重疊,合併 main 後未發生程式衝突。`src/core.js` 的 `S.load` 新增 `cutOut`(預設 `false`,不影響既有行為)、`vCutOut`(切出風速,預設 20 m/s)、`vRestart`(重啟風速,預設 15 m/s);`simStep()` 用既有的 1 秒低通平均風速 `SIM.Vmeas` 判斷,超過 `vCutOut` 即設定 `SIM.cutout = true` 並併入既有煞車閂鎖(`brake = SIM.brake || SIM.latch || SIM.cutout`)強制停機,待風速降到 `vRestart` 以下才解除;兩個閾值不同形成遲滯,避免風速在門檻附近擺盪造成反覆停機/重啟。`src/ui.js` 負載面板「保護」群組新增啟用開關與兩個風速滑桿(僅啟用時顯示)、狀態列區分「切出風速停機中」與「超速保護煞車中」,所有既有的模擬重置點(`resetSim`/`spinUp`/`assistStart`/`setMode`/報告測試的 `reset`)都一併清除 `SIM.cutout`。`src/report.js` 在「負載」條件加入切出/重啟風速設定值,並把「多次觸發過速/過功率保護」的結論文字改成依 `S.load.cutOut` 是否啟用給出對應說明。
- 為什麼:這是 ROADMAP 4 中風險最低、可獨立驗證的第一步,直接對應 `docs/CLAUDE.md`/報告中原本就記錄的已知限制(水平軸 14 m/s 以上發電機壓不住固定槳距轉子、反覆觸發保護),且不需要新的材料參數決策或幾何/偏航模型擴充(變槳、側偏收尾留待後續)。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(合併 main 後 17/17,含新增的 `tests/core.test.mjs` 切出/重啟遲滯測試:20 m/s 高風速下確認 `SIM.cutout` 觸發、轉速降到近乎靜止且不再重複觸發超速保護,風速降到 8 m/s 後確認 `SIM.cutout` 解除且轉子重新加速)、`npm run build`、`npm run test:e2e`(全過,3 種匯出、追蹤率回歸維持 94–97%,此功能預設關閉不影響既有回歸)。另外用 Playwright 截圖桌面 1440×900 與手機 390×844 的「負載」設定面板(切出風速選項開啟前後),確認新控制項排版正常、無破版。
- 已知限制:目前只有「停機 → 等待風速下降 → 重啟」的邏輯,沒有變槳或側偏收尾的物理模型;自動化報告的功率曲線測試仍只到 15 m/s,尚未加入涵蓋切出風速以上區間的專門測試(驗收項「報告功率曲線呈現平台與切出」還沒做到);切出/重啟閾值的預設值(20/15 m/s)是通用設定,未針對特定機型或 IEC 風速等級調整。
- 下一步:ROADMAP 4 的「變槳選項」或「側偏收尾模型」。ROADMAP 3 的下一步請見上面「葉片應力與撓度」那一筆的「下一步」。ROADMAP 1、2 的踩點結論仍列在 `docs/ROADMAP.md` 對應項目下,需要使用者選擇方向。

## 2026-09-28 — ROADMAP 3:葉片分布載重與彎矩

- 做了什麼:承接上一筆的「截面性質」,做 ROADMAP 3「載重」子項的第一部分——分布載重與彎矩(應力/撓度留給下一步,見下方「已知限制」)。`src/aero.js` 新增兩個通用的離散懸臂梁求和函式:`cumulativeOutboard(r, v)`(每站外側各集中量的和,離散版剪力/軸力)、`cumulativeMoment(r, F)`(每站外側各集中力對該站的彎矩和,離散版懸臂彎矩)。`src/core.js` 的 `designHAWT()` 新增 `bladeLoads(rows, elems, omega, rho)`:用設計點 BEM 解(`resD.elems` 的 `phi/cl/cd/W`)算出每一站揮舞向(flapwise,升力沿來流法向分量,類似推力)與擺振向(edgewise,切向分量,類似扭矩)的分布氣動力,呼叫上面的通用函式沿展長累加成揮舞/擺振彎矩;離心軸力則重用質量/慣量迴圈已經算出的每站質量(新存成 `x.dm`)乘上 ω²r 後累加。結果寫回 `G.rows[i].{dFz,dFy,Mflap,Medge,Fax}` 與 `G.loads = {omega,MflapRoot,MedgeRoot,FaxRoot}`;`designVAWT()` 設 `G.loads=null`(垂直軸的結構模型是之後的事,先不要讓畫面誤用上一次 HAWT 算出的殘留值)。
- 為什麼:「截面性質」(面積/Ixx/Iyy)與「載重」(彎矩/軸力)是彼此獨立、都可以單獨驗證的子步驟,先把載重算對、用解析解驗證離散求和的邏輯,下一步才把兩者接起來算應力(M×c/I)與撓度(∫∫M/EI),這樣每一步的 diff 都小,且出錯時容易定位是幾何積分還是載重積分的問題。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(16/16,新增 2 個:`tests/aero.test.mjs` 用等分布載重的懸臂梁解析解 V(x)=w(L-x)、M(x)=w(L-x)²/2 驗證 `cumulativeOutboard`/`cumulativeMoment`〔400 站離散化,根部誤差 <1%〕;`tests/core.test.mjs` 驗證 `designHAWT()` 之後 `G.loads` 存在、揮舞根部彎矩與離心根部軸力為正、且沿展長單調遞減到接近 0)、`npm run build`(254 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%)。桌面 1440×900 與手機 390×844 截圖確認排版正常(這次未改動 UI,預期無畫面差異,截圖僅作回歸確認)。
- 已知限制:目前只有 HAWT、只在設計風速/設計轉速這一個穩態工況;還沒有應力(需要接上 `sectionProperties` 的 Ixx/Iyy 與一個殼厚決定方式,建議見 `docs/ROADMAP.md`)、撓度、極端風速/停機工況,也還沒有任何 UI 或報告顯示(和上一步「截面性質」一樣,先把算法做對並用測試釘住)。
- 下一步:ROADMAP 3 —「應力與撓度」:結合 `sectionProperties(af, chord, thickness)` 算各站應力(彎矩×截面外緣距形心距離/Ixx,加上離心軸力/面積)與材料安全係數,厚度建議用 `MATERIALS[x].fill` 反解等效殼厚(讓 `sectionProperties` 算出的面積對齊質量模型已經在用的 `fill*airfoilArea*c²`,不必新增使用者可調欄位);再用 M/EI 做歐拉-伯努利二次積分算葉尖撓度,與懸臂梁解析解比對。之後才是疲勞與 UI「結構」卡片。ROADMAP 1(Vite/ESM 遷移)、2(XFOIL 整合)的踩點結論仍列在 `docs/ROADMAP.md`,需要使用者對其中選項做一次決定。

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
