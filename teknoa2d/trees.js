/* Teknoa 2D: trees at 32px (the prettier batch, item 2).

   Every tree is a sprite sorted in with the people (overworld.js), so you
   walk behind a canopy and in front of a trunk. Each is painted once per
   (kind, district, variant) into a canvas at ART resolution and cached.

   Kinds, picked per tile by kind():
   - broad:  the city's trees. four canopy shapes (round, tall, bushy,
             small) built from leaf clumps, each lit from the top left, plus
             a pine. in the district's own tree/leaf colours
   - palm:   coconut palms: any tree within two tiles of sand (the
             seafront walks, the beaches) and the vistadelsol coves
   - banana: banana trees, among the palms in vistadelsol (BANANA_SHARE).
             'banana' carries a bunch, 'banana-bare' has been picked clean
   Variants mirror the tree, nudge the clumps and lean the palms, so no
   two neighbours look stamped.

   A canvas comes back with uw/uh (its size in 16-unit map pixels) and ox
   (how far it hangs left of its tile). Its ground line sits 3 units above
   its bottom, the way the old 16px trees did. */
(function (root) {
  'use strict';
  var OUT = '#0b0d1a', A = 2;               /* A: art pixels per map unit (overworld ART) */
  var BANANA_SHARE = 0.28;
  function rgb(h) { var n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function tone(h, f) { return hex(rgb(h).map(function (v) { return f > 1 ? v + (255 - v) * (f - 1) : v * f; })); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  /* 4x4 ordered dither, 0..1 */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  /* a pixel canvas we can paint without anti-aliasing */
  function sheet(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    return { c: c, g: g, w: w, h: h, px: function (col, x, y, ww, hh) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), ww || 1, hh || 1); } };
  }
  /* a dark line round everything opaque (the shadow goes on after this) */
  function outline(s) {
    var d = s.g.getImageData(0, 0, s.w, s.h), a = d.data, w = s.w, h = s.h, add = [], o = rgb(OUT);
    function on(x, y) { return x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 128; }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) add.push(y * w + x);
    add.forEach(function (i) { a[i * 4] = o[0]; a[i * 4 + 1] = o[1]; a[i * 4 + 2] = o[2]; a[i * 4 + 3] = 255; });
    s.g.putImageData(d, 0, 0);
  }
  /* paint one piece on its own layer, outline it, lay it on: overlapping
     leaves and fronds each keep their own dark edge */
  function part(s, fn) { var t = sheet(s.w, s.h); t.px = t.px; fn(t); outline(t); s.g.drawImage(t.c, 0, 0); }
  /* the shadow on the ground: a flat oval, its rim dithered away */
  function shadow(s, cx, cy, rx, ry, alpha) {
    s.g.fillStyle = 'rgba(0,0,0,' + (alpha || 0.3) + ')';
    for (var y = Math.floor(cy - ry); y <= cy + ry; y++) for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, r = dx * dx + dy * dy;
      if (r <= 1 && (r < 0.7 || dith(x, y) > (r - 0.7) / 0.3)) s.g.fillRect(x, y, 1, 1);
    }
  }
  /* a finished tree: shadow under the outlined art, sized for overworld */
  function done(art, uw, uh, ox, sh) {
    var s = sheet(art.w, art.h);
    if (sh) shadow(s, sh[0], sh[1], sh[2], sh[3], sh[4]);
    s.g.drawImage(art.c, 0, 0);
    s.c.uw = uw; s.c.uh = uh; s.c.ox = ox;
    return s.c;
  }
  /* five tones from the district's tree and leaf colours */
  function leafRamp(p) { return [tone(p.tree, 0.55), tone(p.tree, 0.8), p.tree, mix(p.tree, p.leaf, 0.55), p.leaf, tone(p.leaf, 1.25)]; }
  /* stamp a round brush along a quadratic curve: thick lines, no blur */
  function curve(s, col, x0, y0, qx, qy, x1, y1, w0, w1) {
    var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 2;
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t, x = u * u * x0 + 2 * u * t * qx + t * t * x1, y = u * u * y0 + 2 * u * t * qy + t * t * y1, r = (w0 + (w1 - w0) * t) / 2;
      s.px(col, x - r, y - r, Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2)));
    }
  }
  function point(x0, y0, qx, qy, x1, y1, t) { var u = 1 - t; return [u * u * x0 + 2 * u * t * qx + t * t * x1, u * u * y0 + 2 * u * t * qy + t * t * y1]; }

  /* ── broad trees: clumps of leaves on a trunk ───────────────── */
  var BW = 24, BH = 30, BOX = 4, BG = (BH - 3) * A;   /* canvas 48 x 60, ground at y 54 */
  var BROAD = {
    round: { trunk: 34, clumps: [[16, 22, 10, 9], [32, 22, 10, 9], [24, 13, 11, 10], [16, 31, 9, 7], [32, 31, 9, 7], [24, 28, 11, 8]] },
    tall:  { trunk: 36, clumps: [[24, 9, 8, 8], [18, 18, 8, 9], [30, 18, 8, 9], [24, 25, 10, 8], [19, 31, 7, 6], [29, 31, 7, 6]] },
    bushy: { trunk: 40, clumps: [[24, 22, 13, 10], [12, 30, 9, 8], [36, 30, 9, 8], [18, 36, 8, 6], [30, 36, 8, 6], [24, 33, 9, 7]] },
    small: { trunk: 40, clumps: [[24, 24, 8, 7], [18, 32, 8, 7], [30, 32, 8, 7], [24, 36, 9, 6]] }
  };
  var SHAPES = ['round', 'tall', 'bushy', 'small', 'pine'];
  function trunk(s, x, top, bot, w, bark) {
    var lit = tone(bark, 1.3), dark = tone(bark, 0.65);
    for (var y = top; y <= bot; y++) {
      var flare = y > bot - 3 ? (y - (bot - 3)) : 0;
      s.px(bark, x - w / 2 - flare, y, w + flare * 2, 1);
      s.px(lit, x - w / 2 - flare, y, 1 + (w > 5 ? 1 : 0), 1);
      s.px(dark, x + w / 2 + flare - 2, y, 2, 1);
      if ((y * 7 + x) % 9 === 0) s.px(dark, x - 1, y, 1, 2);
    }
  }
  function broad(p, v) {
    var name = SHAPES[v % 5], flip = v >= 5, s = sheet(BW * A, BH * A), R = leafRamp(p), bark = '#5a3a22';
    if (name === 'pine') return pine(p, v);
    var spec = BROAD[name];
    /* nudge each clump a pixel or two by the variant */
    var clumps = spec.clumps.map(function (c, i) {
      return [c[0] + Math.round((hash(v * 7 + i, 3) - 0.5) * 3), c[1] + Math.round((hash(v * 5 + i, 9) - 0.5) * 3), c[2], c[3]];
    });
    trunk(s, 24, spec.trunk, BG, 6, bark);
    /* a branch or two showing between the clumps */
    curve(s, tone(bark, 0.85), 24, spec.trunk + 2, 22, spec.trunk - 6, 17, spec.trunk - 10, 2, 1);
    curve(s, tone(bark, 0.85), 24, spec.trunk + 1, 27, spec.trunk - 5, 31, spec.trunk - 9, 2, 1);
    /* back clumps first, so the lower ones sit in front */
    clumps.slice().sort(function (a, b) { return a[1] - b[1]; }).forEach(function (c, i) {
      for (var y = Math.floor(c[1] - c[3]); y <= c[1] + c[3]; y++) for (var x = Math.floor(c[0] - c[2]); x <= c[0] + c[2]; x++) {
        var dx = (x + 0.5 - c[0]) / c[2], dy = (y + 0.5 - c[1]) / c[3], r = dx * dx + dy * dy;
        /* a ragged rim: leaves, not a balloon */
        if (r > 1 || (r > 0.82 && hash(x * 13 + v, y * 7 + i) < 0.45)) continue;
        /* lit from the top left; the rim of each clump a step darker */
        var lt = -(dx * 0.6 + dy * 0.8) * 0.5 + 0.5 - (r > 0.72 ? 0.18 : 0), band = lt * 4.4 + dith(x, y) - 0.5;
        s.px(R[Math.max(0, Math.min(4, Math.round(band)))], x, y);
      }
      /* leaf marks: bright pairs up top, dark specks underneath */
      for (var k = 0; k < c[2] * 1.6; k++) {
        var ax = c[0] + (hash(k * 3 + i, v + 11) - 0.5) * c[2] * 1.5, ay = c[1] + (hash(k * 5 + i, v + 23) - 0.5) * c[3] * 1.5;
        var up = (ax - c[0]) / c[2] + (ay - c[1]) / c[3] < -0.1;
        s.px(up ? R[5] : R[1], ax, ay, up ? 2 : 1, 1);
      }
    });
    outline(s);
    if (flip) mirror(s);
    return done(s, BW, BH, BOX, [25, BG + 1, 13, 3.4]);
  }
  function pine(p, v) {
    var s = sheet(BW * A, BH * A), R = leafRamp(p), flip = v >= 5;
    trunk(s, 24, 42, BG, 5, '#4a3020');
    var tiers = 4, top0 = 3 + (v % 3);
    for (var t = tiers - 1; t >= 0; t--) {
      var top = top0 + t * 9, h = 15, hw = 7 + t * 3.6;
      for (var y = top; y < top + h; y++) {
        var f = (y - top) / h, half = hw * f + 1;
        for (var x = Math.floor(24 - half); x <= 24 + half; x++) {
          /* a jagged lower hem on each tier */
          if (y > top + h - 3 && hash(x * 3 + t, y + v) < 0.5 - (top + h - y) * 0.15) continue;
          var dx = (x + 0.5 - 24) / Math.max(1, half), lt = 0.62 - dx * 0.45 - f * 0.35, band = lt * 4.4 + dith(x, y) - 0.5;
          s.px(R[Math.max(0, Math.min(4, Math.round(band)))], x, y);
        }
      }
      for (var k = 0; k < 5; k++) s.px(R[5], 24 - hw * 0.5 + hash(k, t * 9 + v) * hw * 0.6, top + 4 + hash(t, k + v) * 8, 2, 1);
    }
    outline(s);
    if (flip) mirror(s);
    return done(s, BW, BH, BOX, [25, BG + 1, 11, 3.2]);
  }
  function mirror(s) {
    var t = sheet(s.w, s.h); t.g.translate(s.w, 0); t.g.scale(-1, 1); t.g.drawImage(s.c, 0, 0);
    s.g.clearRect(0, 0, s.w, s.h); s.g.drawImage(t.c, 0, 0);
  }

  /* ── palms: a ringed trunk that leans, a crown of fronds ────── */
  var PW = 28, PH = 40, POX = 6, PG = (PH - 3) * A;   /* canvas 56 x 80, ground at y 74 */
  function palm(p, v) {
    var s = sheet(PW * A, PH * A), lean = (v % 2 ? 1 : -1) * (3 + (v % 3) * 2), bx = 28, cx = 28 + lean, cy = 20 + (v % 4);
    var G = [tone('#2f6a2a', 0.6), '#2f6a2a', '#3f8a32', '#5aa83e', '#7cc84a'];
    var bark = '#8a6a44', ring = '#5e4630', lit = '#b08c5c';
    /* the trunk: a gentle bow, rings every few pixels, lit on the left */
    var qx = bx + lean * 0.15, qy = (PG + cy) / 2;
    for (var i = 0, n = 60; i <= n; i++) {
      var t = i / n, q = point(bx, PG, qx, qy, cx, cy + 3, t), w = 6.5 - t * 2.5;
      s.px(bark, q[0] - w / 2, q[1], Math.round(w), 1);
      s.px(lit, q[0] - w / 2, q[1], 1, 1);
      if (i % 4 === 0) s.px(ring, q[0] - w / 2, q[1], Math.round(w), 1);
    }
    /* the fronds: a spine out from the crown that arcs and droops, its
       leaflets combed down and back. the back ones darker */
    var fr = [[-150, 0.9], [-30, 0.9], [-100, 0.75], [-75, 0.75], [170, 1], [10, 1], [-125, 1], [-55, 1], [140, 0.85], [40, 0.85]];
    fr.forEach(function (f, k) {
      var a = (f[0] + (hash(v, k) - 0.5) * 16) * Math.PI / 180, len = 21 * f[1] + hash(k, v + 3) * 3, back = k < 4;
      var ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len * 0.55 + len * 0.32, mx = cx + Math.cos(a) * len * 0.6, my = cy + Math.sin(a) * len * 0.7 - 5;
      var c0 = back ? G[1] : G[2], c1 = back ? G[2] : G[3];
      part(s, function (s) {
      for (var j = 2; j <= 16; j++) {
        var t = j / 16, q = point(cx, cy, mx, my, ex, ey, t), q2 = point(cx, cy, mx, my, ex, ey, Math.min(1, t + 0.06));
        var tx = q2[0] - q[0], ty = q2[1] - q[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, ll = (1 - t) * 4.5 + 1.5;
        /* leaflets hang both sides, pulled downwards */
        [1, -1].forEach(function (sd) {
          for (var m = 1; m <= ll; m++) s.px(m > ll * 0.6 ? c0 : c1, q[0] + nx * sd * m, q[1] + ny * sd * m + m * 0.4);
        });
      }
      curve(s, back ? G[2] : G[4], cx, cy, mx, my, ex, ey, 1.5, 1);
      });
    });
    /* coconuts under the crown */
    [[-2, 3], [2, 4], [0, 6]].forEach(function (o, k) { if (k < 2 + (v % 2)) { s.px('#4a3018', cx + o[0] - 1.5, cy + o[1] - 1, 3, 3); s.px('#7a5430', cx + o[0] - 1.5, cy + o[1] - 1, 1, 1); } });
    outline(s);
    return done(s, PW, PH, POX, [28 + lean * 0.6, PG + 1, 12, 3.2, 0.26]);
  }

  /* ── banana trees: a clump of soft stems under huge paddle leaves,
     a hanging bunch with its purple bud. bare: the bunch is gone ── */
  var NW = 26, NH = 34, NOX = 5, NG = (NH - 3) * A;   /* canvas 52 x 68, ground at y 62 */
  function banana(p, v, bare) {
    var s = sheet(NW * A, NH * A), flip = v % 2;
    var L = ['#2c5a1e', '#3f7a26', '#58a032', '#7ec444', '#a8e060'];
    var stem = '#7a9440', stemD = '#556a2c', stemL = '#a4bc68';
    var top = 33 + (v % 3), sx = 26;
    /* an old leaf, brown, hanging down the stem (behind it) */
    leaf(s, sx + 1, top + 2, sx - 9, top + 19, 2.6, ['#4a3a1e', '#6a5428', '#8a6e34', '#a88a44', '#c0a050'], v + 9, true);
    /* the stem: one fat trunk of wrapped leaf sheaths, a sucker beside it */
    function stalk(x, y0, w) {
      for (var y = y0; y <= NG; y++) {
        var wob = Math.round(Math.sin((y + v * 3) / 5) * 0.4), ww = w + (y > NG - 3 ? 1 : 0);
        s.px(stem, x - ww / 2 + wob, y, ww, 1); s.px(stemL, x - ww / 2 + wob, y, 1, 1); s.px(stemD, x + ww / 2 - 1 + wob, y, 1, 1);
        if ((y * 3 + v) % 11 === 0) s.px(stemD, x - ww / 2 + wob + 1, y, ww - 2, 1);
      }
    }
    if (v % 3 !== 0) stalk(sx + 7, top + 13, 3);
    stalk(sx, top, 6);
    /* the leaves: a fountain of long paddles, rising from the top of the
       stem and arching out, tips bowed. back ones darker, drawn first */
    var spec = [[-172, 20, 1], [-8, 20, 1], [-122, 22, 1], [-58, 22, 1], [-148, 22, 0], [-32, 22, 0], [-90, 19, 0]];
    spec.forEach(function (f, k) {
      var a = (f[0] + (hash(v * 3, k) - 0.5) * 12) * Math.PI / 180, len = f[1] + hash(k, v) * 3, ox = sx, oy = top + 1;
      var ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len * 0.6 + len * 0.14;
      var qx = ox + Math.cos(a) * len * 0.5, qy = oy + Math.sin(a) * len * 1.05 - 2;
      part(s, function (s) { leafQ(s, ox, oy, qx, qy, ex, ey, 3.3 + hash(v, k + 5) * 0.9, f[2] ? L.map(function (c) { return tone(c, 0.78); }) : L, v * 7 + k); });
    });
    if (!bare) {
      /* the bunch: a stalk curving out and down, hands of fingers, the bud */
      var dir = flip ? -1 : 1, bxx = sx + dir * 6, byy = top + 5;
      curve(s, '#5a6a2a', sx + dir * 2, top + 1, bxx + dir * 2, top - 1, bxx, byy, 2, 2);
      for (var r = 0; r < 4; r++) {
        var ry = byy + r * 3, rw = 10 - r * 2;
        for (var f2 = 0; f2 < rw; f2 += 2) {
          var fx = bxx - rw / 2 + f2, ripe = hash(f2 + r * 5, v) < 0.7;
          s.px(ripe ? '#e8d04a' : '#b4c83c', fx, ry, 2, 3);
          s.px(ripe ? '#fff3a0' : '#d0e070', fx, ry, 1, 1);
          s.px('#8a7224', fx + 1, ry + 2, 1, 1);
        }
      }
      s.px('#6a2448', bxx - 1.5, byy + 12, 3, 4); s.px('#9a4468', bxx - 1.5, byy + 12, 1, 2); s.px('#6a2448', bxx - 0.5, byy + 16, 1, 1);
    } else {
      /* where the bunch was: a cut stalk */
      var d2 = flip ? -1 : 1;
      curve(s, '#5a6a2a', sx + d2 * 2, top + 1, sx + d2 * 6, top - 1, sx + d2 * 6, top + 4, 2, 2);
      s.px('#d8c080', sx + d2 * 6 - 1, top + 4, 2, 1);
    }
    outline(s);
    if (flip) mirror(s);
    return done(s, NW, NH, NOX, [26, NG + 1, 11, 3, 0.28]);
  }
  /* a paddle leaf along a quadratic midrib (x0,y0) (qx,qy) (x1,y1) */
  function leafQ(s, x0, y0, qx, qy, x1, y1, wide, R, seed) {
    for (var j = 0; j <= 30; j++) {
      var t = j / 30, q = point(x0, y0, qx, qy, x1, y1, t), q2 = point(x0, y0, qx, qy, x1, y1, Math.min(1, t + 0.04));
      var tx = q2[0] - q[0], ty = q2[1] - q[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      var w = (t < 0.12 ? t / 0.12 * 0.4 : 1) * wide * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9)) + 0.4;
      for (var m = -w; m <= w; m += 0.5) {
        if (Math.abs(m) > w * 0.55 && t > 0.2 && hash(j * 7 + seed, Math.round(m * 2) + 40) < 0.1) continue;   /* tears */
        var up = (m * ny < 0), band = up ? (Math.abs(m) < w * 0.5 ? 3 : 2) : (Math.abs(m) < w * 0.5 ? 2 : 1);
        s.px(R[band], q[0] + nx * m, q[1] + ny * m);
      }
      if (t > 0.1 && t < 0.95) s.px(R[4], q[0], q[1]);
    }
  }
  /* a paddle leaf from (x0,y0) to (x1,y1): widest near the middle, a pale
     midrib, lit on its upper side, the odd tear along the edge */
  function leaf(s, x0, y0, x1, y1, wide, R, seed, droop) {
    var mx = (x0 + x1) / 2, my = Math.min(y0, y1) - (droop ? -4 : 7);
    for (var j = 0; j <= 24; j++) {
      var t = j / 24, q = point(x0, y0, mx, my, x1, y1, t), q2 = point(x0, y0, mx, my, x1, y1, Math.min(1, t + 0.05));
      var tx = q2[0] - q[0], ty = q2[1] - q[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      var w = wide * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.5;
      for (var m = -w; m <= w; m += 0.5) {
        if (Math.abs(m) > w * 0.6 && hash(j * 7 + seed, Math.round(m * 2) + 40) < 0.12) continue;   /* tears */
        var up = (m * ny < 0), band = up ? (Math.abs(m) < w * 0.5 ? 3 : 2) : (Math.abs(m) < w * 0.5 ? 2 : 1);
        s.px(R[band], q[0] + nx * m, q[1] + ny * m);
      }
      if (t > 0.08 && t < 0.92) s.px(R[4], q[0], q[1]);
    }
  }

  /* ── which tree grows where ─────────────────────────────────── */
  function kind(world, x, y, T) {
    var d = world.dist[y * world.W + x];
    if (d === -2) return hash(x * 7 + 3, y * 11 + 5) < BANANA_SHARE ? 'banana' : 'palm';
    for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
      var xx = x + ox, yy = y + oy;
      if (xx >= 0 && yy >= 0 && xx < world.W && yy < world.H && world.tile[yy * world.W + xx] === T.SAND) return 'palm';
    }
    return 'broad';
  }
  var cache = {};
  function canvas(k, di, v, p) {
    var key = k + '.' + di + '.' + v;
    if (cache[key]) return cache[key];
    var c = k === 'palm' ? palm(p, v) : k === 'banana' ? banana(p, v, false) : k === 'banana-bare' ? banana(p, v, true) : broad(p, v);
    return (cache[key] = c);
  }

  root.MFTrees = { kind: kind, canvas: canvas, BANANA_SHARE: BANANA_SHARE, SHAPES: SHAPES };
})(typeof window !== 'undefined' ? window : this);
