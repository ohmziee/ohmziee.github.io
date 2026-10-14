/* EXiLED teknoa 2d — the operator's face. Pixel layers drawn in code until
   there is real art; swap a part's rows for a drawn sprite later and nothing
   else changes. No DOM in here: render() returns an SVG string.

   A part is 16 rows of 16 columns, bottom of the bust at row 19 (20 rows).
   Each character is a colour role:
     .  nothing          S s  skin, skin shade      H h  hair, hair shade
     E  eye colour       W    eye white             C c  cloth, cloth shade
     k  undershirt dark  A    accent (metal)        m    mouth
     B  facial hair (the hair dye, a touch darker)
     f  freckle / mole (skin, darker)  r  scar     G  implant glow
     F g  fur, fur shade (simians)     q    panel seam (androids)
   Layers draw in order: base, top, eyes, marks, facial hair, hair, accessory.

   A look has a kind: human, android, or a great ape (chimp, gorilla,
   orangutan, bonobo). The origin decides which kinds it may be (KINDS_OF);
   each kind's group decides which slots the creator shows (slots()). For a
   simian the skin slot is its fur, and hair and facial hair don't draw. */
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

  /* a great ape's head: fur all round, a bare face, a muzzle */
  var APE_BASE = [
    '................',
    '................',
    '.....FFFFFF.....',
    '....FFFFFFFF....',
    '...FFFFFFFFFF...',
    '...FFSSSSSSFF...',
    '..FFssssssssFF..',
    '..FFSSSSSSSSFF..',
    '..FFSSSSSSSSFF..',
    '...FFSSssSSFF...',
    '...FFSSmmSSFF...',
    '....FSSSSSSF....',
    '.....gFFFFg.....',
    '......FFFF......',
  ];
  /* what makes each species itself, over APE_BASE; FACE is its bare skin */
  var SPECIES = {
    chimp:     { 6: '.S............S.', 7: '.SS..........SS.', 8: '.S............S.' },
    gorilla:   { 1: '......FFFF......', 2: '....FFFFFFFF....', 6: '..FFggggggggFF..', 11: '...FSSSSSSSSF...' },
    orangutan: { 6: '.sFFssssssssFFs.', 7: 'ssFFSSSSSSSSFFss', 8: 'ssFFSSSSSSSSFFss', 9: '.sFFFSSssSSFFFs.', 10: '..sFFSSmmSSFFs..',
                 11: '..FFSSSSSSSSFF..', 12: '..FFgFFFFFFgFF..', 13: '..FF..FFFF..FF..' },
    bonobo:    { 2: '....FFF..FFF....', 3: '...FFFFF.FFFF...', 5: '..FFFSSSSSSFFF..' }
  };
  var FACE = { chimp: '#A88468', gorilla: '#55504F', orangutan: '#5A4038', bonobo: '#4A3C3C' };
  var APES = Object.keys(SPECIES);
  /* an android's panel lines */
  var SEAMS = { 4: '.......q........', 6: '....q......q....', 10: '....q......q....', 11: '.....q....q.....' };
  /* which kinds each origin can be; anyone else is human */
  var KINDS_OF = { simian: APES, ai: ['android'] };
  var KINDS = ['human', 'android'].concat(APES);

  var PARTS = {
    species: { chimp: {}, gorilla: {}, orangutan: {}, bonobo: {} },
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
    /* marks: what the hospital's cosmetic wing does. none first */
    marks: {
      none:     {},
      freckles: { 9: '....f.f..f.f....', 10: '.....f....f.....' },
      scar:     { 5: '.........r......', 6: '.........r......', 9: '..........r.....', 10: '..........r.....' },
      mole:     { 9: '..........f.....' },
      chrome:   { 9: '....AA..........', 10: '....AA..........', 11: '.....A..........' },
      implant:  { 9: '....G......G....', 10: '....G......G....', 11: '.....G....G.....' },
      /* corpocult's stamp on a product: on the neck, hidden by a high collar */
      barcode:  { 12: '......k.kk......', 13: '......kk.k......' },
    },
    /* facial hair takes the hair dye. none first: an old look has none */
    beard: {
      none:      {},
      stubble:   { 10: '....B.B..B.B....', 11: '.....B.BB.B.....' },
      mustache:  { 9: '.....BBBBBB.....' },
      goatee:    { 11: '......BBBB......', 12: '.......BB.......' },
      circle:    { 9: '.....BBBBBB.....', 10: '......B..B......', 11: '......BBBB......' },
      full:      { 7: '....B......B....', 8: '....B......B....', 9: '....BBBBBBBB....', 10: '....BBB..BBB....',
                   11: '.....BBBBBB.....', 12: '......BBBB......' },
      sideburns: { 6: '....B......B....', 7: '....B......B....', 8: '....BB....BB....' },
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
      tank:   { 14: '....SCCSSCCS....', 15: '..SSCCCCCCCCSS..', 16: '.SSSCCCCCCCCSSS.',
                17: 'SSSScCCCCCCcSSSS', 18: 'SSSScCCCCCCcSSSS', 19: 'SSSScCCCCCCcSSSS' },
      turtleneck: { 12: '......CCCC......', 13: '.....cCCCCc.....', 14: '...CCCCCCCCCC...', 15: '..CCCCCCCCCCCC..',
                16: '.CCCCCCCCCCCCCC.', 17: 'CCCCCCCCCCCCCCCC', 18: 'CCCCCCCCCCCCCCCC', 19: 'cCCCCCCCCCCCCCCc' },
    },
    acc: {
      none:    {},
      choker:  { 13: '......AAAA......' },
      earring: { 9: '...A............', 10: '...A............' },
      glasses: { 7: '....AAAA.AAAA...', 8: '....A..AAA..A...' },
      mask:    { 9: '....AAAAAAAA....', 10: '....AAAAAAAA....', 11: '.....AAAAAA.....' },
      studs:   { 13: '......AAAA......', 7: '............A...', 8: '............A...' },
      headphones: { 2: '.....AAAAAA.....', 3: '....A......A....', 4: '...A........A...', 5: '...A........A...',
                    6: '...A........A...', 7: '..AA........AA..', 8: '..AA........AA..', 9: '..AA........AA..' },
      cap:     { 2: '.....AAAAAA.....', 3: '....AAAAAAAA....', 4: '....AAAAAAAAAAA.' },
    },
  };

  var COLORS = {
    skin:  ['#F6D7C3', '#E8B796', '#C98E6A', '#A06A48', '#7A4B32', '#4E2F20'],
    hair:  ['#14121C', '#4A2E1E', '#C9A25A', '#E8E4F0', '#9F8CFF', '#FF4FD8', '#7CF5FF', '#C4374A', '#7CFFB2'],
    eye:   ['#3A2A1E', '#3F7FBF', '#4F9E62', '#9F8CFF', '#FF4FD8', '#7CF5FF', '#F2C94C'],
    cloth: ['#14121C', '#2A1D5E', '#5A1E3C', '#1E3A4A', '#3A3F4A', '#DCE3FF', '#7A1F2B', '#2F5A3A', '#C9A25A', '#FF4FD8'],
    acc:   ['#B9C0D8', '#F2C94C', '#FF4FD8', '#7CF5FF', '#14121C', '#C4374A', '#7CFFB2'],
    fur:   ['#1A1410', '#2A2018', '#3A2A1C', '#4A3A2A', '#6A4A2A', '#A0522D', '#C8642A', '#8A8A8A'],
    synth: ['#C8CCD8', '#9AA0B8', '#D8DCE8', '#8A92A6', '#5A6070', '#1C1736', '#F6D7C3', '#C98E6A', '#7A4B32'],
    glow:  ['#7CF5FF', '#FF4FD8', '#7CFFB2', '#F2C94C', '#FF4F5E', '#9F8CFF'],
  };

  /* what a look is made of, in the order the creator shows them */
  var SLOTS = [
    { key: 'skin',     label: 'skin',      colors: 'skin' },
    { key: 'hair',     label: 'hair',      part: 'hair' },
    { key: 'hairC',    label: 'hair dye',  colors: 'hair' },
    { key: 'beard',    label: 'facial hair', part: 'beard' },
    { key: 'eyes',     label: 'eyes',      part: 'eyes' },
    { key: 'eyeC',     label: 'eye colour', colors: 'eye' },
    { key: 'marks',    label: 'marks',     part: 'marks' },
    { key: 'top',      label: 'top',       part: 'top' },
    { key: 'topC',     label: 'top colour', colors: 'cloth' },
    { key: 'acc',      label: 'extra',     part: 'acc' },
    { key: 'accC',     label: 'extra colour', colors: 'acc' },
  ];
  /* the slots each group shows. a simian's skin is fur; an android's skin
     is synthetic and its eyes glow */
  function slotDef(key, over) {
    var s = SLOTS.filter(function (x) { return x.key === key; })[0], o = {}, k;
    for (k in s) o[k] = s[k];
    for (k in over || {}) o[k] = over[k];
    return o;
  }
  var GROUP_SLOTS = {
    human: SLOTS,
    ape: [{ key: 'kind', label: 'species', part: 'species' }, slotDef('skin', { label: 'fur', colors: 'fur' }), slotDef('eyes'), slotDef('eyeC'),
          slotDef('marks'), slotDef('top'), slotDef('topC'), slotDef('acc'), slotDef('accC')],
    android: SLOTS.map(function (s) {
      return s.key === 'skin' ? slotDef('skin', { label: 'chassis', colors: 'synth' }) : s.key === 'eyeC' ? slotDef('eyeC', { label: 'eye glow', colors: 'glow' }) : s;
    })
  };
  function group(kind) { return APES.indexOf(kind) >= 0 ? 'ape' : kind === 'android' ? 'android' : 'human'; }
  function slots(look) { return GROUP_SLOTS[group(look && look.kind)]; }
  /* a product's barcode is theirs alone; with no origin given, anything goes */
  function options(slot, origin) {
    var o = slot.part ? Object.keys(PARTS[slot.part]) : COLORS[slot.colors];
    if (slot.part === 'marks' && origin && origin !== 'product') o = o.filter(function (m) { return m !== 'barcode'; });
    return o;
  }
  function kindsFor(origin) { return origin ? KINDS_OF[origin] || ['human'] : KINDS; }
  function kindFor(origin, kind) { var ok = kindsFor(origin); return ok.indexOf(kind) >= 0 ? kind : ok[0]; }
  function defFor(gs, s) { return gs.filter(function (x) { return x.key === s.key; })[0] || s; }

  /* a look always comes out complete and valid, whatever went in: a save
     edited by hand, or from an older build with fewer parts. origin, if
     given, holds it to the kinds and marks that origin can have */
  function normalize(look, origin) {
    var l = look && typeof look === 'object' ? look : {}, kind = kindFor(origin, l.kind), out = { kind: kind }, gs = GROUP_SLOTS[group(kind)];
    SLOTS.forEach(function (s) {
      var o = options(defFor(gs, s), origin), v = l[s.key];
      out[s.key] = o.indexOf(v) >= 0 ? v : o[0];
    });
    return out;
  }
  function random(rng, origin) {
    var r = rng || Math.random, kinds = origin ? kindsFor(origin) : ['human'], out = { kind: kinds[Math.floor(r() * kinds.length)] };
    var gs = GROUP_SLOTS[group(out.kind)];
    SLOTS.forEach(function (s) { var o = options(defFor(gs, s), origin); out[s.key] = o[Math.floor(r() * o.length)]; });
    /* about half of new faces come clean-shaven */
    if (r() < 0.5) out.beard = 'none';
    /* and most without marks: those are a choice. a product comes stamped */
    if (r() < 0.7 || out.marks === 'barcode') out.marks = 'none';
    if (origin === 'product') out.marks = 'barcode';
    return normalize(out, origin);
  }
  function cycle(look, key, step, origin) {
    var n = normalize(look, origin), s = slots(n).filter(function (x) { return x.key === key; })[0];
    if (!s) return n;
    var o = key === 'kind' ? (origin ? kindsFor(origin) : APES) : options(s, origin), i = o.indexOf(n[key]);
    n[key] = o[(i + step + o.length) % o.length];
    return normalize(n, origin);
  }

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return ('0' + Math.round(v * f).toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }

  /* the grid: one colour (or nothing) per pixel */
  function grid(look) {
    var l = normalize(look), px = [], y, x, g = group(l.kind), face = g === 'ape' ? FACE[l.kind] : l.skin;
    var pal = { S: face, s: shade(face, 0.78), m: shade(face, 0.6), H: l.hairC, h: shade(l.hairC, 0.7),
                E: l.eyeC, W: '#F4F6FF', C: l.topC, c: shade(l.topC, 0.72), k: '#0B0D1A', A: l.accC, B: shade(l.hairC, 0.85),
                f: shade(face, 0.62), r: '#D48A8A', G: '#7CF5FF', F: l.skin, g: shade(l.skin, 0.7), q: shade(l.skin, 0.68) };
    for (y = 0; y < H; y++) { px.push([]); for (x = 0; x < W; x++) px[y].push(null); }
    function draw(rows) {
      for (var k in rows) {
        var r = rows[k], yy = +k;
        for (var xx = 0; xx < W; xx++) { var ch = r.charAt(xx); if (ch && ch !== '.') px[yy][xx] = pal[ch]; }
      }
    }
    var base = {}; (g === 'ape' ? APE_BASE : BASE).forEach(function (r, i) { base[i] = r; });
    draw(base);
    if (g === 'ape') draw(SPECIES[l.kind]);
    if (g === 'android') draw(SEAMS);
    draw(PARTS.top[l.top]); draw(PARTS.eyes[l.eyes]);
    /* a high collar hides the barcode */
    if (!(l.marks === 'barcode' && /^(turtleneck|hoodie|coat)$/.test(l.top))) draw(PARTS.marks[l.marks]);
    if (g !== 'ape') { draw(PARTS.beard[l.beard]); draw(PARTS.hair[l.hair]); }
    draw(PARTS.acc[l.acc]);
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

  root.MFAvatar = { W: W, H: H, PARTS: PARTS, COLORS: COLORS, SLOTS: SLOTS, options: options, slots: slots, group: group, kindFor: kindFor,
                    KINDS: KINDS, KINDS_OF: KINDS_OF, APES: APES, FACE: FACE,
                    normalize: normalize, random: random, cycle: cycle, grid: grid, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
