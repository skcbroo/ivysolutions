const onlyDigits = (s: string) => s.replace(/\D/g, '')

/** Formata progressivamente para 000.000.000-00 (aceita entrada parcial). */
export function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Valida os dígitos verificadores do CPF. Rejeita sequências repetidas. */
export function validateCpf(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false

  const checkDigit = (slice: string, startWeight: number): number => {
    let sum = 0
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (startWeight - i)
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const dv1 = checkDigit(d.slice(0, 9), 10)
  if (dv1 !== Number(d[9])) return false

  const dv2 = checkDigit(d.slice(0, 10), 11)
  return dv2 === Number(d[10])
}
