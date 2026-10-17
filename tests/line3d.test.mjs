// 通用三維線葉片(src/line3d.mjs)對照回翼閉合葉片交接 fixture(tests/fixtures/line3d,來源與雜湊見 README.md)。
// 門檻沿用交接文件:站點 rtol/atol 1e-10(localRe atol 1e-6)、321 節點部分 CQ 絕對差 ≤ 1e-10;不可放寬。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/line3d.mjs';

const fx = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/line3d');
const polar = L.parsePolarV1(readFileSync(join(fx, '../../../examples/return-wing/polar_v1.json'), 'utf8'));
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

test('輸入防護:零弦長恰為 0、負弦長與 NaN 誘導不當成數值、無效積分網格回 null', () => {
  const base = L.returnWingBranch('Work', VARIANT['2412_mirrored']), op = { lam: 6, a: 0, polar, ReR };
  const zero = L.lineStation({ ...base, chord: () => 0 }, 0.5, op);
  assert.equal(zero.status, 'zero_chord'); assert.equal(zero.qTotal, 0);
  assert.equal(L.lineStation({ ...base, chord: () => -0.1 }, 0.5, op).status, 'invalid_chord');
  const nan = L.lineStation(base, 0.5, { ...op, a: NaN });
  assert.equal(nan.status, 'nonfinite_wind'); assert.ok(Number.isNaN(nan.qTotal));
  for (const s of [[0.5], [], [0.1, 0.1], [0.5, 0.2], [0.1, NaN]]) {
    const r = L.integrateLine(base, op, { s });
    assert.equal(r.I_full, null); assert.equal(r.status, 'invalid_grid');
  }
  assert.equal(L.partialCQ([L.integrateLine(base, op, { n: 1 }).I_full], 2), null);
});

test('差分切線:給 domain 時端點用單側差分、不會在定義域外取值', () => {
  const ref = L.returnWingBranch('Work', VARIANT['2412_mirrored']);
  const guarded = { ...ref, dx: undefined, domain: [0.1, 0.9], x: s => { if (s < 0.1 || s > 0.9) throw new Error('out of domain ' + s); return ref.x(s); } };
  const op = { lam: 6, a: 0, polar, ReR };
  for (const s of [0.1, 0.5, 0.9]) {
    const a = L.lineStation(guarded, s, op), b = L.lineStation(ref, s, op);
    assert.ok(Math.abs(a.J - b.J) < 1e-5, `J @${s}`); assert.ok(Math.abs(a.qTotal - b.qTotal) < 1e-5, `q @${s}`);
  }
  const r = L.integrateLine(guarded, op, { s0: 0.1, s1: 0.9, n: 161, load: 'total' }), r0 = L.integrateLine(ref, op, { s0: 0.1, s1: 0.9, n: 161, load: 'total' });
  assert.ok(Math.abs(r.I_full - r0.I_full) < 1e-6);
});

/* ---------- 葉片定義檔(blade-line3d-v1) ---------- */
const exDir = join(fx, '../../../examples/return-wing');
const exBlade = () => L.parseBladeV1(readFileSync(join(exDir, 'blade_v02_candidate146.json'), 'utf8'));

test('葉片定義範例檔:與函式版重新取樣的結果一致(檔案未過期)', () => {
  const defs = ['Work', 'Return'].map(b => L.returnWingBranch(b, { profile: '2412', mirror: true }));
  const re = L.parseBladeV1(L.sampleBladeV1(defs, { name: 'x', s0: 0.1, s1: 0.9, n: 65, copies: 2 }));
  const ex = exBlade();
  assert.equal(ex.copies, 2); assert.deepEqual(ex.window, [0.1, 0.9]);
  assert.deepEqual(ex.branches.map(b => b.stations), re.branches.map(b => b.stations));
  assert.deepEqual(L.parseBladeV1(L.bladeToJSON(ex)), ex, 'bladeToJSON 往返不變');
});

test('葉片定義範例檔:32 組 321 節點部分 CQ 與 fixture 差 < 1e-6(樣條內插誤差),缺值位置一致', () => {
  const blade = exBlade(), Q = csv('partial_coefficients.csv', ['variant', 'load']).filter(r => r.nodes === 321);
  let worst = 0;
  for (const r of Q) {
    const mods = r.variant === 'mesh0012' ? { Work: { profile: 'baseline_mesh', mirror: false }, Return: { profile: 'baseline_mesh', mirror: false } } : {};
    const res = L.analyzeBlade(blade, { lam: r.tsr, ReR, polar, a: { Work: r.a_work, Return: r.a_return }, load: r.load === 'force' ? 'force' : 'total', n: 321 }, mods);
    if (Number.isNaN(r.partial_CQ)) { assert.equal(res.partialCQ, null); continue; }
    worst = Math.max(worst, Math.abs(res.partialCQ - r.partial_CQ));
  }
  assert.ok(worst < 1e-6, `最大差 ${worst}`);
});

test('parseBladeV1:拒絕格式錯誤、站數不足、s 非遞增、負弦長、window 超出取樣範圍', () => {
  const ok = JSON.parse(readFileSync(join(exDir, 'blade_v02_candidate146.json'), 'utf8'));
  const bad = f => { const o = structuredClone(ok); f(o); assert.throws(() => L.parseBladeV1(o)); };
  bad(o => { o.schema = 'x'; });
  bad(o => { o.branches[0].stations.length = 3; });
  bad(o => { o.branches[0].stations[2].s = 0.1; });
  bad(o => { o.branches[0].stations[2].chord = -0.01; });
  bad(o => { o.branches[0].stations[2].x = 'abc'; });
  bad(o => { o.window = [0.05, 0.9]; });
  bad(o => { delete o.branches[0].profile; });
  bad(o => { o.copies = 1.5; });
});

test('cubicSpline 重現線性函數與其斜率;安裝角偏移與分段翼型生效', () => {
  const sp = L.cubicSpline([0, 0.3, 0.5, 1], [1, 1.6, 2, 3]);
  assert.ok(Math.abs(sp.f(0.77) - 2.54) < 1e-12 && Math.abs(sp.d(0.77) - 2) < 1e-12);
  const br = exBlade().branches[0];
  const d0 = L.branchDef(br), d1 = L.branchDef(br, { dBeta: 2 });
  assert.ok(Math.abs(d1.beta(0.5) - d0.beta(0.5) - 2) < 1e-12);
  { // 線性/二次扭角:起點不變、終點加 dL+dQ、中點加 dL/2+dQ/4(u 以分支弧長正規化)
    const [s0, s1] = d0.domain, dm = L.branchDef(br, { dBetaLin: 3, dBetaQuad: -2 }), sm = (s0 + s1) / 2;
    assert.ok(Math.abs(dm.beta(s0) - d0.beta(s0)) < 1e-12);
    assert.ok(Math.abs(dm.beta(s1) - d0.beta(s1) - 1) < 1e-12);
    assert.ok(Math.abs(dm.beta(sm) - d0.beta(sm) - (1.5 - 0.5)) < 1e-12);
  }
  const seg = structuredClone(br); seg.stations.find(p => p.s === 0.5).profile = 'baseline_mesh'; seg.stations.find(p => p.s === 0.5).mirror = false;
  const ds = L.branchDef(seg);
  assert.deepEqual(ds.profileAt(0.3), { profile: '2412', mirror: true });
  assert.deepEqual(ds.profileAt(0.6), { profile: 'baseline_mesh', mirror: false });
  assert.deepEqual(L.branchDef(seg, { profile: '2412', mirror: false }).profileAt(0.6), { profile: '2412', mirror: false });
});

test('葉片定義防呆:units 非 R、保留字或重複的分支 id 一律拒絕;繼承屬性不會被當成 a', () => {
  const ok = JSON.parse(readFileSync(join(exDir, 'blade_v02_candidate146.json'), 'utf8'));
  const bad = f => { const o = structuredClone(ok); f(o); assert.throws(() => L.parseBladeV1(o)); };
  bad(o => { o.units = 'm'; });
  bad(o => { o.branches[0].id = '__proto__'; });
  bad(o => { o.branches[0].id = 'constructor'; });
  bad(o => { o.branches[1].id = o.branches[0].id; });
  const blade = L.parseBladeV1(ok), op = { lam: 6, ReR, polar, load: 'total', n: 81 };
  const r = L.analyzeBlade(blade, { ...op, a: Object.create({ Work: 0.5 }) }, Object.create({ Work: { dBeta: 10 } }));
  assert.equal(r.partialCQ, L.analyzeBlade(blade, { ...op, a: {} }).partialCQ, '只讀自有屬性');
});

test('弦長以保形內插:非負取樣不會內插成負值;整支方向覆寫優先於站上 mirror', () => {
  const c = L.pchip([0, 1, 2, 3], [1, 0.1, 0.1, 1]);
  for (let x = 0; x <= 3; x += 0.01) assert.ok(c.f(x) >= 0.1 - 1e-12, `pchip(${x}) = ${c.f(x)}`);
  const nat = L.cubicSpline([0, 1, 2, 3], [1, 0.1, 0.1, 1]);
  assert.ok(Math.min(...Array.from({ length: 301 }, (_, i) => nat.f(i / 100))) < 0.1, '對照:自然樣條會過衝');
  const br = structuredClone(exBlade().branches[0]);
  br.stations.find(p => p.s === 0.5).mirror = false;
  const d = L.branchDef(br, { mirror: true });
  assert.equal(d.profileAt(0.3).mirror, true); assert.equal(d.profileAt(0.7).mirror, true);
  assert.equal(L.branchDef(br).profileAt(0.7).mirror, false);
});

test('分析結果 CSV:缺值留空不補 0、欄位數一致、含逗號的標籤被引號包住', () => {
  const blade = L.parseBladeV1(JSON.parse(readFileSync(join(exDir, 'blade_v02_candidate146.json'), 'utf8')));
  const res = L.analyzeBlade(blade, { lam: 6, ReR, polar, load: 'total', n: 41, a: { Return: 0.25 } });
  const lines = L.stationsCSV(res).replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, 1 + 41 * blade.branches.length);
  const hdr = lines[0].split(','), miss = lines.slice(1).filter(l => !l.endsWith(',supported') && !l.endsWith(',zero_chord'));
  assert.ok(miss.length > 0, '指定 a 後應有缺值截面');
  for (const l of lines) assert.equal(l.split(',').length, hdr.length);
  for (const l of miss) { const c = l.split(','); assert.equal(c[hdr.indexOf('CL')], ''); assert.equal(c[hdr.indexOf('q_times_J')], ''); }
  const sw = L.sweepCSV([{ label: 'a,b', rows: [{ lam: 3, partialCQ: null, coverage: 0.5 }, { lam: 3.25, partialCQ: 0.01, coverage: 1 }] }]).replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(sw[0], 'lambda,"a,b partialCQ","a,b coverage"');
  assert.equal(sw[1], '3,,0.5'); assert.equal(sw[2], '3.25,0.01,1');
});
