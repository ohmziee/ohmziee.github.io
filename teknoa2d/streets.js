/* Teknoa 2D: who comes for you out there, and how often. Pure rules, no
   drawing; overworld.js walks the foes about and draws them.

   zone:   city (any district), wilds (vistadelsol, the coast you sail to),
           deep (vistadelsol, far from any landing camp), or '' (indoors, at sea)
   check:  every CHECK[zone] seconds, a CHANCE[zone] (more at night) that
           someone turns up, if fewer than MAX[zone] are already after you
   who:    in a district, its gangs (gangs.js turf) half the time, else the
           city's foes; past the city, whoever walks there at this hour
           (foes.js where / when). anyone combat.js hostile() says leaves
           you be is never picked
   level:  DANGER[zone] (foes.js). in the city never more than one over your
           own level, so a new arrival on redrum isn't flattened on day one;
           past the city there's no such mercy: that's the point of the wilds
   PLACEHOLDER rates, all of them. */
(function (root) {
  'use strict';
  var CHECK = { city: 20, wilds: 8, deep: 6 };
  var CHANCE = { city: [0.12, 0.22], wilds: [0.35, 0.6], deep: [0.5, 0.8] };   /* [day, night] */
  var MAX = { city: 1, wilds: 2, deep: 3 };
  var QUIET = { haven: 0.5 };                                                     /* the government district: half as often */
  var DEEP_AT = 20;                                                               /* tiles from the nearest landing */
  var GANG_SHARE = 0.5;

  function zone(world, x, y, inside, sailing) {
    if (inside || sailing) return '';
    var d = world.dist[y * world.W + x];
    if (d !== -2) return 'city';
    var near = (world.landings || []).some(function (l) { return Math.abs(l.x - x) + Math.abs(l.y - y) <= DEEP_AT; });
    return near ? 'wilds' : 'deep';
  }
  function isNight(dark) { return dark > 0.5; }
  /* does someone turn up this check? */
  function roll(zn, district, dark, alive, rng) {
    if (!zn || alive >= MAX[zn]) return false;
    return rng() < CHANCE[zn][isNight(dark) ? 1 : 0] * (QUIET[district] || 1);
  }
  /* who, and at what level: { id, sub, level } or null when nobody fits */
  function pick(ctx, rng) {
    var s = ctx.s, MF = ctx.MF, A = ctx.A, C = root.MFCombat, FO = root.MFFoes, GA = root.MFGangs || {};
    var night = isNight(ctx.dark), zn = ctx.zone, want = [];
    if (zn === 'city' && ctx.district) {
      var gangs = Object.keys(GA).filter(function (g) { return GA[g].turf.indexOf(ctx.district) >= 0 && C.hostile({ id: 'gang:' + g }, s, MF, A); });
      if (gangs.length && rng() < GANG_SHARE) want = gangs.map(function (g) { return 'gang:' + g; });
    }
    if (!want.length) want = Object.keys(FO.FOES).filter(function (id) {
      var f = FO.FOES[id];
      return f.tier === 'unnamed' && f.where.indexOf(zn) >= 0 && (f.when === 'any' || (f.when === 'night') === night) && C.hostile({ id: id }, s, MF, A);
    });
    if (!want.length) return null;
    var id = want[Math.floor(rng() * want.length)], band = FO.DANGER[zn], hi = band[1];
    if (zn === 'city') hi = Math.max(band[0], Math.min(hi, (ctx.level || 1) + 1));
    /* in the city the level is final: a strong gang's members still hit
       harder (foes.js THREAT mult), they just don't come up levels past the cap */
    return { id: id, sub: '', level: band[0] + Math.floor(rng() * (hi - band[0] + 1)), exact: zn === 'city' };
  }
  root.MFStreets = { CHECK: CHECK, CHANCE: CHANCE, MAX: MAX, QUIET: QUIET, DEEP_AT: DEEP_AT, zone: zone, roll: roll, pick: pick, isNight: isNight };
})(typeof window !== 'undefined' ? window : globalThis);
