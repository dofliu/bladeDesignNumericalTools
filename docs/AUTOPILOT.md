# 自動開發排程(Autopilot)規則

使用者已授權:由排程每 6 小時啟動一次 Claude Code 雲端工作階段,依 `docs/ROADMAP.md` 順序推進一小步,**自動 commit → push → 建立 PR → 合併到 `main`**。每一次執行都要遵守本文件;要調整自動開發的行為,改這份檔案即可(排程本身只叫 Claude 讀這裡)。

## 每次執行的流程

1. **準備**
   - `git fetch origin && git checkout main && git pull`,從最新的 `main` 開始。
   - 讀 `CLAUDE.md`、`docs/ROADMAP.md`、本文件與 `docs/AUTOPILOT_LOG.md`(最後幾筆)。
   - 同一時間可能有多個排程工作階段在跑(2026-09-28 曾有約 20 個同時跑、對同一個 ROADMAP 子項開了 18 個重複 PR)。所以除了開頭檢查,**建立 PR 前與合併前都要再 `git fetch origin main` 並列出開著的 `[autopilot]` PR**:若 `main` 已經包含同一個子項的變更,或已有別的開著的 PR 在做同一項,就關閉自己的 PR、不要合併(PR 留言說明重複),本次結束。
2. **先處理未完成的自動 PR**
   - 若 repo 裡有標題以 `[autopilot]` 開頭、仍開著的 PR:先把它處理完(修好 → 驗證 → 合併;或確認做不下去就關閉並在日誌說明),**本次不再開新工作**。
3. **選工作**
   - 取 `docs/ROADMAP.md` 中第一個尚未完成(沒有劃掉 / 沒標「已完成」)的項目或子項目。若 ROADMAP 開頭有「目前優先」標註,先做該項(依該項的「建議順序」),標示「需使用者決定」的子步驟跳過。
   - 切成**一次執行做得完、可以單獨驗證**的小步(約 1–3 小時的工作量、diff 盡量 < 800 行,不含 `dist/`)。大項目(例如 Vite 遷移、XFOIL 整合)分多次完成,每次都要讓專案維持可建置、可用的狀態。
   - 在 ROADMAP 該項下方用 `- [x]` / `- [ ]` 記錄拆分後的子步驟,讓下一次執行知道進度。
4. **開發**
   - 分支:**一律使用工作階段指定的 `claude/` 開發分支**;若沒有指定,建立 `claude/autopilot-YYYYMMDD-HHMM`(UTC)。不要用其他前綴:`claude/` 以外的分支在 push 前會被額外檢查,可能擋住無人值守的執行。
   - 遵守 `CLAUDE.md` 的程式風格、發佈環境限制(單一 HTML、claude.ai artifact 相容)與模型誠實說明。
   - 動到 `aero.js` 必須補測試;動到控制器 / 模擬必須跑 e2e。
5. **驗證(全部通過才可以合併)**
   ```bash
   npm run check && npm test && npm run build
   # e2e(雲端容器的做法見下方「環境備忘」)
   THREE_LOCAL=<three.min.js 路徑> npm run test:e2e
   ```
   - 另外用 Playwright 截圖桌面 1440×900 與手機 390×844 各至少一張受影響的畫面,自己看過確認沒有破版。
   - `dist/wind-turbine-designer.html` 必須是本次原始碼重新建置的結果,一起 commit。
6. **提交與合併**
   - commit 訊息、PR 標題與內文一律繁體中文。PR 標題格式:`[autopilot] <ROADMAP 項次>:<這次做了什麼>`。
   - PR 內文包含:做了什麼、為什麼、驗證結果(貼上測試輸出摘要)、已知限制、下一步。
   - 驗證全數通過(且依步驟 1 的重複檢查確認沒有撞車)→ 以 **squash merge** 合併到 `main`。合併後**不要刪除遠端分支**(刪除遠端分支會被 auto mode 分類器當成破壞性動作擋下,讓執行卡住)。
   - 驗證沒通過且本次修不好 → **不要合併**;PR 保持開啟,在 PR 內文說明卡在哪裡,下一次執行會先處理它(見步驟 2)。
7. **記錄**
   - 在 `docs/AUTOPILOT_LOG.md` 最上方新增一筆(日期、PR 連結、摘要、測試結果、下一步),與功能變更放在同一個 PR。
   - 完成的 ROADMAP 項目標記「已完成」。

## 絕對不能做

- 不可跳過、停用、刪除或放寬既有測試與門檻(例如 MPPT 追蹤率 ≥ 90%、`tests/aero.test.mjs` 的參考值)來讓驗證通過。參考值若因模型改良而**合理地**改變,必須在 PR 內文說明理由與新舊數值。
- 不可 force-push 到 `main`、不可改寫 `main` 的歷史。
- 不可在驗證失敗時合併。
- 不可加入需要後端伺服器、API 金鑰或付費服務的功能;不可讓 dist 去 fetch 白名單以外的網站。
- 不可刪除使用者的檔案或大幅重寫與本次工作無關的程式。
- 不可修改本文件的「絕對不能做」一節(其他段落可在 PR 中說明理由後調整)。

## 何時停下來

- ROADMAP 全部完成 → 在日誌記一筆「路線圖已完成」,不再開 PR。
- 某項需要使用者決定(例如要不要放棄 claude.ai 相容、選哪個材料資料庫)→ 開一個 `[autopilot] 需要決定:...` 的 PR 或 issue 描述選項與建議,跳到下一個不相依的項目。
- 連續兩次執行都卡在同一個問題 → 在日誌與 PR 說明,改做下一個不相依的項目。

## 無人值守:不要讓執行卡住

排程啟動的 prompt 不算使用者即時同意,執行中沒有人會回答問題或核准提示。所以:

- 不要提問後等回覆;需要決定的事照上一節開 issue,然後繼續做別的。
- 避開 auto mode 分類器預設會擋的動作:刪除遠端分支 / tag、`git reset --hard`、force push、修改 `.claude/settings.json` 等權限設定(自我修改權限一律會被擋,只能由使用者本人改)。
- 某個動作被擋下(permission denied / classifier)→ 不要換個方式繞過,略過它,在 PR 內文與日誌寫清楚是哪個動作、為什麼需要,留給使用者處理。

## 環境備忘(Claude Code 雲端容器)

- Node 22 與 Playwright(全域安裝,Chromium 在 `/opt/pw-browsers`,容器已設定 `PLAYWRIGHT_BROWSERS_PATH`,不必另設 `CHROME_PATH`)已預裝。e2e 用 ESM `import 'playwright'`,不吃 `NODE_PATH`,可以暫時 `ln -sfn /opt/node22/lib/node_modules node_modules` 再執行,跑完用 `rm -f node_modules` 刪掉這個連結,**不要 commit**。若專案已加入 devDependencies,改用 `npm ci`。
- cdnjs 可能被網路政策擋住:`npm pack three@0.128.0 && tar xzf three-0.128.0.tgz package/build/three.min.js`,把 `THREE_LOCAL` 指到解出的檔案(放在 scratchpad,不要放進 repo)。
- 沒有 `gh` CLI:用 GitHub MCP 工具(`mcp__github__create_pull_request`、`mcp__github__merge_pull_request` 等)建立與合併 PR。
