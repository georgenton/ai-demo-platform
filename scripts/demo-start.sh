#!/usr/bin/env bash
# =============================================================================
# demo-start.sh — orquesta los 6 pasos del preparado de demo en un solo
# comando. Pensado para que minutos antes de presentar al cliente, Jorge o
# Edguitar ejecuten `npm run demo:start` y tengan la app lista en ~60s.
#
# Pasos:
#   1) Postgres + pgvector (docker compose)
#   2) Migraciones Prisma (deploy — solo aplica lo pendiente)
#   3) Seed académico (50 estudiantes, 10 cursos, ~1.700 grades — Demo 04)
#   4) Backend NestJS en background (espera /health 200)
#   5) Seed de documentos sample (3 RAG + 3 Comparator)
#   6) Frontend Next.js en background (espera primer paint en :4200)
#
# Ctrl+C limpia todo (kill api + web, deja la DB arriba para la próxima vez).
#
# Idempotencia: todos los pasos son seguros de re-correr. El seed académico
# hace deleteMany + create siempre. El seed:demos skipea docs ya existentes.
#
# Logs separados en /tmp/demo-api.log y /tmp/demo-web.log — la terminal
# principal solo muestra progreso resumido. Si algo falla, el mensaje dice
# qué log mirar.
# =============================================================================

set -e

# ── Layout ──────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_LOG="/tmp/demo-api.log"
WEB_LOG="/tmp/demo-web.log"
API_PORT=3000
WEB_PORT=4200

# ── Colors ──────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
  GREEN=$'\033[0;32m'
  BLUE=$'\033[0;34m'
  YELLOW=$'\033[1;33m'
  RED=$'\033[0;31m'
  DIM=$'\033[2m'
  NC=$'\033[0m'
else
  GREEN=''; BLUE=''; YELLOW=''; RED=''; DIM=''; NC=''
fi

step() { echo "${BLUE}$1${NC}"; }
ok()   { echo "    ${GREEN}✓${NC} $1"; }
warn() { echo "    ${YELLOW}⚠${NC} $1"; }
err()  { echo "    ${RED}✗${NC} $1"; }
dim()  { echo "    ${DIM}$1${NC}"; }

# ── Cleanup ─────────────────────────────────────────────────────────────────
#
# Cuando el usuario hace Ctrl+C, matamos los procesos del API y la Web.
# Usamos `pkill -f` con patrones específicos en lugar de los PIDs directos
# porque `npx nx serve` lanza sub-procesos (webpack, nest) y kill al PID
# raíz no siempre los baja a todos. Pkill por pattern los pesca a todos.
# La DB la dejamos arriba — apagarla es manual con `docker compose down`.

cleanup() {
  echo
  echo "${YELLOW}Deteniendo backend y frontend...${NC}"
  pkill -f 'nx serve api'  2>/dev/null || true
  pkill -f 'nx dev web'    2>/dev/null || true
  # Webpack-cli y next-server son sub-procesos del nx wrapper — segundo
  # barrido por las dudas (kill al PID raíz no siempre los baja a todos).
  pkill -f 'webpack-cli'   2>/dev/null || true
  pkill -f 'next dev'      2>/dev/null || true
  pkill -f 'next-server'   2>/dev/null || true
  echo "${GREEN}Listo. La DB sigue arriba — apagala con 'docker compose down' si querés.${NC}"
}
trap cleanup INT TERM EXIT

# ── 1) Postgres ─────────────────────────────────────────────────────────────

step "1/6  Postgres + pgvector"
docker compose up -d postgres >/dev/null
dim "esperando que responda pg_isready..."
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-aidemo}" -d "${POSTGRES_DB:-aidemo}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-aidemo}" -d "${POSTGRES_DB:-aidemo}" >/dev/null 2>&1; then
  err "la DB no respondió en 30s — chequeá 'docker compose logs postgres'"
  exit 1
fi
ok "DB lista en localhost:5434"

# ── 2) Migraciones ──────────────────────────────────────────────────────────

step "2/6  Migraciones Prisma"
npm run db:migrate:deploy --silent
ok "migraciones aplicadas"

# ── 3) Seed académico ───────────────────────────────────────────────────────

step "3/6  Seed académico (Demo 04)"
npm run db:seed --silent
ok "50 estudiantes · 10 cursos · ~1.700 grades sembrados"

# ── 4) Backend ──────────────────────────────────────────────────────────────

step "4/6  Backend NestJS"
# Si ya está corriendo, no lo arrancamos de nuevo.
if curl -fsS "http://localhost:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  ok "backend ya estaba arriba en :${API_PORT}"
else
  dim "arrancando en background (logs en ${API_LOG})..."
  # nohup + setsid harían más portable la separación de proc group; nos
  # alcanza con `&` porque el cleanup mata por pattern (pkill -f).
  : > "$API_LOG"
  npx nx serve api >"$API_LOG" 2>&1 &
  dim "esperando /health 200..."
  for _ in $(seq 1 90); do
    if curl -fsS "http://localhost:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS "http://localhost:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
    err "el backend no respondió en 90s"
    dim "Causa más probable: CHAT_API_KEY o EMBEDDINGS_API_KEY vacías en .env"
    dim "Mirá los últimos logs:"
    echo
    tail -n 30 "$API_LOG"
    exit 1
  fi
  ok "backend respondiendo en http://localhost:${API_PORT}"
fi

# ── 5) Seed de documentos sample ────────────────────────────────────────────

step "5/6  Documentos sample (RAG + Comparator)"
npm run db:seed:demos --silent
ok "documentos listos"

# ── 6) Frontend ─────────────────────────────────────────────────────────────

step "6/6  Frontend Next.js"
if curl -fsS "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
  ok "frontend ya estaba arriba en :${WEB_PORT}"
else
  dim "arrancando en background (logs en ${WEB_LOG})..."
  : > "$WEB_LOG"
  # `nx dev web` por default usaría el puerto 3000 (default de Next.js)
  # y chocaría con el backend NestJS que ya está en 3000 — forzamos 4200
  # con PORT. El target del web es `dev` (no `serve`) porque @nx/next sigue
  # la convención de Next.js: `next dev` para HMR, `next start` para prod.
  PORT="${WEB_PORT}" npx nx dev web >"$WEB_LOG" 2>&1 &
  dim "esperando primer paint (Next.js puede tardar ~30s en compilar la primera vez)..."
  for _ in $(seq 1 120); do
    if curl -fsS "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
    warn "el frontend todavía no respondió — abrí http://localhost:${WEB_PORT} en unos segundos"
    dim "(esto es normal en la primera corrida; HMR queda activo)"
  else
    ok "frontend respondiendo en http://localhost:${WEB_PORT}"
  fi
fi

# ── Resumen final ───────────────────────────────────────────────────────────

cat <<EOF

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}  ✓ Todo listo para la demo${NC}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

  ${BLUE}Frontend:${NC}  http://localhost:${WEB_PORT}
  ${BLUE}Backend:${NC}   http://localhost:${API_PORT}/api/v1
  ${BLUE}Swagger:${NC}   http://localhost:${API_PORT}/api/docs

  ${DIM}Logs:${NC}
    ${DIM}backend  → ${API_LOG}${NC}
    ${DIM}frontend → ${WEB_LOG}${NC}

  ${YELLOW}Presioná Ctrl+C para detener todo.${NC}
  ${DIM}(la DB queda arriba; apagala con 'docker compose down' si querés)${NC}

EOF

# Bloqueamos esperando a que los procesos terminen. El trap dispara
# cleanup() en Ctrl+C / kill al script y los baja.
wait
