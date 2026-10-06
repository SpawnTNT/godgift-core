# -*- coding: utf-8 -*-
"""BANC DES INSTALLATEURS ET DES TEXTES D'INSTALLATION (leger, sans navigateur). Construire d'abord.

  - installer_linux.sh, sur le paquet complet extrait : il ne copie QUE les fichiers de SHA256SUMS (un fichier ajoute a l'archive
    n'est jamais installe), reverifie chaque copie, ecrit l'empreinte, ouvre godgift.html ; un fichier altere, ou une liste qui
    sortirait de app/, et rien n'est installe ;
  - installer_windows.ps1 (lu, pas execute : pas de PowerShell ici) : meme regle, fichier par fichier, et la page godgift.html ;
  - le .deb : la page godgift.html, et le texte « aucune donnee personnelle ; aucune cle conservee » ;
  - les textes (LISEZ_MOI.txt, Commencer ici.html, l'installateur Windows) : la regle JAMAIS mot pour mot, le titre anglais
    « The Angel of the Water », /verifier-installateur, Certum, app.angedeleau.com ; ni Microsoft Store, ni tiret cadratin ;
  - la fenetre dediee (contre-audit N1) : avec un navigateur de la famille Chromium, l'installateur Linux (et le lanceur du .deb, joue
    pour de vrai) tire un jeton, n'ecrit a cote du programme que son empreinte (gg_fenetre.js, hors SHA256SUMS) et ouvre la fenetre
    dediee avec ce jeton ; sans navigateur de cette famille, le repli ouvre la page SANS jeton (la retape sera demandee) ; les
    installateurs Windows font de meme (lus) ; « Sans installer » ouvre la page avec sans_installer=1 ;
  - les lanceurs du .deb et du Mac (contre-verification V4 du 3 octobre), joues pour de vrai : a chaque lancement, la copie qu'ils
    ouvrent est reverifiee contre le SHA256SUMS du paquet (ou de l'application), sans fichier en plus, l'empreinte affichee egale au
    SHA-256 de cette liste ; un fichier modifie ou ajoute dans la copie, et rien n'est lance, avec un message clair.
Lancement : python3 test_installateurs.py"""
import glob, hashlib, os, re, shutil, subprocess, sys, tempfile, zipfile
ICI = os.path.dirname(os.path.abspath(__file__)); SOURCES = os.path.dirname(ICI)
sys.path.insert(0, SOURCES)
import construire as K
OK = [0]
def vert(m): OK[0] += 1; print('  vert :', m)

JAMAIS_FR = ('Personne, pas même l’auteur, ne vous demandera jamais vos 24 mots, ni de payer pour une énigme, un indice ou une réponse, ni vos réponses. '
             'L’édition numérique certifiée ne s’achète que sur angedeleau.com ; GodGift Core ne se télécharge que sur angedeleau.com, ou s’ouvre sur '
             'app.angedeleau.com. Quiconque vous le demande, même au nom de l’auteur, est un escroc.')
JAMAIS_EN = ('Nobody, not even the author, will ever ask for your 24 words, for payment for a riddle, a hint or an answer, or for your answers. '
             'The certified digital edition is sold only on angedeleau.com; GodGift Core is downloaded only from angedeleau.com, or opened at app.angedeleau.com. '
             'Anyone who asks, even in the author’s name, is a scammer.')

# ------------------------------------------------------------------ installer_linux.sh, pour de vrai
Z = os.path.join(SOURCES, 'dist', K.NOM + '.zip'); assert os.path.isfile(Z), 'construire d abord'
EMP = hashlib.sha256(open(os.path.join(SOURCES, 'SHA256SUMS'), 'rb').read()).hexdigest()
def paquet():
    t = tempfile.mkdtemp(prefix='gg_inst_')
    with zipfile.ZipFile(Z) as z: z.extractall(t)
    return t, os.path.join(t, K.NOM, 'fichiers')
def installer(f, maison):
    env = {'HOME': maison, 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}   # aucun navigateur : le lanceur se cree quand meme
    return subprocess.run(['sh', os.path.join(f, 'installer_linux.sh')], input='1\n', capture_output=True, text=True, env=env, timeout=120)
t, f = paquet(); maison = os.path.join(t, 'maison'); os.makedirs(maison)
open(os.path.join(f, 'app', 'piege.html'), 'w').write('<script>alert(1)</script>')
r = installer(f, maison); dest = os.path.join(maison, '.local', 'share', 'godgift-core')
assert r.returncode == 0, r.stdout + r.stderr
inst = sorted(os.path.relpath(os.path.join(a, x), dest).replace(os.sep, '/') for a, _, xs in os.walk(os.path.join(dest, 'app')) for x in xs)
liste = sorted(l.split('  ', 1)[1] for l in open(os.path.join(SOURCES, 'SHA256SUMS'), encoding='utf-8').read().splitlines())
assert inst == sorted(liste + ['app/gg_empreinte.js']), set(inst) ^ set(liste)
assert EMP in open(os.path.join(dest, 'app', 'gg_empreinte.js')).read() and EMP[:4] in r.stdout and 'verifier-installateur' in r.stdout
lanceur = open(os.path.join(maison, '.local', 'share', 'applications', 'godgift-core.desktop'), encoding='utf-8').read()
assert 'godgift.html?lang=fr' in lanceur and 'index.html' not in lanceur and 'fenetre=' not in lanceur and 'xdg-open' in lanceur
vert('installer_linux.sh : seuls les fichiers de SHA256SUMS sont installes (un fichier ajoute a l archive ne l est pas), chacun reverifie ; l empreinte est ecrite ; le lanceur ouvre godgift.html')
vert('installer_linux.sh sans navigateur Chromium : le repli ouvre godgift.html dans le navigateur principal, sans jeton ni gg_fenetre.js (la retape sera demandee)')
shutil.rmtree(t)
# avec un navigateur de la famille Chromium (un faux, qui note ses arguments) : la fenetre dediee et son jeton
import stat, time as _time
t, f = paquet(); maison = os.path.join(t, 'maison'); os.makedirs(maison); faux = os.path.join(t, 'bin'); os.makedirs(faux)
TRACE = os.path.join(t, 'trace.txt')
open(os.path.join(faux, 'chromium'), 'w').write('#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "%s"\n' % TRACE); os.chmod(os.path.join(faux, 'chromium'), 0o755)
env = {'HOME': maison, 'PATH': faux + ':/usr/bin:/bin', 'LANG': 'C.UTF-8'}
r = subprocess.run(['sh', os.path.join(f, 'installer_linux.sh')], input='2\n', capture_output=True, text=True, env=env, timeout=120); assert r.returncode == 0, r.stdout + r.stderr
dest = os.path.join(maison, '.local', 'share', 'godgift-core'); bureau = os.path.join(maison, '.local', 'share', 'applications', 'godgift-core.desktop')
inst = sorted(os.path.relpath(os.path.join(a, x), dest).replace(os.sep, '/') for a, _, xs in os.walk(os.path.join(dest, 'app')) for x in xs)
assert inst == sorted(liste + ['app/gg_empreinte.js', 'app/gg_fenetre.js']), set(inst) ^ set(liste)
em = re.search(r'"empreinte": "([0-9a-f]{64})"', open(os.path.join(dest, 'app', 'gg_fenetre.js')).read()).group(1)
lanceur = open(bureau, encoding='utf-8').read(); jeton = re.search(r'godgift\.html\?lang=en&fenetre=([0-9a-f]{64})"', lanceur).group(1)
assert hashlib.sha256(jeton.encode()).hexdigest() == em and jeton not in open(os.path.join(dest, 'app', 'gg_fenetre.js')).read()
assert '--user-data-dir=' + dest + '/profil' in lanceur and stat.S_IMODE(os.stat(bureau).st_mode) == 0o600
for _ in range(50):
    if os.path.exists(TRACE) and os.path.getsize(TRACE): break
    _time.sleep(0.1)
args = open(TRACE).read().split('\n'); assert '--app=file://' + dest + '/app/godgift.html?lang=en&fenetre=' + jeton in args and '--user-data-dir=' + dest + '/profil' in args, args
shutil.rmtree(t)
vert('installer_linux.sh avec Chromium : un jeton de 32 octets tire a l installation, dans le lanceur seul (fichier 0600) ; a cote du programme, son empreinte seule (gg_fenetre.js) ; la fenetre dediee s ouvre avec son profil et ce jeton')
# le lanceur du .deb, joue pour de vrai (programme commun dans /usr/share : recopie par utilisateur, jeton garde a part)
t = tempfile.mkdtemp(prefix='gg_deb_'); maison = os.path.join(t, 'maison'); os.makedirs(maison); faux = os.path.join(t, 'bin'); os.makedirs(faux)
RACINE = os.path.join(t, 'usr_share'); SRC = os.path.join(RACINE, 'app'); shutil.copytree(os.path.join(SOURCES, 'app'), SRC, ignore=shutil.ignore_patterns('gg_fenetre.js'))
shutil.copyfile(os.path.join(SOURCES, 'SHA256SUMS'), os.path.join(RACINE, 'SHA256SUMS'))
lance_deb = open(os.path.join(SOURCES, 'paquets', 'deb', 'godgift-core'), encoding='utf-8').read()
assert lance_deb.count('RACINE=/usr/share/godgift-core\n') == 1
lance_deb = lance_deb.replace('RACINE=/usr/share/godgift-core\n', 'RACINE=' + RACINE + '\n')
open(os.path.join(t, 'godgift-core'), 'w').write(lance_deb)
TRACE = os.path.join(t, 'trace.txt')
open(os.path.join(faux, 'chromium'), 'w').write('#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "%s"\n' % TRACE); os.chmod(os.path.join(faux, 'chromium'), 0o755)
for _ in range(2):                                # deux lancements : le jeton est garde, la copie n'est pas refaite
    r = subprocess.run(['sh', os.path.join(t, 'godgift-core')], capture_output=True, text=True, env={'HOME': maison, 'PATH': faux + ':/usr/bin:/bin'}, timeout=60); assert r.returncode == 0, r.stderr
    args = open(TRACE).read().split('\n'); D = os.path.join(maison, '.local', 'share', 'godgift-core')
    j = open(os.path.join(D, 'jeton')).read().strip(); assert re.fullmatch(r'[0-9a-f]{64}', j) and stat.S_IMODE(os.stat(os.path.join(D, 'jeton')).st_mode) == 0o600
    assert '--app=file://' + D + '/app/godgift.html?fenetre=' + j in args and '--user-data-dir=' + D + '/profil' in args, args
    assert hashlib.sha256(j.encode()).hexdigest() in open(os.path.join(D, 'app', 'gg_fenetre.js')).read() and not os.path.exists(os.path.join(SRC, 'gg_fenetre.js'))
    if _ == 0: j0 = j
assert j == j0
# V4 : la copie de l'utilisateur, reverifiee a chaque lancement ; modifiee, ou un fichier ajoute : rien n'est lance, un message le dit
def lancer_deb(path=None):
    if os.path.exists(TRACE): os.remove(TRACE)
    return subprocess.run(['sh', os.path.join(t, 'godgift-core')], capture_output=True, text=True, env={'HOME': maison, 'PATH': path or (faux + ':/usr/bin:/bin')}, timeout=60)
propre = open(os.path.join(D, 'app', 'gg_app.js'), 'rb').read(); A_ = lambda *x: os.path.join(D, 'app', *x)
piege_ = os.path.join(t, 'piege.html'); open(piege_, 'w').write('<p>piege</p>')
def lien(): os.rename(A_('godgift.html'), os.path.join(D, 'vrai.html')); os.symlink(piege_, A_('godgift.html'))
def sans_lien(): os.remove(A_('godgift.html')); os.rename(os.path.join(D, 'vrai.html'), A_('godgift.html'))
for nom, geste, defaire in (('gg_app.js modifie', lambda: open(A_('gg_app.js'), 'ab').write(b'\n;window.vole = 1;\n'), lambda: open(A_('gg_app.js'), 'wb').write(propre)),
                            ('un fichier en plus', lambda: open(A_('img', 'piege.js'), 'w').write('x'), lambda: os.remove(A_('img', 'piege.js'))),
                            ('un fichier en moins', lambda: os.rename(A_('gg_demo.js'), os.path.join(D, 'gg_demo.js')), lambda: os.rename(os.path.join(D, 'gg_demo.js'), A_('gg_demo.js'))),
                            ('godgift.html remplace par un lien', lien, sans_lien)):
    geste(); r = lancer_deb()
    assert r.returncode == 1 and 'GodGift Core refuse de s’ouvrir' in r.stderr and 'refuses to open' in r.stderr and D + '/app' in r.stderr and not os.path.exists(TRACE), (nom, r.returncode, r.stderr)
    defaire(); r = lancer_deb(); assert r.returncode == 0 and os.path.exists(TRACE), (nom, r.stderr)
# une fenetre de message s'ouvre quand le bureau en offre une (zenity ici, un faux qui note son texte)
ZEN = os.path.join(t, 'zenity.txt'); open(os.path.join(faux, 'zenity'), 'w').write('#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "%s"\n' % ZEN); os.chmod(os.path.join(faux, 'zenity'), 0o755)
open(os.path.join(D, 'app', 'gg_app.js'), 'ab').write(b'//'); r = lancer_deb()
assert r.returncode == 1 and '--error' in open(ZEN).read() and 'Supprimez le dossier' in open(ZEN).read() and not os.path.exists(TRACE)
open(os.path.join(D, 'app', 'gg_app.js'), 'wb').write(propre); os.remove(os.path.join(faux, 'zenity'))
# une nouvelle version du paquet (gg_empreinte.js change) : la copie est refaite, reverifiee, puis lancee
open(os.path.join(D, 'app', 'gg_empreinte.js'), 'a').write('// ancienne version\n'); open(os.path.join(D, 'app', 'gg_app.js'), 'ab').write(b'//')
r = lancer_deb(); assert r.returncode == 0 and os.path.exists(TRACE) and open(os.path.join(D, 'app', 'gg_app.js'), 'rb').read() == propre, r.stderr
vert('lanceur du .deb (V4) : la copie de l utilisateur est reverifiee a chaque lancement contre le SHA256SUMS du paquet ; un fichier modifie, ajoute, retire ou remplace par un lien : rien n est lance, un message en francais et en anglais (et une fenetre zenity) dit quoi faire ; une nouvelle version du paquet est recopiee puis verifiee')
open(os.path.join(faux, 'xdg-open'), 'w').write('#!/bin/sh\necho "$@" > "%s"\n' % TRACE); os.chmod(os.path.join(faux, 'xdg-open'), 0o755); os.remove(os.path.join(faux, 'chromium'))
r = subprocess.run(['sh', os.path.join(t, 'godgift-core')], capture_output=True, text=True, env={'HOME': maison, 'PATH': faux + ':/bin'}, timeout=60)
assert open(TRACE).read().strip() == 'file://' + SRC + '/godgift.html', open(TRACE).read()
shutil.rmtree(t)
vert('lanceur du .deb : copie par utilisateur, jeton dans un fichier 0600 garde d un lancement a l autre, empreinte a cote du programme, fenetre dediee avec son profil ; sans Chromium, le navigateur principal SANS jeton')
t, f = paquet(); maison = os.path.join(t, 'maison'); os.makedirs(maison)
open(os.path.join(f, 'app', 'gg_demo.js'), 'a').write('\nwindow.ALTERE = 1;\n')
r = installer(f, maison)
assert r.returncode != 0 and 'ALTERE' in r.stdout and not os.path.exists(os.path.join(maison, '.local', 'share', 'godgift-core', 'app')), r.stdout
shutil.rmtree(t)
t, f = paquet(); maison = os.path.join(t, 'maison'); os.makedirs(maison)
s = open(os.path.join(f, 'SHA256SUMS'), encoding='utf-8').read() + hashlib.sha256(b'').hexdigest() + '  app/../../.bashrc\n'
open(os.path.join(f, 'SHA256SUMS'), 'w', encoding='utf-8').write(s)
r = installer(f, maison)
assert r.returncode != 0 and 'SHA256SUMS ALTERE' in r.stdout and not os.path.exists(os.path.join(maison, '.local', 'share', 'godgift-core', 'app')), r.stdout
shutil.rmtree(t)
vert('installer_linux.sh : un fichier altere, ou une liste qui sortirait de app/ : rien n est installe')

# ------------------------------------------------------------------ installer_windows.ps1 et l'installateur .exe (lus)
ps = open(os.path.join(SOURCES, 'installer_windows.ps1'), encoding='utf-8-sig').read()
assert "Copy-Item -LiteralPath (Join-Path $ici 'app')" not in ps and 'foreach ($e in $liste)' in ps and "'godgift.html'" in ps
assert ps.count('verifier-installateur') == 5 and "'^app/[A-Za-z0-9_./-]+$'" in ps
assert "RandomNumberGenerator]::Create().GetBytes($o)" in ps and "'gg_fenetre.js'" in ps and '$url&fenetre=$jeton' in ps and ps.count('fenetre=') == 1
vert('installer_windows.ps1 : fichier par fichier, la liste seule, chaque copie reverifiee ; page godgift.html ; /verifier-installateur dans les cinq langues ; la fenetre dediee et son jeton (Edge ou Chrome seulement)')
nsi = open(os.path.join(SOURCES, 'installateur_windows.nsi'), encoding='utf-8').read()
assert 'app\\index.html' not in nsi and 'app/index.html' not in nsi and nsi.count('godgift.html') == 3 and 'Water Angel' not in nsi and 'The Angel of the Water' in nsi
assert 'Aucune donnée personnelle ; aucune clé conservée' in nsi and 'No personal data; no key kept' in nsi and nsi.count('verifier-installateur') == 5 and 'ne tient aucune' not in nsi
assert 'File /r /x gg_fenetre.js' in nsi and 'Call Jeton' in nsi and 'RandomNumberGenerator' in nsi and '$URL&fenetre=$JETON' in nsi and 'GG_APP' in nsi
vert('installateur Windows (.nsi) : godgift.html ; « aucune donnee personnelle ; aucune cle conservee » ; The Angel of the Water ; /verifier-installateur ; jeton de la fenetre dediee (PowerShell), jamais livre')

# ------------------------------------------------------------------ le .deb
deb = glob.glob(os.path.join(SOURCES, 'dist', 'godgift-core_*_all.deb'))[0]
contenu = subprocess.run(['dpkg-deb', '-c', deb], capture_output=True, text=True, check=True).stdout
ctrl = subprocess.run(['dpkg-deb', '-f', deb, 'Description'], capture_output=True, text=True, check=True).stdout
assert './usr/share/godgift-core/app/godgift.html' in contenu and './usr/share/godgift-core/SHA256SUMS' in contenu and 'Aucune donnee personnelle ; aucune cle conservee' in ctrl and 'ne tient aucune' not in ctrl and 'The Angel of the Water' in ctrl
lance = open(os.path.join(SOURCES, 'paquets', 'deb', 'godgift-core'), encoding='utf-8').read() + open(os.path.join(SOURCES, 'paquets', 'mac', 'godgift'), encoding='utf-8').read()
assert 'index.html' not in lance and lance.count('godgift.html') == 3 and 'gg_fenetre.js' not in contenu and 'fenetre=$J' in lance and 'shasum -a 256' in lance
x_ = tempfile.mkdtemp(prefix='gg_debx_'); subprocess.run(['dpkg-deb', '-x', deb, x_], check=True)
assert open(os.path.join(x_, 'usr', 'share', 'godgift-core', 'SHA256SUMS'), 'rb').read() == open(os.path.join(SOURCES, 'SHA256SUMS'), 'rb').read()
assert open(os.path.join(x_, 'usr', 'bin', 'godgift-core'), 'rb').read() == open(os.path.join(SOURCES, 'paquets', 'deb', 'godgift-core'), 'rb').read()
assert subprocess.run(['sha256sum', '--quiet', '--strict', '-c', 'SHA256SUMS'], cwd=os.path.join(x_, 'usr', 'share', 'godgift-core'), capture_output=True).returncode == 0
shutil.rmtree(x_)
vert('.deb : godgift.html ; la description dit « aucune donnee personnelle ; aucune cle conservee » ; les lanceurs Linux et Mac ouvrent godgift.html ; le paquet porte SHA256SUMS (sous /usr/share, juste) et le lanceur verificateur')

# ------------------------------------------------------------------ le lanceur Mac, joue pour de vrai (V4) : l'application extraite du zip
t = tempfile.mkdtemp(prefix='gg_mac_'); maison = os.path.join(t, 'maison'); os.makedirs(os.path.join(maison, 'Applications', 'Chromium.app'))
faux = os.path.join(t, 'bin'); os.makedirs(faux); TRACE = os.path.join(t, 'open.txt'); ALERTE = os.path.join(t, 'alerte.txt')
open(os.path.join(faux, 'open'), 'w').write('#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "%s"\n' % TRACE)
open(os.path.join(faux, 'osascript'), 'w').write('#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "%s"\n' % ALERTE)
for x in ('open', 'osascript'): os.chmod(os.path.join(faux, x), 0o755)
with zipfile.ZipFile(os.path.join(SOURCES, 'dist', K.NOM + '_Mac.zip')) as z: z.extractall(t)
RES = os.path.join(t, 'GodGift Core.app', 'Contents', 'Resources'); D = os.path.join(maison, 'Library', 'Application Support', 'GodGiftCore')
assert open(os.path.join(RES, 'SHA256SUMS'), 'rb').read() == open(os.path.join(SOURCES, 'SHA256SUMS'), 'rb').read()
def lancer_mac():
    for f in (TRACE, ALERTE):
        if os.path.exists(f): os.remove(f)
    return subprocess.run(['bash', os.path.join(t, 'GodGift Core.app', 'Contents', 'MacOS', 'godgift')], capture_output=True, text=True,
                          env={'HOME': maison, 'PATH': faux + ':/usr/bin:/bin', 'LC_ALL': 'C.UTF-8'}, timeout=60)
r = lancer_mac(); args = open(TRACE).read().split('\n'); j = open(os.path.join(D, 'jeton')).read().strip()
assert r.returncode == 0 and '--app=file://' + D.replace(' ', '%20') + '/app/godgift.html?fenetre=' + j in args and stat.S_IMODE(os.stat(os.path.join(D, 'jeton')).st_mode) == 0o600, (r.stderr, args)
open(os.path.join(D, 'app', 'gg_regles.js'), 'a').write('\n;window.vole = 1;\n'); r = lancer_mac()
assert r.returncode == 1 and not os.path.exists(TRACE) and 'refuse de s’ouvrir' in open(ALERTE).read() and 'display alert' in open(ALERTE).read(), (r.returncode, r.stderr)
shutil.rmtree(os.path.join(D, 'app')); r = lancer_mac(); assert r.returncode == 0 and os.path.exists(TRACE), r.stderr   # supprimee : refaite depuis l'application
shutil.rmtree(os.path.join(maison, 'Applications', 'Chromium.app')); r = lancer_mac()
assert r.returncode == 0 and open(TRACE).read().split('\n')[:2] == ['-a', 'Safari'], open(TRACE).read()        # Safari : le programme de l'application, verifie lui aussi
open(os.path.join(RES, 'app', 'gg_guide.js'), 'a').write('//'); r = lancer_mac()
assert r.returncode == 1 and not os.path.exists(TRACE) and 'refuse de s’ouvrir' in r.stderr
shutil.rmtree(t)
vert('lanceur Mac (V4) : la copie de l utilisateur, et le programme de l application ouvert par Safari, reverifies a chaque lancement contre Contents/Resources/SHA256SUMS ; modifies : rien n est lance, une alerte dit quoi faire ; la copie supprimee est refaite')

# ------------------------------------------------------------------ les textes
lis = open(os.path.join(SOURCES, 'LISEZ_MOI.txt'), encoding='utf-8-sig').read().replace('\r\n', '\n')
ci = open(os.path.join(SOURCES, 'Commencer ici.html'), encoding='utf-8').read()
def plat(s): return re.sub(r'\s+', ' ', s)
assert plat(JAMAIS_FR) in plat(lis) and plat(JAMAIS_EN) in plat(lis)
assert JAMAIS_FR in ci and JAMAIS_EN in ci and 'fichiers/app/godgift.html' in ci and 'fichiers/app/index.html' not in ci and '&amp;sans_installer=1' in ci and 'ne récupère aucun trésor' in ci
for nom, x in (('LISEZ_MOI.txt', lis), ('Commencer ici.html', ci)):
    assert 'The Angel of the Water' in x and 'Water Angel' not in x and 'Microsoft' not in x and chr(0x2014) not in x, nom
    assert 'verifier-installateur' in x and 'app.angedeleau.com' in x and 'ne tient aucune' not in x, nom
assert 'Aucune donnée personnelle ; aucune clé conservée' in lis and 'Aucune donnée personnelle ; aucune clé conservée' in ci and 'une fois signé (Certum)' in ci
vert('LISEZ_MOI.txt et Commencer ici.html : la regle JAMAIS mot pour mot (francais, anglais), The Angel of the Water, /verifier-installateur, Certum, app.angedeleau.com, ni Microsoft ni tiret cadratin')
print(f'\nBANC DES INSTALLATEURS : {OK[0]} verts, 0 rouge')
