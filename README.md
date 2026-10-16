# GF-Suite — Zentrale Unternehmensübersicht

> **Neu: GF Tracker** – das mehrbenutzerfähige Ticketsystem nach Jira-Vorbild
> mit Service-Desk und Kundenportal liegt im Ordner [`tracker/`](tracker/README.md)
> (Architektur und Betrieb: [`tracker/ARCHITEKTUR.md`](tracker/ARCHITEKTUR.md)).
> Eigenständige Einzel-HTML-Versionen ohne Server: [`standalone/`](standalone/).

Eine zentrale Plattform für zwei Geschäftsführer: Aufgabenmanagement, Projekte,
Entscheidungen, Meetings, Kennzahlen, Unternehmensinformationen, sowie
integrierter Outlook- und Excel-Anbindung.

## Inhaltsverzeichnis

1. [Tech-Stack](#tech-stack)
2. [Schnellstart](#schnellstart)
3. [Ordnerstruktur](#ordnerstruktur)
4. [Datenmodell](#datenmodell)
5. [Rollen & Rechte](#rollen--rechte)
6. [Ticketsystem: Zuweisung, Fristen & Benachrichtigungen](#ticketsystem-zuweisung-fristen--benachrichtigungen)
7. [Entra-ID-App-Registrierung (Outlook-Integration)](#entra-id-app-registrierung-outlook-integration)
8. [Microsoft-Graph-Berechtigungen](#microsoft-graph-berechtigungen)
   - [Outlook-Mail: Postfach & E-Mail-Benachrichtigungen](#outlook-mail-postfach--e-mail-benachrichtigungen)
   - [Factorial HR: Mitarbeiter & Abwesenheiten](#factorial-hr-mitarbeiter--abwesenheiten)
9. [Umgebungsvariablen](#umgebungsvariablen)
10. [Token-Konzept & Sicherheit](#token-konzept--sicherheit)
11. [Synchronisierungsstrategie](#synchronisierungsstrategie)
12. [Excel-Import/-Export](#excel-import--export)
13. [Lokale Testmöglichkeiten](#lokale-testmöglichkeiten)
14. [Fehler- und Konfliktbehandlung](#fehler--und-konfliktbehandlung)
15. [Bekannte Einschränkungen](#bekannte-einschränkungen)

## Tech-Stack

- **Next.js 15** (App Router) + **TypeScript**, **React 18**
- **Tailwind CSS v4** + handgefertigte **shadcn/ui**-Komponenten (Radix UI)
- **PostgreSQL** + **Prisma ORM**
- **Auth.js v5** (Credentials Provider, JWT-Sessions)
- **Zod** (Validierung) + **React Hook Form**
- **Microsoft Graph API** + **Microsoft Entra ID** (OAuth 2.0 Authorization
  Code Flow, eigene Implementierung ohne MSAL-Token-Cache, um Access-/
  Refresh-Tokens serverseitig verschlüsselt selbst zu verwalten)
- **ExcelJS** (Import/Export/Vorlagen)

## Schnellstart

Voraussetzungen: Node.js 20+, PostgreSQL 14+ (lokal oder erreichbar).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env
# .env öffnen und mindestens DATABASE_URL, AUTH_SECRET und
# TOKEN_ENCRYPTION_KEY setzen (siehe Abschnitt "Umgebungsvariablen").
# AUTH_SECRET / TOKEN_ENCRYPTION_KEY erzeugen:
openssl rand -base64 32

# 3. Datenbank anlegen (Beispiel mit lokalem PostgreSQL)
createdb gfsuite

# 4. Schema migrieren
npx prisma migrate dev

# 5. Beispieldaten einspielen (2 Geschäftsführer + 1 Administrator,
#    Aufgaben, Projekte, Entscheidungen, Meetings, Kennzahlen, Kontakte)
npm run db:seed

# 6. Entwicklungsserver starten
npm run dev
```

Anwendung ist unter `http://localhost:3000` erreichbar. Login-Daten siehe
[Lokale Testmöglichkeiten](#lokale-testmöglichkeiten).

### Weitere Skripte

```bash
npm run build       # Produktions-Build
npm run start        # Produktionsserver starten (nach build)
npm run lint          # ESLint
npm run db:studio    # Prisma Studio (Datenbank-GUI)
npm run db:migrate  # Neue Migration erstellen/anwenden
```

## Ordnerstruktur

```
prisma/
  schema.prisma          # Vollständiges Datenmodell
  seed.ts                 # Beispieldaten
  migrations/

src/
  app/
    (auth)/login/          # Login-Seite
    (dashboard)/            # Geschützter Bereich (Sidebar-Layout)
      dashboard/            # Dashboard mit Filtern & Widgets
      tasks/mine, tasks/all # Aufgaben (Liste/Kanban)
      projects/              # Projekte (+ [id] Detailseite)
      decisions/              # Entscheidungen (+ [id] Detailseite)
      company/                 # Unternehmensübersicht (10 Bereiche)
      meetings/                 # Meetings & Beschlüsse
      calendar/                  # Kalender-Agenda
      documents/                  # Dokumentenübersicht (aggregiert)
      integrations/                # Microsoft 365 & Excel verwalten
      settings/                     # Profil, Passwort, Benutzerverwaltung
    api/                     # REST-API-Routen (Route Handlers)
      tasks/, projects/, decisions/, meetings/, company-areas/,
      contacts/, calendar-events/, excel/, integrations/microsoft/,
      users/, auth/
  components/
    ui/                     # shadcn/ui-Primitive (Button, Dialog, ...)
    layout/                 # Sidebar, Header, Theme-Toggle
    tasks/, projects/, decisions/, meetings/, company/, calendar/,
    integrations/, excel/, dashboard/, settings/, shared/
  lib/
    prisma.ts                # Prisma-Client-Singleton
    auth.ts / auth.config.ts # Auth.js-Konfiguration (Node/Edge getrennt)
    encryption.ts             # AES-256-GCM für Microsoft-Tokens
    audit.ts                   # Audit-Log-Helfer
    api-utils.ts                 # Auth-Guard & Fehlerbehandlung für API-Routen
    graph/                        # Microsoft-Graph-Integration
      config.ts, oauth.ts, client.ts, tokenStore.ts, sync.ts
    excel/                          # Excel-Engine
      fields.ts, export.ts, template.ts, import.ts
    validations/                     # Zod-Schemas je Modul
  middleware.ts               # Routen-Schutz (Edge-Runtime)
  types/                        # Geteilte TypeScript-Typen
```

## Datenmodell

Das vollständige Schema befindet sich in `prisma/schema.prisma`. Zentrale
Modelle:

- **User** — Geschäftsführer/Administrator/Mitarbeiter (Rolle), Zugang
- **Task** — Aufgaben mit Checkliste, Kommentaren, Anhängen, Aktivitätsverlauf,
  Wiederholung, Verknüpfung zu Projekt/Abteilung/Bereich/Entscheidung/
  Meetingbeschluss/Kalendertermin
- **Project** — Projekte mit Meilensteinen, Risiken, Dateien, Kommentaren
- **Decision** — Entscheidungen mit Optionen (Vor-/Nachteile), finaler
  Entscheidung, verknüpften Aufgaben
- **Meeting** — Meetings mit Tagesordnung, Notizen, Beschlüssen (aus denen
  direkt Aufgaben erzeugt werden können), Teilnehmern
- **CompanyArea** (+ Metric/Note/Document) — die zehn festen
  Unternehmensbereiche (Finanzen, Vertrieb, Marketing, Personal, Operatives,
  Kunden, Lieferanten, Verträge, Risiken, Strategische Ziele)
- **Contact** — Kunden-/Lieferantenkontakte
- **MicrosoftConnection** / **CalendarEvent** / **SyncLog** — Outlook-
  Integration (siehe unten)
- **AuditLog** / **ExcelOperationLog** — Nachvollziehbarkeit wichtiger
  Änderungen sowie aller Excel-Im-/Exporte

## Rollen & Rechte

- **Geschäftsführer** — vollständiger Zugriff auf alle Module
- **Administrator** — zusätzlich Benutzerverwaltung (Rollen ändern) unter
  „Einstellungen"
- **Mitarbeiter** — Team-Mitglieder, denen Tickets zugewiesen werden.
  Administratoren legen sie unter „Einstellungen → Benutzerverwaltung" an
  (Name, E-Mail, Rolle, Start-Passwort) und können Zugänge jederzeit
  deaktivieren, ohne Ticket-Historie zu verlieren.

Persönliche vs. gemeinsame Inhalte: Aufgaben besitzen ein Sichtbarkeits-Flag
(`GEMEINSAM`/`PERSOENLICH`). „Alle Aufgaben" zeigt alle gemeinsamen Aufgaben
plus die eigenen persönlichen; „Meine Aufgaben" zeigt alle einem selbst
zugewiesenen Aufgaben unabhängig von der Sichtbarkeit.

## Ticketsystem: Zuweisung, Fristen & Benachrichtigungen

Jede Aufgabe ist ein **Ticket** mit fortlaufender Nummer (`T-0042`). Die
Nummer erscheint in Liste, Kanban und Detailansicht und kann direkt gesucht
werden (Suchfeld: `T-42`, `t42` oder `#42`).

**Fristen** (`/deadlines`) — alle offenen Tickets, Projekt-Meilensteine und
Entscheidungsfristen, gruppiert nach *Überfällig · Heute · Morgen · Diese
Woche · Nächste Woche · Später*, umschaltbar zwischen „Meine" und „Alle".
Direkt aus der Liste: **Erledigt**, **Verschieben** (+1 Tag … +2 Wochen;
überfällige Tickets werden ab heute verschoben) und **Neu zuweisen**. Ein
Hinweis zeigt, wie viele offene Tickets noch keine Frist haben.

**Team & Auslastung** (`/team`) — pro Person: offene/in Arbeit/blockierte
Tickets, diese Woche fällig, überfällig, hohe/kritische Priorität, eine
gewichtete Auslastung (Niedrig 1 · Mittel 2 · Hoch 3 · Kritisch 5 Punkte;
ab 20 Punkten „überlastet") sowie die **Termintreue** der letzten 30 Tage
(Anteil der vor/an der Frist erledigten Tickets). Oben steht die
**Warteschlange nicht zugewiesener Tickets**; die Zuweisungsauswahl ist
nach Auslastung sortiert, sodass die am wenigsten ausgelastete Person zuerst
erscheint.

**Benachrichtigungen** (Glocke oben rechts, aktualisiert sich jede Minute):

| Ereignis | Empfänger |
| --- | --- |
| Ticket erstellt/neu zugewiesen | neuer Verantwortlicher (und Beteiligte bei Erstellung) |
| Neuer Kommentar | Verantwortlicher, Ersteller, Beteiligte |
| Statuswechsel (z. B. „Zur Prüfung", „Erledigt") | Ersteller, Verantwortlicher, Beteiligte |
| Frist geändert | Verantwortlicher |
| Frist heute oder in den nächsten 48 h | Verantwortlicher (bzw. Ersteller, falls nicht zugewiesen) |
| Frist überschritten (ab Folgetag) | Verantwortlicher **und** Ersteller (Eskalation) |
| Erinnerung (`reminderAt`) erreicht | Verantwortlicher |

Der Auslöser einer Aktion wird nie selbst benachrichtigt. Ein Klick auf die
Benachrichtigung öffnet das Ticket direkt. Fristen-Benachrichtigungen werden
über einen eindeutigen `dedupeKey` pro Ticket/Empfänger/Frist nur einmal
erzeugt — auch wenn die Prüfung mehrfach läuft; wird die Frist verschoben,
greift die Warnung für die neue Frist erneut.

Die Fristenprüfung läuft automatisch (gedrosselt auf alle 5 Minuten), sobald
ein angemeldeter Benutzer die App nutzt. Damit Warnungen auch nachts oder am
Wochenende entstehen, empfiehlt sich zusätzlich ein Cron-Job:

```bash
# z. B. stündlich; CRON_SECRET in .env setzen
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://ihre-domain.tld/api/notifications/deadline-check
```

Außerdem setzt das System beim Erledigen eines Tickets `completedAt`
(Grundlage der Termintreue-Auswertung).

## Entra-ID-App-Registrierung (Outlook-Integration)

Die Anwendung funktioniert vollständig ohne Microsoft-Zugangsdaten (alle
Module außer der direkten Outlook-Synchronisierung sind sofort nutzbar). Für
die Outlook-Integration:

1. Im [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** →
   **App-Registrierungen** → **Neue Registrierung**.
2. Name z. B. „GF-Suite", **Unterstützte Kontotypen**: „Konten in diesem
   Organisationsverzeichnis" (oder „Alle Organisationsverzeichnisse", je nach
   Bedarf).
3. **Redirect URI** (Plattform: „Web"):
   `http://localhost:3000/api/integrations/microsoft/callback`
   (in Produktion die entsprechende Produktions-URL, z. B.
   `https://ihre-domain.tld/api/integrations/microsoft/callback`).
4. Nach Erstellung: **Zertifikate & Geheimnisse** → **Neuer geheimer
   Client-Schlüssel** erzeugen → Wert sofort kopieren (wird nur einmal
   angezeigt) → `MICROSOFT_CLIENT_SECRET`.
5. **Übersicht**-Seite: `Anwendungs-ID (Client)` → `MICROSOFT_CLIENT_ID`,
   `Verzeichnis-ID (Mandant)` → `MICROSOFT_TENANT_ID`.
6. **API-Berechtigungen** → **Berechtigung hinzufügen** → **Microsoft Graph**
   → **Delegierte Berechtigungen** → die in
   [Microsoft-Graph-Berechtigungen](#microsoft-graph-berechtigungen)
   aufgeführten Scopes hinzufügen. Ein Admin-Consent ist für die verwendeten
   delegierten Berechtigungen in der Regel nicht zwingend erforderlich (außer
   organisationsweite Richtlinien verlangen dies) — jeder Benutzer bestätigt
   beim ersten Verbinden individuell.
7. Die vier Werte in `.env` eintragen (siehe
   [Umgebungsvariablen](#umgebungsvariablen)) und den Dev-Server neu starten.
8. In der Anwendung unter **Integrationen** auf „Microsoft-Konto verbinden"
   klicken — jeder Geschäftsführer verbindet sein **eigenes** Konto separat
   (eine `MicrosoftConnection` pro Benutzer).

## Microsoft-Graph-Berechtigungen

Es werden ausschließlich die minimal notwendigen **delegierten**
Berechtigungen angefordert (Least Privilege, siehe `src/lib/graph/config.ts`):

| Scope                  | Zweck                                             |
| ----------------------- | -------------------------------------------------- |
| `openid`, `profile`, `email` | Standard-OIDC-Anmeldung                       |
| `offline_access`        | Ausstellung eines Refresh Tokens                   |
| `User.Read`              | Anzeigename/E-Mail des verbundenen Kontos abrufen |
| `Calendars.ReadWrite`     | Kalender lesen, Termine erstellen/ändern/löschen |
| `MailboxSettings.Read`     | Zeitzoneneinstellungen des Postfachs berücksichtigen |

| `Mail.Read`               | Postfach im Ticketsystem anzeigen, Tickets aus E-Mails erstellen |
| `Mail.Send`               | Auf E-Mails antworten; Benachrichtigungen aus dem eigenen Postfach (Fallback) |

Zusätzlich **optional** für den zentralen Versand von Benachrichtigungen:
**Anwendungsberechtigung** (nicht delegiert) `Mail.Send` mit Admin-Consent,
siehe nächster Abschnitt.

> **Bestehende Verbindungen:** Wer sein Microsoft-Konto vor der
> Mail-Integration verbunden hat, muss unter „Integrationen" einmal
> *Verbindung trennen* und neu verbinden, damit `Mail.Read`/`Mail.Send`
> erteilt werden. Postfach und Integrationsseite weisen darauf hin.

### Outlook-Mail: Postfach & E-Mail-Benachrichtigungen

**Postfach** (`/mail`) — zeigt Posteingang und Gesendete Elemente des
verbundenen Outlook-Kontos (Suche, Nachladen). Pro E-Mail:

- **Als Ticket übernehmen**: Titel aus dem Betreff (ohne „AW:/WG:"),
  Absender, Eingangszeit und Mailtext landen in der Beschreibung;
  Verantwortlicher, Priorität (wichtige Mails → „Hoch"), Frist und Projekt
  sind wählbar. Das Ticket ist mit der Mail verknüpft (Link „In Outlook
  öffnen" in der Ticketansicht, Ticketnummer als Markierung im Postfach).
- **Antworten / Allen antworten** direkt aus der App (Verlauf hängt Outlook an).
- HTML-Mails werden in einem abgeschotteten `iframe` ohne Skripte und mit
  restriktiver Content-Security-Policy angezeigt.

**E-Mail-Benachrichtigungen** — jede Benachrichtigung aus der Glocke geht
zusätzlich per E-Mail raus (pro Person abschaltbar unter
„Einstellungen → Benachrichtigungen", dort auch „Test-E-Mail senden").
Stehen für eine Person mehrere Benachrichtigungen gleichzeitig an, wird
**eine Sammelmail** verschickt. Versandweg:

1. **Empfohlen – zentrales Postfach** (z. B. `tickets@ihre-firma.de`):
   `MICROSOFT_MAIL_SENDER` setzen und in der App-Registrierung unter
   *API-Berechtigungen → Microsoft Graph → Anwendungsberechtigungen*
   `Mail.Send` hinzufügen und **Administratorzustimmung erteilen**. Der
   Versand läuft per Client-Credentials-Flow unabhängig von Benutzerkonten.
   Tipp: Mit einer *Application Access Policy* in Exchange Online lässt sich
   die App auf genau dieses Postfach beschränken
   (`New-ApplicationAccessPolicy -AccessRight RestrictAccess …`).
2. **Fallback**: Ohne zentrales Postfach erhält jede Person mit verbundenem
   Microsoft-Konto ihre Benachrichtigungen aus dem eigenen Postfach an sich
   selbst. Personen ohne Verbindung sehen Benachrichtigungen nur in der App.

Der Versand erfolgt nach Abschluss der jeweiligen Anfrage im Hintergrund und
zusätzlich bei jeder Fristenprüfung; jede Benachrichtigung wird höchstens
einmal (und nur innerhalb von 24 h nach Entstehung) gemailt.

### Factorial HR: Mitarbeiter & Abwesenheiten

Anbindung an die Factorial-API (`https://api.factorialhr.com`, Version
`2026-10-01`, Authentifizierung per Firmen-API-Schlüssel im Header
`x-api-key`).

1. In Factorial als Admin unter *Einstellungen → API-Schlüssel* einen
   Schlüssel erzeugen und als `FACTORIAL_API_KEY` in die `.env` eintragen.
2. Unter „Integrationen → Factorial HR" auf **Jetzt abgleichen** klicken
   (Geschäftsführung/Administration).

Der Abgleich

- verknüpft aktive Factorial-Mitarbeiter **per E-Mail** (Firmen-, Login- oder
  Kommunikations-E-Mail) mit GF-Suite-Konten; nicht zuordenbare werden
  aufgelistet. Administratoren können fehlende **Mitarbeiter-Konten
  automatisch anlegen** lassen (zufälliges Passwort – Login erst nach
  Passwortvergabe).
- übernimmt **Abwesenheiten** (Urlaub, Krankheit, Fortbildung … – genehmigt
  und beantragt) von 30 Tagen rückwirkend bis 180 Tage im Voraus;
  gelöschte/abgelehnte werden lokal entfernt.

Genutzt werden die Abwesenheiten in:

- **Team & Auslastung**: „Aktuell abwesend: Urlaub 16.10.–19.10." bzw.
  „Geplant … (beantragt)", inkl. Anzahl der Tickets, die in die Abwesenheit
  fallen. Bei der Zuweisung stehen anwesende Personen oben.
- **Fristen**: Hinweis „… ist dann nicht da – Vertretung zuweisen" am
  Ticket; Zuweisungsauswahl markiert heute Abwesende.
- **Benachrichtigung „Vertretung nötig"**: Wird ein Ticket in den nächsten
  7 Tagen fällig und ist der Verantwortliche an dem Tag (genehmigt)
  abwesend, wird der Ersteller benachrichtigt (bzw. die Geschäftsführung,
  wenn der Abwesende das Ticket selbst angelegt hat) – auch per E-Mail.

Automatischer Abgleich, z. B. täglich morgens per Cron:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://ihre-domain.tld/api/integrations/factorial/sync
```

## Umgebungsvariablen

Vollständige Referenz mit Beispielwerten: `.env.example`.

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ja | PostgreSQL-Verbindungsstring |
| `AUTH_SECRET` | ja | Signierschlüssel für Auth.js-Sessions (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ja | Basis-URL der Anwendung |
| `TOKEN_ENCRYPTION_KEY` | ja | Base64-kodierter 32-Byte-Schlüssel zur Verschlüsselung gespeicherter Microsoft-Tokens |
| `CRON_SECRET` | nein | Bearer-Token für Cron-Aufrufe (Fristenprüfung inkl. Mailversand, Factorial-Abgleich) |
| `MICROSOFT_TENANT_ID` | nein* | Entra-ID-Verzeichnis-ID |
| `MICROSOFT_CLIENT_ID` | nein* | Entra-ID-Anwendungs-ID |
| `MICROSOFT_CLIENT_SECRET` | nein* | Entra-ID-Client-Secret |
| `MICROSOFT_REDIRECT_URI` | nein* | Muss exakt der in Entra ID hinterlegten Redirect-URI entsprechen |
| `MICROSOFT_MAIL_SENDER` | nein | Zentrales Absender-Postfach für E-Mail-Benachrichtigungen (benötigt Anwendungsberechtigung `Mail.Send`) |
| `MICROSOFT_GRAPH_BASE_URL` / `MICROSOFT_LOGIN_HOST` | nein | Nur für nationale Clouds (z. B. `https://graph.microsoft.us/v1.0`, `https://login.microsoftonline.us`) |
| `APP_URL` | nein | Öffentliche Basis-URL für Links in E-Mails (Standard: `NEXTAUTH_URL`) |
| `FACTORIAL_API_KEY` | nein | Factorial-Firmen-API-Schlüssel; aktiviert die Factorial-Integration |
| `FACTORIAL_API_VERSION` | nein | Factorial-API-Version (Standard `2026-10-01`) |
| `FACTORIAL_BASE_URL` | nein | Abweichende Factorial-API-URL (Standard `https://api.factorialhr.com`) |

\* Ohne diese vier Variablen läuft die Anwendung vollständig, die
Outlook-Integration zeigt im UI einen klaren Hinweis „nicht konfiguriert" an
und alle anderen Funktionen bleiben unberührt.

**Niemals** echte Zugangsdaten in den Quellcode oder nach `.env.example`
schreiben — nur in die lokale, git-ignorierte `.env`-Datei.

## Token-Konzept & Sicherheit

- Login der Geschäftsführer erfolgt über **Auth.js Credentials Provider**
  (bcrypt-gehashte Passwörter, JWT-Session, keine Klartext-Speicherung).
- Die Middleware nutzt eine **getrennte, Edge-kompatible Konfiguration**
  (`auth.config.ts` ohne Prisma/bcrypt) für den reinen Routen-Schutz, während
  die vollständige Auth-Logik mit Datenbankzugriff nur serverseitig
  (Node-Runtime) läuft.
- Die Outlook-Verbindung ist **von der Anwendungsanmeldung getrennt**: Jeder
  Benutzer autorisiert sein Microsoft-365-Konto separat über den OAuth 2.0
  Authorization Code Flow (`src/lib/graph/oauth.ts`).
- Access- und Refresh-Token werden **serverseitig AES-256-GCM-verschlüsselt**
  (`src/lib/encryption.ts`, Schlüssel aus `TOKEN_ENCRYPTION_KEY`) in
  `MicrosoftConnection` gespeichert — niemals im Klartext in der Datenbank
  oder im Client.
- Der Access Token wird bei jedem Graph-Aufruf auf Ablauf geprüft
  (`getValidAccessToken`) und bei Bedarf automatisch über den Refresh Token
  erneuert (5 Minuten Sicherheitsmarge).
- Ein CSRF-Schutz für den OAuth-Callback erfolgt über einen zufälligen,
  in einem `httpOnly`-Cookie gespiegelten `state`-Parameter, der zusätzlich an
  die anfragende Benutzer-ID gebunden ist.
- Alle sicherheitsrelevanten Aktionen (Login, Erstellen/Ändern/Löschen,
  Verbinden/Trennen von Microsoft-Konten, Excel-Im-/Export) werden im
  **Audit-Log** (`AuditLog`) protokolliert und sind unter „Einstellungen"
  einsehbar.
- DSGVO: Es werden ausschließlich für den Geschäftsbetrieb notwendige Daten
  verarbeitet; Microsoft-Zugangsdaten verlassen den eigenen Server nicht
  (kein Versand an Drittanbieter außer Microsoft Graph selbst); Benutzer
  können ihre Microsoft-Verbindung jederzeit über „Verbindung trennen"
  widerrufen.

## Synchronisierungsstrategie

- **Manuell**: Button „Jetzt synchronisieren" unter „Integrationen".
- **Automatisch**: Konfigurierbares Intervall (5/15/30/60 Minuten) pro
  Benutzer (`MicrosoftConnection.syncIntervalMinutes`,
  `autoSyncEnabled`). Die eigentliche Ausführung eines wiederkehrenden
  Zeitplans obliegt der Hosting-Umgebung (z. B. Cron-Job/Scheduled Task, der
  periodisch `POST /api/integrations/microsoft/sync` für aktive
  Verbindungen aufruft) — die Sync-Logik selbst (`src/lib/graph/sync.ts`)
  ist bereits vollständig implementiert und wiederverwendbar.
- **Abgeglichener Zeitraum**: 7 Tage rückwirkend bis 90 Tage im Voraus, um
  sowohl kürzlich vergangene als auch anstehende Termine abzudecken.
- **Duplikatvermeidung**: Termine werden per `outlookEventId` (eindeutig in
  der Datenbank) per **Upsert** abgeglichen — ein erneuter Sync-Lauf erzeugt
  keine Duplikate, sondern aktualisiert bestehende Einträge.
- **Rate-Limits**: Der Graph-Client erkennt HTTP 429 sowie 5xx-Antworten,
  respektiert den `Retry-After`-Header (Fallback: exponentielles Backoff) und
  wiederholt die Anfrage bis zu dreimal, bevor ein Fehler propagiert wird.
- **Protokollierung**: Jeder Sync-Lauf erzeugt einen `SyncLog`-Eintrag
  (Status, Anzahl synchronisierter/fehlgeschlagener Termine, Dauer), sichtbar
  im Dashboard („Fehlgeschlagene Synchronisierungen") und auf der
  Integrationen-Seite.

## Excel-Import / -Export

- **Export**: `GET /api/excel/export?entity=…` (tasks, projects, decisions,
  companyMetrics, contacts) mit optionalen Filtern (Status, Priorität,
  Projekt, Abteilung, Verantwortlicher, Zeitraum). Formatierte `.xlsx`-Datei
  mit fixierter Kopfzeile, Autofilter, sinnvollen Spaltenbreiten,
  Datumsformaten und einem zweiten Tabellenblatt „Exportinformationen"
  (Exportdatum, exportiert von, aktive Filter).
- **Vorlagen**: `GET /api/excel/template?entity=…` liefert eine Vorlage mit
  Beispielzeile und einem „Anleitung"-Tabellenblatt (Pflichtfelder, erlaubte
  Werte, Datumsformat).
- **Import**: Dreistufiger Ablauf (Datei hochladen → Spaltenzuordnung mit
  automatischem Vorschlag + Live-Validierung/Fehlerbericht → Bestätigung).
  Unterstützt `.xlsx` und `.csv`. Datensätze mit befüllter `ID`-Spalte werden
  aktualisiert, andernfalls wird auf naheliegende Duplikate geprüft
  (z. B. gleicher Titel/Name) und der jeweilige Datensatz neu angelegt oder
  als Duplikat übersprungen und im Fehlerbericht ausgewiesen.
- Jeder Import/Export wird in `ExcelOperationLog` protokolliert (Dashboard-
  Widget „Zuletzt importierte Excel-Dateien").

## Lokale Testmöglichkeiten

Nach `npm run db:seed` stehen folgende Testkonten zur Verfügung (Passwort für
alle Konten: **`Passwort123!`**):

| Rolle | E-Mail |
| --- | --- |
| Geschäftsführerin | `anna.mueller@druckluft-chemnitz.de` |
| Geschäftsführer | `thomas.weber@druckluft-chemnitz.de` |
| Administrator | `admin@druckluft-chemnitz.de` |
| Mitarbeiterin | `lisa.schmidt@druckluft-chemnitz.de` |

Die Seed-Daten enthalten realistische Beispiele für alle Module (Aufgaben,
Projekte mit Meilensteinen/Risiken, Entscheidungen mit Optionen, ein Meeting
mit Beschluss, Unternehmenskennzahlen je Bereich, Kontakte, lokale
Kalendertermine).

Ohne Microsoft-Zugangsdaten funktionieren alle Module außer der echten
Outlook-Synchronisierung; lokale Kalendertermine (Erstellen/Bearbeiten/
Löschen, Verknüpfung mit Aufgaben) sind unabhängig davon voll nutzbar.

## Fehler- und Konfliktbehandlung

- API-Routen liefern strukturierte Fehlermeldungen (`{ error, details? }`)
  mit passendem HTTP-Status; clientseitig werden diese als Toast-Meldungen
  angezeigt.
- Zod validiert alle Eingaben serverseitig unabhängig vom Client.
- Microsoft-Graph-Fehler (abgelaufener/ungültiger Token, Netzwerkfehler,
  Rate-Limit) werden abgefangen, im `MicrosoftConnection`- bzw.
  `SyncLog`-Datensatz mit Klartext-Fehlermeldung festgehalten und im UI
  („Integrationen", Dashboard) sichtbar gemacht statt die Anwendung
  abstürzen zu lassen.
- Excel-Importfehler werden pro Zeile/Feld gesammelt und vor dem eigentlichen
  Import als Vorschau angezeigt; nach dem Import zusätzlich als
  Abschlussbericht (neu/aktualisiert/übersprungen/Fehler).
- Middleware leitet nicht angemeldete Zugriffe auf geschützte Seiten zur
  Login-Seite um (inkl. `callbackUrl`, um nach Login zur ursprünglichen Seite
  zurückzukehren).

## Bekannte Einschränkungen

- **OneDrive/SharePoint**: Datenmodell, Berechtigungskonzept und
  UI-Platzhalter sind vorbereitet; der tatsächliche Datei-Browser und
  Lese-/Schreibzugriff auf definierte Tabellenbereiche ist noch nicht
  implementiert (siehe „Integrationen" → „In Vorbereitung").
- **E-Mail-Anhänge**: Beim Erstellen eines Tickets aus einer E-Mail wird
  der Text übernommen und die Mail verlinkt; Anhänge bleiben in Outlook
  (über „In Outlook öffnen" erreichbar).
- **Datei-Uploads**: Anhänge (Aufgaben/Projekte/Meetings) werden als
  Datensatz mit externem Link (z. B. SharePoint/OneDrive-URL) abgelegt; es
  ist keine eigene Objektspeicher-Anbindung (z. B. S3) für binäre
  Datei-Uploads enthalten.
- **Teams-Benachrichtigungen**: Benachrichtigungen gehen in die App und per
  E-Mail, noch nicht als Teams-Nachricht.
- **Factorial**: Abwesenheiten werden gelesen, nicht zurückgeschrieben;
  Urlaubsanträge erfolgen weiterhin in Factorial.
- **Automatischer Sync-Zeitplan**: Die Sync-Logik ist vollständig
  implementiert und über die API auslösbar; ein produktiver, dauerhaft
  laufender Scheduler (Cron) muss je nach Hosting-Umgebung ergänzt werden.
