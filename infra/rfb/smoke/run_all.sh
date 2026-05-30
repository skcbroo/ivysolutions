#!/usr/bin/env bash
# Roda toda a bateria de smoke offline:
#   1. lib_test.sh       (funcoes do lib.sh)
#   2. recover_test.sh   (parser tolerante)
#   3. transform_test.sql (transforms; requer Postgres em $PG_URL)
# Item 3 e pulado se $PG_URL nao for definido.
#
# Exit code: 0 se tudo passa; soma de falhas caso contrario.
set -u
SDIR="$(cd "$(dirname "$0")" && pwd)"
total_fail=0

run() {
  local name="$1"; shift
  echo
  echo "=== $name ==="
  "$@"
  local rc=$?
  if [ $rc -ne 0 ]; then total_fail=$((total_fail+rc)); fi
  return $rc
}

run "lib.sh unit tests"     bash "$SDIR/lib_test.sh"     || true
run "recover.py unit tests" bash "$SDIR/recover_test.sh" || true

if [ -n "${PG_URL:-}" ]; then
  if command -v psql >/dev/null 2>&1; then
    run "transform_test.sql (SQL)" psql "$PG_URL" -v ON_ERROR_STOP=1 -f "$SDIR/transform_test.sql"
  else
    echo
    echo "=== transform_test.sql: PULADO (psql nao instalado) ==="
  fi
else
  echo
  echo "=== transform_test.sql: PULADO (defina PG_URL p/ rodar contra um Postgres) ==="
fi

echo
echo "============================================"
if [ "$total_fail" -eq 0 ]; then
  echo "TODOS OS SMOKES PASSARAM"
else
  echo "FALHAS: $total_fail"
fi
echo "============================================"
exit "$total_fail"
