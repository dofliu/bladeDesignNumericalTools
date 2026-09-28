# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(第一步,HAWT 穩態設計點)

- 做了什麼:接續上一次「截面性質」的成果,實作 ROADMAP 3 第二個子項「載重」的第一步。`src/core.js` 新增 `structuralHAWT()`,在 `designHAWT()` 算完設計點 BEM 解(`resD.elems`,原本就用來顯示攻角)之後呼叫:把每一站的 `cl`/`cd`/`phi`/`W` 換算成單一葉片的流向(flap)與切向(edge)分力,配合新的 `shellThickness(c)`(殼厚公式,取弦長的 1.2%,夾在 0.8–6 mm)呼叫既有的 `GEO.sectionProperties` 得到各站截面積/Ixx/Iyy,再由葉尖往根部累加彎矩與離心軸力(離心力用既有質量迴圈同步存下的 `rows[i].dm`),算出各站彎曲+軸向應力、對容許應力的安全係數 `SF`,以及用彎矩/EI 沿展長二次積分得到的葉尖撓度,整包存進 `G.struct`。`MATERIALS`(`gfrp`/`wood`/`alu`/`pla`/`cfrp`)新增楊氏係數 `E` 與容許應力 `sigma`,工程量級估計值(非特定產品試片數據),在程式註解中說明。`GEO` 現在也是 `core.js` 用到的全域(瀏覽器端建置順序本來就是 geo.js 先於 core.js,不用改建置腳本),`tests/core.test.mjs` 對應補上 `global.GEO = require('../src/geo.js')`。
- 為什麼:是 ROADMAP 3「載重」子項排定的下一步,且截面性質那一步已經把 `GEO.sectionProperties` 準備好;先做 HAWT 在既有設計點(穩態、不含極端陣風/停機)的彎矩/應力/撓度,是這個子項裡最小、可獨立驗證、且不需要新 UI 或新使用者輸入(殼厚用公式預設)的一步——把「材料參數怎麼設定」這個決定用「先給合理預設」的方式帶過(這是踏勘紀錄裡列出的選項之一),VAWT 與極端工況留給後續步驟,已在 ROADMAP 用子項清單列出。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(15/15,新增 `tests/core.test.mjs` 的「HAWT structural loads (G.struct)」測試:各站 `Mf`/`Me`/`Ncf`/`area`/`Ixx`/`Iyy`/`sigma` 皆為有限值、截面積與慣性矩為正、安全係數為正;`Mf`、`Ncf` 沿展長從根部到葉尖單調不增(離散彎矩/離心力的累加特性);根部流向彎矩為正(受推力);葉尖撓度量級 < 0.3R;預設設計安全係數 > 1)、`npm run build`(255 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 92–97%,本次改動未觸碰控制器/模擬邏輯,數值與前次相近)。桌面 1440×900 與手機 390×844 的翼型/單葉片畫面截圖(e2e 內建產生)確認排版正常(此步驟未改動任何 UI,`G.struct` 目前只是內部資料,尚未顯示)。
- 已知限制(已寫在程式註解裡):彎矩/應力計算忽略局部扭角對截面主軸的旋轉(流向力直接走 Ixx、切向力走 Iyy,忽略 Ixy 交叉項)、忽略重力、還沒有極端風速(IEC 小型風機 Class II Vref)與停機工況、沒有疲勞分析;殼厚 `shellThickness(c)` 是全域公式,還沒有 UI 或逐站覆寫;`MATERIALS` 的 `E`/`sigma` 是工程量級估計,不是特定產品實測值;VAWT 完全沒做結構分析(旋轉彎曲葉片的離心力/彎曲是不同問題)。
- 下一步:ROADMAP 3 —「載重」第二步(極端風速/停機工況、扭角座標旋轉修正、重力)或「疲勞」子項;之後才是單葉片工作區「結構」卡片(面積/Ixx/Iyy/應力/撓度沿展長圖)與逐站材料/殼厚 UI。ROADMAP 1(Vite/ESM 遷移)、2(XFOIL 整合)的踏勘結論與待決選項仍列在 `docs/ROADMAP.md`,尚待使用者確認。

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
