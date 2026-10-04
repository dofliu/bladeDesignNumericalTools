// Regression tests for the aerodynamic core (src/aero.mjs).
// Reference values were verified when the models were written; keep tolerances tight
// so that an accidental change in the physics shows up immediately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/aero.mjs';

const near = (v, ref, tol, msg) => assert.ok(Math.abs(v - ref) <= tol, `${msg}: ${v} vs ${ref} ±${tol}`);

test('panel method: NACA 0012 inviscid lift at 5°', () => {
  near(A.panel(A.naca4('0012'))(5 * A.D2R).cl, 0.602, 0.01, 'cl');
});

test('panel method: field velocity satisfies no-penetration on the surface', () => {
  const s = A.panel(A.naca4('4412'))(5 * A.D2R);
  let worst = 0;
  for (let i = 5; i < s.n - 5; i++) {
    const dx = s.X[i + 1] - s.X[i], dy = s.Y[i + 1] - s.Y[i], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L, [u, v] = s.vel(s.xm[i] + nx * 1e-7, s.ym[i] + ny * 1e-7);
    worst = Math.max(worst, Math.abs(u * nx + v * ny));
  }
  assert.ok(worst < 1e-3, `max normal velocity ${worst}`);
});

test('cambered zero-lift angle: NACA 4412', () => {
  near(A.buildAeroModel(A.naca4('4412')).aL0 * A.R2D, -4.14, 0.1, 'aL0');
});

test('polar: best L/D of NACA 4412 at Re 3e5', () => {
  const b = A.bestLD(A.buildPolarSet(A.buildAeroModel(A.naca4('4412'))), 3e5);
  near(b.a, 3.5, 0.5, 'alpha'); near(b.ld, 81.2, 3, 'L/D');
});

test('BEM: 3-blade R1.5 m rotor designed for λ7', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('4412')));
  const b = A.bestLD(ps, 3e5);
  const rows = A.designHAWT({ R: 1.5, Rhub: 0.15, B: 3, tsr: 7, aDes: b.a, clDes: b.cl, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChordRatio: 0.2 });
  const cfg = { R: 1.5, Rhub: 0.15, B: 3, rows, rho: 1.225, mu: 1.81e-5, polarFor: () => ps };
  const cur = A.hawtCurve(cfg, 8, 0, 0, 12), best = cur.reduce((a, c) => (c.Cp > a.Cp ? c : a));
  near(best.Cp, 0.477, 0.01, 'Cp,max'); near(best.l, 7, 0.5, 'λopt');
  assert.ok(best.Cp < 16 / 27, 'must stay below the Betz limit');
  const yaw = Math.max(...A.hawtCurve(cfg, 8, 30 * A.D2R, 0, 12).map(p => p.Cp));
  near(yaw, 0.309, 0.02, 'Cp at 30° yaw');
});

test('cumulativeMoment/cumulativeOutboard match a cantilever under uniform distributed load', () => {
  // Discretise a cantilever of length L into n annuli of width dr carrying a uniform transverse
  // load w per unit length (F_i = w·dr lumped at each station centre). Analytical solution at
  // distance x from the root: shear V(x) = w·(L-x), moment M(x) = w·(L-x)²/2.
  const L = 3, n = 400, dr = L / n, w = 150;
  const r = Array.from({ length: n }, (_, i) => (i + 0.5) * dr);
  const F = r.map(() => w * dr);
  const V = A.cumulativeOutboard(r, F), M = A.cumulativeMoment(r, F);
  near(M[0], w * L * L / 2, w * L * L / 2 * 0.01, 'root moment');
  near(V[0], w * L, w * L * 0.01, 'root shear');
  const jMid = Math.floor(n / 2), x = r[jMid];
  near(M[jMid], w * (L - x) ** 2 / 2, w * (L - x) ** 2 / 2 * 0.02 + 1, 'mid-span moment');
  near(V[jMid], w * (L - x), w * (L - x) * 0.02 + 1, 'mid-span shear');
  assert.ok(M[n - 1] < w * dr * dr, 'moment ~0 at the tip');
});

test('DMST: H-type and Φ-type Darrieus', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const run = type => A.vawtCurve({ type, R: 1, H: 2, B: 3, c: 0.15, pitch: 0, helix: 120, nz: 10, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 }, 8, 7)
    .reduce((a, c) => (c.Cp > a.Cp ? c : a));
  const h = run('H'), phi = run('phi');
  near(h.Cp, 0.368, 0.015, 'H Cp'); near(h.l, 3, 0.5, 'H λopt');
  near(phi.Cp, 0.385, 0.015, 'Φ Cp');
});

test('DMST: simplified dynamic stall is opt-in and mainly affects the stalled low-λ region', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 };
  const base = A.dmstPoint(cfg, 8, 3), off = A.dmstPoint({ ...cfg, dynStall: false }, 8, 3);
  assert.equal(base.Cp, off.Cp, 'flag off leaves results unchanged');
  const lo0 = A.dmstPoint(cfg, 8, 1.8).Cp, lo1 = A.dmstPoint({ ...cfg, dynStall: true }, 8, 1.8).Cp;
  assert.ok(Number.isFinite(lo1) && Math.abs(lo1 - lo0) > 0.005, `low-λ Cp changes (${lo0.toFixed(3)} -> ${lo1.toFixed(3)})`);
  const hi1 = A.dmstPoint({ ...cfg, dynStall: true }, 8, 3).Cp;
  assert.ok(Math.abs(hi1 - base.Cp) < 0.06 * Math.max(base.Cp, 0.1) + 0.02, `near λopt change small (${base.Cp.toFixed(3)} -> ${hi1.toFixed(3)})`);
  console.log('dynStall', lo0.toFixed(3), lo1.toFixed(3), base.Cp.toFixed(3), hi1.toFixed(3));
});

test('DMST: streamline curvature correction is opt-in and lowers high-λ Cp', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 };
  const base = A.dmstPoint(cfg, 8, 4).Cp, off = A.dmstPoint({ ...cfg, curvature: false }, 8, 4).Cp;
  assert.equal(base, off, 'flag off leaves results unchanged');
  const on = A.dmstPoint({ ...cfg, curvature: true }, 8, 4).Cp;
  assert.ok(on < base && on > 0.5 * base, `high-λ Cp drops moderately (${base.toFixed(3)} -> ${on.toFixed(3)})`);
  const thin = A.dmstPoint({ ...cfg, c: 0.075, curvature: true }, 8, 4).Cp, thin0 = A.dmstPoint({ ...cfg, c: 0.075 }, 8, 4).Cp;
  assert.ok((thin0 - thin) / thin0 < (base - on) / base, 'smaller c/R gives a smaller correction');
  console.log('curvature', base.toFixed(3), on.toFixed(3));
});

test('boundary layer: NACA 0012 attached at 0° with plausible friction drag (Re 1e6)', () => {
  const bl = A.boundaryLayer(A.panel(A.naca4('0012'))(0), 1e6);
  assert.equal(bl.upper.xSep, null); assert.equal(bl.lower.xSep, null);
  near(bl.cd, 0.0056, 0.002, 'cd'); near(bl.upper.xTr, bl.lower.xTr, 0.05, '對稱翼型兩面轉捩點');
});

test('boundary layer: separation moves forward with angle of attack and lower Re', () => {
  const sep = (a, Re) => A.boundaryLayer(A.panel(A.naca4('0012'))(a * A.D2R), Re).upper.xSep;
  assert.ok(sep(12, 3e5) !== null && sep(16, 3e5) < sep(12, 3e5), '攻角越大分離點越前移');
  assert.ok(sep(12, 3e5) < sep(12, 1e6), '低 Re 分離較早');
  assert.equal(sep(2, 1e6), null);
  const cds = [0, 8, 16].map(a => A.boundaryLayer(A.panel(A.naca4('0012'))(a * A.D2R), 3e5).cd);
  assert.ok(cds[0] < cds[1] && cds[1] < cds[2], '阻力隨攻角增加');
});

test('極曲線 cd 與邊界層積分 cd 比對:低 Re 吻合、高 Re 校正後仍略偏高(厚翼型最多 1.6 倍)', () => {
  const ratio = (code, Re, a) => {
    const m = A.buildAeroModel(A.naca4(code));
    const pol = A.lookup({ REs: [1], tables: [A.polarAtRe(m, Re)] }, a * A.D2R, Re)[1];
    return pol / A.boundaryLayer(m.solve(a * A.D2R), Re).cd;
  };
  for (const code of ['0012', '2412', '4412', '0018']) {
    for (const a of [0, 2]) {
      const lo = ratio(code, 1e5, a), mid = ratio(code, 3e5, a), hi = ratio(code, 2e6, a);
      assert.ok(lo > 0.85 && lo < 1.15, `${code} a${a} Re1e5 比值 ${lo.toFixed(2)}`);
      assert.ok(mid > 0.8 && mid < 1.25, `${code} a${a} Re3e5 比值 ${mid.toFixed(2)}`);
      // 校正前高 Re 比值 1.5–2 倍;cd0 的 reCal 下修後 NACA 0012 Re 1e6 cd0 ≈ 0.006(文獻值),比值降為 1.17–1.6
      assert.ok(hi > 0.95 && hi < 1.7, `${code} a${a} Re2e6 比值 ${hi.toFixed(2)}`);
    }
  }
});
