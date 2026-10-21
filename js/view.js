/* TT Garden Defense: the 3D view. Builds each garden, keeps a 3D object for everything in the sim, animates the
   critters, towers and the brothers with the kit's poses, and turns sim events into effects and sounds.
   It never changes the rules. The camera frames the whole garden inside the part of the screen the HUD leaves free
   (and turns the garden on its side for a phone held upright). Exposes GD.View(canvas). */
(function () {
  'use strict';
  const T = THREE;
  const GD = (window.GD = window.GD || {});
  const M = GD.Models, P = Kit.people, sfx = GD.sfx;
  const { makeCanvas, toTexture, emojiTexture, dotTexture, FONT } = Kit.gfx;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
  const turn = (o, to, k) => { let d = to - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, k); };
  const HERO = 0.5; // the brothers at half size: about one cell tall
  const SNACKS = ['🍓', '🍪', '🧁', '🍉', '🍩', '🍌', '🍎', '🥨', '🍇', '🍰'];

  const THEMES = {
    day: { sky: '#a6defc', hemiSky: '#ffffff', hemiGround: '#6a8a3a', hemi: 0.8, sun: '#fff1d6', sunI: 1.0, sunPos: [-6, 14, 9],
      grassA: '#86d35a', grassB: '#7cc952', out: '#64b24c', path: '#e8c992', pathEdge: '#cfa46a', water: '#4fb4ec' },
    flower: { sky: '#ffdcef', hemiSky: '#fff4fb', hemiGround: '#6a8a4a', hemi: 0.8, sun: '#fff0e0', sunI: 0.95, sunPos: [7, 14, 8],
      grassA: '#8ad968', grassB: '#80cf5e', out: '#6cbc56', path: '#f0d3a8', pathEdge: '#d6ad78', water: '#5cc4f0', flowers: true },
    moon: { sky: '#2a2858', hemiSky: '#9fb2ff', hemiGround: '#2a3a3a', hemi: 0.55, sun: '#ffc08a', sunI: 0.7, sunPos: [-10, 9, 5],
      grassA: '#5aa252', grassB: '#529a4b', out: '#3f7d3e', path: '#cfb184', pathEdge: '#a98a5e', water: '#3a78c0', fireflies: true },
  };

  // ---------------------------------------------------------------- particles: one Points draw, per-particle size and colour
  function makeParticles(max, texture, additive) {
    const g = new T.BufferGeometry();
    const pos = new Float32Array(max * 3), tint = new Float32Array(max * 4), size = new Float32Array(max);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('tint', new T.BufferAttribute(tint, 4));
    g.setAttribute('size', new T.BufferAttribute(size, 1));
    const material = new T.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute vec4 tint; uniform float scale; varying vec4 vTint;
        void main() { vTint = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vTint;
        void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * vTint.rgb, c.a * vTint.a); }`,
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    const points = new T.Points(g, material);
    points.frustumCulled = false;
    points.renderOrder = 4;
    const parts = [];
    for (let i = 0; i < max; i++) parts.push({ life: 0 });
    let cursor = 0;
    const col = new T.Color();
    return {
      points, material,
      emit(p, o = {}) {
        const n = o.n || 10;
        for (let i = 0; i < n; i++) {
          const q = parts[cursor];
          cursor = (cursor + 1) % max;
          const a = Math.random() * Math.PI * 2, sp = (o.speed || 2) * (0.4 + Math.random() * 0.6);
          const sp3 = o.spread || 0.15;
          q.x = p.x + (Math.random() - 0.5) * sp3;
          q.y = p.y + (Math.random() - 0.5) * sp3;
          q.z = p.z + (Math.random() - 0.5) * sp3;
          q.vx = Math.cos(a) * sp + (o.vx || 0);
          q.vz = Math.sin(a) * sp + (o.vz || 0);
          q.vy = (o.up !== undefined ? o.up : 2) * (0.5 + Math.random() * 0.8);
          q.g = o.gravity !== undefined ? o.gravity : 6;
          q.drag = o.drag || 0.6;
          q.max = q.life = (o.life || 0.7) * (0.7 + Math.random() * 0.6);
          q.size = (o.size || 0.12) * (0.7 + Math.random() * 0.6);
          const c = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color || '#ffe680';
          col.set(c);
          q.r = col.r; q.gg = col.g; q.b = col.b;
          q.keep = o.shrink === false;
        }
      },
      update(dt) {
        for (let i = 0; i < max; i++) {
          const q = parts[i];
          if (q.life <= 0) { size[i] = 0; continue; }
          q.life -= dt;
          q.vy -= q.g * dt;
          const d = Math.exp(-q.drag * dt);
          q.vx *= d; q.vz *= d;
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.y < 0.02) { q.y = 0.02; q.vy *= -0.25; q.vx *= 0.6; q.vz *= 0.6; }
          const k = Math.max(0, q.life / q.max);
          pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
          tint[i * 4] = q.r; tint[i * 4 + 1] = q.gg; tint[i * 4 + 2] = q.b; tint[i * 4 + 3] = Math.min(1, k * 2.5);
          size[i] = q.keep ? q.size : q.size * (0.4 + 0.6 * k);
        }
        g.attributes.position.needsUpdate = true;
        g.attributes.tint.needsUpdate = true;
        g.attributes.size.needsUpdate = true;
      },
    };
  }

  // ---------------------------------------------------------------- text sprites (+5, SPLASH!, Zzz)
  const textCache = new Map();
  function textTexture(text, color) {
    const key = text + '|' + color;
    if (textCache.has(key)) return textCache.get(key);
    const [cv, ctx] = makeCanvas(256, 96);
    ctx.font = `900 58px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1b1a22';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 128, 50);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 50);
    const t = toTexture(cv);
    textCache.set(key, t);
    return t;
  }
  Kit.lang.onChange(() => { for (const t of textCache.values()) t.dispose(); textCache.clear(); });

  function View(canvas) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 200);
    const hemi = new T.HemisphereLight('#ffffff', '#6a8a3a', 0.8);
    const sun = new T.DirectionalLight('#fff1d6', 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    sun.shadow.bias = -0.0015;
    scene.add(hemi, sun, sun.target);
    const ground = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ color: '#64b24c', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const drops = makeParticles(1400, dotTexture(), false);
    const glows = makeParticles(500, dotTexture(), true);
    scene.add(drops.points, glows.points);

    // ---------------------------------------------------------------- state
    let world = null, map = null, theme = THEMES.day, W2 = 7, H2 = 4, boardTex = null;
    const tmpV = new T.Vector3();
    const critters = new Map(), towers = new Map(), shots = new Map(), puddles = new Map();
    let floaters = [], runners = [], popups = [], flyers = [];
    let snackSprites = [], heroes = [], buddy = null, hand = null, balloonObj = null;
    const cursors = [], rangeRing = makeRange(), hint = makeHint();
    let time = 0, celebrate = null, focus = null, portrait = false;
    const camNow = { pos: new T.Vector3(0, 12, 10), look: new T.Vector3() }, camGoal = { pos: new T.Vector3(0, 12, 10), look: new T.Vector3() };
    let safe = { left: 0, top: 0, right: 0, bottom: 0 }, snapCam = true;
    const X = (x) => x - W2, Z = (z) => z - H2;

    function makeRange() {
      const g = new T.Group();
      const ring = new T.Mesh(new T.RingGeometry(0.95, 1, 64), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
      const disc = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.14, depthWrite: false }));
      ring.rotation.x = disc.rotation.x = -Math.PI / 2;
      g.add(disc, ring);
      g.position.y = 0.03;
      g.renderOrder = 3;
      g.visible = false;
      scene.add(g);
      return g;
    }
    function makeCursor(color) {
      const m = new T.Mesh(new T.RingGeometry(0.6, 0.7, 4, 1), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI / 4;
      const fill = new T.Mesh(new T.PlaneGeometry(0.86, 0.86), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2;
      const g = new T.Group();
      g.add(m, fill);
      g.position.y = 0.04;
      g.visible = false;
      g.userData = { ring: m, fill };
      scene.add(g);
      return g;
    }
    function makeHint() {
      const g = new T.Group();
      const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('✨'), transparent: true, depthWrite: false }));
      s.scale.set(0.6, 0.6, 1);
      s.position.y = 0.55;
      const glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#fff6a0', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.set(1.2, 1.2, 1);
      glow.position.y = 0.3;
      g.add(glow, s);
      g.visible = false;
      g.userData.star = s;
      scene.add(g);
      return g;
    }

    function disposeTree(o) {
      o.traverse((m) => {
        if (!m.isMesh && !m.isSprite) return;
        if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
        const list = Array.isArray(m.material) ? m.material : [m.material];
        for (const x of list) if (x && !x.userData.shared) x.dispose(); // (emoji textures are the kit's, kept)
      });
    }

    // ---------------------------------------------------------------- building a garden
    function boardTexture(m, th) {
      const PX = 64, [cv, ctx] = makeCanvas(m.w * PX, m.h * PX);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) {
        ctx.fillStyle = (r + c) % 2 ? th.grassA : th.grassB;
        ctx.fillRect(c * PX, r * PX, PX, PX);
        ctx.strokeStyle = 'rgba(20,60,10,0.10)';
        ctx.lineWidth = 2;
        ctx.strokeRect(c * PX + 1, r * PX + 1, PX - 2, PX - 2);
        ctx.strokeStyle = 'rgba(30,90,20,0.35)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { // grass tufts
          const x = c * PX + 8 + rnd() * (PX - 16), y = r * PX + 8 + rnd() * (PX - 16);
          ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3, y + 4); ctx.stroke();
        }
      }
      const isPath = (c, r) => '#SB'.includes(m.at(c, r));
      const paint = (inset, color) => {
        ctx.fillStyle = color;
        for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) {
          if (!isPath(c, r)) continue;
          Kit.gfx.roundRect(ctx, c * PX + inset, r * PX + inset, PX - inset * 2, PX - inset * 2, 14);
          ctx.fill();
          if (isPath(c + 1, r)) ctx.fillRect(c * PX + PX / 2, r * PX + inset, PX, PX - inset * 2);
          if (isPath(c, r + 1)) ctx.fillRect(c * PX + inset, r * PX + PX / 2, PX - inset * 2, PX);
          const out = (m.at(c, r) === 'S' || m.at(c, r) === 'B') && m.outward({ c, r });
          if (out) ctx.fillRect(c * PX + inset + Math.min(0, out[0]) * PX, r * PX + inset + Math.min(0, out[1]) * PX,
            PX - inset * 2 + Math.abs(out[0]) * PX, PX - inset * 2 + Math.abs(out[1]) * PX);
        }
      };
      paint(4, th.pathEdge);
      paint(9, th.path);
      for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) {
        const ch = m.at(c, r);
        if (isPath(c, r)) { // pebbles
          ctx.fillStyle = 'rgba(120,90,50,0.35)';
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c * PX + 14 + rnd() * 36, r * PX + 14 + rnd() * 36, 2 + rnd() * 3, 0, 7); ctx.fill(); }
        } else if (ch === 'w') {
          ctx.fillStyle = th.water;
          Kit.gfx.roundRect(ctx, c * PX - (m.at(c - 1, r) === 'w' ? 2 : -4), r * PX - (m.at(c, r - 1) === 'w' ? 2 : -4),
            PX + (m.at(c - 1, r) === 'w' ? 2 : -4) + (m.at(c + 1, r) === 'w' ? 2 : -4), PX + (m.at(c, r - 1) === 'w' ? 2 : -4) + (m.at(c, r + 1) === 'w' ? 2 : -4), 18);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(c * PX + 20 + rnd() * 20, r * PX + 24 + rnd() * 16, 8, 3.6, 5.6); ctx.stroke();
        } else if (ch === 'f') {
          ctx.fillStyle = '#8a5a32';
          Kit.gfx.roundRect(ctx, c * PX + 6, r * PX + 6, PX - 12, PX - 12, 16);
          ctx.fill();
        }
      }
      const tex = toTexture(cv);
      tex.anisotropy = 4;
      return tex;
    }

    function buildGarden(level, s, opts = {}) {
      clear();
      map = s.map;
      W2 = map.w / 2;
      H2 = map.h / 2;
      theme = THEMES[GD.WORLDS[level.world].id];
      scene.background = new T.Color(theme.sky);
      scene.fog = new T.Fog(theme.sky, 30, 60);
      hemi.color.set(theme.hemiSky);
      hemi.groundColor.set(theme.hemiGround);
      hemi.intensity = theme.hemi;
      sun.color.set(theme.sun);
      sun.intensity = theme.sunI;
      sun.position.set(...theme.sunPos);
      ground.material.color.set(theme.out);
      world = new T.Group();
      scene.add(world);
      if (boardTex) boardTex.dispose();
      boardTex = boardTexture(map, theme);
      const board = new T.Mesh(new T.PlaneGeometry(map.w, map.h), new T.MeshStandardMaterial({ map: boardTex, roughness: 0.95 }));
      board.rotation.x = -Math.PI / 2;
      board.receiveShadow = true;
      world.add(board);
      // dirt outside each gate, where the critters walk in
      map.gates.forEach((g) => {
        const out = map.outward(g);
        const d = new T.Mesh(new T.PlaneGeometry(out[0] ? 2 : 0.8, out[0] ? 0.8 : 2), new T.MeshStandardMaterial({ color: theme.path, roughness: 1 }));
        d.rotation.x = -Math.PI / 2;
        d.position.set(X(g.c + 0.5 + out[0] * 1.2), 0.005, Z(g.r + 0.5 + out[1] * 1.2));
        d.receiveShadow = true;
        world.add(d);
        const arch = M.gate();
        arch.position.set(X(g.c + 0.5 + out[0] * 0.62), 0, Z(g.r + 0.5 + out[1] * 0.62));
        arch.rotation.y = out[0] ? Math.PI / 2 : 0;
        world.add(arch);
      });
      // hedges all round, with gaps for the gates and the picnic
      const gap = (c, r) => map.at(c, r) === 'S' || map.at(c, r) === 'B';
      const side = (cells, place) => {
        let run = [];
        const flush = () => { if (run.length) place(run[0], run[run.length - 1]); run = []; };
        for (const p of cells) { if (gap(p.c, p.r)) flush(); else run.push(p); }
        flush();
      };
      const row = (r) => Array.from({ length: map.w }, (_, c) => ({ c, r }));
      const col = (c) => Array.from({ length: map.h }, (_, r) => ({ c, r }));
      side(row(0), (a, b) => { const h = M.hedge(b.c - a.c + 1); h.position.set(X((a.c + b.c + 1) / 2), 0, Z(-0.22)); world.add(h); });
      side(row(map.h - 1), (a, b) => { const h = M.hedge(b.c - a.c + 1); h.position.set(X((a.c + b.c + 1) / 2), 0, Z(map.h + 0.22)); world.add(h); });
      side(col(0), (a, b) => { const h = M.hedge(b.r - a.r + 1); h.rotation.y = Math.PI / 2; h.position.set(X(-0.22), 0, Z((a.r + b.r + 1) / 2)); world.add(h); });
      side(col(map.w - 1), (a, b) => { const h = M.hedge(b.r - a.r + 1); h.rotation.y = Math.PI / 2; h.position.set(X(map.w + 0.22), 0, Z((a.r + b.r + 1) / 2)); world.add(h); });
      // trees, rocks, ponds and flower beds on the board
      let seed = level.id * 97;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let r = 0; r < map.h; r++) for (let c = 0; c < map.w; c++) {
        const ch = map.at(c, r);
        let o = null;
        if (ch === 'T') o = M.tree(0.85 + rnd() * 0.25);
        else if (ch === 'o') o = M.rock();
        else if (ch === 'f') { o = new T.Group(); const f1 = M.flowers(c + r); f1.position.set(-0.15, 0, -0.1); const f2 = M.flowers(c * 3 + r); f2.position.set(0.18, 0, 0.15); o.add(f1, f2); }
        else if (ch === 'w' && rnd() < 0.6) o = M.lily();
        if (!o) continue;
        o.position.set(X(c + 0.5), 0, Z(r + 0.5));
        o.rotation.y = rnd() * 6;
        world.add(o);
      }
      // the garden around the garden: trees and flowers outside the hedge
      const keepClear = [map.basket, ...map.gates].map((p) => ({ x: X(p.c + 0.5), z: Z(p.r + 0.5) }));
      for (let k = 0; k < 46; k++) {
        const a = rnd() * Math.PI * 2, rr = 1.2 + rnd() * 6;
        const x = clamp(Math.cos(a) * 20, -W2 - rr, W2 + rr), z = clamp(Math.sin(a) * 20, -H2 - rr, H2 + rr);
        if (Math.abs(x) < W2 + 0.9 && Math.abs(z) < H2 + 0.9) continue;
        if (keepClear.some((p) => Math.hypot(p.x - x, p.z - z) < 3.4)) continue;
        const o = rnd() < (theme.flowers ? 0.4 : 0.65) ? M.tree(0.8 + rnd() * 0.6) : M.flowers(k);
        o.position.set(x, 0, z);
        o.rotation.y = rnd() * 6;
        world.add(o);
      }
      if (theme.flowers) {
        for (let c = 0; c < map.w; c += 2) for (const r of [-1.05, map.h + 1.05]) {
          const f = M.flowers(c);
          f.position.set(X(c + 0.7), 0, Z(r));
          world.add(f);
        }
      }
      buildPicnic(s, opts);
      fit();
      snapCam = true;
    }

    // the picnic blanket just outside the garden, its snacks, and the brothers standing beside it
    let picnic = null;
    function buildPicnic(s, opts) {
      const b = map.basket, out = map.outward(b);
      const side = [-out[1], out[0]];
      const cx = X(b.c + 0.5 + out[0] * 1.15), cz = Z(b.r + 0.5 + out[1] * 1.15);
      const bl = M.blanket();
      const longW = 2.2, shortW = 1.6;
      bl.scale.set(out[0] ? shortW : longW, out[0] ? longW : shortW, 1);
      bl.position.set(cx, 0.012, cz);
      world.add(bl);
      const bk = M.basket();
      bk.position.set(cx + out[0] * 0.45, 0, cz + out[1] * 0.45);
      bk.rotation.y = out[0] ? Math.PI / 2 : 0;
      world.add(bk);
      snackSprites = [];
      const n = s.snacksMax, cols = n > 12 ? 5 : 4, rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const a = (i % cols) - (cols - 1) / 2, d = Math.floor(i / cols) - (rows - 1) / 2;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(SNACKS[i % SNACKS.length]), transparent: true }));
        sp.scale.set(0.3, 0.3, 1);
        // spread along the blanket's long side, rows toward the garden
        const along = a * 0.36, across = -0.15 + d * 0.28;
        sp.position.set(cx + side[0] * along - out[0] * across, 0.17, cz + side[1] * along - out[1] * across);
        world.add(sp);
        snackSprites.push(sp);
      }
      picnic = { cx, cz, out, side };
      // the brothers: one each side of the blanket (in 1 player the other side is where the buddy pops in)
      heroes = [];
      (opts.heroes || ['teddy']).forEach((id, i) => {
        const sgn = i === 0 ? -1 : 1;
        heroes.push(makePerson(id, HERO, cx + side[0] * sgn * 1.5 + out[0] * 0.2, cz + side[1] * sgn * 1.5 + out[1] * 0.2));
      });
    }
    function makePerson(id, scale, x, z) {
      const e = Kit.roster.get(id);
      const p = P.build(e.look);
      p.root.scale.setScalar(scale);
      p.root.position.set(x, 0, z);
      p.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      world.add(p.root);
      return { p, id, x, z, mode: 'stand', modeT: 0, ph: Math.random() * 6, jump: 0, scale, pop: 1 };
    }
    function clear() {
      for (const o of [...critters.values()].map((c) => c.root)) scene.remove(o);
      critters.clear();
      towers.clear();
      shots.clear();
      puddles.clear();
      for (const f of [...floaters, ...runners]) scene.remove(f.o.root);
      for (const p of popups) scene.remove(p.sprite);
      for (const f of flyers) scene.remove(f.sprite);
      floaters = []; runners = []; popups = []; flyers = [];
      if (world) { scene.remove(world); disposeTree(world); }
      world = null;
      buddy = null;
      balloonObj = null;
      celebrate = null;
      focus = null;
      rangeRing.visible = false;
      hint.visible = false;
      for (const c of cursors) c.visible = false;
    }

    // ---------------------------------------------------------------- the camera: the whole garden in the free part of the screen
    function fitPoints() {
      const pts = [];
      for (const [x, z] of [[0, 0], [map.w, 0], [0, map.h], [map.w, map.h]]) {
        pts.push(new T.Vector3(X(x), 0, Z(z)), new T.Vector3(X(x), 0.5, Z(z)));
      }
      if (picnic) {
        for (const h of heroes) pts.push(new T.Vector3(h.x, 1.15, h.z), new T.Vector3(h.x, 0, h.z));
        pts.push(new T.Vector3(picnic.cx + picnic.out[0] * 0.8, 0, picnic.cz + picnic.out[1] * 0.8));
      }
      return pts;
    }
    function fit() {
      if (!map) return;
      const w = renderer.domElement.clientWidth || window.innerWidth, h = renderer.domElement.clientHeight || window.innerHeight;
      portrait = h > w * 1.08;
      const el = 0.98; // about 56 degrees down
      const dir = portrait ? new T.Vector3(Math.cos(el), Math.sin(el), 0) : new T.Vector3(0, Math.sin(el), Math.cos(el));
      const pts = fitPoints();
      const box = { l: safe.left, t: safe.top, r: w - safe.right, b: h - safe.bottom };
      const bw = Math.max(80, box.r - box.l), bh = Math.max(80, box.b - box.t);
      const look = new T.Vector3();
      for (const p of pts) look.add(p);
      look.divideScalar(pts.length);
      look.y = 0;
      const tmp = new T.Vector3();
      const measure = (D) => {
        camera.position.copy(look).addScaledVector(dir, D);
        camera.lookAt(look);
        camera.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of pts) {
          tmp.copy(p).project(camera);
          const sx = ((tmp.x + 1) / 2) * w, sy = ((1 - tmp.y) / 2) * h;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        return { x0, x1, y0, y1 };
      };
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      let lo = 3, hi = 80;
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2, m = measure(mid);
        if (m.x1 - m.x0 <= bw * 0.97 && m.y1 - m.y0 <= bh * 0.97) hi = mid; else lo = mid;
      }
      const D = hi;
      // slide the camera so the garden sits in the middle of the free box
      const right = new T.Vector3(), up = new T.Vector3();
      for (let i = 0; i < 4; i++) {
        const m = measure(D);
        const dx = (box.l + box.r) / 2 - (m.x0 + m.x1) / 2, dy = (box.t + box.b) / 2 - (m.y0 + m.y1) / 2;
        const perPx = (2 * D * Math.tan((camera.fov * Math.PI) / 360)) / h;
        right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
        up.copy(dir).setY(0).normalize().negate(); // screen-up is away from the camera, on the ground
        look.addScaledVector(right, -dx * perPx).addScaledVector(up, dy * perPx * 1.15);
      }
      camGoal.look.copy(look);
      camGoal.pos.copy(look).addScaledVector(dir, D);
      camGoal.D = D;
      camGoal.dir = dir;
    }
    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      fit();
      snapCam = true;
    }
    function setSafe(o) { safe = o; fit(); }

    // ---------------------------------------------------------------- events from the sim
    function towerObj(id) { return towers.get(id); }
    function worldOf(x, z, y = 0) { return new T.Vector3(X(x), y, Z(z)); }
    function popup(text, x, y, z, color = '#ffffff', size = 0.9, life = 1.1) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: textTexture(text, color), transparent: true, depthWrite: false, depthTest: false }));
      sp.scale.set(size, size * 0.375, 1);
      sp.position.set(x, y, z);
      sp.renderOrder = 10;
      scene.add(sp);
      popups.push({ sprite: sp, t: 0, life, vy: 0.9 });
    }
    function emojiPop(emoji, x, y, z, size = 0.5, life = 1) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false }));
      sp.scale.set(size, size, 1);
      sp.position.set(x, y, z);
      sp.renderOrder = 9;
      scene.add(sp);
      popups.push({ sprite: sp, t: 0, life, vy: 0.6, emoji: true });
    }
    const say = (en) => Kit.lang.t(en);

    function handle(events, s) {
      for (const e of events) {
        switch (e.type) {
          case 'build': {
            const t = M.tower(e.tower);
            t.root.position.set(X(e.x), 0, Z(e.z));
            t.pop = 0;
            t.kick = 0;
            t.root.scale.setScalar(0.01);
            t.root.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
            world.add(t.root);
            towers.set(e.id, t);
            drops.emit({ x: X(e.x), y: 0.2, z: Z(e.z) }, { n: 14, color: ['#d9b27c', '#ffffff', '#b9e07a'], speed: 1.6, up: 2, life: 0.5 });
            sfx.build();
            break;
          }
          case 'upgrade': {
            const t = towerObj(e.id);
            if (t) { t.setLevel(e.lvl); t.pop = 0.4; }
            glows.emit({ x: X(e.x), y: 0.6, z: Z(e.z) }, { n: 22, color: ['#ffe066', '#ffffff', '#ffb02e'], speed: 1.4, up: 2.4, gravity: 2, life: 0.9, size: 0.16 });
            popup(e.lvl === 3 ? '★★' : '★', X(e.x), 1.2, Z(e.z), '#ffd21f', 0.8);
            sfx.upgrade();
            break;
          }
          case 'sell': {
            const t = towerObj(e.id);
            if (t) { world.remove(t.root); disposeTree(t.root); towers.delete(e.id); }
            drops.emit({ x: X(e.x), y: 0.3, z: Z(e.z) }, { n: 16, color: ['#ffffff', '#d9d6df'], speed: 1.2, up: 1.4, life: 0.5, size: 0.18 });
            popup('+' + e.n, X(e.x), 0.9, Z(e.z), '#ffe066', 0.8);
            sfx.sell();
            break;
          }
          case 'shot': {
            const t = towerObj(e.from);
            if (t) t.kick = 1;
            const sh = s.shots.find((q) => q.id === e.id);
            if (!sh) break;
            let o;
            if (e.kind === 'squirt') {
              o = new T.Mesh(M.geo('sph', () => new T.SphereGeometry(1, 18, 12)), M.mat('#3fb6ff', { roughness: 0.1, emissive: '#0a3a6a' }));
              o.scale.set(0.07, 0.07, 0.16);
              sfx.squirt();
            } else if (e.kind === 'bubble') {
              o = M.bubbleShell(0.16 + e.lvl * 0.02);
              sfx.blow();
            } else if (e.kind === 'jelly') {
              o = new T.Mesh(M.geo('sph', () => new T.SphereGeometry(1, 18, 12)), M.mat('#4fd15a', { roughness: 0.15, transparent: true, opacity: 0.9 }));
              o.scale.set(0.14, 0.11, 0.14);
              sfx.fling();
            } else {
              o = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🍪'), transparent: true }));
              o.scale.set(0.42, 0.42, 1);
              sfx.fling();
            }
            o.position.set(X(sh.x), 0.55, Z(sh.z));
            scene.add(o);
            shots.set(e.id, { o, kind: e.kind, y0: t ? 0.55 * t.inner.scale.y : 0.55 });
            break;
          }
          case 'hit': {
            const p = { x: X(e.x), y: 0.3, z: Z(e.z) };
            if (e.kind === 'squirt') { drops.emit(p, { n: 8, color: ['#3fb6ff', '#9fe0ff'], speed: 1.2, up: 1.6, life: 0.45, size: 0.09 }); sfx.drip(); }
            else if (e.kind === 'bubble') { glows.emit(p, { n: 12, color: ['#d6f4ff', '#ffc0ec', '#c0ffe8'], speed: 1.4, up: 1.2, gravity: 1, life: 0.5, size: 0.12 }); sfx.pop(); }
            else if (e.kind === 'jelly') { drops.emit(p, { n: 12, color: ['#4fd15a', '#9ff09f'], speed: 1.3, up: 1.6, life: 0.5, size: 0.11 }); sfx.splat(); }
            else {
              drops.emit(p, { n: 20, color: ['#c98a3c', '#7a4a1c', '#e8b878'], speed: 2, up: 2.2, life: 0.6, size: 0.1 });
              sfx.thump();
              if (Math.random() < 0.5) popup(say('CRUNCH!'), p.x, 0.9, p.z, '#ffd9a0', 0.8, 0.8);
            }
            break;
          }
          case 'spray': {
            const t = towerObj(e.id);
            if (t) t.kick = 1;
            for (let i = 0; i < 26; i++) {
              const a = (i / 26) * Math.PI * 2;
              drops.emit({ x: X(e.x), y: 0.55, z: Z(e.z) }, { n: 1, vx: Math.cos(a) * e.range * 1.6, vz: Math.sin(a) * e.range * 1.6, speed: 0.1, up: 1.6, gravity: 5, drag: 0.4, life: 0.55, color: ['#3fb6ff', '#9fe0ff', '#ffffff'], size: 0.09 });
            }
            sfx.spray();
            break;
          }
          case 'puddle': {
            const m = new T.Mesh(M.geo('disc', () => new T.CircleGeometry(1, 20)), new T.MeshStandardMaterial({ color: '#4fd15a', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }));
            m.rotation.x = -Math.PI / 2;
            m.position.set(X(e.x), 0.02, Z(e.z));
            m.scale.setScalar(0.01);
            m.userData.r = e.r;
            world.add(m);
            puddles.set(e.id, m);
            break;
          }
          case 'puddleGone': {
            const m = puddles.get(e.id);
            if (m) { world.remove(m); m.material.dispose(); puddles.delete(e.id); }
            break;
          }
          case 'float': {
            const c = critters.get(e.id);
            if (!c) break;
            critters.delete(e.id);
            c.meter.visible = false;
            const big = e.critter === 'boss';
            const shell = M.bubbleShell(big ? 1.0 : e.critter === 'ant' ? 0.32 : 0.46);
            shell.position.y = big ? 0.55 : 0.25;
            c.root.add(shell);
            M.setEyes(c, 0.15);
            M.setWet(c, 1);
            floaters.push({ o: c, t: 0, shell, big, sway: Math.random() * 6 });
            popup('+' + e.coins, c.root.position.x, 0.9, c.root.position.z, '#ffe066', 0.7);
            if (e.by === 'cookie' || e.by === 'bubble') popup('Zzz', c.root.position.x + 0.3, 1.2, c.root.position.z, '#b9e3ff', 0.6, 1.4);
            sfx.float();
            break;
          }
          case 'steal': {
            const c = critters.get(e.id);
            critters.delete(e.id);
            for (let k = 0; k < e.n; k++) {
              const sp = snackSprites.filter((q) => q.visible).pop();
              if (!sp) break;
              sp.visible = false;
              const fly = new T.Sprite(sp.material);
              fly.scale.copy(sp.scale);
              fly.position.copy(sp.position);
              scene.add(fly);
              flyers.push({ sprite: fly, t: -k * 0.12, from: sp.position.clone(), target: c, life: 0.45 });
            }
            if (c) {
              c.meter.visible = false;
              runners.push({ o: c, t: 0 });
            }
            for (const h of heroes) { h.mode = 'grab'; h.modeT = 0.9; }
            popup(say('NOM!'), picnic.cx, 1.1, picnic.cz, '#ff9fb0', 0.8);
            sfx.steal();
            break;
          }
          case 'waveClear':
            for (const h of heroes) { h.mode = 'wave'; h.modeT = 1.6; }
            break;
        }
      }
    }

    // ---------------------------------------------------------------- every frame: follow the sim
    function sync(s, dt) {
      if (!s || !world) return;
      time += dt;
      // critters
      const seen = new Set();
      for (const c of s.critters) {
        seen.add(c.id);
        let o = critters.get(c.id);
        if (!o) {
          o = M.critter(c.type);
          o.root.traverse((m) => { if (m.isMesh && m !== o.meter.children[0] && m !== o.fill) m.castShadow = true; });
          o.side = (((c.id * 37) % 7) / 6 - 0.5) * 0.3;
          o.ph = Math.random() * 6;
          o.lastSoak = 0;
          o.jig = 0;
          o.root.scale.setScalar(0.01);
          o.grow = 0;
          scene.add(o.root);
          critters.set(c.id, o);
        }
        const p = GD.Sim.posOf(s, c);
        const tx = X(p.x) - p.dz * o.side, tz = Z(p.z) + p.dx * o.side;
        o.root.position.x = tx;
        o.root.position.z = tz;
        const speed = c.speed * (1 - c.slow);
        o.ph += dt * speed * 9;
        const bob = Math.abs(Math.sin(o.ph)) * (c.fly ? 0 : 0.04);
        o.inner.position.y = bob + (c.fly ? Math.sin(time * 3 + o.side * 9) * 0.05 : 0);
        turn(o.inner, Math.atan2(p.dx, p.dz), dt * 10);
        if (o.feet) o.feet.forEach((f, i) => { f.position.z = (o.feet.length > 2 ? -0.06 + Math.floor(i / 2) * 0.06 : 0.05) + Math.sin(o.ph + i * Math.PI) * 0.04; });
        if (o.wings) o.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(time * 40) * 0.5); });
        if (o.tail) o.tail.rotation.x = Math.sin(o.ph * 0.5) * 0.25;
        if (o.shell) o.shell.scale.set(1, 1 + Math.sin(o.ph) * 0.04, 1);
        if (o.grow < 1) { o.grow = Math.min(1, o.grow + dt * 3); o.root.scale.setScalar(easeOutBack(o.grow)); }
        // soaking: the meter, a wet look, sleepy eyes and a jiggle when hit
        const k = c.soak / c.hp;
        if (c.soak > o.lastSoak) { o.jig = 1; o.lastSoak = c.soak; }
        o.jig = Math.max(0, o.jig - dt * 4);
        o.inner.scale.set(1 + o.jig * 0.15, 1 - o.jig * 0.15, 1 + o.jig * 0.15);
        o.meter.visible = k > 0.001;
        o.fill.scale.x = Math.max(0.001, o.fillW * k);
        o.meter.quaternion.copy(camera.quaternion);
        M.setWet(o, k);
        M.setEyes(o, k > 0.65 ? 0.45 : 1);
        if (c.slow > 0 && Math.random() < dt * 6) drops.emit({ x: tx, y: 0.06, z: tz }, { n: 1, color: '#4fd15a', speed: 0.3, up: 0.3, life: 0.5, size: 0.1 });
        if (k > 0.3 && Math.random() < dt * k * 5) drops.emit({ x: tx, y: 0.35, z: tz }, { n: 1, color: '#9fe0ff', speed: 0.2, up: 0.2, life: 0.4, size: 0.06 });
      }
      for (const [id, o] of critters) if (!seen.has(id)) { scene.remove(o.root); disposeTree(o.root); critters.delete(id); }

      // towers
      for (const t of s.towers) {
        const o = towers.get(t.id);
        if (!o) continue;
        if (o.pop < 1) { o.pop = Math.min(1, o.pop + dt * 3.5); o.root.scale.setScalar(easeOutBack(o.pop)); }
        o.kick = Math.max(0, (o.kick || 0) - dt * 4);
        if (o.head && !o.headSpins) turn(o.head, t.aim, dt * 12);
        else if (o.head && t.type === 'cookie') turn(o.head, t.aim + Math.PI, dt * 8);
        if (t.type === 'sprinkler') o.head.rotation.y += dt * (1.5 + o.kick * 14);
        if (t.type === 'cookie') o.arm.rotation.x = -o.kick * 1.7 * Math.sin(Math.min(1, o.kick) * Math.PI);
        if (t.type === 'cookie') o.cookie.visible = t.cd < GD.TOWERS.cookie.lv[t.lvl - 1].rate - 0.5;
        if (t.type === 'bubble') { const q = 1 + o.kick * 0.5; o.ring.scale.set(0.15 * q, 0.15 * q, 0.15); o.film.scale.setScalar(0.14 * q); }
        if (t.type === 'jelly') o.jelly.scale.set(1 + Math.sin(time * 9) * 0.04 + o.kick * 0.2, 1 - Math.sin(time * 9) * 0.04 - o.kick * 0.25, 1 + Math.sin(time * 9) * 0.04 + o.kick * 0.2);
        o.inner.position.y = -o.kick * 0.04;
      }

      // shots in the air
      const live = new Set();
      for (const sh of s.shots) {
        live.add(sh.id);
        const v = shots.get(sh.id);
        if (!v) continue;
        const y = sh.h !== undefined ? 0.45 + sh.h : v.kind === 'bubble' ? 0.5 + Math.sin(sh.t * 12) * 0.05 : 0.5;
        if (v.kind === 'squirt') v.o.lookAt(X(sh.tx), y, Z(sh.tz));
        v.o.position.set(X(sh.x), y, Z(sh.z));
        if (v.kind === 'cookie') v.o.material.rotation += dt * 9;
      }
      for (const [id, v] of shots) if (!live.has(id)) { scene.remove(v.o); if (v.kind === 'cookie' || v.kind === 'bubble') v.o.material.dispose(); shots.delete(id); }

      // jelly puddles
      for (const pd of s.puddles) {
        const m = puddles.get(pd.id);
        if (!m) continue;
        const grow = Math.min(1, (pd.max - pd.life) * 6);
        m.scale.setScalar(m.userData.r * easeOutBack(grow));
        m.material.opacity = 0.55 * Math.min(1, pd.life / 0.6);
      }

      // snacks left on the blanket
      snackSprites.forEach((sp, i) => {
        sp.visible = i < s.snacks;
        sp.position.y = 0.17 + Math.max(0, Math.sin(time * 3 + i)) * 0.02;
      });
      animate(dt);
    }

    function animate(dt) {
      // floating away in a bubble
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.t += dt;
        const r = f.o.root;
        r.position.y += (0.55 + f.t * 0.35) * dt;
        r.position.x += Math.sin(f.t * 2.2 + f.sway) * dt * 0.35;
        f.o.inner.rotation.z = Math.sin(f.t * 2) * 0.25;
        f.shell.scale.setScalar(f.shell.scale.x * (1 + Math.sin(f.t * 8) * 0.004));
        if (f.t > 2.3) {
          glows.emit({ x: r.position.x, y: r.position.y + 0.3, z: r.position.z }, { n: 14, color: ['#d6f4ff', '#ffffff', '#ffc0ec'], speed: 1.4, up: 0.6, gravity: 0.5, life: 0.5, size: 0.12 });
          scene.remove(r);
          disposeTree(r);
          floaters.splice(i, 1);
        }
      }
      // running off with a snack
      for (let i = runners.length - 1; i >= 0; i--) {
        const f = runners[i];
        f.t += dt;
        const r = f.o.root;
        const out = picnic ? picnic.out : [1, 0];
        r.position.x += out[0] * dt * 2.2;
        r.position.z += out[1] * dt * 2.2;
        f.o.inner.position.y = Math.abs(Math.sin(f.t * 14)) * 0.12;
        turn(f.o.inner, Math.atan2(out[0], out[1]), dt * 10);
        if (f.t > 1.0) r.scale.setScalar(Math.max(0.01, 1 - (f.t - 1) * 3));
        if (f.t > 1.33) { scene.remove(r); disposeTree(r); runners.splice(i, 1); }
      }
      // snacks flying to whoever grabbed them
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i];
        f.t += dt;
        if (f.t < 0) continue;
        const k = Math.min(1, f.t / f.life);
        const head = f.target && f.target.big ? 1.35 : 0.62;
        const to = f.to || (f.target ? tmpV.set(f.target.root.position.x, head, f.target.root.position.z) : f.from);
        f.sprite.position.lerpVectors(f.from, to, k);
        f.sprite.position.y += Math.sin(k * Math.PI) * 0.6;
        if (k < 1) continue;
        if (f.target && runners.some((r) => r.o === f.target)) f.sprite.position.copy(to); // riding off on the critter's head
        else { scene.remove(f.sprite); if (f.own) f.sprite.material.dispose(); flyers.splice(i, 1); }
      }
      // word popups
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.t += dt;
        p.sprite.position.y += p.vy * dt;
        p.vy *= Math.exp(-2 * dt);
        p.sprite.material.opacity = Math.min(1, (p.life - p.t) * 4);
        if (p.t < 0.15) { const k = p.t / 0.15; p.sprite.scale.multiplyScalar(1 + (1 - k) * 0.05); }
        if (p.t > p.life) { scene.remove(p.sprite); p.sprite.material.dispose(); popups.splice(i, 1); }
      }
      // the brothers
      for (const h of [...heroes, buddy].filter(Boolean)) {
        h.ph += dt * 6;
        if (h.modeT > 0) { h.modeT -= dt; if (h.modeT <= 0 && !h.hold) h.mode = 'stand'; }
        P.pose(h.p, h.ph, h.mode, 1 - Math.exp(-16 * dt));
        // a jump shot goes up in the air
        const jumping = h.mode === 'jumpshot';
        h.jump = jumping ? Math.max(0, Math.sin(h.ph * 0.5)) * 0.35 : Math.max(0, h.jump - dt * 2);
        h.p.root.position.y = h.jump;
        if (h.leaving) h.pop = Math.max(0, h.pop - dt * 3);
        else if (h.pop < 1) h.pop = Math.min(1, h.pop + dt * 3);
        h.p.root.scale.setScalar(h.scale * (h.leaving ? h.pop : easeOutBack(h.pop)));
        const cp = camera.position;
        const face = Math.atan2(-(cp.x - h.p.root.position.x), -(cp.z - h.p.root.position.z));
        turn(h.p.root, h.face !== undefined ? h.face : face, dt * 8);
        if (h.ball) {
          h.ball.visible = jumping;
          if (jumping) { P.handWorld(h.p, 1, h.ball.position); h.ball.position.y += 0.12 + Math.max(0, Math.sin(h.ph * 0.5)) * 0.3; }
        }
      }
      if (buddy && buddy.leaving && buddy.pop <= 0) { world.remove(buddy.p.root); buddy = null; }
      if (hand) { hand.t += dt; if (hand.t > 1.2) { scene.remove(hand.sprite); hand = null; } else { hand.sprite.position.y = hand.y + Math.sin(hand.t * 6) * 0.05; hand.sprite.material.rotation = Math.sin(hand.t * 10) * 0.2; } }
      // the giant water balloon in the air
      if (balloonObj) {
        const b = balloonObj;
        b.t += dt;
        const k = Math.min(1, b.t / b.T);
        b.o.position.lerpVectors(b.from, b.to, k);
        b.o.position.y += Math.sin(k * Math.PI) * 3.2;
        b.o.rotation.z += dt * 4;
        b.o.scale.setScalar(0.6 + k * 0.6);
        if (k >= 1) { scene.remove(b.o); const done = b.done; balloonObj = null; if (done) done(); }
      }
      // EASY's sparkly "build here!" tile
      if (hint.visible) {
        hint.userData.star.position.y = 0.55 + Math.sin(time * 4) * 0.08;
        hint.userData.star.material.rotation = Math.sin(time * 2) * 0.3;
        hint.children[0].material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
      }
      if (theme.fireflies && Math.random() < dt * 5) {
        glows.emit({ x: (Math.random() - 0.5) * (W2 * 2 + 6), y: 0.3 + Math.random() * 1.2, z: (Math.random() - 0.5) * (H2 * 2 + 4) },
          { n: 1, color: '#fff27a', speed: 0.15, up: 0.1, gravity: -0.05, life: 2.5, size: 0.14, shrink: false });
      }
      if (celebrate) {
        celebrate.t += dt;
        if (Math.random() < dt * 14) {
          const c = celebrate.at;
          drops.emit({ x: c.x + (Math.random() - 0.5) * 4, y: 3.2, z: c.z + (Math.random() - 0.5) * 2 },
            { n: 3, color: ['#ff3d7f', '#ffd21f', '#18d4ff', '#7ed957', '#9b6bff', '#ff8a1f'], speed: 0.5, up: 0.2, gravity: 1.2, drag: 1.5, life: 2.4, size: 0.14, shrink: false });
        }
      }
      drops.update(dt);
      glows.update(dt);
    }

    // ---------------------------------------------------------------- the brothers' moments
    function heroMode(i, mode, t = 1.6, hold = false) {
      const h = heroes[i];
      if (!h) return;
      h.mode = mode;
      h.modeT = t;
      h.hold = hold;
    }
    function ensureBall(h) {
      if (h.ball) return;
      h.ball = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🏀'), transparent: true }));
      h.ball.scale.set(0.3, 0.3, 1);
      h.ball.visible = false;
      scene.add(h.ball);
    }
    // the winner's signature move: Teddy boxes then shoots a 🏀 jump shot; Tommy does his Y pose
    function signature(i, phase) {
      const h = heroes[i] || buddy;
      if (!h) return;
      const sig = Kit.roster.get(h.id).signature;
      const mode = sig[Math.floor(phase) % sig.length];
      if (mode === 'jumpshot') ensureBall(h);
      h.mode = mode;
      h.modeT = 99;
      h.hold = true;
      h.face = undefined;
    }
    function buddyArrive(id) {
      if (buddy && !buddy.leaving) return buddy;
      if (buddy) world.remove(buddy.p.root);
      const sgn = heroes.length > 1 ? 0 : 1;
      const e = Kit.roster.get(id);
      const x = picnic.cx + picnic.side[0] * sgn * 1.5 + picnic.out[0] * (sgn ? 0.2 : 0.9);
      const z = picnic.cz + picnic.side[1] * sgn * 1.5 + picnic.out[1] * (sgn ? 0.2 : 0.9);
      buddy = makePerson(id, HERO * (e.buddyScale || 0.8), x, z);
      buddy.pop = 0;
      glows.emit({ x, y: 0.6, z }, { n: 30, color: ['#ffe066', '#ffffff', '#ff9fd0'], speed: 1.8, up: 2, gravity: 1, life: 0.8, size: 0.16 });
      sfx.poof();
      return buddy;
    }
    function buddyMode(mode, t = 99) {
      if (!buddy) return;
      if (mode === 'signature') {
        const sig = Kit.roster.get(buddy.id).signature;
        mode = sig[0];
        if (mode === 'jumpshot') ensureBall(buddy);
      }
      buddy.mode = mode;
      buddy.modeT = t;
      buddy.hold = t > 50;
    }
    function buddyLeave() {
      if (!buddy || buddy.leaving) return;
      buddy.leaving = true;
      glows.emit({ x: buddy.x, y: 0.6, z: buddy.z }, { n: 20, color: ['#ffe066', '#ffffff'], speed: 1.4, up: 1.6, gravity: 1, life: 0.6, size: 0.14 });
    }
    // a treat flies from the buddy to the hero: returns how long it takes
    function tossTreat(emoji) {
      if (!buddy || !heroes[0]) return 0;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true }));
      sp.scale.set(0.42, 0.42, 1);
      sp.position.set(buddy.x, 0.7, buddy.z);
      scene.add(sp);
      flyers.push({ sprite: sp, t: 0, from: sp.position.clone(), to: new T.Vector3(heroes[0].x, 1.0, heroes[0].z), life: 0.6, own: true });
      sfx.toss();
      return 0.6;
    }
    function treatLanded(emoji, text) {
      if (!heroes[0]) return;
      const h = heroes[0];
      emojiPop(emoji, h.x, 1.25, h.z, 0.45, 1);
      if (text) popup(text, h.x, 1.6, h.z, '#ffe066', 0.8);
      h.mode = 'jump';
      h.modeT = 0.35;
      sfx.yum();
    }
    // the giant water balloon: from the buddy's hands to a spot on the chosen lane
    function throwBalloon(x, z, T_, done) {
      const o = M.balloon();
      const from = buddy ? new T.Vector3(buddy.x, 1.0, buddy.z) : new T.Vector3(picnic.cx, 1, picnic.cz);
      o.position.copy(from);
      scene.add(o);
      balloonObj = { o, t: 0, T: T_, from, to: new T.Vector3(X(x), 0.4, Z(z)), done };
      sfx.throwBig();
    }
    // the splash: water all the way along one lane
    function splashLane(line, x, z) {
      const c = { x: X(x), y: 0.3, z: Z(z) };
      drops.emit(c, { n: 90, color: ['#3fb6ff', '#9fe0ff', '#ffffff'], speed: 4.5, up: 4, gravity: 7, drag: 0.8, life: 1.0, size: 0.16 });
      for (let d = 0; d < line.len; d += 0.4) {
        const p = GD.Sim.pointAt(line, d);
        drops.emit({ x: X(p.x), y: 0.15, z: Z(p.z) }, { n: 3, color: ['#3fb6ff', '#9fe0ff', '#ffffff'], speed: 0.8, up: 2.6, gravity: 7, life: 0.8, size: 0.12 });
      }
      popup(say('SPLASH!'), c.x, 1.5, c.z, '#9fe0ff', 1.6, 1.4);
      sfx.bigSplash();
    }
    function highFive() {
      if (heroes.length < 2) return;
      const [a, b] = heroes;
      a.face = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      b.face = Math.atan2(-(a.x - b.x), -(a.z - b.z));
      for (const h of heroes) { h.mode = 'give'; h.modeT = 1.0; h.hold = false; }
      setTimeout(() => { for (const h of heroes) h.face = undefined; }, 1100);
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (hand) scene.remove(hand.sprite);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('✋'), transparent: true }));
      sp.scale.set(0.6, 0.6, 1);
      sp.position.set(mx, 1.3, mz);
      scene.add(sp);
      hand = { sprite: sp, t: 0, y: 1.3 };
      glows.emit({ x: mx, y: 1.2, z: mz }, { n: 34, color: ['#ffe066', '#ffffff', '#ff9fd0', '#9fe0ff'], speed: 2.2, up: 1.5, gravity: 1.5, life: 0.8, size: 0.16 });
      sfx.clap();
    }

    // ---------------------------------------------------------------- cursors, range, hint
    function setCursor(i, cell, state, color) {
      while (cursors.length <= i) cursors.push(makeCursor('#ffffff'));
      const c = cursors[i];
      if (!cell || !map) { c.visible = false; return; }
      c.visible = true;
      c.position.set(X(cell.c + 0.5), 0.04, Z(cell.r + 0.5));
      const col = color || (state === 'no' ? '#ff5a5a' : state === 'tower' ? '#ffd21f' : '#7bff6a');
      c.userData.ring.material.color.set(col);
      c.userData.fill.material.color.set(col);
      c.userData.fill.material.opacity = state === 'no' ? 0.3 : 0.18;
      c.scale.setScalar(1 + Math.sin(time * 6) * 0.03);
    }
    function setRange(x, z, r) {
      if (x === null) { rangeRing.visible = false; return; }
      rangeRing.visible = true;
      rangeRing.position.set(X(x), 0.03, Z(z));
      rangeRing.scale.set(r, 1, r);
    }
    function setHint(cell) {
      hint.visible = !!cell;
      if (cell) hint.position.set(X(cell.c + 0.5), 0, Z(cell.r + 0.5));
    }

    // ---------------------------------------------------------------- input helpers
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
    function pick(px, py) {
      if (!map) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const c = Math.floor(hit.x + W2), r = Math.floor(hit.z + H2);
      if (c < 0 || r < 0 || c >= map.w || r >= map.h) return null;
      return { c, r };
    }
    function toScreen(x, z, y = 0) {
      const v = new T.Vector3(X(x), y, Z(z)).project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    }
    // which way is "up" on screen, in grid steps (for arrow keys when the garden is turned for a tall phone)
    const isPortrait = () => portrait;

    // ---------------------------------------------------------------- the win (and the lose) moment
    function startCelebrate(win) {
      const hs = heroes;
      if (!hs.length) return;
      const at = new T.Vector3();
      for (const h of hs) at.add(new T.Vector3(h.x, 0, h.z));
      at.divideScalar(hs.length);
      celebrate = { t: 0, win, at };
      if (win) hs.forEach((h, i) => signature(i, 0));
      else for (const h of hs) { h.mode = 'fall'; h.modeT = 0.8; h.hold = false; }
      if (win) focus = { look: new T.Vector3(at.x, 0.5, at.z), D: hs.length > 1 ? 6.2 : 5 };
    }
    function stopCelebrate() { celebrate = null; focus = null; for (const h of heroes) { h.mode = 'stand'; h.hold = false; } }
    function peek(x, z, D = 5) { focus = x === null ? null : { look: new T.Vector3(X(x), 0.3, Z(z)), D }; }

    // ---------------------------------------------------------------- render
    function render(dt) {
      if (focus && camGoal.dir) {
        const pos = focus.look.clone().addScaledVector(camGoal.dir, focus.D);
        const k = snapCam ? 1 : 1 - Math.exp(-3 * dt);
        camNow.pos.lerp(pos, k);
        camNow.look.lerp(focus.look, k);
      } else {
        const k = snapCam ? 1 : 1 - Math.exp(-4 * dt);
        camNow.pos.lerp(camGoal.pos, k);
        camNow.look.lerp(camGoal.look, k);
      }
      snapCam = false;
      camera.position.copy(camNow.pos);
      camera.lookAt(camNow.look);
      sun.target.position.copy(camNow.look);
      sun.position.copy(camNow.look).add(new T.Vector3(...theme.sunPos));
      drops.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      glows.material.uniforms.scale.value = drops.material.uniforms.scale.value;
      renderer.render(scene, camera);
    }

    // ---------------------------------------------------------------- pictures of the towers and critters for the menus
    function icons(list, size = 128) {
      const out = {};
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      let r;
      try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return out; }
      r.outputEncoding = T.sRGBEncoding;
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight('#ffffff', '#88aa66', 1.0));
      const d = new T.DirectionalLight('#ffffff', 0.8);
      d.position.set(2, 4, 3);
      sc.add(d);
      const cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
      for (const [kind, type] of list) {
        const o = kind === 'tower' ? M.tower(type) : M.critter(type);
        if (kind === 'critter') { o.meter.visible = false; o.inner.rotation.y = 0.6; }
        else o.head.rotation.y = 0.5;
        sc.add(o.root);
        const big = type === 'boss' ? 1.25 : kind === 'tower' ? 0.85 : type === 'ant' ? 0.3 : 0.55;
        cam.position.set(big * 1.6, big * 1.7, big * 2.4);
        cam.lookAt(0, big * 0.45, 0);
        r.setClearColor(0x000000, 0);
        r.render(sc, cam);
        out[type] = cv.toDataURL('image/png');
        sc.remove(o.root);
      }
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
      return out;
    }

    window.addEventListener('resize', resize);
    resize();
    return {
      renderer, scene, camera,
      build: buildGarden, sync, handle, render, resize, setSafe, fit, pick, toScreen, isPortrait,
      setCursor, setRange, setHint, heroMode, signature, buddyArrive, buddyMode, buddyLeave, tossTreat, treatLanded,
      throwBalloon, splashLane, highFive, startCelebrate, stopCelebrate, peek, icons, popup,
      get counts() { return { critters: critters.size, towers: towers.size, shots: shots.size, floaters: floaters.length, runners: runners.length, popups: popups.length }; },
      get buddy() { return buddy; },
      get heroes() { return heroes; },
    };
  }

  GD.View = View;
})();
