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

function primeCutout(V) {
  S.tun.TI = 0; S.tun.V = V; S.load.ctrl = 'po';
  S.load.cutout = true; S.load.Vcutout = 22; S.load.Vrestart = 18;
  SIM.omega = G.lopt * V / G.R * 0.5; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
  SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.cutoutLatch = false; SIM.n = 0; SIM.po.wref = -1; SIM.VslowAvg = V;
}

test('sustained high wind above the cut-out threshold parks the rotor once and keeps it parked', () => {
  setMode('HAWT');
  primeCutout(26); // above Vcutout=22, steady (TI=0) so the slow average tracks it deterministically
  let latchEvents = 0;
  for (let t = 0; t < 90; t += 0.004) {
    const before = SIM.cutoutLatch;
    simStep(0.004);
    if (SIM.cutoutLatch && !before) latchEvents++;
    if (t > 30) assert.ok(SIM.cutoutLatch, `expected to stay parked at t=${t.toFixed(1)}s under sustained 26 m/s wind`);
  }
  assert.equal(latchEvents, 1, `cut-out should latch exactly once under steady high wind, got ${latchEvents}`);
  assert.ok(SIM.omega < 1, `parked rotor should have omega≈0, got ${SIM.omega.toFixed(2)}`);
});

test('cut-out releases and the rotor restarts once the slow-average wind drops below the restart threshold', () => {
  setMode('HAWT');
  primeCutout(26);
  for (let t = 0; t < 40; t += 0.004) simStep(0.004);
  assert.ok(SIM.cutoutLatch, 'expected cut-out engaged after 40 s at 26 m/s');
  S.tun.V = 8; // wind drops well below Vrestart=18
  for (let t = 0; t < 150; t += 0.004) simStep(0.004);
  assert.ok(!SIM.cutoutLatch, `cut-out should have released, VslowAvg=${SIM.VslowAvg.toFixed(1)}`);
  const wStar = G.lopt * 8 / G.R;
  assert.ok(SIM.omega > 0.3 * wStar, `rotor should have restarted toward ${wStar.toFixed(1)} rad/s, got ${SIM.omega.toFixed(2)}`);
});
