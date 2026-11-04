// 產生三葉沙漏形自訂外形垂直軸 3D 模型:blade.stl(單葉片)與 rotor.stl(三葉 + 輪轂 + 主軸),單位 mm、轉子軸 Y 向上。
// 葉片幾何與介面 3D 風洞同一函式(geo.mjs vawtBlade + core VAWT_FAMILIES.V.shape)。用法:node make_model.mjs —— 純 Node。
import { readFileSync, writeFileSync } from 'node:fs';
import { applyDesign } from '../../../lab/evaluate.mjs';
import * as core from '../../../src/core.mjs';
import { vawtBlade, merge, stl } from '../../../src/geo.mjs';
const d = JSON.parse(readFileSync(new URL('../design.json', import.meta.url)));
applyDesign(d);
const { S, VAWT_FAMILIES, getAf } = core, v = S.vawt;
const sf = f => VAWT_FAMILIES[v.type].shape(v, f), af = getAf(S.af.vawt), B = Math.round(v.B);
const blades = [];
for (let b = 0; b < B; b++) blades.push(vawtBlade(sf, af, v.c, v.pitch, 2 * Math.PI * b / B, v.H, 0));
function cylY(rad, y0, y1, n = 32) { // 沿 Y 的實心圓柱
  const pos = [], idx = [];
  for (const y of [y0, y1]) for (let i = 0; i < n; i++) pos.push(rad * Math.cos(2 * Math.PI * i / n), y, rad * Math.sin(2 * Math.PI * i / n));
  pos.push(0, y0, 0, 0, y1, 0);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j, 2 * n, i, j, 2 * n + 1, n + j, n + i); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const parts = [...blades, cylY(0.06, -0.04, 0.12), cylY(0.025, -0.5, v.H * 1.05)];
writeFileSync(new URL('./blade.stl', import.meta.url), stl(blades[0], 'vawt_free_blade_mm'));
writeFileSync(new URL('./rotor.stl', import.meta.url), stl(merge(parts), 'vawt_free_rotor_mm'));
console.log('R', v.R, 'H', v.H, 'blade tris', blades[0].idx.length / 3);
