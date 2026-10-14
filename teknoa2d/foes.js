/* Teknoa 2D: who fights you. combat.js does the maths; this is the table.

   tier     unnamed (jumps you in the street, real time), named (talks, then a
            turn-based duel), boss (rare, a duel with no running)
   hp atk def ref   at level 1; every level past 1 adds GROW of each (combat.js)
   xp       exp for the win at level 1 (also grows)
   joules   [min, max] in their pockets, yours if you win
   robs     a win for them means they take your joules and everything not in a
            safe slot (MF.SAFE_SLOTS)
   where    city | wilds | deep (past the wilds), and when: day | night | any
   never    origins they leave alone (a zombie wants flesh; an android has none)
   subs     variants: a name and what they change (+/- on the base)
   drain    the share of the damage they deal that heals them

   Gang members aren't listed here: each gang in gangs.js fields GANGER, with
   the gang's name, colour and threat. PLACEHOLDER numbers, all of them. */
(function (root) {
  'use strict';
  var FOES = {
    bandit: {
      tier: 'unnamed', name: 'bandit', hp: 28, atk: 5, def: 2, ref: 4, xp: 12, joules: [5, 40], robs: true,
      where: ['city', 'wilds'], when: 'any',
      subs: { lookout: { name: 'bandit lookout', hp: -8, ref: 3, xp: -2 },
              bruiser: { name: 'bandit bruiser', hp: 14, atk: 3, ref: -2, xp: 6 } }
    },
    zombie: {
      tier: 'unnamed', name: 'zombie', hp: 40, atk: 7, def: 1, ref: 1, xp: 18, joules: [0, 5],
      where: ['wilds', 'deep'], when: 'night', never: ['ai'],
      subs: { shambler: { name: 'shambler' },
              runner: { name: 'runner', hp: -10, ref: 5, xp: 4 },
              bloated: { name: 'bloated zombie', hp: 25, atk: 2, ref: -1, xp: 6 } }
    },
    skeleton: {
      tier: 'unnamed', name: 'skeleton', hp: 30, atk: 8, def: 3, ref: 3, xp: 20, joules: [0, 15],
      where: ['wilds', 'deep'], when: 'night',
      subs: { rattler: { name: 'rattler' },
              knight: { name: 'bone knight', hp: 15, def: 4, ref: -1, xp: 10 } }
    },
    rogueai: {
      tier: 'unnamed', name: 'rogue AI', hp: 35, atk: 9, def: 5, ref: 6, xp: 26, joules: [10, 60],
      where: ['wilds', 'deep'], when: 'any',
      subs: { drone: { name: 'rogue drone', hp: -15, ref: 4, xp: -6 },
              hunter: { name: 'hunter-killer', hp: 20, atk: 3, def: 2, xp: 14 } }
    },
    vampire: {
      tier: 'unnamed', name: 'vampire', hp: 45, atk: 10, def: 3, ref: 8, xp: 32, joules: [20, 120], drain: 0.3,
      where: ['city', 'wilds', 'deep'], when: 'night', never: ['ai'],
      subs: { fledgling: { name: 'fledgling', hp: -15, atk: -3, xp: -10 },
              elder: { name: 'elder vampire', hp: 30, atk: 4, def: 2, ref: 2, xp: 30 } }
    },
    werewolf: {
      tier: 'unnamed', name: 'werewolf', hp: 60, atk: 12, def: 3, ref: 7, xp: 38, joules: [0, 10],
      where: ['wilds', 'deep'], when: 'night',
      subs: { stray: { name: 'werewolf' },
              alpha: { name: 'alpha', hp: 30, atk: 4, ref: 1, xp: 24 } }
    },
    /* corpocult's own (the street calls them sleepers). they never knowingly
       touch a loyal product; a defector's barcode is a warrant (combat.js hostile) */
    agent: {
      tier: 'unnamed', name: 'corpocult agent', hp: 34, atk: 8, def: 4, ref: 7, xp: 24, joules: [30, 90],
      where: ['city', 'wilds'], when: 'any',
      subs: { watcher: { name: 'corpocult watcher', hp: -8, ref: 2 },
              cleaner: { name: 'corpocult cleaner', hp: 16, atk: 4, def: 2, xp: 12 } }
    },
    /* ordinary people who saw a corpocult barcode on you and took it personally */
    vigilante: {
      tier: 'unnamed', name: 'vigilante', hp: 26, atk: 5, def: 2, ref: 4, xp: 8, joules: [0, 20],
      where: ['city'], when: 'any', only: ['product'],
      subs: { angry: { name: 'angry local' }, ape: { name: 'angry ape', hp: 10, atk: 2, xp: 2 } }
    }
  };
  /* what every gang member starts from; the gang's threat moves it */
  var GANGER = {
    tier: 'unnamed', hp: 26, atk: 5, def: 2, ref: 4, xp: 12, joules: [5, 30],
    where: ['city'], when: 'any',
    subs: { grunt: { title: '' }, enforcer: { title: 'enforcer', hp: 12, atk: 2, xp: 6 },
            lieutenant: { title: 'lieutenant', hp: 25, atk: 4, def: 2, ref: 1, xp: 14 } }
  };
  var THREAT = { low: { lv: -1, mult: 0.85 }, medium: { lv: 0, mult: 1 }, high: { lv: 2, mult: 1.2 } };
  /* how strong a place makes them: the levels foes come at */
  var DANGER = { city: [1, 4], wilds: [6, 14], deep: [12, 24] };

  root.MFFoes = { FOES: FOES, GANGER: GANGER, THREAT: THREAT, DANGER: DANGER };
})(typeof window !== 'undefined' ? window : globalThis);
