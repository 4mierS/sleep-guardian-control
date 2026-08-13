# Sleep Guardian — Control-Plane

Vermittler zwischen der Windows-Tray-App (`sleep-guardian`) und dem Handy.
Der PC baut die Verbindung immer selbst nach außen auf und fragt alle 5s
nach Befehlen — es geht nie eine Verbindung von außen auf den PC, also
keine Portfreigabe im Router.

```
Handy  ──HTTPS──▶  Control-Plane (Next.js + Postgres)  ◀──HTTPS──  PC
       schreibt        Befehls-Queue + Status              fragt alle 5s ab
```

## Endpunkte

| Route | Wer | Zweck |
|---|---|---|
| `POST /api/agent/heartbeat` | PC (Agent-Token) | meldet Status, holt offene Befehle ab |
| `GET /api/machines` | Handy (User-Token) | Status aller Maschinen |
| `POST /api/machines/[id]/commands` | Handy (User-Token) | Befehl in die Queue legen |
| `/control` | Handy | Oberfläche, als PWA installierbar |

Zwei getrennte Token: der Agent-Token darf ausschließlich Status melden
und Befehle abholen, niemals welche anlegen. In der Datenbank liegen nur
SHA-256-Hashes.

## Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung |
| `GUARDIAN_USER_TOKEN` | Zugangscode fürs Handy |

## Lokal entwickeln

```bash
npm install
cp .env.example .env      # DATABASE_URL auf eine lokale Postgres zeigen lassen
npx prisma migrate dev
npm run dev
```

## Deploy

Das `Dockerfile` baut ein standalone-Image. Beim Containerstart spielt
`docker-entrypoint.sh` erst `prisma migrate deploy` ein und startet dann
den Server — schlägt die Migration fehl, startet die App bewusst gar
nicht erst.

In Coolify als Ressource vom Typ **Dockerfile** anlegen, Port 3000, die
beiden Variablen oben setzen.

## Maschine registrieren

Legt eine Maschine an und gibt den Agent-Token **einmalig** aus:

```bash
npx tsx scripts/register-machine.ts "Desktop"
```

Die Ausgabe kommt in die `.env` der Tray-App am PC.

## Prisma 7

Der Client wird als Quelldateien nach `app/generated/prisma` erzeugt
(nicht nach `node_modules`) und ist deshalb nicht eingecheckt — `prisma
generate` läuft im Docker-Build. Die Connection-URL steht in
`prisma.config.ts`, nicht mehr im `datasource`-Block.

## Was nicht geht: Aufwecken

Software kann einen schlafenden PC nicht aufwecken. Dafür bräuchte es
Wake-on-LAN, und das Magic Packet muss aus dem Heimnetz kommen — ein
Server im Rechenzentrum kann das grundsätzlich nicht leisten.
