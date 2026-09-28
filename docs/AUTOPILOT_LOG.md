# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(彎矩/撓度/應力,第一版)

- 做了什麼:接續上次完成的截面性質,做 ROADMAP 3 第二個子項「載重」的第一版。`geo.js` 新增三個泛用懸臂梁力學函式——`beamMoment(rows, w)`(展長分布力 → 彎矩,逐站對各站力臂求和)、`axialForce(rows, massPerLen, omega)`(展長質量分布 + 轉速 → 離心張力,同法累加)、`beamDeflection(rows, M, EI)`(彎矩/EI 曲率由固定端往外梯形積分兩次得到撓度)——與串接函式 `bladeStructuralLoads(rows, afs, elems, rhoAir, omega, mat, thicknessFn)`:對每一站,用 BEM 設計點的 `elems`(`phi`、`cl`、`cd`、`W`)算出揮舞(flatwise, cn 分量)與擺振(edgewise, ct 分量)分布力,呼叫 `sectionProperties` 取得該站的殼截面積/Ixx/Iyy/形心到外緣距離,再算彎矩、離心軸力、揮舞撓度、三個應力分量(揮舞彎曲、擺振彎曲、離心軸向,保守直接相加)與安全係數(容許應力/總應力)。`sectionProperties` 順便補上 `yMax`/`xMax`(形心到外緣的最大距離,彎曲應力算式要用)。`core.js` 的 `MATERIALS` 補上楊氏模數 `E` 與容許應力 `allow` 的合理文獻預設值(玻纖 20 GPa/100 MPa、木材 11 GPa/40 MPa、鋁 69 GPa/110 MPa、PLA 2.3 GPa/20 MPa、碳纖 70 GPa/250 MPa,皆為典型量級搭配保守安全係數,非特定產品實測值)。殼厚沿展長暫用 `defaultShellThickness(chord)`(2% 弦長,夾在 1.5–10 mm)這個合理預設。
- 為什麼:ROADMAP 3「載重」子項的既定下一步;`docs/ROADMAP.md` 原本的下一步筆記列了兩個選項(材料參數逐站可調 vs. 先給合理預設),選了風險較低、範圍較小的後者,把「逐站可調」留給下一次執行,這樣本次仍是一個可獨立驗證的小步(純 JS 數值函式,不碰 UI/建置流程)。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(18/18,新增 4 個 `tests/geo.test.mjs` 測試:均布載重與懸臂梁末端集中力兩個解析解驗證 `beamMoment`/`beamDeflection`、旋轉均勻質量分布的離心張力解析解驗證 `axialForce`、一組真實 3 葉 R1.5 m BEM 設計點結果餵進 `bladeStructuralLoads` 檢查彎矩沿展長遞減到接近 0、撓度單調遞增、離心軸力遞減、安全係數處處為正有限值)、`npm run build`(256 KB)、離線 `npm run test:e2e`(`THREE_LOCAL` 指到本地 three.min.js、`CHROME_PATH` 指到 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,全過,3 種匯出、12 組追蹤率回歸 95–97%)。桌面 1440×900 與手機 390×844 的風洞畫面截圖(`tests/output/*.png`)確認排版正常(這次改動未觸碰 UI,預期且實際無畫面差異)。
- 已知限制:目前只有葉片本體的第一版結構計算,還沒有極端風速(IEC 小型風機 Class II Vref)與停機工況的載重組合;材料與殼厚是全展長單一設定,還沒接到 `G.rows` 逐站可調;應力採保守的三分量直接相加(揮舞彎曲 + 擺振彎曲 + 離心軸向的絕對值加總),沒有考慮相位差或組合工況係數;還沒有單葉片工作區的「結構」UI 卡片,也還沒有疲勞分析;這些都是 ROADMAP 3 後續子項。
- 下一步:ROADMAP 3 —先做「殼厚/材料逐站可調」(把 `sectionProperties`/`bladeStructuralLoads` 接到 `G.rows`,讓使用者能覆寫每一站的厚度),或直接做「單葉片工作區新增結構卡片」(先用目前的合理預設把彎矩/撓度/應力沿展長圖畫出來,材料/厚度可調留到之後)——兩者皆可獨立驗證,下次執行擇一;之後才是極端風速/停機工況與疲勞分析。ROADMAP 1、2 仍卡在需要使用者決定(見 `docs/ROADMAP.md` 對應項目的「排程踩點」)。

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
