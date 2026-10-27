// Blade lab: rebuild designs/LEADERBOARD.md from every designs/<id>/metrics.json (+ ui-check.json).
// Usage: node lab/leaderboard.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dd = join(root, 'designs');
const rows = [];
for (const id of readdirSync(dd).sort()) {
  const f = join(dd, id, 'metrics.json'); if (!existsSync(f)) continue;
  const m = JSON.parse(readFileSync(f, 'utf8'));
  const u = existsSync(join(dd, id, 'ui-check.json')) ? JSON.parse(readFileSync(join(dd, id, 'ui-check.json'), 'utf8')) : null;
  m.ui = u && Math.abs(u.cpMax / m.cpMax - 1) < 0.01 ? '通過' : u ? '不一致' : '未驗證';
  rows.push({ id, ...m });
}
const fx = (v, n) => v == null || !isFinite(v) ? '—' : (+v).toFixed(n);
const best = (k, lo) => { const v = rows.map(r => r[k]).filter(x => x != null && isFinite(x)); return v.length ? (lo ? Math.min(...v) : Math.max(...v)) : null; };
const mark = (v, b, s) => v === b && rows.length > 1 ? `**${s}**` : s;
const bc = best('cpMax'), ba = best('aepKWh'), bl = best('lcoe', true), bs = best('startWind', true);
const minStart = r => { const s = (r.sim && r.sim.start || []).find(x => x.started); return s ? `${s.V} m/s` : '> 5 m/s'; };
const L = ['# 葉片設計實驗排行榜', '',
  '由 `node lab/leaderboard.mjs` 自動產生,請勿手改。規則見 `docs/BLADE_LAB.md`。粗體為該欄最佳。',
  '數值是本工具模型的預測(半經驗極曲線 + BEM/DMST、理想 MPPT 年發電量),不是 XFOIL、CFD 或實測;只適合方案間相對比較。', '',
  '| 設計 | 家族 | Cp,max @ λ | 年發電量 kWh | LCOE NT$/kWh | 質量 kg | 起轉風速(靜摩擦估算) | 模擬自啟動 | 最小安全係數 | 介面驗證 |',
  '|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| [${r.name}](${r.id}/README.md) | ${r.family} | ${mark(r.cpMax, bc, fx(r.cpMax, 3))} @ ${fx(r.lopt, 2)} | ${mark(r.aepKWh, ba, fx(r.aepKWh, 0))} | ${mark(r.lcoe, bl, fx(r.lcoe, 2))} | ${fx(r.mass, 1)} | ${mark(r.startWind, bs, fx(r.startWind, 1) + ' m/s')} | ${minStart(r)} | ${r.loads ? fx(r.loads.minSafety, 2) : '—'} | ${r.ui} |`);
L.push('', `共 ${rows.length} 個設計。年發電量以各設計檔的風況計算(預設 Weibull 平均 5.5 m/s、k = 2),發電機額定由 \`autoMatchGen\` 自動匹配。`, '');
writeFileSync(join(dd, 'LEADERBOARD.md'), L.join('\n'));
console.log(`designs/LEADERBOARD.md:${rows.length} 個設計`);
