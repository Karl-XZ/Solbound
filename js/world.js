/* =====================================================================
   海报风 3D 世界
   卡通色阶 + 分层雾 + 墨线描边 + 印刷网点 + 纸纹
   - 太空场景：真实海岸线的地球（Natural Earth 1:110m）、火星、月球
   - 火星地表：一座会随玩家决策生长、受损、修复的前哨站
   - 结局动画：样本发射 / 新乘组降落 / 仰望地球 / 返航 / 紧急撤离
   ===================================================================== */
window.World = (function () {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = { cream: 0xf4e7c8, mustard: 0xe6a83f, orange: 0xd9692f, rust: 0xb8452a, brick: 0x8e2f22, maroon: 0x5a1d1d,
    night: 0x2b1a24, navy: 0x1f2c3f, teal: 0x3f8f93, tealL: 0x8cc7c3, tealD: 0x2a5f68, green: 0x7fae5b, red: 0xff5a30 };

  /* ---------- 噪声与地形 ---------- */
  function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, o = 5) { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vnoise(x, y); const nx = 1.6 * x - 1.2 * y, ny = 1.2 * x + 1.6 * y; x = nx; y = ny; a *= .5; } return s; }
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const terrace = (h, s) => { const k = h / s, f = k - Math.floor(k); return (Math.floor(k) + ss(.72, 1, f)) * s; };
  function H(x, z) {
    const r = Math.hypot(x, z);
    let h = fbm(x * .025, z * .025) * 5 - 2.5 + fbm(x * .12, z * .12, 3) * .6;
    const mesa = Math.max(0, fbm(x * .011 + 5, z * .011 - 3, 3) - .42) * 30 * ss(78, 135, r);
    const rim = Math.exp(-(((r - 195) / 34) ** 2)) * 26 * (.6 + .7 * fbm(x * .014 + 9, z * .014, 3));
    h += terrace(mesa + rim, 4.5);
    return h * ss(36, 52, r) + (1 - ss(36, 52, r)) * -.1;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const backOut = k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);

  /* ---------- 全局 ---------- */
  let renderer, rt, postM, postS, postC, camera, stage, grad, FOGQ;
  let mode = 'space';
  let rendering = true;
  const player = AstronautController.create();
  let playerEnabled = false, inputEnabled = false, markerGroup;
  const sites = {}, markers = [], blockers = [], cameraBlockers = [];
  const S = {}, SP = {}, B = {};
  const st = { tod: .71, night: 0, storm: 0, stormT: 0, flash: 0, aurora: 0, auroraT: 0, signal: 0, frost: 0, alarm: 0 };
  const vis = { o2: 60, food: 50, dosePct: 0, batt: 4, battCap: 8, battBonus: 0, shieldLv: 1, shieldWork: 0, o2Work: 3, foodWork: 2, sciWork: 2, eva: false,
    sci: 0, panelEff: 1, rows: 2, domes: 1, labs: 0, tanks: 2, blight: 0, cull: 0, o2Fault: 0, conj: 0, powerOut: false, shelter: false, evaCount: 0,
    sample: false, pods: 0, exercise: false, damaged: 0, growth: .6, devil: 0 };
  const cam = { pos: V3(0, 0, 40), tgt: V3(), focus: 'overview', override: null };
  const earthDir = V3(-.02, .2, -.98).normalize();
  const lightDir = V3(-.9, .6, .35).normalize();
  let todAnim = null, introAnim = null, introHold = null;
  const anchors = {};
  let NOW = 0;

  function toon(color, o = {}) {
    const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, o));
    m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>', FOGQ); };
    return m;
  }
  let M = {};

  /* ======================= 动画工具 ======================= */
  const tweens = [];
  function tween(dur, f, done) { const t = { t0: NOW, dur, f, done }; tweens.push(t); return t; }
  function runTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i]; const k = Math.min(1, (NOW - t.t0) / t.dur); t.f(k); if (k >= 1) { tweens.splice(i, 1); t.done && t.done(); } }
  }
  // 烟团：低多边形卡通云，进入主场景，享受描边与网点
  const puffs = [];
  function initPuffs(scene) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    M.puff = { cream: toon(0xf4e7c8, { flatShading: true }), grey: toon(0xb8ab98, { flatShading: true }), dark: toon(0x6b5a58, { flatShading: true }), dust: toon(0xc9663a, { flatShading: true }), green: toon(P.green, { flatShading: true }) };
    for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(g, M.puff.cream); m.visible = false; m.castShadow = false; scene.add(m); puffs.push({ m, life: 0 }); }
  }
  function puff(pos, opt = {}) {
    const p = puffs.find(x => x.life <= 0); if (!p) return;
    p.m.material = M.puff[opt.mat || 'cream']; p.m.position.copy(pos);
    p.vel = opt.vel ? opt.vel.clone() : V3((Math.random() - .5) * .6, 1 + Math.random(), (Math.random() - .5) * .6);
    p.s0 = opt.s0 || .4; p.s1 = opt.s1 || 2.2; p.life = p.max = opt.life || 2.2; p.drag = opt.drag || .98;
    p.m.visible = true; p.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  }
  function runPuffs(dt) {
    for (const p of puffs) { if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
      p.m.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(p.drag);
      const s = lerp(p.s0, p.s1, Math.sqrt(k)) * (k > .75 ? 1 - (k - .75) / .25 : 1); p.m.scale.setScalar(Math.max(.001, s));
      if (p.life <= 0) p.m.visible = false; }
  }
  function burst(pos, n = 10, mat = 'dust', r = 3) {
    for (let i = 0; i < n; i++) { const a = i / n * 6.283; puff(V3(pos.x + Math.cos(a) * r * .3, pos.y + .3, pos.z + Math.sin(a) * r * .3), { mat, vel: V3(Math.cos(a) * r, .8 + Math.random(), Math.sin(a) * r), s0: .5, s1: 1.6 + Math.random(), life: 1.4, drag: .93 }); }
  }
  // 火花/尘粒：叠加层的小点
  let sparks;
  function initSparks(overlay) {
    const N = 500, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexColors: true, uniforms: { px: { value: 1 } },
      vertexShader: `attribute float size;varying vec3 vC;uniform float px;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*px*(120./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vC;void main(){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;gl_FragColor=vec4(vC,1.);}` });
    sparks = new THREE.Points(g, m); sparks.frustumCulled = false; overlay.add(sparks);
    sparks.userData = { N, life: new Float32Array(N), vel: new Float32Array(N * 3), next: 0 };
  }
  const cSpark = new THREE.Color();
  function spark(pos, vel, color = 0xffd27a, size = 3, life = .8) {
    const u = sparks.userData, i = u.next; u.next = (i + 1) % u.N;
    const pa = sparks.geometry.attributes.position, ca = sparks.geometry.attributes.color, sa = sparks.geometry.attributes.size;
    pa.setXYZ(i, pos.x, pos.y, pos.z); cSpark.setHex(color); ca.setXYZ(i, cSpark.r, cSpark.g, cSpark.b); sa.setX(i, size);
    u.vel[i * 3] = vel.x; u.vel[i * 3 + 1] = vel.y; u.vel[i * 3 + 2] = vel.z; u.life[i] = life;
  }
  function runSparks(dt) {
    const u = sparks.userData, pa = sparks.geometry.attributes.position, sa = sparks.geometry.attributes.size;
    for (let i = 0; i < u.N; i++) { if (u.life[i] <= 0) continue; u.life[i] -= dt;
      u.vel[i * 3 + 1] -= 3.7 * dt * (sa.getX(i) > 2.5 ? 1 : .05);
      pa.setXYZ(i, pa.getX(i) + u.vel[i * 3] * dt, pa.getY(i) + u.vel[i * 3 + 1] * dt, pa.getZ(i) + u.vel[i * 3 + 2] * dt);
      if (u.life[i] <= 0) sa.setX(i, 0); }
    pa.needsUpdate = true; sa.needsUpdate = true; sparks.geometry.attributes.color.needsUpdate = true;
  }
  // 出现：弹出 + 尘土 + 火花
  function pop(obj, at) {
    obj.visible = true; obj.scale.setScalar(.001);
    const p = at || obj.getWorldPosition(V3());
    burst(V3(p.x, H(p.x, p.z), p.z), 12, 'dust', 4);
    for (let i = 0; i < 26; i++) spark(V3(p.x, p.y + 1.5, p.z), V3((Math.random() - .5) * 8, 3 + Math.random() * 5, (Math.random() - .5) * 8), 0xffd27a, 3, 1.2);
    tween(1100, k => obj.scale.setScalar(Math.max(.001, backOut(k))));
  }

  /* ======================= 物件工厂 ======================= */
  function mesh(geo, mat, par) { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; par && par.add(o); return o; }
  function makeAstro(accent = P.orange) {
    const a = new THREE.Group(), suit = M.cream;
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * .22, 1.5, 0); a.add(leg); legs.push(leg);
      mesh(new THREE.CylinderGeometry(.2, .22, .95, 10), suit, leg).position.y = -.45;
      mesh(new THREE.BoxGeometry(.3, .2, .45), M.navy, leg).position.set(0, -.88, .06);
      const arm = mesh(new THREE.CylinderGeometry(.14, .14, .9, 8), suit, a); arm.position.set(s * .58, 1.85, 0); arm.rotation.z = s * .18;
    }
    mesh(new THREE.CylinderGeometry(.46, .42, 1.05, 14), suit, a).position.y = 1.95;
    mesh(new THREE.CylinderGeometry(.47, .47, .14, 14), toon(accent), a).position.y = 1.62;
    mesh(new THREE.BoxGeometry(.85, 1, .4), toon(0xd8c7a2), a).position.set(0, 2, -.45);
    mesh(new THREE.SphereGeometry(.44, 20, 14), suit, a).position.y = 2.78;
    const visor = mesh(new THREE.SphereGeometry(.32, 20, 14), M.mustard, a); visor.scale.set(1, .8, .6); visor.position.set(0, 2.8, .24);
    a.userData.legs = legs; a.scale.setScalar(1.3);
    return a;
  }
  function walkPose(a, t, moving) {
    const sw = moving ? Math.sin(t * 9) * .5 : 0;
    a.userData.legs[0].rotation.x = sw; a.userData.legs[1].rotation.x = -sw;
  }
  function stripedChute() {
    const g = new THREE.SphereGeometry(3.4, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.2).toNonIndexed();
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), a = new THREE.Color(P.orange), b = new THREE.Color(P.cream);
    for (let i = 0; i < pos.count; i += 3) { const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const seg = Math.floor((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2) * 16); const c = seg % 2 ? a : b; for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  function makeCapsule(crew) {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(1, 1.7, 2, 20), crew ? M.cream : M.white, g); body.position.y = 1;
    mesh(new THREE.CylinderGeometry(1.75, 1.75, .3, 20), M.brick, g).position.y = .15;
    mesh(new THREE.CylinderGeometry(.6, 1, .5, 16), M.navy, g).position.y = 2.25;
    if (crew) { const w = mesh(new THREE.BoxGeometry(.5, .4, .1), M.win, g); w.position.set(0, 1.3, 1.33); w.rotation.x = -.33; }
    const stripe = mesh(new THREE.CylinderGeometry(1.36, 1.36, .22, 20), M.orange, g); stripe.position.y = 1;
    const chute = new THREE.Group(); chute.position.y = 9; g.add(chute);
    mesh(stripedChute(), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), chute);
    const lp = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; lp.push(V3(Math.cos(a) * 3.1, .9, Math.sin(a) * 3.1), V3(0, -6.5, 0)); }
    chute.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: P.night })));
    g.userData.chute = chute;
    return g;
  }
  function makeRocket() {
    const r = new THREE.Group();
    mesh(new THREE.CylinderGeometry(.95, .95, 7, 24), M.white, r).position.y = 4.6;
    mesh(new THREE.ConeGeometry(.95, 2.4, 24), M.orange, r).position.y = 9.3;
    for (const y of [2.2, 6.4]) mesh(new THREE.CylinderGeometry(.98, .98, .45, 24), M.orange, r).position.y = y;
    for (let i = 0; i < 4; i++) { const f = mesh(new THREE.BoxGeometry(.12, 1.6, 1.2), M.navy, r); const a = i / 4 * 6.283; f.position.set(Math.cos(a) * 1.1, 1.8, Math.sin(a) * 1.1); f.rotation.y = -a; }
    mesh(new THREE.CylinderGeometry(.55, .8, .7, 16), M.navy, r).position.y = .75;
    const flame = new THREE.Group(); flame.position.y = .4; r.add(flame);
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(.75, 4, 16), new THREE.MeshBasicMaterial({ color: 0xffc55a })); f1.rotation.x = Math.PI; f1.position.y = -2; flame.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(.42, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0xfff3d6 })); f2.rotation.x = Math.PI; f2.position.y = -1.2; flame.add(f2);
    flame.visible = false; r.userData.flame = flame;
    return r;
  }

  /* ======================= 地表场景 ======================= */
  function buildSurface() {
    const scene = new THREE.Scene(), overlay = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xe39a55, .0066);
    S.scene = scene; S.overlay = overlay;
    M = Object.assign(M, { cream: toon(P.cream), white: toon(0xfbf3df), navy: toon(P.navy), mustard: toon(P.mustard), orange: toon(P.orange), brick: toon(P.brick),
      tealD: toon(P.tealD), teal: toon(P.teal), green: toon(P.green), grey: toon(0x9a8f86), rock: toon(P.brick, { flatShading: true }),
      win: new THREE.MeshBasicMaterial({ color: P.mustard }), winOff: new THREE.MeshBasicMaterial({ color: 0x3a2a30 }), red: new THREE.MeshBasicMaterial({ color: P.red }),
      tealGlow: new THREE.MeshBasicMaterial({ color: P.tealL }), panel: toon(P.tealD), plant: toon(P.green), glass: toon(P.tealD, { transparent: true, opacity: .5 }) });
    initPuffs(scene); initSparks(overlay);

    // 天空
    const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false,
      uniforms: { sun: { value: V3(0, 1, 0) }, earth: { value: earthDir }, time: { value: 0 }, px: { value: 1 }, night: { value: 0 }, storm: { value: 0 }, aurora: { value: 0 }, flash: { value: 0 } },
      vertexShader: `varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 sun,earth;uniform float time,px,night,storm,aurora,flash;varying vec3 v;
        vec3 hx(float r,float g,float b){return vec3(r,g,b)/255.;}
        vec3 band(float i){
          if(i<.5)return hx(239.,193.,114.);if(i<1.5)return hx(233.,166.,80.);if(i<2.5)return hx(221.,132.,59.);
          if(i<3.5)return hx(204.,97.,49.);if(i<4.5)return hx(184.,69.,42.);if(i<5.5)return hx(150.,51.,35.);
          if(i<6.5)return hx(118.,37.,31.);if(i<7.5)return hx(90.,29.,29.);if(i<8.5)return hx(62.,28.,34.);return hx(43.,26.,36.);}
        vec3 nband(float i){
          if(i<.5)return hx(92.,38.,48.);if(i<1.5)return hx(74.,32.,48.);if(i<2.5)return hx(60.,28.,46.);
          if(i<3.5)return hx(49.,26.,44.);if(i<4.5)return hx(41.,24.,42.);if(i<5.5)return hx(34.,22.,40.);
          if(i<6.5)return hx(29.,21.,38.);if(i<7.5)return hx(25.,20.,35.);if(i<8.5)return hx(22.,18.,32.);return hx(19.,16.,28.);}
        float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
        void main(){
          vec3 d=normalize(v);float h=max(d.y,0.);
          float bi=floor(pow(h,.5)*13.);
          vec3 c=mix(band(bi),nband(bi),night);
          c=mix(c,mix(hx(196.,120.,70.),hx(120.,60.,45.),night),storm*.8);
          float a=acos(clamp(dot(d,sun),-1.,1.)),pul=1.+.025*sin(time*.9)+flash*.6;
          float rv=smoothstep(-.1,.02,sun.y)*(1.-storm*.7);
          if(a<.21*pul)c=mix(c,hx(63.,143.,147.),.22*rv);
          if(a<.155*pul)c=mix(c,hx(63.,143.,147.),.38*rv);
          if(a<.108*pul)c=mix(c,hx(140.,199.,195.),.5*rv);
          if(a<.07*pul)c=mix(c,hx(190.,225.,215.),.68*rv);
          if(a<.038&&sun.y>-.03)c=mix(c,hx(251.,243.,223.),1.-storm*.6);
          vec2 g=gl_FragCoord.xy/(7.*px);g=vec2(g.x+g.y,g.y-g.x)*.7071;vec2 f=fract(g)-.5;
          float rr=.5*pow(smoothstep(.2,.75,h),1.15)*(1.-storm*.8);
          c=mix(c,mix(hx(34.,20.,28.),hx(10.,9.,16.),night),smoothstep(rr,rr-.07,length(f))*step(.02,rr));
          vec2 sp=vec2(atan(d.x,d.z),asin(d.y))*70.;vec2 id=floor(sp);
          float st=step(.975-night*.02,h1(id))*step(length(fract(sp)-.5),.09+.05*sin(time*2.+h1(id+1.)*50.))*smoothstep(.12,.3,h)*mix(.5,1.,night)*(1.-storm);
          c=mix(c,hx(244.,231.,200.),st);
          float au=aurora*night*(1.-storm);
          if(au>.01){float az=atan(d.x,d.z);float w=sin(az*5.+time*.4)*.035+sin(az*11.-time*.3)*.015;
            float base=.05+w;float k=step(base,h)*(1.-smoothstep(base,base+.2,h));
            float ray=step(.55,fract(az*38.+sin(h*14.+time*.6+az*3.)*.35));
            c=mix(c,hx(127.,200.,130.),k*(.12+.3*ray)*au);}
          float e=acos(clamp(dot(d,earth),-1.,1.));
          float ev=mix(.6,1.,night)*(1.-storm*.85);
          if(e<.03)c=mix(c,hx(140.,199.,195.),.35*ev);
          if(e<.014)c=mix(c,hx(191.,230.,255.),ev);
          c=mix(c,hx(251.,243.,223.),flash*.35);
          gl_FragColor=vec4(c,1.);}`
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), sky)); S.sky = sky;

    S.hemi = new THREE.HemisphereLight(0x9fd0cc, 0x8e2f22, .38); scene.add(S.hemi);
    const dl = new THREE.DirectionalLight(0xfff2dc, .78); dl.position.copy(lightDir).multiplyScalar(150);
    dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048); const sc = dl.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 400; dl.shadow.bias = -.0005; dl.shadow.normalBias = .05;
    scene.add(dl); S.dl = dl;
    S.lampHub = new THREE.PointLight(0xffb060, 0, 26, 2); S.lampHub.position.set(4, 4, 5); scene.add(S.lampHub);
    S.lampGh = new THREE.PointLight(0x9cff9a, 0, 18, 2); scene.add(S.lampGh);
    S.lampAlarm = new THREE.PointLight(0xff4020, 0, 30, 2); S.lampAlarm.position.set(0, 8, 0); scene.add(S.lampAlarm);

    // 地形
    const g = new THREE.PlaneGeometry(800, 800, 300, 300); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const cR = new THREE.Color(P.rust), cO = new THREE.Color(0xc65a33), cB = new THREE.Color(P.brick);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, H(x, z));
      const n = fbm(x * .04 + 3, z * .04, 3), m = fbm(x * .3, z * .3, 2); const c = m > .62 ? cB : (n > .52 ? cO : cR); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    S.groundMat = toon(0xffffff, { vertexColors: true });
    const ground = new THREE.Mesh(g, S.groundMat); ground.receiveShadow = true; scene.add(ground);

    // 岩石（避开基地）
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M.rock, 520);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = V3();
    for (let i = 0; i < 520; i++) { const a = Math.random() * 6.283, r = 42 + Math.pow(Math.random(), .7) * 90, x = Math.cos(a) * r, z = Math.sin(a) * r, s = .3 + Math.pow(Math.random(), 3) * 2.2;
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); sv.set(s, s * .65, s * 1.1); m4.compose(V3(x, H(x, z) + s * .15, z), q, sv); rocks.setMatrixAt(i, m4); }
    rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

    buildBase(scene);

    // 叠加层：信号、尘埃
    S.dishTip = V3(-6, 10.6, -12);
    S.earthPt = earthDir.clone().multiplyScalar(850);
    S.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([S.dishTip, S.earthPt]), new THREE.LineDashedMaterial({ color: P.cream, dashSize: 3, gapSize: 5, fog: false, transparent: true, opacity: 0 })); S.line.computeLineDistances(); overlay.add(S.line);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    S.pulses = new THREE.Points(pg, new THREE.PointsMaterial({ color: P.cream, size: 6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 })); overlay.add(S.pulses);
    const dg = new THREE.BufferGeometry(), dp = new Float32Array(2200 * 3);
    for (let i = 0; i < 2200; i++) { dp[i * 3] = (Math.random() - .5) * 160; dp[i * 3 + 1] = Math.random() * 22; dp[i * 3 + 2] = (Math.random() - .5) * 160; }
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    S.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: P.cream, size: 2, sizeAttenuation: false, transparent: true, opacity: .5, fog: false })); overlay.add(S.dust);

    Object.assign(anchors, {
      hub: V3(0, 7.4, 0), o2: V3(6, 5.5, -16), food: V3(-12, 5.6, -2), solar: V3(20, 4, -10), shield: V3(-3.6, 4, 6.2),
      antenna: V3(-6, 12.6, -12), sci: V3(16, 6, 14), battery: V3(8, 4, 8), astro: V3(4, 4.6, 10), pad: V3(-17, 13, 26), eva: V3(-30, 5, -22),
      earth: S.earthPt.clone().add(V3(0, 26, 0))
    });
  }

  /* ======================= 基地：所有可生长的部件 ======================= */
  const MOD_ANG = [2.1, 4.2, 0, 5.3];
  const DOMES = [V3(-12, 0, -2), V3(-15, 0, 10), V3(-23, 0, 1)];
  function buildBase(scene) {
    const base = new THREE.Group(); scene.add(base); B.base = base;
    B.windows = [];
    // 中央枢纽
    const hub = new THREE.Group(); base.add(hub); B.hub = hub;
    mesh(new THREE.CylinderGeometry(3.3, 3.5, 2.6, 40), M.cream, hub).position.y = 1.3;
    mesh(new THREE.SphereGeometry(3.3, 40, 16, 0, 6.283, 0, Math.PI / 2), M.cream, hub).position.y = 2.6;
    for (const y of [.5, 2.2]) { const b = mesh(new THREE.TorusGeometry(3.42, .09, 6, 48), M.navy, hub); b.rotation.x = Math.PI / 2; b.position.y = y; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const w = mesh(new THREE.BoxGeometry(.6, .5, .1), M.win, hub); w.position.set(Math.cos(a) * 3.42, 1.4, Math.sin(a) * 3.42); w.rotation.y = -a + Math.PI / 2; w.userData.grp = 'hub'; B.windows.push(w); }
    B.beacon = mesh(new THREE.SphereGeometry(.35, 12, 8), M.red, hub); B.beacon.position.y = 6.1; B.beacon.visible = false;
    mesh(new THREE.CylinderGeometry(.06, .06, .5, 6), M.navy, hub).position.y = 5.8;
    // 辐射警示牌
    const sign = new THREE.Group(); sign.position.set(4.5, 0, 4.5); base.add(sign); B.sign = sign;
    mesh(new THREE.CylinderGeometry(.07, .07, 2.6, 6), M.navy, sign).position.y = 1.3;
    B.signFace = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .1, 3), new THREE.MeshBasicMaterial({ color: P.mustard })); B.signFace.rotation.x = Math.PI / 2; B.signFace.position.y = 2.7; sign.add(B.signFace);
    sign.visible = false;
    // 舱段（含实验舱）与屏蔽土堆
    B.mods = []; B.mounds = [];
    MOD_ANG.forEach((ang, idx) => {
      const grp = new THREE.Group(); grp.rotation.y = -ang; base.add(grp);
      const L = 8, r = 1.5, cx = 3.2 + L / 2, lab = idx >= 2;
      const c = mesh(new THREE.CylinderGeometry(r, r, L, 32), lab ? M.white : M.cream, grp); c.rotation.z = Math.PI / 2; c.position.set(cx, r, 0);
      for (let k = -3; k <= 3; k++) { const rib = mesh(new THREE.TorusGeometry(r + .05, .08, 6, 32), lab ? M.orange : M.navy, grp); rib.rotation.y = Math.PI / 2; rib.position.set(cx + k * 1.15, r, 0); }
      const end = mesh(new THREE.CylinderGeometry(r * .85, r * .85, .35, 32), M.navy, grp); end.rotation.z = Math.PI / 2; end.position.set(cx + L / 2 + .1, r, 0);
      for (const k of [-2, 0, 2]) { const w = mesh(new THREE.BoxGeometry(.7, .4, .06), M.win, grp); w.position.set(cx + k * 1.15, r + .4, r * .97); w.userData.grp = idx === 0 ? 'shelter' : 'mod'; B.windows.push(w); }
      if (lab) { const d = mesh(new THREE.SphereGeometry(.7, 16, 8, 0, 6.283, 0, Math.PI / 2), M.mustard, grp); d.position.set(cx + 2, r * 2 - .1, 0); }
      grp.visible = !lab; B.mods.push(grp);
      const md = mesh(new THREE.SphereGeometry(1, 22, 10, 0, 6.283, 0, Math.PI / 2), M.rock, grp); md.position.set(cx, 0, 0);
      const p2 = md.geometry.attributes.position; for (let i = 0; i < p2.count; i++) { const v = V3().fromBufferAttribute(p2, i); const n = .88 + .24 * vnoise(v.x * 3 + 7 + ang, v.z * 3 + v.y * 2); p2.setXYZ(i, v.x * n, v.y * n, v.z * n); } md.geometry.computeVertexNormals();
      md.userData.cur = 0; md.visible = false; B.mounds.push(md);
    });
    // 沙袋墙（屏蔽 ≥2 级）
    B.sandbags = new THREE.Group(); base.add(B.sandbags);
    for (let i = 0; i < 22; i++) { const a = .8 + i / 22 * 1.9; const s = mesh(new THREE.BoxGeometry(1.1, .55, .7), M.rock, B.sandbags); s.position.set(Math.cos(a) * 5.6, .28 + (i % 2) * .5, Math.sin(a) * 5.6); s.rotation.y = -a; }
    B.sandbags.visible = false;
    // 温室群
    B.domes = []; B.plants = [];
    DOMES.forEach((p, i) => {
      const gh = new THREE.Group(); gh.position.copy(p); base.add(gh);
      const glass = mesh(new THREE.SphereGeometry(4.3, 40, 20, 0, 6.283, 0, Math.PI / 2), M.glass, gh); glass.castShadow = false;
      gh.add(new THREE.Mesh(new THREE.SphereGeometry(4.34, 10, 5, 0, 6.283, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: P.tealL, wireframe: true })));
      for (let j = 0; j < 34; j++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 3.3, s = .35 + Math.random() * .35;
        const pl = mesh(new THREE.IcosahedronGeometry(s, 0), M.plant, gh); pl.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); pl.userData = { s, cull: Math.random() }; B.plants.push(pl); }
      const from = i === 0 ? V3(0, 0, 0) : DOMES[0], dir = V3().subVectors(p, from); const r0 = i === 0 ? 3.3 : 4.3, len = dir.length() - r0 - 4.3;
      const tube = new THREE.Group(); tube.position.copy(from); tube.rotation.y = -Math.atan2(dir.z, dir.x); base.add(tube);
      const tb = mesh(new THREE.CylinderGeometry(.85, .85, len, 20), M.cream, tube); tb.rotation.z = Math.PI / 2; tb.position.set(r0 + len / 2, .85, 0);
      gh.userData.tube = tube; gh.visible = tube.visible = i === 0; B.domes.push(gh);
    });
    S.lampGh.position.set(-12, 2.5, -2);
    // 太阳能阵列：每一行 4 块板
    const arr = new THREE.Group(); arr.position.set(16, 0, -8); arr.rotation.y = Math.atan2(lightDir.x, lightDir.z); base.add(arr); B.arr = arr;
    B.rows = [];
    for (let r = 0; r < 5; r++) {
      const row = new THREE.Group(); row.position.z = -r * 4.6; arr.add(row); B.rows.push(row); row.userData.panels = [];
      for (let c = 0; c < 4; c++) { const x = c * 4.8 - 7.2;
        mesh(new THREE.CylinderGeometry(.1, .1, 1.7, 6), M.navy, row).position.set(x, .85, 0);
        const pg = new THREE.Group(); pg.position.set(x, 1.75, 0); pg.rotation.x = -.55; row.add(pg);
        mesh(new THREE.BoxGeometry(4.3, .12, 2.7), M.panel, pg);
        pg.add(new THREE.Mesh(new THREE.BoxGeometry(4.32, .13, .08), new THREE.MeshBasicMaterial({ color: P.tealL })));
        row.userData.panels.push(pg); }
      row.visible = r < 2;
    }
    // 电池组
    const bat = new THREE.Group(); bat.position.set(8, 0, 8); bat.rotation.y = -.4; base.add(bat); B.bat = bat; B.cells = [];
    for (let i = 0; i < 6; i++) { const cab = mesh(new THREE.BoxGeometry(1.1, 1.8, 1.1), i < 4 ? M.navy : M.tealD, bat); cab.position.set(i * 1.3 - 3.2, .9, 0); if (i >= 4) { cab.visible = false; cab.userData.extra = true; } }
    for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(.8, .16, .05), M.tealGlow); const cabI = Math.floor(i / 2); c.position.set(cabI * 1.3 - 3.2, .55 + (i % 2) * .5, .57); bat.add(c); B.cells.push(c); }
    // 制氧站
    const o2 = new THREE.Group(); o2.position.set(4, 0, -16); base.add(o2); B.o2 = o2;
    mesh(new THREE.BoxGeometry(3.2, 2.4, 2.4), M.cream, o2).position.y = 1.2;
    mesh(new THREE.CylinderGeometry(.35, .35, 2.2, 10), M.navy, o2).position.set(.9, 3.4, 0);
    B.o2light = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), M.tealGlow); B.o2light.position.set(-.9, 2.6, 1.22); o2.add(B.o2light);
    B.tanks = [];
    for (let i = 0; i < 7; i++) { const t = new THREE.Group(); t.position.set(3 + i * 1.6, 0, -.4); o2.add(t);
      mesh(new THREE.CylinderGeometry(.6, .6, 2.6, 16), M.white, t).position.y = 1.3;
      mesh(new THREE.SphereGeometry(.6, 16, 8, 0, 6.283, 0, Math.PI / 2), M.white, t).position.y = 2.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.63, .63, .35, 16), M.tealGlow); band.position.y = 1.3; t.add(band); t.userData.band = band;
      t.visible = i < 2; B.tanks.push(t); }
    // 天线
    const ant = new THREE.Group(); ant.position.set(-6, 0, -12); base.add(ant); B.ant = ant;
    mesh(new THREE.CylinderGeometry(.14, .22, 10, 8), M.navy, ant).position.y = 5;
    const dishPivot = new THREE.Group(); dishPivot.position.y = 10; ant.add(dishPivot); B.dish = dishPivot;
    const dish = mesh(new THREE.SphereGeometry(2, 32, 12, 0, 6.283, 0, 1.05), toon(P.cream, { side: THREE.DoubleSide }), dishPivot);
    dishPivot.lookAt(earthDir.clone().multiplyScalar(-100).add(V3(-6, 10, -12))); dish.rotation.x = Math.PI / 2;
    B.antBeacon = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 8), M.red); B.antBeacon.position.y = 10.4; ant.add(B.antBeacon);
    // 科学站：随科学成果逐步出现
    const sci = new THREE.Group(); sci.position.set(16, 0, 14); base.add(sci); B.sci = [];
    const mast = new THREE.Group(); sci.add(mast); mesh(new THREE.CylinderGeometry(.08, .08, 4, 6), M.navy, mast).position.y = 2;
    B.vane = new THREE.Group(); B.vane.position.y = 4; mast.add(B.vane);
    for (let i = 0; i < 3; i++) { const cup = mesh(new THREE.SphereGeometry(.22, 8, 6), M.mustard, B.vane); cup.position.set(Math.cos(i * 2.09) * .55, 0, Math.sin(i * 2.09) * .55); }
    const parts = [
      [15, () => { const g = new THREE.Group(); g.position.set(-3.5, 0, 2); mesh(new THREE.SphereGeometry(1, 20, 10, 0, 6.283, 0, Math.PI / 2), M.mustard, g); mesh(new THREE.CylinderGeometry(1.1, 1.1, .2, 20), M.navy, g); return g; }],
      [35, () => { const g = new THREE.Group(); g.position.set(3, 0, -2); for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(.08, .08, 5.5, 6), M.orange, g); const a = i * 2.09; l.position.set(Math.cos(a) * .9, 2.6, Math.sin(a) * .9); l.rotation.set(Math.sin(a) * .18, 0, -Math.cos(a) * .18); }
        const dr = mesh(new THREE.CylinderGeometry(.12, .12, 4, 8), M.navy, g); dr.position.y = 2; g.userData.drill = dr; mesh(new THREE.BoxGeometry(1.2, .8, 1.2), M.cream, g).position.y = 5.2; return g; }],
      [55, () => { const g = new THREE.Group(); g.position.set(-1, 0, -5); mesh(new THREE.CylinderGeometry(.3, .5, 1.6, 10), M.navy, g).position.y = .8; const tp = new THREE.Group(); tp.position.y = 1.8; g.add(tp);
        const tube = mesh(new THREE.CylinderGeometry(.45, .55, 3, 16), M.white, tp); tube.rotation.x = -1; g.userData.tele = tp; return g; }],
      [80, () => { const g = new THREE.Group(); g.position.set(4, 0, 4); mesh(new THREE.BoxGeometry(2.4, 1.2, 1), M.navy, g).position.y = .6;
        for (let i = 0; i < 5; i++) { const t = mesh(new THREE.CylinderGeometry(.12, .12, .9, 8), M.mustard, g); t.position.set(-.9 + i * .45, 1.55, 0); } return g; }],
      [100, () => { const g = new THREE.Group(); g.position.set(0, 0, 5); mesh(new THREE.CylinderGeometry(.06, .06, 5, 6), M.navy, g).position.y = 2.5;
        const fl = mesh(new THREE.BoxGeometry(2, 1.2, .05), M.orange, g); fl.position.set(1, 4.3, 0); g.userData.flag = fl; return g; }]
    ];
    for (const [th, fn] of parts) { const o = fn(); o.visible = false; o.userData.th = th; sci.add(o); B.sci.push(o); }
    // 舱外考察点（三角洲）
    const eva = new THREE.Group(); eva.position.set(-30, H(-30, -22), -22); base.add(eva); B.eva = eva; B.evaFlags = [];
    const deltaRock = mesh(new THREE.DodecahedronGeometry(2, 0), toon(0xc9a16a, { flatShading: true }), eva); deltaRock.scale.set(1.5, .8, 1.2); deltaRock.position.y = .8;
    for (let i = 0; i < 6; i++) { const f = new THREE.Group(); const a = i * 1.05; f.position.set(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5); eva.add(f);
      mesh(new THREE.CylinderGeometry(.04, .04, 2, 5), M.navy, f).position.y = 1; mesh(new THREE.BoxGeometry(.7, .45, .04), i === 5 ? M.mustard : M.orange, f).position.set(.36, 1.8, 0);
      f.visible = false; B.evaFlags.push(f); }
    // 挖土机
    const ex = new THREE.Group(); base.add(ex); B.ex = ex;
    mesh(new THREE.BoxGeometry(2.4, .7, 1.6), M.navy, ex).position.y = .35;
    mesh(new THREE.BoxGeometry(1.8, 1, 1.4), M.mustard, ex).position.y = 1.2;
    mesh(new THREE.BoxGeometry(.9, .8, 1.2), M.cream, ex).position.set(-.3, 2.1, 0);
    const arm = new THREE.Group(); arm.position.set(.9, 1.5, 0); ex.add(arm); B.exArm = arm;
    mesh(new THREE.BoxGeometry(2.4, .25, .25), M.mustard, arm).position.x = 1.2;
    mesh(new THREE.BoxGeometry(.8, .6, 1.1), M.navy, arm).position.set(2.5, -.4, 0);
    // 漫游车
    const rover = new THREE.Group(); scene.add(rover); B.rover = rover;
    mesh(new THREE.BoxGeometry(2.8, .9, 1.7), M.cream, rover).position.y = 1.15;
    mesh(new THREE.BoxGeometry(1.2, .12, 1.6), M.tealD, rover).position.set(-.5, 1.66, 0);
    mesh(new THREE.CylinderGeometry(.06, .06, 1.3, 6), M.navy, rover).position.set(.9, 2.2, 0);
    mesh(new THREE.BoxGeometry(.5, .36, .42), M.orange, rover).position.set(.9, 2.9, 0);
    for (const x of [-1, 0, 1]) for (const z of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(.45, .45, .36, 14), M.navy, rover); w.rotation.x = Math.PI / 2; w.position.set(x * 1.1, .45, z); }
    B.roverCable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(), V3()]), new THREE.LineBasicMaterial({ color: P.night })); scene.add(B.roverCable); B.roverCable.visible = false;
    // 上升器（返航火箭）与发射台
    const pad = new THREE.Group(); pad.position.set(-17, H(-17, 26), 26); base.add(pad); B.pad = pad;
    mesh(new THREE.CylinderGeometry(3.4, 3.6, .4, 24), M.navy, pad).position.y = .2;
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + .4; const l = mesh(new THREE.BoxGeometry(.25, 3, .25), M.grey, pad); l.position.set(Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6); }
    B.rocket = makeRocket(); B.rocket.position.y = .4; pad.add(B.rocket);
    B.tower = mesh(new THREE.BoxGeometry(.6, 11, .6), M.grey, pad); B.tower.position.set(2.6, 5.5, 0);
    // 补给舱与新乘组舱
    B.pods = []; for (let i = 0; i < 2; i++) { const c = makeCapsule(false); c.position.set(26 + i * 4.5, 0, 6 + i * 3); c.visible = false; c.userData.chute.visible = false; base.add(c); B.pods.push(c); }
    B.crewPods = []; for (let i = 0; i < 2; i++) { const c = makeCapsule(true); c.visible = false; scene.add(c); B.crewPods.push(c); }
    // 宇航员：主角 + 锻炼者 + 结局乘组
    B.astro = makeAstro(); scene.add(B.astro); B.astroPos = V3(4, 0, 10);
    B.runner = makeAstro(P.teal); B.runner.visible = false; scene.add(B.runner);
    B.crew = [P.orange, P.teal, P.mustard, P.green].map(c => { const a = makeAstro(c); a.visible = false; scene.add(a); return a; });
    // 尘卷风
    const dv = new THREE.Group(); dv.visible = false; scene.add(dv); B.devil = dv;
    for (let i = 0; i < 7; i++) { const ring = mesh(new THREE.TorusGeometry(.7 + i * .45, .22 + i * .03, 6, 16), toon(0xc9663a, { flatShading: true }), dv); ring.rotation.x = Math.PI / 2; ring.position.y = i * 1.6; ring.castShadow = false; }
  }

  /* ---------- 状态同步：玩家的每个决定都会写到这里 ---------- */
  function applyVis(initial) {
    const v = vis;
    B.rows.forEach((r, i) => { const want = i < v.rows; if (want && !r.visible) initial ? r.visible = true : pop(r, r.getWorldPosition(V3())); else if (!want) r.visible = false; });
    B.domes.forEach((d, i) => { const want = i < v.domes; if (want && !d.visible) { if (initial) { d.visible = d.userData.tube.visible = true; } else { pop(d.userData.tube, d.position.clone()); pop(d); } } });
    B.mods.forEach((m, i) => { if (i < 2) return; const want = i - 2 < v.labs; if (want && !m.visible) initial ? m.visible = true : pop(m, V3(Math.cos(MOD_ANG[i]) * 7, 0, Math.sin(MOD_ANG[i]) * 7)); });
    B.tanks.forEach((t, i) => { const want = i < v.tanks; if (want && !t.visible) initial ? t.visible = true : pop(t, t.getWorldPosition(V3())); });
    B.sci.forEach(o => { const want = v.sci >= o.userData.th; if (want && !o.visible) initial ? o.visible = true : pop(o, o.getWorldPosition(V3())); });
    B.evaFlags.forEach((f, i) => { const want = i < 5 ? i < v.evaCount : v.sample; if (want && !f.visible) initial ? f.visible = true : pop(f, f.getWorldPosition(V3())); });
    B.pods.forEach((p, i) => { if (i < v.pods && !p.visible && !p.userData.landing) { if (initial) p.visible = true; else landCapsule(p, p.position.clone(), false); } });
    if (v.shieldLv >= 2 && !B.sandbags.visible) initial ? B.sandbags.visible = true : pop(B.sandbags, V3(-3, 0, 4));
    B.bat.children.forEach(c => { if (c.userData.extra) { const want = v.battBonus > 0; if (want && !c.visible) pop(c, c.getWorldPosition(V3())); else if (!want) c.visible = false; } });
  }
  function landCapsule(c, at, crew, dur = 6500, done) {
    c.userData.landing = true; c.visible = true; c.scale.setScalar(1); c.userData.chute.visible = true; c.userData.chute.scale.setScalar(1); c.userData.chute.position.x = 0;
    const y0 = 140, gy = H(at.x, at.z);
    tween(dur, k => { const e = 1 - Math.pow(1 - k, 2.2); c.position.set(at.x + Math.sin(k * 7) * 2 * (1 - k), lerp(gy + y0, gy, e), at.z); c.rotation.z = Math.sin(k * 9) * .08 * (1 - k); },
      () => { burst(V3(at.x, gy, at.z), 14, 'dust', 5); tween(1200, k => { c.userData.chute.scale.setScalar(Math.max(.001, 1 - k)); c.userData.chute.position.x = k * 5; }, () => { c.userData.chute.visible = false; c.userData.landing = false; done && done(); }); });
  }

  /* ======================= 太空场景 ======================= */
  const PLANET_VS = `varying vec3 vN,vO,vW;varying vec2 vUv;void main(){vUv=uv;vO=normalize(position);vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
  const NOISE3 = `float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
      return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fb3(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n3(p);p*=2.03;a*=.5;}return s;}
    vec3 hx(float r,float g,float b){return vec3(r,g,b)/255.;}`;
  // 用 Natural Earth 1:110m 的真实海岸线，画一张海报配色的等距圆柱投影地图
  function earthTexture() {
    const W = 2048, Hh = 1024, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
    g.fillStyle = '#3f8f93'; g.fillRect(0, 0, W, Hh);
    try {
      const land = topojson.feature(LAND110, LAND110.objects.land);
      const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, Hh / 2]);
      const path = d3.geoPath(proj, g);
      g.beginPath(); path(land); g.fillStyle = '#7fae5b'; g.fill();
      g.save(); g.beginPath(); path(land); g.clip();
      const rect = (lo0, la0, lo1, la1, col) => { const a = proj([lo0, la1]), b = proj([lo1, la0]); g.fillStyle = col; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
      // 印刷网点：从中心向外渐渐变小，边缘自然消失
      const blob = (lo, la, rx, ry, col) => { const p = proj([lo, la]), RX = rx * W / 360, RY = ry * Hh / 180; g.fillStyle = col;
        for (let y = p[1] - RY * 1.3; y < p[1] + RY * 1.3; y += 7) for (let x = p[0] - RX * 1.3 + ((y / 7 | 0) % 2) * 3.5; x < p[0] + RX * 1.3; x += 7) {
          const n = vnoise(x * .02, y * .02) * .6, d = Math.hypot((x - p[0]) / RX, (y - p[1]) / RY) - n + .3, r = 4.6 * (1 - d);
          if (r > .4) { g.beginPath(); g.arc(x, y, Math.min(r, 4.4), 0, 7); g.fill(); } } };
      blob(-62, -5, 16, 10, '#5f9446'); blob(22, 0, 10, 6, '#5f9446'); blob(112, 0, 14, 7, '#5f9446');
      blob(10, 23, 26, 8, '#e6a83f'); blob(45, 22, 12, 8, '#e6a83f'); blob(62, 30, 8, 5, '#dcb064'); blob(100, 41, 14, 5, '#dcb064'); blob(83, 39, 7, 3, '#e6a83f');
      blob(133, -25, 14, 7, '#e6a83f'); blob(20, -24, 6, 5, '#dcb064'); blob(-111, 33, 7, 5, '#dcb064'); blob(-69, -24, 2.5, 7, '#dcb064'); blob(-68, -45, 4, 6, '#dcb064');
      rect(-180, -90, 180, -60, '#f4e7c8'); rect(-75, 59, -10, 84, '#f4e7c8'); rect(-180, 74, 180, 90, '#f4e7c8');
      g.restore();
      g.beginPath(); path(land); g.strokeStyle = '#2b1a24'; g.lineWidth = 2.2; g.stroke();
    } catch (e) { console.warn('earth map', e); }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function planetMat(kind) {
    return new THREE.ShaderMaterial({ uniforms: { L: { value: V3(-.75, .3, .7).normalize() }, time: { value: 0 }, px: { value: 1 }, map: { value: kind === 'earth' ? earthTexture() : null } },
      vertexShader: PLANET_VS,
      fragmentShader: `uniform vec3 L;uniform float time,px;uniform sampler2D map;varying vec3 vN,vO,vW;varying vec2 vUv;${NOISE3}
        void main(){
          vec3 n=normalize(vN);float lit=dot(n,L);
          float tone=lit>.4?1.:(lit>.05?.74:.42);
          vec3 o=vO;vec3 c;
          ${kind === 'earth' ? `
            vec3 m=texture2D(map,vUv).rgb;
            bool ocean=distance(m,hx(63.,143.,147.))<.12;
            c=m;
            float cl=fb3(o*3.1+vec3(time*.02,0.,0.)+20.);
            if(cl>.67)c=hx(244.,231.,200.);
            c*=tone;
            if(lit<.05){c=mix(hx(31.,44.,63.),c,.38);
              vec2 g=gl_FragCoord.xy/(4.*px);vec2 f=fract(g)-.5;
              if(!ocean&&cl<.67&&m.b<.5&&h3(floor(o*70.))>.62&&length(f)<.24)c=hx(230.,168.,63.);}
          ` : kind === 'mars' ? `
            float k=fb3(o*2.6+1.);
            c=k>.58?hx(142.,47.,34.):(k>.45?hx(184.,69.,42.):hx(217.,105.,47.));
            if(fb3(o*7.)>.62)c=hx(90.,29.,29.);
            if(o.y>.88||o.y<-.9)c=hx(244.,231.,200.);
            c*=tone;if(lit<.05)c=mix(hx(43.,26.,36.),c,.4);
          ` : `
            float k=fb3(o*4.+5.);c=k>.55?hx(170.,160.,150.):hx(214.,204.,186.);
            if(fb3(o*9.)>.6)c=hx(130.,122.,118.);
            c*=tone;if(lit<.05)c=mix(hx(31.,28.,40.),c,.4);
          `}
          vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,V),0.),3.);
          ${kind === 'moon' ? '' : `c=mix(c,${kind === 'earth' ? 'hx(140.,199.,195.)' : 'hx(239.,193.,114.)'},fr*.8*step(-.25,lit));`}
          gl_FragColor=vec4(c,1.);}` });
  }
  function buildSpace() {
    const scene = new THREE.Scene(); SP.scene = scene;
    const sky = new THREE.ShaderMaterial({ side: THREE.BackSide,
      uniforms: { time: { value: 0 }, px: { value: 1 }, sunD: { value: V3(-1, .25, .35).normalize() } },
      vertexShader: `varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time,px;uniform vec3 sunD;varying vec3 v;
        float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
        vec3 hx(float r,float g,float b){return vec3(r,g,b)/255.;}
        void main(){vec3 d=normalize(v);
          float mw=1.-abs(dot(d,normalize(vec3(.75,.55,-.35))));
          float bi=floor(pow(mw,3.)*4.);
          vec3 c=mix(hx(19.,16.,28.),hx(40.,24.,38.),bi/4.);
          vec2 g=gl_FragCoord.xy/(6.*px);g=vec2(g.x+g.y,g.y-g.x)*.7071;vec2 f=fract(g)-.5;
          float rr=.36*smoothstep(.75,1.,mw);
          c=mix(c,hx(90.,40.,58.),smoothstep(rr,rr-.07,length(f))*step(.02,rr));
          vec2 sp=vec2(atan(d.x,d.z),asin(d.y))*90.;vec2 id=floor(sp);
          float s=step(.965-mw*.03,h1(id))*step(length(fract(sp)-.5),.08+.06*sin(time*1.5+h1(id+1.)*50.));
          c=mix(c,hx(244.,231.,200.),s);
          float a=acos(clamp(dot(d,sunD),-1.,1.));
          if(a<.16)c=mix(c,hx(63.,143.,147.),.25);if(a<.1)c=mix(c,hx(140.,199.,195.),.4);if(a<.03)c=hx(251.,243.,223.);
          gl_FragColor=vec4(c,1.);}` });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), sky)); SP.sky = sky;
    SP.E = V3(0, 0, 0); SP.M = V3(320, 50, -560);
    SP.earth = new THREE.Mesh(new THREE.SphereGeometry(10, 128, 64), planetMat('earth')); scene.add(SP.earth);
    SP.mars = new THREE.Mesh(new THREE.SphereGeometry(7, 96, 48), planetMat('mars')); SP.mars.position.copy(SP.M); scene.add(SP.mars);
    SP.moon = new THREE.Mesh(new THREE.SphereGeometry(2.7, 48, 24), planetMat('moon')); scene.add(SP.moon);
    const ship = new THREE.Group(); scene.add(ship); SP.ship = ship;
    const sc = new THREE.Mesh(new THREE.ConeGeometry(.5, 1, 16), new THREE.MeshBasicMaterial({ color: P.cream })); sc.rotation.x = Math.PI / 2; ship.add(sc);
    const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push(V3().lerpVectors(SP.E, SP.M, t).add(V3(0, Math.sin(t * Math.PI) * 60, 0))); }
    SP.route = new THREE.CatmullRomCurve3(pts);
    const rl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(SP.route.getPoints(200)), new THREE.LineDashedMaterial({ color: P.mustard, dashSize: 3, gapSize: 4 })); rl.computeLineDistances(); scene.add(rl);
  }

  /* ======================= 后期 ======================= */
  function buildPost() {
    postM = new THREE.ShaderMaterial({ depthWrite: false, depthTest: false, uniforms: { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, res: { value: new THREE.Vector2() }, px: { value: 1 },
      near: { value: camera.near }, far: { value: camera.far }, time: { value: 0 }, skyD: { value: 900 }, edgeFar: { value: 520 }, flash: { value: 0 }, alarm: { value: 0 } },
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
          c=mix(c,vec3(251.,243.,223.)/255.,flash*.45);
          vec2 q=vUv-.5;
          c=mix(c,vec3(.75,.12,.08),alarm*.28*(.5+.5*sin(time*6.))*smoothstep(.15,.6,length(q)));
          c*=.95+.07*h1(gl_FragCoord.xy*.37+fract(time)*31.);
          c*=1.-dot(q,q)*.38;
          gl_FragColor=vec4(c,1.);}` });
    postS = new THREE.Scene(); postC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); postS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postM));
  }

  /* ======================= 太阳、时间、天气 ======================= */
  function sunDir(tod = st.tod) {
    const ph = (((tod % 1) + 1) % 1 - .25) / .5 * Math.PI;
    return V3(.7 * Math.cos(ph) + .15 * Math.sin(ph), .9 * Math.sin(ph), .7 * Math.cos(ph) - .15 * Math.sin(ph)).normalize();
  }
  const cDay = new THREE.Color(0xe39a55), cDusk = new THREE.Color(0xc4694a), cNight = new THREE.Color(0x3a2235), cStorm = new THREE.Color(0xb0683c), cStormN = new THREE.Color(0x4a2a2a), tmpC = new THREE.Color();
  const panelClean = new THREE.Color(P.tealD), panelDirty = new THREE.Color(0x9a5a3a);
  const plantOk = new THREE.Color(P.green), plantSick = new THREE.Color(0xd8b84a), plantDead = new THREE.Color(0x8a5a3a), plantFrost = new THREE.Color(0xe8f0ee);
  let steamT = 0, exT = 0, devilT = 0;

  function updateSurface(t, dt) {
    if (todAnim) { const k = Math.min(1, (NOW - todAnim.t0) / todAnim.dur); st.tod = todAnim.from + (todAnim.to - todAnim.from) * (todAnim.curve ? todAnim.curve(k) : ease(k)); if (k >= 1) { const cb = todAnim.done; todAnim = null; st.tod %= 1; cb && cb(); } }
    st.storm += (st.stormT - st.storm) * Math.min(1, dt * .8);
    st.aurora += (st.auroraT - st.aurora) * Math.min(1, dt * .7);
    st.flash = Math.max(0, st.flash - dt * .9);
    const sd = sunDir();
    st.night = 1 - ss(-.16, .1, sd.y);
    const dusk = ss(.35, .05, Math.abs(sd.y)) * (1 - st.night);
    const U = S.sky.uniforms; U.sun.value.copy(sd); U.night.value = st.night; U.storm.value = st.storm; U.time.value = t; U.aurora.value = st.aurora; U.flash.value = st.flash;
    tmpC.copy(cDay).lerp(cDusk, dusk).lerp(cNight, st.night);
    tmpC.lerp(st.night > .5 ? cStormN : cStorm, st.storm * .85);
    S.scene.fog.color.copy(tmpC);
    S.scene.fog.density = (.0066 + st.storm * .022) * Math.min(1, 26 / Math.max(1, camera.position.y));
    S.dl.intensity = (.78 * (1 - st.night) + .16 * st.night) * (1 - .55 * st.storm) + st.flash * .5;
    S.dl.color.setHex(st.night > .5 ? 0x9aa6d8 : 0xfff2dc);
    S.hemi.intensity = lerp(.38, .3, st.night);
    S.hemi.color.setHex(st.night > .5 ? (st.frost > .5 ? 0x7a9ac8 : 0x4a5a8a) : 0x9fd0cc);
    const v = vis, lamp = ss(.2, .7, st.night) * (v.powerOut ? .15 : 1);
    S.lampHub.intensity = lamp * 1.1; S.lampGh.intensity = (lamp * 1.2 + v.foodWork * .08) * (1 - v.blight * .5);
    // 警报
    const alert = v.o2 < 25 || v.food < 20 || v.powerOut;
    B.beacon.visible = alert && (t % .8) < .45; S.lampAlarm.intensity = alert ? (Math.sin(t * 8) > 0 ? 1.4 : 0) : 0;
    B.sign.visible = v.dosePct > .6; B.signFace.material.color.setHex(v.dosePct > .8 && (t % 1) < .5 ? P.red : P.mustard);
    // 窗户：避难所 / 断电
    for (const w of B.windows) { let on = !v.powerOut || ((t * 7 + w.id) % 5) < .3; if (v.shelter && w.userData.grp !== 'shelter') on = false; w.material = on ? M.win : M.winOff; }
    // 温室植物：病害发黄、缺粮枯萎、寒夜结霜
    M.plant.color.copy(plantOk).lerp(plantSick, Math.min(1, v.blight)).lerp(plantDead, ss(30, 5, v.food)).lerp(plantFrost, st.frost * st.night);
    const keep = 1 - v.cull;
    for (const p of B.plants) { const show = p.userData.cull < keep; const s = p.userData.s * (.35 + v.growth * .9) * (show ? 1 : .001) * (1 - .3 * ss(30, 5, v.food)); p.scale.setScalar(Math.max(.001, s / p.userData.s)); p.position.y = s * .7; }
    M.glass.emissive.setRGB(0, .04 + v.foodWork * .025 * (1 - v.blight), .02);
    // 屏蔽土堆：等级越高越厚
    B.mounds.forEach((m, i) => {
      const need = [1, 3, 4, 5][i], modOk = i < 2 || (i - 2) < v.labs;
      const want = v.shieldLv >= need && modOk ? .6 + (v.shieldLv - need) * .14 : 0;
      m.userData.cur += (want - m.userData.cur) * Math.min(1, dt * 1.2);
      const c = m.userData.cur; m.scale.set(5.4 * c, 2.7 * c, 2.7 * c); m.visible = c > .02; });
    // 太阳能板：清洁度、沙尘、损坏
    M.panel.color.copy(panelClean).lerp(panelDirty, Math.min(1, Math.max(0, (1 - v.panelEff) * 2.2 + st.storm * .5)));
    const broken = B.rows[0].userData.panels[1];
    broken.rotation.x = lerp(broken.rotation.x, v.damaged ? .9 : -.55, dt * 2); broken.rotation.z = lerp(broken.rotation.z, v.damaged ? .35 : 0, dt * 2);
    broken.position.y = lerp(broken.position.y, v.damaged ? .9 : 1.75, dt * 2);
    if (v.damaged && Math.random() < dt * 2) spark(broken.getWorldPosition(V3()), V3((Math.random() - .5) * 3, 3, (Math.random() - .5) * 3), 0xfff3a0, 2.5, .5);
    // 电池电量条
    B.cells.forEach((c, i) => { c.visible = i < 8 || v.battBonus > 0; c.material = i < v.batt ? M.tealGlow : M.winOff; });
    if (v.battBonus > 0) { B.roverCable.visible = true; B.rover.position.set(11, H(11, 11), 11); B.rover.rotation.y = .8; B.roverCable.geometry.setFromPoints([V3(11, 1.2, 11), V3(10.5, 1, 9)]); }
    else { B.roverCable.visible = false;
      if (!B.rover.userData.mission) { const ra = t * .05, R = 36; B.rover.position.set(Math.cos(ra) * R, H(Math.cos(ra) * R, Math.sin(ra) * R), Math.sin(ra) * R); B.rover.rotation.y = -ra - Math.PI / 2; } }
    // 制氧站：分到的电越多，蒸汽越勤；故障冒黑烟；抢修时火花四溅
    steamT -= dt * (v.o2Fault === 1 ? 4 : .3 + v.o2Work * .35);
    if (steamT <= 0) { steamT = 1; const p = V3(4.9, 4.6, -16); if (v.o2Fault === 1) puff(p, { mat: 'dark', s0: .5, s1: 2.6, life: 3, vel: V3(.6, 2, .2) }); else if (v.o2Work > 0) puff(p, { mat: 'cream', s0: .3, s1: 1.4, life: 1.8 }); }
    if (v.o2Fault === 2 && Math.random() < dt * 25) spark(V3(4 + Math.random() * 2, 2 + Math.random(), -14.7), V3((Math.random() - .5) * 4, 2 + Math.random() * 3, 2), 0xffe08a, 2.5, .7);
    B.o2light.material = v.o2Fault === 1 ? M.red : (v.o2Work > 0 ? M.tealGlow : M.winOff);
    const tankC = v.o2 < 25 && (t % .8) < .4 ? M.red : M.tealGlow;
    B.tanks.forEach(tk => { tk.userData.band.material = tankC; tk.userData.band.scale.y = .4 + v.o2 / 100 * 3; tk.userData.band.position.y = .3 + v.o2 / 100 * 1.1; });
    // 挖土机：屏蔽施工时来回运土
    if (v.shieldWork > 0) exT += dt * (.4 + v.shieldWork * .08);
    const ep = (Math.sin(exT) + 1) / 2;
    B.ex.position.set(lerp(-11, -7, ep), H(-9, 13), lerp(14, 11, ep)); B.ex.rotation.y = -.6 + (Math.cos(exT) > 0 ? 0 : Math.PI);
    B.exArm.rotation.z = v.shieldWork > 0 ? Math.sin(exT * 3) * .35 - .1 : -.35;
    if (v.shieldWork > 0 && Math.random() < dt * (1 + v.shieldWork * .5)) puff(B.ex.position.clone().add(V3(0, .4, 0)), { mat: 'dust', s0: .3, s1: 1.2, life: 1.2 });
    // 科学站：分到电就运转；日凌时天线失联
    B.vane.rotation.y += dt * (2 + v.sciWork * 2);
    B.dish.rotation.z = v.conj ? Math.sin(t * .3) * .4 : 0;
    B.antBeacon.visible = !v.conj && (t % 1.6) < .3;
    B.sci.forEach(o => { if (o.userData.drill) o.userData.drill.rotation.y += dt * v.sciWork * 3; if (o.userData.tele) o.userData.tele.rotation.y = Math.sin(t * .1) * (v.sciWork ? 1 : .1); if (o.userData.flag) o.userData.flag.rotation.y = Math.sin(t * 2) * .2; });
    // User control takes priority over the decorative automatic walk.
    const goal = v.eva ? V3(-26.5, 0, -19) : V3(4, 0, 10);
    const d = V3(goal.x - B.astroPos.x, 0, goal.z - B.astroPos.z), dist = d.length();
    let moving = dist > .3;
    if (playerEnabled) {
      player.setActive(inputEnabled); player.update(dt, B.astroPos, blockers);
      moving = player.moving; B.astro.rotation.y = player.facing;
    } else if (moving) { B.astroPos.addScaledVector(d.normalize(), Math.min(dist, dt * 9)); B.astro.rotation.y = Math.atan2(d.x, d.z); }
    else { B.astro.rotation.y = v.eva ? Math.atan2(-30 - B.astroPos.x, -22 - B.astroPos.z) : Math.atan2(sd.x, sd.z); }
    B.astro.position.set(B.astroPos.x, H(B.astroPos.x, B.astroPos.z), B.astroPos.z); walkPose(B.astro, t, moving);
    B.astro.visible = !v.shelter && !B.crew[0].visible;
    markers.forEach(m => { m.ring.rotation.z += dt * .3; m.beacon.position.y = 3.6 + Math.sin(t * 2) * .25; });
    anchors.astro.set(B.astroPos.x, B.astro.position.y + 4.6, B.astroPos.z);
    // 锻炼的队友绕着枢纽慢跑
    B.runner.visible = v.exercise && !v.shelter && st.night < .5 && !B.crew[0].visible;
    if (B.runner.visible) { const ra = t * .35; B.runner.position.set(Math.cos(ra) * 6.5, 0, Math.sin(ra) * 6.5); B.runner.rotation.y = -ra; walkPose(B.runner, t * 1.4, true); }
    // 尘卷风
    if (v.devil > 0) { devilT += dt; B.devil.visible = true; const k = (devilT * .06) % 1; const x = lerp(40, -10, k), z = lerp(-22, 4, k); B.devil.position.set(x, H(x, z), z);
      B.devil.children.forEach((r, i) => { r.rotation.z += dt * (3 + i); r.position.x = Math.sin(t * 3 + i) * .25 * i; });
      if (Math.random() < dt * 30) spark(B.devil.position.clone().add(V3((Math.random() - .5) * 4, Math.random() * 10, (Math.random() - .5) * 4)), V3(Math.random() * 4 - 2, 2, Math.random() * 4 - 2), 0xe8b07a, 2, 1.2); }
    else B.devil.visible = false;
    // 信号、尘埃
    st.signal = Math.max(0, st.signal - dt);
    const sig = Math.min(1, st.signal * 2);
    S.line.material.opacity = sig * .75; S.pulses.material.opacity = sig;
    const pp = S.pulses.geometry.attributes.position, pv = V3();
    for (let i = 0; i < 6; i++) { const u = Math.pow(((t * .12 + i / 6) % 1), 1.6); pv.lerpVectors(S.dishTip, S.earthPt, u); pp.setXYZ(i, pv.x, pv.y, pv.z); } pp.needsUpdate = true;
    const dp = S.dust.geometry.attributes.position; const spd = .04 + st.storm * .5;
    for (let i = 0; i < dp.count; i++) { let x = dp.getX(i) + spd; if (x > 80) x -= 160; dp.setX(i, x); } dp.needsUpdate = true;
    S.dust.material.opacity = .45 + st.storm * .45; S.dust.material.size = 2 + st.storm * 1.5;
    postM.uniforms.alarm.value = st.alarm;
  }

  /* ======================= 镜头 ======================= */
  const POSES = {
    overview: t => { const a = 1.12 + .2 * Math.sin(t * .04), R = 60 - 3 * Math.sin(t * .05); return [V3(Math.cos(a) * R, 17 + 1.2 * Math.sin(t * .07), Math.sin(a) * R), V3(-2, 3.5, -3)]; },
    hub: t => [V3(14 + Math.sin(t * .1), 7, 18), V3(0, 3, 0)],
    o2: t => [V3(15 + Math.sin(t * .1), 13, 12), V3(7, 2, -15)],
    food: t => [V3(-2 + Math.sin(t * .1), 9, 20), V3(-15, 2, 3)],
    solar: t => [V3(34, 9 + Math.sin(t * .1) * .5, 8), V3(20, 1.5, -10)],
    shield: t => [V3(6, 7, 26 + Math.sin(t * .1)), V3(-5, 1.8, 7)],
    sci: t => vis.eva ? [V3(6, 14, 14), V3(-20, 1, -14)] : [V3(28, 7, 28), V3(16, 2.5, 13)],
    antenna: t => [V3(10, 9, 6), V3(-6, 8, -12)],
    battery: t => [V3(18, 5, 20), V3(8, 1.5, 8)],
    astro: t => [V3(12, 5, 22), V3(4, 2.8, 10)],
    pad: t => [V3(-1, 7, 44), V3(-17, 6, 26)],
    eva: t => [V3(6, 14, 14), V3(-20, 1, -14)],
    sky: t => [V3(18, 5, 26), earthDir.clone().multiplyScalar(200)],
    pods: t => [V3(40, 9, 24), V3(28, 2, 8)]
  };
  function updateCamera(t, dt) {
    let want;
    if (playerEnabled && !cam.override) {
      const p = B.astro.position, look = p.clone().add(V3(0, 2.6, 0));
      const offset = V3(Math.sin(player.yaw) * 12, 5 + player.pitch * 9, Math.cos(player.yaw) * 12);
      const desired = look.clone().add(offset), ray = new THREE.Raycaster(look, offset.clone().normalize(), .8, offset.length());
      const hits = ray.intersectObjects(cameraBlockers, true);
      if (hits.length) desired.copy(look).addScaledVector(offset.normalize(), Math.max(2.5, hits[0].distance - .7));
      desired.y = Math.max(desired.y, H(desired.x, desired.z) + 2);
      want = [desired, look];
    } else want = cam.override ? cam.override(t) : (POSES[cam.focus] || POSES.overview)(t);
    const k = cam.override && cam.override.hard ? 1 : 1 - Math.exp(-dt * 1.5);
    cam.pos.lerp(want[0], k); cam.tgt.lerp(want[1], k);
    camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
  }

  /* ======================= 开场长镜头 ======================= */
  const INTRO_T = [0, 8, 15, 23, 28];
  function introPose(t) {
    const E = SP.E, Mp = SP.M;
    if (!SP.camCurve) SP.camCurve = new THREE.CatmullRomCurve3([V3(8, 3, 30), V3(-16, 10, 76), V3(130, 70, -150), Mp.clone().add(V3(-14, 6, 30)), Mp.clone().add(V3(-3, 1.5, 9.5))], false, 'centripetal');
    let i = 0; while (i < INTRO_T.length - 2 && t > INTRO_T[i + 1]) i++;
    let s = Math.min(1, Math.max(0, (t - INTRO_T[i]) / (INTRO_T[i + 1] - INTRO_T[i])));
    if (i === 0) s = s * s * (2 - s) * .5 + s * s * .5; else if (i === 3) s = 1 - (1 - s) * (1 - s);
    const pos = SP.camCurve.getPoint(Math.min(1, Math.max(0, (i + s) / 4)));
    return [pos, V3().lerpVectors(E, Mp, ss(8, 17, t))];
  }

  /* ======================= 结局动画 ======================= */
  function launchRocket(opts, cb) {
    const r = B.rocket, t0 = NOW, pad = B.pad.position.clone(), dur = opts.dur || 15000;
    let fired = false;
    st.alarm = opts.alarm ? 1 : 0;
    tween(dur, k => {
      const s = k * dur / 1000;
      if (s > 3 && !fired) { fired = true; r.userData.flame.visible = true; st.flash = .6; burst(pad.clone().add(V3(0, .5, 0)), 18, 'cream', 7); }
      if (fired) {
        const tt = s - 3, y = .4 + 1.1 * tt * tt, side = Math.max(0, tt - 2.5);
        r.position.set(earthDir.x * side * side * 2.2, y, earthDir.z * side * side * 2.2);
        r.rotation.x = -Math.min(.6, side * .12);
        r.userData.flame.scale.set(1 + Math.random() * .25, 1 + Math.random() * .5 + tt * .1, 1 + Math.random() * .25);
        if (tt < 6 && Math.random() < .9) puff(pad.clone().add(r.position).add(V3((Math.random() - .5) * 2, -1, (Math.random() - .5) * 2)), { mat: Math.random() < .5 ? 'cream' : 'grey', s0: 1, s1: 4 + Math.random() * 3, life: 3.5, vel: V3((Math.random() - .5) * 6, Math.random() * 2, (Math.random() - .5) * 6), drag: .96 });
        if (tt < 1.5) for (let i = 0; i < 3; i++) spark(pad.clone().add(V3(0, .5, 0)), V3((Math.random() - .5) * 18, Math.random() * 4, (Math.random() - .5) * 18), 0xffc55a, 3, .9);
      } else if (s > 1 && Math.random() < .3) puff(pad.clone().add(V3((Math.random() - .5) * 3, .5, (Math.random() - .5) * 3)), { mat: 'cream', s0: .3, s1: 1.4, life: 1.5 });
    }, () => { st.alarm = 0; cb && cb(); });
    const p0 = cam.pos.clone();
    cam.override = () => {
      const s = (NOW - t0) / 1000, rp = pad.clone().add(B.rocket.position);
      const pos = V3().lerpVectors(p0, V3(pad.x + 26, 6, pad.z + 24), ss(0, 3, s));
      if (s > 6) pos.lerp(V3(pad.x + 30, 18, pad.z + 40), ss(6, 12, s));
      const tgt = V3().lerpVectors(pad.clone().add(V3(0, 6, 0)), rp.clone().add(V3(0, 4, 0)), ss(3, 5, s));
      if (s > 9) tgt.lerp(earthDir.clone().multiplyScalar(300), ss(9, 14, s));
      return [pos, tgt];
    };
  }
  function crewWalk(points, dur) {
    B.crew.forEach((a, i) => { a.visible = true; a.userData.from = V3(Math.cos(i) * 2, 0, 3.6); a.userData.to = points[i]; a.position.copy(a.userData.from); });
    tween(dur, k => { B.crew.forEach((a, i) => { const kk = Math.min(1, Math.max(0, k * 1.3 - i * .08)); const p = V3().lerpVectors(a.userData.from, a.userData.to, ease(kk));
      a.position.set(p.x, H(p.x, p.z), p.z); const d = V3().subVectors(a.userData.to, a.userData.from); a.rotation.y = kk < 1 ? Math.atan2(d.x, d.z) : Math.atan2(earthDir.x, earthDir.z); walkPose(a, NOW / 1000 + i, kk > 0 && kk < 1); }); });
  }
  function ending(kind, cb) {
    const done = () => cb && cb();
    const setTod = (to, dur) => { todAnim = { from: st.tod, to: to < st.tod ? to + 1 : to, dur, t0: NOW, done: null }; };
    st.stormT = 0; vis.eva = false; vis.shelter = false;
    if (kind === 'discovery' || kind === 'success' || kind === 'home') {
      setTod(kind === 'home' ? 1.3 : .55, 4000);
      cam.override = () => [V3(4, 8, 52), V3(-17, 6, 26)];
      if (kind !== 'discovery') crewWalk([V3(-14, 0, 23), V3(-13, 0, 27), V3(-15, 0, 29.5), V3(-18.5, 0, 29)], 4200);
      setTimeout(() => { B.crew.forEach(a => a.visible = false); launchRocket({ dur: 16000 }, done); }, kind === 'discovery' ? 1500 : 4600);
    } else if (kind === 'builder') {
      setTod(.68, 3000);
      const t0 = NOW;
      cam.override = () => { const k = ss(0, 14, (NOW - t0) / 1000);
        return [V3(lerp(14, 52, k), lerp(6, 48, k), lerp(26, 70, k)), V3(lerp(2, 0, k), lerp(3, 0, k), lerp(6, 0, k))]; };
      landCapsule(B.crewPods[0], V3(-4, 0, 26), true, 9000);
      setTimeout(() => landCapsule(B.crewPods[1], V3(10, 0, 28), true, 8500, () => setTimeout(done, 1800)), 1600);
    } else if (kind === 'guardian') {
      setTod(.98, 4500); st.auroraT = 1;
      crewWalk([V3(2, 0, 17), V3(4, 0, 17.6), V3(6, 0, 17.2), V3(8, 0, 17.8)], 6000);
      const t0 = NOW;
      cam.override = () => { const k = ss(0, 13, (NOW - t0) / 1000);
        return [V3(lerp(18, 5, k), lerp(6, 5.5, k), lerp(48, 42, k)), V3(lerp(4, 5, k), lerp(4, 26, k), lerp(10, -60, k))]; };
      setTimeout(done, 14000);
    } else {
      setTod(.95, 3000); st.alarm = 1;
      cam.override = () => [V3(5, 7, 50), V3(-17, 6, 26)];
      crewWalk([V3(-14, 0, 23), V3(-13, 0, 27), V3(-15, 0, 29.5), V3(-18.5, 0, 29)], 3800);
      setTimeout(() => { B.crew.forEach(a => a.visible = false); launchRocket({ dur: 15000, alarm: true }, done); }, 4000);
    }
  }

  /* ======================= 主循环 ======================= */
  let lastT = 0;
  function frame(now) {
    NOW = now; const t = now / 1000, dt = Math.min(.05, t - (lastT || t)); lastT = t;
    runTweens();
    if (mode === 'space') {
      const it = introAnim ? (now - introAnim.t0) / 1000 : (introHold ?? 0);
      SP.sky.uniforms.time.value = t;
      for (const m of [SP.earth, SP.mars, SP.moon]) m.material.uniforms.time.value = t;
      SP.earth.rotation.y = 2.96 + t * .012; SP.mars.rotation.y = t * .04;
      SP.moon.position.set(Math.cos(t * .05) * 32, 6, Math.sin(t * .05) * 32);
      const sp = SP.route.getPoint(Math.min(1, Math.max(0, (it - 6) / 20))); SP.ship.position.copy(sp);
      SP.ship.lookAt(SP.route.getPoint(Math.min(1, Math.max(0, (it - 6) / 20 + .01))));
      if (introAnim) {
        const [p, l] = introPose(it); camera.position.copy(p); camera.lookAt(l);
        while (introAnim.cues.length && it >= introAnim.cues[0].t) introAnim.cb(introAnim.cues.shift().id);
        if (it >= INTRO_T[INTRO_T.length - 1] && !introAnim.ended) { introAnim.ended = true; introAnim.cb('end'); }
      } else if (introHold === null) { camera.position.set(Math.cos(t * .03) * 5 + 8, 3 + Math.sin(t * .05), 36); camera.lookAt(V3(-9, 0, 0)); }
      postM.uniforms.skyD.value = 3000; postM.uniforms.edgeFar.value = 900; postM.uniforms.alarm.value = 0;
      render(SP.scene, null, t);
    } else {
      updateSurface(t, dt); runPuffs(dt); runSparks(dt); updateCamera(t, dt);
      postM.uniforms.skyD.value = 900; postM.uniforms.edgeFar.value = 520;
      postM.uniforms.flash.value = st.flash * .6;
      render(S.scene, S.overlay, t);
    }
    requestAnimationFrame(frame);
  }
  function render(scene, overlay, t) {
    if (!rendering) return;
    postM.uniforms.time.value = t;
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postS, postC);
    if (overlay) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlay, camera); renderer.autoClear = true; }
  }
  function resize() {
    const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); rt.setSize(sz.x, sz.y);
    const pr = renderer.getPixelRatio();
    postM.uniforms.res.value.copy(sz); postM.uniforms.px.value = pr;
    S.sky.uniforms.px.value = pr; SP.sky.uniforms.px.value = pr; sparks.material.uniforms.px.value = pr;
    for (const m of [SP.earth, SP.mars, SP.moon]) m.material.uniforms.px.value = pr;
  }

  /* ======================= 对外接口 ======================= */
  function buildPlayerSites() {
    B.base.updateMatrixWorld(true);
    blockers.length = cameraBlockers.length = 0;
    const obstacle = object => {
      if (!object.visible) return;
      const b = new THREE.Box3();
      object.traverseVisible(child => { if (child.isMesh) { child.geometry.computeBoundingBox();b.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));cameraBlockers.push(child); } });
      blockers.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
      return b;
    };
    blockers.push({ x: 0, z: 0, r: 3.5 }); cameraBlockers.push(B.hub);
    B.mods.forEach(obstacle);
    B.domes.forEach((d, i) => { if (d.visible) { blockers.push({x: DOMES[i].x, z: DOMES[i].z, r: 4.4}); cameraBlockers.push(d); obstacle(d.userData.tube); } });
    const solar = obstacle(B.arr); obstacle(B.bat); const oxygen = obstacle(B.o2);
    blockers.push({x:-17,z:26,r:2.6},{x:-6,z:-12,r:.8},{x:-30,z:-22,r:2.1});
    cameraBlockers.push(B.rocket,B.ant);
    Object.assign(sites, {
      door: { x: 2, z: 12 }, solar: { x: solar.max.x + 2.5, z: (solar.min.z + solar.max.z) / 2 },
      o2: { x: oxygen.min.x - 2.5, z: oxygen.max.z + 2.5 }, rock: { x: -27, z: -18 },
      survey: { x: -20, z: 23 }, walk: { x: 11, z: 17 }
    });
  }
  return {
    init(el) {
      stage = el;
      FOGQ = THREE.ShaderChunk.fog_fragment.replace(/gl_FragColor\.rgb\s*=\s*mix/, 'fogFactor=floor(fogFactor*5.0+0.3)/5.0;\n\tgl_FragColor.rgb = mix');
      const gd = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
      grad = new THREE.DataTexture(gd, 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      stage.appendChild(renderer.domElement);
      camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
      rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType;
      buildSpace(); buildSurface(); buildPost(); applyVis(true);
      buildPlayerSites(); markerGroup = new THREE.Group(); S.scene.add(markerGroup);
      let drag = null;
      renderer.domElement.addEventListener('pointerdown', e => { if (playerEnabled && inputEnabled) { drag = {x:e.clientX,y:e.clientY,id:e.pointerId}; renderer.domElement.setPointerCapture(e.pointerId); } });
      renderer.domElement.addEventListener('pointermove', e => { if (!drag || !inputEnabled) return; player.yaw -= (e.clientX-drag.x)*.006; player.pitch = Math.max(-.12,Math.min(.8,player.pitch+(e.clientY-drag.y)*.004)); drag.x=e.clientX;drag.y=e.clientY; });
      for (const event of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.addEventListener(event,()=>{drag=null;});
      addEventListener('resize', resize); resize();
      requestAnimationFrame(frame);
    },
    get mode() { return mode; },
    get controller() { return player; },
    setPlayerActive(active) { playerEnabled = active; inputEnabled = active; player.setActive(active); if (active) { cam.override = null; player.yaw = 0; buildPlayerSites(); } },
    setPlayerInput(active) { inputEnabled = active && playerEnabled; player.setActive(inputEnabled); },
    getPlayer() { return { x:B.astroPos.x, z:B.astroPos.z, yaw:player.yaw, active:playerEnabled }; },
    resetPlayer() { B.astroPos.set(sites.door.x,0,sites.door.z); player.clear(); player.yaw=0; },
    getSite(name) { return sites[name] || sites.rock; },
    setMarkers(entries) {
      markers.forEach(m => { m.ring.geometry.dispose();m.ring.material.dispose(); m.beacon.geometry.dispose();m.beacon.material.dispose(); }); markers.length=0;
      markerGroup.clear();
      entries.forEach(e => { const p=sites[e.target] || e, color=e.done?0x7fae5b:0xffdf79;
        const ring=new THREE.Mesh(new THREE.RingGeometry(1.5,1.8,36),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85}));
        ring.rotation.x=-Math.PI/2;ring.position.set(p.x,H(p.x,p.z)+.08,p.z);markerGroup.add(ring);
        const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.55,0),new THREE.MeshBasicMaterial({color}));beacon.position.set(p.x,3.6,p.z);markerGroup.add(beacon);markers.push({ring,beacon});
      });
    },
    setRendering(active) { rendering = active; },
    setMode(m) { mode = m; },
    playIntro(cues, cb) { introHold = null; introAnim = { t0: performance.now(), cues: cues.slice().sort((a, b) => a.t - b.t), cb }; },
    // Keep the last shot while the entry haze covers the surface scene cut.
    stopIntro() { introHold = introAnim ? (performance.now() - introAnim.t0) / 1000 : 0; introAnim = null; },
    descend(cb) {
      introHold = null; mode = 'surface'; const t0 = performance.now();
      const from = [V3(60, 230, 160), V3(0, 0, 0)];
      cam.pos.copy(from[0]); cam.tgt.copy(from[1]);
      cam.override = (t) => { const k = Math.min(1, (performance.now() - t0) / 6500); const e = ease(k);
        const ov = POSES.overview(t); if (k >= 1 && cam.override) { cam.override = null; cb && cb(); }
        return [V3().lerpVectors(from[0], ov[0], e), V3().lerpVectors(from[1], ov[1], e)]; };
      cam.override.hard = true;
    },
    // 把游戏状态同步到画面；新出现的部件会“弹出”建成
    sync(state, initial) { Object.assign(vis, state); if (B.base) applyVis(initial); },
    ending,
    focus(name) { cam.focus = name || 'overview'; },
    lookEarth() { cam.override = null; cam.focus = 'sky'; if (st.night < .5) todAnim = { from: st.tod, to: st.tod < .92 ? .93 : 1.93, dur: 5000, t0: NOW, done: null }; },
    releaseCamera() { cam.override = null; B.crew.forEach(a => a.visible = false); B.crewPods.forEach(c => c.visible = false);
      B.rocket.position.set(0, .4, 0); B.rocket.rotation.set(0, 0, 0); B.rocket.userData.flame.visible = false; st.alarm = 0; st.auroraT = 0; },
    reset() {
      introHold = null;
      playerEnabled = inputEnabled = false; player.setActive(false); if (markerGroup) this.setMarkers([]);
      B.rows.forEach((r, i) => r.visible = i < 2); B.domes.forEach((d, i) => { d.visible = d.userData.tube.visible = i === 0; });
      B.mods.forEach((m, i) => m.visible = i < 2); B.tanks.forEach((t, i) => t.visible = i < 2); B.sci.forEach(o => o.visible = false);
      B.evaFlags.forEach(f => f.visible = false); B.pods.forEach(p => p.visible = false); B.sandbags.visible = false;
      B.mounds.forEach(m => { m.userData.cur = 0; m.visible = false; }); this.releaseCamera(); st.frost = 0; st.stormT = 0; st.tod = .71; todAnim = null; cam.focus = 'overview'; B.astroPos.set(4, 0, 10);
    },
    passNight(dur, cb) { todAnim = { from: st.tod, to: st.tod + 1, dur, t0: performance.now(), done: cb,
      curve: k => k < .14 ? .07 * ease(k / .14) : k < .74 ? .07 + .46 * (k - .14) / .6 : .53 + .47 * ease((k - .74) / .26) }; },
    get tod() { return st.tod; },
    get night() { return st.night; },
    setStorm(x) { st.stormT = x; },
    flare() { st.flash = 1; },
    setAurora(x) { st.auroraT = x; },
    setFrost(x) { st.frost = x; },
    signal(sec) { st.signal = sec; },
    // 一次性特效
    fx(name) {
      if (name === 'repair') for (let i = 0; i < 40; i++) setTimeout(() => spark(V3(4 + Math.random() * 2, 2.5, -14.6), V3((Math.random() - .5) * 5, 3 + Math.random() * 3, 2), 0xffe08a, 3, .8), i * 40);
      if (name === 'clean') { const r = B.arr.getWorldPosition(V3()); for (let i = 0; i < 16; i++) setTimeout(() => puff(V3(r.x + 4 + (Math.random() - .5) * 14, 2.5, r.z - 4 + (Math.random() - .5) * 10), { mat: 'dust', s0: .4, s1: 1.8, life: 1.6 }), i * 90); }
      if (name === 'pull') burst(V3(-12, 0, -2), 10, 'green', 3);
      if (name === 'sample') { B.rover.userData.mission = true; const from = B.rover.position.clone(), to = V3(-25, 0, -17);
        tween(5000, k => { const p = V3().lerpVectors(from, to, ease(k)); B.rover.position.set(p.x, H(p.x, p.z), p.z); B.rover.rotation.y = Math.atan2(to.x - from.x, to.z - from.z) - Math.PI / 2; }, () => setTimeout(() => B.rover.userData.mission = false, 6000)); }
      if (name === 'flashSmall') st.flash = .5;
    },
    project(name) {
      const a = anchors[name]; if (!a || mode !== 'surface') return null;
      const v = a.clone().project(camera); const r = stage.getBoundingClientRect();
      return { x: (v.x * .5 + .5) * r.width, y: (-v.y * .5 + .5) * r.height, vis: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
    }
  };
})();
