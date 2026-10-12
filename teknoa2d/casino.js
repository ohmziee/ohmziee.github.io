/* EXiLED teknoa 2d — games of chance. No DOM in here: the rules, the
   payouts, and the money moving; overworld.js draws the tables. Runs under
   node for the tests. Everything is in Teknoan Joules (⚡), in-game only.

   A house is a place to play: the grand casino in worldwood (high stakes),
   or a redrum back room (small change). Each sets the bets it takes.

     slots(rng)                 three reels; pays()          what a line pays, x the bet
     bj.deal/hit/stand/double   blackjack against the dealer, 3:2 on a natural
     roulette(rng)              0..36, single zero; rouletteWin(bet, n)
     dice(rng)                  two dice; diceWin(bet, roll): high, low, seven
     lottoDraw(day)             the day's three digits, the same for everyone
     lottoWin(nums, draw)       what a ticket pays, x its price
     play(MF, s, house, bet)    takes the stake, all or nothing */
(function (root) {
  function r(rng) { return rng ? rng() : Math.random(); }

  var HOUSES = {
    grand: { name: 'CASINO SETTEBELLO', min: 100, max: 5000, door: 1000, games: ['slots', 'blackjack', 'roulette', 'dice', 'lotto'], ticket: 200 },
    /* redrum's small change: the back room, the corner, a slot in the arcade */
    dive:   { name: 'THE BACK ROOM', min: 5, max: 100, door: 0, games: ['slots', 'dice', 'lotto'], ticket: 10 },
    street: { name: 'REDRUM CORNER', min: 5, max: 50, door: 0, games: ['dice', 'lotto'], ticket: 10 },
    arcade: { name: 'ARCADE', min: 5, max: 50, door: 0, games: ['slots'], ticket: 10 }
  };
  /* the stake leaves your pocket before the game is played */
  function play(MF, s, house, bet) {
    var h = HOUSES[house];
    bet = Math.floor(+bet || 0);
    if (!h) return { ok: false, why: 'no such house' };
    if (bet < h.min) return { ok: false, why: 'the minimum here is ' + MF.fmtJ(h.min) };
    if (bet > h.max) return { ok: false, why: 'the most you can stake here is ' + MF.fmtJ(h.max) };
    if (!MF.spend(s, bet)) return { ok: false, why: 'not enough joules' };
    return { ok: true, bet: bet };
  }
  function payOut(MF, s, amount) { if (amount > 0) MF.earn(s, Math.floor(amount)); return Math.floor(amount); }

  /* ── slots ─────────────────────────────────────────────────
     weighted reels; three of a kind pays, two cherries pay small */
  var REEL = [['seven', 2], ['bolt', 3], ['knife', 5], ['ghost', 7], ['bar', 10], ['cherry', 13]];
  var LINE = { seven: 120, bolt: 40, knife: 20, ghost: 12, bar: 8, cherry: 5 };
  function reel(rng) {
    var total = 0, i; for (i = 0; i < REEL.length; i++) total += REEL[i][1];
    var x = r(rng) * total;
    for (i = 0; i < REEL.length; i++) { x -= REEL[i][1]; if (x < 0) return REEL[i][0]; }
    return REEL[REEL.length - 1][0];
  }
  function slots(rng) { return [reel(rng), reel(rng), reel(rng)]; }
  function pays(line) {
    if (line[0] === line[1] && line[1] === line[2]) return LINE[line[0]];
    var cherries = line.filter(function (x) { return x === 'cherry'; }).length;
    return cherries === 2 ? 2 : cherries === 1 && line[0] === 'cherry' ? 0.5 : 0;
  }

  /* ── blackjack ─────────────────────────────────────────────
     one deck, shuffled per hand. the dealer stands on 17 */
  var SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function deck(rng) {
    var d = [];
    SUITS.forEach(function (st) { RANKS.forEach(function (rk) { d.push(rk + st); }); });
    for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(r(rng) * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  function total(cards) {
    var t = 0, aces = 0;
    cards.forEach(function (c) { var rk = c.slice(0, -1); if (rk === 'A') { aces++; t += 11; } else t += 'JQK'.indexOf(rk) >= 0 ? 10 : +rk; });
    while (t > 21 && aces) { t -= 10; aces--; }
    return t;
  }
  function natural(cards) { return cards.length === 2 && total(cards) === 21; }
  var bj = {
    deal: function (bet, rng) {
      var d = deck(rng), h = { bet: bet, deck: d, player: [d.pop(), d.pop()], dealer: [d.pop(), d.pop()], done: false, result: '', paid: 0 };
      if (natural(h.player) || natural(h.dealer)) bj.settle(h);
      return h;
    },
    hit: function (h) {
      if (h.done) return h;
      h.player.push(h.deck.pop());
      if (total(h.player) > 21) bj.settle(h);
      return h;
    },
    stand: function (h) {
      if (h.done) return h;
      while (total(h.dealer) < 17) h.dealer.push(h.deck.pop());
      return bj.settle(h);
    },
    /* double: one more card for twice the stake (the caller takes the extra stake) */
    double: function (h) {
      if (h.done || h.player.length !== 2) return h;
      h.bet *= 2; h.doubled = true;
      h.player.push(h.deck.pop());
      if (total(h.player) > 21) return bj.settle(h);
      return bj.stand(h);
    },
    settle: function (h) {
      var p = total(h.player), d = total(h.dealer);
      h.done = true;
      if (natural(h.player) && !natural(h.dealer)) { h.result = 'blackjack'; h.paid = h.bet * 2.5; }
      else if (natural(h.dealer) && !natural(h.player)) { h.result = 'dealer blackjack'; h.paid = 0; }
      else if (p > 21) { h.result = 'bust'; h.paid = 0; }
      else if (d > 21) { h.result = 'dealer bust'; h.paid = h.bet * 2; }
      else if (p > d) { h.result = 'win'; h.paid = h.bet * 2; }
      else if (p === d) { h.result = 'push'; h.paid = h.bet; }
      else { h.result = 'lose'; h.paid = 0; }
      return h;
    },
    total: total
  };

  /* ── roulette: single zero ───────────────────────────────── */
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var BETS = ['red', 'black', 'odd', 'even', 'low', 'high', 'dozen1', 'dozen2', 'dozen3', 'number'];
  function roulette(rng) { return Math.floor(r(rng) * 37); }
  function colour(n) { return n === 0 ? 'green' : REDS.indexOf(n) >= 0 ? 'red' : 'black'; }
  /* x the stake, the stake included (0 = lost) */
  function rouletteWin(bet, n, pick) {
    if (bet === 'number') return n === pick ? 36 : 0;
    if (n === 0) return 0;
    if (bet === 'red' || bet === 'black') return colour(n) === bet ? 2 : 0;
    if (bet === 'odd') return n % 2 ? 2 : 0;
    if (bet === 'even') return n % 2 ? 0 : 2;
    if (bet === 'low') return n <= 18 ? 2 : 0;
    if (bet === 'high') return n >= 19 ? 2 : 0;
    var dz = { dozen1: [1, 12], dozen2: [13, 24], dozen3: [25, 36] }[bet];
    return dz && n >= dz[0] && n <= dz[1] ? 3 : 0;
  }

  /* ── high-low dice ─────────────────────────────────────────
     high is 8 and up, low is 6 and down; seven is its own long shot */
  function dice(rng) { return [1 + Math.floor(r(rng) * 6), 1 + Math.floor(r(rng) * 6)]; }
  function diceWin(bet, roll) {
    var t = roll[0] + roll[1];
    if (bet === 'seven') return t === 7 ? 5 : 0;
    if (bet === 'high') return t >= 8 ? 2 : 0;
    if (bet === 'low') return t <= 6 ? 2 : 0;
    return 0;
  }

  /* ── the lottery: three digits a day, drawn from the date ─── */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function lottoDraw(day) {
    var h = hash('teknoa-lotto|' + day);
    return [h % 10, Math.floor(h / 10) % 10, Math.floor(h / 100) % 10];
  }
  function lottoWin(nums, draw) {
    var hits = 0; for (var i = 0; i < 3; i++) if (nums[i] === draw[i]) hits++;
    return hits === 3 ? 250 : hits === 2 ? 8 : hits === 1 ? 1 : 0;
  }
  function quickPick(rng) { return [Math.floor(r(rng) * 10), Math.floor(r(rng) * 10), Math.floor(r(rng) * 10)]; }

  root.MFCasino = { HOUSES: HOUSES, play: play, payOut: payOut, REEL: REEL, LINE: LINE, slots: slots, pays: pays,
                    bj: bj, deck: deck, roulette: roulette, colour: colour, rouletteWin: rouletteWin, BETS: BETS,
                    dice: dice, diceWin: diceWin, lottoDraw: lottoDraw, lottoWin: lottoWin, quickPick: quickPick };
})(typeof window !== 'undefined' ? window : globalThis);
