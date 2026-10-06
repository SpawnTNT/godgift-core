; GodGift Core : le vrai installateur Windows (un seul fichier .exe, un double-clic).
; Construit par construire.py avec NSIS (makensis). Sans droit d'administrateur : tout va dans le compte de l'utilisateur.
; Il installe, cree les raccourcis, s'inscrit dans Parametres > Applications (avec un vrai desinstallateur) et lance.
; Definitions passees par construire.py : VERSION, EMPREINTE (groupes de 4), TAILLE_KO, SOURCE, SORTIE.

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user
!include "MUI2.nsh"

Name "GodGift Core"
OutFile "${SORTIE}"
InstallDir "$LOCALAPPDATA\GodGiftCore"
BrandingText "GodGift Core ${VERSION} · L'Ange de l'Eau"
VIProductVersion "${VERSION_NUM}.0"
VIAddVersionKey /LANG=0 "ProductName" "GodGift Core"
VIAddVersionKey /LANG=0 "FileDescription" "GodGift Core : installation"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "CompanyName" "L'Ange de l'Eau"
VIAddVersionKey /LANG=0 "LegalCopyright" "AGPL-3.0"

!define CLE "Software\Microsoft\Windows\CurrentVersion\Uninstall\GodGiftCore"
!define MUI_ICON "${SOURCE}\app\img\icone.ico"
!define MUI_UNICON "${SOURCE}\app\img\icone.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${SOURCE}\build_nsis\accueil.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${SOURCE}\build_nsis\accueil.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${SOURCE}\build_nsis\entete.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "${SOURCE}\build_nsis\entete.bmp"
!define MUI_ABORTWARNING
!define MUI_LANGDLL_ALLLANGUAGES
!define MUI_LANGDLL_REGISTRY_ROOT "HKCU"
!define MUI_LANGDLL_REGISTRY_KEY "${CLE}"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Langue"
!define MUI_LANGDLL_WINDOWTITLE "GodGift Core"
!define MUI_LANGDLL_INFO "Langue / Language / Idioma / Sprache / Língua"

!define MUI_WELCOMEPAGE_TITLE "$(t_bienvenue)"
!define MUI_WELCOMEPAGE_TEXT "$(t_bienvenue_texte)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "$(t_fini)"
!define MUI_FINISHPAGE_TEXT "$(t_fini_texte)"
!define MUI_FINISHPAGE_TEXT_LARGE
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "$(t_lancer)"
!define MUI_FINISHPAGE_RUN_FUNCTION Lancer
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "Portuguese"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString code ${LANG_FRENCH} "fr"
LangString code ${LANG_ENGLISH} "en"
LangString code ${LANG_SPANISH} "es"
LangString code ${LANG_GERMAN} "de"
LangString code ${LANG_PORTUGUESE} "pt"
LangString t_bienvenue ${LANG_FRENCH} "Bienvenue dans GodGift Core"
LangString t_bienvenue ${LANG_ENGLISH} "Welcome to GodGift Core"
LangString t_bienvenue ${LANG_SPANISH} "Bienvenido a GodGift Core"
LangString t_bienvenue ${LANG_GERMAN} "Willkommen bei GodGift Core"
LangString t_bienvenue ${LANG_PORTUGUESE} "Bem-vindo ao GodGift Core"
LangString t_bienvenue_texte ${LANG_FRENCH} "Le nœud de la chasse de L'Ange de l'Eau.$\r$\n$\r$\nIl suit les 24 coffres sur la chaîne Bitcoin, vérifie tout lui-même, fait chasser hors ligne et fait devenir compagnon.$\r$\n$\r$\nAucune donnée personnelle ; aucune clé conservée. Aucun droit d'administrateur n'est demandé.$\r$\n$\r$\nCliquez sur Installer."
LangString t_bienvenue_texte ${LANG_ENGLISH} "The node of the hunt of The Angel of the Water.$\r$\n$\r$\nIt follows the 24 chests on the Bitcoin chain, checks everything itself, lets you hunt offline and become a companion.$\r$\n$\r$\nNo personal data; no key kept. No administrator rights are needed.$\r$\n$\r$\nClick Install."
LangString t_bienvenue_texte ${LANG_SPANISH} "El nodo de la búsqueda de El Ángel del Agua.$\r$\n$\r$\nSigue los 24 cofres en la cadena Bitcoin, lo verifica todo por sí mismo, permite buscar sin conexión y hacerse compañero.$\r$\n$\r$\nNingún dato personal; ninguna clave guardada. No se necesitan derechos de administrador.$\r$\n$\r$\nHaga clic en Instalar."
LangString t_bienvenue_texte ${LANG_GERMAN} "Der Knoten der Schatzsuche des Wasserengels.$\r$\n$\r$\nEr verfolgt die 24 Truhen auf der Bitcoin-Kette, prüft alles selbst, lässt Sie offline suchen und Begleiter werden.$\r$\n$\r$\nKeine persönlichen Daten; kein Schlüssel gespeichert. Keine Administratorrechte nötig.$\r$\n$\r$\nKlicken Sie auf Installieren."
LangString t_bienvenue_texte ${LANG_PORTUGUESE} "O nó da caça de O Anjo da Água.$\r$\n$\r$\nSegue os 24 cofres na cadeia Bitcoin, verifica tudo sozinho, permite caçar offline e tornar-se companheiro.$\r$\n$\r$\nNenhum dado pessoal; nenhuma chave guardada. Não são precisos direitos de administrador.$\r$\n$\r$\nClique em Instalar."
LangString t_fini ${LANG_FRENCH} "GodGift Core est installé"
LangString t_fini ${LANG_ENGLISH} "GodGift Core is installed"
LangString t_fini ${LANG_SPANISH} "GodGift Core está instalado"
LangString t_fini ${LANG_GERMAN} "GodGift Core ist installiert"
LangString t_fini ${LANG_PORTUGUESE} "O GodGift Core está instalado"
LangString t_fini_texte ${LANG_FRENCH} "Sur le Bureau et dans le menu Démarrer.$\r$\n$\r$\nPour le retirer : Paramètres > Applications > GodGift Core.$\r$\n$\r$\nEmpreinte du programme :$\r$\n${EMPREINTE}$\r$\n$\r$\nComparez-la à celle que publie l'auteur, ou vérifiez l'installateur sur angedeleau.com/verifier-installateur."
LangString t_fini_texte ${LANG_ENGLISH} "On the Desktop and in the Start menu.$\r$\n$\r$\nTo remove it: Settings > Apps > GodGift Core.$\r$\n$\r$\nProgram fingerprint:$\r$\n${EMPREINTE}$\r$\n$\r$\nCompare it with the one the author publishes, or check the installer on angedeleau.com/verifier-installateur."
LangString t_fini_texte ${LANG_SPANISH} "En el Escritorio y en el menú Inicio.$\r$\n$\r$\nPara quitarlo: Configuración > Aplicaciones > GodGift Core.$\r$\n$\r$\nHuella del programa:$\r$\n${EMPREINTE}$\r$\n$\r$\nCompárela con la que publica el autor, o verifique el instalador en angedeleau.com/verifier-installateur."
LangString t_fini_texte ${LANG_GERMAN} "Auf dem Desktop und im Startmenü.$\r$\n$\r$\nZum Entfernen: Einstellungen > Apps > GodGift Core.$\r$\n$\r$\nFingerabdruck des Programms:$\r$\n${EMPREINTE}$\r$\n$\r$\nVergleichen Sie ihn mit dem des Autors, oder prüfen Sie das Installationsprogramm auf angedeleau.com/verifier-installateur."
LangString t_fini_texte ${LANG_PORTUGUESE} "No Ambiente de trabalho e no menu Iniciar.$\r$\n$\r$\nPara o remover: Definições > Aplicações > GodGift Core.$\r$\n$\r$\nImpressão do programa:$\r$\n${EMPREINTE}$\r$\n$\r$\nCompare-a com a publicada pelo autor, ou verifique o instalador em angedeleau.com/verifier-installateur."
LangString t_lancer ${LANG_FRENCH} "Ouvrir GodGift Core"
LangString t_lancer ${LANG_ENGLISH} "Open GodGift Core"
LangString t_lancer ${LANG_SPANISH} "Abrir GodGift Core"
LangString t_lancer ${LANG_GERMAN} "GodGift Core öffnen"
LangString t_lancer ${LANG_PORTUGUESE} "Abrir o GodGift Core"
LangString t_desinst ${LANG_FRENCH} "Désinstaller GodGift Core"
LangString t_desinst ${LANG_ENGLISH} "Uninstall GodGift Core"
LangString t_desinst ${LANG_SPANISH} "Desinstalar GodGift Core"
LangString t_desinst ${LANG_GERMAN} "GodGift Core deinstallieren"
LangString t_desinst ${LANG_PORTUGUESE} "Desinstalar o GodGift Core"

Var NAV
Var URL
Var JETON

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd
Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

; le chemin d'installation en adresse file:/// (barres obliques, espaces en %20)
Function VersUrl
  StrCpy $1 ""
  StrCpy $2 0
  boucle:
    StrCpy $3 $INSTDIR 1 $2
    StrCmp $3 "" fin
    StrCmp $3 "\" 0 +3
      StrCpy $1 "$1/"
      Goto suite
    StrCmp $3 " " 0 +3
      StrCpy $1 "$1%20"
      Goto suite
    StrCpy $1 "$1$3"
  suite:
    IntOp $2 $2 + 1
    Goto boucle
  fin:
  StrCpy $URL "file:///$1/app/godgift.html?lang=$(code)"
FunctionEnd

; la fenetre : Edge (present sur tout Windows 10/11), sinon Chrome, sinon le navigateur par defaut
Function Navigateur
  StrCpy $NAV ""
  ReadEnvStr $4 "ProgramFiles(x86)"
  ReadEnvStr $5 "ProgramW6432"
  StrCmp $4 "" +4
  IfFileExists "$4\Microsoft\Edge\Application\msedge.exe" 0 +3
    StrCpy $NAV "$4\Microsoft\Edge\Application\msedge.exe"
    Return
  StrCmp $5 "" +4
  IfFileExists "$5\Microsoft\Edge\Application\msedge.exe" 0 +3
    StrCpy $NAV "$5\Microsoft\Edge\Application\msedge.exe"
    Return
  IfFileExists "$PROGRAMFILES32\Microsoft\Edge\Application\msedge.exe" 0 +3
    StrCpy $NAV "$PROGRAMFILES32\Microsoft\Edge\Application\msedge.exe"
    Return
  IfFileExists "$PROGRAMFILES64\Microsoft\Edge\Application\msedge.exe" 0 +3
    StrCpy $NAV "$PROGRAMFILES64\Microsoft\Edge\Application\msedge.exe"
    Return
  IfFileExists "$LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe" 0 +3
    StrCpy $NAV "$LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    Return
  IfFileExists "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe" 0 +3
    StrCpy $NAV "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe"
    Return
  IfFileExists "$PROGRAMFILES32\Google\Chrome\Application\chrome.exe" 0 +3
    StrCpy $NAV "$PROGRAMFILES32\Google\Chrome\Application\chrome.exe"
    Return
  StrCmp $5 "" +4
  IfFileExists "$5\Google\Chrome\Application\chrome.exe" 0 +3
    StrCpy $NAV "$5\Google\Chrome\Application\chrome.exe"
    Return
  StrCmp $4 "" +4
  IfFileExists "$4\Google\Chrome\Application\chrome.exe" 0 +3
    StrCpy $NAV "$4\Google\Chrome\Application\chrome.exe"
    Return
  IfFileExists "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe" 0 +2
    StrCpy $NAV "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
FunctionEnd

; la fenetre dediee (contre-audit godgift N1) : un profil a elle seule, et un jeton de 32 octets tire ici au hasard, ecrit dans les
; raccourcis seulement ; a cote du programme, son empreinte seule (app\gg_fenetre.js). Seule la fenetre de ces raccourcis envoie un
; tresor sans retape. NSIS ne sait ni tirer au hasard ni calculer un SHA-256 : PowerShell le fait (le dossier lui est passe par une
; variable d'environnement, jamais dans la ligne de commande). En cas d'echec : aucun jeton, et GodGift Core fera retaper 16 caracteres
; de l'adresse de reception (deux morceaux tires au hasard, masques a l'ecran) avant chaque envoi.
Function Jeton
  StrCpy $JETON ""
  System::Call 'Kernel32::SetEnvironmentVariable(t "GG_APP", t "$INSTDIR\app")i'
  nsExec::ExecToStack `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$o = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($$o); $$j = -join ($$o | ForEach-Object { $$_.ToString('x2') }); $$e = -join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($$j)) | ForEach-Object { $$_.ToString('x2') }); $$q = [char]34; [IO.File]::WriteAllText((Join-Path $$env:GG_APP 'gg_fenetre.js'), '/* Ecrit par l installateur : l empreinte du jeton de la fenetre dediee (le jeton n est que dans les raccourcis). */' + [char]10 + 'this.GG_FENETRE = {' + $$q + 'empreinte' + $$q + ': ' + $$q + $$e + $$q + '};' + [char]10); [Console]::Out.Write($$j)"`
  Pop $0
  Pop $1
  StrCmp $0 "0" 0 echec
  StrLen $2 $1
  IntCmp $2 64 0 echec echec
  IfFileExists "$INSTDIR\app\gg_fenetre.js" 0 echec
  StrCpy $JETON $1
  StrCpy $URL "$URL&fenetre=$JETON"
  Return
  echec:
  Delete "$INSTDIR\app\gg_fenetre.js"
FunctionEnd

!macro Raccourci CHEMIN
  StrCmp $NAV "" +3
    CreateShortcut "${CHEMIN}" "$NAV" '--app="$URL" --user-data-dir="$INSTDIR\profil" --window-size=1360,880 --no-first-run --no-default-browser-check' "$INSTDIR\app\img\icone.ico" 0
    Goto +2
    CreateShortcut "${CHEMIN}" "$INSTDIR\app\godgift.html" "" "$INSTDIR\app\img\icone.ico" 0
!macroend

Section "GodGift Core"
  ; une version precedente (installateur PowerShell ou .exe) est remplacee proprement ; les reglages (profil) sont gardes
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\desinstaller.ps1"
  Delete "$INSTDIR\desinstaller.cmd"
  Delete "$SMPROGRAMS\GodGift Core.lnk"
  Delete "$SMPROGRAMS\$(t_desinst).lnk"
  SetOutPath "$INSTDIR\app"
  File /r /x gg_fenetre.js "${SOURCE}\app\*.*"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Desinstaller GodGift Core.exe"

  Call VersUrl
  Call Navigateur
  StrCmp $NAV "" +2
    Call Jeton
  !insertmacro Raccourci "$DESKTOP\GodGift Core.lnk"
  CreateDirectory "$SMPROGRAMS\GodGift Core"
  !insertmacro Raccourci "$SMPROGRAMS\GodGift Core\GodGift Core.lnk"
  CreateShortcut "$SMPROGRAMS\GodGift Core\$(t_desinst).lnk" "$INSTDIR\Desinstaller GodGift Core.exe" "" "$INSTDIR\app\img\icone.ico" 0

  ; Parametres > Applications > Applications installees
  WriteRegStr HKCU "${CLE}" "DisplayName" "GodGift Core"
  WriteRegStr HKCU "${CLE}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${CLE}" "Publisher" "L'Ange de l'Eau"
  WriteRegStr HKCU "${CLE}" "DisplayIcon" "$INSTDIR\app\img\icone.ico"
  WriteRegStr HKCU "${CLE}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${CLE}" "UninstallString" '"$INSTDIR\Desinstaller GodGift Core.exe"'
  WriteRegStr HKCU "${CLE}" "QuietUninstallString" '"$INSTDIR\Desinstaller GodGift Core.exe" /S'
  WriteRegStr HKCU "${CLE}" "URLInfoAbout" "https://angedeleau.com"
  WriteRegDWORD HKCU "${CLE}" "NoModify" 1
  WriteRegDWORD HKCU "${CLE}" "NoRepair" 1
  WriteRegDWORD HKCU "${CLE}" "EstimatedSize" ${TAILLE_KO}
SectionEnd

Function Lancer
  StrCmp $NAV "" +3
    Exec '"$NAV" --app="$URL" --user-data-dir="$INSTDIR\profil" --window-size=1360,880 --no-first-run --no-default-browser-check'
    Return
  ExecShell "open" "$INSTDIR\app\godgift.html"
FunctionEnd

Section "Uninstall"
  ; d'abord les fenetres de GodGift Core, et elles seules : celles qui utilisent son profil
  nsExec::Exec `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.CommandLine -and $$_.CommandLine.Contains('$INSTDIR\profil') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`
  Pop $0
  Sleep 800
  Delete "$DESKTOP\GodGift Core.lnk"
  RMDir /r "$SMPROGRAMS\GodGift Core"
  Delete "$SMPROGRAMS\GodGift Core.lnk"
  DeleteRegKey HKCU "${CLE}"
  RMDir /r "$INSTDIR"
SectionEnd
