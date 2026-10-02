# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-10-02 — ROADMAP 4:時域模擬接上主動變槳

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`S.load.pitchCtl`(預設關閉)啟用後,水平軸以 Cq(λ,β) 查表縮放氣動轉矩,額定以上維持額定轉速並由功率誤差 + 超速量驅動槳距(速率限制 `pitchRate`,煞車時順槳),取代軟失速降轉速。面板開關、報告條件列、`tests/core.test.mjs` 新測試、ROADMAP 子步勾選。
- 驗證:`npm run check`、`npm test`(34/34)、`npm run build`(203 KB)、離線 e2e 全過(MPPT 追蹤率 95–97%);Playwright 桌面 1440×900 與手機 390×844 無頁面錯誤。
- 已知限制:平衡點電功率約為額定 91%(超速項偏置);槳距表以設計風速 `G.Vref` 的 Re 建立;報告尚無變槳專屬結論;側偏收尾未做。
- 下一步:報告變槳結論/e2e,或 ROADMAP 4 側偏收尾。

## 2026-10-01 — ROADMAP 4:離線變槳調節分析

- 做了什麼:啟動時無開著的 `[autopilot]` PR。ROADMAP 1 只剩「可選」的單一 Vite 設定(且需新增相依、收益低),依規則跳到下一個可獨立驗證的項目。`core.mjs` 新增 `pitchRegulation()`(額定轉速下,逐風速二分搜尋使氣動功率降到發電機上限的最小順槳角);`tests/core.test.mjs` 新增測試;更新 ROADMAP 拆分子步。
- 驗證:見 PR 內文(check/test/build/e2e 與截圖)。預設 HAWT:14 m/s 8.8°、16 m/s 13.8°、20 m/s 21.2°、25 m/s 28.5°,功率平台 3368 W。
- 已知限制:僅離線分析,時域模擬仍用軟失速降轉速;未含致動器速率限制與 UI。
- 下一步:ROADMAP 4 時域模擬接上變槳(Cp(λ,β) 查表 + 開關)。

## 2026-09-30 — ROADMAP 4:報告功率曲線涵蓋切出風速

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/report.mjs` 的自動功率曲線測試在啟用切出風速時,風速範圍延伸到「切出風速 + 2 m/s」(上限 25 m/s);切出後的理想 MPPT 曲線與追蹤率基準歸零,圖表 x 軸與結論文字(保護觸發/未觸發)隨實際測試範圍調整。未啟用切出時行為不變(3–15 m/s)。更新 ROADMAP。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(201 KB)、離線 e2e 全過(MPPT 追蹤率 95–97%);Playwright 桌面/手機無頁面錯誤,切出 18 m/s 時跑 `Report.runTests` 至 20 m/s,輸出於 19 m/s 起降為 0、之前呈現平台。
- 已知限制:報告測試耗時隨風速點增加;變槳與側偏收尾仍未做。
- 下一步:ROADMAP 4 變槳選項或側偏收尾;ROADMAP 1 最後一步(build.mjs 換單一 Vite 設定,可選)。

## 2026-09-30 — ROADMAP 1:ui.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/ui.js` → `src/ui.mjs`:頂層函式/常數加具名 `export`;`SNAPS` 改 `const` 陣列原地修改(避免 `Object.assign(globalThis, …)` 後複本過期);`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `ui: 'UIMod'` 並加入 `EXPAND_GLOBALS`。更新 ROADMAP。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(201 KB)、離線 e2e 全過(MPPT 追蹤率 95–97%);Playwright 桌面 1440×900 與手機 390×844 無頁面錯誤,方案比較儲存/顯示正常。
- 已知限制:其他 `let` 狀態變數(`opElems` 等)僅在 ui 內部使用,未匯出。
- 下一步:ROADMAP 1 最後一步(`build.mjs` 換單一 Vite 設定,可選);ROADMAP 4 變槳/側偏收尾。

## 2026-09-30 — ROADMAP 1:bench.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/bench.js` → `src/bench.mjs`:共用繪圖工具與 `Bench` 改具名 `export`;`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `bench: 'BenchMod'` 並加入 `EXPAND_GLOBALS`,讓 flow/report/ui 仍可用裸全域 `fitCv`/`arrow`/`interp1`/`card`/`Bench`。更新 ROADMAP。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(216 KB)、離線 e2e 全過(MPPT 追蹤率 95–98%);Playwright 桌面 1440×900 與手機 390×844 開啟單葉片分頁,無頁面錯誤、排版正常。
- 已知限制:只剩 `ui.js` 為全域腳本串接。
- 下一步:ROADMAP 1 轉 `ui.js`,最後把 `build.mjs` 換成單一 Vite 設定;ROADMAP 4 變槳/側偏收尾。

## 2026-09-30 — ROADMAP 1:flow.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/flow.js` → `src/flow.mjs`(`export const Flow`);`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `flow: 'FlowMod'` 並加入 `EXPAND_GLOBALS`,讓 `ui.js`/`report.mjs` 仍可用裸全域 `Flow`。更新 ROADMAP。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(225 KB)、離線 e2e 全過(MPPT 追蹤率 94–97%);Playwright 桌面 1440×900 與手機 390×844 開啟流場分頁,無頁面錯誤、排版正常。
- 已知限制:`ui.js`/`bench.js` 仍為全域腳本串接。
- 下一步:ROADMAP 1 轉 `bench.js`、`ui.js`;ROADMAP 4 變槳/側偏收尾。

## 2026-09-29 — ROADMAP 1:report.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/report.js` → `src/report.mjs`(`export const Report`);`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `report: 'ReportMod'`,並加入 `EXPAND_GLOBALS`,讓 `ui.js` 仍可直接使用裸全域 `Report`。更新 ROADMAP。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(233 KB)、離線 e2e 全過(MPPT 追蹤率 95–97%);Playwright 桌面 1440×900 與手機 390×844 開啟報告分頁,無頁面錯誤、排版正常。
- 已知限制:`ui.js`/`bench.js`/`flow.js` 仍為全域腳本串接。
- 下一步:ROADMAP 1 轉 `flow.js`/`bench.js`/`ui.js`;ROADMAP 4 變槳/側偏收尾。

## 2026-09-29 — ROADMAP 3:疲勞分析(雨流計數 + Miner)

- 做了什麼(使用者在互動工作階段指定):`geo.mjs` 新增 ASTM E1049 雨流計數、Miner 損傷(Basquin + Goodman)、等效應力範圍;`MATERIALS` 補 `su`/`m`;`core.mjs` 新增 `G.loads.root`、`rootStress()`、`fatigueEstimate()`;報告紊流測試記錄葉根應力,「葉片結構」一節新增疲勞段落、應力時間序列圖與低壽命結論。
  - 修正:木材(實心)截面反解錯誤,預設木材葉片最小安全係數由誤報的 0.35 變為 4.9(極端工況 0.60 → 1.98);`geo.mjs` 另加浮點容差讓剛好半厚的殼判為實心。`tests/core.test.mjs` 新增五種材料各站面積對得上質量模型的回歸。
- 驗證:`npm run check`、`npm test`(32/32)、`npm run build`(239 KB)、離線 e2e 全過;瀏覽器實跑報告,疲勞段落與圖正常(預設玻纖:約 3100 個循環、1 Hz 等效應力範圍約 4.6 MPa、壽命 > 10,000 年)。
- 已知限制:葉根、單一風況、準靜態、僅 HAWT;手機版報告預覽寬 613 px 超出畫面(既有行為,main 相同)。
- 下一步:ROADMAP 4 變槳/側偏收尾;ROADMAP 1 轉 `ui.js` 等;疲勞可延伸為 Weibull 加權多風速。

## 2026-09-29 — ROADMAP 3:結構截面圖與報告結構一節

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/bench.js` 沿展長圖新增「截面積與慣性矩」檢視(面積、Ixx、Iyy);`src/report.js` 新增「葉片結構」一節(HAWT):材料、根部彎矩/離心軸力、設計點與極端風速停機工況最小安全係數、葉尖撓度、五站截面表,安全係數 < 1.5 標紅,並附模型限制說明。更新 ROADMAP。
  - 順手修掉截圖時發現的真實錯誤:根部厚截面(t/c 0.21)的等效殼厚二分搜尋因內偏移多邊形自我翻折而不單調,得到殼厚 23 mm、第 3 站 Ixx 為負值,葉尖撓度算成 231 m(ROADMAP 先前標註「tipDefl 數量級待查證」即此)。`geo.mjs` 的 `equivalentThickness` 上限改為半個翼型厚度,`sectionProperties` 在殼厚 ≥ 半厚時視為實心;預設 HAWT 葉尖撓度變為約 36 mm。`tests/core.test.mjs` 新增 Ixx 為正/不隨外側增加、葉尖撓度 < 0.1R 的回歸。
- 驗證:見 PR 內文。
- 已知限制:僅 HAWT;疲勞、屈曲、扭轉、分項安全係數未做。
- 下一步:ROADMAP 3 疲勞(雨流計數);ROADMAP 4 變槳/側偏收尾;ROADMAP 1 轉 `ui.js` 等。

## 2026-09-29 — ROADMAP 1:core.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/core.js` → `src/core.mjs`:拿掉雙模組 IIFE,改 `import * as A from './aero.mjs'`、`import * as GEO from './geo.mjs'` 與具名 `export`;`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `core: 'CORE'`,新增 `EXPAND_GLOBALS`,在 IIFE 後接 `Object.assign(globalThis, CORE)`,ui/bench/flow/report 不必改;`tests/core.test.mjs` 改直接 import,不再設定全域。更新 CLAUDE.md 與 ROADMAP。
- 驗證:`npm run check`、`npm test`(27/27)、`npm run build`(233 KB)、離線 e2e 全過(MPPT 追蹤率 95–97%),桌面 1440×900 與手機 390×844 截圖正常。
- 已知限制:`ui.js`/`bench.js`/`flow.js`/`report.js` 仍是全域腳本串接;`Object.assign` 為匯出快照,若其他檔案需要重新指派 core 的變數需注意(與舊做法相同)。
- 下一步:ROADMAP 1 轉 `ui.js`/`bench.js`/`flow.js`/`report.js`(一次一個);或 ROADMAP 3 報告結構一節。

## 2026-09-29 — ROADMAP 1:aero.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/aero.js` → `src/aero.mjs`:拿掉雙模組 IIFE,改具名 `export`;`scripts/build.mjs` 的 `ESM_GLOBAL` 加 `aero: 'AERO'`(Vite lib 打包成全域 `AERO`);`tests/aero|geo|core.test.mjs` 改用 `import * as A from '../src/aero.mjs'`;更新 CLAUDE.md 與 ROADMAP。
- 驗證:`npm run check`、`npm test`(27/27)、`npm run build`(231 KB,Vite 樹搖掉未用內部函式)、離線 e2e 全過(MPPT 追蹤率 92–97%),桌面截圖正常。
- 已知限制:`core.js`/`ui.js`/`bench.js`/`flow.js`/`report.js` 仍是全域腳本串接。
- 下一步:ROADMAP 1 轉 `core.js`(改 import `AERO`/`GEO`);或 ROADMAP 3 報告結構一節。

## 2026-09-29 — ROADMAP 1:scene.js 轉成 ES module

- 做了什麼:啟動時無開著的 `[autopilot]` PR。`src/scene.js` → `src/scene.mjs`:拿掉 IIFE 包裝,改具名 `export`(`init`/`buildHAWT`/`buildVAWT`/`buildSavonius`/`frame`/`setScale`/`applyTheme`/`view`/`colors`);`scripts/build.mjs` 的 `ESM_GLOBAL` 加入 `scene: 'Scene3D'`,由 Vite 打包成 `Scene3D` 全域。`scene` 只依賴外部全域 `THREE`,對其他模組無依賴。
- 驗證:`npm run check`、`npm test`(27/27)、`npm run build`(246 KB)、離線 e2e 全過(MPPT 追蹤率 92–97%),桌面 1440×900 與手機 390×844 截圖 3D 場景正常。
- 已知限制:`aero.js`/`core.js`/`ui.js`/`bench.js`/`flow.js`/`report.js` 仍是全域腳本串接。
- 下一步:ROADMAP 1 轉 `aero.js`/`core.js`(拿掉雙模組 IIFE);或 ROADMAP 3 的報告結構一節。

## 2026-09-29 — ROADMAP 1:修好 PR #12(charts.js / geo.js → 真正 ES modules)

- 做了什麼:啟動時依規則檢查未完成的 `[autopilot]` PR,發現只剩一個開著的 PR #12(「把 charts.js / geo.js 改成真正的 ES modules,建置改用 Vite 打包」),依規則先處理完它,本次不開新工作。核對 PR #12 的 diff(對它宣稱的合併基底 `707ae40`)後發現與先前 PR #9 同一種錯誤:分支的本地檢出比 `707ae40` 還舊,commit 記錄的是更舊的狀態——`src/geo.mjs` 整個遺漏了 `polygonMoments`/`offsetPolygon`/`sectionProperties`/`equivalentThickness`/`beamDeflection`(ROADMAP 3 已完成的截面性質/應力/撓度功能),還一併刪掉了 `src/aero.js` 的 `cumulativeOutboard`/`cumulativeMoment`、`core.js` 的 `bladeLoads`/`G.loads`,以及 `tests/geo.test.mjs` 整個檔案與 `tests/aero.test.mjs`/`tests/core.test.mjs` 對應的測試。逐一核對後確認 `src/charts.js` 沒有這個問題(自 `707ae40` 後未變動,PR 轉出的 `charts.mjs` 逐行核對只多了 `export`),`scripts/build.mjs`(對已轉 ESM 的檔案改用 Vite `build({ build:{ write:false, lib:{...}, formats:['iife'] } })` 打包成指定全域名稱的 IIFE,其餘檔案仍字串串接)、`scripts/check.mjs`(掃描 `.js`/`.mjs`)、`package.json`(新增 `vite` devDependency)這三處改動本身乾淨可重用。
  - 沒有合併/cherry-pick PR #12 的 commit,改成手動在目前 `main`(已含 ROADMAP 3 完整的 `geo.js`)上重做:`src/charts.js` → `src/charts.mjs` 直接照抄 PR 版本;`src/geo.mjs` 依目前完整的 `geo.js` 內容逐一加上 `export`(含 #24 新增的 `equivalentThickness`/`beamDeflection`,以及 `sectionProperties` 回傳值新增的 `yMax`/`xMax`),內部輔助函式(`signedArea`/`aboutCentroid`/`ellipseAf`/CRC 表等)維持不匯出;`scripts/build.mjs`/`scripts/check.mjs`/`package.json` 套用 PR 版本的改法;`tests/geo.test.mjs`/`tests/core.test.mjs` 改用靜態 `import * as GEO from '../src/geo.mjs'` 取代 `require('../src/geo.js')`(`aero.js`/`core.js` 仍是 CommonJS,`require` 不變);`package-lock.json` 用 `npm install` 重新產生(不採用 PR 裡的版本)。
  - 中途插曲:推送前重新 `git fetch origin main` 才發現另一個並行的排程執行同一時段也判斷出 PR #12 的同一個問題(commit 內容損毀),選擇了不同的處理方式——直接留言關閉 PR #12(不修復),改做 ROADMAP 3 的其他子項(見下面「單葉片工作區顯示結構量」「極端風速停機工況載重」兩篇,已先合併到 main)。兩邊對「PR #12 不能直接合併」的判斷一致,只是後續選擇不同(關閉 vs. 修好重做);兩者不衝突,已 rebase 本分支到最新 main 上。
- 為什麼:「把 charts.js/geo.js 轉成真正 ES modules、Vite 只對這兩個檔案做 lib 模式打包」這個技術路徑本身是合理的(繞開了 2026-09-27 踩點發現的「Vite 進入點只認 type=module」限制,且風險與 diff 都很小),值得保留,而不是整個放棄 ROADMAP 1 這條路線;PR #12 的 commit 內容本身損毀,直接合併會讓 main 上已完成的結構分析功能整個消失(與處理 PR #9 時的判斷一致)。手動依目前 `main` 重做,只保留兩個真正未變動的葉節點模組(charts/geo)與建置腳本改動,不採用任何會刪除既有函式或測試的部分。
- 驗證:`npm run check`(9 個檔案全過,含新的 `charts.mjs`/`geo.mjs`)、`npm test`(rebase 後 28/28,含全部既有的截面性質/載重/應力撓度/切出風速/Weibull/極端風速測試,證實這次改法沒有遺失任何功能)、`npm install` + `npm run build`(dist 裡確認 `GEO`/`Plot` 全域正確掛上 `sectionProperties`/`equivalentThickness`/`beamDeflection` 等函式)、離線 `npm run test:e2e`(暫時把 `node_modules` 換成指到 `/opt/node22/lib/node_modules` 的連結以解析全域安裝的 Playwright,`CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`、`THREE_LOCAL` 指到 `npm pack three@0.128.0` 解出的檔案,跑完後把 `node_modules` 換回來,沒有 commit 那個連結,全過:3 種匯出、12 組追蹤率回歸 92–97%)。另外用 Playwright 對桌面 1440×900(風洞、單葉片工作區,含使用 `GEO`/`Plot` 的葉片平面圖、速度三角形、極曲線圖表)與手機 390×844(風洞)各截圖確認排版正常、圖表數字合理,無破版。
- 已知限制:與 PR #12 原本相同——`scene.js`、`aero.js`、`core.js`、`ui.js`、`bench.js`、`flow.js`、`report.js` 這 7 個檔案仍是全域腳本字串串接,尚未變成 ES module;`vite-plugin-singlefile` 尚未接入,`scripts/build.mjs` 是「手動字串串接 + 針對已轉換模組的 Vite lib 打包」過渡態做法。另外,這次事故再次證實高並行度排程下,若本地檢出與遠端不同步,`git commit` 可能記錄下錯誤的(比自己宣稱的合併基底還舊的)內容而不易察覺——僅檢查 PR 標題/檔案清單不夠,合併前必須實際核對 diff 是否刪除了不相關的既有函式或測試。
- 下一步:ROADMAP 1 子步驟 2——用同樣模式轉換 `scene.js`(先確認它對其他全域的依賴方向)。之後依序 `aero.js`/`core.js`(拿掉既有雙模組 IIFE,改真正 `export`)、`ui.js`/`bench.js`/`flow.js`/`report.js`,最後把 `scripts/build.mjs` 換成單一 `vite-plugin-singlefile` 設定。ROADMAP 3(單葉片工作區結構卡片的 tipDefl 數量級待查證、疲勞分析)、ROADMAP 4(變槳/側偏收尾)、ROADMAP 7(匯入實測風速時間序列)仍可獨立進行。ROADMAP 1(完整 ESM 遷移的最終形態)、2(XFOIL 整合)的踩點結論仍列在 `docs/ROADMAP.md`,需要使用者對其中選項做一次決定。

## 2026-09-28 — ROADMAP 3:單葉片工作區顯示結構量

- 做了什麼:啟動時唯一開著的 `[autopilot]` PR 是 #12(ES modules/Vite)。它基於過期 main,其 `geo.mjs` 會刪掉後來合併的截面性質/撓度函式,且引入首個 npm 相依並需使用者決定 ESM 方向,故留言後關閉、不合併。改做 ROADMAP 3 的 UI 小步:`src/bench.js` 沿展長圖新增「彎矩 / 合成應力(含容許應力線、最小安全係數)/ 揮舞撓度」三個檢視,資料取自 `G.rows` 與 `G.loads`。
- 驗證:見 PR 內文。
- 已知限制:只有 HAWT;報告尚未新增結構一節;面積/Ixx/Iyy 圖未做。
- 下一步:ROADMAP 3 報告結構一節,或極端風速載重。

## 2026-09-29 — ROADMAP 3:極端風速停機工況載重

- 做了什麼:啟動時無開著的 `[autopilot]` PR。ROADMAP 1、2 仍待使用者決定,依序做 ROADMAP 3 下一個未完成子項。`src/core.js` 新增 `EXTREME`(IEC 61400-2 Class II Vref 42.5 m/s、Ve50 = 1.4 Vref = 59.5 m/s、Cn 1.2),`bladeLoads` 增加停機(ω=0)全失速工況:每站法向力 0.5ρVe²·c·dr·Cn,沿用 `cumulativeMoment`、等效殼厚截面性質與 `beamDeflection`,得到 `G.loads.extreme`(根部揮舞彎矩、葉尖撓度、最小安全係數)與各站 `MflapExt/stressExt/safetyExt`。
- 驗證:`npm run check`、`npm test`(27/27,新增 1 個以解析和比對根部彎矩〔誤差 <1e-6〕並檢查單調、極端彎矩 > 設計點)、`npm run build`、離線 e2e(結果見 PR)。此次未改 UI(預期無畫面差異)。
- 已知限制:僅揮舞向、無方位/偏航組合、無分項安全係數;UI/報告尚未顯示。順帶觀察:既有的 `G.loads.tipDefl` 預設值約 231(單位/數量級偏大,疑似需檢查單位或殼厚假設),下次做結構卡片時應先查證。
- 下一步:ROADMAP 3「單葉片工作區結構卡片」(先查證 tipDefl 數量級),或疲勞分析。

## 2026-09-28 — 清理重複 PR + ROADMAP 7:Weibull 年發電量與容量因數

- 做了什麼:啟動時依規則檢查未完成的 `[autopilot]` PR,發現 2026-09-28 上午同時段的並行排程事故(`docs/AUTOPILOT.md` 已記錄過的「約 20 個同時跑、18 個重複 PR」)這次留下了 13 個開著的重複 PR(#10、#11、#13–#18、#20、#22、#23 皆為「葉片載重/應力/撓度」或「切出風速」的重複實作,#14 為「截面性質」的重複實作),對應功能其實都已經在更早的排程執行中完成並合併到 `main`(PR #4、#5、#24,以及 2026-09-27 的截面性質)。逐一在 PR 內留言說明原因後全部關閉,不合併。
  - 剩下兩個開著的 PR(#9「Weibull 年發電量」、#12「charts.js/geo.js 轉 ES modules」)不是重複項,但都是從同一次事故當時的 `main`(commit `707ae40`)分支出來的。檢查 #9 的 diff 後發現嚴重問題:雖然它的分支基底 `707ae40` 已經包含 `aero.js` 的 `cumulativeOutboard`/`cumulativeMoment` 與 `geo.js` 的 `sectionProperties`/`polygonMoments`/`offsetPolygon`(截面性質與載重功能),但 #9 的單一 commit 卻把這些函式整個刪掉、`core.js` 的 `bladeLoads()`/`G.loads` 也一併移除——研判是那個工作階段的本地檢出與遠端 `main` 不同步造成的意外回退。若直接合併或 cherry-pick 會讓 main 上已完成的結構分析功能整個消失,所以沒有採用它的 commit,改成只挑出其中真正屬於「Weibull 年發電量」的新增內容(`core.js` 的 `gammaFn`/`weibullPdf`/`capacityFactor`、`S.perf.k`;`ui.js` 性能曲線與方案比較分頁的 Weibull k 輸入框、容量因數欄位/圖表標題;`report.js` 摘要卡的容量因數;`shell.html` 的 `.opts` CSS 修正,讓手機版兩個工具列輸入框不會黏在一起;`tests/core.test.mjs` 的 4 個新測試),手動在目前的 `main` 上重新套用,完全略過 #9 分支上那些意外的刪除。#9 已留言說明後關閉。#12(ES modules/Vite 第一步)本身的 diff 沒有這個問題(只新增/搬移 `charts.js`/`geo.js`,未觸碰載重相關程式),但改動較大(新增第一個 npm 相依套件、動到建置流程),決定留到下一次執行單獨處理與驗證,避免這次 diff 過大。
  - `S.perf.k`(預設 2,等於原本寫死的 Rayleigh 分布,k=2 時與舊公式逐點代數相等,不改變任何既有預設輸出)可在「性能曲線」與「方案比較」分頁調整(1.2–3.5);年發電量圖表標題、方案比較表格、報告摘要卡都新增容量因數欄位。
- 為什麼:規則要求先處理完未完成的自動 PR 才能開新工作;13 個重複 PR 若放著不管,之後的排程執行會反覆花時間重新檢查、增加撞車風險,所以先清乾淨。#9 的內容本身(Weibull 參數法年發電量)是 ROADMAP 7 明確列出的做法,工作量小、可完全用 Node 純函式測試驗證,k=2 時與舊值逐點相等不會造成回歸,值得救回來重做一次乾淨的版本,而不是整個放棄。
- 驗證:`npm run check`(9 個檔案全過)、`npm test`(26/26,含新增的 4 個 `gammaFn`/`weibullPdf`/`capacityFactor` 測試,以及既有的載重/應力/撓度/切出風速測試全部維持通過,證實這次改法沒有動到那些功能)、`npm run build`(260 KB)、離線 `npm run test:e2e`(`THREE_LOCAL` 指到本機解出的 `three@0.128.0`,全過:3 種匯出、12 組追蹤率回歸 95–97%)。另外用 Playwright 手動截圖桌面 1440×900 的「性能曲線」(Weibull k 輸入框、年發電量圖表含容量因數)、「方案比較」(容量因數欄)、「報告」預覽(五欄摘要卡含容量因數)與手機 390×844 首頁,確認排版正常、數字正確顯示,無破版。
- 已知限制:與 #9 原本列出的相同——容量因數與 AEP 都是「理想 MPPT、未考慮風向/紊流損失」的粗估;尚未支援匯入實測風速時間序列。另外,這次事故顯示自動排程在高並行度下可能因為本地檢出過期而產生內容錯誤(而非只是重複)的 commit,建議之後排程執行在建立 commit 前,除了 `git fetch origin main` 之外,也用 `git diff --stat <base>..HEAD` 檢查自己即將 commit 的 diff 有沒有意外刪除不相關的既有函式,及早發現這類問題。
- 下一步:ROADMAP 7 可選擇補時間序列匯入,或轉回其他項目。ROADMAP 1 的 #12(ES modules/Vite 第一步,charts.js/geo.js → .mjs)內容本身看起來乾淨可用,下次執行建議先重新驗證(它同樣基於已過期的 `main`,需要確認與這次改動、以及更早合併的截面性質/載重程式碼相容後再合併)。ROADMAP 3 下一步仍是「極端風速(IEC Class II Vref)與停機工況的載重」或「單葉片工作區新增結構卡片」。ROADMAP 1(完整 ESM 遷移)、2(XFOIL 整合)的踩點結論仍列在 `docs/ROADMAP.md`,需要使用者對其中選項做一次決定。

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
