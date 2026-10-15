# syntax=docker/dockerfile:1

# GF-Suite – Produktions-Image (Next.js + Prisma)
# Drei Stufen: Abhängigkeiten -> Build -> Laufzeit-Image.
# Siehe DEPLOYMENT.md für den vollständigen Ablauf (docker compose).

ARG NODE_VERSION=20-alpine

# -----------------------------------------------------------------------
# Stufe 1: Abhängigkeiten installieren (gecacht, solange package*.json
# unverändert bleibt)
# -----------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# Prisma benötigt OpenSSL zur Laufzeit auf Alpine
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------
# Stufe 2: Anwendung bauen
# -----------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL wird beim Build nur für die Prisma-Client-Generierung
# benötigt (kein echter Verbindungsaufbau), nicht für den späteren Betrieb.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# -----------------------------------------------------------------------
# Stufe 3: Laufzeit-Image
# -----------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
