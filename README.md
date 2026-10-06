# GodGift Core

*Tout est vérifiable. Rien n'est promis.*

**GodGift Core** est le programme des chasseurs de *L'Ange de l'Eau*. Il suit les coffres de la chasse sur la chaîne Bitcoin, par deux sources indépendantes, et vérifie tout lui-même. Il permet de chasser hors ligne. Quand un chasseur trouve, il vide lui-même le coffre vers l'adresse de réception que ce chasseur a signée dans son propre portefeuille. Il ne recueille aucune donnée personnelle et ne conserve aucune clé.

- Auteur : Arthur Benjamin Myard
- Licence : GNU Affero General Public License, version 3 (AGPL-3.0-only), voir [`LICENSE`](LICENSE)
- Site officiel : <https://angedeleau.com> · version pour téléphone : <https://app.angedeleau.com>

## Version publiée

| Version | Empreinte du programme (SHA-256 du fichier `SHA256SUMS`, 42 fichiers) |
|---|---|
| 1.1.0-beta | `cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501` |

L'empreinte officielle d'une version est celle que l'auteur désigne par un message signé (« GodGift Core <version> : empreinte <64 hex> », Pierre du programme, article 13). Ce dépôt en publie la source. En cas d'écart, c'est le message signé qui fait foi.

## Recompiler et comparer

Cette commande refait le programme depuis ces sources et compare son empreinte, sans faire confiance à personne :

```
cd 05_GODGIFT_CORE/SOURCES
python3 recompiler_et_comparer.py --reconstruire --attendue cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501
```

Il faut Python 3 et Node.js (npm). Les versions du module cryptographique sont figées par `bundle/package-lock.json`. Le résultat attendu est `IDENTIQUE`.

Le même outil vérifie aussi une installation (`--dossier <dossier qui contient app/>`) ou la version web (`--site https://app.angedeleau.com/`). Les installateurs (Windows, Mac, Linux et Raspberry Pi) se construisent avec `python3 construire.py`, qui demande en plus NSIS et dpkg-deb.

## Contenu

- `05_GODGIFT_CORE/SOURCES/` : le programme (`app/`), le module cryptographique (`bundle/`), le guide en cinq langues, les installateurs et les tests.
- `01_PIERRE/` : la Pierre du programme V1j, c'est-à-dire les règles de la chasse, et les conditions générales. Le programme embarque les deux.
- `03_CAVE_STONE_5/LISTE_DES_CINQ_MILLE.txt` : la liste publique des cinq mille mots (Pierre, annexe B).

Le dépôt reprend la disposition de la trousse de l'auteur, que `construire.py` sait lire. Il ne contient aucun secret : ni clé, ni énigme, ni réponse.

## Signature et sécurité

Les installateurs Windows officiels seront signés au nom d'Arthur Benjamin Myard (certificat Certum de signature de code open source). Pour signaler une faille : contact@angedeleau.com.

---

# GodGift Core (English)

*Everything is verifiable. Nothing is promised.*

**GodGift Core** is the hunters' program for *L'Ange de l'Eau* (*The Angel of the Water*). It follows the hunt's chests on the Bitcoin chain, through two independent sources, and checks everything itself. It lets you hunt offline. When a hunter finds a chest, it sweeps that chest itself to the receiving address the hunter signed in their own wallet. It collects no personal data and keeps no keys.

- Author: Arthur Benjamin Myard
- License: GNU Affero General Public License, version 3 (AGPL-3.0-only), see [`LICENSE`](LICENSE)
- Official site: <https://angedeleau.com> · phone version: <https://app.angedeleau.com>

## Published version

| Version | Program fingerprint (SHA-256 of `SHA256SUMS`, 42 files) |
|---|---|
| 1.1.0-beta | `cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501` |

The official fingerprint of a version is the one the author designates in a signed message ("GodGift Core <version> : empreinte <64 hex>", Stone of the program, article 13). This repository publishes its source. If they ever differ, the signed message prevails.

## Rebuild and compare

```
cd 05_GODGIFT_CORE/SOURCES
python3 recompiler_et_comparer.py --reconstruire --attendue cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501
```

You need Python 3 and Node.js (npm). The versions of the cryptographic module are pinned by `bundle/package-lock.json`. The expected result is `IDENTIQUE` (identical). The same tool checks an installation (`--dossier`) or the web version (`--site`). The installers are built with `python3 construire.py`, which also needs NSIS and dpkg-deb.

## Signing and security

The official Windows installers will be signed in the name of Arthur Benjamin Myard (Certum open source code signing certificate). To report a vulnerability: contact@angedeleau.com.
