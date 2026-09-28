/* ===== Design & virtual wind-tunnel test report ===== */
const Report = (function () {
  const R0 = { name: '', author: '', goal: '', incTest: true, incFlow: true, incCmp: true };
  let last = null, busy = false, isStale = false, builtUI = false;
  const $r = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = () => new Promise(r => setTimeout(r, 0));

  /* ---------- chart capture ---------- */
  function capture(fn, W, H) {
    const root = document.documentElement, prevTheme = root.dataset.theme;
    root.dataset.theme = 'light';
    const cv = document.createElement('canvas');
    Plot.draw.force = { W: W || 760, H: H || 340, dpr: 2 };
    let url = '';
    try { fn(cv); url = cv.toDataURL('image/png'); } catch (e) { console.error(e); }
    Plot.draw.force = null;
    if (prevTheme) root.dataset.theme = prevTheme; else delete root.dataset.theme;
    return url;
  }
  const fig = (url, cap) => url ? `<figure><img src="${url}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>` : '';

  /* ---------- virtual tests ---------- */
  function simState() { return { ...SIM, po: { ...SIM.po }, out: SIM.out }; }
  async function runTests(onProg) {
    const keepSim = simState(), keepTun = { ...S.tun }, keepCtab = S.ctab;
    S.tun.running = false;
    const H = S.mode === 'HAWT', darr = !H && S.vawt.type !== 'sav';
    const dt = 0.004, R = G.R, { rho } = air();
    const res = { curve: [], yaw: [], turb: null, gust: null, start: [] };
    let done = 0; const total = 13 + (H ? 4 : 0) + 1 + 1 + 3;
    const prog = t => onProg && onProg(done / total, t);
    async function run(dur, avgFrom, rec) {
      const trips0 = SIM.trips || 0;
      let n = 0, acc = { Pa: 0, Po: 0, Pw: 0, rpm: 0, lam: 0, D: 0, cnt: 0, P2: 0, rpmMax: 0, PoMax: 0, latch: false }, t = 0, ser = rec ? { t: [], rpm: [], Po: [], V: [] } : null;
      const steps = Math.round(dur / dt);
      for (let i = 0; i < steps; i++) {
        simStep(dt); t += dt; const o = SIM.out;
        if (t >= avgFrom) { acc.Pa += o.Pa; acc.Po += o.el.Pout; acc.P2 += o.el.Pout * o.el.Pout; acc.Pw += 0.5 * rho * G.A * o.V ** 3; acc.rpm += o.rpm; acc.lam += o.lam; acc.D += SIM.D; acc.cnt++; }
        acc.rpmMax = Math.max(acc.rpmMax, o.rpm); acc.PoMax = Math.max(acc.PoMax, o.el.Pout); if (SIM.latch) acc.latch = true;
        if (ser && i % 25 === 0) { ser.t.push(+t.toFixed(2)); ser.rpm.push(o.rpm); ser.Po.push(o.el.Pout); ser.V.push(o.V); }
        if (++n % 1500 === 0) await sleep();
      }
      const c = Math.max(1, acc.cnt);
      return { Pa: acc.Pa / c, Po: acc.Po / c, Pw: acc.Pw / c, rpm: acc.rpm / c, lam: acc.lam / c, D: acc.D / c, std: Math.sqrt(Math.max(0, acc.P2 / c - (acc.Po / c) ** 2)), rpmMax: acc.rpmMax, PoMax: acc.PoMax, latch: acc.latch, trips: (SIM.trips || 0) - trips0, ser };
    }
    const reset = (V, lamFrac) => { S.tun.V = V; SIM.Vmeas = V; SIM.omega = G.lopt * V / R * lamFrac; SIM.gust = 0; SIM.gustT = -1; SIM.n = 0; SIM.latch = false; SIM.cutout = false; SIM.brake = false; SIM.po.wref = -1; SIM.Di = null; SIM.tEst = null; SIM.wcap = -1; SIM.pAvg = 0; SIM.D = 0.5; SIM.yaw = S.tun.dir; };
    try {
      S.tun.TI = 0; S.tun.dir = 0; S.tun.yawMode = 'auto';
      const dur = H ? 30 : 48, avg = H ? 16 : 30;
      for (let V = 3; V <= 15; V++) {
        prog(`功率曲線測試 ${V} m/s`);
        reset(V, darr ? 0.85 : 0.6);
        const r = await run(dur, avg);
        const ideal = Math.min(S.load.Pmax, 0.5 * rho * G.A * V ** 3 * G.cpMax * 0.92 * S.load.eta);
        const sp = steadyPower(V);
        res.curve.push({ V, ...r, Cp: r.Pw > 0 ? r.Pa / r.Pw : 0, eff: r.Pw > 0 ? r.Po / r.Pw : 0, ideal, fixed: sp ? sp.Pout : 0 });
        done++;
      }
      if (H) {
        S.tun.yawMode = 'fixed';
        for (const gm of [0, 15, 30, 45]) {
          prog(`偏航測試 ${gm}°`); reset(8, 0.9); S.tun.yawFixed = -gm; SIM.yaw = -gm;
          const r = await run(24, 12); res.yaw.push({ gam: gm, ...r, Cp: r.Pa / r.Pw }); done++;
        }
        S.tun.yawMode = 'auto';
      }
      prog('紊流測試 TI 15%'); reset(8, darr ? 0.9 : 0.9); S.tun.TI = 0.15;
      { const r = await run(H ? 70 : 90, H ? 15 : 30, true); res.turb = r; } done++; S.tun.TI = 0;
      prog('陣風測試'); reset(8, darr ? 0.9 : 0.9);
      { await run(H ? 12 : 30, 99); const base = SIM.out.el.Pout, baseRpm = SIM.out.rpm; SIM.gustT = 0; const r = await run(14, 0, true); res.gust = { ...r, base, baseRpm }; } done++;
      for (const V of [4, 6, 8]) {
        prog(`啟動測試 ${V} m/s`); reset(V, 0); SIM.omega = 0;
        const target = 0.5 * G.lopt * V / R; let tReach = null, t = 0, n = 0; const ser = { t: [], rpm: [] };
        while (t < 60) { simStep(dt); t += dt; if (tReach == null && SIM.omega >= target) tReach = t; if (++n % 50 === 0) { ser.t.push(+t.toFixed(2)); ser.rpm.push(SIM.out.rpm); } if (n % 1500 === 0) await sleep(); }
        res.start.push({ V, tReach, lamEnd: SIM.out.lam, rpmEnd: SIM.out.rpm, ser }); done++;
      }
    } finally {
      Object.assign(S.tun, keepTun); Object.assign(SIM, keepSim); SIM.po = keepSim.po; S.ctab = keepCtab;
    }
    return res;
  }

  /* ---------- report builder ---------- */
  function conclusions(t) {
    const out = [], H = S.mode === 'HAWT';
    if (H) {
      if (G.cpDesign != null && G.cpMax - G.cpDesign > 0.01) out.push(`設計尖速比 λd = ${fmt(S.hawt.tsr, 1)} 時 Cp = ${fmt(G.cpDesign, 3)},比最佳值 ${fmt(G.cpMax, 3)}(λ ${fmt(G.lopt, 2)})低;可將設計尖速比調向 ${fmt(G.lopt, 1)},或讓 MPPT 追蹤 λopt。`);
      else out.push(`設計點 Cp ${fmt(G.cpDesign, 3)} 已接近本轉子的最佳值,扭角與弦長分布與設計尖速比匹配良好。`);
      const tipV = G.lopt * 12; if (tipV > 70) out.push(`在 12 m/s 以最佳尖速比運轉時葉尖速度約 ${fmt(tipV, 0)} m/s,超過 70 m/s 容易產生明顯噪音,住宅區使用建議降低設計尖速比或設定轉速上限。`);
      const st = stSorted(), rootT = getAf(st[0].k).t; if (rootT < 0.18) out.push(`根部翼型相對厚度僅 ${(rootT * 100).toFixed(0)}%,根部彎矩最大,建議改用 t/c ≥ 18–21% 的翼型或加厚根部結構。`);
      if (S.hawt.twMode === 'linear') out.push('目前採用線性扭角,部分截面偏離最佳攻角;若製造允許,可比較「BEM 數值最佳化」扭角的 Cp 差異(方案比較分頁)。');
      const al = (G.rows || []).map(r => r.aAct), mx = Math.max(...al); if (mx > 11) out.push(`設計點最大攻角約 ${fmt(mx, 1)}°,靠近失速,低風速或陣風時可能提早失速。`);
    } else if (S.vawt.type !== 'sav') {
      const sol = S.vawt.B * S.vawt.c / S.vawt.R; out.push(`實度 Bc/R = ${fmt(sol, 3)};最佳尖速比 ${fmt(G.lopt, 2)}、Cp,max ${fmt(G.cpMax, 3)}。實度越高最佳尖速比越低、啟動越容易但最高效率下降。`);
    }
    if (t) {
      const mid = t.curve.filter(c => c.V >= 6 && c.V <= 10 && c.ideal > 0);
      const tr = mid.length ? mid.reduce((s, c) => s + c.Po / c.ideal, 0) / mid.length : null;
      if (tr != null) out.push(tr > 0.92 ? `6–10 m/s 區間實測輸出達理想 MPPT 的 ${(tr * 100).toFixed(0)}%,追蹤效果良好。` : `6–10 m/s 區間實測輸出只有理想 MPPT 的 ${(tr * 100).toFixed(0)}%;可嘗試最佳尖速比/最佳轉矩控制,或調整 P&O 擾動步長與週期。`);
      const trip = t.curve.find(c => c.trips > 0);
      if (trip) out.push(`風速 ${trip.V} m/s 以上,轉子氣動功率超過發電機額定(${fmtP(S.load.Pmax)}),定槳距轉子即使降轉速進入失速仍無法把功率壓在額定內,多次觸發過速/過功率保護。${S.load.cutOut ? `目前已啟用切出風速停機(${fmt(S.load.vCutOut, 1)} m/s),可避免在額定風速以上反覆觸發保護,但測試風速範圍(至 15 m/s)未涵蓋切出風速,仍建議依實際場址風況調整切出/重啟風速。` : '可在「負載→保護」啟用切出風速停機來避免反覆觸發,或加入側偏收尾(furling)、變槳機構;若場址常有高風速,也可加大發電機額定。'}`);
      else out.push(`測試風速範圍(至 15 m/s)內未觸發保護,發電機額定 ${fmtP(S.load.Pmax)} 足以涵蓋此轉子。`);
      const cutin = t.curve.find(c => c.Po > 5); if (cutin) out.push(`實測切入風速約 ${cutin.V} m/s(輸出 > 5 W)。`);
      const fail = t.start.filter(s => s.tReach == null); if (fail.length) out.push(`啟動測試中 ${fail.map(s => s.V + ' m/s').join('、')} 無法在 60 秒內自行起轉到 λopt 的一半,需要馬達輔助啟動、增加實度或改用混合 Savonius 啟動器。`);
      else out.push(`在 4、6、8 m/s 皆能自行啟動,達到半最佳轉速時間分別為 ${t.start.map(s => fmt(s.tReach, 1) + ' s').join('、')}。`);
      if (t.gust && t.gust.latch) out.push('陣風測試觸發保護煞車,代表轉速或功率餘裕不足;可提高發電機額定或轉速上限。');
      if (t.turb) out.push(`紊流 15% 下平均輸出 ${fmtP(t.turb.Po)},功率標準差 ${fmtP(t.turb.std)};轉子慣量越大功率越平順但追蹤越慢。`);
    }
    return out;
  }
  function build(t) {
    const H = S.mode === 'HAWT', sav = !H && S.vawt.type === 'sav', { rho, mu } = air();
    const now = new Date(), dateS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = R0.name || (H ? `${Math.round(S.hawt.B)} 葉水平軸風力機 R ${fmt(S.hawt.R, 2)} m` : `${VAWT_TYPES[S.vawt.type]} R ${fmt(S.vawt.R, 2)} m`);
    const col = n => Plot.css(n);
    let sec = 0; const hN = t => `<h2>${++sec}. ${t}</h2>`;
    let h = `<div class="rh"><div class="rk">設計規劃與虛擬風洞測試報告</div><h1>${esc(title)}</h1><div class="meta">${dateS}${R0.author ? ' · ' + esc(R0.author) : ''} · 由風力機葉片設計工具產生</div></div>`;
    // summary box
    const aep = snapAEP({ A: G.A, cpMax: G.cpMax });
    h += `<div class="sum"><div><b>${fmt(G.cpMax, 3)}</b><span>最大功率係數 Cp</span></div><div><b>${fmt(G.lopt, 2)}</b><span>最佳尖速比</span></div><div><b>${fmtP(0.5 * rho * G.A * (H ? S.hawt.Vd : 8) ** 3 * G.cpMax)}</b><span>氣動功率 @ ${H ? fmt(S.hawt.Vd, 1) : 8} m/s</span></div><div><b>${fmt(aep, 0)}</b><span>年發電量 kWh(理想,年均 ${fmt(S.perf.Vavg, 1)} m/s)</span></div></div>`;
    if (R0.goal) h += `<p class="goal"><b>設計目標:</b>${esc(R0.goal)}</p>`;
    // 1 design conditions
    h += hN('設計條件');
    const cond = H ? [['型式', `水平軸,${Math.round(S.hawt.B)} 葉`], ['轉子半徑 / 輪轂半徑', `${fmt(S.hawt.R, 2)} m / ${fmt(G.Rhub, 3)} m`], ['掃掠面積', fmt(G.A, 2) + ' m²'], ['設計風速 / 設計尖速比', `${fmt(S.hawt.Vd, 1)} m/s / ${fmt(S.hawt.tsr, 1)}`], ['扭角設計方式', { bem: 'BEM 數值最佳化', opt: 'Schmitz 解析解', linear: `線性 ${fmt(S.hawt.twRoot, 1)}° → ${fmt(S.hawt.twTip, 1)}°` }[S.hawt.twMode]], ['槳距角', fmt(S.hawt.pitch, 1) + '°'], ['材料 / 單葉質量', `${MATERIALS[S.hawt.material].name} / ${fmt(G.bladeMass, 2)} kg`]]
      : [['型式', VAWT_TYPES[S.vawt.type]], ['葉片數', Math.round(S.vawt.B)], ['半徑 / 高度', `${fmt(S.vawt.R, 2)} m / ${fmt(S.vawt.H, 2)} m`], ...(sav ? [['重疊比', fmt(S.vawt.overlap, 2)]] : [['弦長 / 翼型', `${fmt(S.vawt.c * 1000, 0)} mm / ${afLabel(S.af.vawt)}`], ['實度 Bc/R', fmt(S.vawt.B * S.vawt.c / S.vawt.R, 3)]]), ['掃掠面積', fmt(G.A, 2) + ' m²'], ['轉子質量', fmt(G.mass, 2) + ' kg']];
    cond.push(['空氣條件', `${fmt(S.tun.T, 0)} °C,海拔 ${fmt(S.tun.alt, 0)} m,ρ = ${fmt(rho, 3)} kg/m³`], ['負載', S.load.kind === 'bat' ? `電池充電 ${S.load.Vbat} V(升降壓轉換器)` : `電阻負載 ${fmt(S.load.RL, 1)} Ω`], ['MPPT 控制', { po: '擾動觀察法 P&O', tsr: '最佳尖速比控制', ot: '最佳轉矩控制', manual: '固定占空比' }[S.load.ctrl]], ['發電機', `ke ${fmt(S.load.ke, 3)} V·s/rad,Rs ${fmt(S.load.Rs, 3)} Ω,額定 ${fmtP(S.load.Pmax)},轉速上限 ${S.load.wmaxRpm} rpm`]);
    if (S.load.cutOut) cond.push(['切出/重啟風速', `${fmt(S.load.vCutOut, 1)} m/s / ${fmt(S.load.vRestart, 1)} m/s(1 秒低通平均風速,含遲滯)`]);
    h += `<table class="kvt">${cond.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
    // 2 airfoils
    if (!sav) {
      h += hN('翼型選擇與極曲線');
      const list = H ? stSorted().map((s, j) => ({ lab: `站 ${j + 1}(r/R ${s.f.toFixed(2)})`, k: s.k, Re: (() => { const rr = s.f, res = Bench.hawtAt(S.hawt.tsr), x = Bench.sectionAt(res, A.clamp(rr, G.Rhub / G.R + 0.01, 0.995)); return x.Re; })() })) : [{ lab: '葉片', k: S.af.vawt, Re: rho * G.lopt * 8 * S.vawt.c / mu }];
      h += `<table><thead><tr><th>位置</th><th>翼型</th><th>t/c</th><th>設計 Re</th><th>最大升阻比</th><th>最佳攻角</th><th>Clmax</th></tr></thead><tbody>${list.map(it => { const ps = getPS(it.k), b = A.bestLD(ps, it.Re, [-4, 16]); let cm = -9; for (let d = -5; d <= 25; d += 0.25) cm = Math.max(cm, A.lookup(ps, d * A.D2R, it.Re)[0]); return `<tr><td>${it.lab}</td><td>${afLabel(it.k)}</td><td>${(getAf(it.k).t * 100).toFixed(1)}%</td><td>${(it.Re / 1e5).toFixed(2)}×10⁵</td><td>${fmt(b.ld, 1)}</td><td>${fmt(b.a, 2)}°</td><td>${fmt(cm, 2)}</td></tr>`; }).join('')}</tbody></table>`;
      const pal = ['--c1', '--c2', '--c3', '--c4', '--c5', '--warn'];
      const polUrl = capture(cv => { const ser = []; list.forEach((it, j) => { const ps = getPS(it.k), al = [], cl = []; for (let d = -8; d <= 22; d += 0.25) { al.push(d); cl.push(A.lookup(ps, d * A.D2R, it.Re)[0]); } ser.push({ x: al, y: cl, color: col(pal[j % 6]), label: afLabel(it.k).replace('NACA ', '') }); }); Plot.draw(cv, { title: '升力係數 Cl–α(各站設計雷諾數)', series: ser, xlabel: '攻角 α (°)', ylabel: 'Cl' }); }, 760, 300);
      const ldUrl = capture(cv => { const ser = []; list.forEach((it, j) => { const ps = getPS(it.k), al = [], ld = []; for (let d = -4; d <= 18; d += 0.25) { const v = A.lookup(ps, d * A.D2R, it.Re); al.push(d); ld.push(v[0] / Math.max(1e-4, v[1])); } ser.push({ x: al, y: ld, color: col(pal[j % 6]), label: afLabel(it.k).replace('NACA ', '') }); }); Plot.draw(cv, { title: '升阻比 L/D–α', series: ser, xlabel: '攻角 α (°)', ylabel: 'L/D' }); }, 760, 300);
      h += `<div class="two">${fig(polUrl, '圖:各翼型升力曲線')}${fig(ldUrl, '圖:各翼型升阻比')}</div>`;
    }
    // 3 geometry
    h += hN(H ? '葉片幾何' : '轉子幾何');
    if (H) {
      const rr = Bench.state.rr;
      h += fig(capture(cv => Bench.drawPlan(cv, rr), 900, 230), '圖:葉片平面形狀(弦向放大)與翼型站位置,顏色代表相對厚度');
      h += `<div class="two">${fig(capture(cv => Bench.drawStack(cv, rr), 520, 340), '圖:剖面疊圖(由葉尖往輪轂看)')}${fig(capture(cv => { const R = G.R, x = G.rows.map(r => r.r / R); Plot.draw(cv, { title: '弦長與扭角分布', series: [{ x, y: G.rows.map(r => r.c / R), color: col('--c1'), label: 'c/R', dots: 2 }, { x, y: G.rows.map(r => r.tw + S.hawt.pitch), color: col('--c2'), axis: 'R', label: 'θ (°)', dots: 2 }], xlim: [0, 1], xlabel: 'r/R', ylabel: 'c/R', ylabelR: 'θ (°)' }); }, 520, 340), '圖:弦長與扭角')}</div>`;
      const res = Bench.hawtAt(S.hawt.tsr);
      h += `<table class="small"><thead><tr><th>#</th><th>r (mm)</th><th>r/R</th><th>弦長 (mm)</th><th>扭角 (°)</th><th>t/c</th><th>翼型組合</th><th>設計 α (°)</th><th>Cl</th><th>L/D</th></tr></thead><tbody>${G.rows.map((x, i) => { const e = res.elems[i]; return `<tr><td>${i + 1}</td><td>${fmt(x.r * 1000, 1)}</td><td>${(x.r / G.R).toFixed(3)}</td><td>${fmt(x.c * 1000, 1)}</td><td>${fmt(x.tw, 2)}</td><td>${(G.afs[i].t * 100).toFixed(1)}%</td><td>${stationBlendLabel(x.r / G.R)}</td><td>${fmt(e.alpha, 2)}</td><td>${fmt(e.cl, 3)}</td><td>${fmt(e.cl / Math.max(1e-4, e.cd), 1)}</td></tr>`; }).join('')}</tbody></table>`;
      h += hN('設計點氣動分析');
      h += `<p>設計點 λd = ${fmt(S.hawt.tsr, 1)}、V = ${fmt(S.hawt.Vd, 1)} m/s:Cp = ${fmt(res.Cp, 3)},Ct = ${fmt(res.Ct, 3)},轉速 ${fmt(S.hawt.tsr * S.hawt.Vd / G.R * 30 / Math.PI, 0)} rpm,推力 ${fmt(res.T, 0)} N,轉矩 ${fmt(res.Q, 1)} N·m。</p>`;
      const keep = Bench.state.q;
      const u1 = capture(cv => { Bench.state.q = 'alpha'; Bench.drawSpan(cv, res, rr); }, 520, 300), u2 = capture(cv => { Bench.state.q = 'load'; Bench.drawSpan(cv, res, rr); }, 520, 300);
      const u3 = capture(cv => { Bench.state.q = 'ld'; Bench.drawSpan(cv, res, rr); }, 520, 300), u4 = capture(cv => { Bench.state.q = 'ind'; Bench.drawSpan(cv, res, rr); }, 520, 300);
      Bench.state.q = keep;
      h += `<div class="two">${fig(u1, '圖:攻角分布(實際 vs 最佳升阻比)')}${fig(u3, '圖:升阻比分布')}${fig(u2, '圖:推力與轉矩分布')}${fig(u4, '圖:誘導因子與葉尖損失')}</div>`;
    } else if (!sav) {
      const res = Bench.vawtAt(G.lopt), n2 = res.alAz.length, az = Array.from({ length: n2 }, (_, i) => (i + 0.5) * 360 / n2);
      const qb = Array.from(res.qAz), tot = qb.map((_, i) => { let s = 0; for (let k = 0; k < G.vcfg.B; k++) s += qb[(i + Math.round(k * n2 / G.vcfg.B)) % n2]; return s; });
      h += `<div class="two">${fig(capture(cv => Plot.draw(cv, { title: `攻角 vs 方位角(λ ${fmt(G.lopt, 2)})`, series: [{ x: az, y: Array.from(res.alAz), color: col('--c1'), label: 'α' }], xlim: [0, 360], xlabel: '方位角 (°)', ylabel: 'α (°)', bands: [{ x0: 90, x1: 270, color: col('--grid') }] }), 520, 300), '圖:中段剖面攻角變化(灰區為下風半圈)')}${fig(capture(cv => Plot.draw(cv, { title: '轉矩 vs 方位角(8 m/s)', series: [{ x: az, y: tot, color: col('--c1'), label: '總轉矩' }, { x: az, y: qb, color: col('--c2'), dash: [4, 3], label: '單葉' }], xlim: [0, 360], xlabel: '方位角 (°)', ylabel: 'N·m' }), 520, 300), '圖:轉矩漣波')}</div>`;
    }
    // 4 performance
    h += hN('轉子性能預測');
    const P = G.perf;
    const cpUrl = capture(cv => Plot.draw(cv, { title: 'Cp–λ 與 Ct', series: [{ x: P.lam, y: P.cp, color: col('--c1'), label: 'Cp' }, { x: P.lam, y: P.ct, color: col('--c2'), axis: 'R', dash: [5, 3], label: 'Ct' }, { x: [0, P.lam[P.lam.length - 1]], y: [16 / 27, 16 / 27], color: col('--muted'), dash: [2, 3], width: 1, label: 'Betz' }], ylim: [0, 0.65], xlabel: '尖速比 λ', ylabel: 'Cp', ylabelR: 'Ct' }), 520, 300);
    const Vs = Array.from({ length: 49 }, (_, i) => 0.5 + i * 0.5);
    const pcUrl = capture(cv => { const ser = [{ x: Vs, y: Vs.map(v => Math.min(S.load.Pmax, 0.5 * rho * G.A * v ** 3 * G.cpMax * 0.92 * S.load.eta)), color: col('--c1'), label: '理想 MPPT(限額定)' }]; if (t) ser.push({ x: t.curve.map(c => c.V), y: t.curve.map(c => c.Po), color: col('--signal'), label: '虛擬風洞實測', dots: 3.5 }, { x: t.curve.map(c => c.V), y: t.curve.map(c => c.fixed), color: col('--c2'), dash: [4, 3], label: `固定 D ${Math.round(S.load.D * 100)}%` }); Plot.draw(cv, { title: '功率曲線', series: ser, xlim: [0, 16], xlabel: '風速 (m/s)', ylabel: '電功率 (W)' }); }, 520, 300);
    h += `<div class="two">${fig(cpUrl, '圖:功率係數與推力係數')}${fig(pcUrl, '圖:功率曲線(預測與實測)')}</div>`;
    // 5 tests
    if (t) {
      h += hN('虛擬風洞測試結果');
      h += `<h3>(1)穩態功率曲線測試</h3><p>紊流 0%、自動對風,每個風速模擬 ${H ? 30 : 48} 秒並取後段平均;控制策略:${{ po: '擾動觀察法', tsr: '最佳尖速比', ot: '最佳轉矩', manual: '固定占空比' }[S.load.ctrl]}。</p>`;
      h += `<table class="small"><thead><tr><th>風速 (m/s)</th><th>轉速 (rpm)</th><th>λ</th><th>Cp 實測</th><th>氣動功率</th><th>輸出電功率</th><th>系統效率</th><th>理想 MPPT</th><th>追蹤率</th><th>占空比</th></tr></thead><tbody>${t.curve.map(c => `<tr><td>${c.V}</td><td>${fmt(c.rpm, 0)}</td><td>${fmt(c.lam, 2)}</td><td>${fmt(c.Cp, 3)}</td><td>${fmtP(c.Pa)}</td><td>${fmtP(c.Po)}</td><td>${fmt(c.eff * 100, 1)}%</td><td>${fmtP(c.ideal)}</td><td>${c.ideal > 1 ? fmt(c.Po / c.ideal * 100, 0) + '%' : '–'}</td><td>${fmt(c.D * 100, 1)}%${c.trips ? ` ⚠保護 ${c.trips} 次` : ''}</td></tr>`).join('')}</tbody></table>`;
      if (t.yaw.length) {
        h += `<h3>(2)偏航誤差測試(8 m/s)</h3><table class="small"><thead><tr><th>偏航誤差</th><th>Cp</th><th>輸出電功率</th><th>相對 0°</th><th>cos³γ 參考</th></tr></thead><tbody>${t.yaw.map(y => `<tr><td>${y.gam}°</td><td>${fmt(y.Cp, 3)}</td><td>${fmtP(y.Po)}</td><td>${fmt(y.Po / Math.max(1e-6, t.yaw[0].Po) * 100, 0)}%</td><td>${fmt(Math.cos(y.gam * A.D2R) ** 3 * 100, 0)}%</td></tr>`).join('')}</tbody></table>`;
      }
      if (t.turb) {
        const s = t.turb.ser;
        h += `<h3>(${t.yaw.length ? 3 : 2})紊流與陣風測試</h3><p>平均風速 8 m/s、紊流強度 15%:平均輸出 ${fmtP(t.turb.Po)},標準差 ${fmtP(t.turb.std)},平均系統效率 ${fmt(t.turb.Po / t.turb.Pw * 100, 1)}%,最高轉速 ${fmt(t.turb.rpmMax, 0)} rpm。陣風(6 秒內增加 45%)下最高轉速 ${fmt(t.gust.rpmMax, 0)} rpm(穩態 ${fmt(t.gust.baseRpm, 0)} rpm)、最高輸出 ${fmtP(t.gust.PoMax)}${t.gust.latch ? ',觸發保護煞車' : ',未觸發保護'}。</p>`;
        const tu = capture(cv => Plot.draw(cv, { title: '紊流測試時間序列', series: [{ x: s.t, y: s.V, color: col('--c3'), label: '風速 (m/s)' }, { x: s.t, y: s.Po, color: col('--c1'), axis: 'R', label: '輸出 (W)' }], xlabel: '時間 (s)', ylabel: 'm/s', ylabelR: 'W' }), 520, 280);
        const gs = t.gust.ser, gu = capture(cv => Plot.draw(cv, { title: '陣風響應', series: [{ x: gs.t, y: gs.rpm, color: col('--c2'), label: '轉速 (rpm)' }, { x: gs.t, y: gs.Po, color: col('--c1'), axis: 'R', label: '輸出 (W)' }], xlabel: '時間 (s)', ylabel: 'rpm', ylabelR: 'W' }), 520, 280);
        h += `<div class="two">${fig(tu, '圖:紊流下的風速與輸出功率')}${fig(gu, '圖:陣風下的轉速與功率')}</div>`;
      }
      h += `<h3>(${t.yaw.length ? 4 : 3})啟動測試</h3><table class="small"><thead><tr><th>風速</th><th>達到 ½·λopt 所需時間</th><th>60 秒後 λ</th><th>60 秒後轉速</th></tr></thead><tbody>${t.start.map(s => `<tr><td>${s.V} m/s</td><td>${s.tReach == null ? '<b class="bad">未能自行啟動</b>' : fmt(s.tReach, 1) + ' s'}</td><td>${fmt(s.lamEnd, 2)}</td><td>${fmt(s.rpmEnd, 0)} rpm</td></tr>`).join('')}</tbody></table>`;
      const pal = ['--c3', '--c1', '--c2'];
      h += fig(capture(cv => Plot.draw(cv, { title: '靜止起轉過程', series: t.start.map((s, j) => ({ x: s.ser.t, y: s.ser.rpm, color: col(pal[j]), label: s.V + ' m/s' })), xlabel: '時間 (s)', ylabel: '轉速 (rpm)' }), 760, 260), '圖:由靜止起轉的轉速變化');
    }
    // 6 flow
    if (R0.incFlow && !sav) {
      h += hN('流場分析');
      const keepRR = Flow.state.rr, keepA = Flow.state.alpha, keepL = Flow.state.lam, keepF = Flow.state.follow;
      Flow.state.rr = 0.7; Flow.state.alpha = null; Flow.state.lam = null; Flow.state.follow = false;
      const inp = Flow.sectionInput();
      const f1 = capture(cv => Flow.drawSection(cv, inp, inp.aDes, { mode: 'speed', lines: true, coarse: true }), 760, 320);
      const f2 = capture(cv => Flow.drawRotor(cv, H ? S.hawt.tsr : G.lopt), 760, 340);
      Flow.state.rr = keepRR; Flow.state.alpha = keepA; Flow.state.lam = keepL; Flow.state.follow = keepF;
      h += fig(f1, `圖:${H ? '0.7R 剖面' : '葉片剖面'}在設計攻角下的位勢流速度場與流線`) + fig(f2, H ? '圖:設計點轉子子午面軸向速度與流管擴張' : '圖:最佳尖速比下的俯視流管速度');
    }
    // 7 comparison
    if (R0.incCmp && SNAPS.length) {
      h += hN('方案比較');
      h += `<table class="small"><thead><tr><th>方案</th><th>Cp,max</th><th>λopt</th><th>高效區 λ</th><th>AEP (kWh)</th></tr></thead><tbody>${SNAPS.map(s => `<tr><td>${esc(s.name)}</td><td>${fmt(s.cpMax, 3)}</td><td>${fmt(s.lopt, 2)}</td><td>${s.band && s.band[0] != null ? fmt(s.band[0], 1) + '–' + fmt(s.band[1], 1) : '–'}</td><td>${fmt(snapAEP(s), 0)}</td></tr>`).join('')}</tbody></table>`;
      const pal = ['--c1', '--c2', '--c3', '--c4', '--c5', '--warn', '--good', '--signal'];
      h += fig(capture(cv => Plot.draw(cv, { title: 'Cp–λ 比較', series: SNAPS.map(s => ({ x: s.lam, y: s.cp, color: col(pal[s.ci % 8]), label: s.name.split(':')[0] })), ylim: [0, 0.62], xlabel: '尖速比 λ', ylabel: 'Cp' }), 760, 300), '圖:各方案功率係數');
    }
    // 8 conclusions
    h += hN('結論與建議');
    h += `<ul>${conclusions(t).map(x => `<li>${x}</li>`).join('')}</ul>`;
    h += hN('模型說明與限制');
    h += `<ul class="muted"><li>翼型極曲線:Hess-Smith 面板法求無黏升力斜率與零升攻角,加上雷諾數相依摩擦阻力、失速估算與 Viterna 失速後外推;精度低於 XFOIL 或風洞實測,可在工具中匯入實測極曲線取代。</li><li>水平軸:葉片元素動量理論(BEM),含 Prandtl 葉尖/輪轂損失與 Buhl 高誘導修正;偏航以分區方位角計算。</li><li>垂直軸:雙重多流管法(DMST),含展弦比修正與支撐臂阻力,未含動態失速與流線彎曲,高尖速比結果偏樂觀。Savonius 為經驗曲線。</li><li>電氣系統:永磁發電機 + 整流 + 升降壓轉換器的準穩態模型;虛擬風洞測試為時域模擬,不含結構振動、塔影與地面邊界層。</li><li>本報告數值適合概念設計與方案比較;製造前建議以 CFD 或實體風洞驗證。</li></ul>`;
    return { title, body: h, date: dateS };
  }
  const CSS = `.rpt{font:14px/1.6 "IBM Plex Sans","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:#15242C;background:#fff;max-width:960px;margin:0 auto;padding:28px 32px;font-variant-numeric:tabular-nums}
.rpt .rh{border-bottom:3px solid #1D5C9E;padding-bottom:12px;margin-bottom:16px}.rpt .rk{color:#1D5C9E;font-weight:600;font-size:13px;letter-spacing:.08em}
.rpt h1{font-size:24px;margin:4px 0}.rpt .meta{color:#5A6C76;font-size:12.5px}
.rpt h2{font-size:18px;margin:28px 0 10px;padding-bottom:4px;border-bottom:1px solid #CAD5DA;break-after:avoid}.rpt h3{font-size:15px;margin:18px 0 6px}
.rpt .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.rpt .sum div{background:#EEF3F5;border-radius:8px;padding:10px 12px}.rpt .sum b{display:block;font-size:22px;color:#1D5C9E}.rpt .sum span{font-size:12px;color:#5A6C76}
.rpt table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:13px}.rpt th,.rpt td{border:1px solid #CAD5DA;padding:5px 7px;text-align:right}.rpt th{background:#EEF3F5;font-weight:600}.rpt td:first-child,.rpt th:first-child{text-align:left}
.rpt table.kvt th{width:32%;text-align:left}.rpt table.kvt td{text-align:left}.rpt table.small{font-size:12px}
.rpt figure{margin:10px 0;break-inside:avoid}.rpt figure img{width:100%;border:1px solid #E1E8EB;border-radius:6px}.rpt figcaption{font-size:12px;color:#5A6C76;text-align:center;margin-top:4px}
.rpt .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rpt .bad{color:#B8412F}.rpt .muted{color:#5A6C76;font-size:13px}.rpt .goal{background:#FFF8E6;border-left:4px solid #D99A00;padding:8px 12px}
.rpt ul{padding-left:20px}.rpt li{margin:4px 0}
@media (max-width:700px){.rpt{padding:16px 12px}.rpt .sum{grid-template-columns:1fr 1fr}.rpt .two{grid-template-columns:1fr}.rpt table{display:block;overflow-x:auto;white-space:nowrap}}
@media print{.rpt{padding:0;max-width:none}.rpt h2{break-before:auto}}`;

  /* ---------- page ---------- */
  function ui() {
    if (builtUI) return; builtUI = true;
    $r('reportInner').innerHTML = `<div class="card"><h2>設計規劃與測試報告</h2><div class="cbx">
      <p class="hint">報告會彙整目前的設計條件、翼型配置、葉片幾何表、氣動分析、性能曲線、方案比較與流場圖,並可在虛擬風洞中自動執行功率曲線、偏航、紊流/陣風與啟動測試(約需 10–40 秒)。產生後可下載成 HTML 檔,用瀏覽器開啟後可列印或另存成 PDF。</p>
      <div class="row wide"><label for="rpName">專案名稱</label><input class="txt" id="rpName" placeholder="例:社區示範 1 kW 小型風機"></div>
      <div class="row wide"><label for="rpAuth">設計者</label><input class="txt" id="rpAuth" placeholder="姓名或單位"></div>
      <div class="row wide"><label for="rpGoal">設計目標</label><textarea id="rpGoal" style="min-height:60px;font-family:inherit;font-size:13px" placeholder="例:年均風速 5.5 m/s 的屋頂場址,48 V 電池充電,希望低噪音"></textarea></div>
      <label class="chk"><input type="checkbox" id="rpTest" checked> 執行虛擬風洞測試(功率曲線、偏航、紊流/陣風、啟動)</label>
      <label class="chk"><input type="checkbox" id="rpFlow" checked> 包含流場分析圖</label>
      <label class="chk"><input type="checkbox" id="rpCmp" checked> 包含方案比較(若已儲存方案)</label>
      <div class="btns"><button class="btn" id="rpGo">產生報告</button><button class="btn ghost hidden" id="rpDl">下載報告 HTML</button><button class="btn ghost hidden" id="rpPrint">列印 / 另存 PDF</button></div>
      <div id="rpProg" class="hint"></div>
    </div></div>
    <div class="card hidden" id="rpCard"><details open><summary>報告預覽</summary><div class="cbx" style="padding:0;overflow:auto"><div id="rpView"></div></div></details></div>`;
    const bindTxt = (id, k) => { const e = $r(id); e.value = R0[k]; e.addEventListener('input', () => { R0[k] = e.value; }); };
    bindTxt('rpName', 'name'); bindTxt('rpAuth', 'author'); bindTxt('rpGoal', 'goal');
    const bindChk = (id, k) => { const e = $r(id); e.checked = R0[k]; e.addEventListener('change', () => { R0[k] = e.checked; }); };
    bindChk('rpTest', 'incTest'); bindChk('rpFlow', 'incFlow'); bindChk('rpCmp', 'incCmp');
    $r('rpGo').addEventListener('click', generate);
    $r('rpDl').addEventListener('click', download);
    $r('rpPrint').addEventListener('click', printIt);
  }
  async function generate() {
    if (busy || !G.perf) return; busy = true;
    const btn = $r('rpGo'), pg = $r('rpProg'); btn.disabled = true; btn.textContent = '產生中…';
    try {
      let t = null;
      if (R0.incTest) t = await runTests((f, txt) => { pg.innerHTML = `<progress value="${f}" max="1" style="width:220px;vertical-align:middle"></progress> ${Math.round(f * 100)}% · ${txt}`; });
      pg.textContent = '繪製圖表與排版…'; await sleep();
      last = build(t); isStale = false;
      $r('rpView').innerHTML = `<style>${CSS}</style><div class="rpt">${last.body}</div>`;
      $r('rpCard').classList.remove('hidden'); $r('rpDl').classList.remove('hidden'); $r('rpPrint').classList.remove('hidden');
      pg.textContent = `已產生(${last.date})。設計若再修改,請重新產生報告。`;
    } catch (e) { console.error(e); pg.textContent = '產生失敗:' + e.message; }
    btn.disabled = false; btn.textContent = '重新產生報告'; busy = false;
  }
  function fullHtml() { return `<!DOCTYPE html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(last.title)} · 設計與測試報告</title><style>body{margin:0;background:#E6ECEE}${CSS}</style></head><body><div class="rpt">${last.body}</div></body></html>`; }
  async function download() {
    if (!last) return;
    const name = `wind-turbine-report-${last.date.replace(/-/g, '')}.html`;
    const r = await save(name, fullHtml());
    if (r !== 'api') toast(r ? '若沒有開始下載,請改用「列印 / 另存 PDF」' : '此環境無法下載,請改用「列印 / 另存 PDF」');
  }
  function printIt() {
    if (!last) return;
    try {
      const w = window.open('', '_blank');
      if (w) { w.document.write(fullHtml()); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 400); return; }
    } catch (e) {}
    try { window.print(); } catch (e) { toast('此環境無法列印,請下載 HTML 後用瀏覽器列印'); }
  }
  function render() { ui(); if (isStale && last) $r('rpProg').textContent = '設計已變更,報告內容可能已過時,請重新產生。'; }
  return { render, stale() { isStale = true; }, runTests, build };
})();
