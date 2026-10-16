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
