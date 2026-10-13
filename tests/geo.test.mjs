// Regression tests for the blade cross-section property helpers in src/geo.mjs
// (polygon area/centroid/inertia integration + thin-shell offset), checked against
// closed-form analytic shapes and one literature constant for a real airfoil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as GEO from '../src/geo.mjs';
import * as A from '../src/aero.mjs';

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

test('sectionProperties: yMax/xMax bound the profile (flatwise/edgewise extreme fibre)', () => {
  const af = A.naca4('4412'), chord = 1.3, thickness = 0.006;
  const s = GEO.sectionProperties(af, chord, thickness);
  const pts = GEO.loop(af);
  let yb = 0, xb = 0;
  for (const [x, y] of pts) { yb = Math.max(yb, Math.abs(y * chord - s.cy)); xb = Math.max(xb, Math.abs(x * chord - s.cx)); }
  near(s.yMax, yb, 1e-9, 'yMax matches the outer-loop extreme fibre');
  near(s.xMax, xb, 1e-9, 'xMax matches the outer-loop extreme fibre');
});

test('equivalentThickness: round-trips through sectionProperties area (fill-based wall thickness)', () => {
  const af = A.naca4('4412'), chord = 0.9, fill = 0.3;
  const targetArea = fill * A.airfoilArea(af) * chord * chord;
  const t = GEO.equivalentThickness(af, chord, targetArea);
  const area = GEO.sectionProperties(af, chord, t).area;
  near(area, targetArea, 0.01 * targetArea, 'solved thickness reproduces the target area');
  assert.ok(t > 0 && t < chord, 'thickness within a sane range');
});

test('beamDeflection: uniform distributed load matches the analytic cantilever (w L^4/8EI)', () => {
  const L = 3, n = 400, w0 = 50, EI0 = 1200;
  const rows = Array.from({ length: n }, (_, i) => ({ r: L * i / (n - 1) }));
  const M = rows.map(row => w0 * (L - row.r) ** 2 / 2), EI = rows.map(() => EI0);
  const v = GEO.beamDeflection(rows, M, EI);
  near(v[0], 0, 1e-9, 'root deflection is fixed at 0');
  near(v[n - 1], w0 * L ** 4 / (8 * EI0), 0.02 * w0 * L ** 4 / (8 * EI0), 'tip deflection');
});

test('beamDeflection: tip point load matches the analytic cantilever (P L^3/3EI)', () => {
  const L = 3, n = 400, P = 20, EI0 = 1200;
  const rows = Array.from({ length: n }, (_, i) => ({ r: L * i / (n - 1) }));
  const M = rows.map(row => P * (L - row.r)), EI = rows.map(() => EI0);
  const v = GEO.beamDeflection(rows, M, EI);
  near(v[n - 1], P * L ** 3 / (3 * EI0), 0.02 * P * L ** 3 / (3 * EI0), 'tip deflection');
});

test('rainflow: ASTM E1049 example history', () => {
  const c = GEO.rainflow([-2, 1, -3, 5, -1, 3, -4, 4, -2]);
  const byRange = {};
  for (const x of c) byRange[x.range] = (byRange[x.range] || 0) + x.count;
  assert.deepEqual(byRange, { 3: 0.5, 4: 1.5, 6: 0.5, 8: 1, 9: 0.5 });
});

test('rainflow: sine wave gives one full cycle per period at range 2a', () => {
  const a = 3, n = 20, s = [];
  for (let i = 0; i <= n * 40; i++) s.push(5 + a * Math.sin(2 * Math.PI * i / 40));
  // ASTM three-point counting records constant-amplitude history as paired half cycles
  const c = GEO.rainflow(s).filter(x => Math.abs(x.range - 2 * a) < 1e-9);
  near(c.reduce((t, x) => t + x.count, 0), n, 0.5, 'cycles at range 2a');
  for (const x of c) near(x.mean, 5, 1e-9, 'mean');
});

test('minerDamage / equivalentRange: constant amplitude closed form', () => {
  const su = 100, m = 10, cycles = [{ range: 40, mean: 0, count: 1000 }];
  near(GEO.minerDamage(cycles, su, m), 1000 * (20 / 100) ** 10, 1e-12, 'zero-mean damage');
  near(GEO.minerDamage([{ range: 40, mean: 50, count: 1000 }], su, m), 1000 * (40 / 100) ** 10, 1e-9, 'Goodman mean correction');
  near(GEO.equivalentRange(cycles, m, 1000), 40, 1e-9, 'equivalent range at the same cycle count');
  assert.equal(GEO.minerDamage([{ range: 10, mean: 120, count: 1 }], su, m), Infinity, 'mean above ultimate fails');
});

test('customBladeShape + vawtBlade: sphere envelope lofts to the expected bounding box and matches AERO slice radii', () => {
  const R = 1, H = 2, af = A.naca4('0018');
  const pts = []; for (let i = 0; i <= 20; i++) { const zf = i / 20, s = 2 * zf - 1; pts.push({ zf, r: R * Math.sqrt(Math.max(0, 1 - s * s)) }); }
  const shape = A.customShape({ pts, H });
  const f = GEO.customBladeShape(shape, 0);
  near(f(0.5).r, R, 1e-3, 'equator radius');
  near(f(0.5).off, 0, 1e-12, 'no twist');
  near(f(0).r, 0.06 * shape.rMax, 1e-9, 'pole radius clamped like vawtSlices');
  const sl = A.vawtSlices({ type: 'custom', pts, H, R, nz: 10 });
  sl.forEach(s => near(f(s.zf).r, s.r, 1e-9, 'radius at zf ' + s.zf));
  const g = GEO.customBladeShape(shape, 90);
  near(g(1).off, Math.PI / 2, 1e-12, 'linear helix offset');
  const mesh = GEO.vawtBlade(f, af, 0.15, 0, 0, H, 0), P = mesh.pos;
  let ymin = Infinity, ymax = -Infinity, rmax = 0;
  for (let i = 0; i < P.length; i += 3) { ymin = Math.min(ymin, P[i + 1]); ymax = Math.max(ymax, P[i + 1]); rmax = Math.max(rmax, Math.hypot(P[i], P[i + 2])); }
  near(ymin, 0, 1e-6, 'bottom'); near(ymax, H, 1e-6, 'top');
  near(rmax, R, 0.1, 'max radius incl. half chord');
});

function edgeStats(mesh) {
  const m = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  // weld vertices by position (corners are not shared between strips only by index, so use coordinates)
  const id = new Map(), rep = i => { const k = [0, 1, 2].map(j => mesh.pos[i * 3 + j].toFixed(6)).join(); if (!id.has(k)) id.set(k, id.size); return id.get(k); };
  for (let t = 0; t < mesh.idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const k = key(rep(mesh.idx[t + e]), rep(mesh.idx[t + (e + 1) % 3])); m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.values()];
}

test('archimedeanBlade: closed manifold, envelope and axial length match parameters', () => {
  const o = { D: 0.8, L: 1.0, blades: 3, turns: 0.75, thick: 0.004, hubD: 0.06, nz: 64 };
  const mesh = GEO.archimedeanBlade(o);
  assert.ok(edgeStats(mesh).every(c => c === 2), 'every edge shared by exactly two triangles');
  let rMax = 0, zMin = 1e9, zMax = -1e9;
  for (let i = 0; i < mesh.pos.length; i += 3) { rMax = Math.max(rMax, Math.hypot(mesh.pos[i], mesh.pos[i + 1])); zMin = Math.min(zMin, mesh.pos[i + 2]); zMax = Math.max(zMax, mesh.pos[i + 2]); }
  near(rMax, Math.hypot(0.4, 0.002), 1e-4, 'outer radius');
  near(zMax - zMin, 1.0, 1e-6, 'axial length');
  near(GEO.archimedeanSweptArea(o), Math.PI * 0.16, 1e-12, 'swept area');
  assert.ok(GEO.stl(mesh, 'arch').includes('facet normal'));
});

test('archimedeanBlade: cone taper shrinks tip radius and blade count scales mesh', () => {
  const m1 = GEO.archimedeanBlade({ blades: 1, nz: 16 }), m3 = GEO.archimedeanBlade({ blades: 3, nz: 16 });
  assert.equal(m3.idx.length, 3 * m1.idx.length);
  const c = GEO.archimedeanBlade({ D: 1, L: 1, tipFrac: 0.4, blades: 1, nz: 16 });
  let rTop = 0; for (let i = 0; i < c.pos.length; i += 3) if (c.pos[i + 2] > 0.999) rTop = Math.max(rTop, Math.hypot(c.pos[i], c.pos[i + 1]));
  near(rTop, 0.2, 0.01, 'tip radius');
});
