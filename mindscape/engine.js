/* EXiLED mindscape — the rules. No DOM in here: ui.js draws, this decides.
   The same file runs in the browser and under node for the tests.

   State is one plain object, saved whole. Scenes come from scenes.js,
   compiled from mindscape/content/*.scene by mindscape/build.mjs.

   A scene: { id, beats: [...], choices: [...], ask, go }
     ask     { seal, ok, no }      a typed answer checked against a wiki seal
     beat    { who, mood, text }   a line of dialogue (who) or narration (no who)
             { fx: [...] }         effects applied when the beat is reached
     choice  { text, to, when: [...], fx: [...] }
     go      the scene to run when the beats end and there are no choices

   conditions  flag:x  item:x  trait:x  origin:x  met:x  aff:hex>=3   (! in front negates)
   effects     flag x  unflag x  give x  take x  trait x  aff hex +2  meet hex */
(function (root) {
  var VERSION = 1;
  var SAVE_KEY = 'exiled.mf.save';

  function newState() {
    return { v: VERSION, scene: null, beat: 0, player: { handle: '', origin: '', look: {} },
             flags: {}, items: {}, traits: {}, aff: {}, met: {}, seen: {},
             world: { x: -1, y: -1, d: 'down' } };          /* where they stand in nova city */
  }

  /* ── conditions ─────────────────────────────────────────── */
  var AFF = /^aff:([a-z0-9-]+)(>=|<=|>|<|=)(-?\d+)$/;
  function test(s, cond) {
    var neg = cond.charAt(0) === '!', c = neg ? cond.slice(1) : cond, ok;
    var m = AFF.exec(c);
    if (m) {
      var v = s.aff[m[1]] || 0, n = +m[3];
      ok = m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : m[2] === '<' ? v < n : v === n;
    } else {
      var i = c.indexOf(':'), kind = c.slice(0, i), name = c.slice(i + 1);
      if (kind === 'flag') ok = !!s.flags[name];
      else if (kind === 'item') ok = !!s.items[name];
      else if (kind === 'trait') ok = !!s.traits[name];
      else if (kind === 'met') ok = !!s.met[name];
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
    if (!o || typeof o !== 'object' || o.v !== VERSION) throw new Error('not a mindscape save');
    for (var k in s) if (k !== 'scene' && o[k] !== undefined && o[k] !== null && typeof o[k] === typeof s[k]) s[k] = o[k];
    if (typeof o.scene === 'string') s.scene = o.scene;     /* a string, or null once a run has ended */
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

  root.MF = { VERSION: VERSION, SAVE_KEY: SAVE_KEY, newState: newState, test: test, apply: apply,
              cleanHandle: cleanHandle, chippedIn: chippedIn, answer: answer, normalAnswer: normalAnswer,
              enter: enter, view: view, next: next, choose: choose,
              exportCode: exportCode, importCode: importCode, save: save, load: load, wipe: wipe };
})(typeof window !== 'undefined' ? window : globalThis);
