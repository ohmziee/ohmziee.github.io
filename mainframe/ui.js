/* EXiLED mainframe — the screen. engine.js decides what happens; this
   draws it and turns clicks and keys into engine calls. */
(function () {
  var MF = window.MF, D = window.MF_DATA, A = window.MFAvatar, store = null;
  try { store = window.localStorage; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };

  /* the mainframe has to have been opened on the main page first */
  var open = false;
  try { open = !!store.getItem('exiled.mainframe'); } catch (e) {}
  if (!open || !MF || !D || !A) return;
  $('locked').hidden = true;

  var S = D.scenes;
  var s = (store && MF.load(store)) || MF.newState();
  /* the story was edited under a saved run: keep everything earned, restart the scene */
  if (s.scene && !S[s.scene]) MF.enter(s, S, D.start);
  else if (s.scene && s.beat > S[s.scene].beats.length) s.beat = 0;

  /* ── Chippin' In ────────────────────────────────────────────
     Before anything else the player says who they are: a handle, a look,
     where they come from. Nothing is saved until they chip in. */
  var look = null, origin = '';
  function showChip() {
    closePanels();
    $('stage').hidden = true; document.querySelector('.tools').hidden = true; $('chip').hidden = false;
    look = Object.keys(s.player.look).length ? A.normalize(s.player.look) : A.random();
    origin = D.origins[s.player.origin] ? s.player.origin : '';
    var carried = '';
    try { carried = store.getItem('exiled.handle') || ''; } catch (e) {}
    $('handle').value = s.player.handle || MF.cleanHandle(carried);
    $('chipMsg').textContent = '';
    drawSlots(); drawOrigins(); drawFace();
  }
  function drawFace() { $('avBig').innerHTML = A.render(look); }
  function drawSlots() {
    var box = $('slots'); box.innerHTML = '';
    A.SLOTS.forEach(function (sl) {
      var row = document.createElement('div'), l = document.createElement('span'), v = document.createElement('span');
      row.className = 'slot'; l.className = 'l'; l.textContent = sl.label; v.className = 'v';
      function paint() {
        v.textContent = '';
        if (sl.colors) { var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = look[sl.key]; v.appendChild(sw); }
        else v.textContent = look[sl.key];
      }
      function arrow(step, glyph, name) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = glyph; b.setAttribute('aria-label', name + ' ' + sl.label);
        b.addEventListener('click', function () { look = A.cycle(look, sl.key, step); paint(); drawFace(); });
        return b;
      }
      row.appendChild(l); row.appendChild(arrow(-1, '◀', 'previous')); row.appendChild(v); row.appendChild(arrow(1, '▶', 'next'));
      paint(); box.appendChild(row);
    });
  }
  function drawOrigins() {
    var box = $('origins'); box.innerHTML = '';
    Object.keys(D.origins).forEach(function (id) {
      var o = D.origins[id], b = document.createElement('button'), t = document.createElement('b'), d = document.createElement('span');
      b.type = 'button'; b.className = 'origin'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(origin === id));
      t.textContent = o.title; d.textContent = o.blurb; b.appendChild(t); b.appendChild(d);
      b.addEventListener('click', function () { origin = id; drawOrigins(); });
      box.appendChild(b);
    });
  }
  $('avRand').addEventListener('click', function () { look = A.random(); drawSlots(); drawFace(); });
  $('chipGo').addEventListener('click', function () {
    var h = MF.cleanHandle($('handle').value);
    if (!h) { $('chipMsg').textContent = 'the line needs a handle.'; return; }
    if (!origin) { $('chipMsg').textContent = 'pick where you come from.'; return; }
    s.player = { handle: h, origin: origin, look: A.normalize(look) };
    if (!s.scene) MF.enter(s, S, D.start);
    showStage(); render();
  });
  function showStage() {
    $('chip').hidden = true; $('stage').hidden = false; document.querySelector('.tools').hidden = false;
  }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = $('box'), line = $('line'), speaker = $('speaker'), choices = $('choices'), more = $('more');
  var typing = null, full = '', current = null;

  function name(who) { return D.who[who] || who; }
  function type(text) {
    clearInterval(typing); typing = null; full = text;
    if (reduce) { line.textContent = text; more.hidden = false; return; }
    var i = 0; line.textContent = ''; more.hidden = true;
    typing = setInterval(function () {
      i += 2; line.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typing); typing = null; more.hidden = false; }
    }, 18);
  }
  function finishTyping() { clearInterval(typing); typing = null; line.textContent = full; more.hidden = false; }

  function render() {
    var v;
    for (var hops = 0; ; hops++) {
      v = MF.view(s, S);
      if (v.kind !== 'go' || hops > 50) break;
      MF.enter(s, S, v.to);
    }
    current = v;
    if (store) MF.save(s, store);
    choices.innerHTML = '';
    $('ask').hidden = true;
    box.classList.toggle('choosing', v.kind === 'choose');
    if (v.kind === 'line') {
      speaker.textContent = v.who ? name(v.who) : '';
      line.classList.toggle('narr', !v.who);
      $('whoBig').textContent = v.who ? name(v.who) : '';
      $('whoMood').textContent = v.mood ? '// ' + v.mood : '';
      $('whoCard').classList.toggle('on', !!v.who);
      type(v.text);
      return;
    }
    more.hidden = true;
    if (v.kind === 'ask') {
      /* landed here from a reload: show the question's last line again */
      if (!line.textContent) {
        var bs = S[s.scene].beats.filter(function (b) { return b.text; }), last = bs[bs.length - 1];
        if (last) {
          speaker.textContent = last.who ? name(last.who) : ''; line.classList.toggle('narr', !last.who);
          line.textContent = last.text.replace(/\$handle\b/g, s.player.handle || 'stranger');
          $('whoBig').textContent = last.who ? name(last.who) : ''; $('whoCard').classList.toggle('on', !!last.who);
        }
      }
      $('ask').hidden = false; $('askIn').value = ''; $('askIn').disabled = false;
      try { $('askIn').focus(); } catch (e) {}
      return;
    }
    if (v.kind === 'choose') {
      v.choices.forEach(function (c, i) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span class="n">' + (i + 1) + '</span>';
        b.appendChild(document.createTextNode(c.text));
        b.addEventListener('click', function (e) { e.stopPropagation(); pick(c.index); });
        li.appendChild(b); choices.appendChild(li);
      });
      return;
    }
    speaker.textContent = ''; line.classList.add('narr');
    $('whoCard').classList.remove('on');
    type('[ the line goes quiet. end of signal. ]');
    more.hidden = true;
  }
  function advance() {
    if (typing) return finishTyping();
    if (current && current.kind === 'line') { MF.next(s); render(); }
  }
  function pick(index) { MF.choose(s, S, index); render(); }

  /* ── a typed answer ─────────────────────────────────────────
     The answer is a character's wiki key. It is checked the way the wiki
     checks it: derive the key, try to open that seal's check blob. Right
     means the key goes where the wiki looks for it (exiled.keys). Nothing
     here, or in the story, holds an answer to compare against. */
  var asking = false;
  function deriveAndCheck(answer, name) {
    var W = window.EXILED_SEAL, sub = window.crypto && window.crypto.subtle, enc = new TextEncoder();
    var c = W && W.keys && W.keys[name];
    if (!c || !sub) return Promise.reject(new Error('no signal'));
    function bytes(b) { return Uint8Array.from(atob(b), function (ch) { return ch.charCodeAt(0); }); }
    return sub.importKey('raw', enc.encode(answer), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return sub.deriveKey({ name: 'PBKDF2', salt: enc.encode(c.salt), iterations: W.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      })
      .then(function (key) {
        return sub.decrypt({ name: 'AES-GCM', iv: bytes(c.check.iv) }, key, bytes(c.check.ct))
          .then(function () { return sub.exportKey('raw', key); }, function () { return null; });
      });
  }
  function keep(name, raw) {
    var b = '', u = new Uint8Array(raw), keys = {};
    for (var i = 0; i < u.length; i++) b += String.fromCharCode(u[i]);
    try { keys = JSON.parse(store.getItem('exiled.keys') || '{}') || {}; } catch (e) {}
    keys[name] = btoa(b);
    try { store.setItem('exiled.keys', JSON.stringify(keys)); } catch (e) {}
  }
  function say() {
    if (asking || !current || current.kind !== 'ask') return;
    var t = MF.normalAnswer($('askIn').value);
    if (!t) return;
    asking = true; $('askIn').disabled = true;
    var name = current.seal;
    deriveAndCheck(t, name).then(function (raw) {
      asking = false;
      if (raw) keep(name, raw);
      MF.answer(s, S, !!raw); render();
    }, function () {
      asking = false; $('askIn').disabled = false;
      speaker.textContent = D.who.sys || 'MAINFRAME';
      line.classList.remove('narr');
      line.textContent = 'the line is down. nothing can be checked right now. come back later.';
    });
  }
  $('askGo').addEventListener('click', function (e) { e.stopPropagation(); say(); });
  $('askIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); say(); } });
  $('ask').addEventListener('click', function (e) { e.stopPropagation(); });

  box.addEventListener('click', advance);
  document.addEventListener('keydown', function (e) {
    if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') return closePanels();
    if (!$('inv').hidden || !$('sys').hidden) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); return; }
    if (current && current.kind === 'choose' && /^[1-9]$/.test(e.key)) {
      var c = current.choices[+e.key - 1];
      if (c) pick(c.index);
    }
  });

  /* ── panels ─────────────────────────────────────────────── */
  function closePanels() {
    ['inv', 'sys'].forEach(function (p) { $(p).hidden = true; $(p + 'Btn').setAttribute('aria-expanded', 'false'); });
  }
  function toggle(p, fillIt) {
    var was = !$(p).hidden;
    closePanels();
    if (was) return;
    fillIt(); $(p).hidden = false; $(p + 'Btn').setAttribute('aria-expanded', 'true');
  }
  function li(title, desc) {
    var el = document.createElement('li');
    el.textContent = title;
    if (desc) { var d = document.createElement('span'); d.className = 'd'; d.textContent = desc; el.appendChild(d); }
    return el;
  }
  function empty(text) { var el = document.createElement('li'); el.className = 'empty'; el.textContent = text; return el; }
  $('invBtn').addEventListener('click', function () {
    toggle('inv', function () {
      var inv = $('invList'), met = $('metList'), o = D.origins[s.player.origin];
      $('avSmall').innerHTML = A.render(s.player.look);
      $('opHandle').textContent = s.player.handle;
      $('opOrigin').textContent = o ? o.title : '';
      inv.innerHTML = ''; met.innerHTML = '';
      Object.keys(s.items).forEach(function (k) { inv.appendChild(li(k + (s.items[k] > 1 ? ' x' + s.items[k] : ''), D.items[k])); });
      if (!inv.children.length) inv.appendChild(empty('nothing yet.'));
      Object.keys(s.met).forEach(function (k) { met.appendChild(li(name(k), 'contact established ' + s.met[k])); });
      if (!met.children.length) met.appendChild(empty('no one yet.'));
    });
  });

  var wipeArmed = 0;
  function msg(t, bad) { $('sysMsg').textContent = t; $('sysMsg').classList.toggle('err', !!bad); }
  $('sysBtn').addEventListener('click', function () {
    toggle('sys', function () { $('code').value = MF.exportCode(s); $('paste').value = ''; msg(''); wipeArmed = 0; $('wipeBtn').textContent = 'WIPE THIS RUN'; });
  });
  $('copyBtn').addEventListener('click', function () {
    var t = $('code').value;
    function fallback() { $('code').select(); try { document.execCommand('copy'); msg('copied.'); } catch (e) { msg('select it and copy by hand.', true); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { msg('copied.'); }, fallback);
    else fallback();
  });
  $('loadBtn').addEventListener('click', function () {
    try {
      var loaded = MF.importCode($('paste').value);
      if (loaded.scene && !S[loaded.scene]) MF.enter(loaded, S, D.start);
      s = loaded;
      if (!MF.chippedIn(s)) return showChip();
      if (!s.scene && !Object.keys(s.seen).length) MF.enter(s, S, D.start);
      render(); $('code').value = MF.exportCode(s);
      msg('run loaded.');
    } catch (e) { msg(e.message + '.', true); }
  });
  /* two presses, no dialog: the first arms it, the second wipes */
  $('wipeBtn').addEventListener('click', function () {
    if (Date.now() - wipeArmed > 4000) { wipeArmed = Date.now(); $('wipeBtn').textContent = 'PRESS AGAIN TO WIPE'; return; }
    if (store) MF.wipe(store);
    s = MF.newState(); showChip();
  });

  if (MF.chippedIn(s)) { if (!s.scene && !Object.keys(s.seen).length) MF.enter(s, S, D.start); showStage(); render(); }
  else showChip();
})();
