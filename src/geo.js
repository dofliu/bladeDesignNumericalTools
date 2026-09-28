/* ===== Geometry: lofted blade meshes, STL, ZIP ===== */
const GEO = (function () {
  const PIVOT = 0.3; // pitch axis at 30% chord
  function loop(af) {
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
  function loft(sections, capEnds) {
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
  function hawtBlade(rows, afs, Rhub, pitch) {
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
  function vawtBlade(slicesFn, af, c, pitchDeg, phase, H, y0) {
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
  function merge(meshes) {
    let np = 0, ni = 0; for (const m of meshes) { np += m.pos.length; ni += m.idx.length; }
    const pos = new Float32Array(np), idx = new Uint32Array(ni);
    let po = 0, io = 0;
    for (const m of meshes) { pos.set(m.pos, po); for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + po / 3; po += m.pos.length; io += m.idx.length; }
    return { pos, idx };
  }
  function rotX(mesh, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), p = new Float32Array(mesh.pos);
    for (let i = 0; i < p.length; i += 3) { const y = p[i + 1], z = p[i + 2]; p[i + 1] = c * y - s * z; p[i + 2] = s * y + c * z; }
    return { pos: p, idx: mesh.idx };
  }
  function stl(mesh, name) {
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
  function polygonMoments(ptsIn) {
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
  function offsetPolygon(ptsIn, t) {
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
  function sectionProperties(af, chord, thickness) {
    const pts = loop(af);
    const outer = polygonMoments(pts);
    const inner = polygonMoments(offsetPolygon(pts, thickness / chord));
    const combined = inner.area <= 0 || inner.area >= outer.area * 0.98 ? outer : {
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
  // Default shell thickness for a section of the given chord (metres), used until per-station
  // thickness/material becomes an adjustable field: 2% of chord, clamped to a sane build range.
  function defaultShellThickness(chord) { return Math.min(Math.max(0.02 * chord, 0.0015), 0.01); }

  /* ---------- Spanwise structural loads (flatwise/edgewise bending, centrifugal tension) ----------
   * Blade treated as a cantilever fixed at the root. Distributed loads are given per row (one
   * BEM annulus each); a row's own segment (r, dr) supplies both its load and its integration
   * weight, so the same `rows` array used to design/analyse the blade also drives the beam. */
  // Cantilever bending moment M(r) from a spanwise distributed load w (N/m, root->tip order),
  // by summing every station's lumped load (w_j*dr_j) about the arm to station i.
  function beamMoment(rows, w) {
    const n = rows.length, M = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i; j < n; j++) m += Math.max(rows[j].r - rows[i].r, 0) * w[j] * rows[j].dr;
      M[i] = m;
    }
    return M;
  }
  // Cumulative axial (centrifugal) tension F(r) from a spanwise mass-per-length distribution.
  function axialForce(rows, massPerLen, omega) {
    const n = rows.length, F = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let f = 0;
      for (let j = i; j < n; j++) f += massPerLen[j] * omega * omega * rows[j].r * rows[j].dr;
      F[i] = f;
    }
    return F;
  }
  // Euler-Bernoulli deflection v(r) from curvature M/EI, integrated from the fixed root
  // (v=0, slope=0) outward by the trapezoidal rule.
  function beamDeflection(rows, M, EI) {
    const n = rows.length, slope = new Array(n).fill(0), v = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      const dr = rows[i].r - rows[i - 1].r;
      const k0 = M[i - 1] / EI[i - 1], k1 = M[i] / EI[i];
      slope[i] = slope[i - 1] + 0.5 * (k0 + k1) * dr;
      v[i] = v[i - 1] + 0.5 * (slope[i - 1] + slope[i]) * dr;
    }
    return v;
  }
  // Full spanwise structural pass for one blade: flatwise + edgewise bending moment, centrifugal
  // tension, deflection and combined stress at every row, from a BEM design-point solution.
  //   rows: [{r, c, dr}], afs: airfoil per row, elems: BEM `detail` per row {phi, cl, cd, W} (deg),
  //   rhoAir, omega (rad/s), mat: {rho, fill, E, allow}, thicknessFn(chord)->m (defaults above).
  function bladeStructuralLoads(rows, afs, elems, rhoAir, omega, mat, thicknessFn) {
    thicknessFn = thicknessFn || defaultShellThickness;
    const n = rows.length;
    const sec = rows.map((row, i) => sectionProperties(afs[i], row.c, thicknessFn(row.c)));
    const massPerLen = sec.map(s => mat.rho * s.area);
    const wFlap = rows.map((row, i) => {
      const phi = elems[i].phi * Math.PI / 180, q = 0.5 * rhoAir * elems[i].W * elems[i].W;
      const cn = elems[i].cl * Math.cos(phi) + elems[i].cd * Math.sin(phi);
      return q * row.c * cn;
    });
    const wEdge = rows.map((row, i) => {
      const phi = elems[i].phi * Math.PI / 180, q = 0.5 * rhoAir * elems[i].W * elems[i].W;
      const ct = elems[i].cl * Math.sin(phi) - elems[i].cd * Math.cos(phi);
      return q * row.c * ct;
    });
    const Mflap = beamMoment(rows, wFlap), Medge = beamMoment(rows, wEdge);
    const Fax = axialForce(rows, massPerLen, omega);
    const EIflap = sec.map(s => mat.E * s.Ixx);
    const defl = beamDeflection(rows, Mflap, EIflap);
    const out = [];
    for (let i = 0; i < n; i++) {
      const sFlap = sec[i].Ixx > 0 ? Mflap[i] * sec[i].yMax / sec[i].Ixx : 0;
      const sEdge = sec[i].Iyy > 0 ? Medge[i] * sec[i].xMax / sec[i].Iyy : 0;
      const sAxial = sec[i].area > 0 ? Fax[i] / sec[i].area : 0;
      const sigma = Math.abs(sFlap) + Math.abs(sEdge) + sAxial; // conservative superposition
      out.push({
        r: rows[i].r, area: sec[i].area, Mflap: Mflap[i], Medge: Medge[i], Fax: Fax[i],
        defl: defl[i], stressFlap: sFlap, stressEdge: sEdge, stressAxial: sAxial, stress: sigma,
        safety: sigma > 0 ? mat.allow / sigma : Infinity,
      });
    }
    return out;
  }

  // store-only ZIP
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { // [{name, text}]
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
  return {
    loop, loft, hawtBlade, vawtBlade, merge, rotX, stl, zip, PIVOT, polygonMoments, offsetPolygon, sectionProperties,
    defaultShellThickness, beamMoment, axialForce, beamDeflection, bladeStructuralLoads,
  };
})();
if (typeof module !== 'undefined') module.exports = GEO;
