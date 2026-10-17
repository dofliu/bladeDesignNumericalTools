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
    const fid = { tunnel: 'tunnel', blade: 'geometry', flow: 'field', report: 'report' }[ws]; // 桌面預設為流程版面
    await page.click(mobile ? `[data-mnav="${ws}"]` : `.flownav [data-flow="${fid}"]`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `${vp.tag}-${ws}.png`) });
  }
  if (mobile) { // 手機版只檢視:設計面板控制項全部停用並有說明,快速操作仍可用
    await page.click('[data-mnav="set"]'); await page.waitForTimeout(500);
    const ro = await page.evaluate(() => ({ note: !!document.querySelector('#pane .mnote'), n: document.querySelectorAll('#pane input,#pane select,#pane textarea,#pane button').length, off: document.querySelectorAll('#pane input:not([disabled]),#pane select:not([disabled]),#pane textarea:not([disabled]),#pane button:not([disabled])').length, q: document.querySelectorAll('#quickBody input:not([disabled])').length }));
    check(ro.note && ro.n > 0 && ro.off === 0, `mobile: 設計面板唯讀(控制項 ${ro.n} 個、未停用 ${ro.off})`);
    check(ro.q > 0, 'mobile: 快速操作控制項仍可用');
    check(await page.evaluate(() => { const r = document.querySelector('#pane.ro .row:not(.wide) input[type=range]'); return !r || getComputedStyle(r).display === 'none'; }), 'mobile: 唯讀面板隱藏滑桿');
    await page.screenshot({ path: join(out, 'mobile-settings-readonly.png') });
    check(await page.evaluate(() => getComputedStyle(document.querySelector('#modeSeg')).display === 'none'), 'mobile: 風機型式切換已隱藏');
    await page.click('[data-mnav="tunnel"]'); await page.waitForTimeout(500);
  }
  if (!mobile) { // 流程式外殼(預設版面):五步驟各自切到對應工作區並標示目前步驟
    check(await page.evaluate(() => document.querySelector('#app').classList.contains('flow')), 'desktop: 預設為流程版面');
    const want = { concept: 'tunnel', geometry: 'blade', airfoil: 'blade', tunnel: 'tunnel', report: 'report' };
    let ok = true;
    for (const [id, ws] of Object.entries(want)) {
      await page.click(`.flownav [data-flow="${id}"]`); await page.waitForTimeout(600);
      const st = await page.evaluate(id2 => ({ on: document.querySelector('.ws.on').id, cur: [...document.querySelectorAll('.flownav [aria-pressed="true"]')].map(b => b.dataset.flow).join() }), id);
      if (st.on !== 'ws-' + ws || st.cur !== id) { ok = false; console.log('flow mismatch', id, st); }
    }
    check(ok, 'desktop: 流程式外殼五步驟切換正確');
    await page.click('.flownav [data-flow="concept"]'); await page.waitForTimeout(300);
    const prevOff = await page.evaluate(() => document.querySelector('#flowPrev').disabled);
    await page.click('#flowNext'); await page.waitForTimeout(500);
    const nx = await page.evaluate(() => [...document.querySelectorAll('.flownav [aria-pressed="true"]')].map(b => b.dataset.flow).join() + '|' + document.querySelector('#flowHint').textContent.length);
    check(prevOff && nx.startsWith('geometry|') && !nx.endsWith('|0'), 'desktop: 流程上一步/下一步與步驟說明');
    await page.click('.flownav [data-flow="concept"]'); await page.waitForTimeout(400);
    check(await page.evaluate(() => document.querySelectorAll('#pane .fcard').length) >= 7, 'desktop: 概念步驟顯示轉子家族卡片');
    check(await page.evaluate(() => document.querySelectorAll('#pane .gitem [data-guide]').length) === 3, 'desktop: 概念步驟顯示「我的形狀該選哪條路」引導');
    await page.click('#pane [data-guide="param"]'); await page.waitForTimeout(800);
    check(await page.evaluate(() => document.querySelector('#pane .fcard[data-fam="arch"]').getAttribute('aria-pressed') === 'true'), 'desktop: 引導「參數化家族」按鈕切到阿基米德螺旋');
    await page.click('.flownav [data-flow="geometry"]'); await page.waitForTimeout(800);
    check(await page.evaluate(() => { const c = document.querySelector('#bSav'); if (!c || !c.width) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 500; }), 'desktop: 阿基米德螺旋單葉片俯視圖有繪出內容');
    await page.click('.flownav [data-flow="concept"]'); await page.waitForTimeout(400);
    await page.click('#pane [data-guide="cad"]'); await page.waitForTimeout(800);
    check(await page.evaluate(() => document.querySelector('#pane .fcard[data-fam="stl"]').getAttribute('aria-pressed') === 'true'), 'desktop: 引導「完全自由 CAD 外形」切到匯入外形(STL)');
    { // 以程式產生的 ASCII 圓柱 STL(R 0.5 m、L 1.2 m,單位 mm)上傳,驗證面積與質量顯示
      const n = 32, v = [], pt = (k, z) => [500 * Math.cos(2 * Math.PI * k / n), 500 * Math.sin(2 * Math.PI * k / n), z];
      for (let k = 0; k < n; k++) { const a = pt(k, 0), b = pt(k + 1, 0), c = pt(k, 1200), d = pt(k + 1, 1200); v.push([a, b, c], [b, d, c], [[0, 0, 0], b, a], [[0, 0, 1200], c, d]); }
      const stl = 'solid t\n' + v.map(t => 'facet normal 0 0 0\nouter loop\n' + t.map(p => `vertex ${p[0]} ${p[1]} ${p[2]}`).join('\n') + '\nendloop\nendfacet').join('\n') + '\nendsolid t\n';
      await page.setInputFiles('#stlFileIn', { name: 'cyl.stl', mimeType: 'model/stl', buffer: Buffer.from(stl) }); await page.waitForTimeout(1200);
      const txt = await page.evaluate(() => document.querySelector('#pane').textContent);
      check(/cyl\.stl/.test(txt) && /掃掠面積/.test(txt) && /1\.1\d\d m²|1\.2\d* m²/.test(txt), 'desktop: 匯入外形(STL)上傳後顯示檔名與掃掠面積');
      check(await page.evaluate(() => /cyl\.stl/.test(document.querySelector('#badge, .badge') ? document.querySelector('#badge, .badge').textContent : 'cyl.stl')), 'desktop: 匯入外形(STL)徽章含檔名');
      await page.screenshot({ path: join(out, 'desktop-stl.png') });
    }
    await page.click('.flownav [data-flow="concept"]'); await page.waitForTimeout(400);
    await page.click('#pane .fcard[data-fam="sav"]'); await page.waitForTimeout(800);
    check(await page.evaluate(() => document.querySelector('#pane .fcard[data-fam="sav"]').getAttribute('aria-pressed') === 'true'), 'desktop: 點選卡片切換轉子家族');
    await page.screenshot({ path: join(out, 'desktop-concept.png') });
    await page.click('#pane .fcard[data-fam="free"]'); await page.waitForTimeout(1000);
    { // 外形編輯器:拖曳、雙擊新增、雙擊刪除控制點
      const n0 = await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT).length), rf0 = await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT)[3].rf);
      const box = async () => await page.evaluate(() => { document.querySelector('#shapeSvg').scrollIntoView({ block: 'center' }); const c = document.querySelector('#shapeSvg .shpt[data-i="3"] circle:last-child').getBoundingClientRect(); const s = document.querySelector('#shapeSvg').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2, sx: s.width / 200 }; });
      const b = await box();
      await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x - 12 * b.sx, b.y, { steps: 4 }); await page.waitForTimeout(150);
      check(/粗估 Cp ≈ 0\.\d+/.test(await page.evaluate(() => document.querySelector('#shapeLive')?.textContent || '')), 'desktop: 拖曳中即時顯示粗估 Cp');
      await page.mouse.up(); await page.waitForTimeout(600);
      const rf1 = await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT)[3].rf);
      check(rf1 < rf0 - 0.05, `desktop: 拖曳外形控制點改變半徑 ${rf0} → ${rf1.toFixed(2)}`);
      await page.screenshot({ path: join(out, 'desktop-shape-editor.png') });
      const s = await page.evaluate(() => { document.querySelector('#shapeSvg').scrollIntoView({ block: 'center' }); const r = document.querySelector('#shapeSvg').getBoundingClientRect(); return { x: r.x, y: r.y, k: r.width / 200 }; });
      await page.mouse.dblclick(s.x + 100 * s.k, s.y + 20 * s.k); await page.waitForTimeout(600);
      check(await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT).length) === n0 + 1, 'desktop: 雙擊曲線新增控制點');
      const b2 = await box(); await page.mouse.dblclick(b2.x, b2.y); await page.waitForTimeout(600);
      check(await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT).length) === n0, 'desktop: 雙擊控制點刪除');
      { // 鍵盤微調:聚焦控制點後按方向鍵 / Delete
        const r0 = await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT)[3].rf);
        await page.focus('#shapeSvg .shpt[data-i="3"]'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
        const r1 = await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT)[3].rf);
        check(r1 > r0 + 0.015, `desktop: 方向鍵微調控制點半徑 ${r0.toFixed(3)} → ${r1.toFixed(3)}`);
        check(await page.evaluate(() => document.activeElement?.classList.contains('shpt')), 'desktop: 微調後焦點留在控制點');
        await page.keyboard.press('Delete'); await page.waitForTimeout(500);
        check(await page.evaluate(() => (S.vawt.shapePts || FREE_SHAPE_DEFAULT).length) === n0 - 1, 'desktop: Delete 鍵刪除控制點');
      }
    }
    await page.click('#pane .fcard[data-fam="HAWT"]'); await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, 'desktop-flow.png') });
    await page.click('#layoutBtn');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.wsnav')).display !== 'none' && localStorage.getItem('wt-layout') === 'classic'), 'desktop: 可切回經典版面並記住選擇');
    await page.click('#layoutBtn');
  }
  { // 研究模式(三維線葉片):內建範例 λ6 部分 CQ 與 fixture 一致;指定 a 後缺值不補 0;比較組可加入
    await page.click(mobile ? '[data-mnav="research"]' : '.flownav [data-flow="research"]'); await page.waitForTimeout(1500);
    const r0 = await page.evaluate(() => { const r = Research.last(); return { cq: r.partialCQ, cov: r.coverage, txt: document.querySelector('#rsSum').innerText }; });
    check(Math.abs(r0.cq - 0.039662) < 1e-5 && r0.cov === 1 && r0.txt.includes('0.039662'), `${vp.tag}: 研究模式內建範例部分 CQ ${r0.cq}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('#researchInner').scrollWidth <= document.querySelector('#researchInner').clientWidth + 1), `${vp.tag}: 研究模式無水平溢出`);
    await page.screenshot({ path: join(out, `${vp.tag}-research.png`) });
    await page.fill('[data-br="Return"][data-k="a"]', '0.25'); await page.dispatchEvent('[data-br="Return"][data-k="a"]', 'change'); await page.waitForTimeout(500);
    const r1 = await page.evaluate(() => { const r = Research.last(); return { cq: r.partialCQ, cov: r.coverage, txt: document.querySelector('#rsSum').innerText }; });
    check(r1.cq === null && Math.abs(r1.cov - 0.7736) < 1e-3 && r1.txt.includes('缺值') && r1.txt.includes('攻角超出極曲線範圍'), `${vp.tag}: 研究模式缺值標示(覆蓋率 ${(r1.cov * 100).toFixed(1)}%)`);
    await page.click('#rsAdd'); await page.waitForTimeout(300);
    check(await page.evaluate(() => Research.compareCount() === 1 && document.querySelectorAll('#rsCmp tbody tr').length === 2), `${vp.tag}: 研究模式加入比較`);
    { // CSV 匯出:Blob 下載(檔名與內容);缺值留空
      const grab = async id => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click(id)]); if (!dl) return null; const fs = await import('node:fs'); return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8') }; };
      const c1 = await grab('#rsSx'), c2 = await grab('#rsCx');
      check(c1 && c1.name.endsWith('.csv') && c1.text.includes('alpha_deg') && c1.text.split('\r\n').length > 100, `${vp.tag}: 研究模式逐截面 CSV ${c1 ? c1.name + " " + c1.text.length : "none"}`);
      check(c2 && c2.name.endsWith('_CQ_lambda.csv') && c2.text.includes('基準 partialCQ') && c2.text.includes('目前設定 partialCQ'), `${vp.tag}: 研究模式 CQ–λ CSV ${c2 ? c2.name : 'none'}`);
    }
    await page.fill('[data-br="Return"][data-k="a"]', '0'); await page.dispatchEvent('[data-br="Return"][data-k="a"]', 'change');
    if (!mobile) { // 匯入防呆:空檔要報錯而非沿用舊資料;檔內文字不得被當成 HTML 執行;λ 掃描下限不可超過上限
      await page.setInputFiles('#rsBf', { name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('') }); await page.waitForTimeout(400);
      check(await page.evaluate(() => document.querySelector('#rsErr').textContent.includes('匯入失敗')), 'desktop: 研究模式匯入空檔顯示錯誤');
      const evil = JSON.parse(readFileSync(join(root, 'examples/return-wing/polar_v1.json'), 'utf8')); evil.conditions.Ncrit = '<img src=x onerror="window.__xss=1">';
      await page.setInputFiles('#rsPf', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) }); await page.waitForTimeout(500);
      check(await page.evaluate(() => !window.__xss && !document.querySelector('#rsPinfo img') && document.querySelector('#rsPinfo').textContent.includes('<img')), 'desktop: 研究模式匯入資料以純文字顯示');
      await page.fill('#rsL0', '9'); await page.dispatchEvent('#rsL0', 'change'); await page.waitForTimeout(300);
      check(await page.evaluate(() => Research.state.lam1 > Research.state.lam0), 'desktop: λ 掃描下限超過上限時自動調整');
      await page.click('#rsEx'); await page.waitForTimeout(500);
    }
    await page.click(mobile ? '[data-mnav="tunnel"]' : '.flownav [data-flow="tunnel"]'); await page.waitForTimeout(300);
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
  for (const [x, name] of [['geo', 'hawt_geometry.csv'], ['perf', 'hawt_performance.csv'], ['zip', 'hawt_design.zip'], ['foam', 'hawt_openfoam_case.zip']]) {
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
  updateBadge(); out.push({ badgeDemo: /示意曲線,非實測/.test(document.querySelector('#badge').textContent) });
  const n0 = SNAPS.length; saveSnap(); const sn = SNAPS[SNAPS.length - 1], name = S.custom.name, np = S.custom.pts.length;
  S.custom.pts = null; S.custom.name = ''; loadSnap(sn);
  out.push({ snap: SNAPS.length === n0 + 1 && S.custom.name === name && S.custom.pts && S.custom.pts.length === np && !!G.perf });
  setMode('HAWT'); rebuild(true); saveSnap(); // 不同家族方案 → 比較表依家族分組
  drawCompare(); const grp = [...document.querySelectorAll('#cmpBox tr.grp')].map(e => e.textContent);
  out.push({ cmpGroups: grp.length >= 2 && new Set(grp).size === grp.length });
  SNAPS.length = n0; storeSnaps();
  return out;
});
check(res.some(r => r.badgeDemo), 'custom rotor: 徽章標示示意曲線非實測');
check(res.some(r => r.cmpGroups), 'compare: 不同家族方案依家族分組');
check(res.some(r => r.snap), 'custom rotor: snapshot save/load restores S.custom');
for (const r of res.filter(r => r.ctrl)) check(r.track >= 0.9, `${r.mode} ${r.ctrl} ${r.V} m/s tracking ${(r.track * 100).toFixed(0)}%`);
await browser.close();
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('all e2e checks passed');
