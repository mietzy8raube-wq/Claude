# GF Tracker in Betrieb nehmen – Schritt für Schritt

Ziel: Alle öffnen den Tracker (inkl. Systemlandschaft) im Browser unter einer festen Adresse,
z. B. **https://tracker.druckluft-chemnitz.de** – am PC, auf dem Handy und in Microsoft Teams.

**Zeitbedarf:** ca. 1 Stunde (Schritte 1–9), Microsoft 365 optional ca. 30 Minuten.
**Kosten:** Cloud-Server ca. 5–10 € im Monat.

Benötigt:
- Zugang zur Verwaltung Ihrer Domain (DNS), z. B. beim Anbieter von druckluft-chemnitz.de oder beim IT-Dienstleister
- Zugang zu GitHub (Repository `mietzy8raube-wq/Claude`)
- Ein PC mit Windows-PowerShell, macOS-Terminal oder Linux

---

## 1. Server mieten

Beispiel Hetzner Cloud (Rechenzentrum in Deutschland, Auftragsverarbeitungsvertrag online abschließbar):

1. Konto anlegen auf hetzner.com → *Cloud* → neues Projekt „GF Tracker“.
2. *Server hinzufügen*:
   - Standort: **Nürnberg** oder **Falkenstein**
   - Image: Reiter **Apps → Docker CE** (Docker ist dann schon installiert)
   - Typ: kleinster Typ mit 2 vCPU / 4 GB (reicht für 50+ Personen)
   - SSH-Schlüssel hinzufügen (empfohlen) – ohne Schlüssel kommt das Root-Passwort per E-Mail
   - Name: `gf-tracker`
3. Die **IPv4-Adresse** des Servers notieren (z. B. `203.0.113.10`).
4. Im Hetzner-Konto den **Auftragsverarbeitungsvertrag (AVV)** abschließen (Datenschutz).

Andere Anbieter (IONOS, Strato, netcup) oder ein eigener Linux-Server gehen genauso – Voraussetzung:
Linux mit Docker, Ports **80 und 443** aus dem Internet erreichbar.

## 2. Adresse (DNS) einrichten

Bei der Domain-Verwaltung einen **A-Record** anlegen:

| Name | Typ | Wert |
|---|---|---|
| `tracker` | A | IPv4-Adresse des Servers |

Prüfen (nach 5–30 Minuten), in PowerShell: `nslookup tracker.druckluft-chemnitz.de` → muss die Server-IP zeigen.
**Erst weitermachen, wenn das stimmt** – sonst klappt das HTTPS-Zertifikat in Schritt 6 nicht.

## 3. Mit dem Server verbinden

In PowerShell / Terminal:

```bash
ssh root@203.0.113.10
```

(IP ersetzen; beim ersten Mal die Rückfrage mit `yes` bestätigen.)

## 4. Programm auf den Server holen

GitHub-Zugang für den Server: auf github.com → *Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token*, nur Repository `mietzy8raube-wq/Claude`, Berechtigung
**Contents: Read-only**. Den Token kopieren – er dient beim folgenden Befehl als Passwort.

```bash
git clone --branch claude/peaceful-rubin-48hyn5 https://github.com/mietzy8raube-wq/Claude.git gf
cd gf/tracker
```

(Benutzername = GitHub-Name, Passwort = der Token.) Sobald der Stand in den Hauptzweig übernommen ist,
`--branch …` entsprechend anpassen.

## 5. Einstellungen eintragen

```bash
cp .env.example .env
nano .env
```

Mindestens diese Zeilen anpassen:

```ini
APP_URL=https://tracker.druckluft-chemnitz.de
DOMAIN=tracker.druckluft-chemnitz.de
COMPANY_NAME=druckluft-technik Chemnitz GmbH
ADMIN_EMAIL=ihre.adresse@druckluft-chemnitz.de
ADMIN_NAME=Ihr Name
```

`ADMIN_PASSWORD` leer lassen (dann wird ein sicheres Startpasswort erzeugt). **Kein** `SEED_DEMO=1` –
sonst kommen Beispieldaten in den Echtbetrieb.
Speichern: `Strg+O`, `Enter`, schließen: `Strg+X`.

## 6. Starten

```bash
mkdir -p data && chown 1000:1000 data
docker compose up -d --build
```

Nach 1–2 Minuten prüfen:

```bash
docker compose ps                          # beide Dienste "running" / "healthy"
docker compose logs tracker | grep Startpasswort
```

Das **Startpasswort** notieren.

## 7. Erste Anmeldung

1. Im Browser **https://tracker.druckluft-chemnitz.de** öffnen (Schloss-Symbol = HTTPS ok).
2. Mit `ADMIN_EMAIL` und dem Startpasswort anmelden.
3. Sofort **Einstellungen → Profil → Passwort ändern**.

## 8. Einrichten (im Browser, als Administrator)

Reihenfolge, die sich bewährt:

1. **Menü → Verwaltung → Erscheinungsbild:** Logo, Firmenfarbe, Name.
2. **Teams anlegen** (z. B. Geschäftsführung, Service & Technik, Büro & Vertrieb, Service Raum Leipzig)
   und jedem Team den **Standort** geben (Chemnitz, Siebenlehn, Zwenkau) – danach richtet sich die Systemlandschaft.
3. **Projekte anlegen:** z. B. Service-Desk (Typ Service), Geschäftsführung, Digitalisierung; Projekt-Team zuordnen.
4. **Personen einladen:** *Menü → Verwaltung → Personen & Zugänge → Person anlegen* mit passender **Rolle**
   (Geschäftsführung, Servicekoordinator, Service-Techniker, Mitarbeiter, Nur lesen).
   Dann **Einladen** klicken: Der Tracker erzeugt einen **Einladungslink** (7 Tage gültig) – per E-Mail/Teams weitergeben,
   die Person legt ihr Passwort selbst fest.
5. Optional: **Kunden** per Import-Assistent (Excel/CSV) übernehmen, **Automatik-Regeln** anlegen.

## 9. Allen Bescheid geben

- Link: **https://tracker.druckluft-chemnitz.de**
- Als App: in Edge/Chrome Menü → *App installieren*; am Handy *Zum Startbildschirm*.
  Der **QR-Code** dafür steht im Tracker unter „Als App nutzen“.
- Systemlandschaft: Menü → *Systemlandschaft (3D)* bzw. **…/landschaft**

---

## Optional: Microsoft 365 (Anmeldung, E-Mails, Teams, Kalender)

Durch eine/n Microsoft-365-Administrator/in, ausführlich in `ARCHITEKTUR.md` Abschnitt 8 und 13:

1. entra.microsoft.com → *App-Registrierungen → Neue Registrierung* „GF Tracker“.
2. Anwendungs-ID, Verzeichnis-ID und einen geheimen Clientschlüssel in `.env` eintragen
   (`MS_CLIENT_ID`, `MS_TENANT_ID`, `MS_CLIENT_SECRET`), `MAIL_SENDER=service@…`.
3. API-Berechtigungen (Microsoft Graph, Anwendung): `Mail.Send` (+ `Mail.ReadWrite` für das Service-Postfach,
   `Calendars.ReadWrite` für Termine) → Administratorzustimmung erteilen.
4. Anmeldung mit Microsoft: Umleitungs-URI `https://tracker.druckluft-chemnitz.de/auth/microsoft/callback`,
   in `.env` `SSO_MICROSOFT=1`.
5. `docker compose up -d` und im Tracker *Einstellungen → Test-E-Mail an mich senden*.
6. **Teams-App:** *Menü → Integrationen → Microsoft Teams → Teams-App herunterladen* →
   im Teams Admin Center hochladen.

## Laufender Betrieb

| Aufgabe | Wie |
|---|---|
| **Sicherung** | läuft automatisch jede Nacht nach `data/backups` (14 Tage). Zusätzlich regelmäßig *Menü → Sicherung herunterladen* oder die Server-Sicherung beim Hoster einschalten (ca. 20 % Aufpreis) |
| **Update** | `cd ~/gf/tracker && git pull && docker compose up -d --build` |
| **Zustand prüfen** | Menü → System & Protokoll, oder `https://…/api/health` |
| **Neustart** | `docker compose restart tracker` |
| **Protokoll** | `docker compose logs --tail 100 tracker` |

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| Browser meldet Zertifikatsfehler / Seite lädt nicht | DNS (Schritt 2) noch nicht aktiv oder Ports 80/443 gesperrt (Hoster-Firewall). Danach `docker compose restart caddy` |
| `502 Bad Gateway` | Tracker startet noch – 1 Minute warten; sonst `docker compose logs tracker` |
| `permission denied` für `data` | `chown -R 1000:1000 data` und `docker compose up -d` |
| Startpasswort verloren | Nur vor der ersten Anmeldung: `docker compose down`, Ordner `data` löschen, neu starten. Danach: anderen Admin bitten, unter *Personen & Zugänge → Link zum Zurücksetzen* einen neuen Link zu erzeugen |
| `git clone` fragt nach Passwort und scheitert | Token statt GitHub-Passwort eingeben (Schritt 4), Berechtigung *Contents: Read* prüfen |
