// Regression tests for GEO.bladeStructural (flapwise bending + centrifugal axial load along a
// HAWT blade), checked against closed-form cantilever-beam / centrifugal-integral analytic
// solutions rather than against the app's own BEM output (so these don't just re-derive the same
// numbers the implementation computes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GEO = require('../src/geo.js');
const A = require('../src/aero.js');

const near = (v, ref, tol, msg) => assert.ok(Math.abs(v - ref) <= tol, `${msg}: ${v} vs ${ref} ±${tol}`);

test('bladeStructural: uniform flapwise load matches cantilever beam analytic root moment + tip deflection', () => {
  const L = 3, n = 300, dr = L / n;
  const af = A.naca4('0012');
  const rows = [], desElems = [];
  for (let i = 0; i < n; i++) {
    rows.push({ r: (i + 0.5) * dr, dr, c: 1 });
    desElems.push({ phi: 0, cl: 2, cd: 0, W: 1 }); // fN = 0.5*rhoAir*W^2*c*cn = 0.5*1*1*1*2 = 1 N/m
  }
  const afs = rows.map(() => af);
  const mat = { rho: 1, fill: 1, E: 5e9, sigmaAllow: 1e12 };
  const w = 1, omega = 0; // omega=0 drops the centrifugal term, isolating the bending check
  const res = GEO.bladeStructural(rows, afs, desElems, mat, omega, 1, 0);
  near(res.rootM, w * L * L / 2, 0.01 * w * L * L / 2, 'root bending moment vs w*L^2/2');
  const sec = GEO.polygonMoments(GEO.loop(af)); // chord = 1, so this is already Ixx/c^4
  const cy = sec.Mx / sec.area, Ixx = sec.Ixx - sec.area * cy * cy;
  const tipRef = w * L ** 4 / (8 * mat.E * mat.fill * Ixx); // uniform load, constant EI cantilever
  near(res.tipDeflection, tipRef, 0.02 * tipRef, 'tip deflection vs w*L^4/(8EI)');
});

test('bladeStructural: centrifugal axial force matches the analytic integral for uniform mass per length', () => {
  const Rhub = 0.2, R = 1.5, n = 400, dr = (R - Rhub) / n;
  const af = A.naca4('0012');
  const sec = GEO.polygonMoments(GEO.loop(af)); // chord = 1, area already in m^2/c^2 units
  const rows = [], desElems = [];
  for (let i = 0; i < n; i++) {
    rows.push({ r: Rhub + (i + 0.5) * dr, dr, c: 1 });
    desElems.push({ phi: 0, cl: 0, cd: 0, W: 0 }); // fN = 0, isolating the centrifugal term from bending
  }
  const afs = rows.map(() => af);
  const mat = { rho: 1 / sec.area, fill: 1, E: 1e9, sigmaAllow: 1e12 }; // dm/dr = rho*fill*area*c^2 = 1 kg/m
  const omega = 2;
  const res = GEO.bladeStructural(rows, afs, desElems, mat, omega, 1, Rhub);
  const ref = omega * omega * (R * R - Rhub * Rhub) / 2; // integral of m'*omega^2*r dr, m'=1 kg/m
  near(res.rootN, ref, 0.01 * ref, 'root axial (centrifugal) force vs omega^2*(R^2-Rhub^2)/2');
});
