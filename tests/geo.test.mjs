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

/* ---------- Blade structural loads (bending moment / centrifugal axial / beam deflection) ---------- */
// Idealized cantilever, uniform EI and a uniform distributed transverse load w over the whole span
// L, discretized as many equal point loads at midpoint-rule stations (same lumping the real blade-
// element stations use): checked against the closed-form cantilever solution.
function uniformLoadStations(L, w, n) {
  const dr = L / n, stations = [];
  for (let i = 0; i < n; i++) stations.push({ r: (i + 0.5) * dr, dF: w * dr });
  return stations;
}

test('bendingMomentProfile: uniformly loaded cantilever matches the closed-form M(x)=w(L-x)^2/2', () => {
  const L = 2, w = 50, n = 400;
  const stations = uniformLoadStations(L, w, n);
  const M = GEO.bendingMomentProfile(stations);
  near(M[0], w * L * L / 2, 0.01 * w * L * L / 2, 'root moment');
  near(M[Math.floor(n / 2)], w * (L - stations[Math.floor(n / 2)].r) ** 2 / 2, 0.02 * w * L * L / 2, 'mid-span moment');
  near(M[n - 1], 0, 0.01 * w * L * L / 2, 'tip moment ~ 0');
});

test('beamCurvatureDeflection: uniformly loaded cantilever tip deflection matches wL^4/(8EI)', () => {
  const L = 2, w = 50, EI = 3000, n = 400;
  const M = GEO.bendingMomentProfile(uniformLoadStations(L, w, n));
  const beam = GEO.beamCurvatureDeflection(uniformLoadStations(L, w, n).map((s, i) => ({ r: s.r, M: M[i], EI })));
  const tip = beam.defl[beam.defl.length - 1], ref = w * L ** 4 / (8 * EI);
  near(tip, ref, 0.01 * ref, 'tip deflection');
});

test('axialForceProfile: uniform rotating rod matches N(r)=rho_lin*omega^2*(L^2-r^2)/2', () => {
  const L = 2, rhoLin = 5, omega = 10, n = 400, dr = L / n;
  const stations = []; for (let i = 0; i < n; i++) stations.push({ r: (i + 0.5) * dr, dm: rhoLin * dr });
  const N = GEO.axialForceProfile(stations, omega);
  near(N[0], rhoLin * omega * omega * L * L / 2, 0.01 * rhoLin * omega * omega * L * L / 2, 'root axial force');
  near(N[n - 1], 0, 1e-6, 'tip axial force ~ 0');
});

test('bladeStructure: 3-blade R1.5 m λ7 rotor gives a plausible root moment, tapering loads and a safety margin', () => {
  const af = A.naca4('4412'), ps = A.buildPolarSet(A.buildAeroModel(af));
  const b = A.bestLD(ps, 3e5);
  const rows = A.designHAWT({ R: 1.5, Rhub: 0.15, B: 3, tsr: 7, aDes: b.a, clDes: b.cl, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChordRatio: 0.2 });
  const cfg = { R: 1.5, Rhub: 0.15, B: 3, rows, rho: 1.225, mu: 1.81e-5, polarFor: () => ps };
  const omega = 7 * 8 / 1.5;
  const res = A.bemPoint(cfg, 8, omega, 0, 0, null);
  const mat = { fill: 0.28, E: 20e9, sigmaAllow: 100e6 }; // GFRP-like reference values
  const matRho = 1850;
  rows.forEach(r => { r.dm = matRho * mat.fill * A.airfoilArea(af) * r.c * r.c * r.dr; });
  const afs = rows.map(() => af);
  const st = GEO.bladeStructure(rows, afs, res.elems, mat, omega);
  near(st.rootMoment, 63.6, 3, 'root bending moment (Nm), GFRP reference blade');
  assert.ok(st.stations.every((s, i) => i === 0 || s.M <= st.stations[i - 1].M + 1e-9), 'bending moment tapers monotonically toward the tip');
  assert.ok(st.stations.every((s, i) => i === 0 || s.N <= st.stations[i - 1].N + 1e-9), 'centrifugal axial force tapers monotonically toward the tip');
  assert.ok(st.tipDeflection > 0 && st.tipDeflection < 0.1 * 1.5, 'tip deflection is small relative to blade radius');
  assert.ok(st.safetyFactor > 1, 'GFRP reference blade has a positive structural margin at the design point');
});
