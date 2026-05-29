-- Base RFB (Dados Abertos CNPJ) — schema definitivo, colunas essenciais.
-- Roda no Postgres dedicado `db-rfb` (volume /mnt/rfb), isolado do banco do app.
--
-- Layout-fonte: Receita Federal, "cnpj-metadados". CSV ;-delimitado, Latin-1, sem header.
-- Decisoes de escopo: ver /docs/base-empresas.md.
--   mantidos por valor patrimonial: situacao_especial, data_situacao_especial,
--     motivo_situacao_cadastral, socios.pais.
--   adiado (unico com custo real de disco): estabelecimentos.cnae_fiscal_secundaria.
--
-- Ordem de carga do ETL: criar tabelas (este arquivo) -> COPY/transform -> 02_indexes.sql.
-- Indices NAO ficam aqui de proposito (criar so depois do bulk load).

CREATE SCHEMA IF NOT EXISTS rfb;
SET search_path TO rfb;

-- Helpers de limpeza usados nas transforms (staging text -> tipado).
-- dt(): AAAAMMDD valido -> date; '0'/'00000000'/lixo/len!=8 -> NULL (nao aborta a carga).
CREATE OR REPLACE FUNCTION rfb.dt(text) RETURNS date
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN btrim($1) ~ '^\d{8}$' AND btrim($1) <> '00000000'
                THEN to_date(btrim($1), 'YYYYMMDD') END
$$;

-- num(): texto numerico (ja com ponto decimal) -> numeric; vazio/lixo -> NULL.
CREATE OR REPLACE FUNCTION rfb.num(text) RETURNS numeric
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN btrim($1) ~ '^-?\d+(\.\d+)?$' THEN btrim($1)::numeric END
$$;

-- Tabelas de dominio (codigo;descricao) -----------------------------------

CREATE TABLE IF NOT EXISTS cnaes        (codigo TEXT PRIMARY KEY, descricao TEXT);
CREATE TABLE IF NOT EXISTS municipios   (codigo TEXT PRIMARY KEY, descricao TEXT);
CREATE TABLE IF NOT EXISTS naturezas    (codigo TEXT PRIMARY KEY, descricao TEXT);
CREATE TABLE IF NOT EXISTS paises       (codigo TEXT PRIMARY KEY, descricao TEXT);
CREATE TABLE IF NOT EXISTS qualificacoes(codigo TEXT PRIMARY KEY, descricao TEXT);
CREATE TABLE IF NOT EXISTS motivos      (codigo TEXT PRIMARY KEY, descricao TEXT);

-- EMPRESAS (nivel matriz / CNPJ basico) -----------------------------------

CREATE TABLE IF NOT EXISTS empresas (
    cnpj_basico        TEXT          PRIMARY KEY,   -- 8 digitos
    razao_social       TEXT,
    natureza_juridica  TEXT,                        -- FK logica -> naturezas.codigo
    capital_social     NUMERIC(18,2),               -- CSV usa virgula decimal; loader converte
    porte              TEXT                         -- 00/01/03/05
);

-- ESTABELECIMENTOS (unidades; endereco, contatos, situacao) ----------------

CREATE TABLE IF NOT EXISTS estabelecimentos (
    cnpj_basico                TEXT NOT NULL,
    cnpj_ordem                 TEXT NOT NULL,        -- 4 digitos
    cnpj_dv                    TEXT NOT NULL,        -- 2 digitos
    -- CNPJ-14 materializado para lookup exato <200ms:
    cnpj14                     TEXT GENERATED ALWAYS AS (cnpj_basico || cnpj_ordem || cnpj_dv) STORED,
    identificador_matriz_filial TEXT,                -- 1=matriz 2=filial
    nome_fantasia              TEXT,
    situacao_cadastral         TEXT,                 -- 01/02/03/04/08
    data_situacao_cadastral    DATE,                 -- CSV AAAAMMDD; loader converte / 0->NULL
    motivo_situacao_cadastral  TEXT,                 -- FK logica -> motivos.codigo
    data_inicio_atividade      DATE,
    cnae_fiscal_principal      TEXT,                 -- FK logica -> cnaes.codigo
    tipo_logradouro            TEXT,
    logradouro                 TEXT,
    numero                     TEXT,
    complemento                TEXT,
    bairro                     TEXT,
    cep                        TEXT,                 -- 8 digitos, preserva zeros a esquerda
    uf                         TEXT,
    municipio                  TEXT,                 -- FK logica -> municipios.codigo
    ddd_1                      TEXT,
    telefone_1                 TEXT,
    ddd_2                      TEXT,
    telefone_2                 TEXT,
    correio_eletronico         TEXT,
    situacao_especial          TEXT,                 -- ex.: "EM RECUPERACAO JUDICIAL", "FALIDO"
    data_situacao_especial     DATE,
    PRIMARY KEY (cnpj_basico, cnpj_ordem, cnpj_dv)
);

-- SOCIOS -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS socios (
    cnpj_basico                 TEXT NOT NULL,
    identificador_socio         TEXT,                -- 1=PJ 2=PF 3=estrangeiro
    nome_socio_ou_razao_social  TEXT,
    -- PF: CPF MASCARADO pela Receita -> ***NNNNNN** (so 6 digitos do meio).
    -- Match por CPF cheio do alvo nao fecha; cruzar por 6 digitos + nome.
    cnpj_cpf_socio              TEXT,
    qualificacao_socio          TEXT,                -- FK logica -> qualificacoes.codigo
    data_entrada_sociedade      DATE,
    pais                        TEXT,                -- FK logica -> paises.codigo (socio estrangeiro)
    faixa_etaria                TEXT                 -- 1..9
);
