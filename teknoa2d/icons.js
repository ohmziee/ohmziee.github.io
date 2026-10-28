/* Teknoa 2D: the little pixel icons on the phone's INV app.
   Every sprite is 12x12. Each item names a shape and a tint (ICON below);
   the shape's a is the tint, b its shade, c its highlight.
     .  clear    k  outline    a  tint    b  shade    c  highlight
     w  white    s  steel      r  red     y  yellow   g  leaf green   n  wood
   An item with no entry gets the shape of its kind (fish, food, curio ...),
   and anything unknown gets a crate. */
(function (root) {
  'use strict';
  var N = 12;
  var SHAPES = {
    bottle: ['.....kk.....', '....kssk....', '....kaak....', '...kaaaak...', '..kaccaaak..', '..kacaaaak..', '..kaaaaaak..',
             '..kwwwwwwk..', '..kaaaaaak..', '..kaaaaaak..', '..kbaaaabk..', '...kkkkkk...'],
    cup:    ['............', '....w..w....', '.....w..w...', '..kkkkkkkk..', '..kcaaaaakkk', '..kcaaaaak.k', '..kaaaaaak.k',
             '..kbaaaaakkk', '...kbaaak...', '...kbbbbk...', '....kkkk....', '............'],
    bowl:   ['............', '...w..w..w..', '....w..w....', '............', '.kkkkkkkkkk.', '.kccaaaaaak.', '..kaaaaaak..',
             '..kbaaaaak..', '...kbbbbk...', '....kkkk....', '....kbbk....', '....kkkk....'],
    pot:    ['............', '...w...w....', '....w...w...', '.kkkkkkkkkk.', 'kkcaaaaaaakk', 'k.kaaaaaak.k', '..kaaaaaak..',
             '..kaaaaaak..', '..kbaaaaak..', '..kbbbbbbk..', '...kkkkkk...', '............'],
    bun:    ['............', '............', '............', '....kkkk....', '..kkccaakk..', '.kcaaaaaaak.', '.kaaaaaaaak.',
             '.kgggggggk..', '.kbbbbbbbbk.', '.kkkkkkkkkk.', '............', '............'],
    skewer: ['..........k.', '.........k..', '.......kk...', '......kaak..', '.....kcak...', '....kbak....', '...kaak.....',
             '..kbak......', '..kkk.......', '.k..........', 'k...........', '............'],
    bar:    ['............', '............', '............', '..kkkkkkkk..', '.kcaaaaaaak.', '.kawwwwwwak.', '.kaaaaaaaak.',
             '.kbbbbbbbbk.', '..kkkkkkkk..', '............', '............', '............'],
    fruit:  ['......gk....', '.....gg.....', '....kkkk....', '...kccaak...', '..kcaaaaak..', '..kaaaaaak..', '..kaaaaabk..',
             '..kbaaaabk..', '...kbbbbk...', '....kkkk....', '............', '............'],
    berries:['.....g......', '....g.g.....', '...kk.kk....', '..kcak.kk...', '..kaak.kak..', '...kk.kcak..', '...kk..kk...',
             '..kcak......', '..kaak......', '...kk.......', '............', '............'],
    fish:   ['............', '............', '............', '...kkkk..k..', '..kcaaaakkk.', '.kcwkaaaabbk', '.kaaaaaaabk.',
             '..kbbbbbkkk.', '...kkkk..k..', '............', '............', '............'],
    boot:   ['............', '...kkkk.....', '...kaak.....', '...kaak.....', '...kaak.....', '...kaak.....', '...kaakkkk..',
             '...kaaaaaak.', '...kaaaaaak.', '...kbbbbbbk.', '...kkkkkkkk.', '............'],
    can:    ['............', '...kkkkkk...', '..kssssssk..', '..kaaaaaak..', '..kcwwwwak..', '..kcaaaaak..', '..kaaaaaak..',
             '..kbaaaabk..', '..kssssssk..', '...kkkkkk...', '............', '............'],
    rod:    ['..........kk', '.........kak', '........kak.', '.......kak.w', '......kak..w', '.....kak...w', '....kak....w',
             '...knk.....w', '..knnk.....s', '.knnk.......', '.kkk........', '............'],
    torch:  ['............', '............', '............', '.kkkkkkk....', 'ksssssssk.yy', 'kaaaaaaaskyy', 'kaaaaaaaskyy',
             'kbbbbbbbsk.y', '.kkkkkkk....', '............', '............', '............'],
    medkit: ['............', '....kkkk....', '...k....k...', '.kkkkkkkkkk.', '.kwwwrrwwwk.', '.kwwwrrwwwk.', '.kwrrrrrrwk.',
             '.kwwwrrwwwk.', '.kwwwrrwwwk.', '.kssssssssk.', '.kkkkkkkkkk.', '............'],
    bandage:['............', '............', '...kkkkkk...', '..kcaaaaakk.', '.kcaakkaaakk', '.kaakwwkaaak', '.kaakwwkaaak',
             '.kbaakkaabk.', '..kbaaaabk..', '...kkkkkk...', '............', '............'],
    log:    ['............', '............', '..kkkkkkkk..', '.kaaaaaaakk.', 'kcaaaaaaakyk', 'kaaaaaaaaknk', 'kaaaaaaaakyk',
             'kbbbbbbbbkk.', '.kkkkkkkk...', '............', '............', '............'],
    shirt:  ['............', '...kk..kk...', '..kaakkaak..', '.kaaaaaaaak.', 'kaaakaakaaak', 'kaakaaaakaak',
             '.k.kaaaak.k.', '...kaaaak...', '...kabbak...', '...kaaaak...', '...kbbbbk...', '...kkkkkk...'],
    hat:    ['............', '............', '............', '....kkkk....', '...kaaaak...', '...kaaaak...',
             '...kbbbbk...', '.kkaaaaaakk.', 'kaaaaaaaaaak', '.kkkkkkkkkk.', '............', '............'],
    bundle: ['............', '..k..k..k...', '..ka.ka.ka..', '..ka.ka.ka..', '...kakakak..', '...kkkkkkk..', '...kwwwwwk..',
             '...kakakak..', '..ka.ka.ka..', '..kb.kb.kb..', '..k..k..k...', '............'],
    nut:    ['............', '....kkkk....', '..kkaaaakk..', '.kcaaaaaabk.', '.kaakkkkabk.', '.kaak..kabk.', '.kaak..kabk.',
             '.kaakkkkabk.', '.kbaaaaabbk.', '..kkbbbbkk..', '....kkkk....', '............'],
    globe:  ['............', '....kkkk....', '...kccwak...', '..kcwaawak..', '..kawaaawk..', '..kaaggaak..', '...kaggak...',
             '....kkkk....', '..knnnnnnk..', '..kbnnnnbk..', '..kkkkkkkk..', '............'],
    pager:  ['............', '............', '.kkkkkkkkkk.', '.kaaaaaaaak.', '.kakggggkak.', '.kakggggkak.', '.kakkkkkkak.',
             '.kaaaaaaaak.', '.kasasasaak.', '.kbbbbbbbbk.', '.kkkkkkkkkk.', '............'],
    compass:['............', '....kkkk....', '..kkaaaakk..', '.kawwwrwwak.', '.kawwrwwwak.', '.kawwkwwwak.', '.kawwwswwak.',
             '.kawwswwwak.', '..kkaaaakk..', '....kkkk....', '............', '............'],
    cassette:['............', '............', '.kkkkkkkkkk.', '.kaaaaaaaak.', '.kawwwwwwak.', '.kawkwwkwak.', '.kawwwwwwak.',
             '.kaakkkkaak.', '.kbaaaaaabk.', '.kkkkkkkkkk.', '............', '............'],
    shell:  ['............', '.....kk.....', '....kcak....', '...kcaaak...', '..kcakkaak..', '..kakwkaak..', '..kakkaabk..',
             '...kaaabk...', '..kkbbbkkk..', '.kkkkkkkkk..', '............', '............'],
    lighter:['....r.......', '...ryr......', '...ryyr.....', '....kk......', '...kssk.....', '...kssk.....', '..kaaaak....',
             '..kcaaak....', '..kaaaak....', '..kaaaak....', '..kbbbbk....', '...kkkk.....'],
    key:    ['............', '..kkkk......', '.kaaaak.....', 'kaakkaak....', 'kak..kak....', 'kaakkaakkkkk', '.kaaaakaaaak',
             '..kkkk.kakak', '.......k.k.k', '............', '............', '............'],
    boat:   ['............', '.....k......', '.....kw.....', '.....kww....', '.....kwww...', '.....kwwww..', '.....k......',
             'kkkkkkkkkkkk', 'kaaaaaaaaaak', '.kbaaaaaabk.', '..kkkkkkkk..', '............'],
    pipe:   ['..........kk', '.........kak', '........kak.', '.......kak..', '......kbk...', '.....kak....', '....kak.....',
             '...kbk......', '..kak.......', '.kask.......', '.kkk........', '............'],
    knife:  ['............', '.........kk.', '........kwk.', '.......kwsk.', '......kwsk..', '.....kwsk...', '....kwsk....',
             '...kkkk.....', '..kaak......', '.kaak.......', '.kkk........', '............'],
    bat:    ['.........kkk', '........kaak', '.......kaaak', '......kaaak.', '.....ksaak..', '....kaask...', '...kaak.....',
             '..kbak......', '.kbbk.......', 'kkbk........', 'kkk.........', '............'],
    baton:  ['..........y.', '.........kyk', '........kaak', '.......kaak.', '......kaak..', '.....kaak...', '....kbak....',
             '...kkkk.....', '..kssk......', '.kssk.......', '.kkk........', '............'],
    crate:  ['............', '............', '.kkkkkkkkkk.', '.kaaaaaaaak.', '.kakbbbbkak.', '.kabkbbkbak.', '.kabbkkbbak.',
             '.kabkbbkbak.', '.kakbbbbkak.', '.kaaaaaaaak.', '.kkkkkkkkkk.', '............']
  };
  var FIXED = { k: '#14121c', w: '#f4f1ea', s: '#a9b3c4', r: '#e0475b', y: '#ffe97c', g: '#5fbf6a', n: '#8a5a32' };
  /* item → [shape, tint] */
  var ICON = {
    water: ['bottle', '#7cc8ff'], soda: ['can', '#e0475b'], electro: ['can', '#7cf5ff'], buzz: ['can', '#ffe97c'], filtered: ['bottle', '#bfe9ff'],
    sorrel: ['cup', '#b0304a'], barley: ['cup', '#d6b47a'], icedbarley: ['cup', '#e8d3a0'], smoothie: ['cup', '#ff8ad0'], juice: ['cup', '#ffa040'],
    houseblend: ['cup', '#8a5a32'],
    eggcream: ['cup', '#c8a080'], boba: ['cup', '#c8a0e0'], coconut: ['fruit', '#8a6a3a'], ramune: ['bottle', '#9fe0ff'], mintwater: ['cup', '#9fe8b0'],
    coffee: ['cup', '#5a3a22'], blackcoffee: ['cup', '#2a1a12'], rainwater: ['bottle', '#a8b4c0'],
    hotdog: ['bun', '#c4573a'], pretzel: ['bar', '#c88a3a'], plantain: ['bar', '#f2d060'], takoyaki: ['bowl', '#c8803a'], honeycomb: ['bar', '#ffc030'],
    croissant: ['bun', '#e8b060'], soup: ['bowl', '#c06a3a'], fryup: ['pot', '#f2c94c'], pie: ['bun', '#a0402a'],
    noodles: ['bowl', '#ffd27c'], ramen: ['bowl', '#f2b45a'], wontons: ['bowl', '#f0dcc0'], stew: ['pot', '#a0522d'], feast: ['pot', '#d98a3a'],
    patty: ['bun', '#e2a23a'], cocobread: ['bun', '#f0d9a8'], bao: ['bun', '#f6efe0'], dumplings: ['bun', '#efe2c8'], sandwich: ['bun', '#d9a860'],
    skewer: ['skewer', '#b5552d'], bar: ['bar', '#a86a3a'], mango: ['fruit', '#ffb02e'], berries: ['berries', '#7a4adf'],
    grilled1: ['fish', '#b8743a'], grilled2: ['fish', '#a0602a'], grilled3: ['fish', '#8a4a1e'], charred: ['fish', '#3a2a22'],
    boot: ['boot', '#5a4632'], can: ['can', '#8a8f99'],
    rod: ['rod', '#a07a4a'], tuned: ['rod', '#7cc8ff'], jormun: ['rod', '#f2c94c'],
    thermal: ['shirt', '#c4473a'], parka: ['shirt', '#e8b13a'], coolvest: ['shirt', '#7cf5ff'], sunhat: ['hat', '#d9c08a'],
    flashlight: ['torch', '#5a6378'], pipe: ['pipe', '#8a8f99'], knife: ['knife', '#3a3f4a'], bat: ['bat', '#b07a45'], baton: ['baton', '#2a2f3d'], medkit: ['medkit', '#e0475b'], bandage: ['bandage', '#ead9b8'],
    timber: ['log', '#9a6a3a'], fibre: ['bundle', '#9fbf5a'], scrap: ['nut', '#8a8f99'], fruit: ['fruit', '#ff7a45'],
    snowglobe: ['globe', '#bfe9ff'], pager: ['pager', '#3a3f4a'], compass: ['compass', '#c9a24a'], cassette: ['cassette', '#ff4fd8'],
    shell: ['shell', '#ffc6a8'], lighter: ['lighter', '#7cffb2'],
    '@key': ['key', '#f2c94c'], '@boat': ['boat', '#8a5a32']
  };
  /* a fish's colour when it has no entry: by tier, nudged per kind */
  var TIER = { junk: '#8a8f99', common: '#7cc8ff', uncommon: '#7cffb2', rare: '#ff9de2', legendary: '#ffe97c' };

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function m(v) { return Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); }
    return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1);
  }
  function hue(key) { var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return h; }
  /* which shape and tint an item gets; SH is MFShops, for the kinds */
  function pick(key, SH) {
    if (ICON[key]) return ICON[key];
    SH = SH || root.MFShops || {};
    if (SH.FISH && SH.FISH[key]) {
      var t = TIER[SH.FISH[key].tier] || TIER.common;
      return ['fish', shade(t, 0.8 + (hue(key) % 5) * 0.1)];
    }
    if (SH.FOODS && SH.FOODS[key]) return SH.FOODS[key].food ? ['bowl', '#e2a23a'] : ['cup', '#7cc8ff'];
    if (SH.CURIOS && SH.CURIOS[key]) return ['crate', '#c9a24a'];
    if (SH.TOOLS && SH.TOOLS[key]) return ['rod', '#a07a4a'];
    return ['crate', '#a07a4a'];
  }
  /* the sprite as rows of colours ('' for clear) */
  function grid(key, SH) {
    var p = pick(key, SH), rows = SHAPES[p[0]] || SHAPES.crate, a = p[1];
    var pal = { a: a, b: shade(a, 0.7), c: shade(a, 1.45) };
    return rows.map(function (r) {
      var out = [];
      for (var x = 0; x < N; x++) { var ch = r.charAt(x); out.push(ch === '.' || !ch ? '' : pal[ch] || FIXED[ch] || ''); }
      return out;
    });
  }
  /* a canvas of the icon, px pixels a side (drawn crisp: CSS keeps it pixelated) */
  function canvas(key, px, SH) {
    var c = root.document.createElement('canvas'), g = grid(key, SH), sc = Math.max(1, Math.floor((px || 36) / N));
    c.width = c.height = N * sc; c.className = 'icon';
    var x2 = c.getContext('2d');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x]) { x2.fillStyle = g[y][x]; x2.fillRect(x * sc, y * sc, sc, sc); }
    return c;
  }
  root.MFIcons = { N: N, SHAPES: SHAPES, ICON: ICON, pick: pick, grid: grid, canvas: canvas };
})(typeof window !== 'undefined' ? window : globalThis);
