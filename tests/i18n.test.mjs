import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN, t, getLang } from '../src/i18n.mjs';

test('預設語系為中文,t() 原樣回傳', () => {
  assert.equal(getLang(), 'zh');
  assert.equal(t('風洞'), '風洞');
});

test('shell.html 每個 data-i18n 文字與 title 都有英文翻譯', () => {
  const html = readFileSync(new URL('../src/shell.html', import.meta.url), 'utf8');
  const missing = [];
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*)\sdata-i18n(?=[\s>])([^>]*)>([^<]*)/g)) {
    const attrs = m[2] + m[3];
    const txt = m[4].trim();
    if (txt && !EN[txt]) missing.push(txt);
  }
  for (const m of html.matchAll(/<[^>]*data-i18n-title[^>]*>/g)) {
    const ti = m[0].match(/title="([^"]*)"/) || m[0].match(/aria-label="([^"]*)"/);
    if (ti && ti[1] && !EN[ti[1]]) missing.push(ti[1]);
  }
  assert.deepEqual(missing, []);
});

test('EN-2:設定面板常用標籤有英文翻譯,且翻譯不含中文', () => {
  for (const k of ['風速', '紊流強度', 'MPPT 控制', '轉子半徑 R', '扭角方式', '電氣即時值', '匯入翼型資料庫座標']) assert.ok(EN[k], k);
  const bad = Object.entries(EN).filter(([k, v]) => k.length > 0 && /[一-鿿]/.test(v) && !/中文/.test(v));
  assert.deepEqual(bad, []);
});
