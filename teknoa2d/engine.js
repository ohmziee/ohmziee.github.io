/* EXiLED teknoa 2d — the rules. No DOM in here: ui.js draws, this decides.
   The same file runs in the browser and under node for the tests.

   State is one plain object, saved whole. Scenes come from scenes.js,
   compiled from teknoa2d/content/*.scene by teknoa2d/build.mjs.

   A scene: { id, beats: [...], choices: [...], ask, go }
     ask     { seal, ok, no }      a typed answer checked against a wiki seal
     beat    { who, mood, text }   a line of dialogue (who) or narration (no who)
             { fx: [...] }         effects applied when the beat is reached
     choice  { text, to, when: [...], fx: [...] }
     go      the scene to run when the beats end and there are no choices

   conditions  flag:x  item:x  trait:x  origin:x  met:x  home:x  aff:hex>=3  joules>=50   (! in front negates)
   effects     flag x  unflag x  give x  take x  trait x  aff hex +2  meet hex  pay 25  charge 25  home redrum

   Money is the Teknoan Joule, the official currency of Teknoa, written ⚡. */
(function (root) {
  var VERSION = 1;
  var SAVE_KEY = 'exiled.mf.save';

  function newState() {
    return { v: VERSION, scene: null, beat: 0, player: { handle: '', origin: '', look: {}, power: '', side: '' },
             flags: {}, items: {}, traits: {}, aff: {}, met: {}, seen: {},
             world: { x: -1, y: -1, d: 'down' },            /* where they stand in nova city (in: the apartment they're inside) */
             homes: {}, wake: '',                            /* the apartments they hold keys to; the one whose bed they last slept in */
             res: {}, boat: 0, gathered: { day: '', got: {} },  /* materials in hand, the boat, the piles picked up today */
             fishlog: {},                                    /* every kind of fish ever caught, and how many */
             wear: {},                                       /* uses left in each rod */
             torch: 0,                                       /* seconds of flashlight battery left */
             safe: [],                                       /* the inventory's safe slots: item kinds a mugger can't take */
             equip: '',                                      /* the weapon in hand (combat.js WEAPONS); '' is fists */
             dev: {},                                        /* the owner's test switches (ui.js DEV drawer) */
             stash: {}, hold: { items: {}, res: {} },        /* each apartment's chest, the boat's hold */
             treasury: { week: -1, spent: 0, arrears: 0 },   /* the nova city week last billed, joules spent since, unpaid tax */
             inbox: [],                                      /* letters on the phone: { id, from, day, title, body, read } */
             lotto: [],                                      /* tickets waiting on their draw: { day, nums, house } */
             body: { food: 100, drink: 100, health: 100, sta: 100, int: 100, buff: '', buffT: 0, rested: -1 },  /* hunger, thirst, health, stamina, intelligence, a dish's perk and its seconds left, the nova day you last slept */
             core: { hp: 0, sta: 0, int: 0 },                /* level-up picks: each one raises that maximum by CORE_STEP */
             xp: { total: 0, by: {} },                       /* experience, and how much came from each source (level.js) */
             skills: {},                                     /* exp in each trait: atk, def, stl ... (level.js TRAITS) */
             perks: {},                                      /* perks taken from the trait trees (level.js PERKS) */
             joules: 0, found: { day: '', got: {} } };       /* ⚡ in hand; the loose joules picked up today */
  }

  /* ── joules ──────────────────────────────────────────────── */
  var START_JOULES = 100, MAX_JOULES = 999999;
  function joules(s) { var n = Math.floor(+s.joules || 0); return n > 0 ? Math.min(n, MAX_JOULES) : 0; }
  function earn(s, n) { s.joules = Math.min(MAX_JOULES, joules(s) + Math.max(0, Math.floor(+n || 0))); return s.joules; }
  /* all or nothing: false, and nothing taken, if they cannot cover it */
  function spend(s, n) {
    n = Math.max(0, Math.floor(+n || 0));
    if (joules(s) < n) return false;
    s.joules = joules(s) - n;
    if (s.treasury) s.treasury.spent = (s.treasury.spent || 0) + n;   /* for the weekly letter */
    return true;
  }
  function fmtJ(n) { return '⚡' + String(Math.floor(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ── conditions ─────────────────────────────────────────── */
  var AFF = /^aff:([a-z0-9-]+)(>=|<=|>|<|=)(-?\d+)$/, JOU = /^joules(>=|<=|>|<|=)(\d+)$/;
  function test(s, cond) {
    var neg = cond.charAt(0) === '!', c = neg ? cond.slice(1) : cond, ok;
    var m = AFF.exec(c), j = JOU.exec(c);
    if (j) m = [c, '', j[1], j[2]];
    if (m) {
      var v = j ? joules(s) : s.aff[m[1]] || 0, n = +m[3];
      ok = m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : m[2] === '<' ? v < n : v === n;
    } else {
      var i = c.indexOf(':'), kind = c.slice(0, i), name = c.slice(i + 1);
      if (kind === 'flag') ok = !!s.flags[name];
      else if (kind === 'item') ok = !!s.items[name];
      else if (kind === 'trait') ok = !!s.traits[name];
      else if (kind === 'met') ok = !!s.met[name];
      else if (kind === 'home') ok = !!s.homes[name];
      else if (kind === 'origin') ok = s.player.origin === name;
      else throw new Error('unknown condition: ' + cond);
    }
    return neg ? !ok : ok;
  }
  function all(s, conds) {
    for (var i = 0; i < (conds || []).length; i++) if (!test(s, conds[i])) return false;
    return true;
  }

  /* ── effects ────────────────────────────────────────────── */
  function apply(s, fx, now) {
    var p = fx.split(/\s+/), op = p[0], name = p[1];
    if (op === 'flag') s.flags[name] = 1;
    else if (op === 'unflag') delete s.flags[name];
    else if (op === 'give') s.items[name] = (s.items[name] || 0) + 1;
    else if (op === 'take') { if (s.items[name] > 1) s.items[name]--; else delete s.items[name]; }
    else if (op === 'trait') s.traits[name] = 1;
    else if (op === 'aff') s.aff[name] = Math.max(-10, Math.min(10, (s.aff[name] || 0) + (+p[2] || 0)));
    /* meeting someone is the hook the wiki's per-character seal hangs on
       (phase 4): the date is what the entry's stamp will show */
    else if (op === 'pay') earn(s, p[1]);
    /* a choice that charges should be gated on joules>=N; if it is not, it
       takes what they have rather than going negative */
    else if (op === 'charge') { if (!spend(s, p[1])) s.joules = 0; }
    else if (op === 'home') s.homes[name] = 1;
    else if (op === 'meet') { if (!s.met[name]) s.met[name] = new Date(now || Date.now()).toISOString().slice(0, 10); }
    else throw new Error('unknown effect: ' + fx);
  }
  function applyAll(s, list, now) { for (var i = 0; i < (list || []).length; i++) apply(s, list[i], now); }

  /* the same handle rules as the live chat and the terminal, so a handle
     carried over from either comes out identical */
  function cleanHandle(raw) {
    return String(raw || '').trim().replace(/\s+/g, '_').replace(/[^\w.-]/g, '').slice(0, 25);
  }
  /* Chippin' In is done once there is a handle and an origin */
  function chippedIn(s) { return !!(s.player.handle && s.player.origin); }

  /* ── text ───────────────────────────────────────────────── */
  function fill(s, text) {
    return String(text).replace(/\$handle\b/g, s.player.handle || 'stranger');
  }

  /* ── running a scene ────────────────────────────────────────
     enter() puts the player at the top of a scene. step() advances one
     beat and returns what to show: a line, the choices, or the end. Effect
     beats are applied and skipped over, never shown. */
  function enter(s, scenes, id) {
    if (!scenes[id]) throw new Error('no such scene: ' + id);
    s.scene = id; s.beat = 0; s.seen[id] = 1;
  }
  function view(s, scenes, now) {
    var sc = scenes[s.scene];
    if (!sc) return { kind: 'end' };
    while (s.beat < sc.beats.length && sc.beats[s.beat].fx) { applyAll(s, sc.beats[s.beat].fx, now); s.beat++; }
    if (s.beat < sc.beats.length) {
      var b = sc.beats[s.beat];
      return { kind: 'line', who: b.who || '', mood: b.mood || '', text: fill(s, b.text) };
    }
    var open = [];
    for (var i = 0; i < sc.choices.length; i++) {
      if (all(s, sc.choices[i].when)) open.push({ index: i, text: fill(s, sc.choices[i].text) });
    }
    if (open.length) return { kind: 'choose', choices: open };
    if (sc.ask) return { kind: 'ask', seal: sc.ask.seal };
    if (sc.go) return { kind: 'go', to: sc.go };
    return { kind: 'end' };
  }
  function next(s) { s.beat++; }
  function choose(s, scenes, index, now) {
    var c = scenes[s.scene] && scenes[s.scene].choices[index];
    if (!c || !all(s, c.when)) throw new Error('that choice is not open');
    applyAll(s, c.fx, now);
    if (c.to) enter(s, scenes, c.to); else { s.scene = null; s.beat = 0; }
  }

  /* a typed answer: the UI checks it against the wiki's seal (it is the
     character's key, so nothing here knows it) and reports back */
  function answer(s, scenes, right) {
    var sc = scenes[s.scene];
    if (!sc || !sc.ask) throw new Error('nothing is being asked');
    enter(s, scenes, right ? sc.ask.ok : sc.ask.no);
  }
  /* how a typed answer is read: case, spacing and punctuation never matter */
  function normalAnswer(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* ── saves ──────────────────────────────────────────────────
     localStorage holds the live run. The save code is the same state as
     text, so a run can move between devices without an account. The
     checksum catches a mangled paste, not a determined editor: it is a
     game, and editing your own save is allowed. */
  function sum(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function b64e(t) { return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, 'utf8').toString('base64'); }
  function b64d(t) { return typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8'); }
  function clean(o) {
    var s = newState();
    if (!o || typeof o !== 'object' || o.v !== VERSION) throw new Error('not a teknoa 2d save');
    for (var k in s) if (k !== 'scene' && o[k] !== undefined && o[k] !== null && typeof o[k] === typeof s[k]) s[k] = o[k];
    if (typeof o.scene === 'string') s.scene = o.scene;     /* a string, or null once a run has ended */
    s.joules = joules(s);
    /* a run from before money existed gets the purse a new arrival gets */
    if (o.joules === undefined && o.player && o.player.handle && o.player.origin) s.joules = START_JOULES;
    if (!s.found || typeof s.found.day !== 'string' || !s.found.got || typeof s.found.got !== 'object') s.found = { day: '', got: {} };
    if (!s.gathered || typeof s.gathered.day !== 'string' || !s.gathered.got || typeof s.gathered.got !== 'object') s.gathered = { day: '', got: {} };
    Object.keys(s.res).forEach(function (k) { var n = Math.floor(+s.res[k] || 0); if (n > 0) s.res[k] = Math.min(n, 9999); else delete s.res[k]; });
    s.boat = s.boat ? 1 : 0;
    s.torch = Math.max(0, Math.min(3600, +s.torch || 0));
    s.safe = s.safe.filter(function (k, i, a) { return typeof k === 'string' && k && a.indexOf(k) === i; }).slice(0, SAFE_SLOTS);
    var tr = s.treasury;
    s.treasury = { week: Math.floor(+tr.week) >= -1 ? Math.floor(+tr.week) : -1, spent: Math.max(0, Math.floor(+tr.spent || 0)), arrears: Math.max(0, Math.floor(+tr.arrears || 0)) };
    s.inbox = (Array.isArray(s.inbox) ? s.inbox : []).filter(function (m) { return m && typeof m.title === 'string' && typeof m.body === 'string'; }).slice(-40);
    function counts(o) { var out = {}; Object.keys(o && typeof o === 'object' ? o : {}).forEach(function (k) { var n = Math.floor(+o[k] || 0); if (n > 0) out[k] = n; }); return out; }
    function box(b) { return { items: counts(b && b.items), res: counts(b && b.res) }; }
    s.hold = box(s.hold);
    Object.keys(s.stash).forEach(function (k) { s.stash[k] = box(s.stash[k]); });
    Object.keys(s.wear).forEach(function (k) { var n = Math.floor(+s.wear[k] || 0); if (n > 0) s.wear[k] = n; else delete s.wear[k]; });
    var co = s.core;
    s.core = {}; Object.keys(CORE).forEach(function (k) { s.core[k] = Math.max(0, Math.min(MAX_PICKS, Math.floor(+co[k] || 0))); });
    var b = s.body, num = function (v, d, top) { v = +v; return isFinite(v) ? Math.max(0, Math.min(top || 100, v)) : d; };
    s.body = { food: num(b.food, 100), drink: num(b.drink, 100), health: num(b.health, maxOf(s, 'hp'), maxOf(s, 'hp')),
               sta: num(b.sta, maxOf(s, 'sta'), maxOf(s, 'sta')), int: num(b.int, maxOf(s, 'int'), maxOf(s, 'int')),
               buff: typeof b.buff === 'string' ? b.buff : '', buffT: Math.max(0, +b.buffT || 0), rested: isFinite(+b.rested) ? Math.floor(+b.rested) : -1 };
    s.skills = counts(s.skills);
    s.perks = {}; Object.keys(o.perks && typeof o.perks === 'object' ? o.perks : {}).forEach(function (k) { if (o.perks[k]) s.perks[k] = 1; });
    /* sources this build doesn't know are kept: a newer build may */
    var xb = s.xp.by && typeof s.xp.by === 'object' ? s.xp.by : {};
    s.xp = { total: Math.max(0, Math.floor(+s.xp.total || 0)), by: counts(xb) };
    s.lotto = (Array.isArray(s.lotto) ? s.lotto : []).filter(function (t) { return t && typeof t.day === 'string' && Array.isArray(t.nums) && t.nums.length === 3; }).slice(-50);
    var p = s.player;
    s.player = { handle: cleanHandle(p.handle), origin: typeof p.origin === 'string' ? p.origin : '',
                 look: p.look && typeof p.look === 'object' ? p.look : {}, power: p.power === 'ibc' || p.power === 'ade' ? p.power : '',
                 /* a product: walked out on corpocult, or still theirs */
                 side: p.side === 'loyal' || p.side === 'defector' ? p.side : '' };
    /* the first four origins were all earthlings from brooklyn: they become
       earthlings and get one chance to pick again (ui.js) */
    if (OLD_ORIGINS[s.player.origin]) { s.player.origin = 'earthling'; s.flags['origin-repick'] = 1; }
    return s;
  }
  /* ── safe slots: SAFE_SLOTS kinds of thing, the whole stack of each, that
     a mugging leaves alone. a slot frees itself once the stack is gone ── */
  var SAFE_SLOTS = 3;
  function held(s, k) { return (s.items && s.items[k] > 0) || (s.res && s.res[k] > 0); }
  function safeKeys(s) { return (s.safe || []).filter(function (k) { return held(s, k); }); }
  function isSafe(s, k) { return safeKeys(s).indexOf(k) >= 0; }
  function toggleSafe(s, k) {
    if (isSafe(s, k)) { s.safe = safeKeys(s).filter(function (x) { return x !== k; }); return { ok: true, safe: false }; }
    if (!held(s, k)) return { ok: false, why: 'you have none of that' };
    if (safeKeys(s).length >= SAFE_SLOTS) return { ok: false, why: 'the safe slots are full' };
    s.safe = safeKeys(s).concat([k]);
    return { ok: true, safe: true };
  }
  function exportCode(s) { var j = JSON.stringify(s); return 'MF1.' + b64e(j) + '.' + sum(j); }
  function importCode(code) {
    var m = /^MF1\.([A-Za-z0-9+/=]+)\.([0-9a-f]{8})$/.exec(String(code).replace(/\s+/g, ''));
    if (!m) throw new Error('not a save code');
    var j = b64d(m[1]);
    if (sum(j) !== m[2]) throw new Error('save code is damaged');
    return clean(JSON.parse(j));
  }
  function save(s, store) { try { store.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function load(store) {
    try { var t = store.getItem(SAVE_KEY); return t ? clean(JSON.parse(t)) : null; } catch (e) { return null; }
  }
  function wipe(store) { try { store.removeItem(SAVE_KEY); } catch (e) {} }

  /* ── hunger and thirst ───────────────────────────────────────
     they drain only while the game is being played (overworld.js calls
     drain with the seconds that passed). running drains faster. under WEAK
     you can't run and the games get harder; at 0 you faint */
  var FOOD_SECS = 45 * 60, DRINK_SECS = 30 * 60, WEAK = 20, WAKE = 40;
  /* temp (°C), if given: heat dries you out, cold makes you hungry */
  function drain(s, secs, factor, temp) {
    var b = s.body, f = (factor || 1) * Math.max(0, +secs || 0), heat = 1, cold = 1, fx = originFx(s), chill = fx.cold ? COLD_AI : 20;
    if (temp !== undefined) { heat = 1 + Math.max(0, temp - 28) * 0.08; cold = 1 + Math.max(0, chill - temp) * 0.06; }
    if (ibc(s)) {
      /* a battery core: one charge, no hunger or thirst, lasts IBC_LASTS times longer */
      b.food = Math.max(0, b.food - 100 * f / (FOOD_SECS * IBC_LASTS)); b.drink = 100;
    } else {
      b.food = Math.max(0, b.food - 100 * f * cold / FOOD_SECS);
      b.drink = Math.max(0, b.drink - 100 * f * heat / DRINK_SECS);
    }
    if (b.buffT > 0) { b.buffT = Math.max(0, b.buffT - (+secs || 0)); if (!b.buffT) b.buff = ''; }
    /* health: starving or parched wears it down, bitter cold or heat too;
       eating well brings it back */
    var mins = Math.max(0, +secs || 0) / 60, hp = b.health === undefined ? 100 : b.health;
    var exposed = temp !== undefined && (temp < (fx.cold ? COLD_AI : 14) || temp > 34);
    if (weak(s)) hp -= 2 * mins;
    if (exposed) hp -= mins;
    else if (!weak(s) && b.food > 60 && b.drink > 60) hp += 3 * mins;
    b.health = Math.max(0, Math.min(maxOf(s, 'hp'), hp));
    /* brainpower: the mind tires slowly while you're up and about */
    b.int = Math.max(0, num0(b.int, maxOf(s, 'int')) - 100 * (+secs || 0) / INT_SECS);
    return b.health <= 0 ? 'collapse' : b.food <= 0 || b.drink <= 0 ? 'faint' : weak(s) ? 'weak' : '';
  }
  function num0(v, d) { return v === undefined || !isFinite(+v) ? d : +v; }
  function hurt(s, n) { s.body.health = Math.max(0, num0(s.body.health, maxOf(s, 'hp')) - n); return s.body.health; }
  function heal(s, n) { s.body.health = Math.min(maxOf(s, 'hp'), num0(s.body.health, maxOf(s, 'hp')) + n); return s.body.health; }

  /* ── origins: where the player comes from (content/origins.scene has the
     words). each can: scale exp (xp), start traits at a level (start),
     shift a vital's maximum (max), add carry kg (carry), shrug off cold
     (cold), discount street food (street), start with more joules
     (joules), offer a power source (power). level.js start() applies
     the one-off parts at Chippin' In ───────────────────────────────── */
  var ORIGINS = {
    earthling: { xp: 1.1 },
    simian:    { start: { atk: 5 }, carry: 15 },
    ai:        { cold: 1, max: { int: 10 }, power: ['ade', 'ibc'] },
    novan:     { start: { stl: 5 }, street: 0.8 },
    product:   { max: { hp: -20 }, joules: 600, side: ['defector', 'loyal'] }
  };
  /* an AI's power: an artificial digestive engine eats like anyone, an
     internal battery core runs on charge (homes, hospital, police) */
  /* a product's side: walked out on corpocult, or still working for them
     against teknoa (combat.js hostile reads it). PLACEHOLDER words */
  var SIDE = { defector: { name: 'walked out', what: 'you left corpocult behind. their agents know a barcode on sight, and they want their property back.' },
               loyal:    { name: 'still theirs', what: 'you work for corpocult, quietly, against teknoa. their agents leave you be. everyone else had better not find out.' } };
  var POWER = { ade: { name: 'artificial digestive engine (ADE)', what: 'you eat and drink like anyone else.' },
                ibc: { name: 'internal battery core (IBC)', what: 'no hunger, no thirst, a charge that lasts. charging points: your home, the hospital, the police.' } };
  var OLD_ORIGINS = { local: 1, runner: 1, defector: 1, ghost: 1 }, COLD_AI = -6, IBC_LASTS = 3;
  function originFx(s) { return ORIGINS[s.player && s.player.origin] || {}; }
  function ibc(s) { return !!(s.player && s.player.origin === 'ai' && s.player.power === 'ibc'); }
  /* where people can tell you come from: an ape or an android body shows,
     earthlings and novans give themselves away the moment they talk, and a
     product passes for human unless the barcode shows (A is MFAvatar) */
  function knownOrigin(s, A) {
    var o = s.player && s.player.origin;
    if (!ORIGINS[o]) return '';
    if (o !== 'product') return o;
    return A && A.stampShows && A.stampShows(s.player.look) ? 'product' : '';
  }

  /* ── the three core vitals. every level-up the player picks one and its
     maximum goes up by CORE_STEP (level.js pickCore) ─────────────────── */
  /* name: the maximum, raised at level-up. pool: what you spend and get back
     (using your mind tires it like running tires the body) */
  var CORE = { hp: { name: 'health', pool: 'health', icon: '♥', key: 'health' }, sta: { name: 'stamina', pool: 'stamina', icon: '💪', key: 'sta' }, int: { name: 'intelligence', pool: 'brainpower', icon: '🧠', key: 'int' } };
  var CORE_BASE = 100, CORE_STEP = 10, MAX_PICKS = 98;
  function maxOf(s, k) { return CORE_BASE + ((originFx(s).max || {})[k] || 0) + CORE_STEP * Math.max(0, Math.floor(+(s.core && s.core[k]) || 0)); }
  function vital(s, k) { return num0(s.body[CORE[k].key], maxOf(s, k)); }
  /* put some back, never past the top */
  function restore(s, k, n) { s.body[CORE[k].key] = Math.max(0, Math.min(maxOf(s, k), vital(s, k) + (+n || 0))); return s.body[CORE[k].key]; }

  /* stamina: sprinting burns it, easing off brings it back. at 0 you're
     winded (overworld.js keeps you walking until it's back to RUN_AGAIN) */
  var STA_RUN = 5, STA_BACK = 2.5, RUN_AGAIN = 25, INT_SECS = 90 * 60;
  function exert(s, secs, running) {
    var t = Math.max(0, +secs || 0), back = weak(s) ? STA_BACK / 2 : STA_BACK;
    return restore(s, 'sta', running ? -STA_RUN * t : back * t);
  }
  /* a physical feat that costs stamina up front: false, and nothing spent, if they can't */
  function strain(s, n) { if (vital(s, 'sta') < n) return false; restore(s, 'sta', -n); return true; }
  /* an intelligence check: a sharp enough mind (intelligence of `need`, `cost`
     brainpower left) skips the minigame and spends `cost` brainpower on it */
  function intCheck(s, need, cost) {
    cost = cost || 0;
    if (maxOf(s, 'int') < need || vital(s, 'int') < cost) return false;
    restore(s, 'int', -cost);
    return true;
  }
  /* a night's sleep: stamina and the mind come back in full */
  function rest(s) { restore(s, 'sta', maxOf(s, 'sta')); restore(s, 'int', maxOf(s, 'int')); }
  function weak(s) { return s.body.food < WEAK || s.body.drink < WEAK; }
  /* after a faint: back on your feet, not full */
  function revive(s) { s.body.food = Math.max(s.body.food, WAKE); s.body.drink = Math.max(s.body.drink, WAKE); s.body.buff = ''; s.body.buffT = 0; }
  /* eating or drinking: food/drink points, and maybe a perk for some seconds.
     mind: intelligence back (caffeine and the like) */
  function consume(s, food, drink, buff, secs, mind) {
    s.body.food = Math.min(100, s.body.food + (food || 0));
    s.body.drink = Math.min(100, s.body.drink + (drink || 0));
    if (mind) restore(s, 'int', mind);
    if (buff) { s.body.buff = buff; s.body.buffT = secs || 300; }
    return s.body;
  }
  function buff(s, name) { return s.body.buff === name && s.body.buffT > 0; }

  /* ── nova city time: one clock for everyone, worked out from real time.
     a day lasts SPEEDUP times less than ours: 2 real hours ───────────── */
  var SPEEDUP = 12, EPOCH = Date.UTC(2026, 0, 1);
  function clock(ms, shiftMins) {
    var mins = Math.floor((ms - EPOCH) * SPEEDUP / 60000) + (shiftMins || 0);
    var day = Math.floor(mins / 1440), m = ((mins % 1440) + 1440) % 1440, hour = Math.floor(m / 60), minute = m % 60;
    var phase = hour >= 21 || hour < 5 ? 'night' : hour < 7 ? 'dawn' : hour < 18 ? 'day' : 'dusk';
    return { mins: mins, day: day, hour: hour, minute: minute, phase: phase, text: ('0' + hour).slice(-2) + ':' + ('0' + minute).slice(-2) };
  }
  /* °C: coolest before dawn, hottest mid-afternoon, a little different each day.
     where: a district id, 'bay', 'jormun', 'indoors' */
  var WHERE_C = { worldwood: 2, naturia: -2, haven: -1, redrum: 1, yucayeque: 1, majinryu: 0, vistadelsol: 0, bay: -4, jormun: -6 };
  function temperature(c, where) {
    var t = c.hour + c.minute / 60, base = 24.5 + 6.5 * Math.sin((t - 9) / 24 * 2 * Math.PI);
    var h = Math.imul(c.day ^ 0x9e3779b9, 2654435761) >>> 0, wobble = (h % 61) / 10 - 3;
    var v = base + wobble + (WHERE_C[where] || 0);
    if (where === 'indoors') v = Math.max(22, Math.min(26, base + wobble));
    return Math.round(v);
  }

  root.MF = { VERSION: VERSION, SAVE_KEY: SAVE_KEY, newState: newState, test: test, apply: apply,
              SPEEDUP: SPEEDUP, clock: clock, temperature: temperature,
              FOOD_SECS: FOOD_SECS, DRINK_SECS: DRINK_SECS, WEAK: WEAK, WAKE: WAKE, drain: drain, weak: weak, revive: revive, consume: consume, buff: buff, hurt: hurt, heal: heal,
              ORIGINS: ORIGINS, POWER: POWER, SIDE: SIDE, COLD_AI: COLD_AI, IBC_LASTS: IBC_LASTS, originFx: originFx, ibc: ibc, knownOrigin: knownOrigin,
              SAFE_SLOTS: SAFE_SLOTS, safeKeys: safeKeys, isSafe: isSafe, toggleSafe: toggleSafe,
              CORE: CORE, CORE_BASE: CORE_BASE, CORE_STEP: CORE_STEP, MAX_PICKS: MAX_PICKS, maxOf: maxOf, vital: vital, restore: restore,
              STA_RUN: STA_RUN, STA_BACK: STA_BACK, RUN_AGAIN: RUN_AGAIN, INT_SECS: INT_SECS, exert: exert, strain: strain, intCheck: intCheck, rest: rest,
              START_JOULES: START_JOULES, joules: joules, earn: earn, spend: spend, fmtJ: fmtJ,
              cleanHandle: cleanHandle, chippedIn: chippedIn, answer: answer, normalAnswer: normalAnswer,
              enter: enter, view: view, next: next, choose: choose,
              exportCode: exportCode, importCode: importCode, save: save, load: load, wipe: wipe };
})(typeof window !== 'undefined' ? window : globalThis);
