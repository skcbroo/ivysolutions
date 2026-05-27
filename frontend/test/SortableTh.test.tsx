import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortableTh, FilterChip } from '../src/pages/osint/Relatorio'

function Table({
  current,
  onSort,
}: {
  current: { key: 'nome'; dir: 'asc' | 'desc' } | null
  onSort: (k: 'nome') => void
}) {
  return (
    <table>
      <thead>
        <tr>
          <SortableTh sortKey="nome" current={current} onSort={onSort}>
            Empresa
          </SortableTh>
        </tr>
      </thead>
      <tbody>
        <tr><td>x</td></tr>
      </tbody>
    </table>
  )
}

describe('<SortableTh>', () => {
  it('aria-sort="none" quando inativo', () => {
    render(<Table current={null} onSort={() => {}} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
  })

  it('aria-sort="ascending" quando dir=asc', () => {
    render(<Table current={{ key: 'nome', dir: 'asc' }} onSort={() => {}} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('aria-sort="descending" quando dir=desc', () => {
    render(<Table current={{ key: 'nome', dir: 'desc' }} onSort={() => {}} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('clique dispara onSort com a chave correta', async () => {
    const onSort = vi.fn()
    render(<Table current={null} onSort={onSort} />)
    await userEvent.click(screen.getByRole('button', { name: /empresa/i }))
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('seta visual: ↑ quando asc, ↓ quando desc', () => {
    const { rerender } = render(<Table current={{ key: 'nome', dir: 'asc' }} onSort={() => {}} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
    rerender(<Table current={{ key: 'nome', dir: 'desc' }} onSort={() => {}} />)
    expect(screen.getByText('↓')).toBeInTheDocument()
  })
})

describe('<FilterChip>', () => {
  it('aria-pressed reflete active', () => {
    const { rerender } = render(
      <FilterChip active={false} onClick={() => {}}>Ativas</FilterChip>,
    )
    expect(screen.getByRole('button', { name: /ativas/i })).toHaveAttribute('aria-pressed', 'false')
    rerender(<FilterChip active={true} onClick={() => {}}>Ativas</FilterChip>)
    expect(screen.getByRole('button', { name: /ativas/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clique dispara onClick', async () => {
    const onClick = vi.fn()
    render(<FilterChip active={false} onClick={onClick}>X</FilterChip>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
