// Controller / MPPT regression, run directly in Node against src/core.mjs (no browser needed).
// core.mjs imports aero.mjs/geo.mjs directly. This mirrors the scenarios tests/e2e.smoke.mjs checks in
// the built dist, giving fast feedback without spinning up Playwright; the e2e test still covers
// the same tracking regression against the actual built artifact end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.mjs';
import * as A from '../src/aero.mjs';

const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep,
  gammaFn, weibullPdf, parseWindSeries, windSeriesPdf, windDensity, capacityFactor, snapRated, idealAEP, noiseEstimate, blDstarFn, tbleNoise, tbleSpectrum, tipVortexNoise, costEstimate, rootStress, fatigueEstimate, pitchRegulation, startupRun, MATERIALS } = core;

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

test('BPM 後緣自噪音:轉速 5 次方律、距離平方反比、葉片數能量相加,設計點量級合理', () => {
  designHAWT(); computePerf();
  const { rho, mu } = air(), B = S.hawt.B;
  const n1 = tbleNoise(G.rows, G.desElems, B, rho, mu, 50);
  // scaling in relative speed: W x 1.5 -> Re also changes (thinner d*), so only require a clear rise
  const fast = G.desElems.map(e => ({ ...e, W: e.W * 1.5 }));
  assert.ok(tbleNoise(G.rows, fast, B, rho, mu, 50).Lp > n1.Lp + 3);
  assert.ok(Math.abs((n1.Lp - tbleNoise(G.rows, G.desElems, B, rho, mu, 100).Lp) - 20 * Math.log10(2)) < 1e-6);
  assert.ok(Math.abs((tbleNoise(G.rows, G.desElems, 2 * B, rho, mu, 50).Lp - n1.Lp) - 10 * Math.log10(2)) < 1e-6);
  assert.ok(n1.Lp > 20 && n1.Lp < 90, 'Lp ' + n1.Lp);
  // higher AoA -> thicker suction-side BL -> louder
  const hi = G.desElems.map(e => ({ ...e, alpha: e.alpha + 6 }));
  assert.ok(tbleNoise(G.rows, hi, B, rho, mu, 50).Lp > n1.Lp);
});

test('BPM 後緣噪音頻譜:距離平方反比、葉片數加成、A 加權與未加權同量級、峰值在中高頻', () => {
  designHAWT(); computePerf();
  const { rho, mu } = air(), B = S.hawt.B;
  const s1 = tbleSpectrum(G.rows, G.desElems, B, rho, mu, 50);
  assert.ok(Math.abs((s1.Lp - tbleSpectrum(G.rows, G.desElems, B, rho, mu, 100).Lp) - 20 * Math.log10(2)) < 1e-6);
  assert.ok(Math.abs((tbleSpectrum(G.rows, G.desElems, 2 * B, rho, mu, 50).Lp - s1.Lp) - 10 * Math.log10(2)) < 1e-6);
  assert.ok(s1.LA < s1.Lp + 3 && s1.LA > s1.Lp - 25, `LA ${s1.LA} Lp ${s1.Lp}`);
  const pk = s1.bands.reduce((m, b) => b.L > m.L ? b : m);
  assert.ok(pk.f >= 200 && pk.f <= 5000, 'peak ' + pk.f);
  // same order of magnitude as the single-number form (which adds +5 dB for the band sum)
  assert.ok(Math.abs(s1.Lp - tbleNoise(G.rows, G.desElems, B, rho, mu, 50).Lp) < 12);
  console.log('tbleSpectrum Lp', s1.Lp.toFixed(1), 'LA', s1.LA.toFixed(1), 'peak', pk.f.toFixed(0));
});

test('BPM 高攻角 SPL_alpha:攻角升高噪音上升且仍為有限值', () => {
  designHAWT(); computePerf();
  const { rho, mu } = air(), B = S.hawt.B;
  const base = tbleSpectrum(G.rows, G.desElems, B, rho, mu, 50);
  const hi = G.desElems.map(e => ({ ...e, alpha: e.alpha + 12 * Math.sign(e.alpha || 1) }));
  const sh = tbleSpectrum(G.rows, hi, B, rho, mu, 50);
  assert.ok(Number.isFinite(sh.Lp) && Number.isFinite(base.Lp));
  assert.ok(sh.Lp > base.Lp + 3, `hi ${sh.Lp} base ${base.Lp}`);
  console.log('SPL_alpha Lp base', base.Lp.toFixed(1), 'hi', sh.Lp.toFixed(1));
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

test('方案快照的額定功率:有記錄用快照、舊方案沿用目前 S.load.Pmax', () => {
  const keep = S.load.Pmax; S.load.Pmax = 5000;
  assert.equal(snapRated({ Pmax: 2000 }), 2000);
  assert.equal(snapRated({}), 5000);
  assert.equal(snapRated({ Pmax: 0 }), 5000);
  S.load.Pmax = keep;
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

test('idealAEP:額定限幅使容量因數 ≤ 1、單調且未限額時等於不限幅', () => {
  const m = { A: 7, cpMax: 0.45 }, free = idealAEP(m, 0), cap = idealAEP(m, 3000), tiny = idealAEP(m, 1);
  assert.ok(cap < free && tiny < cap && cap > 0);
  assert.ok(capacityFactor(tiny, 1) <= 1 + 1e-9 && capacityFactor(cap, 3000) <= 1);
  assert.ok(Math.abs(idealAEP(m, 1e9) - free) < 1e-6 * free);
});

test('VAWT 啟動模擬:靜止無法自行加速(轉矩死區),輔助起轉後可達設計轉速,風越大越快', () => {
  setMode('VAWT');
  const rest = startupRun(4, 0, 40);
  assert.ok(!rest.started && rest.lambda < 1, `靜止 4 m/s 不應自行啟動,λ=${rest.lambda.toFixed(2)}`);
  const slow = startupRun(6, 0.3, 80), fast = startupRun(9, 0.3, 80);
  assert.ok(slow.started && fast.started, '輔助起轉到設計轉速 30% 後 6、9 m/s 都應能加速');
  assert.ok(fast.tHalf < slow.tHalf, `風速高啟動較快:9 m/s ${fast.tHalf.toFixed(1)} s < 6 m/s ${slow.tHalf.toFixed(1)} s`);
  assert.ok(startupRun(6, 0, 60).lambda < slow.lambda, '靜止起動比輔助起轉慢');
});

test('BPM 後緣噪音:改用邊界層 δ* 仍為合理量級,攻角升高 δ* 與噪音上升', () => {
  designHAWT(); computePerf();
  const { rho, mu } = air(), B = S.hawt.B, fn = blDstarFn(G.afs);
  const emp = tbleSpectrum(G.rows, G.desElems, B, rho, mu, 50), bl = tbleSpectrum(G.rows, G.desElems, B, rho, mu, 50, fn);
  assert.ok(Number.isFinite(bl.Lp) && Math.abs(bl.Lp - emp.Lp) < 15, `bl ${bl.Lp} emp ${emp.Lp}`);
  assert.ok(Math.abs((bl.Lp - tbleSpectrum(G.rows, G.desElems, B, rho, mu, 100, fn).Lp) - 20 * Math.log10(2)) < 1e-6);
  const d = (a) => fn(Math.floor(G.rows.length / 2), 5e5, a);
  assert.ok(d(10)[0] > d(2)[0], '高攻角吸力面 δ* 較厚');
  const lo = G.desElems.map(e => ({ ...e, alpha: 2 })), hi = G.desElems.map(e => ({ ...e, alpha: 10 }));
  assert.ok(tbleNoise(G.rows, hi, B, rho, mu, 50, fn).Lp > tbleNoise(G.rows, lo, B, rho, mu, 50, fn).Lp);
  console.log('BL δ* spectrum Lp', bl.Lp.toFixed(1), 'empirical', emp.Lp.toFixed(1));
});

test('BPM 葉尖渦噪音:距離/葉片數縮放、攻角升高噪音上升、量級合理', () => {
  designHAWT(); computePerf();
  const { rho, mu } = air(), B = S.hawt.B;
  const t1 = tipVortexNoise(G.rows, G.desElems, B, rho, mu, 50);
  assert.ok(Number.isFinite(t1.Lp) && Number.isFinite(t1.LA) && t1.bands.length === 21);
  assert.ok(Math.abs((t1.Lp - tipVortexNoise(G.rows, G.desElems, B, rho, mu, 100).Lp) - 20 * Math.log10(2)) < 1e-6);
  assert.ok(Math.abs((tipVortexNoise(G.rows, G.desElems, 2 * B, rho, mu, 50).Lp - t1.Lp) - 10 * Math.log10(2)) < 1e-6);
  const mk = a => G.desElems.map((e, i, arr) => i === arr.length - 1 ? { ...e, alpha: a } : e);
  assert.ok(tipVortexNoise(G.rows, mk(10), B, rho, mu, 50).Lp > tipVortexNoise(G.rows, mk(3), B, rho, mu, 50).Lp);
  const te = tbleSpectrum(G.rows, G.desElems, B, rho, mu, 50);
  assert.ok(t1.Lp < te.Lp + 10, `tip ${t1.Lp} TE ${te.Lp}`);
  console.log('tip vortex Lp', t1.Lp.toFixed(1), 'LA', t1.LA.toFixed(1), 'TE Lp', te.Lp.toFixed(1));
});

test('自訂性能曲線轉子(type custom):以 Savonius 曲線取樣匯入,computePerf 與內建一致,MPPT 追蹤 >= 90%', () => {
  const saved = { mode: S.mode, type: S.vawt.type, tun: { ...S.tun }, load: { ...S.load } };
  try {
    S.mode = 'VAWT'; S.vawt.type = 'sav'; designVAWT(); computePerf();
    const ref = { cp: G.cpMax, lopt: G.lopt, A: G.A, R: G.R };
    const text = 'lambda,Cp,Cq\n' + G.perf.lam.map((l, i) => l > 0 ? `${l},${G.perf.cp[i]},${G.perf.cq[i]}` : '').filter(Boolean).join('\n');
    const { pts, warnings } = A.parseCpCurve(text);
    assert.equal(warnings.length, 0);
    Object.assign(S.custom, { R: G.R, H: S.vawt.H, area: G.A, mass: G.mass, J: G.J, pts });
    S.vawt.type = 'custom'; designVAWT(); computePerf();
    assert.ok(Math.abs(G.cpMax - ref.cp) / ref.cp < 0.02, `Cp,max ${G.cpMax} vs ${ref.cp}`);
    assert.ok(Math.abs(G.lopt - ref.lopt) / ref.lopt < 0.02, `λopt ${G.lopt} vs ${ref.lopt}`);
    assert.equal(G.A, ref.A); assert.equal(G.R, ref.R);
    autoMatchGen();
    const track = trackingRatio('po', 6, 70);
    assert.ok(track >= 0.9, `custom po 6 m/s tracking ${(track * 100).toFixed(1)}%`);
  } finally {
    S.mode = saved.mode; S.vawt.type = saved.type; Object.assign(S.tun, saved.tun); Object.assign(S.load, saved.load);
  }
});

test('自訂性能曲線轉子:未匯入資料時 computePerf 丟出明確錯誤;area 未設定時以 2RH 估算', () => {
  const savedType = S.vawt.type, savedMode = S.mode, savedPts = S.custom.pts;
  try {
    S.mode = 'VAWT'; S.vawt.type = 'custom';
    Object.assign(S.custom, { R: 0.8, H: 1.5, area: 0, pts: null });
    designVAWT();
    assert.ok(Math.abs(G.A - 2.4) < 1e-9);
    assert.throws(() => computePerf(), /尚未匯入/);
  } finally { S.vawt.type = savedType; S.mode = savedMode; S.custom.pts = savedPts; }
});

test('自訂性能曲線轉子:內建示意範例可解析、無警告,Cp,max/λopt 符合範例標示,MPPT 追蹤 >= 90%', () => {
  const saved = { mode: S.mode, type: S.vawt.type, tun: { ...S.tun }, load: { ...S.load }, custom: { ...S.custom } };
  try {
    S.mode = 'VAWT'; S.vawt.type = 'custom';
    for (const [key, cpMax, lopt, V] of [['lift', 0.32, 3.5, 6], ['drag', 0.18, 0.8, 9]]) {
      const ex = core.CUSTOM_EXAMPLES[key];
      assert.match(ex.name, /非實測/);
      const { pts, warnings } = A.parseCpCurve(ex.text);
      assert.equal(warnings.length, 0);
      Object.assign(S.custom, { R: 1, H: 2, area: 0, mass: 20, J: 0, pts });
      designVAWT(); computePerf();
      assert.ok(Math.abs(G.cpMax - cpMax) < 0.01, `${key} Cp,max ${G.cpMax}`);
      assert.ok(Math.abs(G.lopt - lopt) < 0.15, `${key} λopt ${G.lopt}`);
      autoMatchGen();
      // drag-type example: below ~7 m/s the low rotor speed puts generator losses at ~11% (all controllers ~89%), so it is checked at 9 m/s
      for (const ctrl of ['po', 'tsr']) {
        const track = trackingRatio(ctrl, V, 70);
        assert.ok(track >= 0.9, `${key} ${ctrl} ${V} m/s tracking ${(track * 100).toFixed(1)}%`);
      }
    }
    for (const [k, f] of Object.entries(core.VAWT_FAMILIES)) { assert.equal(core.VAWT_TYPES[k], f.name); assert.ok(f.source); if (f.noAirfoil) assert.ok(f.curveTitle && f.flowNote, k); }
    assert.ok(core.noAirfoil({ type: 'custom' }) && core.noAirfoil({ type: 'sav' }) && !core.noAirfoil({ type: 'H' }));
  } finally {
    S.mode = saved.mode; S.vawt.type = saved.type; Object.assign(S.tun, saved.tun); Object.assign(S.load, saved.load); Object.assign(S.custom, saved.custom);
  }
});

test('家族註冊表:3D 場景規格(shape / struts)與重構前的內嵌公式一致', () => {
  const F = core.VAWT_FAMILIES, near = (a, b, k) => assert.ok(Math.abs(a - b) < 1e-12, `${k}: ${a} vs ${b}`);
  for (const [k, f] of Object.entries(F)) {
    assert.ok(['blades', 'savonius', 'envelope'].includes(f.scene), k + ' scene');
    if (f.scene === 'blades') assert.ok(typeof f.shape === 'function' && typeof f.struts === 'function', k + ' shape/struts');
  }
  const v = { R: 1.2, H: 2.5, c: 0.15, helix: 120, struts: 2 }, y0 = 0.75, ph = 0.4;
  const run = (k, vv = v) => { const sf = x => F[k].shape(vv, x); return { sf, st: F[k].struts(vv, ph, y0, sf) }; };
  // H: straight blade, arm struts at [0.22, 0.78] for 2 per blade
  let { sf, st } = run('H');
  near(sf(0.3).r, v.R, 'H r'); near(sf(0.3).off, 0, 'H off');
  assert.deepEqual(st.map(s => s.y), [y0 + 0.22 * v.H, y0 + 0.78 * v.H]);
  st.forEach(s => { near(s.r, v.R, 'H strut r'); near(s.w, 0.6 * v.c, 'H strut w'); near(s.ang, ph, 'H strut ang'); });
  for (const [n, len] of [[0, 0], [1, 1], [3, 3]]) assert.equal(run('H', { ...v, struts: n }).st.length, len, 'H struts ' + n);
  // helical: twist grows linearly with height; 3 struts -> [0.02, 0.98, 0.5]
  ({ sf, st } = run('helical', { ...v, struts: 3 }));
  near(sf(1).off, v.helix * Math.PI / 180, 'helical off');
  assert.deepEqual(st.map(s => +((s.y - y0) / v.H).toFixed(6)), [0.02, 0.98, 0.5]);
  near(st[1].ang, ph + v.helix * Math.PI / 180 * 0.98, 'helical strut ang');
  assert.equal(run('helical', { ...v, struts: 0 }).st.length, 0);
  // phi: troposkien-like parabola, hub struts top and bottom
  ({ sf, st } = run('phi'));
  near(sf(0.5).r, v.R, 'phi mid'); near(sf(0).r, 0.06 * v.R, 'phi end');
  assert.deepEqual(st.map(s => s.y), [y0 + 0.01 * v.H, y0 + 0.99 * v.H]);
  st.forEach(s => { near(s.r, 0.08 * v.R, 'phi strut r'); near(s.w, 0.5 * v.c, 'phi strut w'); });
  // V: radius grows with height, one hub strut at the bottom
  ({ sf, st } = run('V'));
  near(sf(0).r, 0.05 * v.R, 'V root'); near(sf(0.5).r, 0.5 * v.R, 'V mid');
  assert.equal(st.length, 1); near(st[0].y, y0 + 0.02 * v.H, 'V strut y');
});

test('家族註冊表:每個垂直軸型式都有 badge 與 csv,內容含型式名稱與表頭', () => {
  const fmt = (v, d = 1) => (+v).toFixed(d), label = k => k;
  const keep = { mode: S.mode, type: S.vawt.type };
  S.mode = 'VAWT';
  try {
    for (const [k, f] of Object.entries(core.VAWT_FAMILIES)) {
      S.vawt.type = k;
      if (k === 'custom') { G.A = 3.2; S.custom.pts = S.custom.pts || [{ l: 1, Cp: 0.2, Cq: 0.2 }]; }
      else { designVAWT(); }
      assert.ok(f.badge(fmt, label).includes(f.name), k + ' badge');
      assert.match(f.csv(), /^(type|z_m),/, k + ' csv 表頭');
      const esc = x => String(x), rows = f.condRows(fmt, esc, label);
      assert.equal(rows[0][1], f.name, k + ' condRows 型式');
      assert.ok(rows.some(r => r[0] === '掃掠面積') && rows.some(r => r[0] === '轉子質量'), k + ' condRows 面積/質量');
      assert.ok(f.title(fmt).startsWith(f.name), k + ' title');
    }
  } finally { S.mode = keep.mode; S.vawt.type = keep.type; }
});

// 8C-1(5/N): designVAWT 的質量/慣量分支改由註冊表 design() 提供;數值釘在重構前的輸出
test('VAWT_FAMILIES design():各家族面積/質量/慣量與重構前一致', () => {
  const keep = JSON.parse(JSON.stringify({ v: S.vawt, mode: S.mode }));
  const want = { // [A, mass, bladeMass, J],B=2、PLA、struts=2、overlap=0.2
    H: [4, 6.956883273479466, 2.870980516739733, 6.771628624827413],
    phi: [2.68, 8.474903573218292, 4.237451786609146, 4.15662612862363],
    V: [2.004, 6.419707597507517, 3.2098537987537585, 2.3587848384076726],
    sav: [4, 60.25155830564745, 30.125779152823725, 33.158357068106106]
  };
  const same = (k, got) => got.forEach((x, i) => assert.ok(Math.abs(x - want[k][i]) < 1e-9 * want[k][i], k + ' 值 ' + i));
  S.mode = 'VAWT';
  for (const k of Object.keys(core.VAWT_FAMILIES)) assert.equal(typeof core.VAWT_FAMILIES[k].design, 'function', k + ' 缺 design()');
  Object.assign(S.vawt, { type: 'H', B: 2, material: 'pla', struts: 2, overlap: 0.2 });
  designVAWT();
  same('H', [G.A, G.mass, G.bladeMass, G.J]);
  Object.assign(S.vawt, { type: 'helical' }); designVAWT();
  assert.ok(Math.abs(G.mass - want.H[1]) < 1e-9, 'helical 質量');
  Object.assign(S.vawt, { type: 'phi' }); designVAWT();
  same('phi', [G.A, G.mass, G.bladeMass, G.J]);
  Object.assign(S.vawt, { type: 'V' }); designVAWT(); same('V', [G.A, G.mass, G.bladeMass, G.J]);
  Object.assign(S.vawt, { type: 'sav' }); designVAWT();
  same('sav', [G.A, G.mass, G.bladeMass, G.J]);
  Object.assign(S.vawt, { type: 'custom' }); designVAWT();
  assert.equal(G.R, S.custom.R); assert.equal(G.mass, S.custom.mass);
  Object.assign(S.vawt, keep.v); S.mode = keep.mode;
  designHAWT();
});

test('註冊表 shape() 與 STL 匯出原本寫死的各型式外形一致', () => {
  const v = { R: 1.3, helix: 40 };
  const old = (type, f) => type === 'phi' ? { r: v.R * Math.max(0.06, 1 - (2 * f - 1) ** 2), off: 0 } : type === 'V' ? { r: v.R * Math.max(0.05, f), off: 0 } : { r: v.R, off: type === 'helical' ? v.helix * A.D2R * f : 0 };
  for (const type of ['H', 'helical', 'phi', 'V']) for (const f of [0, 0.1, 0.5, 0.9, 1]) {
    assert.deepEqual(core.VAWT_FAMILIES[type].shape(v, f), old(type, f), type + ' f=' + f);
  }
});
