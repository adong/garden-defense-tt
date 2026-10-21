/* TT Garden Defense: the 15 gardens. Each map is 14 x 8 cells:
     .  grass (towers go here)      #  garden path      S  a gate where critters come in
     B  the picnic (critters want its snacks)          T tree   o rock   w pond   f flower bed (no towers)
   Critters find their own way from each gate to the picnic along the path (GD.Sim.parseMap, a breadth-first search).
   A wave is a list of groups, all starting together: 'mouse x8 /1.2 +3 @1' = 8 mice, one every 1.2 s, starting 3 s
   into the wave, all from gate 1 (without @ they take turns at the gates). coins = start coins on NORMAL.
   Exposes GD.WORLDS and GD.LEVELS. */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});

  GD.WORLDS = [
    { id: 'day', name: 'Sunny Backyard', icon: '🌞' },
    { id: 'flower', name: 'Flower Garden', icon: '🌷' },
    { id: 'moon', name: 'Moonlit Veggie Patch', icon: '🌙' },
  ];

  const L = (world, name, coins, tip, map, waves) => ({ world, name, coins, tip, map, waves });

  GD.LEVELS = [
    // ------------------------------------------------------------ Sunny Backyard
    L(0, 'Hello, Critters!', 120, 'Tap the grass next to the path to build a tower!', [
      '..............',
      'S####.........',
      '....#...T.....',
      '....#.........',
      '....######....',
      '.........#....',
      '..o......####B',
      '..............',
    ], ['mouse x5 /1.6', 'mouse x7 /1.3', 'mouse x9 /1.1', 'mouse x10 /1.0', 'mouse x12 /0.9']),

    L(0, 'Snack Trail', 130, 'Ants are tiny. A sprinkler gets lots of them at once!', [
      '..............',
      '..T......o....',
      'S#####........',
      '.....#..####..',
      '.....#..#..#..',
      '.....####..#..',
      '...........##B',
      '..f...........',
    ], ['mouse x6 /1.4', 'ant x10 /0.5', 'mouse x8 /1.1, ant x8 /0.5 +4', 'mouse x10 /0.9', 'ant x16 /0.35, mouse x6 /1.2 +3']),

    L(0, 'Up and Down', 140, 'Squirrels are zippy. Jelly slows them down!', [
      '.S............',
      '.#..#####.....',
      '.#..#...#.....',
      '.#..#...#..T..',
      '.#..#...#.....',
      '.#..#...#.....',
      '.####...#####B',
      '..o.......w...',
    ], ['mouse x8 /1.2', 'squirrel x5 /1.4', 'mouse x8 /1.0, squirrel x4 /1.2 +5', 'ant x18 /0.35',
      'squirrel x8 /0.9, mouse x6 /1.1 +2', 'mouse x12 /0.8, squirrel x6 /1.0 +6']),

    L(0, 'Garden Loop', 150, 'Snails are slow, but they need lots of water.', [
      '..............',
      '.############.',
      '.#..........#.',
      '.#...T......#.',
      '.#..........#.',
      '.#..#########.',
      '.#..#.........',
      '.S..B.........',
    ], ['mouse x8 /1.1', 'snail x3 /3', 'mouse x10 /0.9, ant x10 /0.4 +5', 'snail x4 /2.5, squirrel x5 /1.2 +4',
      'squirrel x10 /0.8', 'snail x5 /2, mouse x10 /0.8 +2']),

    L(0, 'Bandit Boss', 170, 'The Bandit Raccoon is coming! Upgrade your towers!', [
      '..S...........',
      '..#....o......',
      '..#######.....',
      '........#.....',
      '.T......#.....',
      '..#######.....',
      '..#.........w.',
      '..#########B..',
    ], ['mouse x10 /1.0', 'squirrel x8 /1.0', 'snail x4 /2.2, ant x14 /0.35 +3', 'mouse x12 /0.8, squirrel x6 /1.0 +4',
      'boss x1, mouse x10 /1.0 +4']),

    // ------------------------------------------------------------ Flower Garden
    L(1, 'Flower Gate', 180, 'Two gates! Guard the path where they meet.', [
      '...T......o...',
      'S####.........',
      '....#..######.',
      '....####....#.',
      '....#.......#.',
      'S####.......#.',
      '..f.........#.',
      '......w.....B.',
    ], ['mouse x8 /1.0', 'ant x16 /0.35', 'squirrel x8 /0.9', 'snail x4 /2, mouse x8 /1.0 +3', 'mouse x14 /0.7',
      'squirrel x10 /0.7, snail x4 /2 +4']),

    L(1, 'Bee Meadow', 190, 'Bees fly over jelly. Squirt them!', [
      '...S..........',
      '...#....T.....',
      '...#..........',
      '...#######....',
      '...#.....#....',
      '...#.....####B',
      '...#....o.....',
      '...S..........',
    ], ['bee x6 /1.2', 'mouse x10 /0.9', 'bee x8 /1.0, ant x14 /0.35 +3', 'snail x5 /2', 'bee x10 /0.8, squirrel x6 /1.0 +4',
      'mouse x12 /0.7, bee x10 /0.8 +3']),

    L(1, 'Snail Trail', 200, 'A cookie catapult throws really far.', [
      '......o.....T.',
      'S#######......',
      '..f....#......',
      '.#######......',
      '.#............',
      '.###########..',
      '...........#..',
      '..w........B..',
    ], ['snail x4 /2.5', 'mouse x12 /0.8', 'snail x6 /2, ant x16 /0.3 +4', 'squirrel x12 /0.7', 'bee x10 /0.8, snail x4 /2 +3',
      'snail x8 /1.6, mouse x10 /0.8 +5', 'squirrel x10 /0.6, bee x8 /0.8 +3']),

    L(1, 'Busy Flowers', 210, 'Lots of critters at once? Bubbles get a few together!', [
      '........S.....',
      '........#.....',
      'S###....#.....',
      '...#....#.....',
      '...######.....',
      '........#.....',
      '........#####B',
      '.T....o.......',
    ], ['mouse x10 /0.9', 'ant x24 /0.25', 'squirrel x10 /0.8, bee x6 /1 +4', 'snail x6 /1.8', 'mouse x14 /0.6, squirrel x8 /0.8 +4',
      'bee x14 /0.6', 'snail x6 /1.6, squirrel x10 /0.7 +3']),

    L(1, 'Big Bandit Party', 230, 'Two bandits this time! Upgrade, upgrade!', [
      '...w........B.',
      '............#.',
      'S#######....#.',
      '.......#....#.',
      '.......######.',
      '.......#......',
      '..T....#...o..',
      '.......S......',
    ], ['mouse x12 /0.8', 'bee x10 /0.8', 'snail x6 /1.6, ant x20 /0.3 +3', 'squirrel x14 /0.6', 'boss x1 @0, mouse x10 /0.9 @1 +3',
      'bee x10 /0.7, squirrel x10 /0.7 +3', 'boss x2 /6, snail x4 /2 +4']),

    // ------------------------------------------------------------ Moonlit Veggie Patch
    L(2, 'Pumpkin Path', 240, 'A long, long path. Build towers all along it.', [
      '.S............',
      '.#..####..###B',
      '.#..#..#..#...',
      '.#..#..#..#...',
      '.#..#..#..#...',
      '.#..#..#..#...',
      '.####..####...',
      '......o.......',
    ], ['mouse x14 /0.7', 'ant x30 /0.22', 'squirrel x12 /0.6', 'snail x8 /1.4', 'bee x14 /0.6, mouse x10 /0.7 +4',
      'squirrel x14 /0.5, snail x6 /1.5 +3', 'mouse x20 /0.5', 'boss x1, bee x12 /0.7 +5']),

    L(2, 'Carrot Crossing', 250, 'One path is short. Guard it first!', [
      '...T.......o..',
      'S#########....',
      '.........#....',
      '.#########....',
      '.#............',
      '.############S',
      '.#............',
      '.B............',
    ], ['mouse x12 /0.8', 'squirrel x10 /0.8', 'ant x30 /0.22', 'snail x8 /1.4, bee x8 /0.8 +3', 'squirrel x14 /0.6',
      'mouse x16 /0.5, bee x10 /0.7 +3', 'snail x10 /1.2, squirrel x10 /0.6 +5', 'boss x1, mouse x14 /0.6 +4']),

    L(2, 'Firefly Night', 260, 'Night time! Water still works in the dark.', [
      '..............',
      '..##########..',
      '..#.wwww...#..',
      'S##.wwww...#..',
      '....wwww...#..',
      '...........#..',
      '..##########..',
      '..B...........',
    ], ['bee x12 /0.7', 'mouse x16 /0.6', 'snail x8 /1.3', 'squirrel x16 /0.5, ant x20 /0.25 +4', 'bee x16 /0.5',
      'snail x10 /1.2, mouse x14 /0.6 +3', 'squirrel x18 /0.45', 'boss x2 /8, bee x12 /0.7 +4']),

    L(2, 'Veggie Maze', 270, 'Two gates, one picnic.', [
      '.S....B.....S.',
      '.#....#.....#.',
      '.#..######..#.',
      '.#..#.ww.#..#.',
      '.#..#....#..#.',
      '.#..#....#..#.',
      '.####....####.',
      '...T......o...',
    ], ['mouse x16 /0.6', 'squirrel x14 /0.55', 'ant x36 /0.2', 'snail x10 /1.2', 'bee x18 /0.5',
      'mouse x16 /0.5, squirrel x12 /0.6 +3', 'snail x10 /1.1, bee x12 /0.6 +4', 'boss x2 /6, squirrel x12 /0.6 +4']),

    L(2, 'King of the Snacks', 300, 'The King of the Snacks! Everything you have got!', [
      '..S...........',
      '..#.#######...',
      '..#.#.....#...',
      '..###.....#...',
      'T.........###B',
      '..###.....#...',
      '..#.#######...',
      '..S...........',
    ], ['mouse x18 /0.55', 'bee x16 /0.55', 'squirrel x18 /0.5', 'snail x12 /1.1, ant x30 /0.22 +3', 'mouse x20 /0.45, bee x12 /0.6 +3',
      'squirrel x20 /0.45', 'snail x12 /1, squirrel x12 /0.6 +4', 'boss x1 @0, boss x1 @1 +2, mouse x16 /0.6 +6',
      'boss x3 /5, bee x16 /0.5 +3']),
  ];
  GD.LEVELS.forEach((lv, i) => { lv.id = i + 1; });
})();
