// Syntax-check every src/*.js with `node --check` (cross-platform replacement for a shell loop).
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const src = join(dirname(fileURLToPath(import.meta.url)), '../src');
let bad = 0;
for (const f of readdirSync(src).filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', join(src, f)], { stdio: 'pipe' }); console.log('ok   ' + f); }
  catch (e) { bad++; console.log('FAIL ' + f + '\n' + e.stderr); }
}
process.exit(bad ? 1 : 0);
