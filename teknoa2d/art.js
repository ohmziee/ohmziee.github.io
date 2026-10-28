/* Teknoa 2D: art from PNG sheets (the 32px revamp).

   The game still thinks in 16-unit tiles (TS in overworld.js): positions,
   collisions and saves never change. The screen canvas is ART times finer,
   so a sheet drawn at its own size lands one sheet pixel per canvas pixel:
   32px art on a 16-unit tile.

   SHEETS: one PNG each under art/sheets/, painted by art/make_sheets.mjs (or
   by hand in Aseprite; keep the same cells). Each entry is a piece of it:
     x, y, w, h   where it sits in the sheet, in sheet pixels
     ox, oy       where it hangs from its tile's top-left, in sheet pixels
                  (a drum's flames reach up past its tile: oy goes negative)
   Anything without a sheet entry, or before the sheet has loaded, keeps
   drawing its old 16px art, so the revamp can land a piece at a time. */
(function (root) {
  'use strict';
  var ART = 2;
  var SHEETS = {
    props: { src: 'art/sheets/props.png', parts: {
      'mark:drumfire': { x: 0, y: 0, w: 32, h: 48, ox: 0, oy: -16 }
    } }
  };
  /* ── people: one sheet of layers, painted in KEY colours, stacked per look
     and recoloured to it (person below). PEOPLE lists the cells in order,
     16 to a row, 32px each: make_sheets.mjs paints them in the same order.
     right is left, mirrored ── */
  var DIRS3 = ['down', 'up', 'left'], CELL = 32, PER_ROW = 16;
  var HAIRS = ['short', 'buzz', 'long', 'bob', 'spiky', 'mohawk', 'undercut', 'hex'];
  var TOPS = ['tee', 'tank', 'hoodie', 'jacket', 'coat', 'turtleneck'];
  var BEARDS = ['stubble', 'mustache', 'goatee', 'circle', 'full', 'sideburns'];
  var ACCS = ['cap', 'headphones', 'glasses', 'mask', 'choker', 'earring', 'studs'];
  var MARKS = ['freckles', 'scar', 'mole', 'chrome', 'implant', 'barcode'];
  var PEOPLE = [];
  DIRS3.forEach(function (d) { for (var f = 0; f < 4; f++) PEOPLE.push('body:' + d + ':' + f); });
  TOPS.forEach(function (t) { DIRS3.forEach(function (d) { PEOPLE.push('top:' + t + ':' + d); }); });
  HAIRS.forEach(function (t) { DIRS3.forEach(function (d) { PEOPLE.push('hair:' + t + ':' + d); }); });
  BEARDS.forEach(function (t) { ['down', 'left'].forEach(function (d) { PEOPLE.push('beard:' + t + ':' + d); }); });
  ACCS.forEach(function (t) { DIRS3.forEach(function (d) { PEOPLE.push('acc:' + t + ':' + d); }); });
  MARKS.forEach(function (t) { ['down', 'left'].forEach(function (d) { PEOPLE.push('mark:' + t + ':' + d); }); });
  DIRS3.forEach(function (d) { PEOPLE.push('fur:' + d); });
  /* the key colours: three tones of skin, hair and top (light, base,
     shade), two of the rest, and single ones for eyes, mouth and marks */
  var KEY = { s1: '#ff0001', s2: '#ff0002', s3: '#ff0003', h1: '#00ff01', h2: '#00ff02', h3: '#00ff03', c1: '#0000f1', c2: '#0000f2', c3: '#0000f3',
              p1: '#ff00f1', p2: '#ff00f2', k1: '#00fff1', k2: '#00fff2', a1: '#ffff01', a2: '#ffff02', b1: '#f0f001', b2: '#f0f002',
              e: '#010101', w: '#fefefe', m: '#800001', g: '#01ff80', r: '#800080', f: '#808001', d: '#020202' };
  SHEETS.people = { src: 'art/sheets/people.png', parts: {} };
  PEOPLE.forEach(function (k, i) { SHEETS.people.parts['p:' + k] = { x: (i % PER_ROW) * CELL, y: Math.floor(i / PER_ROW) * CELL, w: CELL, h: CELL, ox: 0, oy: 0 }; });

  function rgbOf(hex) { var n = parseInt(String(hex).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  /* a tone: f under 1 darkens, over 1 mixes towards white */
  function tone(hex, f) {
    var c = rgbOf(hex || '#888888');
    return c.map(function (v) { return Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); });
  }
  function ramps(look) {
    var S = look.S || '#c88a64', H = look.H || '#3a2a20', C = look.C || '#9f8cff', P = look.P || '#2a2f4a', k = look.k || '#111111', A = look.A || '#d8dce8', B = look.B || H;
    return { s1: tone(S, 1.16), s2: tone(S, 1), s3: tone(S, 0.78), h1: tone(H, 1.25), h2: tone(H, 1), h3: tone(H, 0.68),
             c1: tone(C, 1.18), c2: tone(C, 1), c3: look.c ? tone(look.c, 1) : tone(C, 0.7), p1: tone(P, 1.15), p2: tone(P, 0.75),
             k1: tone(k, 1.2), k2: tone(k, 1), a1: tone(A, 1.25), a2: tone(A, 1), b1: tone(B, 1), b2: tone(B, 0.8),
             e: tone(look.E || '#0b0d1a', 1), w: [244, 246, 255], m: tone(look.m || '#7a3a3a', 1), g: [124, 245, 255], r: [212, 138, 138], f: tone(S, 0.62), d: tone('#0b0d1a', 1) };
  }
  /* the people sheet, read once into key numbers (KEYS index + 1, 0 for
     empty), so stacking a figure never touches a canvas until the end */
  var KEYS = Object.keys(KEY), KEY_OF = {}, sheetKeys = null, sheetW = 0;
  KEYS.forEach(function (k, i) { var c = rgbOf(KEY[k]); KEY_OF[(c[0] << 16) | (c[1] << 8) | c[2]] = i + 1; });
  function readPeople() {
    var im = imgs.people, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    var g = c.getContext('2d'); g.drawImage(im, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height).data, out = new Uint8Array(c.width * c.height);
    for (var i = 0; i < out.length; i++) if (d[i * 4 + 3] >= 128) out[i] = KEY_OF[(d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]] || 0;
    sheetKeys = out; sheetW = c.width;
  }
  var OUTLINE = [11, 13, 26], people = {}, peopleN = 0, keyOf = new WeakMap();
  /* someone at 32px: the layers for their look, stacked, recoloured, the
     right way round, outlined. step: 0 standing, 1 and 2 the feet, 3 a
     breath out (head and shoulders down a pixel). null until the sheet is in */
  function person(look, dir, step) {
    if (!ready.people || typeof document === 'undefined') return null;
    var key = (keyOf.get(look) || keyOf.set(look, JSON.stringify(look)).get(look)) + dir + step;
    if (people[key]) return people[key];
    if (++peopleN > 2000) { people = {}; peopleN = 1; }
    if (!sheetKeys) readPeople();
    var flip = dir === 'right', d = flip ? 'left' : dir, dy = step === 3 ? 1 : 0, buf = new Uint8Array(CELL * CELL);
    function lay(k, oy) {
      var p = SHEETS.people.parts['p:' + k];
      if (!p) return;
      oy = oy || 0;
      for (var y = 0; y < CELL - oy; y++) for (var x = 0; x < CELL; x++) { var v = sheetKeys[(p.y + y) * sheetW + p.x + x]; if (v) buf[(y + oy) * CELL + x] = v; }
    }
    lay('body:' + d + ':' + step);
    lay('top:' + (TOPS.indexOf(look.top) >= 0 ? look.top : 'tee') + ':' + d, dy);
    /* a barcode hides under a high collar */
    if (d !== 'up' && MARKS.indexOf(look.marks) >= 0 && !(look.marks === 'barcode' && /^(turtleneck|hoodie|coat)$/.test(look.top))) lay('mark:' + look.marks + ':' + d, dy);
    if (d !== 'up' && BEARDS.indexOf(look.beard) >= 0) lay('beard:' + look.beard + ':' + d, dy);
    if (look.fur) lay('fur:' + d, dy);
    lay('hair:' + (HAIRS.indexOf(look.hair) >= 0 ? look.hair : 'short') + ':' + d, dy);
    if (ACCS.indexOf(look.acc) >= 0) lay('acc:' + look.acc + ':' + d, dy);
    /* the key colours become theirs; hex's dye splits down the middle */
    var R = ramps(look), split = look.h && look.h !== look.H ? ramps({ H: look.h }) : null;
    var cols = KEYS.map(function (k) { return R[k]; }), hcols = split ? KEYS.map(function (k) { return k.charAt(0) === 'h' ? split[k] : R[k]; }) : cols;
    var c = document.createElement('canvas'); c.width = c.height = CELL;
    var g = c.getContext('2d'), id = g.createImageData(CELL, CELL), px = id.data;
    for (var y = 0; y < CELL; y++) for (var x = 0; x < CELL; x++) {
      var j = y * CELL + x, v = buf[j], o = (y * CELL + (flip ? CELL - 1 - x : x)) * 4, col;
      if (v) col = (x >= CELL / 2 ? hcols : cols)[v - 1];
      /* the outline: every empty pixel touching the figure goes dark */
      else if ((x > 0 && buf[j - 1]) || (x < CELL - 1 && buf[j + 1]) || (y > 0 && buf[j - CELL]) || (y < CELL - 1 && buf[j + CELL])) col = OUTLINE;
      else continue;
      px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return (people[key] = c);
  }

  var imgs = {}, ready = {};
  function load(base) {
    if (typeof Image === 'undefined') return;
    Object.keys(SHEETS).forEach(function (k) {
      if (imgs[k]) return;
      var im = new Image();
      im.onload = function () { ready[k] = true; };
      im.src = (base || '') + SHEETS[k].src;
      imgs[k] = im;
    });
  }
  /* the sheet and cell for a key, once its sheet has loaded */
  function part(key) {
    for (var k in SHEETS) { var p = SHEETS[k].parts[key]; if (p) return ready[k] ? { img: imgs[k], p: p } : null; }
    return null;
  }
  function has(key) { return !!part(key); }
  /* draw a part hung from a tile corner at (x, y) in game units */
  function draw(ctx, key, x, y) {
    var a = part(key);
    if (!a) return false;
    var p = a.p;
    ctx.drawImage(a.img, p.x, p.y, p.w, p.h, x + p.ox / ART, y + p.oy / ART, p.w / ART, p.h / ART);
    return true;
  }
  root.MFArt = { ART: ART, SHEETS: SHEETS, load: load, part: part, has: has, draw: draw,
                  CELL: CELL, PER_ROW: PER_ROW, PEOPLE: PEOPLE, KEY: KEY, HAIRS: HAIRS, TOPS: TOPS, BEARDS: BEARDS, ACCS: ACCS, MARKS: MARKS, person: person, get peopleReady() { return !!ready.people; } };
  /* in a page, the sheets start loading straight away (beside index.html) */
  if (typeof document !== 'undefined') load(root.MF_ART_BASE || '');
})(typeof window !== 'undefined' ? window : globalThis);
