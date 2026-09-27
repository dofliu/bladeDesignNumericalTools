# 自動開發日誌

最新的放最上面。規則見 `docs/AUTOPILOT.md`。

## 2026-09-27 — 設定排程

- 匯入 v0.9.0 原始碼;完成 ROADMAP 1 的「匯出 Blob 下載備援」(e2e 已涵蓋)。
- 建立每 6 小時一次的自動開發排程與本規則文件。
- 驗證:`npm run check`、`npm test`(6/6)、`npm run build`、`npm run test:e2e`(全數通過)。
- 下一步:ROADMAP 1 — 把 `src/*.js` 改成 ES modules + Vite(輸出仍為單一 HTML),再把 `core.js` 的模擬邏輯拆成不依賴 DOM 的模組、MPPT 回歸移到 Node 測試。
