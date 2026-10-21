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

test('EN-3:圖表 Plot.draw 的標題/座標軸/圖例字串都有英文翻譯', async () => {
  const { readFileSync } = await import('node:fs');
  const { EN } = await import('../src/i18n.mjs');
  const src = ['ui', 'bench', 'flow', 'core', 'report', 'research'].map(n => readFileSync(new URL(`../src/${n}.mjs`, import.meta.url), 'utf8')).join('\n');
  const miss = new Set();
  for (const m of src.matchAll(/\b(?:title|xlabel|ylabel|ylabelR|label): *'([^']*[一-鿿][^']*)'/g)) {
    if (!EN[m[1]]) miss.add(m[1]);
  }
  assert.deepEqual([...miss], [], '缺少翻譯: ' + [...miss].join(' | '));
});

test('EN-4:片段翻譯表 FR 的值不含中文,且單葉片/流場/研究的代表字串有翻譯', async () => {
  const { FR, EN, tr } = await import('../src/i18n.mjs');
  assert.deepEqual(Object.entries(FR).filter(([, v]) => /[一-鿿]/.test(v)), []);
  for (const k of ['剖面資料', '翼面壓力分布', '工況與修改', '部分扭矩係數', '升力 L', '旋轉平面']) assert.ok(EN[k] || FR[k], k);
  assert.equal(tr('剖面資料'), '剖面資料', '中文語系下 tr() 原樣回傳');
});

test('EN-5:報告與 core 的靜態中文片段英文模式下都有翻譯,trHtml 只翻文字節點與 alt', async () => {
  const { readFileSync } = await import('node:fs');
  const I = await import('../src/i18n.mjs');
  const keep = globalThis.document;
  globalThis.document = { querySelectorAll() { return []; }, documentElement: {}, getElementById() { return null; } };
  I.setLang('en');
  try {
    const miss = new Set();
    for (const n of ['report', 'core']) {
      const src = readFileSync(new URL(`../src/${n}.mjs`, import.meta.url), 'utf8').replace(/\$\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '\u0001');
      for (const m of src.matchAll(/[^`'"\u0001<>\n]*[一-鿿][^`'"\u0001<>\n]*/g)) {
        const s = m[0], u = s.trim();
        if (!u || u.startsWith('//') || u.startsWith('/*') || u.startsWith('/^')) continue;
        if (/[一-鿿]/.test(I.tr(s)) && /[一-鿿]/.test(I.tr(u))) miss.add(u);
      }
    }
    assert.deepEqual([...miss], [], '缺少翻譯: ' + [...miss].join(' | '));
    const h = I.trHtml('<style>.a::after{content:"設計條件"}</style><h2>設計條件</h2><img alt="圖:弦長與扭角" src="x"><td>3 葉水平軸風力機 R 1.5 m</td>');
    assert.ok(h.includes('content:"設計條件"'), 'style 不翻譯');
    assert.ok(h.includes('<h2>Design conditions</h2>') && h.includes('alt="Figure: chord and twist"'));
    assert.ok(!/[一-鿿]/.test(h.replace(/<style[\s\S]*?<\/style>/, '')), h);
  } finally { I.setLang('zh'); globalThis.document = keep; }
});
