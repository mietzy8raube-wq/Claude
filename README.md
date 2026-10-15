# GF-Suite — Zentrale Unternehmensübersicht

Eine zentrale Plattform für zwei Geschäftsführer: Aufgabenmanagement, Projekte,
Entscheidungen, Meetings, Kennzahlen, Unternehmensinformationen, sowie
integrierter Outlook- und Excel-Anbindung.

> **Produktivbetrieb auf einem eigenen Server:** siehe
> [DEPLOYMENT.md](./DEPLOYMENT.md) für die Docker-Compose-Bereitstellung
> (App + PostgreSQL, ein Befehl zum Starten). Die folgende Schnellstart-
> Anleitung richtet sich an die lokale Entwicklung.

## Inhaltsverzeichnis

1. [Tech-Stack](#tech-stack)
2. [Schnellstart](#schnellstart)
3. [Ordnerstruktur](#ordnerstruktur)
4. [Datenmodell](#datenmodell)
5. [Rollen & Rechte](#rollen--rechte)
6. [Entra-ID-App-Registrierung (Outlook-Integration)](#entra-id-app-registrierung-outlook-integration)
7. [Microsoft-Graph-Berechtigungen](#microsoft-graph-berechtigungen)
8. [Umgebungsvariablen](#umgebungsvariablen)
9. [Token-Konzept & Sicherheit](#token-konzept--sicherheit)
10. [Synchronisierungsstrategie](#synchronisierungsstrategie)
11. [Excel-Import/-Export](#excel-import--export)
12. [Lokale Testmöglichkeiten](#lokale-testmöglichkeiten)
13. [Fehler- und Konfliktbehandlung](#fehler--und-konfliktbehandlung)
14. [Bekannte Einschränkungen](#bekannte-einschränkungen)

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
- **Mitarbeiter** — im Datenmodell und in der Rollen-Logik bereits
  vorgesehen, für spätere Erweiterung (aktuell werden nur die beiden
  Geschäftsführer-Konten und ein Administrator-Konto ausgeliefert)

Persönliche vs. gemeinsame Inhalte: Aufgaben besitzen ein Sichtbarkeits-Flag
(`GEMEINSAM`/`PERSOENLICH`). „Alle Aufgaben" zeigt alle gemeinsamen Aufgaben
plus die eigenen persönlichen; „Meine Aufgaben" zeigt alle einem selbst
zugewiesenen Aufgaben unabhängig von der Sichtbarkeit.

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

E-Mail-Zugriff (`Mail.Read`/`Mail.Send`) ist **nicht** angefordert, da die
optionale E-Mail-Funktion (Anzeigen/Verknüpfen/Aufgaben aus E-Mails) im
aktuellen Funktionsumfang nicht aktiv ist; die entsprechenden Scopes können
bei Bedarf in `GRAPH_SCOPES` ergänzt werden, sobald diese Funktion umgesetzt
wird.

## Umgebungsvariablen

Vollständige Referenz mit Beispielwerten: `.env.example`.

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ja | PostgreSQL-Verbindungsstring |
| `AUTH_SECRET` | ja | Signierschlüssel für Auth.js-Sessions (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ja | Basis-URL der Anwendung |
| `TOKEN_ENCRYPTION_KEY` | ja | Base64-kodierter 32-Byte-Schlüssel zur Verschlüsselung gespeicherter Microsoft-Tokens |
| `MICROSOFT_TENANT_ID` | nein* | Entra-ID-Verzeichnis-ID |
| `MICROSOFT_CLIENT_ID` | nein* | Entra-ID-Anwendungs-ID |
| `MICROSOFT_CLIENT_SECRET` | nein* | Entra-ID-Client-Secret |
| `MICROSOFT_REDIRECT_URI` | nein* | Muss exakt der in Entra ID hinterlegten Redirect-URI entsprechen |

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
- **E-Mail-Funktionen** (Anzeigen, Verknüpfen, Aufgaben aus E-Mails
  erstellen, Versand): im Datenmodell/Scope-Konzept vorgesehen, UI/API noch
  nicht umgesetzt.
- **Datei-Uploads**: Anhänge (Aufgaben/Projekte/Meetings) werden als
  Datensatz mit externem Link (z. B. SharePoint/OneDrive-URL) abgelegt; es
  ist keine eigene Objektspeicher-Anbindung (z. B. S3) für binäre
  Datei-Uploads enthalten.
- **Automatischer Sync-Zeitplan**: Die Sync-Logik ist vollständig
  implementiert und über die API auslösbar; ein produktiver, dauerhaft
  laufender Scheduler (Cron) muss je nach Hosting-Umgebung ergänzt werden.
