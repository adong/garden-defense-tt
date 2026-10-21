/* TT Garden Defense: the rules. No Three.js and no page, so node can run it too (tools/check.js).
   The garden is a grid of cells; x / z below are in cells (cell c, r has its centre at c + 0.5, r + 0.5).
   Critters walk their route from a gate to the picnic; towers fill their soak meters; a full meter floats them away.
   Everything steps at a fixed 1/60 s, so a level plays out the same at any frame rate.
   Exposes GD.Sim. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});
  const TOWERS = GD.TOWERS, CRITTERS = GD.CRITTERS, TUNE = GD.TUNE;
  const STEP = 1 / 60;
  const WALK = '#SB';
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // ---------------------------------------------------------------- the map and path-finding
  function parseMap(rows) {
    const h = rows.length, w = rows[0].length;
    const gates = [];
    let basket = null;
    for (let r = 0; r < h; r++) {
      if (rows[r].length !== w) throw new Error(`map row ${r} is ${rows[r].length} wide, not ${w}`);
      for (let c = 0; c < w; c++) {
        const ch = rows[r][c];
        if (ch === 'S') gates.push({ c, r });
        else if (ch === 'B') basket = { c, r };
      }
    }
    const at = (c, r) => (c >= 0 && r >= 0 && c < w && r < h ? rows[r][c] : null);
    const walkable = (c, r) => WALK.includes(at(c, r));
    const buildable = (c, r) => at(c, r) === '.';
    // which way is "outside" for an edge cell
    const outward = (p) => (p.c === 0 ? [-1, 0] : p.c === w - 1 ? [1, 0] : p.r === 0 ? [0, -1] : p.r === h - 1 ? [0, 1] : null);
    const routes = basket ? gates.map((g) => findPath(g, basket, walkable, w, h)) : gates.map(() => null);
    const lines = routes.map((cells, i) => (cells ? polyline(cells, outward(gates[i]) || away(cells)) : null));
    return { w, h, rows, gates, basket, routes, lines, at, walkable, buildable, outward };
  }
  const away = (cells) => (cells.length > 1 ? [cells[0].c - cells[1].c, cells[0].r - cells[1].r] : [-1, 0]);

  // Breadth-first search over path cells: the shortest way from a gate to the picnic, or null.
  function findPath(from, to, walkable, w, h) {
    const prev = new Map();
    const key = (c, r) => r * w + c;
    const q = [from];
    prev.set(key(from.c, from.r), null);
    for (let qi = 0; qi < q.length; qi++) {
      const p = q[qi];
      if (p.c === to.c && p.r === to.r) {
        const out = [];
        for (let k = key(p.c, p.r); k !== null; k = prev.get(k)) out.push({ c: k % w, r: Math.floor(k / w) });
        return out.reverse();
      }
      for (const [dc, dr] of DIRS) {
        const c = p.c + dc, r = p.r + dr;
        if (c < 0 || r < 0 || c >= w || r >= h || !walkable(c, r) || prev.has(key(c, r))) continue;
        prev.set(key(c, r), key(p.c, p.r));
        q.push({ c, r });
      }
    }
    return null;
  }

  // A route as points to walk through: in from just outside the gate, then every cell centre to the picnic.
  function polyline(cells, out) {
    const pts = [{ x: cells[0].c + 0.5 + out[0] * 1.5, z: cells[0].r + 0.5 + out[1] * 1.5 }];
    for (const p of cells) pts.push({ x: p.c + 0.5, z: p.r + 0.5 });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function pointAt(line, d) {
    const { pts, cum } = line;
    if (d <= 0) {
      const a = pts[0], b = pts[1], l = cum[1];
      return { x: a.x + ((b.x - a.x) * d) / l, z: a.z + ((b.z - a.z) * d) / l, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
    }
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = pts[i - 1], b = pts[i], l = cum[i] - cum[i - 1];
    const k = Math.min(1, (d - cum[i - 1]) / l);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
  }

  // ---------------------------------------------------------------- waves
  // 'mouse x8 /1.2 +3 @1' -> { type: 'mouse', n: 8, every: 1.2, delay: 3, gate: 1 }
  function parseGroup(str) {
    const g = { type: null, n: 1, every: 1, delay: 0, gate: null };
    for (const tok of str.trim().split(/\s+/)) {
      if (tok[0] === 'x') g.n = +tok.slice(1);
      else if (tok[0] === '/') g.every = +tok.slice(1);
      else if (tok[0] === '+') g.delay = +tok.slice(1);
      else if (tok[0] === '@') g.gate = +tok.slice(1);
      else g.type = tok;
    }
    if (!CRITTERS[g.type]) throw new Error(`unknown critter "${g.type}" in "${str}"`);
    return g;
  }
  const parseWave = (str) => str.split(',').map(parseGroup);

  // When each critter of a wave comes in, and from which gate.
  function spawnList(groups, nGates) {
    const out = [];
    let turn = 0;
    groups.forEach((g) => {
      for (let k = 0; k < g.n; k++) {
        const gate = g.gate !== null ? Math.min(g.gate, nGates - 1) : turn++ % nGates;
        out.push({ at: g.delay + k * g.every, type: g.type, gate });
      }
    });
    return out.sort((a, b) => a.at - b.at);
  }

  // ---------------------------------------------------------------- a game
  function create(levelIndex, opts = {}) {
    const level = GD.LEVELS[levelIndex];
    const map = parseMap(level.map);
    const easy = opts.easy !== false;
    const D = easy ? TUNE.easy : TUNE.normal;
    const coins = Math.round((level.coins * D.coins) / 5) * 5;
    const s = {
      level, index: levelIndex, map, easy, D, players: opts.players || 1,
      t: 0, acc: 0, nextId: 1,
      coins, snacks: D.snacks, snacksMax: D.snacks,
      ledger: { start: coins, rewards: 0, bonuses: 0, treats: 0, refunds: 0, spent: 0 },
      hpMul: D.hp * (1 + TUNE.perLevelHp * levelIndex), speedMul: D.speed,
      towers: [], critters: [], shots: [], puddles: [], events: [], occupied: new Map(),
      waves: level.waves.map(parseWave), wave: -1, waveT: 0, queue: [],
      phase: 'build', breakT: D.firstBreak, result: null,
      floated: 0, stolen: 0, earlyBonus: 0, noLose: !!opts.noLose,
    };
    return s;
  }

  const ev = (s, type, o) => s.events.push(Object.assign({ type, t: s.t }, o));
  function earn(s, kind, n) {
    if (!(n > 0)) return;
    s.coins += n;
    s.ledger[kind] += n;
    ev(s, 'coins', { n, kind });
  }
  function spend(s, n) {
    if (s.coins < n) return false;
    s.coins -= n;
    s.ledger.spent += n;
    return true;
  }

  // ---------------------------------------------------------------- building
  const cellKey = (s, c, r) => r * s.map.w + c;
  const stats = (t) => TOWERS[t.type].lv[t.lvl - 1];
  function canBuild(s, c, r) {
    return !s.result && s.map.buildable(c, r) && !s.occupied.has(cellKey(s, c, r));
  }
  function build(s, type, c, r, owner) {
    const T = TOWERS[type];
    if (!T || !canBuild(s, c, r) || !spend(s, T.cost)) return null;
    const t = { id: s.nextId++, type, c, r, x: c + 0.5, z: r + 0.5, lvl: 1, cd: 0.2, spent: T.cost, builtT: s.t,
      aim: 0, floats: 0, owner: owner || null };
    s.towers.push(t);
    s.occupied.set(cellKey(s, c, r), t.id);
    ev(s, 'build', { id: t.id, tower: type, x: t.x, z: t.z, owner: t.owner });
    return t;
  }
  const upgradeCost = (t) => (t.lvl < 3 ? TOWERS[t.type].up[t.lvl - 1] : null);
  function upgrade(s, id) {
    const t = towerById(s, id);
    if (!t || s.result) return false;
    const cost = upgradeCost(t);
    if (cost === null || !spend(s, cost)) return false;
    t.lvl++;
    t.spent += cost;
    ev(s, 'upgrade', { id: t.id, lvl: t.lvl, x: t.x, z: t.z });
    return true;
  }
  const refundOf = (s, t) => (s.t - t.builtT <= TUNE.undoT ? t.spent : Math.floor(t.spent * TUNE.refund));
  function sell(s, id) {
    const t = towerById(s, id);
    if (!t || s.result) return 0;
    const back = refundOf(s, t);
    s.towers.splice(s.towers.indexOf(t), 1);
    s.occupied.delete(cellKey(s, t.c, t.r));
    earn(s, 'refunds', back);
    ev(s, 'sell', { id: t.id, x: t.x, z: t.z, n: back });
    return back;
  }
  const towerById = (s, id) => s.towers.find((t) => t.id === id) || null;
  const towerAt = (s, c, r) => towerById(s, s.occupied.get(cellKey(s, c, r)));

  // ---------------------------------------------------------------- waves
  function callWave(s) {
    if (s.result || (s.phase !== 'build' && s.phase !== 'break')) return false;
    // calling the next wave early gives a coin for every second left on the clock
    const bonus = s.phase === 'break' ? Math.floor(s.breakT) : 0;
    if (bonus > 0) { s.earlyBonus += bonus; earn(s, 'bonuses', bonus); }
    startWave(s);
    return true;
  }
  function startWave(s) {
    s.wave++;
    s.waveT = 0;
    s.phase = 'wave';
    s.queue = spawnList(s.waves[s.wave], s.map.gates.length);
    ev(s, 'waveStart', { wave: s.wave, of: s.waves.length, boss: s.queue.some((q) => CRITTERS[q.type].boss) });
  }
  function spawn(s, type, gate) {
    const C = CRITTERS[type];
    const boss = C.boss ? 1 + 0.25 * Math.floor(s.index / 5) : 1;
    const c = { id: s.nextId++, type, route: gate, d: 0, hp: C.hp * s.hpMul * boss, soak: 0, speed: C.speed * s.speedMul,
      slow: 0, slowT: 0, fly: !!C.fly, wave: s.wave };
    s.critters.push(c);
    ev(s, 'spawn', { id: c.id, critter: type, route: gate });
    return c;
  }
  const critterById = (s, id) => s.critters.find((c) => c.id === id) || null;
  const posOf = (s, c, extra = 0) => pointAt(s.map.lines[c.route], c.d + extra);
  const left = (s, c) => s.map.lines[c.route].len - c.d;

  // ---------------------------------------------------------------- soaking (nobody gets hurt)
  function soak(s, c, amt, src) {
    if (c.soak >= c.hp) return;
    c.soak = Math.min(c.hp, c.soak + amt);
    if (c.soak >= c.hp) {
      const p = posOf(s, c);
      s.critters.splice(s.critters.indexOf(c), 1);
      s.floated++;
      if (src) src.floats++;
      earn(s, 'rewards', CRITTERS[c.type].coins);
      ev(s, 'float', { id: c.id, critter: c.type, x: p.x, z: p.z, by: src ? src.type : 'balloon', coins: CRITTERS[c.type].coins });
    }
  }
  function splash(s, x, z, rad, amt, src, fn) {
    for (const c of s.critters.slice()) {
      const p = posOf(s, c);
      if (Math.hypot(p.x - x, p.z - z) <= rad) {
        if (fn) fn(c);
        soak(s, c, amt, src);
      }
    }
  }

  // ---------------------------------------------------------------- towers
  function inRange(s, t, rng) {
    const out = [];
    for (const c of s.critters) {
      if (c.d < 0.3) continue; // still at the gate
      const p = posOf(s, c);
      if (Math.hypot(p.x - t.x, p.z - t.z) <= rng) out.push(c);
    }
    return out;
  }
  function pickTarget(s, t, list) {
    let best = null, bl = Infinity;
    for (const c of list) {
      if (t.type === 'jelly' && (c.fly || c.slowT > 0.5)) continue;
      const l = left(s, c);
      if (l < bl) { bl = l; best = c; }
    }
    return best;
  }
  function fire(s, t) {
    const st = stats(t);
    const list = inRange(s, t, st.range);
    if (!list.length) return false;
    if (t.type === 'sprinkler') {
      for (const c of list) soak(s, c, st.soak, t);
      ev(s, 'spray', { id: t.id, x: t.x, z: t.z, range: st.range });
      return true;
    }
    const c = pickTarget(s, t, list);
    if (!c) return false;
    const p = posOf(s, c);
    t.aim = Math.atan2(p.x - t.x, p.z - t.z);
    const shot = { id: s.nextId++, kind: t.type, from: t.id, x: t.x, z: t.z, x0: t.x, z0: t.z, target: c.id, tx: p.x, tz: p.z,
      soak: st.soak, splash: st.splash || 0, t: 0 };
    if (t.type === 'squirt' || t.type === 'bubble') {
      shot.speed = t.type === 'squirt' ? 10 : 5;
    } else {
      // lobbed: aim where he'll be when it lands
      shot.T = t.type === 'cookie' ? 1.0 : 0.75;
      const q = posOf(s, c, c.speed * (1 - c.slow) * shot.T);
      shot.tx = q.x;
      shot.tz = q.z;
      if (t.type === 'jelly') { shot.slow = st.slow; shot.stick = st.stick; }
    }
    s.shots.push(shot);
    ev(s, 'shot', { id: shot.id, kind: shot.kind, from: t.id, lvl: t.lvl });
    return true;
  }
  function moveShot(s, sh) {
    sh.t += STEP;
    if (sh.speed) {
      const c = critterById(s, sh.target);
      if (c) { const p = posOf(s, c); sh.tx = p.x; sh.tz = p.z; }
      const dx = sh.tx - sh.x, dz = sh.tz - sh.z, d = Math.hypot(dx, dz), go = sh.speed * STEP;
      if (d > go && sh.t < 3) {
        sh.x += (dx / d) * go;
        sh.z += (dz / d) * go;
        return false;
      }
      sh.x = sh.tx;
      sh.z = sh.tz;
      const src = towerById(s, sh.from);
      if (sh.splash) splash(s, sh.x, sh.z, sh.splash, sh.soak, src);
      else if (c) soak(s, c, sh.soak, src);
      ev(s, 'hit', { kind: sh.kind, id: sh.id, x: sh.x, z: sh.z, splash: sh.splash });
      return true;
    }
    const k = Math.min(1, sh.t / sh.T);
    sh.x = sh.x0 + (sh.tx - sh.x0) * k;
    sh.z = sh.z0 + (sh.tz - sh.z0) * k;
    sh.h = Math.sin(Math.PI * k) * (sh.kind === 'cookie' ? 2.2 : 1.4);
    if (k < 1) return false;
    const src = towerById(s, sh.from);
    splash(s, sh.tx, sh.tz, sh.splash, sh.soak, src);
    if (sh.kind === 'jelly') {
      const pd = { id: s.nextId++, x: sh.tx, z: sh.tz, r: sh.splash, slow: sh.slow, life: sh.stick, max: sh.stick };
      s.puddles.push(pd);
      ev(s, 'puddle', { id: pd.id, x: pd.x, z: pd.z, r: pd.r });
    }
    ev(s, 'hit', { kind: sh.kind, id: sh.id, x: sh.tx, z: sh.tz, splash: sh.splash });
    return true;
  }

  // ---------------------------------------------------------------- the companion's giant water balloon
  // Which lane (route) the balloon should land on: the one with the most critters, nearest the picnic counting double.
  function busiestRoute(s) {
    const score = s.map.routes.map(() => 0);
    for (const c of s.critters) {
      const line = s.map.lines[c.route];
      score[c.route] += 1 + c.d / line.len + (CRITTERS[c.type].boss ? 3 : 0);
    }
    let best = 0;
    score.forEach((v, i) => { if (v > score[best]) best = i; });
    return best;
  }
  function balloon(s, route) {
    if (s.result) return 0;
    if (route === undefined) route = busiestRoute(s);
    const line = s.map.lines[route];
    const mid = pointAt(line, line.len * 0.5);
    ev(s, 'balloon', { route, x: mid.x, z: mid.z });
    let n = 0;
    for (const c of s.critters.slice()) {
      if (c.route !== route) continue;
      const before = s.floated;
      soak(s, c, CRITTERS[c.type].boss ? c.hp * TUNE.balloonBoss : c.hp, null);
      if (s.floated > before) n++;
    }
    return n;
  }
  function treat(s, n) { earn(s, 'treats', n); }

  // ---------------------------------------------------------------- one fixed step
  function tick(s) {
    s.t += STEP;
    if (s.phase === 'build' || s.phase === 'break') {
      s.breakT -= STEP;
      if (s.breakT <= 0) startWave(s);
    }
    if (s.phase === 'wave') {
      s.waveT += STEP;
      while (s.queue.length && s.queue[0].at <= s.waveT) {
        const q = s.queue.shift();
        spawn(s, q.type, q.gate);
      }
    }
    // jelly puddles
    for (let i = s.puddles.length - 1; i >= 0; i--) {
      const pd = s.puddles[i];
      pd.life -= STEP;
      if (pd.life <= 0) { s.puddles.splice(i, 1); ev(s, 'puddleGone', { id: pd.id }); continue; }
      for (const c of s.critters) {
        if (c.fly) continue;
        const p = posOf(s, c);
        if (Math.hypot(p.x - pd.x, p.z - pd.z) <= pd.r) {
          if (pd.slow >= c.slow) c.slow = pd.slow;
          c.slowT = Math.max(c.slowT, 0.6);
        }
      }
    }
    // critters walk
    for (const c of s.critters.slice()) {
      if (c.slowT > 0) { c.slowT -= STEP; if (c.slowT <= 0) c.slow = 0; }
      c.d += c.speed * (1 - c.slow) * STEP;
      if (c.d >= s.map.lines[c.route].len) {
        s.critters.splice(s.critters.indexOf(c), 1);
        const n = CRITTERS[c.type].snacks;
        s.stolen += n;
        if (!s.noLose) s.snacks = Math.max(0, s.snacks - n);
        ev(s, 'steal', { id: c.id, critter: c.type, n });
      }
    }
    // towers
    for (const t of s.towers) {
      t.cd -= STEP;
      if (t.cd <= 0 && fire(s, t)) t.cd = stats(t).rate;
      else if (t.cd <= 0) t.cd = 0;
    }
    for (let i = s.shots.length - 1; i >= 0; i--) if (moveShot(s, s.shots[i])) s.shots.splice(i, 1);

    if (s.snacks <= 0 && !s.noLose) {
      s.result = 'lose';
      ev(s, 'lose', {});
      return;
    }
    if (s.phase === 'wave' && !s.queue.length && !s.critters.length) {
      const bonus = 15 + 5 * s.wave;
      earn(s, 'bonuses', bonus);
      ev(s, 'waveClear', { wave: s.wave, bonus });
      if (s.wave >= s.waves.length - 1) {
        s.phase = 'done';
        s.result = 'win';
        ev(s, 'win', {});
      } else {
        s.phase = 'break';
        s.breakT = s.D.breakT;
      }
    }
  }
  function step(s, dt) {
    s.acc += dt;
    while (s.acc >= STEP - 1e-9 && !s.result) {
      s.acc -= STEP;
      tick(s);
    }
    if (s.result) s.acc = 0;
  }

  // Stars: 3 with every snack left, 2 with most of them, 1 for any win.
  const stars = (s) => (s.result !== 'win' ? 0 : s.snacks >= s.snacksMax ? 3 : s.snacks >= s.snacksMax * 0.6 ? 2 : 1);
  const score = (s) => s.floated * 10 + s.snacks * 25 + (s.result === 'win' ? 100 : 0);

  GD.Sim = {
    STEP, parseMap, findPath, polyline, pointAt, parseWave, spawnList,
    create, step, tick, canBuild, build, upgrade, upgradeCost, sell, refundOf, towerAt, towerById, critterById,
    callWave, startWave, spawn, posOf, soak, balloon, busiestRoute, treat, stats, stars, score, earn, spend,
  };
})();
