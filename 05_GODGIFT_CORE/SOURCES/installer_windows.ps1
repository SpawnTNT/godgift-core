# GodGift Core : l'installateur Windows. Il verifie chaque fichier, calcule l'empreinte, n'installe que les fichiers de SHA256SUMS
# (chacun reverifie apres copie), cree les raccourcis et lance.
# Rien a telecharger : GodGift Core s'ouvre dans une fenetre d'application de Microsoft Edge (ou Chrome), sinon dans le navigateur.
# Journal complet : %TEMP%\godgift_installation.log
param([switch]$Essai)   # -Essai : verifie et copie seulement (sans raccourci ni lancement), pour les bancs
$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$journal = Join-Path ([IO.Path]::GetTempPath()) 'godgift_installation.log'
try { Start-Transcript -Path $journal -Force | Out-Null } catch { }

function Chemin([string]$base, [string]$rel) { $x = $base; foreach ($p in ($rel -split '/')) { $x = Join-Path $x $p }; return $x }
function Fin([int]$code) { try { Stop-Transcript | Out-Null } catch { }; if (-not $Essai) { Read-Host "`n  Entree pour fermer / Enter to close" | Out-Null }; exit $code }

try {
  Write-Host ''
  Write-Host '  GodGift Core' -ForegroundColor Yellow
  Write-Host '  1 Francais   2 English   3 Espanol   4 Deutsch   5 Portugues'
  $choix = if ($Essai) { '1' } else { Read-Host '  >' }
  $lang = @{ '1' = 'fr'; '2' = 'en'; '3' = 'es'; '4' = 'de'; '5' = 'pt' }[[string]$choix]
  if (-not $lang) { $lang = 'fr' }
  $T = @{
    fr = @('Verification de chaque fichier...', 'FICHIER ALTERE OU MANQUANT', 'Installation annulee : ce programme n est pas celui que l auteur a publie.', 'Empreinte du programme', 'Comparez-la a celle que publie l auteur, ou verifiez le fichier sur angedeleau.com/verifier-installateur. Aucune donnee personnelle ; aucune cle conservee.', 'Installe ! GodGift Core s ouvre. Vous le retrouverez sur le Bureau et dans le menu Demarrer.', 'Desinstaller GodGift Core', 'Decompressez d abord l archive (clic droit > Extraire tout), puis double-cliquez sur Commencer ici dans le dossier extrait.', "Désinstaller GodGift Core ?`n`nSes fichiers et vos réglages seront effacés de cet ordinateur. Aucune clé ni aucune réponse n'est stockée ici.", "GodGift Core est désinstallé.")
    en = @('Checking every file...', 'ALTERED OR MISSING FILE', 'Installation cancelled: this is not the program the author published.', 'Program fingerprint', 'Compare it with the one the author publishes, or check the file on angedeleau.com/verifier-installateur. No personal data; no key kept.', 'Installed! GodGift Core is opening. You will find it on the Desktop and in the Start menu.', 'Uninstall GodGift Core', 'First extract the archive (right-click > Extract All), then double-click Commencer ici in the extracted folder.', "Uninstall GodGift Core?`n`nIts files and your settings will be removed from this computer. No key and no answer is stored here.", 'GodGift Core has been uninstalled.')
    es = @('Comprobando cada archivo...', 'ARCHIVO ALTERADO O AUSENTE', 'Instalacion cancelada: este no es el programa que publico el autor.', 'Huella del programa', 'Comparela con la que publica el autor, o verifique el archivo en angedeleau.com/verifier-installateur. Ningun dato personal; ninguna clave guardada.', 'Instalado. GodGift Core se abre; lo encontrara en el Escritorio y en el menu Inicio.', 'Desinstalar GodGift Core', 'Descomprima primero el archivo (clic derecho > Extraer todo) y ejecute el instalador desde la carpeta extraida.', "¿Desinstalar GodGift Core?`n`nSus archivos y sus ajustes se borrarán de este ordenador. Aquí no se guarda ninguna clave ni respuesta.", "GodGift Core se ha desinstalado.")
    de = @('Jede Datei wird geprueft...', 'VERAENDERTE ODER FEHLENDE DATEI', 'Installation abgebrochen: dies ist nicht das vom Autor veroeffentlichte Programm.', 'Fingerabdruck des Programms', 'Vergleichen Sie ihn mit dem des Autors, oder pruefen Sie die Datei auf angedeleau.com/verifier-installateur. Keine persoenlichen Daten; kein Schluessel gespeichert.', 'Installiert! GodGift Core oeffnet sich; Sie finden es auf dem Desktop und im Startmenue.', 'GodGift Core deinstallieren', 'Entpacken Sie zuerst das Archiv (Rechtsklick > Alle extrahieren) und starten Sie das Installationsprogramm aus dem entpackten Ordner.', "GodGift Core deinstallieren?`n`nSeine Dateien und Ihre Einstellungen werden von diesem Computer entfernt. Hier wird weder ein Schlüssel noch eine Antwort gespeichert.", 'GodGift Core wurde deinstalliert.')
    pt = @('A verificar cada ficheiro...', 'FICHEIRO ALTERADO OU EM FALTA', 'Instalacao cancelada: este nao e o programa publicado pelo autor.', 'Impressao do programa', 'Compare-a com a publicada pelo autor, ou verifique o ficheiro em angedeleau.com/verifier-installateur. Nenhum dado pessoal; nenhuma chave guardada.', 'Instalado! O GodGift Core abre-se; encontra-o no Ambiente de trabalho e no menu Iniciar.', 'Desinstalar o GodGift Core', 'Extraia primeiro o arquivo (clique direito > Extrair tudo) e execute o instalador a partir da pasta extraida.', "Desinstalar o GodGift Core?`n`nOs seus ficheiros e as suas definições serão apagados deste computador. Nenhuma chave nem resposta é guardada aqui.", 'O GodGift Core foi desinstalado.')
  }
  $M = $T[$lang]

  # 0. lance depuis l'interieur du zip ? Windows n'en extrait alors qu'un seul fichier
  $sommes = Join-Path $ici 'SHA256SUMS'
  if (-not (Test-Path -LiteralPath $sommes) -or -not (Test-Path -LiteralPath (Join-Path $ici 'app'))) {
    Write-Host "`n  $($M[7])" -ForegroundColor Red; Fin 1
  }

  # 1. chaque fichier, contre SHA256SUMS
  Write-Host "`n  $($M[0])"
  # seuls les fichiers de cette liste seront copies (un fichier ajoute a l'archive n'est jamais installe)
  $n = 0; $liste = @()
  foreach ($l in [IO.File]::ReadAllLines($sommes)) {
    if (-not $l.Trim()) { continue }
    $h, $p = $l -split '  ', 2
    if ($h -notmatch '^[0-9a-f]{64}$' -or $p -notmatch '^app/[A-Za-z0-9_./-]+$' -or $p -match '\.\.') { Write-Host "  $($M[1]) : $p" -ForegroundColor Red; Write-Host "  $($M[2])" -ForegroundColor Red; Fin 1 }
    $f = Chemin $ici $p
    if (-not (Test-Path -LiteralPath $f) -or (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower() -ne $h) {
      Write-Host "  $($M[1]) : $p" -ForegroundColor Red; Write-Host "  $($M[2])" -ForegroundColor Red; Fin 1
    }
    $liste += ,@($h, $p)
    $n++
  }
  $emp = (Get-FileHash -LiteralPath $sommes -Algorithm SHA256).Hash.ToLower()
  Write-Host "  $n / $n OK" -ForegroundColor Green
  Write-Host "`n  $($M[3]) :" -ForegroundColor Yellow
  Write-Host ("  " + (($emp -split '(.{4})' | Where-Object { $_ }) -join ' ')) -ForegroundColor Yellow
  Write-Host "  $($M[4])`n"

  # 2. l'installation, dans le dossier de l'utilisateur (aucun droit d'administrateur)
  $racine = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { [IO.Path]::GetTempPath() }
  $dest = Join-Path $racine 'GodGiftCore'
  $appDest = Join-Path $dest 'app'
  if (Test-Path -LiteralPath $appDest) { Remove-Item -LiteralPath $appDest -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($e in $liste) {   # fichier par fichier, la liste seule ; puis chaque copie est reverifiee sur place
    $f = Chemin $dest $e[1]
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $f) | Out-Null
    Copy-Item -LiteralPath (Chemin $ici $e[1]) -Destination $f -Force
    if ((Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower() -ne $e[0]) {
      Remove-Item -LiteralPath $appDest -Recurse -Force -ErrorAction SilentlyContinue
      Write-Host "  $($M[1]) : $($e[1])" -ForegroundColor Red; Write-Host "  $($M[2])" -ForegroundColor Red; Fin 1
    }
  }
  [IO.File]::WriteAllText((Join-Path $appDest 'gg_empreinte.js'), "/* Ecrit par l'installateur apres avoir verifie chaque fichier. */`nthis.GG_EMPREINTE = {`"empreinte`": `"$emp`", `"fichiers`": $n};`n")
  Get-ChildItem -LiteralPath $appDest -Recurse -File | ForEach-Object { try { Unblock-File -LiteralPath $_.FullName } catch { } }
  $index = Join-Path $appDest 'godgift.html'   # la page du programme installe (index.html est celle de la version web)
  $url = (New-Object Uri($index, [UriKind]::Absolute)).AbsoluteUri + "?lang=$lang"
  if ($Essai) { Write-Host "ESSAI OK $emp $n $url"; Fin 0 }

  # 3. la fenetre : Edge (present sur tout Windows 10/11), sinon Chrome, sinon le navigateur par defaut
  $nav = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
           "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
           "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") |
         Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  $profil = Join-Path $dest 'profil'
  $icone = Join-Path $appDest 'img\icone.ico'
  if ($nav) {
    # la fenetre dediee (contre-audit godgift N1) : un profil a elle seule, et un jeton de 32 octets tire ici au hasard, ecrit dans les
    # raccourcis seulement ; a cote du programme, son empreinte seule (gg_fenetre.js). Seule la fenetre de ces raccourcis envoie un
    # tresor sans retape ; ouvert autrement, GodGift Core fait retaper 16 caracteres de l'adresse de reception (deux morceaux tires
    # au hasard, masques a l'ecran).
    $o = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($o)
    $jeton = -join ($o | ForEach-Object { $_.ToString('x2') })
    $ej = -join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($jeton)) | ForEach-Object { $_.ToString('x2') })
    [IO.File]::WriteAllText((Join-Path $appDest 'gg_fenetre.js'), "/* Ecrit par l'installateur : l'empreinte du jeton de la fenetre dediee (le jeton n'est que dans les raccourcis). */`nthis.GG_FENETRE = {`"empreinte`": `"$ej`"};`n")
    $cible = $nav; $args_ = "--app=`"$url&fenetre=$jeton`" --user-data-dir=`"$profil`" --window-size=1360,880 --no-first-run --no-default-browser-check"
  }
  else { $cible = $index; $args_ = '' }   # le navigateur par defaut, sans jeton : la retape sera demandee avant chaque envoi

  # 4. les raccourcis (Bureau, menu Demarrer) et le desinstallateur ; un echec ici n'empeche pas le lancement
  $menu = Join-Path ([Environment]::GetFolderPath('Programs')) ''
  # le desinstallateur : il ferme les fenetres de GodGift Core (celles de son profil, et elles seules), retire raccourcis, inscription et dossier
  $des = Join-Path $dest 'desinstaller.ps1'
  Remove-Item -LiteralPath (Join-Path $dest 'desinstaller.cmd') -Force -ErrorAction SilentlyContinue
  $q = $M[8].Replace("'", "''"); $ok = $M[9].Replace("'", "''"); $n6 = $M[6].Replace("'", "''")
  $code = @"
# GodGift Core : le desinstallateur (ecrit par l'installateur). -Silencieux : sans question.
param([switch]`$Silencieux)
`$ErrorActionPreference = 'SilentlyContinue'
`$dest = '$($dest.Replace("'", "''"))'
Add-Type -AssemblyName System.Windows.Forms
if (-not `$Silencieux -and [System.Windows.Forms.MessageBox]::Show('$q', 'GodGift Core', 'YesNo', 'Question') -ne 'Yes') { exit 0 }
Get-CimInstance Win32_Process | Where-Object { `$_.CommandLine -and `$_.CommandLine.Contains((Join-Path `$dest 'profil')) } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }
Start-Sleep -Milliseconds 800
`$menu = [Environment]::GetFolderPath('Programs')
Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GodGift Core.lnk'), (Join-Path `$menu 'GodGift Core.lnk'), (Join-Path `$menu '$n6.lnk') -Force
Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GodGiftCore' -Recurse -Force
Set-Location `$env:TEMP
Start-Process -FilePath "`$env:ComSpec" -ArgumentList "/c ping -n 3 127.0.0.1 >nul & rmdir /s /q ```"`$dest```"" -WindowStyle Hidden
if (-not `$Silencieux) { [System.Windows.Forms.MessageBox]::Show('$ok', 'GodGift Core', 'OK', 'Information') | Out-Null }
"@
  [IO.File]::WriteAllText($des, $code, (New-Object Text.UTF8Encoding($true)))
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $desArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$des`""
  $bureau = Join-Path ([Environment]::GetFolderPath('Desktop')) 'GodGift Core.lnk'
  try {
    $sh = New-Object -ComObject WScript.Shell
    foreach ($lnk in @($bureau, (Join-Path $menu 'GodGift Core.lnk'))) {
      $s = $sh.CreateShortcut($lnk); $s.TargetPath = $cible; $s.Arguments = $args_; $s.IconLocation = $icone; $s.Description = 'GodGift Core'; $s.WorkingDirectory = $appDest; $s.Save()
    }
    $s = $sh.CreateShortcut((Join-Path $menu "$($M[6]).lnk")); $s.TargetPath = $ps; $s.Arguments = $desArgs; $s.IconLocation = $icone; $s.Save()
  } catch { Write-Host "  (raccourcis : $($_.Exception.Message))" -ForegroundColor DarkYellow }

  try {
    $cle = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GodGiftCore'
    $ver = [regex]::Match([IO.File]::ReadAllText((Join-Path $appDest 'gg_app.js')), 'VERSION = "([^"]+)"').Groups[1].Value
    $taille = [int]((Get-ChildItem -LiteralPath $appDest -Recurse -File | Measure-Object Length -Sum).Sum / 1024)
    New-Item -Path $cle -Force | Out-Null
    $v = @{ DisplayName = 'GodGift Core'; DisplayVersion = $ver; Publisher = "L'Ange de l'Eau"; DisplayIcon = $icone; InstallLocation = $dest
            UninstallString = "`"$ps`" $desArgs"; QuietUninstallString = "`"$ps`" $desArgs -Silencieux"; URLInfoAbout = 'https://angedeleau.com'; InstallDate = (Get-Date -Format 'yyyyMMdd') }
    foreach ($k in $v.Keys) { New-ItemProperty -Path $cle -Name $k -Value $v[$k] -PropertyType String -Force | Out-Null }
    foreach ($k in @{ NoModify = 1; NoRepair = 1; EstimatedSize = $taille }.GetEnumerator()) { New-ItemProperty -Path $cle -Name $k.Key -Value $k.Value -PropertyType DWord -Force | Out-Null }
  } catch { Write-Host "  (inscription : $($_.Exception.Message))" -ForegroundColor DarkYellow }

  Write-Host "  $($M[5])" -ForegroundColor Green
  if ($nav) { Start-Process -FilePath $nav -ArgumentList $args_ } else { Start-Process $index }
  Start-Sleep -Seconds 3
  try { Stop-Transcript | Out-Null } catch { }
  exit 0
}
catch {
  Write-Host "`n  ERREUR : $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Journal : $journal" -ForegroundColor Red
  Write-Host "  Solution simple : ouvrez 'Commencer ici' dans le dossier, puis 'Sans installer'." -ForegroundColor Yellow
  Fin 1
}
