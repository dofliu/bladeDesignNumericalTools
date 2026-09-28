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

test('sectionProperties: extreme-fibre distances bracket a NACA 0012 solid section', () => {
  const af = A.naca4('0012'), chord = 1;
  const s = GEO.sectionProperties(af, chord, 1); // thick shell -> solid section
  // symmetric section: max half-thickness is close to 0.06c (12% t/c), centroid near mid-chord
  near(s.yMax, 0.06 * chord, 0.02 * chord, 'yMax ~ max half-thickness');
  assert.ok(s.xMax > 0.3 * chord && s.xMax < 0.7 * chord, 'xMax within a reasonable chordwise range');
});

test('cumulativeMoment + cantileverDeflection: point load at the tip matches the analytic cantilever', () => {
  const L = 3, P = 500, EIc = 4e5, n = 100;
  const r = Array.from({ length: n }, (_, i) => i * L / (n - 1));
  const w = new Array(n).fill(0); w[n - 1] = P;
  const M = GEO.cumulativeMoment(r, w);
  near(M[0], P * L, 1e-9, 'root moment = P*L');
  assert.ok(M[n - 1] < 1e-6, 'moment ~0 at the free tip');
  const y = GEO.cantileverDeflection(r, M, new Array(n).fill(EIc));
  near(y[n - 1], P * L ** 3 / (3 * EIc), 0.01 * (P * L ** 3 / (3 * EIc)), 'tip deflection = P*L^3/(3EI)');
});

test('cumulativeMoment: uniform distributed load matches w*L^2/2 at the root', () => {
  const L = 2.5, w0 = 80, n = 400;
  const r = Array.from({ length: n }, (_, i) => i * L / (n - 1));
  // midpoint control-volume widths (as core.js builds row.dr) so sum(w) == w0*L exactly
  const dr = r.map((_, i) => (i === n - 1 ? L : (r[i] + r[i + 1]) / 2) - (i === 0 ? 0 : (r[i - 1] + r[i]) / 2));
  const load = dr.map(d => w0 * d);
  const M = GEO.cumulativeMoment(r, load);
  near(M[0], w0 * L * L / 2, 0.01 * w0 * L * L / 2, 'root moment = w0*L^2/2');
});

test('cumulativeAxialForce: uniform mass per length matches m*omega^2*L^2/2 at the root', () => {
  const L = 1.5, m0 = 2, omega = 60, n = 400;
  const r = Array.from({ length: n }, (_, i) => i * L / (n - 1));
  const dr = r.map((_, i) => (i === n - 1 ? L : (r[i] + r[i + 1]) / 2) - (i === 0 ? 0 : (r[i - 1] + r[i]) / 2));
  const mass = dr.map(d => m0 * d);
  const N = GEO.cumulativeAxialForce(r, mass, omega);
  near(N[0], m0 * omega * omega * L * L / 2, 0.01 * m0 * omega * omega * L * L / 2, 'root axial force');
});

test('bladeStructuralLoads: sane on a real BEM-designed HAWT blade', () => {
  global.AERO = A;
  const core = require('../src/core.js');
  const { S, G, designHAWT, computePerf, air } = core;
  S.mode = 'HAWT';
  designHAWT(); computePerf();
  const material = { E: 20e9, rho: 1850, sigmaAllow: 100e6 }; // representative GFRP shell defaults
  const omega = S.hawt.tsr * S.hawt.Vd / G.R;
  const res = GEO.bladeStructuralLoads(G.rows, G.afs, G.desElems, { rho: air().rho, omega, thickness: 0.004, material });
  assert.equal(res.stations.length, G.rows.length);
  for (const st of res.stations) {
    assert.ok(isFinite(st.sigma) && st.sigma >= 0, 'finite non-negative stress');
    assert.ok(isFinite(st.sf) && st.sf > 0, 'finite positive safety factor');
  }
  assert.ok(Math.abs(res.stations[0].Mflap) >= Math.abs(res.stations[res.stations.length - 1].Mflap), 'flap moment decreases from root to tip');
  assert.ok(res.tipDeflection >= 0 && res.tipDeflection < G.R, 'tip deflection is a small fraction of blade radius');
});
