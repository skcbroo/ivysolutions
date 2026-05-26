import { httpJson } from './http.js'

const BASE = 'https://brasilapi.com.br/api/cnpj/v1'

export type BrasilApiCnpj = {
  cnpj: string
  razao_social?: string
  nome_fantasia?: string
  situacao_cadastral?: number | string
  descricao_situacao_cadastral?: string
  data_situacao_cadastral?: string
  data_inicio_atividade?: string
  capital_social?: number | string
  cnae_fiscal?: number
  cnae_fiscal_descricao?: string
  natureza_juridica?: string
  porte?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  email?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  qsa?: Array<{
    nome_socio?: string
    cnpj_cpf_do_socio?: string
    qualificacao_socio?: string
    data_entrada_sociedade?: string
    faixa_etaria?: string
  }>
}

export async function fetchCnpj(cnpj14: string): Promise<BrasilApiCnpj | null> {
  const c = cnpj14.replace(/\D/g, '')
  const { status, data } = await httpJson<BrasilApiCnpj>(`${BASE}/${c}`, { retries: 3, retryDelayMs: 1_500 })
  if (status !== 200 || !data) return null
  return data
}
