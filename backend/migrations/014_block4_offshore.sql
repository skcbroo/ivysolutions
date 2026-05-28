-- Block 4 — ICIJ Offshore Leaks: vínculos do alvo a vazamentos offshore
-- (Panama/Pandora/Paradise Papers etc.). Costurado ao dossiê como risco.
-- Atrás da flag BLOCK4_ENABLED; tabela vazia quando a fonte não rodou.

CREATE TABLE investigacao_offshore (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    entidade         TEXT        NOT NULL,
    tipo             TEXT,
    dataset          TEXT        NOT NULL,
    score            REAL,
    match            BOOLEAN     NOT NULL DEFAULT false,
    url              TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offshore_inv_idx ON investigacao_offshore (investigacao_id);
