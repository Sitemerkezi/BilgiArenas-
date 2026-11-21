/* ============================================================
   js/arena3d.js — 3D lobi ve yarışma arenası (three r160)
   Yayın odalarında (500+/1.000+) performans profili: setCrowdMode / enterGame(pl,{viewers})
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'assets/models/character.glb';

const QUALITY = {
  low:    { dpr: 1,   shadows: false, sparkles: 30,  fps: 30, clouds: 3 },
  medium: { dpr: 1.5, shadows: false, sparkles: 80,  fps: 60, clouds: 5 },
  high:   { dpr: 2,   shadows: true,  sparkles: 160, fps: 60, clouds: 7 },
};

/* Yayın (500+/1.000+ katılımcı) performans profili: kalite ne olursa olsun üst sınırlar uygulanır.
   Amaç: DOM'daki canlı ilk-10 tablosu ve sık güncellenen sıralama için GPU/CPU payı bırakmak. */
const CROWD_CAPS = {
  big:  { dprMax: 1.25, shadows: false, sparklesMax: 40, cloudsMax: 3, fpsMax: 45, refreshMs: 400 },  // 500+
  mega: { dprMax: 1,    shadows: false, sparklesMax: 20, cloudsMax: 2, fpsMax: 30, refreshMs: 800 },  // 1.000+
};

function resolveQuality(pref) {
  if (pref && pref !== 'auto') return pref;
  const small = matchMedia('(max-width: 900px)').matches || matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
               (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  if (weak) return 'low';
  return small ? 'medium' : 'high';
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.05, ...o });
const glow = (color, k = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, flatShading: true });

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}

/** WebGL desteklenmiyorsa null döner. */
function createArena({ canvas, quality = 'medium', reduceMotion = false, onCharacter = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL başlatılamadı:', e);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('WebGL bağlamı kaybedildi'); });

  let baseCfg = QUALITY[quality] || QUALITY.medium;
  let cfg = baseCfg;
  let crowdTier = null; // null | 'big' | 'mega'
  const effCfg = () => {
    const c = crowdTier && CROWD_CAPS[crowdTier];
    if (!c) return baseCfg;
    return { dpr: Math.min(baseCfg.dpr, c.dprMax), shadows: c.shadows && baseCfg.shadows, sparkles: Math.min(baseCfg.sparkles, c.sparklesMax),
      fps: Math.min(baseCfg.fps, c.fpsMax), clouds: Math.min(baseCfg.clouds, c.cloudsMax) };
  };
  let motion = reduceMotion ? 0.25 : 1;

  const scene = new THREE.Scene();
  // Gökyüzü
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sg = sky.getContext('2d').createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, '#3f7dff'); sg.addColorStop(0.55, '#7db7ff'); sg.addColorStop(1, '#d9b8ff');
  const sctx = sky.getContext('2d'); sctx.fillStyle = sg; sctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog(0x9fb8ff, 22, 48);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);

  /* ---- Işıklar ---- */
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x7a55e0, 1.0));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
  sun.position.set(5, 9, 7);
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xb06bff, 1.4); rim.position.set(-5, 3, -4); scene.add(rim);
  const cyan = new THREE.PointLight(0x38c8ff, 60, 18, 2); cyan.position.set(0, 4, -4); scene.add(cyan);

  /* ---- Zemin ---- */
  const floor = mesh(new THREE.CircleGeometry(18, 48).rotateX(-Math.PI / 2), std(0x6f62d8, { roughness: 0.5 }), 0, 0, 0, scene);
  floor.receiveShadow = true;
  const rings = [];
  [[3.0, 3.18, 0xffc83a], [4.5, 4.62, 0x4fc3ff], [6.0, 6.1, 0xb06bff]].forEach(([a, b, c]) => {
    const r = mesh(new THREE.RingGeometry(a, b, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }), 0, 0.02, 0, scene);
    rings.push(r);
  });

  /* ---- Ana bina ---- */
  const bld = new THREE.Group(); bld.position.set(0, 0, -12); scene.add(bld);
  mesh(new THREE.CylinderGeometry(7, 7.4, 2.2, 28), std(0x3a3f9e), 0, 1.1, 0, bld);
  mesh(new THREE.CylinderGeometry(5.6, 5.8, 2.6, 28), std(0x4a52c8), 0, 3.5, 0, bld);
  mesh(new THREE.CylinderGeometry(5.62, 5.62, 1.2, 28), glow(0x2fa8ff, 0.9), 0, 3.5, 0, bld);
  mesh(new THREE.CylinderGeometry(4.2, 4.4, 1.4, 24), std(0x5b63d8), 0, 5.5, 0, bld);
  mesh(new THREE.SphereGeometry(3.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7a6ff0), 0, 6.2, 0, bld);
  mesh(new THREE.BoxGeometry(1.8, 1.7, 0.2), glow(0xffb84a, 0.9), 0, 0.85, 7.1 - 0.05, bld).position.z = 7.2;
  const halo1 = mesh(new THREE.TorusGeometry(6.4, 0.09, 6, 56).rotateX(Math.PI / 2), glow(0x57d4ff, 1.6), 0, 4.9, 0, bld);
  const halo2 = mesh(new THREE.TorusGeometry(7.6, 0.07, 6, 56).rotateX(Math.PI / 2), glow(0xc58bff, 1.4), 0, 2.9, 0, bld);
  const crown = new THREE.Group(); crown.position.set(0, 9.4, 0); bld.add(crown);
  mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.6, 5), std(0xffc83a, { metalness: 0.6, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 }), 0, 0, 0, crown);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    mesh(new THREE.ConeGeometry(0.22, 0.7, 5), std(0xffc83a, { metalness: 0.6, roughness: 0.3 }), Math.cos(a) * 0.85, 0.6, Math.sin(a) * 0.85, crown);
  }
  // Basamaklar
  for (let i = 0; i < 4; i++) {
    const h = 0.2 * (i + 1);
    const s = mesh(new THREE.BoxGeometry(9 - i * 0.8, h, 0.55), std(0xb8b2ee, { roughness: 0.6 }), 0, h / 2, -3.2 - i * 0.55, scene);
    s.receiveShadow = true;
  }
  // Yan kuleler
  [[-9.5, 4.2, 0xd94a8a], [9.5, 4.8, 0x4a8ad9], [-13, 3.4, 0x8a4ad9], [13.2, 3.6, 0xd9894a], [-6.8, 2.6, 0x4ad9a0], [7, 2.8, 0xd94a4a]].forEach(([x, h, roof], i) => {
    const t = new THREE.Group(); t.position.set(x, 0, -10.5 - (i % 3) * 1.6); scene.add(t);
    mesh(new THREE.CylinderGeometry(1.1, 1.3, h, 8), std(0x6b63c4), 0, h / 2, 0, t);
    mesh(new THREE.ConeGeometry(1.5, 1.8, 8), std(roof), 0, h + 0.9, 0, t);
  });
  // Ağaçlar
  [[-8, -3], [-10, -6], [8.5, -4], [10.5, -7], [-6.5, -7], [6.8, -8], [-12, -3], [12, -4]].forEach(([x, z]) => {
    mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5), std(0x6b4a2a), x, 0.45, z, scene);
    mesh(new THREE.IcosahedronGeometry(0.85, 0), std(0x3fc468), x, 1.5, z, scene);
  });
  // Bayraklar
  const banners = [-3.7, 3.7].map((x) => {
    const g = new THREE.Group(); g.position.set(x, 0, -2.6); scene.add(g);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), std(0xd9b04a, { metalness: 0.6 }), 0, 1.7, 0, g);
    const f = mesh(new THREE.BoxGeometry(1.0, 1.9, 0.05), std(0x3447d9, { emissive: 0x1a2a99, emissiveIntensity: 0.5 }), 0, 2.2, 0.05, g);
    mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.18, 5), std(0xffc83a, { metalness: 0.5 }), 0, 2.5, 0.1, f);
    return f;
  });
  // Kupa (basit placeholder geometri)
  const trophy = new THREE.Group(); trophy.position.set(-5.4, 0, -2.4); scene.add(trophy);
  mesh(new THREE.BoxGeometry(1.5, 0.9, 1.5), std(0x8f8aa8), 0, 0.45, 0, trophy);
  const cupPts = [[0.01, 0], [0.45, 0], [0.45, 0.14], [0.14, 0.26], [0.12, 0.62], [0.5, 0.95], [0.78, 1.7], [0.64, 1.7], [0.4, 1.2], [0.01, 1.05]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(cupPts, 16), std(0xffc83a, { metalness: 0.8, roughness: 0.28, emissive: 0x5a3d00, emissiveIntensity: 0.35, side: THREE.DoubleSide }), 0, 0.9, 0, trophy).scale.setScalar(1.15);

  // Balonlar
  const balloons = [[-6, 7.5, -8, 0xff6bd1], [6.5, 8.2, -9, 0xffc83a], [-10, 9.5, -14, 0x57d4ff]].map(([x, y, z, c], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    mesh(new THREE.SphereGeometry(0.9, 12, 10), std(c), 0, 0, 0, g).scale.y = 1.2;
    mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), std(0x7a4a2a), 0, -1.5, 0, g);
    g.userData = { y, ph: i * 1.7 };
    return g;
  });
  // Bulutlar
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, flatShading: true, fog: false });
    [[0, 0, 1.2], [1.2, -0.1, 0.9], [-1.1, -0.15, 0.8]].forEach(([x, y, r]) => mesh(new THREE.IcosahedronGeometry(r, 1), m, x, y, 0, g));
    g.position.set(-22 + i * 7.5, 8 + (i % 3) * 2.2, -18 - (i % 2) * 5);
    g.userData.speed = 0.15 + (i % 3) * 0.06;
    scene.add(g);
    return g;
  });
  // Parıltılar
  const SP_MAX = QUALITY.high.sparkles;
  const spPos = new Float32Array(SP_MAX * 3);
  for (let i = 0; i < SP_MAX; i++) { spPos[i * 3] = (Math.random() - 0.5) * 18; spPos[i * 3 + 1] = Math.random() * 6; spPos[i * 3 + 2] = -8 + Math.random() * 12; }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffe28a, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(sparkles);

  /* ---- Karakter ---- */
  const charRoot = new THREE.Group(); scene.add(charRoot);
  let idle = null;          // procedural idle parçaları
  let mixer = null;         // GLB animasyonu
  let charKind = 'none';

  function buildPlaceholder() {
    const g = new THREE.Group();
    const dark = std(0x1d1d26), skin = std(0xf1c9a5, { roughness: 0.8 }), hair = std(0x4a2c1a);
    [-0.2, 0.2].forEach((x) => {
      mesh(new THREE.CapsuleGeometry(0.2, 0.7, 4, 8), dark, x, 0.62, 0, g);
      mesh(new THREE.BoxGeometry(0.34, 0.15, 0.5), std(0xf4f4f8), x, 0.08, 0.07, g);
    });
    const torso = mesh(new THREE.CapsuleGeometry(0.38, 0.5, 4, 10), dark, 0, 1.4, 0, g);
    mesh(new THREE.BoxGeometry(0.26, 0.5, 0.05), std(0xf4f4f8), 0, 1.45, 0.36, g);
    mesh(new THREE.BoxGeometry(0.95, 0.2, 0.22), dark, 0, 1.38, 0.4, g);           // kavuşturulmuş kollar
    [-0.42, 0.42].forEach((x) => mesh(new THREE.SphereGeometry(0.11, 8, 6), skin, x * 0.8, 1.38, 0.5, g));
    const head = new THREE.Group(); head.position.set(0, 2.05, 0); g.add(head);
    mesh(new THREE.SphereGeometry(0.31, 16, 12), skin, 0, 0, 0, head);
    mesh(new THREE.SphereGeometry(0.335, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 0, 0.03, -0.02, head);
    [-0.11, 0.11].forEach((x) => mesh(new THREE.SphereGeometry(0.035, 6, 6), dark, x, 0.0, 0.29, head));
    g.scale.setScalar(0.85);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    idle = { root: g, torso, head };
    return g;
  }

  function setChar(obj, kind) {
    charRoot.clear();
    charRoot.add(obj);
    charKind = kind;
  }

  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = size.y > 0 ? 1.9 / size.y : 1;
      model.scale.setScalar(s);
      box.setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -box.min.y, -c.z);
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const holder = new THREE.Group(); holder.add(model);
      let animated = false;
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations.find((a) => /idle|bekle|stand/i.test(a.name)) || gltf.animations[0];
        mixer.clipAction(clip).play();
        animated = true;
        idle = null;
      } else {
        idle = { root: holder, torso: null, head: null };   // klipsiz modelde hafif prosedürel hareket
      }
      setChar(holder, 'glb');
      onCharacter({ kind: 'glb', animated });
      readyResolve();
    },
    undefined,
    () => {
      setChar(buildPlaceholder(), 'placeholder');
      onCharacter({ kind: 'placeholder' });
      readyResolve();
    }
  );

  /* ---- Kamera / boyut ---- */
  const camBase = new THREE.Vector3(), look = new THREE.Vector3();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function frame() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    const aspect = w / h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.dpr));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    if (aspect < 0.8) { camera.fov = 48; camBase.set(0, 2.3, 10.5); look.set(0, 1.1, 0); }
    else if (aspect < 1.3) { camera.fov = 42; camBase.set(0, 2.1, 8.6); look.set(0, 1.5, 0); }
    else { camera.fov = 36; camBase.set(0, 1.9, 7.4); look.set(0, 1.55, 0); }
    camera.updateProjectionMatrix();
  }
  frame();
  addEventListener('resize', frame);
  const onMove = (e) => { pointer.tx = (e.clientX / innerWidth - 0.5) * 2; pointer.ty = (e.clientY / innerHeight - 0.5) * 2; };
  if (!matchMedia('(pointer: coarse)').matches) addEventListener('pointermove', onMove);

  let curQ = quality;
  function applyQuality(q) {
    baseCfg = QUALITY[q] || QUALITY.medium; curQ = q;
    cfg = effCfg();
    renderer.shadowMap.enabled = cfg.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = cfg.shadows;
    sparkles.geometry.setDrawRange(0, cfg.sparkles);
    clouds.forEach((c, i) => { c.visible = i < cfg.clouds; });
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    frame();
  }
  applyQuality(quality);

  /* ================= OYUN ARENASI: soru ekranı sahnesi ================= */
  const rf = { t: 0, last: 0 };
  const gm = { on: false, built: false, view: 'wide', pl: [], desks: [], q: null, cam: null };
  const GOLD = 0xffc83a, FONT = '"Baloo 2","Trebuchet MS",system-ui,sans-serif';
  const emi = (c, k = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k });
  function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, x: c.getContext('2d'), t }; }
  function mkCrown(sc) {
    const g = new THREE.Group(), m = std(GOLD, { metalness: 0.6, roughness: 0.3, emissive: 0x8a5a00, emissiveIntensity: 0.6 });
    mesh(new THREE.CylinderGeometry(1, 0.8, 0.6, 5), m, 0, 0, 0, g);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; mesh(new THREE.ConeGeometry(0.22, 0.8, 5), m, Math.cos(a) * 0.85, 0.65, Math.sin(a) * 0.85, g); }
    g.scale.setScalar(sc); return g;
  }
  function bgGrad(o, c1, c2) { const g = o.x.createLinearGradient(0, 0, 0, o.c.height); g.addColorStop(0, c1); g.addColorStop(1, c2); o.x.fillStyle = g; o.x.fillRect(0, 0, o.c.width, o.c.height); }
  function txt(o, s, x, y, size, col, al = 'center', stroke) {
    const c = o.x; c.font = `800 ${size}px ${FONT}`; c.textAlign = al; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (stroke) { c.lineWidth = size * 0.16; c.strokeStyle = stroke; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function wrapTxt(c, t, x, y, w, lh) {
    const ls = []; let l = '';
    t.split(' ').forEach((s) => { const n = l ? `${l} ${s}` : s; if (c.measureText(n).width > w && l) { ls.push(l); l = s; } else l = n; });
    ls.push(l);
    ls.forEach((s, i) => c.fillText(s, x, y - (ls.length - 1) * lh / 2 + i * lh));
  }
  function pane(S, w, h, px, x, y, z, ry, edge) {
    const o = cvs(px, Math.round(px * h / w)), g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry; S.add(g);
    mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), emi(edge, 0.9), 0, 0, -0.17, g);
    mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: o.t, toneMapped: false }), 0, 0, 0, g);
    return o;
  }
  /* Orta dev ekran: "BİLGİ ARENASI" + canlı skorlar */
  function drawMain() {
    const o = gm.main, c = o.x, W = o.c.width;
    bgGrad(o, '#2f6bff', '#10206e');
    txt(o, '👑 BİLGİ ARENASI', W / 2, 92, 96, '#ffc83a', 'center', '#a85a00');
    txt(o, gm.q ? `Soru ${gm.q.n}/${gm.q.total}` : 'SKOR TABLOSU', W / 2, 172, 44, '#cfe0ff');
    const rows = gm.pl.slice().sort((a, b) => b.score - a.score), two = rows.length > 4, per = two ? Math.ceil(rows.length / 2) : rows.length;
    rows.forEach((p, i) => {
      const x0 = two ? 40 + (i >= per ? 620 : 0) : 340, y0 = 205 + (i % per) * 92;
      c.fillStyle = p.me ? 'rgba(255,200,58,.38)' : 'rgba(255,255,255,.14)'; c.beginPath(); c.roundRect(x0, y0, 600, 80, 22); c.fill();
      txt(o, String(i + 1), x0 + 40, y0 + 42, 44, '#ffc83a');
      txt(o, p.name.slice(0, 12) + (p.me ? ' (Sen)' : ''), x0 + 85, y0 + 42, 42, '#fff', 'left');
      txt(o, String(p.score), x0 + 575, y0 + 42, 50, '#fff', 'right');
    });
    if (gm.ans) {
      c.fillStyle = 'rgba(20,160,80,.92)'; c.beginPath(); c.roundRect(60, 600, 1160, 170, 32); c.fill();
      txt(o, 'DOĞRU CEVAP', W / 2, 632, 34, '#d8ffe6');
      txt(o, gm.ans, W / 2, 704, gm.ans.length > 26 ? 52 : gm.ans.length > 18 ? 68 : 94, '#fff', 'center', '#0a5a2a');
    }
    o.t.needsUpdate = true;
  }
  function drawDesk(i) {
    const d = gm.desks[i], p = gm.pl[i]; if (!d || !d.tex || !p) return;
    bgGrad(d.tex, '#1d2fb0', '#0c1250'); txt(d.tex, p.name.slice(0, 11), 256, 90, 62, '#fff'); txt(d.tex, String(p.score), 256, 200, 120, '#ffc83a'); d.tex.t.needsUpdate = true;
  }
  /* Oyuncunun önündeki ekran: soru burada görünür */
  function drawMe() {
    const o = gm.me, c = o.x, W = o.c.width, H = o.c.height, q = gm.q;
    bgGrad(o, '#243cc8', '#0c1560'); c.strokeStyle = '#ffc83a'; c.lineWidth = 10; c.strokeRect(14, 14, W - 28, H - 28);
    if (!q) { txt(o, '👑', W / 2, H * 0.36, 150, '#ffc83a'); txt(o, 'Hazır mısın?', W / 2, H * 0.68, 90, '#fff', 'center', '#16206e'); }
    else {
      txt(o, `Soru ${q.n}/${q.total} • ${q.cat} • ${q.diff}`, W / 2, 62, 40, '#ffd84a');
      const sz = q.q.length > 90 ? 46 : q.q.length > 55 ? 56 : 66;
      c.fillStyle = '#fff'; c.font = `800 ${sz}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      wrapTxt(c, q.q, W / 2, H * 0.5, W - 120, sz * 1.18);
      if (q.reveal) { txt(o, '⏰ Süre doldu!', W / 2, H - 130, 46, '#ff7a8a'); txt(o, `Doğru cevap: ${q.reveal}`, W / 2, H - 62, q.reveal.length > 22 ? 40 : 54, '#5dff9a'); }
      else txt(o, `⏱ ${q.left}`, W / 2, H - 56, 52, q.left <= 5 ? '#ff7a8a' : '#5dff9a');
    }
    o.t.needsUpdate = true;
  }
  function buildGame() {
    gm.built = true;
    const S = gm.scene = new THREE.Scene();
    S.background = new THREE.Color(0x060824); S.fog = new THREE.Fog(0x0b1040, 38, 80);
    S.add(new THREE.HemisphereLight(0x9ab8ff, 0x3a22a0, 1.3));
    [[0x3a7bff, -9], [0xb06bff, 9]].forEach(([c, x]) => { const p = new THREE.PointLight(c, 220, 45, 2); p.position.set(x, 10, 0); S.add(p); });
    const wl = new THREE.PointLight(0xffb43a, 120, 30, 2); wl.position.set(0, 3, 4); S.add(wl);
    /* zemin ve yuvarlak sahne */
    mesh(new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), std(0x1a2272, { metalness: 0.5, roughness: 0.3 }), 0, 0, -10, S);
    mesh(new THREE.CircleGeometry(4.7, 64).rotateX(-Math.PI / 2), std(0x2a35a0, { metalness: 0.5, roughness: 0.25 }), 0, 0.02, 0, S);
    [[4.5, 4.8, GOLD], [3.7, 3.85, 0x3aa8ff], [5.3, 5.45, 0xb06bff]].forEach(([a, b, c]) => mesh(new THREE.RingGeometry(a, b, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c }), 0, 0.04, 0, S));
    const pc = mkCrown(1.1); pc.scale.y = 0.3; pc.position.y = 0.3; S.add(pc);
    /* arka duvar, ekranlar, bayraklar, merdiven */
    mesh(new THREE.BoxGeometry(70, 30, 1), std(0x0b1046), 0, 14, -17, S);
    gm.main = pane(S, 14, 8.75, 1280, 0, 6.6, -14.4, 0, 0x4aa8ff);
    const L = pane(S, 8, 4.2, 800, -13.2, 7.2, -8.5, 0.75, 0x4aa8ff), R = pane(S, 8, 4.2, 800, 13.2, 7.2, -8.5, -0.75, 0x4aa8ff);
    bgGrad(L, '#1a3aa8', '#0c1560'); txt(L, '🏆', 150, 210, 170, '#ffc83a'); txt(L, 'En Büyük Zihinler', 520, 160, 56, '#fff'); txt(L, 'Burada Yarışıyor!', 520, 245, 56, '#fff');
    bgGrad(R, '#1a3aa8', '#0c1560'); txt(R, '?', 400, 150, 190, '#7fd0ff'); txt(R, 'Hazır mısın?', 400, 300, 80, '#fff');
    L.t.needsUpdate = R.t.needsUpdate = true;
    [-6.4, 6.4].forEach((x) => {
      mesh(new THREE.BoxGeometry(1.7, 5.4, 0.1), emi(GOLD, 0.7), x, 5.6, -13.9, S);
      mesh(new THREE.BoxGeometry(1.4, 5.1, 0.12), std(0x1b36c8, { emissive: 0x0b1a8a, emissiveIntensity: 0.7 }), x, 5.6, -13.8, S);
      const c = mkCrown(0.35); c.scale.z = 0.1; c.position.set(x, 5.8, -13.7); S.add(c);
    });
    for (let i = 0; i < 4; i++) {
      const w = 9 - i * 0.5, h = 0.28 * (i + 1);
      mesh(new THREE.BoxGeometry(w, h, 1.1), std(0x27308f), 0, h / 2, -8.2 - i * 1.1, S);
      mesh(new THREE.BoxGeometry(w, 0.05, 0.05), emi(0x3aa8ff, 1.4), 0, h, -7.65 - i * 1.1, S);
    }
    /* tavandaki halka + dev taç + ışık huzmeleri */
    mesh(new THREE.TorusGeometry(5.5, 0.18, 8, 64).rotateX(Math.PI / 2), emi(0x3aa8ff, 1.3), 0, 12.2, -5, S);
    mesh(new THREE.TorusGeometry(4.5, 0.12, 8, 64).rotateX(Math.PI / 2), emi(GOLD, 1.2), 0, 12.2, -5, S);
    gm.cr = mkCrown(1.8); gm.cr.position.set(0, 13.6, -5); S.add(gm.cr);
    [[-10, -4, 0x3a7bff], [-5, -3, 0xb06bff], [5, -3, 0x4fd8ff], [10, -4, 0x3a7bff], [-14, -8, 0xb06bff], [14, -8, 0xb06bff], [-2, -6, 0x4fd8ff], [2, -6, GOLD]].forEach(([x, z, col]) => {
      const len = 22, b = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.1, len, 20, 1, true).translate(0, len / 2, 0).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.position.set(x, 17, z); b.lookAt(x * 0.3, 0, 1); S.add(b);
    });
    /* tribünler + seyirci */
    const cm = std(0xffffff), N = 2 * 4 * 13, ib = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.7, 0.4), cm, N), ih = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), cm, N);
    const M = new THREE.Matrix4(), col = new THREE.Color(), pal = [0x2a3aa8, 0x6a3ad0, 0x1c6ad0, 0xd0803a, 0x3a9ad0, 0xa03a9a], skin = [0xf1c9a5, 0xd9a47a, 0xb97a52, 0x8a5a3a];
    let n = 0;
    [-1, 1].forEach((sd) => { for (let t = 0; t < 4; t++) {
      const sx = sd * (13 + t * 1.7), sh = 0.8 * (t + 1);
      mesh(new THREE.BoxGeometry(1.7, sh, 15), std(0x1c2266), sx, sh / 2, -6, S);
      for (let j = 0; j < 13; j++, n++) {
        const z = -12 + j * 1.05;
        ib.setMatrixAt(n, M.makeTranslation(sx, sh + 0.35, z)); ib.setColorAt(n, col.setHex(pal[(n * 7) % 6]));
        ih.setMatrixAt(n, M.makeTranslation(sx, sh + 0.9, z)); ih.setColorAt(n, col.setHex(skin[(n * 5) % 4]));
      }
    } });
    S.add(ib, ih);
    /* 8 yarışmacı masası (0 = oyuncu) */
    [[-5.4, -3.2], [5.4, -3.2], [-7.3, -4], [7.3, -4], [-9.2, -4.8], [9.2, -4.8], [-11, -5.6], [11, -5.6]].forEach(([x, z], i) => {
      const D = new THREE.Group(); D.position.set(x, 0, z); D.rotation.y = Math.atan2(-x, 2 - z); S.add(D);
      mesh(new THREE.BoxGeometry(1.8, 0.95, 0.9), std(0x3b2fb0, { metalness: 0.3, roughness: 0.4 }), 0, 0.48, 0, D);
      mesh(new THREE.BoxGeometry(1.86, 0.07, 0.96), emi(GOLD, 0.9), 0, 0.97, 0, D);
      const c = mkCrown(0.22); c.scale.z = 0.04; c.position.set(0, 0.42, 0.46); D.add(c);
      mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), std(0x141a4a), 0, 0.5, -1.3, D);
      mesh(new THREE.BoxGeometry(0.8, 0.9, 0.12), std(0x141a4a), 0, 1.0, -1.7, D);
      const fig = new THREE.Group(); fig.position.set(0, 0.6, -1.25); D.add(fig);
      mesh(new THREE.CapsuleGeometry(0.25, 0.45, 4, 8), std(new THREE.Color().setHSL(i * 0.14, 0.6, 0.5)), 0, 0.55, 0, fig);
      mesh(new THREE.SphereGeometry(0.22, 12, 10), std(0xf1c9a5), 0, 1.2, 0, fig);
      const dk = { D, fig };
      if (i === 0) {
        gm.me = cvs(1024, 576); fig.visible = false;
        mesh(new THREE.BoxGeometry(3.2, 1.86, 0.08), std(0x10186a, { emissive: 0x1a3aa0, emissiveIntensity: 0.6 }), 0, 2.35, 0.2, D);
        dk.pan = mesh(new THREE.PlaneGeometry(3, 1.7), new THREE.MeshBasicMaterial({ map: gm.me.t, toneMapped: false }), 0, 2.35, 0.14, D); dk.pan.rotation.y = Math.PI;
        gm.mk = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4).rotateX(Math.PI), emi(GOLD, 1.2)); gm.mk.position.set(0, 4.2, 0.2); D.add(gm.mk);
      } else {
        dk.tex = cvs(512, 288);
        mesh(new THREE.BoxGeometry(1.75, 1.0, 0.06), std(0x10186a, { emissive: 0x1a3aa0, emissiveIntensity: 0.6 }), 0, 1.75, 0.1, D);
        const bm = new THREE.MeshBasicMaterial({ map: dk.tex.t, toneMapped: false });
        mesh(new THREE.PlaneGeometry(1.65, 0.93), bm, 0, 1.75, 0.14, D);
        mesh(new THREE.PlaneGeometry(1.65, 0.93), bm, 0, 1.75, 0.06, D).rotation.y = Math.PI;
      }
      gm.desks.push(dk);
    });
  }
  const _v = new THREE.Vector3();
  function gameFrame(dt, t) {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight), P = a < 1;
    let tp, tl, tf;
    if (gm.view === 'desk') {
      const d0 = gm.desks[0]; tf = P ? 55 : 42;
      const dist = Math.min(7, Math.max(2.4, 3.5 / (2 * Math.tan(tf * Math.PI / 360) * a)));
      d0.D.updateMatrixWorld(); d0.pan.getWorldPosition(_v); tl = _v.clone(); tl.y -= 0.35;
      tp = d0.D.localToWorld(new THREE.Vector3(0, 2.35, -dist));
    } else { tp = new THREE.Vector3(0, 3.4, P ? 18 : 15); tl = new THREE.Vector3(0, 4.6, -8); tf = P ? 72 : 55; }
    if (!gm.cam) gm.cam = { p: tp.clone(), l: tl.clone(), f: tf };
    const k = 1 - Math.exp(-dt * 2.6), c = gm.cam;
    c.p.lerp(tp, k); c.l.lerp(tl, k); c.f += (tf - c.f) * k;
    camera.fov = c.f; camera.updateProjectionMatrix(); camera.position.copy(c.p); camera.lookAt(c.l);
    gm.cr.rotation.y += dt * 0.5; gm.mk.visible = gm.view === 'wide'; gm.mk.position.y = 4.2 + Math.sin(t * 3) * 0.12;
    gm.desks.forEach((d, i) => { if (i) d.fig.position.y = 0.6 + Math.sin(t * 1.5 + i) * 0.03; });
    renderer.render(gm.scene, camera);
  }

  /* ---- Döngü ---- */
  const clock = new THREE.Clock();
  let t = 0, last = 0, raf = 0, alive = true;
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || (document.body.classList.contains('in-game') && !gm.on)) { clock.getDelta(); return; }
    if (now - last < 1000 / cfg.fps - 1) return;
    last = now;
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    if (gm.on) { gameFrame(dt, t); return; }
    const m = motion;

    if (mixer) mixer.update(dt);
    if (idle) {
      const { root, torso, head } = idle;
      root.position.y = Math.sin(t * 1.6) * 0.018 * m;
      root.rotation.y = Math.sin(t * 0.5) * 0.08 * m;
      if (torso) torso.scale.y = 1 + Math.sin(t * 1.6) * 0.014 * m;
      if (head) head.rotation.z = Math.sin(t * 0.7) * 0.05 * m;
    }
    rings.forEach((r, i) => { r.material.opacity = 0.7 + Math.sin(t * 1.5 + i) * 0.25 * m; });
    halo1.rotation.y += dt * 0.25 * m; halo2.rotation.y -= dt * 0.18 * m;
    crown.rotation.y += dt * 0.5 * m;
    banners.forEach((b, i) => { b.rotation.y = Math.sin(t * 1.2 + i) * 0.12 * m; });
    balloons.forEach((b) => { b.position.y = b.userData.y + Math.sin(t * 0.8 + b.userData.ph) * 0.35 * m; b.rotation.y += dt * 0.2 * m; });
    clouds.forEach((c) => { c.position.x += c.userData.speed * dt * m; if (c.position.x > 26) c.position.x = -26; });
    const a = spGeo.attributes.position;
    for (let i = 0; i < cfg.sparkles; i++) {
      let y = a.getY(i) + dt * 0.25 * m;
      if (y > 6) y = 0;
      a.setY(i, y);
    }
    a.needsUpdate = true;

    // Kamera: hafif fare paralaksı
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.set(camBase.x + pointer.x * 0.5 * m, camBase.y - pointer.y * 0.2 * m, camBase.z);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);

  return {
    ready,
    getKind: () => charKind,
    setQuality(q) { applyQuality(q); },
    setReduceMotion(v) { motion = v ? 0.25 : 1; },
    enterGame(pl, opts = {}) {
      if (opts.viewers != null) this.setCrowdMode(opts.viewers);
      if (!gm.built) buildGame();
      gm.pl = pl; gm.q = null; gm.view = 'wide'; gm.cam = null; gm.on = true;
      gm.desks.forEach((d, i) => { d.D.visible = i < pl.length; });
      drawMain(); gm.desks.forEach((_, i) => drawDesk(i)); drawMe();
    },
    exitGame() { gm.on = false; clearTimeout(rf.t); rf.t = 0; crowdTier = null; applyQuality(curQ); },
    setView(v) { gm.view = v; },
    setAnswer(a) { gm.ans = a; if (gm.built) drawMain(); },
    setQuestion(q) { gm.q = q; if (gm.built) { drawMe(); drawMain(); } },
    /** Canvas dokularını yeniden çizer; yayın modunda en fazla refreshMs'de bir (kalan çağrılar birleştirilir). */
    refresh() {
      if (!gm.built) return;
      const gap = crowdTier ? CROWD_CAPS[crowdTier].refreshMs : 0, now = performance.now();
      const run = () => { rf.t = 0; rf.last = performance.now(); drawMain(); gm.desks.forEach((_, i) => drawDesk(i)); };
      if (!gap || now - rf.last >= gap) { clearTimeout(rf.t); run(); return; }
      if (!rf.t) rf.t = setTimeout(run, gap - (now - rf.last));
    },
    /** Yayın modu: viewers sayısına göre performans profilini seçer (0 = kapalı). */
    setCrowdMode(viewers = 0) {
      const next = viewers >= 1000 ? 'mega' : viewers >= 500 ? 'big' : null;
      if (next === crowdTier) return;
      crowdTier = next; applyQuality(curQ);
    },
    getCrowdTier: () => crowdTier,
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('resize', frame); removeEventListener('pointermove', onMove);
      renderer.dispose();
    },
  };
}

export { createArena, resolveQuality, QUALITY, CROWD_CAPS };
/* Geriye dönük uyumluluk: eski kod window.__arenaMod bekliyorsa */
window.__arenaMod = { createArena, resolveQuality };
window.dispatchEvent(new Event('arena-mod'));
