import * as cheerio from 'cheerio'
import { httpJson, httpText } from './http.js'
import { cnpjbizQueue } from './queue.js'

export type CnpjbizData = {
  cnpj: string
  nome?: string
  nomeFantasia?: string
  situacao?: string
  endereco?: string
  email?: string
  telefone?: string
  capital?: number | null
}

/**
 * Fallback de CNPJ: tenta scrape de cnpj.biz e, em falha, JSON oficial em publica.cnpj.ws.
 * Ambos throttle via fila para não bloquear IP.
 */
export async function fetchCnpjFallback(cnpj14: string): Promise<CnpjbizData | null> {
  const c = cnpj14.replace(/\D/g, '')
  return (await cnpjbizQueue.add(async () => {
    const scrape = await scrapeCnpjBiz(c)
    if (scrape) return scrape
    return await fetchCnpjWs(c)
  })) as CnpjbizData | null
}

async function scrapeCnpjBiz(cnpj14: string): Promise<CnpjbizData | null> {
  try {
    const { status, text } = await httpText(`https://cnpj.biz/${cnpj14}`, { retries: 1 })
    if (status !== 200 || !text) return null
    const $ = cheerio.load(text)

    const labelValue = (label: string): string | undefined => {
      let value: string | undefined
      $('strong, b, dt, th').each((_, el) => {
        const txt = $(el).text().trim().toLowerCase()
        if (txt.includes(label.toLowerCase())) {
          const sibling = $(el).next().text().trim() || $(el).parent().next().text().trim()
          if (sibling) value = sibling
        }
      })
      return value
    }

    const nome = labelValue('Razão Social') || $('h1').first().text().trim() || undefined
    const nomeFantasia = labelValue('Nome Fantasia')
    const situacao = labelValue('Situação Cadastral') || labelValue('Situação')
    const endereco = labelValue('Endereço') || labelValue('Logradouro')
    const email = labelValue('E-mail') || labelValue('Email')
    const telefone = labelValue('Telefone')
    const capitalStr = labelValue('Capital Social')
    const capital = capitalStr ? parseBrlNumber(capitalStr) : null

    return { cnpj: cnpj14, nome, nomeFantasia, situacao, endereco, email, telefone, capital }
  } catch {
    return null
  }
}

type CnpjWsResponse = {
  razao_social?: string
  estabelecimento?: {
    nome_fantasia?: string
    situacao_cadastral?: string
    logradouro?: string
    numero?: string
    bairro?: string
    cidade?: { nome?: string }
    estado?: { sigla?: string }
    email?: string
    telefone1?: string
    ddd1?: string
  }
  capital_social?: string | number
}

async function fetchCnpjWs(cnpj14: string): Promise<CnpjbizData | null> {
  try {
    const { status, data } = await httpJson<CnpjWsResponse>(
      `https://publica.cnpj.ws/cnpj/${cnpj14}`,
      { retries: 1 },
    )
    if (status !== 200 || !data) return null
    const est = data.estabelecimento ?? {}
    const enderecoParts = [est.logradouro, est.numero, est.bairro, est.cidade?.nome, est.estado?.sigla].filter(Boolean)
    return {
      cnpj: cnpj14,
      nome: data.razao_social,
      nomeFantasia: est.nome_fantasia,
      situacao: est.situacao_cadastral,
      endereco: enderecoParts.length ? enderecoParts.join(', ') : undefined,
      email: est.email,
      telefone: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : est.telefone1,
      capital: typeof data.capital_social === 'string' ? parseBrlNumber(data.capital_social) : data.capital_social ?? null,
    }
  } catch {
    return null
  }
}

function parseBrlNumber(s: string): number | null {
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
