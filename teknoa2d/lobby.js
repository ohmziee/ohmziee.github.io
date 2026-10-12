/* EXiLED teknoa 2d — the shared streets.
   Everyone walking Nova City at the same time sees everyone else, over
   Supabase Realtime (the chat's project). Nothing here touches the run:
   joules, outfits and apartments stay in each browser. Only where you
   stand, which way you face and how you look goes out.

   One channel per district (later, per interior), so a player only hears
   from the island they are on. A step goes out at most twice a second and
   only while walking; standing still costs nothing.

   Names are only drawn when lobby-pass signed them (see
   supabase/functions/_shared/lobby.js). Anything else is "stranger". */
(function (root) {
  var URL_ = 'https://jmksgecmpzrsivujutma.supabase.co';
  var KEY = 'sb_publishable_eu7ES97Ahy_VbVID5BPoTg_LKXSlhHM';
  /* the public half of LOBBY_SIGN_KEY. teknoa2d/lobby_keys.mjs writes it */
  /* PUBKEY */ var PUB = {"kty":"EC","crv":"P-256","x":"TjcCmxMhi7OylZEZqlgL3nBS6PkWk30QTHKNjMIHiYY","y":"Lhf-0O9u76d6EM1ifZzehkhc1VeV6yjtwPC11uFOfhA"}; /* /PUBKEY */
  var SEND_MS = 500, BEAT_MS = 25000, MAX_SHOWN = 40;

  var ws = null, room = '', joinRef = 0, ref = 0, beat = 0, retry = 0, retryT = 0;
  var want = false, sid = '', pass = null, me = null, others = {}, lastSent = 0, sendT = 0, pending = null;
  var pubKey = null, checked = {};

  function hex(n) { var a = new Uint8Array(n), s = ''; root.crypto.getRandomValues(a); for (var i = 0; i < n; i++) s += ('0' + a[i].toString(16)).slice(-2); return s; }
  function topic() { return 'realtime:t2d-' + room; }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  /* ── names ─────────────────────────────────────────────────── */
  function unb64url(s) {
    var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function passText(p) { return 'teknoa|' + p.sid + '|' + p.n + '|' + p.o + '|' + p.exp; }
  /* resolves to the name to draw, '' for a stranger */
  function nameOf(p, who) {
    if (!p || typeof p !== 'object' || p.sid !== who || !(p.exp > Date.now()) || typeof p.n !== 'string' || !p.n) return Promise.resolve('');
    var k = passText(p) + '|' + p.sig;
    if (checked[k] !== undefined) return Promise.resolve(checked[k]);
    if (!pubKey) pubKey = root.crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return pubKey.then(function (key) {
      return root.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64url(p.sig), new TextEncoder().encode(passText(p)));
    }).then(function (ok) { return (checked[k] = ok ? p.n.slice(0, 25) : ''); }, function () { return (checked[k] = ''); });
  }
  function getPass(handle) {
    var owner = '';
    try { owner = root.localStorage.getItem('exiled.owner') || ''; } catch (e) {}
    var body = { handle: handle, sid: sid };
    if (owner) body.owner = owner;
    return root.fetch(URL_ + '/functions/v1/lobby-pass', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.pass : null; }, function () { return null; });
  }

  /* ── the others ────────────────────────────────────────────── */
  function cell(v) { v = Math.floor(+v); return v >= 0 && v < 4096 ? v : -1; }
  var FACE = { up: 1, down: 1, left: 1, right: 1 };
  function place(o, x, y, d, b) {
    x = cell(x); y = cell(y);
    if (x < 0 || y < 0) return;
    if (FACE[d]) o.dir = d;
    o.boat = !!b;
    /* far off (they ran, or this is the first word): just put them there */
    if (o.x < 0 || Math.abs(x - o.x) + Math.abs(y - o.y) > 8) { o.x = o.tx = x; o.y = o.ty = y; o.fx = x; o.fy = y; o.t = 1; return; }
    o.tx = x; o.ty = y;
  }
  function meet(id, meta) {
    if (id === sid || !meta) return;
    if (!others[id] && Object.keys(others).length >= MAX_SHOWN) return;
    var o = others[id] || (others[id] = { id: id, x: -1, y: -1, tx: -1, ty: -1, fx: 0, fy: 0, t: 1, dir: 'down', step: 0, name: '', look: {} });
    o.look = meta.l && typeof meta.l === 'object' ? meta.l : {};
    place(o, meta.x, meta.y, meta.d, meta.b);
    nameOf(meta.pass, id).then(function (n) { o.name = n; });
  }
  function onPresence(state, leaves) {
    Object.keys(state || {}).forEach(function (id) { var m = state[id].metas; meet(id, m && m[m.length - 1]); });
    Object.keys(leaves || {}).forEach(function (id) { delete others[id]; });
    if (state && Object.keys(state).some(function (id) { return id !== sid; })) say(true);
  }
  /* walk them a tile at a time toward where they said they are; called each frame */
  function step(dt, speed) {
    Object.keys(others).forEach(function (id) {
      var o = others[id];
      if (o.t < 1) { o.t = Math.min(1, o.t + dt * Math.max(speed, (Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) + 1) * 2.2)); return; }
      if (o.x === o.tx && o.y === o.ty) return;
      o.fx = o.x; o.fy = o.y;
      if (o.x !== o.tx) { o.dir = o.tx > o.x ? 'right' : 'left'; o.x += o.tx > o.x ? 1 : -1; }
      else { o.dir = o.ty > o.y ? 'down' : 'up'; o.y += o.ty > o.y ? 1 : -1; }
      o.t = 0; o.step ^= 1;
    });
  }

  /* ── me ────────────────────────────────────────────────────── */
  function meta() { return { pass: pass, l: me.look, x: me.x, y: me.y, d: me.d, b: me.b ? 1 : 0 }; }
  /* where i stand goes out at most every SEND_MS; force answers a newcomer */
  function say(force) {
    if (!me || !ws || ws.readyState !== 1 || !room) return;
    var now = Date.now();
    if (!force && now - lastSent < SEND_MS) { if (!sendT) sendT = setTimeout(function () { sendT = 0; say(); }, SEND_MS - (now - lastSent)); return; }
    lastSent = now;
    send({ topic: topic(), event: 'broadcast', ref: String(++ref), join_ref: String(joinRef),
           payload: { type: 'broadcast', event: 'at', payload: { s: sid, x: me.x, y: me.y, d: me.d, b: me.b ? 1 : 0 } } });
  }
  function track() {
    send({ topic: topic(), event: 'presence', ref: String(++ref), join_ref: String(joinRef),
           payload: { type: 'presence', event: 'track', payload: meta() } });
  }

  /* ── the socket ────────────────────────────────────────────── */
  function join() {
    if (!room || !ws || ws.readyState !== 1) return;
    joinRef = ++ref;
    send({ topic: topic(), event: 'phx_join', ref: String(joinRef), join_ref: String(joinRef),
           payload: { config: { broadcast: { self: false, ack: false }, presence: { key: sid, enabled: true }, private: false } } });
  }
  function leave() {
    if (room && ws && ws.readyState === 1) send({ topic: topic(), event: 'phx_leave', ref: String(++ref), join_ref: String(joinRef), payload: {} });
    others = {};
  }
  function onMessage(e) {
    var m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (!m || m.topic !== topic()) return;
    if (m.event === 'phx_reply' && m.ref === String(joinRef) && m.payload && m.payload.status === 'ok') { retry = 0; track(); return; }
    if (m.event === 'presence_state') return onPresence(m.payload);
    if (m.event === 'presence_diff') return onPresence(m.payload && m.payload.joins, m.payload && m.payload.leaves);
    if (m.event === 'broadcast' && m.payload && m.payload.event === 'at') {
      var p = m.payload.payload || {}, o = others[p.s];
      if (o) place(o, p.x, p.y, p.d, p.b);
    }
  }
  function open() {
    if (!want || ws) return;
    try { ws = new root.WebSocket(URL_.replace('https:', 'wss:') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0'); }
    catch (e) { ws = null; return later(); }
    ws.onopen = function () {
      join();
      clearInterval(beat);
      beat = setInterval(function () { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, BEAT_MS);
    };
    ws.onmessage = onMessage;
    ws.onclose = function () { clearInterval(beat); ws = null; others = {}; later(); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }
  function later() {
    if (!want || retryT) return;
    var wait = Math.min(60000, 2000 * Math.pow(2, retry++));
    retryT = setTimeout(function () { retryT = 0; open(); }, wait);
  }

  /* ── what overworld.js calls ───────────────────────────────── */
  /* who: { handle, look, x, y, d } */
  function start(who, where) {
    if (want) return;
    want = true; sid = sid || hex(16); me = who; room = where || '';
    var p = pass && pass.exp - Date.now() > 600000 ? Promise.resolve(pass) : getPass(who.handle);
    p.then(function (got) { pass = got; if (!want) return; open(); if (ws && ws.readyState === 1) track(); });
  }
  function stop() {
    want = false; clearTimeout(retryT); retryT = 0; clearTimeout(sendT); sendT = 0;
    leave(); room = '';
    if (ws) { var w = ws; ws = null; w.onclose = null; try { w.close(); } catch (e) {} }
    clearInterval(beat); others = {};
  }
  function setRoom(r) {
    if (r === room) return;
    leave(); room = r; join();
  }
  /* b: they're in a boat */
  function moved(x, y, d, b) {
    if (!me) return;
    me.x = x; me.y = y; me.d = d; me.b = !!b;
    say();
  }
  function restyle(look) { if (me) { me.look = look; track(); } }
  function list() { return Object.keys(others).map(function (id) { return others[id]; }).filter(function (o) { return o.x >= 0; }); }

  root.MFLobby = { start: start, stop: stop, setRoom: setRoom, moved: moved, restyle: restyle, step: step, list: list,
                   get on() { return want; }, get live() { return !!(ws && ws.readyState === 1); },
                   _: { nameOf: nameOf, passText: passText, onMessage: onMessage, place: place, meet: meet, setPub: function (j) { PUB = j; pubKey = null; checked = {}; } } };
})(typeof window !== 'undefined' ? window : globalThis);
