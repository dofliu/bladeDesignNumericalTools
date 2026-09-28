# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-28 — ROADMAP 3:葉片載重(穩態設計點,水平軸)

- 做了什麼:接續上次「截面性質」子項,做 ROADMAP 3 的「載重」子項,範圍限縮在水平軸、穩態設計點(不含 IEC 極端風速/停機工況,不含垂直軸,留給下一步)。用 `G.desElems`(BEM 設計點各站升阻力/流入角/相對風速)算沿展長法向(揮舞方向)與切向(擺振方向)分布力,加離心力(視為純軸向拉力,假設葉片徑向無後掠/錐角,不產生彎矩),把葉片當簡化懸臂樑(在輪轂處固定)算根部彎矩、沿展長各站應力、葉尖撓度。材料參數延用既有 `MATERIALS` 表(原本只有 `rho`/`fill`,用於質量估算),新增 `E`(楊氏係數)與 `allow`(容許應力,已含安全係數的典型值),5 種材料(玻纖、木材、鋁、PLA、碳纖)都給了值。殼厚不需要新增可調參數,直接沿用既有 `mat.fill` 反推:過程中發現 `sectionProperties`/`offsetPolygon` 的頂點法線斜接偏移法,在殼厚接近翼型局部最大半厚度時會自相交、面積計算數值不穩定(對同一個厚度值,重算會在「正確薄殼面積」與「誤觸實心 fallback」之間跳動)——這剛好落在幾種材料實際會用到的 fill 比例(例如 PLA 0.42)範圍內,不是邊緣案例。這是既有函式本來就有的限制(`geo.js` 註解本來就寫「無自相交保護」),不是這次改動造成,但這次的用途(從 fill 比例反推殼厚)直接踩到它,所以改採標準薄殼理論(沿翼型輪廓弧長積分:面積=殼厚×周長,`Ixx=殼厚×∮(y-形心)²ds`)算殼截面性質,不使用會自相交的偏移多邊形,同時保留原本 `sectionProperties`(fill=1 實心材料如木材仍用它)。
- 為什麼:接續 ROADMAP 3 已排定的下一步;不需要新的使用者可調參數或決定(材料 E/容許應力是延續既有 `MATERIALS` 表填入業界典型值,殼厚沿用既有 `fill` 反推,都不是新的自由參數),風險可控,可獨立驗證。
- 新增/修改:`src/geo.js`(`sectionProperties` 補 `yExtent`/`xExtent` 到形心的最遠距離、新增 `perimeter`、`thinWallSection`、`sectionForFill`、`cantileverMoment`、`cantileverDeflection`)、`src/core.js`(`MATERIALS` 補 `E`/`allow`、新增 `computeStructure()`,`designHAWT()` 算完設計點後呼叫,結果存 `G.struct`)、`tests/geo.test.mjs`(+10 個測試:薄殼理論對照圓環解析解、與既有精確偏移公式在安全的薄殼區間互相印證、`sectionForFill` 在 fill=1 精確退化為實心解、5 種材料實際 fill 比例下面積符合預期且 Ixx/Iyy 為正、懸臂樑彎矩/撓度對照均布載重解析解)、`tests/core.test.mjs`(+1 個測試:對 5 種材料各跑一次 `designHAWT()`,檢查 `G.struct` 全部有限、非負、安全係數與撓度落在合理範圍)。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(21/21,含新增的 11 個結構測試)、`npm run build`(259 KB)、`npm run test:e2e`(全過,3 種匯出、12 組追蹤率回歸 95–97%,無 console 錯誤)。桌面 1440×900 與手機 390×844 截圖確認排版正常(這次改動未觸碰 UI,無畫面差異;預設 gfrp 材料、R=1.5 m 水平軸設計點下 `G.struct.sf`≈7.1,葉尖撓度≈29 mm,數值合理)。
- 已知限制:只有穩態設計點單一工況(沒有陣風、極端風速 IEC Vref、停機/超速工況);只做水平軸,垂直軸的離心力/擺振/揮舞尚未接;懸臂樑模型忽略重力、扭轉-彎曲耦合、葉尖以外的三維效應;材料 `E`/`allow` 是材料類別的典型值,不是特定產品實測;根部以外的力矩用逐站集中力(lumped point load)離散,配合目前 `nSec`(預設 16 站)解析度,最外側一站(葉尖本身)力矩固定算出 0(集中力法在自由端的已知離散誤差,不影響根部/中段的最大應力位置判斷)。
- 下一步:ROADMAP 3 —(a) 垂直軸結構分析、(b) 極端風速/停機工況、(c) 單葉片工作區新增「結構」卡片(面積/Ixx/Iyy/應力/撓度沿展長圖)與報告新增一節、(d) 疲勞(雨流計數)。ROADMAP 1、2 仍卡在需要使用者決定(見 `docs/ROADMAP.md` 對應項目的「排程踩點」)。

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
