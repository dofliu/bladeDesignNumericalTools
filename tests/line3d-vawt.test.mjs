// 9-8 交叉檢查:以三維線葉片的逐截面向量負載描述 H 型 / 螺旋 Darrieus,
// 在不計誘導(u = 1)下與 DMST 比對;並量化 vawtSlices 對螺旋葉片漏算 θ′(z) 的影響。
// 風向 +X、主軸 +Z(與 line3d 的軸向來流慣例不同,故直接呼叫 sectionLoad3D 並自建截面軸)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/aero.mjs';
import * as L from '../src/line3d.mjs';

const rho = 1.225, mu = 1.81e-5, V = 8, R = 1, H = 2, B = 3, c = 0.005;
const AR = Math.max(2, H / c), arF = AR / (AR + 1.8), kInd = 1 / (Math.PI * AR * 0.85);
const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));

// 把 DMST 用的極曲線(含其有限展弦比修正 arF、kInd)取樣成嚴格極曲線,兩邊用同一組係數
function polarFromAero() {
  const alphas = []; for (let a = -40; a <= 40; a += 1) alphas.push(a);
  const layers = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5].map(Re => ({
    Re, points: alphas.map(a => { const [cl, cd] = A.lookup(ps, a * A.D2R, Re); return { alpha_deg: a, cl: cl * arF, cd: cd + kInd * cl * cl * arF * arF, cm: 0, valid: true, sources: ['aero'] }; })
  }));
  return L.parsePolarV1({ schema: L.POLAR_SCHEMA, supportWindow: { alpha_deg: [-40, 40], Re: [1e3, 1e5] }, profiles: [{ profileId: 'n0018', layers }] });
}
const polar = polarFromAero();
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(...a); return a.map(v => v / n); };

// 方位 phi(葉片位置角)處、高度 z 的截面;theta' = 螺旋扭轉率(rad / R 高度)
function section(phi, z, lam, dTheta = 0) {
  const x = [Math.cos(phi), Math.sin(phi), z];
  const dx = [-dTheta * Math.sin(phi), dTheta * Math.cos(phi), 1]; // d x / d z
  const span = unit(dx);
  const tan = [-Math.sin(phi), Math.cos(phi), 0];
  const k = tan[0] * span[0] + tan[1] * span[1] + tan[2] * span[2];
  const chord = unit(tan.map((v, i) => -(v - k * span[i]))); // 前緣→後緣,β = 0:弦線沿運動切向
  const vb = [-lam * Math.sin(phi), lam * Math.cos(phi), 0]; // 葉片速度 / U∞;相對風 = 風 − 葉片速度
  const W = [1 - vb[0], -vb[1], 0];
  const r = L.sectionLoad3D({ x, span, chord, upper: cross(span, chord), c, W, polar, profile: 'n0018', ReR: rho * V * R / mu, mirror: false });
  return { r, J: Math.hypot(...dx) };
}
function torqueCoef(lam, dTheta = 0, nz = 1) { // Q / (0.5 ρ V² R² · R ) 的疊加:回傳每片葉片平均扭矩(N·m)
  const nPhi = 72; let sum = 0, bad = 0;
  for (let i = 0; i < nPhi; i++) for (let k = 0; k < nz; k++) {
    const phi = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / nPhi, z = ((k + 0.5) / nz - 0.5) * H;
    const { r, J } = section(phi, z, lam, dTheta);
    if (!Number.isFinite(r.qForce)) { bad++; continue; }
    sum += r.qForce * J * (H / nz);
  }
  assert.equal(bad, 0, '截面皆應落在極曲線支撐域內');
  return 0.5 * rho * V * V * R * R * sum / nPhi;
}

test('9-8 H 型:三維線截面扭矩與 DMST(u=1 極限)一致', () => {
  const cfg = { type: 'H', R, H, B, c, pitch: 0, nz: 1, polar: ps, rho, mu };
  for (const lam of [2.5, 3.5, 5]) {
    const q3 = B * torqueCoef(lam);
    // 低實度(Bc/R = 0.015)下誘導 u≈1;差異來自殘餘誘導(c 減半、差異約降為 1/3.5:λ5 由 4.4% 到 1.3%)
    const d = A.dmstPoint(cfg, V, lam).Q;
    assert.ok(Math.abs(q3 - d) <= 0.02 * Math.abs(d) + 1e-4, `λ ${lam}:3D ${q3.toFixed(4)} vs DMST ${d.toFixed(4)}`);
  }
});

test('9-8 H 型直葉片的中心線與主軸平行,lineFrame 回報退化(說明為何不能用軸向來流慣例)', () => {
  const fr = L.lineFrame([0, 0, 1]);
  assert.equal(fr.ok, false);
});

test('9-8 螺旋葉片:vawtSlices 漏算 θ′(z) 的影響量化(葉片傾斜 δ_θ = atan(r θ′))', () => {
  const lam = 3.5, helix = 60 * A.D2R, dTheta = helix / H;
  const sl = A.vawtSlices({ type: 'helical', R, H, nz: 10, helix: 60 });
  assert.equal(sl[0].delta, 0, 'vawtSlices 對螺旋葉片的 delta 為 0(只含 dr/dz)');
  const tilt = Math.atan(R * dTheta);
  const q3 = B * torqueCoef(lam, dTheta, 10);
  const cfg = { type: 'helical', helix: 60, R, H, B, c, pitch: 0, nz: 10, polar: ps, rho, mu };
  const d = A.dmstPoint(cfg, V, lam).Q;
  const rel = (d - q3) / Math.abs(q3);
  console.log(`螺旋 60°:葉片傾斜 ${(tilt * A.R2D).toFixed(1)}°,3D Q ${q3.toFixed(4)}、DMST Q ${d.toFixed(4)},DMST 相對 3D ${(rel * 100).toFixed(1)}%`);
  assert.ok(Number.isFinite(rel));
});
