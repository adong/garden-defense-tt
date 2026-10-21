/* 中文 for TT Garden Defense: every word on the page, the toasts and banners, the towers, the gardens and the ? panel
   (Kit.lang, from kit/lang.js). The little words that pop up in the garden (SPLASH! NOM! CRUNCH!) ask for theirs
   through Kit.lang.t in js/view.js.
   Staying English on purpose: the kids' names (TEDDY, TOMMY), the game's name and logo (Alan picks it) and the
   TEDDY / TOMMY tags on the two players' menus. Kid-friendly words from the brief: 保卫战, 塔, 升级, 波次. */
(function () {
  const L = Kit.lang;
  const TITLE = window.GD_TITLE || 'TT Garden Defense';
  L.keep([TITLE, 'TT Garden Defense', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY!', 'TOMMY!', 'TEDDY & TOMMY', 'TEDDY & TOMMY!', 'Esc']);

  const WORLDS = { 'Sunny Backyard': '阳光后院', 'Flower Garden': '鲜花园', 'Moonlit Veggie Patch': '月光菜园' };
  const LEVELS = {
    'Hello, Critters!': '你好，小动物！', 'Snack Trail': '零食小路', 'Up and Down': '上上下下', 'Garden Loop': '花园绕圈圈',
    'Bandit Boss': '强盗大王', 'Flower Gate': '鲜花门', 'Bee Meadow': '蜜蜂草地', 'Snail Trail': '蜗牛小道',
    'Busy Flowers': '热闹的花丛', 'Big Bandit Party': '强盗大派对', 'Pumpkin Path': '南瓜小路', 'Carrot Crossing': '胡萝卜路口',
    'Firefly Night': '萤火虫之夜', 'Veggie Maze': '蔬菜迷宫', 'King of the Snacks': '零食大王',
  };
  const TIPS = {
    'Tap the grass next to the path to build a tower!': '点小路旁边的草地，放一座塔！',
    'Ants are tiny. A sprinkler gets lots of them at once!': '蚂蚁小小的。洒水塔一下能喷到好多只！',
    'Squirrels are zippy. Jelly slows them down!': '松鼠跑得快。果冻能让它们慢下来！',
    'Snails are slow, but they need lots of water.': '蜗牛很慢，可是要喷好多水才行。',
    'The Bandit Raccoon is coming! Upgrade your towers!': '浣熊强盗来啦！快给塔升级！',
    'Two gates! Guard the path where they meet.': '两个门！守住两条路会合的地方。',
    'Bees fly over jelly. Squirt them!': '蜜蜂会飞过果冻。用水喷它们！',
    'A cookie catapult throws really far.': '饼干投石塔扔得特别远。',
    'Lots of critters at once? Bubbles get a few together!': '一下来好多小动物？泡泡能一次罩住好几只！',
    'Two bandits this time! Upgrade, upgrade!': '这次有两个强盗！升级，升级！',
    'A long, long path. Build towers all along it.': '好长好长的路。沿着路多放几座塔。',
    'One path is short. Guard it first!': '有一条路很短。先守住它！',
    'Night time! Water still works in the dark.': '天黑啦！黑夜里水照样管用。',
    'Two gates, one picnic.': '两个门，一个野餐。',
    'The King of the Snacks! Everything you have got!': '零食大王来了！使出全部本领！',
  };
  const TOWERS = {
    'Water Squirter': '喷水塔', 'Bubble Blower': '泡泡塔', 'Jelly Slower': '果冻塔', 'Cookie Catapult': '饼干投石塔', 'Sprinkler': '洒水塔',
  };
  const TOWER_TIPS = {
    'Squirts one critter at a time. Quick!': '一次喷一只，喷得飞快！',
    'Big bubbles make a few critters sleepy at once.': '大泡泡让好几只小动物一起犯困。',
    'Sticky jelly on the path. Critters slow down (bees fly over it).': '在路上铺黏黏的果冻，小动物走不快（蜜蜂会飞过去）。',
    'Throws giant cookies far away. Crumbs make everyone near full and sleepy.': '把大饼干扔得远远的。饼干渣让周围的小动物吃饱犯困。',
    'Sprays everyone close by, all at once.': '一下子喷到旁边所有的小动物。',
  };
  const HELPER = { 'SPLASH TIME!': '水花时间到！', 'GIANT WATER BALLOON!': '超大水气球！', 'HERE COMES A BIG ONE!': '大的来啦！' };

  L.add(Object.assign({}, WORLDS, LEVELS, TIPS, TOWERS, TOWER_TIPS, HELPER, {
    // title and gardens
    'Save the picnic from the snack-stealing critters!': '花园保卫战：别让小动物偷走野餐零食！',
    'Teddy and Tommy save the picnic together! Press T for a high five!': 'Teddy 和 Tommy 一起保卫野餐！按 T 击掌！',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', '◀ BACK': '◀ 返回', 'Pick a garden': '选一个花园', 'GARDEN': '花园', 'GARDENS': '花园',
    // HUD
    '▶ GO!': '▶ 出发！', '▶ BOSS!': '▶ 大王！', 'NEXT WAVE:': '下一波次：', '✋ HIGH FIVE!': '✋ 击掌！',
    'Coins': '金币', 'Snacks left': '剩下的零食', 'Wave': '波次', 'Send the next wave now (G)': '马上派出下一波次 (G)', 'Fast (F)': '快进 (F)',
    'Call your brother (T)': '叫兄弟来帮忙 (T)', 'High five (T)': '击掌 (T)', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    // build menus
    'Upgrade: bigger, faster, wetter!': '升级：更大、更快、更湿！', 'All the way up!': '已经升到最高级啦！',
    'Pack it up and get coins back.': '收起来，拿回金币。', 'Need': '还差', 'more coins!': '金币！',
    'Towers go on the grass, next to the path!': '塔要放在小路旁边的草地上！', 'No room here. Try the grass!': '这里放不下。试试草地！',
    // toasts and banners
    'Oh no! A critter took a snack!': '哎呀！小动物拿走了一个零食！', 'IS HERE!': '来啦！', 'SAYS:': '说：',
    'HIGH FIVE!': '击掌！', 'WAVE': '波次', 'LAST WAVE!': '最后一波！', 'BANDIT BOSS!': '强盗大王来了！',
    'GARDEN SAVED!': '花园保住啦！', 'OH NO, THE SNACKS!': '哎呀，零食！',
    // results and pause
    'THE CRITTERS GOT THE SNACKS!': '小动物拿走了零食！', 'NEW BEST!': '新纪录！', 'NEXT ▶': '下一关 ▶', '↻ PLAY AGAIN': '↻ 再玩一次',
    '🐣 TRY EASY': '🐣 试试简单', '↻ AGAIN': '↻ 重来',
    // words that pop up in the garden
    'CRUNCH!': '咔嚓！', 'NOM!': '啊呜！', 'SPLASH!': '哗啦！', 'Zzz': '呼呼',
    // the ? panel
    'Teddy (1P)': 'Teddy（玩家 1）', 'Tommy (2P)': 'Tommy（玩家 2）', 'move the box': '移动方框', 'open the menu · pick': '打开菜单 · 选择',
    'close the menu': '关上菜单', 'build a tower right away': '马上放塔', 'upgrade the tower': '给塔升级',
    'next wave now · fast': '马上下一波次 · 快进', 'title: who · easy · play': '标题页：选人 · 简单 · 开始',
    'Tap the grass next to the path to build a tower. Tap a tower to upgrade it. The face at the top calls your brother.':
      '点小路旁边的草地放塔。点塔可以升级。点上面的脸叫兄弟来帮忙。',
  }));

  L.rule(/^Your buddy (\S+) comes when you call him!$/, '叫一声，你的好帮手 $1 就来啦！');
  L.rule(/^WAVE (\d+) DONE! \+(\d+) 🪙$/, '第 $1 波次完成！+$2 🪙');
  L.rule(/^HIGH FIVE! \+(\d+) 🪙$/, '击掌！+$1 🪙');
  L.rule(/^(.+) floated (\d+) critters away and kept (\d+) of (\d+) snacks!$/, '$1 让 $2 只小动物飘走啦，保住了 $3 / $4 个零食！');
  L.rule(/^(.+) floated (\d+) critters away\. Try again!$/, '$1 让 $2 只小动物飘走啦。再试一次！');
  L.rule(/^(Water Squirter|Bubble Blower|Jelly Slower|Cookie Catapult|Sprinkler) (★{1,3})$/, (m, name, st) => `${TOWERS[name]} ${st}`);
  L.rule(/^SCORE (\d+) · BEST (\d+)$/, '得分 $1 · 最高分 $2');
})();
