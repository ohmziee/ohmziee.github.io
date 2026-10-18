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

  var MATS = {
    redrum: { road: '#272639', pave: '#433d5e', wall: 'brick', brick: '#661f2e', roof: '#221d42', grass: '#2a1a24', trim: '#9c4646', door: '#3e2618' }
  };
  var mats = {};
  function matsOf(id, p) {
    if (mats[id]) return mats[id];
    var m = MATS[id] || { road: p.road, pave: p.ground, wall: 'plain', brick: p.wall, roof: p.roof, grass: p.grass, trim: tone(p.wall, 1.3), door: '#3e2618' };
    return (mats[id] = { road: ramp(m.road), pave: ramp(m.pave), wall: m.wall, brick: ramp(m.brick), roof: ramp(m.roof), grass: ramp(m.grass), trim: m.trim, door: ramp(m.door) });
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

    if (t === T.GROUND) {
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
      else if (gk === 6) { px(p.glow[v % p.glow.length], 21, 22, 3, 2); px(q[0], 21, 24, 3, 1); }
      return true;
    }

    if (t === T.GRASS || t === T.TREE) {
      /* (a tree tile is grass; the tree is a sprite of its own) */
      if (t === T.TREE) { m = 15; sides(); }
      var gr = M.grass;
      px(gr[2], 0, 0, C, C);
      for (i = 0; i < 22; i++) { var bx = (hash(v, i * 3) * 30) | 0, by = (hash(i * 5, v) * 29) | 0; px(hash(i, v + 1) < 0.5 ? gr[3] : gr[1], bx, by, 1, 2); }
      /* tufts: three blades each, a lighter tip */
      (v & 1 ? [[5, 7], [20, 21]] : [[20, 5], [7, 20]]).forEach(function (c) {
        px(p.leaf, c[0], c[1] + 1, 1, 3); px(p.leaf, c[0] + 2, c[1], 1, 4); px(p.leaf, c[0] + 4, c[1] + 2, 1, 2); px(tone(p.leaf, 1.3), c[0] + 2, c[1]);
      });
      /* where it gives way: a dark rim and a broken middle row */
      if (!N) { px(gr[0], 0, 0, C, 2); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], i, 2, 3, 1); }
      if (!S) { px(gr[0], 0, 30, C, 2); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], i, 29, 3, 1); }
      if (!E) { px(gr[0], 30, 0, 2, C); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], 29, i, 1, 3); }
      if (!W) { px(gr[0], 0, 0, 2, C); for (i = (v & 1) * 3; i < C; i += 6) px(gr[1], 2, i, 1, 3); }
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
        } else {
          px(B[2], 0, y0, C, y1 - y0);
          for (y = y0 + 7; y < y1; y += 8) px(B[1], 0, y, C, 1);
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
        for (y = 5; y < C; y += 9) { px(R[1], 0, y, C, 1); px(R[3], 0, y + 1, C, 1); }
        for (i = 0; i < 26; i++) px(hash(i, v + 2) < 0.6 ? R[1] : R[3], (hash(v * 3, i) * C) | 0, (hash(i * 7, v) * C) | 0);
        if (!N) { px(OUT, 0, 0, C, 1); px(R[4], 0, 1, C, 2); px(R[1], 0, 3, C, 2); }
        if (!E) { px(R[0], 27, 0, 4, C); px(OUT, 31, 0, 1, C); }
        if (!W) { px(R[4], 1, 0, 3, C); px(OUT, 0, 0, 1, C); }
        if (m & 16) { px(R[0], 27, 0, 5, 5); px(OUT, 31, 0, 1, 1); }
        if (m & 32) { px(R[0], 27, 27, 5, 5); px(OUT, 31, 31, 1, 1); }
        if (m & 64) { px(R[4], 0, 27, 4, 5); px(OUT, 0, 31, 1, 1); }
        if (m & 128) { px(R[4], 0, 0, 4, 4); px(OUT, 0, 0, 1, 1); }
        /* something up there, on a roof tile with room round it */
        if (N && E && W) {
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

  root.MFTiles = { C: C, MATS: MATS, draw: draw, tone: tone, ramp: ramp };
})(typeof window !== 'undefined' ? window : globalThis);
