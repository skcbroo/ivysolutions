#!/usr/bin/env bash
# Recupera ZIP(s) que o etl.sh descartou (linha malformada / OOM no COPY).
# Usa recover.py (parser Python tolerante + ncols guard) e remenda em rfb.*.
#
# Pre-condicoes:
#   - db-rfb no ar; schema rfb com tabelas finais ja existindo (carga anterior).
#   - MES = snapshot que produziu os ZIPs (mesmo que o etl.sh usou).
#
# Uso:  ./recover.sh <ZIP_NAME> [ZIP_NAME ...]
#   ex: ./recover.sh Estabelecimentos0.zip Estabelecimentos4.zip
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/home/ubuntu/ivy/infra/docker-compose.prod.yml}"
WORKDIR="${WORKDIR:-/mnt/rfb/work}"
LOGDIR="${LOGDIR:-/mnt/rfb/logs}"
SCRIPTDIR="$(cd "$(dirname "$0")" && pwd)"
SQLDIR="${SQLDIR:-$SCRIPTDIR/sql}"
BASE_URL="${BASE_URL:-https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos}"
MES="${MES:-}"
HTTP_UA="${HTTP_UA:-IVY-OSINT/1.0 (+ivysolutions.com.br)}"
RFB_DB_NAME="${RFB_DB_NAME:-rfb}"
RFB_DB_USER="${RFB_DB_USER:-rfb}"

[ $# -gt 0 ] || { echo "Uso: $0 <ZIP_NAME> [ZIP_NAME ...]" >&2; exit 2; }

# Auto-descobre o snapshot mais recente se MES nao foi passado.
if [ -z "$MES" ]; then
  MES=$(curl -fsS -A "$HTTP_UA" "$BASE_URL/" \
        | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}/' | tr -d '/' | sort | tail -1)
fi
[ -n "$MES" ] || { echo "Nao determinei MES e curl falhou." >&2; exit 1; }

mkdir -p "$WORKDIR" "$LOGDIR"
DC="docker compose -f $COMPOSE_FILE"
psql_x() { $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 "$@"; }
run_sql_file() { $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 < "$1"; }
log() { echo "[$(date '+%F %T')] $*"; }

tipo_alvo() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    estabelecimentos*) echo estab ;;
    empresas*)         echo empresas ;;
    socios*)           echo socios ;;
    *)                 echo "" ;;
  esac
}
ncols_de() {
  case "$1" in
    estab) echo 30 ;; empresas) echo 7 ;; socios) echo 11 ;; *) echo 0 ;;
  esac
}

log "Snapshot: $MES"
log "Recriando schema rfb_stg (foi dropado no fim do etl.sh)..."
run_sql_file "$SQLDIR/03_staging.sql"

types=()
for zip in "$@"; do
  t=$(tipo_alvo "$zip")
  if [ -z "$t" ]; then log "  IGNORADO $zip (tipo desconhecido)"; continue; fi
  log "Baixando $zip ..."
  wget -c -q -U "$HTTP_UA" -P "$WORKDIR" "$BASE_URL/$MES/$zip"
  n=$(ncols_de "$t")
  elog="$LOGDIR/recover-$zip.erros.txt"
  log "Parsing tolerante (ncols=$n) -> rfb_stg.$t  (descartes -> $elog)"
  python3 "$SCRIPTDIR/recover.py" "$WORKDIR/$zip" "$n" --log "$elog" \
    | $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 \
        -c "\copy rfb_stg.$t FROM STDIN WITH (FORMAT text, DELIMITER E'\t', NULL '\\\\N')"
  types+=("$t")
done

# Roda o transform p/ cada tipo carregado (uma vez por tipo)
declare -A seen=()
for t in "${types[@]}"; do
  [ -n "${seen[$t]:-}" ] && continue
  seen[$t]=1
  case "$t" in
    empresas) log "Transform empresas..."; run_sql_file "$SQLDIR/transform_empresas.sql" ;;
    estab)    log "Transform estabelecimentos..."; run_sql_file "$SQLDIR/transform_estabelecimentos.sql" ;;
    socios)   log "Transform socios..."; run_sql_file "$SQLDIR/transform_socios.sql" ;;
  esac
done

log "Limpando rfb_stg..."
psql_x -c "DROP SCHEMA IF EXISTS rfb_stg CASCADE;"

log "Contagens finais:"
psql_x -c "SELECT 'empresas' t, count(*) FROM rfb.empresas
           UNION ALL SELECT 'estabelecimentos', count(*) FROM rfb.estabelecimentos
           UNION ALL SELECT 'socios', count(*) FROM rfb.socios;"

log "Recuperacao concluida. Rode VACUUM ANALYZE (PARALLEL 0 se shm_size ainda 64MB)."
