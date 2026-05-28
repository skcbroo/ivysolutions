import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from '../src/pages/osint/Relatorio'

const counts = { empresas: 43, processos: 1454 }

function setup() {
  const onChange = vi.fn()
  const { rerender } = render(<Tabs tab="empresas" onChange={onChange} counts={counts} />)
  return {
    onChange,
    rerender: (t: 'empresas' | 'processos' | 'relatorio') =>
      rerender(<Tabs tab={t} onChange={onChange} counts={counts} />),
  }
}

describe('<Tabs> com ARIA + keyboard nav', () => {
  it('renderiza role=tablist com 4 tabs (Empresas, Processos, Linha do tempo, Relatório MD)', () => {
    setup()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
  })

  it('aria-selected reflete tab ativa', () => {
    setup()
    const empresas = screen.getByRole('tab', { name: /empresas/i })
    const processos = screen.getByRole('tab', { name: /processos/i })
    expect(empresas).toHaveAttribute('aria-selected', 'true')
    expect(processos).toHaveAttribute('aria-selected', 'false')
  })

  it('tabIndex roving: só tab ativa é focável (0); demais -1', () => {
    setup()
    expect(screen.getByRole('tab', { name: /empresas/i })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /processos/i })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: /relatório/i })).toHaveAttribute('tabindex', '-1')
  })

  it('aria-controls aponta pro painel correspondente', () => {
    setup()
    expect(screen.getByRole('tab', { name: /empresas/i })).toHaveAttribute(
      'aria-controls',
      'osint-panel-empresas',
    )
  })

  it('click muda tab via onChange', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('tab', { name: /processos/i }))
    expect(onChange).toHaveBeenCalledWith('processos')
  })

  it('ArrowRight avança para próxima tab', async () => {
    const { onChange } = setup()
    const empresas = screen.getByRole('tab', { name: /empresas/i })
    empresas.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('processos')
  })

  it('ArrowLeft volta circularmente (empresas → relatório)', async () => {
    const { onChange } = setup()
    screen.getByRole('tab', { name: /empresas/i }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledWith('relatorio')
  })

  it('Home/End vão para extremos', async () => {
    const { onChange, rerender } = setup()
    rerender('processos')
    screen.getByRole('tab', { name: /processos/i }).focus()
    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('empresas')

    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('relatorio')
  })
})
