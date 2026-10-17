/* EXiLED teknoa 2d — walking around Nova City. world.js builds the map; this
   draws it, moves the player a tile at a time, and hands a conversation to
   ui.js when they talk to someone with a scene.

   Everything is drawn in code for now: tiles and people are little pixel
   templates coloured per district, so there is something to walk around
   before there is art. Swap a template for a drawn sprite later and nothing
   else changes.

   Keys: arrows / WASD move, Z / Enter / Space is A (talk, read), X / Shift
   held is B (run). Touch: the pad under the screen. */
(function () {
  var M = window.MFWorldMap, A = window.MFAvatar, L = window.MFLobby;
  if (!M) return;
  var TS = 16, VW = 20, VH = 12;                       /* tile size, view in tiles */
  var T = M.T, D = M.DISTRICTS;
  var world = null, ctx = null, canvas = null, tiles = {}, frame = 0;
  var api = null, s = null, active = false, raf = 0;
  var $ = function (id) { return document.getElementById(id); };

  /* ── palettes: night, neon, one mood per district ─────────── */
  var PAL = {
    worldwood: { ground: '#221d38', road: '#2f2a4a', line: '#4a4170', roof: '#3b2f6a', roof2: '#4c3d86', wall: '#1c1736', glow: ['#ff4fd8', '#7cf5ff', '#9f8cff', '#ffe97c'], tree: '#1f4a4a', leaf: '#3fd0b0', grass: '#1d3a34' },
    yucayeque: { ground: '#3a2a22', road: '#4e3a2c', line: '#6d543e', roof: '#c4473a', roof2: '#e8b13a', wall: '#2f6f5e', glow: ['#ffd36a', '#ff8a6b', '#7cffb2', '#ffe97c'], tree: '#1f5a2e', leaf: '#5fd06a', grass: '#2a4a26' },
    naturia:   { ground: '#14261f', road: '#2a3a2a', line: '#3e5a3e', roof: '#3a5a3a', roof2: '#5a7a4a', wall: '#24402c', glow: ['#7cf5ff', '#b28cff', '#7cffb2', '#7cf5ff'], tree: '#123a2a', leaf: '#3affc8', grass: '#173a2a' },
    haven:     { ground: '#4a5260', road: '#6a7282', line: '#d8dce8', roof: '#c8ccd8', roof2: '#e6e8f0', wall: '#8a92a6', glow: ['#bfe4ff', '#ffffff', '#9fd0ff', '#ffffff'], tree: '#2a5a3a', leaf: '#6ad08a', grass: '#3a6a4a' },
    majinryu:  { ground: '#2a1e22', road: '#46363a', line: '#7a4e4a', roof: '#7a2020', roof2: '#a83030', wall: '#2a2a30', glow: ['#ff6a3a', '#ffd36a', '#7cffb2', '#ff4f6a'], tree: '#2a3a2a', leaf: '#6aa060', grass: '#24302a' },
    redrum:    { ground: '#2a1014', road: '#4a2026', line: '#7a2e3a', roof: '#3a1218', roof2: '#4a1820', wall: '#1a080c', glow: ['#ff2a4a', '#ff4fd8', '#ff6a3a', '#ff2a4a'], tree: '#2a1a1a', leaf: '#6a2a2a', grass: '#2a1418' },
    vistadelsol: { ground: '#3a3a26', road: '#4a4630', line: '#6a6440', roof: '#4a6a3a', roof2: '#5a7a4a', wall: '#3a4a2a', glow: ['#ffd36a', '#7cffb2', '#ff8a6b', '#ffe97c'], tree: '#1f5a2e', leaf: '#7cd06a', grass: '#25452a' },
    none:      { ground: '#20283a', road: '#2a3248', line: '#3a4460', roof: '#2a3248', roof2: '#3a4460', wall: '#1a2030', glow: ['#9f8cff'], tree: '#1a3a30', leaf: '#3a8a6a', grass: '#1a3a2a' }
  };
  function pal(di) { return PAL[di >= 0 ? D[di].id : di === -2 ? 'vistadelsol' : 'none']; }

  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ── tile art, drawn once per (kind, district, variant) ───── */
  function tileCanvas(key, draw) {
    if (tiles[key]) return tiles[key];
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var g = c.getContext('2d'); draw(g); tiles[key] = c; return c;
  }
  function px(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); }

  /* the game boy rules: flat colours, a dark outline where things meet,
     patterns that repeat on a grid instead of noise, and every block drawn
     as one building. m says which sides matter for this tile (1 north,
     2 east, 4 south, 8 west): for roads and buildings, the sides that are
     more of the same; for water and bridges, the sides that are land or
     water. 16/32/64/128 (NE, SE, SW, NW) mark an inside corner: both
     sides next to it match but the diagonal doesn't, so the kerb, roof
     outline or grass edge has a notch to close. 256 is a building's
     upper storey (the row over its front, on a block three deep or more),
     512 a front with a storey above it. */
  var OUT = '#0b0d1a';
  /* at night the windows have lives of their own: every 25 nova minutes a
     few go on or off, after one most of the lit ones go dark, and some
     lit rooms are only a tv. 0 dark, 1 lit, 2 tv */
  function winState(x, y, i, up, v, c) {
    var baked = up ? upperOn(v, i) : !!((v >> (i + 2)) & 1 || (v & 3) === 1);
    var id = x * 4 + i * 2 + (up ? 1 : 0), h = hash(id, y * 31 + Math.floor(c.mins / 25) * 977), late = c.hour >= 1 && c.hour < 5;
    var on = baked;
    if (late ? baked && h < 0.5 : h < 0.12) on = !on;
    if (on && hash(id + 5, y + 11) < 0.1) return 2;
    return on ? 1 : 0;
  }
  function upperOn(v, i) { return !!((v >> (i * 2)) & 1) || (v & 7) === 3; }
  function drawTile(g, t, di, v, m, wave, rv, door) {
    var p = pal(di), i;
    var N = m & 1, E = m & 2, S = m & 4, Wd = m & 8;
    if (t === T.DEEP || t === T.SHALLOW) {
      var deep = t === T.DEEP, crest = deep ? '#1d4378' : '#2f69a0';
      px(g, deep ? '#0a1834' : '#123563', 0, 0, TS, TS);
      /* two crests, rocking with the tide over four frames (wave 0-3) */
      var o = [0, 1, 2, 1][wave], c1x = 1 + (v & 3) * 2, c1y = 3 + ((v >> 1) & 3), c2x = 8 - (v & 1) * 3, c2y = 9 + ((v >> 2) & 1) * 3;
      px(g, crest, c1x + o, c1y + 1, 3, 1); px(g, crest, c1x + 3 + o, c1y, 2, 1);
      if (v & 1 || v === 6) { px(g, crest, c2x - o, c2y + 1, 3, 1); px(g, crest, c2x + 3 - o, c2y, 2, 1); }
      /* a glint that comes and goes */
      if ((v + wave) % 4 === 0) px(g, deep ? '#3a6aa8' : '#7ab8e8', 3 + (v * 5) % 10, 2 + (v * 3) % 11, 1, 1);
      /* foam where it meets land: a line, brighter bits running along it,
         and a broken second row washing in and out */
      var foam = '#6fb4e0', froth = '#d8f0ff', wash = deep ? '#2a5a90' : '#4a8cc4';
      if (N) px(g, foam, 0, 0, TS, 1); if (S) px(g, foam, 0, 15, TS, 1);
      if (E) px(g, foam, 15, 0, 1, TS); if (Wd) px(g, foam, 0, 0, 1, TS);
      for (i = 0; i < TS; i++) {
        var hi = (i + wave * 2 + v) % 8 < 2, in2 = (i + wave) % 4 < 2 && wave !== 3;
        if (N) { if (hi) px(g, froth, i, 0); if (in2) px(g, wash, i, 1); }
        if (S) { if (hi) px(g, froth, TS - 1 - i, 15); if (in2) px(g, wash, i, 14); }
        if (E) { if (hi) px(g, froth, 15, i); if (in2) px(g, wash, 14, i); }
        if (Wd) { if (hi) px(g, froth, 0, TS - 1 - i); if (in2) px(g, wash, 1, i); }
      }
      return;
    }
    if (t === T.MAINLAND) {
      /* vistadelsol's bush: too thick to walk through, palms poking out */
      px(g, '#14301c', 0, 0, TS, TS);
      /* three to five round clumps, placed and sized by the variant, each
         outlined and lit from the top left; now and then a palm */
      var seed = v * 2654435761 >>> 0;
      function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; }
      var clumps = 3 + Math.floor(rnd() * 3);
      for (var cI = 0; cI < clumps; cI++) {
        var cr = 2.5 + rnd() * 2, ccx = cr + 0.5 + rnd() * (TS - 2 * cr - 1), ccy = cr + 0.5 + rnd() * (TS - 2 * cr - 1);
        var leafC = cI % 2 ? '#1f5a2e' : '#2a6a34';
        for (var by2 = 0; by2 < TS; by2++) for (var bx2 = 0; bx2 < TS; bx2++) {
          var ddx = bx2 + 0.5 - ccx, ddy = by2 + 0.5 - ccy, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > cr + 0.6) continue;
          px(g, dd > cr - 0.4 ? OUT : ddx + ddy < -cr * 0.6 ? '#7cd06a' : ddx + ddy > cr * 0.5 ? '#174a26' : leafC, bx2, by2);
        }
      }
      if (v % 6 === 0) {
        /* a palm: a bent trunk and a star of fronds */
        px(g, '#5a3a22', 7, 8, 1, 6); px(g, '#5a3a22', 8, 6, 1, 3);
        [[-4, 0], [4, 0], [-3, -2], [3, -2], [-2, 2], [2, 2]].forEach(function (f) {
          for (var q = 1; q <= 3; q++) px(g, q === 3 ? '#2a6a34' : '#3a8a44', 8 + Math.round(f[0] * q / 3), 5 + Math.round(f[1] * q / 3), 1, 1);
        });
        px(g, '#7cd06a', 8, 5, 1, 1);
      }
      return;
    }
    if (t === T.SAND) {
      px(g, '#76664a', 0, 0, TS, TS);
      var sk = v & 7, sLt = '#8f7c5a', sDk = '#665840';
      if (sk === 2 || sk === 3 || sk === 6) {
        /* ripples the wind left */
        var ry = sk === 3 ? 4 : 2;
        [[2, ry], [8, ry + 5], [3, ry + 9]].forEach(function (r) { px(g, sDk, r[0], r[1] + 1, 2, 1); px(g, sDk, r[0] + 2, r[1], 3, 1); px(g, sDk, r[0] + 5, r[1] + 1, 2, 1); px(g, sLt, r[0] + 2, r[1] - 1, 3, 1); });
      } else {
        var dots = v & 1 ? [[3, 3], [11, 6], [6, 12]] : [[12, 2], [4, 9], [10, 13]];
        dots.forEach(function (d) { px(g, sLt, d[0], d[1], 2, 1); });
      }
      if (v === 4 || v === 20) { px(g, '#f2d6c8', 9, 9, 2, 1); px(g, '#d8a898', 9, 10, 3, 1); px(g, '#f4f6ff', 9, 9, 1, 1); }     /* a shell */
      if (v === 31) { px(g, OUT, 4, 7, 8, 3); px(g, '#8a6a48', 5, 8, 6, 1); px(g, '#5a3a22', 6, 8, 2, 1); }            /* driftwood */
      /* wet sand where the water reaches, its edge uneven */
      var wetC = '#5e523c';
      for (i = 0; i < TS; i++) {
        var dep = 2 + ((i + v) % 5 === 0 ? 1 : 0) + ((i + v * 3) % 7 === 0 ? -1 : 0);
        if (N) px(g, wetC, i, 0, 1, dep);
        if (S) px(g, wetC, i, TS - dep, 1, dep);
        if (Wd) px(g, wetC, 0, i, dep, 1);
        if (E) px(g, wetC, TS - dep, i, dep, 1);
      }
      return;
    }
    if (t === T.GROUND || t === T.STALL) {
      px(g, p.ground, 0, 0, TS, TS);
      var gDk = shade(p.ground, 0.8), gLt = shade(p.ground, 1.2), id = di >= 0 ? D[di].id : '';
      if (id && id !== 'naturia') {
        /* pavement: two rows of slabs, staggered, lit on the top edge */
        var sx = v & 1 ? 4 : 11;
        px(g, gDk, 0, 7, TS, 1); px(g, gDk, 0, 15, TS, 1);
        px(g, gDk, sx, 0, 1, 7); px(g, gDk, (sx + 7) % TS, 8, 1, 7);
        px(g, gLt, 0, 0, TS, 1); px(g, gLt, 0, 8, TS, 1);
        var gk = v % 8;
        if (gk === 2) { px(g, gDk, 2, 2, 2, 1); px(g, gDk, 4, 3, 1, 2); px(g, gDk, 5, 5, 2, 1); }        /* a cracked slab */
        else if (gk === 5) { px(g, p.leaf, sx - 1, 6, 1, 1); px(g, p.leaf, sx + 1, 6, 1, 1); px(g, p.leaf, sx, 5, 1, 2); }  /* a weed in the seam */
        else if (gk === 6) { px(g, p.glow[v % p.glow.length], 10, 11, 2, 1); px(g, gDk, 10, 12, 2, 1); }  /* litter catching the light */
      } else {
        /* naturia and the outskirts: packed dirt and pebbles */
        [[3, 4], [11, 2], [7, 11], [13, 13]].forEach(function (d, j) { if ((v >> j) & 1) { px(g, gDk, d[0], d[1] + 1, 2, 1); px(g, gLt, d[0], d[1], 2, 1); } });
      }
      if (t === T.STALL) {
        /* a market stall: striped awning, counter, a few things for sale */
        px(g, OUT, 0, 1, TS, 7);
        for (i = 0; i < 7; i++) px(g, i % 2 ? '#f4f6ff' : p.glow[v % p.glow.length], 1 + i * 2, 2, 2, 5);
        px(g, OUT, 1, 8, 14, 7); px(g, '#5a3c26', 2, 9, 12, 5); px(g, '#7a5638', 2, 9, 12, 1);
        px(g, p.glow[(v + 1) % p.glow.length], 3, 10, 2, 2); px(g, p.glow[(v + 2) % p.glow.length], 7, 10, 2, 2); px(g, '#ffe97c', 11, 10, 2, 2);
      }
      return;
    }
    if (t === T.ROAD) {
      var rDk = shade(p.road, 0.78), rLt = shade(p.road, 1.2), kLt = shade(p.line, 1.15), kDk = shade(p.line, 0.65), all4 = N && S && E && Wd;
      px(g, p.road, 0, 0, TS, TS);
      /* asphalt grain: a few fixed flecks per variant */
      for (i = 0; i < 6; i++) px(g, i % 2 ? rDk : rLt, (v * 7 + i * 13) % TS, (v * 11 + i * 5) % TS, 1, 1);
      var rk = v % 16;
      /* (16384: a stretch of wide road kept plain, or it's all manholes) */
      if (rk === 3 && all4 && !(m & 16384)) {
        /* a manhole cover */
        px(g, OUT, 5, 4, 6, 8); px(g, OUT, 4, 5, 8, 6); px(g, rDk, 5, 5, 6, 6);
        px(g, rLt, 6, 6, 4, 1); px(g, rLt, 6, 8, 4, 1); px(g, rLt, 6, 10, 4, 1);
      } else if (rk === 7 || rk === 12) {
        /* a crack */
        px(g, rDk, 3, 9, 3, 1); px(g, rDk, 6, 8, 2, 1); px(g, rDk, 8, 9, 1, 2); px(g, rDk, 9, 11, 3, 1);
      } else if ((rk === 5 || rk === 14) && all4 && !(m & 16384)) {
        /* a puddle with the neon in it */
        var pud = shade(p.road, 0.6), glint = p.glow[v % p.glow.length];
        px(g, pud, 4, 8, 8, 3); px(g, pud, 3, 9, 10, 1); px(g, glint, 6, 9, 3, 1); px(g, shade(glint, 0.6), 9, 9, 2, 1);
      }
      /* the wide roads: dashes between the lanes, zebra bars at a junction */
      var cLine = '#b8923a', zebra = '#b9b2a6';
      if (m & 1024) { px(g, cLine, 1, 0, 6, 1); px(g, cLine, 9, 0, 6, 1); }
      if (m & 2048) { px(g, cLine, 0, 1, 1, 6); px(g, cLine, 0, 9, 1, 6); }
      if (m & 4096) for (i = 1; i < TS; i += 4) px(g, zebra, 2, i, 12, 2);
      if (m & 8192) for (i = 1; i < TS; i += 4) px(g, zebra, i, 2, 2, 12);
      /* lane dashes down the middle of a single-lane street */
      if (!N && !S) { px(g, shade(p.line, 1.3), 1, 7, 5, 1); px(g, shade(p.line, 1.3), 9, 7, 5, 1); }
      else if (!E && !Wd) { px(g, shade(p.line, 1.3), 7, 1, 1, 5); px(g, shade(p.line, 1.3), 7, 9, 1, 5); }
      /* a raised kerb wherever the road stops: lit on top, shadowed below */
      if (!N) { px(g, kLt, 0, 0, TS, 1); px(g, p.line, 0, 1, TS, 1); px(g, rDk, 0, 2, TS, 1); }
      if (!S) { px(g, rDk, 0, 13, TS, 1); px(g, p.line, 0, 14, TS, 1); px(g, kDk, 0, 15, TS, 1); }
      if (!E) { px(g, rDk, 13, 0, 1, TS); px(g, p.line, 14, 0, 1, TS); px(g, kDk, 15, 0, 1, TS); }
      if (!Wd) { px(g, kLt, 0, 0, 1, TS); px(g, p.line, 1, 0, 1, TS); px(g, rDk, 2, 0, 1, TS); }
      /* inside corners: the two kerbs meeting here, joined up */
      if (m & 16) { px(g, rDk, 13, 0, 3, 3); px(g, p.line, 14, 0, 2, 2); px(g, kDk, 15, 0); }
      if (m & 32) { px(g, rDk, 13, 13, 3, 3); px(g, p.line, 14, 14, 2, 2); px(g, kDk, 15, 15); }
      if (m & 64) { px(g, rDk, 0, 13, 3, 3); px(g, p.line, 0, 14, 2, 2); px(g, kDk, 0, 15); }
      if (m & 128) { px(g, rDk, 0, 0, 3, 3); px(g, p.line, 0, 0, 2, 2); px(g, kLt, 0, 0); }
      return;
    }
    if (t === T.GRASS) {
      px(g, p.grass, 0, 0, TS, TS);
      /* a shadow line wherever the grass gives way */
      var gEdge = shade(p.grass, 0.65), gMid = shade(p.grass, 0.82);
      if (N) px(g, gEdge, 0, 0, TS, 1); if (S) px(g, gEdge, 0, 15, TS, 1);
      if (E) px(g, gEdge, 15, 0, 1, TS); if (Wd) px(g, gEdge, 0, 0, 1, TS);
      /* a second, broken row in a middle shade, so the edge isn't a ruled line */
      for (i = (v & 1) * 2; i < TS; i += 4) {
        if (N) px(g, gMid, i, 1, 2, 1); if (S) px(g, gMid, i, 14, 2, 1);
        if (E) px(g, gMid, 14, i, 1, 2); if (Wd) px(g, gMid, 1, i, 1, 2);
      }
      if (m & 16) px(g, gEdge, 15, 0); if (m & 32) px(g, gEdge, 15, 15);
      if (m & 64) px(g, gEdge, 0, 15); if (m & 128) px(g, gEdge, 0, 0);
      /* tufts: little ^^ pairs on a grid, the way the old games did it */
      (v & 1 ? [[2, 3], [10, 10]] : [[10, 2], [3, 10]]).forEach(function (c) {
        px(g, p.leaf, c[0], c[1] + 1); px(g, p.leaf, c[0] + 1, c[1]); px(g, p.leaf, c[0] + 2, c[1] + 1);
        px(g, p.leaf, c[0] + 3, c[1] + 1); px(g, p.leaf, c[0] + 4, c[1]); px(g, p.leaf, c[0] + 5, c[1] + 1);
      });
      return;
    }
    if (t === T.TREE) {
      /* just the ground: the tree itself is a sprite (treeCanvas), sorted
         in with the people so its canopy can hang over the tile above */
      px(g, p.grass, 0, 0, TS, TS);
      return;
    }
    if (t === T.BRIDGE) {
      px(g, '#3a3150', 0, 0, TS, TS);
      for (i = 3; i < TS; i += 4) px(g, '#2a2340', 0, i, TS, 1);
      /* a rail on any side with water under it */
      var rail = '#9f8cff';
      if (N) { px(g, OUT, 0, 0, TS, 2); px(g, rail, 0, 1, TS, 1); }
      if (S) { px(g, OUT, 0, 14, TS, 2); px(g, rail, 0, 14, TS, 1); }
      if (E) { px(g, OUT, 14, 0, 2, TS); px(g, rail, 14, 0, 1, TS); }
      if (Wd) { px(g, OUT, 0, 0, 2, TS); px(g, rail, 1, 0, 1, TS); }
      if ((v & 3) === 0 && (N || S || E || Wd)) px(g, '#7cf5ff', N || S ? 7 : 1, N ? 1 : S ? 14 : 7, 1, 1);
      return;
    }
    if (t === T.BUILDING) {
      var roof = [p.roof, p.roof2, shade(p.roof, 1.2)][rv || 0], rDark = shade(roof, 0.7), rLit = shade(roof, 1.3);
      if (m & 256) {
        /* an upper storey: wall, a sill under two windows, the eave over them */
        px(g, p.wall, 0, 0, TS, TS);
        px(g, rDark, 0, 0, TS, 2); px(g, shade(p.wall, 0.75), 0, 13, TS, 1); px(g, shade(p.wall, 1.15), 0, 14, TS, 1);
        if (!E) px(g, OUT, 15, 0, 1, TS);
        if (!Wd) px(g, OUT, 0, 0, 1, TS);
        for (i = 0; i < 2; i++) {
          var ux = i ? 9 : 2, uOn = upperOn(v, i);
          px(g, OUT, ux, 4, 5, 7);
          var ug = uOn ? p.glow[(v + i + 1) % p.glow.length] : '#141a2e';
          px(g, ug, ux + 1, 5, 3, 5); px(g, uOn ? shade(ug, 1.35) : '#232b48', ux + 1, 5, 1, 1);
          px(g, OUT, ux + 1, 7, 3, 1); px(g, shade(p.wall, 1.2), ux, 11, 5, 1);
        }
        return;
      }
      if (S) {
        /* the roof: shingle rows, an outline where the building ends */
        px(g, roof, 0, 0, TS, TS);
        for (i = 3; i < TS; i += 4) {
          px(g, rDark, 0, i, TS, 1);
          for (var tx = (i >> 2) % 2 ? 2 : 6; tx < TS; tx += 8) px(g, rDark, tx, i - 2, 1, 2);
        }
        if (!N) { px(g, OUT, 0, 0, TS, 1); px(g, rLit, 0, 1, TS, 1); }
        if (!E) px(g, OUT, 15, 0, 1, TS);
        if (!Wd) px(g, OUT, 0, 0, 1, TS);
        if (m & 16) px(g, OUT, 15, 0); if (m & 32) px(g, OUT, 15, 15);
        if (m & 64) px(g, OUT, 0, 15); if (m & 128) px(g, OUT, 0, 0);
        return;
      }
      /* the front: eave shadow, windows in frames, maybe the door */
      px(g, p.wall, 0, 0, TS, TS);
      if (!N) { px(g, OUT, 0, 0, TS, 1); px(g, roof, 0, 1, TS, 2); }
      if (m & 512) px(g, shade(p.wall, 0.75), 0, 0, TS, 1);        /* the floor line under the storey */
      else px(g, rDark, 0, N ? 0 : 3, TS, 2);
      px(g, shade(p.wall, 0.75), 0, 14, TS, 1); px(g, OUT, 0, 15, TS, 1);
      if (!E) px(g, OUT, 15, 0, 1, TS);
      if (!Wd) px(g, OUT, 0, 0, 1, TS);
      if (door) {
        px(g, OUT, 5, 6, 6, 9); px(g, '#1a1426', 6, 7, 4, 8); px(g, p.glow[v % p.glow.length], 6, 7, 4, 1); px(g, '#ffe97c', 9, 11, 1, 1);
        return;
      }
      for (i = 0; i < 2; i++) {
        var wx = i ? 9 : 2, on = (v >> (i + 2)) & 1 || (v & 3) === 1;
        px(g, OUT, wx, 5, 5, 6);
        var glass = on ? p.glow[(v + i) % p.glow.length] : '#141a2e';
        px(g, glass, wx + 1, 6, 3, 4);
        px(g, on ? shade(glass, 1.35) : '#232b48', wx + 1, 6, 1, 1);
        px(g, OUT, wx + 2, 6, 1, 4);
      }
      return;
    }
    /* indoors: boards, the wall with a skirting board, the mat by the door */
    if (t === T.FLOOR) {
      var wood = p.road;
      px(g, wood, 0, 0, TS, TS);
      for (i = 3; i < TS; i += 4) px(g, shade(wood, 0.75), 0, i, TS, 1);
      px(g, shade(wood, 0.75), (v & 3) * 4 + 1, 0, 1, 3); px(g, shade(wood, 0.75), ((v >> 2) & 3) * 4 + 2, 8, 1, 3);
      return;
    }
    if (t === T.CHECK) {
      var tA = shade(p.road, 1.25), tB = shade(p.road, 0.8);
      px(g, tA, 0, 0, TS, TS); px(g, tB, 0, 0, 8, 8); px(g, tB, 8, 8, 8, 8);
      px(g, shade(tA, 1.2), 1, 1, 2, 1);
      return;
    }
    if (t === T.WALL) {
      px(g, p.wall, 0, 0, TS, TS);
      px(g, shade(p.wall, 1.2), 0, 0, TS, 2);
      for (i = 5; i < 13; i += 4) px(g, shade(p.wall, 0.85), 0, i, TS, 1);
      px(g, shade(p.wall, 0.6), 0, 13, TS, 2); px(g, OUT, 0, 15, TS, 1);
      return;
    }
    if (t === T.MAT) {
      px(g, p.road, 0, 0, TS, TS);
      px(g, OUT, 1, 3, 14, 12); px(g, '#5a1e3c', 2, 4, 12, 10);
      for (i = 6; i < 13; i += 3) px(g, '#7a2e54', 2, i, 12, 1);
      return;
    }
    px(g, p.ground, 0, 0, TS, TS);
  }

  /* ── trees: five shapes, each a blob lit from the top left with a dark
     outline, on a trunk, over its own shadow. the canvas is wider than a
     tile and taller, so a canopy spills a little sideways and up ── */
  var TREE_W = TS + 4, TREE_H = TS + 9;
  var TREE_SHAPES = [
    /* round */   [[10, 10, 7.2, 7.2]],
    /* tall */    [[10, 9, 5.8, 8.6]],
    /* bushy */   [[6, 13, 4.8, 4.6], [14, 13, 4.8, 4.6], [10, 8, 5.4, 5.2]],
    /* small */   [[10, 13, 5.4, 5.2]],
    /* pine */    'pine'
  ];
  var treeCache = {};
  function treeCanvas(di, v) {
    var key = di + '.' + v;
    if (treeCache[key]) return treeCache[key];
    var c = document.createElement('canvas'); c.width = TREE_W; c.height = TREE_H;
    var g = c.getContext('2d'), p = pal(di), shape = TREE_SHAPES[v % 5], x, y;
    var lit = shade(p.tree, 1.45), dark = shade(p.tree, 0.7), deep = shade(p.tree, 0.5), base = TREE_H - 3;
    function inside(xx, yy) {
      if (shape === 'pine') {
        /* three stacked tiers, each a little wider than the one above */
        for (var tr = 0; tr < 3; tr++) { var top = 1 + tr * 5, hw = (yy - top) * 0.75 + 1; if (yy >= top && yy < top + 8 && Math.abs(xx + 0.5 - 10) <= hw) return true; }
        return false;
      }
      return shape.some(function (b) { var dx = (xx + 0.5 - b[0]) / b[2], dy = (yy + 0.5 - b[1]) / b[3]; return dx * dx + dy * dy <= 1; });
    }
    var mask = [], top = TREE_H, bot = 0;
    for (y = 0; y < base; y++) for (x = 0; x < TREE_W; x++) if (inside(x, y)) { mask[y * TREE_W + x] = 1; top = Math.min(top, y); bot = Math.max(bot, y); }
    /* shadow on the ground, then the trunk from under the canopy down */
    g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(5, base, 10, 2); g.fillRect(4, base + 1, 12, 1);
    px(g, OUT, 8, bot - 2, 4, base - bot + 3); px(g, '#5a3a22', 9, bot - 2, 2, base - bot + 2); px(g, '#7a5232', 9, bot - 2, 1, base - bot + 2);
    var cy0 = (top + bot) / 2, rr = (bot - top) / 2 || 1;
    for (y = 0; y < base; y++) for (x = 0; x < TREE_W; x++) {
      if (!mask[y * TREE_W + x]) continue;
      var edge = !mask[(y - 1) * TREE_W + x] || !mask[(y + 1) * TREE_W + x] || x === 0 || !mask[y * TREE_W + x - 1] || x === TREE_W - 1 || !mask[y * TREE_W + x + 1];
      if (edge) { px(g, OUT, x, y); continue; }
      var dx = (x + 0.5 - 10) / rr, dy = (y + 0.5 - cy0) / rr, sh = dx + dy;
      /* pine tiers: a dark band under each */
      if (shape === 'pine' && (y - 1) % 5 >= 4) { px(g, deep, x, y); continue; }
      px(g, sh < -0.55 ? lit : sh > 0.75 ? deep : sh > 0.25 ? dark : p.tree, x, y);
    }
    /* a few leaf glints, placed by the variant */
    for (var i = 0; i < 4; i++) {
      var lx = 4 + ((v * 7 + i * 5) % 9), ly = top + 2 + ((v * 3 + i * 4) % Math.max(1, rr));
      if (mask[ly * TREE_W + lx] && mask[ly * TREE_W + lx + 1] && mask[(ly - 1) * TREE_W + lx] && (lx - 10) + (ly - cy0) < 2) { px(g, p.leaf, lx, ly, 2, 1); }
    }
    return (treeCache[key] = c);
  }

  /* once per map: every block of buildings gets one roof colour and one
     door, so a block reads as a building, not a quilt of tiles */
  var deco = null;
  function decorate(w) {
    var n = w.W * w.H, comp = new Int32Array(n).fill(-1), roof = new Uint8Array(n), door = new Uint8Array(n), id = 0;
    for (var k = 0; k < n; k++) {
      if (w.tile[k] !== T.BUILDING || comp[k] >= 0) continue;
      var q = [k], cells = [], fronts = [];
      comp[k] = id;
      while (q.length) {
        var c = q.pop(); cells.push(c);
        var cx = c % w.W, cy = (c / w.W) | 0;
        if (cy + 1 >= w.H || w.tile[c + w.W] !== T.BUILDING) fronts.push(c);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var nx = cx + o[0], ny = cy + o[1], nk = ny * w.W + nx;
          if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H || comp[nk] >= 0 || w.tile[nk] !== T.BUILDING) return;
          comp[nk] = id; q.push(nk);
        });
      }
      var rv = Math.floor(hash(id, 77) * 3);
      cells.forEach(function (c) { roof[c] = rv; });
      /* the door: the middle of the lowest front, if the front is wide enough */
      var low = fronts.filter(function (c) { return ((c / w.W) | 0) === Math.max.apply(null, fronts.map(function (f) { return (f / w.W) | 0; })); });
      low.sort(function (a, b) { return a - b; });
      if (low.length >= 2 || cells.length === 1) door[low[low.length >> 1]] = 1;
      id++;
    }
    /* small things that sit on the ground (fires) get ground drawn under them */
    var under = new Uint8Array(n);
    (w.marks || []).forEach(function (m) {
      if (m.fire) under[m.y * w.W + m.x] = 1;
      /* the tower stands in the open: ground under its whole footprint */
      if (m.id === 'tower') for (var yy = m.y; yy < m.y + m.h; yy++) for (var xx = m.x; xx < m.x + m.w; xx++) under[yy * w.W + xx] = 1;
    });
    /* streetlamps: on the pavement beside a road, never two within 4 tiles.
       side: which way the road is, so the post stands at the kerb.
       the city only; rooms have their own light */
    var lamps = [], near = {};
    if (w.dist && w.W > 60) for (var ly = 1; ly < w.H - 1; ly++) for (var lx = 1; lx < w.W - 1; lx++) {
      var lk = ly * w.W + lx;
      if (w.tile[lk] !== T.GROUND || w.dist[lk] < 0 || hash(lx, ly + 991) > 0.22 || under[lk]) continue;
      if ((w.marks || []).some(function (m) { return lx >= m.x - 1 && lx <= m.x + m.w && ly >= m.y - 1 && ly <= m.y + m.h; })) continue;
      var side = w.tile[lk + w.W] === T.ROAD ? 'down' : w.tile[lk - w.W] === T.ROAD ? 'up' : w.tile[lk + 1] === T.ROAD ? 'right' : w.tile[lk - 1] === T.ROAD ? 'left' : '';
      if (!side) continue;
      var cell = Math.floor(lx / 4) + ',' + Math.floor(ly / 4);
      if (near[cell]) continue;
      near[cell] = 1;
      lamps.push({ x: lx, y: ly, side: side });
    }
    return { roof: roof, door: door, under: under, lamps: lamps };
  }

  /* landmarks: one picture across their whole footprint */
  var MARK_ART = {
    /* the tuned tower: a replica of the one in paris, iron lattice, two
       platforms, a spire, retuned so the lights hum in colours */
    tower: function (g, w, h) {
      var iron = '#4a3f6e', dark = '#2a2342', lit = '#8a7ac0', cx = w / 2;
      var y1 = Math.round(h * 0.6), y2 = Math.round(h * 0.33), y3 = Math.round(h * 0.1);
      /* the half-width of the outside of the tower at row y */
      function half(y) {
        if (y >= y1) return 6 + (h - 1 - y) / (h - 1 - y1) * -0 + (y - y1) / (h - 1 - y1) * 16 + 6;
        if (y >= y2) return 5 + (y - y2) / (y1 - y2) * 7;
        if (y >= y3) return 1.5 + (y - y3) / (y2 - y3) * 3.5;
        return 1;
      }
      for (var y = 0; y < h; y++) {
        var hw = half(y), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw) - 1;
        if (y >= y1) {
          /* the legs, and the arch between them */
          var leg = 4 + Math.round((y - y1) / (h - y1) * 3), archTop = y1 + (h - y1) * 0.35, ay = (y - archTop) / (h - archTop);
          var open = y > archTop ? Math.round((hw - leg) * Math.sqrt(Math.min(1, ay * 1.4))) : 0;
          for (var x = x0; x <= x1; x++) {
            var d = Math.abs(x + 0.5 - cx);
            if (d < open) continue;
            px(g, (x + y) % 4 === 0 || (x - y) % 4 === 0 ? dark : iron, x, y);
          }
        } else if (y >= y3) {
          for (var x2 = x0; x2 <= x1; x2++) px(g, y < y2 && x2 > x0 && x2 < x1 ? dark : (x2 + y) % 3 === 0 ? dark : iron, x2, y);
        } else px(g, iron, x0, y, Math.max(1, x1 - x0 + 1), 1);
      }
      /* highlights down the left of each leg */
      for (var y4 = y3; y4 < h; y4++) px(g, lit, Math.round(cx - half(y4)), y4);
      /* the platforms, lit */
      function deck(y, hw, col) { px(g, OUT, Math.round(cx - hw) - 1, y - 1, Math.round(hw * 2) + 2, 4); px(g, dark, Math.round(cx - hw), y, Math.round(hw * 2), 2); px(g, col, Math.round(cx - hw), y, Math.round(hw * 2), 1); }
      deck(y1, half(y1) + 2, '#ff4fd8'); deck(y2, half(y2) + 2, '#7cf5ff'); deck(y3, half(y3) + 2, '#9f8cff');
      /* the spire and its light */
      px(g, '#dce3ff', Math.round(cx) - 1, 0, 1, y3); px(g, '#ffe97c', Math.round(cx) - 2, 0, 3, 2);
      /* outline whatever is drawn */
      var id = g.getImageData(0, 0, w, h), dd = id.data, on = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && dd[(y * w + x) * 4 + 3] > 0; }, edge = [];
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) if (!on(xx, yy) && (on(xx + 1, yy) || on(xx - 1, yy) || on(xx, yy + 1) || on(xx, yy - 1))) edge.push([xx, yy]);
      edge.forEach(function (e) { px(g, OUT, e[0], e[1]); });
    },
    sapphire: function (g, w, h) {
      px(g, '#0e2a6a', 0, 0, w, h); px(g, '#3a7aff', 2, 2, w - 4, h - 6);
      for (var x = 4; x < w - 2; x += 6) px(g, '#9fd0ff', x, 2, 1, h - 6);
      px(g, '#0b0d1a', (w >> 1) - 4, h - 8, 8, 8); px(g, '#7cf5ff', (w >> 1) - 4, h - 8, 8, 1);
    },
    ncpd: function (g, w, h) {
      px(g, '#c8ccd8', 0, 0, w, h); px(g, '#e6e8f0', 0, 0, w, 6);
      for (var x = 4; x < w - 2; x += 8) px(g, '#8a92a6', x, 8, 3, h - 14);
      px(g, '#2a6aff', 2, 2, w - 4, 2); px(g, '#ff2a4a', (w >> 1), 2, 6, 2);
      px(g, '#4a5260', (w >> 1) - 5, h - 8, 10, 8);
    },
    hospital: function (g, w, h) {
      px(g, '#e6e8f0', 0, 0, w, h); px(g, '#8ad0b0', 0, 0, w, 4);
      for (var y = 8; y < h - 8; y += 6) for (var x = 4; x < w - 4; x += 6) px(g, '#7cf5ff', x, y, 3, 3);
      px(g, '#ff4f6a', (w >> 1) - 6, 10, 12, 4); px(g, '#ff4f6a', (w >> 1) - 2, 6, 4, 12);
      px(g, '#2a2a30', (w >> 1) - 5, h - 8, 10, 8);
    },
    pagoda: function (g, w, h) {
      px(g, '#2a1e22', 0, 0, w, h);
      for (var i = 0; i < 3; i++) { px(g, '#a83030', 2 + i * 4, 4 + i * 12, w - 4 - i * 8, 4); px(g, '#ffd36a', 6 + i * 4, 8 + i * 12, w - 12 - i * 8, 6); }
      px(g, '#ff6a3a', 4, h - 6, 3, 3); px(g, '#ff6a3a', w - 7, h - 6, 3, 3);
    },
    greattree: function (g, w, h) {
      px(g, '#173a2a', 0, 0, w, h);
      px(g, '#123a2a', 4, 2, w - 8, h - 14); px(g, '#0f2a20', 2, 10, w - 4, h - 22);
      px(g, '#4a2e1a', (w >> 1) - 5, h - 16, 10, 16);
      for (var i = 0; i < 18; i++) px(g, ['#3affc8', '#b28cff', '#7cf5ff'][i % 3], 4 + (i * 11) % (w - 8), 4 + (i * 7) % (h - 20), 2, 2);
    },
    market: function (g, w, h) {
      px(g, '#2f6f5e', 0, 0, w, h);
      for (var x = 0; x < w; x += 8) px(g, x % 16 ? '#e8b13a' : '#c4473a', x, 0, 8, 10);
      px(g, '#ffd36a', 6, 14, w - 12, 2); px(g, '#0b0d1a', (w >> 1) - 6, h - 10, 12, 10);
    },
    arcade: function (g, w, h) {
      px(g, '#1a080c', 0, 0, w, h); px(g, '#ff4fd8', 2, 2, w - 4, 8);
      px(g, '#1a080c', 6, 4, 20, 4); px(g, '#f4f6ff', 8, 5, 12, 1); px(g, '#b0b8d0', 20, 4, 6, 3);
      px(g, '#ff2a4a', 4, 14, 10, 12); px(g, '#7cf5ff', 6, 16, 6, 4);
      px(g, '#0b0d1a', w - 18, 14, 12, h - 14); px(g, '#ff4fd8', w - 18, 14, 12, 1);
    },
    noorborj: function (g, w, h) {
      px(g, '#2a1014', 0, 0, w, h);
      px(g, '#3a2a40', 10, 10, w - 20, h - 10); px(g, '#4a3a58', 12, 10, 4, h - 10);
      px(g, '#ff2a4a', 8, 6, w - 16, 6); px(g, '#ffe97c', 14, 2, w - 28, 6);
      px(g, '#1a080c', (w >> 1) - 1, 0, 2, 3);
      for (var y = 18; y < h - 6; y += 10) px(g, '#ff4f6a', (w >> 1) - 2, y, 4, 5);
      px(g, '#0b0d1a', (w >> 1) - 4, h - 8, 8, 8);
    }
  };
  /* a barber's front: the striped pole, the big window, the chair */
  MARK_ART.barber = function (g, w, h) {
    px(g, '#1c1736', 0, 0, w, h); px(g, '#2a1d5e', 0, 0, w, 3); px(g, '#7cf5ff', 0, 3, w, 1);
    px(g, '#0b0d1a', 10, 7, 22, 14); px(g, '#1e3a4a', 11, 8, 20, 12);
    px(g, '#dce3ff', 16, 13, 6, 2); px(g, '#c4374a', 17, 15, 4, 3); px(g, '#9aa0b8', 18, 18, 2, 2);
    for (var y = 6; y < h - 4; y++) px(g, (y >> 1) % 3 === 0 ? '#ff4fd8' : (y >> 1) % 3 === 1 ? '#dce3ff' : '#7cf5ff', 4, y, 3, 1);
    px(g, '#ffe97c', 4, 5, 3, 1); px(g, '#ffe97c', 4, h - 4, 3, 1);
    px(g, '#0b0d1a', 36, 18, 8, 14); px(g, '#7cf5ff', 36, 18, 8, 1);
  };
  /* a clothes shop: an awning, a lit window, a mannequin in it */
  MARK_ART.threads = function (g, w, h) {
    px(g, '#1c1736', 0, 0, w, h);
    for (var x = 0; x < w; x += 6) px(g, (x / 6) % 2 ? '#ff4fd8' : '#dce3ff', x, 0, 6, 5);
    px(g, '#0b0d1a', 0, 5, w, 1);
    px(g, '#0b0d1a', 4, 9, 26, 14); px(g, '#3a2f6a', 5, 10, 24, 12); px(g, '#7cf5ff', 5, 10, 24, 1);
    px(g, '#e8b796', 15, 11, 4, 3); px(g, '#ff4fd8', 13, 14, 8, 6); px(g, '#9aa0b8', 16, 20, 2, 2);
    px(g, '#0b0d1a', 34, 16, 10, 16); px(g, '#ff4fd8', 34, 16, 10, 1);
  };
  /* an apartment block: brick, rows of lit and dark windows, a buzzer */
  MARK_ART.apt = function (g, w, h) {
    px(g, '#3a2430', 0, 0, w, h); px(g, '#2a1a22', 0, 0, w, 3);
    for (var y = 6; y < h; y += 4) for (var x = (y >> 2) % 2 ? 0 : 3; x < w; x += 6) px(g, '#4a2e3a', x, y, 4, 1);
    for (var r = 0; r < 2; r++) for (var c = 0; c < 4; c++) {
      var wx = 3 + c * 11, wy = 5 + r * 9, lit = (r * 4 + c) % 3 !== 1;
      px(g, OUT, wx, wy, 7, 6); px(g, lit ? '#ffd36a' : '#141a2e', wx + 1, wy + 1, 5, 4);
    }
    px(g, OUT, (w >> 1) - 5, h - 12, 10, 12); px(g, '#1a1426', (w >> 1) - 4, h - 11, 8, 11); px(g, '#ff4fd8', (w >> 1) - 4, h - 11, 8, 1);
    px(g, '#7cf5ff', (w >> 1) + 6, h - 8, 2, 3);
  };
  /* casino settebello: gold, a big seven, red carpet to the door */
  MARK_ART.casino = function (g, w, h) {
    px(g, '#1a0c10', 0, 0, w, h); px(g, '#f2c94c', 0, 0, w, 3); px(g, '#8a6a1a', 0, 3, w, 1);
    for (var x = 4; x < w - 4; x += 8) { px(g, '#fff3b0', x, 6, 3, 3); }
    px(g, '#0b0d1a', (w >> 1) - 10, 12, 20, 18); px(g, '#3a1218', (w >> 1) - 9, 13, 18, 16);
    px(g, '#f2c94c', (w >> 1) - 5, 15, 10, 2); px(g, '#f2c94c', (w >> 1) + 2, 17, 3, 3); px(g, '#f2c94c', (w >> 1), 20, 3, 3); px(g, '#f2c94c', (w >> 1) - 2, 23, 3, 4);
    px(g, '#0b0d1a', (w >> 1) - 6, h - 14, 12, 14); px(g, '#c4473a', (w >> 1) - 5, h - 13, 10, 13); px(g, '#f2c94c', (w >> 1) - 5, h - 13, 10, 1);
    for (var y = 12; y < h - 4; y += 8) { px(g, '#ff4fd8', 6, y, 10, 4); px(g, '#ff4fd8', w - 16, y, 10, 4); }
  };
  MARK_ART.slot = function (g, w, h) {
    px(g, OUT, 2, 0, 12, 16); px(g, '#8a1a2a', 3, 1, 10, 14); px(g, '#f2c94c', 3, 1, 10, 2);
    px(g, '#f4f6ff', 4, 5, 8, 4); px(g, '#c4473a', 5, 6, 2, 2); px(g, '#f2c94c', 9, 6, 2, 2); px(g, '#9aa0b8', 13, 4, 2, 6);
  };
  /* fires to cook on */
  MARK_ART.drumfire = function (g) {
    px(g, OUT, 3, 6, 10, 10); px(g, '#5a5a62', 4, 7, 8, 8); px(g, '#3a3a42', 4, 10, 8, 1); px(g, '#8a2a1a', 5, 13, 2, 2);
    px(g, '#ff6a3a', 5, 3, 6, 4); px(g, '#ffd36a', 6, 1, 4, 4); px(g, '#fff3b0', 7, 3, 2, 2);
  };
  MARK_ART.campfire = function (g) {
    px(g, '#8a8a92', 2, 12, 3, 2); px(g, '#8a8a92', 11, 12, 3, 2); px(g, '#8a8a92', 6, 14, 4, 2);
    px(g, '#5a3a22', 3, 10, 10, 2); px(g, '#6a4422', 5, 11, 6, 2);
    px(g, '#ff6a3a', 5, 6, 6, 5); px(g, '#ffd36a', 6, 4, 4, 5); px(g, '#fff3b0', 7, 7, 2, 2);
  };
  MARK_ART.grill = function (g) {
    px(g, OUT, 2, 4, 12, 10); px(g, '#8a92a6', 3, 5, 10, 8); px(g, '#2a2f4a', 4, 6, 8, 5);
    for (var x = 5; x < 12; x += 2) px(g, '#ff4f5e', x, 7, 1, 3);
    px(g, '#5a6070', 4, 14, 2, 2); px(g, '#5a6070', 10, 14, 2, 2); px(g, '#7cf5ff', 11, 5, 1, 1);
  };
  /* no sign: a steamy window, a red lantern, nothing else */
  MARK_ART.noodlebar = function (g, w, h) {
    px(g, '#1c1736', 0, 0, w, h); px(g, '#2a1d5e', 0, 0, w, 3);
    px(g, OUT, 4, 8, 22, 14); px(g, '#c8ccd8', 5, 9, 20, 12); for (var i = 0; i < 4; i++) px(g, '#f4f6ff', 7 + i * 5, 11 + (i % 2) * 3, 3, 2);
    px(g, '#c4473a', w - 12, 5, 6, 8); px(g, '#ffd36a', w - 11, 7, 4, 4);
    px(g, OUT, w - 14, 16, 10, 16); px(g, '#c4473a', w - 13, 17, 8, 15);
  };
  MARK_ART.teahouse = function (g, w, h) {
    px(g, '#2a1e22', 0, 0, w, h); px(g, '#a83030', 0, 0, w, 5); px(g, '#7a2020', 2, 5, w - 4, 2);
    px(g, '#3a5a3a', 6, 10, 12, 10); px(g, '#ffd36a', 8, 12, 8, 1); px(g, '#ffd36a', 8, 15, 8, 1);
    px(g, OUT, w - 14, 14, 10, h - 14); px(g, '#5a3a22', w - 13, 15, 8, h - 15);
    px(g, '#ff6a3a', 22, 8, 3, 4);
  };
  MARK_ART.fountain = function (g, w, h) {
    px(g, '#8a92a6', 0, h - 10, w, 10); px(g, '#c8ccd8', 1, h - 10, w - 2, 2); px(g, '#2f69a0', 3, h - 8, w - 6, 5);
    px(g, '#c8ccd8', (w >> 1) - 3, 6, 6, h - 14); px(g, '#7cf5ff', (w >> 1) - 1, 1, 2, 8);
    for (var i = 0; i < 4; i++) px(g, '#bfe4ff', 6 + i * 6, h - 7, 2, 1);
  };
  /* the back room's door: no sign, a light under it */
  MARK_ART.backroom = function (g, w, h) {
    px(g, '#1a080c', 0, 0, w, h); px(g, '#2a1014', 0, 0, w, 3);
    for (var y = 5; y < h; y += 4) for (var x = (y >> 2) % 2 ? 0 : 3; x < w; x += 6) px(g, '#2a1218', x, y, 4, 1);
    px(g, OUT, (w >> 1) - 6, h - 16, 12, 16); px(g, '#3a2a20', (w >> 1) - 5, h - 15, 10, 15); px(g, '#ffd36a', (w >> 1) - 5, h - 1, 10, 1);
    px(g, '#8a92a6', (w >> 1) + 2, h - 8, 2, 2);
  };
  MARK_ART.lockup = function (g, w, h) {
    px(g, '#1c1e26', 0, 0, w, h); px(g, '#2a2d38', 0, 0, w, 3);
    for (var y = 6; y < h; y += 5) px(g, '#24262f', 0, y, w, 1);
    px(g, OUT, (w >> 1) - 6, h - 16, 12, 16); px(g, '#5a6070', (w >> 1) - 5, h - 15, 10, 15); px(g, '#3a3f4a', (w >> 1) - 5, h - 8, 10, 1);
    px(g, '#8a92a6', (w >> 1) - 3, h - 13, 6, 2);
    /* the crescent, small */
    px(g, '#7cffb2', (w >> 1) + 1, h - 12, 1, 3); px(g, '#7cffb2', w >> 1, h - 13, 1, 1); px(g, '#7cffb2', w >> 1, h - 9, 1, 1);
  };
  MARK_ART.lottobooth = function (g, w, h) {
    px(g, '#3a1218', 0, 2, w, h - 2); px(g, '#f2c94c', 0, 2, w, 3);
    for (var i = 0; i < 3; i++) { px(g, OUT, 8 + i * 12, 7, 8, 8); px(g, '#f4f6ff', 9 + i * 12, 8, 6, 6); px(g, '#c4473a', 11 + i * 12, 10, 2, 2); }
  };
  MARK_ART.bjtable = function (g, w, h) {
    px(g, '#5a3a22', 0, 0, w, h); px(g, '#1f6a3a', 2, 2, w - 4, h - 4); px(g, '#f2c94c', 2, 2, w - 4, 1);
    px(g, '#f4f6ff', 14, 10, 6, 8); px(g, '#f4f6ff', 22, 11, 6, 8); px(g, '#c4473a', 16, 12, 2, 2); px(g, '#0b0d1a', 24, 13, 2, 2);
  };
  MARK_ART.wheel = function (g, w, h) {
    px(g, '#5a3a22', 0, 0, w, h); px(g, '#1f6a3a', 2, 2, w - 4, h - 4);
    var cx = w >> 1, cy = h >> 1;
    for (var y = -10; y <= 10; y++) for (var x = -10; x <= 10; x++) { var d = Math.sqrt(x * x + y * y); if (d <= 10) px(g, d > 8 ? '#5a3a22' : (Math.floor(Math.atan2(y, x) * 4) % 2 ? '#c4473a' : '#0b0d1a'), cx + x, cy + y); }
    px(g, '#f2c94c', cx - 2, cy - 2, 4, 4); px(g, '#f4f6ff', cx + 6, cy - 5, 2, 2);
  };
  MARK_ART.dicetable = function (g, w, h) {
    px(g, '#5a3a22', 0, 0, w, h); px(g, '#1f4a6a', 2, 2, w - 4, h - 4);
    [[14, 10], [26, 14]].forEach(function (d) { px(g, OUT, d[0] - 1, d[1] - 1, 8, 8); px(g, '#f4f6ff', d[0], d[1], 6, 6); px(g, '#0b0d1a', d[0] + 1, d[1] + 1, 1, 1); px(g, '#0b0d1a', d[0] + 4, d[1] + 4, 1, 1); px(g, '#0b0d1a', d[0] + 2, d[1] + 2, 2, 2); });
  };
  /* a corner store: a lit sign, glass doors, a fridge glowing inside */
  MARK_ART.mart = function (g, w, h) {
    px(g, '#1c1736', 0, 0, w, h); px(g, '#7cffb2', 0, 2, w, 5); px(g, '#0b0d1a', 4, 3, w - 8, 3);
    for (var x = 6; x < w - 6; x += 5) px(g, '#7cffb2', x, 4, 3, 1);
    px(g, '#0b0d1a', 4, 10, 22, 16); px(g, '#2a3a5a', 5, 11, 20, 14); px(g, '#9fd0ff', 6, 12, 6, 12); px(g, '#ffe97c', 14, 14, 3, 3); px(g, '#ff8a6b', 19, 14, 3, 3);
    px(g, '#0b0d1a', w - 14, 14, 10, h - 14); px(g, '#7cffb2', w - 14, 14, 10, 1); px(g, '#9fd0ff', w - 12, 16, 2, h - 18);
  };
  /* a pawn shop: three gold balls, a barred window, a heavy door */
  MARK_ART.pawn = function (g, w, h) {
    px(g, '#2a1014', 0, 0, w, h); px(g, '#3a1218', 0, 0, w, 4);
    [[6, 4], [11, 9], [16, 4]].forEach(function (b) { px(g, OUT, b[0] - 1, b[1] - 1, 6, 6); px(g, '#f2c94c', b[0], b[1], 4, 4); px(g, '#fff3b0', b[0], b[1], 1, 1); });
    px(g, '#0b0d1a', 22, 8, 14, 14); px(g, '#3a2a10', 23, 9, 12, 12);
    for (var x = 24; x < 36; x += 3) px(g, '#8a92a6', x, 9, 1, 12);
    px(g, '#0b0d1a', w - 10, 14, 8, h - 14); px(g, '#f2c94c', w - 4, 22, 1, 2);
  };
  /* the boatyard: planks, a hull up on blocks, rope */
  MARK_ART.boatyard = function (g, w, h) {
    px(g, '#3a2a1c', 0, 0, w, h);
    for (var y = 3; y < h; y += 5) px(g, '#4e3a28', 0, y, w, 1);
    px(g, OUT, 6, 8, w - 24, 12); px(g, '#8a5a32', 7, 9, w - 26, 6); px(g, '#c8a878', 7, 9, w - 26, 1); px(g, '#2f5a6a', 9, 15, w - 30, 3);
    px(g, '#5a4a40', 10, 20, 4, 6); px(g, '#5a4a40', w - 26, 20, 4, 6);
    px(g, OUT, w - 14, h - 14, 10, 14); px(g, '#1a1426', w - 13, h - 13, 8, 13); px(g, '#ffd36a', w - 13, h - 13, 8, 1);
    for (var i = 0; i < 4; i++) px(g, '#c8a878', w - 12 + (i % 2), 3 + i * 2, 4, 1);
  };
  /* indoors */
  MARK_ART.chest = function (g) {
    px(g, OUT, 1, 4, 14, 11); px(g, '#7a5638', 2, 5, 12, 9); px(g, '#5a3a22', 2, 8, 12, 1); px(g, '#c8a878', 2, 5, 12, 1);
    px(g, '#f2c94c', 7, 8, 2, 3);
  };
  MARK_ART.window = function (g, w, h) {
    px(g, '#3a3150', 0, 0, w, h); px(g, OUT, 3, 2, w - 6, h - 5); px(g, '#141a2e', 4, 3, w - 8, h - 7);
    for (var i = 0; i < 6; i++) px(g, ['#ff4fd8', '#7cf5ff', '#ffe97c'][i % 3], 6 + (i * 5) % (w - 12), 5 + (i * 3) % (h - 10), 1, 1);
    px(g, OUT, (w >> 1), 2, 1, h - 5); px(g, '#5a4a70', 2, h - 3, w - 4, 2);
  };
  MARK_ART.bed = function (g, w, h) {
    px(g, '#14121c', 0, 0, w, h); px(g, '#5a3a22', 1, 1, w - 2, h - 2);
    px(g, '#dce3ff', 3, 3, w - 6, 7); px(g, '#9f8cff', 2, 11, w - 4, h - 13); px(g, '#7a6acc', 2, 11, w - 4, 2);
  };
  MARK_ART.counter = function (g, w, h) {
    px(g, '#2a2f4a', 0, 0, w, h); px(g, '#8a92a6', 0, 0, w, 4);
    px(g, '#ff4f6a', 4, 1, 4, 3); px(g, '#dce3ff', 14, 1, 3, 3); px(g, '#dce3ff', 19, 1, 3, 3);
    for (var x = 3; x < w - 4; x += 14) { px(g, OUT, x, 6, 8, 8); px(g, '#3a4060', x + 1, 7, 6, 6); }
  };
  MARK_ART.plant = function (g, w, h) {
    px(g, '#5a3a22', 4, 9, 8, 6); px(g, '#7a5638', 4, 9, 8, 1);
    px(g, '#3fd0b0', 7, 2, 2, 8); px(g, '#3fd0b0', 3, 4, 4, 2); px(g, '#3fd0b0', 9, 3, 4, 2); px(g, '#5fd06a', 5, 6, 6, 2);
  };
  MARK_ART.sofa = function (g, w, h) {
    px(g, '#2a1d5e', 0, 2, w, h - 2); px(g, '#3b2f6a', 2, 6, w - 4, 7); px(g, '#4c3d86', 0, 2, 3, h - 2); px(g, '#4c3d86', w - 3, 2, 3, h - 2);
    px(g, '#4c3d86', 3, 3, w - 6, 3);
  };
  MARK_ART.tv = function (g, w, h) {
    px(g, '#2a2f4a', 1, 3, 14, 10); px(g, '#9aa0b8', 3, 5, 10, 6);
    for (var y = 5; y < 11; y += 2) px(g, '#dce3ff', 3, y, 10, 1);
    px(g, '#14121c', 6, 13, 4, 2);
  };
  /* the big buildings' insides */
  MARK_ART.cabinet = function (g, w, h) {
    px(g, OUT, 2, 0, 12, 16); px(g, '#2a1d5e', 3, 1, 10, 14); px(g, '#ff4fd8', 3, 1, 10, 2);
    px(g, OUT, 4, 4, 8, 6); px(g, '#7cf5ff', 5, 5, 6, 4); px(g, '#ffe97c', 6, 6, 2, 1);
    px(g, '#14121c', 4, 11, 8, 2); px(g, '#ff2a4a', 5, 11, 2, 1); px(g, '#7cffb2', 9, 11, 1, 1);
  };
  MARK_ART.claw = function (g, w, h) {
    px(g, OUT, 1, 0, w - 2, h); px(g, '#ffd36a', 2, 1, w - 4, 2); px(g, '#1e3a4a', 2, 3, w - 4, 9);
    px(g, '#9aa0b8', (w >> 1) - 1, 3, 2, 3); px(g, '#9aa0b8', (w >> 1) - 3, 6, 6, 1);
    for (var i = 0; i < 5; i++) px(g, '#f4f6ff', 4 + i * 5, 9 - (i % 2), 3, 3);
    px(g, '#ff4fd8', 2, 12, w - 4, 3);
  };
  MARK_ART.prize = function (g, w, h) {
    px(g, '#3a1218', 0, 4, w, h - 4); px(g, '#ff4fd8', 0, 4, w, 2);
    for (var i = 0; i < 6; i++) px(g, ['#7cf5ff', '#ffe97c', '#f4f6ff', '#b28cff'][i % 4], 3 + i * 7, 0, 4, 4);
    px(g, '#ffe97c', 5, 9, w - 10, 1);
  };
  MARK_ART.lift = function (g, w, h) {
    px(g, '#3a3150', 0, 0, w, h); px(g, OUT, 4, 2, w - 8, h - 2); px(g, '#9aa0b8', 5, 3, (w >> 1) - 5, h - 3); px(g, '#8a92a6', (w >> 1), 3, (w >> 1) - 5, h - 3);
    px(g, '#ff2a4a', (w >> 1) - 2, 0, 4, 2);
  };
  MARK_ART.glass = function (g, w, h) {
    var c = ['#ff4fd8', '#7cf5ff', '#9f8cff', '#ffe97c', '#7cffb2'];
    for (var y = 0; y < h; y += 4) px(g, c[(y >> 2) % c.length], 2, y, w - 4, 4);
    px(g, '#f4f6ff', 4, 2, 1, h - 4);
  };
  MARK_ART.fork = function (g, w, h) {
    px(g, '#5a4a70', 6, h - 6, w - 12, 6); px(g, '#dce3ff', (w >> 1) - 1, h / 2, 2, h / 2 - 6);
    px(g, '#dce3ff', 8, 4, 3, h / 2 - 2); px(g, '#dce3ff', w - 11, 4, 3, h / 2 - 2); px(g, '#dce3ff', 8, h / 2, w - 16, 2);
    px(g, '#9f8cff', 8, 4, 1, 3); px(g, '#ff4fd8', w - 9, 5, 1, 2);
  };
  MARK_ART.bench = function (g, w, h) {
    px(g, OUT, 0, 5, w, 7); px(g, '#5a3a22', 1, 6, w - 2, 3); px(g, '#7a5638', 1, 6, w - 2, 1);
    px(g, '#3a2414', 2, 9, 2, 5); px(g, '#3a2414', w - 4, 9, 2, 5);
  };
  MARK_ART.bars = function (g, w, h) {
    px(g, '#4a5260', 0, 0, w, h);
    for (var x = 2; x < w; x += 4) px(g, '#c8ccd8', x, 0, 2, h);
    px(g, '#8a92a6', 0, 2, w, 2); px(g, '#8a92a6', 0, h - 4, w, 2);
  };
  MARK_ART.board = function (g, w, h) {
    px(g, '#8a92a6', 0, 0, w, h); px(g, OUT, 3, 2, w - 6, h - 4); px(g, '#c8a878', 4, 3, w - 8, h - 6);
    px(g, '#f4f6ff', 7, 5, 6, 7); px(g, '#f4f6ff', 17, 4, 6, 8); px(g, '#ff2a4a', 9, 6, 2, 2);
  };
  MARK_ART.desk = function (g, w, h) {
    px(g, '#2a2f4a', 0, 3, w, h - 3); px(g, '#c8ccd8', 0, 3, w, 3);
    px(g, '#7cf5ff', 6, 0, 6, 4); px(g, '#ffe97c', w - 8, 1, 2, 2);
    for (var x = 4; x < w - 4; x += 12) px(g, '#3a4060', x, 8, 6, 5);
  };
  MARK_ART.shrine = function (g, w, h) {
    px(g, '#7a2020', 0, 2, w, h - 2); px(g, '#a83030', 0, 2, w, 3); px(g, '#ffd36a', 4, 6, w - 8, 2);
    px(g, '#5a4a40', (w >> 1) - 5, 0, 10, 4); px(g, '#ffe97c', (w >> 1) - 1, 0, 2, 2);
  };
  MARK_ART.lantern = function (g, w, h) {
    px(g, OUT, 7, 0, 2, 3); px(g, OUT, 4, 3, 8, 11); px(g, '#ff6a3a', 5, 4, 6, 9); px(g, '#ffd36a', 6, 6, 4, 5);
    px(g, '#a83030', 5, 4, 6, 1); px(g, '#a83030', 5, 12, 6, 1);
  };
  MARK_ART.bell = function (g, w, h) {
    px(g, '#5a3a22', 2, 0, w - 4, 3);
    px(g, OUT, 3, 4, w - 6, h - 8); px(g, '#b08a3a', 4, 5, w - 8, h - 10); px(g, '#e8c46a', 5, 6, 2, h - 14);
    px(g, '#7a5a22', 2, h - 5, w - 4, 2);
  };
  MARK_ART.roots = function (g, w, h) {
    px(g, '#4a2e1a', 0, 6, w, 5); px(g, '#4a2e1a', 4, 2, 4, 6); px(g, '#4a2e1a', w - 9, 3, 4, 5);
    px(g, '#6a4a2a', 0, 6, w, 1); px(g, '#3affc8', 10, 8, 2, 1); px(g, '#b28cff', w - 6, 9, 1, 1);
  };
  MARK_ART.pool = function (g, w, h) {
    px(g, OUT, 2, 2, w - 4, h - 4); px(g, '#123563', 3, 3, w - 6, h - 6); px(g, '#2a2f6a', 6, 6, w - 12, h - 12);
    for (var i = 0; i < 8; i++) px(g, ['#f4f6ff', '#7cf5ff', '#ffe97c'][i % 3], 8 + (i * 13) % (w - 16), 8 + (i * 7) % (h - 16), 1, 1);
  };
  MARK_ART.shrooms = function (g, w, h) {
    [[3, 8], [8, 5], [10, 10]].forEach(function (m, i) {
      px(g, '#dce3ff', m[0] + 1, m[1] + 2, 2, 4); px(g, OUT, m[0] - 1, m[1] - 1, 6, 4); px(g, ['#7cf5ff', '#3affc8', '#b28cff'][i], m[0], m[1], 4, 2);
    });
  };
  MARK_ART.stall = function (g, w, h) {
    px(g, OUT, 0, 0, w, h);
    for (var i = 0; i < w / 4; i++) px(g, i % 2 ? '#f4f6ff' : '#e8b13a', 1 + i * 4, 1, 4, 5);
    px(g, '#5a3c26', 1, 7, w - 2, 8); px(g, '#7a5638', 1, 7, w - 2, 1);
    px(g, '#ff8a6b', 4, 9, 3, 3); px(g, '#7cffb2', 11, 9, 3, 3); px(g, '#ffd36a', 18, 9, 3, 3); px(g, '#ff8a6b', 25, 9, 3, 3);
  };
  var markArt = {}, UNFRAMED = { tower: 1, chest: 1, drumfire: 1, campfire: 1, grill: 1, slot: 1, plant: 1, tv: 1, sofa: 1, cabinet: 1, lantern: 1, bell: 1, roots: 1, shrooms: 1, bench: 1, fork: 1, glass: 1 };
  function markCanvas(m) {
    if (markArt[m.id]) return markArt[m.id];
    var c = document.createElement('canvas'); c.width = m.w * TS; c.height = m.h * TS;
    var g = c.getContext('2d');
    (MARK_ART[m.id] || MARK_ART.market)(g, c.width, c.height);
    if (UNFRAMED[m.id]) return (markArt[m.id] = c);
    px(g, OUT, 0, 0, c.width, 1); px(g, OUT, 0, c.height - 1, c.width, 1); px(g, OUT, 0, 0, 1, c.height); px(g, OUT, c.width - 1, 0, 1, c.height);
    return (markArt[m.id] = c);
  }

  /* ── cast shadows: the light comes from the top left, so everything
     standing drops a flat shadow SH_X right and SH_Y down. a landmark's
     is its own silhouette; a block of buildings' is worked out per tile
     (a pixel is shaded when the pixel up-left of it is a building) ── */
  var SH_X = 4, SH_Y = 3, SHADE = 0.3, markShade = {};
  function markShadow(m) {
    if (markShade[m.id]) return markShade[m.id];
    var src = markCanvas(m), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    return (markShade[m.id] = c);
  }
  function shadows(x0, y0, cx, cy, at, a) {
    if (a <= 0.01) return;
    if (!inside) {
      ctx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
      for (var y = y0; y <= y0 + VH && y < world.H; y++) for (var x = x0; x <= x0 + VW && x < world.W; x++) {
        var t = world.tile[y * world.W + x];
        if (t === T.BUILDING || t === T.LANDMARK) continue;
        var sx = x * TS - cx, sy = y * TS - cy, B = T.BUILDING;
        if (at(x - 1, y - 1) === B) ctx.fillRect(sx, sy, SH_X, SH_Y);
        if (at(x - 1, y) === B) ctx.fillRect(sx, sy + SH_Y, SH_X, TS - SH_Y);
        if (at(x, y - 1) === B) ctx.fillRect(sx + SH_X, sy, TS - SH_X, SH_Y);
      }
    }
    ctx.globalAlpha = a;
    world.marks.forEach(function (m) {
      if (m.x * TS - cx > VW * TS || (m.x + m.w) * TS - cx + SH_X < 0 || m.y * TS - cy > VH * TS || (m.y + m.h) * TS - cy + SH_Y < 0) return;
      ctx.drawImage(markShadow(m), m.x * TS - cx + SH_X, m.y * TS - cy + SH_Y);
    });
    ctx.globalAlpha = 1;
  }

  /* the boat, drawn over the lower half of whoever is in it */
  var hullCanvas = null;
  function hull() {
    if (hullCanvas) return hullCanvas;
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var g = c.getContext('2d');
    px(g, OUT, 0, 8, 16, 6); px(g, OUT, 1, 14, 14, 1);
    px(g, '#8a5a32', 1, 9, 14, 4); px(g, '#c8a878', 1, 9, 14, 1); px(g, '#6a4422', 2, 13, 12, 1);
    px(g, '#2f5a6a', 3, 11, 10, 1);
    px(g, 'rgba(220,240,255,.7)', 0, 15, 3, 1); px(g, 'rgba(220,240,255,.7)', 13, 15, 3, 1);
    return (hullCanvas = c);
  }

  /* ── people: 16x16, four directions, two frames ───────────── */
  var BODY = {
    down: ['................', '.....HHHHHH.....', '....HHHHHHHH....', '....HHHHHHHH....', '....HSSSSSSH....', '....SEESSEES....',
           '....SSSSSSSS....', '.....SSmmSS.....', '......SSSS......', '....CCCCCCCC....', '...SCCCCCCCCS...', '...SCCCCCCCCS...',
           '....CCCCCCCC....', '....PPP..PPP....', '....PPP..PPP....', '....kkk..kkk....'],
    up:   ['................', '.....HHHHHH.....', '....HHHHHHHH....', '....HHHHHHHH....', '....HHHHHHHH....', '....HHHHHHHH....',
           '....HHHHHHHH....', '.....HHHHHH.....', '......SSSS......', '....CCCCCCCC....', '...SCCCCCCCCS...', '...SCCCCCCCCS...',
           '....CCCCCCCC....', '....PPP..PPP....', '....PPP..PPP....', '....kkk..kkk....'],
    left: ['................', '.....HHHHHH.....', '....HHHHHHHH....', '....HHHHHHHH....', '....SSSSHHHH....', '....SESSSHHH....',
           '....SSSSSSHH....', '.....mSSSSS.....', '......SSSS......', '.....CCCCCC.....', '.....CSCCCC.....', '.....CSCCCC.....',
           '.....CCCCCC.....', '.....PPPPP......', '.....PPPPP......', '.....kk.kk......']
  };
  var STEP = { down: ['....PPP..PPP....', '....PPP...PP....', '....kkk...kk....'], up: ['....PPP..PPP....', '....PP...PPP....', '....kk...kkk....'],
               left: ['.....PPPPP......', '....PP..PP......', '....kk...kk.....'] };
  /* the other foot: with STEP that's stand, one foot, stand, the other */
  var STEP2 = { down: STEP.up, up: STEP.down, left: ['.....PPPPP......', '......PPP.......', '......kkk.......'] };
  var LOOKS = {
    /* magenta on the left, violet on the right, like her portrait */
    hex:     { H: '#ff4fd8', h: '#b14cff', S: '#e8b48a', C: '#1a1a22', P: '#2a2a3a', k: '#0b0b10', A: '#c8ccd8', hair: 'hex', acc: 'choker' },
    reveler: { H: '#7cf5ff', S: '#c88a64', C: '#ff4fd8', P: '#2a2f4a', k: '#111' },
    local:   { H: '#1a1010', S: '#7a4a30', C: '#e8b13a', P: '#2f6f5e', k: '#111' },
    ape:     { H: '#2a2420', S: '#8a6a54', C: '#3a5a3a', P: '#2a2420', k: '#1a1410', fur: 1 },
    clerk:   { H: '#c8ccd8', S: '#e0b090', C: '#2a3a6a', P: '#2a2f4a', k: '#111' },
    medic:   { H: '#1a1a1a', S: '#e0b48a', C: '#e6e8f0', P: '#8ad0b0', k: '#111' },
    merc:    { H: '#3a1218', S: '#b07a5a', C: '#3a1218', P: '#1a080c', k: '#111' },
    tailor:  { H: '#c9a25a', S: '#e8b796', C: '#5a1e3c', c: '#3a1428', A: '#f2c94c', P: '#14121c', k: '#111', hair: 'bob', acc: 'glasses' },
    /* koga: dark hair, the green robes his people make, war paint (vault: Koga) */
    koga:    { H: '#14100c', B: '#14100c', S: '#8a6a54', C: '#2f6a3a', c: '#1f4a2a', P: '#2a2018', k: '#1a1410', A: '#c4473a', marks: 'scar', fur: 1 },
    /* enzo: classic grey suit and tie, slightly balding (vault: Enzo) */
    enzo:    { H: '#5a4a3a', B: '#5a4a3a', S: '#e8c0a0', C: '#6a6a72', c: '#4a4a52', P: '#4a4a52', k: '#111', hair: 'buzz', acc: 'choker', A: '#8a1a2a' },
    cook:    { H: '#f4f6ff', B: '#2a2018', S: '#c88a64', C: '#f4f6ff', c: '#c8ccd8', P: '#2a2f4a', k: '#111', hair: 'buzz' },
    bouncer: { H: '#111', B: '#111', S: '#7a4a30', C: '#111118', c: '#08080c', P: '#111118', k: '#000', hair: 'buzz', acc: 'glasses', A: '#222' },
    shipwright: { H: '#9aa0a8', B: '#9aa0a8', S: '#b07a52', C: '#2f5a6a', c: '#1f3a48', P: '#3a3020', k: '#1a1410', hair: 'buzz', beard: 'full', A: '#f2c94c', acc: 'cap' },
    barber:  { H: '#14121c', B: '#14121c', S: '#a06a48', C: '#dce3ff', c: '#9aa0b8', P: '#2a2f4a', k: '#111', hair: 'buzz', beard: 'full' }
  };
  /* the Chippin' In parts, at walking size: hair shape, what they wear, the
     extra. dir is down, up or left (right is left mirrored) */
  function styled(rows, dir, look) {
    var g = rows.map(function (r) { return r.split(''); });
    function put(y, x, ch) { if (g[y] && x >= 0 && x < TS) g[y][x] = ch; }
    function swap(y, from, to, x0, x1) { for (var x = x0 || 0; x <= (x1 === undefined ? TS - 1 : x1); x++) if (g[y][x] === from) g[y][x] = to; }
    var y, x, side = dir === 'left';
    switch (look.hair) {
      case 'buzz': for (x = 0; x < TS; x++) g[1][x] = '.'; break;
      case 'long':
        for (y = 4; y <= 10; y++) { if (dir === 'down') { put(y, 3, 'H'); put(y, 12, 'H'); } else if (side) { put(y, 10, 'H'); put(y, 11, 'H'); } else swap(y, 'S', 'H', 4, 11); }
        break;
      case 'bob':
        for (y = 4; y <= 7; y++) { if (dir === 'down') { put(y, 3, 'H'); put(y, 12, 'H'); } else if (side) { put(y, 10, 'H'); put(y, 11, 'H'); } }
        break;
      case 'mohawk':
        for (y = 1; y <= 3; y++) swap(y, 'H', 'S');
        if (dir === 'up') for (y = 4; y <= 7; y++) swap(y, 'H', 'S');
        for (y = 0; y <= 6; y++) { if (side) { put(y, 7, 'H'); put(y, 8, 'H'); } else if (y <= 3 || dir === 'up') { put(y, 7, 'H'); put(y, 8, 'H'); } }
        break;
      case 'spiky': [5, 7, 9, 11].forEach(function (sx) { put(0, side ? sx - 1 : sx, 'H'); }); break;
      case 'undercut': if (dir === 'down') { put(4, 4, 'S'); put(4, 11, 'S'); } break;
      /* hex's: two high bunches, and the tails fall past her shoulders to her waist */
      /* hex's: two high bunches, the tails down to her chest (like her portrait) */
      case 'hex':
        if (side) {
          for (y = 0; y <= 9; y++) { put(y, 11, 'H'); put(y, 12, 'H'); }
        } else {
          for (y = 0; y <= 2; y++) { put(y, 2, 'H'); put(y, 3, 'H'); put(y, 12, 'H'); put(y, 13, 'H'); }
          for (y = 3; y <= 9; y++) { put(y, 2, 'H'); put(y, 13, 'H'); }
          for (y = 3; y <= 7; y++) { put(y, 3, 'H'); put(y, 12, 'H'); }
          /* from behind, a little hangs down her back */
          if (dir === 'up') for (y = 8; y <= 9; y++) for (x = 5; x <= 10; x++) put(y, x, 'H');
        }
        break;
    }
    /* apes: fur round a lighter muzzle, fur down the arms */
    if (look.fur) {
      if (dir === 'down') { for (y = 4; y <= 6; y++) { put(y, 4, 'H'); put(y, 11, 'H'); } put(7, 5, 'H'); put(7, 10, 'H'); put(8, 6, 'H'); put(8, 9, 'H'); }
      else if (side) { put(4, 7, 'H'); put(4, 6, 'H'); put(8, 8, 'H'); }
      for (y = 10; y <= 11; y++) { put(y, 3, 'H'); put(y, 12, 'H'); if (side) put(y, 6, 'H'); }
    }
    /* facial hair, at walking size: a few pixels round the mouth */
    var bd = look.beard;
    if (dir === 'down') {
      if (bd === 'stubble') { put(7, 5, 'B'); put(7, 10, 'B'); }
      if (bd === 'mustache' || bd === 'circle') for (x = 6; x <= 9; x++) put(6, x, 'B');
      if (bd === 'goatee' || bd === 'circle') { put(8, 7, 'B'); put(8, 8, 'B'); }
      if (bd === 'full') { put(6, 4, 'B'); put(6, 11, 'B'); put(7, 5, 'B'); put(7, 6, 'B'); put(7, 9, 'B'); put(7, 10, 'B'); for (x = 6; x <= 9; x++) put(8, x, 'B'); }
      if (bd === 'sideburns') { put(5, 4, 'B'); put(6, 4, 'B'); put(5, 11, 'B'); put(6, 11, 'B'); }
    } else if (side) {
      if (bd === 'stubble') put(7, 7, 'B');
      if (bd === 'mustache' || bd === 'circle') { put(6, 4, 'B'); put(6, 5, 'B'); }
      if (bd === 'goatee' || bd === 'circle') put(8, 6, 'B');
      if (bd === 'full') { for (x = 6; x <= 9; x++) put(7, x, 'B'); put(8, 6, 'B'); put(8, 7, 'B'); }
      if (bd === 'sideburns' || bd === 'full') { put(5, 8, 'B'); put(6, 8, 'B'); }
    }
    /* marks, at walking size: only the ones that read from above */
    if (dir === 'down') {
      if (look.marks === 'implant') { put(6, 4, 'G'); put(6, 11, 'G'); }
      if (look.marks === 'chrome') { put(6, 4, 'A'); put(6, 5, 'A'); }
      if (look.marks === 'freckles') { put(6, 5, 'f'); put(6, 10, 'f'); }
      if (look.marks === 'scar') { put(4, 9, 'r'); put(6, 10, 'r'); }
    } else if (side && (look.marks === 'implant' || look.marks === 'chrome')) put(6, 6, look.marks === 'implant' ? 'G' : 'A');
    if (look.top === 'tank') { put(9, side ? 5 : 4, 'S'); if (!side) put(9, 11, 'S'); }
    if (look.top === 'turtleneck') for (x = 6; x <= 9; x++) put(8, side ? x - 1 : x, 'c');
    if (look.acc === 'cap') {
      for (x = 5; x <= 10; x++) put(1, x, 'A');
      for (x = 4; x <= 11; x++) put(2, x, 'A');
      if (dir === 'down') for (x = 4; x <= 11; x++) put(3, x, 'A');
      else if (side) for (x = 2; x <= 5; x++) put(3, x, 'A');
    }
    if (look.acc === 'headphones') {
      for (x = 5; x <= 10; x++) put(1, x, 'A');
      if (side) { put(4, 9, 'A'); put(5, 9, 'A'); }
      else { put(4, 3, 'A'); put(5, 3, 'A'); put(4, 12, 'A'); put(5, 12, 'A'); }
    }
    if (look.top === 'coat') for (y = 13; y <= 14; y++) { put(y, side ? 5 : 4, 'C'); put(y, side ? 9 : 11, 'C'); }
    if (look.top === 'jacket' && dir === 'down') for (y = 9; y <= 12; y++) { put(y, 7, 'k'); put(y, 8, 'k'); }
    if (look.top === 'hoodie' && dir !== 'down') for (x = 5; x <= 10; x++) put(8, side ? x - 1 : x, 'c');
    if (dir === 'down') {
      if (look.acc === 'glasses') { put(5, 4, 'A'); put(5, 7, 'A'); put(5, 8, 'A'); put(5, 11, 'A'); }
      if (look.acc === 'mask') for (x = 5; x <= 10; x++) put(7, x, 'A');
      if (look.acc === 'choker') for (x = 6; x <= 9; x++) put(8, x, 'A');
      if (look.acc === 'earring' || look.acc === 'studs') { put(6, 3, 'A'); put(6, 12, 'A'); }
    } else if (side && look.acc === 'glasses') { put(5, 4, 'A'); put(5, 6, 'A'); }
    return g.map(function (r) { return r.join(''); });
  }
  /* the game boy outline: every empty pixel touching the figure goes dark */
  function outline(g) {
    var id = g.getImageData(0, 0, TS, TS), d = id.data, solidAt = function (x, y) { return x >= 0 && y >= 0 && x < TS && y < TS && d[(y * TS + x) * 4 + 3] > 0; };
    var edge = [];
    for (var y = 0; y < TS; y++) for (var x = 0; x < TS; x++) {
      if (solidAt(x, y)) continue;
      if (solidAt(x + 1, y) || solidAt(x - 1, y) || solidAt(x, y + 1) || solidAt(x, y - 1)) edge.push([x, y]);
    }
    edge.forEach(function (e) { px(g, OUT, e[0], e[1]); });
  }
  var spriteCache = {};
  /* step: 0 standing, 1 and 2 the two walking feet, 3 breathing out (head
     and shoulders down a pixel) */
  function sprite(look, dir, step) {
    var key = JSON.stringify(look) + dir + step;
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var g = c.getContext('2d'), flip = dir === 'right', rows = BODY[flip ? 'left' : dir].slice();
    if (step === 1 || step === 2) { var st = (step === 1 ? STEP : STEP2)[flip ? 'left' : dir]; rows[13] = st[0]; rows[14] = st[1]; rows[15] = st[2]; }
    rows = styled(rows, flip ? 'left' : dir, look);
    if (step === 3) rows = ['................'].concat(rows.slice(0, 12), rows.slice(13));
    var colours = { H: look.H, h: look.h || look.H, B: look.B || look.H, S: look.S, f: shade(look.S || '#c88a64', 0.62), r: '#d48a8a', G: '#7cf5ff', E: '#0b0d1a', m: '#7a3a3a', C: look.C, c: look.c || look.C, E: look.E || '#0b0d1a', m: look.m || '#7a3a3a',
                    A: look.A || '#d8dce8', P: look.P || '#2a2f4a', k: look.k || '#111' };
    rows.forEach(function (r, y) {
      for (var x = 0; x < TS; x++) {
        var ch = r.charAt(x); if (ch === '.') continue;
        /* hex's split dye: the right half of her hair is the other colour */
        var col = ch === 'H' && x >= 8 ? colours.h : colours[ch];
        px(g, col, flip ? TS - 1 - x : x, y);
      }
    });
    outline(g);
    return (spriteCache[key] = c);
  }
  /* the crowd: a look of their own from their seed, the same every visit */
  var crowdLooks = {};
  function crowdLook(n) {
    if (crowdLooks[n.seed]) return crowdLooks[n.seed];
    var a = n.seed >>> 0;
    function rng() { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function pick(list) { return list[Math.floor(rng() * list.length)]; }
    /* apes: fur, face, and what their people make them wear */
    if (n.kind === 'ape') {
      var fur = pick(['#1a1410', '#2a2018', '#3a2a1c', '#4a3a2a', '#5a4a3a']);
      return (crowdLooks[n.seed] = { H: fur, B: fur, S: pick(['#8a6a54', '#9a7a60', '#7a5a48']), C: pick(['#3a5a3a', '#2f6f5e', '#5a4a2a', '#4a6a3a']), P: fur, k: '#1a1410', fur: 1 });
    }
    /* androids: chrome, a seam of light for eyes */
    if (n.kind === 'android') {
      var chrome = pick(['#c8ccd8', '#9aa0b8', '#d8dce8', '#8a92a6']);
      return (crowdLooks[n.seed] = { H: shade(chrome, 0.8), S: chrome, C: pick(['#1c1736', '#2a2f4a', '#14121c']), P: '#2a2f4a', k: '#111', E: pick(['#7cf5ff', '#ff4fd8', '#7cffb2']), m: shade(chrome, 0.7), hair: 'buzz' });
    }
    return (crowdLooks[n.seed] = lookOf(A ? A.random(rng) : {}));
  }
  /* the player looks like their Chippin' In face */
  function shade(hex, f) {
    var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return ('0' + Math.min(255, Math.round(v * f)).toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }
  function lookOf(raw) {
    var l = A ? A.normalize(raw) : {}, g = A && A.group ? A.group(l.kind) : 'human';
    var out = { H: l.hairC || '#3a2a20', B: shade(l.hairC || '#3a2a20', 0.85), S: l.skin || '#c88a64', C: l.topC || '#9f8cff', c: shade(l.topC || '#9f8cff', 0.7),
                A: l.accC, P: '#22263a', k: '#0b0b10', hair: l.hair, beard: l.beard, marks: l.marks, top: l.top, acc: l.acc };
    /* a simian: fur where the hair goes and down the arms, its species' face */
    if (g === 'ape') { out.H = out.B = l.skin; out.S = A.FACE[l.kind]; out.P = shade(l.skin, 0.8); out.fur = 1; out.hair = out.beard = undefined; }
    /* an android: its chassis for skin, eyes that glow */
    if (g === 'android') { out.E = l.eyeC; out.m = shade(l.skin, 0.7); }
    return out;
  }
  function playerLook() { return lookOf(s.player.look); }

  /* ── state ─────────────────────────────────────────────────── */
  var me = { x: 0, y: 0, dir: 'down', moving: false, fx: 0, fy: 0, t: 0, step: 0, sail: false };
  var npcs = [], held = {}, pressedA = false, talkBox = null, district = -3, card = { until: 0 };
  var loose = [], toastT = 0;
  /* the city, kept while the player is indoors; inside is the apartment they're in */
  var city = null, cityDeco = null, cityNpcs = null, inside = null, H = (window.MFShops && window.MFShops.HOMES) || {};

  function occupied(x, y) {
    if (M.solid(world, x, y)) return true;
    for (var i = 0; i < npcs.length; i++) if (npcs[i].x === x && npcs[i].y === y) return true;
    if (mobAt(x, y)) return true;
    return me.x === x && me.y === y;
  }
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  var stuckAt = 0;
  function tryMove(dir) {
    me.dir = dir;
    var d = DIRS[dir], nx = me.x + d[0], ny = me.y + d[1];
    /* too much to carry: not a step until something goes */
    if (!me.sail && window.MFShops.load(s) > window.MFShops.FROZEN) {
      if (Date.now() - stuckAt > 8000) { stuckAt = Date.now(); say(['you can\'t move under all this.\ndrop something, or stash it. (INV)']); }
      return;
    }
    if (me.sail) {
      if (nx < 0 || ny < 0 || nx >= world.W || ny >= world.H) { edgeOfTheWorld(); return; }
      var crewed = npcs.some(function (n) { return n.x === nx && n.y === ny; });
      if (M.water(world, nx, ny) && !crewed) { step(nx, ny, dir); return; }
      /* run aground: step ashore, if there's ground to step on */
      if (!occupied(nx, ny)) { me.sail = false; step(nx, ny, dir); return; }
      if (L) L.moved(me.x, me.y, dir, 1);
      return;
    }
    if (occupied(nx, ny)) {
      if (L) L.moved(me.x, me.y, dir);
      /* walking up into your own front door lets you in: the door, not the wall beside it */
      var hm = !inside && dir === 'up' && markAt(nx, ny);
      if (hm && (hm.home || hm.room) && !atDoor(hm, nx, ny)) hm = null;
      if (hm && hm.home && s.homes[hm.home]) goIn(hm.home);
      else if (hm && hm.room && !(M.ROOMS[hm.room] && M.ROOMS[hm.room].door > window.MF.joules(s))) goIn(hm.room);
      return;
    }
    step(nx, ny, dir);
  }
  function step(nx, ny, dir) {
    if (held.b) bTap.moved = true;
    me.fx = me.x; me.fy = me.y; me.x = nx; me.y = ny; me.moving = true; me.t = 0; me.step ^= 1;
    if (L) L.moved(nx, ny, dir, me.sail ? 1 : 0);
  }
  var edgeAt = 0;
  function edgeOfTheWorld() {
    if (Date.now() - edgeAt < 20000) return;
    edgeAt = Date.now();
    say(['the jörmun ocean goes on and on.\nthey say it wraps all the way round. not today.']);
  }
  /* into the boat: facing open water, with a boat to your name */
  function setSail(tx, ty) {
    ask(['the water\'s right there. set sail?'], function () { me.sail = true; step(tx, ty, me.dir); });
  }

  /* ── talking ─────────────────────────────────────────────── */
  function say(lines, who) {
    talkBox = { lines: lines.slice(), who: who || '' };
    $('wTalk').hidden = false;
    showLine();
  }
  /* a little menu in the talk box: ▲ ▼ pick, A choose, B never mind (or tap
     one). opts: [[label, run], ...]; a 'never mind' row is added at the end */
  var menuPrev = {};
  function menu(title, opts, who) {
    talkBox = { lines: [title], who: who || '', menu: opts.concat([['never mind', null]]), sel: 0 };
    menuPrev = { up: !!held.up, down: !!held.down, b: !!held.b };
    $('wTalk').hidden = false;
    showLine();
  }
  function pickMenu(i) {
    var row = talkBox && talkBox.menu && talkBox.menu[i];
    if (!row) return;
    talkBox = null; $('wTalk').hidden = true; $('wMenu').hidden = true;
    if (row[1]) row[1]();
  }
  function tickMenu() {
    var up = !!held.up && !menuPrev.up, dn = !!held.down && !menuPrev.down, n = talkBox.menu.length;
    menuPrev = { up: !!held.up, down: !!held.down, b: menuPrev.b && !!held.b };
    if (up || dn) { talkBox.sel = (talkBox.sel + (dn ? 1 : n - 1)) % n; showLine(); }
  }
  function showLine() {
    $('wWho').textContent = talkBox.who;
    var mb = $('wMenu');
    mb.hidden = !talkBox.menu; mb.innerHTML = '';
    $('wTalk').classList.toggle('menu', !!talkBox.menu);
    if (talkBox.menu) talkBox.menu.forEach(function (row, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'crow' + (i === talkBox.sel ? ' sel' : ''); b.textContent = row[0];
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pickMenu(i); });
      mb.appendChild(b);
    });
    var last = talkBox.yes && talkBox.lines.length === 1;
    $('wLine').textContent = talkBox.lines[0].replace(/\$handle\b/g, s.player.handle || 'stranger') + (last ? '\n\n' + (talkBox.label || 'A: yes    B: no') : '');
  }
  /* a yes/no question: A on the last line says yes, B says no */
  /* no: what B does instead of just closing; label: the line under the question */
  function ask(lines, yes, no, label) { say(lines); talkBox.yes = yes; talkBox.no = no; talkBox.label = label; showLine(); }
  function answer(ok) {
    var yes = talkBox.yes, no = talkBox.no;
    talkBox = null; $('wTalk').hidden = true;
    if (ok) yes(); else if (no) no();
  }
  function nextLine() {
    talkBox.lines.shift();
    if (talkBox.lines.length) return showLine();
    talkBox = null; $('wTalk').hidden = true;
  }
  /* after the cinnamon line she keeps it short */
  var HEX_COLD = ['...hey.', "arcade's open. i'm busy.", 'not tonight, ok?'];
  var HEX_AFTER = ["the arcade's open. high score's mine though. it's always mine.", 'back already? you missed me. say you missed me.',
                   "don't go knocking on the lighthouse, $handle. trust me on that one."];
  function interact() {
    var d = DIRS[me.dir], tx = me.x + d[0], ty = me.y + d[1], i;
    var fallen = !inside && (bodyAt(tx, ty) || bodyAt(me.x, me.y));
    if (fallen) return searchBody(fallen);
    for (i = 0; i < npcs.length; i++) {
      var n = npcs[i];
      if (n.x !== tx || n.y !== ty) continue;
      n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[me.dir];
      if (n.shop && api.shop) { api.shop(n.shop); return; }
      if (n.wright === 'slip') return scrapper();
      if (n.wright) return shipwright();
      if (n.store) return openCounter(n.store);
      if (n.scene === 'hex') {
        if (!s.met.hex && api.talk) { api.talk(); return; }
        var after = s.flags['hex-closed'] ? HEX_COLD : HEX_AFTER;
        return say([after[Math.floor(Math.random() * after.length)]], 'Hex');
      }
      /* someone running a game on the street */
      if (n.game) return openTable(n.game, n.house || 'street');
      if (n.vend) return openCounter(n.vend);
      if (n.name && n.lines) { n.said = ((n.said || 0) + 1) % n.lines.length; return say([n.lines[n.said]], n.name); }
      if (n.koga) {
        var kin = M.KOGA_ORIGIN[window.MF.knownOrigin(s, window.MFAvatar)];
        if (kin && !n.knew) { n.knew = 1; return say([kin], 'Koga'); }
        n.said = ((n.said || 0) + 1) % M.KOGA.length; return say([M.KOGA[n.said]], 'Koga');
      }
      if (n.pool !== undefined && n.kind) return say([chatter(n)]);
      /* an ape or an android indoors notices you the way the crowd does */
      var r = reaction(n.look, n.x * 31 + n.y, n.said || 0);
      if (r && !n.knew) { n.knew = 1; return say([r]); }
      var said = n.said || 0;
      n.said = (said + 1) % n.lines.length;
      return say([n.lines[said]]);
    }
    /* another player: they can't hear you yet, but you can see who they are */
    if (L && (!inside || inside.place)) {
      var walkers = L.list();
      for (i = 0; i < walkers.length; i++) {
        if (walkers[i].x !== tx || walkers[i].y !== ty) continue;
        return say([(walkers[i].name || 'a stranger') + ' is walking the city too.'], walkers[i].name || '');
      }
    }
    if (!inside && M.water(world, tx, ty) && !npcs.some(function (n) { return n.x === tx && n.y === ty; })) {
      var rod = window.MFShops.bestRod(s);
      if (me.sail && rod) return cast(tx, ty, rod);
      if (!me.sail && rod && s.boat) return menu('the water\'s right there. what now?', [['🎣 cast a line', function () { cast(tx, ty, rod); }], ['⛵ set sail', function () { me.sail = true; step(tx, ty, me.dir); }]]);
      if (!me.sail && rod) return cast(tx, ty, rod);
      if (!me.sail && s.boat) return setSail(tx, ty);
    }
    /* walking into a shop's front opens it too; an apartment's door sells
       itself or lets you in; furniture has something to say */
    var m = markAt(tx, ty);
    if (m && m.shop && api.shop) { api.shop(m.shop); return; }
    if (m && m.store) return openCounter(m.store);
    if (m && (m.home || (m.room && !inside)) && !(me.dir === 'up' && atDoor(m, tx, ty))) return notTheDoor(m, tx, ty);
    if (m && m.home) return homeDoor(m.home);
    if (m && m.room && !inside) {
      var need = M.ROOMS[m.room] && M.ROOMS[m.room].door;
      if (need && window.MF.joules(s) < need) return say(['high stakes only.\n' + window.MF.fmtJ(need) + ' in your pocket or keep walking.'], 'BOUNCER');
      return goIn(m.room);
    }
    if (m && m.game) return openTable(m.game, m.house || 'grand');
    if (m && m.vend) return openCounter(m.vend);
    if (m && m.fire) return openCounter('cook:fire:' + m.fire);
    if (m && m.kitchen && inside) return openCounter('cook:kitchen');
    if (m && m.chest && inside) return openCounter('stash:' + inside.id);
    if (m && m.fountain) {
      window.MF.consume(s, 0, 20);
      if (api.save) api.save();
      drawBody();
      return say(['you drink from the fountain anyway.\nit tastes like a permit.']);
    }
    if (m && m.shut) return say([m.shut]);
    if (m && m.cell && inside) return atBars(m);
    if (m && m.text) {
      if (m.bed && inside) {
        s.wake = inside.id;
        /* a proper rest, once a nova city day */
        var today2 = novaNow().day;
        /* any lie-down puts stamina and brainpower back; health once a day */
        var spent = window.MF.vital(s, 'sta') < window.MF.maxOf(s, 'sta') || window.MF.vital(s, 'int') < window.MF.maxOf(s, 'int');
        window.MF.rest(s); winded = false;
        if (s.items && s.items.flashlight) { spent = spent || s.torch < window.MFShops.GEAR.flashlight.secs; s.torch = window.MFShops.GEAR.flashlight.secs; }
        if (s.body.rested !== today2 && window.MF.vital(s, 'hp') < window.MF.maxOf(s, 'hp')) { s.body.rested = today2; window.MF.heal(s, 25); drawBody(); if (api.save) api.save(); return say(['you lie down for a while. the city hums.\nyou get up feeling better. (+25 health, rested)']); }
        if (spent) { drawBody(); if (api.save) api.save(); return say(['you lie down for a while. the city hums.\nyou get up rested. (stamina and brainpower back)']); }
        if (api.save) api.save();
      }
      return say([m.text]);
    }
    /* a sign is read facing it, or standing on it */
    for (i = 0; i < world.signs.length; i++) {
      var sg = world.signs[i];
      if ((sg.x === tx && sg.y === ty) || (sg.x === me.x && sg.y === me.y)) return say([sg.text]);
    }
  }

  /* the shipwright: says what a boat takes, and builds it when it's all there */
  function shipwright() {
    var SH = window.MFShops, MF = window.MF;
    if (s.boat) return say(['she\'s yours. face the water anywhere\nand press A to set sail.', 'mind the east coast. the reef\'s further out than it looks.'], 'SHIPWRIGHT');
    var short = SH.boatShort(MF, s, 'yard'), need = SH.BOAT.need;
    var list = Object.keys(need).map(function (k) { return SH.RES[k].name + ' ' + SH.haveFor(s, 'yard', k) + '/' + need[k]; }).join('\n') + '\n' + MF.fmtJ(MF.joules(s)) + ' of ' + MF.fmtJ(SH.BOAT.joules);
    if (short.length && canLeave('yard')) return leaveWith('yard', 'SHIPWRIGHT');
    var pitch = 'a boat? i can build you one. it gets you past the shore:\nvistadelsol, the islands, the whole nova sea.';
    if (short.length) return say([pitch, 'bring me ' + need.timber + ' timber, ' + need.fibre + ' palm fibre,\n' + need.scrap + ' scrap metal, and ' + MF.fmtJ(SH.BOAT.joules) + ' for my time.', 'what you\'ve got:\n' + list, 'timber\'s in naturia, by the trees. fibre in yucayeque.\nscrap round the labs, or over in redrum.'], 'SHIPWRIGHT');
    ask([pitch, 'that\'s everything. ' + need.timber + ' timber, ' + need.fibre + ' fibre, ' + need.scrap + ' scrap and ' + MF.fmtJ(SH.BOAT.joules) + '.\nbuild it?'], function () {
      var r = SH.buildBoat(MF, s);
      if (!r.ok) return say(['short of something. check your pockets.'], 'SHIPWRIGHT');
      wallet('-' + MF.fmtJ(SH.BOAT.joules));
      exp('craft', { xp: 60 });
      if (api.save) api.save();
      say(['sawing. hammering. a lot of swearing.', 'done. she\'s moored at the end of the pier.\nface the water anywhere and press A to set sail.'], 'SHIPWRIGHT');
    });
  }
  /* a builder holds what you bring a load at a time */
  function canLeave(yard) {
    var SH = window.MFShops, B = SH.BOATS[yard], bank = SH.banked(s, yard);
    return Object.keys(B.need).some(function (k) { return ((s.res || {})[k] || 0) > 0 && (bank[k] || 0) < B.need[k]; });
  }
  function leaveWith(yard, who) {
    var SH = window.MFShops, MF = window.MF, B = SH.BOATS[yard];
    ask(['you\'ve brought some of what the boat needs.\nleave it with me? i\'ll keep it till there\'s enough.'], function () {
      var moved = SH.leaveMats(s, yard), bank = SH.banked(s, yard);
      if (api.save) api.save();
      var got = Object.keys(moved).map(function (k) { return moved[k] + ' ' + SH.RES[k].name; }).join(', ');
      var still = SH.boatShort(MF, s, yard).map(function (x) { return x.kind === 'joules' ? MF.fmtJ(x.need) + ' for the labour' : (x.need - x.have) + ' more ' + SH.RES[x.kind].name; });
      say(['left with me: ' + got + '.\nheld for you: ' + Object.keys(B.need).map(function (k) { return (bank[k] || 0) + '/' + B.need[k] + ' ' + SH.RES[k].name; }).join(', ') + '.',
           still.length ? 'still need ' + still.join(', ') + '.' : 'that\'s everything. talk to me again and i\'ll build it.'], who);
    }, null);
  }
  /* the scrapper on redrum's slip: a skiff out of scrap, or one for cash.
     the only way off the island. PLACEHOLDER lines */
  function scrapper() {
    var SH = window.MFShops, MF = window.MF, B = SH.BOATS.slip, have = SH.haveFor(s, 'slip', 'scrap');
    if (s.boat) return say(['you\'ve got a boat. go on, the city\'s right there.\nface the water and press A.'], 'SCRAPPER');
    var pitch = 'the city? no bridge. never was.\nyou want across, you want a boat.';
    var terms = 'i\'ll knock you a skiff together: ' + B.need.scrap + ' scrap and ' + MF.fmtJ(B.joules) + ' for the labour.\nor ' + MF.fmtJ(B.buy) + ' and you take the one tied up out back.';
    var mine = 'you\'ve got ' + have + '/' + B.need.scrap + ' scrap, ' + MF.fmtJ(MF.joules(s)) + '.';
    var build = !SH.boatShort(MF, s, 'slip').length, buy = MF.joules(s) >= B.buy;
    function done(paid, built) {
      wallet('-' + MF.fmtJ(paid));
      if (built) exp('craft', { xp: 30 });
      if (api.save) api.save();
      say(['banging. welding. one swear word, very long.', 'there. she floats. mostly.\nface the water anywhere and press A to set sail.'], 'SCRAPPER');
    }
    if (!build && !buy && canLeave('slip')) return leaveWith('slip', 'SCRAPPER');
    if (!build && !buy) return say([pitch, terms, mine, 'scrap\'s lying about all over redrum.\nbring it a load at a time. i\'ll keep it for you.'], 'SCRAPPER');
    if (build) return ask([pitch, terms, mine + '\nbuild it?'], function () { if (SH.buildBoat(MF, s, 'slip').ok) done(B.joules, true); }, buy ? function () { if (SH.buyBoat(MF, s, 'slip').ok) done(B.buy); } : null, buy ? 'A: build it    B: just buy one' : null);
    ask([pitch, terms, mine + '\nbuy one?'], function () { if (SH.buyBoat(MF, s, 'slip').ok) done(B.buy); });
  }
  /* the crowd: their district's pool, in their own order, and now and then
     something about you, if there's something to say (world.js TALK) */
  /* what someone of this kind says about where you come from, if they can
     tell and have something to say (world.js ORIGIN_TALK) */
  function reaction(kind, seed, said) {
    var seen = window.MF.knownOrigin(s, window.MFAvatar), by = M.ORIGIN_TALK[kind];
    var lines = by && ((seen === 'product' && s.player.side && by['product-' + s.player.side]) || by[seen]);
    return lines ? lines[(seed + said) % lines.length] : '';
  }
  function chatter(n) {
    var ctx = [], hour = new Date().getHours();
    if (s.boat) ctx.push('boat');
    if (s.flags['hex-closed']) ctx.push('cold'); else if (s.met.hex) ctx.push('hex');
    if (window.MF.joules(s) >= 2000) ctx.push('rich');
    if (hour < 5) ctx.push('late');
    if (Object.keys(s.homes || {}).length) ctx.push('home');
    var said = n.said = (n.said || 0) + 1, seed = (n.seed || 7) >>> 0, roll = hash(seed, said);
    /* where you're from, if they can tell: likely the first time, now and then after */
    var r = reaction(n.kind, seed, said);
    if (r && hash(seed + 17, said) < (said === 1 ? 0.6 : 0.15)) return r;
    if (ctx.length && roll < 0.25) {
      var talk = M.TALK[ctx[(seed + said) % ctx.length]];
      return talk[(seed + said * 3) % talk.length];
    }
    /* him, by whatever their people call him */
    if (roll < 0.5) {
      var h = n.kind !== 'novan' ? n.kind : n.coast ? 'coast' : n.pool === 'redrum' ? 'redrum' : n.pool === 'haven' ? 'haven' : 'novan';
      var said2 = M.HANDLES[h] || M.HANDLES.novan;
      return said2[(seed + said * 5) % said2.length];
    }
    var pool = n.kind !== 'novan' && M.KIND_TALK[n.kind] && roll < 0.8 ? M.KIND_TALK[n.kind] : M.CROWD[n.pool] || n.lines;
    return pool[(seed + said * 7) % pool.length];
  }
  function markAt(x, y) {
    for (var i = 0; i < world.marks.length; i++) {
      var m = world.marks[i];
      if (x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h) return m;
    }
    return null;
  }
  /* where a building's door is drawn (MARK_ART): a pixel span across its
     front. most are centred; these few hang theirs on the right */
  var DOOR_PX = { arcade: function (W) { return [W - 18, W - 6]; }, noodlebar: function (W) { return [W - 14, W - 4]; }, teahouse: function (W) { return [W - 14, W - 4]; } };
  /* the front-row tiles the drawn door covers (a centred door on an even
     front straddles two) */
  function doorCols(m) {
    var W = m.w * TS, sp = DOOR_PX[m.id] ? DOOR_PX[m.id](W) : [(W >> 1) - 5, (W >> 1) + 5], out = [];
    for (var c = 0; c < m.w; c++) if (Math.min(sp[1], (c + 1) * TS) - Math.max(sp[0], c * TS) >= 4) out.push(m.x + c);
    return out.length ? out : [m.x + (m.w >> 1)];
  }
  /* walking up into (x, y) is walking through m's door */
  function atDoor(m, x, y) { return y === m.y + m.h - 1 && doorCols(m).indexOf(x) >= 0; }
  /* bumped the wrong part of a building: point them at the door */
  function notTheDoor(m, x, y) {
    var cols = doorCols(m);
    if (me.dir !== 'up' || y !== m.y + m.h - 1) return say(['no way in from here.\nthe door\'s round the front.']);
    return say(['that\'s wall. the door\'s to your ' + (cols[0] < x ? 'left' : 'right') + '.']);
  }

  /* ── apartments ──────────────────────────────────────────────
     a door you own lets you in; one you don't is for sale */
  function homeDoor(id) {
    var h = H[id] || { name: 'apartments', where: '', price: 0 }, have = window.MF.joules(s), cost = window.MF.fmtJ(h.price);
    if (s.homes[id]) return goIn(id);
    if (have < h.price) return say([h.name.toUpperCase() + '\nfor sale: ' + cost + '. you have ' + window.MF.fmtJ(have) + '.\nloose joules turn up all over the city, every day.']);
    ask([h.name.toUpperCase() + '\nfor sale: ' + cost + '. it comes with a key and a bed.', 'buy it for ' + cost + '?'], function () {
      if (!window.MF.spend(s, h.price)) return;
      s.homes[id] = 1;
      wallet('-' + cost);
      if (api.save) api.save();
      say(['the key is yours.\n' + h.name + ', ' + h.where + '.']);
    });
  }
  function doorOf(id) {
    for (var i = 0; i < city.marks.length; i++) {
      var m = city.marks[i];
      if (m.home !== id && m.room !== id) continue;
      var y = m.y + m.h, mid = doorCols(m)[0];
      /* out the door, unless someone's standing there; then the nearest free spot along the front */
      for (var o = 0; o < m.w * 2; o++) {
        var x = mid + (o % 2 ? -((o + 1) >> 1) : o >> 1);
        if (x < m.x || x >= m.x + m.w || M.solid(city, x, y)) continue;
        if (cityNpcs.some(function (n) { return n.still && n.x === x && n.y === y; })) continue;
        return { x: x, y: y };
      }
      return { x: mid, y: y };
    }
    return { x: city.spawn.x, y: city.spawn.y };
  }
  /* a room you can be in: a public building, or an apartment you hold the key to */
  function canBeIn(id) { var r = id && M.room(id); return !!r && (!r.home || !!s.homes[r.home]); }
  /* public rooms have their own street channel; apartments are private */
  function lobbyRoom() { return inside ? (inside.place ? 'in-' + inside.id : '') : district >= 0 ? D[district].id : district === -2 ? 'vistadelsol' : ''; }
  function here() { return { x: me.x, y: me.y, d: me.dir, v: M.V, in: inside ? inside.id : undefined, sail: me.sail ? 1 : undefined }; }
  /* ── the iris: going through a door, the old place closes down to a
     circle on you, then the new one opens out from where you stand. the
     swap itself happens at once (so saves and the lobby never lag); this
     only covers it, from a snapshot of the last frame. no walking meanwhile ── */
  var WIPE_MS = 420, wipe = null, lastCam = [0, 0];
  function startWipe() {
    if (!canvas || !canvas.width) return;
    var snap = document.createElement('canvas'); snap.width = canvas.width; snap.height = canvas.height;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    wipe = { t0: performance.now(), snap: snap, ox: me.x * TS - lastCam[0] + 8, oy: me.y * TS - lastCam[1] + 8 };
  }
  function iris(x0, y0, r) {
    var W = VW * TS, Hh = VH * TS;
    ctx.fillStyle = '#05060b';
    for (var y = 0; y < Hh; y++) {
      var dy = y + 0.5 - y0, hw = r * r - dy * dy;
      if (hw <= 0) { ctx.fillRect(0, y, W, 1); continue; }
      hw = Math.round(Math.sqrt(hw));
      ctx.fillRect(0, y, Math.max(0, Math.round(x0) - hw), 1);
      ctx.fillRect(Math.round(x0) + hw, y, W, 1);
    }
  }
  function drawWipe(now) {
    if (!wipe) return;
    var e = now - wipe.t0, half = WIPE_MS / 2, R = Math.hypot(VW * TS, VH * TS);
    if (e >= WIPE_MS) { wipe = null; return; }
    if (e < half) {
      ctx.drawImage(wipe.snap, 0, 0);
      iris(wipe.ox, wipe.oy, R * Math.pow(1 - e / half, 1.6));
    } else iris(me.x * TS - lastCam[0] + 8, me.y * TS - lastCam[1] + 8, R * Math.pow((e - half) / half, 1.6));
  }
  function wiping(now) { return wipe && now - wipe.t0 < WIPE_MS; }

  function goIn(id, at) {
    var r = M.room(id);
    if (!r) return;
    startWipe();
    inside = { id: id, place: !!r.place };
    world = r; deco = decorate(r);
    npcs = r.npcs.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.hx = n.x; c.hy = n.y; c.moving = false; c.t = 0; c.step = 0; return c; });
    me.x = at ? at.x : r.spawn.x; me.y = at ? at.y : r.spawn.y; me.dir = at ? at.d || 'up' : r.spawn.dir;
    me.moving = false; held = {};
    /* an apartment is private: off the street's channel until they come back out */
    if (L) { L.setRoom(lobbyRoom()); L.moved(me.x, me.y, me.dir); }
    s.world = here();
    if (api.save) api.save();
    if (charging() && s.body.food < 95 && !talkBox) say(['you find a socket and plug in.\ncharging. stay a minute.']);
  }
  function goOut() {
    startWipe();
    var d = doorOf(inside.id);
    inside = null;
    world = city; deco = cityDeco; npcs = cityNpcs;
    me.x = d.x; me.y = d.y; me.dir = 'down'; me.moving = false;
    if (L) L.setRoom(lobbyRoom());
    if (L) L.moved(me.x, me.y, me.dir);
    s.world = here();
    if (api.save) api.save();
  }

  /* ── joules ──────────────────────────────────────────────────
     today's loose ones come from world.js; s.found remembers which were
     picked up, and starts over when the day does */
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function looseNow() {
    var day = today();
    if (!s.found || s.found.day !== day) s.found = { day: day, got: {} };
    if (!loose.day || loose.day !== day) { loose = M.loose(world, day); loose.day = day; }
    return loose.filter(function (j) { return !s.found.got[j.id]; });
  }
  var piles = [], STRAIN = { timber: 12, scrap: 10, fibre: 6, fruit: 4 };
  function pilesNow() {
    var day = today();
    if (!s.gathered || s.gathered.day !== day) s.gathered = { day: day, got: {} };
    if (!piles.day || piles.day !== day) { piles = M.nodes(city, day); piles.day = day; }
    return piles.filter(function (j) { return !s.gathered.got[j.id]; });
  }
  /* stepping on a pile starts its game (minigames.js); the pile is only
     used up once the game is played, so B walks away and leaves it */
  function gather() {
    var left = pilesNow();
    for (var i = 0; i < left.length; i++) {
      var p = left[i];
      if (p.x !== me.x || p.y !== me.y) continue;
      /* hauling is work: it costs stamina up front */
      var cost = STRAIN[p.kind] || 5;
      if (!window.MF.strain(s, cost)) return say(['you\'re spent. catch your breath first.\n(' + cost + ' stamina to work this pile)']);
      if (window.MFMini) return startMini(p);
      return collect(p, p.n, '');
    }
  }
  function collect(p, n, how) {
    var RS = (window.MFShops && window.MFShops.RES) || {};
    s.gathered.got[p.id] = 1;
    if (!s.res) s.res = {};
    s.res[p.kind] = (s.res[p.kind] || 0) + n;
    wallet((how ? how + ' ' : '') + '+' + n + ' ' + (RS[p.kind] ? RS[p.kind].name : p.kind));
    exp('gather', { perfect: how === 'PERFECT' });
    if (api && api.save) api.save();
  }

  /* ── the counter: general stores and pawn shops ────────────
     up/down picks a row, A buys or sells one, left/right switches buy and
     sell at a pawn shop, B leaves. rows can be tapped too */
  var counter = null, cPrev = {};
  function openCounter(id) {
    var st = window.MFShops.place(id);
    if (!st) return;
    counter = { id: id, tab: 'buy', sel: 0, msg: st.line };
    cPrev = { up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right, b: !!held.b };
    pressedA = false;
    $('wCounter').hidden = false;
    drawCounter();
  }
  function closeCounter() { counter = null; $('wCounter').hidden = true; }
  function counterRows() { return window.MFShops.storeRows(window.MF, s, counter.id, counter.tab); }
  function counterAct(i) {
    var rows = counterRows(), r = rows[i];
    if (!r) return;
    counter.sel = i;
    var t = window.MFShops.trade(window.MF, s, counter.id, counter.tab, r.key);
    if (t.ok && t.healed) {
      counter.msg = 'patched up. full health. try not to need this again.';
      wallet('-' + window.MF.fmtJ(t.price)); drawBody();
      if (api.save) api.save();
    } else if (t.ok && t.ate) {
      counter.msg = 'you have ' + t.name + '.' + (t.buff ? ' ' + t.buff + '!' : '');
      wallet('-' + window.MF.fmtJ(t.price));
      drawBody();
      if (api.save) api.save();
    } else if (t.ok && t.moved) {
      counter.msg = t.moved + ' ' + t.name + '.';
      drawBody();
      if (api.save) api.save();
    } else if (t.ok && t.cooked) {
      counter.msg = 'it sizzles. you have ' + t.name + '. (eat it from INV)';
      exp('cook', { kitchen: window.MFShops.place(counter.id).where === 'kitchen' });
      if (api.save) api.save();
    } else if (t.ok) {
      counter.msg = (counter.tab === 'buy' ? 'bought ' : 'sold ') + t.name + ' for ' + window.MF.fmtJ(t.price) + '.';
      wallet((counter.tab === 'buy' ? '-' : '+') + window.MF.fmtJ(t.price));
      if (counter.tab === 'sell') exp('sell', { price: t.price });
      if (api.save) api.save();
    } else counter.msg = t.why === 'not enough joules' ? 'not enough joules for that.' : t.why + '.';
    var left = counterRows().length;
    if (counter.sel >= left) counter.sel = Math.max(0, left - 1);
    drawCounter();
  }
  function tickCounter() {
    var st = window.MFShops.place(counter.id);
    function edge(k) { var e = !!held[k] && !cPrev[k]; cPrev[k] = !!held[k]; return e; }
    var up = edge('up'), down = edge('down'), lf = edge('left'), rt = edge('right'), b = edge('b'), a = pressedA;
    pressedA = false;
    if (b) return closeCounter();
    var n = counterRows().length;
    if (up && n) { counter.sel = (counter.sel + n - 1) % n; drawCounter(); }
    if (down && n) { counter.sel = (counter.sel + 1) % n; drawCounter(); }
    if ((lf || rt) && (st.kind === 'pawn' || st.kind === 'stash')) { counter.tab = counter.tab === 'buy' ? 'sell' : 'buy'; counter.sel = 0; drawCounter(); }
    if (a) counterAct(counter.sel);
  }
  function drawCounter() {
    var st = window.MFShops.place(counter.id), rows = counterRows(), list = $('wCounterList');
    $('wCounterT').textContent = st.name;
    $('wCounterTabs').hidden = st.kind !== 'pawn' && st.kind !== 'stash';
    $('wCounterTabs').children[0].textContent = st.kind === 'stash' ? 'TAKE' : 'BUY';
    $('wCounterTabs').children[1].textContent = st.kind === 'stash' ? 'STORE' : 'SELL';
    if (st.kind === 'stash') { var bx = window.MFShops.stashOf(s, st.where); counter.msg = counter.msg || st.line; $('wCounterT').textContent = st.name + ' · ' + window.MFShops.weighs(bx) + '/' + st.cap + 'kg · you ' + window.MFShops.carried(s) + '/' + window.MFShops.cap(s) + 'kg'; }
    [].forEach.call($('wCounterTabs').children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === counter.tab ? 'true' : 'false'); });
    list.innerHTML = '';
    rows.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'crow' + (i === counter.sel ? ' sel' : '') + (r.ok ? '' : ' no');
      b.textContent = r.label + (r.have ? ' (' + r.have + ')' : '');
      var pr = document.createElement('span'); pr.textContent = st.kind === 'cook' || st.kind === 'stash' ? '' : window.MF.fmtJ(r.price); b.appendChild(pr);
      b.addEventListener('click', function (e) { e.preventDefault(); counterAct(i); });
      list.appendChild(b);
    });
    if (!rows.length) { var p = document.createElement('p'); p.className = 'cnone'; p.textContent = counter.tab === 'sell' ? 'nothing they want. go gather something.' : 'sold out.'; list.appendChild(p); }
    $('wCounterM').textContent = counter.msg;
  }

  /* the sky's tint through the day, blended between these hours so it
     never snaps: violet before dawn, rose, a gold sunrise, plain day, a
     gold hour, violet dusk, then night's own dark takes over (night()) */
  var SKY = [
    [4.5, 20, 10, 40, 0.10], [5.5, 60, 24, 40, 0.18], [6.5, 255, 170, 90, 0.12], [8, 5, 6, 11, 0.04],
    [16, 5, 6, 11, 0.04], [17.3, 255, 150, 60, 0.14], [18.5, 48, 20, 60, 0.22], [20, 20, 10, 50, 0.18], [21.5, 4, 6, 24, 0.10]
  ];
  function skyTint(c) {
    var h = c.hour + c.minute / 60, a, b, f;
    for (var i = 0; i < SKY.length; i++) {
      a = SKY[i]; b = SKY[(i + 1) % SKY.length];
      var start = a[0], end = b[0] > start ? b[0] : b[0] + 24, hh = h < start ? h + 24 : h;
      if (hh >= start && hh < end) { f = (hh - start) / (end - start); break; }
    }
    f = f * f * (3 - 2 * f);
    var mix = function (j) { return a[j] + (b[j] - a[j]) * f; };
    return 'rgba(' + Math.round(mix(1)) + ',' + Math.round(mix(2)) + ',' + Math.round(mix(3)) + ',' + mix(4).toFixed(3) + ')';
  }
  /* shadows stretch when the sun is low: 1 at midday, nearly double at
     the ends of the day */
  function shadowLen(c) {
    var h = c.hour + c.minute / 60, k = Math.min(1, Math.abs(h - 12.5) / 6.5);
    return 1 + 0.8 * k * k;
  }

  /* ── hunger and thirst (engine.js drain): the hud, tired, fainting ── */
  var tired = false, bodyT = 0, fainting = 0, warned = false, winded = false, staT = 0;
  /* sprinting: B held, on foot, fed, not overloaded, not winded */
  function running() { return !!(held.b && me.moving && !me.sail && !tired && !winded && window.MFShops.load(s) <= 1); }
  function body(dt, now) {
    var MF = window.MF;
    if (!MF.drain || fainting) { if (fainting && now > fainting) wakeUp(); return; }
    var run = running(), sta = MF.exert(s, dt, run);
    if (sta <= 0) winded = true; else if (winded && sta >= MF.RUN_AGAIN) winded = false;
    if (now - staT > 100) { staT = now; drawSta(run); }
    torchTick(dt);
    if (charging()) s.body.food = Math.min(100, s.body.food + 100 * dt / CHARGE_SECS);
    var state = s.dev && s.dev.nohunger ? (MF.weak(s) ? 'weak' : '') : MF.drain(s, dt, run ? 1.5 : 1, tempNow());
    tired = state !== '';
    if (state === 'collapse') return faint(now, true);
    if (state === 'faint') return faint(now);
    if (tired && !warned && !talkBox && !mini && !counter && !table) { warned = true; say([MF.ibc(s) ? 'core at ' + Math.round(s.body.food) + '%. you\'re running on fumes.\ncharge at home, the hospital or the police. no running till then.' : s.body.drink < MF.WEAK ? 'your mouth is dust. you need a drink.\nno running till you find one.' : 'your stomach is eating itself.\nyou need food. no running till you eat.']); }
    if (!tired) warned = false;
    if (now - bodyT > 400) { bodyT = now; drawBody(); weekly(); }
  }
  /* the time and the weather where you stand */
  function novaNow() { return window.MF.clock(Date.now(), s.dev && s.dev.shift || 0); }
  function whereNow() {
    if (inside) return 'indoors';
    if (me.sail) return M.fishZone(world, me.x, me.y) === 'jormun' ? 'jormun' : 'bay';
    var di = world.dist[me.y * world.W + me.x];
    return di === -2 ? 'vistadelsol' : di >= 0 ? D[di].id : 'bay';
  }
  function tempNow() { return window.MF.temperature(novaNow(), whereNow()); }
  /* the hud keeps to the time, a dish's perk, stamina while you run, and a
     warning when something's low. the full picture is the phone's ID › VITALS */
  function drawBody() {
    var b = s.body, c = novaNow();
    $('wTime').textContent = c.text + ' · ' + WEATHER[weatherAt(c)].icon + ' ' + tempNow() + '°C';
    var left = jailLeft();
    $('wBuff').textContent = left ? '⛓ ' + mmss(left) : b.buff && b.buffT > 0 ? b.buff + ' ' + Math.ceil(b.buffT / 60) + 'm' : '';
    drawSiren();
    var al = alerts(), crit = al.some(function (a) { return a.crit; }), btn = $('wAlert');
    btn.hidden = !al.length;
    btn.textContent = '⚠ ' + al.map(function (a) { return a.name; }).join(' · ');
    btn.className = 'alert' + (crit ? ' crit' : '');
    btn.title = al.length ? 'running low: ' + al.map(function (a) { return a.name; }).join(', ') + '. open ID › VITALS' : '';
  }
  /* what's running low: low under a quarter (hunger and thirst: under WEAK),
     critical under a tenth */
  function alerts() {
    var MF = window.MF, SH = window.MFShops, b = s.body, out = [];
    function part(name, v, max, low, crit) { if (v < crit * max) out.push({ name: name, crit: true }); else if (v < low * max) out.push({ name: name, crit: false }); }
    part('HEALTH', MF.vital(s, 'hp'), MF.maxOf(s, 'hp'), 0.25, 0.1);
    if (MF.ibc(s)) part('CHARGE', b.food, 100, MF.WEAK / 100, 0.08);
    else { part('FOOD', b.food, 100, MF.WEAK / 100, 0.08); part('DRINK', b.drink, 100, MF.WEAK / 100, 0.08); }
    part('BRAINPOWER', MF.vital(s, 'int'), MF.maxOf(s, 'int'), 0.2, 0.08);
    var ld = SH.load(s);
    if (ld > 1) out.push({ name: 'LOAD', crit: ld > SH.FROZEN });
    if (torchLit && s.torch < 0.2 * SH.GEAR.flashlight.secs) out.push({ name: 'BATTERY', crit: s.torch < 0.08 * SH.GEAR.flashlight.secs });
    return out;
  }
  /* ── the dark past the city: districts are lit, the wilds and the water
     aren't. a flashlight comes on by itself out there at night and runs
     its battery down (shops.js GEAR); a bed charges it ── */
  var torchLit = false, darkSaid = 0;
  /* an IBC core charges inside your own place or a government building */
  var CHARGE_AT = { hospital: 1, ncpd: 1 }, CHARGE_SECS = 60;
  function charging() {
    if (!inside || !window.MF.ibc(s)) return false;
    var r = M.room(inside.id);
    return !!(CHARGE_AT[inside.id] || (r && r.home));
  }
  function wild() { return !inside && ['vistadelsol', 'bay', 'jormun'].indexOf(whereNow()) >= 0; }
  function torchTick(dt) {
    var dark = wild() && darkness(novaNow()) > 0.3, has = !!(s.items && s.items.flashlight);
    var was = torchLit;
    torchLit = dark && has && s.torch > 0;
    if (torchLit) s.torch = Math.max(0, s.torch - dt);
    if (was && !torchLit && dark && has && !talkBox) say(['your flashlight flickers and dies.\na night in bed will charge it.']);
    if (dark && !torchLit && !talkBox && !mini && !counter && Date.now() - darkSaid > 90000) {
      darkSaid = Date.now();
      say([has ? 'pitch black out here, and the flashlight\'s flat.\nstay close to the city lights.' : 'pitch black out here. you can barely see your hands.\na flashlight would help. the general stores sell them.']);
    }
  }
  /* the stamina bar: up while you run, and until it's full again */
  function drawSta(run) {
    var MF = window.MF, v = MF.vital(s, 'sta'), max = MF.maxOf(s, 'sta'), el = $('wSta');
    el.hidden = !run && v >= max;
    if (el.hidden) return;
    $('wStaBar').style.width = Math.round(100 * v / max) + '%';
    el.classList.toggle('winded', winded);
  }
  /* the treasury writes once a nova city week (shops.js treasury) */
  function weekly() {
    var c = novaNow(), r = window.MFShops.treasury(window.MF, s, Math.floor(c.day / 7), c.day);
    if (!r) return;
    if (r.paid) wallet('-' + window.MF.fmtJ(r.paid));
    if (api.save) api.save();
    $('wMail').hidden = false; $('wMail').classList.remove('on'); void $('wMail').offsetWidth; $('wMail').classList.add('on');
    setTimeout(function () { $('wMail').hidden = true; }, 5000);
  }
  var collapsed = false;
  function faint(now, hard) {
    collapsed = !!hard;
    if (!hard) window.MF.hurt(s, 25);
    if (mini) closeMini(); if (counter) closeCounter(); if (table && !(table.hand && !table.hand.done)) closeTable();
    talkBox = null; $('wTalk').hidden = true; me.moving = false; held = {};
    fainting = now + 1800;
    $('world').classList.add('fainted');
  }
  /* you come round in your own bed, or the hospital's (and it isn't free) */
  function wakeUp() {
    /* the law put you down: you come round cuffed (law.js caught) */
    if (lawDown) {
      lawDown = false; collapsed = false; fainting = 0;
      $('world').classList.remove('fainted');
      window.MF.revive(s);
      s.body.health = Math.max(s.body.health, 30);
      if (arrest()) { drawBody(); return; }
    }
    var MF = window.MF, home = collapsed ? '' : s.wake && s.homes[s.wake] ? s.wake : Object.keys(s.homes || {})[0], line;
    /* down on redrum: the street doc drags you in, not the city hospital */
    var doc = (inside ? M.ROOMS[inside.id] && M.ROOMS[inside.id].d === 'redrum' : whereNow() === 'redrum') && (inside ? cityNpcs : npcs).filter(function (n) { return n.id === 'street-doc'; })[0];
    fainting = 0;
    $('world').classList.remove('fainted');
    MF.revive(s);
    MF.rest(s); winded = false;
    me.sail = false;
    if (inside) goOut();
    var beat = lostLines();
    var cell = window.MFLaw && window.MFLaw.jailed(s, Date.now());
    if (cell) { var jw = cell.room === 'lockup' ? 'redrum' : 'city'; goIn(cell.room, { x: window.MFLaw.JAILS[jw].cell.x, y: window.MFLaw.JAILS[jw].cell.y, d: 'down' }); line = ['you come round on the cell floor.\nsomeone pushed a cup of water through the bars.']; home = cell.room; }
    else if (home) { goIn(home); line = ['you come round on your own floor.\nsomeone left a glass of water by the door. you don\'t ask who.']; }
    else {
      /* a collapse (health gone) costs more than a faint, and always ends here */
      var bill = collapsed ? Math.min(600, Math.floor(MF.joules(s) * 0.2)) : Math.min(300, Math.floor(MF.joules(s) * 0.1));
      MF.spend(s, bill);
      if (collapsed) s.body.health = Math.max(s.body.health, 50);
      if (doc) {
        /* beside the doc's table, on whichever side is free */
        var side = [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']].filter(function (o) {
          var x = doc.x + o[0], y = doc.y + o[1];
          return !M.solid(world, x, y) && !npcs.some(function (n) { return n.x === x && n.y === y; });
        })[0] || [0, 1, 'up'];
        me.x = doc.x + side[0]; me.y = doc.y + side[1]; me.dir = side[2]; me.moving = false; s.world = here();
      }
      else goIn('hospital');
      wallet(bill ? '-' + MF.fmtJ(bill) : '');
      if (doc) line = [collapsed ? 'you wake up on a folding table in an alley.\nsomeone stitched you up. the stitches are crooked.' : 'you wake up on a folding table in an alley.\nthe street doc is counting your joules.',
                       bill ? 'that\'s ' + MF.fmtJ(bill) + '. eat something.\nnext time, fall down somewhere cheaper.' : 'you had nothing. i did it anyway.\ndon\'t tell anyone.'];
      else line = [collapsed ? 'you wake up in nova city hospital, wired to three machines.\nthey stopped beeping at you an hour ago.' : 'you wake up in nova city hospital.\na medic is already writing the bill.',
              bill ? 'treatment: ' + MF.fmtJ(bill) + '. eat something. drink something.\nwe\'d rather not see you again tonight.' : 'no charge. you didn\'t have anything.\neat something. please.'];
      collapsed = false;
    }
    warned = false;
    if (api.save) api.save();
    drawBody();
    say(beat.concat(line), home ? '' : doc ? 'STREET DOC' : 'MEDIC');
  }

  /* ── the phone: a quick tap of B (holding B still runs) ─────
     home has the apps; in an app B goes back; on home B puts it away.
     MAP lifts it to fill the screen: up/down zoom, left/right switch view */
  var bTap = { at: 0, moved: false, busy: false };
  function bEdge(down) {
    if (down) { bTap = { at: Date.now(), moved: false, busy: !!(talkBox || mini || counter || table || fainting) }; return; }
    /* out on the street a long press is running; in the phone there is no
       running, so a press of any length is B (a finger on glass is slow) */
    if (!bTap.busy && !bTap.moved && (phone || Date.now() - bTap.at < 260) && active) phoneTap();
  }
  var phone = null, pPrev = {}, pDrawn = 0;
  var APPS = [['id', 'ID', '#ff9de2', '◉'], ['inv', 'INV', '#7cc8ff', '▦'], ['clock', 'CLOCK', '#ffe97c', '◷'], ['map', 'MAP', '#7cffb2', '⌖'], ['mail', 'MAIL', '#ff8a6b', '✉'], ['sys', 'SYS', '#b9a8ff', '⚙']];
  /* MAP: vista del sol (region.js draws it from the canon map) and the
     streets you walk, close up */
  var MAP_LAYERS = ['vista del sol', 'nova city'], ZOOM_MAX = [6, 16];
  function phoneTap() {
    if (!phone) { if (talkBox || mini || counter || table || fainting) return; openPhone(); return; }
    if (phone.app === 'inv' && phone.act >= 0) { phone.act = -1; drawPhone(); return; }
    if (phone.app === 'sys' && phone.sub) { phone.sub = ''; drawPhone(); return; }
    if (phone.app !== 'home') { phone.app = 'home'; $('wPhone').classList.remove('lifted'); drawPhone(); return; }
    closePhone();
  }
  function openPhone() {
    phone = { app: 'home', sel: 0, tab: 'id', isel: 0, layer: 1, zoom: [1, 3], c: [null, null] };
    pPrev = { up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right };
    pressedA = false; me.moving = me.moving; held.b = false;
    $('wPhone').hidden = false; $('wPhone').classList.remove('lifted');
    drawPhone();
  }
  /* the phone fills the screen for MAP and INV, and for any other app when
     you ask it to (⤢ in the bar, or M); that choice sticks on this device */
  var BIG_ALWAYS = { map: 1, inv: 1, sys: 1 };
  function bigPref() { try { return localStorage.getItem('exiled.t2d.bigphone') === '1'; } catch (e) { return false; } }
  function lift() { $('wPhone').classList.toggle('lifted', !!phone && phone.app !== 'home' && (BIG_ALWAYS[phone.app] || bigPref())); }
  function toggleBig() {
    if (!phone || phone.app === 'home' || BIG_ALWAYS[phone.app]) return;
    try { localStorage.setItem('exiled.t2d.bigphone', bigPref() ? '0' : '1'); } catch (e) {}
    lift(); drawPhone();
  }
  function closePhone() { shelveSave(); phone = null; $('wPhone').hidden = true; $('wPhone').classList.remove('lifted'); }
  function openApp(id) {
    phone.app = id; phone.sub = ''; phone.ssel = 0; phone.wipeAt = 0; phone.msel = 0; phone.open = -1; phone.isel = 0; phone.act = -1; phone.imsg = '';
    lift();
    drawPhone();
  }
  function tickPhone(now) {
    function edge(k) { var e = !!held[k] && !pPrev[k]; pPrev[k] = !!held[k]; return e; }
    var up = edge('up'), dn = edge('down'), lf = edge('left'), rt = edge('right'), a = pressedA;
    pressedA = false;
    if (phone.app === 'home') {
      var n = APPS.length;
      if (lf) phone.sel = (phone.sel + n - 1) % n;
      if (rt) phone.sel = (phone.sel + 1) % n;
      /* up and down a row of the grid */
      if (up) phone.sel = phone.sel - HOME_COLS >= 0 ? phone.sel - HOME_COLS : phone.sel;
      if (dn) phone.sel = Math.min(n - 1, phone.sel + HOME_COLS);
      if (up || dn || lf || rt) drawPhone();
      if (a) openApp(APPS[phone.sel][0]);
    } else if (phone.app === 'mail') {
      var box = (s.inbox || []).slice().reverse();
      if (phone.open >= 0) { scrollHeld(); if (a) { phone.open = -1; drawPhone(); } }
      else {
        if (up && box.length) { phone.msel = (phone.msel + box.length - 1) % box.length; drawPhone(); }
        if (dn && box.length) { phone.msel = (phone.msel + 1) % box.length; drawPhone(); }
        if (a && box[phone.msel]) { phone.open = phone.msel; box[phone.msel].read = true; if (api.save) api.save(); drawPhone(); }
      }
    } else if (phone.app === 'id') {
      tickId(up, dn, lf, rt, a);
    } else if (phone.app === 'inv') {
      tickInv(up, dn, lf, rt, a);
    } else if (phone.app === 'clock') {
      scrollHeld();
    } else if (phone.app === 'sys') {
      tickSys(up, dn, a);
    } else if (phone.app === 'map') {
      /* hold the arrows to pan; A zooms in */
      var px = (held.right ? 1 : 0) - (held.left ? 1 : 0), py = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (px || py) panMap(px * 9, py * 9);
      if (a) zoomMap(1.25);
      if (phone.layer === 1 && now - pDrawn > 500) { pDrawn = now; drawOverlay(); }
    }
    if (now - pDrawn > 1000 && phone.app !== 'map') { pDrawn = now; drawPhoneBar(); if (phone.app === 'clock' || (phone.app === 'id' && phone.tab === 'vitals')) drawPhone(); }
  }
  /* holding ▲ ▼ scrolls a screen that has nothing to pick on it */
  var HOME_COLS = 3;
  function scrollHeld() {
    var d = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (d) $('wPhoneScreen').scrollTop += d * 5;
  }
  function drawPhoneBar() {
    var c = novaNow();
    $('wPhoneBar').textContent = '';
    var l = document.createElement('span'); l.textContent = c.text; var r = document.createElement('span'); r.textContent = tempNow() + '°C · ' + window.MF.fmtJ(window.MF.joules(s));
    $('wPhoneBar').appendChild(l); $('wPhoneBar').appendChild(r);
    if (phone && phone.app !== 'home' && !BIG_ALWAYS[phone.app]) {
      var big = bigPref(), b = document.createElement('button'); b.type = 'button'; b.className = 'pbig'; b.id = 'wPhoneBig';
      b.textContent = big ? '⤡' : '⤢'; b.setAttribute('aria-label', big ? 'make the phone small' : 'make the phone big'); b.title = (big ? 'smaller' : 'bigger') + ' (M)';
      b.addEventListener('click', function (e) { e.preventDefault(); toggleBig(); });
      $('wPhoneBar').appendChild(b);
    }
  }
  var drawnAs = '';
  function drawPhone() {
    var scr = $('wPhoneScreen'), hint = $('wPhoneHint'), as = phone.app + '/' + phone.tab + '/' + phone.open, keep = scr.scrollTop;
    drawPhoneBar();
    shelveSave();
    scr.innerHTML = '';
    drawPhoneIn(scr, hint);
    /* the same screen redrawn keeps its scroll, unless a pick moved it */
    if (as === drawnAs && !scr.querySelector('.crow.sel, .icell.sel')) scr.scrollTop = keep;
    drawnAs = as;
  }
  function drawPhoneIn(scr, hint) {
    if (phone.app === 'home') {
      var grid = document.createElement('div'); grid.className = 'papps';
      APPS.forEach(function (ap, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'papp' + (i === phone.sel ? ' sel' : '');
        var ic = document.createElement('i'); ic.style.background = ap[2]; ic.textContent = ap[3]; b.appendChild(ic);
        var unread = ap[0] === 'mail' ? (s.inbox || []).filter(function (m) { return !m.read; }).length : 0;
        var lb = document.createElement('span'); lb.textContent = ap[1] + (unread ? ' (' + unread + ')' : ''); b.appendChild(lb);
        b.addEventListener('click', function (e) { e.preventDefault(); phone.sel = i; openApp(ap[0]); });
        grid.appendChild(b);
      });
      scr.appendChild(grid);
      hint.textContent = 'arrows pick · A open · tap B: put it away';
    } else if (phone.app === 'id') {
      drawId(scr);
      hint.textContent = '◀ ▶ tab' + (idRows().length ? ' · ▲ ▼ pick · A choose' : ' · ▲ ▼ scroll') + ' · tap B: back';
    } else if (phone.app === 'clock') {
      var c = novaNow(), box = document.createElement('div'); box.className = 'pclock';
      var fc = '';
      for (var h = 2; h <= 12; h += 2) { var fcl = window.MF.clock(Date.now(), (s.dev && s.dev.shift || 0) + h * 60); fc += '<span>' + ('0' + fcl.hour).slice(-2) + 'h<br>' + window.MF.temperature(fcl, whereNow()) + '°</span>'; }
      box.innerHTML = '<div class="big">' + c.text + '</div><div>nova city · day ' + c.day + ' · ' + c.phase + '</div><div>' + tempNow() + '°C ' + (inside ? 'indoors' : 'here') + '</div><div class="fc">' + fc + '</div>';
      scr.appendChild(box);
      hint.textContent = 'next 12 hours · ▲ ▼ scroll · tap B: back';
    } else if (phone.app === 'mail') {
      var mails = (s.inbox || []).slice().reverse(), list = document.createElement('div'); list.className = 'pmail';
      if (phone.open >= 0 && mails[phone.open]) {
        var m = mails[phone.open], art = document.createElement('div'); art.className = 'pletter';
        var hd = document.createElement('b'); hd.textContent = m.from + ' · day ' + m.day; art.appendChild(hd);
        var tt = document.createElement('div'); tt.className = 'pt'; tt.textContent = m.title; art.appendChild(tt);
        var bd = document.createElement('pre'); bd.textContent = m.body; art.appendChild(bd);
        list.appendChild(art);
        hint.textContent = '▲ ▼ scroll · A: back to the list · tap B: home';
      } else {
        if (!mails.length) { var e0 = document.createElement('p'); e0.textContent = 'no mail yet.'; list.appendChild(e0); }
        mails.forEach(function (m, i) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'crow' + (i === phone.msel ? ' sel' : '') + (m.read ? '' : ' unread');
          b.textContent = (m.read ? '' : '● ') + m.title;
          b.addEventListener('click', function (ev) { ev.preventDefault(); phone.msel = i; phone.open = i; m.read = true; if (api.save) api.save(); drawPhone(); });
          list.appendChild(b);
        });
        hint.textContent = '▲ ▼ pick · A read · tap B: home';
      }
      scr.appendChild(list);
    } else if (phone.app === 'inv') {
      drawInv(scr);
      hint.textContent = phone.act >= 0 ? '◀ ▶ pick · A do it · tap B: back' : 'arrows pick · A use · tap B: home';
    } else if (phone.app === 'sys') {
      drawSys(scr);
      hint.textContent = phone.sub ? 'tap B: back to SYS' : '▲ ▼ pick · A choose · tap B: home';
    } else if (phone.app === 'map') drawMap();
  }
  /* ── SYS: the phone's settings. SAVE is the backup screen ui.js owns: it
     is lent to the phone while open and put back on its shelf after, so
     ui.js can always find its parts. LOOK AHEAD and STREETS are this
     device's choices; WIPE asks twice ── */
  function lookPref() { try { return localStorage.getItem('exiled.t2d.lookahead') !== '0'; } catch (e) { return true; } }
  var lookAhead = lookPref();
  function sysRows() {
    var armed = Date.now() - (phone.wipeAt || 0) < 4000;
    return [
      { id: 'save', label: 'SAVE', note: 'back up your run, or bring one back' },
      { id: 'look', label: 'LOOK AHEAD', val: lookAhead ? 'ON' : 'OFF', note: 'the view leans the way you walk, so you see what is coming' },
      { id: 'online', label: 'STREETS', val: offline() ? 'OFFLINE' : 'ONLINE', note: offline() ? 'nobody sees you, you see nobody' : 'players walking nova city see you and you see them: handle, look, where you stand. nothing else leaves this browser' },
      { id: 'wipe', label: armed ? 'PRESS A AGAIN TO WIPE' : 'WIPE THIS RUN', note: 'gone for good, unless you backed it up', danger: true }
    ];
  }
  function sysDo(id) {
    if (id === 'save') { phone.sub = 'save'; drawPhone(); if (window.MFUI) window.MFUI.fillSave(); return; }
    if (id === 'look') { lookAhead = !lookAhead; try { localStorage.setItem('exiled.t2d.lookahead', lookAhead ? '1' : '0'); } catch (e) {} }
    else if (id === 'online') setOffline(!offline());
    else if (id === 'wipe') {
      if (Date.now() - (phone.wipeAt || 0) > 4000) phone.wipeAt = Date.now();
      else { closePhone(); if (window.MFUI) window.MFUI.wipe(); return; }
    }
    drawPhone();
  }
  function tickSys(up, dn, a) {
    if (phone.sub) { scrollHeld(); return; }
    var n = sysRows().length;
    if (up) { phone.ssel = (phone.ssel + n - 1) % n; drawPhone(); }
    if (dn) { phone.ssel = (phone.ssel + 1) % n; drawPhone(); }
    if (a) sysDo(sysRows()[phone.ssel].id);
    /* an armed wipe cools off on its own */
    if (phone.wipeAt && Date.now() - phone.wipeAt > 4000) { phone.wipeAt = 0; drawPhone(); }
  }
  function shelveSave() {
    var sv = $('sysSave');
    if (sv && sv.parentNode !== $('sysShelf')) $('sysShelf').appendChild(sv);
  }
  function drawSys(scr) {
    var box = document.createElement('div'); box.className = 'psys';
    if (phone.sub === 'save') { box.appendChild($('sysSave')); scr.appendChild(box); return; }
    sysRows().forEach(function (row, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'crow' + (i === phone.ssel ? ' sel' : '') + (row.danger ? ' danger' : '');
      b.textContent = row.label;
      if (row.val) { var v = document.createElement('span'); v.textContent = row.val; b.appendChild(v); }
      var sm = document.createElement('small'); sm.textContent = row.note; b.appendChild(sm);
      b.addEventListener('click', function (e) { e.preventDefault(); phone.ssel = i; sysDo(row.id); });
      box.appendChild(b);
    });
    scr.appendChild(box);
  }
  /* ── the INV app: what you carry, as icons. the safe slots up top (a
     mugging leaves those alone: MF.toggleSafe), then everything else, then
     your keys and the boat. it lifts to fill the screen like MAP. arrows
     pick, A opens what you can do with it, B backs out ── */
  function invEntries() {
    var MF = window.MF, SH = window.MFShops, safe = MF.safeKeys(s), out = [], seen = {};
    safe.forEach(function (k) { seen[k] = 1; out.push({ key: k, safe: true }); });
    Object.keys(s.items || {}).concat(Object.keys(s.res || {})).forEach(function (k) {
      if (!seen[k] && ((s.items || {})[k] > 0 || (s.res || {})[k] > 0)) { seen[k] = 1; out.push({ key: k }); }
    });
    Object.keys(s.homes || {}).forEach(function (k) { if (SH.HOMES[k]) out.push({ key: '@key', home: k }); });
    if (s.boat) out.push({ key: '@boat' });
    return out;
  }
  function invInfo(e) {
    var MF = window.MF, SH = window.MFShops, k = e.key;
    if (e.home) { var h = SH.HOMES[e.home]; return { name: 'key: ' + h.name, what: h.where + (s.wake === e.home ? '. you wake up here.' : '.'), acts: [] }; }
    if (k === '@boat') return { name: 'a boat', what: 'moored wherever you left the water. face the sea and press A to sail.', acts: [] };
    var g = SH.goods(k), n = ((s.items || {})[k] || 0) + ((s.res || {})[k] || 0), acts = [];
    var C = window.MFCombat, arm = C && C.isWeapon(k);
    var note = arm ? C.usesLeft(s, k) + '/' + C.WEAPONS[k].dur + ' uses left' + (C.wielded(s) === k ? ' · in hand' : '') : SH.TOOLS[k] ? SH.rodLeft(s, k) + '/' + SH.TOOLS[k].dur + ' uses left' : SH.GEAR[k] && SH.GEAR[k].secs ? 'battery ' + Math.round(100 * (s.torch || 0) / SH.GEAR[k].secs) + '%' : '';
    if (SH.FOODS[k]) acts.push([SH.FOODS[k].food ? 'EAT' : 'DRINK', function () { var r = SH.eat(MF, s, k); return r.ok ? 'down it goes.' : r.why; }]);
    if (arm) acts.push([C.wielded(s) === k ? 'UNEQUIP' : 'EQUIP', function () { var on = C.wielded(s) !== k, r = C.equip(s, on ? k : 'fists'); return !r.ok ? r.why : on ? 'in hand: ' + C.WEAPONS[k].name + '.' : 'back to your fists.'; }]);
    if (SH.MEDS[k]) acts.push(['USE', function () { var r = SH.useMed(MF, s, k); return r.ok ? 'patched up. health ' + Math.round(MF.vital(s, 'hp')) + '/' + MF.maxOf(s, 'hp') + '.' : r.why; }]);
    acts.push([MF.isSafe(s, k) ? 'TAKE OUT' : 'SAFE', function () { var r = MF.toggleSafe(s, k); return !r.ok ? r.why : r.safe ? 'locked in a safe slot. muggers can\'t touch it.' : 'out of the safe slot.'; }]);
    acts.push(['DROP', function () { return SH.drop(s, k) ? 'dropped one.' : 'nothing to drop.'; }]);
    return { name: g ? g.name : k, n: n, what: g ? g.what : '', note: note, kg: SH.weightOf(k), acts: acts };
  }
  function runInv(e, i) {
    var act = invInfo(e).acts[i];
    if (!act) return;
    phone.imsg = act[1]();
    if (api.save) api.save();
    refresh();
    /* the pick follows the thing (into or out of the safe row); if it's all
       gone, it stays where it was */
    var es = invEntries(), at = -1;
    es.forEach(function (x, i) { if (at < 0 && x.key === e.key && x.home === e.home) at = i; });
    if (at >= 0) { phone.isel = at; phone.act = Math.min(phone.act, invInfo(es[at]).acts.length - 1); }
    else { phone.isel = Math.max(0, Math.min(phone.isel, es.length - 1)); phone.act = -1; }
    drawPhone();
  }
  /* arrows move to the nearest icon that way (the grid wraps with the screen) */
  function invStep(dx, dy) {
    var cells = phone.cells || [], me0 = cells[phone.isel], best = -1, bd = 1e9;
    if (!me0) return;
    cells.forEach(function (c, i) {
      if (i === phone.isel) return;
      var ox = c.x - me0.x, oy = c.y - me0.y;
      if (dy ? oy * dy <= 4 : (Math.abs(oy) > 4 || ox * dx <= 0)) return;
      var d = dy ? Math.abs(oy) * 4 + Math.abs(ox) : Math.abs(ox);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { phone.isel = best; phone.imsg = ''; }
  }
  function tickInv(up, dn, lf, rt, a) {
    var es = invEntries();
    if (phone.act >= 0) {
      var acts = es[phone.isel] ? invInfo(es[phone.isel]).acts : [];
      if (!acts.length) { phone.act = -1; drawPhone(); return; }
      if (lf || up) { phone.act = (phone.act + acts.length - 1) % acts.length; drawPhone(); }
      if (rt || dn) { phone.act = (phone.act + 1) % acts.length; drawPhone(); }
      if (a) runInv(es[phone.isel], phone.act);
      return;
    }
    if (lf || rt || up || dn) { invStep(lf ? -1 : rt ? 1 : 0, up ? -1 : dn ? 1 : 0); drawPhone(); }
    if (a && es[phone.isel] && invInfo(es[phone.isel]).acts.length) { phone.act = 0; drawPhone(); }
  }
  function drawInv(scr) {
    var MF = window.MF, SH = window.MFShops, I = window.MFIcons, es = invEntries(), box = document.createElement('div'); box.className = 'pinv';
    if (phone.isel >= es.length) phone.isel = Math.max(0, es.length - 1);
    var top = document.createElement('div'); top.className = 'itop';
    var C = window.MFCombat, inHand = C ? C.wielded(s) : 'fists';
    top.textContent = MF.fmtJ(MF.joules(s)) + ' · ✊ ' + (inHand === 'fists' ? 'fists' : C.WEAPONS[inHand].name.replace(/^an? /, '')) + ' · 🎒 ' + SH.carried(s) + ' / ' + SH.cap(s) + 'kg' + (SH.load(s) > SH.FROZEN ? ' · too heavy to move' : SH.load(s) > 1 ? ' · overloaded' : '');
    box.appendChild(top);
    var cellsEl = [];
    function cell(e, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'icell' + (i === phone.isel ? ' sel' : '');
      b.appendChild(I.canvas(e.key, 36, SH));
      var n = ((s.items || {})[e.key] || 0) + ((s.res || {})[e.key] || 0);
      if (n > 1) { var c = document.createElement('b'); c.textContent = n; b.appendChild(c); }
      if (C && C.wielded(s) === e.key) { b.classList.add('held'); var hd = document.createElement('i'); hd.textContent = '✊'; b.appendChild(hd); }
      b.setAttribute('aria-label', invInfo(e).name);
      /* tap once to look, tap again for what you can do */
      b.addEventListener('click', function (ev) { ev.preventDefault(); phone.act = phone.isel === i && invInfo(e).acts.length ? 0 : -1; phone.isel = i; phone.imsg = ''; drawPhone(); });
      cellsEl[i] = b;
      return b;
    }
    var lab = document.createElement('div'); lab.className = 'ilab'; lab.textContent = '🔒 SAFE · a mugging leaves these alone'; box.appendChild(lab);
    var safeRow = document.createElement('div'); safeRow.className = 'igrid isafe';
    var nsafe = 0;
    for (var j = 0; j < MF.SAFE_SLOTS; j++) {
      if (es[j] && es[j].safe) { safeRow.appendChild(cell(es[j], j)); nsafe++; }
      else { var em = document.createElement('span'); em.className = 'icell empty'; safeRow.appendChild(em); }
    }
    box.appendChild(safeRow);
    var lab2 = document.createElement('div'); lab2.className = 'ilab'; lab2.textContent = 'CARRYING'; box.appendChild(lab2);
    var grid = document.createElement('div'); grid.className = 'igrid';
    for (j = nsafe; j < es.length; j++) grid.appendChild(cell(es[j], j));
    if (es.length === nsafe) { var none = document.createElement('p'); none.className = 'inone'; none.textContent = nsafe ? 'nothing else.' : 'nothing yet.'; grid.appendChild(none); }
    box.appendChild(grid);
    var e = es[phone.isel];
    if (e) {
      var inf = invInfo(e), det = document.createElement('div'); det.className = 'idet';
      var nm = document.createElement('b'); nm.textContent = inf.name + (inf.n > 1 ? ' x' + inf.n : '') + (e.safe ? ' 🔒' : ''); det.appendChild(nm);
      if (inf.note || inf.kg) { var nt = document.createElement('div'); nt.className = 'inote'; nt.textContent = [inf.note, inf.kg ? inf.kg + 'kg each' : ''].filter(Boolean).join(' · '); det.appendChild(nt); }
      if (inf.what) { var wh = document.createElement('div'); wh.textContent = inf.what; det.appendChild(wh); }
      var row = document.createElement('div'); row.className = 'iacts';
      inf.acts.forEach(function (ac, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'iact' + (i === phone.act ? ' sel' : ''); b.textContent = ac[0];
        b.addEventListener('click', function (ev) { ev.preventDefault(); phone.act = i; runInv(e, i); });
        row.appendChild(b);
      });
      if (inf.acts.length) det.appendChild(row);
      box.appendChild(det);
    }
    if (phone.imsg) { var mg = document.createElement('div'); mg.className = 'imsg'; mg.textContent = phone.imsg; box.appendChild(mg); }
    if (me.sail) {
      var hb = document.createElement('button'); hb.type = 'button'; hb.className = 'iact'; hb.textContent = 'BOAT HOLD';
      hb.addEventListener('click', function (ev) { ev.preventDefault(); closePhone(); openHold(); });
      box.appendChild(hb);
    }
    if (SH.FISH && Object.keys(s.fishlog || {}).length) { var fl = document.createElement('div'); fl.className = 'inote'; fl.textContent = 'fish log: ' + Object.keys(s.fishlog).length + ' of ' + Object.keys(SH.FISH).length + ' kinds'; box.appendChild(fl); }
    scr.appendChild(box);
    phone.cells = cellsEl.map(function (b) { return b ? { x: b.offsetLeft + b.offsetWidth / 2, y: b.offsetTop + b.offsetHeight / 2 } : { x: -1e6, y: -1e6 }; });
    var on = cellsEl[phone.isel];
    if (on && on.scrollIntoView && phone.act < 0) on.scrollIntoView({ block: 'nearest' });
  }

  /* ── the ID app: you, your level and level-up pick (ID), your vitals,
     your traits, and (DEV key only, for now) the perk trees.
     ◀ ▶ switch tab, ▲ ▼ pick, A choose; everything can be tapped too ── */
  function isDev() { try { return !!localStorage.getItem('exiled.owner'); } catch (e) { return false; } }
  function idTabs() { return isDev() ? ['id', 'vitals', 'traits', 'contacts', 'perks'] : ['id', 'vitals', 'traits', 'contacts']; }
  /* the rows A can act on in this tab: [label, run] */
  function idRows() {
    var LV = window.MFLevel, MF = window.MF, rows = [];
    if (!LV) return rows;
    if (phone.tab === 'id' && LV.picks(s) > 0) Object.keys(MF.CORE).forEach(function (k) {
      var c = MF.CORE[k];
      rows.push([c.icon + ' ' + c.name.toUpperCase() + '  ' + MF.maxOf(s, k) + ' → ' + (MF.maxOf(s, k) + MF.CORE_STEP), function () { if (LV.pickCore(MF, s, k)) { drawBody(); if (api.save) api.save(); } }]);
    });
    if (phone.tab === 'perks') Object.keys(LV.TRAITS).forEach(function (t) {
      LV.tree(t, true).forEach(function (id) {
        var p = LV.PERKS[id], why = LV.blocked(s, id);
        rows.push([(LV.has(s, id) ? '■ ' : why ? '□ ' : '▶ ') + LV.TRAITS[t].short + ' ' + p.name + ' · lv ' + p.need, function () { if (LV.take(s, id) && api.save) api.save(); }, p.what + (why && !LV.has(s, id) ? ' (' + why + ')' : ''), !why]);
      });
    });
    return rows;
  }
  function tickId(up, dn, lf, rt, a) {
    var tabs = idTabs(), i = Math.max(0, tabs.indexOf(phone.tab)), rows = idRows();
    if (lf || rt) { phone.tab = tabs[(i + (rt ? 1 : tabs.length - 1)) % tabs.length]; phone.isel = 0; drawPhone(); return; }
    if ((up || dn) && rows.length) { phone.isel = (phone.isel + (dn ? 1 : rows.length - 1)) % rows.length; drawPhone(); }
    if (!rows.length) scrollHeld();
    if (a && rows[phone.isel]) { rows[phone.isel][1](); phone.isel = Math.min(phone.isel, Math.max(0, idRows().length - 1)); drawPhone(); }
  }
  function drawId(scr) {
    var LV = window.MFLevel, MF = window.MF, box = document.createElement('div'); box.className = 'pid';
    var tabs = idTabs();
    if (tabs.indexOf(phone.tab) < 0) phone.tab = 'id';
    var head = document.createElement('div'); head.className = 'ptabs';
    tabs.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t.toUpperCase();
      if (t === phone.tab) b.className = 'on';
      b.addEventListener('click', function (e) { e.preventDefault(); phone.tab = t; phone.isel = 0; drawPhone(); });
      head.appendChild(b);
    });
    box.appendChild(head);
    function line(cls, text) { var d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; box.appendChild(d); return d; }
    function bar(frac, cls) { var b = document.createElement('span'); b.className = 'xbar' + (cls ? ' ' + cls : ''); var f = document.createElement('i'); f.style.width = Math.max(0, Math.min(100, Math.round(100 * frac))) + '%'; b.appendChild(f); box.appendChild(b); }
    function gauge(icon, name, v, max, cls) {
      var r = document.createElement('div'); r.className = 'vrow';
      var n = document.createElement('span'); n.textContent = icon + ' ' + name; r.appendChild(n);
      var q = document.createElement('b'); q.textContent = Math.round(v) + '/' + max; r.appendChild(q);
      box.appendChild(r); bar(v / max, cls);
    }
    function rows() {
      idRows().forEach(function (r, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'crow' + (i === phone.isel ? ' sel' : '') + (r[3] === false ? ' dim' : '');
        b.textContent = r[0];
        if (r[2]) { var w = document.createElement('small'); w.textContent = r[2]; b.appendChild(w); }
        b.addEventListener('click', function (e) { e.preventDefault(); phone.isel = i; r[1](); drawPhone(); });
        box.appendChild(b);
      });
    }
    if (!LV) { line('who', s.player.handle || 'stranger'); scr.appendChild(box); return; }
    if (phone.tab === 'id') {
      var i = LV.info(s), pk = LV.picks(s), pts = LV.points(s);
      line('who', (s.player.handle || 'stranger') + (s.player.origin ? ' · ' + s.player.origin + (s.player.power ? ' (' + s.player.power.toUpperCase() + ')' : '') + (s.player.side ? ' (' + window.MF.SIDE[s.player.side].name + ')' : '') : ''));
      line('lv', 'LVL ' + i.level);
      bar(i.need ? i.into / i.need : 1);
      line('', i.need ? i.into + ' / ' + i.need + ' EXP to LVL ' + (i.level + 1) : 'max level');
      if (pk) { line('up', 'LEVEL UP! raise one' + (pk > 1 ? ' (' + pk + ' to pick)' : '') + ':'); rows(); }
      line('pts', 'perk points: ' + pts + (pts && !isDev() ? ' · the trees open soon' : ''));
    } else if (phone.tab === 'vitals') {
      var b = s.body, SH = window.MFShops;
      Object.keys(MF.CORE).forEach(function (k) { var c = MF.CORE[k]; gauge(c.icon, c.pool, MF.vital(s, k), MF.maxOf(s, k), k); });
      if (MF.ibc(s)) gauge('🔋', 'charge' + (charging() ? ' · charging' : ''), b.food, 100, 'sta');
      else { gauge('🍞', 'food', b.food, 100, 'food'); gauge('💧', 'drink', b.drink, 100, 'drink'); }
      line('vrow', '🎒 load ' + SH.carried(s) + ' / ' + SH.cap(s) + 'kg');
      if (s.items && s.items.flashlight) line('vrow', '🔦 flashlight ' + Math.round(100 * s.torch / SH.GEAR.flashlight.secs) + '%' + (torchLit ? ' · on' : ''));
      if (b.buff && b.buffT > 0) line('buff', b.buff + ' · ' + Math.ceil(b.buffT / 60) + 'm left');
    } else if (phone.tab === 'traits') {
      Object.keys(LV.TRAITS).forEach(function (t) {
        var ti = LV.traitInfo(s, t), r = document.createElement('div'); r.className = 'vrow';
        var n = document.createElement('span'); n.textContent = LV.TRAITS[t].short + ' ' + LV.TRAITS[t].name; r.appendChild(n);
        var q = document.createElement('b'); q.textContent = 'lv ' + ti.level; r.appendChild(q);
        box.appendChild(r); bar(ti.need ? ti.into / ti.need : 1, 'trait');
      });
    } else if (phone.tab === 'contacts') {
      var who = (window.MF_DATA && window.MF_DATA.who) || {}, ks = Object.keys(s.met || {});
      if (!ks.length) line('', 'no one yet.');
      ks.forEach(function (k) { var r = document.createElement('div'); r.className = 'vrow'; var n = document.createElement('span'); n.textContent = who[k] || k; r.appendChild(n); var q = document.createElement('b'); q.textContent = 'since ' + s.met[k]; r.appendChild(q); box.appendChild(r); });
    } else if (phone.tab === 'perks') {
      line('pts', 'perk points: ' + LV.points(s) + ' · DEV: draft trees');
      rows();
    }
    scr.appendChild(box);
    var on = box.querySelector('.crow.sel');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  /* the hud's warning opens straight onto VITALS */
  function openVitals() {
    if (!phone) { if (talkBox || mini || counter || table || fainting) return; openPhone(); }
    phone.tab = 'vitals'; openApp('id');
  }
  /* ── the map app: three layers, each one draggable and zoomable ──
     drag / hold the arrows to pan, wheel / pinch / A / + to zoom in, - out,
     ◎ ME back to you. nova city zooms all the way to the street */
  function mapContent(layer) {
    var at = mapPos();
    if (layer === 1) return { w: city.W, h: city.H, here: [at.x + 0.5, at.y + 0.5] };
    var G = window.MFRegion;
    return { w: G.W, h: G.H, here: G.toPx(window.MFWorldMap.toMap(at.x + 0.5, at.y + 0.5)) };
  }
  function drawMap() {
    var scr = $('wPhoneScreen'), wrap = document.createElement('div'); wrap.className = 'pmap';
    var head = document.createElement('div'); head.className = 'lvl';
    var tabs = document.createElement('span'); tabs.className = 'zoom';
    MAP_LAYERS.forEach(function (name, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = name.toUpperCase();
      if (i === phone.layer) b.className = 'on';
      b.addEventListener('click', function (e) { e.preventDefault(); setLayer(i); });
      tabs.appendChild(b);
    });
    var zoom = document.createElement('span'); zoom.className = 'zoom';
    [['−', function () { zoomMap(0.8); }], ['+', function () { zoomMap(1.25); }], ['◎ ME', function () { phone.c[phone.layer] = null; layoutMap(); }]].forEach(function (z) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = z[0];
      b.addEventListener('click', function (e) { e.preventDefault(); z[1](); });
      zoom.appendChild(b);
    });
    head.appendChild(tabs); head.appendChild(zoom); wrap.appendChild(head);
    var view = document.createElement('div'); view.className = 'view'; view.id = 'wMapView';
    var stage = document.createElement('div'); stage.className = 'stage'; stage.id = 'wMapStage'; view.appendChild(stage);
    wrap.appendChild(view);
    scr.appendChild(wrap);
    if (phone.layer === 1) {
      stage.appendChild(cityCanvas());
      var ov = document.createElement('canvas'); ov.id = 'wMapOverlay'; ov.width = city.W; ov.height = city.H; stage.appendChild(ov);
    } else {
      stage.appendChild(regionCanvas());
    }
    var dot = document.createElement('span'); dot.className = 'pin'; dot.id = 'wMapDot'; dot.appendChild(document.createElement('span')).className = 'here'; stage.appendChild(dot);
    mapGestures(view);
    layoutMap(); setTimeout(layoutMap, 300);
    if (phone.layer === 1) drawOverlay();
    $('wPhoneHint').textContent = 'drag or arrows: move · wheel, pinch, A or +: zoom · ◎ ME: you · tap B: back';
  }
  function setLayer(i) { phone.layer = i; drawPhone(); }
  /* place the stage: the content scaled to fit, times the zoom, centred on c */
  function layoutMap() {
    var view = $('wMapView'), stage = $('wMapStage'), L2 = phone && phone.layer, ct = view && mapContent(L2);
    if (!view || !stage || !ct) return;
    var r = view.getBoundingClientRect(), fit = Math.min(r.width / ct.w, r.height / ct.h), z = phone.zoom[L2], sc = fit * z;
    var c = phone.c[L2] || ct.here.slice();
    var tx = r.width / 2 - c[0] * sc, ty = r.height / 2 - c[1] * sc;
    /* keep the map on the screen */
    tx = ct.w * sc <= r.width ? (r.width - ct.w * sc) / 2 : Math.min(0, Math.max(r.width - ct.w * sc, tx));
    ty = ct.h * sc <= r.height ? (r.height - ct.h * sc) / 2 : Math.min(0, Math.max(r.height - ct.h * sc, ty));
    phone.c[L2] = [(r.width / 2 - tx) / sc, (r.height / 2 - ty) / sc];
    phone.scale = sc; phone.tx = tx; phone.ty = ty;
    stage.style.width = ct.w + 'px'; stage.style.height = ct.h + 'px';
    stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    var dot = $('wMapDot');
    dot.style.left = ct.here[0] + 'px'; dot.style.top = ct.here[1] + 'px';
    dot.style.transform = 'scale(' + (1 / sc) + ')';
  }
  function panMap(dx, dy) {
    var c = phone.c[phone.layer];
    if (!c || !phone.scale) return;
    phone.c[phone.layer] = [c[0] + dx / phone.scale, c[1] + dy / phone.scale];
    layoutMap();
  }
  /* zoom by f, keeping the point under (sx, sy) where it is (default: the middle) */
  function zoomMap(f, sx, sy) {
    var view = $('wMapView'), L2 = phone.layer;
    if (!view || !phone.scale) return;
    var r = view.getBoundingClientRect();
    if (sx === undefined) { sx = r.width / 2; sy = r.height / 2; }
    var px = (sx - phone.tx) / phone.scale, py = (sy - phone.ty) / phone.scale;
    var z = Math.max(1, Math.min(ZOOM_MAX[L2], phone.zoom[L2] * f));
    var s2 = phone.scale * z / phone.zoom[L2];
    phone.zoom[L2] = z;
    phone.c[L2] = [px + (r.width / 2 - sx) / s2, py + (r.height / 2 - sy) / s2];
    layoutMap();
  }
  /* drag with a mouse or a finger, pinch with two, the wheel zooms */
  function mapGestures(view) {
    var pts = {}, last = null;
    function pos(e) { var r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    view.addEventListener('pointerdown', function (e) { e.preventDefault(); try { view.setPointerCapture(e.pointerId); } catch (x) {} pts[e.pointerId] = pos(e); last = null; });
    view.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var p0 = pts[e.pointerId], p1 = pos(e), ids = Object.keys(pts);
      pts[e.pointerId] = p1;
      if (ids.length === 1) panMap(p0[0] - p1[0], p0[1] - p1[1]);
      else if (ids.length === 2) {
        var a2 = pts[ids[0]], b2 = pts[ids[1]], d = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
        if (last) zoomMap(d / last, (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2);
        last = d;
      }
    });
    function up(e) { delete pts[e.pointerId]; last = null; }
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', function (e) { e.preventDefault(); var p2 = pos(e); zoomMap(e.deltaY < 0 ? 1.15 : 1 / 1.15, p2[0], p2[1]); }, { passive: false });
  }
  /* + and -, 1 2 3 for the layers, while the map is open */
  document.addEventListener('keydown', function (e) {
    if (!phone || phone.app !== 'map') return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomMap(1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomMap(0.8); }
    else if (e.key === '1' || e.key === '2') { e.preventDefault(); setLayer(+e.key - 1); }
  });
  /* close in on the city: who's about (shopkeepers green, players violet) */
  function drawOverlay() {
    var ov = $('wMapOverlay');
    if (!ov) return;
    var g = ov.getContext('2d');
    g.clearRect(0, 0, ov.width, ov.height);
    if (phone.zoom[2] < 4 || inside) return;
    cityNpcs.forEach(function (n) { g.fillStyle = n.vend || n.store || n.shop || n.game ? '#7cffb2' : '#dce3ff'; g.fillRect(n.x, n.y, 1, 1); });
    if (L) L.list().forEach(function (o) { g.fillStyle = '#b9a8ff'; g.fillRect(o.x, o.y, 1, 1); });
    var at = mapPos(); $('wMapDot').style.left = (at.x + 0.5) + 'px'; $('wMapDot').style.top = (at.y + 0.5) + 'px';
  }
  function mapPos() { return inside ? doorOf(inside.id) : { x: me.x, y: me.y }; }
  function tileColour(w, k) {
    var t = w.tile[k], p = pal(w.dist[k]);
    return t === T.DEEP ? '#0a1834' : t === T.SHALLOW ? '#123563' : t === T.SAND ? '#76664a' : t === T.MAINLAND ? '#14301c' : t === T.BRIDGE ? '#5a4a70'
      : t === T.BUILDING ? p.roof2 : t === T.ROAD ? p.road : t === T.GRASS ? p.grass : t === T.TREE ? p.tree : t === T.LANDMARK ? '#ffd36a'
      : t === T.WALL ? p.wall : t === T.FLOOR || t === T.CHECK ? p.road : t === T.MAT ? '#7a2e54' : p.ground;
  }
  var cityCv = null, regionCv = null;
  /* drawn once, the first time it is opened (the font has loaded by then) */
  function regionCanvas() {
    if (!regionCv) { regionCv = document.createElement('canvas'); window.MFRegion.draw(regionCv); }
    var copy = document.createElement('canvas'); copy.width = regionCv.width; copy.height = regionCv.height; copy.getContext('2d').drawImage(regionCv, 0, 0);
    return copy;
  }
  function cityCanvas() {
    if (!cityCv) {
      cityCv = document.createElement('canvas'); cityCv.width = city.W; cityCv.height = city.H;
      var g = cityCv.getContext('2d'), img = g.createImageData(city.W, city.H);
      for (var k = 0; k < city.W * city.H; k++) {
        var c = parseInt(tileColour(city, k).slice(1), 16);
        img.data[k * 4] = c >> 16; img.data[k * 4 + 1] = (c >> 8) & 255; img.data[k * 4 + 2] = c & 255; img.data[k * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.font = 'bold 9px monospace'; g.textAlign = 'center';
      D.forEach(function (d) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(d.name, d.cx + 1, d.cy + 1); g.fillStyle = '#f4f6ff'; g.fillText(d.name, d.cx, d.cy); });
    }
    var copy = document.createElement('canvas'); copy.width = cityCv.width; copy.height = cityCv.height; copy.getContext('2d').drawImage(cityCv, 0, 0);
    return copy;
  }

  /* ── the tables: casino.js plays, this deals ──────────────
     left/right sets the stake, up/down picks a play, A plays it, B leaves
     (not in the middle of a blackjack hand). everything can be tapped */
  var table = null, tPrev = {};
  var SYM = { seven: '7', bolt: '⚡', knife: '†', ghost: '☺', bar: 'BAR', cherry: '♥' };
  var RBET = [['red', 'RED'], ['black', 'BLACK'], ['odd', 'ODD'], ['even', 'EVEN'], ['low', '1-18'], ['high', '19-36'], ['dozen1', '1-12'], ['dozen2', '13-24'], ['dozen3', '25-36'], ['zero', 'ZERO 35:1']];
  function openTable(game, house) {
    var C = window.MFCasino, h = C.HOUSES[house];
    table = { game: game, house: house, bet: h.min, sel: 0, msg: '', view: '', hand: null };
    tPrev = { up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right, b: !!held.b };
    pressedA = false;
    if (game === 'lotto') claimTickets();
    $('wTable').hidden = false;
    drawTable();
  }
  function closeTable() { table = null; $('wTable').hidden = true; }
  function tableActions() {
    var g = table.game;
    if (g === 'slots') return [['spin', 'SPIN']];
    if (g === 'dice') return [['high', 'HIGH (8-12)'], ['low', 'LOW (2-6)'], ['seven', 'SEVEN 4:1']];
    if (g === 'roulette') return RBET;
    if (g === 'lotto') return [['ticket', 'QUICK PICK ' + window.MF.fmtJ(window.MFCasino.HOUSES[table.house].ticket)]];
    if (table.hand && !table.hand.done) return [['hit', 'HIT'], ['stand', 'STAND']].concat(table.hand.player.length === 2 ? [['double', 'DOUBLE']] : []);
    return [['deal', 'DEAL']];
  }
  function stake() {
    var r = window.MFCasino.play(window.MF, s, table.house, table.bet);
    if (!r.ok) { table.msg = r.why + '.'; return false; }
    wallet('-' + window.MF.fmtJ(table.bet));
    return true;
  }
  function won(x, why) {
    var MF = window.MF, C = window.MFCasino, paid = C.payOut(MF, s, table.bet * x);
    table.msg = (paid > table.bet ? 'win! +' + MF.fmtJ(paid) : paid === table.bet ? 'stake back.' : paid ? 'a little back: ' + MF.fmtJ(paid) : 'no luck.') + (why ? ' ' + why : '');
    if (paid) wallet('+' + MF.fmtJ(paid));
  }
  function tablePlay(act) {
    var C = window.MFCasino, MF = window.MF, g = table.game;
    if (g === 'lotto') {
      var price = C.HOUSES[table.house].ticket;
      if (!MF.spend(s, price)) { table.msg = 'not enough joules.'; return drawTable(); }
      var nums = C.quickPick(Math.random);
      if (!s.lotto) s.lotto = [];
      s.lotto.push({ day: today(), nums: nums, house: table.house });
      wallet('-' + MF.fmtJ(price));
      table.msg = 'ticket ' + nums.join(' ') + '. drawn tomorrow. come back to collect.';
    } else if (g === 'blackjack') {
      if (act === 'deal') { if (!stake()) return drawTable(); table.hand = C.bj.deal(table.bet, Math.random); }
      else if (act === 'hit') C.bj.hit(table.hand);
      else if (act === 'stand') C.bj.stand(table.hand);
      else if (act === 'double') {
        if (!MF.spend(s, table.bet)) { table.msg = 'not enough to double.'; return drawTable(); }
        wallet('-' + MF.fmtJ(table.bet)); C.bj.double(table.hand);
      }
      if (table.hand.done) {
        var h = table.hand, paid = C.payOut(MF, s, h.paid);
        if (paid) wallet('+' + MF.fmtJ(paid));
        table.msg = h.result + (paid ? '. +' + MF.fmtJ(paid) : '.');
      } else table.msg = '';
      table.sel = 0;
    } else {
      if (!stake()) return drawTable();
      if (g === 'slots') { var line = C.slots(Math.random); table.view = line.map(function (x) { return '[' + SYM[x] + ']'; }).join(' '); won(C.pays(line)); }
      else if (g === 'dice') { var roll = C.dice(Math.random); table.view = 'rolled ' + roll[0] + ' + ' + roll[1] + ' = ' + (roll[0] + roll[1]); won(C.diceWin(act, roll)); }
      else if (g === 'roulette') {
        var n = C.roulette(Math.random);
        table.view = 'the ball lands on ' + n + ' ' + C.colour(n);
        won(act === 'zero' ? C.rouletteWin('number', n, 0) : C.rouletteWin(act, n));
      }
    }
    if (api.save) api.save();
    drawTable();
  }
  /* yesterday's tickets: drawn, paid, gone */
  function claimTickets() {
    var C = window.MFCasino, MF = window.MF, day = today(), keep = [], lines = [], total = 0;
    (s.lotto || []).forEach(function (t) {
      if (t.day >= day || t.house !== table.house) { keep.push(t); return; }
      var draw = C.lottoDraw(t.day), x = C.lottoWin(t.nums, draw), paid = x * C.HOUSES[t.house].ticket;
      total += paid;
      lines.push(t.nums.join('') + ' vs ' + draw.join('') + (paid ? ' +' + MF.fmtJ(paid) : ''));
    });
    s.lotto = keep;
    if (total) { MF.earn(s, total); wallet('+' + MF.fmtJ(total)); }
    table.msg = lines.length ? 'your tickets: ' + lines.join(', ') + '.' : 'draws happen at midnight. tickets pay out here the day after.';
    if (api.save) api.save();
  }
  function tickTable() {
    function edge(k) { var e = !!held[k] && !tPrev[k]; tPrev[k] = !!held[k]; return e; }
    var up = edge('up'), dn = edge('down'), lf = edge('left'), rt = edge('right'), b = edge('b'), a = pressedA;
    pressedA = false;
    var h = window.MFCasino.HOUSES[table.house], acts = tableActions(), step = table.house === 'grand' ? 100 : 5;
    if (b) { if (table.hand && !table.hand.done) { table.msg = 'finish the hand first.'; return drawTable(); } return closeTable(); }
    if (lf || rt) {
      if (!(table.hand && !table.hand.done)) { table.bet = Math.max(h.min, Math.min(h.max, table.bet + (rt ? step : -step))); drawTable(); }
    }
    if (up && acts.length) { table.sel = (table.sel + acts.length - 1) % acts.length; drawTable(); }
    if (dn && acts.length) { table.sel = (table.sel + 1) % acts.length; drawTable(); }
    if (a && acts[table.sel]) tablePlay(acts[table.sel][0]);
  }
  function drawTable() {
    var C = window.MFCasino, MF = window.MF, h = C.HOUSES[table.house], g = table.game, acts = tableActions();
    if (table.sel >= acts.length) table.sel = 0;
    $('wTableT').textContent = h.name + ' · ' + { slots: 'SLOTS', blackjack: 'BLACKJACK', roulette: 'ROULETTE', dice: 'HIGH-LOW DICE', lotto: 'LOTTERY' }[g];
    var view = table.view;
    if (g === 'blackjack' && table.hand) {
      var hd = table.hand, hide = !hd.done;
      view = 'dealer: ' + (hide ? hd.dealer[0] + ' ??' : hd.dealer.join(' ') + ' (' + C.bj.total(hd.dealer) + ')') + '\nyou:    ' + hd.player.join(' ') + ' (' + C.bj.total(hd.player) + ')';
    }
    if (g === 'lotto') view = 'today\'s tickets: ' + ((s.lotto || []).filter(function (t) { return t.day === today() && t.house === table.house; }).map(function (t) { return t.nums.join(''); }).join(', ') || 'none') + '\nthree right pays 250x. two pays 8x. one gets your money back.';
    $('wTableV').textContent = view || ' ';
    $('wTableBet').textContent = g === 'lotto' ? 'ticket ' + MF.fmtJ(h.ticket) : 'stake ' + MF.fmtJ(table.bet) + '  (' + MF.fmtJ(h.min) + '-' + MF.fmtJ(h.max) + ')';
    var list = $('wTableActs'); list.innerHTML = '';
    acts.forEach(function (ac, i) {
      var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'crow' + (i === table.sel ? ' sel' : ''); bt.textContent = ac[1];
      bt.addEventListener('click', function (e) { e.preventDefault(); table.sel = i; tablePlay(ac[0]); });
      list.appendChild(bt);
    });
    $('wTableM').textContent = table.msg;
  }
  function tableButtons() {
    $('wTableX').addEventListener('click', function () { if (table && !(table.hand && !table.hand.done)) closeTable(); });
    $('wTableLess').addEventListener('click', function () { if (!table || (table.hand && !table.hand.done)) return; var h = window.MFCasino.HOUSES[table.house]; table.bet = Math.max(h.min, table.bet - (table.house === 'grand' ? 100 : 5)); drawTable(); });
    $('wTableMore').addEventListener('click', function () { if (!table || (table.hand && !table.hand.done)) return; var h = window.MFCasino.HOUSES[table.house]; table.bet = Math.min(h.max, table.bet + (table.house === 'grand' ? 100 : 5)); drawTable(); });
  }

  /* ── the gathering games ─────────────────────────────────── */
  var mini = null, prevL = false, prevR = false, prevB = false;
  function startMini(p) {
    mini = { pile: p, g: window.MFMini.create(p.kind, null, tired ? { harder: 1.25 } : null), end: 0 };
    prevL = !!held.left; prevR = !!held.right; prevB = !!held.b; pressedA = false;
    $('wMini').hidden = false; $('wMini').className = 'wmini k-' + p.kind;
    $('wMiniT').textContent = mini.g.title;
    drawMini();
  }
  function closeMini() { mini = null; $('wMini').hidden = true; }
  function cast(tx, ty, rod) {
    var SH = window.MFShops, zone = M.fishZone(world, tx, ty), lvl = SH.TOOLS[rod].level;
    var id = SH.pickFish(zone, Math.random, lvl, new Date().getHours()), f = SH.FISH[id];
    mini = { fish: id, zone: zone, rod: rod, g: window.MFMini.create('fish', null, { hard: SH.TIER_HARD[f.tier] * (tired ? 1.2 : 1), ease: (lvl >= 2 ? 0.75 : lvl ? 0.85 : 1) * (window.MF.buff(s, 'steady line') ? 0.75 : 1) }), end: 0 };
    prevL = !!held.left; prevR = !!held.right; prevB = !!held.b; pressedA = false;
    $('wMini').hidden = false; $('wMini').className = 'wmini k-fish';
    $('wMiniT').textContent = 'FISH · ' + SH.ZONES[zone].name + ' · rod ' + SH.rodLeft(s, rod) + '/' + SH.TOOLS[rod].dur;
    drawMini();
  }
  function landFish(now) {
    var SH = window.MFShops, f = SH.FISH[mini.fish], g = mini.g, msg;
    if (g.score >= 1) {
      var first = !(s.fishlog || {})[mini.fish];
      s.items[mini.fish] = (s.items[mini.fish] || 0) + 1;
      if (!s.fishlog) s.fishlog = {};
      s.fishlog[mini.fish] = (s.fishlog[mini.fish] || 0) + 1;
      wallet('+1 ' + f.name.replace(/^(a|an) /, ''));
      exp('fish', { tier: f.tier });
      msg = (g.perfect ? 'clean catch! ' : 'caught ') + f.name + (f.tier === 'rare' || f.tier === 'legendary' ? ' (' + f.tier + '!)' : '') + (first ? ' · new' : '');
      if (api && api.save) api.save();
    } else msg = { spooked: 'too soon. it swam off.', missed: 'missed the bite.', snapped: 'the line snapped.' }[g.why] || 'it got away.';
    /* the rod takes it either way; worse when it goes wrong */
    var worn = SH.wearRod(s, mini.rod, g.score >= 1 ? 'caught' : g.why);
    if (worn.broke) { msg += ' and your rod snaps in half. it\'s gone.'; mini.end = now + 2400; }
    else if (worn.left <= 5) msg += ' (rod: ' + worn.left + (worn.left === 1 ? ' use' : ' uses') + ' left)';
    if (api && api.save) api.save();
    $('wMiniH').textContent = msg;
    mini.end = Math.max(mini.end, now + 1600);
  }
  function tickMini(dt, now) {
    var inp = { a: pressedA, hold: !!held.a, left: !!held.left && !prevL, right: !!held.right && !prevR }, b = !!held.b && !prevB;
    pressedA = false; prevL = !!held.left; prevR = !!held.right; prevB = !!held.b;
    if (mini.end) { if (now > mini.end) closeMini(); return; }
    if (b) { closeMini(); return; }
    window.MFMini.step(mini.g, dt, inp);
    drawMini();
    if (!mini.g.done) return;
    if (mini.fish) return landFish(now);
    var n = window.MFMini.amount(mini.pile.n, mini.g) + (window.MF.buff(s, 'sharp eye') ? 1 : 0);
    collect(mini.pile, n, mini.g.perfect ? 'PERFECT' : mini.g.score >= 1 ? 'NICE' : mini.g.score > 0.4 ? 'OK' : '');
    $('wMiniH').textContent = (mini.g.perfect ? 'perfect! ' : mini.g.score >= 1 ? 'nice. ' : mini.g.score > 0.4 ? 'not bad. ' : 'rough. ') + '+' + n;
    mini.end = now + 1100;
  }
  function drawMini() {
    var g = mini.g, zone = $('wMiniZone'), mark = $('wMiniMark'), track = $('wMiniTrack'), lanes = $('wMiniLanes');
    track.hidden = g.kind === 'fruit'; lanes.hidden = g.kind !== 'fruit';
    var hint = g.hint + '  ·  B: leave it';
    if (g.kind === 'fish') {
      /* the bar fills as you reel it in; the marker is the line's tension */
      zone.style.left = '0%'; zone.style.width = g.progress + '%';
      mark.hidden = g.phase !== 'reel'; mark.style.left = Math.min(100, g.tension) + '%';
      track.className = 'mtrack' + (g.tension > 70 ? ' taut' : '');
      if (!mini.end) $('wMiniH').textContent = (g.phase === 'reel' ? 'tension ' + Math.round(g.tension) + '  ·  ' : '') + g.hint + '  ·  B: walk away';
      return;
    }
    if (g.kind === 'timber') {
      zone.style.left = g.zone[0] + '%'; zone.style.width = (g.zone[1] - g.zone[0]) + '%';
      mark.hidden = false; mark.style.left = g.pos + '%';
      hint = 'swing ' + Math.min(g.swings + 1, g.of) + ' of ' + g.of + '  ·  ' + hint;
    } else if (g.kind === 'fibre') {
      zone.style.left = '0%'; zone.style.width = g.meter + '%'; mark.hidden = true;
      hint = Math.max(0, g.time).toFixed(1) + 's  ·  ' + hint;
    } else if (g.kind === 'scrap') {
      zone.style.left = g.zone[0] + '%'; zone.style.width = (g.zone[1] - g.zone[0]) + '%';
      mark.hidden = false; mark.style.left = Math.min(100, g.meter) + '%';
      hint = 'tries ' + g.tries + '  ·  ' + hint;
    } else {
      var html = '';
      g.drops.forEach(function (d) {
        if (d.done || d.y < 0) return;
        html += '<span class="fr" style="left:' + (d.lane * 33.3 + 12) + '%;top:' + d.y + '%"></span>';
      });
      html += '<span class="bk" style="left:' + (g.basket * 33.3 + 4) + '%"></span>';
      lanes.innerHTML = html;
      hint = g.caught + ' caught  ·  ' + hint;
    }
    if (!mini.end) $('wMiniH').textContent = hint;
  }
  var PILE = {
    timber: function (g, x, y) { px(g, OUT, x + 2, y + 7, 12, 7); px(g, '#8a5a32', x + 3, y + 8, 10, 2); px(g, '#6a4422', x + 3, y + 11, 10, 2); px(g, '#c8a878', x + 3, y + 8, 2, 2); px(g, '#c8a878', x + 3, y + 11, 2, 2); },
    fibre:  function (g, x, y) { px(g, OUT, x + 4, y + 4, 8, 11); px(g, '#c8b878', x + 5, y + 5, 6, 9); px(g, '#8a7a48', x + 5, y + 9, 6, 1); px(g, '#e8d898', x + 6, y + 5, 1, 4); },
    scrap:  function (g, x, y) { px(g, OUT, x + 3, y + 7, 10, 7); px(g, '#8a92a6', x + 4, y + 8, 4, 3); px(g, '#5a6070', x + 8, y + 9, 4, 4); px(g, '#c8ccd8', x + 5, y + 8, 1, 1); px(g, '#c4473a', x + 9, y + 10, 2, 1); },
    fruit:  function (g, x, y) { px(g, OUT, x + 4, y + 6, 8, 8); px(g, '#ff8a3a', x + 5, y + 7, 6, 6); px(g, '#ffd36a', x + 6, y + 8, 2, 2); px(g, '#3fd06a', x + 7, y + 4, 2, 3); }
  };
  function drawPiles(cx, cy, now) {
    pilesNow().forEach(function (p) {
      var sx = p.x * TS - cx, sy = p.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      (PILE[p.kind] || PILE.scrap)(ctx, sx, sy - (Math.floor(now / 500 + p.x) % 2));
    });
  }
  function pickUp() {
    gather();
    var left = looseNow();
    for (var i = 0; i < left.length; i++) {
      if (left[i].x !== me.x || left[i].y !== me.y) continue;
      s.found.got[left[i].id] = 1; window.MF.earn(s, left[i].n);
      wallet('+' + window.MF.fmtJ(left[i].n));
      if (api && api.save) api.save();
      return;
    }
  }
  function wallet(gain) {
    $('wJ').textContent = window.MF.fmtJ(window.MF.joules(s));
    if (!gain) return;
    var t = $('wJGain'); t.textContent = gain;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  }
  /* exp for one go at something (level.js SOURCES), shown under the purse:
     the trait it trained, or the level-up (picked in the phone's ID app) */
  function exp(source, d) {
    var LV = window.MFLevel;
    if (!LV) return null;
    var r = LV.award(s, source, d), t = $('wXPGain'), short = LV.TRAITS[r.trait].short;
    if (!r.xp) return r;
    t.textContent = r.up ? 'LEVEL ' + r.level + '! · phone › ID' : r.tup ? short + ' ' + r.tlevel + '!' : '+' + r.xp + ' ' + short;
    t.classList.toggle('up', r.up > 0 || r.tup > 0);
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    return r;
  }
  /* a dropped joule: a little bolt that winks */
  var BOLT = ['..YY', '.YY.', 'YYYY', '.YY.', 'YY..'];
  function drawLoose(cx, cy, now) {
    looseNow().forEach(function (j) {
      var sx = j.x * TS - cx, sy = j.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      var bob = Math.floor(now / 300 + j.x) % 2, lit = Math.floor(now / 150 + j.y) % 8 === 0;
      px(ctx, 'rgba(0,0,0,.35)', sx + 5, sy + 12, 6, 1);
      BOLT.forEach(function (r, y) {
        for (var x = 0; x < 4; x++) if (r.charAt(x) === 'Y') px(ctx, OUT, sx + 5 + x, sy + 4 + y - bob, 3, 3);
      });
      BOLT.forEach(function (r, y) {
        for (var x = 0; x < 4; x++) if (r.charAt(x) === 'Y') px(ctx, lit ? '#ffffff' : '#ffe97c', sx + 6 + x, sy + 5 + y - bob);
      });
    });
  }

  /* ── district cards ──────────────────────────────────────── */
  var VDS = { id: 'vistadelsol', name: 'VISTADELSOL', sub: 'the beaches and islands // past the shore' };
  function enterDistrict(di) {
    if ((di < 0 && di !== -2) || di === district) return;
    district = di;
    var d = di === -2 ? VDS : D[di], c = $('wCard');
    if (L) L.setRoom(d.id);
    $('wCardImg').hidden = di === -2;
    if (di !== -2) $('wCardImg').setAttribute('src', 'places/' + d.id + '.jpg');
    $('wCardImg').setAttribute('alt', d.name);
    $('wCardName').textContent = d.name; $('wCardSub').textContent = d.sub;
    c.hidden = false; c.classList.remove('out'); void c.offsetWidth; c.classList.add('in');
    card.until = performance.now() + 2600;
  }

  /* ── the loop ────────────────────────────────────────────── */
  var SPEED = 4.5;                                   /* tiles a second; B doubles it */
  var last = 0, npcTick = 0;
  var wakes = [], wakeAt = 0;
  function update(now) {
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (card.until && now > card.until) { $('wCard').classList.add('out'); card.until = 0; }
    body(dt, now);
    if (wiping(now)) { pressedA = false; return; }
    if (now < freezeUntil) return;
    if (fainting) return;
    /* a line that turns up while the phone is out (a nudge, a warning) is
       read first: the phone waits under it, or neither A nor B would reach it */
    if (phone && !talkBox) { tickPhone(now); return; }
    if (mini) { tickMini(dt, now); return; }
    if (counter) { tickCounter(); return; }
    if (table) { tickTable(); return; }
    if (talkBox && talkBox.yes && talkBox.lines.length === 1 && held.b) { held.b = false; answer(false); }
    if (talkBox && talkBox.menu) {
      if (held.b && !menuPrev.b) { held.b = false; pickMenu(talkBox.menu.length - 1); }
      else { tickMenu(); if (pressedA) { pressedA = false; pickMenu(talkBox.sel); } }
    }
    if (pressedA) {
      pressedA = false;
      if (talkBox && talkBox.yes && talkBox.lines.length === 1) answer(true);
      else if (talkBox) nextLine();
      else if (!me.moving && !attackTap(now)) interact();
    }
    if (L) { L.step(dt, SPEED); online(now); }
    /* the others finish any step they're in, even while you talk */
    npcs.forEach(function (n) { if (n.moving) { n.t += dt * SPEED * (n.run ? 1.3 : 0.55); if (n.t >= 1) { n.moving = false; n.t = 0; n.run = false; } } });
    if (talkBox) return;
    if (me.moving && me.sail && now - wakeAt > 70) {
      wakeAt = now;
      var wd = DIRS[me.dir];
      wakes.push({ x: (me.fx + (me.x - me.fx) * me.t) * TS + 8 - wd[0] * 7, y: (me.fy + (me.y - me.fy) * me.t) * TS + 10 - wd[1] * 6, d: wd, t0: now });
    }
    if (me.moving) {
      var heavy = !me.sail && window.MFShops.load(s) > 1;
      me.t += dt * SPEED * (me.sail ? 1.4 : heavy ? 0.25 : running() ? (window.MF.buff(s, 'fast feet') ? 2.5 : 2) : 1);
      if (me.t >= 1) {
        me.moving = false; me.t = 0;
        if (inside) {
          s.world = here();
          if (world.tile[me.y * world.W + me.x] === T.MAT) goOut();
        } else {
          enterDistrict(world.dist[me.y * world.W + me.x]);
          s.world = here();
          if (!me.sail) pickUp();
        }
      }
    }
    if (!me.moving) {
      var dir = held.up ? 'up' : held.down ? 'down' : held.left ? 'left' : held.right ? 'right' : '';
      if (dir) tryMove(dir);
    }
    tickTalk(now);
    tickLaw(dt, now);
    tickMobs(dt, now);
    tickScatter(now);
    /* the others wander a little, near where they stand */
    if (now - npcTick > 900) {
      npcTick = now;
      npcs.forEach(function (n) {
        if (n.still || n.moving || Math.random() < 0.6) return;
        var ks = Object.keys(DIRS), k = ks[Math.floor(Math.random() * 4)], d = DIRS[k];
        var nx = n.x + d[0], ny = n.y + d[1];
        n.dir = k;
        /* never further than roam from home, except on the way back (after running off) */
        var far = Math.max(Math.abs(nx - n.hx), Math.abs(ny - n.hy));
        if ((far > n.roam && far >= Math.max(Math.abs(n.x - n.hx), Math.abs(n.y - n.hy))) || occupied(nx, ny)) return;
        n.fx = n.x; n.fy = n.y; n.x = nx; n.y = ny; n.moving = true; n.t = 0; n.step ^= 1;
      });
    }
  }

  /* ── the street: foes that come for you (streets.js says who and when,
     combat.js does the maths). they turn up a few tiles off with a '!',
     walk you down and hit when they're next to you. double-tap A swings at
     whoever's next to you (it turns you to face them first). lose to a
     robber and you wake up with empty pockets, all but the safe slots ── */
  var mobs = [], spawnClock = -45, lastA = 0, swingFx = 0, hurtUntil = 0, floats = [], lostTo = null;
  /* the feel of a hit: a beat of freeze, a shake, sparks; a KO blinks out in a puff */
  var freezeUntil = 0, shake = { until: 0, amp: 0 }, sparks = [], downs = [];
  function jolt(ms, amp) { var t = performance.now(); if (t + ms > shake.until) { shake.until = t + ms; shake.amp = amp; } }
  var whites = new WeakMap();
  function whiteOf(img) {
    var c = whites.get(img);
    if (c) return c;
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    whites.set(img, c);
    return c;
  }
  function burst(x, y, n, cols, speed) {
    var t = performance.now();
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = speed * (0.6 + Math.random() * 0.6); sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: t, col: cols[i % cols.length] }); }
    if (sparks.length > 60) sparks.splice(0, sparks.length - 60);
  }
  var DOUBLE_TAP = 380, SWING_CD = 330, GIVE_UP = 14, SIDE_SWING = 0.35, wonAt = 0;
  var MOB_LOOK = {
    bandit:   { H: '#2a2a2a', S: '#b07a5a', C: '#5a4a3a', c: '#3a3020', P: '#2a2420', k: '#111', acc: 'glasses', A: '#14121c' },
    zombie:   { H: '#3a3a2a', S: '#7fa36a', C: '#4a4a3a', c: '#33332a', P: '#3a3020', k: '#111', E: '#ffe97c', m: '#5a2a2a' },
    skeleton: { H: '#e8e4d8', B: '#e8e4d8', S: '#e8e4d8', C: '#d8d4c8', c: '#b8b4a8', P: '#d8d4c8', k: '#111', hair: 'buzz' },
    rogueai:  { H: '#3a3f4a', S: '#8a92a6', C: '#2a2f3d', P: '#2a2f3d', k: '#111', E: '#ff3a4a', m: '#5a6378', hair: 'buzz' },
    vampire:  { H: '#14121c', S: '#e8e4f0', C: '#14121c', c: '#5a1020', P: '#14121c', k: '#000', E: '#ff3a4a', m: '#8a1a2a' },
    werewolf: { H: '#5a4632', B: '#5a4632', S: '#7a5e44', C: '#5a4632', P: '#4a3a2a', k: '#1a1410', E: '#ffe97c', fur: 1 },
    agent:    { H: '#14121c', S: '#e0b48a', C: '#e6e8f0', c: '#b8bcc8', P: '#14121c', k: '#000', hair: 'buzz', acc: 'glasses', A: '#111' },
    'law:npd':         { H: '#1a2a5a', S: '#c89a74', C: '#1f3a8a', c: '#16296a', P: '#14183a', k: '#000', hair: 'buzz', acc: 'glasses', A: '#0b0d1a' },
    'law:hashshashin': { H: '#0b0b10', B: '#0b0b10', S: '#a87a5a', C: '#14141c', c: '#7cffb2', P: '#0b0b10', k: '#000', E: '#7cffb2' }
  };
  /* gangs wear their colour; the troop and the revengers are apes */
  var APE_GANGS = { troop: 1, revengers: 1 };
  function mobLook(f, seed) {
    if (MOB_LOOK[f.id]) return MOB_LOOK[f.id];
    var base = f.sub === 'ape' || APE_GANGS[f.gang] ? crowdLook({ kind: 'ape', seed: seed }) : crowdLook({ seed: seed });
    var out = {}; for (var k in base) out[k] = base[k];
    if (f.colour) { out.C = f.colour; out.c = shade(f.colour, 0.7); }
    return out;
  }
  function mobAt(x, y) { for (var i = 0; i < mobs.length; i++) if (mobs[i].x === x && mobs[i].y === y) return mobs[i]; return null; }
  function zoneNow() { return window.MFStreets ? window.MFStreets.zone(world, me.x, me.y, inside, me.sail) : ''; }
  function float(x, y, text, col) { floats.push({ x: x, y: y, text: text, col: col || '#fff', t0: performance.now() }); if (floats.length > 12) floats.shift(); }
  function spawnFoe(zn, force) {
    var ST = window.MFStreets, C = window.MFCombat, LV = window.MFLevel, di = world.dist[me.y * world.W + me.x];
    var p = typeof force === 'string' ? { id: force, sub: '', level: 1 } : ST.pick({ s: s, MF: window.MF, A: A, zone: zn, district: di >= 0 ? D[di].id : '', dark: darkness(novaNow()), level: LV ? LV.level(s) : 1 }, Math.random);
    if (!p) return null;
    var f = C.foe(p.id, p.sub, p.level, Math.random, p.exact), seed = Math.floor(Math.random() * 1e9);
    for (var tries = 0; tries < 60; tries++) {
      var dx = Math.floor(Math.random() * 19) - 9, dy = Math.floor(Math.random() * 11) - 5, d = Math.abs(dx) + Math.abs(dy), x = me.x + dx, y = me.y + dy;
      if (d < 5 || d > 10 || x < 0 || y < 0 || x >= world.W || y >= world.H || occupied(x, y)) continue;
      if (ST.zone(world, x, y, inside, false) === '' || (zn === 'city') !== (world.dist[y * world.W + x] !== -2)) continue;
      var m = { f: f, x: x, y: y, fx: x, fy: y, t: 0, moving: false, dir: 'down', step: 0, cd: 1.2, hurt: 0, lunge: 0,
                speed: 2.2 + Math.min(2.5, f.ref * 0.12), look: mobLook(f, seed) };
      mobs.push(m);
      float(x * TS + 6, y * TS - 4, '!', '#ff4f5e');
      return m;
    }
    return null;
  }
  /* the foe next to you: the one you face, else any */
  function mobNear() {
    var d = DIRS[me.dir], m = mobAt(me.x + d[0], me.y + d[1]);
    if (m) return m;
    for (var k in DIRS) { m = mobAt(me.x + DIRS[k][0], me.y + DIRS[k][1]); if (m) return m; }
    return null;
  }
  function faceTo(dx, dy) { return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  /* A with a foe beside you: a double tap swings, a single one just squares up */
  function attackTap(now) {
    /* the second tap of the swing that won it doesn't go through their pockets */
    if (now - wonAt < DOUBLE_TAP) return true;
    var m = mobNear();
    if (!m) return civTap(now);
    me.dir = faceTo(m.x - me.x, m.y - me.y);
    if (now - lastA < DOUBLE_TAP) { lastA = 0; swingAt(m, now); } else lastA = now;
    return true;
  }
  function swingAt(m, now) {
    if (now < swingFx + SWING_CD) return;
    var C = window.MFCombat, LV = window.MFLevel, MF = window.MF, P = C.player(s, LV), r = C.strike(P, m.f), w = C.swing(s);
    swingFx = now;
    /* hit a passer-by who was busy with someone else: now it's you */
    m.foe = null;
    if (m.civ && !m.struck) { m.struck = true; crime('assault', m.x, m.y, m.civ); }
    if (m.law && !m.struck) { m.struck = true; crime('officer', m.x, m.y, null, true); }
    if (w.broke) float(me.x * TS + 2, me.y * TS - 12, C.WEAPONS[w.key].name.replace(/^an? /, '') + ' breaks!', '#ffb02e');
    if (!r.hit) { float(m.x * TS + 2, m.y * TS - 6, 'miss', '#9aa0b8'); return; }
    m.f.hp -= r.dmg; m.hurt = now + 220; m.cd = Math.max(m.cd, 0.35); m.flash = now + 70;
    freezeUntil = now + (r.crit ? 95 : 55);
    if (r.crit) jolt(140, 1);
    var hd = DIRS[me.dir];
    burst(me.x * TS + 8 + hd[0] * 10, me.y * TS + 7 + hd[1] * 10, r.crit ? 9 : 5, r.crit ? ['#ffe97c', '#fff3b0', '#ffffff'] : ['#ffffff', '#dce3ff'], r.crit ? 70 : 50);
    float(m.x * TS + 3, m.y * TS - 6, (r.crit ? 'CRIT ' : '') + r.dmg, r.crit ? '#ffe97c' : '#fff');
    if (m.f.hp <= 0) return beaten(m, w.key);
    /* knocked back a tile, if there's room */
    var kx = m.x + Math.sign(m.x - me.x), ky = m.y + Math.sign(m.y - me.y);
    if ((kx !== m.x) !== (ky !== m.y) && !occupied(kx, ky)) { m.fx = m.x; m.fy = m.y; m.x = kx; m.y = ky; m.moving = true; m.t = 0.5; }
  }
  function beaten(m, weapon) {
    var MF = window.MF;
    wonAt = performance.now();
    mobs = mobs.filter(function (o) { return o !== m; });
    if (m.civ) return civFalls(m, weapon);
    if (m.law) crime(window.MFLaw.fall(weapon, Math.random) === 'dead' ? 'murder' : 'officer', m.x, m.y, null, true);
    downs.push({ x: m.x * TS, y: m.y * TS, img: sprite(m.look, m.dir, 0), t0: performance.now() });
    freezeUntil = performance.now() + 120; jolt(180, 1);
    if (m.f.joules > 0) { MF.earn(s, m.f.joules); wallet('+' + MF.fmtJ(m.f.joules)); }
    exp('combat', { xp: m.f.xp });
    float(m.x * TS, m.y * TS - 8, m.f.name + ' down', '#7cffb2');
    if (api.save) api.save();
  }
  function mobHit(m, now) {
    var C = window.MFCombat, MF = window.MF, P = C.player(s, window.MFLevel), r = C.strike(m.f, { def: P.def, ref: P.ref, soak: P.soak });
    m.cd = 1.5 - Math.min(0.7, m.f.ref * 0.03); m.lunge = now + 150;
    if (!r.hit) { float(me.x * TS + 2, me.y * TS - 6, 'dodge', '#7cf5ff'); return false; }
    MF.hurt(s, r.dmg); hurtUntil = now + 260; jolt(220, 2); freezeUntil = now + 45;
    burst(me.x * TS + 8, me.y * TS + 8, 4, ['#ff4f5e', '#ffb0b8'], 40);
    if (m.f.drain) m.f.hp = Math.min(m.f.max, m.f.hp + Math.round(r.dmg * m.f.drain));
    float(me.x * TS + 3, me.y * TS - 6, '-' + r.dmg, '#ff4f5e');
    drawBody();
    if (s.body.health <= 0) { lose(m, now); return false; }
    return true;
  }
  function lose(m, now) {
    if (m.law) { lawDown = true; dropMobs(); floats = []; faint(now, true); return; }
    var took = m.f.robs ? window.MFCombat.rob(s, window.MF) : null;
    lostTo = { name: m.f.name, took: took, civ: !!m.civ };
    dropMobs(); floats = [];
    wallet();
    faint(now, true);
  }
  /* what you wake up to after a beating (wakeUp puts it first) */
  function lostLines() {
    var l = lostTo, MF = window.MF; lostTo = null;
    if (!l) return [];
    if (l.civ) return ['you picked the wrong fight.\nsomeone called it in before it got worse.'];
    if (!l.took) return ['a ' + l.name + ' left you for dead out there.\nwe got to you before anything else did.'];
    var n = 0; ['items', 'res'].forEach(function (b) { Object.keys(l.took[b]).forEach(function (k) { n += l.took[b][k]; }); });
    var kept = window.MF.safeKeys(s).length;
    return ['a ' + l.name + ' went through your pockets before we found you.\n' + (l.took.joules ? MF.fmtJ(l.took.joules) : 'not a joule') + (n ? ' and ' + n + ' thing' + (n > 1 ? 's' : '') : '') + ' gone.' + (kept ? ' the safe slots held.' : '')];
  }
  /* the first step of the shortest way round the walls to a tile next to
     you (or gx, gy), searched within CHASE tiles; null when there's no way */
  var CHASE = 16;
  function chaseStep(m, gx, gy) {
    if (gx === undefined) { gx = me.x; gy = me.y; }
    var span = CHASE * 2 + 1, ox = m.x - CHASE, oy = m.y - CHASE, from = new Int16Array(span * span).fill(-1);
    var start = CHASE * span + CHASE, q = [start], head = 0;
    from[start] = start;
    while (head < q.length) {
      var c = q[head++], cx = c % span, cy = (c / span) | 0, wx = cx + ox, wy = cy + oy;
      if (Math.abs(wx - gx) + Math.abs(wy - gy) === 1) {
        /* walk it back to the first step */
        while (from[c] !== start) c = from[c];
        if (c === start) return null;
        return [(c % span) - CHASE, ((c / span) | 0) - CHASE];
      }
      for (var k in DIRS) {
        var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (nx < 0 || ny < 0 || nx >= span || ny >= span) continue;
        var n = ny * span + nx;
        if (from[n] >= 0 || occupied(nx + ox, ny + oy)) continue;
        from[n] = c; q.push(n);
      }
    }
    return null;
  }
  function tickMobs(dt, now) {
    var zn = zoneNow();
    tickBodies(now);
    if (!zn) { dropMobs(); return; }
    if (!(s.dev && s.dev.peace) && window.MFStreets) {
      spawnClock += dt;
      if (spawnClock >= window.MFStreets.CHECK[zn]) {
        spawnClock = 0;
        var di = world.dist[me.y * world.W + me.x];
        if (window.MFStreets.roll(zn, di >= 0 ? D[di].id : '', darkness(novaNow()), mobs.length, Math.random)) spawnFoe(zn);
      }
    }
    mobs.forEach(function (m) {
      m.cd -= dt;
      if (m.moving) { m.t += dt * m.speed; if (m.t >= 1) { m.moving = false; m.t = 0; } return; }
      /* gone from the street mid-tick (an arrest clears it) */
      if (m.dead || mobs.indexOf(m) < 0) return;
      /* a passer-by squaring up to a hostile: once it's gone, so are they */
      var foe = m.foe;
      if (foe && (foe.dead || mobs.indexOf(foe) < 0)) { m.gone = true; return; }
      var gx = foe ? foe.x : me.x, gy = foe ? foe.y : me.y, dx = gx - m.x, dy = gy - m.y, d = Math.abs(dx) + Math.abs(dy);
      if (d > GIVE_UP) { m.gone = true; return; }
      /* a hostile goes for whoever it passes that it would: always on the way
         to you, now and then even with you right there (SIDE_SWING) */
      if (m.law) return lawMove(m, d, dx, dy, now);
      var v = !foe && !m.civ && m.cd <= 0 ? victimNear(m) : null;
      if (v && (d !== 1 || Math.random() < SIDE_SWING)) { m.dir = faceTo(v.x - m.x, v.y - m.y); return mobOn(m, v, now); }
      if (d === 1) { m.dir = faceTo(dx, dy); if (m.cd <= 0) { if (foe) brawl(m, foe, now); else mobHit(m, now); } return; }
      var o = chaseStep(m, gx, gy);
      if (o) { m.fx = m.x; m.fy = m.y; m.x += o[0]; m.y += o[1]; m.moving = true; m.t = 0; m.step ^= 1; m.dir = faceTo(o[0], o[1]); }
    });
    mobs.forEach(function (m) { if (m.gone && m.civ) backToCrowd(m); });
    mobs = mobs.filter(function (m) { return !m.gone; });
  }
  /* ── the crowd, when it comes to blows (law.js). double-tap A at a
     passer-by and they hit back. beaten, they lie there: knocked out, or
     dead if what you used could kill. A over them goes through their
     pockets. the knocked out get up; the dead are taken away, and in time
     someone new moves into the spot. a single A still just talks (it
     waits a beat for the second tap) ── */
  var bodies = [], gone = [], pendingTalk = null;
  function civTap(now) {
    var LAW = window.MFLaw, d = DIRS[me.dir], x = me.x + d[0], y = me.y + d[1];
    if (!LAW || inside || me.sail) return false;
    var n = npcs.filter(function (o) { return o.x === x && o.y === y; })[0];
    if (!n || !LAW.attackable(n)) return false;
    if (pendingTalk && pendingTalk.n === n && now - pendingTalk.at < DOUBLE_TAP) { pendingTalk = null; swingAt(provoke(n), now); return true; }
    pendingTalk = { n: n, at: now, x: me.x, y: me.y, dir: me.dir };
    return true;
  }
  /* no second tap: it was a hello after all */
  function tickTalk(now) {
    if (!pendingTalk || now - pendingTalk.at < DOUBLE_TAP) return;
    var p = pendingTalk; pendingTalk = null;
    if (!talkBox && !me.moving && me.x === p.x && me.y === p.y && me.dir === p.dir && npcs.indexOf(p.n) >= 0) interact();
  }
  /* a passer-by squares up: out of the crowd, into the fight */
  function provoke(n) {
    var LV = window.MFLevel, cap = Math.min(window.MFFoes.DANGER.city[1], (LV ? LV.level(s) : 1) + 1);
    cityNpcs.splice(cityNpcs.indexOf(n), 1);
    var f = n.f || window.MFLaw.civ(n, 1 + Math.floor(Math.random() * cap), Math.random);
    var m = { f: f, civ: n, x: n.x, y: n.y, fx: n.x, fy: n.y, t: 0, moving: false, dir: n.dir, step: 0, cd: 0.9, hurt: 0, lunge: 0,
              speed: 2.2 + Math.min(2.5, f.ref * 0.12), look: n.look === 'gen' ? crowdLook(n) : LOOKS[n.look] || LOOKS.local };
    mobs.push(m);
    return m;
  }
  /* ── a hostile and the street (law.js preys / brave): it hits the
     passers-by it would on its way to you. the brave hit back (a passer-by
     with a foe of their own), the rest run from it; if a passer-by goes
     down it's for good as often as the hostile kills (foes.js lethal) ── */
  function victimNear(m) {
    var LAW = window.MFLaw;
    for (var k in DIRS) {
      var x = m.x + DIRS[k][0], y = m.y + DIRS[k][1], c = mobAt(x, y);
      if (c && c.foe === m) return c;
      if (inside) continue;
      for (var i = 0; i < npcs.length; i++) { var n = npcs[i]; if (n.x === x && n.y === y && !n.moving && LAW.attackable(n) && LAW.preys(m.f, n)) return n; }
    }
    return null;
  }
  function civLevel() { var LV = window.MFLevel; return 1 + Math.floor(Math.random() * Math.min(window.MFFoes.DANGER.city[1], (LV ? LV.level(s) : 1) + 1)); }
  /* a hostile's blow at a passer-by: v is a crowd npc, or one already fighting it */
  function mobOn(m, v, now) {
    if (v.f && v.civ) return brawl(m, v, now);
    var LAW = window.MFLaw, C = window.MFCombat;
    if (!v.f) v.f = LAW.civ(v, civLevel(), Math.random);
    var r = C.strike(m.f, v.f);
    m.cd = 1.5 - Math.min(0.7, m.f.ref * 0.03); m.lunge = now + 150;
    if (!r.hit) { float(v.x * TS + 2, v.y * TS - 6, 'dodge', '#9aa0b8'); }
    else {
      v.f.hp -= r.dmg;
      burst(v.x * TS + 8, v.y * TS + 8, 4, ['#ff4f5e', '#ffb0b8'], 40);
      float(v.x * TS + 3, v.y * TS - 6, '-' + r.dmg, '#ffb0b8');
      if (v.f.hp <= 0) { cityNpcs.splice(cityNpcs.indexOf(v), 1); layBody(v, v.x, v.y, v.look === 'gen' ? crowdLook(v) : LOOKS[v.look] || LOOKS.local, LAW.dies(m.f.lethal, Math.random) === 'dead'); return; }
    }
    /* the brave square up; everyone else runs */
    if (LAW.brave(v)) { var c = provoke(v); c.foe = m; c.cd = 0.5; }
  }
  /* two fighters on the street that aren't you: a passer-by and a hostile */
  function brawl(a, b, now) {
    var LAW = window.MFLaw, C = window.MFCombat, r = C.strike(a.f, b.f);
    a.cd = 1.5 - Math.min(0.7, a.f.ref * 0.03); a.lunge = now + 150;
    if (!r.hit) { float(b.x * TS + 2, b.y * TS - 6, 'dodge', '#9aa0b8'); return; }
    b.f.hp -= r.dmg; b.hurt = now + 220; b.flash = now + 70;
    burst(b.x * TS + 8, b.y * TS + 8, 4, ['#ffffff', '#dce3ff'], 40);
    float(b.x * TS + 3, b.y * TS - 6, '-' + r.dmg, '#dce3ff');
    if (b.f.hp > 0) return;
    b.dead = true;
    mobs = mobs.filter(function (o) { return o !== b; });
    if (b.civ) { layBody(b.civ, b.x, b.y, b.look, LAW.dies(a.f.lethal, Math.random) === 'dead'); return; }
    /* a passer-by beat a hostile: it goes up in a puff, nobody's exp */
    downs.push({ x: b.x * TS, y: b.y * TS, img: sprite(b.look, b.dir, 0), t0: now });
    float(b.x * TS, b.y * TS - 8, b.f.name + ' down', '#7cffb2');
  }
  /* the ones a hostile would go for run from it; the brave hold their ground */
  var scatterAt = 0;
  function tickScatter(now) {
    var LAW = window.MFLaw;
    if (inside || !LAW || now - scatterAt < 260) return;
    scatterAt = now;
    var hostiles = mobs.filter(function (m) { return !m.civ && !m.dead; });
    if (!hostiles.length) return;
    npcs.forEach(function (n) {
      if (n.moving || LAW.brave(n) || !LAW.attackable(n)) return;
      var near = null, nd = 99;
      hostiles.forEach(function (m) { var d = Math.abs(m.x - n.x) + Math.abs(m.y - n.y); if (d < nd && LAW.preys(m.f, n)) { nd = d; near = m; } });
      if (!near || nd > LAW.FLEE) return;
      var best = null, bd = nd;
      for (var k in DIRS) {
        var nx = n.x + DIRS[k][0], ny = n.y + DIRS[k][1], d = Math.abs(near.x - nx) + Math.abs(near.y - ny);
        if (d > bd && !occupied(nx, ny)) { bd = d; best = k; }
      }
      if (!best) return;
      n.dir = best; n.fx = n.x; n.fy = n.y; n.x += DIRS[best][0]; n.y += DIRS[best][1]; n.moving = true; n.t = 0; n.step ^= 1; n.run = true;
    });
  }
  function layBody(n, x, y, look, dead) {
    var LAW = window.MFLaw;
    bodies.push({ n: n, x: x, y: y, dead: dead, at: performance.now(), pockets: LAW.pockets(n, Math.random), look: look });
    float(x * TS, y * TS - 8, (LAW.CIV[n.kind] || LAW.CIV.novan).name + (dead ? ' killed' : ' knocked out'), dead ? '#ff4f5e' : '#ffb02e');
  }
  /* ── the siren (law.js): a crime counts if anyone on the street saw it.
     out of the law's sight it winds down; caught, it's a fine at 1-2 and a
     cell at 3+ (the NCPD's, or on redrum the hashshashin's lockup) ── */
  function witnessed(x, y, victim) {
    var W = window.MFLaw.WITNESS, near = function (o) { return o !== victim && Math.abs(o.x - x) + Math.abs(o.y - y) <= W; };
    return cityNpcs.some(near) || mobs.some(function (m) { return m.civ && m.civ !== victim && near(m); });
  }
  function crime(kind, x, y, victim, sure) {
    var LAW = window.MFLaw, was = LAW.law(s).siren, seen = sure || witnessed(x, y, victim), now = LAW.commit(s, kind, seen);
    if (!seen) float(me.x * TS - 4, me.y * TS - 16, 'no witnesses', '#9aa0b8');
    else if (now > was) { float(me.x * TS - 2, me.y * TS - 16, 'SIREN ' + now, '#ff3a4a'); jolt(160, 1); }
    drawSiren();
    if (api.save) api.save();
  }
  var lawT = 0;
  function tickLaw(dt, now) {
    var LAW = window.MFLaw;
    if (!LAW) return;
    var was = LAW.law(s).siren;
    if (was) LAW.cool(s, dt, lawSees(), !!inside);
    tickEnforcers(dt, now);
    tickHelis(dt, now);
    tickCharges(now);
    if (LAW.law(s).siren !== was) { drawSiren(); if (api.save) api.save(); }
    else if (was && now - lawT > 400) { lawT = now; drawSiren(); }
  }
  function drawSiren() {
    var LAW = window.MFLaw, el = $('wSiren');
    if (!LAW || !el) return;
    var L = LAW.law(s);
    el.hidden = !L.siren;
    el.classList.toggle('cooling', L.siren > 0 && L.cool > 1);
    el.setAttribute('aria-label', 'wanted: ' + L.siren + ' of 5');
    [].forEach.call(el.children, function (i, k) { i.className = k < L.siren ? 'on' : ''; });
  }
  /* whose law you're under: hex's people on redrum, the NCPD everywhere else */
  function lawHere() { return (inside ? M.ROOMS[inside.id] && M.ROOMS[inside.id].d === 'redrum' : whereNow() === 'redrum') ? 'redrum' : 'city'; }
  function arrest() {
    var LAW = window.MFLaw, MF = window.MF, where = lawHere(), by = LAW.JAILS[where].by, out = LAW.caught(s, MF, where, Date.now());
    if (!out.level) return '';
    dropMobs(); shots = []; drawSiren(); wallet();
    talkBox = null; $('wTalk').hidden = true; held = {}; me.moving = false;
    var what = Object.keys(out.crimes).map(function (k) { return LAW.CRIMES[k].name + (out.crimes[k] > 1 ? ' x' + out.crimes[k] : ''); }).join(', ');
    if (!out.jail) {
      say([(where === 'redrum' ? 'a hashshashin steps out of nowhere and takes your wrist.\n' : 'an officer stops you. very politely.\n') + what + '.',
           (out.fine ? 'that\'s ' + MF.fmtJ(out.fine) + '. ' : '') + (out.owed ? 'you\'re ' + MF.fmtJ(out.owed) + ' short. we\'ll call it even. this once.' : where === 'redrum' ? 'hex says the street is square. stay that way.' : 'have a safe day.')], by);
      if (api.save) api.save();
      return 'fined ' + MF.fmtJ(out.fine);
    }
    var took = Object.keys(out.took).length;
    goIn(out.jail.room, { x: LAW.JAILS[where].cell.x, y: LAW.JAILS[where].cell.y, d: 'down' });
    say([(where === 'redrum' ? 'the hashshashin drag you into the lockup.\nthe cage shuts behind you.' : 'you come round in an NCPD holding cell.\nit\'s very clean.') + (took ? ' they kept your weapons.' : ''),
         what + '.\nsentence: ' + LAW.JAIL[out.level].mins + ' minutes. or bail, ' + MF.fmtJ(out.jail.bail) + '. ask at the bars.'], by);
    if (api.save) api.save();
    return 'jailed: ' + LAW.JAIL[out.level].mins + ' min';
  }
  function jailLeft() { var j = window.MFLaw && window.MFLaw.jailed(s, Date.now()); return j ? Math.ceil((j.until - Date.now()) / 1000) : 0; }
  function mmss(n) { return Math.floor(n / 60) + ':' + ('0' + n % 60).slice(-2); }
  /* the bars: from inside, wait it out or pay; once it's up, out you go */
  function atBars(m) {
    var LAW = window.MFLaw, MF = window.MF, inCell = me.y < m.y, by = lawHere() === 'redrum' ? 'HASHSHASHIN' : 'NCPD';
    function out() { LAW.release(s); me.x = m.x + 1; me.y = m.y + 1; me.dir = 'down'; s.world = here(); if (api.save) api.save(); }
    if (!inCell) return say([m.text]);
    var left = jailLeft();
    if (!left) { out(); return say([lawHere() === 'redrum' ? 'the cage swings open.\nget out. go on.' : 'the door buzzes open.\nyour sentence is served. please collect nothing on the way out.'], by); }
    ask([mmss(left) + ' left on your sentence.', 'pay bail, ' + MF.fmtJ(LAW.law(s).jail.bail) + '?'], function () {
      var r = LAW.bail(s, MF, Date.now());
      if (!r.ok) return say([r.why + '.\nyou don\'t have it. sit tight.'], by);
      wallet(); out();
      say(['bail paid. you\'re free to go.\ndon\'t make us do this again.'], by);
    });
  }
  /* DEV: the siren up or off, caught now, sentence over */
  function devLaw(act) {
    var LAW = window.MFLaw, L = LAW.law(s);
    if (act === 'siren') { L.siren = Math.min(5, L.siren + 1); L.cool = 0; L.fine += 40 * L.siren; L.crimes.assault = (L.crimes.assault || 0) + 1; }
    else if (act === 'siren0') { L.siren = 0; L.heat = 0; L.fine = 0; L.cool = 0; L.crimes = {}; }
    else if (act === 'caught') { var r = arrest(); return r || 'nobody wants you'; }
    else if (act === 'free') { if (L.jail.room) L.jail.until = 0; return 'sentence served: talk to the bars'; }
    drawSiren(); if (api.save) api.save();
    return 'siren ' + L.siren;
  }
  /* ── enforcers (law.js): the NPD in the city, hex's hashshashin on
     redrum. called in while the siren's on, a squad per level; they hold
     the siren while they can see you; up close they grab, from GUN_AT on
     they shoot. once the siren's off they stand down and go ── */
  var lawDown = false, callClock = 0, shots = [];
  function lawSees() {
    var LAW = window.MFLaw, solid = function (x, y) { return M.solid(world, x, y); };
    return !inside && (helis.some(heliSees) || mobs.some(function (m) { return m.law && !m.leaving && Math.abs(m.x - me.x) + Math.abs(m.y - me.y) <= LAW.SIGHT && LAW.clearShot(solid, m.x, m.y, me.x, me.y); }));
  }
  function tickEnforcers(dt, now) {
    var LAW = window.MFLaw, siren = LAW.law(s).siren, zn = zoneNow();
    if (!siren) { mobs.forEach(function (m) { if (m.law && !m.leaving) { m.leaving = now + 1500; float(m.x * TS, m.y * TS - 8, 'stand down', '#7cc8ff'); } }); return; }
    if (zn !== 'city') return;
    callClock += dt;
    var have = mobs.filter(function (m) { return m.law && !m.leaving; }).length;
    if (have >= LAW.SQUAD[siren] || mobs.length >= LAW.MAX_FIGHTERS || callClock < (have ? LAW.CALL_EVERY : 2)) return;
    callClock = 0;
    callIn(siren);
  }
  function callIn(siren) {
    var LAW = window.MFLaw, f = LAW.enforcer(lawHere(), siren), seed = Math.floor(Math.random() * 1e9);
    for (var tries = 0; tries < 80; tries++) {
      var dx = Math.floor(Math.random() * 25) - 12, dy = Math.floor(Math.random() * 17) - 8, d = Math.abs(dx) + Math.abs(dy), x = me.x + dx, y = me.y + dy;
      if (d < 8 || d > 13 || x < 0 || y < 0 || x >= world.W || y >= world.H || occupied(x, y) || world.dist[y * world.W + x] < 0) continue;
      var m = { f: f, law: f.law, x: x, y: y, fx: x, fy: y, t: 0, moving: false, dir: 'down', step: 0, cd: 1, hurt: 0, lunge: 0,
                speed: LAW.LAW_SPEED, look: MOB_LOOK[f.id] };
      mobs.push(m);
      float(x * TS + 4, y * TS - 4, '!', '#7cc8ff');
      return m;
    }
    return null;
  }
  function lawMove(m, d, dx, dy, now) {
    var LAW = window.MFLaw;
    if (m.leaving) { if (now > m.leaving) m.gone = true; return; }
    /* armed: shoot from range when there's a clear line */
    if (m.f.auto && !m.burst && m.cd <= 0 && d >= LAW.BLAST.min && d <= LAW.RANGE && Math.random() < LAW.BLAST.chance) { m.dir = faceTo(dx, dy); return lob(m, now); }
    if (m.f.armed && d > 1 && d <= LAW.RANGE && m.cd <= 0 && LAW.clearShot(function (x, y) { return M.solid(world, x, y); }, m.x, m.y, me.x, me.y)) {
      m.dir = faceTo(dx, dy); return shoot(m, now);
    }
    if (d === 1) { m.dir = faceTo(dx, dy); if (m.cd <= 0) grab(m, now); return; }
    /* armed ones keep their distance a little: no need to close past 3 */
    if (m.f.armed && d <= 3 && m.cd > 0) return;
    var o = chaseStep(m, me.x, me.y);
    if (o) { m.fx = m.x; m.fy = m.y; m.x += o[0]; m.y += o[1]; m.moving = true; m.t = 0; m.step ^= 1; m.dir = faceTo(o[0], o[1]); }
  }
  /* up close: a baton or a hand; a hit that lands may be the cuffs */
  function grab(m, now) {
    var LAW = window.MFLaw;
    if (mobHit(m, now) && Math.random() < LAW.GRAB) {
      float(me.x * TS - 2, me.y * TS - 14, 'CUFFED', '#7cc8ff');
      arrest();
    }
  }
  function shoot(m, now) {
    var AU = window.MFLaw.AUTO;
    m.lunge = now + 90;
    if (m.f.auto) { m.burst = (m.burst || 0) + 1; if (m.burst < AU.burst) m.cd = AU.gap; else { m.burst = 0; m.cd = AU.rest; } }
    else m.cd = 1.7;
    fire(m.x * TS + 8, m.y * TS + 7, m.f.gun, m.f.ref, now, m);
  }
  /* one round from (x0, y0) px at you: a tracer, and maybe a hit. by: who
     fired (a law mob, or a helicopter dressed as one) */
  function fire(x0, y0, gun, ref, now, by) {
    var C = window.MFCombat, MF = window.MF, P = C.player(s, window.MFLevel), r = C.strike({ pow: gun, ref: ref, crit: 0 }, { def: P.def, ref: P.ref, soak: P.soak });
    shots.push({ x0: x0, y0: y0, x1: me.x * TS + 8 + (r.hit ? 0 : (Math.random() - 0.5) * 18), y1: me.y * TS + 7 + (r.hit ? 0 : (Math.random() - 0.5) * 18), t0: now });
    if (!r.hit) { float(me.x * TS + 2, me.y * TS - 6, 'miss', '#7cf5ff'); return; }
    MF.hurt(s, r.dmg); hurtUntil = now + 260; jolt(200, 2); freezeUntil = now + 40;
    burst(me.x * TS + 8, me.y * TS + 8, 5, ['#ff4f5e', '#ffe97c'], 50);
    float(me.x * TS + 3, me.y * TS - 6, '-' + r.dmg, '#ff4f5e');
    drawBody();
    if (s.body.health <= 0) lose(by, now);
  }
  /* ── the top of the siren (law.js HELIS / AUTO / BLAST): helicopters
     with a spotlight and a door gunner; at 5 the squad throws charges ── */
  var helis = [], charges = [], heliClock = 0;
  function meX() { return me.x * TS + 8; }
  function meY() { return me.y * TS + 8; }
  function heliSees(h) { var HL = window.MFLaw.HELI; return !h.leaving && Math.hypot(h.sx - meX(), h.sy - meY()) <= HL.spot * TS; }
  function tickHelis(dt, now) {
    var LAW = window.MFLaw, HL = LAW.HELI, siren = LAW.law(s).siren, want = zoneNow() === 'city' && !inside ? LAW.HELIS[siren] : 0;
    var up = helis.filter(function (h) { return !h.leaving; });
    up.slice(want).forEach(function (h) { h.leaving = true; });
    heliClock += dt;
    if (up.length < want && heliClock >= HL.call) {
      heliClock = 0;
      var side = Math.random() < 0.5 ? -1 : 1, kind = LAW.force(lawHere());
      helis.push({ x: meX() + side * 18 * TS, y: meY() - 9 * TS, sx: meX() + side * 6 * TS, sy: meY() - 3 * TS, ang: Math.random() * 6.28, cd: 2, burst: 0, kind: kind, face: -side });
      float(me.x * TS - 8, me.y * TS - 16, 'chopper inbound', '#7cc8ff');
    }
    helis.forEach(function (h) {
      /* the body circles you, lazily; the spotlight hunts for you on its own */
      h.ang += dt * 0.6;
      var tx = h.leaving ? h.x + h.face * 40 * TS : meX() + Math.cos(h.ang) * 2.5 * TS, ty = h.leaving ? h.y - 20 * TS : meY() - 2 * TS + Math.sin(h.ang) * 1.2 * TS;
      var dx = tx - h.x, dy = ty - h.y, dd = Math.hypot(dx, dy), v = HL.speed * TS * dt;
      if (dd > 1) { h.x += dx / dd * Math.min(v, dd); h.y += dy / dd * Math.min(v, dd); if (Math.abs(dx) > 4) h.face = dx > 0 ? 1 : -1; }
      var sx = meX() - h.sx, sy = meY() - h.sy, sd = Math.hypot(sx, sy), sv = HL.spotSpeed * TS * dt;
      if (sd > 1) { h.sx += sx / sd * Math.min(sv, sd); h.sy += sy / sd * Math.min(sv, sd); }
      if (h.leaving) { if (Math.hypot(h.x - meX(), h.y - meY()) > 30 * TS) h.gone = true; return; }
      /* in the light: the door gunner opens up, a burst at a time */
      h.cd -= dt;
      if (h.cd > 0 || !heliSees(h)) return;
      h.burst++;
      if (h.burst < HL.burst) h.cd = 0.12; else { h.burst = 0; h.cd = HL.every; }
      fire(h.x, h.y + 4, Math.round(HL.gun * (1 + 0.2 * (siren - 1))), 8, now, { law: h.kind, f: { name: 'helicopter' } });
    });
    helis = helis.filter(function (h) { return !h.gone; });
  }
  /* a charge, thrown at where you stand: it blinks, then goes */
  function lob(m, now) {
    m.cd = window.MFLaw.AUTO.rest + 0.5; m.lunge = now + 150;
    charges.push({ x: me.x, y: me.y, sx: m.x, sy: m.y, t0: now, by: m });
  }
  function tickCharges(now) {
    var LAW = window.MFLaw, B = LAW.BLAST, MF = window.MF;
    charges = charges.filter(function (c) {
      if (now - c.t0 < B.fuse * 1000) return true;
      /* boom */
      burst(c.x * TS + 8, c.y * TS + 8, 18, ['#ffe97c', '#ff8a2a', '#ff3a4a', '#ffffff'], 110);
      jolt(320, 3); freezeUntil = now + 70;
      booms.push({ x: c.x * TS + 8, y: c.y * TS + 8, t0: now });
      var hit = function () { return Math.round(B.dmg * (0.85 + Math.random() * 0.3)); };
      if (!inside && LAW.inBlast(c.x, c.y, me.x, me.y)) {
        var n = hit(); MF.hurt(s, n); hurtUntil = now + 300;
        float(me.x * TS + 3, me.y * TS - 6, '-' + n, '#ff4f5e'); drawBody();
        if (s.body.health <= 0) { lose(c.by, now); return false; }
      }
      /* anyone else standing too close */
      mobs.slice().forEach(function (m) {
        if (m.law || !LAW.inBlast(c.x, c.y, m.x, m.y)) return;
        m.f.hp -= hit(); m.flash = now + 70;
        if (m.f.hp > 0) return;
        m.dead = true; mobs = mobs.filter(function (o) { return o !== m; });
        if (m.civ) layBody(m.civ, m.x, m.y, m.look, LAW.dies(B.lethal, Math.random) === 'dead');
        else downs.push({ x: m.x * TS, y: m.y * TS, img: sprite(m.look, m.dir, 0), t0: now });
      });
      cityNpcs.slice().forEach(function (n) {
        if (!LAW.attackable(n) || !LAW.inBlast(c.x, c.y, n.x, n.y)) return;
        cityNpcs.splice(cityNpcs.indexOf(n), 1);
        layBody(n, n.x, n.y, n.look === 'gen' ? crowdLook(n) : LOOKS[n.look] || LOOKS.local, LAW.dies(B.lethal, Math.random) === 'dead');
      });
      return false;
    });
  }
  var booms = [];
  /* the air: shadow on the ground, the body, a spinning rotor; a pool of light by day */
  function drawAir(cx, cy, now) {
    var B = window.MFLaw && window.MFLaw.BLAST;
    charges.forEach(function (c) {
      var e = now - c.t0, tx = c.x * TS + 8 - cx, ty = c.y * TS + 10 - cy;
      if (e < 380) {
        /* in the air: an arc from the thrower */
        var f = e / 380, ax = (c.sx * TS + 8 - cx) + (tx - (c.sx * TS + 8 - cx)) * f, ay = (c.sy * TS + 8 - cy) + (ty - (c.sy * TS + 8 - cy)) * f - Math.sin(f * Math.PI) * 18;
        px(ctx, OUT, Math.round(ax) - 2, Math.round(ay) - 2, 4, 4); px(ctx, '#3a3f4a', Math.round(ax) - 1, Math.round(ay) - 1, 2, 2);
        return;
      }
      ctx.strokeStyle = 'rgba(255,58,74,' + (0.25 + 0.25 * Math.sin(e / 60)).toFixed(3) + ')'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(tx - 8 - B.radius * TS) + 0.5, Math.round(ty - 10 - B.radius * TS) + 0.5, (2 * B.radius + 1) * TS - 1, (2 * B.radius + 1) * TS - 1);
      px(ctx, OUT, Math.round(tx) - 3, Math.round(ty) - 2, 6, 4); px(ctx, '#3a3f4a', Math.round(tx) - 2, Math.round(ty) - 1, 4, 2);
      if (Math.floor(e / (e > 800 ? 60 : 140)) % 2) px(ctx, '#ff3a4a', Math.round(tx) - 1, Math.round(ty) - 2, 2, 1);
    });
    booms = booms.filter(function (b) { return now - b.t0 < 420; });
    booms.forEach(function (b) {
      var f = (now - b.t0) / 420, r = 6 + f * 20;
      ctx.fillStyle = 'rgba(255,' + Math.round(233 - 140 * f) + ',124,' + (0.8 * (1 - f)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, r, 0, 6.283); ctx.fill();
    });
    var dk = darkness(novaNow()), HL = window.MFLaw && window.MFLaw.HELI;
    helis.forEach(function (h) {
      if (dk < 0.5) {
        ctx.fillStyle = 'rgba(255,255,236,' + (heliSees(h) ? 0.2 : 0.12) + ')';
        ctx.beginPath(); ctx.ellipse(h.sx - cx, h.sy - cy, HL.spot * TS, HL.spot * TS * 0.75, 0, 0, 6.283); ctx.fill();
      }
      var x = Math.round(h.x - cx), y = Math.round(h.y - cy), body = h.kind === 'hashshashin' ? '#14141c' : '#1f3a8a', trim = h.kind === 'hashshashin' ? '#7cffb2' : '#f4f6ff';
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x - 8, y + 26, 20, 6); ctx.fillRect(x + 10 * h.face, y + 28, 12, 2);
      ctx.save(); ctx.translate(x, y); if (h.face > 0) ctx.scale(-1, 1);
      /* tail, fin, cabin, windscreen, stripe */
      px(ctx, OUT, 6, -2, 16, 4); px(ctx, body, 7, -1, 14, 2); px(ctx, OUT, 20, -5, 3, 10); px(ctx, trim, 21, -4, 1, 8);
      px(ctx, OUT, -11, -6, 19, 12); px(ctx, body, -10, -5, 17, 10); px(ctx, '#7cc8ff', -10, -4, 4, 8); px(ctx, trim, -5, -5, 11, 1);
      if (Math.floor(now / 400) % 2) px(ctx, '#ff3a4a', 0, 5, 2, 1);
      var a = now / 35; ctx.strokeStyle = 'rgba(220,227,255,.6)'; ctx.lineWidth = 1; ctx.beginPath();
      for (var i = 0; i < 2; i++) { var aa = a + i * Math.PI / 2; ctx.moveTo(-2 - Math.cos(aa) * 16, -Math.sin(aa) * 8); ctx.lineTo(-2 + Math.cos(aa) * 16, Math.sin(aa) * 8); }
      ctx.stroke(); px(ctx, '#3a3f4a', -3, -1, 2, 2);
      ctx.restore();
    });
  }
  /* they gave up, or you went somewhere they can't follow: back in the crowd where they stand */
  function backToCrowd(m) { var n = m.civ; n.f = m.f; n.x = m.x; n.y = m.y; n.fx = m.x; n.fy = m.y; n.moving = false; n.t = 0; n.dir = m.dir; cityNpcs.push(n); }
  function dropMobs() { mobs.forEach(function (m) { if (m.civ) backToCrowd(m); }); mobs = []; helis = []; charges = []; }
  function civFalls(m, weapon) {
    var LAW = window.MFLaw, now = performance.now();
    var dead = LAW.fall(weapon, Math.random) === 'dead';
    layBody(m.civ, m.x, m.y, m.look, dead);
    crime(dead ? 'murder' : 'knockout', m.x, m.y, m.civ);
    freezeUntil = now + 120; jolt(180, 1);
    exp('combat', { xp: m.f.xp });
    if (api.save) api.save();
  }
  function bodyAt(x, y) { for (var i = bodies.length - 1; i >= 0; i--) if (bodies[i].x === x && bodies[i].y === y) return bodies[i]; return null; }
  function searchBody(b) {
    var LAW = window.MFLaw, MF = window.MF, SH = window.MFShops, p = b.pockets, what = [];
    var state = b.dead ? 'they\'re not breathing.' : 'they\'re out cold.';
    if (LAW.empty(p)) return say([state + '\nnothing in their pockets. not any more.']);
    if (p.joules) what.push(MF.fmtJ(p.joules));
    Object.keys(p.items).forEach(function (k) { var g = SH.FOODS[k] || SH.MEDS[k]; what.push(g ? g.name : k); });
    ask([state + '\nin their pockets: ' + what.join(', ') + '.', 'take it?'], function () {
      var r = LAW.loot(s, MF, p);
      if (!r.ok) return;
      crime('theft', b.x, b.y, b.n);
      if (r.got.joules) wallet('+' + MF.fmtJ(r.got.joules));
      if (api.save) api.save();
    });
  }
  function tickBodies(now) {
    var LAW = window.MFLaw;
    if (!LAW) return;
    bodies = bodies.filter(function (b) {
      if (b.dead) { if (now - b.at < LAW.BODY_SECS * 1000) return true; gone.push({ n: b.n, at: b.at }); return false; }
      if (now - b.at < LAW.DOWN_SECS * 1000 || (!inside && me.x === b.x && me.y === b.y)) return true;
      /* back on their feet, a little unsteady */
      var n = b.n; n.x = b.x; n.y = b.y; n.moving = false; n.t = 0; n.dir = 'down'; delete n.f; cityNpcs.push(n);
      return false;
    });
    /* someone new moves into the spot, once you're not looking */
    if (inside) return;
    gone = gone.filter(function (g) {
      var n = g.n;
      if (now - g.at < LAW.RESPAWN_SECS * 1000 || (Math.abs(n.hx - me.x) <= VW && Math.abs(n.hy - me.y) <= VH) || occupied(n.hx, n.hy)) return true;
      var c = {}; for (var k in n) c[k] = n[k];
      delete c.f; c.seed = (n.seed * 31 + 7919) >>> 0; c.x = c.fx = n.hx; c.y = c.fy = n.hy; c.moving = false; c.t = 0; c.dir = 'down';
      cityNpcs.push(c);
      return false;
    });
  }
  /* the fallen lie across their tile: out cold, or in a spreading pool */
  function drawBodies(cx, cy, now) {
    bodies.forEach(function (b) {
      var x = Math.round(b.x * TS - cx), y = Math.round(b.y * TS - cy);
      if (x < -TS || y < -TS || x > VW * TS || y > VH * TS) return;
      if (b.dead) {
        var r = Math.round(Math.min(1, (now - b.at) / 4000) * 2);
        ctx.fillStyle = 'rgba(120,10,24,.8)';
        ctx.fillRect(x + 3 - r, y + 9, 10 + 2 * r, 4); ctx.fillRect(x + 4 - r, y + 8, 8 + 2 * r, 6);
      }
      ctx.save(); ctx.translate(x + 8, y + 10); ctx.rotate(b.dead ? Math.PI / 2 : -Math.PI / 2);
      ctx.drawImage(sprite(b.look, 'down', 0), -8, -8);
      ctx.restore();
      /* out cold: a little star going round */
      if (!b.dead) { var a = now / 300; px(ctx, '#ffe97c', x + 8 + Math.round(Math.cos(a) * 4), y + 2 + Math.round(Math.sin(a) * 1.5), 1, 1); }
    });
  }
  /* bars over heads, numbers that float up, the swing, the sting of a hit */
  function drawFight(cx, cy, now, ppx, ppy) {
    mobs.forEach(function (m) {
      var mx = Math.round((m.moving ? m.fx + (m.x - m.fx) * m.t : m.x) * TS - cx), my = Math.round((m.moving ? m.fy + (m.y - m.fy) * m.t : m.y) * TS - cy);
      px(ctx, OUT, mx + 1, my - 6, 14, 4); px(ctx, '#3a1218', mx + 2, my - 5, 12, 2);
      /* pink: far past your level. amber: a passer-by fighting someone else, not you */
      px(ctx, m.law ? '#4f8aff' : m.foe ? '#ffb02e' : m.f.tier === 'unnamed' && m.f.level > (window.MFLevel ? window.MFLevel.level(s) + 3 : 99) ? '#ff4fd8' : '#ff4f5e', mx + 2, my - 5, Math.max(1, Math.round(12 * m.f.hp / m.f.max)), 2);
    });
    if (mobs.length || now < hurtUntil + 1500) {
      var hx = Math.round(ppx - cx), hy = Math.round(ppy - cy), MF = window.MF;
      px(ctx, OUT, hx + 1, hy - 6, 14, 4); px(ctx, '#123a22', hx + 2, hy - 5, 12, 2);
      px(ctx, '#7cffb2', hx + 2, hy - 5, Math.max(0, Math.round(12 * MF.vital(s, 'hp') / MF.maxOf(s, 'hp'))), 2);
    }
    if (now < swingFx + 150) {
      /* the swing in two frames: half an arc, then the whole sweep with a
         fainter smear outside it */
      var d = DIRS[me.dir], sx = Math.round(ppx - cx) + 8 + d[0] * 10, sy = Math.round(ppy - cy) + 7 + d[1] * 10, base = Math.atan2(d[1], d[0]);
      ctx.lineWidth = 1;
      if (now < swingFx + 70) { ctx.strokeStyle = '#f4f6ff'; ctx.beginPath(); ctx.arc(sx, sy, 5, base - 1.3, base); ctx.stroke(); }
      else {
        ctx.strokeStyle = 'rgba(244,246,255,.45)'; ctx.beginPath(); ctx.arc(sx, sy, 7, base - 1.1, base + 1.3); ctx.stroke();
        ctx.strokeStyle = '#f4f6ff'; ctx.beginPath(); ctx.arc(sx, sy, 5, base - 1.3, base + 1.3); ctx.stroke();
      }
    }
    /* gunfire: a tracer and a muzzle flash, gone in a blink */
    shots = shots.filter(function (q) { return now - q.t0 < 110; });
    shots.forEach(function (q) {
      ctx.strokeStyle = 'rgba(255,233,124,' + (1 - (now - q.t0) / 110).toFixed(3) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(q.x0 - cx, q.y0 - cy); ctx.lineTo(q.x1 - cx, q.y1 - cy); ctx.stroke();
      if (now - q.t0 < 50) px(ctx, '#fff3b0', Math.round(q.x0 - cx) - 1, Math.round(q.y0 - cy) - 1, 3, 3);
    });
    sparks = sparks.filter(function (q) { return now - q.t0 < 260; });
    sparks.forEach(function (q) {
      var a = (now - q.t0) / 1000;
      px(ctx, q.col, Math.round(q.x + q.vx * a - cx), Math.round(q.y + q.vy * a + 60 * a * a - cy), 1, 1);
    });
    /* a KO: blinks a few times, then goes up in a puff */
    downs = downs.filter(function (k) { return now - k.t0 < 700; });
    downs.forEach(function (k) {
      var e = now - k.t0, x = Math.round(k.x - cx), y = Math.round(k.y - cy);
      if (e < 380) { if (Math.floor(e / 60) % 2 === 0) ctx.drawImage(k.img, x, y - 2); return; }
      var f = (e - 380) / 320, r = 2 + Math.round(f * 5);
      ctx.fillStyle = 'rgba(200,204,216,' + (0.7 * (1 - f)).toFixed(3) + ')';
      [[4, 9], [11, 8], [8, 4], [6, 12], [10, 12]].forEach(function (o, i) {
        /* each puff a little plus of two rects, so it reads round */
        var bx = x + o[0] + (i % 2 ? 1 : -1) * Math.round(f * 3), by = y + o[1] - Math.round(f * 6);
        ctx.fillRect(bx - r, by - r + 1, r * 2, r * 2 - 2); ctx.fillRect(bx - r + 1, by - r, r * 2 - 2, r * 2);
      });
    });
    ctx.font = 'bold 7px monospace'; ctx.textBaseline = 'bottom';
    floats = floats.filter(function (f) { return now - f.t0 < 900; });
    floats.forEach(function (f) {
      var up = (now - f.t0) / 900 * 10, x = Math.round(f.x - cx), y = Math.round(f.y - cy - up);
      ctx.fillStyle = OUT; ctx.fillText(f.text, x + 1, y + 1); ctx.fillStyle = f.col; ctx.fillText(f.text, x, y);
    });
    if (now < hurtUntil) { ctx.fillStyle = 'rgba(255,40,60,.22)'; ctx.fillRect(0, 0, VW * TS, VH * TS); }
  }
  /* DEV: someone, right now (an id, or whoever fits here) */
  function devFoe(id) { var zn = zoneNow(); if (!zn) return 'not out here'; var m = spawnFoe(zn, id || false); return m ? m.f.name + ' lv ' + m.f.level : 'nobody fits here'; }

  /* ── night: how dark it is, and the city's lights through it ──
     0 by day; ramps up 18:00-21:00, full till 05:00, lifts by 07:00 */
  function darkness(c) {
    var h = c.hour + c.minute / 60;
    return h >= 21 || h < 5 ? 1 : h >= 18 ? (h - 18) / 3 : h < 7 ? 1 - (h - 5) / 2 : 0;
  }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  /* each landmark's neon; the rest take their district's first glow */
  var MARK_GLOW = { tower: '#9f8cff', ncpd: '#2a6aff', hospital: '#ff4f6a', pagoda: '#ffd36a', greattree: '#3affc8', market: '#ffd36a', arcade: '#ff4fd8',
                    casino: '#f2c94c', sapphire: '#7cf5ff', noorborj: '#ffe97c', noodlebar: '#ffd36a', teahouse: '#ff6a3a', fountain: '#7cf5ff', boatyard: '#ffd36a' };
  /* a streetlamp: a post at the kerb, a head leaning over the road */
  var LAMP_AT = { down: [7, 9], up: [7, 0], right: [12, 4], left: [2, 4] };
  function lampHead(l, cx, cy) { var o = LAMP_AT[l.side]; return [l.x * TS - cx + o[0] + 1, l.y * TS - cy + o[1] - 6]; }
  function drawLamps(cx, cy) {
    var lit = darkness(novaNow()) > 0.3;
    (deco.lamps || []).forEach(function (l) {
      var sx = l.x * TS - cx, sy = l.y * TS - cy;
      if (sx < -TS || sy < -2 * TS || sx > VW * TS || sy > VH * TS + TS) return;
      var o = LAMP_AT[l.side], bx = sx + o[0], by = sy + o[1];
      px(ctx, 'rgba(0,0,0,.35)', bx - 1, by + 5, 5, 2);
      /* the pole's shadow, off to the bottom right with everything else's */
      var ps = 'rgba(0,0,0,' + (SHADE * (1 - darkness(novaNow()))).toFixed(3) + ')';
      for (var i = 0; i < SH_X + 3; i++) px(ctx, ps, bx + 3 + i, by + 5 + Math.floor(i * 0.75), 1, 1);
      px(ctx, OUT, bx, by - 8, 3, 14); px(ctx, '#5a6070', bx + 1, by - 7, 1, 12);
      px(ctx, OUT, bx - 2, by - 10, 7, 4); px(ctx, lit ? '#fff3b0' : '#8a92a6', bx - 1, by - 9, 5, 2);
    });
  }
  var lightCv = null;
  function night(dk, cx, cy, now, ppx, ppy) {
    var W = VW * TS, Hh = VH * TS, lights = [], nc = novaNow();
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== W || lightCv.height !== Hh) { lightCv.width = W; lightCv.height = Hh; }
    function add(x, y, r, a, col, ga) { if (x > -r && y > -r && x < W + r && y < Hh + r) lights.push({ x: x, y: y, r: r, a: a, col: col, ga: ga }); }
    /* a helicopter's spotlight */
    helis.forEach(function (h) { add(h.sx - cx, h.sy - cy, 30, 1, '#f4f6ff', 0.4); });
    /* lamps: a warm pool on the road */
    (deco.lamps || []).forEach(function (l) { var h = lampHead(l, cx, cy); add(h[0], h[1] + 10, 40, 0.95, '#ffcf7a', 0.2); });
    /* lit windows and doors on every building front in view */
    var x0 = Math.max(0, Math.floor(cx / TS) - 1), y0 = Math.max(0, Math.floor(cy / TS) - 1);
    for (var y = y0; y <= y0 + VH + 1 && y < world.H; y++) for (var x = x0; x <= x0 + VW + 1 && x < world.W; x++) {
      var k = y * world.W + x;
      if (world.tile[k] !== T.BUILDING) continue;
      var p = pal(world.dist[k]), v = Math.floor(hash(x, y) * 32), tx = x * TS - cx, ty = y * TS - cy;
      if (storey(x, y)) { for (var u = 0; u < 2; u++) lamp(x, y, tx, ty, u, true, v, p); continue; }
      if (y + 1 < world.H && world.tile[k + world.W] === T.BUILDING) continue;
      if (deco.door[k]) { add(tx + 8, ty + 12, 16, 0.75, p.glow[v % p.glow.length], 0.3); continue; }
      for (var i = 0; i < 2; i++) lamp(x, y, tx, ty, i, false, v, p);
    }
    /* a window as the night has it: the tile art bakes one look, so any
       window that's changed gets its glass repainted here, under the dark */
    function lamp(x, y, tx, ty, i, up, v, p) {
      var st = winState(x, y, i, up, v, nc), baked = up ? upperOn(v, i) : !!((v >> (i + 2)) & 1 || (v & 3) === 1);
      var gx = tx + (i ? 9 : 2) + 1, gy = ty + (up ? 5 : 6), gh = up ? 5 : 4;
      var col = up ? p.glow[(v + i + 1) % p.glow.length] : p.glow[(v + i) % p.glow.length], ga = 0.3, a = 0.6;
      if (st === 2) {
        /* a tv: cold light that jumps about */
        var id = x * 4 + i * 2 + (up ? 1 : 0), fl = 0.55 + 0.45 * Math.abs(Math.sin(now / 110 + id) * Math.sin(now / 37 + id * 3));
        col = Math.floor(now / 450 + id) % 3 ? '#7ab8ff' : '#dce3ff'; ga = 0.32 * fl; a = 0.45 + 0.2 * fl;
      }
      if (st !== (baked ? 1 : 0)) {
        px(ctx, st ? col : '#141a2e', gx, gy, 3, gh);
        if (up) px(ctx, OUT, gx, gy + 2, 3, 1); else px(ctx, OUT, gx + 1, gy, 1, gh);
      }
      if (st) add(tx + (i ? 11 : 4), ty + (up ? 7 : 9), 11, a, col, ga);
    }
    /* landmarks' neon, and fires that flicker */
    world.marks.forEach(function (m) {
      var mx = (m.x + m.w / 2) * TS - cx, my = m.y * TS - cy;
      if (m.fire) { var f = 1 + 0.12 * Math.sin(now / 90 + m.x) + 0.08 * Math.sin(now / 37 + m.y); add(mx, my + 8, 34 * f, 0.95, '#ff8a3a', 0.35 * f); return; }
      var col = MARK_GLOW[m.id] || pal(world.dist[m.y * world.W + m.x]).glow[0];
      /* about a third of the signs have a bad tube: now and then they drop out */
      if (hash(m.x * 3 + m.y, 11) < 0.35 && hash(m.x + m.y, Math.floor(now / 70)) < 0.12) return;
      add(mx, my + m.h * TS * 0.45, Math.max(m.w, m.h) * 11 + 10, 0.7, col, 0.22);
      if (m.room || m.home) { var dc = doorCols(m); add((dc[0] + dc.length / 2) * TS - cx, (m.y + m.h) * TS - cy - 2, 18, 0.8, '#ffe97c', 0.15); }
    });
    /* the lighthouse sweeps */
    world.marks.forEach(function (m) {
      if (m.id !== 'noorborj') return;
      var a = now / 1400, bx = (m.x + m.w / 2) * TS - cx, by = m.y * TS - cy + 6;
      for (var j = 1; j <= 5; j++) add(bx + Math.cos(a) * j * 22, by + Math.sin(a) * j * 11, 14 + j * 3, 0.5, '#ffe97c', 0.12);
    });
    /* naturia's flora glows: some trees and grass, a slow pulse */
    var nat = D.findIndex ? D.findIndex(function (d) { return d.id === 'naturia'; }) : -1, BIO = ['#3affc8', '#b28cff', '#7cf5ff'];
    if (nat >= 0) for (var by = y0; by <= y0 + VH + 1 && by < world.H; by++) for (var bx = x0; bx <= x0 + VW + 1 && bx < world.W; bx++) {
      var bk = by * world.W + bx, bt = world.tile[bk];
      if (world.dist[bk] !== nat || (bt !== T.TREE && bt !== T.GRASS)) continue;
      var bh = hash(bx + 17, by + 29);
      if (bt === T.GRASS ? bh > 0.18 : bh > 0.6) continue;
      var pulse = 0.8 + 0.2 * Math.sin(now / 900 + bh * 40);
      add(bx * TS - cx + 8, by * TS - cy + (bt === T.TREE ? 6 : 10), (bt === T.TREE ? 18 : 10) * pulse, 0.6, BIO[Math.floor(bh * 97) % 3], 0.4 * pulse);
    }
    /* you can always see your own feet; out in the wilds, only just */
    var out = wild();
    add(ppx - cx + 8, ppy - cy + 8, out ? 14 : 26, out ? 0.4 : 0.55, null, 0);
    var g = lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(2,3,12,' + ((out ? 0.96 : 0.66) * dk).toFixed(3) + ')'; g.fillRect(0, 0, W, Hh);
    g.globalCompositeOperation = 'destination-out';
    /* the flashlight: a cone the way you face */
    if (torchLit) {
      var fd = DIRS[me.dir], ox = ppx - cx + 8, oy = ppy - cy + 8, ang = Math.atan2(fd[1], fd[0]), R = 104;
      var cg = g.createRadialGradient(ox, oy, 6, ox, oy, R);
      cg.addColorStop(0, 'rgba(0,0,0,.97)'); cg.addColorStop(0.6, 'rgba(0,0,0,.7)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cg; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, ang - 0.48, ang + 0.48); g.closePath(); g.fill();
    }
    lights.forEach(function (l) {
      var gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, 'rgba(0,0,0,' + l.a + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (l.a * 0.5) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    ctx.drawImage(lightCv, 0, 0);
    /* and the colour of each light, added on top */
    ctx.globalCompositeOperation = 'lighter';
    lights.forEach(function (l) {
      if (!l.col) return;
      var gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
      gr.addColorStop(0, rgba(l.col, (l.ga * dk).toFixed(3))); gr.addColorStop(1, rgba(l.col, 0));
      ctx.fillStyle = gr; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    /* lights by the water drop a wobbling streak down across it */
    lights.forEach(function (l) {
      if (!l.col || l.r < 11) return;
      var wx = Math.floor((l.x + cx) / TS), wy = Math.floor((l.y + cy) / TS);
      for (var j = 1; j <= 3; j++) {
        if (!M.water(world, wx, wy + j)) continue;
        var top = (wy + j) * TS - cy, fade = 1 - (j - 1) / 3;
        for (var r = 0; r < TS; r += 2) {
          var wob = Math.round(Math.sin(now / 420 + r * 0.6 + wx) * 1.5), wd = 2 + ((r + Math.floor(now / 300)) % 3);
          ctx.fillStyle = rgba(l.col, (0.45 * dk * fade * (l.ga > 0.25 ? 1 : 0.7)).toFixed(3));
          ctx.fillRect(Math.round(l.x) - (wd >> 1) + wob, top + r, wd, 1);
        }
      }
    });
    if (torchLit) {
      var fd2 = DIRS[me.dir], tx2 = ppx - cx + 8, ty2 = ppy - cy + 8, a2 = Math.atan2(fd2[1], fd2[0]);
      var wg = ctx.createRadialGradient(tx2, ty2, 6, tx2, ty2, 104);
      wg.addColorStop(0, rgba('#fff3b0', (0.16 * dk).toFixed(3))); wg.addColorStop(1, rgba('#fff3b0', 0));
      ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.arc(tx2, ty2, 104, a2 - 0.48, a2 + 0.48); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* a block three or more deep stands two storeys at the front */
  /* how far the road runs from (x, y): [up, down, left, right], up to 6 */
  function roadRun(x, y, at) {
    var r = [0, 0, 0, 0], o = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var i = 0; i < 4; i++) while (r[i] < 6 && at(x + o[i][0] * (r[i] + 1), y + o[i][1] * (r[i] + 1)) === T.ROAD) r[i]++;
    return r;
  }
  /* 1024 centre line along the top (an east-west road), 2048 down the left
     (north-south); 4096 / 8192 a zebra across an east-west / north-south road */
  var LANES = 4;
  function laneMarks(x, y, at) {
    var r = roadRun(x, y, at), m = 0;
    if (r[0] + r[1] + 1 === LANES) {
      var a = roadRun(x - 1, y, at), b = roadRun(x + 1, y, at);
      if ((at(x - 1, y) === T.ROAD && a[0] + a[1] + 1 > LANES) || (at(x + 1, y) === T.ROAD && b[0] + b[1] + 1 > LANES)) m |= 4096;
      else if (r[0] === LANES >> 1) m |= 1024;
    }
    if (r[2] + r[3] + 1 === LANES) {
      var c = roadRun(x, y - 1, at), e = roadRun(x, y + 1, at);
      if ((at(x, y - 1) === T.ROAD && c[2] + c[3] + 1 > LANES) || (at(x, y + 1) === T.ROAD && e[2] + e[3] + 1 > LANES)) m |= 8192;
      else if (r[2] === LANES >> 1) m |= 2048;
    }
    return m;
  }
  function storey(x, y) {
    var B = T.BUILDING, W = world.W;
    return y > 0 && y + 1 < world.H && world.tile[y * W + x] === B && world.tile[(y + 1) * W + x] === B && world.tile[(y - 1) * W + x] === B
      && (y + 2 >= world.H || world.tile[(y + 2) * W + x] !== B);
  }
  /* ── the shoreline, rounded: tiles meet the water on a grid, so the coast
     comes out in stair steps. land jutting into the water gets its corner
     washed away, and water tucked into the land gets its corner filled in,
     each with the foam running along the cut ── */
  var CORNER = [[1, -1, 0, 1], [1, 1, 1, 2], [-1, 1, 2, 3], [-1, -1, 3, 0]];  /* NE SE SW NW: diagonal, the two sides */
  var SIDE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function landBase(t, di) {
    var p = pal(di);
    return t === T.SAND ? '#5e523c' : t === T.GRASS || t === T.TREE ? p.grass : t === T.GROUND || t === T.STALL ? p.ground : t === T.MAINLAND ? '#14301c' : t === T.ROAD ? p.road : null;
  }
  function seaOf(t) { return t === T.DEEP ? '#0a1834' : '#123563'; }
  /* a triangle in corner c of the tile at (sx, sy): pixels within n of the corner */
  function wedge(sx, sy, c, n, col, edge) {
    for (var i = 0; i <= n; i++) {
      var len = n - i, ex = c === 0 || c === 1, ey = c === 1 || c === 2;
      var rx = ex ? sx + TS - 1 - i : sx + i, ry = ey ? sy + TS - len : sy;
      if (len > 0) px(ctx, col, rx, ry, 1, len);
      if (edge) px(ctx, edge, rx, ey ? ry - 1 : sy + len, 1, 1);
    }
  }
  var FOAM = '#6fb4e0', CUT = 4;
  function shores(x0, y0, cx, cy, at, wet) {
    for (var y = y0; y <= y0 + VH && y < world.H; y++) for (var x = x0; x <= x0 + VW && x < world.W; x++) {
      var k = y * world.W + x, t = world.tile[k], sx = x * TS - cx, sy = y * TS - cy;
      for (var c = 0; c < 4; c++) {
        var C = CORNER[c], a = SIDE[C[2]], b = SIDE[C[3]];
        var ta = at(x + a[0], y + a[1]), tb = at(x + b[0], y + b[1]), td = at(x + C[0], y + C[1]);
        if ((t === T.DEEP || t === T.SHALLOW) && ta === tb && ta === td && (ta === T.DEEP || ta === T.SHALLOW) && ta !== t) {
          /* deep tucked into shallow or the other way: round that corner too */
          wedge(sx, sy, c, CUT, seaOf(ta), null);
        } else if (wet(t)) {
          /* water with land on both sides of this corner: fill it in */
          var lc = landBase(ta, world.dist[(y + a[1]) * world.W + x + a[0]]);
          if (!wet(ta) && !wet(tb) && !wet(td) && lc && landBase(tb, 0) && landBase(td, 0)) wedge(sx, sy, c, CUT, lc, FOAM);
        } else if (landBase(t, world.dist[k]) && wet(ta) && wet(tb) && wet(td)) {
          /* land poking out: wash the corner away, and stop the
             neighbours' foam where the new edge takes over */
          var sea = seaOf(td);
          wedge(sx, sy, c, CUT, sea, FOAM);
          var ex = c === 0 || c === 1, ey = c === 1 || c === 2;
          px(ctx, sea, ex ? sx + TS - CUT : sx, ey ? sy + TS : sy - 1, CUT, 1);
          px(ctx, sea, ex ? sx + TS : sx - 1, ey ? sy + TS - CUT : sy, 1, CUT);
        }
      }
    }
  }

  /* ── ambient life: each district has something in the air. particles
     live in world pixels; the glowing kinds draw over the night so they
     shine, the rest under it so they darken with everything else ── */
  var parts = [], partAt = 0, dustAt = 0;
  var AMBIENT = { worldwood: 'steam', yucayeque: 'fly', vistadelsol: 'fly', naturia: 'spore', majinryu: 'petal', redrum: 'litter', haven: 'bird' };
  var GLOWS = { fly: 1, spore: 1 };
  function distId(di) { return di >= 0 ? D[di].id : di === -2 ? 'vistadelsol' : ''; }
  function ambient(now, cx, cy, x0, y0, ppx, ppy) {
    var dt = Math.min(0.05, (now - (partAt || now)) / 1000), dk = darkness(novaNow()); partAt = now;
    function tileAt(id, ok) {
      for (var n = 0; n < 8; n++) {
        var tx = x0 + Math.floor(Math.random() * (VW + 1)), ty = y0 + Math.floor(Math.random() * (VH + 1));
        if (tx >= world.W || ty >= world.H) continue;
        var k = ty * world.W + tx;
        if (distId(world.dist[k]) === id && ok(world.tile[k])) return [tx, ty];
      }
      return null;
    }
    function add(kind, x, y, vx, vy, life, col) { if (parts.length < 140) parts.push({ k: kind, x: x, y: y, vx: vx, vy: vy, t0: now, life: life, col: col, seed: Math.random() * 100 }); }
    /* what's on screen: the district underfoot, plus a peek at the corners */
    var near = {};
    [[me.x, me.y], [x0, y0], [x0 + VW, y0], [x0, y0 + VH], [x0 + VW, y0 + VH]].forEach(function (c) {
      if (c[0] < world.W && c[1] < world.H) near[distId(world.dist[c[1] * world.W + c[0]])] = 1;
    });
    Object.keys(near).forEach(function (id) {
      var kind = AMBIENT[id], at;
      if (kind === 'steam') {
        /* a few fixed vents in the road, each breathing */
        for (var y = y0; y <= y0 + VH && y < world.H; y++) for (var x = x0; x <= x0 + VW && x < world.W; x++) {
          var k = y * world.W + x;
          if (world.tile[k] === T.ROAD && distId(world.dist[k]) === id && hash(x + 7, y + 3) < 0.06 && Math.random() < dt * 5)
            add('steam', x * TS + 6 + Math.random() * 4, y * TS + 9, (Math.random() - 0.5) * 3, -9 - Math.random() * 4, 1.6, null);
        }
      } else if (kind === 'fly' && dk > 0.25 && Math.random() < dt * 10) {
        if ((at = tileAt(id, function (t) { return t === T.GRASS || t === T.TREE || t === T.MAINLAND; })))
          add('fly', at[0] * TS + Math.random() * TS, at[1] * TS + Math.random() * TS, 0, 0, 4 + Math.random() * 3, '#ffe97c');
      } else if (kind === 'spore' && Math.random() < dt * 9) {
        if ((at = tileAt(id, function (t) { return t === T.GRASS || t === T.TREE || t === T.GROUND; })))
          add('spore', at[0] * TS + Math.random() * TS, at[1] * TS + Math.random() * TS, 0, -3 - Math.random() * 3, 5, ['#3affc8', '#b28cff', '#7cf5ff'][Math.floor(Math.random() * 3)]);
      } else if (kind === 'petal' && Math.random() < dt * 9) {
        if ((at = tileAt(id, function () { return true; })))
          add('petal', at[0] * TS + Math.random() * TS, at[1] * TS - 20, 5 + Math.random() * 4, 9 + Math.random() * 4, 4.5, Math.random() < 0.5 ? '#ffb7d0' : '#ff8fb8');
      } else if (kind === 'litter' && Math.random() < dt * 0.8) {
        if ((at = tileAt(id, function (t) { return t === T.ROAD; })))
          add('litter', at[0] * TS, at[1] * TS + 4 + Math.random() * 8, 22 + Math.random() * 14, 0, 3, Math.random() < 0.6 ? '#d8d4c8' : '#c8a878');
      } else if (kind === 'bird' && dk < 0.5 && Math.random() < dt * 0.25) {
        add('bird', cx - 8, cy + 10 + Math.random() * (VH * TS * 0.6), 34 + Math.random() * 10, (Math.random() - 0.5) * 6, (VW * TS + 16) / 34, OUT);
      }
    });
    /* dust off your heels when you run */
    if (running() && now - dustAt > 110) {
      dustAt = now;
      var d = DIRS[me.dir];
      for (var j = 0; j < 2; j++) add('dust', ppx + 8 - d[0] * 4 + (j ? 3 : -3), ppy + 14 - d[1] * 2, -d[0] * 6 + (Math.random() - 0.5) * 6, -4 - Math.random() * 4, 0.45, '#a89878');
    }
    parts = parts.filter(function (q) { return (now - q.t0) / 1000 < q.life; });
    parts.forEach(function (q) {
      var age = (now - q.t0) / 1000;
      if (q.k === 'fly') { q.vx += (Math.random() - 0.5) * 40 * dt; q.vy += (Math.random() - 0.5) * 40 * dt; q.vx *= 0.96; q.vy *= 0.96; }
      if (q.k === 'spore' || q.k === 'petal') q.vx += Math.sin(now / 500 + q.seed) * 6 * dt;
      if (q.k === 'litter') q.vy = Math.sin(age * 9 + q.seed) * 6;
      q.x += q.vx * dt; q.y += q.vy * dt;
    });
  }
  function drawAmbient(now, cx, cy, glows) {
    if (glows) ctx.globalCompositeOperation = 'lighter';
    parts.forEach(function (q) {
      if (!!GLOWS[q.k] !== glows) return;
      var a = (now - q.t0) / 1000 / q.life, x = Math.round(q.x - cx), y = Math.round(q.y - cy);
      if (x < -8 || y < -8 || x > VW * TS + 8 || y > VH * TS + 8) return;
      var fade = Math.min(1, a * 5, (1 - a) * 4);
      if (q.k === 'steam') { var r = 1 + Math.floor(a * 3); ctx.fillStyle = 'rgba(210,214,228,' + (0.5 * (1 - a)).toFixed(3) + ')'; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      else if (q.k === 'fly') { var bl = 0.5 + 0.5 * Math.sin(now / 180 + q.seed); ctx.fillStyle = rgba(q.col, (0.25 * bl * fade).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = rgba(q.col, (0.9 * bl * fade).toFixed(3)); ctx.fillRect(x, y, 1, 1); }
      else if (q.k === 'spore') { ctx.fillStyle = rgba(q.col, (0.3 * fade).toFixed(3)); ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = rgba(q.col, (0.95 * fade).toFixed(3)); ctx.fillRect(x, y, 1, 1); }
      else if (q.k === 'petal') { ctx.globalAlpha = fade; var fl = Math.floor(now / 250 + q.seed) % 2; px(ctx, shade(q.col, 0.7), x, y + 1, fl ? 2 : 1, 1); px(ctx, q.col, x, y, fl ? 2 : 1, 1); ctx.globalAlpha = 1; }
      else if (q.k === 'litter') { ctx.globalAlpha = fade; px(ctx, q.col, x, y, 2, Math.floor(now / 120 + q.seed) % 2 ? 2 : 1); ctx.globalAlpha = 1; }
      else if (q.k === 'bird') { var up = Math.floor(now / 160 + q.seed) % 2 ? -1 : 1; px(ctx, q.col, x - 1, y, 3, 1); px(ctx, q.col, x - 2, y + up, 1, 1); px(ctx, q.col, x + 2, y + up, 1, 1); }
      else if (q.k === 'dust') { ctx.fillStyle = 'rgba(190,176,146,' + (0.7 * (1 - a)).toFixed(3) + ')'; ctx.fillRect(x, y, a < 0.4 ? 1 : 2, a < 0.4 ? 1 : 2); }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── the camera: it follows you with a little give instead of being
     nailed to you, and leans the way you're going (further when you run
     or sail) so you see what's coming, unless LOOK AHEAD is off in SYS. a jump (a door, a faint, a new
     map) cuts straight there. the picture is still drawn on whole pixels ── */
  var cam = { x: 0, y: 0, lx: 0, ly: 0, at: 0, world: null };
  function camera(now, ppx, ppy) {
    var dt = Math.min(0.05, (now - (cam.at || now)) / 1000), d = DIRS[me.dir];
    var ahead = me.moving && lookAhead ? (me.sail ? 2.5 : running() ? 2 : 1.2) * TS : 0, lean = 1 - Math.exp(-dt * 2.5);
    cam.at = now;
    cam.lx += (d[0] * ahead - cam.lx) * lean; cam.ly += (d[1] * ahead - cam.ly) * lean;
    var tx = ppx + cam.lx, ty = ppy + cam.ly;
    if (cam.world !== world || Math.abs(tx - cam.x) > 6 * TS || Math.abs(ty - cam.y) > 6 * TS) {
      cam.world = world; cam.lx = cam.ly = 0; cam.x = ppx; cam.y = ppy;
      return;
    }
    var k = 1 - Math.exp(-dt * 9);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  /* ── weather: the same sky for everyone, picked per six nova hours from
     the day, so it lasts a while and anyone online sees the same rain.
     the amounts on screen ease toward it, so a shower rolls in and off.
     fog only forms in the morning. s.dev.weather forces one ── */
  var WEATHER = {
    clear:   { icon: '☀', rain: 0, fog: 0, dim: 0 },
    drizzle: { icon: '🌦', rain: 0.35, fog: 0, dim: 0.04 },
    rain:    { icon: '🌧', rain: 0.8, fog: 0, dim: 0.1 },
    storm:   { icon: '⛈', rain: 1.3, fog: 0, dim: 0.18, bolts: 1 },
    fog:     { icon: '🌫', rain: 0, fog: 1, dim: 0.02 }
  };
  function weatherAt(c) {
    if (s.dev && WEATHER[s.dev.weather]) return s.dev.weather;
    var block = Math.floor(c.hour / 6), r = hash(c.day * 4 + block, 9001);
    if (r < 0.42) return 'clear';
    if (r < 0.66) return 'drizzle';
    if (r < 0.84) return 'rain';
    if (r < 0.91) return 'storm';
    return c.hour < 12 ? 'fog' : 'drizzle';
  }
  var sky = { rain: 0, fog: 0, dim: 0, at: 0, bolt: 0, splashes: [] };
  function drawWeather(now, cx, cy) {
    var W = VW * TS, Hh = VH * TS, w = WEATHER[weatherAt(novaNow())];
    var dt = Math.min(0.05, (now - (sky.at || now)) / 1000), k = sky.at ? 1 - Math.exp(-dt * 0.6) : 1;
    sky.at = now;
    sky.rain += (w.rain - sky.rain) * k; sky.fog += (w.fog - sky.fog) * k; sky.dim += (w.dim - sky.dim) * k;
    if (sky.dim > 0.005) { ctx.fillStyle = 'rgba(10,12,30,' + sky.dim.toFixed(3) + ')'; ctx.fillRect(0, 0, W, Hh); }
    /* fog: a pale wash and slow banks drifting across */
    if (sky.fog > 0.01) {
      ctx.fillStyle = 'rgba(190,196,216,' + (0.16 * sky.fog).toFixed(3) + ')'; ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = 'rgba(206,212,232,' + (0.09 * sky.fog).toFixed(3) + ')';
      for (var b = 0; b < 8; b++) {
        /* each bank a lens of 2px rows, overlapping into a soft edge */
        var bw = 70 + (b * 37) % 60, bh = 14 + (b * 13) % 12;
        var bx = ((b * 97 + now * (0.006 + b * 0.0015) - cx * 0.3) % (W + bw) + W + bw) % (W + bw) - bw;
        var by = ((b * 61 - cy * 0.3) % (Hh + 30) + Hh + 30) % (Hh + 30) - 15;
        for (var row = 0; row < bh; row += 2) {
          var e2 = (row - bh / 2) / (bh / 2), rw = Math.round(bw * Math.sqrt(Math.max(0, 1 - e2 * e2)));
          ctx.fillRect(Math.round(bx + (bw - rw) / 2), Math.round(by) + row, rw, 2);
          ctx.fillRect(Math.round(bx + (bw - rw * 0.6) / 2), Math.round(by) + row, Math.round(rw * 0.6), 2);
        }
      }
    }
    /* rain: more drops, longer and more slanted the harder it comes down */
    if (sky.rain > 0.02) {
      var drops = Math.round(VW * VH / 6 * sky.rain), slant = 0.1 + sky.rain * 0.3, len = 2 + Math.round(sky.rain * 3);
      ctx.fillStyle = 'rgba(159,140,255,' + (0.22 + 0.12 * Math.min(1, sky.rain)).toFixed(3) + ')';
      for (var r = 0; r < drops; r++) {
        var fall = 0.3 + (r % 5) * 0.03, ry = (r * 37 + now * fall) % Hh, rx = ((r * 53 + now * fall * slant) % W + W) % W;
        for (var j = 0; j < len; j++) ctx.fillRect(Math.floor(rx + j * slant), Math.floor(ry + j), 1, 1);
      }
      /* splashes where it lands, held in world pixels so they stay put */
      var n = sky.rain * 45 * dt;
      while (n > 0 && sky.splashes.length < 60) {
        if (n < 1 && Math.random() > n) break;
        sky.splashes.push({ x: cx + Math.random() * W, y: cy + Math.random() * Hh, t0: now }); n--;
      }
    }
    sky.splashes = sky.splashes.filter(function (q) { return now - q.t0 < 240; });
    ctx.fillStyle = 'rgba(190,180,255,.45)';
    sky.splashes.forEach(function (q) {
      var x = Math.round(q.x - cx), y = Math.round(q.y - cy);
      if (now - q.t0 < 110) ctx.fillRect(x, y, 1, 1);
      else { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
    });
    /* a storm throws lightning: a flash, a gap, a smaller flash */
    if (w.bolts && !sky.bolt && Math.random() < dt * 0.15) sky.bolt = now;
    if (sky.bolt) {
      var e = now - sky.bolt, fl = e < 70 ? 0.55 : e < 140 ? 0 : e < 230 ? 0.35 : e < 600 ? 0.35 * (1 - (e - 230) / 370) : -1;
      if (fl < 0) sky.bolt = 0;
      else if (fl > 0) { ctx.fillStyle = 'rgba(230,234,255,' + fl.toFixed(3) + ')'; ctx.fillRect(0, 0, W, Hh); }
    }
  }

  /* ── a little bubble over whatever you're facing that A would use:
     dots for someone to talk to, an A for a thing ── */
  function usable(tx, ty) {
    if (npcs.some(function (n) { return n.x === tx && n.y === ty; })) return 'talk';
    if (L && (!inside || inside.place) && L.list().some(function (o) { return o.x === tx && o.y === ty; })) return 'talk';
    if (world.signs.some(function (sg) { return sg.x === tx && sg.y === ty; })) return 'use';
    var m = markAt(tx, ty);
    if (m && (m.shop || m.store || m.home || (m.room && !inside) || m.game || m.vend || m.fire || m.fountain || m.shut || m.text
      || (inside && (m.kitchen || m.chest)))) return 'use';
    return '';
  }
  var GLYPH_A = ['.#.', '#.#', '###', '#.#'];
  function drawPrompt(now, cx, cy) {
    if (me.moving || talkBox || phone || mini || counter || table || fainting) return;
    var d = DIRS[me.dir], tx = me.x + d[0], ty = me.y + d[1], what = usable(tx, ty);
    if (!what) return;
    var bx = tx * TS - cx + 4, by = ty * TS - cy - 12 - (Math.floor(now / 400) % 2);
    px(ctx, OUT, bx, by, 9, 8); px(ctx, '#f4f6ff', bx + 1, by + 1, 7, 6);
    px(ctx, OUT, bx + 3, by + 8, 3, 1); px(ctx, '#f4f6ff', bx + 4, by + 7, 1, 1);
    if (what === 'talk') { px(ctx, OUT, bx + 2, by + 4, 1, 1); px(ctx, OUT, bx + 4, by + 4, 1, 1); px(ctx, OUT, bx + 6, by + 4, 1, 1); }
    else GLYPH_A.forEach(function (r, yy) { for (var xx = 0; xx < 3; xx++) if (r.charAt(xx) === '#') px(ctx, OUT, bx + 3 + xx, by + 2 + yy, 1, 1); });
  }

  /* which frame: a foot at a time while walking, a slow breath standing */
  function walkFrame(moving, t, foot) { return moving && t > 0.25 && t < 0.75 ? (foot ? 1 : 2) : 0; }
  function idleFrame(now, seed) { return (now + seed * 397) % 2600 < 420 ? 3 : 0; }

  function draw(now) {
    var wave = Math.floor(now / 380) % 4;
    var ppx = (me.moving ? me.fx + (me.x - me.fx) * me.t : me.x) * TS, ppy = (me.moving ? me.fy + (me.y - me.fy) * me.t : me.y) * TS;
    /* a room smaller than the screen sits in the middle of it, in the dark */
    camera(now, ppx, ppy);
    var cx = world.W <= VW ? -Math.floor((VW - world.W) * TS / 2) : Math.round(Math.max(0, Math.min(world.W * TS - VW * TS, cam.x - (VW * TS) / 2 + TS / 2)));
    var cy = world.H <= VH ? -Math.floor((VH - world.H) * TS / 2) : Math.round(Math.max(0, Math.min(world.H * TS - VH * TS, cam.y - (VH * TS) / 2 + TS / 2)));
    if (now < shake.until) { cx += Math.round((Math.random() * 2 - 1) * shake.amp); cy += Math.round((Math.random() * 2 - 1) * shake.amp); }
    lastCam = [cx, cy];
    if (inside) { ctx.fillStyle = '#05060b'; ctx.fillRect(0, 0, VW * TS, VH * TS); }
    var x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS)), x, y;
    function at(xx, yy) { return xx < 0 || yy < 0 || xx >= world.W || yy >= world.H ? T.DEEP : world.tile[yy * world.W + xx]; }
    function wet(tt) { return tt === T.DEEP || tt === T.SHALLOW; }
    for (y = y0; y <= y0 + VH; y++) for (x = x0; x <= x0 + VW; x++) {
      if (x >= world.W || y >= world.H) continue;
      var k = y * world.W + x, t = world.tile[k], di = world.dist[k];
      if (t === T.LANDMARK) { if (!inside && !deco.under[k]) continue; t = inside ? (y ? world.floor || T.FLOOR : world.edge || T.WALL) : T.GROUND; }
      var v = Math.floor(hash(x, y) * 32), m = 0, rv = 0, dr = 0;
      var nb = [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)];
      for (var b = 0; b < 4; b++) {
        var o = nb[b], hit;
        if (t === T.BUILDING) hit = o === T.BUILDING;
        else if (t === T.ROAD) hit = o === T.ROAD || o === T.BRIDGE;
        else if (t === T.GRASS) hit = !inside && o !== T.GRASS && o !== T.TREE && !wet(o) && o !== T.DEEP;
        else if (wet(t)) hit = !wet(o) && o !== T.BRIDGE;
        else if (t === T.BRIDGE) hit = wet(o);
        else if (t === T.SAND) hit = wet(o);
        if (hit) m |= 1 << b;
      }
      if (t === T.BUILDING || t === T.ROAD || t === T.GRASS) {
        var same = t === T.GRASS ? 0 : 1, dg = [at(x + 1, y - 1), at(x + 1, y + 1), at(x - 1, y + 1), at(x - 1, y - 1)];
        for (var c = 0; c < 4; c++) {
          if (((m >> c) & 1) !== same || ((m >> ((c + 1) % 4)) & 1) !== same) continue;
          var od = dg[c], dHit = t === T.BUILDING ? od !== T.BUILDING : t === T.ROAD ? od !== T.ROAD && od !== T.BRIDGE
            : od !== T.GRASS && od !== T.TREE && !wet(od) && od !== T.DEEP;
          if (dHit) m |= 16 << c;
        }
      }
      /* the wide roads: a centre line between the lanes, a zebra crossing
         where a road meets a junction */
      if (t === T.ROAD && di >= 0) m |=laneMarks(x, y, at) | (hash(x * 5 + 1, y * 3) > 0.25 ? 16384 : 0);
      if (t === T.BUILDING) {
        rv = deco.roof[k]; dr = deco.door[k];
        if (storey(x, y)) m = (m & 15) | 256;
        else if (y > 0 && !(m & 4) && storey(x, y - 1)) m |= 512;
      }
      else if (t !== T.STALL && t !== T.ROAD && t !== T.GROUND && t !== T.SAND && t !== T.MAINLAND) v &= 7;
      var w = wet(t) ? wave : 0;
      var key = t + '.' + di + '.' + v + '.' + m + '.' + w + '.' + rv + dr;
      ctx.drawImage(tileCanvas(key, function (g) { drawTile(g, t, di, v, m, w, rv, dr); }), x * TS - cx, y * TS - cy);
    }
    if (!inside) shores(x0, y0, cx, cy, at, wet);
    var sunUp = inside ? SHADE * 0.6 : SHADE * (1 - darkness(novaNow())), sl = inside ? 1 : shadowLen(novaNow());
    SH_X = Math.round(4 * sl); SH_Y = Math.round(3 * sl);
    shadows(x0, y0, cx, cy, at, sunUp);
    world.marks.forEach(function (m) {
      if (m.x * TS - cx > VW * TS || (m.x + m.w) * TS - cx < 0 || m.y * TS - cy > VH * TS || (m.y + m.h) * TS - cy < 0) return;
      ctx.drawImage(markCanvas(m), m.x * TS - cx, m.y * TS - cy);
    });
    world.signs.forEach(function (sg) {
      var sx = sg.x * TS - cx, sy = sg.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      px(ctx, 'rgba(0,0,0,' + (SHADE * (1 - darkness(novaNow()))).toFixed(3) + ')', sx + 2 + SH_X, sy + 2 + SH_Y, 12, 8);
      px(ctx, OUT, sx + 6, sy + 8, 4, 8); px(ctx, '#5a3a22', sx + 7, sy + 9, 2, 6);
      px(ctx, OUT, sx + 2, sy + 2, 12, 8); px(ctx, '#c8a878', sx + 3, sy + 3, 10, 6);
      px(ctx, '#8a6a48', sx + 4, sy + 5, 8, 1); px(ctx, '#8a6a48', sx + 4, sy + 7, 6, 1);
    });
    if (!inside) { drawLamps(cx, cy); drawLoose(cx, cy, now); drawPiles(cx, cy, now); }
    /* the boat's wake: pairs of foam flecks spreading and fading */
    wakes = wakes.filter(function (k) { return now - k.t0 < 1100; });
    wakes.forEach(function (k) {
      var a = (now - k.t0) / 1100, sp = 1 + a * 6, ox = k.d[1] * sp, oy = k.d[0] * sp;
      ctx.fillStyle = 'rgba(216,240,255,' + (0.7 * (1 - a)).toFixed(3) + ')';
      ctx.fillRect(Math.round(k.x - cx + ox), Math.round(k.y - cy + oy), 2, 1);
      ctx.fillRect(Math.round(k.x - cx - ox) - 1, Math.round(k.y - cy - oy), 2, 1);
    });
    if (!inside) drawBodies(cx, cy, now);
    /* people, back to front */
    var who = npcs.map(function (n) {
      var nx = (n.moving ? n.fx + (n.x - n.fx) * n.t : n.x) * TS, ny = (n.moving ? n.fy + (n.y - n.fy) * n.t : n.y) * TS;
      return { x: nx, y: ny, img: sprite(n.look === 'gen' ? crowdLook(n) : LOOKS[n.look] || LOOKS.local, n.dir, n.moving ? walkFrame(true, n.t, n.step) : idleFrame(now, n.hx * 7 + n.hy)) };
    });
    mobs.forEach(function (m) {
      var mx = (m.moving ? m.fx + (m.x - m.fx) * m.t : m.x) * TS, my = (m.moving ? m.fy + (m.y - m.fy) * m.t : m.y) * TS;
      if (now < m.lunge) { var ld = DIRS[m.dir]; mx += ld[0] * 3; my += ld[1] * 3; }
      who.push({ x: mx, y: my, img: sprite(m.look, m.dir, walkFrame(m.moving, m.t, m.step)), mob: m });
    });
    /* trees, so you walk behind a canopy and in front of a trunk */
    for (y = y0; y <= y0 + VH + 1 && y < world.H; y++) for (x = Math.max(0, x0 - 1); x <= x0 + VW + 1 && x < world.W; x++) {
      var tk = y * world.W + x;
      if (world.tile[tk] !== T.TREE) continue;
      var th = hash(x + 101, y + 57), tv = Math.floor(th * 40);
      who.push({ x: x * TS + ((tv >> 3) % 3) - 1, y: y * TS - 0.5, tree: treeCanvas(world.dist[tk], tv % 5 + 5 * ((tv >> 2) & 1)) });
    }
    who.push({ x: ppx, y: ppy, img: sprite(playerLook(), me.dir, me.sail ? 0 : me.moving ? walkFrame(true, me.t, me.step) : idleFrame(now, 0)), me: 1, boat: me.sail });
    if (L && (!inside || inside.place)) L.list().forEach(function (o) {
      var ox = (o.t < 1 ? o.fx + (o.x - o.fx) * o.t : o.x) * TS, oy = (o.t < 1 ? o.fy + (o.y - o.fy) * o.t : o.y) * TS;
      if (ox - cx < -TS || oy - cy < -TS || ox - cx > VW * TS || oy - cy > VH * TS) return;
      who.push({ x: ox, y: oy, img: sprite(lookOf(o.look), o.dir, o.boat ? 0 : o.t < 1 ? walkFrame(true, o.t, (o.x + o.y) & 1) : idleFrame(now, o.x * 3 + o.y)), them: 1, boat: o.boat });
    });
    who.sort(function (a, b) { return a.y - b.y; });
    who.forEach(function (p) {
      if (p.tree) { ctx.drawImage(p.tree, Math.round(p.x - cx) - 2, Math.round(p.y + 0.5 - cy) + TS - TREE_H + 1); return; }
      var bob = p.boat ? Math.floor(now / 450) % 2 : 0;
      if (!p.boat) {
        /* a small oval under the feet */
        var fx = Math.round(p.x - cx), fy = Math.round(p.y - cy);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(fx + 5, fy + 13, 6, 1); ctx.fillRect(fx + 4, fy + 14, 8, 1); ctx.fillRect(fx + 5, fy + 15, 6, 1);
      }
      if (p.mob && now < p.mob.flash) { ctx.drawImage(whiteOf(p.img), Math.round(p.x - cx), Math.round(p.y - cy) - 2); return; }
      if (p.mob && now < p.mob.hurt && Math.floor(now / 60) % 2) ctx.globalAlpha = 0.35;
      ctx.drawImage(p.img, Math.round(p.x - cx), Math.round(p.y - cy) - 2 - (p.boat ? 3 : 0) + bob);
      ctx.globalAlpha = 1;
      if (p.boat) ctx.drawImage(hull(), Math.round(p.x - cx), Math.round(p.y - cy) + bob);
      /* a real person: a little violet pip over their head */
      if (p.them) { px(ctx, OUT, Math.round(p.x - cx) + 6, Math.round(p.y - cy) - 7, 4, 4); px(ctx, '#b9a8ff', Math.round(p.x - cx) + 7, Math.round(p.y - cy) - 6, 2, 2); }
    });
    /* fishing: a line out to a bobber on the water in front, a '!' on a bite */
    if (mini && mini.fish && !mini.end) {
      var fd = DIRS[me.dir], bx = (me.x + fd[0]) * TS - cx + 7, by = (me.y + fd[1]) * TS - cy + 8, g = mini.g;
      var dip = g.phase === 'bite' ? 2 : g.phase === 'reel' ? Math.floor(now / 120) % 2 : Math.floor(now / 700) % 2 ? 1 : 0;
      ctx.strokeStyle = 'rgba(220,227,255,.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(ppx - cx) + 8.5, Math.round(ppy - cy) + 6.5); ctx.lineTo(bx + 1.5, by + dip + 0.5); ctx.stroke();
      px(ctx, OUT, bx - 1, by - 1 + dip, 5, 5); px(ctx, '#ff4f5e', bx, by + dip, 3, 2); px(ctx, '#f4f6ff', bx, by + 2 + dip, 3, 1);
      if (g.phase === 'bite') { var hx = Math.round(ppx - cx) + 6, hy = Math.round(ppy - cy) - 12; px(ctx, OUT, hx - 1, hy - 1, 5, 10); px(ctx, '#ffe97c', hx, hy, 3, 5); px(ctx, '#ffe97c', hx, hy + 6, 3, 2); }
    }
    /* the hour's light over everything (night lets the city's lights
       through), and the rain the main page has */
    if (inside) { ctx.fillStyle = 'rgba(5,6,11,.1)'; ctx.fillRect(0, 0, VW * TS, VH * TS); return; }
    ambient(now, cx, cy, x0, y0, ppx, ppy);
    drawAmbient(now, cx, cy, false);
    var nc = novaNow(), dk = darkness(nc);
    ctx.fillStyle = skyTint(nc); ctx.fillRect(0, 0, VW * TS, VH * TS);
    if (dk > 0) night(dk, cx, cy, now, ppx, ppy);
    drawAmbient(now, cx, cy, true);
    drawPrompt(now, cx, cy);
    drawFight(cx, cy, now, ppx, ppy);
    drawAir(cx, cy, now);
    drawWeather(now, cx, cy);
  }

  function loop(now) {
    if (!active) return;
    update(now); draw(now); drawWipe(now);
    frame++;
    if (frame % 120 === 0 && api && api.save) api.save();
    raf = requestAnimationFrame(loop);
  }

  /* ── input ───────────────────────────────────────────────── */
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
               W: 'up', S: 'down', A: 'left', D: 'right', x: 'b', X: 'b', Shift: 'b' };
  function onKey(e, down) {
    if (!active) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.key === 'm' || e.key === 'M') && phone) { if (down && !e.repeat) toggleBig(); e.preventDefault(); return; }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); held.a = down; if (down && !e.repeat) pressedA = true; return; }
    var k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    if (k === 'b' && !(down && e.repeat)) bEdge(down);
    held[k] = down;
  }
  document.addEventListener('keydown', function (e) { onKey(e, true); });
  document.addEventListener('keyup', function (e) { onKey(e, false); });
  window.addEventListener('blur', function () { held = {}; });

  /* the on-screen pad: hold a direction, tap A, hold B */
  /* the counter's buttons, for touch */
  function counterButtons() {
    $('wCounterX').addEventListener('click', function () { if (counter) closeCounter(); });
    [].forEach.call($('wCounterTabs').children, function (b) {
      b.addEventListener('click', function () { if (!counter) return; counter.tab = b.getAttribute('data-tab'); counter.sel = 0; drawCounter(); });
    });
  }
  function pad() {
    [].forEach.call(document.querySelectorAll('#wPad [data-k]'), function (b) {
      var k = b.getAttribute('data-k');
      function on(e) { e.preventDefault(); if (k === 'a') pressedA = true; if (k === 'b') bEdge(true); held[k] = true; b.classList.add('down'); }
      function off(e) { if (e) e.preventDefault(); if (k === 'b' && held.b) bEdge(false); held[k] = false; b.classList.remove('down'); }
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* every game pixel is a whole number of screen pixels, or the art goes
     uneven. so the scale is picked first (about twelve tiles across, like
     the old handhelds' ten), then as many tiles as fit at that scale */
  function fit() {
    var scr = canvas.parentNode, main = $('world'), dpr = window.devicePixelRatio || 1;
    var availW = Math.min(main.clientWidth - 16, 1100);
    var top = scr.getBoundingClientRect().top, padH = $('wPad').offsetHeight;
    var availH = Math.max(160, window.innerHeight - Math.max(0, top) - (padH ? padH + 40 : 40));
    var dw = availW * dpr, dh = availH * dpr;
    var sc = Math.max(1, Math.floor(dw / (TS * 12)));
    while (sc > 1 && Math.floor(dh / (TS * sc)) < 8) sc--;
    VW = Math.max(10, Math.min(24, Math.floor(dw / (TS * sc))));
    VH = Math.max(7, Math.min(Math.floor(dh / (TS * sc)), Math.round(VW * 0.75)));
    if (canvas.width !== VW * TS || canvas.height !== VH * TS) { canvas.width = VW * TS; canvas.height = VH * TS; }
    ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    var cw = VW * TS * sc / dpr, ch = VH * TS * sc / dpr;
    scr.style.width = cw + 'px'; scr.style.height = ch + 'px';
    scr.setAttribute('data-scale', sc);
  }

  /* ── what ui.js calls ────────────────────────────────────── */
  function show(state, hooks) {
    s = state; api = hooks || {};
    if (!world) {
      world = city = M.build();
      deco = cityDeco = decorate(world);
      canvas = $('wCanvas');
      fit();
      window.addEventListener('resize', function () { if (active) fit(); });
      npcs = cityNpcs = world.npcs.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.hx = n.x; c.hy = n.y; c.moving = false; c.t = 0; c.step = 0; return c; });
      pad();
      counterButtons();
      tableButtons();
      $('wAlert').addEventListener('click', function (e) { e.preventDefault(); openVitals(); });
    }
    var at = s.world;
    if (!s.homes) s.homes = {};
    /* hex's key, for anyone who finished her chapter before she handed it out */
    var gift = s.met.hex && !s.flags['hex-key'] && !s.flags['hex-closed'];
    if (gift) { s.homes.redrum = 1; s.flags['hex-key'] = 1; }
    if (inside) { world = city; deco = cityDeco; npcs = cityNpcs; inside = null; }
    var wake = s.wake && s.homes[s.wake] ? doorOf(s.wake) : null;
    me.sail = false;
    /* back where they stood, unless something is standing there now; else
       outside the apartment they last slept in; else the spawn */
    if (at && at.x >= 0 && at.v === M.V && at.in && canBeIn(at.in)) { var dd = doorOf(at.in); me.x = dd.x; me.y = dd.y; me.dir = 'down'; }
    else if (at && at.x >= 0 && at.v === M.V && !at.in && !M.solid(world, at.x, at.y) && !npcs.some(function (n) { return n.x === at.x && n.y === at.y; })) { me.x = at.x; me.y = at.y; me.dir = at.d || 'down'; }
    else if (at && at.v === M.V && at.sail && s.boat && M.water(world, at.x, at.y)) { me.x = at.x; me.y = at.y; me.dir = at.d || 'down'; me.sail = true; }
    else if (wake) { me.x = wake.x; me.y = wake.y; me.dir = 'down'; }
    else { me.x = world.spawn.x; me.y = world.spawn.y; me.dir = world.spawn.dir; }
    me.moving = false; held = {}; talkBox = null; $('wTalk').hidden = true;
    s.world = here();
    $('world').hidden = false;
    fit();
    district = -3; enterDistrict(world.dist[me.y * world.W + me.x]);
    wallet();
    drawBody();
    goOnline();
    /* they saved indoors: back inside, where they stood if it still makes sense */
    if (at && at.in && canBeIn(at.in) && at.v === M.V) {
      var r = M.room(at.in), ok = r && at.x > 0 && at.y > 0 && at.x < r.W && at.y < r.H && !M.solid(r, at.x, at.y) && r.tile[at.y * r.W + at.x] !== T.MAT;
      goIn(at.in, ok ? at : null);
    }
    var j0 = window.MFLaw && window.MFLaw.jailed(s, Date.now());
    if (j0 && (!inside || inside.id !== j0.room)) { var jw0 = j0.room === 'lockup' ? 'redrum' : 'city'; goIn(j0.room, { x: window.MFLaw.JAILS[jw0].cell.x, y: window.MFLaw.JAILS[jw0].cell.y, d: 'down' }); }
    if (gift) setTimeout(function () { if (active && !talkBox) say(["there's a key in your pocket you don't remember taking.\nthe tag says, in eyeliner: walk-up, round the back of the arcade. -H"]); }, 1200);
    else nudge();
    if (!active) { active = true; last = 0; raf = requestAnimationFrame(loop); }
    try { $('world').focus(); } catch (e) {}
  }
  /* once there is something to lose, remind them it only lives here: after
     meeting hex if they never backed up, then if the last backup is a week old */
  var nudged = false;
  function nudge() {
    if (nudged || !s.met.hex) return;
    var at = 0;
    try { at = +(localStorage.getItem('exiled.backupAt') || 0); } catch (e) { return; }
    if (at && Date.now() - at < 7 * 86400000) return;
    nudged = true;
    setTimeout(function () {
      if (!active || talkBox) return;
      say(['your run only lives in this browser. clear the site data and it is gone.\nback it up: phone, SYS, SAVE.']);
    }, 3200);
  }
  /* ── the shared streets (lobby.js) ───────────────────────── */
  function offline() { try { return localStorage.getItem('exiled.t2d.offline') === '1'; } catch (e) { return false; } }
  function goOnline() {
    if (!L) return;
    if (offline() || document.hidden) { L.stop(); return; }
    if (L.on) { L.restyle(A ? A.normalize(s.player.look) : s.player.look); return; }
    L.start({ handle: s.player.handle, look: A ? A.normalize(s.player.look) : s.player.look, x: me.x, y: me.y, d: me.dir }, lobbyRoom());
  }
  var onShown = -1, onT = 0;
  function online(now) {
    if (now - onT < 500) return;
    onT = now;
    var n = L.on && L.live && (!inside || inside.place) ? L.list().length : -1;
    if (n === onShown) return;
    onShown = n;
    var el = $('wOn');
    el.hidden = n < 0;
    el.textContent = n === 0 ? 'just you here' : n === 1 ? '1 other here' : n + ' others here';
  }
  /* a hidden tab doesn't hold a seat in the street */
  document.addEventListener('visibilitychange', function () { if (active) goOnline(); });
  function setOffline(off) {
    try { if (off) localStorage.setItem('exiled.t2d.offline', '1'); else localStorage.removeItem('exiled.t2d.offline'); } catch (e) {}
    if (active) goOnline();
  }
  function hide() {
    if (L) L.stop();
    active = false; cancelAnimationFrame(raf); held = {};
    $('world').hidden = true;
  }
  /* Chippin' In shows the walking sprite as it is built */
  function preview(look, dir, step) {
    var big = document.createElement('canvas'); big.width = big.height = TS;
    var g = big.getContext('2d'); g.drawImage(sprite(lookOf(look), dir, step), 0, 0);
    return big;
  }
  /* after the DEV drawer changes the run: redraw the money and the meters */
  function refresh() { if (!active) return; wallet(); drawBody(); }
  /* the boat's hold, from INV, while you're out on it */
  function openHold() { if (active && me.sail) openCounter('stash:hold'); }
  window.MFWorld = { show: show, hide: hide, preview: preview, openPhone: openPhone, devFoe: devFoe, devLaw: devLaw, get foes() { return mobs.map(function (m) { return { name: m.f.name, id: m.f.id, hp: m.f.hp, max: m.f.max, level: m.f.level, x: m.x, y: m.y, civ: !!m.civ, foe: !!m.foe, law: m.law || '', armed: !!m.f.armed, leaving: !!m.leaving }; }); }, get lawSees() { return lawSees(); }, get helis() { return helis.map(function (h) { return { kind: h.kind, leaving: !!h.leaving, sees: heliSees(h) }; }); }, get charges() { return charges.length; }, get bodies() { return bodies.map(function (b) { return { x: b.x, y: b.y, dead: b.dead, kind: b.n.kind }; }); }, get crowd() { return cityNpcs ? cityNpcs.filter(function (n) { return window.MFLaw && window.MFLaw.attackable(n); }).map(function (n) { return { x: n.x, y: n.y, kind: n.kind, run: !!n.run }; }) : []; }, setOffline: setOffline, refresh: refresh, openHold: openHold, get sailing() { return active && me.sail; }, get offline() { return offline(); }, get active() { return active; } };
})();
