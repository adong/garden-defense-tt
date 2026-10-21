/* TT Garden Defense: the game itself. Screens (title, gardens, pause, results), the HUD and the build menus, input
   (mouse, touch, two keyboard players), saving, the companion and the high five, and the main loop that steps the sim
   and draws the view. window.game has test hooks for the browser console (see README). */
(function () {
  'use strict';
  const GD = window.GD, Sim = GD.Sim, Bot = GD.Bot, sfx = GD.sfx;
  const $ = (id) => document.getElementById(id);
  const TITLE = window.GD_TITLE || 'TT Garden Defense';
  const KEY = 'gardenDefenseTT.v1';
  const LEVELS = GD.LEVELS, TOWERS = GD.TOWERS, ORDER = GD.TOWER_ORDER, CRITTERS = GD.CRITTERS;
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const HELPER_LINES = ['SPLASH TIME!', 'GIANT WATER BALLOON!', 'HERE COMES A BIG ONE!'];
  const COLORS = ['#5ab0ff', '#ffb02e'];
  const roster = Kit.roster;

  // ---------------------------------------------------------------- saved progress (per player: teddy, tommy, both)
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  const saved = load();
  const save = {
    who: ['teddy', 'tommy', 'both'].includes(saved.who) ? saved.who : 'teddy',
    easy: Object.assign({ teddy: true, tommy: true, both: true }, saved.easy),
    stars: Object.assign({ teddy: {}, tommy: {}, both: {} }, saved.stars),
    best: Object.assign({ teddy: {}, tommy: {}, both: {} }, saved.best),
  };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage blocked: progress lasts this visit */ }
  }
  let allOpen = /[?#&]all\b/.test(location.search + location.hash);
  function unlockedUpTo(who) {
    if (allOpen) return LEVELS.length - 1;
    let u = 0;
    while (u + 1 < LEVELS.length && (save.stars[who][LEVELS[u].id] || 0) >= 1) u++;
    return u;
  }

  // ---------------------------------------------------------------- set-up
  const view = GD.View($('view'));
  const pics = Kit.portraits([Object.assign({}, roster.get('teddy'), { pose: 'guard' }), roster.get('tommy')], { size: 220 });
  const faces = Kit.portraits([{ id: 'teddy', look: roster.get('teddy').look }, { id: 'tommy', look: roster.get('tommy').look }], { size: 160 });
  const icons = view.icons([...ORDER.map((t) => ['tower', t]), ...Object.keys(CRITTERS).map((c) => ['critter', c])]);
  const iconOf = (type) => icons[type] || '';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  document.title = `${TITLE} · Teddy & Tommy`;
  $('logo').innerHTML = esc(TITLE).replace(/^TT\b/, '<em>TT</em>');
  for (const el of document.querySelectorAll('.pick.teddy img, .pick.both img:first-child')) el.src = pics.teddy;
  for (const el of document.querySelectorAll('.pick.tommy img, .pick.both img:last-child')) el.src = pics.tommy;

  const G = {
    state: 'boot', sim: null, idx: 0, who: save.who, players: 1, easy: true, fast: false,
    menus: [null, null], cursors: [null, null], lastInput: ['mouse', 'keys'], hover: null,
    visit: null, treatT: -99, fiveT: -99, demo: null, demoBot: null, bot: null, autoplay: false,
    held: false, keepAwake: false, endT: 0, resultShown: false, hintT: 0, hint: null, stealT: -99, levelFocus: 0,
  };
  const heroIds = () => (G.who === 'both' ? ['teddy', 'tommy'] : [G.who]);

  // ---------------------------------------------------------------- sound
  let soundOn = false;
  function initSound() {
    if (soundOn) return Kit.sound.resume();
    soundOn = true;
    Kit.sound.init();
    Kit.sound.music(G.state === 'play' ? 'play' : G.state === 'paused' ? 'pause' : 'title');
    muteIcon();
  }
  const muteIcon = () => ($('btnMute').textContent = Kit.sound.isMuted() ? '🔇' : '🔊');
  function toggleMute() {
    initSound();
    Kit.sound.toggleMute();
    muteIcon();
  }
  Kit.sound.onMute(muteIcon);

  // ---------------------------------------------------------------- screens
  const SCREENS = ['title', 'levels', 'pause', 'result'];
  function showScreen(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(G.state === 'play' || G.state === 'paused' || G.state === 'won' || G.state === 'lost'));
    layout();
  }
  // the free part of the screen, for the camera: below the top bar, right of the kit's round buttons
  function layout() {
    const hudOn = !$('hud').classList.contains('hidden');
    const bar = hudOn ? $('topbar').getBoundingClientRect().bottom : 0;
    document.documentElement.style.setProperty('--bar', Math.round(bar || 58) + 'px');
    const nextH = hudOn && $('next').textContent ? 34 : 0;
    view.setSafe({ left: 58, top: bar + 6 + nextH, right: 10, bottom: 10 });
  }

  function toTitle() {
    closeMenus();
    endVisit(true);
    G.state = 'title';
    G.sim = null;
    showScreen('title');
    pickWho(G.who);
    Kit.sound.music('title');
    startDemo();
  }
  function startDemo() {
    sfx.quiet = true;
    G.demo = Sim.create(0, { easy: true, noLose: true });
    G.demo.D = Object.assign({}, G.demo.D, { breakT: 3 });
    G.demo.breakT = 2;
    G.demoBot = Bot.create(G.demo, { every: 1.2 });
    view.build(LEVELS[0], G.demo, { heroes: heroIds() });
  }
  function pickWho(who) {
    G.who = save.who = who;
    persist();
    for (const el of document.querySelectorAll('.pick')) el.classList.toggle('on', el.dataset.who === who);
    const easy = save.easy[who];
    $('btnEasy').classList.toggle('on', easy);
    $('btnNormal').classList.toggle('on', !easy);
    if (who === 'both') {
      $('titleBuddy').src = faces.tommy;
      $('titleBuddyText').textContent = 'Teddy and Tommy save the picnic together! Press T for a high five!';
    } else {
      const b = roster.buddyFor(who);
      $('titleBuddy').src = faces[b];
      $('titleBuddyText').textContent = `Your buddy ${NAMES[b]} comes when you call him!`;
    }
    if (G.state === 'title' && G.demo) view.build(LEVELS[0], G.demo, { heroes: heroIds() });
  }
  function setEasy(on) {
    save.easy[G.who] = on;
    persist();
    pickWho(G.who);
  }

  function toLevels() {
    closeMenus();
    endVisit(true);
    G.state = 'levels';
    showScreen('levels');
    buildLevels();
    if (!G.demo) startDemo();
  }
  function buildLevels() {
    const box = $('worlds');
    box.innerHTML = '';
    const up = unlockedUpTo(G.who);
    G.levelFocus = Math.min(up, LEVELS.length - 1);
    GD.WORLDS.forEach((w, wi) => {
      const row = document.createElement('div');
      row.className = 'world ' + w.id;
      row.innerHTML = `<h3><b>${w.icon}</b>${esc(w.name)}</h3>`;
      LEVELS.forEach((L, i) => {
        if (L.world !== wi) return;
        const b = document.createElement('button');
        const st = save.stars[G.who][L.id] || 0;
        b.className = 'lvl' + (i > up ? ' locked' : '') + (i === up && !st ? ' next' : '');
        b.dataset.i = i;
        const boss = L.waves.some((wv) => /\bboss\b/.test(wv));
        b.innerHTML = `${boss ? `<img class="boss" src="${iconOf('boss')}" alt="">` : ''}<b>${L.id}</b><small>${esc(L.name)}</small>` +
          `<span class="st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span>`;
        b.addEventListener('click', () => {
          initSound();
          if (i > up) { sfx.nope(); return; }
          sfx.select();
          startLevel(i);
        });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    focusLevel(G.levelFocus);
  }
  function focusLevel(i) {
    G.levelFocus = Math.max(0, Math.min(LEVELS.length - 1, i));
    for (const b of document.querySelectorAll('.lvl')) b.classList.toggle('focus', +b.dataset.i === G.levelFocus);
  }

  // ---------------------------------------------------------------- playing a level
  function startLevel(i, opts = {}) {
    closeMenus();
    endVisit(true);
    sfx.quiet = false;
    G.demo = null;
    G.idx = i;
    G.players = G.who === 'both' ? 2 : 1;
    G.easy = opts.easy !== undefined ? opts.easy : save.easy[G.who];
    G.sim = Sim.create(i, { easy: G.easy, players: G.players });
    G.bot = G.autoplay ? Bot.create(G.sim, { every: 0.3 }) : null;
    G.fast = false;
    G.endT = 0;
    G.resultShown = false;
    G.hint = null;
    G.treatT = G.fiveT = -99;
    view.build(LEVELS[i], G.sim, { heroes: heroIds() });
    G.state = 'play';
    showScreen(null);
    // keyboard cursors start near the middle of the garden
    const m = G.sim.map;
    G.cursors = [{ c: Math.floor(m.w / 2) - 2, r: Math.floor(m.h / 2) }, { c: Math.floor(m.w / 2) + 1, r: Math.floor(m.h / 2) }];
    G.hover = null;
    setupBuddyButton();
    const L = LEVELS[i];
    banner(`${Kit.lang.t('GARDEN')} ${L.id}`, L.name);
    setTimeout(() => { if (G.sim && G.sim.level === L && G.state === 'play') toast(L.tip, 'tip', 4.5); }, 1200);
    Kit.sound.music('play');
    hud(true);
  }
  function setupBuddyButton() {
    if (G.players === 2) {
      $('buddyImg').src = faces.teddy;
      $('buddyImg2').src = faces.tommy;
      $('buddyImg2').classList.remove('hidden');
      $('buddyName').textContent = '✋ HIGH FIVE!';
      $('buddyBtn').title = 'High five (T)';
    } else {
      const b = roster.buddyFor(G.who);
      $('buddyImg').src = faces[b];
      $('buddyImg2').classList.add('hidden');
      $('buddyName').textContent = NAMES[b] + '!';
      $('buddyBtn').title = 'Call your brother (T)';
    }
  }

  function pause() {
    if (G.state !== 'play') return;
    closeMenus();
    G.state = 'paused';
    $('pauseInfo').textContent = `${Kit.lang.t('GARDEN')} ${LEVELS[G.idx].id} · ${Kit.lang.t(G.easy ? '🐣 EASY' : '🔥 NORMAL')}`;
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'play';
    showScreen(null);
    Kit.sound.music('play');
  }

  function onEnd() {
    const s = G.sim;
    closeMenus();
    endVisit(false);
    view.setHint(null);
    G.endT = 0;
    if (s.result === 'win') {
      G.state = 'won';
      view.startCelebrate(true);
      sfx.win();
      const who = G.players === 2 ? 'TEDDY & TOMMY' : NAMES[G.who];
      banner('GARDEN SAVED!', `${who}!`);
      const st = Sim.stars(s), sc = Sim.score(s), id = LEVELS[G.idx].id;
      G.result = { win: true, stars: st, score: sc, newBest: sc > (save.best[G.who][id] || 0) };
      save.stars[G.who][id] = Math.max(save.stars[G.who][id] || 0, st);
      save.best[G.who][id] = Math.max(save.best[G.who][id] || 0, sc);
      persist();
    } else {
      G.state = 'lost';
      view.startCelebrate(false);
      sfx.lose();
      banner('OH NO, THE SNACKS!', '');
      G.result = { win: false, stars: 0, score: Sim.score(s), newBest: false };
    }
    Kit.sound.music('over');
    showScreen(null);
  }
  function showResult() {
    const s = G.sim, r = G.result, L = LEVELS[G.idx];
    G.resultShown = true;
    G.state = 'result';
    $('banner').innerHTML = '';
    const who = G.players === 2 ? 'TEDDY & TOMMY' : NAMES[G.who];
    if (r.win) {
      $('resTitle').textContent = 'GARDEN SAVED!';
      $('resStars').innerHTML = '⭐'.repeat(r.stars) + `<i>${'⭐'.repeat(3 - r.stars)}</i>`;
      $('resText').textContent = `${who} floated ${s.floated} critters away and kept ${s.snacks} of ${s.snacksMax} snacks!`;
    } else {
      $('resTitle').textContent = 'THE CRITTERS GOT THE SNACKS!';
      $('resStars').innerHTML = '<i>⭐⭐⭐</i>';
      $('resText').textContent = `${who} floated ${s.floated} critters away. Try again!`;
    }
    const best = save.best[G.who][L.id] || 0;
    $('resScore').innerHTML = `${esc(Kit.lang.t('SCORE'))} ${r.score} · ${esc(Kit.lang.t('BEST'))} ${Math.max(best, r.score)}` + (r.newBest ? ` <span class="newbest">${esc(Kit.lang.t('NEW BEST!'))}</span>` : '');
    $('btnNext').classList.toggle('hidden', !r.win || G.idx + 1 >= LEVELS.length);
    $('btnTryEasy').classList.toggle('hidden', r.win || G.easy);
    $('btnAgain').textContent = '↻ PLAY AGAIN';
    showScreen('result');
  }

  // ---------------------------------------------------------------- HUD
  let lastHud = {};
  function hud(force) {
    const s = G.sim;
    if (!s) return;
    const goVisible = s.phase === 'build' || s.phase === 'break';
    const nextW = s.waves[s.wave + 1];
    const boss = !!nextW && nextW.some((g) => CRITTERS[g.type].boss);
    const v = {
      coins: s.coins, snacks: `${s.snacks}`, wave: `${Math.max(1, s.wave + 1)}/${s.waves.length}`,
      go: goVisible, goT: goVisible ? Math.max(0, Math.ceil(s.breakT)) : 0, boss, fast: G.fast,
      next: goVisible && nextW ? nextW.map((g) => `${g.type}:${g.n}`).join(',') : '', visit: !!G.visit,
    };
    if (force || v.coins !== lastHud.coins) $('coinsN').textContent = v.coins;
    if (force || v.snacks !== lastHud.snacks) $('snacksN').textContent = v.snacks;
    if (force || v.wave !== lastHud.wave) $('waveN').textContent = v.wave;
    if (force || v.go !== lastHud.go) $('btnGo').classList.toggle('hidden', !v.go);
    if (force || v.goT !== lastHud.goT) $('goT').textContent = v.goT;
    if (force || v.boss !== lastHud.boss) { $('btnGo').classList.toggle('boss', v.boss); $('goLabel').textContent = v.boss ? '▶ BOSS!' : '▶ GO!'; }
    $('btnGo').classList.toggle('nudge', v.go && s.wave < 0 && s.breakT < s.D.firstBreak - 8);
    if (force || v.fast !== lastHud.fast) $('btnFast').classList.toggle('on', v.fast);
    if (force || v.visit !== lastHud.visit) $('buddyBtn').classList.toggle('here', v.visit);
    if (force || v.next !== lastHud.next) {
      const merged = {};
      if (nextW && v.next) for (const g of nextW) merged[g.type] = (merged[g.type] || 0) + g.n;
      $('next').innerHTML = v.next ? `<span>${esc(Kit.lang.t('NEXT WAVE:'))}</span>` +
        Object.entries(merged).map(([t, n]) => `<img src="${iconOf(t)}" alt="">×${n}`).join(' ') : '';
      layout();
    }
    const cheapest = Math.min(...ORDER.map((t) => TOWERS[t].cost));
    $('coinsBox').classList.toggle('poor', s.coins < cheapest);
    lastHud = v;
    for (const m of G.menus) if (m) refreshMenu(m);
  }
  function pulse(id, cls = 'pulse') {
    const el = $(id);
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // toasts and banners
  function toast(text, cls = '', life = 2.2) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    const box = $(cls === 'tip' ? 'tipbox' : 'toasts');
    if (cls === 'tip') box.innerHTML = '';
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), life * 1000);
  }
  let bannerTimer = 0;
  function banner(big, small, cls = '') {
    const el = $('banner');
    el.className = cls;
    el.innerHTML = `${esc(Kit.lang.t(big))}${small ? `<small>${esc(Kit.lang.t(small))}</small>` : ''}`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.innerHTML = ''; }, 1800);
  }

  function uiEvents(evs) {
    const s = G.sim;
    for (const e of evs) {
      switch (e.type) {
        case 'waveStart':
          if (e.boss) banner('BANDIT BOSS!', `${Kit.lang.t('WAVE')} ${e.wave + 1}`, 'boss');
          else banner(`${Kit.lang.t('WAVE')} ${e.wave + 1}`, e.wave === e.of - 1 ? 'LAST WAVE!' : '');
          sfx.wave(e.boss);
          break;
        case 'waveClear':
          if (e.wave < s.waves.length - 1) toast(`WAVE ${e.wave + 1} DONE! +${e.bonus} 🪙`, 'gold', 2);
          sfx.waveClear();
          break;
        case 'coins':
          pulse('coinsBox');
          break;
        case 'steal':
          pulse('snacksBox', 'shake');
          if (s.t - G.stealT > 6) { toast('Oh no! A critter took a snack!', 'warn', 1.8); G.stealT = s.t; }
          break;
      }
    }
  }

  // ---------------------------------------------------------------- build menus
  const cellOk = (cell) => cell && G.sim && Sim.canBuild(G.sim, cell.c, cell.r);
  const towerAtCell = (cell) => cell && G.sim && Sim.towerAt(G.sim, cell.c, cell.r);
  function openMenu(p, cell) {
    const s = G.sim;
    if (!s || G.state !== 'play') return;
    closeMenu(p);
    const t = towerAtCell(cell);
    const el = $('menu' + p);
    const m = { p, cell, el, items: [], focus: 0, tower: t ? t.id : null, sig: '' };
    G.menus[p] = m;
    el.innerHTML = '';
    if (G.players === 2) el.insertAdjacentHTML('beforeend', `<span class="tag" data-no-lang>${p ? 'TOMMY' : 'TEDDY'}</span>`);
    const head = document.createElement('div');
    head.className = 'head';
    el.appendChild(head);
    const row = document.createElement('div');
    row.className = 'items';
    el.appendChild(row);
    m.head = head;
    const add = (html, act, info, cls = '') => {
      const b = document.createElement('button');
      b.className = 'mi ' + cls;
      b.innerHTML = html;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initSound(); m.focus = m.items.indexOf(item); act(); });
      b.addEventListener('pointerenter', () => { m.focus = m.items.indexOf(item); refreshMenu(m, true); });
      const item = { el: b, act, info };
      m.items.push(item);
      row.appendChild(b);
      return item;
    };
    if (t) {
      const T0 = TOWERS[t.type];
      add(`<span class="big">⬆</span><span class="cost" data-k="up"></span>`, () => doUpgrade(p), () => upInfo(t), 'up');
      add(`<span class="big">🧺</span><span class="cost" data-k="sell"></span>`, () => doSell(p), () => [T0.name, `${Kit.lang.t('Pack it up and get coins back.')}`]);
      add(`<span class="big">✕</span>`, () => closeMenu(p), () => [T0.name, ''], 'close');
    } else {
      ORDER.forEach((type, i) => {
        const T0 = TOWERS[type];
        add(`<span class="num">${p === 0 ? i + 1 : ''}</span><img src="${iconOf(type)}" alt=""><span class="cost">🪙${T0.cost}</span>`,
          () => doBuild(p, type), () => [T0.name, T0.tip], 'b-' + type);
      });
      add(`<span class="big">✕</span>`, () => closeMenu(p), () => ['', ''], 'close');
      // start on the tower the sparkle suggests, or the first one he can pay for
      const hintI = G.hint && G.hint.kind === 'build' && G.hint.c === cell.c && G.hint.r === cell.r ? ORDER.indexOf(G.hint.type) : -1;
      m.focus = hintI >= 0 ? hintI : Math.max(0, ORDER.findIndex((ty) => TOWERS[ty].cost <= s.coins));
    }
    el.classList.remove('hidden');
    refreshMenu(m, true);
    placeMenu(m);
    sfx.select();
  }
  function upInfo(t) {
    const T0 = TOWERS[t.type];
    return [`${T0.name} ${'★'.repeat(t.lvl)}`, t.lvl < 3 ? Kit.lang.t('Upgrade: bigger, faster, wetter!') : Kit.lang.t('All the way up!')];
  }
  function refreshMenu(m, force) {
    const s = G.sim;
    if (!s) return;
    const t = m.tower ? Sim.towerById(s, m.tower) : null;
    if (m.tower && !t) { closeMenu(m.p); return; }
    const sig = `${s.coins}|${m.focus}|${t ? t.lvl : ''}|${Math.floor(s.t / 1)}|${G.hint ? G.hint.type : ''}|${Kit.lang.get()}`;
    if (!force && sig === m.sig) return;
    m.sig = sig;
    m.items.forEach((it, i) => it.el.classList.toggle('focus', i === m.focus));
    if (t) {
      const cost = Sim.upgradeCost(t);
      const upEl = m.el.querySelector('[data-k="up"]'), sellEl = m.el.querySelector('[data-k="sell"]');
      upEl.textContent = cost === null ? '★★★' : `🪙${cost}`;
      m.items[0].el.classList.toggle('poor', cost !== null && s.coins < cost);
      m.items[0].el.classList.toggle('off', cost === null);
      sellEl.textContent = `+${Sim.refundOf(s, t)}`;
      m.items[0].el.classList.toggle('hint', !!G.hint && G.hint.kind === 'upgrade' && G.hint.id === t.id);
      const st = Sim.stats(t);
      view.setRange(t.x, t.z, st.range);
    } else {
      ORDER.forEach((type, i) => {
        m.items[i].el.classList.toggle('poor', s.coins < TOWERS[type].cost);
        m.items[i].el.classList.toggle('hint', !!G.hint && G.hint.kind === 'build' && G.hint.type === type && G.hint.c === m.cell.c && G.hint.r === m.cell.r);
      });
      const type = ORDER[m.focus];
      if (type) view.setRange(m.cell.c + 0.5, m.cell.r + 0.5, TOWERS[type].lv[0].range);
      else view.setRange(null);
    }
    const [name, tip] = m.items[m.focus] ? m.items[m.focus].info() : ['', ''];
    m.head.innerHTML = name ? `<b>${esc(name)}</b>${esc(tip)}` : '&nbsp;';
  }
  function placeMenu(m) {
    const p = view.toScreen(m.cell.c + 0.5, m.cell.r + 0.5);
    const w = m.el.offsetWidth, h = m.el.offsetHeight;
    const top0 = $('topbar').getBoundingClientRect().bottom + 6;
    let x = p.x - w / 2, y = p.y - h - 34;
    if (y < top0) y = p.y + 34;
    if (y + h > window.innerHeight - 6) y = Math.max(top0, window.innerHeight - h - 6);
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    m.el.style.left = x + 'px';
    m.el.style.top = y + 'px';
  }
  function closeMenu(p) {
    const m = G.menus[p];
    if (!m) return;
    m.el.classList.add('hidden');
    G.menus[p] = null;
    if (!G.menus[0] && !G.menus[1]) view.setRange(null);
    else { const o = G.menus[1 - p]; if (o) refreshMenu(o, true); }
  }
  function closeMenus() { closeMenu(0); closeMenu(1); }
  const owner = (p) => (G.players === 2 ? (p ? 'tommy' : 'teddy') : G.who);
  function doBuild(p, type) {
    const m = G.menus[p], s = G.sim;
    if (!m || !s) return;
    if (s.coins < TOWERS[type].cost) {
      sfx.nope();
      toast(`${Kit.lang.t('Need')} 🪙${TOWERS[type].cost - s.coins} ${Kit.lang.t('more coins!')}`, 'warn', 1.4);
      return;
    }
    if (Sim.build(s, type, m.cell.c, m.cell.r, owner(p))) {
      closeMenu(p);
      G.hintT = 0;
    }
  }
  function doUpgrade(p) {
    const m = G.menus[p], s = G.sim;
    if (!m || !s) return;
    const t = Sim.towerById(s, m.tower);
    const cost = t && Sim.upgradeCost(t);
    if (cost === null || cost === undefined) { sfx.nope(); return; }
    if (s.coins < cost) { sfx.nope(); toast(`${Kit.lang.t('Need')} 🪙${cost - s.coins} ${Kit.lang.t('more coins!')}`, 'warn', 1.4); return; }
    Sim.upgrade(s, t.id);
    G.hintT = 0;
    refreshMenu(m, true);
  }
  function doSell(p) {
    const m = G.menus[p], s = G.sim;
    if (!m || !s) return;
    Sim.sell(s, m.tower);
    closeMenu(p);
  }
  // the action key or a tap on a cell: open the right menu, or close it if it's already open there
  function act(p, cell) {
    if (!cell || !G.sim) return;
    const m = G.menus[p];
    if (m && m.cell.c === cell.c && m.cell.r === cell.r) {
      const it = m.items[m.focus];
      if (it) it.act();
      return;
    }
    if (cellOk(cell) || towerAtCell(cell)) openMenu(p, cell);
    else {
      closeMenu(p);
      sfx.nope();
      const ch = G.sim.map.at(cell.c, cell.r);
      toast(Kit.lang.t('#SB'.includes(ch) ? 'Towers go on the grass, next to the path!' : 'No room here. Try the grass!'), 'warn', 1.5);
    }
  }

  // ---------------------------------------------------------------- the companion: the other brother pops in to help
  function callBuddy() {
    initSound();
    if (G.state !== 'play' || !G.sim) return;
    if (G.players === 2) return highFive();
    const s = G.sim;
    if (G.visit) {
      // already here: another treat right away, and another balloon after this one
      const v = G.visit;
      if (v.t > 4.2) { v.t = 2.0; v.leaving = false; }
      v.throws = Math.min(3, v.throws + 1);
      treat(true);
      return;
    }
    const who = roster.buddyFor(G.who);
    G.visit = { who, t: 0, throws: 1, treated: false, said: false, thrown: false, leaving: false };
    view.buddyArrive(who);
    view.buddyMode('signature');
    toast(`${NAMES[who]} ${Kit.lang.t('IS HERE!')}`, 'gold', 1.6);
    void s;
  }
  function treat(extra) {
    const s = G.sim, v = G.visit;
    if (!s || !v) return;
    const emoji = TREATS[Math.floor(Math.random() * TREATS.length)];
    const fly = view.tossTreat(emoji);
    setTimeout(() => {
      if (!G.sim || G.sim !== s) return;
      // a treat brings a few coins, at most every 12 seconds
      let text = '';
      if (s.t - G.treatT >= 12 && !s.result) {
        const n = G.easy ? 15 : 10;
        Sim.treat(s, n);
        G.treatT = s.t;
        text = `+${n}`;
      }
      view.treatLanded(emoji, text);
      if (!extra) view.buddyMode('signature');
    }, fly * 1000);
  }
  function visitUpdate(dt) {
    const v = G.visit, s = G.sim;
    if (!v || !s) return;
    v.t += dt;
    if (!v.treated && v.t > 1.2) { v.treated = true; view.buddyMode('give', 0.6); treat(false); }
    if (!v.said && v.t > 2.0) {
      v.said = true;
      toast(`${NAMES[v.who]} ${Kit.lang.t('SAYS:')} ${Kit.lang.t(HELPER_LINES[Math.floor(Math.random() * HELPER_LINES.length)])}`, 'gold', 2.2);
      view.buddyMode('jumpshot', 0.9);
    }
    if (!v.thrown && v.t > 2.5) {
      v.thrown = true;
      const route = Sim.busiestRoute(s);
      // aim at the middle of that lane's critters (or the middle of the lane)
      const list = s.critters.filter((c) => c.route === route);
      let x, z;
      if (list.length) {
        x = 0; z = 0;
        for (const c of list) { const p = Sim.posOf(s, c, c.speed * 1.0); x += p.x; z += p.z; }
        x /= list.length; z /= list.length;
      } else {
        const line = s.map.lines[route], p = Sim.pointAt(line, line.len * 0.5);
        x = p.x; z = p.z;
      }
      view.throwBalloon(x, z, 1.0, () => {
        if (G.sim !== s || s.result) return;
        Sim.balloon(s, route);
        view.splashLane(s.map.lines[route], x, z);
      });
    }
    if (v.thrown && v.t > 3.6 && v.throws > 1) {
      // another balloon (he was called again)
      v.throws--;
      v.t = 2.0;
      v.said = false;
      v.thrown = false;
    }
    if (v.t > 4.2 && !v.waved) { v.waved = true; view.buddyMode('wave', 0.8); }
    if (v.t > 5.0) endVisit(false);
  }
  function endVisit(now) {
    if (!G.visit) return;
    G.visit = null;
    if (!now) view.buddyLeave();
  }
  function highFive() {
    const s = G.sim;
    view.highFive();
    let txt = 'HIGH FIVE!';
    if (s && s.t - G.fiveT >= 15 && !s.result) {
      Sim.treat(s, 5);
      G.fiveT = s.t;
      txt = 'HIGH FIVE! +5 🪙';
    }
    toast(txt, 'gold', 1.4);
  }

  // ---------------------------------------------------------------- the loop
  function update(dt) {
    switch (G.state) {
      case 'title':
      case 'levels': {
        const s = G.demo;
        if (!s) break;
        G.demoBot.tick(dt);
        Sim.step(s, dt);
        const evs = s.events.splice(0);
        view.handle(evs, s);
        view.sync(s, dt);
        if (s.result || s.t > 150) startDemo();
        break;
      }
      case 'play': {
        const s = G.sim;
        const slow = G.easy && (G.menus[0] || G.menus[1]);
        const sdt = dt * (slow ? 0.35 : G.fast ? 2 : 1);
        if (G.bot) G.bot.tick(sdt);
        Sim.step(s, sdt);
        const evs = s.events.splice(0);
        uiEvents(evs);
        view.handle(evs, s);
        view.sync(s, sdt);
        visitUpdate(dt);
        hints(dt);
        cursorsShow();
        hud();
        for (const m of G.menus) if (m) placeMenu(m);
        if (s.result) onEnd();
        break;
      }
      case 'won':
      case 'lost': {
        const s = G.sim;
        G.endT += dt;
        view.handle(s.events.splice(0), s);
        view.sync(s, dt);
        if (G.state === 'won') view.heroes.forEach((h, i) => view.signature(i, G.endT / 1.8 + i));
        if (!G.resultShown && G.endT > (G.state === 'won' ? 3.6 : 3.0)) showResult();
        break;
      }
      case 'result':
      case 'paused': {
        const s = G.sim;
        if (s) view.sync(s, G.state === 'result' ? dt : 0);
        if (G.state === 'result' && G.result && G.result.win) view.heroes.forEach((h, i) => view.signature(i, performance.now() / 1800 + i));
        break;
      }
    }
  }
  // EASY: a sparkle on a good spot for the next tower (the autopilot's idea), when there are coins for it
  function hints(dt) {
    const s = G.sim;
    G.hintT -= dt;
    if (!G.easy) { view.setHint(null); return; }
    if (G.hintT <= 0) {
      G.hintT = 0.6;
      const mv = Bot.plan(s);
      G.hint = mv && s.coins >= mv.cost ? mv : null;
      if (G.hint && G.hint.kind === 'upgrade') {
        const t = Sim.towerById(s, G.hint.id);
        G.hint.c = t.c;
        G.hint.r = t.r;
      }
    }
    const busy = G.menus[0] || G.menus[1];
    view.setHint(G.hint && !busy ? G.hint : null);
  }
  function cursorsShow() {
    const s = G.sim;
    const state = (cell) => (towerAtCell(cell) ? 'tower' : cellOk(cell) ? 'ok' : 'no');
    for (let p = 0; p < 2; p++) {
      const m = G.menus[p];
      let cell = null, color;
      if (m) { cell = m.cell; color = G.players === 2 ? COLORS[p] : undefined; }
      else if (p === 0 && G.lastInput[0] === 'mouse') cell = G.hover;
      else if (p === 0 || G.players === 2) { cell = G.cursors[p]; color = G.players === 2 ? COLORS[p] : undefined; if (G.lastInput[p] !== 'keys') cell = null; }
      view.setCursor(p, cell, cell ? (m ? 'tower' : state(cell)) : null, color);
    }
    void s;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.held) update(dt);
    view.render(dt);
  }

  // ---------------------------------------------------------------- input: mouse and touch
  const canvas = $('view');
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initSound();
    if (G.state !== 'play') return;
    const cell = view.pick(e.clientX, e.clientY);
    G.lastInput[0] = 'mouse';
    G.hover = cell;
    if (!cell) { closeMenu(0); return; }
    act(0, cell);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (G.state !== 'play' || e.pointerType !== 'mouse') return;
    G.hover = view.pick(e.clientX, e.clientY);
    G.lastInput[0] = 'mouse';
  });
  canvas.addEventListener('pointerleave', () => { G.hover = null; });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); closeMenus(); });

  $('btnGo').addEventListener('click', () => { initSound(); if (G.sim && Sim.callWave(G.sim)) sfx.go(); });
  $('btnFast').addEventListener('click', () => { initSound(); G.fast = !G.fast; sfx.select(); });
  $('btnPause').addEventListener('click', () => { initSound(); pause(); });
  $('btnMute').addEventListener('click', toggleMute);
  $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); callBuddy(); });
  for (const el of document.querySelectorAll('.pick')) {
    el.addEventListener('click', () => { initSound(); sfx.select(); pickWho(el.dataset.who); });
  }
  $('btnPlay').addEventListener('click', () => { initSound(); sfx.select(); toLevels(); });
  $('btnEasy').addEventListener('click', () => { initSound(); sfx.select(); setEasy(true); });
  $('btnNormal').addEventListener('click', () => { initSound(); sfx.select(); setEasy(false); });
  $('btnBack').addEventListener('click', () => { sfx.select(); toTitle(); });
  $('btnResume').addEventListener('click', () => { sfx.select(); resume(); });
  $('btnRestart').addEventListener('click', () => { sfx.select(); startLevel(G.idx); });
  $('btnPauseLevels').addEventListener('click', () => { sfx.select(); toLevels(); });
  $('btnHome').addEventListener('click', () => { sfx.select(); toTitle(); });
  $('btnNext').addEventListener('click', () => { sfx.select(); if (G.idx + 1 < LEVELS.length) startLevel(G.idx + 1); else toLevels(); });
  $('btnAgain').addEventListener('click', () => { sfx.select(); startLevel(G.idx); });
  $('btnTryEasy').addEventListener('click', () => { sfx.select(); setEasy(true); startLevel(G.idx); });
  $('btnResLevels').addEventListener('click', () => { sfx.select(); toLevels(); });

  // ---------------------------------------------------------------- input: keys (two players)
  // player 1: W A S D, Space builds / picks, Q closes, 1-5 build straight away, U upgrades. player 2: arrows, Enter, Backspace.
  const DIR = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
  function moveCursor(p, k) {
    const s = G.sim;
    let [dc, dr] = DIR[k];
    if (view.isPortrait()) [dc, dr] = [dr, -dc]; // the garden is turned on its side: screen-up is toward the gates
    const m = G.menus[p];
    if (m) {
      // in a menu the keys pick a button
      const step = dc + dr > 0 ? 1 : -1;
      m.focus = (m.focus + step + m.items.length) % m.items.length;
      refreshMenu(m, true);
      sfx.select();
      return;
    }
    const c = G.cursors[p] || { c: 0, r: 0 };
    G.cursors[p] = { c: Math.max(0, Math.min(s.map.w - 1, c.c + dc)), r: Math.max(0, Math.min(s.map.h - 1, c.r + dr)) };
    G.lastInput[p] = 'keys';
  }
  window.addEventListener('keydown', (e) => {
    initSound();
    const k = e.key.toLowerCase();
    if (k === 'm') return toggleMute();
    if (G.state === 'play') {
      const two = G.players === 2;
      if (DIR[k]) {
        e.preventDefault();
        const p = two && k.startsWith('arrow') ? 1 : 0;
        moveCursor(p, k);
      } else if (k === ' ' || k === 'enter') {
        e.preventDefault();
        const p = two && k === 'enter' ? 1 : 0;
        G.lastInput[p] = 'keys';
        act(p, G.menus[p] ? G.menus[p].cell : G.cursors[p]);
      } else if (k === 'q' || k === 'backspace') {
        const p = two && k === 'backspace' ? 1 : 0;
        if (G.menus[p]) { closeMenu(p); sfx.select(); }
      } else if (/^[1-5]$/.test(k)) {
        const cell = G.cursors[0];
        G.lastInput[0] = 'keys';
        if (cellOk(cell)) {
          openMenu(0, cell);
          doBuild(0, ORDER[+k - 1]);
        } else sfx.nope();
      } else if (k === 'u') {
        const cell = G.menus[0] ? G.menus[0].cell : G.cursors[0];
        if (towerAtCell(cell)) { openMenu(0, cell); doUpgrade(0); } else sfx.nope();
      } else if (k === 't') callBuddy();
      else if (k === 'g') { if (Sim.callWave(G.sim)) sfx.go(); }
      else if (k === 'f') G.fast = !G.fast;
      else if (k === 'p') pause();
      else if (k === 'escape') { if (G.menus[0] || G.menus[1]) closeMenus(); else pause(); }
    } else if (G.state === 'paused') {
      if (k === 'p' || k === 'escape' || k === 'enter' || k === ' ') resume();
    } else if (G.state === 'title') {
      const order = ['teddy', 'tommy', 'both'];
      const i = order.indexOf(G.who);
      if (k === 'enter' || k === ' ') { e.preventDefault(); toLevels(); }
      else if (k === 'arrowleft' || k === 'a') pickWho(order[(i + 2) % 3]);
      else if (k === 'arrowright' || k === 'd') pickWho(order[(i + 1) % 3]);
      else if (k === 'e') setEasy(!save.easy[G.who]);
    } else if (G.state === 'levels') {
      const up = unlockedUpTo(G.who);
      if (k === 'escape' || k === 'backspace') toTitle();
      else if (k === 'arrowright' || k === 'd') focusLevel(Math.min(up, G.levelFocus + 1));
      else if (k === 'arrowleft' || k === 'a') focusLevel(G.levelFocus - 1);
      else if (k === 'arrowdown' || k === 's') focusLevel(Math.min(up, G.levelFocus + 5));
      else if (k === 'arrowup' || k === 'w') focusLevel(G.levelFocus - 5);
      else if (k === 'enter' || k === ' ') { e.preventDefault(); startLevel(G.levelFocus); }
    } else if (G.state === 'result') {
      if (k === 'enter' || k === ' ') { e.preventDefault(); (G.result.win && G.idx + 1 < LEVELS.length ? $('btnNext') : $('btnAgain')).click(); }
      else if (k === 'escape') toLevels();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!G.keepAwake) {
        if (G.state === 'play') pause();
        Kit.sound.suspend();
      }
    } else if (soundOn) Kit.sound.resume();
  });
  window.addEventListener('resize', () => { layout(); for (const m of G.menus) if (m) placeMenu(m); });
  Kit.lang.onChange(() => {
    if (G.state === 'levels') buildLevels();
    for (const m of G.menus) if (m) refreshMenu(m, true);
    lastHud = {};
    if (G.sim) hud(true);
    setTimeout(layout, 50);
  });

  // ---------------------------------------------------------------- test hooks (browser console)
  const info = () => {
    const s = G.sim;
    return {
      state: G.state, who: G.who, players: G.players, easy: G.easy,
      ...(s && {
        level: s.level.id, t: +s.t.toFixed(1), phase: s.phase, wave: `${s.wave + 1}/${s.waves.length}`, coins: s.coins, snacks: s.snacks,
        critters: s.critters.length, towers: s.towers.length, floated: s.floated, result: s.result,
        visit: G.visit && { who: G.visit.who, t: +G.visit.t.toFixed(1), throws: G.visit.throws },
        menus: G.menus.map((m) => m && `${m.tower ? 'tower' : 'build'}@${m.cell.c},${m.cell.r}`), hint: G.hint && `${G.hint.kind}:${G.hint.type || G.hint.id}@${G.hint.c},${G.hint.r}`,
      }),
      view: view.counts,
    };
  };
  window.game = {
    get state() { return G.state; },
    get sim() { return G.sim; },
    view, info, icons,
    step(sec = 1, fps = 60) {
      const n = Math.max(1, Math.round(sec * fps));
      for (let i = 0; i < n; i++) update(1 / fps);
      view.render(1 / fps);
      return info();
    },
    hold(on = true) { G.held = on; return on; },
    keepAwake(on = true) { G.keepAwake = on; return on; },
    calm(on = true) { document.body.classList.toggle('calm', on); },
    start(id = 1, opts = {}) {
      if (opts.who) pickWho(opts.who);
      startLevel(Math.max(0, LEVELS.findIndex((L) => L.id === id)), opts);
      return info();
    },
    title: toTitle, levels: toLevels, pause, resume, who: pickWho, easy: setEasy,
    build(type, c, r) { return !!Sim.build(G.sim, type, c, r, owner(0)); },
    upgrade(c, r) { const t = Sim.towerAt(G.sim, c, r); return !!t && Sim.upgrade(G.sim, t.id); },
    sell(c, r) { const t = Sim.towerAt(G.sim, c, r); return t ? Sim.sell(G.sim, t.id) : 0; },
    menu(c, r, p = 0) { openMenu(p, { c, r }); return info().menus; },
    tap(c, r) { const p = view.toScreen(c + 0.5, r + 0.5); this.pointer('down', p.x, p.y); return info().menus; },
    money(n) { G.sim.coins = G.sim.ledger.start = n; G.sim.ledger.spent = G.sim.ledger.rewards = G.sim.ledger.bonuses = G.sim.ledger.treats = G.sim.ledger.refunds = 0; return n; },
    wave() { return Sim.callWave(G.sim); },
    buddy() { callBuddy(); return info().visit; },
    autoplay(on = true) { G.autoplay = on; G.bot = on && G.sim ? Bot.create(G.sim, { every: 0.3 }) : null; return on; },
    win() {
      const s = G.sim;
      s.critters.length = 0;
      s.queue.length = 0;
      s.wave = s.waves.length - 1;
      s.phase = 'wave';
      return game.step(0.1);
    },
    lose() { G.sim.snacks = 1; Sim.spawn(G.sim, 'mouse', 0).d = G.sim.map.lines[0].len - 0.05; return game.step(0.1); },
    unlockAll() { allOpen = true; if (G.state === 'levels') buildLevels(); },
    resetSave() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      save.stars = { teddy: {}, tommy: {}, both: {} };
      save.best = { teddy: {}, tommy: {}, both: {} };
    },
    pointer(type, x, y) {
      // drive the canvas like a finger: game.pointer('down', 300, 400)
      canvas.dispatchEvent(new PointerEvent('pointer' + type, { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', pointerId: 7 }));
    },
    screenOf(c, r) { return view.toScreen(c + 0.5, r + 0.5); },
    peek(c, r, D) { view.peek(c === undefined ? null : c + 0.5, r + 0.5, D); },
    // the headless rules check, right here in the page (see js/check.js): game.check(), game.check({ fail: true })
    check(opts = {}) { return GD.check(opts); },
  };

  // ---------------------------------------------------------------- go
  toTitle();
  requestAnimationFrame(frame);
})();
