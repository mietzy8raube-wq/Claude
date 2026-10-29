# GF Tracker – Startfenster der Testversion (Windows 10/11, nur Bordmittel: Windows PowerShell 5.1 + WinForms)
# Startet den Tracker unsichtbar im Hintergrund, zeigt den Zustand und öffnet ihn als eigenes App-Fenster.
# Alles läuft nur auf diesem Rechner (http://localhost:3100), ohne Verbindung zu anderen Programmen.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Base   = Split-Path -Parent $PSScriptRoot          # Paketordner (dieses Skript liegt in "programm")
$AppDir = Join-Path $Base 'app'
$Node   = Join-Path $Base 'runtime\node.exe'
$Data   = Join-Path $Base 'testdaten'
$LogDir = Join-Path $Base 'protokoll'
$LogFile = Join-Path $LogDir 'tracker.log'
$Icon   = Join-Path $PSScriptRoot 'gf-tracker.ico'
$Logo   = Join-Path $AppDir 'public\icons\icon-128.png'
$Port   = 3100
$Url    = "http://localhost:$Port"
$Title  = 'GF Tracker – Testversion'

# ---------- Nur ein Startfenster gleichzeitig ----------
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\GFTrackerTestversion', [ref]$created)
if (-not $created) {
    [System.Windows.Forms.MessageBox]::Show('Der GF Tracker läuft bereits. Das Startfenster ist in der Taskleiste.', $Title, 'OK', 'Information') | Out-Null
    exit
}

# ---------- Hilfsfunktionen ----------
function Find-AppBrowser {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    )
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

function Open-Tracker([string]$path) {
    $target = "$Url$path"
    $browser = Find-AppBrowser
    if ($browser) {
        # eigenes App-Fenster ohne Adressleiste – wirkt wie ein installiertes Programm
        Start-Process -FilePath $browser -ArgumentList "--app=$target", '--new-window'
    } else {
        Start-Process $target
    }
}

function Test-Health {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Proxy = $null
        $null = $wc.DownloadString("http://127.0.0.1:$Port/api/health")
        return $true
    } catch { return $false }
}

function Test-PortFree {
    try {
        $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $l.Start(); $l.Stop(); return $true
    } catch { return $false }
}

$script:proc = $null
function Start-Tracker {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
    if (-not (Test-PortFree)) {
        if (Test-Health) { return $true }   # läuft schon (z. B. aus einem früheren Start)
        [System.Windows.Forms.MessageBox]::Show("Port $Port wird von einem anderen Programm benutzt. Bitte dieses Programm beenden und den GF Tracker erneut starten.", $Title, 'OK', 'Warning') | Out-Null
        return $false
    }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Node
    $psi.Arguments = '--disable-warning=ExperimentalWarning server.mjs'
    $psi.WorkingDirectory = $AppDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $vars = @{
        PORT = "$Port"; HOST = '127.0.0.1'; APP_URL = $Url; DATA_DIR = $Data; SEED_DEMO = '1'
        COMPANY_NAME = 'druckluft-technik Chemnitz GmbH (Testversion)'; TZ = 'Europe/Berlin'; LOG_FILE = $LogFile
    }
    foreach ($k in $vars.Keys) { $psi.EnvironmentVariables[$k] = $vars[$k] }
    $script:proc = [System.Diagnostics.Process]::Start($psi)
    return $true
}

function Stop-Tracker {
    if ($script:proc -and -not $script:proc.HasExited) {
        try { $script:proc.Kill(); $script:proc.WaitForExit(5000) | Out-Null } catch { }
    }
    $script:proc = $null
}

function New-Shortcut([string]$file) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($file)
    $lnk.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
    $lnk.WorkingDirectory = $Base
    $lnk.IconLocation = $Icon
    $lnk.Description = 'GF Tracker – Testversion mit Beispieldaten'
    $lnk.Save()
}

# ---------- Fenster ----------
$accent = [System.Drawing.Color]::FromArgb(36, 54, 232)
$ink    = [System.Drawing.Color]::FromArgb(17, 24, 39)
$muted  = [System.Drawing.Color]::FromArgb(100, 110, 128)
$soft   = [System.Drawing.Color]::FromArgb(244, 246, 250)
$fontUi = New-Object System.Drawing.Font('Segoe UI', 9.5)

$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.ClientSize = New-Object System.Drawing.Size(520, 360)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::White
$form.Font = $fontUi
if (Test-Path $Icon) { $form.Icon = New-Object System.Drawing.Icon($Icon) }

$head = New-Object System.Windows.Forms.Panel
$head.SetBounds(0, 0, 520, 92); $head.BackColor = $soft
$form.Controls.Add($head)

$pic = New-Object System.Windows.Forms.PictureBox
$pic.SetBounds(24, 18, 56, 56); $pic.SizeMode = 'Zoom'
if (Test-Path $Logo) { $pic.Image = [System.Drawing.Image]::FromFile($Logo) }
$head.Controls.Add($pic)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = 'GF Tracker'; $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 17)
$lblTitle.ForeColor = $ink; $lblTitle.AutoSize = $true; $lblTitle.Location = New-Object System.Drawing.Point(94, 16)
$head.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = 'Testversion · Beispieldaten · läuft nur auf diesem Rechner'
$lblSub.ForeColor = $muted; $lblSub.AutoSize = $true; $lblSub.Location = New-Object System.Drawing.Point(97, 54)
$head.Controls.Add($lblSub)

$dot = New-Object System.Windows.Forms.Label
$dot.Text = '●'; $dot.Font = New-Object System.Drawing.Font('Segoe UI', 12); $dot.AutoSize = $true
$dot.ForeColor = [System.Drawing.Color]::FromArgb(217, 119, 6); $dot.Location = New-Object System.Drawing.Point(22, 108)
$form.Controls.Add($dot)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = 'Wird gestartet …'; $lblStatus.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
$lblStatus.ForeColor = $ink; $lblStatus.AutoSize = $true; $lblStatus.Location = New-Object System.Drawing.Point(44, 110)
$form.Controls.Add($lblStatus)

function New-Button([string]$text, [int]$x, [int]$y, [int]$w, [bool]$primary) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text; $b.SetBounds($x, $y, $w, 38); $b.FlatStyle = 'Flat'; $b.Cursor = 'Hand'
    if ($primary) {
        $b.BackColor = $accent; $b.ForeColor = [System.Drawing.Color]::White; $b.FlatAppearance.BorderSize = 0
        $b.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
    } else {
        $b.BackColor = [System.Drawing.Color]::White; $b.ForeColor = $ink
        $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(214, 219, 228)
    }
    $form.Controls.Add($b)
    return $b
}

$btnOpen  = New-Button 'Tracker öffnen'          24 146 230 $true
$btnLand  = New-Button 'Systemlandschaft (3D)'  266 146 230 $false
$btnLogin = New-Button 'Anmeldedaten'            24 194 148 $false
$btnLog   = New-Button 'Protokoll'              186 194 148 $false
$btnReset = New-Button 'Zurücksetzen'           348 194 148 $false
foreach ($b in @($btnOpen, $btnLand)) { $b.Enabled = $false }

$lblHint = New-Object System.Windows.Forms.Label
$lblHint.Text = "Anmelden: thomas.weber@druckluft-chemnitz.de   ·   Passwort: Passwort123!`nDieses Fenster offen lassen – Schließen beendet den GF Tracker."
$lblHint.ForeColor = $muted; $lblHint.SetBounds(24, 252, 480, 40)
$form.Controls.Add($lblHint)

$btnQuit = New-Button 'Beenden' 376 300 120 $false

# ---------- Aktionen ----------
$btnOpen.Add_Click({ Open-Tracker '/login' })
$btnLand.Add_Click({ Open-Tracker '/landschaft' })
$btnLog.Add_Click({ if (Test-Path $LogFile) { Start-Process notepad.exe -ArgumentList "`"$LogFile`"" } else { [System.Windows.Forms.MessageBox]::Show('Noch kein Protokoll vorhanden.', $Title) | Out-Null } })
$btnLogin.Add_Click({
    $msg = "Passwort für alle: Passwort123!`n`n" +
           "thomas.weber@druckluft-chemnitz.de   Administrator`n" +
           "anna.mueller@druckluft-chemnitz.de   Administratorin`n" +
           "mehmet.yilmaz@druckluft-chemnitz.de   Servicekoordinator`n" +
           "sarah.becker@druckluft-chemnitz.de   Service-Technikerin`n" +
           "lisa.schmidt@druckluft-chemnitz.de   Mitarbeiterin`n" +
           "jonas.neumann@druckluft-chemnitz.de   Mitarbeiter`n`n" +
           "Tipp: zweite Rolle in einem privaten Browserfenster anmelden (Strg+Umschalt+N)."
    [System.Windows.Forms.MessageBox]::Show($msg, "$Title – Anmeldedaten", 'OK', 'Information') | Out-Null
})
$btnReset.Add_Click({
    $r = [System.Windows.Forms.MessageBox]::Show("Alle Änderungen der Testversion löschen und die Beispieldaten neu anlegen?", $Title, 'YesNo', 'Question')
    if ($r -ne 'Yes') { return }
    Stop-Tracker
    Start-Sleep -Milliseconds 500
    Start-Sleep -Milliseconds 800
    if (Test-Path $Data) { Remove-Item -Recurse -Force $Data }
    $script:ready = $false; $script:openedOnce = $true; $script:waited = 0
    $dot.ForeColor = [System.Drawing.Color]::FromArgb(217, 119, 6)
    if (Start-Tracker) { $lblStatus.Text = 'Wird neu gestartet …' }
})
$btnQuit.Add_Click({ $form.Close() })
$form.Add_FormClosing({ Stop-Tracker })

# ---------- Zustand alle Sekunde prüfen ----------
$script:ready = $false; $script:openedOnce = $false; $script:waited = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
    if ($script:proc -and $script:proc.HasExited) {
        $dot.ForeColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
        $lblStatus.Text = 'Beendet – siehe „Protokoll“. Programm neu öffnen.'
        $btnOpen.Enabled = $false; $btnLand.Enabled = $false; $script:ready = $false
        return
    }
    if (-not $script:ready) {
        $script:waited++
        if (Test-Health) {
            $script:ready = $true
            $dot.ForeColor = [System.Drawing.Color]::FromArgb(22, 163, 74)
            $lblStatus.Text = "Bereit · $Url"
            $btnOpen.Enabled = $true; $btnLand.Enabled = $true
            if (-not $script:openedOnce) { $script:openedOnce = $true; Open-Tracker '/login' }
        } elseif ($script:waited -gt 60) {
            $lblStatus.Text = 'Start dauert ungewöhnlich lange – siehe „Protokoll“.'
        }
    }
})

$form.Add_Shown({
    # beim allerersten Start: Verknüpfungen anbieten
    $marker = Join-Path $Base 'programm\.verknuepfung'
    if (-not (Test-Path $marker)) {
        $r = [System.Windows.Forms.MessageBox]::Show('Verknüpfung „GF Tracker (Test)“ auf dem Desktop und im Startmenü anlegen?', $Title, 'YesNo', 'Question')
        if ($r -eq 'Yes') {
            try {
                New-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GF Tracker (Test).lnk')
                New-Shortcut (Join-Path ([Environment]::GetFolderPath('Programs')) 'GF Tracker (Test).lnk')
            } catch { }
        }
        Set-Content -Path $marker -Value 'ja'
    }
    if (Start-Tracker) { $timer.Start() } else { $lblStatus.Text = 'Nicht gestartet.' }
})

[System.Windows.Forms.Application]::Run($form)
Stop-Tracker
$mutex.ReleaseMutex()
