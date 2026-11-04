// Blade lab (docs/BLADE_LAB.md): the evaluator reproduces the core reference values, and every committed
// design still evaluates to the Cp,max recorded in its metrics.json (catches stale results after model changes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, applyDesign } from '../lab/evaluate.mjs';
import { G } from '../src/core.mjs';
import { collect, candidates, nextTrack, DEEPEN_EVERY } from '../lab/stats.mjs';

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
    assert.ok(d.track == null || ['explore', 'deepen'].includes(d.track), `${id}:track 只能是 explore 或 deepen`);
    if (d.track === 'deepen') {
      assert.ok(d.parent, `${id}:深入研究設計必須寫 parent`);
      const pf = join(dd, d.parent, 'design.json');
      assert.ok(existsSync(pf), `${id}:parent ${d.parent} 不存在`);
      assert.equal(JSON.parse(readFileSync(pf, 'utf8')).mode, d.mode, `${id}:parent 必須同模式`);
    }
    assert.ok(existsSync(join(dd, id, 'README.md')), `${id} 缺 README.md`);
    const m = JSON.parse(readFileSync(join(dd, id, 'metrics.json'), 'utf8'));
    applyDesign(d);
    assert.ok(Math.abs(G.cpMax / m.cpMax - 1) < 0.005, `${id}:Cp,max ${G.cpMax} ≠ metrics ${m.cpMax}(模型已變,請重跑 lab:eval)`);
  }
});

test('lab stats:標準場址、柏拉圖前緣、候選與探索/深入節奏', () => {
  const rows = collect();
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(isFinite(r.stdAep) && r.stdAep > 0 && isFinite(r.stdLcoe), `${r.id} 標準場址數值`);
    if (r.wind.Vavg === 5.5 && r.wind.k === 2) assert.equal(r.stdAep, r.aepKWh, `${r.id}:標準風況的設計不需重算`);
    if (r.tags.includes('結構不可行')) assert.ok(!r.pareto && r.score == null, `${r.id}:結構不可行不可列入排名`);
  }
  for (const mode of ['HAWT', 'VAWT']) assert.ok(rows.some(r => r.mode === mode && r.pareto), `${mode} 至少一個前緣設計`);
  const { list } = candidates(rows);
  assert.ok(list.length > 0 && list.every(c => c.r.pareto || c.why.startsWith('手動')));
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].rounds <= list[i].rounds, '候選依深入輪數排序');
  // 節奏:連續 DEEPEN_EVERY-1 次探索後下一次深入;剛深入完則回到探索
  const fake = (ids, deep = []) => ids.map(id => ({ id, track: deep.includes(id) ? 'deepen' : 'explore' }));
  assert.equal(nextTrack(fake(['a', 'b'].slice(0, DEEPEN_EVERY - 2))).track, 'explore');
  assert.equal(nextTrack(fake(['a', 'b', 'c'].slice(0, DEEPEN_EVERY - 1))).track, 'deepen');
  assert.equal(nextTrack(fake(['a', 'b', 'c'], ['c'])).track, 'explore');
});
