// GodGift Core : le verrou a date (tlock-js 0.9.0, drand) et la cryptographie secp256k1 (noble-curves, bibliotheque auditee), pour le navigateur.
// Construction : npm ci && npx esbuild entree.js --bundle --minify --format=iife --target=es2020 --outfile=../app/gg_tlock.js
import { timelockDecrypt, roundTime, roundAt } from "tlock-js";
import { verifyBeacon } from "drand-client/beacon-verification";
import { secp256k1, schnorr } from "@noble/curves/secp256k1";

// une balise drand (ronde, signature, alea) est verifiee contre la cle publique du reseau AVANT tout usage : ronde attendue,
// alea = SHA-256 de la signature, signature BLS valide. Une balise fausse n'est jamais utilisee, ni gardee.
// Une balise deja verifiee pendant cette session (meme reseau, meme ronde, meme signature, meme alea) ne se reverifie pas : la memoire
// de la page seulement, jamais le disque.
var VERIFIEES = {};
function baliseValide(chaine, b, r) {
  if (!b || typeof b !== "object" || b.round !== r || typeof b.signature !== "string" || typeof b.randomness !== "string") return Promise.resolve(false);
  var k = [chaine.hash, chaine.public_key, r, b.signature, b.randomness].join(":");
  if (VERIFIEES[k]) return Promise.resolve(true);
  return Promise.resolve().then(function () { return verifyBeacon(chaine, b, r); }).then(function (ok) { if (ok === true) VERIFIEES[k] = true; return ok === true; }, function () { return false; });
}

window.GGTL = {
  // ouvre un verrou a date. balises (facultatif) : { ronde: balise } deja connues (gardees sur cette machine) ; chacune est REVERIFIEE
  // avant usage, et la balise qui a servi y est rangee. Sans balise valide en main, les relais sont interroges l'un apres l'autre :
  // un relais injoignable, ou qui rend une signature fausse, est saute ; rien n'est lu dans le cache du navigateur (no-store).
  ouvrir: function (arme, chaine, relais, balises) {
    var client = {
      // la verification est faite dans get, a chaque balise, avant de la rendre : tlock-js n'a pas a la refaire
      options: { disableBeaconVerification: true, noCache: true, chainVerificationParams: { chainHash: chaine.hash, publicKey: chaine.public_key } },
      chain: function () { return { info: function () { return Promise.resolve(chaine); } }; },
      get: function (r) {
        var i = 0, liste = (relais || []).slice(0, 8);
        function garder(b) { if (balises) balises[r] = { round: b.round, signature: b.signature, randomness: b.randomness }; return b; }
        function essai() {
          if (i >= liste.length) return Promise.reject(new Error("drand injoignable, ou signature fausse a chaque relais"));
          var u = liste[i++] + "/" + chaine.hash + "/public/" + r;
          // un relais muet ne bloque pas l'ouverture : dix secondes, puis le suivant
          var arret = typeof AbortController === "function" ? new AbortController() : null;
          var minuterie = arret ? setTimeout(function () { arret.abort(); }, 10000) : null;
          return fetch(u, arret ? { cache: "no-store", signal: arret.signal } : { cache: "no-store" })
            .then(function (x) { if (!x.ok) throw new Error("HTTP " + x.status); return x.json(); })
            .then(function (b) { if (minuterie) clearTimeout(minuterie); return baliseValide(chaine, b, r).then(function (ok) { if (!ok) throw new Error("signature drand fausse"); return garder(b); }); })
            .catch(function () { if (minuterie) clearTimeout(minuterie); return essai(); });
        }
        var connue = balises && balises[r];
        if (connue) return baliseValide(chaine, connue, r).then(function (ok) { if (ok) return connue; delete balises[r]; return essai(); });
        return essai();
      },
      latest: function () { return Promise.reject(new Error("inutile")); }
    };
    return timelockDecrypt(arme, client).then(function (b) { return new TextDecoder().decode(b); });
  },
  baliseValide: baliseValide,
  // ECDSA : verification (messages signes), signature deterministe RFC 6979 a S bas (transactions), recuperation (BIP-137)
  ecdsaVerifier: function (sigDer, hash, pub) {
    try { return secp256k1.verify(secp256k1.Signature.fromDER(sigDer).normalizeS(), hash, pub, { lowS: false }); } catch (e) { return false; }
  },
  ecdsaSigner: function (hash, cle) {
    // comme Bitcoin Core : RFC 6979, S bas, et R « court » (on rejoue avec un compteur en entropie supplementaire tant que R >= 2^255)
    var s = secp256k1.sign(hash, cle, { lowS: true }), n = 0;
    while (s.toCompactRawBytes()[0] >= 0x80) {
      var extra = new Uint8Array(32); n++; extra[0] = n & 255; extra[1] = n >>> 8 & 255; extra[2] = n >>> 16 & 255; extra[3] = n >>> 24 & 255;
      s = secp256k1.sign(hash, cle, { lowS: true, extraEntropy: extra });
    }
    if (!secp256k1.verify(s, hash, secp256k1.getPublicKey(cle, true))) throw new Error("signature");   // on relit toujours ce qu'on signe
    return s.toDERRawBytes();
  },
  publique: function (cle) { return secp256k1.getPublicKey(cle, true); },
  ecdsaRecuperer: function (rs64, rec, hash) {
    try { return secp256k1.Signature.fromCompact(rs64).addRecoveryBit(rec).recoverPublicKey(hash).toRawBytes(true); } catch (e) { return null; }
  },
  // Schnorr BIP-340 (Nostr)
  schnorrSigner: function (msg, cle, alea) { return schnorr.sign(msg, cle, alea); },
  schnorrVerifier: function (sig, msg, px) { try { return schnorr.verify(sig, msg, px); } catch (e) { return false; } },
  schnorrPublique: function (cle) { return schnorr.getPublicKey(cle); },
  roundTime: roundTime, roundAt: roundAt
};
