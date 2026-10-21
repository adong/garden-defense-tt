/* TT Garden Defense: sound effects, all synthesised through Kit.sound (so the one mute switch covers them).
   Busy sounds (squirts, pops) are rationed so a full garden doesn't turn into noise. Exposes GD.sfx. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});
  const S = Kit.sound, tone = S.tone, hiss = S.hiss;
  const last = {};
  // play at most once every `gap` seconds
  const every = (key, gap, fn) => (...a) => {
    const t = performance.now() / 1000;
    if (last[key] && t - last[key] < gap) return;
    last[key] = t;
    fn(...a);
  };
  let streak = 0, streakT = 0;

  GD.sfx = {
    select() { S.click(); },
    build() {
      tone({ type: 'triangle', f: 330, to: 660, dur: 0.12, vol: 0.18 });
      tone({ type: 'triangle', f: 660, to: 990, at: 0.08, dur: 0.12, vol: 0.14 });
      hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.15, vol: 0.12 });
    },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.18, vol: 0.13 })); },
    sell() { hiss({ f: 2200, to: 500, dur: 0.25, vol: 0.14, q: 1.4 }); tone({ type: 'triangle', f: 600, to: 300, dur: 0.2, vol: 0.1 }); },
    nope() { tone({ type: 'square', f: 220, to: 180, dur: 0.14, vol: 0.06 }); },
    squirt: every('squirt', 0.07, () => hiss({ filter: 'highpass', f: 2800, to: 5200, dur: 0.09, vol: 0.07 })),
    blow: every('blow', 0.12, () => tone({ type: 'sine', f: 420, to: 760, dur: 0.16, vol: 0.09 })),
    pop: every('pop', 0.06, () => tone({ type: 'sine', f: 900 + Math.random() * 300, to: 1600, dur: 0.06, vol: 0.12 })),
    fling: every('fling', 0.15, () => { tone({ type: 'triangle', f: 180, to: 360, dur: 0.18, vol: 0.12 }); hiss({ f: 800, to: 2400, dur: 0.22, vol: 0.06 }); }),
    splat: every('splat', 0.1, () => { tone({ f: 200, to: 80, dur: 0.14, vol: 0.2 }); hiss({ filter: 'lowpass', f: 1400, to: 300, dur: 0.14, vol: 0.12 }); }),
    thump: every('thump', 0.1, () => { tone({ f: 140, to: 55, dur: 0.16, vol: 0.28 }); hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.2, vol: 0.15 }); }),
    drip: every('drip', 0.08, () => tone({ type: 'sine', f: 1300, to: 700, dur: 0.07, vol: 0.06 })),
    spray: every('spray', 0.18, () => hiss({ filter: 'highpass', f: 3500, to: 2500, dur: 0.3, vol: 0.06, attack: 0.04 })),
    // a critter floating off in a bubble: a sleepy rising "bloop" and a coin
    float: every('float', 0.05, () => {
      const t = performance.now() / 1000;
      streak = t - streakT < 1.2 ? streak + 1 : 0;
      streakT = t;
      tone({ type: 'sine', f: 520, to: 1040, dur: 0.22, vol: 0.12 });
      S.coin(streak);
    }),
    steal() {
      tone({ type: 'square', f: 660, to: 440, dur: 0.1, vol: 0.06, lp: 2000 });
      tone({ type: 'square', f: 520, to: 330, at: 0.12, dur: 0.12, vol: 0.06, lp: 2000 });
      tone({ type: 'triangle', f: 300, to: 200, at: 0.26, dur: 0.18, vol: 0.12 });
    },
    wave(boss) {
      [392, 523, 659].forEach((f, i) => tone({ type: 'square', f, at: i * 0.09, dur: 0.16, vol: 0.06, lp: 2400 }));
      if (boss) S.horn(1.2);
    },
    waveClear() { [659, 784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.2, vol: 0.12 })); },
    go() { tone({ type: 'square', f: 523, to: 1047, dur: 0.2, vol: 0.07, lp: 2600 }); },
    win() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.12, dur: 0.28, vol: 0.15 }));
      hiss({ filter: 'highpass', f: 5000, dur: 0.8, vol: 0.08, at: 0.7 });
    },
    lose() { [392, 370, 349, 294].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: 0.3, vol: 0.13 })); },
    poof() { hiss({ f: 1500, to: 4000, dur: 0.2, vol: 0.12 }); tone({ type: 'triangle', f: 500, to: 1300, dur: 0.18, vol: 0.12 }); },
    toss() { hiss({ f: 1200, to: 2600, dur: 0.25, vol: 0.08 }); },
    yum() { tone({ type: 'triangle', f: 700, to: 900, dur: 0.1, vol: 0.12 }); tone({ type: 'triangle', f: 900, to: 1200, at: 0.12, dur: 0.12, vol: 0.12 }); },
    throwBig() { hiss({ f: 500, to: 1800, dur: 0.5, vol: 0.12 }); tone({ type: 'triangle', f: 200, to: 500, dur: 0.4, vol: 0.12 }); },
    bigSplash() {
      hiss({ filter: 'lowpass', f: 5000, to: 300, dur: 1.0, vol: 0.45 });
      tone({ f: 160, to: 45, dur: 0.5, vol: 0.4 });
      for (let i = 0; i < 6; i++) tone({ type: 'sine', f: 900 + i * 180, to: 500, at: 0.2 + i * 0.07, dur: 0.08, vol: 0.06 });
    },
    clap() { hiss({ filter: 'highpass', f: 1800, dur: 0.08, vol: 0.3 }); hiss({ filter: 'highpass', f: 1500, at: 0.03, dur: 0.1, vol: 0.2 }); },
    punch() { S.punch(); },
    swish() { S.swish(); },
  };
  // GD.sfx.quiet = true hushes the effects (the title-screen demo plays without them)
  for (const k of Object.keys(GD.sfx)) {
    const fn = GD.sfx[k];
    GD.sfx[k] = (...a) => { if (!GD.sfx.quiet) fn(...a); };
  }
  GD.sfx.quiet = false;
})();
