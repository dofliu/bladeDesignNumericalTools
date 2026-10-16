/* ===== Geometry: lofted blade meshes, STL, ZIP (real ES module; bundled to the global `GEO` by scripts/build.mjs via Vite) ===== */
export const PIVOT = 0.3; // pitch axis at 30% chord
export function loop(af) {
  const n = af.x.length, pts = [];
  for (let i = n - 1; i >= 0; i--) pts.push([af.x[i], af.yu[i]]);
  for (let i = 1; i < n; i++) pts.push([af.x[i], af.yl[i]]);
  return pts;
}
function ellipseAf(n) { // round root section
  const x = [], yu = [], yl = [];
  for (let i = 0; i < n; i++) { const t = Math.PI * i / (n - 1), xx = 0.5 * (1 - Math.cos(t)); x.push(xx); const y = 0.5 * Math.sin(t) * 0.92; yu.push(y); yl.push(-y); }
  return { x, yu, yl };
}
// sections: [{P:[x,y,z], d:[..], u:[..], c, loop:[[xi,eta]...]}]
export function loft(sections, capEnds) {
  const M = sections[0].loop.length, K = sections.length;
  const pos = new Float32Array(K * M * 3 + (capEnds ? 6 : 0));
  let p = 0;
  for (const s of sections) for (const [xi, eta] of s.loop) {
    const a = (xi - PIVOT) * s.c, b = eta * s.c;
    pos[p++] = s.P[0] + a * s.d[0] + b * s.u[0];
    pos[p++] = s.P[1] + a * s.d[1] + b * s.u[1];
    pos[p++] = s.P[2] + a * s.d[2] + b * s.u[2];
  }
  const idx = [];
  for (let k = 0; k < K - 1; k++) for (let j = 0; j < M - 1; j++) {
    const a = k * M + j, b = a + 1, c = a + M, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  if (capEnds) {
    const base = K * M;
    for (const [si, ci] of [[0, base], [K - 1, base + 1]]) {
      const s = sections[si];
      const a = (0.5 - PIVOT) * s.c;
      pos[ci * 3] = s.P[0] + a * s.d[0]; pos[ci * 3 + 1] = s.P[1] + a * s.d[1]; pos[ci * 3 + 2] = s.P[2] + a * s.d[2];
      for (let j = 0; j < M - 1; j++) {
        const v0 = si * M + j, v1 = v0 + 1;
        if (si === 0) idx.push(ci, v0, v1); else idx.push(ci, v1, v0);
      }
    }
  }
  return { pos, idx: new Uint32Array(idx) };
}
const add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const lin = (terms) => terms.reduce((acc, [v, s]) => [acc[0] + v[0] * s, acc[1] + v[1] * s, acc[2] + v[2] * s], [0, 0, 0]);

// HAWT blade along +Y (radial), rotation about +X, motion +Z. twist in deg incl. pitch
export function hawtBlade(rows, afs, Rhub, pitch) {
  const secs = [];
  const mk = (r, c, twDeg, af) => {
    const th = twDeg * Math.PI / 180;
    const d = [Math.sin(th), 0, -Math.cos(th)], u = [Math.cos(th), 0, Math.sin(th)];
    return { P: [0, r, 0], d, u, c, loop: loop(af) };
  };
  const circ = ellipseAf(afs[0].x.length);
  const c0 = rows[0].c, tw0 = rows[0].tw + pitch;
  const rootR = Math.max(0.35 * Rhub, 0.02);
  secs.push(mk(rootR, Math.min(c0 * 0.55, Rhub * 1.2), tw0, circ));
  secs.push(mk(Rhub * 1.02, Math.min(c0 * 0.6, Rhub * 1.3), tw0, circ));
  rows.forEach((row, i) => secs.push(mk(row.r, row.c, row.tw + pitch, afs[i])));
  const last = rows[rows.length - 1];
  const R = last.r + last.dr / 2;
  secs.push(mk(R, last.c * 0.85, last.tw + pitch, afs[afs.length - 1]));
  return loft(secs, true);
}
// VAWT blade b: sections along height; y = up
export function vawtBlade(slicesFn, af, c, pitchDeg, phase, H, y0) {
  const secs = [];
  const beta = pitchDeg * Math.PI / 180;
  const N = 28;
  for (let k = 0; k <= N; k++) {
    const s = slicesFn(k / N); // {r, off}
    const ph = phase + s.off;
    const n = [Math.cos(ph), 0, -Math.sin(ph)], m = [-Math.sin(ph), 0, -Math.cos(ph)];
    const d = lin([[m, -Math.cos(beta)], [n, Math.sin(beta)]]), u = lin([[n, Math.cos(beta)], [m, Math.sin(beta)]]);
    secs.push({ P: [s.r * n[0], y0 + (k / N) * H, s.r * n[2]], d, u, c, loop: loop(af) });
  }
  return loft(secs, true);
}
// Slice function for vawtBlade from a custom r(z) envelope (AERO.customShape result: rf.y(zf), optional tw.y(zf) in deg).
// Same clamp as AERO.vawtSlices (r >= 6% of the max radius) so the lofted blade matches what DMST analysed.
export function customBladeShape(shape, helixDeg) {
  const { rf, tw, rMax } = shape;
  return zf => ({ r: Math.max(0.06 * rMax, rf.y(zf)), off: (tw ? tw.y(zf) : (helixDeg || 0) * zf) * Math.PI / 180 });
}
/* ---------- Archimedean screw blade (parametric; performance comes from imported Cp-lambda, not computed) ---------- */
export const ARCH_DEFAULT = { D: 1.0, L: 1.2, blades: 3, turns: 0.75, thick: 0.004, hubD: 0.08, tipFrac: 1.0, nz: 96 };
// Axis = +Z (axial, 0..L). Each blade is a helicoidal plate: at height z it is a radial strip from the hub to the
// envelope radius r(z) = R*(1-(1-tipFrac)*z/L) (tipFrac<1 gives a cone), rotated by turns*2*pi*z/L and
// `thick` thick in the tangential direction. Returns { pos, idx } of one closed solid per blade, merged.
export function archimedeanBlade(opt) {
  const o = Object.assign({}, ARCH_DEFAULT, opt);
  const R = o.D / 2, rh = Math.min(o.hubD / 2, R * 0.9), nz = Math.max(2, Math.round(o.nz)), hw = o.thick / 2;
  const meshes = [];
  for (let b = 0; b < Math.max(1, Math.round(o.blades)); b++) {
    const th0 = 2 * Math.PI * b / Math.round(o.blades);
    const pos = new Float32Array((nz + 1) * 4 * 3), idx = [];
    for (let k = 0; k <= nz; k++) {
      const zf = k / nz, z = o.L * zf, ro = Math.max(rh * 1.05, R * (1 - (1 - o.tipFrac) * zf));
      const th = th0 + 2 * Math.PI * o.turns * zf, c = Math.cos(th), s = Math.sin(th);
      // local (radial, tangential) corners: in-hub -t, out -t, out +t, in +t
      [[rh, -hw], [ro, -hw], [ro, hw], [rh, hw]].forEach(([r, t], j) => {
        const i = (k * 4 + j) * 3;
        pos[i] = r * c - t * s; pos[i + 1] = r * s + t * c; pos[i + 2] = z;
      });
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < 4; j++) {
      const a = k * 4 + j, bb = k * 4 + (j + 1) % 4, c2 = a + 4, d = bb + 4;
      idx.push(a, bb, c2, bb, d, c2);
    }
    for (const [k, flip] of [[0, true], [nz, false]]) { // end caps (quad as 2 triangles)
      const q = k * 4;
      if (flip) idx.push(q, q + 2, q + 1, q, q + 3, q + 2); else idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
    }
    meshes.push({ pos, idx: new Uint32Array(idx) });
  }
  return merge(meshes);
}
// Swept (frontal projection) area of the envelope: pi * (D/2)^2 for the maximum radius.
export const archimedeanSweptArea = opt => { const o = Object.assign({}, ARCH_DEFAULT, opt); return Math.PI * (o.D / 2) ** 2 * Math.max(1, o.tipFrac) ** 2; };
export function merge(meshes) {
  let np = 0, ni = 0; for (const m of meshes) { np += m.pos.length; ni += m.idx.length; }
  const pos = new Float32Array(np), idx = new Uint32Array(ni);
  let po = 0, io = 0;
  for (const m of meshes) { pos.set(m.pos, po); for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + po / 3; po += m.pos.length; io += m.idx.length; }
  return { pos, idx };
}
export function rotX(mesh, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), p = new Float32Array(mesh.pos);
  for (let i = 0; i < p.length; i += 3) { const y = p[i + 1], z = p[i + 2]; p[i + 1] = c * y - s * z; p[i + 2] = s * y + c * z; }
  return { pos: p, idx: mesh.idx };
}
export function stl(mesh, name) {
  const { pos, idx } = mesh;
  // ensure outward winding via signed volume
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    vol += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
  }
  const flip = vol < 0;
  const out = ['solid ' + name];
  const f = v => (v * 1000).toFixed(3); // mm
  for (let t = 0; t < idx.length; t += 3) {
    let a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    if (flip) { const tmp = b; b = c; c = tmp; }
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    if (!isFinite(nx) || L < 1e-14) continue;
    out.push(` facet normal ${nx.toExponential(4)} ${ny.toExponential(4)} ${nz.toExponential(4)}\n  outer loop\n   vertex ${f(pos[a])} ${f(pos[a + 1])} ${f(pos[a + 2])}\n   vertex ${f(pos[b])} ${f(pos[b + 1])} ${f(pos[b + 2])}\n   vertex ${f(pos[c])} ${f(pos[c + 1])} ${f(pos[c + 2])}\n  endloop\n endfacet`);
  }
  out.push('endsolid ' + name);
  return out.join('\n');
}
/* ---------- Cross-section properties (thin shell over the airfoil profile) ---------- */
function signedArea(pts) {
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; A += x0 * y1 - x1 * y0; }
  return A / 2;
}
// Raw area + first/second moments of a closed polygon about the ORIGIN (not its own centroid),
// so composite sections (outer-minus-inner shell) can be summed before shifting axes once at
// the end (parallel-axis on two different own-centroids would be wrong). Auto-orients to CCW.
export function polygonMoments(ptsIn) {
  const pts = signedArea(ptsIn) < 0 ? ptsIn.slice().reverse() : ptsIn;
  const n = pts.length;
  let A = 0, Mx = 0, My = 0, Ixx = 0, Iyy = 0, Ixy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const cr = x0 * y1 - x1 * y0;
    A += cr; My += (x0 + x1) * cr; Mx += (y0 + y1) * cr;
    Ixx += (y0 * y0 + y0 * y1 + y1 * y1) * cr;
    Iyy += (x0 * x0 + x0 * x1 + x1 * x1) * cr;
    Ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * cr;
  }
  A /= 2;
  return { area: A, My: My / 6, Mx: Mx / 6, Ixx: Ixx / 12, Iyy: Iyy / 12, Ixy: Ixy / 24 }; // My=∫x dA, Mx=∫y dA
}
function aboutCentroid(m) {
  const cx = m.area > 0 ? m.My / m.area : 0, cy = m.area > 0 ? m.Mx / m.area : 0;
  return { area: m.area, cx, cy, Ixx: m.Ixx - m.area * cy * cy, Iyy: m.Iyy - m.area * cx * cx, Ixy: m.Ixy - m.area * cx * cy };
}
// Inward miter offset of a closed polygon by distance t (e.g. to carve out a shell's inner
// wall). Auto-orients to CCW first. Simple vertex-normal-bisector join; not a robust general
// polygon offset (no handling of self-intersection at very sharp/reflex corners or t large
// relative to local curvature), adequate for smooth, cosine-spaced airfoil profiles.
export function offsetPolygon(ptsIn, t) {
  const pts = signedArea(ptsIn) < 0 ? ptsIn.slice().reverse() : ptsIn;
  const n = pts.length;
  const edgeNormal = i => {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    return [dy / L, -dx / L]; // outward normal (CCW polygon)
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const nPrev = edgeNormal((i - 1 + n) % n), nNext = edgeNormal(i);
    let bx = nPrev[0] + nNext[0], by = nPrev[1] + nNext[1];
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const cosHalf = Math.max(bx * nNext[0] + by * nNext[1], 0.15); // clamp: no spikes at sharp corners
    const scale = t / cosHalf;
    out.push([pts[i][0] - bx * scale, pts[i][1] - by * scale]);
  }
  return out;
}
// Section properties of a thin shell (thickness `thickness`, uniform, both in metres) over an
// airfoil profile af:{x,yu,yl} (unit chord, LE->TE), for a section of the given chord (metres).
// Returns area (m^2), centroid cx/cy (m from LE, chord-axis/thickness-axis) and second moments
// of area Ixx/Iyy/Ixy about the centroid (m^4). Falls back to the solid section if the shell
// thickness would consume (near-)the whole profile.
function maxThickness(af) { let m = 0; for (let i = 0; i < af.yu.length; i++) m = Math.max(m, af.yu[i] - af.yl[i]); return m; }
export function sectionProperties(af, chord, thickness) {
  const pts = loop(af);
  const outer = polygonMoments(pts);
  // A wall thicker than half the local airfoil thickness makes the inward offset fold over itself
  // (garbage area/inertia), so treat it as a solid section instead.
  const solid = thickness / chord >= 0.5 * maxThickness(af) * (1 - 1e-9);
  const inner = solid ? { area: 0 } : polygonMoments(offsetPolygon(pts, thickness / chord));
  const combined = solid || inner.area <= 0 || inner.area >= outer.area * 0.98 ? outer : {
    area: outer.area - inner.area, My: outer.My - inner.My, Mx: outer.Mx - inner.Mx,
    Ixx: outer.Ixx - inner.Ixx, Iyy: outer.Iyy - inner.Iyy, Ixy: outer.Ixy - inner.Ixy,
  };
  const c = aboutCentroid(combined);
  let yMax = 0, xMax = 0;
  for (const [x, y] of pts) { yMax = Math.max(yMax, Math.abs(y - c.cy)); xMax = Math.max(xMax, Math.abs(x - c.cx)); }
  return {
    area: c.area * chord * chord, cx: c.cx * chord, cy: c.cy * chord,
    Ixx: c.Ixx * chord ** 4, Iyy: c.Iyy * chord ** 4, Ixy: c.Ixy * chord ** 4,
    yMax: yMax * chord, xMax: xMax * chord, // extreme-fibre distance from centroid, flatwise/edgewise
  };
}
// Shell thickness (metres) whose sectionProperties area matches targetArea (m^2), by bisection.
// Used to back out an equivalent wall thickness from the mass model's `fill` fraction (see
// core.js bladeLoads) instead of adding a separate user-facing thickness field.
export function equivalentThickness(af, chord, targetArea) {
  let lo = 1e-6 * chord, hi = 0.5 * maxThickness(af) * chord;
  // Near-solid targets (e.g. solid wood, fill 1): walls close to half the thickness fold the inner
  // offset polygon, so return the solid section directly instead of bisecting into that region.
  if (targetArea >= 0.95 * sectionProperties(af, chord, hi).area) return hi;
  for (let it = 0; it < 24; it++) {
    const mid = 0.5 * (lo + hi);
    if (sectionProperties(af, chord, mid).area < targetArea) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}
// Euler-Bernoulli deflection v(r) from curvature M/EI, integrated from the fixed root
// (v=0, slope=0) outward by the trapezoidal rule. rows: [{r}], root->tip order.
export function beamDeflection(rows, M, EI) {
  const n = rows.length, slope = new Array(n).fill(0), v = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dr = rows[i].r - rows[i - 1].r;
    const k0 = M[i - 1] / EI[i - 1], k1 = M[i] / EI[i];
    slope[i] = slope[i - 1] + 0.5 * (k0 + k1) * dr;
    v[i] = v[i - 1] + 0.5 * (slope[i - 1] + slope[i]) * dr;
  }
  return v;
}

// Rainflow cycle counting (ASTM E1049-85, three-point method) of a load/stress history.
// Returns [{range, mean, count}] with count 1 (full cycle) or 0.5 (residue half cycle).
export function reversals(series) {
  const out = [];
  for (const v of series) {
    if (!isFinite(v)) continue;
    const n = out.length;
    if (n && v === out[n - 1]) continue;
    if (n >= 2 && (out[n - 1] - out[n - 2]) * (v - out[n - 1]) > 0) out[n - 1] = v; // same direction: extend
    else out.push(v);
  }
  return out;
}
export function rainflow(series) {
  const cycles = [], st = [];
  for (const v of reversals(series)) {
    st.push(v);
    while (st.length >= 3) {
      const n = st.length, X = Math.abs(st[n - 1] - st[n - 2]), Y = Math.abs(st[n - 2] - st[n - 3]);
      if (X < Y) break;
      if (n === 3) { cycles.push({ range: Y, mean: 0.5 * (st[0] + st[1]), count: 0.5 }); st.shift(); }
      else { cycles.push({ range: Y, mean: 0.5 * (st[n - 2] + st[n - 3]), count: 1 }); st.splice(n - 3, 2); }
    }
  }
  for (let i = 0; i + 1 < st.length; i++) cycles.push({ range: Math.abs(st[i + 1] - st[i]), mean: 0.5 * (st[i] + st[i + 1]), count: 0.5 });
  return cycles;
}
// Palmgren-Miner damage of rainflow cycles on a Basquin S-N curve N = (su / Sa)^m, with the
// Goodman mean-stress correction Sa_eq = Sa / (1 - Sm/su) (tensile mean only; Sm >= su fails).
export function minerDamage(cycles, su, m) {
  let D = 0;
  for (const c of cycles) {
    const sa = 0.5 * c.range; if (!(sa > 0)) continue;
    const g = 1 - Math.max(0, c.mean) / su;
    if (g <= 0) return Infinity;
    D += c.count * Math.pow(sa / g / su, m);
  }
  return D;
}
// Damage-equivalent (constant-amplitude) range at nEq cycles for S-N slope m (no mean correction).
export function equivalentRange(cycles, m, nEq) {
  let s = 0; for (const c of cycles) s += c.count * Math.pow(c.range, m);
  return nEq > 0 ? Math.pow(s / nEq, 1 / m) : 0;
}

// store-only ZIP
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
export function zip(files) { // [{name, text}]
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const data = enc.encode(f.text), nm = enc.encode(f.name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
/* ---------- STL import (8E): parse, unit scaling, revolved-envelope swept area, inertia ---------- */
export function parseSTL(data) { // ArrayBuffer | Uint8Array | string -> {pos:Float32Array(mm 原單位), idx:Uint32Array, tris}
  let bytes = null, text = null;
  if (typeof data === 'string') text = data;
  else bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = bytes.byteLength >= 84 ? dv.getUint32(80, true) : -1;
    if (n >= 0 && 84 + n * 50 === bytes.byteLength) { // binary
      const pos = new Float32Array(n * 9);
      for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) pos[t * 9 + k] = dv.getFloat32(84 + t * 50 + 12 + k * 4, true);
      return finishSTL(pos);
    }
    text = new TextDecoder().decode(bytes);
  }
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g, v = [];
  let m; while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
  if (!v.length || v.length % 9) throw new Error('STL 格式無法解析(找不到完整三角形)');
  return finishSTL(Float32Array.from(v));
}
function finishSTL(pos) {
  for (let i = 0; i < pos.length; i++) if (!isFinite(pos[i])) throw new Error('STL 含有非數值座標');
  const idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
  return { pos, idx, tris: idx.length / 3 };
}
// 網格閉合檢查:以相對容差焊接重合頂點,數每條邊被幾個三角形共用(閉合流形每條邊恰為 2)
export function meshClosure(mesh) {
  const P = mesh.pos, n = P.length / 3; let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < lo[k]) lo[k] = P[i]; if (P[i] > hi[k]) hi[k] = P[i]; }
  const q = Math.max(Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-6, 1e-12), ids = new Map(), vid = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[i * 3] / q) + ',' + Math.round(P[i * 3 + 1] / q) + ',' + Math.round(P[i * 3 + 2] / q);
    let id = ids.get(k); if (id === undefined) { id = ids.size; ids.set(k, id); } vid[i] = id;
  }
  const V = ids.size, cnt = new Map(); let degenerate = 0;
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const a = vid[mesh.idx[t]], b = vid[mesh.idx[t + 1]], c = vid[mesh.idx[t + 2]];
    if (a === b || b === c || a === c) { degenerate++; continue; }
    for (const [u, v] of [[a, b], [b, c], [c, a]]) { const key = Math.min(u, v) * V + Math.max(u, v); cnt.set(key, (cnt.get(key) || 0) + 1); }
  }
  let open = 0, nonManifold = 0; for (const c of cnt.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
  return { open, nonManifold, degenerate, edges: cnt.size, closed: open === 0 && nonManifold === 0 };
}
// 單位係數 → 公尺;axis 'x'|'y'|'z' 轉成工具內部的 z 軸為旋轉軸(其餘軸輪替)
export function transformSTL(mesh, unit, axis) {
  const s = { mm: 1e-3, cm: 1e-2, m: 1, in: 0.0254 }[unit || 'mm']; if (!s) throw new Error('未知單位 ' + unit);
  const p = new Float32Array(mesh.pos.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = mesh.pos[i] * s, y = mesh.pos[i + 1] * s, z = mesh.pos[i + 2] * s;
    if (axis === 'x') { p[i] = y; p[i + 1] = z; p[i + 2] = x; }
    else if (axis === 'y') { p[i] = z; p[i + 1] = x; p[i + 2] = y; }
    else { p[i] = x; p[i + 1] = y; p[i + 2] = z; }
  }
  return { pos: p, idx: mesh.idx };
}
// 以 z 為旋轉軸(公尺)。垂直軸:∫2r(z)dz(r 為該高度頂點最大半徑,以 nb 分箱);水平軸:π·rMax²
export function stlMetrics(mesh, opt) {
  const o = Object.assign({ density: 0, nb: 64, horizontal: false }, opt), P = mesh.pos;
  let zmin = Infinity, zmax = -Infinity, rmax = 0, vol = 0, Jz = 0;
  for (let i = 0; i < P.length; i += 3) { zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); rmax = Math.max(rmax, Math.hypot(P[i], P[i + 1])); }
  const L = zmax - zmin, rb = new Float64Array(o.nb);
  for (let i = 0; i < P.length; i += 3) {
    const b = Math.min(o.nb - 1, Math.floor((P[i + 2] - zmin) / (L || 1) * o.nb));
    rb[b] = Math.max(rb[b], Math.hypot(P[i], P[i + 1]));
  }
  for (let b = 1; b < o.nb; b++) if (!rb[b]) rb[b] = rb[b - 1]; // 空箱補值
  let area = 0; for (let b = 0; b < o.nb; b++) area += 2 * rb[b] * (L / o.nb);
  if (o.horizontal) area = Math.PI * rmax * rmax;
  // 以四面體符號體積累加體積與對 z 軸慣量(閉合網格;Jz 以均勻密度 ρ∫(x²+y²)dV 近似)
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const a = mesh.idx[t] * 3, b = mesh.idx[t + 1] * 3, c = mesh.idx[t + 2] * 3;
    const v = (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    vol += v;
    // 四面體(原點,a,b,c)對 z 軸慣量:|6V|/20 × Σ(對稱二次式)/… 以 x²+y² 的頂點積分式
    const xs = [P[a], P[b], P[c]], ys = [P[a + 1], P[b + 1], P[c + 1]];
    let q = 0; for (let i = 0; i < 3; i++) { q += xs[i] * xs[i] + ys[i] * ys[i]; for (let j = i + 1; j < 3; j++) q += xs[i] * xs[j] + ys[i] * ys[j]; }
    Jz += v * q / 10; // ∫(x²+y²)dV 對原點為頂點的四面體 = V/10·Σ_{i≤j}(…) (含原點頂點為 0)
  }
  vol = Math.abs(vol); Jz = Math.abs(Jz);
  return { area, rmax, zmin, zmax, length: L, volume: vol, mass: vol * o.density, J: Jz * o.density };
}
/* ---------- OpenFOAM case export (steady simpleFoam + snappyHexMesh around a single blade STL) ---------- */
// opt: { R (m, rotor radius or blade extent), V (m/s), lam (tip-speed ratio, informational), B (blades), stlName, nu }
// Returns [{name,text}] for a ready-to-run skeleton; the STL (mm) is added by the caller. Not validated CFD setup.
export function openfoamCase(opt) {
  const R = opt.R, V = opt.V, nu = opt.nu || 1.5e-5, stlName = opt.stlName || 'blade.stl';
  const f = x => String(+(+x).toPrecision(6));
  const hdr = (cls, obj, loc) => `FoamFile\n{\n    version 2.0;\n    format ascii;\n    class ${cls};\n${loc ? `    location "${loc}";\n` : ''}    object ${obj};\n}\n`;
  const L = 6 * R, W = 2 * R, up = 2 * R; // 域:上游 2R、下游 4R、側向 ±R
  const nx = 60, ny = 20, nz = 20;
  const omega = opt.lam ? opt.lam * V / R : 0;
  const k = 1.5 * Math.pow(0.05 * V, 2), om = Math.sqrt(k) / (0.09 ** 0.25 * 0.1 * R);
  const files = [];
  files.push({ name: 'system/blockMeshDict', text: hdr('dictionary', 'blockMeshDict') + `\nscale 1;\nvertices\n(\n    (${f(-up)} ${f(-W / 2)} ${f(-W / 2)})\n    (${f(L - up)} ${f(-W / 2)} ${f(-W / 2)})\n    (${f(L - up)} ${f(W / 2)} ${f(-W / 2)})\n    (${f(-up)} ${f(W / 2)} ${f(-W / 2)})\n    (${f(-up)} ${f(-W / 2)} ${f(W / 2)})\n    (${f(L - up)} ${f(-W / 2)} ${f(W / 2)})\n    (${f(L - up)} ${f(W / 2)} ${f(W / 2)})\n    (${f(-up)} ${f(W / 2)} ${f(W / 2)})\n);\nblocks ( hex (0 1 2 3 4 5 6 7) (${nx} ${ny} ${nz}) simpleGrading (1 1 1) );\nedges ();\nboundary\n(\n    inlet { type patch; faces ((0 4 7 3)); }\n    outlet { type patch; faces ((1 2 6 5)); }\n    sides { type symmetryPlane; faces ((0 1 5 4) (3 7 6 2) (0 3 2 1) (4 5 6 7)); }\n);\n` });
  files.push({ name: 'system/snappyHexMeshDict', text: hdr('dictionary', 'snappyHexMeshDict') + `\ncastellatedMesh true;\nsnap true;\naddLayers false;\ngeometry\n{\n    blade { type triSurfaceMesh; file "${stlName}"; }\n}\ncastellatedMeshControls\n{\n    maxLocalCells 2000000; maxGlobalCells 4000000; minRefinementCells 10; nCellsBetweenLevels 3;\n    features ();\n    refinementSurfaces { blade { level (2 4); } }\n    resolveFeatureAngle 30;\n    refinementRegions {}\n    locationInMesh (${f(-up * 0.9)} 0.01 0.01);\n    allowFreeStandingZoneFaces true;\n}\nsnapControls { nSmoothPatch 3; tolerance 2.0; nSolveIter 30; nRelaxIter 5; nFeatureSnapIter 10; implicitFeatureSnap true; }\naddLayersControls { relativeSizes true; layers {} expansionRatio 1.2; finalLayerThickness 0.5; minThickness 0.1; nGrow 0; featureAngle 130; nRelaxIter 5; nSmoothSurfaceNormals 1; nSmoothNormals 3; nSmoothThickness 10; maxFaceThicknessRatio 0.5; maxThicknessToMedialRatio 0.3; minMedianAxisAngle 90; nBufferCellsNoExtrude 0; nLayerIter 50; }\nmeshQualityControls { maxNonOrtho 65; maxBoundarySkewness 20; maxInternalSkewness 4; maxConcave 80; minVol 1e-13; minTetQuality 1e-15; minArea -1; minTwist 0.02; minDeterminant 0.001; minFaceWeight 0.05; minVolRatio 0.01; minTriangleTwist -1; nSmoothScale 4; errorReduction 0.75; }\nmergeTolerance 1e-6;\n` });
  files.push({ name: 'system/controlDict', text: hdr('dictionary', 'controlDict') + `\napplication simpleFoam;\nstartFrom startTime;\nstartTime 0;\nstopAt endTime;\nendTime 1000;\ndeltaT 1;\nwriteControl timeStep;\nwriteInterval 100;\npurgeWrite 2;\nwriteFormat ascii;\nwritePrecision 7;\nrunTimeModifiable true;\nfunctions\n{\n    forces { type forces; libs ("libforces.so"); patches (blade); rho rhoInf; rhoInf 1.225; CofR (0 0 0); writeControl timeStep; writeInterval 10; }\n}\n` });
  files.push({ name: 'system/fvSchemes', text: hdr('dictionary', 'fvSchemes') + `\nddtSchemes { default steadyState; }\ngradSchemes { default Gauss linear; }\ndivSchemes { default none; div(phi,U) bounded Gauss linearUpwind grad(U); div(phi,k) bounded Gauss upwind; div(phi,omega) bounded Gauss upwind; div((nuEff*dev2(T(grad(U))))) Gauss linear; }\nlaplacianSchemes { default Gauss linear corrected; }\ninterpolationSchemes { default linear; }\nsnGradSchemes { default corrected; }\nwallDist { method meshWave; }\n` });
  files.push({ name: 'system/fvSolution', text: hdr('dictionary', 'fvSolution') + `\nsolvers\n{\n    p { solver GAMG; smoother GaussSeidel; tolerance 1e-7; relTol 0.01; }\n    "(U|k|omega)" { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-8; relTol 0.1; }\n}\nSIMPLE { nNonOrthogonalCorrectors 1; consistent yes; residualControl { p 1e-4; U 1e-4; "(k|omega)" 1e-4; } }\nrelaxationFactors { equations { U 0.9; ".*" 0.9; } }\n` });
  files.push({ name: 'constant/transportProperties', text: hdr('dictionary', 'transportProperties') + `\ntransportModel Newtonian;\nnu [0 2 -1 0 0 0 0] ${nu};\n` });
  files.push({ name: 'constant/turbulenceProperties', text: hdr('dictionary', 'turbulenceProperties') + `\nsimulationType RAS;\nRAS { RASModel kOmegaSST; turbulence on; printCoeffs on; }\n` });
  const bc = (cls, dim, internal, inlet, wall) => hdr(cls, '', '0').replace('object ;', 'object field;') + `\ndimensions [${dim}];\ninternalField uniform ${internal};\nboundaryField\n{\n    inlet { type fixedValue; value uniform ${inlet}; }\n    outlet { ${cls === 'volScalarField' && dim === '0 2 -2 0 0 0 0' && internal === '0' ? 'type fixedValue; value uniform 0;' : 'type zeroGradient;'} }\n    sides { type symmetryPlane; }\n    blade { ${wall} }\n}\n`;
  files.push({ name: '0/U', text: bc('volVectorField', '0 1 -1 0 0 0 0', `(${f(V)} 0 0)`, `(${f(V)} 0 0)`, 'type noSlip;').replace('type zeroGradient;', 'type inletOutlet; inletValue uniform (0 0 0); value uniform (' + f(V) + ' 0 0);') });
  files.push({ name: '0/p', text: bc('volScalarField', '0 2 -2 0 0 0 0', '0', '0', 'type zeroGradient;').replace('inlet { type fixedValue; value uniform 0; }', 'inlet { type zeroGradient; }') });
  files.push({ name: '0/k', text: bc('volScalarField', '0 2 -2 0 0 0 0', f(k), f(k), `type kqRWallFunction; value uniform ${f(k)};`).replace('type zeroGradient;', 'type zeroGradient;') });
  files.push({ name: '0/omega', text: bc('volScalarField', '0 0 -1 0 0 0 0', f(om), f(om), `type omegaWallFunction; value uniform ${f(om)};`) });
  files.push({ name: '0/nut', text: bc('volScalarField', '0 2 -1 0 0 0 0', '0', '0', 'type nutkWallFunction; value uniform 0;').replace('inlet { type fixedValue; value uniform 0; }', 'inlet { type calculated; value uniform 0; }').replace('outlet { type zeroGradient; }', 'outlet { type calculated; value uniform 0; }') });
  for (const x of files) if (x.name.startsWith('0/')) x.text = x.text.replace('object field;', 'object ' + x.name.slice(2) + ';');
  files.push({ name: 'Allrun', text: `#!/bin/sh\ncd "\${0%/*}" || exit 1\n# STL 為 mm,先縮放成 m\nsurfaceTransformPoints -scale '(0.001 0.001 0.001)' ${'${PWD}'}/constant/triSurface/${stlName} constant/triSurface/${stlName}\nblockMesh\nsnappyHexMesh -overwrite\nsimpleFoam\n` });
  files.push({ name: 'README.txt', text: `OpenFOAM 案例骨架(由風力機葉片設計與虛擬風洞匯出)\n\n內容:單一葉片 STL(constant/triSurface/${stlName},單位 mm)、blockMesh 外域(上游 2R、下游 4R、側向對稱,R=${f(R)} m)、snappyHexMesh、simpleFoam + kOmegaSST、入流 ${f(V)} m/s、forces 函式物件。\n${omega ? `設計尖速比 ${opt.lam},對應轉速約 ${f(omega)} rad/s;本骨架為靜止葉片(無 MRF/旋轉座標系),要算旋轉轉子需自行加入 MRFProperties 與旋轉區。\n` : ''}\n限制(請誠實看待):\n- 這只是未經驗證的起手骨架,網格、邊界層(addLayers 已關閉)、湍流參數(k/omega 依 5% 紊流與 0.1R 長度尺度估計)都需依案例調整。\n- 適用 OpenFOAM v2012+/OpenFOAM.org 8+ 的語法差異請自行確認;locationInMesh 點需在流體區內。\n- 本網頁不會讀回 CFD 結果。\n\n使用:cd 此資料夾,執行 ./Allrun。\n` });
  return files;
}
