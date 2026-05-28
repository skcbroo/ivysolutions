-- Block 4: buscas internacionais. Dados estruturados, costurados ao dossiê:
--  - investigacao_sancoes        → risco sobre a pessoa (OpenSanctions).
--  - investigacao_empresas_exterior → sociedades no exterior (Companies House).
-- Atrás da flag BLOCK4_ENABLED; tabelas vazias quando o bloco não rodou.

CREATE TABLE investigacao_sancoes (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    entidade         TEXT        NOT NULL,
    score            REAL,
    match            BOOLEAN     NOT NULL DEFAULT false,
    paises           TEXT[],
    programas        TEXT[],
    listas           TEXT[],
    aliases          TEXT[],
    url              TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investigacao_empresas_exterior (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    officer          TEXT        NOT NULL,
    empresa          TEXT        NOT NULL,
    numero           TEXT,
    jurisdicao       TEXT        NOT NULL,
    cargo            TEXT,
    entrada          TEXT,
    saida            TEXT,
    url              TEXT,
    score            REAL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sancoes_inv_idx     ON investigacao_sancoes (investigacao_id);
CREATE INDEX emp_ext_inv_idx     ON investigacao_empresas_exterior (investigacao_id);
