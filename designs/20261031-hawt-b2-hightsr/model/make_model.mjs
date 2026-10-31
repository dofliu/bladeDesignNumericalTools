// 產生兩葉水平軸轉子 3D 模型:blade.stl(單葉片)與 rotor.stl(兩葉 + 輪轂 + 主軸),單位 mm、轉子軸為 Z。
// 幾何與介面「匯出 STL」同一函式(geo.mjs hawtBlade)。用法:node make_model.mjs —— 純 Node,不需 Blender。
import { readFileSync, writeFileSync } from 'node:fs';
import { applyDesign } from '../../../lab/evaluate.mjs';
import * as core from '../../../src/core.mjs';
import { hawtBlade, merge, stl } from '../../../src/geo.mjs';
const d = JSON.parse(readFileSync(new URL('../design.json', import.meta.url)));
applyDesign(d);
const { G, S } = core;
const blade = hawtBlade(G.rows, G.afs, G.Rhub, S.hawt.pitch);
function rotZ(mesh, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), p = new Float32Array(mesh.pos);
  for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1]; p[i] = c * x - s * y; p[i + 1] = s * x + c * y; }
  return { pos: p, idx: mesh.idx };
}
function cyl(rad, z0, z1, n = 32) { // 沿 Z 的實心圓柱
  const pos = [], idx = [];
  for (const z of [z0, z1]) for (let i = 0; i < n; i++) pos.push(rad * Math.cos(2 * Math.PI * i / n), rad * Math.sin(2 * Math.PI * i / n), z);
  pos.push(0, 0, z0, 0, 0, z1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + i, j, n + j, n + i, 2 * n, j, i, 2 * n + 1, n + i, n + j); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const hubR = Math.max(G.Rhub, 0.05);
const parts = [];
for (let b = 0; b < S.hawt.B; b++) parts.push(rotZ(blade, 2 * Math.PI * b / S.hawt.B));
parts.push(cyl(hubR, -0.08, 0.08), cyl(0.03, 0.08, 0.9));
writeFileSync(new URL('./blade.stl', import.meta.url), stl(blade, 'hawt_b2_blade_mm'));
writeFileSync(new URL('./rotor.stl', import.meta.url), stl(merge(parts), 'hawt_b2_rotor_mm'));
console.log('R', G.R, 'Rhub', G.Rhub, 'blade tris', blade.idx.length / 3);
