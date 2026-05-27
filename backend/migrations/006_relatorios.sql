CREATE TABLE relatorios (
    id               BIGSERIAL    PRIMARY KEY,
    investigacao_id  BIGINT       NOT NULL UNIQUE REFERENCES investigacoes(id) ON DELETE CASCADE,
    gerado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    conteudo_md      TEXT         NOT NULL
);
