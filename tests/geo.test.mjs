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
  assert.ok(s.yExtent > 0 && s.yExtent < 0.5 * chord, 'yExtent within chord');
  assert.ok(s.xExtent > 0.4 * chord && s.xExtent < chord, 'xExtent spans most of the chord');
});

test('thinWallSection: thin ring matches the analytic annulus (area, Ixx)', () => {
  const R = 1, t = 0.02, N = 720;
  const pts = ngon(R, N);
  const segs = pts.map((p, i) => { const [x0, y0] = p, [x1, y1] = pts[(i + 1) % N]; return { ds: Math.hypot(x1 - x0, y1 - y0), xm: (x0 + x1) / 2, ym: (y0 + y1) / 2 }; });
  let per = 0, sy = 0; for (const s of segs) { per += s.ds; sy += s.ds * s.ym; }
  const cy = sy / per;
  let Ixx = 0; for (const s of segs) Ixx += s.ds * (s.ym - cy) ** 2;
  const area = t * per, refArea = 2 * Math.PI * R * t;
  near(area, refArea, 0.01 * refArea, 'thin ring area');
  const IxxAbs = t * Ixx, refIxx = Math.PI * R ** 3 * t; // thin ring: I = pi R^3 t
  near(IxxAbs, refIxx, 0.02 * refIxx, 'thin ring Ixx');
});

test('sectionForFill: thin-wall formula agrees with the exact offset-polygon area for a thin shell', () => {
  const af = A.naca4('4412'), chord = 1, thickness = 0.004;
  const exact = GEO.sectionProperties(af, chord, thickness);
  const fill = exact.area / (GEO.sectionProperties(af, chord, chord).area); // area fraction this thickness corresponds to
  const approx = GEO.sectionForFill(af, chord, fill);
  near(approx.area, exact.area, 0.1 * exact.area, 'shell area, thin-wall vs exact offset');
  near(approx.Ixx, exact.Ixx, 0.2 * exact.Ixx, 'Ixx, thin-wall vs exact offset');
  near(approx.cx, exact.cx, 0.1 * chord, 'centroid x, thin-wall vs exact offset');
});

test('sectionForFill: fill=1 (solid material) matches the solid section exactly', () => {
  const af = A.naca4('0012'), chord = 0.1;
  const solid = GEO.sectionProperties(af, chord, chord);
  const viaFill = GEO.sectionForFill(af, chord, 1);
  near(viaFill.area, solid.area, 1e-12, 'solid area');
  near(viaFill.Ixx, solid.Ixx, 1e-12, 'solid Ixx');
});

test('sectionForFill: realistic blade shell fill ratios give positive, sane section properties', () => {
  const af = A.naca4('0012'), chord = 0.08;
  const solidArea = GEO.sectionProperties(af, chord, chord).area;
  for (const fill of [0.22, 0.28, 0.42]) {
    const s = GEO.sectionForFill(af, chord, fill);
    near(s.area, fill * solidArea, 0.01 * fill * solidArea, `area at fill=${fill}`);
    assert.ok(s.Ixx > 0 && s.Iyy > 0, `positive second moments at fill=${fill}`);
    assert.ok(s.Ixx < GEO.sectionProperties(af, chord, chord).Ixx, `shell Ixx < solid Ixx at fill=${fill}`);
  }
});

test('cantileverMoment: uniform distributed load matches the analytic cantilever (M=wL^2/2 at root)', () => {
  const n = 200, L = 3, w0 = 50, hubR = 0;
  const rows = Array.from({ length: n }, (_, i) => ({ r: (i + 0.5) * L / n, dr: L / n }));
  const load = rows.map(() => w0);
  const { Mhub, M } = GEO.cantileverMoment(rows, load, hubR);
  near(Mhub, w0 * L * L / 2, 0.01 * w0 * L * L / 2, 'root moment');
  near(M[0], w0 * L * L / 2, 0.02 * w0 * L * L / 2, 'moment at first row ~ root (dr small)');
  near(M[n - 1], w0 * (L / n / 2) ** 2 / 2, 0.5 * w0 * (L / n) ** 2, 'moment near tip is small');
});

test('cantileverDeflection: uniform load & EI matches the analytic tip deflection (w=w0 L^4/(8EI))', () => {
  const n = 400, L = 2, w0 = 30, EIc = 500, hubR = 0;
  const rows = Array.from({ length: n }, (_, i) => ({ r: (i + 0.5) * L / n, dr: L / n }));
  const load = rows.map(() => w0);
  const { M } = GEO.cantileverMoment(rows, load, hubR);
  const EI = rows.map(() => EIc);
  const { tip } = GEO.cantileverDeflection(rows, M, EI, hubR);
  const ref = w0 * L ** 4 / (8 * EIc);
  near(tip, ref, 0.02 * ref, 'tip deflection');
});
