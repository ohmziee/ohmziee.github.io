/* Teknoa 2D: art from PNG sheets (the 32px revamp).

   The game still thinks in 16-unit tiles (TS in overworld.js): positions,
   collisions and saves never change. The screen canvas is ART times finer,
   so a sheet drawn at its own size lands one sheet pixel per canvas pixel:
   32px art on a 16-unit tile.

   SHEETS: one PNG each under art/sheets/, painted by art/make_sheets.mjs (or
   by hand in Aseprite; keep the same cells). Each entry is a piece of it:
     x, y, w, h   where it sits in the sheet, in sheet pixels
     ox, oy       where it hangs from its tile's top-left, in sheet pixels
                  (a drum's flames reach up past its tile: oy goes negative)
   Anything without a sheet entry, or before the sheet has loaded, keeps
   drawing its old 16px art, so the revamp can land a piece at a time. */
(function (root) {
  'use strict';
  var ART = 2;
  var SHEETS = {
    props: { src: 'art/sheets/props.png', parts: {
      'mark:drumfire': { x: 0, y: 0, w: 32, h: 48, ox: 0, oy: -16 }
    } }
  };
  var imgs = {}, ready = {};
  function load(base) {
    if (typeof Image === 'undefined') return;
    Object.keys(SHEETS).forEach(function (k) {
      if (imgs[k]) return;
      var im = new Image();
      im.onload = function () { ready[k] = true; };
      im.src = (base || '') + SHEETS[k].src;
      imgs[k] = im;
    });
  }
  /* the sheet and cell for a key, once its sheet has loaded */
  function part(key) {
    for (var k in SHEETS) { var p = SHEETS[k].parts[key]; if (p) return ready[k] ? { img: imgs[k], p: p } : null; }
    return null;
  }
  function has(key) { return !!part(key); }
  /* draw a part hung from a tile corner at (x, y) in game units */
  function draw(ctx, key, x, y) {
    var a = part(key);
    if (!a) return false;
    var p = a.p;
    ctx.drawImage(a.img, p.x, p.y, p.w, p.h, x + p.ox / ART, y + p.oy / ART, p.w / ART, p.h / ART);
    return true;
  }
  root.MFArt = { ART: ART, SHEETS: SHEETS, load: load, part: part, has: has, draw: draw };
  /* in a page, the sheets start loading straight away (beside index.html) */
  if (typeof document !== 'undefined') load();
})(typeof window !== 'undefined' ? window : globalThis);
