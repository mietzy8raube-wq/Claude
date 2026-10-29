# GF Tracker auf dem eigenen Firmenserver in Betrieb nehmen

Ziel: Alle öffnen den Tracker (inkl. Systemlandschaft) im Browser unter einer festen internen Adresse,
z. B. **https://tracker.druckluft-chemnitz.de** – am PC, im Firmen-WLAN auf dem Handy, per VPN von unterwegs
und als Reiter in Microsoft Teams. Die Daten bleiben im eigenen Haus.

**Zeitbedarf:** ca. 1–2 Stunden für die IT (Schritte 1–8), Microsoft 365 optional ca. 30 Minuten.

---

## 0. Vorab mit der IT klären

| Frage | Empfehlung |
|---|---|
| **Wo läuft es?** | Eine kleine **Linux-VM** auf dem vorhandenen Host (Hyper-V, VMware, Proxmox): Ubuntu Server 24.04 LTS, 2 vCPU, 4 GB RAM, 20 GB Festplatte, **feste IP**. Reicht für 50+ Personen. Ein reiner Windows-Server ohne Linux-VM geht auch (Node.js + Reverse Proxy), ist aber aufwendiger |
| **Unter welchem Namen?** | Interner DNS-Eintrag, z. B. `tracker.druckluft-chemnitz.de` → IP der VM |
| **Welches Zertifikat?** | **A:** Es gibt schon ein Firmenzertifikat (z. B. Wildcard `*.druckluft-chemnitz.de` oder eine eigene Windows-Zertifizierungsstelle) → dieses verwenden. **B:** Es gibt keins → der Tracker bringt eine eigene kleine Zertifizierungsstelle mit; deren Stammzertifikat wird einmal per Gruppenrichtlinie verteilt |
| **Zugriff von unterwegs?** | Servicetechniker und Handys außerhalb des Firmennetzes: über das **vorhandene VPN** |
| **Kundenportal?** | Kunden erreichen einen internen Server nicht. Entweder das Portal vorerst nicht nutzen, oder später gezielt nur `/portal` über die Firewall veröffentlichen (eigener Schritt, mit der IT abstimmen) |
| **Sicherung?** | Die VM in die vorhandene Datensicherung aufnehmen (siehe „Laufender Betrieb“) |

> HTTPS ist Pflicht: Ohne vertrauenswürdiges Zertifikat lässt sich der Tracker nicht als App installieren,
> und Browser zeigen Warnungen. Deshalb Variante A oder B – nicht einfach „http://“.

## 1. Linux-VM anlegen

Ubuntu Server 24.04 LTS installieren (Standardinstallation, „OpenSSH server“ ankreuzen), feste IP vergeben.
Dann per SSH anmelden (Windows-PowerShell):

```bash
ssh benutzer@192.168.10.50
```

## 2. Docker und Git installieren

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker $USER      # danach einmal ab- und wieder anmelden
docker compose version             # Prüfung: zeigt eine Versionsnummer
```

## 3. Internen DNS-Eintrag anlegen

Auf dem Windows-DNS-Server (Active Directory): *DNS-Manager → Forward-Lookupzonen → Zone der Firma →
Neuer Host (A)* → Name `tracker`, IP der VM.

Gibt es intern keine Zone `druckluft-chemnitz.de`, den Namen der internen Zone verwenden
(z. B. `tracker.dtc.local`) – bei Variante A muss das Zertifikat dann auf diesen Namen lauten.

Prüfen an einem Firmen-PC: `nslookup tracker.druckluft-chemnitz.de` → IP der VM.

## 4. Programm holen

Auf github.com einen Lese-Token anlegen: *Settings → Developer settings → Personal access tokens →
Fine-grained tokens*, nur Repository `mietzy8raube-wq/Claude`, Berechtigung **Contents: Read-only**.
Der Token dient beim folgenden Befehl als Passwort:

```bash
git clone --branch claude/peaceful-rubin-48hyn5 https://github.com/mietzy8raube-wq/Claude.git ~/gf
cd ~/gf/tracker
```

(Sobald der Stand im Hauptzweig ist, `--branch …` anpassen.)

## 5. Einstellungen eintragen

```bash
cp .env.example .env
nano .env
```

```ini
APP_URL=https://tracker.druckluft-chemnitz.de
DOMAIN=tracker.druckluft-chemnitz.de
COMPANY_NAME=druckluft-technik Chemnitz GmbH
ADMIN_EMAIL=ihre.adresse@druckluft-chemnitz.de
ADMIN_NAME=Ihr Name
# Variante A (eigenes Zertifikat):
CADDYFILE=Caddyfile.intern-zertifikat
# Variante B (interne Zertifizierungsstelle) stattdessen:
# CADDYFILE=Caddyfile.intern-ca
```

`ADMIN_PASSWORD` leer lassen (dann wird ein Startpasswort erzeugt). **Kein** `SEED_DEMO=1`.
Speichern: `Strg+O`, `Enter`, schließen: `Strg+X`.

## 6. Zertifikat

### Variante A – eigenes Zertifikat

Zwei Dateien im PEM-Format nach `~/gf/tracker/certs/` legen:
- `certs/zertifikat.pem` – Zertifikat **inklusive Zwischenzertifikate**
- `certs/schluessel.pem` – privater Schlüssel (ohne Passwort)

Liegt das Zertifikat als `.pfx` vor (typisch bei Windows), umwandeln:

```bash
mkdir -p certs
openssl pkcs12 -in firma.pfx -nokeys -out certs/zertifikat.pem
openssl pkcs12 -in firma.pfx -nocerts -nodes -out certs/schluessel.pem
chmod 644 certs/zertifikat.pem && chmod 640 certs/schluessel.pem
```

Das Zertifikat muss auf `tracker.druckluft-chemnitz.de` (oder `*.druckluft-chemnitz.de`) lauten.

### Variante B – interne Zertifizierungsstelle

Nichts vorbereiten. Nach dem Start (Schritt 7) das Stammzertifikat herausholen:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./gf-tracker-stammzertifikat.crt
```

Die Datei auf den Domänencontroller kopieren und per **Gruppenrichtlinie** verteilen:
*Gruppenrichtlinienverwaltung → GPO bearbeiten → Computerkonfiguration → Richtlinien → Windows-Einstellungen →
Sicherheitseinstellungen → Richtlinien für öffentliche Schlüssel → Vertrauenswürdige Stammzertifizierungsstellen →
Importieren*. Danach an einem PC `gpupdate /force`.
- Edge und Chrome nutzen das Windows-Zertifikat automatisch. Firefox: Richtlinie „Enterprise Roots“ aktivieren.
- Handys (Firmen-WLAN/VPN): Zertifikat per Intune/MDM verteilen oder einmal von Hand installieren
  (iPhone: Profil installieren und unter *Einstellungen → Allgemein → Info → Zertifikatsvertrauen* einschalten).
- Das Stammzertifikat ist 10 Jahre gültig. Es liegt im Docker-Volume `tracker_caddy_data` – dieses mitsichern,
  sonst entsteht nach einer Neuinstallation ein neues, das wieder verteilt werden muss.

## 7. Starten

```bash
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
docker compose ps                                  # caddy und tracker: "running"
docker compose logs tracker | grep Startpasswort   # Startpasswort notieren
```

Dass HTTP auf Port 80 automatisch auf HTTPS umleitet, ist so gewollt.

## 8. Erste Anmeldung und Einrichtung

1. An einem Firmen-PC **https://tracker.druckluft-chemnitz.de** öffnen (Schloss-Symbol, keine Warnung).
2. Mit `ADMIN_EMAIL` und Startpasswort anmelden, sofort *Einstellungen → Profil → Passwort ändern*.
3. *Menü → Verwaltung → Erscheinungsbild*: Logo, Firmenfarbe, Name.
4. **Teams anlegen** (z. B. Geschäftsführung, Service & Technik, Büro & Vertrieb, Service Raum Leipzig) und jedem
   Team den **Standort** geben (Chemnitz, Siebenlehn, Zwenkau) – danach richtet sich die Systemlandschaft.
5. **Projekte anlegen**: z. B. Service-Desk (Typ Service), Geschäftsführung, Digitalisierung; Team zuordnen.
6. *Menü → Verwaltung → Personen & Zugänge → Person anlegen* mit **Rolle**, dann **Einladen**:
   Der Einladungslink (7 Tage gültig) per E-Mail/Teams weitergeben, jede Person legt ihr Passwort selbst fest.
7. Allen den Link geben; *App installieren* in Edge/Chrome, am Handy *Zum Startbildschirm*
   (QR-Code unter „Als App nutzen“). Systemlandschaft: Menü → *Systemlandschaft (3D)*.

---

## Optional: Microsoft 365

Funktioniert auch vom internen Server aus – der Tracker baut nur **ausgehende** HTTPS-Verbindungen auf.
Die Firewall muss ausgehend `login.microsoftonline.com` und `graph.microsoft.com` (Port 443) erlauben.

1. entra.microsoft.com → *App-Registrierungen → Neue Registrierung* „GF Tracker“.
2. Anwendungs-ID, Verzeichnis-ID, geheimen Clientschlüssel in `.env` eintragen
   (`MS_CLIENT_ID`, `MS_TENANT_ID`, `MS_CLIENT_SECRET`), `MAIL_SENDER=service@…`.
3. API-Berechtigungen (Microsoft Graph, Anwendung): `Mail.Send`, für das Service-Postfach `Mail.ReadWrite`,
   für Termine `Calendars.ReadWrite` → Administratorzustimmung erteilen.
4. Anmeldung mit Microsoft: Umleitungs-URI `https://tracker.druckluft-chemnitz.de/auth/microsoft/callback`
   (interne Adresse ist in Ordnung), in `.env` `SSO_MICROSOFT=1`.
5. `docker compose up -d`, im Tracker *Integrationen* prüfen und *Test-E-Mail an mich senden*.
6. **Teams-Reiter:** *Menü → Integrationen → Microsoft Teams → Teams-App herunterladen* → im Teams Admin Center
   hochladen. Der Reiter lädt die interne Adresse – er funktioniert im Firmennetz und per VPN.

Ausführlich: `ARCHITEKTUR.md`, Abschnitte 8 und 13.

## Laufender Betrieb

| Aufgabe | Wie |
|---|---|
| **Sicherung** | Der Tracker sichert jede Nacht nach `~/gf/tracker/data/backups` (14 Tage). Die **ganze VM** in die vorhandene Sicherung aufnehmen (z. B. Veeam, Hyper-V-Sicherung) – oder mindestens den Ordner `~/gf/tracker/data` und das Docker-Volume `tracker_caddy_data` |
| **Update** | `cd ~/gf/tracker && git pull && docker compose up -d --build` (braucht Internetzugang zu GitHub und Docker Hub) |
| **Zustand** | *Menü → System & Protokoll*, oder `https://…/api/health` |
| **Neustart** | `docker compose restart tracker` – nach einem Neustart der VM startet alles von selbst |
| **Protokoll** | `docker compose logs --tail 100 tracker` |
| **Zertifikat erneuern (A)** | neue Dateien nach `certs/` legen, `docker compose restart caddy` |

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| Browser warnt „Verbindung nicht sicher“ | **A:** Zertifikat lautet nicht auf den Namen oder Zwischenzertifikate fehlen in `zertifikat.pem`. **B:** Stammzertifikat noch nicht auf dem PC (`gpupdate /force`, Browser neu starten) |
| Seite nicht erreichbar | DNS-Eintrag (Schritt 3) prüfen; Firewall der VM bzw. des Netzes muss Port 443 (und 80) aus dem Firmennetz erlauben |
| `502 Bad Gateway` | Tracker startet noch – 1 Minute warten; sonst `docker compose logs tracker` |
| `permission denied` für `data` | `sudo chown -R 1000:1000 data` und `docker compose up -d` |
| Caddy startet nicht (Variante A) | `docker compose logs caddy` – meist falscher Dateiname in `certs/` oder Schlüssel mit Passwort |
| Startpasswort verloren | Vor der ersten Anmeldung: `docker compose down`, Ordner `data` löschen, neu starten. Danach: anderen Admin bitten, unter *Personen & Zugänge → Link zum Zurücksetzen* einen Link zu erzeugen |
| `git clone` scheitert | Token statt GitHub-Passwort eingeben, Berechtigung *Contents: Read* prüfen |

---

## Anhang: ohne Docker – direkt mit Python (auch Windows Server)

Wenn auf dem Server kein Docker laufen soll, z. B. auf einem **Windows Server**:

1. Python 3 installieren (python.org, bei Windows „Add python.exe to PATH“ ankreuzen) und den Ordner
   `tracker` auf den Server kopieren (z. B. `C:\GF-Tracker`).
2. Eingabeaufforderung **als Administrator** in diesem Ordner öffnen:
   ```
   python start.py
   ```
   Fragt Firmenname, Admin-E-Mail und optional das **Firmenzertifikat** ab – unter Windows einfach die
   `.pfx`-Datei samt Kennwort angeben. Mit Zertifikat läuft der Tracker auf Port 443 (https://…) und leitet
   Port 80 dorthin um. Node.js wird dabei automatisch geladen.
3. `python start.py --selbsttest` – alle Zeilen müssen „OK“ zeigen.
4. `python start.py --dienst-einrichten` – startet den Tracker künftig beim Hochfahren
   (Windows-Aufgabenplanung bzw. systemd unter Linux).
5. Windows-Firewall: Port freigeben, z. B.
   `netsh advfirewall firewall add rule name="GF Tracker" dir=in action=allow protocol=TCP localport=443`
6. DNS-Eintrag wie in Schritt 3, dann weiter mit Schritt 8 (Anmeldung und Einrichtung).

Protokoll: `logs\tracker.log`. Daten und nächtliche Sicherungen: `data\` – in die Server-Sicherung aufnehmen.

## Anhang: statt eigenem Server ein Cloud-Server

Soll der Tracker doch aus dem Internet erreichbar sein (z. B. für das Kundenportal), geht es auch mit einem
gemieteten Server in Deutschland (z. B. Hetzner Cloud, Image *Apps → Docker CE*, ca. 5–10 €/Monat,
Auftragsverarbeitungsvertrag abschließen). Unterschiede zu oben:
- Schritt 1–2 entfallen (Docker ist vorinstalliert), Schritt 3 ist ein **öffentlicher** DNS-Eintrag beim Domain-Anbieter.
- In `.env` **keine** `CADDYFILE`-Zeile: Das Zertifikat kommt automatisch und kostenlos von Let's Encrypt
  (Ports 80 und 443 müssen aus dem Internet erreichbar sein).
- Schritt 6 entfällt.
