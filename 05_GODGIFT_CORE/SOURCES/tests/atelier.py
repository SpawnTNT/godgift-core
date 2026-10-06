# -*- coding: utf-8 -*-
"""L'atelier des bancs de GodGift Core.

Le programme livre n'expose rien de son interieur et ne connait aucun crochet de banc (audit godgift : construire.py refuse
GG_ATELIER et GG_TOUT expose). Les bancs qui ont besoin de l'interieur travaillent sur une COPIE de app/, faite ici, ou trois
lignes sont changees : les relais drand et la chaine drand peuvent etre remplaces par ceux du monde d'essai
(window.GG_ATELIER_RELAIS, window.GG_ATELIER_CHAINE), et l'objet GG expose tout l'interieur (GG_TOUT). Rien d'autre ne change.

Les chemins : la disposition de la trousse (03_CAVE_STONE_5, 01_PIERRE) ou celle du paquet maitre (cave/STONE_5, pierre)."""
import atexit, json, os, shutil, tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.dirname(ICI)
APP = os.path.join(SOURCES, 'app')


def chercher(*candidats, dossier=False):
    for c in candidats:
        p = os.path.abspath(os.path.join(SOURCES, c))
        if (os.path.isdir(p) if dossier else os.path.isfile(p)):
            return p
    raise SystemExit('introuvable : ' + ' ou '.join(candidats))


CAVE = chercher('../../03_CAVE_STONE_5', '../../../cave/STONE_5', dossier=True)
VECTEURS = chercher('../../01_PIERRE/VECTEURS_TEST_V1g.json', '../../../pierre/VECTEURS_TEST_V1g.json')
LIBRAIRIE = chercher('../../../librairie/aede_app', '../../../../librairie/aede_app', dossier=True)


def epub_maitre():
    """L'EPUB du roman, lu seulement (jamais modifie) : le banc en fait un exemplaire d'essai dans un dossier temporaire."""
    return chercher('../../livre/L_ANGE_DE_L_EAU.epub', '../../../livre/L_ANGE_DE_L_EAU.epub', '../../../librairie/aede_app/livres/L_ANGE_DE_L_EAU.epub')


ECHANGES = [
    ('var RELAIS_DRAND = [', 'var RELAIS_DRAND = window.GG_ATELIER_RELAIS || ['),
    ('var QUICKNET = {', 'var QUICKNET = window.GG_ATELIER_CHAINE || {'),
    ('window.GG = { codeCompagnon: codeCompagnon, dateEnigme: dateEnigme, lireReponse: lireReponse };', 'window.GG = GG_TOUT;'),
]


def copie_app(ancre=None, fenetre=False):
    """Une copie de app/ pour le banc ; rend l'adresse file:// de sa page installee (godgift.html). ancre : un GG_ANCRE d'essai.
    fenetre : comme un installateur, un jeton tire au hasard, son empreinte dans gg_fenetre.js, et l'adresse de la fenetre dediee
    (godgift.html?fenetre=<jeton>) ; sans ce parametre (ou en retirant ?fenetre=...), la meme page n'est PAS la fenetre dediee."""
    d = tempfile.mkdtemp(prefix='gg_banc_')
    atexit.register(shutil.rmtree, d, True)
    a = os.path.join(d, 'app')
    shutil.copytree(APP, a, ignore=shutil.ignore_patterns('gg_fenetre.js'))
    f = os.path.join(a, 'gg_app.js')
    t = open(f, encoding='utf-8').read()
    for avant, apres in ECHANGES:
        assert t.count(avant) == 1, 'atelier : ligne introuvable dans gg_app.js : ' + avant
        t = t.replace(avant, apres)
    open(f, 'w', encoding='utf-8').write(t)
    if ancre is not None:
        open(os.path.join(a, 'gg_ancre.js'), 'w', encoding='utf-8').write('this.GG_ANCRE = ' + json.dumps(ancre, sort_keys=True) + ';\n')
    if fenetre:
        import hashlib, secrets
        jeton = secrets.token_hex(32)
        open(os.path.join(a, 'gg_fenetre.js'), 'w', encoding='utf-8').write('this.GG_FENETRE = {"empreinte": "' + hashlib.sha256(jeton.encode()).hexdigest() + '"};\n')
        return 'file://' + os.path.join(a, 'godgift.html') + '?fenetre=' + jeton
    return 'file://' + os.path.join(a, 'godgift.html')


def page_livree():
    """La page installee du programme LIVRE (sans copie ni changement) : pour les bancs qui n'ont pas besoin de l'interieur."""
    return 'file://' + os.path.join(APP, 'godgift.html')
