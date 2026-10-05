// Controller / MPPT regression, run directly in Node against src/core.mjs (no browser needed).
// core.mjs imports aero.mjs/geo.mjs directly. This mirrors the scenarios tests/e2e.smoke.mjs checks in
// the built dist, giving fast feedback without spinning up Playwright; the e2e test still covers
// the same tracking regression against the actual built artifact end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.mjs';
import * as A from '../src/aero.mjs';

const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep,
  gammaFn, weibullPdf, parseWindSeries, windSeriesPdf, windDensity, capacityFactor, noiseEstimate, costEstimate, rootStress, fatigueEstimate, pitchRegulation, MATERIALS } = core;

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
  for (let i = 0; i < n; i++) assert.ok(G.rows[i].Ixx > 0, `station ${i} Ixx must be positive (thick root sections used to fold the shell offset): ${G.rows[i].Ixx}`);
  for (let i = 1; i < n; i++) assert.ok(G.rows[i].Ixx <= G.rows[i - 1].Ixx * 1.001, `Ixx should not grow outboard (station ${i})`);
  assert.ok(G.loads.tipDefl < 0.1 * S.hawt.R, `tip deflection should be a small fraction of the radius: ${G.loads.tipDefl} m`);
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

test('HAWT parked extreme-gust (Ve50) load case is bigger than the design-point flapwise load', () => {
  setMode('HAWT');
  const e = G.loads.extreme;
  assert.ok(e, 'G.loads.extreme populated');
  assert.ok(Math.abs(e.Ve50 - 59.5) < 1e-9, `Ve50 = 1.4 x 42.5: ${e.Ve50}`);
  const { rho } = air();
  // analytic check: uniform normal force on each station -> root moment ~ q*Cn*sum(c*dr*r)
  // (cumulativeMoment counts only the stations outboard of each one, so skip the root station)
  let M = 0; G.rows.slice(1).forEach(x => { M += 0.5 * rho * e.Ve50 * e.Ve50 * 1.2 * x.c * x.dr * (x.r - G.rows[0].r); });
  assert.ok(Math.abs(e.MflapRoot - M) / M < 1e-6, `root moment ${e.MflapRoot} vs analytic ${M}`);
  assert.ok(e.MflapRoot > G.loads.MflapRoot, 'parked extreme gust exceeds the design-point flapwise moment');
  assert.ok(e.tipDefl > 0 && isFinite(e.tipDefl), `tip deflection: ${e.tipDefl}`);
  assert.ok(e.minSafety > 0 && isFinite(e.minSafety), `extreme safety factor: ${e.minSafety}`);
  for (let i = 1; i < G.rows.length; i++) assert.ok(G.rows[i].MflapExt <= G.rows[i - 1].MflapExt + 1e-9, 'extreme moment decreases outboard');
  designVAWT();
  assert.equal(G.loads, null, 'VAWT has no structural loads yet');
  setMode('HAWT');
});

test('equivalent shell section matches the mass-model area for every material (incl. solid wood)', () => {
  const mat0 = S.hawt.material;
  for (const k of Object.keys(MATERIALS)) {
    S.hawt.material = k; setMode('HAWT');
    G.rows.forEach((x, i) => {
      const target = MATERIALS[k].fill * A.airfoilArea(G.afs[i]) * x.c * x.c;
      assert.ok(Math.abs(x.secArea / target - 1) < 0.01, `${k} station ${i}: area ${x.secArea} vs ${target}`);
      assert.ok(x.Ixx > 0, `${k} station ${i}: Ixx ${x.Ixx}`);
    });
  }
  S.hawt.material = mat0; setMode('HAWT');
});

function rootStressHistory(TI, dur) {
  S.tun.TI = TI; S.tun.V = 8; S.load.ctrl = 'tsr';
  SIM.omega = G.lopt * 8 / G.R; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
  SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.po.wref = -1;
  for (let t = 0; t < 10; t += 0.004) simStep(0.004);
  const sig = [], th0 = SIM.theta;
  for (let t = 0; t < dur; t += 0.004) { simStep(0.004); sig.push(rootStress()); }
  return { sig, revs: (SIM.theta - th0) / (2 * Math.PI) };
}

test('HAWT root stress history: steady mean at design, 1P gravity cycles, turbulence shortens fatigue life', () => {
  setMode('HAWT');
  const r = G.loads.root, design = r.sFlap + r.sEdge + r.sAx;
  const calm = rootStressHistory(0, 30), fc = fatigueEstimate(calm.sig, 30);
  const mean = calm.sig.reduce((t, v) => t + v, 0) / calm.sig.length;
  assert.ok(Math.abs(mean / design - 1) < 0.25, `steady mean root stress ${mean} vs design ${design}`);
  assert.ok(Math.abs(fc.n / calm.revs - 1) < 0.3, `calm wind: ~one rainflow cycle per revolution (gravity 1P): ${fc.n} vs ${calm.revs} revs`);
  const turb = rootStressHistory(0.15, 30), ft = fatigueEstimate(turb.sig, 30);
  assert.ok(ft.D > fc.D * 10, `15% turbulence should add far more damage: ${ft.D} vs ${fc.D}`);
  assert.ok(ft.lifeYears > 0 && isFinite(ft.lifeYears), `finite fatigue life: ${ft.lifeYears}`);
  assert.ok(ft.sMax < MATERIALS[S.hawt.material].su, 'peak root stress below ultimate strength');
  S.tun.TI = 0;
  designVAWT();
  assert.equal(rootStress(), null, 'VAWT has no root stress model');
  setMode('HAWT');
});

test('pitchRegulation holds power at the generator limit above rated with monotonic feathering', () => {
  setMode('HAWT');
  const target = S.load.Pmax / S.load.eta;
  const r = pitchRegulation([6, 9, 14, 18, 22, 25]);
  assert.equal(r.pitch[0], 0, 'no pitch below rated');
  for (let i = 0; i < r.V.length; i++) {
    if (r.V[i] >= 14) {
      assert.ok(r.pitch[i] > 0 && !r.sat[i], `pitch active at ${r.V[i]} m/s`);
      assert.ok(Math.abs(r.Pa[i] - target) / target < 0.01, `power flat at ${r.V[i]} m/s: ${r.Pa[i].toFixed(0)} vs ${target.toFixed(0)}`);
    }
    if (i > 0) assert.ok(r.pitch[i] >= r.pitch[i - 1] - 1e-9, 'pitch non-decreasing with wind speed');
  }
});

test('time-domain pitch control feathers above rated, holds power near the limit and returns to 0° below rated', () => {
  setMode('HAWT');
  const run = (V, dur) => { S.tun.TI = 0; S.tun.V = V; for (let t = 0; t < dur; t += 0.004) simStep(0.004); };
  const reset = V => { S.load.ctrl = 'po'; S.load.cutOut = false; S.load.ospd = true; SIM.Vmeas = V; SIM.omega = G.lopt * V / G.R * 0.8; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
    SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.cutout = false; SIM.n = 0; SIM.po.wref = -1; SIM.trips = 0; SIM.wPrevObs = null; SIM.pitch = 0; };
  S.load.pitchCtl = true; S.load.pitchRate = 5;
  reset(16); run(16, 90);
  assert.ok(SIM.pitch > 4 && SIM.pitch < 40, `pitch should feather above rated, got ${SIM.pitch.toFixed(1)}°`);
  let e = 0, n = 0, trips = SIM.trips;
  for (let t = 0; t < 20; t += 0.004) { simStep(0.004); e += SIM.out.el.Pout; n++; }
  assert.ok(e / n < 1.1 * S.load.Pmax && e / n > 0.8 * S.load.Pmax, `mean power ${(e / n).toFixed(0)} W should sit near Pmax ${S.load.Pmax} W`);
  assert.equal(SIM.trips, trips, 'no protection trips while pitch regulates');
  run(6, 90);
  assert.ok(SIM.pitch < 0.5, `pitch should return to 0° below rated, got ${SIM.pitch.toFixed(2)}°`);
  S.load.pitchCtl = false; SIM.pitch = 0;
});

test('furling yaws the rotor out of the wind above vFurl, cuts power and recovers below', () => {
  setMode('HAWT');
  const run = (V, dur) => { S.tun.TI = 0; S.tun.V = V; for (let t = 0; t < dur; t += 0.004) simStep(0.004); };
  const reset = V => { S.load.ctrl = 'po'; S.load.cutOut = false; S.load.pitchCtl = false; S.load.ospd = true; SIM.Vmeas = V; SIM.omega = G.lopt * V / G.R * 0.8; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null;
    SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.cutout = false; SIM.n = 0; SIM.po.wref = -1; SIM.trips = 0; SIM.wPrevObs = null; SIM.pitch = 0; SIM.furlAng = 0; };
  S.tun.yawMode = 'auto'; S.tun.dir = 0; SIM.yaw = 0;
  S.load.furl = true; S.load.vFurl = 11; S.load.furlMax = 60; S.load.furlRate = 4;
  reset(8); run(8, 20);
  assert.equal(SIM.furlAng, 0, 'no furling below vFurl');
  reset(18); run(18, 30);
  assert.ok(Math.abs(SIM.furlAng - 60) < 1e-6, `full furl at vFurl+6 m/s, got ${SIM.furlAng}`);
  // cd0 高 Re 校正後(PR 說明):側偏 60° 轉速比由 0.57 升為 0.76(阻力降低),門檻 0.7 → 0.8,仍須明顯低於未側偏最佳轉速
  assert.ok(SIM.omega < G.lopt * 18 / G.R * 0.8, 'furled rotor must not spin at the unfurled optimum speed');
  run(6, 40);
  assert.equal(SIM.furlAng, 0, 'furl angle returns to 0 below vFurl');
  S.load.furl = false; SIM.furlAng = 0;
});

test('parseWindSeries 取每行最後一個數值並略過標題與負值', () => {
  const v = parseWindSeries('time,speed\n2020-01-01 00:00,5.5\n2020-01-01 01:00;6\n\n7\nabc\n-3\n');
  assert.deepEqual(v, [5.5, 6, 7]);
});

test('windSeriesPdf 直方圖積分為 1(範圍內)且平均值正確;windDensity 匯入後取代 Weibull', () => {
  const vals = []; for (let i = 0; i < 2000; i++) vals.push(0.5 * (1 + (i % 20))); // 0.5..10 均勻
  const h = windSeriesPdf(vals);
  assert.ok(Math.abs(h.pdf.reduce((a, b) => a + b, 0) * h.dv - 1) < 1e-9);
  assert.ok(Math.abs(h.mean - 5.25) < 1e-9);
  const old = core.S.perf.series;
  core.S.perf.series = { name: 't', ...h };
  assert.ok(Math.abs(windDensity(5) - 0.1) < 1e-9, '10 個 bin 各 0.1');
  assert.equal(windDensity(20), 0);
  core.S.perf.series = null;
  assert.ok(Math.abs(windDensity(5) - weibullPdf(5, core.S.perf.Vavg, core.S.perf.k)) < 1e-12);
  core.S.perf.series = old;
});

test('噪音估計:尖速 5 次方律與球面擴散', () => {
  const a = noiseEstimate(60, 3, 50), b = noiseEstimate(120, 3, 50);
  assert.ok(Math.abs((b.Lw - a.Lw) - 50 * Math.log10(2)) < 1e-9); // doubling tip speed -> +15.05 dB
  const c = noiseEstimate(60, 3, 100);
  assert.ok(Math.abs((a.Lp - c.Lp) - (20 * Math.log10(2) + 0.005 * 50)) < 1e-9); // -6 dB per distance doubling + absorption
  // Hau formula reference: V 70 m/s, D 100 m -> ~ 50*1.845+20-4 = 108 dB(A)
  assert.ok(Math.abs(noiseEstimate(70, 100).Lw - 108.3) < 0.5);
  designHAWT(); computePerf();
  const n = noiseEstimate(S.hawt.tsr * S.hawt.Vd, 2 * S.hawt.R, 50);
  assert.ok(n.Lw > 60 && n.Lw < 100 && n.Lp < n.Lw);
});

test('成本單價可調:覆寫葉片單價/費率會改變資本支出與 LCOE,預設不變', () => {
  const base = costEstimate(10, 'gfrp', 3000, 7, 5000, {});
  assert.ok(Math.abs(costEstimate(10, 'gfrp', 3000, 7, 5000).capex - base.capex) < 1e-9, 'S.perf.cost 預設為空');
  const m = costEstimate(10, 'gfrp', 3000, 7, 5000, { matCost: 1000 });
  assert.ok(Math.abs(m.blades - 10000) < 1e-9);
  const g = costEstimate(10, 'gfrp', 3000, 7, 5000, { gen: 60 });
  assert.ok(Math.abs(g.gen - 3000 * 60) < 1e-9 && g.lcoe > base.lcoe);
  const f = costEstimate(10, 'gfrp', 3000, 7, 5000, { fcr: 0.16, om: 0 });
  assert.ok(Math.abs(f.annual - base.capex * 0.16) < 1e-6);
  S.perf.cost = { tower: 6000 };
  const t = costEstimate(10, 'gfrp', 3000, 7, 5000);
  S.perf.cost = {};
  assert.ok(Math.abs(t.tower - 7 * 6000) < 1e-9);
});

test('成本:明確傳入的單價(方案快照)不受目前 S.perf.cost 影響', () => {
  const snap = { gen: 40 };
  S.perf.cost = { gen: 200 };
  const cur = costEstimate(10, 'gfrp', 3000, 7, 5000);
  const sn = costEstimate(10, 'gfrp', 3000, 7, 5000, snap);
  S.perf.cost = {};
  assert.ok(Math.abs(cur.gen - 3000 * 200) < 1e-9 && Math.abs(sn.gen - 3000 * 40) < 1e-9);
});

test('成本與 LCOE 粗估:各項加總、與發電量成反比、材料單價影響', () => {
  const a = costEstimate(10, 'gfrp', 3000, 7, 5000);
  assert.ok(Math.abs(a.capex - (a.blades + a.gen + a.tower)) < 1e-9);
  assert.ok(Math.abs(a.blades - 10 * MATERIALS.gfrp.cost) < 1e-9);
  assert.ok(Math.abs(a.lcoe * 5000 - a.annual) < 1e-6);
  const b = costEstimate(10, 'gfrp', 3000, 7, 10000);
  assert.ok(Math.abs(a.lcoe / b.lcoe - 2) < 1e-9);
  assert.ok(costEstimate(10, 'cfrp', 3000, 7, 5000).capex > a.capex);
  assert.equal(costEstimate(10, 'gfrp', 3000, 7, 0).lcoe, Infinity);
  designHAWT(); computePerf();
  const d = costEstimate(G.mass, S.hawt.material, S.load.Pmax, G.A, 4000);
  assert.ok(d.lcoe > 1 && d.lcoe < 100, 'LCOE ' + d.lcoe);
});
