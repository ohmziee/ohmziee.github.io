/* Teknoa 2D: the street's landmarks at 32px (the art revamp, phase 5c).

   Each one fills its footprint (w x h tiles, 32px a tile) in the 3/4 view:
   the roof seen from above along the top, the front below it, the door on
   the bottom row where overworld.js DOOR_PX (or the middle) says it is, so
   walking in still lines up. Indoor things keep their old art for now.

   Most are shopfronts built by front(): a material, a roof, a sign in
   neon letters, windows, maybe an awning, the door. The odd shapes (the
   lighthouse, the pagoda, the great tree, the fountain, the fires) are
   drawn by hand. PLACEHOLDER colours and words, all of them. */
(function (root) {
  'use strict';
  var OUT = '#0b0d1a';
  function rgb(h) { var n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function tone(h, f) { return '#' + rgb(h).map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))).toString(16)).slice(-2); }).join(''); }
  function ramp(h) { return [tone(h, 0.55), tone(h, 0.75), h, tone(h, 1.18), tone(h, 1.38)]; }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /* a 3 x 5 pixel font for signs */
  var FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
    H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '101111111111101',
    O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
    V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
    '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001110', '/': '001001010100100', '-': '000000111000000', '+': '000010111010000', ' ': '000000000000000', '.': '000000000000010' };

  function kit(g) {
    function px(c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w || 1, h || 1); }
    function text(t, x, y, col, sc) { sc = sc || 1; for (var i = 0; i < t.length; i++) { var f = FONT[t[i]] || FONT[' ']; for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (f[r * 3 + c] === '1') px(col, x + i * 4 * sc + c * sc, y + r * sc, sc, sc); } }
    function textW(t, sc) { return t.length * 4 * (sc || 1) - (sc || 1); }
    /* a neon sign: a dark board, a dim tube shadow, the bright tube */
    function neon(t, cx, y, col, sc, board) {
      sc = sc || 2; var w = textW(t, sc), x = Math.round(cx - w / 2);
      if (board !== false) { px(OUT, x - 4, y - 4, w + 8, 5 * sc + 8); px(board || '#14101e', x - 3, y - 3, w + 6, 5 * sc + 6); }
      text(t, x + 1, y + 1, tone(col, 0.45), sc); text(t, x, y, col, sc);
    }
    function wall(kind, R, x0, y0, w, h, seed) {
      var x, y;
      if (kind === 'brick') {
        for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) {
          var row = (y - y0) >> 2, joint = (y - y0) % 4 === 3 || (x + (row % 2) * 4) % 8 === 7, br = hash((x + (row % 2) * 4) >> 3, row * 7 + seed);
          px(joint ? R[0] : br < 0.18 ? R[1] : br > 0.88 ? R[3] : R[2], x, y);
        }
      } else if (kind === 'wood') {
        px(R[2], x0, y0, w, h);
        for (x = x0; x < x0 + w; x += 6) { px(R[1], x + 5, y0, 1, h); px(R[3], x, y0, 1, h); }
        for (var i = 0; i < w * h / 40; i++) px(R[1], x0 + (hash(i, seed) * w | 0), y0 + (hash(seed, i) * h | 0), 1, 2);
      } else if (kind === 'metal') {
        px(R[2], x0, y0, w, h);
        for (x = x0; x < x0 + w; x += 4) { px(R[3], x, y0, 1, h); px(R[1], x + 2, y0, 1, h); }
      } else if (kind === 'glass') {
        px(R[1], x0, y0, w, h);
        for (y = y0; y < y0 + h; y += 12) for (x = x0; x < x0 + w; x += 10) { px(R[2], x + 1, y + 1, 8, 10); px(R[3], x + 1, y + 1, 3, 1); px(R[4], x + 1, y + 1, 1, 4); }
      } else {
        /* stucco or concrete: flat, a little noise, panel lines */
        px(R[2], x0, y0, w, h);
        for (var j = 0; j < w * h / 18; j++) px(hash(j, seed) < 0.5 ? R[1] : R[3], x0 + (hash(j * 3, seed) * w | 0), y0 + (hash(seed, j * 5) * h | 0));
        if (kind === 'concrete') for (y = y0 + 15; y < y0 + h; y += 16) px(R[1], x0, y, w, 1);
      }
    }
    function roof(kind, R, w, h) {
      var x, y;
      if (kind === 'tile') {
        /* clay tiles in scalloped rows, the eave's dark lip */
        px(R[2], 0, 0, w, h);
        for (y = 0; y < h - 4; y += 5) for (x = (y / 5) % 2 ? 0 : 3; x < w; x += 6) { px(R[3], x, y, 5, 1); px(R[1], x, y + 3, 6, 1); px(R[0], x + 5, y, 1, 4); }
        px(R[0], 0, h - 4, w, 2); px(OUT, 0, h - 2, w, 2);
        return;
      }
      px(R[2], 0, 0, w, h);
      for (y = 4; y < h - 4; y += 8) { px(R[1], 0, y, w, 1); px(R[3], 0, y + 1, w, 1); }
      for (var i = 0; i < w * h / 30; i++) px(hash(i, w) < 0.6 ? R[1] : R[3], (hash(w, i) * w) | 0, (hash(i * 7, h) * h) | 0);
      px(R[4], 0, 0, w, 2); px(R[4], 0, 0, 3, h); px(R[0], w - 4, 0, 4, h);
      px(R[3], 0, h - 5, w, 2); px(R[1], 0, h - 3, w, 3);
    }
    function windowAt(x, y, w, h, lit, frame) {
      px(OUT, x - 2, y - 2, w + 4, h + 4); px(frame, x - 1, y - 1, w + 2, h + 2);
      px(lit || '#141a2e', x, y, w, h);
      if (lit) { px(tone(lit, 1.35), x, y, w, 2); px(tone(lit, 0.72), x, y + h - 2, w, 2); }
      else { px('#232b48', x + 1, y + 1, 1, h - 2); px('#232b48', x + 2, y + 1, 1, 1); }
      px(tone(frame, 1.25), x - 2, y + h + 2, w + 4, 1);
    }
    function awning(x0, x1, y, a, b, depth) {
      depth = depth || 9;
      for (var x = x0; x < x1; x++) { var s = ((x - x0) >> 3) % 2; px(s ? a : b, x, y, 1, depth); px(tone(s ? a : b, 0.7), x, y + depth, 1, 2); }
      for (var sx = x0; sx < x1; sx += 8) px(((sx - x0) >> 3) % 2 ? a : b, sx + 2, y + depth + 2, 4, 2);
      px(OUT, x0, y - 1, x1 - x0, 1);
    }
    function door(x0, x1, H, kind, glow, R) {
      var w = x1 - x0, top = H - 26;
      px(OUT, x0, top - 1, w, 27);
      if (kind === 'glass') { px('#1a2a3a', x0 + 1, top, w - 2, 25); px('#3a5a7a', x0 + 2, top + 1, 2, 22); px(OUT, x0 + (w >> 1), top, 1, 25); px('#c8ccd8', x0 + (w >> 1) - 3, top + 12, 2, 4); px('#c8ccd8', x0 + (w >> 1) + 2, top + 12, 2, 4); }
      else if (kind === 'steel') { px('#4f5970', x0 + 1, top, w - 2, 25); for (var y = top + 3; y < top + 25; y += 6) px('#343b4e', x0 + 2, y, w - 4, 1); px('#727e98', x0 + 1, top, 1, 25); }
      else { R = R || ramp('#4a2e1c'); px(R[1], x0 + 1, top, w - 2, 25); px(R[2], x0 + 3, top + 6, (w >> 1) - 4, 17); px(R[2], x0 + (w >> 1) + 1, top + 6, (w >> 1) - 4, 17); px(R[3], x0 + 3, top + 6, 1, 17); px('#ffe97c', x1 - 6, top + 14, 2, 2); }
      if (glow) { px(glow, x0 + 1, top, w - 2, 3); px(tone(glow, 1.4), x0 + 1, top, w - 2, 1); }
      px('#6c658c', x0 - 1, H - 2, w + 2, 1);
    }
    function frame(w, h) { px(OUT, 0, 0, w, 1); px(OUT, 0, h - 1, w, 1); px(OUT, 0, 0, 1, h); px(OUT, w - 1, 0, 1, h); }
    function oval(c, cx, cy, rx, ry) { for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(c, cx + x, cy + y); }
    return { px: px, text: text, textW: textW, neon: neon, wall: wall, roof: roof, windowAt: windowAt, awning: awning, door: door, frame: frame, oval: oval };
  }

  /* a shopfront: the roof band, the wall, a cornice, the rest by o */
  function front(g, W, H, o, dspan) {
    var K = kit(g), R = ramp(o.wall), RF = ramp(o.roof || '#221d42'), rh = o.roofH || 16;
    K.roof(o.roofKind || 'tar', RF, W, rh);
    K.wall(o.kind || 'brick', R, 0, rh, W, H - rh, W + H);
    K.px(o.trim || tone(o.wall, 1.3), 0, rh, W, 3); K.px(tone(o.trim || tone(o.wall, 1.3), 0.65), 0, rh + 3, W, 1);
    K.px(R[0], 0, H - 4, W, 3);
    if (o.paint) o.paint(K, W, H, rh, R);
    if (dspan) K.door(dspan[0], dspan[1], H, o.door || 'wood', o.doorGlow, o.doorR);
    K.frame(W, H);
  }
  function span(x0, x1) { return [x0, x1]; }

  var ART = {
    arcade: function (g, W, H, d) {
      front(g, W, H, { wall: '#661f2e', roof: '#1f1a3d', doorGlow: '#ff4fd8', paint: function (K, W, H, rh) {
        /* the big window, all cabinets */
        K.px(OUT, 8, 34, 72, 26); K.px('#2a1048', 9, 35, 70, 24); K.px('#ff9de2', 9, 35, 70, 1);
        for (var i = 0; i < 5; i++) { var x = 12 + i * 13; K.px('#15122b', x, 40, 10, 19); K.px(i % 2 ? '#7cf5ff' : '#ff4fd8', x + 2, 42, 6, 5); K.px('#3d3468', x + 1, 50, 8, 2); }
        K.neon('ARCADE', 44, rh + 6, '#ff4fd8', 2);
        /* the knife */
        K.px('#c8ccd8', 82, rh + 7, 12, 3); K.px('#f4f6ff', 82, rh + 7, 12, 1); K.px('#5c3a22', 94, rh + 6, 6, 5);
      } }, d);
    },
    greasepit: function (g, W, H, d) {
      front(g, W, H, { kind: 'wood', wall: '#5c3a22', roof: '#2c2552', doorGlow: '#ffd36a', doorR: ramp('#6a1414'), paint: function (K, W, H, rh) {
        K.awning(0, W, rh + 4, '#c4473a', '#f4f6ff', 7);
        K.px(OUT, 6, 38, 52, 20); K.px('#8a7a5a', 7, 39, 50, 18); K.px('#e8d8a8', 7, 39, 50, 1);
        for (var i = 0; i < 14; i++) K.px('#c8b88a', 9 + (hash(i, 9) * 44 | 0), 41 + (hash(9, i) * 13 | 0), 3, 2);
        K.neon('GREASE PIT', 32, 22, '#ffd36a', 1);
      } }, d);
    },
    noodlebar: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#2c2552', roof: '#1c1736', doorGlow: '#ffd36a', doorR: ramp('#7a1a1a'), paint: function (K, W, H, rh) {
        /* no sign: a steamed-up window with heads in it, a red lantern */
        K.px(OUT, 6, 30, 48, 26); K.px('#c8ccd8', 7, 31, 46, 24); K.px('#f4f6ff', 7, 31, 46, 2);
        [12, 26, 40].forEach(function (x) { K.oval('#8a8fa6', x, 44, 4, 5); K.px('#8a8fa6', x - 6, 49, 12, 6); });
        K.px('#9aa0b8', 7, 50, 46, 2);
        K.px(OUT, 67, rh + 3, 10, 14); K.px('#c4473a', 68, rh + 4, 8, 12); K.px('#ffd36a', 70, rh + 6, 4, 8); K.px('#5a1414', 68, rh + 9, 8, 1); K.px('#ffd36a', 71, rh + 16, 2, 3);
      } }, d);
    },
    teahouse: function (g, W, H, d) {
      front(g, W, H, { kind: 'wood', wall: '#3a2420', roof: '#a83030', roofKind: 'tile', roofH: 18, doorGlow: '#ff6a3a', paint: function (K, W, H, rh) {
        /* the eaves turn up at the ends */
        K.px('#a83030', 0, rh - 6, 4, 3); K.px('#a83030', W - 4, rh - 6, 4, 3); K.px(OUT, 0, rh - 7, 3, 1); K.px(OUT, W - 3, rh - 7, 3, 1);
        /* paper window in a lattice */
        K.px(OUT, 8, 30, 36, 24); K.px('#f2e4b8', 9, 31, 34, 22);
        for (var x = 9; x < 43; x += 6) K.px('#5a3a22', x, 31, 1, 22); for (var y = 31; y < 53; y += 6) K.px('#5a3a22', 9, y, 34, 1);
        K.px(OUT, 50, rh + 4, 8, 12); K.px('#ff6a3a', 51, rh + 5, 6, 10); K.px('#ffd36a', 53, rh + 7, 2, 6);
        K.neon('TEA', 30, rh + 4, '#ffd36a', 1, '#2a1410');
      } }, d);
    },
    backroom: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#3a3446', roof: '#1f1a3d', door: 'steel', paint: function (K, W, H, rh) {
        /* graffiti, a pipe, nothing that says what's inside */
        [[8, 34, '#ff4fd8'], [12, 36, '#ff4fd8'], [16, 33, '#7cffb2'], [20, 37, '#7cffb2'], [70, 30, '#7cf5ff'], [74, 32, '#7cf5ff'], [78, 30, '#7cf5ff']].forEach(function (s) { K.px(s[2], s[0], s[1], 4, 2); K.px(tone(s[2], 0.6), s[0] + 1, s[1] + 2, 2, 3); });
        K.px('#4f5970', 86, rh + 2, 3, H - rh - 6); K.px('#727e98', 86, rh + 2, 1, H - rh - 6);
        K.px('#ffe97c', d[0] + 2, H - 3, d[1] - d[0] - 4, 1);
      } }, d);
    },
    lockup: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#4a4560', roof: '#1f1a3d', door: 'steel', paint: function (K, W, H, rh) {
        /* barred slits and a small crescent on the door */
        [10, 70].forEach(function (x) { K.px(OUT, x, 30, 16, 10); K.px('#141a2e', x + 1, 31, 14, 8); for (var b = x + 2; b < x + 15; b += 3) K.px('#8a92a6', b, 31, 1, 8); });
        var cx = (d[0] + d[1]) >> 1; K.oval('#f2e4b8', cx, 44, 3, 3); K.oval('#4f5970', cx + 2, 43, 3, 3);
      } }, d);
    },
    mart: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#2f5a6a', roof: '#1f2a3d', door: 'glass', doorGlow: '#7cf5ff', paint: function (K, W, H, rh) {
        K.awning(0, W, rh + 4, '#2f8a6a', '#f4f6ff', 6);
        /* shelves through the glass on both sides of the door */
        [[4, d[0] - 4], [d[1] + 4, W - 4]].forEach(function (s) {
          if (s[1] - s[0] < 8) return;
          K.px(OUT, s[0], 32, s[1] - s[0], 24); K.px('#bfe9ff', s[0] + 1, 33, s[1] - s[0] - 2, 22);
          for (var y = 38; y < 54; y += 7) { K.px('#5a6070', s[0] + 1, y, s[1] - s[0] - 2, 1); for (var x = s[0] + 2; x < s[1] - 3; x += 4) K.px(['#ff6a3a', '#ffd36a', '#7cffb2', '#ff4fd8'][(x + y) % 4], x, y - 3, 3, 3); }
        });
        K.neon('24/7', W / 2, 31, '#7cf5ff', 1, false);
      } }, d);
    },
    pawn: function (g, W, H, d) {
      front(g, W, H, { wall: '#3a1a1a', roof: '#1f1a3d', door: 'steel', doorGlow: '#ffd36a', paint: function (K, W, H, rh) {
        [[4, d[0] - 4], [d[1] + 4, W - 4]].forEach(function (s) {
          if (s[1] - s[0] < 8) return;
          K.px(OUT, s[0], 32, s[1] - s[0], 22); K.px('#2a2030', s[0] + 1, 33, s[1] - s[0] - 2, 20);
          K.px('#ffd36a', s[0] + 3, 44, 4, 3); K.px('#c8ccd8', s[0] + 9, 40, 3, 7);
          for (var b = s[0] + 2; b < s[1] - 1; b += 4) K.px('#8a92a6', b, 33, 1, 20);
        });
        /* three gold balls */
        K.px('#8a92a6', W / 2 - 1, rh + 2, 2, 4); [[-5, 6], [5, 6], [0, 11]].forEach(function (b) { K.oval('#e8b13a', W / 2 + b[0], rh + b[1], 3, 3); K.px('#ffe97c', W / 2 + b[0] - 1, rh + b[1] - 2, 1, 1); });
        K.neon('PAWN', W / 2, rh + 18, '#ffd36a', 1, false);
      } }, d);
    },
    apt: function (g, W, H, d) {
      front(g, W, H, { wall: '#5a3a3a', roof: '#221d42', doorGlow: '#ffe97c', paint: function (K, W, H, rh) {
        for (var i = 0; i < 4; i++) K.windowAt(6 + i * 23, 24, 10, 12, (i * 7 + W) % 3 ? '#ffd98a' : null, '#9c6a5a');
        K.px('#8a92a6', W - 6, 30, 2, 24); for (var y = 32; y < 54; y += 5) K.px('#8a92a6', W - 10, y, 6, 1);   /* a fire escape ladder */
        K.px('#c8ccd8', d[1] + 2, H - 18, 3, 5); K.px('#7cffb2', d[1] + 3, H - 17, 1, 1);                     /* the buzzer */
      } }, d);
    },
    barber: function (g, W, H, d) {
      front(g, W, H, { kind: 'stucco', wall: '#dce3ff', roof: '#2a3248', door: 'glass', doorGlow: '#ff4f5e', paint: function (K, W, H, rh) {
        K.px(OUT, 6, 30, d[0] - 12, 24); K.px('#bfe9ff', 7, 31, d[0] - 14, 22); K.oval('#2a2f3d', 18, 42, 5, 5); K.px('#c4473a', 13, 46, 10, 6);
        /* the pole, red and white and blue */
        var x = W - 12; K.px(OUT, x - 1, 26, 6, 30); for (var y = 27; y < 55; y++) K.px(['#c4473a', '#f4f6ff', '#2f69a0'][((y >> 1)) % 3], x, y, 4, 1); K.px('#c8ccd8', x - 1, 25, 6, 2); K.px('#c8ccd8', x - 1, 55, 6, 2);
        K.neon('CUTS', W / 2, 20, '#ff4f5e', 1, false);
      } }, d);
    },
    threads: function (g, W, H, d) {
      front(g, W, H, { kind: 'stucco', wall: '#3a1428', roof: '#1c1736', door: 'glass', doorGlow: '#f2c94c', paint: function (K, W, H, rh) {
        K.awning(0, W, rh + 4, '#5a1e3c', '#f2c94c', 6);
        /* a mannequin in the window */
        K.px(OUT, 6, 32, d[0] - 12, 24); K.px('#2a1a30', 7, 33, d[0] - 14, 22);
        var mx = 6 + (d[0] - 12) / 2 | 0; K.oval('#e8d8c8', mx, 37, 3, 3); K.px('#9f8cff', mx - 5, 41, 10, 9); K.px('#c8ccd8', mx, 50, 1, 5);
        K.neon('THREADS', W / 2, 31, '#f2c94c', 1, false);
      } }, d);
    },
    casino: function (g, W, H, d) {
      front(g, W, H, { kind: 'stucco', wall: '#3a2a14', roof: '#2a1e10', trim: '#f2c94c', door: 'glass', doorGlow: '#f2c94c', paint: function (K, W, H, rh) {
        /* columns, a marquee of bulbs round the sign, a big seven */
        for (var x = 8; x < W; x += 28) { if (x > d[0] - 8 && x < d[1] + 4) continue; K.px('#e8d8a8', x, rh + 6, 8, H - rh - 10); K.px('#fff3c0', x, rh + 6, 2, H - rh - 10); K.px('#a8885e', x + 6, rh + 6, 2, H - rh - 10); }
        var sw = 120, sx = (W - sw) >> 1; K.px(OUT, sx, rh + 6, sw, 24); K.px('#5a0e1a', sx + 1, rh + 7, sw - 2, 22);
        for (var b = sx + 2; b < sx + sw - 2; b += 4) { K.px('#ffe97c', b, rh + 8, 2, 2); K.px('#ffe97c', b, rh + 26, 2, 2); }
        K.neon('SETTEBELLO', W / 2, rh + 13, '#f2c94c', 2, false);
        K.px('#c4473a', d[0] - 4, H - 4, d[1] - d[0] + 8, 3);
      } }, d);
    },
    ncpd: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#8a92a6', roof: '#2a3248', trim: '#2a6aff', door: 'glass', doorGlow: '#2a6aff', paint: function (K, W, H, rh) {
        for (var r = 0; r < 2; r++) for (var x = 10; x < W - 10; x += 22) { if (r && x > d[0] - 16 && x < d[1] + 4) continue; K.windowAt(x, 32 + r * 26, 12, 14, null, '#c8ccd8'); }
        K.px('#2a6aff', 0, rh + 4, W, 2);
        K.neon('NCPD', W / 2, rh + 10, '#7cb8ff', 2);
        K.px('#c8ccd8', d[0] - 12, H - 6, d[1] - d[0] + 24, 2); K.px('#aab0c0', d[0] - 8, H - 4, d[1] - d[0] + 16, 1);   /* the steps */
      } }, d);
    },
    hospital: function (g, W, H, d) {
      front(g, W, H, { kind: 'concrete', wall: '#dce3ff', roof: '#4a5266', trim: '#ff4f6a', door: 'glass', doorGlow: '#7cf5ff', roofH: 18, paint: function (K, W, H, rh) {
        for (var r = 0; r < 3; r++) for (var x = 8; x < W - 8; x += 18) { if (r === 2 && x > d[0] - 14 && x < d[1] + 2) continue; K.windowAt(x, 32 + r * 26, 10, 14, (x + r * 3) % 4 === 0 ? '#bfe4ff' : null, '#9aa0b8'); }
        /* the red cross on a white lightbox */
        var cx = W / 2; K.px(OUT, cx - 11, rh + 5, 22, 22); K.px('#f4f6ff', cx - 10, rh + 6, 20, 20); K.px('#ff4f6a', cx - 3, rh + 8, 6, 16); K.px('#ff4f6a', cx - 8, rh + 13, 16, 6);
        K.px('#c8ccd8', d[0] - 10, H - 30, d[1] - d[0] + 20, 3); K.px('#9aa0b8', d[0] - 10, H - 27, 2, 24); K.px('#9aa0b8', d[1] + 8, H - 27, 2, 24);   /* a canopy on poles */
      } }, d);
    },
    sapphire: function (g, W, H, d) {
      front(g, W, H, { kind: 'glass', wall: '#2a5a9a', roof: '#1c2a48', trim: '#7cf5ff', door: 'glass', paint: function (K, W, H, rh) {
        K.neon('THE SAPPHIRE', W / 2, rh + 8, '#7cf5ff', 1);
        K.px('#f4f6ff', d[0] - 2, H - 18, d[1] - d[0] + 4, 7); K.text('CLOSED', d[0] + ((d[1] - d[0] - 23) >> 1), H - 17, '#c4473a', 1);
      } }, d);
    },
    market: function (g, W, H, d) {
      front(g, W, H, { kind: 'stucco', wall: '#e8b13a', roof: '#c4473a', roofKind: 'tile', trim: '#2f6f5e', paint: function (K, W, H, rh) {
        /* a wide arch, bunting across, crates either side */
        var a0 = d[0] - 8, a1 = d[1] + 8; K.px(OUT, a0 - 1, 22, a1 - a0 + 2, H - 22); K.px('#3a2a22', a0, 24, a1 - a0, H - 24);
        for (var x = a0; x < a1; x++) { var t = Math.abs(x - (a0 + a1) / 2) / ((a1 - a0) / 2); var top = 22 + Math.round(t * t * 8); K.px('#e8b13a', x, 22, 1, top - 22); }
        for (var b = 4; b < W - 4; b += 8) { K.px(['#ff6a3a', '#7cffb2', '#ffe97c', '#7cf5ff'][(b >> 3) % 4], b, rh + 4 + ((b >> 3) % 2), 4, 3); }
        [[8, H - 14], [W - 24, H - 14]].forEach(function (c) { K.px(OUT, c[0], c[1], 16, 10); K.px('#8a5a32', c[0] + 1, c[1] + 1, 14, 8); K.px('#ff7a45', c[0] + 3, c[1] + 2, 3, 3); K.px('#7cffb2', c[0] + 8, c[1] + 2, 3, 3); });
        K.neon('MARKET', W / 2, rh + 10, '#ffd36a', 1, '#2a1a10');
      } }, null);
    },
    boatyard: function (g, W, H, d) {
      front(g, W, H, { kind: 'wood', wall: '#6a4a2a', roof: '#3a3446', roofKind: 'tar', door: 'wood', doorR: ramp('#3a2a18'), paint: function (K, W, H, rh) {
        /* a hull up on a rack, rope, the sign */
        K.px(OUT, 6, 40, 40, 12); K.px('#2f5a6a', 7, 41, 38, 6); K.px('#c8a878', 7, 47, 38, 4); K.px('#f4f6ff', 7, 41, 38, 1);
        K.px('#5a3a22', 10, 52, 3, 8); K.px('#5a3a22', 38, 52, 3, 8);
        K.oval('#c8a878', W - 14, 40, 5, 5); K.oval('#6a4a2a', W - 14, 40, 2, 2);
        K.neon('BOATYARD', W / 2, rh + 4, '#ffd36a', 1, '#2a1a10');
      } }, d);
    },
    /* ── the odd shapes ── */
    noorborj: function (g, W, H) {
      /* the lighthouse: a striped tower narrowing up, the lamp room, a dome */
      var K = kit(g), cx = W / 2;
      for (var y = 30; y < H - 4; y++) { var hw = Math.round(9 + (y - 30) / (H - 34) * 9); K.px(OUT, cx - hw - 1, y, hw * 2 + 2, 1); K.px(((y - 30) >> 4) % 2 ? '#c4473a' : '#e6e8f0', cx - hw, y, hw * 2, 1); K.px('rgba(0,0,0,.25)', cx + hw - 4, y, 4, 1); K.px('rgba(255,255,255,.2)', cx - hw, y, 2, 1); }
      K.px(OUT, cx - 22, H - 6, 44, 6); K.px('#5a5466', cx - 21, H - 5, 42, 4);
      K.px(OUT, cx - 12, 26, 24, 5); K.px('#343b4e', cx - 11, 27, 22, 3);
      K.px(OUT, cx - 9, 10, 18, 17); K.px('#ffe97c', cx - 8, 11, 16, 15); K.px('#fff3c0', cx - 8, 11, 5, 15); for (var x = cx - 8; x < cx + 8; x += 5) K.px('#343b4e', x, 11, 1, 15);
      K.oval(OUT, cx, 9, 10, 5); K.oval('#343b4e', cx, 9, 9, 4); K.px('#7cf5ff', cx - 1, 1, 2, 4);
      K.px(OUT, cx - 4, H - 22, 8, 16); K.px('#3e2618', cx - 3, H - 21, 6, 15);
      K.px('#141a2e', cx - 3, 50, 6, 8); K.px('#141a2e', cx - 3, 80, 6, 8);
    },
    pagoda: function (g, W, H) {
      /* three tiers of red roof with upturned eaves, a gold finial, a gate */
      var K = kit(g), cx = W / 2;
      [[8, 20, 16], [34, 30, 22], [60, 40, 28]].forEach(function (t) {
        var y = t[0], hw = t[2];
        K.px(OUT, cx - hw + 4, y + 9, hw * 2 - 8, 14); K.px('#5a3a2a', cx - hw + 5, y + 10, hw * 2 - 10, 12); K.px('#ffd36a', cx - 3, y + 12, 6, 8);
        K.px(OUT, cx - hw - 3, y - 1, hw * 2 + 6, 10); K.px('#a83030', cx - hw - 2, y, hw * 2 + 4, 8); K.px('#c4473a', cx - hw - 2, y, hw * 2 + 4, 2); K.px('#7a2020', cx - hw - 2, y + 6, hw * 2 + 4, 2);
        K.px('#a83030', cx - hw - 5, y - 3, 3, 3); K.px('#a83030', cx + hw + 2, y - 3, 3, 3);
      });
      K.px('#f2c94c', cx - 1, 0, 2, 8); K.px('#ffe97c', cx - 2, 2, 4, 2);
      K.px(OUT, cx - 7, H - 12, 14, 12); K.px('#2a1410', cx - 6, H - 11, 12, 11);
    },
    greattree: function (g, W, H) {
      /* the great tree: roots spread, a trunk with a door in it, a canopy
         that glows in spots */
      var K = kit(g), cx = W / 2;
      K.px(OUT, cx - 15, 56, 30, H - 56); K.px('#5a3a22', cx - 14, 56, 28, H - 56); K.px('#7a5232', cx - 14, 56, 6, H - 56); K.px('#3e2618', cx + 8, 56, 6, H - 56);
      for (var r = 0; r < 4; r++) { var dir = r < 2 ? -1 : 1, rx = cx + dir * (10 + r % 2 * 8); K.px('#5a3a22', rx - 4, H - 8, 10, 6); K.px(OUT, rx - 4, H - 2, 10, 1); }
      [[cx, 32, 34, 28], [cx - 26, 44, 18, 14], [cx + 26, 44, 18, 14], [cx - 12, 18, 18, 14], [cx + 14, 20, 18, 14]].forEach(function (b, i) {
        K.oval(OUT, b[0], b[1], b[2] + 1, b[3] + 1);
        for (var y = -b[3]; y <= b[3]; y++) for (var x = -b[2]; x <= b[2]; x++) { if ((x * x) / (b[2] * b[2]) + (y * y) / (b[3] * b[3]) > 1) continue; var lit = x / b[2] + y / b[3]; K.px(lit < -0.8 ? '#4ad09a' : lit < 0 ? '#2a9a6a' : lit < 0.7 ? '#1f7050' : '#14503a', b[0] + x, b[1] + y); }
      });
      for (var s = 0; s < 40; s++) { var sx = 6 + (hash(s, 3) * (W - 12) | 0), sy = 6 + (hash(3, s) * 56 | 0); K.px(['#3affc8', '#b28cff', '#7cf5ff'][s % 3], sx, sy, 2, 2); }
      K.px(OUT, cx - 7, H - 30, 14, 28); K.px('#2a1810', cx - 6, H - 29, 12, 27); K.oval('#3affc8', cx, H - 26, 3, 2); K.px('#ffe97c', cx + 3, H - 16, 2, 2);
    },
    fountain: function (g, W, H) {
      /* haven's fountain: a stone basin, a column, three jets of water */
      var K = kit(g), cx = W / 2;
      K.oval(OUT, cx, H - 14, 30, 12); K.oval('#c8ccd8', cx, H - 14, 29, 11); K.oval('#8a92a6', cx, H - 12, 27, 9); K.oval('#2f69a0', cx, H - 14, 25, 8); K.oval('#4f92ca', cx - 4, H - 16, 12, 3);
      K.px(OUT, cx - 4, 16, 8, H - 30); K.px('#dce3ff', cx - 3, 16, 6, H - 30); K.px('#aab0c0', cx + 1, 16, 2, H - 30);
      K.oval(OUT, cx, 16, 9, 4); K.oval('#c8ccd8', cx, 16, 8, 3);
      [[-8, 1], [0, 0], [8, 1]].forEach(function (j) { for (var y = 2; y < 14; y++) K.px(y < 6 ? '#f4f6ff' : '#bfe4ff', cx + j[0] + Math.round(j[0] * (y - 2) / 20), y + j[1], 2, 1); });
      K.px('#f4f6ff', cx - 1, 0, 2, 4);
    },
    campfire: function (g, W, H) {
      var K = kit(g);
      K.oval('rgba(0,0,0,.35)', 16, 27, 12, 3);
      [[6, 22, 20, 4], [8, 19, 16, 4]].forEach(function (l, i) { K.px(OUT, l[0] - 1, l[1] - 1, l[2] + 2, l[3] + 2); K.px(i ? '#7a5232' : '#5a3a22', l[0], l[1], l[2], l[3]); K.px('#a07040', l[0], l[1], l[2], 1); });
      [[10, 10, 4, 10, '#ff6a3a'], [14, 5, 5, 15, '#ff8a3a'], [19, 9, 4, 10, '#ff6a3a'], [15, 9, 3, 10, '#ffd36a'], [12, 15, 9, 5, '#ffe97c']].forEach(function (f) { K.px(f[4], f[0], f[1], f[2], f[3]); });
      [[8, 24], [24, 25], [22, 23]].forEach(function (s) { K.oval('#6c658c', s[0], s[1], 2, 2); });
    },
    grill: function (g, W, H) {
      var K = kit(g);
      K.oval('rgba(0,0,0,.35)', 16, 29, 12, 3);
      K.px(OUT, 4, 8, 24, 16); K.px('#a3aec4', 5, 9, 22, 14); K.px('#4f5970', 7, 11, 18, 9);
      for (var x = 8; x < 25; x += 3) K.px('#ff4f5e', x, 12, 1, 7);
      K.px('#727e98', 6, 24, 3, 5); K.px('#727e98', 23, 24, 3, 5); K.px('#7cf5ff', 23, 10, 2, 2);
    },
    tower: null   /* the old art is drawn from width and height: overworld.js draws it at twice the size */
  };

  /* ── indoors: the furniture, each drawn to whatever footprint the room
     gives it (W x H in px). the top surface catches the light, the front
     face is darker, a shadow on the floor under it ── */
  function shadow(K, x, y, w) { K.px('rgba(0,0,0,.3)', x, y, w, 3); }
  function box(K, x, y, w, h, top, R) {
    /* a block: lit top of `top` px, its front below, outlined */
    K.px(OUT, x, y, w, h); K.px(R[3], x + 1, y + 1, w - 2, top - 1); K.px(R[4], x + 1, y + 1, w - 2, 1);
    K.px(R[2], x + 1, y + top, w - 2, h - top - 1); K.px(R[1], x + 1, y + h - 3, w - 2, 2); K.px(OUT, x, y + top, w, 1);
  }
  var WOOD = ramp('#7e532f'), STEEL = ramp('#727e98'), FELT = ramp('#1f6a3a'), VINYL = ramp('#a83038');
  var IN = {
    counter: function (g, W, H) {
      var K = kit(g); shadow(K, 1, H - 3, W - 2); box(K, 0, 6, W, H - 8, 9, WOOD);
      for (var x = 8; x < W - 4; x += 16) K.px(WOOD[1], x, 18, 1, H - 22);
      K.px(OUT, 5, 2, 10, 7); K.px('#343b4e', 6, 3, 8, 5); K.px('#7cffb2', 7, 4, 4, 2);                 /* a till */
      K.px('#f4f6ff', W - 12, 5, 5, 4); K.px('#c8ccd8', W - 12, 8, 5, 1);                               /* a cup */
    },
    bench: function (g, W, H) {
      var K = kit(g); shadow(K, 2, H - 4, W - 4);
      K.px(OUT, 1, 12, W - 2, 9); for (var y = 13; y < 20; y += 3) { K.px(WOOD[3], 2, y, W - 4, 2); K.px(WOOD[1], 2, y + 2, W - 4, 1); }
      [3, W - 7].forEach(function (x) { K.px(OUT, x, 20, 4, 9); K.px(WOOD[1], x + 1, 20, 2, 8); });
    },
    booth: function (g, W, H) {
      var K = kit(g); shadow(K, 1, H - 3, W - 2);
      K.px(OUT, 1, 2, W - 2, 26); K.px(VINYL[2], 2, 3, W - 4, 12); K.px(VINYL[3], 2, 3, W - 4, 2);
      for (var x = 8; x < W - 4; x += 10) K.px(VINYL[1], x, 5, 1, 9);
      K.px(VINYL[3], 2, 16, W - 4, 6); K.px(VINYL[1], 2, 22, W - 4, 5); K.px('#c8ccd8', 2, 15, W - 4, 1);
    },
    bed: function (g, W, H) {
      var K = kit(g); shadow(K, 2, H - 4, W - 4);
      K.px(OUT, 2, 2, W - 4, H - 6); K.px(WOOD[2], 3, 3, W - 6, 8); K.px(WOOD[3], 3, 3, W - 6, 2);           /* headboard */
      K.px('#f4f6ff', 6, 11, W - 12, H - 20); K.px('#dce3ff', 8, 12, 18, 8); K.px('#dce3ff', W - 26, 12, 18, 8);   /* sheet, pillows */
      K.px('#2f4f8a', 4, 24, W - 8, H - 30); K.px('#4a6aa8', 4, 24, W - 8, 3); K.px('#22386a', 4, H - 9, W - 8, 2); /* the blanket */
      for (var x = 10; x < W - 8; x += 12) K.px('#3a5a98', x, 28, 1, H - 38);
    },
    chest: function (g, W, H) {
      var K = kit(g); shadow(K, 3, H - 4, W - 6); box(K, 3, 8, W - 6, H - 11, 8, WOOD);
      K.px('#a3aec4', 3, 15, W - 6, 2); K.px('#a3aec4', 3, 23, W - 6, 2); K.px(OUT, W / 2 - 3, 13, 6, 6); K.px('#f2c94c', W / 2 - 2, 14, 4, 4);
    },
    window: function (g, W, H) {
      /* a window onto the city: night sky, a few lit windows across the way */
      var K = kit(g); K.px(OUT, 4, 3, W - 8, H - 8); K.px('#d8dce8', 5, 4, W - 10, H - 10);
      K.px('#141032', 7, 6, W - 14, H - 14); K.px('#2a1d5e', 7, 6 + (H - 14) / 2, W - 14, (H - 14) / 2);
      for (var x = 9; x < W - 9; x += 6) { var bh = 4 + (hash(x, W) * 8 | 0); K.px('#0b0d1a', x, H - 8 - bh, 5, bh); if (hash(x, 3) < 0.5) K.px('#ffd36a', x + 2, H - 6 - bh, 1, 1); }
      K.px('#d8dce8', W / 2 - 1, 4, 2, H - 10); K.px('#c8ccd8', 2, H - 6, W - 4, 2);
    },
    plant: function (g, W, H) {
      var K = kit(g); shadow(K, 8, H - 4, 16);
      K.px(OUT, 9, 19, 14, 10); K.px('#c4573a', 10, 20, 12, 8); K.px('#e07a50', 10, 20, 12, 2);
      [[16, 8, 6], [10, 12, 5], [22, 12, 5], [16, 4, 4]].forEach(function (l) { K.oval(OUT, l[0], l[1], l[2] + 1, l[2]); K.oval('#2f7048', l[0], l[1], l[2], l[2] - 1); K.px('#4a945c', l[0] - 2, l[1] - 2, 2, 2); });
    },
    sofa: function (g, W, H) {
      var K = kit(g), R = ramp('#5a3a8a'); shadow(K, 2, H - 3, W - 4);
      K.px(OUT, 1, 4, W - 2, 25); K.px(R[2], 2, 5, W - 4, 10); K.px(R[3], 2, 5, W - 4, 2);
      for (var x = 2; x < W - 2; x += (W - 4) / 3) K.px(R[1], x | 0, 7, 1, 8);
      K.px(R[3], 6, 16, W - 12, 6); K.px(R[1], 6, 22, W - 12, 5);
      K.px(R[2], 2, 12, 5, 15); K.px(R[2], W - 7, 12, 5, 15); K.px(R[4], 2, 12, 5, 1); K.px(R[4], W - 7, 12, 5, 1);
    },
    tv: function (g, W, H) {
      var K = kit(g); shadow(K, 5, H - 3, 22);
      K.px(OUT, 4, 4, 24, 19); K.px('#343b4e', 5, 5, 22, 17); K.px('#3a9aa8', 7, 7, 15, 12); K.px('#7cf5ff', 7, 7, 15, 1);
      for (var y = 9; y < 19; y += 2) K.px('rgba(0,0,0,.25)', 7, y, 15, 1);
      K.px('#a3aec4', 23, 8, 2, 2); K.px('#a3aec4', 23, 12, 2, 2); K.px(OUT, 9, 23, 14, 6); K.px(WOOD[2], 10, 23, 12, 5);
    },
    cabinet: function (g, W, H) {
      /* an arcade cabinet: a lit marquee, a screen mid-game, the stick and buttons */
      var K = kit(g); shadow(K, 5, H - 3, 22);
      K.px(OUT, 6, 0, 20, H - 2); K.px('#2a1048', 7, 1, 18, H - 4); K.px('#4a2a7a', 7, 1, 2, H - 4);
      K.px('#ff4fd8', 7, 1, 18, 4); K.px('#ffd0f4', 9, 2, 14, 1);
      K.px(OUT, 8, 6, 16, 11); K.px('#0b2a3a', 9, 7, 14, 9); K.px('#7cf5ff', 10, 12, 4, 2); K.px('#ff4fd8', 17, 9, 3, 3); K.px('#ffe97c', 14, 8, 1, 1);
      K.px('#343b4e', 6, 18, 20, 5); K.px('#4f5970', 6, 18, 20, 1); K.px('#c4473a', 10, 16, 2, 3); K.oval('#ff4f5e', 11, 16, 1, 1); K.px('#7cffb2', 17, 20, 2, 1); K.px('#ffd36a', 21, 20, 2, 1);
      K.px('#14101e', 9, 24, 14, 5); K.px('#ffd36a', 15, 26, 2, 1);
    },
    desk: function (g, W, H) {
      var K = kit(g); shadow(K, 1, H - 3, W - 2); box(K, 0, 9, W, H - 11, 7, WOOD);
      for (var x = W - 30; x < W - 4; x += 13) { K.px(WOOD[1], x, 18, 11, 8); K.px('#e8b13a', x + 4, 21, 3, 1); }
      K.px(OUT, 6, 0, 16, 11); K.px('#1c2a48', 7, 1, 14, 8); K.px('#7cf5ff', 8, 2, 8, 1); K.px('#7cf5ff', 8, 4, 10, 1); K.px('#343b4e', 12, 9, 4, 2);   /* a monitor */
      K.px('#f4f6ff', 28, 6, 8, 5); K.px('#c8ccd8', 30, 5, 8, 5);                                                                                     /* papers */
    },
    lantern: function (g, W, H) {
      var K = kit(g); K.px('#2a1810', 15, 0, 2, 6);
      K.px(OUT, 9, 6, 14, 20); K.px('#c4473a', 10, 7, 12, 18); K.px('#ff6a3a', 12, 9, 8, 14); K.px('#ffd36a', 14, 12, 4, 8);
      [11, 17].forEach(function (y) { K.px('#7a1a1a', 10, y, 12, 1); }); K.px('#2a1810', 11, 5, 10, 2); K.px('#2a1810', 11, 25, 10, 2); K.px('#ffd36a', 15, 27, 2, 3);
    },
    shrine: function (g, W, H) {
      var K = kit(g); shadow(K, 2, H - 3, W - 4); box(K, 2, 10, W - 4, H - 12, 6, ramp('#5a1414'));
      K.px('#f2c94c', W / 2 - 6, 3, 12, 8); K.px('#ffe97c', W / 2 - 6, 3, 12, 1);
      [[10, 4], [W - 14, 4]].forEach(function (c) { K.px('#f4f6ff', c[0], c[1] + 3, 3, 7); K.px('#ffd36a', c[0] + 1, c[1], 1, 3); });
      for (var i = 0; i < 4; i++) K.px('rgba(220,227,255,.4)', W / 2 + i % 2, 2 - i, 1, 1);
    },
    bell: function (g, W, H) {
      var K = kit(g); K.px(OUT, 2, 2, W - 4, 4); K.px('#7a2020', 3, 3, W - 6, 2); K.px(OUT, 3, 4, 3, H - 6); K.px(OUT, W - 6, 4, 3, H - 6);
      K.px('#5a3a22', 4, 5, 1, H - 8); K.px('#5a3a22', W - 5, 5, 1, H - 8);
      K.px(OUT, 9, 10, 14, 28); K.px('#a8885e', 10, 11, 12, 26); K.px('#d8b87a', 10, 11, 3, 26); K.px('#6a5232', 19, 11, 3, 26); K.px('#6a5232', 10, 20, 12, 1); K.px('#6a5232', 10, 30, 12, 1);
      K.px('#8a6a42', 8, 36, 16, 3); shadow(K, 6, H - 4, 20);
    },
    roots: function (g, W, H) {
      var K = kit(g);
      for (var i = 0; i < 6; i++) { var y = 6 + i * 4, x0 = (hash(i, 7) * 10) | 0; K.px(OUT, x0, y, W - x0 - (hash(7, i) * 10 | 0), 4); K.px('#5a3a22', x0 + 1, y + 1, W - x0 - 2 - (hash(7, i) * 10 | 0), 2); K.px('#7a5232', x0 + 1, y + 1, 6, 1); }
      for (var s = 0; s < 6; s++) K.px('#3affc8', 4 + (hash(s, 2) * (W - 8) | 0), 8 + (hash(2, s) * 18 | 0), 1, 1);
    },
    pool: function (g, W, H) {
      /* a pool inside the tree: it shows a sky that isn't there */
      var K = kit(g); K.oval(OUT, W / 2, H / 2, W / 2 - 2, H / 2 - 4); K.oval('#5a3a22', W / 2, H / 2, W / 2 - 3, H / 2 - 5);
      K.oval('#2a4a8a', W / 2, H / 2 + 1, W / 2 - 7, H / 2 - 9); K.oval('#4a7ac8', W / 2 - 8, H / 2 - 4, W / 4, H / 6);
      for (var s = 0; s < 14; s++) K.px('#f4f6ff', 16 + (hash(s, 5) * (W - 32) | 0), 22 + (hash(5, s) * (H - 44) | 0), 1, 1);
      K.oval('#ffe97c', W / 2 + 12, H / 2 - 8, 3, 3);
    },
    shrooms: function (g, W, H) {
      var K = kit(g);
      [[10, 18, 5, '#3affc8'], [20, 22, 4, '#b28cff'], [16, 12, 3, '#7cf5ff']].forEach(function (m) {
        K.px('#dce3ff', m[0] - 1, m[1], 2, 28 - m[1]); K.oval(OUT, m[0], m[1], m[2] + 1, m[2]); K.oval(m[3], m[0], m[1], m[2], m[2] - 1); K.px('#f4f6ff', m[0] - 2, m[1] - 2, 2, 1);
      });
    },
    slot: function (g, W, H) {
      var K = kit(g); shadow(K, 5, H - 3, 22);
      K.px(OUT, 5, 1, 22, H - 3); K.px('#a83030', 6, 2, 20, H - 5); K.px('#c4473a', 6, 2, 20, 2); K.px('#f2c94c', 6, 4, 20, 1);
      K.px(OUT, 8, 7, 16, 9); K.px('#f4f6ff', 9, 8, 14, 7); K.text('777', 10, 9, '#c4473a', 1);
      K.px('#343b4e', 8, 19, 16, 6); K.px('#f2c94c', 10, 21, 3, 2); K.px('#7cffb2', 15, 21, 3, 2);
      K.px('#a3aec4', 27, 6, 2, 10); K.oval('#ff4f5e', 28, 5, 2, 2);
    },
    claw: function (g, W, H) {
      var K = kit(g); shadow(K, 2, H - 3, W - 4);
      K.px(OUT, 2, 1, W - 4, H - 3); K.px('#ff4fd8', 3, 2, W - 6, 3); K.px('rgba(191,233,255,.35)', 4, 5, W - 8, 15); K.px('#f4f6ff', 5, 6, 2, 10);
      [[10, '#ffd36a'], [20, '#7cffb2'], [30, '#ff8a6b'], [40, '#7cf5ff'], [50, '#b28cff']].forEach(function (p) { if (p[0] < W - 8) K.oval(p[1], p[0], 17, 4, 3); });
      K.px('#a3aec4', W / 2, 5, 1, 6); K.px('#a3aec4', W / 2 - 2, 11, 5, 1); K.px('#343b4e', 3, 21, W - 6, 7); K.px('#ff4fd8', W / 2 - 2, 23, 4, 3);
    },
    prize: function (g, W, H) {
      var K = kit(g); shadow(K, 1, H - 3, W - 2); box(K, 0, 12, W, H - 14, 5, ramp('#3a2a5a'));
      K.px(OUT, 2, 0, W - 4, 13); K.px('#1c1736', 3, 1, W - 6, 11);
      for (var x = 6; x < W - 6; x += 9) { K.oval(['#ffd36a', '#ff4fd8', '#7cffb2', '#7cf5ff', '#ff8a6b'][(x / 9 | 0) % 5], x, 7, 3, 3); }
      K.text('PRIZES', W / 2 - 11, 19, '#ffe97c', 1);
    },
    lift: function (g, W, H) {
      var K = kit(g); K.px(OUT, 4, 0, W - 8, H - 2); K.px('#a3aec4', 5, 1, W - 10, H - 4); K.px('#c8ccd8', 5, 1, W - 10, 2);
      K.px(OUT, W / 2 - 1, 4, 2, H - 8); K.px('#727e98', 8, 4, W / 2 - 10, H - 8); K.px('#727e98', W / 2 + 2, 4, W / 2 - 10, H - 8);
      K.px(OUT, W / 2 - 5, 0, 10, 4); K.px('#ff4f5e', W / 2 - 1, 1, 2, 2);
    },
    glass: function (g, W, H) {
      /* a tall pane looking out, the sky going up it */
      var K = kit(g); K.px(OUT, 3, 2, W - 6, H - 4); K.px('#d8dce8', 4, 3, W - 8, H - 6);
      for (var y = 5; y < H - 5; y++) K.px(['#2a1d5e', '#3a2a7a', '#6a2a5a', '#c4573a'][Math.floor((y - 5) / (H - 10) * 4)], 6, y, W - 12, 1);
      K.px('rgba(255,255,255,.35)', 7, 6, 2, H - 14); K.px('#f4f6ff', 10, 14, 1, 1); K.px('#f4f6ff', 18, 30, 1, 1);
    },
    fork: function (g, W, H) {
      /* the tuned tower's tuning fork, humming on its plinth */
      var K = kit(g), cx = W / 2; shadow(K, 8, H - 4, W - 16);
      K.px(OUT, cx - 13, 4, 6, 36); K.px(OUT, cx + 7, 4, 6, 36); K.px(OUT, cx - 13, 36, 26, 8); K.px(OUT, cx - 3, 42, 6, 12);
      K.px('#c8ccd8', cx - 12, 5, 4, 34); K.px('#f4f6ff', cx - 12, 5, 1, 34); K.px('#c8ccd8', cx + 8, 5, 4, 34); K.px('#8a92a6', cx + 11, 5, 1, 34); K.px('#c8ccd8', cx - 12, 37, 24, 6); K.px('#c8ccd8', cx - 2, 43, 4, 10);
      K.px(OUT, cx - 12, H - 12, 24, 10); K.px('#3d3468', cx - 11, H - 11, 22, 8); K.px('#9f8cff', cx - 11, H - 11, 22, 1);
      [[-18, 14], [18, 20], [-17, 28], [19, 8]].forEach(function (d) { K.px('#9f8cff', cx + d[0], d[1], 2, 1); });
    },
    board: function (g, W, H) {
      var K = kit(g); K.px(OUT, 2, 2, W - 4, H - 8); K.px('#a8885e', 3, 3, W - 6, H - 10); K.px('#c8a878', 3, 3, W - 6, 1);
      [[6, 6, '#f4f6ff'], [20, 5, '#ffe97c'], [34, 7, '#f4f6ff'], [46, 6, '#ff8a6b'], [12, 14, '#ffe97c'], [28, 15, '#f4f6ff']].forEach(function (n) { if (n[0] < W - 12) { K.px(n[2], n[0], n[1], 10, 7); K.px('#8a92a6', n[0] + 2, n[1] + 2, 6, 1); K.px('#c4473a', n[0] + 4, n[1], 2, 1); } });
    },
    bars: function (g, W, H) {
      var K = kit(g); K.px(OUT, 0, 2, W, 3); K.px('#727e98', 0, 3, W, 1); K.px(OUT, 0, H - 4, W, 3);
      for (var x = 3; x < W; x += 6) { K.px(OUT, x - 1, 2, 4, H - 4); K.px('#a3aec4', x, 3, 2, H - 6); K.px('#f4f6ff', x, 3, 1, H - 6); }
    },
    bjtable: function (g, W, H) {
      var K = kit(g); shadow(K, 4, H - 4, W - 8);
      K.oval(OUT, W / 2, H / 2 - 2, W / 2 - 3, H / 2 - 5); K.oval('#5a3a22', W / 2, H / 2 - 2, W / 2 - 4, H / 2 - 6); K.oval(FELT[2], W / 2, H / 2 - 3, W / 2 - 8, H / 2 - 10);
      K.px(OUT, 4, 4, W - 8, 10); K.px('#5a3a22', 5, 5, W - 10, 8);
      [[W / 2 - 18, 24], [W / 2 - 4, 28], [W / 2 + 10, 24]].forEach(function (c) { K.px('#f4f6ff', c[0], c[1], 7, 9); K.px('#c4473a', c[0] + 2, c[1] + 2, 2, 2); });
      [[16, 40, '#c4473a'], [W - 20, 40, '#2a6aff'], [W / 2, 42, '#f2c94c']].forEach(function (c) { K.oval(OUT, c[0], c[1], 3, 2); K.oval(c[2], c[0], c[1], 2, 1); });
    },
    dicetable: function (g, W, H) {
      var K = kit(g); shadow(K, 2, H - 4, W - 4);
      K.px(OUT, 2, 4, W - 4, H - 10); K.px('#5a3a22', 3, 5, W - 6, H - 12); K.px(FELT[2], 7, 9, W - 14, H - 20); K.px(FELT[3], 7, 9, W - 14, 2);
      K.px('#f4f6ff', 12, 16, W - 24, 1); K.text('PASS', 16, 20, '#f4f6ff', 1);
      [[W - 30, 26], [W - 22, 30]].forEach(function (d) { K.px(OUT, d[0] - 1, d[1] - 1, 7, 7); K.px('#f4f6ff', d[0], d[1], 5, 5); K.px('#c4473a', d[0] + 2, d[1] + 2, 1, 1); });
    },
    wheel: function (g, W, H) {
      var K = kit(g), cx = W / 2, cy = H / 2 - 2; shadow(K, 4, H - 4, W - 8);
      K.px(OUT, 2, 4, W - 4, H - 10); K.px('#5a3a22', 3, 5, W - 6, H - 12); K.px(FELT[2], 6, 8, W - 12, H - 18);
      K.oval(OUT, cx, cy, 20, 15); K.oval('#a8885e', cx, cy, 19, 14);
      for (var a = 0; a < 18; a++) { var t = a / 18 * Math.PI * 2; K.px(a % 2 ? '#c4473a' : '#14121c', Math.round(cx + Math.cos(t) * 15), Math.round(cy + Math.sin(t) * 11), 2, 2); }
      K.oval('#5a3a22', cx, cy, 9, 7); K.oval('#f2c94c', cx, cy, 3, 2); K.px('#f4f6ff', cx + 12, cy - 6, 2, 2);
    },
    lottobooth: function (g, W, H) {
      var K = kit(g); shadow(K, 1, H - 3, W - 2);
      K.px(OUT, 0, 0, W, H - 2); K.px('#2f6f5e', 1, 1, W - 2, H - 4); K.px('#ffd36a', 1, 1, W - 2, 3);
      K.px(OUT, 6, 7, W - 12, 12); K.px('#14101e', 7, 8, W - 14, 10); K.text('7 14 22 31', 9, 10, '#ffe97c', 1);
      K.px('#c8a878', 4, H - 9, W - 8, 4);
    },
    stall: function (g, W, H) {
      var K = kit(g), aw = ['#c4473a', '#e8b13a'][(W / 32) % 2]; shadow(K, 2, H - 3, W - 4);
      K.px(OUT, 2, 1, W - 4, 9); for (var x = 3; x < W - 3; x++) K.px(((x >> 2) % 2) ? '#f4f6ff' : aw, x, 2, 1, 7);
      K.px(OUT, 3, 14, W - 6, 14); K.px(WOOD[2], 4, 15, W - 8, 12); K.px(WOOD[3], 4, 15, W - 8, 2);
      for (var c = 7; c < W - 9; c += 9) { K.px(OUT, c - 1, 10, 8, 5); K.px(['#ff7a45', '#7cffb2', '#ffd36a'][(c / 9 | 0) % 3], c, 11, 6, 3); }
      K.px('#a3aec4', 3, 9, 1, 6); K.px('#a3aec4', W - 4, 9, 1, 6);
    }
  };
  Object.keys(IN).forEach(function (k) { ART[k] = IN[k]; });

  /* the door's span in 32px, from overworld.js DOOR_PX (16px) or the middle */
  function draw(g, id, W, H, doorPx) {
    var a = ART[id];
    if (!a) return false;
    var d = doorPx ? [doorPx[0] * 2, doorPx[1] * 2] : [(W >> 1) - 10, (W >> 1) + 10];
    a(g, W, H, d);
    return true;
  }
  function has(id) { return !!ART[id]; }
  root.MFMarks = { draw: draw, has: has, ART: ART, FONT: FONT };
})(typeof window !== 'undefined' ? window : globalThis);
