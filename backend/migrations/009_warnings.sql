-- Avisos do Block1 (homônimos detectados, ausência de match etc.) — exibidos no relatório.
ALTER TABLE investigacoes ADD COLUMN warnings JSONB NOT NULL DEFAULT '[]';
