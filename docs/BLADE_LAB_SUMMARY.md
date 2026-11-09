# 葉片設計實驗總結與交接(截至 2026-11-09)

給後續接手的人(或 Claude)的**一頁式總覽**:目前累積的 27 個葉片設計、各家族的比較結論、已學到的設計規律、模型限制與尚未解決的事。逐項細節請看各設計的 `designs/<id>/README.md`;規則與實驗日誌見 [BLADE_LAB.md](BLADE_LAB.md)。

> 所有數值都是**本工具的模型預測**(半經驗極曲線 + Viterna、BEM / DMST / Savonius 經驗曲線、準穩態電氣),不是 XFOIL、CFD 或實測,只適合方案之間的相對比較。

互動版總覽(可排序、含散佈圖):[blade-lab-overview.html](blade-lab-overview.html),用瀏覽器直接開啟即可;資料快照為 2026-11-09,之後的設計請看 `designs/LEADERBOARD.md`。

## 1. 目前有什麼

- 設計數:27 個(水平軸 18、垂直軸 9;探索 22、深入研究 5),全部放在 `designs/YYYYMMDD-<代號>/`。
- 每個設計資料夾:`design.json`(設計輸入)、`metrics.json`(Node 評估結果)、`README.md`(假設、結果、結論、下一次可以試)、`tunnel.jpg` `blade.jpg` `report.jpg` `mobile.jpg`(介面截圖)、`model/`(`blade.stl`、`rotor.stl`、`rotor.blend`、產生腳本)。
- 彙整檔(`npm run lab:board` 自動產生,勿手改):`designs/LEADERBOARD.md`(排行榜)、`designs/CANDIDATES.md`(深入研究候選與下一次該探索或深入)、`designs/stats.csv`(全部指標,含 BOM,可用 Excel 開)、`designs/progress.svg`(標準場址 LCOE 趨勢圖)。
- 不在 repo:`report.html`(2–4 MB,已列入 `.gitignore`,要看請重跑 `npm run lab:ui`)。
- **3D 模型檔的覆蓋範圍**:3D 模型(排程步驟 8)是 2026-11-01 前後才加入流程,早期設計(baseline、`hawt-b4-lowtsr`、`vawt-helical-b4-slender`、`hawt-b5-arcplate`、`hawt-b5-cfrp-thick`、`vawt-savonius-b3`,以及 `phi`、`v-b3-r2`、`hawt-b2-hightsr`、`hawt-b3-linear` 等)缺部分或全部 STL / .blend;需要時可執行該設計的 `model/make_model.mjs`(沒有就複製較新設計的版本改名),`.blend` 用 `python3 blender_import.py` 產生(需 `pip install bpy`,見 §6)。
- 上傳到共用雲端硬碟的 3D 模型:**尚未執行**(排程提示詞第 8 步提到「統一的雲端硬碟資料夾」,但沒有指定資料夾 ID,Claude 不猜測)。要補傳請在排程提示詞寫明 Drive 資料夾 ID。

## 2. 比較表

欄位:年發電量與 LCOE 都是**標準場址**(Weibull 平均 5.5 m/s、k 2,理想 MPPT)的重算值,方便跨設計比較;LCOE 單位 NT$/kWh;「標記」中「場址 x m/s」表示該設計原本是為其他場址設計(它自己場址的數字在其 README);「前緣」= 柏拉圖前緣(在標準場址 LCOE、年發電量、起轉風速三項上沒有被同模式其他可行設計全面勝過),**不等於推薦**,例如 Savonius 因起轉風速最低也在前緣上。

### 水平軸(18 個)

| 設計 | Cp,max | 標準場址年發電量 kWh | 標準場址 LCOE | 質量 kg | 起轉風速 m/s | 極端安全係數 | 標記 |
|---|---|---|---|---|---|---|---|
| [基準:預設三葉水平軸](../designs/20261027-baseline/README.md) | 0.478 | 4758 | 2.75 | 4.3 | 3.7 | 2.65 | 基準 |
| [四葉低尖速比(λd 5.5)](../designs/20261027-hawt-b4-lowtsr/README.md) | 0.486 | 4845 | 2.79 | 6.7 | 2.7 | 3.45 |  |
| [五葉圓弧板低風速轉子(λd 4.5、木材)](../designs/20261028-hawt-b5-arcplate/README.md) | 0.494 | 4915 | 2.70 | 2.9 | 2.1 | 0.14 | 結構不可行 |
| [五葉低風速轉子(λd 4.5、CFRP、根部加厚)](../designs/20261028-hawt-b5-cfrp-thick/README.md) | 0.493 | 4906 | 2.92 | 5.1 | 2.2 | 4.61 |  |
| [兩葉高尖速比水平軸(λd 9、薄翼型、CFRP)](../designs/20261031-hawt-b2-hightsr/README.md) | 0.470 | 4684 | 2.82 | 1.4 | 5.6 | 3.61 | 需輔助起轉 |
| [三葉易製造線性化葉片(線性弦長與線性扭角、木材)](../designs/20261101-hawt-b3-linear/README.md) | 0.451 | 4484 | 2.74 | 4.5 | 2.9 | 2.65 |  |
| [三葉高風速場址轉子(Vd 11 m/s、λd 8、弦長上限 0.10 m、CFRP)](../designs/20261102-hawt-b3-highwind/README.md) | 0.475 | 4727 | 2.81 | 1.9 | 6.5 | 3.28 | 場址 7.5 m/s、需輔助起轉 |
| [四葉低風速場址大轉子(R 2.2 m、Vd 4.5 m/s、λd 5、GFRP,Vavg 4 m/s)](../designs/20261102-hawt-b4-lowwind/README.md) | 0.502 | 10758 | 2.86 | 37.3 | 1.3 | 4.52 | 場址 4 m/s、前緣 |
| [三葉低風速場址中型轉子加限額發電機(R 1.9 m、Vd 4.5 m/s、λd 5.5、額定 1.5 kW,Vavg 4 m/s)](../designs/20261103-hawt-b3-lowwind-cap/README.md) | 0.492 | 5406 | 1.78 | 21.5 | 1.4 | 6.58 | 場址 4 m/s |
| [三葉低風速場址轉子限額 1.0 kW(深入研究:掃描發電機額定,R 1.9 m、λd 5.5,Vavg 4 m/s)](../designs/20261104-hawt-b3-lowwind-p1000/README.md) | 0.492 | 4372 | 1.83 | 21.5 | 1.4 | 6.58 | 深入、場址 4 m/s |
| [三葉五站翼型加 Schmitz 解析扭角(λd 6.5,根部 5 位數厚翼型到葉尖 6409)](../designs/20261105-hawt-b3-schmitz-5st/README.md) | 0.477 | 4748 | 2.76 | 4.9 | 3.3 | 3.40 |  |
| [四葉低風速場址大轉子限額 1.5 kW(深入研究:掃描 Pmax、λd、弦長上限,R 2.2 m,Vavg 4 m/s)](../designs/20261105-hawt-b4-lowwind-p1500/README.md) | 0.500 | 6279 | 1.77 | 26.4 | 1.4 | 3.02 | 深入、場址 4 m/s、前緣 |
| [三葉線性化木製葉片加固定負槳距 −2°](../designs/20261106-hawt-b3-linear-pitchm2/README.md) | 0.471 | 4699 | 2.76 | 4.5 | 3.7 | 2.65 |  |
| [四葉低風速限額 1.5 kW 轉子改線性化葉片(深入研究:掃描扭角方式、線性化、λd、槳距,R 2.2 m,Vavg 4 m/s)](../designs/20261107-hawt-b4-lowwind-lin/README.md) | 0.489 | 6217 | 1.73 | 18.6 | 1.7 | 3.18 | 深入、場址 4 m/s、前緣 |
| [四葉低風速大轉子限額 1.5 kW 線性化木製葉片(深入研究:扭角方式、線性化、材料、槳距掃描,R 2.2 m,Vavg 4 m/s)](../designs/20261107-hawt-b4-lowwind-linwood/README.md) | 0.489 | 6217 | 1.67 | 26.7 | 1.5 | 3.53 | 深入、場址 4 m/s、前緣 |
| [四葉低風速大轉子線性化木製葉片:根部 4421 + 中外段圓弧板(arc:10→arc:8,Vavg 4 m/s)](../designs/20261108-hawt-b4-lowwind-arcmid/README.md) | 0.501 | 6284 | 1.63 | 17.9 | 1.6 | 0.58 | 場址 4 m/s、結構不可行 |
| [六葉低尖速比木製轉子(λd 4、根部 4418 / 中段 4412 / 葉尖 6409)](../designs/20261108-hawt-b6-lowtsr-wood/README.md) | 0.495 | 4922 | 2.72 | 10.1 | 1.9 | 1.79 |  |
| [五葉小型轉子(R 1.0 m、λd 5)外段圓弧板 + 中段 4412 混合翼型玻纖葉片,限額 300 W](../designs/20261109-hawt-b5-r1-arctip/README.md) | 0.487 | 1260 | 1.68 | 2.1 | 1.9 | 1.75 |  |

### 垂直軸(9 個)

| 設計 | Cp,max | 標準場址年發電量 kWh | 標準場址 LCOE | 質量 kg | 起轉風速 m/s | 標記 |
|---|---|---|---|---|---|---|
| [四葉細長螺旋型垂直軸(弦長 0.10 m)](../designs/20261027-vawt-helical-b4-slender/README.md) | 0.365 | 2060 | 3.00 | 5.3 | 2.8 | 需輔助起轉、前緣 |
| [三葉 Savonius 阻力型垂直軸(重疊比 0.25、端板)](../designs/20261029-vawt-savonius-b3/README.md) | 0.159 | 626 | 6.35 | 37.8 | 0.7 | 可信度中低、前緣 |
| [兩葉 Φ 型垂直軸放大(R 1.5 m、開啟流線彎曲與動態失速)](../designs/20261030-vawt-phi-b2-r15/README.md) | 0.343 | 1941 | 3.02 | 5.7 | 2.8 | 需輔助起轉 |
| [三葉 Φ 型(打蛋器)垂直軸(弦長 0.12 m、NACA 0015)](../designs/20261030-vawt-phi-b3/README.md) | 0.379 | 1431 | 3.06 | 6.7 | 2.5 | 需輔助起轉、前緣 |
| [三葉 V 型垂直軸(頂端 R 2 m、弦長 0.12 m、NACA 0018)](../designs/20261031-vawt-v-b3-r2/README.md) | 0.332 | 1882 | 3.16 | 7.8 | 2.7 | 需輔助起轉、可信度中低、前緣 |
| [三葉 V 型垂直軸(弦長 0.12 m、NACA 0018)](../designs/20261101-vawt-v-b3/README.md) | 0.306 | 866 | 3.32 | 6.1 | 2.4 | 需輔助起轉、可信度中低、前緣 |
| [三葉桶形自訂外形垂直軸(r(z) 兩端收 25%、NACA 0015、開啟動態失速與流線彎曲)](../designs/20261103-vawt-free-barrel/README.md) | 0.350 | 1969 | 2.96 | 4.8 | 2.9 | 需輔助起轉、可信度中低、前緣 |
| [三葉沙漏形自訂外形垂直軸(r(z) 兩端 1.0R、腰部 0.75R、NACA 0015)](../designs/20261104-vawt-free-hourglass/README.md) | 0.341 | 1814 | 2.99 | 4.7 | 2.8 | 需輔助起轉、可信度中低 |
| [四葉 H 型垂直軸負槳距 −3°(弦長 0.12 m、NACA 0015)](../designs/20261106-vawt-h-b4-toeout/README.md) | 0.373 | 2101 | 2.99 | 7.6 | 2.8 | 需輔助起轉、前緣 |

## 3. 各家族的結論

**水平軸**
- 預設三葉轉子(λd 7、R 1.5 m)Cp,max 0.478、起轉風速 3.7 m/s,4 m/s 無法自啟動(模型預期行為)。
- 增加葉片數、降低 λd(4–5.5)可把 Cp,max 提到 0.49–0.50,起轉風速降到 1.9–2.7 m/s,代價是質量與(用 CFRP 時)成本。六葉 λd 4 木製(`20261108-hawt-b6-lowtsr-wood`):Cp,max +3.5%、LCOE −1.1%、起轉 3.7 → 1.9 m/s,質量 4.3 → 10.1 kg、極端安全係數 2.65 → 1.79。
- 高 λd(兩葉 λd 9)起轉風速 5.6 m/s、需輔助起轉;三葉高風速場址轉子自身場址 LCOE 最低(1.40,Vavg 7.5 m/s)但 3–5 m/s 都不能自啟動。
- 低風速場址(Vavg 4 m/s)大轉子(R 1.9–2.2 m):不限額時 LCOE 7.05;加限額發電機(1.0–1.5 kW)後降到約 2.8–3.1;標準場址下最佳額定會上移,所以「限額」是場址相依的決策。
- 線性化葉片(線性弦長與扭角)Cp,max 損失約 2–6%,質量最多 −30%;木材成本表使 LCOE 看起來較低,但線性化本身 LCOE 約 +1%。
- 固定負槳距對水平軸:三葉線性化 −2° 使 Cp,max +4.4% 但起轉風速 2.9 → 3.7 m/s;低風速轉子槳距 ±2° 皆使 Cp,max −5%。
- 圓弧板翼型氣動有利(Cp,max +1.5~2.4%),但**大半徑轉子上結構不可行**(極端安全係數 < 1),CFRP / GFRP / 鋁也救不回;小半徑(R 1.0 m)混合翼型(外段圓弧板)則結構可行。
- Schmitz 解析扭角與 BEM 最佳化差 0.6%,可作為快速初值。

**垂直軸**
- H 型 / 螺旋 / Φ / V 的 Cp,max 約 0.31–0.38,起轉風速 2.4–2.9 m/s,**全部需要輔助起轉**(模擬 3–5 m/s 靜止起步都不啟動)。
- 最佳是四葉 H 型負槳距 −3°(Cp,max 0.373、年發電量 2101 kWh、LCOE 2.99)。
- 自訂外形(桶形、沙漏形):外形影響遠小於掃掠面積;沙漏形劣於桶形。
- Savonius 阻力型:Cp,max 0.159、質量 37.8 kg、LCOE 6.35,唯一優勢是起轉風速 0.7 m/s。
- 垂直軸 DMST 高 λ 偏樂觀,結論以相對比較為主。

## 4. 已學到的設計規律(可作為下一輪假設的起點)

1. 小轉子(R 1.5 m 以下)的自啟動靠「葉片數 × 低 λd」,不靠加大弦長。
2. 木材 + 低實度時結構餘裕主要看**極端風速**,不是額定點;六葉木製只剩 1.79。
3. 限額發電機的最佳額定取決於場址風速,不可把低風速場址的最佳額定直接搬到標準場址。
4. 結構不可行的圓弧板設計不要再用同家族翼型硬撐;改成「只在外段用圓弧板」才可行。
5. 年發電量差異在 ±1% 內的比較(多數 LCOE 差異)落在模型誤差內,不應當作確定結論。

## 5. 尚未解決與建議的下一步

- 待試(來自各 README「下一次可以試」):六葉 + GFRP 或 R 1.8 m;六葉線性化葉片;大轉子木製葉片的結構補強。
- 排程的下一次執行依規則是**深入研究**(見 `designs/CANDIDATES.md` 最上方);建議深入的是大轉子限額 1.5 kW 線性化木製(`20261107-hawt-b4-lowwind-linwood`);候選清單另有同家族設計與三個垂直軸設計。R 1.0 m 五葉混合翼型(標準場址 LCOE 最低)目前不在候選內,可考慮用 `designs/candidates.json` 的 `pin` 加入。
- 垂直軸都需輔助起轉,尚未找到能自啟動的配置;可考慮 Savonius 與 H 型的混合(本工具的 `free` 家族無法直接表達,需要新功能時先開 `[blade-lab]` issue)。
- 3D 模型上傳到共用 Drive:缺資料夾 ID(見 §1)。

## 6. 工具與環境備忘

- 一次完整驗證:`npm run lab:eval -- designs/<id>/design.json && npm run build && THREE_LOCAL=<three.min.js> npm run lab:ui -- designs/<id> && npm run lab:board && npm run check && npm test`。
- 雲端容器沒有 Blender 本體,但 `pip install bpy`(Python 3.13,用 `python3.13`)可在無頭模式執行 `blender_import.py` 產生 `.blend`;`pip download` 不要在 repo 內執行(會把 wheel 落在目錄裡)。
- `npm ci` 後 Playwright 要暫時 `ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright`(同 `playwright-core`),用完 `rm -f` 刪除,不要 commit。
- three.js:`npm pack three@0.128.0` 解出 `package/build/three.min.js`,放 scratchpad,`THREE_LOCAL` 指向它。
- 合併:本 repo 用 squash merge,分支與 main 會分歧;每次先 `git fetch origin main`,再以最新 main 為底。彙整檔(`LEADERBOARD.md` `CANDIDATES.md` `stats.csv` `progress.svg`)與 `docs/BLADE_LAB.md` 日誌常在並行 PR 間衝突,處理方式:日誌手動保留雙方行,其餘重跑 `npm run lab:board`。
- 發現工具 bug 或缺功能:開 `[blade-lab]` issue,排程不改 `src/`、`tests/`。
