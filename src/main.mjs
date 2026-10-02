// Single Vite entry: pulls every module into one IIFE bundle.
// Modules still talk through bare globals (see CLAUDE.md), so the exports of each module
// are copied onto globalThis once all modules have been evaluated.
import * as AERO from './aero.mjs';
import * as Plot from './charts.mjs';
import * as GEO from './geo.mjs';
import * as Scene3D from './scene.mjs';
import * as CORE from './core.mjs';
import * as BenchMod from './bench.mjs';
import * as FlowMod from './flow.mjs';
import * as ReportMod from './report.mjs';
import * as UIMod from './ui.mjs';

Object.assign(globalThis, { AERO, Plot, GEO, Scene3D, CORE });
for (const m of [CORE, ReportMod, FlowMod, BenchMod, UIMod]) Object.assign(globalThis, m);
