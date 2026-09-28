// Concatenate src/ into one self-contained HTML (dist/wind-turbine-designer.html).
// Order matters: later modules use globals defined by earlier ones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORDER = ['aero', 'struct', 'charts', 'geo', 'scene', 'core', 'ui', 'bench', 'flow', 'report'];

const shell = readFileSync(join(root, 'src/shell.html'), 'utf8');
const js = ORDER.map(n => `/* ==== ${n}.js ==== */\n` + readFileSync(join(root, `src/${n}.js`), 'utf8')).join('\n');
const html = `${shell}\n<script>\n${js}\n</script>\n</body></html>\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/wind-turbine-designer.html'), html);
console.log(`built dist/wind-turbine-designer.html (${(html.length / 1024).toFixed(0)} KB)`);
