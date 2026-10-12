/* EXiLED teknoa 2d — Nova City, as a tile map. No DOM in here: it builds the
   map from a description and answers questions about it; overworld.js draws
   it and walks the player around. Runs under node for the tests.

   FIRST DRAFT, from the vault: six islands in the Nova Sea, bridged, with the
   Vistadelsol mainland across the water to the north. Each island's size is
   its real area (km²) and its place is its compass point, packed so the
   gaps are a short bridge, not a voyage. Change a number here and the city
   is rebuilt; nothing is hand-painted yet.

   Tiles:  0 deep water  1 shallow  2 sand  3 ground  4 road  5 building
           6 tree  7 bridge  8 grass  9 landmark  10 mainland  11 stall
           indoors: 12 floor  13 wall  14 door mat  15 tiled floor */
(function (root) {
  var W = 460, H = 370;
  /* bump when the map changes shape: a saved position from an older map
     means nothing on this one, so that player starts at the spawn */
  var VERSION = 4;
  var T = { DEEP: 0, SHALLOW: 1, SAND: 2, GROUND: 3, ROAD: 4, BUILDING: 5, TREE: 6, BRIDGE: 7,
            GRASS: 8, LANDMARK: 9, MAINLAND: 10, STALL: 11, FLOOR: 12, WALL: 13, MAT: 14, CHECK: 15 };
  var SOLID = {}; SOLID[T.DEEP] = SOLID[T.SHALLOW] = SOLID[T.BUILDING] = SOLID[T.TREE] = SOLID[T.LANDMARK] = SOLID[T.MAINLAND] = SOLID[T.STALL] = SOLID[T.WALL] = 1;

  /* r is in tiles: sqrt(area) scaled, so the islands keep their real
     proportions. style picks how the streets are laid. Redrum sits out on
     its own causeway so Noorborj is the city's northernmost point. */
  var DISTRICTS = [
    { id: 'worldwood', name: 'WORLDWOOD', sub: 'district 1 // the neon heart', km: 132, at: [0, 0], style: 'grid', block: 5, seed: 11, wobble: 0.10 },
    { id: 'yucayeque', name: 'YUCAYEQUE', sub: 'district 2 // markets and old songs', km: 222, at: [1, -0.3], style: 'village', block: 4, seed: 23, wobble: 0.16 },
    { id: 'naturia', name: 'NATURIA', sub: 'district 3 // the glowing wild', km: 139, at: [-1, -0.3], style: 'wild', block: 6, seed: 37, wobble: 0.18 },
    { id: 'haven', name: 'HAVEN', sub: 'district 4 // where the council sits', km: 88, at: [1, 1], style: 'civic', block: 7, seed: 41, wobble: 0.04 },
    { id: 'majinryu', name: 'MAJINRYŪ', sub: 'district 5 // lanterns and labs', km: 72, at: [-1, 1], style: 'grid', block: 4, seed: 53, wobble: 0.12 },
    { id: 'redrum', name: 'REDRUM', sub: 'district 6 // unofficially', km: 13, at: [0, -1], style: 'alleys', block: 3, seed: 67, wobble: 0.14, gap: 22 }
  ];
  var CENTRE = [232, 185], GAP = 4, SCALE = 3.0;
  /* the bay round the city was laid out at SCALE 2.45; K grows it with the city.
     at(ox, oy) is a point that far from the centre, at the first layout's scale */
  var K = SCALE / 2.45;
  function atK(ox, oy) { return [Math.round(CENTRE[0] + ox * K), Math.round(CENTRE[1] + oy * K)]; }
  /* hand-placed offsets (landmarks, shops, people) were laid out at the
     first draft's scale; F spreads them out to match */
  var F = SCALE / 1.55;

  /* deterministic noise: the same city every load, on every device */
  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function build() {
    var tile = new Uint8Array(W * H), dist = new Int8Array(W * H).fill(-1);
    var marks = [], signs = [], npcs = [];
    var at = function (x, y) { return y * W + x; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
    function set(x, y, t, d) { if (!inside(x, y)) return; tile[at(x, y)] = t; if (d !== undefined) dist[at(x, y)] = d; }
    function get(x, y) { return inside(x, y) ? tile[at(x, y)] : T.DEEP; }

    /* place: Worldwood in the middle, the rest one gap off its shore */
    DISTRICTS.forEach(function (d, i) {
      d.index = i; d.r = Math.sqrt(d.km) * SCALE;
      if (!d.at[0] && !d.at[1]) { d.cx = CENTRE[0]; d.cy = CENTRE[1]; return; }
      var len = Math.sqrt(d.at[0] * d.at[0] + d.at[1] * d.at[1]), w0 = DISTRICTS[0], rw = Math.sqrt(w0.km) * SCALE;
      var far = rw + d.r + (d.gap || GAP);
      d.cx = Math.round(CENTRE[0] + d.at[0] / len * far);
      d.cy = Math.round(CENTRE[1] + d.at[1] / len * far);
    });

    /* vistadelsol: the coast round the nova sea, as the terranova map has
       it (azgaar, Terranova_2036 in the vault). nova city sits in a bay:
       land to the north-west, a peninsula to the south-west, the coast down
       the east and along the south. the bay opens north, and a strait opens
       west onto the jörmun ocean. dist -2 is vistadelsol: not a district */
    function coast(x, y) {
      var n = 4 * Math.sin(y / 7) + 3 * Math.sin(x / 5 + y / 11), rx = (x - CENTRE[0]) / K, ry = (y - CENTRE[1]) / K;
      if (rx + n < -118 && ry + n < -38) return true;            /* the north-west land */
      if (ry + n < -130 && rx < -15) return true;                /* its north shore */
      if (rx + n < -120 && ry - n > 12) return true;             /* the south-west peninsula */
      if (ry - n > 114) return true;                             /* the south coast */
      if (rx - n > 130) return true;                             /* the east coast */
      if (ry + n < -128 && rx > 65) return true;                 /* the north-east */
      return false;
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (coast(x, y)) set(x, y, T.MAINLAND, -2);
    /* beaches where it meets the water, shallows off them */
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (get(x, y) !== T.MAINLAND) continue;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (inside(x + ox, y + oy) && get(x + ox, y + oy) === T.DEEP) { set(x, y, T.SAND, -2); oy = ox = 2; }
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (get(x, y) !== T.DEEP) continue;
      for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var c = get(x + ox, y + oy); if (inside(x + ox, y + oy) && (c === T.SAND || c === T.MAINLAND)) { set(x, y, T.SHALLOW); oy = ox = 3; } }
    }

    /* land: a wobbly disc per island, sand where it meets the water */
    function radiusAt(d, ang) {
      return d.r * (1 + d.wobble * (Math.sin(ang * 3 + d.seed) * 0.6 + Math.sin(ang * 5 + d.seed * 2) * 0.4));
    }
    DISTRICTS.forEach(function (d) {
      var R = Math.ceil(d.r * 1.4);
      for (var y = d.cy - R; y <= d.cy + R; y++) for (var x = d.cx - R; x <= d.cx + R; x++) {
        if (!inside(x, y)) continue;
        var dx = x - d.cx, dy = y - d.cy, r = radiusAt(d, Math.atan2(dy, dx)), dd = Math.sqrt(dx * dx + dy * dy);
        if (dd <= r) set(x, y, T.GROUND, d.index);
        else if (dd <= r + 2.2 && get(x, y) === T.DEEP) set(x, y, T.SHALLOW);
      }
    });
    /* vistadelsol's little islands in the bay: palms, fruit, nobody */
    ISLETS.forEach(function (o) {
      var R = o.r + 3;
      for (var y = o.y - R; y <= o.y + R; y++) for (var x = o.x - R; x <= o.x + R; x++) {
        var dd = Math.sqrt((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y)), r = o.r * (1 + 0.18 * Math.sin(Math.atan2(y - o.y, x - o.x) * 3 + o.x));
        if (dd <= r) set(x, y, hash(x, y + 7) < 0.16 ? T.TREE : T.GRASS, -2);
        else if (dd <= r + 2.2 && get(x, y) === T.DEEP) set(x, y, T.SHALLOW);
      }
    });
    for (var i = 0; i < W * H; i++) {
      if (tile[i] !== T.GROUND && !(tile[i] === T.GRASS && dist[i] === -2)) continue;
      var xx = i % W, yy = (i / W) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { var t = get(xx + o[0], yy + o[1]); return t === T.DEEP || t === T.SHALLOW; })) tile[i] = T.SAND;
    }

    /* streets, by district style. inner = land that is not beach */
    DISTRICTS.forEach(function (d) {
      var R = Math.ceil(d.r * 1.4);
      for (var y = d.cy - R; y <= d.cy + R; y++) for (var x = d.cx - R; x <= d.cx + R; x++) {
        if (!inside(x, y) || dist[at(x, y)] !== d.index || get(x, y) !== T.GROUND) continue;
        var gx = ((x - d.cx) % d.block + d.block) % d.block, gy = ((y - d.cy) % d.block + d.block) % d.block;
        var n = hash(x * 3 + d.seed, y * 7);
        var bx = Math.floor((x - d.cx) / d.block), by = Math.floor((y - d.cy) / d.block), bn = hash(bx * 13 + d.seed, by * 17 + 5);
        var mid = d.block >> 1;
        if (d.style === 'grid' || d.style === 'alleys') {
          if (!gx || !gy) set(x, y, T.ROAD);
          /* a plaza: a whole block left open, a tree or two in it */
          else if (bn < 0.3) set(x, y, n < 0.08 ? T.TREE : n < 0.2 ? T.GRASS : T.GROUND);
          /* an alley straight through the block */
          else if (bn < 0.75 && (bn < 0.52 ? gy === mid : gx === mid)) set(x, y, T.GROUND);
          else set(x, y, n < (d.style === 'alleys' ? 0.06 : 0.12) ? T.GROUND : T.BUILDING);
        } else if (d.style === 'civic') {
          /* wide boulevards, whole blocks of lawn */
          if (gx <= 1 || gy <= 1) set(x, y, T.ROAD);
          else if (hash(Math.floor((x - d.cx) / d.block), Math.floor((y - d.cy) / d.block) + d.seed) < 0.5) set(x, y, gx === 4 && gy === 4 ? T.TREE : T.GRASS);
          else set(x, y, T.BUILDING);
        } else if (d.style === 'village') {
          /* little houses in pairs, yards between, lanes that wander */
          var lane = (!gx && hash(Math.floor((y - d.cy) / 9), x) < 0.9) || (!gy && hash(Math.floor((x - d.cx) / 9), y + 5) < 0.9);
          if (lane) set(x, y, T.ROAD);
          /* houses in the middle of a block, yards round the edge */
          else if (n < 0.52 && gx > 1 && gy > 1 && gx < d.block && gy < d.block) set(x, y, T.BUILDING);
          else if (n > 0.88) set(x, y, T.TREE);
          else set(x, y, T.GROUND);
        } else if (d.style === 'wild') {
          /* forest, clearings, paths along the grain */
          var path = Math.abs(Math.sin((x - d.cx) / 3.1) * 3 - ((y - d.cy) % 7)) < 0.7 || !gx;
          if (path) set(x, y, T.ROAD);
          /* groves, not a wall of trees: thick in patches, open between */
          else if (n < (bn < 0.5 ? 0.6 : 0.22)) set(x, y, T.TREE);
          else if (n < (bn < 0.5 ? 0.64 : 0.25)) set(x, y, T.BUILDING);
          else set(x, y, T.GRASS);
        }
      }
    });

    /* a walkable line, x first then y, so it is always 4-connected */
    function carve(x0, y0, x1, y1, t, keep) {
      var x = x0, y = y0, sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
      function put() { var c = get(x, y); if (!keep || !keep[c]) set(x, y, t); }
      put();
      while (x !== x1) { x += sx; put(); }
      while (y !== y1) { y += sy; put(); }
    }
    var LAND = {}; [T.GROUND, T.ROAD, T.BUILDING, T.TREE, T.GRASS, T.STALL, T.LANDMARK, T.SAND].forEach(function (t) { LAND[t] = 1; });

    /* bridges: from one island's shore to the next, along the line between
       their centres, as a staircase two tiles wide */
    var LINKS = [['worldwood', 'yucayeque'], ['worldwood', 'naturia'], ['worldwood', 'haven'], ['worldwood', 'majinryu'],
                 ['worldwood', 'redrum'], ['redrum', 'naturia'], ['redrum', 'yucayeque'], ['haven', 'yucayeque'], ['majinryu', 'naturia']];
    var byId = {}; DISTRICTS.forEach(function (d) { byId[d.id] = d; });
    var landings = [];
    LINKS.forEach(function (l) {
      var a = byId[l[0]], b = byId[l[1]], steps = 400, last = null, first = null, k;
      for (k = 0; k <= steps; k++) {
        var px = Math.round(a.cx + (b.cx - a.cx) * k / steps), py = Math.round(a.cy + (b.cy - a.cy) * k / steps);
        if (dist[at(px, py)] === a.index) last = [px, py];
        if (!first && dist[at(px, py)] === b.index) { first = [px, py]; break; }
      }
      if (!last || !first) return;
      var path = [], x = last[0], y = last[1], bx = first[0], by = first[1];
      while (x !== bx || y !== by) {
        if (Math.abs(bx - x) >= Math.abs(by - y)) x += bx > x ? 1 : -1; else y += by > y ? 1 : -1;
        path.push([x, y]);
      }
      path.forEach(function (p) {
        if (!LAND[get(p[0], p[1])] || dist[at(p[0], p[1])] < 0) {
          set(p[0], p[1], T.BRIDGE);
          /* the second lane, beside the first */
          var hx = Math.abs(bx - last[0]) >= Math.abs(by - last[1]);
          var q = hx ? [p[0], p[1] + 1] : [p[0] + 1, p[1]];
          if (!LAND[get(q[0], q[1])] || dist[at(q[0], q[1])] < 0) set(q[0], q[1], T.BRIDGE);
        }
      });
      landings.push({ d: a, x: last[0], y: last[1], to: b }, { d: b, x: first[0], y: first[1], to: a });
    });
    /* each landing gets a road home to its island's centre */
    landings.forEach(function (l) { carve(l.x, l.y, l.d.cx, l.d.cy, T.ROAD); });

    /* landmarks: a block the size of the thing, a road to its door */
    function landmark(d, id, name, dx, dy, w, h, text, exact) {
      if (!exact) { dx = Math.round(dx * F); dy = Math.round(dy * F); }
      var x0 = d.cx + dx, y0 = d.cy + dy, x, y;
      for (y = y0 - 1; y <= y0 + h; y++) for (x = x0 - 1; x <= x0 + w; x++) {
        if (dist[at(x, y)] !== d.index) continue;
        set(x, y, (y >= y0 && y < y0 + h && x >= x0 && x < x0 + w) ? T.LANDMARK : T.ROAD);
      }
      var door = { x: x0 + (w >> 1), y: y0 + h };
      carve(door.x, door.y, d.cx, d.cy, T.ROAD, { 9: 1 });
      marks.push({ id: id, name: name, x: x0, y: y0, w: w, h: h, d: d.id });
      signs.push({ x: door.x - 1, y: door.y, text: text });
      return door;
    }
    var W0 = byId.worldwood, Y0 = byId.yucayeque, N0 = byId.naturia, H0 = byId.haven, M0 = byId.majinryu, R0 = byId.redrum;
    /* the big buildings: walk up to the front and you go in (ROOMS, below).
       the sapphire stays shut, and so does noorborj */
    function walkIn(id) { marks[marks.length - 1].room = id; }
    landmark(W0, 'tower', 'the tuned tower', -6, -9, 3, 5, 'a replica of a tower from earth.\nretuned. it hums in colours.'); walkIn('tower');
    landmark(W0, 'sapphire', 'the sapphire', 3, 2, 5, 3, 'THE SAPPHIRE\na gallery. closed tonight.');
    marks[marks.length - 1].shut = 'locked. a note taped to the glass:\nclosed tonight. the tape is sun-faded.';
    landmark(H0, 'ncpd', 'NCPD', -3, -6, 6, 3, 'NOVA CITY POLICE DEPARTMENT\nthe steps are very clean.'); walkIn('ncpd');
    /* its cosmetic wing is a shop (shops.js: nova-hospital), at a desk inside */
    landmark(M0, 'hospital', 'nova city hospital', -2, -7, 5, 4, 'NOVA CITY HOSPITAL\nthe lights never go off up there.\ncosmetic wing: inside, at the desk.'); walkIn('hospital');
    landmark(M0, 'pagoda', 'pagoda', 4, 1, 3, 3, 'an old gate. older than the hospital,\nor built to look it.'); walkIn('pagoda');
    var treeDoor = landmark(N0, 'greattree', 'the great tree', -2, -6, 4, 4, 'NOVA CITY PARK\nthe tree is warm to the touch.'); walkIn('greattree');
    landmark(Y0, 'market', 'the market hall', -3, -3, 6, 2, 'the market. fruit, records, gossip.\neverything is a little cheaper if you smile.'); walkIn('market');
    var arcadeDoor = landmark(R0, 'arcade', 'arcade', -3, -1, 4, 2, 'ARCADE\nthe sign is a knife. the high score is "HEX".'); walkIn('arcade');

    /* noorborj: the lighthouse on redrum's northern tip */
    /* the tip is wherever redrum reaches furthest north, not always above its centre */
    var top = R0.cy, tipX = R0.cx;
    for (var ty = 0; ty < H && top === R0.cy; ty++) for (var tx = 0; tx < W; tx++) if (dist[at(tx, ty)] === R0.index) { top = ty; tipX = tx; break; }
    landmark(R0, 'noorborj', 'noorborj', tipX - R0.cx - 1, top - R0.cy + 1, 3, 4, 'NOORBORJ\na lighthouse. the door does not have a handle on this side.', true);
    marks[marks.length - 1].shut = 'no handle. no keyhole.\nyou knock anyway. nothing knocks back.';

    /* shops: a front the size of the place, the keeper outside the door.
       names and prices live in shops.js; this only says where */
    var SHOP_AT = [{ id: 'neon-fade', d: W0, dx: -7, dy: 3, art: 'barber' },
                   { id: 'la-navaja', d: Y0, dx: 6, dy: -9, art: 'barber' },
                   { id: 'haven-groom', d: H0, dx: 2, dy: 3, art: 'barber' },
                   { id: 'static-threads', d: W0, dx: 6, dy: -7, art: 'threads' },
                   { id: 'el-trapo', d: Y0, dx: -9, dy: -8, art: 'threads' },
                   { id: 'back-alley', d: R0, dx: 1, dy: 2, art: 'threads' }];
    var shopKeepers = [];
    SHOP_AT.forEach(function (sp) {
      var info = root.MFShops && root.MFShops.SHOPS[sp.id], kind = info && root.MFShops.KINDS[info.kind];
      var door = landmark(sp.d, sp.art, info ? info.name : sp.id, sp.dx, sp.dy, 3, 2,
        (info ? info.name : sp.id.toUpperCase()) + '\n' + (kind ? kind.what : 'open') + '. talk to the one out front.');
      marks[marks.length - 1].shop = sp.id;
      shopKeepers.push({ id: 'shop-' + sp.id, x: door.x + 1, y: door.y, dir: 'down', look: sp.art === 'threads' ? 'tailor' : sp.art, shop: sp.id, still: true });
    });

    /* apartments: one block per district, its door for sale (shops.js
       HOMES). redrum's is the walk-up behind hex's arcade */
    var HOME_AT = [{ d: R0, dx: -3, dy: -4 }, { d: W0, dx: -5, dy: -2 }, { d: Y0, dx: 7, dy: 2 },
                   { d: N0, dx: -6, dy: 3 }, { d: H0, dx: -6, dy: 1 }, { d: M0, dx: -6, dy: 2 }];
    HOME_AT.forEach(function (h) {
      var info = root.MFShops && root.MFShops.HOMES[h.d.id];
      landmark(h.d, 'apt', info ? info.name : 'apartments', h.dx, h.dy, 3, 2,
        (info ? info.name.toUpperCase() + '\n' + info.sign : 'APARTMENTS') + '\nthe door is for sale. face it and press A.');
      marks[marks.length - 1].home = h.d.id;
    });

    /* stores (shops.js STORES): a front on clear ground near a corner of the
       district, the keeper at the door. the spot is searched for, so the
       store never lands on another building */
    function clearSpot(d, w, h, dx0, dy0) {
      for (var r = 0; r < 14; r++) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        var x0 = d.cx + Math.round(dx0 * F) + ox, y0 = d.cy + Math.round(dy0 * F) + oy, ok = true;
        for (var y = y0 - 2; y <= y0 + h + 1 && ok; y++) for (var x = x0 - 2; x <= x0 + w + 1 && ok; x++) {
          var t = get(x, y);
          if (dist[at(x, y)] !== d.index || t === T.LANDMARK || t === T.BRIDGE || t === T.STALL || t === T.SAND) ok = false;
        }
        if (ok && !npcs.some(function (n) { return n.x >= x0 - 2 && n.x <= x0 + w + 1 && n.y >= y0 - 2 && n.y <= y0 + h + 1; })) return [x0 - d.cx, y0 - d.cy];
      }
      return null;
    }
    var STORE_AT = [{ id: 'neon-mart', d: W0, dx: 6, dy: 6, art: 'mart' }, { id: 'la-bodega', d: Y0, dx: -6, dy: 6, art: 'mart' },
                    { id: 'haven-provisions', d: H0, dx: -4, dy: 5, art: 'mart' }, { id: 'redrum-pawn', d: R0, dx: 3, dy: -2, art: 'pawn' },
                    { id: 'lantern-loans', d: M0, dx: 5, dy: 6, art: 'pawn' }];
    /* the grand casino: worldwood, high stakes only. the bouncer minds the door */
    var casinoAt = clearSpot(W0, 7, 3, -8, 8);
    if (casinoAt) {
      var casinoDoor = landmark(W0, 'casino', 'casino settebello', casinoAt[0], casinoAt[1], 7, 3,
        'CASINO SETTEBELLO\nhigh stakes only. the house always wins. the house is very polite about it.', true);
      walkIn('casino');
      npcs.push({ id: 'bouncer', x: casinoDoor.x + 2, y: casinoDoor.y, dir: 'down', look: 'bouncer', name: 'BOUNCER', still: true,
                  lines: ['high stakes only.\n⚡1,000 in your pocket or keep walking.', 'mr. volante runs a clean floor.\nkeep it that way.'] });
    }
    STORE_AT.forEach(function (sp) {
      var info = root.MFShops && root.MFShops.STORES[sp.id], spot = clearSpot(sp.d, 3, 2, sp.dx, sp.dy);
      if (!spot) return;
      var door = landmark(sp.d, sp.art, info ? info.name : sp.id, spot[0], spot[1], 3, 2,
        (info ? info.name : sp.id) + '\n' + (info ? info.line : ''), true);
      marks[marks.length - 1].store = sp.id;
      npcs.push({ id: 'store-' + sp.id, x: door.x + 1, y: door.y, dir: 'down', look: sp.art === 'pawn' ? 'merc' : 'local', store: sp.id, still: true });
    });

    /* the boatyard: yucayeque's east shore, a pier out into the bay, the
       shipwright at the door (shops.js BOAT) */
    var by = Y0.cy, bx = Y0.cx;
    while (bx < W - 1 && !(dist[at(bx, by)] === Y0.index && (get(bx + 1, by) === T.SHALLOW || get(bx + 1, by) === T.DEEP))) bx++;
    var yardDoor = landmark(Y0, 'boatyard', 'the boatyard', bx - 8 - Y0.cx, by - 3 - Y0.cy, 4, 2,
      'THE BOATYARD\nboats built to order. bring the wood.', true);
    carve(yardDoor.x, yardDoor.y, bx, yardDoor.y, T.ROAD, { 9: 1 });
    for (var px = bx + 1; px <= bx + 6; px++) set(px, yardDoor.y, T.BRIDGE);
    npcs.push({ id: 'shipwright', x: yardDoor.x + 1, y: yardDoor.y, dir: 'down', look: 'shipwright', wright: true, still: true });
    var pierEnd = { x: bx + 6, y: yardDoor.y };

    /* the landings round the coast, named for vistadelsol's towns on the
       terranova map. a pier, a beach, a grove, someone who lives there. the
       towns themselves aren't open yet. PLACEHOLDER lines */
    var landings2 = [];
    LANDINGS.forEach(function (l) {
      /* from out in the water, head for land until there is some */
      var x = l.from[0], y = l.from[1], guard = 0;
      while (inside(x, y) && (get(x, y) === T.DEEP || get(x, y) === T.SHALLOW) && guard++ < 200) { x += l.dir[0]; y += l.dir[1]; }
      var sx = x, sy = y;
      /* the pier, back out over the water */
      for (var k = 1; k <= 4; k++) set(sx - l.dir[0] * k, sy - l.dir[1] * k, T.BRIDGE);
      /* the cove: cleared ground behind the beach, palms round it */
      var cx = sx + l.dir[0] * 8, cy = sy + l.dir[1] * 8;
      for (var yy = cy - 6; yy <= cy + 6; yy++) for (var xx = cx - 9; xx <= cx + 9; xx++) {
        if (!inside(xx, yy) || (dist[at(xx, yy)] !== -2 && dist[at(xx, yy)] !== -1) || get(xx, yy) === T.DEEP || get(xx, yy) === T.SHALLOW || get(xx, yy) === T.BRIDGE) continue;
        var edge = Math.abs(yy - cy) === 6 || Math.abs(xx - cx) === 9;
        set(xx, yy, edge ? (hash(xx, yy) < 0.7 ? T.TREE : T.MAINLAND) : hash(xx * 3, yy) < 0.06 ? T.TREE : T.GRASS, -2);
      }
      carve(sx, sy, cx, cy, T.GRASS);
      for (var k = 0; k <= 8; k++) dist[at(sx + l.dir[0] * k, sy + l.dir[1] * k)] = -2;
      set(sx, sy, T.SAND, -2);
      var sgx = sx + l.dir[0] * 2 + (l.dir[1] ? 1 : 0), sgy = sy + l.dir[1] * 2 + (l.dir[0] ? 1 : 0);
      set(sgx, sgy, T.GRASS, -2);
      signs.push({ x: sgx, y: sgy, text: l.name.toUpperCase() + '\n' + l.sign });
      npcs.push({ id: 'landing-' + l.id, x: cx + 2, y: cy, dir: 'down', look: l.look, lines: l.lines, pool: '', kind: 'novan', coast: true, roam: 3 });
      landings2.push({ id: l.id, name: l.name, x: sx, y: sy, cx: cx, cy: cy });
    });

    /* yucayeque's market: stalls round the hall */
    for (var s = 0; s < 8; s++) {
      var sx = Y0.cx + Math.round((-6 + (s % 4) * 4) * F), sy = Y0.cy + Math.round((2 + Math.floor(s / 4) * 3) * F);
      if (dist[at(sx, sy)] === Y0.index && get(sx, sy) !== T.LANDMARK) { set(sx, sy, T.STALL); set(sx, sy + 1, T.ROAD); }
    }

    /* who is out tonight */
    var spawn = { x: arcadeDoor.x, y: arcadeDoor.y + 3, dir: 'up' };
    carve(spawn.x, spawn.y, arcadeDoor.x, arcadeDoor.y, T.ROAD);
    npcs.push({ id: 'hex', x: arcadeDoor.x, y: arcadeDoor.y, dir: 'down', look: 'hex', scene: 'hex', still: true });
    shopKeepers.forEach(function (k) { npcs.push(k); });
    function person(d, dx, dy, look, lines) {
      var x = d.cx + Math.round(dx * F), y = d.cy + Math.round(dy * F);
      if (SOLID[get(x, y)]) carve(x, y, d.cx, d.cy, T.ROAD);
      npcs.push({ id: d.id + npcs.length, x: x, y: y, dir: 'down', look: look, lines: lines, roam: 3 });
    }
    person(W0, 2, 6, 'reveler', ['the replica tower? they tuned it to a song.\nnobody agrees which one.', 'worldwood never sleeps. i tried once.']);
    person(W0, -4, 3, 'reveler', ['the sapphire opens late. if it opens.']);
    person(Y0, 0, 6, 'local', ['you hungry? the patties two stalls down.\ntell them i sent you. they will charge you more.']);
    person(Y0, 5, -6, 'local', ['the music starts when the sun goes.\nit stops when the sun comes back. mostly.']);
    person(N0, 3, 4, 'ape', ['...', 'the plants glow because they are happy.\nbe quiet and they glow more.']);
    /* koga: naturia's council representative, by the great tree (vault: Koga) */
    carve(treeDoor.x + 3, treeDoor.y + 1, treeDoor.x, treeDoor.y, T.ROAD, { 9: 1 });
    npcs.push({ id: 'koga', x: treeDoor.x + 3, y: treeDoor.y + 1, dir: 'down', look: 'koga', koga: true, still: true });
    person(H0, 4, 2, 'clerk', ['haven has no crime. we checked.\ntwice. in triplicate.']);
    person(M0, 1, 4, 'medic', ['the hospital is the best on teknoa.\nthe streets around it are not.']);
    person(R0, 3, 2, 'merc', ['redrum is not on any map the council prints.\nwe like it that way.', 'the lighthouse? do not go knocking.']);

    /* no sealed pockets: open ground nobody can walk to is joined to the
       streets with a path, or, if it is only a tile or two, filled in */
    var seen = reachFrom(spawn.x, spawn.y);
    for (var p = 0; p < W * H; p++) {
      if (seen[p] || SOLID[tile[p]] || dist[p] < 0) continue;
      var comp = flood(p), d0 = DISTRICTS[dist[p]];
      if (comp.length < 4) { comp.forEach(function (q) { tile[q] = d0.style === 'wild' || d0.style === 'village' ? T.TREE : T.BUILDING; }); continue; }
      carve(p % W, (p / W) | 0, d0.cx, d0.cy, T.ROAD, { 9: 1 });
      seen = reachFrom(spawn.x, spawn.y);
    }
    function reachFrom(x, y) { return reach({ W: W, H: H, tile: tile }, x, y); }
    function flood(start) {
      var out = [], q = [start], mark = {}; mark[start] = 1;
      while (q.length) {
        var c = q.pop(); out.push(c);
        [1, -1, W, -W].forEach(function (o) {
          var n = c + o;
          if (n < 0 || n >= W * H || mark[n] || SOLID[tile[n]] || seen[n]) return;
          if ((o === 1 || o === -1) && ((n / W) | 0) !== ((c / W) | 0)) return;
          mark[n] = 1; q.push(n);
        });
      }
      return out;
    }

    /* near the water: the coast people call him the ferryman */
    function coastal(x, y) {
      for (var oy = -6; oy <= 6; oy++) for (var ox = -6; ox <= 6; ox++) { var t = get(x + ox, y + oy); if (t === T.SHALLOW || t === T.DEEP) return true; }
      return false;
    }
    /* the crowd: people through every district, each with a look of their
       own and something to say about where they live. PLACEHOLDER lines,
       flavour only: nothing here is canon until it is written down */
    var busy = {};
    npcs.forEach(function (n) { busy[n.y * W + n.x] = 1; });
    signs.forEach(function (sg) { busy[sg.y * W + sg.x] = 1; });
    /* and nobody starts out standing on a building's front step */
    marks.forEach(function (m) { for (var fx = m.x; fx < m.x + m.w; fx++) busy[(m.y + m.h) * W + fx] = 1; });
    DISTRICTS.forEach(function (d) {
      var open = [];
      for (var k = 0; k < W * H; k++) {
        var t = tile[k];
        if (dist[k] === d.index && seen[k] && (t === T.ROAD || t === T.GROUND || t === T.GRASS)) open.push(k);
      }
      var want = Math.max(3, Math.round(open.length / 100)), lines = CROWD[d.id] || [], placed = 0;
      for (var tries = 0; placed < want && tries < want * 40; tries++) {
        var c = open[Math.floor(hash(d.seed * 7 + tries, 991) * open.length)], cx = c % W, cy = (c / W) | 0, near = false;
        for (var j = 0; j < npcs.length && !near; j++) if (Math.abs(npcs[j].x - cx) + Math.abs(npcs[j].y - cy) < 6) near = true;
        if (near || busy[c]) continue;
        var a = lines[(placed * 2) % lines.length], b = lines[(placed * 2 + 1) % lines.length];
        /* who they are: most are novans; apes everywhere (naturia is mostly apes),
           androids, and here and there someone with a past (KINDS) */
        var roll = hash(d.seed * 31 + placed, 4441), kind = 'novan', acc = 0, mix = KIND_MIX[d.id] || {};
        Object.keys(mix).some(function (kd) { acc += mix[kd]; if (roll < acc) { kind = kd; return true; } return false; });
        /* each district's own people turn up at least once, whatever the dice say */
        if (KIND_FIRST[d.id] && KIND_FIRST[d.id][placed]) kind = KIND_FIRST[d.id][placed];
        npcs.push({ id: d.id + '-' + placed, x: cx, y: cy, dir: ['down', 'left', 'right', 'up'][placed % 4], look: 'gen', seed: d.seed * 1000 + placed,
                    lines: a === b ? [a] : [a, b], pool: d.id, kind: kind, coast: coastal(cx, cy), roam: 3 });
        placed++;
      }
    });

    return { W: W, H: H, tile: tile, dist: dist, marks: marks, signs: signs, npcs: npcs, spawn: spawn, landings: landings2, pier: pierEnd };
  }

  /* vistadelsol, past the shore (placed in map tiles, not by district) */
  var ISLETS = [[22, -106, 7], [-144, -12, 5], [110, 100, 7], [-50, 96, 6]].map(function (o) { var p = atK(o[0], o[1]); return { x: p[0], y: p[1], r: Math.round(o[2] * K) }; });
  var LANDINGS = [
    { id: 'fort-freyja', name: 'Fort Freyja', from: atK(-100, -38), dir: [-1, 0], look: 'local',
      sign: 'vistadelsol. the fort is up the hill.\nthe gate is shut tonight.', lines: ['the fort? old. older than the city.\nnobody goes up there after dark.', 'mangoes fall on your head here.\nit counts as lunch.'] },
    { id: 'port-tropics', name: 'Port Tropics', from: atK(-104, 18), dir: [-1, 0], look: 'reveler',
      sign: 'vistadelsol. the fair comes through in summer.\nthe town is up the beach. not open yet.', lines: ['the fair\'s gone till summer.\nthe carousel\'s still out there, under a sheet.', 'you sailed here? from the city?\nbrave. or bored.'] },
    { id: 'folkvangr', name: 'Fólkvangr', from: atK(-60, -110), dir: [0, -1], look: 'local',
      sign: 'vistadelsol. fields, then more fields.\nthe road inland isn\'t open yet.', lines: ['the fields go on further than you\'d think.\nso does the quiet.', 'north of here it all turns to ash, they say.\nashenreach. i\'ve never been.'] },
    { id: 'persepolis', name: 'Persepolis', from: atK(110, 0), dir: [1, 0], look: 'clerk',
      sign: 'vistadelsol. the old road to persepolis.\nclosed for repairs. since forever.', lines: ['the city\'s up the road. was. is.\ndepends who you ask.', 'the crabs here are friendly.\ndon\'t test that.'] }
  ];

  var CROWD = {
    worldwood: ['the billboards change ads when you look at them.\ni stopped looking.', 'rent here is a crime. the neon is free though.',
                'someone tuned the streetlights to a minor key.\nit suits us.', 'i came for one night. that was four years ago.',
                'if you hear bass through the pavement,\nyou are close to something good.', 'the rain never washes the glow off. we checked.',
                'you look new. it\'s fine.\neveryone looks new under these lights.', 'best noodles are in the place with no sign.\nthat is the sign.'],
    yucayeque: ['my abuela sang that song\nbefore the city had a name.', 'mangoes, three for a joule.\ntwo if you can carry a tune.',
                'the drums start at sundown.\nyou feel them before you hear them.', 'everyone here is somebody\'s cousin.\ngive it a week.',
                'haggle. it\'s rude not to.', 'the old songs are a map.\nlisten right and you won\'t get lost.',
                'smell that? someone\'s grandmother is cooking.\nfollow it.', 'we keep the porch lights on.\npeople find their way home by them.'],
    naturia:   ['step soft. the moss remembers footprints.', 'the glow gets brighter after rain.\nso do the frogs.',
                'i came out here to think. now i just listen.', 'don\'t pick the blue ones. they don\'t like it.',
                'the paths move a little every season.\nor i do.', 'quieter here than anywhere in the city.\nthat\'s the point.',
                'the trees hum at night. low.\nyou get used to it.', 'saw a fox made of light once.\nnobody believes me. fine.'],
    haven:     ['please keep to the paths.\nthe lawns are on a schedule.', 'the council meets on tuesdays.\nnobody knows which tuesdays.',
                'i have a permit for standing here. do you?', 'everything in haven is very clean.\nsuspiciously clean.',
                'the fountains are filtered three times.\nyou could drink them. don\'t.', 'i moved here for the quiet.\nit is very, very quiet.',
                'there\'s a form for that.\nthere\'s a form for everything.', 'the police are polite here.\nextremely polite.'],
    majinryu:  ['lanterns on the left are paper.\non the right, they\'re something else.', 'the labs run all night.\nyou can tell by the hum.',
                'the hospital patched my arm.\nworks better than the old one.', 'the gate is older than all of us.\nwe keep it painted anyway.',
                'tea, two doors down. ask for the house blend.\ndon\'t ask what\'s in it.', 'every lantern is lit by hand.\nevery single one.',
                'the night market moves.\nfollow the lanterns.', 'interns from the labs eat here.\nthey never say what they work on.'],
    redrum:    ['you lost? good. stay lost.', 'nobody here saw anything. including me.', 'the arcade is neutral ground. mostly.',
                'keep your joules in your shoe.', 'red lights mean go here. figure it out.', 'they say the lighthouse is empty.\nthey say a lot of things.']
  };
  /* more of the same voices: the crowd works through its district's whole
     pool, each person in their own order (overworld.js chatter). PLACEHOLDER */
  var MORE = {
    worldwood: ['there\'s a club under the club.\ni\'m not saying which club.', 'the tower changes key at midnight.\nlisten for it.',
                'my landlord is a hologram.\nhe\'s still a landlord.', 'every sign here is trying to sell me something.\nexcept that one. that one just says HI.',
                'i work two jobs and a side thing.\nthe side thing pays best.', 'the sapphire\'s been closed tonight for about a year.',
                'don\'t stand still too long.\nsomeone will put an ad on you.', 'the rain\'s warm here. nobody knows why.\nnobody asks.',
                'i saw a guy pay for noodles with a song.\nthey took it.', 'worldwood\'s loud so you don\'t have to be.'],
    yucayeque: ['my tía runs the third stall.\ntell her you\'re my friend. you\'re my friend now.', 'the boatyard\'s down by the water.\nthe shipwright swears at wood. lovingly.',
                'palm fibre? the yards are full of it.\nthe palms don\'t mind. much.', 'everyone sings at weddings here.\neveryone. no exceptions.',
                'domino night is serious.\ndo not laugh at domino night.', 'the sea comes right up to the houses on the east side.\nwe like it close.',
                'you look hungry. everyone looks hungry to me.\nit\'s a gift.', 'there\'s a song for leaving and a song for coming back.\nwe sing the second one more.',
                'the market hall used to be a church.\nor a warehouse. depends on your abuela.', 'come back on a sunday.\nbring nothing. leave full.'],
    naturia:   ['the timber here falls on its own.\nwe just pick it up. it\'s polite.', 'the great tree has a door.\nit\'s always been open. go in.',
                'there\'s a moth out here the size of a hand.\nit\'s fine. it likes people.', 'sit still long enough and the moss starts on you.\nkidding. mostly.',
                'i was a programmer. now i count frogs.\nbetter hours.', 'the paths glow brighter where people walk.\nthe forest keeps score.',
                'something sang last night. not a bird.\nnot a person. pretty, though.', 'take timber from the fallen ones.\nnever the standing ones. that\'s the rule.',
                'the city\'s right there and you can\'t hear it.\nthat\'s the trick.', 'if you get lost, follow the blue glow.\nor don\'t. it\'s nice either way.'],
    haven:     ['the council building has four hundred windows.\nall of them are clean.', 'i got fined for whistling.\nthe wrong song.',
                'the police here say thank you when they stop you.', 'everyone in haven waters their lawn at seven.\nexactly seven.',
                'the meridian\'s got a waiting list.\nthe waiting list has a waiting list.', 'i like it here. i think. it\'s hard to tell.\neverything is so quiet.',
                'there\'s a barber who\'ll give you a council cut.\nit\'s just a normal cut. but they call it that.', 'the fountains turn off at ten.\nthe silence after is loud.',
                'if you see litter, report it.\nyou won\'t see litter.', 'my neighbour has lived here thirty years.\ni have never heard his voice.'],
    majinryu:  ['the labs throw out good scrap.\nbrackets, wire. the bins round back.', 'the pagoda keeper\'s been there longer than the hospital.\nask her about it. she won\'t answer.',
                'my cousin had his eyes done at the hospital.\nthey\'re green now. they were brown.', 'don\'t buy dumplings from the cart that moves.\nbuy from the one that doesn\'t.',
                'the lanterns go out one by one at dawn.\nnobody blows them. they just know.', 'somebody here is always awake.\nthat\'s majinryū.',
                'the hospital lights hum in a key.\nthe tower in worldwood hums back. i swear.', 'there\'s a tea that makes you remember a dream.\ntwo cups and you remember someone else\'s.',
                'the interns walk in pairs.\nnever asked why. not going to.', 'old gate, new labs.\nthe old gate wins every argument.'],
    redrum:    ['the scrap round here is free if you\'re quick.\nthe dogs are quicker.', 'the arcade\'s owner? never met them.\nhex acts like she owns it. maybe she does.',
                'you didn\'t see me. i didn\'t see you.\nwe\'re both doing great.', 'the lighthouse light goes on sometimes.\nnobody goes up to turn it on.',
                'the walk-ups out back are cheap.\nyou get what you pay for. you get some extra.', 'causeway\'s the only way in on foot.\nthat\'s how we like it.',
                'i saw your face before. no i didn\'t.\nforget i said that.', 'redrum doesn\'t have a mayor.\nit has a mood.']
  };
  Object.keys(MORE).forEach(function (k) { CROWD[k] = CROWD[k].concat(MORE[k]); });

  /* who's in the crowd, per district (the rest are novans). PLACEHOLDER mix */
  var KIND_MIX = {
    naturia:   { ape: 0.70, android: 0.04 },
    worldwood: { android: 0.15, ape: 0.10, sleeper: 0.03, tweaker: 0.03 },
    yucayeque: { ape: 0.10, android: 0.05 },
    haven:     { android: 0.10, ape: 0.08, sleeper: 0.05 },
    majinryu:  { android: 0.20, ape: 0.10, hashshashin: 0.05, tweaker: 0.02 },
    redrum:    { tweaker: 0.12, ape: 0.10, hashshashin: 0.06, android: 0.05 }
  };
  var KIND_FIRST = { naturia: ['ape', 'ape'], worldwood: ['android', 'sleeper', 'tweaker'], yucayeque: ['ape'], haven: ['android', 'sleeper'],
                     majinryu: ['android', 'hashshashin'], redrum: ['tweaker', 'hashshashin', 'ape'] };
  /* what each kind talks about, besides him. PLACEHOLDER */
  var KIND_TALK = {
    ape:         ['the glow is brighter since we came.\nwe think it likes us.', 'people stare. that\'s fine.\nwe stare back. politely.', 'i was born on teknoa.\nmy mother wasn\'t.',
                  'someone told me i speak human very well.\ni said, so do you.', 'naturia grows everything we eat.\nthe rest of the city could learn.', 'we remember earth.\nwe don\'t miss all of it.'],
    android:     ['i don\'t sleep. i defragment.\nit\'s similar.', 'cyberia is cold. the city is warm.\ni prefer warm.', 'the rain is very loud to me.\ni like it anyway.',
                  'people ask if i\'m real.\ni ask them the same. it evens out.', 'i came down from frostfalls for the noise.\nthe quiet up there is a lot.', 'my chassis is second hand.\nmy opinions are all mine.'],
    tweaker:     ['they\'re IN the rain.\ndon\'t drink the rain.', 'i haven\'t slept since the crossing.\nor before that.', 'the colours talk here.\ndo they talk to you? they talk to me.',
                  'don\'t look at the lighthouse.\nit looks back. it LOOKS BACK.'],
    sleeper:     ['lovely evening. are you local?\nno reason.', 'i work in... logistics.', 'keep your receipts.\nsomeone\'s always counting.', 'nice city. very open.\nalmost no records at all.'],
    hashshashin: ['walk softer.\nthe floor is listening.', 'we came down from the mountains.\nsome of us didn\'t.', 'patience is a blade too.\nthe longest one.']
  };
  /* him. nobody says his name: each kind has its handles (Oms set these,
     2026-10-12; see the vault). supporters and doubters both. PLACEHOLDER lines */
  var HANDLES = {
    ape:         ['the cagebreaker opened every door in that place.\nwe walked out on our own feet.', 'they call him chainsmasher in naturia.\nthe chains are in the park. we keep them polished.',
                  'some say the cagebreaker is gone.\napes don\'t say that.', 'we owe the chainsmasher our names.\nthey only ever gave us numbers.'],
    novan:       ['the chief got us here.\nthen nobody saw him again.', 'dadash wouldn\'t want us moping.\nso we don\'t. mostly.', 'my mother lights a candle for dadash every friday.',
                  'the chief? gone. that\'s what the council says.\nthe council says a lot.', 'the chief left us here and vanished.\nhero or not, that\'s what happened.'],
    coast:       ['the ferryman brought my family over.\nme too, i was the small one.', 'on calm nights the old ones watch the water\nfor the ferryman.',
                  'the ferryman made the last crossing alone.\nnobody saw the boat come back.'],
    android:     ['in cyberia we call him the anomaly.\nhe never fit any model.', 'an anomaly can\'t be deleted.\nonly misplaced.',
                  'i ran the numbers on the anomaly coming back.\nthe numbers disagree with each other.'],
    haven:       ['the commander\'s portrait is still in the hall.\nnobody\'s allowed to move it.', 'the founder\'s chair is empty at every session.\nthey still set out a glass of water.',
                  'if the commander walked in now i\'d salute.\nthen i\'d faint.'],
    redrum:      ['the hunter used to walk these roofs.\nnobody\'s seen that shadow since.', 'you hear the hunter\'s still out there.\nyou hear a lot of things in redrum.',
                  'the hunter? good riddance.\nbad for business, that one.'],
    sleeper:     ['the subject was never recovered.\n...sorry. wrong person.', 'a product like that doesn\'t just disappear.\nit gets misplaced. good evening.'],
    hashshashin: ['the captain taught us to walk without a sound.\nwe still do. out of respect.', 'if the captain is gone, he chose it.\ncaptains choose.'],
    tweaker:     ['LUCIFER\'S BASTARD. i saw him.\nin the rain. he looked right at me.', 'demonblood. demonblood.\nthey cut him and it wasn\'t red.',
                  'the demidemon isn\'t dead.\nyou can\'t kill what\'s only half of something.']
  };
  /* koga speaks like nobody else in the city (vault: Koga). PLACEHOLDER lines */
  var KOGA = ['Ah. A new face. Naturia welcomes you,\nthough the moss may take some convincing.',
              'My old friend would have liked you, I think.\nHe liked most people who didn\'t put him in a cage.',
              'We grow everything we eat here.\nTake only fallen timber, if you please. The standing trees are listening.',
              'I am told I fight better after a drink.\nI am told this by people who have never fought me sober.',
              'Brother... forgive me. You reminded me of someone.\nIt passes.'];

  /* what people say about you, when it fits. PLACEHOLDER */
  var TALK = {
    boat:  ['that your boat at the pier?\nnice lines. bit small.', 'you\'ve been out on the water? past the shore?\nwhat\'s out there?',
            'a boat. look at you.\ntake me to vistadelsol sometime. i\'ll bring snacks.', 'careful past the strait.\nthe jörmun doesn\'t care who you are.'],
    hex:   ['you know hex? everyone knows hex.\nnot everyone admits it.', 'hex said your name earlier. i think.\nit was fast. she talks fast.',
            'if hex likes you, you\'re fine here.\nif she doesn\'t, also fine. just quieter.', 'hex owes me money.\ndon\'t tell her i said that.'],
    cold:  ['hex walked right past you earlier.\ndidn\'t even pop her gum. what\'d you do?', 'you and hex fall out?\nshe\'s been quiet. hex is never quiet.'],
    rich:  ['you\'re walking like someone with joules on them.\nwalk different.', 'that\'s a lot of joules to carry around.\nthe pawn shop\'ll hold nothing for you. just saying.',
            'you look like you could buy this whole street.\ndon\'t. we like it.'],
    late:  ['it\'s late. why are you up?\nme? i\'m always up.', 'the city\'s different at this hour.\nhonest, kind of.',
            'nobody\'s out this late but us and the rain.'],
    home:  ['you got a place now? good.\neveryone needs a door that\'s theirs.', 'how\'s the new place? the pipes sing, right?\nall the pipes sing.']
  };

  /* ── indoors ──────────────────────────────────────────────────
     an apartment: one small room, the same in every district but for its
     colours and its window. # wall, . floor, = the mat (step on it to leave).
     Furniture sits on the floor as marks with something to say. */
  var ROOM = ['##########',
              '#........#',
              '#........#',
              '#........#',
              '#........#',
              '#........#',
              '#........#',
              '####==####'];
  var FURNITURE = [
    { id: 'window', x: 2, y: 0, w: 2, h: 1, view: true },
    { id: 'window', x: 5, y: 0, w: 2, h: 1, view: true },
    { id: 'bed', x: 1, y: 1, w: 2, h: 2, bed: true, text: 'your bed. nobody else\'s.\nyou\'ll wake up here now.' },
    { id: 'counter', x: 7, y: 1, w: 2, h: 1, text: 'a kettle, two mugs.\none of them is clean.' },
    { id: 'plant', x: 8, y: 3, w: 1, h: 1, text: 'a plant. it\'s alive.\nyou\'ll try.' },
    { id: 'sofa', x: 2, y: 4, w: 3, h: 1, text: 'the sofa remembers whoever had it before.\nit\'s getting used to you.' },
    { id: 'tv', x: 6, y: 4, w: 1, h: 1, text: 'static on every channel.\nyou leave it on anyway. it\'s company.' }
  ];
  /* the big buildings, one room each. same map letters, plus : tiled
     floor, " moss, T tree. people: look, lines, and a shop if they keep one.
     PLACEHOLDER lines, flavour only, in the crowd's voice: nothing in here
     is canon until it is written down */
  var ROOMS = {
    arcade: { d: 'redrum', floor: T.CHECK, map: [
      '##############',
      '#::::::::::::#',
      '#::::::::::::#',
      '#::::::::::::#',
      '#::::::::::::#',
      '#::::::::::::#',
      '#::::::::::::#',
      '#::::::::::::#',
      '######==######'],
      things: [
        { id: 'cabinet', x: 2, y: 1, w: 1, h: 1, text: 'KNIFE FIGHT II\nhigh score: HEX. second: HEX. third: HEX.' },
        { id: 'cabinet', x: 4, y: 1, w: 1, h: 1, text: 'NEON DRIFT\nthe seat is still warm.' },
        { id: 'cabinet', x: 6, y: 1, w: 1, h: 1, text: 'out of order.\nsomeone wrote "ask hex" on the tape.' },
        { id: 'claw', x: 9, y: 1, w: 2, h: 1, text: 'a claw machine full of plush ghosts.\nnobody has ever won one. nobody.' },
        { id: 'cabinet', x: 2, y: 5, w: 1, h: 1, text: 'a dance machine.\nthe arrows are worn white.' },
        { id: 'cabinet', x: 4, y: 5, w: 1, h: 1, text: 'a shooting game.\nthe guns are chained down. good.' },
        { id: 'prize', x: 9, y: 5, w: 3, h: 1, text: 'the prize counter. tokens for a keychain,\nor ten thousand for the big plush.\nnobody has ten thousand.' }],
      people: [
        { x: 7, y: 3, look: 'gen', seed: 6601, lines: ['the arcade is neutral ground. mostly.', 'a year i\'ve been trying for that high score.\nit\'s not happening.'] },
        { x: 11, y: 7, look: 'merc', lines: ['no fighting in here.\noutside is different.'] }] },
    tower: { d: 'worldwood', map: [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '####==####'],
      things: [
        { id: 'lift', x: 4, y: 0, w: 2, h: 1, text: 'the lift says OUT OF TUNE.\nsomeone is fixing it. someone always is.' },
        { id: 'glass', x: 1, y: 2, w: 1, h: 3, text: 'coloured glass, floor to ceiling.\nput a hand on it and it hums back.' },
        { id: 'glass', x: 8, y: 2, w: 1, h: 3, text: 'the colours drift when nobody\'s looking.\nyou looked. they stopped.' },
        { id: 'fork', x: 4, y: 4, w: 2, h: 2, text: 'a tuning fork the size of a person.\nthe plaque says which note. the plaque is scratched off.' },
        { id: 'bench', x: 1, y: 8, w: 2, h: 1, text: 'a bench. sit long enough\nand you start humming along.' },
        { id: 'bench', x: 7, y: 8, w: 2, h: 1, text: 'someone carved a tune into the bench.\njust the notes. no words.' }],
      people: [
        { x: 7, y: 6, look: 'clerk', still: true, lines: ['they tuned it to a song.\nsix years i\'ve worked here, still can\'t hum it.', 'the top floors are closed for tuning.\nthey\'re always closed for tuning.'] }] },
    ncpd: { d: 'haven', map: [
      '##############',
      '#....#.......#',
      '#....#.......#',
      '#....#.......#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '######==######'],
      things: [
        { id: 'bars', x: 1, y: 3, w: 4, h: 1, text: 'a holding cell. empty. spotless.\nthe cleanest cell in teknoa.' },
        { id: 'board', x: 7, y: 0, w: 2, h: 1, text: 'WANTED: nobody.\nhaven has no crime.' },
        { id: 'desk', x: 8, y: 2, w: 3, h: 1, text: 'the front desk. a bell, a pen on a chain,\na sign: TAKE A NUMBER. there are no numbers.' },
        { id: 'tv', x: 6, y: 4, w: 1, h: 1, text: 'security monitors. every screen shows this room.\none of them shows it a second late.' },
        { id: 'bench', x: 1, y: 6, w: 3, h: 1, text: 'a bench bolted to the floor.\nso is the pen. so is everything.' },
        { id: 'bench', x: 10, y: 6, w: 3, h: 1, text: 'you sit. a camera turns to look at you.\nyou stand up.' }],
      people: [
        { x: 12, y: 1, look: 'clerk', still: true, lines: ['do you have an appointment to report a crime?', 'haven has no crime. we checked.\ntwice. in triplicate.'] }] },
    hospital: { d: 'majinryu', floor: T.CHECK, map: [
      '##############',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '######==######'],
      things: [
        { id: 'desk', x: 5, y: 2, w: 4, h: 1, text: 'reception. take a number.\nthe screen says NOW SERVING: 0.' },
        { id: 'bed', x: 11, y: 1, w: 2, h: 2, text: 'a bed behind a curtain. someone left flowers.\nnobody\'s in it.' },
        { id: 'bench', x: 1, y: 5, w: 3, h: 1, text: 'the waiting room chairs are joined together.\nso, eventually, are you.' },
        { id: 'bench', x: 1, y: 7, w: 3, h: 1, text: 'the number hasn\'t changed\nsince you sat down.' },
        { id: 'plant', x: 12, y: 4, w: 1, h: 1, text: 'a plant. plastic.\nthe only thing in here that isn\'t clean.' },
        { id: 'desk', x: 10, y: 8, w: 3, h: 1, text: 'COSMETIC WING\nskin, eyes, marks. talk to the medic.' }],
      people: [
        { x: 11, y: 7, look: 'medic', still: true, shop: 'nova-hospital', dir: 'down' },
        { x: 4, y: 3, look: 'gen', seed: 6602, lines: ['the hospital patched my arm.\nworks better than the old one.'] }] },
    pagoda: { d: 'majinryu', map: [
      '#########',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '####=####'],
      things: [
        { id: 'shrine', x: 3, y: 1, w: 3, h: 1, text: 'an offering bowl. someone left a joule.\nyou leave it there.' },
        { id: 'lantern', x: 1, y: 2, w: 1, h: 1, text: 'every lantern is lit by hand.\nevery single one.' },
        { id: 'lantern', x: 7, y: 2, w: 1, h: 1, text: 'this one is paper.\nthe flame inside isn\'t quite fire.' },
        { id: 'lantern', x: 1, y: 6, w: 1, h: 1, text: 'a lantern, burning low.\nsomeone will be by to tend it. someone always is.' },
        { id: 'bell', x: 7, y: 5, w: 1, h: 2, text: 'a bronze bell. you don\'t ring it.\nit hums anyway.' }],
      people: [
        { x: 5, y: 4, look: 'local', lines: ['we keep it painted.\nnobody remembers what colour it was first.', 'older than the hospital, or built to look it.\ni\'m not telling you which.'] }] },
    greattree: { d: 'naturia', floor: T.GRASS, edge: T.TREE, map: [
      'TTTTTTTTTTTT',
      'TT""""""""TT',
      'T""""""""""T',
      'T""""""""""T',
      'T""""""""""T',
      'T""""""""""T',
      'T""""""""""T',
      'T""""""""""T',
      'TT""""""""TT',
      'TTTTT==TTTTT'],
      things: [
        { id: 'roots', x: 2, y: 1, w: 2, h: 1, text: 'the roots are warm.\nlike something asleep under them.' },
        { id: 'pool', x: 4, y: 3, w: 4, h: 3, text: 'a pool inside the tree. it doesn\'t reflect you.\nit reflects a sky. there isn\'t one in here.' },
        { id: 'shrooms', x: 9, y: 2, w: 1, h: 1, text: 'mushrooms that glow when you talk.\nyou whisper. they glow anyway.' },
        { id: 'shrooms', x: 2, y: 7, w: 1, h: 1, text: 'don\'t pick the blue ones.\nthey don\'t like it.' }],
      people: [
        { x: 9, y: 6, look: 'ape', lines: ['...', 'the tree likes quiet.\nso do i.'] }] },
    /* casino settebello: enzo's floor (vault: Enzo, Council, a gambler who
       talks in odds). door: what you need in your pocket to get in */
    casino: { d: 'worldwood', floor: T.CHECK, house: 'grand', door: 1000, map: [
      '################',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#######==#######'],
      things: [
        { id: 'slot', x: 2, y: 1, w: 1, h: 1, game: 'slots', text: 'a slot machine' },
        { id: 'slot', x: 4, y: 1, w: 1, h: 1, game: 'slots', text: 'a slot machine' },
        { id: 'slot', x: 6, y: 1, w: 1, h: 1, game: 'slots', text: 'a slot machine' },
        { id: 'lottobooth', x: 11, y: 1, w: 3, h: 1, game: 'lotto', text: 'the grand lottery' },
        { id: 'bjtable', x: 2, y: 4, w: 3, h: 2, game: 'blackjack', text: 'blackjack' },
        { id: 'wheel', x: 7, y: 4, w: 3, h: 2, game: 'roulette', text: 'roulette' },
        { id: 'dicetable', x: 11, y: 4, w: 3, h: 2, game: 'dice', text: 'high-low dice' },
        { id: 'plant', x: 1, y: 8, w: 1, h: 1, text: 'a plant. real gold leaf on the pot.\nthe plant is fake.' },
        { id: 'plant', x: 14, y: 8, w: 1, h: 1, text: 'a plant. it has seen things.' }],
      people: [
        { x: 9, y: 8, look: 'enzo', name: 'Enzo', still: true, lines: [
          'Welcome to Settebello. House edge on the wheel is two-point-seven percent.\nMy edge is the charm. Call it priceless.',
          'Seventy percent of this room is losing tonight.\nThe other thirty percent are lying about it.',
          'The odds you leave richer? Forty-four percent, give or take.\nThe odds you come back tomorrow? Ninety-nine.',
          'Blackjack pays three to two in this house.\nI am a generous man. Don\'t tell anyone.',
          'The Founder never once sat at my tables.\nI respected the man. I respected the odds more.'] },
        { x: 3, y: 7, look: 'gen', seed: 7701, lines: ['up eleven thousand. down twelve.\ni\'m basically even.'] },
        { x: 12, y: 7, look: 'gen', seed: 7702, lines: ['the wheel likes red tonight.\nit liked red last night too. then it didn\'t.'] }] },
    market: { d: 'yucayeque', map: [
      '##############',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '######==######'],
      things: [
        { id: 'stall', x: 1, y: 2, w: 2, h: 1, text: 'mangoes, three for a joule.\ntwo if you can carry a tune.' },
        { id: 'stall', x: 5, y: 2, w: 2, h: 1, text: 'a crate of records with no labels.\nthe seller says that\'s how you know they\'re good.' },
        { id: 'stall', x: 9, y: 2, w: 2, h: 1, text: 'spices in jars. one jar just says "abuela".\nnot for sale.' },
        { id: 'stall', x: 1, y: 5, w: 2, h: 1, text: 'patties. the good ones.\nthey charge more if you say who sent you.' },
        { id: 'stall', x: 9, y: 5, w: 2, h: 1, text: 'old radios, all on the same station.\nit\'s playing the drums from outside.' }],
      people: [
        { x: 2, y: 1, look: 'local', still: true, dir: 'down', lines: ['haggle. it\'s rude not to.'] },
        { x: 10, y: 1, look: 'local', still: true, dir: 'down', lines: ['everything\'s a little cheaper if you smile.\nnot that cheap.'] },
        { x: 6, y: 6, look: 'gen', seed: 6603, lines: ['everyone here is somebody\'s cousin.\ngive it a week.'] }] }
  };

  /* any room: an apartment (by district id) or a big building (ROOMS).
     marks are the furniture, people are whoever is in tonight */
  function room(id) {
    var def = ROOMS.hasOwnProperty(id) ? ROOMS[id] : null, di = -1, info = null;
    var did = def ? def.d : id;
    DISTRICTS.forEach(function (d, i) { if (d.id === did) di = i; });
    if (di < 0) return null;
    if (!def) {
      info = root.MFShops && root.MFShops.HOMES[id];
      def = { map: ROOM, things: FURNITURE, people: [], spawn: { x: 4, y: 6, dir: 'up' } };
    }
    var map = def.map, w = map[0].length, h = map.length, tile = new Uint8Array(w * h), dist = new Int8Array(w * h).fill(di), marks = [], npcs = [];
    var floor = def.floor || T.FLOOR, edge = def.edge || T.WALL, mat = [];
    map.forEach(function (r, y) {
      for (var x = 0; x < w; x++) {
        var c = r.charAt(x);
        tile[y * w + x] = c === '#' ? T.WALL : c === 'T' ? T.TREE : c === '=' ? T.MAT : c === '"' ? T.GRASS : c === ':' ? T.CHECK : floor;
        if (c === '=') mat.push(x);
      }
    });
    def.things.forEach(function (f) {
      for (var y = f.y; y < f.y + f.h; y++) for (var x = f.x; x < f.x + f.w; x++) tile[y * w + x] = T.LANDMARK;
      marks.push({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h, d: did, bed: !!(f.bed && !ROOMS.hasOwnProperty(id)), text: f.view ? (info ? info.view : 'the city.') : f.text,
                   game: f.game, house: f.game ? def.house : undefined });
    });
    (def.people || []).forEach(function (p, i) {
      npcs.push({ id: id + '-' + i, x: p.x, y: p.y, dir: p.dir || 'down', look: p.look, seed: p.seed, lines: p.lines, shop: p.shop, name: p.name, still: !!p.still, roam: 2 });
    });
    /* you come in standing just inside the mat, facing in */
    var spawn = def.spawn || { x: mat[0], y: h - 2, dir: 'up' };
    return { W: w, H: h, tile: tile, dist: dist, marks: marks, signs: [], npcs: npcs, spawn: spawn, floor: floor, edge: edge,
             home: ROOMS.hasOwnProperty(id) ? '' : id, place: ROOMS.hasOwnProperty(id) ? id : '' };
  }

  function solid(world, x, y) {
    if (x < 0 || y < 0 || x >= world.W || y >= world.H) return true;
    return !!SOLID[world.tile[y * world.W + x]];
  }

  /* every walkable tile reachable from (x, y), as a flat array of flags */
  function reach(world, x, y) {
    var seen = new Uint8Array(world.W * world.H), q = [[x, y]];
    seen[y * world.W + x] = 1;
    while (q.length) {
      var p = q.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var nx = p[0] + o[0], ny = p[1] + o[1], k = ny * world.W + nx;
        if (!solid(world, nx, ny) && !seen[k]) { seen[k] = 1; q.push([nx, ny]); }
      });
    }
    return seen;
  }

  /* fishing: which spot this water is. the open sea at the map's edge, the
     reef off vistadelsol, naturia's glow-waters, the redrum shallows, the
     harbour off any other district, the bay in the middle of it all */
  function fishZone(world, x, y) {
    if (x < 22 || y < 22 || x > world.W - 23 || y > world.H - 23) return 'jormun';
    var near = {}, d;
    for (var oy = -6; oy <= 6; oy++) for (var ox = -6; ox <= 6; ox++) {
      var nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= world.W || ny >= world.H) continue;
      var t = world.tile[ny * world.W + nx];
      if (t === T.DEEP || t === T.SHALLOW || t === T.BRIDGE) continue;
      d = world.dist[ny * world.W + nx];
      near[d === -2 ? 'vistadelsol' : d >= 0 ? DISTRICTS[d].id : 'none'] = 1;
    }
    if (near.vistadelsol) return 'reef';
    if (near.naturia) return 'glow';
    if (near.redrum) return 'redrum';
    if (Object.keys(near).some(function (k) { return k !== 'none'; })) return 'harbour';
    return 'bay';
  }

  /* what a boat floats on */
  function water(world, x, y) {
    if (x < 0 || y < 0 || x >= world.W || y >= world.H) return false;
    var t = world.tile[y * world.W + x];
    return t === T.DEEP || t === T.SHALLOW;
  }

  /* materials: a few piles a day, like the loose joules. timber where
     naturia's trees are, palm fibre in yucayeque's yards, scrap in redrum
     and round majinryū's labs, fruit out in vistadelsol. shops.js RES
     names them; item 2 turns picking them up into minigames */
  var NODE_KINDS = [
    { kind: 'timber', where: ['naturia'], per: 7, near: T.TREE },
    { kind: 'fibre', where: ['yucayeque'], per: 7 },
    { kind: 'scrap', where: ['redrum', 'majinryu'], per: 5 },
    { kind: 'fruit', where: ['vistadelsol'], per: 10 }
  ];
  function nodes(world, day) {
    if (!world.nodeOpen) {
      var r = reach(world, world.spawn.x, world.spawn.y), busy = {};
      world.signs.concat(world.npcs).forEach(function (o) { busy[o.y * world.W + o.x] = 1; });
      world.nodeOpen = {};
      NODE_KINDS.forEach(function (nk) {
        var cells = [];
        for (var k = 0; k < world.W * world.H; k++) {
          var t = world.tile[k], d = world.dist[k], x = k % world.W, y = (k / world.W) | 0;
          var where = d === -2 ? 'vistadelsol' : d >= 0 ? DISTRICTS[d].id : '';
          if (busy[k] || nk.where.indexOf(where) < 0) continue;
          if (where !== 'vistadelsol' && !r[k]) continue;
          if (t !== T.GROUND && t !== T.GRASS && t !== T.ROAD) continue;
          if (nk.near !== undefined && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { var nx = x + o[0], ny = y + o[1]; return nx >= 0 && ny >= 0 && nx < world.W && ny < world.H && world.tile[ny * world.W + nx] === nk.near; })) continue;
          cells.push(k);
        }
        world.nodeOpen[nk.kind] = cells;
      });
    }
    var seed = 0, i, out = [];
    for (i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) | 0;
    NODE_KINDS.forEach(function (nk, j) {
      var cells = world.nodeOpen[nk.kind];
      for (var n = 0; n < nk.per && cells.length; n++) {
        var k = cells[Math.floor(hash(seed + j * 977, n * 6151 + 11) * cells.length)];
        var x = k % world.W, y = (k / world.W) | 0, id = nk.kind + '@' + x + ',' + y;
        if (out.some(function (o) { return o.x === x && o.y === y; })) continue;
        out.push({ id: id, kind: nk.kind, x: x, y: y, n: 1 + Math.floor(hash(seed + n, j * 31 + 7) * 3) });
      }
    });
    return out;
  }

  /* loose joules: a few dropped ⚡ per district, somewhere new every day.
     Picked from open ground the player can actually reach, never on a
     sign or where someone stands, so they survive the map changing. The
     same day gives the same spots on every device. */
  var LOOSE_PER = 4;
  function loose(world, day) {
    if (!world.open) {
      var r = reach(world, world.spawn.x, world.spawn.y), busy = {};
      world.signs.concat(world.npcs).forEach(function (o) { busy[o.y * world.W + o.x] = 1; });
      world.open = DISTRICTS.map(function () { return []; });
      for (var k = 0; k < world.W * world.H; k++) {
        var t = world.tile[k], d = world.dist[k];
        if (r[k] && !busy[k] && d >= 0 && (t === T.GROUND || t === T.ROAD || t === T.GRASS || t === T.SAND)) world.open[d].push(k);
      }
    }
    var seed = 0, i, out = [];
    for (i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) | 0;
    world.open.forEach(function (cells, d) {
      for (var n = 0; n < LOOSE_PER && cells.length; n++) {
        var k = cells[Math.floor(hash(seed + d * 101, n * 7919) * cells.length)];
        var x = k % world.W, y = (k / world.W) | 0;
        if (out.some(function (o) { return o.x === x && o.y === y; })) continue;
        out.push({ id: x + ',' + y, x: x, y: y, n: 5 + 5 * Math.floor(hash(seed + n, d * 31 + 3) * 5) });
      }
    });
    return out;
  }

  root.MFWorldMap = { V: VERSION, CROWD: CROWD, TALK: TALK, KIND_TALK: KIND_TALK, HANDLES: HANDLES, KOGA: KOGA, W: W, H: H, T: T, DISTRICTS: DISTRICTS, ISLETS: ISLETS, LANDINGS: LANDINGS, build: build, room: room, ROOMS: ROOMS, solid: solid, nodes: nodes, water: water, fishZone: fishZone, reach: reach, loose: loose };
})(typeof window !== 'undefined' ? window : globalThis);
