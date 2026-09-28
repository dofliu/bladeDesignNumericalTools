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

// N interior midpoints of [0,L] (e.g. one blade station per segment), with an explicit r=0
// entry so beamInternalLoads/beamDeflection see the exact cantilever root position.
function rootedSpan(N, L) { const st = [0]; for (let i = 0; i < N; i++) st.push((i + 0.5) / N * L); return st; }

test('beamInternalLoads + beamDeflection: point load at the tip matches the cantilever analytic solution', () => {
  const L = 3, P = 120, EI = 4.2e5, N = 40;
  const rs = rootedSpan(N, L).concat([L]); // exact tip station carries the point load
  const stations = rs.map((r, i) => ({ r, W: i === rs.length - 1 ? P : 0 }));
  const loads = GEO.beamInternalLoads(stations);
  near(loads[0].M, P * L, 1e-9 * P * L, 'root moment = P*L (exact, single point load)');
  near(loads[0].V, P, 1e-9 * P, 'root shear = P');
  const defl = GEO.beamDeflection(loads.map(s => ({ r: s.r, M: s.M, EI })));
  const tip = defl[defl.length - 1].defl, ref = P * L ** 3 / (3 * EI);
  near(tip, ref, 0.01 * ref, 'tip deflection = P L^3/(3 EI)');
});

test('beamInternalLoads + beamDeflection: uniformly distributed load matches the cantilever analytic solution', () => {
  const L = 2.5, w = 80, EI = 6.5e5, N = 200, dr = L / N;
  const stations = rootedSpan(N, L).map(r => ({ r, W: r === 0 ? 0 : w * dr }));
  const loads = GEO.beamInternalLoads(stations);
  near(loads[0].M, w * L * L / 2, 0.01 * w * L * L / 2, 'root moment = w L^2/2');
  near(loads[0].V, w * L, 0.01 * w * L, 'root shear = w L');
  const defl = GEO.beamDeflection(loads.map(s => ({ r: s.r, M: s.M, EI })));
  const tip = defl[defl.length - 1].defl, ref = w * L ** 4 / (8 * EI);
  near(tip, ref, 0.02 * ref, 'tip deflection = w L^4/(8 EI)');
});
