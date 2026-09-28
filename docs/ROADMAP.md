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
- [x] 載重(水平軸,設計點,穩態):`geo.js` 新增 `solveShellThickness(af, chord, targetArea)`,由目標截面積反解殼厚(area(t) 只在偏移多邊形自相交前的一段是嚴格遞增,超過該範圍會回跌甚至讓 `sectionProperties` 的 Ixx/Iyy 因自相交的多邊形算出負值;先粗掃描找出安全上界再二分,避免落入該不穩定區)。`core.js` 新增 `computeBladeLoads()`:用 `G.desElems`(設計點 BEM 結果)算每站推力/切向分布力,由葉尖往輪轂積分得揮舞/擺振彎矩;殼厚由目標面積(沿用 `designHAWT` 質量模型的 `mat.fill*airfoilArea*c²`,故結構質量與 `G.bladeMass` 一致)反解,取得每站 Ixx/Iyy 後算合成應力(絕對值疊加,忽略扭轉主軸旋轉)與離心軸向應力;再以彎矩/EI 雙重積分算葉尖撓度。`MATERIALS` 新增概估的楊氏模數 `E` 與容許應力 `sigAllow`(未對應特定資料表)。只支援水平軸設計點穩態工況,尚未涵蓋極端風速停機與疲勞。`tests/struct.test.mjs`:用均布假想載重驗證根部彎矩、葉尖撓度符合懸臂梁解析解(誤差 <2%);另外掃描全部 5 種材料驗證數值健全(面積/Ixx/Iyy 恆正、應力有限),此測試曾抓到 `solveShellThickness` 在 fill=1(實心,wood 材料)因浮點誤差落入不穩定區、算出負 Iyy 導致應力暴衝 5 個數量級的迴歸。
- [ ] 疲勞:以紊流測試時間序列做雨流計數,估計根部疲勞壽命(可先簡化)。
- [ ] 極端風速 / 停機工況:目前只算設計點穩態;需要另外算停機(高風速順槳或失速)與 IEC 小型風機 Class II 的 Vref 陣風工況下的載重與應力。
- [x] 單葉片工作區新增「結構」卡片(面積/Ixx/Iyy 沿展長圖 + 應力/撓度);報告新增一節。`bench.js` 新增 `drawStruct()`(合成應力 vs 容許應力圖 + 根部彎矩/離心力/最大應力/安全係數/葉尖撓度摘要),水平軸單葉片工作區新增「結構概估」卡片;`report.js` 在「葉片幾何」段落後新增結構概估小節,並在「模型說明與限制」補充本估算的簡化事項。
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
