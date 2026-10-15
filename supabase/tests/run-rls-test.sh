#!/usr/bin/env bash
# Roda os testes de RLS contra um PostgreSQL local (banco descartável).
# Uso: PGHOST=... PGUSER=postgres bash supabase/tests/run-rls-test.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB="glossy_rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/supabase_stub.sql"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/../schema.sql"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/../schema.sql"   # idempotência
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/rls_test.sql"
