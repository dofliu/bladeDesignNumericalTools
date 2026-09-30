# CLAUDE.md — 風力機葉片設計與虛擬風洞

給 Claude Code 的專案說明。**與使用者溝通一律使用繁體中文**(台灣用語);程式碼識別字與註解可用英文。

## 專案是什麼

單一 HTML 的互動式網頁應用,用來設計小型風力機葉片並在虛擬風洞中測試:

- 翼型:NACA 4/5 位數、圓弧板、匯入 .dat 座標、貼上 XFOIL 極曲線;沿展長最多 6 個翼型站線性混合
- 轉子:水平軸 n 葉(BEM),垂直軸 H 型 / 螺旋 / Φ / V(DMST)與 Savonius(經驗曲線)
- 扭角:BEM 數值最佳化 / Schmitz 解析 / 線性;截面表可逐一覆寫
- 虛擬風洞:風速、風向、紊流、陣風、偏航;時域模擬轉子 + 永磁發電機 + 整流 + 升降壓轉換器 + MPPT
- 工作區:風洞(3D)、單葉片(平面圖/剖面/速度三角形/沿展長氣動量)、流場(面板法 + 致動盤/DMST)、報告(自動測試 + HTML 報告)
- 方案比較(存在 localStorage)、STL/CSV 匯出、手機版版面

目前正式版本也發佈在 claude.ai artifact(使用者持有連結)。

## 常用指令

```bash
npm run check     # node --check 所有 src/*.js(語法)
npm test          # 氣動核心回歸測試(Node 內建 test runner,無需安裝套件)
npm run build     # 串接 src/ → dist/wind-turbine-designer.html
npm run serve     # build 後用 http-server 在 :5173 開啟
npm run test:e2e  # 瀏覽器煙霧測試 + MPPT 控制回歸(需先 npm i -D playwright && npx playwright install chromium)
```

離線跑 e2e:`CHROME_PATH=... THREE_LOCAL=path/to/three.min.js npm run test:e2e`(three.js 預設從 cdnjs 載入)。

若 cdnjs 被擋,可用 `npm pack three@0.128.0` 取得 `package/build/three.min.js` 當 `THREE_LOCAL`。MPPT 追蹤率在各次執行間約有 ±4% 波動(載入後前 2 秒的紊流模擬是隨機的),門檻 90% 已留餘裕。

**每次修改後的流程:** `npm run check && npm test && npm run build && npm run test:e2e`,並打開 dist 實際看一次畫面(桌面 1440×900 與手機 390×844)。`npm test` 的 `tests/core.test.mjs` 已把 MPPT 追蹤率回歸搬進 Node(直接 `require` `src/core.js`,幾秒內跑完);`tests/e2e.smoke.mjs` 保留同一組回歸與畫面/匯出檢查,驗證的是建置後的 dist 成品,改到控制器或模擬時兩邊都要跑。

## 架構

`scripts/build.mjs` 依固定順序把 `src/` 模組串進 `src/shell.html` 的同一個 `<script>`,模組之間靠全域變數溝通。多數檔案仍是**全域腳本字串串接**(非 ES modules);`aero.js`/`charts.js`/`geo.js`/`scene.js`/`core.js` 已改成真正的 ES modules(`aero.mjs`/`charts.mjs`/`geo.mjs`/`scene.mjs`,具名 `export`),`build.mjs` 對這兩個檔案改用 Vite 的 `build({ build: { lib: {...}, formats:['iife'] } })` 把它們各自打包成指定全域名稱(`AERO`/`Plot`/`GEO`/`Scene3D`)的 IIFE,再與其餘檔案原樣字串串接;輸出的單一 HTML 結構與串接順序不變。順序很重要:

| 順序 | 檔案 | 內容 | 主要全域 |
|---|---|---|---|
| 1 | `aero.mjs` | 氣動核心(真正的 ES module,純函式,可在 Node 執行):翼型產生、`.dat` 解析、Hess-Smith 面板法(含場速度 `vel`)、半經驗極曲線 + Viterna、BEM、DMST、Savonius | `AERO`(core 內別名 `A`) |
| 2 | `charts.mjs` | 輕量 canvas 繪圖 `Plot.draw(canvas, opts)`;`Plot.draw.force = {W,H,dpr}` 用於離屏擷取;真正的 ES module,由 `build.mjs` 透過 Vite 打包成 `Plot` 全域 | `Plot` |
| 3 | `geo.mjs` | 葉片幾何放樣、STL(mm)、store-only ZIP、截面性質/懸臂梁撓度(`polygonMoments`/`offsetPolygon`/`sectionProperties`/`equivalentThickness`/`beamDeflection`);真正的 ES module,打包方式同上 | `GEO` |
| 4 | `scene.js` | Three.js r128 場景(自製軌道控制、煙流粒子、偏航) | `Scene3D` |
| 5 | `core.mjs` | 狀態 `S`、衍生設計 `G`、模擬 `SIM`;設計、性能曲線、發電機、控制器、`simStep`;真正的 ES module(直接 `import` aero/geo),`build.mjs` 打包成 `CORE` 後再 `Object.assign(globalThis, CORE)` 還原成裸全域,測試直接 `import * as core from '../src/core.mjs'` | `S` `G` `SIM` |
| 6 | `ui.js` | 左側設定面板、圖表分頁、方案比較、匯出、工作區切換、主迴圈 `init()` | 多數 UI 函式 |
| 7 | `bench.js` | 單葉片工作區;共用繪圖工具 `fitCv` `arrow` `interp1` `card` | `Bench` |
| 8 | `flow.mjs` | 流場工作區(ES module,build 以 `FlowMod` 打包後還原成裸全域 `Flow`) | `Flow` |
| 9 | `report.js` | 虛擬風洞自動測試 + 報告產生/下載 | `Report` |

`src/package.json` 只是讓 Node 把 `core.js` 當 CommonJS 載入(測試用),與瀏覽器無關;`.mjs` 模組(`aero.mjs`/`charts.mjs`/`geo.mjs`)測試改用 ESM `import * as A from '../src/aero.mjs'`(見 `tests/geo.test.mjs`/`tests/core.test.mjs`)。專案第一個 npm 相依套件是 `vite`(devDependency,只在 `npm run build` 時用到,`npm test`/`npm run check` 不需要它)。

### 資料流

```
使用者改設定 → bindPane → onChange(path, kind)
  kind: 'geo'|'af'|'pitch' → scheduleRebuild(true)   重新設計葉片 + 性能
        'wind'           → scheduleRebuild(false)  只重算性能
        'live'           → 只影響模擬(不重算)
        'pane'           → 重繪面板;'type' → 重設計 + 輔助起轉;'geoPane' → 重繪面板 + 重設計
rebuild(geo): designHAWT()/designVAWT() → computePerf() → autoMatchGen() → buildScene()
              → updateSummaries → redrawStatic → afterDesignChange()(同步其他工作區)
主迴圈(requestAnimationFrame):simStep 以 2 ms 子步長推進 → Scene3D.frame → 每 0.2 s 更新 HUD/圖表
```

- `S`:使用者可調狀態(`S.af` `S.hawt` `S.vawt` `S.tun` `S.load` `S.perf`)。面板控制項以 `data-p="hawt.tsr"` 這類路徑綁定。
- `G`:設計結果(`G.rows` 截面表、`G.afs`/`G.pss` 各截面翼型與極曲線、`G.perf` Cp–λ 表、`G.cpMax` `G.lopt` `G.desElems` 設計點 BEM 結果、`G.gen` 版本號)。
- `G.gen` 每次 `computePerf` 遞增;非同步的偏航曲線(`scheduleYawBuckets`)與 `Bench` 快取都靠它判斷是否過期。
- 單位:SI;狀態裡角度用「度」,`AERO` 內部用弧度(`A.D2R` / `A.R2D`)。

### 控制器(core.js,最近才重寫,改動時要小心)

- 轉換器模型採**電流控制**:控制器算出電流(轉矩)命令,`dutyForCurrent()` 反解占空比;`powerLimitedI()` 把輸出限制在 1.3 × 額定。
- `speedLoop()`:轉速外迴路 + 擾動觀察器(用 `Tg + J·dω/dt` 估計氣動轉矩並前饋),增益 `SPD_KP`。
- P&O:擾動**轉速命令**,功率判讀用 `ω(Tg + J·dω/dt)` 扣除動能變化,只取每週期後段平均;週期由 `autoMatchGen` 依機械時間常數自動設定。
- 額定以上:功率 PI 下調轉速上限 `SIM.wcap`(軟失速);保護條件為超速、瞬間 > 1.6×額定或 3 秒平均 > 1.2×額定。
- 驗證值:額定風速以內三種 MPPT 追蹤率 95–98%(e2e 會檢查 ≥ 90%)。
- 已知且屬物理合理的行為:預設水平軸(λd 7)在 4 m/s 無法自行啟動;H 型 Darrieus 需輔助起轉;水平軸 14 m/s 以上發電機壓不住固定槳距轉子,會反覆觸發保護(報告會說明)。

## 發佈環境限制(claude.ai artifact)

要繼續能貼回 claude.ai 發佈,dist 必須維持:

- 單一 HTML、< 16 MB;外部 script 只能來自 `cdnjs.cloudflare.com`、`cdn.jsdelivr.net/npm`、`cdn.tailwindcss.com`、`code.jquery.com`;樣式只能 Google Fonts;**不能 fetch 其他網站**、不能載入遠端圖片
- 下載檔案透過 `window.claude.use('downloads')`(`ui.js` 的 `save()`);其他託管環境(GitHub Pages、本機開檔)沒有這個 API 時,`save()` 自動改用 Blob 下載(`blobSave()`),回傳 `'api'` / `'blob'` / `false`。匯出視窗在 Blob 下載後另提供「顯示內容供複製」按鈕,因為瀏覽器可能無聲擋下下載;e2e 會檢查三種匯出的檔名與大小
- localStorage 可用(鍵:`wt-snaps-v1` 方案、`wt-theme` 佈景),一律包 try/catch
- 主題色全部用 CSS 變數(`--accent` `--c1..c5` `--signal` 等),深色模式要兩處同步(`@media prefers-color-scheme` 與 `[data-theme=dark]`)
- 手機斷點 860px;手機版底部導覽 `.bnav`,設定面板以 `.app.m-set` 切換

若決定不再回 claude.ai 發佈,可以放寬這些限制(見 ROADMAP 第 1 項)。

## 已驗證的參考數值(tests/aero.test.mjs 會檢查)

| 項目 | 值 |
|---|---|
| NACA 0012 無黏 Cl @5° | 0.602 |
| NACA 4412 零升攻角 | −4.14° |
| NACA 4412 最大 L/D @Re 3×10⁵ | 81 @ 3.5° |
| 3 葉 R1.5 m λd 7 轉子 Cp,max | 0.477 @ λ 7;偏航 30° 時 0.309 |
| H 型 Darrieus(R1 H2 B3 c0.15 NACA0018)| Cp 0.368 @ λ 3 |
| Φ 型 | Cp 0.385 @ λ 3.5 |
| 扭角方式比較(三站翼型,λd 7)| BEM 0.478 > Schmitz 0.476 > 線性 20→0° 0.450 |

## 模型限制(對使用者說明時要誠實)

- 極曲線是半經驗模型(面板法升力 + 平板摩擦阻力 + 失速估計 + Viterna),**不是 XFOIL**
- DMST 未含動態失速與流線彎曲,高 λ 偏樂觀;Savonius 為經驗曲線
- 流場:翼型為無黏位勢流(失速區只示意);轉子為致動盤/流管近似,不是 CFD
- 電氣為準穩態模型;模擬不含結構振動、塔影、地面邊界層

## 程式風格

- 維持現有寫法:ES2020、無框架、無打包工具相依;函式短、全域命名清楚
- UI 文字一律繁體中文;數字用 `fmt()` / `fmtP()`;不要在畫面上用表情符號當圖示
- 新增面板控制項用 `grp()` / `rng()` / `sel()` / `chk()` 建構器,指定正確的 `kind`
- 新增 canvas 圖優先用 `Plot.draw`;自繪圖用 `fitCv()` 取得 context,才能同時支援報告離屏擷取
- 動到 `aero.mjs` 要補或更新 `tests/aero.test.mjs`
- 大改之前先 `git commit`,方便使用者比較與退回

## 下一步

見 `docs/ROADMAP.md`(依效益排序)。互動工作階段中,開始新功能前先向使用者確認優先順序。

**自動開發排程**:使用者已設定每 6 小時自動推進一次 ROADMAP,並明確確認授權自動 commit / push / 建立 PR / 合併到 `main`(不需人工審查)。排程執行時依 `docs/AUTOPILOT.md` 的規則進行(依 ROADMAP 順序、不需再詢問),進度記在 `docs/AUTOPILOT_LOG.md`。
