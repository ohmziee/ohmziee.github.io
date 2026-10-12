/* EXiLED teknoa 2d — shops. No DOM in here: what each shop changes, what
   it costs, and the purchase itself. ui.js draws the counter; overworld.js
   walks the player up to it; world.js puts the shops on the map.

   A kind is a trade: which parts of a look it can change and the base price
   of each. A shop is one place of that kind, with its own mark-up (mult).
   You pay only for what you changed. Prices are in Teknoan Joules (⚡). */
(function (root) {
  var KINDS = {
    barber: { title: 'BARBER', what: 'cut, dye, shave',
              slots: [{ key: 'hair', label: 'cut', price: 60 },
                      { key: 'hairC', label: 'dye', price: 40 },
                      { key: 'beard', label: 'facial hair', price: 30 }] },
    clothes: { title: 'THREADS', what: 'tops, extras, colours',
              slots: [{ key: 'top', label: 'top', price: 80 },
                      { key: 'topC', label: 'top colour', price: 40 },
                      { key: 'acc', label: 'extra', price: 50 },
                      { key: 'accC', label: 'extra colour', price: 25 }] },
    clinic:  { title: 'COSMETIC SURGERY', what: 'skin, eyes, marks',
              slots: [{ key: 'skin', label: 'skin tone', price: 300 },
                      { key: 'eyes', label: 'eye shape', price: 200 },
                      { key: 'eyeC', label: 'eye colour', price: 150 },
                      { key: 'marks', label: 'marks', price: 120 }] }
  };

  /* PLACEHOLDER names and lines: rename freely, nothing else depends on them */
  var SHOPS = {
    'neon-fade':  { kind: 'barber', name: 'NEON FADE', district: 'worldwood', mult: 1,
                    hello: 'sit. the chair spins, i don\'t.', bye: 'looking sharp. go get rained on.' },
    'la-navaja':  { kind: 'barber', name: 'LA NAVAJA', district: 'yucayeque', mult: 0.8,
                    hello: 'joules, a good story, a song. i take all three.', bye: 'tell your friends. tell them i was expensive.' },
    'haven-groom': { kind: 'barber', name: 'HAVEN GROOMING CO.', district: 'haven', mult: 1.5,
                    hello: 'appointments only. this is your appointment.', bye: 'the council would approve. probably.' },
    'static-threads': { kind: 'clothes', name: 'STATIC THREADS', district: 'worldwood', mult: 1,
                    hello: 'everything in here glows under blacklight. even the socks.', bye: 'wear it loud.' },
    'el-trapo':   { kind: 'clothes', name: 'EL TRAPO', district: 'yucayeque', mult: 0.8,
                    hello: 'secondhand clothes. firsthand stories.', bye: 'it was my cousin\'s. now it\'s yours. don\'t tell him.' },
    'back-alley': { kind: 'clothes', name: 'BACK ALLEY FITS', district: 'redrum', mult: 0.7,
                    hello: 'no receipts. no returns. no questions.', bye: 'you didn\'t get that here.' },
    /* the vault: nova city hospital is majinryū's notable place */
    'nova-hospital': { kind: 'clinic', name: 'NOVA CITY HOSPITAL', district: 'majinryu', mult: 1,
                    hello: 'cosmetic wing. the anaesthetic is optional. that was a joke. mostly.', bye: 'no running for a day. or do. it\'s your face.' }
  };

  function price(base, mult) { return Math.round(base * (mult || 1) / 5) * 5; }

  /* what changing `from` into `to` costs here: a line per changed part */
  function quote(id, from, to, A) {
    var sh = SHOPS[id], k = sh && KINDS[sh.kind];
    if (!k) throw new Error('no such shop: ' + id);
    var a = A.normalize(from), b = A.normalize(to), lines = [], total = 0;
    k.slots.forEach(function (sl) {
      if (a[sl.key] === b[sl.key]) return;
      var p = price(sl.price, sh.mult);
      lines.push({ key: sl.key, label: sl.label, price: p }); total += p;
    });
    return { lines: lines, total: total };
  }

  /* only what this shop does can change: anything else in `to` is ignored */
  function allowed(id, from, to, A) {
    var k = KINDS[SHOPS[id].kind], out = A.normalize(from), want = A.normalize(to);
    k.slots.forEach(function (sl) { out[sl.key] = want[sl.key]; });
    return out;
  }

  /* pay and wear it, or nothing happens */
  function buy(MF, A, s, id, to) {
    var look = allowed(id, s.player.look, to, A), q = quote(id, s.player.look, look, A);
    if (!q.lines.length) return { ok: false, why: 'nothing changed' };
    if (!MF.spend(s, q.total)) return { ok: false, why: 'not enough joules', total: q.total };
    s.player.look = look;
    return { ok: true, total: q.total, look: look };
  }

  /* apartments: one block per district, a door you can buy (world.js puts
     them on the map, overworld.js sells them and walks you in). Hex hands
     out the redrum key at the end of her chapter, unless you get on her bad
     side. PLACEHOLDER names and lines: flavour, not canon. Price is ⚡, at
     roughly ⚡270 of loose joules a day */
  var HOMES = {
    redrum:    { name: 'the walk-up', where: 'redrum, round the back of the arcade', price: 900,
                 sign: 'rooms upstairs. cash. no questions.', view: 'the arcade sign, through the bars.\nthe knife flickers. it never quite goes out.' },
    yucayeque: { name: 'casa del patio', where: 'yucayeque, by the market', price: 1200,
                 sign: 'rooms over the courtyard. ask for the abuela.', view: 'porch lights and somebody\'s radio.\na drum, far off, keeping time for the whole street.' },
    naturia:   { name: 'the treehouse flats', where: 'naturia, under the canopy', price: 1400,
                 sign: 'flats in the old grove. mind the moss.', view: 'the trees glow.\nsomething out there with too many lights blinks back.' },
    majinryu:  { name: 'lantern court', where: 'majinryū, below the hospital', price: 1800,
                 sign: 'apartments. quiet hours are a suggestion.', view: 'lanterns all the way down the hill.\nthe hospital\'s lights never go off up there.' },
    haven:     { name: 'the meridian', where: 'haven, off the boulevard', price: 2400,
                 sign: 'residences. a permit is required to be sad here.', view: 'a very clean street. a very clean lawn.\nnobody on either. nobody ever is.' },
    worldwood: { name: 'neon heights', where: 'worldwood, in the thick of it', price: 3000,
                 sign: 'luxury living. the rent is a crime.', view: 'neon, all the way down.\nthe tower hums a colour at you. it might be yours.' }
  };

  /* materials, picked up round the city (world.js nodes), and the boat the
     shipwright builds out of them. PLACEHOLDER numbers */
  var RES = {
    timber: { name: 'timber', what: 'fallen wood from naturia\'s groves.' },
    fibre:  { name: 'palm fibre', what: 'twisted from yucayeque\'s palms. it makes rope.' },
    scrap:  { name: 'scrap metal', what: 'nails, brackets, a hinge. redrum and majinryū throw away good stuff.' },
    fruit:  { name: 'fruit', what: 'vistadelsol grows most things you can eat.' }
  };
  var BOAT = { joules: 1500, need: { timber: 12, fibre: 8, scrap: 6 } };
  /* what's still missing for the boat: [] when it can be built */
  function boatShort(MF, s) {
    var out = [], res = s.res || {};
    Object.keys(BOAT.need).forEach(function (k) { if ((res[k] || 0) < BOAT.need[k]) out.push({ kind: k, have: res[k] || 0, need: BOAT.need[k] }); });
    if (MF.joules(s) < BOAT.joules) out.push({ kind: 'joules', have: MF.joules(s), need: BOAT.joules });
    return out;
  }
  /* all or nothing, like a shop */
  function buildBoat(MF, s) {
    if (s.boat) return { ok: false, why: 'already have one' };
    var short = boatShort(MF, s);
    if (short.length) return { ok: false, why: 'short', short: short };
    if (!MF.spend(s, BOAT.joules)) return { ok: false, why: 'short' };
    Object.keys(BOAT.need).forEach(function (k) { s.res[k] -= BOAT.need[k]; if (!s.res[k]) delete s.res[k]; });
    s.boat = 1;
    return { ok: true };
  }

  /* stores: general stores sell materials; pawn shops buy them, and sell
     curios (and buy those back at half). world.js puts them on the map;
     overworld.js runs the counter. PLACEHOLDER names, lines and prices */
  var CURIOS = {
    snowglobe: { name: 'a snow globe of earth', what: 'a city under glass. shake it and it snows. it never snows here.', price: 120 },
    pager:     { name: 'a dead pager', what: 'it buzzed once in the shop. the screen said nothing.', price: 60 },
    compass:   { name: 'a compass', what: 'points at the jörmun, whichever way you hold it.', price: 90 },
    cassette:  { name: 'an unlabelled cassette', what: 'somebody humming. it might be the tower\'s song.', price: 45 },
    shell:     { name: 'a big shell', what: 'from vistadelsol. hold it up and you hear the nova sea.', price: 30 },
    lighter:   { name: 'a scratched zippo', what: 'the lid has a knife engraved on it. the hinge squeaks.', price: 80 }
  };
  var STORES = {
    'neon-mart':        { kind: 'general', name: 'NEON MART', district: 'worldwood', line: 'open all night. the lights never flicker. we fixed that.', sells: { timber: 30, fibre: 25, scrap: 40, fruit: 12 } },
    'la-bodega':        { kind: 'general', name: 'LA BODEGA', district: 'yucayeque', line: 'the cat runs the place. i just work the till.', sells: { fibre: 18, fruit: 8, timber: 34 } },
    'haven-provisions': { kind: 'general', name: 'HAVEN PROVISIONS', district: 'haven', line: 'all goods inspected. twice. in triplicate.', sells: { timber: 36, fibre: 28, scrap: 44, fruit: 15 } },
    'redrum-pawn':      { kind: 'pawn', name: 'REDRUM PAWN', district: 'redrum', line: 'we buy anything. we don\'t ask where from.', buys: { timber: 8, fibre: 6, scrap: 14, fruit: 5 }, curios: ['pager', 'lighter', 'cassette', 'snowglobe'] },
    'lantern-loans':    { kind: 'pawn', name: 'LANTERN LOANS', district: 'majinryu', line: 'everything here was somebody\'s once. now it\'s nobody\'s. could be yours.', buys: { timber: 9, fibre: 7, scrap: 12, fruit: 6 }, curios: ['compass', 'cassette', 'shell'] }
  };
  function nameOf(key) { return RES[key] ? RES[key].name : CURIOS[key] ? CURIOS[key].name : key; }
  /* the counter's rows for a tab: what you can buy here, or what they'll buy off you */
  function storeRows(MF, s, id, tab) {
    var st = STORES[id], rows = [], res = s.res || {}, items = s.items || {};
    if (!st) return rows;
    if (tab === 'buy') {
      if (st.sells) Object.keys(st.sells).forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: st.sells[k], have: res[k] || 0 }); });
      if (st.curios) st.curios.forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: CURIOS[k].price, have: items[k] || 0 }); });
      rows.forEach(function (r) { r.ok = MF.joules(s) >= r.price; });
    } else if (st.kind === 'pawn') {
      Object.keys(st.buys).forEach(function (k) { if (res[k]) rows.push({ key: k, label: nameOf(k), price: st.buys[k], have: res[k], ok: true }); });
      Object.keys(CURIOS).forEach(function (k) { if (items[k]) rows.push({ key: k, label: nameOf(k), price: Math.floor(CURIOS[k].price / 2), have: items[k], ok: true }); });
    }
    return rows;
  }
  /* one of something, either way. all or nothing */
  function trade(MF, s, id, tab, key) {
    var row = storeRows(MF, s, id, tab).filter(function (r) { return r.key === key; })[0];
    if (!row) return { ok: false, why: tab === 'buy' ? 'not sold here' : 'nothing to sell' };
    if (!s.res) s.res = {};
    if (!s.items) s.items = {};
    var into = RES[key] ? s.res : s.items;
    if (tab === 'buy') {
      if (!MF.spend(s, row.price)) return { ok: false, why: 'not enough joules', price: row.price };
      into[key] = (into[key] || 0) + 1;
      return { ok: true, price: row.price, name: row.label };
    }
    into[key]--; if (!into[key]) delete into[key];
    MF.earn(s, row.price);
    return { ok: true, price: row.price, name: row.label };
  }

  root.MFShops = { KINDS: KINDS, SHOPS: SHOPS, HOMES: HOMES, RES: RES, BOAT: BOAT, boatShort: boatShort, buildBoat: buildBoat,
                   CURIOS: CURIOS, STORES: STORES, storeRows: storeRows, trade: trade,
                   price: price, quote: quote, allowed: allowed, buy: buy };
})(typeof window !== 'undefined' ? window : globalThis);
