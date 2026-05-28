-- Gestão de usuários:
--   role: 'admin' (gerencia outros usuários) ou 'analista' (uso normal)
--   active: soft delete; usuários inativos não conseguem logar mas histórico fica
--   must_change_password: usuário precisa trocar a senha no próximo login
--     (true quando criado por admin com senha padrão ou após reset)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'analista';
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'analista'));

-- O primeiro admin é criado pelo bootstrap (auth/bootstrap.ts) a partir das
-- env vars ADMIN_EMAIL/ADMIN_PASSWORD. Não fazemos UPDATE hardcoded aqui.

CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_active_idx ON users (active);
