/* EXiLED teknoa 2d — Nova City, as a tile map. No DOM in here: it builds the
   map from a description and answers questions about it; overworld.js draws
   it and walks the player around. Runs under node for the tests.

   The land is the terranova map's (azgaar, GEO below): vistadelsol's coast
   round the nova sea, nova city's island in the bay cut into five district
   islands (bridged, each its share of the vault's km²), and redrum's island
   out west past the strait. The islands are drawn bigger than they are so
   the streets fit (redrum E times, nova city EN: as big as it goes and still
   keeps open water to the mainland); everything else is to scale. Streets, buildings and
   people are laid by rule on top of that, so nothing is hand-painted.

   Tiles:  0 deep water  1 shallow  2 sand  3 ground  4 road  5 building
           6 tree  7 bridge  8 grass  9 landmark  10 mainland  11 stall
           indoors: 12 floor  13 wall  14 door mat  15 tiled floor */
(function (root) {
  /* the terranova map's coast round the nova sea, in map units (azgaar:
     Terranova_2036 2026-04-12, the svg's feature paths flattened: land =
     the mainland, clipped to the bay, and the persepolis islet; nova and
     redrum are the two islands). win is the part of the map the game shows */
  var GEO = { win: [918.0, 645.0, 1090.0, 775.0],
    land: ["1094.0,641.0,1094.0,779.0,998.3,779.0,997.5,778.3,996.7,777.7,996.0,777.3,995.5,777.0,994.9,776.7,994.2,776.2,993.2,775.4,991.9,774.5,990.6,773.5,989.3,772.7,988.1,772.0,987.0,771.4,985.9,770.7,984.8,769.8,983.7,768.5,982.6,767.0,981.6,765.4,980.8,764.0,980.4,762.9,980.2,762.1,980.4,761.4,981.0,760.7,981.9,759.9,983.2,759.2,984.7,758.7,986.5,758.7,988.5,759.2,990.5,760.1,992.5,761.0,994.5,761.8,996.3,762.3,997.8,762.4,999.2,762.2,1000.2,762.0,1000.9,761.7,1001.4,761.4,1001.6,760.9,1001.7,760.2,1001.6,759.2,1001.4,758.0,1000.9,756.7,1000.2,755.5,999.2,754.5,998.0,753.5,996.9,752.5,996.0,751.3,995.4,750.0,995.1,748.5,994.9,747.2,994.8,746.0,994.7,745.2,994.5,744.5,994.2,743.8,994.0,743.0,993.8,741.9,993.5,740.5,993.4,739.1,993.3,738.0,993.4,737.2,993.6,736.4,994.1,735.6,994.7,734.5,995.5,732.9,996.5,731.0,997.6,729.2,998.7,727.7,999.6,726.7,1000.5,726.3,1001.4,726.2,1002.3,726.5,1003.4,727.0,1004.5,727.5,1005.5,728.0,1006.5,728.5,1007.3,728.8,1008.0,729.1,1008.8,729.5,1009.8,730.2,1011.1,731.2,1012.5,732.5,1013.8,733.9,1014.8,735.0,1015.5,735.8,1015.9,736.5,1016.2,737.0,1016.5,737.7,1017.0,738.5,1017.6,739.5,1018.6,740.6,1019.7,741.7,1021.0,742.6,1022.5,743.5,1024.0,744.5,1025.3,745.5,1026.4,746.7,1027.3,748.0,1027.9,749.4,1028.2,750.7,1028.2,751.9,1028.0,753.0,1027.9,754.2,1028.0,755.5,1028.4,756.9,1029.2,758.4,1030.2,759.8,1031.5,761.0,1032.9,761.8,1034.5,762.4,1035.9,762.8,1037.2,763.2,1038.2,763.6,1038.9,764.0,1039.6,764.4,1040.3,764.7,1041.1,764.9,1042.0,764.9,1042.9,764.9,1043.7,764.8,1044.4,764.7,1044.9,764.5,1045.4,764.3,1045.8,764.2,1046.2,764.1,1046.6,763.9,1047.2,763.7,1048.0,763.2,1049.1,762.4,1050.5,761.4,1051.9,760.4,1053.2,759.3,1054.2,758.4,1054.8,757.5,1055.3,756.5,1055.5,755.3,1055.5,754.0,1055.4,752.5,1055.2,751.1,1055.0,749.8,1054.8,748.8,1054.6,748.0,1054.6,747.2,1054.8,746.2,1055.3,744.9,1056.0,743.5,1056.7,742.1,1057.2,740.8,1057.4,739.8,1057.5,739.0,1057.6,738.2,1057.8,737.2,1058.3,735.9,1059.0,734.5,1059.7,733.0,1060.3,731.7,1060.7,730.5,1061.0,729.5,1061.4,728.5,1062.0,727.3,1062.9,726.0,1064.1,724.7,1065.4,723.8,1066.8,723.5,1068.2,724.1,1069.3,725.2,1070.3,726.7,1071.0,728.3,1071.3,729.7,1071.5,730.9,1071.5,732.1,1071.7,733.2,1072.1,734.3,1072.7,735.4,1073.6,736.2,1074.7,736.8,1076.0,737.0,1077.5,736.8,1079.0,736.3,1080.3,735.5,1081.4,734.5,1082.3,733.4,1083.0,732.0,1083.5,730.3,1083.8,728.5,1083.9,726.6,1083.9,724.7,1083.8,723.2,1083.7,722.0,1083.3,721.1,1082.8,720.3,1082.0,719.5,1080.8,718.5,1079.4,717.5,1077.7,716.6,1076.0,715.8,1074.3,715.3,1072.6,715.0,1071.0,714.8,1069.7,714.5,1068.6,714.0,1067.7,713.3,1067.0,712.4,1066.5,711.2,1066.2,709.7,1066.1,708.0,1066.1,706.3,1066.3,704.7,1066.6,703.3,1067.0,702.0,1067.4,700.9,1067.8,699.7,1068.2,698.4,1068.5,696.9,1068.7,695.4,1068.8,693.7,1068.9,691.9,1069.1,690.0,1069.3,688.3,1069.7,686.7,1070.3,685.3,1071.0,684.0,1071.7,682.9,1072.2,681.7,1072.4,680.4,1072.2,679.0,1071.7,677.8,1070.8,676.7,1069.5,675.8,1068.0,675.1,1066.4,674.7,1065.0,674.5,1063.9,674.4,1063.1,674.5,1062.3,674.7,1061.5,674.8,1060.5,674.9,1059.5,675.0,1058.5,675.1,1057.5,675.2,1056.7,675.3,1056.0,675.5,1055.3,675.7,1054.5,675.8,1053.5,675.9,1052.5,676.0,1051.4,676.1,1050.3,676.2,1049.4,676.3,1048.5,676.4,1047.5,676.5,1046.3,676.3,1045.0,675.9,1043.6,675.3,1042.2,674.4,1041.2,673.3,1040.5,672.0,1040.0,670.5,1039.7,668.9,1039.2,667.3,1038.4,665.9,1037.5,664.6,1036.5,663.6,1035.5,662.8,1034.7,662.3,1034.1,662.1,1033.5,662.1,1033.0,662.2,1032.5,662.3,1032.0,662.6,1031.4,663.2,1030.7,664.0,1029.9,665.2,1029.1,666.6,1028.4,668.1,1028.0,669.7,1027.9,671.1,1028.1,672.5,1028.3,673.7,1028.5,675.0,1028.6,676.3,1028.5,677.4,1028.4,678.5,1028.5,679.5,1028.7,680.3,1029.0,681.1,1029.4,681.9,1029.7,683.0,1029.9,684.4,1030.0,686.0,1030.2,687.6,1030.5,689.0,1031.0,690.1,1031.5,691.0,1032.0,692.0,1032.3,693.2,1032.5,694.7,1032.4,696.5,1032.1,698.3,1031.7,699.8,1031.1,701.0,1030.4,701.9,1029.7,702.8,1028.8,703.7,1027.9,704.8,1026.8,706.0,1025.5,707.2,1023.8,708.2,1021.8,708.9,1019.5,709.4,1017.3,709.7,1015.3,710.0,1013.8,710.2,1012.7,710.5,1011.9,710.9,1011.2,711.3,1010.6,711.9,1010.0,712.5,1009.4,713.2,1008.8,713.8,1008.1,714.4,1007.4,714.9,1006.3,715.3,1005.0,715.5,1003.3,715.6,1001.5,715.6,999.6,715.7,997.8,716.2,996.3,717.0,995.1,718.0,993.9,719.1,992.7,720.0,991.4,720.6,990.0,721.0,988.5,721.3,987.0,721.8,985.5,722.6,984.1,723.5,982.8,724.4,981.7,725.2,980.8,725.7,980.0,725.9,979.2,725.9,978.2,725.7,976.9,725.4,975.5,725.0,974.1,724.5,972.8,724.0,971.8,723.5,971.1,722.9,970.6,722.3,970.3,721.5,970.1,720.5,970.2,719.4,970.4,718.1,971.0,716.7,971.9,715.1,973.0,713.5,974.0,712.0,974.8,710.7,975.2,709.5,975.1,708.5,974.5,707.4,973.2,706.2,971.3,704.7,969.0,702.9,966.7,700.9,964.8,698.8,963.5,696.7,962.6,694.5,961.9,692.5,961.2,690.5,960.2,688.7,958.9,687.2,957.6,685.9,956.2,685.0,954.8,684.4,953.5,683.9,952.3,683.4,951.2,682.5,950.1,681.1,949.1,679.5,948.3,677.8,947.8,676.3,947.6,675.3,947.6,674.6,947.7,674.2,947.8,673.8,947.9,673.4,947.9,672.9,947.7,672.2,947.2,671.3,946.4,670.2,945.6,668.9,944.9,667.4,944.5,665.8,944.6,664.2,945.2,662.6,945.9,661.2,946.8,660.0,947.7,659.2,948.5,658.4,949.2,657.6,949.8,656.5,950.4,654.9,950.9,652.8,951.3,650.5,951.5,648.0,951.6,645.5,951.6,643.1,951.7,641.0", "928.5,653.2,928.9,654.5,929.4,656.1,929.8,657.7,930.0,659.3,929.8,660.7,929.4,661.9,928.6,662.8,927.8,663.5,926.9,664.0,926.0,664.4,925.1,664.5,924.2,664.3,923.3,663.9,922.6,663.3,922.1,662.4,921.8,661.3,921.9,660.0,922.2,658.5,922.7,656.9,923.5,655.5,924.5,654.2,925.5,653.2,926.4,652.3,927.2,651.8,927.7,651.6,928.2,652.3,928.5,653.2"],
    nova: '1031.7,716.8,1030.8,717.4,1030.2,718.0,1029.8,718.5,1029.5,719.1,1029.5,719.7,1029.5,720.3,1029.6,721.0,1029.8,721.8,1030.0,722.5,1030.1,723.3,1030.3,724.0,1030.3,724.8,1030.3,725.5,1030.1,726.3,1030.0,727.0,1029.9,727.7,1029.7,728.3,1029.7,729.0,1029.7,729.7,1029.9,730.3,1030.1,731.1,1030.4,731.8,1030.7,732.6,1031.0,733.5,1031.3,734.4,1031.7,735.4,1032.0,736.5,1032.4,737.5,1032.8,738.4,1033.2,739.2,1033.6,739.9,1034.1,740.4,1034.6,740.8,1035.2,741.1,1035.9,741.4,1036.7,741.5,1037.6,741.5,1038.5,741.5,1039.5,741.3,1040.5,741.0,1041.4,740.5,1042.2,739.8,1042.9,739.0,1043.4,738.0,1043.9,737.0,1044.2,736.0,1044.5,735.0,1044.8,734.2,1045.0,733.5,1045.2,733.0,1045.4,732.5,1045.4,732.1,1045.4,731.6,1045.2,731.0,1044.9,730.3,1044.5,729.4,1044.0,728.4,1043.6,727.3,1043.2,726.2,1043.0,725.0,1042.9,723.8,1043.0,722.7,1043.1,721.6,1043.2,720.5,1043.4,719.4,1043.5,718.5,1043.6,717.6,1043.5,716.8,1043.4,716.1,1043.2,715.5,1043.0,714.9,1042.8,714.5,1042.5,714.1,1042.2,713.9,1041.8,713.7,1041.2,713.6,1040.5,713.6,1039.5,713.8,1038.3,714.1,1036.9,714.6,1035.5,715.1,1034.1,715.6,1032.8,716.2,1031.7,716.8',
    redrum: '954.3,750.3,953.5,750.7,952.8,751.1,952.1,751.6,951.5,752.2,950.9,753.0,950.5,753.8,950.1,754.8,949.8,755.9,949.6,757.0,949.6,758.2,949.6,759.4,949.7,760.5,949.9,761.5,950.2,762.5,950.7,763.3,951.3,764.1,952.0,764.7,952.8,765.2,953.8,765.5,954.9,765.7,956.0,765.8,957.1,765.8,958.3,765.6,959.3,765.3,960.2,764.9,961.1,764.5,961.9,763.9,962.5,763.2,963.0,762.5,963.5,761.7,963.9,760.8,964.1,759.9,964.3,758.9,964.4,757.9,964.3,756.9,964.0,755.8,963.6,754.7,963.0,753.7,962.4,752.6,961.6,751.7,960.7,750.9,959.8,750.3,958.9,749.9,958.0,749.7,957.0,749.7,956.1,749.8,955.2,750.0,954.3,750.3',
    /* the vistadelsol towns (burgs) */
    burgs: { 'fort-freyja': [992.2, 719.8], 'port-tropics': [1000.7, 726.6], folkvangr: [987.1, 681.5], persepolis: [927.5, 652.8] } };
  var S = 5.5, E = 1.3, EN = 1.8, CHANNEL = 3;  /* tiles per map unit; redrum and nova drawn E / EN times their size; half a channel's width */
  var W = Math.round((GEO.win[2] - GEO.win[0]) * S), H = Math.round((GEO.win[3] - GEO.win[1]) * S);
  /* map units to tiles, an island grown E times about its middle */
  function pts(str) { var n = str.split(',').map(Number), out = []; for (var i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; }
  function tiles(str, grow) {
    var p = pts(str), mx = 0, my = 0;
    p.forEach(function (q) { mx += q[0]; my += q[1]; }); mx /= p.length; my /= p.length;
    return p.map(function (q) { var gx = grow ? mx + (q[0] - mx) * grow : q[0], gy = grow ? my + (q[1] - my) * grow : q[1]; return [(gx - GEO.win[0]) * S, (gy - GEO.win[1]) * S]; });
  }
  function toTile(m) { return [Math.round((m[0] - GEO.win[0]) * S), Math.round((m[1] - GEO.win[1]) * S)]; }
  function bbox(p) { var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; p.forEach(function (q) { b.x0 = Math.min(b.x0, q[0]); b.y0 = Math.min(b.y0, q[1]); b.x1 = Math.max(b.x1, q[0]); b.y1 = Math.max(b.y1, q[1]); }); return b; }
  /* bump when the map changes shape: a saved position from an older map
     means nothing on this one, so that player starts at the spawn */
  var VERSION = 7;
  var T = { DEEP: 0, SHALLOW: 1, SAND: 2, GROUND: 3, ROAD: 4, BUILDING: 5, TREE: 6, BRIDGE: 7,
            GRASS: 8, LANDMARK: 9, MAINLAND: 10, STALL: 11, FLOOR: 12, WALL: 13, MAT: 14, CHECK: 15 };
  var SOLID = {}; SOLID[T.DEEP] = SOLID[T.SHALLOW] = SOLID[T.BUILDING] = SOLID[T.TREE] = SOLID[T.LANDMARK] = SOLID[T.MAINLAND] = SOLID[T.STALL] = SOLID[T.WALL] = 1;

  /* km is each district's real area (it sets its share of nova city's
     island); seat is where in that island it sits. style picks how the
     streets are laid. Redrum is its own island out west past the strait, no
     bridge to it: far enough off that the NCPD doesn't raid it every night.
     you start there, and the only way across is a boat. Noorborj, its
     lighthouse, stands on its northern tip. */
  var DISTRICTS = [
    { id: 'worldwood', name: 'WORLDWOOD', sub: 'district 1 // the neon heart', km: 132, seat: [0.5, 0.5], style: 'grid', block: 5, seed: 11 },
    { id: 'yucayeque', name: 'YUCAYEQUE', sub: 'district 2 // markets and old songs', km: 222, seat: [0.72, 0.2], style: 'village', block: 4, seed: 23 },
    { id: 'naturia', name: 'NATURIA', sub: 'district 3 // the glowing wild', km: 139, seat: [0.25, 0.22], style: 'wild', block: 6, seed: 37 },
    { id: 'haven', name: 'HAVEN', sub: 'district 4 // where the council sits', km: 88, seat: [0.72, 0.82], style: 'civic', block: 7, seed: 41 },
    { id: 'majinryu', name: 'MAJINRYŪ', sub: 'district 5 // lanterns and labs', km: 72, seat: [0.28, 0.8], style: 'grid', block: 4, seed: 53 },
    { id: 'redrum', name: 'REDRUM', sub: 'district 6 // unofficially', km: 13, style: 'island', block: 3, seed: 67 }
  ];
  /* hand-placed offsets (landmarks, shops, people) were laid out at the
     first draft's scale; F spreads them out to the district sizes we keep */
  var F = 3.0 / 1.55;
  /* and nova city's further still, as it's drawn bigger than redrum */
  function fOf(d) { return d.style === 'island' ? F : F * EN / E; }

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

    /* ── the land, from the terranova map (azgaar, Terranova_2036 in the
       vault: the map is canon over the notes). GEO is in map units; S turns
       them into tiles. vistadelsol is the mainland round the bay (dist -2).
       nova city is its own island in the bay, drawn EN times its real size so
       the districts keep their streets, and cut into five islands with water
       between them (weighted by each district's km²). redrum is the island
       west of the peninsula, outside the bay, every tile of it redrum ── */
    function fill(pts, each) {
      var ys = pts.map(function (p) { return p[1]; }), lo = Math.max(0, Math.floor(Math.min.apply(null, ys))), hi = Math.min(H - 1, Math.ceil(Math.max.apply(null, ys)));
      for (var y = lo; y <= hi; y++) {
        var cy = y + 0.5, xs = [];
        for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          var a = pts[i], b = pts[j];
          if ((a[1] > cy) !== (b[1] > cy)) xs.push(a[0] + (cy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort(function (p, q) { return p - q; });
        for (var k = 0; k + 1 < xs.length; k += 2) for (var x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) each(x, y);
      }
    }
    GEO.land.forEach(function (p) { fill(tiles(p), function (x, y) { set(x, y, T.MAINLAND, -2); }); });
    /* redrum: the whole island */
    var R0 = DISTRICTS[5], rTiles = [];
    fill(tiles(GEO.redrum, E), function (x, y) { set(x, y, T.GROUND, 5); rTiles.push([x, y]); });
    /* nova city: the island, then a district for every tile, then water
       wherever two districts meet. each district grows from its seat, and
       its pull is evened out until its share of the island is its share
       of the vault's km² (a balanced power diagram) */
    var nova = tiles(GEO.nova, EN), nb = bbox(nova), cell = new Int8Array(W * H).fill(-1), novaTiles = [];
    fill(nova, function (x, y) { novaTiles.push([x, y]); });
    var seeds = DISTRICTS.slice(0, 5).map(function (d) { return { x: nb.x0 + d.seat[0] * (nb.x1 - nb.x0), y: nb.y0 + d.seat[1] * (nb.y1 - nb.y0), pull: 0, km: d.km } });
    var kmAll = seeds.reduce(function (t, sd) { return t + sd.km; }, 0), owner = new Int8Array(novaTiles.length);
    for (var round = 0; round < 60; round++) {
      var count = [0, 0, 0, 0, 0];
      novaTiles.forEach(function (p, n) {
        var best = 0, bd = 1e12;
        seeds.forEach(function (sd, i) { var dd = (p[0] - sd.x) * (p[0] - sd.x) + (p[1] - sd.y) * (p[1] - sd.y) - sd.pull; if (dd < bd) { bd = dd; best = i; } });
        owner[n] = best; count[best]++;
      });
      seeds.forEach(function (sd, i) { sd.pull += 0.5 * (novaTiles.length * sd.km / kmAll - count[i]); });
    }
    novaTiles.forEach(function (p, n) { cell[at(p[0], p[1])] = owner[n]; });
    novaTiles.forEach(function (p) {
      var me = cell[at(p[0], p[1])], edge = false;
      for (var oy = -CHANNEL; oy <= CHANNEL && !edge; oy++) for (var ox = -CHANNEL; ox <= CHANNEL; ox++) {
        var c = inside(p[0] + ox, p[1] + oy) ? cell[at(p[0] + ox, p[1] + oy)] : -1;
        if (c >= 0 && c !== me) { edge = true; break; }
      }
      if (!edge) set(p[0], p[1], T.GROUND, me);
    });
    /* each district's centre: the middle of its land, on its land */
    DISTRICTS.forEach(function (d, i) {
      d.index = i;
      var sx = 0, sy = 0, n = 0, far = 0, k;
      for (k = 0; k < W * H; k++) if (dist[k] === i) { sx += k % W; sy += (k / W) | 0; n++; }
      var mx = sx / n, my = sy / n, best = 1e9;
      for (k = 0; k < W * H; k++) if (dist[k] === i) {
        var x = k % W, y = (k / W) | 0, dd = (x - mx) * (x - mx) + (y - my) * (y - my);
        if (dd < best) { best = dd; d.cx = x; d.cy = y; }
        far = Math.max(far, dd);
      }
      /* R in the street loops is r * 1.4: wide enough to reach every tile */
      d.r = Math.sqrt(far) / 1.4 + 2;
      d.land = n;
    });
    /* beaches where it meets the water, shallows off them */
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (get(x, y) !== T.MAINLAND) continue;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (inside(x + ox, y + oy) && get(x + ox, y + oy) === T.DEEP) { set(x, y, T.SAND, -2); oy = ox = 2; }
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (get(x, y) !== T.DEEP) continue;
      for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var c = get(x + ox, y + oy); if (inside(x + ox, y + oy) && c !== T.DEEP && c !== T.SHALLOW) { set(x, y, T.SHALLOW); oy = ox = 3; } }
    }
    for (var i = 0; i < W * H; i++) {
      if (tile[i] !== T.GROUND) continue;
      var xx = i % W, yy = (i / W) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { var t = get(xx + o[0], yy + o[1]); return t === T.DEEP || t === T.SHALLOW; })) tile[i] = T.SAND;
    }

    /* streets, by district style. inner = land that is not beach.
       redrum is laid by hand-written rule of its own (redrumStreets) */
    var LANE = 4, RSPOT = {};
    DISTRICTS.forEach(function (d) {
      if (d.style === 'island') return redrumStreets(d);
      cityStreets(d);
    });

    /* ── nova city: roads LANE tiles wide on a grid of blocks, one of them
       through the district's centre, a pavement round every block. inside a
       block, by style: lots of shops and walk-ups with alleys between (grid),
       a civic building on its square or a lawn (civic), houses and yards
       (village). naturia is forest with footpaths, one road across it each
       way. core is a block's width inside its pavement ── */
    function cityStreets(d) {
      var di = d.index, R = Math.ceil(d.r * 1.4), rs = 0, o = LANE >> 1, x, y;
      var core = d.style === 'civic' ? d.block + 4 : d.block + 6, P = LANE + 2 + core;
      if (d.style !== 'wild') d.P = P;
      function mine(x, y) { return inside(x, y) && dist[at(x, y)] === di; }
      function rnd() { return hash(d.seed * 131 + rs++, 977); }
      function md(v) { return ((v % P) + P) % P; }
      function open(x, y) { return mine(x, y) && get(x, y) === T.GROUND; }
      for (y = d.cy - R; y <= d.cy + R; y++) for (x = d.cx - R; x <= d.cx + R; x++) {
        if (!open(x, y)) continue;
        var gx = md(x - d.cx + o), gy = md(y - d.cy + o);
        if (d.style === 'wild') {
          var bx = Math.floor((x - d.cx) / d.block), by = Math.floor((y - d.cy) / d.block), bn = hash(bx * 13 + d.seed, by * 17 + 5), n = hash(x * 3 + d.seed, y * 7);
          var wx = x - d.cx + o, wy = y - d.cy + o;
          /* the road across, each way; footpaths along the grain */
          if ((wx >= 0 && wx < LANE) || (wy >= 0 && wy < LANE)) set(x, y, T.ROAD);
          else if (Math.abs(Math.sin((x - d.cx) / 3.1) * 3 - ((y - d.cy) % 7)) < 0.7 || !(((x - d.cx) % d.block + d.block) % d.block)) set(x, y, T.GROUND);
          /* groves, not a wall of trees: thick in patches, open between */
          else if (n < (bn < 0.5 ? 0.6 : 0.22)) set(x, y, T.TREE);
          else if (n < (bn < 0.5 ? 0.64 : 0.25)) set(x, y, T.BUILDING);
          else set(x, y, T.GRASS);
        } else if (gx < LANE || gy < LANE) set(x, y, T.ROAD);
      }
      if (d.style === 'wild') return;
      /* each block's core, cut into lots with an alley down every cut */
      var mw = d.style === 'village' ? 4 : 5, mh = d.style === 'village' ? 3 : 4;
      function each(r, fn) { for (var yy = r[1]; yy <= r[3]; yy++) for (var xx = r[0]; xx <= r[2]; xx++) if (open(xx, yy)) fn(xx, yy); }
      function fill(r, t) { each(r, function (xx, yy) { set(xx, yy, t); }); }
      function lots(r, out) {
        var w = r[2] - r[0] + 1, h = r[3] - r[1] + 1;
        if (w <= mw && h <= mh) { out.push(r); return; }
        var vert = w > mw && (h <= mh || w >= h), span = vert ? w : h;
        var cut = Math.max(2, Math.min(span - 3, Math.floor(span * (0.4 + rnd() * 0.2))));
        out.push(null);
        lots(vert ? [r[0], r[1], r[0] + cut - 1, r[3]] : [r[0], r[1], r[2], r[1] + cut - 1], out);
        lots(vert ? [r[0] + cut + 1, r[1], r[2], r[3]] : [r[0], r[1] + cut + 1, r[2], r[3]], out);
      }
      var B0 = Math.floor((-R - o) / P) - 1, B1 = Math.ceil((R + o) / P) + 1;
      for (var by2 = B0; by2 <= B1; by2++) for (var bx2 = B0; bx2 <= B1; bx2++) {
        var x0 = d.cx - o + bx2 * P + LANE + 1, y0 = d.cy - o + by2 * P + LANE + 1, r = [x0, y0, x0 + core - 1, y0 + core - 1];
        var bk = hash(bx2 * 13 + d.seed, by2 * 17 + 5);
        if (d.style === 'grid' && bk < 0.2) {
          /* a plaza: paved, a tree at each corner, a bench of grass */
          each(r, function (xx, yy) {
            var cn = (xx === r[0] + 1 || xx === r[2] - 1) && (yy === r[1] + 1 || yy === r[3] - 1);
            set(xx, yy, cn ? T.TREE : hash(xx * 3 + d.seed, yy * 7) < 0.12 ? T.GRASS : T.GROUND);
          });
          continue;
        }
        if (d.style === 'civic') {
          /* a lawn with a path across and trees in rows, or a civic building on its square */
          var mx = (r[0] + r[2]) >> 1, my = (r[1] + r[3]) >> 1;
          if (bk < 0.35) each(r, function (xx, yy) { set(xx, yy, xx === mx || yy === my ? T.GROUND : (xx - r[0]) % 3 === 1 && (yy - r[1]) % 3 === 1 ? T.TREE : T.GRASS); });
          else {
            /* one hall, or two facing across a court */
            fill(r, T.GROUND);
            if (bk < 0.7) fill([r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1], T.BUILDING);
            else { fill([r[0] + 1, r[1] + 1, r[2] - 1, my - 2], T.BUILDING); fill([r[0] + 1, my + 2, r[2] - 1, r[3] - 1], T.BUILDING); }
          }
          continue;
        }
        var out = []; lots(r, out);
        /* every core tile not in a lot is an alley */
        var inLot = {};
        out.forEach(function (l) { if (l) for (var yy = l[1]; yy <= l[3]; yy++) for (var xx = l[0]; xx <= l[2]; xx++) inLot[yy * W + xx] = 1; });
        each(r, function (xx, yy) { if (!inLot[yy * W + xx]) set(xx, yy, T.GROUND); });
        out.forEach(function (l) {
          if (!l) return;
          var roll = rnd();
          if (d.style === 'village') {
            /* a house, a yard with a tree, or a bit of open ground */
            if (roll < 0.55) fill(l, T.BUILDING);
            else if (roll < 0.85) { var tx = l[0] + Math.floor(rnd() * (l[2] - l[0] + 1)), ty = l[1] + Math.floor(rnd() * (l[3] - l[1] + 1)); each(l, function (xx, yy) { set(xx, yy, xx === tx && yy === ty ? T.TREE : T.GRASS); }); }
            else fill(l, T.GROUND);
          } else if (roll < 0.86) fill(l, T.BUILDING);
          else if (roll < 0.94) fill(l, T.GROUND);
          else { var tx2 = (l[0] + l[2]) >> 1, ty2 = (l[1] + l[3]) >> 1; each(l, function (xx, yy) { set(xx, yy, xx === tx2 && yy === ty2 ? T.TREE : T.GRASS); }); }
        });
      }
      /* the pavement round each block is the ground left between */
    }

    /* ── redrum: a town on an island, not a grid. a ring road inside the
       coast, two avenues crossing in the middle, a few side streets, every
       road LANE tiles wide (two lanes, a car's width each way) with a
       pavement down both sides. between them, blocks cut into lots of every
       size with alleys through: walk-ups, yards, a paved lot, a tree. outside
       the ring a palm-lined seafront walk, a beach on the south shore, a park
       round the lighthouse; a park in the big block south-east. the arcade
       faces a plaza at the crossroads (RSPOT: where it and the walk-up go) ── */
    function redrumStreets(d) {
      var di = d.index, n = W * H, k, x, y, ox, oy, rs = 0;
      function mine(x, y) { return inside(x, y) && dist[at(x, y)] === di; }
      function rnd() { return hash(d.seed * 131 + rs++, 977); }
      /* how far each tile is from the sea (8-way steps; the beach is 1) */
      var dc = new Uint8Array(n), q = [];
      for (k = 0; k < n; k++) if (dist[k] === di) {
        x = k % W; y = (k / W) | 0;
        for (oy = -1; oy <= 1 && !dc[k]; oy++) for (ox = -1; ox <= 1; ox++) if (!mine(x + ox, y + oy)) { dc[k] = 1; q.push(k); break; }
      }
      for (var qi = 0; qi < q.length; qi++) {
        var c = q[qi], cx0 = c % W, cy0 = (c / W) | 0;
        for (oy = -1; oy <= 1; oy++) for (ox = -1; ox <= 1; ox++) {
          if (!mine(cx0 + ox, cy0 + oy) || dc[at(cx0 + ox, cy0 + oy)]) continue;
          dc[at(cx0 + ox, cy0 + oy)] = dc[c] + 1; q.push(at(cx0 + ox, cy0 + oy));
        }
      }
      function DC(x, y) { return mine(x, y) ? dc[at(x, y)] : 0; }
      /* the ring: as big a square as fits with its outer pavement 5 tiles
         in from the sea (beach, palms, the seafront walk, a verge) */
      function fits(l, r, t, b) {
        for (var i = l - 1; i <= r + 1; i++) if (DC(i, t - 1) < 5 || DC(i, b + 1) < 5) return false;
        for (var j = t - 1; j <= b + 1; j++) if (DC(l - 1, j) < 5 || DC(r + 1, j) < 5) return false;
        return true;
      }
      function grow(r, sides) {
        for (var grew = true; grew;) {
          grew = false;
          if (sides.indexOf('w') >= 0 && fits(r[0] - 1, r[1], r[2], r[3])) { r[0]--; grew = true; }
          if (sides.indexOf('e') >= 0 && fits(r[0], r[1] + 1, r[2], r[3])) { r[1]++; grew = true; }
          if (sides.indexOf('n') >= 0 && fits(r[0], r[1], r[2] - 1, r[3])) { r[2]--; grew = true; }
          if (sides.indexOf('s') >= 0 && fits(r[0], r[1], r[2], r[3] + 1)) { r[3]++; grew = true; }
        }
        return r;
      }
      /* the biggest square first, then a wide and a tall arm through it, each
         pushed out as far as the coast allows: the ring runs round the two
         arms, a cross with its corners cut, so it follows a round island */
      var sq = grow([d.cx - 8, d.cx + 7, d.cy - 8, d.cy + 7], 'wens'), cut = Math.round((sq[1] - sq[0]) * 0.22);
      var armW = grow([sq[0], sq[1], sq[2] + cut, sq[3] - cut], 'we'), armT = grow([sq[0] + cut, sq[1] - cut, sq[2], sq[3]], 'ns');
      var L = armW[0], R = armW[1], T0 = armT[2], B = armT[3];
      var inArm = function (r, x, y) { return x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]; };
      var U = function (x, y) { return inArm(armW, x, y) || inArm(armT, x, y); };
      /* the ring: every tile of the cross within LANE of its edge */
      function ringAt(x, y) {
        if (!U(x, y)) return false;
        for (var j = -LANE; j <= LANE; j++) for (var i = -LANE; i <= LANE; i++) if (!U(x + i, y + j)) return true;
        return false;
      }
      /* the lighthouse's tip (as noorborj finds it, below) */
      var top = d.cy, tipX = d.cx;
      for (y = 0; y < H && top === d.cy; y++) for (x = 0; x < W; x++) if (dist[at(x, y)] === di) { top = y; tipX = x; break; }
      /* the ground first: beach, palms, the seafront walk, a verge; the rest
         is open for lots (free). the south shore is all beach */
      var free = new Uint8Array(n), beachY = d.cy + (B - d.cy) * 0.45;
      for (k = 0; k < n; k++) if (dist[k] === di) {
        x = k % W; y = (k / W) | 0;
        var e = dc[k];
        if (U(x, y) || e >= 5) { tile[k] = T.GROUND; free[k] = 1; }
        else if (e === 1 || (y > beachY && e <= 3)) tile[k] = T.SAND;
        else if (e === 2) tile[k] = (x + y) % 4 === 0 && hash(x, y + 71) < 0.8 ? T.TREE : T.GRASS;
        else if (e === 3) tile[k] = T.GROUND;
        else tile[k] = T.GRASS;
      }
      /* the roads: the ring; the avenues through it to the shore (not north,
         where the headland is the lighthouse's); side streets, two of them
         stopping at an avenue so the corners aren't all the same */
      var ax = d.cx - (LANE >> 1), ay = d.cy - (LANE >> 1), ys = B, xw = L, xe = R;
      function lanesOk(fn) { for (var i = 0; i < LANE; i++) if (fn(i) < 3) return false; return true; }
      while (lanesOk(function (i) { return DC(ax + i, ys + 1); })) ys++;
      while (lanesOk(function (i) { return DC(xw - 1, ay + i); })) xw--;
      while (lanesOk(function (i) { return DC(xe + 1, ay + i); })) xe++;
      var jit = function (s) { return Math.round(hash(d.seed, s) * 2) - 1; };
      var vw = Math.round((L + LANE + ax) / 2) - (LANE >> 1) + jit(1), ve = Math.round((ax + LANE + R - LANE + 1) / 2) - (LANE >> 1) + jit(2);
      var hn = Math.round((T0 + LANE + ay) / 2) - (LANE >> 1) + jit(3), hs = Math.round((ay + LANE + B - LANE + 1) / 2) - (LANE >> 1) + jit(4);
      var roads = [[ax, T0, ax + LANE - 1, ys], [xw, ay, xe, ay + LANE - 1],
                   [vw, T0, vw + LANE - 1, B], [ve, T0, ve + LANE - 1, ay], [L, hn, R, hn + LANE - 1], [L, hs, ax, hs + LANE - 1]];
      function road(xx, yy) { if (mine(xx, yy)) { tile[at(xx, yy)] = T.ROAD; free[at(xx, yy)] = 0; } }
      for (y = T0; y <= B; y++) for (x = L; x <= R; x++) if (ringAt(x, y)) road(x, y);
      roads.forEach(function (r, i) {
        /* the side streets stay inside the ring; the avenues run on out */
        for (var yy = r[1]; yy <= r[3]; yy++) for (var xx = r[0]; xx <= r[2]; xx++) if (i < 2 || U(xx, yy)) road(xx, yy);
      });
      /* a pavement along every road */
      for (k = 0; k < n; k++) {
        if (dist[k] !== di || tile[k] === T.ROAD) continue;
        x = k % W; y = (k / W) | 0;
        for (oy = -1; oy <= 1; oy++) for (ox = -1; ox <= 1; ox++) if (get(x + ox, y + oy) === T.ROAD) { tile[k] = T.GROUND; free[k] = 0; }
      }
      /* the headland: lawn and trees round noorborj, a wide path up to its door */
      for (y = top; y < T0 - 1; y++) for (x = tipX - 10; x <= tipX + 10; x++) {
        if (!mine(x, y) || !free[at(x, y)]) continue;
        free[at(x, y)] = 0;
        tile[at(x, y)] = Math.abs(x - tipX) <= 1 && y >= top + 5 ? T.GROUND : hash(x * 5, y) < 0.12 && Math.abs(x - tipX) > 2 ? T.TREE : T.GRASS;
      }
      /* the plaza: the block north-west of the crossroads, paved, trees down
         both sides and a stall under each; the arcade on it facing south,
         the walk-up behind */
      var px0 = vw + LANE + 1, px1 = ax - 2, py0 = hn + LANE + 1, py1 = ay - 2;
      if (px1 - px0 >= 7 && py1 - py0 >= 8) {
        for (y = py0; y <= py1; y++) for (x = px0; x <= px1; x++) if (mine(x, y)) { free[at(x, y)] = 0; tile[at(x, y)] = T.GROUND; }
        var arcX = ((px0 + px1) >> 1) - 1, arcY = py1 - 5;
        for (y = py1; y >= arcY; y -= 2) { set(px0, y, T.TREE); set(px1, y, T.TREE); }
        if (px1 - px0 >= 10) { set(px0 + 2, py1 - 2, T.STALL); set(px1 - 2, py1 - 2, T.STALL); }
        RSPOT.arcade = [arcX - d.cx, arcY - d.cy];
        RSPOT.apt = [arcX - 2 - d.cx, arcY - 3 - d.cy];
        /* buildings round the back of the plaza, if there's room */
        for (y = py0; y <= arcY - 5; y++) for (x = px0; x <= px1; x++) if ((x - px0) % 5 !== 4) set(x, y, T.BUILDING);
      }
      /* the rest is lots: each open patch cut in two again and again, an
         alley down every cut, until the pieces are house-sized */
      var lots = [];
      var rectP = true;
      function split(r, depth, park) {
        var w = r[2] - r[0] + 1, h = r[3] - r[1] + 1;
        if (w < 3 || h < 2) { alley(r); return; }
        if (w <= 7 && h <= 6) { lots.push({ r: r, park: park }); return; }
        var vert = w > h * 1.2 ? true : h > w * 1.2 ? false : rnd() < 0.5;
        if (vert && w < 8) vert = false; else if (!vert && h < 7) vert = true;
        var span = vert ? w : h, cut = Math.max(3, Math.min(span - 4, Math.floor(span * (0.35 + rnd() * 0.3))));
        /* one big piece of the biggest block is a park */
        var pk = depth === 0 && rectP && w * h === parkArea ? (rnd() < 0.5 ? 1 : 2) : 0;
        var a = vert ? [r[0], r[1], r[0] + cut - 1, r[3]] : [r[0], r[1], r[2], r[1] + cut - 1];
        var b = vert ? [r[0] + cut + 1, r[1], r[2], r[3]] : [r[0], r[1] + cut + 1, r[2], r[3]];
        alley(vert ? [r[0] + cut, r[1], r[0] + cut, r[3]] : [r[0], r[1] + cut, r[2], r[1] + cut]);
        if (pk === 1) parkIn(a); else split(a, depth + 1, park);
        if (pk === 2) parkIn(b); else split(b, depth + 1, park);
      }
      function each(r, fn) { for (var yy = r[1]; yy <= r[3]; yy++) for (var xx = r[0]; xx <= r[2]; xx++) if (mine(xx, yy) && free[at(xx, yy)]) fn(xx, yy); }
      function alley(r) { if (rectP) each(r, function (xx, yy) { tile[at(xx, yy)] = T.GROUND; free[at(xx, yy)] = 0; }); }
      function parkIn(r) {
        var mx = (r[0] + r[2]) >> 1, my = (r[1] + r[3]) >> 1;
        each(r, function (xx, yy) {
          free[at(xx, yy)] = 0;
          tile[at(xx, yy)] = Math.abs(xx - mx) <= 0 || Math.abs(yy - my) <= 0 ? T.GROUND
            : (xx - r[0]) % 3 === 1 && (yy - r[1]) % 3 === 1 && hash(xx, yy * 3) < 0.7 ? T.TREE : T.GRASS;
        });
      }
      /* each open patch: its bounding box, cut up; a lot that strays off
         the patch is trimmed back onto it */
      var seenP = new Uint8Array(n), patches = [], parkArea = 0;
      for (k = 0; k < n; k++) {
        if (!free[k] || seenP[k]) continue;
        var st = [k], bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1; seenP[k] = 1;
        while (st.length) {
          var cc = st.pop(), xx = cc % W, yy = (cc / W) | 0;
          bx0 = Math.min(bx0, xx); bx1 = Math.max(bx1, xx); by0 = Math.min(by0, yy); by1 = Math.max(by1, yy);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var nk = at(xx + o[0], yy + o[1]); if (inside(xx + o[0], yy + o[1]) && free[nk] && !seenP[nk]) { seenP[nk] = 1; st.push(nk); } });
        }
        /* a patch that isn't a plain block (the shore side of the ring) gets
           no alleys: the gaps between its lots stay green */
        var area = 0; for (var ay2 = by0; ay2 <= by1; ay2++) for (var ax2 = bx0; ax2 <= bx1; ax2++) if (seenP[at(ax2, ay2)] && free[at(ax2, ay2)]) area++;
        patches.push({ r: [bx0, by0, bx1, by1], rect: area === (bx1 - bx0 + 1) * (by1 - by0 + 1) });
      }
      patches.forEach(function (pt) { var a2 = (pt.r[2] - pt.r[0] + 1) * (pt.r[3] - pt.r[1] + 1); if (pt.rect && a2 > parkArea) parkArea = a2; });
      patches.forEach(function (pt) { rectP = pt.rect; split(pt.r, 0, false); });
      function bad(r) { var nb = 0; for (var yy = r[1]; yy <= r[3]; yy++) for (var xx = r[0]; xx <= r[2]; xx++) if (!mine(xx, yy) || !free[at(xx, yy)]) nb++; return nb; }
      function edgeBad(r, side) {
        var e2 = side === 0 ? [r[0], r[1], r[2], r[1]] : side === 1 ? [r[2], r[1], r[2], r[3]] : side === 2 ? [r[0], r[3], r[2], r[3]] : [r[0], r[1], r[0], r[3]];
        return bad(e2);
      }
      lots.forEach(function (lot) {
        var r = lot.r.slice();
        while (bad(r) && r[2] - r[0] >= 2 && r[3] - r[1] >= 1) {
          var worst = [0, 1, 2, 3].sort(function (p, q2) { return edgeBad(r, q2) - edgeBad(r, p); })[0];
          if (worst === 0) r[1]++; else if (worst === 1) r[2]--; else if (worst === 2) r[3]--; else r[0]++;
        }
        var w = r[2] - r[0] + 1, h = r[3] - r[1] + 1, roll = rnd();
        if (bad(r) || w < 3 || h < 2) return;
        if (roll < 0.7) {
          /* a building: sometimes a step of pavement out front, a yard to one side */
          var b = r.slice();
          if (h >= 4 && rnd() < 0.5) { each([b[0], b[3], b[2], b[3]], function (xx, yy) { tile[at(xx, yy)] = T.GROUND; free[at(xx, yy)] = 0; }); b[3]--; }
          if (w >= 5 && rnd() < 0.35) {
            var yardX = rnd() < 0.5 ? b[0] : b[2];
            each([yardX, b[1], yardX, b[3]], function (xx, yy) { tile[at(xx, yy)] = T.GRASS; free[at(xx, yy)] = 0; });
            if (yardX === b[0]) b[0]++; else b[2]--;
          }
          each(b, function (xx, yy) { tile[at(xx, yy)] = T.BUILDING; free[at(xx, yy)] = 0; });
        } else if (roll < 0.84) {
          /* a yard, a tree in it */
          var tx = r[0] + 1 + Math.floor(rnd() * Math.max(1, w - 2)), ty = r[1] + Math.floor(rnd() * h);
          each(r, function (xx, yy) { tile[at(xx, yy)] = xx === tx && yy === ty ? T.TREE : T.GRASS; free[at(xx, yy)] = 0; });
        } else if (roll < 0.94) {
          /* a paved lot */
          each(r, function (xx, yy) { tile[at(xx, yy)] = T.GROUND; free[at(xx, yy)] = 0; });
        } else {
          /* a garden: trees at its corners */
          each(r, function (xx, yy) { var cn = (xx === r[0] || xx === r[2]) && (yy === r[1] || yy === r[3]); tile[at(xx, yy)] = cn ? T.TREE : T.GRASS; free[at(xx, yy)] = 0; });
        }
      });
      /* whatever's left: verge inside the ring is pavement, outside it grass */
      for (k = 0; k < n; k++) if (free[k]) {
        x = k % W; y = (k / W) | 0;
        tile[k] = !U(x, y) ? (hash(x, y * 7) < 0.06 ? T.TREE : T.GRASS) : T.GROUND;
      }
    }
    /* how the street is paved where a building, path or pocket is joined up:
       pavement (the roads are only the wide ones) */
    function paveOf() { return T.GROUND; }
    var KEEP_ROAD = { 4: 1, 9: 1 };
    /* redrum: a building's spot on a lot near (dx, dy): its footprint all
       building, its door onto pavement, nothing of the road under it */
    function lotFor(d, w, h, dx0, dy0) {
      for (var r = 0; r < 30; r++) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        var x0 = d.cx + Math.round(dx0 * fOf(d)) + ox, y0 = d.cy + Math.round(dy0 * fOf(d)) + oy, ok = true;
        if (get(x0 - 1, y0) === T.BUILDING) continue;
        for (var y = y0 - 1; y <= y0 + h && ok; y++) for (var x = x0 - 1; x <= x0 + w && ok; x++) {
          var t = get(x, y), foot = y >= y0 && y < y0 + h && x >= x0 && x < x0 + w;
          if (dist[at(x, y)] !== d.index || (foot ? t !== T.BUILDING : (t === T.ROAD || t === T.LANDMARK || t === T.BRIDGE || t === T.STALL))) ok = false;
        }
        var dx = x0 + (w >> 1);
        if (!ok || get(dx, y0 + h) !== T.GROUND) continue;
        if (npcs.some(function (nn) { return nn.x >= x0 - 2 && nn.x <= x0 + w + 1 && nn.y >= y0 - 2 && nn.y <= y0 + h + 1; })) continue;
        return [x0 - d.cx, y0 - d.cy];
      }
      return null;
    }

    /* a walkable line, x first then y, so it is always 4-connected */
    function carve(x0, y0, x1, y1, t, keep) {
      var x = x0, y = y0, sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
      function put() { var c = get(x, y); if (!keep || !keep[c]) set(x, y, t); }
      put();
      while (x !== x1) { x += sx; put(); }
      while (y !== y1) { y += sy; put(); }
    }
    /* the shortest way from (x0, y0) out to a road in its district, through
       as little as can be helped: whatever's built or grown in the way is
       paved. a 0-1 search, landmarks and water never crossed */
    function toStreet(x0, y0) {
      var di = dist[at(x0, y0)], cost = {}, from = {}, dq = [at(x0, y0)], head = 0, k0 = at(x0, y0), end = -1;
      cost[k0] = 0;
      while (head < dq.length) {
        var c = dq[head++];
        if (tile[c] === T.ROAD) { end = c; break; }
        var cx = c % W, cy = (c / W) | 0;
        if (Math.abs(cx - x0) + Math.abs(cy - y0) > 40) continue;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var nx = cx + o[0], ny = cy + o[1], nk = at(nx, ny), t = get(nx, ny);
          if (!inside(nx, ny) || dist[nk] !== di || t === T.LANDMARK || t === T.DEEP || t === T.SHALLOW || t === T.BRIDGE) return;
          var nc = cost[c] + (SOLID[t] ? 1 : 0);
          if (cost[nk] !== undefined && cost[nk] <= nc) return;
          cost[nk] = nc; from[nk] = c;
          /* a deque by hand: cheap steps jump the queue */
          if (SOLID[t]) dq.push(nk); else dq.splice(head, 0, nk);
        });
      }
      if (end < 0) return false;
      for (var p = end; p !== k0; p = from[p]) if (SOLID[tile[p]]) tile[p] = T.GROUND;
      if (SOLID[tile[k0]] && tile[k0] !== T.LANDMARK) tile[k0] = T.GROUND;
      return true;
    }
    var LAND = {}; [T.GROUND, T.ROAD, T.BUILDING, T.TREE, T.GRASS, T.STALL, T.LANDMARK, T.SAND].forEach(function (t) { LAND[t] = 1; });

    /* bridges: from one island's shore to the next, along the line between
       their centres, as a staircase LANE tiles wide */
    var LINKS = [['worldwood', 'yucayeque'], ['worldwood', 'naturia'], ['worldwood', 'haven'], ['worldwood', 'majinryu'],
                 ['haven', 'yucayeque'], ['majinryu', 'naturia']];
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
          /* the lanes, side by side */
          var hx = Math.abs(bx - last[0]) >= Math.abs(by - last[1]);
          for (var ln = -(LANE >> 1) + 1; ln <= LANE >> 1; ln++) {
            var q = hx ? [p[0], p[1] + ln] : [p[0] + ln, p[1]];
            if (!LAND[get(q[0], q[1])] || dist[at(q[0], q[1])] < 0) set(q[0], q[1], T.BRIDGE);
          }
        }
      });
      var along = Math.abs(bx - last[0]) >= Math.abs(by - last[1]);
      landings.push({ d: a, x: last[0], y: last[1], to: b, along: along }, { d: b, x: first[0], y: first[1], to: a, along: along });
    });
    /* each landing gets a road, as wide: across to the grid's nearest road
       line, then inland along it the way the bridge runs, to the first street
       it meets (or its island's centre) */
    landings.forEach(function (l) {
      /* the same lanes as the grid's roads */
      var d = l.d, x = l.x, y = l.y, steps = 0, lo = -(LANE >> 1), hi = LANE - (LANE >> 1) - 1;
      var sx = d.P ? d.cx + Math.round((x - d.cx) / d.P) * d.P : d.cx, sy = d.P ? d.cy + Math.round((y - d.cy) / d.P) * d.P : d.cy;
      function lay(horiz) {
        for (var ln = lo; ln <= hi; ln++) { var qx = horiz ? x : x + ln, qy = horiz ? y + ln : y; if (dist[at(qx, qy)] === d.index) set(qx, qy, T.ROAD); }
      }
      var legs = l.along ? [[0, sy], [1, d.cx], [0, d.cy]] : [[1, sx], [0, d.cy], [1, d.cx]];
      walk: for (var g = 0; g < legs.length; g++) {
        var horiz = legs[g][0] === 1, to = legs[g][1];
        while ((horiz ? x : y) !== to) {
          if (horiz) x += to > x ? 1 : -1; else y += to > y ? 1 : -1;
          if (++steps > LANE && get(x, y) === T.ROAD) break walk;
          lay(horiz);
        }
        /* round the corner, a square of road */
        for (var cy2 = lo; cy2 <= hi; cy2++) for (var cx2 = lo; cx2 <= hi; cx2++) if (dist[at(x + cx2, y + cy2)] === d.index) set(x + cx2, y + cy2, T.ROAD);
      }
    });
    /* a pavement along every city road: nothing built right up to the kerb */
    for (var i = 0; i < W * H; i++) {
      if (dist[i] < 0 || DISTRICTS[dist[i]].style === 'island' || (tile[i] !== T.BUILDING && tile[i] !== T.TREE)) continue;
      var sx1 = i % W, sy1 = (i / W) | 0, kerb = false;
      for (var oy = -1; oy <= 1 && !kerb; oy++) for (var ox = -1; ox <= 1; ox++) if (get(sx1 + ox, sy1 + oy) === T.ROAD) { kerb = true; break; }
      if (kerb) tile[i] = tile[i] === T.TREE ? T.GRASS : T.GROUND;
    }

    /* landmarks: a block the size of the thing, a road to its door */
    function landmark(d, id, name, dx, dy, w, h, text, exact) {
      if (!exact) { dx = Math.round(dx * fOf(d)); dy = Math.round(dy * fOf(d)); }
      var x0 = d.cx + dx, y0 = d.cy + dy, x, y;
      /* in the city, the nearest spot inside a block: never across a road */
      if (d.style !== 'island') {
        var clear = function (x1, y1) {
          for (var yy = y1 - 1; yy <= y1 + h; yy++) for (var xx = x1 - 1; xx <= x1 + w; xx++) {
            var t = get(xx, yy);
            if (dist[at(xx, yy)] !== d.index || t === T.ROAD || t === T.BRIDGE || t === T.LANDMARK || t === T.STALL) return false;
          }
          return true;
        };
        search: for (var r = 0; r < 12; r++) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) === r && clear(x0 + ox, y0 + oy)) { x0 += ox; y0 += oy; break search; }
        }
      }
      for (y = y0 - 1; y <= y0 + h; y++) for (x = x0 - 1; x <= x0 + w; x++) {
        if (dist[at(x, y)] !== d.index) continue;
        set(x, y, (y >= y0 && y < y0 + h && x >= x0 && x < x0 + w) ? T.LANDMARK : paveOf(d));
      }
      var door = { x: x0 + (w >> 1), y: y0 + h };
      /* redrum's buildings stand on lots that open onto the pavement already */
      if (d.style !== 'island' && !toStreet(door.x, door.y)) carve(door.x, door.y, d.cx, d.cy, T.GROUND, KEEP_ROAD);
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
    var arcadeDoor = landmark(R0, 'arcade', 'arcade', RSPOT.arcade ? RSPOT.arcade[0] : -3, RSPOT.arcade ? RSPOT.arcade[1] : -1, 4, 2, 'ARCADE\nthe sign is a knife. the high score is "HEX".', !!RSPOT.arcade); walkIn('arcade');

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
      var lot = sp.d.style === 'island' && lotFor(sp.d, 3, 2, sp.dx, sp.dy);
      var door = landmark(sp.d, sp.art, info ? info.name : sp.id, lot ? lot[0] : sp.dx, lot ? lot[1] : sp.dy, 3, 2,
        (info ? info.name : sp.id.toUpperCase()) + '\n' + (kind ? kind.what : 'open') + '. talk to the one out front.', !!lot);
      marks[marks.length - 1].shop = sp.id;
      shopKeepers.push({ id: 'shop-' + sp.id, x: door.x + 1, y: door.y, dir: 'down', look: sp.art === 'threads' ? 'tailor' : sp.art, shop: sp.id, still: true });
    });

    /* apartments: one block per district, its door for sale (shops.js
       HOMES). redrum's is the walk-up behind hex's arcade */
    var HOME_AT = [{ d: R0, dx: -3, dy: -4 }, { d: W0, dx: -5, dy: -2 }, { d: Y0, dx: 7, dy: 2 },
                   { d: N0, dx: -6, dy: 3 }, { d: H0, dx: -6, dy: 1 }, { d: M0, dx: -6, dy: 2 }];
    HOME_AT.forEach(function (h) {
      var info = root.MFShops && root.MFShops.HOMES[h.d.id];
      var exact = h.d === R0 && !!RSPOT.apt;
      landmark(h.d, 'apt', info ? info.name : 'apartments', exact ? RSPOT.apt[0] : h.dx, exact ? RSPOT.apt[1] : h.dy, 3, 2,
        (info ? info.name.toUpperCase() + '\n' + info.sign : 'APARTMENTS') + '\nthe door is for sale. face it and press A.', exact);
      marks[marks.length - 1].home = h.d.id;
    });

    /* stores (shops.js STORES): a front on clear ground near a corner of the
       district, the keeper at the door. the spot is searched for, so the
       store never lands on another building */
    function clearSpot(d, w, h, dx0, dy0) {
      if (d.style === 'island') return lotFor(d, w, h, dx0, dy0);
      for (var r = 0; r < 14; r++) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        var x0 = d.cx + Math.round(dx0 * fOf(d)) + ox, y0 = d.cy + Math.round(dy0 * fOf(d)) + oy, ok = true;
        for (var y = y0 - 2; y <= y0 + h + 1 && ok; y++) for (var x = x0 - 2; x <= x0 + w + 1 && ok; x++) {
          var t = get(x, y);
          var near = y >= y0 - 1 && y <= y0 + h && x >= x0 - 1 && x <= x0 + w;
          if (dist[at(x, y)] !== d.index || t === T.LANDMARK || t === T.BRIDGE || t === T.STALL || t === T.SAND || (near && t === T.ROAD)) ok = false;
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

    /* redrum's small-stakes gambling (casino.js HOUSES dive / street / arcade):
       a back room behind an unmarked door, a dice hustler and a numbers runner
       working the street. PLACEHOLDER lines */
    var backAt = clearSpot(R0, 3, 2, -3, 2);
    if (backAt) {
      landmark(R0, 'backroom', 'the back room', backAt[0], backAt[1], 3, 2,
        'NO SIGN\njust a door, and a light under it.\nsomebody inside is laughing at somebody else\'s luck.', true);
      walkIn('backroom');
    }
    /* the lockup: where hex's hashshashin hold anyone who makes trouble on
       redrum (law.js JAILS). PLACEHOLDER words */
    var lockAt = clearSpot(R0, 3, 2, 5, 4);
    if (lockAt) {
      landmark(R0, 'lockup', 'the lockup', lockAt[0], lockAt[1], 3, 2,
        'a steel door, no handle on this side.\nsomeone painted a crescent on it. small.', true);
      walkIn('lockup');
    }
    /* someone on the street, on the nearest free tile to a spot in the district */
    function standIn(d, dx, dy) {
      for (var rr = 0; rr < 10; rr++) for (var oy = -rr; oy <= rr; oy++) for (var ox = -rr; ox <= rr; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== rr) continue;
        var x = d.cx + Math.round(dx * fOf(d)) + ox, y = d.cy + Math.round(dy * fOf(d)) + oy, t = get(x, y);
        if (dist[at(x, y)] !== d.index || (t !== T.ROAD && t !== T.GROUND)) continue;
        if (npcs.some(function (n) { return Math.abs(n.x - x) + Math.abs(n.y - y) < 2; })) continue;
        if (marks.some(function (m) { return x >= m.x && x < m.x + m.w && y === m.y + m.h; })) continue;
        return [x, y];
      }
      return null;
    }
    /* redrum's street doc: the only healing on the island (shops.js VENDORS) */
    var docAt = standIn(R0, 1, -3), doc = root.MFShops && root.MFShops.VENDORS['street-doc'];
    if (docAt) npcs.push({ id: 'street-doc', x: docAt[0], y: docAt[1], dir: 'down', look: 'medic', name: doc ? doc.name : 'STREET DOC', vend: 'street-doc', still: true });
    /* food carts: one per district, on the street (shops.js VENDORS) */
    [['patty-cart', Y0, 2, 5], ['noodle-cart', W0, -2, 4], ['dumpling-cart', M0, 3, -2], ['juice-stand', N0, 4, 1], ['tea-stall', H0, 2, -3], ['skewer-guy', R0, -1, 2]].forEach(function (c) {
      var at2 = standIn(c[1], c[2], c[3]), v = root.MFShops && root.MFShops.VENDORS[c[0]];
      if (at2) npcs.push({ id: c[0], x: at2[0], y: at2[1], dir: 'down', look: c[0] === 'juice-stand' ? 'ape' : 'cook', name: v ? v.name : c[0], vend: c[0], still: true });
    });
    /* restaurants: a front somewhere clear, a room behind it */
    var nbAt = clearSpot(W0, 3, 2, 3, -4);
    if (nbAt) { landmark(W0, 'noodlebar', 'no sign', nbAt[0], nbAt[1], 3, 2, '...\nthere is no sign. that is the sign.', true); walkIn('noodlebar'); }
    var thAt = clearSpot(M0, 3, 2, -3, 5);
    if (thAt) { landmark(M0, 'teahouse', 'the tea house', thAt[0], thAt[1], 3, 2, 'THE TEA HOUSE\nask for the house blend.\ndon\'t ask what\'s in it.', true); walkIn('teahouse'); }
    /* haven's fountain: filtered three times. you could drink it */
    var ftAt = clearSpot(H0, 2, 2, 0, 1);
    if (ftAt) { landmark(H0, 'fountain', 'fountain', ftAt[0], ftAt[1], 2, 2, 'A HAVEN FOUNTAIN\nfiltered three times. please do not drink from the fountain.', true); marks[marks.length - 1].fountain = 1; }
    var hustle = standIn(R0, 2, 4), runner = standIn(R0, -3, -2);
    if (hustle) npcs.push({ id: 'hustler', x: hustle[0], y: hustle[1], dir: 'down', look: 'merc', name: 'DICE', game: 'dice', house: 'street', still: true });
    if (runner) npcs.push({ id: 'numbers', x: runner[0], y: runner[1], dir: 'down', look: 'gen', seed: 8801, name: 'NUMBERS', game: 'lotto', house: 'street', still: true });

    /* the boatyard: yucayeque's east shore, a pier out into the bay, the
       shipwright at the door (shops.js BOAT) */
    var by = Y0.cy, bx = Y0.cx;
    while (bx < W - 1 && !(dist[at(bx, by)] === Y0.index && (get(bx + 1, by) === T.SHALLOW || get(bx + 1, by) === T.DEEP))) bx++;
    var yardDoor = landmark(Y0, 'boatyard', 'the boatyard', bx - 8 - Y0.cx, by - 3 - Y0.cy, 4, 2,
      'THE BOATYARD\nboats built to order. bring the wood.', true);
    /* it may have stepped off a road: the shore again, along its door's row */
    bx = yardDoor.x;
    while (bx < W - 1 && !(dist[at(bx, yardDoor.y)] === Y0.index && (get(bx + 1, yardDoor.y) === T.SHALLOW || get(bx + 1, yardDoor.y) === T.DEEP))) bx++;
    carve(yardDoor.x, yardDoor.y, bx, yardDoor.y, T.GROUND, KEEP_ROAD);
    for (var px = bx + 1; px <= bx + 6; px++) set(px, yardDoor.y, T.BRIDGE);
    npcs.push({ id: 'shipwright', x: yardDoor.x + 1, y: yardDoor.y, dir: 'down', look: 'shipwright', wright: 'yard', still: true });
    var pierEnd = { x: bx + 6, y: yardDoor.y };

    /* the slip: redrum's east shore, facing the city across the strait. a
       scrapper there knocks skiffs together out of scrap (shops.js BOATS.slip),
       or sells you one outright. PLACEHOLDER lines */
    var sx0 = R0.cx, sy0 = R0.cy;
    while (dist[at(sx0 + 1, sy0)] === R0.index) sx0++;
    carve(sx0, sy0, R0.cx, R0.cy, paveOf(R0), KEEP_ROAD);
    for (var px2 = sx0 + 1; px2 <= sx0 + 4; px2++) { set(px2, sy0, T.BRIDGE); set(px2, sy0 + 1, T.BRIDGE); }
    npcs.push({ id: 'scrapper', x: sx0 + 1, y: sy0 + 1, dir: 'up', look: 'merc', name: 'SCRAPPER', wright: 'slip', still: true });
    if (get(sx0, sy0 - 1) !== T.LANDMARK) { set(sx0, sy0 - 1, paveOf(R0)); signs.push({ x: sx0, y: sy0 - 1, text: 'THE SLIP\nskiffs out of scrap. no refunds.\nthe city is east, past the strait. you\'ll need a boat.' }); }
    var slipEnd = { x: sx0 + 4, y: sy0 };

    /* the landings round the coast, named for vistadelsol's towns on the
       terranova map. a pier, a beach, a grove, someone who lives there. the
       towns themselves aren't open yet. PLACEHOLDER lines */
    var landings2 = [];
    LANDINGS.forEach(function (l) {
      /* from out in the water, head for land until there is some */
      /* the town's shore: the nearest beach to it on the map, approached from the water */
      var bt = toTile(GEO.burgs[l.id]), shore = null;
      for (var rr = 0; rr < 300 && !shore; rr++) for (var oy = -rr; oy <= rr && !shore; oy++) for (var ox = -rr; ox <= rr; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== rr) continue;
        var lx = bt[0] + ox, ly = bt[1] + oy;
        if (!inside(lx, ly) || dist[at(lx, ly)] !== -2 || (get(lx, ly) !== T.SAND && get(lx, ly) !== T.MAINLAND)) continue;
        /* water on one side, and solid land straight inland for the cove */
        var wd = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (o) {
          var t2 = get(lx + o[0], ly + o[1]);
          if (t2 !== T.SHALLOW && t2 !== T.DEEP) return false;
          for (var kk = 1; kk <= 14; kk++) { var t3 = get(lx - o[0] * kk, ly - o[1] * kk); if (t3 !== T.MAINLAND && t3 !== T.SAND) return false; }
          return true;
        })[0];
        if (wd) { shore = { from: [lx + wd[0], ly + wd[1]], dir: [-wd[0], -wd[1]] }; break; }
      }
      if (!shore) return;
      l.from = shore.from; l.dir = shore.dir;
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
      var sx = Y0.cx + Math.round((-6 + (s % 4) * 4) * fOf(Y0)), sy = Y0.cy + Math.round((2 + Math.floor(s / 4) * 3) * fOf(Y0));
      if (dist[at(sx, sy)] === Y0.index && get(sx, sy) !== T.LANDMARK && get(sx, sy) !== T.ROAD) { set(sx, sy, T.STALL); if (get(sx, sy + 1) !== T.ROAD) set(sx, sy + 1, T.GROUND); }
    }

    /* fires to cook on, near the shore (shops.js FIRES): drum barrels in
       redrum, campfires in naturia and at the landings, electric grills
       everywhere else. always on open ground, never in a narrow way */
    function fireAt(ok, kind, seed) {
      var cands = [];
      for (var y = 2; y < H - 2; y++) for (var x = 2; x < W - 2; x++) {
        var t = get(x, y);
        if (!ok(x, y) || (t !== T.GROUND && t !== T.GRASS && t !== T.SAND)) continue;
        var open = true, wet = false;
        for (var oy = -1; oy <= 1 && open; oy++) for (var ox = -1; ox <= 1; ox++) { var nt = get(x + ox, y + oy); if (SOLID[nt] || nt === T.BRIDGE) { open = false; break; } }
        if (!open) continue;
        for (var wy = -4; wy <= 4 && !wet; wy++) for (var wx = -4; wx <= 4; wx++) { var wt = get(x + wx, y + wy); if (wt === T.SHALLOW || wt === T.DEEP) { wet = true; break; } }
        if (!wet || npcs.some(function (n) { return Math.abs(n.x - x) + Math.abs(n.y - y) < 3; }) || signs.some(function (sg) { return sg.x === x && sg.y === y; })) continue;
        if (marks.some(function (m) { return x >= m.x - 1 && x <= m.x + m.w && y >= m.y - 1 && y <= m.y + m.h + 1; })) continue;
        cands.push([x, y]);
      }
      if (!cands.length) return null;
      var c = cands[Math.floor(hash(seed, 313) * cands.length)];
      set(c[0], c[1], T.LANDMARK);
      marks.push({ id: kind, name: kind, x: c[0], y: c[1], w: 1, h: 1, d: dist[at(c[0], c[1])], fire: kind });
      return c;
    }
    var inD = function (d) { return function (x, y) { return dist[at(x, y)] === d.index; }; };
    DISTRICTS.forEach(function (d) {
      var kind = d.id === 'redrum' ? 'drumfire' : d.id === 'naturia' ? 'campfire' : 'grill';
      for (var n = 0; n < (kind === 'grill' ? 1 : 2); n++) fireAt(inD(d), kind, d.seed * 7 + n * 101);
    });
    landings2.forEach(function (l, i) {
      fireAt(function (x, y) { return dist[at(x, y)] === -2 && Math.abs(x - l.cx) + Math.abs(y - l.cy) <= 8; }, 'campfire', 900 + i);
    });

    /* who is out tonight */
    var spawn = { x: arcadeDoor.x, y: arcadeDoor.y + 3, dir: 'up' };
    carve(spawn.x, spawn.y, arcadeDoor.x, arcadeDoor.y, paveOf(R0), KEEP_ROAD);
    npcs.push({ id: 'hex', x: arcadeDoor.x, y: arcadeDoor.y, dir: 'down', look: 'hex', scene: 'hex', still: true });
    shopKeepers.forEach(function (k) { npcs.push(k); });
    function person(d, dx, dy, look, lines) {
      var x = d.cx + Math.round(dx * fOf(d)), y = d.cy + Math.round(dy * fOf(d));
      if (d.style === 'island' ? SOLID[get(x, y)] : !toStreet(x, y)) carve(x, y, d.cx, d.cy, paveOf(d), KEEP_ROAD);
      npcs.push({ id: d.id + npcs.length, x: x, y: y, dir: 'down', look: look, lines: lines, roam: 3 });
    }
    person(W0, 2, 6, 'reveler', ['the replica tower? they tuned it to a song.\nnobody agrees which one.', 'worldwood never sleeps. i tried once.']);
    person(W0, -4, 3, 'reveler', ['the sapphire opens late. if it opens.']);
    person(Y0, 0, 6, 'local', ['you hungry? the patties two stalls down.\ntell them i sent you. they will charge you more.']);
    person(Y0, 5, -6, 'local', ['the music starts when the sun goes.\nit stops when the sun comes back. mostly.']);
    person(N0, 3, 4, 'ape', ['...', 'the plants glow because they are happy.\nbe quiet and they glow more.']);
    /* koga: naturia's council representative, by the great tree (vault: Koga) */
    carve(treeDoor.x + 3, treeDoor.y + 1, treeDoor.x, treeDoor.y, T.GROUND, KEEP_ROAD);
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
      if (d0.style === 'island' || !toStreet(p % W, (p / W) | 0)) carve(p % W, (p / W) | 0, d0.cx, d0.cy, paveOf(d0), KEEP_ROAD);
      seen = reachFrom(spawn.x, spawn.y);
    }
    function reachFrom(x, y) { return reachAll({ W: W, H: H, tile: tile, spawn: { x: x, y: y }, hub: { x: W0.cx, y: W0.cy } }); }
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

    return { W: W, H: H, tile: tile, dist: dist, marks: marks, signs: signs, npcs: npcs, spawn: spawn, hub: { x: W0.cx, y: W0.cy }, landings: landings2, pier: pierEnd, slip: slipEnd };
  }

  /* no islets of our own: the terranova map has none in the bay */
  var ISLETS = [];
  var LANDINGS = [
    { id: 'fort-freyja', name: 'Fort Freyja', look: 'local',
      sign: 'vistadelsol. the fort is up the hill.\nthe gate is shut tonight.', lines: ['the fort? old. older than the city.\nnobody goes up there after dark.', 'mangoes fall on your head here.\nit counts as lunch.'] },
    { id: 'port-tropics', name: 'Port Tropics', look: 'reveler',
      sign: 'vistadelsol. the fair comes through in summer.\nthe town is up the beach. not open yet.', lines: ['the fair\'s gone till summer.\nthe carousel\'s still out there, under a sheet.', 'you sailed here? from the city?\nbrave. or bored.'] },
    { id: 'folkvangr', name: 'Fólkvangr', look: 'local',
      sign: 'vistadelsol. fields, then more fields.\nthe road inland isn\'t open yet.', lines: ['the fields go on further than you\'d think.\nso does the quiet.', 'north of here it all turns to ash, they say.\nashenreach. i\'ve never been.'] },
    { id: 'persepolis', name: 'Persepolis', look: 'clerk',
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
  /* what each kind says once it can tell where you come from (MF.knownOrigin:
     bodies show, accents give you away, a product only when the barcode
     shows). no entry, no remark. 'product-loyal' is for the few who'd know
     which side a product is on (corpocult's own). PLACEHOLDER lines */
  var ORIGIN_TALK = {
    novan: {
      sapien:    ['earth accent. fresh off the crossing?\nit wears off. mostly.', 'you still flinch at the rain here.\nearth rain must be polite.',
                  'sapien, right? straight from earth? welcome.\nthe first year\'s the loud one.'],
      simian:    ['morning. from naturia?\nsorry. not everyone is. i know that.', 'my kid wants to be an ape when she grows up.\ni said that\'s not how it works. is it?'],
      ai:        ['android, right? or someone in one.\nis there a polite way to ask?', 'you need a socket, the hospital\'s got them.\nso i hear. i don\'t need one.'],
      novan:     ['born here? me too.\nyou can always tell.', 'a novan. you walk like you know where the puddles are.'],
      product:   ['that\'s a corpocult stamp on your neck.\n...i didn\'t see anything.', 'cover that up.\nnot everyone round here is as nice as me.']
    },
    ape: {
      simian:    ['sibling.\n(a nod. the kind only apes give each other.)', 'one of us. good.\nthe city goes easier with company.',
                  'the chainsmasher would be glad\nto see you walking free.'],
      sapien:    ['earth. we came from there too.\nin crates.', 'you look at me like the zoo taught you to.\nlook again.'],
      ai:        ['you don\'t smell of anything.\nunsettling. it\'s fine.'],
      novan:     ['born here, like my daughter.\nshe thinks earth is a story.'],
      product:   ['a number on your neck.\nwe had those. we took ours off.', 'the vats made you. the cages made us.\nnobody picks where they start.']
    },
    android: {
      ai:        ['another mind on borrowed hardware.\nhello. truly.', 'down from cyberia too?\nor did you wake up somewhere stranger.',
                  'run a diagnostic tonight.\nthe damp gets into everything.'],
      sapien:    ['earth made the first of us.\nit didn\'t mean to make me.'],
      simian:    ['apes and androids. both made by someone\nwho wanted something else.'],
      novan:     ['novans never ask me if i\'m real.\ni appreciate that.'],
      product:   ['your barcode is readable from here.\nso is every scanner\'s.']
    },
    sleeper: {
      product:   ['that stamp. what batch are you?\n...never mind. lovely evening.', 'rejects are meant to be recycled.\nyou look very un-recycled.',
                  'someone will want to know you\'re walking around.\nnot me. obviously.'],
      sapien:    ['from earth? lovely. the paperwork must have been a nightmare.\ndid you keep copies?'],
      ai:        ['what firmware are you on?\nno reason.'],
      simian:    ['interesting specimen. sorry. person.\ninteresting person.'],
      novan:     ['a local. wonderful.\nyou\'d know everyone, then.'],
      /* one of their own, still on the books */
      'product-loyal': ['evening, colleague.\nthe office says hello. so do i.', 'cover the stamp, colleague.\nwe know you. they don\'t need to.',
                        'quarterly targets are up.\nkeep doing whatever it is you do.']
    },
    tweaker: {
      product:   ['YOU\'RE FROM THE VATS. i know the smell.\nthey grow you in the rain.'],
      ai:        ['are you recording? you\'re recording.\nstop recording.']
    },
    hashshashin: {
      product:   ['you walk like someone trained you to.\nwho trained you?'],
      simian:    ['the mountain clans respect strength.\nyou carry yours well.'],
      ai:        ['no heartbeat.\nan assassin\'s dream.']
    }
  };
  /* what koga makes of you, the first time he can tell. PLACEHOLDER */
  var KOGA_ORIGIN = {
    simian:  'Ah. One of our own. Welcome home, sibling.\nThe moss already likes you. I can tell.',
    product: 'That mark on your neck. I know whose it is.\nIn Naturia, nobody is what they were stamped as.'
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
    { id: 'counter', x: 7, y: 1, w: 2, h: 1, kitchen: true, text: 'a kettle, two mugs.\none of them is clean.' },
    { id: 'plant', x: 8, y: 3, w: 1, h: 1, text: 'a plant. it\'s alive.\nyou\'ll try.' },
    { id: 'sofa', x: 2, y: 4, w: 3, h: 1, text: 'the sofa remembers whoever had it before.\nit\'s getting used to you.' },
    { id: 'tv', x: 6, y: 4, w: 1, h: 1, text: 'static on every channel.\nyou leave it on anyway. it\'s company.' },
    { id: 'chest', x: 1, y: 6, w: 1, h: 1, chest: true, text: 'an old trunk.' }
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
        { id: 'prize', x: 9, y: 5, w: 3, h: 1, text: 'the prize counter. tokens for a keychain,\nor ten thousand for the big plush.\nnobody has ten thousand.' },
        { id: 'slot', x: 12, y: 1, w: 1, h: 1, game: 'slots', house: 'arcade', text: 'a slot machine wedged between the cabinets.\nnobody remembers it arriving.' }],
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
        { id: 'bars', x: 1, y: 3, w: 4, h: 1, cell: true, text: 'a holding cell. empty. spotless.\nthe cleanest cell in teknoa.' },
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
        { id: 'desk', x: 5, y: 2, w: 4, h: 1, vend: 'clinic', text: 'reception. take a number.\nthe screen says NOW SERVING: 0.' },
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
    /* restaurants: a counter that serves (vend), a cook, people eating */
    noodlebar: { d: 'worldwood', map: [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '####==####'],
      things: [
        { id: 'counter', x: 2, y: 1, w: 3, h: 1, vend: 'noodle-bar', text: 'the counter. steam, and a menu written on the wall in marker.' },
        { id: 'bench', x: 1, y: 4, w: 3, h: 1, text: 'a bench. everyone sits too close. nobody minds.' },
        { id: 'bench', x: 6, y: 4, w: 3, h: 1, text: 'someone carved a bowl into the wood.\nand a face. the face is eating.' }],
      people: [
        { x: 6, y: 1, look: 'cook', name: 'COOK', still: true, lines: ['the broth? been going since the crossing.\nso they tell me. i got here tuesday.', 'sit anywhere. the counter, if you\'re hungry.'] },
        { x: 2, y: 3, look: 'gen', seed: 9901, lines: ['best noodles in worldwood.\ndon\'t tell anyone. there\'s already a queue.'] }] },
    teahouse: { d: 'majinryu', map: [
      '#########',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '####=####'],
      things: [
        { id: 'counter', x: 2, y: 1, w: 3, h: 1, vend: 'tea-house', text: 'the tea counter. a hundred jars. none labelled.' },
        { id: 'lantern', x: 7, y: 1, w: 1, h: 1, text: 'a paper lantern. it smells like tea.' },
        { id: 'bench', x: 1, y: 4, w: 2, h: 1, text: 'low cushions. very soft. dangerously soft.' }],
      people: [
        { x: 5, y: 1, look: 'local', name: 'TEA MASTER', still: true, lines: ['the house blend steadies the hands.\nwhat\'s in it is between me and the leaves.', 'interns from the labs drink it before exams.\nthey never say which exams.'] },
        { x: 5, y: 4, look: 'android', lines: ['i cannot taste the tea.\ni come for the steam.'] }] },
    /* the lockup: hex's hashshashin keep redrum's peace here. PLACEHOLDER lines */
    lockup: { d: 'redrum', map: [
      '############',
      '#...#......#',
      '#...#......#',
      '#...#......#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#####==#####'],
      things: [
        { id: 'bars', x: 1, y: 3, w: 3, h: 1, cell: true, text: 'a cage of welded rebar.\nit\'s held better men than you. it says so, scratched in.' },
        { id: 'desk', x: 7, y: 1, w: 3, h: 1, text: 'a desk made of a door.\na ledger, a knife holding it open.' },
        { id: 'bench', x: 8, y: 5, w: 3, h: 1, text: 'a bench. the hashshashin don\'t sit on it.\nthey don\'t sit.' }],
      people: [
        { x: 8, y: 3, look: 'merc', name: 'HASHSHASHIN', still: true, lines: ['the captain\'s gone. she keeps the peace now.\nwe keep it for her.', 'make trouble on redrum, you sit in the cage.\nthat\'s the whole law.'] }] },
    /* the back room: redrum's own casino. no door, no dress code, small change */
    backroom: { d: 'redrum', house: 'dive', map: [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#####==#####'],
      things: [
        { id: 'dicetable', x: 2, y: 2, w: 3, h: 2, game: 'dice', text: 'high-low dice' },
        { id: 'slot', x: 8, y: 1, w: 1, h: 1, game: 'slots', text: 'a slot machine' },
        { id: 'slot', x: 10, y: 1, w: 1, h: 1, game: 'slots', text: 'a slot machine' },
        { id: 'lottobooth', x: 7, y: 4, w: 3, h: 1, game: 'lotto', text: 'the numbers' }],
      people: [
        { x: 2, y: 5, look: 'merc', lines: ['ten joules says you lose.\ntwenty says you lose faster.', 'house rule: no crying at the table.\ncry outside like a professional.'] },
        { x: 9, y: 6, look: 'gen', seed: 8802, lines: ['i\'m on a streak. a losing one.\nstill counts.', 'the hunter used to sit right there.\nnever played. just watched.'] },
        { x: 5, y: 1, look: 'gen', seed: 8803, lines: ['the lottery here pays in cash and regret.\nmostly regret.'] }] },
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
        { id: 'stall', x: 1, y: 2, w: 2, h: 1, vend: 'market-mangoes', text: 'mangoes, three for a joule.\ntwo if you can carry a tune.' },
        { id: 'stall', x: 5, y: 2, w: 2, h: 1, text: 'a crate of records with no labels.\nthe seller says that\'s how you know they\'re good.' },
        { id: 'stall', x: 9, y: 2, w: 2, h: 1, text: 'spices in jars. one jar just says "abuela".\nnot for sale.' },
        { id: 'stall', x: 1, y: 5, w: 2, h: 1, vend: 'market-patties', text: 'patties. the good ones.\nthey charge more if you say who sent you.' },
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
      marks.push({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h, d: did, bed: !!(f.bed && !ROOMS.hasOwnProperty(id)), kitchen: !!(f.kitchen && !ROOMS.hasOwnProperty(id)), chest: !!(f.chest && !ROOMS.hasOwnProperty(id)), text: f.view ? (info ? info.view : 'the city.') : f.text,
                   game: f.game, house: f.game ? f.house || def.house : undefined, vend: f.vend, cell: !!f.cell });
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
  /* on foot from redrum, or from the city once you've crossed: every tile
     you could ever walk to without a boat out to vistadelsol */
  function reachAll(world) {
    var a = reach(world, world.spawn.x, world.spawn.y);
    if (!world.hub) return a;
    var b = reach(world, world.hub.x, world.hub.y);
    for (var k = 0; k < a.length; k++) a[k] = a[k] | b[k];
    return a;
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
    { kind: 'scrap', where: ['redrum'], per: 6 },
    { kind: 'scrap', where: ['majinryu'], per: 3 },
    { kind: 'fruit', where: ['vistadelsol'], per: 10 }
  ];
  function nodes(world, day) {
    if (!world.nodeOpen) {
      var r = reachAll(world), busy = {};
      world.signs.concat(world.npcs).forEach(function (o) { busy[o.y * world.W + o.x] = 1; });
      world.nodeOpen = {};
      NODE_KINDS.forEach(function (nk, j) {
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
        world.nodeOpen[j] = cells;
      });
    }
    var seed = 0, i, out = [];
    for (i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) | 0;
    NODE_KINDS.forEach(function (nk, j) {
      var cells = world.nodeOpen[j];
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
      var r = reachAll(world), busy = {};
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

  root.MFWorldMap = { V: VERSION, CROWD: CROWD, TALK: TALK, KIND_TALK: KIND_TALK, HANDLES: HANDLES, KOGA: KOGA, ORIGIN_TALK: ORIGIN_TALK, KOGA_ORIGIN: KOGA_ORIGIN, W: W, H: H, T: T, DISTRICTS: DISTRICTS, ISLETS: ISLETS, LANDINGS: LANDINGS, build: build, room: room, ROOMS: ROOMS, solid: solid, nodes: nodes, water: water, fishZone: fishZone, reach: reach, reachAll: reachAll, loose: loose };
})(typeof window !== 'undefined' ? window : globalThis);
