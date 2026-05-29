#!/usr/bin/env bash
# ETL mensal da base RFB (Dados Abertos CNPJ) -> Postgres `db-rfb`.
#
# Fonte: mirror Casa dos Dados (CDN). Cópia mensal fiel da Receita Federal.
# Diretorios sao AAAA-MM-DD (data do snapshot). Proveniencia registrada no log.
# O portal oficial (arquivos.receitafederal.gov.br) bloqueia automacao (WAF F5).
#
# Fluxo:
#   1. lock (nao roda concorrente)
#   2. descobre o snapshot mais recente do mirror (ou usa $1 = AAAA-MM-DD)
#   3. baixa todos os .zip do mes -> /mnt/rfb/work  (base segue NO AR durante o download)
#   4. [INICIO DA JANELA] recria o schema rfb vazio (drop do mes antigo)
#   5. por tipo: unzip -> \copy p/ staging text -> INSERT..SELECT (cast/subset) -> drop staging
#   6. cria indices (02_indexes.sql) e VACUUM ANALYZE  [FIM DA JANELA]
#   7. limpa scratch
#
# Disco: drop-first (cabe em volume 1x; sem 2x do blue-green). A base fica
# indisponivel da etapa 4 ate a 6 -> rodar de madrugada (cron). Ver README.
#
# Resiliencia (licoes do importar.py de teste): datas invalidas/junk -> NULL
# (rfb.dt), numericos com lixo -> NULL (rfb.num), TRIM em tudo, e arquivo com
# linha malformada e descartado+logado (ERROR_LOG) sem derrubar o mes inteiro.
#
# Notificacao de falha: o script sai !=0 e loga em stderr. Configure MAILTO=
# no crontab p/ receber email (forma padrao do cron). Opcional: $ALERT_WEBHOOK.
#
# Uso:  ./etl.sh [AAAA-MM-DD]   # data do snapshot do mirror
set -euo pipefail

# --- config (sobrescrevivel por env) -------------------------------------
COMPOSE_FILE="${COMPOSE_FILE:-/home/ubuntu/ivy/infra/docker-compose.prod.yml}"
WORKDIR="${WORKDIR:-/mnt/rfb/work}"
LOGDIR="${LOGDIR:-/mnt/rfb/logs}"
SQLDIR="${SQLDIR:-$(cd "$(dirname "$0")" && pwd)/sql}"
BASE_URL="${BASE_URL:-https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos}"
HTTP_UA="${HTTP_UA:-IVY-OSINT/1.0 (+ivysolutions.com.br)}"
RFB_DB_NAME="${RFB_DB_NAME:-rfb}"
RFB_DB_USER="${RFB_DB_USER:-rfb}"
LOCKFILE="/tmp/rfb-etl.lock"
# Tipos a carregar. Smoke test: RFB_TYPES="cnaes municipios naturezas paises qualificacoes motivos" ./etl.sh
TYPES="${RFB_TYPES:-cnaes municipios naturezas paises qualificacoes motivos empresas estabelecimentos socios}"
in_types() { case " $TYPES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

mkdir -p "$WORKDIR" "$LOGDIR"
LOGFILE="$LOGDIR/etl-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOGFILE") 2>&1

log() { echo "[$(date '+%F %T')] $*"; }

notify_fail() {
  log "ERRO: ETL falhou (linha $1). Veja $LOGFILE"
  [ -n "${ALERT_WEBHOOK:-}" ] && curl -fsS -m 15 -X POST "$ALERT_WEBHOOK" \
    -H 'content-type: application/json' \
    -d "{\"text\":\"RFB ETL falhou (linha $1). Log: $LOGFILE\"}" || true
}
trap 'notify_fail $LINENO' ERR

# psql dentro do container db-rfb. -T p/ permitir pipe de stdin.
DC="docker compose -f $COMPOSE_FILE"
psql_x() { $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

# --- lock -----------------------------------------------------------------
exec 9>"$LOCKFILE"
flock -n 9 || { log "Outra carga em andamento. Abortando."; exit 0; }

# --- 1. snapshot do mirror (AAAA-MM-DD) -----------------------------------
MES="${1:-}"
if [ -z "$MES" ]; then
  MES=$(curl -fsS -A "$HTTP_UA" "$BASE_URL/" \
        | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}/' | tr -d '/' | sort | tail -1)
fi
[ -n "$MES" ] || { log "Nao consegui determinar o snapshot mais recente."; exit 1; }
log "Snapshot alvo: $MES"
# Proveniencia (fica no log e no /docs/base-empresas.md futuro).
log "Fonte: Receita Federal (Dados Abertos CNPJ) via mirror Casa dos Dados."
log "       snapshot=$MES  base=$BASE_URL/$MES/  mirror=https://dados-abertos-rf-cnpj.casadosdados.com.br"

# Resiliencia: um arquivo com problema nao derruba a carga inteira. Falhas vao
# pro ERROR_LOG e incrementam DEGRADED; no fim o script sai !=0 (cron avisa).
ERROR_LOG="$LOGDIR/erros-$MES.txt"
: > "$ERROR_LOG"
DEGRADED=0

# --- 2. lista os zips do mes ----------------------------------------------
mapfile -t ZIPS < <(curl -fsS -A "$HTTP_UA" "$BASE_URL/$MES/" \
  | grep -oiE 'href="[^"]+\.zip"' | sed -E 's/.*href="//I;s/".*//' | sort -u)
[ "${#ZIPS[@]}" -gt 0 ] || { log "Nenhum .zip listado em $MES."; exit 1; }
log "Arquivos no mes: ${#ZIPS[@]}"

# classifica zip -> tipo pela primeira palavra do nome
tipo_de() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    empresas*)        echo empresas ;;
    estabelecimentos*) echo estabelecimentos ;;
    socios*)          echo socios ;;
    cnaes*)           echo cnaes ;;
    municipios*)      echo municipios ;;
    naturezas*)       echo naturezas ;;
    paises*)          echo paises ;;
    qualificacoes*)   echo qualificacoes ;;
    motivos*)         echo motivos ;;
    simples*)         echo skip ;;   # Simples nao entra no escopo essencial
    *)                echo skip ;;
  esac
}

run_sql_file() { $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 < "$1"; }

# --- 3. download (base ainda no ar; so os tipos em $TYPES) ----------------
log "Baixando para $WORKDIR ..."
for f in "${ZIPS[@]}"; do
  t=$(tipo_de "$f"); [ "$t" = skip ] && continue
  in_types "$t" || continue
  wget -c -q -U "$HTTP_UA" -P "$WORKDIR" "$BASE_URL/$MES/$f"
done
log "Download concluido."

# carrega 1 zip no staging informado (\copy via stdin, encoding Latin-1).
# Retorna !=0 (e loga em ERROR_LOG) se unzip ou COPY falharem -> caller decide.
# Obs.: FORMAT csv respeita aspas (";" dentro de campo entre aspas e OK). Uma
# linha realmente malformada aborta o COPY DESTE arquivo (PG16 nao pula linha);
# nesse caso logamos e seguimos pro proximo arquivo, sem derrubar o mes.
copy_zip_to() {
  local zip="$1" stg="$2" tmp csv rc=0
  tmp=$(mktemp -d -p "$WORKDIR")
  if ! unzip -o -q "$zip" -d "$tmp"; then
    log "  ERRO unzip $(basename "$zip")"
    echo "$(basename "$zip"): unzip falhou (zip corrompido?)" >> "$ERROR_LOG"
    rm -rf "$tmp"; return 1
  fi
  csv=$(find "$tmp" -type f | head -1)
  log "  COPY $(basename "$zip") -> $stg"
  if ! $DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 \
       -c "\copy $stg FROM STDIN WITH (FORMAT csv, DELIMITER ';', QUOTE '\"', ENCODING 'LATIN1')" < "$csv"; then
    log "  ERRO COPY $(basename "$zip")"
    echo "$(basename "$zip"): COPY abortou (linha malformada -> arquivo descartado)" >> "$ERROR_LOG"
    rc=1
  fi
  rm -rf "$tmp"
  return $rc
}

# --- 4. [JANELA] recria schema vazio --------------------------------------
log "Recriando schema rfb (drop do mes anterior)..."
psql_x -c "DROP SCHEMA IF EXISTS rfb CASCADE; DROP SCHEMA IF EXISTS rfb_stg CASCADE;"
run_sql_file "$SQLDIR/01_schema_tables.sql"
run_sql_file "$SQLDIR/03_staging.sql"

# --- 5. carga por tipo ----------------------------------------------------
load_type() {  # $1 = tipo
  local tipo="$1" zips=() z
  for z in "${ZIPS[@]}"; do [ "$(tipo_de "$z")" = "$tipo" ] && zips+=("$WORKDIR/$z"); done
  [ "${#zips[@]}" -gt 0 ] || return 0
  log "Tipo $tipo: ${#zips[@]} arquivo(s)"

  case "$tipo" in
    # dominio: 2 colunas, sem transform -> \copy direto na tabela final
    cnaes|municipios|naturezas|paises|qualificacoes|motivos)
      for z in "${zips[@]}"; do copy_zip_to "$z" "rfb.$tipo" || DEGRADED=$((DEGRADED+1)); done
      ;;

    empresas)
      for z in "${zips[@]}"; do copy_zip_to "$z" "rfb_stg.empresas" || DEGRADED=$((DEGRADED+1)); done
      run_sql_file "$SQLDIR/transform_empresas.sql"
      psql_x -c "TRUNCATE rfb_stg.empresas;"
      ;;

    estabelecimentos)
      for z in "${zips[@]}"; do copy_zip_to "$z" "rfb_stg.estab" || DEGRADED=$((DEGRADED+1)); done
      run_sql_file "$SQLDIR/transform_estabelecimentos.sql"
      psql_x -c "TRUNCATE rfb_stg.estab;"
      ;;

    socios)
      for z in "${zips[@]}"; do copy_zip_to "$z" "rfb_stg.socios" || DEGRADED=$((DEGRADED+1)); done
      run_sql_file "$SQLDIR/transform_socios.sql"
      psql_x -c "TRUNCATE rfb_stg.socios;"
      ;;
  esac
}

# `if`, nao `&&`: chamar load_type via && desativaria o set -e dentro dela e
# mascararia falha de transform. Falhas de COPY ja sao tratadas dentro (DEGRADED).
for tipo in cnaes municipios naturezas paises qualificacoes motivos empresas estabelecimentos socios; do
  if in_types "$tipo"; then load_type "$tipo"; fi
done

# --- 6. indices + analyze [FIM DA JANELA] ---------------------------------
log "Criando indices..."
$DC exec -T db-rfb psql -U "$RFB_DB_USER" -d "$RFB_DB_NAME" -v ON_ERROR_STOP=1 < "$SQLDIR/02_indexes.sql"
log "VACUUM ANALYZE..."
psql_x -c "DROP SCHEMA IF EXISTS rfb_stg CASCADE; VACUUM ANALYZE;"

# --- 7. limpeza -----------------------------------------------------------
log "Limpando scratch..."
rm -f "$WORKDIR"/*.zip
find "$WORKDIR" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

# contagens finais
psql_x -c "SELECT 'empresas' t, count(*) FROM rfb.empresas
           UNION ALL SELECT 'estabelecimentos', count(*) FROM rfb.estabelecimentos
           UNION ALL SELECT 'socios', count(*) FROM rfb.socios;"

if [ "$DEGRADED" -gt 0 ]; then
  log "ATENCAO: carga de $MES concluiu com $DEGRADED arquivo(s) descartado(s). Ver $ERROR_LOG"
  exit 1   # sai !=0 p/ o cron (MAILTO) avisar; a base ficou com os arquivos OK
fi
rm -f "$ERROR_LOG"
log "ETL concluido para $MES (sem erros)."
