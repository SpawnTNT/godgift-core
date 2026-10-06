/* GodGift Core · le monde de demonstration : la chasse telle qu'elle pourrait etre le 10 juin 2027.
   Valeurs d'illustration, adresses factices, aucune vraie enigme. Rien n'est lu sur le reseau dans ce mode. */
(function (racine) {
  "use strict";
  var MAINTENANT = Date.UTC(2027, 5, 10, 20, 0, 0) / 1000;
  var EUROS = [60, 60, 60, 65, 65, 70, 70, 70, 75, 75, 300, 75, 80, 80, 85, 90, 95, 100, 110, 115, 300, 300, 300, 1300];
  var SATS_PAR_EURO = 1600;   // illustration : 1 BTC = 62 500 EUR
  function dateEnigme(num) { var n = Math.ceil(num / 2), j = num % 2 ? 3 : 17; return Date.UTC(2027 + Math.floor((n - 1) / 12), (n - 1) % 12, j, 18, 15, 5) / 1000; }

  function monde(C) {
    var coffres = [], soldes = {};
    for (var n = 1; n <= 24; n++) {
      var adr = C.adresseSegwit(C.ripemd160(C.sha256("GodGift demonstration, coffre factice " + n)));
      var seme = EUROS[n - 1] * SATS_PAR_EURO;
      coffres.push({ n: n, type: n === 24 ? "final" : (n === 11 || n >= 21) ? "cathedrale" : "pierre", adresse: adr, empreinte_alea: C.sha256hex("alea factice " + n),
        sats_semes: seme, euros_depart: EUROS[n - 1], cri_txid: C.sha256hex("cri factice " + n), cri_verrou: dateEnigme(2 * n) });
      var pris = n <= 4, mult = n <= 4 ? 0 : n === 5 ? 1.09 : n === 6 ? 1.1 : 1.12;
      soldes[adr] = { sats: Math.round(seme * mult), depense: pris };
    }
    var man = { pierre: "V1g", annee_A: 2027, coffres: coffres, cours_eur_btc: 62500, amorce: { txid: C.sha256hex("amorce factice"), montant_par_cri: 12000 } };
    var texte = JSON.stringify(man, null, 1), enigmes = [];
    for (var k = 1; k <= 48; k++) if (dateEnigme(k) <= MAINTENANT) enigmes.push({ numero: k, coffre: Math.ceil(k / 2), date_utc: dateEnigme(k),
      texte_fr: "Énigme d’illustration n°\u00a0" + k + ".\nEn mode démonstration, aucun vrai texte n’est montré\u00a0: les énigmes véritables paraissent le 3 et le 17 de chaque mois, à 18:15:05 UTC (19:15:05 à Paris en hiver, 20:15:05 en été).",
      texte_en: "Illustration riddle no. " + k + ".\nIn demonstration mode no real text is shown: the true riddles appear on the 3rd and the 17th of each month, at 18:15:05 UTC (19:15:05 in Paris in winter, 20:15:05 in summer)." });
    var etat = { programme: "AEDE", pierre: "V1j", version_app: "demo", coffres: coffres.map(function (c) { return { n: c.n, adresse: c.adresse }; }), amorce: man.amorce.txid,
      empreinte_manifeste: C.sha256hex(texte), enigmes: enigmes, livre: { paru: { fr: true, en: true }, prix_sats: 21000 },   // le prix publie par la caisse (illustration)
      versements: [{ trimestre: "2026T4", txid: C.sha256hex("versement 1") }, { trimestre: "2027T1", txid: C.sha256hex("versement 2") }, { trimestre: "2027T2", txid: C.sha256hex("versement 3") }] };
    return { etat: etat, manifeste: man, manifTexte: texte, soldes: soldes, hauteur: 1001482, prixEur: 62500, derniere: Date.now(), erreurs: {} };
  }

  function verifications(t) {
    var o = [["v_pierre", "v_pierre_ok", { h: racine.GG_PIERRE.sha256.slice(0, 16) }], ["v_liste", "v_liste_ok", { h: "01622e7b67eb5faf" }], ["v_calendrier", "v_calendrier_ok", { n: 11 }],
      ["v_manifeste", "v_manifeste_ok", { h: "(démo)" }], ["v_gravure", "v_gravure_ok", { tx: "(démo)" }], ["v_amorce", "v_amorce_ok", {}], ["v_cris", "v_cris_ok", { n: 5, m: "" }],
      ["v_versements", "v_versements_ok", { n: 3 }], ["v_coffres", "v_coffres_ok", { n: 24, p: 4 }],
      ["v_coffret", "v_coffret_ok", { h: "(démo)", o: 20, n: 120 }], ["v_messages", "v_messages_ok", { n: 2 }], ["v_registre", "v_registre_ok", { n: 1102 }],
      ["v_programme", "v_programme_essai", { h: racine.GG_EMPREINTE.empreinte.slice(0, 16) }]];
    return o.map(function (x, i) { return { t: t(x[0]), e: i === o.length - 1 ? "att" : "ok", d: t(x[1], x[2]) + " · " + t("demo_court") }; });
  }

  // le COFFRET de demonstration : les memes heures que le vrai (deux enigmes, un cri, l'indice fort a J+30 et le second indice a J+182
  // apres le cri ; plus aucune solution), des contenus d'illustration (aucun vrai verrou)
  function coffret() {
    var el = [];
    for (var n = 1; n <= 24; n++) {
      var t17 = dateEnigme(2 * n);
      el.push({ type: "enigme", coffre: n, numero: 2 * n - 1, ouverture_utc: dateEnigme(2 * n - 1) + 1 });
      el.push({ type: "enigme", coffre: n, numero: 2 * n, ouverture_utc: t17 + 1 });
      el.push({ type: "cri", coffre: n, ouverture_utc: t17 + 3601 });
      el.push({ type: "indice", coffre: n, rang: 1, ouverture_utc: t17 + 3601 + 30 * 86400 });
      el.push({ type: "indice", coffre: n, rang: 2, ouverture_utc: t17 + 3601 + 182 * 86400 });
    }
    return { coffret: "AEDE-V1", demo: true, elements: el };
  }
  function ouverts(c, now, cle) {
    var o = {};
    c.elements.forEach(function (e) {
      if (e.ouverture_utc > now) return;
      var v;
      if (e.type === "enigme") v = { numero: e.numero, coffre: e.coffre, texte_fr: "Énigme d’illustration n°\u00a0" + e.numero + " (démonstration).", texte_en: "Illustration riddle no. " + e.numero + " (demonstration)." };
      else if (e.type === "cri") v = { coffre: e.coffre, hex: "", txid: "(démo)" };
      else v = { coffre: e.coffre, rang: e.rang, texte_fr: (e.rang === 1 ? "Indice fort" : "Second indice") + " d’illustration pour le coffre " + e.coffre + " (démonstration).",
        texte_en: (e.rang === 1 ? "Strong hint" : "Second hint") + " for chest " + e.coffre + " (demonstration)." };
      o[cle(e)] = JSON.stringify(v);
    });
    return o;
  }
  // coherent avec monde() : les coffres 1 a 4 sont pris, le 5 est a prendre, le 6 en chasse
  function messages() {
    return [{ date: "2027-06-03", texte: "Le coffre 4 a été pris. Bravo au chasseur, et bonne chasse à tous pour le cinquième et le sixième.\n(message de démonstration)", adresse: "bc1q…démo", signature: "", valide: true, forme: true },
            { date: "2027-01-03", texte: "Bienvenue dans L’Ange de l’Eau. La première énigme est parue.\n(message de démonstration)", adresse: "bc1q…démo", signature: "", valide: true, forme: true }];
  }

  racine.GG_DEMO = { maintenant: MAINTENANT, monde: monde, verifications: verifications, coffret: coffret, ouverts: ouverts, messages: messages };
})(this);
