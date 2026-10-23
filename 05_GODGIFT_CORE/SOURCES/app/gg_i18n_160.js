/* GodGift Core 1.6.0 (nuit du 22 au 23 octobre 2026) : le choix des frais avant de signer (Pierre V1k, article 13 ; conditions
   générales A5), le mot tapé sans accent qui est aussi un autre mot de la liste, les textes alignés sur le site (plus d’envoi
   « aussitôt » ni « tout seul » : dès le choix des frais). Cinq langues ; le français fait foi. */
(function (racine) {
  "use strict";
  var fr = {
    chasser_intro: "La clé d’un coffre se calcule ici, sur votre machine : vos réponses ne quittent jamais ce programme. Entraînez-vous sur les coffres d’essai ; pour un vrai coffre, coupez internet avant de taper. Si c’est la bonne clé : GodGift Core vous propose les deux offres de frais, dites en clair, puis signe l’envoi vers votre adresse de réception ; ailleurs que dans la fenêtre dédiée de l’application installée (navigateur, version web, fenêtre rechargée), il vous fait d’abord retaper 16 caractères de cette adresse.",
    tr_arme: "Armé : si vous trouvez, GodGift Core vous propose les frais, puis envoie le trésor vers votre adresse",
    tr_attente_adresse: "La clé est trouvée, mais aucune adresse de réception n’est enregistrée. Enregistrez-la maintenant : le choix des frais suivra.",
    rec_intro: "Le jour où vous trouvez un coffre, GodGift Core l’envoie vers cette adresse, celle de votre propre portefeuille (portefeuille à froid compris), dès que vous avez choisi les frais. Elle doit être signée par ce portefeuille : une adresse bc1q…, 3… ou 1… (une adresse bc1p… ne sait pas encore signer un message). Préparez-la dès maintenant, tranquillement.",
    fenetre_oui: "Fenêtre dédiée de l’application installée : le trésor part vers votre adresse signée dès votre choix des frais, sans retape.",
    fenetre_sceau: "Fenêtre dédiée, mais cette adresse n’y a pas été enregistrée : au prochain envoi, vous en retaperez 16 caractères (deux morceaux masqués à l’écran), lus dans votre portefeuille ; ensuite, le choix des frais, et le trésor part.",
    fenetre_non: "Hors de la fenêtre dédiée : avant chaque envoi, vous retaperez 16 caractères de votre adresse de réception, en deux morceaux tirés au hasard et masqués à l’écran, lus dans votre propre portefeuille. Pour un envoi sans retape, ouvrez GodGift Core par son icône.",
    fenetre_rechargee: "Cette fenêtre a été rechargée : elle n’est plus la fenêtre dédiée (son jeton ne vit qu’en mémoire, il s’est effacé avec la page). Ici, avant chaque envoi d’un trésor, vous retaperez 16 caractères de votre adresse de réception. Pour un envoi sans retape, fermez cette fenêtre et rouvrez GodGift Core par son icône.",
    tr_dest_nouvelle: "Votre adresse de réception a changé depuis la découverte : c’est la nouvelle qui est affichée ici. Vérifiez-la avant de choisir.",
    tr_choix_titre: "Les frais de réseau sont pris sur le coffre ({m} sats). À vous de choisir avant de signer\u00a0:",
    tr_choix_rapide: "Taux rapide du moment\u00a0: {f} sats ({p} % du coffre, {t} sat/vB)",
    tr_choix_forte: "Offre forte\u00a0: {f} sats ({p} % du coffre, {t} sat/vB), pour passer devant une autre transaction",
    tr_choix_note: "Rien ne part sans votre choix. Au-delà de 10 % du coffre, GodGift Core vous redemande.",
    tr_choix_concurrent: "Quelqu’un d’autre a déjà trouvé : sa transaction paie {f} sats de frais. Le taux rapide passerait derrière ; seule l’offre forte, au moins au double, est proposée.",
    tr_essai_sim: "Sur un vrai coffre, GodGift Core vous proposerait maintenant les deux offres de frais (le taux rapide, l’offre forte), puis signerait l’envoi de tout son contenu vers {a}.",
    tr_trouve_envoi: "GodGift Core signe la transaction sur votre machine et l’envoie vers votre adresse de réception, dès que vous avez choisi les frais. Si vous avez coupé internet, rebranchez-le.",
    aide_cle: "Si c’est la bonne clé, GodGift Core vous propose les deux offres de frais, dites en clair (le taux rapide du moment, ou l’offre forte, jusqu’à 10 % du trésor, pour passer devant), puis signe la transaction chez vous et l’envoie vers votre adresse de réception. Rien ne part sans votre choix. Jamais plus de 10 % sans une nouvelle question.",
    d_etape_3: "Avant de signer, le choix des frais, dit en clair\u00a0: le taux rapide du moment, ou l’offre forte (jusqu’à 10 % du coffre) pour passer devant.",
    tr_choix_concurrent_moitie: "Quelqu’un d’autre a déjà trouvé : sa transaction paie {f} sats de frais. Le double dépasserait la moitié du coffre : seule l’offre forte, à la moitié du coffre, est proposée.",
    tr_envoyer_maintenant: "Choisir les frais",
    tr_annule: "Envoi annulé. La clé reste en mémoire tant que GodGift Core est ouvert : « Choisir les frais » quand vous êtes prêt.",
    tr_dest_changee: "L’adresse de réception a changé depuis la découverte : rien n’est envoyé. Vérifiez-la (Mon adresse de réception) : le choix des frais reviendra ensuite.",
    tr_remplacer: "Une transaction attend déjà\u00a0: la remplacer au double, {f} sats ({p}\u00a0% du trésor, {t}\u00a0sat/vB)\u00a0? Rien ne part sans vous.",
    mot_accent: "«\u00a0{m}\u00a0» s’écrit aussi avec un accent dans la liste\u00a0: {c}. Tapez le numéro du mot voulu, ou le mot avec son accent."
  };
  var en = {
    chasser_intro: "A chest’s key is computed here, on your machine: your answers never leave this program. Practise on the practice chests; for a real chest, disconnect from the internet before typing. If it is the right key: GodGift Core offers you the two fee options, stated plainly, then signs the sending to your receiving address; outside the dedicated window of the installed app (browser, web version, reloaded window), it first has you retype 16 characters of that address.",
    tr_arme: "Armed: if you find it, GodGift Core offers you the fees, then sends the treasure to your address",
    tr_attente_adresse: "The key is found, but no receiving address is saved. Save it now: the fee choice will follow.",
    rec_intro: "The day you find a chest, GodGift Core sends it to this address, the one of your own wallet (cold wallets included), as soon as you have chosen the fees. It must be signed by that wallet: a bc1q…, 3… or 1… address (a bc1p… address cannot sign a message yet). Prepare it now, calmly.",
    fenetre_oui: "Dedicated window of the installed app: the treasure goes to your signed address as soon as you choose the fees, with no retyping.",
    fenetre_sceau: "Dedicated window, but this address was not saved in it: at the next sending, you will retype 16 of its characters (two pieces hidden on screen), read in your wallet; then the fee choice, and the treasure goes.",
    fenetre_non: "Outside the dedicated window: before each sending, you will retype 16 characters of your receiving address, in two pieces drawn at random and hidden on screen, read in your own wallet. For sending without retyping, open GodGift Core from its icon.",
    fenetre_rechargee: "This window has been reloaded: it is no longer the dedicated window (its token lives only in memory and was erased with the page). Here, before each sending of a treasure, you will retype 16 characters of your receiving address. For sending without retyping, close this window and reopen GodGift Core from its icon.",
    tr_dest_nouvelle: "Your receiving address changed since the discovery: the new one is shown here. Check it before choosing.",
    tr_choix_titre: "Network fees come out of the chest ({m} sats). Your choice, before signing:",
    tr_choix_rapide: "Current fast rate: {f} sats ({p}% of the chest, {t} sat/vB)",
    tr_choix_forte: "Strong offer: {f} sats ({p}% of the chest, {t} sat/vB), to get ahead of another transaction",
    tr_choix_note: "Nothing leaves without your choice. Beyond 10% of the chest, GodGift Core asks you again.",
    tr_choix_concurrent: "Someone else has already found it: their transaction pays {f} sats in fees. The fast rate would come second; only the strong offer, at least double, is proposed.",
    tr_essai_sim: "On a real chest, GodGift Core would now offer you the two fee options (the fast rate, the strong offer), then sign the sending of its whole contents to {a}.",
    tr_trouve_envoi: "GodGift Core signs the transaction on your machine and sends it to your receiving address, as soon as you have chosen the fees. If you cut the internet, plug it back in.",
    aide_cle: "If it is the right key, GodGift Core offers you the two fee options, stated plainly (the current fast rate, or the strong offer, up to 10% of the treasure, to get ahead), then signs the transaction on your device and sends it to your receiving address. Nothing leaves without your choice. Never more than 10% without a new question.",
    d_etape_3: "Before signing, the fee choice, stated plainly: the current fast rate, or the strong offer (up to 10% of the chest) to get ahead.",
    tr_choix_concurrent_moitie: "Someone else has already found it: their transaction pays {f} sats in fees. Double would exceed half the chest: only the strong offer, at half the chest, is proposed.",
    tr_envoyer_maintenant: "Choose the fees",
    tr_annule: "Sending cancelled. The key stays in memory while GodGift Core is open: “Choose the fees” when you are ready.",
    tr_dest_changee: "The receiving address changed since the discovery: nothing is sent. Check it (My receiving address): the choice of fees will come back afterwards.",
    tr_remplacer: "A transaction is already waiting: replace it at double, {f} sats ({p}% of the treasure, {t} sat/vB)? Nothing leaves without you.",
    mot_accent: "“{m}” also exists with an accent in the list: {c}. Type the number of the word you mean, or the word with its accent."
  };
  var es = {
    chasser_intro: "La llave de un cofre se calcula aquí, en su máquina: sus respuestas nunca salen de este programa. Practique con los cofres de práctica; para un cofre real, desconéctese de internet antes de escribir. Si es la llave correcta: GodGift Core le propone las dos opciones de comisiones, dichas con claridad, y luego firma el envío a su dirección de recepción; fuera de la ventana propia de la aplicación instalada (navegador, versión web, ventana recargada), primero le hace volver a escribir 16 caracteres de esa dirección.",
    tr_arme: "Armado: si lo encuentra, GodGift Core le propone las comisiones y luego envía el tesoro a su dirección",
    tr_attente_adresse: "La llave está encontrada, pero no hay ninguna dirección de recepción guardada. Guárdela ahora: seguirá la elección de las comisiones.",
    rec_intro: "El día que encuentre un cofre, GodGift Core lo envía a esta dirección, la de su propio monedero (incluido un monedero en frío), en cuanto haya elegido las comisiones. Debe estar firmada por ese monedero: una dirección bc1q…, 3… o 1… (una dirección bc1p… aún no sabe firmar un mensaje). Prepárela desde ahora, con calma.",
    fenetre_oui: "Ventana propia de la aplicación instalada: el tesoro sale hacia su dirección firmada en cuanto elige las comisiones, sin volver a escribir nada.",
    fenetre_sceau: "Ventana propia, pero esta dirección no se guardó en ella: en el próximo envío, volverá a escribir 16 de sus caracteres (dos trozos ocultos en pantalla), leídos en su monedero; después, la elección de las comisiones, y el tesoro sale.",
    fenetre_non: "Fuera de la ventana propia: antes de cada envío, volverá a escribir 16 caracteres de su dirección de recepción, en dos trozos elegidos al azar y ocultos en pantalla, leídos en su propio monedero. Para un envío sin volver a escribir, abra GodGift Core desde su icono.",
    fenetre_rechargee: "Esta ventana se ha recargado: ya no es la ventana propia (su código de ventana solo vive en memoria y se borró con la página). Aquí, antes de cada envío de un tesoro, volverá a escribir 16 caracteres de su dirección de recepción. Para un envío sin volver a escribir, cierre esta ventana y vuelva a abrir GodGift Core desde su icono.",
    tr_dest_nouvelle: "Su dirección de recepción ha cambiado desde el hallazgo: aquí se muestra la nueva. Compruébela antes de elegir.",
    tr_concurrence: "Alguien más también lo ha encontrado: su transacción paga {f} sats de comisión. «Acelerar» ofrece de una vez el doble, nunca más de la mitad del tesoro; más allá del 10 % del tesoro, GodGift Core le pregunta antes.",
    tr_choix_titre: "Las comisiones de red salen del cofre ({m} sats). Usted elige antes de firmar:",
    tr_choix_rapide: "Tasa rápida del momento: {f} sats ({p} % del cofre, {t} sat/vB)",
    tr_choix_forte: "Oferta fuerte: {f} sats ({p} % del cofre, {t} sat/vB), para pasar por delante de otra transacción",
    tr_choix_note: "Nada sale sin su elección. Más allá del 10 % del cofre, GodGift Core vuelve a preguntar.",
    tr_choix_concurrent: "Otra persona ya lo ha encontrado: su transacción paga {f} sats de comisiones. La tasa rápida quedaría detrás; solo se propone la oferta fuerte, al menos el doble.",
    tr_essai_sim: "En un cofre real, GodGift Core le propondría ahora las dos opciones de comisiones (la tasa rápida, la oferta fuerte) y luego firmaría el envío de todo su contenido a {a}.",
    tr_trouve_envoi: "GodGift Core firma la transacción en su equipo y la envía a su dirección de recepción en cuanto haya elegido las comisiones. Si cortó internet, vuelva a conectarlo.",
    aide_cle: "Si es la llave correcta, GodGift Core le propone las dos opciones de comisiones, dichas con claridad (la tasa rápida del momento, o la oferta fuerte, hasta el 10 % del tesoro, para pasar delante), luego firma la transacción en su equipo y la envía a su dirección de recepción. Nada sale sin su elección. Nunca más del 10 % sin una nueva pregunta.",
    d_etape_3: "Antes de firmar, la elección de las comisiones, dicha con claridad: la tasa rápida del momento, o la oferta fuerte (hasta el 10 % del cofre) para pasar delante.",
    tr_choix_concurrent_moitie: "Otra persona ya lo ha encontrado: su transacción paga {f} sats de comisiones. El doble superaría la mitad del cofre: solo se propone la oferta fuerte, a la mitad del cofre.",
    tr_envoyer_maintenant: "Elegir las comisiones",
    tr_annule: "Envío cancelado. La clave sigue en memoria mientras GodGift Core esté abierto: «Elegir las comisiones» cuando esté listo.",
    tr_dest_changee: "La dirección de recepción ha cambiado desde el hallazgo: no se envía nada. Compruébela (Mi dirección de recepción): la elección de las comisiones volverá después.",
    tr_remplacer: "Ya hay una transacción en espera: ¿reemplazarla al doble, {f} sats ({p}\u00a0% del tesoro, {t} sat/vB)? Nada sale sin usted.",
    mot_accent: "«{m}» también existe con acento en la lista: {c}. Escriba el número de la palabra que quiere, o la palabra con su acento."
  };
  var de = {
    chasser_intro: "Der Schlüssel einer Truhe wird hier berechnet, auf Ihrem Rechner: Ihre Antworten verlassen dieses Programm nie. Üben Sie an den Übungstruhen; bei einer echten Truhe trennen Sie vor dem Tippen das Internet. Ist es der richtige Schlüssel: GodGift Core schlägt Ihnen die beiden Gebührenangebote klar vor und signiert dann den Versand an Ihre Empfangsadresse; außerhalb des eigenen Fensters der installierten Anwendung (Browser, Webversion, neu geladenes Fenster) lässt es Sie zuerst 16 Zeichen dieser Adresse erneut eintippen.",
    tr_arme: "Bereit: Wenn Sie fündig werden, schlägt GodGift Core Ihnen die Gebühren vor und sendet dann den Schatz an Ihre Adresse",
    tr_attente_adresse: "Der Schlüssel ist gefunden, aber es ist keine Empfangsadresse gespeichert. Speichern Sie sie jetzt: Die Wahl der Gebühren folgt.",
    rec_intro: "An dem Tag, an dem Sie eine Truhe finden, schickt GodGift Core den Schatz an diese Adresse, die Ihrer eigenen Wallet (auch Cold Wallets), sobald Sie die Gebühren gewählt haben. Sie muss von dieser Wallet signiert sein: eine Adresse bc1q…, 3… oder 1… (eine Adresse bc1p… kann noch keine Nachricht signieren). Bereiten Sie sie jetzt in Ruhe vor.",
    fenetre_oui: "Eigenes Fenster der installierten Anwendung: Der Schatz geht an Ihre signierte Adresse, sobald Sie die Gebühren wählen, ohne erneutes Eintippen.",
    fenetre_sceau: "Eigenes Fenster, aber diese Adresse wurde nicht darin gespeichert: Beim nächsten Versand tippen Sie 16 ihrer Zeichen erneut ein (zwei auf dem Bildschirm verdeckte Stücke), abgelesen in Ihrer Wallet; danach die Wahl der Gebühren, und der Schatz geht.",
    fenetre_non: "Außerhalb des eigenen Fensters: Vor jedem Versand tippen Sie 16 Zeichen Ihrer Empfangsadresse erneut ein, in zwei zufällig gewählten, auf dem Bildschirm verdeckten Stücken, abgelesen in Ihrer eigenen Wallet. Für einen Versand ohne erneutes Eintippen öffnen Sie GodGift Core über sein Symbol.",
    fenetre_rechargee: "Dieses Fenster wurde neu geladen: Es ist nicht mehr das eigene Fenster (sein Token lebt nur im Speicher und wurde mit der Seite gelöscht). Hier tippen Sie vor jedem Versand eines Schatzes 16 Zeichen Ihrer Empfangsadresse erneut ein. Für einen Versand ohne erneutes Eintippen schließen Sie dieses Fenster und öffnen GodGift Core erneut über sein Symbol.",
    tr_dest_nouvelle: "Ihre Empfangsadresse hat sich seit dem Fund geändert: Hier wird die neue gezeigt. Prüfen Sie sie, bevor Sie wählen.",
    tr_concurrence: "Jemand anderes hat auch gefunden: Seine Transaktion zahlt {f} Sats Gebühren. „Beschleunigen“ bietet auf einen Schlag das Doppelte, nie mehr als die Hälfte des Schatzes; über 10 % des Schatzes fragt GodGift Core zuerst.",
    tr_choix_titre: "Die Netzgebühren gehen von der Truhe ab ({m} Sats). Ihre Wahl, vor dem Signieren:",
    tr_choix_rapide: "Aktueller schneller Satz: {f} Sats ({p} % der Truhe, {t} Sat/vB)",
    tr_choix_forte: "Starkes Angebot: {f} Sats ({p} % der Truhe, {t} Sat/vB), um an einer anderen Transaktion vorbeizuziehen",
    tr_choix_note: "Ohne Ihre Wahl geht nichts hinaus. Über 10 % der Truhe fragt GodGift Core erneut.",
    tr_choix_concurrent: "Jemand anderes hat sie schon gefunden: Seine Transaktion zahlt {f} Sats Gebühren. Der schnelle Satz käme zu spät; nur das starke Angebot, mindestens das Doppelte, wird vorgeschlagen.",
    tr_essai_sim: "Bei einer echten Truhe würde GodGift Core Ihnen jetzt die beiden Gebührenangebote vorschlagen (den schnellen Satz, das starke Angebot) und dann den Versand des ganzen Inhalts an {a} signieren.",
    tr_trouve_envoi: "GodGift Core signiert die Transaktion auf Ihrem Rechner und sendet sie an Ihre Empfangsadresse, sobald Sie die Gebühren gewählt haben. Falls Sie das Internet getrennt haben, verbinden Sie es wieder.",
    aide_cle: "Ist es der richtige Schlüssel, schlägt GodGift Core Ihnen die beiden Gebührenangebote klar vor (den aktuellen schnellen Satz oder das starke Angebot, bis zu 10 % des Schatzes, um vorbeizuziehen), signiert dann die Transaktion bei Ihnen und sendet sie an Ihre Empfangsadresse. Ohne Ihre Wahl geht nichts hinaus. Nie mehr als 10 % ohne eine neue Frage.",
    d_etape_3: "Vor dem Signieren die Wahl der Gebühren, klar gesagt: der aktuelle schnelle Satz oder das starke Angebot (bis zu 10 % der Truhe), um vorbeizuziehen.",
    tr_choix_concurrent_moitie: "Jemand anderes hat sie schon gefunden: Seine Transaktion zahlt {f} sats Gebühren. Das Doppelte überstiege die Hälfte der Truhe: Nur das starke Angebot, zur Hälfte der Truhe, wird vorgeschlagen.",
    tr_envoyer_maintenant: "Gebühren wählen",
    tr_annule: "Senden abgebrochen. Der Schlüssel bleibt im Speicher, solange GodGift Core geöffnet ist: „Gebühren wählen“, wenn Sie bereit sind.",
    tr_dest_changee: "Die Empfangsadresse hat sich seit dem Fund geändert: Nichts wird gesendet. Prüfen Sie sie (Meine Empfangsadresse): Die Wahl der Gebühren kommt danach zurück.",
    tr_remplacer: "Eine Transaktion wartet bereits: Sie zum Doppelten ersetzen, {f} sats ({p}\u00a0% des Schatzes, {t} sat/vB)? Nichts geht ohne Sie.",
    mot_accent: "„{m}“ gibt es in der Liste auch mit Akzent: {c}. Geben Sie die Nummer des gemeinten Wortes ein, oder das Wort mit seinem Akzent."
  };
  var pt = {
    chasser_intro: "A chave de um cofre calcula-se aqui, na sua máquina: as suas respostas nunca saem deste programa. Treine nos cofres de treino; para um cofre real, desligue a internet antes de escrever. Se for a chave certa: o GodGift Core propõe-lhe as duas ofertas de taxas, ditas com clareza, e depois assina o envio para o seu endereço de receção; fora da janela própria da aplicação instalada (navegador, versão web, janela recarregada), faz-lhe primeiro voltar a escrever 16 caracteres desse endereço.",
    tr_arme: "Armado: se encontrar, o GodGift Core propõe-lhe as taxas e depois envia o tesouro para o seu endereço",
    tr_attente_adresse: "A chave foi encontrada, mas nenhum endereço de receção está guardado. Guarde-o agora: a escolha das taxas segue-se.",
    rec_intro: "No dia em que encontrar um cofre, o GodGift Core envia-o para este endereço, o da sua própria carteira (carteiras frias incluídas), assim que tiver escolhido as taxas. Tem de ser assinado por essa carteira: um endereço bc1q…, 3… ou 1… (um endereço bc1p… ainda não sabe assinar uma mensagem). Prepare-o já, com calma.",
    fenetre_oui: "Janela própria da aplicação instalada: o tesouro parte para o seu endereço assinado assim que escolhe as taxas, sem voltar a escrever nada.",
    fenetre_sceau: "Janela própria, mas este endereço não foi guardado nela: no próximo envio, voltará a escrever 16 dos seus caracteres (dois pedaços ocultos no ecrã), lidos na sua carteira; depois, a escolha das taxas, e o tesouro parte.",
    fenetre_non: "Fora da janela própria: antes de cada envio, voltará a escrever 16 caracteres do seu endereço de receção, em dois pedaços tirados ao acaso e ocultos no ecrã, lidos na sua própria carteira. Para um envio sem voltar a escrever, abra o GodGift Core pelo seu ícone.",
    fenetre_rechargee: "Esta janela foi recarregada: já não é a janela própria (o seu código de janela só vive na memória e apagou-se com a página). Aqui, antes de cada envio de um tesouro, voltará a escrever 16 caracteres do seu endereço de receção. Para um envio sem voltar a escrever, feche esta janela e abra de novo o GodGift Core pelo seu ícone.",
    tr_dest_nouvelle: "O seu endereço de receção mudou desde a descoberta: aqui mostra-se o novo. Verifique-o antes de escolher.",
    tr_concurrence: "Outra pessoa também encontrou: a transação dela paga {f} sats de taxas. «Acelerar» propõe de uma vez o dobro, nunca mais de metade do tesouro; acima de 10 % do tesouro, o GodGift Core pergunta-lhe antes.",
    tr_choix_titre: "As taxas de rede saem do cofre ({m} sats). A sua escolha, antes de assinar:",
    tr_choix_rapide: "Taxa rápida do momento: {f} sats ({p} % do cofre, {t} sat/vB)",
    tr_choix_forte: "Oferta forte: {f} sats ({p} % do cofre, {t} sat/vB), para passar à frente de outra transação",
    tr_choix_note: "Nada parte sem a sua escolha. Acima de 10 % do cofre, o GodGift Core volta a perguntar.",
    tr_choix_concurrent: "Outra pessoa já o encontrou: a sua transação paga {f} sats de taxas. A taxa rápida ficaria atrás; só a oferta forte, pelo menos o dobro, é proposta.",
    tr_essai_sim: "Num cofre real, o GodGift Core propor-lhe-ia agora as duas ofertas de taxas (a taxa rápida, a oferta forte) e depois assinaria o envio de todo o conteúdo para {a}.",
    tr_trouve_envoi: "O GodGift Core assina a transação na sua máquina e envia-a para o seu endereço de receção assim que tiver escolhido as taxas. Se cortou a internet, volte a ligá-la.",
    aide_cle: "Se for a chave certa, o GodGift Core propõe-lhe as duas ofertas de taxas, ditas com clareza (a taxa rápida do momento, ou a oferta forte, até 10 % do tesouro, para passar à frente), depois assina a transação no seu aparelho e envia-a para o seu endereço de receção. Nada parte sem a sua escolha. Nunca mais de 10 % sem uma nova pergunta.",
    d_etape_3: "Antes de assinar, a escolha das taxas, dita com clareza: a taxa rápida do momento, ou a oferta forte (até 10 % do cofre) para passar à frente.",
    tr_choix_concurrent_moitie: "Outra pessoa já o encontrou: a sua transação paga {f} sats de taxas. O dobro ultrapassaria metade do cofre: só a oferta forte, a metade do cofre, é proposta.",
    tr_envoyer_maintenant: "Escolher as taxas",
    tr_annule: "Envio cancelado. A chave fica em memória enquanto o GodGift Core estiver aberto: «Escolher as taxas» quando estiver pronto.",
    tr_dest_changee: "O endereço de receção mudou desde a descoberta: nada é enviado. Verifique-o (O meu endereço de receção): a escolha das taxas voltará depois.",
    tr_remplacer: "Já há uma transação à espera: substituí-la pelo dobro, {f} sats ({p}\u00a0% do tesouro, {t} sat/vB)? Nada parte sem si.",
    mot_accent: "«{m}» também existe com acento na lista: {c}. Escreva o número da palavra pretendida, ou a palavra com o seu acento."
  };
  var I = racine.GG_I18N;
  [["fr", fr], ["en", en], ["es", es], ["de", de], ["pt", pt]].forEach(function (x) { I[x[0]] = Object.assign(I[x[0]] || {}, x[1]); });
  // la typographie de la 1.5.0, appliquee a ces textes aussi (espace insecable avant % et €, apostrophes, citations)
  var cles = Object.keys(Object.assign({}, fr, en, es, de, pt));                 // l union des cinq langues : tr_concurrence es/de/pt aussi (m2)
  function sur(l, f) { var d = I[l] || {}; cles.forEach(function (k) { if (typeof d[k] === "string") d[k] = f(d[k]); }); }
  ["fr", "es", "de", "pt"].forEach(function (l) { sur(l, function (s) { return s.replace(/([\d}]) ([%€])/g, "$1\u00a0$2"); }); });
  sur("de", function (s) { return s.replace(/\bSats\b/g, "sats"); });
  sur("en", function (s) { return s.replace(/([A-Za-z])'([A-Za-z])/g, "$1\u2019$2").replace(/([\d}]) %/g, "$1%"); });
  ["es", "de", "pt"].forEach(function (l) { sur(l, function (s) { return s.replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, "$1\u2019$2"); }); });
})(this);
