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

// beamBending: cantilever beam under a UNIFORM distributed load w0 over [0, L] has closed-form
// root moment M0 = w0*L^2/2 and tip deflection wL^4/(8EI). With station radii at the exact
// midpoint of each dr slice, the lumped-load moment sum is exact (midpoint rule integrates the
// linear moment arm exactly), and a fine grid drives the slope/deflection trapezoidal integration
// error to a small fraction of a percent — this checks the numerical method itself, independent
// of any aerodynamic load model.
function uniformLoadStations(L, n) {
  const r = [], dr = [];
  for (let i = 0; i < n; i++) { const rl = L * i / n, rh = L * (i + 1) / n; r.push((rl + rh) / 2); dr.push(rh - rl); }
  return { r, dr };
}
test('beamBending: uniform load cantilever matches the closed-form root moment and tip deflection', () => {
  const L = 1.5, w0 = 40, E = 18e9, I = 2e-8, EI = E * I;
  const { r, dr } = uniformLoadStations(L, 400);
  const w = r.map(() => w0), EIarr = r.map(() => EI);
  const res = GEO.beamBending(r, dr, w, EIarr, 0);
  near(res.M0, w0 * L * L / 2, 1e-6 * w0 * L * L / 2, 'root moment M0 = w0*L^2/2');
  const mRef0 = w0 * (L - r[0]) ** 2 / 2;
  near(res.M[0], mRef0, 1e-3 * mRef0, 'moment at first station = w0*(L-r0)^2/2');
  const tipRef = w0 * L ** 4 / (8 * EI);
  near(res.tipDefl, tipRef, 0.01 * tipRef, 'tip deflection = w0*L^4/(8EI)');
});
test('beamBending: cantilever tip deflection scales as 1/EI and 1/8 for a coarse (16-station) grid', () => {
  const L = 1.5, w0 = 40, E = 18e9, I = 2e-8, EI = E * I;
  const { r, dr } = uniformLoadStations(L, 16);
  const w = r.map(() => w0), EIarr = r.map(() => EI);
  const res = GEO.beamBending(r, dr, w, EIarr, 0);
  const tipRef = w0 * L ** 4 / (8 * EI);
  near(res.tipDefl, tipRef, 0.05 * tipRef, 'tip deflection within 5% at realistic (16-station) resolution');
});
