import { httpJson } from './http.js'
import { cnpjaOpenQueue } from './queue.js'

const BASE = 'https://open.cnpja.com'

export type CnpjaOpenOffice = {
  taxId?: string
  company?: {
    name?: string
    nature?: { text?: string }
    size?: { text?: string }
    equity?: number | string
  }
  alias?: string
  founded?: string
  statusDate?: string
  status?: { text?: string }
  address?: {
    street?: string
    number?: string
    district?: string
    city?: string
    state?: string
    zip?: string
  }
  emails?: Array<{ address?: string; ownership?: string; domain?: string }>
  phones?: Array<{ area?: string; number?: string; type?: string }>
  mainActivity?: { id?: number; text?: string }
  members?: Array<{
    person?: { name?: string; type?: string }
    role?: { text?: string }
    since?: string
    age?: string
  }>
}

/**
 * Enriquece um CNPJ via CNPJa Open (pública, sem chave).
 * Throttle aplicado pela fila cnpjaOpenQueue (~40 req/min) — respeita free tier.
 */
export async function fetchCnpjOpen(cnpj14: string): Promise<CnpjaOpenOffice | null> {
  const c = cnpj14.replace(/\D/g, '')
  const result = (await cnpjaOpenQueue.add(() =>
    httpJson<CnpjaOpenOffice>(`${BASE}/office/${c}`, { retries: 3, retryDelayMs: 2_500 }),
  )) as { status: number; data: CnpjaOpenOffice | null }
  if (result.status !== 200 || !result.data) return null
  return result.data
}

/** Telefone formatado BR: (DD) XXXX-XXXX ou (DD) XXXXX-XXXX. */
export function formatPhone(area: string | undefined, number: string | undefined): string | null {
  if (!area || !number) return null
  const a = area.replace(/\D/g, '')
  const n = number.replace(/\D/g, '')
  if (!a || !n) return null
  const split = n.length >= 9 ? 5 : 4
  return `(${a}) ${n.slice(0, split)}-${n.slice(split)}`
}

/** Telefone vindo da BrasilAPI ("1123401623") → formatado. */
export function formatPhoneFromBrasilApi(raw: string | undefined | null): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length < 10) return null
  const area = d.slice(0, 2)
  const rest = d.slice(2)
  const split = rest.length >= 9 ? 5 : 4
  return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`
}
