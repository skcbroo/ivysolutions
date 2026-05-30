#!/usr/bin/env bash
# Test do recover.py: constroi ZIP sintetico com mix de linhas boas e ruins,
# roda o parser, e valida que descarta as ruins e emite so as boas.
# Cobre exatamente os cenarios que derrubaram o COPY na carga real (aspa solta,
# ncols errado).
set -u
SDIR="$(cd "$(dirname "$0")/.." && pwd)"
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

pass=0; fail=0
ok() { echo "  PASS: $1"; pass=$((pass+1)); }
ko() { echo "  FAIL: $1"; fail=$((fail+1)); }

# ZIP fixture com CSV Latin-1, ; delimitador, 5 colunas esperadas.
python3 - "$TMPD" <<'PY'
import sys, zipfile
out = sys.argv[1] + "/fixture.zip"
csv_bytes = (
    'AAA;linha boa 1;x;y;z\n'
    'BBB;linha boa 2;x;y;z\n'
    'CCC;linha boa 3;x;y;z\n'
    'DDD;poucos;campos\n'                          # 3 cols -> descarta
    'EEE;muitos;campos;extras;sobrando;1;2\n'      # 7 cols -> descarta
).encode("latin-1")
with zipfile.ZipFile(out, "w") as z:
    z.writestr("FIXTURE.ESTABELE", csv_bytes)
PY

ZIP="$TMPD/fixture.zip"
LOG="$TMPD/erros.txt"
OUT="$TMPD/out.tsv"

python3 "$SDIR/recover.py" "$ZIP" 5 --log "$LOG" > "$OUT" 2> "$TMPD/stderr.txt"

# Esperado: 3 linhas TSV no stdout.
NLINES=$(wc -l < "$OUT" | tr -d ' ')
[ "$NLINES" = "3" ] && ok "3 linhas validas emitidas" || ko "esperado 3, veio $NLINES"

# 2 descartes no log.
NERR=$(wc -l < "$LOG" | tr -d ' ')
[ "$NERR" = "2" ] && ok "2 linhas registradas no log de erros" || ko "esperado 2, veio $NERR"

# Conteudo das linhas boas (TSV) bate.
grep -q "^AAA	linha boa 1	x	y	z$" "$OUT" && ok "row AAA preservada" || ko "AAA nao apareceu"
grep -q "^BBB	linha boa 2	x	y	z$" "$OUT" && ok "row BBB preservada" || ko "BBB nao apareceu"
grep -q "^CCC	linha boa 3	x	y	z$" "$OUT" && ok "row CCC preservada" || ko "CCC nao apareceu"

# Linhas ruins NAO devem ter vazado.
grep -q "DDD" "$OUT" && ko "DDD vazou pro stdout" || ok "DDD descartada"
grep -q "EEE" "$OUT" && ko "EEE vazou pro stdout" || ok "EEE descartada"

# Stderr deve registrar o resumo
grep -qi "recover" "$TMPD/stderr.txt" && ok "stderr tem resumo" || ko "stderr sem resumo"

# Segundo cenario: aspa solta (csv.reader e tolerante - lida sem crash).
python3 - "$TMPD" <<'PY'
import sys, zipfile
out = sys.argv[1] + "/quoted.zip"
# 5 colunas, com uma com aspa solta no campo do meio
csv_bytes = (
    '"AAA";"linha boa";"x";"y";"z"\n'
    '"BBB";"campo "com aspa solta;"x";"y";"z"\n'  # aspa nao fechada
    '"CCC";"linha boa 2";"x";"y";"z"\n'
).encode("latin-1")
with zipfile.ZipFile(out, "w") as z:
    z.writestr("FIXTURE.ESTABELE", csv_bytes)
PY

ZIP2="$TMPD/quoted.zip"
OUT2="$TMPD/out2.tsv"
LOG2="$TMPD/erros2.txt"
if python3 "$SDIR/recover.py" "$ZIP2" 5 --log "$LOG2" > "$OUT2" 2>/dev/null; then
  ok "recover.py nao crashou com aspa solta"
else
  ko "recover.py crashou com aspa solta"
fi
# nao asseguramos contagem exata aqui (depende do csv.reader); so que terminou OK.

rm -rf "$TMPD"; trap - EXIT
echo
echo "recover_test: $pass passou, $fail falhou"
exit "$fail"
