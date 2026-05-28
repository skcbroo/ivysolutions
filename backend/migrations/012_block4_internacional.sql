-- Block 4: buscas internacionais (OpenSanctions e, futuramente, scraping de
-- Companies House, Offshore Leaks, Sunbiz, Miami-Dade). Atrás da flag
-- BLOCK4_ENABLED; tabela vazia quando o bloco não rodou.
CREATE TABLE investigacao_internacional (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    fonte            TEXT        NOT NULL,
    entidade         TEXT        NOT NULL,
    score            REAL,
    match            BOOLEAN     NOT NULL DEFAULT false,
    paises           TEXT[],
    programas        TEXT[],
    aliases          TEXT[],
    datasets         TEXT[],
    url              TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX intl_inv_idx ON investigacao_internacional (investigacao_id);
