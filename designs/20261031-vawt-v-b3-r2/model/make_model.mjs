// 產生三葉 V 型垂直軸 3D 模型:blade.stl(單葉片)與 rotor.stl(三葉 + 中心軸),單位 mm、Y 軸向上。
// 葉片幾何與介面「匯出 STL」同一函式(geo.mjs vawtBlade + VAWT_FAMILIES.V.shape);中心軸為示意圓柱,不含支撐臂。純 Node,不需 Blender。
import { readFileSync, writeFileSync } from 'node:fs';
import { applyDesign } from '../../../lab/evaluate.mjs';
import * as core from '../../../src/core.mjs';
import { vawtBlade, merge, stl } from '../../../src/geo.mjs';
const d = JSON.parse(readFileSync(new URL('../design.json', import.meta.url)));
applyDesign(d);
const { S, VAWT_FAMILIES, getAf } = core, v = S.vawt;
const sf = f => VAWT_FAMILIES[v.type].shape(v, f);
const af = getAf(S.af.vawt), B = Math.round(v.B), y0 = 0;
const blade = vawtBlade(sf, af, v.c, v.pitch, 0, v.H, y0);
function cylY(rad, y0, y1, n = 32) { // 沿 Y 的實心圓柱
  const pos = [], idx = [];
  for (const y of [y0, y1]) for (let i = 0; i < n; i++) pos.push(rad * Math.cos(2 * Math.PI * i / n), y, rad * Math.sin(2 * Math.PI * i / n));
  pos.push(0, y0, 0, 0, y1, 0);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j, 2 * n, i, j, 2 * n + 1, n + j, n + i); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const parts = [];
for (let b = 0; b < B; b++) parts.push(vawtBlade(sf, af, v.c, v.pitch, 2 * Math.PI * b / B, v.H, y0));
parts.push(cylY(0.03, -0.3, v.H + 0.1));
writeFileSync(new URL('./blade.stl', import.meta.url), stl(blade, 'vawt_v_b3_blade_mm'));
writeFileSync(new URL('./rotor.stl', import.meta.url), stl(merge(parts), 'vawt_v_b3_rotor_mm'));
console.log('B', B, 'R', v.R, 'blade tris', blade.idx.length / 3);
