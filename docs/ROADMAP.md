# 開發路線圖

依「對設計可信度的提升 ÷ 工作量」排序。每項都附上建議做法與驗收方式。開始前請先與使用者確認順序。

## 1. 工程基礎整理(建議最先做)

- 把 `src/*.js` 改成 ES modules,用 Vite 建置;仍輸出單一 HTML(`vite-plugin-singlefile`),保留貼回 claude.ai 的能力。項目大,拆成以下子步驟逐一完成,每步都要維持可建置、`npm test`/`npm run test:e2e` 全過:
  - [x] 加入 `vite` 為 devDependency;把 `charts.js`/`geo.js`(無跨檔案依賴的兩個葉節點模組)改寫成真正的 ES module(`src/charts.mjs`/`src/geo.mjs`,具名 `export`),`scripts/build.mjs` 改用 Vite 的 `build({ build: { lib } })` API 把每個 `.mjs` 打包成指定全域名稱(`Plot`/`GEO`)的 IIFE,其餘檔案的字串串接與執行順序不變。`scripts/check.mjs` 一併掃 `.mjs`。
  - [ ] 用同樣模式轉 `scene.js`(依賴 `AERO`?先確認無跨檔案全域依賴,或改成 `import`)。
  - [ ] 轉 `aero.js`、`core.js`:這兩個已經是 Node/瀏覽器雙模組匯出的 IIFE,要改成拿掉 IIFE、直接 `export`,同時保留 `tests/aero.test.mjs`、`tests/core.test.mjs` 現有的 Node `require`/`import` 相容性(可能要把測試也改成 `import`)。`core.js` 用到 `AERO` 需改成 `import * as AERO from './aero.mjs'`。
  - [ ] 轉 `ui.js`、`bench.js`、`flow.js`、`report.js`:這四個檔互相與對 `S`/`G`/`SIM`/`AERO`/`Plot`/`GEO`/`Scene3D` 的依賴最多,逐一補上 `import`,是風險最高的一批,建議一次一個檔案、每次都跑完整驗證。
  - [ ] 全部檔案都是 ES module 後,把 `scripts/build.mjs` 換成單一 Vite 設定(`vite-plugin-singlefile`,入口為 `src/shell.html` 或新的 `src/main.js`),移除手動字串串接;確認 dist 仍是單一 HTML、< 16 MB、外部資源白名單不變。
  - 驗收(整體,子步驟完成時逐步核對):`npm test` 涵蓋控制器;dist 行為與現版一致(e2e 全過、截圖比對)。
- ~~把 `core.js` 的設計與模擬邏輯拆成不依賴 DOM 的模組(目前 `simStep` 只能在瀏覽器測),把 MPPT 回歸測試移到 Node 單元測試。~~ 已完成:`core.js` 改成與 `aero.js` 相同的 Node/瀏覽器雙模組匯出(IIFE + `module.exports` / `Object.assign(root, API)`),不影響串接組建後的全域變數溝通;`tests/core.test.mjs` 直接在 Node 跑 HAWT/VAWT 三種控制器 × 兩種風速的追蹤率回歸(門檻同 e2e 的 90%),`npm test` 現在幾秒內就能驗證控制器邏輯。`tests/e2e.smoke.mjs` 的瀏覽器版回歸保留,作為建置後成品(dist)的端對端驗證。
- ~~補上匯出視窗在非 claude.ai 環境的 Blob 下載備援(`ui.js` 的 `openExport` / `save`)。~~ 已完成,e2e 已涵蓋。

## 2. 真實翼型資料:XFOIL 整合

目前極曲線是半經驗模型,這是精度最大的瓶頸。

- 做法 A(建議):新增 `tools/xfoil/`,用 Node 或 Python 呼叫本機 XFOIL,批次產生各翼型在 Re 5×10⁴–2×10⁶ 的極曲線,輸出 JSON 放進 `data/polars/`,建置時內嵌;介面上標示「XFOIL 資料」vs「估算」。
- 做法 B:提供本機 API 服務(FastAPI)即時計算,但發佈到 claude.ai 時無法使用,需保留備援。
- 同時可建立翼型資料庫:建置時從 UIUC Airfoil Database 抓取座標(瀏覽器端有 CORS 限制,要在建置階段做)。
- 驗收:NACA 4412 @Re 10⁶ 的 Clmax、最佳 L/D 與 XFOIL/實驗文獻誤差在 5% 內;BEM Cp 變化記錄在測試中。

## 3. 葉片結構分析

- 截面性質:依翼型外形 + 殼厚/材料計算面積、慣性矩、形心(可用多邊形積分)。
- 載重:由 BEM 的 dT/dr、dQ/dr 加離心力,算根部彎矩、各截面應力、葉尖撓度;極端風速(例如 IEC 小型風機 Class II 的 Vref)與停機工況。
- 疲勞:以紊流測試時間序列做雨流計數,估計根部疲勞壽命(可先簡化)。
- 單葉片工作區新增「結構」卡片;報告新增一節。
- 驗收:與懸臂梁解析解比對撓度;材料安全係數低於門檻時給出警告。

## 4. 額定以上控制與保護狀態機

- 目前額定以上只靠降轉速(軟失速),發電機壓不住時會反覆觸發保護。
- 新增:側偏收尾(furling)模型、變槳選項、切出風速與重新啟動邏輯(停機 → 等待平均風速下降 → 重啟)。
- 驗收:16–25 m/s 不再反覆跳脫;報告功率曲線呈現平台與切出。

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
- 經濟性:材料成本、LCOE 粗估。
- 介面:英文語系、報告 PDF 直接輸出(需處理中文字型)。
