import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSortable } from '../src/hooks/useSortable'

type Row = { nome: string; capital: number | null }
const rows: Row[] = [
  { nome: 'Beta', capital: 200 },
  { nome: 'Alpha', capital: 1000 },
  { nome: 'Gamma', capital: null },
  { nome: 'Delta', capital: 50 },
]
const accessors = {
  nome: (r: Row) => r.nome,
  capital: (r: Row) => r.capital,
}

describe('useSortable', () => {
  it('sem ordenação inicial retorna na ordem original', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    expect(result.current.sorted.map((r) => r.nome)).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta'])
    expect(result.current.sort).toBeNull()
  })

  it('toggle string ASC ordena por nome', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('nome'))
    expect(result.current.sorted.map((r) => r.nome)).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma'])
    expect(result.current.sort).toEqual({ key: 'nome', dir: 'asc' })
  })

  it('segundo toggle inverte para DESC', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('nome'))
    act(() => result.current.toggle('nome'))
    expect(result.current.sorted.map((r) => r.nome)).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha'])
    expect(result.current.sort).toEqual({ key: 'nome', dir: 'desc' })
  })

  it('terceiro toggle limpa ordenação', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('nome'))
    act(() => result.current.toggle('nome'))
    act(() => result.current.toggle('nome'))
    expect(result.current.sort).toBeNull()
    expect(result.current.sorted.map((r) => r.nome)).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta'])
  })

  it('numéricos: capital ASC mantém ordem numérica (não lexicográfica)', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('capital'))
    // Sem null no fim: 50, 200, 1000, depois null
    expect(result.current.sorted.map((r) => r.capital)).toEqual([50, 200, 1000, null])
  })

  it('null vai para o fim independente da direção', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('capital'))
    act(() => result.current.toggle('capital'))
    expect(result.current.sorted.map((r) => r.capital)).toEqual([1000, 200, 50, null])
  })

  it('clicar em coluna diferente reseta direção para ASC', () => {
    const { result } = renderHook(() => useSortable(rows, accessors))
    act(() => result.current.toggle('nome'))
    act(() => result.current.toggle('nome')) // desc
    act(() => result.current.toggle('capital')) // mudou de coluna → asc
    expect(result.current.sort).toEqual({ key: 'capital', dir: 'asc' })
  })

  it('initial ordena ao montar', () => {
    const { result } = renderHook(() =>
      useSortable(rows, accessors, { key: 'capital', dir: 'desc' }),
    )
    expect(result.current.sorted[0].capital).toBe(1000)
  })
})
