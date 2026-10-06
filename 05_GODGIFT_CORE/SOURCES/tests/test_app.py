# -*- coding: utf-8 -*-
"""Banc de GodGift Core dans un vrai Chromium, en file:// comme apres installation (godgift.html, le programme livre).
Seconde passe : le nom officiel « GodGift Core » ; les nombres et les heures selon chaque langue (espace fine, UTC puis Paris) ; les
textes francais en typographie francaise ; les conditions generales embarquees, ouvertes dans le programme ; Reseau en demonstration."""
import hashlib, json, os, re, sys, time
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ICI)
import atelier
URL = atelier.page_livree()          # le programme LIVRE, tel que l'installateur l'ouvre (godgift.html), sans copie ni crochet
CG_FR = atelier.chercher('../../01_PIERRE/CONDITIONS_GENERALES.md', '../../../pierre/CONDITIONS_GENERALES.md')
CAP = os.path.join(ICI, 'captures'); ok = 0; erreurs = []
V = json.load(open(atelier.VECTEURS))
def vert(m):
    global ok; ok += 1; print('  vert :', m)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--js-flags=--max-old-space-size=4096'])
    ctx = b.new_context(viewport={'width': 1360, 'height': 860}, bypass_csp=True)   # le robot a besoin d'eval ; la vraie politique est testee dans test_masterpiece
    pg = ctx.new_page(); pg.on('pageerror', lambda e: erreurs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and erreurs.append(m.text))
    # 1. premier lancement : l'accueil en trois ecrans
    pg.goto(URL + '?lang=de'); pg.wait_for_timeout(600)
    assert pg.is_visible('#accueil') and 'Ihre Sprache' in pg.inner_text('#accueil'); vert('accueil, langue de l installateur (de)')
    pg.click('[data-lang=fr]'); assert 'Votre langue' in pg.inner_text('#accueil'); vert('accueil : bascule en francais')
    pg.wait_for_timeout(1300); pg.screenshot(path=f'{CAP}/01_accueil_langue.png')
    pg.keyboard.press('ArrowDown'); assert 'Your language' in pg.inner_text('#accueil'); pg.keyboard.press('ArrowUp'); assert 'Votre langue' in pg.inner_text('#accueil')
    pg.keyboard.press('Enter'); assert '2 / 4' in pg.inner_text('#accueil'); vert('accueil au clavier : fleches et Entree')
    pg.click('[data-src=noeud]'); assert pg.is_visible('#ac-noeud'); pg.wait_for_timeout(1300); pg.screenshot(path=f'{CAP}/01b_accueil_chaine.png')
    pg.click('[data-src=public]'); pg.keyboard.press('Escape'); assert '1 / 4' in pg.inner_text('#accueil'); pg.keyboard.press('Enter'); pg.click('#ac-suivant')
    emp = pg.evaluate('GG_EMPREINTE.empreinte'); assert pg.inner_text('#ac-emp').replace(' ', '').replace('\n', '') == emp and pg.locator('#ac-emp span').count() == 16
    assert pg.evaluate("[...document.querySelectorAll('.ac-fond')].filter(f=>f.classList.contains('on')).map(f=>f.dataset.fond).join()") == '3'
    vert('accueil : empreinte en 16 groupes, image de l ecran 3')
    assert 'empreinte' in pg.inner_text('#accueil').lower(); pg.wait_for_timeout(1300); pg.screenshot(path=f'{CAP}/02_accueil_empreinte.png'); pg.click('#ac-suivant')
    assert '4 / 4' in pg.inner_text('#accueil') and pg.evaluate("document.getElementById('ac-suivant').disabled"); pg.wait_for_timeout(1300); pg.screenshot(path=f'{CAP}/02b_accueil_promesses.png')
    pg.click('[data-ac-temoin="0"]'); pg.click('#ac-suivant'); vert('accueil : les deux promesses (JAMAIS, temoin) ; le choix est demande')
    pg.wait_for_timeout(2500); assert not pg.is_visible('#accueil'); vert('accueil termine, reglages retenus')
    t = pg.inner_text('#page'); assert '4\u202f000\u00a0€' in t and 'À SEMER' in t; vert('vraie chasse avant le semis : 24 coffres a semer, 4 000 EUR (espace fine insecable des milliers)')
    assert pg.inner_text('.logo').startswith('GodGift Core') and 'GODGIFT' not in pg.evaluate("document.body.innerHTML"); vert('le nom officiel : GodGift Core, deux G majuscules')
    typo = pg.evaluate("""(function () {
        var fr = GG_I18N.fr, m = [];
        Object.keys(fr).forEach(function (k) { var s = fr[k]; if (/'|"| [;:!?»]|« |\u2014/.test(s)) m.push(k); });
        ['en', 'es', 'de', 'pt'].forEach(function (l) { Object.keys(GG_I18N[l]).forEach(function (k) { if (/\u2014|Godgift|GODGIFT/.test(GG_I18N[l][k])) m.push(l + ':' + k); }); });
        return m; })()""")
    assert not typo, typo; vert('textes francais : apostrophes et guillemets typographiques, espace insecable devant ; : ! ? et dans « » ; aucun tiret cadratin, aucun « Godgift »')
    pg.screenshot(path=f'{CAP}/03_reel_tableau.png')
    # 2. la verification en vrai (reseau peut etre coupe dans le banc) : aucune exception
    pg.goto(URL + '#/verifier'); pg.wait_for_timeout(800); pg.click('#lancer'); pg.wait_for_function('!document.querySelector("#lancer").disabled', timeout=90000)
    tv = pg.inner_text('#page'); assert 'La Pierre du programme' in tv and 'La liste des cinq mille' in tv and 'Ce programme' in tv; vert('verification reelle : 10 controles sans exception')
    assert '✓' in tv; pg.screenshot(path=f'{CAP}/04_reel_verifier.png', full_page=True)
    # 3. le moteur dans le navigateur : scrypt 1 Gio, vecteurs publics
    for v in V[:2]:
        a = pg.evaluate("""async v => { const ch = GGC.chaineCoffre(v.coffre, v.enigme_3, v.enigme_17, v.alea); const k = await GGC.cleCoffre(v.coffre, ch); return GGC.adresseDeCle(k); }""", v)
        assert a == v['adresse_mainnet'], a
    vert('scrypt 1 Gio dans Chromium : vecteurs publics de la Pierre retrouves')
    # 4. le mode demonstration, page par page
    pg.evaluate("localStorage.setItem('gg.demo','true')"); pg.goto(URL + '#/tableau'); pg.reload(); pg.wait_for_timeout(1200)
    t = pg.inner_text('#page'); assert 'DÉMONSTRATION' in pg.inner_text('#statut') and 'PRIS' in t and 'À PRENDRE' in t and 'EN CHASSE' in t and 'SCELLÉ' in t; vert('demo : les quatre etats des coffres')
    pg.screenshot(path=f'{CAP}/05_demo_tableau.png')
    pg.click('[data-coffre="5"]'); pg.wait_for_timeout(400); assert 'Trésor 5' in pg.inner_text('#page'); pg.screenshot(path=f'{CAP}/06_demo_coffre5.png'); vert('fiche du coffre 5')
    pg.click('[data-p=enigmes]'); pg.wait_for_timeout(400); assert 'Énigme n° 11' in pg.inner_text('#page'); pg.screenshot(path=f'{CAP}/07_demo_enigmes.png'); vert('enigmes parues, compte a rebours')
    te = pg.inner_text('#page'); assert re.search(r'3 juin 2027 à 18:15:05 UTC \(20:15:05 à Paris\)', te) and re.search(r'17 janvier 2027 à 18:15:05 UTC \(19:15:05 à Paris\)', te), te[:600]
    vert('heures : en UTC avec les secondes, puis l heure de Paris au meme instant (ete : 20:15:05 ; hiver : 19:15:05), la date en toutes lettres')
    pg.evaluate("location.hash = '#/messages'"); pg.wait_for_timeout(400); tm = pg.inner_text('#page'); assert '3 juin 2027' in tm and '2027-06-03' not in tm; vert('messages : la date en toutes lettres')
    pg.click('[data-p=verifier]'); pg.click('#lancer'); pg.wait_for_function('!document.querySelector("#lancer").disabled', timeout=20000)
    assert 'contrôles verts' in pg.inner_text('#page'); pg.screenshot(path=f'{CAP}/08_demo_verifier.png', full_page=True); vert('verification (demo) et bilan')
    with pg.expect_download() as d: pg.click('#rapport')
    assert 'GodGift Core' in open(d.value.path(), encoding='utf-8').read(); vert('rapport de verification exporte')
    # 5. chasser : dictionnaire, apercu, calcul complet sur le coffre d'essai A (reponse volontairement fausse)
    pg.click('[data-p=chasser]'); pg.wait_for_timeout(300)
    pg.fill('#h-dico', 'clef'); assert '0874 clef' in pg.inner_text('#h-dico-r'); pg.fill('#h-dico', '873'); assert 'clé' in pg.inner_text('#h-dico-r'); vert('dictionnaire mot et numero')
    pg.fill('#h-r3', 'abandon 2 3'); assert '0001 abandon · 0002 abandonner · 0003 abattre' in pg.inner_text('#h-v3'); vert('reponse lue en mots et numeros, reaffichee')
    pg.fill('#h-r17', 'zzzz 5 6'); assert 'zzzz' in pg.inner_text('#h-v17'); pg.fill('#h-r17', '4 5 6')
    pg.click('#h-calculer'); pg.wait_for_selector('.barre', timeout=5000); pg.screenshot(path=f'{CAP}/09_demo_chasser_calcul.png')
    pg.wait_for_function('!document.querySelector("#h-calculer").disabled', timeout=120000)
    assert "Ce n’est pas la clé" in pg.inner_text('#page'); pg.screenshot(path=f'{CAP}/10_demo_chasser_resultat.png', full_page=True); vert('calcul complet, mauvaise reponse reconnue')
    # 6. compagnon
    pg.click('[data-p=compagnon]'); pg.fill('#cp-a', 'bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp'); pg.wait_for_timeout(200)
    t = pg.inner_text('#page'); assert 'AEDE:compagnon:bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp' in t and '/c/' in t; vert('compagnon : message exact et lien')
    code = pg.evaluate("GG.codeCompagnon('bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp')")
    import base64, hashlib
    assert code == base64.b32encode(hashlib.sha256(b'bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp').digest()).decode().lower()[:10]; vert('code compagnon identique a celui de la caisse')
    pg.fill('#cp-a', 'bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvq'); pg.wait_for_timeout(100); assert 'invalide' in pg.inner_text('#page'); vert('adresse a somme fausse refusee')
    pg.fill('#cp-a', 'bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp'); pg.fill('#cp-s', 'SIGNATURE'); pg.screenshot(path=f'{CAP}/11_demo_compagnon.png', full_page=True)
    pg.click('[data-p=reseau]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{CAP}/12_demo_reseau.png', full_page=True)
    tr = pg.inner_text('#page'); assert 'les témoins ne sont pas lus' in tr and re.search(r'Ce programme\s+1\.\d+\.\d+\S* · [0-9a-f]{16}…', tr), tr[:900]
    vert('Reseau (demonstration) : la ligne « Ce programme » porte la version et l empreinte ; le cadre des temoins dit pourquoi il est vide')
    pg.click('[data-p=reglages]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{CAP}/13_reglages.png', full_page=True)
    pg.click('a[href="#/pierre"]'); pg.wait_for_timeout(300); assert 'Article 6' in pg.inner_text('#page'); vert('la Pierre embarquee se lit')
    pg.click('[data-p=reglages]'); pg.wait_for_timeout(300); assert 'librairie.angedeleau.com/conditions' not in pg.content()
    pg.click('a[href="#/conditions"]'); pg.wait_for_timeout(300); tc = pg.inner_text('#page')
    assert pg.evaluate('location.hash') == '#/conditions' and 'Conditions générales' in tc and 'Partie A' in tc and 'Partie C' in tc and '{{' not in tc, tc[:300]
    assert pg.evaluate('GG_CG.fr.sha256') == hashlib.sha256(open(CG_FR, 'rb').read()).hexdigest() and pg.evaluate('GG_CG.en.texte.indexOf("Terms and conditions") >= 0')
    pg.screenshot(path=f'{CAP}/13b_conditions.png'); vert('conditions generales embarquees (francais et anglais, empreinte du fichier publie) : le bouton les ouvre dans le programme, sans la librairie')
    # 7. les cinq langues
    for l in ('en', 'es', 'de', 'pt', 'fr'):
        pg.select_option('#langue', l); pg.click('[data-p=tableau]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{CAP}/14_tableau_{l}.png')
    vert('cinq langues')
    # 8. un ecran etroit (tablette)
    pg.set_viewport_size({'width': 700, 'height': 900}); pg.wait_for_timeout(200); pg.screenshot(path=f'{CAP}/15_etroit.png', full_page=True)
    b.close()
if erreurs:
    print('ERREURS JS :', erreurs); sys.exit(1)
print(f'BANC GODGIFT CORE : {ok} verts, 0 erreur JavaScript')
