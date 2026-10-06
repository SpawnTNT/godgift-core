# -*- coding: utf-8 -*-
"""LA PIERRE EMBARQUEE : GG_PIERRE.sha256 (app/gg_pierre.js) doit etre le SHA-256 de trousse/01_PIERRE/PIERRE_DU_PROGRAMME_V1j.md.

gg_pierre.js est ecrit par construire.py : si ce test echoue, la Pierre a change depuis la derniere construction ; relancer
construire.py (il regenere gg_pierre.js), puis ce test. Ce test ne corrige rien lui-meme.
Lancement : python3 test_pierre_embarquee.py   (code retour 0 si identiques, 1 sinon)"""
import hashlib, json, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
JS = os.path.abspath(os.path.join(ICI, '..', 'app', 'gg_pierre.js'))
MD = os.path.abspath(os.path.join(ICI, '..', '..', '..', '01_PIERRE', 'PIERRE_DU_PROGRAMME_V1j.md'))


def pierre_embarquee():
    t = open(JS, encoding='utf-8').read()
    debut = t.index('this.GG_PIERRE = ') + len('this.GG_PIERRE = ')
    return json.loads(t[debut:t.rindex(';')])


def main():
    g = pierre_embarquee()
    attendu = hashlib.sha256(open(MD, 'rb').read()).hexdigest()
    interne = hashlib.sha256(g['texte'].encode('utf-8')).hexdigest()
    print('Pierre de la trousse     :', MD)
    print('  SHA-256                :', attendu)
    print('Pierre embarquee         :', JS)
    print('  GG_PIERRE.sha256       :', g['sha256'])
    print('  SHA-256 de son texte   :', interne)
    rouges = []
    if interne != g['sha256']:
        rouges.append('gg_pierre.js incoherent : GG_PIERRE.sha256 n est pas le SHA-256 de GG_PIERRE.texte')
    if g['sha256'] != attendu:
        rouges.append('GG_PIERRE.sha256 differe du SHA-256 de 01_PIERRE/PIERRE_DU_PROGRAMME_V1j.md : relancer construire.py')
    if rouges:
        for r in rouges:
            print('  ROUGE :', r)
        print(f'\nLA PIERRE EMBARQUEE : {len(rouges)} rouge(s)')
        return 1
    print('\nLA PIERRE EMBARQUEE : 1 vert, 0 rouge (GodGift Core embarque la Pierre de la trousse)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
