CREATE TABLE empresas (
    id               BIGSERIAL    PRIMARY KEY,
    investigacao_id  BIGINT       NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    cnpj14           TEXT         NOT NULL,
    nome             TEXT,
    nome_fantasia    TEXT,
    situacao         TEXT,
    data_situacao    DATE,
    abertura         DATE,
    capital          NUMERIC(18,2),
    cnae             TEXT,
    natureza         TEXT,
    porte            TEXT,
    cargo            TEXT,
    data_entrada     DATE,
    endereco         TEXT,
    email            TEXT,
    telefone         TEXT,
    qsa              JSONB        NOT NULL DEFAULT '[]',
    alertas          JSONB        NOT NULL DEFAULT '[]'
);

CREATE INDEX emp_inv_idx  ON empresas (investigacao_id);
CREATE INDEX emp_cnpj_idx ON empresas (cnpj14);
