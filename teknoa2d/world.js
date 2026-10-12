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
  var W = 260, H = 200;
  /* bump when the map changes shape: a saved position from an older map
     means nothing on this one, so that player starts at the spawn */
  var VERSION = 2;
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
  var CENTRE = [125, 115], GAP = 4, SCALE = 2.45;
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

    /* the mainland: Vistadelsol's south shore, across the strait */
    for (var x = 0; x < W; x++) {
      var shore = 9 + Math.round(2 * Math.sin(x / 9) + 1.5 * Math.sin(x / 4 + 1));
      for (var y = 0; y <= shore; y++) set(x, y, y >= shore - 1 ? T.SAND : T.MAINLAND, -1);
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
    for (var i = 0; i < W * H; i++) {
      if (tile[i] !== T.GROUND) continue;
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
    landmark(N0, 'greattree', 'the great tree', -2, -6, 4, 4, 'NOVA CITY PARK\nthe tree is warm to the touch.'); walkIn('greattree');
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

    /* the crowd: people through every district, each with a look of their
       own and something to say about where they live. PLACEHOLDER lines,
       flavour only: nothing here is canon until it is written down */
    var busy = {};
    npcs.forEach(function (n) { busy[n.y * W + n.x] = 1; });
    signs.forEach(function (sg) { busy[sg.y * W + sg.x] = 1; });
    DISTRICTS.forEach(function (d) {
      var open = [];
      for (var k = 0; k < W * H; k++) {
        var t = tile[k];
        if (dist[k] === d.index && seen[k] && (t === T.ROAD || t === T.GROUND || t === T.GRASS)) open.push(k);
      }
      var want = Math.max(2, Math.round(open.length / 140)), lines = CROWD[d.id] || [], placed = 0;
      for (var tries = 0; placed < want && tries < want * 40; tries++) {
        var c = open[Math.floor(hash(d.seed * 7 + tries, 991) * open.length)], cx = c % W, cy = (c / W) | 0, near = false;
        for (var j = 0; j < npcs.length && !near; j++) if (Math.abs(npcs[j].x - cx) + Math.abs(npcs[j].y - cy) < 6) near = true;
        if (near || busy[c]) continue;
        var a = lines[(placed * 2) % lines.length], b = lines[(placed * 2 + 1) % lines.length];
        npcs.push({ id: d.id + '-' + placed, x: cx, y: cy, dir: ['down', 'left', 'right', 'up'][placed % 4], look: 'gen', seed: d.seed * 1000 + placed,
                    lines: a === b ? [a] : [a, b], roam: 3 });
        placed++;
      }
    });

    return { W: W, H: H, tile: tile, dist: dist, marks: marks, signs: signs, npcs: npcs, spawn: spawn };
  }

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
      marks.push({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h, d: did, bed: !!(f.bed && !ROOMS.hasOwnProperty(id)), text: f.view ? (info ? info.view : 'the city.') : f.text });
    });
    (def.people || []).forEach(function (p, i) {
      npcs.push({ id: id + '-' + i, x: p.x, y: p.y, dir: p.dir || 'down', look: p.look, seed: p.seed, lines: p.lines, shop: p.shop, still: !!p.still, roam: 2 });
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

  /* loose joules: a few dropped ⚡ per district, somewhere new every day.
     Picked from open ground the player can actually reach, never on a
     sign or where someone stands, so they survive the map changing. The
     same day gives the same spots on every device. */
  var LOOSE_PER = 3;
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

  root.MFWorldMap = { V: VERSION, CROWD: CROWD, W: W, H: H, T: T, DISTRICTS: DISTRICTS, build: build, room: room, ROOMS: ROOMS, solid: solid, reach: reach, loose: loose };
})(typeof window !== 'undefined' ? window : globalThis);
