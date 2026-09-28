# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(設計運轉點:彎矩/應力/撓度)

- 做了什麼:延續上一次的截面性質,把 BEM 設計點結果接成實際的結構檢查。`geo.js` 新增兩個通用數值方法:`intFromTip(stations, q)`(由葉尖往葉根的梯形法累積積分,任何分布載重都能用它算剪力/軸力)與 `cantileverBeam(stations, w, EI)`(用 `intFromTip` 算剪力再算彎矩,對曲率 M/EI 做兩次梯形積分求斜率與撓度,葉根固定、葉尖自由)。`core.js` 新增 `structuralLoads(rows, afs, elems, mat, shellT, omega, rhoAir)`,在 `designHAWT()` 設計完成後呼叫:用設計點 BEM 的 cl/cd/phi/W 算揮舞向(推力方向)與擺振向(扭矩/切向力方向)的分布載重,配合 `sectionProperties` 的殼截面積算離心軸向拉力,套用每一站的 Ixx/Iyy/yMax/xMax 得彎曲 + 軸向應力疊加與安全係數(`sigmaAllow / sigma`),並算兩個方向的撓度(合成葉尖撓度)。`MATERIALS`(原本只有密度與填充率,給質量估算用)新增 `E`、`sigmaAllow`,五種材料都給了文獻量級的估計值(已內含粗略安全係數,不是資料表的極限值)。新增 `S.hawt.shellT`(殼厚,預設 3mm,目前是整支葉片一個值,還沒有 UI 控制項或逐站覆寫)。
- 過程中的一個修正:接上實際設計(葉尖弦長比葉根小很多)後,`tests/core.test.mjs` 的新測試抓到安全係數算出 0(代表應力無限大),追下去發現 `sectionProperties` 原本只在「移軸前」用面積比例判斷要不要退回實心截面,但薄殼在弦長變小、或翼型前後緣附近局部厚度趨近於零時,`offsetPolygon` 的斜接偏移會自相交,移軸到形心之後 Ixx/Iyy 可能變負值(移軸前的面積/一次矩/二次矩個別看都還「正常」,但组合起来已经不是一個有效的實際截面)。修正為移軸後才檢查 Ixx/Iyy 是否為正,無效時退回實心截面(比殼更保守,不會低估強度)。已補 `tests/geo.test.mjs` 迴歸測試(固定 3mm 殼厚配合縮小弦長,涵蓋這個退回情境),避免以後改動又踩到同樣的自相交問題。
- 為什麼:ROADMAP 3 第二個子項「載重」的第一步,只做設計點的穩態彎矩/應力/撓度,把極端陣風、停機工況、逐站厚度/材料覆寫留給下一步,符合 AUTOPILOT.md「切成一次做得完、可單獨驗證的小步」。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(19/19,新增 geo.js 4 個測試 + core.js 1 個測試)、`npm run build`(257 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%,這次改動不影響控制器行為)。桌面 1440×900 與手機 390×844 的單葉片/風洞畫面截圖確認排版正常(這次改動未觸碰 UI)。參考設計(3 葉 R1.5m λd7,gfrp 3mm 殼)算出來的量級:葉根揮舞彎矩 ≈60 N·m、離心軸力 ≈1850 N、最小安全係數 ≈7、合成葉尖撓度 ≈27 mm(約 1.8% R),數量級合理。
- 已知限制:只算設計點穩態負載(單一風速/轉速),不是額定以上或極端陣風/停機工況;殼厚與材料是整支葉片單一值,`sectionProperties`/`G.rows` 都還沒有逐站厚度或材料設定;沒有考慮重力造成的擺振向交變負載(對疲勞比較重要);沒做離心剛化(centrifugal stiffening)修正,大展弦比、高轉速下會低估等效勁度;VAWT 尚未接這個結構檢查;還沒有 UI 呈現(單葉片工作區「結構」卡片、安全係數過低的警告)。
- 下一步:ROADMAP 3 —「載重」第二步(極端陣風 IEC Vref + 停機工況,逐站殼厚/材料覆寫),或視優先順序改做「結構」UI 卡片把這次算出的 `G.struct` 呈現出來。ROADMAP 1、2 的踩點結論(Vite 遷移的兩難、XFOIL 在此容器批次算極線會當掉)仍待使用者對列出的選項做一次決定。

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
