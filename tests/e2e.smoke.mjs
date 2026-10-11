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
  if (!mobile) { // 流程式外殼:五步驟各自切到對應工作區並標示目前步驟
    await page.click('#layoutBtn');
    const want = { concept: 'tunnel', geometry: 'blade', airfoil: 'blade', tunnel: 'tunnel', report: 'report' };
    let ok = true;
    for (const [id, ws] of Object.entries(want)) {
      await page.click(`.flownav [data-flow="${id}"]`); await page.waitForTimeout(600);
      const st = await page.evaluate(id2 => ({ on: document.querySelector('.ws.on').id, cur: [...document.querySelectorAll('.flownav [aria-pressed="true"]')].map(b => b.dataset.flow).join() }), id);
      if (st.on !== 'ws-' + ws || st.cur !== id) { ok = false; console.log('flow mismatch', id, st); }
    }
    check(ok, 'desktop: 流程式外殼五步驟切換正確');
    await page.screenshot({ path: join(out, 'desktop-flow.png') });
    await page.click('#layoutBtn');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.wsnav')).display !== 'none'), 'desktop: 可切回經典版面');
  }
  check(errors.length === 0, `${vp.tag}: no page errors ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
}

// export outside claude.ai: no window.claude → Blob downloads must start with the right file names
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await prep(page);
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('#exportBtn');
  for (const [x, name] of [['geo', 'hawt_geometry.csv'], ['perf', 'hawt_performance.csv'], ['zip', 'hawt_design.zip']]) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click(`.modal [data-x="${x}"]`)]);
    const size = dl ? (await readFileSync(await dl.path())).length : 0;
    check(dl && dl.suggestedFilename() === name && size > 100, `export ${x}: Blob download ${dl ? dl.suggestedFilename() : 'none'} (${size} B)`);
  }
  await page.click('.modal #expShow');
  check(await page.$eval('.modal #expTxt', t => !t.classList.contains('hidden') && t.value.length > 100), 'export: manual text fallback shown on request');
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
  // custom (imported Cp-lambda) rotor: tracking at 9 m/s + snapshot keeps S.custom
  setMode('VAWT'); S.vawt.type = 'custom'; loadCpText(CUSTOM_EXAMPLES.lift.text, CUSTOM_EXAMPLES.lift.name, true); rebuild(true);
  for (const ctrl of ['po', 'tsr', 'ot']) {
    S.tun.TI = 0; S.tun.V = 9; S.load.ctrl = ctrl;
    SIM.omega = G.lopt * 9 / G.R * 0.7; SIM.D = 0.5; SIM.Di = null; SIM.tEst = null; SIM.wcap = -1; SIM.pAvg = 0; SIM.latch = false; SIM.n = 0; SIM.po.wref = -1;
    let e = 0, a = 0;
    for (let t = 0; t < 120; t += 0.004) { simStep(0.004); if (t > 48) { e += SIM.out.el.Pout; a += 0.5 * air().rho * G.A * SIM.out.V ** 3; } }
    out.push({ mode: 'custom', ctrl, V: 9, track: (e / a) / (G.cpMax * 0.92 * S.load.eta) });
  }
  const n0 = SNAPS.length; saveSnap(); const sn = SNAPS[SNAPS.length - 1], name = S.custom.name, np = S.custom.pts.length;
  S.custom.pts = null; S.custom.name = ''; loadSnap(sn);
  out.push({ snap: SNAPS.length === n0 + 1 && S.custom.name === name && S.custom.pts && S.custom.pts.length === np && !!G.perf });
  SNAPS.length = n0; storeSnaps();
  return out;
});
check(res.some(r => r.snap), 'custom rotor: snapshot save/load restores S.custom');
for (const r of res.filter(r => r.ctrl)) check(r.track >= 0.9, `${r.mode} ${r.ctrl} ${r.V} m/s tracking ${(r.track * 100).toFixed(0)}%`);
await browser.close();
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('all e2e checks passed');
