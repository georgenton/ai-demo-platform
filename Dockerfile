# =============================================================================
# Dockerfile multi-stage para el backend NestJS en Railway.
#
# Por qué Dockerfile y no nixpacks automático:
#   - Nixpacks intenta auto-detectar el framework, y con un monorepo Nx
#     tiende a confundirse (¿corre web? ¿corre api? ¿hace prisma generate?).
#   - Dockerfile explícito: control total + reproducibilidad + diff visible
#     en code review cuando cambia el deploy.
#
# Stages:
#   1) builder: instala deps, genera Prisma client, builda apps/api con Nx.
#   2) runtime: imagen mínima con solo lo necesario (node_modules + dist +
#      prisma schema para `migrate deploy` en boot).
#
# Variables que Railway debe setear en el servicio:
#   - DATABASE_URL          (auto-provista por el add-on de Postgres)
#   - CHAT_PROVIDER, CHAT_API_KEY, CHAT_MODEL
#   - EMBEDDINGS_PROVIDER, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL
#   - INTERNAL_API_KEY      (shared secret con el frontend de Vercel)
#   - PORT                  (Railway lo asigna; nuestro main.ts lo respeta)
# =============================================================================

# ---- Stage 1: builder ------------------------------------------------------

FROM node:24-slim AS builder
WORKDIR /app

# OpenSSL es requerido por Prisma (binarios libssl) tanto en build como runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Layer cacheable: solo lockfile + package.json. Si no cambian, npm ci no
# se reejecuta entre builds.
COPY package*.json ./
COPY nx.json tsconfig.base.json ./

# `npm ci` es estricto al lockfile (CI-friendly). El postinstall del repo
# corre `prisma generate`, así que el cliente queda generado acá.
RUN npm ci

# Ahora sí el resto del repo. .dockerignore filtra lo que no necesitamos.
COPY . .

# Build del api. Nx genera el output en `dist/apps/api/`.
RUN npx nx build api --skip-nx-cache

# ---- Stage 2: runtime ------------------------------------------------------

FROM node:24-slim AS runtime
WORKDIR /app

# OpenSSL otra vez (Prisma lo busca en runtime al inicializar el cliente).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copiamos solo lo necesario para correr:
#   - package.json (para `node` resolva entry points si hace falta)
#   - node_modules (incluye @prisma/client ya generado)
#   - dist (output del build)
#   - prisma schema + migrations (para `migrate deploy` en boot)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Railway maneja el puerto; nuestro main.ts lo lee de $PORT.
EXPOSE 3000

# Arranque: 1) aplica migraciones pendientes contra la DB, 2) levanta el
# server. Si `migrate deploy` falla (drift, DB caída), el contenedor crashea
# y Railway lo reinicia — preferimos eso a arrancar con DB en mal estado.
CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/db/prisma/schema.prisma && node dist/apps/api/main.js"]
