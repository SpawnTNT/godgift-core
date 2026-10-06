/* GodGift Core · les regles communes de la chasse, recopiees EXACTEMENT de la Cave (chasses.py et coffret_v1.py, 2 octobre 2026) :
   l'heure de chaque element du COFFRET (enigme, cri, indice de rang 1 ou 2 ; le type « solution » n'existe plus), la regle de
   lecture d'un COFFRET (types, doublons, heures, rondes ecrites dans les verrous tlock), l'engagement sale grave au semis et la
   ligne « AEDE:solution » des messages signes, l'alea engage par le manifeste, la racine RFC 6962 du registre des exemplaires,
   la forme d'un message signe et la retape d'une adresse (deux morceaux de 8 caracteres tires au hasard, stone5_v1g.py, 3 octobre).
   Aucun secret : que du public. Le banc tests/test_regles.py compare chaque regle a la Cave.
   Licence AGPL-3.0. */
(function (racine) {
  "use strict";
  var C = racine.GGC || (typeof require !== "undefined" ? require("./gg_crypto.js") : null);

  // ------------------------------------------------------------------ le calendrier (chasses.py)
  var DELAI_CRI = 3600;                                      // le cri s'ouvre une heure apres l'enigme du 17
  var DELAIS_INDICE = { 1: 30 * 86400, 2: 182 * 86400 };     // rang 1 : l'indice fort (J+30 apres le cri) ; rang 2 : le second indice (J+182)
  var TYPES_ELEMENT = ["enigme", "cri", "indice"];
  var COFFRES_MAX = 48, H_MAX = 999;
  // les chasses 0 et 1 sont ecrites ici, en dur, et ne se redefinissent pas ; une chasse annoncee (2 a 999) s'inscrit par enregistrer()
  var FIXES = { 0: { coffres: 3, annee: 2026, mois: 11, parallele: true }, 1: { coffres: 24, annee: null, mois: 1, parallele: false } };
  var SUIVANTES = {};
  function entier(x) { return typeof x === "number" && Number.isInteger(x); }
  function refus(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function chasse(h) {
    var d = entier(h) ? (FIXES[h] || SUIVANTES[h]) : null;
    if (!d) throw refus("chasse", "chasse " + h + " inconnue de la Pierre");
    return d;
  }
  function connue(h) { return entier(h) && !!(FIXES[h] || SUIVANTES[h]); }
  function enregistrer(d) {                                  // une definition deja validee (gg_app.js, definitionValide)
    if (!d || !entier(d.numero) || d.numero < 2 || d.numero > H_MAX) throw refus("chasse", "definition : numero de 2 a 999");
    SUIVANTES[d.numero] = { coffres: d.coffres, annee: d.annee, mois: d.mois, parallele: !!d.parallele };
  }
  function oublier(h) { delete SUIVANTES[h]; }
  function nombreDeCoffres(h) { return chasse(h).coffres; }
  function annee(h, A) {
    var a = chasse(h).annee;
    if (a == null) { if (!entier(A)) throw refus("calendrier", "chasse n 1 : l annee A est necessaire"); return A; }
    return a;
  }
  function heureEnigme(h, n, jour, A) {
    var c = chasse(h);
    if (!entier(n) || n < 1 || n > c.coffres || (jour !== 3 && jour !== 17)) throw refus("calendrier", "coffre ou jour hors de la chasse");
    var m0 = annee(h, A) * 12 + (c.mois - 1) + (c.parallele ? 0 : n - 1);
    return Date.UTC(Math.floor(m0 / 12), m0 % 12, jour, 18, 15, 5) / 1000;
  }
  function heurePrevue(h, typ, coffre, numero, A, rang) {   // chasses.heure_prevue
    if (typ === "enigme") {
      if (!entier(numero) || Math.floor((numero + 1) / 2) !== coffre || rang != null) throw refus("calendrier", "numero d enigme incoherent");
      return heureEnigme(h, coffre, numero % 2 ? 3 : 17, A);
    }
    if (TYPES_ELEMENT.indexOf(typ) < 0) throw refus("type", "type d element inconnu : " + JSON.stringify(typ) + " (enigme, cri ou indice ; le type solution n existe plus)");
    if (numero != null) throw refus("calendrier", "seule une enigme porte un numero");
    var t17 = heureEnigme(h, coffre, 17, A);
    if (typ === "cri") {
      if (rang != null) throw refus("calendrier", "un cri n a pas de rang");
      return t17 + DELAI_CRI;
    }
    if (!entier(rang) || !DELAIS_INDICE[rang]) throw refus("calendrier", "rang d indice : 1 (indice fort, J+30) ou 2 (second indice, J+182)");
    return t17 + DELAI_CRI + DELAIS_INDICE[rang];
  }
  function heureElement(h, e, A) {
    if (!e || typeof e !== "object" || Array.isArray(e)) throw refus("format", "element de COFFRET : un objet JSON");
    return heurePrevue(h, e.type, e.coffre, e.numero, A, e.rang);
  }

  // ------------------------------------------------------------------ l'engagement sale et la solution signee (chasses.py)
  var RE_SEL = /^[0-9a-f]{32}$/, NUM = "[1-9][0-9]{0,3}";
  var RE_SOLUTION = new RegExp("^AEDE:solution:(0|[1-9][0-9]{0,2}):([1-9][0-9]?):(" + NUM + "(?:," + NUM + "){2,3}):(" + NUM + "(?:," + NUM + "){2,3}):([0-9a-f]{32})$");
  function numerosTries(mots) {
    if (!Array.isArray(mots) || mots.length < 3 || mots.length > 4 || !mots.every(function (x) { return entier(x) && x >= 1 && x <= 5000; }))
      throw refus("solution", "les mots d une enigme : 3 ou 4 numeros entiers de 1 a 5000");
    if (new Set(mots).size !== mots.length) throw refus("solution", "numeros en double dans une enigme");
    return mots.slice().sort(function (a, b) { return a - b; });
  }
  function corpsSolution(h, coffre, m3, m17, sel) {
    if (!entier(h) || h < 0 || h > H_MAX || !entier(coffre) || coffre < 1 || coffre > COFFRES_MAX) throw refus("solution", "chasse de 0 a 999, coffre de 1 a 48");
    if (connue(h) && coffre > nombreDeCoffres(h)) throw refus("solution", "la chasse " + h + " n a que " + nombreDeCoffres(h) + " coffre(s)");
    var n3 = numerosTries(m3), n17 = numerosTries(m17);
    if (n3.length !== n17.length) throw refus("solution", "les deux enigmes d un coffre ont le meme nombre de mots");
    if (typeof sel !== "string" || !RE_SEL.test(sel)) throw refus("solution", "sel : 32 hexadecimaux minuscules");
    return h + ":" + coffre + ":" + n3.join(",") + ":" + n17.join(",") + ":" + sel;
  }
  function engagement(h, coffre, m3, m17, sel) { return C.sha256hex("AEDE:engagement:" + corpsSolution(h, coffre, m3, m17, sel)); }
  function ligneSolution(h, coffre, m3, m17, sel) { return "AEDE:solution:" + corpsSolution(h, coffre, m3, m17, sel); }
  function croissant(l) { for (var i = 1; i < l.length; i++) if (!(l[i] > l[i - 1])) return false; return true; }
  function lireSolution(texte) {                              // [h, coffre, n3, n17, sel] si la DERNIERE ligne est canonique, sinon null
    if (typeof texte !== "string") return null;
    var l = texte.split("\n"), m = RE_SOLUTION.exec(l[l.length - 1]);
    if (!m) return null;
    var h = parseInt(m[1], 10), c = parseInt(m[2], 10), n3 = m[3].split(",").map(Number), n17 = m[4].split(",").map(Number);
    try { if (ligneSolution(h, c, n3, n17, m[5]) !== m[0] || !croissant(n3) || !croissant(n17)) return null; } catch (e) { return null; }
    return [h, c, n3, n17, m[5]];
  }
  // [h, coffre, vrai si l'engagement grave est tenu] pour un message qui publie une solution ; null s'il n'en publie aucune.
  // Ne remplit jamais les reponses d'un chasseur et ne declenche rien.
  function engagementTenu(texte, man) {
    var s = lireSolution(texte); if (!s) return null;
    var h = s[0], c = s[1];
    try {
      if (!man || typeof man !== "object" || Array.isArray(man) || (man.chasse === undefined ? 1 : man.chasse) !== h) return [h, c, false];
      var cf = (Array.isArray(man.coffres) ? man.coffres : []).filter(function (x) { return x && typeof x === "object" && !Array.isArray(x) && x.n === c; });
      return [h, c, cf.length === 1 && cf[0].engagement === engagement(h, c, s[2], s[3], s[4])];
    } catch (e) { return [h, c, false]; }
  }
  // vrai si l'alea d'un cri (64 hexadecimaux) est celui que le manifeste grave engage (empreinte_alea = SHA-256 de ses 32 octets)
  function aleaTenu(man, coffre, alea) {
    try {
      if (typeof alea !== "string" || !/^[0-9a-f]{64}$/.test(alea)) return false;
      var cf = man.coffres.filter(function (x) { return x && typeof x === "object" && !Array.isArray(x) && x.n === coffre; });
      return cf.length === 1 && cf[0].empreinte_alea === C.hex(C.sha256(C.deHex(alea)));
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ le registre des exemplaires : racine de Merkle RFC 6962, 2.1
  function cat(a, b, c) { var o = new Uint8Array(a.length + b.length + (c ? c.length : 0)); o.set(a); o.set(b, a.length); if (c) o.set(c, a.length + b.length); return o; }
  function mth(f, a, b) {
    var n = b - a;
    if (n === 0) return C.sha256(new Uint8Array(0));
    if (n === 1) return C.sha256(cat(new Uint8Array([0]), f[a]));
    var k = 1; while (k * 2 < n) k *= 2;                     // la plus grande puissance de 2 strictement inferieure a n
    return C.sha256(cat(new Uint8Array([1]), mth(f, a, a + k), mth(f, a + k, b)));
  }
  function racineRegistre(empreintes) {                       // 64 hexadecimaux, ou null si une empreinte est mal formee
    if (!Array.isArray(empreintes) || !empreintes.every(function (e) { return typeof e === "string" && /^[0-9a-f]{64}$/.test(e); })) return null;
    return C.hex(mth(empreintes.map(C.deHex), 0, empreintes.length));
  }

  // ------------------------------------------------------------------ la retape d'une adresse (stone5_v1g.morceaux_a_retaper et _retape_juste)
  // Deux morceaux de 8 caracteres, tires au hasard, hors du prefixe (les 4 premiers caracteres), sans chevauchement : 16 caracteres a
  // egaler, 80 bits pour une adresse bc1q, davantage en base58, et des positions que personne ne connait a l'avance. La Cave le demande
  // pour un compagnon NOUVEAU (regle 8) ; GodGift Core, hors de la fenetre dediee, avant chaque envoi d'un tresor (contre-verification V1 :
  // les 8 derniers caracteres seuls se contrefont en 2^40 essais).
  var MORCEAU = 8, PREFIXE = 4, LONGUEUR_MIN = 20;
  var BLANC = /[\t\n\u000b\f\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g;   // les blancs de str.split()
  function pairesRetape(adresse) {                            // toutes les paires [p1, p2] permises, dans l'ordre de la Cave
    if (typeof adresse !== "string" || adresse.length < LONGUEUR_MIN) throw refus("retape", "adresse attendue");
    var l = [];
    for (var a = PREFIXE; a < adresse.length - (MORCEAU - 1); a++) for (var b = a + MORCEAU; b < adresse.length - (MORCEAU - 1); b++) l.push([a, b]);
    return l;
  }
  function tirage(n) {                                        // un entier uniforme de 0 a n-1, par rejet (aucun biais de modulo)
    var c = typeof crypto !== "undefined" && crypto && crypto.getRandomValues ? crypto : null;
    if (!c) throw refus("retape", "aucune source d alea");
    var lim = Math.floor(4294967296 / n) * n, b = new Uint32Array(1);
    do { c.getRandomValues(b); } while (b[0] >= lim);
    return b[0] % n;
  }
  function morceauxARetaper(adresse, tirer) {                 // [p1, p2] : p1 >= 4, p2 >= p1 + 8, p2 + 8 <= longueur
    var l = pairesRetape(adresse), i = (tirer || tirage)(l.length);
    if (!entier(i) || i < 0 || i >= l.length) throw refus("retape", "tirage hors bornes");
    return l[i].slice();
  }
  // vrai si f = {positions: [p1, p2], texte: adresse[p1:p1+8] + adresse[p2:p2+8]} (blancs ignores, casse indifferente, comme la Cave) ;
  // exacte : la casse compte (adresse en base58, ou « 1abc » et « 1ABC » sont deux adresses differentes)
  function retapeJuste(adresse, f, exacte) {
    if (typeof adresse !== "string" || !f || typeof f !== "object" || Array.isArray(f) || typeof f.texte !== "string" || !Array.isArray(f.positions)) return false;
    var pos = f.positions;
    if (pos.length !== 2 || !pos.every(entier)) return false;
    var p1 = pos[0], p2 = pos[1];
    if (Math.min(p1, p2) < PREFIXE || Math.max(p1, p2) + MORCEAU > adresse.length || Math.abs(p1 - p2) < MORCEAU) return false;
    var tape = f.texte.replace(BLANC, ""), vrai = adresse.slice(p1, p1 + MORCEAU) + adresse.slice(p2, p2 + MORCEAU);
    return exacte ? tape === vrai : tape.toLowerCase() === vrai.toLowerCase();
  }

  // ------------------------------------------------------------------ un message signe de l'auteur : « AEDE:message:<AAAA-MM-JJ>:<texte> »
  function dateValide(d) {                                  // une date qui existe (stone5.lire_date) : 2027-02-31 refuse
    var m = typeof d === "string" ? /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d) : null;
    if (!m) return false;
    var y = +m[1], mo = +m[2], j = +m[3], bis = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return y >= 1 && mo >= 1 && mo <= 12 && j >= 1 && j <= [31, bis ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  }
  function messageBienForme(m) {                              // la forme que la Cave signe (coffret_v1.signer_message)
    return !!m && typeof m === "object" && dateValide(m.date) && typeof m.texte === "string" && m.texte.length > 0 && Array.from(m.texte).length <= 2000 &&
      !/^\s|\s$/.test(m.texte) && typeof m.adresse === "string" && typeof m.signature === "string";
  }

  // ------------------------------------------------------------------ la lecture d'un COFFRET (chasses.controler_coffret)
  var COFFRET_MAX_OCTETS = 8 * 1024 * 1024, CHAMPS_DRAND = ["hash", "public_key", "period", "genesis_time", "schemeID"];
  function rondeA(ch, t) { return Math.ceil((t - ch.genesis_time) / ch.period) + 1; }
  function instantDe(ch, r) { return ch.genesis_time + (r - 1) * ch.period; }
  // (ronde, hash de la chaine) de la seule strophe « -> tlock <ronde> <hash> » d'un verrou age arme ; erreur sinon
  function stropheTlock(arme) {
    if (typeof arme !== "string") throw refus("strophe", "verrou : texte attendu");
    var l = arme.trim().split("\n");
    if (l.length < 3 || l[0] !== "-----BEGIN AGE ENCRYPTED FILE-----" || l[l.length - 1] !== "-----END AGE ENCRYPTED FILE-----") throw refus("strophe", "verrou : armure age attendue");
    var b64 = l.slice(1, -1).join(""), brut;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4) throw refus("strophe", "verrou : armure age illisible");
    try { brut = atob(b64); } catch (e) { throw refus("strophe", "verrou : armure age illisible"); }
    var fin = brut.indexOf("\n---"), tete = fin > 0 ? brut.slice(0, fin).split("\n") : [];
    if (tete.length < 2 || tete[0] !== "age-encryption.org/v1" || tete.filter(function (x) { return x.slice(0, 2) === "->"; }).length !== 1)
      throw refus("strophe", "verrou : en-tete age a une seule strophe attendu");
    var m = /^-> tlock ([1-9][0-9]{0,15}) ([0-9a-f]{64})$/.exec(tete[1]);
    if (!m) throw refus("strophe", "verrou : strophe tlock attendue");
    return { ronde: parseInt(m[1], 10), hash: m[2] };
  }
  // JSON strict : une cle en double, un nombre non entier ou une profondeur demesuree sont refuses (la Cave n'en ecrit jamais)
  var RE_CHAINE = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y, RE_ENTIER = /-?(?:0|[1-9][0-9]*)/y;
  function jsonStrict(t) {
    var i = 0, n = t.length, prof = 0;
    function err() { throw refus("format", "COFFRET illisible (JSON attendu, sans cle en double)"); }
    function ws() { while (i < n) { var c = t.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break; } }
    function jeton(re) { re.lastIndex = i; var m = re.exec(t); if (!m) err(); i = re.lastIndex; return m[0]; }
    function valeur() {
      ws(); if (i >= n) err();
      var c = t[i];
      if (c === "{" || c === "[") {
        if (++prof > 64) err();
        var v = c === "{" ? objet() : tableau(); prof--; return v;
      }
      if (c === '"') return JSON.parse(jeton(RE_CHAINE));
      if (t.substr(i, 4) === "true") { i += 4; return true; }
      if (t.substr(i, 5) === "false") { i += 5; return false; }
      if (t.substr(i, 4) === "null") { i += 4; return null; }
      var x = jeton(RE_ENTIER);
      if (i < n && /[.eE0-9]/.test(t[i])) err();
      return Number(x);
    }
    function objet() {
      var o = {}; i++; ws();
      if (t[i] === "}") { i++; return o; }
      for (;;) {
        ws(); if (t[i] !== '"') err();
        var k = JSON.parse(jeton(RE_CHAINE));
        if (Object.prototype.hasOwnProperty.call(o, k)) err();
        ws(); if (t[i] !== ":") err(); i++;
        Object.defineProperty(o, k, { value: valeur(), enumerable: true, writable: true, configurable: true });
        ws(); if (t[i] === ",") { i++; continue; } if (t[i] === "}") { i++; return o; } err();
      }
    }
    function tableau() {
      var a = []; i++; ws();
      if (t[i] === "]") { i++; return a; }
      for (;;) { a.push(valeur()); ws(); if (t[i] === ",") { i++; continue; } if (t[i] === "]") { i++; return a; } err(); }
    }
    var v = valeur(); ws(); if (i !== n) err();
    return v;
  }
  // La regle de lecture d'un COFFRET, la meme pour la Cave, la librairie, GodGift Core et l'outil du chasseur.
  // texte : le fichier tel quel ; man : le manifeste grave de la chasse, ou null ; ch : la chaine drand (quicknet) ; A : l'annee de
  // la chasse n° 1 si le manifeste manque. Refuse (erreur, avec .code et la raison en clair) : un JSON douteux, une autre chaine drand,
  // une empreinte differente de celle du manifeste, un type inconnu (dont « solution »), un element en double, un element manquant,
  // une heure ou une ronde qui n'est pas celle de la Pierre, une strophe tlock dont la ronde ou la chaine n'est pas celle annoncee.
  function controlerCoffret(texte, man, ch, A) {
    var brut = typeof texte === "string" ? C.utf8(texte) : texte instanceof Uint8Array ? texte : null;
    if (!brut) throw refus("format", "COFFRET : texte attendu");
    if (brut.length > COFFRET_MAX_OCTETS) throw refus("format", "COFFRET trop gros");
    var d;
    try { d = jsonStrict(typeof texte === "string" ? texte : new TextDecoder("utf-8", { fatal: true }).decode(brut)); }
    catch (e) { throw refus("format", "COFFRET illisible (JSON attendu, sans cle en double)"); }
    if (!d || typeof d !== "object" || Array.isArray(d) || d.coffret !== "AEDE-V1" || !Array.isArray(d.elements)) throw refus("format", "ce fichier n est pas un COFFRET AEDE-V1");
    var h = d.chasse;
    if (!connue(h)) throw refus("chasse", "COFFRET d une chasse inconnue : " + JSON.stringify(h));
    if (man != null) {
      if (typeof man !== "object" || Array.isArray(man) || (man.chasse === undefined ? 1 : man.chasse) !== h) throw refus("chasse", "le COFFRET et le manifeste ne sont pas de la meme chasse");
      var mc = man.coffret && typeof man.coffret === "object" && !Array.isArray(man.coffret) ? man.coffret : {};
      if (mc.sha256 != null && mc.sha256 !== C.hex(C.sha256(brut))) throw refus("empreinte", "l empreinte du COFFRET n est pas celle du manifeste grave");
      if (mc.drand != null && mc.drand !== ch.hash) throw refus("reseau", "le manifeste annonce une autre chaine drand");
      if (A == null) A = man.annee_A;
    }
    if (A == null) A = d.annee_A;
    if (!entier(d.annee_A) || d.annee_A !== annee(h, A)) throw refus("calendrier", "annee du COFFRET differente de celle de la chasse");
    var dr = d.drand;
    if (!dr || typeof dr !== "object" || Array.isArray(dr) || CHAMPS_DRAND.some(function (k) { return dr[k] !== ch[k]; })) throw refus("reseau", "le COFFRET n est pas verrouille sur la chaine drand attendue");
    var nc = nombreDeCoffres(h), vus = {}, nv = 0;
    d.elements.forEach(function (e) {
      if (!e || typeof e !== "object" || Array.isArray(e)) throw refus("format", "element du COFFRET : un objet JSON");
      var typ = e.type;
      if (typ === "solution") throw refus("solution", "COFFRET refuse : il contient un element « solution » (le type solution n existe plus)");
      if (TYPES_ELEMENT.indexOf(typ) < 0) throw refus("type", "COFFRET refuse : type d element inconnu " + JSON.stringify(typ));
      var champs = ["coffre", "ouverture_utc", "ronde", "type", "verrou"].concat(typ === "enigme" ? ["numero"] : typ === "indice" ? ["rang"] : []).sort();
      if (Object.keys(e).sort().join() !== champs.join()) throw refus("format", "element " + typ + " : champs attendus " + champs.join(", "));
      var c = e.coffre;
      if (!entier(c) || c < 1 || c > nc) throw refus("format", "element " + typ + " : coffre hors de 1 a " + nc);
      var cle = JSON.stringify(typ === "enigme" ? [typ, e.numero] : typ === "indice" ? [typ, c, e.rang] : [typ, c]);
      if (vus[cle]) throw refus("doublon", "COFFRET refuse : element en double " + cle);
      vus[cle] = true; nv++;
      var r = rondeA(ch, heureElement(h, e, A));
      if (!entier(e.ronde) || e.ronde !== r || !entier(e.ouverture_utc) || e.ouverture_utc !== instantDe(ch, r))
        throw refus("calendrier", "element " + cle + " : ronde ou heure d ouverture differente de celle de la Pierre");
      var s = stropheTlock(e.verrou);
      if (s.ronde !== r || s.hash !== ch.hash) throw refus("strophe", "element " + cle + " : la strophe tlock du verrou ne porte pas la ronde annoncee");
    });
    if (nv !== 5 * nc) throw refus("incomplet", "COFFRET incomplet : " + nv + " elements, " + 5 * nc + " attendus (2 enigmes, 1 cri et 2 indices par coffre)");
    return d;
  }

  var GGR = { DELAI_CRI: DELAI_CRI, DELAIS_INDICE: DELAIS_INDICE, TYPES_ELEMENT: TYPES_ELEMENT, enregistrer: enregistrer, oublier: oublier, connue: connue,
    nombreDeCoffres: nombreDeCoffres, annee: annee, heureEnigme: heureEnigme, heurePrevue: heurePrevue, heureElement: heureElement,
    engagement: engagement, ligneSolution: ligneSolution, lireSolution: lireSolution, engagementTenu: engagementTenu, aleaTenu: aleaTenu,
    racineRegistre: racineRegistre, dateValide: dateValide, messageBienForme: messageBienForme,
    pairesRetape: pairesRetape, morceauxARetaper: morceauxARetaper, retapeJuste: retapeJuste,
    rondeA: rondeA, instantDe: instantDe, stropheTlock: stropheTlock, jsonStrict: jsonStrict, controlerCoffret: controlerCoffret };
  if (typeof module !== "undefined" && module.exports) module.exports = GGR; else racine.GGR = GGR;
})(this);
