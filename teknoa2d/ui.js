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
  var look = null, origin = '', power = '', side = '';
  function showChip() {
    closePanels();
    if (window.MFWorld && window.MFWorld.active) window.MFWorld.hide();
    $('stage').hidden = true; $('shop').hidden = true; document.querySelector('.tools').hidden = true; $('chip').hidden = false;
    origin = D.origins[s.player.origin] ? s.player.origin : '';
    look = Object.keys(s.player.look).length ? A.normalize(s.player.look, origin || undefined) : A.random(null, origin || undefined);
    power = s.player.power || ''; side = s.player.side || '';
    var carried = '';
    try { carried = store.getItem('exiled.handle') || ''; } catch (e) {}
    $('handle').value = s.player.handle || MF.cleanHandle(carried);
    $('chipMsg').textContent = s.flags['origin-repick'] ? 'the origins changed. pick where you come from again; the rest of your run stays.' : unsided() ? 'products pick a side now. whose are you? the rest of your run stays.' : '';
    drawSlots(); drawOrigins(); drawFace();
  }
  /* a product from before sides existed picks one, once */
  function unsided() { return s.player.origin === 'product' && !s.player.side; }
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
    A.slots(look).forEach(function (sl) {
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
        b.addEventListener('click', function () { look = A.cycle(look, sl.key, step, origin || undefined); paint(); drawFace(); });
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
      b.addEventListener('click', function () {
        var was = origin; origin = id;
        /* the origin decides the body: an ape, an android, a human; a product comes stamped */
        look = A.normalize(look, id);
        if (id === 'product' && was !== 'product' && look.marks === 'none') look.marks = 'barcode';
        drawOrigins(); drawSlots(); drawFace();
      });
      box.appendChild(b);
      /* a product picks a side */
      if (origin === id && MF.ORIGINS[id] && MF.ORIGINS[id].side) {
        var sd = document.createElement('div'); sd.className = 'power'; sd.setAttribute('role', 'radiogroup'); sd.setAttribute('aria-label', 'whose side');
        MF.ORIGINS[id].side.forEach(function (sv) {
          var sb = document.createElement('button'), st = document.createElement('b'), sp = document.createElement('span');
          sb.type = 'button'; sb.className = 'origin sub'; sb.setAttribute('role', 'radio'); sb.setAttribute('aria-checked', String(side === sv));
          st.textContent = MF.SIDE[sv].name; sp.textContent = MF.SIDE[sv].what; sb.appendChild(st); sb.appendChild(sp);
          sb.addEventListener('click', function () { side = sv; drawOrigins(); });
          sd.appendChild(sb);
        });
        box.appendChild(sd);
      }
      /* an AI picks what keeps it running */
      if (origin !== id || !(MF.ORIGINS[id] && MF.ORIGINS[id].power)) return;
      var sub = document.createElement('div'); sub.className = 'power'; sub.setAttribute('role', 'radiogroup'); sub.setAttribute('aria-label', 'power source');
      MF.ORIGINS[id].power.forEach(function (pw) {
        var pb = document.createElement('button'), pt = document.createElement('b'), pd = document.createElement('span');
        pb.type = 'button'; pb.className = 'origin sub'; pb.setAttribute('role', 'radio'); pb.setAttribute('aria-checked', String(power === pw));
        pt.textContent = MF.POWER[pw].name; pd.textContent = MF.POWER[pw].what; pb.appendChild(pt); pb.appendChild(pd);
        pb.addEventListener('click', function () { power = pw; drawOrigins(); });
        sub.appendChild(pb);
      });
      box.appendChild(sub);
    });
  }
  $('avRand').addEventListener('click', function () { look = A.random(null, origin || undefined); drawSlots(); drawFace(); });
  $('chipGo').addEventListener('click', function () {
    var h = MF.cleanHandle($('handle').value);
    if (!h) { $('chipMsg').textContent = 'the line needs a handle.'; return; }
    if (!origin) { $('chipMsg').textContent = 'pick where you come from.'; return; }
    var needsPower = MF.ORIGINS[origin] && MF.ORIGINS[origin].power;
    if (needsPower && needsPower.indexOf(power) < 0) { $('chipMsg').textContent = 'pick what keeps you running.'; return; }
    var needsSide = MF.ORIGINS[origin] && MF.ORIGINS[origin].side;
    if (needsSide && needsSide.indexOf(side) < 0) { $('chipMsg').textContent = 'whose side are you on?'; return; }
    /* every arrival chips in with a little on the chip */
    if (!MF.chippedIn(s)) MF.earn(s, MF.START_JOULES);
    s.player = { handle: h, origin: origin, look: A.normalize(look, origin), power: needsPower ? power : '', side: needsSide ? side : '' };
    /* the origin's head start, once (a re-pick after the origins changed gets it too) */
    if (s.flags['origin-repick']) { delete s.flags['origin-repick']; delete s.flags['origin-start']; }
    if (window.MFLevel) window.MFLevel.start(MF, s);
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
    shopId = id; trying = A.normalize(s.player.look, s.player.origin || undefined);
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
    /* only what fits this body: no haircuts for fur */
    var mine = kind.slots.filter(function (ks) { return A.slots(trying).some(function (x) { return x.key === ks.key; }); });
    if (!mine.length) { var none = document.createElement('p'); none.className = 'dim'; none.textContent = 'nothing in here for you. (no offence.)'; box.appendChild(none); }
    mine.forEach(function (ks) {
      var sl = A.slots(trying).filter(function (x) { return x.key === ks.key; })[0];
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
        b.addEventListener('click', function () { trying = A.cycle(trying, ks.key, step, s.player.origin || undefined); $('shopMsg').textContent = ''; drawShop(); });
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
  $('shopUndo').addEventListener('click', function () { trying = A.normalize(s.player.look, s.player.origin || undefined); $('shopMsg').textContent = ''; drawShop(); });
  $('shopLeave').addEventListener('click', leaveShop);
  $('shopPay').addEventListener('click', function () {
    var r = SH.buy(MF, A, s, shopId, trying);
    if (!r.ok) { $('shopMsg').classList.remove('ok'); $('shopMsg').textContent = r.why + '.'; return drawShop(); }
    if (store) MF.save(s, store);
    trying = A.normalize(s.player.look, s.player.origin || undefined);
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
    if (!$('sys').hidden) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); return; }
    if (current && current.kind === 'choose' && /^[1-9]$/.test(e.key)) {
      var c = current.choices[+e.key - 1];
      if (c) pick(c.index);
    }
  });

  /* ── panels ─────────────────────────────────────────────── */
  function closePanels() {
    ['sys', 'dev'].forEach(function (p) { $(p).hidden = true; if ($(p + 'Btn')) $(p + 'Btn').setAttribute('aria-expanded', 'false'); });
  }
  function toggle(p, fillIt) {
    var was = !$(p).hidden;
    closePanels();
    if (was) return;
    fillIt(); $(p).hidden = false; if ($(p + 'Btn')) $(p + 'Btn').setAttribute('aria-expanded', 'true');
  }
  /* the backup: the whole site's progress (backup.js), not just this run.
     Old game-only MF1 codes still load. */
  var wipeArmed = 0, B = window.EXBackup;
  function msg(t, bad) { $('sysMsg').textContent = t; $('sysMsg').classList.toggle('err', !!bad); }
  function code() { if (store) MF.save(s, store); return B && store ? B.pack(store) : MF.exportCode(s); }
  function backedUp() { try { store.setItem('exiled.backupAt', String(Date.now())); } catch (e) {} }
  /* ── DEV: the owner's test drawer ─────────────────────────────
     shows only when this browser holds the owner key (the one the chat
     takes as name#key). it only touches this browser's run, and it is a
     convenience, not a lock: a run in localStorage can always be edited */
  var owner = '';
  try { owner = store && store.getItem('exiled.owner') || ''; } catch (e) {}
  if (owner) $('devBtn').hidden = false;
  function devMsg(t) { $('devMsg').textContent = t; }
  function devPlaces() {
    var M = window.MFWorldMap, w = M && M.build(), sel = $('devTo'), opts = [];
    if (!w) return;
    M.DISTRICTS.forEach(function (d) { opts.push([d.name, { x: d.cx, y: d.cy }]); });
    (w.landings || []).forEach(function (l) { opts.push([l.name.toUpperCase() + ' (landing)', { x: l.x, y: l.y }]); });
    Object.keys(M.ROOMS).forEach(function (r) { var rm = M.room(r); opts.push(['inside: ' + r, { x: rm.spawn.x, y: rm.spawn.y, in: r }]); });
    opts.push(['the jörmun, by boat', { x: 6, y: Math.floor(w.H / 2), sail: 1 }]);
    sel.innerHTML = '';
    opts.forEach(function (o, i) { var op = document.createElement('option'); op.value = i; op.textContent = o[0]; sel.appendChild(op); });
    sel._places = opts;
  }
  function devDo(act) {
    var SH = window.MFShops, M = window.MFWorldMap;
    if (!s.dev) s.dev = {};
    if (!s.items) s.items = {};
    if (!s.res) s.res = {};
    if (act === 'j1k') MF.earn(s, 1000); else if (act === 'j10k') MF.earn(s, 10000); else if (act === 'j100k') MF.earn(s, 100000); else if (act === 'j0') s.joules = 0;
    else if (act === 'mats') Object.keys(SH.RES).forEach(function (k) { s.res[k] = (s.res[k] || 0) + 20; });
    else if (act === 'rods') Object.keys(SH.TOOLS).forEach(function (k) { s.items[k] = 1; if (!s.wear) s.wear = {}; s.wear[k] = SH.TOOLS[k].dur; });
    else if (act === 'arms') Object.keys(SH.ARMS()).forEach(function (k) { s.items[k] = 1; if (!s.wear) s.wear = {}; s.wear[k] = SH.ARMS()[k].dur; });
    else if (act === 'boat') s.boat = 1;
    else if (act === 'homes') Object.keys(SH.HOMES).forEach(function (k) { s.homes[k] = 1; });
    else if (act === 'fish') Object.keys(SH.FISH).forEach(function (k) { s.items[k] = (s.items[k] || 0) + 1; });
    else if (act === 'food') Object.keys(SH.FOODS).forEach(function (k) { if (!SH.FOODS[k].here) s.items[k] = (s.items[k] || 0) + 3; });
    else if (act === 'curios') Object.keys(SH.CURIOS).forEach(function (k) { s.items[k] = (s.items[k] || 0) + 1; });
    else if (act === 'clear') { s.items = {}; s.res = {}; s.wear = {}; }
    else if (act === 'full') { s.body.food = 100; s.body.drink = 100; MF.heal(s, MF.maxOf(s, 'hp')); MF.rest(s); }
    else if (act === 'hurt') s.body.health = 10;
    else if (act === 'drained') { s.body.sta = 5; s.body.int = 5; }
    else if (act === 'xp500' || act === 'traits') {
      var LV = window.MFLevel; LV.ready(s);
      /* exp lands on the traits evenly, so the character level moves with it */
      Object.keys(LV.TRAITS).forEach(function (t) {
        var n = act === 'xp500' ? Math.ceil(500 / Object.keys(LV.TRAITS).length) : 0;
        if (act === 'traits') { var lv = LV.traitLevel(s, t); for (var i = 0; i < 5; i++) n += LV.needT(lv + i); n -= LV.traitInfo(s, t).into; }
        s.skills[t] = (s.skills[t] || 0) + n; s.xp.total += n;
      });
    }
    else if (act === 'relevel') { s.xp = { total: 0, by: {} }; s.skills = {}; s.core = { hp: 0, sta: 0, int: 0 }; s.perks = {}; MF.heal(s, 0); MF.rest(s); s.body.health = Math.min(s.body.health, MF.maxOf(s, 'hp')); }
    else if (act === 'weak') { s.body.food = 15; s.body.drink = 15; }
    else if (act === 'faint') { s.body.food = 0.3; s.body.drink = 50; }
    else if (act === 'nohunger') s.dev.nohunger = !s.dev.nohunger;
    else if (act === 'noweight') s.dev.noweight = !s.dev.noweight;
    else if (act === 'h1' || act === 'h6') s.dev.shift = (s.dev.shift || 0) + (act === 'h1' ? 60 : 360);
    else if (act === 'noon' || act === 'midnight') { var c0 = MF.clock(Date.now(), 0); s.dev.shift = ((act === 'noon' ? 720 : 1440) - (c0.hour * 60 + c0.minute) + 1440) % 1440; }
    else if (act === 'real') s.dev.shift = 0;
    else if (act === 'bill') { if (!s.treasury) s.treasury = { week: -1, spent: 0, arrears: 0 }; s.treasury.week = Math.max(0, Math.floor(MF.clock(Date.now(), s.dev.shift || 0).day / 7) - 1); }
    else if (act === 'piles') s.gathered = { day: '', got: {} };
    else if (act === 'lotto') (s.lotto || []).forEach(function (t) { t.day = '2000-01-01'; });
    else if (act === 'foe') {
      var who = $('devFoe').value;
      if (!(window.MFWorld && window.MFWorld.active)) return devMsg('go outside first.');
      return devMsg('spawned: ' + window.MFWorld.devFoe(who));
    }
    else if (act === 'peace') s.dev.peace = !s.dev.peace;
    else if (act === 'tp') {
      var p = $('devTo')._places[+$('devTo').value];
      if (!p) return;
      s.world = { x: p[1].x, y: p[1].y, d: 'down', v: M.V, in: p[1].in, sail: p[1].sail };
      if (p[1].sail) s.boat = 1;
      if (store) MF.save(s, store);
      closePanels();
      showWorld();
      return;
    }
    $('devNoHunger').textContent = 'HUNGER: ' + (s.dev.nohunger ? 'OFF' : 'ON');
    $('devPeace').textContent = 'FOES: ' + (s.dev.peace ? 'OFF' : 'ON');
    $('devNoWeight').textContent = 'CARRY LIMIT: ' + (s.dev.noweight ? 'OFF' : 'ON');
    if (store) MF.save(s, store);
    if (window.MFWorld && window.MFWorld.active) window.MFWorld.refresh();
    devMsg('done: ' + act + '. ⚡' + MF.joules(s).toLocaleString() + (window.MFLevel ? ' · LVL ' + window.MFLevel.level(s) : '') + ' · nova city ' + MF.clock(Date.now(), s.dev.shift || 0).text);
  }
  [].forEach.call(document.querySelectorAll('[data-dev]'), function (b) { b.addEventListener('click', function () { devDo(b.getAttribute('data-dev')); }); });
  $('devBtn').addEventListener('click', function () {
    toggle('dev', function () { devPlaces(); devMsg(''); $('devNoHunger').textContent = 'HUNGER: ' + (s.dev && s.dev.nohunger ? 'OFF' : 'ON'); $('devPeace').textContent = 'FOES: ' + (s.dev && s.dev.peace ? 'OFF' : 'ON'); });
  });

  /* SYS lives in the phone now (overworld.js calls this) */
  function openSys() {
    toggle('sys', function () { $('code').value = code(); $('paste').value = ''; msg(''); wipeArmed = 0; $('wipeBtn').textContent = 'WIPE THIS RUN'; onlineLabel(); });
  }
  /* SYS opens from the phone, so BACK goes back to the phone */
  $('sysBack').addEventListener('click', function () { closePanels(); if (window.MFWorld && window.MFWorld.active) window.MFWorld.openPhone(); });
  window.MFUI = { openSys: openSys };
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
    if (!MF.chippedIn(s) || s.flags['origin-repick'] || unsided()) return showChip();
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
  if (!MF.chippedIn(s) || s.flags['origin-repick'] || unsided()) showChip();
  else if (window.MFWorld && (!s.scene || MF.view(s, S).kind === 'end')) showWorld();
  else { if (!s.scene && !Object.keys(s.seen).length) MF.enter(s, S, D.start); showStage(); render(); }
})();
