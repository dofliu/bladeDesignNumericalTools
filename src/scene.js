/* ===== 3D wind tunnel scene ===== */
const Scene3D = (function () {
  let renderer, scene, camera, host, rotor, nacelle, turbineRoot, tunnel, particles, pGeo, pVel, arrow, ring, lights = {};
  let orbit = { th: Math.PI - 0.75, ph: 0.32, dist: 8, target: new THREE.Vector3(0, 1.5, 0) };
  let dims = { R: 1.5, hubY: 2, kind: 'HAWT', H: 2 };
  const NP = 1400;
  let pState = null;
  let bladeMat, metalMat, darkMat;

  function colors() {
    const c = n => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888');
    return { bg: c('--scene-bg'), floor: c('--scene-floor'), grid: c('--scene-grid'), blade: c('--blade'), accent: c('--accent'), signal: c('--signal'), ink: c('--ink') };
  }
  function init(el) {
    host = el;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
    lights.h = new THREE.HemisphereLight(0xffffff, 0x445566, 0.85); scene.add(lights.h);
    lights.d = new THREE.DirectionalLight(0xffffff, 0.75); lights.d.position.set(-6, 10, 5); scene.add(lights.d);
    bladeMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa6ad, roughness: 0.35, metalness: 0.6 });
    darkMat = new THREE.MeshStandardMaterial({ color: 0x55616a, roughness: 0.6, metalness: 0.3 });
    turbineRoot = new THREE.Group(); scene.add(turbineRoot);
    tunnel = new THREE.Group(); scene.add(tunnel);
    buildFloor();
    buildParticles();
    applyTheme();
    bindOrbit(el);
    new ResizeObserver(resize).observe(el);
    resize();
  }
  function applyTheme() {
    const c = colors();
    scene.background = c.bg;
    bladeMat.color = c.blade;
    if (ring) ring.material.color = c.ink;
    if (particles) particles.material.needsUpdate = true;
    if (floorMesh) floorMesh.material.color = c.floor;
    if (gridHelper) { gridHelper.material.color = c.grid; }
    if (arrow) arrow.setColor(c.accent);
  }
  let floorMesh, gridHelper, ticks;
  function buildFloor() {
    floorMesh = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0xdde3e6, roughness: 1 }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.y = -0.002; scene.add(floorMesh);
    gridHelper = new THREE.PolarGridHelper(6, 24, 6, 72, 0x999999, 0x999999);
    gridHelper.material.transparent = true; gridHelper.material.opacity = 0.35;
    scene.add(gridHelper);
    ring = new THREE.Mesh(new THREE.RingGeometry(5.9, 6.0, 128), new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);
    arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-7.2, 0.05, 0), 1.6, 0x1f5fa8, 0.5, 0.3);
    tunnel.add(arrow);
    // tunnel frame (test section outline)
    const mat = new THREE.LineBasicMaterial({ color: 0x7f8c93, transparent: true, opacity: 0.35 });
    const g = new THREE.BufferGeometry();
    const L = 7, W = 4.2, Ht = 5;
    const v = [];
    for (const x of [-L, L]) { v.push(x, 0, -W, x, Ht, -W, x, Ht, -W, x, Ht, W, x, Ht, W, x, 0, W); }
    for (const [y, z] of [[Ht, -W], [Ht, W], [0, -W], [0, W]]) v.push(-L, y, z, L, y, z);
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    tunnel.userData.frame = new THREE.LineSegments(g, mat); tunnel.add(tunnel.userData.frame);
  }
  function buildParticles() {
    pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(NP * 3), col = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
    particles = new THREE.Points(pGeo, mat);
    tunnel.add(particles);
    pState = new Float32Array(NP * 3); // local coords in tunnel frame (x along wind)
    for (let i = 0; i < NP; i++) respawn(i, true);
  }
  let box = { L: 7, W: 4.2, H: 5 };
  function respawn(i, anywhere) {
    pState[i * 3] = anywhere ? (Math.random() * 2 - 1) * box.L : -box.L;
    pState[i * 3 + 1] = Math.random() * box.H;
    pState[i * 3 + 2] = (Math.random() * 2 - 1) * box.W;
  }
  function setScale(R, hubY, kind, H) {
    dims = { R, hubY, kind, H };
    const s = Math.max(R, kind === 'HAWT' ? R : Math.max(R, H / 2));
    box = { L: Math.max(4, 4.2 * s), W: Math.max(2.5, 2.1 * s), H: Math.max(3, (kind === 'HAWT' ? hubY + R : H + 0.6) * 1.35) };
    const f = tunnel.userData.frame; const v = [];
    const L = box.L, W = box.W, Ht = box.H;
    for (const x of [-L, L]) v.push(x, 0, -W, x, Ht, -W, x, Ht, -W, x, Ht, W, x, Ht, W, x, 0, W);
    for (const [y, z] of [[Ht, -W], [Ht, W], [0, -W], [0, W]]) v.push(-L, y, z, L, y, z);
    f.geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const rr = Math.max(1.4 * s, 1.6);
    scene.remove(gridHelper); scene.remove(ring);
    gridHelper = new THREE.PolarGridHelper(rr, 36, 4, 72, 0x999999, 0x999999); gridHelper.material.transparent = true; gridHelper.material.opacity = 0.35; scene.add(gridHelper);
    ring = new THREE.Mesh(new THREE.RingGeometry(rr * 0.985, rr, 128), new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);
    arrow.position.set(-L * 0.92, 0.05, 0); arrow.setLength(Math.max(0.8, 0.35 * s), 0.3 * Math.max(0.8, 0.35 * s), 0.18 * Math.max(0.8, 0.35 * s));
    particles.material.size = Math.max(0.03, 0.03 * s);
    orbit.target.set(0, kind === 'HAWT' ? hubY * 0.8 : hubY * 0.7 + H * 0.5, 0);
    orbit.dist = Math.max(4, kind === 'HAWT' ? 3.8 * s + hubY * 0.6 : 3.2 * s + (hubY + H) * 1.05);
    for (let i = 0; i < NP; i++) respawn(i, true);
    applyTheme();
  }
  function clearTurbine() {
    while (turbineRoot.children.length) {
      const o = turbineRoot.children.pop();
      o.traverse(n => { if (n.geometry) n.geometry.dispose(); });
    }
  }
  function meshFrom(m, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  // HAWT: bladeMesh in blade frame (along +Y); B blades
  function buildHAWT(bladeMesh, B, R, Rhub, hubY) {
    clearTurbine();
    nacelle = new THREE.Group(); nacelle.position.y = hubY; turbineRoot.add(nacelle);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.03, R * 0.028), Math.max(0.05, R * 0.045), hubY, 20), metalMat);
    tower.position.y = hubY / 2; turbineRoot.add(tower);
    const nl = Math.max(0.35, R * 0.35), nr = Math.max(0.07, Rhub * 0.75);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(nr, nr * 0.85, nl, 24), darkMat);
    body.rotation.z = Math.PI / 2; body.position.x = nl / 2 + Rhub * 0.3; nacelle.add(body);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(R * 0.35, R * 0.22, 0.01), darkMat); fin.position.set(nl + R * 0.2, R * 0.06, 0); nacelle.add(fin);
    rotor = new THREE.Group(); nacelle.add(rotor);
    const spinner = new THREE.Mesh(new THREE.SphereGeometry(Rhub * 1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), metalMat);
    spinner.rotation.z = Math.PI / 2; spinner.scale.set(1, 1.5, 1); rotor.add(spinner);
    const hubC = new THREE.Mesh(new THREE.CylinderGeometry(Rhub * 1.05, Rhub * 1.05, Rhub * 0.6, 24), metalMat);
    hubC.rotation.z = Math.PI / 2; hubC.position.x = Rhub * 0.3; rotor.add(hubC);
    for (let b = 0; b < B; b++) {
      const m = meshFrom(bladeMesh, bladeMat);
      const g = new THREE.Group(); g.rotation.x = 2 * Math.PI * b / B; g.add(m);
      if (b === 0) { const tip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, R * 0.012), 8, 6), new THREE.MeshBasicMaterial({ color: 0xd23c2a })); tip.position.y = R * 0.97; g.add(tip); }
      rotor.add(g);
    }
  }
  function buildVAWT(bladeMeshes, opts) {
    clearTurbine(); nacelle = null;
    const { H, R, y0, struts, kind } = opts;
    rotor = new THREE.Group(); turbineRoot.add(rotor);
    const shaftR = Math.max(0.02, R * 0.035);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, y0 + H + 0.1 * H, 16), metalMat);
    shaft.position.y = (y0 + H + 0.1 * H) / 2; turbineRoot.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(shaftR * 3.5, shaftR * 4.5, Math.min(0.3, y0 * 0.4), 20), darkMat);
    base.position.y = Math.min(0.3, y0 * 0.4) / 2; turbineRoot.add(base);
    for (const m of bladeMeshes) rotor.add(meshFrom(m, bladeMat));
    for (const s of (struts || [])) { // {ang, y, r}
      const len = s.r;
      const st = new THREE.Mesh(new THREE.BoxGeometry(len, Math.max(0.01, H * 0.012), Math.max(0.03, s.w || R * 0.06)), darkMat);
      st.position.set(Math.cos(s.ang) * len / 2, s.y, -Math.sin(s.ang) * len / 2); st.rotation.y = s.ang; rotor.add(st);
    }
    const mark = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.015, R * 0.02), 8, 6), new THREE.MeshBasicMaterial({ color: 0xd23c2a }));
    if (opts.markPos) { mark.position.set(...opts.markPos); rotor.add(mark); }
  }
  function buildSavonius(o) {
    clearTurbine(); nacelle = null;
    const { R, H, B, overlap, y0, endPlates } = o;
    rotor = new THREE.Group(); turbineRoot.add(rotor);
    const d = 2 * R / (2 - overlap), r = d / 2, e = overlap * d;
    const shaftR = Math.max(0.015, R * 0.03);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, y0 + H * 1.1, 16), metalMat); shaft.position.y = (y0 + H * 1.1) / 2; turbineRoot.add(shaft);
    for (let b = 0; b < B; b++) {
      const ang = 2 * Math.PI * b / B;
      const g = new THREE.Group(); g.rotation.y = ang; g.position.y = y0 + H / 2;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 36, 1, true, 0, Math.PI), bladeMat);
      cyl.position.x = (r - e / 2) * (B === 2 ? 1 : 0.8);
      g.add(cyl); rotor.add(g);
    }
    if (endPlates) for (const y of [y0, y0 + H]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, Math.max(0.006, R * 0.012), 48), new THREE.MeshStandardMaterial({ color: 0xb9c3c8, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.8 }));
      p.position.y = y; rotor.add(p);
    }
    const mark = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.015, R * 0.03), 8, 6), new THREE.MeshBasicMaterial({ color: 0xd23c2a }));
    mark.position.set(R, y0 + H, 0); rotor.add(mark);
  }
  // per-frame update
  function frame(st, dt) {
    // st: {rotorAngle, yawDeg, windDeg, V, induction a, kind}
    if (rotor) { if (dims.kind === 'HAWT') rotor.rotation.x = st.rotorAngle; else rotor.rotation.y = st.rotorAngle; }
    if (nacelle) nacelle.rotation.y = -st.yawDeg * Math.PI / 180;
    tunnel.rotation.y = -st.windDeg * Math.PI / 180;
    // particles in tunnel frame; turbine at origin. Compute axis relation
    const pos = pGeo.attributes.position.array, col = pGeo.attributes.color.array;
    const V = Math.max(0.05, st.V), a = st.a || 0;
    const R = dims.R, hub = dims.hubY;
    const cSlow = st.cSlow, cFast = st.cFast;
    const mis = (st.windDeg - st.yawDeg) * Math.PI / 180; // rotor axis relative to wind (HAWT)
    const cm = Math.cos(mis), sm = Math.sin(mis);
    const vis = st.visScale || 1;
    for (let i = 0; i < NP; i++) {
      let x = pState[i * 3], y = pState[i * 3 + 1], z = pState[i * 3 + 2];
      let f = 1;
      if (dims.kind === 'HAWT') {
        // radial distance from rotor axis line (axis direction in tunnel frame: (cm, 0, -sm)... approx use lateral dist)
        const ax = x * cm - z * sm;
        const lat = Math.hypot(y - hub, -x * sm - z * cm);
        const wakeR = R * (1 + 0.35 * Math.max(0, Math.tanh(ax / R)));
        if (lat < wakeR) {
          const prof = 1 - Math.pow(lat / wakeR, 6);
          f = 1 - a * cm * (1 + Math.tanh(ax / (0.6 * R))) * prof;
        }
      } else {
        const lat = Math.abs(z), h = y;
        const wakeR = R * (1 + 0.25 * Math.max(0, Math.tanh(x / R)));
        if (lat < wakeR && h > st.y0 - 0.1 && h < st.y0 + dims.H + 0.1) {
          const prof = 1 - Math.pow(lat / wakeR, 6);
          f = 1 - a * (1 + Math.tanh(x / (0.6 * R))) * prof;
        }
      }
      f = Math.max(0.08, f);
      x += V * f * dt * vis;
      const tj = st.TI || 0;
      y += (Math.random() - 0.5) * tj * V * dt * 2 * vis; z += (Math.random() - 0.5) * tj * V * dt * 2 * vis;
      if (x > box.L || y < 0 || y > box.H || Math.abs(z) > box.W) { respawn(i, false); x = pState[i * 3]; y = pState[i * 3 + 1]; z = pState[i * 3 + 2]; }
      pState[i * 3] = x; pState[i * 3 + 1] = y; pState[i * 3 + 2] = z;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const w = Math.min(1, Math.max(0, (1 - f) * 1.8));
      col[i * 3] = cFast.r + (cSlow.r - cFast.r) * w; col[i * 3 + 1] = cFast.g + (cSlow.g - cFast.g) * w; col[i * 3 + 2] = cFast.b + (cSlow.b - cFast.b) * w;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    const t = orbit.target, d = orbit.dist;
    camera.position.set(t.x + d * Math.cos(orbit.ph) * Math.cos(orbit.th), t.y + d * Math.sin(orbit.ph), t.z + d * Math.cos(orbit.ph) * Math.sin(orbit.th));
    camera.lookAt(t);
    renderer.render(scene, camera);
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function bindOrbit(el) {
    const cv = renderer.domElement;
    cv.style.touchAction = 'none';
    const pts = new Map(); let lastPinch = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      if (pts.size === 1) {
        if (e.buttons === 2 || e.shiftKey) { // pan
          const s = orbit.dist * 0.0015;
          const right = new THREE.Vector3(-Math.sin(orbit.th), 0, Math.cos(orbit.th));
          orbit.target.addScaledVector(right, -dx * s); orbit.target.y += dy * s;
        } else { orbit.th += dx * 0.006; orbit.ph = Math.max(-0.1, Math.min(1.45, orbit.ph + dy * 0.005)); }
      } else if (pts.size === 2) {
        const arr = [...pts.values()]; const dNow = Math.hypot(arr[0][0] - arr[1][0], arr[0][1] - arr[1][1]);
        if (lastPinch) orbit.dist = Math.max(1, Math.min(80, orbit.dist * lastPinch / dNow));
        lastPinch = dNow;
      }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) lastPinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); orbit.dist = Math.max(1, Math.min(80, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  }
  function view(name) {
    if (name === 'front') { orbit.th = Math.PI; orbit.ph = 0.05; }
    else if (name === 'side') { orbit.th = -Math.PI / 2; orbit.ph = 0.05; }
    else if (name === 'top') { orbit.th = -Math.PI / 2; orbit.ph = 1.45; }
    else { orbit.th = -0.75 + Math.PI; orbit.ph = 0.32; }
  }
  return { init, buildHAWT, buildVAWT, buildSavonius, frame, setScale, applyTheme, view, colors };
})();
