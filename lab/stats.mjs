// Blade lab statistics: collect every design, put them on a common footing and pick candidates for deeper study.
// Used by lab/leaderboard.mjs (LEADERBOARD.md, CANDIDATES.md, stats.csv, progress.svg). See docs/BLADE_LAB.md.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { standardSite, STD_WIND } from './evaluate.mjs';

export const DESIGNS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'designs');
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));

// Objectives used for both the Pareto front and the score (per mode, feasible designs only).
export const OBJECTIVES = [
  { key: 'stdLcoe', label: '標準場址 LCOE', dir: -1 },
  { key: 'stdAep', label: '標準場址年發電量', dir: +1 },
  { key: 'startWind', label: '起轉風速', dir: -1 },
];
// Tags: STRUCT makes a design infeasible (never a candidate); the others are warnings shown next to it.
export function tagsOf(r) {
  const t = [];
  if (r.id.endsWith('-baseline')) t.push('基準');
  const L = r.loads;
  if (L && (L.minSafety < 1.5 || L.extremeMinSafety < 1)) t.push('結構不可行');
  if (!(r.sim && r.sim.start || []).some(s => s.started)) t.push('需輔助起轉');
  if (/^(中低|低)/.test(r.trust || '')) t.push('可信度中低');
  if (!isStdWind(r.wind)) t.push(`場址 ${r.wind.Vavg} m/s`);
  return t;
}
export const isStdWind = w => !w || (w.Vavg === STD_WIND.Vavg && w.k === STD_WIND.k);
export const feasible = r => !r.tags.includes('結構不可行');

export function collect(dir = DESIGNS_DIR) {
  const rows = [];
  for (const id of readdirSync(dir).sort()) {
    const fd = join(dir, id, 'design.json'), fm = join(dir, id, 'metrics.json');
    if (!existsSync(fd) || !existsSync(fm)) continue;
    const d = readJson(fd), m = readJson(fm);
    const fu = join(dir, id, 'ui-check.json'), u = existsSync(fu) ? readJson(fu) : null;
    const std = isStdWind(m.wind) ? { aepKWh: m.aepKWh, lcoe: m.lcoe } : standardSite(d);
    const r = { ...m, id, parent: d.parent || null, track: d.track === 'deepen' ? 'deepen' : 'explore',
      ui: u && Math.abs(u.cpMax / m.cpMax - 1) < 0.01 ? '通過' : u ? '不一致' : '未驗證',
      stdAep: std.aepKWh, stdLcoe: std.lcoe };
    r.tags = tagsOf(r);
    rows.push(r);
  }
  for (const r of rows) r.children = rows.filter(c => c.parent === r.id).map(c => c.id);
  for (const mode of ['HAWT', 'VAWT']) rankMode(rows.filter(r => r.mode === mode));
  return rows;
}

const dominates = (a, b) => OBJECTIVES.every(o => o.dir * (a[o.key] - b[o.key]) >= 0) && OBJECTIVES.some(o => o.dir * (a[o.key] - b[o.key]) > 0);
// Score 0–100 within a mode: mean of min–max normalised objectives (100 = best on every objective).
function rankMode(rs) {
  const ok = rs.filter(feasible);
  for (const r of rs) { r.pareto = false; r.score = null; }
  for (const r of ok) r.pareto = !ok.some(o => o !== r && dominates(o, r));
  for (const r of ok) {
    let s = 0;
    for (const o of OBJECTIVES) {
      const v = ok.map(x => x[o.key]), lo = Math.min(...v), hi = Math.max(...v);
      s += hi > lo ? (o.dir > 0 ? r[o.key] - lo : hi - r[o.key]) / (hi - lo) : 1;
    }
    r.score = 100 * s / OBJECTIVES.length;
  }
}

// Candidates = (Pareto front ∩ top CAND_PER_MODE by score in each mode) ∪ manual pins − manual drops (designs/candidates.json).
// Sorted: fewest deepen rounds first, then score.
export const CAND_PER_MODE = 3;
export function candidates(rows, dir = DESIGNS_DIR) {
  const f = join(dir, 'candidates.json'), man = existsSync(f) ? readJson(f) : {};
  const pin = new Map((man.pin || []).map(p => [p.id, p.reason])), drop = new Map((man.drop || []).map(p => [p.id, p.reason]));
  const top = new Set();
  for (const mode of ['HAWT', 'VAWT']) rows.filter(r => r.mode === mode && r.pareto && !drop.has(r.id))
    .sort((a, b) => b.score - a.score).slice(0, CAND_PER_MODE).forEach(r => top.add(r.id));
  const list = rows.filter(r => (top.has(r.id) || pin.has(r.id)) && !drop.has(r.id) && feasible(r))
    .map(r => ({ r, why: pin.has(r.id) ? `手動加入:${pin.get(r.id)}` : '柏拉圖前緣', rounds: r.children.length }));
  list.sort((a, b) => a.rounds - b.rounds || b.r.score - a.r.score);
  return { list, dropped: [...drop].map(([id, reason]) => ({ id, reason })) };
}

// Explore/deepen cadence: after DEEPEN_EVERY − 1 consecutive explore runs, the next run should deepen.
export const DEEPEN_EVERY = 3;
export function nextTrack(rows) {
  let n = 0;
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) n = r.track === 'deepen' ? 0 : n + 1;
  return { since: n, track: n >= DEEPEN_EVERY - 1 ? 'deepen' : 'explore' };
}
