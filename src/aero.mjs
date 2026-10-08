/* ===== AERO core: airfoil geometry, panel method, polar model, BEM, DMST ===== */
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const NX = 61; // points per surface (cosine spacing, LE->TE)
  const XS = [];
  for (let i = 0; i < NX; i++) XS.push(0.5 * (1 - Math.cos(Math.PI * i / (NX - 1))));

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

  /* ---------- Airfoil generation ---------- */
  function thicknessNACA(x, t) {
    return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  }
  function naca4(code) {
    const m = +code[0] / 100, p = +code[1] / 10, t = +code.slice(2) / 100;
    const yu = [], yl = [], yc = [];
    for (const x of XS) {
      let c = 0;
      if (m > 0 && p > 0) c = x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * x - x * x);
      const th = thicknessNACA(x, t);
      yc.push(c); yu.push(c + th); yl.push(c - th);
    }
    return { name: 'NACA ' + code, source: 'NACA 4 位數解析式', x: XS.slice(), yu, yl, t, camber: m };
  }
  function naca5(code) {
    // 230xx family style: L P Q TT
    const L = +code[0], P = +code[1], Q = +code[2], t = +code.slice(3) / 100;
    const tabM = [0, 0.0580, 0.1260, 0.2025, 0.2900, 0.3910], tabK = [0, 361.4, 51.64, 15.957, 6.643, 3.230];
    const Pi = clamp(P, 1, 5), m = tabM[Pi], k1 = tabK[Pi] * (L * 0.15) / 0.3;
    const yu = [], yl = [];
    let cmax = 0;
    for (const x of XS) {
      const c = x < m ? k1 / 6 * (x * x * x - 3 * m * x * x + m * m * (3 - m) * x) : k1 * m * m * m / 6 * (1 - x);
      cmax = Math.max(cmax, c);
      const th = thicknessNACA(x, t);
      yu.push(c + th); yl.push(c - th);
    }
    return { name: 'NACA ' + code, source: 'NACA 5 位數解析式' + (Q ? '(反彎不支援,以標準型計算)' : ''), x: XS.slice(), yu, yl, t, camber: cmax };
  }
  function circularArc(camberPct, thickPct) {
    const h = camberPct / 100, tt = thickPct / 100;
    const yu = [], yl = [];
    for (const x of XS) {
      const c = 4 * h * x * (1 - x);
      const env = Math.min(1, Math.sqrt(x / 0.02)) * Math.min(1, Math.sqrt((1 - x) / 0.02));
      yu.push(c + tt / 2 * env); yl.push(c - tt / 2 * env);
    }
    return { name: '圓弧薄板 ' + camberPct + '%', source: '圓弧彎板(小型風機/簡易葉片)', x: XS.slice(), yu, yl, t: tt, camber: h };
  }
  // Resample raw coordinates (Selig or Lednicer) into common representation
  function parseDat(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(s => s.trim());
    let name = 'Imported';
    const nums = [];
    let first = true;
    for (const ln of lines) {
      if (!ln) { nums.push(null); continue; }
      const parts = ln.split(/[\s,;]+/).map(Number);
      if (parts.length >= 2 && parts.every(v => isFinite(v))) nums.push([parts[0], parts[1]]);
      else if (first) name = ln;
      first = false;
    }
    let pts = nums.filter(Boolean);
    if (pts.length < 10) throw new Error('座標點不足 (至少需要 10 點)');
    let upper, lower;
    if (pts[0][0] > 1.5 && pts[0][1] > 1.5) { // Lednicer
      const nu = Math.round(pts[0][0]), nl = Math.round(pts[0][1]);
      pts = pts.slice(1);
      upper = pts.slice(0, nu); lower = pts.slice(nu, nu + nl);
    } else { // Selig: TE upper -> LE -> TE lower
      let ile = 0;
      for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[ile][0]) ile = i;
      upper = pts.slice(0, ile + 1).reverse(); lower = pts.slice(ile);
    }
    // normalise chord
    const xmin = Math.min(...pts.map(p => p[0])), xmax = Math.max(...pts.map(p => p[0]));
    const ch = xmax - xmin || 1;
    const norm = arr => arr.map(p => [(p[0] - xmin) / ch, p[1] / ch]).sort((a, b) => a[0] - b[0]);
    upper = norm(upper); lower = norm(lower);
    if (upper.reduce((s, p) => s + p[1], 0) < lower.reduce((s, p) => s + p[1], 0)) { const tmp = upper; upper = lower; lower = tmp; }
    const interp = (arr, x) => {
      if (x <= arr[0][0]) return arr[0][1];
      for (let i = 1; i < arr.length; i++) if (arr[i][0] >= x) {
        const a = arr[i - 1], b = arr[i], w = (x - a[0]) / ((b[0] - a[0]) || 1e-9);
        return a[1] + w * (b[1] - a[1]);
      }
      return arr[arr.length - 1][1];
    };
    const yu = XS.map(x => interp(upper, x)), yl = XS.map(x => interp(lower, x));
    const y0 = (yu[0] + yl[0]) / 2; yu[0] = yl[0] = y0;
    let t = 0, cm = 0;
    for (let i = 0; i < NX; i++) { t = Math.max(t, yu[i] - yl[i]); cm = Math.max(cm, Math.abs((yu[i] + yl[i]) / 2)); }
    return { name, source: '匯入座標檔', x: XS.slice(), yu, yl, t, camber: cm };
  }
  function blendAirfoil(a, b, w) {
    if (!b || w <= 0) return a; if (w >= 1) return b;
    const yu = a.yu.map((v, i) => v * (1 - w) + b.yu[i] * w), yl = a.yl.map((v, i) => v * (1 - w) + b.yl[i] * w);
    return { name: a.name + '→' + b.name, x: XS.slice(), yu, yl, t: a.t * (1 - w) + b.t * w, camber: a.camber * (1 - w) + b.camber * w };
  }
  function airfoilArea(af) { // cross-section area / c^2
    let s = 0; for (let i = 1; i < NX; i++) s += ((af.yu[i] - af.yl[i]) + (af.yu[i - 1] - af.yl[i - 1])) / 2 * (af.x[i] - af.x[i - 1]);
    return s;
  }

  /* ---------- Hess-Smith panel method (inviscid) ---------- */
  function panel(af) {
    // nodes: TE lower -> LE -> TE upper (clockwise)
    const X = [], Y = [];
    for (let i = NX - 1; i >= 0; i--) { X.push(af.x[i]); Y.push(af.yl[i]); }
    for (let i = 1; i < NX; i++) { X.push(af.x[i]); Y.push(af.yu[i]); }
    const n = X.length - 1;
    const xm = [], ym = [], th = [], ds = [];
    for (let j = 0; j < n; j++) {
      xm.push((X[j] + X[j + 1]) / 2); ym.push((Y[j] + Y[j + 1]) / 2);
      const dx = X[j + 1] - X[j], dy = Y[j + 1] - Y[j];
      th.push(Math.atan2(dy, dx)); ds.push(Math.hypot(dx, dy));
    }
    const N = n + 1;
    const A = []; for (let i = 0; i < N; i++) A.push(new Float64Array(N + 2));
    const FL = [], FT = [];
    for (let i = 0; i < n; i++) {
      FL.push(new Float64Array(n)); FT.push(new Float64Array(n));
      for (let j = 0; j < n; j++) {
        let flog = 0, ftan = Math.PI;
        if (j !== i) {
          const dxj = xm[i] - X[j], dxjp = xm[i] - X[j + 1], dyj = ym[i] - Y[j], dyjp = ym[i] - Y[j + 1];
          flog = 0.5 * Math.log((dxjp * dxjp + dyjp * dyjp) / (dxj * dxj + dyj * dyj));
          ftan = Math.atan2(dyjp * dxj - dxjp * dyj, dxjp * dxj + dyjp * dyj);
        }
        FL[i][j] = flog; FT[i][j] = ftan;
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = Math.cos(th[i] - th[j]), s = Math.sin(th[i] - th[j]);
        const aij = s * FL[i][j] + c * FT[i][j], bij = c * FL[i][j] - s * FT[i][j];
        A[i][j] = aij; A[i][n] += bij;
        if (i === 0 || i === n - 1) { A[n][j] -= bij; A[n][n] += aij; }
      }
      A[i][N] = Math.sin(th[i]);      // coefficient of cos(alpha)
      A[i][N + 1] = -Math.cos(th[i]); // coefficient of sin(alpha)
    }
    A[n][N] = -Math.cos(th[0]) - Math.cos(th[n - 1]);
    A[n][N + 1] = -Math.sin(th[0]) - Math.sin(th[n - 1]);
    // Gaussian elimination with two RHS
    for (let k = 0; k < N; k++) {
      let p = k; for (let i = k + 1; i < N; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      const t = A[k]; A[k] = A[p]; A[p] = t;
      for (let i = k + 1; i < N; i++) {
        const f = A[i][k] / A[k][k]; if (!f) continue;
        for (let j = k; j < N + 2; j++) A[i][j] -= f * A[k][j];
      }
    }
    const sol = [new Float64Array(N), new Float64Array(N)];
    for (let r = 0; r < 2; r++) for (let i = N - 1; i >= 0; i--) {
      let s = A[i][N + r]; for (let j = i + 1; j < N; j++) s -= A[i][j] * sol[r][j];
      sol[r][i] = s / A[i][i];
    }
    function solve(alpha) {
      const ca = Math.cos(alpha), sa = Math.sin(alpha);
      const q = [], g = sol[0][n] * ca + sol[1][n] * sa;
      for (let j = 0; j < n; j++) q.push(sol[0][j] * ca + sol[1][j] * sa);
      const cp = [];
      let cx = 0, cy = 0, cm = 0;
      for (let i = 0; i < n; i++) {
        let vt = Math.cos(th[i] - alpha);
        for (let j = 0; j < n; j++) {
          const c = Math.cos(th[i] - th[j]), s = Math.sin(th[i] - th[j]);
          vt += q[j] * (s * FT[i][j] - c * FL[i][j]) + g * (s * FL[i][j] + c * FT[i][j]);
        }
        const c_p = 1 - vt * vt; cp.push(c_p);
        const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i];
        cx += c_p * dy; cy += -c_p * dx;
        cm += c_p * (dx * (xm[i] - 0.25) + dy * ym[i]);
      }
      const cl = cy * Math.cos(alpha) - cx * Math.sin(alpha);
      // velocity (in units of V∞) induced at an arbitrary field point, airfoil frame, freestream at angle alpha
      function vel(px, py) {
        let u = ca, v = sa;
        for (let j = 0; j < n; j++) {
          const dxj = px - X[j], dxjp = px - X[j + 1], dyj = py - Y[j], dyjp = py - Y[j + 1];
          const FLj = 0.5 * Math.log((dxjp * dxjp + dyjp * dyjp) / (dxj * dxj + dyj * dyj + 1e-12) + 1e-12);
          const FTj = Math.atan2(dyjp * dxj - dxjp * dyj, dxjp * dxj + dyjp * dyj);
          const tx = Math.cos(th[j]), ty = Math.sin(th[j]);
          const ut = -q[j] * FLj + g * FTj, un = q[j] * FTj + g * FLj;
          u += ut * tx - un * ty; v += ut * ty + un * tx;
        }
        return [u, v];
      }
      return { cl, cm, cp, xm, ym, n, vel, X, Y };
    }
    return solve;
  }


  /* ---------- Integral boundary layer (Thwaites + Michel transition + Head) ---------- */
  // Marches both surfaces of an inviscid panel solution (the result of solve(alpha)). Lengths in chords.
  // Per surface returns { xTr, xLam, xSep, cd, H, dStar }: transition x/c, laminar-separation x/c (assumed to
  // reattach turbulent, i.e. a short bubble), turbulent-separation x/c (null = attached to the TE),
  // Squire-Young cd of that surface, TE shape factor.
  function boundaryLayer(sol, Re) {
    const n = sol.n, nu = 1 / Re, ue = [];
    for (let i = 0; i < n; i++) ue.push(Math.sqrt(Math.max(1e-6, 1 - sol.cp[i])));
    let st = 0, best = 1e9; // stagnation = slowest panel near the leading edge
    for (let i = 0; i < n; i++) if (sol.xm[i] < 0.3 && ue[i] < best) { best = ue[i]; st = i; }
    const h1of = h => (h <= 1.6 ? 3.3 : 3.32) + 0.8234 * Math.pow(h - 1.1, -1.287);
    const hofh1 = h1 => (h1 > 5.3 ? 1.1 + 0.86 * Math.pow(h1 - 3.3, -0.777) : 0.6778 + 1.1536 * Math.pow(h1 - 3.3, -0.326));
    // panels run lower TE -> LE -> upper TE: upper surface = st..n-1, lower = st..0
    function march(idx) {
      const m = idx.length, s = [0], U = [], X = [];
      for (let k = 0; k < m; k++) {
        const i = idx[k];
        if (k > 0) s.push(s[k - 1] + Math.hypot(sol.xm[i] - sol.xm[idx[k - 1]], sol.ym[i] - sol.ym[idx[k - 1]]));
        U.push(ue[i]); X.push(sol.xm[i]);
      }
      const dU = [];
      for (let i = 0; i < m; i++) { const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1); dU.push((U[b] - U[a]) / Math.max(1e-9, s[b] - s[a])); }
      const out = { xTr: null, xLam: null, xSep: null, cd: 0, H: 1.4 };
      let integ = 0, turb = false, th = 0, H = 1.4, H1 = 0;
      for (let i = 1; i < m; i++) {
        const ds = s[i] - s[i - 1];
        if (!turb) {
          integ += 0.5 * (Math.pow(U[i], 5) + Math.pow(U[i - 1], 5)) * ds;
          th = Math.sqrt(0.45 * nu * integ / Math.pow(U[i], 6));
          const lam = Re * th * th * dU[i], Rth = Re * U[i] * th, Rx = Math.max(1, Re * s[i] * U[i]);
          const trig = Rth > 100 && Rth > 1.174 * (1 + 22400 / Rx) * Math.pow(Rx, 0.46);
          if (lam <= -0.09 || trig) {
            if (lam <= -0.09) out.xLam = X[i];
            out.xTr = X[i]; turb = true; H = 1.4; H1 = h1of(H);
          } else H = lam >= 0 ? 2.61 - 3.75 * lam + 5.24 * lam * lam : 2.088 + 0.0731 / (lam + 0.14);
        } else {
          const Rth = Math.max(100, Re * U[i - 1] * th);
          const cf = 0.246 * Math.pow(10, -0.678 * H) * Math.pow(Rth, -0.268);
          const dth = cf / 2 - (H + 2) * th / U[i - 1] * dU[i - 1];
          const dflux = 0.0306 * U[i - 1] * Math.pow(H1 - 3, -0.6169); // d(Ue θ H1)/ds
          const flux = U[i - 1] * th * H1 + ds * dflux;
          th = Math.max(1e-7, th + ds * dth);
          H1 = Math.max(3.35, flux / (U[i] * th)); H = Math.min(3, hofh1(H1));
          if (H > 2.4 && out.xSep === null && X[i] < 0.97) out.xSep = X[i]; // potential-flow TE stagnation is unphysical, ignore last 3%
        }
      }
      if (!turb) out.xTr = 1;
      out.H = turb ? Math.min(H, 2.5) : H;
      out.cd = 2 * th * Math.pow(U[m - 1], (out.H + 5) / 2);
      out.dStar = th * out.H; // TE displacement thickness / chord (theta x H)
      return out;
    }
    const up = [], lo = [];
    for (let i = st; i < n; i++) up.push(i);
    for (let i = st; i >= 0; i--) lo.push(i);
    const upper = march(up), lower = march(lo);
    return { upper, lower, cd: upper.cd + lower.cd, stag: sol.xm[st] };
  }

  /* ---------- Semi-empirical polar model ---------- */
  function cfFlat(Re) {
    const lam = 1.328 / Math.sqrt(Re);
    if (Re < 5e5) return lam;
    return Math.max(lam, 0.455 / Math.pow(Math.log10(Re), 2.58) - 1700 / Re);
  }
  function buildAeroModel(af, opts) {
    opts = opts || {};
    const solve = panel(af);
    const r0 = solve(0), r4 = solve(4 * D2R);
    const slopeInv = (r4.cl - r0.cl) / (4 * D2R);
    const aL0 = -r0.cl / slopeInv;
    return { af, solve, slopeInv, aL0, cl0inv: r0.cl, cdMax: opts.cdMax || 1.3 };
  }
  // Build tabulated polar for one Reynolds number
  function polarAtRe(model, Re) {
    const af = model.af, t = af.t, cam = af.camber;
    // 失速角的 Re 項:低 Re 緩升,Re > 1e6 後加速(NACA 0012 Re 3×10⁶ Clmax 約 1.6)
    // Re < 1e5:層流分離泡使失速提早、最大升力下降(額外最多 -15% 失速角)
    const lowReBub = Math.max(0, Math.log10(1e5 / Re));
    const reF = clamp(0.9 + 0.1 * Math.log10(Re / 1e5) + 0.25 * Math.max(0, Math.log10(Re / 1e6)) - 0.1 * lowReBub, 0.6, 1.2);
    // 失速角的厚度項:t ≤ 0.12 隨厚度增加,更厚的翼型(NACA 0018)前緣分離提早,失速角反而下降
    const tTerm = 28 * Math.min(t, 0.12) - 20 * Math.max(0, t - 0.12);
    const lowRe = clamp(Math.pow(1e6 / Re, 0.28), 0.8, 3.2);
    const a = model.slopeInv * (0.92 - 0.06 * clamp(Math.log10(2e5 / Re), 0, 1.5));
    const aL0 = model.aL0 * 0.9;
    const asPos = clamp((9 + tTerm + 60 * cam) * reF, 5, 22) * D2R;
    const asNeg = clamp((9 + tTerm - 50 * cam) * reF, 4, 20) * D2R;
    // 高 Re 時平板摩擦公式配厚度修正偏高(NACA 0012 Re 1e6 實測約 0.006);依邊界層積分比對,Re > 3e5 起逐步下修,最多 30%
    const reCal = clamp(1 - 0.25 * Math.log10(Math.max(Re, 3e5) / 3e5), 0.7, 1);
    // Re < 1e5 層流分離泡的壓力阻力:cd0 每降一個數量級約 +40%(Re 5×10⁴ +12%、2×10⁴ +28%)
    const bubble = 1 + 0.4 * lowReBub;
    const cd0 = Math.max(0.004, 2 * cfFlat(Re) * (1 + 2 * t + 60 * Math.pow(t, 4)) * (1 + 0.8 * cam) * reCal * bubble);
    const kd = 0.32 * lowRe;
    const aCdMin = 0.4 * aL0;
    const drop = clamp(0.7 + 1.4 * t, 0.72, 0.96);
    const cdMax = model.cdMax;
    const w = 1.4 * D2R;
    // Viterna coefficients (per side)
    function vit(as) {
      const cls = drop * a * as;
      const A1 = cdMax / 2, A2 = (cls - cdMax * Math.sin(as) * Math.cos(as)) * Math.sin(as) / (Math.cos(as) ** 2);
      return { A1, A2, as };
    }
    const vp = vit(asPos), vn = vit(asNeg);
    const V = (v, b) => { b = Math.max(b, v.as); return v.A1 * Math.sin(2 * b) + v.A2 * Math.cos(b) ** 2 / Math.sin(b); };
    const sig = z => 1 / (1 + Math.exp(-z));
    const N = 721, al = new Float64Array(N), CL = new Float64Array(N), CD = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      const alpha = -Math.PI + k * (2 * Math.PI / (N - 1));
      const b = wrapPi(alpha - aL0);
      // post-stall base
      let clP;
      if (b >= 0) clP = b <= Math.PI / 2 ? V(vp, b) : -0.7 * V(vp, Math.PI - b);
      else { const nb = -b; clP = -(nb <= Math.PI / 2 ? V(vn, nb) : -0.7 * V(vn, Math.PI - nb)); }
      const cdP = cdMax * Math.sin(alpha) ** 2 + cd0 * 1.5;
      // attached forward
      const att = sig((asPos - b) / w) * sig((b + asNeg) / w);
      const clA = a * b;
      const cdA = cd0 + kd * (alpha - aCdMin) ** 2;
      // attached reverse (flow from TE)
      const br = wrapPi(alpha - Math.PI);
      const rs = 7 * D2R;
      const attR = sig((rs - br) / w) * sig((br + rs) / w);
      const clR = 0.75 * a * br;
      const cdR = 2.2 * cd0 + kd * br * br;
      const wP = Math.max(0, 1 - att - attR);
      al[k] = alpha;
      CL[k] = att * clA + attR * clR + wP * clP;
      CD[k] = att * Math.min(cdA, cdP + 0.02) + attR * cdR + wP * Math.max(cdP, cdA * 0 + cd0);
    }
    return { Re, al, CL, CD, cd0, a, aL0, asPos, asNeg };
  }
  function buildPolarSet(model) {
    const REs = [2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 3e6, 1e7];
    return { REs, tables: REs.map(r => polarAtRe(model, r)), model };
  }
  // imported XFOIL / CSV polar: rows alpha(deg) cl cd -> single table extended with Viterna
  function parsePolarText(text, cdMax) {
    const rows = [];
    for (const ln of text.replace(/\r/g, '').split('\n')) {
      const p = ln.trim().split(/[\s,;]+/).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every(isFinite) && Math.abs(p[0]) <= 180) rows.push(p.slice(0, 3));
    }
    if (rows.length < 5) throw new Error('極曲線資料不足:需要至少 5 行「α Cl Cd」');
    rows.sort((a, b) => a[0] - b[0]);
    const amin = rows[0][0] * D2R, amax = rows[rows.length - 1][0] * D2R;
    const lo = rows[0], hi = rows[rows.length - 1];
    cdMax = cdMax || 1.3;
    const vit = (as, cls, cds) => {
      const A1 = cdMax / 2, A2 = (cls - cdMax * Math.sin(as) * Math.cos(as)) * Math.sin(as) / (Math.cos(as) ** 2);
      const B2 = (cds - cdMax * Math.sin(as) ** 2) / Math.cos(as);
      return { as, A1, A2, B2 };
    };
    const vp = vit(amax, hi[1], hi[2]), vn = vit(-amin, -lo[1], lo[2]);
    const Vcl = (v, b) => v.A1 * Math.sin(2 * b) + v.A2 * Math.cos(b) ** 2 / Math.sin(b);
    const Vcd = (v, b) => cdMax * Math.sin(b) ** 2 + v.B2 * Math.cos(b);
    const N = 721, al = new Float64Array(N), CL = new Float64Array(N), CD = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      const alpha = -Math.PI + k * (2 * Math.PI / (N - 1));
      let cl, cd;
      if (alpha >= amin && alpha <= amax) {
        const ad = alpha * R2D; let i = 1; while (i < rows.length - 1 && rows[i][0] < ad) i++;
        const r0 = rows[i - 1], r1 = rows[i], w = (ad - r0[0]) / ((r1[0] - r0[0]) || 1);
        cl = r0[1] + w * (r1[1] - r0[1]); cd = r0[2] + w * (r1[2] - r0[2]);
      } else if (alpha > amax) {
        if (alpha <= Math.PI / 2) { cl = Vcl(vp, alpha); cd = Vcd(vp, alpha); }
        else { const b = Math.PI - alpha; cl = b > amax ? -0.7 * Vcl(vp, b) : -0.7 * Vcl(vp, amax) * (b / amax); cd = cdMax * Math.sin(alpha) ** 2 + 0.03; }
      } else {
        const na = -alpha;
        if (na <= Math.PI / 2) { cl = -Vcl(vn, na); cd = Vcd(vn, na); }
        else { const b = Math.PI - na; cl = b > -amin ? 0.7 * Vcl(vn, b) : 0.7 * Vcl(vn, -amin) * (b / -amin); cd = cdMax * Math.sin(alpha) ** 2 + 0.03; }
      }
      al[k] = alpha; CL[k] = cl; CD[k] = Math.max(cd, 0.003);
    }
    const t = { Re: 0, al, CL, CD, imported: true };
    return { REs: [1], tables: [t], imported: true, rows };
  }
  function lookupTable(tb, alpha) {
    alpha = wrapPi(alpha);
    const f = (alpha + Math.PI) / (2 * Math.PI) * 720;
    const i = Math.min(719, Math.max(0, Math.floor(f))), w = f - i;
    return [tb.CL[i] + w * (tb.CL[i + 1] - tb.CL[i]), tb.CD[i] + w * (tb.CD[i + 1] - tb.CD[i])];
  }
  function lookup(ps, alpha, Re) {
    const R = ps.REs;
    if (R.length === 1) return lookupTable(ps.tables[0], alpha);
    if (Re <= R[0]) return lookupTable(ps.tables[0], alpha);
    if (Re >= R[R.length - 1]) return lookupTable(ps.tables[R.length - 1], alpha);
    let i = 1; while (R[i] < Re) i++;
    const w = Math.log(Re / R[i - 1]) / Math.log(R[i] / R[i - 1]);
    const a = lookupTable(ps.tables[i - 1], alpha), b = lookupTable(ps.tables[i], alpha);
    return [a[0] + w * (b[0] - a[0]), a[1] + w * (b[1] - a[1])];
  }
  function bestLD(ps, Re, range) {
    let best = { ld: -1e9, a: 0, cl: 0, cd: 1 };
    const lo = (range ? range[0] : -5), hi = (range ? range[1] : 20);
    for (let d = lo; d <= hi; d += 0.25) {
      const [cl, cd] = lookup(ps, d * D2R, Re);
      if (cl / cd > best.ld) best = { ld: cl / cd, a: d, cl, cd };
    }
    return best;
  }

  /* ---------- HAWT blade design (Schmitz) ---------- */
  function designHAWT(p) {
    // p: R, Rhub, B, tsr, aDes(deg), clDes, nSec, linearize, chordScale, twistScale, maxChordRatio
    const secs = [];
    const n = p.nSec;
    for (let i = 0; i < n; i++) {
      const s = 0.5 * (1 - Math.cos(Math.PI * (i + 0.5) / n));
      const r = p.Rhub + (p.R - p.Rhub) * (0.02 + 0.98 * s * 0.985 + 0.0);
      secs.push(r);
    }
    const rows = secs.map(r => {
      const lr = p.tsr * r / p.R;
      const phi = 2 / 3 * Math.atan(1 / lr);
      let c = 16 * Math.PI * r / (p.B * p.clDes) * Math.sin(phi / 2) ** 2;
      const tw = phi * R2D - p.aDes;
      return { r, c, tw };
    });
    if (p.linearize) {
      const pick = f => rows.reduce((b, x) => Math.abs(x.r / p.R - f) < Math.abs(b.r / p.R - f) ? x : b);
      const A = pick(0.35), Bq = pick(0.85);
      const lin = (x, k) => A[k] + (Bq[k] - A[k]) * (x.r - A.r) / (Bq.r - A.r);
      rows.forEach(x => { x.c = lin(x, 'c'); x.tw = lin(x, 'tw'); });
    }
    const tipTw = rows[rows.length - 1].tw;
    rows.forEach(x => {
      x.c = Math.max(0.02 * p.R, Math.min(x.c * p.chordScale, p.maxChordRatio * p.R));
      x.tw = tipTw + (x.tw - tipTw) * p.twistScale; // twist in deg (absolute incl. tip pitch)
    });
    // dr
    for (let i = 0; i < rows.length; i++) {
      const rl = i === 0 ? p.Rhub : (rows[i - 1].r + rows[i].r) / 2;
      const rh = i === rows.length - 1 ? p.R : (rows[i + 1].r + rows[i].r) / 2;
      rows[i].dr = rh - rl;
    }
    return rows;
  }

  /* ---------- BEM ---------- */
  function bemPoint(cfg, V, omega, yaw, pitch, state) {
    // cfg: {R,Rhub,B,rows,polarAt(i)->ps, rho, mu}
    const { R, Rhub, B, rows, rho, mu } = cfg;
    const nPsi = Math.abs(yaw) > 0.5 * D2R ? 8 : 1;
    const Vax = V * Math.cos(yaw), Vip = V * Math.sin(yaw);
    let Q = 0, T = 0;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const e = rows[i], r = e.r, c = e.c, th = (e.tw + pitch) * D2R;
      const sigma = B * c / (2 * Math.PI * r);
      const ps = cfg.polarFor(i);
      let qS = 0, tS = 0, detail = null;
      for (let k = 0; k < nPsi; k++) {
        const psi = 2 * Math.PI * k / nPsi;
        const key = i * 8 + k;
        let a = state && state[key] ? state[key][0] : 0.3, ap = state && state[key] ? state[key][1] : 0.0;
        const vt0 = omega * r + Vip * Math.cos(psi);
        let phi = 0, W = 0, cl = 0, cd = 0, F = 1, alpha = 0;
        for (let it = 0; it < 60; it++) {
          const ua = Vax * (1 - a), ut = vt0 * (1 + ap);
          phi = Math.atan2(ua, ut); W = Math.hypot(ua, ut);
          alpha = phi - th;
          [cl, cd] = lookup(ps, alpha, Math.max(1e3, rho * W * c / mu));
          const sp = Math.sin(phi), cph = Math.cos(phi);
          const sps = Math.max(Math.abs(sp), 1e-4);
          const Ft = 2 / Math.PI * Math.acos(clamp(Math.exp(-B * (R - r) / (2 * r * sps)), 0, 1));
          const Fh = 2 / Math.PI * Math.acos(clamp(Math.exp(-B * (r - Rhub) / (2 * Rhub * sps)), 0, 1));
          F = Math.max(Ft * Fh, 1e-3);
          const cn = cl * cph + cd * sp, ct = cl * sp - cd * cph;
          let an;
          const CT = sigma * (1 - a) ** 2 * cn / Math.max(sp * sp, 1e-6);
          if (CT > 0.96 * F) {
            an = (18 * F - 20 - 3 * Math.sqrt(Math.max(0, CT * (50 - 36 * F) + 12 * F * (3 * F - 4)))) / (36 * F - 50);
          } else an = 1 / (4 * F * sp * sp / (sigma * cn) + 1);
          let apn = 1 / (4 * F * sp * cph / (sigma * ct) - 1);
          if (!isFinite(an)) an = 0; if (!isFinite(apn)) apn = 0;
          an = clamp(an, -0.5, 0.98); apn = clamp(apn, -0.5, 1.0);
          if (Math.abs(an - a) < 1e-4 && Math.abs(apn - ap) < 1e-4) { a = an; ap = apn; break; }
          a = a + 0.35 * (an - a); ap = ap + 0.35 * (apn - ap);
        }
        if (state) state[key] = [a, ap];
        const sp = Math.sin(phi), cph = Math.cos(phi);
        const cn = cl * cph + cd * sp, ct = cl * sp - cd * cph;
        const q = 0.5 * rho * W * W * c * e.dr;
        qS += B * q * ct * r; tS += B * q * cn;
        if (k === 0) detail = { r, a, ap, alpha: alpha * R2D, phi: phi * R2D, cl, cd, W, F };
      }
      Q += qS / nPsi; T += tS / nPsi;
      out.push(detail);
    }
    const A = Math.PI * R * R;
    const P = Q * omega;
    const q0 = 0.5 * rho * A * V * V * V;
    return { Q, T, P, Cp: q0 > 0 ? P / q0 : 0, Ct: T / (0.5 * rho * A * V * V), elems: out };
  }
  function hawtCurve(cfg, V, yaw, pitch, lmax) {
    const pts = []; const st = {};
    for (let l = 0.25; l <= lmax + 1e-9; l += 0.25) {
      const om = l * V / cfg.R;
      const r = bemPoint(cfg, V, om, yaw, pitch, st);
      pts.push({ l, Cp: r.Cp, Ct: r.Ct, Cq: r.Cp / l });
    }
    // static torque (l=0) approx using small omega
    const r0 = bemPoint(cfg, V, 0.02 * V / cfg.R, yaw, pitch, {});
    pts.unshift({ l: 0, Cp: 0, Ct: r0.Ct, Cq: r0.Cp / 0.02 });
    return pts;
  }

  /* ---------- Blade as a cantilever beam: discrete spanwise load summation ---------- */
  // r[]: station radii (root->tip); v[]: a lumped quantity at each station (e.g. an annular
  // segment's axial force). Returns, at each station j, the sum of v[i] over all stations
  // outboard of it (r[i] > r[j]) — the discrete analogue of a cantilever's internal axial/shear
  // force carried past that cut.
  function cumulativeOutboard(r, v) {
    const n = r.length, out = new Array(n).fill(0);
    let acc = 0;
    for (let i = n - 1; i >= 0; i--) { out[i] = acc; acc += v[i]; }
    return out;
  }
  // Bending moment at each station from transverse point loads F[] applied at the outboard
  // stations' radii: M[j] = Σ_{i>j} F[i]·(r[i]-r[j]), the discrete cantilever moment carried past
  // that cut by every load further out along the span.
  function cumulativeMoment(r, F) {
    const n = r.length, out = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let m = 0;
      for (let i = j + 1; i < n; i++) m += F[i] * (r[i] - r[j]);
      out[j] = m;
    }
    return out;
  }

  /* ---------- VAWT DMST ---------- */
  // cfg: {type:'H'|'helical'|'phi'|'V', R, H, B, c, pitch(deg), helix(deg), nz, polar, rho, mu}
  function vawtSlices(cfg) {
    const nz = cfg.type === 'H' ? 1 : cfg.nz || 10;
    const out = [];
    for (let k = 0; k < nz; k++) {
      const zf = (k + 0.5) / nz; // 0..1
      const z = (zf - 0.5) * cfg.H;
      let r = cfg.R, delta = 0;
      if (cfg.type === 'phi') { // troposkein ~ parabola, flattened ends
        const s = 2 * z / cfg.H; r = cfg.R * Math.max(0.08, 1 - s * s); delta = Math.atan(Math.abs(-2 * cfg.R * s * 2 / cfg.H));
      } else if (cfg.type === 'V') {
        r = cfg.R * Math.max(0.06, zf); delta = Math.atan(cfg.R / cfg.H);
      }
      const helixOff = cfg.type === 'helical' ? (cfg.helix * D2R) * zf : 0;
      out.push({ z, zf, r, delta, dz: cfg.H / nz, helixOff });
    }
    return out;
  }
  function vawtArea(cfg) {
    const sl = vawtSlices(cfg);
    return sl.reduce((s, x) => s + 2 * x.r * x.dz, 0);
  }
  const NTH = 36; // per half
  function dmstSolveStream(K, lam, theta, cosd, pitch, ps, rho, mu, c, Rl, Vin, Vinf, arF, kInd, ds, cv) {
    // returns u (interference) for a streamtube; Vin: incoming speed; blade speed omega*Rl = lam*Vinf*Rl/R handled by caller via lamLocal
    const f = u => {
      const Vl = u * Vin;
      const Wn = Vl * Math.cos(theta) * cosd, Wt = lam * Vinf - Vl * Math.sin(theta);
      const phi = Math.atan2(Wn, Wt), W2 = Wn * Wn + Wt * Wt;
      const al = phi + pitch;
      let alL = al;
      if (ds) { // simplified Gormont dynamic stall: pitch-rate-dependent shift of the angle used for the static polar lookup
        const dT = 0.02, ph = t => Math.atan2(Vl * Math.cos(t) * cosd, lam * Vinf - Vl * Math.sin(t));
        const dadt = (ph(theta + dT) - ph(theta - dT)) / (2 * dT) * (lam * Vinf / Rl); // rad/s, omega = lam*Vinf/Rl
        const rr = Math.sqrt(Math.min(1, Math.abs(c * dadt / (2 * Math.sqrt(W2)))));
        alL = al - Math.sign(dadt) * (dadt > 0 ? ds.kUp : ds.kDn) * rr; // shift toward the lagging effective angle (rad)
      }
      if (cv) alL += cv * Math.atan(c * (lam * Vinf / Rl) / (4 * Math.sqrt(W2))); // streamline curvature: virtual incidence shift ~ c*omega/(4W) scaled by cv (Migliore, simplified; sign picked so high-lambda Cp drops, as in the literature)
      let [cl, cd] = lookup(ps, alL, Math.max(1e3, rho * Math.sqrt(W2) * c / mu));
      cl *= arF; cd += kInd * cl * cl;
      const cn = cl * Math.cos(phi) + cd * Math.sin(phi), ct = cl * Math.sin(phi) - cd * Math.cos(phi);
      const g = (cn * Math.cos(theta) * cosd + ct * Math.sin(theta)) / Math.max(Math.abs(Math.cos(theta)), 0.03);
      const CTb = 4 * K * (W2 / (Vin * Vin)) * g / cosd;
      const a = 1 - u;
      const CTm = a <= 0.4 ? 4 * a * (1 - a) : 8 / 9 + (4 - 40 / 9) * a + (50 / 9 - 4) * a * a;
      return { r: CTm - CTb, W2, ct, cn, al, cl, cd };
    };
    let lo = 0.05, hi = 1.0;
    const fh = f(hi);
    if (fh.r >= 0) return { u: 1, ...fh };
    let fl = f(lo);
    if (fl.r < 0) return { u: lo, ...fl };
    for (let it = 0; it < 28; it++) {
      const m = 0.5 * (lo + hi), fm = f(m);
      if (fm.r < 0) hi = m; else lo = m;
    }
    return { u: 0.5 * (lo + hi), ...f(0.5 * (lo + hi)) };
  }
  // compute performance at TSR lam (based on max radius R), returns Cp, azimuthal torque coefficient table
  function dmstPoint(cfg, V, lam) {
    const { B, c, rho, mu } = cfg, pitch = cfg.pitch * D2R, R = cfg.R;
    const slices = vawtSlices(cfg), A = vawtArea(cfg);
    const cv = cfg.curvature ? 0.5 : 0; // half of the full virtual-incidence shift: uncalibrated
    const ds = cfg.dynStall ? { kUp: 0.35, kDn: 0.125 } : null; // Gormont K1 (1.4 / 0.5) x 0.25: uncalibrated, gives a few degrees of stall delay
    const dth = Math.PI / NTH;
    const Lb = slices.reduce((q, x) => q + x.dz / Math.cos(x.delta), 0);
    const AR = Math.max(2, Lb / c), arF = AR / (AR + 1.8), kInd = 1 / (Math.PI * AR * 0.85);
    let Qtot = 0, Ttot = 0;
    const qAz = new Float64Array(2 * NTH); // torque per blade vs azimuth (N·m), summed over slices at own local azimuth
    const alAz = new Float64Array(2 * NTH);
    const mid = []; // streamtube velocities of the middle slice (for flow visualisation)
    for (const s of slices) {
      const Rl = s.r, cosd = Math.cos(s.delta), lamL = lam * Rl / R;
      const K = B * c / (8 * Math.PI * Rl);
      const ps = cfg.polar;
      for (let i = 0; i < NTH; i++) {
        const th = -Math.PI / 2 + (i + 0.5) * dth; // upwind
        const up = dmstSolveStream(K, lamL, th, cosd, pitch, ps, rho, mu, c, Rl, V, V, arF, kInd, ds, cv);
        const Ve = V * Math.max(0.05, 2 * up.u - 1);
        const thd = Math.PI - th; // same streamtube downwind
        // downwind: incoming Ve, blade speed still lamL*V
        const dn = dmstSolveStream(K, lamL * V / Ve, thd, cosd, pitch, ps, rho, mu, c, Rl, Ve, Ve, arF, kInd, ds, cv);
        if (s === slices[Math.floor(slices.length / 2)]) mid.push({ th, y: Math.sin(th), up: up.u, ve: Ve / V, dn: dn.u * Ve / V, wake: Math.max(0.05, 2 * dn.u - 1) * Ve / V });
        for (const [res, thx, Vref] of [[up, th, V], [dn, thd, Ve]]) {
          const W2 = res.W2; // in units of Vin^2 already absolute (Vin used)
          const dl = s.dz / cosd;
          const Ft = 0.5 * rho * W2 * c * dl * res.ct;
          const Fn = 0.5 * rho * W2 * c * dl * res.cn;
          const q = Ft * Rl;
          // index into 0..2pi azimuth table
          let az = thx + s.helixOff; az = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const idx = Math.floor(az / dth) % (2 * NTH);
          qAz[idx] += q;
          if (s === slices[Math.floor(slices.length / 2)]) alAz[Math.floor((((thx % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / dth) % (2 * NTH)] = res.al * R2D;
          Qtot += B * q * dth / (2 * Math.PI);
          Ttot += B * (Fn * Math.cos(thx) * cosd + Ft * Math.sin(thx)) * dth / (2 * Math.PI);
        }
      }
    }
    const omega = lam * V / R;
    // parasitic drag of struts / arms (H, helical, V use radial arms)
    if ((cfg.type === 'H' || cfg.type === 'helical') && cfg.struts) {
      const Qs = B * cfg.struts * 0.5 * rho * (cfg.strutCdc || 0.015 * 0.6 * c) * omega * omega * R ** 4 / 4;
      Qtot -= Qs;
      for (let j = 0; j < 2 * NTH; j++) qAz[j] -= Qs / B;
    }
    const P = Qtot * omega, q0 = 0.5 * rho * A * V ** 3;
    return { Q: Qtot, P, Cp: P / q0, Ct: Ttot / (0.5 * rho * A * V * V), qAz, alAz, A, mid };
  }
  // 靜止轉子(λ=0)的啟動轉矩:每個轉子方位角用 360° 靜態極曲線算 B 片葉片的合轉矩。
  // 近似:迎風半圈(cosθ>0)吃全風速,背風半圈吃 0.5 倍尾流風速;無誘導/動態失速,只作為能否自行啟動的定性判斷。
  // 回傳無因次啟動轉矩係數 Cq = Q / (0.5ρ A V² R) 的平均/最小/最大值與是否所有方位角皆為正(可自行啟動)。
  function vawtStaticTorque(cfg, V, nPsi) {
    nPsi = nPsi || 72;
    const { B, c, rho, mu } = cfg, pitch = (cfg.pitch || 0) * D2R, R = cfg.R;
    const slices = vawtSlices(cfg), A = vawtArea(cfg);
    const blade = th => { // 單片葉片、全部截面的轉矩 (N·m)
      let q = 0;
      for (const s of slices) {
        const cosd = Math.cos(s.delta), Vl = V * (Math.cos(th) > 0 ? 1 : 0.5);
        const Wn = Vl * Math.cos(th) * cosd, Wt = -Vl * Math.sin(th);
        const phi = Math.atan2(Wn, Wt), W2 = Wn * Wn + Wt * Wt;
        const [cl, cd] = lookup(cfg.polar, phi + pitch, Math.max(1e3, rho * Math.sqrt(W2) * c / mu));
        q += 0.5 * rho * W2 * c * (s.dz / cosd) * (cl * Math.sin(phi) - cd * Math.cos(phi)) * s.r;
      }
      return q;
    };
    const tot = [];
    for (let i = 0; i < nPsi; i++) {
      let q = 0;
      for (let b = 0; b < B; b++) q += blade(2 * Math.PI * (i / nPsi + b / B));
      tot.push(q / (0.5 * rho * A * V * V * R));
    }
    const mean = tot.reduce((a, x) => a + x, 0) / nPsi;
    const min = Math.min(...tot), max = Math.max(...tot);
    return { mean, min, max, selfStart: min > 0, tot };
  }
  function vawtCurve(cfg, V, lmax) {
    const pts = [];
    for (let l = 0.25; l <= lmax + 1e-9; l += 0.25) {
      const r = dmstPoint(cfg, V, l);
      // ripple: total rotor torque vs rotor azimuth (normalised by mean)
      const tot = new Float64Array(2 * NTH);
      for (let j = 0; j < 2 * NTH; j++) {
        let s = 0; for (let b = 0; b < cfg.B; b++) s += r.qAz[(j + Math.round(b * 2 * NTH / cfg.B)) % (2 * NTH)];
        tot[j] = s;
      }
      pts.push({ l, Cp: r.Cp, Ct: r.Ct, Cq: r.Cp / l, tot, qAz: r.qAz, alAz: r.alAz });
    }
    // starting torque at lam ~ 0: use small lambda
    const r0 = dmstPoint(cfg, V, 0.05);
    const tot0 = new Float64Array(2 * NTH);
    for (let j = 0; j < 2 * NTH; j++) { let s = 0; for (let b = 0; b < cfg.B; b++) s += r0.qAz[(j + Math.round(b * 2 * NTH / cfg.B)) % (2 * NTH)]; tot0[j] = s; }
    pts.unshift({ l: 0, Cp: 0, Ct: r0.Ct, Cq: r0.Cp / 0.05, tot: tot0, qAz: r0.qAz, alAz: r0.alAz });
    return pts;
  }

  /* ---------- Savonius (empirical) ---------- */
  function savoniusCurve(cfg) {
    // cfg: B (2|3), overlap e (ratio), aspect
    const cpMax = (cfg.B === 3 ? 0.165 : 0.2) * (1 - 2.2 * Math.abs(cfg.overlap - 0.18) ** 1.5) * (cfg.endPlates ? 1 : 0.82);
    const lopt = cfg.B === 3 ? 0.72 : 0.85;
    const pts = [];
    for (let l = 0; l <= 2 * lopt + 0.01; l += 0.05) {
      const x = l / lopt;
      const Cp = Math.max(0, cpMax * x * (2 - x) * (1 + 0.15 * (1 - x) * x));
      const cq0 = cpMax * 2 / lopt * 0.9;
      const Cq = l < 0.05 ? cq0 : Cp / l;
      const tot = new Float64Array(2 * NTH);
      const amp = cfg.B === 3 ? 0.35 : 0.7;
      for (let j = 0; j < 2 * NTH; j++) tot[j] = 1 + amp * Math.cos(cfg.B * j * Math.PI / NTH);
      pts.push({ l, Cp, Ct: 0.9 + 0.2 * x, Cq, tot, rel: true });
    }
    return pts;
  }

export { D2R, R2D, NX, XS, NTH, clamp, wrapPi, naca4, naca5, circularArc, parseDat, blendAirfoil, airfoilArea,
  panel, boundaryLayer, buildAeroModel, polarAtRe, buildPolarSet, parsePolarText, lookup, bestLD, designHAWT, bemPoint, hawtCurve,
  cumulativeOutboard, cumulativeMoment, vawtSlices, vawtArea, dmstPoint, vawtStaticTorque, vawtCurve, savoniusCurve };
