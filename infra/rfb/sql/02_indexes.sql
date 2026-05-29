-- Indices da base RFB. Rodar SOMENTE depois do bulk load (COPY) — criar indice
-- com a tabela vazia e popular depois e muito mais lento que popular e indexar.
--
-- Cobre: lookup por CNPJ (<200ms) e o cruzamento por confusao patrimonial (M1-002:
-- empresas que compartilham email / telefone / endereco / CPF de socio com o alvo).

SET search_path TO rfb;

-- Lookup exato por CNPJ-14 -------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS estab_cnpj14_uq ON estabelecimentos (cnpj14);

-- M1-002: coincidencia de contato/endereco entre estabelecimentos ----------
-- email (normalizado, ignora vazios)
CREATE INDEX IF NOT EXISTS estab_email_idx ON estabelecimentos (lower(correio_eletronico))
    WHERE correio_eletronico IS NOT NULL AND correio_eletronico <> '';

-- telefones (ddd+numero concatenado; um indice por linha de telefone)
CREATE INDEX IF NOT EXISTS estab_tel1_idx ON estabelecimentos ((coalesce(ddd_1,'') || coalesce(telefone_1,'')))
    WHERE telefone_1 IS NOT NULL AND telefone_1 <> '';
CREATE INDEX IF NOT EXISTS estab_tel2_idx ON estabelecimentos ((coalesce(ddd_2,'') || coalesce(telefone_2,'')))
    WHERE telefone_2 IS NOT NULL AND telefone_2 <> '';

-- endereco (chave composta para match "mesmo endereco")
CREATE INDEX IF NOT EXISTS estab_endereco_idx ON estabelecimentos (cep, logradouro, numero)
    WHERE cep IS NOT NULL AND cep <> '';

-- Socios -------------------------------------------------------------------
-- join socio -> empresa/estabelecimento
CREATE INDEX IF NOT EXISTS socios_basico_idx ON socios (cnpj_basico);
-- CPF mascarado do socio (cruzamento com o alvo: 6 digitos do meio + nome)
CREATE INDEX IF NOT EXISTS socios_cpf_idx ON socios (cnpj_cpf_socio)
    WHERE cnpj_cpf_socio IS NOT NULL AND cnpj_cpf_socio <> '';
-- nome do socio (normalizado upper+trim) para desambiguar o CPF mascarado
CREATE INDEX IF NOT EXISTS socios_nome_idx ON socios (upper(btrim(nome_socio_ou_razao_social)))
    WHERE nome_socio_ou_razao_social IS NOT NULL AND nome_socio_ou_razao_social <> '';

-- empresas: PK(cnpj_basico) ja cobre lookup e joins por basico.

-- ADIADO (caros; so se a feature pedir) ------------------------------------
-- Busca de empresa por NOME do alvo (razao social) com fuzzy: indice trigram em
-- ~61M linhas custa varios GB. Hoje a entrada do M1-002 e via CPF de socio, nao
-- por nome de empresa, entao fica de fora. Habilitar quando precisar:
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX empresas_razao_trgm ON empresas USING gin (razao_social gin_trgm_ops);
--
-- Match por nome de socio com acento-normalizado: precisa wrapper IMMUTABLE de
-- unaccent. Por ora upper(btrim(...)) acima; adicionar unaccent se a calibracao pedir.
