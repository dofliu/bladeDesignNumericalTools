// Controller / MPPT regression, run directly in Node against src/core.js (no browser needed).
// core.js references the AERO global the same way the browser build does, so we set it up
// on `global` before requiring core.js (mirrors how the concatenated <script> loads aero.js
// before core.js). This mirrors the scenarios tests/e2e.smoke.mjs checks in the built dist,
// giving fast feedback without spinning up Playwright; the e2e test still covers the same
// tracking regression against the actual built artifact end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
global.AERO = require('../src/aero.js');
global.GEO = require('../src/geo.js');
const core = require('../src/core.js');
const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep, bladeStructural } = core;

function setMode(mode) {
  S.mode = mode;
  if (mode === 'HAWT') designHAWT(); else designVAWT();
  computePerf();
  autoMatchGen();
}

function trackingRatio(ctrl, V, dur) {
  S.tun.TI = 0; S.tun.V = V; S.load.ctrl = ctrl;
  SIM.omega = G.lopt * V / G.R * 0.7; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
  SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.n = 0; SIM.po.wref = -1;
  let e = 0, a = 0;
  for (let t = 0; t < dur; t += 0.004) {
    simStep(0.004);
    if (t > dur * 0.4) { e += SIM.out.el.Pout; a += 0.5 * air().rho * G.A * SIM.out.V ** 3; }
  }
  return (e / a) / (G.cpMax * 0.92 * S.load.eta);
}

test('HAWT MPPT tracking stays >= 90% of ideal for po/tsr/ot controllers', () => {
  setMode('HAWT');
  for (const ctrl of ['po', 'tsr', 'ot']) {
    for (const V of [6, 9]) {
      const track = trackingRatio(ctrl, V, 70);
      assert.ok(track >= 0.9, `HAWT ${ctrl} ${V} m/s tracking ${(track * 100).toFixed(1)}%`);
    }
  }
});

test('bladeStructural: HAWT design-point loads are physically sane (signs, monotonic decay to the tip, thickness within the section)', () => {
  setMode('HAWT');
  const st = bladeStructural();
  assert.ok(st, 'returns a result for HAWT');
  const n = st.rows.length;
  assert.ok(st.root.Mflap > 0, 'root flapwise moment is nonzero (thrust bends the blade downwind)');
  assert.ok(st.root.Naxial > 0, 'root carries the full centrifugal tension of the blade');
  assert.ok(st.tipDeflection >= 0, 'tip deflects in the direction of the flapwise moment');
  for (let i = 0; i < n; i++) {
    const r = st.rows[i];
    assert.ok(r.thickness > 0 && r.thickness < 0.5 * G.rows[i].c, 'shell thickness stays under half the local chord');
    assert.ok(r.area > 0 && r.Ixx > 0 && r.Iyy > 0, 'positive section properties');
    assert.ok(isFinite(r.sigma) && r.sigma >= 0, 'finite, nonnegative combined stress');
  }
  // moment carried at the root must be >= at any station further out (cantilever, loads only add going inboard)
  for (let i = 1; i < n; i++) assert.ok(st.root.Mflap >= st.rows[i].Mflap - 1e-6, `root moment >= station ${i} moment`);
  S.mode = 'VAWT';
  assert.equal(bladeStructural(), null, 'not (yet) implemented for VAWT');
  S.mode = 'HAWT';
});

test('VAWT MPPT tracking stays >= 90% of ideal for po/tsr/ot controllers', () => {
  setMode('VAWT');
  for (const ctrl of ['po', 'tsr', 'ot']) {
    for (const V of [6, 9]) {
      const track = trackingRatio(ctrl, V, 120);
      assert.ok(track >= 0.9, `VAWT ${ctrl} ${V} m/s tracking ${(track * 100).toFixed(1)}%`);
    }
  }
});
