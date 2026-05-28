export const formatBRL = (raw: string | number | null) => {
  if (raw == null) return ''
  const n = typeof raw === 'string' ? Number(raw) : raw
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : ''
}

export const formatCnpj = (c: string) => {
  const d = c.padStart(14, '0')
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function truncStr(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
