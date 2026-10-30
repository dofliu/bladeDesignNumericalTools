// 產生 Savonius 轉子 3D 模型(rotor.stl 單位 mm、rotor.obj 單位 m),幾何與介面 3D 風洞(scene.mjs buildSavonius)相同。
// 用法:node make_model.mjs   —— 純 Node,不需 Blender;之後用 blender_import.py 匯入。
import { writeFileSync } from 'node:fs';
import { merge, stl } from '../../../src/geo.mjs';
const R = 0.7, H = 2.0, B = 3, ov = 0.25;
const d = 2 * R / (2 - ov), r = d / 2, e = ov * d, t = Math.max(0.0015, 0.004 * R) * 2; // 殼厚加倍以利列印/渲染
const N = 48;
function bucket(ang) {
  const cx = (r - e / 2) * 0.8, pos = [], idx = [];
  const ring = (rad, y) => { const s = pos.length / 3; for (let i = 0; i <= N; i++) { const th = Math.PI * i / N; pos.push(cx + rad * Math.sin(th), y, rad * Math.cos(th)); } return s; };
  const a0 = ring(r, 0), a1 = ring(r, H), b0 = ring(r - t, 0), b1 = ring(r - t, H);
  const quad = (p, q, u, v) => idx.push(p, q, u, q, v, u);
  for (let i = 0; i < N; i++) {
    quad(a0 + i, a0 + i + 1, a1 + i, a1 + i + 1); // 外面
    quad(b0 + i + 1, b0 + i, b1 + i + 1, b1 + i); // 內面
    quad(a1 + i, a1 + i + 1, b1 + i, b1 + i + 1); // 上緣
    quad(a0 + i + 1, a0 + i, b0 + i + 1, b0 + i); // 下緣
  }
  quad(a0, a1, b0, b1); quad(a1 + N, a0 + N, b1 + N, b0 + N); // 兩側端面
  const c = Math.cos(ang), s = Math.sin(ang), p = new Float32Array(pos);
  for (let i = 0; i < p.length; i += 3) { const x = p[i], z = p[i + 2]; p[i] = c * x + s * z; p[i + 2] = -s * x + c * z; }
  return { pos: p, idx: new Uint32Array(idx) };
}
function disc(rad, y0, h, n = 64) {
  const pos = [], idx = [];
  for (const y of [y0, y0 + h]) { pos.push(0, y, 0); for (let i = 0; i < n; i++) pos.push(rad * Math.cos(2 * Math.PI * i / n), y, rad * Math.sin(2 * Math.PI * i / n)); }
  const m = n + 1;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(0, 1 + j, 1 + i, m, m + 1 + i, m + 1 + j, 1 + i, 1 + j, m + 1 + j, 1 + i, m + 1 + j, m + 1 + i); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
function shaft(rad, h, n = 24) {
  const pos = [], idx = [];
  for (const y of [-0.05, h]) for (let i = 0; i < n; i++) pos.push(rad * Math.cos(2 * Math.PI * i / n), y, rad * Math.sin(2 * Math.PI * i / n));
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + i, j, n + j, n + i); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const parts = [];
for (let b = 0; b < B; b++) parts.push(bucket(2 * Math.PI * b / B));
const pl = Math.max(0.006, R * 0.012);
parts.push(disc(R * 1.05, -pl, pl), disc(R * 1.05, H, pl), shaft(Math.max(0.015, R * 0.03), H * 1.1));
const m = merge(parts);
writeFileSync(new URL('./rotor.stl', import.meta.url), stl(m, 'savonius_b3'));
let obj = 'o Savonius_B3\n';
for (let i = 0; i < m.pos.length; i += 3) obj += `v ${m.pos[i].toFixed(5)} ${m.pos[i + 1].toFixed(5)} ${m.pos[i + 2].toFixed(5)}\n`;
for (let i = 0; i < m.idx.length; i += 3) obj += `f ${m.idx[i] + 1} ${m.idx[i + 1] + 1} ${m.idx[i + 2] + 1}\n`;
writeFileSync(new URL('./rotor.obj', import.meta.url), obj);
console.log('tris', m.idx.length / 3);
