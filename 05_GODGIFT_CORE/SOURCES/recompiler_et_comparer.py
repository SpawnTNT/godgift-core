# -*- coding: utf-8 -*-
"""RECOMPILER ET COMPARER : retrouver soi-meme l'empreinte de GodGift Core, sans faire confiance a personne.

L'empreinte du programme est le SHA-256 du fichier SHA256SUMS, qui liste le SHA-256 de chaque fichier de app/
(hors gg_empreinte.js et gg_fenetre.js, que l'installateur ecrit), une ligne par fichier, dans l'ordre alphabetique. Trois usages :

  1. Verifier une installation (ou le paquet telecharge) :
       python3 recompiler_et_comparer.py --dossier "C:/Users/moi/AppData/Local/GodGiftCore" --attendue <empreinte publiee>
     (le dossier qui contient app/ ; ou le dossier fichiers/ du paquet complet)

  2. Tout reconstruire depuis les sources, puis comparer (le code source complet est publie, licence AGPL-3.0) :
       python3 recompiler_et_comparer.py --reconstruire --attendue <empreinte publiee>
     Il regenere les donnees embarquees (liste des cinq mille, Pierre, guide), le module cryptographique
     (bundle/ : npm ci puis esbuild, versions figees par package-lock.json) et recalcule l'empreinte.

  3. Verifier la version web (https://app.angedeleau.com/), de l'exterieur :
       python3 recompiler_et_comparer.py --site https://app.angedeleau.com/ --attendue <empreinte publiee>
     Il lit SHA256SUMS sur le site (son SHA-256 est l'empreinte du programme), puis CHAQUE fichier servi, et le compare a la liste ;
     il compare aussi la page que les telephones ouvrent vraiment, a la racine « / », et celle du start_url du manifeste, a la ligne
     app/index.html de la liste (contre-audit N2 : un hebergeur pourrait servir la bonne index.html a /index.html et une autre a /) ;
     il refait le service web gg_sw.js depuis cette liste et le compare a celui servi ; il verifie l'en-tete de securite
     (frame-ancestors 'none') et l'integrite SRI de la page. godgift.html (la page installee) n'est pas deposee sur le site : si
     l'hebergeur la sert quand meme, c'est un ecart. Sans --attendue, il compare a l'empreinte de ces sources.

L'empreinte attendue est celle que l'auteur designe par un message signe (« GodGift Core <version> : empreinte <64 hex> », Pierre,
article 13). Aucune gravure ne la porte : AEDE:auteur est reserve au sceau de l'auteur (Pierre, annexe C)."""
import argparse, hashlib, os, re, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))

def empreinte(racine):
    app = os.path.join(racine, 'app')
    if not os.path.isdir(app):
        raise SystemExit(f'pas de dossier app/ dans {racine}')
    fichiers = []
    for r, _, fs in os.walk(app):
        for f in fs:
            p = os.path.relpath(os.path.join(r, f), racine).replace(os.sep, '/')
            if f not in ('gg_empreinte.js', 'gg_fenetre.js') and not f.endswith('.pyc') and '__pycache__' not in p:
                fichiers.append(p)
    lignes = ''.join(f'{hashlib.sha256(open(os.path.join(racine, p), "rb").read()).hexdigest()}  {p}\n' for p in sorted(fichiers))
    return hashlib.sha256(lignes.encode()).hexdigest(), len(fichiers)

def reconstruire():
    sys.path.insert(0, ICI)
    import construire as C
    C.donnees()                                                    # gg_liste.js, gg_pierre.js, gg_cg.js, gg_ancre.js, gg_guide.js
    b = os.path.join(ICI, 'bundle')
    subprocess.run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=b, check=True)
    subprocess.run(['npx', 'esbuild', 'entree.js', '--bundle', '--minify', '--format=iife', '--target=es2020', '--outfile=../app/gg_tlock.js'], cwd=b, check=True)
    C.page_web()                                                   # index.html : l'empreinte SRI de chaque script, apres eux


def lire(url):
    import urllib.request
    q = urllib.request.Request(url, headers={'User-Agent': 'recompiler_et_comparer.py (GodGift Core)', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(q, timeout=60) as r:              # une redirection (/index.html -> /) est suivie : l'empreinte tranche
        return r.read(), r.headers


def site(base):
    """La version web, fichier par fichier. Rend (empreinte servie, nombre de fichiers, liste des ecarts)."""
    import base64
    sys.path.insert(0, ICI)
    import construire as C
    base = base.rstrip('/') + '/'
    sommes, _ = lire(base + 'SHA256SUMS')
    e, ecarts, n = hashlib.sha256(sommes).hexdigest(), [], 0
    liste = {}
    for l in sommes.decode('utf-8').splitlines():
        if not l.strip():
            continue
        h, p = l.split('  ', 1)
        if not re.fullmatch(r'[0-9a-f]{64}', h) or not re.fullmatch(r'app/[A-Za-z0-9_./-]+', p) or '..' in p:
            ecarts.append('SHA256SUMS : ligne invalide ' + l[:80]); continue
        liste[p] = h
        if p == 'app/godgift.html':          # la page installee n'est pas deposee (contre-audit N5) ; servie quand meme : un ecart
            try:
                b, _ = lire(base + 'godgift.html')
                if hashlib.sha256(b).hexdigest() == h:
                    ecarts.append('godgift.html : servie par le site, alors que la version web ne la depose pas (page sans SRI)')
            except Exception:
                pass
            continue
        try:
            b, _ = lire(base + p[4:])
        except Exception as x:
            ecarts.append(f'{p[4:]} : illisible ({x})'); continue
        n += 1
        if hashlib.sha256(b).hexdigest() != h:
            ecarts.append(f'{p[4:]} : ECART')
    try:
        sw, _ = lire(base + 'gg_sw.js')
        if sw.decode('utf-8') != C.texte_sw(sommes.decode('utf-8'), e):
            ecarts.append('gg_sw.js : ECART (ce n est pas le service web de cette liste)')
    except Exception as x:
        ecarts.append(f'gg_sw.js : illisible ({x})')
    page, hd = lire(base)
    if "frame-ancestors 'none'" not in (hd.get('Content-Security-Policy') or ''):
        ecarts.append("en-tete Content-Security-Policy sans frame-ancestors 'none' : _headers n a pas ete lu par l hebergeur")
    # la page ouverte a la racine, et celle du start_url du manifeste (l'icone d'un telephone) : octet pour octet la ligne app/index.html
    hi = liste.get('app/index.html')
    if not hi:
        ecarts.append('SHA256SUMS : pas de ligne app/index.html')
    elif hashlib.sha256(page).hexdigest() != hi:
        ecarts.append('/ : ECART (la page servie a la racine n est pas app/index.html de la liste)')
    try:
        import json, urllib.parse
        man, _ = lire(base + 'manifest.webmanifest')
        su = urllib.parse.urljoin(base + 'manifest.webmanifest', json.loads(man.decode('utf-8')).get('start_url') or './')
        if not su.startswith(base):
            ecarts.append(f'manifest.webmanifest : start_url hors du site ({su})')
        else:
            b, _ = lire(su)
            if not hi or hashlib.sha256(b).hexdigest() != hi:
                ecarts.append(f'start_url {su[len(base) - 1:]} : ECART (n est pas app/index.html de la liste)')
    except Exception as x:
        ecarts.append(f'start_url : illisible ({x})')
    page = page.decode('utf-8')
    for f, s in re.findall(r'<(?:script src|link rel="stylesheet" href)="([^"]+)" integrity="(sha384-[A-Za-z0-9+/=]+)"', page):
        b, _ = lire(base + f)
        if 'sha384-' + base64.b64encode(hashlib.sha384(b).digest()).decode() != s:
            ecarts.append(f'{f} : son empreinte SRI dans index.html ne correspond pas')
    if len(re.findall(r'<script\b', page)) != len(re.findall(r'<script src="[^"]+" integrity="sha384-', page)):
        ecarts.append('index.html : un script sans empreinte SRI')
    return e, n, ecarts

if __name__ == '__main__':
    a = argparse.ArgumentParser(description='Recalcule l empreinte de GodGift Core et la compare a celle publiee par l auteur.')
    a.add_argument('--dossier', default=ICI, help='dossier qui contient app/ (par defaut : ces sources)')
    a.add_argument('--reconstruire', action='store_true', help='regenerer les fichiers construits avant de comparer')
    a.add_argument('--attendue', help='empreinte publiee par l auteur (64 caracteres)')
    a.add_argument('--site', help='adresse de la version web a verifier, par exemple https://app.angedeleau.com/')
    x = a.parse_args()
    if x.site:
        e, n, ecarts = site(x.site)
        attendue = (x.attendue or hashlib.sha256(open(os.path.join(ICI, 'SHA256SUMS'), 'rb').read()).hexdigest()).strip().lower()
        print(f'version web {x.site} : empreinte du programme servie {e}  ({n} fichiers relus)')
        for l in ecarts:
            print('  ' + l)
        ok = e == attendue and not ecarts
        print('IDENTIQUE : la version web est le programme publie, fichier par fichier.' if ok else
              'DIFFERENTE : la version web n est PAS le programme attendu (empreinte ' + attendue[:16] + '...).')
        sys.exit(0 if ok else 1)
    if x.reconstruire:
        reconstruire()
    e, n = empreinte(x.dossier)
    print(f'empreinte du programme : {e}  ({n} fichiers)')
    if x.attendue:
        ok = e == x.attendue.strip().lower()
        print('IDENTIQUE : c est bien le programme publie par l auteur.' if ok else 'DIFFERENTE : ce n est PAS le programme publie par l auteur.')
        sys.exit(0 if ok else 1)
