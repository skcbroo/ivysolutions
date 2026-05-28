-- Listas completas de contatos vindas do CNPJa Open (alguns CNPJs têm
-- múltiplos e-mails / telefones públicos). Mantemos as colunas escalares
-- email/telefone como espelho do primeiro contato para queries simples.
ALTER TABLE empresas ADD COLUMN emails JSONB NOT NULL DEFAULT '[]';
ALTER TABLE empresas ADD COLUMN telefones JSONB NOT NULL DEFAULT '[]';
