# -*- coding: utf-8 -*-
"""BANC « RECUPERER LE TRESOR » : la transaction de GodGift Core (JavaScript, noble-curves) comparee octet pour octet
a une implementation independante (embit, libsecp256k1 : la bibliotheque de Bitcoin Core), sur des centaines de cas tires
au hasard ; les messages signes (BIP-322 et BIP-137) ; Schnorr BIP-340 (vecteurs officiels) ; les adresses refusees.
Lancement : python3 test_tx.py"""
import hashlib, json, os, random, subprocess, sys, base64
from embit import ec, script as S
from embit.transaction import Transaction, TransactionInput, TransactionOutput
from embit.script import Witness
from embit.networks import NETWORKS
from embit.util import secp256k1 as L

ICI = os.path.dirname(os.path.abspath(__file__)); APP = os.path.join(ICI, '..', 'app')
OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)
rnd = random.Random(20261001)

def cas_aleatoires(n):
    out = []
    for i in range(n):
        k = rnd.randrange(1, 2**255)
        cle = ec.PrivateKey(k.to_bytes(32, 'big'))
        reseau = 'main' if i % 5 else 'test'
        net = NETWORKS['main' if reseau == 'main' else 'test']
        kd = ec.PrivateKey(rnd.randbytes(32)); pd = kd.get_public_key()
        genre = i % 5
        if genre == 0: dscript = S.p2wpkh(pd)
        elif genre == 1: dscript = S.p2tr(pd)
        elif genre == 2: dscript = S.p2pkh(pd)
        elif genre == 3: dscript = S.p2sh(S.p2wpkh(pd))
        else: dscript = S.p2wsh(S.p2pkh(pd))
        dest = dscript.address(net)
        nb = 1 + rnd.randrange(12)
        utxos = [{'txid': rnd.randbytes(32).hex(), 'vout': rnd.randrange(4), 'valeur': rnd.randrange(20000, 3_000_000)} for _ in range(nb)]
        taux = rnd.choice([1, 2, 7, 25, 180])
        out.append({'k': format(k, 'x'), 'dest': dest, 'utxos': utxos, 'taux': taux, 'reseau': reseau, 'dscript': dscript.data.hex()})
    return out

def signer_comme_core(cle, h):
    """La regle de Bitcoin Core (SigHasLowR) : RFC 6979, puis compteur en entropie supplementaire tant que R >= 2^255."""
    n = 0
    while True:
        brut = L.ecdsa_sign(h, cle.secret, None, None if n == 0 else n.to_bytes(32, 'little'))
        if L.ecdsa_signature_serialize_compact(brut)[0] < 0x80:
            return ec.Signature(brut)
        n += 1

def embit_balayer(c, frais):
    cle = ec.PrivateKey(int(c['k'], 16).to_bytes(32, 'big')); pub = cle.get_public_key()
    ut = sorted(c['utxos'], key=lambda u: (u['txid'], u['vout']))
    total = sum(u['valeur'] for u in ut)
    vin = [TransactionInput(bytes.fromhex(u['txid']), u['vout'], sequence=0xfffffffd) for u in ut]
    vout = [TransactionOutput(total - frais, S.Script(bytes.fromhex(c['dscript'])))]
    tx = Transaction(version=2, vin=vin, vout=vout, locktime=0)
    code = S.p2pkh(pub)
    for i, u in enumerate(ut):
        h = tx.sighash_segwit(i, code, u['valeur'])
        sig = signer_comme_core(cle, h)
        tx.vin[i].witness = Witness([sig.serialize() + b'\x01', pub.sec()])
    return tx.serialize().hex(), tx.txid().hex()

def node(prog):
    r = subprocess.run(['node', '-e', prog], cwd=APP, capture_output=True, text=True, timeout=600)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit('node a echoue')
    return json.loads(r.stdout)

PRELUDE = "global.window = globalThis; global.atob = (s) => Buffer.from(s, 'base64').toString('latin1'); require('./gg_tlock.js'); global.GGC = require('./gg_crypto.js'); const X = require('./gg_tx.js');"

# ------------------------------------------------------------------ 1. la transaction, octet pour octet
cas = cas_aleatoires(300)
json.dump(cas, open('/tmp/gg_cas.json', 'w'))
js = node(PRELUDE + """const cas = require('/tmp/gg_cas.json'); const r = cas.map(c => { try { const t = X.balayer({utxos: c.utxos, cle: BigInt('0x' + c.k), destination: c.dest, taux: c.taux, reseau: c.reseau}); return t; } catch (e) { return {err: e.message}; } });
console.log(JSON.stringify(r));""")
identiques = 0; refus = 0
for c, t in zip(cas, js):
    if 'err' in t:
        total = sum(u['valeur'] for u in c['utxos'])
        assert t['err'] in ('trop_petit', 'frais_trop_hauts'), (t, c['taux'], total)
        refus += 1; continue
    hx, txid = embit_balayer(c, t['frais'])
    assert hx == t['hex'], ('DIFFERENT', c)
    assert txid == t['txid']
    tx = Transaction.parse(bytes.fromhex(t['hex']))
    assert tx.vin[0].sequence == 0xfffffffd and len(tx.vout) == 1 and tx.vout[0].script_pubkey.data.hex() == c['dscript']
    assert t['montant'] + t['frais'] == sum(u['valeur'] for u in c['utxos'])
    vs = len(tx.serialize()) - sum(len(v.witness.serialize()) for v in tx.vin) - 2
    poids = vs * 4 + (len(tx.serialize()) - vs)
    assert abs(t['vtaille'] - -(-poids // 4)) <= 1 and t['frais'] >= t['vtaille'] * c['taux'] - 1
    identiques += 1
vert(f'{identiques} transactions de balayage identiques octet pour octet a embit (libsecp256k1), entrees 1 a 12, sorties P2WPKH, P2TR, P2PKH, P2SH, P2WSH, bitcoin et signet ; {refus} refus justifies (trop petit ou frais > 50 %)')

# ------------------------------------------------------------------ 2. chaque signature se verifie (libsecp256k1)
c = cas[0]; t = js[0]
tx = Transaction.parse(bytes.fromhex(t['hex'])); pub = ec.PrivateKey(int(c['k'], 16).to_bytes(32, 'big')).get_public_key()
ut = sorted(c['utxos'], key=lambda u: (u['txid'], u['vout']))
for i, u in enumerate(ut):
    der = tx.vin[i].witness.items[0][:-1]; h = tx.sighash_segwit(i, S.p2pkh(pub), u['valeur'])
    assert pub.verify(ec.Signature.parse(der), h)
    assert int.from_bytes(ec.Signature.parse(der).serialize()[-33:], 'big') > 0
vert('chaque signature se verifie avec libsecp256k1 ; S bas, SIGHASH_ALL, remplacement autorise (BIP-125)')

# ------------------------------------------------------------------ 3. les refus
r = node(PRELUDE + """const k = 12345678901234567890n, u = [{txid: 'ab'.repeat(32), vout: 0, valeur: 100000}], o = [];
const essai = (f) => { try { f(); o.push('passe'); } catch (e) { o.push(e.message); } };
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1qxyz', taux: 5}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', taux: 5, reseau: 'main'}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', taux: 5}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', taux: 5}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 0.5}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 600}));
essai(() => X.balayer({utxos: [], cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 5}));
essai(() => X.balayer({utxos: u.concat(u), cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 5}));
essai(() => X.balayer({utxos: [{txid: 'zz', vout: 0, valeur: 5}], cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 5}));
essai(() => X.balayer({utxos: [{txid: 'ab'.repeat(32), vout: 0, valeur: 350}], cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 1}));
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', taux: 5}));
o.push(!!X.decoderAdresse('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0'));
o.push(X.decoderAdresse('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd') === null);
o.push(X.decoderAdresse('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2').type, X.decoderAdresse('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy').type);
o.push(X.decoderAdresse('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3') === null);
essai(() => X.balayer({utxos: u, cle: k, destination: 'bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs', taux: 5}));
essai(() => X.balayer({utxos: [{txid: 'ab'.repeat(32), vout: 2 ** 32, valeur: 100000}], cle: k, destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', taux: 5}));
o.push(X.messageReception('bc1qabc', 'deadbeef'), X.messageReception(' bc1qabc '));
console.log(JSON.stringify(o));""")
assert r[0] == 'destination_invalide' and r[1] == 'destination_reseau', r
assert r[2] == 'passe' and r[3] == 'destination_invalide', r        # tout en majuscules : valide ; casse melangee : refusee
assert r[4] == 'frais_trop_bas' and r[5] == 'frais_trop_hauts' and r[6] == 'coffre_vide' and r[7] == 'entree_double' and r[8] == 'coffre_vide' and r[9] == 'trop_petit', r
assert r[10] == 'passe' and r[11] is True and r[12] is True and r[13] == 'p2pkh' and r[14] == 'p2sh' and r[15] is True, r
assert r[16] == 'destination_invalide' and r[17] == 'coffre_vide' and r[18] == 'AEDE:reception:bc1qabc:deadbeef' and r[19] == 'AEDE:reception:bc1qabc', r
vert('refus : adresse invalide, autre reseau, casse melangee, bech32 au lieu de bech32m (vecteurs BIP-350), base58 falsifiee, frais < 1 sat/vB ou > moitie du tresor, coffre vide, entree en double, montant sous le seuil de poussiere, version temoin 2 (pas encore definie), sortie hors bornes ; le message de reception porte le nombre de l installation')

# ------------------------------------------------------------------ 4. la preuve de propriete : BIP-322 (vecteurs officiels) et BIP-137 (libsecp256k1)
def compacte(cle, msg, genre):
    p = b'Bitcoin Signed Message:\n'; m = msg.encode()
    def vi(n): return bytes([n]) if n < 0xfd else b'\xfd' + n.to_bytes(2, 'little')
    h = hashlib.sha256(hashlib.sha256(vi(len(p)) + p + vi(len(m)) + m).digest()).digest()
    sig = L.ecdsa_sign_recoverable(h, cle.secret); rs, rec = L.ecdsa_recoverable_signature_serialize_compact(sig)
    return base64.b64encode(bytes([{'p2pkh': 31, 'p2sh': 35, 'p2wpkh': 39, 'electrum': 31}[genre] + rec]) + rs).decode()
cle = ec.PrivateKey(hashlib.sha256(b'chasseur').digest()); pub = cle.get_public_key(); net = NETWORKS['main']
a_w = S.p2wpkh(pub).address(net); a_p = S.p2pkh(pub).address(net); a_s = S.p2sh(S.p2wpkh(pub)).address(net)
msg = 'AEDE:reception:' + a_w
lots = [(a_w, msg, compacte(cle, msg, 'p2wpkh')), (a_w, msg, compacte(cle, msg, 'electrum')), (a_p, 'AEDE:reception:' + a_p, compacte(cle, 'AEDE:reception:' + a_p, 'p2pkh')),
        (a_s, 'AEDE:reception:' + a_s, compacte(cle, 'AEDE:reception:' + a_s, 'p2sh'))]
autre = ec.PrivateKey(hashlib.sha256(b'voleur').digest()); a_v = S.p2wpkh(autre.get_public_key()).address(net)
json.dump({'bons': lots, 'faux': [(a_v, msg, lots[0][2]), (a_w, msg + ' ', lots[0][2]), (a_w, msg, lots[2][2][:-4] + 'AAA=')],
           'bip322': [['bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l', 'Hello World', 'AkcwRAIgZRfIY3p7/DoVTty6YZbWS71bc5Vct9p9Fia83eRmw2QCICK/ENGfwLtptFluMGs2KsqoNSk89pO7F29zJLUx9a/sASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI='],
                      ['bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l', '', 'AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=']]},
          open('/tmp/gg_msg.json', 'w'))
r = node(PRELUDE + """const d = require('/tmp/gg_msg.json'); console.log(JSON.stringify({bons: d.bons.map(x => X.verifierMessage(...x)), faux: d.faux.map(x => X.verifierMessage(...x)),
  bip322: d.bip322.map(x => X.verifierMessage(...x)), croise: X.verifierMessage(d.bip322[0][0], 'Hello World', d.bip322[1][2])}));""")
assert r['bons'] == [True] * 4 and r['faux'] == [False] * 3 and r['bip322'] == [True, True] and r['croise'] is False, r
vert('preuve de propriete : BIP-322 (vecteurs officiels « Hello World » et message vide) ; BIP-137 pour bc1q, 1… et 3… (libsecp256k1) ; une adresse de voleur, un message modifie ou une signature alteree sont refuses')

# ------------------------------------------------------------------ 5. Schnorr BIP-340 (Nostr) : vecteurs officiels, et croisement avec libsecp256k1
V = [('0000000000000000000000000000000000000000000000000000000000000003', 'F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9', '0000000000000000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000000', 'E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0'),
     ('B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF', 'DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659', '0000000000000000000000000000000000000000000000000000000000000001',
      '243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', '6896BD60EEAE296DB48A229FF71DFE071BDE413E6D43F917DC8DCF8C78DE33418906D11AC976ABCCB20B091292BFF4EA897EFCB639EA871CFA95F6DE339E4B0A')]
croise = []
for i in range(30):
    k = rnd.randbytes(32); m = rnd.randbytes(32); pk = ec.PrivateKey(k)
    croise.append([k.hex(), m.hex(), pk.schnorr_sign(m).serialize().hex(), pk.get_public_key().xonly().hex()])
json.dump({'v': V, 'c': croise}, open('/tmp/gg_sch.json', 'w'))
r = node(PRELUDE + """const d = require('/tmp/gg_sch.json'), H = (h) => Uint8Array.from(Buffer.from(h, 'hex')), x = (b) => Buffer.from(b).toString('hex').toUpperCase();
const T = window.GGTL; console.log(JSON.stringify({v: d.v.map(([s, p, a, m, g]) => [x(T.schnorrPublique(H(s))) === p, x(T.schnorrSigner(H(m), H(s), H(a))) === g, T.schnorrVerifier(H(g), H(m), H(p))]),
  c: d.c.map(([k, m, sig, px]) => [T.schnorrVerifier(H(sig), H(m), H(px)), x(T.schnorrPublique(H(k))).toLowerCase() === px, Buffer.from(T.schnorrSigner(H(m), H(k), H('00'.repeat(32)))).toString('hex')])}));""")
assert all(all(z) for z in r['v']), r['v']
for (k, m, sig, px), (ok1, ok2, s2) in zip(croise, r['c']):
    assert ok1 and ok2
    assert ec.PublicKey.from_xonly(bytes.fromhex(px)).schnorr_verify(ec.SchnorrSig.parse(bytes.fromhex(s2)), bytes.fromhex(m))
vert('Schnorr BIP-340 : vecteurs officiels 0 et 1 ; 30 signatures croisees avec libsecp256k1 dans les deux sens')
print(f'\nBANC RECUPERER LE TRESOR : {OK[0]} verts, 0 rouge')
