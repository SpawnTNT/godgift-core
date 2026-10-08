# -*- coding: utf-8 -*-
"""BANC DU POINT 13 : CREER, ANNONCER ET DECOUVRIR UNE CHASSE (atelier, jamais sur la Cave). Valeurs FACTICES.

Une chasse n° 2 SIMULEE, de bout en bout :
  1. la Cave (pupitre, dossier temporaire) : parametrage ; la chasse zero (carnet, semis, gravure de son manifeste : elle
     prouve l'adresse des messages de l'auteur) ; puis la chasse n° 2 : definition (tuile « Creer une chasse »), carnet,
     semis avec COFFRET et cris, gravure de l'annonce (mode 26, choix 7) et signature (mode 28, [a]) ;
  2. la librairie (la vraie, dans ce processus ; registre de chasses.py vide au depart, comme sur une autre machine) :
     installation, chasse zero, carte « Annonce de chasse », /api/chasses.json, routes de la chasse n° 2, publication
     a l'heure, pages publiques FR et EN, redemarrage ;
  3. GodGift Core dans un vrai Chromium (faux monde : chaine drand d'essai, librairie reelle derriere une interception,
     serveur de secours factice, deux explorateurs factices qui portent les transactions signees par la Cave, horloge
     simulee) : sans ancre de l'adresse de l'auteur, il ne retient rien ; avec elle, il decouvre seul la chasse n° 2, la
     verifie, ouvre son COFFRET a l'heure, et la bonne reponse redonne la cle du coffre 1, distincte des chasses 0 et 1.
Puis les FAUX, refuses chacun par son controle (Cave, librairie, GodGift Core) ; une librairie piratee qui noie sa liste ;
et deux annonces valides d'un meme numero : la plus ancienne gravure gagne.
Lancement : python3 test_chasses_annoncees.py   (quelques minutes : scrypt 1 Gio, verrous a date)"""
import sys
sys.dont_write_bytecode = True                   # avant tout import de la Cave : le banc n'ecrit rien dans 03_CAVE_STONE_5 (pas de __pycache__)
import asyncio, base64, calendar, contextlib, hashlib, http.client, io, json, os, re, shutil, tempfile, threading, time, urllib.parse, urllib.request
ICI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ICI)
import atelier                                   # les chemins (trousse ou paquet maitre) et la copie de app/ qu'expose l'interieur
CAVE = atelier.CAVE
LIB = atelier.LIBRAIRIE
sys.path.insert(0, CAVE)
os.environ['AEDE_JOURNAL'] = '0'
# les donnees de la Cave (reglages, journal, carnets, definitions des chasses...) : dans leur propre dossier, jamais celui d'une vraie Cave
T = tempfile.mkdtemp(prefix='aede_point13_'); DON = os.path.join(T, 'LA_CAVE_DONNEES')
os.environ['LA_CAVE_DONNEES'] = DON
import stone5_v1g as S, pupitre_v1g as PU, coffret_v1 as C, verrou_a_date as V, chasses as H
import cle_coffre_v1g as K
from py_ecc.optimized_bls12_381 import G2, multiply
from py_ecc.bls.hash_to_curve import hash_to_G1
from py_ecc.bls.point_compression import compress_G1
from embit import bip32, script as escript
from embit.transaction import Transaction, TransactionInput, TransactionOutput
from playwright.async_api import async_playwright

SANS_ANCRE = {'chasse0': None, 'chasse1': None, 'adresse_auteur': None, 'secours': []}   # une version qui n'epingle rien (la bêta d'avant le 8 octobre) : le monde simule a son propre auteur
APP = atelier.copie_app(ancre=SANS_ANCRE)
def plat(s): return s.replace('\u2019', "'").replace('\xa0', ' ')   # la typographie francaise (apostrophe, espace insecable) des textes
F = S.F
F._reseau_actif = lambda *a, **k: (False, '')    # l'atelier a un reseau : le controle de la Cave (audit cave I8) est neutralise ici, comme dans banc_pupitre_v1g.py
OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)
def script(*rep):
    it = iter(rep)
    return lambda invite='': next(it)
def muet(f, *a, **k):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        r = f(*a, **k)
    return r, out.getvalue()
def utc(*t): return calendar.timegm(t + (0,) * (6 - len(t)))

# ====================================================================== 1. LA CAVE
print('1. La Cave')
CLE = os.path.join(T, 'cle'); os.makedirs(CLE)
CLE_SECOURS = os.path.join(T, 'secours'); os.makedirs(CLE_SECOURS)   # la cle de SECOURS du carnet : la fin de chaque semis y ecrit sa copie (audit N4)
S.DOSSIER_DONNEES = DON; PU.ICI = T              # le programme (la Pierre a cote) dans T ; ses donnees dans T/LA_CAVE_DONNEES
PU.systeme_de_fichiers = lambda chemin: 'vfat'        # la cle du banc est un dossier : on la dit FAT32, comme banc_pupitre_v1g.py
PU.cles_montees = lambda: [CLE, CLE_SECOURS]
# la Pierre que publie la librairie de ce banc (static/), celle qu'elle exige dans un manifeste : entre une retouche de 01_PIERRE et la
# resynchronisation par l'atelier (librairie, Cave), c'est elle qui fait foi pour l'accord Cave-librairie que ce banc eprouve
shutil.copy(os.path.join(LIB, 'static', 'PIERRE_DU_PROGRAMME_V1j.md'), T)
EMP_PIERRE = hashlib.sha256(open(os.path.join(T, 'PIERRE_DU_PROGRAMME_V1j.md'), 'rb').read()).hexdigest()
# une chaine drand d'essai : sa cle est connue de l'atelier seulement
SK = int.from_bytes(hashlib.sha256(b'AEDE banc point 13').digest(), 'big') % (2 ** 254)
PK = V._g2_octets(multiply(G2, SK)).hex()
CH = dict(V.QUICKNET, public_key=PK, hash=hashlib.sha256(bytes.fromhex(PK)).hexdigest(), groupHash='00' * 32, metadata={'beaconID': 'essai'})
V.QUICKNET = CH                                  # la Cave verrouille, la librairie verifie, sur la chaine d'essai
def signature(r): return compress_G1(multiply(hash_to_G1(V._identite(r), V.DST_G1, hashlib.sha256), SK)).to_bytes(48, 'big').hex()

GRAINE = hashlib.sha256(b'FAUSSE graine librairie point 13').digest()
MOTS = S.mots_depuis_entropie(hashlib.sha256(b'FAUX auteur point 13').digest())
CODE = 'la vouivre annonce une chasse nouvelle'
CODE_B = 'b0n code B 13579'                          # dix caracteres au moins, et pas la phrase (audit cave I13)
r0, _ = muet(PU.mode_24_parametrer, script('e', ' '.join(GRAINE.hex()[i:i + 8] for i in range(0, 64, 8)), hashlib.sha256(GRAINE).hexdigest()[:8],
                                           'e', ' '.join(MOTS), CODE, CODE, CODE_B, CODE_B))
KP = C.cle_phrase_carnet(CODE)                   # la cle du carnet tiree de la phrase (le carnet est scelle graine ET phrase)
ROOT = bip32.HDKey.from_seed(GRAINE)
def sc_guichet(i): return escript.p2wpkh(ROOT.derive(f"m/84h/0h/0h/3/{i}").key.get_public_key()).data
GUICHET0 = S.adresse_guichet(r0['zpub_librairie'], 0)
L = C.liste()
TXS = {}                                         # le faux explorateur : txid -> transaction (hex signe, ou forme deja lue)
def retenir_tx(hx, confirmee=True, temps=None):
    d = F.decoder_tx(hx); txid = F.txid_de(d['version'], d['entrees'], d['sorties'], d['locktime'])
    TXS[txid] = {'vin': [(e['txid'], e['vout']) for e in d['entrees']], 'vout': [{'scriptpubkey': s['script'].hex(), 'value': s['montant']} for s in d['sorties']],
                 'confirmee': confirmee, 'temps': temps}
    return txid
def utxo_guichet(i, montant, graine):
    t = Transaction(vin=[TransactionInput(hashlib.sha256(graine).digest(), 0)], vout=[TransactionOutput(montant, escript.Script(sc_guichet(i)))])
    retenir_tx(t.serialize().hex(), temps=utc(2026, 10, 1))
    return {'txid': t.txid().hex(), 'vout': 0, 'tx_hex': t.serialize().hex(), 'chemin': [3, i]}

# ---- la chasse zero : elle prouve l'adresse des messages de l'auteur (son manifeste est grave)
Z0 = {k: [4990 - 3 * (k - 1) - j for j in range(3)] for k in range(1, 7)}
saisies = []
for k in range(1, 7):
    saisies += ['o', str(k), 'm', 'c', ' '.join(L[x] for x in Z0[k]), 'OUI', 't', f'Galop {k} : kwyx zorbh', 'r']
for c in range(1, 4):                            # les deux indices de chaque coffre : l'indice fort (J+30) et le second (J+182)
    saisies += ['x', str(c), 'f', f'Indice fort {c} : qrumf', '', 'OUI', 's', f'Second indice {c} : plonx', '', 'OUI', 'r']
saisies += ['v', 'q']
faites, sortie = muet(PU.mode_29_carnet, None, script(CODE, *saisies), chasse=0)
assert faites == 6 and 'le carnet est pret pour le semis' in sortie, sortie[-600:]
json.dump(utxo_guichet(400, 800_000, b'amont 400'), open(os.path.join(CLE, 'amorce_chasse0_utxo.json'), 'w'))
man0, _ = muet(PU.mode_30_chasse_zero, CLE, script('s', CODE, '74600', '74600', 'SEME', *(['OUI'] * 3), '2'), imprimer=lambda ps, jeu: None, hygiene=lambda: [])
AM0 = retenir_tx(man0['amorce']['hex'], temps=utc(2026, 10, 20))
json.dump({'txid': AM0, 'vout': man0['amorce']['vout_rendu'], 'tx_hex': man0['amorce']['hex'], 'chemin': [3, 900]}, open(os.path.join(CLE, 'gravure_utxo.json'), 'w'))
g0, _ = muet(PU.mode_26_graver, CLE, script('5', '', CODE, 'GRAVE'))
G0 = retenir_tx(g0['hex'], temps=utc(2026, 10, 21))
MAN0_TXT = open(os.path.join(CLE, 'manifeste_chasse0.json'), encoding='utf-8').read(); COF0_TXT = open(os.path.join(CLE, 'COFFRET_CHASSE0_V1.json'), encoding='utf-8').read()
assert man0['messages']['adresse'] == GUICHET0 and TXS[G0]['vout'][0]['scriptpubkey'].endswith(('AEDE:manifeste:' + hashlib.sha256(MAN0_TXT.encode()).hexdigest()).encode().hex())
vert('chasse zero semee et son manifeste grave (il porte l adresse des messages de l auteur, guichet 3/0)')

# ---- la chasse n° 2 : sa definition, par la tuile « Creer une chasse » (mode 31)
DEF2 = H.nouvelle_definition(2, 'La chasse du printemps', ['pierre', 'cathedrale'], [150, 400], 2027, 3, False)
d, sortie = muet(PU.mode_31_chasses, CLE, script('n', '2', 'La chasse du printemps', '2', 'c', 'p c', '150 400', '2027', '3', 'u', CODE, 'CREE'))
F2 = os.path.join(DON, 'chasses', 'chasse_2.json')
assert d == DEF2 and open(F2, encoding='utf-8').read() == H.texte_definition(DEF2) == open(os.path.join(CLE, 'chasse_2.json'), encoding='utf-8').read()
assert 'CHASSE N 2 : La chasse du printemps' in sortie and 'amorce 3/10160, rendu 3/10200' in sortie and 'cathedrale 4 mots' in sortie and H.CHASSES[2] == DEF2
vert('tuile Creer une chasse : definition demandee, verifiee, affichee (coffres, calendrier, guichet 3/10160 et 3/10200), ecrite sur la carte et sur la cle (public)')
for saisie, motif in ((['1'], 'fondees par la Pierre'), (['1000'], 'fondees par la Pierre'), (['2'], 'existe deja'),
                      (['3', 'Zero', '0', 'p', '100', '2027', '1', 'u'], 'nombre de coffres'),
                      (['3', 'Trop', '49', 'p', '100', '2027', '1', 'u'], 'nombre de coffres'),
                      (['3', 'Inconnu', '2', 'c', 'p x', '100', '2027', '1', 'u'], 'types'),
                      (['3', 'Treize', '1', 'p', '100', '2027', '13', 'u'], 'mois de depart')):
    r, sortie = muet(PU.mode_31_chasses, CLE, script('n', *saisie))
    assert r is None and motif in sortie and not os.path.exists(os.path.join(DON, 'chasses', 'chasse_3.json')), (saisie, sortie[-300:])
vert('FAUX en Cave : chasse 1, chasse 1000, numero deja pris, 0 coffre, 49 coffres, type inconnu, mois 13 : refuses, rien n est ecrit')
# ---- son carnet (tuile, [o], [e]) : coffre 1 de pierre (3 mots), coffre 2 cathedrale (4 mots)
P2 = {1: [4500, 4502, 4504], 2: [4506, 4508, 4510], 3: [4512, 4514, 4516, 4518], 4: [4520, 4522, 4524, 4526]}
saisies = [CODE]
for k in range(1, 5):
    saisies += ['o', str(k), 'm', 'c', ' '.join(L[x] for x in P2[k]), 'OUI', 't', f'Printemps {k} : kwyx zorbh vlaqt', 'r']
for c in (1, 2):
    saisies += ['x', str(c), 'f', f'Indice du printemps {c} : qrumf', '', 'OUI', 's', f'Second indice du printemps {c} : plonx', '', 'OUI', 'r']
saisies += ['v', 'q']
faites, sortie = muet(PU.mode_31_chasses, CLE, script('o', 'e', *saisies))
assert faites == 4 and 'le carnet est pret pour le semis' in sortie and 'ENIGME 3 : coffre 2 (cathedrale), le 3, 4 mots' in sortie, sortie[-500:]
c0 = C.ouvrir_carnet(GRAINE, KP, chasse=0); c0['enigmes']['1']['mots'][0] = P2[3][1]
assert any('sert deja dans la chasse n 2' in x for x in C.conflits_brules(c0, C.mots_brules(GRAINE, KP, 0)))
vert('carnet de la chasse n° 2 (4 enigmes : 3 puis 4 mots, 2 indices par coffre), scelle a part (graine et phrase) ; ses mots sont brules pour la chasse zero')
# ---- le guichet, sur le PC (preparer_guichet.py --definition) : l'amorce de la chasse n° 2 se paie depuis 3/10160, et seulement de la
sys.path.insert(1, os.path.join(LIB, '..', 'outils'))
import preparer_guichet as PG
ici_avant = os.getcwd(); os.chdir(tempfile.mkdtemp(prefix='aede_point13_pc_'))
try:
    for idx, attendu in ((10161, 1), (10160, 0)):
        u = utxo_guichet(idx, 900_000, b'pc %d' % idx); PG.lire_tx = lambda e, t_, hx=u['tx_hex']: hx
        sys.argv = ['preparer_guichet.py', r0['zpub_librairie'], u['txid'], '0', '--index', str(idx), '--pour', 'amorce', '--definition', F2]
        code = 0
        try:
            muet(PG.main)
        except SystemExit as x:
            code = x.code
        assert code == attendu, (idx, code)
    assert json.load(open('amorce_chasse2_utxo.json'))['chemin'] == [3, 10160]
finally:
    os.chdir(ici_avant)
vert('sur le PC, preparer_guichet.py --definition chasse_2.json : amorce_chasse2_utxo.json pour le guichet 3/10160 ; 3/10161 refuse')
# ---- son semis : amorce au guichet 3/10160 (tout autre index refuse), COFFRET, cris
json.dump(utxo_guichet(10161, 900_000, b'amont 10161'), open(os.path.join(CLE, 'amorce_chasse2_utxo.json'), 'w'))
try:
    muet(PU.mode_31_chasses, CLE, script('o', 's', CODE, '74600', '74600', 'SEME', 'OUI', 'OUI'), imprimer=lambda ps, jeu: None, hygiene=lambda: []); raise AssertionError('amorce 3/10161 acceptee')
except (S.Refus, SystemExit) as x:
    assert '3/10160' in str(x)
json.dump(utxo_guichet(10160, 900_000, b'amont 10160'), open(os.path.join(CLE, 'amorce_chasse2_utxo.json'), 'w'))
IMP = {}
man2, sortie = muet(PU.mode_31_chasses, CLE, script('o', 's', CODE, '74600', '74600', 'SEME', 'OUI', 'OUI', '2'), imprimer=lambda ps, jeu: IMP.__setitem__(jeu, ps), hygiene=lambda: [])
MAN2_TXT = open(os.path.join(CLE, 'manifeste_chasse2.json'), encoding='utf-8').read(); COF2_TXT = open(os.path.join(CLE, 'COFFRET_CHASSE2_V1.json'), encoding='utf-8').read()
EMP2 = hashlib.sha256(MAN2_TXT.encode()).hexdigest()
assert json.loads(MAN2_TXT) == man2 and man2['chasse'] == 2 and man2['annee_A'] == 2027 and man2['definition'] == DEF2 and man2['empreinte_pierre'] == EMP_PIERRE
assert [(c['n'], c['type'], c['euros_depart']) for c in man2['coffres']] == [(1, 'pierre', 150), (2, 'cathedrale', 400)] and man2['messages']['adresse'] == GUICHET0
am = F.decoder_tx(man2['amorce']['hex'])
assert man2['amorce']['vout_rendu'] == 4 and am['sorties'][4]['script'] == sc_guichet(10200) and man2['coffret']['sha256'] == hashlib.sha256(COF2_TXT.encode()).hexdigest()
assert sorted(IMP) == ['AUTEUR', 'DEPOSITAIRE'] and 'choix 7' in sortie, (sorted(IMP), sortie[-400:])
AM2 = retenir_tx(man2['amorce']['hex'], temps=utc(2027, 1, 20))
vert('semis de la chasse n° 2 : amorce au guichet 3/10160 (3/10161 refuse), rendu 3/10200, 2 cris, 2 coffres ; manifeste avec sa definition et l empreinte de la Pierre ; 2 jeux de cris imprimes (AUTEUR, DEPOSITAIRE)')
# ---- son COFFRET : chaque verrou a l'heure de chasses.py ; le cri et les mots redonnent l'adresse ; aucune autre chasse ne l'ouvre
cof2 = json.loads(COF2_TXT); ALEAS2 = {}
assert cof2['chasse'] == 2 and sorted(e['type'] for e in cof2['elements']) == ['cri'] * 2 + ['enigme'] * 4 + ['indice'] * 4
H.controler_coffret(COF2_TXT, man2, CH)
for e in cof2['elements']:
    prevue = H.heure_element(2, e)
    assert e['ronde'] == V.ronde_a(CH, prevue) and prevue <= e['ouverture_utc'] < prevue + 3
    clair = json.loads(V.ouvrir(e['verrou'], signature(e['ronde'])))
    if e['type'] == 'cri':
        dn = F.decoder_tx(clair['hex']); s0 = dn['sorties'][0]['script']; donnees = s0[s0.index(b'AEDE:'):].decode()
        assert donnees.startswith(f"AEDE:cri:H2:{e['coffre']}:") and dn['locktime'] == H.heure_enigme(2, e['coffre'], 17)
        ALEAS2[e['coffre']] = donnees.split(':')[4]
assert H.heure_prevue(2, 'enigme', 1, 1) == utc(2027, 3, 3, 18, 15, 5) and H.heure_prevue(2, 'cri', 2) == utc(2027, 4, 17, 19, 15, 5)
for c in (1, 2):
    a = man2['coffres'][c - 1]['adresse']
    assert K.adresse_coffre(c, P2[2 * c - 1], P2[2 * c], ALEAS2[c], chasse=2) == a
    if c == 1:                                   # le coffre 1 est de pierre dans les trois chasses : memes mots, meme alea, autres cles
        assert K.adresse_coffre(c, P2[2 * c - 1], P2[2 * c], ALEAS2[c], chasse=0) != a and K.adresse_coffre(c, P2[2 * c - 1], P2[2 * c], ALEAS2[c]) != a
ADR2 = man2['coffres'][0]['adresse']
vert('COFFRET de la chasse n° 2 : 4 enigmes, 2 cris, 4 indices (aucune solution), chacun a sa seconde (mars et avril 2027), lu selon la regle de la Cave ; cri + mots = adresse ; ni la chasse 0 ni la 1 ne l ouvrent')
# ---- l'annonce : gravee depuis le rendu de l'amorce (mode 26, choix 7), puis signee (mode 28, [a])
json.dump({'txid': AM2, 'vout': 4, 'tx_hex': man2['amorce']['hex'], 'chemin': [3, 10200]}, open(os.path.join(CLE, 'gravure_utxo.json'), 'w'))
TEXTE2 = 'AEDE:chasse:2:' + EMP2
# le texte d'une fausse signature : TEXTE2 au dernier caractere change (jamais egal a TEXTE2, meme quand EMP2 finit deja par 'f')
TEXTE2_FAUX = TEXTE2[:-1] + ('e' if TEXTE2.endswith('f') else 'f')
assert TEXTE2_FAUX != TEXTE2
g2, sortie = muet(PU.mode_26_graver, CLE, script('7', '', CODE, 'GRAVE'))
dg = F.decoder_tx(g2['hex'])
assert dg['sorties'][0]['script'] == b'\x6a\x4c' + bytes([len(TEXTE2)]) + TEXTE2.encode() and len(TEXTE2) == 78 and g2['index_rendu'] == 10201
GR2 = retenir_tx(g2['hex'], temps=utc(2027, 2, 1))
ann, sortie = muet(PU.mode_28_message, CLE, script('a', 'SIGNE', CODE))
ANN2_TXT = open(os.path.join(CLE, 'annonce_chasse2.json'), encoding='utf-8').read()
assert json.loads(ANN2_TXT) == ann and ann['texte'] == TEXTE2 and ann['chasse'] == 2 and ann['empreinte_manifeste'] == EMP2 and ann['adresse'] == GUICHET0 and ann['txid_gravure'] == GR2
assert S.verifier_bip322(GUICHET0, TEXTE2, ann['signature']) and not S.verifier_bip322(GUICHET0, 'AEDE:message:2027-02-01:' + TEXTE2, ann['signature'])
vert('annonce gravee (AEDE:chasse:2:<empreinte>, 78 octets, rendu au guichet 3/10201) puis signee BIP-322 par l adresse des messages, sans date ; le txid de la gravure est dans le fichier')
assert not S.garde(ANN2_TXT + MAN2_TXT + open(F2).read())
vert('regle D6 : rien de secret dans l annonce, le manifeste ni la definition (garde de fuite)')

# ====================================================================== 2. LA LIBRAIRIE
print('2. La librairie')
H.oublier_suivantes(); assert H.suivantes() == []        # une autre machine : la librairie ne connait la chasse n° 2 que par son annonce
sys.path.insert(1, LIB)
import web, coffret as CF, magasin
os.environ['AEDE_HORLOGE'] = str(utc(2027, 2, 2))
DOSSIER = tempfile.mkdtemp(prefix='aede_point13_librairie_')
SRV = web.demarrer(DOSSIER, port=0, hote='127.0.0.1', balayage=False); PORT = SRV.server_address[1]
threading.Thread(target=SRV.serve_forever, daemon=True).start()
class Client:
    def __init__(self): self.jar = {}
    def req(self, meth, chemin, corps=None, entetes=None):
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=120)
        h = {'Host': f'127.0.0.1:{PORT}', **(entetes or {})}
        if self.jar: h['Cookie'] = '; '.join(f'{k}={v}' for k, v in self.jar.items())
        if isinstance(corps, dict):
            corps = urllib.parse.urlencode(corps); h['Content-Type'] = 'application/x-www-form-urlencoded'
        c.request(meth, chemin, body=corps, headers=h)
        r = c.getresponse(); b = r.read()
        for v in r.headers.get_all('Set-Cookie') or []:
            k, _, rest = v.partition('='); self.jar[k] = rest.split(';')[0]
        return r.status, dict(r.headers), b
    def get(self, p): return self.req('GET', p)
    def post(self, p, d): return self.req('POST', p, d)
def multipart(champs):
    bd = 'XXaedeXX'; out = b''
    for k, v in champs.items():
        out += f'--{bd}\r\nContent-Disposition: form-data; name="{k}"; filename="{k}.json"\r\n\r\n'.encode() + v.encode() + b'\r\n'
    return out + f'--{bd}--\r\n'.encode(), f'multipart/form-data; boundary={bd}'
pub, adm = Client(), Client()
JETON = open(os.path.join(DOSSIER, 'JETON_INSTALLATION.txt')).read().strip()
st, h_, _ = pub.post('/installer', {'jeton': JETON, 'nom_librairie': 'Librairie du point 13', 'langue': 'fr', 'mdp': 'un mot de passe long', 'fiche': PU.fiche_caisse(r0),
                                     'base_url': f'http://127.0.0.1:{PORT}', 'source_url': ''})
assert st == 303, st
adm.post('/admin/connexion', {'mdp': 'un mot de passe long'})
_, _, b = adm.get('/admin'); CSRF = re.search(rb'name="csrf" value="([^"]+)"', b).group(1).decode()
assert b'Annonce de chasse' in b and b'class="aide"' in b
def poster(action, champs):
    corps, typ = multipart(dict(champs, csrf=CSRF))
    return adm.req('POST', '/admin/' + action, corps, {'Content-Type': typ})[2].decode()
def annoncer(annonce=ANN2_TXT, definition=None, manifeste=MAN2_TXT, coffret='', txid=''):
    return poster('annonce', {'annonce': annonce, 'definition': definition if definition is not None else H.texte_definition(DEF2), 'manifeste': manifeste, 'coffret': coffret, 'txid': txid})
mag = web.Poste.app.mag
# avant tout manifeste grave : pas d'adresse d'auteur, rien n'est accepte
assert 'chargez d abord le manifeste grave' in annoncer() and not CF.annonces(mag)
_b = poster('manifeste', {'fichier': MAN0_TXT}); assert 'Manifeste de la chasse zéro chargé' in plat(_b), re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', _b.split('</style>')[-1]))[:900]
_b = poster('coffret', {'fichier': COF0_TXT}); assert f"chasse zéro chargé : {len(json.loads(COF0_TXT)['elements'])} verrous" in plat(_b), re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', _b.split('</style>')[-1]))[:900]
poster('secours', {'url': 'https://secours.test'})
vert('librairie installee (fiche de la Cave), chasse zero chargee : son manifeste porte l adresse des messages ; sans lui, aucune annonce n est acceptee')

# ---- les FAUX, refuses par la librairie, chacun par son controle (rien n'est garde)
K_AUT = S._cle_bip84(GRAINE, 3, 0)                     # la cle de l'adresse des messages (banc seulement : la Cave la garde)
K_AUTRE = int.from_bytes(hashlib.sha256(b'une autre cle').digest(), 'big')
ADR_AUTRE = K.adresse_B(F.cle_publique_compressee(K_AUTRE))
def annonce(texte, sig=None, adresse=GUICHET0, txid=GR2, h=None, emp=None):
    m = H.RE_ANNONCE.fullmatch(texte)
    return json.dumps({'annonce': 'AEDE-v1', 'chasse': h if h is not None else (int(m.group(1)) if m else 2), 'texte': texte,
                       'empreinte_manifeste': emp or (m.group(2) if m else EMP2), 'adresse': adresse,
                       'signature': sig if sig is not None else C.signer_bip322(K_AUT, texte), 'txid_gravure': txid})
def defi(**k): return json.dumps(dict(DEF2, **k))
autre_sig = json.loads(annonce(TEXTE2)); autre_sig['signature'] = C.signer_bip322(K_AUT, TEXTE2_FAUX); autre_sig = json.dumps(autre_sig)
FAUX_LIB = [
    ('signature fausse', annonce(TEXTE2, sig=C.signer_bip322(K_AUT, TEXTE2_FAUX)), {}, 'signature BIP-322 invalide'),
    ('signature par une autre cle (son adresse)', annonce(TEXTE2, sig=C.signer_bip322(K_AUTRE, TEXTE2), adresse=ADR_AUTRE), {}, 'pas signee par l adresse des messages'),
    ('signature par une autre cle (adresse de l auteur)', annonce(TEXTE2, sig=C.signer_bip322(K_AUTRE, TEXTE2)), {}, 'signature BIP-322 invalide'),
    ('manifeste dont l empreinte ne correspond pas', ANN2_TXT, {'manifeste': MAN2_TXT + ' '}, 'empreinte SHA-256 differente'),
    ('chasse 0', annonce('AEDE:chasse:0:' + EMP2), {}, 'pas une annonce de chasse'),
    ('chasse 1', annonce('AEDE:chasse:1:' + EMP2), {}, 'pas une annonce de chasse'),
    ('chasse 1000', annonce('AEDE:chasse:1000:' + EMP2), {}, 'pas une annonce de chasse'),
    ('definition : 0 coffre', ANN2_TXT, {'definition': defi(coffres=0, types=[], euros=[])}, 'nombre de coffres'),
    ('definition : 49 coffres', ANN2_TXT, {'definition': defi(coffres=49, types=['pierre'] * 49, euros=[1] * 49)}, 'nombre de coffres'),
    ('definition : type inconnu', ANN2_TXT, {'definition': defi(types=['pierre', 'tour'])}, 'types'),
    ('definition : mois 13', ANN2_TXT, {'definition': defi(mois=13)}, 'mois de depart'),
    ('definition d une autre chasse', ANN2_TXT, {'definition': json.dumps(H.nouvelle_definition(3, 'Autre', ['pierre'], [5], 2027, 3, False))}, 'celle de la chasse 3'),
    ('txid de gravure absent', annonce(TEXTE2, txid=''), {}, 'txid de la gravure'),
    ('COFFRET d une autre chasse', ANN2_TXT, {'coffret': COF0_TXT}, 'celui de la chasse 0'),
]
for nom, a_, champs, motif in FAUX_LIB:
    b = annoncer(annonce=a_, **champs)
    assert motif in b and not CF.annonces(mag) and not mag.lire('manifeste_c2') and 2 not in H.CHASSES, (nom, re.sub(r'<[^>]+>', ' ', b)[-400:])
vert(f'FAUX refuses par la librairie, rien n est garde ({len(FAUX_LIB)}) : ' + ' ; '.join(n for n, *_ in FAUX_LIB))

# ---- la bonne annonce : verifiee, publiee, son COFFRET charge
b = annoncer(coffret=COF2_TXT)
assert 'Annonce de la chasse n° 2 (La chasse du printemps) vérifiée et publiée' in plat(b) and 'COFFRET chargé : 10 verrous' in plat(b), re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', b.split('</style>')[-1]))[:900]
assert H.CHASSES[2] == DEF2 and mag.lire('manifeste_texte_c2') == MAN2_TXT
st, _, b = pub.get('/api/chasses.json'); lst = json.loads(b)
assert st == 200 and lst == [{'numero': 2, 'texte': TEXTE2, 'signature': ann['signature'], 'adresse': GUICHET0, 'txid_gravure': GR2, 'empreinte_manifeste': EMP2}], lst
assert pub.get('/api/chasse/2/manifeste.json')[2].decode() == MAN2_TXT and pub.get('/api/chasse/2/coffret.json')[2].decode() == COF2_TXT
assert json.loads(pub.get('/api/chasse/2/publications.json')[2])['a_venir'] and pub.get('/api/chasse/3/manifeste.json')[0] == 404
vert('carte Annonce de chasse : signature, empreinte, definition verifiees ; /api/chasses.json (numero, texte, signature, adresse, txid, empreinte) ; /api/chasse/2/(manifeste|coffret|publications).json')
# meme numero, autre manifeste : refuse ; plus de 100 : voir plus bas ; la meme annonce rechargee ne change rien
man_b = dict(man2); man_b['coffres'] = [dict(man2['coffres'][0], adresse=S.adresse_guichet(r0['zpub_librairie'], 7)), man2['coffres'][1]]
MANB_TXT = json.dumps(man_b, indent=1, ensure_ascii=False); EMPB = hashlib.sha256(MANB_TXT.encode()).hexdigest()
b = annoncer(annonce=annonce('AEDE:chasse:2:' + EMPB), manifeste=MANB_TXT)
assert 'deja annoncee avec un autre manifeste' in b and CF.annonces(mag)['2']['empreinte_manifeste'] == EMP2
_b = poster('manifeste', {'fichier': MANB_TXT})
assert 'manifeste : ce n est pas celui que l annonce de la chasse 2 designe' in plat(_b) and mag.lire('manifeste_texte_c2') == MAN2_TXT, re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', _b.split('</style>')[-1]))[:700]
assert 'vérifiée et publiée' in annoncer() and len(CF.annonces(mag)) == 1
vert('meme numero annonce deux fois avec deux manifestes : refuse (carte Annonce et carte Manifeste) ; la meme annonce rechargee ne change rien')
# ---- la publication a l'heure, comme pour la chasse zero
os.environ['AEDE_HORLOGE'] = str(utc(2027, 3, 17, 19, 25, 5))
ouv = CF.ouvrir_ce_qui_est_du(mag, None, signer=signature, maintenant=utc(2027, 3, 17, 19, 25, 5))
assert sorted(x for x in ouv if x[0] == 2) == [(2, 'cri', 1, 0), (2, 'enigme', 1, 1), (2, 'enigme', 1, 2)], ouv
pz = json.loads(pub.get('/api/chasse/2/publications.json')[2])
assert sorted((x['type'], x.get('numero')) for x in pz['ouverts']) == [('cri', None), ('enigme', 1), ('enigme', 2)] and pz['ouverts'][0]['contenu']
et = json.loads(pub.get('/api/etat.json')[2])
assert sorted(x['numero'] for x in et['chasses']['2']['enigmes']) == [1, 2] and [x['adresse'] for x in et['chasses']['2']['coffres']] == [c['adresse'] for c in man2['coffres']]
assert CF.ouvrir_ce_qui_est_du(mag, None, signer=signature, maintenant=utc(2027, 4, 3, 18, 15, 3)) == []
assert (2, 'enigme', 2, 3) in CF.ouvrir_ce_qui_est_du(mag, None, signer=signature, maintenant=utc(2027, 4, 3, 18, 15, 10))
vert('publication automatique : le 17 mars 2027 les enigmes 1 et 2 et le cri 1 de la chasse n° 2 s ouvrent ; rien avant l heure ; l enigme 3 le 3 avril')
# ---- les pages publiques, FR et EN
for lg, mots in (('fr', ['Les chasses', 'La chasse du printemps', 'Chasse n° 2', 'annoncée', TEXTE2, '/chasse/2']), ('en', ['The hunts', 'Hunt no. 2', 'announced', TEXTE2])):
    st, _, b = pub.get('/chasses?lang=' + lg); b = b.decode()
    assert st == 200 and all(m in b for m in mots) and 'class="aide"' in b, (lg, b[-800:])
st, _, b = pub.get('/chasse/2?lang=fr'); b = b.decode()
assert st == 200 and 'La chasse du printemps' in b and 'Printemps 1' in b and 'Printemps 3' in b and GR2 in b and ADR2 in b and '/api/chasse/2/publications.json' in b
st, _, b = pub.get('/chasse/2?lang=en'); assert st == 200 and b'The announcement, engraved and signed' in b and b'one chest a month' in b
assert pub.get('/chasse/7')[0] == 404 and pub.get('/chasse/0')[0] == 303 and pub.get('/chasse-zero')[0] == 200
pub.jar.pop('lang', None)
vert('pages publiques : « Les chasses » (FR et EN, bulle ?), la page de la chasse n° 2 (annonce, coffres, enigmes ouvertes) ; chasse inconnue : 404')
# ---- redemarrage : la chasse annoncee reprend sa place dans chasses.py
H.oublier_suivantes(); web.App(DOSSIER)
assert H.CHASSES[2] == DEF2 and H.heure_enigme(2, 2, 3) == utc(2027, 4, 3, 18, 15, 5)
vert('redemarrage de la librairie : la chasse n° 2 se reinscrit seule (registre de chasses.py), depuis ses annonces gardees')
# ---- plus de 100 chasses : la 101e est refusee (une autre librairie, d essai)
H_SAUVE = dict(H.CHASSES)
mag100 = magasin.Magasin(tempfile.mkdtemp(prefix='aede_point13_cent_')); CF.preparer(mag100); mag100.ecrire('manifeste_c0', json.loads(MAN0_TXT))
def synth(h):
    d = H.nouvelle_definition(h, f'Essai {h}', ['pierre'], [10], 2030, 1, False)
    m = {'pierre': 'V1g', 'chasse': h, 'annee_A': 2030, 'coffres': [{'n': 1, 'type': 'pierre', 'adresse': S.adresse_guichet(r0['zpub_librairie'], 1000 + h)}],
         'amorce': {'txid': 'ab' * 32}, 'messages': {'adresse': GUICHET0}, 'definition': d, 'empreinte_pierre': EMP_PIERRE}
    mt = json.dumps(m); return annonce('AEDE:chasse:%d:%s' % (h, hashlib.sha256(mt.encode()).hexdigest())), H.texte_definition(d), mt
for h in range(3, 103):
    CF.charger_annonce(mag100, *synth(h), zpub_librairie=r0['zpub_librairie'], empreinte_pierre=EMP_PIERRE)
try:
    CF.charger_annonce(mag100, *synth(103), zpub_librairie=r0['zpub_librairie'], empreinte_pierre=EMP_PIERRE); raise AssertionError('101e chasse acceptee')
except ValueError as x:
    assert 'deja 100 chasses annoncees' in str(x)
assert len(CF.annonces(mag100)) == 100 and len(CF.liste_annonces(mag100)) == 100
H.CHASSES.clear(); H.CHASSES.update(H_SAUVE)
vert('plus de 100 annonces : les 100 premieres acceptees, la 101e refusee')

# ====================================================================== 3. GODGIFT CORE, dans un vrai Chromium
print('3. GodGift Core')
HORLOGE = {'t': utc(2027, 3, 17, 19, 25, 5), 'reel': time.time()}      # dix minutes apres le cri du coffre 1 de la chasse n° 2
def maintenant_simule(): return HORLOGE['t'] + (time.time() - HORLOGE['reel'])
SECOURS = {'annonces': [], 'manifestes': {}}
# GodGift Core ne lit le serveur de secours que designe par un message signe de l'auteur (derniere ligne AEDE:secours:https://<hote>) ;
# l'adresse que la caisse annonce seule (poster('secours', ...)) ne suffit pas
_TS = 'Le serveur de secours de la vente.\nAEDE:secours:https://secours.test'
SECOURS_DESIGNE = {'message': 'AEDE-v1', 'adresse': GUICHET0, 'date': '2027-01-10', 'texte': _TS, 'signature': C.signer_bip322(K_AUT, 'AEDE:message:2027-01-10:' + _TS)}
PANNE = {'librairie': False}
LIB_PIRATEE = {'annonces': None}                 # une librairie piratee : sa propre liste /api/chasses.json (None : la vraie)
ANCRE = {'chasse0': None, 'chasse1': None, 'adresse_auteur': GUICHET0}   # l'ancre d'une version qui epingle l'adresse de l'auteur
def bloc_de(t): return 800000 + (t - utc(2026, 1, 1)) // 3600   # le faux explorateur : la hauteur suit l'heure (une gravure plus tot, un bloc plus bas)
def script_adr(a): return F.script_depuis_adresse(a)[0].hex()
def repondre(u, methode='GET', corps=None):
    p = urllib.parse.urlparse(u); hote, ch = p.netloc, p.path
    if hote == 'librairie.test':
        if PANNE['librairie']: return 503, 'panne'
        if ch == '/api/chasses.json' and LIB_PIRATEE['annonces'] is not None: return 200, json.dumps(LIB_PIRATEE['annonces'])
        if ch == '/api/messages.json':           # les messages de la librairie, plus la designation signee de son serveur de secours (Pierre, article 10)
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}{ch}', timeout=60) as r:
                return 200, json.dumps(json.loads(r.read().decode('utf-8')) + [SECOURS_DESIGNE])
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}{ch}' + (('?' + p.query) if p.query else ''), timeout=60) as r:
                return r.status, r.read().decode('utf-8')
        except urllib.error.HTTPError as ex:
            return ex.code, ex.read().decode('utf-8', 'replace')
    if hote == 'secours.test':
        if ch == '/sante': return 200, 'ok'
        if ch == '/api/chasses.json': return 200, json.dumps(SECOURS['annonces'])
        m = re.fullmatch(r'/api/chasse/(\d+)/manifeste\.json', ch)
        if m and m.group(1) in SECOURS['manifestes']: return 200, SECOURS['manifestes'][m.group(1)]
        return 404, '{}'
    if hote in ('explo.test', 'explo2.test'):
        ch = ch[4:] if ch.startswith('/api') else ch
        if ch == '/blocks/tip/height': return 200, '900000'
        if ch == '/v1/prices': return 200, json.dumps({'EUR': 60000})
        if ch == '/v1/fees/recommended': return 200, json.dumps({'fastestFee': 10, 'halfHourFee': 5})
        if ch == '/fee-estimates': return 200, json.dumps({'1': 12, '2': 8})
        m = re.fullmatch(r'/tx/([0-9a-f]{64})(?:/outspend/(\d+))?', ch)
        if m:
            if m.group(2) is not None:
                for t_, x in TXS.items():
                    if (m.group(1), int(m.group(2))) in x['vin']:
                        return 200, json.dumps({'spent': True, 'txid': t_, 'status': {'confirmed': x['confirmee'], 'block_hash': 'bb' * 32}})
                return 200, json.dumps({'spent': False})
            x = TXS.get(m.group(1))
            if not x: return 404, 'Transaction not found'
            st_ = {'confirmed': True, 'block_hash': 'bb' * 32, 'block_height': bloc_de(x['temps'] or utc(2027, 1, 1)), 'block_time': x['temps']} if x['confirmee'] else {'confirmed': False}
            return 200, json.dumps({'txid': m.group(1), 'vin': [{'txid': t_, 'vout': v_} for t_, v_ in x['vin']], 'vout': x['vout'], 'status': st_})
        m = re.fullmatch(r'/address/([a-z0-9]+)(/utxo|/txs|/txs/mempool)?', ch)
        if m:
            s_ = script_adr(m.group(1)); sorties = [(t_, i, o['value']) for t_, x in TXS.items() for i, o in enumerate(x['vout']) if o['scriptpubkey'] == s_ and x['confirmee']]
            if m.group(2) == '/utxo': return 200, json.dumps([{'txid': t_, 'vout': i, 'value': v, 'status': {'confirmed': True}} for t_, i, v in sorties])
            if m.group(2): return 200, '[]'
            return 200, json.dumps({'chain_stats': {'funded_txo_sum': sum(v for *_, v in sorties), 'spent_txo_sum': 0, 'spent_txo_count': 0, 'funded_txo_count': len(sorties)},
                                    'mempool_stats': {'funded_txo_sum': 0, 'spent_txo_sum': 0, 'spent_txo_count': 0}})
        return 404, '{}'
    if hote == 'drand.test':
        r = int(ch.rsplit('/', 1)[1])
        if V.instant_de(CH, r) > maintenant_simule(): return 425, '{}'
        s = signature(r); return 200, json.dumps({'round': r, 'signature': s, 'randomness': hashlib.sha256(bytes.fromhex(s)).hexdigest()})
    return 404, ''

def api(a):   # une annonce au format de /api/chasses.json (numero, texte, signature, adresse, txid_gravure, empreinte_manifeste)
    a = json.loads(a) if isinstance(a, str) else a
    return {'numero': a.get('chasse'), 'texte': a.get('texte'), 'signature': a.get('signature'), 'adresse': a.get('adresse'),
            'txid_gravure': a.get('txid_gravure'), 'empreinte_manifeste': a.get('empreinte_manifeste')}
def faux_tx(texte, confirmee=True, temps=None, vin=None):    # une transaction lue par les explorateurs : une seule sortie OP_RETURN ; par defaut
    # elle depense le rendu de l'amorce de la chasse n° 2 (comme la Cave l'impose), pour que chaque FAUX tombe sur le controle qu'il vise
    vin = [(AM2, 4)] if vin is None else vin; temps = temps or utc(2027, 2, 1)
    b = texte.encode(); txid = hashlib.sha256(b'faux ' + b + bytes([confirmee]) + json.dumps([temps, vin]).encode()).hexdigest()
    TXS[txid] = {'vin': [tuple(e) for e in vin], 'vout': [{'scriptpubkey': '6a' + ('4c' if len(b) > 75 else '') + bytes([len(b)]).hex() + b.hex(), 'value': 0}], 'confirmee': confirmee, 'temps': temps}
    return txid

async def main():
    async with async_playwright() as pw:
        nav = await pw.chromium.launch(args=['--js-flags=--max-old-space-size=4096'])
        ctx = await nav.new_context(viewport={'width': 1400, 'height': 900}, bypass_csp=True)
        async def route(r):
            st, corps = await asyncio.to_thread(repondre, r.request.url, r.request.method, r.request.post_data)
            await r.fulfill(status=st, body=corps, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'})
        await ctx.route(lambda u: not u.startswith('file:'), route)
        pg = await ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        await pg.add_init_script(f"window.GG_ATELIER_CHAINE = {json.dumps(CH)}; window.GG_ATELIER_RELAIS = ['https://drand.test'];"
                                 f"(function(){{ var d0 = Date.now.bind(Date), s = localStorage.getItem('atelier.dec'); window.__dec = s ? +s : {HORLOGE['t']} * 1000 - d0(); Date.now = function(){{ return d0() + window.__dec; }}; }})();"
                                 "localStorage.setItem('gg.installe','true'); localStorage.setItem('gg.caisse', JSON.stringify('https://librairie.test'));"
                                 "localStorage.setItem('gg.explo', JSON.stringify('https://explo.test/api')); localStorage.setItem('gg.explo2', JSON.stringify('https://explo2.test/api'));"
                                 "localStorage.setItem('gg.temoin','false'); localStorage.setItem('gg.lang','\"fr\"');"
                                 # l'ancre epinglee (gg_ancre.js ecrit this.GG_ANCRE apres ce script : on garde la main par un accesseur)
                                 "(function(){ var s = localStorage.getItem('atelier.ancre'); if (!s) return; var inj = JSON.parse(s), v = inj;"
                                 " Object.defineProperty(window, 'GG_ANCRE', { configurable: true, get: function () { return v; }, set: function (x) { v = Object.assign({}, x || {}, inj); } }); })();")
        await pg.goto(APP + '#/chasses')
        # ---- sans ancre de l'adresse de l'auteur (SANS_ANCRE : depuis le 8 octobre, gg_ancre.js epingle l'adresse 3/0 de l'auteur, etrangere a ce monde simule) : l'annonce est lue, rien n'est retenu
        await pg.wait_for_function("window.GG && GG.M.pret && !GG.ANN.enCours && GG.ANN.lues > 0", timeout=240000); await pg.wait_for_timeout(500)
        r = await pg.evaluate("[GG.ANN.auteur, GG.ANN.refus[2], !!GG.ZS[2], localStorage.getItem('gg.chasses_retenues'), (window.GG_ANCRE || {}).adresse_auteur || null]")
        assert r == [GUICHET0, 'ann_sans_ancre', False, None, None], r
        txt = plat(await pg.inner_text('#page'))
        assert "n'épingle pas encore l'adresse de l'auteur : les chasses suivantes s'afficheront avec la version qui l'épingle" in txt and '1 annonce(s) lue(s) · 0 chasse(s) suivie(s) · 1 refusée(s)' in txt, txt[:1500]
        await pg.evaluate("location.hash = '#/chasse/2'"); await pg.wait_for_timeout(400)
        assert "refuse cette chasse : en attente : cette version de GodGift Core n'épingle pas encore" in plat(await pg.inner_text('#page'))
        await pg.evaluate("location.hash = '#/chasses'")
        vert('sans ancre de l adresse de l auteur : l annonce de la chasse n° 2 est lue mais rien n est retenu (ann_sans_ancre), l alerte le dit')
        await pg.evaluate("(a) => localStorage.setItem('atelier.ancre', JSON.stringify(a))", ANCRE)
        await pg.reload()
        try:
            await pg.wait_for_function("window.GG && GG.ZS[2] && GG.ZS[2].coffret && Object.keys(GG.ZS[2].ouverts).length >= 3", timeout=240000)
        except Exception:
            print('ETAT :', await pg.evaluate("JSON.stringify([GG.ANN.auteur, GG.ANN.refus, GG.ANN.alertes, GG.ANN.lues, GG.ZS[0].grave, GG.ZS[2] && [GG.ZS[2].grave, GG.ZS[2].erreur, GG.ZS[2].erreurDetail, !!GG.ZS[2].coffret, Object.keys(GG.ZS[2].ouverts), GG.ZS[2].erreurDrand, GG.ZS[2].echecs]])"))
            raise
        assert await pg.evaluate('GG.ANN.auteur') == GUICHET0 and await pg.evaluate('JSON.stringify(GG.CHASSES[2])') == json.dumps(DEF2, separators=(',', ':'), ensure_ascii=False)
        assert await pg.evaluate('GG_ANCRE.adresse_auteur') == GUICHET0
        o = await pg.evaluate('Object.keys(GG.ZS[2].ouverts).sort()'); assert o == ['cri:1:0', 'enigme:1:1', 'enigme:1:2'], o
        assert await pg.evaluate("[JSON.parse(localStorage.getItem('gg.chasses_retenues'))['2'].empreinte_manifeste, JSON.parse(localStorage.getItem('gg.chasses_retenues'))['2'].bloc]") == [EMP2, bloc_de(utc(2027, 2, 1))]
        await pg.wait_for_timeout(500); txt = plat(await pg.inner_text('#page'))
        assert 'La chasse du printemps' in txt and 'chasse n° 2' in txt.lower() and 'annoncée' in txt.lower() and '1 annonce(s) lue(s) · 1 chasse(s) suivie(s)' in txt, txt[:1500]
        vert('GodGift Core decouvre seul la chasse n° 2 (/api/chasses.json) : adresse de l auteur prouvee par le manifeste grave de la chasse zero, signature, gravure confirmee (deux sources), manifeste et definition ; retenue localement ; « Les chasses » la montre')
        r = await pg.evaluate("""(function(){ var Z = GG.ZS[2];
            function refus(c) { var tx = JSON.stringify(c, null, 1), man = JSON.parse(JSON.stringify(Z.man)); man.coffret = { sha256: GGC.sha256hex(tx) }; return GG.refusCoffret(tx, { man: man }); }
            function cp() { return JSON.parse(JSON.stringify(Z.coffret)); }
            var c = cp(), e = c.elements.filter(function (x) { return x.type === 'cri'; })[1]; e.ronde -= 200000; e.ouverture_utc -= 200000 * Z.coffret.drand.period;
            var s = cp(); s.elements.push(Object.assign({}, s.elements[0], { type: 'solution', numero: undefined }));
            return [refus(cp()), refus(c), refus(s)]; })()""")
        assert r == [None, 'calendrier', 'solution'], r
        vert('COFFRET de la chasse n° 2 : la regle de lecture de la Cave (gg_regles.js) : empreinte du manifeste, reseau drand, chaque heure celle de chasses.py ; un cri avance, un element « solution » : refuses')
        await pg.evaluate("location.hash = '#/chasse/2'"); await pg.wait_for_timeout(800); txt = plat(await pg.inner_text('#page'))
        assert all(x in txt for x in ('La chasse du printemps', 'Printemps 1 : kwyx', 'Printemps 2 : kwyx', ADR2, TEXTE2, 'un coffre par mois')) and 'Printemps 3' not in txt, txt[:2000]
        assert await pg.evaluate('GG.courant().h') == 2 and await pg.input_value('#z-alea') == ALEAS2[1]
        vert('page de la chasse n° 2 (vue generale des chasses) : enigmes 1 et 2 ouvertes a l heure, enigme 3 encore scellee, adresses, annonce ; l alea du cri 1 lu dans le COFFRET')
        # ---- le COFFRET s'ouvre seul a l'heure : le 3 avril 2027, 18:15:05, l'enigme 3 paraît
        delta = utc(2027, 4, 3, 18, 15, 8) - maintenant_simule()
        HORLOGE['t'] += delta; await pg.evaluate(f"window.__dec += {delta} * 1000; localStorage.setItem('atelier.dec', String(window.__dec))")   # l'ecart d'horloge survit aux rechargements : rien d'ouvert n'est garde (audit I3), tout se rouvre a l'heure
        await pg.wait_for_function("GG.ZS[2].ouverts['enigme:2:3'] != null", timeout=90000)
        await pg.wait_for_timeout(600); assert 'Printemps 3 : kwyx' in plat(await pg.inner_text('#page')) and await pg.evaluate("GG.ZS[2].ouverts['enigme:2:4'] == null")
        vert('l horloge passe au 3 avril 2027 a 18:15:08 : l enigme 3 s ouvre seule (GodGift Core, sans la librairie), la 4 reste scellee')
        # ---- la cle du coffre 1, retrouvee avec la bonne reponse ; distincte des chasses 0 et 1
        await pg.select_option('#z-coffre', '1'); await pg.wait_for_timeout(200)
        await pg.fill('#z-r3', ' '.join(L[x] for x in P2[1])); await pg.fill('#z-r17', ' '.join(str(x) for x in P2[2])); await pg.fill('#z-alea', ALEAS2[1])
        await pg.click('#z-calculer'); await pg.wait_for_function("GG.courant().res && !GG.courant().calcul", timeout=240000)
        assert 'trouv' in (await pg.evaluate('GG.courant().res')).lower() and await pg.evaluate(f"!!GG.TR.cles['1:{ADR2}']")
        await pg.evaluate(f"(function(){{ var k = '1:{ADR2}'; ['cles', 'cibles', 'dest', 'msg', 'compte', 'confirmer', 'prep'].forEach(function (x) {{ delete GG.TR[x][k]; }}); }})()")
        ch2 = await pg.evaluate(f"[GGC.chaineCoffre(1, {P2[1]}, {P2[2]}, '{ALEAS2[1]}', 2), GGC.chaineCoffre(1, {P2[1]}, {P2[2]}, '{ALEAS2[1]}', 0), GGC.chaineCoffre(1, {P2[1]}, {P2[2]}, '{ALEAS2[1]}', 1)]")
        assert ch2[0].startswith('AEDE-H2-G1:') and ch2[1].startswith('AEDE-H0-G1:') and ch2[2].startswith('AEDE-G1:')
        assert K.adresse_coffre(1, P2[1], P2[2], ALEAS2[1], chasse=2) == ADR2 != K.adresse_coffre(1, P2[1], P2[2], ALEAS2[1], chasse=0) and ADR2 != K.adresse_coffre(1, P2[1], P2[2], ALEAS2[1])
        vert('chasser dans GodGift Core : la bonne reponse (mots et numeros) et l alea du cri redonnent la cle du coffre 1 de la chasse n° 2 ; les memes valeurs dans les chasses 0 et 1 donnent d autres cles')
        # ---- l'outil du chasseur, hors ligne, avec la definition (ou le manifeste) : la meme adresse
        import subprocess
        outil = os.path.join(ICI, '..', '..', '..', '06_CHASSEUR', 'outil_chasseur.py')
        fm = os.path.join(T, 'manifeste_chasse2_copie.json'); open(fm, 'w', encoding='utf-8').write(MAN2_TXT)
        for fichier in (F2, fm):
            entree = '\n'.join(['1', ' '.join(map(str, P2[1])), ' '.join(map(str, P2[2])), ALEAS2[1], ADR2, 'n']) + '\n'
            pr = await asyncio.to_thread(subprocess.run, [sys.executable, outil, 'verifier', '--definition', fichier], input=entree, capture_output=True, text=True, timeout=300)
            assert pr.returncode == 0 and 'IDENTIQUES' in pr.stdout and 'AEDE-H2-G1:' in pr.stdout, pr.stdout[-800:] + pr.stderr[-800:]
        assert f'AEDE:chasse:2:{EMP2}' in pr.stdout
        vert('outil du chasseur hors ligne, --definition chasse_2.json ou le manifeste : la meme cle, la meme adresse ; il donne l empreinte du manifeste a comparer a l annonce')
        # ---- la librairie tombe : la chasse n° 2 reste suivie
        PANNE['librairie'] = True
        await pg.reload(); await pg.evaluate("location.hash = '#/chasse/2'")
        await pg.wait_for_function("GG.M.pret && GG.ZS[2] && GG.ZS[2].coffret && GG.ZS[2].ouverts['enigme:2:3'] != null", timeout=120000); await pg.wait_for_timeout(600)
        assert 'Printemps 3 : kwyx' in plat(await pg.inner_text('#page')) and await pg.evaluate("GG.ZS[2].grave") == 'ok'
        PANNE['librairie'] = False
        vert('librairie en panne : GodGift Core garde la chasse n° 2 (annonce reverifiee, manifeste et COFFRET gardes) ; rien d ouvert n est garde, tout se rouvre (balises drand gardees et reverifiees)')
        # ---- les FAUX, refuses par GodGift Core, chacun par son controle
        sans_gravure = faux_tx('rien'); del TXS[sans_gravure]
        non_conf = faux_tx(TEXTE2, confirmee=False)
        un_car = faux_tx(TEXTE2[:-1] + ('0' if TEXTE2[-1] != '0' else '1'))
        tard = faux_tx(TEXTE2, temps=utc(2027, 3, 4))
        B = json.loads(ANN2_TXT)
        def var(**k): return json.dumps(dict(B, **k))
        sig_autre = C.signer_bip322(K_AUTRE, TEXTE2)
        faux_gg = [
            ('signature fausse', var(signature=C.signer_bip322(K_AUT, TEXTE2_FAUX)), 'ann_signature'),
            ('signature par une autre cle (son adresse)', var(signature=sig_autre, adresse=ADR_AUTRE), 'ann_signature'),
            ('signature par une autre cle (adresse de l auteur)', var(signature=sig_autre), 'ann_signature'),
            ('gravure absente', var(txid_gravure=sans_gravure), 'ann_gravure'),
            ('gravure non confirmee', var(txid_gravure=non_conf), 'ann_gravure'),
            ('gravure dont le texte differe d un caractere', var(txid_gravure=un_car), 'ann_gravure_texte'),
            ('gravure apres la premiere enigme', var(txid_gravure=tard), 'ann_gravure_tard'),
            ('gravure qui ne part pas du rendu de l amorce (autre sortie)', var(txid_gravure=faux_tx(TEXTE2, vin=[(AM2, 3)])), 'ann_gravure_entree'),
            ('gravure partie du rendu de l amorce de la chasse zero', var(txid_gravure=faux_tx(TEXTE2, vin=[(AM0, man0['amorce']['vout_rendu'])])), 'ann_gravure_entree'),
            ('manifeste dont l empreinte ne correspond pas', annonce('AEDE:chasse:2:' + 'cd' * 32), 'ann_manifeste'),
            ('chasse 0', annonce('AEDE:chasse:0:' + EMP2, h=0), 'ann_texte'),
            ('chasse 1', annonce('AEDE:chasse:1:' + EMP2, h=1), 'ann_texte'),
            ('chasse 1000', annonce('AEDE:chasse:1000:' + EMP2, h=1000), 'ann_texte'),
            ('texte et numero en desaccord', var(chasse=3), 'ann_texte'),
        ]
        # definitions hors bornes : un manifeste qui les porte, servi par le secours, avec une annonce bien signee et gravee
        for nom, dd in (('0 coffre', dict(DEF2, numero=4, index_amorce=10320, index_rendu=10360, coffres=0, types=[], euros=[])),
                        ('49 coffres', dict(DEF2, numero=4, index_amorce=10320, index_rendu=10360, coffres=49, types=['pierre'] * 49, euros=[1] * 49)),
                        ('type inconnu', dict(DEF2, numero=4, index_amorce=10320, index_rendu=10360, types=['pierre', 'tour'])),
                        ('mois 13', dict(DEF2, numero=4, index_amorce=10320, index_rendu=10360, mois=13))):
            mm = dict(man2, chasse=4, definition=dd); mt = json.dumps(mm); e_ = hashlib.sha256(mt.encode()).hexdigest()
            SECOURS['manifestes']['4'] = mt; tx_ = faux_tx('AEDE:chasse:4:' + e_)
            r = await pg.evaluate("(a) => GG.verifierAnnonce(a, GG.ANN.auteur).then(x => [x.ok, x.raison])", api(annonce('AEDE:chasse:4:' + e_, txid=tx_)))
            assert r == [False, 'ann_definition'], (nom, r)
            assert not await pg.evaluate("(d) => GG.definitionValide(d)", dd)
        SECOURS['manifestes'].pop('4')
        for nom, a_, raison in faux_gg:
            r = await pg.evaluate("(a) => GG.verifierAnnonce(a, GG.ANN.auteur).then(x => [x.ok, x.raison])", api(a_))
            assert r == [False, raison], (nom, r)
        assert await pg.evaluate("(a) => GG.verifierAnnonce(a, GG.ANN.auteur).then(x => x.ok)", api(ANN2_TXT))
        assert await pg.evaluate("(a) => GG.verifierAnnonce(a, null).then(x => x.raison)", api(ANN2_TXT)) == 'ann_sans_auteur'
        assert await pg.evaluate(f"GG.definitionValide({json.dumps(DEF2)}) && !GG.definitionValide(Object.assign({{}}, {json.dumps(DEF2)}, {{index_amorce: 400}})) && !GG.definitionValide(Object.assign({{}}, {json.dumps(DEF2)}, {{numero: 100, coffres: 10, types: Array(10).fill('pierre'), euros: Array(10).fill(1), index_amorce: 18000, index_rendu: 18040}}))")
        vert(f'FAUX refuses par GodGift Core, chacun par son controle ({len(faux_gg) + 4}) : ' + ' ; '.join(n for n, *_ in faux_gg) + ' ; definitions hors bornes (0 coffre, 49 coffres, type inconnu, mois 13)')
        # plus de 100 entrees publiees : GodGift Core le dit ; les fausses sont ecartees avant tout plafond, la chasse n° 2 reste suivie
        SIG_BIDON = C.signer_bip322(K_AUTRE, 'x')
        BIDON = [api(annonce('AEDE:chasse:%d:%s' % (5 + i % 90, hashlib.sha256(b'%d' % i).hexdigest()), sig=SIG_BIDON)) for i in range(150)]
        SECOURS['annonces'] = BIDON
        await pg.reload(); await pg.evaluate("location.hash = '#/chasses'")
        await pg.wait_for_function("GG.M.pret && !GG.ANN.enCours && GG.ANN.lues > 0", timeout=120000); await pg.wait_for_timeout(500)
        assert await pg.evaluate("[GG.ANN.trop, GG.ANN.lues, !!GG.ZS[2]]") == [True, 1, True]
        assert "n'en lit que 100" in plat(await pg.inner_text('#page'))
        vert('plus de 100 entrees publiees : GodGift Core le dit ; les 150 fausses sont ecartees avant le plafond (signature), la chasse n° 2 reste suivie')
        # une librairie piratee publie 150 entrees (100 fausses signatures, puis l annonce de la chasse n° 2 rejouee 50 fois avec de faux txid) :
        # elle ne noie pas le secours, qui sert la vraie annonce
        rejouees = [dict(api(ANN2_TXT), txid_gravure='%064x' % (i + 1)) for i in range(50)]
        LIB_PIRATEE['annonces'] = BIDON[:100] + rejouees; SECOURS['annonces'] = [api(ANN2_TXT)]
        r = await pg.evaluate("(g) => GG.lireAnnonces(GG.ANN.auteur).then(function (l) { return [GG.ANN.trop, l.length, l.filter(function (a) { return a.txid_gravure === g; }).length]; })", GR2)
        assert r == [True, 2, 1], r
        LIB_PIRATEE['annonces'] = None; SECOURS['annonces'] = []
        vert('une librairie piratee publie 150 entrees (fausses signatures, annonce rejouee avec de faux txid) : chaque source est filtree avant le plafond, l annonce du secours est lue')
        # meme numero, deux manifestes, deux annonces valides : la plus ancienne gravure gagne, seule la suivante est refusee
        gb = faux_tx('AEDE:chasse:2:' + EMPB, temps=utc(2027, 2, 10)); SECOURS['manifestes']['2'] = MANB_TXT
        SECOURS['annonces'] = [api(annonce('AEDE:chasse:2:' + EMPB, txid=gb))]
        await pg.reload(); await pg.evaluate("location.hash = '#/chasses'")
        await pg.wait_for_function("GG.M.pret && !GG.ANN.enCours && GG.ANN.refus[2] === 'ann_contredite'", timeout=120000); await pg.wait_for_timeout(500)
        r = await pg.evaluate("[!!GG.ZS[2], !!GG.CHASSES[2], GG.ZS[2] && GG.ZS[2].annonce.empreinte_manifeste, JSON.parse(localStorage.getItem('gg.chasses_retenues'))['2'].empreinte_manifeste, JSON.parse(localStorage.getItem('gg.chasses_contestees'))['2']]")
        assert r == [True, True, EMP2, EMP2, [EMPB]], r
        txt = plat(await pg.inner_text('#page'))
        assert 'La chasse n° 2 a une seconde annonce, plus récente, qui désigne un autre manifeste : GodGift Core garde la première et refuse la seconde.' in txt and '1 chasse(s) suivie(s)' in txt, txt[:1500]
        vert('meme numero, seconde annonce valide gravee PLUS TARD avec un autre manifeste : refusee (ann_contredite), la chasse n° 2 reste suivie, l alerte le dit')
        # une annonce valide gravee PLUS TOT que celle retenue (autre manifeste) : elle remplace la chasse suivie, meme affichee
        man_c = dict(man2); man_c['coffres'] = [dict(man2['coffres'][0], adresse=S.adresse_guichet(r0['zpub_librairie'], 8)), man2['coffres'][1]]
        MANC_TXT = json.dumps(man_c, indent=1, ensure_ascii=False); EMPC = hashlib.sha256(MANC_TXT.encode()).hexdigest()
        gc = faux_tx('AEDE:chasse:2:' + EMPC, temps=utc(2027, 1, 25)); SECOURS['manifestes']['2'] = MANC_TXT
        SECOURS['annonces'] = [api(annonce('AEDE:chasse:2:' + EMPC, txid=gc))]
        await pg.evaluate("location.hash = '#/chasse/2'"); await pg.wait_for_timeout(400)
        assert await pg.evaluate("GG.courant().h") == 2
        await pg.evaluate("(function () { window.__z2 = GG.courant(); return GG.chargerAnnonces(); })()")
        await pg.wait_for_function(f"!GG.ANN.enCours && GG.ZS[2] && GG.ZS[2].coffret && GG.ZS[2].annonce.empreinte_manifeste === '{EMPC}'", timeout=120000)
        r = await pg.evaluate("[GG.ZS[2] !== window.__z2, GG.courant() !== window.__z2, JSON.parse(localStorage.getItem('gg.chasses_retenues'))['2'].empreinte_manifeste, JSON.parse(localStorage.getItem('gg.chasses_contestees'))['2'].slice().sort(), GG.ANN.refus[2], GG.ZS[2].man.coffres[0].adresse]")
        assert r == [True, True, EMPC, sorted([EMPB, EMP2]), 'ann_contredite', S.adresse_guichet(r0['zpub_librairie'], 8)], r
        # la librairie sert toujours l ancienne annonce, le secours n a plus rien : la plus ancienne gravure reste suivie, et l alerte demeure
        SECOURS['annonces'] = []; SECOURS['manifestes'].pop('2')
        await pg.reload(); await pg.evaluate("location.hash = '#/chasses'")
        await pg.wait_for_function("GG.M.pret && !GG.ANN.enCours && GG.ZS[2] && GG.ZS[2].coffret", timeout=120000); await pg.wait_for_timeout(500)
        assert await pg.evaluate("[GG.ZS[2].annonce.empreinte_manifeste, GG.ANN.refus[2], GG.ANN.lues]") == [EMPC, 'ann_contredite', 1]
        assert 'a une seconde annonce, plus récente' in plat(await pg.inner_text('#page'))
        vert('meme numero, annonce valide gravee PLUS TOT avec un autre manifeste : elle remplace la chasse suivie (la page affichee revient a la chasse zero) ; les plus recentes sont refusees, et GodGift Core s en souvient')
        # textes nouveaux dans les cinq langues
        manque = await pg.evaluate("(function(){ var ks = Object.keys(GG_I18N.fr).filter(function (k) { return /^(ch_|ann_)|^aide_annonce$/.test(k); }); var m = []; ['en', 'es', 'de', 'pt'].forEach(function (l) { ks.forEach(function (k) { if (!GG_I18N[l][k]) m.push(l + ':' + k); }); }); return [ks.length, m]; })()")
        gl = await pg.evaluate("['fr', 'en', 'es', 'de', 'pt'].map(function (l) { return GG_GUIDE[l].mots.filter(function (m) { return m.id === 'annonce'; }).length; })")
        assert manque[0] >= 20 and not manque[1] and gl == [1] * 5, (manque, gl)
        vert(f'textes nouveaux dans les cinq langues ({manque[0]} cles), et le mot « Annonce d une chasse » au glossaire du guide')
        assert not err, err; vert('aucune erreur JavaScript')
        await nav.close()

asyncio.run(main())
for d_ in (os.path.join(DON, 'chasses'), CLE):
    for racine, _, fs in os.walk(d_):
        for f in fs:
            assert chr(0x2014) not in open(os.path.join(racine, f), encoding='utf-8', errors='replace').read()
print(f'\nBANC DU POINT 13 (creer, annoncer, decouvrir une chasse) : {OK[0]} verts, 0 rouge')
