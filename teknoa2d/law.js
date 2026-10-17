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
  /* knocked out, or killed: the weapon's lethal share */
  function fall(weapon, rng) {
    var C = root.MFCombat, w = C && C.WEAPONS[weapon];
    return (rng || Math.random)() < ((w && w.lethal) || 0) ? 'dead' : 'down';
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

  root.MFLaw = { CIV: CIV, POCKET: POCKET, DOWN_SECS: DOWN_SECS, BODY_SECS: BODY_SECS, RESPAWN_SECS: RESPAWN_SECS, MAX_FIGHTERS: MAX_FIGHTERS,
                 civ: civ, fall: fall, pockets: pockets, empty: empty, loot: loot, attackable: attackable };
})(typeof window !== 'undefined' ? window : globalThis);
