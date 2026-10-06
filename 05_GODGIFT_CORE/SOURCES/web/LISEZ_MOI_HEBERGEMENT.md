# Héberger la version web de GodGift Core (app.angedeleau.com)

La version web de GodGift Core est un dossier de pages fixes, sans programme côté serveur. Elle s’héberge **à part**, chez un hébergeur de pages statiques, jamais sur le serveur de la caisse : une caisse piratée ne doit pas pouvoir livrer un faux GodGift Core. Le pas à pas (Cloudflare Pages, DNS chez Amen, mentions légales) est dans `MISE_EN_ROUTE`, partie 8, et le contrôle O8.

## Ce qu’on dépose

Le dossier `web` (à côté de ce fichier), **tel quel** : sans rien ajouter, retirer ni modifier, y compris `_headers` (les en-têtes de sécurité, lus par Cloudflare Pages ou Netlify) et `gg_sw.js` (le service web). Ce fichier-ci ne se dépose pas. `SHA256SUMS` liste aussi `app/godgift.html`, la page de l’application installée : elle n’est pas dans le dossier `web` et ne doit pas être servie (sans SRI, faite pour l’ordinateur du chasseur).

## Avant l’envoi

Dans le dossier qui contient `web` :

```
Get-FileHash .\web\SHA256SUMS -Algorithm SHA256        (Windows)
sha256sum web/SHA256SUMS                                (Mac, Linux)
```

Le résultat doit être l’**empreinte du programme GodGift Core** donnée dans le fil de l’atelier. Sinon, ne rien publier.

## Après l’envoi

1. Sur le téléphone, `https://app.angedeleau.com/` ouvre GodGift Core. La version web n’affiche pas son empreinte comme une preuve : une page servie par un hébergeur écrit ce qu’elle veut d’elle-même ; elle renvoie au contrôle suivant.
2. Le contrôle qui fait foi, depuis un ordinateur, dans les sources de GodGift Core :
   `python3 recompiler_et_comparer.py --site https://app.angedeleau.com/ --attendue <empreinte du fil>`
   Il relit chaque fichier servi et le compare à la liste ; il compare aussi la page servie à la racine `/` (celle qu’ouvrent les téléphones) et celle du `start_url` du manifeste à la ligne `app/index.html` de la liste ; il vérifie le service web `gg_sw.js` et l’en-tête de sécurité, et signale `godgift.html` si l’hébergeur la sert. Attendu : « IDENTIQUE ». (Le contrôle O8 de `MISE_EN_ROUTE` doit faire de même avec `curl`, la racine `/` comprise.)
3. `https://angedeleau.com/app/` renvoie vers `https://app.angedeleau.com/` (c’est la caisse qui le fait).

## Ce qui protège quoi

- Chaque script et la feuille de style d’`index.html` portent leur empreinte (SRI) : le navigateur refuse un fichier altéré.
- La page ne peut joindre que des adresses précises, en `https` et `wss` seulement : la librairie (`angedeleau.com`), mempool.space, blockstream.info, les relais drand et les relais Nostr (CSP).
- `_headers` interdit d’ouvrir GodGift Core dans le cadre d’une autre page (`frame-ancestors 'none'`). Une balise `meta` ne le peut pas : sans `_headers`, la page se protège seule, mais moins bien. Ne pas le retirer.
- Le service web ne garde et ne sert que des fichiers dont l’empreinte est celle de la liste, et n’installe une nouvelle version que si tous ses fichiers sont vérifiés.
- La limite, franchement : qui tient le compte de l’hébergeur peut remplacer toute la version web. D’où la double authentification sur ce compte, le contrôle à chaque version, et deux règles du programme : pour récupérer un trésor, l’application installée sur un ordinateur reste la voie la plus sûre ; et la version web n’envoie jamais un trésor sans que le chasseur ait retapé 16 caractères de son adresse de réception (deux morceaux tirés au hasard, masqués à l’écran), lus dans son propre portefeuille.

## Un serveur de secours

Le serveur de secours de la vente (Pierre, article 10) est désigné à l’avance par un message signé de l’auteur dont la dernière ligne est exactement `AEDE:secours:https://<hôte>` (tuile M de la Cave), ou épinglé à la construction dans `SOURCES/web_origines.txt` (une ligne, par exemple `https://secours.exemple.org`). GodGift Core n’accepte jamais une adresse que la caisse annoncerait seule. La version web ne peut joindre que les origines de sa CSP : pour elle, le serveur de secours doit AUSSI être écrit dans `web_origines.txt`, puis GodGift Core reconstruit. Sans serveur de secours valide qui répond, « Acheter » renvoie à angedeleau.com et dit que la vente est momentanément indisponible ; la chasse continue (l’application installée garde le COFFRET et l’ouvre seule).

## Une nouvelle version

Même contrôle du dossier, puis un nouveau déploiement du dossier `web` entier (jamais un fichier modifié à la main chez l’hébergeur), puis les contrôles ci-dessus. Les téléphones passent à la nouvelle version au lancement suivant, une fois tous ses fichiers vérifiés.
