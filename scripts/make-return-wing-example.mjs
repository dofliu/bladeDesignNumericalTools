// 產生 examples/return-wing/blade_v02_candidate146.json:由 src/line3d.mjs 的函式定義(v0.2 中心線 + candidate146 扭角)取樣。
// 用法:node scripts/make-return-wing-example.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/line3d.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '../examples/return-wing/blade_v02_candidate146.json');
const defs = ['Work', 'Return'].map(b => L.returnWingBranch(b, { profile: '2412', mirror: true }));
const blade = L.sampleBladeV1(defs, {
  name: '回翼閉合葉片 v0.2 中心線 + candidate146 扭角(鏡射 NACA 2412)',
  note: '診斷用:只含 s 0.1–0.9 的工作翼與回翼;不含翼根、翼尖、橋接與輪轂。兩組相隔 180°(copies 2)。長度以 R 為單位,beta 為截面安裝角(度)。',
  s0: 0.1, s1: 0.9, n: 65, copies: 2,
});
writeFileSync(out, L.bladeToJSON(blade));
console.log('wrote ' + out);
