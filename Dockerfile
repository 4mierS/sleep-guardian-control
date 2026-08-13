# Mehrstufiger Build: das Endimage enthält nur den standalone-Server plus
# die Prisma-CLI, die beim Start die Migrationen einspielt.

FROM node:22-alpine AS base
WORKDIR /app

# --- Abhängigkeiten ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Platzhalter: sowohl prisma.config.ts als auch next build wollen die
# Variable gesetzt sehen. Verbunden wird zur Buildzeit nicht — die echte
# URL kommt zur Laufzeit aus der Coolify-Umgebung.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# Der Prisma-Client wird als Quelldatei erzeugt (Prisma 7) und muss darum
# vor dem Next-Build vorliegen.
RUN npx prisma generate
RUN npm run build

# --- Prisma-CLI für die Migration beim Start ---
# Bewusst ein eigener Stage: die CLI hat transitive Abhängigkeiten
# (effect, @prisma/config, ...). Einzelne Ordner aus dem Builder zu
# kopieren bricht darum. Die Version wird aus der package.json gelesen,
# damit sie nicht gegenüber dem Client auseinanderläuft.
FROM base AS migrator
COPY package.json ./
RUN mkdir /cli && cd /cli && npm init -y >/dev/null \
  && npm install --omit=dev \
    "prisma@$(node -p "require('/app/package.json').dependencies.prisma")" \
    "dotenv@$(node -p "require('/app/package.json').dependencies.dotenv")"

# --- Laufzeit ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Nur für `prisma migrate deploy` beim Containerstart. Die App selbst
# benutzt den generierten Client, der schon im standalone-Bundle steckt.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# Wird in das standalone-node_modules hineinkopiert, nicht daneben:
# prisma.config.ts liegt in /app und löst `prisma/config` und
# `dotenv/config` ausschließlich gegen /app/node_modules auf. Die Pakete
# der CLI (prisma, @prisma/engines, effect, ...) liegen in anderen
# Unterordnern als das mitgelieferte @prisma/client und kollidieren nicht.
COPY --from=migrator --chown=node:node /cli/node_modules ./node_modules

COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
