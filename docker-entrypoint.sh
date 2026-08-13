#!/bin/sh
set -e

# Schema nachziehen, bevor der Server Anfragen annimmt. Bricht der Schritt
# ab, startet die App gar nicht erst — besser als ein laufender Server,
# der bei jeder Anfrage auf fehlende Tabellen läuft.
echo "[entrypoint] Migrationen einspielen ..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Server starten ..."
exec node server.js
