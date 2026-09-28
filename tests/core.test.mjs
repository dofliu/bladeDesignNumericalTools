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

test('HAWT computeStruct: reference 3-blade R1.5 rotor gives sane root loads and tip deflection', () => {
  setMode('HAWT');
  const st = G.struct;
  assert.ok(st, 'G.struct populated for HAWT');
  assert.strictEqual(st.r.length, G.rows.length);
  for (const v of [...st.sigma, st.sigmaMax, st.tipDeflFlap, st.tipDeflEdge]) assert.ok(isFinite(v) && v >= 0, `finite non-negative: ${v}`);
  // root (first station) carries the largest flapwise moment for a monotonically loaded blade
  assert.ok(Math.abs(st.Mflap[0]) >= Math.abs(st.Mflap[st.Mflap.length - 1]), 'root flap moment >= tip');
  assert.ok(st.tipDeflFlap < 0.15 * S.hawt.R, `tip deflection ${(st.tipDeflFlap * 1000).toFixed(1)} mm stays well under the 1.5 m radius`);
  assert.ok(st.safetyFactor > 1, `safety factor ${st.safetyFactor.toFixed(2)} > 1 for the default GFRP shell`);
});

test('VAWT design leaves G.struct null (structural load estimate is HAWT-only for now)', () => {
  setMode('VAWT');
  assert.strictEqual(G.struct, null);
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
