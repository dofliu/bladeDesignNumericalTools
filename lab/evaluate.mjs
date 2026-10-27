// Blade lab: evaluate one design file with the app's own design core (src/core.mjs), no browser needed.
// Usage: node lab/evaluate.mjs designs/<id>/design.json   → writes designs/<id>/metrics.json and prints a summary.
// The same numbers are re-checked inside the built web app by lab/verify-ui.mjs (see docs/BLADE_LAB.md).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as core from '../src/core.mjs';

const { S, G, SIM, air, designHAWT, designVAWT, computePerf, autoMatchGen, simStep, idealAEP, noiseEstimate,
  costEstimate, startCq, startWindSpeed, familyName, rotorTrust, MATERIALS } = core;
const DEF = structuredClone(S); // pristine defaults, restored before every evaluation

export function applyDesign(d) {
  for (const k of ['hawt', 'vawt', 'tun', 'load', 'perf']) S[k] = structuredClone(DEF[k]);
  S.af = structuredClone(DEF.af);
  const c = d.cfg || {};
  S.mode = d.mode === 'VAWT' ? 'VAWT' : 'HAWT';
  Object.assign(S.hawt, c.hawt || {}); Object.assign(S.vawt, c.vawt || {});
  if (c.st) S.af.st = c.st.map(s => ({ f: s.f, k: s.k }));
  if (c.vaf) S.af.vawt = c.vaf;
  if (c.cdMax) S.af.cdMax = c.cdMax;
  if (d.wind) Object.assign(S.perf, { Vavg: d.wind.Vavg ?? S.perf.Vavg, k: d.wind.k ?? S.perf.k });
  if (S.mode === 'VAWT' && !core.VAWT_TYPES[S.vawt.type]) throw new Error(`未知的垂直軸型式 ${S.vawt.type}(可用:${Object.keys(core.VAWT_TYPES).join(' ')})`);
  const afKeys = new Set(core.AF_LIB.flatMap(g => g.k));
  for (const k of [...S.af.st.map(s => s.k), S.af.vawt]) if (!afKeys.has(k)) throw new Error(`未知的翼型代碼 ${k}(可用:${[...afKeys].join(' ')})`);
  S.tun.running = false;
  if (S.mode === 'HAWT') designHAWT(); else designVAWT();
  computePerf(); autoMatchGen();
  Object.assign(S.load, c.load || {}); // after autoMatchGen so explicit generator settings win
}

function resetSim(V, omega) {
  S.tun.TI = 0; S.tun.V = V; S.tun.dir = 0;
  Object.assign(SIM, { omega, D: 0.5, Di: null, tEst: null, wcap: -1, pAvg: 0, latch: false, brake: false, cutout: false, n: 0, pitch: 0, furlAng: 0 });
  SIM.po.wref = -1; SIM.po.last = 0;
}
// Steady wind, MPPT P&O: mean electrical output over the second half and the tracking ratio vs ideal Cp,max.
function steady(V, dur = S.mode === "HAWT" ? 70 : 120) {
  resetSim(V, G.lopt * V / G.R * 0.7); S.load.ctrl = 'po';
  let e = 0, a = 0, n = 0;
  for (let t = 0; t < dur; t += 0.004) {
    simStep(0.004);
    if (t > dur * 0.4) { e += SIM.out.el.Pout; a += 0.5 * air().rho * G.A * SIM.out.V ** 3; n++; }
  }
  return { V, Pout: e / n, track: (e / a) / (G.cpMax * 0.92 * S.load.eta) };
}
// Self-start: rotor at rest, steady wind V for 60 s; started if it reaches half of the optimum tip speed ratio.
function selfStart(V, dur = 60) {
  resetSim(V, 0); S.load.ctrl = 'po';
  for (let t = 0; t < dur; t += 0.004) simStep(0.004);
  const lam = SIM.omega * G.R / V;
  return { V, lam, started: lam > 0.5 * G.lopt };
}

export function metrics() {
  const H = S.mode === 'HAWT', P = G.perf, cm = G.cpMax, { rho } = air();
  let lo = null, hi = null;
  for (let i = 0; i < P.lam.length; i++) if (P.cp[i] >= 0.9 * cm) { if (lo == null) lo = P.lam[i]; hi = P.lam[i]; }
  const mat = H ? S.hawt.material : S.vawt.material, rated = S.load.Pmax;
  const aep = idealAEP({ A: G.A, cpMax: cm }, rated);
  const cost = costEstimate(G.mass, mat, rated, G.A, aep);
  const m = {
    mode: S.mode, family: familyName(S.mode, S.vawt.type), trust: rotorTrust(), R: G.R, A: G.A,
    cpMax: cm, lopt: G.lopt, band: [lo, hi], material: MATERIALS[mat] ? mat : 'gfrp',
    bladeMass: H ? G.bladeMass : G.bladeMass ?? null, mass: G.mass, ratedW: rated,
    wind: { Vavg: S.perf.Vavg, k: S.perf.k }, aepKWh: aep, cf: aep / (rated * 8.76), lcoe: cost.lcoe, capex: cost.capex,
    startWind: startWindSpeed(startCq(P), G.A, G.R), noiseLp50m: H ? noiseEstimate(G.lopt * 8, 2 * G.R, 50).Lp : null,
    loads: H && G.loads ? { minSafety: G.loads.minSafety, tipDefl: G.loads.tipDefl, extremeMinSafety: G.loads.extreme.minSafety, MflapRoot: G.loads.MflapRoot } : null,
    curve: { lam: P.lam.map(v => +v.toFixed(3)), cp: P.cp.map(v => +Math.max(-0.2, v).toFixed(4)) },
  };
  m.sim = { steady: [6, 9].map(V => steady(V)), start: [3, 4, 5].map(V => selfStart(V)) };
  m.rho = rho;
  return m;
}

export function evaluate(d) { applyDesign(d); return metrics(); }

function evaluateFile(file) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  if (d.schema !== 'blade-lab-v1') throw new Error(`${file}:schema 必須是 blade-lab-v1`);
  const base = evaluate({ mode: d.mode, wind: d.wind });
  const m = evaluate(d);
  const pct = (a, b) => b ? (a / b - 1) * 100 : null;
  m.vsBaseline = { cpMax: pct(m.cpMax, base.cpMax), aepKWh: pct(m.aepKWh, base.aepKWh), lcoe: pct(m.lcoe, base.lcoe), mass: pct(m.mass, base.mass) };
  m.baseline = { cpMax: base.cpMax, lopt: base.lopt, aepKWh: base.aepKWh, lcoe: base.lcoe, mass: base.mass, startWind: base.startWind };
  const out = join(dirname(file), 'metrics.json');
  writeFileSync(out, JSON.stringify({ id: d.id, name: d.name, date: d.date, ...m }, null, 1) + '\n');
  const f = (v, n = 3) => v == null || !isFinite(v) ? '—' : (+v).toFixed(n);
  console.log(`${d.name}(${m.family})`);
  console.log(`  Cp,max ${f(m.cpMax)} @ λ ${f(m.lopt, 2)}(同模式預設 ${f(base.cpMax)} @ ${f(base.lopt, 2)})`);
  console.log(`  AEP ${f(m.aepKWh, 0)} kWh/yr(${f(m.vsBaseline.aepKWh, 1)}%)LCOE ${f(m.lcoe, 2)} NT$/kWh  質量 ${f(m.mass, 1)} kg  起轉風速 ${f(m.startWind, 1)} m/s`);
  if (m.loads) console.log(`  最小安全係數 ${f(m.loads.minSafety, 2)}(極端 ${f(m.loads.extremeMinSafety, 2)})葉尖撓度 ${f(m.loads.tipDefl * 1000, 1)} mm`);
  console.log(`  模擬:${m.sim.steady.map(s => `${s.V} m/s ${f(s.Pout, 0)} W 追蹤 ${f(s.track * 100, 0)}%`).join(';')};自啟動 ${m.sim.start.map(s => `${s.V} m/s ${s.started ? '是' : '否'}`).join(' ')}`);
  console.log(`  → ${out}`);
}

if (process.argv[1] && process.argv[1].endsWith('evaluate.mjs')) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node lab/evaluate.mjs designs/<id>/design.json | --all'); process.exit(2); }
  const dd = join(dirname(fileURLToPath(import.meta.url)), '../designs');
  const files = arg === '--all' ? readdirSync(dd).map(id => join(dd, id, 'design.json')).filter(existsSync) : [arg];
  for (const f of files) evaluateFile(f); // --all: re-run every design after a model change (keeps tests/lab.test.mjs green)
}
