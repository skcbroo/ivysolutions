-- Tabelas de staging (texto cru, layout EXATO do CSV da Receita, todas as colunas).
-- O ETL faz \copy aqui e depois transforma p/ o schema rfb (subset + casts).
-- Recriadas a cada carga; truncadas apos cada transform p/ liberar disco.

CREATE SCHEMA IF NOT EXISTS rfb_stg;

-- EMPRESAS: 7 colunas
CREATE TABLE IF NOT EXISTS rfb_stg.empresas (
    c1 text, c2 text, c3 text, c4 text, c5 text, c6 text, c7 text
);

-- ESTABELECIMENTOS: 30 colunas
CREATE TABLE IF NOT EXISTS rfb_stg.estab (
    c1 text,  c2 text,  c3 text,  c4 text,  c5 text,  c6 text,  c7 text,  c8 text,  c9 text,  c10 text,
    c11 text, c12 text, c13 text, c14 text, c15 text, c16 text, c17 text, c18 text, c19 text, c20 text,
    c21 text, c22 text, c23 text, c24 text, c25 text, c26 text, c27 text, c28 text, c29 text, c30 text
);

-- SOCIOS: 11 colunas
CREATE TABLE IF NOT EXISTS rfb_stg.socios (
    c1 text, c2 text, c3 text, c4 text, c5 text, c6 text, c7 text, c8 text, c9 text, c10 text, c11 text
);
