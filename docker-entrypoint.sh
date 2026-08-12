#!/bin/sh
set -e

# Wendet ausstehende Datenbank-Migrationen an, bevor der Server startet.
# Ein paar Versuche mit Wartezeit, falls die Datenbank (z. B. beim ersten
# "docker compose up") noch kurz hochfährt.
echo "Prüfe/wende Datenbank-Migrationen an..."
attempt=0
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    echo "Migrationen fehlgeschlagen (Datenbank nicht erreichbar?). Breche ab."
    exit 1
  fi
  echo "Datenbank noch nicht bereit, neuer Versuch in 3s ($attempt/10)..."
  sleep 3
done
echo "Migrationen angewendet."

exec "$@"
