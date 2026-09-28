/* ===== App core: state, computation, simulation ===== */
// Wrapped as a Node/browser dual-export module (like aero.js) so simStep() and the
// design/perf pipeline can be driven from Node tests without a DOM (see tests/core.test.mjs).
// In the concatenated single-script build, Object.assign(root, API) below republishes every
// name this file used to expose as a bare top-level identifier, so ui.js/bench.js/flow.js/
// report.js keep working unchanged.
(function (root) {
'use strict';
const A = AERO;
const MATERIALS = {
  gfrp: { name: '玻纖複合材(空心殼)', rho: 1850, fill: 0.28 },
  wood: { name: '木材(實心)', rho: 550, fill: 1 },
  alu: { name: '鋁擠型(空心)', rho: 2700, fill: 0.22 },
  pla: { name: '3D 列印 PLA(30% 填充)', rho: 1240, fill: 0.42 },
  cfrp: { name: '碳纖複合材(空心殼)', rho: 1550, fill: 0.22 }
};
const VAWT_TYPES = { H: 'H 型(直葉片)', helical: '螺旋型(Gorlov)', phi: 'Φ 型(Darrieus 打蛋器)', V: 'V 型', sav: 'Savonius 阻力型' };

const S = {
  mode: 'HAWT', step: 'af', ctab: 'airfoil',
  af: { st: [{ f: 0.2, k: 'n4:4421' }, { f: 0.5, k: 'n4:4415' }, { f: 0.8, k: 'n4:4412' }], vawt: 'n4:0018', cdMax: 1.3, custom: [], imported: [], polarImp: {}, view: 2, alphaView: 6, reIdx: 3, full: false },
  hawt: { R: 1.5, Rhub: 0.15, B: 3, tsr: 7, Vd: 8, aMode: 'auto', aDes: 5, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChord: 0.12, pitch: 0, material: 'gfrp', ov: {}, twMode: 'bem', twRoot: 20, twTip: 0 },
  vawt: { type: 'H', R: 1.0, H: 2.0, B: 3, c: 0.15, pitch: 0, helix: 120, struts: 2, overlap: 0.2, endPlates: true, material: 'gfrp' },
  tun: { V: 8, dir: 0, TI: 0.08, T: 15, alt: 0, yawMode: 'auto', yawRate: 8, yawFixed: 0, timeScale: 1, running: true },
  load: { kind: 'bat', RL: 5, Vbat: 48, ke: 2, Rs: 0.5, Vdiode: 1.4, eta: 0.95, ctrl: 'po', D: 0.5, poStep: 0.03, poT: 1.0, ospd: true, wmaxRpm: 900, Pmax: 2500, auto: true },
  perf: { Vavg: 5.5 }
};

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
  bladeLoads(rows, resD.elems, omD, rho);
}
// One-blade spanwise loads at the design point (steady, no gravity/gust): flapwise (out-of-plane,
// thrust-like) and edgewise (in-plane, torque-like) distributed aero force from the BEM design
// solution, summed outboard-to-root into bending moments (see AERO.cumulativeMoment), plus the
// centrifugal axial force from each station's own blade mass (from the mass/inertia loop above)
// spinning at the design rotor speed. Root values (index 0) are the root bending moments / axial
// force used for a first structural check; per-row values are exposed for a spanwise plot.
function bladeLoads(rows, elems, omega, rho) {
  const r = rows.map(x => x.r);
  const dFz = rows.map((x, i) => { const el = elems[i], phi = el.phi * A.D2R, q = 0.5 * rho * el.W * el.W * x.c * x.dr;
    return q * (el.cl * Math.cos(phi) + el.cd * Math.sin(phi)); });
  const dFy = rows.map((x, i) => { const el = elems[i], phi = el.phi * A.D2R, q = 0.5 * rho * el.W * el.W * x.c * x.dr;
    return q * (el.cl * Math.sin(phi) - el.cd * Math.cos(phi)); });
  const Mflap = A.cumulativeMoment(r, dFz), Medge = A.cumulativeMoment(r, dFy);
  const Fax = A.cumulativeOutboard(r, rows.map(x => x.dm * omega * omega * x.r));
  rows.forEach((x, i) => { x.dFz = dFz[i]; x.dFy = dFy[i]; x.Mflap = Mflap[i]; x.Medge = Medge[i]; x.Fax = Fax[i]; });
  G.loads = { omega, MflapRoot: Mflap[0], MedgeRoot: Medge[0], FaxRoot: Fax[0] };
}
function vawtCfg() {
  const v = S.vawt, { rho, mu } = air();
  return { type: v.type, R: v.R, H: v.H, B: Math.round(v.B), c: v.c, pitch: v.pitch, helix: v.helix, nz: 10, polar: getPS(S.af.vawt), rho, mu, struts: v.struts, overlap: v.overlap, endPlates: v.endPlates };
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
const SIM = { t: 0, omega: 0, theta: 0, yaw: 0, n: 0, gust: 0, gustT: -1, V: 8, Vmeas: 8, D: 0.5, brake: false, latch: false,
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
  const gam = S.mode === 'HAWT' ? A.wrapPi((T.dir - SIM.yaw) * A.D2R) * A.R2D : 0;
  const Vs = Math.max(V, 0.05);
  const lam = SIM.omega * G.R / Vs;
  const az = SIM.theta + T.dir * A.D2R;
  const cq = V > 0.05 ? cqAt(lam, gam, az) : 0;
  const Ta = 0.5 * rho * G.A * G.R * V * V * cq;
  // protection
  const wmax = L.wmaxRpm * Math.PI / 30;
  if (SIM.out && SIM.out.el) SIM.pAvg = (SIM.pAvg || 0) + (SIM.out.el.Pout - (SIM.pAvg || 0)) * Math.min(1, dt / 3);
  if (L.ospd && (SIM.omega > wmax || (SIM.out && SIM.out.el && (SIM.out.el.Pout > 1.6 * L.Pmax || SIM.pAvg > 1.2 * L.Pmax)))) { if (!SIM.latch) SIM.trips = (SIM.trips || 0) + 1; SIM.latch = true; }
  if (SIM.latch && SIM.omega < 0.55 * wmax) SIM.latch = false;
  const brake = SIM.brake || SIM.latch;
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
  if (!brake) SIM.wcap = A.clamp(SIM.wcap + 3 * (L.Pmax - el.Pout) / L.Pmax * wrC * dt, 0.25 * wrC, wmxC);
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

const API = { A, MATERIALS, VAWT_TYPES, S, G, SIM, air, AF_LIB, afCache, afLabel, getAf, getModel, getPS,
  stSorted, afBlendAt, viewKey, designHAWT, designVAWT, hawtCfg, computePerf, interpCurve, autoMatchGen,
  simStep, recordHist, steadyPower };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else Object.assign(root, API);
})(this);
