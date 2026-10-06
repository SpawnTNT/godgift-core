/* GodGift Core · Recuperer le tresor : la transaction qui vide un coffre vers l'adresse du gagnant, et la preuve
   qu'une adresse appartient bien au chasseur (message signe par son propre portefeuille).
   Tout se passe sur la machine : la cle du coffre n'est jamais affichee, jamais ecrite, jamais envoyee.
   Signature : noble-curves (bibliotheque auditee, via gg_tlock.js), ECDSA deterministe RFC 6979 a S bas, relue avant usage.
   Formats : BIP-141/143 (segwit v0), BIP-173/350 (bech32, bech32m), BIP-125 (remplacement par des frais plus eleves),
   BIP-322 « simple » et BIP-137 (messages signes). Licence AGPL-3.0. */
(function (racine) {
  "use strict";
  var C = racine.GGC || (typeof require !== "undefined" ? require("./gg_crypto.js") : null);
  function TL() { return (typeof window !== "undefined" ? window : racine).GGTL; }

  // ------------------------------------------------------------------ octets
  function cat() { var l = 0, i; for (i = 0; i < arguments.length; i++) l += arguments[i].length; var o = new Uint8Array(l), k = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], k); k += arguments[i].length; } return o; }
  function u8(a) { return new Uint8Array(a); }
  function u32le(v) { return u8([v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255]); }
  function u64le(v) {   // v : entier sur (nombre sur de 0 a 2^53)
    if (!Number.isSafeInteger(v) || v < 0) throw new Error("montant");
    var o = new Uint8Array(8), x = BigInt(v);
    for (var i = 0; i < 8; i++) { o[i] = Number(x & 255n); x >>= 8n; }
    return o;
  }
  function varint(n) { return n < 0xfd ? u8([n]) : n <= 0xffff ? u8([0xfd, n & 255, n >>> 8]) : cat(u8([0xfe]), u32le(n)); }
  function avecLongueur(b) { return cat(varint(b.length), b); }
  function dsha(b) { return C.sha256(C.sha256(b)); }
  function inverse(b) { return Uint8Array.from(b).reverse(); }
  function h160(b) { return C.ripemd160(C.sha256(b)); }
  function egal(a, b) { if (!a || !b || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function cle32(k) { if (typeof k !== "bigint" || k <= 0n) throw new Error("cle"); return C.deHex(k.toString(16).padStart(64, "0")); }

  // ------------------------------------------------------------------ les adresses : bech32 et bech32m (BIP-173/350), base58check
  var CS = "qpzry9x8gf2tvdw0s3jn54khce6mua7l", BECH32M = 0x2bc830a3;
  function polymod(v) {
    var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3], c = 1;
    for (var i = 0; i < v.length; i++) { var b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ v[i]; for (var j = 0; j < 5; j++) if ((b >>> j) & 1) c ^= GEN[j]; }
    return c >>> 0;
  }
  function hrpX(h) { var o = []; for (var i = 0; i < h.length; i++) o.push(h.charCodeAt(i) >> 5); o.push(0); for (i = 0; i < h.length; i++) o.push(h.charCodeAt(i) & 31); return o; }
  function convertir(data, de, vers, pad) {
    var acc = 0, bits = 0, o = [], mx = (1 << vers) - 1;
    for (var i = 0; i < data.length; i++) { if (data[i] >> de) return null; acc = (acc << de) | data[i]; bits += de; while (bits >= vers) { bits -= vers; o.push((acc >> bits) & mx); } }
    if (pad) { if (bits) o.push((acc << (vers - bits)) & mx); }
    else if (bits >= de || ((acc << (vers - bits)) & mx)) return null;
    return o;
  }
  function decoderSegwit(a) {
    if (a !== a.toLowerCase() && a !== a.toUpperCase()) return null;         // casse melangee : refusee
    a = a.toLowerCase(); var i = a.lastIndexOf("1");
    if (i < 1 || i + 7 > a.length || a.length > 90) return null;
    var hrp = a.slice(0, i); if (hrp !== "bc" && hrp !== "tb") return null;
    var d = [];
    for (var j = i + 1; j < a.length; j++) { var v = CS.indexOf(a[j]); if (v < 0) return null; d.push(v); }
    var pm = polymod(hrpX(hrp).concat(d)), ver = d[0];
    if (ver > 16) return null;
    if ((ver === 0 && pm !== 1) || (ver > 0 && pm !== BECH32M)) return null;   // v0 en bech32, v1 et plus en bech32m
    var prog = convertir(d.slice(1, -6), 5, 8, false);
    if (!prog || prog.length < 2 || prog.length > 40) return null;
    if (ver === 0 && prog.length !== 20 && prog.length !== 32) return null;
    if (ver === 1 && prog.length !== 32) return null;                          // taproot : 32 octets
    prog = u8(prog);
    var script = cat(u8([ver === 0 ? 0 : 0x50 + ver, prog.length]), prog);
    return { reseau: hrp === "bc" ? "main" : "test", version: ver, programme: prog, script: script,
      type: ver === 0 ? (prog.length === 20 ? "p2wpkh" : "p2wsh") : ver === 1 ? "p2tr" : "segwit" };
  }
  var A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function decoderBase58(a) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{25,35}$/.test(a)) return null;
    var x = 0n; for (var i = 0; i < a.length; i++) x = x * 58n + BigInt(A58.indexOf(a[i]));
    var h = x.toString(16); if (h.length % 2) h = "0" + h;
    var b = C.deHex(h), z = 0; while (a[z] === "1") z++;
    b = cat(new Uint8Array(z), b);
    if (b.length !== 25) return null;
    var corps = b.slice(0, 21), ck = b.slice(21);
    if (!egal(dsha(corps).slice(0, 4), ck)) return null;
    var v = corps[0], h20 = corps.slice(1);
    if (v === 0x00 || v === 0x6f) return { reseau: v === 0 ? "main" : "test", type: "p2pkh", programme: h20, script: cat(u8([0x76, 0xa9, 20]), h20, u8([0x88, 0xac])) };
    if (v === 0x05 || v === 0xc4) return { reseau: v === 5 ? "main" : "test", type: "p2sh", programme: h20, script: cat(u8([0xa9, 20]), h20, u8([0x87])) };
    return null;
  }
  function decoderAdresse(a) { a = String(a || "").trim(); return decoderSegwit(a) || decoderBase58(a); }

  // ------------------------------------------------------------------ le balayage d'un coffre (entrees P2WPKH, une seule sortie)
  // poids : 4 octets de base par octet non temoin ; une entree P2WPKH = 41 octets de base + temoin (1 + 1+72 + 1+33)
  var POIDS_ENTREE = 41 * 4 + 108, POIDS_FIXE = (4 + 1 + 1 + 4) * 4 + 2;
  function vtaille(nEntrees, scriptSortie) { return Math.ceil((POIDS_FIXE + nEntrees * POIDS_ENTREE + (8 + 1 + scriptSortie.length) * 4) / 4); }
  function poussiere(type) { return type === "p2pkh" ? 546 : type === "p2sh" ? 540 : type === "p2wpkh" ? 294 : 330; }
  var SEQ_RBF = 0xfffffffd;

  /* o : { utxos: [{txid, vout, valeur}], cle: BigInt, destination, frais (sats, absolus) ou taux (sat/vB), reseau: "main"|"test" }
     rend : { hex, txid, vtaille, frais, montant, entrees } ; refuse tout ce qui n'est pas net */
  function balayer(o) {
    var dest = decoderAdresse(o.destination);
    if (!dest || dest.type === "segwit") throw new Error("destination_invalide");   // versions temoin 2 a 16 : pas encore definies, refusees
    if (dest.reseau !== (o.reseau || "main")) throw new Error("destination_reseau");
    var ut = (o.utxos || []).filter(function (u) { return /^[0-9a-f]{64}$/.test(u.txid) && Number.isInteger(u.vout) && u.vout >= 0 && u.vout <= 0xffffffff && Number.isSafeInteger(u.valeur) && u.valeur > 0 && u.valeur <= 2.1e15; });
    if (!ut.length || ut.length !== o.utxos.length) throw new Error("coffre_vide");
    ut = ut.slice().sort(function (a, b) { return a.txid < b.txid ? -1 : a.txid > b.txid ? 1 : a.vout - b.vout; });   // ordre fixe (BIP-69)
    var vus = {}; ut.forEach(function (u) { var id = u.txid + ":" + u.vout; if (vus[id]) throw new Error("entree_double"); vus[id] = 1; });
    var total = ut.reduce(function (s, u) { return s + u.valeur; }, 0);
    var k = cle32(o.cle);
    try { return signerBalayage(o, dest, ut, total, k); } finally { k.fill(0); }   // la copie de la cle en octets est effacee, quoi qu'il arrive
  }
  function signerBalayage(o, dest, ut, total, k) {
    var pub = TL().publique(k), prog = h160(pub);
    var vt = vtaille(ut.length, dest.script);
    var frais = o.frais != null ? Math.ceil(o.frais) : Math.ceil(o.taux * vt);
    if (!(frais >= vt)) throw new Error("frais_trop_bas");                     // au moins 1 sat/vB
    var montant = total - frais;
    if (montant < poussiere(dest.type)) throw new Error("trop_petit");
    if (frais > total / 2) throw new Error("frais_trop_hauts");                // jamais plus de la moitie du tresor en frais
    var version = u32le(2), locktime = u32le(0), seq = u32le(SEQ_RBF);
    var sortie = cat(u64le(montant), avecLongueur(dest.script));
    var prevouts = ut.map(function (u) { return cat(inverse(C.deHex(u.txid)), u32le(u.vout)); });
    var hashPrevouts = dsha(cat.apply(null, prevouts)), hashSequence = dsha(cat.apply(null, ut.map(function () { return seq; }))), hashOutputs = dsha(sortie);
    var codeScript = cat(u8([0x19, 0x76, 0xa9, 20]), prog, u8([0x88, 0xac]));
    var temoins = ut.map(function (u, i) {                                     // BIP-143, SIGHASH_ALL
      var pre = cat(version, hashPrevouts, hashSequence, prevouts[i], codeScript, u64le(u.valeur), seq, hashOutputs, locktime, u32le(1));
      var sig = TL().ecdsaSigner(dsha(pre), k);
      return cat(u8([2]), avecLongueur(cat(sig, u8([1]))), avecLongueur(pub));
    });
    var entrees = cat.apply(null, [varint(ut.length)].concat(prevouts.map(function (p) { return cat(p, u8([0]), seq); })));
    var sorties = cat(varint(1), sortie);
    var base = cat(version, entrees, sorties, locktime), complete = cat(version, u8([0, 1]), entrees, sorties, cat.apply(null, temoins), locktime);
    var poids = base.length * 3 + complete.length;
    return { hex: C.hex(complete), txid: C.hex(inverse(dsha(base))), vtaille: Math.ceil(poids / 4), frais: frais, montant: montant, entrees: ut.length };
  }

  // ------------------------------------------------------------------ la preuve qu'une adresse est a soi : un message signe par son portefeuille
  function b64(s) { try { return Uint8Array.from(atob(String(s).trim()), function (c) { return c.charCodeAt(0); }); } catch (e) { return null; } }
  function hashMessageClassique(m) {   // BIP-137 / « Bitcoin Signed Message »
    var p = C.utf8("Bitcoin Signed Message:\n"), b = C.utf8(m);
    return dsha(cat(varint(p.length), p, varint(b.length), b));
  }
  function bip322Simple(ad, message, w) {   // BIP-322 « simple », adresse P2WPKH
    if (w[0] !== 2) return false;
    var ls = w[1], der = w.slice(2, 2 + ls), lp = w[2 + ls], pub = w.slice(3 + ls, 3 + ls + lp);
    if (!der.length || der[der.length - 1] !== 1 || pub.length !== 33 || 3 + ls + lp !== w.length) return false;
    var hp = h160(pub); if (!egal(hp, ad.programme)) return false;
    var tag = C.sha256("BIP0322-signed-message"), mh = C.sha256(cat(tag, tag, C.utf8(message)));
    var spk = cat(u8([0, 20]), hp), z4 = new Uint8Array(4), z8 = new Uint8Array(8);
    var toSpend = cat(z4, u8([1]), new Uint8Array(32), u8([255, 255, 255, 255]), u8([34, 0, 32]), mh, z4, u8([1]), z8, u8([22]), spk, z4);
    var outpoint = cat(dsha(toSpend), z4), hOut = dsha(cat(z8, u8([1, 0x6a])));
    var code = cat(u8([25, 0x76, 0xa9, 20]), hp, u8([0x88, 0xac]));
    var pre = cat(z4, dsha(outpoint), dsha(z4), outpoint, code, z8, z4, hOut, z4, u32le(1));
    return TL().ecdsaVerifier(der.slice(0, -1), dsha(pre), pub);
  }
  function bip137(ad, message, w) {   // signature compacte de 65 octets (Electrum, Trezor, Coldcard, Sparrow « classique »)
    if (w.length !== 65) return false;
    var en = w[0]; if (en < 27 || en > 42) return false;
    var rec = (en - 27) & 3, compresse = en >= 31;
    var pub = TL().ecdsaRecuperer(w.slice(1), rec, hashMessageClassique(message));
    if (!pub) return false;
    if (!compresse) return false;                 // les cles non compressees ne servent ni au segwit ni a nos adresses
    var hp = h160(pub);
    if (ad.type === "p2wpkh" || ad.type === "p2pkh") return egal(hp, ad.programme);
    if (ad.type === "p2sh") return egal(h160(cat(u8([0, 20]), hp)), ad.programme);   // P2SH-P2WPKH
    return false;
  }
  function verifierMessage(adresse, message, signature) {
    var ad = decoderAdresse(adresse), w = b64(signature);
    if (!ad || !w) return false;
    try { return w.length === 65 ? bip137(ad, message, w) : ad.type === "p2wpkh" ? bip322Simple(ad, message, w) : false; } catch (e) { return false; }
  }
  function messageReception(adresse, nonce) { return "AEDE:reception:" + String(adresse).trim() + (nonce ? ":" + nonce : ""); }

  var GGTX = { decoderAdresse: decoderAdresse, balayer: balayer, vtaille: vtaille, poussiere: poussiere, verifierMessage: verifierMessage,
    messageReception: messageReception, hashMessageClassique: hashMessageClassique, SEQ_RBF: SEQ_RBF };
  if (typeof module !== "undefined" && module.exports) module.exports = GGTX; else racine.GGTX = GGTX;
})(this);
