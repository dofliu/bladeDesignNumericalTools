// Concatenate src/ into one self-contained HTML (dist/wind-turbine-designer.html).
// Order matters: later modules use globals defined by earlier ones.
//
// ROADMAP #1: every src/*.mjs is an ES module; one Vite call bundles src/main.mjs into an IIFE.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Kept for scripts/check.mjs: every source module, in dependency order.
export const ORDER = ['aero', 'charts', 'geo', 'scene', 'core', 'ui', 'bench', 'flow', 'report'];

// All modules are real ES modules; src/main.mjs imports them and re-exposes the bare globals.
async function bundle() {
  const [result] = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: { entry: join(root, 'src/main.mjs'), formats: ['iife'], name: 'WTD', fileName: () => 'main.iife.js' }
    }
  });
  return result.output[0].code;
}

const shell = readFileSync(join(root, 'src/shell.html'), 'utf8');
const js = await bundle();
const html = `${shell}\n<script>\n${js}\n</script>\n</body></html>\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/wind-turbine-designer.html'), html);
console.log(`built dist/wind-turbine-designer.html (${(html.length / 1024).toFixed(0)} KB)`);
