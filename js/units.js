/* TT Garden Defense: the toy towers and the snack-stealing critters, as numbers. Nobody gets hurt: towers fill a
   critter's "soak" meter (water, bubbles, jelly, cookie crumbs), and a full meter means he's soaked or sleepy and
   floats away in a bubble. Exposes GD.TOWERS, GD.TOWER_ORDER, GD.CRITTERS and GD.TUNE. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});

  // lv: one entry per level (1, 2, 3). range in cells, rate = seconds between shots, soak = how much it fills the meter.
  GD.TOWERS = {
    squirt: {
      name: 'Water Squirter', short: 'SQUIRTER', icon: '💦', cost: 50, up: [40, 70], color: '#2a8be0',
      tip: 'Squirts one critter at a time. Quick!',
      lv: [{ range: 2.5, rate: 0.55, soak: 3 }, { range: 2.8, rate: 0.45, soak: 4.5 }, { range: 3.1, rate: 0.36, soak: 6.5 }],
    },
    bubble: {
      name: 'Bubble Blower', short: 'BUBBLES', icon: '🫧', cost: 70, up: [55, 85], color: '#ff6fb5',
      tip: 'Big bubbles make a few critters sleepy at once.',
      lv: [{ range: 2.4, rate: 1.25, soak: 3.5, splash: 0.9 }, { range: 2.6, rate: 1.05, soak: 5, splash: 1.0 },
        { range: 2.8, rate: 0.9, soak: 7, splash: 1.15 }],
    },
    jelly: {
      name: 'Jelly Slower', short: 'JELLY', icon: '🍮', cost: 60, up: [45, 70], color: '#4fd15a',
      tip: 'Sticky jelly on the path. Critters slow down (bees fly over it).',
      lv: [{ range: 2.6, rate: 2.2, soak: 1, splash: 0.8, slow: 0.4, stick: 3 },
        { range: 2.8, rate: 1.9, soak: 1.5, splash: 0.9, slow: 0.5, stick: 3.5 },
        { range: 3.0, rate: 1.6, soak: 2, splash: 1.0, slow: 0.6, stick: 4 }],
    },
    cookie: {
      name: 'Cookie Catapult', short: 'CATAPULT', icon: '🍪', cost: 100, up: [75, 110], color: '#c98a3c',
      tip: 'Throws giant cookies far away. Crumbs make everyone near full and sleepy.',
      lv: [{ range: 4.0, rate: 2.7, soak: 9, splash: 1.0 }, { range: 4.4, rate: 2.35, soak: 14, splash: 1.15 },
        { range: 4.8, rate: 2.0, soak: 20, splash: 1.3 }],
    },
    sprinkler: {
      name: 'Sprinkler', short: 'SPRINKLER', icon: '⛲', cost: 80, up: [60, 90], color: '#18c8d8',
      tip: 'Sprays everyone close by, all at once.',
      lv: [{ range: 1.6, rate: 0.9, soak: 2 }, { range: 1.8, rate: 0.75, soak: 3 }, { range: 2.0, rate: 0.6, soak: 4.5 }],
    },
  };
  GD.TOWER_ORDER = ['squirt', 'bubble', 'jelly', 'cookie', 'sprinkler'];

  // hp = how much soak fills him up; speed in cells per second; coins when he floats away; snacks he grabs.
  GD.CRITTERS = {
    mouse: { name: 'Crumb Mouse', icon: '🐭', hp: 12, speed: 1.1, coins: 4, snacks: 1 },
    ant: { name: 'Ant Gang', icon: '🐜', hp: 4, speed: 1.3, coins: 1, snacks: 1, small: true },
    squirrel: { name: 'Zippy Squirrel', icon: '🐿️', hp: 9, speed: 1.8, coins: 5, snacks: 1 },
    snail: { name: 'Slowpoke Snail', icon: '🐌', hp: 40, speed: 0.55, coins: 9, snacks: 1 },
    bee: { name: 'Buzzy Bee', icon: '🐝', hp: 10, speed: 1.4, coins: 5, snacks: 1, fly: true },
    boss: { name: 'Bandit Raccoon', icon: '🦝', hp: 260, speed: 0.42, coins: 60, snacks: 5, boss: true },
  };

  // Difficulty. EASY (the default, for Tommy, 5) and NORMAL (for Teddy, 8).
  GD.TUNE = {
    easy: { hp: 0.5, speed: 0.8, coins: 1.4, snacks: 20, firstBreak: 25, breakT: 9 },
    normal: { hp: 1, speed: 1, coins: 1, snacks: 12, firstBreak: 18, breakT: 7 },
    perLevelHp: 0.04, // critters get a little tougher each level
    refund: 0.7, // packing a tower up gives this much back...
    undoT: 6, // ...or all of it, right after you built it (oops!)
    balloonBoss: 0.5, // the giant water balloon fills a boss's meter this much
  };
})();
