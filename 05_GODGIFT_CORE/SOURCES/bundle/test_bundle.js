// Banc du module gg_tlock.js : copier ../app/gg_tlock.js ici, puis : node test_bundle.js
// Le verrou a date dans les deux sens (Python vers JavaScript, tlock-js vers JavaScript), le refus d'une ouverture trop tot, et le
// client drand de GodGift Core : une signature fausse fait passer au relais suivant (audit godgift I8), rien n'est lu dans le cache
// du navigateur, un relais muet est abandonne apres dix secondes, une balise gardee sur la machine est reverifiee avant usage et sert sans reseau.
global.window = globalThis;
const fs = require('fs'), { createHash } = require('crypto');
const d = JSON.parse(fs.readFileSync(__dirname + '/vecteur_tlock.json'));
const appels = [];
let ok = 0;
function vert(m) { ok++; console.log('  vert :', m); }
function balise(r, s) { return { round: r, signature: s, randomness: createHash('sha256').update(Buffer.from(s, 'hex')).digest('hex') }; }
global.fetch = async (u, o) => {
  appels.push([u, o && o.cache, !!(o && o.signal)]);
  const r = +u.split('/').pop(), s = d.sig[r];
  if (u.startsWith('https://muet')) throw new Error('injoignable');
  if (u.startsWith('https://lent')) return new Promise((_, non) => { if (o && o.signal) o.signal.addEventListener('abort', () => non(new Error('abandon'))); });
  if (u.startsWith('https://menteur')) {                   // une signature d'une autre ronde, avec un alea coherent : seule la verification BLS la refuse
    const autre = d.sig[Object.keys(d.sig).find(k => +k !== r)];
    return { ok: true, status: 200, json: async () => balise(r, autre) };
  }
  return { ok: !!s, status: s ? 200 : 404, json: async () => balise(r, s) };
};
console.log = (function (l) { return function () { if (!/^beacon received/.test(arguments[0])) l.apply(console, arguments); }; })(console.log);
require('./gg_tlock.js');
(async () => {
  const a = await window.GGTL.ouvrir(d.arme, d.chaine, ['https://x']);
  if (a !== d.texte) throw new Error('python -> bundle'); vert('Python -> JavaScript : le verrou de la Cave s ouvre');
  const b = await window.GGTL.ouvrir(d.arme_js, d.chaine, ['https://x']);
  if (b !== d.texte) throw new Error('tlock-js -> bundle'); vert('tlock-js -> JavaScript');
  try { await window.GGTL.ouvrir(d.arme, Object.assign({}, d.chaine, { genesis_time: 1e10 }), ['https://x']); throw new Error('TROP TOT OUVERT'); }
  catch (e) { if (!/too early/.test(e.message)) throw e; } vert('trop tot : refuse');
  if (!appels.every(x => x[1] === 'no-store')) throw new Error('cache du navigateur'); vert('chaque lecture drand se fait sans le cache du navigateur (no-store)');
  appels.length = 0;
  const c = await window.GGTL.ouvrir(d.arme, d.chaine, ['https://menteur', 'https://muet', 'https://x']);
  if (c !== d.texte || appels.length !== 3) throw new Error('relais suivant'); vert('un relais qui ment (signature fausse), puis un relais muet : on passe au suivant, le verrou s ouvre');
  try { await window.GGTL.ouvrir(d.arme, d.chaine, ['https://menteur', 'https://muet']); throw new Error('OUVERT AVEC UNE SIGNATURE FAUSSE'); }
  catch (e) { if (!/drand/.test(e.message)) throw e; } vert('seulement des relais menteurs ou muets : rien ne s ouvre');
  const st = global.setTimeout; let delai = 0;
  global.setTimeout = (f, ms) => { delai = ms; return st(f, ms === 10000 ? 30 : ms); };   // les dix secondes du banc durent 30 ms
  appels.length = 0;
  const g = await window.GGTL.ouvrir(d.arme, d.chaine, ['https://lent', 'https://x']);
  global.setTimeout = st;
  if (g !== d.texte || appels.length !== 2 || !appels[0][2] || delai !== 10000) throw new Error('relais lent');
  vert('un relais qui ne repond pas est abandonne apres dix secondes : on passe au suivant');
  const gardees = {}; appels.length = 0;
  await window.GGTL.ouvrir(d.arme, d.chaine, ['https://x'], gardees);
  const r = Object.keys(gardees)[0];
  if (!r || appels.length !== 1) throw new Error('balise gardee'); appels.length = 0;
  const t0 = Date.now(), e = await window.GGTL.ouvrir(d.arme, d.chaine, [], gardees);
  if (e !== d.texte || appels.length) throw new Error('balise reverifiee sans reseau');
  vert(`une balise gardee sur la machine est reverifiee puis sert sans reseau (${Date.now() - t0} ms : verification BLS et ouverture)`);
  gardees[r] = balise(+r, d.sig[Object.keys(d.sig).find(k => k !== r)]);
  const f = await window.GGTL.ouvrir(d.arme, d.chaine, ['https://x'], gardees);
  if (f !== d.texte || appels.length !== 1 || gardees[r].signature !== d.sig[r]) throw new Error('balise abimee');
  vert('une balise gardee mais fausse est rejetee, relue aux relais et remplacee');
  if (!(await window.GGTL.baliseValide(d.chaine, balise(+r, d.sig[r]), +r)) || (await window.GGTL.baliseValide(d.chaine, balise(+r, d.sig[r]), +r + 1))) throw new Error('baliseValide');
  vert('baliseValide : ronde attendue, alea, signature BLS');
  console.log(`BANC DU MODULE gg_tlock.js : ${ok} verts, 0 rouge`);
})().catch(e => { console.error('ROUGE :', e.message); process.exit(1); });
