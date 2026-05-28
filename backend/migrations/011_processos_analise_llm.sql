-- Block 3: análise dos comunicados do processo via LLM (Claude).
-- Atrás da flag BLOCK3_ENABLED; coluna NULL quando não rodou.
ALTER TABLE processos ADD COLUMN analise_llm TEXT;
