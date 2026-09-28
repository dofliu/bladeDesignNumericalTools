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

function span(L, n) { const st = []; for (let i = 0; i < n; i++) st.push({ r: L * i / (n - 1) }); return st; }

test('beamMoment: cantilever tip point load matches M(r) = P*(L-r), root moment P*L', () => {
  const L = 3, P = 100, n = 400;
  const st = span(L, n).map((s, i) => ({ ...s, F: i === n - 1 ? P : 0 }));
  const m = GEO.beamMoment(st);
  near(m[0].M, P * L, 1e-9 * P * L, 'root moment');
  near(m[n - 1].M, 0, 1e-9, 'tip moment');
  near(m[Math.floor(n / 2)].M, P * (L - st[Math.floor(n / 2)].r), 1e-9 * P * L, 'mid-span moment');
});

test('beamMoment: uniformly distributed load matches M(r) = w*(L-r)^2/2, root moment w*L^2/2', () => {
  const L = 3, w = 20, n = 2000, dr = L / (n - 1);
  const st = span(L, n).map(s => ({ ...s, F: w * dr }));
  const m = GEO.beamMoment(st);
  near(m[0].M, w * L * L / 2, 0.01 * w * L * L / 2, 'root moment');
  const rMid = st[Math.floor(n / 2)].r;
  near(m[Math.floor(n / 2)].M, w * (L - rMid) ** 2 / 2, 0.02 * w * L * L / 2, 'mid-span moment');
});

test('centrifugalForce: uniform mass per length matches N(r) = m*omega^2*(L^2-r^2)/2', () => {
  const L = 2, massPerLen = 5, omega = 12, n = 2000, dr = L / (n - 1);
  const st = span(L, n).map(s => ({ ...s, m: massPerLen * dr }));
  const c = GEO.centrifugalForce(st, omega);
  const ref = r => massPerLen * omega * omega * (L * L - r * r) / 2;
  near(c[0].N, ref(0), 0.01 * ref(0), 'root axial force');
  const rMid = st[Math.floor(n / 2)].r;
  near(c[Math.floor(n / 2)].N, ref(rMid), 0.01 * ref(0), 'mid-span axial force');
});

test('beamDeflection: cantilever tip point load matches y_tip = P*L^3/(3EI)', () => {
  const L = 3, P = 100, EI = 5e4, n = 400;
  const st = span(L, n).map((s, i) => ({ ...s, F: i === n - 1 ? P : 0, EI }));
  const withM = GEO.beamMoment(st);
  const y = GEO.beamDeflection(withM);
  const ref = P * L ** 3 / (3 * EI);
  near(y[n - 1].y, ref, 0.01 * ref, 'tip deflection');
  const refSlope = P * L * L / (2 * EI);
  near(y[n - 1].slope, refSlope, 0.01 * refSlope, 'tip slope');
});

test('beamDeflection: uniformly distributed load matches y_tip = w*L^4/(8EI)', () => {
  const L = 3, w = 20, EI = 5e4, n = 2000, dr = L / (n - 1);
  const st = span(L, n).map(s => ({ ...s, F: w * dr, EI }));
  const withM = GEO.beamMoment(st);
  const y = GEO.beamDeflection(withM);
  const ref = w * L ** 4 / (8 * EI);
  near(y[n - 1].y, ref, 0.02 * ref, 'tip deflection');
});
