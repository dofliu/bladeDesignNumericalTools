/* ===== Flow-field visualisation: airfoil section (panel method) + rotor (actuator / DMST streamtubes) ===== */
export const Flow = (function () {
  const F = { rr: 0.7, alpha: null, mode: 'speed', lines: true, lam: null, follow: false, tipv: false };
  let built = '', pcache = { key: '', solve: null }, lastFollow = 0;
  const $f = id => document.getElementById(id);

  function hexRGB(h) { h = (h || '#888').trim(); if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
  function makeMap() {
    const neutral = hexRGB(Plot.css('--panel2'));
    const st = [[0, [27, 58, 122]], [0.55, [77, 143, 216]], [1, neutral], [1.35, [240, 162, 75]], [1.9, [184, 65, 47]]];
    return s => {
      if (!isFinite(s)) return null;
      if (s <= st[0][0]) return st[0][1]; if (s >= st[st.length - 1][0]) return st[st.length - 1][1];
      let i = 0; while (s > st[i + 1][0]) i++;
      const w = (s - st[i][0]) / (st[i + 1][0] - st[i][0]); return st[i][1].map((v, k) => v + (st[i + 1][1][k] - v) * w);
    };
  }
  function colorbar(g, x, y, w, h, map, lab, ticks) {
    for (let i = 0; i < w; i++) { const c = map(ticks.min + (ticks.max - ticks.min) * i / w); g.fillStyle = `rgb(${c.map(Math.round).join(',')})`; g.fillRect(x + i, y, 1, h); }
    g.strokeStyle = Plot.css('--line'); g.strokeRect(x, y, w, h);
    g.fillStyle = Plot.css('--muted'); g.textAlign = 'center'; g.textBaseline = 'top';
    ticks.v.forEach(([v, t]) => g.fillText(t, x + w * (v - ticks.min) / (ticks.max - ticks.min), y + h + 2));
    g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(lab, x - 6, y + h / 2);
  }
  function inPoly(px, py, X, Y) { let c = false; for (let i = 0, j = X.length - 1; i < X.length; j = i++) if (((Y[i] > py) !== (Y[j] > py)) && (px < (X[j] - X[i]) * (py - Y[i]) / (Y[j] - Y[i]) + X[i])) c = !c; return c; }

  /* ---------- section inputs ---------- */
  function sectionInput() {
    if (S.mode === 'HAWT') {
      const lam = F.lam == null ? S.hawt.tsr : F.lam;
      const res = Bench.hawtAt(lam), sec = Bench.sectionAt(res, A.clamp(F.rr, G.Rhub / G.R + 0.01, 0.995));
      return { af: sec.af, ps: sec.ps, Re: sec.Re, aDes: sec.alpha, key: 'h' + G.gen + '|' + F.rr.toFixed(3), label: `r/R ${F.rr.toFixed(2)} · ${stationBlendLabel(F.rr)}` };
    }
    const af = getAf(S.af.vawt), { rho, mu } = air(), W = G.lopt * 8, Re = rho * W * S.vawt.c / mu;
    return { af, ps: getPS(S.af.vawt), Re, aDes: 8, key: 'v' + S.af.vawt, label: afLabel(S.af.vawt) };
  }
  function stallAngle(ps, Re) { let best = -9, a0 = 12; for (let d = 0; d <= 30; d += 0.25) { const c = A.lookup(ps, d * A.D2R, Re)[0]; if (c > best) { best = c; a0 = d; } } return a0; }

  /* ---------- airfoil section flow ---------- */
  function drawSection(cv, inp, alphaDeg, opts) {
    const Fc = fitCv(cv); if (!Fc) return null; const { g, W, H } = Fc;
    if (pcache.key !== inp.key) pcache = { key: inp.key, solve: A.panel(inp.af) };
    const al = alphaDeg * A.D2R, sol = pcache.solve(al), ca = Math.cos(al), sa = Math.sin(al);
    const x0 = -0.55, x1 = 1.75, s = W / (x1 - x0), yh = H / (2 * s), pv = 0.25, yc = 0.02;
    const toAf = (dx, dy) => { const X = dx - pv, Y = dy; return [pv + X * ca - Y * sa, X * sa + Y * ca]; };
    const toDisp = (ax, ay) => { const X = ax - pv, Y = ay; return [pv + X * ca + Y * sa, -X * sa + Y * ca]; };
    const scr = (dx, dy) => [(dx - x0) * s, H / 2 - (dy - yc) * s];
    const step = opts.coarse ? 5 : (W < 520 ? 4 : 3), GW = Math.ceil(W / step) + 1, GH = Math.ceil(H / step) + 1;
    const U = new Float32Array(GW * GH), Vv = new Float32Array(GW * GH), SP = new Float32Array(GW * GH);
    const PX = sol.X, PY = sol.Y;
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9; for (let i = 0; i < PX.length; i++) { xmin = Math.min(xmin, PX[i]); xmax = Math.max(xmax, PX[i]); ymin = Math.min(ymin, PY[i]); ymax = Math.max(ymax, PY[i]); }
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const dx = x0 + i * step / s, dy = yc + (H / 2 - j * step) / s;
      const [ax, ay] = toAf(dx, dy), k = j * GW + i;
      if (ax > xmin - 0.002 && ax < xmax + 0.002 && ay > ymin - 0.002 && ay < ymax + 0.002 && inPoly(ax, ay, PX, PY)) { U[k] = NaN; Vv[k] = NaN; SP[k] = NaN; continue; }
      const [u, v] = sol.vel(ax, ay), du = u * ca + v * sa, dv = -u * sa + v * ca;
      U[k] = du; Vv[k] = dv; SP[k] = Math.hypot(du, dv);
    }
    const map = makeMap(), off = document.createElement('canvas'); off.width = GW; off.height = GH;
    const og = off.getContext('2d'), img = og.createImageData(GW, GH);
    for (let k = 0; k < GW * GH; k++) {
      let val = SP[k]; if (opts.mode === 'cp' && isFinite(val)) { const cp = 1 - val * val; val = Math.sqrt(Math.max(0, 1 - Math.max(-3, cp))); }
      const c = map(val); if (!c) { img.data[4 * k + 3] = 0; continue; }
      img.data[4 * k] = c[0]; img.data[4 * k + 1] = c[1]; img.data[4 * k + 2] = c[2]; img.data[4 * k + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, GW, GH, 0, 0, (GW - 1) * step + step, (GH - 1) * step + step);
    // streamlines
    const samp = (dx, dy) => {
      const fi = (dx - x0) * s / step, fj = (H / 2 - (dy - yc) * s) / step, i = Math.floor(fi), j = Math.floor(fj);
      if (i < 0 || j < 0 || i >= GW - 1 || j >= GH - 1) return null;
      const wx = fi - i, wy = fj - j, k = j * GW + i;
      const q = [k, k + 1, k + GW, k + GW + 1]; if (q.some(t => !isFinite(U[t]))) return null;
      const w4 = [(1 - wx) * (1 - wy), wx * (1 - wy), (1 - wx) * wy, wx * wy];
      return [q.reduce((a, t, n) => a + U[t] * w4[n], 0), q.reduce((a, t, n) => a + Vv[t] * w4[n], 0)];
    };
    if (opts.lines) {
      const N = Math.max(14, Math.round(H / 16)), hs = 0.012;
      g.strokeStyle = Plot.css('--ink'); g.globalAlpha = 0.55; g.lineWidth = 0.9;
      for (let n = 0; n < N; n++) {
        let px = x0 + 0.01, py = yc - yh + (n + 0.5) * 2 * yh / N;
        g.beginPath(); let p = scr(px, py); g.moveTo(p[0], p[1]);
        for (let it = 0; it < 420; it++) {
          const v1 = samp(px, py); if (!v1) break; const m1 = Math.hypot(v1[0], v1[1]) || 1;
          const mx = px + 0.5 * hs * v1[0] / m1, my = py + 0.5 * hs * v1[1] / m1, v2 = samp(mx, my); if (!v2) break; const m2 = Math.hypot(v2[0], v2[1]) || 1;
          px += hs * v2[0] / m2; py += hs * v2[1] / m2; p = scr(px, py); g.lineTo(p[0], p[1]);
          if (px > x1) break;
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // airfoil body
    g.beginPath(); for (let i = 0; i < PX.length; i++) { const d = toDisp(PX[i], PY[i]), p = scr(d[0], d[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.closePath();
    g.fillStyle = Plot.css('--panel'); g.fill(); g.strokeStyle = Plot.css('--ink'); g.lineWidth = 1.4; g.stroke();
    // separation sketch
    const aS = stallAngle(inp.ps, inp.Re);
    const bl = A.boundaryLayer(sol, inp.Re), up = alphaDeg >= 0, blS = up ? bl.upper : bl.lower;
    const xsBL = blS.xSep, frac = xsBL == null ? 0 : A.clamp((1 - xsBL) / 0.7, 0.05, 1);
    if (frac > 0) {
      const xs = A.clamp(xsBL, 0.05, 0.98), af = inp.af, NX = af.x.length;
      g.save(); g.fillStyle = Plot.css('--warn'); g.globalAlpha = 0.22; g.beginPath();
      const surf = up ? af.yu : af.yl; let started = false;
      for (let i = 0; i < NX; i++) if (af.x[i] >= xs) { const d = toDisp(af.x[i], surf[i]), p = scr(d[0], d[1]); if (!started) { g.moveTo(p[0], p[1]); started = true; } else g.lineTo(p[0], p[1]); }
      const th = (0.08 + 0.5 * Math.min(1, frac)) * (up ? 1 : -1);
      const tip = toDisp(1.55, th + (up ? 0.05 : -0.05)), tip2 = toDisp(xs + 0.1, (up ? 1 : -1) * (0.06 + 0.25 * Math.min(1, frac)));
      let p = scr(tip[0], tip[1]); g.lineTo(p[0], p[1]); p = scr(tip2[0], tip2[1]); g.lineTo(p[0], p[1]); g.closePath(); g.fill(); g.restore();
    }
    // labels
    g.fillStyle = Plot.css('--ink'); g.font = '600 12px ' + Plot.css('--font-ui'); g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(W < 560 ? `α ${alphaDeg.toFixed(1)}° · 位勢流 Cl ${sol.cl.toFixed(2)}` : `${inp.label}  ·  α = ${alphaDeg.toFixed(1)}°  ·  位勢流 Cl = ${sol.cl.toFixed(2)}`, 10, 8);
    g.font = '11px ' + Plot.css('--font-ui'); g.fillStyle = Plot.css('--muted');
    g.fillText(`${W < 560 ? '失速角' : '估計失速角'} ≈ ${aS.toFixed(1)}°${W < 560 ? '' : `(Re ${(inp.Re / 1e5).toFixed(1)}×10⁵)`}  ·  轉捩 ${(blS.xTr ?? 1).toFixed(2)}  ·  ${xsBL == null ? '無分離' : '分離 ' + xsBL.toFixed(2)}`, 10, 26);
    if (frac > 0) { g.fillStyle = Plot.css('--warn'); g.font = '600 12px ' + Plot.css('--font-ui'); g.fillText(frac > 0.4 ? '⚠ 已接近或超過失速:紅色為邊界層積分估計的分離區(示意),位勢流結果不再可靠' : '注意:攻角偏大,後段邊界層開始分離', 10, 42); }
    const tk = opts.mode === 'cp' ? { min: 0, max: 2, v: [[0, 'Cp 1'], [1, '0'], [Math.sqrt(2), '−1'], [2, '−3']] } : { min: 0, max: 2, v: [[0, '0'], [1, '1'], [2, '2']] };
    colorbar(g, W - 170, H - 26, 150, 8, map, opts.mode === 'cp' ? '壓力係數' : '|V|/V∞', tk);
    return { sol, aS };
  }

  /* ---------- rotor flow ---------- */
  function fluxLines(g, uf, x0, x1, y0, y1, nx, seeds, axisym, T, color) {
    // for each column find y positions where cumulative flux equals the upstream flux of each seed
    const NY = 240, dy = (y1 - y0) / NY, cols = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, cum = [0];
      for (let j = 0; j < NY; j++) { const y = y0 + (j + 0.5) * dy, u = uf(x, y); cum.push(cum[j] + u * dy * (axisym ? 2 * Math.abs(y) : 1)); }
      cols.push({ x, cum });
    }
    const up = cols[0].cum, tot0 = up[NY];
    g.strokeStyle = color; g.lineWidth = 1; g.globalAlpha = 0.7;
    for (const ys of seeds) {
      const j0 = (ys - y0) / dy, F0 = interpArr(up, j0), frac = F0 / tot0;
      g.beginPath();
      cols.forEach((c, i) => {
        const target = frac * c.cum[NY]; let j = 0; while (j < NY && c.cum[j + 1] < target) j++;
        const w = (target - c.cum[j]) / Math.max(1e-12, c.cum[j + 1] - c.cum[j]), y = y0 + (j + A.clamp(w, 0, 1)) * dy;
        const p = T(c.x, y); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  function interpArr(a, f) { const i = Math.max(0, Math.min(a.length - 2, Math.floor(f))), w = f - i; return a[i] + (a[i + 1] - a[i]) * w; }
  function paintField(g, W, H, uf, T_inv, map) {
    const step = W < 520 ? 4 : 3, GW = Math.ceil(W / step), GH = Math.ceil(H / step);
    const off = document.createElement('canvas'); off.width = GW; off.height = GH;
    const og = off.getContext('2d'), img = og.createImageData(GW, GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const [x, y] = T_inv(i * step + step / 2, j * step + step / 2), c = map(uf(x, y)), k = 4 * (j * GW + i);
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, GW, GH, 0, 0, GW * step, GH * step);
  }
  function hawtField(lam) {
    const res = Bench.hawtAt(lam), R = G.R, rr = res.elems.map(e => e.r / R), aa = res.elems.map(e => A.clamp(e.a, 0, 0.5));
    const aAt = rd => rd >= 1 ? 0 : interp1(rr, aa, rd) * (rd > 0.97 ? Math.max(0, (1 - rd) / 0.03) : 1);
    const f = x => 1 + x / Math.sqrt(x * x + 1);
    // streamtube radius at station x for each disk radius rd (mass conservation, monotone in rd)
    const NR = 140, RDmax = 2.2, rdT = Array.from({ length: NR + 1 }, (_, i) => i * RDmax / NR);
    const NXg = 140, xa = -2.2, xb = 4.7, tabs = [];
    for (let k = 0; k <= NXg; k++) {
      const x = xa + (xb - xa) * k / NXg, fx = f(x), rx = [0];
      for (let i = 1; i <= NR; i++) { const rm = (rdT[i] + rdT[i - 1]) / 2, a = aAt(rm); rx.push(Math.sqrt(rx[i - 1] ** 2 + (1 - a) / Math.max(0.08, 1 - a * fx) * (rdT[i] ** 2 - rdT[i - 1] ** 2))); }
      tabs.push(rx);
    }
    const uf = (x, y) => {
      const r = Math.abs(y), k = A.clamp(Math.round((x - xa) / (xb - xa) * NXg), 0, NXg), rx = tabs[k];
      let lo = 0, hi = NR; if (r >= rx[NR]) return 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rx[m] > r) hi = m; else lo = m; }
      const w = (r - rx[lo]) / Math.max(1e-9, rx[hi] - rx[lo]), rd = rdT[lo] + w * (rdT[hi] - rdT[lo]);
      return Math.max(0.08, 1 - aAt(rd) * f(x));
    };
    let num = 0, den = 0; res.elems.forEach(e => { num += e.a * e.r * (e.dr || 1); den += e.r * (e.dr || 1); });
    return { uf, aMean: num / den, Cp: res.Cp, Ct: res.Ct, elems: res.elems };
  }
  function drawRotor(cv, lam) {
    const Fc = fitCv(cv); if (!Fc) return; const { g, W, H } = Fc;
    const map = makeMap();
    if (S.mode === 'HAWT') {
      const x0 = -2, x1 = 4.5, ym = 1.7, s = Math.min(W / (x1 - x0), H / (2 * ym)), ox = (W - (x1 - x0) * s) / 2;
      const T = (x, y) => [ox + (x - x0) * s, H / 2 - y * s], Ti = (px, py) => [x0 + (px - ox) / s, (H / 2 - py) / s];
      const fd = hawtField(lam);
      paintField(g, W, H, fd.uf, Ti, map);
      const seeds = [0.15, 0.3, 0.45, 0.6, 0.72, 0.84, 0.95, 1.1, 1.3, 1.52].map(v => v * Math.sqrt(1 - 0.5 * fd.aMean));
      const ink = Plot.css('--ink');
      fluxLines(g, (x, y) => fd.uf(x, y), x0, x1, 0, ym, 90, seeds, true, T, ink);
      fluxLines(g, (x, y) => fd.uf(x, -y), x0, x1, 0, ym, 90, seeds, true, (x, y) => T(x, -y), ink);
      if (F.tipv) {
        const tipE = fd.elems.filter(e => e.r / G.R > 0.85), aT = tipE.length ? tipE.reduce((m, e) => m + A.clamp(e.a, 0, 0.5), 0) / tipE.length : fd.aMean;
        const wk = A.tipVortexWake(S.hawt.B, lam, aT, { turns: 3, perTurn: 48 });
        g.lineWidth = 1.5;
        wk.forEach(pts => { for (let i = 1; i < pts.length; i++) {
          const q = pts[i], q0 = pts[i - 1]; if (q.x > x1) break;
          const u = T(q0.x, q0.y), v = T(q.x, q.y); g.strokeStyle = Plot.css(q.z >= 0 ? '--c2' : '--muted'); g.globalAlpha = q.z >= 0 ? 0.9 : 0.5;
          g.beginPath(); g.moveTo(u[0], u[1]); g.lineTo(v[0], v[1]); g.stroke();
        } });
        g.globalAlpha = 1;
      }
      // rotor disk & nacelle
      const a = T(0, 1), b = T(0, -1); g.strokeStyle = Plot.css('--signal'); g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      const n0 = T(-0.08, 0.07), n1 = T(0.45, -0.07); g.fillStyle = Plot.css('--panel2'); g.strokeStyle = Plot.css('--ink'); g.lineWidth = 1; g.fillRect(n0[0], n0[1], n1[0] - n0[0], n1[1] - n0[1]); g.strokeRect(n0[0], n0[1], n1[0] - n0[0], n1[1] - n0[1]);
      g.fillStyle = Plot.css('--ink'); g.font = '600 12px ' + Plot.css('--font-ui'); g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`側視子午面流場 · λ ${lam.toFixed(2)} · Cp ${fd.Cp.toFixed(3)} · Ct ${fd.Ct.toFixed(2)}`, 10, 8);
      g.font = '11px ' + Plot.css('--font-ui'); g.fillStyle = Plot.css('--muted');
      g.fillText(`平均軸向誘導 ā ≈ ${fd.aMean.toFixed(3)}:轉子處 u ≈ ${(1 - fd.aMean).toFixed(2)} V∞,遠尾流 u ≈ ${(1 - 2 * fd.aMean).toFixed(2)} V∞`, 10, 26);
      const lx = T(-1.9, 0)[0]; arrow(g, lx, H / 2, lx + 40, H / 2, Plot.css('--ink'), 2); g.fillText('V∞', lx, H / 2 + 8);
      colorbar(g, W - 170, H - 26, 150, 8, map, 'u/V∞', { min: 0, max: 1.4, v: [[0, '0'], [0.5, '0.5'], [1, '1']] });
      return fd;
    }
    if (noAirfoil(S.vawt)) { g.fillStyle = Plot.css('--muted'); g.textAlign = 'center'; g.fillText(S.vawt.type === 'custom' ? '此轉子使用匯入的性能曲線,沒有幾何模型可分析。' : 'Savonius 使用經驗性能曲線,沒有流管模型可視化。', W / 2, H / 2); return null; }
    const res = Bench.vawtAt(lam), mid = res.mid || [];
    const x0 = -2.2, x1 = 4.2, ym = 1.8, s = Math.min(W / (x1 - x0), H / (2 * ym)), ox = (W - (x1 - x0) * s) / 2;
    const T = (x, y) => [ox + (x - x0) * s, H / 2 - y * s], Ti = (px, py) => [x0 + (px - ox) / s, (H / 2 - py) / s];
    const ys = mid.map(m => m.y), w = 0.2;
    const tanhS = (x) => 0.5 * (1 + Math.tanh(x / w));
    const uf = (x, y) => {
      if (Math.abs(y) >= 1.02 || !mid.length) return 1;
      const k = mid.reduce((b, m, i) => Math.abs(m.y - y) < Math.abs(mid[b].y - y) ? i : b, 0), m = mid[k];
      const c = Math.sqrt(Math.max(0, 1 - y * y)), edge = tanhS((1 - Math.abs(y)) * 3 - 0.1);
      const u = 1 + (m.ve - 1) * tanhS(x + c) + (m.wake - m.ve) * tanhS(x - c);
      return 1 + (u - 1) * edge;
    };
    paintField(g, W, H, uf, Ti, map);
    const seeds = []; for (let v = -1.6; v <= 1.61; v += 0.2) seeds.push(v);
    const Fl = (x, y) => uf(x, y);
    // planar flux lines from bottom
    fluxLines(g, Fl, x0, x1, -ym, ym, 90, seeds, false, T, Plot.css('--ink'));
    const c0 = T(0, 0); g.strokeStyle = Plot.css('--signal'); g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c0[0], c0[1], s, 0, 7); g.stroke(); g.setLineDash([]);
    for (let k = 0; k < G.vcfg.B; k++) { const tk = SIM.theta + 2 * Math.PI * k / G.vcfg.B, p = T(-Math.cos(tk), Math.sin(tk)); g.fillStyle = Plot.css('--ink'); g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fill(); }
    g.fillStyle = Plot.css('--ink'); g.font = '600 12px ' + Plot.css('--font-ui'); g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`俯視流管速度(雙重多流管)· λ ${lam.toFixed(2)} · Cp ${res.Cp.toFixed(3)}`, 10, 8);
    g.font = '11px ' + Plot.css('--font-ui'); g.fillStyle = Plot.css('--muted');
    g.fillText('上風半圈先減速一次,下風葉片在已減速的氣流中再取一次能量', 10, 26);
    colorbar(g, W - 170, H - 26, 150, 8, map, 'u/V∞', { min: 0, max: 1.4, v: [[0, '0'], [0.5, '0.5'], [1, '1']] });
    return { uf, Cp: res.Cp };
  }

  /* ---------- page ---------- */
  function layout() {
    const sig = S.mode + (S.mode === 'VAWT' ? S.vawt.type : '');
    if (built === sig) return; built = sig;
    const H = S.mode === 'HAWT', lmax = Math.max(2, G.perf ? G.perf.lam[G.perf.lam.length - 1] : 12);
    const h = `<div class="card"><div class="ctrlbar">
        ${H ? `<label>剖面 r/R <input type="range" id="fR" min="0.1" max="0.99" step="0.01"><output id="fRo"></output></label>` : ''}
        <label>攻角 α <input type="range" id="fA" min="-10" max="25" step="0.25"><output id="fAo"></output></label>
        <button class="iconbtn" id="fAd">${H ? '用設計點攻角' : '預設 8°'}</button>
        <label>顯示 <select id="fM"><option value="speed">速度大小 |V|/V∞</option><option value="cp">壓力係數 Cp</option></select></label>
        <label><input type="checkbox" id="fL" checked> 流線</label>
      </div></div>
      <div class="bgrid">
        ${card('翼型剖面流場(面板法位勢流)', '<canvas id="fSec" style="height:360px"></canvas>', 'span2')}
        ${card('翼面壓力分布', '<canvas id="fCp" style="height:360px"></canvas>')}
        ${S.mode === 'VAWT' && noAirfoil(S.vawt) ? '' : `<div class="card span3"><div class="ctrlbar"><label>轉子尖速比 λ <input type="range" id="fLam" min="0.5" max="${lmax.toFixed(1)}" step="0.05"><output id="fLamo"></output></label><button class="iconbtn" id="fLd">${H ? '設計點' : '最佳 λ'}</button><label><input type="checkbox" id="fFol"> 跟隨目前運轉點</label>${H ? '<label><input type="checkbox" id="fTv"> 葉尖渦(螺旋尾流)</label>' : ''}</div></div>
        ${card(H ? '轉子流場(致動盤 + BEM 誘導)' : '轉子流場(雙重多流管)', '<canvas id="fRot" style="height:340px"></canvas>', 'span2')}
        ${card('速度剖面', '<canvas id="fProf" style="height:340px"></canvas>')}`}
        ${card('模型說明', `<p class="hint">翼型剖面:Hess-Smith 面板法(源 + 均勻渦,Kutta 條件)求無黏位勢流,流線以速度場積分。位勢流不含邊界層與分離;分離點由表面速度做 Thwaites(層流)+ Michel 轉捩 + Head(紊流)積分邊界層估計,紅色分離區只是示意,Cl 會高於實際值;實際升阻力請以「極曲線」分頁的黏性修正模型為準。<br>水平軸轉子:以 BEM 求得各截面軸向誘導因子 a(r),搭配致動盤渦柱理論 u = V∞[1 − a(1 + x/√(x²+R²))] 近似軸向速度,流線由各流管質量守恆求得;尾流旋轉未計入;勾選「葉尖渦」會疊上預設螺旋尾流(依葉尖誘導 a 對流、流管膨脹,實線為近側、灰線為遠側),不是自由渦尾流。<br>垂直軸轉子:以雙重多流管法的上、下風誘導速度組合成俯視流場,示意上風半圈先減速、下風葉片再次取能的特性。</p>`, 'span3', null, false)}
      </div>`;
    $f('flowInner').innerHTML = h;
    const on = (id, ev, fn) => { const e = $f(id); if (e) e.addEventListener(ev, fn); };
    on('fR', 'input', e => { F.rr = +e.target.value; F.alpha = null; render(); });
    on('fA', 'input', e => { F.alpha = +e.target.value; renderSection(); });
    on('fAd', 'click', () => { F.alpha = null; renderSection(); });
    on('fM', 'change', e => { F.mode = e.target.value; renderSection(); });
    on('fL', 'change', e => { F.lines = e.target.checked; renderSection(); });
    on('fLam', 'input', e => { F.lam = +e.target.value; F.follow = false; const c = $f('fFol'); if (c) c.checked = false; render(); });
    on('fLd', 'click', () => { F.lam = null; F.follow = false; const c = $f('fFol'); if (c) c.checked = false; render(); });
    on('fTv', 'change', e => { F.tipv = e.target.checked; renderRotor(); });
    on('fFol', 'change', e => { F.follow = e.target.checked; render(); });
    document.querySelectorAll('#flowInner details').forEach(d => d.addEventListener('toggle', () => { if (d.open) render(); }));
  }
  function lamNow() { if (F.follow && SIM.out && SIM.out.lam > 0.2) return SIM.out.lam; return F.lam == null ? (S.mode === 'HAWT' ? S.hawt.tsr : G.lopt) : F.lam; }
  function renderSection() {
    const inp = sectionInput(), a = F.alpha == null ? inp.aDes : F.alpha;
    const set = (id, v, t) => { const e = $f(id); if (e && document.activeElement !== e) e.value = v; const o = $f(id + 'o'); if (o) o.textContent = t; };
    set('fR', F.rr, F.rr.toFixed(2)); set('fA', a, a.toFixed(2) + '°' + (F.alpha == null ? '(設計)' : ''));
    const m = $f('fM'); if (m) m.value = F.mode;
    const out = drawSection($f('fSec'), inp, a, { mode: F.mode, lines: F.lines });
    if (out) {
      const n = out.sol.n, xs = out.sol.xm, cps = out.sol.cp, half = Math.floor(n / 2);
      const lo = { x: [], y: [] }, up = { x: [], y: [] };
      for (let i = 0; i < n; i++) (i < half ? lo : up).x.push(xs[i]), (i < half ? lo : up).y.push(-cps[i]);
      Plot.draw($f('fCp'), { title: `−Cp 分布(α ${a.toFixed(1)}°)`, series: [{ x: up.x, y: up.y, color: Plot.css('--c1'), label: '上表面' }, { x: lo.x, y: lo.y, color: Plot.css('--c2'), label: '下表面' }], xlim: [0, 1], xlabel: 'x/c', ylabel: '−Cp' });
    }
  }
  function renderRotor() {
    const cv = $f('fRot'); if (!cv) return;
    const lam = lamNow();
    const set = (id, v, t) => { const e = $f(id); if (e && document.activeElement !== e) e.value = v; const o = $f(id + 'o'); if (o) o.textContent = t; };
    set('fLam', lam, lam.toFixed(2));
    const fd = drawRotor(cv, lam);
    if (!fd || !$f('fProf')) return;
    if (S.mode === 'HAWT') {
      const xs = Array.from({ length: 81 }, (_, i) => -2 + i * 6.5 / 80);
      const rs = Array.from({ length: 41 }, (_, i) => i * 1.4 / 40);
      Plot.draw($f('fProf'), { title: '軸向速度 u/V∞', series: [{ x: xs, y: xs.map(x => fd.uf(x, 0.7)), color: Plot.css('--c1'), label: 'r = 0.7R 沿軸向' }, { x: xs, y: xs.map(x => fd.uf(x, 1.25)), color: Plot.css('--c3'), dash: [4, 3], label: 'r = 1.25R' }], xlabel: 'x/R(0 為轉子)', ylabel: 'u/V∞', ylim: [0, 1.1], vlines: [{ x: 0, color: Plot.css('--signal') }] });
    } else {
      const ys = Array.from({ length: 61 }, (_, i) => -1.5 + i * 3 / 60);
      Plot.draw($f('fProf'), { title: '橫向速度剖面 u/V∞', series: [{ x: ys, y: ys.map(y => fd.uf(0, y)), color: Plot.css('--c1'), label: '轉子中心 x = 0' }, { x: ys, y: ys.map(y => fd.uf(2.5, y)), color: Plot.css('--c2'), dash: [4, 3], label: '下游 x = 2.5R' }], xlabel: 'y/R', ylabel: 'u/V∞', ylim: [0, 1.1] });
    }
  }
  function render() { if (!G.perf) return; layout(); renderSection(); renderRotor(); }
  function tick() { if (F.follow && performance.now() - lastFollow > 700) { lastFollow = performance.now(); renderRotor(); } }
  return { render, tick, drawSection, drawRotor, sectionInput, state: F, reset() { built = ''; } };
})();
