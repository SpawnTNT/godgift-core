# -*- coding: utf-8 -*-
"""BANC DE LA VERSION WEB (app.angedeleau.com) : le dossier dist/web/ que construire.py produit.

Sans navigateur (rapide) :
  - SHA256SUMS de dist/web est celui du programme (son SHA-256 est l'empreinte) ; chaque fichier liste est la, intact, sauf
    godgift.html (la page installee, sans SRI : jamais deposee, contre-audit N5) ; rien d'autre que gg_sw.js, _headers et SHA256SUMS ;
    ni gg_empreinte.js ni gg_fenetre.js ;
  - index.html : chaque <script> et la feuille de style portent leur empreinte SRI, et elle est juste ; la CSP ne joint que des
    origines exactes, en https et wss (ni http:, ni ws:, ni https: en vrac) ; index.html est bien celle que construire.py tire de
    godgift.html (rien de modifie a la main) ; godgift.html (installe, file://) n'a pas de SRI (elle bloquerait tout) ;
  - _headers : la meme CSP, plus frame-ancestors 'none', X-Frame-Options DENY, nosniff ;
  - gg_sw.js : l'empreinte et la liste de cette version, rien d'autre que le modele web/gg_sw.js.
Avec --navigateur (lourd : Chromium, sous le verrou des bancs) : un hebergeur d'essai en https sur cette machine (qui applique
_headers et renvoie /index.html vers / comme Cloudflare Pages) :
  - la page s'ouvre sous sa vraie politique, sans aucune ressource refusee, et calcule l'empreinte du programme en relisant SHA256SUMS ;
  - le service web s'installe apres avoir verifie chaque fichier, puis sert la page ; un fichier altere ensuite chez l'hebergeur n'est
    jamais servi (le service web garde la version verifiee) ;
  - sans service web, un script altere est refuse par le navigateur (SRI), et le service web refuse de s'installer ;
  - recompiler_et_comparer.py --site : IDENTIQUE sur le vrai dossier, DIFFERENTE des qu'un fichier est altere, des que la page
    servie a la racine « / » n'est pas app/index.html (contre-audit N2), ou si l'hebergeur sert godgift.html ;
  - la version web ne presente pas son empreinte comme une preuve (contre-audit N3) ;
  - la page refuse d'etre ouverte dans le cadre d'une autre page.
Lancement : python3 test_web.py [--navigateur]   (construire d'abord : python3 construire.py, ou atelier_scripts/construire_godgift.py)"""
import base64, hashlib, json, os, re, shutil, ssl, subprocess, sys, tempfile, threading
ICI = os.path.dirname(os.path.abspath(__file__)); SOURCES = os.path.dirname(ICI)
sys.path.insert(0, SOURCES)
import construire as K

WEB = os.path.join(SOURCES, 'dist', 'web'); APP = os.path.join(SOURCES, 'app')
OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)
def sha(b): return hashlib.sha256(b).hexdigest()
def lire(p): return open(p, 'rb').read()

# ------------------------------------------------------------------ 1. le dossier
assert os.path.isdir(WEB), 'dist/web absent : construire d abord'
sommes = lire(os.path.join(SOURCES, 'SHA256SUMS'))
assert lire(os.path.join(WEB, 'SHA256SUMS')) == sommes
EMP = sha(sommes)
assert json.loads(open(os.path.join(APP, 'gg_empreinte.js'), encoding='utf-8').read().split('= ', 1)[1].rstrip(';\n'))['empreinte'] == EMP
liste = {}
for l in sommes.decode().splitlines():
    h, p = l.split('  ', 1); assert p.startswith('app/'); liste[p[4:]] = h
for p, h in liste.items():
    if p != 'godgift.html':
        assert sha(lire(os.path.join(WEB, p))) == h, p
presents = sorted(os.path.relpath(os.path.join(r, f), WEB).replace(os.sep, '/') for r, _, fs in os.walk(WEB) for f in fs)
assert sorted(set(presents) - set(liste)) == ['SHA256SUMS', '_headers', 'gg_sw.js'], sorted(set(presents) - set(liste))
assert sorted(set(liste) - set(presents)) == ['godgift.html'], sorted(set(liste) - set(presents))
assert 'gg_empreinte.js' not in presents and 'gg_fenetre.js' not in presents and 'gg_fenetre.js' not in liste and 'index.html' in liste and 'gg_cg.js' in liste
vert(f'dist/web : les fichiers de SHA256SUMS sauf godgift.html (la page installee n est pas deposee), intacts, plus gg_sw.js, _headers et SHA256SUMS (son SHA-256 = l empreinte {EMP[:16]}...) ; ni gg_empreinte.js ni gg_fenetre.js')

# ------------------------------------------------------------------ 2. index.html : SRI et CSP
page = lire(os.path.join(WEB, 'index.html')).decode()
scripts = re.findall(r'<script\b[^>]*>', page)
sri = re.findall(r'<script src="([^"]+)" integrity="(sha384-[A-Za-z0-9+/=]+)">', page) + re.findall(r'<link rel="stylesheet" href="([^"]+)" integrity="(sha384-[A-Za-z0-9+/=]+)">', page)
assert len(scripts) >= 13 and len(sri) == len(scripts) + 1, (len(scripts), len(sri))
for f, s in sri:
    assert s == 'sha384-' + base64.b64encode(hashlib.sha384(lire(os.path.join(WEB, f))).digest()).decode(), f
assert 'gg_empreinte.js' not in page and 'gg_fenetre.js' not in page and 'gg_regles.js' in page and 'gg_cg.js' in page
vert(f'index.html : {len(scripts)} scripts et la feuille de style, chacun avec son empreinte SRI (sha384), et elle est juste')
csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', page).group(1)
d = dict((x.split(' ', 1) + [''])[:2] for x in csp.split('; '))
assert d['default-src'] == "'none'" and d['script-src'] == "'self'" and d['object-src'] == "'none'" and d['base-uri'] == "'none'"
co = d['connect-src'].split()
assert co[0] == "'self'" and all(re.fullmatch(r'(https|wss)://[a-z0-9.-]+', x) for x in co[1:]), co
assert not any(x in ('http:', 'https:', 'ws:', 'wss:', '*') or x.startswith(('http://', 'ws://')) for x in co)
assert set(co[1:]) == set(K.origines_web()) and 'https://angedeleau.com' in co and 'https://mempool.space' in co and 'https://api.drand.sh' in co and 'wss://relay.damus.io' in co
vert('CSP de la version web : origines exactes (librairie, deux explorateurs, relais drand, relais Nostr), https et wss seulement, scripts de la page seulement')
an = json.loads(open(os.path.join(APP, 'gg_ancre.js'), encoding='utf-8').read().split('= ', 1)[1].rstrip(';\n'))
assert an['secours'] == [o for o in K.origines_epinglees() if o.startswith('https://')]
_ici, _t = K.ICI, tempfile.mkdtemp(prefix='gg_orig_')
open(os.path.join(_t, 'web_origines.txt'), 'w').write('# un secours\nhttps://secours.exemple.org\nwss://relais.exemple.org\n')
K.ICI = _t; ep = K.origines_epinglees(); K.ICI = _ici; shutil.rmtree(_t)
assert ep == ['https://secours.exemple.org', 'wss://relais.exemple.org']
vert('serveurs de secours epingles a la construction : les origines https de web_origines.txt, dans gg_ancre.js (GG_ANCRE.secours) ; une origine annoncee par la caisse seule n y entre jamais')
avant = lire(os.path.join(APP, 'index.html')); K.page_web(); assert lire(os.path.join(APP, 'index.html')) == avant
bureau = lire(os.path.join(APP, 'godgift.html')).decode()
assert 'integrity=' not in bureau and '<script src="gg_empreinte.js"></script>' in bureau and '<script src="gg_fenetre.js"></script>' in bureau and "ws://localhost:*" in bureau
vert('index.html est exactement celle que construire.py tire de godgift.html ; godgift.html (installe, file://) sans SRI, avec gg_empreinte.js')

# ------------------------------------------------------------------ 3. _headers et gg_sw.js
hd = open(os.path.join(WEB, '_headers'), encoding='utf-8').read()
csp_h = re.search(r'^  Content-Security-Policy: (.+)$', hd, re.M).group(1)
assert csp_h == csp + "; frame-ancestors 'none'" and '  X-Frame-Options: DENY' in hd and '  X-Content-Type-Options: nosniff' in hd and '/gg_sw.js\n  Cache-Control: no-cache' in hd
vert("_headers : la meme CSP plus frame-ancestors 'none' (une balise meta ne le peut pas), X-Frame-Options DENY, nosniff ; gg_sw.js jamais garde en cache")
sw = open(os.path.join(WEB, 'gg_sw.js'), encoding='utf-8').read()
assert sw == K.texte_sw(sommes.decode(), EMP)
m = json.loads(re.search(r'var SOMMES = (\{.*?\});', sw).group(1))
assert re.search(r'var EMPREINTE = "([0-9a-f]{64})";', sw).group(1) == EMP and m == dict({k: v for k, v in liste.items() if k != 'godgift.html'}, SHA256SUMS=EMP)
assert 'network-first' not in sw and 'caches.match(e.request)' not in sw
vert('gg_sw.js : l empreinte et la liste de cette version (chaque fichier, et SHA256SUMS lui-meme), rien d autre que le modele')

if '--navigateur' not in sys.argv:
    print(f'\nBANC DE LA VERSION WEB : {OK[0]} verts, 0 rouge (sans navigateur ; --navigateur pour la suite)')
    sys.exit(0)

# ------------------------------------------------------------------ 4. dans un vrai Chromium, chez un hebergeur d'essai en https
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
T = tempfile.mkdtemp(prefix='gg_web_')
CERT, CLE = os.path.join(T, 'cert.pem'), os.path.join(T, 'cle.pem')
subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', CLE, '-out', CERT, '-days', '2', '-subj', '/CN=localhost',
                '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], check=True, capture_output=True)
REGLES = []
for bloc in re.split(r'\n(?=/)', hd.split('\n', 1)[1]):
    ls = bloc.strip('\n').split('\n'); REGLES.append((ls[0], [tuple(x.strip().split(': ', 1)) for x in ls[1:] if x.strip()]))
ALTERES = {}; RACINE = {'page': None}
class Hebergeur(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = self.path.split('?', 1)[0]
        if p == '/index.html':                       # comme Cloudflare Pages : /index.html renvoie vers /
            self.send_response(308); self.send_header('Location', '/'); self.end_headers(); return
        f = 'index.html' if p == '/' else p.lstrip('/')
        c = os.path.join(WEB, f)
        if p == '/' and RACINE['page'] is not None:  # un hebergeur qui sert a la racine une autre page qu'a /index.html
            b = RACINE['page']
        elif f.startswith('_') or '..' in f or (not os.path.isfile(c) and f not in ALTERES):
            self.send_response(404); self.end_headers(); return
        else:
            b = ALTERES.get(f) or lire(c)
        self.send_response(200)
        typ = {'html': 'text/html; charset=utf-8', 'js': 'application/javascript', 'css': 'text/css', 'png': 'image/png', 'jpg': 'image/jpeg', 'woff2': 'font/woff2',
               'webmanifest': 'application/manifest+json'}.get(f.rsplit('.', 1)[-1], 'application/octet-stream')
        en = {'Content-Type': typ}
        for motif, entetes in REGLES:
            if motif == '/*' or motif == p:
                en.update(dict(entetes))
        for k, v in en.items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
srv = ThreadingHTTPServer(('127.0.0.1', 0), Hebergeur)
cx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); cx.load_cert_chain(CERT, CLE); srv.socket = cx.wrap_socket(srv.socket, server_side=True)
threading.Thread(target=srv.serve_forever, daemon=True).start()
SITE = f'https://localhost:{srv.server_address[1]}/'

def comparer():
    env = dict(os.environ, SSL_CERT_FILE=CERT, NO_PROXY='localhost,127.0.0.1', no_proxy='localhost,127.0.0.1')
    r = subprocess.run([sys.executable, os.path.join(SOURCES, 'recompiler_et_comparer.py'), '--site', SITE, '--attendue', EMP], env=env, capture_output=True, text=True, timeout=300)
    return r.returncode, r.stdout + r.stderr

rc, out = comparer(); assert rc == 0 and 'IDENTIQUE' in out, out
vert('recompiler_et_comparer.py --site : IDENTIQUE (chaque fichier servi, la page de la racine et du start_url, le service web refait depuis la liste, l en-tete de securite, les SRI)')
RACINE['page'] = lire(os.path.join(WEB, 'index.html')).replace(b'</body>', b'<!-- une autre page, aux SRI justes -->\n</body>')
rc, out = comparer(); assert rc == 1 and '/ : ECART' in out and 'start_url' in out and 'DIFFERENTE' in out, out
RACINE['page'] = None
ALTERES['godgift.html'] = lire(os.path.join(APP, 'godgift.html'))
rc, out = comparer(); assert rc == 1 and 'godgift.html : servie' in out, out
del ALTERES['godgift.html']
vert('recompiler_et_comparer.py --site : DIFFERENTE si la racine « / » (et donc le start_url) sert une autre page que app/index.html, ou si godgift.html est servie')

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--ignore-certificate-errors'])
    def contexte():
        ctx = b.new_context(ignore_https_errors=True, viewport={'width': 1300, 'height': 850})
        ctx.route(lambda u: not u.startswith(SITE), lambda r: r.fulfill(status=503, body='', headers={'Access-Control-Allow-Origin': '*'}))   # le monde exterieur : coupe
        return ctx
    ctx = contexte(); pg = ctx.new_page(); refus = []; err = []
    pg.on('console', lambda m: refus.append(m.text) if ('Content Security Policy' in m.text or 'integrity' in m.text.lower()) else None)
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto(SITE + '?lang=fr')
    pg.wait_for_function(f"window.GG_EMPREINTE && GG_EMPREINTE.empreinte === '{EMP}'", timeout=30000)
    assert pg.evaluate('typeof GGR === "object" && typeof GGTL === "object" && typeof GG.codeCompagnon === "function"') and not refus and not err, (refus, err)
    vert('la page web s ouvre sous sa vraie politique (CSP, SRI), sans ressource refusee ; elle calcule l empreinte du programme en relisant SHA256SUMS')
    for _ in range(2): pg.click('#ac-suivant'); pg.wait_for_timeout(200)
    ta = pg.inner_text('#accueil'); assert '3 / 4' in ta and 'ne prouverait rien' in ta.replace('\u2019', "'") and not pg.evaluate("!!document.getElementById('ac-emp')"), ta
    assert pg.evaluate("GG.codeCompagnon && true") and 'fenetre=' not in pg.evaluate('location.href')
    vert('version web : l accueil ne presente pas l empreinte comme une preuve ; il renvoie a la verification de l exterieur (--site)')
    pg.wait_for_function('navigator.serviceWorker.ready.then(function () { return true; })', timeout=60000)
    pg.reload(); pg.wait_for_function('!!navigator.serviceWorker.controller', timeout=30000)
    gardes = pg.evaluate("caches.keys().then(function (ks) { return caches.open(ks[0]).then(function (c) { return c.keys(); }).then(function (r) { return [ks, r.map(function (x) { return new URL(x.url).pathname; })]; }); })")
    assert gardes[0] == ['gg-' + EMP[:16]] and '/index.html' in gardes[1] and '/gg_app.js' in gardes[1] and '/SHA256SUMS' in gardes[1], gardes
    vert(f'le service web s installe apres avoir verifie chaque fichier ({len(gardes[1])} gardes, les grandes images a la premiere lecture), puis sert la page')
    ALTERES['gg_demo.js'] = b'window.ALTERE = 1;\n' + lire(os.path.join(WEB, 'gg_demo.js'))
    pg.reload(); pg.wait_for_function(f"window.GG_EMPREINTE && GG_EMPREINTE.empreinte === '{EMP}'", timeout=30000)
    assert pg.evaluate('window.ALTERE === undefined && !!navigator.serviceWorker.controller') and not err, err
    vert('un fichier altere ensuite chez l hebergeur n est jamais servi : le service web garde la version verifiee')
    rc, out = comparer(); assert rc == 1 and 'gg_demo.js : ECART' in out and 'DIFFERENTE' in out, out
    vert('recompiler_et_comparer.py --site : DIFFERENTE, et il nomme le fichier altere')
    ctx.close()
    ctx2 = contexte(); pg2 = ctx2.new_page(); refus2 = []
    pg2.on('console', lambda m: refus2.append(m.text) if 'integrity' in m.text.lower() or 'digest' in m.text.lower() else None)
    pg2.goto(SITE); pg2.wait_for_timeout(2500)
    assert pg2.evaluate('window.ALTERE === undefined') and any('gg_demo.js' in x for x in refus2), refus2
    inst = pg2.evaluate("navigator.serviceWorker.getRegistration().then(function (r) { return r ? [!!r.active, !!r.installing, !!r.waiting] : null; })")
    pg2.wait_for_timeout(1500)
    inst = pg2.evaluate("navigator.serviceWorker.getRegistration().then(function (r) { return r ? !!r.active : false; })")
    assert inst is False, inst
    vert('sans service web : le navigateur refuse le script altere (SRI), et le service web refuse de s installer (un fichier faux)')
    ctx2.close()
    del ALTERES['gg_demo.js']
    ctx3 = contexte(); pg3 = ctx3.new_page()
    pg3.set_content(f'<iframe id="f" src="{SITE}" style="width:600px;height:400px"></iframe>'); pg3.wait_for_timeout(2500)
    f = [x for x in pg3.frames if x.url.startswith(SITE)]
    vide = not f or f[0].evaluate("!document.getElementById('app') || !document.body.textContent.trim()")
    assert vide, 'la page s est ouverte dans un cadre'
    vert("dans le cadre d une autre page : refusee (frame-ancestors 'none' de _headers, et la page se vide elle-meme)")
    ctx3.close(); b.close()
srv.shutdown(); shutil.rmtree(T, ignore_errors=True)
print(f'\nBANC DE LA VERSION WEB : {OK[0]} verts, 0 rouge')
