# 開發路線圖

依「對設計可信度的提升 ÷ 工作量」排序。每項都附上建議做法與驗收方式。開始前請先與使用者確認順序。

## 1. 工程基礎整理(建議最先做)

- 把 `src/*.js` 改成 ES modules,用 Vite 建置;仍輸出單一 HTML(`vite-plugin-singlefile`),保留貼回 claude.ai 的能力。
  - 排程踩點(2026-09-27):試過「先只換建置工具、src 檔案維持原樣全域變數寫法」這條路——Vite 的 HTML 進入點只會打包 `<script type="module">`,plain `<script src="...">`(現在 9 個檔案的寫法)一律跳過不處理(`can't be bundled without type="module" attribute`,連複製都不會)。也就是說沒有「先換工具、之後再逐檔案轉 ESM」這種零風險小步——要嘛全部 9 個檔案一次改成真正的 `import`/`export`(全域變數溝通全部要重新設計,diff 會遠超過小步門檻),要嘛放棄這條路線。已還原所有嘗試改動(未 commit)。下次執行前建議先跟使用者確認:(a) 接受一次較大的 PR 做完整 ESM+Vite 遷移,或 (b) 改用更輕量的方案(例如單純用 esbuild 的 IIFE 多檔 bundle 取代手寫字串串接,不強求「ES modules」字面意義),或 (c) 這項先擱置,主力做其他項目。
- ~~把 `core.js` 的設計與模擬邏輯拆成不依賴 DOM 的模組(目前 `simStep` 只能在瀏覽器測),把 MPPT 回歸測試移到 Node 單元測試。~~ 已完成:`core.js` 改成與 `aero.js` 相同的 Node/瀏覽器雙模組匯出(IIFE + `module.exports` / `Object.assign(root, API)`),不影響串接組建後的全域變數溝通;`tests/core.test.mjs` 直接在 Node 跑 HAWT/VAWT 三種控制器 × 兩種風速的追蹤率回歸(門檻同 e2e 的 90%),`npm test` 現在幾秒內就能驗證控制器邏輯。`tests/e2e.smoke.mjs` 的瀏覽器版回歸保留,作為建置後成品(dist)的端對端驗證。
- ~~補上匯出視窗在非 claude.ai 環境的 Blob 下載備援(`ui.js` 的 `openExport` / `save`)。~~ 已完成,e2e 已涵蓋。
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
- [x] 載重(HAWT,設計點,無極端風速/停機工況):`aero.js` 的 `bemPoint` 每一站的回傳現在多帶 `dT`/`dQ`(單一葉片、該環形的集中力/力矩,已含 dr)。`geo.js` 新增 `bendingMomentProfile`(懸臂樑集中力彎矩)、`axialForceProfile`(離心力沿展長累加的軸向拉力)、`beamCurvatureDeflection`(M/EI 梯形法雙重積分得撓度)、`sectionSeries`(逐站用二分法找殼厚,使面積對齊質量模型的 `mat.fill`)、`bladeStructure(rows, afs, elems, mat, omega)` 整合上述,回傳每站彎矩/軸力/應力與根部彎矩、葉尖撓度、最大應力、安全係數。`core.js` 的 `MATERIALS` 補上 `E`(楊氏係數)與 `sigmaAllow`(容許應力,文獻常見數量級的參考預設值,非特定產品實測);`designHAWT()` 算完質量後呼叫 `GEO.bladeStructure` 存進 `G.structure`。`tests/geo.test.mjs` 以等分布載重懸臂樑(彎矩、撓度解析解)、等線密度旋轉桿(離心力解析解)與參考轉子(3 葉 R1.5 m λ7)驗證;`tests/aero.test.mjs` 驗證 `dT`/`dQ` 逐站加總等於 BEM 總推力/轉矩。已知簡化:彎曲只算繞截面自身弦向軸(未依當地扭角轉換,忽略擺振/扭矩造成的彎曲)、未含極端風速(IEC Vref)與停機工況、未含動態/疲勞與軸向拉力的剛化效應、VAWT 尚未涵蓋(DMST 非定常負載與幾何不同)。目前 `G.structure` 只有資料,還沒有 UI 顯示。
- [ ] 疲勞:以紊流測試時間序列做雨流計數,估計根部疲勞壽命(可先簡化)。
- [ ] 極端風速(IEC 小型風機 Class II 的 Vref)與停機工況下的載重;VAWT(DMST)版本的載重估算。
- [ ] 單葉片工作區新增「結構」卡片(面積/Ixx/Iyy 沿展長圖 + 之後的應力/撓度);報告新增一節。
- 驗收(需上面全部完成):與懸臂梁解析解比對撓度;材料安全係數低於門檻時給出警告。

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
