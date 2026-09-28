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
const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep } = core;

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

test('HAWT structural loads (G.struct): sane root-to-tip trends at the default design', () => {
  setMode('HAWT');
  const st = G.struct;
  assert.equal(st.rows.length, G.rows.length);
  st.rows.forEach(o => {
    for (const k of ['Mf', 'Me', 'Ncf', 'area', 'Ixx', 'Iyy', 'sigma']) assert.ok(Number.isFinite(o[k]), `${k} finite`);
    assert.ok(o.area > 0 && o.Ixx > 0 && o.Iyy > 0, 'positive section properties');
    assert.ok(o.SF > 0, 'positive safety factor');
  });
  // flapwise bending moment and centrifugal tension are cumulative from the tip inward, so
  // both must be largest at the root station and non-increasing outboard.
  for (let i = 1; i < st.rows.length; i++) {
    assert.ok(st.rows[i].Mf <= st.rows[i - 1].Mf + 1e-9, 'Mf non-increasing toward tip');
    assert.ok(st.rows[i].Ncf <= st.rows[i - 1].Ncf + 1e-9, 'Ncf non-increasing toward tip');
  }
  assert.ok(st.rows[0].Mf > 0, 'root flapwise moment is positive (thrust loaded)');
  assert.ok(Number.isFinite(st.tipDefl) && Math.abs(st.tipDefl) < 0.3 * G.R, 'plausible tip deflection');
  assert.ok(st.minSF > 1, `default design keeps a safety margin (minSF=${st.minSF.toFixed(2)})`);
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
