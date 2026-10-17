// 通用三維線葉片(src/line3d.mjs)對照回翼閉合葉片交接 fixture(tests/fixtures/line3d,來源與雜湊見 README.md)。
// 門檻沿用交接文件:站點 rtol/atol 1e-10(localRe atol 1e-6)、321 節點部分 CQ 絕對差 ≤ 1e-10;不可放寬。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/line3d.mjs';

const fx = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/line3d');
const polar = L.parsePolarV1(readFileSync(join(fx, 'polar_v1.json'), 'utf8'));
function csv(name, strCols = []) {
  const [head, ...rows] = readFileSync(join(fx, name), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map(line => {
    const v = line.split(','), o = {};
    cols.forEach((c, i) => {
      const t = v[i];
      if (strCols.includes(c)) o[c] = t; // profile 一律字串,否則 "2412" 會被當數字而查不到
      else if (t === '' || t === 'nan' || t === 'NaN') o[c] = NaN;
      else if (t === 'True' || t === 'False') o[c] = t === 'True';
      else if (t === 'inf') o[c] = Infinity;
      else o[c] = Number.isNaN(Number(t)) ? t : Number(t);
    });
    return o;
  });
}
const close = (a, b, rtol, atol) => (Number.isNaN(a) && Number.isNaN(b)) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= atol + rtol * Math.abs(b));
const VARIANT = { mesh0012: { profile: 'baseline_mesh', mirror: false }, '2412_mirrored': { profile: '2412', mirror: true } };
const ReR = 800000;
const branchDef = (branch, variant) => L.returnWingBranch(branch, VARIANT[variant]);

test('parsePolarV1:2 翼型 × 5 Re 層 × 17 攻角,169 有效、1 缺點保留', () => {
  let n = 0, valid = 0;
  for (const p of polar.profiles.values()) for (const l of p.layers) for (const q of l.pts.values()) { n++; if (q.valid) valid++; }
  assert.equal(n, 170); assert.equal(valid, 169);
  assert.ok(polar.profiles.has('2412'), 'profileId 為字串');
  const hole = polar.profiles.get('2412').layers.find(l => l.Re === 550000).pts.get(-3);
  assert.equal(hole.valid, false); assert.ok(Number.isNaN(hole.cl));
  assert.throws(() => L.parsePolarV1({ schema: 'other' }));
});

test('lookupPolar:18 個防護案例狀態逐項一致', () => {
  const G = csv('interpolation_guard_challenges.csv', ['profile', 'test', 'expected_status']);
  assert.equal(G.length, 18);
  for (const g of G) assert.equal(L.lookupPolar(polar, g.profile, g.alpha, g.Re, { mirror: g.mirror }).status, g.expected_status, g.test);
  assert.equal(L.lookupPolar(polar, 'naca9999', 0, 2e5).status, 'unknown_profile');
});

test('lookupPolar:鏡射 = 以 −α 查原表,CL 與 CM 變號、CD 不變;不墊 Cd', () => {
  const o = L.lookupPolar(polar, '2412', -2.4, 3e5), m = L.lookupPolar(polar, '2412', 2.4, 3e5, { mirror: true });
  assert.equal(m.cl, -o.cl); assert.equal(m.cd, o.cd); assert.equal(m.cm, -o.cm);
  let minCd = Infinity;
  for (const p of polar.profiles.values()) for (const l of p.layers) for (const q of l.pts.values()) if (q.valid) minCd = Math.min(minCd, q.cd);
  const raw = [...polar.profiles.values()].flatMap(p => p.layers.flatMap(l => [...l.pts.entries()].filter(([, q]) => q.cd === minCd).map(([al]) => ({ id: p.id, Re: l.Re, al }))))[0];
  assert.equal(L.lookupPolar(polar, raw.id, raw.al, raw.Re).cd, minCd, '原始 Cd 原值回傳');
});

test('站點:96 列向量、攻角、localRe、係數與扭矩貢獻符合 fixture', () => {
  const N = csv('stations.csv', ['variant', 'branch', 'status']);
  assert.equal(N.length, 96);
  const cols = { jacobian: 'J', alpha_deg: 'alpha', Re: 'Re', chord_R: 'c', speed_U: 'speed', cl: 'cl', cd: 'cd', cm: 'cm', q_force: 'qForce', q_Cm: 'qCm', q_total: 'qTotal' };
  const vec = { x: 'x', span: 'span', W: 'W', Wperp: 'wperp', F: 'F', M: 'M' };
  let bad = [];
  for (const r of N) {
    const st = L.lineStation(branchDef(r.branch, r.variant), r.s, { lam: r.tsr, a: r.a, polar, ReR });
    if (st.status !== r.status) bad.push(`status ${r.branch} s${r.s}: ${st.status} vs ${r.status}`);
    for (const [c, k] of Object.entries(cols)) if (!close(st[k], r[c], 1e-10, c === 'Re' ? 1e-6 : 1e-10)) bad.push(`${c} ${r.variant} ${r.branch} λ${r.tsr} a${r.a} s${r.s}: ${st[k]} vs ${r[c]}`);
    for (const [p, k] of Object.entries(vec)) 'xyz'.split('').forEach((ax, i) => { if (!close(st[k][i], r[p + '_' + ax], 1e-10, 1e-10)) bad.push(`${p}_${ax} ${r.branch} s${r.s}: ${st[k][i]} vs ${r[p + '_' + ax]}`); });
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test('321 節點部分 CQ:32 組(兩種負載)絕對差 ≤ 1e-10,完整窗缺失一致', () => {
  const Q = csv('partial_coefficients.csv', ['variant', 'load']).filter(r => r.nodes === 321);
  assert.equal(Q.length, 32);
  const s = L.linspace(0.1, 0.9, 321);
  for (const r of Q) {
    const load = r.load === 'force' ? 'force' : 'total';
    const res = [['Work', r.a_work], ['Return', r.a_return]].map(([br, a]) => L.integrateLine(branchDef(br, r.variant), { lam: r.tsr, a, polar, ReR }, { s, load }));
    const cq = L.partialCQ(res.map(x => x.I_full), 2);
    const tag = `${r.variant} ${r.load} λ${r.tsr} a${r.a_work}/${r.a_return}`;
    if (Number.isNaN(r.partial_CQ)) assert.equal(cq, null, tag);
    else assert.ok(Math.abs(cq - r.partial_CQ) <= 1e-10, `${tag}: ${cq} vs ${r.partial_CQ}`);
    const cov = Math.min(...res.map(x => x.coverage));
    assert.ok(Math.abs(cov - r.min_branch_probe_coverage) <= 1e-9, `${tag} coverage ${cov} vs ${r.min_branch_probe_coverage}`);
    if (cq === null) {
      const gap = res.flatMap(x => x.unsupportedIntervals);
      assert.ok(gap.length > 0 && gap.every(g => g.reasons.includes('outside_alpha')), `${tag} 缺口原因為攻角越界`);
    }
  }
});

test('四分之一弦移矩:改作用點後總扭矩不變;180° 複製扭矩相同', () => {
  const op = { lam: 6, a: 0, polar, ReR };
  const st = L.lineStation(branchDef('Work', '2412_mirrored'), 0.5, op);
  const P = [0.1, -0.2, 0.3], rq = st.x, d = [rq[0] - P[0], rq[1] - P[1], rq[2] - P[2]];
  const F = st.F, cr = [d[1] * F[2] - d[2] * F[1], d[2] * F[0] - d[0] * F[2], d[0] * F[1] - d[1] * F[0]];
  const MP = st.M.map((m, i) => m + cr[i]);
  const tq = P[0] * F[1] - P[1] * F[0] + MP[2];
  assert.ok(Math.abs(tq - st.qTotal) < 1e-14);
  const s2 = L.lineStation(L.returnWingBranch('Work', { ...VARIANT['2412_mirrored'], j: 1 }), 0.5, op);
  assert.ok(Math.abs(s2.qTotal - st.qTotal) < 1e-14);
});

test('框架與零速度防護:span 平行主軸、相對速度為 0 時回報狀態而非數值', () => {
  assert.equal(L.lineFrame([0, 0, 1]).ok, false);
  const def = { x: s => [0, 0, s], chord: () => 0.1, beta: () => 0, profile: '2412' };
  assert.equal(L.lineStation(def, 0.5, { lam: 1, polar, ReR }).status, 'degenerate_frame');
  const fr = L.lineFrame([1, 0, 0]), ax = L.sectionAxes(fr, 0);
  assert.equal(L.sectionLoad3D({ x: [0, 0, 0], span: fr.span, chord: ax.chord, upper: ax.upper, c: 0.1, W: [1, 0, 0], polar, profile: '2412', ReR }).status, 'zero_speed');
});
