/* ===== Tiny canvas plotting helper ===== */
const Plot = (function () {
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function niceStep(range, n) {
    const raw = range / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function fmt(v, step) {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return Math.abs(v) < step * 1e-6 ? '0' : v.toFixed(Math.min(d, 4));
  }
  function extent(series, key, axis) {
    let lo = Infinity, hi = -Infinity;
    for (const s of series) { if ((s.axis || 'L') !== axis && key === 'y') continue; const arr = s[key]; if (!arr) continue;
      for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } } }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    return [lo, hi];
  }
  function draw(cv, o) {
    const fs = draw.force;
    const dpr = fs ? fs.dpr : (window.devicePixelRatio || 1);
    const W = fs ? fs.W : cv.clientWidth, H = fs ? fs.H : cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const ink = css('--ink'), muted = css('--muted'), line = css('--grid');
    const font = '11px ' + css('--font-ui');
    g.font = font;
    const hasR = o.series.some(s => s.axis === 'R');
    const padL = 46, padR = hasR ? 46 : 14, padT = o.title ? 24 : 12, padB = 32;
    const pw = W - padL - padR, ph = H - padT - padB;
    let [x0, x1] = o.xlim || extent(o.series, 'x');
    let [y0, y1] = o.ylim || extent(o.series, 'y', 'L');
    let [r0, r1] = hasR ? (o.ylimR || extent(o.series, 'y', 'R')) : [0, 1];
    if (!o.ylim) { const m = (y1 - y0) * 0.06; y0 -= m; y1 += m; }
    if (hasR && !o.ylimR) { const m = (r1 - r0) * 0.06; r0 -= m; r1 += m; }
    if (o.equal) { // equal aspect for airfoil shape
      const sx = pw / (x1 - x0), sy = ph / (y1 - y0), s = Math.min(sx, sy);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      x0 = cx - pw / s / 2; x1 = cx + pw / s / 2; y0 = cy - ph / s / 2; y1 = cy + ph / s / 2;
    }
    const X = x => padL + (x - x0) / (x1 - x0) * pw;
    const Y = y => padT + ph - (y - y0) / (y1 - y0) * ph;
    const YR = y => padT + ph - (y - r0) / (r1 - r0) * ph;
    // grid
    g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = muted;
    const xs = niceStep(x1 - x0, Math.max(3, pw / 70)), ys = niceStep(y1 - y0, Math.max(3, ph / 40));
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + 1e-9; v += xs) {
      const px = X(v); g.beginPath(); g.moveTo(px, padT); g.lineTo(px, padT + ph); g.stroke();
      if (!o.noXTicks) g.fillText(fmt(v, xs), px, padT + ph + 4);
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + 1e-9; v += ys) {
      const py = Y(v); g.beginPath(); g.moveTo(padL, py); g.lineTo(padL + pw, py); g.stroke();
      if (!o.noYTicks) g.fillText(fmt(v, ys), padL - 5, py);
    }
    if (hasR) {
      const rs = niceStep(r1 - r0, Math.max(3, ph / 40)); g.textAlign = 'left';
      for (let v = Math.ceil(r0 / rs) * rs; v <= r1 + 1e-9; v += rs) g.fillText(fmt(v, rs), padL + pw + 5, YR(v));
    }
    // zero lines
    g.strokeStyle = muted; g.globalAlpha = 0.5;
    if (y0 < 0 && y1 > 0) { g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(padL + pw, Y(0)); g.stroke(); }
    if (x0 < 0 && x1 > 0) { g.beginPath(); g.moveTo(X(0), padT); g.lineTo(X(0), padT + ph); g.stroke(); }
    g.globalAlpha = 1;
    // bands
    for (const b of (o.bands || [])) { g.fillStyle = b.color; g.globalAlpha = b.alpha || 0.12; g.fillRect(X(b.x0), padT, X(b.x1) - X(b.x0), ph); g.globalAlpha = 1; }
    // series
    g.save(); g.beginPath(); g.rect(padL, padT, pw, ph); g.clip();
    for (const s of o.series) {
      const yF = s.axis === 'R' ? YR : Y;
      g.strokeStyle = s.color || ink; g.lineWidth = s.width || 1.6; g.setLineDash(s.dash || []);
      g.globalAlpha = s.alpha == null ? 1 : s.alpha;
      if (s.fill) { g.fillStyle = s.fill; }
      g.beginPath(); let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const xv = s.x[i], yv = s.y[i];
        if (!isFinite(yv) || !isFinite(xv)) { pen = false; continue; }
        const px = X(xv), py = yF(yv);
        if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
      }
      if (s.closed) g.closePath();
      if (s.fill && s.closed) g.fill();
      else if (s.fill) {
        const base = yF(s.axis === 'R' ? Math.max(r0, 0) : Math.max(y0, 0));
        g.save(); g.beginPath(); let st = null, lx = null;
        for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.y[i]) || !isFinite(s.x[i])) continue; const px = X(s.x[i]); if (st === null) { st = px; g.moveTo(px, base); } g.lineTo(px, yF(s.y[i])); lx = px; }
        if (st !== null) { g.lineTo(lx, base); g.closePath(); g.globalAlpha = (s.alpha == null ? 1 : s.alpha) * 0.55; g.fill(); }
        g.restore();
        g.beginPath(); let pen2 = false;
        for (let i = 0; i < s.x.length; i++) { const xv = s.x[i], yv = s.y[i]; if (!isFinite(yv) || !isFinite(xv)) { pen2 = false; continue; } const px = X(xv), py = yF(yv); if (!pen2) { g.moveTo(px, py); pen2 = true; } else g.lineTo(px, py); }
      }
      g.stroke(); g.setLineDash([]);
      if (s.dots) { g.fillStyle = s.color; for (let i = 0; i < s.x.length; i++) { g.beginPath(); g.arc(X(s.x[i]), yF(s.y[i]), s.dots, 0, 7); g.fill(); } }
      g.globalAlpha = 1;
    }
    for (const v of (o.vlines || [])) {
      g.strokeStyle = v.color || muted; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(v.x), padT); g.lineTo(X(v.x), padT + ph); g.stroke(); g.setLineDash([]);
      if (v.label) { g.fillStyle = v.color || muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(v.label, X(v.x) + 3, padT + 2); }
    }
    for (const m of (o.markers || [])) {
      const yF = m.axis === 'R' ? YR : Y; const px = X(m.x), py = yF(m.y);
      g.fillStyle = m.color || ink; g.strokeStyle = css('--panel'); g.lineWidth = 2;
      g.beginPath(); g.arc(px, py, m.r || 5, 0, 7); g.fill(); g.stroke();
      if (m.label) { g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(m.label, px + 7, py - 3); }
    }
    g.restore();
    // frame & labels
    g.strokeStyle = muted; g.globalAlpha = 0.6; g.strokeRect(padL + 0.5, padT + 0.5, pw, ph); g.globalAlpha = 1;
    g.fillStyle = muted; g.textAlign = 'center'; g.textBaseline = 'bottom';
    if (o.xlabel) g.fillText(o.xlabel, padL + pw / 2, H - 2);
    if (o.ylabel) { g.save(); g.translate(11, padT + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(o.ylabel, 0, 0); g.restore(); }
    if (o.ylabelR) { g.save(); g.translate(W - 9, padT + ph / 2); g.rotate(Math.PI / 2); g.textBaseline = 'middle'; g.fillText(o.ylabelR, 0, 0); g.restore(); }
    if (o.title) { g.fillStyle = ink; g.font = '600 12px ' + css('--font-ui'); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(o.title, Math.min(padL, 8), 5, W - Math.min(padL, 8) - 6); g.font = font; }
    // legend
    const leg = o.series.filter(s => s.label);
    if (leg.length) {
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const widths = leg.map(s => g.measureText(s.label).width + 26), maxW = pw - 12;
      const rows = [[]]; let rw = 0;
      leg.forEach((s, i) => { if (rw + widths[i] > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(i); rw += widths[i]; });
      rows.forEach((r, k) => {
        const tw = r.reduce((a, i) => a + widths[i], 0);
        let lx = padL + pw - 8 - tw; const ly = padT + 10 + k * 16;
        g.fillStyle = css('--panel'); g.globalAlpha = 0.85; g.fillRect(lx - 4, ly - 8, tw + 6, 16); g.globalAlpha = 1;
        r.forEach(i => {
          const s = leg[i];
          g.strokeStyle = s.color; g.lineWidth = 2; g.setLineDash(s.dash || []);
          g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 16, ly); g.stroke(); g.setLineDash([]);
          g.fillStyle = ink; g.fillText(s.label, lx + 20, ly); lx += widths[i];
        });
      });
    }
    return { X, Y, x0, x1, y0, y1, padL, padT, pw, ph };
  }
  return { draw, css };
})();
