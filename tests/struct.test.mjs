// Regression test for computeBladeLoads() (src/core.js) against a closed-form cantilever-beam
// solution. Bypasses the BEM design pipeline and feeds synthetic G.rows/afs/desElems directly so
// the load distribution is an exact constant (uniformly distributed flapwise load, no centrifugal
// term), which has a known analytic root moment and tip deflection for a cantilever beam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
global.AERO = require('../src/aero.js');
global.GEO = require('../src/geo.js');
const core = require('../src/core.js');
const { S, G, air, computeBladeLoads } = core;

test('computeBladeLoads: uniform flapwise load matches cantilever-beam closed form', () => {
  S.mode = 'HAWT';
  const material = 'alu';
  S.hawt = { ...S.hawt, material, Vd: 0, tsr: 7 }; // Vd=0 -> zero rotor speed -> no centrifugal term
  const af = core.A.naca4('0012'), Rh = 0.1, R = 1.0, L = R - Rh, n = 200, c = 0.05, W = 10, w = 5; // N/m, constant
  const { rho } = air();
  const cl = w / (0.5 * rho * W * W * c); // pick cl so q*c*cl == w exactly (cd=0, phi=0 -> cn=cl, ct=0)
  const rows = [], afs = [], elems = [];
  for (let i = 0; i < n; i++) {
    const r = Rh + (i + 0.5) * L / n;
    rows.push({ r, c, dr: L / n });
    afs.push(af);
    elems.push({ phi: 0, cl, cd: 0, W });
  }
  Object.assign(G, { rows, afs, desElems: elems, R, Rhub: Rh });
  computeBladeLoads();
  const st = G.struct;
  assert.ok(st, 'G.struct populated');
  const Ixx0 = st.Ixx[0];
  for (const v of st.Ixx) assert.ok(Math.abs(v - Ixx0) < 1e-12 * Math.max(1, Ixx0), 'Ixx constant across identical stations');
  const E = core.MATERIALS[material].E;
  const mRef = w * L * L / 2, defRef = w * L ** 4 / (8 * E * Ixx0);
  assert.ok(Math.abs(st.root.Mflap - mRef) / mRef < 0.01, `root flap moment ${st.root.Mflap} vs ${mRef}`);
  assert.ok(Math.abs(st.root.Medge) < 1e-6, 'edge moment ~0 (ct=0 by construction)');
  assert.ok(Math.abs(st.root.Nax) < 1e-9, 'axial force ~0 (Vd=0 -> no centrifugal term)');
  assert.ok(Math.abs(st.tipDeflFlap - defRef) / defRef < 0.02, `tip flap deflection ${st.tipDeflFlap} vs ${defRef}`);
});

test('computeBladeLoads: VAWT mode / missing design data leaves G.struct null', () => {
  S.mode = 'VAWT';
  computeBladeLoads();
  assert.equal(G.struct, null);
});

test('computeBladeLoads: default HAWT design stays numerically sane for every blade material', () => {
  // Regression for a solveShellThickness edge case: near fill=1 (solid section, e.g. wood) a
  // float-precision hair below the solid area used to fall through to a self-intersecting
  // offset polygon whose shoelace sums gave a negative Iyy -> a several-order-of-magnitude
  // stress spike. Covers every material so a similar regression at any fill fraction is caught.
  S.mode = 'HAWT';
  for (const material of Object.keys(core.MATERIALS)) {
    S.hawt = { ...S.hawt, material };
    core.designHAWT();
    const st = G.struct;
    assert.ok(st, `G.struct populated for ${material}`);
    for (const arr of [st.area, st.Ixx, st.Iyy]) for (const v of arr) assert.ok(v > 0, `${material}: positive section property`);
    for (const v of st.sigma) assert.ok(isFinite(v) && v >= 0, `${material}: finite non-negative stress`);
    assert.ok(isFinite(st.tipDeflFlap) && isFinite(st.tipDeflEdge), `${material}: finite tip deflection`);
    assert.ok(st.minSF > 0 && isFinite(st.minSF), `${material}: finite positive safety factor`);
  }
});
