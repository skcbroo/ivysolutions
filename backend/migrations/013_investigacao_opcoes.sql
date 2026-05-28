-- Escopo por investigação: opções escolhidas no formulário (quais blocos/fontes
-- rodar) e falhas isoladas por bloco (para o status 'concluido_parcial').
ALTER TABLE investigacoes ADD COLUMN opcoes JSONB NOT NULL DEFAULT '{}';
ALTER TABLE investigacoes ADD COLUMN falhas JSONB NOT NULL DEFAULT '[]';
-- status agora também aceita 'concluido_parcial' (coluna é TEXT livre).
