// 通用三維線葉片分析(研究模式,ROADMAP 第 9 項)。
// 任何能以「三維中心線 x(s) + 弦長 c(s) + 截面安裝角 β(s) + 翼型」描述的葉片,
// 逐截面計算攻角、局部 Re、力與四分之一弦力偶,並沿實體弧長積分成「部分扭矩係數」。
// 嚴格資料域:不夾值、不外插、不套 Viterna、不墊 Cd、缺值不補 0(與 aero.mjs 的一般模式分開)。
// 不含誘導/尾流/接合阻力;結果不是整機 CQ 或效率。座標與符號慣例見 docs/LINE3D.md。

export const POLAR_SCHEMA = 'blade-handoff-polar-v1';
const RE_TOL = 1e-7, AL_TOL = 1e-12;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const NAN3 = [NaN, NaN, NaN];

/* ---------- 極曲線資料契約 ---------- */
// 解析 polar_v1 JSON:多翼型 × 多 Re 層 × 攻角點,保留 valid/sources;profileId 一律當字串。
export function parsePolarV1(obj) {
  if (typeof obj === 'string') obj = JSON.parse(obj);
  if (!obj || obj.schema !== POLAR_SCHEMA) throw new Error(`極曲線格式不符:需要 schema "${POLAR_SCHEMA}"`);
  const w = obj.supportWindow || {};
  const win = { alpha: (w.alpha_deg || []).map(Number), Re: (w.Re || []).map(Number) };
  if (win.alpha.length !== 2 || win.Re.length !== 2 || ![...win.alpha, ...win.Re].every(Number.isFinite)) throw new Error('極曲線缺少有效的 supportWindow(alpha_deg、Re)');
  const profiles = new Map();
  for (const p of obj.profiles || []) {
    const id = String(p.profileId);
    if (profiles.has(id)) throw new Error(`翼型 ${id} 重複`);
    const layers = [], grid = new Set();
    for (const l of p.layers || []) {
      const Re = Number(l.Re);
      if (!(Re > 0) || !Number.isFinite(Re)) throw new Error(`翼型 ${id}:Re 必須為正有限值`);
      const pts = new Map();
      for (const q of l.points || []) {
        const al = Number(q.alpha_deg);
        if (!Number.isFinite(al)) throw new Error(`翼型 ${id} Re ${Re}:攻角不是有限值`);
        const c = [q.cl, q.cd, q.cm];
        const valid = q.valid === true && c.every(v => typeof v === 'number' && Number.isFinite(v));
        if (q.valid === true && !valid) throw new Error(`翼型 ${id} Re ${Re} α ${al}:標為有效但係數不是有限值`);
        if (pts.has(al)) throw new Error(`翼型 ${id} Re ${Re} α ${al} 重複`);
        pts.set(al, { cl: valid ? c[0] : NaN, cd: valid ? c[1] : NaN, cm: valid ? c[2] : NaN, valid, sources: (q.sources || []).map(String), status: q.status || (valid ? 'supported' : 'invalid') });
        grid.add(al);
      }
      layers.push({ Re, pts });
    }
    layers.sort((a, b) => a.Re - b.Re);
    for (let i = 1; i < layers.length; i++) if (layers[i].Re - layers[i - 1].Re <= RE_TOL) throw new Error(`翼型 ${id}:Re 層重複`);
    // 攻角格點取所有層的聯集:某層缺點時查詢回傳缺失,不會跨過缺口在相鄰點之間補直線
    profiles.set(id, { id, layers, alphas: [...grid].sort((a, b) => a - b) });
  }
  return { schema: obj.schema, conditions: obj.conditions || {}, window: win, profiles };
}

function bracket(xs, x, tol) {
  for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i] - x) <= tol) return [i];
  for (let i = 1; i < xs.length; i++) if (xs[i - 1] < x && x < xs[i]) return [i - 1, i];
  return null;
}
function layerValue(prof, layer, a, used, srcs) {
  const ia = bracket(prof.alphas, a, AL_TOL);
  if (!ia) return NAN3;
  const z = ia.map(i => {
    const al = prof.alphas[i], p = layer.pts.get(al);
    used.push({ Re: layer.Re, alpha: al, valid: !!(p && p.valid) });
    if (p) srcs.push(...p.sources);
    return p && p.valid ? [p.cl, p.cd, p.cm] : NAN3;
  });
  if (z.length === 1) return z[0];
  const a0 = prof.alphas[ia[0]], a1 = prof.alphas[ia[1]], f = (a - a0) / (a1 - a0);
  return z[0].map((v, k) => v + f * (z[1][k] - v));
}
// 嚴格查表:先攻角相鄰格點線性,再 Re 相鄰層 log(Re) 線性;鏡射翼型先以 −α 查,再把 CL、CM 變號。
// status:supported / missing_corner / outside_alpha / outside_Re / nonfinite / unknown_profile
export function lookupPolar(set, profileId, alphaDeg, Re, opt = {}) {
  const miss = status => ({ cl: NaN, cd: NaN, cm: NaN, status, usedCorners: [], sourceIds: [] });
  if (!Number.isFinite(alphaDeg) || !Number.isFinite(Re)) return miss('nonfinite');
  const prof = set.profiles.get(String(profileId));
  if (!prof) return miss('unknown_profile');
  const a = opt.mirror ? -alphaDeg : alphaDeg;
  if (a < set.window.alpha[0] || a > set.window.alpha[1]) return miss('outside_alpha');
  if (Re < set.window.Re[0] || Re > set.window.Re[1]) return miss('outside_Re');
  const ir = bracket(prof.layers.map(l => l.Re), Re, RE_TOL);
  if (!ir) return miss('outside_Re');
  const used = [], srcs = [];
  const vals = ir.map(i => layerValue(prof, prof.layers[i], a, used, srcs));
  let v = vals[0];
  if (vals.length === 2) {
    const r0 = prof.layers[ir[0]].Re, r1 = prof.layers[ir[1]].Re, f = Math.log(Re / r0) / Math.log(r1 / r0);
    v = vals[0].map((x, k) => x + f * (vals[1][k] - x));
  }
  let [cl, cd, cm] = v;
  if (opt.mirror) { cl = -cl; cm = -cm; }
  const ok = Number.isFinite(cl) && Number.isFinite(cd) && Number.isFinite(cm);
  return { cl, cd, cm, status: ok ? 'supported' : 'missing_corner', usedCorners: used, sourceIds: [...new Set(srcs)] };
}

/* ---------- 截面框架與負載 ---------- */
// span 沿 s 增加方向;t 為水平切向、n = span × t。span 平行主軸時框架未定義。
export function lineFrame(dx) {
  const J = norm(dx), span = scale(dx, 1 / J), h = Math.hypot(span[0], span[1]);
  if (!(J > 0) || !(h > 1e-12)) return { J, span, t: NAN3, n: NAN3, ok: false };
  const t = [-span[1] / h, span[0] / h, 0];
  return { J, span, t, n: cross(span, t), ok: true };
}
// chord 為 LE→TE 單位向量,upper = span × chord(故 chord × upper = span)
export function sectionAxes(fr, betaDeg) {
  const b = betaDeg * Math.PI / 180, cb = Math.cos(b), sb = Math.sin(b);
  const chord = [-fr.t[0] * cb + fr.n[0] * sb, -fr.t[1] * cb + fr.n[1] * sb, -fr.t[2] * cb + fr.n[2] * sb];
  return { chord, upper: cross(fr.span, chord) };
}
// 相對風速(以 U∞ 無因次):W = (1 − a) e_z − λ (e_z × x),a 為指定的純軸向折減(無旋流、無流管耦合)
export function relativeWind(x, lam, a = 0) { return [lam * x[1], -lam * x[0], 1 - a]; }

// 單一截面:輸入中心位置 x/R、span/chord/upper、c/R、W/U∞ 與極曲線;輸出單位弧長的力 F̂ 與力偶 M̂
// (實體值 f = q∞R·F̂、m = q∞R²·M̂),以及對 +Z 主軸的扭矩貢獻 qForce = (x × F̂)_z、qCm = M̂_z。
export function sectionLoad3D(o) {
  const { x, span, chord, upper, c, W, polar, profile, mirror = false, ReR } = o;
  const wp = sub(W, scale(span, dot(W, span))), v = norm(wp);
  const out = { x, span, W, wperp: wp, speed: v, c, alpha: NaN, Re: NaN, cl: NaN, cd: NaN, cm: NaN, F: NAN3, M: NAN3, qForce: NaN, qCm: NaN, qTotal: NaN, status: 'zero_speed', usedCorners: [], sourceIds: [] };
  if (!(c >= 0) || !Number.isFinite(c)) { out.status = 'invalid_chord'; return out; }
  if (!W.every(Number.isFinite)) { out.status = 'nonfinite_wind'; return out; } // 例如上游誘導計算失敗給出 NaN
  if (!(v > 1e-12)) return out;
  if (c === 0) { // 零弦長截面(錐形翼根/翼尖):力與力偶恰為 0,與極曲線無關
    Object.assign(out, { F: [0, 0, 0], M: [0, 0, 0], qForce: 0, qCm: 0, qTotal: 0, status: 'zero_chord' });
    return out;
  }
  out.alpha = Math.atan2(dot(wp, upper), dot(wp, chord)) * 180 / Math.PI;
  out.Re = ReR * c * v;
  const lk = lookupPolar(polar, profile, out.alpha, out.Re, { mirror });
  Object.assign(out, { cl: lk.cl, cd: lk.cd, cm: lk.cm, status: lk.status, usedCorners: lk.usedCorners, sourceIds: lk.sourceIds });
  const drag = scale(wp, 1 / v), lift = cross(span, drag), q = c * v * v;
  out.F = [0, 1, 2].map(i => q * (lk.cl * lift[i] + lk.cd * drag[i]));
  out.M = scale(span, -c * q * lk.cm); // XFOIL 正 Cm(抬頭)在此框架對應 −span
  out.qForce = cross(x, out.F)[2]; out.qCm = out.M[2]; out.qTotal = out.qForce + out.qCm;
  return out;
}

/* ---------- 葉片定義與沿弧長積分 ---------- */
// def:{ x(s)→[x,y,z](以 R 為單位), dx?(s)(未給則差分), domain?[s0,s1](差分不越界), chord(s)(c/R), beta(s)(度), profile, mirror, profileAt?(s)→{profile, mirror} }
function diffX(def, s) {
  const h = 1e-6, [lo, hi] = def.domain || [-Infinity, Infinity];
  const a = Math.max(lo, s - h), b = Math.min(hi, s + h); // 端點改用單側差分
  return scale(sub(def.x(b), def.x(a)), 1 / (b - a));
}
export function lineStation(def, s, op) {
  const x = def.x(s);
  const dx = def.dx ? def.dx(s) : diffX(def, s);
  const fr = lineFrame(dx);
  if (!fr.ok) return { s, J: fr.J, status: 'degenerate_frame', qForce: NaN, qCm: NaN, qTotal: NaN };
  const ax = sectionAxes(fr, def.beta(s));
  const pf = def.profileAt ? def.profileAt(s) : { profile: def.profile, mirror: def.mirror }; // 沿展向分段換翼型時用 profileAt
  const r = sectionLoad3D({ x, span: fr.span, chord: ax.chord, upper: ax.upper, c: def.chord(s), W: relativeWind(x, op.lam, op.a ?? 0), polar: op.polar, profile: pf.profile, mirror: !!pf.mirror, ReR: op.ReR });
  return Object.assign(r, { s, J: fr.J, chordDir: ax.chord, upperDir: ax.upper });
}
export function linspace(a, b, n) { const st = (b - a) / (n - 1), o = []; for (let i = 0; i < n; i++) o.push(i === n - 1 ? b : a + i * st); return o; }
// 梯形積分 ∫ q J ds;每個區間的兩端點與中點都須有資料才算支撐。缺任一點則 full 為 null(不補 0)。
// load:'force'(只計力)或 'total'(力 + 四分之一弦力偶)
export function integrateLine(def, op, opt = {}) {
  const s = opt.s || linspace(opt.s0 ?? 0, opt.s1 ?? 1, opt.n || 161), key = opt.load === 'force' ? 'qForce' : 'qTotal';
  if (s.length < 2 || !s.every(Number.isFinite) || s.some((v, i) => i > 0 && !(v > s[i - 1])))
    return { I_full: null, I_supported: NaN, coverage: 0, unsupportedIntervals: [], stations: [], status: 'invalid_grid' };
  const st = s.map(v => lineStation(def, v, op));
  let full = 0, sup = 0, Ltot = 0, Lsup = 0, allOk = true;
  const gaps = [];
  for (let i = 0; i + 1 < s.length; i++) {
    const m = lineStation(def, (s[i] + s[i + 1]) / 2, op), a = st[i], b = st[i + 1], ds = s[i + 1] - s[i];
    const L = (a.J + b.J) / 2 * ds; Ltot += L;
    const ok = Number.isFinite(a[key]) && Number.isFinite(b[key]) && Number.isFinite(m[key]);
    if (ok) { const d = ds * (a[key] * a.J + b[key] * b.J) / 2; full += d; sup += d; Lsup += L; continue; }
    allOk = false;
    const why = [a, m, b].filter(p => !Number.isFinite(p[key])).map(p => p.status);
    const g = gaps[gaps.length - 1];
    if (g && g.s1 === s[i]) { g.s1 = s[i + 1]; why.forEach(w => g.reasons.add(w)); }
    else gaps.push({ s0: s[i], s1: s[i + 1], reasons: new Set(why) });
  }
  return { status: allOk ? 'supported' : 'partial', I_full: allOk ? full : null, I_supported: sup, coverage: Ltot > 0 ? Lsup / Ltot : 0, unsupportedIntervals: gaps.map(g => ({ s0: g.s0, s1: g.s1, reasons: [...g.reasons] })), stations: st };
}
// 部分扭矩係數(分母 q∞πR³):copies 為旋轉複製份數,只在這裡乘一次;任一分支缺完整窗即為 null
export function partialCQ(branchIntegrals, copies = 1) {
  if (branchIntegrals.some(v => v == null || !Number.isFinite(v))) return null;
  return copies * branchIntegrals.reduce((a, b) => a + b, 0) / Math.PI;
}

/* ---------- 範例幾何:回翼閉合葉片 v0.2 中心線 + candidate146 扭角 ---------- */
export const RETURN_WING_V02 = { rh: 0.18, rt: 0.9, openingDeg: 46, dz: 0.22, cw: 0.12, crcw: 0.65, k: 1.0438413314408341 };
export const candidate146 = s => { const u = (s - 0.1) / 0.8; return 38 * (1 - u) + 10 * u - 16 * u * (1 - u); };
// branch:'Work'(σ = −1)或 'Return'(σ = +1);j 為第幾組(0/1,相差 180°)
export function returnWingBranch(branch, opt = {}) {
  const p = Object.assign({}, RETURN_WING_V02, opt), sg = branch === 'Work' ? -1 : 1, j = opt.j || 0, k = p.k;
  const A = sg * p.openingDeg / 2 * Math.PI / 180, Z = sg * p.dz / 2, dr = p.rt - p.rh;
  const geo = s => { const r = p.rh + dr * s, w = Math.sin(Math.PI * s / 2), th = j * Math.PI + A * w; return { r, th, z: Z * w, dw: Math.PI / 2 * Math.cos(Math.PI * s / 2) }; };
  return {
    branch, profile: opt.profile, mirror: !!opt.mirror,
    x: s => { const g = geo(s); return [k * g.r * Math.cos(g.th), k * g.r * Math.sin(g.th), k * g.z]; },
    dx: s => { const g = geo(s), dth = A * g.dw; return [k * (dr * Math.cos(g.th) - g.r * Math.sin(g.th) * dth), k * (dr * Math.sin(g.th) + g.r * Math.cos(g.th) * dth), k * Z * g.dw]; },
    chord: () => p.cw * k * (branch === 'Work' ? 1 : p.crcw),
    beta: opt.beta || candidate146,
  };
}

/* ---------- 葉片定義檔(blade-line3d-v1)---------- */
// 每個分支是一串沿 s 遞增的取樣站:中心線 x,y,z(以 R 為單位)、弦長 chord(c/R)、安裝角 beta(度)、可選翼型。
// 中心線、弦長與安裝角以自然三次樣條內插(dx/ds 取樣條解析導數);翼型沿展向分段固定,不在翼型之間混合係數。
export const BLADE_SCHEMA = 'blade-line3d-v1';

export function cubicSpline(xs, ys) {
  const n = xs.length, h = [], al = [0], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], d = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);
  for (let i = 1; i < n - 1; i++) {
    al.push(3 / h[i] * (ys[i + 1] - ys[i]) - 3 / h[i - 1] * (ys[i] - ys[i - 1]));
    l.push(2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]); z.push((al[i] - h[i - 1] * z[i - 1]) / l[i]);
  }
  for (let j = n - 2; j >= 0; j--) {
    c[j] = j === 0 ? 0 : z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  const seg = x => { let i = 0, hi = n - 2; while (i < hi) { const m = (i + hi + 1) >> 1; if (xs[m] <= x) i = m; else hi = m - 1; } return i; };
  return {
    f: x => { const i = seg(x), t = x - xs[i]; return ys[i] + t * (b[i] + t * (c[i] + t * d[i])); },
    d: x => { const i = seg(x), t = x - xs[i]; return b[i] + t * (2 * c[i] + 3 * t * d[i]); },
  };
}

const num = (v, what) => { const x = Number(v); if (typeof v === 'boolean' || v === null || v === '' || !Number.isFinite(x)) throw new Error(`${what} 不是有限數值`); return x; };
// 解析並驗證葉片定義;回傳正規化後的物件(可再序列化)
export function parseBladeV1(obj) {
  if (typeof obj === 'string') obj = JSON.parse(obj);
  if (!obj || obj.schema !== BLADE_SCHEMA) throw new Error(`葉片定義格式不符:需要 schema "${BLADE_SCHEMA}"`);
  const copies = obj.copies == null ? 1 : num(obj.copies, 'copies');
  if (!(copies >= 1) || copies % 1) throw new Error('copies 必須為正整數(旋轉複製份數)');
  const branches = (obj.branches || []).map((b, k) => {
    const id = String(b.id ?? `分支${k + 1}`);
    if (b.profile == null) throw new Error(`${id}:缺少 profile(對應極曲線檔的 profileId)`);
    const st = (b.stations || []).map((p, i) => {
      const w = `${id} 第 ${i + 1} 站`;
      const o = { s: num(p.s, w + ' s'), x: num(p.x, w + ' x'), y: num(p.y, w + ' y'), z: num(p.z, w + ' z'), chord: num(p.chord, w + ' chord'), beta: num(p.beta, w + ' beta') };
      if (o.chord < 0) throw new Error(`${w}:chord 不可為負`);
      if (p.profile != null) o.profile = String(p.profile);
      if (p.mirror != null) o.mirror = !!p.mirror;
      return o;
    });
    if (st.length < 4) throw new Error(`${id}:至少需要 4 個取樣站`);
    for (let i = 1; i < st.length; i++) if (!(st[i].s > st[i - 1].s)) throw new Error(`${id}:s 必須嚴格遞增`);
    return { id, profile: String(b.profile), mirror: !!b.mirror, stations: st };
  });
  if (!branches.length) throw new Error('葉片定義沒有任何分支');
  const lo = Math.max(...branches.map(b => b.stations[0].s)), hi = Math.min(...branches.map(b => b.stations[b.stations.length - 1].s));
  const win = obj.window ? [num(obj.window[0], 'window[0]'), num(obj.window[1], 'window[1]')] : [lo, hi];
  if (!(win[0] < win[1]) || win[0] < lo - 1e-12 || win[1] > hi + 1e-12) throw new Error(`分析區間 window 必須落在各分支取樣範圍內(${lo}–${hi})`);
  return { schema: BLADE_SCHEMA, name: String(obj.name || '未命名葉片'), note: obj.note ? String(obj.note) : '', copies, window: win, units: obj.units || 'R', branches };
}

// 把一個分支(可加修改:dBeta 安裝角偏移〔度〕、profile/mirror 換翼型)轉成 lineStation 用的 def
export function branchDef(br, mod = {}) {
  const S = br.stations, s = S.map(p => p.s), sp = k => cubicSpline(s, S.map(p => p[k]));
  const X = sp('x'), Y = sp('y'), Z = sp('z'), C = sp('chord'), B = sp('beta'), dB = mod.dBeta || 0;
  const seg = S.map(p => ({ s: p.s, profile: p.profile, mirror: p.mirror }));
  const base = { profile: mod.profile ?? br.profile, mirror: mod.mirror ?? br.mirror };
  const profileAt = v => {
    if (mod.profile != null) return base; // 整支換翼型
    let k = 0; while (k + 1 < seg.length && seg[k + 1].s <= v) k++;
    let p = base.profile, m = base.mirror;
    for (let i = 0; i <= k; i++) { if (seg[i].profile != null) p = seg[i].profile; if (seg[i].mirror != null) m = seg[i].mirror; }
    return { profile: p, mirror: m };
  };
  return {
    branch: br.id, domain: [s[0], s[s.length - 1]], profile: base.profile, mirror: base.mirror, profileAt,
    x: v => [X.f(v), Y.f(v), Z.f(v)], dx: v => [X.d(v), Y.d(v), Z.d(v)],
    chord: v => Math.max(0, C.f(v)), beta: v => B.f(v) + dB,
  };
}

// 整支葉片在單一工況的分析:各分支沿弧長積分 + 部分 CQ(copies 只乘一次)
// op:{ lam, ReR, polar, a?:{[branchId]: a} 或數值, load:'force'|'total', n }
export function analyzeBlade(blade, op, mods = {}) {
  const n = op.n || 161, s = linspace(blade.window[0], blade.window[1], n);
  const aOf = id => typeof op.a === 'number' ? op.a : (op.a && op.a[id] != null ? op.a[id] : 0);
  const branches = blade.branches.map(br => {
    const r = integrateLine(branchDef(br, mods[br.id]), { lam: op.lam, a: aOf(br.id), polar: op.polar, ReR: op.ReR }, { s, load: op.load });
    return Object.assign(r, { id: br.id, a: aOf(br.id) });
  });
  const cq = partialCQ(branches.map(b => b.I_full), blade.copies);
  return { lam: op.lam, partialCQ: cq, coverage: Math.min(...branches.map(b => b.coverage)), branches };
}
// λ 掃描:回傳每個 λ 的部分 CQ(缺完整窗為 null)與最低支撐率
export function sweepLambda(blade, op, lams, mods = {}) {
  return lams.map(lam => { const r = analyzeBlade(blade, Object.assign({}, op, { lam }), mods); return { lam, partialCQ: r.partialCQ, coverage: r.coverage }; });
}
// 由函式定義取樣出葉片定義檔(例如回翼 v0.2 + candidate146)
export function sampleBladeV1(defs, opt) {
  const s = linspace(opt.s0, opt.s1, opt.n);
  const r6 = v => +v.toPrecision(12);
  return {
    schema: BLADE_SCHEMA, name: opt.name, note: opt.note || '', units: 'R', copies: opt.copies || 1, window: opt.window || [opt.s0, opt.s1],
    branches: defs.map(d => ({
      id: d.branch, profile: String(d.profile), mirror: !!d.mirror,
      stations: s.map(v => { const x = d.x(v); return { s: r6(v), x: r6(x[0]), y: r6(x[1]), z: r6(x[2]), chord: r6(d.chord(v)), beta: r6(d.beta(v)) }; }),
    })),
  };
}
// 序列化葉片定義:每個取樣站一行,方便人工檢視與差異比對
export function bladeToJSON(b) {
  const head = { schema: b.schema, name: b.name, note: b.note, units: b.units || 'R', copies: b.copies, window: b.window };
  const lines = ['{'];
  for (const [k, v] of Object.entries(head)) if (v !== '' && v != null) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  lines.push('  "branches": [');
  b.branches.forEach((br, i) => {
    lines.push(`    { "id": ${JSON.stringify(br.id)}, "profile": ${JSON.stringify(br.profile)}, "mirror": ${!!br.mirror}, "stations": [`);
    br.stations.forEach((p, j) => lines.push('      ' + JSON.stringify(p) + (j < br.stations.length - 1 ? ',' : '')));
    lines.push('    ] }' + (i < b.branches.length - 1 ? ',' : ''));
  });
  lines.push('  ]', '}');
  return lines.join('\n') + '\n';
}
