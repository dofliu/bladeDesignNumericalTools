// Regression tests for the blade cross-section property helpers in src/geo.js
// (polygon area/centroid/inertia integration + thin-shell offset), checked against
// closed-form analytic shapes and one literature constant for a real airfoil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GEO = require('../src/geo.js');
const A = require('../src/aero.js');

const near = (v, ref, tol, msg) => assert.ok(Math.abs(v - ref) <= tol, `${msg}: ${v} vs ${ref} ±${tol}`);

test('polygonMoments: unit square', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const m = GEO.polygonMoments(sq);
  near(m.area, 1, 1e-12, 'area');
  near(m.My / m.area, 0.5, 1e-12, 'cx');
  near(m.Mx / m.area, 0.5, 1e-12, 'cy');
  near(m.Ixx / m.area - (m.Mx / m.area) ** 2, 1 / 12, 1e-12, 'Ixx about centroid');
  near(m.Iyy / m.area - (m.My / m.area) ** 2, 1 / 12, 1e-12, 'Iyy about centroid');
});

test('polygonMoments: also correct when the polygon winds clockwise', () => {
  const sqCW = [[0, 0], [0, 1], [1, 1], [1, 0]]; // reverse winding of the CCW square
  const m = GEO.polygonMoments(sqCW);
  near(m.area, 1, 1e-12, 'area');
  near(m.My / m.area, 0.5, 1e-12, 'cx');
});

function ngon(R, N) { const p = []; for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N; p.push([R * Math.cos(a), R * Math.sin(a)]); } return p; }

test('polygonMoments: regular N-gon approximates a solid disc (area, Ixx=Iyy=pi/4 R^4)', () => {
  const R = 2, circ = ngon(R, 360);
  const m = GEO.polygonMoments(circ);
  near(m.area, Math.PI * R * R, 0.02 * Math.PI * R * R, 'area');
  const cx = m.My / m.area, cy = m.Mx / m.area;
  near(cx, 0, 1e-6, 'cx'); near(cy, 0, 1e-6, 'cy');
  const IxxC = m.Ixx / m.area - cy * cy, ref = Math.PI / 4 * R ** 4 / m.area;
  near(IxxC, ref, 0.02 * ref, 'Ixx about centroid (normalized)');
});

test('offsetPolygon + composite section: thin ring matches the analytic annulus', () => {
  const R = 1, t = 0.1, N = 360;
  const outer = ngon(R, N);
  const inner = GEO.offsetPolygon(outer, t);
  const mOut = GEO.polygonMoments(outer), mIn = GEO.polygonMoments(inner);
  // the offset of a (near-)regular polygon should itself be close to a circle of radius R-t
  near(Math.sqrt(mIn.area / Math.PI), R - t, 0.01, 'inner offset radius');
  const area = mOut.area - mIn.area, refArea = Math.PI * (R * R - (R - t) ** 2);
  near(area, refArea, 0.02 * refArea, 'ring area');
  const Ixx = mOut.Ixx - mIn.Ixx, refIxx = Math.PI / 4 * (R ** 4 - (R - t) ** 4);
  near(Ixx, refIxx, 0.02 * refIxx, 'ring Ixx about origin (== centroid, symmetric)');
});

test('sectionProperties: NACA 0012 solid area matches the known ~0.6851*(t/c) constant', () => {
  const af = A.naca4('0012'), chord = 1;
  // thickness larger than the max airfoil half-thickness collapses to the solid section
  const s = GEO.sectionProperties(af, chord, 1);
  near(s.area, 0.6851 * 0.12, 0.02 * 0.6851 * 0.12, 'solid area / c^2');
  assert.ok(s.Ixx > 0 && s.Iyy > 0, 'positive second moments');
});

test('sectionProperties: thin shell area is close to perimeter * thickness', () => {
  const af = A.naca4('4412'), chord = 1, thickness = 0.004;
  const s = GEO.sectionProperties(af, chord, thickness);
  const pts = GEO.loop(af);
  let perim = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; perim += Math.hypot(x1 - x0, y1 - y0); }
  const thinWallEstimate = perim * chord * thickness;
  near(s.area, thinWallEstimate, 0.15 * thinWallEstimate, 'shell area vs perimeter*t');
  assert.ok(s.Ixx > 0 && s.Iyy > 0, 'positive second moments');
  assert.ok(s.cx > 0.2 * chord && s.cx < 0.6 * chord, 'centroid within chord');
});

// ---- Spanwise structural loads: cantilever beam mechanics + a BEM-driven sanity check ----

test('beamMoment/beamDeflection: uniform distributed load matches the analytic cantilever (w L^2/2, w L^4/8EI)', () => {
  const L = 3, n = 400, w0 = 50, EI0 = 1200;
  const rows = Array.from({ length: n }, (_, i) => ({ r: L * i / (n - 1), dr: L / (n - 1) }));
  const w = rows.map(() => w0), EI = rows.map(() => EI0);
  const M = GEO.beamMoment(rows, w);
  near(M[0], w0 * L * L / 2, 0.01 * w0 * L * L / 2, 'root moment');
  near(M[n - 1], 0, 1e-6, 'tip moment');
  const v = GEO.beamDeflection(rows, M, EI);
  near(v[n - 1], w0 * L ** 4 / (8 * EI0), 0.02 * w0 * L ** 4 / (8 * EI0), 'tip deflection');
});

test('beamMoment/beamDeflection: tip point load matches the analytic cantilever (P L, P L^3/3EI)', () => {
  const L = 3, n = 400, P = 20, EI0 = 1200;
  const rows = Array.from({ length: n }, (_, i) => ({ r: L * i / (n - 1), dr: L / (n - 1) }));
  const w = rows.map((row, i) => (i === n - 1 ? P / row.dr : 0));
  const EI = rows.map(() => EI0);
  const M = GEO.beamMoment(rows, w);
  near(M[0], P * L, 0.02 * P * L, 'root moment');
  const v = GEO.beamDeflection(rows, M, EI);
  near(v[n - 1], P * L ** 3 / (3 * EI0), 0.03 * P * L ** 3 / (3 * EI0), 'tip deflection');
});

test('axialForce: uniform mass/length spinning at omega matches the analytic centrifugal tension mu*omega^2*(R^2-r^2)/2', () => {
  // Each row is a lumped annulus of width dr, so the outermost row still carries its own
  // dr's worth of load past its own centre; F only tends to exactly 0 there as dr -> 0.
  const R = 1.5, n = 300, mu0 = 0.4, omega = 60;
  const rows = Array.from({ length: n }, (_, i) => ({ r: R * i / (n - 1), dr: R / (n - 1) }));
  const massPerLen = rows.map(() => mu0);
  const F = GEO.axialForce(rows, massPerLen, omega);
  near(F[0], mu0 * omega * omega * R * R / 2, 0.01 * mu0 * omega * omega * R * R / 2, 'root axial force');
  assert.ok(F[n - 1] < 0.02 * F[0], 'tip axial force is a small residual of the root value');
  for (let i = 1; i < n; i++) assert.ok(F[i] <= F[i - 1] + 1e-9, 'axial force decreases monotonically outboard');
});

test('bladeStructuralLoads: BEM-driven flatwise loads give a sane spanwise structural picture', () => {
  const af = A.naca4('4412'), ps = A.buildPolarSet(A.buildAeroModel(af));
  const rows = A.designHAWT({ R: 1.5, Rhub: 0.15, B: 3, tsr: 7, aDes: 3.5, clDes: 0.9, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChordRatio: 0.2 });
  const cfg = { R: 1.5, Rhub: 0.15, B: 3, rows, rho: 1.225, mu: 1.81e-5, polarFor: () => ps };
  const omega = 7 * 8 / 1.5; // tsr * V / R at the design point
  const res = A.bemPoint(cfg, 8, omega, 0, 0, null);
  const afs = rows.map(() => af);
  const mat = { rho: 1850, fill: 0.28, E: 20e9, allow: 100e6 }; // gfrp-like
  const st = GEO.bladeStructuralLoads(rows, afs, res.elems, 1.225, omega, mat);
  const last = st.length - 1;
  assert.ok(st[0].Mflap > st[last].Mflap, 'flatwise moment is largest at the root');
  near(st[last].Mflap, 0, 0.05 * Math.abs(st[0].Mflap), 'flatwise moment ~ 0 at the tip');
  for (let i = 1; i <= last; i++) assert.ok(st[i].defl >= st[i - 1].defl - 1e-9, 'deflection grows monotonically outboard');
  assert.ok(st[0].Fax > st[last].Fax, 'centrifugal tension is largest at the root');
  assert.ok(st[last].Fax < 0.1 * st[0].Fax, 'axial force falls to a small residual at the tip');
  assert.ok(st.every(s => s.safety > 0 && isFinite(s.safety)), 'finite positive safety factor at every station');
});
