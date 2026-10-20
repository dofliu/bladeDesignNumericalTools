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
