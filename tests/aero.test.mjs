// Regression tests for the aerodynamic core (src/aero.js runs in Node as CommonJS).
// Reference values were verified when the models were written; keep tolerances tight
// so that an accidental change in the physics shows up immediately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../src/aero.js');

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

test('DMST: H-type and Φ-type Darrieus', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const run = type => A.vawtCurve({ type, R: 1, H: 2, B: 3, c: 0.15, pitch: 0, helix: 120, nz: 10, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 }, 8, 7)
    .reduce((a, c) => (c.Cp > a.Cp ? c : a));
  const h = run('H'), phi = run('phi');
  near(h.Cp, 0.368, 0.015, 'H Cp'); near(h.l, 3, 0.5, 'H λopt');
  near(phi.Cp, 0.385, 0.015, 'Φ Cp');
});

// ---- Thin-shell cross-section structural properties (ROADMAP 3: 截面性質) ----
// Validated against the closed-form thin circular ring (I = πR³t) rather than a single
// hand-computed airfoil number, so the segment-integration algorithm itself is what's
// under test, independent of the airfoil geometry generator.
test('shellSectionProps: thin circular ring matches closed form', () => {
  const R = 0.12, t = 0.0015, n = 400, pts = [];
  for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; pts.push([R * Math.cos(th), R * Math.sin(th)]); }
  const s = A.shellSectionProps(pts, t);
  near(s.area, 2 * Math.PI * R * t, 1e-6, 'area');
  near(s.xc, 0, 1e-9, 'xc'); near(s.yc, 0, 1e-9, 'yc');
  near(s.Ixx, Math.PI * R ** 3 * t, 1e-8, 'Ixx');
  near(s.Iyy, Math.PI * R ** 3 * t, 1e-8, 'Iyy');
  near(s.Ixy, 0, 1e-9, 'Ixy');
});

test('sectionProps: NACA 0012 skin is symmetric and much stiffer edgewise than flapwise', () => {
  const af = A.naca4('0012'), c = 1, t = 0.002;
  const s = A.sectionProps(af, c, t);
  near(s.yc, 0, 1e-6, 'yc of a symmetric airfoil'); // no camber -> centroid on the chord line
  assert.ok(s.xc > 0.3 * c && s.xc < 0.7 * c, `xc should sit near mid-chord, got ${s.xc}`);
  assert.ok(s.Iyy > 10 * s.Ixx, `chordwise Iyy (${s.Iyy}) should dwarf thickness-wise Ixx (${s.Ixx}) for a thin airfoil`);
});

test('sectionProps: scales as expected with chord and shell thickness', () => {
  const af = A.naca4('4412'), t = 0.002;
  const s1 = A.sectionProps(af, 1, t), s2 = A.sectionProps(af, 2, t);
  near(s2.area / s1.area, 2, 0.02, 'area doubles with chord (thickness fixed -> linear, not quadratic)');
  near(s2.Ixx / s1.Ixx, 8, 0.1, 'Ixx scales as chord^3');
  near(s2.Iyy / s1.Iyy, 8, 0.1, 'Iyy scales as chord^3');
  const s3 = A.sectionProps(af, 1, 2 * t);
  near(s3.area / s1.area, 2, 1e-6, 'area is linear in shell thickness');
  near(s3.Ixx / s1.Ixx, 2, 1e-6, 'Ixx is linear in shell thickness');
});
