# -*- coding: utf-8 -*-
"""BANC GODGIFT CORE MASTERPIECE (atelier) : un monde factice complet, servi a GodGift Core par interception du reseau.
Une chaine drand d'essai (sa cle est connue ici), une librairie, un explorateur, des relais drand.
On verifie que GodGift Core ouvre lui-meme le COFFRET, fusionne les enigmes, lit l'alea du cri, verifie les messages
signes par la Cave (BIP-322, adresse ancree par l'amorce), recompte le registre d'un exemplaire et bascule sur le
serveur de secours pour vendre.
Les correctifs du 2 octobre 2026 : COFFRET complet a indices (une « solution », un doublon, une ronde fausse : refuses) ; solutions
publiees par message signe, verifiees contre l'engagement grave (« tenu » ou « FAUX », jamais rien de rempli ni d'envoye) ; alea
tape compare au manifeste ; registre RFC 6962 ; date des messages ; adresse de reception toujours signee, reverifiee a l'envoi,
alerte si elle a change ; offre de frais forte ; ancre epinglee : signature du manifeste exigee ; carte « Le roman ».
La seconde passe (contre-audit) : l'envoi automatique seulement dans la fenetre dediee (le jeton du lanceur) ; ailleurs, un faux jeton
ou aucun, rien ne part sans la retape de 16 caracteres de l'adresse (deux morceaux tires au hasard, masques a l'ecran ; contre-verification
du 3 octobre, V1 et V3), et la retape ne vaut que pour un envoi ; le jeton ne vit qu'en memoire (une fenetre rechargee n'est plus la fenetre
dediee et le dit) et rien ne se depose dans la fenetre hors des zones prevues (V2) ; « Sans installer »
n'envoie rien ; le nombre de l'installation renouvele a chaque enregistrement ; la page Compagnon part de « Mes livres » et lit le statut
publie par la caisse (actif depuis, exemplaire de reference) ; le serveur de secours de la vente n'est accepte que designe par un message
signe de l'auteur (AEDE:secours:https://...), jamais sur la seule annonce de la caisse ; sans lui, « Acheter » renvoie a angedeleau.com.
Le banc travaille sur une copie de app/ (tests/atelier.py) : le programme livre n'expose rien.   Lancement : python3 test_masterpiece.py"""
import sys
sys.dont_write_bytecode = True                    # avant tout import de la Cave : le banc n'ecrit rien dans 03_CAVE_STONE_5 (pas de __pycache__)
import asyncio, hashlib, json, os, re, time
ICI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ICI)
import atelier
CAVE = atelier.CAVE
sys.path.insert(0, CAVE)
import stone5_v1g as S, coffret_v1 as CV, verrou_a_date as V, chasses as HH
from py_ecc.optimized_bls12_381 import G2, multiply
from py_ecc.bls.hash_to_curve import hash_to_G1
from py_ecc.bls.point_compression import compress_G1
from embit import bip32
from playwright.async_api import async_playwright

SANS_ANCRE = {'chasse0': None, 'chasse1': None, 'adresse_auteur': None, 'secours': []}   # le monde simule a son propre auteur : l'ancre livree (adresse 3/0 reelle, depuis le 8 octobre) le refuserait
APP = atelier.copie_app(fenetre=True, ancre=SANS_ANCRE)   # la fenetre dediee : godgift.html?fenetre=<jeton>, l'empreinte du jeton dans gg_fenetre.js
APP_SANS = APP.split('?', 1)[0]                  # la meme copie, ouverte sans le jeton (navigateur principal, repli d'un lanceur)
JETON = APP.split('fenetre=', 1)[1]
async def relancer(pgx, url=None):
    """La fenetre dediee rouverte par son lanceur (le jeton dans l'adresse), a la meme page : son jeton ne vit qu'en memoire, un simple
    rechargement ne la refait pas (contre-verification V2)."""
    h = await pgx.evaluate('location.hash'); await pgx.wait_for_timeout(400)   # le stockage local s'ecrit en differe : on le laisse se poser
    await pgx.goto((url or APP) + h)
ADRP = 'bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp'   # l'adresse de propriete imprimee sur la page de titre de l'exemplaire d'essai
APP_ANCRE = None                                  # une copie dont l'ancre epingle l'adresse de l'auteur (faite plus bas, quand elle est connue)
OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)
def plat(s): return s.replace('\u2019', "'").replace('\xa0', ' ').replace('\u202f', ' ')   # la typographie francaise des textes affiches

# ------------------------------------------------------------------ le monde factice
SK = int.from_bytes(hashlib.sha256(b'AEDE banc godgift').digest(), 'big') % (2 ** 254)
PK = V._g2_octets(multiply(G2, SK)).hex()
import calendar
T1 = calendar.timegm((2027, 1, 3, 18, 15, 5, 0, 0, 0)); T2 = calendar.timegm((2027, 1, 17, 18, 15, 5, 0, 0, 0))   # le calendrier de la Pierre
FAUX = T2 + 3600 + 600; T0 = time.time()          # l horloge de l atelier : le 17 janvier 2027, dix minutes apres le cri du coffre 1
maint = FAUX
CH = dict(V.QUICKNET, public_key=PK, hash=hashlib.sha256(bytes.fromhex(PK)).hexdigest(), genesis_time=calendar.timegm((2026, 11, 3, 18, 15, 5, 0, 0, 0)) - 30000,
          groupHash='00' * 32, metadata={'beaconID': 'essai'})
sig = lambda r: compress_G1(multiply(hash_to_G1(V._identite(r), V.DST_G1, hashlib.sha256), SK)).to_bytes(48, 'big').hex()
ALEA = hashlib.sha256(b'alea du coffre 1').hexdigest()
ALEAS1 = {c: (ALEA if c == 1 else hashlib.sha256(b'alea du coffre %d' % c).hexdigest()) for c in range(1, 25)}
def cri_hex(texte): d = texte.encode(); return '0200000001' + ('00' * 40) + '6a4c' + bytes([len(d)]).hex() + d.hex() + '00000000'
CRI_HEX = cri_hex('AEDE:cri:1:' + ALEA)
def verrous(h, A, contenus):
    """Les elements d'un COFFRET, chacun a l'heure de la Pierre (chasses.heure_element) : [(element sans heure, corps)]."""
    out = []
    for e0, corps in contenus:
        r = V.ronde_a(CH, HH.heure_element(h, e0, A))
        out.append(dict(e0, ouverture_utc=V.instant_de(CH, r), ronde=r, verrou=V.verrouiller(corps, ronde=r, chaine=CH)))
    return out
def coffret(h, A, elements):
    return json.dumps({'coffret': 'AEDE-V1', 'chasse': h, 'annee_A': A, 'drand': {k: CH[k] for k in ('hash', 'public_key', 'period', 'genesis_time', 'schemeID')}, 'elements': elements}, indent=1)
TEXTES1 = {1: 'Premiere enigme, ouverte par GodGift Core lui-meme.', 2: 'Seconde enigme.'}
contenus = []
for c_ in range(1, 25):
    for num in (2 * c_ - 1, 2 * c_):
        contenus.append(({'type': 'enigme', 'coffre': c_, 'numero': num}, json.dumps({'numero': num, 'coffre': c_, 'texte_fr': TEXTES1.get(num, f'Enigme {num}.'), 'texte_en': 'First.' if num == 1 else ''})))
    contenus.append(({'type': 'cri', 'coffre': c_}, json.dumps({'coffre': c_, 'hex': cri_hex(f'AEDE:cri:{c_}:' + ALEAS1[c_]), 'txid': 'ab' * 32})))
    for rg in (1, 2):
        contenus.append(({'type': 'indice', 'coffre': c_, 'rang': rg}, json.dumps({'coffre': c_, 'rang': rg, 'texte_fr': f'Indice {rg} du coffre {c_}.', 'texte_en': ''})))
print('  (le monde : 120 verrous a date pour la chasse n° 1, 15 pour la chasse zero...)', flush=True)
elems = verrous(1, 2027, contenus)
COF = coffret(1, 2027, elems)
assert HH.controler_coffret(COF, None, CH, 2027)
# l'engagement sale du coffre 1, grave au semis ; sa solution sera publiee par un message signe
SOL3, SOL17, SEL = [1, 2500, 5000], [873, 874, 4410], '5a' * 16
ENG1 = HH.engagement(1, 1, SOL3, SOL17, SEL)

GRAINE = hashlib.sha256(b'FAUSSE graine godgift').digest()
ZPUB = bip32.HDKey.from_seed(GRAINE).derive("m/84h/0h/0h").to_public().to_base58(version=bytes.fromhex('04b24746'))
GUICHET = S.adresse_guichet(ZPUB, 0)
msg = CV.signer_message(GRAINE, ZPUB, '2027-01-03', 'Bonne chasse !\nLa premiere est parue.')
faux = dict(msg, texte=msg['texte'] + ' Envoyez-moi vos sats.')
ENTREE = 'cd' * 32
adrs = [S.adresse_guichet(ZPUB, 100 + i) for i in range(24)]
MAN = json.dumps({'pierre': 'V1g', 'annee_A': 2027, 'coffres': [dict({'n': i + 1, 'adresse': a, 'empreinte_alea': hashlib.sha256(bytes.fromhex(ALEAS1[i + 1])).hexdigest(), 'cri_txid': 'ab' * 32, 'cri_verrou': 0},
                                                                  **({'engagement': ENG1} if i == 0 else {})) for i, a in enumerate(adrs)],
                  'amorce': {'txid': 'ef' * 32, 'entree': ENTREE + ':0'}, 'coffret': {'sha256': hashlib.sha256(COF.encode()).hexdigest()},
                  'messages': {'adresse': GUICHET}}, indent=1)
GTX = '34' * 32
_g = ('AEDE:manifeste:' + hashlib.sha256(MAN.encode()).hexdigest()).encode()
GRAV = '6a4c' + bytes([len(_g)]).hex() + _g.hex()
E1, E2 = hashlib.sha256(b'ex1').hexdigest(), hashlib.sha256(b'ex2').hexdigest()
def mth(f):   # la racine de Merkle RFC 6962 (specification, paragraphe 6) : feuille 0x00, noeud 0x01, coupure a la plus grande puissance de 2
    if not f: return hashlib.sha256(b'').digest()
    if len(f) == 1: return hashlib.sha256(b'\x00' + f[0]).digest()
    k = 1
    while k * 2 < len(f): k *= 2
    return hashlib.sha256(b'\x01' + mth(f[:k]) + mth(f[k:])).digest()
def racine(f): return mth([bytes.fromhex(x) for x in f])
# la chasse zero : trois coffres de 100 euros en parallele, son manifeste, son COFFRET (novembre 2026), sa gravure ; le vecteur public de chasses.py
T30 = calendar.timegm((2026, 11, 3, 18, 15, 5, 0, 0, 0)); T170 = calendar.timegm((2026, 11, 17, 18, 15, 5, 0, 0, 0))
ALEA0 = '2b' * 32
ALEAS0 = {1: ALEA0, 2: hashlib.sha256(b'alea du coffre 2 de la chasse zero').hexdigest(), 3: hashlib.sha256(b'alea du coffre 3 de la chasse zero').hexdigest()}
R3, R17 = [1, 2500, 5000], [873, 874, 4410]                      # les mots du vecteur public, pour chacun des trois coffres
import cle_coffre_v1g as KC
ADR0 = 'bc1qdju6t5686hnfx38kzj8anmdtw56yt7eu9j2s0y'
ADRS0 = {1: ADR0, 2: KC.adresse_coffre(2, R3, R17, ALEAS0[2], chasse=0), 3: KC.adresse_coffre(3, R3, R17, ALEAS0[3], chasse=0)}   # deux implementations (A et B)
assert len(set(ADRS0.values())) == 3
CRIS0 = {c: '0200000001' + ('00' * 40) + '6a4c4f' + (f'AEDE:cri:H0:{c}:' + ALEAS0[c]).encode().hex() + '00000000' for c in (1, 2, 3)}
GALOP = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six']
contenus0 = []
for c_ in (1, 2, 3):                                              # en parallele : les enigmes 1, 3, 5 le 3 novembre, 2, 4, 6 le 17
    contenus0.append(({'type': 'enigme', 'coffre': c_, 'numero': 2 * c_ - 1}, json.dumps({'numero': 2 * c_ - 1, 'coffre': c_, 'texte_fr': f'Galop {GALOP[2 * c_ - 2]} : le premier pas du coffre {c_}.'})))
    contenus0.append(({'type': 'enigme', 'coffre': c_, 'numero': 2 * c_}, json.dumps({'numero': 2 * c_, 'coffre': c_, 'texte_fr': f'Galop {GALOP[2 * c_ - 1]} : le second pas du coffre {c_}.'})))
    contenus0.append(({'type': 'cri', 'coffre': c_}, json.dumps({'coffre': c_, 'hex': CRIS0[c_], 'txid': ('ac', 'ad', 'ae')[c_ - 1] * 32})))
    contenus0.append(({'type': 'indice', 'coffre': c_, 'rang': 1}, json.dumps({'coffre': c_, 'rang': 1, 'texte_fr': f'Indice fort du coffre {c_} : regardez le galop.'})))
    contenus0.append(({'type': 'indice', 'coffre': c_, 'rang': 2}, json.dumps({'coffre': c_, 'rang': 2, 'texte_fr': f'Second indice du coffre {c_}.'})))
el0 = verrous(0, None, contenus0)
COF0 = coffret(0, 2026, el0)
assert HH.controler_coffret(COF0, None, CH)
MAN0 = json.dumps({'pierre': 'V1g', 'chasse': 0, 'annee_A': 2026, 'coffres': [{'n': c_, 'type': 'pierre', 'adresse': ADRS0[c_], 'empreinte_alea': hashlib.sha256(bytes.fromhex(ALEAS0[c_])).hexdigest()} for c_ in (1, 2, 3)],
                   'amorce': {'txid': 'aa' * 32, 'vout_rendu': 6}, 'coffret': {'sha256': hashlib.sha256(COF0.encode()).hexdigest()}}, indent=1)
GTX0 = '56' * 32
_g0 = ('AEDE:manifeste:' + hashlib.sha256(MAN0.encode()).hexdigest()).encode()
GRAV0 = '6a4c' + bytes([len(_g0)]).hex() + _g0.hex()
VTX = '12' * 32
ETAT = {'programme': 'AEDE', 'empreinte_manifeste': hashlib.sha256(MAN.encode()).hexdigest(), 'coffres': [{'n': i + 1, 'adresse': a} for i, a in enumerate(adrs)],
        'enigmes': [], 'versements': [{'trimestre': '2027T1', 'txid': VTX}], 'secours': 'https://pirate.test',   # annonce par la caisse seule : jamais suivi
        'compteur': {'vendus': 3, 'certifies_sur_la_chaine': 2, 'en_attente_du_prochain_versement': 1, 'par_langue': {'fr': 3}},
        'chasses': {'0': {'nom': 'La chasse zéro', 'annee_A': 2026, 'coffres': [{'n': c_, 'adresse': ADRS0[c_]} for c_ in (1, 2, 3)], 'empreinte_manifeste': hashlib.sha256(MAN0.encode()).hexdigest()}}}
REG = {'nombre': 3, 'exemplaires': [{'exemplaire': 1, 'empreinte': E1, 'langue': 'fr', 'trimestre': '2027T1', 'lien': 'direct'}, {'exemplaire': 2, 'empreinte': E2, 'langue': 'fr', 'trimestre': '2027T1', 'lien': 'direct'},
                                    {'exemplaire': 3, 'empreinte': hashlib.sha256(b'ex3').hexdigest(), 'langue': 'en', 'trimestre': None, 'lien': 'direct'}]}
REQ = []                                          # les requetes vers la librairie (methode, adresse) : rien ne doit partir de GodGift Core vers elle
OPR = '6a35' + b'AEDE:registre:2027T1:'.hex() + racine([E1, E2]).hex()
CAISSE = 'https://librairie.test'
LIVRE = open(atelier.epub_maitre(), 'rb').read(); LIVRE_SHA = hashlib.sha256(LIVRE).hexdigest(); LTX = '9a' * 32
ETAT['livre_grave'] = {'fr': LIVRE_SHA}
_gl = ('AEDE:livre:fr:' + LIVRE_SHA).encode(); GRAVL = '6a4c' + bytes([len(_gl)]).hex() + _gl.hex()
SIGS = {'on': False}
SIG_MAN = {1: CV.signer_manifeste(GRAINE, ZPUB, hashlib.sha256(MAN.encode()).hexdigest()), 0: CV.signer_manifeste(GRAINE, ZPUB, hashlib.sha256(MAN0.encode()).hexdigest())}
def signe_brut(date, texte):
    """Un message signe par la cle des messages, sans les gardes de la Cave (le banc fabrique aussi des messages mal dates)."""
    k, adr = CV._cle_messages(GRAINE, ZPUB)
    return {'message': 'AEDE-v1', 'adresse': adr, 'date': date, 'texte': texte, 'signature': CV._signer_verifie(k, adr, CV.message_canonique(date, texte))}


# le serveur de secours de la vente, designe par un message signe de l'auteur (Pierre, article 10) ; et un faux (texte change apres signature)
SECOURS_MSG = signe_brut('2026-11-20', 'Le serveur de secours de la vente, si la librairie tombe.\nAEDE:secours:https://secours.test')
FAUX_SECOURS = dict(SECOURS_MSG, texte=SECOURS_MSG['texte'].replace('secours.test', 'pirate.test'))
PANNE = {'librairie': False}
BETA = {'diverge': False, 'posts': [], 'vus': {}, 'frais': 10, 'conflit': False, 'confirme': set(), 'messages_extra': [], 'compagnons': [], 'secours_msgs': [], 'utxo0': [{'txid': '77' * 32, 'vout': 0, 'value': 600000, 'status': {'confirmed': True}}]}
def repondre(u, methode='GET', corps=None):
    from urllib.parse import urlparse
    p = urlparse(u); h, ch = p.netloc, p.path
    if h == 'librairie.test': REQ.append((methode, u))
    if h == 'librairie.test' and (PANNE['librairie'] or (PANNE.get('registre') and ch == '/api/registre.json')): return 503, 'panne'
    if h == 'librairie.test':
        if ch == '/sante': return 503, 'panne'
        if ch in ('/api/chasse/1/manifeste_signature.json', '/api/chasse/0/manifeste_signature.json'):
            return (200, json.dumps(SIG_MAN[int(ch.split('/')[3])])) if SIGS['on'] else (404, '{}')
        return {'/api/etat.json': (200, json.dumps(ETAT)), '/api/manifeste.json': (200, MAN), '/api/coffret.json': (200, COF),
                '/api/messages.json': (200, json.dumps([msg, faux] + BETA['secours_msgs'] + BETA['messages_extra'])), '/api/registre.json': (200, json.dumps(REG)),
                '/api/registre/2027T1.json': (200, json.dumps({'ventes': [{'empreinte': E1}, {'empreinte': E2}]})),
                '/api/chasse/0/manifeste.json': (200, MAN0), '/api/chasse/0/coffret.json': (200, COF0),
                '/api/compagnons.json': (200, json.dumps({'compagnons': BETA['compagnons']}))}.get(ch, (404, '{}'))
    if h in ('pirate.test', 'angedeleau.com'):
        return (200, 'ok') if ch == '/sante' else (200, '<html>autre</html>')
    if h == 'secours.test':
        return (200, 'ok') if ch == '/sante' else (200, '<html>secours</html>')
    if h in ('explo.test', 'explo2.test'):
        if methode == 'POST' and ch == '/api/tx':
            BETA['posts'].append((h, corps))
            if BETA['conflit']: return 400, 'sendrawtransaction RPC error: {"code":-26,"message":"txn-mempool-conflict"}'
            from embit.transaction import Transaction as _T
            _tx = _T.parse(bytes.fromhex(corps)); BETA['vus'][_tx.txid().hex()] = [{'scriptpubkey': o.script_pubkey.data.hex(), 'value': o.value} for o in _tx.vout]
            return 200, _tx.txid().hex()
        if ch == '/api/v1/fees/recommended': return 200, json.dumps({'fastestFee': BETA['frais'], 'halfHourFee': 5})
        if ch == f'/api/address/{ADR0}/txs': return 200, json.dumps(BETA.get('txs0', []))
        if ch == '/api/fee-estimates': return 200, json.dumps({'1': 12, '2': 8})
        if ch == f'/api/address/{ADR0}/utxo': return 200, json.dumps(BETA['utxo0'])
        if ch == f'/api/address/{ADR0}/txs/mempool': return 200, json.dumps(BETA.get('mempool0', []))
        if ch.startswith('/api/tx/') and ch[8:] in BETA['confirme']: return 200, json.dumps({'txid': ch[8:], 'vout': BETA['vus'].get(ch[8:], []), 'status': {'confirmed': True, 'block_height': 899990, 'block_hash': 'bb' * 32}})
        if ch.startswith('/api/tx/') and ch[8:] in BETA['vus']: return 200, json.dumps({'txid': ch[8:], 'vout': BETA['vus'][ch[8:]], 'status': {'confirmed': False}})
        if h == 'explo2.test' and BETA['diverge'] and ch == f'/api/tx/{VTX}': return 200, json.dumps({'vout': [{'scriptpubkey': '6a00', 'value': 0}], 'status': {'confirmed': True, 'block_time': 1775000000}})
        if ch == '/api/blocks/tip/height': return 200, '900000'
        if ch == '/api/v1/prices': return 200, json.dumps({'EUR': 60000})
        if ch.startswith('/api/address/') and ch.endswith(('/utxo', '/txs/mempool', '/txs')): return 200, '[]'   # les autres coffres (chasse zero, 2 et 3) : vides
        if ch.startswith('/api/address/'): return 200, json.dumps({'chain_stats': {'funded_txo_sum': 1000, 'spent_txo_sum': 0, 'spent_txo_count': 0}, 'mempool_stats': {'funded_txo_sum': 0, 'spent_txo_sum': 0, 'spent_txo_count': 0}})
        if ch == f'/api/tx/{ENTREE}': return 200, json.dumps({'vout': [{'scriptpubkey_address': GUICHET, 'value': 500000}]})
        if ch == '/api/tx/' + 'ef' * 32 + '/outspend/48': return 200, json.dumps({'spent': True, 'txid': GTX})
        if ch == f'/api/tx/{GTX}': return 200, json.dumps({'vout': [{'scriptpubkey': GRAV, 'value': 0}], 'status': {'confirmed': True}})
        if ch == '/api/tx/' + 'aa' * 32 + '/outspend/6': return 200, json.dumps({'spent': True, 'txid': GTX0})   # le rendu de l amorce : sortie 6 (3 cris, 3 coffres, rendu)
        if ch == f'/api/tx/{GTX0}': return 200, json.dumps({'vout': [{'scriptpubkey': GRAV0, 'value': 0}], 'status': {'confirmed': True}})
        if ch == f'/api/tx/{VTX}': return 200, json.dumps({'vout': [{'scriptpubkey': OPR, 'value': 0}], 'status': {'confirmed': True, 'block_time': 1775000000}})
        if ch == f'/api/tx/{LTX}': return 200, json.dumps({'vout': [{'scriptpubkey': GRAVL, 'value': 0}], 'status': {'confirmed': True, 'block_time': 1796753704}})
        return 404, '{}'
    if h == 'drand.test':
        r = int(ch.rsplit('/', 1)[1])
        if V.instant_de(CH, r) > FAUX + (time.time() - T0): return 425, '{}'
        s = sig(r); return 200, json.dumps({'round': r, 'signature': s, 'randomness': hashlib.sha256(bytes.fromhex(s)).hexdigest()})
    return 404, ''


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, bypass_csp=True)   # le robot du banc a besoin d'eval ; un test a part tourne sous la vraie politique
        async def route(r):
            st, corps = repondre(r.request.url, r.request.method, r.request.post_data)
            await r.fulfill(status=st, body=corps, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'})
        await ctx.route(lambda u: not u.startswith('file:'), route)
        pg = await ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        await pg.add_init_script(f"window.GG_ATELIER_CHAINE = {json.dumps(CH)}; window.GG_ATELIER_RELAIS = ['https://drand.test']; (function(){{ var d0 = Date.now.bind(Date), dec = {FAUX} * 1000 - d0(); Date.now = function(){{ return d0() + dec; }}; }})();"
                                 f"localStorage.setItem('gg.installe','true'); localStorage.setItem('gg.caisse', JSON.stringify('{CAISSE}'));"
                                 "localStorage.setItem('gg.explo', JSON.stringify('https://explo.test/api')); localStorage.setItem('gg.explo2', JSON.stringify('https://explo2.test/api')); localStorage.setItem('gg.temoin','false'); localStorage.setItem('gg.lang','\"fr\"');")
        await pg.goto(APP)
        await pg.wait_for_function('window.GG && window.GG.MP.ouverts && Object.keys(window.GG.MP.ouverts).length >= 3', timeout=90000)
        o = await pg.evaluate('Object.keys(GG.MP.ouverts).sort()')
        assert o == ['cri:1:0', 'enigme:1:1', 'enigme:1:2'], o
        assert await pg.evaluate('GG.MP.grave') == 'ok'
        assert await pg.evaluate("GG.fenetre() && GG.modeEnvoi() === 'fenetre_oui' && location.search.indexOf('fenetre') < 0 && sessionStorage.getItem('gg.fenetre') === null")
        stockes = await pg.evaluate("JSON.stringify([Object.keys(sessionStorage).map(function (k) { return k + '=' + sessionStorage.getItem(k); }), Object.keys(localStorage).map(function (k) { return k + '=' + localStorage.getItem(k); }), history.length, location.href])")
        assert JETON not in stockes and await pg.evaluate("sessionStorage.getItem('gg.fenetre_ouverte') === '1' && !GG.fenetreRechargee()"), stockes[:300]
        vert('fenetre dediee : le jeton du lanceur correspond a l empreinte de gg_fenetre.js ; il quitte aussitot l adresse de la page et ne vit qu en memoire (ni stockage de session, ni stockage local : seul un drapeau sans secret)')
        vert('manifeste prouve grave, puis le COFFRET s ouvre tout seul : les enigmes 1 et 2 et le cri 1 (dus), pas les indices (a venir)')
        codes = await pg.evaluate("""(function () {
            function cp() { return JSON.parse(JSON.stringify(GG.MP.coffret)); }
            function code(c) { try { GGR.controlerCoffret(JSON.stringify(c, null, 1), null, GG.QUICKNET, 2027); return null; } catch (e) { return e.code; } }
            function el(c, ty, co, x) { return c.elements.filter(function (e) { return e.type === ty && e.coffre === co && (x == null || e.numero === x || e.rang === x); })[0]; }
            var r = [code(cp())];
            var a = cp(), i = el(a, 'indice', 1, 1); a.elements.push({type: 'solution', coffre: 1, ronde: i.ronde, ouverture_utc: i.ouverture_utc, verrou: i.verrou}); r.push(code(a));
            var b = cp(); b.elements.push(JSON.parse(JSON.stringify(el(b, 'indice', 1, 2)))); r.push(code(b));
            var d = cp(), e = el(d, 'indice', 2, 1); e.ronde -= 1000000; e.ouverture_utc -= 1000000 * GG.QUICKNET.period; r.push(code(d));
            var f = cp(), g = el(f, 'enigme', 1, 1), k = el(f, 'indice', 1, 1); g.verrou = k.verrou; r.push(code(f));
            var h = cp(); h.elements = h.elements.filter(function (x) { return !(x.type === 'indice' && x.coffre === 24 && x.rang === 2); }); r.push(code(h));
            var m = cp(); m.elements[0].type = 'astuce'; r.push(code(m));
            return r; })()""")
        assert codes == [None, 'solution', 'doublon', 'calendrier', 'strophe', 'incomplet', 'type'], codes
        vert('regle de lecture du COFFRET (la meme que la Cave) : un element « solution », un doublon, une heure avancee, une strophe tlock d une autre ronde, un element manquant, un type inconnu : refuses')
        await pg.evaluate("location.hash = '#/enigmes'"); await pg.wait_for_timeout(600)
        assert 'ouverte par GodGift Core lui-meme' in plat(await pg.inner_text('#page')); vert('l enigme ouverte par le COFFRET parait, alors que la librairie n en publie aucune')
        assert await pg.evaluate('GG.aleaDuCoffret(1)') == ALEA; vert('l alea du coffre est lu dans le cri ouvert par le COFFRET, avant la chaine')
        m = await pg.evaluate('GG.MP.messages.map(x => x.valide)'); assert m == [True, False], m
        assert await pg.evaluate('GG.MP.adresseAncree') == GUICHET; vert('messages : la signature BIP-322 de la Cave est valide, le message modifie est faux ; adresse ancree par le manifeste grave')
        assert await pg.evaluate(f"GG.bip322('{msg['adresse']}', 'AEDE:message:{msg['date']}:' + {json.dumps(msg['texte'])}, '{msg['signature']}')"); vert('BIP-322 en JavaScript = BIP-322 de la Cave')
        await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(500)
        await pg.evaluate(f"GG.verifierExemplaire('{E1}')"); await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e', timeout=20000)
        assert await pg.evaluate('GG.MP.ex.e') == 'ok'; vert('exemplaire 1 : retrouve au registre, racine recomptee = racine gravee dans le versement')
        await pg.evaluate(f"GG.verifierExemplaire('{REG['exemplaires'][2]['empreinte']}')"); await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e', timeout=20000)
        assert await pg.evaluate('GG.MP.ex.e') == 'att'; vert('exemplaire 3 : vendu, en attente du prochain versement')
        await pg.evaluate("GG.verifierExemplaire('" + 'ff' * 32 + "')"); await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e', timeout=20000)
        assert await pg.evaluate('GG.MP.ex.e') == 'ko'; vert('empreinte inconnue : pas un exemplaire officiel')
        # ---- le serveur de secours de la vente (Pierre, article 10) : designe par un message signe de l'auteur, jamais par la caisse seule
        assert await pg.evaluate("GG.secoursValides().length === 0 && GG.basesLibrairie().length === 1") and await pg.evaluate('GG.M.etat.secours') == 'https://pirate.test'
        BETA['secours_msgs'] = [SECOURS_MSG, FAUX_SECOURS]
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 4", timeout=60000)
        assert await pg.evaluate("GG.secoursValides()") == ['https://secours.test'] and len(await pg.evaluate("JSON.parse(localStorage.getItem('gg.secours_signes'))")) == 1
        assert await pg.evaluate('GG.adresseAchat()') == 'https://secours.test'           # la librairie ne repond pas (/sante en panne) : le secours designe
        await pg.evaluate("location.hash = '#/reglages'"); await pg.wait_for_timeout(300)
        tr = plat(await pg.inner_text('#r-secours')); assert 'https://secours.test' in tr and 'pirate' not in tr, tr
        BETA['secours_msgs'] = []                                                        # la librairie ne publie plus la designation : elle est gardee, et revérifiee
        g = await pg.evaluate("JSON.parse(localStorage.getItem('gg.secours_signes'))"); g.append(dict(FAUX_SECOURS)); g.append(dict(SECOURS_MSG, adresse='bc1q' + 'q' * 38))
        await pg.evaluate("(g) => localStorage.setItem('gg.secours_signes', JSON.stringify(g))", g)
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages", timeout=60000)
        assert await pg.evaluate("GG.secoursValides()") == ['https://secours.test'] and await pg.evaluate('GG.adresseAchat()') == 'https://secours.test'
        vert('serveur de secours de la vente : seul celui que designe un message signe de l auteur (derniere ligne AEDE:secours:https://...) est suivi ; l adresse annoncee par la caisse seule, un message falsifie, une designation glissee dans le stockage : ignores ; la designation est gardee pour le jour ou la librairie tombe')
        await pg.evaluate("localStorage.removeItem('gg.secours_signes')"); await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages", timeout=60000)
        assert await pg.evaluate("GG.secoursValides().length === 0") and await pg.evaluate('GG.adresseAchat()') is None
        await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(400)
        async with pg.expect_popup() as pi: await pg.click('#acheter')
        pop = await pi.value
        for _ in range(50):
            if pop.url.startswith('https://angedeleau.com/'): break
            await pg.wait_for_timeout(200)
        assert pop.url.startswith('https://angedeleau.com/'), pop.url
        await pg.wait_for_selector('#achat-indispo', timeout=10000); assert 'momentanément indisponible' in plat(await pg.inner_text('#achat-indispo'))
        await pop.close()
        vert('sans librairie ni secours designe : « Acheter » ouvre angedeleau.com et dit que la vente est momentanement indisponible ; la chasse continue')
        await pg.evaluate("location.hash = '#/verifier'"); await pg.wait_for_timeout(300); await pg.click('#lancer')
        await pg.wait_for_function('!GG.V.enCours && GG.V.res && GG.V.res.length >= 13', timeout=60000)
        res = await pg.evaluate('GG.V.res.map(r => [r.t, r.e])'); d = {plat(k): v for k, v in res}
        assert d['Le COFFRET'] == 'ok' and d['Les messages de l\'auteur'] == 'ko' and d['Le registre des exemplaires'] == 'ok', res
        vert('verifier : COFFRET conforme au manifeste, registre recompte juste, et le message falsifie est signale')
        # la chasse zero : trois coffres en parallele
        await pg.evaluate("location.hash = '#/chasse/0'")
        await pg.wait_for_function("GG.CZ.coffret && Object.keys(GG.CZ.ouverts).length >= 12", timeout=90000)
        assert await pg.evaluate('GG.CZ.grave') == 'ok' and await pg.evaluate('[GG.aleaZ(), GG.aleaZ(1), GG.aleaZ(2), GG.aleaZ(3)]') == [ALEA0, ALEA0, ALEAS0[2], ALEAS0[3]]
        await pg.wait_for_timeout(400); txt = plat(await pg.inner_text('#page'))
        assert all(f'Galop {g}' in txt for g in GALOP) and 'La chasse zéro' in txt and 'Trois coffres de 100 €' in txt and all(a in txt for a in ADRS0.values()), txt[:800]
        assert await pg.evaluate("GG.CHASSES[0].coffres === 3 && GG.CHASSES[0].parallele === true && GG.CHASSES[0].euros.join() === '100,100,100'")
        hz = await pg.evaluate("[1, 2, 3].map(function (n) { return [GG.heureZ(n, 3), GG.heureZ(n, 17)]; })"); assert hz == [[T30, T170]] * 3, hz
        vert('chasse zero : trois coffres de 100 euros en parallele (enigmes 1, 3, 5 le 3 novembre, 2, 4, 6 le 17) ; manifeste prouve grave (sortie 6 de son amorce), son COFFRET s ouvre seul, alea H0 de chaque coffre lu dans son cri')
        t0 = await pg.evaluate("""(function(){ function cp() { return JSON.parse(JSON.stringify(GG.CZ.coffret)); }
            function el(c, ty, num) { return c.elements.filter(function (e) { return e.type === ty && e.coffre === (num ? Math.ceil(num / 2) : e.coffre) && (num == null || e.numero === num); })[0]; }
            function refus(c) { var tx = JSON.stringify(c, null, 1), man = JSON.parse(JSON.stringify(GG.CZ.man)); man.coffret = { sha256: GGC.sha256hex(tx) }; return GG.refusCoffret(tx, { man: man }); }
            var a = cp(); el(a, 'enigme', 2).ronde = el(a, 'enigme', 1).ronde; el(a, 'enigme', 2).ouverture_utc = el(a, 'enigme', 1).ouverture_utc;
            var b = cp(), e3 = el(b, 'enigme', 3), r = e3.ronde + Math.round(30 * 86400 / GG.CZ.coffret.drand.period); e3.ronde = r; e3.ouverture_utc = e3.ouverture_utc + 30 * 86400;
            var d = cp(); el(d, 'enigme', 5).coffre = 2;
            var s = cp(); s.elements.push({type: 'solution', coffre: 1, ronde: s.elements[0].ronde, ouverture_utc: s.elements[0].ouverture_utc, verrou: s.elements[0].verrou});
            return [refus(cp()), refus(a), refus(b), refus(d), refus(s), GG.refusCoffret(JSON.stringify(cp()), GG.CZ)]; })()""")
        assert t0 == [None, 'calendrier', 'calendrier', 'calendrier', 'solution', 'empreinte'], t0
        vert('chasse zero : une heure fausse est refusee (seconde enigme avancee, coffre 2 a l ancien calendrier de decembre, enigme d un autre coffre), une « solution » aussi, et un COFFRET qui n est pas celui du manifeste grave')
        await pg.select_option('#z-coffre', '2'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("GG.CZ.coffre") == 2 and await pg.input_value('#z-alea') == ALEAS0[2]
        await pg.fill('#z-r3', '1 2500 5000'); await pg.fill('#z-r17', '873 874 4410'); await pg.fill('#z-alea', ALEAS0[3]); await pg.click('#z-calculer'); await pg.wait_for_timeout(400)
        assert 'pas celui que le manifeste gravé engage' in (plat(await pg.inner_text('#page'))).replace('\xa0', ' ') and not await pg.evaluate('GG.CZ.calcul')
        await pg.fill('#z-alea', ALEAS0[2])
        vert('alea tape a la main : compare a l empreinte gravee au manifeste ; un autre alea (celui d un autre coffre) est refuse, rien n est calcule')
        await pg.fill('#z-r3', '1 2500 5000'); await pg.fill('#z-r17', '873 874 4410'); await pg.click('#z-calculer')
        await pg.wait_for_function("GG.CZ.res && !GG.CZ.calcul", timeout=180000)
        assert 'trouv' in (await pg.evaluate('GG.CZ.res')).lower() and await pg.evaluate(f"!!GG.TR.cles['2:{ADRS0[2]}']")
        await pg.evaluate(f"(function(){{ var k = '2:{ADRS0[2]}'; ['cles', 'cibles', 'dest', 'msg', 'compte', 'confirmer', 'prep'].forEach(function (x) {{ delete GG.TR[x][k]; }}); }})()")   # le banc ne vide que le coffre 1
        await pg.select_option('#z-coffre', '1'); await pg.wait_for_timeout(200)
        assert await pg.input_value('#z-alea') == ALEA0
        await pg.fill('#z-r3', '1 2500 5000'); await pg.fill('#z-r17', '873 874 4410'); await pg.click('#z-calculer')
        await pg.wait_for_function("GG.CZ.res && !GG.CZ.calcul", timeout=180000)
        assert 'trouv' in (await pg.evaluate('GG.CZ.res')).lower(); vert('chasse zero : la bonne reponse redonne la cle du coffre choisi (2, puis 1) : numero de chasse et de coffre dans la chaine et le sel')
        await pg.evaluate("location.hash = '#/chasses'"); await pg.wait_for_timeout(300)
        _t = plat(await pg.inner_text('#page'))
        assert 'trois coffres de 100 €, six énigmes, les 3 et 17 novembre 2026' in _t and "Une chasse n'existe que par son annonce signée et gravée" in _t and "L'Ange de l'Eau" in _t, _t[:900]
        tz = await pg.evaluate("['fr', 'en', 'es', 'de', 'pt'].map(function (l) { var x = GG_I18N[l]; return [x.cz_intro, x.cz_carte, x.cz_avant].join(' '); })")
        gz = await pg.evaluate("['fr', 'en', 'es', 'de', 'pt'].map(function (l) { return GG_GUIDE[l].mots.filter(function (m) { return m.id === 'chasse_zero'; })[0].texte; })")
        assert all('500' not in x and '100' in x for x in tz + gz), (tz, gz)
        vert('chasse zero dans les cinq langues (textes et guide) : trois coffres de 100 euros en parallele, plus de coffre de 500 euros ; la page « Les chasses » le dit')
        PANNE['librairie'] = True
        await relancer(pg); await pg.evaluate("location.hash = '#/chasse/0'")
        await pg.wait_for_function("GG.M.pret && GG.CZ.coffret", timeout=60000); await pg.wait_for_timeout(500)
        assert 'Galop deux' in plat(await pg.inner_text('#page')) and 'Galop six' in plat(await pg.inner_text('#page')) and await pg.evaluate('GG.CZ.grave') == 'ok'
        vert('chasse zero, librairie en panne : GodGift Core garde son manifeste et son COFFRET, tout reste lisible')
        PANNE['librairie'] = False
        # le depot d'un fichier : EPUB et PDF officiels, et les fichiers qui voudraient faire tomber le programme
        import tempfile, zipfile, io
        from reportlab.pdfgen import canvas as rl_canvas
        tmp = tempfile.mkdtemp()
        ep = os.path.join(tmp, 'exemplaire.epub'); maitre = atelier.epub_maitre()
        with zipfile.ZipFile(maitre) as zi, zipfile.ZipFile(ep, 'w') as zo:
            for it in zi.infolist():
                d = zi.read(it.filename)
                if it.filename == 'OEBPS/titre.xhtml': d = d.decode().replace('</body>', f'<p>Empreinte {E1}</p><p>Adresse de propriété : {ADRP}</p></body>').encode()
                zo.writestr(it, d, compress_type=zipfile.ZIP_STORED if it.filename == 'mimetype' else zipfile.ZIP_DEFLATED)
        pdf = os.path.join(tmp, 'exemplaire.pdf'); c = rl_canvas.Canvas(pdf, pageCompression=1)
        c.drawString(40, 700, 'Couverture'); c.showPage(); c.drawString(40, 700, 'Empreinte ' + E1); c.showPage(); c.save()
        assert E1.encode() not in open(pdf, 'rb').read()   # l'empreinte n'est lisible qu'apres decompression
        bombe = os.path.join(tmp, 'bombe.epub')
        with zipfile.ZipFile(bombe, 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('mimetype', 'application/epub+zip'); z.writestr('OEBPS/titre.xhtml', b'\0' * (400 * 1024 * 1024))
        lourd = os.path.join(tmp, 'lourd.epub')
        with open(lourd, 'wb') as f: f.truncate(61 * 1024 * 1024)
        autre = os.path.join(tmp, 'photo.jpg'); open(autre, 'wb').write(b'\xff\xd8\xff' + b'x' * 100)
        faux = os.path.join(tmp, 'faux.epub'); open(faux, 'wb').write(b'<html>pas un zip</html>')
        await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(500)
        async def deposer(chemin):
            await pg.evaluate('GG.MP.ex = null'); await pg.set_input_files('#ex-fichier', chemin)
            await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e && !GG.MP.exEnCours', timeout=60000)
            return await pg.evaluate('[GG.MP.ex.e, GG.MP.ex.d]')
        r = await deposer(ep); assert r[0] in ('ok', 'att') and 'n° 1 ' in plat(r[1]), r; vert('EPUB officiel depose : empreinte lue sur la page de titre, exemplaire n° 1 retrouve au registre')
        r = await deposer(pdf); assert r[0] in ('ok', 'att') and 'n° 1 ' in plat(r[1]), r; vert('PDF officiel depose : empreinte lue dans la page compressee, exemplaire n° 1 retrouve')
        t0 = time.time(); r = await deposer(bombe); assert r[0] == 'att' and time.time() - t0 < 30, r
        vert(f'EPUB piege (400 Mo a la decompression) : lecture arretee a 8 Mo, aucun blocage ({time.time() - t0:.1f} s)')
        r = await deposer(lourd); assert r[0] == 'ko' and '60 Mo' in plat(r[1]), r; vert('fichier de 61 Mo : refuse avant toute lecture')
        r = await deposer(autre); assert r[0] == 'ko' and 'ni un EPUB' in plat(r[1]), r
        r = await deposer(faux); assert r[0] == 'ko' and 'ni un EPUB' in plat(r[1]), r; vert('autre type, ou faux EPUB : refuse proprement')
        # ---- V2 : rien ne se depose dans la fenetre hors des zones prevues ; dans une zone, le seul type attendu, lu par FileReader, et la
        # page ne change jamais. Les gestes sont ceux d'un vrai glisser-deposer du systeme (Input.dispatchDragEvent, avec le fichier lui-meme).
        piege = os.path.join(tmp, 'piege.html'); open(piege, 'w').write('<script>window.top.vole = 1; document.title = "PIEGE";</script>')
        ev = await pg.evaluate("""() => {
            function dt(nom, type) { var d = new DataTransfer(); d.items.add(new File(['<p>x</p>'], nom, { type: type })); return d; }
            function lancer(c, typ, d) { var e = new DragEvent(typ, { dataTransfer: d, bubbles: true, cancelable: true }); c.dispatchEvent(e); return [e.defaultPrevented, d.dropEffect]; }
            var b = document.querySelector('#page h1') || document.body, z = document.getElementById('ex-depot');
            return { hors: [lancer(document.body, 'dragenter', dt('piege.html', 'text/html')), lancer(b, 'dragover', dt('piege.html', 'text/html')), lancer(b, 'drop', dt('piege.html', 'text/html'))],
                     zone: lancer(z, 'dragover', dt('piege.html', 'text/html')) };
        }""")
        assert all(x[0] for x in ev['hors']) and ev['zone'][0], ev                              # l'action du navigateur est empechee partout
        cdp = await ctx.new_cdp_session(pg)
        await pg.evaluate("""() => { window.vus = []; window.addEventListener('dragover', function (e) {
            var z = e.target.closest && e.target.closest('.depot[id]'); window.vus.push([z ? z.id : 'hors', e.dataTransfer.dropEffect, e.defaultPrevented]); }, true); }""")
        async def glisser(fichier, sel):
            await pg.locator(sel).first.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
            bx = await pg.locator(sel).first.bounding_box(); x, y = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
            for typ in ('dragEnter', 'dragOver', 'drop'):
                await cdp.send('Input.dispatchDragEvent', {'type': typ, 'x': x, 'y': y, 'data': {'items': [], 'files': [fichier], 'dragOperationsMask': 1}})
        url0 = pg.url; await pg.evaluate('GG.MP.ex = null')
        await glisser(piege, '#page h1'); await pg.wait_for_timeout(800)
        assert pg.url == url0 and await pg.evaluate("GG.fenetre() && !window.vole && document.title !== 'PIEGE' && GG.MP.ex === null")
        vus = await pg.evaluate('window.vus'); assert vus and all(v == ['hors', 'none', True] for v in vus), vus      # hors des zones : refuse (effet « none »)
        await glisser(piege, '#ex-depot'); await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e', timeout=20000)
        r = await pg.evaluate('[GG.MP.ex.e, GG.MP.ex.d]'); assert r[0] == 'ko' and 'ni un EPUB' in plat(r[1]) and pg.url == url0 and await pg.evaluate('!window.vole'), r
        vus = await pg.evaluate('window.vus'); assert ['ex-depot', 'copy', True] in vus, vus                          # dans la zone : accepte, puis trie par type
        await pg.evaluate('GG.MP.ex = null'); await glisser(ep, '#ex-depot')
        await pg.wait_for_function('GG.MP.ex && GG.MP.ex.e && !GG.MP.exEnCours', timeout=60000)
        r = await pg.evaluate('[GG.MP.ex.e, GG.MP.ex.d]'); assert r[0] in ('ok', 'att') and 'n° 1 ' in plat(r[1]) and pg.url == url0, r
        assert await pg.evaluate("GG.fichierAttendu('ex-depot', new File(['x'], 'a.epub', { type: 'text/html' })) === false && GG.fichierAttendu('ex-depot', new File(['x'], 'a.PDF', { type: 'application/pdf' }))")
        vert('V2 : un fichier HTML glisse hors des zones prevues ne fait rien (le navigateur ne l ouvre pas : dragover refuse partout, effet « none ») ; glisse dans la zone d un exemplaire, il est refuse ; l EPUB de l exemplaire y est lu par FileReader et reconnu ; la page ne change jamais')
        # ---- un exemplaire, un compagnon (specification, paragraphe 11) : la page Compagnon part de « Mes livres », avec l'adresse de propriete
        r = await deposer(ep); await pg.click('#ex-garder'); await pg.wait_for_timeout(200)
        il = await pg.evaluate("GG.MP.livres.length - 1"); assert await pg.evaluate(f"GG.MP.livres[{il}].propriete") == ADRP
        BETA['compagnons'] = [{'adresse': ADRP, 'fin': ADRP[-8:], 'code': 'x', 'nom': '', 'depuis': '2026-10-02', 'suspendu': False}]
        await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(300)
        await pg.click(f'[data-compagnon="{il}"]'); await pg.wait_for_function("location.hash === '#/compagnon' && GG.CP.statut", timeout=20000)
        txt = plat(await pg.inner_text('#page'))
        assert await pg.evaluate("document.getElementById('cp-a').value") == ADRP and await pg.evaluate("GG.CP.statut") == 'en_attente' and 'AEDE:compagnon:' + ADRP in txt and 'en attente' in txt, txt[:800]
        async def relire_cp(attendu):
            await pg.evaluate("GG.CP.statutLu = null; GG.CP.statut = null; location.hash = '#/tableau'"); await pg.wait_for_timeout(200)
            await pg.evaluate("location.hash = '#/compagnon'"); await pg.wait_for_function(f"GG.CP.statut === '{attendu}'", timeout=20000); await pg.wait_for_timeout(200)
            return plat(await pg.inner_text('#cp-statut'))
        BETA['compagnons'][0].update(statut='actif', actif_depuis='2026-12-04', actif_utc=1796428800, exemplaire=1, empreinte_exemplaire=E1)
        ts = await relire_cp('actif'); txt = plat(await pg.inner_text('#page'))
        assert 'actif depuis le 4 décembre 2026 · exemplaire de référence n° 1.' in ts and E1[:16] in ts and "n'est pas celui que vous avez choisi" not in txt, ts
        await pg.click('[data-ex-verif]'); await pg.wait_for_function("location.hash === '#/livres' && GG.MP.ex && GG.MP.ex.e && GG.MP.ex.emp === '" + E1 + "'", timeout=20000)
        BETA['compagnons'][0].update(empreinte_exemplaire='ab' * 32)
        await relire_cp('actif'); assert "L'exemplaire de référence publié par la librairie n'est pas celui que vous avez choisi ici." in plat(await pg.inner_text('#page'))
        BETA['compagnons'][0].update(actif_depuis='hier', exemplaire='1', empreinte_exemplaire='zz')       # des champs mal formes : rien n'en est affiche
        ts = await relire_cp('actif'); assert ts.strip() == 'Statut publié par la librairie : actif.', ts
        for k in ('actif_depuis', 'actif_utc', 'exemplaire', 'empreinte_exemplaire', 'statut'): BETA['compagnons'][0].pop(k)
        ts = await relire_cp('en_attente'); assert 'en attente' in ts, ts                                    # statut absent : en attente
        BETA['compagnons'][0].update(statut='actif', actif_depuis='2026-12-04', exemplaire=1, empreinte_exemplaire=E1)
        await relire_cp('actif')
        vert('page Compagnon et statut publie par la caisse : « actif depuis le ... », exemplaire de reference et son empreinte (verifiable dans le registre d un clic), un exemplaire de reference autre que celui choisi est signale ; champs absents ou mal formes : rien d invente (statut absent = en attente)')
        await pg.fill('#cp-a', ADR0); await pg.wait_for_timeout(300)
        assert "n'est pas l'adresse de propriété de l'exemplaire choisi" in plat(await pg.inner_text('#page'))
        BETA['compagnons'] = []
        vert('un exemplaire, un compagnon : « Mes livres » mene a la page Compagnon avec l adresse de propriete lue sur la page de titre ; le statut publie par la caisse (en attente, puis actif) s affiche ; une autre adresse est signalee')
        # ---- N6 (contre-verification de la caisse) : le prix est celui que la caisse publie (etat.livre.prix_sats), jamais un nombre ecrit
        # dans le programme ; sans prix lu (librairie muette, champ absent ou illisible), une phrase sans nombre
        async def relire_etat(cond):
            await pg.click('#rafraichir'); await pg.wait_for_function(f"GG.M.pret && ({cond})", timeout=60000); await pg.wait_for_timeout(300)
        async def textes_prix():
            await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(300); a_ = plat(await pg.inner_text('#achat-prix'))
            await pg.evaluate("location.hash = '#/compagnon'"); await pg.wait_for_timeout(300); c_ = plat(await pg.inner_text('#page'))
            return a_, c_
        assert 'livre' not in ETAT and await pg.evaluate("GG.prixLivre() === null")
        a_, c_ = await textes_prix()
        assert a_.startswith('Le prix en vigueur s’affiche ici dès que la librairie répond'.replace('’', "'")) and not re.search(r'\d', a_), a_
        assert 'celui que publie la librairie' in c_ and '40 %' in c_ and '8 400' not in c_ and '21 000' not in c_, c_[:600]
        ETAT['livre'] = {'paru': {'fr': True, 'en': False}, 'prix_sats': 18000}
        await relire_etat("GG.M.etat && GG.M.etat.livre && GG.M.etat.livre.prix_sats === 18000")
        a_, c_ = await textes_prix()
        assert a_.startswith('18 000 sats.') and '18 000 sats' in c_ and '40 % · 7 200 sats' in c_ and '20 % · 3 600 sats' in c_ and '21 000' not in c_, (a_, c_[:600])
        for faux_ in ('18000', -5, 0, 1.5, None, 10 ** 12):
            ETAT['livre']['prix_sats'] = faux_
            await relire_etat("GG.M.etat && GG.M.etat.livre && GG.M.etat.livre.prix_sats === " + json.dumps(faux_))
            a_, c_ = await textes_prix(); assert not re.search(r'\d', a_) and 'celui que publie la librairie' in c_, (faux_, a_)
        ETAT['livre']['prix_sats'] = 21000; PANNE['librairie'] = True
        await relire_etat("GG.M.etat === null"); a_, c_ = await textes_prix()
        assert not re.search(r'\d', a_) and '21 000' not in c_ and 'celui que publie la librairie' in c_, a_
        PANNE['librairie'] = False; await relire_etat("GG.M.etat && GG.M.etat.livre && GG.M.etat.livre.prix_sats === 21000")
        vert('N6 : le prix du livre et les parts (page Compagnon, Acheter) sont ceux que publie la caisse (etat.livre.prix_sats : 18 000 apres un recalage) ; champ absent, illisible, ou librairie muette : une phrase sans nombre, jamais un prix faux')
        # ---- I5 (contre-verification de la caisse) : « Mes livres » montre a qui la vente de chaque exemplaire est attribuee, lu au registre
        # public, et demande a l'acheteur de le verifier ; le registre est lu en entier : rien ne part vers la caisse
        async def attribution_(attendu):
            REQ.clear(); await pg.evaluate("location.hash = '#/livres'; GG.lireAttributions(true)")
            await pg.wait_for_function("!GG.ATTRIB.enCours && GG.ATTRIB.date > 0", timeout=20000); await pg.wait_for_timeout(300)
            assert ('GET', CAISSE + '/api/registre.json') in REQ and all(m_ == 'GET' and E1 not in u_ for m_, u_ in REQ), REQ
            x_ = plat(await pg.inner_text('#page')); assert attendu in x_, (attendu, x_[x_.find('Mes livres'):][:700])
            return x_
        x_ = await attribution_("Vente attribuée : vente directe (aucun compagnon).")
        assert "Vérifiez que c'est bien le lien que vous avez suivi pour l'acheter" in x_ and 'section 1 des conditions générales' in x_ and await pg.query_selector('.attrib a[href="#/conditions"]')
        from embit import ec as EC_, script as SC_
        from embit.networks import NETWORKS as NET_
        KC = EC_.PrivateKey(hashlib.sha256(b'un compagnon').digest()); ADRC = SC_.p2wpkh(KC.get_public_key()).address(NET_['main'])
        REG['exemplaires'][0]['lien'] = ADRC; code_ = await pg.evaluate(f"GG.codeCompagnon('{ADRC}')")
        x_ = await attribution_(f"Vente attribuée : au compagnon dont le lien se termine par /c/{code_}, à l'adresse :")
        assert ADRC in x_.replace(' ', '').replace('\n', '') and 'Vérifiez que' in x_
        for lien_ in ('n importe quoi', None, 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'):
            REG['exemplaires'][0]['lien'] = lien_; await attribution_('Le registre ne donne pas pour cette vente un lien lisible')
        REG['exemplaires'].append(dict(REG['exemplaires'][1], empreinte=E1, exemplaire=9, lien='direct'))     # la meme empreinte deux fois : rien n'est affirme
        await attribution_('Le registre ne donne pas pour cette vente un lien lisible'); REG['exemplaires'].pop()
        sauve_ = REG['exemplaires'].pop(0); await attribution_("n'est pas (encore) au registre publié par la librairie")
        PANNE['registre'] = True; REQ.clear(); await pg.evaluate("GG.lireAttributions(true)"); await pg.wait_for_function("!GG.ATTRIB.enCours && GG.ATTRIB.erreur", timeout=20000); await pg.wait_for_timeout(300)
        assert 'Le registre de la librairie ne répond pas' in plat(await pg.inner_text('#page')) and 'Vente attribuée' not in plat(await pg.inner_text('#page')) and ('GET', CAISSE + '/api/registre.json') in REQ, REQ
        PANNE['registre'] = False; REG['exemplaires'].insert(0, dict(sauve_, lien='direct')); await attribution_("Vente attribuée : vente directe")
        assert not [u for m_, u in REQ if E1 in u] and all(m_ == 'GET' for m_, u in REQ)
        vert('I5 : « Mes livres » montre a qui la vente de chaque exemplaire est attribuee (vente directe, ou le compagnon : fin de son lien /c/<code> et son adresse), lu au registre public en entier (une seule lecture GET, sans l empreinte : rien ne part vers la caisse) ; il demande de verifier que c est bien le lien suivi et dit ou le signaler (section 1 des conditions generales) ; lien illisible, empreinte en double, exemplaire absent, registre muet : rien n est affirme')
        # la bulle « ? » ne deborde plus de la page
        await pg.set_viewport_size({'width': 1280, 'height': 720})
        for page_, sel in (('livres', '#page h1 .bq'), ('messages', '#page h1 .bq'), ('chasser', '#page h1 .bq'), ('tableau', '#page h1 .bq')):
            await pg.evaluate(f"location.hash = '#/{page_}'"); await pg.wait_for_timeout(400)
            await pg.hover(sel); await pg.wait_for_timeout(300)
            dans = await pg.evaluate(f"(function(){{ var z = document.getElementById('page').getBoundingClientRect(), b = document.querySelector('{sel} .bqb').getBoundingClientRect(); return [Math.round(b.left - z.left), Math.round(z.right - b.right), Math.round(b.width)]; }})()")
            assert dans[0] >= 8 and dans[1] >= 8 and dans[2] > 200, (page_, dans)
        await pg.mouse.move(5, 5)
        vert('bulles « ? » des titres : entierement dans la page (Livres, Messages, Chasser, Tableau)')
        # le guide : cinq langues, recherche, renvois, et « En savoir plus » depuis une bulle
        await pg.evaluate("location.hash = '#/guide'"); await pg.wait_for_timeout(500)
        comptes = []
        for lg in ('fr', 'en', 'es', 'de', 'pt'):
            await pg.evaluate(f"GG.R.lang = '{lg}'; location.hash = '#/guide'; window.dispatchEvent(new HashChangeEvent('hashchange'))"); await pg.wait_for_timeout(300)
            comptes.append(await pg.evaluate("[document.querySelectorAll('#page .gl-mot').length, document.querySelectorAll('#page .gl-faq').length, document.querySelectorAll('#page .gl-parcours .cadre').length]"))
        assert len(set(map(tuple, comptes))) == 1 and comptes[0][0] >= 35, comptes; vert(f'guide : {comptes[0][0]} mots, {comptes[0][1]} questions, {comptes[0][2]} parcours, dans les cinq langues')
        await pg.evaluate("GG.R.lang = 'fr'; location.hash = '#/guide'; window.dispatchEvent(new HashChangeEvent('hashchange'))"); await pg.wait_for_timeout(300)
        casses = await pg.evaluate("[].slice.call(document.querySelectorAll('#page .gl-voir a')).map(a => a.getAttribute('href').split('/')[2]).filter(id => !document.getElementById('g-' + id))")
        assert not casses, casses; vert('guide : chaque « Voir aussi » mene a un mot du glossaire')
        await pg.fill('#g-cherche', 'alea'); await pg.wait_for_timeout(200)
        vis = await pg.evaluate("[].slice.call(document.querySelectorAll('#page .gl-mot')).filter(e => !e.hidden).map(e => e.id)")
        assert 'g-alea' in vis and len(vis) < 12, vis; vert(f'guide : la recherche « alea » (sans accent) trouve Aléa ({len(vis)} fiches)')
        await pg.fill('#g-cherche', 'zzzzqq'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("!document.getElementById('g-aucun').hidden"); await pg.fill('#g-cherche', 'cri')
        await pg.evaluate("location.hash = '#/coffret'"); await pg.wait_for_timeout(400)
        await pg.hover('#page h1 .bq'); await pg.wait_for_timeout(250); await pg.hover('#page h1 .bq .bq-plus'); await pg.click('#page h1 .bq .bq-plus'); await pg.wait_for_timeout(500)
        assert await pg.evaluate("location.hash") == '#/guide/coffret' and await pg.evaluate("!document.getElementById('g-coffret').hidden && document.getElementById('g-coffret').classList.contains('gl-cible')")
        y = await pg.evaluate("(function(){ var z = document.getElementById('page').getBoundingClientRect(), r = document.getElementById('g-coffret').getBoundingClientRect(); return r.top >= z.top && r.bottom <= z.bottom; })()")
        assert y; vert('bulle du COFFRET : « En savoir plus » ouvre le guide sur le mot COFFRET, visible, meme apres une recherche')
        await pg.evaluate("location.hash = '#/reglages'"); await pg.wait_for_timeout(300)
        assert await pg.evaluate("!!document.querySelector('#page .gl-carte a[href=\"#/guide\"]')"); vert('Reglages : la carte « Guide et glossaire » ouvre le guide')
        # ============================================================ BETA 1.1
        from embit import ec as EC, script as SC
        from embit.networks import NETWORKS
        from embit.transaction import Transaction as TXE
        from embit.util import secp256k1 as LS
        import base64 as B64, websockets
        # ---- la double source : d'accord, puis en desaccord sur une transaction confirmee
        await pg.evaluate("location.hash = '#/tableau'"); await pg.wait_for_timeout(300)
        assert await pg.evaluate("GG.sources().length") == 2
        await pg.evaluate("GG.explo('/tx/" + VTX + "')"); assert await pg.evaluate("GG.M.src.etat") == 2
        BETA['diverge'] = True
        r = await pg.evaluate("GG.explo('/tx/" + VTX + "').then(() => 'passe', e => e.message)")
        assert 'ne disent pas la même chose' in r and await pg.evaluate("GG.M.erreurs.sources === true"), r
        BETA['diverge'] = False; await pg.evaluate("GG.M.erreurs.sources = false; GG.M.src.ecarts = []")
        vert('double source : deux explorateurs d accord ; une transaction confirmee differente d un cote est refusee, et le desaccord s affiche')
        # ---- le programme officiel, d'apres un message signe par l'auteur
        EMP = await pg.evaluate("window.GG_EMPREINTE.empreinte")
        assert (await pg.evaluate("GG.officiel()"))['etat'] == 'essai'
        def signe(texte): return CV.signer_message(GRAINE, ZPUB, '2026-12-08', texte)
        BETA['messages_extra'] = [signe('GodGift Core 1.1.0 : empreinte ' + EMP)]
        await pg.evaluate("location.hash = '#/reglages'"); await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 3", timeout=60000)
        o = await pg.evaluate("GG.officiel()"); assert o['etat'] == 'officiel' and o['v'] == '1.1.0', o
        BETA['messages_extra'] = [signe('GodGift Core 1.1.0 : empreinte ' + 'ab' * 32)]
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 3", timeout=60000)
        assert (await pg.evaluate("GG.officiel()"))['etat'] == 'inconnu'
        faux_auteur = dict(signe('GodGift Core 1.1.0 : empreinte ' + EMP)); faux_auteur['texte'] = faux_auteur['texte'] + ' '
        BETA['messages_extra'] = [signe('GodGift Core 1.1.0 : empreinte ' + EMP), signe('GodGift Core 1.1.0 : empreinte ' + EMP + ' RETIREE')]
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 4", timeout=60000)
        assert (await pg.evaluate("GG.officiel()"))['etat'] == 'retiree'
        BETA['messages_extra'] = [faux_auteur]
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 3", timeout=60000)
        assert (await pg.evaluate("GG.officiel()"))['etat'] == 'essai'
        BETA['messages_extra'] = []
        vert('version publiee : reconnue par le message signe de l auteur ; une autre empreinte, une version retiree, ou un message dont la signature ne tient plus sont refuses')
        # ---- la solution d'un coffre pris : un message signe, recalcule contre l'engagement grave au semis ; jamais rien de rempli ni d'envoye
        n_posts = len(BETA['posts'])
        BETA['messages_extra'] = [signe_brut('2027-02-20', 'Le coffre 1 a été pris : voici sa solution.\n' + HH.ligne_solution(1, 1, SOL3, SOL17, SEL)),
                                  signe_brut('2027-02-21', 'Le coffre 1, une autre solution.\n' + HH.ligne_solution(1, 1, SOL3, SOL17, '6b' * 16)),
                                  signe_brut('2027-02-31', 'Un message date d un jour qui n existe pas.')]
        await pg.evaluate("location.hash = '#/messages'"); await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 5 && GG.MP.adresseAncree", timeout=60000)
        await pg.wait_for_timeout(500)
        s = await pg.evaluate("GG.solutionsSignees().map(function (x) { return [x.h, x.c, x.tenu, x.m.date]; })")
        assert sorted(s, key=lambda x: x[3]) == [[1, 1, True, '2027-02-20'], [1, 1, False, '2027-02-21']], s
        txt = (plat(await pg.inner_text('#page'))).replace('\xa0', ' ')
        assert 'engagement du semis tenu' in txt and 'engagement FAUX' in txt, txt[:600]
        mal = await pg.evaluate("GG.MP.messages.filter(function (m) { return m.date === '2027-02-31'; }).map(function (m) { return [m.forme, m.valide]; })")
        assert mal == [[False, False]] and await pg.evaluate("document.querySelectorAll('#page details.message.refuse').length") == 2   # le message falsifie et celui mal date : replies
        vert('solution publiee par message signe : « engagement du semis tenu » quand les mots et le sel redonnent l engagement grave, « engagement FAUX » sinon ; un message a la date impossible est replie')
        await pg.evaluate("location.hash = '#/chasser'"); await pg.wait_for_timeout(400)
        assert await pg.evaluate("[document.getElementById('h-r3').value, document.getElementById('h-r17').value].join('')") == ''
        assert len(BETA['posts']) == n_posts and not await pg.evaluate("Object.keys(GG.TR.envois).length + Object.keys(GG.TR.cles).length")
        vert('la solution signee ne remplit aucune reponse et ne declenche aucun envoi')
        BETA['messages_extra'] = []
        await relancer(pg); await pg.wait_for_function("GG.M.pret && GG.MP.messages && GG.MP.messages.length >= 2", timeout=60000)
        # ---- l'adresse de reception : preuve par signature BIP-137 d'un portefeuille, refus des erreurs
        KG = EC.PrivateKey(hashlib.sha256(b'le gagnant').digest()); ADRG = SC.p2wpkh(KG.get_public_key()).address(NETWORKS['main'])
        def sig137(cle, m):
            pp = b'Bitcoin Signed Message:\n'; mm = m.encode()
            h = hashlib.sha256(hashlib.sha256(bytes([len(pp)]) + pp + bytes([len(mm)]) + mm).digest()).digest()
            rs, rec = LS.ecdsa_recoverable_signature_serialize_compact(LS.ecdsa_sign_recoverable(h, cle.secret))
            return B64.b64encode(bytes([39 + rec]) + rs).decode()
        await pg.evaluate("location.hash = '#/reglages'"); await pg.wait_for_timeout(400)
        await pg.fill('#r-rec-adr', ADRG); MSGR = await pg.evaluate("document.getElementById('r-rec-msg').textContent")
        assert MSGR.startswith('AEDE:reception:' + ADRG + ':') and len(MSGR.rsplit(':', 1)[1]) == 8, MSGR
        await pg.fill('#r-rec-sig', sig137(KG, 'AEDE:reception:' + ADRG)); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        _t = plat(await pg.inner_text('#rec-carte')); _r = await pg.evaluate('GG.R.reception'); assert 'ne correspond pas' in _t and not _r, (_t, _r)
        await pg.fill('#r-rec-sig', ''); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        assert 'Collez la signature' in plat(await pg.inner_text('#rec-carte')) and not await pg.evaluate("GG.R.reception")
        ADRT = SC.p2tr(KG.get_public_key()).address(NETWORKS['main'])
        await pg.fill('#r-rec-adr', ADRT); await pg.fill('#r-rec-sig', sig137(KG, MSGR)); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        assert 'ne sait pas encore signer' in plat(await pg.inner_text('#rec-carte')) and not await pg.evaluate("GG.R.reception")
        await pg.fill('#r-rec-adr', ADRG); await pg.fill('#r-rec-sig', sig137(KG, MSGR)); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        rv = await pg.evaluate("GG.receptionValide()"); assert rv['ok'] and rv['preuve'] == 'signee' and rv['adresse'] == ADRG and rv['date'] in (time.strftime('%Y-%m-%d', time.gmtime()), time.strftime('%Y-%m-%d', time.gmtime(FAUX))), rv
        import re as _re
        _t = plat(await pg.inner_text('#rec-carte')); assert _re.search(r'enregistrée le \d{1,2} [a-zéû]+ \d{4}', _t) and rv['date'] not in _t, _t   # la date en toutes lettres
        await pg.evaluate("GG.R.reception.adresse = GG.R.reception.adresse.slice(0, -2) + 'qq'")
        assert not (await pg.evaluate("GG.receptionValide()"))['ok']
        await pg.evaluate("GG.R.reception = { adresse: GG.R.reception.adresse.slice(0, -2) + JSON.parse(localStorage.getItem('gg.reception')).adresse.slice(-2), preuve: 'confirmee', date: '2026-12-01' }")
        assert (await pg.evaluate("GG.receptionValide()")) == {'ok': False, 'raison': 'preuve'}
        await pg.evaluate("GG.R.reception = JSON.parse(localStorage.getItem('gg.reception'))")
        # contre-audit N7 : le nombre de l'installation est renouvele a chaque enregistrement ; une signature d'avant ne vaut plus
        n1 = MSGR.rsplit(':', 1)[1]; await pg.click('#r-rec-changer'); await pg.wait_for_timeout(200)
        await pg.fill('#r-rec-adr', ADRG); MSG2 = await pg.evaluate("document.getElementById('r-rec-msg').textContent")
        assert MSG2.startswith('AEDE:reception:' + ADRG + ':') and MSG2.rsplit(':', 1)[1] != n1, (MSGR, MSG2)
        await pg.fill('#r-rec-sig', sig137(KG, MSGR)); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        assert 'ne correspond pas' in plat(await pg.inner_text('#rec-carte'))
        await pg.fill('#r-rec-sig', sig137(KG, MSG2)); await pg.click('#r-rec-garder'); await pg.wait_for_timeout(200)
        assert (await pg.evaluate("GG.receptionValide()"))['ok']
        await pg.evaluate(f"GG.R.reception.signature = {json.dumps(sig137(KG, MSGR))}"); assert not (await pg.evaluate("GG.receptionValide()"))['ok']
        await pg.evaluate("GG.R.reception = JSON.parse(localStorage.getItem('gg.reception'))"); assert (await pg.evaluate("GG.receptionValide()"))['ok']
        vert('nombre de l installation renouvele a chaque enregistrement : la signature de l ancien message est refusee, et une ancienne signature remise en place ne vaut plus')
        # la fenetre dediee ne fait confiance qu'a une adresse enregistree (ou retapee) DANS la fenetre : un sceau, HMAC du jeton du lanceur
        assert await pg.evaluate("GG.fenetre() && GG.receptionScellee() && GG.modeEnvoi() === 'fenetre_oui'")
        KX = EC.PrivateKey(hashlib.sha256(b'un intrus').digest()); ADRX = SC.p2wpkh(KX.get_public_key()).address(NETWORKS['main'])
        nx = await pg.evaluate("JSON.parse(localStorage.getItem('gg.reception_nonce'))")
        sauve = await pg.evaluate("[localStorage.getItem('gg.reception'), localStorage.getItem('gg.reception_vue')]")
        intrus = json.dumps({'adresse': ADRX, 'signature': sig137(KX, 'AEDE:reception:' + ADRX + ':' + nx), 'preuve': 'signee', 'date': '2026-12-01'})
        await pg.evaluate(f"localStorage.setItem('gg.reception', {json.dumps(intrus)}); localStorage.setItem('gg.reception_vue', JSON.stringify({{adresse: '{ADRX}', date: '2026-12-01'}}))")
        await relancer(pg); await pg.wait_for_function("window.GG && GG.M && GG.M.pret", timeout=60000)
        assert await pg.evaluate("GG.fenetre() && GG.receptionValide().ok && !GG.receptionScellee() && GG.modeEnvoi() === 'fenetre_sceau'")
        await pg.evaluate(f"localStorage.setItem('gg.reception', {json.dumps(sauve[0])}); localStorage.setItem('gg.reception_vue', {json.dumps(sauve[1])})")
        await relancer(pg); await pg.wait_for_function("window.GG && GG.M && GG.M.pret", timeout=60000)
        assert await pg.evaluate("GG.receptionScellee() && GG.modeEnvoi() === 'fenetre_oui'")
        vert('fenetre dediee : une adresse posee dans le stockage par un autre fichier, meme signee par son portefeuille et au bon nombre, n a pas le sceau du jeton : pas d envoi automatique (retape exigee)')
        # V2 : le jeton ne vit qu'en memoire ; la fenetre rechargee n'est plus la fenetre dediee, le dit sur chaque page, et se relance
        await pg.reload(); await pg.wait_for_function("window.GG && GG.M", timeout=60000); await pg.wait_for_timeout(300)
        assert await pg.evaluate("!GG.fenetre() && GG.fenetreRechargee() && GG.modeEnvoi() === 'fenetre_rechargee' && !GG.receptionScellee() && sessionStorage.getItem('gg.fenetre') === null")
        bt = plat(await pg.inner_text('#fenetre-rechargee')); assert 'a été rechargée' in bt and 'rouvrez GodGift Core par son icône' in bt, bt
        await pg.evaluate("location.hash = '#/chasser'"); await pg.wait_for_timeout(300)
        assert await pg.query_selector('#fenetre-rechargee') is not None and 'rechargée' in plat(await pg.inner_text('#page'))
        await relancer(pg); await pg.wait_for_function("window.GG && GG.M && GG.M.pret", timeout=60000)
        assert await pg.evaluate("GG.fenetre() && !GG.fenetreRechargee() && GG.receptionScellee() && GG.modeEnvoi() === 'fenetre_oui'") and await pg.query_selector('#fenetre-rechargee') is None
        vert('V2 : rechargee, la fenetre dediee n a plus de jeton (rien dans le stockage) : elle n envoie plus seule, l ecrit en haut de chaque page et renvoie au lanceur ; rouverte par le lanceur, elle retrouve son sceau')
        vert('adresse de reception : toujours prouvee par la signature du portefeuille (BIP-137) d un message qui porte le nombre de cette installation ; sans signature, une adresse bc1p qui ne sait pas signer, une signature sans ce nombre, une adresse modifiee apres coup, ou une ancienne adresse « confirmee » sans signature : refuses ; la date d enregistrement s affiche')
        # ---- hors de la fenetre dediee (contre-audit N1) : la meme copie ouverte sans le jeton (navigateur principal, repli d'un lanceur),
        # ou avec un faux jeton ; le tresor ne part qu'apres la retape de deux morceaux de 8 caracteres tires au hasard (V1), masques a
        # l'ecran (V3), et la retape ne vaut que pour un envoi
        K0 = '1:' + ADR0
        stock = await pg.evaluate("JSON.stringify(Object.keys(localStorage).filter(function (k) { return k.indexOf('gg.') === 0; }).reduce(function (o, k) { o[k] = localStorage.getItem(k); return o; }, {}))")
        async def contexte_():                    # un autre navigateur (profil a part), avec les reglages et l'adresse prouvee du chasseur
            cx = await b.new_context(viewport={'width': 1400, 'height': 900}, bypass_csp=True)
            await cx.route(lambda u: not u.startswith('file:'), route)
            await cx.add_init_script(f"window.GG_ATELIER_CHAINE = {json.dumps(CH)}; window.GG_ATELIER_RELAIS = ['https://drand.test']; (function(){{ var d0 = Date.now.bind(Date), dec = {FAUX} * 1000 - d0(); Date.now = function(){{ return d0() + dec; }}; }})();"
                                     f"(function (s) {{ if (!sessionStorage.getItem('gg.banc')) {{ for (var k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('gg.banc', '1'); }} }})({stock});")
            return cx
        ctxN = await contexte_()
        async def trouver_(pgx, prep=True):
            await pgx.wait_for_function("window.GG && GG.CZ && GG.CZ.coffret && Object.keys(GG.CZ.ouverts).length >= 4", timeout=90000)
            if prep: await pgx.wait_for_function(f"GG.TR.prep['{K0}'] && GG.TR.prep['{K0}'].utxos", timeout=30000)
            await pgx.fill('#z-r3', '1 2500 5000'); await pgx.fill('#z-r17', '873 874 4410'); await pgx.fill('#z-alea', ALEA0); await pgx.click('#z-calculer')
            await pgx.wait_for_function(f"GG.TR.cles['{K0}'] && GG.TR.msg['{K0}']", timeout=180000); await pgx.wait_for_timeout(1500)
        pgN = await ctxN.new_page(); pgN.on('pageerror', lambda e: err.append(str(e)))
        await pgN.goto(APP_SANS + '?fenetre=' + '0' * 64 + '#/chasse/0')
        await pgN.wait_for_function("window.GG && GG.M", timeout=60000)
        assert await pgN.evaluate("!GG.fenetre() && GG.modeEnvoi() === 'fenetre_non'")
        BETA['posts'].clear(); await trouver_(pgN)
        assert await pgN.evaluate(f"GG.TR.msg['{K0}'].retape && !GG.TR.compte['{K0}'] && !GG.TR.envois['{K0}'] && !GG.TR.confirmer['{K0}']") and not BETA['posts']
        p1, p2 = await pgN.evaluate(f"GG.TR.morceaux['{ADRG}']"); m1, m2 = ADRG[p1:p1 + 8], ADRG[p2:p2 + 8]
        assert 4 <= p1 and p1 + 8 <= p2 and p2 + 8 <= len(ADRG), (p1, p2)
        txt = plat(await pgN.inner_text('#page')); sans = txt.replace(' ', '').replace('\n', '')
        assert 'Retapez les deux morceaux de 8 caractères' in txt and f'Retapez les caractères {p1 + 1} à {p1 + 8} et {p2 + 1} à {p2 + 8}' in txt and '••••••••' in sans, txt[:800]
        assert m1 not in sans and m2 not in sans and ADRG not in sans, (m1, m2)
        assert await pgN.evaluate("GG.masquee(GG.R.reception.adresse)") == ADRG[:p1] + '•' * 8 + ADRG[p1 + 8:p2] + '•' * 8 + ADRG[p2 + 8:]
        await pgN.fill('[id^="tr-retape-"]', 'qqqqqqqq'); await pgN.fill('[id^="tr-retape2-"]', 'qqqqqqqq'); await pgN.click('[data-retape]'); await pgN.wait_for_timeout(400)
        assert "Ces 16 caractères ne sont pas ceux de l'adresse enregistrée" in plat(await pgN.inner_text('#page')) and not BETA['posts'] and not await pgN.evaluate(f"!!GG.TR.envois['{K0}']")
        # l'ancienne retape (les 8 derniers caracteres seuls) ne suffit plus, ni un seul des deux morceaux, ni les deux inverses
        for a_, b_ in ((ADRG[-8:], ''), (m1, ''), (m1, ADRG[-8:] if ADRG[-8:] != m2 else 'qqqqqqqq'), (m2, m1)):
            await pgN.fill('[id^="tr-retape-"]', a_); await pgN.fill('[id^="tr-retape2-"]', b_); await pgN.click('[data-retape]'); await pgN.wait_for_timeout(300)
            assert await pgN.evaluate(f"GG.TR.msg['{K0}'].retape && GG.TR.msg['{K0}'].e === 'ko' && !GG.TR.retape['{K0}']") and not BETA['posts'], (a_, b_)
        assert await pgN.evaluate(f"GG.TR.morceaux['{ADRG}'].join()") == f'{p1},{p2}'          # une retape fausse ne tire pas d'autres morceaux
        vert('hors de la fenetre dediee (sans jeton, ou avec un faux) : la cle trouvee ne part pas seule ; deux morceaux de 8 caracteres tires au hasard hors du prefixe sont demandes, masques partout a l ecran ; une retape fausse, les 8 derniers caracteres seuls, un seul morceau ou les morceaux inverses : rien ne part')
        # V1 : une page du meme navigateur substitue sa propre adresse (signee par SA cle, au bon nombre, reconnue) ; le chasseur retape ce
        # que montre SON portefeuille : refuse, rien ne part
        nN = await pgN.evaluate("JSON.parse(localStorage.getItem('gg.reception_nonce'))")
        sauveN = await pgN.evaluate("[localStorage.getItem('gg.reception'), localStorage.getItem('gg.reception_vue')]")
        intrusN = json.dumps({'adresse': ADRX, 'signature': sig137(KX, 'AEDE:reception:' + ADRX + ':' + nN), 'preuve': 'signee', 'date': '2026-12-01'})
        await pgN.evaluate(f"localStorage.setItem('gg.reception', {json.dumps(intrusN)}); localStorage.setItem('gg.reception_vue', JSON.stringify({{adresse: '{ADRX}', date: '2026-12-01'}}))")
        assert json.loads(await pgN.evaluate("localStorage.getItem('gg.reception')"))['adresse'] == ADRX   # relire force l'ecriture (sinon un rechargement trop tot la perd, et le banc rougit a tort)
        await pgN.wait_for_timeout(700)                                           # le stockage local s'ecrit en differe : on le laisse se poser avant de recharger
        await pgN.reload(); await pgN.wait_for_function("window.GG && GG.M", timeout=60000)
        assert await pgN.evaluate("GG.receptionValide().ok && GG.R.reception.adresse") == ADRX, await pgN.evaluate("[GG.receptionValide(), localStorage.getItem('gg.reception')]")
        await trouver_(pgN)
        q1, q2 = await pgN.evaluate(f"GG.TR.morceaux['{ADRX}']")
        await pgN.fill('[id^="tr-retape-"]', ADRG[q1:q1 + 8]); await pgN.fill('[id^="tr-retape2-"]', ADRG[q2:q2 + 8]); await pgN.click('[data-retape]'); await pgN.wait_for_timeout(400)
        assert await pgN.evaluate(f"GG.TR.msg['{K0}'].e === 'ko' && !GG.TR.retape['{K0}'] && !GG.TR.envois['{K0}']") and not BETA['posts']
        await pgN.evaluate(f"localStorage.setItem('gg.reception', {json.dumps(sauveN[0])}); localStorage.setItem('gg.reception_vue', {json.dumps(sauveN[1])})"); await pgN.wait_for_timeout(700)
        await pgN.reload(); await pgN.wait_for_function("window.GG && GG.M", timeout=60000); await trouver_(pgN)
        vert('V1 : une adresse substituee dans le stockage par une page du meme navigateur (signee par sa propre cle, au bon nombre, reconnue) : les 16 caracteres lus dans le portefeuille du chasseur ne passent pas ; rien ne part')
        # V3 : le formulaire « Changer » ne reprend pas l'adresse enregistree ; la carte d'entrainement la masque aussi
        await pgN.evaluate("location.hash = '#/reglages'"); await pgN.wait_for_timeout(300); await pgN.click('#r-rec-changer'); await pgN.wait_for_timeout(200)
        assert await pgN.input_value('#r-rec-adr') == '' and ADRG not in plat(await pgN.inner_text('#page')).replace(' ', '')
        await pgN.click('#r-rec-annuler'); await pgN.wait_for_timeout(200)
        p1, p2 = await pgN.evaluate(f"GG.TR.morceaux['{ADRG}']"); m1, m2 = ADRG[p1:p1 + 8], ADRG[p2:p2 + 8]
        c_ = await pgN.evaluate("GG.masquee(GG.R.reception.adresse)"); assert m1 not in c_ and m2 not in c_
        vert('V3 : hors du sceau de la fenetre dediee, le formulaire « Changer » part vide ; l adresse s affiche partout avec ses deux morceaux demandes masques (cartes d essai comprises)')
        await pgN.evaluate("location.hash = '#/chasse/0'"); await pgN.wait_for_function(f"GG.TR.msg['{K0}'] && GG.TR.msg['{K0}'].retape", timeout=30000); await pgN.wait_for_timeout(300)
        await pgN.fill('[id^="tr-retape-"]', m1.upper()); await pgN.fill('[id^="tr-retape2-"]', m2); await pgN.click('[data-retape]')
        await pgN.wait_for_function(f"GG.TR.envois['{K0}'] && GG.TR.envois['{K0}'].etat === 'diffusee'", timeout=60000)
        txN = TXE.parse(bytes.fromhex(BETA['posts'][0][1])); assert txN.vout[0].script_pubkey.address(NETWORKS['main']) == ADRG
        assert await pgN.evaluate(f"!GG.TR.retape['{K0}']")                     # la retape a servi a CET envoi
        await pgN.click('[data-accelerer]'); await pgN.wait_for_timeout(500)
        if await pgN.evaluate("!!document.querySelector('[data-confirmer]')"): await pgN.click('[data-confirmer]'); await pgN.wait_for_timeout(500)
        n_p = len(BETA['posts'])
        assert await pgN.evaluate(f"GG.TR.msg['{K0}'] && GG.TR.msg['{K0}'].retape") and len(BETA['posts']) == n_p
        assert await pgN.evaluate(f"!!document.querySelector('[id^=\"tr-retape2-\"]') && GG.TR.morceaux['{ADRG}'].length === 2")
        vert('la bonne retape (les deux morceaux lus dans le portefeuille, casse indifferente en bech32) : la transaction part vers l adresse prouvee ; pour l envoi suivant (Accelerer), deux morceaux sont redemandes')
        await ctxN.close(); ctxS = await contexte_()
        pgS = await ctxS.new_page(); pgS.on('pageerror', lambda e: err.append(str(e)))
        await pgS.goto(APP_SANS + '?sans_installer=1#/chasse/0'); await pgS.wait_for_function("window.GG && GG.M", timeout=60000)
        assert await pgS.evaluate("!GG.fenetre() && GG.sansInstaller() && GG.modeEnvoi() === 'fenetre_sans_installer'")
        n_p = len(BETA['posts']); await trouver_(pgS, prep=False)
        txt = plat(await pgS.inner_text('#page'))
        assert 'ne récupère aucun trésor' in txt and not await pgS.evaluate("!!document.querySelector('[data-retape]')") and len(BETA['posts']) == n_p
        assert not await pgS.evaluate(f"!!GG.TR.envois['{K0}'] || !!GG.TR.compte['{K0}']")
        await ctxS.close(); BETA['posts'].clear(); BETA['vus'].clear()
        vert('« Sans installer » : la cle trouvee n est jamais envoyee, ni proposee a la retape ; la page renvoie a l installation')
        # ---- recuperer le tresor : la chasse zero, calcul, signature, envoi, confirmation
        await pg.evaluate("location.hash = '#/chasse/0'"); await pg.wait_for_function("GG.CZ.coffret && Object.keys(GG.CZ.ouverts).length >= 4", timeout=90000)
        await pg.wait_for_function("GG.TR.prep['1:" + ADR0 + "'] && GG.TR.prep['1:" + ADR0 + "'].utxos", timeout=30000)
        assert '600 000 sats' in (plat(await pg.inner_text('#page'))).replace('\u202f', ' ').replace('\xa0', ' ')
        BETA['posts'].clear(); K0 = '1:' + ADR0; EV = f"GG.TR.envois['{K0}']"; BETA['frais'] = 400   # des frais tres eleves annonces : GodGift Core doit demander
        await pg.fill('#z-r3', '1 2500 5000'); await pg.fill('#z-r17', '873 874 4410'); await pg.fill('#z-alea', ALEA0); await pg.click('#z-calculer')
        await pg.wait_for_function(f"GG.TR.compte['{K0}']", timeout=180000)
        bonne_sig = await pg.evaluate("GG.R.reception.signature")
        await pg.evaluate(f"GG.R.reception.signature = {json.dumps(sig137(KG, 'AEDE:reception:' + ADRG))}")   # remplacee pendant le compte a rebours
        await pg.wait_for_function(f"!GG.TR.compte['{K0}'] && GG.TR.msg['{K0}'] && GG.TR.msg['{K0}'].attenteAdresse", timeout=30000)
        assert not BETA['posts'] and await pg.evaluate(f"GG.TR.msg['{K0}'].e") == 'ko'
        await pg.evaluate(f"GG.R.reception.signature = {json.dumps(bonne_sig)}; GG.receptionReconnue()")
        await pg.wait_for_function(f"GG.TR.compte['{K0}']", timeout=30000)
        vert('la signature de l adresse de reception est reverifiee au moment de l envoi : remplacee pendant le compte a rebours, rien ne part ; reconnue, l envoi reprend')
        txt = plat(await pg.inner_text('#page')); assert 'part vers votre adresse dans' in txt and ADRG[:4] in txt and not BETA['posts']
        assert not await pg.evaluate("/[KL][1-9A-HJ-NP-Za-km-z]{51}/.test(document.getElementById('page').innerText)")
        # en un seul appel : un rendu de la page (la preparation du coffre qui se termine) peut survenir entre deux appels du banc
        wif = await pg.evaluate("document.querySelector('.tresor-trouve details').open = true; document.querySelector('[data-wif]').click(); document.getElementById('h-wif').textContent")
        assert wif[:1] in ('K', 'L') and len(wif) == 52, wif
        await pg.wait_for_function(f"GG.TR.confirmer['{K0}']", timeout=60000)
        assert 'Frais élevés' in plat(await pg.inner_text('#page')) and not BETA['posts']
        BETA['frais'] = 10; await pg.click('[data-confirmer]')
        await pg.wait_for_function(f"{EV} && {EV}.etat === 'diffusee'", timeout=60000)
        env = await pg.evaluate(EV); assert len(BETA['posts']) >= 1 and {p[0] for p in BETA['posts']} == {'explo.test', 'explo2.test'}
        tx = TXE.parse(bytes.fromhex(BETA['posts'][0][1]))
        assert tx.vout[0].script_pubkey.address(NETWORKS['main']) == ADRG and tx.vin[0].txid.hex() == '77' * 32 and tx.vin[0].sequence == 0xfffffffd
        pub = EC.PublicKey.parse(tx.vin[0].witness.items[1]); assert SC.p2wpkh(pub).address(NETWORKS['main']) == ADR0
        assert pub.verify(EC.Signature.parse(tx.vin[0].witness.items[0][:-1]), tx.sighash_segwit(0, SC.p2pkh(pub), 600000))
        assert tx.vout[0].value + env['frais'] == 600000 and env['frais'] >= 300 * env['vt'] and env['frais'] <= 300000, env
        vert(f"recuperer le tresor : cle trouvee, l adresse s affiche 10 s (la cle privee n entre dans la page qu a la demande), puis la transaction signee sur la machine part par les deux sources vers l adresse prouvee ({tx.vout[0].value} sats, frais {env['frais']} sats) ; signature valide, remplacement autorise")
        # ---- accelerer : meme entree, frais plus eleves, nouvelle transaction
        async def accelerer_():
            await pg.click('[data-accelerer]'); await pg.wait_for_timeout(400)
            if await pg.evaluate("!!document.querySelector('[data-confirmer]')"):   # au-dela de 10 % du tresor, GodGift Core demande
                assert 'Frais élevés' in plat(await pg.inner_text('#page')); await pg.click('[data-confirmer]')
        n0 = len(BETA['posts']); await accelerer_()
        await pg.wait_for_function(f"{EV} && {EV}.etat === 'diffusee' && {EV}.txid !== '{env['txid']}'", timeout=30000)
        env2 = await pg.evaluate(EV); tx2 = TXE.parse(bytes.fromhex(BETA['posts'][-1][1]))
        assert env2['frais'] >= env['frais'] * 1.5 and tx2.vin[0].txid == tx.vin[0].txid and tx2.vout[0].script_pubkey.address(NETWORKS['main']) == ADRG
        ch = await pg.evaluate("""GG.choisirSorties([{txid: 'aa'.repeat(32), vout: 0, value: 60000, status: {confirmed: true}}, {txid: 'bb'.repeat(32), vout: 1, value: 700, status: {confirmed: true}},
            {txid: 'cc'.repeat(32), vout: 0, value: 900000, status: {confirmed: false}}, {txid: 'dd'.repeat(32), vout: 2, value: 5000, status: {confirmed: true}}], 1000)""")
        assert [x['txid'][:2] for x in ch] == ['aa', 'dd'], ch     # le semis garde meme a 1000 sat/vB ; poussiere et non confirme laisses
        vert(f"accelerer : la meme entree repart avec des frais plus eleves ({env['frais']} puis {env2['frais']} sats), toujours vers l adresse prouvee")
        # ---- un concurrent en attente : detecte, et on passe devant
        BETA['conflit'] = True
        BETA['mempool0'] = [{'txid': 'cc' * 32, 'fee': 9000, 'weight': 440, 'vin': [{'txid': '77' * 32, 'vout': 0, 'prevout': {'scriptpubkey_address': ADR0, 'value': 600000}}]}]
        await accelerer_(); await pg.wait_for_function(f"{EV} && {EV}.etat === 'concurrence'", timeout=40000)
        assert '9 000' in (plat(await pg.inner_text('#page'))).replace('\u202f', ' ').replace('\xa0', ' ')
        BETA['conflit'] = False; await accelerer_()
        await pg.wait_for_function(f"{EV} && {EV}.etat === 'diffusee' && {EV}.frais > 9000", timeout=40000)
        env3 = await pg.evaluate(EV); BETA['confirme'].add(env3['txid'])
        await pg.wait_for_function(f"{EV}.etat === 'confirmee' && {EV}.fini", timeout=60000)
        assert await pg.evaluate(f"!GG.TR.cles['{K0}']") and 'Trésor récupéré' in plat(await pg.inner_text('#page'))
        vert(f"concurrence : la transaction d un autre chasseur, vue par les deux sources, est detectee ; on passe devant ({env3['frais']} sats > 9 000) ; confirmee par les deux sources et assez profonde, la cle est effacee de la memoire")
        # ---- les temoins : un relais Nostr local qui verifie chaque signature
        RECUS = []
        async def relais(ws):
            async for m in ws:
                d = json.loads(m)
                if d[0] == 'EVENT':
                    ev = d[1]; ser = json.dumps([0, ev['pubkey'], ev['created_at'], ev['kind'], ev['tags'], ev['content']], separators=(',', ':'), ensure_ascii=False)
                    bon = hashlib.sha256(ser.encode()).hexdigest() == ev['id'] and EC.PublicKey.from_xonly(bytes.fromhex(ev['pubkey'])).schnorr_verify(EC.SchnorrSig.parse(bytes.fromhex(ev['sig'])), bytes.fromhex(ev['id']))
                    if bon: RECUS.append(ev)
                    await ws.send(json.dumps(['OK', ev['id'], bon, '']))
                elif d[0] == 'REQ':
                    for ev in RECUS:
                        if any(tg[0] == 't' and tg[1] == 'godgiftcore' for tg in ev['tags']): await ws.send(json.dumps(['EVENT', d[1], ev]))
                    await ws.send(json.dumps(['EOSE', d[1]]))
        serveur = await websockets.serve(relais, 'localhost', 7447)
        await pg.evaluate("GG.R.relais = ['ws://localhost:7447']; GG.R.temoin = true; location.hash = '#/verifier'"); await pg.wait_for_timeout(300)
        await pg.click('#lancer'); await pg.wait_for_function("GG.TE.publie > 0", timeout=90000)
        ev = RECUS[0]; aede = [x for x in ev['tags'] if x[0] == 'aede'][0]
        assert aede[5] == EMP and aede[4] == json.loads(MAN)['coffret']['sha256'] and '#GodGiftCore' in ev['content'] and len(ev['tags']) == 4
        # un temoin etranger (une autre version du programme) et un faux (signature alteree)
        ke = EC.PrivateKey(hashlib.sha256(b'temoin etranger').digest())
        def evt(prog, verdict):
            e = {'pubkey': ke.get_public_key().xonly().hex(), 'created_at': ev['created_at'], 'kind': 1, 'tags': [['t', 'godgiftcore'], ['aede', '1', '900000', aede[3], aede[4], prog, verdict, '13', '0']], 'content': 'x'}
            e['id'] = hashlib.sha256(json.dumps([0, e['pubkey'], e['created_at'], 1, e['tags'], 'x'], separators=(',', ':')).encode()).hexdigest()
            e['sig'] = ke.schnorr_sign(bytes.fromhex(e['id'])).serialize().hex(); return e
        RECUS.append(evt('dd' * 32, 'ok')); fx = evt(EMP, 'ko'); fx['sig'] = '00' * 64; RECUS.append(fx)
        await pg.evaluate("location.hash = '#/reseau'"); await pg.evaluate("GG.lireTemoins(true)"); await pg.wait_for_function("GG.TE.lu && GG.TE.lu.date && !GG.TE.enCours", timeout=30000)
        lu = await pg.evaluate("GG.TE.lu"); assert lu['n'] == 2 and lu['etrangers'] == 1 and lu['ko'] == (1 if aede[6] == 'ko' else 0), lu   # notre constat dit « ko » : le monde d essai contient un message falsifie
        assert 'version non publiée' in plat(await pg.inner_text('#page'))
        serveur.close()
        vert('temoins : le constat part signe (Schnorr, verifie par le relais), avec bloc, manifeste, COFFRET et programme ; l onglet Reseau compte 2 temoins, signale la version etrangere et ignore le faux (signature alteree)')
        # ---- l'adresse de reception a change depuis la derniere visite : alerte, et rien ne part seul tant qu'elle n'est pas reconnue
        await pg.evaluate("localStorage.setItem('gg.reception_vue', JSON.stringify({ adresse: 'bc1qautrechose', date: '2026-12-01' })); location.hash = '#/tableau'")
        await relancer(pg); await pg.wait_for_function("GG.M.pret", timeout=60000); await pg.wait_for_timeout(300)
        assert await pg.evaluate("GG.TR.recAlerte === true") and 'a changé depuis votre dernière visite' in (plat(await pg.inner_text('#page'))).replace('\xa0', ' ')
        await pg.click('[data-rec-ok]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("GG.TR.recAlerte === false && JSON.parse(localStorage.getItem('gg.reception_vue')).adresse === GG.R.reception.adresse")
        vert('adresse de reception changee depuis la derniere visite : une alerte sur le tableau, et rien ne part seul ; le chasseur la reconnait, l alerte tombe')
        # ---- la carte « Le roman » : l'empreinte gravee AEDE:livre:fr, le controle d'un EPUB depose et de la transaction de gravure
        await pg.evaluate("location.hash = '#/livres'"); await pg.wait_for_timeout(500)
        assert 'AEDE:livre:fr:' + LIVRE_SHA in plat(await pg.inner_text('#page'))
        await pg.set_input_files('#roman-fichier', atelier.epub_maitre()); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e !== 'att'", timeout=30000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ok'
        await pg.evaluate('GG.MP.roman = null'); await glisser(pdf, '#roman-depot'); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e", timeout=20000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ko' and 'pas un EPUB' in plat(await pg.evaluate("GG.MP.roman.d"))
        await pg.evaluate('GG.MP.roman = null'); await glisser(atelier.epub_maitre(), '#roman-depot'); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e !== 'att'", timeout=30000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ok' and pg.url.startswith(url0.split('#')[0])
        await pg.set_input_files('#roman-fichier', ep); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e !== 'att'", timeout=30000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ko'
        await pg.fill('#roman-tx', LTX); await pg.click('#roman-verifier'); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e !== 'att'", timeout=30000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ok'
        await pg.fill('#roman-tx', VTX); await pg.click('#roman-verifier'); await pg.wait_for_function("GG.MP.roman && GG.MP.roman.e !== 'att'", timeout=30000)
        assert await pg.evaluate("GG.MP.roman.e") == 'ko'
        vert('carte « Le roman » : l empreinte gravee du roman francais ; l EPUB du roman depose est reconnu, un autre fichier non ; la transaction de gravure est relue sur la chaine')
        # ---- l'accueil : quatre ecrans, la regle JAMAIS, et le choix du temoin, jamais presume
        await pg.evaluate("GG.R.temoin = null; localStorage.removeItem('gg.temoin'); location.hash = '#/reglages'"); await pg.wait_for_timeout(300)
        await pg.click('#r-accueil')
        for _ in range(3): await pg.click('#ac-suivant'); await pg.wait_for_timeout(150)
        txt = plat(await pg.inner_text('#accueil')); assert '4 / 4' in txt and 'JAMAIS' not in txt and 'vos 24 mots' in txt
        assert await pg.evaluate("document.getElementById('ac-suivant').disabled")
        await pg.click('[data-ac-temoin="1"]'); await pg.click('#ac-suivant'); await pg.wait_for_timeout(300)
        assert await pg.evaluate("GG.R.temoin === true && JSON.parse(localStorage.getItem('gg.temoin')) === true && document.getElementById('accueil').hidden")
        await pg.evaluate("location.hash = '#/chasser'"); await pg.wait_for_timeout(300)
        assert 'ne vous demandera jamais' in (plat(await pg.inner_text('#page'))).lower() and 'vos 24 mots' in plat(await pg.inner_text('#page'))
        vert('accueil : quatre ecrans ; la regle JAMAIS ; « Ouvrir » reste grise tant que le temoin n est pas choisi, puis le choix est garde ; JAMAIS aussi sur Chasser')
        # ---- sous la vraie politique de securite (pas de contournement) : le COFFRET s'ouvre, rien n'est refuse a tort
        ctx2 = await b.new_context(viewport={'width': 1400, 'height': 900})
        await ctx2.route(lambda u: not u.startswith('file:'), route)
        pg2 = await ctx2.new_page(); err2 = []; csp2 = []
        pg2.on('pageerror', lambda e: err2.append(str(e))); pg2.on('console', lambda m: csp2.append(m.text) if 'Content Security Policy' in m.text else None)
        await pg2.add_init_script(f"window.GG_ATELIER_CHAINE = {json.dumps(CH)}; window.GG_ATELIER_RELAIS = ['https://drand.test']; (function(){{ var d0 = Date.now.bind(Date), dec = {FAUX} * 1000 - d0(); Date.now = function(){{ return d0() + dec; }}; }})();"
                                  f"localStorage.setItem('gg.installe','true'); localStorage.setItem('gg.caisse', JSON.stringify('{CAISSE}')); localStorage.setItem('gg.explo', JSON.stringify('https://explo.test/api')); localStorage.setItem('gg.explo2', JSON.stringify('https://explo2.test/api')); localStorage.setItem('gg.temoin','false');")
        await pg2.goto(APP)
        for _ in range(180):
            if await pg2.evaluate("!!(window.GG && GG.MP && GG.MP.ouverts && Object.keys(GG.MP.ouverts).length >= 3)"): break
            await pg2.wait_for_timeout(500)
        assert await pg2.evaluate("Object.keys(GG.MP.ouverts).length >= 3 && GG.bip322 !== undefined") and not err2 and not csp2, (err2, csp2[:2])
        await ctx2.close()
        vert('sous la vraie politique de securite (script-src self, sans eval) : le verrou a date s ouvre, les signatures se verifient, aucune ressource refusee')
        # ---- une version epinglee (GG_ANCRE.adresse_auteur) : la signature du manifeste est exigee pour les chasses 0 et 1 (specification, paragraphe 7)
        app_ancre = atelier.copie_app(ancre={'adresse_auteur': GUICHET, 'chasse0': None, 'chasse1': None, 'secours': ['https://secours.test', 'http://pas.https.test']})
        ctx3 = await b.new_context(viewport={'width': 1400, 'height': 900}, bypass_csp=True)
        await ctx3.route(lambda u: not u.startswith('file:'), route)
        pg3 = await ctx3.new_page(); pg3.on('pageerror', lambda e: err.append(str(e)))
        await pg3.add_init_script(f"window.GG_ATELIER_CHAINE = {json.dumps(CH)}; window.GG_ATELIER_RELAIS = ['https://drand.test']; (function(){{ var d0 = Date.now.bind(Date), dec = {FAUX} * 1000 - d0(); Date.now = function(){{ return d0() + dec; }}; }})();"
                                  f"localStorage.setItem('gg.installe','true'); localStorage.setItem('gg.caisse', JSON.stringify('{CAISSE}')); localStorage.setItem('gg.explo', JSON.stringify('https://explo.test/api')); localStorage.setItem('gg.explo2', JSON.stringify('https://explo2.test/api')); localStorage.setItem('gg.temoin','false');")
        SIGS['on'] = False
        await pg3.goto(app_ancre + '#/chasse/0')
        await pg3.wait_for_function("GG.M.pret && GG.MP.grave && GG.CZ.grave", timeout=90000); await pg3.wait_for_timeout(1500)
        assert await pg3.evaluate("[GG.MP.grave, GG.CZ.grave, Object.keys(GG.MP.ouverts).length, Object.keys(GG.CZ.ouverts).length]") == ['signature', 'signature', 0, 0]
        assert await pg3.evaluate("GG.MP.adresseAncree") == GUICHET
        assert await pg3.evaluate("GG.secoursValides()") == ['https://secours.test']     # epingle a la construction (web_origines.txt) ; jamais en http
        vert('version epinglee, sans la signature du manifeste : ni le COFFRET de la chasse n° 1 ni celui de la chasse zero ne s ouvrent ; les messages s authentifient par l adresse epinglee')
        SIGS['on'] = True
        await pg3.reload(); await pg3.wait_for_function("GG.MP.grave === 'ok' && GG.CZ.grave === 'ok' && Object.keys(GG.MP.ouverts).length >= 3 && Object.keys(GG.CZ.ouverts).length >= 12", timeout=120000)
        vert('la signature BIP-322 du manifeste (servie par la librairie) : les deux COFFRETS s ouvrent')
        await ctx3.close()
        assert not err, err; vert('aucune erreur JavaScript')
        await b.close()
    print(f'\nBANC GODGIFT CORE MASTERPIECE : {OK[0]} verts, 0 rouge')

asyncio.run(main())
