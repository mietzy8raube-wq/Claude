# Digitale Welt: Anbindung an echte Systeme und Überwachung

Ziel: Die 3D-Übersicht (`prototypes/digitale-welt.html`) wird die Oberfläche, über die dtC und dtL ihre Standorte,
Abläufe, Programme, Fahrzeuge und Vorhaben überwachen. Dafür müssen die angezeigten Daten aus den tatsächlichen
Programmen kommen statt aus Beispielen.

Stand: Oktober 2026. Angaben zu Schnittstellen fremder Programme sind **vor einer Umsetzung beim Hersteller zu prüfen**.

## Grundprinzip

Die **GF-Suite ist die Drehscheibe**. Sie holt Daten aus den Programmen, speichert einen einheitlichen Stand und
liefert ihn an die 3D-Oberfläche. Die 3D-Oberfläche spricht nie direkt mit Inform, DocuWare usw.

```
Inform · DocuWare · M365 · Factorial · Fleetcars · ORSY · MIS · Service-App
        │  je Programm ein Connector (API, Export-Datei oder manuelle Pflege)
        ▼
GF-Suite (Next.js + PostgreSQL)
  ├─ Connector-Jobs (zeitgesteuert, wie die bestehende Outlook-Synchronisation)
  ├─ einheitliche Tabellen: Gesellschaft, Standort, Tätigkeitsgruppe, Person, Programm,
  │  Informationsbezug, Fahrzeug, Vorgang/Prozessschritt, Projekt (vorhanden), Ereignis
  ├─ Integrationsstatus je Programm: letzte Synchronisation, Fehler, Datenmenge
  └─ API /api/digitale-welt (Momentaufnahme) + Live-Kanal (Server-Sent Events)
        ▼
3D-Übersicht als Seite der GF-Suite (/digitale-welt), mit Login und Rollenrechten
```

Warum so: Zugangsdaten bleiben verschlüsselt auf dem Server (wie heute bei Microsoft), jede Quelle hat einen
sichtbaren Zustand, und fällt ein Programm aus, zeigt die Oberfläche den letzten bekannten Stand mit Zeitstempel.

## Was die GF-Suite schon kann

| Vorhanden | Nutzen für die Übersicht |
|---|---|
| Projekte mit Status, Fortschritt, Budget, Meilensteinen, Risiken, Beteiligten | Projekt- und Bauvorhaben-Fahnen direkt aus echten Daten |
| Microsoft-365-Anbindung (OAuth, Kalender-Sync, `SyncLog`) | Muster für alle weiteren Connectoren; Sync-Status als erste echte Überwachung |
| Aufgaben, Entscheidungen, Meetings, Kennzahlen, Excel-Import | Offene Punkte je Standort/Person, Kennzahlen im Dashboard |
| Rollen und Rechte, Audit-Log | Wer darf was sehen; Nachvollziehbarkeit |

## Programme: möglicher Datenweg

| Programm | Liefert für die Übersicht | Möglicher Weg | Zu klären |
|---|---|---|---|
| Microsoft 365 | Termine, Teams-Anwesenheit, E-Mail-Eingang (E-Mail-Agent) | Microsoft Graph, teilweise schon angebunden | Admin-Zustimmung für Anwesenheit (`Presence.Read.All`), Datenschutz |
| Inform Professional | Anfragen, Angebote, Aufträge, Lieferscheine, Rechnungen → Prozessstände und Übergaben | Schnittstelle oder Datenexport des Herstellers | Welche Schnittstelle bietet eure Version? Lesender Datenbankzugriff erlaubt? |
| DocuWare | Ist ein Dokument archiviert? (Bericht, Rechnung, Abnahme) | REST-Schnittstelle von DocuWare | Lizenz und Benutzer für Schnittstellenzugriff |
| Factorial | Urlaub, Abwesenheit, Zeiterfassung → Verfügbarkeit | Schnittstelle von Factorial | Welche Daten freigeben (nur „abwesend“, keine Gründe) |
| Fleetcars | Fahrzeuge, Wartung, Einsatzbereitschaft; ggf. Position | Schnittstelle oder Export erfragen; alternativ Telematik-Anbieter | Gibt es Positionsdaten? Datenschutz (siehe unten) |
| Würth ORSY | Bestände, Verbrauch, Bestellungen | Export oder Schnittstelle bei Würth erfragen | Verfügbarkeit einer Schnittstelle |
| MIS | Kennzahlen, Nachweise (Arbeitsschutz, Qualität, Umwelt, Energie) | je nach System: Export, Datenbank, Links | Technische Basis des MIS |
| Service-App | Einsatzstand, Bericht vollständig, Material, Unterschrift | abhängig vom Entwicklungsstand | Wird sie weiterentwickelt oder ersetzt? |
| CAD, AirWiki | Verweise auf Zeichnungen und Wissen | Links, keine Synchronisation nötig | Ablageorte |

Bis eine Schnittstelle steht, kann jede Quelle **manuell oder per Excel-Import** gepflegt werden (Excel-Import gibt
es in der GF-Suite schon). Die Oberfläche zeigt dann „manuell gepflegt, Stand: Datum“.

## Überwachung: was die Oberfläche zeigen soll

- **Systemstatus je Programm:** angebunden / manuell / nicht angebunden, letzte Synchronisation, Fehler.
- **Offene Übergaben:** Vorgänge, die an einem Prozessschritt länger als ein Grenzwert liegen
  (z. B. Servicebericht seit 2 Tagen unvollständig), mit Zuständigkeit.
- **Warnungen:** Synchronisation fehlgeschlagen, Projekt überfällig, Budget überschritten, Fahrzeug-Wartung fällig.
- **Ereignisprotokoll:** echte Ereignisse statt simulierter (aus Connector-Läufen und GF-Suite-Aktionen).
- **Benachrichtigung:** optional per Teams/E-Mail bei kritischen Warnungen.

## Datenschutz und Mitbestimmung

Live-Anwesenheit von Personen und Fahrzeugpositionen sind Daten, mit denen sich Verhalten und Leistung überwachen
lassen. Vor einer Umsetzung mit dem/der Datenschutzbeauftragten klären; gibt es einen Betriebsrat, ist dessen
Mitbestimmung zu beachten (üblich: Betriebsvereinbarung). Empfehlungen für den Entwurf:

- Anwesenheit nur als „verfügbar / im Termin / abwesend“, ohne Gründe und ohne Verlauf.
- Fahrzeuge standardmäßig auf Ebene „unterwegs / beim Kunden / am Standort“, keine gespeicherte Positionshistorie.
- Ansichten nach Rollen beschränken (z. B. Geschäftsführung, Disposition).
- Transparenz: Mitarbeitende wissen, was angezeigt wird.

## Umsetzung in Phasen

1. **Einbau in die GF-Suite**: Seite `/digitale-welt`, Stammdaten (Gesellschaften, Standorte, Tätigkeitsgruppen,
   Programme, Fahrzeuge) in der Datenbank und pflegbar; Projekte und Bauvorhaben live aus dem Projektmodul;
   Systemstatus von Microsoft 365 aus dem vorhandenen `SyncLog`.
2. **Verfügbarkeit**: Abwesenheiten (Factorial) und optional Teams-Anwesenheit.
3. **Abläufe**: Vorgänge aus Inform Professional und Archivstatus aus DocuWare → echte Prozessstände und offene Übergaben.
4. **Fuhrpark**: Fahrzeugdaten aus Fleetcars bzw. Telematik.
5. **Warnungen und Benachrichtigungen**.

Für Phase 1 sind keine fremden Schnittstellen nötig; sie kann sofort beginnen.
