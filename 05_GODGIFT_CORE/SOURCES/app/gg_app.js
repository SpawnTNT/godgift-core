/* GodGift Core · le noeud de la chasse de L'Ange de l'Eau.
   Il suit les coffres sur la chaine, verifie tout lui-meme, fait chasser hors ligne, fait devenir compagnon et, quand un chasseur
   trouve, vide lui-meme le coffre vers son adresse de reception signee. Aucune donnee personnelle n'est envoyee ; aucune cle
   n'est conservee : il lit du public et le recompte. Licence AGPL-3.0 : le code est ouvert ; qui le reprend publie ses modifications. */
(function () {
  "use strict";
  if (window.top !== window.self) { document.body.textContent = ""; return; }   // jamais dans le cadre d'une autre page
  var VERSION = "1.2.0-beta";
  var A = 2027;
  // la version web (https://app.angedeleau.com/, hebergement statique a part) lit la librairie sur angedeleau.com ; installe, sur librairie.angedeleau.com
  var WEB = location.protocol === "https:";
  var CAISSE_DEF = WEB ? "https://angedeleau.com" : "https://librairie.angedeleau.com",
     EXPLO_DEF = "https://mempool.space/api", EXPLO2_DEF = "https://blockstream.info/api", SITE = "https://angedeleau.com";
  var EUROS = [60, 60, 60, 65, 65, 70, 70, 70, 75, 75, 300, 75, 80, 80, 85, 90, 95, 100, 110, 115, 300, 300, 300, 1300];
  var TYPES = []; for (var n0 = 1; n0 <= 24; n0++) TYPES.push(n0 === 24 ? "final" : (n0 === 11 || n0 >= 21) ? "cathedrale" : "pierre");
  var MOTS = { pierre: 3, cathedrale: 4, final: 4 };
  var LISTE_SHA = "01622e7b67eb5faf9e17107e4ac16fd5aa8aa602c343ad78f46be52b586b8e2a";
  // le prix du livre n'est jamais ecrit ici (contre-verification de la caisse, N6) : c'est celui que la caisse publie et facture
  // (etat.livre.prix_sats, voir prixLivre) ; un recalage (Pierre, article 1) le change sans nouvelle version de GodGift Core.
  // CRI_SATS, lui, ne depend pas de la caisse : la petite sortie de chaque cri est fixee par la Pierre (12 000 sats, article 6) et
  // gravee au manifeste (amorce.montant_par_cri), que GodGift Core compare a l'amorce sur la chaine.
  var CRI_SATS = 12000;
  var LANGUES = [["fr", "Français"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["pt", "Português"]];
  var C = window.GGC, I18N = window.GG_I18N, GGR = window.GGR;
  // la page web (index.html) ne charge pas gg_empreinte.js : elle porte l'empreinte SRI de chaque script, et SHA256SUMS porte la sienne.
  // L'empreinte du programme s'y calcule donc ici : SHA-256 du fichier SHA256SUMS servi, que le service web (gg_sw.js) a verifie avec
  // chaque fichier. Installe (godgift.html), elle est ecrite par l'installateur apres sa propre verification.
  var EMPREINTE_WEB = !window.GG_EMPREINTE;
  if (EMPREINTE_WEB) window.GG_EMPREINTE = { empreinte: "0000000000000000000000000000000000000000000000000000000000000000", fichiers: 0 };

  // ------------------------------------------------------------------ reglages (propres a cette machine)
  // Ne se garde ici que ce qui se REVERIFIE a chaque chargement (audit godgift I3) : les textes publics a leur empreinte, les balises
  // drand a leur signature, les annonces a la chaine. Le contenu ouvert du COFFRET n'est jamais garde : il se rouvre a chaque fois.
  function lireR(k, d) { try { var v = localStorage.getItem("gg." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ecrireR(k, v) { try { localStorage.setItem("gg." + k, JSON.stringify(v)); } catch (e) { } }
  (function purgerLesCachesInverifiables() {   // les anciennes versions gardaient le contenu ouvert et la preuve de gravure : on les efface
    try {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^gg\.((cz_|ch\d+_)?ouverts_|manif_grave$|cz_grave$)/.test(k)) ks.push(k); }
      ks.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { }
  })();
  var qs = new URLSearchParams(location.search);
  // ------------------------------------------------------------------ la fenetre dediee (contre-audit godgift N1)
  // L'envoi AUTOMATIQUE d'un tresor n'est permis que dans la fenetre dediee de l'application installee. Le lanceur l'ouvre avec un profil
  // de navigateur a elle seule (--user-data-dir) et, dans l'adresse, le marqueur fenetre=<jeton> : 32 octets tires au hasard a
  // l'installation ; a cote du programme, l'installateur n'ecrit que l'EMPREINTE de ce jeton (gg_fenetre.js). Pourquoi un fichier local
  // ou une autre page ne peut pas fabriquer ce contexte :
  //  1. le jeton n'est ecrit que dans le raccourci du lanceur ; un navigateur interdit a un fichier local de lire un autre fichier (ni
  //     fetch, ni XMLHttpRequest, ni cadre) : il ne peut qu'executer un script, et gg_fenetre.js ne porte que l'empreinte ;
  //  2. deviner le jeton, c'est un essai sur 2^256 ; une copie de gg_fenetre.js ailleurs ne sert a rien : chaque page ne charge que celui
  //     de son propre dossier ;
  //  3. une page locale ouverte dans le navigateur principal partage le stockage des fichiers locaux de CE profil (adresse de reception,
  //     signature, nombre de l'installation), jamais celui du profil dedie : elle ne peut pas y ecrire une autre adresse.
  //  4. le jeton ne vit qu'en MEMOIRE (contre-verification V2) : ni stockage de session, ni stockage local. Un fichier qui remplacerait
  //     la page dans cet onglet (un fichier HTML glisse, par exemple) ne trouverait rien a lire ; et rien ne se depose dans la fenetre
  //     hors des zones prevues (voir plus bas, DEPOTS). Une fenetre rechargee n'est donc plus la fenetre dediee : elle le dit, et il faut
  //     la rouvrir par le lanceur.
  // Partout ailleurs (« Sans installer », navigateur principal, repli d'un lanceur, fenetre rechargee, version web), avant chaque envoi,
  // le chasseur retape deux morceaux de 8 caracteres de son adresse de reception, tires au hasard et masques a l'ecran, lus dans son
  // propre portefeuille (GGR.morceauxARetaper, la regle de la Cave) ; « Sans installer » ne recupere aucun tresor.
  // Et dans la fenetre dediee elle-meme, l'envoi automatique ne vaut que pour une adresse enregistree (ou retapee) DANS cette fenetre :
  // elle porte un sceau, HMAC du jeton (voir sceauReception) ; un fichier qu'on aurait ouvert dans ce profil pourrait reecrire l'adresse
  // et sa signature, pas ce sceau.
  var JETON_F = (function () {
    var em = window.GG_FENETRE && window.GG_FENETRE.empreinte, j = qs.get("fenetre");
    try { sessionStorage.removeItem("gg.fenetre"); } catch (e) { }   // les versions d'avant y gardaient le jeton : il en est efface
    if (j !== null) { qs.delete("fenetre"); try { history.replaceState(null, "", location.pathname + (qs.toString() ? "?" + qs.toString() : "") + location.hash); } catch (e) { } }
    if (!/^[0-9a-f]{64}$/.test(String(em || "")) || !/^[0-9a-f]{64}$/.test(String(j || "")) || window.GGC.sha256hex(j) !== em) return null;
    try { sessionStorage.setItem("gg.fenetre_ouverte", "1"); } catch (e) { }   // un simple drapeau, jamais le jeton : la fenetre rechargee le saura
    return j;
  })();
  var FENETRE = !!JETON_F;
  // la fenetre dediee, rechargee (touche F5, menu) : son jeton est perdu avec la page ; elle le dit, et renvoie au lanceur
  var FENETRE_RECHARGEE = !FENETRE && (function () { try { return sessionStorage.getItem("gg.fenetre_ouverte") === "1"; } catch (e) { return false; } })();
  var SANS_INSTALLER = !FENETRE && location.protocol !== "https:" && qs.get("sans_installer") === "1";
  var R = {
    lang: lireR("lang", null) || qs.get("lang") || ((navigator.language || "fr").slice(0, 2)),
    caisse: lireR("caisse", CAISSE_DEF), explo: lireR("explo", EXPLO_DEF), explo2: lireR("explo2", EXPLO2_DEF), demo: lireR("demo", false), installe: lireR("installe", false),
    temoin: lireR("temoin", null), relais: lireR("relais", null), reception: lireR("reception", null),
    parrain: lireR("parrain", null) || (/^[a-z2-7]{8,10}$/.test(qs.get("c") || "") ? qs.get("c") : null)   // le code du compagnon qui a offert GodGift Core
  };
  if (R.parrain && !lireR("parrain", null)) ecrireR("parrain", R.parrain);
  if (!I18N[R.lang]) R.lang = "fr";

  function t(k, v) {
    var s = (I18N[R.lang] && I18N[R.lang][k]) || I18N.fr[k] || k;
    if (v) for (var x in v) s = s.split("{" + x + "}").join(v[x]);
    return s;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // les nombres selon l'usage de chaque langue : espace fine insecable (U+202F) en francais, en espagnol et en portugais (« 21 000 » ;
  // en espagnol et en portugais, pas de separation sous 10 000 : « 4000 »), virgule en anglais (« 21,000 »), point en allemand (« 21.000 »)
  var LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES", de: "de-DE", pt: "pt-PT" }, SEP = { fr: "\u202f", es: "\u202f", pt: "\u202f", de: ".", en: "," };
  function loc() { return LOCALES[R.lang] || "fr-FR"; }
  function fnombre(n) {
    var x = Math.round(Number(n) || 0), s = String(Math.abs(x));
    if (!((R.lang === "es" || R.lang === "pt") && s.length <= 4)) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, SEP[R.lang] || "\u202f");
    return (x < 0 ? "-" : "") + s;
  }
  function fsats(s) { return fnombre(s); }
  function feur(e) { return R.lang === "en" ? "€" + fnombre(e) : fnombre(e) + "\u00a0€"; }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------ le calendrier de la Pierre (article 6)
  function dateEnigme(num) { var n = Math.ceil(num / 2), j = num % 2 ? 3 : 17; return Date.UTC(A + Math.floor((n - 1) / 12), (n - 1) % 12, j, 18, 15, 5) / 1000; }
  function coffreDe(num) { return Math.ceil(num / 2); }
  // une heure : toujours en UTC, avec les secondes, suivie de l'heure de Paris au meme instant (ete comme hiver) ; jamais une heure
  // locale sans sa zone. Une date : en toutes lettres (« 3 juin 2027 »), jamais « 2027-06-03 ».
  function fhms(s, tz) { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(s * 1000)); }
  function fheure(s) {
    var u, p = null;
    try { u = fhms(s, "UTC"); } catch (e) { return new Date(s * 1000).toISOString().slice(11, 19) + " UTC"; }
    try { p = fhms(s, "Europe/Paris"); } catch (e) { }
    return u + " UTC" + (p ? " (" + t("a_paris", { h: p }) + ")" : "");
  }
  function fdate(s, heure) { var d = fpart(s, { day: "numeric", month: "long", year: "numeric" }); return heure ? t("date_a_heure", { d: d, h: fheure(s) }) : d; }
  function fdateIso(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? fpart(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000, { day: "numeric", month: "long", year: "numeric" }) : String(iso || ""); }
  function fpart(s, o) { try { return new Date(s * 1000).toLocaleString(loc(), Object.assign({ timeZone: "UTC" }, o)); } catch (e) { return new Date(s * 1000).toISOString().slice(0, 10); } }
  function fmois(s) { return fpart(s, { month: "long", year: "numeric" }); }
  function fjour(s) { return fpart(s, { day: "numeric", month: "long" }); }
  function fcompte(sec) {
    if (sec < 0) sec = 0; var j = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    function p(x) { return (x < 10 ? "0" : "") + x; }
    return (j ? j + t("j") + " " : "") + p(h) + ":" + p(m) + ":" + p(s);
  }

  // ------------------------------------------------------------------ l'etat du monde
  var M = { pret: false, erreurs: {} };
  function maintenant() { return R.demo ? window.GG_DEMO.maintenant + (Date.now() - M.t0) / 1000 : Date.now() / 1000; }

  function lire(url, texte) {
    var ctl = new AbortController(), minuteur = setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(url, { cache: "no-store", signal: ctl.signal }).then(function (r) {
      clearTimeout(minuteur);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return texte ? r.text() : r.json();
    });
  }
  // ------------------------------------------------------------------ la chaine, lue a deux sources independantes
  // Chaque lecture importante (transactions, adresses, gravures) est demandee aux deux ; si elles ne disent pas la meme chose
  // sur ce qui est confirme, GodGift Core refuse de conclure et le dit. Si l'une tombe, l'autre prend le relais.
  function reseauDe(u) { return /\/signet\b/.test(u) ? "signet" : /\/testnet/.test(u) ? "testnet" : "main"; }
  function sources() {
    var a = R.explo.replace(/\/$/, ""), b = (R.explo2 || "").replace(/\/$/, "");
    if (!b || b === a || reseauDe(a) !== reseauDe(b)) return [a];
    return [a, b];
  }
  function reseau() { return reseauDe(R.explo) === "main" ? "main" : "test"; }
  M.src = { etat: 0, ecarts: [] };   // etat : 2 = deux sources d'accord, 1 = une seule a repondu
  function attendre(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function concorde(ch, a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) {                                             // vu d'un seul cote : propagation si ce n'est pas confirme ; sinon on relit
      var x = a == null ? b : a;
      return x && x.status && x.status.confirmed || (Array.isArray(x) && x.some(function (u) { return u.status && u.status.confirmed; })) || (x && x.chain_stats) ? "reessayer" : true;
    }
    var m;
    if (/^\/blocks\/tip\/height$/.test(ch)) return Math.abs(parseInt(a, 10) - parseInt(b, 10)) <= 3;
    if (/^\/tx\/[0-9a-f]{64}$/.test(ch)) {
      var va = JSON.stringify((a.vout || []).map(function (o) { return [o.scriptpubkey, o.value]; })), vb = JSON.stringify((b.vout || []).map(function (o) { return [o.scriptpubkey, o.value]; }));
      if (va !== vb) return false;
      var ia = JSON.stringify((a.vin || []).map(function (i) { return [i.txid, i.vout]; })), ib = JSON.stringify((b.vin || []).map(function (i) { return [i.txid, i.vout]; }));
      if (ia !== ib) return false;                                            // les entrees aussi (la gravure d'une annonce part du rendu de son amorce)
      var ca = !!(a.status && a.status.confirmed), cb = !!(b.status && b.status.confirmed);
      if (ca !== cb) return "non_confirmee";                                  // vue confirmee d'un seul cote : on la tient pour non confirmee
      return !ca || (a.status.block_hash === b.status.block_hash && a.status.block_height === b.status.block_height && a.status.block_time === b.status.block_time);
    }
    if (/^\/tx\/[0-9a-f]{64}\/outspend\/\d+$/.test(ch)) {
      var sa = a.spent && a.status && a.status.confirmed, sb = b.spent && b.status && b.status.confirmed;
      return !(sa && sb) || a.txid === b.txid;
    }
    if (/^\/address\/[^/]+$/.test(ch)) {
      var x = a.chain_stats || {}, y = b.chain_stats || {};
      return x.funded_txo_sum === y.funded_txo_sum && x.spent_txo_sum === y.spent_txo_sum ? true : "reessayer";   // un bloc tout juste trouve d'un seul cote : on relit
    }
    if (/^\/address\/[^/]+\/utxo$/.test(ch)) {
      var f = function (l) { return JSON.stringify(l.filter(function (u) { return u.status && u.status.confirmed; }).map(function (u) { return u.txid + ":" + u.vout + ":" + u.value; }).sort()); };
      return f(a) === f(b) ? true : "reessayer";
    }
    return true;                                                               // le reste (prix, frais, mempool) n'engage rien
  }
  function explo(chemin, texte) {
    var s = sources();
    if (s.length < 2 || R.demo) return lire(s[0] + chemin, texte);
    function deux() { return Promise.allSettled([lire(s[0] + chemin, texte), lire(s[1] + chemin, texte)]); }
    return deux().then(function (r) {
      var A = r[0], B = r[1];
      if (A.status !== "fulfilled" && B.status !== "fulfilled") throw A.reason;
      if (A.status !== "fulfilled") { M.src.etat = 1; return B.value; }       // la premiere est tombee : la seconde prend le relais
      if (B.status !== "fulfilled") { M.src.etat = 1; return A.value; }
      var c = concorde(chemin, A.value, B.value);
      if (c === "non_confirmee") { M.src.etat = Math.max(M.src.etat, 2); return A.value.status && A.value.status.confirmed ? B.value : A.value; }   // la prudente
      if (c === "reessayer") return attendre(3000).then(deux).then(function (r2) {
        var c2 = r2[0].status === "fulfilled" && r2[1].status === "fulfilled" ? concorde(chemin, r2[0].value, r2[1].value) : null;
        if (c2 === true) { M.src.etat = 2; return r2[0].value != null ? r2[0].value : r2[1].value; }
        if (c2 === "non_confirmee") { M.src.etat = 2; return r2[0].value.status && r2[0].value.status.confirmed ? r2[1].value : r2[0].value; }
        if (r2[0].status !== "fulfilled" || r2[1].status !== "fulfilled") { M.src.etat = 1; return (r2[0].value || r2[1].value); }
        return ecart(chemin);
      });
      if (c) { M.src.etat = Math.max(M.src.etat, 2); return A.value != null ? A.value : B.value; }   // l'une ne l'a pas encore vu : on prend l'autre
      return ecart(chemin);
    });
  }
  function ecart(chemin) {
    if (M.src.ecarts.indexOf(chemin) < 0) M.src.ecarts.push(chemin);
    M.erreurs.sources = true; throw new Error(t("sources_ecart"));
  }
  function diffuser(hex) {   // une transaction part par toutes les sources a la fois : il suffit qu'une l'accepte
    return Promise.allSettled(sources().map(function (b) {
      var ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, 20000);
      return fetch(b + "/tx", { method: "POST", body: hex, signal: ctl.signal }).then(function (r) { return r.text().then(function (x) { return { ok: r.ok, texte: x }; }); });
    })).then(function (rs) {
      var v = rs.filter(function (r) { return r.status === "fulfilled"; }).map(function (r) { return r.value; });
      if (v.some(function (x) { return x.ok || /already|known|exist|duplicate/i.test(x.texte); })) return { ok: true };
      if (!v.length) return { ok: false, hors_ligne: true };
      return { ok: false, conflit: v.some(function (x) { return /conflict|missing|spent|bad-txns-inputs|insufficient fee|rejecting replacement/i.test(x.texte); }), texte: v.map(function (x) { return x.texte; }).join(" | ").slice(0, 300) };
    });
  }

  function charger() {
    M.t0 = Date.now(); M.erreurs = {}; M.src = { etat: 0, ecarts: [] };
    if (R.demo) {
      var D = window.GG_DEMO.monde(C);
      Object.assign(M, D, { pret: true, demo: true }); M.t0 = Date.now();
      return chargerCoffret().then(chargerMessages).then(rendre);
    }
    M.demo = false;
    var p1 = lire(R.caisse.replace(/\/$/, "") + "/api/etat.json").then(function (e) { M.etat = e; }, function (e) { M.etat = null; M.erreurs.caisse = e.message || "injoignable"; });
    var p2 = explo("/blocks/tip/height", true).then(function (h) { M.hauteur = parseInt(h, 10); }, function (e) { M.hauteur = null; M.erreurs.explo = e.message || "injoignable"; });
    var p3 = explo("/v1/prices").then(function (p) { M.prixEur = p && p.EUR; }, function () { M.prixEur = null; });
    return Promise.all([p1, p2, p3]).then(function () {
      M.manifCache = false;
      if (M.etat && M.etat.empreinte_manifeste) {
        return lire(R.caisse.replace(/\/$/, "") + "/api/manifeste.json", true).then(function (tx) {
          M.manifTexte = tx; M.manifeste = lireJson(tx);
          if (tx && (!M.manifeste || !manifesteValide(M.manifeste))) { M.manifeste = null; M.manifTexte = null; M.erreurs.manifeste = true; }
          else if (tx) ecrireR("manif_texte", tx);
        }, function () { M.manifeste = null; });
      }
      // la librairie est tombee : le manifeste deja lu, s'il est bien forme ; sa gravure sur la chaine est reprouvee plus bas, a chaque chargement
      var cache = !M.etat && lireR("manif_texte", null), m = lireJson(cache);
      if (cache && (!m || !manifesteValide(m))) { cache = null; m = null; ecrireR("manif_texte", null); }
      M.manifTexte = cache || null; M.manifeste = m; M.manifCache = !!cache;
    }).then(function () {
      M.soldes = {};
      if (!M.manifeste) return;
      var adrs = M.manifeste.coffres.map(function (c) { return c.adresse; });
      return parLots(adrs, 4, function (a) {
        return explo("/address/" + a).then(function (j) {
          var cs = j.chain_stats || {}, ms = j.mempool_stats || {};
          M.soldes[a] = { sats: cs.funded_txo_sum - cs.spent_txo_sum + ms.funded_txo_sum - ms.spent_txo_sum, depense: cs.spent_txo_count > 0, retrait: ms.spent_txo_count > 0 };   // « pris » : seulement confirme
        }, function () { });
      });
    }).then(function () { return chargerCoffret().catch(function () { MP.coffretErreur = MP.coffretErreur || "absent"; }); })   // une panne d'un morceau
      .then(chargerChasseZero)                                                                                                     // n'arrete jamais les autres
      .then(function () { return chargerMessages().catch(function () { MP.messages = MP.messages || null; }); })   // apres les deux manifestes : l'adresse de l'auteur
      .then(chargerAnnonces).catch(function () { }).then(function () { M.pret = true; M.derniere = Date.now(); rendre();
        if (R.temoin && !R.demo && !V.enCours && Date.now() - (TE.publie || 0) > 20 * 3600 * 1000 && M.hauteur) verifier();
      });
  }
  function lireJson(tx) { if (typeof tx !== "string" || !tx) return null; try { return JSON.parse(tx); } catch (e) { return null; } }
  function manifesteValide(man) {
    try {
      return !!man && Array.isArray(man.coffres) && man.coffres.length >= 1 && man.coffres.length <= 64 && man.coffres.every(function (c) {
        var d = window.GGTX.decoderAdresse(c.adresse); return d && d.type === "p2wpkh" && d.reseau === reseau() && (c.cri_txid == null || /^[0-9a-f]{64}$/.test(c.cri_txid)) && (c.empreinte_alea == null || /^[0-9a-f]{64}$/.test(c.empreinte_alea));
      }) && (!man.amorce || !man.amorce.txid || /^[0-9a-f]{64}$/.test(man.amorce.txid)) && (!man.messages || !man.messages.adresse || !!window.GGTX.decoderAdresse(man.messages.adresse));
    } catch (e) { return false; }
  }
  function parLots(liste, n, f) {
    var i = 0; function suivant() { if (i >= liste.length) return Promise.resolve(); var x = liste[i++]; return f(x).then(suivant); }
    var ps = []; for (var k = 0; k < n; k++) ps.push(suivant()); return Promise.all(ps);
  }

  function coffres() {
    var man = M.manifeste, now = maintenant(), out = [];
    for (var n = 1; n <= 24; n++) {
      var c = man ? man.coffres[n - 1] : null, s = c && M.soldes ? M.soldes[c.adresse] : null;
      var t3 = dateEnigme(2 * n - 1), t17 = dateEnigme(2 * n), etat;
      if (!c) etat = "a_semer"; else if (s && s.depense) etat = "pris"; else if (now < t3) etat = "scelle"; else if (now < t17) etat = "en_chasse"; else etat = "a_prendre";
      out.push({ n: n, type: TYPES[n - 1], etat: etat, c: c, sats: s ? s.sats : (c && c.sats_semes) || null, t3: t3, t17: t17, euros: EUROS[n - 1] });
    }
    return out;
  }
  function prochaine() { var now = maintenant(); for (var k = 1; k <= 48; k++) if (dateEnigme(k) > now) return k; return null; }
  // le compte a rebours de la prochaine enigme, toutes chasses confondues : avant le 3 janvier 2027, c'est l'une des deux de la chasse zero
  // (3 et 17 novembre 2026, article 8 bis) ; rien (null) quand plus aucune enigme n'est a venir
  function compteProchaine(pro, now) {
    var z = null; if (!R.demo) [[3, 1], [17, 2]].forEach(function (j) { var d = GGR.heureEnigme(0, 1, j[0]); if (!z && d > now && (!pro || d < dateEnigme(pro))) z = { d: d, q: j[1] }; });
    if (z) return '<div style="display:flex;gap:18px;align-items:baseline;flex-wrap:wrap"><div class="compte" data-compte="' + z.d + '">' + fcompte(z.d - now) + "</div><div>" +
      esc(t("cz_prochaine", { q: t("cz_prochaine_" + z.q) })) + '<br><span class="doux">' + esc(fdate(z.d, true)) + '</span><br><a href="#/chasse/0">' + esc(t("cz_voir")) + " →</a></div></div>";
    if (!pro) return null;
    return '<div style="display:flex;gap:18px;align-items:baseline;flex-wrap:wrap"><div class="compte" data-compte="' + dateEnigme(pro) + '">' + fcompte(dateEnigme(pro) - now) + "</div><div>" +
      esc(t("enigme_n", { n: pro })) + " · " + esc(t("coffre_n", { n: coffreDe(pro) })) + '<br><span class="doux">' + esc(fdate(dateEnigme(pro), true)) + "</span></div></div>";
  }
  // Le texte ouvert ICI par drand (le COFFRET) fait foi et passe avant celui de la librairie (audit godgift I4) ; si la librairie publie
  // un autre texte pour la meme enigme, l'ecart est marque et s'affiche sur la page de l'enigme.
  function enigmesParues() {
    var now = maintenant(), par = {};
    if (typeof elements === "function") elements("enigme").forEach(function (e) {
      var d = contenu(e); if (d) par[d.numero] = { numero: d.numero, coffre: d.coffre, date_utc: dateEnigme(d.numero), texte_fr: d.texte_fr, texte_en: d.texte_en || "", source: "coffret" };
    });
    ((M.etat && M.etat.enigmes) || []).filter(function (e) { return e && e.date_utc <= now; }).forEach(function (e) {
      var x = par[e.numero];
      if (x) { if (e.texte_fr !== x.texte_fr || (e.texte_en || "") !== x.texte_en) x.ecart = true; return; }
      par[e.numero] = Object.assign({}, e, { source: "librairie" });
    });
    return Object.keys(par).map(function (k) { return par[k]; }).sort(function (a, b) { return a.numero - b.numero; });
  }
  function noteEnigme(e) {   // sous le texte : l'ecart avec la librairie (en rouge), ou un texte que le COFFRET n'a pas encore confirme
    if (e.ecart) return '<p class="ko" style="font-size:13px">⚠ ' + esc(t("enigme_ecart")) + "</p>";
    if (e.source === "librairie") return '<p class="att" style="font-size:12px">' + esc(t("enigme_librairie_seule")) + "</p>";   // COFFRET charge ou non (contre-audit N4)
    return "";
  }

  // ------------------------------------------------------------------ dessins
  function coffreSvg(etat, taille) {
    taille = taille || 36; var h = Math.round(taille * 44 / 48);
    if (etat === "pris") return '<svg width="' + taille + '" height="' + h + '" viewBox="0 0 48 44" fill="none" stroke="#9a917f" stroke-width="1.6" stroke-linejoin="round"><path d="M10 16 Q10 3 24 3 Q38 3 38 16 Z" fill="#2c2b2e"/><path d="M10 16 L6 22 H42 L38 16 Z" fill="#08080a"/><path d="M6 22h36v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#2a2a2e"/><rect x="20" y="24" width="8" height="7" rx="1.5" fill="#1a1a1d"/></svg>';
    var st = { scelle: ["#e2b85c", "#2a2418", "#3a311f", ""], a_semer: ["#8f8672", "#1e2128", "#23262e", ""], en_chasse: ["#bfe9f7", "#15394c", "#1d4d66", ""],
      a_prendre: ["#fff0bf", "#6a4a14", "#8a6420", '<g stroke="#ffe7a3" stroke-width="1.3" opacity=".95"><path d="M24 17 V2"/><path d="M17 17 L11 5"/><path d="M31 17 L37 5"/><path d="M12 18 L3 11"/><path d="M36 18 L45 11"/></g>'] }[etat];
    var fente = etat === "a_prendre" ? '<path d="M6 21h36" stroke="#ffe7a3" stroke-width="2.4" opacity=".9"/>' : "";
    var cle = etat === "en_chasse" ? '<g stroke="#8fd3ea" stroke-width="1.6"><path d="M27 23 H40"/><circle cx="43" cy="23" r="3" fill="#15394c"/><path d="M33 23v3M36 23v2"/></g>' : "";
    return '<svg width="' + taille + '" height="' + h + '" viewBox="0 0 48 44" fill="none" stroke="' + st[0] + '" stroke-width="1.6" stroke-linejoin="round">' + st[3] +
      '<path d="M6 21 V15 Q6 8 24 8 Q42 8 42 15 V21 Z" fill="' + st[2] + '"/><path d="M6 21h36v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="' + st[1] + '"/>' + fente +
      '<path d="M13 8.8V40M35 8.8V40" stroke-width="1.2" opacity=".85"/><rect x="20" y="18" width="8" height="10" rx="1.5" fill="#0f1116" stroke="' + st[0] + '"/>' + cle + "</svg>";
  }

  // ------------------------------------------------------------------ le cadre : menu, statut
  var PAGES = [["tableau", "▦"], ["enigmes", "✎"], ["coffret", "⧗"], ["messages", "✉"], ["livres", "❦"], ["verifier", "✓"], ["chasser", "⚿"], ["compagnon", "✦"], ["chasses", "◇"], ["reseau", "◎"], ["guide", "?"], ["reglages", "⚙"]];
  var FONDS = { tableau: "fond_coffre_salle_inondee.jpg", coffre: "fond_coffre_quai.jpg", enigmes: "fond_auteur_bureau_lyon.jpg", verifier: "fond_cave_forte.jpg", chasser: "fond_vouivre_tete.jpg", compagnon: "fond_auteur_quai.jpg", reseau: "fond_vouivre_vol_2.jpg", reglages: "fond_vouivre_rocher.jpg", pierre: "fond_vouivre_rocher.jpg", guide: "fond_auteur_bureau_lyon.jpg",
    coffret: "fond_cave_forte.jpg", messages: "fond_auteur_bureau_lyon.jpg", livres: "fond_auteur_quai.jpg", chasses: "fond_coffre_salle_inondee.jpg", chasse: "fond_coffre_quai.jpg" };
  function route() { var h = (location.hash || "#/tableau").slice(2).split("/"); return { p: h[0] || "tableau", a: h[1] }; }

  function cadre(page) {
    document.documentElement.lang = R.lang;
    $("sous-logo").textContent = t("sous_logo");
    $("menu").innerHTML = PAGES.map(function (x) {
      return '<div class="m' + (x[0] === page || (page === "coffre" && x[0] === "tableau") || (page === "pierre" && x[0] === "reglages") || (page === "chasse" && x[0] === "chasses") ? ' actif' : '') + '" data-p="' + x[0] + '"><b>' + x[1] + "</b><span>" + esc(t("m_" + x[0])) + "</span></div>";
    }).join("");
    $("fond").style.backgroundImage = "url(img/" + (FONDS[page] || FONDS.tableau) + ")";
    var st = [];
    if (R.demo) st.push('<span class="pastille att"></span><b class="att">' + esc(t("demo_court")) + "</b>");
    else {
      var srcs = sources().map(hote).join(" + ");
      st.push('<span class="pastille' + (M.erreurs.explo || M.erreurs.sources ? " ko" : "") + '"></span><span>' + esc(t("chaine")) + " : " + esc(srcs) + (M.erreurs.sources ? ' · <b class="ko">' + esc(t("sources_desaccord")) + "</b>" : M.hauteur ? " · " + t("bloc") + " " + fsats(M.hauteur) : " · " + t("injoignable")) + "</span>");
      st.push(badgeOfficiel(true));
      st.push("<span>·</span><span>" + esc(t("librairie")) + " : " + (M.etat ? '<span class="ok">' + esc(t("flux_recu")) + "</span>" : '<span class="att">' + esc(t("pas_encore_ouverte")) + "</span>") + "</span>");
    }
    st.push('<span style="flex:1"></span><button class="bouton2" style="padding:2px 10px;font-size:11px" id="rafraichir">↻</button>');
    st.push('<select id="langue">' + LANGUES.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === R.lang ? " selected" : "") + ">" + l[0].toUpperCase() + "</option>"; }).join("") + "</select>");
    $("statut").innerHTML = st.join(" ");
    // la passe telephone : cinq onglets nommes en bas (Coffres, Enigmes, Verifier, Messages, Plus) et un en-tete d'une ligne
    var ONGLETS = [["tableau", "▦"], ["enigmes", "✎"], ["verifier", "✓"], ["messages", "✉"], ["plus", "⋯"]];
    var dansPlus = ["coffret", "livres", "chasser", "compagnon", "chasses", "reseau", "guide", "reglages", "pierre", "conditions", "chasse", "plus"];
    var onglet = page === "coffre" ? "tableau" : dansPlus.indexOf(page) >= 0 ? "plus" : page;
    var tb = $("onglets"); if (!tb) { tb = document.createElement("nav"); tb.id = "onglets"; tb.className = "onglets"; tb.setAttribute("aria-label", "GodGift Core"); $("app").appendChild(tb); }
    tb.innerHTML = ONGLETS.map(function (o) { return '<button type="button" class="o' + (o[0] === onglet ? " actif" : "") + '" data-p="' + o[0] + '"' + (o[0] === onglet ? ' aria-current="page"' : "") + "><b>" + o[1] + "</b><span>" + esc(t("tb_" + o[0])) + "</span></button>"; }).join("");
    var ligne = $("ligne-etat"); if (!ligne) { ligne = document.createElement("div"); ligne.id = "ligne-etat"; ligne.className = "ligne-etat"; $("statut").parentNode.insertBefore(ligne, $("statut")); }
    var okChaine = !M.erreurs.explo && !M.erreurs.sources, resume = R.demo ? t("demo_court") : (okChaine && M.hauteur ? t("et_bloc") + " " + fsats(M.hauteur) : M.erreurs.sources ? t("et_desaccord") : t("et_chaine_ko")) + " · " + (M.etat ? t("et_librairie_ok") : t("et_librairie_non"));
    ligne.innerHTML = '<span><span class="pastille' + (R.demo ? " att" : okChaine ? "" : " ko") + '"></span>' + esc(resume) + '</span><button type="button" class="lien-etat" id="etat-details" aria-expanded="false">' + esc(t("et_details")) + " ⌄</button>";
    var ec = [];
    if (M.pret) {
      ec.push('<span class="pastille' + (R.demo ? " att" : M.erreurs.explo ? " ko" : "") + '"></span> ' + esc(R.demo ? t("demo_court") : M.erreurs.explo ? t("hors_ligne") : t("synchronise")));
      if (M.hauteur) ec.push(t("bloc") + " " + fsats(M.hauteur));
      if (M.derniere) ec.push(t("lu_a") + " " + fheure(M.derniere / 1000));
    } else ec.push(esc(t("lecture")));
    ec.push('<span class="doux">v' + VERSION + "</span>");
    $("etat-cote").innerHTML = ec.join("<br>");
  }
  function hote(u) { try { return new URL(u).host; } catch (e) { return u; } }

  // ------------------------------------------------------------------ la version publiee
  // L'auteur signe dans la Cave (message BIP-322 de son adresse ancree sur la chaine) : « GodGift Core <version> : empreinte <64 hex> ».
  // Il peut retirer une version : « GodGift Core <version> : empreinte <64 hex> RETIREE ». Ce badge (« version publiee ») protege d'une
  // copie abimee ou perimee ; contre une copie piegee (qui mentirait sur elle-meme), ce sont la recompilation (recompiler_et_comparer.py),
  // la page « Verifier mon installateur » et, une fois signe, la signature Windows qui protegent : le guide le dit.
  function officiel() {
    var e = window.GG_EMPREINTE.empreinte, pub = [], retirees = {};
    (MP.messages || []).forEach(function (m) {
      if (!m.valide || !MP.adresseAncree || m.adresse !== MP.adresseAncree) return;
      var re = /GodGift Core\s+([0-9A-Za-z.\-]+)\s*:\s*empreinte\s+([0-9a-f]{64})(\s+RETIR[EÉ]E)?/g, x;
      while ((x = re.exec(m.texte))) { if (x[3]) retirees[x[2]] = x[1]; else pub.push({ v: x[1], e: x[2], date: m.date }); }
    });
    if (retirees[e]) return { etat: "retiree", v: retirees[e] };
    var moi = pub.filter(function (p) { return p.e === e; })[0];
    if (moi) return { etat: "officiel", v: moi.v, date: moi.date };
    if (pub.length) return { etat: "inconnu", derniere: pub[pub.length - 1].v };
    return { etat: "essai" };
  }
  function badgeOfficiel(court) {
    if (R.demo) return court ? "" : '<span class="att">' + esc(t("demo_court")) + "</span>";
    if (WEB) {   // contre-audit N3 : l'empreinte affichee ici est celle de la liste servie, pas celle du code qui tourne
      return court ? '<a href="#/guide/officiel" class="badge-prog att" title="' + esc(t("prog_web")) + '">◌ ' + esc(t("prog_court_web")) + "</a>" : '<span class="att">' + esc(t("prog_web")) + "</span>";
    }
    var o = officiel(), cls = o.etat === "officiel" ? "ok" : o.etat === "essai" ? "att" : "ko";
    var txt = o.etat === "officiel" ? t("prog_officiel", { v: o.v }) : o.etat === "essai" ? t("prog_beta") : o.etat === "retiree" ? t("prog_retire") : t("prog_inconnu", { v: o.derniere });
    return court ? '<a href="#/guide/officiel" class="badge-prog ' + cls + '" title="' + esc(txt) + '">' + (cls === "ok" ? "✓ " : cls === "ko" ? "⚠ " : "β ") + esc(o.etat === "officiel" ? t("prog_court_ok") : o.etat === "essai" ? t("prog_court_beta") : t("prog_court_ko")) + "</a>"
      : '<span class="' + cls + '">' + esc(txt) + "</span>";
  }

  // ------------------------------------------------------------------ 1. le tableau
  function pageTableau() {
    var cs = coffres(), now = maintenant(), pro = prochaine(), total = 0, restants = 0;
    cs.forEach(function (k) { if (k.etat !== "pris" && k.sats) { total += k.sats; restants++; } });
    var tuiles = cs.map(function (k) {
      var mt = k.etat === "a_semer" ? feur(k.euros) : k.sats != null ? fsats(k.sats) + " sats" : "…";
      var dt = k.etat === "a_prendre" ? t("a_prendre_depuis") : k.etat === "en_chasse" ? t("seconde_le") + " " + fjour(k.t17) : fmois(k.t3);   // « PRIS » est deja l'etat
      return '<div style="--i:' + k.n + '" class="apparait coffre k-' + k.etat + (k.type !== "pierre" ? " k-gros" : "") + '" data-coffre="' + k.n + '"><div class="no">' + k.n + "</div>" + coffreSvg(k.etat) +
        '<div class="et">' + esc(t("e_" + k.etat)) + '</div><div class="mt">' + esc(mt) + '</div><div class="dt">' + esc(dt) + "</div></div>";
    }).join("");
    var tete;
    if (!M.manifeste) {
      tete = '<div class="sur">' + esc(t("les_24")) + '</div><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap"><h1>' + esc(t("tableau_titre")) + aide("tableau") +
        '</h1><div style="text-align:right"><div class="sur">' + esc(t("tresor_depart")) + '</div><div class="tresor or">4 000 €</div></div></div><div class="bandeau">' + esc(t("avant_semis")) + " " + motSimple("seme") + "</div>";
    } else {
      tete = '<div class="sur">' + esc(t("les_24")) + '</div><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap"><h1>' + esc(t("tableau_titre")) + aide("tableau") +
        '</h1><div style="text-align:right"><div class="sur">' + esc(t("tresor_restant", { n: restants })) + '</div><div class="tresor or">' + fsats(total) + ' sats</div>' +
        (M.prixEur ? '<div class="doux">≈ ' + feur(total / 1e8 * M.prixEur) + "</div>" : "") + "</div></div>";
    }
    var bas = '<div class="deux" style="margin-top:18px"><div class="cadre"><div class="sur">' + esc(t("prochaine_enigme")) + "</div>" +
      (compteProchaine(pro, now) || "<div>" + esc(t("chasse_finie")) + "</div>") +
      '</div><div class="cadre"><div class="sur">' + esc(t("ce_qui_se_passe")) + "</div>" + fil() + "</div></div>";
    var cp = (M.etat && M.etat.compteur) || (R.demo ? { vendus: 1284, certifies_sur_la_chaine: 1102 } : null), msg = MP.messages && MP.messages.filter(function (m) { return m.valide && (R.demo || (MP.adresseAncree && m.adresse === MP.adresseAncree)); })[0];
    var bandeauMp = '<div class="bandeau-mp">' + '<a href="#/chasses" class="tag">' + esc(t("chasse_n", { n: 1 }) + " · " + t("nom_chasse1")) + "</a>" +
      (cp ? '<a href="#/livres">❦ ' + esc(t("ex_bandeau", { n: fsats(cp.vendus), c: fsats(cp.certifies_sur_la_chaine) })) + "</a>" : "") +
      (MP.coffret ? '<a href="#/coffret">⧗ ' + esc(t("coffret_bandeau", { o: elements().filter(function (e) { return MP.ouverts[cleV(e)] != null; }).length, n: elements().length })) + "</a>" : "") +
      (ZS[0].etat ? '<a href="#/chasse/0">◇ ' + esc(t("cz_bandeau")) + "</a>" : "") +
      Object.keys(ZS).filter(function (h) { return +h >= 2 && CHASSES[h]; }).map(function (h) { return '<a href="#/chasse/' + h + '">◇ ' + esc(CHASSES[h].nom) + "</a>"; }).join("") +
      (msg ? '<a href="#/messages" class="dernier-msg">✉ ' + esc(msg.texte.split("\n")[0].slice(0, 90)) + "</a>" : "") + "</div>";
    var qTemoin = !R.demo && R.installe && R.temoin == null ? '<div class="bandeau">' + esc(t("ac4_q")) + " " + esc(t("ac4_texte")) + ' <button class="bouton2" style="padding:2px 12px;font-size:12px" data-temoin="1">' + esc(t("ac4_oui")) + '</button> <button class="bouton2" style="padding:2px 12px;font-size:12px" data-temoin="0">' + esc(t("ac4_non")) + "</button></div>" : "";
    var alerteMan = M.erreurs.manifChange || M.erreurs.manifeste ? '<div class="bandeau" style="border-color:#e0605a;background:rgba(224,96,90,.18)">⚠ ' + esc(t(M.erreurs.manifChange ? "manif_change" : "manif_invalide")) + "</div>" : "";
    return alerteMan + alerteReception() + qTemoin + (R.demo ? '<div class="bandeau demo">' + esc(t("demo_bandeau")) + "</div>" : "") + (M.manifCache ? '<div class="bandeau">' + esc(t("librairie_tombee")) + "</div>" : "") + tete + bandeauMp + '<div class="grille" style="margin-top:12px">' + tuiles + "</div>" + bas;
  }
  function fil() {
    var ev = [], now = maintenant();
    enigmesParues().slice(-3).reverse().forEach(function (e) { ev.push([e.date_utc, t("enigme_parue", { n: e.numero }), "eau"]); });
    coffres().forEach(function (k) { if (k.etat === "pris") ev.push([k.t17, t("coffre_pris", { n: k.n }), "doux"]); if (k.etat === "a_prendre") ev.push([k.t17, t("coffre_a_prendre", { n: k.n }), "or"]); });
    ((M.etat && M.etat.versements) || []).forEach(function (v) { ev.push([null, t("versement_fait", { q: v.trimestre }), "ok"]); });
    if (!ev.length) ev.push([null, t("rien_encore"), "doux"]);
    return ev.slice(0, 6).map(function (x) { return '<div class="ligne"><span class="' + x[2] + '">' + esc(x[1]) + '</span><span class="doux" style="font-size:12px">' + (x[0] ? esc(fdate(x[0])) : "") + "</span></div>"; }).join("");
  }

  // ------------------------------------------------------------------ 2. un coffre
  function pageCoffre(n) {
    n = parseInt(n, 10); if (!(n >= 1 && n <= 24)) return pageTableau();
    var k = coffres()[n - 1], c = k.c, now = maintenant();
    var l = [[t("type"), t("type_" + k.type) + " · " + t("mots_par", { m: MOTS[k.type] })], [t("montant_depart"), feur(k.euros) + (c && c.sats_semes ? " = " + fsats(c.sats_semes) + " sats" : "")],
      [t("enigme_du_3"), fdate(k.t3, true)], [t("enigme_du_17"), fdate(k.t17, true)]];
    if (c) {
      l.push([t("adresse"), '<a href="' + esc(webExplo("/address/" + c.adresse)) + '" target="_blank" class="mono">' + esc(c.adresse) + "</a>"]);
      l.push([motSimple("empreinte", t("empreinte_alea")), '<span class="mono" style="font-size:12px">' + esc(c.empreinte_alea) + "</span>"]);
      l.push([motSimple("cri", t("le_cri")), now < k.t17 ? t("cri_attend", { d: fdate(k.t17 + 3600, true) }) : '<a target="_blank" href="' + esc(webExplo("/tx/" + c.cri_txid)) + '" class="mono">' + esc(String(c.cri_txid).slice(0, 16)) + "…</a>"]);
    }
    var en = enigmesParues().filter(function (e) { return e.coffre === n; });
    return '<div class="sur"><a href="#/tableau">← ' + esc(t("m_tableau")) + '</a></div><div style="display:flex;gap:18px;align-items:center;margin:8px 0 14px">' + coffreSvg(k.etat, 80) +
      '<div><h1>' + esc(t("tresor_n", { n: n })) + '</h1><div class="' + (k.etat === "a_prendre" ? "or" : k.etat === "en_chasse" ? "eau" : "doux") + '">' + esc(t("e_" + k.etat)) +
      (k.sats != null && k.etat !== "a_semer" ? " · " + fsats(k.sats) + " sats" : "") + "</div></div></div>" +
      '<div class="deux"><div class="cadre">' + l.map(function (x) { return '<div class="ligne"><span class="doux">' + (x[0].indexOf("<") >= 0 ? x[0] : esc(x[0])) + '</span><span class="v">' + (x[1].indexOf("<") >= 0 ? x[1] : esc(x[1])) + "</span></div>"; }).join("") +
      '</div><div class="cadre"><div class="sur">' + esc(t("ses_enigmes")) + "</div>" + (en.length ? en.map(function (e) { return '<div style="margin:10px 0"><span class="tag">' + esc(t("enigme_n", { n: e.numero })) + '</span><div class="cg" style="font-size:18px;white-space:pre-wrap;margin-top:6px">' + esc(texteEnigme(e)) + "</div>" + noteEnigme(e) + "</div>"; }).join("") : '<p class="doux">' + esc(t("aucune_parue")) + "</p>") +
      (k.etat === "a_prendre" || k.etat === "en_chasse" ? '<p><a class="bouton" href="#/chasser/' + n + '">' + esc(t("chasser_ce")) + "</a></p>" : "") + "</div></div>" + blocCoffret(n, 1);
  }
  // les verrous d'un coffre (sauf ses enigmes, montrees plus haut) : son cri, ses deux indices ; puis la solution, si l'auteur l'a publiee
  // apres la prise par un message signe (verifiee contre l'engagement grave au semis, jamais recopiee dans les reponses)
  function blocCoffret(n, h) {
    var Z = h === 1 ? MP : ZS[h];
    if (!Z || !Z.coffret) return "";
    var out = "";
    elementsDe(Z).filter(function (e) { return e.coffre === n && e.type !== "enigme"; }).sort(function (a, b) { return a.ouverture_utc - b.ouverture_utc; }).forEach(function (e) {
      var c = contenuDe(Z, e), nom = t(e.type === "indice" ? "v_indice_" + e.rang : "v_" + e.type);
      if (!c) { out += '<div class="ligne"><span>' + chipDe(Z, e, nom) + '</span><span class="doux">' + esc(t("s_ouvre_le", { d: fdate(e.ouverture_utc, true) })) + "</span></div>"; return; }
      if (e.type === "cri") out += '<div class="ligne"><span>' + chipDe(Z, e, nom) + '</span><span class="v"><span class="mono" style="font-size:12px">' + esc(String(c.txid).slice(0, 16)) + '…</span>' +
        (h === 1 ? ' <button class="bouton2" style="padding:3px 10px;font-size:11px" data-diffuser="' + n + '">' + esc(t("diffuser_cri")) + "</button>" : "") + "</span></div>";
      if (e.type === "indice") out += '<div class="ligne"><span>' + chipDe(Z, e, nom) + '</span><span class="v cg" style="font-size:17px;white-space:pre-wrap;text-align:left">' + esc(texteEnigme(c)) + "</span></div>";
    });
    solutionsSignees().filter(function (s) { return s.h === h && s.c === n; }).forEach(function (s) {
      out += '<div class="ligne"><span><span class="chip ch-ouvert">✓ ' + esc(t("sol_titre")) + '</span></span><span class="v">' + badgeSolution(s) + ' <a href="#/messages">' + esc(fdateIso(s.m.date)) + "</a></span></div>";
    });
    return out ? '<h2>' + esc(t("m_coffret")) + aide("coffret") + '</h2><div class="cadre">' + out + "</div>" : "";
  }
  // le lien vers l'explorateur : seulement les hotes exacts prevus (mempool.space, blockstream.info, et leurs reseaux d'essai), sinon mempool.space
  function webExplo(ch) {
    var u = null; try { u = new URL(R.explo); } catch (e) { }
    var ok = u && u.protocol === "https:" && (u.hostname === "mempool.space" || u.hostname === "blockstream.info") && /^(\/(signet|testnet|testnet4))?\/api\/?$/.test(u.pathname);
    return (ok ? u.origin + u.pathname.replace(/\/api\/?$/, "") : "https://mempool.space") + ch;
  }
  function texteEnigme(e) { return R.lang === "fr" ? e.texte_fr : (e.texte_en || e.texte_fr); }

  // ------------------------------------------------------------------ 3. les enigmes
  function pageEnigmes() {
    var pub = enigmesParues().slice().reverse(), pro = prochaine(), now = maintenant();
    var tete = '<div class="sur">' + esc(t("les_48")) + " · " + motSimple("coffret") + '</div><h1>' + esc(t("m_enigmes")) + aide("enigmes") + "</h1>";
    // la prochaine enigme, toutes chasses confondues : avant le 3 janvier 2027, c'est l'une des deux de la chasse zero (3 et 17 novembre 2026, article 8 bis)
    var cpt = compteProchaine(pro, now) ? '<div class="cadre" style="margin:14px 0"><div class="sur">' + esc(t("prochaine_enigme")) + "</div>" + compteProchaine(pro, now) + "</div>" : "";
    var note = R.lang !== "fr" ? '<p class="doux">' + esc(t("fr_fait_foi")) + "</p>" : "";
    var l = pub.length ? pub.map(function (e) {
      return '<div class="cadre enigme"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><span class="tag" style="white-space:nowrap">' + esc(t("enigme_n", { n: e.numero })) + '</span><a href="#/coffre/' + esc(e.coffre) + '" style="white-space:nowrap">' + esc(t("coffre_n", { n: e.coffre })) +
        '</a><span class="doux" style="font-size:12px">' + esc(fdate(e.date_utc, true)) + '</span></div><div class="txt">' + esc(texteEnigme(e)) + "</div>" + noteEnigme(e) +
        (R.lang !== "fr" && e.texte_fr ? '<details style="margin-top:8px"><summary class="doux">' + esc(t("texte_francais")) + '</summary><div class="cg" style="font-size:17px;white-space:pre-wrap">' + esc(e.texte_fr) + "</div></details>" : "") + "</div>";
    }).join("") : '<div class="cadre"><p>' + esc(t("aucune_enigme", { d: fdate(dateEnigme(1), true) })) + '</p><p class="doux">' + esc(t("regle_enigmes")) + "</p></div>";
    return tete + cpt + note + l;
  }

  // ------------------------------------------------------------------ 4. verifier
  var V = { res: null, enCours: false };
  function pageVerifier() {
    var l = V.res ? V.res.map(function (r) {
      var ic = r.e === "ok" ? '<span class="ok">✓</span>' : r.e === "ko" ? '<span class="ko">✗</span>' : '<span class="att">…</span>';
      return '<div class="verif"><div class="ic">' + ic + '</div><div><div class="t">' + esc(r.t) + '</div><div class="d">' + esc(r.d) + "</div></div></div>";
    }).join("") : '<p class="doux">' + esc(t("verif_intro")) + "</p>";
    var bilan = "";
    if (V.res && !V.enCours) {
      var ko = V.res.filter(function (r) { return r.e === "ko"; }).length, ok = V.res.filter(function (r) { return r.e === "ok"; }).length, att = V.res.length - ko - ok;
      bilan = '<div class="bandeau' + (ko ? '" style="border-color:#e0605a;background:rgba(224,96,90,.15)' : '') + '">' + esc(ko ? t("verif_ko", { n: ko }) : t(ok === 1 ? "verif_ok1" : "verif_ok", { n: ok }) + (att ? " " + t("verif_att", { n: att }) : "")) + ' <a href="#" id="rapport">' + esc(t("exporter")) + "</a></div>";
    }
    var titre = t("tout_verifier"), sous = "";
    if (V.res && !V.enCours) { var nko = V.res.filter(function (r) { return r.e === "ko"; }).length; titre = nko ? t("v_titre_ko") : V.res.some(function (r) { return r.e !== "ok"; }) ? t("v_titre_att") : t("v_titre_ok"); sous = '<p class="doux" style="margin:0 0 8px">' + esc(t("v_sous")) + "</p>"; }
    return '<div class="sur">' + esc(t("ne_croire_personne")) + '</div><div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><h1>' + esc(titre) + aide("verifier") +
      '</h1><button class="bouton" id="lancer"' + (V.enCours ? " disabled" : "") + ">" + esc(V.enCours ? t("verif_en_cours") : V.res ? t("v_relancer") : t("lancer_verif")) + "</button></div>" + sous + bilan + '<div class="cadre" style="margin-top:12px">' + l + "</div>";
  }

  function opReturn(vouts) {
    for (var i = 0; i < (vouts || []).length; i++) {
      var s = vouts[i].scriptpubkey || ""; if (s.slice(0, 2) !== "6a") continue;
      var b = C.deHex(s), op = b[1], d;
      if (op > 0 && op <= 75) d = b.slice(2, 2 + op); else if (op === 0x4c) d = b.slice(3, 3 + b[2]); else if (op === 0x4d) d = b.slice(4, 4 + (b[2] | b[3] << 8)); else continue;
      return d;
    }
    return null;
  }
  function ascii(b) { var s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }

  function verifier() {
    if (V.enCours) return;
    V.enCours = true; V.res = []; rendre();
    if (R.demo) {
      return window.GG_DEMO.verifications(t).reduce(function (p, r) { return p.then(function () { return new Promise(function (ok) { setTimeout(function () { V.res.push(r); rendre(); ok(); }, 260); }); }); }, Promise.resolve())
        .then(function () { V.enCours = false; rendre(); });
    }
    var now = maintenant(), et = M.etat, man = M.manifeste;
    function ajoute(tt, e, d) { V.res.push({ t: tt, e: e, d: d }); rendre(); }
    var etapes = [];
    // 1. la Pierre
    etapes.push(function () {
      var h = C.sha256hex(window.GG_PIERRE.texte), okLocal = h === window.GG_PIERRE.sha256;
      if (!okLocal) return ajoute(t("v_pierre"), "ko", t("v_pierre_alteree"));
      if (!et) return ajoute(t("v_pierre"), "att", t("v_pierre_seule", { h: h.slice(0, 16) }));
      ajoute(t("v_pierre"), et.empreinte_pierre === h ? "ok" : "ko", et.empreinte_pierre === h ? t("v_pierre_ok", { h: h.slice(0, 16) }) : t("v_pierre_diff", { a: String(et.empreinte_pierre).slice(0, 16), b: h.slice(0, 16) }));
    });
    // 2. la liste des cinq mille
    etapes.push(function () {
      var h = C.sha256hex(window.GG_LISTE.texte), ok = h === LISTE_SHA && (!et || !et.empreinte_liste || et.empreinte_liste === h);
      ajoute(t("v_liste"), ok ? "ok" : "ko", ok ? t("v_liste_ok", { h: h.slice(0, 16) }) : t("v_liste_ko"));
    });
    // 3. les enigmes et le calendrier
    etapes.push(function () {
      if (!et) return ajoute(t("v_calendrier"), "att", t("v_sans_caisse"));
      var fautes = (et.enigmes || []).filter(function (e) { return e.date_utc !== dateEnigme(e.numero) || e.coffre !== coffreDe(e.numero) || e.date_utc > now + 5; });
      ajoute(t("v_calendrier"), fautes.length ? "ko" : "ok", fautes.length ? t("v_calendrier_ko", { l: fautes.map(function (e) { return e.numero; }).join(", ") }) : t("v_calendrier_ok", { n: (et.enigmes || []).length }));
    });
    // 4. le manifeste
    etapes.push(function () {
      if (!man) return ajoute(t("v_manifeste"), "att", t("v_avant_semis"));
      var h = C.sha256hex(M.manifTexte), adrOk = man.coffres.length === 24 && man.coffres.every(function (c, i) { return c.n === i + 1 && C.adresseValide(c.adresse); });
      var memes = !et || man.coffres.every(function (c, i) { return et.coffres && et.coffres[i] && et.coffres[i].adresse === c.adresse; });
      var euros = man.coffres.every(function (c, i) { return !c.euros_depart || c.euros_depart === EUROS[i]; });
      var ok = (!et || h === et.empreinte_manifeste) && adrOk && memes && euros;
      ajoute(t("v_manifeste"), ok ? "ok" : "ko", ok ? t("v_manifeste_ok", { h: h.slice(0, 16) }) : t("v_manifeste_ko"));
    });
    // 5. la gravure du manifeste (depensee depuis le rendu de l'amorce, sortie 48)
    etapes.push(function () {
      if (!man) return ajoute(t("v_gravure"), "att", t("v_avant_semis"));
      var h = C.sha256hex(M.manifTexte);
      return explo("/tx/" + man.amorce.txid + "/outspend/" + (man.amorce.vout_rendu || 48)).then(function (o) {
        if (!o || !o.spent) return ajoute(t("v_gravure"), "att", t("v_gravure_attente"));
        return explo("/tx/" + o.txid).then(function (tx) {
          var d = tx && opReturn(tx.vout), s = d ? ascii(d) : "";
          ajoute(t("v_gravure"), s === "AEDE:manifeste:" + h ? "ok" : "ko", s === "AEDE:manifeste:" + h ? t("v_gravure_ok", { tx: o.txid.slice(0, 16) }) : t("v_gravure_ko", { s: s.slice(0, 40) }));
        });
      });
    });
    // 6. l'amorce : les 24 cris et les 24 coffres semes
    etapes.push(function () {
      if (!man) return ajoute(t("v_amorce"), "att", t("v_avant_semis"));
      return explo("/tx/" + man.amorce.txid).then(function (tx) {
        if (!tx) return ajoute(t("v_amorce"), "ko", t("v_amorce_absente"));
        var mpc = man.amorce.montant_par_cri, cris = (mpc == null || mpc === CRI_SATS) && tx.vout.slice(0, 24).every(function (v) { return v.value === CRI_SATS; });
        var semes = man.coffres.every(function (c, i) { var v = tx.vout[24 + i]; return v && v.scriptpubkey_address === c.adresse && (!c.sats_semes || v.value === c.sats_semes); });
        var ok = cris && semes && tx.status && tx.status.confirmed;
        ajoute(t("v_amorce"), ok ? "ok" : tx.status && !tx.status.confirmed ? "att" : "ko", ok ? t("v_amorce_ok") : tx.status && !tx.status.confirmed ? t("v_non_confirmee") : t("v_amorce_ko"));
      });
    });
    // 7. les cris parus
    etapes.push(function () {
      if (!man) return ajoute(t("v_cris"), "att", t("v_avant_semis"));
      var dus = man.coffres.filter(function (c) { return dateEnigme(2 * c.n) + 3600 < now; });
      if (!dus.length) return ajoute(t("v_cris"), "att", t("v_cris_aucun"));
      var bons = 0, manquants = [], faux = [];
      return parLots(dus, 3, function (c) {
        return explo("/tx/" + c.cri_txid).then(function (tx) {
          if (!tx) { if (dateEnigme(2 * c.n) + 7 * 86400 < now) faux.push(c.n); else manquants.push(c.n); return; }
          var s = ascii(opReturn(tx.vout) || []), m = /^AEDE:cri:(\d+):([0-9a-f]{64})$/.exec(s);
          if (m && +m[1] === c.n && GGR.aleaTenu(man, c.n, m[2]) && tx.locktime === c.cri_verrou) bons++; else faux.push(c.n);
        });
      }).then(function () {
        ajoute(t("v_cris"), faux.length ? "ko" : manquants.length ? "att" : "ok", faux.length ? t("v_cris_ko", { l: faux.join(", ") }) : t("v_cris_ok", { n: bons, m: manquants.length ? t("v_cris_attendus", { l: manquants.join(", ") }) : "" }));
      });
    });
    // 8. les versements
    etapes.push(function () {
      var vs = (et && et.versements) || [];
      if (!vs.length) return ajoute(t("v_versements"), "att", t("v_versements_aucun"));
      var fautes = [], adr = {}; (man ? man.coffres : []).forEach(function (c) { adr[c.adresse] = c.n; });
      return parLots(vs, 2, function (v) {
        return explo("/tx/" + v.txid).then(function (tx) {
          if (!tx || !(tx.status && tx.status.confirmed)) { fautes.push(v.trimestre + " (" + t("non_confirme") + ")"); return; }
          var d = opReturn(tx.vout), s = d ? ascii(d.slice(0, 21)) : "";
          if (s !== "AEDE:registre:" + v.trimestre + ":") fautes.push(v.trimestre + " (registre)");
          tx.vout.forEach(function (o) { var n = adr[o.scriptpubkey_address]; if (n && dateEnigme(2 * n) - 8 * 86400 < tx.status.block_time) fautes.push(v.trimestre + " → " + t("coffre_n", { n: n })); });
        });
      }).then(function () { ajoute(t("v_versements"), fautes.length ? "ko" : "ok", fautes.length ? fautes.join(" ; ") : t("v_versements_ok", { n: vs.length })); });
    });
    // 9. les coffres lus sur la chaine
    etapes.push(function () {
      if (!man) return ajoute(t("v_coffres"), "att", t("v_avant_semis"));
      var lus = Object.keys(M.soldes || {}).length, pris = coffres().filter(function (k) { return k.etat === "pris"; }).length;
      ajoute(t("v_coffres"), lus === 24 ? "ok" : "att", t("v_coffres_ok", { n: lus, p: pris }));
    });
    // 11. le COFFRET : la regle de lecture de la Cave (empreinte du manifeste grave, types, doublons, heures, rondes) ; ce que la librairie
    // publie est ce qu'il a ouvert ici
    etapes.push(function () {
      if (!man || !man.coffret) return ajoute(t("v_coffret"), "att", t("v_coffret_avant"));
      if (!MP.coffret) return ajoute(t("v_coffret"), "ko", MP.coffretErreur && MP.coffretErreur !== "absent" ? t(messageCoffret(MP.coffretErreur)) : t("v_coffret_absent"));
      var ecarts = enigmesParues().filter(function (e) { return e.ecart; }).map(function (e) { return e.numero; });
      var ouv = elements().filter(function (e) { return MP.ouverts[cleV(e)] != null; }).length;
      ajoute(t("v_coffret"), ecarts.length ? "ko" : MP.grave === "ok" ? "ok" : "att", ecarts.length ? t("v_coffret_ecart", { l: ecarts.join(", ") }) :
        MP.grave === "ok" ? t("v_coffret_ok", { h: man.coffret.sha256.slice(0, 16), o: ouv, n: elements().length }) : t(MP.grave === "signature" ? "coffret_signature_ko" : "coffret_gravure_attente"));
    });
    // 11 bis. chaque chasse suivie (la chasse zero, et chaque chasse annoncee et verifiee) : une ligne chacune (friction 8)
    Object.keys(ZS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (h) {
      etapes.push(function () { return verifierChasse(ZS[h], now).then(function (r) { ajoute(r.t, r.e, r.d); }); });
    });
    // 12. les messages de l'auteur : bien formes (date AAAA-MM-JJ), bien signes, par l'adresse de l'auteur ; les solutions publiees tiennent l'engagement
    etapes.push(function () {
      var l = MP.messages || [];
      if (!l.length) return ajoute(t("v_messages"), "att", t("msg_aucun"));
      var faux = l.filter(function (m) { return !m.valide || (MP.adresseAncree && m.adresse !== MP.adresseAncree); }).length;
      var sols = solutionsSignees(), solFausses = sols.filter(function (s) { return s.tenu === false; }).length;
      var d = faux ? t("v_messages_ko", { n: faux }) : t(MP.adresseAncree ? "v_messages_ok" : "v_messages_sans_ancre", { n: l.length });
      if (sols.length) d += " " + t(solFausses ? "v_solutions_ko" : "v_solutions_ok", { n: sols.length, f: solFausses });
      ajoute(t("v_messages"), faux || solFausses ? "ko" : MP.adresseAncree ? "ok" : "att", d);
    });
    // 13. le registre des exemplaires, recompte trimestre par trimestre (racine de Merkle RFC 6962)
    etapes.push(function () {
      var vs = (et && et.versements) || [];
      if (!vs.length) return ajoute(t("v_registre"), "att", t("v_versements_aucun"));
      var base = R.caisse.replace(/\/$/, ""), faux = [], n = 0;
      return parLots(vs, 2, function (v) {
        return Promise.all([lire(base + "/api/registre/" + v.trimestre + ".json"), explo("/tx/" + v.txid)]).then(function (r) {
          var d = r[1] && opReturn(r[1].vout), rac = r[0] && Array.isArray(r[0].ventes) && GGR.racineRegistre(r[0].ventes.map(function (y) { return y && y.empreinte; }));
          if (!rac || !d || ascii(d.slice(0, 21)) !== "AEDE:registre:" + v.trimestre + ":" || C.hex(d.slice(21, 53)) !== rac) faux.push(v.trimestre); else n += r[0].ventes.length;
        });
      }).then(function () { ajoute(t("v_registre"), faux.length ? "ko" : "ok", faux.length ? t("v_registre_ko", { l: faux.join(", ") }) : t("v_registre_ok", { n: n })); });
    });
    // 10. ce programme : la version publiee est designee par un message signe de l'auteur qui en donne l'empreinte (Pierre, article 13) ;
    // aucune gravure ne la designe (AEDE:auteur est le sceau de l'auteur, Pierre annexe C)
    etapes.push(function () {
      var e = window.GG_EMPREINTE, o = officiel();
      if (WEB) return ajoute(t("v_programme"), "att", t("v_programme_web", { h: e.empreinte.slice(0, 16) }));   // contre-audit N3
      if (o.etat === "officiel") return ajoute(t("v_programme"), "ok", t("v_programme_signe", { h: e.empreinte.slice(0, 16), d: fdateIso(o.date) }));
      if (o.etat === "essai") return ajoute(t("v_programme"), "att", t("v_programme_essai", { h: e.empreinte.slice(0, 16) }));
      ajoute(t("v_programme"), "ko", o.etat === "retiree" ? t("prog_retire") : t("prog_inconnu", { v: o.derniere }));
    });
    // 14. les deux sources de la chaine
    etapes.push(function () {
      var s = sources();
      if (s.length < 2) return ajoute(t("v_sources"), "att", t("v_sources_une"));
      return explo("/blocks/tip/height", true).then(function () {
        ajoute(t("v_sources"), M.src.ecarts.length ? "ko" : M.src.etat === 2 ? "ok" : "att", M.src.ecarts.length ? t("v_sources_ko", { l: M.src.ecarts.join(", ") }) : M.src.etat === 2 ? t("v_sources_ok", { a: hote(s[0]), b: hote(s[1]) }) : t("v_sources_une"));
      });
    });
    return etapes.reduce(function (p, f) { return p.then(function () { return Promise.resolve().then(f).catch(function (e) { ajoute("…", "ko", String(e.message || e)); }); }); }, Promise.resolve())
      .then(function () { V.enCours = false; rendre(); publierConstat(); });
  }
  // « Tout vérifier », une ligne par chasse suivie : le manifeste prouve grave (et signe, si l'adresse de l'auteur est epinglee),
  // le COFFRET lu selon la regle de la Cave et ce qui en est ouvert, et chaque cri du sur la chaine, son alea engage par le manifeste
  function verifierChasse(Z, now) {
    var nom = Z.h === 0 ? t("cz_titre") : (CHASSES[Z.h] && CHASSES[Z.h].nom) || "", tt = t("v_chasse", { n: Z.h }) + (nom ? " · " + nom : "");
    function r(e, d) { return Promise.resolve({ t: tt, e: e, d: d }); }
    if (!Z.etat) return r("att", t("v_chasse_avant"));
    if (Z.erreur) return r("ko", t(messageCoffret(Z.erreur)));
    if (Z.grave !== "ok") return r("att", t(Z.grave === "signature" ? "coffret_signature_ko" : "coffret_gravure_attente"));
    if (!Z.coffret || !Z.man) return r("att", t("v_coffret_absent"));
    var ouv = elementsDe(Z).filter(function (e) { return Z.ouverts[cleV(e)] != null; }).length, bons = 0, faux = [], attendus = [];
    var dus = Z.man.coffres.filter(function (k) { return heureZ(k.n, 17, Z) + 3600 + 300 < now; });
    return parLots(dus, 3, function (k) {
      if (!/^[0-9a-f]{64}$/.test(String(k.cri_txid || ""))) { attendus.push(k.n); return Promise.resolve(); }
      return explo("/tx/" + k.cri_txid).then(function (tx) {
        if (!tx) { if (heureZ(k.n, 17, Z) + 7 * 86400 < now) faux.push(k.n); else attendus.push(k.n); return; }
        var s = ascii(opReturn(tx.vout) || []), mq = "AEDE:cri:H" + Z.h + ":" + k.n + ":";
        if (s.indexOf(mq) === 0 && GGR.aleaTenu(Z.man, k.n, s.slice(mq.length)) && (k.cri_verrou == null || tx.locktime === k.cri_verrou)) bons++; else faux.push(k.n);
      }, function () { attendus.push(k.n); });
    }).then(function () {
      if (faux.length) return { t: tt, e: "ko", d: t("v_cris_ko", { l: faux.join(", ") }) };
      return { t: tt, e: attendus.length ? "att" : "ok", d: t("v_chasse_ok", { o: ouv, n: elementsDe(Z).length, c: bons }) + (attendus.length ? t("v_cris_attendus", { l: attendus.join(", ") }) : "") };
    });
  }
  function rapport() {
    var l = ["GodGift Core " + VERSION + " · " + t("rapport_titre"), new Date().toISOString(), t("empreinte_programme") + " : " + window.GG_EMPREINTE.empreinte,
      t("chaine") + " : " + R.explo + " · " + t("librairie") + " : " + R.caisse + (R.demo ? " · " + t("demo_court") : ""), ""];
    V.res.forEach(function (r) { l.push((r.e === "ok" ? "[OK] " : r.e === "ko" ? "[ECHEC] " : "[ATTENTE] ") + r.t + " : " + r.d); });
    telecharger("rapport_godgift_" + new Date().toISOString().slice(0, 10) + ".txt", l.join("\r\n"));
  }
  function telecharger(nom, texte) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texte], { type: "text/plain;charset=utf-8" })); a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ 5. chasser
  var ESSAIS = [
    { id: "A", n: 1, nom: "essai_A", alea: C.sha256hex("EXEMPLE DU MODE D EMPLOI - jamais une vraie chasse"), adresse: "bc1qhsml20xzevmqml9nvz9pw8p3ue5tj3z96ffq95",
      e3: "Le jour, il brûle sans jamais se montrer deux fois au même endroit du ciel. La nuit, elle emprunte sa lumière et ne la rend jamais. Moi, je vous les rends tous les deux, à l'envers, sans rien garder. Qui sommes-nous ?",
      e17: "Dans nos contes, il porte une pierre rouge au front, et il la pose sur la berge avant de descendre boire. Nommez celui qui rampe, ce qu'il dépose, et ce qu'il boit." },
    { id: "B", n: 11, nom: "essai_B", alea: C.sha256hex("COFFRE D ESSAI B - jamais une vraie chasse"), adresse: "bc1q04c3p5gr07q6n0hg6gesucw2m73388248v4x7t",
      e3: "L'oiseau m'a donné de quoi écrire ; la seiche, de quoi noircir ; l'arbre, de quoi tourner. Et à la fin, relié, je deviens tout autre chose. Quatre mots.",
      e17: "Deux points cardinaux qui se tournent le dos, celle qui guide le marin quand la nuit tombe, et ce qu'on dessine pour ne pas se perdre. Quatre mots." }];
  var H = { choix: "A", calcul: null, res: null, alea: {}, prog: 0 };
  function plier(s) { return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae"); }
  var INDEX = null;
  function index() {
    if (INDEX) return INDEX; INDEX = { mot: {}, plie: {} };
    window.GG_LISTE.mots.forEach(function (m, i) { INDEX.mot[m] = i + 1; var p = plier(m); (INDEX.plie[p] = INDEX.plie[p] || []).push(i + 1); });
    return INDEX;
  }
  function lireReponse(s, m) {   // "873 clef 4410" -> {nums, erreurs}
    var ix = index(), nums = [], err = [];
    s.split(/[\s,;]+/).filter(Boolean).forEach(function (x) {
      if (/^\d{1,4}$/.test(x)) { var v = +x; if (v >= 1 && v <= 5000) nums.push(v); else err.push(x); }
      else if (ix.mot[x.toLowerCase()]) nums.push(ix.mot[x.toLowerCase()]);
      else { var p = ix.plie[plier(x)]; if (p && p.length === 1) nums.push(p[0]); else err.push(x + (p ? " (" + p.map(function (k) { return String(k).padStart(4, "0") + " " + window.GG_LISTE.mots[k - 1]; }).join(" / ") + " ?)" : "")); }
    });
    if (!err.length && nums.length !== m) err.push(t("il_faut_mots", { m: m }));
    if (!err.length && new Set(nums).size !== nums.length) err.push(t("mots_distincts"));
    return { nums: nums, err: err };
  }
  function cibleChasse() {
    var e = ESSAIS.filter(function (x) { return x.id === H.choix; })[0];
    if (e) return { n: e.n, type: TYPES[e.n - 1], alea: e.alea, adresse: e.adresse, essai: e };
    var n = parseInt(H.choix, 10), k = coffres()[n - 1];
    if (!k || !k.c) return null;
    return { n: n, type: k.type, alea: H.alea[n] || aleaDuCoffret(n) || "", adresse: k.c.adresse };
  }
  function pageChasser(arg) {
    if (arg) { H.choix = arg; H.res = null; }
    var cs = coffres(), opts = ESSAIS.map(function (e) { return [e.id, t(e.nom)]; });
    cs.forEach(function (k) { if (k.c && (k.etat === "a_prendre" || k.etat === "en_chasse")) opts.push([String(k.n), t("coffre_n", { n: k.n }) + " · " + t("e_" + k.etat)]); });
    var c = cibleChasse(), m = c ? MOTS[c.type] : 3;
    var sel = '<select class="champ" id="h-choix">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === H.choix ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
    var enig = "";
    if (c && c.essai) enig = '<div class="cadre" style="margin:12px 0"><span class="tag">' + esc(t("enigme_du_3")) + '</span><div class="cg" style="font-size:18px;margin:6px 0 12px">' + esc(c.essai.e3) + '</div><span class="tag">' + esc(t("enigme_du_17")) + '</span><div class="cg" style="font-size:18px;margin-top:6px">' + esc(c.essai.e17) + '</div><p class="doux" style="font-size:12px">' + esc(t("essai_note")) + "</p></div>";
    else if (c) enig = '<p class="doux">' + esc(t("vrai_coffre_note")) + ' <a href="#/coffre/' + c.n + '">' + esc(t("voir_enigmes")) + "</a></p>";
    var alea = c && !c.essai ? '<label>' + esc(t("alea_du_cri")) + '</label><input class="champ mono" id="h-alea" autocomplete="off" spellcheck="false" value="' + esc(c.alea) + '" placeholder="' + esc(t("ph_64")) + '"><div class="doux" style="font-size:12px">' + esc(t("alea_note")) + ' <button class="bouton2" style="padding:2px 10px;font-size:11px" id="h-lire-cri">' + esc(t("lire_cri")) + "</button></div>" : "";
    var res = "";
    if (H.calcul) res = '<div style="margin-top:12px"><div class="barre"><i style="width:' + Math.round(H.prog * 100) + '%"></i></div><div class="doux" style="font-size:12px;margin-top:4px">' + esc(t("calcul_en_cours")) + "</div></div>";
    else if (H.res) res = H.res;
    return '<div class="sur">' + esc(t("outil_chasseur")) + '</div><h1>' + esc(t("m_chasser")) + aide("chasser") + '</h1><div class="bandeau">' + esc(t("chasser_intro")) + "</div>" + carteTresor(null) + '<div class="deux"><div><label>' + esc(t("quel_coffre")) + "</label>" + sel + enig + alea + carteArmement(c) + jamais(true) +
      "</div><div class=\"cadre\"><label>" + esc(t("reponse_3", { m: m })) + '</label><input class="champ" id="h-r3" autocomplete="off" spellcheck="false"><div class="doux mono" id="h-v3" style="font-size:12px;min-height:18px"></div><label>' + esc(t("reponse_17", { m: m })) +
      '</label><input class="champ" id="h-r17" autocomplete="off" spellcheck="false"><div class="doux mono" id="h-v17" style="font-size:12px;min-height:18px"></div><p><button class="bouton" id="h-calculer"' + (H.calcul ? " disabled" : "") + ">" + esc(t("calculer")) + '</button></p><p class="doux" style="font-size:12px">' + esc(t("calcul_note")) + "</p>" + res + "</div></div>" +
      '<h2>' + esc(t("dictionnaire")) + '</h2><div class="cadre"><input class="champ" id="h-dico" autocomplete="off" spellcheck="false" placeholder="' + esc(t("dico_ph")) + '"><div id="h-dico-r" class="mono" style="margin-top:8px;min-height:20px"></div></div>';
  }
  function apercu(id, vid) {
    var c = cibleChasse(); if (!c) return; var m = MOTS[c.type], v = $(id).value, r = lireReponse(v, m);
    $(vid).innerHTML = !v.trim() ? "" : r.err.length ? '<span class="ko">' + esc(r.err.join(" · ")) + "</span>" : '<span class="ok">' + r.nums.map(function (x) { return String(x).padStart(4, "0") + " " + esc(window.GG_LISTE.mots[x - 1]); }).join(" · ") + "</span>";
  }
  function calculer() {
    var c = cibleChasse(); if (!c) return; var m = MOTS[c.type];
    var r3 = lireReponse($("h-r3").value, m), r17 = lireReponse($("h-r17").value, m);
    if (!c.essai) { var a = ($("h-alea").value || "").trim().toLowerCase(); H.alea[c.n] = a; c.alea = a; }
    if (r3.err.length || r17.err.length) { H.res = '<p class="ko">' + esc(t("reponse_incomplete")) + "</p>"; return rendre(); }
    if (!/^[0-9a-f]{64}$/.test(c.alea)) { H.res = '<p class="ko">' + esc(t("alea_invalide")) + "</p>"; return rendre(); }
    // l'alea tape ou lu doit etre celui que le manifeste grave engage (audit protocole M3) : un faux cri ne fait pas perdre dix secondes
    if (!c.essai && !GGR.aleaTenu(M.manifeste, c.n, c.alea)) { H.res = '<p class="ko">' + esc(t("alea_faux")) + "</p>"; return rendre(); }
    var ch = C.chaineCoffre(c.n, r3.nums, r17.nums, c.alea), v3 = $("h-r3").value, v17 = $("h-r17").value;
    H.calcul = true; H.prog = 0; H.res = null; rendre(); $("h-r3").value = v3; $("h-r17").value = v17; apercu("h-r3", "h-v3"); apercu("h-r17", "h-v17");
    C.cleCoffre(c.n, ch, function (p) { H.prog = p; var b = document.querySelector(".barre i"); if (b) b.style.width = Math.round(p * 100) + "%"; }).then(function (k) {
      var adr = C.adresseDeCle(k);
      if (adr === c.adresse) H.res = apresTrouve(c, k);
      else {
        H.res = '<div class="cadre" style="margin-top:12px"><div class="ko">✗ ' + esc(t("pas_la_cle")) + '</div><p class="doux mono" style="font-size:12px">' + esc(t("adresse_obtenue")) + " " + esc(adr) + "<br>" + esc(t("adresse_attendue")) + " " + esc(c.adresse) + "</p></div>";
      }
    }, function (e) { H.res = '<p class="ko">' + esc(e.message === "memoire" ? t("memoire") : String(e.message || e)) + "</p>"; }).then(function () {
      H.calcul = false; rendre(); $("h-r3").value = v3; $("h-r17").value = v17; apercu("h-r3", "h-v3"); apercu("h-r17", "h-v17");
    });
  }


  // ================================================================== LES TEMOINS (Nostr)
  // Un temoin volontaire publie, apres chaque verification, un constat signe par une cle jetable propre a cette installation :
  // le bloc, les empreintes du manifeste, du COFFRET et du programme, et le resultat. Rien de personnel : ni nom, ni adresse,
  // ni reponse. Le relais Nostr voit l'adresse IP de celui qui publie : c'est pourquoi c'est un choix, jamais une obligation.
  var RELAIS_DEF = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://relay.nostr.band"];
  var TE = { lu: null, enCours: false, publie: lireR("te_dernier", 0), dernierEtat: null };
  function relais() { var l = Array.isArray(R.relais) && R.relais.length ? R.relais : RELAIS_DEF; return l.filter(function (u) { return /^wss:\/\/|^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u + "/"); }).slice(0, 8); }
  function cleTemoin() {   // une cle par semaine, tiree d'un secret local : les constats d'une semaine ne se relient pas a ceux de la suivante
    var s = lireR("nostr_secret", null);
    if (!/^[0-9a-f]{64}$/.test(s || "")) { var b = new Uint8Array(32); crypto.getRandomValues(b); s = C.hex(b); ecrireR("nostr_secret", s); }
    var semaine = Math.floor(Date.now() / 604800000), k = C.hmac256(C.deHex(s), C.utf8("AEDE-temoin-" + semaine));
    while (BigInt("0x" + C.hex(k)) === 0n || BigInt("0x" + C.hex(k)) >= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n) k = C.sha256(k);
    return k;
  }
  function evenementId(ev) { return C.sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])); }
  function signerEvenement(ev) {
    var k = cleTemoin(), aux = new Uint8Array(32); crypto.getRandomValues(aux);
    ev.pubkey = C.hex(window.GGTL.schnorrPublique(k));
    var id = evenementId(ev); ev.id = C.hex(id); ev.sig = C.hex(window.GGTL.schnorrSigner(id, k, aux));
    return ev;
  }
  function entierNostr(x) { return typeof x === "number" && Number.isInteger(x) && x > 0; }
  function evenementValide(ev) {
    try {
      if (!ev || !/^[0-9a-f]{64}$/.test(ev.id) || !/^[0-9a-f]{64}$/.test(ev.pubkey) || !/^[0-9a-f]{128}$/.test(ev.sig)) return false;
      if (C.hex(evenementId(ev)) !== ev.id) return false;
      return window.GGTL.schnorrVerifier(C.deHex(ev.sig), C.deHex(ev.id), C.deHex(ev.pubkey));
    } catch (e) { return false; }
  }
  function prise(url, envoi, surMessage, duree) {   // une connexion courte a un relais : on envoie, on ecoute, on ferme
    return new Promise(function (fin) {
      var ws, fini = false, tm;
      function clore() { if (fini) return; fini = true; clearTimeout(tm); try { ws.close(); } catch (e) { } fin(); }
      try { ws = new WebSocket(url); } catch (e) { return fin(); }
      tm = setTimeout(clore, duree || 8000);
      ws.onopen = function () { envoi.forEach(function (m) { ws.send(JSON.stringify(m)); }); };
      ws.onmessage = function (m) { var d; try { d = JSON.parse(m.data); } catch (e) { return; } if (surMessage(d) === "fin") clore(); };
      ws.onerror = clore; ws.onclose = clore;
    });
  }
  function constat() {
    var r = V.res || [], ok = r.filter(function (x) { return x.e === "ok"; }).length, ko = r.filter(function (x) { return x.e === "ko" && x.t !== "…"; }).length;   // une panne de reseau n'est pas un desaccord
    var man = M.manifeste, emp = window.GG_EMPREINTE.empreinte;
    var tags = [["t", "godgiftcore"], ["t", "angedeleau"], ["aede", "1", String(M.hauteur || 0), man ? C.sha256hex(M.manifTexte || "") : "", man && man.coffret ? man.coffret.sha256 : "", emp, ko ? "ko" : "ok", String(ok), String(ko)], ["client", "GodGift Core " + VERSION]];
    var contenu = t("te_contenu", { b: fsats(M.hauteur || 0), ok: ok, ko: ko, e: emp.slice(0, 16) }) + "\n#GodGiftCore #AngeDeLEau";
    return { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: tags, content: contenu };
  }
  function publierConstat() {
    if (!R.temoin || R.demo || !V.res || V.enCours) return Promise.resolve();
    var ev = signerEvenement(constat()), acceptes = 0;
    return Promise.all(relais().map(function (u) {
      return prise(u, [["EVENT", ev]], function (d) { if (d[0] === "OK" && d[1] === ev.id) { if (d[2]) acceptes++; return "fin"; } });
    })).then(function () {
      TE.dernierEtat = { acceptes: acceptes, total: relais().length, id: ev.id, date: Date.now() };
      if (acceptes) { TE.publie = Date.now(); ecrireR("te_dernier", TE.publie); }
      if (route().p === "reseau" || route().p === "verifier") rendre();
    });
  }
  // Les temoins : chaque relais est lu avec une limite (500 messages), les signatures ne sont verifiees qu'ensuite et au plus 300 en tout
  // (Schnorr en JavaScript coute) : pour chaque cle, la plus recente d'abord, trois essais au plus. Un relais bavard ou menteur n'etouffe rien.
  var TEMOINS_PAR_RELAIS = 500, TEMOINS_VERIFIES = 300, TEMOINS_ESSAIS = 3;
  function lireTemoins(force) {
    if (R.demo || TE.enCours || (!force && TE.lu && Date.now() - TE.lu.date < 120000)) return;
    TE.enCours = true;
    var cand = {}, ids = {}, depuis = Math.floor(Date.now() / 1000) - 7 * 86400, sub = "gg" + Math.random().toString(36).slice(2, 10);
    Promise.all(relais().map(function (u) {
      var n = 0;
      return prise(u, [["REQ", sub, { kinds: [1], "#t": ["godgiftcore"], since: depuis, limit: TEMOINS_PAR_RELAIS }]], function (d) {
        if (d[0] === "EOSE" && d[1] === sub) return "fin";
        if (d[0] !== "EVENT" || d[1] !== sub) return;
        if (++n > TEMOINS_PAR_RELAIS) return "fin";
        var ev = d[2], a = ev && Array.isArray(ev.tags) && ev.tags.filter(function (x) { return Array.isArray(x) && x[0] === "aede" && x[1] === "1"; })[0];
        if (!a || !/^[0-9a-f]{64}$/.test(ev.pubkey) || !/^[0-9a-f]{64}$/.test(ev.id) || !entierNostr(ev.created_at) || ids[ev.id]) return;   // controles bon marche
        ids[ev.id] = true; (cand[ev.pubkey] = cand[ev.pubkey] || []).push(ev);
      });
    })).then(function () {
      var par = {}, budget = TEMOINS_VERIFIES;
      Object.keys(cand).forEach(function (pk) {
        var l = cand[pk].sort(function (x, y) { return y.created_at - x.created_at; }).slice(0, TEMOINS_ESSAIS);
        for (var i = 0; i < l.length && budget > 0; i++) {
          budget--;
          if (!evenementValide(l[i])) continue;
          var a = l[i].tags.filter(function (x) { return Array.isArray(x) && x[0] === "aede" && x[1] === "1"; })[0];
          par[pk] = { created_at: l[i].created_at, bloc: +a[2] || 0, man: a[3], cof: a[4], prog: a[5], v: a[6] }; break;
        }
      });
      var l = Object.keys(par).map(function (k) { return par[k]; }), off = {}, o = officiel();
      (MP.messages || []).forEach(function (m) { if (m.valide && MP.adresseAncree && m.adresse === MP.adresseAncree) { var re = /empreinte\s+([0-9a-f]{64})/g, x; while ((x = re.exec(m.texte))) off[x[1]] = 1; } });
      off[window.GG_EMPREINTE.empreinte] = off[window.GG_EMPREINTE.empreinte] || (o.etat === "essai" ? 1 : 0);
      var monMan = M.manifTexte ? C.sha256hex(M.manifTexte) : "", mans = {};
      l.forEach(function (x) { if (x.man) mans[x.man] = (mans[x.man] || 0) + 1; });
      TE.lu = { date: Date.now(), n: l.length, ko: l.filter(function (x) { return x.v === "ko"; }).length,
        autresMan: monMan ? l.filter(function (x) { return x.man && x.man !== monMan; }).length : 0,
        etrangers: l.filter(function (x) { return x.prog && !off[x.prog]; }).length, versions: Object.keys(l.reduce(function (s, x) { s[x.prog] = 1; return s; }, {})).length };
      TE.enCours = false; if (route().p === "reseau") rendre();
    }, function () { TE.enCours = false; });
  }
  function carteTemoins() {
    if (R.demo) return '<h2>' + esc(t("te_titre")) + aide("temoins") + '</h2><div class="cadre"><p class="doux" style="font-size:13px">' + esc(t("te_demo")) + "</p></div>";
    var l = TE.lu, h;
    if (!l) { lireTemoins(); h = '<p class="doux">' + esc(t("te_lecture")) + "</p>"; }
    else {
      h = '<div class="tresor or" style="font-size:40px">' + fsats(l.n) + '</div><p>' + esc(t("te_compte", { n: l.n })) + "</p>";
      if (!l.n) h += '<p class="doux" style="font-size:13px">' + esc(t("te_aucun")) + "</p>";
      else if (!l.ko && !l.autresMan && !l.etrangers) h += '<p class="ok">✓ ' + esc(t("te_accord")) + "</p>";
      if (l.ko) h += '<p class="ko">⚠ ' + esc(t("te_rouges", { n: l.ko })) + "</p>";
      if (l.autresMan) h += '<p class="ko">⚠ ' + esc(t("te_autre_manifeste", { n: l.autresMan })) + "</p>";
      if (l.etrangers) h += '<p class="ko">⚠ ' + esc(t("te_etrangers", { n: l.etrangers })) + "</p>";
    }
    var moi = R.temoin ? '<p class="ok" style="font-size:13px">✓ ' + esc(t("te_vous_oui")) + (TE.publie ? " · " + esc(t("te_dernier", { d: fdate(TE.publie / 1000, true) })) : "") + "</p>" +
      (TE.dernierEtat && !TE.dernierEtat.acceptes ? '<p class="att" style="font-size:12px">' + esc(t("te_pas_publie")) + "</p>" : "")
      : '<p class="doux" style="font-size:13px">' + esc(t("te_vous_non")) + ' <button class="bouton2" style="padding:2px 10px;font-size:11px" data-temoin="1">' + esc(t("ac4_oui")) + "</button> " + motSimple("temoin", t("dans_regles") + t("mot_temoin_r")) + "</p>";
    var ots = M.etat && M.etat.temoins_ancrage ? '<p class="doux" style="font-size:12px">' + esc(t("te_ancrage", { d: fdateIso(M.etat.temoins_ancrage.date) })) + ' <a target="_blank" href="' + esc(R.caisse.replace(/\/$/, "") + "/temoins/") + '">' + esc(t("ouvrir")) + "</a></p>" : "";
    return '<h2>' + esc(t("te_titre")) + aide("temoins") + '</h2><div class="deux"><div class="cadre">' + h + '<button class="bouton2" style="padding:2px 10px;font-size:11px" id="te-relire">↻</button></div><div class="cadre">' + moi + ots + '<p class="doux" style="font-size:12px">' + esc(t("te_note")) + ' <a href="#/guide/temoin">' + esc(guide().en_savoir_plus) + " →</a></p></div></div>";
  }
  // ================================================================== LA REGLE « JAMAIS »
  // Ce que le vrai GodGift Core ne demandera jamais : quiconque le demande est un escroc.
  // la regle commune (specification du 2 octobre, paragraphe 10), mot pour mot : jamais_1 et jamais_2, puis ce que GodGift Core fait lui-meme
  // (jamais_3), et la conclusion (jamais_pied)
  var JAMAIS = [1, 2];   // la phrase commune (specification, paragraphe 10) : jamais_1, jamais_2, puis jamais_pied ; jamais_3 vient APRES (contre-audit N8)
  function jamais(court) {
    return '<div class="cadre jamais' + (court ? " court" : "") + '"><div class="sur">' + esc(t("jamais_titre")) + "</div><p>" + esc(phraseJamais()) + '</p><p class="doux" style="font-size:12px">' + esc(t("jamais_3")) +
      ' <a href="#/guide/jamais">' + esc(guide().en_savoir_plus) + " →</a></p></div>";
  }
  function phraseJamais() { return JAMAIS.map(function (i) { return t("jamais_" + i); }).concat([t("jamais_pied")]).join(" "); }

  // ================================================================== RECUPERER LE TRESOR
  // Le chasseur enregistre a l'avance son adresse de reception, TOUJOURS prouvee par un message signe de son propre portefeuille
  // (BIP-322 ou BIP-137 ; decision du 2 octobre 2026, audit godgift C1). La signature est reverifiee a chaque usage, et encore juste
  // avant l'envoi. Le nombre propre a cette installation, dans le message, n'est pas une preuve (il se lit dans ce navigateur) : il
  // empeche seulement de reprendre une signature preparee pour une autre installation. La date d'enregistrement s'affiche ; si l'adresse
  // a change depuis la derniere visite, une alerte le dit et RIEN ne part tout seul tant que le chasseur ne l'a pas reconnue.
  // Quand la cle d'un vrai coffre est trouvee, GodGift Core montre l'adresse 10 secondes (on peut annuler), puis signe,
  // sur la machine, la transaction qui vide le coffre vers cette adresse, et la diffuse par les deux sources.
  // Gardes : seules des sorties CONFIRMEES et vues pareil par les deux sources sont depensees (la poussiere est laissee) ;
  // frais : une offre forte d'emblee, jusqu'au plafond de l'envoi automatique (10 % du tresor et 300 sat/vB) ; au-dela il faut
  // confirmer ; jamais plus de la moitie (audit godgift I9, protocole M7 : la course se gagne en misant tout de suite, pas par paliers) ;
  // la transaction n'est tenue pour sure qu'a 3 confirmations vues par les deux sources ; alors seulement la cle est oubliee.
  // La cle ne vit qu'en memoire ; elle n'est jamais ecrite ; elle n'est affichee que sur demande (Expert), puis effacee.
  var AUTO_TAUX_MAX = 300, AUTO_PART_MAX = 0.10, CONFS_SURES = 3, PREP_FRAICHE = 5 * 60000, RECUL_MAX = 300000;
  var TR = { cles: {}, cibles: {}, dest: {}, prep: {}, envois: lireR("envois", null) || {}, boucles: {}, msg: {}, compte: {}, confirmer: {}, gen: {}, recul: {}, cleEssai: null, retape: {}, suite: {} };
  (function () { var e = lireR("envoi", null); if (e && e.adresse && !TR.envois[e.n + ":" + e.adresse]) { TR.envois[e.n + ":" + e.adresse] = e; ecrireR("envois", TR.envois); } })();
  // le nombre propre a l'installation : RENOUVELE a chaque enregistrement d'une adresse (contre-audit N7) : la signature d'une ancienne
  // adresse ne vaut plus des qu'une autre est enregistree. Pendant une saisie, le nombre neuf attend (TR.recNonce) ; il ne devient le nombre
  // courant qu'a l'enregistrement reussi.
  function nonceNeuf() { var b = new Uint8Array(4); crypto.getRandomValues(b); return C.hex(b); }
  function nonceReception() { var n = lireR("reception_nonce", null); if (!/^[0-9a-f]{8}$/.test(n || "")) { n = nonceNeuf(); ecrireR("reception_nonce", n); } return n; }
  function messageRec(a) { return window.GGTX.messageReception(a, nonceReception()); }
  function nonceSaisie() { if (!/^[0-9a-f]{8}$/.test(TR.recNonce || "")) TR.recNonce = nonceNeuf(); return TR.recNonce; }
  function messageSaisie(a) { return window.GGTX.messageReception(a, nonceSaisie()); }
  function groupes(a) { return String(a).match(/.{1,4}/g).map(function (g) { return "<span>" + esc(g) + "</span>"; }).join(""); }
  // la retape (contre-verification V1) : hors de la fenetre dediee (ou pour une adresse sans le sceau de la fenetre), avant chaque envoi,
  // le chasseur retape DEUX morceaux de 8 caracteres de son adresse de reception, lus dans son propre portefeuille. Leurs positions sont
  // tirees au hasard hors du prefixe (GGR.morceauxARetaper : la regle de la Cave pour un compagnon nouveau), ne vivent qu'en memoire et
  // sont tirees de nouveau apres chaque retape juste. 16 caracteres a des places inconnues d'avance : une page piegee qui substituerait
  // une adresse fabriquee pour finir pareil (8 caracteres : 2^40 essais) ne passe plus.
  // Ces deux morceaux ne s'affichent nulle part tant qu'ils sont demandes (contre-verification V3) : le chasseur les lit dans son
  // portefeuille, jamais sur cet ecran (une page piegee qui aurait change l'adresse enregistree ne peut pas les lui souffler).
  TR.morceaux = {};
  function morceaux(a) {
    if (!a) return null;
    if (!TR.morceaux[a]) { try { TR.morceaux[a] = GGR.morceauxARetaper(String(a)); } catch (e) { return null; } }
    return TR.morceaux[a];
  }
  function masquee(a) {   // l'adresse telle qu'elle s'affiche : dans la fenetre dediee, scellee, entiere ; ailleurs, les deux morceaux caches
    a = String(a || ""); if (receptionScellee()) return a;
    var p = morceaux(a), c = a.split("");
    if (!p) return a.slice(0, 4) + a.slice(4).replace(/./g, "•");
    p.forEach(function (x) { for (var i = x; i < x + 8 && i < c.length; i++) c[i] = "•"; });
    return c.join("");
  }
  function groupesEnvoi(a) {
    return String(masquee(a)).match(/.{1,4}/g).map(function (g) { return "<span>" + esc(g).replace(/•+/g, function (m) { return '<i class="masque">' + m + "</i>"; }) + "</span>"; }).join("");
  }
  function courte(a) { if (!a) return ""; var m = masquee(a); return m.slice(0, 8) + "…" + m.slice(-8); }
  function cleDe(c) { return c.n + ":" + c.adresse; }
  // les types d'adresse dont un portefeuille sait signer un message : bc1q (P2WPKH), 3… (P2SH-P2WPKH), 1… (P2PKH)
  function typeSignable(d) { return d && (d.type === "p2wpkh" || d.type === "p2sh" || d.type === "p2pkh"); }
  function receptionValide() {
    var r = R.reception; if (!r || !r.adresse) return { ok: false, raison: "aucune" };
    var d = window.GGTX.decoderAdresse(r.adresse);
    if (!d) return { ok: false, raison: "adresse" };
    if (d.reseau !== reseau()) return { ok: false, raison: "reseau" };
    if (!r.signature || !typeSignable(d)) return { ok: false, raison: "preuve" };   // plus d'adresse « confirmee » a la main : une signature, toujours
    if (!window.GGTX.verifierMessage(r.adresse, messageRec(r.adresse), r.signature)) return { ok: false, raison: "signature" };
    return { ok: true, adresse: r.adresse, date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : "", preuve: "signee" };
  }
  // l'adresse montree a la derniere visite : si elle differe de l'adresse enregistree, une alerte, et rien ne part sans le chasseur
  var REC_VUE = lireR("reception_vue", null);
  TR.recAlerte = !!(R.reception && R.reception.adresse && (!REC_VUE || REC_VUE.adresse !== R.reception.adresse));
  if (R.reception && R.reception.adresse && !TR.recAlerte) { REC_VUE.date = new Date().toISOString().slice(0, 10); ecrireR("reception_vue", REC_VUE); }
  function receptionReconnue() {
    if (!R.reception || !R.reception.adresse) return;
    REC_VUE = { adresse: R.reception.adresse, date: new Date().toISOString().slice(0, 10) }; ecrireR("reception_vue", REC_VUE); TR.recAlerte = false;
    Object.keys(TR.cles).forEach(function (k) { if (TR.msg[k] && TR.msg[k].attenteAdresse) trouveReel(TR.cibles[k], TR.cles[k]); });   // une cle attendait son adresse
  }
  function alerteReception() {
    if (!TR.recAlerte || R.demo) return "";
    return '<div class="bandeau" style="border-color:#e0605a;background:rgba(224,96,90,.18)">⚠ ' + esc(t("rec_alerte", { d: fdateIso(R.reception && R.reception.date) || "?" })) +
      '<div class="rec-adr petit" style="margin:8px 0">' + groupesEnvoi(R.reception.adresse) + '</div><button class="bouton2" data-rec-ok="1">' + esc(t("rec_reconnaitre")) + "</button></div>";
  }
  function carteReception() {
    var rv = receptionValide(), edit = TR.editRec || !R.reception, h = "";
    if (!edit && rv.ok) {
      h = alerteReception() + '<div class="rec-adr">' + groupesEnvoi(rv.adresse) + '</div><p class="ok" style="font-size:13px">✓ ' + esc(t("rec_prouvee")) + (rv.date ? " · " + esc(t("rec_date", { d: fdateIso(rv.date) })) : "") +
        '</p><p class="doux" style="font-size:12px">' + esc(t("rec_rappel")) + '</p><button class="bouton2" id="r-rec-changer">' + esc(t("rec_changer")) + "</button>";
    } else {
      // hors du sceau de la fenetre dediee, le formulaire ne reprend pas l'adresse enregistree (elle se recopierait de l'ecran) : il part vide
      var a = TR.recSaisie || (receptionScellee() && R.reception.adresse) || "", ok = a && window.GGTX.decoderAdresse(a);
      h = (R.reception && !rv.ok ? '<p class="ko">⚠ ' + esc(t("rec_err_" + rv.raison)) + "</p>" : "") +
        '<p class="doux" style="font-size:13px">' + esc(t("rec_intro")) + '</p><label>' + esc(t("rec_adresse")) + '</label><input class="champ mono" id="r-rec-adr" spellcheck="false" autocomplete="off" value="' + esc(a) + '" placeholder="bc1q…">' +
        (ok ? '<div class="rec-adr petit">' + groupes(a) + "</div>" : "") +
        '<label>' + esc(t("rec_message")) + '</label><div class="champ mono" id="r-rec-msg" style="word-break:break-all;font-size:12px">' + esc(ok ? messageSaisie(a) : "AEDE:reception:…") + '</div><button class="bouton2" style="padding:2px 10px;font-size:11px;margin-top:4px" id="r-rec-copier">' + esc(t("rec_copier")) + "</button>" +
        '<label>' + esc(t("rec_signature")) + '</label><textarea class="champ" id="r-rec-sig" rows="2" spellcheck="false" autocomplete="off" placeholder="' + esc(t("rec_signature_ph")) + '">' + esc(TR.recSig || "") + '</textarea><div class="doux" style="font-size:12px">' + esc(t("rec_signature_note")) + '</div>' +
        '<p><button class="bouton" id="r-rec-garder">' + esc(t("rec_garder")) + "</button>" + (R.reception ? ' <button class="bouton2" id="r-rec-annuler">' + esc(t("retour")) + "</button>" : "") + "</p>" + (TR.recErr ? '<p class="ko">' + esc(TR.recErr) + "</p>" : "");
    }
    return '<h2>' + esc(t("rec_titre")) + aide("reception") + '</h2><div class="cadre" id="rec-carte">' + h + '<p class="doux" style="font-size:12px" id="rec-fenetre">' + esc(t(modeEnvoi())) + "</p></div>";
  }
  function garderReception() {
    var a = ($("r-rec-adr").value || "").trim(), sig = ($("r-rec-sig").value || "").trim(), d = window.GGTX.decoderAdresse(a);
    TR.recSaisie = a; TR.recSig = sig; TR.recErr = null;
    if (!d || d.type === "segwit") TR.recErr = t("rec_err_adresse");
    else if (d.reseau !== reseau()) TR.recErr = t("rec_err_reseau");
    else if (!typeSignable(d)) TR.recErr = t("rec_err_type");
    else if (!sig) TR.recErr = t("rec_err_sans_signature");
    else if (!window.GGTX.verifierMessage(a, messageSaisie(a), sig)) TR.recErr = t("rec_err_signature");
    if (TR.recErr) return rendre();
    ecrireR("reception_nonce", nonceSaisie());                                 // le nombre neuf devient le nombre courant : l'ancienne signature ne vaut plus
    R.reception = { adresse: a, signature: sig, preuve: "signee", date: new Date().toISOString().slice(0, 10) };
    ecrireR("reception", R.reception); TR.editRec = false; TR.recSaisie = TR.recSig = TR.recNonce = null;
    scellerReception();                                                        // enregistree dans la fenetre dediee : elle y porte le sceau du jeton
    receptionReconnue();                                                       // c'est le chasseur qui vient de la signer et de l'enregistrer
    rendre();
  }

  // ------------------------------------------------------------------ preparer un coffre (en ligne, avant de couper internet)
  function tauxPrioritaire() {
    var s = sources(), l = [];
    return Promise.allSettled(s.map(function (b) {
      return lire(b + (/blockstream\.info/.test(b) ? "/fee-estimates" : "/v1/fees/recommended")).then(function (j) { var v = Number(j && (j.fastestFee || j["1"] || j["2"])); if (isFinite(v) && v > 0) l.push(v); });
    })).then(function () {
      if (!l.length) throw new Error(t("injoignable"));
      var mn = Math.min.apply(null, l), mx = Math.max.apply(null, l);    // le plus bas des deux : une source qui gonfle les frais ne compte pas
      return { taux: Math.min(1000, Math.max(3, Math.ceil(mn * 1.5))), ecart: mx > 3 * mn };
    });
  }
  function concurrence(adr, notre) {   // une transaction d'un autre chasseur, en attente, qui vide deja ce coffre : vue pareil par chaque source
    var s = sources();
    return Promise.allSettled(s.map(function (b) { return lire(b + "/address/" + adr + "/txs/mempool"); })).then(function (rs) {
      var vues = rs.filter(function (r) { return r.status === "fulfilled" && Array.isArray(r.value); }).map(function (r) {
        return r.value.filter(function (tx) { return tx && tx.txid !== notre && Array.isArray(tx.vin) && tx.vin.some(function (v) { return v.prevout && v.prevout.scriptpubkey_address === adr; }); });
      });
      if (!vues.length || !vues[0].length) return null;
      var x = vues[0][0], fee = Number(x.fee), vt = Math.ceil(Number(x.weight) / 4);
      if (!isFinite(fee) || fee <= 0 || !isFinite(vt) || vt <= 0) return null;
      if (vues.some(function (l) { return !l.some(function (y) { return y.txid === x.txid && Number(y.fee) === fee; }); })) return null;
      return { txid: x.txid, frais: fee, vt: vt, uneSource: vues.length < 2,
        entrees: x.vin.filter(function (v) { return v.prevout && v.prevout.scriptpubkey_address === adr; }).map(function (v) { return { txid: v.txid, vout: v.vout, valeur: Number(v.prevout.value) }; }) };
    });
  }
  function choisirSorties(l, taux) {   // la plus grosse sortie confirmee (le semis) toujours ; les autres seulement si elles valent leur cout
    var seuil = Math.max(1000, 3 * 68 * Math.min(taux, 20));
    var c = l.filter(function (u) { return u.status && u.status.confirmed && /^[0-9a-f]{64}$/.test(u.txid) && Number.isInteger(u.vout) && Number.isSafeInteger(u.value) && u.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
    return c.filter(function (u, i) { return i === 0 || u.value >= seuil; }).slice(0, 60).map(function (u) { return { txid: u.txid, vout: u.vout, valeur: u.value }; });
  }
  function preparer(c) {
    if (R.demo || !c || !c.adresse) return Promise.resolve(null);
    var k = cleDe(c), adr = c.adresse;
    if (TR.prep[k] && TR.prep[k].enCours) return TR.prep[k].enCours;
    var p = Promise.all([explo("/address/" + adr + "/utxo"), tauxPrioritaire()]).then(function (r) {
      var ut = choisirSorties(r[0] || [], r[1].taux);
      return (ut.length ? Promise.resolve(null) : concurrence(adr)).then(function (cc) {
        TR.prep[k] = { utxos: ut.length ? ut : cc ? cc.entrees : [], taux: r[1].taux, ecartFrais: r[1].ecart, concurrent: cc, date: Date.now() };
        return TR.prep[k];
      });
    }, function (e) { TR.prep[k] = { erreur: String(e.message || e), date: Date.now() }; return null; });
    TR.prep[k] = Object.assign(TR.prep[k] || {}, { enCours: p });
    return p.then(function (x) { if (TR.prep[k]) delete TR.prep[k].enCours; rendreSiChasse(); return x; });
  }
  function rendreSiChasse() { var p = route().p; if (p === "chasser" || p === "chasse") rendre(); }

  // ------------------------------------------------------------------ la cle est trouvee
  function apresTrouve(c, k) {
    var rv = receptionValide();
    if (c.essai || R.demo) {                                                   // entrainement : on montre ce qui partirait, sans rien envoyer
      TR.cleEssai = k;
      return '<div class="cadre tresor-trouve" style="margin-top:12px"><div class="ok cz" style="font-size:20px">✓ ' + esc(t("trouve")) + '</div><p>' + esc(t("trouve_essai")) + "</p>" +
        (rv.ok ? '<p class="ok">' + esc(t("tr_essai_sim", { a: courte(rv.adresse) })) + "</p>" : '<p class="att">' + esc(t("tr_essai_sans")) + ' <a href="#/reglages">' + esc(t("m_reglages")) + "</a></p>") + expert("essai") + "</div>";
    }
    trouveReel(c, k);
    return '<div class="cadre tresor-trouve" style="margin-top:12px"><div class="ok cz" style="font-size:22px">✓ ' + esc(t("trouve")) + '</div><p>' + esc(t(SANS_INSTALLER ? "tr_sans_installer" : receptionScellee() ? "tr_trouve_envoi" : "tr_trouve_retape")) + "</p>" + expert(cleDe(c)) + "</div>";
  }
  // ou tourne ce GodGift Core : la fenetre dediee (envoi seul), le navigateur (retape avant chaque envoi), « Sans installer » (aucun envoi)
  function modeEnvoi() { return FENETRE ? (!R.reception || receptionScellee() ? "fenetre_oui" : "fenetre_sceau") : FENETRE_RECHARGEE ? "fenetre_rechargee" : SANS_INSTALLER ? "fenetre_sans_installer" : WEB ? "fenetre_web" : "fenetre_non"; }
  function bandeauFenetre() {   // la fenetre dediee rechargee : elle n'envoie plus rien seule ; on le dit en haut de chaque page
    return FENETRE_RECHARGEE ? '<div class="bandeau" id="fenetre-rechargee" style="border-color:#e8c46a;background:rgba(232,196,106,.14)">⚠ ' + esc(t("fenetre_rechargee")) + "</div>" : "";
  }
  // la retape : deux morceaux de 8 caracteres (voir morceaux), lus par le chasseur dans SON portefeuille ; valable pour UNE transaction
  // (effacee a la signature)
  function sceauReception(r) {
    if (!JETON_F || !r || !r.adresse) return null;
    var e = new TextEncoder();
    return C.hex(window.GGC.hmac256(e.encode(JETON_F), e.encode("AEDE:fenetre:" + r.adresse + ":" + (r.signature || "") + ":" + nonceReception())));
  }
  function receptionScellee() { return FENETRE && !!R.reception && !!R.reception.sceau && R.reception.sceau === sceauReception(R.reception); }
  function scellerReception() { if (FENETRE && R.reception) { R.reception.sceau = sceauReception(R.reception); ecrireR("reception", R.reception); } }
  function retapeFaite(kk, adr) { return receptionScellee() || !!(TR.retape[kk] && TR.retape[kk] === adr); }
  function demanderRetape(kk, suite) { TR.suite[kk] = suite || {}; TR.msg[kk] = { e: "att", d: t("tr_retape_demande"), retape: true }; return rendreSiChasse(); }
  function retaper(kk) {
    var rv = receptionValide(), id = kk.replace(/\W/g, "_"), e1 = $("tr-retape-" + id), e2 = $("tr-retape2-" + id);
    var v1 = e1 ? String(e1.value || "").replace(/\s+/g, "") : "", v2 = e2 ? String(e2.value || "").replace(/\s+/g, "") : "";
    if (!rv.ok) { TR.msg[kk] = { e: "ko", d: t("tr_dest_changee"), attenteAdresse: true }; return rendreSiChasse(); }
    var pz = morceaux(rv.adresse), bech = /^(bc1|tb1)/i.test(rv.adresse);   // en base58, la casse compte
    if (!pz || v1.length !== 8 || v2.length !== 8 || !GGR.retapeJuste(rv.adresse, { positions: pz, texte: v1 + v2 }, !bech)) {
      TR.msg[kk] = { e: "ko", d: t("tr_retape_faux"), retape: true }; return rendreSiChasse();
    }
    delete TR.morceaux[rv.adresse];                                           // la prochaine retape portera sur deux autres morceaux
    TR.retape[kk] = rv.adresse; TR.dest[kk] = rv.adresse;
    if (FENETRE) scellerReception();                                           // dans la fenetre dediee, l'adresse retapee devient celle de la fenetre
    var s = TR.suite[kk] || {}; delete TR.suite[kk]; TR.msg[kk] = null;
    lancerEnvoi(kk, s.frais || null, !!s.confirme);
  }
  function trouveReel(c, k) {   // la cle reste en memoire ; dans la fenetre dediee, on montre la destination 10 secondes, puis on envoie
    var kk = cleDe(c), rv = receptionValide();
    TR.cles[kk] = k; TR.cibles[kk] = { n: c.n, h: c.h == null ? 1 : c.h, adresse: c.adresse };
    if (SANS_INSTALLER) { TR.msg[kk] = { e: "att", d: t("tr_sans_installer") }; return rendreSiChasse(); }   // « Sans installer » : aucun envoi, on renvoie a l'installation
    if (!rv.ok) { TR.msg[kk] = { e: "att", d: t("tr_attente_adresse"), attenteAdresse: true }; return rendreSiChasse(); }
    preparer(TR.cibles[kk]);                                                   // en parallele : les donnees fraiches seront pretes
    if (TR.recAlerte) { TR.msg[kk] = { e: "ko", d: t("tr_rec_changee"), attenteAdresse: true }; return rendreSiChasse(); }   // adresse changee depuis la derniere visite : rien ne part seul
    TR.dest[kk] = rv.adresse; TR.msg[kk] = null;
    if (!retapeFaite(kk, rv.adresse)) return demanderRetape(kk, {});           // hors de la fenetre dediee (ou adresse sans sceau) : rien ne part sans la retape
    demarrerCompte(kk);
  }
  function demarrerCompte(kk) {
    TR.compte[kk] = Date.now() + 10000;
    function tic() {
      if (!TR.compte[kk]) return;
      if (Date.now() >= TR.compte[kk]) { delete TR.compte[kk]; return lancerEnvoi(kk); }
      var el = $("tr-compte-" + kk.replace(/\W/g, "_")); if (el) el.textContent = Math.ceil((TR.compte[kk] - Date.now()) / 1000);
      setTimeout(tic, 250);
    }
    tic(); rendreSiChasse();
  }
  function expert(kk) {
    return '<details class="expert"><summary>' + esc(t("tr_expert")) + '</summary><p class="att" style="font-size:12px">' + esc(t("tr_expert_note")) + '</p><button class="bouton2" data-wif="' + esc(kk) + '">' + esc(t("tr_voir_cle")) + '</button><div class="champ mono" id="h-wif" translate="no" style="word-break:break-all;min-height:20px"></div><p class="doux" style="font-size:12px">' + esc(t("wif_note")) + "</p></details>";
  }
  function montrerCle(kk) {   // la cle n'entre dans la page qu'a la demande, et en sort au bout d'une minute
    var k = kk === "essai" ? TR.cleEssai : TR.cles[kk], el = $("h-wif"); if (!el) return;
    el.textContent = k ? versWif(k) : t("tr_recalculer");
    setTimeout(function () { var x = $("h-wif"); if (x) x.textContent = ""; }, 60000);
  }
  function lancerEnvoi(kk, fraisImpose, confirme) {
    var c = TR.cibles[kk], k = TR.cles[kk]; if (!c || !k) return;
    TR.tentative = TR.tentative || {}; var jeton = TR.tentative[kk] = (TR.tentative[kk] || 0) + 1;
    function plusTard(ms) { setTimeout(function () { if (TR.tentative[kk] === jeton) lancerEnvoi(kk, fraisImpose, confirme); }, ms); }
    var rv = receptionValide();                                               // la signature de l'adresse, reverifiee au moment meme de l'envoi
    if (SANS_INSTALLER) { TR.msg[kk] = { e: "att", d: t("tr_sans_installer") }; return rendreSiChasse(); }
    if (!rv.ok) { TR.msg[kk] = { e: "ko", d: t("tr_dest_changee"), attenteAdresse: true }; return rendreSiChasse(); }
    if (TR.recAlerte) { TR.msg[kk] = { e: "ko", d: t("tr_rec_changee"), attenteAdresse: true }; return rendreSiChasse(); }
    if (!retapeFaite(kk, rv.adresse)) return demanderRetape(kk, { frais: fraisImpose, confirme: confirme });   // hors de la fenetre dediee : la retape, avant CHAQUE envoi
    if (rv.adresse !== TR.dest[kk]) { TR.dest[kk] = rv.adresse; TR.msg[kk] = { e: "att", d: t("tr_dest_nouvelle") }; return demarrerCompte(kk); }   // l'adresse a change : on montre la nouvelle 10 s
    TR.msg[kk] = { e: "att", d: t("tr_prep_encours") }; rendreSiChasse();
    var pr = TR.prep[kk], frais = pr && !pr.erreur && pr.utxos && Date.now() - pr.date < PREP_FRAICHE ? Promise.resolve(pr) : preparer(c).then(function (x) { return x || (pr && pr.utxos ? pr : null); });
    frais.then(function (p) {
      if (!TR.cles[kk] || TR.tentative[kk] !== jeton) return;                  // une demande plus recente a pris la main
      // deux sources en desaccord, ou hors ligne : nouvel essai de plus en plus espace (5 s, 10 s, 20 s... 5 min au plus), jamais en boucle serree
      if (!p || !p.utxos) { TR.recul[kk] = Math.min(RECUL_MAX, (TR.recul[kk] || 2500) * 2); TR.msg[kk] = { e: "att", d: t(M.erreurs.sources ? "tr_sources" : "tr_prep_horsligne") }; plusTard(TR.recul[kk]); return rendreSiChasse(); }
      delete TR.recul[kk];
      if (!p.utxos.length) { TR.msg[kk] = { e: "att", d: t("tr_vide_encore") }; delete TR.prep[kk]; plusTard(30000); return rendreSiChasse(); }
      var vt = window.GGTX.vtaille(p.utxos.length, window.GGTX.decoderAdresse(rv.adresse).script), total = p.utxos.reduce(function (s, u) { return s + u.valeur; }, 0);
      var f = fraisImpose || offreForte(p.taux, vt, total, p.concurrent);
      if (f > Math.floor(total / 2)) {                                         // jamais plus de la moitie : on s'arrete au plafond s'il passe encore devant
        if (fraisImpose || (p.concurrent && Math.floor(total / 2) <= p.concurrent.frais + vt)) { TR.msg[kk] = { e: "ko", d: t("tr_frais_max") }; return rendreSiChasse(); }
        f = Math.floor(total / 2);
      }
      if (!confirme && (f > total * AUTO_PART_MAX || f / vt > AUTO_TAUX_MAX || p.ecartFrais || (p.concurrent && p.concurrent.uneSource))) {   // trop cher pour partir seul : on demande
        TR.confirmer[kk] = { frais: f, total: total, vt: vt }; TR.msg[kk] = null; return rendreSiChasse();
      }
      delete TR.confirmer[kk];
      var tx;
      if (!retapeFaite(kk, rv.adresse)) return demanderRetape(kk, { frais: fraisImpose, confirme: confirme });   // reverifiee au moment de signer
      try { tx = window.GGTX.balayer({ utxos: p.utxos, cle: k, destination: rv.adresse, frais: f, reseau: reseau() }); }
      catch (e) { TR.msg[kk] = { e: "ko", d: t("tr_err", { e: t("tx_" + e.message) !== "tx_" + e.message ? t("tx_" + e.message) : e.message }) }; return rendreSiChasse(); }
      delete TR.retape[kk];                                                    // une retape ne vaut que pour cette transaction
      TR.gen[kk] = (TR.gen[kk] || 0) + 1;
      var anciens = (TR.envois[kk] && TR.envois[kk].anciens || []).concat(TR.envois[kk] ? [TR.envois[kk].txid] : []).slice(-10);
      TR.envois[kk] = { n: c.n, h: c.h, adresse: c.adresse, dest: rv.adresse, txid: tx.txid, hex: tx.hex, frais: tx.frais, montant: tx.montant, vt: tx.vtaille, total: total, etat: "a_diffuser", date: Date.now(), gen: TR.gen[kk], anciens: anciens };
      ecrireR("envois", TR.envois); TR.msg[kk] = null; boucleDiffusion(kk); rendreSiChasse();
    });
  }
  function statutTx(txid) {   // vue par chaque source ; « sure » quand les deux s'accordent sur le bloc et 3 confirmations
    var s = sources();
    return Promise.allSettled(s.map(function (b) { return Promise.all([lire(b + "/tx/" + txid), lire(b + "/blocks/tip/height", true)]); })).then(function (rs) {
      var v = rs.filter(function (r) { return r.status === "fulfilled"; }).map(function (r) { return { tx: r.value[0], tip: parseInt(r.value[1], 10) }; });
      if (!v.length) return { horsLigne: true };
      var vu = v.some(function (x) { return x.tx; }), conf = v.filter(function (x) { return x.tx && x.tx.status && x.tx.status.confirmed; });
      if (conf.length !== v.length || !conf.length) return { vu: vu, confirme: false };
      var bh = conf[0].tx.status.block_hash; if (conf.some(function (x) { return x.tx.status.block_hash !== bh; })) return { vu: true, confirme: false, desaccord: true };
      var h = conf[0].tx.status.block_height, confs = Math.min.apply(null, conf.map(function (x) { return (x.tip || h) - h + 1; }));
      return { vu: true, confirme: true, bloc: h, confs: confs, deux: v.length >= 2 };
    });
  }
  function boucleDiffusion(kk) {
    if (TR.boucles[kk]) { clearTimeout(TR.boucles[kk]); }
    var gen = TR.envois[kk] && TR.envois[kk].gen;
    function tour() {
      var e = TR.envois[kk]; TR.boucles[kk] = null;
      if (!e || e.gen !== gen || e.etat === "perdu" || e.fini) return;
      var p;
      if (e.etat === "a_diffuser") p = diffuser(e.hex).then(function (r) {
        if (r.ok) { e.etat = "diffusee"; e.diffusee = Date.now(); }
        else if (r.conflit) return suivreConcurrence(e);
      });
      else p = statutTx(e.txid).then(function (st) {
        if (st.confirme) {
          e.etat = "confirmee"; e.bloc = st.bloc; e.confs = st.confs;
          if ((st.deux && st.confs >= CONFS_SURES) || (sources().length === 1 && st.confs >= 6)) { e.fini = true; delete TR.cles[kk]; }   // sur : la cle n'a plus d'usage, on l'oublie
        } else if (st.vu && e.etat === "confirmee") e.etat = "diffusee";     // une reorganisation lui a retire sa confirmation : on veille encore
        else if (!st.vu && !st.horsLigne && e.etat !== "concurrence") return suivreConcurrence(e);
        else if (!st.vu && e.etat === "diffusee") e.etat = "a_diffuser";      // la transaction a disparu des sources : on la renvoie
      }, function () { });
      p.catch(function () { }).then(function () {
        if (!TR.envois[kk] || TR.envois[kk].gen !== gen) return;               // une version plus recente (Accelerer) a pris la main
        ecrireR("envois", TR.envois); rendreSiChasse();
        if (e.etat !== "perdu" && !e.fini) TR.boucles[kk] = setTimeout(tour, e.etat === "a_diffuser" ? 5000 : 20000);
      });
    }
    TR.boucles[kk] = setTimeout(tour, 0);
  }
  function suivreConcurrence(e) {
    return explo("/address/" + e.adresse + "/txs").then(function (l) {
      var dep = (l || []).filter(function (tx) { return tx.status && tx.status.confirmed && (tx.vin || []).some(function (v) { return v.prevout && v.prevout.scriptpubkey_address === e.adresse; }); })[0];
      if (dep) return statutTx(dep.txid).then(function (st) {                // confirme, et vu pareil par les deux sources, sinon on ne conclut rien
        if (!st.confirme || !(st.deux || (sources().length === 1 && st.confs >= 6))) return;
        var anous = (dep.vout || []).some(function (o) { return o.scriptpubkey_address === e.dest; }) && (dep.txid === e.txid || (e.anciens || []).indexOf(dep.txid) >= 0);
        if (anous) { e.txid = dep.txid; e.etat = "confirmee"; e.bloc = dep.status.block_height; return; }
        e.etat = "perdu"; delete TR.cles[e.n + ":" + e.adresse];
      });
      return concurrence(e.adresse, e.txid).then(function (cc) { if (cc) { e.etat = "concurrence"; e.concurrent = cc; } });
    }, function () { });
  }
  // L'offre forte (audit godgift I9, protocole M7) : d'emblee, le plafond de l'envoi automatique (10 % du tresor, 300 sat/vB), ou plus si le
  // reseau l'exige ; face a un concurrent vu dans la mempool, au moins le double de ses frais et de son taux ; jamais par petits paliers.
  function contreOffre(cc, vt) { return Math.max(2 * cc.frais, Math.ceil(2 * cc.frais / cc.vt * vt), cc.frais + vt + 1); }
  function offreForte(taux, vt, total, cc) {
    var f = Math.max(Math.ceil(taux * vt), Math.floor(Math.min(total * AUTO_PART_MAX, AUTO_TAUX_MAX * vt)));
    return cc ? Math.max(f, contreOffre(cc, vt)) : f;
  }
  function fraisAccel(e) {                                                     // « Accelerer » : doubler d'un coup, au plafond de la moitie s'il le faut
    var f = Math.max(2 * e.frais, e.frais + e.vt + 1);
    if (e.concurrent) f = Math.max(f, contreOffre(e.concurrent, e.vt));
    var plafond = Math.floor(e.total / 2);
    return f > plafond && plafond > e.frais + e.vt ? plafond : f;
  }
  function accelerer(kk) {
    var e = TR.envois[kk]; if (!e) return;
    if (!TR.cles[kk]) { TR.msg[kk] = { e: "att", d: t("tr_recalculer") }; return rendreSiChasse(); }
    var f = fraisAccel(e);
    if (f > Math.floor(e.total / 2)) { TR.msg[kk] = { e: "att", d: t("tr_frais_max") }; return rendreSiChasse(); }
    TR.dest[kk] = TR.dest[kk] || e.dest; TR.cibles[kk] = TR.cibles[kk] || { n: e.n, h: e.h, adresse: e.adresse };
    if (f > e.total * AUTO_PART_MAX || f / e.vt > AUTO_TAUX_MAX || (e.concurrent && e.concurrent.uneSource)) {   // cher, ou concurrent vu d'un seul cote : on demande
      TR.confirmer[kk] = { frais: f, total: e.total, vt: e.vt, fraisImpose: f }; return rendreSiChasse();
    }
    lancerEnvoi(kk, f, true);
  }
  function carteTresor(adresseCoffre) {   // l'etat des envois, sur la page Chasser et sur celle de la chasse zero
    var h = "";
    Object.keys(TR.envois).concat(Object.keys(TR.msg), Object.keys(TR.compte), Object.keys(TR.confirmer)).filter(function (k, i, a) { return a.indexOf(k) === i; }).forEach(function (kk) {
      var adr = kk.slice(kk.indexOf(":") + 1); if (adresseCoffre && adr !== adresseCoffre) return;
      var e = TR.envois[kk], m = TR.msg[kk], id = kk.replace(/\W/g, "_"), x = "";
      if (TR.compte[kk]) x += '<p class="att" style="font-size:15px">' + esc(t("tr_compte")) + ' <b id="tr-compte-' + id + '">' + Math.ceil((TR.compte[kk] - Date.now()) / 1000) + '</b> s</p><div class="rec-adr">' + groupesEnvoi(TR.dest[kk]) + '</div>' + (R.reception && R.reception.adresse === TR.dest[kk] && R.reception.date ? '<p class="doux" style="font-size:12px">' + esc(t("rec_date", { d: fdateIso(R.reception.date) })) + "</p>" : "") + '<p><button class="bouton" data-envoyer="' + esc(kk) + '">' + esc(t("tr_envoyer_maintenant")) + '</button> <button class="bouton2" data-annuler="' + esc(kk) + '">' + esc(t("tr_annuler")) + "</button></p>";
      if (TR.confirmer[kk]) { var cf = TR.confirmer[kk]; x += '<p class="att">' + esc(t("tr_confirmer", { f: fsats(cf.frais), p: Math.round(cf.frais / cf.total * 100), t: Math.round(cf.frais / cf.vt) })) + '</p><div class="rec-adr petit">' + groupesEnvoi(TR.dest[kk] || "") + '</div><p><button class="bouton" data-confirmer="' + esc(kk) + '">' + esc(t("tr_envoyer_frais")) + "</button></p>"; }
      if (m) x += '<p class="' + esc(m.e) + '">' + esc(m.d) + (m.attenteAdresse ? ' <a href="#/reglages">' + esc(t("m_reglages")) + "</a>" : "") + "</p>";
      if (m && m.retape) x += carteRetape(kk, id);
      if (TR.annule && TR.annule[kk] && !e) x += '<p><button class="bouton" data-envoyer="' + esc(kk) + '">' + esc(t("tr_envoyer_maintenant")) + "</button></p>";
      if (e) {
        var lien = '<a target="_blank" href="' + esc(webExplo("/tx/" + e.txid)) + '">' + esc(t("tr_voir_tx")) + "</a>";
        var etats = { a_diffuser: ["att", "⏳ " + t("tr_a_diffuser", { a: courte(e.dest) })], diffusee: ["ok", "✓ " + t("tr_diffusee", { m: fsats(e.montant), a: courte(e.dest) })],
          confirmee: ["ok", "🏆 " + t(e.fini ? "tr_confirmee" : "tr_confirmee_attente", { b: fsats(e.bloc || 0), c: e.confs || 1 })], concurrence: ["ko", "⚠ " + t("tr_concurrence", { f: fsats(e.concurrent ? e.concurrent.frais : 0) })], perdu: ["ko", "✗ " + t("tr_perdu")] };
        var y = etats[e.etat] || etats.a_diffuser;
        x += '<p class="' + y[0] + '" style="font-size:15px">' + esc(y[1]) + '</p><p class="doux" style="font-size:12px">' + esc(t("tr_detail", { m: fsats(e.montant), f: fsats(e.frais), v: e.vt })) + " · " + lien + "</p>" +
          (e.etat === "diffusee" || e.etat === "concurrence" || e.etat === "a_diffuser" ? '<button class="bouton" data-accelerer="' + esc(kk) + '">' + esc(t("tr_accelerer")) + " · " + esc(fsats(fraisAccel(e))) + " sats (" + Math.round(fraisAccel(e) / e.total * 100) + " %)</button>" : "");
      }
      if (x) h += '<div class="cadre tresor-etat"><div class="sur">' + esc(t("tr_titre")) + " · " + esc(t("coffre_n", { n: kk.split(":")[0] })) + "</div>" + x + "</div>";
    });
    return h;
  }
  // la retape : l'adresse enregistree, ses deux morceaux masques a leur place, et deux champs de 8 caracteres (positions comptees a partir de 1)
  function carteRetape(kk, id) {
    var rv = receptionValide(), pz = rv.ok ? morceaux(rv.adresse) : null;
    if (!pz) return "";
    var a = pz[0] + 1, c = pz[1] + 1, champ = function (nom, de, n) {
      return '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px">' + esc(t("tr_retape_morceau", { a: de, b: de + 7 })) + '<input class="champ mono" id="' + nom + id + '" data-morceau="' + n +
        '" maxlength="12" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:12ch"></label>';
    };
    return '<div class="retape"><p style="font-size:13px;margin:6px 0">' + esc(t("tr_retape_label", { a: a, b: a + 7, c: c, d: c + 7 })) + '</p><div class="rec-adr petit">' + groupesEnvoi(rv.adresse) + "</div>" +
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">' + champ("tr-retape-", a, 1) + champ("tr-retape2-", c, 2) +
      '<button class="bouton" data-retape="' + esc(kk) + '">' + esc(t("tr_retape_ok")) + "</button></div></div>";
  }
  function carteArmement(c) {   // sur la page Chasser : vers ou partira le tresor
    if (!c) return "";
    var rv = receptionValide();
    if (c.essai || R.demo) return '<div class="cadre arme"><div class="sur">' + esc(t("tr_titre")) + '</div><p class="doux" style="font-size:13px">' + esc(rv.ok ? t("tr_essai_arme", { a: courte(rv.adresse) }) : t("tr_essai_sans")) + "</p></div>";
    if (SANS_INSTALLER) return '<div class="cadre arme"><div class="sur">' + esc(t("tr_titre")) + '</div><p class="att">' + esc(t("fenetre_sans_installer")) + "</p></div>";
    if (!rv.ok) return '<div class="cadre arme"><div class="sur">' + esc(t("tr_titre")) + '</div><p class="att">⚠ ' + esc(t(R.reception ? "rec_err_" + rv.raison : "tr_pas_arme")) + ' <a href="#/reglages">' + esc(t("m_reglages")) + "</a></p></div>";
    if (TR.recAlerte) return '<div class="cadre arme"><div class="sur">' + esc(t("tr_titre")) + "</div>" + alerteReception() + "</div>";
    var kk = cleDe(c), pr = TR.prep[kk], etat;
    if (!pr || pr.enCours) { if (!pr) setTimeout(function () { preparer(c); }, 0); etat = '<span class="doux">' + esc(t("tr_prep_encours")) + "</span>"; }
    else if (pr.erreur) etat = '<span class="att">' + esc(t(M.erreurs.sources ? "tr_sources" : "tr_prep_horsligne")) + "</span>";
    else if (!pr.utxos.length) etat = '<span class="att">' + esc(t("tr_vide_encore")) + "</span>";
    else { var tot = pr.utxos.reduce(function (s, u) { return s + u.valeur; }, 0); etat = '<span class="ok">' + esc(t("tr_prep", { s: fsats(tot), t: pr.taux })) + "</span>" + (pr.concurrent ? '<br><span class="ko">⚠ ' + esc(t("tr_concurrence", { f: fsats(pr.concurrent.frais) })) + "</span>" : ""); }
    return '<div class="cadre arme"><div class="sur">' + esc(t("tr_titre")) + '</div><p style="font-size:13px">✓ ' + esc(t(receptionScellee() ? "tr_arme" : "tr_arme_retape")) + '</p><div class="rec-adr petit">' + groupesEnvoi(rv.adresse) + '</div>' +
      (rv.date ? '<p class="doux" style="font-size:12px">' + esc(t("rec_date", { d: fdateIso(rv.date) })) + "</p>" : "") + '<p style="font-size:12.5px">' + etat + "</p>" +
      '<p class="' + (receptionScellee() ? "ok" : "att") + '" style="font-size:12px">' + esc(t(modeEnvoi())) + "</p>" +
      (WEB ? '<p class="att" style="font-size:12px">' + esc(t("tr_web_note")) + ' <a href="#/guide/recuperer">' + esc(guide().en_savoir_plus) + " →</a></p>" : "") + "</div>";
  }
  function base58(b) {
    var A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", x = BigInt("0x" + C.hex(b)), s = "";
    while (x > 0n) { s = A58[Number(x % 58n)] + s; x /= 58n; }
    for (var i = 0; i < b.length && b[i] === 0; i++) s = "1" + s;
    return s;
  }
  function versWif(k) {
    var p = new Uint8Array(34); p[0] = 0x80; p.set(C.deHex(k.toString(16).padStart(64, "0")), 1); p[33] = 1;
    var ck = C.sha256(C.sha256(p)), o = new Uint8Array(38); o.set(p); o.set(ck.slice(0, 4), 34);
    return base58(o);
  }
  function lireCri() {
    var c = cibleChasse(); if (!c || c.essai) return;
    var k = coffres()[c.n - 1];
    if (R.demo) { H.alea[c.n] = ""; H.res = '<p class="att">' + esc(t("demo_pas_de_cri")) + "</p>"; return rendre(); }
    var a0 = aleaDuCoffret(c.n);
    if (a0 && GGR.aleaTenu(M.manifeste, c.n, a0)) { H.alea[c.n] = a0; H.res = '<p class="ok">' + esc(t("cri_lu_coffret")) + "</p>"; return rendre(); }
    explo("/tx/" + k.c.cri_txid).then(function (tx) {
      var s = tx ? ascii(opReturn(tx.vout) || []) : "", m = /^AEDE:cri:(\d+):([0-9a-f]{64})$/.exec(s);
      if (m && +m[1] === c.n && GGR.aleaTenu(M.manifeste, c.n, m[2])) { H.alea[c.n] = m[2]; H.res = '<p class="ok">' + esc(t("cri_lu")) + "</p>"; }
      else H.res = m ? '<p class="ko">' + esc(t("alea_faux")) + "</p>" : '<p class="att">' + esc(t("cri_pas_encore")) + "</p>";   // un cri qui ment sur l'alea : signale
      rendre();
    }, function () { H.res = '<p class="ko">' + esc(t("injoignable")) + "</p>"; rendre(); });
  }
  function dico(v) {
    var ix = index(), o = [];
    v = v.trim(); if (!v) return "";
    if (/^\d{1,4}$/.test(v)) { var n = +v; if (n >= 1 && n <= 5000) o.push(String(n).padStart(4, "0") + " " + window.GG_LISTE.mots[n - 1]); }
    else {
      var p = plier(v), k = 0;
      window.GG_LISTE.mots.forEach(function (m, i) { if (k < 12 && plier(m).indexOf(p) === 0) { o.push(String(i + 1).padStart(4, "0") + " " + m); k++; } });
    }
    return o.length ? o.map(esc).join(" · ") : '<span class="doux">' + esc(t("aucun_mot")) + "</span>";
  }

  // ------------------------------------------------------------------ 6. devenir compagnon
  // Un exemplaire, un compagnon (specification, paragraphe 11) : on devient compagnon avec l'adresse de propriete de SON exemplaire ; la
  // page part de « Mes livres » (un exemplaire verifie) et en reprend l'adresse ; le statut, publie par la caisse, reste « en attente » tant
  // qu'aucune vente reglee ne porte cette adresse de propriete.
  var CP = { adresse: "", signature: "", livre: null, statut: null, statutLu: null, info: null };
  function statutCompagnon(a) {
    if (R.demo || !a || CP.statutLu === a) return;
    CP.statutLu = a; CP.statut = null; CP.info = null;
    lire(R.caisse.replace(/\/$/, "") + "/api/compagnons.json").then(function (j) {
      var x = ((j && j.compagnons) || []).filter(function (c) { return c && c.adresse === a; })[0];
      CP.statut = !x ? "absent" : x.suspendu ? "suspendu" : x.statut === "actif" ? "actif" : "en_attente";   // statut absent ou inconnu : en attente
      // ce que la caisse publie d'un compagnon actif (§11) : la date d'activation, l'exemplaire de reference et son empreinte ; chaque
      // champ est controle, un champ absent ou mal forme n'est simplement pas affiche
      CP.info = CP.statut === "actif" ? { depuis: /^\d{4}-\d{2}-\d{2}$/.test(String(x.actif_depuis || "")) ? x.actif_depuis : null,
        n: Number.isInteger(x.exemplaire) && x.exemplaire > 0 ? x.exemplaire : null,
        emp: /^[0-9a-f]{64}$/.test(String(x.empreinte_exemplaire || "")) ? x.empreinte_exemplaire : null } : null;
    }, function () { CP.statut = "injoignable"; }).then(function () { if (route().p === "compagnon" && CP.statutLu === a) rendre(); });
  }
  // le prix en vigueur, tel que la caisse le publie et le facture (/api/etat.json, livre.prix_sats ; contre-verification de la caisse,
  // N6) ; null hors ligne, librairie muette ou valeur illisible : la page dit alors une phrase sans nombre, jamais un prix faux
  function prixLivre() {
    var p = M.etat && M.etat.livre && M.etat.livre.prix_sats;
    return typeof p === "number" && Number.isSafeInteger(p) && p > 0 && p <= 100000000 ? p : null;
  }
  function codeCompagnon(a) {
    var b = C.sha256(a), A32 = "abcdefghijklmnopqrstuvwxyz234567", bits = 0, v = 0, s = "";
    for (var i = 0; i < b.length && s.length < 10; i++) { v = (v << 8) | b[i]; bits += 8; while (bits >= 5 && s.length < 10) { bits -= 5; s += A32[(v >>> bits) & 31]; } }
    return s;
  }
  function pageCompagnon() {
    var a = CP.adresse, okA = /^bc1q[02-9ac-hj-np-z]{38}$/.test(a) && C.adresseValide(a), msg = okA ? "AEDE:compagnon:" + a : "";
    if (okA) statutCompagnon(a);
    var lv = CP.livre != null ? MP.livres[CP.livre] : null;
    var choix = MP.livres.length ? MP.livres.map(function (l, i) {
      return '<div class="ligne"><span><b class="or">' + esc(t("cp_livre_choisi", { n: l.n })) + "</b> " + (l.propriete ? '<span class="mono doux" style="font-size:11px">' + esc(l.propriete) + "</span>" : '<span class="doux" style="font-size:11px">' + esc(t("cp_livre_sans_adresse")) + "</span>") +
        '</span><span class="v"><button class="' + (CP.livre === i ? "bouton" : "bouton2") + '" data-compagnon="' + i + '">' + esc(CP.livre === i ? "\u2713" : t("cp_choisir")) + "</button></span></div>";
    }).join("") : '<p class="att" style="font-size:13px">' + esc(t("cp_sans_livre")) + ' <a href="#/livres">' + esc(t("m_livres")) + " \u2192</a></p>";
    var e0 = '<div class="cadre"><span class="tag">0</span> <b>' + esc(t("cp_exemplaire")) + '</b><p class="doux" style="font-size:12.5px">' + esc(t("cp_exemplaire_note")) + "</p>" + choix + "</div>";
    var inf = CP.statut === "actif" && CP.info ? CP.info : {};
    var st = okA && CP.statut ? '<p class="' + (CP.statut === "actif" ? "ok" : CP.statut === "suspendu" ? "ko" : "att") + '" style="font-size:12.5px" id="cp-statut">' + esc(t("cp_statut_" + CP.statut)) +
      (inf.depuis ? " " + esc(t("cp_actif_depuis", { d: fdateIso(inf.depuis) })) : "") + (inf.n ? " · " + esc(t("cp_ref", { n: inf.n })) : "") + (CP.statut === "actif" ? "." : "") +
      (inf.emp ? ' <span class="mono" style="font-size:11px">' + esc(inf.emp.slice(0, 16)) + '…</span> <a href="#/livres" data-ex-verif="' + esc(inf.emp) + '">' + esc(t("cp_ref_verifier")) + " \u2192</a>" : "") + "</p>" +
      (inf.emp && lv && lv.emp && lv.emp !== inf.emp ? '<p class="att" style="font-size:12px">' + esc(t("cp_ref_autre")) + "</p>" : "") : "";
    var px = prixLivre(), part = function (pc) { return pc + "\u00a0%" + (px ? " · " + fsats(Math.floor(px * pc / 100)) + " sats" : ""); };   // sans prix lu : les pourcentages seuls
    var parts = '<div class="cadre"><div class="sur">' + esc(t("par_livre")) + '</div><div class="ligne"><span>' + esc(t("prix_livre")) + '</span><span class="v" id="cp-prix">' + (px ? fsats(px) + " sats" : esc(t("prix_inconnu"))) + '</span></div><div class="ligne"><span class="or">' + esc(t("part_compagnon")) +
      '</span><span class="v or">' + part(40) + '</span></div><div class="ligne"><span>' + esc(t("part_tresor")) + '</span><span class="v">' + part(20) + '</span></div><div class="ligne"><span>' + esc(t("part_auteur")) +
      '</span><span class="v">' + part(40) + '</span></div><p class="doux" style="font-size:12px">' + esc(t("parts_note")) + "</p></div>";
    var e1 = '<div class="cadre"><span class="tag">1</span> <b>' + esc(t("cp_adresse")) + '</b><p class="doux" style="font-size:12.5px">' + esc(t("cp_adresse_note")) + '</p><input class="champ mono" id="cp-a" value="' + esc(a) + '" placeholder="bc1q…" autocomplete="off" spellcheck="false">' +
      (a && !okA ? '<div class="ko" style="font-size:12px">' + esc(t("adresse_invalide")) + "</div>" : "") + (lv && lv.propriete && okA && a !== lv.propriete ? '<div class="att" style="font-size:12px">' + esc(t("cp_autre_adresse")) + "</div>" : "") + st + "</div>";
    var e2 = '<div class="cadre"' + (okA ? "" : ' style="opacity:.45"') + '><span class="tag">2</span> <b>' + esc(t("cp_signature")) + '</b><p class="doux" style="font-size:12.5px">' + esc(t("cp_signature_note")) + '</p><div class="champ mono" style="user-select:all">' + esc(msg || "AEDE:compagnon:bc1q…") +
      '</div><label>' + esc(t("signature_collee")) + '</label><textarea class="champ" id="cp-s" rows="3"' + (okA ? "" : " disabled") + ">" + esc(CP.signature) + "</textarea></div>";
    var lien = okA ? R.caisse.replace(/\/$/, "") + "/c/" + codeCompagnon(a) : "";
    var e3 = '<div class="cadre"' + (okA && CP.signature ? "" : ' style="opacity:.45"') + '><span class="tag">3</span> <b>' + esc(t("cp_lien")) + '</b><p class="doux" style="font-size:12.5px">' + esc(t("cp_lien_note")) + "</p>" +
      (okA ? '<div class="champ mono" style="user-select:all">' + esc(lien) + "</div>" : "") + '<p><button class="bouton" id="cp-envoyer"' + (okA && CP.signature ? "" : " disabled") + ">" + esc(t("cp_envoyer")) + "</button></p></div>";
    return '<div class="sur">' + esc(t("porter_le_livre")) + '</div><h1>' + esc(t("devenir_compagnon")) + aide("compagnon") + '</h1><p style="max-width:780px">' + esc(t("cp_intro")) + '</p><div class="deux"><div style="display:grid;gap:14px">' + e0 + e1 + e2 + e3 + "</div><div>" + parts +
      '<div class="cadre" style="margin-top:14px"><div class="sur">' + esc(t("cp_regles")) + '</div><p style="font-size:13px">' + esc(t("cp_regles_texte")) + '</p><a class="bouton2" href="#/conditions">' + esc(t("conditions")) + "</a></div></div></div>";
  }

  // ------------------------------------------------------------------ 7. le reseau
  function pageReseau() {
    var sc = sources(), l = [[t("src_chaine"), sc.join("  +  "), M.erreurs.sources ? '<span class="ko">' + esc(t("sources_desaccord")) + "</span>" : M.hauteur ? '<span class="ok">' + esc(sc.length > 1 && M.src.etat === 2 ? t("sources_accord") : t("bloc") + " " + fsats(M.hauteur)) + "</span>" : '<span class="ko">' + esc(t("injoignable")) + "</span>"],
      [t("src_librairie"), R.caisse, M.etat ? '<span class="ok">' + esc(t("flux_recu")) + " · v" + esc(M.etat.version_app || "?") + "</span>" : '<span class="att">' + esc(t("pas_encore_ouverte")) + "</span>"],
      [t("src_site"), SITE, '<a target="_blank" href="' + SITE + '">' + esc(t("ouvrir")) + "</a>"]];
    if (R.demo) l = l.map(function (x) { return [x[0], x[1], '<span class="att">' + esc(t("demo_court")) + "</span>"]; });
    var conc = "";
    if (M.etat && M.manifeste) {
      var memes = M.manifeste.coffres.every(function (c, i) { return M.etat.coffres[i] && M.etat.coffres[i].adresse === c.adresse; });
      conc = '<div class="ligne"><span>' + esc(t("concordance")) + '</span><span class="' + (memes ? "ok" : "ko") + '">' + esc(memes ? t("tout_concorde") : t("desaccord")) + "</span></div>";
    }
    return '<div class="sur">' + esc(t("comme_bitcoin")) + '</div><h1>' + esc(t("reseau_titre")) + aide("reseau") + '</h1><p style="max-width:780px">' + esc(t("reseau_intro")) + '</p><div class="cadre">' +
      l.map(function (x) { return '<div class="ligne"><span><b>' + esc(x[0]) + '</b><br><span class="doux mono" style="font-size:12px">' + esc(x[1]) + '</span></span><span class="v">' + x[2] + "</span></div>"; }).join("") + conc +
      '<div class="ligne"><span><b>' + esc(t("v_programme")) + '</b><br><span class="doux mono" style="font-size:12px">' + esc(VERSION + " · " + window.GG_EMPREINTE.empreinte.slice(0, 16) + "…") + '</span></span><span class="v">' + badgeOfficiel(false) + "</span></div></div>" + carteTemoins() +
      '<h2>' + esc(t("a_venir")) + '</h2><div class="deux"><div class="cadre"><b>' + esc(t("miroir_titre")) + '</b><p class="doux" style="font-size:13px">' + esc(t("miroir_texte")) + '</p></div><div class="cadre"><b>' + esc(t("noeud_titre")) + '</b><p class="doux" style="font-size:13px">' + esc(t("noeud_texte")) + "</p></div></div>";
  }

  // ------------------------------------------------------------------ 8. reglages et a propos
  // la page « Plus » (telephone) : tout ce que les cinq onglets ne portent pas, nomme par ce que ca fait
  function pagePlus() {
    var l = [["coffret", "⧗"], ["livres", "❦"], ["chasser", "⚿"], ["compagnon", "✦"], ["chasses", "◇"], ["reseau", "◎"], ["guide", "?"], ["reglages", "⚙"]];
    return '<div class="sur">' + esc(t("plus_sous")) + '</div><h1>' + esc(t("plus_titre")) + '</h1><div class="cadre liste-plus">' + l.map(function (x) {
      return '<button type="button" class="ligne-plus" data-p="' + x[0] + '"><b>' + x[1] + "</b><span><span class=\"n\">" + esc(t("plus_" + x[0])) + '</span><small>' + esc(t("plus_" + x[0] + "_n")) + "</small></span><i>›</i></button>";
    }).join("") + "</div>" + '<p class="doux" style="font-size:12px;margin-top:14px">GodGift Core v' + VERSION + "</p>";
  }
  // les details de l'etat (le panneau sous l'en-tete d'une ligne)
  function detailsEtat() {
    var srcs = sources().map(hote), l = [];
    l.push([t("et_chaine"), (M.erreurs.explo ? '<span class="ko">' + esc(t("et_chaine_ko")) + "</span>" : M.erreurs.sources ? '<span class="ko">' + esc(t("et_desaccord")) + "</span>" : '<span class="ok">' + esc(t("sources_accord")) + "</span>") + (M.hauteur ? " · " + esc(t("et_bloc")) + " " + fsats(M.hauteur) : "") + '<br><span class="doux">' + esc(srcs.join(" + ")) + " · " + esc(t("et_sources")) + "</span>"]);
    l.push([t("et_lib"), M.etat ? '<span class="ok">' + esc(t("flux_recu")) + "</span>" : '<span class="att">' + esc(t("pas_encore_ouverte")) + "</span>"]);
    if (M.derniere) l.push([t("et_lu"), esc(fheure(M.derniere / 1000))]);
    l.push([t("et_version"), "v" + VERSION + (WEB ? "" : " · " + badgeOfficiel(false))]);
    return '<div class="cadre" style="margin-top:8px"><div class="sur">' + esc(t("et_titre")) + "</div>" + l.map(function (x) { return '<div class="ligne"><span class="doux">' + esc(x[0]) + '</span><span class="v">' + x[1] + "</span></div>"; }).join("") +
      (M.erreurs.explo && M.derniere ? '<p class="doux" style="font-size:12.5px">' + esc(t("et_hors_ligne", { d: fheure(M.derniere / 1000) })) + "</p>" : "") +
      '<p style="margin:10px 0 0"><button class="bouton2" id="rafraichir" style="padding:6px 14px;font-size:12px">↻ ' + esc(t("et_rafraichir")) + "</button></p></div>";
  }
  // un mot du protocole, explique d'un toucher (panneau bas) : on dit la chose, puis son nom dans les regles
  function motSimple(cle, libelle) { return '<button type="button" class="mot" data-mot="' + cle + '">' + esc(libelle || t("mot_" + cle + "_t")) + "</button>"; }
  function ouvrirMot(cle) {
    var f = $("feuille-mot"); if (!f) { f = document.createElement("div"); f.id = "feuille-mot"; f.className = "feuille-mot"; f.setAttribute("role", "dialog"); f.setAttribute("aria-modal", "true"); document.body.appendChild(f); }
    f.innerHTML = '<div class="fm-voile" data-fermer-mot="1"></div><div class="fm-panneau"><div class="fm-poignee"></div><button type="button" class="fm-fermer" data-fermer-mot="1" aria-label="' + esc(t("et_fermer")) + '">✕</button>' +
      '<h3>' + esc(t("mot_" + cle + "_t")) + '</h3><p class="doux" style="font-size:12.5px;margin:2px 0 8px">' + esc(t("dans_regles") + t("mot_" + cle + "_r")) + "</p><p>" + esc(t("mot_" + cle + "_d")) + "</p></div>";
    f.hidden = false; f.querySelector(".fm-fermer").focus();
  }
  function fermerMot() { var f = $("feuille-mot"); if (f) { f.hidden = true; f.innerHTML = ""; } }
  function pageReglages() {
    var e = window.GG_EMPREINTE;
    return '<div class="deux"><div><h1>' + esc(t("m_reglages")) + '</h1><div class="cadre"><label>' + esc(t("langue")) + '</label><select class="champ" id="r-lang">' + LANGUES.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === R.lang ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") +
      '</select><label>' + esc(t("src_chaine")) + '</label><input class="champ mono" id="r-explo" value="' + esc(R.explo) + '"><div class="doux" style="font-size:12px">' + esc(t(WEB ? "explo_note_web" : "explo_note")) + '</div><label>' + esc(t("src_chaine2")) + '</label><input class="champ mono" id="r-explo2" value="' + esc(R.explo2 || "") + '"><div class="doux" style="font-size:12px">' + esc(t("explo2_note")) + '</div><label>' + esc(t("src_librairie")) + '</label><input class="champ mono" id="r-caisse" value="' + esc(R.caisse) +
      '"><label>' + esc(t("code_parrain")) + aide("parrain") + '</label><input class="champ mono" id="r-parrain" value="' + esc(R.parrain || "") + '" placeholder="abcdefgh">' +
      (R.demo ? "" : '<div class="doux" style="font-size:12px" id="r-secours">' + esc(secoursValides().length ? t("secours_connu", { u: secoursValides().join(", ") }) : t("secours_aucun")) + "</div>") +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:14px;color:var(--texte)"><input type="checkbox" id="r-demo"' + (R.demo ? " checked" : "") + "> " + esc(t("mode_demo")) + '</label><div class="doux" style="font-size:12px">' + esc(t("mode_demo_note")) +
      '</div><label style="display:flex;gap:8px;align-items:center;margin-top:14px;color:var(--texte)"><input type="checkbox" id="r-temoin"' + (R.temoin ? " checked" : "") + "> " + esc(t("reg_partage")) + '</label><div class="doux" style="font-size:12px">' + esc(R.temoin ? t("reg_partage_n") : t("reg_partage_non")) + " · " + esc(t("te_note")) + ' <a href="#/guide/temoin">' + esc(guide().en_savoir_plus) + " →</a></div>" +
      '<p><button class="bouton" id="r-garder">' + esc(t("enregistrer")) + '</button> <button class="bouton2" id="r-accueil">' + esc(t("revoir_accueil")) + "</button></p></div>" + carteReception() + jamais(false) + "</div>" +
      '<div><div class="cadre gl-carte"><b class="gl-titre">' + esc(guide().carte_titre) + '</b><p class="doux" style="font-size:13px">' + esc(guide().carte_texte) + '</p><a class="bouton" href="#/guide">' + esc(guide().ouvrir) + "</a></div>" +
      '<h1 style="margin-top:18px">' + esc(t("a_propos")) + '</h1><div class="cadre"><div class="ligne"><span class="doux">' + esc(t("version")) + '</span><span class="v">' + VERSION + " · " + esc(t("version_essai")) + '</span></div><div class="ligne"><span class="doux">' + esc(t("empreinte_programme")) +
      '</span><span class="v mono" style="font-size:12px">' + esc(e.empreinte) + (WEB ? '<br><span class="att" style="font-family:inherit">' + esc(t("prog_web")) + "</span>" : "") + '</span></div><div class="ligne"><span class="doux">' + esc(t("fichiers")) + '</span><span class="v">' + e.fichiers + '</span></div><div class="ligne"><span class="doux">' + esc(t("pierre")) +
      '</span><span class="v"><a href="#/pierre">' + esc(t("lire_pierre")) + '</a> <span class="mono doux" style="font-size:11px">' + esc(window.GG_PIERRE.sha256.slice(0, 16)) + '…</span></span></div><div class="ligne"><span class="doux">' + esc(t("conditions")) +
      '</span><span class="v"><a href="#/conditions">' + esc(t("lire_conditions")) + '</a></span></div><div class="ligne"><span class="doux">' + esc(t("fenetre_titre")) + '</span><span class="v" style="font-size:12.5px">' + esc(t(modeEnvoi())) + '</span></div><div class="ligne"><span class="doux">' + esc(t("licence")) +
      '</span><span class="v">AGPL-3.0</span></div><div class="ligne"><span class="doux">' + esc(t("desinstaller")) + '</span><span class="v" style="font-size:12.5px">' + esc(t(/Mac/.test(navigator.platform) ? "desinst_mac" : /Linux/.test(navigator.platform) ? "desinst_linux" : "desinst_win")) + '</span></div><p class="doux" style="font-size:12.5px">' + esc(t("apropos_texte")) + "</p></div></div></div>";
  }
  // un rendu minimal et sur du Markdown des conditions : tout est echappe d'abord ; titres, listes, gras, italique, filets, tableaux
  // la typographie du rendu (le texte et son empreinte restent ceux du fichier publie) : apostrophe typographique ; en francais, espace
  // insecable devant ; : ! ? » et apres «
  function typoRendu(s, fr) { s = s.replace(/'/g, "\u2019"); return fr ? s.replace(/ ([;:!?\u00bb])/g, "\u00a0$1").replace(/\u00ab /g, "\u00ab\u00a0") : s; }
  function rendreMd(md, fr) {
    function enLigne(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/\{\{[A-Z_]+\}\}/g, esc(t("cg_mention"))); }
    var out = [], liste = false;
    String(md || "").split("\n").forEach(function (l) {
      var m; l = typoRendu(l, fr);
      if (!/^\s*[-*] /.test(l) && liste) { out.push("</ul>"); liste = false; }
      if ((m = /^(#{1,4}) (.*)$/.exec(l))) out.push("<h" + (m[1].length + 1) + ">" + enLigne(m[2]) + "</h" + (m[1].length + 1) + ">");
      else if (/^\s*[-*] /.test(l)) { if (!liste) { out.push("<ul>"); liste = true; } out.push("<li>" + enLigne(l.replace(/^\s*[-*] /, "")) + "</li>"); }
      else if (/^-{3,}\s*$/.test(l)) out.push("<hr>");
      else if (/^\|/.test(l)) { var cs = l.split("|").slice(1, -1).map(function (c) { return c.trim(); }); if (!/^\|[\s|:-]+\|?\s*$/.test(l) && cs.join("")) out.push('<div class="ligne">' + cs.map(function (c) { return "<span>" + enLigne(c) + "</span>"; }).join("") + "</div>"); }
      else if (l.trim()) out.push("<p>" + enLigne(l) + "</p>");
    });
    if (liste) out.push("</ul>");
    return out.join("");
  }
  function pageConditions() {
    var cg = window.GG_CG || {}, l = R.lang === "fr" ? "fr" : "en", x = cg[l] || cg.fr;
    if (!x) return '<h1>' + esc(t("conditions")) + '</h1><div class="cadre"><p class="doux">' + esc(t("cg_absentes")) + "</p></div>";
    return '<div class="sur"><a href="#/reglages">\u2190 ' + esc(t("m_reglages")) + '</a></div><h1>' + esc(t("conditions")) + '</h1><p class="doux" style="font-size:12px">' + esc(t("cg_note", { l: l === "fr" ? "FR" : "EN" })) +
      ' <span class="mono">SHA-256 ' + esc(String(x.sha256 || "").slice(0, 16)) + '…</span></p><div class="cadre cg-texte" style="font-size:13.5px;line-height:1.6;max-width:900px">' + rendreMd(x.texte, x === cg.fr) + "</div>";
  }
  function pagePierre() {
    return '<div class="sur"><a href="#/reglages">← ' + esc(t("m_reglages")) + '</a></div><h1>' + esc(t("pierre")) + '</h1><p class="doux mono" style="font-size:12px">SHA-256 ' + esc(window.GG_PIERRE.sha256) + '</p><div class="cadre" style="white-space:pre-wrap;font-size:13.5px;line-height:1.6;max-width:900px">' + esc(window.GG_PIERRE.texte) + "</div>";
  }

  // ================================================================== MASTERPIECE : le COFFRET, les messages, les livres, les chasses
  // Le COFFRET : chaque enigme, chaque cri et chaque indice (deux par coffre ; plus aucune solution), verrouille dans la Cave jusqu'a sa
  // seconde (verrou a date drand). GodGift Core le garde et l'ouvre LUI-MEME a l'heure, meme si la librairie est tombee : il ne depend
  // que de drand. Ce qui est ouvert n'est garde qu'en memoire ; seules les balises drand (publiques, reverifiees a chaque usage) restent.
  var RELAIS_DRAND = ["https://api.drand.sh", "https://api2.drand.sh", "https://api3.drand.sh", "https://drand.cloudflare.com"];
  var QUICKNET = { public_key: "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
    period: 3, genesis_time: 1692803367, hash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    groupHash: "f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e", schemeID: "bls-unchained-g1-rfc9380", metadata: { beaconID: "quicknet" } };
  var TYPES_VERROU = ["enigme", "cri", "indice"];
  var MP = { h: 1, coffret: null, coffretErreur: null, ouverts: {}, ouverture: {}, echecs: {}, nouveau: {}, messages: null, livres: lireR("livres", []), ex: null, exEnCours: false, dernierEssai: 0, roman: null };
  var CLE_BALISES = "drand_" + QUICKNET.hash.slice(0, 16), BALISES = lireR(CLE_BALISES, {}) || {};   // { ronde: balise } : publiques, reverifiees avant chaque usage
  function garderBalises() { var ks = Object.keys(BALISES); if (ks.length > 400) ks.sort(function (a, b) { return a - b; }).slice(0, ks.length - 400).forEach(function (k) { delete BALISES[k]; }); ecrireR(CLE_BALISES, BALISES); }
  function cleV(e) { return e.type + ":" + e.coffre + ":" + (e.type === "indice" ? e.rang : e.numero || 0); }
  var AIDE_MOT = { tableau: "etats", enigmes: "enigme", coffret: "coffret", messages: "message", livres: "exemplaire", verifier: "verifier", chasser: "cle", compagnon: "compagnon",
    chasses: "chasse", reseau: "noeud", certifies: "racine", exemplaire: "empreinte", mes_livres: "exemplaire", parrain: "compagnon", cz: "chasse_zero", annonce: "annonce",
    reception: "reception", temoins: "temoin" };
  function aide(k) {
    var lien = AIDE_MOT[k] ? '<a class="bq-plus" href="#/guide/' + AIDE_MOT[k] + '">' + esc(guide().en_savoir_plus) + " →</a>" : "";
    return '<span class="bq" tabindex="0" role="button" aria-label="?">?<span class="bqb">' + esc(t("aide_" + k)) + lien + "</span></span>";
  }

  // ------------------------------------------------------------------ le guide : premiers pas, glossaire, questions frequentes
  var G = { q: "" };
  function guide() { var g = window.GG_GUIDE || {}; return g[R.lang] || g.fr || { mots: [], parcours: [], faq: [] }; }
  function sansAccent(x) { return String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function pageGuide(cible) {
    var g = guide(), noms = {};
    g.mots.forEach(function (m) { noms[m.id] = m.mot; });
    var mots = g.mots.slice().sort(function (a, b) { return a.mot.localeCompare(b.mot, R.lang, { sensitivity: "base" }); });
    var parcours = '<div class="gl-parcours">' + g.parcours.map(function (pc, i) {
      return '<div class="cadre apparait" style="--i:' + i + '"><div class="sur">' + (i + 1) + " · " + esc(g.t_parcours) + '</div><h2 style="margin-top:4px">' + esc(pc.titre) + "</h2><ol>" +
        pc.etapes.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ol></div>";
    }).join("") + "</div>";
    var gloss = mots.map(function (m) {
      var voir = m.voir.length ? '<div class="gl-voir">' + esc(g.voir_aussi) + " : " + m.voir.map(function (v) { return '<a href="#/guide/' + v + '">' + esc(noms[v] || v) + "</a>"; }).join(" · ") + "</div>" : "";
      return '<div class="cadre gl-mot' + (m.id === cible ? " gl-cible" : "") + '" id="g-' + esc(m.id) + '" data-cherche="' + esc(sansAccent(m.mot + " " + m.texte)) + '"><b class="gl-titre">' + esc(m.mot) + "</b><p>" + esc(m.texte) + "</p>" + voir + "</div>";
    }).join("");
    var faq = g.faq.map(function (f) {
      return '<details class="cadre gl-faq" data-cherche="' + esc(sansAccent(f.q + " " + f.r)) + '"><summary>' + esc(f.q) + "</summary><p>" + esc(f.r) + "</p></details>";
    }).join("");
    setTimeout(filtrerGuide, 0);
    return '<div class="sur">' + esc(g.sur) + '</div><h1>' + esc(g.titre) + '</h1><p style="max-width:820px">' + esc(g.intro) + "</p>" +
      '<input class="champ gl-cherche" id="g-cherche" type="search" autocomplete="off" placeholder="' + esc(g.recherche) + '" value="' + esc(G.q) + '">' +
      '<div id="g-parcours"><h2>' + esc(g.t_parcours) + "</h2>" + parcours + "</div>" +
      "<h2>" + esc(g.t_glossaire) + '</h2><div class="gl-liste">' + gloss + "</div>" +
      "<h2>" + esc(g.t_faq) + '</h2><div class="gl-faqs">' + faq + "</div>" +
      '<p class="doux" id="g-aucun" hidden>' + esc(g.aucun) + "</p>";
  }
  function filtrerGuide() {
    var q = sansAccent(G.q).trim(), n = 0;
    document.querySelectorAll("#page [data-cherche]").forEach(function (el) { var ok = !q || el.dataset.cherche.indexOf(q) >= 0; el.hidden = !ok; if (ok) n++; if (q && ok && el.tagName === "DETAILS") el.open = true; });
    var pc = $("g-parcours"); if (pc) pc.hidden = !!q;
    var a = $("g-aucun"); if (a) a.hidden = n > 0;
  }
  function allerAuMot() {
    var r = route(); if (r.p !== "guide" || !r.a) return;
    var el = $("g-" + r.a), zone = $("page"); if (!el || !zone) return;
    zone.scrollTop += el.getBoundingClientRect().top - zone.getBoundingClientRect().top - zone.clientHeight / 3;
  }

  // ------------------------------------------------------------------ l'ancre, la gravure et la signature d'un manifeste (chasses 0 et 1)
  // Le manifeste lu a la librairie doit etre celui qui est grave sur la chaine (depense du rendu de l'amorce, AEDE:manifeste:<sha>) :
  // sinon une librairie compromise pourrait servir un faux COFFRET. Rien ne s'ouvre avant cette preuve, refaite a CHAQUE chargement.
  // Quand ce programme epingle l'adresse de l'auteur (GG_ANCRE.adresse_auteur), le manifeste doit aussi etre SIGNE par elle
  // (le texte exact de la gravure, BIP-322 ; audit protocole M1) : sans cette signature, rien ne s'ouvre non plus.
  // l'ancre : ce qui est epingle dans ce programme et, a defaut, le premier manifeste prouve grave (on s'en souvient)
  function ancreChasse(h) { var a = window.GG_ANCRE || {}; return a[h === 0 ? "chasse0" : "chasse1"] || null; }
  function adresseEpinglee() {
    var a = window.GG_ANCRE || {}, an1 = ancreChasse(1), an0 = ancreChasse(0);
    return a.adresse_auteur || (an1 && an1.adresse_auteur) || (an0 && an0.adresse_auteur) || null;
  }
  function ancrageOk(hunt, man, h) {   // rend "ok", ou "ko" si ce manifeste contredit l'ancre, ou "change" s'il differe du premier prouve
    var a = ancreChasse(hunt), pin = adresseEpinglee();
    if (a && (h !== a.manifeste_sha256 || !man.amorce || man.amorce.txid !== a.amorce_txid || (man.messages && man.messages.adresse && man.messages.adresse !== a.adresse_auteur))) return "ko";
    if (pin && man.messages && man.messages.adresse && man.messages.adresse !== pin) return "ko";
    var cle = "manif_premier_" + hunt, prem = lireR(cle, null);
    if (prem && prem !== h) { M.erreurs.manifChange = true; return "change"; }
    return "ok";
  }
  function retenirPremier(hunt, h) { var cle = "manif_premier_" + hunt; if (!lireR(cle, null)) ecrireR(cle, h); }
  function gravureManifeste(hunt, man, h) {
    if (ancrageOk(hunt, man, h) !== "ok") return Promise.resolve("ko");
    var am = man.amorce || {}, vout = hunt === 1 && am.vout_rendu == null ? 48 : am.vout_rendu;
    if (!/^[0-9a-f]{64}$/.test(String(am.txid)) || !Number.isInteger(vout)) return Promise.resolve("ko");
    return explo("/tx/" + am.txid + "/outspend/" + vout).then(function (o) {
      if (!o || !o.spent) return "attente";
      return explo("/tx/" + o.txid).then(function (tx) {
        var d = tx && opReturn(tx.vout);
        if (!d || ascii(d) !== "AEDE:manifeste:" + h) return "ko";
        retenirPremier(hunt, h);
        return signatureManifeste(hunt, h);
      });
    }, function () { return "injoignable"; });
  }
  // la signature du manifeste (specification, paragraphe 7) : {texte: "AEDE:manifeste:<sha>", adresse, signature}, dans l'etat de la librairie,
  // ou servie sous /api/chasse/<h>/manifeste_signature.json ; gardee sur la machine (elle se reverifie), donc lisible si la librairie tombe
  function signatureManifeste(hunt, sha) {
    var pin = adresseEpinglee(); if (!pin) return Promise.resolve("ok");
    function bonne(s) { return !!s && typeof s === "object" && s.texte === "AEDE:manifeste:" + sha && s.adresse === pin && bip322(pin, s.texte, String(s.signature || "")); }
    var et = M.etat || {}, ch = et.chasses && et.chasses[String(hunt)], cle = "manif_sig_" + hunt;
    var connues = [hunt === 1 ? et.manifeste_signature : ch && ch.manifeste_signature, lireR(cle, null)];
    for (var i = 0; i < connues.length; i++) if (bonne(connues[i])) { ecrireR(cle, connues[i]); return Promise.resolve("ok"); }
    var urls = basesLibrairie().map(function (b) { return b + "/api/chasse/" + hunt + "/manifeste_signature.json"; });
    if (hunt === 1) urls = urls.concat(basesLibrairie().map(function (b) { return b + "/api/manifeste_signature.json"; }));
    var j = 0;
    function essai() {
      if (j >= urls.length) return Promise.resolve("signature");
      return lire(urls[j++]).then(function (s) { if (bonne(s)) { ecrireR(cle, s); return "ok"; } return essai(); }, essai);
    }
    return essai();
  }
  function manifesteGrave() {
    var man = M.manifeste; if (!man || !M.manifTexte) return Promise.resolve("absent");
    return gravureManifeste(1, man, C.sha256hex(M.manifTexte));
  }
  // ------------------------------------------------------------------ le COFFRET de la chasse n° 1 : lu selon la regle de la Cave (gg_regles.js)
  function messageCoffret(code) {
    return { empreinte: "coffret_empreinte_ko", reseau: "coffret_reseau_ko", calendrier: "coffret_calendrier_ko", strophe: "coffret_strophe_ko", gravure: "coffret_gravure_ko",
      solution: "coffret_solution_ko", doublon: "coffret_doublon_ko", type: "coffret_type_ko", incomplet: "coffret_incomplet_ko", format: "coffret_format_ko", chasse: "coffret_format_ko",
      signature: "coffret_signature_ko", forme: "manif_invalide", absent: "v_coffret_absent" }[code] || "injoignable";
  }
  function chargerCoffret() {
    MP.coffretErreur = null; MP.coffretDetail = null;
    if (R.demo) { MP.coffret = window.GG_DEMO.coffret(); MP.ouverts = window.GG_DEMO.ouverts(MP.coffret, maintenant(), cleV); MP.grave = "ok"; return Promise.resolve(); }
    var man = M.manifeste;
    if (!man) { MP.coffret = null; MP.grave = null; return Promise.resolve(); }
    var sha = man.coffret && man.coffret.sha256, cache = lireR("coffret_texte", null);
    var p = !sha ? Promise.resolve(null) : cache && C.sha256hex(cache) === sha ? Promise.resolve(cache) :
      lire(R.caisse.replace(/\/$/, "") + "/api/coffret.json", true).then(function (tx) {
        if (tx && C.sha256hex(tx) === sha) { ecrireR("coffret_texte", tx); return tx; }
        MP.coffretErreur = tx ? "empreinte" : "absent"; return null;
      }, function () { MP.coffretErreur = "absent"; return null; });
    return Promise.all([p, manifesteGrave()]).then(function (r) {
      var tx = r[0]; MP.grave = r[1];
      if (MP.grave === "ko") { MP.coffretErreur = "gravure"; MP.coffret = null; return; }
      if (!tx) { MP.coffret = null; return; }
      var c;
      try { c = GGR.controlerCoffret(tx, man, QUICKNET, A); }
      catch (e) { MP.coffretErreur = e.code || "format"; MP.coffretDetail = e.message; MP.coffret = null; return; }
      if (MP.coffretSha !== sha) { MP.ouverts = {}; MP.ouverture = {}; MP.echecs = {}; MP.nouveau = {}; }   // un autre COFFRET : rien de l'ancien ne compte
      MP.coffret = c; MP.coffretSha = sha; ouvrirSuite(MP);
    });
  }
  function elementsDe(Z) { return Z && Z.coffret ? Z.coffret.elements : []; }
  function elements(type) { return elementsDe(MP).filter(function (e) { return !type || e.type === type; }); }
  function contenuDe(Z, e) {   // le clair d'un verrou ouvert ; il doit dire le meme coffre, le meme numero (enigme) et le meme rang (indice) que son verrou
    var x = e && Z && Z.ouverts[cleV(e)]; if (x == null) return null;
    var d; try { d = JSON.parse(x); } catch (er) { return null; }
    if (!d || typeof d !== "object" || d.coffre !== e.coffre || (e.type === "enigme" && d.numero !== e.numero) || (e.type === "indice" && d.rang !== e.rang)) return null;
    return d;
  }
  function contenu(e) { return contenuDe(MP, e); }
  var RENDU_PREVU = null;
  function rendreBientot() { if (RENDU_PREVU) return; RENDU_PREVU = setTimeout(function () { RENDU_PREVU = null; rendre(); }, 250); }
  // Ouvre, un a un, les verrous dus d'un COFFRET (MP pour la chasse n° 1, ZS[h] pour les autres), seulement apres la preuve de gravure.
  // Une balise drand deja connue (gardee, reverifiee) sert sans reseau : a chaque chargement, tout se rouvre ici, rien n'est cru sur parole.
  function ouvrirSuite(Z) {
    if (R.demo || !Z || !Z.coffret || !window.GGTL || Z.grave !== "ok" || Z.ouvreEnCours) return;
    var now = maintenant(), e = elementsDe(Z).filter(function (x) { var k = cleV(x); return x.ouverture_utc <= now && Z.ouverts[k] == null && !(Z.echecs[k] > Date.now() - 30000); })
      .sort(function (a, b) { return a.ouverture_utc - b.ouverture_utc; })[0];
    if (!e) return;
    var k = cleV(e), c = Z.coffret; Z.ouvreEnCours = true; Z.ouverture[k] = true;
    window.GGTL.ouvrir(e.verrou, QUICKNET, RELAIS_DRAND, BALISES).then(function (txt) {
      if (Z.coffret !== c) return;
      Z.ouverts[k] = txt.replace(/\s+$/, ""); Z.nouveau[k] = Date.now(); Z.erreurDrand = null; delete Z.echecs[k]; garderBalises(); rendreBientot();
      return true;
    }, function (er) { Z.echecs[k] = Date.now(); Z.erreurDrand = String(er.message || er); }).then(function (suite) {
      delete Z.ouverture[k]; Z.ouvreEnCours = false;
      if (suite) setTimeout(function () { ouvrirSuite(Z); }, 0);
    });
  }
  function ouvrirDus() { ouvrirSuite(MP); }
  function aleaDuCoffret(n) {   // l'alea lu dans le cri ouvert, seulement s'il est celui que le manifeste grave engage
    var e = elements("cri").filter(function (x) { return x.coffre === n; })[0], c = e && contenu(e);
    if (!c || typeof c.hex !== "string") return null;
    var m = /414544453a6372693a([0-9a-f]+?)3a((?:3[0-9]|6[1-6]){64})/.exec(c.hex);   // « AEDE:cri:n: » puis 64 hexadecimaux, en ASCII dans la transaction
    if (!m) return null;
    var s = ""; for (var i = 0; i < m[2].length; i += 2) s += String.fromCharCode(parseInt(m[2].substr(i, 2), 16));
    return R.demo || GGR.aleaTenu(M.manifeste, n, s) ? s : null;
  }
  function chipDe(Z, e, label) {
    var k = cleV(e), c = Z.ouverts[k] != null, now = maintenant(), neuf = Z.nouveau && Z.nouveau[k] && Date.now() - Z.nouveau[k] < 6000;
    var etat = c ? "ouvert" : Z.ouverture[k] ? "ouvre" : e.ouverture_utc <= now ? "du" : "ferme";
    return '<span class="chip ch-' + etat + (neuf ? " vient" : "") + '" title="' + esc(fdate(e.ouverture_utc, true)) + '">' + (c ? "✓ " : etat === "ferme" ? "🔒 " : "⏳ ") + esc(label) + "</span>";
  }
  function chip(e, label) { return chipDe(MP, e, label); }
  function cleOuv(e) { return e.type === "indice" ? "ouv_indice_" + e.rang : "ouv_" + e.type; }
  function nomVerrou(e) { return e.type === "enigme" ? t("enigme_n", { n: e.numero }) : t(e.type === "indice" ? "v_indice_" + e.rang : "v_" + e.type); }

  // ------------------------------------------------------------------ la page du COFFRET
  function pageCoffret() {
    var tete = '<div class="sur">' + esc(t("verrou_a_date")) + '</div><h1>' + esc(t("m_coffret")) + aide("coffret") + "</h1>";
    if (!MP.coffret) {
      return tete + '<div class="bandeau">' + esc(t(MP.coffretErreur && MP.coffretErreur !== "absent" ? messageCoffret(MP.coffretErreur) : "coffret_avant")) + "</div>" +
        (MP.coffretDetail ? '<p class="doux mono" style="font-size:11px">' + esc(MP.coffretDetail) + "</p>" : "") +
        '<div class="trois">' + ["coffret_p1", "coffret_p2", "coffret_p3"].map(function (k, i) { return '<div class="cadre apparait" style="--i:' + i + '"><div class="grand-no">' + (i + 1) + "</div><p>" + esc(t(k)) + "</p></div>"; }).join("") + "</div>";
    }
    var tous = elements(), ouv = tous.filter(function (e) { return MP.ouverts[cleV(e)] != null; }).length, now = maintenant();
    var pro = tous.filter(function (e) { return MP.ouverts[cleV(e)] == null && e.ouverture_utc > now; }).sort(function (a, b) { return a.ouverture_utc - b.ouverture_utc; })[0];
    var attenteGravure = MP.grave !== "ok" && !MP.coffret.demo ? '<div class="bandeau">' + esc(t(MP.grave === "signature" ? "coffret_signature_ko" : "coffret_gravure_attente")) + "</div>" : "";
    var bilan = attenteGravure + '<div class="deux"><div class="cadre"><div class="sur">' + esc(t("verrous_ouverts")) + '</div><div class="tresor or">' + ouv + " / " + tous.length + '</div><div class="barre" style="margin-top:8px"><i style="width:' + Math.round(ouv / Math.max(1, tous.length) * 100) + '%"></i></div>' +
      '<p class="doux" style="font-size:12px">' + esc(t("coffret_empreinte", { h: MP.coffret.demo ? t("demo_court") : String(((M.manifeste || {}).coffret || {}).sha256 || "").slice(0, 16) })) + "</p></div>" +
      '<div class="cadre"><div class="sur">' + esc(t("prochaine_ouverture")) + "</div>" + (pro ? '<div class="compte" data-compte="' + (+pro.ouverture_utc || 0) + '">' + fcompte(pro.ouverture_utc - now) + '</div><div class="doux">' + esc(t(cleOuv(pro), { n: pro.coffre, e: pro.numero || "" })) + " · " + esc(fdate(pro.ouverture_utc, true)) + "</div>" : "<div>" + esc(t("tout_ouvert")) + "</div>") +
      (MP.erreurDrand ? '<p class="att" style="font-size:12px">' + esc(t("drand_injoignable")) + "</p>" : "") + "</div></div>";
    var lignes = "";
    for (var n = 1; n <= 24; n++) {
      var es = tous.filter(function (e) { return e.coffre === n; });
      var ordre = function (e) { return e.type === "enigme" ? (e.numero % 2 ? 0 : 1) : TYPES_VERROU.indexOf(e.type) + 1 + (e.rang || 0); };
      es.sort(function (a, b) { return ordre(a) - ordre(b); });
      lignes += '<div class="ligne-coffret apparait" style="--i:' + n + '"><a href="#/coffre/' + n + '" class="lc-n">' + coffreSvg(coffres()[n - 1].etat, 26) + " " + esc(t("coffre_n", { n: n })) + '</a><div class="lc-chips">' +
        es.map(function (e) { return chip(e, nomVerrou(e)); }).join("") + "</div></div>";
    }
    return tete + '<p style="max-width:820px">' + esc(t("coffret_intro")) + "</p>" + bilan + '<div class="cadre" style="margin-top:14px">' + lignes + "</div>";
  }

  // ------------------------------------------------------------------ les messages de l'auteur (signes par la Cave)
  // Un message n'est valide que bien forme (date AAAA-MM-JJ qui existe, texte de 1 a 2 000 caracteres : audit protocole M5) et bien signe.
  function chargerMessages() {
    if (R.demo) { MP.messages = window.GG_DEMO.messages(); MP.adresseAncree = "bc1q…démo"; return Promise.resolve(); }
    return lire(R.caisse.replace(/\/$/, "") + "/api/messages.json").then(function (l) {
      MP.messages = (Array.isArray(l) ? l : []).slice(0, 500).map(function (m) {
        var forme = GGR.messageBienForme(m), ok = forme && bip322(m.adresse, "AEDE:message:" + m.date + ":" + m.texte, m.signature);
        return Object.assign({}, m, { valide: ok, forme: forme });
      });
      return ancre().then(retenirSecours);
    }, function () { MP.messages = MP.messages || null; return ancre(); });   // librairie tombee : l'adresse de l'auteur (et les secours gardes) restent
  }
  // l'adresse de l'auteur : celle que ce programme epingle ; a defaut, celle que le manifeste grave de la chasse n° 1 annonce ; a defaut
  // encore, celle du manifeste grave de la chasse zero (friction 2 : le message de parution d'octobre s'authentifie ainsi avant le semis)
  function ancre() {
    var pin = adresseEpinglee(), mans = [M.manifeste, ZS[0].man].filter(function (m) { return m && m.messages && m.messages.adresse; });
    if (pin) { MP.adresseAncree = mans.some(function (m) { return m.messages.adresse !== pin; }) ? null : pin; return Promise.resolve(); }
    var man = M.manifeste;
    if (man && man.messages && man.messages.adresse) {
      return (MP.grave ? Promise.resolve(MP.grave) : manifesteGrave()).then(function (g) {
        if (g === "ok") { MP.adresseAncree = man.messages.adresse; return; }
        MP.adresseAncree = ancreZero();
      });
    }
    MP.adresseAncree = ancreZero(); return Promise.resolve();
  }
  function ancreZero() { var Z = ZS[0]; return Z.grave === "ok" && Z.man && Z.man.messages && Z.man.messages.adresse ? Z.man.messages.adresse : null; }
  // les solutions publiees par l'auteur, apres la prise d'un coffre (specification, paragraphe 4) : la derniere ligne AEDE:solution d'un
  // message bien signe par l'auteur, recalculee contre l'engagement grave au semis. Rien n'est recopie dans les reponses ; rien ne part.
  function solutionsSignees() {
    return (MP.messages || []).filter(function (m) { return m.valide && MP.adresseAncree && m.adresse === MP.adresseAncree; }).map(function (m) {
      var s = GGR.lireSolution(m.texte); if (!s) return null;
      var h = s[0], man = h === 1 ? (MP.grave === "ok" ? M.manifeste : null) : ZS[h] && ZS[h].grave === "ok" ? ZS[h].man : null;
      var r = man ? GGR.engagementTenu(m.texte, man) : null;
      return { h: h, c: s[1], m: m, tenu: r ? r[2] : null };
    }).filter(Boolean);
  }
  function badgeSolution(s) {
    if (s.tenu === true) return '<span class="ok">✓ ' + esc(t("sol_tenu")) + "</span>";
    if (s.tenu === false) return '<span class="ko">✗ ' + esc(t("sol_faux")) + "</span>";
    return '<span class="att">? ' + esc(t("sol_attente", { h: s.h })) + "</span>";
  }
  function dsha(b) { return C.sha256(C.sha256(b)); }
  function cat() { var l = 0, i; for (i = 0; i < arguments.length; i++) l += arguments[i].length; var o = new Uint8Array(l), k = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], k); k += arguments[i].length; } return o; }
  function u32(v) { return new Uint8Array([v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255]); }
  function bip322(adresse, message, sig64) {   // BIP-322 « simple », P2WPKH
    try {
      var w = Uint8Array.from(atob(sig64), function (c) { return c.charCodeAt(0); });
      if (w[0] !== 2) return false;
      var ls = w[1], der = w.slice(2, 2 + ls), lp = w[2 + ls], pub = w.slice(3 + ls, 3 + ls + lp);
      if (der[der.length - 1] !== 1 || pub.length !== 33 || 3 + ls + lp !== w.length) return false;
      var h160 = C.ripemd160(C.sha256(pub));
      if (C.adresseSegwit(h160) !== adresse) return false;
      var tag = C.sha256("BIP0322-signed-message"), mh = C.sha256(cat(tag, tag, new TextEncoder().encode(message)));
      var spk = cat(new Uint8Array([0, 20]), h160), z4 = new Uint8Array(4), z8 = new Uint8Array(8);
      var toSpend = cat(z4, new Uint8Array([1]), new Uint8Array(32), new Uint8Array([255, 255, 255, 255]), new Uint8Array([34, 0, 32]), mh, z4, new Uint8Array([1]), z8, new Uint8Array([22]), spk, z4);
      var txid = dsha(toSpend), outpoint = cat(txid, z4);
      var hOut = dsha(cat(z8, new Uint8Array([1, 0x6a])));
      var code = cat(new Uint8Array([25, 0x76, 0xa9, 20]), h160, new Uint8Array([0x88, 0xac]));
      var pre = cat(z4, dsha(outpoint), dsha(z4), outpoint, code, z8, z4, hOut, z4, u32(1));
      return window.GGTL.ecdsaVerifier(der.slice(0, -1), dsha(pre), pub);
    } catch (e) { return false; }
  }
  function badgeMessage(m) {
    if (!m.forme) return '<span class="ko">✗ ' + esc(t("msg_forme")) + "</span>";
    if (!m.valide) return '<span class="ko">✗ ' + esc(t("msg_faux")) + "</span>";
    var ancre_ = MP.adresseAncree ? m.adresse === MP.adresseAncree : null;
    return ancre_ === false ? '<span class="ko">✗ ' + esc(t("msg_pas_auteur")) + "</span>" :
      ancre_ ? '<span class="ok">✓ ' + esc(t("msg_ancre")) + "</span>" : '<span class="att">? ' + esc(t("msg_signe")) + "</span>";
  }
  function pageMessages() {
    var l = MP.messages, sols = solutionsSignees();
    var tete = '<div class="sur">' + esc(t("la_voix_auteur")) + '</div><h1>' + esc(t("m_messages")) + aide("messages") + "</h1>";
    if (!l) return tete + '<div class="cadre"><p class="doux">' + esc(t("msg_injoignable")) + "</p></div>";
    if (!l.length) return tete + '<div class="cadre"><p>' + esc(t("msg_aucun")) + '</p><p class="doux">' + esc(t("msg_comment")) + "</p></div>";
    return tete + l.map(function (m, i) {
      var preuve = '<details><summary class="doux" style="font-size:12px">' + esc(t("msg_preuve")) + '</summary><div class="mono doux" style="font-size:11px;word-break:break-all">' + esc(m.adresse) + "<br>" + esc(m.signature) + "</div></details>";
      var refuse = !m.valide || (MP.adresseAncree && m.adresse !== MP.adresseAncree);
      if (refuse)   // un message faux, ou d'une autre adresse, reste replie : son texte ne s'affiche que sur demande (hameconnage)
        return '<details class="cadre message refuse apparait" style="--i:' + i + '"><summary><span class="tag">' + esc(m.forme ? fdateIso(m.date) : String(m.date || "?").slice(0, 10)) + "</span> " + badgeMessage(m) + ' <span class="doux" style="font-size:12px">' + esc(t("msg_replie")) +
          '</span></summary><div class="txt doux">' + esc(m.texte) + "</div>" + preuve + "</details>";
      var s = sols.filter(function (x) { return x.m === m; })[0];
      return '<div class="cadre message apparait" style="--i:' + i + '"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="tag">' + esc(fdateIso(m.date)) + "</span>" + badgeMessage(m) + '</div><div class="txt">' + esc(m.texte) + "</div>" +
        (s ? '<p style="font-size:13px"><b>' + esc(t("sol_titre")) + " · " + esc(t("coffre_n", { n: s.c })) + " · " + esc(t("chasse_n", { n: s.h })) + "</b> · " + badgeSolution(s) + '<br><span class="doux">' + esc(t("sol_note")) + "</span></p>" : "") + preuve + "</div>";
    }).join("");
  }

  // ------------------------------------------------------------------ les livres : compteur, verifier un exemplaire, mes livres, acheter
  // Garde-fous : un fichier trop lourd, d'un autre type, ou fabrique pour gonfler a la decompression est refuse
  // proprement ; rien n'est jamais envoye au reseau, seule l'empreinte trouvee est cherchee au registre.
  var EX_MAX = 60 * 1024 * 1024, EX_MAX_PARTIE = 8 * 1024 * 1024, EX_MAX_TOTAL = 64 * 1024 * 1024, EX_MOTIF = /(?:Empreinte|Fingerprint)[ \t]{0,8}:?[ \t]{0,8}([0-9a-f]{64})/;
  function ExErreur(code) { this.code = code; }
  function inflate(d, fmt, budget) {   // decompression bornee : on s'arrete des que la partie depasse sa limite
    var lecteur = new Blob([d]).stream().pipeThrough(new DecompressionStream(fmt)).getReader(), morceaux = [], n = 0;
    function suite() {
      return lecteur.read().then(function (r) {
        if (r.done) { var o = new Uint8Array(n), k = 0; morceaux.forEach(function (m) { o.set(m, k); k += m.length; }); budget.reste -= n; return o; }
        n += r.value.length; morceaux.push(r.value);
        if (n > EX_MAX_PARTIE || n > budget.reste) { budget.reste -= n; lecteur.cancel(); return null; }
        return suite();
      });
    }
    return suite().catch(function () { return null; });
  }
  var EX_PROPRIETE = /(?:Adresse de propri[ée]t[ée]|Ownership address)[ \t\u00a0]{0,8}:?[ \t\u00a0]{0,8}(bc1q[02-9ac-hj-np-z]{38})\b/;
  function chercher(octets) {   // l'empreinte de l'exemplaire, et l'adresse de propriete si la meme page la porte
    if (!octets) return null; var s = new TextDecoder("utf-8", { fatal: false }).decode(octets), m = EX_MOTIF.exec(s);
    if (!m) return null; var p = EX_PROPRIETE.exec(s); return { e: m[1], p: p ? p[1] : null };
  }
  function enSerie(taches) {   // une partie apres l'autre, arret a la premiere empreinte trouvee
    var i = 0;
    function suite() { if (i >= taches.length) return Promise.resolve(null); return taches[i++]().then(function (e) { return e || suite(); }); }
    return suite();
  }
  function partiesEpub(b, budget) {
    var i = 0, taches = [];
    while (i + 30 <= b.length && b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 3 && b[i + 3] === 4 && taches.length < 2000) {
      var drap = b[i + 6] | b[i + 7] << 8, meth = b[i + 8] | b[i + 9] << 8, csz = (b[i + 18] | b[i + 19] << 8 | b[i + 20] << 16 | b[i + 21] << 24) >>> 0, nl = b[i + 26] | b[i + 27] << 8, xl = b[i + 28] | b[i + 29] << 8;
      if (drap & 8) break;   // taille inconnue ici : on s'arrete, sans deviner
      var deb = i + 30 + nl + xl; if (deb + csz > b.length) break;
      var nom = new TextDecoder().decode(b.subarray(i + 30, i + 30 + nl));
      if (/\.x?html?$/i.test(nom) && (meth === 0 || meth === 8)) (function (d, m, titre) {
        var f = function () { return (m === 8 ? inflate(d, "deflate-raw", budget) : Promise.resolve(d)).then(chercher); };
        if (titre) taches.unshift(f); else taches.push(f);   // la page de titre d'abord : l'empreinte y est
      })(b.subarray(deb, deb + csz), meth, /titre|title/i.test(nom));
      i = deb + csz;
    }
    return taches;
  }
  function partiesPdf(b, budget) {
    var taches = [function () { return Promise.resolve(chercher(b.subarray(0, Math.min(b.length, EX_MAX_PARTIE)))); }], txt = new TextDecoder("latin1"), pos = 0, n = 0;
    while (n < 3000) {
      var k = indexDe(b, "stream", pos); if (k < 0) break;
      var d = k + 6; if (b[d] === 13) d++; if (b[d] === 10) d++;
      var f = indexDe(b, "endstream", d); if (f < 0) break;
      var entete = txt.decode(b.subarray(Math.max(0, k - 300), k)); entete = entete.slice(entete.lastIndexOf("<<"));
      if (/FlateDecode/.test(entete)) (function (x, a85) { taches.push(function () { var y = a85 ? ascii85(x) : x; return y ? inflate(y, "deflate", budget).then(chercher) : Promise.resolve(null); }); })(b.subarray(d, f), /ASCII85Decode/.test(entete));
      pos = f + 9; n++;
    }
    return taches;
  }
  function ascii85(x) {   // le filtre ASCII85 des PDF (reportlab l'emploie avant la compression)
    var o = [], g = [];
    function octets(v, k) { var q = [Math.floor(v / 16777216) % 256, Math.floor(v / 65536) % 256, Math.floor(v / 256) % 256, v % 256]; for (var j = 0; j < k; j++) o.push(q[j]); }
    for (var i = 0; i < x.length; i++) {
      var c = x[i];
      if (c === 126) break;                                  // « ~> » : fin
      if (c <= 32) continue;                                 // blancs
      if (c === 122 && !g.length) { octets(0, 4); continue; } // « z » : quatre zeros
      if (c < 33 || c > 117) return null;
      g.push(c - 33);
      if (g.length === 5) { octets(((((g[0] * 85 + g[1]) * 85 + g[2]) * 85 + g[3]) * 85 + g[4]), 4); g = []; }
    }
    if (g.length === 1) return null;
    if (g.length) { var k = g.length; while (g.length < 5) g.push(84); octets(((((g[0] * 85 + g[1]) * 85 + g[2]) * 85 + g[3]) * 85 + g[4]), k - 1); }
    return new Uint8Array(o);
  }
  function indexDe(b, mot, depuis) {
    var c = []; for (var j = 0; j < mot.length; j++) c.push(mot.charCodeAt(j));
    for (var i = depuis; i <= b.length - c.length; i++) { if (b[i] !== c[0]) continue; var ok = true; for (j = 1; j < c.length; j++) if (b[i + j] !== c[j]) { ok = false; break; } if (ok) return i; }
    return -1;
  }
  // ------------------------------------------------------------------ deposer un fichier (contre-verification V2)
  // Un fichier glisse dans un navigateur, hors d'un champ prevu, REMPLACE la page dans le meme onglet : un fichier HTML piege y lirait le
  // stockage de cette fenetre. Rien ne se depose donc nulle part, sauf dans les deux zones prevues (un exemplaire du livre, le roman), et
  // la seulement un fichier du type attendu, lu sur la machine par FileReader : jamais ouvert, jamais suivi, la page ne change pas.
  var DEPOTS = {
    "ex-depot": { ext: /\.(epub|pdf)$/i, types: ["", "application/epub+zip", "application/pdf", "application/octet-stream"], lire: function (f) { lireExemplaire(f); } },
    "roman-depot": { ext: /\.epub$/i, types: ["", "application/epub+zip", "application/octet-stream"], lire: function (f) { verifierRoman(f); } }
  };
  function fichierAttendu(zone, f) {
    var d = DEPOTS[zone];
    return !!(d && f && typeof f.name === "string" && d.ext.test(f.name) && d.types.indexOf(String(f.type || "").toLowerCase()) >= 0);
  }
  function lireOctets(f) {   // les octets d'un fichier choisi ou depose, par FileReader
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); }; r.onerror = function () { ko(r.error || new Error("lecture")); };
      r.readAsArrayBuffer(f);
    });
  }
  function lireExemplaire(f) {
    MP.exEnCours = true; MP.ex = null; rendre();
    empreinteDeFichier(f).then(function (e) { MP.exEnCours = false; if (e) { MP.exPropriete = e.p; verifierExemplaire(e.e); } else { MP.ex = { e: "att", d: t("ex_pas_trouve") }; rendre(); } },
      function (err) { MP.exEnCours = false; MP.ex = { e: "ko", d: t(err && err.code ? err.code : "ex_pas_trouve") }; rendre(); });
  }
  function zoneDe(ev) { var z = ev.target && ev.target.closest ? ev.target.closest(".depot[id]") : null; return z && DEPOTS[z.id] ? z.id : null; }
  function aDesFichiers(dt) { return !!dt && Array.prototype.indexOf.call(dt.types || [], "Files") >= 0; }
  ["dragenter", "dragover"].forEach(function (typ) {
    window.addEventListener(typ, function (ev) {
      ev.preventDefault();                                                     // jamais l'action du navigateur (ouvrir le fichier a la place de la page)
      var ok = !!zoneDe(ev) && aDesFichiers(ev.dataTransfer);
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = ok ? "copy" : "none";
    }, true);
  });
  window.addEventListener("drop", function (ev) {
    ev.preventDefault(); ev.stopPropagation();                                 // la page ne s'en va jamais, et le champ ne recoit rien de lui-meme
    var z = zoneDe(ev), dt = ev.dataTransfer, f = dt && dt.files && dt.files.length === 1 ? dt.files[0] : null;
    if (!z) return;                                                            // hors des zones prevues : rien
    if (!f || !fichierAttendu(z, f)) {
      if (z === "ex-depot") { MP.exEnCours = false; MP.ex = { e: "ko", d: t("ex_mauvais_type") }; } else MP.roman = { e: "ko", d: t("roman_mauvais_type") };
      return rendre();
    }
    DEPOTS[z].lire(f);
  }, true);
  function empreinteDeFichier(f) {
    if (!fichierAttendu("ex-depot", f)) return Promise.reject(new ExErreur("ex_mauvais_type"));
    if (f.size > EX_MAX) return Promise.reject(new ExErreur("ex_trop_lourd"));
    return lireOctets(f).then(function (buf) {
      var b = new Uint8Array(buf), budget = { reste: EX_MAX_TOTAL };
      var epub = b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4, pdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
      if (!epub && !pdf) throw new ExErreur("ex_mauvais_type");
      return enSerie(epub ? partiesEpub(b, budget) : partiesPdf(b, budget));
    });
  }
  // le registre : racine de Merkle RFC 6962 (specification, paragraphe 6 ; audit protocole M4), la meme que la caisse et le veilleur
  function racine(feuilles) { return GGR.racineRegistre(feuilles); }
  function verifierExemplaire(emp) {
    emp = (emp || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(emp)) { MP.ex = { e: "ko", d: t("ex_format") }; return rendre(); }
    MP.exEnCours = true; MP.ex = null; rendre();
    if (R.demo) { MP.exEnCours = false; MP.ex = { e: "ok", d: t("ex_ok", { n: 123, q: "2027T1", d: fdate(Date.UTC(2027, 2, 4) / 1000) }) + " · " + t("demo_court"), n: 123, emp: emp }; return rendre(); }
    var base = R.caisse.replace(/\/$/, "");
    lire(base + "/api/registre.json").then(function (reg) {
      var x = reg && reg.exemplaires.filter(function (y) { return y.empreinte === emp; })[0];
      if (!x) { MP.ex = { e: "ko", d: t("ex_inconnu") }; return; }
      var v = ((M.etat && M.etat.versements) || []).filter(function (y) { return y.trimestre === x.trimestre; })[0];
      if (!v) { MP.ex = { e: "att", d: t("ex_attente", { n: x.exemplaire }), n: x.exemplaire, emp: emp, langue: x.langue }; return; }
      return Promise.all([lire(base + "/api/registre/" + x.trimestre + ".json"), explo("/tx/" + v.txid)]).then(function (r) {
        var rt = r[0], tx = r[1], d = tx && opReturn(tx.vout), rac = rt && Array.isArray(rt.ventes) && racine(rt.ventes.map(function (y) { return y && y.empreinte; }));
        var grave = d && ascii(d.slice(0, 21)) === "AEDE:registre:" + x.trimestre + ":" ? C.hex(d.slice(21, 53)) : null;
        var ok = rac && grave === rac && rt.ventes.some(function (y) { return y.empreinte === emp; }) && tx.status && tx.status.confirmed;
        MP.ex = ok ? { e: "ok", d: t("ex_ok", { n: x.exemplaire, q: x.trimestre, d: fdate(tx.status.block_time) }), n: x.exemplaire, emp: emp, langue: x.langue }
          : { e: "ko", d: t("ex_racine_ko", { q: x.trimestre }) };
      });
    }).catch(function () { MP.ex = { e: "att", d: t("ex_injoignable") }; }).then(function () { MP.exEnCours = false; rendre(); });
  }
  // ------------------------------------------------------------------ le serveur de secours de la vente (Pierre, article 10)
  // Il est designe a l'avance par un message signe de l'auteur dont la DERNIERE ligne est exactement AEDE:secours:https://<hote>
  // (signature BIP-322 par l'adresse ancree de l'auteur), ou epingle a la construction (web_origines.txt, devenu GG_ANCRE.secours).
  // Jamais une origine simplement annoncee par la caisse : etat.secours est ignore. Les messages de designation sont gardes ici et
  // reverifies a chaque usage : le jour ou la librairie tombe, GodGift Core sait encore ou aller ; une ecriture etrangere dans ce
  // stockage n'y change rien (elle n'a pas la signature de l'auteur).
  var RE_SECOURS = /^AEDE:secours:(https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::[0-9]{1,5})?)$/, SECOURS_VU = {};
  var SITE_VITRINE = "https://angedeleau.com";
  function origineSecours(texte) { var l = String(texte || "").split("\n"), m = RE_SECOURS.exec(l[l.length - 1]); return m ? m[1] : null; }
  function secoursEpingles() { var a = window.GG_ANCRE || {}; return (Array.isArray(a.secours) ? a.secours : []).filter(function (o) { return typeof o === "string" && RE_SECOURS.test("AEDE:secours:" + o); }); }
  function messageSecoursValide(m) {
    if (!m || !MP.adresseAncree || m.adresse !== MP.adresseAncree || !GGR.messageBienForme(m) || !origineSecours(m.texte)) return false;
    var k = [m.adresse, m.date, m.texte, m.signature].join("|");
    if (!(k in SECOURS_VU)) SECOURS_VU[k] = bip322(m.adresse, "AEDE:message:" + m.date + ":" + m.texte, m.signature);
    return SECOURS_VU[k];
  }
  function designationsSecours() {   // les messages de designation valides, gardes et frais, le plus recent d'abord
    var garde = lireR("secours_signes", []), vus = {};
    return (Array.isArray(garde) ? garde : []).concat(MP.messages || []).filter(messageSecoursValide).filter(function (m) { if (vus[m.signature]) return false; vus[m.signature] = 1; return true; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function retenirSecours() {   // apres chaque lecture des messages : les designations valides sont gardees (dix au plus)
    if (!MP.adresseAncree || R.demo) return;
    ecrireR("secours_signes", designationsSecours().slice(0, 10).map(function (m) { return { date: m.date, texte: m.texte, adresse: m.adresse, signature: m.signature }; }));
  }
  function secoursValides() {
    var caisse = String(R.caisse || "").replace(/\/$/, ""), l = designationsSecours().map(function (m) { return origineSecours(m.texte); }).concat(secoursEpingles());
    return l.filter(function (o, i) { return o && l.indexOf(o) === i && o !== caisse; });
  }
  function adresseAchat() {   // la librairie, sinon un serveur de secours valide qui repond ; aucun : null (la vente est momentanement indisponible)
    var bases = basesLibrairie(), i = 0;
    function essai() {
      if (i >= bases.length) return Promise.resolve(null);
      var b = bases[i++]; var ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, 5000);
      return fetch(b + "/sante", { cache: "no-store", signal: ctl.signal }).then(function (r) { return r.ok ? b : essai(); }, essai);
    }
    return essai();
  }
  function acheter() {
    var fen = window.open("about:blank", "_blank"), lg = R.lang === "fr" ? "fr" : "en";
    adresseAchat().then(function (b) {
      MP.achatIndispo = !b;   // sans librairie ni secours valide : angedeleau.com, et la page le dit ; la chasse continue
      var u = b ? b + (R.parrain ? "/c/" + encodeURIComponent(R.parrain) : "/livre") + "?lang=" + lg : SITE_VITRINE + "/?lang=" + lg;
      if (fen) fen.location = u; else window.open(u, "_blank");
      rendre();
    });
  }
  // ------------------------------------------------------------------ a qui la vente de mon exemplaire est attribuee (contre-verification de la caisse, I5)
  // Le registre public de la librairie (/api/registre.json) dit, pour chaque exemplaire, le lien de sa vente : l'adresse du compagnon que
  // le versement paiera, ou « direct ». Seul l'acheteur sait quel lien il a suivi : GodGift Core lui montre l'attribution de chacun de
  // ses exemplaires et lui demande de la verifier ; une caisse prise qui attribuerait des ventes directes a un compagnon se voit alors
  // chez les acheteurs eux-memes. Le registre est lu EN ENTIER, sans parametre : rien ne part de GodGift Core vers la caisse, pas meme
  // l'empreinte cherchee. Une attribution fausse se signale a l'auteur, au contact de la section 1 des conditions generales.
  var ATTRIB = { reg: null, date: 0, enCours: false, erreur: false };
  function lireAttributions(force) {
    if (R.demo || ATTRIB.enCours || (!force && Date.now() - ATTRIB.date < (ATTRIB.erreur ? 60000 : 300000))) return;
    ATTRIB.enCours = true;
    lire(R.caisse.replace(/\/$/, "") + "/api/registre.json").then(function (reg) {
      if (!reg || !Array.isArray(reg.exemplaires)) throw new Error("registre");
      var m = {};
      reg.exemplaires.forEach(function (x) {
        if (!x || !/^[0-9a-f]{64}$/.test(String(x.empreinte || ""))) return;
        m[x.empreinte] = m[x.empreinte] ? { double: true } : { lien: x.lien, n: x.exemplaire };   // une empreinte en double : rien n'est affirme
      });
      ATTRIB.reg = m; ATTRIB.erreur = false;
    }).catch(function () { ATTRIB.erreur = true; ATTRIB.reg = null; }).then(function () { ATTRIB.enCours = false; ATTRIB.date = Date.now(); if (route().p === "livres") rendre(); });
  }
  function attribution(l) {
    if (R.demo || !l || !/^[0-9a-f]{64}$/.test(String(l.emp || ""))) return "";
    var bloc = function (cl, texte, verifier) {
      return '<div class="attrib ' + cl + '" style="font-size:12px;margin-top:4px;max-width:520px;white-space:normal">' + texte +
        (verifier ? '<br><span class="doux">' + esc(t("attrib_verifier")) + ' <a href="#/conditions">' + esc(t("attrib_cg")) + " →</a></span>" : "") + "</div>";
    };
    if (!ATTRIB.reg) return bloc("doux", esc(t(ATTRIB.erreur ? "attrib_injoignable" : "attrib_lecture")), false);
    var x = ATTRIB.reg[l.emp];
    if (!x) return bloc("att", esc(t("attrib_absent")), false);
    var lien = x.double ? "" : String(x.lien == null ? "" : x.lien), d = lien && lien !== "direct" ? window.GGTX.decoderAdresse(lien) : null;
    if (lien === "direct") return bloc("", "<b>" + esc(t("attrib_titre")) + "</b> " + esc(t("attrib_direct")), true);
    if (d && d.reseau === reseau()) return bloc("", "<b>" + esc(t("attrib_titre")) + "</b> " + esc(t("attrib_compagnon", { c: codeCompagnon(lien) })) +
      '<br><span class="mono" style="font-size:11px;word-break:break-all">' + esc(lien) + "</span>", true);
    return bloc("ko", "⚠ " + esc(t("attrib_illisible")), true);
  }
  function pageLivres() {
    var cp = (M.etat && M.etat.compteur) || (R.demo ? { vendus: 1284, certifies_sur_la_chaine: 1102, en_attente_du_prochain_versement: 182, par_langue: { fr: 903, en: 381 } } : null);
    var compteur = cp ? '<div class="trois"><div class="cadre apparait" style="--i:0"><div class="sur">' + esc(t("ex_vendus")) + '</div><div class="tresor or">' + fsats(cp.vendus) + '</div></div><div class="cadre apparait" style="--i:1"><div class="sur">' + esc(t("ex_certifies")) + aide("certifies") + '</div><div class="tresor ok">' + fsats(cp.certifies_sur_la_chaine) +
      '</div></div><div class="cadre apparait" style="--i:2"><div class="sur">' + esc(t("ex_en_attente")) + '</div><div class="tresor doux">' + fsats(cp.en_attente_du_prochain_versement) + "</div></div></div>" : '<div class="cadre"><p class="doux">' + esc(t("ex_pas_de_compteur")) + "</p></div>";
    var achat = '<div class="cadre achat apparait" style="--i:3"><div><div class="sur">' + esc(t("le_roman")) + '</div><h2 style="margin-top:4px">' + esc(t("acheter_titre")) + '</h2><p class="doux" id="achat-prix">' + esc(prixLivre() ? t("acheter_texte", { p: fsats(prixLivre()) }) : t("acheter_texte_sans_prix")) + (R.parrain ? '<br><span class="or">' + esc(t("acheter_parrain", { c: R.parrain })) + "</span>" : "") +
      (MP.achatIndispo ? '<br><span class="att" id="achat-indispo">' + esc(t("achat_indispo")) + "</span>" : "") + '</p></div><button class="bouton brille" id="acheter">' + esc(t("acheter")) + "</button></div>";
    var res = MP.exEnCours ? '<p class="doux">' + esc(t("ex_verification")) + "</p>" : MP.ex ? '<div class="verif"><div class="ic">' + (MP.ex.e === "ok" ? '<span class="ok">✓</span>' : MP.ex.e === "ko" ? '<span class="ko">✗</span>' : '<span class="att">⏳</span>') + '</div><div><div class="t">' + esc(MP.ex.d) + "</div>" +
      (MP.ex.n ? '<p><button class="bouton2" id="ex-garder">' + esc(t("ajouter_mes_livres")) + "</button></p>" : "") + "</div></div>" : "";
    var verif = '<div class="cadre"><div class="sur">' + esc(t("verifier_exemplaire")) + aide("exemplaire") + '</div><p class="doux" style="font-size:12.5px">' + esc(t("ex_intro")) + '</p><div class="depot" id="ex-depot">' + esc(t("ex_deposer")) + '<input type="file" id="ex-fichier" accept=".epub,.pdf,application/epub+zip,application/pdf"></div>' +
      '<label>' + esc(t("ex_ou_taper")) + '</label><div style="display:flex;gap:8px"><input class="champ mono" id="ex-emp" placeholder="' + esc(t("ph_64")) + '" spellcheck="false"><button class="bouton" id="ex-verifier">' + esc(t("verifier")) + "</button></div>" + res + "</div>";
    if (MP.livres.length) lireAttributions();
    var mes = '<div class="cadre"><div class="sur">' + esc(t("mes_livres")) + aide("mes_livres") + "</div>" + (MP.livres.length ? MP.livres.map(function (l, i) {
      return '<div class="ligne"><span>' + '<b class="or">' + esc(t("exemplaire_n", { n: l.n })) + "</b> " + (l.langue ? '<span class="tag">' + esc(String(l.langue).toUpperCase()) + "</span>" : "") + '<br><span class="mono doux" style="font-size:11px">' + esc(l.emp.slice(0, 32)) + "…</span>" + attribution(l, i) + "</span>" +
        '<span class="v"><input class="champ" style="width:230px;font-size:12px" data-lien="' + i + '" placeholder="' + esc(t("lien_telechargement")) + '" value="' + esc(l.lien || "") + '"> ' + (l.lien && /^https?:\/\//i.test(l.lien) ? '<a class="bouton2" target="_blank" rel="noopener" href="' + esc(l.lien) + '">' + esc(t("lire")) + "</a>" : "") +
        ' <button class="bouton2" data-compagnon="' + i + '">' + esc(t("cp_depuis_livre")) + "</button></span></div>";
    }).join("") : '<p class="doux">' + esc(t("mes_livres_vide")) + "</p>") + "</div>";
    return '<div class="sur">' + esc(t("les_exemplaires")) + '</div><h1>' + esc(t("m_livres")) + aide("livres") + "</h1>" + compteur + achat + '<div class="deux" style="margin-top:14px">' + verif + mes + "</div>" + carteRoman();
  }
  // ------------------------------------------------------------------ le roman : l'empreinte gravee de chaque edition (AEDE:livre:<fr|en>:<SHA-256 du fichier maitre>)
  // La librairie dit l'empreinte declaree ; la gravure se verifie sur la chaine par son txid ; le fichier maitre (garde par l'auteur et le
  // depositaire) se compare en le deposant ici : rien n'est envoye, l'empreinte est calculee sur cette machine (friction 7).
  function livreGrave() { var lg = (M.etat && M.etat.livre_grave) || {}; return ["fr", "en"].filter(function (l) { return /^[0-9a-f]{64}$/.test(String(lg[l] || "")); }).map(function (l) { return { l: l, sha: lg[l] }; }); }
  function carteRoman() {
    var gv = livreGrave(), res = MP.roman ? '<div class="verif"><div class="ic">' + (MP.roman.e === "ok" ? '<span class="ok">✓</span>' : MP.roman.e === "ko" ? '<span class="ko">✗</span>' : '<span class="att">⏳</span>') + '</div><div class="t">' + esc(MP.roman.d) + "</div></div>" : "";
    var lignes = gv.length ? gv.map(function (x) { return '<div class="mono" style="font-size:12px;word-break:break-all">AEDE:livre:' + x.l + ":" + esc(x.sha) + "</div>"; }).join("") : '<p class="doux">' + esc(t("roman_aucune")) + "</p>";
    return '<h2>' + esc(t("roman_titre")) + '</h2><div class="cadre"><p class="doux" style="font-size:12.5px">' + esc(t("roman_intro")) + "</p>" + lignes +
      (gv.length ? '<div class="depot" id="roman-depot" style="margin-top:10px">' + esc(t("roman_deposer")) + '<input type="file" id="roman-fichier" accept=".epub,application/epub+zip"></div>' +
        '<label>' + esc(t("roman_tx")) + '</label><div style="display:flex;gap:8px"><input class="champ mono" id="roman-tx" placeholder="txid" spellcheck="false" autocomplete="off"><button class="bouton2" id="roman-verifier">' + esc(t("verifier")) + "</button></div>" : "") +
      res + '<p class="doux" style="font-size:12px">' + esc(t("roman_note")) + "</p></div>";
  }
  function empreinteBrute(f) {   // SHA-256 d'un fichier entier, sur la machine (WebCrypto si present)
    return lireOctets(f).then(function (b) {
      if (window.crypto && crypto.subtle && crypto.subtle.digest) return crypto.subtle.digest("SHA-256", b).then(function (h) { return C.hex(new Uint8Array(h)); });
      return C.hex(C.sha256(new Uint8Array(b)));
    });
  }
  function verifierRoman(f) {
    var gv = livreGrave();
    if (!fichierAttendu("roman-depot", f)) { MP.roman = { e: "ko", d: t("roman_mauvais_type") }; return rendre(); }
    if (f.size > EX_MAX) { MP.roman = { e: "ko", d: t("ex_trop_lourd") }; return rendre(); }
    MP.roman = { e: "att", d: t("ex_verification") }; rendre();
    return empreinteBrute(f).then(function (h) {
      var x = gv.filter(function (y) { return y.sha === h; })[0];
      MP.roman = x ? { e: "ok", d: t("roman_ok", { l: x.l.toUpperCase() }) } : { e: "ko", d: t("roman_ko", { h: h.slice(0, 16) }) };
    }, function () { MP.roman = { e: "ko", d: t("ex_pas_trouve") }; }).then(rendre);
  }
  function verifierGravureRoman(txid) {
    var gv = livreGrave(); txid = String(txid || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid)) { MP.roman = { e: "ko", d: t("ex_format") }; return rendre(); }
    MP.roman = { e: "att", d: t("ex_verification") }; rendre();
    return explo("/tx/" + txid).then(function (tx) {
      var d = tx && opReturn(tx.vout), s = d ? ascii(d) : "", x = gv.filter(function (y) { return s === "AEDE:livre:" + y.l + ":" + y.sha; })[0];
      MP.roman = x && tx.status && tx.status.confirmed ? { e: "ok", d: t("roman_tx_ok", { l: x.l.toUpperCase(), d: tx.status.block_time ? fdate(tx.status.block_time) : "?" }) } : { e: "ko", d: t("roman_tx_ko") };
    }, function () { MP.roman = { e: "att", d: t("ex_injoignable") }; }).then(rendre);
  }

  // ------------------------------------------------------------------ les chasses
  function pageChasses() {
    var cs = coffres(), pris = cs.filter(function (k) { return k.etat === "pris"; }).length;
    var suivantes = Object.keys(ZS).map(Number).filter(function (h) { return h >= 2 && CHASSES[h]; }).sort(function (a, b) { return a - b; });
    var cartes = suivantes.map(function (h, i) {
      var Z = ZS[h], d = CHASSES[h], pz = Object.keys(Z.depenses).filter(function (n) { return Z.depenses[n]; }).length;
      return '<a class="cadre chasse-carte apparait" style="--i:' + (i + 2) + '" href="#/chasse/' + h + '"><div class="sur">' + esc(t("chasse_n", { n: h })) + ' · <span class="ok">✓ ' + esc(t("ch_annoncee")) + '</span></div><h2 style="margin:4px 0">' + esc(d.nom) + "</h2><p>" +
        esc(t("ch_carte", { n: d.coffres, e: fsats(sommeEuros(d)), d: fdate(heureDef(d, 1, 3)) })) + '</p><div class="doux">' + esc(t("chasse1_etat", { p: pz, n: d.coffres })) + "</div></a>";
    }).join("");
    var alertes = ANN.alertes.map(function (a) { return '<div class="bandeau" style="border-color:#e0605a;background:rgba(224,96,90,.18)">⚠ ' + esc(t(a.k, a.v)) + "</div>"; }).join("");
    var refus = Object.keys(ANN.refus).filter(function (h) { return ANN.refus[h] !== "ann_contredite"; });
    var bilan = '<p class="doux" style="font-size:12px">' + esc(t("ann_bilan", { l: ANN.lues, v: suivantes.length, r: refus.length })) + "</p>" +
      (refus.length ? '<p class="doux" style="font-size:12px">' + refus.slice(0, 12).map(function (h) { return esc(t("chasse_n", { n: h })) + " : " + esc(t(ANN.refus[h])); }).join("<br>") + "</p>" : "");
    return '<div class="sur">' + esc(t("les_chasses_sur")) + '</div><h1>' + esc(t("m_chasses")) + aide("chasses") + "</h1>" + alertes +
      '<div class="deux"><a class="cadre chasse-carte apparait" style="--i:0" href="#/tableau"><div class="sur">' + esc(t("chasse_n", { n: 1 })) + '</div><h2 style="margin:4px 0">' + esc(t("nom_chasse1")) + '</h2><p>' + esc(t("chasse1_texte")) + '</p><div class="doux">' +
      esc(t("chasse1_etat", { p: pris, n: 24 })) + '</div></a><a class="cadre chasse-carte apparait" style="--i:1" href="#/chasse/0"><div class="sur">' + esc(t("chasse_n", { n: 0 })) + '</div><h2 style="margin:4px 0">' + esc(t("cz_titre")) + '</h2><p>' + esc(t("cz_carte")) + "</p></a>" + cartes +
      '<div class="cadre chasse-carte a-venir apparait" style="--i:' + (suivantes.length + 2) + '"><div class="sur">' + esc(t("chasses_suivantes")) + aide("annonce") + '</div><h2 style="margin:4px 0">…</h2><p class="doux">' + esc(t("chasses_suivantes_texte")) + "</p>" + bilan + "</div></div>";
  }

  // ------------------------------------------------------------------ les autres chasses (chasses.py de la Cave) : la chasse zero, et les chasses annoncees
  // Le miroir de chasses.py : trois coffres de 100 euros joues EN PARALLELE (tous au mois de depart) : les trois premieres
  // enigmes (une par coffre) le 3 novembre 2026, les trois secondes le 17 ; le coffre n a les enigmes 2n-1 et 2n. Ses cles portent son numero.
  // Une chasse annoncee (n° 2 a 999) prend place ici, sa definition lue dans son manifeste, une fois son annonce verifiee.
  var CHASSES = { 0: { coffres: 3, annee: 2026, mois: 11, types: ["pierre", "pierre", "pierre"], euros: [100, 100, 100], parallele: true } };
  function etatZ(h) { return { h: h, etat: null, man: null, manTexte: null, grave: null, coffret: null, erreur: null, ouverts: {}, ouverture: {}, echecs: {}, nouveau: {}, soldes: {}, depenses: {}, coffre: 1, res: null, calcul: false, prog: 0, aleas: {}, dernierEssai: 0 }; }
  var ZS = { 0: etatZ(0) }, CZ = ZS[0];   // ZS : la chasse zero et chaque chasse annoncee verifiee ; CZ : celle qui est affichee
  function cleZ(Z, nom) { return Z.h === 0 ? "cz_" + nom : "ch" + Z.h + "_" + nom; }   // la chasse zero garde ses noms de rangement d'origine
  function heureDef(c, n, jour) { var m0 = c.annee * 12 + (c.mois - 1) + (c.parallele ? 0 : n - 1); return Date.UTC(Math.floor(m0 / 12), m0 % 12, jour, 18, 15, 5) / 1000; }
  function heureZ(n, jour, Z) { return heureDef(CHASSES[(Z || CZ).h], n, jour); }
  function sommeEuros(c) { return c.euros.reduce(function (s, x) { return s + x; }, 0); }
  // la regle de lecture de la Cave pour le COFFRET d'une chasse (zero, ou annoncee) : rend null s'il est bon, ou le code du refus
  function refusCoffret(texte, Z) { try { GGR.controlerCoffret(texte, Z.man, QUICKNET); return null; } catch (e) { Z.erreurDetail = e.message; return e.code || "format"; } }
  function basesLibrairie() {   // la librairie, puis ses serveurs de secours valides (Pierre, article 10 : designes par un message signe, ou epingles)
    var l = [String(R.caisse || "").replace(/\/$/, "")].concat(secoursValides());
    return l.filter(function (b, i) { return b && l.indexOf(b) === i; });
  }
  function lireTexte(urls, cleCache, sha) {   // la copie gardee si c'est bien la meme empreinte ; sinon chaque source, l'une apres l'autre
    var c = lireR(cleCache, null);
    if (c && C.sha256hex(c) === sha) return Promise.resolve(c);
    var i = 0;
    function essai() {
      if (i >= urls.length) return Promise.resolve(null);
      return lire(urls[i++], true).then(function (tx) { if (tx && C.sha256hex(tx) === sha) { ecrireR(cleCache, tx); return tx; } return essai(); }, essai);
    }
    return essai();
  }
  function urlsChasse(h, nom) { return basesLibrairie().map(function (b) { return b + "/api/chasse/" + h + "/" + nom; }); }
  function chargerCoffretZ(Z) {   // le COFFRET d'une chasse dont le manifeste est lu : la regle de lecture de la Cave ; puis ses coffres sur la chaine
    var sha = Z.man.coffret && Z.man.coffret.sha256;
    return lireTexte(urlsChasse(Z.h, "coffret.json"), cleZ(Z, "coffret_texte"), sha).then(function (ct) {
      if (!ct) { Z.erreur = "empreinte"; return; }
      var r = refusCoffret(ct, Z);
      if (r) { Z.erreur = r; Z.coffret = null; return; }
      if (Z.coffretSha !== sha) { Z.ouverts = {}; Z.ouverture = {}; Z.echecs = {}; Z.nouveau = {}; }   // un autre COFFRET : rien de l'ancien ne compte
      Z.coffret = JSON.parse(ct); Z.coffretSha = sha; ouvrirSuite(Z);
    }).then(function () {
      if (Z.erreur) return;
      return parLots(Z.man.coffres, 3, function (k) {                       // chaque coffre de la chasse, lu sur la chaine
        return explo("/address/" + k.adresse).then(function (j) {
          var cs = j.chain_stats || {}, ms = j.mempool_stats || {};
          Z.soldes[k.n] = (cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0) + (ms.funded_txo_sum || 0) - (ms.spent_txo_sum || 0);
          Z.depenses[k.n] = (cs.spent_txo_count || 0) > 0;                  // « pris » : seulement une depense confirmee
        }, function () { });
      });
    });
  }
  function chargerChasseZero() {
    // Le manifeste et le COFFRET de la chasse zero sont gardes ici : si la librairie tombe, elle continue (Pierre, article 10).
    var Z = ZS[0], et = M.etat && M.etat.chasses && M.etat.chasses["0"], mCache = lireR("cz_manif_texte", null);
    Z.erreur = null;
    if (R.demo || (!et && !mCache)) { Z.etat = null; Z.coffret = null; return Promise.resolve(); }
    Z.etat = et || { empreinte_manifeste: C.sha256hex(mCache), hors_ligne: true };
    return lireTexte(urlsChasse(0, "manifeste.json"), "cz_manif_texte", Z.etat.empreinte_manifeste).then(function (tx) {
      if (!tx) { Z.erreur = "manifeste"; return; }
      Z.manTexte = tx; Z.man = lireJson(tx);
      var h = C.sha256hex(tx);
      if (!Z.man || !manifesteValide(Z.man) || Z.man.coffres.length !== CHASSES[0].coffres || Z.man.coffres.some(function (k, i) { return k.n !== i + 1; })) { Z.erreur = "forme"; return; }   // trois coffres, numerotes 1, 2, 3
      return gravureManifeste(0, Z.man, h).then(function (gr) {   // la gravure (et la signature, si l'auteur est epingle), reprouvees a chaque chargement
        Z.grave = gr;
        if (gr === "ko") { Z.erreur = "gravure"; return; }
        return chargerCoffretZ(Z);
      });
    }).catch(function () { Z.erreur = Z.erreur || "absent"; });   // une panne ici n'arrete jamais le reste du programme
  }

  // ------------------------------------------------------------------ les chasses annoncees (Pierre V1j, article 8)
  // Une chasse n° h, de 2 a 999, n'existe que par son annonce : le texte exact AEDE:chasse:<h>:<SHA-256 de son manifeste>, grave sur
  // la chaine (OP_RETURN confirme, lu aux deux sources, avant sa premiere enigme) et signe BIP-322 par l'adresse des messages de
  // l'auteur : celle que prouve la gravure du manifeste de la chasse n° 1, ou de la chasse zero tant que la 1 n'est pas semee, et
  // qu'une ancre de ce programme doit epingler (GG_ANCRE.adresse_auteur, ou l'ancre de la chasse 0 ou 1) : sans ancre, aucune
  // annonce n'est retenue. La gravure part du rendu de l'amorce de sa chasse. GodGift Core lit /api/chasses.json a la librairie et
  // a son serveur de secours (chaque source filtree, puis 100 annonces au plus), verifie tout lui-meme, retient chaque chasse
  // verifiee (elle reste suivie si la librairie tombe). Deux annonces d'un meme numero qui designent deux manifestes : la plus
  // ancienne gravure gagne (hauteur de bloc, puis heure du bloc, puis txid), seules les suivantes sont refusees.
  var ANN = { lues: 0, trop: false, refus: {}, alertes: [], auteur: null, enCours: false };
  var ANNONCES_MAX = 100, RE_ANNONCE = /^AEDE:chasse:([2-9]|[1-9][0-9]{1,2}):([0-9a-f]{64})$/, TYPES_COFFRE = ["pierre", "cathedrale", "final"];
  var CHAMPS_DEF = ["annee", "coffres", "euros", "index_amorce", "index_rendu", "mois", "nom", "nourrie_par_les_ventes", "numero", "parallele", "types"];
  function entier(x) { return typeof x === "number" && Number.isInteger(x); }
  function imprimable(s) { return Array.from(s).every(function (c) { return c === " " || !/[\p{C}\p{Z}]/u.test(c); }); }
  function definitionValide(d) {   // le miroir de chasses.valider_definition (Cave et librairie)
    try {
      if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).sort().join() !== CHAMPS_DEF.join()) return false;
      var h = d.numero, n = d.coffres;
      if (!entier(h) || h < 2 || h > 999 || !entier(n) || n < 1 || n > 48) return false;
      if (("AEDE:cri:H" + h + ":" + n + ":").length + 64 > 80) return false;                 // chaque cri tient en 80 octets
      if (typeof d.nom !== "string" || Array.from(d.nom).length < 1 || Array.from(d.nom).length > 60 || !imprimable(d.nom)) return false;
      if (!Array.isArray(d.types) || d.types.length !== n || d.types.some(function (x) { return TYPES_COFFRE.indexOf(x) < 0; })) return false;
      if (!Array.isArray(d.euros) || d.euros.length !== n || d.euros.some(function (x) { return !entier(x) || x < 1 || x > 100000; })) return false;
      if (!entier(d.annee) || d.annee < 2027 || d.annee > 2100 || !entier(d.mois) || d.mois < 1 || d.mois > 12) return false;
      if (typeof d.parallele !== "boolean" || d.nourrie_par_les_ventes !== false) return false;
      return d.index_amorce === 10000 + 80 * h && d.index_rendu === 10040 + 80 * h;          // le bloc du guichet de la chasse h
    } catch (e) { return false; }
  }
  function scriptOpReturn(texte) {   // la sortie OP_RETURN exacte d'un texte court (comme la Cave l'ecrit)
    var b = C.utf8(texte), n = b.length;
    return "6a" + (n <= 75 ? "" : "4c") + (n < 16 ? "0" : "") + n.toString(16) + C.hex(b);
  }
  function adresseAuteur() {   // { a, conflit } : l'adresse des messages prouvee sur la chaine
    var man1 = M.manifeste, Z0 = ZS[0];
    var p1 = man1 && man1.messages && man1.messages.adresse && M.manifTexte ? (MP.grave ? Promise.resolve(MP.grave) : manifesteGrave()) : Promise.resolve(null);
    return p1.then(function (g1) {
      var a1 = g1 === "ok" ? man1.messages.adresse : null;
      var a0 = Z0.grave === "ok" && Z0.man && Z0.man.messages && Z0.man.messages.adresse ? Z0.man.messages.adresse : null;
      var an1 = ancreChasse(1), an0 = ancreChasse(0);
      var toutes = [a1, a0, (window.GG_ANCRE || {}).adresse_auteur, an1 && an1.adresse_auteur, an0 && an0.adresse_auteur].filter(Boolean);
      if (toutes.some(function (x) { return x !== toutes[0]; })) return { a: null, conflit: true };
      return { a: toutes[0] || null, conflit: false };
    }, function () { return { a: null, conflit: false }; });
  }
  function annonceSaine(a, auteur, sigs) {   // les controles bon marche, faits sur chaque source avant tout plafond
    var m = a && typeof a === "object" && typeof a.texte === "string" ? RE_ANNONCE.exec(a.texte) : null;
    if (!m || a.numero !== +m[1] || a.empreinte_manifeste !== m[2]) return false;
    if (!auteur) return true;                    // auteur pas encore prouve : verifierAnnonce dira « en attente » (ann_sans_auteur)
    if (a.adresse !== auteur) return false;
    var k = a.texte + "|" + String(a.signature || "");
    if (!(k in sigs)) sigs[k] = bip322(auteur, a.texte, String(a.signature || ""));   // une signature rejouee n'est verifiee qu'une fois
    return sigs[k];
  }
  function lireAnnonces(auteur) {   // /api/chasses.json a la librairie et a son serveur de secours ; jamais plus de 100 annonces lues
    // Chaque source est filtree (texte, numero, empreinte, adresse de l'auteur, signature ; une entree par texte) AVANT d'etre plafonnee,
    // puis les sources sont prises tour a tour : une librairie piratee ne peut ni noyer le secours, ni le pousser hors des 100.
    // Au plus 1000 entrees examinees par source : une liste demesuree ne fait que se noyer elle-meme.
    return Promise.all(basesLibrairie().map(function (b) { return lire(b + "/api/chasses.json").then(function (l) { return Array.isArray(l) ? l : []; }, function () { return []; }); })).then(function (ls) {
      var vues = {}, out = [], sigs = Object.create(null), i;
      ANN.trop = false;
      var saines = ls.map(function (l) {
        if (l.length > ANNONCES_MAX) ANN.trop = true;
        var textes = Object.create(null);
        return l.slice(0, 10 * ANNONCES_MAX).filter(function (a) {
          if (!a || typeof a !== "object" || textes[a.texte] || !annonceSaine(a, auteur, sigs)) return false;
          textes[a.texte] = true; return true;
        }).slice(0, ANNONCES_MAX);
      });
      // le plafond porte sur les TEXTES distincts (la signature ne couvre que le texte) : une source qui rejoue les annonces
      // authentiques avec de faux txid n'evince jamais l'entree, au vrai txid, que donne l'autre source pour le meme texte
      var choisis = Object.create(null), n = 0;
      for (i = 0; i < ANNONCES_MAX; i++) saines.forEach(function (l) {
        var a = l[i]; if (!a) return;
        if (!choisis[a.texte]) { if (n >= ANNONCES_MAX) { ANN.trop = true; return; } choisis[a.texte] = true; n++; }
        var k = [a.texte, a.signature, a.txid_gravure].map(String).join("|");
        if (!vues[k]) { vues[k] = true; out.push(a); }
      });
      return out;
    });
  }
  function verifierAnnonce(a, auteur, cleCache) {   // rend { ok, h, emp, ... } ou { ok: false, h, raison }
    var m = RE_ANNONCE.exec(typeof a.texte === "string" ? a.texte : "");
    if (!m) return Promise.resolve({ ok: false, h: entier(a.numero) ? a.numero : null, raison: "ann_texte" });   // h = 0, 1, 1000, ou texte mal forme
    var h = +m[1], emp = m[2];
    function non(r) { return { ok: false, h: h, emp: emp, raison: r }; }
    if (a.numero !== h || a.empreinte_manifeste !== emp) return Promise.resolve(non("ann_texte"));
    if (!/^[0-9a-f]{64}$/.test(String(a.txid_gravure || ""))) return Promise.resolve(non("ann_gravure"));
    if (!auteur) return Promise.resolve(non("ann_sans_auteur"));
    if (a.adresse !== auteur || !bip322(auteur, a.texte, String(a.signature || ""))) return Promise.resolve(non("ann_signature"));
    // un brouillon : la copie gardee de la chasse suivie (ch<h>_manif_texte) n'est ecrite que par suivreChasse ; verifier une annonce
    // perdante ne doit jamais l'effacer (la chasse suivie reste lisible si la librairie tombe)
    return lireTexte(urlsChasse(h, "manifeste.json"), cleCache || "ann_manif_texte", emp).then(function (tx) {
      if (!tx) return non("ann_manifeste");
      var man; try { man = JSON.parse(tx); } catch (e) { return non("ann_manifeste"); }
      var d = man.definition;
      if (!definitionValide(d) || d.numero !== h || man.chasse !== h || man.annee_A !== d.annee || !manifesteValide(man) || man.coffres.length !== d.coffres ||
          man.coffres.some(function (k, i) { return k.n !== i + 1 || k.type !== d.types[i]; }) || !man.messages || man.messages.adresse !== auteur) return non("ann_definition");
      return explo("/tx/" + a.txid_gravure).then(function (g) {
        if (!g || !g.status || !g.status.confirmed) return non("ann_gravure");
        var so = scriptOpReturn(a.texte);
        if (!(g.vout || []).some(function (o) { return o.scriptpubkey === so; })) return non("ann_gravure_texte");
        var am = man.amorce || {};                 // la gravure depense le rendu de l'amorce de SA chasse (la Cave l'impose : mode 26, choix 7)
        if (!/^[0-9a-f]{64}$/.test(String(am.txid)) || !entier(am.vout_rendu) ||
            !(g.vin || []).some(function (e) { return e && e.txid === am.txid && e.vout === am.vout_rendu; })) return non("ann_gravure_entree");
        if (!(g.status.block_time < heureDef(d, 1, 3))) return non("ann_gravure_tard");
        return { ok: true, h: h, emp: emp, a: a, man: man, manTexte: tx, def: d, temps: g.status.block_time, bloc: entier(g.status.block_height) ? g.status.block_height : null };
      }, function () { return non("ann_injoignable"); });
    }, function () { return non("ann_manifeste"); });
  }
  // une chasse retenue : sa definition inscrite (ici et dans les regles communes), son COFFRET lu selon la regle de la Cave, ouvert a l'heure ;
  // verifiee : son annonce vient d'etre reverifiee (signature, gravure aux deux sources, manifeste) ; sinon rien ne s'ouvre
  function suivreChasse(h, r, verifiee) {
    return lireTexte(urlsChasse(h, "manifeste.json"), "ch" + h + "_manif_texte", r.empreinte_manifeste).then(function (tx) {
      var Z = ZS[h] || (ZS[h] = etatZ(h));
      Z.erreur = null;
      if (!tx) { Z.erreur = "manifeste"; return; }
      var man = lireJson(tx), d = man && man.definition;
      if (!definitionValide(d) || d.numero !== h) { Z.erreur = "forme"; return; }
      CHASSES[h] = d; GGR.enregistrer(d);
      Z.etat = { annonce: r, hors_ligne: !M.etat }; Z.annonce = r; Z.man = man; Z.manTexte = tx;
      Z.grave = verifiee ? "ok" : "attente";                                   // la gravure de l'annonce prouve le manifeste, reverifiee a ce chargement
      return chargerCoffretZ(Z);
    }).catch(function () { var Z = ZS[h]; if (Z) Z.erreur = Z.erreur || "absent"; });
  }
  function auteurEpingle() {   // l'adresse de l'auteur est-elle epinglee dans ce programme (ancre generale, ou ancre de la chasse 0 ou 1) ?
    var a = window.GG_ANCRE || {}, an0 = ancreChasse(0), an1 = ancreChasse(1);
    return !!(a.adresse_auteur || (an0 && an0.adresse_auteur) || (an1 && an1.adresse_auteur));
  }
  function graveeAvant(x, y) {   // l'ordre des gravures : hauteur de bloc si les deux la portent, sinon heure du bloc ; puis txid
    var hx = entier(x.bloc) ? x.bloc : null, hy = entier(y.bloc) ? y.bloc : null;
    if (hx != null && hy != null && hx !== hy) return hx < hy;
    var tx = entier(x.temps) ? x.temps : Infinity, ty = entier(y.temps) ? y.temps : Infinity;
    if ((hx == null || hy == null) && tx !== ty) return tx < ty;
    return String(x.txid_gravure || "") < String(y.txid_gravure || "");
  }
  function oublierChasse(h) { delete ZS[h]; delete CHASSES[h]; GGR.oublier(+h); if (CZ.h === +h) CZ = ZS[0]; }
  function chargerAnnonces() {
    if (R.demo || ANN.enCours) return Promise.resolve();
    ANN.enCours = true;
    var ret = lireR("chasses_retenues", {}), cont = lireR("chasses_contestees", {});
    return adresseAuteur().then(function (au) {
      return lireAnnonces(au.a).then(function (liste) {
        ANN.auteur = au.a; ANN.lues = liste.length; ANN.refus = {}; ANN.alertes = [];
        if (au.conflit) ANN.alertes.push({ k: "ann_auteur_conflit" });
        if (ANN.trop) ANN.alertes.push({ k: "ann_trop", v: { n: ANNONCES_MAX } });
        if (!auteurEpingle()) {   // sans ancre, l'adresse de l'auteur ne reposerait que sur la premiere lecture d'un manifeste : rien n'est retenu
          liste.forEach(function (a) { ANN.refus[a.numero] = "ann_sans_ancre"; });
          Object.keys(ret).forEach(function (h) { ANN.refus[h] = "ann_sans_ancre"; });
          if (Object.keys(ANN.refus).length) ANN.alertes.push({ k: "ann_ancre_absente" });
          return;
        }
        if (au.a) Object.keys(ret).forEach(function (h) { if (ret[h].adresse !== au.a) { delete ret[h]; oublierChasse(h); } });   // signee par une autre adresse que l'epinglee
        // chaque chasse retenue est REVERIFIEE a chaque chargement (audit godgift I3), comme une annonce nouvelle : sa copie du manifeste est
        // la sienne (ch<h>_manif_texte) ; les annonces lues aux sources ne sont verifiees qu'une fois chacune
        function cleA(a) { return [a.texte, a.signature, a.txid_gravure].map(String).join("|"); }
        var vues = {}, aVerifier = [];
        Object.keys(ret).forEach(function (h) {
          var x = ret[h], a = { numero: +h, texte: x.texte, signature: x.signature, adresse: x.adresse, txid_gravure: x.txid_gravure, empreinte_manifeste: x.empreinte_manifeste, cache: "ch" + h + "_manif_texte" };
          vues[cleA(a)] = true; aVerifier.push(a);
        });
        liste.forEach(function (a) { if (!vues[cleA(a)]) { vues[cleA(a)] = true; aVerifier.push(a); } });
        var res = [], parCle = {}, TRANSITOIRES = ["ann_injoignable", "ann_manifeste", "ann_gravure"], aVerifiees = {};
        return parLots(aVerifier, 4, function (a) { return verifierAnnonce(a, au.a, a.cache).then(function (x) { res.push(x); parCle[cleA(a)] = x; }); }).then(function () {
          var cand = {}, echecs = {};   // par numero : la chasse retenue et les annonces verifiees, au format retenu
          Object.keys(ret).forEach(function (h) {
            var x = parCle[cleA(ret[h])];
            if (x && x.ok) { cand[h] = [Object.assign({}, ret[h], { temps: x.temps, bloc: x.bloc })]; aVerifiees[h] = ret[h].empreinte_manifeste; }
            else if (x && TRANSITOIRES.indexOf(x.raison) < 0) { ANN.alertes.push({ k: "ann_retiree", v: { n: h, r: t(x.raison) } }); delete ret[h]; oublierChasse(h); }
            else cand[h] = [ret[h]];                                           // reseau ou manifeste injoignable : suivie, mais rien ne s'ouvre
          });
          res.forEach(function (x) {
            if (x.ok && aVerifiees[x.h] === x.emp && ret[x.h] && x.a.texte === ret[x.h].texte && x.a.signature === ret[x.h].signature && x.a.txid_gravure === ret[x.h].txid_gravure) return;
            if (x.ok) { (cand[x.h] = cand[x.h] || []).push({ texte: x.a.texte, signature: x.a.signature, adresse: x.a.adresse, txid_gravure: x.a.txid_gravure, empreinte_manifeste: x.emp, temps: x.temps, bloc: x.bloc }); aVerifiees[x.h + ":" + x.emp] = true; }
            else if (x.h != null) echecs[x.h] = x.raison;
          });
          Object.keys(echecs).forEach(function (h) { if (!cand[h]) ANN.refus[h] = echecs[h]; });
          Object.keys(cand).forEach(function (h) {   // la plus ancienne gravure gagne ; les annonces suivantes d'un autre manifeste sont refusees
            var g = cand[h].reduce(function (m, x) { return graveeAvant(x, m) ? x : m; });
            var refusees = (Array.isArray(cont[h]) ? cont[h] : []).concat(cand[h].map(function (x) { return x.empreinte_manifeste; }))
              .filter(function (e, i, l) { return e !== g.empreinte_manifeste && l.indexOf(e) === i; });   // la gagnante n'est jamais bloquee
            if (refusees.length) cont[h] = refusees; else delete cont[h];
            if (ret[h] && ret[h].empreinte_manifeste !== g.empreinte_manifeste) oublierChasse(h);   // une annonce gravee plus tot remplace la chasse suivie
            ret[h] = g;
          });
          Object.keys(cont).forEach(function (h) { ANN.alertes.push({ k: "ann_contradiction", v: { n: h } }); ANN.refus[h] = "ann_contredite"; });
          ecrireR("chasses_contestees", cont); ecrireR("chasses_retenues", ret);
          return parLots(Object.keys(ret), 2, function (h) { return suivreChasse(+h, ret[h], aVerifiees[h] === ret[h].empreinte_manifeste || !!aVerifiees[h + ":" + ret[h].empreinte_manifeste]); });
        });
      });
    }).catch(function () { }).then(function () { ANN.enCours = false; });
  }

  function contenuZ(type, numero, coffre, Z, rang) {   // le clair d'un verrou ouvert de la chasse affichee (ou de Z)
    Z = Z || CZ;
    var e = elementsDe(Z).filter(function (x) { return x.type === type && (numero == null || x.numero === numero) && (coffre == null || x.coffre === coffre) && (rang == null || x.rang === rang); })[0];
    return e ? contenuDe(Z, e) : null;
  }
  function aleaZ(n, Z) {   // « AEDE:cri:H<h>:<n>: » puis 64 hexadecimaux, en ASCII dans la transaction du cri ouvert du coffre n
    n = n || 1; Z = Z || CZ;
    var c = contenuZ("cri", null, n, Z), mq = C.hex(C.utf8("AEDE:cri:H" + Z.h + ":" + n + ":"));
    var i = c && typeof c.hex === "string" ? c.hex.indexOf(mq) : -1; if (i < 0) return null;
    var h = c.hex.substr(i + mq.length, 128), s = ""; for (var j = 0; j < 128; j += 2) s += String.fromCharCode(parseInt(h.substr(j, 2), 16));
    return GGR.aleaTenu(Z.man, n, s) ? s : null;                               // seulement l'alea que le manifeste grave engage (audit protocole M3)
  }
  function coffreZ(n, Z) { Z = Z || CZ; return Z.man ? Z.man.coffres.filter(function (k) { return k.n === n; })[0] || null : null; }
  function motsZ(n, Z) { return MOTS[CHASSES[(Z || CZ).h].types[(n || 1) - 1]] || 3; }
  function pageChasse(arg) {   // #/chasse/<h> : la chasse zero, ou une chasse annoncee et verifiee
    var h = parseInt(arg, 10); if (!(h >= 0)) h = 0;
    if (h !== 0 && !(ZS[h] && CHASSES[h])) {
      return '<div class="sur">' + esc(t("ch_sur")) + '</div><h1>' + esc(t("chasse_n", { n: h })) + aide("annonce") + '</h1><div class="bandeau">' +
        esc(ANN.refus[h] ? t("ch_refusee", { r: t(ANN.refus[h]) }) : t("ch_inconnue")) + '</div><p><a href="#/chasses">← ' + esc(t("m_chasses")) + "</a></p>";
    }
    CZ = ZS[h];
    return pageChasseZero();
  }
  function teteChasse() {   // le titre et l'introduction : la chasse zero, ou une chasse annoncee (sa definition, son annonce)
    var cz = CHASSES[CZ.h];
    if (CZ.h === 0) return '<div class="sur">' + esc(t("cz_sur")) + '</div><h1>' + esc(t("cz_titre")) + aide("cz") + "</h1><p style=\"max-width:820px\">" + esc(t("cz_intro", { e: cz.euros[0], n: cz.coffres })) + "</p>";
    var a = CZ.annonce || {};
    return '<div class="sur">' + esc(t("ch_sur")) + " · " + esc(t("chasse_n", { n: CZ.h })) + '</div><h1>' + esc(cz.nom) + aide("annonce") + "</h1><p style=\"max-width:820px\">" +
      esc(t("ch_intro", { n: cz.coffres, e: fsats(sommeEuros(cz)), d: fdate(heureZ(1, 3), true), r: t(cz.parallele ? "ch_rythme_par" : "ch_rythme_mois") })) + '</p><p class="doux mono" style="font-size:12px;word-break:break-all">' +
      esc(a.texte || "") + "<br>" + esc(t("ch_annonce_ok", { d: a.temps ? fdate(a.temps, true) : "?" })) + ' <a href="' + esc(webExplo("/tx/" + (a.txid_gravure || ""))) + '" target="_blank" rel="noopener">' + esc(String(a.txid_gravure || "").slice(0, 16)) + "…</a></p>";
  }
  function pageChasseZero() {
    var cz = CHASSES[CZ.h];
    var tete = teteChasse();
    if (R.demo) return tete + '<div class="bandeau">' + esc(t(CZ.h === 0 ? "cz_demo" : "ch_demo")) + "</div>";
    if (!CZ.etat) return tete + '<div class="cadre"><p>' + esc(t("cz_avant")) + '</p><div class="compte" data-compte="' + heureZ(1, 3) + '">' + fcompte(heureZ(1, 3) - maintenant()) + "</div></div>";
    if (CZ.erreur) return tete + '<div class="bandeau">' + esc(t(messageCoffret(CZ.erreur))) + "</div>" + (CZ.erreurDetail ? '<p class="doux mono" style="font-size:11px">' + esc(CZ.erreurDetail) + "</p>" : "");
    var now = maintenant(), ks = CZ.man ? CZ.man.coffres : [];
    var elts = CZ.coffret ? CZ.coffret.elements.slice().sort(function (a, b) { return a.ouverture_utc - b.ouverture_utc; }) : [];
    var pro = elts.filter(function (e) { return CZ.ouverts[cleV(e)] == null && e.ouverture_utc > now; })[0];
    // les coffres (en parallele ou un par mois) : leur tresor, leur adresse
    var cartes = ks.map(function (k, i) {
      var n = k.n, s = CZ.soldes[n], etat = CZ.depenses[n] ? t("e_pris") : s ? fsats(s) + " sats" + (M.prixEur ? " · ≈ " + feur(s / 1e8 * M.prixEur) : "") : "…";
      return '<div class="cadre apparait" style="--i:' + i + '"><div class="sur">' + esc(t("coffre_n", { n: n })) + (cz.euros[n - 1] ? " · " + esc(feur(cz.euros[n - 1])) : "") + '</div><div class="tresor or">' + esc(etat) +
        '</div><p class="doux mono" style="font-size:12px;word-break:break-all"><a href="' + esc(webExplo("/address/" + k.adresse)) + '" target="_blank" rel="noopener">' + esc(k.adresse) + "</a></p></div>";
    }).join("");
    var prochaine = '<div class="cadre"><div class="sur">' + esc(t("prochaine_ouverture")) + "</div>" + (pro ? '<div class="compte" data-compte="' + (+pro.ouverture_utc || 0) + '">' + fcompte(pro.ouverture_utc - now) + '</div><div class="doux">' +
      elts.filter(function (e) { return e.ouverture_utc === pro.ouverture_utc && e.type === pro.type && CZ.ouverts[cleV(e)] == null; }).map(function (e) { return esc(t(cleOuv(e), { n: e.coffre, e: e.numero || "" })); }).join(", ") +
      " · " + esc(fdate(pro.ouverture_utc, true)) + "</div>" : "<div>" + esc(t("tout_ouvert")) + "</div>") +
      (CZ.grave !== "ok" ? '<p class="att" style="font-size:12px">' + esc(t(CZ.grave === "signature" ? "coffret_signature_ko" : "coffret_gravure_attente")) + "</p>" : "") + "</div>";
    var tete2 = '<div class="grille-cz" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">' + cartes + prochaine + "</div>";
    // les textes, coffre par coffre : ses deux enigmes (le 3 et le 17), puis ses deux indices (J+30 et J+182 apres le cri) une fois ouverts,
    // et la solution si l'auteur l'a publiee apres la prise (message signe, verifie contre l'engagement grave ; jamais recopiee dans les reponses)
    var textes = ks.map(function (k, i) {
      var n = k.n, x = '<div class="cadre apparait" style="--i:' + (i + 1) + '"><div class="sur">' + esc(t("coffre_n", { n: n })) + "</div>";
      [[2 * n - 1, 3], [2 * n, 17]].forEach(function (p) {
        var c = contenuZ("enigme", p[0]);
        x += '<div style="margin-top:10px"><span class="tag">' + esc(t("enigme_n", { n: p[0] })) + " · " + esc(fdate(heureZ(n, p[1]), true)) + '</span><div class="cg" style="font-size:19px;margin-top:8px;white-space:pre-wrap">' + (c ? esc(texteEnigme(c)) : "🔒") + "</div></div>";
      });
      [1, 2].forEach(function (rg) {
        var ind = contenuZ("indice", null, n, CZ, rg), e = elementsDe(CZ).filter(function (y) { return y.type === "indice" && y.coffre === n && y.rang === rg; })[0];
        if (ind) x += '<div style="margin-top:10px"><span class="tag">' + esc(t("v_indice_" + rg)) + '</span><p style="white-space:pre-wrap">' + esc(texteEnigme(ind)) + "</p></div>";
        else if (e) x += '<div class="doux" style="margin-top:10px;font-size:12px">🔒 ' + esc(t("v_indice_" + rg)) + " · " + esc(t("s_ouvre_le", { d: fdate(e.ouverture_utc, true) })) + "</div>";
      });
      solutionsSignees().filter(function (s) { return s.h === CZ.h && s.c === n; }).forEach(function (s) {
        x += '<div style="margin-top:10px"><span class="tag">' + esc(t("sol_titre")) + "</span> " + badgeSolution(s) + ' <a href="#/messages">' + esc(fdateIso(s.m.date)) + "</a></div>";
      });
      return x + "</div>";
    }).join("");
    var nz = coffreZ(CZ.coffre) ? CZ.coffre : 1, kz = coffreZ(nz), mz = motsZ(nz);
    var al = CZ.aleas[nz] != null ? CZ.aleas[nz] : (aleaZ(nz) || "");
    var res = CZ.calcul ? '<div style="margin-top:12px"><div class="barre"><i style="width:' + Math.round(CZ.prog * 100) + '%"></i></div><div class="doux" style="font-size:12px;margin-top:4px">' + esc(t("calcul_en_cours")) + "</div></div>" : (CZ.res || "");
    var choix = '<label>' + esc(t("quel_coffre")) + '</label><select class="champ" id="z-coffre"' + (CZ.calcul ? " disabled" : "") + ">" + ks.map(function (k) { return '<option value="' + k.n + '"' + (k.n === nz ? " selected" : "") + ">" + esc(t("coffre_n", { n: k.n })) + "</option>"; }).join("") + "</select>";
    var chasser = '<h2>' + esc(t("cz_chasser")) + '</h2><div class="cadre">' + choix + '<label>' + esc(t("reponse_3", { m: mz })) + '</label><input class="champ" id="z-r3" autocomplete="off" spellcheck="false"><div class="doux mono" id="z-v3" style="font-size:12px;min-height:18px"></div><label>' +
      esc(t("reponse_17", { m: mz })) + '</label><input class="champ" id="z-r17" autocomplete="off" spellcheck="false"><div class="doux mono" id="z-v17" style="font-size:12px;min-height:18px"></div><label>' + esc(t("alea_du_cri")) + '</label><input class="champ mono" id="z-alea" autocomplete="off" spellcheck="false" value="' + esc(al) + '" placeholder="' + esc(t("ph_64")) + '"><p><button class="bouton" id="z-calculer"' + (CZ.calcul ? " disabled" : "") + ">" + esc(t("calculer")) + "</button></p>" + res + "</div>";
    var tresors = ks.map(function (k) { return carteTresor(k.adresse); }).join("");
    return tete + tete2 + tresors + '<div class="deux" style="margin-top:14px">' + textes + "</div>" + chasser + carteArmement(kz ? { n: nz, h: CZ.h, adresse: kz.adresse } : null);
  }
  function calculerZ() {
    var Z = CZ, n = coffreZ(Z.coffre, Z) ? Z.coffre : 1, m = motsZ(n, Z), v3 = $("z-r3").value, v17 = $("z-r17").value, r3 = lireReponse(v3, m), r17 = lireReponse(v17, m), a = ($("z-alea").value || "").trim().toLowerCase();
    Z.aleas[n] = a;
    if (r3.err.length || r17.err.length) { Z.res = '<p class="ko">' + esc(t("reponse_incomplete")) + "</p>"; return rendre(); }
    if (!/^[0-9a-f]{64}$/.test(a)) { Z.res = '<p class="ko">' + esc(t("alea_invalide")) + "</p>"; return rendre(); }
    if (!GGR.aleaTenu(Z.man, n, a)) { Z.res = '<p class="ko">' + esc(t("alea_faux")) + "</p>"; return rendre(); }   // un faux cri ne trompe pas (audit protocole M3)
    var ch = C.chaineCoffre(n, r3.nums, r17.nums, a, Z.h), kz = coffreZ(n, Z), cible = kz && kz.adresse;
    Z.calcul = true; Z.prog = 0; Z.res = null; rendre(); $("z-r3").value = v3; $("z-r17").value = v17;
    C.cleCoffre(n, ch, function (p) { Z.prog = p; var b = document.querySelector(".barre i"); if (b && CZ === Z) b.style.width = Math.round(p * 100) + "%"; }, null, Z.h).then(function (k) {
      var adr = C.adresseDeCle(k);
      Z.res = adr === cible ? apresTrouve({ n: n, h: Z.h, adresse: cible }, k)
        : '<div class="cadre" style="margin-top:12px"><div class="ko">✗ ' + esc(t("pas_la_cle")) + '</div><p class="doux mono" style="font-size:12px">' + esc(t("adresse_obtenue")) + " " + esc(adr) + "<br>" + esc(t("adresse_attendue")) + " " + esc(cible || "") + "</p></div>";
    }, function (e) { Z.res = '<p class="ko">' + esc(e.message === "memoire" ? t("memoire") : String(e.message || e)) + "</p>"; }).then(function () {
      Z.calcul = false; rendre(); if ($("z-r3") && CZ === Z) { $("z-r3").value = v3; $("z-r17").value = v17; }
    });
  }

  // ------------------------------------------------------------------ l'accueil (premier lancement)
  var AC = { pas: 1, temoin: R.temoin, lang: R.lang, src: R.explo === EXPLO_DEF || WEB ? "public" : "noeud", noeud: R.explo === EXPLO_DEF ? "http://umbrel.local:3006/api" : R.explo };
  var AC_FONDS = ["accueil_vouivre", "accueil_vitrine", "accueil_sceau", "cave_forte"];   // une image du livre par ecran
  function accueil() {
    var el = $("accueil"), prem = el.hidden || !$("ac-corps"); el.hidden = false;
    if (prem) el.innerHTML = AC_FONDS.map(function (f, i) { return '<div class="ac-fond" data-fond="' + (i + 1) + '" style="background-image:url(img/fond_' + f + '.jpg)"></div>'; }).join("") +
      '<div class="ac-voile"></div><div class="ac-legende" id="ac-legende"></div><div class="ac-panneau" role="dialog" aria-modal="true">' +
      '<div class="ac-tete"><img src="img/icone.png" alt=""><div><div class="n">GodGift Core</div><small id="ac-sous"></small></div></div>' +
      '<div class="ac-pas"><i></i><i></i><i></i><i></i></div><div id="ac-corps"></div><div class="ac-pied" id="ac-pied"></div></div>';
    document.querySelectorAll(".ac-fond").forEach(function (f) { f.classList.toggle("on", +f.dataset.fond === AC.pas); });
    document.querySelectorAll(".ac-pas i").forEach(function (i, n) { i.classList.toggle("fait", n < AC.pas); });
    $("ac-sous").textContent = t("ac_sous"); $("ac-legende").textContent = t("ac_legende" + AC.pas);
    var coche = '<span class="coche">✓</span>', b;
    if (AC.pas === 1) b = '<h3>' + esc(t("ac_langue")) + '</h3><div class="ac-langues">' + LANGUES.map(function (l) { return '<div class="choix' + (l[0] === AC.lang ? " sel" : "") + '" data-lang="' + l[0] + '"><span class="code">' + l[0].toUpperCase() + "</span><b>" + l[1] + "</b>" + coche + "</div>"; }).join("") + "</div>";
    else if (AC.pas === 2) b = '<h3>' + esc(t("ac_chaine")) + '</h3><div class="ac-sources">' +
      '<div class="choix' + (AC.src === "public" ? " sel" : "") + '" data-src="public"><span class="ic">◎</span><div><b>' + esc(t("ac_public")) + "</b><small>" + esc(t("ac_public_n")) + "</small></div>" + coche + "</div>" +
      (WEB ? '<div class="choix" style="opacity:.55;cursor:default"><span class="ic">⬢</span><div><b>' + esc(t("ac_noeud")) + "</b><small>" + esc(t("explo_note_web")) + "</small></div></div></div>" :   // la version web ne joint que les sources prevues, en https
      '<div class="choix' + (AC.src === "noeud" ? " sel" : "") + '" data-src="noeud"><span class="ic">⬢</span><div><b>' + esc(t("ac_noeud")) + "</b><small>" + esc(t("ac_noeud_n")) + "</small></div>" + coche + "</div></div>") +
      (AC.src === "noeud" && !WEB ? '<input id="ac-noeud" spellcheck="false" value="' + esc(AC.noeud) + '">' : "");
    else if (AC.pas === 4) {
      b = '<h3>' + esc(t("ac4_titre")) + '</h3><div class="ac-promesse"><div class="sur">' + esc(t("promesse")) + ' 1</div><p>' + esc(phraseJamais()) + '</p></div><div class="ac-promesse"><div class="sur">' + esc(t("promesse")) + ' 2</div><p>' + esc(t("jamais_3")) + "</p></div>" +
        '<h3 style="margin-top:14px">' + esc(t("ac4_q")) + '</h3><p class="ac-note" style="margin-top:4px">' + esc(t("ac4_texte")) + '</p><div class="ac-sources">' +
        '<div class="choix fort' + (AC.temoin === true ? " sel" : "") + '" data-ac-temoin="1"><span class="ic">✦</span><div><b>' + esc(t("ac4_oui")) + "</b><small>" + esc(t("ac4_oui_n")) + "</small></div>" + coche + "</div>" +
        '<div class="choix' + (AC.temoin === false ? " sel" : "") + '" data-ac-temoin="0"><span class="ic">○</span><div><b>' + esc(t("ac4_non")) + "</b><small>" + esc(t("ac4_non_n")) + "</small></div>" + coche + "</div></div>";
    }
    else if (WEB) b = '<h3>' + esc(t("ac_bon")) + "</h3><p>" + esc(t("ac_bon_web")) + "</p>";   // contre-audit N3 : la version web ne s'atteste pas elle-meme
    else {
      var e = window.GG_EMPREINTE;
      b = '<h3>' + esc(t("ac_bon")) + "</h3><p>" + esc(t("ac_bon_texte")) + '</p><div class="ac-emp" id="ac-emp">' + e.empreinte.match(/.{4}/g).map(function (g) { return "<span>" + g + "</span>"; }).join("") + "</div>" +
        '<div class="ac-sous"><span class="ok">✓ ' + esc(t("ac_fichiers", { n: e.fichiers })) + '</span><button class="ac-copier" id="ac-copier">' + esc(t("ac_copier")) + "</button></div>" +
        '<p class="ac-note">' + esc(t("ac_bon_note")) + "</p>";
    }
    $("ac-corps").innerHTML = '<div class="ac-corps"><div class="pas">' + AC.pas + " / 4</div>" + b + "</div>";
    var tactile = window.matchMedia && window.matchMedia("(hover: none)").matches;
    $("ac-pied").innerHTML = (AC.pas > 1 ? '<button class="bouton2" id="ac-retour">' + esc(t("retour")) + "</button>" : '<span class="aide">' + esc(tactile ? t("ac_toucher") : t("ac_entree")) + "</span>") +
      '<button class="bouton" id="ac-suivant"' + (AC.pas === 4 && AC.temoin == null ? " disabled" : "") + ">" + esc(AC.pas < 4 ? t("suivant") : t("ouvrir_gg")) + " →</button>";
    document.documentElement.lang = R.lang;
  }
  function accueilClic(ev) {
    var x = ev.target.closest("[data-lang],[data-src],[data-ac-temoin],#ac-suivant,#ac-retour,#ac-copier"); if (!x) return;
    if (x.dataset.acTemoin) { AC.temoin = x.dataset.acTemoin === "1"; return accueil(); }
    if (x.dataset.lang) { AC.lang = R.lang = x.dataset.lang; }
    else if (x.dataset.src) { AC.src = x.dataset.src; accueil(); if (AC.src === "noeud") $("ac-noeud").focus(); return; }
    else if (x.id === "ac-copier") {
      var fait = function () { x.textContent = "✓ " + t("ac_copie"); };
      try { navigator.clipboard.writeText(window.GG_EMPREINTE.empreinte).then(fait, fait); } catch (e) { fait(); }
      return;
    }
    else if (x.id === "ac-retour") AC.pas--;
    else if (x.id === "ac-suivant") {
      if (AC.pas === 2 && AC.src === "noeud") AC.noeud = ($("ac-noeud").value || "").trim() || AC.noeud;
      if (AC.pas < 4) AC.pas++;
      else {
        if (AC.temoin == null) return;                                       // le choix du temoin se fait, il ne se presume pas
        R.explo = AC.src === "public" ? EXPLO_DEF : AC.noeud; R.installe = true; R.temoin = AC.temoin;
        ecrireR("lang", R.lang); ecrireR("explo", R.explo); ecrireR("installe", true); ecrireR("temoin", R.temoin);
        $("accueil").hidden = true; $("accueil").innerHTML = ""; charger(); return rendre();
      }
    }
    accueil();
  }
  document.addEventListener("keydown", function (ev) {   // au clavier : Entree avance, Echap recule, les fleches changent le choix
    if ($("accueil").hidden) return;
    if (ev.key === "Enter") { ev.preventDefault(); $("ac-suivant").click(); }
    else if (ev.key === "Escape" && AC.pas > 1) $("ac-retour").click();
    else if (/^Arrow/.test(ev.key) && ev.target.id !== "ac-noeud" && AC.pas < 3 && AC.pas !== 3) {
      ev.preventDefault(); var d = /Down|Right/.test(ev.key) ? 1 : -1;
      if (AC.pas === 1) { var i = LANGUES.map(function (l) { return l[0]; }).indexOf(AC.lang); AC.lang = R.lang = LANGUES[(i + d + LANGUES.length) % LANGUES.length][0]; accueil(); }
      else { AC.src = AC.src === "public" ? "noeud" : "public"; accueil(); }
    }
  });

  // ------------------------------------------------------------------ rendu et evenements
  function rendre() {
    var r = route(), p = r.p;
    cadre(p);
    var f = { tableau: pageTableau, coffre: function () { return pageCoffre(r.a); }, enigmes: pageEnigmes, verifier: pageVerifier, chasser: function () { return pageChasser(null); },
      compagnon: pageCompagnon, reseau: pageReseau, reglages: pageReglages, pierre: pagePierre, conditions: pageConditions, coffret: pageCoffret, messages: pageMessages, livres: pageLivres, chasses: pageChasses, chasse: function () { return pageChasse(r.a); }, guide: function () { return pageGuide(r.a); }, plus: pagePlus }[p] || pageTableau;
    var focus = document.activeElement && document.activeElement.id, val = focus && $(focus) ? $(focus).value : null;
    $("page").classList.toggle("calme", MP.pagePrec === location.hash); MP.pagePrec = location.hash;   // les entrees ne rejouent qu'en changeant de page
    // la zone Chasser (et la page d'une chasse, qui a son formulaire) n'est jamais envoyee a un service de traduction (audit godgift I7)
    var chasse = p === "chasser" || p === "chasse";
    $("page").setAttribute("translate", chasse ? "no" : "yes"); $("page").classList.toggle("notranslate", chasse);
    $("page").innerHTML = bandeauFenetre() + f();                               // une fenetre dediee rechargee le dit sur chaque page
    if (focus && $(focus) && val != null && $(focus).tagName !== "SELECT") { $(focus).value = val; $(focus).focus(); }
  }
  window.addEventListener("hashchange", function () {
    var r = route(); if (r.p === "guide" && r.a) G.q = "";
    if (r.p === "chasser" && r.a) { H.choix = r.a; H.res = null; history.replaceState(null, "", "#/chasser"); }
    rendre(); document.querySelector(".dedans").scrollTop = 0; allerAuMot(); fermerMot();
    var pe = $("etat-panneau"); if (pe) { pe.hidden = true; pe.innerHTML = ""; }
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") fermerMot(); });
  document.addEventListener("click", function (ev) {
    if (!$("accueil").hidden) return accueilClic(ev);
    var md = ev.target.closest("[data-mot]"); if (md) { ev.preventDefault(); return ouvrirMot(md.dataset.mot); }
    if (ev.target.closest("[data-fermer-mot]")) { ev.preventDefault(); return fermerMot(); }
    var de = ev.target.closest("#etat-details");
    if (de) {
      var p_ = $("etat-panneau"), ouvert = p_ && !p_.hidden;
      if (!p_) { p_ = document.createElement("div"); p_.id = "etat-panneau"; p_.className = "etat-panneau"; $("ligne-etat").parentNode.insertBefore(p_, $("ligne-etat").nextSibling); }
      p_.hidden = ouvert; p_.innerHTML = ouvert ? "" : detailsEtat(); de.setAttribute("aria-expanded", ouvert ? "false" : "true"); de.textContent = t("et_details") + (ouvert ? " ⌄" : " ⌃");
      return;
    }
    var x = ev.target.closest("[data-p],[data-coffre],#rafraichir,#lancer,#rapport,#h-calculer,#h-lire-cri,#h-wif,#cp-envoyer,#r-garder,#r-accueil,#acheter,#ex-verifier,#ex-garder,[data-diffuser],#z-calculer,#r-rec-garder,#r-rec-changer,#r-rec-annuler,#r-rec-copier,#te-relire,[data-temoin],[data-accelerer],[data-envoyer],[data-annuler],[data-confirmer],[data-wif],[data-rec-ok],#roman-verifier,[data-retape],[data-compagnon],[data-ex-verif]");
    if (!x) return;
    if (x.dataset.p) location.hash = "#/" + x.dataset.p;
    else if (x.dataset.coffre) location.hash = "#/coffre/" + x.dataset.coffre;
    else if (x.id === "rafraichir") { M.pret = false; rendre(); charger(); }
    else if (x.id === "lancer") verifier();
    else if (x.id === "rapport") { ev.preventDefault(); rapport(); }
    else if (x.id === "h-calculer") calculer();
    else if (x.id === "z-calculer") calculerZ();
    else if (x.id === "h-lire-cri") lireCri();
    else if (x.id === "cp-envoyer") window.open(R.caisse.replace(/\/$/, "") + "/compagnon?lang=" + (R.lang === "fr" ? "fr" : "en") + "&adresse=" + encodeURIComponent(CP.adresse) + "&signature=" + encodeURIComponent(CP.signature), "_blank");
    else if (x.id === "r-garder") {
      R.lang = $("r-lang").value; R.explo = $("r-explo").value.trim() || EXPLO_DEF; R.explo2 = $("r-explo2").value.trim(); R.caisse = $("r-caisse").value.trim() || CAISSE_DEF; R.demo = $("r-demo").checked; R.temoin = $("r-temoin").checked;
      if (WEB) {                                                               // la version web ne joint que des sources en https (et sa CSP, que celles prevues)
        if (!/^https:\/\//i.test(R.explo)) R.explo = EXPLO_DEF;
        if (R.explo2 && !/^https:\/\//i.test(R.explo2)) R.explo2 = "";
        if (!/^https:\/\//i.test(R.caisse)) R.caisse = CAISSE_DEF;
      }
      var pr = ($("r-parrain").value || "").trim().toLowerCase(); R.parrain = /^[a-z2-7]{8,10}$/.test(pr) ? pr : null;
      ["lang", "explo", "explo2", "caisse", "demo", "parrain", "temoin"].forEach(function (k) { ecrireR(k, R[k]); }); V.res = null; M.pret = false; rendre(); charger();
    }
    else if (x.id === "r-accueil") { AC.pas = 1; AC.temoin = R.temoin; accueil(); }
    else if (x.id === "r-rec-garder") garderReception();
    else if (x.id === "r-rec-changer") { TR.editRec = true; TR.recErr = null; rendre(); }
    else if (x.id === "r-rec-annuler") { TR.editRec = false; TR.recErr = null; TR.recSaisie = TR.recSig = TR.recNonce = null; rendre(); }
    else if (x.id === "r-rec-copier") { var mt = $("r-rec-msg").textContent, ok2 = function () { x.textContent = "✓ " + t("ac_copie"); }; try { navigator.clipboard.writeText(mt).then(ok2, ok2); } catch (e) { ok2(); } }
    else if (x.dataset.accelerer) accelerer(x.dataset.accelerer);
    else if (x.dataset.envoyer) { var ke = x.dataset.envoyer; delete TR.compte[ke]; if (TR.annule) delete TR.annule[ke]; lancerEnvoi(ke); }
    else if (x.dataset.annuler) { delete TR.compte[x.dataset.annuler]; TR.annule = TR.annule || {}; TR.annule[x.dataset.annuler] = 1; TR.msg[x.dataset.annuler] = { e: "att", d: t("tr_annule") }; rendreSiChasse(); }
    else if (x.dataset.confirmer) { var kc = x.dataset.confirmer, cf0 = TR.confirmer[kc] || {}; delete TR.confirmer[kc]; lancerEnvoi(kc, cf0.fraisImpose || null, true); }
    else if (x.dataset.wif) montrerCle(x.dataset.wif);
    else if (x.dataset.retape) retaper(x.dataset.retape);
    else if (x.dataset.exVerif) { ev.preventDefault(); location.hash = "#/livres"; verifierExemplaire(x.dataset.exVerif); }   // l'exemplaire de reference, dans le registre grave
    else if (x.dataset.compagnon != null) { var lv = MP.livres[+x.dataset.compagnon]; if (lv) { CP.livre = +x.dataset.compagnon; CP.adresse = lv.propriete || ""; CP.signature = ""; CP.statut = null; CP.statutLu = null; } if (location.hash === "#/compagnon") rendre(); else location.hash = "#/compagnon"; }
    else if (x.id === "te-relire") lireTemoins(true);
    else if (x.dataset.temoin) { R.temoin = x.dataset.temoin === "1"; ecrireR("temoin", R.temoin); rendre(); if (R.temoin && V.res) publierConstat(); }
    else if (x.id === "acheter") acheter();
    else if (x.id === "ex-verifier") { MP.exPropriete = null; verifierExemplaire($("ex-emp").value); }
    else if (x.id === "ex-garder" && MP.ex && MP.ex.n) {
      if (!MP.livres.some(function (l) { return l.emp === MP.ex.emp; })) MP.livres.push({ n: MP.ex.n, emp: MP.ex.emp, langue: MP.ex.langue || "", lien: "", propriete: MP.exPropriete || "", regle: MP.ex.e === "ok" });
      ecrireR("livres", MP.livres); MP.ex = null; rendre();
    }
    else if (x.dataset.diffuser) {
      var cri = contenu(elements("cri").filter(function (e) { return e.coffre === +x.dataset.diffuser; })[0]);
      if (cri && typeof cri.hex === "string") diffuser(cri.hex).then(function (r) { x.textContent = r.ok ? "✓ " + t("diffuse") : r.hors_ligne ? t("injoignable") : "⏳ " + t("pas_encore_accepte"); });
    }
    else if (x.dataset.recOk) { receptionReconnue(); rendre(); }
    else if (x.id === "roman-verifier") verifierGravureRoman($("roman-tx").value);
  });
  // la bulle « ? » reste dans la page : si elle deborde a gauche ou a droite, elle glisse d'autant
  function placerBulle(bq) {
    var b = bq.querySelector(".bqb"), zone = $("page"); if (!b || !zone) return;
    b.style.marginLeft = "0px";   // une marge, et non la transformation : l'animation d'entree garde la sienne
    requestAnimationFrame(function () {   // la bulle n'a sa taille qu'une fois affichee
      var z = zone.getBoundingClientRect(), r = b.getBoundingClientRect(), dx = 0;
      if (r.width && r.left < z.left + 10) dx = z.left + 10 - r.left; else if (r.width && r.right > z.right - 10) dx = z.right - 10 - r.right;
      b.style.marginLeft = Math.round(dx) + "px";
    });
  }
  ["mouseover", "focusin"].forEach(function (typ) { document.addEventListener(typ, function (ev) { var bq = ev.target.closest && ev.target.closest(".bq"); if (bq && !bq.contains(ev.relatedTarget)) placerBulle(bq); }); });
  document.addEventListener("change", function (ev) {
    if (ev.target.id === "langue") { R.lang = ev.target.value; ecrireR("lang", R.lang); rendre(); }
    if (ev.target.id === "h-choix") { H.choix = ev.target.value; H.res = null; rendre(); }
    if (ev.target.id === "z-coffre") { CZ.coffre = +ev.target.value || 1; CZ.res = null; rendre(); }   // la chasse zero : quel coffre chasser
    if (ev.target.id === "roman-fichier" && ev.target.files[0]) { var fr_ = ev.target.files[0]; ev.target.value = ""; verifierRoman(fr_); }
    if (ev.target.id === "ex-fichier" && ev.target.files[0]) { var fichier = ev.target.files[0]; ev.target.value = ""; lireExemplaire(fichier); }
  });
  document.addEventListener("input", function (ev) {
    var id = ev.target.id;
    if (id === "h-r3") apercu("h-r3", "h-v3");
    if (id === "h-r17") apercu("h-r17", "h-v17");
    if (id === "z-r3" || id === "z-r17") { var rz = lireReponse(ev.target.value, motsZ(CZ.coffre)), vz = $(id === "z-r3" ? "z-v3" : "z-v17"); vz.innerHTML = !ev.target.value.trim() ? "" : rz.err.length ? '<span class="ko">' + esc(rz.err.join(" · ")) + "</span>" : '<span class="ok">' + rz.nums.map(function (y) { return String(y).padStart(4, "0") + " " + esc(window.GG_LISTE.mots[y - 1]); }).join(" · ") + "</span>"; }
    if (id === "h-dico") $("h-dico-r").innerHTML = dico(ev.target.value);
    if (id === "r-rec-adr") { var ra = ev.target.value.trim(), okA = window.GGTX.decoderAdresse(ra); TR.recSaisie = ra; $("r-rec-msg").textContent = okA ? messageSaisie(ra) : "AEDE:reception:…"; }
    if (id === "r-rec-sig") TR.recSig = ev.target.value;
    if (id === "g-cherche") { G.q = ev.target.value; filtrerGuide(); }
    if (id === "cp-a") { CP.adresse = ev.target.value.trim(); CP.statut = null; CP.statutLu = null; rendre(); }
    if (id === "cp-s") { CP.signature = ev.target.value.trim(); rendre(); }
    if (ev.target.dataset && ev.target.dataset.lien != null) { MP.livres[+ev.target.dataset.lien].lien = ev.target.value.trim(); ecrireR("livres", MP.livres); }
  });
  setInterval(function () {   // les comptes a rebours, chaque seconde ; la chaine, toutes les cinq minutes
    var now = maintenant();
    document.querySelectorAll("[data-compte]").forEach(function (el) { var s = +el.dataset.compte - now; el.textContent = fcompte(s); el.classList.toggle("imminent", s > 0 && s < 60); });
    // la chasse n° 1, la chasse zero et chaque chasse annoncee : chaque verrou du s'ouvre seul, page affichee ou non
    [MP].concat(Object.keys(ZS).map(function (h) { return ZS[h]; })).forEach(function (Z) {
      if (Z.coffret && !Z.ouvreEnCours && Date.now() - (Z.dernierEssai || 0) > 3000 && elementsDe(Z).some(function (e) { return e.ouverture_utc <= now && Z.ouverts[cleV(e)] == null; })) { Z.dernierEssai = Date.now(); ouvrirSuite(Z); }
    });
  }, 1000);
  setInterval(function () { if (!R.demo && !H.calcul && !V.enCours) charger(); }, 300000);

  rendre(); allerAuMot();
  if (!R.demo) Object.keys(TR.envois).forEach(function (kk) { var e = TR.envois[kk]; if (e && !e.fini && e.etat !== "perdu") boucleDiffusion(kk); });
  if (!R.installe) accueil();
  charger();
  // la version web (https://app.angedeleau.com/) : installable sur l'ecran d'accueil ; son service web (gg_sw.js, ecrit par construire.py
  // dans dist/web) ne garde que les fichiers dont l'empreinte est celle de cette version, et ne s'en ecarte jamais
  if (WEB && "serviceWorker" in navigator) navigator.serviceWorker.register("gg_sw.js", { updateViaCache: "none" }).catch(function () { });
  if (EMPREINTE_WEB) {
    try {
      fetch("SHA256SUMS", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); }).then(function (b) {
        return crypto.subtle.digest("SHA-256", b).then(function (h) {
          window.GG_EMPREINTE = { empreinte: C.hex(new Uint8Array(h)), fichiers: new TextDecoder().decode(b).split("\n").filter(Boolean).length };
          rendre();
        });
      }).catch(function () { });
    } catch (e) { }
  }
  // l'interieur du programme, pour les bancs d'essai : le programme livre n'expose que trois fonctions pures ; les bancs travaillent sur une
  // copie de app/ qui expose cet objet (tests/atelier.py), jamais sur le programme livre
  var GG_TOUT = { choisirSorties: choisirSorties, TR: TR, TE: TE, officiel: officiel, explo: explo, sources: sources, receptionValide: receptionValide, receptionReconnue: receptionReconnue,
    publierConstat: publierConstat, lireTemoins: lireTemoins, evenementValide: evenementValide, empreinteDeFichier: empreinteDeFichier, M: M, R: R, MP: MP, CZ: ZS[0], aleaZ: aleaZ, heureZ: heureZ, CHASSES: CHASSES,
    ZS: ZS, ANN: ANN, definitionValide: definitionValide, verifierAnnonce: verifierAnnonce, chargerAnnonces: chargerAnnonces, adresseAuteur: adresseAuteur, lireAnnonces: lireAnnonces, heureDef: heureDef,
    scriptOpReturn: scriptOpReturn, courant: function () { return CZ; }, coffres: coffres, verifier: verifier, V: V, H: H, dateEnigme: dateEnigme, codeCompagnon: codeCompagnon, versWif: versWif,
    lireReponse: lireReponse, bip322: bip322, racine: racine, aleaDuCoffret: aleaDuCoffret, ouvrirDus: ouvrirDus, ouvrirSuite: ouvrirSuite, verifierExemplaire: verifierExemplaire,
    adresseAchat: adresseAchat, refusCoffret: refusCoffret, messageCoffret: messageCoffret, solutionsSignees: solutionsSignees, enigmesParues: enigmesParues, offreForte: offreForte,
    fraisAccel: fraisAccel, webExplo: webExplo, verifierChasse: verifierChasse, verifierRoman: verifierRoman, verifierGravureRoman: verifierGravureRoman, livreGrave: livreGrave,
    adresseEpinglee: adresseEpinglee, ancre: ancre, BALISES: BALISES, QUICKNET: QUICKNET, fenetre: function () { return FENETRE; }, sansInstaller: function () { return SANS_INSTALLER; },
    modeEnvoi: modeEnvoi, receptionScellee: receptionScellee, morceaux: morceaux, masquee: masquee, fenetreRechargee: function () { return FENETRE_RECHARGEE; },
    fichierAttendu: fichierAttendu, prixLivre: prixLivre, lireAttributions: lireAttributions, ATTRIB: ATTRIB, attribution: attribution, secoursValides: secoursValides, basesLibrairie: basesLibrairie, fnombre: fnombre, fheure: fheure, fdate: fdate, CP: CP };
  window.GG = { codeCompagnon: codeCompagnon, dateEnigme: dateEnigme, lireReponse: lireReponse };
})();
