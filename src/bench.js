/* ===== Shared drawing helpers ===== */
function fitCv(cv) {
  const fs = Plot.draw.force;
  const dpr = fs ? fs.dpr : (window.devicePixelRatio || 1);
  const W = fs ? fs.W : cv.clientWidth, H = fs ? fs.H : cv.clientHeight;
  if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.font = '11px ' + Plot.css('--font-ui');
  return { g, W, H };
}
function interp1(xs, ys, x) {
  const n = xs.length; if (!n) return NaN; if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
  const w = (x - xs[i]) / (xs[i + 1] - xs[i]); return ys[i] + w * (ys[i + 1] - ys[i]);
}
function arrow(g, x0, y0, x1, y1, color, w, head) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 2) return;
  const hd = Math.min(head || 8, L * 0.45), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w || 1.6;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * hd - uy * hd * 0.45, y1 - uy * hd + ux * hd * 0.45); g.lineTo(x1 - ux * hd + uy * hd * 0.45, y1 - uy * hd - ux * hd * 0.45); g.closePath(); g.fill();
}
function hexMix(a, b, t) {
  const p = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const A1 = p(a), B1 = p(b); return `rgb(${A1.map((v, i) => Math.round(v + (B1[i] - v) * t)).join(',')})`;
}
function card(title, inner, cls, id, open) {
  return `<div class="card ${cls || ''}"${id ? ` id="${id}"` : ''}><details ${open === false ? '' : 'open'}><summary>${title}</summary><div class="cbx">${inner}</div></details></div>`;
}
function afOutline(af) { return { x: [...af.x, ...af.x.slice().reverse()], y: [...af.yu, ...af.yl.slice().reverse()] }; }
function stationBlendLabel(x) {
  const st = stSorted(), lab = k => afLabel(k).replace('NACA ', '');
  if (x <= st[0].f) return lab(st[0].k);
  if (x >= st[st.length - 1].f) return lab(st[st.length - 1].k);
  let j = 0; while (j < st.length - 2 && x > st[j + 1].f) j++;
  const a = st[j], b = st[j + 1], w = (x - a.f) / Math.max(1e-6, b.f - a.f);
  if (a.k === b.k) return lab(a.k);
  return `${lab(a.k)} ${Math.round((1 - w) * 100)}% + ${lab(b.k)} ${Math.round(w * 100)}%`;
}

/* ===== Single-blade workbench ===== */
const Bench = (function () {
  const B = { rr: 0.7, lam: null, q: 'alpha', th: 60, zf: 0.5 };
  let built = '', cache = { key: '', res: null }, drag = false;
  const $b = id => document.getElementById(id);

  function lamNow() { return B.lam == null ? (S.mode === 'HAWT' ? S.hawt.tsr : G.lopt) : B.lam; }
  function hawtAt(lam) {
    const key = G.gen + '|' + lam.toFixed(3) + '|' + S.hawt.pitch;
    if (cache.key !== key) { const V = S.hawt.Vd; cache = { key, res: A.bemPoint(hawtCfg(), V, lam * V / G.R, 0, S.hawt.pitch, null) }; }
    return cache.res;
  }
  function vawtAt(lam) {
    const key = G.gen + '|v|' + lam.toFixed(3);
    if (cache.key !== key) cache = { key, res: A.dmstPoint(G.vcfg, 8, Math.max(0.2, lam)) };
    return cache.res;
  }
  function layout() {
    const H = S.mode === 'HAWT', sav = !H && S.vawt.type === 'sav';
    const sig = S.mode + (H ? '' : S.vawt.type);
    if (built === sig) return;
    built = sig;
    let h = '';
    if (sav) {
      h += `<div class="card"><h2>Savonius 阻力型轉子</h2><div class="cbx"><p class="hint">Savonius 由半圓筒葉片構成,靠阻力差產生轉矩,沒有翼型剖面可分析。下圖為俯視幾何與經驗性能曲線;若要分析翼型葉片,請在「轉子」設定改選 H 型、螺旋型、Φ 型或 V 型。</p></div></div>
        <div class="bgrid"><div class="card">${'<h2>俯視幾何</h2>'}<div class="cbx"><canvas id="bSav" style="height:300px"></canvas></div></div><div class="card span2"><h2>Cp–λ(經驗曲線)</h2><div class="cbx"><canvas id="bSavCp" style="height:300px"></canvas></div></div></div>`;
      $b('benchInner').innerHTML = h; return;
    }
    const lmax = Math.max(2, (G.perf ? G.perf.lam[G.perf.lam.length - 1] : 12));
    h += `<div class="card"><div class="ctrlbar">
      ${H ? `<label>剖面位置 r/R <input type="range" id="bR" min="0" max="1" step="0.005"><output id="bRo"></output></label>`
          : `<label>方位角 θ <input type="range" id="bTh" min="0" max="359" step="1"><output id="bTho"></output></label>
             ${S.vawt.type !== 'H' ? `<label>高度 z/H <input type="range" id="bZ" min="0.05" max="0.95" step="0.01"><output id="bZo"></output></label>` : ''}`}
      <label>分析尖速比 λ <input type="range" id="bL" min="0.5" max="${lmax.toFixed(1)}" step="0.05"><output id="bLo"></output></label>
      <button class="iconbtn" id="bLd">${H ? '設計點 λd' : '最佳 λopt'}</button><button class="iconbtn" id="bLop">目前運轉點</button>
    </div></div>`;
    if (H) {
      h += `<div class="bgrid">
        ${card('葉片平面形狀與翼型配置 <span class="hint" style="font-weight:400">· 點選或拖曳選擇剖面</span>', '<canvas id="bPlan" style="height:230px;touch-action:none;cursor:ew-resize"></canvas>', 'span2')}
        ${card('剖面資料', '<div class="kv" id="bKv"></div>')}
        ${card('剖面形狀與速度三角形', '<canvas id="bSec" style="height:320px"></canvas>', 'span2')}
        ${card('此剖面的極曲線', '<canvas id="bPol" style="height:320px"></canvas>')}
        ${card('剖面疊圖(由葉尖往輪轂看)', '<canvas id="bStack" style="height:300px"></canvas>')}
        ${card('沿展長的氣動特性變化', `<div class="ctrlbar" style="padding:0 0 8px"><label>顯示 <select id="bQ">${[['alpha', '攻角 α(實際 vs 最佳升阻比)'], ['clcd', '升力係數 Cl / 阻力係數 Cd'], ['ld', '升阻比 L/D'], ['re', '雷諾數 Re'], ['load', '推力與轉矩分布 dT/dr、dQ/dr'], ['ind', '誘導因子 a、a′ 與葉尖損失 F'], ['geom', '弦長 c/R 與扭角 θ'], ['phi', '入流角 φ 與扭角 θ'], ['tc', '相對厚度 t/c']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label></div><canvas id="bSpan" style="height:252px"></canvas>`, 'span2')}
        ${card('結構概估(設計點,水平軸限定)', '<div class="kv" id="bStKv"></div><canvas id="bStSpan" style="height:220px"></canvas>', 'span2')}
      </div>`;
    } else {
      h += `<div class="bgrid">
        ${card('葉片外形(側視)', '<canvas id="bSide" style="height:300px"></canvas>')}
        ${card('俯視:葉片位置與速度三角形', '<canvas id="bTop" style="height:300px"></canvas>')}
        ${card('剖面資料', '<div class="kv" id="bKv"></div>')}
        ${card('攻角隨方位角變化(中段剖面)', '<canvas id="bAl" style="height:280px"></canvas>')}
        ${card('轉矩隨方位角變化', '<canvas id="bQz" style="height:280px"></canvas>')}
        ${card('翼型極曲線(局部雷諾數)', '<canvas id="bPol" style="height:280px"></canvas>')}
      </div>`;
    }
    $b('benchInner').innerHTML = h;
    const on = (id, ev, fn) => { const e = $b(id); if (e) e.addEventListener(ev, fn); };
    on('bR', 'input', e => { B.rr = +e.target.value; render(); });
    on('bTh', 'input', e => { B.th = +e.target.value; render(); });
    on('bZ', 'input', e => { B.zf = +e.target.value; render(); });
    on('bL', 'input', e => { B.lam = +e.target.value; render(); });
    on('bLd', 'click', () => { B.lam = null; render(); });
    on('bLop', 'click', () => { if (SIM.out && SIM.out.lam > 0.2) { B.lam = +SIM.out.lam.toFixed(2); render(); } else toast('轉子尚未運轉'); });
    on('bQ', 'change', e => { B.q = e.target.value; render(); });
    document.querySelectorAll('#benchInner details').forEach(d => d.addEventListener('toggle', () => { if (d.open) render(); }));
    const plan = $b('bPlan');
    if (plan) {
      const pick = ev => { const r = plan.getBoundingClientRect(), padL = 16, padR = 16; const f = (ev.clientX - r.left - padL) / (r.width - padL - padR); B.rr = A.clamp(f, G.Rhub / G.R + 0.01, 0.995); render(); };
      plan.addEventListener('pointerdown', e => { drag = true; plan.setPointerCapture(e.pointerId); pick(e); });
      plan.addEventListener('pointermove', e => { if (drag) pick(e); });
      plan.addEventListener('pointerup', () => { drag = false; });
    }
  }
  function syncCtrls(lam) {
    const set = (id, v, txt) => { const e = $b(id); if (e && document.activeElement !== e) e.value = v; const o = $b(id + 'o'); if (o) o.textContent = txt; };
    set('bR', B.rr, B.rr.toFixed(3)); set('bTh', B.th, B.th + '°'); set('bZ', B.zf, B.zf.toFixed(2)); set('bL', lam, lam.toFixed(2) + (B.lam == null ? '(設計)' : ''));
    const q = $b('bQ'); if (q) q.value = B.q;
  }

  /* ---- HAWT ---- */
  function sectionAt(res, rr) {
    const R = G.R, r = rr * R, rows = G.rows, rs = rows.map(x => x.r), el = res.elems;
    const pick = f => interp1(rs, el.map(f), r);
    const bl = afBlendAt(rr);
    const c = interp1(rs, rows.map(x => x.c), r), tw = interp1(rs, rows.map(x => x.tw), r);
    const { rho, mu } = air();
    const W = pick(e => e.W), Re = rho * W * c / mu;
    const alpha = pick(e => e.alpha), phi = pick(e => e.phi);
    const [cl, cd] = A.lookup(bl.ps, alpha * A.D2R, Math.max(1e3, Re));
    return { r, rr, c, tw, th: tw + S.hawt.pitch, phi, alpha, a: pick(e => e.a), ap: pick(e => e.ap), F: pick(e => e.F), W, Re, cl, cd, af: bl.af, ps: bl.ps };
  }
  function secWorld(af, c, thDeg, n) { // returns array of [x,y] world points (x axial, y tangential)
    const th = thDeg * A.D2R, ex = [Math.sin(th), -Math.cos(th)], nn = [Math.cos(th), Math.sin(th)], P = 0.3;
    const o = afOutline(af), pts = [];
    for (let i = 0; i < o.x.length; i++) { const a = (o.x[i] - P) * c, b = o.y[i] * c; pts.push([a * ex[0] + b * nn[0], a * ex[1] + b * nn[1]]); }
    return pts;
  }
  function drawPlan(cv, rr) {
    const F = fitCv(cv); if (!F) return; const { g, W, H } = F;
    const R = G.R, rows = G.rows, padL = 16, padR = 16, padT = 30, padB = 26;
    const X = f => padL + f * (W - padL - padR);
    const cmax = Math.max(...rows.map(x => x.c));
    const ys = (H - padT - padB) / cmax, xs = (W - padL - padR) / R, exag = ys / xs;
    const y0 = padT + 0.3 * cmax * ys; // pitch axis
    const tcs = G.afs.map(a => a.t), tmin = Math.min(...tcs), tmax = Math.max(...tcs);
    const cA = Plot.css('--c1'), cB = Plot.css('--c4');
    const colT = t => hexMix(cA, cB, tmax - tmin > 1e-4 ? (t - tmin) / (tmax - tmin) : 0.5);
    // hub
    g.fillStyle = Plot.css('--panel2'); g.strokeStyle = Plot.css('--muted'); g.lineWidth = 1;
    g.beginPath(); g.rect(X(0), y0 - 0.3 * cmax * ys * 0.6, X(G.Rhub / R) - X(0), cmax * ys * 0.6); g.fill(); g.stroke();
    // strips
    const edges = [G.Rhub, ...rows.map((x, i) => i < rows.length - 1 ? (x.r + rows[i + 1].r) / 2 : R)];
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i].c, xa = X(edges[i] / R), xb = X(edges[i + 1] / R);
      g.fillStyle = colT(tcs[i]); g.globalAlpha = 0.85;
      g.fillRect(xa, y0 - 0.3 * c * ys, xb - xa + 0.5, c * ys); g.globalAlpha = 1;
    }
    // outline LE / TE
    g.strokeStyle = Plot.css('--ink'); g.lineWidth = 1.3;
    g.beginPath(); rows.forEach((x, i) => { const px = X(x.r / R), py = y0 - 0.3 * x.c * ys; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    g.beginPath(); rows.forEach((x, i) => { const px = X(x.r / R), py = y0 + 0.7 * x.c * ys; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    g.setLineDash([6, 4]); g.strokeStyle = Plot.css('--muted'); g.beginPath(); g.moveTo(X(0), y0); g.lineTo(X(1), y0); g.stroke(); g.setLineDash([]);
    // stations
    g.textAlign = 'center'; g.textBaseline = 'top';
    stSorted().forEach(s => {
      const px = X(s.f); g.strokeStyle = Plot.css('--muted'); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, padT - 4); g.lineTo(px, H - padB + 2); g.stroke(); g.setLineDash([]);
      g.fillStyle = Plot.css('--ink'); g.fillText(afLabel(s.k).replace('NACA ', ''), A.clamp(px, 30, W - 30), 4);
      g.fillStyle = Plot.css('--muted'); g.fillText(s.f.toFixed(2), A.clamp(px, 20, W - 20), 16);
    });
    // selected
    const px = X(rr); g.strokeStyle = Plot.css('--signal'); g.lineWidth = 2.5; g.beginPath(); g.moveTo(px, padT - 2); g.lineTo(px, H - padB); g.stroke();
    g.fillStyle = Plot.css('--signal'); g.beginPath(); g.arc(px, H - padB, 5, 0, 7); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = Plot.css('--muted');
    g.fillText(W < 600 ? `弦向×${exag.toFixed(1)} · 顏色 t/c ${(tmin * 100).toFixed(0)}→${(tmax * 100).toFixed(0)}%` : `弦向放大 ×${exag.toFixed(1)} · 顏色:相對厚度 t/c ${(tmin * 100).toFixed(1)}%(淺)→ ${(tmax * 100).toFixed(1)}%(深) · 虛線:變槳軸(30% 弦長)`, padL, H - 4);
    g.textAlign = 'right'; g.fillText('葉尖 →', W - padR, H - 4);
  }
  const RW = p => [p[1], -p[0]]; // display: tangential → right, axial (wind) → down
  function worldFit(W, H, bb, pad) {
    const sx = (W - 2 * pad) / (bb[2] - bb[0]), sy = (H - 2 * pad) / (bb[3] - bb[1]), s = Math.min(sx, sy);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    return { s, T: (x, y) => [W / 2 + (x - cx) * s, H / 2 - (y - cy) * s] };
  }
  function drawSec(cv, sec, lam) {
    const F = fitCv(cv); if (!F) return; const { g, W, H } = F;
    const pts = secWorld(sec.af, sec.c, sec.th).map(RW), c = sec.c;
    const ph = sec.phi * A.D2R;
    // velocity triangle placed upstream (-x) of LE along -W
    const le = RW(secWorld({ x: [0], yu: [0], yl: [0] }, c, sec.th)[0]);
    const Lw = 1.25 * c, wv = RW([Math.sin(ph), -Math.cos(ph)]);
    const s0 = [le[0] - wv[0] * (Lw + 0.08 * c), le[1] - wv[1] * (Lw + 0.08 * c)], s1 = [s0[0] + wv[0] * Lw, s0[1] + wv[1] * Lw];
    const xsA = [s0[0], s1[0], ...pts.map(p => p[0])], ysA = [s0[1], s1[1], ...pts.map(p => p[1])];
    const bb = [Math.min(...xsA) - 0.25 * c, Math.min(...ysA) - 0.6 * c, Math.max(...xsA) + 0.35 * c, Math.max(...ysA) + 0.3 * c];
    const { s, T } = worldFit(W, H - 36, bb, 18);
    // rotor plane
    const pv = T(0, 0);
    g.strokeStyle = Plot.css('--grid'); g.lineWidth = 1; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(8, pv[1]); g.lineTo(W - 8, pv[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle = Plot.css('--muted'); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('旋轉平面', 10, pv[1] - 3);
    // airfoil
    g.beginPath(); pts.forEach((p, i) => { const q = T(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
    g.fillStyle = Plot.css('--panel2'); g.fill(); g.strokeStyle = Plot.css('--ink'); g.lineWidth = 1.5; g.stroke();
    // chord line
    const te = RW(secWorld({ x: [1], yu: [0], yl: [0] }, c, sec.th)[0]), a1 = T(le[0], le[1]), a2 = T(te[0], te[1]);
    g.strokeStyle = Plot.css('--muted'); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke(); g.setLineDash([]);
    // velocity triangle
    const A0 = T(s0[0], s0[1]), A1 = T(s1[0], s1[1]);
    const ax = [s0[0], s0[1] + wv[1] * Lw], Ax = T(ax[0], ax[1]);
    arrow(g, A0[0], A0[1], Ax[0], Ax[1], Plot.css('--c3'), 1.6);
    arrow(g, Ax[0], Ax[1], A1[0], A1[1], Plot.css('--c2'), 1.6);
    arrow(g, A0[0], A0[1], A1[0], A1[1], Plot.css('--c1'), 2.4, 10);
    g.font = '11px ' + Plot.css('--font-ui'); g.textBaseline = 'middle';
    g.fillStyle = Plot.css('--c3'); g.textAlign = 'right'; g.fillText('V(1−a)', A0[0] - 5, (A0[1] + Ax[1]) / 2);
    g.fillStyle = Plot.css('--c2'); g.textAlign = 'center'; g.fillText('Ωr(1+a′)', (Ax[0] + A1[0]) / 2, Ax[1] + 10);
    g.fillStyle = Plot.css('--c1'); g.textAlign = 'left'; g.fillText('W', (A0[0] + A1[0]) / 2 + 6, (A0[1] + A1[1]) / 2 - 8);
    // forces at quarter chord
    const qc = RW(secWorld({ x: [0.25], yu: [0], yl: [0] }, c, sec.th)[0]), Q = T(qc[0], qc[1]);
    const Lh = RW([Math.cos(ph), Math.sin(ph)]), Dh = wv, kF = 0.55 * c * s;
    const Lx = Q[0] + Lh[0] * kF * sec.cl, Ly = Q[1] - Lh[1] * kF * sec.cl;
    arrow(g, Q[0], Q[1], Lx, Ly, Plot.css('--c4'), 2);
    arrow(g, Q[0], Q[1], Q[0] + Dh[0] * kF * sec.cd * 10, Q[1] - Dh[1] * kF * sec.cd * 10, Plot.css('--warn'), 2);
    g.fillStyle = Plot.css('--c4'); g.textAlign = 'left'; g.fillText('升力 L', Lx + 4, Ly);
    g.fillStyle = Plot.css('--warn'); g.fillText('阻力 D ×10', Q[0] + Dh[0] * kF * sec.cd * 10 + 4, Q[1] - Dh[1] * kF * sec.cd * 10 + 10);
    // legend strip
    g.fillStyle = Plot.css('--muted'); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('風 ↓(軸向)   葉片運動 →(切向)', 10, H - 22);
    g.fillStyle = Plot.css('--ink'); g.font = '600 12px ' + Plot.css('--font-ui');
    g.fillText(`θ ${sec.th.toFixed(2)}°  φ ${sec.phi.toFixed(2)}°  α = φ − θ = ${sec.alpha.toFixed(2)}°`, 10, H - 6);
  }
  function drawStack(cv, rr) {
    const F = fitCv(cv); if (!F) return; const { g, W, H } = F;
    const rows = G.rows, R = G.R, sets = rows.map((x, i) => ({ pts: secWorld(G.afs[i], x.c, x.tw + S.hawt.pitch).map(RW), f: x.r / R }));
    const all = sets.flatMap(s => s.pts);
    const bb = [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))];
    const { T } = worldFit(W, H - 24, bb, 16);
    const cA = Plot.css('--c4'), cB = Plot.css('--c1');
    let near = 0; sets.forEach((s, i) => { if (Math.abs(s.f - rr) < Math.abs(sets[near].f - rr)) near = i; });
    sets.forEach((s, i) => {
      g.beginPath(); s.pts.forEach((p, k) => { const q = T(p[0], p[1]); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
      g.strokeStyle = hexMix(cA, cB, i / Math.max(1, sets.length - 1)); g.lineWidth = 1; g.stroke();
    });
    const s = sets[near]; g.beginPath(); s.pts.forEach((p, k) => { const q = T(p[0], p[1]); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
    g.strokeStyle = Plot.css('--signal'); g.lineWidth = 2.5; g.stroke();
    const pv = T(0, 0); g.fillStyle = Plot.css('--ink'); g.beginPath(); g.arc(pv[0], pv[1], 3, 0, 7); g.fill();
    g.fillStyle = Plot.css('--muted'); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(`${rows.length} 個剖面,紫(根部)→ 藍(葉尖);黃色為選取剖面 r/R ${s.f.toFixed(2)};黑點為變槳軸`, 10, H - 6);
  }
  function drawSpan(cv, res, rr) {
    const R = G.R, x = G.rows.map(r => r.r / R), el = res.elems, rows = G.rows, { rho, mu } = air();
    const q = r => 0.5 * rho * r.W * r.W;
    const Bn = Math.round(S.hawt.B);
    const Re = el.map((e, i) => rho * e.W * rows[i].c / mu);
    let o;
    const col = n => Plot.css(n);
    switch (B.q) {
      case 'alpha': { const best = rows.map((r, i) => A.bestLD(G.pss[i], Re[i], [-2, 14]).a);
        o = { title: '攻角分布', series: [{ x, y: el.map(e => e.alpha), color: col('--c1'), label: '實際 α', dots: 2 }, { x, y: best, color: col('--muted'), dash: [4, 3], label: '最佳升阻比 α' }], ylabel: 'α (°)' }; break; }
      case 'clcd': o = { title: '升力與阻力係數', series: [{ x, y: el.map(e => e.cl), color: col('--c1'), label: 'Cl', dots: 2 }, { x, y: el.map(e => e.cd), color: col('--c2'), axis: 'R', label: 'Cd', dots: 2 }], ylabel: 'Cl', ylabelR: 'Cd' }; break;
      case 'ld': o = { title: '升阻比 L/D', series: [{ x, y: el.map(e => e.cl / Math.max(1e-4, e.cd)), color: col('--c3'), label: 'L/D', dots: 2 }], ylabel: 'L/D' }; break;
      case 're': o = { title: '局部雷諾數', series: [{ x, y: Re.map(v => v / 1e5), color: col('--c4'), label: 'Re (×10⁵)', dots: 2 }], ylabel: 'Re ×10⁵' }; break;
      case 'load': { const dT = el.map((e, i) => { const p = e.phi * A.D2R; return Bn * q(e) * rows[i].c * (e.cl * Math.cos(p) + e.cd * Math.sin(p)); });
        const dQ = el.map((e, i) => { const p = e.phi * A.D2R; return Bn * q(e) * rows[i].c * (e.cl * Math.sin(p) - e.cd * Math.cos(p)) * e.r; });
        o = { title: `載重分布(V = ${fmt(S.hawt.Vd, 1)} m/s)`, series: [{ x, y: dT, color: col('--c2'), label: 'dT/dr (N/m)', dots: 2 }, { x, y: dQ, color: col('--c1'), axis: 'R', label: 'dQ/dr (N·m/m)', dots: 2 }], ylabel: 'N/m', ylabelR: 'N·m/m' }; break; }
      case 'ind': o = { title: '誘導因子與葉尖損失', series: [{ x, y: el.map(e => e.a), color: col('--c1'), label: 'a', dots: 2 }, { x, y: el.map(e => e.ap), color: col('--c2'), label: 'a′', dots: 2 }, { x, y: el.map(e => e.F), color: col('--c4'), dash: [4, 3], label: 'F' }, { x: [0, 1], y: [1 / 3, 1 / 3], color: col('--muted'), dash: [2, 3], width: 1, label: 'a = 1/3' }], ylabel: '' }; break;
      case 'geom': o = { title: '弦長與扭角', series: [{ x, y: rows.map(r => r.c / R), color: col('--c1'), label: 'c/R', dots: 2 }, { x, y: rows.map(r => r.tw + S.hawt.pitch), color: col('--c2'), axis: 'R', label: 'θ (°)', dots: 2 }], ylabel: 'c/R', ylabelR: 'θ (°)' }; break;
      case 'phi': o = { title: '入流角與扭角(差值即攻角)', series: [{ x, y: el.map(e => e.phi), color: col('--c1'), label: 'φ', dots: 2 }, { x, y: rows.map(r => r.tw + S.hawt.pitch), color: col('--c2'), label: 'θ', dots: 2 }], ylabel: '角度 (°)' }; break;
      default: o = { title: '相對厚度', series: [{ x, y: G.afs.map(a => a.t * 100), color: col('--c4'), label: 't/c (%)', dots: 2 }], ylabel: 't/c (%)' };
    }
    Plot.draw(cv, { ...o, xlim: [0, 1], xlabel: 'r/R', vlines: [{ x: rr, color: col('--signal') }, ...stSorted().map(s => ({ x: s.f, color: col('--grid') }))] });
  }
  function drawStruct(cv, kvEl) {
    const st = G.struct;
    if (!st) return;
    const R = G.R, x = st.r.map(r => r / R), col = n => Plot.css(n);
    Plot.draw(cv, { title: '合成應力 σ 與容許應力(材料估計值)', series: [
        { x, y: st.sigma.map(v => v / 1e6), color: col('--c2'), label: 'σ 合成應力', dots: 2 },
        { x, y: st.r.map(() => st.sigAllow / 1e6), color: col('--warn'), dash: [4, 3], label: '容許應力' },
      ], xlim: [0, 1], xlabel: 'r/R', ylabel: 'MPa', vlines: [{ x: st.r[st.minSFIdx] / R, color: col('--signal') }] });
    if (kvEl) kv(kvEl, [
      ['根部彎矩(揮舞 / 擺振)', `${fmt(st.root.Mflap, 1)} / ${fmt(st.root.Medge, 1)} N·m`],
      ['根部離心軸向力', fmt(st.root.Nax, 0) + ' N'],
      ['最大合成應力', fmt(st.maxSigma / 1e6, 2) + ' MPa @ r/R ' + (st.r[st.minSFIdx] / R).toFixed(2)],
      ['安全係數(最小)', fmt(st.minSF, 2) + '(容許 ' + fmt(st.sigAllow / 1e6, 0) + ' MPa)'],
      ['葉尖撓度(揮舞 / 擺振)', `${fmt(st.tipDeflFlap * 1000, 1)} / ${fmt(st.tipDeflEdge * 1000, 2)} mm`],
    ]);
  }
  function renderHAWT(lam) {
    const res = hawtAt(lam);
    B.rr = A.clamp(B.rr, G.Rhub / G.R + 0.01, 0.995);
    const sec = sectionAt(res, B.rr);
    const Rn = $b('bR'); if (Rn) Rn.min = (G.Rhub / G.R + 0.01).toFixed(3);
    syncCtrls(lam);
    drawPlan($b('bPlan'), B.rr);
    drawSec($b('bSec'), sec, lam);
    drawStack($b('bStack'), B.rr);
    const al = [], cls = [], cds = []; for (let d = -10; d <= 25; d += 0.25) { const v = A.lookup(sec.ps, d * A.D2R, sec.Re); al.push(d); cls.push(v[0]); cds.push(v[1]); }
    Plot.draw($b('bPol'), { title: `Re ${(sec.Re / 1e5).toFixed(2)}×10⁵ · t/c ${(sec.af.t * 100).toFixed(1)}%`, series: [{ x: al, y: cls, color: Plot.css('--c1'), label: 'Cl' }, { x: al, y: cds, color: Plot.css('--c2'), axis: 'R', label: 'Cd' }],
      markers: [{ x: sec.alpha, y: sec.cl, color: Plot.css('--signal'), label: `α ${sec.alpha.toFixed(1)}°` }], xlabel: '攻角 α (°)', ylabel: 'Cl', ylabelR: 'Cd', vlines: [{ x: 0, color: Plot.css('--grid') }] });
    drawSpan($b('bSpan'), res, B.rr);
    drawStruct($b('bStSpan'), $b('bStKv'));
    const Om = lam * S.hawt.Vd / G.R;
    kv($b('bKv'), [['位置 r', `${fmt(sec.r, 3)} m(r/R ${sec.rr.toFixed(3)})`], ['翼型組合', stationBlendLabel(sec.rr)], ['相對厚度 t/c', (sec.af.t * 100).toFixed(1) + '%'],
      ['弦長 c', fmt(sec.c * 1000, 1) + ' mm'], ['扭角 + 槳距 θ', fmt(sec.th, 2) + '°'], ['入流角 φ', fmt(sec.phi, 2) + '°'], ['攻角 α', fmt(sec.alpha, 2) + '°'],
      ['局部尖速比 λr', fmt(lam * sec.rr, 2)], ['相對風速 W', fmt(sec.W, 1) + ' m/s'], ['雷諾數 Re', (sec.Re / 1e5).toFixed(2) + '×10⁵'],
      ['Cl / Cd', `${fmt(sec.cl, 3)} / ${fmt(sec.cd, 4)}`], ['升阻比 L/D', fmt(sec.cl / Math.max(1e-4, sec.cd), 1)], ['誘導因子 a / a′', `${fmt(sec.a, 3)} / ${fmt(sec.ap, 3)}`],
      ['葉尖損失 F', fmt(sec.F, 3)], ['轉子 Cp(此 λ)', fmt(res.Cp, 3)], ['轉速', fmt(Om * 30 / Math.PI, 0) + ` rpm @ ${fmt(S.hawt.Vd, 1)} m/s`]]);
  }

  /* ---- VAWT ---- */
  function renderVAWT(lam) {
    const res = vawtAt(lam), cfg = G.vcfg, sl = A.vawtSlices(cfg);
    syncCtrls(lam);
    const zf = S.vawt.type === 'H' ? 0.5 : B.zf;
    const slc = sl.reduce((b, s) => Math.abs(s.zf - zf) < Math.abs(b.zf - zf) ? s : b, sl[0]);
    const Rl = slc.r, th = B.th * A.D2R, V = 8, Om = lam * V / cfg.R;
    const mid = res.mid || [];
    const thU = Math.atan2(Math.sin(th), Math.cos(th)); // -pi..pi
    const upwind = Math.cos(th) >= 0;
    const tq = upwind ? thU : Math.atan2(Math.sin(Math.PI - th), Math.cos(Math.PI - th));
    const m = mid.length ? mid.reduce((b, x) => Math.abs(x.th - tq) < Math.abs(b.th - tq) ? x : b, mid[0]) : { up: 0.8, ve: 0.6, dn: 0.5 };
    const u = V * (upwind ? m.up : m.dn);
    const t = [Math.sin(th), Math.cos(th)], rhat = [-Math.cos(th), Math.sin(th)];
    const Wv = [u - Om * Rl * t[0], -Om * Rl * t[1]];
    const Wt = -(Wv[0] * t[0] + Wv[1] * t[1]), Wn = Wv[0] * rhat[0] + Wv[1] * rhat[1];
    const alpha = Math.atan2(-Wn, Wt) * A.R2D - S.vawt.pitch;
    const Wm = Math.hypot(Wv[0], Wv[1]), { rho, mu } = air(), Re = rho * Wm * cfg.c / mu;
    const ps = getPS(S.af.vawt), [cl, cd] = A.lookup(ps, alpha * A.D2R, Re);
    // side view
    (() => {
      const F = fitCv($b('bSide')); if (!F) return; const { g, W, H } = F;
      const Hh = cfg.H, R = cfg.R, s = Math.min((W - 40) / (2.4 * R), (H - 40) / (Hh * 1.1));
      const X = r => W / 2 + r * s, Y = z => H / 2 - z * s;
      g.strokeStyle = Plot.css('--muted'); g.lineWidth = 3; g.beginPath(); g.moveTo(X(0), Y(Hh * 0.55)); g.lineTo(X(0), Y(-Hh * 0.55)); g.stroke();
      [1, -1].forEach(sg => { g.strokeStyle = sg > 0 ? Plot.css('--ink') : Plot.css('--grid'); g.lineWidth = sg > 0 ? 3 : 2; g.beginPath(); sl.forEach((x, i) => { const px = X(sg * x.r), py = Y(x.z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); if (S.vawt.type === 'H' || S.vawt.type === 'helical') { g.moveTo(X(sg * R), Y(Hh / 2)); g.lineTo(X(sg * R), Y(-Hh / 2)); } g.stroke(); });
      g.strokeStyle = Plot.css('--signal'); g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(-R * 1.15), Y(slc.z)); g.lineTo(X(R * 1.15), Y(slc.z)); g.stroke(); g.setLineDash([]);
      g.fillStyle = Plot.css('--muted'); g.textAlign = 'left'; g.fillText(`選取高度 z/H ${slc.zf.toFixed(2)},局部半徑 ${fmt(Rl, 3)} m`, 8, H - 8);
    })();
    // top view
    (() => {
      const F = fitCv($b('bTop')); if (!F) return; const { g, W, H } = F;
      const s = Math.min(W, H - 20) / (2.9 * Rl), cx = W / 2, cy = (H - 20) / 2;
      const T = (x, y) => [cx + x * s, cy - y * s];
      g.strokeStyle = Plot.css('--grid'); g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, Rl * s, 0, 7); g.stroke(); g.setLineDash([]);
      arrow(g, 10, 18, 60, 18, Plot.css('--c3'), 2); g.fillStyle = Plot.css('--c3'); g.textAlign = 'left'; g.fillText('風', 64, 22);
      const af = getAf(S.af.vawt), cS = cfg.c;
      for (let k = 0; k < cfg.B; k++) {
        const tk = th + 2 * Math.PI * k / cfg.B, pos = [-Rl * Math.cos(tk), Rl * Math.sin(tk)], tt = [Math.sin(tk), Math.cos(tk)], rr = [-Math.cos(tk), Math.sin(tk)];
        const o = afOutline(af), pc = S.vawt.pitch * A.D2R, ca = Math.cos(pc), sa = Math.sin(pc);
        const ex = [-(tt[0] * ca - rr[0] * sa), -(tt[1] * ca - rr[1] * sa)], ny = [rr[0] * ca + tt[0] * sa, rr[1] * ca + tt[1] * sa];
        g.beginPath(); o.x.forEach((xx, i) => { const a = (xx - 0.3) * cS, b = o.y[i] * cS; const p = T(pos[0] + a * ex[0] + b * ny[0], pos[1] + a * ex[1] + b * ny[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath();
        g.fillStyle = k === 0 ? Plot.css('--signal') : Plot.css('--panel2'); g.fill(); g.strokeStyle = Plot.css('--ink'); g.lineWidth = 1; g.stroke();
        g.strokeStyle = Plot.css('--grid'); g.beginPath(); const p0 = T(0, 0), p1 = T(pos[0], pos[1]); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
      // velocity triangle at selected blade
      const pos = [-Rl * Math.cos(th), Rl * Math.sin(th)], P = T(pos[0], pos[1]), k = 0.9 * Rl * s / Math.max(Om * Rl, u, 1);
      const bv = [Om * Rl * t[0], Om * Rl * t[1]];
      arrow(g, P[0], P[1], P[0] + bv[0] * k, P[1] - bv[1] * k, Plot.css('--c2'), 1.8);
      arrow(g, P[0] - u * k, P[1], P[0], P[1], Plot.css('--c3'), 1.8);
      arrow(g, P[0] - Wv[0] * k, P[1] + Wv[1] * k, P[0], P[1], Plot.css('--c1'), 2.4, 10);
      g.fillStyle = Plot.css('--muted'); g.textAlign = 'left';
      g.fillText('綠:當地風速 u   橘:葉片速度 Ωr   藍:相對風速 W', 8, H - 6);
    })();
    // alpha & torque vs azimuth
    const n2 = res.alAz.length, azs = Array.from({ length: n2 }, (_, i) => (i + 0.5) * 360 / n2);
    const stall = A.bestLD(ps, Re, [0, 20]).a;
    Plot.draw($b('bAl'), { title: `攻角 vs 方位角(λ ${lam.toFixed(2)})`, series: [{ x: azs, y: Array.from(res.alAz), color: Plot.css('--c1'), label: 'α' }], xlim: [0, 360], xlabel: '方位角 θ (°)', ylabel: 'α (°)',
      vlines: [{ x: B.th, color: Plot.css('--signal') }], bands: [{ x0: 90, x1: 270, color: Plot.css('--grid') }] });
    const qb = Array.from(res.qAz), tot = qb.map((_, i) => { let sm = 0; for (let k = 0; k < cfg.B; k++) sm += qb[(i + Math.round(k * n2 / cfg.B)) % n2]; return sm; });
    Plot.draw($b('bQz'), { title: '轉矩 vs 方位角(V = 8 m/s)', series: [{ x: azs, y: tot, color: Plot.css('--c1'), label: '轉子總轉矩' }, { x: azs, y: qb, color: Plot.css('--c2'), dash: [4, 3], label: '單一葉片' }], xlim: [0, 360], xlabel: '方位角 θ (°)', ylabel: 'N·m', vlines: [{ x: B.th, color: Plot.css('--signal') }] });
    const al = [], cls = [], cds = []; for (let d = -25; d <= 25; d += 0.25) { const v = A.lookup(ps, d * A.D2R, Re); al.push(d); cls.push(v[0]); cds.push(v[1]); }
    const amin = Math.min(...res.alAz), amax = Math.max(...res.alAz);
    Plot.draw($b('bPol'), { title: `${afLabel(S.af.vawt)} · Re ${(Re / 1e5).toFixed(2)}×10⁵`, series: [{ x: al, y: cls, color: Plot.css('--c1'), label: 'Cl' }, { x: al, y: cds, color: Plot.css('--c2'), axis: 'R', label: 'Cd' }],
      bands: [{ x0: amin, x1: amax, color: Plot.css('--grid') }], markers: [{ x: alpha, y: cl, color: Plot.css('--signal'), label: `α ${alpha.toFixed(1)}°` }], xlabel: '攻角 α (°)', ylabel: 'Cl', ylabelR: 'Cd' });
    kv($b('bKv'), [['方位角 θ', B.th + '°(' + (upwind ? '上風半圈' : '下風半圈') + ')'], ['局部半徑', fmt(Rl, 3) + ' m'], ['當地風速 u', fmt(u, 2) + ' m/s(V = 8)'], ['葉片速度 Ωr', fmt(Om * Rl, 2) + ' m/s'],
      ['相對風速 W', fmt(Wm, 2) + ' m/s'], ['攻角 α(幾何)', fmt(alpha, 2) + '°'], ['一圈內攻角範圍', `${fmt(amin, 1)}° ~ ${fmt(amax, 1)}°`], ['估計失速角', '≈ ' + fmt(stall + 4, 0) + '°'],
      ['雷諾數 Re', (Re / 1e5).toFixed(2) + '×10⁵'], ['Cl / Cd', `${fmt(cl, 3)} / ${fmt(cd, 4)}`], ['轉子 Cp(此 λ)', fmt(res.Cp, 3)]]);
  }
  function renderSav() {
    const F = fitCv($b('bSav'));
    if (F) {
      const { g, W, H } = F, v = S.vawt, s = Math.min(W, H) / (2.6 * v.R), cx = W / 2, cy = H / 2, r = v.R / (2 - v.overlap) , e = v.overlap * 2 * r;
      g.strokeStyle = Plot.css('--grid'); g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, v.R * s, 0, 7); g.stroke(); g.setLineDash([]);
      const n = Math.round(v.B);
      for (let k = 0; k < n; k++) { const a = SIM.theta + 2 * Math.PI * k / n, off = (r - e / 2); const x = cx + Math.cos(a) * off * s, y = cy - Math.sin(a) * off * s; g.strokeStyle = Plot.css('--ink'); g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * s, -a, -a + Math.PI, false); g.stroke(); }
      arrow(g, 10, 18, 60, 18, Plot.css('--c3'), 2);
    }
    const P = G.perf; Plot.draw($b('bSavCp'), { title: 'Cp 與 Cq vs λ', series: [{ x: P.lam, y: P.cp, color: Plot.css('--c1'), label: 'Cp' }, { x: P.lam, y: P.cq, color: Plot.css('--c2'), axis: 'R', label: 'Cq' }], xlabel: '尖速比 λ', ylabel: 'Cp', ylabelR: 'Cq' });
  }

  function render() {
    if (!G.perf) return;
    layout();
    if (S.mode === 'VAWT' && S.vawt.type === 'sav') return renderSav();
    const lam = lamNow();
    if (S.mode === 'HAWT') renderHAWT(lam); else renderVAWT(lam);
  }
  function tick() { if (S.mode === 'VAWT' && S.vawt.type === 'sav') renderSav(); }
  return { render, tick, state: B, sectionAt, secWorld, hawtAt, vawtAt, drawPlan, drawSec, drawStack, drawSpan, drawStruct, reset() { built = ''; } };
})();
