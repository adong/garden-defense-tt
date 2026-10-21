/* TT Garden Defense: the headless rules check. Runs in node (tools/check.js) and in the page (game.check()).
     1. every level is winnable by the autopilot on EASY (a quick, a slow and a very slow thinker), and lost by nobody
     2. towers never go on the path (or on trees, rocks, ponds and flower beds)
     3. path-finding: every gate has a shortest route to the picnic along the path, every path cell is used, critters stay on it
     4. waves end: every wave starts, sends all its critters and finishes in good time, even with no towers at all
     5. coins balance: coins = start + earned + refunds - spent, after every step of every game, and never below 0
     6. the companion's giant water balloon clears exactly one lane
   check({ fail: true }) breaks each rule on purpose (an autopilot that never builds, towers allowed on the path, a gap in
   a path, mice that never move, refunds paid off the books, a balloon that misses) and every check must then FAIL.
   Exposes GD.check. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});
  const Sim = GD.Sim, Bot = GD.Bot, LEVELS = GD.LEVELS, CRITTERS = GD.CRITTERS;
  const DT = 1 / 60;

  function balanced(s) {
    const L = s.ledger;
    return s.coins === L.start + L.rewards + L.bonuses + L.treats + L.refunds - L.spent && s.coins >= 0;
  }

  // Play one level to the end. bot: { every } or null (nobody builds). Watches the coins and the critters every step.
  function play(i, o = {}) {
    const s = Sim.create(i, { easy: o.easy !== false, noLose: o.noLose });
    const bot = o.clumsy ? Bot.clumsy(s, o.clumsy) : o.bot ? Bot.create(s, o.bot) : null;
    const out = { s, coinsOk: true, offPath: 0, waveTimes: [], rewardSum: 0 };
    let waveStart = 0;
    const limit = o.limit || 1800;
    for (let n = 0; !s.result && s.t < limit; n++) {
      if (bot) bot.tick(DT);
      Sim.step(s, DT);
      for (const e of s.events) {
        if (e.type === 'waveStart') waveStart = e.t;
        else if (e.type === 'waveClear') out.waveTimes.push(e.t - waveStart);
        else if (e.type === 'coins' && e.kind === 'rewards') out.rewardSum += e.n;
      }
      s.events.length = 0;
      if (!balanced(s)) out.coinsOk = false;
      if (n % 30 === 0) {
        for (const c of s.critters) {
          if (c.d < s.map.lines[c.route].cum[1]) continue; // still walking in from outside the gate
          const p = Sim.posOf(s, c);
          if (!s.map.walkable(Math.floor(p.x), Math.floor(p.z))) out.offPath++;
        }
      }
    }
    if (out.rewardSum !== s.ledger.rewards) out.coinsOk = false;
    return out;
  }

  // ---------------------------------------------------------------- the checks
  function checkPaths(fail) {
    const bad = [];
    LEVELS.forEach((L, i) => {
      let rows = L.map;
      if (fail && i === 0) rows = rows.map((row, r) => (r === 4 ? row.replace('######', '###.##') : row)); // a gap
      const m = Sim.parseMap(rows);
      const name = `level ${L.id}`;
      if (m.w !== 14 || m.h !== 8) bad.push(`${name}: ${m.w}x${m.h}`);
      if (!m.basket || !m.gates.length) { bad.push(`${name}: needs gates and a picnic`); return; }
      for (const p of [m.basket, ...m.gates]) if (!m.outward(p)) bad.push(`${name}: ${p.c},${p.r} is not on the edge`);
      // distances from the picnic, worked out separately (flood fill), to prove the routes are the shortest
      const dist = new Map(), key = (c, r) => `${c},${r}`;
      const q = [m.basket];
      dist.set(key(m.basket.c, m.basket.r), 0);
      for (let qi = 0; qi < q.length; qi++) {
        const p = q[qi];
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = p.c + dc, r = p.r + dr;
          if (!m.walkable(c, r) || dist.has(key(c, r))) continue;
          dist.set(key(c, r), dist.get(key(p.c, p.r)) + 1);
          q.push({ c, r });
        }
      }
      const used = new Set();
      m.routes.forEach((route, g) => {
        if (!route) { bad.push(`${name}: gate ${g} can't reach the picnic`); return; }
        const a = route[0], z = route[route.length - 1];
        if (a.c !== m.gates[g].c || a.r !== m.gates[g].r) bad.push(`${name}: route ${g} doesn't start at its gate`);
        if (z.c !== m.basket.c || z.r !== m.basket.r) bad.push(`${name}: route ${g} doesn't end at the picnic`);
        if (route.length - 1 !== dist.get(key(a.c, a.r))) bad.push(`${name}: route ${g} is not the shortest`);
        route.forEach((p, k) => {
          if (!m.walkable(p.c, p.r)) bad.push(`${name}: route ${g} leaves the path at ${p.c},${p.r}`);
          if (used.has(key(p.c, p.r) + '/' + g)) bad.push(`${name}: route ${g} visits ${p.c},${p.r} twice`);
          used.add(key(p.c, p.r) + '/' + g);
          used.add(key(p.c, p.r));
          if (k && Math.abs(p.c - route[k - 1].c) + Math.abs(p.r - route[k - 1].r) !== 1) bad.push(`${name}: route ${g} jumps at ${p.c},${p.r}`);
        });
      });
      for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) {
        if (m.walkable(c, r) && !used.has(key(c, r))) bad.push(`${name}: path cell ${c},${r} is on no route (dead end or shortcut)`);
      }
    });
    return bad;
  }

  function checkBuild(fail) {
    const bad = [];
    LEVELS.forEach((L, i) => {
      const s = Sim.create(i, { easy: true });
      if (fail) { const real = s.map.buildable; s.map.buildable = (c, r) => real(c, r) || s.map.at(c, r) === '#'; }
      s.coins = s.ledger.start = 100000;
      for (let r = 0; r < s.map.h; r++) for (let c = 0; c < s.map.w; c++) {
        const ch = L.map[r][c];
        const before = s.coins;
        const t = Sim.build(s, 'squirt', c, r);
        if (ch !== '.' && t) bad.push(`level ${L.id}: a tower went on '${ch}' at ${c},${r}`);
        if (ch !== '.' && s.coins !== before) bad.push(`level ${L.id}: coins went on a tower that wasn't built`);
        if (ch === '.' && !t) bad.push(`level ${L.id}: couldn't build on grass at ${c},${r}`);
        if (ch === '.' && Sim.build(s, 'bubble', c, r)) bad.push(`level ${L.id}: two towers on ${c},${r}`);
      }
    });
    return bad;
  }

  function checkWin(fail, quick) {
    const bad = [], info = [];
    const thinkers = quick ? [0.3] : [0.3, 1.0, 2.5];
    LEVELS.forEach((L, i) => {
      for (const every of thinkers) {
        const r = play(i, { easy: true, bot: fail ? { every, types: [] } : { every } });
        const s = r.s;
        if (s.result !== 'win') bad.push(`level ${L.id} EASY (autopilot thinks every ${every}s): ${s.result || 'never ended'}, wave ${s.wave + 1}/${s.waves.length}`);
        for (const t of s.towers) if (L.map[t.r][t.c] !== '.') bad.push(`level ${L.id}: autopilot tower on '${L.map[t.r][t.c]}'`);
        if (!r.coinsOk) bad.push(`level ${L.id}: coins out of balance in an autopilot game (thinks every ${every}s)`);
        if (r.offPath) bad.push(`level ${L.id}: critters seen off the path ${r.offPath} times (thinks every ${every}s)`);
        if (every === 0.3) info.push(`level ${L.id} EASY ${s.result} ${s.snacks}/${s.snacksMax} snacks, ${Sim.stars(s)} stars, ${s.towers.length} towers, ${Math.round(s.t)}s`);
      }
      if (!quick && !fail) {
        const n = play(i, { easy: false, bot: { every: 0.3 } }).s;
        info.push(`level ${L.id} NORMAL ${n.result} ${n.snacks}/${n.snacksMax} snacks, ${Sim.stars(n)} stars`);
        let wins = 0, nwins = 0;
        for (let seed = 1; seed <= 8; seed++) {
          if (play(i, { easy: true, clumsy: seed }).s.result === 'win') wins++;
          if (play(i, { easy: false, clumsy: seed }).s.result === 'win') nwins++;
        }
        info.push(`level ${L.id} a clumsy random player wins ${wins}/8 on EASY, ${nwins}/8 on NORMAL`);
        const idle = play(i, { easy: true }).s;
        if (idle.result === 'win') bad.push(`level ${L.id}: won on EASY without building anything (too easy)`);
      }
    });
    return { bad, info };
  }

  function checkWaves(fail) {
    const bad = [];
    const mouse = CRITTERS.mouse.speed;
    if (fail) CRITTERS.mouse.speed = 0;
    try {
      LEVELS.forEach((L, i) => {
        const s0 = Sim.create(i, { easy: true });
        const longest = Math.max(...s0.map.lines.map((l) => l.len));
        const slowest = Math.min(...Object.values(CRITTERS).map((C) => C.speed)) * s0.speedMul;
        const lastSpawn = s0.waves.map((w) => Math.max(...Sim.spawnList(w, s0.map.gates.length).map((q) => q.at)));
        const r = play(i, { easy: true, noLose: true, limit: 3000 });
        if (r.s.result !== 'win') bad.push(`level ${L.id}: waves never finished (stuck at wave ${r.s.wave + 1}/${r.s.waves.length})`);
        r.waveTimes.forEach((t, w) => {
          const bound = lastSpawn[w] + longest / slowest + 2;
          if (t > bound) bad.push(`level ${L.id} wave ${w + 1}: took ${t.toFixed(1)}s, more than ${bound.toFixed(1)}s`);
        });
        if (r.waveTimes.length !== L.waves.length && r.s.result === 'win') bad.push(`level ${L.id}: ${r.waveTimes.length} of ${L.waves.length} waves ended`);
      });
    } finally {
      CRITTERS.mouse.speed = mouse;
    }
    return bad;
  }

  function checkCoins(fail) {
    const bad = [];
    const s = Sim.create(0, { easy: true });
    // the sabotage: packing up pays the coins twice, once off the books
    const sell = (id) => { const n = Sim.sell(s, id); if (fail) s.coins += n; return n; };
    const start = s.coins;
    const t1 = Sim.build(s, 'squirt', 2, 2);
    const t2 = Sim.build(s, 'bubble', 3, 2);
    if (!t1 || !t2) return ['scripted: could not build on grass'];
    if (s.coins !== start - 50 - 70) bad.push(`scripted: building cost ${start - s.coins}, not 120`);
    Sim.earn(s, 'rewards', 100);
    if (!Sim.upgrade(s, t1.id)) bad.push('scripted: upgrade failed');
    const poor = Sim.create(0, { easy: true });
    poor.coins = poor.ledger.start = 10;
    if (Sim.build(poor, 'cookie', 2, 2) || poor.coins !== 10) bad.push('scripted: built without enough coins');
    // packing up right away gives everything back (oops!); later, 70 %
    if (sell(t2.id) !== 70) bad.push('scripted: undo did not give all 70 back');
    for (let k = 0; k < 600; k++) Sim.tick(s);
    const back = sell(t1.id), want = Math.floor(90 * GD.TUNE.refund);
    if (back !== want) bad.push(`scripted: a late pack-up gave ${back}, not ${want}`);
    Sim.treat(s, 10);
    if (!balanced(s)) bad.push(`scripted: ${s.coins} coins but the ledger says ${JSON.stringify(s.ledger)}`);
    // a whole autopilot game on NORMAL, checked after every step inside play()
    if (!play(2, { easy: false, bot: { every: 0.5 } }).coinsOk) bad.push('level 3 NORMAL autopilot game: coins out of balance');
    return bad;
  }

  function checkBalloon(fail) {
    const bad = [];
    const i = LEVELS.findIndex((L) => L.map.join('').split('S').length - 1 >= 2);
    const s = Sim.create(i, { easy: true });
    const a = [], b = [];
    for (let k = 0; k < 5; k++) {
      a.push(Sim.spawn(s, 'mouse', 0));
      b.push(Sim.spawn(s, 'mouse', 1));
    }
    const boss = Sim.spawn(s, 'boss', 0);
    for (const c of [...a, ...b, boss]) c.d = 2 + (c.id % 5) * 0.7;
    Sim.balloon(s, fail ? 1 : 0);
    const alive = (list) => list.filter((c) => s.critters.includes(c)).length;
    if (alive(a)) bad.push(`${alive(a)} critters left in the soaked lane`);
    if (alive(b) !== b.length) bad.push('the balloon soaked the other lane too');
    if (!s.critters.includes(boss) || Math.abs(boss.soak - boss.hp * GD.TUNE.balloonBoss) > 1e-6) bad.push('the boss should be half soaked, not floated');
    if (!balanced(s)) bad.push('balloon coins out of balance');
    return bad;
  }

  function check(opts = {}) {
    const fail = !!opts.fail, quick = !!opts.quick;
    const res = [];
    const add = (name, bad, info) => res.push({ name, ok: !bad.length, bad: bad.slice(0, 12), more: Math.max(0, bad.length - 12), info: info || [] });
    const w = checkWin(fail, quick);
    add('every level is winnable by the autopilot on EASY', w.bad, w.info);
    add('towers never go on the path', checkBuild(fail));
    add('path-finding', checkPaths(fail));
    add('waves end', checkWaves(fail));
    add('coins balance', checkCoins(fail));
    add('the giant water balloon clears one lane', checkBalloon(fail));
    return { ok: res.every((r) => r.ok), fail, results: res };
  }

  GD.check = check;
  GD.checkPlay = play;
})();
