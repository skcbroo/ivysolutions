CREATE TABLE processos (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    numero           TEXT        NOT NULL,
    tribunal         TEXT,
    orgao            TEXT,
    classe           TEXT,
    tipo             TEXT,
    polo             TEXT,
    link             TEXT,
    criminal         BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE processos_empresas_vinculadas (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    nome             TEXT        NOT NULL,
    polo             TEXT
);

CREATE TABLE processos_advogados (
    id               BIGSERIAL   PRIMARY KEY,
    investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
    nome             TEXT        NOT NULL,
    oab              TEXT
);

CREATE INDEX proc_inv_idx     ON processos (investigacao_id);
CREATE INDEX proc_ev_inv_idx  ON processos_empresas_vinculadas (investigacao_id);
CREATE INDEX proc_adv_inv_idx ON processos_advogados (investigacao_id);
