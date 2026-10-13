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
    'neon-mart':        { kind: 'general', name: 'NEON MART', district: 'worldwood', line: 'open all night. the lights never flicker. we fixed that.', sells: { timber: 30, fibre: 25, scrap: 40, fruit: 12 }, tools: ['rod', 'tuned', 'jormun'], foods: ['water', 'bar', 'electro'] },
    'la-bodega':        { kind: 'general', name: 'LA BODEGA', district: 'yucayeque', line: 'the cat runs the place. i just work the till.', sells: { fibre: 18, fruit: 8, timber: 34 }, tools: ['rod'], foods: ['water', 'bar'] },
    'haven-provisions': { kind: 'general', name: 'HAVEN PROVISIONS', district: 'haven', line: 'all goods inspected. twice. in triplicate.', sells: { timber: 36, fibre: 28, scrap: 44, fruit: 15 }, tools: ['rod'], foods: ['water', 'bar', 'electro'] },
    'redrum-pawn':      { kind: 'pawn', name: 'REDRUM PAWN', district: 'redrum', line: 'we buy anything. we don\'t ask where from.', buys: { timber: 8, fibre: 6, scrap: 14, fruit: 5 }, curios: ['pager', 'lighter', 'cassette', 'snowglobe'] },
    'lantern-loans':    { kind: 'pawn', name: 'LANTERN LOANS', district: 'majinryu', line: 'everything here was somebody\'s once. now it\'s nobody\'s. could be yours.', buys: { timber: 9, fibre: 7, scrap: 12, fruit: 6 }, curios: ['compass', 'cassette', 'shell'] }
  };
  /* fishing (overworld.js casts, minigames.js reels): rods are tools sold at
     general stores; fish live in spots (world.js fishZone), each with its own
     table. PLACEHOLDER names, lines and prices */
  var TOOLS = {
    /* dur: how many uses it has in it (wearRod below) */
    rod:   { name: 'a fishing rod', what: 'cheap, bendy, works. face any water and press A.', price: 150, level: 0, dur: 40 },
    tuned: { name: 'a tuned rod', what: 'the line hums when something big is near. rarer bites, fewer snaps.', price: 650, level: 1, dur: 120 },
    jormun:{ name: 'a jörmun rod', what: 'deep-sea carbon, a reel like a vault door. it outlasts most people.', price: 1800, level: 2, dur: 300 }
  };
  /* tier: junk, common, uncommon, rare, legendary. price: what a pawn shop pays */
  var FISH = {
    boot:      { name: 'a lost boot', what: 'somebody walked home with one foot wet.', tier: 'junk', price: 1 },
    can:       { name: 'a soda can', what: 'a brand that went under before the crossing.', tier: 'junk', price: 1 },
    sardine:   { name: 'a neon sardine', what: 'it glows a little. so does everything in the harbour.', tier: 'common', price: 6 },
    dockeel:   { name: 'a dock eel', what: 'lives under the piers. knows things.', tier: 'common', price: 8 },
    slickcarp: { name: 'an oil-slick carp', what: 'rainbow scales. not in a good way.', tier: 'uncommon', price: 18 },
    minnow:    { name: 'a chrome minnow', what: 'half fish, half something the labs dropped in the water.', tier: 'rare', price: 60 },
    glowfin:   { name: 'a glowfin', what: 'naturia\'s glow, swimming.', tier: 'common', price: 10 },
    mosstrout: { name: 'a moss trout', what: 'grows a little moss on its back. the apes say that\'s lucky.', tier: 'uncommon', price: 22 },
    lanternray:{ name: 'a lantern ray', what: 'lights up the water around it like a lantern underwater.', tier: 'rare', price: 80 },
    starkoi:   { name: 'a starspawn koi', what: 'its scales hold a whole night sky. nobody\'s sure where it comes from.', tier: 'legendary', price: 300 },
    rustgill:  { name: 'a rustgill', what: 'tastes like a coin. smells like redrum.', tier: 'common', price: 7 },
    knifepike: { name: 'a knife-tooth pike', what: 'all teeth. all attitude.', tier: 'uncommon', price: 26 },
    redsnapper:{ name: 'a blood-red snapper', what: 'red as the neon over the arcade.', tier: 'rare', price: 90 },
    mackerel:  { name: 'a nova mackerel', what: 'the bay\'s everyday fish. good grilled.', tier: 'common', price: 12 },
    squid:     { name: 'a shimmer squid', what: 'changes colour every time you blink.', tier: 'uncommon', price: 30 },
    bass:      { name: 'a council bass', what: 'it looks like it\'s judging you. in triplicate.', tier: 'uncommon', price: 28 },
    tuna:      { name: 'an aurora tuna', what: 'streaks of green and violet down its side.', tier: 'rare', price: 120 },
    parrot:    { name: 'a reef parrotfish', what: 'crunches coral. loudly.', tier: 'common', price: 12 },
    mangocrab: { name: 'a mango crab', what: 'orange, sweet-smelling, very friendly. vistadelsol, basically.', tier: 'uncommon', price: 25 },
    sunray:    { name: 'a sun ray', what: 'warm to the touch, even at night.', tier: 'rare', price: 100 },
    grouper:   { name: 'a vistadelsol gold grouper', what: 'big, slow, golden. the locals say it\'s older than nova city.', tier: 'legendary', price: 350 },
    herring:   { name: 'a jörmun herring', what: 'cold water fish. tastes like far away.', tier: 'common', price: 15 },
    lanterneye:{ name: 'a deepwater lantern-eye', what: 'eyes like headlights. it\'s seen deeper than you ever will.', tier: 'uncommon', price: 45 },
    loopeel:   { name: 'an ouroboros eel', what: 'caught it biting its own tail. it did not let go.', tier: 'rare', price: 200 },
    glassfish: { name: 'an abyssal glassfish', what: 'you can see straight through it. it can see straight through you.', tier: 'legendary', price: 400 }
  };
  /* the spots, and who bites there (weights) */
  var ZONES = {
    harbour: { name: 'the harbour', what: 'the shallows off the districts', table: [['boot', 6], ['can', 6], ['sardine', 40], ['dockeel', 30], ['slickcarp', 14], ['minnow', 4]] },
    glow:    { name: 'naturia\'s glow-waters', what: 'off naturia', table: [['glowfin', 50], ['mosstrout', 30], ['lanternray', 8], ['starkoi', 1.5], ['boot', 3]] },
    redrum:  { name: 'the redrum shallows', what: 'off redrum', table: [['rustgill', 45], ['knifepike', 25], ['redsnapper', 6], ['can', 10], ['boot', 8]] },
    bay:     { name: 'the nova bay', what: 'deep water inside the bay', table: [['mackerel', 50], ['squid', 22], ['bass', 18], ['tuna', 6]] },
    reef:    { name: 'the vistadelsol reef', what: 'off vistadelsol\'s coast and islets', table: [['parrot', 45], ['mangocrab', 30], ['sunray', 8], ['grouper', 1.5]] },
    jormun:  { name: 'the jörmun ocean', what: 'the open sea, past the bay', table: [['herring', 45], ['lanterneye', 28], ['loopeel', 10], ['glassfish', 2.5]] }
  };
  var TIER_HARD = { junk: 0.6, common: 0.8, uncommon: 1.0, rare: 1.3, legendary: 1.6 };
  /* what bites: the spot's table, rare and legendary helped by the rod, legendary by the small hours */
  function pickFish(zone, rng, rodLevel, hour) {
    var z = ZONES[zone] || ZONES.harbour, total = 0;
    var rows = z.table.map(function (r) {
      var t = FISH[r[0]].tier, w = r[1];
      if (t === 'rare') w *= 1 + 0.6 * (rodLevel || 0);
      if (t === 'legendary') w *= (1 + (rodLevel || 0)) * (hour !== undefined && hour < 5 ? 2 : 1);
      if (t === 'junk') w *= rodLevel ? 0.5 : 1;
      total += w; return [r[0], w];
    });
    var roll = (rng ? rng() : Math.random()) * total;
    for (var i = 0; i < rows.length; i++) { roll -= rows[i][1]; if (roll < 0) return rows[i][0]; }
    return rows[rows.length - 1][0];
  }
  function bestRod(s) { var it = s.items || {}; return it.jormun ? 'jormun' : it.tuned ? 'tuned' : it.rod ? 'rod' : ''; }
  /* every cast wears the rod: a clean catch 1, a spooked or missed bite 2, a
     snapped line 4. at 0 it breaks and is gone */
  var WEAR = { caught: 1, spooked: 2, missed: 2, snapped: 4 };
  function rodLeft(s, rod) {
    if (!s.wear) s.wear = {};
    if (s.items && s.items[rod] && !(s.wear[rod] > 0)) s.wear[rod] = TOOLS[rod].dur;   /* a rod from before wear existed */
    return s.wear[rod] || 0;
  }
  function wearRod(s, rod, outcome) {
    if (!TOOLS[rod] || !s.items || !s.items[rod]) return { left: 0, broke: false };
    var left = rodLeft(s, rod) - (WEAR[outcome] || 1);
    if (left > 0) { s.wear[rod] = left; return { left: left, broke: false }; }
    delete s.wear[rod];
    s.items[rod]--; if (!s.items[rod]) delete s.items[rod];
    return { left: 0, broke: true, name: TOOLS[rod].name };
  }
  /* food and drink (engine.js consume): food/drink points; some dishes give a
     perk (buff) for secs of play. carts and restaurants serve it to eat on the
     spot; general stores sell the take-away kind (here: 0), eaten from INV.
     PLACEHOLDER names, lines and prices */
  var FOODS = {
    water:    { name: 'a bottle of water', what: 'plain. wet. exactly what it says.', food: 0, drink: 30, price: 5 },
    bar:      { name: 'a protein bar', what: 'tastes like a promise somebody broke.', food: 25, drink: -3, price: 8 },
    electro:  { name: 'an electrolyte drink', what: 'blue. aggressively blue.', food: 0, drink: 45, price: 10 },
    patty:    { name: 'a beef patty', what: 'flaky, peppery, too hot to hold. you hold it.', food: 30, drink: 0, price: 8, here: 1 },
    cocobread:{ name: 'coco bread', what: 'soft and sweet. the patty goes inside it.', food: 15, drink: 0, price: 4, here: 1 },
    sorrel:   { name: 'a cup of sorrel', what: 'deep red, ginger in the back of your throat.', food: 0, drink: 30, price: 5, here: 1 },
    noodles:  { name: 'a noodle cup', what: 'fast, hot, a little neon.', food: 35, drink: 5, price: 10, here: 1 },
    soda:     { name: 'a neon soda', what: 'it glows. your tongue glows. it\'s fine.', food: 0, drink: 30, price: 4, here: 1 },
    dumplings:{ name: 'a box of dumplings', what: 'from the cart that doesn\'t move.', food: 30, drink: 0, price: 9, here: 1 },
    barley:   { name: 'barley tea', what: 'toasty, cold, endless.', food: 0, drink: 30, price: 3, here: 1 },
    smoothie: { name: 'a mango smoothie', what: 'mostly mango. a little glow.', food: 10, drink: 35, price: 6, here: 1 },
    berries:  { name: 'a cup of glow berries', what: 'they light up when you bite them.', food: 15, drink: 10, price: 5, here: 1 },
    sandwich: { name: 'a cucumber sandwich', what: 'crusts off. inspected.', food: 25, drink: 0, price: 12, here: 1 },
    filtered: { name: 'a glass of filtered water', what: 'filtered three times. you can taste the paperwork.', food: 0, drink: 30, price: 2, here: 1 },
    skewer:   { name: 'a mystery skewer', what: 'don\'t ask. it\'s good though.', food: 25, drink: -5, price: 4, here: 1 },
    buzz:     { name: 'a can of buzz', what: 'the label is mostly warnings.', food: 0, drink: 20, price: 3, here: 1 },
    mango:    { name: 'a ripe mango', what: 'three for a joule, two if you sing.', food: 15, drink: 10, price: 2, here: 1 },
    ramen:    { name: 'the house ramen', what: 'the broth\'s been going since the crossing. or so they say.', food: 80, drink: 20, price: 30, here: 1, buff: 'fast feet', secs: 480 },
    wontons:  { name: 'spicy wontons', what: 'your eyes water. you order more.', food: 45, drink: -5, price: 18, here: 1 },
    icedbarley:{ name: 'iced barley', what: 'a whole jug.', food: 0, drink: 50, price: 6, here: 1 },
    /* cooked at a fire or in a kitchen (COOK below), eaten from INV */
    grilled1: { name: 'a grilled fish', what: 'charred skin, smoke, a squeeze of something.', food: 30, drink: 0, price: 0 },
    grilled2: { name: 'a good grilled fish', what: 'thick and flaky. worth the wait.', food: 45, drink: 0, price: 0 },
    grilled3: { name: 'a rare fish, grilled', what: 'you can feel your hands go steady just smelling it.', food: 65, drink: 5, price: 0, buff: 'steady line', secs: 480 },
    feast:    { name: 'a legendary feast', what: 'one fish, cooked right, enough for a table. you eat it alone.', food: 90, drink: 20, price: 0, buff: 'fast feet', secs: 600 },
    charred:  { name: 'charred fruit', what: 'sweet and smoky. sticky fingers.', food: 18, drink: 8, price: 0 },
    stew:     { name: 'a fish stew', what: 'fish, fruit, whatever\'s in the cupboard. it works.', food: 60, drink: 30, price: 0 },
    juice:    { name: 'fresh juice', what: 'three fruits\' worth. the pulp is the point.', food: 10, drink: 60, price: 0 },
    houseblend:{ name: 'the house blend', what: 'don\'t ask what\'s in it. your hands go very still.', food: 0, drink: 60, price: 15, here: 1, buff: 'steady line', secs: 600 },
    bao:      { name: 'a bao set', what: 'soft, steaming, three to a basket.', food: 70, drink: 0, price: 25, here: 1, buff: 'sharp eye', secs: 480 }
  };
  /* the places that serve it: street carts, a market stall, restaurants */
  var VENDORS = {
    'patty-cart':   { kind: 'vendor', name: 'PATTY CART', district: 'yucayeque', line: 'hot patties. hotter if you complain.', menu: ['patty', 'cocobread', 'sorrel'] },
    'noodle-cart':  { kind: 'vendor', name: 'NEON NOODLES', district: 'worldwood', line: 'noodles in ninety seconds. the soda\'s faster.', menu: ['noodles', 'soda'] },
    'dumpling-cart':{ kind: 'vendor', name: 'DUMPLINGS', district: 'majinryu', line: 'this cart doesn\'t move. that\'s how you know.', menu: ['dumplings', 'barley'] },
    'juice-stand':  { kind: 'vendor', name: 'JUICE STAND', district: 'naturia', line: 'everything here grew in naturia. even me.', menu: ['smoothie', 'berries'] },
    'tea-stall':    { kind: 'vendor', name: 'TEA STALL', district: 'haven', line: 'sandwiches and water. both approved.', menu: ['sandwich', 'filtered'] },
    'skewer-guy':   { kind: 'vendor', name: 'SKEWERS', district: 'redrum', line: 'four joules. no questions. especially about the meat.', menu: ['skewer', 'buzz'] },
    'market-patties':{ kind: 'vendor', name: 'PATTY STALL', district: 'yucayeque', line: 'the good ones. tell them who sent you.', menu: ['patty', 'cocobread', 'sorrel'] },
    'market-mangoes':{ kind: 'vendor', name: 'MANGO STALL', district: 'yucayeque', line: 'three for a joule. two if you can carry a tune.', menu: ['mango', 'smoothie'] },
    'noodle-bar':   { kind: 'restaurant', name: 'NO SIGN', district: 'worldwood', line: 'no sign. that\'s the sign. sit anywhere.', menu: ['ramen', 'wontons', 'icedbarley'] },
    'tea-house':    { kind: 'restaurant', name: 'THE TEA HOUSE', district: 'majinryu', line: 'two doors down. you found it. ask for the house blend.', menu: ['houseblend', 'bao', 'barley'] }
  };
  /* cooking: at a fire (cook:fire:<kind>) or in your kitchen (cook:kitchen).
     raw fish grill by tier; fruit chars; the kitchen does stew and juice too */
  var FIRES = {
    drumfire: { name: 'DRUM FIRE', line: 'a barrel full of fire. someone keeps it fed. nobody says who.' },
    campfire: { name: 'CAMPFIRE', line: 'a ring of stones, a good fire. the moss doesn\'t mind.' },
    grill:    { name: 'ELECTRIC GRILL', line: 'a public heater-grill. red coils, a little hum. free to use.' },
    kitchen:  { name: 'YOUR KITCHEN', line: 'a kettle, two mugs, a stove that works if you ask nicely.' }
  };
  var GRILL = { common: 'grilled1', uncommon: 'grilled2', rare: 'grilled3', legendary: 'feast' };
  function cookRows(s, where) {
    var it = s.items || {}, res = s.res || {}, rows = [], fruit = res.fruit || 0;
    var best = Object.keys(FISH).filter(function (k) { return it[k] && FISH[k].tier !== 'junk'; });
    best.forEach(function (k) { rows.push({ key: 'grill:' + k, label: 'grill ' + FISH[k].name.replace(/^(a|an) /, '') + ' → ' + FOODS[GRILL[FISH[k].tier]].name.replace(/^(a|an) /, ''), price: 0, have: it[k], ok: true }); });
    rows.push({ key: 'char', label: 'char 2 fruit → charred fruit', price: 0, have: fruit, ok: fruit >= 2 });
    if (where === 'kitchen') {
      rows.push({ key: 'stew', label: 'fish + 2 fruit → fish stew', price: 0, have: fruit, ok: best.length > 0 && fruit >= 2 });
      rows.push({ key: 'juice', label: 'press 3 fruit → fresh juice', price: 0, have: fruit, ok: fruit >= 3 });
    }
    if (Object.keys(FISH).some(function (k) { return it[k] && FISH[k].tier === 'junk'; })) rows.push({ key: 'junk', label: 'cook the junk you fished up', price: 0, have: 0, ok: true });
    return rows;
  }
  /* the cheapest fish goes in the stew, not your legendary */
  function stewFish(s) {
    var order = ['common', 'uncommon', 'rare', 'legendary'];
    return Object.keys(FISH).filter(function (k) { return s.items[k] && FISH[k].tier !== 'junk'; })
      .sort(function (a, b) { return order.indexOf(FISH[a].tier) - order.indexOf(FISH[b].tier); })[0];
  }
  function cook(s, key, where) {
    var it = s.items = s.items || {}, res = s.res = s.res || {};
    function take(k, n, from) { from[k] -= n; if (!from[k]) delete from[k]; }
    function give(k) { it[k] = (it[k] || 0) + 1; return { ok: true, made: k, name: FOODS[k].name }; }
    if (key === 'junk') return { ok: false, why: 'you are not cooking a boot' };
    if (key.indexOf('grill:') === 0) {
      var f = key.slice(6);
      if (!FISH[f] || !it[f] || FISH[f].tier === 'junk') return { ok: false, why: 'no fish like that' };
      take(f, 1, it); return give(GRILL[FISH[f].tier]);
    }
    if (key === 'char') { if ((res.fruit || 0) < 2) return { ok: false, why: 'you need 2 fruit' }; take('fruit', 2, res); return give('charred'); }
    if (where !== 'kitchen') return { ok: false, why: 'that needs a kitchen' };
    if (key === 'stew') {
      var sf = stewFish(s);
      if (!sf || (res.fruit || 0) < 2) return { ok: false, why: 'you need a fish and 2 fruit' };
      take(sf, 1, it); take('fruit', 2, res); return give('stew');
    }
    if (key === 'juice') { if ((res.fruit || 0) < 3) return { ok: false, why: 'you need 3 fruit' }; take('fruit', 3, res); return give('juice'); }
    return { ok: false, why: 'no such recipe' };
  }
  /* ── weight: kg per one of a thing. CARRY on foot; over it you crawl, over
     CARRY * FROZEN you can't move. chests and the boat's hold take the rest ── */
  var CARRY = 40, FROZEN = 1.5, STASH_CAP = 200, HOLD_CAP = 40;
  var RES_KG = { timber: 2, fibre: 0.5, scrap: 1.5, fruit: 0.3 };
  var TIER_KG = { junk: 0.6, common: 0.4, uncommon: 1, rare: 2.5, legendary: 7 };
  var KG = { boot: 1, can: 0.1, sardine: 0.2, grouper: 9, glassfish: 4, rod: 1.5, tuned: 2, jormun: 4, snowglobe: 1, compass: 0.3, pager: 0.2, cassette: 0.1, shell: 0.5, lighter: 0.1 };
  function weightOf(key) {
    if (KG[key] !== undefined) return KG[key];
    if (RES_KG[key] !== undefined) return RES_KG[key];
    if (FISH[key]) return TIER_KG[FISH[key].tier];
    if (FOODS[key]) return FOODS[key].drink > FOODS[key].food ? 0.5 : 0.4;
    if (CURIOS[key] || TOOLS[key]) return 0.5;
    return 0.2;
  }
  function weighs(box) {
    var t = 0;
    [box.res || {}, box.items || {}].forEach(function (b) { Object.keys(b).forEach(function (k) { t += weightOf(k) * (b[k] || 0); }); });
    return Math.round(t * 10) / 10;
  }
  function carried(s) { return weighs({ res: s.res, items: s.items }); }
  /* 0..1 is fine; over 1 you crawl; over FROZEN you're stuck */
  function load(s) { return s.dev && s.dev.noweight ? 0 : carried(s) / CARRY; }
  function stashOf(s, where) {
    if (where === 'hold') { if (!s.hold || typeof s.hold !== 'object') s.hold = { items: {}, res: {} }; return s.hold; }
    if (!s.stash) s.stash = {};
    if (!s.stash[where]) s.stash[where] = { items: {}, res: {} };
    return s.stash[where];
  }
  function stashRows(s, where, tab) {
    var box = tab === 'buy' ? stashOf(s, where) : { res: s.res || {}, items: s.items || {} }, rows = [];
    [['res', box.res || {}], ['items', box.items || {}]].forEach(function (pair) {
      Object.keys(pair[1]).forEach(function (k) { if (pair[1][k] > 0) rows.push({ key: k, label: nameOf(k) + ' · ' + weightOf(k) + 'kg', price: 0, have: pair[1][k], ok: true }); });
    });
    return rows;
  }
  /* move one: TAKE (buy tab) chest → pockets, STORE (sell tab) pockets → chest */
  function stashMove(s, where, tab, key) {
    var box = stashOf(s, where), pockets = { res: s.res = s.res || {}, items: s.items = s.items || {} };
    var from = tab === 'buy' ? box : pockets, to = tab === 'buy' ? pockets : box, kind = RES[key] ? 'res' : 'items';
    if (!to[kind]) to[kind] = {};
    if (!from[kind] || !from[kind][key]) return { ok: false, why: 'none left' };
    var cap = where === 'hold' ? HOLD_CAP : STASH_CAP;
    if (tab === 'sell' && weighs(box) + weightOf(key) > cap) return { ok: false, why: 'it\'s full (' + cap + 'kg)' };
    from[kind][key]--; if (!from[kind][key]) delete from[kind][key];
    to[kind][key] = (to[kind][key] || 0) + 1;
    return { ok: true, price: 0, name: nameOf(key), moved: tab === 'buy' ? 'took' : 'stored' };
  }
  /* throw one away */
  function drop(s, key) {
    var b = RES[key] ? s.res : s.items;
    if (!b || !b[key]) return false;
    b[key]--; if (!b[key]) delete b[key];
    if (TOOLS[key] && !b[key] && s.wear) delete s.wear[key];
    return true;
  }

  function place(id) {
    if (String(id).indexOf('stash:') === 0) {
      var where = id.slice(6);
      return where === 'hold' ? { kind: 'stash', where: 'hold', name: 'BOAT HOLD', line: 'a dry box under the seat. ' + HOLD_CAP + 'kg if you pack it right.', cap: HOLD_CAP }
                              : { kind: 'stash', where: where, name: 'YOUR CHEST', line: 'an old trunk. it holds ' + STASH_CAP + 'kg and everything you don\'t want to carry.', cap: STASH_CAP };
    }
    if (String(id).indexOf('cook:') === 0) {
      var kind = id.split(':')[2] || id.split(':')[1], f = FIRES[kind] || FIRES.grill;
      return { kind: 'cook', where: kind === 'kitchen' ? 'kitchen' : 'fire', name: f.name, line: f.line };
    }
    return STORES[id] || VENDORS[id] || null;
  }
  /* take-away food from your pockets */
  function eat(MF, s, key) {
    var f = FOODS[key];
    if (!f || !s.items || !s.items[key]) return { ok: false, why: 'nothing to eat' };
    s.items[key]--; if (!s.items[key]) delete s.items[key];
    MF.consume(s, f.food, f.drink, f.buff, f.secs);
    return { ok: true, name: f.name };
  }
  function goods(key) { return RES[key] || CURIOS[key] || TOOLS[key] || FISH[key] || FOODS[key] || null; }
  function nameOf(key) { var g = goods(key); return g ? g.name : key; }
  /* the counter's rows for a tab: what you can buy here, or what they'll buy off you */
  function storeRows(MF, s, id, tab) {
    var st = place(id), rows = [], res = s.res || {}, items = s.items || {};
    if (!st) return rows;
    if (st.kind === 'cook') return tab === 'buy' ? cookRows(s, st.where) : rows;
    if (st.kind === 'stash') return stashRows(s, st.where, tab);
    if (tab === 'buy' && st.menu) {
      st.menu.forEach(function (k) { var f = FOODS[k]; rows.push({ key: k, label: f.name + (f.buff ? ' · ' + f.buff : ''), price: f.price, have: 0, here: true }); });
      rows.forEach(function (r) { r.ok = MF.joules(s) >= r.price; });
    } else if (tab === 'buy') {
      if (st.foods) st.foods.forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: FOODS[k].price, have: items[k] || 0 }); });
      if (st.sells) Object.keys(st.sells).forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: st.sells[k], have: res[k] || 0 }); });
      if (st.curios) st.curios.forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: CURIOS[k].price, have: items[k] || 0 }); });
      if (st.tools) st.tools.forEach(function (k) { rows.push({ key: k, label: nameOf(k), price: TOOLS[k].price, have: items[k] || 0 }); });
      rows.forEach(function (r) { r.ok = MF.joules(s) >= r.price; });
    } else if (st.kind === 'pawn') {
      Object.keys(st.buys).forEach(function (k) { if (res[k]) rows.push({ key: k, label: nameOf(k), price: st.buys[k], have: res[k], ok: true }); });
      Object.keys(CURIOS).forEach(function (k) { if (items[k]) rows.push({ key: k, label: nameOf(k), price: Math.floor(CURIOS[k].price / 2), have: items[k], ok: true }); });
      Object.keys(FISH).forEach(function (k) { if (items[k]) rows.push({ key: k, label: nameOf(k), price: FISH[k].price, have: items[k], ok: true }); });
    }
    return rows;
  }
  /* one of something, either way. all or nothing */
  function trade(MF, s, id, tab, key) {
    var pl = place(id);
    if (pl && pl.kind === 'stash') return stashMove(s, pl.where, tab, key);
    if (pl && pl.kind === 'cook') { var c = cook(s, key, pl.where); return c.ok ? { ok: true, price: 0, name: c.name, cooked: true } : c; }
    var row = storeRows(MF, s, id, tab).filter(function (r) { return r.key === key; })[0];
    if (!row) return { ok: false, why: tab === 'buy' ? 'not sold here' : 'nothing to sell' };
    if (!s.res) s.res = {};
    if (!s.items) s.items = {};
    var into = RES[key] ? s.res : s.items;
    /* a cart or a restaurant: you eat it there and then */
    if (tab === 'buy' && row.here) {
      if (!MF.spend(s, row.price)) return { ok: false, why: 'not enough joules', price: row.price };
      var f = FOODS[key];
      MF.consume(s, f.food, f.drink, f.buff, f.secs);
      return { ok: true, price: row.price, name: f.name, ate: true, buff: f.buff };
    }
    /* one rod of each kind is plenty */
    if (tab === 'buy' && TOOLS[key] && s.items[key]) return { ok: false, why: 'you already have one' };
    if (tab === 'buy') {
      if (!MF.spend(s, row.price)) return { ok: false, why: 'not enough joules', price: row.price };
      into[key] = (into[key] || 0) + 1;
      if (TOOLS[key]) { if (!s.wear) s.wear = {}; s.wear[key] = TOOLS[key].dur; }
      return { ok: true, price: row.price, name: row.label };
    }
    into[key]--; if (!into[key]) delete into[key];
    MF.earn(s, row.price);
    return { ok: true, price: row.price, name: row.label };
  }

  root.MFShops = { KINDS: KINDS, SHOPS: SHOPS, HOMES: HOMES, RES: RES, BOAT: BOAT, boatShort: boatShort, buildBoat: buildBoat,
                   CURIOS: CURIOS, STORES: STORES, storeRows: storeRows, trade: trade,
                   FOODS: FOODS, VENDORS: VENDORS, place: place, eat: eat, FIRES: FIRES, GRILL: GRILL, cookRows: cookRows, cook: cook,
                   TOOLS: TOOLS, FISH: FISH, ZONES: ZONES, TIER_HARD: TIER_HARD, pickFish: pickFish, bestRod: bestRod, goods: goods,
                   WEAR: WEAR, rodLeft: rodLeft, wearRod: wearRod,
                   CARRY: CARRY, FROZEN: FROZEN, STASH_CAP: STASH_CAP, HOLD_CAP: HOLD_CAP, weightOf: weightOf, weighs: weighs, carried: carried, load: load, stashOf: stashOf, drop: drop,
                   price: price, quote: quote, allowed: allowed, buy: buy };
})(typeof window !== 'undefined' ? window : globalThis);
