#!/usr/bin/env python3
"""
Recover de ZIP da RFB que o `\\copy FORMAT csv` do PG16 abortou.

Por que existe:
  - PG16 nao tem ON_ERROR ignore. Uma linha com aspa solta ('unterminated CSV
    quoted field') faz o COPY descartar o arquivo inteiro.
  - O csv.reader do Python e mais tolerante e permite validar ncols por linha,
    descartando so as ruins (que vao pro log).
  - Streaming: nao carrega o arquivo na memoria -> evita OOM no COPY.

Como usar (pipeline pro psql do db-rfb):
  python3 recover.py <zip> <ncols> --log <log> \\
    | docker compose exec -T db-rfb psql -U rfb -d rfb -v ON_ERROR_STOP=1 \\
        -c "\\copy rfb_stg.<tab> FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\\\N')"

Saida: TSV (tab-delimitado, NULL='\\N'), com escape de '\\', tab, newline e \\x00.
"""
import argparse
import csv
import io
import sys
import zipfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", help="caminho do arquivo .zip da RFB")
    ap.add_argument("ncols", type=int, help="numero de colunas esperado (estab=30, empresas=7, socios=11)")
    ap.add_argument("--log", default=None, help="arquivo de log das linhas descartadas")
    args = ap.parse_args()

    flog = open(args.log, "w", encoding="utf-8") if args.log else None
    total = ignored = 0

    with zipfile.ZipFile(args.zip) as zf:
        for name in zf.namelist():
            with zf.open(name) as raw:
                reader = csv.reader(
                    io.TextIOWrapper(raw, encoding="latin-1", newline=""),
                    delimiter=";",
                    quotechar='"',
                )
                for ln, row in enumerate(reader, 1):
                    if len(row) != args.ncols:
                        ignored += 1
                        if flog:
                            flog.write(f"{name}:{ln}: cols={len(row)} (esperado {args.ncols})\n")
                        continue
                    # Escape pra TSV: \, tab, newlines, NUL.
                    out_fields = []
                    for v in row:
                        v = (
                            v.replace("\\", "\\\\")
                             .replace("\t", " ")
                             .replace("\n", " ")
                             .replace("\r", " ")
                             .replace("\x00", "")
                        )
                        out_fields.append(v)
                    sys.stdout.write("\t".join(out_fields) + "\n")
                    total += 1

    sys.stderr.write(f"# recover: {args.zip} ok={total:,} descartadas={ignored:,}\n")
    if flog:
        flog.close()


if __name__ == "__main__":
    main()
