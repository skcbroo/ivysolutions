-- rfb_stg.socios (texto) -> rfb.socios (subset + casts).
-- Descartados: c8 representante_legal, c9 nome_representante, c10 qualificacao_representante.
-- c4 (cnpj_cpf_socio) preservado como veio: PF vem MASCARADO (***NNNNNN**).
INSERT INTO rfb.socios
    (cnpj_basico, identificador_socio, nome_socio_ou_razao_social, cnpj_cpf_socio,
     qualificacao_socio, data_entrada_sociedade, pais, faixa_etaria)
SELECT btrim(c1), btrim(c2), btrim(c3), btrim(c4), btrim(c5),
       rfb.dt(c6), btrim(c7), btrim(c11)
FROM rfb_stg.socios;
