/* EXiLED teknoa 2d — the operator's face. Pixel layers drawn in code until
   there is real art; swap a part's rows for a drawn sprite later and nothing
   else changes. No DOM in here: render() returns an SVG string.

   A part is 16 rows of 16 columns, bottom of the bust at row 19 (20 rows).
   Each character is a colour role:
     .  nothing          S s  skin, skin shade      H h  hair, hair shade
     E  eye colour       W    eye white             C c  cloth, cloth shade
     k  undershirt dark  A    accent (metal)        m    mouth
   Layers draw in order: base, top, eyes, hair, accessory. */
(function (root) {
  var W = 16, H = 20;

  var BASE = [
    '................',
    '................',
    '................',
    '.....SSSSSS.....',
    '....SSSSSSSS....',
    '....SSSSSSSS....',
    '....SSSSSSSS....',
    '...sSSSSSSSSs...',
    '...sSSSSSSSSs...',
    '....SSSSSSSS....',
    '....SSSmmSSS....',
    '.....SSSSSS.....',
    '......ssss......',
    '......SSSS......',
  ];

  var PARTS = {
    eyes: {
      plain:  { 8: '.....EE..EE.....' },
      bright: { 7: '.....WE..EW.....', 8: '.....EE..EE.....' },
      narrow: { 7: '.....ss..ss.....', 8: '......E..E......' },
      visor:  { 7: '....EEEEEEEE....', 8: '....EEEEEEEE....' },
    },
    hair: {
      buzz:    { 3: '.....HHHHHH.....', 4: '....HHHHHHHH....', 5: '....h......h....' },
      bob:     { 2: '.....HHHHHH.....', 3: '....HHHHHHHH....', 4: '...HHHHHHHHHH...', 5: '...HHH....HHH...',
                 6: '...HH......HH...', 7: '...H........H...', 8: '...H........H...', 9: '...H........H...',
                 10: '...hh......hh...' },
      long:    { 2: '.....HHHHHH.....', 3: '....HHHHHHHH....', 4: '...HHHHHHHHHH...', 5: '...HHHH...HHH...',
                 6: '...HH......HH...', 7: '..HH........HH..', 8: '..HH........HH..', 9: '..HH........HH..',
                 10: '..HH........HH..', 11: '..HHH......HHH..', 12: '..HHH......HHH..', 13: '..hhh......hhh..',
                 14: '..hh........hh..' },
      spiky:   { 1: '....H..H..H.....', 2: '....HH.HH.HH.H..', 3: '....HHHHHHHHHH..', 4: '....HHHHHHHH....',
                 5: '....h.h....h....' },
      mohawk:  { 0: '.......HH.......', 1: '.......HH.......', 2: '.......HH.......', 3: '......HHHH......',
                 4: '.....hHHHHh.....' },
      undercut:{ 2: '......HHHHHH....', 3: '....HHHHHHHHH...', 4: '....HHHHHHHHHH..', 5: '....h....HHHHH..',
                 6: '.........HHHH...', 7: '..........HH....' },
    },
    top: {
      tee:    { 14: '...CCCCSSCCCC...', 15: '..CCCCCCCCCCCC..', 16: '.CCCCCCCCCCCCCC.',
                17: 'CCCCCCCCCCCCCCCC', 18: 'CCCCCCCCCCCCCCCC', 19: 'CCCCCCCCCCCCCCCC' },
      hoodie: { 12: '....cc....cc....', 13: '....cC....Cc....', 14: '...cCCCCCCCCc...', 15: '..cCCCCCCCCCCc..',
                16: '.cCCCCcCCcCCCCc.', 17: 'cCCCCCcCCcCCCCCc', 18: 'cCCCCCCCCCCCCCCc', 19: 'cCCCCCCCCCCCCCCc' },
      jacket: { 14: '...CCCcSScCCC...', 15: '..CCCCckkcCCCC..', 16: '.CCCCCckkcCCCCC.',
                17: 'CCCCCCckkcCCCCCC', 18: 'CCCCCCckkcCCCCCC', 19: 'CCCCCCckkcCCCCCC' },
      coat:   { 12: '....CC....CC....', 13: '....CCC..CCC....', 14: '...cCCCCCCCCc...', 15: '..cCCCCcCCCCCc..',
                16: '.cCCCCCACCCCCCc.', 17: 'cCCCCCCcCCCCCCCc', 18: 'cCCCCCCACCCCCCCc', 19: 'cCCCCCCcCCCCCCCc' },
    },
    acc: {
      none:    {},
      choker:  { 13: '......AAAA......' },
      earring: { 9: '...A............', 10: '...A............' },
      glasses: { 7: '....AAAA.AAAA...', 8: '....A..AAA..A...' },
      mask:    { 9: '....AAAAAAAA....', 10: '....AAAAAAAA....', 11: '.....AAAAAA.....' },
      studs:   { 13: '......AAAA......', 7: '............A...', 8: '............A...' },
    },
  };

  var COLORS = {
    skin:  ['#F6D7C3', '#E8B796', '#C98E6A', '#A06A48', '#7A4B32', '#4E2F20'],
    hair:  ['#14121C', '#4A2E1E', '#C9A25A', '#E8E4F0', '#9F8CFF', '#FF4FD8', '#7CF5FF', '#C4374A', '#7CFFB2'],
    eye:   ['#3A2A1E', '#3F7FBF', '#4F9E62', '#9F8CFF', '#FF4FD8', '#7CF5FF', '#F2C94C'],
    cloth: ['#14121C', '#2A1D5E', '#5A1E3C', '#1E3A4A', '#3A3F4A', '#DCE3FF', '#7A1F2B'],
    acc:   ['#B9C0D8', '#F2C94C', '#FF4FD8', '#7CF5FF'],
  };

  /* what a look is made of, in the order the creator shows them */
  var SLOTS = [
    { key: 'skin',     label: 'skin',      colors: 'skin' },
    { key: 'hair',     label: 'hair',      part: 'hair' },
    { key: 'hairC',    label: 'hair dye',  colors: 'hair' },
    { key: 'eyes',     label: 'eyes',      part: 'eyes' },
    { key: 'eyeC',     label: 'eye colour', colors: 'eye' },
    { key: 'top',      label: 'top',       part: 'top' },
    { key: 'topC',     label: 'top colour', colors: 'cloth' },
    { key: 'acc',      label: 'extra',     part: 'acc' },
    { key: 'accC',     label: 'extra colour', colors: 'acc' },
  ];
  function options(slot) { return slot.part ? Object.keys(PARTS[slot.part]) : COLORS[slot.colors]; }

  /* a look always comes out complete and valid, whatever went in: a save
     edited by hand, or from an older build with fewer parts */
  function normalize(look) {
    var out = {}, l = look && typeof look === 'object' ? look : {};
    SLOTS.forEach(function (s) {
      var o = options(s), v = l[s.key];
      out[s.key] = o.indexOf(v) >= 0 ? v : o[0];
    });
    return out;
  }
  function random(rng) {
    var r = rng || Math.random, out = {};
    SLOTS.forEach(function (s) { var o = options(s); out[s.key] = o[Math.floor(r() * o.length)]; });
    return out;
  }
  function cycle(look, key, step) {
    var s = SLOTS.filter(function (x) { return x.key === key; })[0];
    if (!s) return normalize(look);
    var o = options(s), n = normalize(look), i = o.indexOf(n[key]);
    n[key] = o[(i + step + o.length) % o.length];
    return n;
  }

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return ('0' + Math.round(v * f).toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }

  /* the grid: one colour (or nothing) per pixel */
  function grid(look) {
    var l = normalize(look), px = [], y, x;
    var pal = { S: l.skin, s: shade(l.skin, 0.78), m: shade(l.skin, 0.6), H: l.hairC, h: shade(l.hairC, 0.7),
                E: l.eyeC, W: '#F4F6FF', C: l.topC, c: shade(l.topC, 0.72), k: '#0B0D1A', A: l.accC };
    for (y = 0; y < H; y++) { px.push([]); for (x = 0; x < W; x++) px[y].push(null); }
    function draw(rows) {
      for (var k in rows) {
        var r = rows[k], yy = +k;
        for (var xx = 0; xx < W; xx++) { var ch = r.charAt(xx); if (ch && ch !== '.') px[yy][xx] = pal[ch]; }
      }
    }
    var base = {}; BASE.forEach(function (r, i) { base[i] = r; });
    draw(base); draw(PARTS.top[l.top]); draw(PARTS.eyes[l.eyes]); draw(PARTS.hair[l.hair]); draw(PARTS.acc[l.acc]);
    return px;
  }

  /* runs of one colour on a row become one rect: ~60 rects, not 300 */
  function render(look, size) {
    var px = grid(look), out = [], y, x;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; ) {
        var c = px[y][x], n = 1;
        if (!c) { x++; continue; }
        while (x + n < W && px[y][x + n] === c) n++;
        out.push('<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + c + '"/>');
        x += n;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' +
      (size ? ' width="' + size + '" height="' + Math.round(size * H / W) + '"' : '') +
      ' shape-rendering="crispEdges" role="img" aria-label="your operator">' + out.join('') + '</svg>';
  }

  root.MFAvatar = { W: W, H: H, PARTS: PARTS, COLORS: COLORS, SLOTS: SLOTS, options: options,
                    normalize: normalize, random: random, cycle: cycle, grid: grid, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
