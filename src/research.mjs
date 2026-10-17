/* ===== 研究模式:通用三維線葉片(src/line3d.mjs)的檢視與比較工作區 ===== */
// 與主設計狀態 S/G 無關:葉片定義(blade-line3d-v1)與極曲線(blade-handoff-polar-v1)各自匯入。
// 顯示的是「部分扭矩係數」:無誘導或指定軸向折減 a、只含分析區間內翼段,不是整機 Cp 或效率。
import * as L from './line3d.mjs';
import * as Plot from './charts.mjs';
import { card } from './bench.mjs';
import exBlade from '../examples/return-wing/blade_v02_candidate146.json';
import exPolar from '../examples/return-wing/polar_v1.json';

export const Research = (function () {
  const R = { lam: 6, ReR: 800000, load: 'total', n: 321, lam0: 3, lam1: 8, a: {}, mods: {} };
  let blade = null, polar = null, bladeName = '', polarName = '', err = '', built = false, cmp = [], sweepCache = { key: '', rows: null }, timer = 0;
  const $r = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = (v, d) => v == null || !Number.isFinite(v) ? '–' : (+v).toFixed(d);
  const STATUS = {
    supported: '有資料', missing_corner: '查表需要的極曲線點無效(未收斂)', outside_alpha: '攻角超出極曲線範圍', outside_Re: 'Re 超出極曲線範圍',
    nonfinite: '輸入非有限值', unknown_profile: '翼型不在極曲線檔內', zero_chord: '弦長為 0', invalid_chord: '弦長無效', nonfinite_wind: '風速無效(a 非有限)',
    zero_speed: '截面法向相對速度為 0', degenerate_frame: '截面框架未定義(中心線平行主軸)',
  };
  const colors = () => ['--c1', '--c2', '--c3', '--c4', '--c5'].map(Plot.css);

  function load(b, p, bn, pn) {
    try {
      const nb = b != null ? L.parseBladeV1(b) : blade, np = p != null ? L.parsePolarV1(p) : polar; // 空檔("")也要解析並報錯
      blade = nb; polar = np; if (b != null) bladeName = bn; if (p != null) polarName = pn; err = '';
      if (b != null) { R.a = {}; R.mods = {}; cmp = []; restoreCmp(); } else recalcCmp(); // 換極曲線:比較組依新資料重算
    } catch (e) { err = e.message; }
    sweepCache.key = '';
  }
  function loadExample() { load(exBlade, exPolar, '內建範例 blade_v02_candidate146.json', '內建範例 polar_v1.json'); }

  function opNow() { return { lam: R.lam, ReR: R.ReR, polar, a: R.a, load: R.load, n: R.n }; }
  function modLabel(mods) {
    const parts = [];
    for (const br of blade.branches) {
      const m = mods[br.id] || {}, t = [];
      if (m.dBeta) t.push(`β${m.dBeta > 0 ? '+' : ''}${m.dBeta}°`);
      if (m.dBetaLin) t.push(`β線性${m.dBetaLin > 0 ? '+' : ''}${m.dBetaLin}°`);
      if (m.dBetaQuad) t.push(`β二次${m.dBetaQuad > 0 ? '+' : ''}${m.dBetaQuad}°`);
      if (m.profile != null || m.mirror != null) t.push(`${m.profile ?? br.profile}${(m.mirror ?? br.mirror) ? '(鏡射)' : '(原向)'}`);
      if (R.a[br.id]) t.push(`a ${R.a[br.id]}`);
      if (t.length) parts.push(`${br.id}:${t.join('、')}`);
    }
    return parts.join(';') || '定義檔原樣';
  }
  const lams = () => { const o = []; for (let l = R.lam0; l <= R.lam1 + 1e-9; l += 0.25) o.push(+l.toFixed(2)); return o; };
  function sweep(mods, a) {
    return L.sweepLambda(blade, { ReR: R.ReR, polar, a, load: R.load, n: Math.min(R.n, 161) }, lams(), mods);
  }

  /* ---------- 版面 ---------- */
  function layout() {
    if (built) return; built = true;
    const prof = id => `<select id="${id}"></select>`;
    $r('researchInner').innerHTML = `
      <div class="card"><div class="cbx" style="padding-top:12px"><p class="note" style="margin:0"><b>研究模式(通用三維線葉片)</b>:逐截面攻角、局部 Re、力與四分之一弦力偶,沿實體弧長積分成<b>部分扭矩係數</b>(分母 q∞πR³)。
      不含誘導/尾流(a 只是指定的軸向折減情境)、翼根/翼尖/橋接/輪轂、分支間干涉與三維修正;<b>不是整機 Cp 或效率,不可與 Betz 極限比較</b>。極曲線為匯入資料(範例為 XFOIL 二維計算,不是量測);超出資料範圍一律標為缺值,不外插、不補 0。說明見 docs/LINE3D.md。</p></div></div>
      ${card('資料', `<div class="bgrid c2">
        <div><div class="ctrlbar" style="padding:0 0 8px"><button class="btn" id="rsEx">載入內建範例</button><label class="btn ghost" style="cursor:pointer">匯入葉片 JSON<input type="file" id="rsBf" accept=".json,application/json" hidden></label><button class="btn ghost" id="rsBx">匯出目前葉片 JSON</button><button class="btn ghost" id="rsSx">匯出逐截面 CSV</button></div><div id="rsBinfo" class="kv lv"></div></div>
        <div><div class="ctrlbar" style="padding:0 0 8px"><label class="btn ghost" style="cursor:pointer">匯入極曲線 JSON<input type="file" id="rsPf" accept=".json,application/json" hidden></label></div><div id="rsPinfo" class="kv lv"></div></div>
      </div><p class="note" id="rsErr" style="color:var(--warn)"></p>`, '', 'rsData')}
      ${card('工況與修改', `<div class="ctrlbar" style="padding:0 0 8px">
        <label>尖速比 λ <input type="range" id="rsLam" min="1" max="10" step="0.05"><output id="rsLamo"></output></label>
        <label>Re<sub>R</sub> = U∞R/ν <input type="number" id="rsRe" step="10000" min="1000" style="width:110px"></label>
        <label>負載 <select id="rsLoad"><option value="total">力 + 四分之一弦 Cm</option><option value="force">只計力</option></select></label>
        <label>積分節點 <select id="rsN"><option>81</option><option>161</option><option>321</option><option>641</option></select></label>
        <label>λ 掃描 <input type="number" id="rsL0" step="0.5" style="width:60px">–<input type="number" id="rsL1" step="0.5" style="width:60px"></label></div>
        <div class="cmpbox"><table class="auto" style="min-width:560px"><thead><tr><th>分支</th><th>軸向折減 a</th><th>安裝角偏移 Δβ(°)</th><th>線性扭角 s0→s1(°)</th><th>二次扭角 s1 處(°)</th><th>翼型</th><th>方向</th></tr></thead><tbody id="rsMods"></tbody></table></div>
        <p class="note">a 為指定的純軸向速度折減(W = (1−a)e<sub>z</sub> − λ e<sub>z</sub>×x),不是由誘導模型算出。Δβ 加在定義檔的安裝角上;線性/二次扭角以分支弧長正規化(u=0 在起點,u=1 在終點),線性項加 u×值、二次項加 u²×值;翼型改動套用整支分支。</p>`, '', 'rsOp')}
      ${card('結果摘要', `<div id="rsSum"></div>`, '', 'rsRes')}
      ${card('沿弧長分佈(實線有資料;紅色底色為缺值區間,紅色虛線為缺值段的攻角/Re)', `<div class="bgrid"><canvas id="rsCa" style="height:240px"></canvas><canvas id="rsCr" style="height:240px"></canvas><canvas id="rsCq" style="height:240px"></canvas></div>`, '', 'rsDist')}
      ${card('扭角/翼型修改比較:部分 CQ–λ', `<div class="ctrlbar" style="padding:0 0 8px"><button class="btn" id="rsAdd">加入比較(目前設定)</button><button class="btn ghost" id="rsClr">清除比較</button><button class="btn ghost" id="rsCx">匯出 CQ–λ CSV</button><span class="note" style="margin:0">第一筆為基準;缺完整窗資料的 λ 不畫(不補 0)。</span></div>
        <div class="bgrid c2w"><canvas id="rsCl" style="height:280px"></canvas><div class="cmpbox" id="rsCmp"></div></div>`, '', 'rsCmpCard')}`;
    const on = (id, ev, fn) => { const e = $r(id); if (e) e.addEventListener(ev, fn); };
    on('rsEx', 'click', () => { loadExample(); fill(); render(); });
    const readFile = (inp, cb) => { const fl = inp.files && inp.files[0]; if (!fl) return; fl.text().then(t => { cb(t, fl.name); inp.value = ''; fill(); render(); }); };
    on('rsBf', 'change', e => readFile(e.target, (t, n) => load(t, null, n, null)));
    on('rsPf', 'change', e => readFile(e.target, (t, n) => load(null, t, null, n)));
    on('rsBx', 'click', () => { if (blade && typeof save === 'function') save(`${(blade.name || 'blade').replace(/[^\w一-鿿-]+/g, '_').slice(0, 40)}.json`, L.bladeToJSON(blade)); });
    const safeName = () => (blade.name || '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'blade'; // CSV 檔名只用 ASCII,避免瀏覽器改成 download
    on('rsSx', 'click', () => { if (blade && polar && typeof save === 'function') save(`${safeName()}_stations_lam${R.lam.toFixed(2)}.csv`, L.stationsCSV(L.analyzeBlade(blade, opNow(), R.mods), R.load)); });
    on('rsCx', 'click', () => {
      if (!blade || !polar || typeof save !== 'function') return;
      const series = cmp.map((c, k) => ({ label: k === 0 ? '基準' : '比較' + k, rows: c.rows })).concat([{ label: '目前設定', rows: sweepCache.rows || sweep(R.mods, R.a) }]);
      save(`${safeName()}_CQ_lambda.csv`, L.sweepCSV(series));
    });
    on('rsLam', 'input', e => { R.lam = +e.target.value; soon(); });
    on('rsRe', 'change', e => { const v = +e.target.value; if (v > 0) R.ReR = v; sweepCache.key = ''; recalcCmp(); render(); });
    on('rsLoad', 'change', e => { R.load = e.target.value; sweepCache.key = ''; recalcCmp(); render(); });
    on('rsN', 'change', e => { R.n = +e.target.value; sweepCache.key = ''; recalcCmp(); render(); });
    on('rsL0', 'change', e => { R.lam0 = Math.max(0.5, +e.target.value || 3); if (R.lam1 < R.lam0 + 0.5) R.lam1 = R.lam0 + 0.5; sweepCache.key = ''; recalcCmp(); render(); });
    on('rsL1', 'change', e => { R.lam1 = Math.max(R.lam0 + 0.5, +e.target.value || 8); sweepCache.key = ''; recalcCmp(); render(); });
    on('rsMods', 'change', e => {
      const t = e.target, id = t.dataset.br; if (!id) return;
      const m = R.mods[id] = R.mods[id] || {};
      if (t.dataset.k === 'a') { const v = t.value === '' ? 0 : +t.value; R.a[id] = Number.isFinite(v) ? v : 0; }
      if (t.dataset.k === 'db') { const v = +t.value; m.dBeta = Number.isFinite(v) ? v : 0; }
      if (t.dataset.k === 'dl') { const v = +t.value; m.dBetaLin = Number.isFinite(v) ? v : 0; }
      if (t.dataset.k === 'dq') { const v = +t.value; m.dBetaQuad = Number.isFinite(v) ? v : 0; }
      if (t.dataset.k === 'pf') { if (t.value) m.profile = t.value; else delete m.profile; }
      if (t.dataset.k === 'mi') { if (t.value === '') delete m.mirror; else m.mirror = t.value === '1'; }
      sweepCache.key = ''; render();
    });
    on('rsAdd', 'click', () => { if (!blade || !polar) return; if (cmp.length >= 6) cmp.shift(); const mods = structuredClone(R.mods), a = { ...R.a }; cmp.push({ label: modLabel(mods), mods, a, rows: sweep(mods, a) }); saveCmp(); render(); });
    on('rsClr', 'click', () => { cmp = []; saveCmp(); render(); });
    document.querySelectorAll('#researchInner details').forEach(d => d.addEventListener('toggle', () => { if (d.open) render(); }));
  }
  // 比較組存 localStorage(以葉片名稱為鍵,只存設定不存結果;載入同名葉片時還原並重算)
  const CMP_KEY = 'wt-research-cmp-v1';
  function saveCmp() {
    try {
      const all = JSON.parse(localStorage.getItem(CMP_KEY) || '{}');
      all[blade.name] = cmp.map(c => ({ label: c.label, mods: c.mods, a: c.a }));
      localStorage.setItem(CMP_KEY, JSON.stringify(all));
    } catch (e) { /* 無法存取 localStorage 時略過 */ }
  }
  function restoreCmp() {
    try {
      const list = (JSON.parse(localStorage.getItem(CMP_KEY) || '{}') || {})[blade.name];
      if (!Array.isArray(list)) return;
      for (const c of list.slice(-6)) if (c && c.mods && typeof c.mods === 'object') { const a = c.a && typeof c.a === 'object' ? c.a : {}; cmp.push({ label: String(c.label || ''), mods: c.mods, a, rows: sweep(c.mods, a) }); }
    } catch (e) { cmp = []; }
  }
  function recalcCmp() { cmp.forEach(c => { c.rows = sweep(c.mods, c.a); }); }
  function soon() { clearTimeout(timer); timer = setTimeout(render, 40); }

  // 資料資訊與控制項初值(載入新檔後重填)
  function fill() {
    const set = (id, v) => { const e = $r(id); if (e && document.activeElement !== e) e.value = v; };
    set('rsLam', R.lam); set('rsRe', R.ReR); set('rsLoad', R.load); set('rsN', R.n); set('rsL0', R.lam0); set('rsL1', R.lam1);
    $r('rsErr').textContent = err ? '匯入失敗:' + err : '';
    $r('rsBinfo').innerHTML = blade ? `<span>檔案</span><span>${esc(bladeName)}</span><span>名稱</span><span>${esc(blade.name)}</span>
      <span>分支</span><span>${blade.branches.map(b => `${esc(b.id)}(${b.stations.length} 站,${esc(b.profile)}${b.mirror ? ' 鏡射' : ''})`).join('、')}</span>
      <span>分析區間 s</span><span>${blade.window[0]}–${blade.window[1]}</span><span>旋轉複製</span><span>${blade.copies} 份</span>
      ${blade.note ? `<span>說明</span><span style="text-align:left">${esc(blade.note)}</span>` : ''}` : '<span>尚未載入</span><span></span>';
    if (polar) {
      let n = 0, v = 0; for (const p of polar.profiles.values()) for (const l of p.layers) for (const q of l.pts.values()) { n++; if (q.valid) v++; }
      const c = polar.conditions || {};
      $r('rsPinfo').innerHTML = `<span>檔案</span><span>${esc(polarName)}</span><span>翼型</span><span>${[...polar.profiles.keys()].map(esc).join('、')}</span>
        <span>攻角範圍</span><span>${polar.window.alpha[0]}° – ${polar.window.alpha[1]}°</span><span>Re 範圍</span><span>${polar.window.Re[0].toLocaleString()} – ${polar.window.Re[1].toLocaleString()}</span>
        <span>資料點</span><span>${v} 有效 / ${n}(無效點保留為缺值)</span>${c.Ncrit != null ? `<span>條件</span><span>Mach ${esc(c.Mach)} · Ncrit ${esc(c.Ncrit)} · ${esc(c.panels)} 面板</span>` : ''}`;
    } else $r('rsPinfo').innerHTML = '<span>尚未載入</span><span></span>';
    if (blade && polar) {
      const opts = [...polar.profiles.keys()].map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
      $r('rsMods').innerHTML = blade.branches.map(b => {
        const m = R.mods[b.id] || {}, id = esc(b.id);
        return `<tr><td>${id}</td><td><input type="number" data-br="${id}" data-k="a" step="0.05" min="0" max="0.9" value="${R.a[b.id] || 0}" style="width:80px"></td>
          <td><input type="number" data-br="${id}" data-k="db" step="0.5" value="${m.dBeta || 0}" style="width:80px"></td>
          <td><input type="number" data-br="${id}" data-k="dl" step="0.5" value="${m.dBetaLin || 0}" style="width:80px"></td>
          <td><input type="number" data-br="${id}" data-k="dq" step="0.5" value="${m.dBetaQuad || 0}" style="width:80px"></td>
          <td><select data-br="${id}" data-k="pf"><option value="">依定義檔(${esc(b.profile)})</option>${opts}</select></td>
          <td><select data-br="${id}" data-k="mi"><option value="">依定義檔(${b.mirror ? '鏡射' : '原向'})</option><option value="0">原向</option><option value="1">鏡射</option></select></td></tr>`;
      }).join('');
      blade.branches.forEach(b => { const m = R.mods[b.id] || {}; const q = k => $r('rsMods').querySelector(`[data-br="${CSS.escape(b.id)}"][data-k="${k}"]`); q('pf').value = m.profile ?? ''; q('mi').value = m.mirror == null ? '' : m.mirror ? '1' : '0'; });
    } else $r('rsMods').innerHTML = '';
  }

  /* ---------- 繪圖 ---------- */
  function split(st, key) { // 有資料 / 缺值兩條線(缺值段在端點處相接,讓斷點看得出位置)
    const ok = st.map(p => p.status === 'supported' || p.status === 'zero_chord');
    return {
      x: st.map(p => p.s),
      good: st.map((p, i) => ok[i] ? p[key] : NaN),
      bad: st.map((p, i) => (!ok[i] || (i > 0 && !ok[i - 1]) || (i + 1 < st.length && !ok[i + 1])) ? p[key] : NaN),
    };
  }
  function drawDist(res) {
    const col = colors(), warn = Plot.css('--warn'), aw = polar.window.alpha, rw = polar.window.Re;
    const S = (key, scale = 1) => res.branches.flatMap((b, k) => {
      const d = split(b.stations, key), m = v => v * scale;
      return [{ x: d.x, y: d.good.map(m), color: col[k % 5], label: b.id }, { x: d.x, y: d.bad.map(m), color: warn, dash: [5, 3], width: 1.4 }];
    });
    const bands = res.branches.flatMap((b, k) => b.unsupportedIntervals.map(g => ({ x0: g.s0, x1: g.s1, color: warn, alpha: 0.13 }))); // 缺值區間(含只在中點偵測到的)
    const xs = [blade.window[0], blade.window[1]], lim = (v, c) => ({ x: xs, y: [v, v], color: c || Plot.css('--muted'), dash: [2, 3], width: 1 });
    Plot.draw($r('rsCa'), { title: '攻角 α(°);虛線為極曲線攻角範圍', xlabel: 's', ylabel: 'α (°)', series: [...S('alpha'), lim(aw[0]), lim(aw[1])], bands });
    Plot.draw($r('rsCr'), { title: '局部 Re(×10³);虛線為極曲線 Re 範圍', xlabel: 's', ylabel: 'Re (×10³)', series: [...S('Re', 1e-3), lim(rw[0] / 1e3), lim(rw[1] / 1e3)], bands });
    const key = R.load === 'force' ? 'qForce' : 'qTotal';
    const tq = res.branches.flatMap((b, k) => {
      const st = b.stations.map(p => Object.assign({}, p, { qj: p[key] * p.J })), d = split(st, 'qj');
      return [{ x: d.x, y: d.good, color: col[k % 5], label: b.id }, { x: d.x, y: d.bad, color: warn, dash: [5, 3], width: 1.4 }];
    });
    Plot.draw($r('rsCq'), { title: `扭矩密度 q·J(${R.load === 'force' ? '只計力' : '力 + Cm'};單位 q∞R³,每份)`, xlabel: 's', ylabel: 'q·J', series: tq, bands });
  }
  function missRanges(rows) { // 連續缺值的 λ 合併成區段,例如「3–3.75、6.5–8」
    const out = []; let st = null, prev = null;
    for (const r of rows) { if (r.partialCQ == null) { if (st == null) st = r.lam; prev = r.lam; } else if (st != null) { out.push(st === prev ? `${st}` : `${st}–${prev}`); st = null; } }
    if (st != null) out.push(st === prev ? `${st}` : `${st}–${prev}`);
    return out.join('、');
  }
  function drawCmp(cur) {
    const col = colors(), series = [];
    cmp.forEach((c, k) => series.push({ x: c.rows.map(r => r.lam), y: c.rows.map(r => r.partialCQ ?? NaN), color: col[(k + 1) % 5], label: `${k === 0 ? '基準' : '比較' + k}`, dots: 2 }));
    series.push({ x: cur.map(r => r.lam), y: cur.map(r => r.partialCQ ?? NaN), color: Plot.css('--ink'), dash: [4, 3], label: '目前設定', dots: 2 });
    Plot.draw($r('rsCl'), { title: '部分 CQ(不含誘導、接合與橋接;非整機)', xlabel: 'λ', ylabel: '部分 CQ', series, vlines: [{ x: R.lam }] });
    const at = rows => { let best = null; for (const r of rows) if (!best || Math.abs(r.lam - R.lam) < Math.abs(best.lam - R.lam)) best = r; return best; };
    const base = cmp[0] ? at(cmp[0].rows) : null;
    const row = (name, lab, r, colr) => `<tr><td class="nm"><span class="sw" style="background:${colr}"></span>${name}<div class="sub">${esc(lab)}</div></td><td>${r && r.partialCQ != null ? f(r.partialCQ, 5) : '缺值'}</td><td>${base && base.partialCQ != null && r && r.partialCQ != null ? (r.partialCQ - base.partialCQ >= 0 ? '+' : '') + f(r.partialCQ - base.partialCQ, 5) : '–'}</td><td>${r ? f(r.coverage * 100, 1) + '%' : '–'}</td></tr>`;
    const lamAt = (base || at(cur) || { lam: R.lam }).lam;
    $r('rsCmp').innerHTML = `<table class="auto" style="min-width:420px"><thead><tr><th>方案(λ ${lamAt.toFixed(2)})</th><th>部分 CQ</th><th>與基準差</th><th>最低覆蓋率</th></tr></thead><tbody>
      ${cmp.map((c, k) => row(k === 0 ? '基準' : '比較' + k, c.label, at(c.rows), col[(k + 1) % 5])).join('')}
      ${row('目前設定', modLabel(R.mods), at(cur), Plot.css('--ink'))}</tbody></table>
      <p class="note" style="padding:0 6px">目前設定缺值的 λ:${missRanges(cur) || '無'}。比較表取掃描格點中最接近目前 λ 者;掃描用 ${Math.min(R.n, 161)} 節點以加快速度,與摘要的 ${R.n} 節點略有差異。</p>`;
  }
  function summary(res) {
    const why = b => b.unsupportedIntervals.map(g => `s ${f(g.s0, 3)}–${f(g.s1, 3)}:${g.reasons.map(r => STATUS[r] || r).join('、')}`).join('<br>');
    const cq = res.partialCQ;
    $r('rsSum').innerHTML = `<div class="kv lv" style="max-width:620px;margin-bottom:10px">
      <span>部分 CQ(${blade.copies} 份 × Σ分支 / π)</span><span>${cq == null ? '<b style="color:var(--warn)">缺值(完整窗有缺資料段,不補 0)</b>' : `<b>${f(cq, 6)}</b>`}</span>
      <span>工況</span><span>λ ${f(R.lam, 2)} · Re<sub>R</sub> ${R.ReR.toLocaleString()} · ${R.load === 'force' ? '只計力' : '力 + Cm'} · ${R.n} 節點</span>
      <span>最低資料覆蓋率(弧長加權)</span><span>${f(res.coverage * 100, 1)}%</span></div>
      <div class="cmpbox"><table class="auto" style="min-width:640px"><thead><tr><th>分支</th><th>a</th><th>I(完整窗)</th><th>I(有資料段)</th><th>覆蓋率</th><th>缺值段與原因</th></tr></thead><tbody>
      ${res.branches.map(b => `<tr><td>${esc(b.id)}</td><td>${f(b.a, 2)}</td><td>${b.I_full == null ? '缺值' : f(b.I_full, 6)}</td><td>${f(b.I_supported, 6)}</td><td>${f(b.coverage * 100, 1)}%</td><td class="nm" style="text-align:left">${why(b) || '無'}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">I 為單一分支 ∫(x × F̂ + M̂)<sub>z</sub> J ds;「有資料段」只是支撐子區的值,不能當成完整結果。端點/中點檢查不保證區間內沒有更窄的缺口。</p>`;
  }

  function render() {
    if (!$r('researchInner')) return;
    if (!blade && !polar && !err) loadExample();
    layout(); fill();
    const ready = blade && polar;
    ['rsRes', 'rsDist', 'rsCmpCard'].forEach(id => { const e = $r(id); if (e) e.style.display = ready ? '' : 'none'; });
    if (!ready) return;
    const lo = $r('rsLamo'); if (lo) lo.textContent = R.lam.toFixed(2);
    const res = L.analyzeBlade(blade, opNow(), R.mods);
    summary(res); drawDist(res);
    const key = JSON.stringify([R.mods, R.a, R.ReR, R.load, R.n, R.lam0, R.lam1, bladeName, polarName]);
    if (sweepCache.key !== key) sweepCache = { key, rows: sweep(R.mods, R.a) };
    drawCmp(sweepCache.rows);
  }
  return { render, state: R, get blade() { return blade; }, get polar() { return polar; }, last: () => (blade && polar ? L.analyzeBlade(blade, opNow(), R.mods) : null), compareCount: () => cmp.length };
})();
