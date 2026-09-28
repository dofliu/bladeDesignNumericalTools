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

test('sectionProperties: extreme-fibre distances bracket the centroid within the chord/thickness box', () => {
  const af = A.naca4('0012'), chord = 2, s = GEO.sectionProperties(af, chord, 1); // solid
  near(s.xLE + s.xTE, chord, 1e-9 * chord, 'xLE+xTE spans the chord');
  assert.ok(s.yTop > 0 && s.yBot > 0, 'nonzero thickness-wise extents');
  near(s.yTop, s.yBot, 1e-6, 'symmetric aerofoil (0012) has yTop==yBot about its own centroid');
});

test('solveThicknessForArea: recovers a target shell area within 1%', () => {
  const af = A.naca4('4412'), chord = 0.8, target = 0.15 * A.airfoilArea(af) * chord * chord;
  const t = GEO.solveThicknessForArea(af, chord, target);
  const got = GEO.sectionProperties(af, chord, t).area;
  near(got, target, 0.01 * target, 'solved-thickness shell area');
});

test('momentAt/sumAt: point loads on a simple 3-station cantilever match hand calculation', () => {
  const rows = [{ r: 1 }, { r: 2 }, { r: 3 }];
  const F = [10, 20, 30]; // N, at r=1,2,3
  near(GEO.sumAt(rows, F, 0), 60, 1e-9, 'total load');
  near(GEO.sumAt(rows, F, 2), 50, 1e-9, 'load outboard of r=2');
  // moment at the root (r=0): sum F_i * r_i
  near(GEO.momentAt(rows, F, 0), 10 * 1 + 20 * 2 + 30 * 3, 1e-9, 'root moment');
  // moment at r=2: only loads outboard (r>=2) count, lever arm relative to r=2
  near(GEO.momentAt(rows, F, 2), 20 * 0 + 30 * 1, 1e-9, 'moment at r=2');
});

test('beamDeflection: matches the analytic cantilever tip deflection for a uniform point load and a UDL', () => {
  const L = 3, EIc = 5e4, Nst = 400;
  const rows = []; for (let i = 1; i <= Nst; i++) rows.push({ r: i * L / Nst });
  // (a) point load P at the free tip: M(r) = P*(L-r), y_tip analytic = P*L^3/(3EI)
  const P = 100;
  const Fpoint = rows.map((x, i) => i === rows.length - 1 ? P : 0); // all the load lumped at the last station, tip
  const Mp = rows.map(x => GEO.momentAt(rows, Fpoint, x.r));
  const stP = [{ r: 0, M: GEO.momentAt(rows, Fpoint, 0), EI: EIc }, ...rows.map((x, i) => ({ r: x.r, M: Mp[i], EI: EIc }))];
  const yP = GEO.beamDeflection(stP).y;
  near(yP[yP.length - 1], P * L ** 3 / (3 * EIc), 0.02 * P * L ** 3 / (3 * EIc), 'point-load tip deflection');
  // (b) uniformly distributed load w per unit length: y_tip analytic = w*L^4/(8EI)
  const w = 40, dr = L / Nst;
  const Fudl = rows.map(() => w * dr);
  const Mu = rows.map(x => GEO.momentAt(rows, Fudl, x.r));
  const stU = [{ r: 0, M: GEO.momentAt(rows, Fudl, 0), EI: EIc }, ...rows.map((x, i) => ({ r: x.r, M: Mu[i], EI: EIc }))];
  const yU = GEO.beamDeflection(stU).y;
  near(yU[yU.length - 1], w * L ** 4 / (8 * EIc), 0.02 * w * L ** 4 / (8 * EIc), 'UDL tip deflection');
});
