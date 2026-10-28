/* Teknoa 2D: the street tiles at 32px (the art revamp, phase 5).

   overworld.js still decides what goes where: which tile, its district,
   its variant v and its mask m (1 N, 2 E, 4 S, 8 W: that side matches;
   16-128 inside corners; 256 an upper storey; 512 under a storey; 1024-8192
   lane and zebra marks; 16384 keep a wide road plain). This only paints a
   tile at 32 x 32. draw() returns false for a kind it doesn't do yet, and
   overworld.js falls back to its 16px art, doubled.

   Windows sit where the old art had them (glass at units 3-6 / 10-13 across,
   6-10 down; 5-10 on an upper storey): overworld.js night() repaints the
   glass there as windows go on and off.

   MATS: each district's materials. Redrum is the first one done; the rest
   are worked out from their old palette until they get their own.
   PLACEHOLDER colours, all of them. */
(function (root) {
  'use strict';
  var C = 32;
  function rgb(hex) { var n = parseInt(String(hex).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  /* f under 1 darkens, over 1 mixes toward white */
  function tone(h, f) { return hex(rgb(h).map(function (v) { return f > 1 ? v + (255 - v) * (f - 1) : v * f; })); }
  function ramp(h) { return [tone(h, 0.55), tone(h, 0.75), h, tone(h, 1.18), tone(h, 1.38)]; }

  /* wall: brick | glass | stucco | timber | concrete | wood (brick is its
     colour, whatever the kind); roofKind: tar (strips and a parapet) or tile */
  var MATS = {
    redrum:    { road: '#272639', pave: '#433d5e', wall: 'brick', brick: '#661f2e', roof: '#221d42', grass: '#2a1a24', trim: '#9c4646', door: '#3e2618' },
    worldwood: { road: '#232236', pave: '#3a3656', wall: 'glass', brick: '#2a3a6a', roof: '#1c1a34', grass: '#1d3a34', trim: '#7cf5ff', door: '#2a2f4a' },
    yucayeque: { road: '#4a3a30', pave: '#8a6a52', wall: 'stucco', brick: '#d8a85a', roof: '#c4573a', roofKind: 'tile', grass: '#3a5a2a', trim: '#f4f6ff', door: '#2f6f5e' },
    majinryu:  { road: '#2e2630', pave: '#4a3c42', wall: 'timber', brick: '#3a2420', roof: '#8a2424', roofKind: 'tile', grass: '#2a3a2a', trim: '#c4473a', door: '#5a1414' },
    haven:     { road: '#5a6272', pave: '#9aa0b0', wall: 'concrete', brick: '#d8dce8', roof: '#8a92a6', grass: '#3a6a4a', trim: '#7cb8ff', door: '#4a5266' },
    naturia:   { road: '#3a3a2a', pave: '#4a4a36', wall: 'wood', brick: '#5a4a2a', roof: '#3a5a3a', roofKind: 'tile', grass: '#1f4a32', trim: '#8ad07a', door: '#3e2a18' }
  };
  var mats = {};
  function matsOf(id, p) {
    if (mats[id]) return mats[id];
    var m = MATS[id] || { road: p.road, pave: p.ground, wall: 'plain', brick: p.wall, roof: p.roof, grass: p.grass, trim: tone(p.wall, 1.3), door: '#3e2618' };
    return (mats[id] = { road: ramp(m.road), pave: ramp(m.pave), wall: m.wall, brick: ramp(m.brick), roof: ramp(m.roof), roofKind: m.roofKind || 'tar', grass: ramp(m.grass), trim: m.trim, door: ramp(m.door) });
  }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function draw(g, t, di, v, m, wave, rv, door, X) {
    var T = X.T, p = X.pal(di), id = di >= 0 ? X.D[di].id : '', M = matsOf(id || 'none', p), OUT = X.OUT;
    function px(c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w || 1, h || 1); }
    var N, E, S, W, i, x, y;
    function sides() { N = m & 1; E = m & 2; S = m & 4; W = m & 8; }
    sides();

    if (t === T.ROAD) {
      var r = M.road, all4 = N && S && E && W;
      px(r[2], 0, 0, C, C);
      for (i = 0; i < 26; i++) px(hash(v, i) < 0.5 ? r[1] : r[3], (hash(v * 7 + i, 3) * C) | 0, (hash(i, v * 5 + 1) * C) | 0);
      var rk = v % 16;
      if (rk === 3 && all4 && !(m & 16384)) {
        /* a manhole cover */
        px(OUT, 9, 8, 14, 16); px(OUT, 8, 9, 16, 14); px(r[1], 10, 10, 12, 12); px(r[0], 10, 21, 12, 1);
        for (i = 12; i < 21; i += 3) px(r[3], 11, i, 10, 1);
      } else if (rk === 7 || rk === 12) {
        /* a crack, branching */
        [[5, 18], [6, 18], [7, 17], [8, 17], [9, 16], [10, 16], [11, 17], [12, 18], [13, 18], [14, 19], [15, 20], [16, 20], [17, 21], [11, 15], [12, 14]].forEach(function (q) { px(r[0], q[0], q[1]); });
      } else if ((rk === 5 || rk === 14) && all4 && !(m & 16384)) {
        /* a puddle with the neon in it */
        var gl = p.glow[v % p.glow.length];
        px(r[0], 8, 16, 16, 6); px(r[0], 6, 17, 20, 4); px(tone(r[0], 1.15), 9, 17, 10, 1); px(gl, 11, 18, 6, 1); px(tone(gl, 0.6), 17, 19, 4, 1);
      }
      /* lane marks and zebras: worn paint, a pixel missing here and there */
      var lane = '#b8923a', zeb = '#c9c2b6';
      function paint(c, x0, y0, w, h) { var worn = tone(c, 0.72); for (var yy = y0; yy < y0 + h; yy++) for (var xx = x0; xx < x0 + w; xx++) px(hash(xx * 3 + v, yy) < 0.05 ? worn : c, xx, yy); }
      if (m & 1024) { paint(lane, 2, 0, 12, 2); paint(lane, 18, 0, 12, 2); }
      if (m & 2048) { paint(lane, 0, 2, 2, 12); paint(lane, 0, 18, 2, 12); }
      if (m & 4096) for (i = 2; i < C; i += 8) paint(zeb, 4, i, 24, 4);
      if (m & 8192) for (i = 2; i < C; i += 8) paint(zeb, i, 4, 4, 24);
      if (!N && !S) { paint(tone(lane, 1.1), 2, 15, 10, 2); paint(tone(lane, 1.1), 18, 15, 10, 2); }
      else if (!E && !W) { paint(tone(lane, 1.1), 15, 2, 2, 10); paint(tone(lane, 1.1), 15, 18, 2, 10); }
      /* the kerb wherever the road stops: in 3/4, the pavement's lip shows
         its lit top and its face above the road; below, only the top */
      var k = M.pave;
      if (!N) { px(k[4], 0, 0, C, 2); px(k[3], 0, 2, C, 1); px(k[1], 0, 3, C, 3); px(r[0], 0, 6, C, 2); }
      if (!S) { px(r[1], 0, 27, C, 1); px(k[1], 0, 28, C, 1); px(k[3], 0, 29, C, 3); }
      if (!E) { px(r[1], 26, 0, 1, C); px(k[1], 27, 0, 2, C); px(k[3], 29, 0, 3, C); }
      if (!W) { px(k[3], 0, 0, 3, C); px(k[1], 3, 0, 2, C); px(r[1], 5, 0, 1, C); }
      if (m & 16) { px(k[1], 27, 0, 5, 5); px(k[3], 29, 0, 3, 3); }
      if (m & 32) { px(k[1], 27, 27, 5, 5); px(k[3], 29, 29, 3, 3); }
      if (m & 64) { px(k[1], 0, 27, 5, 5); px(k[3], 0, 29, 3, 3); }
      if (m & 128) { px(k[1], 0, 0, 6, 6); px(k[4], 0, 0, 3, 2); }
      return true;
    }

    if (t === T.GROUND || t === T.STALL) {
      var q = M.pave;
      if (!id || id === 'naturia') return false;
      /* concrete slabs, two by two, staggered by row: a lit top edge and a
         dark seam on each, a scatter of wear */
      px(q[2], 0, 0, C, C);
      var off = v & 1 ? 8 : 0;
      for (y = 0; y < C; y += 16) {
        px(q[1], 0, y + 15, C, 1); px(q[3], 0, y, C, 1);
        for (x = (y ? off : 0) - 16; x < C; x += 16) { px(q[1], x + 15, y, 1, 15); px(q[3], x + 16, y + 1, 1, 14); }
      }
      for (i = 0; i < 14; i++) px(hash(v + 3, i) < 0.6 ? q[1] : q[3], (hash(i, v) * C) | 0, (hash(v, i + 9) * C) | 0);
      var gk = v % 8;
      if (gk === 2) [[4, 5], [5, 5], [6, 6], [7, 7], [8, 7], [9, 8], [9, 9], [10, 10]].forEach(function (c) { px(q[0], c[0], c[1]); });
      else if (gk === 5) { px(p.leaf, off + 13, 12, 1, 3); px(p.leaf, off + 12, 13); px(p.leaf, off + 14, 12); px(tone(p.leaf, 0.7), off + 13, 14, 2, 1); }
      else if (gk === 6 && t === T.GROUND) { px(p.glow[v % p.glow.length], 21, 22, 3, 2); px(q[0], 21, 24, 3, 1); }
      if (t === T.STALL) {
        /* a market stall: a striped awning on poles, a wooden counter, crates of
           whatever they're selling, a shadow under it all */
        var aw = p.glow[v % p.glow.length], wd = ramp('#6e4628');
        px('rgba(0,0,0,.3)', 3, 28, 28, 3);
        px(OUT, 3, 4, 2, 24); px('#a3aec4', 3, 4, 1, 24); px(OUT, 27, 4, 2, 24); px('#a3aec4', 27, 4, 1, 24);
        px(OUT, 1, 1, 30, 12);
        for (i = 0; i < 28; i++) { var st = (i >> 2) % 2; px(st ? '#f4f6ff' : aw, 2 + i, 2, 1, 9); px(st ? '#c8ccd8' : tone(aw, 0.7), 2 + i, 11, 1, 1); }
        for (i = 2; i < 30; i += 8) px(aw, i + 1, 12, 2, 2);
        px(OUT, 2, 17, 28, 12); px(wd[2], 3, 18, 26, 10); px(wd[3], 3, 18, 26, 2); px(wd[1], 3, 23, 26, 1);
        [[5, 14, p.glow[(v + 1) % p.glow.length]], [12, 15, '#ffe97c'], [19, 14, p.glow[(v + 2) % p.glow.length]]].forEach(function (c) { px(OUT, c[0] - 1, c[1] - 1, 8, 5); px(c[2], c[0], c[1], 6, 3); px(tone(c[2], 1.35), c[0], c[1], 6, 1); });
      }
      return true;
    }

    /* ── indoors: boards, tiles, the walls, a rug by the door ── */
    if (t === T.FLOOR) {
      /* planks: long boards in staggered lengths, a lit edge, grain, the odd knot */
      var wd = ramp(tone(M.door[2], 1.35));
      px(wd[2], 0, 0, C, C);
      for (y = 0; y < C; y += 8) {
        px(wd[1], 0, y + 7, C, 1); px(wd[3], 0, y, C, 1);
        var cut = ((hash(v, y) * 24) | 0) + 4; px(wd[0], cut, y, 1, 7);
        for (i = 0; i < 3; i++) px(wd[1], (hash(i + y, v) * 30) | 0, y + 2 + i * 2, 4, 1);
      }
      if (v % 9 === 4) { px(wd[0], 20, 12, 3, 2); px(wd[1], 19, 11, 5, 1); }
      return true;
    }
    if (t === T.CHECK) {
      /* glossy tiles, two by two, a shine in the light ones' corners */
      var ta = tone(p.road, 1.45), tb = tone(p.road, 0.75);
      px(ta, 0, 0, C, C); px(tb, 0, 0, 16, 16); px(tb, 16, 16, 16, 16);
      px(tone(ta, 1.2), 17, 1, 4, 1); px(tone(ta, 1.2), 17, 1, 1, 3); px(tone(ta, 1.2), 1, 17, 4, 1); px(tone(ta, 1.2), 1, 17, 1, 3);
      px(tone(tb, 0.8), 0, 15, 16, 1); px(tone(tb, 0.8), 16, 31, 16, 1);
      return true;
    }
    if (t === T.WALL) {
      /* the mask: sides that are wall too. with open floor below it's the
         wall's face (plaster over wainscot, a skirting board); otherwise the
         top of the wall, seen from above */
      var pl = ramp(tone(M.brick[2], 1.5)), wn = ramp(tone(M.door[2], 1.2));
      if (S) { px(tone(pl[0], 0.6), 0, 0, C, C); px(tone(pl[1], 0.7), 2, 0, C - 4, C); px('#0b0d1a', 0, 0, 1, C); px('#0b0d1a', C - 1, 0, 1, C); if (!N) px('#0b0d1a', 0, 0, C, 1); return true; }
      px(pl[2], 0, 0, C, 18);
      for (i = 0; i < 18; i++) px(hash(i, v) < 0.5 ? pl[1] : pl[3], (hash(v, i) * C) | 0, (hash(i * 3, v) * 16) | 0);
      px(pl[3], 0, 0, C, 2); px(tone(M.trim, 1.1), 0, 17, C, 2);
      px(wn[2], 0, 19, C, 9); for (x = 0; x < C; x += 8) { px(wn[1], x, 19, 1, 9); px(wn[3], x + 1, 20, 6, 1); }
      px(wn[0], 0, 28, C, 2); px('#0b0d1a', 0, 30, C, 2);
      return true;
    }
    if (t === T.MAT) {
      /* a rug: a border, a pattern, fringe at the ends */
      var fl = ramp(tone(M.door[2], 1.35));
      px(fl[2], 0, 0, C, C); for (y = 7; y < C; y += 8) px(fl[1], 0, y, C, 1);
      px('#0b0d1a', 3, 5, 26, 22); px('#5a1e3c', 4, 6, 24, 20); px('#7a2e54', 6, 8, 20, 16); px('#5a1e3c', 8, 10, 16, 12);
      px('#e8b13a', 15, 14, 2, 4); px('#e8b13a', 13, 15, 6, 2);
      for (x = 5; x < 28; x += 2) { px('#c8b88a', x, 3, 1, 2); px('#c8b88a', x, 27, 1, 2); }
      return true;
    }

    /* ── the coast ── */
    if (t === T.DEEP || t === T.SHALLOW) {
      /* the mask here means the side that meets land */
      var deep = t === T.DEEP, Wt = ramp(deep ? '#0d1d3c' : '#14396a'), o = [0, 2, 4, 2][wave];
      px(Wt[2], 0, 0, C, C);
      /* depth: a loose dither of the darker tone, more of it out deep */
      for (y = 0; y < C; y += 2) for (x = (y >> 1) & 1; x < C; x += 2) if (hash(x + v * 31, y) < (deep ? 0.22 : 0.12)) px(Wt[1], x, y);
      /* crests: short curved strokes, rocking with the tide over four frames */
      [[2 + (v & 3) * 3, 6 + ((v >> 1) & 3) * 2, 1], [14 - (v & 1) * 5, 19 + ((v >> 2) & 1) * 4, -1], [20, 9 + (v & 3), 1]].forEach(function (c, j) {
        if (j === 2 && !(v & 2)) return;
        var cx = c[0] + o * c[2];
        px(Wt[3], cx, c[1] + 1, 5, 1); px(Wt[3], cx + 5, c[1], 3, 1); px(Wt[4], cx + 5, c[1], 1, 1); px(Wt[1], cx, c[1] + 2, 5, 1);
      });
      /* in the shallows, light rippling on the bottom */
      if (!deep) for (i = 0; i < 3; i++) { var lx = (hash(v, i) * 24) | 0, ly = (hash(i, v + wave) * 28) | 0; px(tone(Wt[2], 1.25), lx, ly, 4, 1); px(tone(Wt[2], 1.25), lx + 4, ly + 1, 2, 1); }
      /* foam where it meets land: a lace line, froth running along it, and a
         broken second row washing in and out */
      var foam = '#7fc4ec', froth = '#e4f6ff', wash = deep ? '#2c5e96' : '#4f92ca';
      for (i = 0; i < C; i++) {
        var hi = (i + wave * 4 + v * 2) % 14 < 3, in2 = (i + wave * 2) % 8 < 4 && wave !== 3, lace = hash(i, v + wave) < 0.5 ? 2 : 3;
        if (N) { px(foam, i, 0, 1, lace); if (hi) px(froth, i, 0, 1, 2); if (in2) px(wash, i, lace + 1, 1, 1); }
        if (S) { px(foam, i, C - lace, 1, lace); if (hi) px(froth, C - 1 - i, C - 2, 1, 2); if (in2) px(wash, i, C - lace - 2, 1, 1); }
        if (E) { px(foam, C - lace, i, lace, 1); if (hi) px(froth, C - 2, i, 2, 1); if (in2) px(wash, C - lace - 2, i, 1, 1); }
        if (W) { px(foam, 0, i, lace, 1); if (hi) px(froth, 0, C - 1 - i, 2, 1); if (in2) px(wash, lace + 1, i, 1, 1); }
      }
      return true;
    }
    if (t === T.SAND) {
      /* the mask here means the side that meets water */
      var sd = ramp('#7a6a4c');
      px(sd[2], 0, 0, C, C);
      for (i = 0; i < 40; i++) px(hash(v, i * 3) < 0.5 ? sd[3] : sd[1], (hash(i, v * 7) * C) | 0, (hash(v * 5, i) * C) | 0);
      var sk = v & 7;
      if (sk === 2 || sk === 3 || sk === 6) {
        /* ripples the wind left: shallow S curves, lit on the windward side */
        var ry = sk === 3 ? 7 : 4;
        [[3, ry], [14, ry + 10], [5, ry + 19]].forEach(function (r) { px(sd[1], r[0], r[1] + 2, 4, 1); px(sd[1], r[0] + 4, r[1] + 1, 5, 1); px(sd[1], r[0] + 9, r[1] + 2, 4, 1); px(sd[4], r[0] + 4, r[1], 5, 1); });
      }
      if (v === 4 || v === 20) { px(OUT, 17, 17, 7, 4); px('#f2d6c8', 18, 17, 5, 2); px('#d8a898', 18, 19, 5, 1); px('#f4f6ff', 18, 17, 2, 1); }      /* a shell */
      if (v === 31) { px(OUT, 7, 13, 18, 6); px('#8a6a48', 8, 14, 16, 3); px('#a8885e', 8, 14, 16, 1); px('#5a3a22', 12, 15, 4, 1); px('#5a3a22', 19, 16, 3, 1); }   /* driftwood */
      if (v === 12) { px(sd[0], 9, 22, 3, 2); px(sd[0], 15, 18, 3, 2); px(sd[0], 21, 14, 3, 2); }   /* someone's footprints */
      /* wet sand where the water reaches, its edge uneven, a lace of foam on it */
      var wet = tone(sd[2], 0.8), lacey = '#c8dce4';
      for (i = 0; i < C; i++) {
        var dep = 4 + ((i + v) % 5 === 0 ? 2 : 0) + ((i + v * 3) % 7 === 0 ? -1 : 0);
        if (N) { px(wet, i, 0, 1, dep); if (hash(i, v) < 0.3) px(lacey, i, dep - 1); }
        if (S) { px(wet, i, C - dep, 1, dep); if (hash(i, v) < 0.3) px(lacey, i, C - dep); }
        if (W) { px(wet, 0, i, dep, 1); if (hash(i, v) < 0.3) px(lacey, dep - 1, i); }
        if (E) { px(wet, C - dep, i, dep, 1); if (hash(i, v) < 0.3) px(lacey, C - dep, i); }
      }
      return true;
    }
    if (t === T.MAINLAND) {
      /* vistadelsol's bush: too thick to walk through, round clumps lit from
         the top left with leaf flecks in them, now and then a palm */
      px('#12291a', 0, 0, C, C);
      var seed = v * 2654435761 >>> 0;
      function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; }
      var clumps = 3 + Math.floor(rnd() * 3);
      for (var cI = 0; cI < clumps; cI++) {
        var cr = 5 + rnd() * 4, ccx = cr + 1 + rnd() * (C - 2 * cr - 2), ccy = cr + 1 + rnd() * (C - 2 * cr - 2), base = cI % 2 ? '#1f5a2e' : '#2a6a34';
        for (y = 0; y < C; y++) for (x = 0; x < C; x++) {
          var ddx = x + 0.5 - ccx, ddy = y + 0.5 - ccy, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > cr + 0.8) continue;
          var lit = ddx + ddy;
          px(dd > cr - 0.5 ? OUT : lit < -cr * 0.75 ? '#8ad87a' : lit < -cr * 0.3 ? '#4f9a50' : lit > cr * 0.55 ? '#164424' : hash(x + v, y + cI) < 0.08 ? '#4f9a50' : base, x, y);
        }
      }
      if (v % 6 === 0) {
        /* a palm: a bent, ringed trunk and a star of fronds */
        for (y = 12; y < 28; y++) { var tx = 15 + Math.round((y - 12) * -0.12); px(OUT, tx - 1, y, 4, 1); px(y % 3 ? '#6a4628' : '#4a2e18', tx, y, 2, 1); }
        [[-8, 1], [8, 1], [-6, -4], [6, -4], [-4, 5], [4, 5], [0, -6]].forEach(function (f) {
          for (var q = 1; q <= 6; q++) { var fx = 15 + Math.round(f[0] * q / 6), fy = 11 + Math.round(f[1] * q / 6) + (q > 3 && f[1] >= 0 ? 1 : 0); px(OUT, fx, fy + 1); px(q > 4 ? '#2a6a34' : '#3f9a4a', fx, fy); }
        });
        px('#8ad87a', 15, 10, 2, 1);
      }
      return true;
    }
    if (t === T.BRIDGE) {
      /* the mask here means the side over water: boards across, nail heads,
         a rail with posts and a neon strip along it */
      var dk = ramp('#3a3150');
      px(dk[2], 0, 0, C, C);
      for (y = 0; y < C; y += 6) { px(dk[1], 0, y + 5, C, 1); px(dk[3], 0, y, C, 1); for (x = 3 + ((y / 6) & 1) * 8; x < C; x += 16) px(dk[0], x, y + 2, 1, 1); }
      var rail = '#9f8cff', post = '#2a2340';
      if (N) { px(OUT, 0, 0, C, 4); px(post, 0, 1, C, 2); px(rail, 0, 1, C, 1); for (x = 2; x < C; x += 10) px('#4a4168', x, 0, 2, 4); }
      if (S) { px(OUT, 0, C - 4, C, 4); px(post, 0, C - 3, C, 2); px(rail, 0, C - 3, C, 1); for (x = 2; x < C; x += 10) px('#4a4168', x, C - 4, 2, 4); }
      if (E) { px(OUT, C - 4, 0, 4, C); px(post, C - 3, 0, 2, C); px(rail, C - 3, 0, 1, C); }
      if (W) { px(OUT, 0, 0, 4, C); px(post, 1, 0, 2, C); px(rail, 2, 0, 1, C); }
      if ((v & 3) === 0 && (N || S || E || W)) px('#7cf5ff', N || S ? 15 : 2, N ? 1 : S ? C - 3 : 15, 2, 1);
      return true;
    }

    if (t === T.GRASS || t === T.TREE) {
      /* (a tree tile is grass; the tree is a sprite of its own) */
      /* for grass the mask marks the sides where it gives way */
      if (t === T.TREE) { m = 0; sides(); }
      var gr = M.grass;
      px(gr[2], 0, 0, C, C);
      for (i = 0; i < 22; i++) { var bx = (hash(v, i * 3) * 30) | 0, by = (hash(i * 5, v) * 29) | 0; px(hash(i, v + 1) < 0.5 ? gr[3] : gr[1], bx, by, 1, 2); }
      /* tufts: three blades each, a lighter tip */
      (v & 1 ? [[5, 7], [20, 21]] : [[20, 5], [7, 20]]).forEach(function (c) {
        px(p.leaf, c[0], c[1] + 1, 1, 3); px(p.leaf, c[0] + 2, c[1], 1, 4); px(p.leaf, c[0] + 4, c[1] + 2, 1, 2); px(tone(p.leaf, 1.3), c[0] + 2, c[1]);
      });
      /* where it gives way: a dark rim and a broken middle row */
      if (N) { px(gr[0], 0, 0, C, 2); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], i, 2, 3, 1); }
      if (S) { px(gr[0], 0, 30, C, 2); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], i, 29, 3, 1); }
      if (E) { px(gr[0], 30, 0, 2, C); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], 29, i, 1, 3); }
      if (W) { px(gr[0], 0, 0, 2, C); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], 2, i, 1, 3); }
      return true;
    }

    if (t === T.BUILDING) {
      var B = M.brick, R = [M.roof, ramp(tone(M.roof[2], 1.12)), ramp(tone(M.roof[2], 0.85))][rv || 0];
      function wall(y0, y1) {
        if (M.wall === 'brick') {
          /* brick courses: 4px tall, joints staggered, a few bricks darker or lighter */
          for (y = y0; y < y1; y++) for (x = 0; x < C; x++) {
            var row = (y - y0) >> 2, joint = (y - y0) % 4 === 3 || (x + (row % 2) * 4) % 8 === 7, br = hash((x + (row % 2) * 4) >> 3, row * 7 + v);
            px(joint ? B[0] : br < 0.18 ? B[1] : br > 0.88 ? B[3] : B[2], x, y);
          }
        } else if (M.wall === 'glass') {
          /* a curtain wall: mullions, panes catching the sky in a stripe */
          px(B[1], 0, y0, C, y1 - y0);
          for (y = y0; y < y1; y += 8) for (x = 0; x < C; x += 8) { px(B[2], x + 1, y + 1, 6, 6); px(B[3], x + 1, y + 1, 2, 1); if ((x + y + v) % 24 === 0) px(B[4], x + 2, y + 2, 1, 3); }
          px(tone(M.trim, 0.5), 0, y0, C, 1);
        } else if (M.wall === 'timber') {
          /* dark boards between posts, a rail across */
          px(B[2], 0, y0, C, y1 - y0);
          for (x = 0; x < C; x += 4) px(x % 16 ? B[1] : B[0], x, y0, 1, y1 - y0);
          px(B[0], 0, y0, 2, y1 - y0); px(B[3], 2, y0, 1, y1 - y0); px(B[0], 0, y0 + 13, C, 2);
        } else if (M.wall === 'wood') {
          /* log courses, rounded, knots here and there */
          for (y = y0; y < y1; y++) px([B[3], B[2], B[2], B[1], B[0]][(y - y0) % 5], 0, y, C, 1);
          for (i = 0; i < 4; i++) px(B[0], (hash(v, i) * 30) | 0, y0 + 2 + ((hash(i, v) * (y1 - y0 - 4)) | 0), 2, 1);
        } else {
          /* stucco or concrete: flat with a fine grain; concrete in panels */
          px(B[2], 0, y0, C, y1 - y0);
          for (i = 0; i < 22; i++) px(hash(i, v + 5) < 0.5 ? B[1] : B[3], (hash(v, i * 3) * C) | 0, y0 + ((hash(i * 7, v) * (y1 - y0)) | 0));
          if (M.wall === 'concrete') { for (y = y0 + 15; y < y1; y += 16) px(B[1], 0, y, C, 1); px(B[1], 15, y0, 1, y1 - y0); }
          else { px(B[1], 0, y1 - 3, C, 1); }
        }
      }
      function windowAt(gx, gy, gh, lit, col) {
        /* frame, glass, a highlight, the mullion, a sill underneath */
        px(OUT, gx - 2, gy - 2, 10, gh + 4); px(M.trim, gx - 1, gy - 1, 8, gh + 2);
        px(lit ? col : '#141a2e', gx, gy, 6, gh);
        if (lit) { px(tone(col, 1.35), gx, gy, 6, 2); px(tone(col, 0.75), gx, gy + gh - 2, 6, 2); }
        else { px('#232b48', gx + 1, gy + 1, 1, gh - 2); px('#232b48', gx + 2, gy + 1, 1, 1); }
        px(M.trim, gx + 2, gy, 2, gh);
        px(tone(M.trim, 1.25), gx - 2, gy + gh + 2, 10, 1); px(tone(M.trim, 0.7), gx - 2, gy + gh + 3, 10, 1);
      }
      if (m & 256) {
        /* an upper storey: a cornice under the eave, two windows */
        wall(0, C);
        px(R[0], 0, 0, C, 2); px(M.trim, 0, 2, C, 2); px(tone(M.trim, 0.7), 0, 4, C, 1);
        for (i = 0; i < 2; i++) { var on = X.upperOn(v, i); windowAt(i ? 20 : 6, 10, 10, on, p.glow[(v + i + 1) % p.glow.length]); }
        px(B[1], 0, 28, C, 2); px(B[3], 0, 30, C, 1);
        if (!E) { px(B[1], 29, 0, 2, C); px(OUT, 31, 0, 1, C); }
        if (!W) { px(B[3], 1, 0, 2, C); px(OUT, 0, 0, 1, C); }
        return true;
      }
      if (S) {
        /* the roof, from above: tar in long strips, gravel, a parapet round
           the edge (lit cap on the far side, its dark face on the right) */
        px(R[2], 0, 0, C, C);
        if (M.roofKind === 'tile') {
          /* clay tiles in scalloped rows running down the slope */
          for (y = 0; y < C; y += 5) for (x = ((y / 5) % 2) ? 0 : 3; x < C; x += 6) { px(R[3], x, y, 5, 1); px(R[1], x, y + 3, 6, 1); px(R[0], x + 5, y, 1, 4); }
        } else {
          for (y = 5; y < C; y += 9) { px(R[1], 0, y, C, 1); px(R[3], 0, y + 1, C, 1); }
          for (i = 0; i < 26; i++) px(hash(i, v + 2) < 0.6 ? R[1] : R[3], (hash(v * 3, i) * C) | 0, (hash(i * 7, v) * C) | 0);
        }
        if (!N) { px(OUT, 0, 0, C, 1); px(R[4], 0, 1, C, 2); px(R[1], 0, 3, C, 2); }
        if (!E) { px(R[0], 27, 0, 4, C); px(OUT, 31, 0, 1, C); }
        if (!W) { px(R[4], 1, 0, 3, C); px(OUT, 0, 0, 1, C); }
        if (m & 16) { px(R[0], 27, 0, 5, 5); px(OUT, 31, 0, 1, 1); }
        if (m & 32) { px(R[0], 27, 27, 5, 5); px(OUT, 31, 31, 1, 1); }
        if (m & 64) { px(R[4], 0, 27, 4, 5); px(OUT, 0, 31, 1, 1); }
        if (m & 128) { px(R[4], 0, 0, 4, 4); px(OUT, 0, 0, 1, 1); }
        /* something up there, on a roof tile with room round it */
        if (N && E && W && M.roofKind !== 'tile') {
          var pk = v % 12;
          if (pk === 3) { px(OUT, 8, 9, 16, 13); px('#6e7890', 9, 10, 14, 11); px('#a3aec4', 9, 10, 14, 2); px('#343b4e', 11, 14, 10, 1); px('#343b4e', 11, 17, 10, 1); px('rgba(0,0,0,.35)', 24, 12, 3, 10); }   /* an ac unit */
          else if (pk === 6) { px(OUT, 13, 6, 6, 16); px('#a3aec4', 14, 6, 3, 16); px('#727e98', 17, 6, 1, 16); px('#c8ccd8', 12, 5, 8, 2); px('rgba(0,0,0,.35)', 19, 9, 3, 13); }   /* a vent stack */
          else if (pk === 8) { px(OUT, 7, 9, 18, 13); px('#4f5970', 8, 10, 16, 11); px('#141a2e', 10, 12, 12, 7); px('#232b48', 11, 13, 2, 5); for (i = 14; i < 22; i += 4) px('#4f5970', i, 12, 1, 7); }   /* a skylight */
          else if (pk === 10) { px('#a3aec4', 15, 4, 1, 20); px('#a3aec4', 10, 8, 11, 1); px('#a3aec4', 12, 13, 7, 1); px('#ff4f5e', 15, 3); }   /* an antenna */
        }
        return true;
      }
      /* the front: the eave over it, brick, the windows or the door, a
         plinth at the foot, a pilaster at each end */
      wall(0, C);
      if (!N) { px(OUT, 0, 0, C, 1); px(R[2], 0, 1, C, 4); px(R[4], 0, 1, C, 1); px(R[0], 0, 5, C, 1); px('rgba(0,0,0,.3)', 0, 6, C, 2); }
      else if (m & 512) { px(M.trim, 0, 0, C, 2); px(tone(M.trim, 0.7), 0, 2, C, 1); }
      px(B[0], 0, 27, C, 1); px(tone(B[1], 0.9), 0, 28, C, 3); px(OUT, 0, 31, C, 1);
      if (!E) { px(B[1], 29, 0, 2, 31); px(OUT, 31, 0, 1, C); }
      if (!W) { px(B[3], 1, 0, 2, 31); px(OUT, 0, 0, 1, C); }
      if (door) {
        /* a door: a lit transom over it, two panels, a step */
        var dg = p.glow[v % p.glow.length];
        px(OUT, 9, 11, 14, 21); px(M.door[1], 10, 12, 12, 19);
        px(dg, 10, 12, 12, 3); px(tone(dg, 1.35), 10, 12, 12, 1);
        px(M.door[2], 11, 16, 4, 14); px(M.door[2], 17, 16, 4, 14); px(M.door[3], 11, 16, 1, 14); px(M.door[3], 17, 16, 1, 14);
        px('#ffe97c', 19, 23, 2, 2);
        px(M.pave[3], 8, 30, 16, 1); px(M.pave[1], 8, 31, 16, 1);
        return true;
      }
      for (i = 0; i < 2; i++) {
        var lit = (v >> (i + 2)) & 1 || (v & 3) === 1;
        windowAt(i ? 20 : 6, 12, 8, lit, p.glow[(v + i) % p.glow.length]);
      }
      return true;
    }
    return false;
  }

  /* the flat colour of a tile, for overworld.js shores() to round the
     coast's corners with: null for kinds it doesn't round */
  function base(t, di, X) {
    var T = X.T, p = X.pal(di), id = di >= 0 ? X.D[di].id : '', M = matsOf(id || 'none', p);
    if (t === T.DEEP) return '#0d1d3c';
    if (t === T.SHALLOW) return '#14396a';
    if (t === T.SAND) return tone('#7a6a4c', 0.8);
    if (t === T.MAINLAND) return '#12291a';
    if (t === T.GRASS || t === T.TREE) return M.grass[2];
    if (t === T.GROUND || t === T.STALL) return id && id !== 'naturia' ? M.pave[2] : p.ground;
    if (t === T.ROAD) return M.road[2];
    return null;
  }
  root.MFTiles = { C: C, MATS: MATS, draw: draw, base: base, tone: tone, ramp: ramp };
})(typeof window !== 'undefined' ? window : globalThis);
