# -*- coding: utf-8 -*-
"""LES REGLES COMMUNES, EN JAVASCRIPT ET EN PYTHON : app/gg_regles.js (GodGift Core) compare a la Cave (chasses.py), cas par cas.

Le Python de la Cave fait foi. Chaque cas est calcule des deux cotes et les verdicts doivent etre identiques :
l'heure de chaque element (enigme, cri, indices de rang 1 et 2 ; « solution » refusee), l'engagement sale (vecteur de la
specification, paragraphe 4), la ligne AEDE:solution (cas canoniques et faux), engagement_tenu, alea_tenu, la racine RFC 6962
(vecteur commun : feuilles SHA-256(« feuille 0 ».. « feuille 4 »)), la strophe tlock, la lecture d'un COFFRET (le bon, et chaque
faux de chasses._autotests_coffret : solution, type inconnu, doublon, element manquant, ronde fausse, strophe fausse...),
la date d'un message, et la retape d'une adresse (contre-verification V1 du 3 octobre : deux morceaux de 8 caracteres tires au
hasard hors du prefixe, comparee a stone5_v1g.morceaux_a_retaper et _retape_juste, qui font foi).
Rapide (aucun scrypt, aucun verrou reel) : python3 test_regles.py"""
import sys
sys.dont_write_bytecode = True                    # rien d'ecrit dans 03_CAVE_STONE_5 (pas de __pycache__)
import base64, calendar, datetime, hashlib, json, os, random, subprocess

ICI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(ICI, '..', 'app'))
sys.path.insert(0, os.path.abspath(os.path.join(ICI, '..', '..', '..', '03_CAVE_STONE_5')))
import chasses as H
import stone5_v1g as S5

OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)

RACINE_RFC6962 = 'bbcd69176e2e41fd8c3b5d16fc61c5e575e49b1c07dffa93f593f4988b2e0e73'   # specification, paragraphe 6
ENGAGEMENT_SPEC = '00ab0c3cac28096d7d4c286d3c0abbf8245e6efdece18ea188cc613ea1655bbd'  # specification, paragraphe 4


def py(f, *a, **k):
    """Le verdict de la Cave : ['ok', valeur] ou ['erreur', None] (ValueError)."""
    try:
        return ['ok', f(*a, **k)]
    except (ValueError, TypeError):            # TypeError : la chasse n° 1 sans son annee A
        return ['erreur', None]


def mth(feuilles):
    if not feuilles:
        return hashlib.sha256(b'').digest()
    if len(feuilles) == 1:
        return hashlib.sha256(b'\x00' + feuilles[0]).digest()
    k = 1
    while k * 2 < len(feuilles):
        k *= 2
    return hashlib.sha256(b'\x01' + mth(feuilles[:k]) + mth(feuilles[k:])).digest()


def main():
    rnd = random.Random(20261002)
    cas = {'heures': [], 'engagements': [], 'solutions': [], 'tenus': [], 'aleas': [], 'racines': [], 'strophes': [], 'coffrets': [], 'dates': [], 'morceaux': [], 'retapes': []}
    # ---- une chasse annoncee inscrite des deux cotes (une par mois, deux coffres)
    D2 = H.nouvelle_definition(2, 'Essai des regles', ['pierre', 'cathedrale'], [150, 400], 2027, 3, False)
    H.enregistrer(D2)
    try:
        # ---- 1. les heures
        for h, A, n in ((0, None, 3), (1, 2027, 24), (2, None, 2)):
            for c in range(0, n + 2):
                for typ, num, rang in [('enigme', 2 * c - 1, None), ('enigme', 2 * c, None), ('enigme', 2 * c + 1, None), ('cri', None, None), ('cri', None, 1),
                                       ('indice', None, 1), ('indice', None, 2), ('indice', None, 3), ('indice', None, None), ('indice', 1, 1), ('solution', None, None),
                                       ('enigme', 2 * c, 1), ('astuce', None, None)]:
                    cas['heures'].append({'args': [h, typ, c, num, A, rang], 'py': py(H.heure_prevue, h, typ, c, num, A, rang)})
        for args in ([1, 'cri', 1, None, None, None], [0, 'cri', 1.5, None, None, None], [5, 'cri', 1, None, None, None], [0, 'enigme', 1, '1', None, None], [0, 'indice', 1, None, None, True]):
            cas['heures'].append({'args': args, 'py': py(H.heure_prevue, *args) if not isinstance(args[2], float) else ['erreur', None]})
        assert H.heure_prevue(0, 'indice', 1, rang=1) == calendar.timegm((2026, 12, 17, 19, 15, 5))
        # ---- 2. l'engagement : le vecteur de la specification, puis des cas tires au hasard, et des formes refusees
        v = H.VECTEUR_ENGAGEMENT
        assert H.engagement(v['chasse'], v['coffre'], v['enigme_3'], v['enigme_17'], v['sel']) == ENGAGEMENT_SPEC
        cas['engagements'].append({'args': [v['chasse'], v['coffre'], v['enigme_3'], v['enigme_17'], v['sel']], 'py': ['ok', ENGAGEMENT_SPEC]})
        for i in range(40):
            h = rnd.choice([0, 1, 2, 7, 999]); m = rnd.choice([3, 4]); c = rnd.randint(1, {0: 3, 1: 24, 2: 2}.get(h, 48))
            args = [h, c, rnd.sample(range(1, 5001), m), rnd.sample(range(1, 5001), m), os.urandom(16).hex()]
            cas['engagements'].append({'args': args, 'py': py(H.engagement, *args)})
        for args in ([0, 4, [1, 2, 3], [4, 5, 6], v['sel']], [0, 1, [1, 2], [4, 5], v['sel']], [0, 1, [1, 2, 3], [4, 5, 6, 7], v['sel']], [0, 1, [1, 1, 3], [4, 5, 6], v['sel']],
                     [0, 1, [1, 2, 3], [4, 5, 6], v['sel'][:-1]], [0, 1, [1, 2, True], [4, 5, 6], v['sel']], [1000, 1, [1, 2, 3], [4, 5, 6], v['sel']], [1, 25, [1, 2, 3], [4, 5, 6], v['sel']],
                     [0, 1, [0, 2, 3], [4, 5, 6], v['sel']], [0, 1, [1, 2, 5001], [4, 5, 6], v['sel']], [3, 49, [1, 2, 3], [4, 5, 6], v['sel']], [0, 1, [1, 2, 3], [4, 5, 6], v['sel'].upper()]):
            cas['engagements'].append({'args': args, 'py': py(H.engagement, *args)})
        # ---- 3. la ligne AEDE:solution
        ligne = H.ligne_solution(0, 2, [3999, 402, 17], [88, 5, 1201], v['sel'])
        textes = ['Solution du coffre 2.\n' + ligne, ligne, ligne + '\n', ligne + ' ', ligne + '\nmerci', ligne.replace(':17,', ':017,'), ligne.replace('17,402', '402,17'),
                  ligne.replace(v['sel'], v['sel'].upper()), ligne.replace('5,88,1201', '5,88'), ligne.replace('5,88,1201', '5,5,1201'), ligne.replace(':2:', ':0:'),
                  ligne.replace('3999', '5001'), 'AEDE:solution:', 'rien', 'a\r\n' + ligne, ligne + '\r', H.ligne_solution(1, 24, [1, 2, 3, 4], [5, 6, 7, 8], v['sel']),
                  H.ligne_solution(2, 2, [10, 20, 30, 40], [1, 2, 3, 4], v['sel']), H.ligne_solution(5, 48, [1, 2, 3], [4, 5, 6], v['sel']), ligne.replace('AEDE:solution:0:2', 'AEDE:solution:0:4'),
                  ligne.replace('AEDE:solution:0', 'AEDE:solution:00'), 'Texte\n\n' + ligne]
        for t in textes:
            s = H.lire_solution(t)
            cas['solutions'].append({'texte': t, 'py': list(s) if s else None})
        # ---- 4. engagement_tenu et alea_tenu
        man = {'chasse': 0, 'coffres': [{'n': 2, 'engagement': v['engagement']}]}
        for t, m in (('x\n' + ligne, man), ('rien', man), ('x\n' + H.ligne_solution(0, 2, [17, 402, 3998], [5, 88, 1201], v['sel']), man), ('x\n' + ligne, dict(man, chasse=1)),
                     ('x\n' + ligne, {'chasse': 0, 'coffres': []}), ('x\n' + ligne, {'coffres': [{'n': 2, 'engagement': v['engagement']}]}), ('x\n' + ligne, None),
                     ('x\n' + ligne, {'chasse': 0, 'coffres': [{'n': 2, 'engagement': v['engagement']}, {'n': 2, 'engagement': v['engagement']}]}),
                     ('x\n' + ligne, {'chasse': 0, 'coffres': 'pas une liste'})):
            r = H.engagement_tenu(t, m)
            cas['tenus'].append({'texte': t, 'man': m, 'py': list(r) if r else None})
        al = '2b' * 32
        m_al = {'coffres': [{'n': 1, 'empreinte_alea': hashlib.sha256(bytes.fromhex(al)).hexdigest()}]}
        for m, c, a in ((m_al, 1, al), (m_al, 1, '2c' * 32), (m_al, 2, al), (m_al, 1, al.upper()), (None, 1, al), ({}, 1, al), (m_al, 1, al[:-2]), (m_al, 1, 42),
                        ({'coffres': [{'n': 1}]}, 1, al), ({'coffres': 'xyz'}, 1, al)):
            cas['aleas'].append({'man': m, 'coffre': c, 'alea': a, 'py': H.alea_tenu(m, c, a)})
        # ---- 5. la racine RFC 6962 : le vecteur commun, puis 0 a 33 feuilles
        e5 = [hashlib.sha256(('feuille %d' % i).encode()).hexdigest() for i in range(5)]
        assert mth([bytes.fromhex(x) for x in e5]).hex() == RACINE_RFC6962
        cas['racines'].append({'feuilles': e5, 'py': RACINE_RFC6962})
        for n in list(range(0, 18)) + [31, 32, 33]:
            f = [hashlib.sha256(b'ex %d %d' % (n, i)).hexdigest() for i in range(n)]
            cas['racines'].append({'feuilles': f, 'py': mth([bytes.fromhex(x) for x in f]).hex()})
        cas['racines'].append({'feuilles': e5 + [e5[-1]], 'py': mth([bytes.fromhex(x) for x in e5 + [e5[-1]]]).hex()})   # [a..e] et [a..e, e] : deux racines
        cas['racines'].append({'feuilles': ['zz' * 32], 'py': None})
        # ---- 6. la strophe tlock
        hc = 'ab' * 32
        def armure(tete):
            b = base64.b64encode(tete).decode()
            return '-----BEGIN AGE ENCRYPTED FILE-----\n' + '\n'.join(b[i:i + 64] for i in range(0, len(b), 64)) + '\n-----END AGE ENCRYPTED FILE-----\n'
        bons = H._armure_factice(34910514, hc)
        variantes = [bons, H._armure_factice(1, hc), H._armure_factice(34910514, hc, 2), bons.replace('BEGIN AGE', 'BEGIN AGF'), bons.replace('\n', '\r\n'), '', 42,
                     armure(b'age-encryption.org/v1\n-> tlock 0 ' + hc.encode() + b'\nQUJD\n--- AAAA\n'), armure(b'age-encryption.org/v1\n-> tlock 12 ' + hc.upper().encode() + b'\nQUJD\n--- AAAA\n'),
                     armure(b'age-encryption.org/v1\n-> X25519 abc\nQUJD\n--- AAAA\n'), armure(b'age-encryption.org/v2\n-> tlock 12 ' + hc.encode() + b'\nQUJD\n--- AAAA\n'),
                     armure(b'age-encryption.org/v1\n-> tlock 12 ' + hc.encode() + b' extra\nQUJD\n--- AAAA\n'), armure(b'age-encryption.org/v1\n-> tlock 12 ' + hc.encode() + b'\nQUJD\n'),
                     '-----BEGIN AGE ENCRYPTED FILE-----\nQUJD=\n-----END AGE ENCRYPTED FILE-----', '-----BEGIN AGE ENCRYPTED FILE-----\nQ!JD\n-----END AGE ENCRYPTED FILE-----']
        for a in variantes:
            r = py(H.strophe_tlock, a) if isinstance(a, str) else ['erreur', None]
            cas['strophes'].append({'arme': a, 'py': [r[0], list(r[1]) if r[1] else None]})
        # ---- 7. la lecture d'un COFFRET : le bon et chaque faux (memes variantes que chasses._autotests_coffret, et quelques autres)
        ch = {'hash': hc, 'public_key': 'cd' * 96, 'period': 3, 'genesis_time': 1692803367, 'schemeID': 'bls-unchained-g1-rfc9380'}
        def coffret(h, A, n_c):
            els = []
            for c in range(1, n_c + 1):
                for e in ({'type': 'enigme', 'coffre': c, 'numero': 2 * c - 1}, {'type': 'enigme', 'coffre': c, 'numero': 2 * c}, {'type': 'cri', 'coffre': c},
                          {'type': 'indice', 'coffre': c, 'rang': 1}, {'type': 'indice', 'coffre': c, 'rang': 2}):
                    r = H._ronde_a(ch, H.heure_element(h, e, A))
                    els.append(dict(e, ronde=r, ouverture_utc=H._instant_de(ch, r), verrou=H._armure_factice(r, ch['hash'])))
            return {'coffret': 'AEDE-V1', 'chasse': h, 'annee_A': H.annee(h, A), 'drand': ch, 'regle': 'texte libre', 'elements': els}
        base = []
        for h, A, n_c in ((0, None, 3), (1, 2027, 24), (2, None, 2)):
            cof = coffret(h, A, n_c); texte = json.dumps(cof, ensure_ascii=False, indent=1)
            man = {'chasse': h, 'annee_A': H.annee(h, A), 'coffret': {'sha256': hashlib.sha256(texte.encode()).hexdigest(), 'drand': ch['hash']}}
            if h == 1:
                man.pop('chasse')
            base.append((h, A, texte, man))
        h0, _, texte0, man0 = base[0]
        cof0 = json.loads(texte0); els = cof0['elements']
        i_ind = [k for k, e in enumerate(els) if e['type'] == 'indice' and e['rang'] == 1][0]
        def variante(f):
            x = json.loads(texte0); f(x); return json.dumps(x)
        faux = {
            'solution': variante(lambda x: x['elements'][i_ind].update(type='solution') or x['elements'][i_ind].pop('rang')),
            'solution en plus': variante(lambda x: x['elements'].append({'type': 'solution', 'coffre': 1, 'ouverture_utc': els[i_ind]['ouverture_utc'], 'ronde': els[i_ind]['ronde'], 'verrou': els[i_ind]['verrou']})),
            'inconnu': variante(lambda x: x['elements'][i_ind].update(type='astuce')),
            'doublon': variante(lambda x: x['elements'].append(x['elements'][0])),
            'doublon d indice': variante(lambda x: x['elements'][i_ind + 1].update(rang=1, ronde=x['elements'][i_ind]['ronde'], ouverture_utc=x['elements'][i_ind]['ouverture_utc'], verrou=x['elements'][i_ind]['verrou'])),
            'manque': variante(lambda x: x['elements'].pop()),
            'ronde annoncee': variante(lambda x: x['elements'][2].update(ronde=x['elements'][2]['ronde'] - 1, ouverture_utc=x['elements'][2]['ouverture_utc'] - 3)),
            'strophe': variante(lambda x: x['elements'][2].update(verrou=H._armure_factice(x['elements'][2]['ronde'] - 1, ch['hash']))),
            'deux strophes': variante(lambda x: x['elements'][2].update(verrou=H._armure_factice(x['elements'][2]['ronde'], ch['hash'], 2))),
            'autre chaine dans la strophe': variante(lambda x: x['elements'][2].update(verrou=H._armure_factice(x['elements'][2]['ronde'], 'ef' * 32))),
            'heure': variante(lambda x: x['elements'][2].update(ouverture_utc=x['elements'][2]['ouverture_utc'] + 3)),
            'indice au J+30 pour le rang 2': variante(lambda x: x['elements'][i_ind + 1].update(ronde=x['elements'][i_ind]['ronde'], ouverture_utc=x['elements'][i_ind]['ouverture_utc'], verrou=x['elements'][i_ind]['verrou'])),
            'champ en trop': variante(lambda x: x['elements'][0].update(texte_fr='en clair')),
            'indice sans rang': variante(lambda x: x['elements'][i_ind].pop('rang')),
            'cri avec rang': variante(lambda x: x['elements'][2].update(rang=1)),
            'coffre 4': variante(lambda x: x['elements'][0].update(coffre=4)),
            'autre drand': variante(lambda x: x['drand'].update(period=30)),
            'autre annee': variante(lambda x: x.update(annee_A=2027)),
            'chasse inconnue': variante(lambda x: x.update(chasse=9)),
            'pas un COFFRET': variante(lambda x: x.update(coffret='AEDE-V2')),
            'elements pas une liste': variante(lambda x: x.update(elements={})),
            'ronde en texte': variante(lambda x: x['elements'][2].update(ronde=str(x['elements'][2]['ronde']))),
            'cle JSON double': texte0.replace('"coffret": "AEDE-V1"', '"coffret": "AEDE-V1", "coffret": "AEDE-V1"', 1),
            'pas du JSON': '[' * 100000,
            'JSON tronque': texte0[:-10],
        }
        cas['coffrets'].append({'nom': 'bon (chasse zero, sans manifeste)', 'texte': texte0, 'man': None, 'A': None, 'py': py(lambda: len(H.controler_coffret(texte0, None, ch)['elements']))})
        for h, A, texte, man in base:
            cas['coffrets'].append({'nom': f'bon (chasse {h}, manifeste)', 'texte': texte, 'man': man, 'A': None, 'py': py(lambda: len(H.controler_coffret(texte, man, ch)['elements']))})
        cas['coffrets'].append({'nom': 'bon (chasse 1, annee donnee)', 'texte': base[1][2], 'man': None, 'A': 2027, 'py': py(lambda: len(H.controler_coffret(base[1][2], None, ch, 2027)['elements']))})
        for nom, t in faux.items():
            cas['coffrets'].append({'nom': nom, 'texte': t, 'man': None, 'A': None, 'py': py(lambda: len(H.controler_coffret(t, None, ch)['elements']))})
        for nom, m in (('manifeste : autre empreinte', dict(man0, coffret={'sha256': '00' * 32})), ('manifeste : autre chasse', dict(man0, chasse=1)),
                       ('manifeste : autre drand', dict(man0, coffret={'drand': 'ef' * 32})), ('manifeste : chasse 1 implicite', {k: x for k, x in man0.items() if k != 'chasse'})):
            cas['coffrets'].append({'nom': nom, 'texte': texte0, 'man': m, 'A': None, 'py': py(lambda: len(H.controler_coffret(texte0, m, ch)['elements']))})
        assert all(c['py'][0] == 'erreur' for c in cas['coffrets'] if not c['nom'].startswith('bon')), [c['nom'] for c in cas['coffrets'] if c['py'][0] != 'erreur' and not c['nom'].startswith('bon')]
        # ---- 8. la date d'un message
        for d in ('2027-01-03', '2027-02-29', '2028-02-29', '2027-02-31', '2027-13-01', '2027-00-10', '2027-1-03', ' 2027-01-03', '2027-01-03:x', '0000-01-01', '2100-02-29', '2000-02-29', '', None):
            try:
                ok = isinstance(d, str) and d == d.strip() and bool(__import__('re').fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', d)) and bool(datetime.date(*map(int, d.split('-'))))
            except ValueError:
                ok = False
            cas['dates'].append({'date': d, 'py': ok})
        # ---- 9. la retape d'une adresse (stone5_v1g : morceaux_a_retaper, _retape_juste)
        adrs = ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
                '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'bc1q0123456789abcdef', 'bc1q0123456789abcde']
        for adr in adrs:
            try:
                S5.morceaux_a_retaper(adr); refus = False
            except ValueError:
                refus = True
            # les paires permises, selon la Cave : celles dont la retape juste passe _retape_juste (p1 < p2)
            paires = [[x, y] for x in range(len(adr)) for y in range(x + 1, len(adr))
                      if S5._retape_juste(adr, {'positions': [x, y], 'texte': adr[x:x + 8] + adr[y:y + 8]})] if not refus else None
            tirs = [S5.morceaux_a_retaper(adr) for _ in range(200)] if not refus else []
            assert all(x in paires for x in tirs)
            cas['morceaux'].append({'adresse': adr, 'refus': refus, 'paires': paires})
            if refus:
                continue
            x, y = tirs[0]; bon = adr[x:x + 8] + adr[y:y + 8]
            fs = [{'positions': [x, y], 'texte': bon}, {'positions': [x, y], 'texte': bon.upper()}, {'positions': [x, y], 'texte': adr[x:x + 8] + ' ' + adr[y:y + 8]},
                  {'positions': [x, y], 'texte': adr[x:x + 4] + '\u00a0' + adr[x + 4:x + 8] + '\t' + adr[y:y + 8] + '\n'},
                  {'positions': [x, y], 'texte': bon[:-1] + ('y' if bon[-1] == 'x' else 'x')}, {'positions': [x, y], 'texte': bon[:15]}, {'positions': [x, y], 'texte': bon + 'q'},
                  {'positions': [y, x], 'texte': adr[y:y + 8] + adr[x:x + 8]}, {'positions': [y, x], 'texte': bon}, {'positions': [x, x + 4], 'texte': adr[x:x + 8] + adr[x + 4:x + 12]},
                  {'positions': [0, 20], 'texte': adr[0:8] + adr[20:28]}, {'positions': [3, 20], 'texte': adr[3:11] + adr[20:28]}, {'positions': [4, len(adr) - 7], 'texte': adr[4:12] + adr[-7:]},
                  {'positions': [x], 'texte': adr[x:x + 8]}, {'positions': [x, y, 4], 'texte': bon}, {'positions': [True, y], 'texte': bon}, {'positions': 'ab', 'texte': bon},
                  {'positions': [x, y]}, {'texte': adr[-16:]}, {'positions': [x, y], 'texte': 42}, None, 'abc', [x, y],
                  {'positions': [4, 12], 'texte': adr[4:20]}, {'positions': [len(adr) - 16, len(adr) - 8], 'texte': adr[-16:]}, {'positions': [x, y], 'texte': adr[x:x + 8] + '\u200b' + adr[y:y + 8]}]
            for f in fs:
                cas['retapes'].append({'adresse': adr, 'f': f, 'py': S5._retape_juste(adr, f)})
    finally:
        H.oublier_suivantes()

    # ---- le meme travail, en JavaScript
    prog = r'''
const fs = require('fs'), C = require('./gg_crypto.js'), R = require('./gg_regles.js');
const cas = JSON.parse(fs.readFileSync(0, 'utf8')), out = {};
function js(f) { try { return ['ok', f()]; } catch (e) { return ['erreur', null]; } }
R.enregistrer(cas.def2);
out.heures = cas.heures.map(c => js(() => R.heurePrevue.apply(null, c.args)));
out.engagements = cas.engagements.map(c => js(() => R.engagement.apply(null, c.args)));
out.solutions = cas.solutions.map(c => R.lireSolution(c.texte));
out.tenus = cas.tenus.map(c => R.engagementTenu(c.texte, c.man));
out.aleas = cas.aleas.map(c => R.aleaTenu(c.man, c.coffre, c.alea));
out.racines = cas.racines.map(c => R.racineRegistre(c.feuilles));
out.strophes = cas.strophes.map(c => { const r = js(() => R.stropheTlock(c.arme)); return [r[0], r[1] ? [r[1].ronde, r[1].hash] : null]; });
out.coffrets = cas.coffrets.map(c => js(() => R.controlerCoffret(c.texte, c.man, cas.chaine, c.A).elements.length));
out.codes = cas.coffrets.map(c => { try { R.controlerCoffret(c.texte, c.man, cas.chaine, c.A); return 'ok'; } catch (e) { return e.code || '?'; } });
out.dates = cas.dates.map(c => R.dateValide(c.date));
out.morceaux = cas.morceaux.map(c => {
  let paires = null, refus = false, tirs = [];
  try { paires = R.pairesRetape(c.adresse); for (let i = 0; i < 400; i++) tirs.push(R.morceauxARetaper(c.adresse)); } catch (e) { refus = true; paires = null; }
  return { refus: refus, paires: paires, tirs: tirs };
});
out.retapes = cas.retapes.map(c => R.retapeJuste(c.adresse, c.f));
out.exactes = cas.retapes.map(c => R.retapeJuste(c.adresse, c.f, true));
process.stdout.write(JSON.stringify(out));
'''
    entree = dict(cas, def2=D2, chaine=ch)
    r = subprocess.run(['node', '-e', prog], cwd=APP, input=json.dumps(entree), capture_output=True, text=True, timeout=600)
    assert r.returncode == 0, r.stderr[-2000:]
    js = json.loads(r.stdout)
    rouges = []
    for k in ('heures', 'engagements', 'solutions', 'tenus', 'aleas', 'racines', 'strophes', 'coffrets', 'dates'):
        for i, c in enumerate(cas[k]):
            if js[k][i] != c['py']:
                rouges.append((k, i, {x: (y if not isinstance(y, str) or len(y) < 200 else y[:200] + '...') for x, y in c.items()}, js[k][i]))
    for rg in rouges[:12]:
        print('  ROUGE :', rg)
    assert not rouges, f'{len(rouges)} ecart(s) entre gg_regles.js et la Cave'
    vert(f"heures du COFFRET (chasses 0, 1 et une chasse annoncee) : {len(cas['heures'])} cas identiques a chasses.heure_prevue (indice fort J+30, second indice J+182, « solution » refusee)")
    assert js['engagements'][0] == ['ok', ENGAGEMENT_SPEC]
    vert(f"engagement sale : le vecteur de la specification ({ENGAGEMENT_SPEC[:16]}...) et {len(cas['engagements']) - 1} autres cas (dont 12 refus), identiques")
    vert(f"ligne AEDE:solution : {len(cas['solutions'])} textes (canoniques et faux) lus pareil ; engagement_tenu ({len(cas['tenus'])} cas) et alea_tenu ({len(cas['aleas'])} cas) identiques")
    assert js['racines'][0] == RACINE_RFC6962 and js['racines'][-2] != js['racines'][6]
    vert(f"registre RFC 6962 : racine commune {RACINE_RFC6962[:16]}... retrouvee, {len(cas['racines'])} listes de 0 a 33 feuilles ; [a..e] et [a..e, e] donnent deux racines")
    vert(f"strophe tlock : {len(cas['strophes'])} verrous lus pareil (ronde et chaine, deux strophes, autre recipient, armure abimee)")
    codes = dict(zip([c['nom'] for c in cas['coffrets']], js['codes']))
    assert codes['solution'] == 'solution' and codes['solution en plus'] == 'solution' and codes['doublon'] == 'doublon' and codes['ronde annoncee'] == 'calendrier' and codes['strophe'] == 'strophe', codes
    vert(f"lecture d'un COFFRET : {sum(1 for c in cas['coffrets'] if c['py'][0] == 'ok')} bons acceptes (chasses 0, 1, 2 ; 15, 120, 10 elements) et {sum(1 for c in cas['coffrets'] if c['py'][0] == 'erreur')} faux refuses, comme la Cave : "
         + ', '.join(c['nom'] for c in cas['coffrets'] if c['py'][0] == 'erreur'))
    vert(f"date d'un message signe : {len(cas['dates'])} formes jugees comme stone5.lire_date (AAAA-MM-JJ d'un jour qui existe)")
    # la retape (contre-verification V1) : memes paires permises que la Cave, des tirages qui y restent et les couvrent, les memes verdicts
    for c, j in zip(cas['morceaux'], js['morceaux']):
        assert j['refus'] == c['refus'], (c['adresse'], j['refus'])
        if c['refus']:
            continue
        assert j['paires'] == c['paires'], c['adresse']
        assert all(x in c['paires'] for x in j['tirs']) and len({tuple(x) for x in j['tirs']}) > min(20, len(c['paires']) // 2), c['adresse']
        assert all(4 <= x and x + 8 <= y and y + 8 <= len(c['adresse']) for x, y in j['tirs'])
    ecarts = [(c['adresse'], c['f'], c['py'], v) for c, v in zip(cas['retapes'], js['retapes']) if v != c['py']]
    assert not ecarts, ecarts[:5]
    justes = sum(1 for c in cas['retapes'] if c['py'])
    # en base58 (« 1… », « 3… »), GodGift Core exige en plus la casse exacte : une retape en majuscules y est refusee
    for c, v in zip(cas['retapes'], js['exactes']):
        f = c['f']; adr = c['adresse']
        exacte = c['py'] and isinstance(f, dict) and ''.join(f['texte'].split()) == adr[f['positions'][0]:f['positions'][0] + 8] + adr[f['positions'][1]:f['positions'][1] + 8]
        assert v == exacte, (adr, f, v)
    b58 = [c for c, v in zip(cas['retapes'], js['exactes']) if c['adresse'][0] in '13' and c['py'] and not v]
    assert b58, 'aucune retape en majuscules refusee en base58'
    n_adr = sum(1 for c in cas['morceaux'] if not c['refus'])
    vert(f"retape d'une adresse : pour {n_adr} adresses (bc1q, tb1q, P2WSH, base58), les memes {sum(len(c['paires']) for c in cas['morceaux'] if not c['refus'])} paires permises "
         f"que stone5_v1g.morceaux_a_retaper (hors prefixe, sans chevauchement ; 276 pour une bc1q), {400 * n_adr} tirages de gg_regles.js tous permis ; "
         f"{len(cas['retapes'])} retapes jugees comme _retape_juste ({justes} justes : casse, blancs, ordre ; les fausses : un caractere, 15 ou 17, chevauchement, "
         f"prefixe, hors de l adresse, positions mal formees) ; une adresse trop courte refusee des deux cotes ; en base58, la casse exacte en plus ({len(b58)} refus)")
    print(f'\nLES REGLES COMMUNES (gg_regles.js = chasses.py) : {OK[0]} verts, 0 rouge')


if __name__ == '__main__':
    main()
