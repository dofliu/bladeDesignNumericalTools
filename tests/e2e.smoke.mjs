// Browser smoke + controller regression test.
// Needs: npm i -D playwright && npx playwright install chromium
// Run:   npm run build && npm run test:e2e
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/output'); mkdirSync(out, { recursive: true });
const url = 'file://' + join(root, 'dist/wind-turbine-designer.html');
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

// Optional env: CHROME_PATH (use an existing Chromium), THREE_LOCAL (path to three.min.js r128 for offline runs)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const three = process.env.THREE_LOCAL ? readFileSync(process.env.THREE_LOCAL, 'utf8') : null;
async function prep(page) {
  if (!three) return;
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ body: three, contentType: 'application/javascript' });
    if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.continue();
  });
}
for (const vp of [{ width: 1440, height: 900, tag: 'desktop' }, { width: 390, height: 844, tag: 'mobile' }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await prep(page);
  await page.goto(url); await page.waitForTimeout(2500);
  const mobile = vp.width < 860;
  for (const ws of ['tunnel', 'blade', 'flow', 'report']) {
    await page.click(mobile ? `[data-mnav="${ws}"]` : `.wsnav [data-ws="${ws}"]`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `${vp.tag}-${ws}.png`) });
  }
  check(errors.length === 0, `${vp.tag}: no page errors ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
}

// controller regression: steady tracking efficiency below rated wind must stay >= 0.9 of ideal
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await prep(page);
await page.goto(url); await page.waitForTimeout(2000);
const res = await page.evaluate(() => {
  S.tun.running = false; const out = [];
  for (const mode of ['HAWT', 'VAWT']) {
    if (mode === 'VAWT') setMode('VAWT');
    for (const ctrl of ['po', 'tsr', 'ot']) for (const V of [6, 9]) {
      S.tun.TI = 0; S.tun.V = V; S.load.ctrl = ctrl;
      SIM.omega = G.lopt * V / G.R * 0.7; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null; SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.n = 0; SIM.po.wref = -1;
      const dur = mode === 'HAWT' ? 70 : 120; let e = 0, a = 0;
      for (let t = 0; t < dur; t += 0.004) { simStep(0.004); if (t > dur * 0.4) { e += SIM.out.el.Pout; a += 0.5 * air().rho * G.A * SIM.out.V ** 3; } }
      out.push({ mode, ctrl, V, track: (e / a) / (G.cpMax * 0.92 * S.load.eta) });
    }
  }
  return out;
});
for (const r of res) check(r.track >= 0.9, `${r.mode} ${r.ctrl} ${r.V} m/s tracking ${(r.track * 100).toFixed(0)}%`);
await browser.close();
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('all e2e checks passed');
