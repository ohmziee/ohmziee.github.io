/* Teknoa 2D: companions. Animals you lure, befriend and keep (COMPANIONS.md).
   Data and save shape only: the lure, the encounter, befriending and the
   animal walking behind you read from here (later steps).

     FAMILIES   land | air | sea: you keep at most one companion of each
     SPECIES    one block per animal. family, name, where it lives (HABITATS),
                its lure item, base stats (rolled a little per animal) and
                the traits its look is mixed from
     HABITATS   where in the wilds an animal can be lured: streets.js zones
                and world.js tiles (near: a tile that must be next to you)
     LURES      item key -> species
     VARIANTS   rare looks, any species, 1 in VARIANT_ODDS

   A companion in the save: { species, name, seed, look, stats }. The seed
   rolls the look and stats once, at befriending; both are then kept as
   rolled, so editing a trait list never changes an animal someone has.
   PLACEHOLDER: base stats are empty until Oms designs them (step 8); the
   chicken and banana lures have no item yet (step 2). */
(function (root) {
  'use strict';
  var FAMILIES = ['land', 'air', 'sea'];

  var HABITATS = {
    beach: { name: 'the beaches and coves', zones: ['wilds', 'deep'], tiles: ['SAND'] },
    bush:  { name: 'the open bush by the landing camps', zones: ['wilds'], tiles: ['GRASS', 'GROUND'] },
    grove: { name: 'the palm groves inland', zones: ['deep'], tiles: ['GRASS', 'GROUND'], near: 'TREE' }
  };

  /* colour traits are name: hex (for drawing), shape traits a plain list */
  var SPECIES = {
    cat: {
      family: 'land', name: 'cat', habitat: 'beach', lure: 'tuna', base: {},
      traits: {
        coat:    { black: '#1c1b22', white: '#ecebe6', grey: '#8a8d96', ginger: '#d9822b', cream: '#e8cf9e', brown: '#6b4a32', smoke: '#4d4f5c' },
        pattern: ['solid', 'tabby', 'tuxedo', 'calico', 'spotted', 'pointed'],
        eyes:    { green: '#5fbf4a', gold: '#e2b33c', blue: '#5aa6e6', copper: '#c46a2c', odd: '#5aa6e6' },
        ears:    ['pointed', 'folded', 'tufted'],
        tail:    ['long', 'bobbed', 'fluffy']
      }
    },
    dog: {
      family: 'land', name: 'dog', habitat: 'bush', lure: 'chicken', base: {},
      traits: {
        coat:    { black: '#1f1d1d', brown: '#6e4527', tan: '#c49a62', white: '#eeeae2', grey: '#8b8b8b', red: '#a8462a', brindle: '#5e4630' },
        pattern: ['solid', 'patched', 'saddle', 'merle', 'spotted'],
        eyes:    { brown: '#5a3820', amber: '#d18f2e', blue: '#6aa8e0', odd: '#6aa8e0' },
        ears:    ['floppy', 'pricked', 'half'],
        tail:    ['curled', 'long', 'docked', 'plumed'],
        size:    ['small', 'medium', 'large']
      }
    },
    monkey: {
      family: 'land', name: 'monkey', habitat: 'grove', lure: 'banana', base: {},
      traits: {
        coat:    { brown: '#6a4a30', grey: '#8f8b84', golden: '#d6a64a', black: '#22201e', russet: '#9a4b2c', white: '#e9e5dc' },
        face:    { pink: '#e2a3a0', black: '#2a2624', grey: '#8d8a88', tan: '#c99d72' },
        pattern: ['solid', 'capped', 'masked', 'pale-bellied'],
        eyes:    { brown: '#4f3420', amber: '#c98a2c', hazel: '#8a7a3a' },
        tail:    ['long', 'ringed', 'curled']
      }
    }
  };

  var LURES = {};
  Object.keys(SPECIES).forEach(function (k) { LURES[SPECIES[k].lure] = k; });

  /* rare looks: neon picks one of its hues */
  var VARIANT_ODDS = 50;
  var VARIANTS = {
    neon:      { name: 'neon', what: 'its coat glows at night, like the signs over the city.', hues: ['#ff3fd8', '#3ff2ff', '#b6ff3f', '#ffb13f'] },
    chrome:    { name: 'chrome', what: 'patches of it are plated in metal. something the labs dropped, maybe.' },
    glow:      { name: 'glow', what: 'spots on it glow soft green, like naturia at night.' },
    starspawn: { name: 'starspawn', what: 'its coat holds a whole night sky.' }
  };

  /* stats roll up to STAT_ROLL above or below the species' base */
  var STAT_ROLL = 0.15;
  var NAME_MAX = 16;

  /* a small seeded generator: the same seed is always the same animal */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(list, r) { return list[Math.floor(r() * list.length)]; }
  function newSeed() { return Math.floor(Math.random() * 4294967295) + 1; }

  function rollLook(species, seed) {
    var sp = SPECIES[species], r = rng(seed), look = {};
    Object.keys(sp.traits).forEach(function (t) {
      var tr = sp.traits[t]; look[t] = pick(Array.isArray(tr) ? tr : Object.keys(tr), r);
    });
    if (r() < 1 / VARIANT_ODDS) {
      look.variant = pick(Object.keys(VARIANTS), r);
      if (VARIANTS[look.variant].hues) look.hue = pick(VARIANTS[look.variant].hues, r);
    }
    return look;
  }
  function rollStats(base, seed) {
    var r = rng((seed ^ 0x9E3779B9) >>> 0), out = {};
    Object.keys(base || {}).sort().forEach(function (k) { out[k] = Math.max(1, Math.round(base[k] * (1 + (r() * 2 - 1) * STAT_ROLL))); });
    return out;
  }
  function cleanName(raw, species) {
    var n = String(raw || '').replace(/[^A-Za-z0-9 '.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
    return n || (SPECIES[species] ? SPECIES[species].name : 'friend');
  }

  /* a new companion, rolled from its seed (a fresh one if none is given) */
  function make(species, name, seed) {
    if (!SPECIES[species]) return null;
    seed = (seed >>> 0) || newSeed();
    return { species: species, name: cleanName(name, species), seed: seed, look: rollLook(species, seed), stats: rollStats(SPECIES[species].base, seed) };
  }
  function familyOf(species) { return SPECIES[species] ? SPECIES[species].family : ''; }
  function lureFor(item) { return LURES[item] || ''; }

  /* "a ginger tabby cat, green eyes" (+ its rare look) */
  function describe(p) {
    var sp = SPECIES[p.species], l = p.look || {};
    var bits = [l.coat, l.pattern && l.pattern !== 'solid' ? l.pattern : '', sp ? sp.name : p.species].filter(Boolean).join(' ');
    var s = (/^[aeiou]/.test(bits) ? 'an ' : 'a ') + bits + (l.eyes ? ', ' + l.eyes + ' eyes' : '');
    return l.variant ? s + ', ' + VARIANTS[l.variant].name : s;
  }

  /* ── in the save: s.pets = { land, air, sea }, each a companion or null ── */
  function pets(s) { if (!s.pets || typeof s.pets !== 'object') s.pets = tidy(null); return s.pets; }
  function companion(s, family) { return pets(s)[family] || null; }
  /* whoever would have to go if this species were befriended (ask first) */
  function inTheWay(s, species) { return companion(s, familyOf(species)); }
  /* the new one takes its family's place; the old one, if any, is returned (gone for good) */
  function adopt(s, p) {
    var f = p && familyOf(p.species);
    if (!f) return { ok: false, why: 'not an animal anyone knows' };
    var old = companion(s, f); pets(s)[f] = p;
    return { ok: true, released: old };
  }
  function release(s, family) { var old = companion(s, family); if (old) pets(s)[family] = null; return old; }
  function rename(s, family, name) {
    var p = companion(s, family); if (!p) return { ok: false, why: 'no companion there' };
    p.name = cleanName(name, p.species); return { ok: true, name: p.name };
  }

  /* a save's pets, made safe: an unknown species or broken entry is dropped,
     a missing trait is filled from the seed (traits it doesn't know are kept:
     a newer build may) */
  function tidy(o) {
    var out = { land: null, air: null, sea: null };
    if (!o || typeof o !== 'object') return out;
    FAMILIES.forEach(function (f) {
      var p = o[f];
      if (!p || typeof p !== 'object' || !SPECIES[p.species] || SPECIES[p.species].family !== f) return;
      var seed = (+p.seed >>> 0) || newSeed(), look = p.look && typeof p.look === 'object' ? p.look : {}, fresh = rollLook(p.species, seed), l = {};
      Object.keys(fresh).concat(Object.keys(look)).forEach(function (k) { l[k] = typeof look[k] === 'string' ? look[k] : fresh[k]; });
      if (l.variant && !VARIANTS[l.variant]) { delete l.variant; delete l.hue; }
      var st = {}; Object.keys(p.stats && typeof p.stats === 'object' ? p.stats : {}).forEach(function (k) { var n = Math.floor(+p.stats[k] || 0); if (n > 0) st[k] = n; });
      out[f] = { species: p.species, name: cleanName(p.name, p.species), seed: seed, look: l, stats: st };
    });
    return out;
  }
  /* the lure in use (step 3): which item, for which animal, until when */
  function tidyLure(o) {
    o = o && typeof o === 'object' ? o : {};
    var sp = LURES[o.item] && LURES[o.item] === o.species ? o.species : '';
    return { item: sp ? o.item : '', species: sp, until: sp ? Math.max(0, +o.until || 0) : 0 };
  }

  root.MFCompanions = { FAMILIES: FAMILIES, HABITATS: HABITATS, SPECIES: SPECIES, LURES: LURES, VARIANTS: VARIANTS, VARIANT_ODDS: VARIANT_ODDS,
                        STAT_ROLL: STAT_ROLL, NAME_MAX: NAME_MAX, rng: rng, rollLook: rollLook, rollStats: rollStats, cleanName: cleanName,
                        make: make, familyOf: familyOf, lureFor: lureFor, describe: describe, companion: companion, inTheWay: inTheWay,
                        adopt: adopt, release: release, rename: rename, tidy: tidy, tidyLure: tidyLure };
})(typeof window !== 'undefined' ? window : globalThis);
