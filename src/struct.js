/* ===== STRUCT core: thin-wall section properties (area, centroid, moments of inertia) ===== */
(function (G) {
  'use strict';

  // pts: closed-loop polygon, array of [x,y] or {x,y}; auto-closes if last point != first.
  // t: wall thickness (uniform, same length unit as pts), representing a thin shell following the perimeter.
  // Segments are treated as thin rectangles (length ds, thickness t); each segment's own moment of
  // inertia about its centroid is combined with the parallel-axis term to the section centroid, so the
  // result is exact for straight-sided polygons and converges for curved outlines as the point count grows.
  function sectionProps(pts, t) {
    const P = pts.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]);
    if (P.length < 2) return { area: 0, perimeter: 0, xc: 0, yc: 0, Ixx: 0, Iyy: 0, Ixy: 0 };
    if (P[0][0] !== P[P.length - 1][0] || P[0][1] !== P[P.length - 1][1]) P.push(P[0]);

    const seg = [];
    let perimeter = 0, area = 0, Mx = 0, My = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      const dx = x1 - x0, dy = y1 - y0, ds = Math.hypot(dx, dy);
      if (ds === 0) continue;
      const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      seg.push({ ds, dx, dy, xm, ym });
      perimeter += ds;
      area += t * ds;
      Mx += t * ds * ym;
      My += t * ds * xm;
    }
    if (area === 0) return { area: 0, perimeter, xc: 0, yc: 0, Ixx: 0, Iyy: 0, Ixy: 0 };
    const xc = My / area, yc = Mx / area;

    let Ixx = 0, Iyy = 0, Ixy = 0;
    for (const s of seg) {
      const a = t * s.ds;
      const dyc = s.ym - yc, dxc = s.xm - xc;
      Ixx += a * s.dy * s.dy / 12 + a * dyc * dyc;
      Iyy += a * s.dx * s.dx / 12 + a * dxc * dxc;
      Ixy += a * s.dx * s.dy / 12 + a * dxc * dyc;
    }
    return { area, perimeter, xc, yc, Ixx, Iyy, Ixy };
  }

  const API = { sectionProps };
  if (typeof module !== 'undefined') module.exports = API; else G.STRUCT = API;
})(this);
