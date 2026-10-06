#!/bin/sh
# GodGift Core : installateur Linux sans paquet (Fedora, Arch...). Sur Debian, Ubuntu, Raspberry Pi OS : preferer le .deb. Verifie chaque fichier,
# calcule l'empreinte, n'installe que les fichiers de SHA256SUMS (chacun reverifie apres copie), cree le lanceur.
set -e
ICI=$(cd "$(dirname "$0")" && pwd)
[ -f "$ICI/SHA256SUMS" ] || { echo "  Decompressez d'abord l'archive / extract the archive first"; exit 1; }
cd "$ICI"
echo "  GodGift Core"
echo "  1 Francais   2 English   3 Espanol   4 Deutsch   5 Portugues"
printf "  > "; read c || c=1
case "$c" in 2) L=en;; 3) L=es;; 4) L=de;; 5) L=pt;; *) L=fr;; esac
if grep -qvE '^[0-9a-f]{64}  app/[A-Za-z0-9_./-]+$' SHA256SUMS || grep -q '\.\.' SHA256SUMS; then echo "  SHA256SUMS ALTERE / ALTERED: installation annulee / cancelled"; exit 1; fi
if ! sha256sum --quiet -c SHA256SUMS; then echo "  FICHIER ALTERE : installation annulee / ALTERED FILE: installation cancelled"; exit 1; fi
EMP=$(sha256sum SHA256SUMS | cut -d' ' -f1)
N=$(grep -c . SHA256SUMS)
echo "  $N / $N OK"
echo "  Empreinte / fingerprint :"
echo "$EMP" | sed 's/\(....\)/\1 /g; s/^/  /'
echo "  Comparez-la a celle que publie l'auteur, ou verifiez le fichier sur angedeleau.com/verifier-installateur."
echo "  Compare it with the one the author publishes, or check the file on angedeleau.com/verifier-installateur."
echo "  Aucune donnee personnelle ; aucune cle conservee / No personal data; no key kept."
DEST="$HOME/.local/share/godgift-core"
rm -rf "$DEST/app"; mkdir -p "$DEST"
# la liste seule, fichier par fichier : un fichier ajoute a l'archive n'est jamais installe ; puis chaque copie est reverifiee sur place
while read -r h f; do mkdir -p "$DEST/$(dirname "$f")"; cp "$f" "$DEST/$f"; done < SHA256SUMS
if ! (cd "$DEST" && sha256sum --quiet -c "$ICI/SHA256SUMS"); then rm -rf "$DEST/app"; echo "  COPIE ALTEREE : installation annulee / ALTERED COPY: installation cancelled"; exit 1; fi
printf '/* Ecrit par l installateur apres avoir verifie chaque fichier. */\nthis.GG_EMPREINTE = {"empreinte": "%s", "fichiers": %s};\n' "$EMP" "$N" > "$DEST/app/gg_empreinte.js"
NAV=""
for b in chromium-browser chromium google-chrome google-chrome-stable microsoft-edge brave-browser; do command -v $b >/dev/null 2>&1 && { NAV=$b; break; }; done
URL="file://$DEST/app/godgift.html?lang=$L"
if [ -z "$NAV" ]; then
  # aucun navigateur pour une fenetre dediee : le navigateur principal, SANS jeton. GodGift Core y fonctionne, mais avant chaque envoi
  # d'un tresor il fait retaper 16 caracteres de l'adresse de reception (deux morceaux tires au hasard, masques a l'ecran), lus dans
  # le portefeuille.
  NAV=xdg-open; EXEC="xdg-open \"$URL\""
  echo "  Aucun Chromium, Chrome, Edge ni Brave : GodGift Core s'ouvre dans votre navigateur. Pour recuperer un tresor, il vous fera"
  echo "  retaper 16 caracteres de votre adresse de reception, en deux morceaux lus dans votre portefeuille. / No Chromium-based"
  echo "  browser: to recover a treasure, you will retype 16 characters of your receiving address, in two pieces read in your wallet."
else
  # la fenetre dediee (contre-audit godgift N1) : un profil a elle seule, et un jeton de 32 octets tire ici au hasard, qui n'est ecrit
  # que dans le lanceur (fichier lisible par vous seul) ; a cote du programme, son empreinte seule (gg_fenetre.js). Seule cette
  # fenetre envoie un tresor sans retape.
  JETON=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
  printf '/* Ecrit par l installateur : l empreinte du jeton de la fenetre dediee (le jeton n est que dans le lanceur). */\nthis.GG_FENETRE = {"empreinte": "%s"};\n' "$(printf '%s' "$JETON" | sha256sum | cut -d' ' -f1)" > "$DEST/app/gg_fenetre.js"
  URL="$URL&fenetre=$JETON"
  EXEC="$NAV \"--app=$URL\" \"--user-data-dir=$DEST/profil\" --window-size=1360,880 --no-first-run --no-default-browser-check"
fi
mkdir -p "$HOME/.local/share/applications"
umask 077
cat > "$HOME/.local/share/applications/godgift-core.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=GodGift Core
Comment=L'Ange de l'Eau / The Angel of the Water
Exec=$EXEC
Icon=$DEST/app/img/icone.png
Terminal=false
Categories=Game;Network;
EOD
[ -d "$HOME/Desktop" ] && cp "$HOME/.local/share/applications/godgift-core.desktop" "$HOME/Desktop/" && chmod 700 "$HOME/Desktop/godgift-core.desktop" || true
cat > "$DEST/desinstaller.sh" <<EOD
#!/bin/sh
# GodGift Core : le desinstallateur. Retire le programme, vos reglages et les lanceurs. Aucune cle n'est stockee ici.
pkill -f "user-data-dir=$DEST/profil" 2>/dev/null; sleep 1
rm -f "\$HOME/.local/share/applications/godgift-core.desktop" "\$HOME/Desktop/godgift-core.desktop"
rm -rf "$DEST"
echo "  GodGift Core : desinstalle / uninstalled"
EOD
chmod +x "$DEST/desinstaller.sh"
echo "  OK : menu > GodGift Core"
echo "  Desinstaller / uninstall : sh $DEST/desinstaller.sh"
if [ "$NAV" = xdg-open ]; then nohup xdg-open "$URL" >/dev/null 2>&1 &
else nohup "$NAV" "--app=$URL" "--user-data-dir=$DEST/profil" --window-size=1360,880 --no-first-run --no-default-browser-check >/dev/null 2>&1 &
fi
