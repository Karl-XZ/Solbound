/* =====================================================================
   Cabin 3D — the living module rendered with the exterior's pipeline:
   MeshToonMaterial (3-step ramp) + depth/colour ink edges + halftone +
   grain + vignette (same post shader as js/world.js).
   Public API (used only by js/habitat.js):
     Cabin3D.mount(container, tags)   tags: { key: HTMLElement }
     Cabin3D.setActive(bool)          render loop on/off
     Cabin3D.update(g)                game state -> water, sol, power, weather, moods
     Cabin3D.setMood(mood) / setSamples(n) / setLow(key, bool)
   ===================================================================== */
window.Cabin3D = (() => {
  const P = { cream: 0xf4e7c8, mustard: 0xe6a83f, orange: 0xd9692f, rust: 0xb8452a, brick: 0x8e2f22, maroon: 0x5a1d1d,
    night: 0x2b1a24, navy: 0x1f2c3f, teal: 0x3f8f93, tealL: 0x8cc7c3, tealD: 0x2a5f68, green: 0x7fae5b };
  const FONT = '"Nunito",system-ui,"Segoe UI",sans-serif', DISP = '"Fredoka","Nunito",system-ui,sans-serif';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let renderer, rt, postM, postS, postC, scene, camera, container, tags = {}, active = false, raf = 0, W = 1, H = 1, PR = 1;
  let grad, M, hovered = null, wx = 'day', mood = 'happy', samplesShown = false;
  const objects = {}, low = {}, anchors = {}, dyn = {}, lights = {};
  const state = { sol: -1, gen: -1, water: -1 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- helpers ---------- */
  const toon = (color, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, o));
  const basic = (color, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, o));
  function mesh(geo, mat, par) { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; par && par.add(o); return o; }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    t.userData = { redraw: (...a) => { const x = c.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h, ...a); t.needsUpdate = true; } };
    t.userData.redraw(); return t;
  }
  const R = 6.5, CY = 2.5, HL = 22, T0 = .4 * Math.PI, TL = 1.2 * Math.PI;
  const wallZ = y => -Math.sqrt(R * R - (y - CY) ** 2);
  const wallTilt = y => Math.asin((y - CY) / R);
  function onWall(obj, x, y, inset = .12) { obj.position.set(x, y, wallZ(y) + inset); obj.rotation.x = wallTilt(y); scene.add(obj); return obj; }
  // each interactive object owns its materials so hover/alert glow stays local
  function own(key, group) {
    group.userData.key = key; objects[key] = group;
    group.traverse(o => { if (o.isMesh) { o.userData.key = key; if (o.material.isMeshToonMaterial) { o.material = o.material.clone(); o.userData.toon = true; } } });
  }

  /* ---------- window view: the same Mars as outside ---------- */
  function drawMars(x, w, h, kind) {
    const sky = { day: ['#f2c088', '#eba46c', '#f7cf98'], storm: ['#8d5232', '#a9603a', '#bd6e3c'], night: ['#1f2c3f', '#3a2a45', '#6a3a42'] }[kind];
    const g = x.createLinearGradient(0, 0, 0, h * .7); g.addColorStop(0, sky[0]); g.addColorStop(.7, sky[1]); g.addColorStop(1, sky[2]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const N = kind === 'night'; x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = '#2b1a24';
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (N) { x.fillStyle = '#fff4dc'; for (let i = 0; i < 70; i++) { x.beginPath(); x.arc(rnd() * w, rnd() * h * .55, rnd() * 2.4 + .6, 0, 7); x.fill(); } x.fillStyle = '#8cc7c3'; x.beginPath(); x.arc(w * .7, h * .2, 7, 0, 7); x.fill(); }
    else { x.fillStyle = 'rgba(255,241,201,.35)'; x.beginPath(); x.arc(w * .72, h * .22, 60, 0, 7); x.fill(); x.fillStyle = kind === 'storm' ? 'rgba(255,244,214,.35)' : '#fff4d6'; x.beginPath(); x.arc(w * .72, h * .22, 28, 0, 7); x.fill(); }
    const poly = (pts, fill, stroke = true) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a * w, b * h) : x.moveTo(a * w, b * h)); x.closePath(); x.fillStyle = fill; x.fill(); stroke && x.stroke(); };
    poly([[0, .55], [.08, .5], [.18, .51], [.22, .45], [.4, .45], [.45, .51], [.6, .52], [.68, .47], [.84, .46], [.9, .53], [1, .55], [1, 1], [0, 1]], N ? '#4a2a38' : '#c98463', false);
    poly([[0, .6], [.12, .56], [.3, .58], [.34, .54], [.52, .54], [.56, .59], [.74, .61], [.88, .57], [1, .58], [1, 1], [0, 1]], N ? '#3d2230' : '#a9513a');
    x.beginPath(); x.moveTo(0, h * .66); x.quadraticCurveTo(w * .5, h * .62, w, h * .65); x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.fillStyle = N ? '#5a2d2d' : '#c9663a'; x.fill(); x.stroke();
    x.fillStyle = 'rgba(43,26,36,.28)'; for (let yy = h * .74; yy < h; yy += 10) for (let xx = ((yy / 10) % 2) * 5; xx < w; xx += 10) { x.beginPath(); x.arc(xx, yy, 2.2 * (yy - h * .7) / (h * .3), 0, 7); x.fill(); }
    x.lineWidth = 4; poly([[.17, .66], [.17, .43], [.185, .37], [.2, .43], [.2, .66]], '#f4e7c8'); poly([[.17, .6], [.145, .66], [.17, .66]], '#d9692f'); poly([[.2, .6], [.225, .66], [.2, .66]], '#d9692f');
    x.fillStyle = '#d9692f'; x.fillRect(w * .17, h * .5, w * .03, h * .025);
    x.fillStyle = '#f4e7c8'; x.fillRect(w * .3, h * .645, w * .2, h * .02); x.strokeRect(w * .3, h * .645, w * .2, h * .02);
    x.beginPath(); x.arc(w * .33, h * .67, w * .075, Math.PI, 0); x.closePath(); x.fillStyle = 'rgba(140,199,195,.85)'; x.fill(); x.stroke();
    x.fillStyle = '#7fae5b'; for (const [a, r] of [[.31, 12], [.345, 15]]) { x.beginPath(); x.arc(a * w, h * .66, r, 0, 7); x.fill(); x.lineWidth = 2.5; x.stroke(); }
    x.lineWidth = 4; x.beginPath(); x.arc(w * .5, h * .67, w * .055, Math.PI, 0); x.closePath(); x.fillStyle = '#f4e7c8'; x.fill(); x.stroke();
    if (N) { x.fillStyle = '#ffd27a'; x.fillRect(w * .49, h * .64, 12, 8); x.fillRect(w * .32, h * .64, 10, 6); }
    for (let i = 0; i < 3; i++) { const a = .62 + i * .11; poly([[a, .66], [a + .03, .62], [a + .12, .62], [a + .09, .66]], '#2a5f68'); }
    for (const [a, s] of [[.08, 1], [.42, .7], [.86, .9]]) poly([[a, .97], [a + .02 * s, .9], [a + .07 * s, .89], [a + .1 * s, .97]], N ? '#3d2230' : '#8e2f22');
    if (kind === 'storm') { x.fillStyle = 'rgba(196,116,63,.5)'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(242,192,136,.8)'; x.lineWidth = 5; x.lineCap = 'round'; for (let i = 0; i < 26; i++) { const a = rnd() * w, b = rnd() * h; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 40 + rnd() * 60, b + 6); x.stroke(); } }
    x.strokeStyle = 'rgba(255,246,223,.28)'; x.lineWidth = 22; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * .25, h * .1); x.lineTo(w * .1, h * .45); x.stroke(); x.lineWidth = 12; x.beginPath(); x.moveTo(w * .34, h * .08); x.lineTo(w * .2, h * .4); x.stroke();
  }
  function drawFace(x, w, h, m) {
    x.strokeStyle = '#2b1a24'; x.fillStyle = '#2b1a24'; x.lineCap = 'round'; x.lineWidth = 7;
    if (m === 'weak') { for (const cx of [78, 172]) { x.beginPath(); x.moveTo(cx - 20, 84); x.quadraticCurveTo(cx, 100, cx + 20, 84); x.stroke(); } }
    else for (const cx of [78, 172]) { x.beginPath(); x.ellipse(cx, m === 'sad' ? 90 : 84, 17, m === 'sad' ? 20 : 25, 0, 0, 7); x.fill(); x.fillStyle = '#fff8e6'; x.beginPath(); x.arc(cx + 5, m === 'sad' ? 82 : 74, 6, 0, 7); x.fill(); x.fillStyle = '#2b1a24'; }
    x.beginPath();
    if (m === 'sad') { x.moveTo(52, 44); x.lineTo(94, 32); x.moveTo(156, 32); x.lineTo(198, 44); } else { x.moveTo(52, 36); x.quadraticCurveTo(72, 24, 94, 34); x.moveTo(156, 34); x.quadraticCurveTo(178, 24, 198, 36); }
    x.stroke();
    if (m === 'happy') { x.fillStyle = '#fff8e6'; x.beginPath(); x.moveTo(88, 140); x.quadraticCurveTo(125, 192, 162, 140); x.quadraticCurveTo(125, 152, 88, 140); x.closePath(); x.fill(); x.lineWidth = 6; x.stroke(); }
    else if (m === 'sad') { x.lineWidth = 6; x.beginPath(); x.moveTo(98, 166); x.quadraticCurveTo(125, 140, 152, 166); x.stroke(); }
    else { x.lineWidth = 6; x.beginPath(); x.moveTo(96, 156); x.quadraticCurveTo(110, 148, 125, 156); x.quadraticCurveTo(140, 164, 154, 156); x.stroke(); x.fillStyle = '#8cc7c3'; x.beginPath(); x.moveTo(214, 40); x.quadraticCurveTo(200, 66, 214, 70); x.quadraticCurveTo(228, 66, 214, 40); x.fill(); x.lineWidth = 3; x.stroke(); }
    x.fillStyle = 'rgba(217,105,47,.45)'; for (const cx of [40, 210]) { x.beginPath(); x.arc(cx, 130, 16, 0, 7); x.fill(); }
  }

  /* ---------- build ---------- */
  function build() {
    const gd = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    grad = new THREE.DataTexture(gd, 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
    M = { cream: toon(P.cream), white: toon(0xfbf3df), navy: toon(P.navy), mustard: toon(P.mustard), orange: toon(P.orange), rust: toon(P.rust),
      brick: toon(P.brick), teal: toon(P.teal), tealD: toon(P.tealD), tealL: toon(P.tealL), green: toon(P.green), ink: toon(P.night), skin: toon(0xecb98a), hair: toon(0x573d34),
      sand: toon(0xd8c7a2), glass: toon(P.tealL, { transparent: true, opacity: .45 }), water: toon(P.teal, { transparent: true, opacity: .85 }) };
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xc4694a);

    /* hull */
    const hullTex = canvasTex(1024, 512, (x, w, h) => {
      x.fillStyle = '#f1e2bf'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(43,26,36,.35)'; x.lineWidth = 4;
      for (let i = 0; i <= w; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (let j = 0; j <= h; j += 96) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
      x.fillStyle = 'rgba(43,26,36,.4)'; for (let i = 0; i <= w; i += 128) for (let j = 0; j <= h; j += 96) for (const [a, b] of [[10, 10], [-10, 10], [10, -10], [-10, -10]]) { x.beginPath(); x.arc(i + a, j + b, 3, 0, 7); x.fill(); }
    });
    hullTex.wrapS = hullTex.wrapT = THREE.RepeatWrapping; hullTex.repeat.set(3, 2);
    const hull = mesh(new THREE.CylinderGeometry(R, R, HL, 64, 1, true, T0, TL), toon(0xffffff, { map: hullTex, side: THREE.DoubleSide }), scene);
    hull.rotation.z = Math.PI / 2; hull.position.y = CY; hull.castShadow = false;
    const cap = new THREE.Shape();
    for (let i = 0; i <= 48; i++) { const th = T0 + TL * i / 48, z = R * Math.cos(th), y = Math.max(0, R * Math.sin(th) + CY); i ? cap.lineTo(z, y) : cap.moveTo(z, y); }
    cap.lineTo(R * Math.cos(T0), 0);
    for (const s of [-1, 1]) { const m = mesh(new THREE.ShapeGeometry(cap), toon(0xe6d3a9, { side: THREE.DoubleSide }), scene); m.rotation.y = -Math.PI / 2; m.position.x = s * HL / 2; m.castShadow = false; }
    const arc = (r, tube, a0, a1, mat, x) => { const g = new THREE.Group(); const t = mesh(new THREE.TorusGeometry(r, tube, 8, 64, a1 - a0), mat, g); t.rotation.z = a0; t.castShadow = false; g.rotation.y = -Math.PI / 2; g.position.set(x, CY, 0); scene.add(g); return g; };
    const aFloor = Math.PI + Math.asin(CY / R);
    for (const x of [-7.4, -2.4, 3.2, 8.2]) arc(R - .12, .2, T0, aFloor, M.cream, x);
    { const y = CY + R * Math.sin(T0), z = R * Math.cos(T0); const rim = mesh(new THREE.BoxGeometry(HL, .35, .5), M.tealD, scene); rim.position.set(0, y - .1, z - .1); rim.castShadow = false; }
    const floorTex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#a85a3c'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(43,26,36,.55)'; x.lineWidth = 6; x.strokeRect(0, 0, w, h); x.lineWidth = 2; x.strokeStyle = 'rgba(43,26,36,.25)'; for (let i = 32; i < w; i += 32) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i, h - 16); x.stroke(); } });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(11, 7);
    mesh(new THREE.BoxGeometry(HL, .6, 14), toon(0xffffff, { map: floorTex }), scene).position.set(0, -.3, .9);
    mesh(new THREE.BoxGeometry(HL, .25, .25), M.mustard, scene).position.set(0, 0, 7.8);
    for (const [t0, tl, c] of [[1.02, .09, P.tealD], [.92, .025, P.teal]]) { const k = mesh(new THREE.CylinderGeometry(R - .05, R - .05, HL - .2, 64, 1, true, Math.PI * t0, Math.PI * tl), toon(c, { side: THREE.DoubleSide }), scene); k.rotation.z = Math.PI / 2; k.position.y = CY; k.castShadow = false; }
    for (const [y, r, mat] of [[6.3, .16, M.teal], [6.75, .1, M.mustard]]) { const p = mesh(new THREE.CylinderGeometry(r, r, HL, 10), mat, scene); p.rotation.z = Math.PI / 2; p.position.set(0, y, wallZ(y) + .35); p.castShadow = false; }
    dyn.lamp = mesh(new THREE.BoxGeometry(12, .14, .9), basic(0xeafaf6), scene); dyn.lamp.position.set(0, CY + R - .2, -.6); dyn.lamp.castShadow = false;
    const lampRim = mesh(new THREE.BoxGeometry(12.3, .1, 1.15), M.ink, scene); lampRim.position.set(0, CY + R - .1, -.6); lampRim.castShadow = false;

    /* observation window */
    const win = new THREE.Group();
    dyn.view = canvasTex(768, 768, (x, w, h) => drawMars(x, w, h, wx));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(2.15, 64), basic(0xffffff, { map: dyn.view })); glass.position.z = .02; win.add(glass);
    mesh(new THREE.TorusGeometry(2.25, .3, 12, 64), M.tealD, win);
    mesh(new THREE.TorusGeometry(2.0, .09, 8, 64), M.cream, win).position.z = .12;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mesh(new THREE.SphereGeometry(.09, 8, 6), M.cream, win).position.set(Math.cos(a) * 2.25, Math.sin(a) * 2.25, .3); }
    mesh(new THREE.BoxGeometry(1.8, .36, .1), M.ink, win).position.set(0, 2.85, 0);
    const ptxt = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .3), basic(0xffffff, { map: canvasTex(340, 60, (x, w, h) => { x.fillStyle = '#2b1a24'; x.fillRect(0, 0, w, h); x.fillStyle = '#e6a83f'; x.font = `800 30px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OBS · Window', w / 2, h / 2 + 2); }) }));
    ptxt.position.set(0, 2.85, .06); win.add(ptxt);
    onWall(win, .6, 3.9, .32); win.traverse(o => o.castShadow = false);
    lights.spot = new THREE.SpotLight(0xffc66e, 1.25, 30, .42, .35, 1.2); lights.spot.position.set(.6, 4.2, -6); lights.spot.target.position.set(1.4, 0, 3); scene.add(lights.spot, lights.spot.target);

    const hz = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e6a83f'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b1a24'; for (let i = -w; i < w * 2; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i + 20 - h, h); x.lineTo(i - h, h); x.closePath(); x.fill(); } });

    /* door */
    { const d = new THREE.Group();
      mesh(new THREE.RingGeometry(1.45, 1.9, 48), toon(0xffffff, { map: hz }), d);
      const leaf = mesh(new THREE.CylinderGeometry(1.45, 1.45, .25, 48), M.teal, d); leaf.rotation.x = Math.PI / 2;
      const port = mesh(new THREE.CylinderGeometry(.42, .42, .3, 32), basic(P.orange), d); port.rotation.x = Math.PI / 2; port.position.y = .75;
      mesh(new THREE.TorusGeometry(.45, .08, 8, 32), M.cream, d).position.set(0, .75, .16);
      mesh(new THREE.TorusGeometry(.55, .09, 8, 32), M.mustard, d).position.set(0, -.3, .25);
      for (const r of [0, Math.PI / 2]) { const s = mesh(new THREE.BoxGeometry(1.1, .1, .1), M.mustard, d); s.position.set(0, -.3, .25); s.rotation.z = r + .4; }
      mesh(new THREE.SphereGeometry(.16, 12, 8), basic(P.green), d).position.set(0, 2.15, .1);
      onWall(d, -5.4, 2.05, .2); own('door', d);
      const hzf = mesh(new THREE.BoxGeometry(3.4, .05, 1.2), toon(0xffffff, { map: hz }), scene); hzf.position.set(-5.4, .02, -5.3);
      anchors.door = V3(-5.4, 4.3, wallZ(4.3) + .5); }

    /* lab bench */
    { const b = new THREE.Group(); b.position.set(-8.6, 0, -5.0); scene.add(b);
      mesh(new THREE.BoxGeometry(2.6, 1.3, 1.2), M.tealD, b).position.y = .65;
      mesh(new THREE.BoxGeometry(2.8, .14, 1.35), M.mustard, b).position.y = 1.37;
      for (const x of [-.6, .6]) mesh(new THREE.BoxGeometry(.5, .08, .05), M.mustard, b).position.set(x, .9, .62);
      const ms = new THREE.Group(); ms.position.set(-.8, 1.44, 0); b.add(ms);
      mesh(new THREE.BoxGeometry(.5, .1, .4), M.cream, ms); mesh(new THREE.CylinderGeometry(.05, .05, .6, 8), M.ink, ms).position.y = .3;
      const tube = mesh(new THREE.CylinderGeometry(.1, .13, .55, 12), M.teal, ms); tube.position.set(.12, .62, 0); tube.rotation.z = .6;
      mesh(new THREE.BoxGeometry(.9, .08, .5), M.cream, b).position.set(.5, 1.48, 0);
      dyn.rocks = new THREE.Group(); b.add(dyn.rocks);
      for (const [x, s] of [[.3, .14], [.62, .12]]) mesh(new THREE.DodecahedronGeometry(s, 0), M.rust, dyn.rocks).position.set(x, 1.6, 0);
      mesh(new THREE.CylinderGeometry(.16, .12, .26, 10), M.orange, b).position.set(1.15, 1.57, .1);
      for (let i = 0; i < 3; i++) { const lf = mesh(new THREE.SphereGeometry(.13, 8, 6), M.green, b); lf.scale.set(1, .5, .6); lf.position.set(1.15 + (i - 1) * .1, 1.82 + (i % 2) * .08, .1); lf.rotation.z = (i - 1) * .7; }
      own('bench', b); anchors.bench = V3(-8.6, -.1, -4.3); }

    /* flip calendar */
    { const c = new THREE.Group();
      mesh(new THREE.BoxGeometry(1.7, 1.75, .14), M.cream, c);
      mesh(new THREE.BoxGeometry(1.7, .38, .16), M.orange, c).position.y = .7;
      dyn.calendar = canvasTex(300, 310, (x, w, h, sol = 1) => {
        x.fillStyle = '#f4e7c8'; x.fillRect(0, 0, w, h); x.fillStyle = '#d9692f'; x.fillRect(0, 0, w, 62);
        x.fillStyle = '#f4e7c8'; x.font = `900 30px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText('SOL', w / 2, 44);
        x.fillStyle = '#1f2c3f'; x.fillRect(22, 80, 120, 160); x.fillRect(158, 80, 120, 160);
        const n = String(sol).padStart(2, '0'); x.fillStyle = '#e6a83f'; x.font = `140px ${DISP}`; x.textBaseline = 'middle'; x.fillText(n[0], 82, 168); x.fillText(n[1], 218, 168);
        x.fillStyle = '#2b1a24'; x.fillRect(22, 158, 256, 5); x.font = `800 24px ${FONT}`; x.textBaseline = 'alphabetic'; x.fillText('Mission: 30 sols', w / 2, 285);
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.55), basic(0xffffff, { map: dyn.calendar })); face.position.z = .08; c.add(face);
      onWall(c, -8.6, 4.2, .2); own('calendar', c); anchors.calendar = V3(-8.6, 3.05, wallZ(3.05) + .4); }

    /* radio */
    { const r = new THREE.Group(); r.position.set(-2.4, 0, -5.25); scene.add(r);
      mesh(new THREE.BoxGeometry(2.0, 1.2, 1.0), M.tealD, r).position.y = .6;
      mesh(new THREE.BoxGeometry(2.1, .1, 1.1), M.cream, r).position.y = 1.25;
      mesh(new THREE.BoxGeometry(1.6, 1.0, .8), M.orange, r).position.y = 1.8;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.9, .55), basic(0xffffff, { map: canvasTex(180, 110, (x, w, h) => { x.fillStyle = '#1f2c3f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8cc7c3'; x.lineWidth = 5; x.lineJoin = 'round'; x.beginPath(); [[10, 60], [35, 60], [48, 30], [62, 85], [78, 40], [92, 60], [118, 60], [132, 25], [148, 90], [160, 60], [172, 60]].forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }) }));
      scr.position.set(-.25, 1.85, .41); r.add(scr);
      const dial = mesh(new THREE.CylinderGeometry(.2, .2, .1, 16), M.cream, r); dial.rotation.x = Math.PI / 2; dial.position.set(.5, 1.95, .43);
      for (const [x, m] of [[.38, M.mustard], [.62, M.tealL]]) { const k = mesh(new THREE.CylinderGeometry(.08, .08, .1, 10), m, r); k.rotation.x = Math.PI / 2; k.position.set(x, 1.5, .43); }
      mesh(new THREE.CylinderGeometry(.03, .03, .6, 6), M.ink, r).position.set(.55, 2.6, 0);
      const dish = mesh(new THREE.SphereGeometry(.32, 16, 8, 0, Math.PI * 2, 0, 1.1), toon(P.cream, { side: THREE.DoubleSide }), r); dish.position.set(.55, 2.85, 0); dish.rotation.x = -2.3;
      dyn.radioLight = mesh(new THREE.SphereGeometry(.09, 10, 8), basic(P.mustard), r); dyn.radioLight.position.set(-.6, 2.38, 0);
      own('radio', r); anchors.radio = V3(-2.4, 3.45, -5.1); }

    /* medicine cabinet */
    { const m = new THREE.Group();
      mesh(new THREE.BoxGeometry(1.5, 1.25, .45), M.white, m);
      mesh(new THREE.BoxGeometry(1.5, .2, .5), M.teal, m).position.y = .6;
      mesh(new THREE.BoxGeometry(.3, .75, .1), M.rust, m).position.z = .25; mesh(new THREE.BoxGeometry(.75, .3, .1), M.rust, m).position.z = .25;
      mesh(new THREE.BoxGeometry(.03, 1.1, .02), M.ink, m).position.z = .23;
      onWall(m, 4.0, 4.5, .35); own('medicine', m); anchors.medicine = V3(4.0, 3.65, wallZ(3.65) + .6); }

    /* poster + earth photo (decor) */
    { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), basic(0xffffff, { map: canvasTex(280, 350, (x, w, h) => {
        x.fillStyle = '#e6a83f'; x.fillRect(0, 0, w, h); x.fillStyle = '#b8452a'; x.beginPath(); x.arc(w / 2, 140, 82, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = '#2b1a24'; x.stroke();
        x.fillStyle = '#f4e7c8'; x.beginPath(); x.moveTo(140, 50); x.quadraticCurveTo(165, 80, 162, 130); x.lineTo(162, 200); x.lineTo(118, 200); x.lineTo(118, 130); x.quadraticCurveTo(115, 80, 140, 50); x.fill(); x.stroke();
        x.fillStyle = '#3f8f93'; x.beginPath(); x.moveTo(118, 165); x.lineTo(96, 205); x.lineTo(118, 205); x.fill(); x.stroke(); x.beginPath(); x.moveTo(162, 165); x.lineTo(184, 205); x.lineTo(162, 205); x.fill(); x.stroke();
        x.fillStyle = '#2b1a24'; x.fillRect(0, 262, w, 88); x.fillStyle = '#f4e7c8'; x.font = `900 40px ${FONT}`; x.textAlign = 'center'; x.fillText('Stay Safe', w / 2, 312); x.fillStyle = '#e6a83f'; x.font = `800 18px ${FONT}`; x.fillText('ARES · JEZERO', w / 2, 338);
        x.strokeStyle = '#2b1a24'; x.lineWidth = 10; x.strokeRect(0, 0, w, h); }) }));
      p.rotation.z = -.05; onWall(p, 7.0, 4.4, .25);
      const e = new THREE.Mesh(new THREE.PlaneGeometry(.75, .85), basic(0xffffff, { map: canvasTex(150, 170, (x, w, h) => { x.fillStyle = '#fff8e6'; x.fillRect(0, 0, w, h); x.fillStyle = '#3f8f93'; x.beginPath(); x.arc(75, 70, 48, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#2b1a24'; x.stroke(); x.fillStyle = '#7fae5b'; x.beginPath(); x.ellipse(60, 58, 22, 14, .5, 0, 7); x.fill(); x.beginPath(); x.ellipse(92, 90, 14, 10, -.3, 0, 7); x.fill(); x.fillStyle = '#2b1a24'; x.font = `800 22px ${FONT}`; x.textAlign = 'center'; x.fillText('Earth', 75, 156); x.lineWidth = 8; x.strokeRect(0, 0, w, h); }) }));
      e.rotation.z = .12; onWall(e, 8.3, 4.7, .25); }

    /* purifier */
    { const u = new THREE.Group(); u.position.set(5.6, 0, -5.0); scene.add(u);
      mesh(new THREE.BoxGeometry(1.5, 2.7, 1.1), M.teal, u).position.y = 1.35;
      mesh(new THREE.BoxGeometry(1.65, .25, 1.25), M.tealD, u).position.y = 2.8;
      const gauge = mesh(new THREE.CylinderGeometry(.24, .24, .1, 20), M.cream, u); gauge.rotation.x = Math.PI / 2; gauge.position.set(-.35, 2.25, .56);
      const nd = mesh(new THREE.BoxGeometry(.03, .2, .03), M.ink, u); nd.position.set(-.3, 2.3, .62); nd.rotation.z = -.7;
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(.6, .32), basic(0xffffff, { map: canvasTex(120, 64, (x, w, h) => { x.fillStyle = '#1f2c3f'; x.fillRect(0, 0, w, h); x.fillStyle = '#8cc7c3'; x.font = '800 34px ui-monospace,Menlo,Consolas,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H₂O', w / 2, h / 2 + 2); }) }));
      disp.position.set(.3, 2.25, .56); u.add(disp);
      mesh(new THREE.CylinderGeometry(.24, .24, 1.1, 16), M.glass, u).position.set(-.35, 1.2, .5);
      mesh(new THREE.CylinderGeometry(.2, .2, .6, 16), M.water, u).position.set(-.35, .95, .5);
      mesh(new THREE.BoxGeometry(.12, .4, .12), M.cream, u).position.set(.35, 1.4, .6);
      mesh(new THREE.BoxGeometry(.6, .08, .45), M.cream, u).position.set(.35, .75, .5);
      mesh(new THREE.CylinderGeometry(.11, .11, 3.4, 10), M.teal, u).position.set(.45, 4.4, -.3);
      own('purifier', u); anchors.purifier = V3(5.6, -.1, -4.3); }

    /* drinking-water tank */
    { const t = new THREE.Group(); t.position.set(7.9, 0, -4.0); scene.add(t);
      mesh(new THREE.CylinderGeometry(.82, .82, .25, 24), M.tealD, t).position.y = .12;
      mesh(new THREE.CylinderGeometry(.75, .75, 1.7, 24), M.glass, t).position.y = 1.1;
      const wg = new THREE.CylinderGeometry(.68, .68, 1.6, 24); wg.translate(0, .8, 0);
      dyn.water = mesh(wg, M.water, t); dyn.water.position.y = .3;
      mesh(new THREE.CylinderGeometry(.82, .82, .22, 24), M.tealD, t).position.y = 2.0;
      mesh(new THREE.TorusGeometry(.4, .06, 8, 20, Math.PI), M.ink, t).position.y = 2.1;
      mesh(new THREE.BoxGeometry(.35, .12, .12), M.mustard, t).position.set(.85, .7, .2);
      own('water', t); anchors.water = V3(7.9, 3.4, -4.0); }

    /* bed */
    { const b = new THREE.Group(); b.position.set(6.6, 0, 1.4); b.rotation.y = -.12; scene.add(b);
      mesh(new THREE.BoxGeometry(3.6, .75, 1.7), M.tealD, b).position.y = .38;
      for (const x of [-.8, .8]) mesh(new THREE.BoxGeometry(.7, .08, .04), M.mustard, b).position.set(x, .38, .86);
      mesh(new THREE.BoxGeometry(3.6, .3, 1.6), M.cream, b).position.y = .9;
      mesh(new THREE.BoxGeometry(.8, .3, 1.2), M.white, b).position.set(-1.3, 1.18, 0);
      mesh(new THREE.BoxGeometry(2.4, .42, 1.45), M.orange, b).position.set(.5, 1.2, 0);
      for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(.08, .44, 1.47), M.rust, b).position.set(-.4 + i * .6, 1.21, 0);
      own('bed', b); anchors.bed = V3(6.6, -.1, 2.4); }

    /* food locker */
    { const f = new THREE.Group(); f.position.set(-6.9, 0, 1.3); f.rotation.y = .18; scene.add(f);
      mesh(new THREE.BoxGeometry(2.4, 1.3, 1.4), M.rust, f).position.y = .65;
      mesh(new THREE.BoxGeometry(2.55, .3, 1.55), M.mustard, f).position.y = 1.42;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .65), basic(0xffffff, { map: canvasTex(220, 130, (x, w, h) => { x.fillStyle = '#f4e7c8'; x.fillRect(0, 0, w, h); x.lineWidth = 6; x.strokeStyle = '#2b1a24'; x.strokeRect(0, 0, w, h); x.fillStyle = '#e6a83f'; x.beginPath(); x.moveTo(70, 82); x.lineTo(70, 60); x.quadraticCurveTo(110, 20, 150, 60); x.lineTo(150, 82); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#2b1a24'; x.font = '900 20px ui-monospace,Menlo,Consolas,monospace'; x.textAlign = 'center'; x.fillText('RATION 03', w / 2, 116); }) }));
      lab.position.set(0, .7, .71); f.add(lab);
      for (const x of [-1.05, 1.05]) mesh(new THREE.BoxGeometry(.18, .6, .1), M.brick, f).position.set(x, .75, .72);
      own('food', f); anchors.food = V3(-6.9, -.1, 2.25); }

    /* console: desk + upright CRT */
    { const c = new THREE.Group(); c.position.set(-2.7, 0, .5); c.rotation.y = .22; scene.add(c);
      mesh(new THREE.BoxGeometry(2.6, 1.0, 1.2), M.tealD, c).position.y = .5;
      mesh(new THREE.BoxGeometry(2.8, .16, 1.35), M.teal, c).position.y = 1.08;
      for (const x of [-.75, .75]) mesh(new THREE.BoxGeometry(.6, .08, .04), M.mustard, c).position.set(x, .6, .61);
      const kb = mesh(new THREE.BoxGeometry(1.5, .12, .5), M.cream, c); kb.position.set(-.2, 1.22, .3); kb.rotation.x = .15;
      [P.mustard, P.orange, P.tealL, P.green, P.mustard].forEach((col, i) => { const k = mesh(new THREE.BoxGeometry(.2, .06, .14), basic(col), c); k.position.set(-.7 + i * .25, 1.3, .32); k.rotation.x = .15; });
      mesh(new THREE.BoxGeometry(1.9, 1.15, .85), M.cream, c).position.set(-.2, 1.95, -.25);
      mesh(new THREE.BoxGeometry(1.7, .95, .1), M.ink, c).position.set(-.2, 1.97, .2);
      dyn.screen = canvasTex(620, 320, (x, w, h, gen = 0) => { x.fillStyle = '#1f2c3f'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(140,199,195,.12)'; for (let i = 0; i < h; i += 8) x.fillRect(0, i, w, 3); x.fillStyle = '#8cc7c3'; x.font = `800 30px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('POWER · Today', 30, 58); x.fillStyle = '#e6a83f'; let fs = 130; do { x.font = `${fs}px ${DISP}`; fs -= 6; } while (x.measureText(`Power ${gen}`).width > w - 50 && fs > 40); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`Power ${gen}`, w / 2, h / 2 + 18); x.fillStyle = '#8cc7c3'; x.font = `800 30px ${FONT}`; x.fillText('blocks', w / 2, h - 34); });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.55, .8), basic(0xffffff, { map: dyn.screen })); scr.position.set(-.2, 1.97, .26); c.add(scr);
      mesh(new THREE.CylinderGeometry(.05, .05, .4, 6), M.ink, c).position.set(1.0, 1.35, .2);
      mesh(new THREE.SphereGeometry(.11, 10, 8), basic(P.rust), c).position.set(1.0, 1.58, .2);
      mesh(new THREE.SphereGeometry(.1, 10, 8), basic(P.green), c).position.set(.6, 2.6, -.25);
      own('console', c); anchors.console = V3(-2.7, -.1, 1.45); }

    /* astronaut — exterior suit, helmet under the arm */
    { const astro = new THREE.Group(); astro.position.set(1.4, 0, .9); astro.rotation.y = -.25; scene.add(astro); dyn.astro = astro;
      const a = new THREE.Group(); a.scale.setScalar(1.18); astro.add(a); const suit = M.cream;
      for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * .22, 1.5, 0); a.add(leg);
        mesh(new THREE.CylinderGeometry(.2, .22, .95, 10), suit, leg).position.y = -.45;
        mesh(new THREE.CylinderGeometry(.215, .215, .12, 10), M.orange, leg).position.y = -.4;
        mesh(new THREE.BoxGeometry(.3, .2, .45), M.navy, leg).position.set(0, -.88, .06); }
      const armL = mesh(new THREE.CylinderGeometry(.14, .14, .9, 8), suit, a); armL.position.set(-.58, 1.85, 0); armL.rotation.z = -.18;
      mesh(new THREE.SphereGeometry(.15, 10, 8), M.tealD, a).position.set(-.66, 1.38, 0);
      const armR = mesh(new THREE.CylinderGeometry(.14, .14, .9, 8), suit, a); armR.position.set(.62, 1.85, .12); armR.rotation.set(-.35, 0, .32);
      mesh(new THREE.CylinderGeometry(.46, .42, 1.05, 14), suit, a).position.y = 1.95;
      mesh(new THREE.CylinderGeometry(.47, .47, .14, 14), M.orange, a).position.y = 1.62;
      mesh(new THREE.BoxGeometry(.22, .2, .06), M.mustard, a).position.set(0, 1.62, .46);
      mesh(new THREE.BoxGeometry(.85, 1, .4), M.sand, a).position.set(0, 2, -.45);
      mesh(new THREE.BoxGeometry(.42, .3, .1), M.tealD, a).position.set(0, 2.1, .44);
      [[-.12, P.mustard], [0, P.tealL], [.12, P.orange]].forEach(([x, col]) => mesh(new THREE.SphereGeometry(.035, 8, 6), basic(col), a).position.set(x, 2.15, .5));
      const neck = mesh(new THREE.TorusGeometry(.3, .07, 8, 20), M.tealD, a); neck.position.set(0, 2.47, 0); neck.rotation.x = Math.PI / 2;
      const hStart = a.children.length;
      mesh(new THREE.CylinderGeometry(.12, .12, .2, 10), M.skin, a).position.y = 2.55;
      mesh(new THREE.SphereGeometry(.36, 20, 16), M.skin, a).position.y = 2.88;
      const hair = mesh(new THREE.SphereGeometry(.385, 20, 12, 0, Math.PI * 2, 0, Math.PI * .4), M.hair, a); hair.position.set(0, 2.92, -.06); hair.rotation.x = -.55;
      const tuft = mesh(new THREE.ConeGeometry(.08, .2, 6), M.hair, a); tuft.position.set(.05, 3.3, .05); tuft.rotation.z = -.5;
      for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.08, 8, 6), M.skin, a).position.set(s * .36, 2.86, 0);
      dyn.face = canvasTex(250, 200, (x, w, h, m = 'happy') => drawFace(x, w, h, m));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(.5, .4), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .5, map: dyn.face })); face.position.set(0, 2.85, .385); a.add(face);
      for (const o of a.children.slice(hStart + 1)) { o.position.y = 2.72 + (o.position.y - 2.72) * 1.32; o.position.x *= 1.32; o.position.z *= 1.32; o.scale.multiplyScalar(1.32); }
      const hel = new THREE.Group(); hel.position.set(.82, 1.48, .3); hel.rotation.y = .5; a.add(hel);
      mesh(new THREE.SphereGeometry(.42, 20, 14), suit, hel);
      const vis = mesh(new THREE.SphereGeometry(.31, 20, 14), M.mustard, hel); vis.scale.set(1, .8, .6); vis.position.set(0, .02, .24);
      const hr = mesh(new THREE.TorusGeometry(.3, .06, 8, 20), M.tealD, hel); hr.rotation.x = Math.PI / 2; hr.position.y = -.36;
      mesh(new THREE.SphereGeometry(.15, 10, 8), M.tealD, a).position.set(.72, 1.42, .52);
      own('crew', astro); anchors.crew = V3(1.4, -.1, 2.45); dyn.bubble = V3(1.1, 4.75, .9); }
    mesh(new THREE.CylinderGeometry(1.5, 1.5, .06, 40), M.tealD, scene).position.set(1.4, .03, .9);
    const matR = mesh(new THREE.TorusGeometry(1.25, .04, 6, 40), M.mustard, scene); matR.rotation.x = Math.PI / 2; matR.position.set(1.4, .07, .9);
    { const curve = new THREE.CatmullRomCurve3([V3(-2.0, .06, .9), V3(-1, .06, 2.4), V3(1, .06, 3.1), V3(3.2, .06, 2.6), V3(5.2, .06, -4.6)]); mesh(new THREE.TubeGeometry(curve, 60, .06, 6, false), M.teal, scene); }

    /* low-resource rings (water / food / medicine / crew) */
    for (const [key, x, z, r] of [['water', 7.9, -4.0, 1.15], ['food', -6.9, 1.3, 1.6], ['crew', 1.4, .9, 1.6], ['medicine', 4.0, -5.0, .01]]) {
      const ring = mesh(new THREE.TorusGeometry(r, .07, 6, 40), basic(P.rust), scene); ring.rotation.x = Math.PI / 2; ring.position.set(x, .06, z); ring.castShadow = false; ring.visible = false; low[key] = { ring, on: false };
    }

    /* lights */
    lights.hemi = new THREE.HemisphereLight(0xfff2dc, 0x8e2f22, .55); scene.add(lights.hemi);
    lights.dir = new THREE.DirectionalLight(0xfff2dc, .72); lights.dir.position.set(-6, 14, 12); lights.dir.castShadow = true;
    lights.dir.shadow.mapSize.set(2048, 2048); Object.assign(lights.dir.shadow.camera, { left: -13, right: 13, top: 10, bottom: -8, near: 1, far: 50 }); lights.dir.shadow.bias = -.0008; scene.add(lights.dir);
    lights.ceil = new THREE.PointLight(0xdff6f2, .35, 18, 1.5); lights.ceil.position.set(0, 8, -.6); scene.add(lights.ceil);
    lights.warm = [[-8.2, 3, -3.6], [6.6, 2.6, .2], [-2.4, 3, -3.8]].map(p => { const l = new THREE.PointLight(0xffb060, 0, 9, 1.6); l.position.set(...p); scene.add(l); return l; });
    lights.alarm = new THREE.PointLight(0xff4020, 0, 22, 1.6); lights.alarm.position.set(0, 8, -2); scene.add(lights.alarm);
    applyWeather('day');
  }

  function applyWeather(kind) {
    wx = kind; dyn.view.userData.redraw();
    const c = { day: { hemi: [0xfff2dc, 0x8e2f22, .55], dir: [0xfff2dc, .72], ceil: [0xdff6f2, .35], warm: 0, spot: [0xffc66e, 1.25], lamp: 0xeafaf6, alarm: 0 },
      storm: { hemi: [0xffd2a8, 0x8e2f22, .45], dir: [0xffc89a, .5], ceil: [0xffe0c0, .25], warm: 0, spot: [0xff9a50, .7], lamp: 0xffe8cc, alarm: .8 },
      night: { hemi: [0x4a5a8a, 0x2b1a24, .3], dir: [0x9aa6d8, .22], ceil: [0xffd27a, .55], warm: 1.1, spot: [0xffc66e, 0], lamp: 0xffd27a, alarm: 0 } }[kind];
    lights.hemi.color.setHex(c.hemi[0]); lights.hemi.groundColor.setHex(c.hemi[1]); lights.hemi.intensity = c.hemi[2];
    lights.dir.color.setHex(c.dir[0]); lights.dir.intensity = c.dir[1];
    lights.ceil.color.setHex(c.ceil[0]); lights.ceil.intensity = c.ceil[1];
    lights.warm.forEach(l => l.intensity = c.warm); lights.spot.color.setHex(c.spot[0]); lights.spot.intensity = c.spot[1];
    dyn.lamp.material.color.setHex(c.lamp); lights.alarm.userData.base = c.alarm; if (postM) postM.uniforms.alarm.value = c.alarm;
    container && container.setAttribute('data-weather', kind);
  }

  /* ---------- post pipeline (identical shader to js/world.js) ---------- */
  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'cabin3d-canvas'; renderer.domElement.setAttribute('aria-hidden', 'true');
    camera = new THREE.PerspectiveCamera(40, 1, .5, 200);
    rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType;
    postM = new THREE.ShaderMaterial({ depthWrite: false, depthTest: false,
      uniforms: { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, res: { value: new THREE.Vector2(4, 4) }, px: { value: 1 },
        near: { value: camera.near }, far: { value: camera.far }, time: { value: 0 }, skyD: { value: 1e4 }, edgeFar: { value: 520 }, flash: { value: 0 }, alarm: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `uniform sampler2D tC,tD;uniform vec2 res;uniform float px,near,far,time,skyD,edgeFar,flash,alarm;varying vec2 vUv;
        float lin(float d){float z=d*2.-1.;return 2.*near*far/(far+near-z*(far-near));}
        float D(vec2 o){return lin(texture2D(tD,vUv+o).x);}
        vec3 C(vec2 o){return texture2D(tC,vUv+o).rgb;}
        float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
        void main(){
          vec2 o=vec2(1.2*px)/res;
          float d=D(vec2(0));
          float dl=D(vec2(-o.x,0)),dr=D(vec2(o.x,0)),du=D(vec2(0,o.y)),dd=D(vec2(0,-o.y));
          float de=abs(dl+dr+du+dd-4.*d)/min(d,skyD*.66);
          float nearest=min(min(dl,dr),min(du,dd));
          float edge=smoothstep(.03,.07,de)*(1.-smoothstep(edgeFar*.42,edgeFar,nearest));
          vec3 c=C(vec2(0));
          vec3 cl=C(vec2(-o.x,0)),cr=C(vec2(o.x,0)),cu=C(vec2(0,o.y)),cd=C(vec2(0,-o.y));
          float ce=length(cl-cr)+length(cu-cd);
          float geo=step(d,skyD*.8);
          edge=max(edge,smoothstep(.42,.7,ce)*.85*step(d,skyD*.33));
          float l=dot(c,vec3(.299,.587,.114));
          vec2 g=gl_FragCoord.xy/(5.*px);g=vec2(g.x+g.y,g.y-g.x)*.7071;vec2 f=fract(g)-.5;
          float r=smoothstep(.36,.14,l)*.4;
          c=mix(c,c*.6,smoothstep(r,r-.08,length(f))*geo);
          c=mix(c,vec3(43.,26.,36.)/255.,edge);
          vec2 q=vUv-.5;
          c=mix(c,vec3(.75,.12,.08),alarm*.28*(.5+.5*sin(time*6.))*smoothstep(.15,.6,length(q)));
          c*=.95+.07*h1(gl_FragCoord.xy*.37+fract(time)*31.);
          c*=1.-dot(q,q)*.38;
          gl_FragColor=vec4(c,1.);}` });
    postS = new THREE.Scene(); postC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); postS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postM));
  }
  const BASE_POS = V3(0, 9, 18.5), TARGET = V3(0, 2.7, -2);
  function resize() {
    if (!container) return;
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    if (w === W && h === H && PR === Math.min(devicePixelRatio || 1, 1.75)) return;
    W = w; H = h; PR = Math.min(devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(PR); renderer.setSize(W, H, false);
    rt.setSize(W * PR, H * PR); postM.uniforms.res.value.set(W * PR, H * PR); postM.uniforms.px.value = PR;
    camera.aspect = W / H;
    const k = Math.max(1, 1.62 / camera.aspect);   // narrow views back away so the whole module stays in frame
    camera.position.copy(TARGET).addScaledVector(BASE_POS.clone().sub(TARGET), k); camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
  }

  /* ---------- picking + hover ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(Object.values(objects), true)) { if (hit.object.userData.key) return hit.object.userData.key; }
    return null;
  }
  function setHover(key) {
    if (hovered === key) return; hovered = key;
    for (const [k, el] of Object.entries(tags)) el.classList.toggle('is-hover', k === key);
    renderer.domElement.style.cursor = key ? 'pointer' : '';
  }
  function glow(key, color, amount) { objects[key].traverse(o => { if (o.userData.toon) { o.material.emissive.setHex(color); o.material.emissiveIntensity = amount; } }); }

  /* ---------- frame loop ---------- */
  const tmp = new THREE.Vector3(); let t0 = performance.now(), lastNight = null;
  function place(el, v, dy = 0) { tmp.copy(v).project(camera); el.style.transform = `translate(${((tmp.x + 1) / 2 * W).toFixed(1)}px,${((1 - tmp.y) / 2 * H + dy).toFixed(1)}px) translate(-50%,0)`; }
  function frame(now) {
    raf = 0; if (!active) return;
    resize();
    const t = reducedMotion.matches ? 0 : (now - t0) / 1000; postM.uniforms.time.value = t;
    const night = document.getElementById('frame')?.classList.contains('nightfall');
    if (night !== lastNight) { lastNight = night; applyWeather(night ? 'night' : (state.storm ? 'storm' : 'day')); }
    dyn.astro.position.y = mood === 'weak' ? 0 : Math.sin(t * 1.8) * .02;
    dyn.radioLight.visible = Math.sin(t * 2.5) > -.4;
    for (const [key, el] of Object.entries(tags)) {
      const target = el.classList.contains('tutorial-target'), focus = document.activeElement === el;
      const l = low[key]?.on;
      if (key === hovered || focus || target) glow(key, P.mustard, target ? .45 : .32); else if (l) glow(key, P.rust, .22 + .12 * Math.sin(t * 4)); else glow(key, 0, 0);
      if (low[key]) low[key].ring.visible = !!l;
      place(el, anchors[key]);
    }
    const bubble = document.getElementById('crewSpeech'); if (bubble) place(bubble, dyn.bubble, -64);
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postS, postC);
    raf = requestAnimationFrame(frame);
  }

  return {
    mount(el, tagMap) {
      container = el; tags = tagMap; build(); buildRenderer(); applyWeather('day');
      container.prepend(renderer.domElement);
      renderer.domElement.addEventListener('pointermove', e => setHover(pick(e)));
      renderer.domElement.addEventListener('pointerleave', () => setHover(null));
      let down = null;
      renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
      renderer.domElement.addEventListener('click', e => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;   // a drag (mobile scroll) is not a click
        const key = pick(e); if (key && tags[key]) tags[key].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      for (const [k, t] of Object.entries(tags)) { t.addEventListener('pointerenter', () => setHover(k)); t.addEventListener('pointerleave', () => setHover(null)); }
      document.fonts?.ready.then(() => { dyn.calendar.userData.redraw(Math.max(1, state.sol)); dyn.screen.userData.redraw(Math.max(0, state.gen)); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden && active && !raf) raf = requestAnimationFrame(frame); });
    },
    setActive(on) { active = !!on; if (active && !raf && renderer) { W = H = 0; raf = requestAnimationFrame(frame); } },
    update(g) {
      if (!renderer) return;
      if (g.sol !== state.sol) { state.sol = g.sol; dyn.calendar.userData.redraw(g.sol); }
      if (g.gen !== state.gen) { state.gen = g.gen; dyn.screen.userData.redraw(g.gen); }
      const lv = Math.max(.03, Math.min(1, g.water / 100)); if (lv !== state.water) { state.water = lv; dyn.water.scale.y = lv; }
      const storm = g.storm > 0; if (storm !== state.storm) { state.storm = storm; if (!lastNight) applyWeather(storm ? 'storm' : 'day'); }
    },
    setMood(m) { if (m !== mood && dyn.face) { mood = m; dyn.face.userData.redraw(m); } },
    setSamples(n) { if (dyn.rocks) dyn.rocks.visible = n > 0; },
    setLow(key, on) { if (low[key]) low[key].on = on; tags[key]?.classList.toggle('is-low', on); },
    get weather() { return wx; }
  };
})();
