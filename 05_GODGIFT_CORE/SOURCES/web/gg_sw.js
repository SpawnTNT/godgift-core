/* GodGift Core · le service web de la version web (app.angedeleau.com). Modele : construire.py le recopie dans dist/web/gg_sw.js en y
   inscrivant l'empreinte du programme et la liste SHA256SUMS de cette version (EMPREINTE et SOMMES ci-dessous).

   Ce qu'il fait, et ce qu'il ne fait pas :
   - il ne sert QUE les fichiers du programme listes dans SHA256SUMS, chacun verifie contre son empreinte SHA-256 avant d'etre garde ;
     un fichier dont l'empreinte differe n'est jamais servi (le chasseur voit une erreur, pas un programme altere) ;
   - a l'installation, il lit chaque fichier (sauf les grandes images de fond, verifiees a la premiere lecture) et les verifie TOUS :
     un seul ecart, et cette version n'est pas installee (la precedente, deja verifiee, continue de servir) ;
   - ensuite il sert ces fichiers verifies, sans repasser par le reseau ; la version suivante n'entre que si elle est complete et coherente ;
   - il ne touche a rien d'autre : la librairie, les explorateurs, drand et Nostr sont toujours lus en direct, par la page.
   Limite, dite franchement : qui controle l'hebergement peut publier un autre gg_sw.js avec d'autres empreintes. La version web se
   verifie donc de l'exterieur (recompiler_et_comparer.py --site, ou le controle O8), et pour recuperer un tresor l'application
   installee sur un ordinateur reste la voie la plus sure. */
"use strict";
var EMPREINTE = "";   // rempli par construire.py : SHA-256 de SHA256SUMS
var SOMMES = {};      // rempli par construire.py : { "chemin relatif": "sha256 hex" }, SHA256SUMS compris
var PLUS_TARD = /^img\/fond_/;   // les grandes images de fond : verifiees a la premiere lecture, pas a l'installation
var CACHE = "gg-" + EMPREINTE.slice(0, 16);
var TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", webmanifest: "application/manifest+json",
  png: "image/png", jpg: "image/jpeg", ico: "image/x-icon", icns: "application/octet-stream", woff2: "font/woff2" };

function hex(b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join(""); }
function chemin(url) {   // l'adresse demandee -> le fichier du programme qu'elle designe, ou null (alors le service web ne s'en mele pas)
  var u = new URL(url), base = new URL("./", self.registration.scope);
  if (u.origin !== base.origin || u.pathname.indexOf(base.pathname) !== 0) return null;
  var p = u.pathname.slice(base.pathname.length);
  if (p === "") p = "index.html";
  return Object.prototype.hasOwnProperty.call(SOMMES, p) ? p : null;
}
function lireVerifie(p) {   // lu sur le reseau, sans le cache du navigateur, puis verifie ; rend une reponse neuve, ou echoue
  // index.html se lit a la racine (certains hebergeurs renvoient /index.html vers /) ; une redirection est suivie : l'empreinte tranche
  return fetch(new Request(p === "index.html" ? "./" : p, { cache: "no-store", credentials: "omit" })).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status + " : " + p);
    return r.arrayBuffer().then(function (b) {
      return crypto.subtle.digest("SHA-256", b).then(function (h) {
        if (hex(h) !== SOMMES[p]) throw new Error("fichier altere : " + p);
        var t = new Headers(r.headers), ext = p.split(".").pop();
        ["Content-Encoding", "Content-Length", "Transfer-Encoding"].forEach(function (k) { t.delete(k); });   // le corps est deja decode
        if (!t.get("Content-Type") && TYPES[ext]) t.set("Content-Type", TYPES[ext]);
        return new Response(b, { status: 200, statusText: "OK", headers: t });
      });
    });
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    var ps = Object.keys(SOMMES).filter(function (p) { return !PLUS_TARD.test(p); });
    return Promise.all(ps.map(function (p) { return lireVerifie(p).then(function (r) { return c.put(p, r); }); }));
  }).then(function () { return self.skipWaiting(); }, function (err) {
    return caches.delete(CACHE).then(function () { throw err; });   // rien de partiel : cette version n'entre pas
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var p = chemin(e.request.url);
  if (!p) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(p).then(function (r) {
      if (r) return r;
      return lireVerifie(p).then(function (r2) { return c.put(p, r2.clone()).then(function () { return r2; }); });
    });
  }).catch(function (err) {
    return new Response("GodGift Core : ce fichier n'est pas celui de la version " + EMPREINTE.slice(0, 16) + " (" + (err && err.message || p) + ").",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
