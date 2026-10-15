# 風力機葉片設計與虛擬風洞

小型風力機的葉片/轉子設計、性能評估與虛擬風洞測試工具。整個應用是一個純靜態的 HTML 檔:不需要後端、帳號或 API 金鑰,可放在 GitHub Pages,也可以直接用瀏覽器打開。

> 使用方式請看 **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**(操作說明)。

## 快速開始

不想安裝任何東西:直接用瀏覽器打開 `dist/wind-turbine-designer.html`(repo 已附上建置好的版本)。

要從原始碼建置(需要 Node.js 18 以上):

```bash
npm ci             # 安裝建置工具 Vite
npm run build      # 產生 dist/wind-turbine-designer.html
npm run serve      # 建置後在 http://localhost:5173 開啟
npm test           # 數值核心與控制器單元測試(不需安裝套件)
```

連線需求:3D 場景使用的 three.js 從 cdnjs 載入,字型使用 Google Fonts。離線時 3D 風洞畫面無法顯示(其餘圖表、計算、報告都能用),字型會退回系統字型。你匯入的檔案(翼型座標、極曲線、Cp–λ 曲線、STL、風速資料)都只在瀏覽器內處理,不會上傳。

## 功能

**設計**

- **翼型**:NACA 4/5 位數、圓弧板、匯入 Selig/Lednicer `.dat` 座標、貼上 XFOIL 極曲線;一支葉片可沿展長配置 2–6 種翼型並線性混合
- **轉子家族(10 種)**
  - 水平軸 n 葉(BEM)
  - 垂直軸 Darrieus:H 型、螺旋型(Gorlov)、Φ 型、V 型、自訂外形 r(z)(DMST)
  - Savonius(經驗曲線)
  - 匯入性能曲線(貼上 Cp–λ)
  - 阿基米德螺旋(產生外形 + 匯入性能)
  - 匯入 STL 外形(+ 匯入性能)
- **扭角設計**:BEM 數值最佳化、Schmitz 解析解、線性扭角,並可逐一手動修改截面
- **自訂外形編輯器**:拖曳 r(z) 控制點、雙擊新增/刪除、鍵盤微調,內建蛋形、H、Φ、球形、圓角框環形樣板

**分析與測試**

- **虛擬風洞**:風速、風向、紊流、陣風、偏航;永磁發電機 + 整流 + 升降壓轉換器時域模擬;MPPT(P&O、最佳尖速比、最佳轉矩、固定占空比);保護(超速、過功率、切出風速停機/重啟、主動變槳、側偏收尾)
- **單葉片工作區**:平面形狀與翼型配置、剖面與速度三角形、剖面疊圖、各剖面極曲線、沿展長氣動量;水平軸另有彎矩、應力、撓度與截面性質
- **流場工作區**:翼型面板法速度/壓力場、流線、邊界層轉捩與分離點;轉子流管(致動盤 / DMST)與葉尖渦螺旋尾流
- **結構(水平軸)**:截面性質、設計點與極端風速(IEC Class II 停機)載重、安全係數、葉尖撓度、雨流計數疲勞壽命
- **其他評估**:BPM 噪音(1/3 八度頻譜、A 加權)、Weibull 或實測風速序列的年發電量與容量因數、材料/成本/LCOE 粗估
- **報告**:自動執行功率曲線、偏航、紊流、陣風、啟動測試,產生可下載或列印的 HTML 報告

**介面**

- 經典版面(風洞 / 單葉片 / 流場 / 報告分頁)與流程版面(① 概念 → ② 幾何 → ③ 翼型 → ④ 虛擬風洞 → ⑤ 比較與報告)
- 概念頁的轉子家族卡片與「我的形狀該選哪條路」引導
- 模型可信度標示貫穿摘要、圖表、報告與方案比較
- 方案比較(跨家族:Cp–λ、AEP、AEP/掃掠面積、起轉轉矩、噪音、LCOE)
- STL / CSV / ZIP 匯出、深色模式
- 手機版(只檢視:3D 風洞、圖表、比較、報告)

## 專案結構

```
src/              原始碼(全部是 ES modules)
  shell.html      HTML 骨架與全部 CSS
  main.mjs        Vite 入口:匯入各模組並掛上全域名稱
  aero.mjs        氣動核心:翼型、面板法、邊界層、極曲線、BEM、DMST、尾流(可在 Node 測試)
  geo.mjs         幾何:葉片放樣、STL/ZIP、截面性質、疲勞計數、螺旋與 STL 匯入
  core.mjs        狀態、轉子家族註冊表、設計、性能、發電機/控制器模擬、載重、噪音、成本
  charts.mjs      輕量 canvas 圖表
  scene.mjs       Three.js 3D 場景
  ui.mjs          設定面板、圖表分頁、方案比較、匯出、版面切換、主迴圈
  bench.mjs       單葉片工作區
  flow.mjs        流場工作區
  report.mjs      自動測試與報告
scripts/          建置(build.mjs)與語法檢查(check.mjs)
tests/            Node 單元測試(*.test.mjs)與瀏覽器 e2e 測試(e2e.smoke.mjs)
dist/             建置結果(單一 HTML,已附上)
docs/USER_GUIDE.md  使用說明
docs/ROADMAP.md     開發路線圖
docs/AUTOPILOT.md   自動開發排程規則(每 6 小時一次)
docs/AUTOPILOT_LOG.md 自動開發日誌
CLAUDE.md         給 Claude Code 的專案說明(架構、慣例、參考數值)
```

## 測試

```bash
npm run check      # 所有原始碼語法檢查
npm test           # 90 項單元測試:翼型/極曲線/BEM/DMST 參考值、結構、疲勞、噪音、STL、MPPT 追蹤率等
npm run test:e2e   # 對 dist 成品的瀏覽器測試:畫面、流程版面、外形編輯器、STL 上傳、匯出、報告、MPPT 回歸
```

e2e 需要 Playwright 與 Chromium(`npm i --no-save playwright && npx playwright install chromium`)。three.js 無法連線取得時,用 `THREE_LOCAL=path/to/three.min.js` 指定本機檔案(可用 `npm pack three@0.128.0` 取得)。

## 用 Claude Code 繼續開發

在專案根目錄啟動 Claude Code,它會自動讀取 `CLAUDE.md`。第一次可以這樣開始:

> 請先閱讀 CLAUDE.md 與 docs/ROADMAP.md,執行 npm test 與 npm run build 確認環境正常,然後告訴我你建議先做哪一項。

## 模型限制

極曲線為半經驗模型(非 XFOIL);DMST 的動態失速與流線彎曲只是選用的簡化修正;流場為位勢流與流管近似,不是 CFD;阿基米德螺旋與 STL 外形不計算氣動性能,性能完全來自匯入的資料;結構、噪音、成本都是概念設計等級的估計。結果適合概念設計與方案比較,製造前建議以 XFOIL/CFD 或實體風洞驗證。

## 授權

MIT,見 `LICENSE`。
