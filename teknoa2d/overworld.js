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
  var M = window.MFWorldMap, A = window.MFAvatar;
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
    none:      { ground: '#20283a', road: '#2a3248', line: '#3a4460', roof: '#2a3248', roof2: '#3a4460', wall: '#1a2030', glow: ['#9f8cff'], tree: '#1a3a30', leaf: '#3a8a6a', grass: '#1a3a2a' }
  };
  function pal(di) { return PAL[di >= 0 ? D[di].id : 'none']; }

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

  function drawTile(g, t, di, v, edge, wave) {
    var p = pal(di), i;
    if (t === T.DEEP || t === T.SHALLOW) {
      px(g, t === T.DEEP ? '#08142a' : '#0e2546', 0, 0, TS, TS);
      for (i = 0; i < 3; i++) px(g, t === T.DEEP ? '#12305a' : '#1d4a7a', (v * 5 + i * 6 + wave * 3) % 14, (i * 5 + v) % 15, 3, 1);
      return;
    }
    if (t === T.MAINLAND) {
      px(g, '#1a2a22', 0, 0, TS, TS);
      for (i = 0; i < 4; i++) px(g, '#244034', (v * 7 + i * 4) % 15, (i * 4 + v * 3) % 15, 2, 2);
      return;
    }
    if (t === T.SAND) {
      px(g, '#6e5f48', 0, 0, TS, TS);
      for (i = 0; i < 5; i++) px(g, '#857256', (v * 3 + i * 7) % 16, (i * 3 + v) % 16);
      return;
    }
    if (t === T.GROUND || t === T.STALL) {
      px(g, p.ground, 0, 0, TS, TS);
      for (i = 0; i < 3; i++) px(g, p.line, (v * 5 + i * 5) % 15, (v * 3 + i * 6) % 15);
      if (t === T.STALL) {
        px(g, p.glow[v % p.glow.length], 1, 2, 14, 5); px(g, '#f4f6ff', 1, 4, 14, 1);
        px(g, '#4a3424', 2, 7, 12, 7); px(g, p.glow[(v + 1) % p.glow.length], 4, 8, 3, 2); px(g, p.glow[(v + 2) % p.glow.length], 9, 9, 3, 2);
      }
      return;
    }
    if (t === T.ROAD) {
      px(g, p.road, 0, 0, TS, TS);
      if (v % 5 === 0) { px(g, p.line, 7, 6, 2, 4); }
      if (v % 11 === 3) { px(g, '#0b0d1a', 12, 2, 2, 2); px(g, p.glow[v % p.glow.length], 12, 1, 2, 1); }
      return;
    }
    if (t === T.GRASS) {
      px(g, p.grass, 0, 0, TS, TS);
      for (i = 0; i < 6; i++) px(g, p.leaf, (v * 3 + i * 5) % 15, (i * 5 + v * 2) % 15, 1, 2);
      return;
    }
    if (t === T.TREE) {
      px(g, p.grass, 0, 0, TS, TS);
      px(g, '#0b0d1a', 3, 12, 10, 3);
      px(g, p.tree, 2, 2, 12, 11); px(g, p.tree, 4, 1, 8, 1); px(g, p.tree, 1, 4, 14, 7);
      for (i = 0; i < 4; i++) px(g, p.leaf, 3 + (v * 3 + i * 4) % 9, 3 + (i * 3 + v) % 8, 2, 2);
      return;
    }
    if (t === T.BRIDGE) {
      px(g, '#2a2f44', 0, 0, TS, TS);
      for (i = 0; i < TS; i += 4) px(g, '#3a4058', 0, i, TS, 1);
      px(g, '#9f8cff', 0, 0, TS, 1); px(g, '#9f8cff', 0, 15, TS, 1);
      if (v % 4 === 0) px(g, '#7cf5ff', 7, 0, 2, 1);
      return;
    }
    if (t === T.BUILDING) {
      /* a facade where the street can see it, a roof everywhere else */
      if (edge.face) {
        px(g, p.wall, 0, 0, TS, TS);
        px(g, '#0b0d1a', 0, 15, TS, 1);
        for (i = 0; i < 2; i++) {
          var lit = hash(v, i) < 0.7;
          px(g, lit ? p.glow[(v + i) % p.glow.length] : '#0b0d1a', 2 + i * 7, 3, 5, 4);
          px(g, '#0b0d1a', 4 + i * 7, 3, 1, 4);
        }
        if (v % 3 === 0) { px(g, '#0b0d1a', 6, 9, 4, 6); px(g, p.glow[v % p.glow.length], 6, 9, 4, 1); }
      } else {
        px(g, v % 2 ? p.roof : p.roof2, 0, 0, TS, TS);
        px(g, 'rgba(0,0,0,.25)', 0, 0, TS, 1);
        if (edge.top) px(g, p.glow[v % p.glow.length], 0, 0, TS, 1);
        if (v % 7 === 0) { px(g, '#0b0d1a', 5, 5, 6, 5); px(g, '#3a4058', 6, 6, 4, 3); }
        if (v % 9 === 4) px(g, p.glow[(v + 1) % p.glow.length], 12, 3, 2, 2);
      }
      return;
    }
    px(g, p.ground, 0, 0, TS, TS);
  }

  /* landmarks: one picture across their whole footprint */
  var MARK_ART = {
    tower: function (g, w, h) {
      px(g, '#1c1736', 0, 0, w, h);
      var c = ['#ff4fd8', '#7cf5ff', '#9f8cff', '#ffe97c'];
      for (var y = 4; y < h; y += 2) {
        var span = Math.round((y / h) * (w - 8)) + 4, x0 = (w - span) >> 1;
        px(g, c[(y >> 1) % 4], x0, y, span, 1);
      }
      px(g, '#f4f6ff', (w >> 1) - 1, 0, 2, 6);
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
  var markArt = {};
  function markCanvas(m) {
    if (markArt[m.id]) return markArt[m.id];
    var c = document.createElement('canvas'); c.width = m.w * TS; c.height = m.h * TS;
    (MARK_ART[m.id] || MARK_ART.market)(c.getContext('2d'), c.width, c.height);
    return (markArt[m.id] = c);
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
    hex:     { H: '#b14cff', h: '#ff4fd8', S: '#e8b48a', C: '#1a1a22', P: '#2a2a3a', k: '#0b0b10' },
    reveler: { H: '#7cf5ff', S: '#c88a64', C: '#ff4fd8', P: '#2a2f4a', k: '#111' },
    local:   { H: '#1a1010', S: '#7a4a30', C: '#e8b13a', P: '#2f6f5e', k: '#111' },
    ape:     { H: '#2a2420', S: '#5a4a40', C: '#3a5a3a', P: '#2a2420', k: '#1a1410' },
    clerk:   { H: '#c8ccd8', S: '#e0b090', C: '#2a3a6a', P: '#2a2f4a', k: '#111' },
    medic:   { H: '#1a1a1a', S: '#e0b48a', C: '#e6e8f0', P: '#8ad0b0', k: '#111' },
    merc:    { H: '#3a1218', S: '#b07a5a', C: '#3a1218', P: '#1a080c', k: '#111' },
    tailor:  { H: '#c9a25a', S: '#e8b796', C: '#5a1e3c', c: '#3a1428', A: '#f2c94c', P: '#14121c', k: '#111', hair: 'bob', acc: 'glasses' },
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
  var spriteCache = {};
  function sprite(look, dir, step) {
    var key = JSON.stringify(look) + dir + step;
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var g = c.getContext('2d'), flip = dir === 'right', rows = BODY[flip ? 'left' : dir].slice();
    if (step) { var st = STEP[flip ? 'left' : dir]; rows[13] = st[0]; rows[14] = st[1]; rows[15] = st[2]; }
    rows = styled(rows, flip ? 'left' : dir, look);
    var colours = { H: look.H, h: look.h || look.H, B: look.B || look.H, S: look.S, f: shade(look.S || '#c88a64', 0.62), r: '#d48a8a', G: '#7cf5ff', E: '#0b0d1a', m: '#7a3a3a', C: look.C, c: look.c || look.C,
                    A: look.A || '#d8dce8', P: look.P || '#2a2f4a', k: look.k || '#111' };
    rows.forEach(function (r, y) {
      for (var x = 0; x < TS; x++) {
        var ch = r.charAt(x); if (ch === '.') continue;
        /* hex's split dye: the right half of her hair is the other colour */
        var col = ch === 'H' && x >= 8 ? colours.h : colours[ch];
        px(g, col, flip ? TS - 1 - x : x, y);
      }
    });
    return (spriteCache[key] = c);
  }
  /* the crowd: a look of their own from their seed, the same every visit */
  var crowdLooks = {};
  function crowdLook(n) {
    if (crowdLooks[n.seed]) return crowdLooks[n.seed];
    var a = n.seed >>> 0;
    function rng() { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return (crowdLooks[n.seed] = lookOf(A ? A.random(rng) : {}));
  }
  /* the player looks like their Chippin' In face */
  function shade(hex, f) {
    var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return ('0' + Math.round(v * f).toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }
  function lookOf(raw) {
    var l = A ? A.normalize(raw) : {};
    return { H: l.hairC || '#3a2a20', B: shade(l.hairC || '#3a2a20', 0.85), S: l.skin || '#c88a64', C: l.topC || '#9f8cff', c: shade(l.topC || '#9f8cff', 0.7),
             A: l.accC, P: '#22263a', k: '#0b0b10', hair: l.hair, beard: l.beard, marks: l.marks, top: l.top, acc: l.acc };
  }
  function playerLook() { return lookOf(s.player.look); }

  /* ── state ─────────────────────────────────────────────────── */
  var me = { x: 0, y: 0, dir: 'down', moving: false, fx: 0, fy: 0, t: 0, step: 0 };
  var npcs = [], held = {}, pressedA = false, talkBox = null, district = -2, card = { until: 0 };
  var loose = [], toastT = 0;

  function occupied(x, y) {
    if (M.solid(world, x, y)) return true;
    for (var i = 0; i < npcs.length; i++) if (npcs[i].x === x && npcs[i].y === y) return true;
    return me.x === x && me.y === y;
  }
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tryMove(dir) {
    me.dir = dir;
    var d = DIRS[dir], nx = me.x + d[0], ny = me.y + d[1];
    if (occupied(nx, ny)) return;
    me.fx = me.x; me.fy = me.y; me.x = nx; me.y = ny; me.moving = true; me.t = 0; me.step ^= 1;
  }

  /* ── talking ─────────────────────────────────────────────── */
  function say(lines, who) {
    talkBox = { lines: lines.slice(), who: who || '' };
    $('wTalk').hidden = false;
    showLine();
  }
  function showLine() {
    $('wWho').textContent = talkBox.who;
    $('wLine').textContent = talkBox.lines[0].replace(/\$handle\b/g, s.player.handle || 'stranger');
  }
  function nextLine() {
    talkBox.lines.shift();
    if (talkBox.lines.length) return showLine();
    talkBox = null; $('wTalk').hidden = true;
  }
  var HEX_AFTER = ["the arcade's open. high score's mine though. it's always mine.", 'back already? you missed me. say you missed me.',
                   "don't go knocking on the lighthouse, $handle. trust me on that one."];
  function interact() {
    var d = DIRS[me.dir], tx = me.x + d[0], ty = me.y + d[1], i;
    for (i = 0; i < npcs.length; i++) {
      var n = npcs[i];
      if (n.x !== tx || n.y !== ty) continue;
      n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[me.dir];
      if (n.shop && api.shop) { api.shop(n.shop); return; }
      if (n.scene === 'hex') {
        if (!s.met.hex && api.talk) { api.talk(); return; }
        return say([HEX_AFTER[Math.floor(Math.random() * HEX_AFTER.length)]], 'Hex');
      }
      var said = n.said || 0;
      n.said = (said + 1) % n.lines.length;
      return say([n.lines[said]]);
    }
    /* walking into a shop's front opens it too */
    for (i = 0; i < world.marks.length; i++) {
      var m = world.marks[i];
      if (m.shop && api.shop && tx >= m.x && tx < m.x + m.w && ty >= m.y && ty < m.y + m.h) { api.shop(m.shop); return; }
    }
    /* a sign is read facing it, or standing on it */
    for (i = 0; i < world.signs.length; i++) {
      var sg = world.signs[i];
      if ((sg.x === tx && sg.y === ty) || (sg.x === me.x && sg.y === me.y)) return say([sg.text]);
    }
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
  function pickUp() {
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
  /* a dropped joule: a little bolt that winks */
  var BOLT = ['..YY', '.YY.', 'YYYY', '.YY.', 'YY..'];
  function drawLoose(cx, cy, now) {
    looseNow().forEach(function (j) {
      var sx = j.x * TS - cx, sy = j.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      var bob = Math.floor(now / 300 + j.x) % 2, lit = Math.floor(now / 150 + j.y) % 8 === 0;
      px(ctx, 'rgba(0,0,0,.35)', sx + 5, sy + 12, 6, 1);
      BOLT.forEach(function (r, y) {
        for (var x = 0; x < 4; x++) if (r.charAt(x) === 'Y') px(ctx, lit ? '#ffffff' : '#ffe97c', sx + 6 + x, sy + 5 + y - bob);
      });
    });
  }

  /* ── district cards ──────────────────────────────────────── */
  function enterDistrict(di) {
    if (di < 0 || di === district) return;
    district = di;
    var d = D[di], c = $('wCard');
    $('wCardImg').setAttribute('src', 'places/' + d.id + '.jpg');
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
    if (pressedA) { pressedA = false; if (talkBox) nextLine(); else if (!me.moving) interact(); }
    if (talkBox) return;
    if (me.moving) {
      me.t += dt * SPEED * (held.b ? 2 : 1);
      if (me.t >= 1) {
        me.moving = false; me.t = 0;
        enterDistrict(world.dist[me.y * world.W + me.x]);
        s.world = { x: me.x, y: me.y, d: me.dir, v: M.V };
        pickUp();
      }
    }
    if (!me.moving) {
      var dir = held.up ? 'up' : held.down ? 'down' : held.left ? 'left' : held.right ? 'right' : '';
      if (dir) tryMove(dir);
    }
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

  function draw(now) {
    var wave = Math.floor(now / 600) % 2;
    var ppx = (me.moving ? me.fx + (me.x - me.fx) * me.t : me.x) * TS, ppy = (me.moving ? me.fy + (me.y - me.fy) * me.t : me.y) * TS;
    var cx = Math.round(Math.max(0, Math.min(world.W * TS - VW * TS, ppx - (VW * TS) / 2 + TS / 2)));
    var cy = Math.round(Math.max(0, Math.min(world.H * TS - VH * TS, ppy - (VH * TS) / 2 + TS / 2)));
    var x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x, y;
    for (y = y0; y <= y0 + VH; y++) for (x = x0; x <= x0 + VW; x++) {
      if (x >= world.W || y >= world.H) continue;
      var k = y * world.W + x, t = world.tile[k], di = world.dist[k];
      if (t === T.LANDMARK) continue;
      var v = Math.floor(hash(x, y) * 32);
      var below = y + 1 < world.H ? world.tile[k + world.W] : -1, above = y > 0 ? world.tile[k - world.W] : -1;
      var edge = { face: t === T.BUILDING && below !== T.BUILDING, top: t === T.BUILDING && above !== T.BUILDING };
      var w = (t === T.DEEP || t === T.SHALLOW) ? wave : 0;
      var key = t + '.' + di + '.' + v + '.' + (edge.face ? 1 : 0) + (edge.top ? 1 : 0) + '.' + w;
      ctx.drawImage(tileCanvas(key, function (g) { drawTile(g, t, di, v, edge, w); }), x * TS - cx, y * TS - cy);
    }
    world.marks.forEach(function (m) {
      if (m.x * TS - cx > VW * TS || (m.x + m.w) * TS - cx < 0 || m.y * TS - cy > VH * TS || (m.y + m.h) * TS - cy < 0) return;
      ctx.drawImage(markCanvas(m), m.x * TS - cx, m.y * TS - cy);
    });
    world.signs.forEach(function (sg) {
      var sx = sg.x * TS - cx, sy = sg.y * TS - cy;
      if (sx < -TS || sy < -TS || sx > VW * TS || sy > VH * TS) return;
      px(ctx, '#3a2a20', sx + 7, sy + 8, 2, 7); px(ctx, '#c8a878', sx + 3, sy + 3, 10, 6); px(ctx, '#8a6a48', sx + 4, sy + 5, 8, 1);
    });
    drawLoose(cx, cy, now);
    /* people, back to front */
    var who = npcs.map(function (n) { return { x: n.x * TS, y: n.y * TS, img: sprite(n.look === 'gen' ? crowdLook(n) : LOOKS[n.look] || LOOKS.local, n.dir, n.step) }; });
    who.push({ x: ppx, y: ppy, img: sprite(playerLook(), me.dir, me.moving && me.t > 0.25 && me.t < 0.75 ? 1 : 0), me: 1 });
    who.sort(function (a, b) { return a.y - b.y; });
    who.forEach(function (p) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(p.x - cx) + 4, Math.round(p.y - cy) + 14, 8, 2);
      ctx.drawImage(p.img, Math.round(p.x - cx), Math.round(p.y - cy) - 2);
    });
    /* a little night over everything, and the rain the main page has */
    ctx.fillStyle = 'rgba(5,6,11,.18)'; ctx.fillRect(0, 0, VW * TS, VH * TS);
    ctx.fillStyle = 'rgba(159,140,255,.25)';
    for (var r = 0; r < 26; r++) {
      var rx = (r * 53 + now * 0.12) % (VW * TS), ry = (r * 37 + now * 0.35) % (VH * TS);
      ctx.fillRect(Math.round(rx), Math.round(ry), 1, 4);
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
    if (down && (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) pressedA = true; return; }
    var k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    held[k] = down;
  }
  document.addEventListener('keydown', function (e) { onKey(e, true); });
  document.addEventListener('keyup', function (e) { onKey(e, false); });
  window.addEventListener('blur', function () { held = {}; });

  /* the on-screen pad: hold a direction, tap A, hold B */
  function pad() {
    [].forEach.call(document.querySelectorAll('#wPad [data-k]'), function (b) {
      var k = b.getAttribute('data-k');
      function on(e) { e.preventDefault(); if (k === 'a') pressedA = true; else held[k] = true; b.classList.add('down'); }
      function off(e) { if (e) e.preventDefault(); if (k !== 'a') held[k] = false; b.classList.remove('down'); }
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* ── what ui.js calls ────────────────────────────────────── */
  function show(state, hooks) {
    s = state; api = hooks || {};
    if (!world) {
      world = M.build();
      canvas = $('wCanvas'); canvas.width = VW * TS; canvas.height = VH * TS;
      ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      npcs = world.npcs.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.hx = n.x; c.hy = n.y; c.step = 0; return c; });
      pad();
    }
    var at = s.world;
    /* back where they stood, unless something is standing there now */
    if (at && at.x >= 0 && at.v === M.V && !M.solid(world, at.x, at.y) && !npcs.some(function (n) { return n.x === at.x && n.y === at.y; })) { me.x = at.x; me.y = at.y; me.dir = at.d || 'down'; }
    else { me.x = world.spawn.x; me.y = world.spawn.y; me.dir = world.spawn.dir; }
    me.moving = false; held = {}; talkBox = null; $('wTalk').hidden = true;
    s.world = { x: me.x, y: me.y, d: me.dir, v: M.V };
    $('world').hidden = false;
    district = -2; enterDistrict(world.dist[me.y * world.W + me.x]);
    wallet();
    nudge();
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
  function hide() {
    active = false; cancelAnimationFrame(raf); held = {};
    $('world').hidden = true;
  }
  /* Chippin' In shows the walking sprite as it is built */
  function preview(look, dir, step) {
    var big = document.createElement('canvas'); big.width = big.height = TS;
    var g = big.getContext('2d'); g.drawImage(sprite(lookOf(look), dir, step), 0, 0);
    return big;
  }
  window.MFWorld = { show: show, hide: hide, preview: preview, get active() { return active; } };
})();
