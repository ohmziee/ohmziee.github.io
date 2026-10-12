/* EXiLED teknoa 2d — the gathering games. No DOM in here: each game is a
   little state machine, stepped once a frame with what the player pressed;
   overworld.js draws it. Runs under node for the tests.

     create(kind, rng)   a fresh game for a pile of timber, fibre, scrap or fruit
     step(g, dt, input)  input: { a, hold, left, right } (a/left/right: pressed
                         this frame; hold: A is down). g.done when it's over,
                         g.score 0..1, g.perfect for a clean run
     amount(n, g)        what the pile gives: never less than 1

   CHOP (timber)  A when the blade is in the notch. three swings, each faster,
                  the notch narrower
   TWIST (fibre)  left, right, left, right. same side twice slips. fill it
                  before the time runs out
   PRY (scrap)    hold A, let go in the green. past the top it snaps. two tries
   CATCH (fruit)  fruit drops down three lanes. move the basket under it
   FISH           wait (A too soon spooks it), strike on the '!', then hold A
                  to reel: the catch comes in but the tension climbs. ease
                  off before it snaps. opts.hard: how much fight it has */
(function (root) {
  function rand(rng) { return rng ? rng() : Math.random(); }

  var MAKE = {
    fish: function (rng, opts) {
      var hard = (opts && opts.hard) || 1, ease = (opts && opts.ease) || 1;
      return { kind: 'fish', title: 'FISH', hint: 'wait for the bite', phase: 'wait', bite: 1.5 + rand(rng) * 3, window: 0.75,
               progress: 0, tension: 0, peak: 0, hard: hard, ease: ease, surge: 0, rng: rng };
    },
    timber: function () {
      return { kind: 'timber', title: 'CHOP', hint: 'A when the blade is in the notch', pos: 0, dir: 1, speed: 85,
               zone: [38, 62], swings: 0, hits: 0, clean: 0, of: 3 };
    },
    fibre: function () {
      return { kind: 'fibre', title: 'TWIST', hint: 'left, right, left, right. fast', meter: 0, last: '', time: 5, of: 100 };
    },
    scrap: function () {
      return { kind: 'scrap', title: 'PRY', hint: 'hold A. let go in the green', meter: 0, holding: false, zone: [70, 88], tries: 2, snapped: 0 };
    },
    fruit: function (rng) {
      var drops = [];
      for (var i = 0; i < 6; i++) drops.push({ lane: Math.floor(rand(rng) * 3), y: -i * 55, done: false, got: false });
      return { kind: 'fruit', title: 'CATCH', hint: 'left and right to move the basket', basket: 1, drops: drops, caught: 0, speed: 60 };
    }
  };
  function create(kind, rng, opts) {
    var g = (MAKE[kind] || MAKE.timber)(rng, opts);
    g.done = false; g.score = 0; g.perfect = false; g.t = 0;
    return g;
  }

  function step(g, dt, input) {
    if (g.done) return g;
    input = input || {};
    g.t += dt;
    if (g.kind === 'fish') {
      if (g.phase === 'wait') {
        if (input.a) { g.done = true; g.why = 'spooked'; return g; }
        g.bite -= dt;
        if (g.bite <= 0) { g.phase = 'bite'; g.hint = '! strike! press A'; }
      } else if (g.phase === 'bite') {
        g.window -= dt;
        if (input.a) { g.phase = 'reel'; g.hint = 'hold A to reel. ease off before it snaps'; }
        else if (g.window <= 0) { g.done = true; g.why = 'missed'; }
      } else {
        /* it fights back in surges */
        g.surge -= dt;
        if (g.surge <= 0) { g.surge = 0.8 + rand(g.rng) * 1.4; g.tension += 12 * g.hard; }
        if (input.hold) { g.progress += 26 * dt / g.hard; g.tension += 34 * dt * g.hard * g.ease; }
        else { g.progress = Math.max(0, g.progress - 4 * dt); g.tension -= 45 * dt; }
        g.tension = Math.max(0, g.tension);
        g.peak = Math.max(g.peak, g.tension);
        if (g.tension >= 100) { g.done = true; g.why = 'snapped'; }
        else if (g.progress >= 100) { g.done = true; g.score = 1; g.perfect = g.peak < 70; }
      }
      return g;
    }
    if (g.kind === 'timber') {
      g.pos += g.dir * g.speed * dt;
      if (g.pos >= 100) { g.pos = 100; g.dir = -1; }
      if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
      if (input.a) {
        g.swings++;
        var mid = (g.zone[0] + g.zone[1]) / 2;
        if (g.pos >= g.zone[0] && g.pos <= g.zone[1]) { g.hits++; if (Math.abs(g.pos - mid) <= 4) g.clean++; }
        g.zone = [g.zone[0] + 3, g.zone[1] - 3]; g.speed += 30;
        if (g.swings >= g.of) { g.done = true; g.score = g.hits / g.of; g.perfect = g.clean === g.of; }
      }
    } else if (g.kind === 'fibre') {
      g.time -= dt;
      var side = input.left ? 'left' : input.right ? 'right' : '';
      if (side) g.meter += side !== g.last ? 9 : -5;
      if (side) g.last = side;
      g.meter = Math.max(0, Math.min(100, g.meter - 9 * dt));
      if (g.meter >= 100) { g.done = true; g.score = 1; g.perfect = g.time > 2; }
      else if (g.time <= 0) { g.done = true; g.score = Math.round(g.meter) / 100 * 0.8; }
    } else if (g.kind === 'scrap') {
      if (input.hold) { g.holding = true; g.meter += 55 * dt; }
      if (g.holding && g.meter > 100) { g.holding = false; g.meter = 0; g.tries--; g.snapped++; }
      else if (g.holding && !input.hold) {
        g.holding = false;
        if (g.meter >= g.zone[0] && g.meter <= g.zone[1]) { g.done = true; g.score = 1; g.perfect = g.snapped === 0 && Math.abs(g.meter - 79) <= 4; return g; }
        g.meter = 0; g.tries--;
      }
      if (g.tries <= 0) { g.done = true; g.score = 0; }
    } else if (g.kind === 'fruit') {
      if (input.left) g.basket = Math.max(0, g.basket - 1);
      if (input.right) g.basket = Math.min(2, g.basket + 1);
      var left = 0;
      g.drops.forEach(function (d) {
        if (d.done) return;
        d.y += g.speed * dt;
        if (d.y >= 90) { d.done = true; d.got = d.lane === g.basket; if (d.got) g.caught++; }
        else left++;
      });
      if (!left) { g.done = true; g.score = g.caught / g.drops.length; g.perfect = g.caught === g.drops.length; }
    }
    return g;
  }

  function amount(n, g) {
    return Math.max(1, Math.round(n * (0.5 + g.score))) + (g.perfect ? 1 : 0);
  }

  root.MFMini = { create: create, step: step, amount: amount, KINDS: Object.keys(MAKE).filter(function (k) { return k !== 'fish'; }), GAMES: Object.keys(MAKE) };
})(typeof window !== 'undefined' ? window : globalThis);
