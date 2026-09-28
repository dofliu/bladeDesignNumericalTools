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
