import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; dir: SortDir } | null

export type Accessor<T> = (row: T) => string | number | null | undefined

/**
 * Hook genérico de ordenação. O caller informa, para cada chave, como extrair
 * o valor da linha. Clicar duas vezes na mesma chave inverte direção; clicar
 * numa nova chave começa em 'asc'.
 */
export function useSortable<T, K extends string = string>(
  rows: T[],
  accessors: Record<K, Accessor<T>>,
  initial: SortState<K> | null = null,
) {
  const [sort, setSort] = useState<SortState<K>>(initial)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const acc = accessors[sort.key]
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = normalize(acc(a))
      const vb = normalize(acc(b))
      if (va == null && vb == null) return 0
      if (va == null) return 1 // nulls sempre no fim
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * mul
    })
  }, [rows, sort, accessors])

  function toggle(key: K) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null // 3º clique limpa
    })
  }

  return { sorted, sort, toggle }
}

function normalize(v: string | number | null | undefined): string | number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}
