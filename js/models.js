/* TT Garden Defense: the 3D pieces, all our own and all made of simple shapes. One unit = one garden cell.
   Towers and critters face +z (turn them with rotation.y = atan2(dx, dz)). Exposes GD.Models. */
(function () {
  'use strict';
  const T = THREE;
  const GD = (window.GD = window.GD || {});
  const { makeCanvas, toTexture, emojiTexture } = Kit.gfx;

  // ---------------------------------------------------------------- shared materials and shapes
  const mats = new Map();
  function mat(color, o = {}) {
    const key = color + JSON.stringify(o);
    if (!mats.has(key)) {
      const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, o));
      m.userData.shared = true;
      mats.set(key, m);
    }
    return mats.get(key);
  }
  const geos = new Map();
  function geo(key, make) {
    if (!geos.has(key)) {
      const g = make();
      g.userData.shared = true;
      geos.set(key, g);
    }
    return geos.get(key);
  }
  const SPH = () => geo('sph', () => new T.SphereGeometry(1, 18, 12));
  const SPH_LO = () => geo('sphlo', () => new T.SphereGeometry(1, 10, 8));
  const BOX = () => geo('box', () => new T.BoxGeometry(1, 1, 1));
  const CYL = () => geo('cyl', () => new T.CylinderGeometry(1, 1, 1, 16));
  const CONE = () => geo('cone', () => new T.ConeGeometry(1, 1, 16));
  const TORUS = () => geo('torus', () => new T.TorusGeometry(1, 0.18, 8, 24));

  function part(g, m, x, y, z, sx, sy, sz, parent, shadow = true) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    o.castShadow = shadow;
    if (parent) parent.add(o);
    return o;
  }
  const ball = (color, x, y, z, sx, sy, sz, parent, o) => part(SPH(), mat(color, o), x, y, z, sx, sy, sz, parent);
  const box = (color, x, y, z, sx, sy, sz, parent, o) => part(BOX(), mat(color, o), x, y, z, sx, sy, sz, parent);
  const cyl = (color, x, y, z, r, h, parent, o) => part(CYL(), mat(color, o), x, y, z, r, h, r, parent);

  // Googly eyes: white ball, black pupil looking forward. Returns the pupils (to close them for a nap).
  function eyes(parent, x, y, z, r, gap) {
    const out = [];
    for (const s of [-1, 1]) {
      const e = new T.Group();
      e.position.set(x + s * gap, y, z);
      parent.add(e);
      ball('#ffffff', 0, 0, 0, r, r, r, e, { roughness: 0.3 });
      const pu = ball('#16131c', 0, 0, r * 0.62, r * 0.55, r * 0.55, r * 0.45, e, { roughness: 0.2 });
      pu.userData.sy = pu.scale.y;
      out.push(pu);
    }
    return out;
  }

  // ---------------------------------------------------------------- towers
  function base(g, color) {
    cyl('#8a5a32', 0, 0.06, 0, 0.4, 0.12, g);
    cyl(color, 0, 0.14, 0, 0.34, 0.05, g);
    return g;
  }
  // a little band that shows the level: none, silver, gold
  function bands(g, y, r) {
    const b2 = part(TORUS(), mat('#d9dde6', { metalness: 0.6, roughness: 0.3 }), 0, y, 0, r, r, r * 1.4, g, false);
    const b3 = part(TORUS(), mat('#ffcf2e', { metalness: 0.6, roughness: 0.3, emissive: '#5a3c00' }), 0, y + 0.07, 0, r, r, r * 1.4, g, false);
    b2.rotation.x = b3.rotation.x = Math.PI / 2;
    return (lvl) => { b2.visible = lvl >= 2; b3.visible = lvl >= 3; };
  }

  const TOWER_MAKERS = {
    squirt(g, o) {
      base(g, '#2a8be0');
      cyl('#e9d7b5', 0, 0.3, 0, 0.07, 0.3, g);
      const head = new T.Group();
      head.position.y = 0.48;
      g.add(head);
      cyl('#2a8be0', 0, 0.12, -0.04, 0.2, 0.32, head, { roughness: 0.35 });
      ball('#2a8be0', 0, 0.28, -0.04, 0.2, 0.08, 0.2, head, { roughness: 0.35 });
      cyl('#9fd8ff', 0, 0.12, -0.04, 0.205, 0.1, head, { transparent: true, opacity: 0.85, roughness: 0.1 }); // the water window
      const noz = cyl('#ff8a1f', 0, 0.12, 0.2, 0.06, 0.26, head);
      noz.rotation.x = Math.PI / 2;
      ball('#ffd21f', 0, 0.12, 0.34, 0.05, 0.05, 0.05, head);
      ball('#ff3d7f', 0, 0.34, -0.04, 0.06, 0.06, 0.06, head); // the pump knob
      o.head = head;
      o.muzzle = new T.Vector3(0, 0.6, 0.36);
      o.bands = bands(g, 0.2, 0.36);
    },
    bubble(g, o) {
      base(g, '#ff6fb5');
      const head = new T.Group();
      head.position.y = 0.2;
      g.add(head);
      box('#ff6fb5', 0, 0.2, -0.05, 0.42, 0.34, 0.36, head, { roughness: 0.45 });
      box('#ffe066', 0, 0.39, -0.05, 0.3, 0.05, 0.26, head);
      ball('#9be7ff', -0.12, 0.25, 0.135, 0.05, 0.05, 0.02, head); // dials
      ball('#7bd93f', 0.12, 0.25, 0.135, 0.05, 0.05, 0.02, head);
      const ring = part(TORUS(), mat('#b48cff', { roughness: 0.3 }), 0, 0.3, 0.26, 0.15, 0.15, 0.15, head);
      const stick = cyl('#b48cff', 0, 0.16, 0.26, 0.02, 0.2, head);
      void stick;
      const film = part(geo('disc', () => new T.CircleGeometry(1, 20)), new T.MeshStandardMaterial({ color: '#d6f4ff', transparent: true, opacity: 0.35, side: T.DoubleSide, roughness: 0.1 }),
        0, 0.3, 0.26, 0.14, 0.14, 0.14, head, false);
      o.ring = ring;
      o.film = film;
      o.head = head;
      o.muzzle = new T.Vector3(0, 0.5, 0.3);
      o.bands = bands(g, 0.2, 0.36);
    },
    jelly(g, o) {
      base(g, '#4fd15a');
      // a spring and a spoon, with a wobbly jelly on top
      for (let i = 0; i < 4; i++) part(TORUS(), mat('#c7ccd6', { metalness: 0.5, roughness: 0.3 }), 0, 0.2 + i * 0.07, 0, 0.1, 0.1, 0.25, g, false).rotation.x = Math.PI / 2;
      const head = new T.Group();
      head.position.y = 0.48;
      g.add(head);
      cyl('#ffffff', 0, 0, 0, 0.26, 0.05, head);
      const jelly = new T.Group();
      head.add(jelly);
      cyl('#41c94c', 0, 0.12, 0, 0.2, 0.2, jelly, { roughness: 0.15, transparent: true, opacity: 0.88 });
      ball('#7ff07f', 0, 0.22, 0, 0.2, 0.08, 0.2, jelly, { roughness: 0.15, transparent: true, opacity: 0.88 });
      ball('#ff3d5a', 0, 0.31, 0, 0.055, 0.055, 0.055, jelly, { roughness: 0.2 }); // a cherry
      o.jelly = jelly;
      o.head = head;
      o.muzzle = new T.Vector3(0, 0.8, 0);
      o.bands = bands(g, 0.2, 0.36);
    },
    cookie(g, o) {
      base(g, '#c98a3c');
      const wood = '#a8692f';
      box(wood, -0.16, 0.3, 0, 0.06, 0.36, 0.06, g);
      box(wood, 0.16, 0.3, 0, 0.06, 0.36, 0.06, g);
      box(wood, 0, 0.44, 0, 0.38, 0.05, 0.05, g);
      const head = new T.Group();
      head.position.y = 0.18;
      g.add(head);
      const arm = new T.Group();
      arm.position.set(0, 0.22, 0);
      head.add(arm);
      box('#d9a05b', 0, 0.02, -0.18, 0.06, 0.04, 0.5, arm);
      cyl('#8a5a32', 0, 0.06, -0.43, 0.11, 0.05, arm);
      const ck = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🍪'), transparent: true }));
      ck.scale.set(0.24, 0.24, 1);
      ck.position.set(0, 0.16, -0.43);
      arm.add(ck);
      box('#8a5a32', 0, 0.1, 0.22, 0.36, 0.2, 0.1, head); // the stop bar
      o.arm = arm;
      o.cookie = ck;
      o.head = head;
      o.headSpins = true;
      o.muzzle = new T.Vector3(0, 0.75, -0.2);
      o.bands = bands(g, 0.2, 0.36);
    },
    sprinkler(g, o) {
      base(g, '#18c8d8');
      cyl('#ffd21f', 0, 0.3, 0, 0.06, 0.32, g);
      const head = new T.Group();
      head.position.y = 0.5;
      g.add(head);
      cyl('#18c8d8', 0, 0, 0, 0.1, 0.08, head, { roughness: 0.3 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const arm = box('#18c8d8', Math.sin(a) * 0.15, 0.02, Math.cos(a) * 0.15, 0.04, 0.04, 0.3, head);
        arm.rotation.y = a;
        ball('#ff8a1f', Math.sin(a) * 0.3, 0.04, Math.cos(a) * 0.3, 0.045, 0.045, 0.045, head);
      }
      o.head = head;
      o.headSpins = true;
      o.muzzle = new T.Vector3(0, 0.55, 0);
      o.bands = bands(g, 0.2, 0.36);
    },
  };

  function tower(type) {
    const root = new T.Group();
    const inner = new T.Group();
    root.add(inner);
    const o = { root, inner, type };
    TOWER_MAKERS[type](inner, o);
    o.setLevel = (lvl) => {
      o.bands(lvl);
      inner.scale.setScalar(1 + (lvl - 1) * 0.12);
    };
    o.setLevel(1);
    return o;
  }

  // ---------------------------------------------------------------- critters (silly, never hurt)
  const CRITTER_MAKERS = {
    mouse(g, o) {
      const body = new T.Group();
      g.add(body);
      ball('#a9a2b8', 0, 0.2, 0, 0.19, 0.17, 0.24, body);
      ball('#c9c2d6', 0, 0.16, 0.05, 0.14, 0.11, 0.18, body);
      ball('#a9a2b8', 0, 0.3, 0.2, 0.13, 0.12, 0.13, body); // head
      for (const s of [-1, 1]) {
        ball('#a9a2b8', s * 0.1, 0.44, 0.17, 0.08, 0.08, 0.03, body);
        ball('#ffb3c7', s * 0.1, 0.44, 0.185, 0.055, 0.055, 0.02, body);
      }
      ball('#ff7fa8', 0, 0.3, 0.34, 0.035, 0.035, 0.035, body);
      o.pupils = eyes(body, 0, 0.34, 0.29, 0.045, 0.05);
      const tail = part(CYL(), mat('#ffb3c7'), 0, 0.18, -0.3, 0.015, 0.3, 0.015, body);
      tail.rotation.x = 1.1;
      o.body = body;
      o.feet = [ball('#ffb3c7', -0.08, 0.04, 0.05, 0.05, 0.03, 0.07, g), ball('#ffb3c7', 0.08, 0.04, 0.05, 0.05, 0.03, 0.07, g)];
      o.tint = ['#a9a2b8', '#c9c2d6'];
    },
    ant(g, o) {
      const body = new T.Group();
      g.add(body);
      ball('#5a2f1c', 0, 0.12, -0.12, 0.09, 0.08, 0.11, body);
      ball('#6d3a22', 0, 0.12, 0, 0.06, 0.06, 0.06, body);
      ball('#6d3a22', 0, 0.15, 0.1, 0.075, 0.07, 0.07, body);
      for (const s of [-1, 1]) {
        const a = part(CYL(), mat('#2b1810'), s * 0.03, 0.24, 0.14, 0.008, 0.12, 0.008, body);
        a.rotation.z = -s * 0.5;
        a.rotation.x = 0.4;
      }
      o.pupils = eyes(body, 0, 0.17, 0.15, 0.03, 0.035);
      o.body = body;
      o.feet = [];
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) o.feet.push(box('#2b1810', s * 0.08, 0.04, -0.06 + i * 0.06, 0.08, 0.012, 0.012, g));
      o.tint = ['#5a2f1c', '#6d3a22'];
    },
    squirrel(g, o) {
      const body = new T.Group();
      g.add(body);
      ball('#d0782e', 0, 0.22, 0, 0.16, 0.18, 0.2, body);
      ball('#f2c79a', 0, 0.2, 0.08, 0.1, 0.12, 0.12, body);
      ball('#d0782e', 0, 0.38, 0.13, 0.12, 0.11, 0.12, body);
      for (const s of [-1, 1]) {
        const e = part(CONE(), mat('#d0782e'), s * 0.07, 0.5, 0.11, 0.04, 0.09, 0.04, body);
        e.rotation.z = -s * 0.25;
      }
      ball('#3a2414', 0, 0.37, 0.25, 0.025, 0.025, 0.025, body);
      o.pupils = eyes(body, 0, 0.41, 0.21, 0.042, 0.05);
      const tail = new T.Group();
      tail.position.set(0, 0.2, -0.16);
      body.add(tail);
      ball('#e08a3a', 0, 0.12, -0.08, 0.11, 0.2, 0.11, tail);
      ball('#f0a050', 0, 0.32, -0.02, 0.1, 0.12, 0.1, tail);
      o.tail = tail;
      o.body = body;
      o.feet = [ball('#a8581e', -0.08, 0.04, 0.06, 0.05, 0.03, 0.07, g), ball('#a8581e', 0.08, 0.04, 0.06, 0.05, 0.03, 0.07, g)];
      o.tint = ['#d0782e', '#f2c79a'];
    },
    snail(g, o) {
      const body = new T.Group();
      g.add(body);
      ball('#b9e07a', 0, 0.07, 0.02, 0.13, 0.07, 0.3, body);
      ball('#b9e07a', 0, 0.17, 0.25, 0.08, 0.1, 0.08, body);
      for (const s of [-1, 1]) {
        const st = part(CYL(), mat('#b9e07a'), s * 0.04, 0.3, 0.27, 0.014, 0.12, 0.014, body);
        st.rotation.z = -s * 0.25;
      }
      o.pupils = eyes(body, 0, 0.37, 0.29, 0.035, 0.06);
      const shell = new T.Group();
      shell.position.set(0, 0.24, -0.04);
      body.add(shell);
      ball('#e8a23a', 0, 0, 0, 0.19, 0.19, 0.12, shell);
      for (const s of [-1, 1]) {
        const sw = part(TORUS(), mat('#b8661f'), s * 0.12, 0, 0, 0.1, 0.1, 0.1, shell, false);
        sw.rotation.y = Math.PI / 2;
      }
      o.shell = shell;
      o.body = body;
      o.feet = [];
      o.tint = ['#b9e07a', '#e8a23a'];
    },
    bee(g, o) {
      const body = new T.Group();
      body.position.y = 0.32;
      g.add(body);
      const [cv, ctx] = makeCanvas(64, 64);
      ctx.fillStyle = '#ffd21f';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#2b2230';
      for (let i = 0; i < 3; i++) ctx.fillRect(0, 10 + i * 18, 64, 8);
      const striped = new T.MeshStandardMaterial({ map: toTexture(cv), roughness: 0.6 });
      const b = part(SPH(), striped, 0, 0, -0.02, 0.14, 0.13, 0.19, body);
      b.rotation.x = Math.PI / 2;
      ball('#2b2230', 0, 0.02, 0.17, 0.1, 0.09, 0.09, body);
      o.pupils = eyes(body, 0, 0.06, 0.24, 0.04, 0.045);
      o.wings = [];
      const wm = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: T.DoubleSide, roughness: 0.2 });
      for (const s of [-1, 1]) {
        const w = new T.Group();
        w.position.set(s * 0.06, 0.12, 0);
        body.add(w);
        const m = part(geo('disc', () => new T.CircleGeometry(1, 20)), wm, s * 0.1, 0, 0, 0.11, 0.07, 1, w, false);
        m.rotation.x = -Math.PI / 2;
        o.wings.push(w);
      }
      o.body = body;
      o.feet = [];
      o.fly = true;
      o.tint = ['#ffd21f'];
      o.noTint = true;
    },
    boss(g, o) {
      // the Bandit Raccoon: a big grey snack bandit with a mask and a sack on his back
      const body = new T.Group();
      g.add(body);
      ball('#8d8a96', 0, 0.42, 0, 0.36, 0.4, 0.36, body);
      ball('#d9d6df', 0, 0.36, 0.16, 0.26, 0.3, 0.22, body);
      ball('#8d8a96', 0, 0.82, 0.12, 0.27, 0.24, 0.25, body);
      ball('#d9d6df', 0, 0.76, 0.32, 0.12, 0.09, 0.1, body);
      ball('#2b2230', 0, 0.8, 0.42, 0.045, 0.04, 0.04, body);
      box('#2b2230', 0, 0.88, 0.3, 0.46, 0.1, 0.12, body); // the bandit mask
      for (const s of [-1, 1]) ball('#8d8a96', s * 0.18, 1.04, 0.08, 0.08, 0.1, 0.05, body);
      o.pupils = eyes(body, 0, 0.9, 0.36, 0.06, 0.1);
      const sack = ball('#c9a06a', 0, 0.6, -0.36, 0.24, 0.28, 0.2, body);
      void sack;
      const tail = new T.Group();
      tail.position.set(0, 0.3, -0.32);
      body.add(tail);
      for (let i = 0; i < 4; i++) ball(i % 2 ? '#2b2230' : '#8d8a96', 0, 0.05 - i * 0.02, -0.08 - i * 0.12, 0.11, 0.11, 0.09, tail);
      o.tail = tail;
      const crown = part(CYL(), mat('#ffcf2e', { metalness: 0.5, roughness: 0.3, emissive: '#4a3000' }), 0, 1.1, 0.12, 0.12, 0.1, 0.12, body);
      void crown;
      o.body = body;
      o.feet = [ball('#5d5a66', -0.15, 0.06, 0.08, 0.1, 0.06, 0.13, g), ball('#5d5a66', 0.15, 0.06, 0.08, 0.1, 0.06, 0.13, g)];
      o.tint = ['#8d8a96', '#d9d6df'];
      o.big = true;
    },
  };

  function critter(type) {
    const root = new T.Group();
    const g = new T.Group();
    root.add(g);
    const o = { root, inner: g, type };
    CRITTER_MAKERS[type](g, o);
    // the soak meter: a little bar that fills with water (billboarded by the view)
    const meter = new T.Group();
    meter.position.y = o.big ? 1.35 : o.fly ? 0.62 : type === 'ant' ? 0.36 : 0.62;
    const bg = new T.Mesh(geo('plane', () => new T.PlaneGeometry(1, 1)), new T.MeshBasicMaterial({ color: '#1b1a22', transparent: true, opacity: 0.6, depthWrite: false }));
    bg.scale.set(o.big ? 0.7 : 0.36, 0.07, 1);
    const fill = new T.Mesh(geo('planeL', () => new T.PlaneGeometry(1, 1).translate(0.5, 0, 0)), new T.MeshBasicMaterial({ color: '#3fb6ff', depthWrite: false }));
    fill.scale.set(0, 0.05, 1);
    fill.position.set(-bg.scale.x / 2 + 0.01, 0, 0.001);
    o.fillW = bg.scale.x - 0.02;
    meter.add(bg, fill);
    meter.visible = false;
    meter.renderOrder = 5;
    root.add(meter);
    o.meter = meter;
    o.fill = fill;
    // wet look: the fur goes a little blue as he soaks (each critter keeps its own copies of its colours)
    o.wet = [];
    if (!o.noTint) {
      const tints = o.tint.map((c) => mat(c));
      g.traverse((m) => {
        if (!m.isMesh || !tints.includes(m.material)) return;
        m.material = m.material.clone();
        m.material.userData.base = m.material.color.clone();
        o.wet.push(m.material);
      });
    }
    return o;
  }
  const WET = new T.Color('#6fb8ff');
  // eyes open (1), sleepy (0.45) or asleep (0.15)
  function setEyes(o, k) { for (const p of o.pupils) p.scale.y = p.userData.sy * k; }
  function setWet(o, k) {
    for (const m of o.wet) m.color.copy(m.userData.base).lerp(WET, k * 0.45);
  }

  // ---------------------------------------------------------------- garden pieces
  function tree(scale = 1) {
    const g = new T.Group();
    cyl('#8a5a32', 0, 0.35, 0, 0.09, 0.7, g);
    ball('#3f9e3a', 0, 0.95, 0, 0.42, 0.38, 0.42, g);
    ball('#4fb848', 0.16, 1.15, 0.1, 0.3, 0.28, 0.3, g);
    ball('#46a840', -0.18, 1.05, -0.08, 0.3, 0.26, 0.3, g);
    for (let i = 0; i < 3; i++) ball('#ff4d5a', Math.sin(i * 2.1) * 0.34, 0.95 + (i % 2) * 0.18, Math.cos(i * 2.1) * 0.34, 0.06, 0.06, 0.06, g); // apples
    g.scale.setScalar(scale);
    return g;
  }
  function rock() {
    const g = new T.Group();
    const r = part(geo('rock', () => new T.DodecahedronGeometry(1, 0)), mat('#9a96a3', { flatShading: true }), 0, 0.16, 0, 0.32, 0.22, 0.28, g);
    r.rotation.y = 0.7;
    part(geo('rock', () => new T.DodecahedronGeometry(1, 0)), mat('#b3afbb', { flatShading: true }), 0.22, 0.08, 0.16, 0.14, 0.1, 0.12, g);
    return g;
  }
  function flowers(seed) {
    const g = new T.Group();
    const cols = ['#ff5fa2', '#ffd21f', '#ffffff', '#b48cff', '#ff7a3c'];
    for (let i = 0; i < 7; i++) {
      const a = seed * 3.1 + i * 2.4, rr = 0.12 + (i % 3) * 0.12;
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      cyl('#3f9e3a', x, 0.1, z, 0.012, 0.2, g, {});
      ball(cols[(i + seed) % cols.length], x, 0.22, z, 0.07, 0.04, 0.07, g);
      ball('#ffd21f', x, 0.245, z, 0.025, 0.02, 0.025, g);
    }
    return g;
  }
  function lily() {
    const g = new T.Group();
    const pad = part(geo('lily', () => new T.CircleGeometry(1, 16, 0.3, Math.PI * 1.8)), mat('#3f9e3a', { side: T.DoubleSide }), 0, 0.03, 0, 0.16, 0.16, 0.16, g, false);
    pad.rotation.x = -Math.PI / 2;
    ball('#ff9fd0', 0.04, 0.06, 0.02, 0.05, 0.03, 0.05, g);
    return g;
  }
  function hedge(len) {
    const g = new T.Group();
    box('#2f7f33', 0, 0.22, 0, len, 0.44, 0.34, g, { roughness: 0.95 });
    for (let x = -len / 2 + 0.25; x < len / 2; x += 0.5) ball('#3a9140', x, 0.42, 0, 0.2, 0.12, 0.2, g, { roughness: 0.95 });
    return g;
  }
  function gate() {
    const g = new T.Group();
    const wood = '#c98a3c';
    box(wood, -0.48, 0.45, 0, 0.08, 0.9, 0.08, g);
    box(wood, 0.48, 0.45, 0, 0.08, 0.9, 0.08, g);
    const arch = part(geo('arch', () => new T.TorusGeometry(0.48, 0.05, 6, 16, Math.PI)), mat(wood), 0, 0.9, 0, 1, 1, 1, g);
    void arch;
    for (let i = 0; i < 6; i++) ball(['#ff5fa2', '#ffd21f', '#b48cff'][i % 3], Math.cos((i / 5) * Math.PI) * 0.48, 0.9 + Math.sin((i / 5) * Math.PI) * 0.48, 0.04, 0.06, 0.06, 0.06, g);
    return g;
  }
  function blanket() {
    const [cv, ctx] = makeCanvas(128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#e8463c';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
    const m = new T.Mesh(geo('plane', () => new T.PlaneGeometry(1, 1)), new T.MeshStandardMaterial({ map: toTexture(cv), roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  }
  function basket() {
    const g = new T.Group();
    box('#c98a3c', 0, 0.14, 0, 0.42, 0.28, 0.3, g);
    box('#e0a85a', 0, 0.29, 0, 0.44, 0.04, 0.32, g);
    const h = part(geo('handle', () => new T.TorusGeometry(0.17, 0.025, 6, 16, Math.PI)), mat('#a8692f'), 0, 0.3, 0, 1, 1, 1, g);
    void h;
    return g;
  }
  // the companion's giant water balloon
  function balloon() {
    const g = new T.Group();
    ball('#3fb6ff', 0, 0, 0, 0.42, 0.48, 0.42, g, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
    ball('#ffffff', -0.14, 0.18, 0.28, 0.08, 0.12, 0.05, g, { roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.4 });
    const knot = part(CONE(), mat('#2a8be0'), 0, -0.5, 0, 0.07, 0.1, 0.07, g);
    knot.rotation.x = Math.PI;
    return g;
  }
  function bubbleShell(r) {
    const m = new T.Mesh(SPH_LO(), new T.MeshStandardMaterial({ color: '#d6f4ff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, depthWrite: false }));
    m.scale.setScalar(r);
    return m;
  }

  GD.Models = { tower, critter, setWet, setEyes, tree, rock, flowers, lily, hedge, gate, blanket, basket, balloon, bubbleShell, mat, geo, eyes };
})();
