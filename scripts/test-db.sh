#!/usr/bin/env bash
# Prova le migrazioni e le regole RLS su un Postgres locale temporaneo.
# Richiede i binari di PostgreSQL (initdb, pg_ctl, psql). Uso: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"

# Postgres non gira come root: in quel caso si usa l'utente postgres.
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

psql_run() { "${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres "$@"; }

psql_run -f "$ROOT/supabase/tests/supabase_stub.sql"

# Ogni migrazione è seguita dal test della sua fase (phase2_test dopo la prima, e così via):
# così ogni test vede il database com'era alla fine della sua fase.
mapfile -t MIGRATIONS < <(ls "$ROOT"/supabase/migrations/*.sql | sort)
mapfile -t TESTS < <(ls "$ROOT"/supabase/tests/phase*_test.sql | sort -V)
for idx in "${!MIGRATIONS[@]}"; do
  echo "migrazione: $(basename "${MIGRATIONS[$idx]}")"
  psql_run -f "${MIGRATIONS[$idx]}"
  if [ -n "${TESTS[$idx]:-}" ]; then
    echo "test: $(basename "${TESTS[$idx]}")"
    psql_run -o /dev/null -f "$ROOT/supabase/tests/helpers.sql" -f "${TESTS[$idx]}"
  fi
done
