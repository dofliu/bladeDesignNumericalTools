// Regression tests for the aerodynamic core (src/aero.mjs).
// Reference values were verified when the models were written; keep tolerances tight
// so that an accidental change in the physics shows up immediately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/aero.mjs';

const near = (v, ref, tol, msg) => assert.ok(Math.abs(v - ref) <= tol, `${msg}: ${v} vs ${ref} ±${tol}`);

test('panel method: NACA 0012 inviscid lift at 5°', () => {
  near(A.panel(A.naca4('0012'))(5 * A.D2R).cl, 0.602, 0.01, 'cl');
});

test('panel method: field velocity satisfies no-penetration on the surface', () => {
  const s = A.panel(A.naca4('4412'))(5 * A.D2R);
  let worst = 0;
  for (let i = 5; i < s.n - 5; i++) {
    const dx = s.X[i + 1] - s.X[i], dy = s.Y[i + 1] - s.Y[i], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L, [u, v] = s.vel(s.xm[i] + nx * 1e-7, s.ym[i] + ny * 1e-7);
    worst = Math.max(worst, Math.abs(u * nx + v * ny));
  }
  assert.ok(worst < 1e-3, `max normal velocity ${worst}`);
});

test('cambered zero-lift angle: NACA 4412', () => {
  near(A.buildAeroModel(A.naca4('4412')).aL0 * A.R2D, -4.14, 0.1, 'aL0');
});

test('polar: best L/D of NACA 4412 at Re 3e5', () => {
  const b = A.bestLD(A.buildPolarSet(A.buildAeroModel(A.naca4('4412'))), 3e5);
  near(b.a, 3.5, 0.5, 'alpha'); near(b.ld, 81.2, 3, 'L/D');
});

test('BEM: 3-blade R1.5 m rotor designed for λ7', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('4412')));
  const b = A.bestLD(ps, 3e5);
  const rows = A.designHAWT({ R: 1.5, Rhub: 0.15, B: 3, tsr: 7, aDes: b.a, clDes: b.cl, nSec: 16, linearize: false, chordScale: 1, twistScale: 1, maxChordRatio: 0.2 });
  const cfg = { R: 1.5, Rhub: 0.15, B: 3, rows, rho: 1.225, mu: 1.81e-5, polarFor: () => ps };
  const cur = A.hawtCurve(cfg, 8, 0, 0, 12), best = cur.reduce((a, c) => (c.Cp > a.Cp ? c : a));
  near(best.Cp, 0.477, 0.01, 'Cp,max'); near(best.l, 7, 0.5, 'λopt');
  assert.ok(best.Cp < 16 / 27, 'must stay below the Betz limit');
  const yaw = Math.max(...A.hawtCurve(cfg, 8, 30 * A.D2R, 0, 12).map(p => p.Cp));
  near(yaw, 0.309, 0.02, 'Cp at 30° yaw');
});

test('cumulativeMoment/cumulativeOutboard match a cantilever under uniform distributed load', () => {
  // Discretise a cantilever of length L into n annuli of width dr carrying a uniform transverse
  // load w per unit length (F_i = w·dr lumped at each station centre). Analytical solution at
  // distance x from the root: shear V(x) = w·(L-x), moment M(x) = w·(L-x)²/2.
  const L = 3, n = 400, dr = L / n, w = 150;
  const r = Array.from({ length: n }, (_, i) => (i + 0.5) * dr);
  const F = r.map(() => w * dr);
  const V = A.cumulativeOutboard(r, F), M = A.cumulativeMoment(r, F);
  near(M[0], w * L * L / 2, w * L * L / 2 * 0.01, 'root moment');
  near(V[0], w * L, w * L * 0.01, 'root shear');
  const jMid = Math.floor(n / 2), x = r[jMid];
  near(M[jMid], w * (L - x) ** 2 / 2, w * (L - x) ** 2 / 2 * 0.02 + 1, 'mid-span moment');
  near(V[jMid], w * (L - x), w * (L - x) * 0.02 + 1, 'mid-span shear');
  assert.ok(M[n - 1] < w * dr * dr, 'moment ~0 at the tip');
});

test('DMST: H-type Cp–λ curve shape vs literature band (dynStall / curvature flags)', () => {
  // 文獻帶(H 型 Darrieus,實度 Bc/R=0.3、NACA 0018,Paraschivoiu / Castelli 等 DMST 與風洞結果的典型範圍):
  // Cp,max 約 0.25–0.40、出現在 λ 2.5–4;Cp 降為 0(失控轉速)約在 λ 5–7.5。這裡只釘住模型落在帶內的回歸基準,係數尚未校正。
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 };
  const curve = o => { const out = []; for (let l = 1.5; l <= 8.01; l += 0.25) out.push({ l, Cp: A.dmstPoint({ ...cfg, ...o }, 8, l).Cp }); return out; };
  const runaway = c => { const pk = c.reduce((a, x) => (x.Cp > a.Cp ? x : a)); for (let i = c.indexOf(pk); i < c.length - 1; i++) if (c[i].Cp > 0 && c[i + 1].Cp <= 0) return c[i].l + 0.25 * c[i].Cp / (c[i].Cp - c[i + 1].Cp); return NaN; };
  const res = {};
  for (const [n, o] of [['base', {}], ['dyn', { dynStall: true }], ['curv', { curvature: true }], ['both', { dynStall: true, curvature: true }]]) {
    const c = curve(o), pk = c.reduce((a, x) => (x.Cp > a.Cp ? x : a)), ra = runaway(c);
    res[n] = { pk, ra };
    assert.ok(pk.Cp > 0.25 && pk.Cp < 0.40, `${n}: Cp,max ${pk.Cp.toFixed(3)} in 0.25–0.40`);
    assert.ok(pk.l >= 2.5 && pk.l <= 4, `${n}: λ at Cp,max ${pk.l} in 2.5–4`);
    assert.ok(ra > 5 && ra < 7.5, `${n}: runaway λ ${ra.toFixed(2)} in 5–7.5`);
  }
  assert.ok(res.curv.ra < res.base.ra && res.both.ra < res.dyn.ra, 'curvature lowers the runaway tip-speed ratio');
  console.log('H curve', Object.entries(res).map(([n, r]) => `${n} ${r.pk.Cp.toFixed(3)}@${r.pk.l} runaway ${r.ra.toFixed(2)}`).join(' | '));
});

test('DMST: H-type and Φ-type Darrieus', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const run = type => A.vawtCurve({ type, R: 1, H: 2, B: 3, c: 0.15, pitch: 0, helix: 120, nz: 10, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 }, 8, 7)
    .reduce((a, c) => (c.Cp > a.Cp ? c : a));
  const h = run('H'), phi = run('phi');
  // 2026-10-05 失速模型厚度/Re 校正後:NACA 0018 低 Re 失速角下降,H 0.368@λ3 → 0.333@λ3.5、Φ 0.385@λ3.5 → 0.357@λ3.75
  near(h.Cp, 0.333, 0.015, 'H Cp'); near(h.l, 3.5, 0.5, 'H λopt');
  near(phi.Cp, 0.357, 0.015, 'Φ Cp');
});

test('DMST: simplified dynamic stall is opt-in and mainly affects the stalled low-λ region', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 };
  const base = A.dmstPoint(cfg, 8, 3), off = A.dmstPoint({ ...cfg, dynStall: false }, 8, 3);
  assert.equal(base.Cp, off.Cp, 'flag off leaves results unchanged');
  const lo0 = A.dmstPoint(cfg, 8, 2.2).Cp, lo1 = A.dmstPoint({ ...cfg, dynStall: true }, 8, 2.2).Cp;
  assert.ok(Number.isFinite(lo1) && Math.abs(lo1 - lo0) > 0.005, `low-λ Cp changes (${lo0.toFixed(3)} -> ${lo1.toFixed(3)})`);
  const hi1 = A.dmstPoint({ ...cfg, dynStall: true }, 8, 3).Cp;
  assert.ok(Math.abs(hi1 - base.Cp) < 0.06 * Math.max(base.Cp, 0.1) + 0.02, `near λopt change small (${base.Cp.toFixed(3)} -> ${hi1.toFixed(3)})`);
  console.log('dynStall', lo0.toFixed(3), lo1.toFixed(3), base.Cp.toFixed(3), hi1.toFixed(3));
});

test('DMST: streamline curvature correction is opt-in and lowers high-λ Cp', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5, struts: 2 };
  const base = A.dmstPoint(cfg, 8, 4).Cp, off = A.dmstPoint({ ...cfg, curvature: false }, 8, 4).Cp;
  assert.equal(base, off, 'flag off leaves results unchanged');
  const on = A.dmstPoint({ ...cfg, curvature: true }, 8, 4).Cp;
  assert.ok(on < base && on > 0.5 * base, `high-λ Cp drops moderately (${base.toFixed(3)} -> ${on.toFixed(3)})`);
  const thin = A.dmstPoint({ ...cfg, c: 0.075, curvature: true }, 8, 4).Cp, thin0 = A.dmstPoint({ ...cfg, c: 0.075 }, 8, 4).Cp;
  assert.ok((thin0 - thin) / thin0 < (base - on) / base, 'smaller c/R gives a smaller correction');
  console.log('curvature', base.toFixed(3), on.toFixed(3));
});

test('boundary layer: NACA 0012 attached at 0° with plausible friction drag (Re 1e6)', () => {
  const bl = A.boundaryLayer(A.panel(A.naca4('0012'))(0), 1e6);
  assert.equal(bl.upper.xSep, null); assert.equal(bl.lower.xSep, null);
  near(bl.cd, 0.0056, 0.002, 'cd'); near(bl.upper.xTr, bl.lower.xTr, 0.05, '對稱翼型兩面轉捩點');
});

test('boundary layer: separation moves forward with angle of attack and lower Re', () => {
  const sep = (a, Re) => A.boundaryLayer(A.panel(A.naca4('0012'))(a * A.D2R), Re).upper.xSep;
  assert.ok(sep(12, 3e5) !== null && sep(16, 3e5) < sep(12, 3e5), '攻角越大分離點越前移');
  assert.ok(sep(12, 3e5) < sep(12, 1e6), '低 Re 分離較早');
  assert.equal(sep(2, 1e6), null);
  const cds = [0, 8, 16].map(a => A.boundaryLayer(A.panel(A.naca4('0012'))(a * A.D2R), 3e5).cd);
  assert.ok(cds[0] < cds[1] && cds[1] < cds[2], '阻力隨攻角增加');
});

test('極曲線 cd 與邊界層積分 cd 比對:低 Re 吻合、高 Re 校正後仍略偏高(厚翼型最多 1.6 倍)', () => {
  const ratio = (code, Re, a) => {
    const m = A.buildAeroModel(A.naca4(code));
    const pol = A.lookup({ REs: [1], tables: [A.polarAtRe(m, Re)] }, a * A.D2R, Re)[1];
    return pol / A.boundaryLayer(m.solve(a * A.D2R), Re).cd;
  };
  for (const code of ['0012', '2412', '4412', '0018']) {
    for (const a of [0, 2]) {
      const lo = ratio(code, 1e5, a), mid = ratio(code, 3e5, a), hi = ratio(code, 2e6, a);
      assert.ok(lo > 0.85 && lo < 1.15, `${code} a${a} Re1e5 比值 ${lo.toFixed(2)}`);
      assert.ok(mid > 0.8 && mid < 1.25, `${code} a${a} Re3e5 比值 ${mid.toFixed(2)}`);
      // 校正前高 Re 比值 1.5–2 倍;cd0 的 reCal 下修後 NACA 0012 Re 1e6 cd0 ≈ 0.006(文獻值),比值降為 1.17–1.6
      assert.ok(hi > 0.95 && hi < 1.7, `${code} a${a} Re2e6 比值 ${hi.toFixed(2)}`);
    }
  }
});

test('極曲線與文獻實驗值比對基準:升力斜率、cd0 吻合,失速模型厚度/Re 校正後 Clmax 與文獻吻合', () => {
  const stats = (code, Re) => {
    const t = A.polarAtRe(A.buildAeroModel(A.naca4(code)), Re);
    let clmax = -9;
    for (let k = 0; k < t.al.length; k++) if (t.al[k] > 0 && t.al[k] < 0.5) clmax = Math.max(clmax, t.CL[k]);
    return { clmax, cd0: t.cd0, a: t.a };
  };
  // Abbott & von Doenhoff,NACA 0012 光滑表面 Re 3×10⁶:a₀ ≈ 0.108/°(6.2/rad)、Cd,min ≈ 0.0055、Clmax ≈ 1.6
  const s12 = stats('0012', 3e6);
  near(s12.a, 6.2, 0.3, '0012 升力斜率(/rad)');
  near(s12.cd0, 0.0055, 0.0008, '0012 Re3e6 cd0');
  assert.ok(s12.clmax > 1.6 * 0.88 && s12.clmax < 1.6 * 1.05, `0012 Re3e6 Clmax ${s12.clmax.toFixed(2)}(文獻 1.6;校正前 1.34,校正後約 1.49)`);
  // Sheldahl & Klimas 1981,NACA 0018 Re 3–4×10⁵:Clmax ≈ 1.1–1.2、cd0 ≈ 0.0075;校正前 1.51 高估,現在厚度項 t > 0.12 後遞減
  const s18 = stats('0018', 3e5);
  assert.ok(s18.clmax > 1.05 && s18.clmax < 1.3, `0018 Re3e5 Clmax ${s18.clmax.toFixed(2)}(文獻約 1.1–1.2;校正前 1.51)`);
  near(s18.cd0, 0.0075, 0.0015, '0018 Re3e5 cd0');
  });

test('DMST: 靜止轉子啟動轉矩(vawtStaticTorque)', () => {
  const ps = A.buildPolarSet(A.buildAeroModel(A.naca4('0018')));
  const cfg = { type: 'H', R: 1, H: 2, B: 3, c: 0.15, pitch: 0, nz: 1, polar: ps, rho: 1.225, mu: 1.81e-5 };
  const r = A.vawtStaticTorque(cfg, 8);
  assert.equal(r.tot.length, 72);
  assert.ok(Number.isFinite(r.mean) && r.max >= r.mean && r.mean >= r.min, 'min ≤ mean ≤ max');
  console.log('static torque Cq mean/min/max', r.mean.toFixed(3), r.min.toFixed(3), r.max.toFixed(3), 'selfStart', r.selfStart);
  assert.equal(r.selfStart, false);
  const r2 = A.vawtStaticTorque(cfg, 12);
  assert.ok(Math.abs(r2.mean - r.mean) < 0.5 * Math.abs(r.mean) + 0.05, 'Cq roughly V-independent');
});

test('低 Re 修正:Re < 1e5 分離泡使 cd0 上升、Clmax 下降,Re ≥ 1e5 不變', () => {
  const m = A.buildAeroModel(A.naca4('0012'));
  const st = Re => {
    const t = A.polarAtRe(m, Re);
    let clmax = -9;
    for (let k = 0; k < t.al.length; k++) if (t.al[k] > 0 && t.al[k] < 0.5) clmax = Math.max(clmax, t.CL[k]);
    return { clmax, cd0: t.cd0 };
  };
  const hi = st(1e5), mid = st(5e4), lo = st(2e4);
  console.log('低 Re 0012 (Re 1e5/5e4/2e4) cd0', hi.cd0.toFixed(4), mid.cd0.toFixed(4), lo.cd0.toFixed(4), 'Clmax', hi.clmax.toFixed(2), mid.clmax.toFixed(2), lo.clmax.toFixed(2));
  assert.ok(mid.cd0 > hi.cd0 * 1.1 && lo.cd0 > mid.cd0 * 1.1, 'cd0 隨 Re 降低而上升(含分離泡)');
  assert.ok(mid.clmax < hi.clmax && lo.clmax < mid.clmax, 'Clmax 隨 Re 降低而下降');
});

test('葉尖渦螺旋尾流:遠尾流節距 2π(1−2a)/λ、半徑膨脹 √((1−a)/(1−2a))、葉片間相位差', () => {
  const B = 3, lam = 7, a = 0.3, per = 64;
  const w = A.tipVortexWake(B, lam, a, { turns: 12, perTurn: per });
  assert.equal(w.length, B);
  const p = w[0], n = p.length - 1;
  // 最後一圈的軸向前進量 ≈ 遠尾流節距
  const pitch = p[n].x - p[n - per].x, ref = 2 * Math.PI * (1 - 2 * a) / lam;
  near(pitch / ref, 1, 0.03, '遠尾流節距比');
  near(p[n].r, Math.sqrt((1 - a) / (1 - 2 * a)), 0.02, '遠尾流半徑');
  near(p[0].r, 1, 1e-9, '轉子盤處半徑');
  // 軸向位置單調增加;第 k 片與第 0 片起始角差 2π/B
  for (let i = 1; i <= n; i++) assert.ok(p[i].x > p[i - 1].x);
  near(Math.abs(w[1][0].th - w[0][0].th), 2 * Math.PI / B, 1e-9, '葉片相位差');
  // a=0 時沒有膨脹、節距 2π/λ(無誘導)
  const w0 = A.tipVortexWake(1, lam, 0, { turns: 2, perTurn: per })[0];
  near(w0[w0.length - 1].r, 1, 1e-9, 'a=0 半徑');
  near(w0[per].x, 2 * Math.PI / lam, 1e-9, 'a=0 節距');
});
