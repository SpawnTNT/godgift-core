const C = require('../app/gg_crypto.js'), fs = require('fs'), crypto = require('crypto');
let ok = 0; const eq = (a, b, m) => { if (a !== b) { console.error('ECHEC', m, a, b); process.exit(1); } ok++; };
// SHA-256, RIPEMD-160 contre node
for (const s of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'é'.repeat(1000)]) {
  eq(C.sha256hex(s), crypto.createHash('sha256').update(s).digest('hex'), 'sha256');
  eq(C.hex(C.ripemd160(C.utf8(s))), crypto.createHash('ripemd160').update(s).digest('hex'), 'ripemd');
}
// scrypt : vecteur RFC 7914 (N=1024, r=8, p=16 n'est pas couvert : p=1) ; comparaison a node pour p=1
(async () => {
  for (const [N, pw, sel] of [[1024, 'password', 'NaCl'], [16384, 'pleaseletmein', 'SodiumChloride']]) {
    const a = C.hex(await C.scrypt(C.utf8(pw), C.utf8(sel), N, 8, 64));
    eq(a, crypto.scryptSync(pw, sel, 64, { N, r: 8, p: 1, maxmem: 2 ** 31 }).toString('hex'), 'scrypt ' + N);
  }
  // les vecteurs publics de la Pierre, a pleine lenteur (N = 2^20)
  const vecteurs = ['/../../01_PIERRE/VECTEURS_TEST_V1g.json', '/../../../pierre/VECTEURS_TEST_V1g.json'].map(x => __dirname + x).filter(x => fs.existsSync(x))[0];   // trousse, ou paquet maitre
  const V = JSON.parse(fs.readFileSync(vecteurs));
  for (const v of V) {
    const ch = C.chaineCoffre(v.coffre, v.enigme_3, v.enigme_17, v.alea);
    eq(ch, v.chaine, 'chaine');
    const t = Date.now(), k = await C.cleCoffre(v.coffre, ch);
    eq(C.adresseDeCle(k), v.adresse_mainnet, 'adresse coffre ' + v.coffre);
    eq(C.adresseDeCle(k, 'tb'), v.adresse_signet, 'signet');
    console.log('  coffre', v.coffre, 'en', Date.now() - t, 'ms');
  }
  { // la chasse zero : son numero entre dans la chaine et le sel (chasses.py, VECTEUR_CHASSE0)
    const ch0 = C.chaineCoffre(1, [1, 2500, 5000], [873, 874, 4410], '2b'.repeat(32), 0);
    eq(ch0, 'AEDE-H0-G1:0001-2500-5000:0873-0874-4410:' + '2b'.repeat(32), 'chaine chasse zero');
    const k0 = await C.cleCoffre(1, ch0, null, null, 0);
    eq(C.adresseDeCle(k0), 'bc1qdju6t5686hnfx38kzj8anmdtw56yt7eu9j2s0y', 'adresse chasse zero');
    let refuse = false; try { await C.cleCoffre(1, ch0); } catch (e) { refuse = true; }
    eq(refuse, true, 'une chaine de la chasse zero ne se calcule pas comme une chaine de la chasse 1');
  }
  eq(C.adresseValide('bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvp'), true, 'valide'); eq(C.adresseValide('bc1qstr8teku6u56xse27fmds7nfkq255pcqfw8cvq'), false, 'invalide');
  console.log('CRYPTO GODGIFT :', ok, 'verts');
})();
