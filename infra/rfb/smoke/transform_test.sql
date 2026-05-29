-- Smoke test OFFLINE da camada de transform (sem download).
-- Reaproveita os MESMOS arquivos do ETL (01 schema, 03 staging, transform_*),
-- injeta fixtures com os valores-armadilha do RFB e valida os casts.
-- Roda em qualquer Postgres; faz ROLLBACK no fim (nao persiste nada).
--
--   docker compose -f infra/docker-compose.yml exec -T db \
--     psql -U admin -d ivysolutions -v ON_ERROR_STOP=1 < infra/rfb/smoke/transform_test.sql
--
-- (ou contra o db-rfb; o ROLLBACK garante que nao polui a base real.)

\set ON_ERROR_STOP on
BEGIN;

-- schema + staging reais
\ir ../sql/01_schema_tables.sql
\ir ../sql/03_staging.sql

-- ainda dentro da txn; garante tabelas limpas (caso a base ja tenha dados)
TRUNCATE rfb.empresas, rfb.estabelecimentos, rfb.socios,
         rfb_stg.empresas, rfb_stg.estab, rfb_stg.socios;

-- ---- fixtures (texto cru, como sai do CSV) -------------------------------

-- EMPRESAS (c1..c7): c4=qualif_resp e c7=ente descartados; capital(c5) com virgula; vazio -> NULL
-- 3a linha: capital com lixo -> NULL (rfb.num) e razao com espacos -> TRIM
INSERT INTO rfb_stg.empresas (c1,c2,c3,c4,c5,c6,c7) VALUES
  ('11222333','EMPRESA TESTE LTDA','2062','16','1000,50','03','lixo_descartado'),
  ('99888777','OUTRA SA','2062','16','','05',''),
  ('33444555','  COM ESPACO  ','2062','16','LIXO','03','');

-- ESTABELECIMENTOS (c1..c30): data normal, '00000000'(c11)->NULL, situacao_especial, cnae_sec(c13) descartado
INSERT INTO rfb_stg.estab (c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,c17,c18,c19,c20,c21,c22,c23,c24,c25,c26,c27,c28,c29,c30) VALUES
  ('11222333','0001','81','1','FANTASIA X','02','20200115','00','','',
   '00000000','6201501','6202300,6203100','AVENIDA','BRASIL','100','SALA 2','CENTRO','01310000','SP',
   '7107','11','999990000','','','','','contato@x.com','EM RECUPERACAO JUDICIAL','20210301');

-- SOCIOS (c1..c11): CPF mascarado(c4) preservado; data(c6); pais(c7) vazio; cols 8-10 descartadas
INSERT INTO rfb_stg.socios (c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11) VALUES
  ('11222333','2','FULANO DE TAL','***123456**','49','20190101','','***000000**','REP','49','4');

-- ---- transforms reais ----------------------------------------------------
\ir ../sql/transform_empresas.sql
\ir ../sql/transform_estabelecimentos.sql
\ir ../sql/transform_socios.sql

-- ---- asserts -------------------------------------------------------------
DO $$
DECLARE v_num numeric; v_date date; v_txt text; v_n int;
BEGIN
  -- EMPRESAS
  SELECT count(*) INTO v_n FROM rfb.empresas;
  IF v_n <> 3 THEN RAISE EXCEPTION 'empresas: esperado 3 linhas, veio %', v_n; END IF;

  SELECT capital_social INTO v_num FROM rfb.empresas WHERE cnpj_basico='11222333';
  IF v_num <> 1000.50 THEN RAISE EXCEPTION 'capital virgula->ponto falhou: %', v_num; END IF;

  SELECT capital_social INTO v_num FROM rfb.empresas WHERE cnpj_basico='99888777';
  IF v_num IS NOT NULL THEN RAISE EXCEPTION 'capital vazio deveria ser NULL: %', v_num; END IF;

  SELECT capital_social INTO v_num FROM rfb.empresas WHERE cnpj_basico='33444555';
  IF v_num IS NOT NULL THEN RAISE EXCEPTION 'capital lixo deveria ser NULL (rfb.num): %', v_num; END IF;

  SELECT razao_social INTO v_txt FROM rfb.empresas WHERE cnpj_basico='33444555';
  IF v_txt <> 'COM ESPACO' THEN RAISE EXCEPTION 'razao_social nao foi trimada: "%"', v_txt; END IF;

  -- ESTABELECIMENTOS
  SELECT cnpj14 INTO v_txt FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_txt <> '11222333000181' THEN RAISE EXCEPTION 'cnpj14 gerado errado: %', v_txt; END IF;

  SELECT data_situacao_cadastral INTO v_date FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_date <> DATE '2020-01-15' THEN RAISE EXCEPTION 'data_situacao errada: %', v_date; END IF;

  SELECT data_inicio_atividade INTO v_date FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_date IS NOT NULL THEN RAISE EXCEPTION 'data 00000000 deveria ser NULL: %', v_date; END IF;

  SELECT situacao_especial INTO v_txt FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_txt <> 'EM RECUPERACAO JUDICIAL' THEN RAISE EXCEPTION 'situacao_especial perdida: %', v_txt; END IF;

  SELECT data_situacao_especial INTO v_date FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_date <> DATE '2021-03-01' THEN RAISE EXCEPTION 'data_situacao_especial errada: %', v_date; END IF;

  SELECT correio_eletronico INTO v_txt FROM rfb.estabelecimentos WHERE cnpj_basico='11222333';
  IF v_txt <> 'contato@x.com' THEN RAISE EXCEPTION 'email errado: %', v_txt; END IF;

  -- SOCIOS
  SELECT cnpj_cpf_socio INTO v_txt FROM rfb.socios WHERE cnpj_basico='11222333';
  IF v_txt <> '***123456**' THEN RAISE EXCEPTION 'cpf mascarado nao preservado: %', v_txt; END IF;

  SELECT data_entrada_sociedade INTO v_date FROM rfb.socios WHERE cnpj_basico='11222333';
  IF v_date <> DATE '2019-01-01' THEN RAISE EXCEPTION 'data_entrada errada: %', v_date; END IF;

  RAISE NOTICE 'SMOKE TRANSFORM OK: empresas/estabelecimentos/socios validados.';
END $$;

ROLLBACK;
