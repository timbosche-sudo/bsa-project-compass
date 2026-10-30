#!/usr/bin/env bash
# Spins up a throwaway local PostgreSQL cluster, applies the Compass migration
# on a minimal Supabase shim, and runs the row-level security checks.
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
if [ "$(id -u)" = "0" ]; then
  echo "Run as a non-root user (PostgreSQL refuses to run as root)." >&2; exit 2
fi
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=("$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -t -A)
"${PSQL[@]}" -d postgres -c "create database compass_test" >/dev/null
"${PSQL[@]}" -d compass_test -f "$ROOT/supabase/tests/supabase_shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d compass_test -f "$f" >/dev/null; done
"${PSQL[@]}" -d compass_test -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed -n 's/.*NOTICE:  //p; /ALL RLS/p'
