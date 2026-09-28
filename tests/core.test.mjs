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

test('VAWT MPPT tracking stays >= 90% of ideal for po/tsr/ot controllers', () => {
  setMode('VAWT');
  for (const ctrl of ['po', 'tsr', 'ot']) {
    for (const V of [6, 9]) {
      const track = trackingRatio(ctrl, V, 120);
      assert.ok(track >= 0.9, `VAWT ${ctrl} ${V} m/s tracking ${(track * 100).toFixed(1)}%`);
    }
  }
});

test('cut-out wind speed brakes the rotor in high wind and restarts once the wind drops, with hysteresis and no repeated trips', () => {
  setMode('HAWT');
  S.load.ospd = true; S.load.ctrl = 'po'; S.load.cutOut = true; S.load.vCutOut = 14; S.load.vRestart = 10;
  S.tun.TI = 0; S.tun.V = 20;
  SIM.Vmeas = 20; SIM.omega = G.lopt * 20 / G.R * 0.7; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
  SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.cutout = false; SIM.n = 0; SIM.po.wref = -1; SIM.trips = 0; SIM.wPrevObs = null;
  const omega0 = SIM.omega;
  for (let t = 0; t < 40; t += 0.004) simStep(0.004);
  assert.ok(SIM.cutout, 'cut-out latch should engage once the mean wind exceeds vCutOut');
  assert.ok(SIM.omega < 0.2 * omega0, `rotor should brake to a near-stop, omega=${SIM.omega.toFixed(2)} vs omega0=${omega0.toFixed(2)}`);
  const trips1 = SIM.trips || 0;
  for (let t = 0; t < 20; t += 0.004) simStep(0.004);
  assert.equal(SIM.trips || 0, trips1, 'no further overspeed trips while cut-out keeps the rotor braked in sustained high wind');
  S.tun.V = 8;
  for (let t = 0; t < 40; t += 0.004) simStep(0.004);
  assert.ok(!SIM.cutout, 'cut-out should release once the mean wind drops below vRestart');
  const omegaAfterRelease = SIM.omega;
  for (let t = 0; t < 20; t += 0.004) simStep(0.004);
  assert.ok(SIM.omega > omegaAfterRelease, 'rotor should spin back up again after cut-out clears');
});
