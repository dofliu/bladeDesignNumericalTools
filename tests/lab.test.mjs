// Blade lab (docs/BLADE_LAB.md): the evaluator reproduces the core reference values, and every committed
// design still evaluates to the Cp,max recorded in its metrics.json (catches stale results after model changes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, applyDesign } from '../lab/evaluate.mjs';
import { G } from '../src/core.mjs';

const dd = join(dirname(fileURLToPath(import.meta.url)), '../designs');

test('lab evaluate:預設水平軸 Cp,max 與參考值一致,模擬指標合理', () => {
  const m = evaluate({ mode: 'HAWT' });
  assert.ok(Math.abs(m.cpMax - 0.478) < 0.003, `Cp,max ${m.cpMax}`);
  assert.ok(m.aepKWh > 0 && isFinite(m.lcoe) && m.loads.minSafety > 1);
  for (const s of m.sim.steady) assert.ok(s.track > 0.9, `${s.V} m/s 追蹤 ${s.track}`);
  assert.equal(m.sim.start.find(s => s.V === 4).started, false); // 已知:預設水平軸 4 m/s 無法自行啟動
});

test('lab evaluate:未知翼型或垂直軸型式要報錯', () => {
  assert.throws(() => applyDesign({ mode: 'HAWT', cfg: { st: [{ f: 0.5, k: 'n4:9999' }] } }), /未知的翼型/);
  assert.throws(() => applyDesign({ mode: 'VAWT', cfg: { vawt: { type: 'nope' } } }), /未知的垂直軸型式/);
});

test('designs/*:設計檔格式正確,且 metrics.json 與目前模型一致', () => {
  for (const id of readdirSync(dd)) {
    const f = join(dd, id, 'design.json'); if (!existsSync(f)) continue;
    const d = JSON.parse(readFileSync(f, 'utf8'));
    assert.equal(d.schema, 'blade-lab-v1', id); assert.equal(d.id, id); assert.ok(d.name && d.hypothesis, id);
    assert.ok(existsSync(join(dd, id, 'README.md')), `${id} 缺 README.md`);
    const m = JSON.parse(readFileSync(join(dd, id, 'metrics.json'), 'utf8'));
    applyDesign(d);
    assert.ok(Math.abs(G.cpMax / m.cpMax - 1) < 0.005, `${id}:Cp,max ${G.cpMax} ≠ metrics ${m.cpMax}(模型已變,請重跑 lab:eval)`);
  }
});
