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
- [ ] 載重:由 BEM 的 dT/dr、dQ/dr 加離心力,算根部彎矩、各截面應力、葉尖撓度;極端風速(例如 IEC 小型風機 Class II 的 Vref)與停機工況。
  - [x] 分布載重與彎矩:`core.js` 新增 `bladeLoads(rows, elems, omega, rho)`,在 `designHAWT()` 設計點 BEM 解(`resD.elems`)算出每站揮舞向(flapwise,thrust-like)與擺振向(edgewise,torque-like)的分布氣動力,呼叫新的 `aero.js` 通用函式 `cumulativeMoment`/`cumulativeOutboard`(離散懸臂梁:外側點力對某站的彎矩/軸力累加,`tests/aero.test.mjs` 用等分布載重解析解 M=w(L-x)²/2 驗證)沿展長累加成揮舞彎矩;離心軸力則用既有質量迴圈已算出的每站質量 `x.dm` × ω²r 累加。結果存回 `G.rows[i].{Mflap,Medge,Fax,dFz,dFy}` 與 `G.loads.{MflapRoot,MedgeRoot,FaxRoot,omega}`(`designVAWT()` 目前設 `G.loads=null`,垂直軸的結構模型留待之後)。
  - [x] 應力與撓度:`geo.js` 新增 `equivalentThickness(af, chord, targetArea)`(對 `sectionProperties` 的面積做二分搜尋,反解殼厚,如建議用 `MATERIALS[x].fill*airfoilArea*c²` 當目標面積,對齊既有質量模型,沒有新增使用者可調欄位)與 `sectionProperties` 新增回傳 `yMax`/`xMax`(形心到外緣的最大距離,彎曲應力用)、`beamDeflection(rows, M, EI)`(彎矩/EI 曲率由根部往葉尖梯形積分兩次)。`core.js` 的 `bladeLoads` 延伸:對每一站反解等效殼厚 → `sectionProperties` 取 Ixx/Iyy → 揮舞彎曲應力(`Mflap·yMax/Ixx`)、擺振彎曲應力(`Medge·xMax/Iyy`)、離心軸向應力(`Fax/area`)保守直接相加成 `x.stress`,安全係數 `x.safety = mat.allow/x.stress`;揮舞撓度 `x.defl` 用 `beamDeflection` 積分。`MATERIALS` 補上楊氏模數 `E` 與容許應力 `allow` 的合理文獻預設值(玻纖 20 GPa/100 MPa、木材 11 GPa/40 MPa、鋁 69 GPa/110 MPa、PLA 2.3 GPa/20 MPa、碳纖 70 GPa/250 MPa)。`G.loads` 新增 `tipDefl`、`minSafety`。`tests/geo.test.mjs`/`tests/core.test.mjs` 各新增測試(解析解驗證 `beamDeflection`、`equivalentThickness` 面積回代、真實設計點的應力/撓度/安全係數沿展長合理性)。
  - [ ] 極端風速(IEC Class II Vref)與停機工況的載重。
- [ ] 疲勞:以紊流測試時間序列做雨流計數,估計根部疲勞壽命(可先簡化)。
- [ ] 單葉片工作區新增「結構」卡片(面積/Ixx/Iyy 沿展長圖 + 之後的應力/撓度);報告新增一節。
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
- 經濟性:材料成本、LCOE 粗估。
- 介面:英文語系、報告 PDF 直接輸出(需處理中文字型)。
