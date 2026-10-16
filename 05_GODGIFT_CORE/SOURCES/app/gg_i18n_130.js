/* GodGift Core 1.3.0 · les textes nouveaux (plus de « bêta » : une version attend la signature de l'auteur ou l'a ;
   frais confirmés tenus ; oublier le premier manifeste ; le gardien des énigmes), dans les cinq langues. Le français fait foi. */
(function (racine) {
  "use strict";
  var fr = {
    sol_avant_prise: "solution publiée avant la prise du coffre : anormal, à signaler",
    horloge_decalee: "L’horloge de cet appareil est décalée de {s} s par rapport aux serveurs lus : GodGift Core corrige, mais réglez l’heure automatique.",
    prog_beta: "Version en attente de signature : l’auteur désigne chaque version publiée par un message signé qui en donne l’empreinte.",
    prog_court_beta: "en attente de signature",
    ac_bon_note: "Chaque version publiée est désignée par un message signé de l’auteur qui en donne l’empreinte. Vous pouvez aussi vérifier votre installateur sur angedeleau.com/verifier-installateur, ou tout recompiler vous-même (recompiler_et_comparer.py).",
    tr_frais_changes: "Les frais ont changé depuis votre confirmation : relisez et confirmez de nouveau.",
    r_oublier_conf: "Confirmer l’oubli ?", tr_frais_secours: "Les estimateurs de frais étaient muets : ce taux vient du dernier vu, ou d’un taux de secours ; vérifiez-le.",
    r_oublier_t: "Oublier le premier manifeste",
    r_oublier_d: "Ce programme retient le premier manifeste prouvé gravé et signé de chaque chasse, et refuse ensuite tout autre. Si un manifeste a été regravé (re-semis avant la première énigme), oubliez-le ici : le prochain manifeste prouvé sera retenu à sa place.",
    r_oublier_b: "Oublier (chasse zéro)", r_oublier_b1: "Oublier (chasse n° 1)", r_oublier_fait: "Oublié : le prochain manifeste prouvé sera retenu.",
    gardien_note: "Un gardien des énigmes existe : une personne désignée par écrit, hors de la famille de l’auteur, qui garde les mots de passe des énigmes et des indices et les fait publier en secours si l’une d’elles n’a pas paru 48 heures après son heure. Son nom reste scellé ; l’empreinte de chaque énigme est gravée au manifeste, et tout texte publié en secours se vérifie contre elle."
  };
  var en = {
    sol_avant_prise: "solution published before the chest was taken: abnormal, report it",
    horloge_decalee: "This device’s clock is {s} s off from the servers read: GodGift Core corrects for it, but set automatic time.",
    prog_beta: "Version awaiting signature: the author designates each published version by a signed message giving its fingerprint.",
    prog_court_beta: "awaiting signature",
    ac_bon_note: "Each published version is designated by a signed message from the author giving its fingerprint. You can also check your installer at angedeleau.com/verifier-installateur, or rebuild everything yourself (recompiler_et_comparer.py).",
    tr_frais_changes: "The fees changed since you confirmed: read again and confirm again.",
    r_oublier_conf: "Confirm forgetting?", tr_frais_secours: "The fee estimators were silent: this rate comes from the last one seen, or from a fallback rate; check it.",
    r_oublier_t: "Forget the first manifest",
    r_oublier_d: "This program remembers the first manifest proven engraved and signed for each hunt, and then refuses any other. If a manifest was re-engraved (re-seeding before the first riddle), forget it here: the next proven manifest will be kept instead.",
    r_oublier_b: "Forget (hunt zero)", r_oublier_b1: "Forget (hunt no. 1)", r_oublier_fait: "Forgotten: the next proven manifest will be kept.",
    gardien_note: "A keeper of the riddles exists: a person appointed in writing, outside the author’s family, who keeps the passwords of the riddles and hints and has them published as a fallback if one has not appeared 48 hours after its time. Their name stays sealed; the fingerprint of each riddle is engraved in the manifest, and any text published as a fallback is checked against it."
  };
  var es = {
    sol_avant_prise: "solución publicada antes de la toma del cofre: anormal, repórtelo",
    horloge_decalee: "El reloj de este dispositivo está desfasado {s} s respecto a los servidores leídos: GodGift Core lo corrige, pero active la hora automática.",
    prog_beta: "Versión a la espera de firma: el autor designa cada versión publicada mediante un mensaje firmado que da su huella.",
    prog_court_beta: "a la espera de firma",
    ac_bon_note: "Cada versión publicada es designada por un mensaje firmado del autor que da su huella. También puede verificar su instalador en angedeleau.com/verifier-installateur, o recompilarlo todo usted mismo (recompiler_et_comparer.py).",
    tr_frais_changes: "Las comisiones cambiaron desde su confirmación: vuelva a leer y confirme de nuevo.",
    r_oublier_conf: "¿Confirmar el olvido?", tr_frais_secours: "Los estimadores de comisiones no respondieron: esta tasa viene de la última vista, o de una tasa de respaldo; compruébela.",
    r_oublier_t: "Olvidar el primer manifiesto",
    r_oublier_d: "Este programa recuerda el primer manifiesto probado grabado y firmado de cada búsqueda, y luego rechaza cualquier otro. Si un manifiesto fue regrabado (nueva siembra antes del primer enigma), olvídelo aquí: el siguiente manifiesto probado se conservará en su lugar.",
    r_oublier_b: "Olvidar (búsqueda cero)", r_oublier_b1: "Olvidar (búsqueda n.º 1)", r_oublier_fait: "Olvidado: se conservará el siguiente manifiesto probado.",
    gardien_note: "Existe un guardián de los enigmas: una persona designada por escrito, fuera de la familia del autor, que guarda las contraseñas de los enigmas y pistas y los hace publicar como respaldo si uno no apareció 48 horas después de su hora. Su nombre queda sellado; la huella de cada enigma está grabada en el manifiesto, y todo texto publicado como respaldo se verifica contra ella."
  };
  var de = {
    sol_avant_prise: "Lösung vor der Entnahme der Truhe veröffentlicht: anormal, bitte melden",
    horloge_decalee: "Die Uhr dieses Geräts weicht um {s} s von den gelesenen Servern ab: GodGift Core korrigiert das, aber stellen Sie die automatische Zeit ein.",
    prog_beta: "Version wartet auf Signatur: Der Autor bezeichnet jede veröffentlichte Version durch eine signierte Nachricht mit ihrem Fingerabdruck.",
    prog_court_beta: "wartet auf Signatur",
    ac_bon_note: "Jede veröffentlichte Version wird durch eine signierte Nachricht des Autors mit ihrem Fingerabdruck bezeichnet. Sie können Ihren Installer auch unter angedeleau.com/verifier-installateur prüfen oder alles selbst neu kompilieren (recompiler_et_comparer.py).",
    tr_frais_changes: "Die Gebühren haben sich seit Ihrer Bestätigung geändert: Lesen Sie erneut und bestätigen Sie noch einmal.",
    r_oublier_conf: "Vergessen bestätigen?", tr_frais_secours: "Die Gebührenschätzer schwiegen: Dieser Satz stammt vom zuletzt gesehenen oder von einem Ersatzsatz; prüfen Sie ihn.",
    r_oublier_t: "Das erste Manifest vergessen",
    r_oublier_d: "Dieses Programm merkt sich das erste nachweislich gravierte und signierte Manifest jeder Jagd und lehnt danach jedes andere ab. Wurde ein Manifest neu graviert (Neuaussaat vor dem ersten Rätsel), vergessen Sie es hier: Das nächste nachgewiesene Manifest wird stattdessen behalten.",
    r_oublier_b: "Vergessen (Jagd null)", r_oublier_b1: "Vergessen (Jagd Nr. 1)", r_oublier_fait: "Vergessen: Das nächste nachgewiesene Manifest wird behalten.",
    gardien_note: "Es gibt einen Hüter der Rätsel: eine schriftlich benannte Person außerhalb der Familie des Autors, die die Passwörter der Rätsel und Hinweise verwahrt und sie ersatzweise veröffentlichen lässt, falls eines 48 Stunden nach seiner Zeit nicht erschienen ist. Sein Name bleibt versiegelt; der Fingerabdruck jedes Rätsels ist im Manifest graviert, und jeder ersatzweise veröffentlichte Text wird daran geprüft."
  };
  var pt = {
    sol_avant_prise: "solução publicada antes da tomada do cofre: anormal, assinale",
    horloge_decalee: "O relógio deste aparelho está desfasado {s} s em relação aos servidores lidos: o GodGift Core corrige, mas ative a hora automática.",
    prog_beta: "Versão à espera de assinatura: o autor designa cada versão publicada por uma mensagem assinada que dá a sua impressão digital.",
    prog_court_beta: "à espera de assinatura",
    ac_bon_note: "Cada versão publicada é designada por uma mensagem assinada do autor que dá a sua impressão digital. Pode também verificar o seu instalador em angedeleau.com/verifier-installateur, ou recompilar tudo você mesmo (recompiler_et_comparer.py).",
    tr_frais_changes: "As taxas mudaram desde a sua confirmação: releia e confirme de novo.",
    r_oublier_conf: "Confirmar o esquecimento?", tr_frais_secours: "Os estimadores de taxas ficaram mudos: esta taxa vem da última vista, ou de uma taxa de recurso; verifique-a.",
    r_oublier_t: "Esquecer o primeiro manifesto",
    r_oublier_d: "Este programa guarda o primeiro manifesto provado gravado e assinado de cada caçada, e recusa depois qualquer outro. Se um manifesto foi regravado (nova sementeira antes do primeiro enigma), esqueça-o aqui: o próximo manifesto provado será guardado no seu lugar.",
    r_oublier_b: "Esquecer (caçada zero)", r_oublier_b1: "Esquecer (caçada n.º 1)", r_oublier_fait: "Esquecido: o próximo manifesto provado será guardado.",
    gardien_note: "Existe um guardião dos enigmas: uma pessoa designada por escrito, fora da família do autor, que guarda as palavras-passe dos enigmas e das pistas e os faz publicar em socorro se um deles não apareceu 48 horas depois da sua hora. O seu nome fica selado; a impressão digital de cada enigma está gravada no manifesto, e todo o texto publicado em socorro é verificado contra ela."
  };
  var I = racine.GG_I18N;
  [["fr", fr], ["en", en], ["es", es], ["de", de], ["pt", pt]].forEach(function (x) { I[x[0]] = Object.assign(I[x[0]] || {}, x[1]); });
})(this);
