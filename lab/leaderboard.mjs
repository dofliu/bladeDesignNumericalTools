// Blade lab: rebuild the cumulative statistics from every designs/<id>/metrics.json (+ ui-check.json, design.json).
// Writes designs/LEADERBOARD.md, designs/CANDIDATES.md, designs/stats.csv and designs/progress.svg.
// Usage: node lab/leaderboard.mjs   (rules: docs/BLADE_LAB.md)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect, candidates, nextTrack, feasible, DESIGNS_DIR, DEEPEN_EVERY, CAND_PER_MODE } from './stats.mjs';

const dd = DESIGNS_DIR, rows = collect(), cand = candidates(rows), nt = nextTrack(rows);
const candIds = new Set(cand.list.map(c => c.r.id));
const fx = (v, n) => v == null || !isFinite(v) ? '—' : (+v).toFixed(n);
const minStart = r => { const s = (r.sim && r.sim.start || []).find(x => x.started); return s ? `${s.V} m/s` : '> 5 m/s'; };
const MODES = [['HAWT', '水平軸'], ['VAWT', '垂直軸']];
const link = r => `[${r.name}](${r.id}/README.md)`;
const route = r => r.track === 'deepen' ? `深入 ← \`${r.parent}\`` : '探索';

// ---------- LEADERBOARD.md ----------
const L = ['# 葉片設計實驗排行榜', '',
  '由 `node lab/leaderboard.mjs` 自動產生,請勿手改。規則見 `docs/BLADE_LAB.md`;候選清單見 [CANDIDATES.md](CANDIDATES.md),全部數據見 [stats.csv](stats.csv)。',
  '數值是本工具模型的預測(半經驗極曲線 + BEM/DMST、理想 MPPT 年發電量),不是 XFOIL、CFD 或實測;只適合方案間相對比較。', '',
  '- **標準場址**欄位:每個設計都在 Weibull 平均 5.5 m/s、k 2 下重算(發電機額定照常自動匹配,設計檔明確指定的 `load` 設定保留),為其他場址設計的方案也能直接比較。',
  `- 水平軸與垂直軸分表排名;粗體為該表最佳,★ 為深入研究候選:位在柏拉圖前緣(在標準場址 LCOE、標準場址年發電量、起轉風速三項上沒有被同模式其他可行設計全面勝過),且綜合分數為同模式前 ${CAND_PER_MODE} 名;「前緣」欄標出所有前緣設計。`,
  '- 綜合分數 0–100:三項目標在同模式可行設計中的正規化平均(100 = 三項都最好);「結構不可行」的設計不列入排名。', ''];
L.push('![累積趨勢](progress.svg)', '');
for (const [mode, label] of MODES) {
  const rs = rows.filter(r => r.mode === mode); if (!rs.length) continue;
  const ok = rs.filter(feasible);
  const best = (k, dir) => { const v = ok.map(r => r[k]).filter(x => x != null && isFinite(x)); return v.length ? (dir > 0 ? Math.max(...v) : Math.min(...v)) : null; };
  const b = { cpMax: best('cpMax', 1), stdAep: best('stdAep', 1), stdLcoe: best('stdLcoe', -1), startWind: best('startWind', -1), score: best('score', 1) };
  const mk = (r, k, s) => r[k] != null && r[k] === b[k] && feasible(r) && ok.length > 1 ? `**${s}**` : s;
  L.push(`## ${label}(${rs.length} 個)`, '',
    '| 設計 | 家族 | 路線 | Cp,max @ λ | 標準場址年發電量 kWh | 標準場址 LCOE NT$/kWh | 原場址年發電量 / LCOE | 質量 kg | 起轉風速 | 模擬自啟動 | 最小安全係數 | 綜合分數 | 前緣 | 標記 | 介面驗證 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of [...rs].sort((x, y) => (y.score ?? -1) - (x.score ?? -1))) {
    const site = r.tags.some(t => t.startsWith('場址')) ? `${fx(r.aepKWh, 0)} / ${fx(r.lcoe, 2)}(${r.wind.Vavg} m/s)` : '同左';
    L.push(`| ${candIds.has(r.id) ? '★ ' : ''}${link(r)} | ${r.family} | ${route(r)} | ${mk(r, 'cpMax', fx(r.cpMax, 3))} @ ${fx(r.lopt, 2)} | ${mk(r, 'stdAep', fx(r.stdAep, 0))} | ${mk(r, 'stdLcoe', fx(r.stdLcoe, 2))} | ${site} | ${fx(r.mass, 1)} | ${mk(r, 'startWind', fx(r.startWind, 1) + ' m/s')} | ${minStart(r)} | ${r.loads ? fx(r.loads.minSafety, 2) : '—'} | ${mk(r, 'score', fx(r.score, 0))} | ${r.pareto ? '是' : '—'} | ${r.tags.join('、') || '—'} | ${r.ui} |`);
  }
  L.push('');
}
L.push(`共 ${rows.length} 個設計(探索 ${rows.filter(r => r.track === 'explore').length}、深入 ${rows.filter(r => r.track === 'deepen').length})。`, '');
writeFileSync(join(dd, 'LEADERBOARD.md'), L.join('\n'));

// ---------- CANDIDATES.md ----------
const C = ['# 深入研究候選', '',
  '由 `node lab/leaderboard.mjs` 自動產生,請勿手改。要手動加入或排除候選,編輯 `designs/candidates.json`(格式見 `docs/BLADE_LAB.md`)。', '',
  `## 下一次執行:${nt.track === 'deepen' ? '**深入研究**' : '探索新方向'}`, '',
  `距上次深入研究已累積 ${nt.since} 次探索;規則為每 ${DEEPEN_EVERY} 次執行有 1 次深入研究(連續 ${DEEPEN_EVERY - 1} 次探索後,下一次就深入)。`, ''];
if (nt.track === 'deepen' && cand.list.length) {
  const p = cand.list[0].r;
  C.push(`建議深入的設計:**${p.name}**(\`${p.id}\`,${p.mode === 'HAWT' ? '水平軸' : '垂直軸'},已深入 ${cand.list[0].rounds} 輪、綜合分數 ${fx(p.score, 0)})。挑選順序:深入輪數最少者優先,同輪數取綜合分數最高者。`, '');
}
C.push('## 候選清單', '', `入選條件:柏拉圖前緣且綜合分數為同模式前 ${CAND_PER_MODE} 名,或在 \`designs/candidates.json\` 手動加入。`, '', '| 順位 | 設計 | 模式 | 入選原因 | 已深入輪數 | 綜合分數 | 標準場址 LCOE | 標準場址年發電量 kWh | 起轉風速 | 標記 |', '|---|---|---|---|---|---|---|---|---|---|');
cand.list.forEach(({ r, why, rounds }, i) => C.push(`| ${i + 1} | [${r.name}](${r.id}/README.md) | ${r.mode === 'HAWT' ? '水平軸' : '垂直軸'} | ${why} | ${rounds}${rounds ? `(${r.children.map(c => `\`${c}\``).join('、')})` : ''} | ${fx(r.score, 0)} | ${fx(r.stdLcoe, 2)} | ${fx(r.stdAep, 0)} | ${fx(r.startWind, 1)} m/s | ${r.tags.join('、') || '—'} |`));
if (cand.dropped.length) { C.push('', '## 手動排除', ''); for (const d of cand.dropped) C.push(`- \`${d.id}\`:${d.reason}`); }
const deep = rows.filter(r => r.track === 'deepen');
C.push('', '## 深入研究紀錄', '');
if (!deep.length) C.push('尚無。');
for (const r of deep) {
  const p = rows.find(x => x.id === r.parent);
  const d = (k, n) => p ? `${fx(p[k], n)} → ${fx(r[k], n)}` : fx(r[k], n);
  C.push(`- [${r.name}](${r.id}/README.md) ← \`${r.parent}\`:標準場址 LCOE ${d('stdLcoe', 2)}、年發電量 ${d('stdAep', 0)} kWh、起轉風速 ${d('startWind', 1)} m/s`);
}
C.push('');
writeFileSync(join(dd, 'CANDIDATES.md'), C.join('\n'));

// ---------- stats.csv ----------
const cols = ['id', 'name', 'date', 'mode', 'family', 'track', 'parent', 'candidate', 'pareto', 'score', 'cpMax', 'lopt', 'stdAepKWh', 'stdLcoe',
  'siteVavg', 'siteK', 'siteAepKWh', 'siteLcoe', 'cf', 'ratedW', 'massKg', 'startWind', 'selfStartV', 'minSafety', 'extremeMinSafety', 'material', 'trust', 'tags', 'ui'];
const q = v => v == null ? '' : typeof v === 'number' ? (isFinite(v) ? +v.toFixed(4) : '') : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const csv = [cols.join(',')];
for (const r of rows) {
  const ss = (r.sim && r.sim.start || []).find(x => x.started);
  csv.push([r.id, r.name, r.date, r.mode, r.family, r.track, r.parent, candIds.has(r.id) ? 1 : 0, r.pareto ? 1 : 0, r.score, r.cpMax, r.lopt, r.stdAep, r.stdLcoe,
    r.wind.Vavg, r.wind.k, r.aepKWh, r.lcoe, r.cf, r.ratedW, r.mass, r.startWind, ss ? ss.V : null, r.loads?.minSafety, r.loads?.extremeMinSafety, r.material, r.trust, r.tags.join(' '), r.ui].map(q).join(','));
}
writeFileSync(join(dd, 'stats.csv'), '﻿' + csv.join('\n') + '\n'); // BOM so Excel opens the Chinese text correctly

// ---------- progress.svg: standard-site LCOE of every design in chronological order + running best per mode ----------
writeFileSync(join(dd, 'progress.svg'), progressSvg(rows));
console.log(`designs/LEADERBOARD.md:${rows.length} 個設計;候選 ${cand.list.length} 個;下一次:${nt.track === 'deepen' ? '深入研究' : '探索'}`);

function progressSvg(rows) {
  const W = 760, H = 360, m = { l: 56, r: 150, t: 62, b: 44 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const COL = { HAWT: '#2a78d6', VAWT: '#eb6834' }, NAME = { HAWT: '水平軸', VAWT: '垂直軸' };
  const seq = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const vals = seq.map(r => r.stdLcoe).filter(isFinite);
  const yMax = Math.min(Math.ceil(Math.max(...vals) * 2) / 2, 4), yMin = Math.max(0, Math.floor(Math.min(...vals) * 2) / 2 - 0.5);
  const x = i => m.l + (seq.length > 1 ? i / (seq.length - 1) : 0.5) * pw, y = v => m.t + (1 - (Math.min(v, yMax) - yMin) / (yMax - yMin)) * ph;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, 'Noto Sans TC', sans-serif" font-size="12">`,
    `<rect width="${W}" height="${H}" fill="#fcfcfb"/>`,
    `<text x="${m.l}" y="20" font-size="14" font-weight="600" fill="#0b0b0b">標準場址 LCOE 隨實驗累積(越低越好)</text>`,
    `<text x="${m.l}" y="36" fill="#52514e">每點一個設計,依日期排序;折線為各模式至今最佳(只計結構可行者)。空心點為結構不可行;★ 圈為候選。模型預測,非實測。</text>`];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.5) o.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="#e4e3df"/>`, `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" fill="#52514e">${v.toFixed(1)}</text>`);
  o.push(`<text transform="translate(16 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle" fill="#52514e">NT$/kWh</text>`);
  const dates = [...new Set(seq.map(r => r.date))];
  for (const d of dates) { const i = seq.findIndex(r => r.date === d); if (i % 2 === 0 || dates.length < 8) o.push(`<text x="${x(i)}" y="${m.t + ph + 18}" text-anchor="middle" fill="#52514e">${d.slice(5)}</text>`); }
  o.push(`<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" fill="#52514e">設計日期(依序)</text>`);
  for (const mode of ['HAWT', 'VAWT']) {
    let best = Infinity; const pts = [];
    seq.forEach((r, i) => { if (r.mode === mode && feasible(r) && r.stdLcoe < best) best = r.stdLcoe; if (isFinite(best)) pts.push([x(i), y(best)]); });
    if (pts.length) {
      const d = pts.map(([px, py], i) => i ? `H${px.toFixed(1)}V${py.toFixed(1)}` : `M${px.toFixed(1)} ${py.toFixed(1)}`).join('');
      o.push(`<path d="${d}" fill="none" stroke="${COL[mode]}" stroke-width="2" opacity="0.55"/>`);
      const [lx, ly] = pts[pts.length - 1];
      o.push(`<text x="${lx + 10}" y="${ly + 4}" fill="#0b0b0b">${NAME[mode]}最佳 ${best.toFixed(2)}</text>`);
    }
  }
  seq.forEach((r, i) => {
    const cx = x(i), cy = y(r.stdLcoe), c = COL[r.mode], ok = feasible(r), cand = candIds.has(r.id);
    const t = `<title>${esc(r.name)}:標準場址 LCOE ${fx(r.stdLcoe, 2)}、年發電量 ${fx(r.stdAep, 0)} kWh、起轉風速 ${fx(r.startWind, 1)} m/s${r.tags.length ? '(' + esc(r.tags.join('、')) + ')' : ''}</title>`;
    if (cand) o.push(`<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${c}" stroke-width="1.5"/>`);
    const fill = ok ? c : '#fcfcfb';
    o.push(r.mode === 'HAWT'
      ? `<circle cx="${cx}" cy="${cy}" r="5" fill="${fill}" stroke="${ok ? '#fcfcfb' : c}" stroke-width="2">${t}</circle>`
      : `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" rx="1.5" fill="${fill}" stroke="${ok ? '#fcfcfb' : c}" stroke-width="2">${t}</rect>`);
    if (r.stdLcoe > yMax) o.push(`<text x="${cx + 9}" y="${cy + 12}" fill="#52514e">↑ ${r.stdLcoe.toFixed(2)}</text>`);
  });
  const lx = m.l + pw + 24; let ly = m.t + ph - 44;
  o.push(`<circle cx="${lx}" cy="${ly}" r="5" fill="${COL.HAWT}"/><text x="${lx + 12}" y="${ly + 4}" fill="#0b0b0b">水平軸</text>`);
  ly += 20; o.push(`<rect x="${lx - 5}" y="${ly - 5}" width="10" height="10" rx="1.5" fill="${COL.VAWT}"/><text x="${lx + 12}" y="${ly + 4}" fill="#0b0b0b">垂直軸</text>`);
  ly += 20; o.push(`<circle cx="${lx}" cy="${ly}" r="8" fill="none" stroke="#52514e" stroke-width="1.5"/><text x="${lx + 12}" y="${ly + 4}" fill="#0b0b0b">候選 ★</text>`);
  o.push('</svg>');
  return o.join('\n') + '\n';
}
