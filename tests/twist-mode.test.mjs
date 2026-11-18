// Issue #182: reject misspelled twist modes at the core, lab and CLI boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as core from '../src/core.mjs';
import { applyDesign } from '../lab/evaluate.mjs';

const invalidModes = ['schmitz', 'unknown', '', 'toString', 'constructor', null, false, 0, {}, []];

test('HAWT core rejects unknown twist codes before changing computed geometry', () => {
  const saved = core.S.hawt.twMode;
  const rows = core.G.rows, gen = core.G.gen;
  try {
    for (const mode of [...invalidModes, undefined]) {
      core.S.hawt.twMode = mode;
      assert.throws(() => core.designHAWT(), /未知扭角方式.*bem.*opt.*linear/);
      assert.equal(core.G.rows, rows);
      assert.equal(core.G.gen, gen);
    }
  } finally { core.S.hawt.twMode = saved; }
});

test('lab accepts all canonical twist modes and preserves the omitted-mode default', () => {
  const values = [];
  for (const twMode of ['bem', 'opt', 'linear']) {
    applyDesign({ mode: 'HAWT', cfg: { hawt: { twMode } } });
    assert.equal(core.S.hawt.twMode, twMode);
    assert.ok(Number.isFinite(core.G.cpMax) && core.G.cpMax > 0);
    values.push(core.G.cpMax);
  }
  assert.ok(values[0] > values[2], 'BEM and linear must remain distinct design paths');
  applyDesign({ mode: 'HAWT' });
  assert.equal(core.S.hawt.twMode, 'bem');
});

test('lab rejects invalid codes without resetting the active design', () => {
  applyDesign({ mode: 'HAWT', cfg: { hawt: { twMode: 'opt', R: 2 } } });
  const before = structuredClone(core.S), rows = core.G.rows, gen = core.G.gen;
  try {
    for (const twMode of [...invalidModes, undefined]) {
      assert.throws(() => applyDesign({
        mode: 'HAWT', cfg: { hawt: { twMode, R: 4 } },
      }), /未知扭角方式/);
      assert.deepEqual(core.S, before);
      assert.equal(core.G.rows, rows);
      assert.equal(core.G.gen, gen);
    }
  } finally { applyDesign({ mode: 'HAWT' }); }
});

test('lab CLI exits unsuccessfully and never creates or overwrites metrics for invalid input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blade-twist-'));
  const design = join(dir, 'design.json'), metrics = join(dir, 'metrics.json');
  const script = fileURLToPath(new URL('../lab/evaluate.mjs', import.meta.url));
  writeFileSync(design, JSON.stringify({
    schema: 'blade-lab-v1', id: 'invalid', name: 'invalid', mode: 'HAWT',
    cfg: { hawt: { twMode: 'schmitz' } },
  }));
  const run = () => {
    const result = spawnSync(process.execPath, [script, design], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /未知扭角方式.*schmitz.*opt/);
  };
  try {
    run();
    assert.equal(existsSync(metrics), false);
    const sentinel = '{"existing":"keep"}\n';
    writeFileSync(metrics, sentinel);
    run();
    assert.equal(readFileSync(metrics, 'utf8'), sentinel);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
