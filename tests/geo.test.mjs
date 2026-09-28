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

test('beamResponse: uniform cantilever under constant distributed load matches the closed-form solution', () => {
  // Constant EI, constant load per length w over length L: classic cantilever results are
  // M(root) = w*L^2/2 and tip deflection = w*L^4/(8*EI). Use many equal-width stations so the
  // discrete lumped-load / trapezoidal-integration scheme converges to the continuous beam.
  const n = 400, L = 3, dr = L / n, w = 12, E = 20e9, Ixx = 4e-6;
  const rows = [], secs = [], load = [];
  for (let i = 0; i < n; i++) {
    rows.push({ r: (i + 0.5) * dr, dr });
    secs.push({ Ixx, Iyy: Ixx, area: 1e-3 });
    load.push({ qN: w, qT: 0 });
  }
  const beam = GEO.beamResponse(rows, secs, E, load, 0, 0);
  const Mroot = w * L * L / 2, tipRef = w * Math.pow(L, 4) / (8 * E * Ixx);
  near(beam.Mflap[0], Mroot, 0.01 * Mroot, 'root bending moment');
  near(beam.tipFlap, tipRef, 0.02 * tipRef, 'tip deflection');
  near(beam.Naxial[0], 0, 1e-9, 'no centrifugal force at omega=0');
});

test('beamResponse: centrifugal axial force at the root matches the analytic rotating-rod tension', () => {
  // Constant linear mass mu over [0,L] spun at omega: axial force at the root of a rotating
  // cantilever rod is N(0) = mu*omega^2*L^2/2 (no aerodynamic loads here).
  const n = 300, L = 1.5, dr = L / n, area = 2e-3, rhoMat = 1800, omega = 40;
  const rows = [], secs = [], load = [];
  for (let i = 0; i < n; i++) { rows.push({ r: (i + 0.5) * dr, dr }); secs.push({ Ixx: 1e-6, Iyy: 1e-6, area }); load.push({ qN: 0, qT: 0 }); }
  const beam = GEO.beamResponse(rows, secs, 20e9, load, rhoMat, omega);
  const mu = rhoMat * area, Nroot = mu * omega * omega * L * L / 2;
  near(beam.Naxial[0], Nroot, 0.01 * Nroot, 'root centrifugal axial force');
});
