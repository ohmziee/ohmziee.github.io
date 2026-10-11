/* EXiLED mindscape — the browser for the pages behind the site. build.mjs
   turns mindscape/pages/*.page into pages.js; this draws one page at a time
   inside a browser that is not quite right: an address bar, back and
   forward, a load that takes a little too long, and pages that come apart
   the deeper they are (@depth 0..3).

   Only someone who broke the seal on the main page gets in (exiled.mindscape).
   Everyone else gets a plain 404. The markup half (MSRender) has no DOM so
   the tests can run it. */
(function (root) {
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* one line: links and unstable text. escaped first, so nothing in a page
     can ever become markup */
  function inline(t) {
    return esc(t)
      .replace(/\[\[([a-z0-9-]+)(?:\|([^|\]]*))?(?:\|(hidden))?\]\]/g, function (m, id, label, hid) {
        return '<a href="#' + id + '" class="ln' + (hid ? ' hid' : '') + '" data-to="' + id + '">' + (label || id) + '</a>';
      })
      .replace(/\{\{([^}]+)\}\}/g, '<span class="unstable">$1</span>');
  }
  function renderBody(body) {
    return String(body || '').split(/\n\s*\n/).map(function (block) {
      var lines = block.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(Boolean);
      if (!lines.length) return '';
      if (lines.every(function (l) { return l.indexOf('== ') === 0; })) {
        return '<div class="rooms">' + lines.map(function (l) {
          return '<figure class="room"><div class="pic" aria-hidden="true"><i></i></div><figcaption>' + inline(l.slice(3)) + '</figcaption></figure>';
        }).join('') + '</div>';
      }
      if (lines.every(function (l) { return l.indexOf('- ') === 0; })) {
        return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.slice(2)) + '</li>'; }).join('') + '</ul>';
      }
      if (lines.length === 1 && lines[0].indexOf('# ') === 0) return '<h2>' + inline(lines[0].slice(2)) + '</h2>';
      if (lines.every(function (l) { return l.indexOf('> ') === 0; })) {
        return '<blockquote>' + lines.map(function (l) { return inline(l.slice(2)); }).join('<br>') + '</blockquote>';
      }
      if (lines.length === 1 && /^-{3,}$/.test(lines[0])) return '<hr>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('\n');
  }
  root.MSRender = { esc: esc, inline: inline, renderBody: renderBody };
  if (typeof document === 'undefined') return;

  /* ── the browser ─────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var D = root.MS_PAGES, store = null;
  try { store = root.localStorage; } catch (e) {}
  var open = false;
  try { open = !!store.getItem('exiled.mindscape'); } catch (e) {}
  if (!D || !open) { document.body.classList.add('denied'); $('denied').hidden = false; return; }
  $('browser').hidden = false;

  var hist = [], at = -1, current = null, loading = 0;
  var seen = {};
  try { seen = JSON.parse(store.getItem('exiled.ms.seen') || '{}') || {}; } catch (e) {}
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var JUNK = '█▓▒░#%&@$?!/\\|<>';
  function garble(t, amount) {
    return t.split('').map(function (c) { return c !== ' ' && Math.random() < amount ? JUNK.charAt((Math.random() * JUNK.length) | 0) : c; }).join('');
  }

  function paint(p) {
    current = p;
    var page = $('page');
    page.className = 'page s-' + p.style;
    page.innerHTML = renderBody(p.body);
    document.body.setAttribute('data-depth', String(p.depth));
    document.title = p.title + ' // mindscape';
    $('addr').value = p.addr;
    $('status').textContent = p.depth >= 2 ? 'Done, but with errors on page.' : 'Done';
    [].forEach.call(page.querySelectorAll('a.ln'), function (a) { if (seen[a.getAttribute('data-to')]) a.classList.add('seen'); });
    seen[p.id] = 1;
    try { store.setItem('exiled.ms.seen', JSON.stringify(seen)); } catch (e) {}
    $('back').disabled = at <= 0; $('fwd').disabled = at >= hist.length - 1;
    page.scrollTop = 0; try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* a load takes a little too long, and deeper pages sometimes show the
     wrong address first */
  function load(id) {
    var p = D.pages[id] || D.pages[D.start], n = ++loading;
    $('status').textContent = 'Connecting to ' + p.addr.replace(/^mindscape:\/\//, '') + '...';
    $('bar').style.transform = 'scaleX(0)';
    document.body.classList.add('loading');
    if (p.depth >= 2 && Math.random() < 0.35) $('addr').value = garble(p.addr, 0.4);
    var wait = rnd(260, 640) + p.depth * rnd(80, 260), t0 = performance.now();
    (function tick() {
      if (n !== loading) return;
      var k = Math.min(1, (performance.now() - t0) / wait);
      $('bar').style.transform = 'scaleX(' + k.toFixed(3) + ')';
      if (k < 1) return requestAnimationFrame(tick);
      document.body.classList.remove('loading');
      paint(p);
    })();
  }
  function go(id, push) {
    if (push !== false) { hist = hist.slice(0, at + 1); hist.push(id); at = hist.length - 1; }
    if (location.hash !== '#' + id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
    load(id);
  }

  $('page').addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.ln');
    if (!a) return;
    e.preventDefault(); go(a.getAttribute('data-to'));
  });
  $('back').addEventListener('click', function () { if (at > 0) { at--; go(hist[at], false); } });
  $('fwd').addEventListener('click', function () { if (at < hist.length - 1) { at++; go(hist[at], false); } });
  $('reload').addEventListener('click', function () { if (current) load(current.id); });
  /* the address bar can be typed into. it only goes where a page exists */
  $('addrForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('addr').value.trim().toLowerCase(), hit = null;
    Object.keys(D.pages).forEach(function (id) {
      var a = D.pages[id].addr.toLowerCase();
      if (v === a || v === a.replace(/\/$/, '') || v === id) hit = id;
    });
    if (hit) return go(hit);
    $('status').textContent = 'Cannot find server or DNS Error.';
    $('addr').value = current ? current.addr : '';
  });

  /* ── the page will not hold still ────────────────────────── */
  setInterval(function () {
    if (!current || document.hidden) return;
    var d = current.depth;
    [].forEach.call($('page').querySelectorAll('.unstable'), function (el) {
      if (!el.dataset.t) el.dataset.t = el.textContent;
      el.textContent = Math.random() < 0.25 + d * 0.15 ? garble(el.dataset.t, 0.15 + d * 0.1) : el.dataset.t;
    });
    if (d >= 1 && Math.random() < d * 0.035) {
      document.body.classList.add('tear');
      setTimeout(function () { document.body.classList.remove('tear'); }, 90 + Math.random() * 120);
    }
    if (d >= 3 && Math.random() < 0.05) $('addr').value = garble(current.addr, 0.3);
    else if (current && $('addr') !== document.activeElement) $('addr').value = current.addr;
  }, 140);

  /* ── the hum: off until asked for, remembered after ────────── */
  var hum = null;
  function humOn() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    var ac = new AC(), out = ac.createGain();
    out.gain.value = 0; out.connect(ac.destination);
    [[60, 0.5], [120, 0.25], [180, 0.08], [240, 0.05]].forEach(function (h) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = h[0] + rnd(-0.3, 0.3); g.gain.value = h[1]; o.connect(g); g.connect(out); o.start();
    });
    /* a little air on top: filtered noise, like the ballast is tired */
    var buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), ch = buf.getChannelData(0);
    for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    src.buffer = buf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8; ng.gain.value = 0.04;
    src.connect(bp); bp.connect(ng); ng.connect(out); src.start();
    out.gain.linearRampToValueAtTime(0.05, ac.currentTime + 1.5);
    hum = { ac: ac, out: out };
    return true;
  }
  function humOff() {
    if (!hum) return;
    var h = hum; hum = null;
    h.out.gain.linearRampToValueAtTime(0, h.ac.currentTime + 0.4);
    setTimeout(function () { h.ac.close(); }, 500);
  }
  function humPaint() { $('hum').textContent = hum ? 'hum: on' : 'hum: off'; $('hum').setAttribute('aria-pressed', String(!!hum)); }
  $('hum').addEventListener('click', function () {
    if (hum) humOff(); else humOn();
    try { store.setItem('exiled.ms.hum', hum ? '1' : ''); } catch (e) {}
    humPaint();
  });
  /* remembered on, but a browser only lets sound start after a touch */
  var wantHum = false;
  try { wantHum = !!store.getItem('exiled.ms.hum'); } catch (e) {}
  if (wantHum) document.addEventListener('pointerdown', function first() {
    document.removeEventListener('pointerdown', first);
    if (!hum && humOn()) humPaint();
  });
  humPaint();

  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    if (D.pages[id] && (!current || current.id !== id)) go(id);
  });
  go(D.pages[location.hash.slice(1)] ? location.hash.slice(1) : D.start);
})(typeof window !== 'undefined' ? window : globalThis);
