/* EXiLED teknoa 2d — the screen. engine.js decides what happens; this
   draws it and turns clicks and keys into engine calls. */
(function () {
  var MF = window.MF, D = window.MF_DATA, A = window.MFAvatar, store = null;
  try { store = window.localStorage; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };

  /* open to everyone. #locked only stays up if the game files did not load */
  if (!MF || !D || !A) return;
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
    if (window.MFWorld && window.MFWorld.active) window.MFWorld.hide();
    $('stage').hidden = true; $('shop').hidden = true; document.querySelector('.tools').hidden = true; $('chip').hidden = false;
    look = Object.keys(s.player.look).length ? A.normalize(s.player.look) : A.random();
    origin = D.origins[s.player.origin] ? s.player.origin : '';
    var carried = '';
    try { carried = store.getItem('exiled.handle') || ''; } catch (e) {}
    $('handle').value = s.player.handle || MF.cleanHandle(carried);
    $('chipMsg').textContent = '';
    drawSlots(); drawOrigins(); drawFace();
  }
  function drawFace() { $('avBig').innerHTML = A.render(look); drawWalk(); }
  /* the same look, walking: the sprite nova city will see */
  var walkStep = 0, walkTimer = 0;
  function drawWalk() {
    var box = $('avWalk');
    if (!box || !window.MFWorld || !window.MFWorld.preview) return;
    box.innerHTML = '';
    ['down', 'left', 'up', 'right'].forEach(function (d) { box.appendChild(window.MFWorld.preview(look, d, walkStep)); });
    if (!walkTimer) walkTimer = setInterval(function () {
      if ($('chip').hidden) { clearInterval(walkTimer); walkTimer = 0; return; }
      walkStep ^= 1; drawWalk();
    }, 420);
  }
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
    /* every arrival chips in with a little on the chip */
    if (!MF.chippedIn(s)) MF.earn(s, MF.START_JOULES);
    s.player = { handle: h, origin: origin, look: A.normalize(look) };
    /* with nova city loaded they land in the street; the story starts
       when they talk to someone */
    if (window.MFWorld) { s.scene = null; if (store) MF.save(s, store); return showWorld(); }
    if (!s.scene) MF.enter(s, S, D.start);
    showStage(); render();
  });
  function showStage() {
    if (window.MFWorld && window.MFWorld.active) window.MFWorld.hide();
    $('chip').hidden = true; $('stage').hidden = false; document.querySelector('.tools').hidden = false;
  }
  /* ── nova city ──────────────────────────────────────────────
     overworld.js walks them around; talking to someone with a scene comes
     back here, and the end of a scene goes back out to the street. */
  function showWorld() {
    closePanels();
    $('chip').hidden = true; $('stage').hidden = true; document.querySelector('.tools').hidden = false;
    $('shop').hidden = true;
    window.MFWorld.show(s, {
      save: function () { if (store) MF.save(s, store); },
      shop: function (id) { openShop(id); },
      talk: function () { MF.enter(s, S, D.start); showStage(); render(); }
    });
  }

  /* ── shops ──────────────────────────────────────────────────
     shops.js says what a shop changes and what it costs; this is the
     counter: try things on, see the bill, pay or walk out. Nothing is
     taken until PAY. */
  var SH = window.MFShops, shopId = '', trying = null, shopTimer = 0, shopStep = 0;
  function openShop(id) {
    var sh = SH && SH.SHOPS[id];
    if (!sh) return;
    shopId = id; trying = A.normalize(s.player.look);
    closePanels();
    window.MFWorld.hide();
    $('stage').hidden = true; $('chip').hidden = true; document.querySelector('.tools').hidden = true;
    $('shopName').textContent = sh.name;
    $('shopLine').textContent = '"' + sh.hello + '"';
    $('shopWhat').textContent = SH.KINDS[sh.kind].title + ' // ' + SH.KINDS[sh.kind].what;
    $('shopMsg').textContent = ''; $('shopMsg').classList.remove('ok');
    $('shop').hidden = false;
    drawShop();
    clearInterval(shopTimer);
    shopTimer = setInterval(function () { if ($('shop').hidden) { clearInterval(shopTimer); return; } shopStep ^= 1; drawShopWalk(); }, 420);
    try { $('shopPay').focus(); } catch (e) {}
  }
  function drawShopWalk() {
    var box = $('shopWalk'); box.innerHTML = '';
    if (!window.MFWorld || !window.MFWorld.preview) return;
    ['down', 'left', 'up', 'right'].forEach(function (d) { box.appendChild(window.MFWorld.preview(trying, d, shopStep)); });
  }
  function drawShop() {
    var sh = SH.SHOPS[shopId], kind = SH.KINDS[sh.kind], box = $('shopSlots');
    var q = SH.quote(shopId, s.player.look, trying, A), have = MF.joules(s);
    $('shopAv').innerHTML = A.render(trying); drawShopWalk();
    box.innerHTML = '';
    kind.slots.forEach(function (ks) {
      var sl = A.SLOTS.filter(function (x) { return x.key === ks.key; })[0];
      var row = document.createElement('div'), l = document.createElement('span'), v = document.createElement('span');
      var changed = trying[ks.key] !== A.normalize(s.player.look)[ks.key];
      row.className = 'slot' + (changed ? ' changed' : ''); l.className = 'l'; v.className = 'v';
      l.textContent = ks.label + ' ';
      var tag = document.createElement('small'); tag.className = 'tag'; tag.textContent = MF.fmtJ(SH.price(ks.price, sh.mult)); l.appendChild(tag);
      if (sl.colors) { var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = trying[ks.key]; v.appendChild(sw); }
      else v.textContent = trying[ks.key];
      function arrow(step, glyph, name) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = glyph; b.setAttribute('aria-label', name + ' ' + ks.label);
        b.addEventListener('click', function () { trying = A.cycle(trying, ks.key, step); $('shopMsg').textContent = ''; drawShop(); });
        return b;
      }
      row.appendChild(l); row.appendChild(arrow(-1, '◀', 'previous')); row.appendChild(v); row.appendChild(arrow(1, '▶', 'next'));
      box.appendChild(row);
    });
    var bill = $('shopBill'); bill.innerHTML = '';
    q.lines.forEach(function (ln) {
      var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('b');
      a.textContent = ln.label; b.textContent = MF.fmtJ(ln.price); li.appendChild(a); li.appendChild(b); bill.appendChild(li);
    });
    if (!q.lines.length) { var e = document.createElement('li'); e.className = 'empty'; e.textContent = 'try something on.'; bill.appendChild(e); }
    $('shopTotal').textContent = MF.fmtJ(q.total);
    $('shopHave').textContent = MF.fmtJ(have);
    var short = q.total > have;
    $('shopHave').parentNode.classList.toggle('short', short);
    $('shopPay').disabled = !q.lines.length || short;
    $('shopPay').textContent = short ? 'NOT ENOUGH JOULES' : q.lines.length ? 'PAY ' + MF.fmtJ(q.total) : 'PAY';
  }
  function leaveShop() { if ($('shop').hidden) return; clearInterval(shopTimer); $('shop').hidden = true; showWorld(); }
  $('shopUndo').addEventListener('click', function () { trying = A.normalize(s.player.look); $('shopMsg').textContent = ''; drawShop(); });
  $('shopLeave').addEventListener('click', leaveShop);
  $('shopPay').addEventListener('click', function () {
    var r = SH.buy(MF, A, s, shopId, trying);
    if (!r.ok) { $('shopMsg').classList.remove('ok'); $('shopMsg').textContent = r.why + '.'; return drawShop(); }
    if (store) MF.save(s, store);
    trying = A.normalize(s.player.look);
    $('shopMsg').classList.add('ok');
    $('shopMsg').textContent = 'paid ' + MF.fmtJ(r.total) + '. "' + SH.SHOPS[shopId].bye + '"';
    drawShop();
  });

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = $('box'), line = $('line'), speaker = $('speaker'), choices = $('choices'), more = $('more');
  var typing = null, full = '', current = null;

  function name(who) { return D.who[who] || who; }
  /* the speaker card: a portrait if they have one (faces/<who>.webp), their
     name, their mood. The CSS animates it: it breathes while idle, bobs
     while a line types out, glitches in when the speaker changes, and
     glows in the mood's colour (data-mood). */
  var card = $('whoCard'), lastWho = null;
  function setWho(who, mood) {
    /* narration: whoever spoke last stays on screen, dimmed, so a scene
       doesn't blink them out and glitch them back in between every line */
    card.classList.toggle('quiet', !who); hushed = !who;
    if (!who) { $('whoMood').textContent = ''; card.setAttribute('data-mood', ''); return; }
    var src = D.faces && D.faces[who];
    $('whoBig').textContent = who ? name(who) : '';
    $('whoMood').textContent = mood ? '// ' + mood : '';
    card.classList.toggle('on', !!who);
    card.classList.toggle('faced', !!src);
    card.setAttribute('data-mood', mood || '');
    if (src && $('whoImg').getAttribute('src') !== src) { $('whoImg').setAttribute('src', src); $('whoImg').setAttribute('alt', name(who)); }
    if (who !== lastWho) framesFor(who);
    if (who && who !== lastWho && !reduce) { card.classList.remove('arrive'); void card.offsetWidth; card.classList.add('arrive'); }
    lastWho = who || null;
  }
  /* a face with -blink / -talk frames blinks now and then, and moves its
     mouth while a line types out */
  var frames = null, blinkT = 0, mouthT = 0, hushed = false;
  function framesFor(who) {
    var fr = D.frames && D.frames[who];
    frames = fr && !reduce ? fr : null;
    [['whoBlink', 'blink'], ['whoTalk', 'talk']].forEach(function (k) {
      var img = $(k[0]), src = frames && frames[k[1]];
      img.hidden = !src;
      if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
    clearTimeout(blinkT);
    if (frames && frames.blink) blinkLater();
  }
  function blinkLater() {
    blinkT = setTimeout(function () {
      if (!frames || !frames.blink) return;
      card.classList.add('blink');
      /* now and then a double blink */
      var twice = Math.random() < 0.18;
      setTimeout(function () {
        card.classList.remove('blink');
        if (twice) setTimeout(function () { card.classList.add('blink'); setTimeout(function () { card.classList.remove('blink'); }, 110); }, 140);
      }, 120);
      blinkLater();
    }, 2200 + Math.random() * 4200);
  }
  function mouth(on) {
    clearTimeout(mouthT);
    if (!on || !frames || !frames.talk) { card.classList.remove('mouth'); return; }
    (function flap() {
      card.classList.toggle('mouth');
      mouthT = setTimeout(flap, 90 + Math.random() * 110);
    })();
  }
  function talking(on) { card.classList.toggle('talk', on); mouth(on && !hushed); }
  function type(text) {
    clearInterval(typing); typing = null; full = text;
    if (reduce) { line.textContent = text; more.hidden = false; return; }
    var i = 0; line.textContent = ''; more.hidden = true; talking(true);
    typing = setInterval(function () {
      i += 2; line.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typing); typing = null; more.hidden = false; talking(false); }
    }, 18);
  }
  function finishTyping() { clearInterval(typing); typing = null; line.textContent = full; more.hidden = false; talking(false); }

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
      setWho(v.who, v.mood);
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
          setWho(last.who, last.mood);
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
    if (window.MFWorld) { s.scene = null; if (store) MF.save(s, store); setWho('', ''); return showWorld(); }
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
      speaker.textContent = D.who.sys || 'MINDSCAPE';
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
    if (e.key === 'Escape') { if (!$('shop').hidden) return leaveShop(); return closePanels(); }
    if ($('stage').hidden) return;               /* out in the street, the keys are the world's */
    if (!$('inv').hidden || !$('sys').hidden) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); return; }
    if (current && current.kind === 'choose' && /^[1-9]$/.test(e.key)) {
      var c = current.choices[+e.key - 1];
      if (c) pick(c.index);
    }
  });

  /* ── panels ─────────────────────────────────────────────── */
  function closePanels() {
    ['map', 'inv', 'sys'].forEach(function (p) { $(p).hidden = true; $(p + 'Btn').setAttribute('aria-expanded', 'false'); });
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
      $('opJ').textContent = MF.fmtJ(MF.joules(s));
      inv.innerHTML = ''; met.innerHTML = '';
      var SH = window.MFShops, gd = function (k) { return SH && SH.goods ? SH.goods(k) : null; };
      Object.keys(s.items).forEach(function (k) {
        var g = gd(k), worn = SH && SH.TOOLS && SH.TOOLS[k] ? ' (' + SH.rodLeft(s, k) + '/' + SH.TOOLS[k].dur + ' uses)' : '';
        var row = li((g ? g.name : k) + (s.items[k] > 1 ? ' x' + s.items[k] : '') + worn, g ? g.what : D.items[k]);
        /* take-away food: eat or drink it from here */
        if (SH && SH.FOODS && SH.FOODS[k]) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'eat';
          b.textContent = SH.FOODS[k].food ? 'EAT' : 'DRINK';
          b.addEventListener('click', function () { if (SH.eat(MF, s, k).ok) { if (store) MF.save(s, store); $('invBtn').click(); $('invBtn').click(); } });
          row.appendChild(b);
        }
        inv.appendChild(row);
      });
      if (s.body) inv.insertBefore(li('food ' + Math.round(s.body.food) + '% · drink ' + Math.round(s.body.drink) + '%', s.body.buff && s.body.buffT > 0 ? s.body.buff + ', ' + Math.ceil(s.body.buffT / 60) + ' more minutes' : ''), inv.firstChild);
      if (SH && SH.FISH && Object.keys(s.fishlog || {}).length) inv.appendChild(li('fish log: ' + Object.keys(s.fishlog).length + ' of ' + Object.keys(SH.FISH).length + ' kinds', Object.keys(s.fishlog).map(function (k) { return SH.FISH[k] ? SH.FISH[k].name.replace(/^(a|an) /, '') : k; }).join(', ') + '.'));
      var RS = (window.MFShops && window.MFShops.RES) || {};
      Object.keys(s.res || {}).forEach(function (k) { if (RS[k]) inv.appendChild(li(RS[k].name + ' x' + s.res[k], RS[k].what)); });
      if (s.boat) inv.appendChild(li('a boat', 'moored wherever you left the water. face the sea and press A to sail.'));
      var HM = (window.MFShops && window.MFShops.HOMES) || {};
      Object.keys(s.homes || {}).forEach(function (k) { if (HM[k]) inv.appendChild(li('key: ' + HM[k].name, HM[k].where + (s.wake === k ? '. you wake up here.' : '.'))); });
      if (!inv.children.length) inv.appendChild(empty('nothing yet.'));
      Object.keys(s.met).forEach(function (k) { met.appendChild(li(name(k), 'contact established ' + s.met[k])); });
      if (!met.children.length) met.appendChild(empty('no one yet.'));
    });
  });

  /* the map of terranova, from the vault's azgaar map. here = where nova
     city is on each picture, as a fraction of its width and height */
  var MAPS = {
    biomes: { src: 'maps/biomes.png', here: [0.629, 0.797], note: 'terranova, by the land. nova city is the dot, in the south, in vistadelsol.' },
    states: { src: 'maps/states.png', here: [0.629, 0.797], note: 'terranova, by who holds it. vistadelsol is the teknoan council\'s.' },
    nova:   { src: 'maps/nova.png', here: [0.5, 0.36], note: 'the nova sea. vistadelsol all round the bay. a boat gets you out there.' }
  };
  var mapShown = 'nova';
  function showMap(k) {
    mapShown = k;
    var m = MAPS[k];
    $('mapImg').setAttribute('src', m.src); $('mapImg').setAttribute('alt', 'map of terranova: ' + k);
    $('mapHere').style.left = (m.here[0] * 100) + '%'; $('mapHere').style.top = (m.here[1] * 100) + '%';
    $('mapNote').textContent = m.note;
    [].forEach.call(document.querySelectorAll('.maptabs button'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-map') === k ? 'true' : 'false'); });
  }
  [].forEach.call(document.querySelectorAll('.maptabs button'), function (b) {
    b.addEventListener('click', function () { showMap(b.getAttribute('data-map')); });
  });
  $('mapBtn').addEventListener('click', function () { toggle('map', function () { showMap(mapShown); }); });

  /* the backup: the whole site's progress (backup.js), not just this run.
     Old game-only MF1 codes still load. */
  var wipeArmed = 0, B = window.EXBackup;
  function msg(t, bad) { $('sysMsg').textContent = t; $('sysMsg').classList.toggle('err', !!bad); }
  function code() { if (store) MF.save(s, store); return B && store ? B.pack(store) : MF.exportCode(s); }
  function backedUp() { try { store.setItem('exiled.backupAt', String(Date.now())); } catch (e) {} }
  $('sysBtn').addEventListener('click', function () {
    toggle('sys', function () { $('code').value = code(); $('paste').value = ''; msg(''); wipeArmed = 0; $('wipeBtn').textContent = 'WIPE THIS RUN'; onlineLabel(); });
  });
  /* the shared streets: on unless they say otherwise */
  function onlineLabel() { $('onlineBtn').textContent = window.MFWorld && window.MFWorld.offline ? 'GO ONLINE' : 'GO OFFLINE'; }
  $('onlineBtn').addEventListener('click', function () {
    if (!window.MFWorld) return;
    window.MFWorld.setOffline(!window.MFWorld.offline);
    onlineLabel();
    msg(window.MFWorld.offline ? 'offline. nobody sees you, you see nobody.' : 'online. say hi to the strangers.');
  });
  $('copyBtn').addEventListener('click', function () {
    var t = $('code').value;
    function fallback() { $('code').select(); try { document.execCommand('copy'); backedUp(); msg('copied.'); } catch (e) { msg('select it and copy by hand.', true); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { backedUp(); msg('copied.'); }, fallback);
    else fallback();
  });
  if ($('dlBtn')) $('dlBtn').addEventListener('click', function () {
    if (!B) return;
    B.download($('code').value, s.player.handle); backedUp(); msg('saved to your downloads.');
  });
  /* after a restore, pick up wherever the run now is */
  function resume() {
    if (!MF.chippedIn(s)) return showChip();
    if (window.MFWorld && (!s.scene || MF.view(s, S).kind === 'end')) return showWorld();
    if (!s.scene && !Object.keys(s.seen).length) MF.enter(s, S, D.start);
    showStage(); render();
  }
  function restoreFrom(text) {
    text = String(text || '').trim();
    if (B && /^EXB1\./.test(text)) {
      msg('checking keys...');
      return B.restore(text, store, window.EXILED_SEAL, window.crypto && window.crypto.subtle).then(function (r) {
        var back = MF.load(store);
        if (back) { if (back.scene && !S[back.scene]) MF.enter(back, S, D.start); s = back; }
        resume(); $('code').value = code();
        msg('restored.' + (r.keys.length ? ' wiki keys: ' + r.keys.length + '.' : '') + (r.dropped.length ? ' ' + r.dropped.length + ' key(s) did not fit and were left out.' : ''));
      }, function (e) { msg(e.message + '.', true); });
    }
    try {
      var loaded = MF.importCode(text);
      if (loaded.scene && !S[loaded.scene]) MF.enter(loaded, S, D.start);
      s = loaded; if (store) MF.save(s, store);
      resume(); $('code').value = code();
      msg('run loaded.');
    } catch (e) { msg(e.message + '.', true); }
  }
  $('loadBtn').addEventListener('click', function () { restoreFrom($('paste').value); });
  if ($('fileBtn')) {
    $('fileBtn').addEventListener('click', function () { $('fileIn').click(); });
    $('fileIn').addEventListener('change', function () {
      var f = $('fileIn').files && $('fileIn').files[0];
      if (!f) return;
      f.text().then(function (t) { $('paste').value = t.trim(); restoreFrom(t); });
      $('fileIn').value = '';
    });
  }
  /* two presses, no dialog: the first arms it, the second wipes */
  $('wipeBtn').addEventListener('click', function () {
    if (Date.now() - wipeArmed > 4000) { wipeArmed = Date.now(); $('wipeBtn').textContent = 'PRESS AGAIN TO WIPE'; return; }
    if (store) MF.wipe(store);
    s = MF.newState(); showChip();
  });

  /* mid-conversation: back to it. otherwise: back to the street */
  if (!MF.chippedIn(s)) showChip();
  else if (window.MFWorld && (!s.scene || MF.view(s, S).kind === 'end')) showWorld();
  else { if (!s.scene && !Object.keys(s.seen).length) MF.enter(s, S, D.start); showStage(); render(); }
})();
