# 開發路線圖

依「對設計可信度的提升 ÷ 工作量」排序。每項都附上建議做法與驗收方式。互動工作階段開始前請先與使用者確認順序;排程執行依 `docs/AUTOPILOT.md` 照順序做,不需詢問。

> **目前優先:第 8 項「創新外形轉子」**(使用者 2026-10-09 指定)。排程執行先做第 8 項中標示可由排程進行的子步驟;第 8 項做完或只剩「需使用者決定」的子步驟時,再回到第 3–7 項的剩餘子項。

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
  - [x] 報告功率曲線涵蓋切出風速(2026-09-30):啟用切出風速時,自動功率曲線測試延伸到「切出風速 + 2 m/s」(上限 25 m/s),理想曲線在切出後歸零,結論文字同步;未啟用時仍為 3–15 m/s。
  - [ ] 變槳(pitch)選項:額定以上主動變槳降低攻角來控制功率,取代/輔助軟失速降轉速。
    - [x] 離線變槳調節分析(2026-10-01):`bemPoint` 本來就支援整體槳距偏移,`core.mjs` 新增 `pitchRegulation(vList, opts)`:固定額定轉速,對每個風速二分搜尋「讓氣動功率降到發電機上限所需的最小順槳角」,回傳 pitch/Pa/Cp/飽和旗標;`tests/core.test.mjs` 驗證額定以下 0°、額定以上功率平台(誤差 < 1%)、槳距隨風速單調增加。預設 HAWT 約 14 m/s 8.8°、25 m/s 28.5°。
    - [x] 時域模擬接上變槳(2026-10-01):`S.load.pitchCtl` 開關(負載→保護,僅 HAWT)+ `pitchRate` 致動速率限制 + `pitchDcq(λ,β)`(BEM 預先算 β=0–40° 每 5° 的 Cq 曲線,依 `G.gen` 快取);啟用時轉速上限固定為額定轉速、功率 PI 驅動 `SIM.pitch`(0–40°),煞車/切出時全力順槳;`tests/core.test.mjs` 驗證 16 m/s 順槳、平均功率貼近額定、無跳脫、6 m/s 回 0°。
    - [x] 報告功率曲線與結論納入變槳(2026-10-02):`report.mjs` 的功率曲線測試記錄各風速平均槳距 `SIM.pitch`,啟用變槳(HAWT)時表格新增「槳距」欄、結論新增變槳說明。預設 HAWT 13 m/s 起順槳、15 m/s 約 8.3°,輸出貼平 3.20 kW、無保護跳脫。
    - [ ] 變槳與 MPPT 在額定附近的交互作用細部調校(低優先)。
  - [x] 側偏收尾簡化模型(2026-10-02):`S.load.furl`(預設關閉)+ `vFurl`/`furlMax`/`furlRate`;1 秒低通平均風速超過 `vFurl` 後目標側偏角線性上升,在 +6 m/s 達 `furlMax`,以速率限制追蹤,`SIM.furlAng` 加進 `simStep` 的偏航誤差 γ,沿用既有偏航 Cq 曲線。負載面板新增開關與三個滑桿(僅 HAWT)。限制:無尾翼力矩/陀螺效應、不含被動收尾的遲滯與回復動力學、報告尚未顯示側偏設定。
  - [x] 報告納入側偏收尾(2026-10-02):`report.mjs` 功率曲線測試記錄各風速平均側偏角 `SIM.furlAng`;啟用側偏(HAWT)時「測試條件」列出側偏設定、功率曲線表新增「側偏角」欄、結論說明起始風速與最高風速的側偏角。預設 HAWT、vFurl 12 m/s:13 m/s 起側偏 10°,15 m/s 約 30°,輸出 3.10 kW。
  - [ ] 側偏收尾(furling)進階:機艙隨風速自動側偏降低有效受風面積,需要擴充偏航模型(目前偏航只用於主動對風/失準模擬,不含風速觸發的被動收尾)。
- 驗收:16–25 m/s 不再反覆跳脫(切出/重啟邏輯已可達成,見 `tests/core.test.mjs` 的遲滯行為測試;變槳與收尾模型仍待實作)→ 報告功率曲線呈現平台與切出(仍待做:自動測試的功率曲線風速只到 15 m/s,還沒有涵蓋切出風速以上的區間)。

## 5. 垂直軸模型強化

- 動態失速(Gormont 或 Beddoes-Leishman 簡化版)、流線彎曲修正。
  - [x] 簡化 Gormont 動態失速(2026-10-02):`cfg.dynStall`(`S.vawt.dynStall`,預設關閉,面板勾選)依攻角變化率平移查表攻角(上仰 0.35、下俯 0.125 × √(c·α̇/2W)),`tests/aero.test.mjs` 驗證旗標關閉時結果不變、低 λ Cp 改變、λopt 附近變化小。係數為 Gormont K1 的未校正縮放(H 型 λ1.8 Cp 0.164→0.170,λ3 0.368→0.373)。
  - [x] 簡化流線彎曲修正(2026-10-02):`cfg.curvature`(`S.vawt.curvature`,預設關閉,面板勾選)以 Migliore 虛擬攻角 ≈ cω/(4W) 的 0.5 倍平移查表攻角(符號取使高 λ Cp 下降),`tests/aero.test.mjs` 驗證旗標關閉不變、λ4 Cp 0.312→0.275、c/R 小則修正小。係數未校正、未含虛擬彎度。
  - [x] 文獻帶回歸基準(2026-10-05):`tests/aero.test.mjs` 新增 H 型 Cp–λ 曲線形狀比對(Cp,max 0.25–0.40、位於 λ 2.5–4、失控轉速 λ 5–7.5),四種旗標組合都落在帶內:base 0.333@3.5/失控 6.23、動態失速 0.340@3.25/6.22、流線彎曲 0.300@3.25/5.78、兩者 0.318@3.25/5.87。未改模型係數。
  - [ ] 以 Sandia 17 m 或單一實驗 Cp–λ 資料點校正動態失速與流線彎曲係數(需實驗數值,目前只有帶狀範圍)。
- 啟動過程(低 λ)的準確度:加入 360° 靜態極曲線與低 Re 修正。
  - [x] 靜止轉子啟動轉矩(2026-10-06):`aero.mjs` 新增 `vawtStaticTorque(cfg, V)`,用既有 360° 極曲線算 λ=0 時各轉子方位角的合轉矩(迎風全風速、背風 0.5 倍尾流),回傳 Cq 平均/最小/最大與 `selfStart`;轉子摘要顯示。預設 H 型(NACA 0018、3 葉)Cq 平均 0.007、最小 −0.002,有轉矩死區、不能自行啟動,與已知行為一致。限制:無誘導/動態失速/低 Re 修正。
  - [x] 啟動時域模擬(2026-10-07):`core.mjs` 新增 `startupRun(V, w0Frac, dur)`(固定風速由指定初速時域加速,回傳達設計轉速 50% 的時間、結束 λ);`tests/core.test.mjs` 驗證預設 H 型 4 m/s 靜止不能自行加速(λ 約 0.3)、輔助起轉到 30% 後 6/9 m/s 可加速(約 21 s / 15 s 達 50%)、風速高較快。限制:未含低 Re 修正。
  - [x] 低 Re 修正(2026-10-07):`polarAtRe` 在 Re < 1e5 加入層流分離泡——失速角 Re 項再扣 `0.1·log10(1e5/Re)`、`cd0` 乘 `1+0.4·log10(1e5/Re)`。NACA 0012 cd0 Re 1e5/5e4/2e4 = 0.0105/0.0167/0.0301,Clmax 1.13/1.03/0.91;Re ≥ 1e5 不變(既有 Cp 參考值測試全過)。限制:係數為經驗估計、未與低 Re 實驗(如 UIUC)比對、無遲滯。
- 驗收:與 Sandia 17 m 或文獻 H-Darrieus 實驗 Cp–λ 曲線比較。

## 6. 流場分析深化

- 翼型:加入邊界層積分(Thwaites + Head)估計分離點與阻力,取代示意分離區。
  - [x] 邊界層積分估計分離點(2026-10-04):`aero.mjs` 新增 `boundaryLayer(sol, Re)`:以面板法表面速度做 Thwaites 層流 + Michel 轉捩 + Head 紊流積分,回傳上下表面轉捩點 `xTr`、層流分離 `xLam`(視為短氣泡、之後紊流再附)、紊流分離 `xSep`(H>2.4,忽略最後 3% 弦長)與 Squire-Young 阻力 `cd`;流場工作區的紅色分離區改用 `xSep`,標題列顯示轉捩/分離位置。`tests/aero.test.mjs` 驗證 0° 無分離、cd 約 0.0056、分離點隨攻角增加與低 Re 前移。限制:未做黏性-無黏耦合(Cp 與 Cl 仍是位勢流)、前緣層流氣泡過於簡化、阻力 cd 尚未取代極曲線模型。
  - [x] 極曲線 cd 與 `boundaryLayer` cd 的比對基準(2026-10-04):`tests/aero.test.mjs` 新增比對測試(NACA 0012/2412/4412/0018、α 0/2°)。結果:Re 10⁵ 兩者差 < 15%、Re 3×10⁵ 差 < 25%;Re 2×10⁶ 時極曲線 cd 高出 1.5–2 倍(NACA 0012 Re 10⁶:極曲線 0.0069 vs 邊界層 0.0056,文獻約 0.006)。尚未改動極曲線模型(會連動 Cp 參考值)。
  - [x] 極曲線 `cd0` 高 Re 校正(2026-10-04):`polarAtRe` 的 `cd0` 乘上 `reCal = clamp(1 − 0.25·log10(Re/3e5), 0.7, 1)`(Re ≤ 3e5 不變)。NACA 0012 Re 10⁶ cd0 0.0069 → 約 0.0060;與邊界層 cd 比值 Re 2×10⁶ 由 1.5–2 倍降為 1.17–1.6(0018 仍偏高)。Cp 參考值測試不變;唯一受影響:側偏測試的轉速門檻 0.7 → 0.8(側偏 60° 轉速比 0.57 → 0.76,因阻力降低)。
  - [x] 與文獻實驗值比對基準(2026-10-05):`tests/aero.test.mjs` 新增比對測試(Abbott & von Doenhoff NACA 0012 Re 3×10⁶;Sheldahl & Klimas NACA 0018 Re 3×10⁵)。結果:升力斜率 6.35 vs 6.2/rad、cd0 0.0058 vs 0.0055 吻合;**Clmax 0012 Re 3e6 為 1.34 vs 文獻 1.6(低約 16%),0018 Re 3e5 為 1.51 vs 約 1.1–1.2(高估)**——根因是失速角/Clmax 的厚度項(`9+28t`)單調上升,文獻厚翼型低 Re Clmax 反而下降。未改模型(0018 是 H 型 Darrieus Cp 參考值的翼型,會連動)。
  - [x] 校正失速模型的厚度與 Re 項(2026-10-05):`polarAtRe` 失速角厚度項改為 `28·min(t,0.12) − 20·max(0,t−0.12)`、Re 項在 Re > 1e6 加速(+0.25·log10(Re/1e6),上限 1.2)。NACA 0012 Re 3e6 Clmax 1.34 → 1.49(文獻 1.6);0018 Re 3e5 1.51 → 1.20(文獻 1.1–1.2)。H 型 Cp 0.368@λ3 → 0.333@λ3.5、Φ 型 0.385@λ3.5 → 0.357@λ3.75;水平軸 Cp 參考值(NACA 4412 等)不變。
  - (原項目)與文獻實驗值比較失速估計與厚翼型(NACA 0018)cd0;原項目:依上述比對,把極曲線的 `cd0` 高 Re 段(`cfFlat` 之後的厚度修正)往 `boundaryLayer` 校正,同步更新 aero/core 測試的參考值並在 PR 說明新舊數值;再與文獻實驗值比較失速估計。
- 轉子:自由渦尾流(prescribed / free wake)顯示葉尖渦;
  - [x] 預設螺旋尾流葉尖渦(2026-10-08):`aero.mjs` 新增 `tipVortexWake`(依葉尖誘導 a 對流 + 流管膨脹,遠尾流節距 2π(1−2a)/λ),流場工作區 HAWT 側視圖可勾選疊圖;`tests/aero.test.mjs` 解析值驗證。
  - [x] Biot-Savart 渦線誘導速度(2026-10-08):`aero.mjs` 新增 `biotSavart(lines, p, gamma, core)`(直線段公式 + 核心正規化),`tests/aero.test.mjs` 以圓形渦環軸上解析解 Γ R²/(2(R²+x²)^1.5) 驗證(誤差 < 0.5%)。尚未接到尾流演化。
  - [ ] 自由渦尾流(以 `biotSavart` 讓 `tipVortexWake` 的渦點隨誘導速度對流、設定葉尖渦強度 Γ、與 BEM Cp 比對 < 5%)與 OpenFOAM 匯出。
  - (原項目)或匯出幾何給 OpenFOAM 做 CFD,並把結果讀回。
- 驗收:分離點隨攻角移動趨勢合理;BEM 與渦尾流 Cp 差異 < 5%。

## 7. 其他

- 噪音估計(葉尖速度法 → 進階 BPM 模型)。
  - [x] 葉尖速度法(2026-10-03):`core.mjs` 新增 `noiseEstimate(vTip, D, dist)`(Hau/Wagner 經驗式 Lw = 50log10(Vtip)+10log10(D)-4 dB(A),遠場半球擴散 + 空氣吸收),報告「設計條件」新增 HAWT 噪音估計列。限制:經驗式 ±5 dB、不含音調/調幅、僅 HAWT。
  - [x] 主畫面轉子摘要顯示噪音概估(2026-10-05):`ui.mjs` 轉子摘要新增「噪音(概估,設計點)」列(Lw 與 50 m 處聲壓級,僅 HAWT)。
  - [x] BPM 式後緣自噪音第一步(2026-10-06):`core.mjs` 新增 `tbleNoise(rows, elems, B, rho, mu, dist)`:BPM 位移厚度相關式(攻角修正)+ 峰值 SPL = 10log10(δ*M⁵LDh/r²)+K1−3,吸力/壓力面、各截面、各葉片能量相加;主畫面轉子摘要與報告「設計條件」新增一列。限制:不解析頻譜(+5 dB 代表頻帶加總)、無方向性/都卜勒/A 加權、位移厚度用經驗式而非 `boundaryLayer`、不含入流紊流/葉尖/鈍後緣噪音,只適合設計間相對比較。
  - [x] BPM 分頻譜與 A 加權(2026-10-07):`core.mjs` 新增 `tbleSpectrum`(BPM A 函數頻譜形狀、1/3 八度 100 Hz–10 kHz 共 21 頻帶、IEC A 加權),回傳各頻帶 `L`/`LA` 與總 `Lp`/`LA`;主畫面轉子摘要與報告改顯示 dB(A) 與未加權值。預設設計 50 m 處未加權 33.5 dB、34.0 dB(A),峰值約 2 kHz。限制:SPL_α(高攻角 B 函數)與 ΔK1 修正未含,K1 取 Rc>8e5 值,無方向性。
  - [x] 頻譜圖顯示(2026-10-07):報告「設計條件」後新增 BPM 後緣自噪音 1/3 八度頻譜圖(未加權與 A 加權,僅 HAWT)。
  - [x] 高攻角 SPL_α(2026-10-07):`tbleSpectrum` 吸力面加入 BPM 高攻角項(K2、B(b),峰值在 St2);設計點攻角下貢獻可忽略(總量不變 33.8 dB),攻角 +12° 時升高約 11 dB。`tests/core.test.mjs` 新增測試。
  - [x] 改用 `boundaryLayer` 的 δ*(2026-10-08):`aero.mjs` 的 `boundaryLayer` 各表面新增 `dStar`(尾緣 θ·H);`core.mjs` 新增 `blDstarFn(afs)`,`tbleNoise`/`tbleSpectrum` 新增選用參數 `dstarFn`(預設仍用 BPM 經驗式,主畫面數字不變);報告以邊界層 δ* 交叉驗證(預設設計 33.8 → 34.1 dB 未加權)。限制:無尾流、勢流尾緣、層流段不含壓力面分離。
  - [x] 葉尖渦噪音(2026-10-08):`core.mjs` 新增 `tipVortexNoise`(BPM 圓弧葉尖:黏性核心尺寸 l=0.008·α·c、Umax=U(1+0.036α)、1/3 八度頻譜、A 加權);報告「設計條件」新增一列並與後緣自噪音能量相加。限制:只取最外側站、無葉尖形狀選項、無方向性。
- 場址風況:匯入風速時間序列或 Weibull 參數,計算年發電量與容量因數。
  - [x] Weibull 參數法:`core.js` 新增 `gammaFn`(Lanczos 近似)、`weibullPdf(v, meanV, k)`、`capacityFactor(aepKWh, ratedW)`;`S.perf.k`(預設 2,等於原本的 Rayleigh 分布)可在「性能曲線」「方案比較」分頁調整(1.2–3.5);年發電量圖表、方案比較表格、報告摘要卡都新增容量因數。
  - [x] 匯入實測風速時間序列(2026-10-03):`core.mjs` 新增 `parseWindSeries`(每行取最後一個數值,可含標題/時間戳 CSV)、`windSeriesPdf`(0.5 m/s 直方圖密度)、`windDensity(v)`(有匯入則用實測分布,否則 Weibull);`S.perf.series`;「性能曲線」分頁新增匯入/清除,年發電量圖與方案比較 AEP 皆改用 `windDensity`。限制:超過 25 m/s 的風速不計入發電(仍計入總筆數);不依風向/時序;匯入資料不存入方案(`localStorage`)。
- 經濟性:材料成本、LCOE 粗估。
  - [x] 粗估模型(2026-10-03):`MATERIALS` 補材料單價 `cost`(NT$/kg),`core.mjs` 新增 `costEstimate(mass, mat, ratedW, sweptA, aep)`(葉片 + 發電機電控 + 塔架基礎 → 資本支出;固定費率 8% + 維運 3% → LCOE),報告「設計條件」新增成本與 LCOE 列。限制:單價為概念性假設、未依規模調整、主畫面與方案比較尚未顯示、單價不可由使用者調整。
  - [x] 方案比較表新增 LCOE 欄(2026-10-03):方案儲存時記錄 `massTot`/`mat`,以 `costEstimate` 搭配各方案 AEP 計算;舊版已存方案無此欄位顯示「–」(重新儲存即可)。
  - [x] 主畫面摘要顯示 LCOE(2026-10-03):轉子摘要新增「資本支出(概估)」與「LCOE(概估)」,以理想年發電量計。
  - [x] 單價可調(2026-10-04):`S.perf.cost` 覆寫葉片單價(`matCost`)、發電機 `gen`、塔架 `tower`、固定費率 `fcr`、維運 `om`;「性能曲線」分頁新增輸入欄,`costEstimate` 預設讀 `S.perf.cost`,主畫面、方案比較、報告同步。
  - [x] 單價隨方案儲存(2026-10-05):方案快照記錄儲存當下的 `S.perf.cost`,方案比較的 LCOE 以各方案自己的單價計算(舊方案無此欄位則沿用目前單價);「目前設計」列仍用目前單價。
  - [x] 額定功率隨方案儲存(2026-10-06):方案快照記錄 `S.load.Pmax`,方案比較的容量因數與 LCOE(發電機成本)以各方案自己的額定功率計算;舊方案無此欄位沿用目前設定(`core.mjs` 的 `snapRated`)。
  - [x] AEP 限額定功率(2026-10-06):`core.mjs` 新增 `idealAEP(m, ratedW)`(理想 MPPT、每個風速輸出以額定功率封頂),`snapAEP` 改用它,方案比較的 AEP/容量因數/LCOE 不再高估(容量因數必 ≤ 100%)。限制:仍是理想 MPPT 穩態,未含保護停機/切出風速。
  - [x] 性能曲線分頁年發電量圖固定占空比曲線限額定(2026-10-06):`ui.mjs` 的固定 D 功率以 `S.load.Pmax` 封頂(MPPT 曲線原本已限),容量因數不再 > 100%。
- 介面:英文語系、報告 PDF 直接輸出(需處理中文字型)。

## 8. 創新外形轉子(2026-10-09 使用者指定,優先)

目前工具只涵蓋傳統外形(水平軸 n 葉、H/螺旋/Φ/V 型 Darrieus、Savonius)。目標是讓使用者能設計或評估創新外形——例如阿基米德螺旋(Liam F1 類)、封閉環形(loop)葉片、球形/蛋形扭轉殼——並放進同一套虛擬風洞(發電機、MPPT、報告、年發電量、方案比較)。

原則:

- 先依物理分類(升力型 / 阻力型 / 混合、實度、最佳 λ),再決定用哪個模型;外形只決定幾何怎麼建。
- **模型可信度要標示清楚**:BEM / DMST 是物理模型;自訂外形是 DMST 的延伸(高傾角段不可信);匯入曲線的準確度完全取決於資料來源。介面、摘要與報告都要顯示目前性能來自哪一種模型。
- 所有結果都受 Betz 極限約束;以掃掠(迎風投影)面積為基準比較 Cp。匯入 Cp > 0.593 要警告。

### 8A. 自訂性能曲線轉子(匯入 Cp–λ)

讓任何無法以 BEM/DMST 計算的外形(阿基米德螺旋、扭轉 Savonius、混合式……)都能用外部資料(論文、CFD、自己的風洞實驗)接上虛擬風洞。沿用 Savonius 經驗曲線的路徑(`savoniusCurve` → `curveArrays`)。

- [x] 核心 1/2(2026-10-09):`aero.mjs` 新增 `parseCpCurve(text)`(標題/註解略過、缺 Cq 以 Cp/λ 推得、λ 遞增檢查、Betz 警告)與 `customCurve(cfg)`(重取樣為 0.05 格點、λ→0 外插啟動轉矩,輸出格式同 `savoniusCurve`);測試含 Savonius 取樣後匯入 Cp/λopt 誤差 < 2%。
- [x] 核心 2/2(2026-10-09;`S.custom` 與 `vawt.type==='custom'` 已接上 `designVAWT`/`computePerf`,尚未加入 `VAWT_TYPES`/UI,待下一項「介面」):`core.mjs` 轉子類型 `custom` 與 `S.custom`、`designVAWT`/`computePerf` 接上 `customCurve`、`computePerf` 與內建 Savonius 一致的測試。(原規格:(狀態 `S.custom`:軸向 `h`/`v`、掃掠面積(由 R、H 計算或直接輸入)、特徵半徑(λ 的基準)、轉動慣量、曲線點);`aero.mjs` 或 `core.mjs` 新增 `parseCpCurve(text)`(每行 λ, Cp[, Cq];可含標題,λ 須遞增,缺 Cq 時以 Cp/λ 推得,λ→0 外插啟動轉矩)與 `customCurve(cfg)`(輸出與 `savoniusCurve` 相同格式)。測試:解析、Betz 警告、以 Savonius 經驗曲線取樣後匯入,`computePerf` 結果與內建 Savonius 一致(Cp、λopt 誤差 < 2%)。)
- [ ] 介面(放在現有面板即可,不等 8C):轉子型式加入「自訂性能曲線」;可貼上或匯入 CSV;內建 1–2 組**標示為「示意,非實測」**的範例曲線;3D 以簡化包絡(水平軸圓盤 / 垂直軸圓柱)示意。性能曲線分頁、虛擬風洞、MPPT、方案比較可運作;e2e 加入此轉子類型的 MPPT 追蹤率檢查(門檻同樣 ≥ 90%)。
- [ ] 報告與轉子摘要標示「性能來源:匯入曲線(使用者提供)」,並在模型限制段落說明;單葉片、流場工作區顯示「此轉子沒有幾何模型可分析」的說明(同 Savonius 做法)。
- 驗收:匯入資料後整套虛擬風洞、報告、年發電量可運作;資料來源與可信度清楚標示。

### 8B. 自訂垂直軸外形(r(z) 控制點 + 沿高度扭轉)

把 `vawtSlices()`(`aero.mjs`)從寫死的 H/Φ/V/螺旋改成通用的「半徑沿高度 r(z) + 扭轉相位沿高度 θ(z)」,DMST 本身不用改(已處理傾角 δ 與螺旋相位)。涵蓋圓角框環形、蛋形/球形 Darrieus、自訂螺旋等升力型外形。

- [ ] 核心:`vawtSlices` 支援 `type: 'custom'`(控制點 `[{zf, r}]` 以單調三次插值、`helix(zf)` 扭轉相位;傾角 δ 由 dr/dz 計算);既有 H/Φ/V/螺旋可用同一函式表示。測試:以控制點重建 Φ/V 型,Cp 與既有結果一致(< 1%);掃掠面積對照解析值(例如球形 πR²);既有參考值(H 型 0.333、Φ 型 0.357)不變。
- [ ] 3D 場景與 STL:沿 r(z) 曲線放樣翼型的通用 VAWT 葉片(`scene.mjs`、`geo.mjs`),取代各型式分開的建模;既有型式外觀不變。
- [ ] 介面第一版(放在現有面板):控制點數值表 + 內建樣板(H、Φ、蛋形、圓角框環形、球形)+ 外形預覽小圖;圖形化拖曳編輯器等 8C 方向確定後再做。
- [ ] 流場工作區(DMST 流管圖)與報告支援自訂外形;報告註明高傾角段(接近水平,|δ| > 60°)只計阻力、可信度較低。
- 已知限制:DMST 未含流線彎曲與動態失速(同第 5 項);接近水平的葉片段(例如環形的上下橫段)不產生轉矩,只計阻力。

### 8C. 介面重設計(方向需使用者決定)

現況問題:介面以「水平軸 / 垂直軸二選一 + 左側長表單」為核心,轉子型式的差異散落在 `ui`/`core`/`scene`/`flow`/`report`/`bench` 的條件分支(光是 `type === 'sav'` 就有 19 處),每加一種轉子就要改遍所有檔案。創新外形還需要:圖形化外形編輯、資料匯入、模型可信度標示、跨家族比較。

建議方向(待使用者確認):

- **轉子家族註冊表(技術重構)**:每個家族(傳統水平軸、Darrieus 各型、Savonius、自訂外形、匯入曲線……)註冊 `{ id, 名稱, 參數定義, design(), perf(), buildScene(), 面板, 可信度 }`,取代散落的條件分支。之後新增家族只要新增一個註冊項。
- **以設計流程重組畫面**:① 概念(家族樣板卡片:示意圖、典型 Cp 與 λ 範圍、可信度)→ ② 幾何(依家族顯示對應編輯器:截面表 / 外形曲線編輯器 / 曲線匯入)→ ③ 翼型 → ④ 虛擬風洞 → ⑤ 比較與報告。
- **方案比較升級為概念比較**:不同家族並列比較 Cp–λ、掃掠面積、年發電量、噪音、啟動風速、模型可信度。
- **模型可信度標章**貫穿全介面(摘要、圖表、報告)。

子步驟:

- [x] 8C-0 使用者決定(2026-10-09):
  1. **改成流程式介面**(概念 → 幾何 → 翼型 → 虛擬風洞 → 比較與報告)。
  2. **不再需要貼回 claude.ai 發佈**:放寬 `CLAUDE.md`「發佈環境限制」(見該節);仍須是純靜態網站、不需後端。
  3. **手機只需檢視**:手機版顯示 3D 風洞、圖表、方案/概念比較、報告;設計編輯只在桌面版完整提供(手機可隱藏或唯讀)。
- [ ] 8C-1 轉子家族註冊表重構(不改外觀;e2e 全過、桌面與手機截圖與重構前一致)。可在 8C-0 決定前由排程進行,因為不論介面方向如何都需要;建議在 8A 完成後、8B 介面之前做。
- [ ] 8C-2 流程式外殼:頂部步驟導覽(① 概念 ② 幾何 ③ 翼型 ④ 虛擬風洞 ⑤ 比較與報告),先把現有面板內容與工作區(風洞 / 單葉片 / 流場 / 報告)分配到各步驟,功能不減;保留「經典版面」切換一段時間,讓使用者比較、必要時退回。e2e 改用新導覽並保留既有檢查(匯出、MPPT ≥ 90%)。
- [ ] 8C-3 ① 概念頁:轉子家族卡片(示意圖、典型 Cp 與 λ 範圍、自啟動、模型可信度),由 8C-1 註冊表產生;選卡片即建立該家族的預設設計。另加「我的形狀該選哪條路」引導:(1) 垂直軸升力型、可用 r(z)+扭轉描述 → 自訂垂直軸外形(DMST 計算);(2) 有規律但現有模型算不了 → 參數化家族 + 匯入性能(例如 8D 阿基米德螺旋);(3) 完全自由的 CAD 外形 → 匯入外形(8E)+ 匯入性能。
- [ ] 8C-4 模型可信度標章:摘要、圖表標題、報告一致顯示性能來源(BEM / DMST / 自訂外形 DMST / 經驗曲線 / 匯入曲線)。
- [ ] 8C-5 ② 幾何:圖形化外形曲線編輯器(拖曳 r(z) 控制點、即時預覽與 Cp),供 8B 使用。
- [ ] 8C-6 ⑤ 概念比較:不同家族方案並列比較 Cp–λ(以掃掠面積為基準)、年發電量、噪音、啟動風速、可信度。
- [ ] 8C-7 手機檢視版:手機只保留檢視(3D 風洞、圖表、比較、報告),移除或唯讀化編輯控制項;簡化目前的手機設定面板。
- 技術原則:先沿用現有無框架寫法(字串產生 HTML + 現有 `grp()`/`rng()` 建構器),不做整體框架重寫;若某個編輯器確實需要套件,可用 npm 套件由 Vite 打包,並在 PR 說明理由。

### 8D. 參數化新家族:阿基米德螺旋(外形產生 + 匯入性能)

外形由參數產生(可看 3D、匯出 STL 去 3D 列印),性能來自匯入的 Cp–λ(8A)。目的在建立「工具設計外形 → 3D 列印 / CFD → 實測 Cp–λ 匯回 → 虛擬風洞系統模擬與概念比較」的開發循環。工具**不**計算螺旋轉子的 Cp。

- [ ] 幾何:`geo.mjs` 新增阿基米德螺旋葉片產生器(參數:外徑 D、軸向長度 L、錐角或外形包絡、葉片數、每片繞軸圈數 / 螺距、板厚、輪轂直徑),輸出 3D 網格;STL 匯出(mm,封閉實體可列印)。測試:網格封閉(每條邊被兩個三角形共用)、外徑與軸向長度符合參數、掃掠面積 = π(D/2)²。
- [ ] 家族註冊(依 8C-1 註冊表):3D 場景顯示、② 幾何步驟的參數面板;性能必須搭配匯入曲線(未匯入時提示並停用虛擬風洞),可信度標「匯入資料」。內建示意曲線須標明「示意,非實測」。
- [ ] 報告:列出幾何參數、性能資料來源與「本工具不計算螺旋轉子氣動性能」的說明。
- 之後同一模式可擴充其他家族(扭轉 Savonius、環形葉片水平軸等),每個家族一次一個 PR。

### 8E. 匯入外形(STL)

給完全自由的 CAD 外形使用:匯入 STL 做 3D 顯示、自動算掃掠(迎風投影)面積與特徵半徑,搭配 8A 匯入性能接上虛擬風洞;也可再匯出給 CFD。

- [ ] 核心:`geo.mjs` 新增 STL 解析(ASCII 與 binary)、單位判斷(mm / m,提供手動選擇)、旋轉軸指定(x / y / z)、繞軸旋轉包絡的投影面積(垂直軸:各高度最大半徑積分 ∫2r dz;水平軸:π·r_max²)與轉動慣量估計(假設均勻材料、可輸入密度)。測試:以程式產生的圓柱、圓盤、球的 STL 驗證面積與慣量解析值;binary / ASCII 結果一致。
- [ ] 介面:② 幾何步驟可上傳 STL(檔案只在瀏覽器內處理,不上傳任何地方),3D 場景顯示並以指定軸旋轉;性能需搭配匯入曲線,可信度標「匯入資料」。檔案大小上限與面數過多時的簡化或警告。
- 已知限制:不從 STL 計算氣動性能(需 CFD 或實驗);面積以旋轉包絡近似。

### 建議順序

8A 核心 → 8A 介面與報告 → 8C-1 註冊表重構 → 8C-2 流程式外殼 → 8C-3 概念頁 → 8C-4 可信度標章 → 8B 核心 → 8B 3D/STL → 8C-5 外形編輯器(即 8B 介面)→ 8C-6 概念比較 → 8C-7 手機檢視版 → 8D 阿基米德螺旋家族 → 8E 匯入外形(STL)。

8B 的「介面第一版(放在現有面板)」可省略,直接做在新流程的 ② 幾何步驟。
