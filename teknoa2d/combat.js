/* Teknoa 2D: fighting. The maths both kinds of fight share: the street
   (unnamed foes, real time) and the duel (named foes and bosses, turns).
   No drawing here, and no randomness of its own: every roll takes rng, so
   tests can fix the dice.

   A fighter is { pow, def, ref, crit }:
     pow   what a clean hit does before armour
     def   soaks DEF_SOAK of itself off every hit taken
     ref   aim and dodging: each point over theirs is HIT_STEP more to hit,
           and it decides who goes first in a duel
     crit  chance of a hit landing CRIT_MULT harder
   The player's comes from their weapon and their ATK / DEF / REF traits
   (level.js); a foe's from foes.js at its level. PLACEHOLDER numbers. */
(function (root) {
  'use strict';
  var HIT_BASE = 0.8, HIT_STEP = 0.03, HIT_MIN = 0.25, HIT_MAX = 0.97;
  var CRIT_BASE = 0.04, CRIT_REF = 0.005, CRIT_MULT = 1.6, DEF_SOAK = 0.8, SPREAD = 0.15;
  var GROW = 0.18, XP_GROW = 0.25;

  /* ── weapons: wear like rods (s.wear), one use a swing. fists never wear.
     moves: what a duel offers with it. pow scales the hit, acc adds to the
     chance to land it, crit to the crit chance; stun skips their next turn.
     lethal: the chance a knockout on the street is a killing (law.js fall) ── */
  var WEAPONS = {
    fists: { name: 'your fists', what: 'always on you. not much, but never nothing.', dmg: 5, dur: 0, price: 0,
             moves: [{ id: 'jab', name: 'jab', pow: 0.8, acc: 0.1 }, { id: 'haymaker', name: 'haymaker', pow: 1.5, acc: -0.2 }] },
    pipe:  { name: 'a lead pipe', what: 'heavy, honest, rusts in the rain.', dmg: 9, dur: 40, price: 60, lethal: 0.2,
             moves: [{ id: 'swing', name: 'swing', pow: 1 }, { id: 'overhead', name: 'overhead', pow: 1.6, acc: -0.2 }] },
    knife: { name: 'a switchblade', what: 'quick, quiet, finds the soft parts.', dmg: 8, dur: 50, price: 90, crit: 0.08, lethal: 0.45,
             moves: [{ id: 'slash', name: 'slash', pow: 1, acc: 0.05 }, { id: 'stab', name: 'stab', pow: 1.4, acc: -0.1, crit: 0.15 }] },
    bat:   { name: 'a nail bat', what: 'slow. very convincing.', dmg: 11, dur: 35, price: 120, lethal: 0.3,
             moves: [{ id: 'swing', name: 'swing', pow: 1 }, { id: 'homerun', name: 'home run', pow: 1.9, acc: -0.3 }] },
    baton: { name: 'a stun baton', what: 'ncpd surplus. the battery hums.', dmg: 7, dur: 60, price: 180,
             moves: [{ id: 'jab', name: 'jab', pow: 0.9, acc: 0.1 }, { id: 'shock', name: 'shock', pow: 0.7, stun: 0.35 }] }
  };
  function isWeapon(k) { return !!WEAPONS[k] && k !== 'fists'; }
  function usesLeft(s, k) {
    if (!isWeapon(k) || !(s.items && s.items[k])) return 0;
    if (!s.wear) s.wear = {};
    if (!(s.wear[k] > 0)) s.wear[k] = WEAPONS[k].dur;
    return s.wear[k];
  }
  /* what's in your hand: the weapon you equipped, if you still have it */
  function wielded(s) { return isWeapon(s.equip) && s.items && s.items[s.equip] > 0 ? s.equip : 'fists'; }
  function equip(s, k) {
    if (k === 'fists' || !k) { s.equip = ''; return { ok: true, key: 'fists' }; }
    if (!isWeapon(k)) return { ok: false, why: 'that’s not a weapon' };
    if (!(s.items && s.items[k] > 0)) return { ok: false, why: 'you don’t have one' };
    s.equip = k; usesLeft(s, k);
    return { ok: true, key: k };
  }
  /* a swing wears the weapon in your hand; at 0 it breaks and you're on fists */
  function swing(s) {
    var k = wielded(s);
    if (k === 'fists') return { key: k, left: 0, broke: false };
    var left = usesLeft(s, k) - 1;
    if (left > 0) { s.wear[k] = left; return { key: k, left: left, broke: false }; }
    delete s.wear[k];
    s.items[k]--; if (!s.items[k]) { delete s.items[k]; s.equip = ''; }
    return { key: k, left: 0, broke: true };
  }

  /* ── fighters ── */
  function trait(LV, s, t) { return LV ? LV.traitLevel(s, t) : 1; }
  function player(s, LV, key) {
    var k = key || wielded(s), w = WEAPONS[k] || WEAPONS.fists, atk = trait(LV, s, 'atk');
    var pow = w.dmg * (1 + 0.1 * (atk - 1)) + atk;
    if (k === 'fists' && LV && LV.has(s, 'brawler')) pow *= 1.1;
    return { pow: pow, def: trait(LV, s, 'def'), ref: trait(LV, s, 'ref'), crit: w.crit || 0, soak: LV && LV.has(s, 'thickskin') ? 0.9 : 1, weapon: k };
  }
  var F = function () { return root.MFFoes; }, G = function () { return root.MFGangs || {}; };
  /* a foe, ready to fight: foe('bandit', 'bruiser', 3) or foe('gang:intergang', 'enforcer', 2).
     rng picks the sub (when none is given) and what's in their pockets.
     exact: the level is final (a gang's threat doesn't add levels to it) */
  function foe(id, sub, level, rng, exact) {
    rng = rng || Math.random;
    var base, name, gang = null, mult = 1, lv = Math.max(1, Math.floor(+level || 1));
    if (id.indexOf('gang:') === 0) {
      gang = G()[id.slice(5)];
      if (!gang) throw new Error('no such gang: ' + id);
      var th = F().THREAT[gang.threat] || F().THREAT.medium;
      base = F().GANGER; mult = th.mult; if (!exact) lv = Math.max(1, lv + th.lv);
    } else {
      base = F().FOES[id];
      if (!base) throw new Error('no such foe: ' + id);
    }
    var subs = Object.keys(base.subs || {});
    if (!sub || !base.subs[sub]) sub = subs.length ? subs[Math.floor(rng() * subs.length)] : '';
    var d = (base.subs && base.subs[sub]) || {}, g = 1 + GROW * (lv - 1);
    function st(k) { return Math.max(k === 'def' ? 0 : 1, Math.round(((base[k] || 0) + (d[k] || 0)) * mult * g)); }
    name = gang ? gang.one + (d.title ? ' ' + d.title : '') : d.name || base.name;
    var j = base.joules || [0, 0], hp = st('hp');
    return { id: id, sub: sub, name: name, tier: base.tier, level: lv, hp: hp, max: hp,
             pow: st('atk'), def: st('def'), ref: st('ref'), crit: 0,
             xp: Math.max(1, Math.round(((base.xp || 0) + (d.xp || 0)) * (1 + XP_GROW * (lv - 1)))),
             joules: Math.round((j[0] + rng() * (j[1] - j[0])) * (gang ? mult : 1)),
             robs: gang ? !!gang.robs : !!base.robs, drain: base.drain || 0, gang: gang ? id.slice(5) : '', colour: gang ? gang.colour : '' };
  }

  /* ── one blow. a: who swings, b: who takes it, mv: the move (optional) ── */
  function chance(a, b, mv) { return Math.max(HIT_MIN, Math.min(HIT_MAX, HIT_BASE + HIT_STEP * (a.ref - b.ref) + ((mv && mv.acc) || 0))); }
  function strike(a, b, mv, rng) {
    rng = rng || Math.random;
    if (rng() >= chance(a, b, mv)) return { hit: false, crit: false, dmg: 0, stun: false };
    var crit = rng() < CRIT_BASE + CRIT_REF * a.ref + (a.crit || 0) + ((mv && mv.crit) || 0);
    var raw = a.pow * ((mv && mv.pow) || 1) * (1 - SPREAD + 2 * SPREAD * rng()) * (crit ? CRIT_MULT : 1);
    var dmg = Math.max(1, Math.round((raw - DEF_SOAK * b.def) * (b.soak || 1)));
    return { hit: true, crit: crit, dmg: dmg, stun: !!(mv && mv.stun && rng() < mv.stun) };
  }
  /* who moves first in a duel: the quicker reflexes; a tie goes to you */
  function first(p, f) { return p.ref >= f.ref ? 'player' : 'foe'; }

  /* ── who jumps you. seen: the origin they can tell (MF.knownOrigin); a
     product with the barcode covered passes for human ── */
  function seenAs(s, MF, A) { return (MF.knownOrigin && MF.knownOrigin(s, A)) || 'novan'; }
  function hostile(f, s, MF, A) {
    var seen = seenAs(s, MF, A), id = f.id || f;
    if (id.indexOf('gang:') === 0) {
      var g = G()[id.slice(5)];
      if (!g || g.violent === false) return false;
      if ((g.never || []).indexOf(seen) >= 0) return false;
      var any = function (cs) { return (cs || []).some(function (c) { return MF.test(s, c); }); };
      if (any(g.calm) && !any(g.angry)) return false;
      return g.targets === 'all' || (g.targets || []).indexOf(seen) >= 0;
    }
    var base = F().FOES[id];
    if (!base) return false;
    if ((base.never || []).indexOf(seen) >= 0) return false;
    if (base.only && base.only.indexOf(seen) < 0) return false;
    /* corpocult never knowingly hurts its own: a loyal product they can see is
       safe; a defector they can see is a target; one they can't, they don't know */
    if (id === 'agent' && seen === 'product') return s.player.side === 'defector' || !s.player.side;
    return true;
  }

  /* ── losing to someone who robs: every joule, and all you carry except
     what's in a safe slot. keys and the boat stay yours ── */
  function rob(s, MF) {
    var keep = MF.safeKeys(s), took = { joules: MF.joules(s), items: {}, res: {} };
    s.joules = 0;
    ['items', 'res'].forEach(function (b) {
      Object.keys(s[b] || {}).forEach(function (k) {
        if (keep.indexOf(k) >= 0) return;
        took[b][k] = s[b][k]; delete s[b][k];
        if (s.wear) delete s.wear[k];
      });
    });
    if (s.equip && !(s.items[s.equip] > 0)) s.equip = '';
    return took;
  }
  /* winning: their pockets, and exp (combat trains ATK unless a move says otherwise) */
  function reward(s, MF, LV, f, trainT) {
    if (f.joules > 0) MF.earn(s, f.joules);
    var x = LV ? LV.award(s, 'combat', { xp: f.xp, trait: trainT }) : null;
    return { joules: f.joules, xp: x };
  }

  root.MFCombat = { WEAPONS: WEAPONS, HIT_BASE: HIT_BASE, HIT_MIN: HIT_MIN, HIT_MAX: HIT_MAX, CRIT_MULT: CRIT_MULT, DEF_SOAK: DEF_SOAK, GROW: GROW,
                    isWeapon: isWeapon, usesLeft: usesLeft, wielded: wielded, equip: equip, swing: swing,
                    player: player, foe: foe, chance: chance, strike: strike, first: first, hostile: hostile, seenAs: seenAs, rob: rob, reward: reward };
})(typeof window !== 'undefined' ? window : globalThis);
