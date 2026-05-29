-- rfb_stg.empresas (texto) -> rfb.empresas (subset + casts).
-- c4 (qualificacao_responsavel) e c7 (ente_federativo) descartados.
-- capital_social: CSV usa virgula decimal.
INSERT INTO rfb.empresas (cnpj_basico, razao_social, natureza_juridica, capital_social, porte)
SELECT btrim(c1), btrim(c2), btrim(c3), rfb.num(replace(btrim(c5), ',', '.')), btrim(c6)
FROM rfb_stg.empresas;
