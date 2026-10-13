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
    return { v: VERSION, scene: null, beat: 0, player: { handle: '', origin: '', look: {} },
             flags: {}, items: {}, traits: {}, aff: {}, met: {}, seen: {},
             world: { x: -1, y: -1, d: 'down' },            /* where they stand in nova city (in: the apartment they're inside) */
             homes: {}, wake: '',                            /* the apartments they hold keys to; the one whose bed they last slept in */
             res: {}, boat: 0, gathered: { day: '', got: {} },  /* materials in hand, the boat, the piles picked up today */
             fishlog: {},                                    /* every kind of fish ever caught, and how many */
             wear: {},                                       /* uses left in each rod */
             dev: {},                                        /* the owner's test switches (ui.js DEV drawer) */
             lotto: [],                                      /* tickets waiting on their draw: { day, nums, house } */
             body: { food: 100, drink: 100, buff: '', buffT: 0 },  /* hunger and thirst (100 = full), a dish's perk and its seconds left */
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
    s.joules = joules(s) - n; return true;
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
    Object.keys(s.wear).forEach(function (k) { var n = Math.floor(+s.wear[k] || 0); if (n > 0) s.wear[k] = n; else delete s.wear[k]; });
    var b = s.body, num = function (v, d) { v = +v; return isFinite(v) ? Math.max(0, Math.min(100, v)) : d; };
    s.body = { food: num(b.food, 100), drink: num(b.drink, 100), buff: typeof b.buff === 'string' ? b.buff : '', buffT: Math.max(0, +b.buffT || 0) };
    s.lotto = (Array.isArray(s.lotto) ? s.lotto : []).filter(function (t) { return t && typeof t.day === 'string' && Array.isArray(t.nums) && t.nums.length === 3; }).slice(-50);
    var p = s.player;
    s.player = { handle: cleanHandle(p.handle), origin: typeof p.origin === 'string' ? p.origin : '',
                 look: p.look && typeof p.look === 'object' ? p.look : {} };
    return s;
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
  function drain(s, secs, factor) {
    var b = s.body, f = (factor || 1) * Math.max(0, +secs || 0);
    b.food = Math.max(0, b.food - 100 * f / FOOD_SECS);
    b.drink = Math.max(0, b.drink - 100 * f / DRINK_SECS);
    if (b.buffT > 0) { b.buffT = Math.max(0, b.buffT - (+secs || 0)); if (!b.buffT) b.buff = ''; }
    return b.food <= 0 || b.drink <= 0 ? 'faint' : weak(s) ? 'weak' : '';
  }
  function weak(s) { return s.body.food < WEAK || s.body.drink < WEAK; }
  /* after a faint: back on your feet, not full */
  function revive(s) { s.body.food = Math.max(s.body.food, WAKE); s.body.drink = Math.max(s.body.drink, WAKE); s.body.buff = ''; s.body.buffT = 0; }
  /* eating or drinking: food/drink points, and maybe a perk for some seconds */
  function consume(s, food, drink, buff, secs) {
    s.body.food = Math.min(100, s.body.food + (food || 0));
    s.body.drink = Math.min(100, s.body.drink + (drink || 0));
    if (buff) { s.body.buff = buff; s.body.buffT = secs || 300; }
    return s.body;
  }
  function buff(s, name) { return s.body.buff === name && s.body.buffT > 0; }

  root.MF = { VERSION: VERSION, SAVE_KEY: SAVE_KEY, newState: newState, test: test, apply: apply,
              FOOD_SECS: FOOD_SECS, DRINK_SECS: DRINK_SECS, WEAK: WEAK, WAKE: WAKE, drain: drain, weak: weak, revive: revive, consume: consume, buff: buff,
              START_JOULES: START_JOULES, joules: joules, earn: earn, spend: spend, fmtJ: fmtJ,
              cleanHandle: cleanHandle, chippedIn: chippedIn, answer: answer, normalAnswer: normalAnswer,
              enter: enter, view: view, next: next, choose: choose,
              exportCode: exportCode, importCode: importCode, save: save, load: load, wipe: wipe };
})(typeof window !== 'undefined' ? window : globalThis);
