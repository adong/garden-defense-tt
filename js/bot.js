/* TT Garden Defense: the autopilot. It plays the title-screen demo, proves every level can be won on EASY
   (tools/check.js), and finds the sparkly "build here!" tile that EASY shows Tommy.
   It only uses the moves a player has: build, upgrade, wait. It never calls the companion.
   Exposes GD.Bot. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});
  const Sim = GD.Sim, TOWERS = GD.TOWERS;

  // how much soaking a tower does per second, roughly, counting splash and sprays as a few critters
  const MULT = { squirt: 1, bubble: 1.7, jelly: 0, cookie: 1.9, sprinkler: 1.7 };
  const dps = (type, lvl) => {
    const st = TOWERS[type].lv[lvl - 1];
    return (st.soak / st.rate) * MULT[type];
  };

  // A tower can only soak so fast, however much path it reaches: past about 6 cells of path, more reach hardly helps.
  const CAP = 24;
  const reach = (n) => Math.min(n, CAP) + Math.max(0, n - CAP) * 0.15;

  // For every buildable cell and tower type: how much of the path it can reach (route points every 1/4 cell).
  function coverage(s) {
    if (s.map.cover) return s.map.cover;
    const samples = [];
    for (const line of s.map.lines) {
      if (!line) continue;
      for (let d = 0.5; d < line.len; d += 0.25) samples.push(Sim.pointAt(line, d));
    }
    const out = new Map();
    for (let r = 0; r < s.map.h; r++) {
      for (let c = 0; c < s.map.w; c++) {
        if (!s.map.buildable(c, r)) continue;
        const o = {};
        for (const type in TOWERS) {
          o[type] = TOWERS[type].lv.map((st) => {
            let n = 0;
            for (const p of samples) if (Math.hypot(p.x - c - 0.5, p.z - r - 0.5) <= st.range) n++;
            return reach(n);
          });
        }
        out.set(r * s.map.w + c, o);
      }
    }
    s.map.cover = out;
    return out;
  }

  // The best next move and what it costs: { kind: 'build', type, c, r, cost } or { kind: 'upgrade', id, cost }.
  function plan(s, opts = {}) {
    const cover = coverage(s);
    const types = opts.types || GD.TOWER_ORDER;
    const count = {};
    for (const t of s.towers) count[t.type] = (count[t.type] || 0) + 1;
    let best = null, bv = 0;
    const offer = (v, move) => { if (v > bv) { bv = v; best = move; } };
    const jellyWanted = s.towers.length >= 3 && (count.jelly || 0) < s.map.gates.length && types.includes('jelly');
    for (const [key, o] of cover) {
      const c = key % s.map.w, r = Math.floor(key / s.map.w);
      if (!Sim.canBuild(s, c, r)) continue;
      for (const type of types) {
        const cov = o[type][0];
        if (cov < 3) continue;
        const cost = TOWERS[type].cost;
        let v = type === 'jelly' ? (jellyWanted ? 6 * cov : 0) : dps(type, 1) * cov;
        if (!count[type]) v *= 1.15; // a bit of variety
        offer(v / cost, { kind: 'build', type, c, r, cost });
      }
    }
    for (const t of s.towers) {
      const cost = Sim.upgradeCost(t);
      if (cost === null) continue;
      const o = cover.get(t.r * s.map.w + t.c);
      const gain = t.type === 'jelly' ? 3 * o.jelly[t.lvl] : dps(t.type, t.lvl + 1) * o[t.type][t.lvl] - dps(t.type, t.lvl) * o[t.type][t.lvl - 1];
      offer((gain / cost) * 1.1, { kind: 'upgrade', id: t.id, cost });
    }
    return best;
  }

  function act(s, move) {
    if (!move || s.coins < move.cost) return false;
    if (move.kind === 'build') return !!Sim.build(s, move.type, move.c, move.r, 'bot');
    return Sim.upgrade(s, move.id);
  }

  // A player who thinks every `every` seconds.
  function create(s, opts = {}) {
    const every = opts.every || 0.3;
    let wait = 0;
    return {
      tick(dt) {
        wait -= dt;
        if (wait > 0 || s.result) return;
        wait = every;
        for (let i = 0; i < 4; i++) if (!act(s, plan(s, opts))) break;
      },
    };
  }

  // A clumsy player, like a 5-year-old: random towers on random grass next to the path, whenever he has the coins,
  // and now and then an upgrade. tools/check.js uses it to see that EASY forgives a lot.
  function clumsy(s, seed = 1) {
    let x = seed * 2654435761 >>> 0;
    const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
    const spots = [];
    for (let r = 0; r < s.map.h; r++) for (let c = 0; c < s.map.w; c++) {
      if (!s.map.buildable(c, r)) continue;
      let near = false;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ('#SB'.includes(s.map.at(c + dc, r + dr))) near = true;
      if (near) spots.push({ c, r });
    }
    let wait = 1 + rnd() * 3, want = null;
    return {
      tick(dt) {
        wait -= dt;
        if (wait > 0 || s.result) return;
        wait = 1.5 + rnd() * 3;
        if (!want) {
          if (s.towers.length >= 3 && rnd() < 0.3) {
            const t = s.towers[Math.floor(rnd() * s.towers.length)];
            if (Sim.upgradeCost(t) !== null) want = { kind: 'upgrade', id: t.id, cost: Sim.upgradeCost(t) };
          } else {
            const free = spots.filter((p) => Sim.canBuild(s, p.c, p.r));
            const p = free[Math.floor(rnd() * free.length)];
            const type = GD.TOWER_ORDER[Math.floor(rnd() * GD.TOWER_ORDER.length)];
            if (p) want = { kind: 'build', type, c: p.c, r: p.r, cost: TOWERS[type].cost };
          }
        }
        if (want && s.coins >= want.cost) { act(s, want); want = null; }
      },
    };
  }

  GD.Bot = { create, clumsy, plan, act, coverage, dps };
})();
