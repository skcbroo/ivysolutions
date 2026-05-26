-- Vínculo do processo com o alvo da investigação:
--   pessoal     → nome do alvo apareceu nos destinatários
--   cpf         → CPF do alvo aparece no texto da comunicação
--   empresarial → apenas empresa do alvo (não o próprio alvo) está como parte
ALTER TABLE processos ADD COLUMN vinculo TEXT;
ALTER TABLE processos ADD COLUMN empresa_vinculada TEXT;

-- Lista de últimas comunicações do processo no DJEN:
-- [{ data, tipo, texto, link }]
ALTER TABLE processos ADD COLUMN comunicacoes JSONB NOT NULL DEFAULT '[]';

CREATE INDEX proc_vinculo_idx ON processos (vinculo);
