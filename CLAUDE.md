# CLAUDE.md — 風力機葉片設計與虛擬風洞

給 Claude Code 的專案說明。**與使用者溝通一律使用繁體中文**(台灣用語);程式碼識別字與註解可用英文。使用者操作說明在 `docs/USER_GUIDE.md`,對外介紹在 `README.md`。

## 專案是什麼

單一 HTML 的互動式網頁應用(純靜態,可放 GitHub Pages 或本機開啟),用來設計小型風力機並在虛擬風洞中測試:

- 翼型:NACA 4/5 位數、圓弧板、匯入 .dat 座標、貼上 XFOIL 極曲線;沿展長最多 6 個翼型站線性混合;半經驗極曲線含低 Re 修正、邊界層積分(Thwaites + Head)估分離點
- 轉子家族(共 10 種,見下方「轉子家族註冊表」):
  - 水平軸 n 葉(BEM)
  - 垂直軸 H 型 / 螺旋 / Φ / V / 自訂外形 r(z)(DMST,可選動態失速、流線彎曲修正)
  - Savonius(經驗曲線)
  - 匯入 Cp–λ 曲線、阿基米德螺旋(外形產生 + 匯入性能)、匯入 STL 外形(+ 匯入性能)
- 扭角:BEM 數值最佳化 / Schmitz 解析 / 線性;截面表可逐一覆寫
- 虛擬風洞:風速、風向、紊流、陣風、偏航;時域模擬轉子 + 永磁發電機 + 整流 + 升降壓轉換器 + MPPT(P&O / 最佳尖速比 / 最佳轉矩 / 固定占空比);保護:超速、過功率、切出風速停機與重啟、主動變槳、側偏收尾(後三項預設關閉)
- 結構(僅水平軸):截面性質、分布載重與彎矩、應力/撓度/安全係數、極端風速停機工況、雨流計數疲勞壽命
- 其他評估:BPM 後緣/葉尖渦噪音(1/3 八度、A 加權)、Weibull 或實測風速序列的年發電量與容量因數、材料/成本/LCOE 粗估、模型可信度標示
- 工作區:風洞(3D)、單葉片(平面圖/剖面/速度三角形/沿展長氣動與結構量)、流場(面板法 + 致動盤/DMST、葉尖渦尾流)、報告(自動測試 + HTML 報告)
- 版面:經典版面(工作區分頁)與流程版面(① 概念 → ② 幾何 → ③ 翼型 → ④ 虛擬風洞 → ⑤ 比較與報告),概念頁有轉子家族卡片與「我的形狀該選哪條路」引導;自訂外形有圖形化控制點編輯器
- 方案比較(localStorage,跨家族比較 AEP/A、起轉 Cq、噪音、LCOE、可信度)、STL/CSV/ZIP 匯出、深色模式、手機版(只檢視)

過去曾發佈在 claude.ai artifact;使用者 2026-10-09 決定不再需要貼回 claude.ai,改為一般靜態網站。

## 常用指令

```bash
npm ci            # 安裝 devDependency(vite);只有 build 需要
npm run check     # node --check 所有 src/*.mjs(語法)
npm test          # Node 內建 test runner:tests/aero|core|geo.test.mjs(90 項,約 6 秒)
npm run build     # Vite 打包 src/main.mjs → 內嵌進 src/shell.html → dist/wind-turbine-designer.html
npm run serve     # build 後用 http-server 在 :5173 開啟
npm run test:e2e  # 瀏覽器煙霧測試 + 匯出 + 報告 + MPPT 控制回歸(需要 playwright 與 Chromium)
```

- e2e 需要 `playwright` 套件(未列在 devDependencies)。本機:`npm i --no-save playwright && npx playwright install chromium`;雲端容器已有全域 Playwright,做法見 `docs/AUTOPILOT.md`「環境備忘」。
- three.js 預設從 cdnjs 載入。離線或 cdnjs 被擋時:`npm pack three@0.128.0` 取出 `package/build/three.min.js`,執行 `THREE_LOCAL=path/to/three.min.js npm run test:e2e`(也可加 `CHROME_PATH=...` 指定瀏覽器)。
- MPPT 追蹤率在各次執行間約有 ±4% 波動(載入後前 2 秒的紊流模擬是隨機的),門檻 90% 已留餘裕。

**每次修改後的流程:** `npm run check && npm test && npm run build && npm run test:e2e`,並打開 dist 實際看一次畫面(桌面 1440×900 與手機 390×844)。`tests/core.test.mjs` 在 Node 直接跑 MPPT 追蹤率回歸;`tests/e2e.smoke.mjs` 對建置後的 dist 成品跑同一組回歸與畫面/匯出/報告檢查。改到控制器或模擬時兩邊都要跑。

**跨模組名稱檢查(建議):** 模組之間靠裸全域溝通(見下節),漏掉 `export` 的函式在其他模組會變成 `ReferenceError`,只有執行到那一行才會發現(2026-10-15 的報告下載 `save()` 就是這樣壞掉的)。大改後可以用 ESLint 的 `no-undef` 掃一次:把所有 `src/*.mjs` 的 `export` 名稱加上 `AERO`/`Plot`/`GEO`/`Scene3D`/`CORE`/`THREE` 當作 globals,在 scratchpad 安裝 eslint 執行,不要把設定檔或套件加進 repo。

## 架構

全部 10 個 `src/*.mjs` 都是真正的 ES module(具名 `export`)。`scripts/build.mjs` 只呼叫一次 Vite(lib 模式、`formats:['iife']`)打包入口 `src/main.mjs`,產生的 JS 內嵌在 `src/shell.html`(HTML 骨架 + 全部 CSS)最後,輸出單一 `dist/wind-turbine-designer.html`(約 240 KB)。

`main.mjs` 依序 import 各模組,然後 `Object.assign(globalThis, …)` 把各模組的 export 掛成**裸全域**——ui/bench/flow/report 之間仍以全域名稱互相呼叫(例如 report 直接呼叫 `save()`、`fitCv()`)。因此:

- **其他模組要用到的函式、常數一定要 `export`**,否則打包後在別的模組是未定義的全域。
- 只在模組內使用的 helper 不要 export(避免汙染全域)。
- `export let` 重新指派不會反映到全域複本;要共用的可變狀態用物件/陣列原地修改(例如 `SNAPS` 是 `const` 陣列)。

| 檔案 | 內容 | 主要名稱 |
|---|---|---|
| `aero.mjs` | 氣動核心(純函式,可在 Node 執行):翼型產生、`.dat` 解析、Hess-Smith 面板法(含場速度)、邊界層積分、半經驗極曲線 + Viterna + 低 Re 修正、BEM、DMST(含自訂外形 `vawtSlices` type `custom`、動態失速/流線彎曲旗標、靜止啟動轉矩)、Savonius、匯入 Cp–λ(`parseCpCurve`/`customCurve`)、葉尖渦尾流(`tipVortexWake`/`biotSavart`/`tipVortexGamma`/`freeWake`) | `AERO`(其他模組內別名 `A`) |
| `charts.mjs` | 輕量 canvas 繪圖 `Plot.draw(canvas, opts)`;`Plot.draw.force = {W,H,dpr}` 用於報告離屏擷取 | `Plot` |
| `geo.mjs` | 葉片放樣、STL(mm)、store-only ZIP、截面性質/懸臂梁撓度、雨流計數與 Miner 損傷、自訂外形放樣 `customBladeShape`、阿基米德螺旋 `archimedeanBlade`、STL 匯入(`parseSTL`/`transformSTL`/`stlMetrics`/`meshClosure`) | `GEO` |
| `scene.mjs` | Three.js r128 場景(自製軌道控制、煙流粒子、偏航);依家族註冊表的 `scene` 種類建模 | `Scene3D` |
| `core.mjs` | 狀態 `S`、設計結果 `G`、模擬 `SIM`;材料、轉子家族註冊表、`designHAWT`/`designVAWT`、`computePerf`、發電機與控制器、`simStep`、載重/應力/疲勞、噪音、AEP/成本、方案快照輔助 | `S` `G` `SIM` 等(也以 `CORE` 命名空間存在) |
| `ui.mjs` | 左側設定面板(建構器 `grp`/`rng`/`sel`/`chk`)、概念卡片、外形編輯器、圖表分頁、方案比較、匯出(`save`/`blobSave`/`openExport`)、工作區與流程版面切換、主迴圈 `init()` | 多數 UI 函式 |
| `bench.mjs` | 單葉片工作區;共用繪圖工具 `fitCv` `arrow` `interp1` `card` `afOutline` | `Bench` |
| `flow.mjs` | 流場工作區 | `Flow` |
| `report.mjs` | 虛擬風洞自動測試(`runTests`)+ 報告產生(`build`)/下載/列印 | `Report` |
| `main.mjs` | Vite 入口:import 全部模組並掛上全域 | — |

測試一律用 ESM `import * as A from '../src/aero.mjs'`(`core`/`geo` 同理)。唯一的 npm 相依是 `vite`(devDependency,只有 `npm run build` 用到;`npm test`/`npm run check` 不需要安裝任何東西)。

### 轉子家族註冊表(core.mjs)

- `S.mode` 是 `'HAWT'` 或 `'VAWT'`;垂直軸型式在 `S.vawt.type`,每個型式在 `VAWT_FAMILIES[type]` 註冊:`name`、`pane`(面板種類)、`noAirfoil`、`scene`(3D 建構種類)、`shape()`/`struts()`、`design(cfg, mat)`(面積/質量/慣量)、`source`(性能來源)、`badge()`/`csv()`/`title()`/`condRows()`(徽章、幾何 CSV、報告標題與條件列)等。新增垂直軸家族時優先加註冊項,不要再散落 `type === '…'` 分支。
- 現有型式:`H`、`helical`、`phi`、`V`、`free`(自訂外形 r(z),`S.vawt.shapePts`)、`sav`、`custom`(匯入 Cp–λ,`S.custom`)、`arch`(阿基米德螺旋,`S.arch`)、`stl`(匯入外形,`S.stl` + `STL_DATA`)。`custom`/`arch`/`stl` 的性能都來自 `S.custom.pts`(匯入曲線),選家族時若尚未匯入會自動載入標示「示意,非實測」的範例。
- `ROTOR_CARDS`/`rotorCardList()`(概念卡片:典型 Cp、λ 範圍、自啟動、可信度)、`ROTOR_GUIDE`(三條選擇路徑)、`rotorTrust()`/`rotorSource()`(可信度與性能來源,顯示於摘要、徽章、圖表標題、報告、方案比較)、`familyName()`。
- UI 切換家族一律呼叫 `selectFamily(k)`(`'HAWT'` 或垂直軸型式),它會處理模式切換、範例曲線與重新設計。

### 資料流

```
使用者改設定 → bindPane → onChange(path, kind)
  kind: 'geo'|'af'|'pitch' → scheduleRebuild(true)   重新設計葉片 + 性能
        'wind'           → scheduleRebuild(false)  只重算性能
        'live'           → 只影響模擬(不重算)
        'pane'           → 重繪面板;'type' → 重設計 + 輔助起轉;'geoPane' → 重繪面板 + 重設計
rebuild(geo): designHAWT()/designVAWT() → computePerf() → autoMatchGen() → buildScene()
              → updateSummaries → redrawStatic → afterDesignChange()(同步其他工作區)
主迴圈(requestAnimationFrame):simStep 以 2 ms 子步長推進 → Scene3D.frame → 每 0.2 s 更新 HUD/圖表、Flow.tick/Bench.tick
```

- `S`:使用者可調狀態(`S.af` `S.hawt` `S.vawt` `S.tun` `S.load` `S.perf` `S.custom` `S.arch` `S.stl`)。面板控制項以 `data-p="hawt.tsr"` 這類路徑綁定。
- `G`:設計結果(`G.rows` 截面表、`G.afs`/`G.pss` 各截面翼型與極曲線、`G.perf` Cp–λ 表、`G.cpMax` `G.lopt` `G.desElems` 設計點 BEM 結果、`G.loads` 結構結果、`G.gen` 版本號)。
- `G.gen` 每次 `computePerf` 遞增;非同步的偏航曲線(`scheduleYawBuckets`)與 `Bench` 快取都靠它判斷是否過期。
- `rebuild` 與 `setWS` 都是延後執行;主迴圈的 `tick` 可能在版面重建前觸發,`tick` 內存取 DOM 前要確認版面已為目前家族建立(見 `bench.mjs` 的 `tick`)。
- 單位:SI;狀態裡角度用「度」,`AERO` 內部用弧度(`A.D2R` / `A.R2D`)。

### 控制器(core.mjs,改動時要小心)

- 轉換器模型採**電流控制**:控制器算出電流(轉矩)命令,`dutyForCurrent()` 反解占空比;`powerLimitedI()` 把輸出限制在 1.3 × 額定。
- `speedLoop()`:轉速外迴路 + 擾動觀察器(用 `Tg + J·dω/dt` 估計氣動轉矩並前饋),增益 `SPD_KP`。
- P&O:擾動**轉速命令**,功率判讀用 `ω(Tg + J·dω/dt)` 扣除動能變化,只取每週期後段平均;週期由 `autoMatchGen` 依機械時間常數自動設定。
- 額定以上:預設由功率 PI 下調轉速上限 `SIM.wcap`(軟失速);啟用變槳(`S.load.pitchCtl`,僅水平軸)時轉速上限固定在額定、功率 PI 改驅動 `SIM.pitch`。保護條件為超速、瞬間 > 1.6×額定或 3 秒平均 > 1.2×額定;切出風速(`S.load.cutOut`)以 1 秒平均風速判斷並有重啟遲滯;側偏收尾(`S.load.furl`)把 `SIM.furlAng` 加進偏航誤差。
- 驗證值:額定風速以內三種 MPPT 追蹤率 93–97%(e2e 與 `tests/core.test.mjs` 都檢查 ≥ 90%)。例外:以 Savonius 曲線匯入的 custom 轉子在 6 m/s 的 P&O 只有 91.1%(起始擾動方向相反時 87.7%),所以測試的 `trackingRatio` 每次都從相同的 P&O 狀態開始;新增追蹤率測試時也要重設 `SIM.po`。
- 已知且屬物理合理的行為:預設水平軸(λd 7)在 4 m/s 無法自行啟動;H 型 Darrieus 需輔助起轉;水平軸 14 m/s 以上發電機壓不住固定槳距轉子,會反覆觸發保護(報告會說明,並建議啟用切出風速或變槳)。

## 發佈環境限制

使用者 2026-10-09 決定**不再需要貼回 claude.ai 發佈**,原本為 artifact 設的限制放寬如下:

- 仍須是**純靜態網站**:不需後端伺服器、API 金鑰或付費服務(`docs/AUTOPILOT.md`「絕對不能做」仍適用);可放 GitHub Pages 或本機開啟
- 不再強制單一 HTML 與 CDN 白名單;可用 npm 套件由 Vite 打包進 dist(例如 three.js 可改從 npm 打包)。目前仍輸出單一 HTML,沒有必要時不急著改
- 執行時不要 fetch 第三方網站(離線可用、行為可預期)。**目前僅有兩個既有例外**(`src/shell.html`):three.js r128 從 cdnjs 載入(離線時 3D 場景無法顯示,其餘功能可用)、Google Fonts(離線時退回系統字型)。不要再新增;若要完全離線,把 three.js 改由 npm 打包是 ROADMAP 第 7 項的待辦
- 使用者匯入的檔案(.dat、極曲線、Cp–λ、STL、風速序列)只在瀏覽器內處理,不上傳任何地方
- 下載檔案透過 `window.claude.use('downloads')`(`ui.mjs` 的 `save()`);其他託管環境(GitHub Pages、本機開檔)沒有這個 API 時,`save()` 自動改用 Blob 下載(`blobSave()`),回傳 `'api'` / `'blob'` / `false`。匯出視窗在 Blob 下載後另提供「顯示內容供複製」按鈕,因為瀏覽器可能無聲擋下下載;e2e 會檢查三種匯出與報告 HTML 的下載檔名
- localStorage 可用(鍵:`wt-snaps-v1` 方案、`wt-theme` 佈景、`wt-layout` 經典/流程版面),一律包 try/catch
- 主題色全部用 CSS 變數(`--accent` `--c1..c5` `--signal` 等),深色模式要兩處同步(`@media prefers-color-scheme` 與 `[data-theme=dark]`)
- 手機斷點 860px;手機版底部導覽 `.bnav`,設定面板以 `.app.m-set` 切換。使用者已決定手機版**只需檢視**(3D 風洞、圖表、比較、報告),設計面板在手機上唯讀,完整編輯只在桌面版(見 ROADMAP 8C-7)
- CSS 注意:`.seg{display:inline-flex}` 的優先度會蓋過同為單一 class 的 `display:none`;要隱藏 `.seg` 元件請用更具體的選擇器(例如 `header .flownav`)

## 已驗證的參考數值(tests/aero.test.mjs 會檢查)

| 項目 | 值 |
|---|---|
| NACA 0012 無黏 Cl @5° | 0.602 |
| NACA 4412 零升攻角 | −4.14° |
| NACA 4412 最大 L/D @Re 3×10⁵ | 81 @ 3.5° |
| 3 葉 R1.5 m λd 7 轉子 Cp,max | 0.477 @ λ 7;偏航 30° 時 0.309 |
| H 型 Darrieus(R1 H2 B3 c0.15 NACA0018)| Cp 0.333 @ λ 3.5(失速校正前 0.368 @ λ 3)|
| Φ 型 | Cp 0.357 @ λ 3.75(校正前 0.385 @ λ 3.5)|
| 扭角方式比較(三站翼型,λd 7)| BEM 0.478 > Schmitz 0.476 > 線性 20→0° 0.450 |

2026-10-15 全面檢查時,在瀏覽器實測各家族預設設計的 Cp,max:水平軸 0.478 @ λ 7.25、H 0.334、螺旋 0.334、Φ 0.357、V 0.289、自訂外形(蛋形)0.331、Savonius 0.165 @ λ 0.65;匯入曲線類(custom/arch/stl)使用示意曲線 0.320 @ λ 3.5。

## 模型限制(對使用者說明時要誠實)

- 極曲線是半經驗模型(面板法升力 + 平板摩擦阻力 + 失速估計 + Viterna + 低 Re 修正),**不是 XFOIL**;已與少數文獻值比對(見 ROADMAP 第 6 項),升力斜率與 cd0 吻合,Clmax 差約 10% 以內
- DMST 的動態失速與流線彎曲是**選用的簡化修正**(係數未以實驗校正),預設關閉,高 λ 偏樂觀;Savonius 為經驗曲線
- 自訂外形 r(z) 用 DMST 延伸:接近水平的葉片段(|傾角| > 60°)只計阻力,可信度較低
- 匯入曲線(custom/arch/stl)的準確度完全取決於使用者資料;本工具**不計算**阿基米德螺旋與 STL 外形的氣動性能;內建範例曲線是「示意,非實測」
- 流場:翼型為無黏位勢流(失速區只示意,分離點由邊界層積分估計);轉子為致動盤/流管近似,葉尖渦尾流為預設螺旋(自由渦核心已有但尚未接到畫面),不是 CFD
- 結構只算水平軸、準靜態;疲勞只算葉根單一風況;噪音為經驗/BPM 半經驗模型,只適合相對比較;成本單價為概念性假設
- 電氣為準穩態模型;模擬不含結構振動、塔影、地面邊界層

## 程式風格

- 維持現有寫法:ES2020、無框架;執行時無第三方相依(three.js 除外),建置只用 Vite;函式短、全域命名清楚
- UI 文字一律繁體中文;數字用 `fmt()` / `fmtP()`;不要在畫面上用表情符號當圖示
- 新增面板控制項用 `grp()` / `rng()` / `sel()` / `chk()` 建構器,指定正確的 `kind`
- 新增 canvas 圖優先用 `Plot.draw`;自繪圖用 `fitCv()` 取得 context(取不到時回傳 `null`,呼叫端要處理),才能同時支援報告離屏擷取
- 其他模組要呼叫的名稱記得 `export`(見「架構」)
- 動到 `aero.mjs` 要補或更新 `tests/aero.test.mjs`;動到控制器/模擬要跑 e2e
- 大改之前先 `git commit`,方便使用者比較與退回

## 下一步

見 `docs/ROADMAP.md`(依效益排序)。互動工作階段中,開始新功能前先向使用者確認優先順序。

**自動開發排程**:使用者已設定每 6 小時自動推進一次 ROADMAP,並明確確認授權自動 commit / push / 建立 PR / 合併到 `main`(不需人工審查)。排程執行時依 `docs/AUTOPILOT.md` 的規則進行(依 ROADMAP 順序、不需再詢問),進度記在 `docs/AUTOPILOT_LOG.md`。
