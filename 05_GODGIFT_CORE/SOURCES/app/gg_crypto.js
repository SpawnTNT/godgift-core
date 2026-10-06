/* GodGift Core · le moteur cryptographique, sans dependance.
   SHA-256, RIPEMD-160, scrypt (annexe B de la Pierre : N = 2^20, r = 8, p = 1), secp256k1, bech32.
   Tout tourne sur la machine : aucune reponse, aucune cle ne quitte ce programme. Licence AGPL-3.0. */
(function (racine) {
  "use strict";

  // ------------------------------------------------------------------ outils
  function utf8(s) { return new TextEncoder().encode(s); }
  function hex(b) { var s = ""; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16); return s; }
  function deHex(h) { var o = new Uint8Array(h.length / 2); for (var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(2 * i, 2), 16); return o; }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }

  // ------------------------------------------------------------------ SHA-256
  var K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function sha256(m) {
    if (typeof m === "string") m = utf8(m);
    var l = m.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
    b.set(m); b[l] = 0x80;
    var bits = l * 8;
    for (var i = 0; i < 8; i++) b[nb - 1 - i] = (i < 4 ? (bits >>> (8 * i)) : Math.floor(bits / 4294967296) >>> (8 * (i - 4))) & 255;
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    for (var o = 0; o < nb; o += 64) {
      for (var t = 0; t < 16; t++) w[t] = (b[o + 4 * t] << 24) | (b[o + 4 * t + 1] << 16) | (b[o + 4 * t + 2] << 8) | b[o + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[4 * i] = h[i] >>> 24; out[4 * i + 1] = (h[i] >>> 16) & 255; out[4 * i + 2] = (h[i] >>> 8) & 255; out[4 * i + 3] = h[i] & 255; }
    return out;
  }

  function hmac256(k, m) {
    if (k.length > 64) k = sha256(k);
    var ik = new Uint8Array(64), ok = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { var v = i < k.length ? k[i] : 0; ik[i] = v ^ 0x36; ok[i] = v ^ 0x5c; }
    return sha256(concat(ok, sha256(concat(ik, m))));
  }

  function pbkdf2_1(pw, sel, dklen) {   // PBKDF2-HMAC-SHA256, une iteration (ce qu'utilise scrypt)
    var out = new Uint8Array(dklen), n = Math.ceil(dklen / 32);
    for (var i = 1; i <= n; i++) {
      var blk = concat(sel, new Uint8Array([i >>> 24, (i >>> 16) & 255, (i >>> 8) & 255, i & 255]));
      out.set(hmac256(pw, blk).subarray(0, Math.min(32, dklen - (i - 1) * 32)), (i - 1) * 32);
    }
    return out;
  }

  // ------------------------------------------------------------------ scrypt
  function salsa(B, x) {   // Salsa20/8 sur 16 mots, en place
    var i, j0 = B[0], j1 = B[1], j2 = B[2], j3 = B[3], j4 = B[4], j5 = B[5], j6 = B[6], j7 = B[7], j8 = B[8], j9 = B[9], j10 = B[10], j11 = B[11], j12 = B[12], j13 = B[13], j14 = B[14], j15 = B[15];
    var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7, x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14, x15 = j15, u;
    for (i = 0; i < 8; i += 2) {
      u = x0 + x12 | 0; x4 ^= u << 7 | u >>> 25; u = x4 + x0 | 0; x8 ^= u << 9 | u >>> 23; u = x8 + x4 | 0; x12 ^= u << 13 | u >>> 19; u = x12 + x8 | 0; x0 ^= u << 18 | u >>> 14;
      u = x5 + x1 | 0; x9 ^= u << 7 | u >>> 25; u = x9 + x5 | 0; x13 ^= u << 9 | u >>> 23; u = x13 + x9 | 0; x1 ^= u << 13 | u >>> 19; u = x1 + x13 | 0; x5 ^= u << 18 | u >>> 14;
      u = x10 + x6 | 0; x14 ^= u << 7 | u >>> 25; u = x14 + x10 | 0; x2 ^= u << 9 | u >>> 23; u = x2 + x14 | 0; x6 ^= u << 13 | u >>> 19; u = x6 + x2 | 0; x10 ^= u << 18 | u >>> 14;
      u = x15 + x11 | 0; x3 ^= u << 7 | u >>> 25; u = x3 + x15 | 0; x7 ^= u << 9 | u >>> 23; u = x7 + x3 | 0; x11 ^= u << 13 | u >>> 19; u = x11 + x7 | 0; x15 ^= u << 18 | u >>> 14;
      u = x0 + x3 | 0; x1 ^= u << 7 | u >>> 25; u = x1 + x0 | 0; x2 ^= u << 9 | u >>> 23; u = x2 + x1 | 0; x3 ^= u << 13 | u >>> 19; u = x3 + x2 | 0; x0 ^= u << 18 | u >>> 14;
      u = x5 + x4 | 0; x6 ^= u << 7 | u >>> 25; u = x6 + x5 | 0; x7 ^= u << 9 | u >>> 23; u = x7 + x6 | 0; x4 ^= u << 13 | u >>> 19; u = x4 + x7 | 0; x5 ^= u << 18 | u >>> 14;
      u = x10 + x9 | 0; x11 ^= u << 7 | u >>> 25; u = x11 + x10 | 0; x8 ^= u << 9 | u >>> 23; u = x8 + x11 | 0; x9 ^= u << 13 | u >>> 19; u = x9 + x8 | 0; x10 ^= u << 18 | u >>> 14;
      u = x15 + x14 | 0; x12 ^= u << 7 | u >>> 25; u = x12 + x15 | 0; x13 ^= u << 9 | u >>> 23; u = x13 + x12 | 0; x14 ^= u << 13 | u >>> 19; u = x14 + x13 | 0; x15 ^= u << 18 | u >>> 14;
    }
    B[0] = x0 + j0 | 0; B[1] = x1 + j1 | 0; B[2] = x2 + j2 | 0; B[3] = x3 + j3 | 0; B[4] = x4 + j4 | 0; B[5] = x5 + j5 | 0; B[6] = x6 + j6 | 0; B[7] = x7 + j7 | 0;
    B[8] = x8 + j8 | 0; B[9] = x9 + j9 | 0; B[10] = x10 + j10 | 0; B[11] = x11 + j11 | 0; B[12] = x12 + j12 | 0; B[13] = x13 + j13 | 0; B[14] = x14 + j14 | 0; B[15] = x15 + j15 | 0;
  }

  function blockMix(X, Y, r, T) {   // X : 32r mots ; Y : tampon de 32r mots
    var i, j;
    T.set(X.subarray((2 * r - 1) * 16, 2 * r * 16));
    for (i = 0; i < 2 * r; i++) {
      for (j = 0; j < 16; j++) T[j] ^= X[i * 16 + j];
      salsa(T);
      Y.set(T, i * 16);
    }
    for (i = 0; i < r; i++) X.set(Y.subarray(2 * i * 16, 2 * i * 16 + 16), i * 16);
    for (i = 0; i < r; i++) X.set(Y.subarray((2 * i + 1) * 16, (2 * i + 1) * 16 + 16), (r + i) * 16);
  }

  // scrypt asynchrone : rend la main au navigateur pour la barre de progression. p = 1 seulement (la Pierre).
  function scrypt(pw, sel, N, r, dklen, progres) {
    return new Promise(function (ok, ko) {
      var B = pbkdf2_1(pw, sel, 128 * r), n32 = 32 * r, X = new Uint32Array(n32), Y = new Uint32Array(n32), T = new Uint32Array(16), V;
      try { V = new Uint32Array(n32 * N); } catch (e) { return ko(new Error("memoire")); }
      for (var i = 0; i < n32; i++) X[i] = B[4 * i] | (B[4 * i + 1] << 8) | (B[4 * i + 2] << 16) | (B[4 * i + 3] << 24);
      var etape = 0, k = 0, PAS = 8192;
      function tour() {
        var fin = Math.min(k + PAS, N), j, t;
        if (etape === 0) {
          for (; k < fin; k++) { V.set(X, k * n32); blockMix(X, Y, r, T); }
        } else {
          for (; k < fin; k++) {
            j = (X[(2 * r - 1) * 16] >>> 0) & (N - 1);
            for (t = 0; t < n32; t++) X[t] ^= V[j * n32 + t];
            blockMix(X, Y, r, T);
          }
        }
        if (progres) progres((etape * N + k) / (2 * N));
        if (k >= N) { if (etape === 0) { etape = 1; k = 0; } else { return finir(); } }
        setTimeout(tour, 0);
      }
      function finir() {
        var o = new Uint8Array(128 * r);
        for (var i = 0; i < n32; i++) { o[4 * i] = X[i] & 255; o[4 * i + 1] = (X[i] >>> 8) & 255; o[4 * i + 2] = (X[i] >>> 16) & 255; o[4 * i + 3] = X[i] >>> 24; }
        V = null;
        ok(pbkdf2_1(pw, o, dklen));
      }
      tour();
    });
  }

  // ------------------------------------------------------------------ RIPEMD-160
  function ripemd160(m) {
    var zl = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
    var zr = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
    var sl = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
    var sr = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];
    var hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e], hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
    function f(j, x, y, z) { return j < 16 ? x ^ y ^ z : j < 32 ? (x & y) | (~x & z) : j < 48 ? (x | ~y) ^ z : j < 64 ? (x & z) | (y & ~z) : x ^ (y | ~z); }
    function rol(x, n) { return (x << n) | (x >>> (32 - n)); }
    var l = m.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
    b.set(m); b[l] = 0x80; var bits = l * 8;
    b[nb - 8] = bits & 255; b[nb - 7] = (bits >>> 8) & 255; b[nb - 6] = (bits >>> 16) & 255; b[nb - 5] = (bits >>> 24) & 255;
    var h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0], X = new Array(16);
    for (var o = 0; o < nb; o += 64) {
      for (var i = 0; i < 16; i++) X[i] = b[o + 4 * i] | (b[o + 4 * i + 1] << 8) | (b[o + 4 * i + 2] << 16) | (b[o + 4 * i + 3] << 24);
      var al = h[0], bl = h[1], cl = h[2], dl = h[3], el = h[4], ar = al, br = bl, cr = cl, dr = dl, er = el, t;
      for (var j = 0; j < 80; j++) {
        t = (rol((al + f(j, bl, cl, dl) + X[zl[j]] + hl[j >> 4]) | 0, sl[j]) + el) | 0; al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;
        t = (rol((ar + f(79 - j, br, cr, dr) + X[zr[j]] + hr[j >> 4]) | 0, sr[j]) + er) | 0; ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
      }
      t = (h[1] + cl + dr) | 0; h[1] = (h[2] + dl + er) | 0; h[2] = (h[3] + el + ar) | 0; h[3] = (h[4] + al + br) | 0; h[4] = (h[0] + bl + cr) | 0; h[0] = t;
    }
    var out = new Uint8Array(20);
    for (i = 0; i < 5; i++) { out[4 * i] = h[i] & 255; out[4 * i + 1] = (h[i] >>> 8) & 255; out[4 * i + 2] = (h[i] >>> 16) & 255; out[4 * i + 3] = h[i] >>> 24; }
    return out;
  }

  // ------------------------------------------------------------------ secp256k1
  var P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
  var N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  var G = [0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n, 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n];
  function md(a) { a %= P; return a < 0n ? a + P : a; }
  function inv(a) { var lm = 1n, hm = 0n, lo = md(a), hi = P; while (lo > 1n) { var q = hi / lo; var nm = hm - lm * q, nw = hi - lo * q; hm = lm; hi = lo; lm = nm; lo = nw; } return md(lm); }
  function jdbl(p) {
    var X = p[0], Y = p[1], Z = p[2]; if (Y === 0n || Z === 0n) return [0n, 0n, 0n];
    var S = md(4n * X * Y * Y), M = md(3n * X * X), X3 = md(M * M - 2n * S);
    return [X3, md(M * (S - X3) - 8n * Y * Y * Y * Y), md(2n * Y * Z)];
  }
  function jadd(p, q) {
    if (p[2] === 0n) return q; if (q[2] === 0n) return p;
    var Z1s = md(p[2] * p[2]), Z2s = md(q[2] * q[2]);
    var U1 = md(p[0] * Z2s), U2 = md(q[0] * Z1s), S1 = md(p[1] * Z2s * q[2]), S2 = md(q[1] * Z1s * p[2]);
    if (U1 === U2) return S1 === S2 ? jdbl(p) : [0n, 0n, 0n];
    var H = md(U2 - U1), R = md(S2 - S1), H2 = md(H * H), H3 = md(H * H2), U1H2 = md(U1 * H2);
    var X3 = md(R * R - H3 - 2n * U1H2);
    return [X3, md(R * (U1H2 - X3) - S1 * H3), md(H * p[2] * q[2])];
  }
  function mult(k) {
    var R = [0n, 0n, 0n], Q = [G[0], G[1], 1n];
    while (k > 0n) { if (k & 1n) R = jadd(R, Q); Q = jdbl(Q); k >>= 1n; }
    var zi = inv(R[2]), zi2 = md(zi * zi);
    return [md(R[0] * zi2), md(R[1] * zi2 * zi)];
  }
  function bigDe(b) { return BigInt("0x" + (hex(b) || "0")); }
  function pubCompressee(k) {
    var p = mult(k), x = p[0].toString(16).padStart(64, "0"), o = deHex(x), r = new Uint8Array(33);
    r[0] = (p[1] & 1n) ? 3 : 2; r.set(o, 1); return r;
  }

  // ------------------------------------------------------------------ bech32 (BIP-173, witness v0)
  var CS = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  function polymod(v) {
    var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3], c = 1;
    for (var i = 0; i < v.length; i++) { var b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ v[i]; for (var j = 0; j < 5; j++) if ((b >>> j) & 1) c ^= GEN[j]; }
    return c;
  }
  function hrpX(h) { var o = []; for (var i = 0; i < h.length; i++) o.push(h.charCodeAt(i) >> 5); o.push(0); for (i = 0; i < h.length; i++) o.push(h.charCodeAt(i) & 31); return o; }
  function convertir(data, de, vers, pad) {
    var acc = 0, bits = 0, o = [], mx = (1 << vers) - 1;
    for (var i = 0; i < data.length; i++) { acc = (acc << de) | data[i]; bits += de; while (bits >= vers) { bits -= vers; o.push((acc >> bits) & mx); } }
    if (pad && bits) o.push((acc << (vers - bits)) & mx);
    return o;
  }
  function adresseSegwit(prog, hrp) {
    hrp = hrp || "bc";
    var d = [0].concat(convertir(prog, 8, 5, true)), p = polymod(hrpX(hrp).concat(d).concat([0, 0, 0, 0, 0, 0])) ^ 1, s = hrp + "1";
    for (var i = 0; i < d.length; i++) s += CS[d[i]];
    for (i = 0; i < 6; i++) s += CS[(p >>> (5 * (5 - i))) & 31];
    return s;
  }
  function adresseValide(a) {
    a = String(a || "").toLowerCase(); var i = a.lastIndexOf("1"); if (i < 1 || a.length - i < 7) return false;
    var hrp = a.slice(0, i), d = [];
    for (var j = i + 1; j < a.length; j++) { var v = CS.indexOf(a[j]); if (v < 0) return false; d.push(v); }
    return (hrp === "bc" || hrp === "tb") && polymod(hrpX(hrp).concat(d)) === 1;
  }

  // ------------------------------------------------------------------ la cle d'un coffre (annexe B)
  // chasse n° 1 : les formes d'origine ; toute autre chasse h porte son numero (chasses.py de la Cave) : aucune n'ouvre l'autre
  function prefixe(n, h) { return h == null || h === 1 ? "AEDE-G" + n : "AEDE-H" + h + "-G" + n; }
  function sel(n, h) { return h == null || h === 1 ? "AEDE-V1g-coffre-" + n : "AEDE-V1g-chasse-" + h + "-coffre-" + n; }
  function chaineCoffre(n, nums3, nums17, alea, h) {
    function f(xs) { return xs.slice().sort(function (a, b) { return a - b; }).map(function (x) { return String(x).padStart(4, "0"); }).join("-"); }
    return prefixe(n, h) + ":" + f(nums3) + ":" + f(nums17) + ":" + alea.toLowerCase();
  }
  function cleCoffre(n, chaine, progres, N_, h) {
    if (chaine.indexOf(prefixe(n, h) + ":") !== 0) return Promise.reject(new Error("chaine"));
    return scrypt(utf8(chaine), utf8(sel(n, h)), N_ || 1048576, 8, 32, progres).then(function (d) {
      var o = sha256(d), k = bigDe(o);
      while (k === 0n || k >= N) { o = sha256(o); k = bigDe(o); }
      return k;
    });
  }
  function adresseDeCle(k, hrp) { return adresseSegwit(ripemd160(sha256(pubCompressee(k))), hrp); }

  var GGC = { sha256: sha256, sha256hex: function (m) { return hex(sha256(m)); }, hmac256: hmac256, scrypt: scrypt, ripemd160: ripemd160,
    pubCompressee: pubCompressee, adresseSegwit: adresseSegwit, adresseValide: adresseValide, chaineCoffre: chaineCoffre,
    cleCoffre: cleCoffre, adresseDeCle: adresseDeCle, hex: hex, deHex: deHex, utf8: utf8 };
  if (typeof module !== "undefined" && module.exports) module.exports = GGC; else racine.GGC = GGC;
})(this);
