#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construit GodGift Core : les donnees embarquees, les images, l'icone, la page web, SHA256SUMS, l'empreinte, l'archive a distribuer
et la version web.

    python3 construire.py            -> dist/GodGift_Core_<version>.zip  (+ .sha256), les installateurs, et dist/web/ (app.angedeleau.com)

Deux pages ouvrent le meme programme : app/godgift.html (installe, en file://) et app/index.html (la version web), que construire.py
tire de godgift.html avec l'empreinte SRI de chaque script et feuille de style et une CSP limitee aux origines exactes (https et wss).
dist/web/ = les fichiers de SHA256SUMS sauf godgift.html (chemins sans app/), SHA256SUMS, gg_sw.js (le service web, qui verifie chaque
fichier contre SHA256SUMS) et _headers (les en-tetes de l'hebergeur : CSP avec frame-ancestors 'none', etc.). A deposer tel quel ; voir
dist/LISEZ_MOI_HEBERGEMENT.md. godgift.html (sans SRI, CSP large : faite pour file://) n'est jamais servie (contre-audit N5).

Deux fichiers de app/ ne sont pas dans SHA256SUMS :
  - gg_empreinte.js : l'empreinte du programme, que l'installateur recrit apres avoir verifie chaque fichier (le .deb et l'application
    Mac la portent deja) ;
  - gg_fenetre.js : l'empreinte du jeton de la fenetre dediee (le seul contexte qui envoie un tresor sans retape ; voir gg_app.js,
    FENETRE). Jamais livre : l'installateur, ou le lanceur au premier demarrage, le tire au hasard sur l'ordinateur du chasseur.

La construction est reproductible : memes sources, memes octets, meme empreinte (dates fixes dans le zip, ordre trie).
L'empreinte du programme = SHA-256 du fichier SHA256SUMS (une ligne par fichier de app/, hors gg_empreinte.js et gg_fenetre.js)."""
import hashlib, io, json, os, re, shutil, subprocess, sys, zipfile

ICI = os.path.dirname(os.path.abspath(__file__))
AEDE = os.path.abspath(os.path.join(ICI, '..', '..'))
APP = os.path.join(ICI, 'app')
VERSION = re.search(r'VERSION = "([^"]+)"', open(os.path.join(APP, 'gg_app.js'), encoding='utf-8').read()).group(1)
NOM = f'GodGift_Core_{VERSION}'
VERSION_NUM = re.match(r'\d+\.\d+\.\d+', VERSION).group(0)      # Windows et Mac veulent des nombres seuls
VERSION_DEB = VERSION.replace('-', '~')                          # Debian : 1.1.0~beta passe avant 1.1.0
HORS_LISTE = ('gg_empreinte.js', 'gg_fenetre.js')                # hors SHA256SUMS : ecrits par l'installateur (voir plus haut)


def ecrire(chemin, texte):
    with open(chemin, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texte)


def trouver(nom, dossiers):
    """Le premier fichier present : disposition du paquet maitre (app/, pierre/), ou celle de la trousse (03_CAVE_STONE_5/, 01_PIERRE/)."""
    for d in dossiers:
        c = os.path.join(AEDE, *d, nom)
        if os.path.isfile(c):
            return c
    raise SystemExit(f'{nom} introuvable sous {AEDE}')


def donnees():
    liste = open(trouver('LISTE_DES_CINQ_MILLE.txt', [('app', 'aede_app', 'static'), ('03_CAVE_STONE_5',), ('trousse', '03_CAVE_STONE_5'),
                                                     ('librairie', 'aede_app', 'static')]), encoding='utf-8').read()
    assert hashlib.sha256(liste.encode()).hexdigest() == '01622e7b67eb5faf9e17107e4ac16fd5aa8aa602c343ad78f46be52b586b8e2a', 'liste alteree'
    mots = [l[5:] for l in liste.splitlines()]
    assert len(mots) == 5000
    ecrire(os.path.join(APP, 'gg_liste.js'), '/* La liste publique des cinq mille (Pierre, annexe B). */\nthis.GG_LISTE = {"texte": ' + json.dumps(liste, ensure_ascii=False) +
           ',\n"mots": ' + json.dumps(mots, ensure_ascii=False) + '};\n')
    pierre = open(trouver('PIERRE_DU_PROGRAMME_V1j.md', [('pierre',), ('01_PIERRE',), ('trousse', '01_PIERRE')]), encoding='utf-8').read()
    ecrire(os.path.join(APP, 'gg_pierre.js'), '/* La Pierre du programme V1j, texte integral, et son empreinte. */\nthis.GG_PIERRE = {"sha256": "' + hashlib.sha256(pierre.encode()).hexdigest() +
           '", "texte": ' + json.dumps(pierre, ensure_ascii=False) + '};\n')
    conditions()
    # l'ancre : ce que ce programme sait d'avance, epingle a la construction apres le semis (ancre.json, depuis la fiche de la Cave) :
    # l'adresse de l'auteur, la transaction d'amorce et l'empreinte du manifeste de chaque chasse. En bêta : rien d'epingle.
    ch = os.path.join(ICI, 'ancre.json')
    # adresse_auteur (facultative, a la racine) : l'adresse des messages de l'auteur seule, epinglee avant meme le semis de la chasse 1 ;
    # sans elle (ni celle d'une chasse), GodGift Core ne retient aucune chasse annoncee (Pierre V1j, article 8).
    ancre = json.load(open(ch, encoding='utf-8')) if os.path.isfile(ch) else {'chasse1': None, 'chasse0': None, 'adresse_auteur': None}
    ancre.setdefault('adresse_auteur', None)
    for k in ('chasse1', 'chasse0'):
        v = ancre.get(k)
        if v:
            assert re.fullmatch(r'[0-9a-f]{64}', v.get('manifeste_sha256', '')) and re.fullmatch(r'[0-9a-f]{64}', v.get('amorce_txid', '')) and v.get('adresse_auteur', '').startswith(('bc1q', 'tb1q')), f'ancre {k} invalide'
    a = ancre['adresse_auteur']
    if a is not None:
        assert isinstance(a, str) and re.fullmatch(r'(bc1q|tb1q)[02-9ac-hj-np-z]{38,58}', a), 'ancre adresse_auteur invalide'
        assert all(not ancre.get(k) or ancre[k]['adresse_auteur'] == a for k in ('chasse1', 'chasse0')), 'ancre : adresse_auteur differe de celle d une chasse'
    # hors beta, un GodGift Core sans adresse d'auteur epinglee ne retiendrait aucune chasse et lirait les messages sans ancre : refuse
    # (audit godgift I5). La beta reste sans ancre.
    if 'beta' not in VERSION:
        assert a, f'version {VERSION} (hors beta) : ancre.json doit donner adresse_auteur'
    # les serveurs de secours de la vente epingles a la construction (Pierre, article 10) : les origines https de web_origines.txt ;
    # les autres viennent d'un message signe de l'auteur (AEDE:secours:https://<hote>), jamais d'une simple annonce de la caisse
    ancre['secours'] = [o for o in origines_epinglees() if o.startswith('https://')]
    ecrire(os.path.join(APP, 'gg_ancre.js'), '/* L\'ancre de GodGift Core : les references epinglees a la construction (nulles en bêta). */\nthis.GG_ANCRE = ' + json.dumps(ancre, sort_keys=True) + ';\n')
    # le guide et son glossaire, dans les cinq langues (le francais fait foi) : memes identifiants partout
    g = {l: json.load(open(os.path.join(ICI, 'guide', f'guide_{l}.json'), encoding='utf-8')) for l in ('fr', 'en', 'es', 'de', 'pt')}
    ids = [m['id'] for m in g['fr']['mots']]
    for l, d in g.items():
        assert [m['id'] for m in d['mots']] == ids and [m['voir'] for m in d['mots']] == [m['voir'] for m in g['fr']['mots']], f'guide {l} : identifiants'
        assert len(d['parcours']) == len(g['fr']['parcours']) and len(d['faq']) == len(g['fr']['faq']), f'guide {l} : structure'
        assert '\u2014' not in json.dumps(d, ensure_ascii=False), f'guide {l} : tiret cadratin'
    assert all(v in ids for m in g['fr']['mots'] for v in m['voir']), 'guide : renvoi vers un mot absent'
    ecrire(os.path.join(APP, 'gg_guide.js'), '/* Le guide de GodGift Core : premiers pas, glossaire, questions (cinq langues, le francais fait foi). */\nthis.GG_GUIDE = ' +
           json.dumps(g, ensure_ascii=False, separators=(',', ':')) + ';\n')


# Les mentions de la section 1 des conditions generales (qui vend, ou, qui heberge) : celles que la caisse publie depuis ses reglages.
# GodGift Core les embarque si mentions.json (a cote de ce fichier) les donne ; sinon il ecrit « (a completer) », comme la caisse.
CHAMPS_MENTIONS = ('vendeur', 'statut', 'adresse', 'siret', 'courriel', 'hebergeur', 'hebergeur_site', 'hebergeur_app', 'mediateur')


def conditions():
    """app/gg_cg.js : les conditions generales (francais, qui fait foi, et anglais), texte integral et empreinte du fichier publie, comme
    la Pierre : le bouton « Conditions generales » les ouvre dans le programme, sans dependre de la librairie."""
    cg = {}
    for l, nom in (('fr', 'CONDITIONS_GENERALES.md'), ('en', 'CONDITIONS_GENERALES_EN.md')):
        brut = open(trouver(nom, [('pierre',), ('01_PIERRE',), ('trousse', '01_PIERRE')]), encoding='utf-8').read()
        assert '\u2014' not in brut, f'{nom} : tiret cadratin'
        cg[l] = {'sha256': hashlib.sha256(brut.encode()).hexdigest(), 'texte': brut}
    f = os.path.join(ICI, 'mentions.json')
    if os.path.isfile(f):
        m = json.load(open(f, encoding='utf-8'))
        assert set(m) <= set(CHAMPS_MENTIONS), f'mentions.json : champ inconnu {sorted(set(m) - set(CHAMPS_MENTIONS))}'
        m = {k: str(v or '').strip() for k, v in m.items()}
        m['hebergeur_site'] = m.get('hebergeur_site') or m.get('hebergeur', '')   # un seul serveur : la caisse sert aussi le site
        for x in cg.values():
            for k, v in m.items():
                if v:
                    x['texte'] = x['texte'].replace('{{' + k.upper() + '}}', v)
    ecrire(os.path.join(APP, 'gg_cg.js'), '/* Les conditions generales (le francais fait foi), texte integral et empreinte du fichier publie (Pierre, 01_PIERRE). */\nthis.GG_CG = ' +
           json.dumps(cg, ensure_ascii=False, sort_keys=True) + ';\n')


def images():
    from PIL import Image
    os.makedirs(os.path.join(APP, 'img'), exist_ok=True); os.makedirs(os.path.join(APP, 'fonts'), exist_ok=True)
    src = os.path.join(AEDE, 'site', 'aede_site', 'static', 'src')
    for f in os.listdir(os.path.join(APP, 'img')):          # on repart de zero : seules les images du livre choisies ci-dessous
        if f.startswith('fond_'):
            os.remove(os.path.join(APP, 'img', f))
    ange = os.path.join(AEDE, 'marketing', 'images_ange')    # les illustrations de l'atmosphere du livre (27 septembre)
    for n in ('coffre_salle_inondee', 'coffre_quai', 'auteur_bureau_lyon', 'cave_forte', 'vouivre_tete', 'auteur_quai', 'vouivre_vol_2', 'vouivre_rocher'):
        im = Image.open(os.path.join(ange, n + '.jpg')).convert('RGB'); im.thumbnail((1600, 1600))
        im.save(os.path.join(APP, 'img', 'fond_' + n + '.jpg'), quality=76, optimize=True)
    for n, src_ in (('accueil_vouivre', 'vouivre_vol_1'), ('accueil_vitrine', 'librairie_vitrine'), ('accueil_sceau', 'cave_sceau_mains')):   # l'accueil : un ecran, une image
        im = Image.open(os.path.join(ange, src_ + '.jpg')).convert('RGB'); im.thumbnail((1920, 1920))
        im.save(os.path.join(APP, 'img', 'fond_' + n + '.jpg'), quality=80, optimize=True, progressive=True)
    for f in ('cinzel-latin-400-normal', 'cinzel-latin-700-normal', 'cormorant-garamond-latin-600-normal', 'cormorant-garamond-latin-700-normal',
              'cormorant-garamond-latin-600-italic', 'dm-sans-latin-400-normal', 'dm-sans-latin-600-normal', 'dm-sans-latin-700-normal'):
        shutil.copy(os.path.join(src, 'fonts', f + '.woff2'), os.path.join(APP, 'fonts', f + '.woff2'))
    icone()


def icone():
    """Un coffre d'or dont la lumiere s'echappe, sur la nuit : dessine ici, sans police ni fichier externe."""
    from PIL import Image, ImageDraw, ImageFilter
    T = 1024; im = Image.new('RGBA', (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([40, 40, T - 40, T - 40], 200, fill=(16, 21, 29, 255), outline=(201, 154, 62, 255), width=18)
    halo = Image.new('RGBA', (T, T), (0, 0, 0, 0)); dh = ImageDraw.Draw(halo)
    dh.ellipse([230, 250, 794, 640], fill=(244, 200, 110, 150)); halo = halo.filter(ImageFilter.GaussianBlur(70)); im.alpha_composite(halo)
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in ((512, 440, 512, 200), (400, 450, 300, 250), (624, 450, 724, 250), (330, 480, 190, 380), (694, 480, 834, 380)):
        d.line([x0, y0, x1, y1], fill=(255, 231, 163, 255), width=22)
    d.rounded_rectangle([220, 330, 804, 520], 70, fill=(138, 100, 32, 255), outline=(255, 240, 191, 255), width=16)   # couvercle
    d.rectangle([220, 450, 804, 520], fill=(138, 100, 32, 255))
    d.rounded_rectangle([220, 510, 804, 800], 24, fill=(106, 74, 20, 255), outline=(255, 240, 191, 255), width=16)   # corps
    d.line([220, 510, 804, 510], fill=(255, 231, 163, 255), width=26)                                                  # la fente de lumiere
    d.line([330, 340, 330, 800], fill=(255, 240, 191, 200), width=12); d.line([694, 340, 694, 800], fill=(255, 240, 191, 200), width=12)
    d.rounded_rectangle([462, 560, 562, 690], 16, fill=(15, 17, 22, 255), outline=(255, 240, 191, 255), width=12)
    d.ellipse([496, 590, 528, 622], fill=(255, 240, 191, 255)); d.line([512, 615, 512, 660], fill=(255, 240, 191, 255), width=12)
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(APP, 'img', 'icone.png'), optimize=True)
    for c in (192, 512):                                    # l'application web installable (telephone) : manifest.webmanifest
        im.resize((c, c), Image.LANCZOS).save(os.path.join(APP, 'img', f'icone_{c}.png'), optimize=True)
    im.save(os.path.join(APP, 'img', 'icone.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    im.save(os.path.join(APP, 'img', 'icone.icns'))


def fichiers_app():
    out = []
    for r, _, fs in os.walk(APP):
        for f in fs:
            p = os.path.relpath(os.path.join(r, f), ICI).replace(os.sep, '/')
            if f not in HORS_LISTE:
                out.append(p)
    return sorted(out)


def sans_atelier():
    """Le programme livre ne connait aucun crochet de banc d'essai (audit godgift) : ni GG_ATELIER, ni l'interieur expose (GG_TOUT).
    Les bancs travaillent sur une copie de app/ qu'ils modifient eux-memes (tests/atelier.py)."""
    for p in fichiers_app():
        if p.endswith(('.js', '.html')):
            t = open(os.path.join(ICI, p), encoding='utf-8', errors='replace').read()
            assert 'GG_ATELIER' not in t, f'{p} contient un crochet d atelier : construction refusee'
            assert not re.search(r'window\.GG_TOUT|GG_TOUT\s*:', t), f'{p} expose l interieur du programme : construction refusee'
    assert not [p for p in fichiers_app() if not re.fullmatch(r'app/[A-Za-z0-9_./-]+', p)], 'un nom de fichier inattendu dans app/'


def sommes():
    page_web()
    sans_atelier()
    lignes = ''.join(f'{hashlib.sha256(open(os.path.join(ICI, p), "rb").read()).hexdigest()}  {p}\n' for p in fichiers_app())
    ecrire(os.path.join(ICI, 'SHA256SUMS'), lignes)
    emp = hashlib.sha256(lignes.encode()).hexdigest()
    ecrire(os.path.join(APP, 'gg_empreinte.js'), f'/* Ecrit par l\'installateur apres avoir verifie chaque fichier. */\nthis.GG_EMPREINTE = {{"empreinte": "{emp}", "fichiers": {len(fichiers_app())}}};\n')
    return emp


# ---------------------------------------------------------------------------------------------- la version web (app.angedeleau.com)
# Les origines exactes que le programme lit depuis la version web, en https et wss seulement (audit serveur C3) : la librairie (dans la
# version web, CAISSE_DEF vaut https://angedeleau.com), les deux explorateurs, les relais drand, les relais Nostr. Un serveur de secours
# de la librairie s'ajoute dans web_origines.txt (une origine par ligne), puis on reconstruit : la page web ne joint rien d'autre.
ORIGINES_WEB = ['https://angedeleau.com', 'https://mempool.space', 'https://blockstream.info',
                'https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com',
                'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band']
# lues par le programme installe seulement (la librairie en direct), ou simples liens : pas dans la CSP de la version web
ORIGINES_HORS_WEB = ['https://librairie.angedeleau.com', 'https://app.angedeleau.com', 'http://umbrel.local:3006']


def origines_epinglees():
    """Les origines de web_origines.txt (une par ligne, https:// ou wss://, sans chemin) : un serveur de secours de la librairie."""
    o = []
    f = os.path.join(ICI, 'web_origines.txt')
    if os.path.isfile(f):
        for l in open(f, encoding='utf-8').read().splitlines():
            l = l.strip()
            if l and not l.startswith('#'):
                assert re.fullmatch(r'(https|wss)://[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?', l), f'web_origines.txt : origine invalide {l!r} (https:// ou wss://, sans chemin)'
                if l not in o:
                    o.append(l)
    return o


def origines_web():
    o = list(ORIGINES_WEB)
    for l in origines_epinglees():
        if l not in o:
            o.append(l)
    # chaque origine ecrite dans le programme est connue ici : une source ajoutee au code sans etre ajoutee a la CSP serait muette sur le web
    code = open(os.path.join(APP, 'gg_app.js'), encoding='utf-8').read()
    for x in sorted(set(re.findall(r'(?:https?|wss?)://[a-z0-9.-]+(?::[0-9]+)?', code))):
        assert x in o or x in ORIGINES_HORS_WEB, f'gg_app.js joint {x} : a ajouter a ORIGINES_WEB (ou ORIGINES_HORS_WEB)'
    return o


def csp_web(en_tete=False):
    """La CSP de la version web. frame-ancestors ne vaut que dans un en-tete HTTP (_headers) : une balise meta l'ignore ; la page refuse
    aussi elle-meme d'etre ouverte dans un cadre (gg_app.js)."""
    c = ["default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
         "connect-src 'self' " + ' '.join(origines_web()), "manifest-src 'self'", "worker-src 'self'", "object-src 'none'", "base-uri 'none'",
         "form-action 'none'"]
    if en_tete:
        c.append("frame-ancestors 'none'")
    return '; '.join(c)


def sri(chemin):
    import base64
    return 'sha384-' + base64.b64encode(hashlib.sha384(open(chemin, 'rb').read()).digest()).decode()


def page_web():
    """app/index.html, tiree de app/godgift.html : chaque <script> et la feuille de style portent leur empreinte SRI (un navigateur refuse
    un fichier altere), la CSP se limite aux origines exactes, et gg_empreinte.js n'est pas charge (index.html est dans SHA256SUMS, dont
    gg_empreinte.js depend : la page web calcule l'empreinte en lisant SHA256SUMS). En file:// (installe), SRI bloquerait tout : d'ou deux pages."""
    src = open(os.path.join(APP, 'godgift.html'), encoding='utf-8').read()
    h = re.sub(r'<!--.*?-->\n', '', src, count=1, flags=re.S)
    h = h.replace('<!doctype html>\n', '<!doctype html>\n<!-- GodGift Core, version web (app.angedeleau.com). Ecrite par construire.py depuis godgift.html : ne pas modifier a la main. -->\n', 1)
    h, n = re.subn(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', '<meta http-equiv="Content-Security-Policy" content="' + csp_web() + '">', h)
    assert n == 1, 'godgift.html : CSP introuvable'
    h, n = re.subn(r'<script src="gg_empreinte\.js"></script>\n', '', h)
    assert n == 1, 'godgift.html : gg_empreinte.js introuvable'
    h, n = re.subn(r'<script src="gg_fenetre\.js"></script>\n', '', h)   # la version web n'est jamais la fenetre dediee
    assert n == 1, 'godgift.html : gg_fenetre.js introuvable'
    def avec_sri(m):
        f = m.group(2)
        assert re.fullmatch(r'[a-z0-9_]+\.(js|css)', f), f
        return m.group(1) + f + '" integrity="' + sri(os.path.join(APP, f)) + '"' + m.group(3)
    h = re.sub(r'(<script src=")([^"]+)"(></script>)', avec_sri, h)
    h = re.sub(r'(<link rel="stylesheet" href=")([^"]+)"(>)', avec_sri, h)
    assert len(re.findall(r'<script\b', h)) == len(re.findall(r'<script src="[^"]+" integrity="sha384-[A-Za-z0-9+/=]+"></script>', h)), 'un script sans SRI'
    assert len(re.findall(r'<link rel="stylesheet"', h)) == len(re.findall(r'<link rel="stylesheet" href="[^"]+" integrity="sha384-', h)), 'une feuille sans SRI'
    ecrire(os.path.join(APP, 'index.html'), h)


def texte_sw(lignes, emp):
    """dist/web/gg_sw.js : le modele web/gg_sw.js, avec l'empreinte et la liste de cette version (chemins sans app/)."""
    s = {}
    for l in lignes.splitlines():
        hx, p = l.split('  ', 1)
        assert p.startswith('app/')
        if p != 'app/godgift.html':          # pas servie par la version web (contre-audit N5)
            s[p[4:]] = hx
    s['SHA256SUMS'] = emp
    m = open(os.path.join(ICI, 'web', 'gg_sw.js'), encoding='utf-8').read()
    assert m.count('var EMPREINTE = "";') == 1 and m.count('var SOMMES = {};') == 1
    m = m.replace('var EMPREINTE = "";', 'var EMPREINTE = "' + emp + '";').replace('var SOMMES = {};', 'var SOMMES = ' + json.dumps(s, sort_keys=True, separators=(',', ':')) + ';')
    return m


def en_tetes():
    """dist/web/_headers : les en-tetes que Cloudflare Pages ou Netlify servent avec chaque fichier."""
    return f'''# GodGift Core, version web : les en-tetes de l'hebergeur (format Cloudflare Pages et Netlify). Ecrit par construire.py.
/*
  Content-Security-Policy: {csp_web(True)}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/gg_sw.js
  Cache-Control: no-cache
/SHA256SUMS
  Cache-Control: no-cache
  Content-Type: text/plain; charset=utf-8
'''


def web(emp):
    """dist/web/ : la version web, prete a deposer telle quelle sur app.angedeleau.com (hebergement statique a part, pas la caisse)."""
    d = os.path.join(ICI, 'dist', 'web'); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    lignes = open(os.path.join(ICI, 'SHA256SUMS'), encoding='utf-8').read()
    assert hashlib.sha256(lignes.encode()).hexdigest() == emp
    for p in fichiers_app():
        if p == 'app/godgift.html':          # la page installee (file://, sans SRI, CSP large) n'est pas deposee (contre-audit N5)
            continue
        c = os.path.join(d, p[4:]); os.makedirs(os.path.dirname(c), exist_ok=True); shutil.copyfile(os.path.join(ICI, p), c)
    shutil.copyfile(os.path.join(ICI, 'SHA256SUMS'), os.path.join(d, 'SHA256SUMS'))
    ecrire(os.path.join(d, 'gg_sw.js'), texte_sw(lignes, emp))
    ecrire(os.path.join(d, '_headers'), en_tetes())
    shutil.copyfile(os.path.join(ICI, 'web', 'LISEZ_MOI_HEBERGEMENT.md'), os.path.join(ICI, 'dist', 'LISEZ_MOI_HEBERGEMENT.md'))
    return d


def exe_windows(emp):
    """Le vrai installateur Windows : un seul .exe (NSIS). Images de l'assistant tirees du livre."""
    from PIL import Image, ImageDraw
    b = os.path.join(ICI, 'build_nsis'); os.makedirs(b, exist_ok=True)
    im = Image.open(os.path.join(AEDE, 'marketing', 'images_ange', 'vouivre_vol_1.jpg')).convert('RGB')
    w, h = im.size; cw = int(h * 164 / 314)                       # la tete de la Vouivre, a la verticale
    x0 = min(max(int(w * 0.62) - cw // 2, 0), w - cw)
    im.crop((x0, 0, x0 + cw, h)).resize((164, 314), Image.LANCZOS).save(os.path.join(b, 'accueil.bmp'))
    e = Image.new('RGB', (150, 57), (16, 21, 29)); ic = Image.open(os.path.join(APP, 'img', 'icone.png')).convert('RGBA').resize((45, 45), Image.LANCZOS)
    e.paste(ic, (99, 6), ic); ImageDraw.Draw(e).line([0, 56, 150, 56], fill=(201, 154, 62)); e.save(os.path.join(b, 'entete.bmp'))
    taille = sum(os.path.getsize(os.path.join(ICI, p)) for p in fichiers_app()) // 1024
    sortie = os.path.join(ICI, 'dist', f'{NOM}_Windows.exe'); os.makedirs(os.path.dirname(sortie), exist_ok=True)
    groupes = ' '.join(emp[i:i + 4] for i in range(0, 32, 4)) + '$\\r$\\n' + ' '.join(emp[i:i + 4] for i in range(32, 64, 4))
    subprocess.run(['makensis', '-V2', f'-DVERSION={VERSION}', f'-DVERSION_NUM={VERSION_NUM}', f'-DEMPREINTE={groupes}', f'-DTAILLE_KO={taille}', f'-DSOURCE={ICI}', f'-DSORTIE={sortie}',
                    os.path.join(ICI, 'installateur_windows.nsi')], check=True)
    return sortie


DATE = (2026, 12, 8, 18, 15, 4); EPOCH = 1796753704   # 2026-12-08 18:15:04 UTC : toutes les dates des paquets


def zipper(z, plan):
    """plan : [(source, chemin dans le zip, executable ?)]. Dates fixes, ordre trie : reproductible."""
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for src, dst, x in sorted(plan, key=lambda e: e[1]):
            info = zipfile.ZipInfo(dst, date_time=DATE); info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3; info.external_attr = (0o100755 if x else 0o100644) << 16
            zf.writestr(info, open(src, 'rb').read())


def app_mac():
    """GodGift Core.app : une vraie application Mac, a glisser dans Applications (sans signature Apple : « Ouvrir quand meme » une fois)."""
    racine = 'GodGift Core.app/Contents/'
    plist = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>GodGift Core</string><key>CFBundleDisplayName</key><string>GodGift Core</string>
<key>CFBundleIdentifier</key><string>com.angedeleau.godgiftcore</string><key>CFBundleExecutable</key><string>godgift</string>
<key>CFBundleIconFile</key><string>icone</string><key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>{VERSION_NUM}</string><key>CFBundleVersion</key><string>{VERSION_NUM}</string>
<key>LSMinimumSystemVersion</key><string>10.13</string><key>NSHighResolutionCapable</key><true/>
</dict></plist>
'''
    b = os.path.join(ICI, 'build_mac'); os.makedirs(b, exist_ok=True); ecrire(os.path.join(b, 'Info.plist'), plist)
    # Resources/SHA256SUMS : la liste contre laquelle le lanceur reverifie, a chaque demarrage, le programme qu'il ouvre (contre-verification V4)
    plan = [(os.path.join(b, 'Info.plist'), racine + 'Info.plist', False), (os.path.join(ICI, 'paquets', 'mac', 'godgift'), racine + 'MacOS/godgift', True),
            (os.path.join(APP, 'img', 'icone.icns'), racine + 'Resources/icone.icns', False), (os.path.join(ICI, 'SHA256SUMS'), racine + 'Resources/SHA256SUMS', False)]
    plan += [(os.path.join(ICI, p), racine + 'Resources/' + p, False) for p in fichiers_app() + ['app/gg_empreinte.js']]
    z = os.path.join(ICI, 'dist', f'{NOM}_Mac.zip'); zipper(z, plan)
    return z, plan


def paquet_deb():
    """godgift-core_<version>_all.deb : Debian, Ubuntu, Raspberry Pi OS (PC et Raspberry : le programme est le meme partout)."""
    b = os.path.join(ICI, 'build_deb'); shutil.rmtree(b, ignore_errors=True)
    part = os.path.join(b, 'usr', 'share', 'godgift-core'); os.makedirs(part)
    shutil.copytree(APP, os.path.join(part, 'app'), ignore=shutil.ignore_patterns('gg_fenetre.js'))   # gg_empreinte.js y est (le paquet est verifie par dpkg) ; le jeton, jamais
    ecrire(os.path.join(part, 'VERSION'), VERSION + '\n')
    # la liste du programme, sous /usr/share (root seul l'ecrit, dpkg la verifie) : le lanceur y reverifie a chaque demarrage la copie
    # qu'il ouvre depuis le dossier de l'utilisateur (contre-verification V4)
    shutil.copyfile(os.path.join(ICI, 'SHA256SUMS'), os.path.join(part, 'SHA256SUMS'))
    os.makedirs(os.path.join(b, 'usr', 'bin')); shutil.copy(os.path.join(ICI, 'paquets', 'deb', 'godgift-core'), os.path.join(b, 'usr', 'bin', 'godgift-core'))
    os.makedirs(os.path.join(b, 'usr', 'share', 'applications'))
    ecrire(os.path.join(b, 'usr', 'share', 'applications', 'godgift-core.desktop'), '''[Desktop Entry]
Type=Application
Name=GodGift Core
Comment=L'Ange de l'Eau : le noeud de la chasse (The Angel of the Water)
Exec=godgift-core
Icon=godgift-core
Terminal=false
Categories=Game;Network;
''')
    ico = os.path.join(b, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps'); os.makedirs(ico); shutil.copy(os.path.join(APP, 'img', 'icone.png'), os.path.join(ico, 'godgift-core.png'))
    doc = os.path.join(b, 'usr', 'share', 'doc', 'godgift-core'); os.makedirs(doc); shutil.copy(os.path.join(ICI, 'LICENSE'), os.path.join(doc, 'copyright'))
    taille = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(b) for f in fs) // 1024
    os.makedirs(os.path.join(b, 'DEBIAN'))
    ecrire(os.path.join(b, 'DEBIAN', 'control'), f'''Package: godgift-core
Version: {VERSION_DEB}
Architecture: all
Maintainer: L'Ange de l'Eau <contact@angedeleau.com>
Installed-Size: {taille}
Section: games
Priority: optional
Recommends: chromium | chromium-browser | google-chrome-stable | microsoft-edge-stable | brave-browser
Homepage: https://angedeleau.com
Description: GodGift Core, le noeud de la chasse de L'Ange de l'Eau
 Il suit les 24 coffres sur la chaine Bitcoin, verifie tout lui-meme,
 fait chasser hors ligne et fait devenir compagnon ; quand un chasseur trouve,
 il vide lui-meme le coffre vers son adresse de reception signee.
 Aucune donnee personnelle ; aucune cle conservee. Licence AGPL-3.0.
 The Angel of the Water: the node of the hunt. No personal data; no key kept.
''')
    for r, ds, fs in os.walk(b):
        for d in ds: os.chmod(os.path.join(r, d), 0o755)
        for f in fs: os.chmod(os.path.join(r, f), 0o755 if f == 'godgift-core' and r.endswith('bin') else 0o644)
    for r, ds, fs in os.walk(b):
        for n in ds + fs: os.utime(os.path.join(r, n), (EPOCH, EPOCH), follow_symlinks=False)
    os.utime(b, (EPOCH, EPOCH))                                  # la racine « ./ » du paquet aussi : sans quoi l'heure de construction y entrait
    sortie = os.path.join(ICI, 'dist', f'godgift-core_{VERSION}_all.deb')
    subprocess.run(['dpkg-deb', '--root-owner-group', '-Zxz', '--build', b, sortie], check=True, env=dict(os.environ, SOURCE_DATE_EPOCH=str(EPOCH)), stdout=subprocess.DEVNULL)
    return sortie


def archive(emp, exe, mac_plan, deb):
    """Le paquet complet : la page pour choisir son appareil, un installateur par systeme ; le reste dans fichiers/."""
    z = os.path.join(ICI, 'dist', NOM + '.zip'); N = NOM + '/'
    plan = [(os.path.join(ICI, p), N + p, False) for p in ('Commencer ici.html', 'LISEZ_MOI.txt')]
    plan += [(exe, N + 'Installer (Windows).exe', False), (deb, N + 'Installer (Linux, Raspberry Pi).deb', False)]
    plan += [(src, N + dst, x) for src, dst, x in mac_plan]
    plan += [(os.path.join(ICI, p), N + 'fichiers/' + p, False) for p in ['LICENSE', 'SHA256SUMS'] + fichiers_app() + ['app/gg_empreinte.js']]
    plan += [(os.path.join(ICI, 'installer_linux.sh'), N + 'fichiers/installer_linux.sh', True)]
    zipper(z, plan)
    for f in (z, exe, deb, os.path.join(ICI, 'dist', f'{NOM}_Mac.zip')):
        ecrire(f + '.sha256', f'{hashlib.sha256(open(f, "rb").read()).hexdigest()}  {os.path.basename(f)}\n')
    # la liste des installateurs officiels, servie par la librairie (page « Verifier mon installateur ») ;
    # apres la signature Windows (signer_windows.ps1), c'est la liste recalculee qui la remplace
    ecrire(os.path.join(ICI, 'dist', 'INSTALLATEURS.json'), json.dumps({'version': VERSION, 'empreinte_programme': emp, 'fichiers': [
        {'nom': os.path.basename(f), 'sha256': hashlib.sha256(open(f, 'rb').read()).hexdigest()} for f in (exe, os.path.join(ICI, 'dist', f'{NOM}_Mac.zip'), deb, z)]}, indent=1) + '\n')
    return z, hashlib.sha256(open(z, 'rb').read()).hexdigest()


def fins_de_ligne():
    """Windows : CRLF, et le BOM pour que PowerShell 5 lise les accents. Idempotent."""
    for n, bom in (('installer_windows.ps1', True), ('LISEZ_MOI.txt', True)):
        c = os.path.join(ICI, n); t = open(c, 'rb').read().decode('utf-8-sig').replace('\r\n', '\n').replace('\n', '\r\n')
        open(c, 'wb').write(('\ufeff' if bom else '').encode('utf-8') + t.encode('utf-8'))


if __name__ == '__main__':
    fins_de_ligne(); donnees(); images()
    emp = sommes()
    exe = exe_windows(emp)
    mac, mac_plan = app_mac()
    deb = paquet_deb()
    z, h = archive(emp, exe, mac_plan, deb)
    w = web(emp)
    ko = lambda f: f'{os.path.getsize(f) // 1024} Kio'
    print(f'GodGift Core {VERSION}\n  empreinte du programme (SHA-256 de SHA256SUMS) : {emp}\n  {len(fichiers_app())} fichiers\n  version web : {w}')
    for n, f in (('Windows', exe), ('Mac', mac), ('Linux, Raspberry Pi', deb), ('paquet complet', z)):
        print(f'  {n:22s}: {os.path.basename(f)} ({ko(f)})')
