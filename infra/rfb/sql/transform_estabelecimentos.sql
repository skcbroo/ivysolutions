-- rfb_stg.estab (texto) -> rfb.estabelecimentos (subset + casts).
-- Descartados: c8 motivo(NAO: mantido), c9/c10 cidade_exterior/pais, c13 cnae_secundaria,
--   c26/c27 ddd_fax/fax. (motivo=c8 e mantido; ver schema.)
-- Datas AAAAMMDD com '0'/'00000000' -> NULL. cnpj14 e coluna gerada (nao inserir).
INSERT INTO rfb.estabelecimentos
    (cnpj_basico, cnpj_ordem, cnpj_dv, identificador_matriz_filial, nome_fantasia,
     situacao_cadastral, data_situacao_cadastral, motivo_situacao_cadastral,
     data_inicio_atividade, cnae_fiscal_principal, tipo_logradouro, logradouro,
     numero, complemento, bairro, cep, uf, municipio, ddd_1, telefone_1, ddd_2, telefone_2,
     correio_eletronico, situacao_especial, data_situacao_especial)
SELECT btrim(c1), btrim(c2), btrim(c3), btrim(c4), btrim(c5), btrim(c6),
       rfb.dt(c7), btrim(c8),
       rfb.dt(c11), btrim(c12),
       btrim(c14), btrim(c15), btrim(c16), btrim(c17), btrim(c18), btrim(c19),
       btrim(c20), btrim(c21), btrim(c22), btrim(c23), btrim(c24), btrim(c25),
       btrim(c28), btrim(c29),
       rfb.dt(c30)
FROM rfb_stg.estab;
