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
const { S, G, SIM, MATERIALS, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep } = core;

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

test('VAWT MPPT tracking stays >= 90% of ideal for po/tsr/ot controllers', () => {
  setMode('VAWT');
  for (const ctrl of ['po', 'tsr', 'ot']) {
    for (const V of [6, 9]) {
      const track = trackingRatio(ctrl, V, 120);
      assert.ok(track >= 0.9, `VAWT ${ctrl} ${V} m/s tracking ${(track * 100).toFixed(1)}%`);
    }
  }
});

test('designHAWT: G.struct gives sane spanwise loads (root moment, safety factor, tip deflection)', () => {
  S.hawt.material = 'gfrp';
  setMode('HAWT');
  const st = G.struct;
  assert.equal(st.stations.length, S.hawt.nSec + 1, 'one root marker + nSec design stations');
  assert.ok(st.rootMflap > 0, `root flapwise moment should be positive thrust-driven bending: ${st.rootMflap}`);
  assert.ok(isFinite(st.minSF) && st.minSF > 0, `safety factor should be a positive finite number: ${st.minSF}`);
  assert.ok(st.tipDefl > 0 && st.tipDefl < 0.3 * S.hawt.R, `tip deflection should be positive and small vs radius: ${st.tipDefl} (R=${S.hawt.R})`);
  // moment should decrease monotonically from root towards the tip (cantilever with outboard loads only)
  for (let i = 1; i < st.stations.length; i++) assert.ok(st.stations[i].Mflap <= st.stations[i - 1].Mflap + 1e-9, 'flapwise moment should decrease towards the tip');
});

test('designHAWT: a stiffer material (CFRP) gives a smaller tip deflection than a softer one (PLA)', () => {
  S.hawt.material = 'pla'; setMode('HAWT');
  const softDefl = G.struct.tipDefl;
  S.hawt.material = 'cfrp'; setMode('HAWT');
  const stiffDefl = G.struct.tipDefl;
  assert.ok(stiffDefl < softDefl, `CFRP (E=${MATERIALS.cfrp.E}) tip deflection ${stiffDefl} should be less than PLA (E=${MATERIALS.pla.E}) ${softDefl}`);
  S.hawt.material = 'gfrp'; // restore default for any later test in this file
});
