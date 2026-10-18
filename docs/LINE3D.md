# 通用三維線葉片分析(研究模式)

`src/line3d.mjs`。任何能以「三維中心線 x(s) + 弦長 c(s) + 截面安裝角 β(s) + 翼型」描述的葉片都用同一套程式分析;新設計只是新的葉片定義資料,不需另寫模組。第一組驗收資料是回翼閉合葉片交接(`tests/fixtures/line3d/`)。

## 怎麼用

- 網頁:頂部導覽「研究」(流程版面與經典版面都有;手機版底部導覽也有)。預設載入回翼閉合葉片範例;可匯入自己的葉片定義與極曲線 JSON,調整 λ、Re_R、負載種類、積分節點、各分支軸向折減 a、安裝角偏移 Δβ 與翼型,並把設定加入比較看部分 CQ–λ。
- 程式:`parseBladeV1` → `analyzeBlade` / `sweepLambda`(見 `tests/line3d.test.mjs`)。
- 範例檔:`examples/return-wing/`(`blade_v02_candidate146.json` 由 `node scripts/make-return-wing-example.mjs` 產生;`polar_v1.json` 為交接 fixture 原檔)。

## 葉片定義檔(`blade-line3d-v1`)

```jsonc
{
  "schema": "blade-line3d-v1",
  "name": "顯示名稱", "note": "說明(選填)", "units": "R",
  "copies": 2,                 // 旋轉複製份數(繞 +Z 等分),部分 CQ 只在這裡乘一次
  "window": [0.1, 0.9],        // 分析區間 s(選填,預設為各分支取樣範圍的交集)
  "branches": [
    { "id": "Work", "profile": "2412", "mirror": true,   // profile 對應極曲線檔 profileId(字串)
      "stations": [
        {"s": 0.1, "x": 0.2625, "y": -0.0165, "z": -0.0180, "chord": 0.1253, "beta": 38},
        {"s": 0.1125, "...": "..."}
      ] }
  ]
}
```

- 每個分支至少 4 站,s 嚴格遞增;x、y、z、chord(c/R)以 R 為單位,beta 為截面安裝角(度,定義見下方慣例)。
- 站上可加 `"profile"` / `"mirror"`,從該站起沿展向改用另一個翼型(分段固定,**不在翼型之間混合係數**)。
- 中心線、弦長與安裝角以自然三次樣條內插,dx/ds 取樣條解析導數。範例以 65 站取樣時,部分 CQ 與函式定義版差 < 1e-7(測試門檻 1e-6;fixture 的 1e-10 門檻仍以函式版驗證)。
- 扭角修改(`branchDef` 的 `mod`,研究模式各分支欄位):`dBeta` 整支偏移;`dBetaLin`/`dBetaQuad` 加 `u·值`、`u²·值`,其中 **u = 中心線累積實際弧長 L(s) ÷ 分支總弧長**(`arcLength`:每個取樣區間細分 8 段 × 5 點 Gauss–Legendre),不是 (s−s0)/(s1−s0)。s 只是取樣參數,不保證與弧長成比例;`tests/line3d.test.mjs` 以直線 x∝s² 與圓弧 θ∝s² 兩個非等弧長案例回歸。回翼範例的 s 接近等弧長(J 變化約 ±3%,u 與 s 正規化最大差 0.73%),2026-10-18 改用弧長後候選比較的部分 CQ 差 ≤ 2.7×10⁻⁴、排名與缺值 λ 不變。分支總弧長取整個取樣範圍(不是 window)。
- 會拒絕:schema 不符、站數不足、s 非遞增、非有限數值、負弦長、window 超出取樣範圍、缺 profile、copies 非正整數。

## 能算與不能算

- 能算:逐截面攻角、局部 Re、力向量、四分之一弦力偶、對主軸扭矩貢獻;沿實體弧長積分的**部分**扭矩係數(分母 q∞πR³)與資料支撐率。
- 不能算:誘導速度/尾流/分支間遮擋、接合與橋接阻力、三維有限展弦比修正、動態失速。結果**不是整機 CQ、Cp 或效率**,也不做 Betz 比較。軸向折減 a 只是指定情境(無旋流、無流管耦合)。

## 慣例(與交接文件一致)

- 右手座標,主軸 +Z、風向 +Z、Ω 沿 +Z;長度以 R 為單位,速度以 U∞ 為單位;負扭矩為制動。
- `span = dx/ds / J`(J = |dx/ds|,沿 s 增加);`t = normalize(−span_y, span_x, 0)`;`n = span × t`。
- `chord = −t cosβ + n sinβ`(前緣→後緣),`upper = span × chord`。β 是幾何安裝角,不是攻角,也不是 `customShape` 的方位相位 θ(z)。
- `W = (1 − a) e_z − λ (e_z × x)`;`w⊥ = W − (W·span) span`;`α = atan2(w⊥·upper, w⊥·chord)`;`localRe = Re_R · (c/R) · |w⊥|`。
- `F̂ = ĉ |w⊥|² (CL·lift + CD·drag)`,`drag = w⊥/|w⊥|`,`lift = span × drag`;`M̂ = −ĉ² |w⊥|² CM · span`(XFOIL 正 Cm 抬頭)。
- `I = ∫ ((x × F̂)_z + M̂_z) J ds`;`部分 CQ = copies · ΣI / π`,旋轉複製份數只在 `partialCQ` 乘一次。

## 極曲線(嚴格模式)

- 格式 `blade-handoff-polar-v1`(`parsePolarV1`):多翼型 × 多 Re 層 × 攻角點,每點有 valid 與來源;profileId 一律字串。
- `lookupPolar`:攻角相鄰格點線性 → Re 相鄰層 log(Re) 線性;鏡射翼型以 −α 查表,CL、CM 變號。需要的任一角點無效即回傳 `missing_corner`;越界回傳 `outside_alpha` / `outside_Re`;不夾值、不外插、不套 Viterna、不墊 Cd、不補 0。
- 與一般模式(`aero.mjs` 的 `buildPolarSet`/`parsePolarText`,含 Viterna 外插與 Cd ≥ 0.003)完全分開,互不影響。

## 截面狀態

`sectionLoad3D`/`lineStation` 的 `status`:`supported`、極曲線狀態(`missing_corner`/`outside_alpha`/`outside_Re`/`nonfinite`/`unknown_profile`)、`zero_chord`(c = 0,力與力偶恰為 0)、`invalid_chord`(c < 0 或非有限)、`nonfinite_wind`(W 含 NaN,例如誘導計算失敗)、`zero_speed`、`degenerate_frame`(span 平行主軸)。未給 `dx` 時以差分求切線;給 `domain:[s0,s1]` 則端點改用單側差分,不在定義域外取值。

## 積分

`integrateLine` 用梯形法;每個區間的兩端點與中點都有資料才算支撐。只要有一個區間缺資料,`I_full` 為 null 並列出 `unsupportedIntervals` 與原因;`I_supported` 只是支撐子區的值,不可當完整結果。網格少於兩點或非嚴格遞增時回傳 `status: 'invalid_grid'`、`I_full: null`。端點/中點檢查不保證區間內不存在更窄的缺口。
