/* Teknoa 2D: the people on the street, when it comes to blows. Pure rules,
   no drawing; overworld.js runs the fight and draws the fallen.

   civ:      a passer-by as a fighter, by who they are (world.js KIND_MIX).
             anyone you hit hits back
   lethal:   the chance a knockout is a killing, by what did it (combat.js
             WEAPONS lethal; fists and the baton only ever knock people down)
   pockets:  what a fallen passer-by has on them, yours to take
   downed:   gets up after DOWN_SECS and goes about their day
   dead:     the body stays BODY_SECS; someone new moves in after RESPAWN_SECS,
             at the same spot, once you're not watching. the crowd never
             shrinks for good: each district keeps the number it started with
   fighters: at most MAX_FIGHTERS on the street at once (the chase is the
             costly part, not the crowd)
   preys:    which passers-by a hostile goes for: gangs by their targets and
             never (gangs.js), foes by never (foes.js); a passer-by counts as
             what they look like (an ape a simian, an android AI, the rest
             novan). bystanders: false means they're only after you
   brave:    those who hit back when a hostile goes for them; the rest run,
             anyone within FLEE tiles of a hostile that would go for them

   the siren (s.law): how badly the law wants you, 0 to 5
   commit:   a crime counts only if someone saw it (a passer-by within
             WITNESS tiles). it sets the siren to at least the crime's level,
             and the heat it adds pushes it up a level every HEAT_STEP
   cool:     out of sight of the law the siren winds down, one level per
             COOL[level] seconds (HIDE times faster indoors)
   caught:   at 1-2 you pay the fine for what you did (all you have, if it
             comes to that); at 3+ it's a cell: JAIL[level] real minutes,
             bail to walk out early, weapons taken. nova city's cell is the
             NCPD's; on redrum, hex's hashshashin hold you in the lockup

   enforcers: the NPD in the city, hex's hashshashin on redrum. SQUAD[siren]
             of them on foot, a new one called in every CALL_EVERY seconds
             until the squad is full. they see you within SIGHT tiles (that
             holds the siren). up close they grab: a hit that lands cuffs you
             GRAB of the time. from GUN_AT on they carry guns and shoot from
             RANGE tiles with a clear line. put down by them, you're arrested.
             hitting one is a crime they always see (officer)
   PLACEHOLDER numbers, all of them. */
(function (root) {
  'use strict';
  var CIV = {
    novan:       { name: 'novan',      hp: 22, atk: 4, def: 1, ref: 3, xp: 3, joules: [0, 25] },
    ape:         { name: 'ape',        hp: 34, atk: 7, def: 2, ref: 4, xp: 5, joules: [0, 20] },
    android:     { name: 'android',    hp: 30, atk: 5, def: 4, ref: 5, xp: 5, joules: [5, 40] },
    tweaker:     { name: 'tweaker',    hp: 24, atk: 6, def: 1, ref: 5, xp: 4, joules: [0, 10] },
    hashshashin: { name: 'hashshashin', hp: 32, atk: 8, def: 3, ref: 7, xp: 8, joules: [10, 50] },
    sleeper:     { name: 'stranger',   hp: 28, atk: 6, def: 3, ref: 6, xp: 6, joules: [20, 70] }
  };
  /* what else might be in a pocket: [item, chance] (shops.js FOODS / MEDS) */
  var POCKET = [['water', 0.18], ['bar', 0.12], ['bandage', 0.08], ['electro', 0.06]];
  var DOWN_SECS = 45, BODY_SECS = 180, RESPAWN_SECS = 600, MAX_FIGHTERS = 8;
  var SEEN = { ape: 'simian', android: 'ai' }, BRAVE = { ape: 1, tweaker: 1, hashshashin: 1 }, FLEE = 5;

  /* a passer-by, ready to fight back. level: the district's, never more than one past yours */
  function civ(n, level, rng) {
    rng = rng || Math.random;
    var b = CIV[n.kind] || CIV.novan, lv = Math.max(1, Math.floor(+level || 1)), g = 1 + 0.18 * (lv - 1);
    function st(k) { return Math.max(k === 'def' ? 0 : 1, Math.round(b[k] * g)); }
    var hp = st('hp');
    return { id: 'civ:' + (CIV[n.kind] ? n.kind : 'novan'), sub: '', name: b.name, tier: 'civ', level: lv, hp: hp, max: hp,
             pow: st('atk'), def: st('def'), ref: st('ref'), crit: 0, xp: Math.max(1, Math.round(b.xp * (1 + 0.25 * (lv - 1)))),
             joules: 0, robs: false, drain: 0, gang: '', colour: '', civ: true };
  }
  /* knocked out, or killed: the weapon's lethal share (or a foe's, foes.js lethal) */
  function dies(lethal, rng) { return (rng || Math.random)() < (lethal || 0) ? 'dead' : 'down'; }
  function fall(weapon, rng) { var C = root.MFCombat, w = C && C.WEAPONS[weapon]; return dies(w && w.lethal, rng); }
  /* does this hostile (a combat.js foe) go for this passer-by? */
  function preys(f, n) {
    if (!f || f.civ || !n) return false;
    var seen = SEEN[n.kind] || 'novan', G = root.MFGangs || {}, FO = root.MFFoes;
    if (f.gang) {
      var g = G[f.gang];
      if (!g || g.violent === false || g.bystanders === false || (g.never || []).indexOf(seen) >= 0) return false;
      return g.targets === 'all' || (g.targets || []).indexOf(seen) >= 0;
    }
    var b = FO && FO.FOES[f.id];
    return !!b && b.bystanders !== false && (b.never || []).indexOf(seen) < 0;
  }
  function brave(n) { return !!(n && BRAVE[n.kind]); }

  var CRIMES = {
    assault:  { name: 'assault',            level: 1, heat: 1, fine: 40 },
    theft:    { name: 'theft',              level: 1, heat: 1, fine: 25 },
    knockout: { name: 'aggravated assault', level: 2, heat: 2, fine: 150 },
    murder:   { name: 'murder',             level: 3, heat: 4, fine: 600 },
    officer:  { name: 'assaulting the law', level: 2, heat: 3, fine: 300 }
  };
  var ENFORCERS = {
    npd:         { name: 'NPD officer', hp: 40, atk: 6, def: 4, ref: 6, gun: 9, xp: 10, where: 'city' },
    hashshashin: { name: 'hashshashin', hp: 44, atk: 8, def: 3, ref: 8, gun: 10, xp: 12, where: 'redrum' }
  };
  var SQUAD = [0, 1, 2, 3, 4, 5], SIGHT = 10, RANGE = 6, GUN_AT = 3, GRAB = 0.35, CALL_EVERY = 8, LAW_SPEED = 5.5;
  var HEAT_STEP = 4, WITNESS = 8, COOL = [0, 45, 60, 90, 120, 150], HIDE = 2, MAX_SIREN = 5;
  var JAIL = { 3: { mins: 3, bail: 1500 }, 4: { mins: 5, bail: 4000 }, 5: { mins: 8, bail: 10000 } };
  var JAILS = { city: { room: 'ncpd', cell: { x: 2, y: 1 }, by: 'NCPD' }, redrum: { room: 'lockup', cell: { x: 2, y: 1 }, by: 'HASHSHASHIN' } };
  function fresh() { return { siren: 0, heat: 0, fine: 0, cool: 0, crimes: {}, jail: { until: 0, bail: 0, room: '' } }; }
  function law(s) { if (!s.law || typeof s.law !== 'object') s.law = fresh(); return s.law; }
  /* a crime, if anyone saw it: the siren it leaves you at */
  function commit(s, crime, seen) {
    var c = CRIMES[crime], L = law(s);
    if (!c || !seen) return L.siren;
    L.heat += c.heat; L.fine += c.fine; L.cool = 0;
    L.crimes[crime] = (L.crimes[crime] || 0) + 1;
    L.siren = Math.min(MAX_SIREN, Math.max(L.siren, c.level, Math.ceil(L.heat / HEAT_STEP)));
    return L.siren;
  }
  function clear(L) { L.siren = 0; L.heat = 0; L.fine = 0; L.cool = 0; L.crimes = {}; }
  /* time passing. seen: the law has eyes on you (the siren holds) */
  function cool(s, secs, seen, indoors) {
    var L = law(s);
    if (!L.siren) return 0;
    if (seen) { L.cool = 0; return L.siren; }
    L.cool += Math.max(0, +secs || 0) * (indoors ? HIDE : 1);
    if (L.cool >= COOL[L.siren]) { L.cool = 0; L.siren--; if (!L.siren) clear(L); }
    return L.siren;
  }
  /* caught, by the law of `where` (city or redrum) at time `now` (ms) */
  function caught(s, MF, where, now) {
    var L = law(s), lv = L.siren, out = { level: lv, fine: 0, owed: 0, jail: null, took: {}, crimes: L.crimes };
    if (!lv) return out;
    if (lv < 3) {
      out.fine = Math.min(MF.joules(s), L.fine); out.owed = L.fine - out.fine;
      MF.spend(s, out.fine);
    } else {
      var C = root.MFCombat, j = JAIL[lv], at = JAILS[where] || JAILS.city;
      if (!s.items) s.items = {};
      Object.keys(C ? C.WEAPONS : {}).forEach(function (k) { if (C.isWeapon(k) && s.items[k]) { out.took[k] = s.items[k]; delete s.items[k]; if (s.wear) delete s.wear[k]; } });
      s.equip = '';
      L.jail = { until: now + j.mins * 60000, bail: Math.max(j.bail, L.fine * 2), room: at.room };
      out.jail = L.jail;
    }
    clear(L);
    return out;
  }
  function jailed(s, now) { var j = law(s).jail; return j && j.room && j.until > now ? j : null; }
  /* the sentence is up (or never was): out you go */
  function served(s, now) { var j = law(s).jail; return !!(j && j.room && j.until <= now); }
  function bail(s, MF, now) {
    var j = jailed(s, now);
    if (!j) return { ok: false, why: 'you\'re free to go' };
    if (!MF.spend(s, j.bail)) return { ok: false, why: 'bail is ' + MF.fmtJ(j.bail) };
    j.until = 0;
    return { ok: true };
  }
  function release(s) { law(s).jail = { until: 0, bail: 0, room: '' }; }
  /* who answers the siren here, and one of them, ready: tougher the higher it is */
  function force(where) { return where === 'redrum' ? 'hashshashin' : 'npd'; }
  function enforcer(where, siren) {
    var k = force(where), b = ENFORCERS[k], lv = Math.max(1, Math.min(MAX_SIREN, Math.floor(+siren || 1))), g = 1 + 0.2 * (lv - 1);
    var hp = Math.round(b.hp * g);
    return { id: 'law:' + k, sub: '', name: b.name, tier: 'law', level: lv, hp: hp, max: hp, pow: Math.round(b.atk * g), gun: Math.round(b.gun * g),
             def: Math.round(b.def * g), ref: Math.round(b.ref * g), crit: 0, xp: Math.round(b.xp * g), joules: 0, robs: false, drain: 0,
             gang: '', colour: '', lethal: lv >= GUN_AT ? 0.5 : 0, law: k, armed: lv >= GUN_AT };
  }
  /* a straight line between two tiles with nothing solid in between (solid(x, y)) */
  function clearShot(solid, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx - dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      var e2 = 2 * e;
      if (e2 > -dy) { e -= dy; x += sx; }
      if (e2 < dx) { e += dx; y += sy; }
      if ((x !== x1 || y !== y1) && solid(x, y)) return false;
    }
    return true;
  }
  /* a save's s.law, whatever state it's in */
  function tidy(o) {
    var L = fresh(), n = function (v, top) { v = Math.floor(+v || 0); return Math.max(0, Math.min(top, v)); };
    if (!o || typeof o !== 'object') return L;
    L.siren = n(o.siren, MAX_SIREN); L.heat = n(o.heat, 999); L.fine = n(o.fine, 1e6); L.cool = Math.max(0, +o.cool || 0);
    Object.keys(CRIMES).forEach(function (k) { if (o.crimes && o.crimes[k] > 0) L.crimes[k] = n(o.crimes[k], 999); });
    var j = o.jail;
    if (j && typeof j === 'object' && typeof j.room === 'string' && (j.room === JAILS.city.room || j.room === JAILS.redrum.room)) L.jail = { until: Math.max(0, +j.until || 0), bail: n(j.bail, 1e6), room: j.room };
    if (!L.siren) clear(L);
    return L;
  }
  function pockets(n, rng) {
    rng = rng || Math.random;
    var b = CIV[n.kind] || CIV.novan, out = { joules: Math.round(b.joules[0] + rng() * (b.joules[1] - b.joules[0])), items: {} };
    POCKET.forEach(function (p) { if (rng() < p[1]) out.items[p[0]] = 1; });
    return out;
  }
  function empty(p) { return !p || (!p.joules && !Object.keys(p.items).length); }
  /* going through them: everything moves to you, all or nothing on the carry limit */
  function loot(s, MF, p) {
    if (empty(p)) return { ok: false, why: 'nothing on them' };
    if (!s.items) s.items = {};
    var got = { joules: p.joules, items: {} };
    if (p.joules) MF.earn(s, p.joules);
    Object.keys(p.items).forEach(function (k) { s.items[k] = (s.items[k] || 0) + p.items[k]; got.items[k] = p.items[k]; });
    p.joules = 0; p.items = {};
    return { ok: true, got: got };
  }
  /* who could step in as an attacker: only the crowd, never shopkeepers, guards or named people */
  function attackable(n) { return !!(n && n.pool && n.kind && !n.still && !n.store && !n.shop && !n.vend && !n.scene && !n.name); }

  root.MFLaw = { CIV: CIV, POCKET: POCKET, DOWN_SECS: DOWN_SECS, BODY_SECS: BODY_SECS, RESPAWN_SECS: RESPAWN_SECS, MAX_FIGHTERS: MAX_FIGHTERS, SEEN: SEEN, BRAVE: BRAVE, FLEE: FLEE,
                 civ: civ, dies: dies, fall: fall, preys: preys, brave: brave,
                 CRIMES: CRIMES, HEAT_STEP: HEAT_STEP, WITNESS: WITNESS, COOL: COOL, HIDE: HIDE, JAIL: JAIL, JAILS: JAILS,
                 ENFORCERS: ENFORCERS, SQUAD: SQUAD, SIGHT: SIGHT, RANGE: RANGE, GUN_AT: GUN_AT, GRAB: GRAB, CALL_EVERY: CALL_EVERY, LAW_SPEED: LAW_SPEED,
                 force: force, enforcer: enforcer, clearShot: clearShot,
                 law: law, commit: commit, cool: cool, caught: caught, jailed: jailed, served: served, bail: bail, release: release, tidy: tidy, pockets: pockets, empty: empty, loot: loot, attackable: attackable };
})(typeof window !== 'undefined' ? window : globalThis);
