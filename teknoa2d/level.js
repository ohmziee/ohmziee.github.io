/* EXiLED teknoa 2d — experience, levels, traits and perks. No DOM in here.

   Skyrim-style:
     doing things      → exp in the trait it uses (fishing → REF, selling → PRS)
     trait exp         → also counts toward the character level
     a character level → pick a core vital (engine.js CORE) to raise by 10,
                         and that pick earns 1 perk point
     perk points       → spent in a trait's tree, on perks its level unlocks

   Everything is a table. A new way to earn is a row in SOURCES plus one
   award() call where it happens; a new trait is a row in TRAITS; a new perk
   is a row in PERKS. Levels are never stored, they are worked out from exp,
   so retuning a curve re-levels every save fairly. */
(function (root) {
  var MAX_LEVEL = 99, MAX_TRAIT = 100;

  /* the traits. more to come: add a row */
  var TRAITS = {
    atk: { short: 'ATK', name: 'attack',     what: 'how hard you hit.' },
    def: { short: 'DEF', name: 'defense',    what: 'damage, weather and toxins, shrugged off.' },
    stl: { short: 'STL', name: 'stealth',    what: 'sneaking, stealing, striking unseen.' },
    crf: { short: 'CRF', name: 'crafting',   what: 'making, mending and cooking, better and faster.' },
    ref: { short: 'REF', name: 'reflex',     what: 'dodging, reacting, aim and range.' },
    prs: { short: 'PRS', name: 'persuasion', what: 'bartering, persuading, charming, intimidating.' }
  };

  /* where exp comes from, and which trait it trains. d: what the caller
     knows about the go (a fish's tier, a sale's price). d.trait overrides
     the trait, for sources that train more than one (combat) */
  var SOURCES = {
    fish:   { name: 'fishing',   trait: 'ref', xp: function (d) { return ({ junk: 2, common: 8, uncommon: 15, rare: 35, legendary: 100 })[d.tier] || 5; } },
    cook:   { name: 'cooking',   trait: 'crf', xp: function (d) { return d.kitchen ? 10 : 6; } },
    gather: { name: 'gathering', trait: 'crf', xp: function (d) { return d.perfect ? 6 : 4; } },
    craft:  { name: 'crafting',  trait: 'crf', xp: function (d) { return Math.max(1, Math.floor(+d.xp || 10)); } },
    sell:   { name: 'trading',   trait: 'prs', xp: function (d) { return Math.max(1, Math.floor((+d.price || 0) / 10)); } },
    combat: { name: 'combat',    trait: 'atk', xp: function (d) { return Math.max(1, Math.floor(+d.xp || 15)); } }
  };

  /* the trees. need: the trait level it opens at; after: a perk it needs
     first; cost: points (default 1). draft: a placeholder, shown only with
     the DEV key until it's real. effects are read with has(s, id) wherever
     they apply; none are wired yet */
  var PERKS = {
    brawler:     { trait: 'atk', name: 'brawler',      need: 10, what: 'fists hit 10% harder.', draft: 1 },
    heavyhands:  { trait: 'atk', name: 'heavy hands',  need: 30, after: 'brawler', what: 'a chance to knock them down.', draft: 1 },
    thickskin:   { trait: 'def', name: 'thick skin',   need: 10, what: 'take 10% less damage.', draft: 1 },
    weathered:   { trait: 'def', name: 'weathered',    need: 20, what: 'cold and heat hurt half as much.', draft: 1 },
    antivenom:   { trait: 'def', name: 'antivenom',    need: 40, after: 'thickskin', what: 'poison and venom wear off fast.', draft: 1 },
    lightstep:   { trait: 'stl', name: 'light step',   need: 10, what: 'quieter on your feet.', draft: 1 },
    pickpocket:  { trait: 'stl', name: 'pickpocket',   need: 25, what: 'lift things from pockets.', draft: 1 },
    shadow:      { trait: 'stl', name: 'shadow strike', need: 40, after: 'lightstep', what: 'unseen hits do double.', draft: 1 },
    tinkerer:    { trait: 'crf', name: 'tinkerer',     need: 10, what: 'repairs cost less.', draft: 1 },
    linemender:  { trait: 'crf', name: 'line mender',  need: 20, what: 'rods wear out slower.', draft: 1 },
    headchef:    { trait: 'crf', name: 'head chef',    need: 30, after: 'tinkerer', what: 'cooked food fills you more.', draft: 1 },
    quickhands:  { trait: 'ref', name: 'quick hands',  need: 10, what: 'a wider window on the bite.', draft: 1 },
    sidestep:    { trait: 'ref', name: 'sidestep',     need: 25, what: 'a chance to dodge a hit.', draft: 1 },
    deadeye:     { trait: 'ref', name: 'deadeye',      need: 40, after: 'quickhands', what: 'ranged shots fly truer and further.', draft: 1 },
    haggler:     { trait: 'prs', name: 'haggler',      need: 15, what: 'sell for 10% more.', draft: 1 },
    silver:      { trait: 'prs', name: 'silver tongue', need: 25, what: 'persuade your way past people.', draft: 1 },
    intimidate:  { trait: 'prs', name: 'intimidate',   need: 25, what: 'scare off bandits and bullies.', draft: 1 },
    charm:       { trait: 'prs', name: 'charm',        need: 40, after: 'silver', what: 'they like you. it shows.', draft: 1 }
  };

  /* exp to go from level n to n+1. character: 100, 283, 520 ... trait: 25, 59, 99 ... */
  function need(n) { return Math.round(100 * Math.pow(n, 1.5)); }
  function needT(n) { return Math.round(25 * Math.pow(n, 1.25)); }
  function climb(total, step, cap) {
    var lvl = 1, left = Math.max(0, Math.floor(+total || 0));
    while (lvl < cap && left >= step(lvl)) { left -= step(lvl); lvl++; }
    return { level: lvl, into: left, need: lvl < cap ? step(lvl) : 0, total: Math.max(0, Math.floor(+total || 0)) };
  }
  function info(s) { return climb(s.xp && s.xp.total, need, MAX_LEVEL); }
  function level(s) { return info(s).level; }
  function traitInfo(s, t) { return climb(s.skills && s.skills[t], needT, MAX_TRAIT); }
  function traitLevel(s, t) { return traitInfo(s, t).level; }

  function ready(s) {
    if (!s.xp || typeof s.xp !== 'object') s.xp = { total: 0, by: {} };
    if (!s.xp.by || typeof s.xp.by !== 'object') s.xp.by = {};
    if (!s.skills || typeof s.skills !== 'object') s.skills = {};
    if (!s.core || typeof s.core !== 'object') s.core = { hp: 0, sta: 0, int: 0 };
    if (!s.perks || typeof s.perks !== 'object') s.perks = {};
    /* a run from before traits: its exp so far goes to the traits it came from */
    if (!Object.keys(s.skills).length) Object.keys(s.xp.by).forEach(function (k) { var t = SOURCES[k] && SOURCES[k].trait; if (t) s.skills[t] = (s.skills[t] || 0) + (Math.floor(+s.xp.by[k]) || 0); });
  }

  /* award(s, 'fish', { tier: 'rare' }) → { xp, trait, tlevel, tup, level, up } */
  function award(s, source, d) {
    var src = SOURCES[source];
    if (!src) throw new Error('unknown exp source: ' + source);
    d = d || {};
    var t = d.trait || src.trait;
    if (!TRAITS[t]) throw new Error('unknown trait: ' + t);
    ready(s);
    var n = Math.max(0, Math.floor(src.xp(d))), before = level(s), tb = traitLevel(s, t);
    s.xp.total = Math.max(0, Math.floor(+s.xp.total || 0)) + n;
    s.xp.by[source] = (Math.floor(+s.xp.by[source]) || 0) + n;
    s.skills[t] = (Math.floor(+s.skills[t]) || 0) + n;
    var after = level(s), ta = traitLevel(s, t);
    return { xp: n, trait: t, tlevel: ta, tup: ta - tb, level: after, up: after - before };
  }

  /* ── level-ups: one core pick per level past 1, one perk point per pick ── */
  function picked(s) { var c = s.core || {}, n = 0; Object.keys(c).forEach(function (k) { n += Math.max(0, Math.floor(+c[k] || 0)); }); return n; }
  function picks(s) { return Math.max(0, level(s) - 1 - picked(s)); }
  /* k: hp, sta or int. the new 10 comes filled */
  function pickCore(MF, s, k) {
    ready(s);
    if (!MF.CORE[k] || picks(s) <= 0) return false;
    s.core[k] = (Math.floor(+s.core[k]) || 0) + 1;
    MF.restore(s, k, MF.CORE_STEP);
    return true;
  }
  function spent(s) { var n = 0; Object.keys(s.perks || {}).forEach(function (k) { if (PERKS[k]) n += PERKS[k].cost || 1; }); return n; }
  function points(s) { return Math.max(0, picked(s) - spent(s)); }
  function has(s, id) { return !!(s.perks && s.perks[id]); }
  /* why a perk can't be taken, or '' if it can */
  function blocked(s, id) {
    var p = PERKS[id];
    if (!p) return 'no such perk';
    if (has(s, id)) return 'already yours';
    if (traitLevel(s, p.trait) < p.need) return TRAITS[p.trait].short + ' ' + p.need + ' needed';
    if (p.after && !has(s, p.after)) return 'needs ' + PERKS[p.after].name + ' first';
    if (points(s) < (p.cost || 1)) return 'no perk points';
    return '';
  }
  function take(s, id) { if (blocked(s, id)) return false; ready(s); s.perks[id] = 1; return true; }
  /* a trait's tree, drafts left out unless dev */
  function tree(t, dev) { return Object.keys(PERKS).filter(function (k) { return PERKS[k].trait === t && (dev || !PERKS[k].draft); }); }

  root.MFLevel = { MAX_LEVEL: MAX_LEVEL, MAX_TRAIT: MAX_TRAIT, TRAITS: TRAITS, SOURCES: SOURCES, PERKS: PERKS,
                   need: need, needT: needT, info: info, level: level, traitInfo: traitInfo, traitLevel: traitLevel, award: award,
                   picks: picks, pickCore: pickCore, points: points, has: has, blocked: blocked, take: take, tree: tree, ready: ready };
})(typeof window !== 'undefined' ? window : globalThis);
