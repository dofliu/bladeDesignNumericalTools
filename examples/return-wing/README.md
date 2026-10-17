# 回翼閉合葉片範例(研究模式)

| 檔案 | 內容 |
|---|---|
| `blade_v02_candidate146.json` | 葉片定義(`blade-line3d-v1`):v0.2 中心線 + candidate146 扭角,Work/Return 兩分支各 65 站,s 0.1–0.9,copies 2,翼型為鏡射 NACA 2412。由 `node scripts/make-return-wing-example.mjs` 從 `src/line3d.mjs` 的函式定義取樣產生。 |
| `polar_v1.json` | 極曲線(`blade-handoff-polar-v1`):NACA 2412 與 baseline_mesh(原 0012 有限尾緣輪廓),Re 90k–550k、α −8°~8°,XFOIL 6.99 二維計算(非量測);2412 Re550k α−3° 未收斂保留為缺值。交接 fixture 原檔,SHA256 51108f1f…6194。 |

來源:使用者 2026-10-17 提供的交接文件與 fixture。座標、符號與限制見 `docs/LINE3D.md`。結果只是無誘導(或指定 a)下分析區間內的**部分**扭矩係數,不是整機效率。
