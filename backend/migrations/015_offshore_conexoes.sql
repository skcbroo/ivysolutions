-- ICIJ: nós conectados ao vínculo offshore (entidade, endereço, intermediário),
-- coletados via grafo (/nodes/{id}.json). Enriquece o dossiê.
ALTER TABLE investigacao_offshore ADD COLUMN conexoes JSONB NOT NULL DEFAULT '[]';
