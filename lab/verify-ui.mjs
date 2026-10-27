// Blade lab: load a design into the built web app (dist), check the app reproduces lab/evaluate.mjs,
// run the report's virtual wind-tunnel tests through the UI, and save the report + screenshots.
// Usage: npm run build && node lab/verify-ui.mjs designs/<id>     (needs metrics.json from lab/evaluate.mjs)
// Env: CHROME_PATH, THREE_LOCAL — same as tests/e2e.smoke.mjs.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) { console.error('usage: node lab/verify-ui.mjs designs/<id>'); process.exit(2); }
const d = JSON.parse(readFileSync(join(dir, 'design.json'), 'utf8'));
const m = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8'));
const url = 'file://' + join(root, 'dist/wind-turbine-designer.html');
const three = process.env.THREE_LOCAL ? readFileSync(process.env.THREE_LOCAL, 'utf8') : null;
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(vp) {
  const page = await browser.newPage({ viewport: vp, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', x => { if (x.type() === 'error') errors.push(x.text()); });
  if (three) await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ body: three, contentType: 'application/javascript' });
    if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.continue();
  });
  await page.goto(url); await page.waitForTimeout(2500);
  // Same path as「方案比較 → 載入」: loadSnap() with a snapshot built from the design file
  await page.evaluate(d => {
    const c = d.cfg || {};
    if (d.wind) Object.assign(S.perf, d.wind);
    loadSnap({ name: d.name, mode: d.mode, cfg: { hawt: { ...S.hawt, ...(c.hawt || {}) }, vawt: { ...S.vawt, ...(c.vawt || {}) },
      st: c.st || S.af.st, vaf: c.vaf || S.af.vawt, cdMax: c.cdMax || S.af.cdMax } });
  }, d);
  await page.waitForTimeout(2500);
  if (d.cfg && d.cfg.load) await page.evaluate(l => Object.assign(S.load, l), d.cfg.load);
  return { page, errors };
}
const nav = (page, id) => page.click(`.flownav [data-flow="${id}"]`).then(() => page.waitForTimeout(1200));

{ // desktop: numbers, screenshots, report through the UI
  const { page, errors } = await open({ width: 1440, height: 900 });
  const ui = await page.evaluate(() => ({ cpMax: G.cpMax, lopt: G.lopt, A: G.A, mass: G.mass, mode: S.mode, badge: (document.querySelector('#badge') || {}).textContent || '' }));
  check(ui.mode === m.mode, `介面模式 ${ui.mode}`);
  check(Math.abs(ui.cpMax / m.cpMax - 1) < 0.01, `介面 Cp,max ${ui.cpMax.toFixed(4)} 與 evaluate ${m.cpMax.toFixed(4)} 一致(< 1%)`);
  check(Math.abs(ui.A / m.A - 1) < 0.01 && Math.abs(ui.mass / m.mass - 1) < 0.02, `掃掠面積 ${ui.A.toFixed(3)} m²、質量 ${ui.mass.toFixed(2)} kg 一致`);
  await nav(page, 'concept'); await page.screenshot({ path: join(dir, 'tunnel.jpg'), type: 'jpeg', quality: 70 });
  await nav(page, 'geometry'); await page.screenshot({ path: join(dir, 'blade.jpg'), type: 'jpeg', quality: 70 });
  await nav(page, 'report');
  await page.click('#rpGo');
  await page.waitForSelector('#rpDl:not(.hidden)', { timeout: 300000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(dir, 'report.jpg'), type: 'jpeg', quality: 70 });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.click('#rpDl')]);
  if (dl) await dl.saveAs(join(dir, 'report.html'));
  check(!!dl, '報告 HTML 已透過介面下載');
  const txt = await page.evaluate(() => document.querySelector('#rpView').textContent);
  check(/功率曲線/.test(txt), '報告含虛擬風洞功率曲線測試');
  check(errors.length === 0, `桌面版無 console 錯誤${errors.length ? ':' + errors.slice(0, 3).join(' | ') : ''}`);
  writeFileSync(join(dir, 'ui-check.json'), JSON.stringify({ ...ui, badge: ui.badge.trim(), reportBytes: dl ? readFileSync(join(dir, 'report.html')).length : 0 }, null, 1) + '\n');
  await page.close();
}
{ // phone layout (view-only): the design must render
  const { page, errors } = await open({ width: 390, height: 844 });
  await page.screenshot({ path: join(dir, 'mobile.jpg'), type: 'jpeg', quality: 70 });
  check(errors.length === 0, `手機版無 console 錯誤${errors.length ? ':' + errors.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} 項失敗` : 'ui verification passed');
process.exit(failed ? 1 : 0);
