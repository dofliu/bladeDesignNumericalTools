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
const core = require('../src/core.js');
const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep,
  gammaFn, weibullPdf, capacityFactor } = core;

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

test('gammaFn matches known values (1, 2, 1.5, 0.5)', () => {
  assert.ok(Math.abs(gammaFn(1) - 1) < 1e-9, `Gamma(1)=${gammaFn(1)}`);
  assert.ok(Math.abs(gammaFn(2) - 1) < 1e-9, `Gamma(2)=${gammaFn(2)}`);
  assert.ok(Math.abs(gammaFn(1.5) - Math.sqrt(Math.PI) / 2) < 1e-9, `Gamma(1.5)=${gammaFn(1.5)}`);
  assert.ok(Math.abs(gammaFn(0.5) - Math.sqrt(Math.PI)) < 1e-9, `Gamma(0.5)=${gammaFn(0.5)}`);
});

test('weibullPdf at k=2 reproduces the Rayleigh distribution used previously', () => {
  const Va = 6.3;
  for (const v of [1, 3, 6, 10, 15]) {
    const rayleigh = Math.PI / 2 * v / Va ** 2 * Math.exp(-Math.PI / 4 * (v / Va) ** 2);
    const wb = weibullPdf(v, Va, 2);
    assert.ok(Math.abs(wb - rayleigh) < 1e-9, `v=${v}: weibull ${wb} vs rayleigh ${rayleigh}`);
  }
});

test('weibullPdf integrates to ~1 and its mean matches meanV for several shape parameters', () => {
  for (const k of [1.5, 2, 2.5, 3]) {
    const Va = 7;
    let area = 0, meanNum = 0;
    for (let v = 0.01; v <= 60; v += 0.02) { const f = weibullPdf(v, Va, k); area += f * 0.02; meanNum += v * f * 0.02; }
    assert.ok(Math.abs(area - 1) < 5e-3, `k=${k}: pdf integral ${area}`);
    assert.ok(Math.abs(meanNum - Va) < 5e-2, `k=${k}: pdf mean ${meanNum} vs ${Va}`);
  }
});

test('capacityFactor is bounded in [0,1] for a plausible AEP and rated power', () => {
  const aep = 4000; // kWh/year
  const cf = capacityFactor(aep, 1000); // 1 kW rated
  assert.ok(cf > 0 && cf <= 1, `capacity factor ${cf}`);
  assert.ok(Math.abs(cf - aep / (1000 * 8760 / 1000)) < 1e-9, 'capacityFactor formula');
  assert.equal(capacityFactor(aep, 0), 0, 'zero-rated-power guard');
});
