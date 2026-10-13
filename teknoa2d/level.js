/* EXiLED teknoa 2d — experience and levels. No DOM in here.

   Every action that earns EXP is one row in SOURCES: a name for the ID app
   and a function that says how much a single go is worth. Adding a new way
   to earn (combat, hacking, quests) is one more row plus one award() call
   where it happens; nothing else changes.

   State: s.xp = { total, by: { <source>: exp earned from it } }. The level
   is never stored, it is worked out from the total, so changing the curve
   later re-levels every save fairly. */
(function (root) {
  var MAX_LEVEL = 99;

  /* d: whatever the caller knows about the go (a fish's tier, a sale's price) */
  var SOURCES = {
    fish:   { name: 'fishing',   xp: function (d) { return ({ junk: 2, common: 8, uncommon: 15, rare: 35, legendary: 100 })[d && d.tier] || 5; } },
    cook:   { name: 'cooking',   xp: function (d) { return d && d.kitchen ? 10 : 6; } },
    gather: { name: 'gathering', xp: function (d) { return d && d.perfect ? 6 : 4; } },
    craft:  { name: 'crafting',  xp: function (d) { return Math.max(1, Math.floor(+(d && d.xp) || 10)); } },
    sell:   { name: 'trading',   xp: function (d) { return Math.max(1, Math.floor((+(d && d.price) || 0) / 10)); } },
    combat: { name: 'combat',    xp: function (d) { return Math.max(1, Math.floor(+(d && d.xp) || 15)); } }
  };

  /* EXP to go from level n to n+1: 100, 283, 520, 800, 1118 ... */
  function need(n) { return Math.round(100 * Math.pow(n, 1.5)); }
  function xpOf(s) { var t = Math.floor(+(s.xp && s.xp.total) || 0); return t > 0 ? t : 0; }
  /* { level, into: exp past this level's start, need: exp this level takes, total } */
  function info(s) {
    var total = xpOf(s), lvl = 1, left = total;
    while (lvl < MAX_LEVEL && left >= need(lvl)) { left -= need(lvl); lvl++; }
    return { level: lvl, into: left, need: lvl < MAX_LEVEL ? need(lvl) : 0, total: total };
  }
  function level(s) { return info(s).level; }

  /* award(s, 'fish', { tier: 'rare' }) → { xp, level, up: levels gained } */
  function award(s, source, d) {
    var src = SOURCES[source];
    if (!src) throw new Error('unknown exp source: ' + source);
    var n = Math.max(0, Math.floor(src.xp(d || {})));
    if (!s.xp || typeof s.xp !== 'object') s.xp = { total: 0, by: {} };
    if (!s.xp.by || typeof s.xp.by !== 'object') s.xp.by = {};
    var before = level(s);
    s.xp.total = xpOf(s) + n;
    s.xp.by[source] = (Math.floor(+s.xp.by[source]) || 0) + n;
    var after = level(s);
    return { xp: n, level: after, up: after - before };
  }

  root.MFLevel = { MAX_LEVEL: MAX_LEVEL, SOURCES: SOURCES, need: need, info: info, level: level, award: award };
})(typeof window !== 'undefined' ? window : globalThis);
