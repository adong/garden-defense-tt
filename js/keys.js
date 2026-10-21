/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.GD_TITLE || 'TT Garden Defense',
  cols: ['Teddy (1P)', 'Tommy (2P)'],
  keys: [
    ['move the box', 'W A S D', '↑ ← ↓ →'],
    ['open the menu · pick', 'Space', 'Enter'],
    ['close the menu', 'Q', 'Backspace'],
    ['build a tower right away', '1 – 5', ''],
    ['upgrade the tower', 'U', ''],
    ['call your brother · high five', 'T', 'T'],
    ['next wave now · fast', 'G · F', ''],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: who · easy · play', '← → · E · Enter', ''],
  ],
  note: 'In 1 player both sets of keys work.',
  touch: 'Tap the grass next to the path to build a tower. Tap a tower to upgrade it. The face at the top calls your brother.',
});
