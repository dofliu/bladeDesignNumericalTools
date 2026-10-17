# 三維線葉片 fixture(回翼閉合葉片交接)

來源:使用者 2026-10-17 提供的 `Blade_Analysis_Handoff_Fixtures.zip`(搭配 `Blade_Return_Wing_Engineering_Handoff_zh-TW.docx`)。檔案原樣複製、未修改,供 `tests/line3d.test.mjs` 使用。`polar_v1.json` 已移到 `examples/return-wing/`(網頁內建範例與測試共用,內容未變)。

| 檔案 | SHA256(與 fixture 包 FILES_SHA256.json 一致) |
|---|---|
| polar_v1.json(在 examples/return-wing/)| 51108f1ff42eb406762e13ae4f034bfa6726cfc82cdd147ad4b911577e086194 |
| stations.csv | 76cccd7e6b016ba06797979c983ac3de605730da57b9b64fbecf7853732999ca |
| partial_coefficients.csv | 986e9ffc166a867ba033e88a98d50be8ed178980bff86c3b564fc567be4fcc93 |
| interpolation_guard_challenges.csv | c9c840591eb8fac1e957d0dbf728febd0a6fa03e0e5562473a04f2d683ca0776 |

- 極曲線為 XFOIL 6.99 二維計算(Mach 0、160 面板、Ncrit 9、自然轉捩),**不是量測數據**;Re 90k–550k、α −8°~8°。NACA2412 Re550k α−3° 未收斂,保留為缺點。
- `stations.csv` 的 `branch` 是 Work/Return 幾何分支;`partial_coefficients.csv` 的值是無誘導或指定軸向折減 a 下、只含 s∈[0.1, 0.9] 的**部分**扭矩係數,不是整機 CQ。
- 原始 XFOIL 輸入輸出、Stage5B/6 證據包不在 repo 內(保留於交接者的封存)。
