# 開發路線圖

依「對設計可信度的提升 ÷ 工作量」排序。每項都附上建議做法與驗收方式。互動工作階段開始前請先與使用者確認順序;排程執行依 `docs/AUTOPILOT.md` 照順序做,不需詢問。

## 1. 工程基礎整理(建議最先做)

- 把 `src/*.js` 改成 ES modules,用 Vite 建置;仍輸出單一 HTML(`vite-plugin-singlefile`),保留貼回 claude.ai 的能力。
  - 排程踩點(2026-09-27):試過「先只換建置工具、src 檔案維持原樣全域變數寫法」這條路——Vite 的 HTML 進入點只會打包 `<script type="module">`,plain `<script src="...">`(現在 9 個檔案的寫法)一律跳過不處理(`can't be bundled without type="module" attribute`,連複製都不會)。也就是說沒有「先換工具、之後再逐檔案轉 ESM」這種零風險小步——要嘛全部 9 個檔案一次改成真正的 `import`/`export`(全域變數溝通全部要重新設計,diff 會遠超過小步門檻),要嘛放棄這條路線。已還原所有嘗試改動(未 commit)。下次執行前建議先跟使用者確認:(a) 接受一次較大的 PR 做完整 ESM+Vite 遷移,或 (b) 改用更輕量的方案(例如單純用 esbuild 的 IIFE 多檔 bundle 取代手寫字串串接,不強求「ES modules」字面意義),或 (c) 這項先擱置,主力做其他項目。
  - 排程踩點(2026-09-28,PR #12):找到繞開上面兩難的做法——不用整個 HTML 進入點給 Vite 處理,改成對「已經轉成真正 ES module 的單一檔案」個別呼叫 Vite 的 JS API(`build({ build: { write:false, lib: {entry, formats:['iife'], name} } })`),把它打包成指定全域名稱的 IIFE 字串,再照原本方式與其餘檔案字串串接。這樣可以逐檔案轉換、每次 diff 都很小,不必一次把 9 個檔案全改完。但這個 PR 的實際 commit 內容有嚴重問題:建立 PR 分支的本地檢出顯然比它自己宣稱的合併基底(`707ae40`)還舊,`git commit` 記錄的是那個更舊狀態,結果整個 `src/geo.mjs` 遺漏了 `polygonMoments`/`offsetPolygon`/`sectionProperties`/`equivalentThickness`/`beamDeflection`(截面性質與應力/撓度,ROADMAP 3 已完成的功能),還一併刪掉了 `src/aero.js` 的 `cumulativeOutboard`/`cumulativeMoment`、`core.js` 的 `bladeLoads`/`G.loads`,以及 `tests/geo.test.mjs` 整個檔案、`tests/aero.test.mjs`/`tests/core.test.mjs` 對應的測試——與 PR #9(Weibull 年發電量)踩到的是同一種「本地檢出過期造成的意外回退」錯誤(見下面 2026-09-28 日誌)。已確認 `src/charts.js` 沒有這個問題(自 `707ae40` 後未變動,轉出的 `charts.mjs` 內容逐行核對過,只多了 `export`),`scripts/build.mjs`/`scripts/check.mjs`/`package.json` 的改動本身也乾淨可重用。處理方式:不合併/不 cherry-pick PR #12 的 commit,改成手動在目前 `main`(已含 ROADMAP 3 的完整 `geo.js`)上重新套用「真正乾淨」的版本——`charts.mjs` 直接照抄(無需改動),`geo.mjs` 依目前完整的 `geo.js` 內容逐一加上 `export`(所有函式,包含 #24 新增的 `equivalentThickness`/`beamDeflection`/`sectionProperties` 的 `yMax`/`xMax`),`build.mjs`/`check.mjs`/`package.json`(`vite` devDependency)照 PR 版本套用,`tests/geo.test.mjs`/`tests/core.test.mjs` 改用 `import * as GEO from '../src/geo.mjs'` 取代 `require('../src/geo.js')`(`aero.js`/`core.js` 維持 CommonJS `require` 不變)。`package-lock.json` 用 `npm install` 重新產生,不採用 PR 裡的版本。已完成:`src/charts.js`/`src/geo.js` → `src/charts.mjs`/`src/geo.mjs`,兩者具名 `export`,`scripts/build.mjs` 用 Vite lib 模式打包這兩個檔案成 IIFE 全域,其餘 7 個檔案不變。
- ~~把 `core.js` 的設計與模擬邏輯拆成不依賴 DOM 的模組(目前 `simStep` 只能在瀏覽器測),把 MPPT 回歸測試移到 Node 單元測試。~~ 已完成:`core.js` 改成與 `aero.js` 相同的 Node/瀏覽器雙模組匯出(IIFE + `module.exports` / `Object.assign(root, API)`),不影響串接組建後的全域變數溝通;`tests/core.test.mjs` 直接在 Node 跑 HAWT/VAWT 三種控制器 × 兩種風速的追蹤率回歸(門檻同 e2e 的 90%),`npm test` 現在幾秒內就能驗證控制器邏輯。`tests/e2e.smoke.mjs` 的瀏覽器版回歸保留,作為建置後成品(dist)的端對端驗證。
- ~~補上匯出視窗在非 claude.ai 環境的 Blob 下載備援(`ui.js` 的 `openExport` / `save`)。~~ 已完成,e2e 已涵蓋。
- [x] `scene.js` → `scene.mjs`(2026-09-29):只依賴外部全域 `THREE`,拿掉 IIFE 包裝、改具名 `export`,`build.mjs` 的 `ESM_GLOBAL` 加 `scene: 'Scene3D'`;畫面與 e2e 無差異。
- [x] `aero.js` → `aero.mjs`(2026-09-29):拿掉雙模組 IIFE,改具名 `export`,`ESM_GLOBAL` 加 `aero: 'AERO'`;三個測試檔改 `import * as A from '../src/aero.mjs'`。
- [x] `core.js` → `core.mjs`(2026-09-29):拿掉雙模組 IIFE,改 `import` aero/geo 與具名 `export`;`build.mjs` 以 `CORE` 全域打包,並用 `EXPAND_GLOBALS` 在其後 `Object.assign(globalThis, CORE)` 讓未轉換的 ui/bench/flow/report 仍能用裸全域;`tests/core.test.mjs` 改 `import * as core`。
- [x] `report.js` → `report.mjs`(2026-09-29):`export const Report`,`build.mjs` 以 `ReportMod` 打包並加入 `EXPAND_GLOBALS`(`Object.assign(globalThis, ReportMod)` 還原裸全域 `Report`);功能無差異。
- [x] `flow.js` → `flow.mjs`(2026-09-30):`export const Flow`,`build.mjs` 以 `FlowMod` 打包並加入 `EXPAND_GLOBALS`;功能無差異。
- [x] `bench.js` → `bench.mjs`(2026-09-30):`export` 共用繪圖工具(`fitCv`/`interp1`/`arrow`/`hexMix`/`card`/`afOutline`/`stationBlendLabel`)與 `Bench`,`build.mjs` 以 `BenchMod` 打包並加入 `EXPAND_GLOBALS`,flow/report/ui 仍可用裸全域;功能無差異。
- [x] `ui.js` → `ui.mjs`(2026-09-30):所有頂層函式/常數改具名 `export`;`SNAPS` 由 `let` 重新指派改為 `const` 陣列原地修改(讓 report 透過全域複本仍讀到最新內容);`build.mjs` 以 `UIMod` 打包並加入 `EXPAND_GLOBALS`。至此 9 個模組全為 ES module。
- [x] `build.mjs` 換成單一 Vite 入口(2026-10-01):新增 `src/main.mjs` import 全部 9 個模組並在載入後 `Object.assign(globalThis, …)` 還原裸全域,`build.mjs` 只呼叫一次 Vite(IIFE);dist 由 201 KB 降為 184 KB(tree-shaking)。未採用 `vite-plugin-singlefile`(只需內嵌單一 JS 到既有 shell,不必新增相依)。**ROADMAP 1 的 ESM+Vite 遷移全部完成。**
- (舊註記)下一步(原計畫,ui 已完成;剩最後一步:把 `scripts/build.mjs` 換成單一 `vite-plugin-singlefile` 設定。舊說明:ES modules 逐檔轉換,沿用 PR #12 驗證過的 Vite lib 打包做法):只剩 `ui.js`(最後一個,依賴最多,風險最高),最後才把 `scripts/build.mjs` 換成單一 `vite-plugin-singlefile` 設定。每次執行前務必先確認要轉換的檔案自排程宣稱的合併基底以來沒有被其他並行執行改過(`git log <base>..HEAD -- src/<name>.js`),並在 commit 前用 `git diff --stat <base>..HEAD` 檢查有沒有意外刪除不相關的既有函式或測試(見上面 PR #12 的踩點)。
- 驗收:`npm test` 涵蓋控制器;dist 行為與現版一致(e2e 全過、截圖比對)。

## 2. 真實翼型資料:XFOIL 整合

目前極曲線是半經驗模型,這是精度最大的瓶頸。

- 做法 A(建議):新增 `tools/xfoil/`,用 Node 或 Python 呼叫本機 XFOIL,批次產生各翼型在 Re 5×10⁴–2×10⁶ 的極曲線,輸出 JSON 放進 `data/polars/`,建置時內嵌;介面上標示「XFOIL 資料」vs「估算」。
  - 排程踩點(2026-09-27):這次的雲端容器可以 `apt-get install xfoil`(Ubuntu universe 套件,6.99.dfsg+1-3)裝起來,單點 `ALFA <a>`(不啟用 PACC 極線累積)可以正常收斂並印出結果。但只要打開 `PACC` 做極線批次累積(不論用 `ASEQ` 或連續多個 `ALFA`),或先用 `PLOP`/`G` 關閉繪圖,都會在第一或第二個攻角後噴 `Cannot open display...aborting` 或直接 SIGFPE(Floating point exception)當掉整個行程,懷疑是這個 Ubuntu 套件的繪圖模組在無 X11 的容器裡有 bug,不是單純「沒有顯示器所以印警告但繼續算」。批次產生極線這條路目前在這個容器環境不可靠,還沒進到寫 `tools/xfoil/` 或 `data/polars/` 的階段。下次可以試:換一個從原始碼編譯、明確關閉繪圖(`-DPLTLIB=` 空或 dummy plot 後端)的 XFOIL 版本,或用 `xvfb-run` 包一層假顯示器,或改找 Python 的 `xfoil`/`aeropy` wrapper 看是否繞得開這個問題;若都不行,再跟使用者確認是否改走「做法 B」或直接用文獻/實驗極線數字手動輸入少量翼型。
- 做法 B:提供本機 API 服務(FastAPI)即時計算,但發佈到 claude.ai 時無法使用,需保留備援。
- 同時可建立翼型資料庫:建置時從 UIUC Airfoil Database 抓取座標(瀏覽器端有 CORS 限制,要在建置階段做)。
- 驗收:NACA 4412 @Re 10⁶ 的 Clmax、最佳 L/D 與 XFOIL/實驗文獻誤差在 5% 內;BEM Cp 變化記錄在測試中。

## 3. 葉片結構分析

- [x] 截面性質:依翼型外形 + 殼厚計算面積、慣性矩、形心(多邊形積分)。`geo.js` 新增 `polygonMoments`(封閉多邊形面積/一次矩/二次矩,對原點,供組合截面先相加再一次移軸)、`offsetPolygon`(等厚度向內偏移,做薄殼內壁)、`sectionProperties(af, chord, thickness)`(回傳實際單位的面積/形心/Ixx/Iyy/Ixy)。`tests/geo.test.mjs` 以正方形、正多邊形近似圓、圓環解析解與 NACA 0012 實心截面積文獻常數(≈0.6851×t/c)驗證。
- [ ] 載重:由 BEM 的 dT/dr、dQ/dr 加離心力,算根部彎矩、各截面應力、葉尖撓度;極端風速(例如 IEC 小型風機 Class II 的 Vref)與停機工況。
  - [x] 分布載重與彎矩:`core.js` 新增 `bladeLoads(rows, elems, omega, rho)`,在 `designHAWT()` 設計點 BEM 解(`resD.elems`)算出每站揮舞向(flapwise,thrust-like)與擺振向(edgewise,torque-like)的分布氣動力,呼叫新的 `aero.js` 通用函式 `cumulativeMoment`/`cumulativeOutboard`(離散懸臂梁:外側點力對某站的彎矩/軸力累加,`tests/aero.test.mjs` 用等分布載重解析解 M=w(L-x)²/2 驗證)沿展長累加成揮舞彎矩;離心軸力則用既有質量迴圈已算出的每站質量 `x.dm` × ω²r 累加。結果存回 `G.rows[i].{Mflap,Medge,Fax,dFz,dFy}` 與 `G.loads.{MflapRoot,MedgeRoot,FaxRoot,omega}`(`designVAWT()` 目前設 `G.loads=null`,垂直軸的結構模型留待之後)。
  - [x] 應力與撓度:`geo.js` 新增 `equivalentThickness(af, chord, targetArea)`(對 `sectionProperties` 的面積做二分搜尋,反解殼厚,如建議用 `MATERIALS[x].fill*airfoilArea*c²` 當目標面積,對齊既有質量模型,沒有新增使用者可調欄位)與 `sectionProperties` 新增回傳 `yMax`/`xMax`(形心到外緣的最大距離,彎曲應力用)、`beamDeflection(rows, M, EI)`(彎矩/EI 曲率由根部往葉尖梯形積分兩次)。`core.js` 的 `bladeLoads` 延伸:對每一站反解等效殼厚 → `sectionProperties` 取 Ixx/Iyy → 揮舞彎曲應力(`Mflap·yMax/Ixx`)、擺振彎曲應力(`Medge·xMax/Iyy`)、離心軸向應力(`Fax/area`)保守直接相加成 `x.stress`,安全係數 `x.safety = mat.allow/x.stress`;揮舞撓度 `x.defl` 用 `beamDeflection` 積分。`MATERIALS` 補上楊氏模數 `E` 與容許應力 `allow` 的合理文獻預設值(玻纖 20 GPa/100 MPa、木材 11 GPa/40 MPa、鋁 69 GPa/110 MPa、PLA 2.3 GPa/20 MPa、碳纖 70 GPa/250 MPa)。`G.loads` 新增 `tipDefl`、`minSafety`。`tests/geo.test.mjs`/`tests/core.test.mjs` 各新增測試(解析解驗證 `beamDeflection`、`equivalentThickness` 面積回代、真實設計點的應力/撓度/安全係數沿展長合理性)。
  - [x] 極端風速與停機工況的載重:`core.js` 的 `EXTREME`(Class II Vref 42.5 m/s、Ve50 = 1.4 Vref、Cn 1.2)+ `bladeLoads` 新增停機(ω=0、無離心力)全失速平板式法向力的揮舞彎矩/應力/撓度/安全係數,結果在 `G.loads.extreme` 與 `G.rows[i].{MflapExt,stressExt,safetyExt}`;`tests/core.test.mjs` 以解析和驗證。預設 HAWT 極端工況安全係數約 2.4(設計點 5.8)。限制:僅揮舞向、無方位/偏航組合、無分項安全係數;UI/報告尚未顯示。
- [x] 疲勞:以紊流測試時間序列做雨流計數,估計根部疲勞壽命(可先簡化)。`geo.mjs` 新增 `reversals`/`rainflow`(ASTM E1049 三點法,`tests/geo.test.mjs` 以 ASTM 範例歷程與正弦波驗證)、`minerDamage`(Basquin S-N + Goodman 平均應力修正)、`equivalentRange`(等效應力範圍);`MATERIALS` 補上極限強度 `su` 與 S-N 斜率 `m`(材料典型值);`core.mjs` 的 `bladeLoads` 存下葉根應力分量 `G.loads.root`(揮舞/擺振/離心/重力 1P),`rootStress()` 由模擬狀態(推力 ∝ V²Ct(λ)、氣動轉矩、ω²、方位角)重建葉根即時應力,`fatigueEstimate(sig, dur)` 回傳循環數、損傷、壽命(年)、等效應力範圍。報告在紊流測試(8 m/s、TI 15%)記錄葉根應力,「葉片結構」一節新增疲勞段落與應力時間序列圖,壽命 < 20 年時標紅並寫入結論。
  - 限制:只算葉根、單一風況(未依 Weibull 加權多個風速)、準靜態(無葉片動態/塔影/偏航陀螺力矩)、僅 HAWT。順手修正:實心材料(木材 fill 1)的等效殼厚反解會落到內偏移翻折區,導致葉根 Ixx 只剩實心值 3%、安全係數誤報 0.35;現在目標面積 ≥ 95% 實心面積時直接用實心截面。
- [x] 單葉片工作區新增「結構」卡片(面積/Ixx/Iyy 沿展長圖 + 之後的應力/撓度);報告新增一節。
  - [x] 單葉片工作區「沿展長的氣動特性變化」圖新增三個結構檢視:彎矩、合成應力(含容許應力線與最小安全係數)、揮舞撓度(僅 HAWT)。
  - [x] 面積/Ixx/Iyy 沿展長圖(`bench.js` 新增 `secprop` 檢視)與報告新增「葉片結構」一節(`report.js`:材料、根部彎矩/軸力、最小安全係數、葉尖撓度、極端工況、五站截面表,安全係數 < 1.5 標紅;僅 HAWT)。
- 驗收(需上面全部完成):與懸臂梁解析解比對撓度;材料安全係數低於門檻時給出警告。

## 4. 額定以上控制與保護狀態機

- 目前額定以上只靠降轉速(軟失速),發電機壓不住時會反覆觸發保護。
- 新增:側偏收尾(furling)模型、變槳選項、切出風速與重新啟動邏輯(停機 → 等待平均風速下降 → 重啟)。
  - [x] 切出風速與重新啟動邏輯:`S.load.cutOut`(預設關閉,不影響既有設計的行為與既有測試)+ `vCutOut`/`vRestart` 兩個閾值,以 1 秒低通平均風速(既有的 `SIM.Vmeas`)判斷,超過切出風速即併入既有的煞車閂鎖(`SIM.brake || SIM.latch || SIM.cutout`)強制停機,待風速降到重啟風速以下才解除,兩個閾值不同(遲滯)避免風速在門檻附近時反覆停機/重啟。負載面板「保護」群組新增啟用開關與兩個風速滑桿(僅在啟用時顯示),報告會在「負載」條件列出設定值,並在偵測到反覆保護跳脫時提示可以啟用此功能。
  - [ ] 變槳(pitch)選項:額定以上主動變槳降低攻角來控制功率,取代/輔助軟失速降轉速,需要新的葉素氣動模型(變槳角對每個 BEM 截面的攻角修正)。
  - [ ] 側偏收尾(furling)模型:機艙隨風速自動側偏降低有效受風面積,需要擴充偏航模型(目前偏航只用於主動對風/失準模擬,不含風速觸發的被動收尾)。
- 驗收:16–25 m/s 不再反覆跳脫(切出/重啟邏輯已可達成,見 `tests/core.test.mjs` 的遲滯行為測試;變槳與收尾模型仍待實作)→ 報告功率曲線呈現平台與切出(仍待做:自動測試的功率曲線風速只到 15 m/s,還沒有涵蓋切出風速以上的區間)。

## 5. 垂直軸模型強化

- 動態失速(Gormont 或 Beddoes-Leishman 簡化版)、流線彎曲修正。
- 啟動過程(低 λ)的準確度:加入 360° 靜態極曲線與低 Re 修正。
- 驗收:與 Sandia 17 m 或文獻 H-Darrieus 實驗 Cp–λ 曲線比較。

## 6. 流場分析深化

- 翼型:加入邊界層積分(Thwaites + Head)估計分離點與阻力,取代示意分離區。
- 轉子:自由渦尾流(prescribed / free wake)顯示葉尖渦;或匯出幾何給 OpenFOAM 做 CFD,並把結果讀回。
- 驗收:分離點隨攻角移動趨勢合理;BEM 與渦尾流 Cp 差異 < 5%。

## 7. 其他

- 噪音估計(葉尖速度法 → 進階 BPM 模型)。
- 場址風況:匯入風速時間序列或 Weibull 參數,計算年發電量與容量因數。
  - [x] Weibull 參數法:`core.js` 新增 `gammaFn`(Lanczos 近似)、`weibullPdf(v, meanV, k)`、`capacityFactor(aepKWh, ratedW)`;`S.perf.k`(預設 2,等於原本的 Rayleigh 分布)可在「性能曲線」「方案比較」分頁調整(1.2–3.5);年發電量圖表、方案比較表格、報告摘要卡都新增容量因數。
  - [ ] 匯入實測風速時間序列(另一種做法,尚未做)。
- 經濟性:材料成本、LCOE 粗估。
- 介面:英文語系、報告 PDF 直接輸出(需處理中文字型)。
