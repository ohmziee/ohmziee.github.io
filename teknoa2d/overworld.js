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
    majinryu:  { ground: '#2a1e22', road: '#3a2c30', line: '#5a3a3a', roof: '#7a2020', roof2: '#a83030', wall: '#2a2a30', glow: ['#ff6a3a', '#ffd36a', '#7cffb2', '#ff4f6a'], tree: '#2a3a2a', leaf: '#6aa060', grass: '#24302a' },
    redrum:    { ground: '#2a1014', road: '#3a161c', line: '#5a1a24', roof: '#3a1218', roof2: '#4a1820', wall: '#1a080c', glow: ['#ff2a4a', '#ff4fd8', '#ff6a3a', '#ff2a4a'], tree: '#2a1a1a', leaf: '#6a2a2a', grass: '#2a1418' },
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
     water. */
  var OUT = '#0b0d1a';
  function drawTile(g, t, di, v, m, wave, rv, door) {
    var p = pal(di), i;
    var N = m & 1, E = m & 2, S = m & 4, Wd = m & 8;
    if (t === T.DEEP || t === T.SHALLOW) {
      var deep = t === T.DEEP, crest = deep ? '#1d4378' : '#2f69a0';
      px(g, deep ? '#0a1834' : '#123563', 0, 0, TS, TS);
      /* two crests in a fixed pattern, rocking a pixel with the tide */
      var o = wave ? 1 : 0;
      px(g, crest, 2 + o, 4, 3, 1); px(g, crest, 5 + o, 3, 2, 1);
      if (v & 1) { px(g, crest, 9 - o, 11, 3, 1); px(g, crest, 12 - o, 10, 2, 1); }
      /* foam where it meets land */
      var foam = '#6fb4e0';
      if (N) px(g, foam, 0, 0, TS, 1); if (S) px(g, foam, 0, 15, TS, 1);
      if (E) px(g, foam, 15, 0, 1, TS); if (Wd) px(g, foam, 0, 0, 1, TS);
      return;
    }
    if (t === T.MAINLAND) {
      /* vistadelsol's bush: too thick to walk through, palms poking out */
      px(g, '#14301c', 0, 0, TS, TS);
      [[1, 1, 6], [8, 4, 7], [2, 9, 6], [10, 11, 5]].forEach(function (c, j) {
        if ((v >> j) & 1 && j > 1) return;
        px(g, OUT, c[0], c[1], c[2], c[2] - 1); px(g, j % 2 ? '#1f5a2e' : '#2a6a34', c[0] + 1, c[1] + 1, c[2] - 2, c[2] - 3);
        px(g, '#7cd06a', c[0] + 1, c[1] + 1, 2, 1);
      });
      return;
    }
    if (t === T.SAND) {
      px(g, '#76664a', 0, 0, TS, TS);
      var dots = v & 1 ? [[3, 3], [11, 6], [6, 12]] : [[12, 2], [4, 9], [10, 13]];
      dots.forEach(function (d) { px(g, '#8f7c5a', d[0], d[1], 2, 1); });
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
      if (rk === 3 && all4) {
        /* a manhole cover */
        px(g, OUT, 5, 4, 6, 8); px(g, OUT, 4, 5, 8, 6); px(g, rDk, 5, 5, 6, 6);
        px(g, rLt, 6, 6, 4, 1); px(g, rLt, 6, 8, 4, 1); px(g, rLt, 6, 10, 4, 1);
      } else if (rk === 7 || rk === 12) {
        /* a crack */
        px(g, rDk, 3, 9, 3, 1); px(g, rDk, 6, 8, 2, 1); px(g, rDk, 8, 9, 1, 2); px(g, rDk, 9, 11, 3, 1);
      } else if ((rk === 5 || rk === 14) && all4) {
        /* a puddle with the neon in it */
        var pud = shade(p.road, 0.6), glint = p.glow[v % p.glow.length];
        px(g, pud, 4, 8, 8, 3); px(g, pud, 3, 9, 10, 1); px(g, glint, 6, 9, 3, 1); px(g, shade(glint, 0.6), 9, 9, 2, 1);
      }
      /* lane dashes down the middle of a single-lane street */
      if (!N && !S) { px(g, shade(p.line, 1.3), 1, 7, 5, 1); px(g, shade(p.line, 1.3), 9, 7, 5, 1); }
      else if (!E && !Wd) { px(g, shade(p.line, 1.3), 7, 1, 1, 5); px(g, shade(p.line, 1.3), 7, 9, 1, 5); }
      /* a raised kerb wherever the road stops: lit on top, shadowed below */
      if (!N) { px(g, kLt, 0, 0, TS, 1); px(g, p.line, 0, 1, TS, 1); px(g, rDk, 0, 2, TS, 1); }
      if (!S) { px(g, rDk, 0, 13, TS, 1); px(g, p.line, 0, 14, TS, 1); px(g, kDk, 0, 15, TS, 1); }
      if (!E) { px(g, rDk, 13, 0, 1, TS); px(g, p.line, 14, 0, 1, TS); px(g, kDk, 15, 0, 1, TS); }
      if (!Wd) { px(g, kLt, 0, 0, 1, TS); px(g, p.line, 1, 0, 1, TS); px(g, rDk, 2, 0, 1, TS); }
      return;
    }
    if (t === T.GRASS) {
      px(g, p.grass, 0, 0, TS, TS);
      /* a shadow line wherever the grass gives way */
      var gEdge = shade(p.grass, 0.65);
      if (N) px(g, gEdge, 0, 0, TS, 1); if (S) px(g, gEdge, 0, 15, TS, 1);
      if (E) px(g, gEdge, 15, 0, 1, TS); if (Wd) px(g, gEdge, 0, 0, 1, TS);
      /* tufts: little ^^ pairs on a grid, the way the old games did it */
      (v & 1 ? [[2, 3], [10, 10]] : [[10, 2], [3, 10]]).forEach(function (c) {
        px(g, p.leaf, c[0], c[1] + 1); px(g, p.leaf, c[0] + 1, c[1]); px(g, p.leaf, c[0] + 2, c[1] + 1);
        px(g, p.leaf, c[0] + 3, c[1] + 1); px(g, p.leaf, c[0] + 4, c[1]); px(g, p.leaf, c[0] + 5, c[1] + 1);
      });
      return;
    }
    if (t === T.TREE) {
      px(g, p.grass, 0, 0, TS, TS);
      /* a round canopy: outline, lit from the top left, a trunk under it */
      var lit = shade(p.tree, 1.45), dark = shade(p.tree, 0.7);
      px(g, OUT, 6, 11, 4, 5); px(g, '#5a3a22', 7, 11, 2, 4);
      for (var yy = 0; yy < 13; yy++) for (var xx = 0; xx < TS; xx++) {
        var dx = xx - 7.5, dy = yy - 6.2, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 7.2) continue;
        px(g, d > 6.2 ? OUT : dx + dy < -4 ? lit : dx + dy > 3 ? dark : p.tree, xx, yy);
      }
      px(g, p.leaf, 4, 3, 2, 1); px(g, p.leaf, 3, 4, 1, 1); px(g, p.leaf, 9, 7, 1, 1);
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
        return;
      }
      /* the front: eave shadow, windows in frames, maybe the door */
      px(g, p.wall, 0, 0, TS, TS);
      if (!N) { px(g, OUT, 0, 0, TS, 1); px(g, roof, 0, 1, TS, 2); }
      px(g, rDark, 0, N ? 0 : 3, TS, 2);
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
  function sprite(look, dir, step) {
    var key = JSON.stringify(look) + dir + step;
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var g = c.getContext('2d'), flip = dir === 'right', rows = BODY[flip ? 'left' : dir].slice();
    if (step) { var st = STEP[flip ? 'left' : dir]; rows[13] = st[0]; rows[14] = st[1]; rows[15] = st[2]; }
    rows = styled(rows, flip ? 'left' : dir, look);
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
  function showLine() {
    $('wWho').textContent = talkBox.who;
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
      if (!me.sail && rod && s.boat) return ask(['the water\'s right there.'], function () { cast(tx, ty, rod); }, function () { me.sail = true; step(tx, ty, me.dir); }, 'A: cast a line    B: set sail');
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
    var short = SH.boatShort(MF, s), need = SH.BOAT.need, res = s.res || {};
    var list = Object.keys(need).map(function (k) { return SH.RES[k].name + ' ' + (res[k] || 0) + '/' + need[k]; }).join('\n') + '\n' + MF.fmtJ(MF.joules(s)) + ' of ' + MF.fmtJ(SH.BOAT.joules);
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
  /* the scrapper on redrum's slip: a skiff out of scrap, or one for cash.
     the only way off the island. PLACEHOLDER lines */
  function scrapper() {
    var SH = window.MFShops, MF = window.MF, B = SH.BOATS.slip, have = (s.res || {}).scrap || 0;
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
    if (!build && !buy) return say([pitch, terms, mine, 'scrap\'s lying about all over redrum.\nthe pawn shop pays for it too, if you need joules more.'], 'SCRAPPER');
    if (build) return ask([pitch, terms, mine + '\nbuild it?'], function () { if (SH.buildBoat(MF, s, 'slip').ok) done(B.joules, true); }, buy ? function () { if (SH.buyBoat(MF, s, 'slip').ok) done(B.buy); } : null, buy ? 'A: build it    B: just buy one' : null);
    ask([pitch, terms, mine + '\nbuy one?'], function () { if (SH.buyBoat(MF, s, 'slip').ok) done(B.buy); });
  }
  /* the crowd: their district's pool, in their own order, and now and then
     something about you, if there's something to say (world.js TALK) */
  /* what someone of this kind says about where you come from, if they can
     tell and have something to say (world.js ORIGIN_TALK) */
  function reaction(kind, seed, said) {
    var by = M.ORIGIN_TALK[kind], lines = by && by[window.MF.knownOrigin(s, window.MFAvatar)];
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
  function goIn(id, at) {
    var r = M.room(id);
    if (!r) return;
    inside = { id: id, place: !!r.place };
    world = r; deco = decorate(r);
    npcs = r.npcs.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.hx = n.x; c.hy = n.y; c.step = 0; return c; });
    me.x = at ? at.x : r.spawn.x; me.y = at ? at.y : r.spawn.y; me.dir = at ? at.d || 'up' : r.spawn.dir;
    me.moving = false; held = {};
    /* an apartment is private: off the street's channel until they come back out */
    if (L) { L.setRoom(lobbyRoom()); L.moved(me.x, me.y, me.dir); }
    s.world = here();
    if (api.save) api.save();
    if (charging() && s.body.food < 95 && !talkBox) say(['you find a socket and plug in.\ncharging. stay a minute.']);
  }
  function goOut() {
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

  var LIGHT = { night: 'rgba(4,6,24,.42)', dawn: 'rgba(60,24,40,.18)', day: 'rgba(5,6,11,.04)', dusk: 'rgba(48,20,60,.22)' };

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
    $('wTime').textContent = c.text + ' · ' + tempNow() + '°C';
    $('wBuff').textContent = b.buff && b.buffT > 0 ? b.buff + ' ' + Math.ceil(b.buffT / 60) + 'm' : '';
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
    var MF = window.MF, home = collapsed ? '' : s.wake && s.homes[s.wake] ? s.wake : Object.keys(s.homes || {})[0], line;
    fainting = 0;
    $('world').classList.remove('fainted');
    MF.revive(s);
    MF.rest(s); winded = false;
    me.sail = false;
    if (inside) goOut();
    var beat = lostLines();
    if (home) { goIn(home); line = ['you come round on your own floor.\nsomeone left a glass of water by the door. you don\'t ask who.']; }
    else {
      /* a collapse (health gone) costs more than a faint, and always ends here */
      var bill = collapsed ? Math.min(600, Math.floor(MF.joules(s) * 0.2)) : Math.min(300, Math.floor(MF.joules(s) * 0.1));
      MF.spend(s, bill);
      if (collapsed) s.body.health = Math.max(s.body.health, 50);
      goIn('hospital');
      wallet(bill ? '-' + MF.fmtJ(bill) : '');
      line = [collapsed ? 'you wake up in nova city hospital, wired to three machines.\nthey stopped beeping at you an hour ago.' : 'you wake up in nova city hospital.\na medic is already writing the bill.',
              bill ? 'treatment: ' + MF.fmtJ(bill) + '. eat something. drink something.\nwe\'d rather not see you again tonight.' : 'no charge. you didn\'t have anything.\neat something. please.'];
      collapsed = false;
    }
    warned = false;
    if (api.save) api.save();
    drawBody();
    say(beat.concat(line), home ? '' : 'MEDIC');
  }

  /* ── the phone: a quick tap of B (holding B still runs) ─────
     home has the apps; in an app B goes back; on home B puts it away.
     MAP lifts it to fill the screen: up/down zoom, left/right switch view */
  var bTap = { at: 0, moved: false, busy: false };
  function bEdge(down) {
    if (down) { bTap = { at: Date.now(), moved: false, busy: !!(talkBox || mini || counter || table || fainting) }; return; }
    if (!bTap.busy && !bTap.moved && Date.now() - bTap.at < 260 && active) phoneTap();
  }
  var phone = null, pPrev = {}, pDrawn = 0;
  var APPS = [['id', 'ID', '#ff9de2', '◉'], ['inv', 'INV', '#7cc8ff', '▦'], ['clock', 'CLOCK', '#ffe97c', '◷'], ['map', 'MAP', '#7cffb2', '⌖'], ['mail', 'MAIL', '#ff8a6b', '✉'], ['sys', 'SYS', '#b9a8ff', '⚙']];
  var MAP_LAYERS = ['terranova', 'nova sea', 'nova city'], ZOOM_MAX = [6, 6, 16];
  var MAPIMG = {
    biomes: { src: 'maps/biomes.png', here: [0.629, 0.797] }, states: { src: 'maps/states.png', here: [0.629, 0.797] },
    nova: { src: 'maps/nova.png', here: [0.5, 0.36] }
  };
  function phoneTap() {
    if (!phone) { if (talkBox || mini || counter || table || fainting) return; openPhone(); return; }
    if (phone.app === 'inv' && phone.act >= 0) { phone.act = -1; drawPhone(); return; }
    if (phone.app !== 'home') { phone.app = 'home'; $('wPhone').classList.remove('lifted'); drawPhone(); return; }
    closePhone();
  }
  function openPhone() {
    phone = { app: 'home', sel: 0, tab: 'id', isel: 0, layer: 2, view: 'biomes', zoom: [1, 1, 3], c: [null, null, null] };
    pPrev = { up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right };
    pressedA = false; me.moving = me.moving; held.b = false;
    $('wPhone').hidden = false; $('wPhone').classList.remove('lifted');
    drawPhone();
  }
  function closePhone() { phone = null; $('wPhone').hidden = true; $('wPhone').classList.remove('lifted'); }
  function openApp(id) {
    if (id === 'sys') { closePhone(); if (window.MFUI) window.MFUI.openSys(); return; }
    phone.app = id; phone.msel = 0; phone.open = -1; phone.isel = 0; phone.act = -1; phone.imsg = '';
    $('wPhone').classList.toggle('lifted', id === 'map' || id === 'inv');
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
      if (up || dn || lf || rt) drawPhone();
      if (a) openApp(APPS[phone.sel][0]);
    } else if (phone.app === 'mail') {
      var box = (s.inbox || []).slice().reverse();
      if (phone.open >= 0) { if (a) { phone.open = -1; drawPhone(); } }
      else {
        if (up && box.length) { phone.msel = (phone.msel + box.length - 1) % box.length; drawPhone(); }
        if (dn && box.length) { phone.msel = (phone.msel + 1) % box.length; drawPhone(); }
        if (a && box[phone.msel]) { phone.open = phone.msel; box[phone.msel].read = true; if (api.save) api.save(); drawPhone(); }
      }
    } else if (phone.app === 'id') {
      tickId(up, dn, lf, rt, a);
    } else if (phone.app === 'inv') {
      tickInv(up, dn, lf, rt, a);
    } else if (phone.app === 'map') {
      /* hold the arrows to pan; A zooms in */
      var px = (held.right ? 1 : 0) - (held.left ? 1 : 0), py = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (px || py) panMap(px * 9, py * 9);
      if (a) zoomMap(1.25);
      if (phone.layer === 2 && now - pDrawn > 500) { pDrawn = now; drawOverlay(); }
    }
    if (now - pDrawn > 1000 && phone.app !== 'map') { pDrawn = now; drawPhoneBar(); if (phone.app === 'clock' || (phone.app === 'id' && phone.tab === 'vitals')) drawPhone(); }
  }
  function drawPhoneBar() {
    var c = novaNow();
    $('wPhoneBar').textContent = '';
    var l = document.createElement('span'); l.textContent = c.text; var r = document.createElement('span'); r.textContent = tempNow() + '°C · ' + window.MF.fmtJ(window.MF.joules(s));
    $('wPhoneBar').appendChild(l); $('wPhoneBar').appendChild(r);
  }
  function drawPhone() {
    var scr = $('wPhoneScreen'), hint = $('wPhoneHint');
    drawPhoneBar();
    scr.innerHTML = '';
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
      hint.textContent = '◀ ▶ pick · A open · tap B: put it away';
    } else if (phone.app === 'id') {
      drawId(scr);
      hint.textContent = '◀ ▶ tab' + (idRows().length ? ' · ▲ ▼ pick · A choose' : '') + ' · tap B: back';
    } else if (phone.app === 'clock') {
      var c = novaNow(), box = document.createElement('div'); box.className = 'pclock';
      var fc = '';
      for (var h = 2; h <= 12; h += 2) { var fcl = window.MF.clock(Date.now(), (s.dev && s.dev.shift || 0) + h * 60); fc += '<span>' + ('0' + fcl.hour).slice(-2) + 'h<br>' + window.MF.temperature(fcl, whereNow()) + '°</span>'; }
      box.innerHTML = '<div class="big">' + c.text + '</div><div>nova city · day ' + c.day + ' · ' + c.phase + '</div><div>' + tempNow() + '°C ' + (inside ? 'indoors' : 'here') + '</div><div class="fc">' + fc + '</div>';
      scr.appendChild(box);
      hint.textContent = 'next 12 hours · tap B: back';
    } else if (phone.app === 'mail') {
      var mails = (s.inbox || []).slice().reverse(), list = document.createElement('div'); list.className = 'pmail';
      if (phone.open >= 0 && mails[phone.open]) {
        var m = mails[phone.open], art = document.createElement('div'); art.className = 'pletter';
        var hd = document.createElement('b'); hd.textContent = m.from + ' · day ' + m.day; art.appendChild(hd);
        var tt = document.createElement('div'); tt.className = 'pt'; tt.textContent = m.title; art.appendChild(tt);
        var bd = document.createElement('pre'); bd.textContent = m.body; art.appendChild(bd);
        list.appendChild(art);
        hint.textContent = 'A: back to the list · tap B: home';
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
    } else if (phone.app === 'map') drawMap();
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
      line('who', (s.player.handle || 'stranger') + (s.player.origin ? ' · ' + s.player.origin + (s.player.power ? ' (' + s.player.power.toUpperCase() + ')' : '') : ''));
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
  var mapImgs = {};
  function mapContent(layer) {
    if (layer === 2) { var at = mapPos(); return { w: city.W, h: city.H, here: [at.x + 0.5, at.y + 0.5] }; }
    var m = MAPIMG[layer === 0 ? phone.view : 'nova'], im = mapImgs[m.src];
    if (!im || !im.naturalWidth) return null;
    return { w: im.naturalWidth, h: im.naturalHeight, here: [m.here[0] * im.naturalWidth, m.here[1] * im.naturalHeight] };
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
    if (phone.layer === 0) {
      var vb = document.createElement('button'); vb.type = 'button'; vb.textContent = phone.view === 'biomes' ? 'STATES' : 'BIOMES';
      vb.addEventListener('click', function (e) { e.preventDefault(); phone.view = phone.view === 'biomes' ? 'states' : 'biomes'; phone.c[0] = null; drawPhone(); });
      tabs.appendChild(vb);
    }
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
    if (phone.layer === 2) {
      stage.appendChild(cityCanvas());
      var ov = document.createElement('canvas'); ov.id = 'wMapOverlay'; ov.width = city.W; ov.height = city.H; stage.appendChild(ov);
    } else {
      var m = MAPIMG[phone.layer === 0 ? phone.view : 'nova'], img = mapImgs[m.src] || (mapImgs[m.src] = new Image());
      if (!img.src) img.src = m.src;
      var shown = img.cloneNode(); shown.alt = 'map: ' + MAP_LAYERS[phone.layer]; stage.appendChild(shown);
      if (!img.complete) img.onload = function () { if (phone && phone.app === 'map') layoutMap(); };
    }
    var dot = document.createElement('span'); dot.className = 'pin'; dot.id = 'wMapDot'; dot.appendChild(document.createElement('span')).className = 'here'; stage.appendChild(dot);
    mapGestures(view);
    layoutMap(); setTimeout(layoutMap, 300);
    if (phone.layer === 2) drawOverlay();
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
    else if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); setLayer(+e.key - 1); }
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
  var cityCv = null;
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
  function update(now) {
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (card.until && now > card.until) { $('wCard').classList.add('out'); card.until = 0; }
    body(dt, now);
    if (fainting) return;
    if (phone) { tickPhone(now); return; }
    if (mini) { tickMini(dt, now); return; }
    if (counter) { tickCounter(); return; }
    if (table) { tickTable(); return; }
    if (talkBox && talkBox.yes && talkBox.lines.length === 1 && held.b) { held.b = false; answer(false); }
    if (pressedA) {
      pressedA = false;
      if (talkBox && talkBox.yes && talkBox.lines.length === 1) answer(true);
      else if (talkBox) nextLine();
      else if (!me.moving && !attackTap(now)) interact();
    }
    if (L) { L.step(dt, SPEED); online(now); }
    if (talkBox) return;
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
    tickMobs(dt, now);
    /* the others wander a little, near where they stand */
    if (now - npcTick > 900) {
      npcTick = now;
      npcs.forEach(function (n) {
        if (n.still || Math.random() < 0.6) return;
        var ks = Object.keys(DIRS), k = ks[Math.floor(Math.random() * 4)], d = DIRS[k];
        var nx = n.x + d[0], ny = n.y + d[1];
        n.dir = k;
        if (Math.abs(nx - n.hx) > n.roam || Math.abs(ny - n.hy) > n.roam || occupied(nx, ny)) return;
        n.x = nx; n.y = ny; n.step ^= 1;
      });
    }
  }

  /* ── the street: foes that come for you (streets.js says who and when,
     combat.js does the maths). they turn up a few tiles off with a '!',
     walk you down and hit when they're next to you. double-tap A swings at
     whoever's next to you (it turns you to face them first). lose to a
     robber and you wake up with empty pockets, all but the safe slots ── */
  var mobs = [], spawnClock = -45, lastA = 0, swingFx = 0, hurtUntil = 0, floats = [], lostTo = null;
  var DOUBLE_TAP = 380, SWING_CD = 330, GIVE_UP = 14;
  var MOB_LOOK = {
    bandit:   { H: '#2a2a2a', S: '#b07a5a', C: '#5a4a3a', c: '#3a3020', P: '#2a2420', k: '#111', acc: 'glasses', A: '#14121c' },
    zombie:   { H: '#3a3a2a', S: '#7fa36a', C: '#4a4a3a', c: '#33332a', P: '#3a3020', k: '#111', E: '#ffe97c', m: '#5a2a2a' },
    skeleton: { H: '#e8e4d8', B: '#e8e4d8', S: '#e8e4d8', C: '#d8d4c8', c: '#b8b4a8', P: '#d8d4c8', k: '#111', hair: 'buzz' },
    rogueai:  { H: '#3a3f4a', S: '#8a92a6', C: '#2a2f3d', P: '#2a2f3d', k: '#111', E: '#ff3a4a', m: '#5a6378', hair: 'buzz' },
    vampire:  { H: '#14121c', S: '#e8e4f0', C: '#14121c', c: '#5a1020', P: '#14121c', k: '#000', E: '#ff3a4a', m: '#8a1a2a' },
    werewolf: { H: '#5a4632', B: '#5a4632', S: '#7a5e44', C: '#5a4632', P: '#4a3a2a', k: '#1a1410', E: '#ffe97c', fur: 1 },
    agent:    { H: '#14121c', S: '#e0b48a', C: '#e6e8f0', c: '#b8bcc8', P: '#14121c', k: '#000', hair: 'buzz', acc: 'glasses', A: '#111' }
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
    var m = mobNear();
    if (!m) return false;
    me.dir = faceTo(m.x - me.x, m.y - me.y);
    if (now - lastA < DOUBLE_TAP) { lastA = 0; swingAt(m, now); } else lastA = now;
    return true;
  }
  function swingAt(m, now) {
    if (now < swingFx + SWING_CD) return;
    var C = window.MFCombat, LV = window.MFLevel, MF = window.MF, P = C.player(s, LV), r = C.strike(P, m.f), w = C.swing(s);
    swingFx = now;
    if (w.broke) float(me.x * TS + 2, me.y * TS - 12, C.WEAPONS[w.key].name.replace(/^an? /, '') + ' breaks!', '#ffb02e');
    if (!r.hit) { float(m.x * TS + 2, m.y * TS - 6, 'miss', '#9aa0b8'); return; }
    m.f.hp -= r.dmg; m.hurt = now + 220; m.cd = Math.max(m.cd, 0.35);
    float(m.x * TS + 3, m.y * TS - 6, (r.crit ? 'CRIT ' : '') + r.dmg, r.crit ? '#ffe97c' : '#fff');
    if (m.f.hp <= 0) return beaten(m);
    /* knocked back a tile, if there's room */
    var kx = m.x + Math.sign(m.x - me.x), ky = m.y + Math.sign(m.y - me.y);
    if ((kx !== m.x) !== (ky !== m.y) && !occupied(kx, ky)) { m.fx = m.x; m.fy = m.y; m.x = kx; m.y = ky; m.moving = true; m.t = 0.5; }
  }
  function beaten(m) {
    var MF = window.MF;
    mobs = mobs.filter(function (o) { return o !== m; });
    if (m.f.joules > 0) { MF.earn(s, m.f.joules); wallet('+' + MF.fmtJ(m.f.joules)); }
    exp('combat', { xp: m.f.xp });
    float(m.x * TS, m.y * TS - 8, m.f.name + ' down', '#7cffb2');
    if (api.save) api.save();
  }
  function mobHit(m, now) {
    var C = window.MFCombat, MF = window.MF, P = C.player(s, window.MFLevel), r = C.strike(m.f, { def: P.def, ref: P.ref, soak: P.soak });
    m.cd = 1.5 - Math.min(0.7, m.f.ref * 0.03); m.lunge = now + 150;
    if (!r.hit) { float(me.x * TS + 2, me.y * TS - 6, 'dodge', '#7cf5ff'); return; }
    MF.hurt(s, r.dmg); hurtUntil = now + 260;
    if (m.f.drain) m.f.hp = Math.min(m.f.max, m.f.hp + Math.round(r.dmg * m.f.drain));
    float(me.x * TS + 3, me.y * TS - 6, '-' + r.dmg, '#ff4f5e');
    drawBody();
    if (s.body.health <= 0) lose(m, now);
  }
  function lose(m, now) {
    var took = m.f.robs ? window.MFCombat.rob(s, window.MF) : null;
    lostTo = { name: m.f.name, took: took };
    mobs = []; floats = [];
    wallet();
    faint(now, true);
  }
  /* what you wake up to after a beating (wakeUp puts it first) */
  function lostLines() {
    var l = lostTo, MF = window.MF; lostTo = null;
    if (!l) return [];
    if (!l.took) return ['a ' + l.name + ' left you for dead out there.\nwe got to you before anything else did.'];
    var n = 0; ['items', 'res'].forEach(function (b) { Object.keys(l.took[b]).forEach(function (k) { n += l.took[b][k]; }); });
    var kept = window.MF.safeKeys(s).length;
    return ['a ' + l.name + ' went through your pockets before we found you.\n' + (l.took.joules ? MF.fmtJ(l.took.joules) : 'not a joule') + (n ? ' and ' + n + ' thing' + (n > 1 ? 's' : '') : '') + ' gone.' + (kept ? ' the safe slots held.' : '')];
  }
  function tickMobs(dt, now) {
    var zn = zoneNow();
    if (!zn) { mobs = []; return; }
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
      var dx = me.x - m.x, dy = me.y - m.y, d = Math.abs(dx) + Math.abs(dy);
      if (d > GIVE_UP) { m.gone = true; return; }
      if (d === 1) { m.dir = faceTo(dx, dy); if (m.cd <= 0) mobHit(m, now); return; }
      var opts = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i], nx = m.x + o[0], ny = m.y + o[1];
        if ((!o[0] && !o[1]) || occupied(nx, ny)) continue;
        m.fx = m.x; m.fy = m.y; m.x = nx; m.y = ny; m.moving = true; m.t = 0; m.step ^= 1; m.dir = faceTo(o[0], o[1]);
        break;
      }
    });
    mobs = mobs.filter(function (m) { return !m.gone; });
  }
  /* bars over heads, numbers that float up, the swing, the sting of a hit */
  function drawFight(cx, cy, now, ppx, ppy) {
    mobs.forEach(function (m) {
      var mx = Math.round((m.moving ? m.fx + (m.x - m.fx) * m.t : m.x) * TS - cx), my = Math.round((m.moving ? m.fy + (m.y - m.fy) * m.t : m.y) * TS - cy);
      px(ctx, OUT, mx + 1, my - 6, 14, 4); px(ctx, '#3a1218', mx + 2, my - 5, 12, 2);
      px(ctx, m.f.tier === 'unnamed' && m.f.level > (window.MFLevel ? window.MFLevel.level(s) + 3 : 99) ? '#ff4fd8' : '#ff4f5e', mx + 2, my - 5, Math.max(1, Math.round(12 * m.f.hp / m.f.max)), 2);
    });
    if (mobs.length || now < hurtUntil + 1500) {
      var hx = Math.round(ppx - cx), hy = Math.round(ppy - cy), MF = window.MF;
      px(ctx, OUT, hx + 1, hy - 6, 14, 4); px(ctx, '#123a22', hx + 2, hy - 5, 12, 2);
      px(ctx, '#7cffb2', hx + 2, hy - 5, Math.max(0, Math.round(12 * MF.vital(s, 'hp') / MF.maxOf(s, 'hp'))), 2);
    }
    if (now < swingFx + 140) {
      var d = DIRS[me.dir], sx = Math.round(ppx - cx) + 8 + d[0] * 10, sy = Math.round(ppy - cy) + 7 + d[1] * 10;
      ctx.strokeStyle = '#f4f6ff'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(sx, sy, 5, Math.atan2(d[1], d[0]) - 1.2, Math.atan2(d[1], d[0]) + 1.2); ctx.stroke();
    }
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
      px(ctx, OUT, bx, by - 8, 3, 14); px(ctx, '#5a6070', bx + 1, by - 7, 1, 12);
      px(ctx, OUT, bx - 2, by - 10, 7, 4); px(ctx, lit ? '#fff3b0' : '#8a92a6', bx - 1, by - 9, 5, 2);
    });
  }
  var lightCv = null;
  function night(dk, cx, cy, now, ppx, ppy) {
    var W = VW * TS, Hh = VH * TS, lights = [];
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== W || lightCv.height !== Hh) { lightCv.width = W; lightCv.height = Hh; }
    function add(x, y, r, a, col, ga) { if (x > -r && y > -r && x < W + r && y < Hh + r) lights.push({ x: x, y: y, r: r, a: a, col: col, ga: ga }); }
    /* lamps: a warm pool on the road */
    (deco.lamps || []).forEach(function (l) { var h = lampHead(l, cx, cy); add(h[0], h[1] + 10, 40, 0.95, '#ffcf7a', 0.2); });
    /* lit windows and doors on every building front in view */
    var x0 = Math.max(0, Math.floor(cx / TS) - 1), y0 = Math.max(0, Math.floor(cy / TS) - 1);
    for (var y = y0; y <= y0 + VH + 1 && y < world.H; y++) for (var x = x0; x <= x0 + VW + 1 && x < world.W; x++) {
      var k = y * world.W + x;
      if (world.tile[k] !== T.BUILDING || (y + 1 < world.H && world.tile[k + world.W] === T.BUILDING)) continue;
      var p = pal(world.dist[k]), v = Math.floor(hash(x, y) * 32), tx = x * TS - cx, ty = y * TS - cy;
      if (deco.door[k]) { add(tx + 8, ty + 12, 16, 0.75, p.glow[v % p.glow.length], 0.3); continue; }
      for (var i = 0; i < 2; i++) if ((v >> (i + 2)) & 1 || (v & 3) === 1) add(tx + (i ? 11 : 4), ty + 9, 11, 0.6, p.glow[(v + i) % p.glow.length], 0.3);
    }
    /* landmarks' neon, and fires that flicker */
    world.marks.forEach(function (m) {
      var mx = (m.x + m.w / 2) * TS - cx, my = m.y * TS - cy;
      if (m.fire) { var f = 1 + 0.12 * Math.sin(now / 90 + m.x) + 0.08 * Math.sin(now / 37 + m.y); add(mx, my + 8, 34 * f, 0.95, '#ff8a3a', 0.35 * f); return; }
      var col = MARK_GLOW[m.id] || pal(world.dist[m.y * world.W + m.x]).glow[0];
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
    if (torchLit) {
      var fd2 = DIRS[me.dir], tx2 = ppx - cx + 8, ty2 = ppy - cy + 8, a2 = Math.atan2(fd2[1], fd2[0]);
      var wg = ctx.createRadialGradient(tx2, ty2, 6, tx2, ty2, 104);
      wg.addColorStop(0, rgba('#fff3b0', (0.16 * dk).toFixed(3))); wg.addColorStop(1, rgba('#fff3b0', 0));
      ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.arc(tx2, ty2, 104, a2 - 0.48, a2 + 0.48); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw(now) {
    var wave = Math.floor(now / 600) % 2;
    var ppx = (me.moving ? me.fx + (me.x - me.fx) * me.t : me.x) * TS, ppy = (me.moving ? me.fy + (me.y - me.fy) * me.t : me.y) * TS;
    /* a room smaller than the screen sits in the middle of it, in the dark */
    var cx = world.W <= VW ? -Math.floor((VW - world.W) * TS / 2) : Math.round(Math.max(0, Math.min(world.W * TS - VW * TS, ppx - (VW * TS) / 2 + TS / 2)));
    var cy = world.H <= VH ? -Math.floor((VH - world.H) * TS / 2) : Math.round(Math.max(0, Math.min(world.H * TS - VH * TS, ppy - (VH * TS) / 2 + TS / 2)));
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
        if (hit) m |= 1 << b;
      }
      if (t === T.BUILDING) { rv = deco.roof[k]; dr = deco.door[k]; }
      else if (t !== T.STALL && t !== T.ROAD && t !== T.GROUND) v &= 7;
      var w = wet(t) ? wave : 0;
      var key = t + '.' + di + '.' + v + '.' + m + '.' + w + '.' + rv + dr;
      ctx.drawImage(tileCanvas(key, function (g) { drawTile(g, t, di, v, m, w, rv, dr); }), x * TS - cx, y * TS - cy);
    }
    world.marks.forEach(function (m) {
      if (m.x * TS - cx > VW * TS || (m.x + m.w) * TS - cx < 0 || m.y * TS - cy > VH * TS || (m.y + m.h) * TS - cy < 0) return;
      ctx.drawImage(markCanvas(m), m.x * TS - cx, m.y * TS - cy);
    });
    world.signs.forEach(function (sg) {
      var sx = sg.x * TS - cx, sy = sg.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      px(ctx, OUT, sx + 6, sy + 8, 4, 8); px(ctx, '#5a3a22', sx + 7, sy + 9, 2, 6);
      px(ctx, OUT, sx + 2, sy + 2, 12, 8); px(ctx, '#c8a878', sx + 3, sy + 3, 10, 6);
      px(ctx, '#8a6a48', sx + 4, sy + 5, 8, 1); px(ctx, '#8a6a48', sx + 4, sy + 7, 6, 1);
    });
    if (!inside) { drawLamps(cx, cy); drawLoose(cx, cy, now); drawPiles(cx, cy, now); }
    /* people, back to front */
    var who = npcs.map(function (n) { return { x: n.x * TS, y: n.y * TS, img: sprite(n.look === 'gen' ? crowdLook(n) : LOOKS[n.look] || LOOKS.local, n.dir, n.step) }; });
    mobs.forEach(function (m) {
      var mx = (m.moving ? m.fx + (m.x - m.fx) * m.t : m.x) * TS, my = (m.moving ? m.fy + (m.y - m.fy) * m.t : m.y) * TS;
      if (now < m.lunge) { var ld = DIRS[m.dir]; mx += ld[0] * 3; my += ld[1] * 3; }
      who.push({ x: mx, y: my, img: sprite(m.look, m.dir, m.moving && m.t > 0.25 && m.t < 0.75 ? 1 : 0), mob: m });
    });
    who.push({ x: ppx, y: ppy, img: sprite(playerLook(), me.dir, me.sail ? 0 : me.moving && me.t > 0.25 && me.t < 0.75 ? 1 : 0), me: 1, boat: me.sail });
    if (L && (!inside || inside.place)) L.list().forEach(function (o) {
      var ox = (o.t < 1 ? o.fx + (o.x - o.fx) * o.t : o.x) * TS, oy = (o.t < 1 ? o.fy + (o.y - o.fy) * o.t : o.y) * TS;
      if (ox - cx < -TS || oy - cy < -TS || ox - cx > VW * TS || oy - cy > VH * TS) return;
      who.push({ x: ox, y: oy, img: sprite(lookOf(o.look), o.dir, o.boat ? 0 : o.t > 0.25 && o.t < 0.75 ? 1 : 0), them: 1, boat: o.boat });
    });
    who.sort(function (a, b) { return a.y - b.y; });
    who.forEach(function (p) {
      var bob = p.boat ? Math.floor(now / 450) % 2 : 0;
      if (!p.boat) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(p.x - cx) + 4, Math.round(p.y - cy) + 14, 8, 2); }
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
    var nc = novaNow(), dk = darkness(nc);
    if (nc.phase === 'dawn' || nc.phase === 'dusk' || nc.phase === 'day') { ctx.fillStyle = LIGHT[nc.phase]; ctx.fillRect(0, 0, VW * TS, VH * TS); }
    if (dk > 0) night(dk, cx, cy, now, ppx, ppy);
    drawFight(cx, cy, now, ppx, ppy);
    ctx.fillStyle = 'rgba(159,140,255,.3)';
    var drops = Math.round(VW * VH / 10);
    for (var r = 0; r < drops; r++) {
      var rx = (r * 53 + now * 0.12) % (VW * TS), ry = (r * 37 + now * 0.35) % (VH * TS);
      ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 3);
    }
  }

  function loop(now) {
    if (!active) return;
    update(now); draw(now);
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
      npcs = cityNpcs = world.npcs.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.hx = n.x; c.hy = n.y; c.step = 0; return c; });
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
      say(['your run only lives in this browser. clear the site data and it is gone.\nback it up: SYS, top right.']);
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
  window.MFWorld = { show: show, hide: hide, preview: preview, openPhone: openPhone, devFoe: devFoe, get foes() { return mobs.map(function (m) { return { name: m.f.name, id: m.f.id, hp: m.f.hp, max: m.f.max, level: m.f.level, x: m.x, y: m.y }; }); }, setOffline: setOffline, refresh: refresh, openHold: openHold, get sailing() { return active && me.sail; }, get offline() { return offline(); }, get active() { return active; } };
})();
