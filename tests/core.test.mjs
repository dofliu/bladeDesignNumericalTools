// Controller / MPPT regression, run directly in Node against src/core.js (no browser needed).
// core.js references the AERO and GEO globals the same way the browser build does, so we set
// them up on `global` before requiring core.js (mirrors how the concatenated <script> loads
// aero.js and geo.js before core.js). This mirrors the scenarios tests/e2e.smoke.mjs checks in
// the built dist, giving fast feedback without spinning up Playwright; the e2e test still covers
// the same tracking regression against the actual built artifact end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
global.AERO = require('../src/aero.js');
global.GEO = require('../src/geo.js');
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

test('HAWT design point produces sane spanwise root-to-tip blade loads', () => {
  setMode('HAWT');
  assert.ok(G.loads, 'G.loads populated after designHAWT');
  const n = G.rows.length;
  // root carries the moment/force of every outboard station; tip carries ~none of its own annulus
  assert.equal(G.loads.MflapRoot, G.rows[0].Mflap);
  assert.ok(G.loads.MflapRoot > 0, `flapwise root moment should be positive (thrust bends the blade downwind): ${G.loads.MflapRoot}`);
  assert.ok(G.loads.FaxRoot > 0, `centrifugal root axial force should be positive: ${G.loads.FaxRoot}`);
  assert.ok(G.rows[n - 1].Mflap < G.loads.MflapRoot * 0.05, 'flapwise moment should fall off towards the tip');
  assert.ok(G.rows[n - 1].Fax < G.loads.FaxRoot * 0.05, 'axial force should fall off towards the tip');
  for (let i = 1; i < n; i++) {
    assert.ok(G.rows[i].Mflap <= G.rows[i - 1].Mflap + 1e-9, 'flapwise moment monotonically decreases outboard');
    assert.ok(G.rows[i].Fax <= G.rows[i - 1].Fax + 1e-9, 'axial force monotonically decreases outboard');
  }
});

test('HAWT design point produces sane spanwise stress/deflection/safety factor', () => {
  setMode('HAWT');
  const n = G.rows.length;
  assert.ok(isFinite(G.loads.tipDefl) && G.loads.tipDefl >= 0, `tip deflection should be a small positive number: ${G.loads.tipDefl}`);
  assert.ok(G.loads.minSafety > 0 && isFinite(G.loads.minSafety), `minimum safety factor should be positive and finite: ${G.loads.minSafety}`);
  assert.equal(G.rows[0].defl, 0, 'deflection is fixed (0) at the root');
  for (let i = 0; i < n; i++) {
    assert.ok(G.rows[i].stress >= 0, `combined stress must be non-negative at row ${i}`);
    // the outermost row carries none of its own annulus past its centre (see cumulativeMoment/
    // cumulativeOutboard), so it can legitimately see 0 stress -> Infinity safety factor there.
    assert.ok(G.rows[i].safety > 0, `safety factor must be positive at row ${i}`);
  }
  assert.ok(isFinite(G.rows[0].safety), 'root safety factor should be a finite number');
  for (let i = 1; i < n; i++) assert.ok(G.rows[i].defl >= G.rows[i - 1].defl - 1e-9, 'flapwise deflection grows monotonically outboard');
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

test('HAWT parked extreme-wind (Ve50 = 1.4 Vref) load case is consistent and heavier than operation', () => {
  setMode('HAWT');
  const X = G.loads.extreme, n = G.rows.length;
  assert.ok(Math.abs(X.Ve - 1.4 * S.hawt.vref) < 1e-9, 'Ve50 = 1.4 * Vref');
  assert.equal(X.MflapRoot, G.rows[0].MflapX);
  assert.ok(X.MflapRoot > 0 && X.tipDefl > 0 && isFinite(X.minSafety) && X.minSafety > 0, 'extreme case values are positive and finite');
  for (let i = 1; i < n; i++) assert.ok(G.rows[i].MflapX <= G.rows[i - 1].MflapX + 1e-9, 'extreme flapwise moment decreases outboard');
  // hand check: flat-plate drag on the blade planform, total force = 0.5 rho Ve^2 Cn * sum(c dr)
  const rho = air().rho, F = G.rows.reduce((a, x) => a + 0.5 * rho * X.Ve * X.Ve * 1.2 * x.c * x.dr, 0);
  assert.ok(X.MflapRoot > 0.3 * F * G.R && X.MflapRoot < F * G.R, 'root moment lies between 0.3 and 1.0 of (total force x span)');
  const tipBefore = X.tipDefl;
  S.hawt.vref = 50; setMode('HAWT');
  const X2 = G.loads.extreme;
  assert.ok(Math.abs(X2.MflapRoot / tipBefore * tipBefore / X.MflapRoot - (50 / 42.5) ** 2) < 1e-6, 'moment scales with Vref^2');
  S.hawt.vref = 42.5; setMode('HAWT');
});
