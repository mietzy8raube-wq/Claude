# GF Tracker

Ticketsystem nach dem Vorbild von **Jira** und **Jira Service Management** für
Aufgaben, Projekte und Kundenanfragen – mehrbenutzerfähig mit Live-Aktualisierung,
öffentlichem Kundenportal, SLA-Fristen und E-Mail-Benachrichtigungen über
Microsoft 365. Läuft mit **Node.js ohne externe Pakete**.

➡️ **Architektur, Betrieb, Sicherheit und Begriffe: [ARCHITEKTUR.md](ARCHITEKTUR.md)**

## Schnell ausprobieren (lokal)

Voraussetzung: Node.js 22.13 oder neuer.

```bash
cd tracker
npm run demo
```

Dann <http://localhost:3000> öffnen. Beispielzugänge (Passwort jeweils `Passwort123!`):

| Person | Rolle |
| --- | --- |
| thomas.weber@druckluft-chemnitz.de | Administrator |
| anna.mueller@druckluft-chemnitz.de | Administrator |
| lisa.schmidt@druckluft-chemnitz.de | Mitglied |
| mehmet.yilmaz@druckluft-chemnitz.de | Service-Mitarbeiter |

Kundenportal: <http://localhost:3000/portal>. Die Beispieldaten liegen in
`data-demo/` und können gelöscht werden.

## Produktivbetrieb (Docker + automatisches HTTPS)

```bash
cp .env.example .env          # Domain, Firmenname, Admin-E-Mail eintragen
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
docker compose logs tracker | grep Startpasswort
```

Ausführlich – inklusive Serveranforderungen, Updates, Sicherung/Wiederherstellung
und Microsoft-365-Einrichtung – in [ARCHITEKTUR.md, Abschnitt 7 und 8](ARCHITEKTUR.md#7-betrieb).

## Als App nutzen und auf der Website einbinden

- **App:** In Edge/Chrome „App installieren“ (eigenes Fenster, Startmenü/Taskleiste); auf dem Handy „Zum Home-Bildschirm“. Firmenweit per Intune/Gruppenrichtlinie verteilbar.
- **Website:** Kundenportal als Link oder per `<iframe>` einbetten (`PORTAL_FRAME_ANCESTORS`).
- Details und Fahrplan für Teams, Outlook, Factorial & Co.: [ARCHITEKTUR.md, Abschnitt 13](ARCHITEKTUR.md#13-integration).

## Entwicklung

```bash
npm test      # Integrationstests (starten einen echten Server mit Testdaten)
npm start     # Server mit Konfiguration aus Umgebungsvariablen
```

| Pfad | Inhalt |
| --- | --- |
| `server.mjs` | HTTP-Server, API, Rechte, Synchronisierung, Hintergrundaufgaben |
| `lib/` | Datenbank (SQLite), Anmeldung, E-Mail |
| `public/shared.js` | Fachlogik für Browser und Server (Workflows, SLA, Patch-Verfahren) |
| `public/app.js` | Browser-App |
| `public/portal.js` | Kundenportal |
| `test/` | Tests |

## Einzeldatei-Version (ohne Server)

`npm run build:standalone` erzeugt aus denselben Quelldateien
`../standalone/gf-suite-tracker.html`: eine HTML-Datei, die per Doppelklick im
Browser läuft – mit Arbeitsablauf, Mein Tag, Einsatzplanung, Servicebericht und
Kundenportal (`?portal`). Daten und **Dateianhänge** liegen in der IndexedDB dieses
Browsers (kein 5-MB-Limit; ältere Stände aus dem localStorage werden beim ersten Start
automatisch übernommen); jeder Tab kann als andere Person angemeldet sein.
Anhänge vom PC: „Datei hinzufügen“, Ziehen & Ablegen, **Strg+V** (z. B. Bildschirmfoto)
oder direkt beim Erstellen eines Vorgangs. Die Sicherung (Einstellungen) enthält alle
Anhänge und lässt sich auch in die Server-Version einspielen. Kein Passwortschutz, kein
E-Mail-Versand, kein gemeinsames Arbeiten über mehrere Geräte – dafür die Server-Version.


## Integrationen

Unter **Einstellungen → Integrationen** (Administratoren): Microsoft 365 (E-Mail-Versand,
Service-Postfach → Vorgänge, Outlook-Kalender, Anmeldung mit Microsoft), Factorial
(Mitarbeiter, Abwesenheiten), REST-API mit API-Schlüsseln (`/api/v1`, Beschreibung unter
`/api/v1/openapi.json`), Webhooks (JSON oder Microsoft-Teams-Karte) und der
Import-Assistent für Excel/CSV. Die **Systemlandschaft (3D)** aus der GF-Suite läuft unter
`/landschaft` mit Live-Daten aus dem Tracker (Standort je Team). Als Einzeldatei: `standalone/systemlandschaft.html`
(neben `gf-suite-tracker.html` ablegen; Beispieldaten oder „Daten laden“ mit einer Tracker-Sicherung;
bauen mit `node scripts/build-landscape-standalone.mjs`). Details: [ARCHITEKTUR.md, Abschnitt 13](ARCHITEKTUR.md).
