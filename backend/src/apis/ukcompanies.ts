import { httpJson } from './http.js'
import { config } from '../config.js'

/**
 * Cliente da Public Data API do UK Companies House.
 * Fluxo de dois passos: busca officers pelo nome → detalha as nomeações
 * (empresas associadas, cargo, datas).
 *
 * Auth: HTTP Basic com a API key como usuário e senha vazia.
 * Doc: https://developer-specs.company-information.service.gov.uk/
 */

const BASE = 'https://api.company-information.service.gov.uk'

export type UkOfficerSearchItem = {
  title: string
  address_snippet?: string
  appointment_count?: number
  links?: { self?: string }
}

export type UkAppointment = {
  appointed_to?: { company_name?: string; company_number?: string }
  officer_role?: string
  appointed_on?: string
  resigned_on?: string
}

export class UkCompaniesError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

function authHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

export type UkSearchOptions = { apiKey?: string; limit?: number }

/** Busca officers (pessoas) pelo nome. */
export async function searchOfficers(
  nome: string,
  opts: UkSearchOptions = {},
): Promise<UkOfficerSearchItem[]> {
  const apiKey = opts.apiKey ?? config.UK_COMPANIES_API_KEY
  if (!apiKey) throw new UkCompaniesError(0, null, 'UK_COMPANIES_API_KEY ausente')

  const url = `${BASE}/search/officers?q=${encodeURIComponent(nome)}&items_per_page=${opts.limit ?? 5}`
  const { status, data, text } = await httpJson<{ items?: UkOfficerSearchItem[] }>(url, {
    headers: { authorization: authHeader(apiKey) },
    retries: 3,
    retryDelayMs: 2_000,
    timeoutMs: 30_000,
  })
  if (status !== 200 || !data) {
    throw new UkCompaniesError(status, data, text || `HTTP ${status}`)
  }
  return data.items ?? []
}

/** Detalha as nomeações de um officer. `selfLink` vem de item.links.self. */
export async function getOfficerAppointments(
  selfLink: string,
  opts: { apiKey?: string } = {},
): Promise<UkAppointment[]> {
  const apiKey = opts.apiKey ?? config.UK_COMPANIES_API_KEY
  if (!apiKey) throw new UkCompaniesError(0, null, 'UK_COMPANIES_API_KEY ausente')

  const path = selfLink.startsWith('http') ? selfLink : `${BASE}${selfLink}`
  const { status, data, text } = await httpJson<{ items?: UkAppointment[] }>(path, {
    headers: { authorization: authHeader(apiKey) },
    retries: 3,
    retryDelayMs: 2_000,
    timeoutMs: 30_000,
  })
  if (status !== 200 || !data) {
    throw new UkCompaniesError(status, data, text || `HTTP ${status}`)
  }
  return data.items ?? []
}
