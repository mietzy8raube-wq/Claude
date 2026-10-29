#!/usr/bin/env python3
"""Baut das Testpaket für einen Laptop: entpacken, Doppelklick, ausprobieren.

Inhalt: der GF Tracker mit Systemlandschaft (3D) und Beispieldaten, dazu Node.js für Windows –
auf dem Laptop wird weder Python noch Internet noch eine andere Software gebraucht.
Der Tracker läuft nur auf dem Laptop selbst (http://localhost:3100) und verbindet sich mit nichts.

Aufruf:  python3 scripts/testpaket_bauen.py [Zielordner]   →  GF-Tracker-Testversion.zip
"""
import hashlib
import io
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE_VERSION = "22.22.0"
NODE_PKG = f"node-v{NODE_VERSION}-win-x64"
NAME = "GF-Tracker-Testversion"
PORT = 3100

APP_FILES = ["server.mjs", "package.json", "start.py", "lib", "public", "landscape"]

LAUNCHER_BAT = r"""@echo off
rem Startet das Startfenster des GF Trackers (ohne Konsolenfenster)
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0programm\GF-Tracker.ps1"
"""

STARTEN_BAT = rf"""@echo off
chcp 65001 >nul
title GF Tracker - Testversion
cd /d "%~dp0app"
rem Nur auf diesem Laptop erreichbar, Beispieldaten, keine Verbindung zu anderen Programmen
set PORT={PORT}
set HOST=127.0.0.1
set APP_URL=http://localhost:{PORT}
set DATA_DIR=%~dp0testdaten
set SEED_DEMO=1
set COMPANY_NAME=druckluft-technik Chemnitz GmbH (Testversion)
set TZ=Europe/Berlin
echo.
echo  ============================================================
echo   GF Tracker - Testversion
echo.
echo   Der Browser oeffnet sich gleich von selbst:
echo     http://localhost:{PORT}
echo.
echo   Anmelden:  thomas.weber@druckluft-chemnitz.de
echo   Passwort:  Passwort123!
echo   (weitere Rollen siehe LIESMICH.txt)
echo.
echo   Beenden: dieses Fenster schliessen
echo  ============================================================
echo.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){{try{{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:{PORT}/api/health | Out-Null; Start-Process 'http://localhost:{PORT}/login'; break}}catch{{Start-Sleep 1}}}}"
"%~dp0runtime\node.exe" --disable-warning=ExperimentalWarning server.mjs
echo.
echo Der GF Tracker wurde beendet. Falls oben eine Fehlermeldung steht (z. B. Port belegt),
echo bitte alle anderen Fenster "GF Tracker - Testversion" schliessen und erneut starten.
pause
"""

RESET_BAT = r"""@echo off
chcp 65001 >nul
title GF Tracker - Testdaten zuruecksetzen
echo Alle Aenderungen der Testversion werden geloescht und die Beispieldaten neu angelegt.
echo Vorher den GF Tracker beenden (dessen Fenster schliessen).
echo.
choice /M "Wirklich zuruecksetzen"
if errorlevel 2 goto ende
rmdir /s /q "%~dp0testdaten" 2>nul
echo Zurueckgesetzt. Beim naechsten Start sind die Beispieldaten wieder im Ausgangszustand.
:ende
pause
"""

MAC_COMMAND = f"""#!/bin/bash
# GF Tracker – Testversion für Mac/Linux (benötigt python3; Node.js wird beim ersten Start geladen)
cd "$(dirname "$0")/app" || exit 1
python3 start.py --demo --port {PORT}
"""

LIESMICH = f"""GF Tracker – Testversion
========================

Zum Ausprobieren auf dem Laptop: Vorgänge (Tickets), Projekte, Service-Desk, Kundenportal,
Dashboard und die Systemlandschaft (3D) mit Prozess- und Projekt-Leveln – mit Beispieldaten.

Der Tracker läuft nur auf diesem Laptop (http://localhost:{PORT}). Er verbindet sich mit keinem
anderen Programm (kein Microsoft 365, keine E-Mails, kein Internet nötig) und ist von anderen
Geräten aus nicht erreichbar. Alle Daten bleiben im Ordner "testdaten".


STARTEN (Windows)
-----------------
1. Die ZIP-Datei vor dem Entpacken freigeben: Rechtsklick → Eigenschaften → unten "Zulassen"
   ankreuzen → OK. (Sonst fragt Windows bei jedem Start nach.)
2. ZIP entpacken (Rechtsklick → "Alle extrahieren"), z. B. auf den Desktop.
3. Im entpackten Ordner doppelklicken auf:  GF Tracker starten.bat
   → Das Startfenster "GF Tracker – Testversion" öffnet sich. Beim ersten Mal fragt es, ob eine
     Verknüpfung auf dem Desktop und im Startmenü angelegt werden soll – danach startet man das
     Programm wie jedes andere über "GF Tracker (Test)".
   → Nach wenigen Sekunden steht dort "Bereit" und der Tracker öffnet sich als eigenes App-Fenster.
     Im Startfenster: "Tracker öffnen", "Systemlandschaft (3D)", "Anmeldedaten", "Protokoll",
     "Zurücksetzen" (Beispieldaten neu) und "Beenden".
   Falls Windows "Der Computer wurde durch Windows geschützt" meldet:
   "Weitere Informationen" → "Trotzdem ausführen".
4. Beenden: im Startfenster "Beenden" (oder das Startfenster schließen).

Öffnet sich kein Startfenster (manche Firmen-Laptops sperren PowerShell-Skripte):
"GF Tracker starten (ohne Startfenster).bat" verwenden – dann läuft der Tracker in einem schwarzen
Konsolenfenster, das geöffnet bleiben muss; der Browser öffnet sich von selbst.

Mac/Linux: "GF Tracker starten (Mac).command" (braucht python3, lädt beim ersten Start Node.js).


ANMELDEN – jede Rolle sieht etwas anderes (Passwort immer: Passwort123!)
-------------------------------------------------------------------------
  thomas.weber@druckluft-chemnitz.de    Administrator (sieht und darf alles)
  anna.mueller@druckluft-chemnitz.de    Administrator
  mehmet.yilmaz@druckluft-chemnitz.de   Servicekoordinator (Disposition, Service-Desk)
  sarah.becker@druckluft-chemnitz.de    Service-Technikerin (nur eigener Bereich)
  lisa.schmidt@druckluft-chemnitz.de    Mitarbeiterin
  jonas.neumann@druckluft-chemnitz.de   Mitarbeiter

Tipp: Zwei Rollen gleichzeitig ausprobieren – eine im normalen Fenster, eine im privaten Fenster
(Strg+Umschalt+N).


DAS SOLLTEN SIE AUSPROBIEREN
----------------------------
1. "Mein Tag": eigene Aufgaben, fällige Termine.
2. Service-Desk → Warteschlange: Störung öffnen → "Einplanen" → "Einsatz beginnen" → "Erledigt".
3. Oben "+ Erstellen": neuen Vorgang anlegen, Datei per Strg+V oder Ziehen anhängen.
4. Suche oben: einfach Text eingeben (z. B. "Kompressor").
5. Menü → Systemlandschaft (3D):
   - Standort Chemnitz anklicken → offene Vorgänge.
   - Fahnen = Projekte aus dem Tracker → "Als Level öffnen".
   - Oben "▶ Level" → Prozess "Wartung & Reparatur" als Spiel.
   - Im zweiten Browserfenster einen Vorgang ändern → in der Landschaft fährt der Würfel weiter.
6. Kundenportal: http://localhost:{PORT}/portal (Anfrage als Kunde stellen).
7. Einstellungen → Erscheinungsbild: Logo und Firmenfarbe.


ZURÜCKSETZEN
------------
"Testdaten zuruecksetzen.bat" löscht alle Änderungen; beim nächsten Start sind die
Beispieldaten wieder im Ausgangszustand.


HINWEISE
--------
- Die Testversion ist zum Kennenlernen. Für den echten Betrieb im Unternehmen siehe
  INBETRIEBNAHME.md im Projekt (eigener Server, Anmeldung, Microsoft 365, Sicherung).
- Port {PORT} belegt? Andere Fenster "GF Tracker - Testversion" schließen.
- Enthalten: Node.js {NODE_VERSION} (MIT-Lizenz, runtime/LICENSE), three.js (MIT-Lizenz).
"""


def make_ico():
    """Windows-Symbol aus den App-Icons (PNG-Einträge, ab Windows Vista unterstützt)."""
    import struct
    imgs = [(n, (ROOT / f"public/icons/icon-{n}.png").read_bytes()) for n in (16, 32, 64, 128)]
    head = struct.pack("<HHH", 0, 1, len(imgs)); offset = 6 + 16 * len(imgs); entries = b""; body = b""
    for n, data in imgs:
        entries += struct.pack("<BBBBHHII", n, n, 0, 0, 1, 32, len(data), offset + len(body)); body += data
    return head + entries + body


def node_windows():
    base = f"https://nodejs.org/dist/v{NODE_VERSION}/"
    sums = urllib.request.urlopen(base + "SHASUMS256.txt", timeout=60).read().decode()
    expected = next(l.split()[0] for l in sums.splitlines() if l.endswith(f"  {NODE_PKG}.zip"))
    data = urllib.request.urlopen(base + NODE_PKG + ".zip", timeout=300).read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit("Prüfsumme von Node.js stimmt nicht – Abbruch.")
    z = zipfile.ZipFile(io.BytesIO(data))
    return z.read(f"{NODE_PKG}/node.exe"), z.read(f"{NODE_PKG}/LICENSE")


def main():
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "dist").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{NAME}.zip"
    print(f"Node.js {NODE_VERSION} für Windows laden und prüfen …")
    node_exe, node_license = node_windows()
    print("Paket zusammenstellen …")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        def add_text(name, text, crlf=False, mode=0o644):
            info = zipfile.ZipInfo(f"{NAME}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED; info.external_attr = mode << 16
            z.writestr(info, (text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))
        for item in APP_FILES:
            src = ROOT / item
            files = [src] if src.is_file() else sorted(p for p in src.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
            for f in files:
                z.write(f, f"{NAME}/app/{f.relative_to(ROOT).as_posix()}")
        z.writestr(f"{NAME}/runtime/node.exe", node_exe)
        z.writestr(f"{NAME}/runtime/LICENSE", node_license)
        add_text("GF Tracker starten.bat", LAUNCHER_BAT, crlf=True)
        add_text("GF Tracker starten (ohne Startfenster).bat", STARTEN_BAT, crlf=True)
        ps1 = (ROOT / "scripts/testpaket/GF-Tracker.ps1").read_text(encoding="utf-8")
        info = zipfile.ZipInfo(f"{NAME}/programm/GF-Tracker.ps1", date_time=(2026, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, "\ufeff".encode("utf-8") + ps1.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8"))  # mit BOM: Umlaute in PowerShell 5.1
        z.writestr(f"{NAME}/programm/gf-tracker.ico", make_ico())
        add_text("Testdaten zuruecksetzen.bat", RESET_BAT, crlf=True)
        add_text("GF Tracker starten (Mac).command", MAC_COMMAND, mode=0o755)
        add_text("LIESMICH.txt", LIESMICH, crlf=True)
        inbetrieb = ROOT / "INBETRIEBNAHME.md"
        if inbetrieb.exists():
            z.write(inbetrieb, f"{NAME}/INBETRIEBNAHME.md")
    print(f"Fertig: {target} ({target.stat().st_size // 1048576} MB)")


if __name__ == "__main__":
    main()
