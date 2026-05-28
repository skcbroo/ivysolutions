CREATE TABLE investigacoes (
    id            BIGSERIAL    PRIMARY KEY,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    nome          TEXT         NOT NULL,
    cpf           TEXT         NOT NULL,
    status        TEXT         NOT NULL DEFAULT 'pendente',
    -- pendente | rodando | concluido | erro
    progresso     JSONB        NOT NULL DEFAULT '{}',
    uuid_cnpja    TEXT,
    cpf_mascarado TEXT,
    capital_total NUMERIC(18,2),
    pje_count     INTEGER,
    erro_msg      TEXT
);

CREATE INDEX inv_status_idx  ON investigacoes (status);
CREATE INDEX inv_cpf_idx     ON investigacoes (cpf);
CREATE INDEX inv_created_idx ON investigacoes (created_at DESC);
