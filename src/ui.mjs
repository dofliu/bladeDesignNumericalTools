/* ===== UI ===== */
export const $ = s => document.querySelector(s);
export const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? '–' : (+v).toFixed(d);
export function fmtP(w) { const a = Math.abs(w); return a >= 1e6 ? (w / 1e6).toFixed(2) + ' MW' : a >= 1e4 ? (w / 1e3).toFixed(1) + ' kW' : a >= 1e3 ? (w / 1e3).toFixed(2) + ' kW' : w.toFixed(a < 10 ? 1 : 0) + ' W'; }
export function getP(path) { return path.split('.').reduce((o, k) => o[k], S); }
export function setP(path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; }
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400); }

/* ---------- control builders ---------- */
let uid = 0;
export function rng(path, label, min, max, step, unit, o = {}) {
  const id = 'c' + (uid++), sc = o.scale || 1, v = getP(path) * sc;
  return `<div class="row"><label for="${id}">${label}</label><input type="range" id="${id}" data-p="${path}" data-s="${sc}" data-k="${o.kind || 'geo'}" min="${min}" max="${max}" step="${step}" value="${v}"><div class="num"><input type="number" aria-label="${label}" data-p="${path}" data-s="${sc}" data-k="${o.kind || 'geo'}" step="${step}" value="${+v.toFixed(4)}"><span>${unit || ''}</span></div></div>`;
}
export function sel(path, label, opts, o = {}) {
  const id = 'c' + (uid++), cur = String(getP(path));
  const optHtml = opts.map(x => x.g ? `<optgroup label="${x.g}">${x.items.map(([v, t]) => `<option value="${v}" ${String(v) === cur ? 'selected' : ''}>${t}</option>`).join('')}</optgroup>`
    : `<option value="${x[0]}" ${String(x[0]) === cur ? 'selected' : ''}>${x[1]}</option>`).join('');
  return `<div class="row wide"><label for="${id}">${label}</label><select id="${id}" data-p="${path}" data-k="${o.kind || 'geo'}" data-t="${o.num ? 'n' : 's'}">${optHtml}</select></div>`;
}
export function chk(path, label, o = {}) {
  return `<label class="chk"><input type="checkbox" data-p="${path}" data-k="${o.kind || 'geo'}" ${getP(path) ? 'checked' : ''}>${label}</label>`;
}
export const FOLD = new Set(['自訂 NACA 翼型', '匯入翼型資料庫座標', '空氣', '模擬']);
export function grp(title, body) { return `<div class="group${FOLD.has(title) ? ' fold' : ''}" data-g="${title}"><h3 role="button" tabindex="0" aria-expanded="${!FOLD.has(title)}">${title}<span class="car">▾</span></h3><div class="gb">${body}</div></div>`; }
export function afOptions() {
  const g = AF_LIB.map(x => ({ g: x.g, items: x.k.map(k => [k, afLabel(k)]) }));
  const extra = [...S.af.custom.map(k => [k, afLabel(k)]), ...S.af.imported.map((it, i) => ['imp:' + i, it.af.name])];
  if (extra.length) g.push({ g: '自訂與匯入', items: extra });
  return g;
}

/* ---------- panes ---------- */
export function stationEditor() {
  const vk = viewKey(); S.af.st.sort((a, b) => a.f - b.f); S.af.view = Math.max(0, S.af.st.findIndex(s => s.k === vk));
  const st = S.af.st, n = st.length;
  let h = st.map((s, i) => `<div class="stn"><div class="stnh"><b>站 ${i + 1}</b>${n > 2 ? `<button class="iconbtn" data-stdel="${i}" aria-label="刪除站 ${i + 1}">刪除</button>` : ''}</div>` +
    sel(`af.st.${i}.k`, '翼型', afOptions(), { kind: 'af' }) + rng(`af.st.${i}.f`, '位置 r/R', 0, 1, 0.01, '', { kind: 'af' }) + `</div>`).join('');
  h += `<div class="btns">${n < 6 ? '<button class="btn ghost" id="stAdd">新增翼型站</button>' : ''}<button class="btn ghost" id="stPreset">套用建議配置</button></div>`;
  h += `<p class="note">每個站指定一種翼型與它在葉片上的位置;兩站之間的外形與極曲線依位置線性混合,第一站以內、最後一站以外維持該站翼型。常見做法是根部用厚翼型(t/c 18–25%)承受彎矩,中段過渡,尖部用高升阻比的薄翼型(t/c 12–15%),因為功率主要來自外側 60% 展長。</p>`;
  return h;
}
export function paneAirfoil() {
  const H = S.mode === 'HAWT';
  let h = '';
  h += grp(H ? '沿展長的翼型分布' : '翼型選擇', H ? stationEditor()
    : (S.vawt.type === 'sav' ? `<p class="note">Savonius 為阻力型轉子,由半圓筒葉片構成,不使用翼型;請到「轉子」設定重疊比與端板。</p>` : sel('af.vawt', '葉片翼型', afOptions(), { kind: 'af' }) +
      `<p class="note">垂直軸葉片會經歷正負攻角交替,常用對稱翼型(NACA 00xx)。厚翼型失速較緩和、有助於啟動。</p>`));
  h += grp('自訂 NACA 翼型', `<div class="row wide"><label for="nacaIn">4 或 5 位數</label><div style="display:flex;gap:6px"><input class="txt" id="nacaIn" placeholder="例:2418、23015" inputmode="numeric"><button class="btn" id="nacaAdd">加入</button></div></div>`);
  h += grp('匯入翼型資料庫座標', `<p class="note">支援 Selig 與 Lednicer 格式的 .dat 座標檔,可直接使用 UIUC Airfoil Coordinates Database、Airfoil Tools 下載的檔案(例如 S809、SG6043、FX 63-137、DU 93-W-210)。</p>
    <div class="btns"><button class="btn ghost" id="datFile">選擇 .dat 檔</button></div>
    <textarea id="datText" placeholder="或把座標貼在這裡:第一行名稱,之後每行 x y"></textarea>
    <div class="btns"><button class="btn" id="datAdd">加入翼型庫</button></div>`);
  const tgt = H ? [...new Map(S.af.st.map((s, i) => [s.k, `站 ${i + 1}:${afLabel(s.k)}`])).entries()] : [[S.af.vawt, '葉片翼型:' + afLabel(S.af.vawt)]];
  h += grp('極曲線模型', rng('af.cdMax', '失速後 CDmax', 1.0, 2.0, 0.05, '', { kind: 'af' }) +
    `<p class="note">內建模型:Hess-Smith 面板法求無黏升力斜率與零升攻角,加上雷諾數相依的摩擦阻力、失速估算與 Viterna 失速後外推(−180°~180°)。需要更高精度時,可貼上 XFOIL 或風洞實測極曲線取代。</p>
    <details><summary>貼上 XFOIL/實測極曲線</summary>
      <div class="row wide" style="margin-top:6px"><label for="polTgt">套用到</label><select id="polTgt">${tgt.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
      <textarea id="polText" placeholder="每行:α(度) Cl Cd …(XFOIL 輸出可直接貼上,表頭會自動略過)"></textarea>
      <div class="btns"><button class="btn" id="polApply">套用極曲線</button><button class="btn ghost" id="polClear">改回內建模型</button></div>
    </details>`);
  h += grp('翼型摘要', `<div class="kv" id="afSummary"></div>`);
  return h;
}
export function paneRotor() {
  let h = '';
  if (S.mode === 'HAWT') {
    h += grp('幾何', rng('hawt.B', '葉片數 B', 1, 6, 1, '片') + rng('hawt.R', '轉子半徑 R', 0.3, 60, 0.05, 'm') + rng('hawt.Rhub', '輪轂半徑', 0.03, 6, 0.01, 'm') + rng('hawt.nSec', '截面數', 8, 30, 1, ''));
    const tm = S.hawt.twMode;
    h += grp('設計點與弦長', rng('hawt.tsr', '設計尖速比 λd', 2, 12, 0.1, '') + rng('hawt.Vd', '設計風速', 3, 15, 0.5, 'm/s') +
      sel('hawt.aMode', '目標攻角', [['auto', '自動:各截面最佳升阻比'], ['manual', '手動指定']]) +
      (S.hawt.aMode === 'manual' ? rng('hawt.aDes', '攻角 α', -2, 14, 0.25, '°') : '') +
      `<p class="note">弦長以 Schmitz 公式依設計尖速比與各截面翼型的升力係數求得。</p>`);
    h += grp('扭角設計', sel('hawt.twMode', '扭角方式', [['bem', 'BEM 數值最佳化(設計 λ 下 Cp 最大)'], ['opt', 'Schmitz 解析解(快速)'], ['linear', '線性扭角(手動指定根/尖)']], { kind: 'geoPane' }) +
      (tm === 'linear' ? rng('hawt.twRoot', '根部扭角', -5, 40, 0.5, '°') + rng('hawt.twTip', '尖部扭角', -10, 15, 0.5, '°') : rng('hawt.twistScale', '扭轉倍率', 0, 1.5, 0.05, '×')) +
      `<p class="note">${{ bem: '在設計尖速比與設計風速下,以完整 BEM(含軸向/切向誘導、葉尖與輪轂損失、實際雷諾數)對每個截面搜尋讓局部轉矩最大的扭角。結果多半接近最大升阻比攻角,但葉尖附近會因葉尖損失而略為降低攻角。此模式不使用「目標攻角」設定。', opt: 'Schmitz 以理想入流角 φ = ⅔·atan(1/λr) 推得扭角,未計入葉尖損失,與 BEM 最佳解通常差 0.5–2°。', linear: '扭角由根部到尖部線性變化,最容易製造;可到「葉片分析」觀察設計點各截面攻角偏離最佳值多少。' }[tm]}</p>` );
    h += grp('製造修正', chk('hawt.linearize', '弦長與扭轉線性化(以 35%/85% 展長為基準,便於製造)') + rng('hawt.chordScale', '弦長倍率', 0.4, 2, 0.05, '×') + rng('hawt.maxChord', '最大弦長 / R', 0.04, 0.3, 0.005, '') +
      sel('hawt.material', '材料', Object.entries(MATERIALS).map(([k, m]) => [k, m.name])) +
      `<details id="secBox"><summary>截面表(可逐一手動修改)</summary><div id="secTable"></div><div class="btns"><button class="btn ghost" id="ovReset">清除手動修改</button></div></details>`);
    h += grp('控制', rng('hawt.pitch', '槳距角', -5, 30, 0.5, '°', { kind: 'pitch' }) + `<p class="note">正值往順槳方向轉,可降低功率與推力,用來做過速保護或啟動。</p>`);
  } else {
    const v = S.vawt;
    h += grp('型式', sel('vawt.type', '轉子結構', Object.entries(VAWT_TYPES), { kind: 'type' }));
    if (v.type === 'sav') {
      h += grp('幾何', rng('vawt.B', '葉片數', 2, 3, 1, '片') + rng('vawt.R', '轉子半徑 R', 0.1, 3, 0.01, 'm') + rng('vawt.H', '高度 H', 0.2, 6, 0.05, 'm') +
        rng('vawt.overlap', '重疊比 e/d', 0, 0.4, 0.01, '') + chk('vawt.endPlates', '上下端板') +
        sel('vawt.material', '材料', Object.entries(MATERIALS).map(([k, m]) => [k, m.name])) +
        `<p class="note">Savonius 性能採經驗曲線(Cp 約 0.15–0.2,最佳 λ 約 0.7–0.9,重疊比 0.15–0.25 最佳),啟動轉矩大但效率低。</p>`);
    } else {
      h += grp('幾何', rng('vawt.B', '葉片數 B', 1, 6, 1, '片') + rng('vawt.R', v.type === 'phi' ? '赤道半徑 R' : v.type === 'V' ? '頂端半徑 R' : '轉子半徑 R', 0.2, 20, 0.05, 'm') +
        rng('vawt.H', '高度 H', 0.2, 40, 0.05, 'm') + rng('vawt.c', '弦長 c', 0.02, 2, 0.005, 'm') +
        rng('vawt.pitch', '安裝角(外傾+)', -10, 10, 0.5, '°') +
        (v.type === 'helical' ? rng('vawt.helix', '螺旋包角', 0, 240, 5, '°') : '') +
        ((v.type === 'H' || v.type === 'helical') ? rng('vawt.struts', '每葉支撐臂數', 0, 3, 1, '支') : '') +
        sel('vawt.material', '材料', Object.entries(MATERIALS).map(([k, m]) => [k, m.name])));
      h += `<p class="note">性能以雙重多流管法(DMST)計算,含葉片展弦比修正與支撐臂寄生阻力;未計入動態失速與流線彎曲效應,低實度高尖速比下結果偏樂觀。</p>`;
    }
  }
  h += grp('轉子摘要', `<div class="kv" id="rotorSummary"></div>`);
  h += grp('方案比較', `<p class="note">把目前的翼型分布、扭角與幾何存成方案,到下方「方案比較」分頁疊圖比較 Cp–λ、扭角/攻角分布與年發電量,也可一鍵載入回來繼續修改。</p><div class="btns"><button class="btn" id="snapSaveP">儲存目前方案</button></div>`);
  return h;
}
export function paneTunnel() {
  let h = '';
  h += grp('來流', rng('tun.V', '風速', 0, 25, 0.1, 'm/s', { kind: 'wind' }) + rng('tun.dir', '風向', -180, 180, 1, '°', { kind: 'live' }) +
    rng('tun.TI', '紊流強度', 0, 30, 0.5, '%', { kind: 'live', scale: 100 }) +
    `<div class="btns"><button class="btn ghost" id="gustBtn">施加陣風(6 秒)</button></div>`);
  h += grp('空氣', rng('tun.T', '溫度', -10, 40, 1, '°C', { kind: 'wind' }) + rng('tun.alt', '海拔', 0, 3500, 50, 'm', { kind: 'wind' }) + `<div class="kv" id="airKv"></div>`);
  if (S.mode === 'HAWT') {
    h += grp('偏航(對風)', sel('tun.yawMode', '偏航模式', [['auto', '自動對風'], ['fixed', '固定機艙角']], { kind: 'pane' }) +
      (S.tun.yawMode === 'auto' ? rng('tun.yawRate', '偏航速率', 1, 60, 1, '°/s', { kind: 'live' }) : rng('tun.yawFixed', '機艙角', -180, 180, 1, '°', { kind: 'live' })) +
      `<p class="note">偏航誤差下以分區方位角 BEM 計算(偏斜入流),大約遵循 cos²~cos³ 的功率衰減。</p>`);
  } else h += grp('風向', `<p class="note">垂直軸轉子不需對風,風向改變只影響轉矩漣波的相位,可以轉動風向滑桿觀察。</p>`);
  h += grp('模擬', sel('tun.timeScale', '時間倍率', [[1, '1×(即時)'], [2, '2×'], [5, '5×'], [10, '10×']], { kind: 'live', num: true }) +
    `<div class="btns"><button class="btn ghost" id="resetSim">轉子歸零重新啟動</button><button class="btn ghost" id="spinUp">預先轉到最佳轉速</button></div>`);
  return h;
}
export function paneLoad() {
  const L = S.load;
  let h = '';
  h += grp('發電機(永磁同步 + 整流)', chk('load.auto', '依轉子設計自動匹配參數', { kind: 'gen' }) + rng('load.ke', '反電勢常數 ke', 0.01, 200, 0.01, 'V·s/rad', { kind: 'live' }) +
    rng('load.Rs', '繞組電阻 Rs', 0.001, 50, 0.001, 'Ω', { kind: 'live' }) + rng('load.Vdiode', '整流壓降', 0, 3, 0.1, 'V', { kind: 'live' }) +
    rng('load.eta', '轉換器效率', 80, 99, 0.5, '%', { kind: 'live', scale: 100 }) + `<div class="btns"><button class="btn ghost" id="matchBtn">立即重新匹配</button></div>`);
  h += grp('負載', sel('load.kind', '負載類型', [['bat', '電池充電(定電壓)'], ['res', '電阻負載']], { kind: 'pane' }) +
    (L.kind === 'bat' ? rng('load.Vbat', '電池電壓', 6, 800, 1, 'V', { kind: 'live' }) : rng('load.RL', '負載電阻', 0.05, 500, 0.05, 'Ω', { kind: 'live' })) +
    `<p class="note">發電機經整流後接昇降壓 DC-DC 轉換器,占空比 D 改變發電機端看到的等效負載:${L.kind === 'bat' ? 'V<sub>in</sub> = V<sub>bat</sub>(1−D)/D' : 'R<sub>in</sub> = R<sub>L</sub>((1−D)/D)²'}。</p>`);
  h += grp('MPPT 控制', sel('load.ctrl', '控制策略', [['po', '擾動觀察法 P&O(爬山法)'], ['tsr', '最佳尖速比控制(需風速計)'], ['ot', '最佳轉矩控制 T = kω²'], ['manual', '手動固定占空比']], { kind: 'pane' }) +
    (L.ctrl === 'po' ? rng('load.poStep', '轉速擾動 Δω(額定%)', 0.5, 10, 0.5, '%', { kind: 'live', scale: 100 }) + rng('load.poT', '擾動週期', 0.2, 5, 0.1, 's', { kind: 'live' }) : '') +
    rng('load.D', L.ctrl === 'manual' ? '占空比 D' : '固定 D(比較用)', 3, 97, 0.5, '%', { kind: 'live', scale: 100 }) +
    `<p class="note">${{ po: '每個週期擾動轉速參考值(內迴路以占空比追蹤轉速),若平均輸出功率下降就反向;不需風速計與轉子特性,但穩態會在最大功率點附近振盪,擾動週期須長於轉子的機械時間常數,紊流大時也容易誤判方向。', tsr: '量測風速後令 ω* = λ<sub>opt</sub>V/R,以 PI 調整占空比追蹤;反應快,但依賴風速計精度。', ot: '依 Cp<sub>max</sub> 與 λ<sub>opt</sub> 算出 k<sub>opt</sub>,令發電機轉矩追蹤 kω²;不需風速計,穩定但依賴轉子模型正確。', manual: '不做追蹤,直接以固定等效負載運轉,可比較 MPPT 的增益。' }[L.ctrl]}</p>`);
  h += grp('保護', chk('load.ospd', '超速保護(超過上限自動煞車)', { kind: 'live' }) + rng('load.wmaxRpm', '轉速上限', 10, 3000, 5, 'rpm', { kind: 'live' }) + rng('load.Pmax', '發電機額定功率', 10, 50000, 10, 'W', { kind: 'live' }) +
    `<p class="note">轉速超過上限或輸出功率超過額定 125% 時啟動保護煞車,待轉速降到上限的 55% 才解除。</p>` +
    chk('load.cutOut', '啟用切出風速停機(側偏收尾/停機保護的簡化模型)', { kind: 'pane' }) +
    (L.cutOut ? rng('load.vCutOut', '切出風速', 5, 40, 0.5, 'm/s', { kind: 'live' }) + rng('load.vRestart', '重啟風速', 3, Math.max(3, L.vCutOut - 0.5), 0.5, 'm/s', { kind: 'live' }) +
      `<p class="note">1 秒低通平均風速超過切出風速即煞車停機,待風速降到重啟風速以下才恢復運轉(遲滯避免陣風造成反覆停機/重啟)。</p>` : '') +
    (S.mode === 'HAWT' ? chk('load.pitchCtl', '啟用主動變槳(額定以上順槳控功率)', { kind: 'pane' }) +
      (L.pitchCtl ? rng('load.pitchRate', '變槳速率上限', 1, 30, 0.5, '°/s', { kind: 'live' }) +
        `<p class="note">額定以上固定轉速在額定值,功率 PI 將槳葉順槳(0–40°,受速率限制)取代軟失速降轉速;目前槳距 <b id="pitchNow">–</b>。需要 Cp(λ,β) 查表,首次啟用會稍微計算。</p>` : '') : '') +
    `<div class="btns"><button class="btn warn" id="brakeBtn">${SIM.brake ? '放開煞車' : '煞車(短路 + 機械)'}</button></div>`);
  h += grp('電氣即時值', `<div class="kv" id="elecKv"></div>`);
  return h;
}
export function renderPane() {
  const p = $('#pane');
  const f = { af: paneAirfoil, rotor: paneRotor, tunnel: paneTunnel, load: paneLoad }[S.step];
  const st = p.scrollTop;
  p.innerHTML = f();
  bindPane(p);
  p.scrollTop = st;
  updateSummaries();
  if (S.step === 'rotor') renderSecTable();
  renderQuick();
}
export function renderQuick() {
  const q = $('#quickBody'); if (!q) return;
  q.innerHTML = rng('tun.V', '風速', 0, 25, 0.1, 'm/s', { kind: 'wind' }) + rng('tun.dir', '風向', -180, 180, 1, '°', { kind: 'live' }) +
    rng('tun.TI', '紊流強度', 0, 30, 0.5, '%', { kind: 'live', scale: 100 }) +
    sel('load.ctrl', 'MPPT 控制', [['po', '擾動觀察 P&O'], ['tsr', '最佳尖速比'], ['ot', '最佳轉矩'], ['manual', '固定占空比']], { kind: 'live' }) +
    `<div class="btns"><button class="btn ghost" id="gustBtn">施加陣風</button><button class="btn ghost" id="spinUp">轉到最佳轉速</button></div>`;
  bindPane(q);
}
export function bindPane(p) {
  p.querySelectorAll('.group>h3').forEach(h => {
    const tog = () => { const g = h.parentElement, t = g.dataset.g; g.classList.toggle('fold'); const f = g.classList.contains('fold'); if (f) FOLD.add(t); else FOLD.delete(t); h.setAttribute('aria-expanded', !f); if (!f && t === '製造修正') renderSecTable(); };
    h.addEventListener('click', tog); h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
  });
  p.querySelectorAll('[data-p]').forEach(el => {
    const handler = () => {
      const path = el.dataset.p, kind = el.dataset.k, sc = +(el.dataset.s || 1);
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.tagName === 'SELECT') v = el.dataset.t === 'n' ? +el.value : el.value;
      else { v = parseFloat(el.value); if (!isFinite(v)) return; v /= sc; }
      setP(path, v);
      p.querySelectorAll(`[data-p="${path}"]`).forEach(o => { if (o !== el && o.type !== 'checkbox' && o.tagName !== 'SELECT') o.value = +(v * sc).toFixed(4); });
      onChange(path, kind, el);
    };
    el.addEventListener(el.type === 'range' ? 'input' : 'change', handler);
  });
  const on = (id, fn) => { const e = p.querySelector('#' + id); if (e) e.addEventListener('click', fn); };
  on('nacaAdd', () => {
    const v = p.querySelector('#nacaIn').value.trim();
    if (!/^\d{4,5}$/.test(v)) { toast('請輸入 4 或 5 位數的 NACA 代碼'); return; }
    if (v.length === 4 && +v.slice(2) < 4) { toast('厚度太薄,請至少 4%'); return; }
    const key = (v.length === 4 ? 'n4:' : 'n5:') + v;
    if (!S.af.custom.includes(key) && !AF_LIB.some(g => g.k.includes(key))) S.af.custom.push(key);
    assignNewAirfoil(key); toast('已加入 NACA ' + v);
  });
  on('datFile', () => $('#fileIn').click());
  on('datAdd', () => { const t = p.querySelector('#datText').value; if (t.trim()) importDat(t, null); });
  on('polApply', () => {
    const key = p.querySelector('#polTgt').value, t = p.querySelector('#polText').value;
    try { A.parsePolarText(t); S.af.polarImp[key] = t; toast('已套用極曲線到 ' + afLabel(key)); scheduleRebuild(true); }
    catch (e) { toast(e.message); }
  });
  on('polClear', () => { const key = p.querySelector('#polTgt').value; delete S.af.polarImp[key]; toast('已改回內建模型'); scheduleRebuild(true); });
  on('ovReset', () => { S.hawt.ov = {}; scheduleRebuild(true); });
  on('snapSaveP', () => saveSnap());
  on('stAdd', () => {
    const t = stSorted(); let gi = 0, gap = -1;
    for (let j = 0; j < t.length - 1; j++) if (t[j + 1].f - t[j].f > gap) { gap = t[j + 1].f - t[j].f; gi = j; }
    const f = t.length > 1 ? +((t[gi].f + t[gi + 1].f) / 2).toFixed(2) : 0.9;
    S.af.st.push({ f, k: t[gi].k }); renderPane(); scheduleRebuild(true);
  });
  on('stPreset', () => { S.af.st = [{ f: 0.15, k: 'n4:4421' }, { f: 0.45, k: 'n4:4415' }, { f: 0.8, k: 'n4:4412' }]; S.af.view = 2; renderPane(); scheduleRebuild(true); toast('根部 4421 → 中段 4415 → 尖部 4412'); });
  p.querySelectorAll('[data-stdel]').forEach(b => b.addEventListener('click', () => {
    S.af.st.splice(+b.dataset.stdel, 1); S.af.view = Math.min(+S.af.view || 0, S.af.st.length - 1); renderPane(); scheduleRebuild(true);
  }));
  on('gustBtn', () => { SIM.gustT = 0; toast('陣風來了'); });
  on('resetSim', () => { SIM.tEst = null; SIM.wcap = -1; SIM.Di = null; SIM.omega = 0; SIM.D = S.load.D; SIM.po.last = 0; SIM.po.wref = -1; SIM.latch = false; SIM.cutout = false; for (const k in SIM.hist) SIM.hist[k].length = 0; SIM.traj.length = 0; });
  on('spinUp', () => { SIM.omega = G.lopt * S.tun.V / G.R; SIM.latch = false; SIM.cutout = false; });
  on('matchBtn', () => { autoMatchGen(); renderPane(); toast('已依設計點重新匹配發電機'); });
  on('brakeBtn', e => { SIM.brake = !SIM.brake; e.target.textContent = SIM.brake ? '放開煞車' : '煞車(短路 + 機械)'; });
}
export function assignNewAirfoil(key) {
  if (S.mode === 'HAWT') { const t = stSorted(); const last = t[t.length - 1].i; S.af.st[last].k = key; S.af.view = last; toast('已套用到最外側翼型站'); }
  else { S.af.vawt = key; S.af.view = 'vawt'; }
  renderPane(); scheduleRebuild(true);
}
export function importDat(text, fname) {
  try {
    const af = A.parseDat(text);
    if (fname && (af.name === 'Imported' || !af.name)) af.name = fname.replace(/\.\w+$/, '');
    if (af.t < 0.01 || af.t > 0.5) throw new Error('翼型厚度異常(' + (af.t * 100).toFixed(1) + '%),請確認座標格式');
    S.af.imported.push({ af });
    const key = 'imp:' + (S.af.imported.length - 1);
    afCache.delete(key);
    assignNewAirfoil(key); toast('已匯入 ' + af.name + ',厚度 ' + (af.t * 100).toFixed(1) + '%');
  } catch (e) { toast('匯入失敗:' + e.message); }
}
export function onChange(path, kind, el) {
  if (kind === 'type' || kind === 'pane') { if (kind === 'type') { pendingStart = true; scheduleRebuild(true); } renderPane(); if (path === 'load.ctrl' && S.load.ctrl === 'manual') SIM.D = S.load.D; return; }
  if (kind === 'geoPane') { renderPane(); scheduleRebuild(true); return; }
  if (path === 'hawt.aMode') { renderPane(); }
  if (path === 'load.D' && S.load.ctrl === 'manual') SIM.D = S.load.D;
  if (path === 'load.auto' && S.load.auto) { autoMatchGen(); renderPane(); }
  if (kind === 'geo' || kind === 'af') scheduleRebuild(true);
  else if (kind === 'wind' || kind === 'pitch') scheduleRebuild(kind === 'pitch');
  else if (kind === 'gen') { }
  updateSummaries();
  redrawStatic();
}

/* ---------- section table ---------- */
export function renderSecTable() {
  const box = $('#secTable'); if (!box || S.mode !== 'HAWT') return;
  if (box.contains(document.activeElement)) return;
  const R = S.hawt.R;
  box.innerHTML = `<table class="sec"><thead><tr><th>r/R</th><th>弦長 m</th><th>扭轉 °</th><th>t/c</th></tr></thead><tbody>${G.rows.map((x, i) => {
    const ov = S.hawt.ov[i] || {};
    return `<tr><td>${(x.r / R).toFixed(3)}</td><td><input data-sec="${i}" data-f="c" value="${x.c.toFixed(4)}" class="${ov.c != null ? 'ov' : ''}"></td><td><input data-sec="${i}" data-f="tw" value="${x.tw.toFixed(2)}" class="${ov.tw != null ? 'ov' : ''}"></td><td>${(G.afs[i].t * 100).toFixed(1)}%</td></tr>`;
  }).join('')}</tbody></table>`;
  box.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
    const i = +inp.dataset.sec, f = inp.dataset.f, v = parseFloat(inp.value);
    if (!isFinite(v)) return;
    S.hawt.ov[i] = S.hawt.ov[i] || {}; S.hawt.ov[i][f] = f === 'c' ? Math.max(0.005, v) : v;
    scheduleRebuild(true);
  }));
}

/* ---------- summaries ---------- */
export function kv(el, pairs) { if (el) el.innerHTML = pairs.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join(''); }
export function updateSummaries() {
  const { rho, mu } = air();
  kv($('#airKv'), [['空氣密度 ρ', fmt(rho, 3) + ' kg/m³'], ['動黏度 μ', (mu * 1e5).toFixed(3) + '×10⁻⁵ Pa·s']]);
  const afKey = viewKey();
  if ($('#afSummary') && !(S.mode === 'VAWT' && S.vawt.type === 'sav')) {
    const af = getAf(afKey), m = getModel(afKey), ps = getPS(afKey), Re = PS_RES[S.af.reIdx];
    const b = A.bestLD(ps, Re, [-5, 16]);
    let clmax = -9, aClmax = 0; for (let d = -5; d <= 25; d += 0.25) { const c = A.lookup(ps, d * A.D2R, Re)[0]; if (c > clmax) { clmax = c; aClmax = d; } }
    kv($('#afSummary'), [['顯示翼型', afLabel(afKey)], ['最大厚度 t/c', fmt(af.t * 100, 1) + '%'], ['最大彎度', fmt(af.camber * 100, 2) + '%'],
      ['零升攻角(無黏)', fmt(m.aL0 * A.R2D, 2) + '°'], ['升力斜率(無黏)', fmt(m.slopeInv / (2 * Math.PI), 3) + ' × 2π'],
      [`最大升阻比 @Re ${fmtRe(Re)}`, fmt(b.ld, 1) + '(α ' + fmt(b.a, 2) + '°)'], ['CLmax', fmt(clmax, 2) + '(α ' + fmt(aClmax, 1) + '°)'],
      ['極曲線來源', ps.imported ? '匯入資料 + Viterna 外推' : '面板法 + 半經驗修正']]);
  }
  if ($('#rotorSummary') && G.perf) {
    const Vd = S.mode === 'HAWT' ? S.hawt.Vd : S.tun.V;
    const Pd = 0.5 * rho * G.A * Vd ** 3 * G.cpMax;
    const rows = [];
    if (S.mode === 'HAWT') {
      const sol = G.rows.reduce((s, x) => s + x.c * x.dr, 0) * S.hawt.B / (Math.PI * S.hawt.R ** 2);
      rows.push(['掃掠面積', fmt(G.A, 2) + ' m²'], ['實度', fmt(sol, 3)], ['單葉質量', fmt(G.bladeMass, 2) + ' kg'], ['轉動慣量 J', fmt(G.J, 3) + ' kg·m²']);
    } else {
      const v = S.vawt;
      if (v.type !== 'sav') rows.push(['實度 Bc/R', fmt(v.B * v.c / v.R, 3)], ['展弦比 H/c', fmt(v.H / v.c, 1)]);
      rows.push(['掃掠面積', fmt(G.A, 2) + ' m²'], ['轉子質量', fmt(G.mass, 2) + ' kg'], ['轉動慣量 J', fmt(G.J, 3) + ' kg·m²']);
    }
    if (S.mode === 'HAWT' && G.cpDesign != null) rows.push([`設計點 Cp(λd=${fmt(S.hawt.tsr, 1)})`, fmt(G.cpDesign, 3)]);
    rows.push(['Cp,max', fmt(G.cpMax, 3)], ['最佳尖速比 λopt', fmt(G.lopt, 2)], [`功率 @ ${fmt(Vd, 1)} m/s`, fmtP(Pd)], ['對應轉速', fmt(G.lopt * Vd / G.R * 30 / Math.PI, 0) + ' rpm']);
    kv($('#rotorSummary'), rows);
  }
}
export const PS_RES = [2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 3e6, 1e7];
export function fmtRe(r) { return r >= 1e6 ? (r / 1e6) + '×10⁶' : (r / 1e3) + 'k'; }

/* ---------- rebuild ---------- */
let rbTimer = null, rbGeo = false, pendingStart = false;
// Darrieus rotors have a dead band at low tip-speed ratio and usually need an assisted start (motoring)
export function assistStart() {
  const darrieus = S.mode === 'VAWT' && S.vawt.type !== 'sav';
  SIM.omega = G.lopt * S.tun.V / G.R * (darrieus ? 0.8 : 0.3);
  SIM.D = 0.5; SIM.Di = null; SIM.tEst = null; SIM.wcap = -1; SIM.pAvg = 0; SIM.po.wref = -1; SIM.latch = false; SIM.cutout = false;
}
export function scheduleRebuild(geo) { rbGeo = rbGeo || geo; clearTimeout(rbTimer); rbTimer = setTimeout(() => { const g = rbGeo; rbGeo = false; rebuild(g); }, 140); }
export function rebuild(geo) {
  if (geo) { if (S.mode === 'HAWT') designHAWT(); else designVAWT(); }
  computePerf();
  if (S.load.auto) autoMatchGen(); else { const { rho } = air(); const Vd = S.mode === 'HAWT' ? S.hawt.Vd : 8; G.Prated = 0.5 * rho * G.A * Vd ** 3 * G.cpMax; G.wRated = G.lopt * Vd / G.R; }
  if (geo) buildScene();
  if (pendingStart) { pendingStart = false; assistStart(); }
  updateSummaries(); renderSecTable(); updateBadge();
  if (S.step === 'load') { document.querySelectorAll('#pane [data-p^="load."]').forEach(el => { const v = getP(el.dataset.p), sc = +(el.dataset.s || 1); if (el.type === 'checkbox') el.checked = v; else if (el.tagName !== 'SELECT' && document.activeElement !== el) el.value = +(v * sc).toFixed(4); }); }
  redrawStatic(); afterDesignChange();
}
export function buildScene() {
  if (S.mode === 'HAWT') {
    const h = S.hawt, hubY = Math.max(1.35 * h.R, h.R + 0.6);
    const mesh = GEO.hawtBlade(G.rows, G.afs, G.Rhub, h.pitch);
    Scene3D.setScale(h.R, hubY, 'HAWT', 0);
    Scene3D.buildHAWT(mesh, Math.round(h.B), h.R, G.Rhub, hubY);
    G.hubY = hubY;
  } else {
    const v = S.vawt, y0 = Math.max(0.35, 0.3 * v.H);
    Scene3D.setScale(v.R, y0, 'VAWT', v.H);
    G.y0 = y0;
    if (v.type === 'sav') { Scene3D.buildSavonius({ R: v.R, H: v.H, B: Math.round(v.B), overlap: v.overlap, y0, endPlates: v.endPlates }); return; }
    const af = getAf(S.af.vawt), B = Math.round(v.B);
    const sf = f => {
      if (v.type === 'phi') return { r: v.R * Math.max(0.06, 1 - (2 * f - 1) ** 2), off: 0 };
      if (v.type === 'V') return { r: v.R * Math.max(0.05, f), off: 0 };
      if (v.type === 'helical') return { r: v.R, off: v.helix * A.D2R * f };
      return { r: v.R, off: 0 };
    };
    const meshes = [], struts = [];
    for (let b = 0; b < B; b++) {
      const ph = 2 * Math.PI * b / B;
      meshes.push(GEO.vawtBlade(sf, af, v.c, v.pitch, ph, v.H, y0));
      if (v.type === 'H' || v.type === 'helical') {
        const n = Math.round(v.struts);
        const fs = v.type === 'helical' ? (n ? [0.02, 0.98].slice(0, Math.max(1, Math.min(2, n))).concat(n > 2 ? [0.5] : []) : []) : [[], [0.5], [0.22, 0.78], [0.15, 0.5, 0.85]][n];
        for (const f of fs) struts.push({ ang: ph + sf(f).off, y: y0 + f * v.H, r: v.R, w: 0.6 * v.c });
      }
      if (v.type === 'phi') { struts.push({ ang: ph, y: y0 + 0.01 * v.H, r: 0.08 * v.R, w: 0.5 * v.c }); struts.push({ ang: ph, y: y0 + 0.99 * v.H, r: 0.08 * v.R, w: 0.5 * v.c }); }
      if (v.type === 'V') struts.push({ ang: ph, y: y0 + 0.02 * v.H, r: 0.08 * v.R, w: 0.5 * v.c });
    }
    const top = sf(1);
    Scene3D.buildVAWT(meshes, { H: v.H, R: v.R, y0, struts, markPos: [top.r * Math.cos(top.off), y0 + v.H, -top.r * Math.sin(top.off)] });
  }
}
export function updateBadge() {
  let t;
  if (S.mode === 'HAWT') t = `<b>水平軸 ${Math.round(S.hawt.B)} 葉</b>,R ${fmt(S.hawt.R, 2)} m,${stSorted().map(s => afLabel(s.k).replace('NACA ', '')).join(' → ')},${{ bem: 'BEM 扭角', opt: 'Schmitz 扭角', linear: '線性扭角' }[S.hawt.twMode]},λd ${fmt(S.hawt.tsr, 1)}`;
  else if (S.vawt.type === 'sav') t = `<b>${VAWT_TYPES.sav}</b>,${Math.round(S.vawt.B)} 葉,D ${fmt(2 * S.vawt.R, 2)} m,H ${fmt(S.vawt.H, 2)} m`;
  else t = `<b>${VAWT_TYPES[S.vawt.type]}</b>,${Math.round(S.vawt.B)} 葉,R ${fmt(S.vawt.R, 2)} m,H ${fmt(S.vawt.H, 2)} m,${afLabel(S.af.vawt)}`;
  $('#badge').innerHTML = t;
}

/* ---------- charts ---------- */
export const col = n => Plot.css(n);
export function chartOpts() {
  const o = $('#copts');
  if (S.ctab === 'airfoil') {
    const H = S.mode === 'HAWT';
    o.innerHTML = (H ? `<label>翼型 <select id="afView">${S.af.st.map((s, i) => `<option value="${i}" ${+S.af.view === i ? 'selected' : ''}>站${i + 1} ${afLabel(s.k).replace('NACA ', '')}</option>`).join('')}</select></label>` : '') +
      `<label>Re <select id="reSel">${PS_RES.map((r, i) => `<option value="${i}" ${i === S.af.reIdx ? 'selected' : ''}>${fmtRe(r)}</option>`).join('')}</select></label>` +
      `<label>Cp 攻角 <input id="alView" type="range" min="-10" max="20" step="0.5" value="${S.af.alphaView}" style="width:90px"> <span id="alTxt">${S.af.alphaView}°</span></label>` +
      `<label><input type="checkbox" id="fullR" ${S.af.full ? 'checked' : ''}> ±180°</label>`;
    const bind = (id, ev, fn) => { const e = o.querySelector('#' + id); if (e) e.addEventListener(ev, fn); };
    bind('afView', 'change', e => { S.af.view = +e.target.value; updateSummaries(); redrawStatic(); });
    bind('reSel', 'change', e => { S.af.reIdx = +e.target.value; updateSummaries(); redrawStatic(); });
    bind('alView', 'input', e => { S.af.alphaView = +e.target.value; o.querySelector('#alTxt').textContent = e.target.value + '°'; redrawStatic(); });
    bind('fullR', 'change', e => { S.af.full = e.target.checked; redrawStatic(); });
  } else if (S.ctab === 'perf') {
    o.innerHTML = `<label>年平均風速 <input id="vavg" type="number" min="2" max="12" step="0.1" value="${S.perf.Vavg}" style="width:60px"> m/s</label>` +
      `<label title="Weibull 形狀參數 k(2 = Rayleigh 分布,地形起伏越平緩、風速越穩定 k 越大)">Weibull k <input id="wbk" type="number" min="1.2" max="3.5" step="0.1" value="${S.perf.k}" style="width:50px"></label>`;
    o.querySelector('#vavg').addEventListener('change', e => { S.perf.Vavg = Math.max(1, +e.target.value || 5); redrawStatic(); });
    o.querySelector('#wbk').addEventListener('change', e => { S.perf.k = Math.min(3.5, Math.max(1.2, +e.target.value || 2)); redrawStatic(); });
  } else if (S.ctab === 'cmp') {
    const opts = [['tw', '扭角分布'], ['a', '設計點攻角'], ['c', '弦長分布'], ['tc', '厚度分布'], ['pc', '功率曲線']];
    o.innerHTML = `<label>中間圖 <select id="cmpView">${opts.map(([v, t]) => `<option value="${v}" ${(S.cmpView || 'tw') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` +
      `<label>年平均風速 <input id="vavg2" type="number" min="2" max="12" step="0.1" value="${S.perf.Vavg}" style="width:60px"> m/s</label>` +
      `<label title="Weibull 形狀參數 k(2 = Rayleigh 分布)">Weibull k <input id="wbk2" type="number" min="1.2" max="3.5" step="0.1" value="${S.perf.k}" style="width:50px"></label>` +
      `<button class="iconbtn" id="snapSave2">＋ 儲存目前方案</button>`;
    o.querySelector('#cmpView').addEventListener('change', e => { S.cmpView = e.target.value; redrawStatic(); });
    o.querySelector('#vavg2').addEventListener('change', e => { S.perf.Vavg = Math.max(1, +e.target.value || 5); redrawStatic(); });
    o.querySelector('#wbk2').addEventListener('change', e => { S.perf.k = Math.min(3.5, Math.max(1.2, +e.target.value || 2)); redrawStatic(); });
    o.querySelector('#snapSave2').addEventListener('click', saveSnap);
  } else if (S.ctab === 'live') {
    o.innerHTML = `<button class="iconbtn" id="clrHist">清除紀錄</button>`;
    o.querySelector('#clrHist').addEventListener('click', () => { for (const k in SIM.hist) SIM.hist[k].length = 0; SIM.traj.length = 0; });
  } else o.innerHTML = '';
}
export const cv = [null, null, null];

/* ---------- design comparison (snapshots) ---------- */
export const SNAP_COL = ['--c1', '--c2', '--c3', '--c4', '--c5', '--warn', '--good', '--signal'];
export const SNAPS = [];
try { const t = localStorage.getItem('wt-snaps-v1'); if (t) SNAPS.push(...(JSON.parse(t) || [])); } catch (e) { SNAPS.length = 0; }
export function storeSnaps() { try { localStorage.setItem('wt-snaps-v1', JSON.stringify(SNAPS)); } catch (e) {} }
export const r4 = a => Array.from(a, v => +(+v).toFixed(4));
export function twLabel() { return { bem: 'BEM 扭角', opt: 'Schmitz 扭角', linear: `線性扭角 ${fmt(S.hawt.twRoot, 1)}→${fmt(S.hawt.twTip, 1)}°` }[S.hawt.twMode]; }
export function designName() {
  if (S.mode === 'HAWT') return `${stSorted().map(s => afLabel(s.k).replace('NACA ', '')).join('→')} · ${twLabel()}`;
  return `${VAWT_TYPES[S.vawt.type]}${S.vawt.type === 'sav' ? '' : ' · ' + afLabel(S.af.vawt).replace('NACA ', '')}`;
}
export function designSub() {
  if (S.mode === 'HAWT') { const h = S.hawt; return `水平軸 ${Math.round(h.B)} 葉 R ${fmt(h.R, 2)} m λd ${fmt(h.tsr, 1)}`; }
  const v = S.vawt; return `垂直軸 ${Math.round(v.B)} 葉 · R ${fmt(v.R, 2)} m · H ${fmt(v.H, 2)} m`;
}
export function curMetrics() {
  const P = G.perf, cm = G.cpMax; let lo = null, hi = null;
  for (let i = 0; i < P.lam.length; i++) if (P.cp[i] >= 0.9 * cm) { if (lo == null) lo = P.lam[i]; hi = P.lam[i]; }
  const H = S.mode === 'HAWT', R = G.R;
  const m = { mode: S.mode, A: G.A, R, cpMax: cm, lopt: G.lopt, band: [lo, hi], mass: H ? G.bladeMass : G.mass, cpDes: H ? G.cpDesign : null, lamD: H ? S.hawt.tsr : null,
    lam: r4(P.lam), cp: r4(P.cp.map(v => Math.max(-0.2, v))), sub: designSub() };
  if (H) Object.assign(m, { rr: r4(G.rows.map(x => x.r / R)), cR: r4(G.rows.map(x => x.c / R)), tw: r4(G.rows.map(x => x.tw)), aAct: r4(G.rows.map(x => x.aAct)), aD: r4(G.rows.map(x => x.aD)), tc: r4(G.afs.map(a => a.t)) });
  return m;
}
export function saveSnap() {
  if (!G.perf) return;
  if (SNAPS.length >= 8) { toast('最多保存 8 個方案,請先刪除一些'); return; }
  const used = new Set([...S.af.st.map(s => s.k), S.af.vawt]);
  const imp = {}, pimp = {};
  used.forEach(k => { if (k.startsWith('imp:') && S.af.imported[+k.slice(4)]) imp[k] = S.af.imported[+k.slice(4)].af; if (S.af.polarImp[k]) pimp[k] = S.af.polarImp[k]; });
  const usedCols = new Set(SNAPS.map(s => s.ci));
  let ci = 0; while (usedCols.has(ci) && ci < SNAP_COL.length - 1) ci++;
  SNAPS.push({ id: Date.now(), ci, vis: true, name: `方案 ${String.fromCharCode(65 + SNAPS.length)}:${designName()}`, ...curMetrics(),
    cfg: { hawt: JSON.parse(JSON.stringify(S.hawt)), vawt: JSON.parse(JSON.stringify(S.vawt)), st: S.af.st.map(s => ({ ...s })), vaf: S.af.vawt, cdMax: S.af.cdMax }, imp, pimp });
  storeSnaps(); toast('已儲存為比較方案'); if (S.ctab === 'cmp') redrawStatic();
}
export function loadSnap(sn) {
  const remap = {};
  for (const [k, af] of Object.entries(sn.imp || {})) {
    let j = S.af.imported.findIndex(x => x.af.name === af.name && Math.abs(x.af.t - af.t) < 1e-6);
    if (j < 0) { S.af.imported.push({ af }); j = S.af.imported.length - 1; }
    remap[k] = 'imp:' + j; afCache.delete(remap[k]);
  }
  const mk = k => remap[k] || k;
  const c = JSON.parse(JSON.stringify(sn.cfg));
  S.hawt = Object.assign(S.hawt, c.hawt); S.vawt = Object.assign(S.vawt, c.vawt);
  S.af.st = c.st.map(s => ({ f: s.f, k: mk(s.k) })); S.af.vawt = mk(c.vaf); S.af.cdMax = c.cdMax;
  for (const [k, t] of Object.entries(sn.pimp || {})) S.af.polarImp[mk(k)] = t;
  S.af.view = sn.mode === 'HAWT' ? S.af.st.length - 1 : 'vawt';
  if (S.mode !== sn.mode) setMode(sn.mode); else { renderPane(); pendingStart = true; rebuild(true); chartOpts(); }
  toast('已載入「' + sn.name + '」');
}
export function snapAEP(m) { // ideal MPPT (Cp,max tracking, no rated-power cap), Weibull(Vavg, k) wind distribution
  const { rho } = air(), Va = S.perf.Vavg, k = S.perf.k || 2, eta = 0.92 * S.load.eta; let e = 0;
  for (let v = 0.5; v <= 25.001; v += 0.5) { const f = weibullPdf(v, Va, k); e += 0.5 * rho * m.A * v ** 3 * m.cpMax * eta * f * 0.5 * 8760 / 1000; }
  return e;
}
export function setCmpLayout(on) {
  const cb = $('#cbody'), box = $('#cmpBox');
  cb.classList.toggle('cmp', on); cb.classList.toggle('g3', !on);
  cv[2].style.display = on ? 'none' : ''; box.classList.toggle('hidden', !on);
}
export function drawCompare() {
  const cur = { ...curMetrics(), name: '目前設計' };
  const vis = SNAPS.filter(s => s.vis);
  const ser = vis.map(s => ({ s, color: col(SNAP_COL[s.ci]) }));
  const short = n => n.length > 14 ? n.slice(0, 13) + '…' : n;
  const lmax = Math.max(cur.lam[cur.lam.length - 1], ...vis.map(s => s.lam[s.lam.length - 1]));
  Plot.draw(cv[0], {
    title: '功率係數 Cp–λ 比較', xlim: [0, lmax], ylim: [0, 0.62], xlabel: '尖速比 λ', ylabel: 'Cp',
    series: [...ser.map(({ s, color }) => ({ x: s.lam, y: s.cp, color, label: short(s.name.split(':')[0]) })), { x: cur.lam, y: cur.cp, color: col('--ink'), dash: [5, 3], width: 1.4, label: '目前' }],
    markers: [...ser.map(({ s, color }) => ({ x: s.lopt, y: s.cpMax, color, r: 4 })), { x: cur.lopt, y: cur.cpMax, color: col('--ink'), r: 4 }]
  });
  const v = S.cmpView || 'tw';
  const all = [...ser, { s: cur, color: col('--ink'), dash: [5, 3], cur: true }];
  if (v === 'pc') {
    const { rho } = air(), eta = 0.92 * S.load.eta, Vs = Array.from({ length: 41 }, (_, k) => k * 0.5);
    Plot.draw(cv[1], { title: '理想 MPPT 電功率曲線(未限額定)', xlim: [0, 20], xlabel: '風速 (m/s)', ylabel: '功率 (W)',
      series: all.map(({ s, color, dash, cur: c }) => ({ x: Vs, y: Vs.map(V => 0.5 * rho * s.A * V ** 3 * s.cpMax * eta), color, dash, label: c ? '目前' : short(s.name.split(':')[0]) })) });
  } else {
    const hs = all.filter(o => o.s.mode === 'HAWT' && o.s.rr);
    const f = { tw: ['扭角分布 θ(r)', 'tw', 'θ (°)'], c: ['弦長分布 c/R', 'cR', 'c/R'], a: ['設計點實際攻角 α(r)(虛線:目標)', 'aAct', 'α (°)'], tc: ['相對厚度分布 t/c', 'tc', 't/c'] }[v];
    const series = hs.map(({ s, color, dash, cur: c }) => ({ x: s.rr, y: s[f[1]], color, dash, dots: 2, label: c ? '目前' : short(s.name.split(':')[0]) }));
    if (v === 'a') hs.forEach(({ s, color }) => series.push({ x: s.rr, y: s.aD, color, dash: [2, 3], width: 1 }));
    Plot.draw(cv[1], hs.length ? { title: f[0], series, xlim: [0, 1], xlabel: 'r/R', ylabel: f[2] } : { title: '分布圖僅適用水平軸方案,可改看功率曲線', series: [], xlim: [0, 1], ylim: [0, 1] });
  }
  // table
  const rows = [{ ...cur, cur: true }, ...SNAPS];
  const best = k => Math.max(...rows.map(r => r[k] || 0));
  const aeps = rows.map(r => snapAEP(r)), bestAep = Math.max(...aeps);
  const cfs = aeps.map(e => capacityFactor(e, S.load.Pmax)), bestCf = Math.max(...cfs);
  const bw = r => r.band && r.band[0] != null ? r.band[1] - r.band[0] : 0, bestBw = Math.max(...rows.map(bw));
  const cls = (val, b) => Math.abs(val - b) < 1e-9 && rows.length > 1 ? 'best' : '';
  let h = `<table><colgroup><col style="width:38%"><col style="width:12%"><col style="width:10%"><col style="width:15%"><col style="width:12%"><col style="width:13%"></colgroup><thead><tr><th>方案</th><th>C<sub>p,max</sub></th><th>λ<sub>opt</sub></th><th title="Cp ≥ 90% Cp,max 的尖速比範圍,越寬越不怕風速變化">高效區λ</th><th title="理想 MPPT、未限額定,Weibull(年均 ${fmt(S.perf.Vavg, 1)} m/s,k=${fmt(S.perf.k, 1)})">AEP<br><small>kWh/年</small></th><th title="AEP ÷(發電機額定 ${fmtP(S.load.Pmax)} × 8760 小時)">容量<br><small>因數</small></th></tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const sw = r.cur ? `<span class="sw" style="background:transparent;border:1.5px dashed ${col('--ink')}"></span>` : `<input type="checkbox" data-vis="${r.id}" ${r.vis ? 'checked' : ''} aria-label="顯示"><span class="sw" style="background:${col(SNAP_COL[r.ci])}"></span>`;
    const sub = `${r.sub}${r.cpDes != null ? ` · Cp(λd) ${fmt(r.cpDes, 3)}` : ''} · ${fmt(r.mass, 2)} kg${r.mode === 'HAWT' ? '/葉' : ''}`;
    h += `<tr class="${r.cur ? 'cur' : ''}"><td class="nm"><div class="nmh">${sw}${r.cur ? `<b>目前設計</b>` : `<input data-name="${r.id}" value="${r.name.replace(/"/g, '&quot;')}" title="${r.name.replace(/"/g, '&quot;')}" aria-label="方案名稱">`}</div>${r.cur ? `<div class="sub">${designName()}</div>` : ''}<div class="sub">${sub}</div><div class="acts">${r.cur ? '<button class="btn" id="snapSave">儲存為方案</button>' : `<button class="btn ghost" data-load="${r.id}" title="載入此方案">載入</button><button class="btn ghost" data-del="${r.id}" aria-label="刪除" title="刪除">刪除</button>`}</div></td>
      <td class="${cls(r.cpMax, best('cpMax'))}">${fmt(r.cpMax, 3)}</td><td>${fmt(r.lopt, 2)}</td><td class="${cls(bw(r), bestBw)}">${r.band && r.band[0] != null ? fmt(r.band[0], 1) + '–' + fmt(r.band[1], 1) : '–'}</td>
      <td class="${cls(aeps[i], bestAep)}">${fmt(aeps[i], 0)}</td>
      <td class="${cls(cfs[i], bestCf)}">${fmt(cfs[i] * 100, 0)}%</td>
      </tr>`;
  });
  h += `</tbody></table>`;
  if (!SNAPS.length) h += `<div class="empty">按「儲存」把目前設計存成方案 A,接著改翼型分布、扭角方式或尖速比,再存成方案 B,就能疊圖比較。方案會保存在這個瀏覽器中。</div>`;
  const box = $('#cmpBox');
  if (box.contains(document.activeElement) && document.activeElement.dataset.name) return;
  box.innerHTML = h;
  box.querySelector('#snapSave').addEventListener('click', saveSnap);
  box.querySelectorAll('[data-vis]').forEach(e => e.addEventListener('change', () => { const s = SNAPS.find(x => x.id == e.dataset.vis); s.vis = e.checked; storeSnaps(); redrawStatic(); }));
  box.querySelectorAll('[data-name]').forEach(e => e.addEventListener('change', () => { const s = SNAPS.find(x => x.id == e.dataset.name); s.name = e.value.trim() || s.name; storeSnaps(); redrawStatic(); }));
  box.querySelectorAll('[data-load]').forEach(e => e.addEventListener('click', () => loadSnap(SNAPS.find(x => x.id == e.dataset.load))));
  box.querySelectorAll('[data-del]').forEach(e => e.addEventListener('click', () => { SNAPS.splice(0, SNAPS.length, ...SNAPS.filter(x => x.id != e.dataset.del)); storeSnaps(); redrawStatic(); }));
}
export function redrawStatic() {
  if (!G.perf) return;
  if (S.ctab === 'airfoil') drawAirfoil();
  else if (S.ctab === 'blade') drawBlade();
  else if (S.ctab === 'perf') drawPerf();
  else if (S.ctab === 'cmp') drawCompare();
  else drawLive();
}
export function drawAirfoil() {
  if (S.mode === 'VAWT' && S.vawt.type === 'sav') {
    const P = G.perf;
    Plot.draw(cv[0], { title: 'Savonius 為阻力型轉子,沒有翼型極曲線', series: [{ x: P.lam, y: P.cp, color: col('--c1'), label: 'Cp' }, { x: P.lam, y: P.cq, color: col('--c2'), axis: 'R', label: 'Cq' }], xlabel: '尖速比 λ', ylabel: 'Cp', ylabelR: 'Cq' });
    Plot.draw(cv[1], { title: '改到「性能曲線」與「葉片分析」看轉矩特性', series: [], xlim: [0, 1], ylim: [0, 1] });
    Plot.draw(cv[2], { series: [], xlim: [0, 1], ylim: [0, 1] });
    return;
  }
  const key = viewKey();
  const af = getAf(key), m = getModel(key), ps = getPS(key), Re = PS_RES[S.af.reIdx];
  const al = S.af.alphaView * A.D2R, sol = m.solve(al);
  const nL = A.NX - 1;
  const xl = sol.xm.slice(0, nL), cpl = sol.cp.slice(0, nL), xu = sol.xm.slice(nL), cpu = sol.cp.slice(nL);
  const outline = { x: [...af.x, ...af.x.slice().reverse()], y: [...af.yu, ...af.yl.slice().reverse()] };
  Plot.draw(cv[0], {
    title: `${afLabel(key)}  壓力分布(無黏,α=${S.af.alphaView}°,Cl=${fmt(sol.cl, 3)})`,
    series: [
      { x: outline.x, y: outline.y, color: col('--ink'), width: 1.4, fill: col('--grid'), closed: true },
      { x: [0, 1], y: [0, 0], color: col('--muted'), dash: [3, 3], width: 1 },
      { x: xu, y: cpu.map(v => -v), color: col('--c1'), axis: 'R', label: '上表面 −Cp' },
      { x: xl, y: cpl.map(v => -v), color: col('--c2'), axis: 'R', label: '下表面 −Cp' }],
    xlim: [-0.05, 1.05], ylim: [-0.35, 0.35], equal: true, xlabel: 'x/c', ylabelR: '−Cp', noYTicks: true
  });
  const lo = S.af.full ? -180 : -20, hi = S.af.full ? 180 : 30, st = S.af.full ? 1 : 0.25;
  const xs = [], cl = [], cd = [], ld = [];
  for (let d = lo; d <= hi + 1e-9; d += st) { const [a, b] = A.lookup(ps, d * A.D2R, Re); xs.push(d); cl.push(a); cd.push(b); ld.push(a / b); }
  const best = A.bestLD(ps, Re, [-5, 16]);
  const extra = ps.imported ? [{ x: ps.rows.map(r => r[0]), y: ps.rows.map(r => r[1]), color: col('--c3'), width: 0, dots: 2.2, label: '匯入資料點' }] : [];
  const ref = PS_RES.filter((r, i) => i !== S.af.reIdx && (i === 1 || i === 5)).map((r, k) => {
    const y = xs.map(d => A.lookup(ps, d * A.D2R, r)[0]); return { x: xs, y, color: col('--muted'), width: 1, dash: [3, 3], alpha: 0.7 };
  });
  Plot.draw(cv[1], {
    title: `升力與阻力係數(Re ${fmtRe(Re)};虛線為其他 Re 的 Cl)`,
    series: [...(ps.imported ? [] : ref), { x: xs, y: cl, color: col('--c1'), label: 'Cl' }, { x: xs, y: cd, color: col('--c2'), axis: 'R', label: 'Cd' }, ...extra],
    xlabel: '攻角 α (°)', ylabel: 'Cl', ylabelR: 'Cd', vlines: [{ x: S.af.alphaView, color: col('--signal') }]
  });
  const ldx = xs.filter(d => d >= -10 && d <= 25), ldy = ldx.map(d => { const [a, b] = A.lookup(ps, d * A.D2R, Re); return a / b; });
  Plot.draw(cv[2], {
    title: `升阻比 Cl/Cd,最佳 ${fmt(best.ld, 1)} @ α=${fmt(best.a, 2)}°`,
    series: [{ x: ldx, y: ldy, color: col('--c3'), label: 'Cl/Cd' }], markers: [{ x: best.a, y: best.ld, color: col('--signal'), label: 'α 設計點' }],
    xlabel: '攻角 α (°)', ylabel: 'Cl/Cd'
  });
}
let opElems = null, opT = 0;
export function drawBlade() {
  if (S.mode === 'HAWT') {
    const R = S.hawt.R, x = G.rows.map(r => r.r / R);
    Plot.draw(cv[0], {
      title: `弦長與扭轉分布(虛線:翼型站 ${stSorted().map(s => afLabel(s.k).replace('NACA ', '')).join('/')})`,
      series: [{ x, y: G.rows.map(r => r.c / R), color: col('--c1'), label: '弦長 c/R', dots: 2.5 }, { x, y: G.rows.map(r => r.tw + S.hawt.pitch), color: col('--c2'), axis: 'R', label: '扭轉+槳距 θ (°)', dots: 2.5 }],
      markers: G.rows.map((r, i) => r.ovr ? { x: x[i], y: r.c / R, color: col('--signal'), r: 4 } : null).filter(Boolean),
      xlim: [0, 1], xlabel: 'r/R', ylabel: 'c/R', ylabelR: 'θ (°)', vlines: stSorted().map(s => ({ x: s.f, color: col('--muted') }))
    });
    if (!opElems) { Plot.draw(cv[1], { title: '等待運轉資料…', series: [], xlim: [0, 1], ylim: [0, 1] }); Plot.draw(cv[2], { series: [], xlim: [0, 1], ylim: [0, 1] }); return; }
    const ex = opElems.map(e => e.r / R);
    const ps0 = G.pss[G.pss.length - 1];
    Plot.draw(cv[1], {
      title: `目前運轉點:局部攻角與升力係數(λ=${fmt(SIM.out.lam, 2)})`,
      series: [{ x: ex, y: opElems.map(e => e.alpha), color: col('--c1'), label: '攻角 α (°)' }, { x: ex, y: G.rows.map(r => r.aD), color: col('--muted'), dash: [4, 3], label: '設計 α' },
        { x: ex, y: opElems.map(e => e.cl), color: col('--c3'), axis: 'R', label: 'Cl' }],
      xlim: [0, 1], xlabel: 'r/R', ylabel: 'α (°)', ylabelR: 'Cl'
    });
    Plot.draw(cv[2], {
      title: '軸向/切向誘導因子與葉尖損失',
      series: [{ x: ex, y: opElems.map(e => e.a), color: col('--c1'), label: 'a' }, { x: ex, y: opElems.map(e => e.ap), color: col('--c2'), label: "a'" },
        { x: ex, y: opElems.map(e => e.F), color: col('--c4'), label: 'F', dash: [4, 3] }, { x: [0, 1], y: [1 / 3, 1 / 3], color: col('--muted'), dash: [2, 3], width: 1 }],
      xlim: [0, 1], ylim: [-0.05, 1.05], xlabel: 'r/R', ylabel: '誘導因子'
    });
    return;
  }
  const P = G.perf, N2 = 2 * A.NTH, az = Array.from({ length: N2 }, (_, j) => (j + 0.5) * 360 / N2);
  const lam = Math.max(0, SIM.out.lam || G.lopt);
  const i = Math.min(P.lam.length - 1, Math.round(lam / P.step));
  if (S.vawt.type === 'sav') {
    Plot.draw(cv[0], { title: 'Savonius Cp 與轉矩係數', series: [{ x: P.lam, y: P.cp, color: col('--c1'), label: 'Cp' }, { x: P.lam, y: P.cq, color: col('--c2'), axis: 'R', label: 'Cq' }], markers: [{ x: lam, y: interpCurve(P, 'cp', lam), color: col('--signal') }], xlabel: '尖速比 λ', ylabel: 'Cp', ylabelR: 'Cq' });
  } else {
    const as = getPS(S.af.vawt).tables[5] ? getPS(S.af.vawt).tables[5].asPos * A.R2D : 14;
    Plot.draw(cv[0], {
      title: `中段截面攻角 vs 方位角(λ=${fmt(P.lam[i], 2)})`,
      series: [{ x: az, y: Array.from(P.alAz[i]), color: col('--c1'), label: '攻角 α' }, { x: [0, 360], y: [as, as], color: col('--warn'), dash: [4, 3], width: 1, label: '失速角' }, { x: [0, 360], y: [-as, -as], color: col('--warn'), dash: [4, 3], width: 1 }],
      bands: [{ x0: 90, x1: 270, color: col('--muted'), alpha: 0.08 }], xlim: [0, 360], xlabel: '方位角 θ (°)  灰區:下風半圈', ylabel: 'α (°)'
    });
  }
  const { rho } = air(), q = 0.5 * rho * G.A * G.R * S.tun.V ** 2;
  const tot = P.cqAz[i].map(v => v * q);
  const one = P.qAz[i] ? Array.from(P.qAz[i]).map(v => v * (S.tun.V / G.Vref) ** 2) : null;
  const ser = [{ x: az, y: tot, color: col('--c1'), label: '轉子總轉矩' }];
  if (one) ser.push({ x: az, y: one, color: col('--c2'), label: '單一葉片', dash: [4, 3] });
  const mean = tot.reduce((a, b) => a + b, 0) / tot.length;
  Plot.draw(cv[1], { title: `轉矩漣波(平均 ${fmt(mean, 2)} N·m,漣波 ±${fmt((Math.max(...tot) - Math.min(...tot)) / 2 / Math.max(1e-6, Math.abs(mean)) * 100, 0)}%)`, series: ser, xlim: [0, 360], xlabel: '轉子方位角 (°)', ylabel: '轉矩 (N·m)' });
  const st = P.cqAz[0].map(v => v * q);
  Plot.draw(cv[2], { title: `靜止啟動轉矩(${fmt(S.tun.V, 1)} m/s)${Math.min(...st) <= 0 ? ',部分方位角無法自啟動' : ''}`, series: [{ x: az, y: st, color: col('--c3'), label: '靜止轉矩' }], xlim: [0, 360], xlabel: '轉子方位角 (°)', ylabel: '轉矩 (N·m)' });
}
export function drawPerf() {
  const P = G.perf, { rho } = air(), V = S.tun.V;
  const o = SIM.out;
  Plot.draw(cv[0], {
    title: `功率係數 Cp–λ(Cp,max ${fmt(G.cpMax, 3)} @ λ ${fmt(G.lopt, 2)})`,
    series: [{ x: P.lam, y: P.cp, color: col('--c1'), label: 'Cp' }, { x: P.lam, y: P.ct, color: col('--c2'), axis: 'R', label: 'Ct', dash: [5, 3] }, { x: [0, P.lam[P.lam.length - 1]], y: [16 / 27, 16 / 27], color: col('--muted'), dash: [2, 3], width: 1, label: 'Betz 極限' }],
    ylim: [Math.min(0, ...P.cp.map(v => Math.max(v, -0.2))), 0.65], xlabel: '尖速比 λ', ylabel: 'Cp', ylabelR: 'Ct',
    markers: o.lam != null ? [{ x: o.lam, y: o.Cp, color: col('--signal'), label: '運轉點' }] : [], vlines: [{ x: G.lopt, color: col('--muted') }]
  });
  const fam = [0.6, 0.8, 1, 1.2, 1.4].map(f => f * Math.max(1, V));
  const wmax = P.lam[P.lam.length - 1] * fam[fam.length - 1] / G.R;
  const rpm = Array.from({ length: 120 }, (_, k) => wmax * k / 119 * 30 / Math.PI);
  const pal = ['--c5', '--c3', '--c1', '--c4', '--c2'];
  const series = fam.map((Vk, n) => ({ x: rpm, y: rpm.map(r => { const l = r * Math.PI / 30 * G.R / Vk; return 0.5 * rho * G.A * Vk ** 3 * Math.max(-0.1, interpCurve(P, 'cp', l)); }), color: col(pal[n]), label: fmt(Vk, 1) + ' m/s', width: n === 2 ? 2.2 : 1.3 }));
  const optW = rpm.map(r => G.kopt * (r * Math.PI / 30) ** 3);
  series.push({ x: rpm, y: optW, color: col('--ink'), dash: [5, 4], width: 1.2, label: '最佳功率軌跡' });
  const pmax = 0.5 * rho * G.A * fam[fam.length - 1] ** 3 * G.cpMax * 1.1;
  const traj = SIM.traj;
  series.push({ x: traj.map(t => t[0]), y: traj.map(t => t[1]), color: col('--signal'), width: 0, dots: 1.6, alpha: 0.6 });
  Plot.draw(cv[1], {
    title: '氣動功率–轉速(黃點為運轉軌跡)', series, ylim: [0, pmax], xlim: [0, rpm[rpm.length - 1]], xlabel: '轉速 (rpm)', ylabel: '功率 (W)',
    markers: o.rpm != null ? [{ x: o.rpm, y: o.Pa, color: col('--signal'), label: fmtP(o.Pa) }] : [], vlines: [{ x: S.load.wmaxRpm, color: col('--warn'), label: '轉速上限' }]
  });
  // power curve
  const Vs = [], Pm = [], Pf = [], wb = [];
  const Va = S.perf.Vavg, kW = S.perf.k || 2;
  let aepM = 0, aepF = 0;
  const etaG = 0.92 * S.load.eta;
  for (let v = 0.5; v <= 25.001; v += 0.5) {
    Vs.push(v);
    const pm = Math.min(S.load.Pmax, 0.5 * rho * G.A * v ** 3 * G.cpMax * etaG);
    const wopt = G.lopt * v / G.R;
    const lim = S.load.ospd && wopt > S.load.wmaxRpm * Math.PI / 30;
    Pm.push(lim ? NaN : pm);
    const st = steadyPower(v);
    Pf.push(S.load.ospd && (st.w > S.load.wmaxRpm * Math.PI / 30 || st.Pout > 1.25 * S.load.Pmax) ? NaN : st.Pout);
    const f = weibullPdf(v, Va, kW);
    wb.push(f);
    aepM += (isFinite(Pm[Pm.length - 1]) ? Pm[Pm.length - 1] : 0) * f * 0.5 * 8760 / 1000;
    aepF += (isFinite(Pf[Pf.length - 1]) ? Pf[Pf.length - 1] : 0) * f * 0.5 * 8760 / 1000;
  }
  const cfM = capacityFactor(aepM, S.load.Pmax), cfF = capacityFactor(aepF, S.load.Pmax);
  Plot.draw(cv[2], {
    title: `年發電量 MPPT ${fmt(aepM, 0)} kWh(容量因數 ${fmt(cfM * 100, 0)}%)· 固定D ${fmt(aepF, 0)} kWh(${fmt(cfF * 100, 0)}%)`,
    series: [{ x: Vs, y: wb, color: col('--muted'), axis: 'R', width: 1, fill: col('--grid'), label: '風速機率' },
      { x: Vs, y: Pm, color: col('--c1'), label: 'MPPT 理想(限額定)' }, { x: Vs, y: Pf, color: col('--c2'), dash: [5, 3], label: `固定 D=${fmt(S.load.D * 100, 0)}%` }],
    xlabel: '風速 (m/s)', ylabel: '電功率 (W)', ylabelR: '機率密度', xlim: [0, 25], ylim: [0, 1.15 * Math.max(10, ...Pm.filter(isFinite), ...Pf.filter(isFinite))], ylimR: [0, 1.15 * Math.max(...wb)],
    markers: o.V != null ? [{ x: S.tun.V, y: o.el ? o.el.Pout : 0, color: col('--signal') }] : []
  });
}
export function drawLive() {
  const h = SIM.hist;
  const t = h.t.map(x => x - (h.t.length ? h.t[h.t.length - 1] : 0));
  Plot.draw(cv[0], { title: '風速與轉速', series: [{ x: t, y: h.V, color: col('--c1'), label: '風速 m/s' }, { x: t, y: h.rpm, color: col('--c2'), axis: 'R', label: '轉速 rpm' }], xlim: [-60, 0], xlabel: '時間 (s)', ylabel: 'm/s', ylabelR: 'rpm' });
  Plot.draw(cv[1], { title: '氣動功率與輸出電功率', series: [{ x: t, y: h.Pa, color: col('--c1'), label: '氣動' }, { x: t, y: h.Po, color: col('--c3'), label: '輸出' }], xlim: [-60, 0], xlabel: '時間 (s)', ylabel: 'W' });
  Plot.draw(cv[2], { title: '尖速比、Cp 與占空比', series: [{ x: t, y: h.lam, color: col('--c4'), label: 'λ' }, { x: t, y: h.cp, color: col('--c1'), axis: 'R', label: 'Cp' }, { x: t, y: h.D, color: col('--c5'), axis: 'R', label: 'D', dash: [4, 3] }], xlim: [-60, 0], ylimR: [0, 1], xlabel: '時間 (s)', ylabel: 'λ', ylabelR: 'Cp, D' });
}

/* ---------- HUD ---------- */
export function hud() {
  const o = SIM.out; if (!o.el) return;
  const gauges = [['風速', fmt(o.V, 1), 'm/s'], S.mode === 'HAWT' ? ['偏航誤差', fmt(o.gam, 0), '°'] : ['風向', fmt(S.tun.dir, 0), '°'],
    ['轉速', fmt(o.rpm, 0), 'rpm'], ['尖速比 λ', fmt(o.lam, 2), ''], ['Cp', fmt(o.Cp, 3), ''], ['氣動功率', fmtP(o.Pa), ''], ['輸出電力', fmtP(o.el.Pout), ''],
    ['轉矩', fmt(o.Ta, o.Ta < 10 ? 2 : 1), 'N·m'], ['占空比 D', fmt(SIM.D * 100, 1), '%']];
  const el = $('#hud');
  if (!el.children.length) el.innerHTML = gauges.map((g, i) => `<div class="gauge${i === 6 ? ' live' : ''}"><i>${g[0]}</i><b></b></div>`).join('');
  gauges.forEach((g, i) => { el.children[i].querySelector('b').innerHTML = g[1] + (g[2] ? `<small>${g[2]}</small>` : ''); });
  el.children[2].querySelector('b').classList.toggle('alarm', o.brake);
  { const pn = $("#pitchNow"); if (pn) pn.textContent = fmt(SIM.pitch || 0, 1) + "°"; }
  const ek = $('#elecKv');
  if (ek) kv(ek, [['反電勢 E', fmt(o.el.E, 1) + ' V'], ['轉換器輸入電壓', fmt(o.el.Vin, 1) + ' V'], ['電流 I', fmt(o.el.I, 2) + ' A'], ['等效負載 Rin', isFinite(o.el.Rin) ? fmt(o.el.Rin, 2) + ' Ω' : '開路'],
    ['發電機損失', fmtP(o.el.Ploss)], ['系統效率', o.Pa > 1 ? fmt(o.el.Pout / o.Pa * 100, 1) + '%' : '–'], ['狀態', o.brake ? (SIM.latch ? '超速保護煞車中' : SIM.cutout ? '切出風速停機中' : '手動煞車') : SIM.omega < 0.01 ? '靜止' : '發電中']]);
}

/* ---------- export ---------- */
let downloads = null;
(function getDl(n) { if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {}); else if (n < 40) setTimeout(() => getDl(n + 1), 250); })(0);
export function csvGeometry() {
  if (S.mode === 'HAWT') return 'r_m,r_over_R,chord_m,twist_deg,pitch_deg,t_over_c,airfoil_station_index\n' + G.rows.map((x, i) => [x.r.toFixed(5), (x.r / S.hawt.R).toFixed(5), x.c.toFixed(5), x.tw.toFixed(3), S.hawt.pitch, G.afs[i].t.toFixed(4), x.w.toFixed(3)].join(',')).join('\n');
  const v = S.vawt;
  if (v.type === 'sav') return 'type,B,R_m,H_m,overlap\nSavonius,' + [v.B, v.R, v.H, v.overlap].join(',');
  return 'z_m,r_m,inclination_deg,helix_offset_deg,chord_m,pitch_deg\n' + A.vawtSlices(G.vcfg).map(s => [s.z.toFixed(4), s.r.toFixed(4), (s.delta * A.R2D).toFixed(2), (s.helixOff * A.R2D).toFixed(2), v.c, v.pitch].join(',')).join('\n');
}
export function csvPolar() {
  const key = viewKey(), ps = getPS(key);
  let s = `# ${afLabel(key)} polar (alpha_deg, then Cl/Cd per Re)\nalpha_deg,` + ps.REs.map(r => `Cl_Re${r},Cd_Re${r}`).join(',') + '\n';
  for (let d = -180; d <= 180; d += 1) s += d + ',' + ps.REs.map(r => { const [a, b] = A.lookup(ps, d * A.D2R, r); return a.toFixed(4) + ',' + b.toFixed(5); }).join(',') + '\n';
  return s;
}
export function csvPerf() { const P = G.perf; return `# V_ref=${G.Vref} m/s\nlambda,Cp,Ct,Cq\n` + P.lam.map((l, i) => [l, P.cp[i].toFixed(5), P.ct[i].toFixed(5), P.cq[i].toFixed(5)].join(',')).join('\n'); }
export function afCoords(af) { return af.name + '\n' + GEO.loop(af).map(([x, y]) => x.toFixed(6) + ' ' + y.toFixed(6)).join('\n'); }
export function stlText() {
  if (S.mode === 'HAWT') return GEO.stl(GEO.hawtBlade(G.rows, G.afs, G.Rhub, 0), 'hawt_blade_mm');
  const v = S.vawt; if (v.type === 'sav') return null;
  const sf = f => v.type === 'phi' ? { r: v.R * Math.max(0.06, 1 - (2 * f - 1) ** 2), off: 0 } : v.type === 'V' ? { r: v.R * Math.max(0.05, f), off: 0 } : { r: v.R, off: v.type === 'helical' ? v.helix * A.D2R * f : 0 };
  return GEO.stl(GEO.vawtBlade(sf, getAf(S.af.vawt), v.c, v.pitch, 0, v.H, 0), 'vawt_blade_mm');
}
export const MIME = { csv: 'text/csv', html: 'text/html', zip: 'application/zip', stl: 'model/stl', dat: 'text/plain' };
export function blobSave(filename, data) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: (MIME[filename.split('.').pop()] || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch (e) { return false; }
}
// returns 'api' (claude.ai downloads), 'blob' (browser download started, may be blocked silently), or false
async function save(filename, data) {
  if (downloads) {
    try { await downloads.save({ filename, data }); toast('已儲存 ' + filename); } catch (e) { if (e && e.code !== 'declined') toast('無法儲存:' + (e.message || e.code)); }
    return 'api';
  }
  if (blobSave(filename, data)) { toast('已開始下載 ' + filename); return 'blob'; }
  return false;
}
export function openExport() {
  const m = document.createElement('div'); m.className = 'modal';
  const stlOk = !(S.mode === 'VAWT' && S.vawt.type === 'sav');
  m.innerHTML = `<div role="dialog" aria-label="匯出"><h3 style="margin:0 0 6px">匯出設計</h3><p class="note">STL 單位為 mm(單一葉片,槳距 0°),可直接送 3D 列印或 CAD。CSV 可在試算表或 MATLAB 中使用。</p>
    <div class="btns">${stlOk ? '<button class="btn" data-x="zip">完整設計包 ZIP(STL + CSV + 翼型座標)</button>' : ''}<button class="btn ghost" data-x="geo">截面幾何 CSV</button><button class="btn ghost" data-x="pol">極曲線 CSV</button><button class="btn ghost" data-x="perf">性能曲線 CSV</button></div>
    <textarea id="expTxt" class="hidden" style="min-height:220px"></textarea>
    <div class="btns"><button class="btn ghost" data-x="close">關閉</button></div></div>`;
  document.body.appendChild(m);
  const show = (txt, quiet) => { const t = m.querySelector('#expTxt'); t.classList.remove('hidden'); t.value = txt; t.select(); if (!quiet) toast('此環境無法直接下載,已顯示內容供複製'); };
  // after a Blob download we cannot know whether the browser blocked it; offer the text as a manual fallback
  const offer = (txt) => { let b = m.querySelector('#expShow'); if (!b) { b = document.createElement('button'); b.id = 'expShow'; b.className = 'btn ghost'; b.textContent = '沒有開始下載?顯示內容供複製'; m.querySelector('#expTxt').before(b); } b.onclick = () => show(txt, true); };
  const done = (r, txt) => { if (!r) show(txt); else if (r === 'blob') offer(txt); };
  m.addEventListener('click', async e => {
    const x = e.target.dataset.x; if (!x && e.target !== m) return;
    if (e.target === m || x === 'close') { m.remove(); return; }
    const tag = S.mode === 'HAWT' ? 'hawt' : 'vawt_' + S.vawt.type;
    if (x === 'zip') {
      const files = [{ name: tag + '_blade.stl', text: stlText() }, { name: tag + '_geometry.csv', text: csvGeometry() }, { name: tag + '_polar.csv', text: csvPolar() }, { name: tag + '_performance.csv', text: csvPerf() }];
      if (S.mode === 'HAWT') stSorted().forEach((s, j) => files.push({ name: `airfoil_station${j + 1}_rR${s.f.toFixed(2)}.dat`, text: afCoords(getAf(s.k)) }));
      else files.push({ name: 'airfoil.dat', text: afCoords(getAf(S.af.vawt)) });
      done(await save(tag + '_design.zip', GEO.zip(files)), files.map(f => '=== ' + f.name + ' ===\n' + (f.name.endsWith('.stl') ? '(STL 太大,請在可下載的環境匯出)' : f.text)).join('\n\n'));
    } else {
      const txt = x === 'geo' ? csvGeometry() : x === 'pol' ? csvPolar() : csvPerf();
      done(await save(`${tag}_${{ geo: 'geometry', pol: 'polar', perf: 'performance' }[x]}.csv`, txt), txt);
    }
  });
}


/* ---------- workspaces & responsive shell ---------- */
export const MQ = matchMedia('(max-width:860px)');
let sideHidden = false, prevSide = false;
export function isMobile() { return MQ.matches; }
export function setWS(ws) {
  const app = $('#app');
  if (ws === 'set') { app.classList.add('m-set'); renderPane(); markNav(); return; }
  app.classList.remove('m-set');
  if (ws === 'report' && S.ws !== 'report') { prevSide = sideHidden; sideHidden = true; }
  else if (ws !== 'report' && S.ws === 'report') sideHidden = prevSide;
  app.classList.toggle('noside', sideHidden);
  S.ws = ws;
  document.querySelectorAll('.ws').forEach(s => s.classList.toggle('on', s.id === 'ws-' + ws));
  markNav();
  requestAnimationFrame(() => renderWS());
}
export function markNav() {
  const set = $('#app').classList.contains('m-set');
  document.querySelectorAll('.wsnav [data-ws]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ws === S.ws));
  document.querySelectorAll('.bnav [data-mnav]').forEach(b => b.setAttribute('aria-current', set ? b.dataset.mnav === 'set' : b.dataset.mnav === S.ws));
  $('#sideBtn').textContent = sideHidden ? '顯示設定' : '隱藏設定';
}
export function renderWS() {
  if (S.ws === 'tunnel') redrawStatic();
  else if (S.ws === 'blade') Bench.render();
  else if (S.ws === 'flow') Flow.render();
  else if (S.ws === 'report') Report.render();
}
export function placeOpts() {
  const o = $('#copts'), host = isMobile() ? $('#mopts') : $('#ctabs');
  if (o.parentElement !== host) host.appendChild(o);
}
export function afterDesignChange() { // called after rebuild so other workspaces stay in sync
  if (S.ws === 'blade') Bench.render();
  else if (S.ws === 'flow') Flow.render();
  else if (S.ws === 'report') Report.stale();
}

/* ---------- main ---------- */
export function setMode(m) {
  S.mode = m;
  $('#mHAWT').setAttribute('aria-pressed', m === 'HAWT'); $('#mVAWT').setAttribute('aria-pressed', m === 'VAWT');
  SIM.omega = 0; SIM.D = 0.5; SIM.po.last = 0; SIM.po.wref = -1; SIM.latch = false; SIM.cutout = false; for (const k in SIM.hist) SIM.hist[k].length = 0; SIM.traj.length = 0; opElems = null;
  $('#hud').innerHTML = '';
  if (m === 'VAWT' && S.af.view !== 'vawt') S.af.view = 'vawt'; if (m === 'HAWT' && S.af.view === 'vawt') S.af.view = S.af.st.length - 1;
  renderPane(); rebuild(true); chartOpts();
  assistStart();
}
export function init() {
  Scene3D.init($('#three'));
  cv[0] = $('#cv1'); cv[1] = $('#cv2'); cv[2] = $('#cv3');
  document.querySelectorAll('.steps button').forEach(b => b.addEventListener('click', () => {
    S.step = b.dataset.step; document.querySelectorAll('.steps button').forEach(x => x.setAttribute('aria-selected', x === b)); renderPane();
  }));
  document.querySelectorAll('#ctabs [data-c]').forEach(b => b.addEventListener('click', () => {
    S.ctab = b.dataset.c; document.querySelectorAll('#ctabs [data-c]').forEach(x => x.setAttribute('aria-selected', x === b)); setCmpLayout(S.ctab === 'cmp'); chartOpts(); redrawStatic();
  }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => Scene3D.view(b.dataset.view)));
  $('#mHAWT').addEventListener('click', () => setMode('HAWT'));
  $('#mVAWT').addEventListener('click', () => setMode('VAWT'));
  $('#runBtn').addEventListener('click', e => { S.tun.running = !S.tun.running; e.target.textContent = S.tun.running ? '暫停' : '繼續'; });
  $('#exportBtn').addEventListener('click', openExport);
  document.querySelectorAll('.wsnav [data-ws]').forEach(b => b.addEventListener('click', () => setWS(b.dataset.ws)));
  document.querySelectorAll('.bnav [data-mnav]').forEach(b => b.addEventListener('click', () => setWS(b.dataset.mnav)));
  $('#sideDone').addEventListener('click', () => setWS(S.ws));
  $('#sideBtn').addEventListener('click', () => { sideHidden = !sideHidden; $('#app').classList.toggle('noside', sideHidden); markNav(); setTimeout(renderWS, 50); });
  $('#chartsTog').addEventListener('click', e => {
    const w = $('#ws-tunnel'), off = !w.classList.contains('chartsOff'); w.classList.toggle('chartsOff', off);
    e.currentTarget.textContent = off ? '▸ 展開分析圖表' : '▾ 收合分析圖表'; e.currentTarget.setAttribute('aria-expanded', !off);
    $('#chartsHint').textContent = off ? '圖表已收合,3D 風洞放大顯示' : ''; if (!off) setTimeout(redrawStatic, 30);
  });
  $('#hudBtn').addEventListener('click', () => { $('#hud').classList.toggle('off'); });
  MQ.addEventListener('change', () => { placeOpts(); if (!isMobile()) $('#app').classList.remove('m-set'); markNav(); setTimeout(renderWS, 50); });
  placeOpts();
  new ResizeObserver(() => { if (S.ws !== 'tunnel') renderWS(); }).observe($('main'));
  $('#themeBtn').addEventListener('click', () => {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('wt-theme', r.dataset.theme); } catch (e) {}
    Scene3D.applyTheme(); redrawStatic();
  });
  try { const t = localStorage.getItem('wt-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { Scene3D.applyTheme(); redrawStatic(); });
  $('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => importDat(t, f.name)); e.target.value = ''; });
  new ResizeObserver(() => { if (S.ws === 'tunnel') redrawStatic(); }).observe($('#cbody'));
  S.ws = 'tunnel'; markNav();
  renderPane(); rebuild(true); chartOpts();
  SIM.omega = G.lopt * S.tun.V / G.R * 0.3;
  Scene3D.applyTheme();
  let last = performance.now(), acc = 0, chartT = 0, histT = 0;
  const loop = now => {
    let dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (S.tun.running && G.perf) {
      const simDt = dt * S.tun.timeScale, n = Math.max(1, Math.ceil(simDt / 0.002)), h = simDt / n;
      if (h > 0) for (let i = 0; i < n; i++) simStep(h);
      histT += simDt; if (histT > 0.1) { histT = 0; recordHist(); }
    }
    const o = SIM.out;
    const c = Scene3D.colors();
    const Ct = G.perf ? Math.max(0, Math.min(0.95, interpCurve(G.perf, 'ct', Math.max(0, o.lam || 0)))) : 0;
    const a = 0.5 * (1 - Math.sqrt(1 - Ct)) * (SIM.omega > 0.05 ? 1 : 0.3);
    const showTunnel = S.ws === 'tunnel' && !$('#app').classList.contains('m-set');
    if (showTunnel) Scene3D.frame({ rotorAngle: SIM.theta, yawDeg: SIM.yaw, windDeg: S.tun.dir, V: S.tun.running ? (o.V || S.tun.V) : 0, a, TI: S.tun.TI, y0: G.y0 || 0, cSlow: c.signal, cFast: c.accent, visScale: S.tun.running ? S.tun.timeScale : 0 }, dt);
    chartT += dt;
    if (chartT > 0.2) {
      chartT = 0; if (showTunnel) hud(); if (S.ws === 'flow') Flow.tick(); if (S.ws === 'blade') Bench.tick();
      if (S.mode === 'HAWT' && S.ctab === 'blade' && S.tun.running) { opElems = A.bemPoint(hawtCfg(), Math.max(0.5, o.V || S.tun.V), Math.max(0.01, SIM.omega), (o.gam || 0) * A.D2R, S.hawt.pitch, null).elems; }
      if (showTunnel && !$('#ws-tunnel').classList.contains('chartsOff') && (S.ctab === 'live' || S.ctab === 'perf' || S.ctab === 'blade')) redrawStatic();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded', init);
