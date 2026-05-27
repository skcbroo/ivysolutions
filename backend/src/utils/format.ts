/**
 * Helpers de formatação compartilhados entre rotas, blocks, report e workers.
 * Centralizado pra evitar três cópias divergentes de `formatCpf`.
 */

/** Formata CPF puro (11 dígitos) como `000.000.000-00`. */
export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '').padStart(11, '0')
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata CNPJ puro (14 dígitos) como `00.000.000/0000-00`. */
export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '').padStart(14, '0')
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Normaliza datas vindas das APIs externas para `YYYY-MM-DD` (formato aceito
 * pelo Postgres `DATE`). Retorna null se não der pra parsear.
 */
export function toDate(s?: string | null): string | null {
  if (!s) return null
  const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(s)
  if (isoMatch) return s.slice(0, 10)
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  return null
}
