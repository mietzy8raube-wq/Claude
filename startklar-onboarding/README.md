# STARTKLAR. — Onboarding-Kompass

Eine einzige, vollständig eigenständige HTML-Datei, die neuen Kolleg:innen der **druckluft-technik Chemnitz GmbH** durch die ersten 90 Tage führt — von der Vorbereitung vor Tag 1 bis zum ersten eigenständig geführten Auftrag.

Kein Backend, keine Datenbank, kein Build-Schritt. `index.html` öffnet direkt im Browser oder läuft über den mitgelieferten Docker-Container auf einem beliebigen internen Server.

## Was es macht

**13 Etappen** führen chronologisch durch das Onboarding:

| # | Etappe | Inhalt |
|---|--------|--------|
| 01 | Deine Route | Übersicht aller Etappen mit Live-Fortschrittsstatus je Kachel |
| 02 | Vor dem Start | Preboarding-Checkliste (mitbringen / wir bereiten vor) |
| 03 | Tag 1 | Stündlicher Ablaufplan für den ersten Arbeitstag |
| 04 | Wer hilft dir wobei? | Sechs Ansprechpartner-Karten mit Kontaktfeldern |
| 05 | Wir als Unternehmen | Werte, Leistungen, Selbstverständnis |
| 06 | Sicherheit | Pflichtunterweisungen mit Nachweis-Tabelle |
| 07 | Digital startklar | System-Einweisung (MIS, E-Mail, Zeiterfassung, Telefon) plus Platzhalter-Tabelle für Projekt-/Bürowerkzeuge |
| 08 | Auftrag | Der siebenstufige Auftragsprozess |
| 09 | Lernplan | Kompetenzpfad mit Reifegrad-Regler je Fähigkeit |
| 10 | 30 · 60 · 90 Tage | Meilensteine der ersten drei Monate |
| 11 | Check-ins | Feedback-Termine und Leitfragen |
| 12 | FAQ & Glossar | Häufige Fragen plus Fachbegriffe |
| 13 | Startklar | Abschlussstatus und persönliche Ziele |

## Funktionen

- **Live-Fortschritt** — ein animierter Tacho ("Onboarding-Druck") im Titelbereich, ein Fortschrittsring in der Kopfzeile und eine Balkenanzeige in der Seitenleiste aktualisieren sich in Echtzeit, sobald irgendwo eine Checkbox gesetzt oder ein Reifegrad-Regler bewegt wird.
- **Mehrere Profile** — jede:r Mitarbeiter:in kann ein eigenes Profil auf demselben Gerät anlegen; alle Eingaben werden getrennt im Browser gespeichert (`localStorage`), nichts läuft über einen Server.
- **Suche (Strg/Cmd + K)** — durchsucht Etappentitel, Checklisten-Einträge und alles, was Mitarbeiter:innen selbst in Textfelder eingetragen haben. Ein Treffer springt direkt zum passenden Element (Karte, Tabellenzeile, Eingabefeld, FAQ-Eintrag …) und markiert es kurz farbig.
- **Speichern/Laden** — der komplette Fortschritt lässt sich als JSON-Datei exportieren und auf einem anderen Gerät wieder importieren.
- **Automatische Datumsformatierung** für Start- und Geburtsdatum (`TT.MM.JJJJ`).
- **Link-Erkennung** — sobald in einem Notiz- oder Kontaktfeld ein Link auftaucht (auch mitten im Text neben Name und Notiz), erscheint automatisch ein anklickbares Link-Symbol.
- **Automatische Firmen-E-Mail** — bei "Pate / Mentor" wird aus dem eingetragenen Namen live `vorname.nachname@druckluft-chemnitz.de` abgeleitet, inklusive Button, der direkt das lokal installierte Outlook öffnet.
- **Profilbild** — sobald ein Geburtsdatum eingetragen ist, zeigt der Profil-Avatar automatisch ein passendes Maskottchen-Bild (spielerisches Easter Egg, ohne Einfluss auf den eigentlichen Fortschritt).
- **100 %-Meldung** — ein Toast erscheint einmalig, sobald alle Etappen abgeschlossen sind.

## Technisch

- Eine Datei, keine externen Requests: Schriften (Big Shoulders Display, Source Sans 3, IBM Plex Mono), Icons (SVG-Sprite) und Bilder sind als Base64 eingebettet.
- Reines HTML/CSS/JavaScript, kein Framework, kein Build-Schritt.
- Helles Design mit gezielten dunklen Akzentflächen (Seitenleiste, Abschluss-Etappe); kein Dark-Mode-Umschalter — bewusste Design-Entscheidung.
- `prefers-reduced-motion` wird respektiert.
- Getestet mit Playwright: alle Kernfunktionen (Checklisten, Suche, Fortschritt, Profile, Speichern/Laden) laufen ohne Konsolenfehler, auch komplett offline (`file://`).

## Deployment

### Mit Docker (empfohlen für den internen Server)

```bash
docker compose up -d --build
```

Danach erreichbar unter `http://<server>:8080`. Port über `STARTKLAR_PORT` in einer `.env`-Datei im selben Verzeichnis anpassbar.

### Ohne Docker

Jeder x-beliebige Webserver reicht:

```bash
python3 -m http.server 8080
```

...oder `index.html` in das Dokumentenverzeichnis eines vorhandenen nginx/Apache/IIS kopieren.

### Direkt öffnen

`index.html` funktioniert auch ganz ohne Server — einfach im Browser öffnen.

## Update

Neue `index.html` einspielen und (bei Docker) `docker compose up -d --build` erneut ausführen. Bereits gespeicherter Fortschritt der Mitarbeiter:innen bleibt erhalten, solange sich der Fenster-Ursprung (Domain/Port) nicht ändert.

## Offene Punkte

Die Tabelle "Projekt- & Bürowerkzeuge" in Etappe 07 ist inzwischen größtenteils befüllt (HR-System: Factorial, DMS: DocuWare, ERP: IN-FORM PROfessional) — offen ist noch die Wahl des Kommunikation/Chat-Tools; Name und interner Link folgen, sobald das feststeht.
