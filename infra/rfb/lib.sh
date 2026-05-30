# Helpers do ETL RFB. Source-able (sem side effects no source).
# Funcoes isoladas para serem testaveis em smoke/ sem precisar de Postgres/docker.

SNAPSHOT_FILE_DEFAULT="${SNAPSHOT_FILE_DEFAULT:-/mnt/rfb/.snapshot}"

# should_run_snapshot <snapshot_alvo> [snapshot_file]
#   Retorna 0 (=rodar carga) ou 1 (=skip, ja carregado).
should_run_snapshot() {
    local alvo="$1" sf="${2:-$SNAPSHOT_FILE_DEFAULT}"
    [ -n "$alvo" ] || return 0          # sem alvo -> deixa o caller decidir
    [ -f "$sf" ]  || return 0           # nunca rodou -> rodar
    local atual; atual=$(head -1 "$sf" 2>/dev/null | tr -d '[:space:]')
    [ "$atual" = "$alvo" ] && return 1 || return 0
}

# mark_snapshot_loaded <snapshot> [snapshot_file]
#   Marca o snapshot como carregado com sucesso (chamar so no fim, sem DEGRADED).
mark_snapshot_loaded() {
    local mes="$1" sf="${2:-$SNAPSHOT_FILE_DEFAULT}"
    mkdir -p "$(dirname "$sf")"
    printf '%s\n' "$mes" > "$sf"
}

# cleanup_workdir <path>
#   Remove .zip top-level e tmpdirs orfaos. Preserva outros arquivos (.txt, .log).
#   Idempotente; nao falha se dir nao existe.
cleanup_workdir() {
    local dir="$1"
    [ -d "$dir" ] || return 0
    find "$dir" -mindepth 1 -maxdepth 1 -name '*.zip' -type f -delete 2>/dev/null || true
    find "$dir" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
}

# ncols_de_stg <tabela>  -> echo do numero de colunas esperado no CSV bruto da RF.
#   Usado pelo fallback Python (recover.py) quando o COPY bash falha.
ncols_de_stg() {
    case "$1" in
        rfb_stg.empresas) echo 7 ;;
        rfb_stg.estab)    echo 30 ;;
        rfb_stg.socios)   echo 11 ;;
        rfb.cnaes|rfb.municipios|rfb.naturezas|rfb.paises|rfb.qualificacoes|rfb.motivos) echo 2 ;;
        *) echo 0 ;;
    esac
}
