// Regression tests for the thin-wall section-property core (src/struct.js runs in Node as CommonJS).
// Reference values are the closed-form thin-wall formulas for a rectangular tube and a circular tube,
// so an accidental change in the polygon-integration math shows up immediately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ST = require('../src/struct.js');

const near = (v, ref, tol, msg) => assert.ok(Math.abs(v - ref) <= tol, `${msg}: ${v} vs ${ref} ±${tol}`);

test('thin-wall rectangular tube: area, centroid, Ixx, Iyy', () => {
  const w = 0.08, h = 0.03, t = 0.001; // m
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const r = ST.sectionProps(pts, t);
  near(r.area, 2 * t * (w + h), 1e-9, 'area');
  near(r.xc, 0, 1e-9, 'xc');
  near(r.yc, 0, 1e-9, 'yc');
  near(r.Ixx, t * h * h * (3 * w + h) / 6, 1e-12, 'Ixx');
  near(r.Iyy, t * w * w * (3 * h + w) / 6, 1e-12, 'Iyy');
  near(r.Ixy, 0, 1e-12, 'Ixy');
});

test('thin-wall circular tube: area, Ixx = Iyy = pi r^3 t', () => {
  const rad = 0.05, t = 0.0015, n = 720;
  const pts = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push([rad * Math.cos(a), rad * Math.sin(a)]); }
  const r = ST.sectionProps(pts, t);
  near(r.area, 2 * Math.PI * rad * t, 1e-6, 'area');
  near(r.xc, 0, 1e-9, 'xc');
  near(r.yc, 0, 1e-9, 'yc');
  const Iref = Math.PI * rad * rad * rad * t;
  near(r.Ixx, Iref, Iref * 1e-4, 'Ixx');
  near(r.Iyy, Iref, Iref * 1e-4, 'Iyy');
  near(r.Ixy, 0, 1e-9, 'Ixy');
});

test('centroid shifts when the polygon is translated (offset rectangle)', () => {
  const w = 0.06, h = 0.02, t = 0.0008, ox = 0.3, oy = -0.1;
  const pts = [[ox, oy], [ox + w, oy], [ox + w, oy + h], [ox, oy + h]];
  const r = ST.sectionProps(pts, t);
  near(r.xc, ox + w / 2, 1e-9, 'xc');
  near(r.yc, oy + h / 2, 1e-9, 'yc');
  near(r.Ixx, t * h * h * (3 * w + h) / 6, 1e-12, 'Ixx invariant to translation');
});
