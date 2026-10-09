# Deployment auf dem betriebsinternen Server (Docker)

Diese Anleitung bringt die GF-Suite über Docker Compose auf einem eigenen
Server zum Laufen — inklusive PostgreSQL-Datenbank in einem eigenen
Container. Kein lokal installiertes Node.js oder PostgreSQL nötig, nur
Docker.

## Voraussetzungen

- Ein Linux-Server (oder jeder andere Docker-fähige Rechner) im internen
  Netz
- [Docker Engine](https://docs.docker.com/engine/install/) mit dem
  `docker compose`-Plugin (bei aktuellen Docker-Versionen bereits
  enthalten)
- Dieses Repository auf den Server kopiert (`git clone` oder als Archiv)

Prüfen mit: `docker --version` und `docker compose version`.

## 1. Umgebungsvariablen einrichten

```bash
cp docker.env.example .env
```

Danach `.env` öffnen und ausfüllen:

| Variable | Bedeutung |
| --- | --- |
| `POSTGRES_PASSWORD` | Passwort für die Datenbank (frei wählbar, nur intern im Docker-Netz sichtbar) |
| `AUTH_SECRET` | Signierschlüssel für Sitzungen — erzeugen mit `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | Schlüssel zur Verschlüsselung gespeicherter Microsoft-Tokens — ebenfalls `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Adresse, unter der die App im Netz erreichbar ist, z. B. `http://192.168.1.50:3000` oder `http://gfsuite.intern:3000` |
| `APP_PORT` | Port auf dem Server, unter dem die App laufen soll (Standard: `3000`) |

`MICROSOFT_*` kann leer bleiben — dann läuft die App vollständig, nur die
Outlook-Integration ist nicht aktiv (siehe README für die spätere
Einrichtung).

**Wichtig:** `.env` enthält Geheimnisse und wird nie eingecheckt (steht in
`.gitignore`).

## 2. Bauen und starten

```bash
docker compose up -d --build
```

Das baut das Anwendungs-Image, startet PostgreSQL in einem eigenen
Container und wendet beim ersten Start automatisch die
Datenbank-Migrationen an (siehe `docker-entrypoint.sh`).

Status prüfen:

```bash
docker compose ps
docker compose logs -f app
```

Die App ist jetzt unter `http://<server>:<APP_PORT>` erreichbar — aber
noch ohne Inhalte und ohne Login, siehe nächster Schritt.

## 3. Erstinbetriebnahme (einmalig)

Es gibt in der Oberfläche bewusst keine "Konto erstellen"-Seite (nur
Geschäftsführer/Administratoren können Rollen ändern) — das erste Konto
und die Grundstruktur werden einmalig über die Kommandozeile angelegt:

```bash
# 1. Die zehn Unternehmensbereiche + Standard-Abteilungen anlegen
docker compose exec app npm run db:init

# 2. Erstes Konto anlegen (Geschäftsführer-Rolle empfohlen für den Start)
docker compose exec app npm run user:create -- \
  --name "Vorname Nachname" \
  --email "name@druckluft-chemnitz.de" \
  --password "EinSicheresPasswort" \
  --role GESCHAEFTSFUEHRER
```

Danach unter `http://<server>:<APP_PORT>/login` mit diesen Daten anmelden.

Weitere Mitarbeiterkonten später auf demselben Weg anlegen (Rolle
`GESCHAEFTSFUEHRER`, `ADMINISTRATOR` oder `MITARBEITER`); der Befehl
aktualisiert ein bestehendes Konto, statt einen Fehler zu werfen, wenn die
E-Mail-Adresse schon existiert.

> **Hinweis:** `prisma/seed.ts` (`npm run db:seed`) enthält stattdessen
> vollständige **Demo-Daten** mit einem einheitlichen Test-Passwort — nur
> für lokale Entwicklung/Vorführungen gedacht, nicht für den echten
> Betrieb ausführen.

## 4. Bedienung im Alltag

```bash
docker compose stop            # anhalten
docker compose start           # wieder starten
docker compose restart app     # nur die App neu starten
docker compose down            # stoppen + Container entfernen (Datenbank-Volume bleibt erhalten)
```

Nach einem Server-Neustart starten die Container dank `restart:
unless-stopped` automatisch mit.

### Update auf eine neue Version

```bash
git pull
docker compose up -d --build
```

Ausstehende Datenbank-Migrationen werden beim Start automatisch
angewendet.

### Backup der Datenbank

```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```

Wiederherstellen:

```bash
cat backup-2026-08-12.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

### Logs

```bash
docker compose logs -f app
docker compose logs -f db
```

### Direkter Datenbankzugriff (z. B. Prisma Studio)

```bash
docker compose exec app npx prisma studio
```

Prisma Studio lauscht dann im Container auf Port 5555; für den Zugriff
vom eigenen Rechner aus entweder `docker compose exec` durch einen
`docker run`-Aufruf mit `-p 5555:5555` ersetzen oder per SSH-Tunnel auf
den Server verbinden.

## Optional: eigene Domain / HTTPS

Für reinen internen Zugriff per IP-Adresse oder Hostname ist HTTPS nicht
zwingend nötig. Soll die App unter einem eigenen internen Hostnamen mit
HTTPS laufen, reicht ein schlanker Reverse Proxy davor, z. B.
[Caddy](https://caddyserver.com/) mit automatischem Zertifikat:

```caddyfile
gfsuite.intern {
  reverse_proxy localhost:3000
}
```

`NEXTAUTH_URL` in `.env` in diesem Fall auf `https://gfsuite.intern`
setzen und die App neu starten (`docker compose up -d`).

## Fehlerbehebung

- **"UntrustedHost"-Fehler beim Login:** `NEXTAUTH_URL` in `.env` prüfen —
  sie muss zu der Adresse passen, unter der die App tatsächlich aufgerufen
  wird.
- **App startet, aber Datenbankzugriffe schlagen fehl:** `docker compose
  logs db` prüfen; meist ein falsches `POSTGRES_PASSWORD` in `.env` nach
  einer Änderung, während das Datenbank-Volume noch die alten Zugangsdaten
  hat (Passwort wird nur beim allerersten Start des `db`-Containers
  gesetzt).
- **Migrationen schlagen dauerhaft fehl:** `docker compose logs app` —
  der Entrypoint versucht es zehnmal im Abstand von 3 Sekunden, bevor er
  abbricht.
