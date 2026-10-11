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
                      { key: 'beard', label: 'facial hair', price: 30 }] }
  };

  /* PLACEHOLDER names and lines: rename freely, nothing else depends on them */
  var SHOPS = {
    'neon-fade':  { kind: 'barber', name: 'NEON FADE', district: 'worldwood', mult: 1,
                    hello: 'sit. the chair spins, i don\'t.', bye: 'looking sharp. go get rained on.' },
    'la-navaja':  { kind: 'barber', name: 'LA NAVAJA', district: 'yucayeque', mult: 0.8,
                    hello: 'joules, a good story, a song. i take all three.', bye: 'tell your friends. tell them i was expensive.' },
    'haven-groom': { kind: 'barber', name: 'HAVEN GROOMING CO.', district: 'haven', mult: 1.5,
                    hello: 'appointments only. this is your appointment.', bye: 'the council would approve. probably.' }
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

  root.MFShops = { KINDS: KINDS, SHOPS: SHOPS, price: price, quote: quote, allowed: allowed, buy: buy };
})(typeof window !== 'undefined' ? window : globalThis);
