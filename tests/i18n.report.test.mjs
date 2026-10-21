import test from 'node:test';
import assert from 'node:assert/strict';

// 英文語系在載入模組時讀 localStorage,故獨立成一個檔案(每個測試檔各自一個行程)。
globalThis.localStorage = { getItem: () => 'en', setItem() {} };
const { tr, getLang } = await import('../src/i18n.mjs');

test('EN-5:報告常見動態句子在英文語系下完整翻譯', () => {
  assert.equal(getLang(), 'en');
  const samples = [
    '3 葉水平軸風力機 R 1.50 m', '玻纖複合材(空心殼)(E 20 GPa,容許應力 100 MPa)',
    '風速 14 m/s 以上,轉子氣動功率超過發電機額定(3.20 kW),定槳距轉子即使降轉速進入失速仍無法把功率壓在額定內,多次觸發過速/過功率保護。',
    '實測切入風速約 3 m/s(輸出 > 5 W)。', '6–10 m/s 區間實測輸出只有理想 MPPT 的 92%;可嘗試最佳尖速比/最佳轉矩控制,或調整 P&O 擾動步長與週期。',
    '圖:0.7R 剖面在設計攻角下的位勢流速度場與流線', '7. 結論與建議', '(1)穩態功率曲線測試',
  ];
  for (const s of samples) assert.ok(!/[一-鿿]/.test(tr(s)), `${s} → ${tr(s)}`);
});
