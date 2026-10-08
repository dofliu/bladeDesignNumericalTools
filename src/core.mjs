/* ===== App core: state, computation, simulation ===== */
// Real ES module (ROADMAP 1). scripts/build.mjs bundles it to a `CORE` IIFE and then republishes
// every export as a bare global so ui.js/bench.js keep working unchanged.
// Node tests import it directly (see tests/core.test.mjs).
import * as A from './aero.mjs';
import * as GEO from './geo.mjs';
// E: 楊氏模數 (Pa),供結構彎曲/撓度估算; allow: 容許應力 (Pa,已含疲勞/安全係數的保守值),
// 供結構安全係數估算。兩者皆為典型文獻值的合理預設,尚未做逐站/逐使用者調整。
// cost: rough finished-blade price (NT$/kg, material + fabrication), conceptual only.
// su: ultimate strength and m: Basquin S-N slope (N = (su/Sa)^m), typical conceptual values for fatigue.
const MATERIALS = {
  gfrp: { name: '玻纖複合材(空心殼)', rho: 1850, cost: 400, fill: 0.28, E: 20e9, allow: 100e6, su: 250e6, m: 10 },
  wood: { name: '木材(實心)', rho: 550, cost: 150, fill: 1, E: 11e9, allow: 40e6, su: 70e6, m: 12 },
  alu: { name: '鋁擠型(空心)', rho: 2700, cost: 300, fill: 0.22, E: 69e9, allow: 110e6, su: 290e6, m: 7 },
  pla: { name: '3D 列印 PLA(30% 填充)', rho: 1240, cost: 800, fill: 0.42, E: 2.3e9, allow: 20e6, su: 50e6, m: 8 },
  cfrp: { name: '碳纖複合材(空心殼)', rho: 1550, cost: 2000, fill: 0.22, E: 70e9, allow: 250e6, su: 600e6, m: 14 }
};
const VAWT_TYPES = { H: 'H 型(直葉片)', helical: '螺旋型(Gorlov)', phi: 'Φ 型(Darrieus 打蛋器)', V: 'V 型', sav: 'Savonius 阻力型' };

const S = {
  mode: 'HAWT', step: 'af', ctab: 'airfoil',
  af: { st: [{ f: 0.2, k: 'n4:4421' }, { f: 0.5, k: 'n4:4415' }, { f: 0.8, k: 'n4:4412' }], vawt: 'n4:0018', cdMax: 1.3, custom: [], imported: [], polarImp: {}, view: 2, alphaView: 6, reIdx: 3, full: false },
  hawt: { R: 1.5, Rhub: 0.15, B: 3, tsr: 7, Vd: 8, aMode: 'auto', aDes: 5, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChord: 0.12, pitch: 0, material: 'gfrp', ov: {}, twMode: 'bem', twRoot: 20, twTip: 0 },
  vawt: { type: 'H', R: 1.0, H: 2.0, B: 3, c: 0.15, pitch: 0, helix: 120, struts: 2, dynStall: false, curvature: false, overlap: 0.2, endPlates: true, material: 'gfrp' },
  tun: { V: 8, dir: 0, TI: 0.08, T: 15, alt: 0, yawMode: 'auto', yawRate: 8, yawFixed: 0, timeScale: 1, running: true },
  load: { kind: 'bat', RL: 5, Vbat: 48, ke: 2, Rs: 0.5, Vdiode: 1.4, eta: 0.95, ctrl: 'po', D: 0.5, poStep: 0.03, poT: 1.0, ospd: true, wmaxRpm: 900, Pmax: 2500, auto: true,
    cutOut: false, vCutOut: 20, vRestart: 15, pitchCtl: false, pitchRate: 5, furl: false, vFurl: 11, furlMax: 60, furlRate: 4 },
  perf: { Vavg: 5.5, k: 2, series: null, cost: {} }
};

/* ---------- wind resource: Weibull distribution & capacity factor ---------- */
function gammaFn(x) { // Lanczos approximation (g=7, n=9)
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  x -= 1;
  let a = p[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += p[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
function weibullPdf(v, meanV, k) { // Weibull pdf with mean meanV and shape k (k=2 is the Rayleigh case)
  if (v <= 0) return 0;
  const c = meanV / gammaFn(1 + 1 / k);
  return (k / c) * Math.pow(v / c, k - 1) * Math.exp(-Math.pow(v / c, k));
}
function parseWindSeries(text) { // one wind speed per line (last numeric field wins, so CSV with timestamps/headers works); negatives/NaN skipped
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const f = line.split(/[,;\t ]+/).filter(x => x !== '');
    for (let i = f.length - 1; i >= 0; i--) { const v = +f[i]; if (f[i] !== '' && isFinite(v)) { if (v >= 0) out.push(v); break; } }
  }
  return out;
}
function windSeriesPdf(vals, dv = 0.5, vmax = 25) { // histogram density (1/(m/s)) with bins centred on dv, 2dv, ... vmax; matches the AEP loops
  const nb = Math.round(vmax / dv), pdf = new Array(nb).fill(0);
  let sum = 0;
  for (const v of vals) { sum += v; const i = Math.round(v / dv) - 1; if (i >= 0 && i < nb) pdf[i]++; else if (v > vmax) { /* counted in n only */ } }
  const n = vals.length;
  return { n, mean: n ? sum / n : 0, dv, pdf: pdf.map(c => n ? c / (n * dv) : 0) };
}
function windDensity(v, dv = 0.5) { // measured-series density when imported, else Weibull(Vavg, k)
  const ws = S.perf.series;
  if (!ws) return weibullPdf(v, S.perf.Vavg, S.perf.k || 2);
  const i = Math.round(v / ws.dv) - 1; return i >= 0 && i < ws.pdf.length ? ws.pdf[i] : 0;
}
function capacityFactor(aepKWh, ratedW) { return ratedW > 0 ? aepKWh / (ratedW * 8760 / 1000) : 0; }
// 方案快照儲存當下的發電機額定功率;舊方案無此欄位則沿用目前設定
function snapRated(m) { return m && m.Pmax > 0 ? m.Pmax : S.load.Pmax; }
/* Ideal-MPPT annual energy (kWh): Cp,max tracking over windDensity(v) (0.5 m/s bins to 25 m/s), electrical output capped at ratedW (ratedW <= 0: no cap). */
function idealAEP(m, ratedW) {
  const { rho } = air(), eta = 0.92 * S.load.eta; let e = 0;
  for (let v = 0.5; v <= 25.001; v += 0.5) {
    let P = 0.5 * rho * m.A * v ** 3 * m.cpMax * eta;
    if (ratedW > 0) P = Math.min(P, ratedW);
    e += P * windDensity(v) * 0.5 * 8760 / 1000;
  }
  return e;
}

/* Tip-speed noise estimate (HAWT), after the Hau/Wagner empirical law Lw = 50 log10(Vtip) + 10 log10(D) - 4 dB(A).
   Far field: hemispherical spreading Lp = Lw - 10 log10(2 pi r^2) minus air absorption (~0.005 dB/m). Rough, +-5 dB. */
function noiseEstimate(vTip, D, dist = 50) {
  const Lw = 50 * Math.log10(Math.max(vTip, 1)) + 10 * Math.log10(Math.max(D, 0.1)) - 4;
  const Lp = Lw - 10 * Math.log10(2 * Math.PI * dist * dist) - 0.005 * dist;
  return { Lw, Lp, dist };
}

/* Turbulent-boundary-layer trailing-edge (TBL-TE) self noise, after the Brooks-Pope-Marcolini (BPM, NASA RP-1218) displacement-
   thickness correlation form and the peak level SPL = 10log10(d* M^5 L Dh / r^2) + K1 - 3, summed over the suction and
   pressure sides, elements and blades with incoherent (energy) addition. The spectral shape is not resolved: a +5 dB term
   stands for the one-third-octave band sum. Observer fixed at `dist` in the rotor plane, Dh = 1, no Doppler/azimuth, unweighted.
   Use for relative comparison between designs; absolute level is +-5 dB or worse. */
function tbleNoise(rows, elems, B, rho, mu, dist = 50, dstarFn = null) {
  const c0 = 340;
  const dStar = (Rc, a) => { // returns [suction, pressure] displacement thickness / chord
    const lg = Math.log10(Math.max(Rc, 1e4)), d0 = Math.pow(10, 3.411 - 1.5397 * lg + 0.1059 * lg * lg);
    const aa = Math.min(Math.abs(a), 20);
    const s = aa <= 7.5 ? Math.pow(10, 0.0679 * aa) : aa <= 12.5 ? 0.0162 * Math.pow(10, 0.3066 * aa) : 52.42 * Math.pow(10, 0.0258 * aa);
    const ap = Math.min(aa, 5), p = Math.pow(10, -0.0432 * ap + 0.00113 * ap * ap);
    return [d0 * s, d0 * p];
  };
  let sum = 0;
  elems.forEach((el, i) => {
    const x = rows[i], M = el.W / c0, Rc = rho * el.W * x.c / mu, [ds, dp] = (dstarFn && dstarFn(i, Rc, el.alpha)) || dStar(Rc, el.alpha);
    const K = 125.5 + 5; // K1(Rc>8e5) - 3 + band-sum
    for (const d of [ds, dp]) sum += Math.pow(10, 0.1 * (10 * Math.log10(d * x.c * Math.pow(M, 5) * x.dr / (dist * dist)) + K));
  });
  const Lp = 10 * Math.log10(Math.max(sum * B, 1e-30));
  return { Lp, dist };
}

/* Displacement-thickness provider for tbleNoise/tbleSpectrum from the integral boundary layer (Thwaites + Michel + Head) on
   the panel solution of each section's airfoil: returns (i, Rc, alphaDeg) -> [suction, pressure] delta* per chord, or null if the
   result is not finite (caller then falls back to the BPM empirical form). Positive alpha: upper surface is the suction side.
   Potential-flow TE, turbulent-only march, no wake: gives a cheaper but physically derived alternative to the BPM correlation. */
const blSolveCache = new WeakMap();
function blDstarFn(afs) {
  return (i, Rc, alphaDeg) => {
    const af = afs[i]; if (!af) return null;
    let solve = blSolveCache.get(af); if (!solve) { solve = A.panel(af); blSolveCache.set(af, solve); }
    const bl = A.boundaryLayer(solve(alphaDeg * A.D2R), Math.max(Rc, 1e4));
    const [suc, prs] = alphaDeg >= 0 ? [bl.upper, bl.lower] : [bl.lower, bl.upper];
    return Number.isFinite(suc.dStar) && Number.isFinite(prs.dStar) && suc.dStar > 0 && prs.dStar > 0 ? [suc.dStar, prs.dStar] : null;
  };
}

/* TBL-TE self-noise 1/3-octave spectrum with BPM A-function shape (NASA RP-1218 eqs. 35-38) and A-weighting (IEC 61672).
   Same geometry/assumptions as tbleNoise: observer at `dist` in the rotor plane, no Doppler/azimuth, K1 simplified to the
   Rc > 8e5 value, no high-angle (SPL_alpha) term. Strouhal St = f d* / W; pressure side peaks at St1 = 0.02 M^-0.6,
   suction side at (St1 + St2)/2 with the angle shift St2. Returns {bands:[{f, L, LA}], Lp (unweighted), LA (dB(A)), dist}. */
function tbleSpectrum(rows, elems, B, rho, mu, dist = 50, dstarFn = null) {
  const c0 = 340, K = 125.5;
  const aMin = a => a < 0.204 ? Math.sqrt(67.552 - 886.788 * a * a) - 8.219 : a <= 0.244 ? -32.665 * a + 3.981 : -142.795 * a ** 3 + 103.656 * a * a - 57.757 * a + 6.006;
  const aMax = a => a < 0.13 ? Math.sqrt(67.552 - 886.788 * a * a) - 8.219 : a <= 0.321 ? -15.901 * a + 1.098 : -4.669 * a ** 3 + 3.491 * a * a - 16.699 * a + 1.149;
  const a0f = Rc => Rc < 9.52e4 ? 0.57 : Rc < 8.57e5 ? -9.57e-13 * (Rc - 8.57e5) ** 2 + 1.13 : 1.13;
  const Afun = (a, Rc) => {
    const a0 = a0f(Rc), lo = aMin(a0), hi = aMax(a0), AR = (-20 - lo) / (hi - lo);
    return aMin(a) + AR * (aMax(a) - aMin(a));
  };
  const aw = f => { const f2 = f * f; return 20 * Math.log10(12194 ** 2 * f2 * f2 / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2))) + 2.0; };
  const fc = []; for (let k = 0; k <= 20; k++) fc.push(100 * Math.pow(10, k / 10));
  const pw = new Array(fc.length).fill(0);
  elems.forEach((el, i) => {
    const x = rows[i], M = el.W / c0, Rc = rho * el.W * x.c / mu;
    const lg = Math.log10(Math.max(Rc, 1e4)), d0 = Math.pow(10, 3.411 - 1.5397 * lg + 0.1059 * lg * lg);
    const aa = Math.min(Math.abs(el.alpha), 20);
    let ds = d0 * (aa <= 7.5 ? Math.pow(10, 0.0679 * aa) : aa <= 12.5 ? 0.0162 * Math.pow(10, 0.3066 * aa) : 52.42 * Math.pow(10, 0.0258 * aa));
    const ap = Math.min(aa, 5); let dp = d0 * Math.pow(10, -0.0432 * ap + 0.00113 * ap * ap);
    const bl = dstarFn && dstarFn(i, Rc, el.alpha); if (bl) [ds, dp] = bl;
    const St1 = 0.02 * Math.pow(Math.max(M, 1e-3), -0.6), St2 = St1 * (aa < 1.33 ? 1 : aa <= 12.5 ? Math.pow(10, 0.0054 * (aa - 1.33) ** 2) : 4.72);
    // high-angle term SPL_alpha (BPM eq. 44-47), suction side only, peak at St2
    const gam = 27.094 * M + 3.31, gam0 = 23.43 * M + 4.651, bet = 72.65 * M + 10.74, bet0 = -34.19 * M - 13.82;
    const K2 = aa < gam0 - gam ? -1000 : aa <= gam0 + gam ? Math.sqrt(Math.max(bet * bet - (bet / gam) ** 2 * (aa - gam0) ** 2, 0)) + bet0 : -12;
    const Bfun = b => { const a = Math.abs(Math.log10(b)); return a < 0.13 ? Math.sqrt(16.888 - 886.788 * a * a) - 4.109 : a <= 0.145 ? -83.607 * a + 8.138 : -817.81 * a ** 3 + 355.21 * a * a - 135.024 * a + 10.619; };
    const dsC = ds * x.c, baseA = 10 * Math.log10(dsC * Math.pow(M, 5) * x.dr / (dist * dist)) + K2 + 125.5 - 3;
    if (K2 > -500) fc.forEach((f, j) => { pw[j] += Math.pow(10, 0.1 * (baseA + Bfun((f * dsC / el.W) / St2))); });
    const sides = [[ds * x.c, St1, (St1 + St2) / 2], [dp * x.c, St1, St1]];
    for (const [d, , stPk] of sides) {
      const base = 10 * Math.log10(d * Math.pow(M, 5) * x.dr / (dist * dist)) + K;
      fc.forEach((f, j) => {
        const a = Math.abs(Math.log10((f * d / el.W) / stPk));
        pw[j] += Math.pow(10, 0.1 * (base + Afun(a, Rc)));
      });
    }
  });
  const bands = fc.map((f, j) => { const L = 10 * Math.log10(Math.max(pw[j] * B, 1e-30)); return { f, L, LA: L + aw(f) }; });
  const sumDb = k => 10 * Math.log10(Math.max(bands.reduce((s, b) => s + Math.pow(10, 0.1 * b[k]), 0), 1e-30));
  return { bands, Lp: sumDb('L'), LA: sumDb('LA'), dist };
}

/* Rough cost / LCOE estimate (NT$). Capex = blades (mass x material price) + generator/electronics (per rated W)
   + tower/foundation (per swept m2); LCOE = (capex x FCR + annual O&M) / AEP. Conceptual unit prices only. */
const COST_DEFAULT = { gen: 30, tower: 3000, fcr: 0.08, om: 0.03, life: 20 };
// p defaults to the user's overrides in S.perf.cost; p.matCost (NT$/kg) replaces the material table price when finite and > 0.
function costEstimate(massKg, matKey, ratedW, sweptA, aepKWh, p = S.perf.cost) {
  const c = { ...COST_DEFAULT, ...p }, mat = MATERIALS[matKey] || MATERIALS.gfrp;
  const blades = massKg * (p && p.matCost > 0 ? p.matCost : mat.cost), gen = ratedW * c.gen, tower = sweptA * c.tower, capex = blades + gen + tower;
  const annual = capex * c.fcr + capex * c.om;
  return { blades, gen, tower, capex, annual, fcr: c.fcr, om: c.om, lcoe: aepKWh > 0 ? annual / aepKWh : Infinity, life: c.life };
}

/* ---------- air properties ---------- */
function air() {
  const T = S.tun.T + 273.15, p = 101325 * Math.pow(1 - 2.25577e-5 * S.tun.alt, 5.25588);
  const rho = p / (287.05 * T);
  const mu = 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4);
  return { rho, mu };
}

/* ---------- airfoil library ---------- */
const AF_LIB = [
  { g: 'NACA 4 位數(對稱)', k: ['0006', '0009', '0012', '0015', '0018', '0021', '0024'].map(c => 'n4:' + c) },
  { g: 'NACA 4 位數(有彎度)', k: ['2412', '2415', '2418', '2421', '4412', '4415', '4418', '4421', '6409', '6412'].map(c => 'n4:' + c) },
  { g: 'NACA 5 位數', k: ['23012', '23015', '23018', '23021', '23024'].map(c => 'n5:' + c) },
  { g: '圓弧彎板', k: ['arc:5', 'arc:8', 'arc:10'] }
];
const afCache = new Map(), modelCache = new Map(), psCache = new Map();
function afLabel(key) {
  if (key.startsWith('imp:')) { const it = S.af.imported[+key.slice(4)]; return it ? it.af.name : '(已移除)'; }
  const [k, v] = key.split(':');
  if (k === 'arc') return '圓弧彎板 ' + v + '%';
  return 'NACA ' + v;
}
function getAf(key) {
  if (afCache.has(key)) return afCache.get(key);
  let af;
  const [k, v] = key.split(':');
  if (k === 'n4') af = A.naca4(v);
  else if (k === 'n5') af = A.naca5(v);
  else if (k === 'arc') af = A.circularArc(+v, 2);
  else if (k === 'imp') af = S.af.imported[+v].af;
  else af = A.naca4('0012');
  afCache.set(key, af);
  return af;
}
function getModel(key) {
  const mk = key + '|' + S.af.cdMax;
  if (!modelCache.has(mk)) modelCache.set(mk, A.buildAeroModel(getAf(key), { cdMax: S.af.cdMax }));
  return modelCache.get(mk);
}
function getPS(key) {
  const imp = S.af.polarImp[key];
  const pk = key + '|' + S.af.cdMax + '|' + (imp ? imp.length + imp.slice(0, 40) : '');
  if (psCache.has(pk)) return psCache.get(pk);
  let ps;
  if (imp) { try { ps = A.parsePolarText(imp, S.af.cdMax); } catch (e) { ps = A.buildPolarSet(getModel(key)); } }
  else ps = A.buildPolarSet(getModel(key));
  psCache.set(pk, ps);
  return ps;
}
function blendPS(p1, p2, w) {
  if (w <= 0.001 || p1 === p2) return p1;
  if (w >= 0.999) return p2;
  const REs = p1.REs.length > 1 ? p1.REs : p2.REs;
  const tables = REs.map((Re, j) => {
    const t1 = p1.tables.length === 1 ? p1.tables[0] : p1.tables[j], t2 = p2.tables.length === 1 ? p2.tables[0] : p2.tables[j];
    const CL = new Float64Array(721), CD = new Float64Array(721);
    for (let i = 0; i < 721; i++) { CL[i] = t1.CL[i] * (1 - w) + t2.CL[i] * w; CD[i] = t1.CD[i] * (1 - w) + t2.CD[i] * w; }
    return { Re, al: t1.al, CL, CD };
  });
  return { REs, tables };
}

/* ---------- geometry + performance ---------- */
const G = { rows: [], afs: [], pss: [], mass: 0, J: 1, A: 1, R: 1, perf: null, yawCurves: {}, vcfg: null, gen: 0, loads: null };
const DLAM = 0.25;

/* ---------- spanwise airfoil stations ---------- */
function stSorted() { return S.af.st.map((s, i) => ({ f: A.clamp(+s.f || 0, 0, 1), k: s.k, i })).sort((a, b) => a.f - b.f); }
function afBlendAt(x) { // piecewise-linear blend of shape and polar between neighbouring stations
  const st = stSorted();
  const one = s => ({ af: getAf(s.k), ps: getPS(s.k), w: s.i, lab: afLabel(s.k) });
  if (st.length === 1 || x <= st[0].f) return one(st[0]);
  if (x >= st[st.length - 1].f) return one(st[st.length - 1]);
  let j = 0; while (j < st.length - 2 && x > st[j + 1].f) j++;
  const a = st[j], b = st[j + 1], w = b.f - a.f < 1e-6 ? 1 : (x - a.f) / (b.f - a.f);
  if (a.k === b.k) return one(a);
  return { af: A.blendAirfoil(getAf(a.k), getAf(b.k), w), ps: blendPS(getPS(a.k), getPS(b.k), w), w: a.i + w * (b.i - a.i) };
}
function viewKey() {
  if (S.mode !== 'HAWT') return S.af.vawt;
  const i = A.clamp(Math.round(+S.af.view) || 0, 0, S.af.st.length - 1);
  return S.af.st[i].k;
}
function designHAWT() {
  const h = S.hawt, R = h.R, Rh = Math.min(h.Rhub, 0.45 * R), { rho, mu } = air();
  const n = Math.round(h.nSec);
  const rows = [], afs = [], pss = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n;
    const u = 0.55 * s + 0.45 * (1 - Math.cos(Math.PI * s)) / 2;
    const r = Rh + (R - Rh) * u;
    const b = afBlendAt(r / R);
    afs.push(b.af); pss.push(b.ps);
    rows.push({ r, w: b.w });
  }
  for (let i = 0; i < n; i++) {
    const rl = i === 0 ? Rh : (rows[i - 1].r + rows[i].r) / 2;
    const rhh = i === n - 1 ? R : (rows[i + 1].r + rows[i].r) / 2;
    rows[i].dr = rhh - rl;
  }
  for (let i = 0; i < n; i++) {
    const e = rows[i], lr = h.tsr * e.r / R;
    const phi = 2 / 3 * Math.atan(1 / lr);
    let c = 0.08 * R, aD = h.aDes, clD = 1;
    for (let it = 0; it < 3; it++) {
      const W = h.Vd * Math.hypot(2 / 3, lr);
      const Re = rho * W * c / mu;
      if (h.aMode === 'auto') { const b = A.bestLD(pss[i], Re, [-2, 14]); aD = b.a; clD = b.cl; }
      else clD = A.lookup(pss[i], aD * A.D2R, Re)[0];
      clD = Math.max(0.2, clD);
      c = 16 * Math.PI * e.r / (h.B * clD) * Math.sin(phi / 2) ** 2;
    }
    e.c = c; e.tw = phi * A.R2D - aD; e.aD = aD; e.clD = clD;
  }
  if (h.linearize) {
    const pick = f => rows.reduce((b, x) => Math.abs(x.r / R - f) < Math.abs(b.r / R - f) ? x : b);
    const P1 = pick(0.35), P2 = pick(0.85);
    const lin = (x, k) => P1[k] + (P2[k] - P1[k]) * (x.r - P1.r) / (P2.r - P1.r);
    const L = rows.map(x => ({ c: lin(x, 'c'), tw: lin(x, 'tw') }));
    rows.forEach((x, i) => { x.c = L[i].c; x.tw = L[i].tw; });
  }
  rows.forEach((x, i) => {
    x.c = Math.max(0.015 * R, Math.min(x.c * h.chordScale, h.maxChord * R));
    const ov = h.ov[i]; if (ov && ov.c != null) { x.c = ov.c; x.ovr = true; }
  });
  const bemCfg = { R, Rhub: Rh, B: Math.round(h.B), rows, rho, mu, polarFor: i => pss[i] };
  const omD = h.tsr * h.Vd / R;
  if (h.twMode === 'bem') {
    // BEM annuli are independent, so maximise each section's torque contribution over its twist
    // (parallel golden-section search, one BEM call evaluates every section at its own trial twist)
    const base = rows.map(x => x.tw), lo = base.map(t => t - 10), hi = base.map(t => t + 10), gr = (Math.sqrt(5) - 1) / 2;
    const evalAt = tws => { rows.forEach((x, i) => { x.tw = tws[i]; }); const res = A.bemPoint(bemCfg, h.Vd, omD, 0, 0, null);
      return res.elems.map((el, i) => { const p = el.phi * A.D2R; return el.W * el.W * rows[i].c * (el.cl * Math.sin(p) - el.cd * Math.cos(p)); }); };
    let a = lo.slice(), b = hi.slice();
    for (let it = 0; it < 24; it++) {
      const c = a.map((v, i) => b[i] - gr * (b[i] - v)), d = a.map((v, i) => v + gr * (b[i] - v));
      const fc = evalAt(c), fd = evalAt(d);
      for (let i = 0; i < n; i++) { if (fc[i] > fd[i]) b[i] = d[i]; else a[i] = c[i]; }
    }
    rows.forEach((x, i) => { x.tw = (a[i] + b[i]) / 2; });
    if (h.linearize) {
      const pick = f => rows.reduce((b, x) => Math.abs(x.r / R - f) < Math.abs(b.r / R - f) ? x : b);
      const P1 = pick(0.35), P2 = pick(0.85), k = (P2.tw - P1.tw) / (P2.r - P1.r);
      rows.forEach(x => { x.tw = P1.tw + k * (x.r - P1.r); });
    }
  } else if (h.twMode === 'linear') {
    rows.forEach(x => { const u = (x.r - Rh) / (R - Rh); x.tw = h.twRoot + (h.twTip - h.twRoot) * u; });
  }
  const tipTw = rows[n - 1].tw;
  rows.forEach((x, i) => {
    if (h.twMode !== 'linear') x.tw = tipTw + (x.tw - tipTw) * h.twistScale;
    const ov = h.ov[i]; if (ov && ov.tw != null) { x.tw = ov.tw; x.ovr = true; }
  });
  // actual angle of attack at the design point (for display / comparison)
  const resD = A.bemPoint(bemCfg, h.Vd, omD, 0, 0, null);
  resD.elems.forEach((el, i) => { rows[i].aAct = el.alpha; if (h.twMode !== 'opt') rows[i].aD = el.alpha; });
  G.cpDesign = resD.Cp; G.desElems = resD.elems; G.ctDesign = resD.Ct;
  // mass & inertia
  const mat = MATERIALS[h.material];
  let m = 0, J = 0;
  rows.forEach((x, i) => { x.dm = mat.rho * mat.fill * A.airfoilArea(afs[i]) * x.c * x.c * x.dr; m += x.dm; J += x.dm * x.r * x.r; });
  const mb = m;
  m *= h.B; J *= h.B;
  const mh = 0.35 * m + 0.5; J += 0.5 * mh * Rh * Rh;
  J *= 1.12; // generator rotor share
  Object.assign(G, { rows, afs, pss, bladeMass: mb, mass: m, J: Math.max(J, 1e-3), A: Math.PI * R * R, R, Rhub: Rh });
  bladeLoads(rows, afs, resD.elems, omD, rho, mat);
}
// One-blade spanwise loads at the design point (steady, no gravity/gust): flapwise (out-of-plane,
// thrust-like) and edgewise (in-plane, torque-like) distributed aero force from the BEM design
// solution, summed outboard-to-root into bending moments (see AERO.cumulativeMoment), plus the
// centrifugal axial force from each station's own blade mass (from the mass/inertia loop above)
// spinning at the design rotor speed. Root values (index 0) are the root bending moments / axial
// force used for a first structural check; per-row values are exposed for a spanwise plot.
// Stress/deflection: each station's shell wall thickness is backed out (GEO.equivalentThickness)
// so its sectionProperties area matches the mass model's own `fill*airfoilArea*c^2`, rather than
// adding a separate user-facing thickness field. Bending stress uses the extreme-fibre distance
// (yMax/xMax) for the flapwise/edgewise moment; centrifugal stress is axial force / area; the
// three are conservatively summed (no phase alignment) into a single combined stress and safety
// factor (mat.allow / stress). Flapwise deflection integrates curvature Mflap/(mat.E*Ixx) from the
// fixed root outward (GEO.beamDeflection, Euler-Bernoulli).
// IEC 61400-2 Class II small-turbine reference wind (Vref) and 50-year extreme gust (1.4 Vref).
const EXTREME = { Vref: 42.5, Ve50: 1.4 * 42.5, Cn: 1.2 };
function bladeLoads(rows, afs, elems, omega, rho, mat) {
  const r = rows.map(x => x.r);
  const dFz = rows.map((x, i) => { const el = elems[i], phi = el.phi * A.D2R, q = 0.5 * rho * el.W * el.W * x.c * x.dr;
    return q * (el.cl * Math.cos(phi) + el.cd * Math.sin(phi)); });
  const dFy = rows.map((x, i) => { const el = elems[i], phi = el.phi * A.D2R, q = 0.5 * rho * el.W * el.W * x.c * x.dr;
    return q * (el.cl * Math.sin(phi) - el.cd * Math.cos(phi)); });
  const Mflap = A.cumulativeMoment(r, dFz), Medge = A.cumulativeMoment(r, dFy);
  const Fax = A.cumulativeOutboard(r, rows.map(x => x.dm * omega * omega * x.r));
  const sec = rows.map((x, i) => {
    const targetArea = mat.fill * A.airfoilArea(afs[i]) * x.c * x.c;
    const t = GEO.equivalentThickness(afs[i], x.c, targetArea);
    return GEO.sectionProperties(afs[i], x.c, t);
  });
  const defl = GEO.beamDeflection(rows, Mflap, sec.map(s => mat.E * Math.max(s.Ixx, 1e-12)));
  const stress = rows.map((x, i) => {
    const s = sec[i];
    const sFlap = s.Ixx > 0 ? Mflap[i] * s.yMax / s.Ixx : 0, sEdge = s.Iyy > 0 ? Medge[i] * s.xMax / s.Iyy : 0;
    const sAxial = s.area > 0 ? Fax[i] / s.area : 0;
    return Math.abs(sFlap) + Math.abs(sEdge) + sAxial;
  });
  rows.forEach((x, i) => {
    x.dFz = dFz[i]; x.dFy = dFy[i]; x.Mflap = Mflap[i]; x.Medge = Medge[i]; x.Fax = Fax[i];
    x.secArea = sec[i].area; x.Ixx = sec[i].Ixx; x.Iyy = sec[i].Iyy;
    x.defl = defl[i]; x.stress = stress[i]; x.safety = stress[i] > 0 ? mat.allow / stress[i] : Infinity;
  });
  const minSafety = Math.min(...rows.map(x => x.safety));
  // Extreme case: parked (omega = 0, so no centrifugal load) in the 50-year extreme gust Ve50 =
  // 1.4 Vref (IEC 61400-2 small turbines, Class II Vref 42.5 m/s). The blade is assumed fully
  // stalled/flat to the wind, so each station takes a normal force 0.5 rho Ve^2 c dr Cn (Cn
  // flat-plate-like, conservative); azimuth and yaw are unknown, so flapwise bending only.
  const Fext = rows.map(x => 0.5 * rho * EXTREME.Ve50 * EXTREME.Ve50 * x.c * x.dr * EXTREME.Cn);
  const Mext = A.cumulativeMoment(r, Fext);
  const sExt = rows.map((x, i) => sec[i].Ixx > 0 ? Mext[i] * sec[i].yMax / sec[i].Ixx : 0);
  const dExt = GEO.beamDeflection(rows, Mext, sec.map(s => mat.E * Math.max(s.Ixx, 1e-12)));
  rows.forEach((x, i) => { x.MflapExt = Mext[i]; x.stressExt = sExt[i]; x.safetyExt = sExt[i] > 0 ? mat.allow / sExt[i] : Infinity; });
  // Root stress components at the design point, used to rebuild a stress history from the
  // simulation (rootStress). Gravity bends the blade edgewise once per revolution (1P).
  const s0 = sec[0], gMoment = rows.reduce((t, x) => t + x.dm * 9.81 * (x.r - rows[0].r), 0);
  const root = {
    sFlap: s0.Ixx > 0 ? Mflap[0] * s0.yMax / s0.Ixx : 0, sEdge: s0.Iyy > 0 ? Medge[0] * s0.xMax / s0.Iyy : 0,
    sAx: s0.area > 0 ? Fax[0] / s0.area : 0, sGrav: s0.Iyy > 0 ? gMoment * s0.xMax / s0.Iyy : 0,
  };
  G.loads = {
    omega, root, MflapRoot: Mflap[0], MedgeRoot: Medge[0], FaxRoot: Fax[0],
    tipDefl: defl[defl.length - 1], minSafety,
    extreme: { Ve50: EXTREME.Ve50, MflapRoot: Mext[0], tipDefl: dExt[dExt.length - 1], minSafety: Math.min(...rows.map(x => x.safetyExt)) },
  };
}
// Instantaneous blade-root stress (Pa) of blade 1 from the simulation state, HAWT only: design-point
// flapwise/edgewise/centrifugal stresses scaled by the current thrust T = 0.5 rho A V^2 Ct(lambda),
// aero torque and omega^2, plus the 1P gravity edgewise term. Quasi-static (no blade dynamics).
function rootStress() {
  const L = G.loads, o = SIM.out;
  if (S.mode !== 'HAWT' || !L || !L.root || !o) return null;
  const { rho } = air(), q = 0.5 * rho * G.A, Vd = S.hawt.Vd;
  const Td = q * Vd * Vd * G.ctDesign, Qd = q * G.R * Vd * Vd * G.cpDesign / S.hawt.tsr;
  const T = q * o.V * o.V * Math.max(0, interpCurve(G.perf, 'ct', Math.max(0, o.lam)));
  const w = L.omega > 0 ? SIM.omega / L.omega : 0;
  return L.root.sFlap * (Td > 0 ? T / Td : 0) + L.root.sEdge * (Qd > 0 ? o.Ta / Qd : 0) + L.root.sAx * w * w + L.root.sGrav * Math.sin(SIM.theta);
}
// Rainflow + Miner fatigue estimate of a root stress history `sig` (Pa) sampled over `dur` seconds.
// lifeYears assumes the simulated condition repeats continuously (conservative for a site average).
function fatigueEstimate(sig, dur, matKey = S.hawt.material) {
  const mat = MATERIALS[matKey], cycles = GEO.rainflow(sig);
  const D = GEO.minerDamage(cycles, mat.su, mat.m);
  let sMax = -Infinity, sMin = Infinity; for (const v of sig) { if (v > sMax) sMax = v; if (v < sMin) sMin = v; }
  return {
    n: cycles.reduce((t, c) => t + c.count, 0), D, sMax, sMin, dur,
    lifeYears: D > 0 ? dur / D / 31557600 : Infinity,
    delRange: GEO.equivalentRange(cycles, mat.m, dur), // 1 Hz damage-equivalent stress range
    maxRange: cycles.reduce((t, c) => Math.max(t, c.range), 0), su: mat.su, m: mat.m,
  };
}
function vawtCfg() {
  const v = S.vawt, { rho, mu } = air();
  return { type: v.type, R: v.R, H: v.H, B: Math.round(v.B), c: v.c, pitch: v.pitch, helix: v.helix, nz: 10, polar: getPS(S.af.vawt), rho, mu, struts: v.struts, dynStall: !!v.dynStall, curvature: !!v.curvature, overlap: v.overlap, endPlates: v.endPlates };
}
function designVAWT() {
  const v = S.vawt, cfg = vawtCfg(), mat = MATERIALS[v.material];
  G.vcfg = cfg; G.R = v.R; G.loads = null; // spanwise structural loads: HAWT only for now (see ROADMAP 3)
  if (v.type === 'sav') {
    G.A = 2 * v.R * v.H;
    const d = 2 * v.R / (2 - v.overlap), t = Math.max(0.0015, 0.004 * v.R);
    const m = cfg.B * Math.PI * d / 2 * v.H * t * mat.rho * Math.min(1, mat.fill * 2) + (v.endPlates ? 2 * Math.PI * v.R * v.R * t * mat.rho : 0);
    G.mass = m; G.bladeMass = m / cfg.B; G.J = 0.5 * m * v.R * v.R * 1.1 + 0.02;
    return;
  }
  G.A = A.vawtArea(cfg);
  const af = getAf(S.af.vawt), sl = A.vawtSlices(cfg);
  let m = 0, J = 0;
  for (const s of sl) { const L = s.dz / Math.cos(s.delta), dm = mat.rho * mat.fill * A.airfoilArea(af) * v.c * v.c * L; m += dm; J += dm * s.r * s.r; }
  G.bladeMass = m; m *= cfg.B; J *= cfg.B;
  if (v.type === 'H' || v.type === 'helical') { const ms = cfg.B * v.struts * 0.6 * mat.rho * mat.fill * 0.12 * (0.6 * v.c) ** 2 * v.R; m += ms; J += ms * v.R * v.R / 3; }
  G.mass = m; G.J = Math.max(1e-3, J * 1.1 + 0.01);
}
function curveArrays(pts) {
  return { lam: pts.map(p => p.l), cp: pts.map(p => p.Cp), ct: pts.map(p => p.Ct), cq: pts.map(p => p.Cq), tot: pts.map(p => p.tot), qAz: pts.map(p => p.qAz), alAz: pts.map(p => p.alAz), rel: pts[0].rel };
}
function hawtCfg() {
  const { rho, mu } = air();
  return { R: S.hawt.R, Rhub: G.Rhub, B: Math.round(S.hawt.B), rows: G.rows, rho, mu, polarFor: i => G.pss[i] };
}
function hawtCurveStep(cfg, V, yawDeg, pitch, lmax, step) {
  const pts = [], st = {};
  const r0 = A.bemPoint(cfg, V, 0.03 * V / cfg.R, yawDeg * A.D2R, pitch, {});
  pts.push({ l: 0, Cp: 0, Ct: r0.Ct, Cq: r0.Cp / 0.03 });
  for (let l = step; l <= lmax + 1e-9; l += step) {
    const r = A.bemPoint(cfg, V, l * V / cfg.R, yawDeg * A.D2R, pitch, st);
    pts.push({ l, Cp: r.Cp, Ct: r.Ct, Cq: r.Cp / l });
  }
  return pts;
}
function computePerf() {
  const V = Math.max(1, S.tun.V);
  G.gen++;
  G.Vref = V;
  if (S.mode === 'HAWT') {
    const cfg = hawtCfg();
    const lmax = Math.max(12, Math.ceil(S.hawt.tsr * 1.9));
    G.perf = curveArrays(hawtCurveStep(cfg, V, 0, S.hawt.pitch, lmax, DLAM));
    G.perf.step = DLAM;
    G.yawCurves = { 0: G.perf };
    scheduleYawBuckets(G.gen);
  } else if (S.vawt.type === 'sav') {
    G.perf = curveArrays(A.savoniusCurve({ B: Math.round(S.vawt.B), overlap: S.vawt.overlap, endPlates: S.vawt.endPlates }));
    G.perf.step = 0.05;
  } else {
    const cfg = G.vcfg;
    G.perf = curveArrays(A.vawtCurve(cfg, V, 7));
    G.perf.step = DLAM;
    const { rho } = air(), q = 0.5 * rho * G.A * G.R * V * V;
    G.perf.cqAz = G.perf.tot.map(t => Array.from(t, x => x / q));
  }
  if (G.perf.rel) G.perf.cqAz = G.perf.tot.map((t, i) => Array.from(t, x => x * G.perf.cq[i]));
  let bi = 1;
  for (let i = 1; i < G.perf.cp.length; i++) if (G.perf.cp[i] > G.perf.cp[bi]) bi = i;
  G.cpMax = G.perf.cp[bi]; G.lopt = G.perf.lam[bi];
  const { rho } = air();
  G.kopt = 0.5 * rho * G.A * G.R ** 3 * G.cpMax / G.lopt ** 3;
}
// Active-pitch regulation above rated (offline analysis; the time-domain sim still uses the soft-stall speed cap).
// For each wind speed, holds the rotor at rated speed and finds the smallest blade pitch (deg, toward feather)
// that brings aerodynamic power down to the generator limit. Returns { V[], pitch[], Pa[], Cp[], sat[] };
// sat[i] is true when even pMax cannot shed enough power.
function pitchRegulation(vList, opts = {}) {
  const { rho } = air(), cfg = hawtCfg(), w = opts.omega || G.wRated;
  const target = opts.target || S.load.Pmax / S.load.eta, pMax = opts.pMax || 40;
  const out = { V: [], pitch: [], Pa: [], Cp: [], sat: [] };
  for (const V of vList) {
    const q = 0.5 * rho * G.A * V ** 3;
    const pa = p => q * A.bemPoint(cfg, V, w, 0, S.hawt.pitch + p, {}).Cp;
    let p = 0, sat = false;
    if (pa(0) > target) {
      if (pa(pMax) > target) { p = pMax; sat = true; }
      else { let a = 0, b = pMax; for (let it = 0; it < 24; it++) { const m = (a + b) / 2; if (pa(m) > target) a = m; else b = m; } p = (a + b) / 2; }
    }
    const P = pa(p);
    out.V.push(V); out.pitch.push(p); out.Pa.push(P); out.Cp.push(P / q); out.sat.push(sat);
  }
  return out;
}
// Cp(λ,β) lookup for the time-domain pitch controller: Cq-vs-λ curves at fixed feather angles, cached per design generation.
const PITCH_MAX = 40, PITCH_STEP = 5;
function pitchTable() {
  if (G.ptab && G.ptab.gen === G.gen) return G.ptab;
  const cfg = hawtCfg(), lmax = G.perf.lam[G.perf.lam.length - 1], curves = [];
  for (let b = 0; b <= PITCH_MAX + 1e-9; b += PITCH_STEP) { const c = curveArrays(hawtCurveStep(cfg, G.Vref, 0, S.hawt.pitch + b, lmax, 0.5)); c.step = 0.5; curves.push(c); }
  return (G.ptab = { gen: G.gen, curves });
}
// torque-coefficient change caused by feathering the blades by beta (deg) at tip-speed ratio lam
function pitchDcq(lam, beta) {
  if (beta < 0.01) return 0;
  const T = pitchTable().curves, f = Math.min(beta, PITCH_MAX) / PITCH_STEP, i = Math.min(T.length - 2, Math.floor(f)), w = f - i;
  const d = k => interpCurve(T[k], 'cq', lam) - interpCurve(T[0], 'cq', lam);
  return d(i) * (1 - w) + d(i + 1) * w;
}
let yawTimer = null;
function scheduleYawBuckets(gen) {
  clearTimeout(yawTimer);
  const buckets = [15, 30, 45, 60, 75, 90];
  let k = 0;
  const cfg = hawtCfg(), V = G.Vref, lmax = G.perf.lam[G.perf.lam.length - 1];
  const next = () => {
    if (gen !== G.gen || k >= buckets.length) return;
    const b = buckets[k++];
    const pts = hawtCurveStep(cfg, V, b, S.hawt.pitch, lmax, 0.5);
    G.yawCurves[b] = curveArrays(pts); G.yawCurves[b].step = 0.5;
    yawTimer = setTimeout(next, 30);
  };
  yawTimer = setTimeout(next, 400);
}
function interpCurve(c, key, l) {
  const arr = c[key], st = c.step, n = arr.length;
  if (l <= 0) return arr[0];
  const f = l / st; const i = Math.floor(f);
  if (i >= n - 1) { // extrapolate linearly
    const s = arr[n - 1] - arr[n - 2]; return arr[n - 1] + s * (f - (n - 1));
  }
  const w = f - i; return arr[i] + w * (arr[i + 1] - arr[i]);
}
function cqAt(l, gammaDeg, az) {
  const P = G.perf;
  if (S.mode === 'HAWT') {
    let g = Math.min(90, Math.abs(gammaDeg));
    if (g < 0.5) return interpCurve(P, 'cq', l);
    const b0 = Math.floor(g / 15) * 15, b1 = Math.min(90, b0 + 15), w = (g - b0) / 15;
    const c0 = G.yawCurves[b0], c1 = G.yawCurves[b1];
    if (c0 && c1) return (1 - w) * interpCurve(c0, 'cq', l) + w * interpCurve(c1, 'cq', l);
    const cg = Math.cos(g * A.D2R); // cosine model fallback
    return cg < 0.02 ? 0 : interpCurve(P, 'cq', l / cg) * cg * cg;
  }
  // VAWT: 2D interpolation lam x azimuth
  const N2 = 2 * A.NTH, st = P.step, n = P.lam.length;
  let a = (((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * N2;
  const j = Math.floor(a) % N2, j2 = (j + 1) % N2, wa = a - Math.floor(a);
  const f = Math.max(0, l / st); let i = Math.min(n - 2, Math.floor(f)); const wl = f - i;
  const row = k => P.cqAz[k][j] * (1 - wa) + P.cqAz[k][j2] * wa;
  if (f > n - 1) { const s = row(n - 1) - row(n - 2); return row(n - 1) + s * (f - (n - 1)); }
  return row(i) * (1 - wl) + row(i + 1) * wl;
}

/* ---------- generator auto match ---------- */
function autoMatchGen() {
  const { rho } = air();
  const Vd = S.mode === 'HAWT' ? S.hawt.Vd : 8;
  const P = Math.max(5, 0.5 * rho * G.A * Vd ** 3 * G.cpMax), w = G.lopt * Vd / G.R;
  const Vb = P < 250 ? 12 : P < 1200 ? 24 : P < 5000 ? 48 : P < 30000 ? 96 : 400;
  const L = S.load;
  L.Vbat = Vb; L.ke = +(1.3 * Vb / w).toPrecision(3);
  const E = L.ke * w; L.Rs = +(0.05 * E * E / P).toPrecision(3);
  L.RL = +(Vb * Vb / P).toPrecision(3);
  L.wmaxRpm = Math.round(1.8 * w * 30 / Math.PI);
  L.Pmax = +(Math.pow(12 / Vd, 3) * P * 0.9).toPrecision(2); // generator rated at ~12 m/s
  L.poT = +A.clamp(0.25 * (G.J || 1) * w * w / P, 1, 5).toFixed(1); L.poStep = 0.03; // P&O period ~ 1/4 mechanical time constant
  G.Prated = P; G.wRated = w;
}

/* ---------- electrical model ---------- */
function electrical(omega, D, brake) {
  const L = S.load, E = L.ke * omega, Vd = L.Vdiode;
  let I = 0, Vin = 0, Rin = 0;
  if (brake) { I = Math.max(0, (E - Vd) / L.Rs); Vin = 0; }
  else if (L.kind === 'res') {
    Rin = L.RL * ((1 - D) / D) ** 2;
    I = Math.max(0, (E - Vd) / (L.Rs + Rin)); Vin = I * Rin;
  } else {
    Vin = L.Vbat * (1 - D) / D;
    I = Math.max(0, (E - Vd - Vin) / L.Rs); Rin = I > 0 ? Vin / I : Infinity;
  }
  const Tg = L.ke * I;
  const Pout = brake ? 0 : Vin * I * L.eta;
  return { E, I, Vin, Rin, Tg, Pout, Ploss: I * I * L.Rs + Vd * I };
}
function frictionT(omega) {
  const Tr = (G.Prated || 100) / (G.wRated || 20);
  return omega > 1e-4 ? 0.01 * Tr + 0.004 * Tr * omega / (G.wRated || 20) : 0;
}

/* ---------- simulation ---------- */
const SIM = { t: 0, omega: 0, theta: 0, yaw: 0, n: 0, gust: 0, gustT: -1, V: 8, Vmeas: 8, D: 0.5, brake: false, latch: false, cutout: false, pitch: 0, furlAng: 0,
  po: { acc: 0, cnt: 0, tim: 0, last: 0, dir: 1, wref: -1 }, out: {}, hist: { t: [], V: [], rpm: [], Pa: [], Po: [], D: [], lam: [], cp: [] }, histT: 0, traj: [] };
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// converter with inner current control: find the duty that gives generator current Iref (inverse of electrical())
function dutyForCurrent(omega, Iref) {
  const L = S.load, E = L.ke * omega, Vd = L.Vdiode;
  if (L.kind === 'res') {
    if (Iref <= 1e-6) return 0.03;
    const Rin = (E - Vd) / Iref - L.Rs; if (!(Rin > 0)) return 0.97;
    return A.clamp(1 / (1 + Math.sqrt(Rin / L.RL)), 0.03, 0.97);
  }
  const Vin = Iref <= 1e-6 ? (E - Vd) * 1.02 + 0.1 : E - Vd - Iref * L.Rs;
  if (!(Vin > 0)) return 0.97;
  return A.clamp(L.Vbat / (Vin + L.Vbat), 0.03, 0.97);
}
function powerLimitedI(omega, I) { // converter output-power limit 1.3 × rating
  const L = S.load, E = L.ke * omega - L.Vdiode; if (E <= 0) return I;
  // P = (E - I·Rs)·I·η ≤ 1.3 Pmax  → solve quadratic for I
  const Pl = 1.3 * L.Pmax / L.eta, disc = E * E - 4 * L.Rs * Pl;
  const Imax = disc > 0 ? (E - Math.sqrt(disc)) / (2 * L.Rs) : E / (2 * L.Rs);
  return Math.min(I, Imax);
}
function ratedCurrent() { return Math.max(1e-3, (G.Prated || 100) / Math.max(1e-3, S.load.ke * (G.wRated || 20))); }
// outer rotor-speed loop producing a current (torque) reference, with a disturbance observer:
// the aerodynamic torque is estimated from generator torque + J·dω/dt and fed forward
function speedLoop(wref, wr, dt) {
  const J = G.J || 1, Ir = ratedCurrent(), ke = S.load.ke, kw = SPD_KP;
  if (SIM.tEst == null) SIM.tEst = SIM.out && SIM.out.el ? SIM.out.el.Tg : 0;
  const e = SIM.omega - wref;
  SIM.Di = A.clamp((SIM.Di == null ? 0 : SIM.Di) + J * kw * kw / 4 * e * dt, -3 * Ir * ke, 3 * Ir * ke);
  const Tref = SIM.tEst + J * kw * e + SIM.Di;
  SIM.D = dutyForCurrent(SIM.omega, powerLimitedI(SIM.omega, A.clamp(Tref / ke, 0, 3.5 * Ir)));
}
let SPD_KP = 3, PO_WMIN = 0.5;
function simStep(dt) {
  if (!(dt > 0)) return;
  if (S.load.ctrl !== 'po') SIM.po.wref = -1;
  if (S.load.ctrl === 'manual') SIM.Di = null;
  if (!isFinite(SIM.n)) SIM.n = 0; if (!isFinite(SIM.omega)) SIM.omega = 0; if (!isFinite(SIM.D)) SIM.D = 0.5;
  const T = S.tun, L = S.load, { rho } = air();
  // wind
  const tau = 2.5;
  SIM.n += -SIM.n / tau * dt + Math.sqrt(2 * dt / tau) * gauss();
  if (SIM.gustT >= 0) { SIM.gustT += dt; const g = SIM.gustT; SIM.gust = g < 6 ? 0.45 * T.V * Math.sin(Math.PI * g / 6) ** 2 : 0; if (g >= 6) SIM.gustT = -1; }
  const V = Math.max(0, T.V * (1 + T.TI * SIM.n) + SIM.gust);
  SIM.V = V; SIM.Vmeas += (V - SIM.Vmeas) * Math.min(1, dt / 1.0);
  // yaw
  if (S.mode === 'HAWT') {
    if (T.yawMode === 'auto') {
      const err = A.wrapPi((T.dir - SIM.yaw) * A.D2R) * A.R2D;
      if (Math.abs(err) > 1.5) SIM.yaw += Math.sign(err) * Math.min(Math.abs(err), T.yawRate * dt);
    } else SIM.yaw = T.yawFixed;
  }
  // passive furling (simplified): above vFurl the nacelle turns out of the wind, reaching furlMax at vFurl + 6 m/s;
  // the 1 s mean wind drives the target, the angle is rate-limited (heavy tail vane) and adds to the yaw error
  if (S.mode === 'HAWT' && L.furl) {
    const tgt = L.furlMax * A.clamp((SIM.Vmeas - L.vFurl) / 6, 0, 1), d = tgt - SIM.furlAng, mv = L.furlRate * dt;
    SIM.furlAng += Math.abs(d) < mv ? d : Math.sign(d) * mv;
  } else SIM.furlAng = 0;
  const gam = S.mode === 'HAWT' ? A.wrapPi((T.dir - SIM.yaw) * A.D2R) * A.R2D + SIM.furlAng : 0;
  const Vs = Math.max(V, 0.05);
  const lam = SIM.omega * G.R / Vs;
  const az = SIM.theta + T.dir * A.D2R;
  const usePitch = L.pitchCtl && S.mode === 'HAWT';
  if (!usePitch) SIM.pitch = 0;
  const cq = V > 0.05 ? cqAt(lam, gam, az) + (usePitch ? pitchDcq(lam, SIM.pitch) : 0) : 0;
  const Ta = 0.5 * rho * G.A * G.R * V * V * cq;
  // protection
  const wmax = L.wmaxRpm * Math.PI / 30;
  if (SIM.out && SIM.out.el) SIM.pAvg = (SIM.pAvg || 0) + (SIM.out.el.Pout - (SIM.pAvg || 0)) * Math.min(1, dt / 3);
  if (L.ospd && (SIM.omega > wmax || (SIM.out && SIM.out.el && (SIM.out.el.Pout > 1.6 * L.Pmax || SIM.pAvg > 1.2 * L.Pmax)))) { if (!SIM.latch) SIM.trips = (SIM.trips || 0) + 1; SIM.latch = true; }
  if (SIM.latch && SIM.omega < 0.55 * wmax) SIM.latch = false;
  // cut-out: shut down once the (1 s low-pass) mean wind stays above vCutOut, restart only below vRestart
  // (hysteresis keeps a gust from cycling the brake on and off near the threshold)
  if (!L.cutOut) SIM.cutout = false;
  else if (!SIM.cutout && SIM.Vmeas > L.vCutOut) { SIM.cutout = true; SIM.cutouts = (SIM.cutouts || 0) + 1; }
  else if (SIM.cutout && SIM.Vmeas < L.vRestart) SIM.cutout = false;
  const brake = SIM.brake || SIM.latch || SIM.cutout;
  const el = electrical(SIM.omega, SIM.D, brake);
  const Tf = frictionT(SIM.omega);
  const Tmb = brake ? 1.5 * (G.Prated || 100) / (G.wRated || 20) : 0;
  const Tstat = 0.01 * (G.Prated || 100) / (G.wRated || 20);
  let acc = (Ta - el.Tg - Tf - (SIM.omega > 1e-4 ? Tmb : 0)) / G.J;
  if (SIM.omega <= 1e-4 && (brake || Ta <= Tstat)) acc = 0;
  SIM.omega = Math.max(0, SIM.omega + acc * dt);
  SIM.theta += SIM.omega * dt;
  const Pa = Ta * SIM.omega;
  // controller
  { const raw = el.Tg + (G.J || 1) * (SIM.wPrevObs == null ? 0 : (SIM.omega - SIM.wPrevObs) / dt); SIM.wPrevObs = SIM.omega;
    SIM.tEst = SIM.tEst == null ? raw : SIM.tEst + (raw - SIM.tEst) * Math.min(1, dt / 0.12); }
  const ctl = L.ctrl;
  // rated-power limiting (fixed-pitch "soft stall"): a power PI lowers the speed ceiling wcap above rating
  const wmxC = 0.95 * L.wmaxRpm * Math.PI / 30, wrC = G.wRated || 20;
  if (!(SIM.wcap > 0)) SIM.wcap = wmxC;
  if (usePitch) {
    // pitch regulation: speed ceiling = rated rotor speed (λopt at the wind speed where the generator saturates); the power PI feathers the blades instead
    const Vr = Math.cbrt(L.Pmax / L.eta / (0.5 * rho * G.A * G.cpMax));
    SIM.wcap = Math.min(wmxC, G.lopt * Vr / G.R);
    const rate = Math.max(0.1, L.pitchRate);
    const cmd = brake ? rate : A.clamp(40 * (el.Pout - L.Pmax) / L.Pmax, -rate, rate);
    SIM.pitch = A.clamp(SIM.pitch + cmd * dt, 0, PITCH_MAX);
  } else if (!brake) SIM.wcap = A.clamp(SIM.wcap + 3 * (L.Pmax - el.Pout) / L.Pmax * wrC * dt, 0.25 * wrC, wmxC);
  if (!brake) {
    if (ctl === 'manual') SIM.D = L.D;
    else if (ctl === 'po') {
      // P&O on rotor-speed reference (outer loop) + speed loop acting on D (inner loop)
      const po = SIM.po, wr = G.wRated || 20;
      if (!(po.wref > 0)) { po.wref = Math.max(SIM.omega, 0.2 * wr); po.last = 0; po.acc = 0; po.tim = 0; po.cnt = 0; po.dir = 1; }
      po.tim += dt;
      // rotor-power estimate from measured current and acceleration (removes the kinetic-energy bias of plain P&O)
      const dw = po.wPrev == null ? 0 : (SIM.omega - po.wPrev) / dt; po.wPrev = SIM.omega;
      const Pest = SIM.omega * (el.Tg + (G.J || 1) * dw);
      if (po.tim > 0.35 * L.poT) { po.acc += Pest * dt; po.cnt += dt; }
      if (po.tim >= L.poT) {
        const avg = po.acc / Math.max(po.cnt, 1e-9); po.cnt = 0;
        if (avg < 0.002 * (G.Prated || 100)) po.dir = 1; // no output yet (EMF below bus voltage): speed up
        else if (avg < po.last) po.dir = -po.dir;
        po.last = avg; po.acc = 0; po.tim = 0;
        po.wref = A.clamp(po.wref + po.dir * L.poStep * wr, PO_WMIN * wr, 0.98 * L.wmaxRpm * Math.PI / 30);
      }
      speedLoop(Math.min(po.wref, SIM.wcap), wr, dt);
    } else if (ctl === 'tsr') {
      const wStar = Math.min(SIM.wcap, G.lopt * SIM.Vmeas / G.R), wr = G.wRated || 20;
      speedLoop(wStar, wr, dt);
    } else if (ctl === 'ot') {
      if (SIM.omega > SIM.wcap) speedLoop(SIM.wcap, G.wRated || 20, dt);
      else { SIM.Di = null; SIM.D = dutyForCurrent(SIM.omega, powerLimitedI(SIM.omega, Math.min(G.kopt * SIM.omega ** 2 / L.ke, 3 * ratedCurrent()))); }
    }
    SIM.D = A.clamp(SIM.D, 0.03, 0.97);
  }
  SIM.t += dt;
  SIM.out = { V, gam, lam, cq, Ta, Pa, Cp: V > 0.3 ? Pa / (0.5 * rho * G.A * V ** 3) : 0, el, brake, rpm: SIM.omega * 30 / Math.PI };
}
function recordHist() {
  const h = SIM.hist, o = SIM.out;
  h.t.push(SIM.t); h.V.push(o.V); h.rpm.push(o.rpm); h.Pa.push(o.Pa); h.Po.push(o.el.Pout); h.D.push(SIM.D); h.lam.push(o.lam); h.cp.push(o.Cp);
  while (h.t.length && h.t[0] < SIM.t - 60) for (const k in h) h[k].shift();
  SIM.traj.push([o.rpm, o.Pa]); if (SIM.traj.length > 240) SIM.traj.shift();
}

/* ---------- steady state power curve ---------- */
function steadyPower(V) {
  const { rho } = air();
  const q = 0.5 * rho * G.A * G.R * V * V;
  const wmax = Math.max(G.perf.lam[G.perf.lam.length - 1], 1) * V / G.R;
  const N = 160; let prev = null, best = null, startsOK = true;
  for (let k = 0; k <= N; k++) {
    const w = wmax * k / N;
    const lam = w * G.R / V;
    const Ta = q * (S.mode === 'HAWT' ? interpCurve(G.perf, 'cq', lam) : interpCurve(G.perf, 'cq', lam));
    const el = electrical(w, S.load.D, false);
    const net = Ta - el.Tg - frictionT(w);
    if (k === 1 && net < 0) startsOK = false;
    if (prev && prev.net > 0 && net <= 0) {
      let a = prev.w, b = w;
      for (let it = 0; it < 18; it++) { const m = (a + b) / 2, lm = m * G.R / V; const nm = q * interpCurve(G.perf, 'cq', lm) - electrical(m, S.load.D, false).Tg - frictionT(m); if (nm > 0) a = m; else b = m; }
      const wm = (a + b) / 2, e2 = electrical(wm, S.load.D, false);
      best = { w: wm, Pout: e2.Pout, Pa: q * interpCurve(G.perf, 'cq', wm * G.R / V) * wm };
    }
    prev = { net, w };
  }
  return best ? { ...best, startsOK } : { w: 0, Pout: 0, Pa: 0, startsOK };
}

// 啟動模擬:從初始轉速(設計轉速的 w0Frac 倍,0 = 靜止)在固定風速下跑時域,回傳轉速達設計轉速 50% 的時間
// (tHalf,未達為 null)、結束時的 λ 與是否超過設計轉速 50%。會直接改動 SIM,呼叫端自行還原。
function startupRun(V, w0Frac, dur) {
  S.tun.TI = 0; S.tun.V = V;
  const w1 = G.lopt * V / G.R;
  SIM.omega = w1 * w0Frac; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null; SIM.wcap = -1; SIM.pAvg = 0;
  SIM.latch = false; SIM.cutout = false; SIM.n = 0; SIM.po.wref = -1; SIM.Vmeas = V; SIM.wPrevObs = null;
  let tHalf = null;
  for (let t = 0; t < dur; t += 0.004) {
    simStep(0.004);
    if (tHalf === null && SIM.omega > 0.5 * w1) tHalf = t;
  }
  return { tHalf, lambda: SIM.omega * G.R / V, started: tHalf !== null };
}

export { COST_DEFAULT, parseWindSeries, windSeriesPdf, windDensity, A, MATERIALS, VAWT_TYPES, S, G, SIM, air, AF_LIB, afCache, afLabel, getAf, getModel, getPS, stSorted, afBlendAt, viewKey, designHAWT, designVAWT, hawtCfg, computePerf, interpCurve, autoMatchGen, simStep, recordHist, steadyPower, gammaFn, weibullPdf, capacityFactor, snapRated, idealAEP, noiseEstimate, blDstarFn, tbleNoise, tbleSpectrum, costEstimate, rootStress, fatigueEstimate, pitchRegulation, pitchDcq, startupRun };
