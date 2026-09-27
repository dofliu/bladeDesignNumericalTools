# 風力機葉片設計與虛擬風洞

小型風力機的葉片設計、性能評估與虛擬風洞測試工具。整個應用是一個可離線開啟的 HTML 檔(3D 模型需連網載入 three.js)。

## 快速開始

```bash
npm run build      # 產生 dist/wind-turbine-designer.html
npm run serve      # 在 http://localhost:5173 開啟
npm test           # 氣動核心回歸測試
```

不想安裝任何東西時,直接用瀏覽器打開 `dist/wind-turbine-designer.html` 也可以。需要 Node.js 18 以上。

## 功能

- **翼型**:NACA 4/5 位數、圓弧板、匯入 Selig/Lednicer `.dat` 座標、貼上 XFOIL 極曲線;一支葉片可沿展長配置 2–6 種翼型
- **轉子**:水平軸 n 葉(BEM);垂直軸 H 型、螺旋型、Φ 型、V 型(DMST)與 Savonius
- **扭角設計**:BEM 數值最佳化、Schmitz 解析解、線性扭角,並可逐一手動修改截面
- **虛擬風洞**:風速、風向、紊流、陣風、偏航;發電機 + 升降壓轉換器 + MPPT(P&O、最佳尖速比、最佳轉矩、固定占空比)
- **單葉片工作區**:平面形狀與翼型配置、剖面與速度三角形、剖面疊圖、各剖面極曲線、沿展長氣動量
- **流場工作區**:翼型面板法速度/壓力場與流線、轉子流管
- **報告**:自動執行功率曲線、偏航、紊流/陣風、啟動測試,產生可下載的 HTML 報告
- **方案比較**、STL/CSV 匯出、深色模式、手機版版面

## 專案結構

```
src/            原始碼(依 scripts/build.mjs 的順序串接)
  shell.html    HTML 骨架與 CSS
  aero.js       氣動核心(可在 Node 測試)
  core.js       狀態、設計、模擬、控制器
  ui.js …       介面與各工作區
scripts/        建置腳本
tests/          Node 單元測試與瀏覽器 e2e 測試
dist/           建置結果(目前版本已附上)
docs/ROADMAP.md 開發路線圖
docs/AUTOPILOT.md 自動開發排程規則(每 6 小時一次)
CLAUDE.md       給 Claude Code 的專案說明
```

## 用 Claude Code 繼續開發

在專案根目錄啟動 Claude Code,它會自動讀取 `CLAUDE.md`。第一次可以這樣開始:

> 請先閱讀 CLAUDE.md 與 docs/ROADMAP.md,執行 npm test 與 npm run build 確認環境正常,然後告訴我你建議先做哪一項。

## 模型限制

極曲線為半經驗模型(非 XFOIL)、DMST 未含動態失速、流場為位勢流與流管近似。結果適合概念設計與方案比較,製造前建議以 XFOIL/CFD 或實體風洞驗證。
