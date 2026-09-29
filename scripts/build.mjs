// Concatenate src/ into one self-contained HTML (dist/wind-turbine-designer.html).
// Order matters: later modules use globals defined by earlier ones.
//
// ROADMAP #1 (ES modules + Vite) is being migrated file by file. A module listed in
// ESM_GLOBAL is real ES module source (src/<name>.mjs, import/export); Vite bundles it
// to an IIFE that assigns the given name as a global, then it is concatenated exactly
// like the remaining not-yet-converted src/<name>.js files below. Behavior and output
// order are unchanged either way.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORDER = ['aero', 'charts', 'geo', 'scene', 'core', 'ui', 'bench', 'flow', 'report'];
const ESM_GLOBAL = { aero: 'AERO', charts: 'Plot', geo: 'GEO', scene: 'Scene3D', core: 'CORE' };
// Modules whose exports must also become bare globals for the not-yet-converted scripts.
const EXPAND_GLOBALS = new Set(['core']);

async function moduleSource(name) {
  const globalName = ESM_GLOBAL[name];
  if (!globalName) return readFileSync(join(root, `src/${name}.js`), 'utf8');
  const [result] = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: { entry: join(root, `src/${name}.mjs`), formats: ['iife'], name: globalName, fileName: () => `${name}.iife.js` }
    }
  });
  const code = result.output[0].code;
  return EXPAND_GLOBALS.has(name) ? `${code}\nObject.assign(globalThis, ${globalName});` : code;
}

const shell = readFileSync(join(root, 'src/shell.html'), 'utf8');
const parts = [];
for (const n of ORDER) parts.push(`/* ==== ${n}.js ==== */\n` + await moduleSource(n));
const js = parts.join('\n');
const html = `${shell}\n<script>\n${js}\n</script>\n</body></html>\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/wind-turbine-designer.html'), html);
console.log(`built dist/wind-turbine-designer.html (${(html.length / 1024).toFixed(0)} KB)`);
