#!/usr/bin/env bash
# Unit tests das funcoes em lib.sh.
# Roda local; nao precisa de Postgres, docker ou rede.
set -u
SDIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../lib.sh
. "$SDIR/lib.sh"

pass=0; fail=0
ok() { echo "  PASS: $1"; pass=$((pass+1)); }
ko() { echo "  FAIL: $1"; fail=$((fail+1)); }

# --- should_run_snapshot ---
tmp=$(mktemp -d); SF="$tmp/.snapshot"

if should_run_snapshot "2026-05-10" "$SF"; then ok "sem snapshot -> rodar"; else ko "sem snapshot deveria rodar"; fi

echo "2026-05-10" > "$SF"
if should_run_snapshot "2026-05-10" "$SF"; then ko "igual deveria skipar"; else ok "snapshot igual -> skip"; fi

echo "2026-04-12" > "$SF"
if should_run_snapshot "2026-05-10" "$SF"; then ok "diferente -> rodar"; else ko "diferente deveria rodar"; fi

# arquivo com lixo de espacos/newline (trata bem?)
printf '   2026-05-10   \n  \n' > "$SF"
if should_run_snapshot "2026-05-10" "$SF"; then ko "deveria skipar (com whitespace)"; else ok "snapshot c/ whitespace -> skip"; fi

# --- mark_snapshot_loaded ---
SF2="$tmp/marked"
mark_snapshot_loaded "2026-05-10" "$SF2"
[ "$(cat "$SF2")" = "2026-05-10" ] && ok "mark grava snapshot" || ko "mark nao gravou"

# --- cleanup_workdir ---
WD=$(mktemp -d)
touch "$WD/a.zip" "$WD/b.zip" "$WD/c.txt" "$WD/d.log"
mkdir "$WD/tmpdir"; touch "$WD/tmpdir/leftover"
cleanup_workdir "$WD"
[ ! -e "$WD/a.zip" ] && ok "a.zip removido" || ko "a.zip ficou"
[ ! -e "$WD/b.zip" ] && ok "b.zip removido" || ko "b.zip ficou"
[ ! -e "$WD/tmpdir" ] && ok "tmpdir removido" || ko "tmpdir ficou"
[ -e "$WD/c.txt" ] && ok ".txt preservado" || ko ".txt sumiu"
[ -e "$WD/d.log" ] && ok ".log preservado" || ko ".log sumiu"

# idempotente em dir inexistente
cleanup_workdir "/dir/que/nao/existe"  # nao deve falhar
ok "cleanup nao falha em dir ausente"

# --- ncols_de_stg ---
[ "$(ncols_de_stg rfb_stg.empresas)" = "7"  ] && ok "ncols empresas=7"  || ko "empresas errado"
[ "$(ncols_de_stg rfb_stg.estab)"    = "30" ] && ok "ncols estab=30"   || ko "estab errado"
[ "$(ncols_de_stg rfb_stg.socios)"   = "11" ] && ok "ncols socios=11"  || ko "socios errado"
[ "$(ncols_de_stg rfb.cnaes)"        = "2"  ] && ok "ncols cnaes=2"    || ko "cnaes errado"
[ "$(ncols_de_stg rfb.qualificacoes)" = "2" ] && ok "ncols qualif=2"   || ko "qualif errado"
[ "$(ncols_de_stg desconhecido)"     = "0"  ] && ok "ncols default=0"  || ko "default errado"

rm -rf "$tmp" "$WD"
echo
echo "lib_test: $pass passou, $fail falhou"
exit "$fail"
