# 葉片設計實驗排程(Blade Lab)規則

使用者 2026-10-27 決定另開一個每 12 小時執行一次的排程:**每次設計一個新的葉片(或轉子),並用本工具的設計核心與網頁介面驗證效能**,結果累積在 `designs/`。使用者已授權自動 commit → push → 建立 PR → 驗證通過後 squash merge 到 `main`,不需人工審查。每一次執行都要遵守本文件;要調整這個排程的行為,改這份檔案即可。

這個排程與 `docs/AUTOPILOT.md`(每 6 小時推進 ROADMAP)是兩個獨立的排程。分工如下:

| | Blade Lab(本文件)| Autopilot |
|---|---|---|
| 做什麼 | 設計新葉片、驗證、記錄結果 | 改程式、推進 ROADMAP |
| 可以改的檔案 | `designs/` 底下新增一個資料夾、`designs/LEADERBOARD.md`、本文件最下方的「實驗日誌」| `src/`、`tests/`、`docs/` 等 |
| PR 標題 | `[blade-lab] <設計名稱>:<一句話結論>` | `[autopilot] ...` |

## 每次執行的流程

1. **準備**
   - `git fetch origin && git checkout main && git pull`,從最新的 `main` 開始。
   - 讀 `CLAUDE.md`、本文件、`designs/LEADERBOARD.md`,以及最近 3 個設計的 `README.md`(特別是「下一次可以試」)。
   - 若有開著的 `[blade-lab]` PR:先把它處理完(驗證 → 合併,或說明後關閉),本次不再開新設計。
2. **提出一個新設計**
   - 必須和排行榜上既有設計**有實質差異**(不是只把某個數值微調 5%)。寫下一個可以被驗證或推翻的**假設**:想改善什麼指標、為什麼這樣改會有效、預期代價是什麼。
   - 輪流探索不同方向,不要連續三次都在同一個家族或同一個參數上打轉。可探索的設計空間(都是本工具已支援、`design.json` 可以表達的):
     - 水平軸:葉片數 `B`、設計尖速比 `tsr`、設計風速 `Vd`、半徑 `R` / 輪轂 `Rhub`、最大弦長 `maxChord`、弦長/扭轉倍率、扭角方式 `twMode`(`bem`/`schmitz`/`linear` + `twRoot`/`twTip`)、線性化 `linearize`、材料 `material`(`gfrp`/`wood`/`alu`/`pla`/`cfrp`)、槳距 `pitch`
     - 翼型站 `st`:1–6 站,`f` 為 r/R 位置,`k` 為翼型代碼(NACA 4 位數 `n4:xxxx`、5 位數 `n5:230xx`、圓弧板 `arc:5|8|10`,完整清單見 `src/core.mjs` 的 `AF_LIB`;寫錯 `lab:eval` 會列出可用代碼)
     - 垂直軸 `vawt.type`:`H`、`helical`、`phi`、`V`、`sav`(Savonius)、`free`;參數 `R`、`H`、`B`、`c`、`helix`、`struts`、`overlap`、`dynStall`、`curvature`,翼型 `vaf`
     - 風況 `wind`(Weibull 平均風速與 k)只在假設本身就是「為某種場址設計」時才改,並在 README 說明;排行榜比較預設都是 5.5 m/s、k 2
   - 可以先用 `lab/evaluate.mjs` 匯出的 `evaluate()` 在 Node 裡快速試幾個變體(幾秒內),再挑一個最有意義的正式記錄。**負面結果也是結果**:假設被推翻時照樣記錄,寫清楚學到什麼。
3. **建立設計檔** `designs/YYYYMMDD-<簡短英文代號>/design.json`(日期用 UTC):

   ```json
   {
    "schema": "blade-lab-v1",
    "id": "20261027-hawt-b4-lowtsr",
    "name": "四葉低尖速比(λd 5.5)",
    "date": "2026-10-27",
    "mode": "HAWT",
    "hypothesis": "……",
    "cfg": { "hawt": { "B": 4, "tsr": 5.5 }, "vawt": {}, "st": [ { "f": 0.2, "k": "n4:4421" } ], "vaf": "n4:0018", "load": {} },
    "wind": { "Vavg": 5.5, "k": 2 }
   }
   ```

   `cfg` 只寫與預設不同的欄位(預設值見 `src/core.mjs` 的 `S`);`id` 必須等於資料夾名稱。
4. **驗證**(全部都要跑,全部通過才可以合併)

   ```bash
   npm ci                                   # 需要 vite
   npm run lab:eval -- designs/<id>/design.json   # Node:設計核心 → metrics.json
   npm run build
   THREE_LOCAL=<three.min.js> npm run lab:ui -- designs/<id>   # 瀏覽器:載入 dist → 比對、報告、截圖
   npm run lab:board                        # 重建 designs/LEADERBOARD.md
   npm run check && npm test                # tests/lab.test.mjs 會檢查所有設計檔
   ```

   - `lab:eval` 量測:Cp,max 與最佳 λ、Cp ≥ 90% 的 λ 範圍、年發電量(理想 MPPT)、容量因數、LCOE 概估、質量、起轉風速(靜摩擦估算)、雜訊、水平軸的安全係數/葉尖撓度、時域模擬(6 與 9 m/s 穩定風的 MPPT 輸出與追蹤率;3/4/5 m/s 靜止起步 60 秒能否自行啟動),以及同模式預設設計的對照值。
   - `lab:ui` 用「方案比較 → 載入」同一條路徑(`loadSnap`)把設計載入建置好的網頁,檢查介面算出的 Cp,max、掃掠面積、質量與 `lab:eval` 一致,在「比較與報告」按「產生報告」跑完整的虛擬風洞測試並下載報告,存下 `tunnel.jpg`、`blade.jpg`、`report.jpg`、`mobile.jpg`。**自己打開截圖看過**,確認畫面上的葉片確實是這次的設計、沒有破版。
   - `report.html`(約 2–4 MB)只留在本機,已列入 `.gitignore`,不要 commit。
   - 環境(Playwright、`THREE_LOCAL`)的做法同 `docs/AUTOPILOT.md`「環境備忘」;`node_modules` 已存在時,用 `ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright`(`playwright-core` 同理)。
5. **寫 `designs/<id>/README.md`**,格式照既有設計:日期與相對基準的變更、假設、結果表(本設計 vs 基準 vs 差異)、介面驗證結果、結論(假設成立/不成立/部分成立,以及適合什麼場合)、模型限制、「下一次可以試」(2 個具體方向)、截圖。
6. **記錄**:在本文件最下方「實驗日誌」最上面加一行(日期、設計、一句話結論、PR 連結)。
7. **提交與合併**
   - 分支用工作階段指定的 `claude/` 開發分支;沒有就建 `claude/blade-lab-YYYYMMDD-HHMM`。
   - 建立 PR 前與合併前都 `git fetch origin main`,並列出開著的 `[blade-lab]` PR;若別的執行已經在做同樣的設計,關閉自己的 PR 並說明。
   - PR 內文:假設、主要數據(與基準比較)、驗證輸出摘要、結論、限制、下一次可以試。
   - 驗證全數通過 → squash merge。失敗且修不好 → 不合併、PR 保持開啟並說明。合併被權限擋 → PR 內文註明「等待手動合併」。合併後不要刪除遠端分支。
8. **通知**:用 PushNotification 送一則摘要(設計名稱、一句話結論、關鍵數字、PR 連結)。

## 誠實與限制

- 所有數值都是**本工具的模型預測**(半經驗極曲線 + Viterna、BEM / DMST / Savonius 經驗曲線、準穩態電氣),不是 XFOIL、CFD 或實測。README 與 PR 都要寫明,不可宣稱「實測」「證實」。
- 指標只適合方案之間的**相對比較**。若一個設計的優勢落在模型已知偏樂觀的區域(例如 DMST 高 λ、Re 很低的小弦長、超出極曲線資料範圍),要在結論特別註明。
- 不可為了讓設計看起來比較好而修改模型或預設值。

## 絕對不能做

- 不可修改 `src/`、`tests/`(除了新增設計資料夾讓 `tests/lab.test.mjs` 自動涵蓋)、`scripts/`、`lab/` 或其他排程的文件。發現工具的 bug、缺功能或模型問題 → 開一個 GitHub issue(標題前綴 `[blade-lab]`),寫清楚重現步驟,交給 Autopilot 或使用者處理,本次照常完成設計記錄(或改設計避開該問題)。
- 不可刪除或改寫其他既有設計的資料夾(結果因模型改版而需要重算時,只能用 `npm run lab:eval -- --all` 重新產生 `metrics.json`,並在 PR 說明)。
- 不可跳過或放寬任何測試;不可 force-push `main`;驗證失敗不可合併。
- 不可加入需要後端、API 金鑰或付費服務的東西。

## 給 Autopilot 的備註

`tests/lab.test.mjs` 會重算每個設計的 Cp,max 並與 `metrics.json` 比對(差 0.5% 以內)。若 Autopilot 合理地改了氣動模型導致這個測試失敗,在同一個 PR 執行 `npm run lab:eval -- --all && npm run lab:board` 更新所有設計結果,並在 PR 內文列出受影響的設計與新舊 Cp,max。這是允許的,不算「放寬測試」。

## 排程提示詞(在 claude.ai/code 建立 Routine 時貼上,間隔 12 小時)

```
你是 GitHub repo dofliu/bladeDesignNumericalTools(風力機葉片設計與虛擬風洞)的「葉片設計實驗」排程,每 12 小時執行一次。使用者已明確授權:每次設計一個新的葉片並用本工具驗證效能,自動 commit → push → 建立 PR → 驗證全數通過後 squash merge 到 main,不需人工審查。commit、PR、README 與日誌一律使用繁體中文(台灣用語)。不會有人在電腦前,請自動執行,不要詢問。

步驟:
1. 若容器裡沒有這個 repo,先用 add_repo(owner="dofliu", repo="bladeDesignNumericalTools", access="push") 加入並 clone。然後 git fetch origin && git checkout main && git pull。
2. 完整閱讀 CLAUDE.md 與 docs/BLADE_LAB.md,嚴格照 docs/BLADE_LAB.md 執行(包括「先處理未完成的 [blade-lab] PR」「與既有設計有實質差異」「絕對不能做」:不可修改 src/ 與測試)。
3. 讀 designs/LEADERBOARD.md 與最近幾個設計的 README,提出一個新設計與可驗證的假設,建立 designs/<id>/design.json。
4. 驗證:npm run lab:eval、npm run build、npm run lab:ui(THREE_LOCAL 與 playwright 做法見 docs/AUTOPILOT.md「環境備忘」)、npm run lab:board、npm run check && npm test。自己打開截圖確認。
5. 寫 designs/<id>/README.md 與 docs/BLADE_LAB.md 的實驗日誌,用工作階段指定的開發分支(沒有就建 claude/blade-lab-YYYYMMDD-HHMM)commit、push,用 GitHub MCP 工具建立標題為「[blade-lab] <設計名稱>:<一句話結論>」的 PR。
6. 驗證全數通過 → squash merge 到 main。沒通過且修不好 → 不合併,PR 保持開啟並說明。合併被權限擋 → PR 內文註明「等待手動合併」。
7. 用 PushNotification 通知使用者:設計名稱、一句話結論、關鍵數字(Cp,max、年發電量、起轉風速與基準比較)、PR 連結。

發現工具本身的 bug 或缺功能時,開 issue 記錄,不要自己改程式。所有數值都是模型預測,不可宣稱實測。
```

## 實驗日誌

最新的放最上面。

- 2026-10-28 — 五葉圓弧板低風速轉子(λd 4.5、木材):氣動部分成立(起轉風速 3.7 → 2.1 m/s、年發電量 +3.3%、質量 −32%),但極端工況安全係數 0.14、葉尖撓度 187 mm,結構不可行。
- 2026-10-27 — 四葉細長螺旋型垂直軸(弦長 0.10 m):假設大致成立,Cp,max 0.334 → 0.365、年發電量 +9%、質量 −49%、LCOE −7%;但仍無法自行啟動,且細長葉片位於 DMST 偏樂觀區。
- 2026-10-27 — 四葉低尖速比(λd 5.5):假設成立,起轉風速 3.7 → 2.7 m/s、模擬 4 m/s 可自行啟動,年發電量 +1.8%,代價質量 +56%、LCOE +1.5%。(示範設計,與規則同一個 PR 建立)
- 2026-10-27 — 基準:預設三葉水平軸(比較基準)。
