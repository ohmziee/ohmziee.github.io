/* EXiLED — one backup for everything this browser has earned: the TEKNOA 2D
   run, the wiki keys from the terminal, the vault key, the doors that are
   open, the chat name. Used by the main page's terminal (backup / restore)
   and by TEKNOA 2D's SYS panel. No DOM in here except download(); the
   tests run it under node.

   A code is EXB1.<base64 json>.<checksum>. The checksum catches a bad
   paste, not a forger, and does not need to: on restore every wiki key is
   tried on the seal it claims to open (wiki/seal.js) and dropped if it does
   not, so a made-up code opens nothing. Never in a backup: the chat owner
   key, and the per-browser chat id (whoever holds a code could otherwise
   speak under your name). */
(function (root) {
  var KEEP = ['exiled.mf.save', 'exiled.keys', 'exiled.vault', 'exiled.wiki', 'exiled.mindscape',
              'exiled.readFile', 'exiled.handle', 'exiled.handleCol'];
  var PREFIX = 'EXB1.';

  function sum(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function b64e(t) { return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, 'utf8').toString('base64'); }
  function b64d(t) { return typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8'); }

  /* what this browser holds, as a code */
  function pack(store) {
    var data = {};
    KEEP.forEach(function (k) { try { var v = store.getItem(k); if (v !== null && v !== '') data[k] = v; } catch (e) {} });
    var j = JSON.stringify({ v: 1, at: Date.now(), data: data });
    return PREFIX + b64e(j) + '.' + sum(j);
  }

  /* a code back into its parts, or an Error saying what is wrong with it */
  function unpack(code) {
    var m = /^EXB1\.([A-Za-z0-9+/=]+)\.([0-9a-f]{8})$/.exec(String(code || '').replace(/\s+/g, ''));
    if (!m) throw new Error('that is not a backup code');
    var j;
    try { j = b64d(m[1]); } catch (e) { throw new Error('that code is damaged'); }
    if (sum(j) !== m[2]) throw new Error('that code is damaged');
    var o = JSON.parse(j);
    if (!o || o.v !== 1 || !o.data || typeof o.data !== 'object') throw new Error('that code is from something else');
    var out = {};
    KEEP.forEach(function (k) { if (typeof o.data[k] === 'string') out[k] = o.data[k]; });
    return { at: o.at, data: out };
  }

  /* does this raw key (base64) open the seal it claims to? */
  function opens(seal, name, b64key, subtle) {
    var c = seal && (name === 'vault' ? { check: seal.check } : seal.keys && seal.keys[name]);
    if (!c || !c.check || !subtle) return Promise.resolve(false);
    function bytes(s) { return Uint8Array.from(atob(s), function (ch) { return ch.charCodeAt(0); }); }
    try {
      return subtle.importKey('raw', bytes(b64key), 'AES-GCM', false, ['decrypt'])
        .then(function (key) { return subtle.decrypt({ name: 'AES-GCM', iv: bytes(c.check.iv) }, key, bytes(c.check.ct)); })
        .then(function () { return true; }, function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* put a backup into this browser. Keys are added, never taken away; a key
     that does not open its seal is dropped. Doors only ever open. The run
     is replaced by the backed-up one if there is one.
     resolves { keys: [names restored], dropped: [names], run: bool } */
  function restore(code, store, seal, subtle) {
    var b;
    try { b = unpack(code); } catch (e) { return Promise.reject(e); }   /* a bad code is a rejection, never a throw */
    var d = b.data, report = { keys: [], dropped: [], run: false };
    var mine = {};
    try { mine = JSON.parse(store.getItem('exiled.keys') || '{}') || {}; } catch (e) {}
    var theirs = {};
    try { theirs = d['exiled.keys'] ? JSON.parse(d['exiled.keys']) : {}; } catch (e) {}
    var checks = Object.keys(theirs).filter(function (n) { return typeof theirs[n] === 'string'; }).map(function (n) {
      return opens(seal, n, theirs[n], subtle).then(function (ok) {
        if (ok) { mine[n] = theirs[n]; report.keys.push(n); } else report.dropped.push(n);
      });
    });
    if (d['exiled.vault']) checks.push(opens(seal, 'vault', d['exiled.vault'], subtle).then(function (ok) {
      if (ok) { store.setItem('exiled.vault', d['exiled.vault']); report.keys.push('vault'); } else report.dropped.push('vault');
    }));
    return Promise.all(checks).then(function () {
      store.setItem('exiled.keys', JSON.stringify(mine));
      var wiki = Math.max(+(store.getItem('exiled.wiki') || 0) || 0, +(d['exiled.wiki'] || 0) || 0);
      if (wiki) store.setItem('exiled.wiki', String(Math.min(wiki, 2)));
      if (d['exiled.mindscape']) store.setItem('exiled.mindscape', '1');
      if (d['exiled.readFile'] && !store.getItem('exiled.readFile')) store.setItem('exiled.readFile', d['exiled.readFile']);
      ['exiled.handle', 'exiled.handleCol'].forEach(function (k) { if (d[k]) store.setItem(k, d[k]); });
      if (d['exiled.mf.save']) { store.setItem('exiled.mf.save', d['exiled.mf.save']); report.run = true; }
      store.setItem('exiled.backupAt', String(Date.now()));
      return report;
    });
  }

  /* hand the code over as a file */
  function download(code, handle) {
    var name = 'exiled-' + (String(handle || '').replace(/[^\w.-]/g, '').slice(0, 25) || 'backup') + '.save';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  root.EXBackup = { KEEP: KEEP, pack: pack, unpack: unpack, restore: restore, download: download, opens: opens };
})(typeof window !== 'undefined' ? window : globalThis);
