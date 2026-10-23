# GodGift Core

*Tout est vérifiable. Rien n'est promis.*

**GodGift Core** est le programme des chasseurs de *L'Ange de l'Eau*. Il suit les coffres de la chasse sur la chaîne Bitcoin, par deux sources indépendantes, et vérifie tout lui-même. Il permet de chasser hors ligne. Quand un chasseur trouve, il vide lui-même le coffre vers l'adresse de réception que ce chasseur a signée dans son propre portefeuille. Il ne recueille aucune donnée personnelle et ne conserve aucune clé.

- Auteur : Arthur Benjamin Myard
- Licence : GNU Affero General Public License, version 3 (AGPL-3.0-only), voir [`LICENSE`](LICENSE)
- Site officiel : <https://angedeleau.com> · version pour téléphone : <https://app.angedeleau.com>

## Version publiée

| Version | Empreinte du programme (SHA-256 du fichier `SHA256SUMS`) |
|---|---|
| 1.6.0 (56 fichiers ; en attente du message signé de l’auteur) | `d3c7ac4ae808a7b1f85e6aec81df1128fc99ce754da7133d6f6d0d127ae70d4c` |
| 1.5.0 (55 fichiers ; désignée par le message signé du 18 octobre 2026) | `b623c0b2e71bb4ed1ff0612b79b9500c2c8f739c51c0f45b8950739aad187848` |
| 1.4.0, la version design (54 fichiers ; désignée par le message signé du 17 octobre 2026) | `25a65748620ed19686a4c2a53c487fb1a27042ff919e4eb7524c718a7a1729e0` |
| 1.3.0 (44 fichiers ; désignée par le message signé du 16 octobre 2026) | `03f6a9640885aae94a692689ce9217f2fde399bf7274b2b91573242afb936d35` |
| 1.2.1-beta (43 fichiers) | `d5e320859de4d55909d8f46e6381be321275a52770d8e3d061c83ce2abad0c75` |
| 1.2.0-beta (remplacée) | `529c2f7ab2e6c9a2bdedead36e291ab02542b0af6553e4ae9fa6fb46295e4ce3` |
| 1.1.0-beta (remplacée) | `cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501` |

L'empreinte officielle d'une version est celle que l'auteur désigne par un message signé (« GodGift Core <version> : empreinte <64 hex> », Pierre du programme, article 13). Ce dépôt en publie la source. En cas d'écart, c'est le message signé qui fait foi.

## Recompiler et comparer

Cette commande refait le programme depuis ces sources et compare son empreinte, sans faire confiance à personne :

```
cd 05_GODGIFT_CORE/SOURCES
python3 recompiler_et_comparer.py --reconstruire --attendue b623c0b2e71bb4ed1ff0612b79b9500c2c8f739c51c0f45b8950739aad187848
```

Il faut Python 3 et Node.js (npm). Les versions du module cryptographique sont figées par `bundle/package-lock.json`. Le résultat attendu est `IDENTIQUE`.

Le même outil vérifie aussi une installation (`--dossier <dossier qui contient app/>`) ou la version web (`--site https://app.angedeleau.com/`). Les installateurs (Windows, Mac, Linux et Raspberry Pi) se construisent avec `python3 construire.py`, qui demande en plus NSIS et dpkg-deb.

## Contenu

- `05_GODGIFT_CORE/SOURCES/` : le programme (`app/`), le module cryptographique (`bundle/`), le guide en cinq langues, les installateurs et les tests.
- `01_PIERRE/` : la Pierre du programme V1k, c'est-à-dire les règles de la chasse, et les conditions générales. Le programme embarque les deux.
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

| Version | Program fingerprint (SHA-256 of `SHA256SUMS`) |
|---|---|
| 1.6.0 (56 files; awaiting the author’s signed message) | `d3c7ac4ae808a7b1f85e6aec81df1128fc99ce754da7133d6f6d0d127ae70d4c` |
| 1.5.0 (55 files; designated by the signed message of 18 October 2026) | `b623c0b2e71bb4ed1ff0612b79b9500c2c8f739c51c0f45b8950739aad187848` |
| 1.4.0, the design version (54 files; designated by the signed message of 17 October 2026) | `25a65748620ed19686a4c2a53c487fb1a27042ff919e4eb7524c718a7a1729e0` |
| 1.3.0 (44 files; designated by the signed message of 16 October 2026) | `03f6a9640885aae94a692689ce9217f2fde399bf7274b2b91573242afb936d35` |
| 1.2.1-beta (43 files) | `d5e320859de4d55909d8f46e6381be321275a52770d8e3d061c83ce2abad0c75` |
| 1.2.0-beta (superseded) | `529c2f7ab2e6c9a2bdedead36e291ab02542b0af6553e4ae9fa6fb46295e4ce3` |
| 1.1.0-beta (superseded) | `cee02c06833a6ffdd5d8db19dfb5ce174741100b03ef02448ca1b9226bda5501` |

The official fingerprint of a version is the one the author designates in a signed message ("GodGift Core <version> : empreinte <64 hex>", Stone of the program, article 13). This repository publishes its source. If they ever differ, the signed message prevails.

## Rebuild and compare

```
cd 05_GODGIFT_CORE/SOURCES
python3 recompiler_et_comparer.py --reconstruire --attendue b623c0b2e71bb4ed1ff0612b79b9500c2c8f739c51c0f45b8950739aad187848
```

You need Python 3 and Node.js (npm). The versions of the cryptographic module are pinned by `bundle/package-lock.json`. The expected result is `IDENTIQUE` (identical). The same tool checks an installation (`--dossier`) or the web version (`--site`). The installers are built with `python3 construire.py`, which also needs NSIS and dpkg-deb.

## Signing and security

The official Windows installers will be signed in the name of Arthur Benjamin Myard (Certum open source code signing certificate). To report a vulnerability: contact@angedeleau.com.
