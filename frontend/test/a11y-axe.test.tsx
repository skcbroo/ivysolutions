import { render } from '@testing-library/react'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Field } from '../src/components/osint/Field'
import { StatusBadge } from '../src/components/osint/StatusBadge'
import { Login } from '../src/pages/osint/Login'
import { Tabs } from '../src/pages/osint/Relatorio'

async function runAxe(node: HTMLElement) {
  const result = await axe.run(node, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    // happy-dom não roda CSS computed; ignoramos contraste (cobrimos isso visualmente)
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations
}

afterEach(() => {
  vi.useRealTimers()
})

describe('axe-core a11y scan — componentes de /osint', () => {
  it('Field sem erro: zero violações', async () => {
    const { container } = render(<Field name="email" label="E-mail" value="x@y.com" onChange={() => {}} />)
    const violations = await runAxe(container)
    expect(violations).toEqual([])
  })

  it('Field com erro: zero violações (role=alert, aria-invalid)', async () => {
    const { container } = render(
      <Field
        name="cpf"
        label="CPF"
        required
        value=""
        onChange={() => {}}
        error="CPF inválido"
      />,
    )
    const violations = await runAxe(container)
    expect(violations).toEqual([])
  })

  it('StatusBadge — todos os status sem violações', async () => {
    for (const status of ['pendente', 'rodando', 'concluido', 'erro'] as const) {
      const { container, unmount } = render(<StatusBadge status={status} />)
      const violations = await runAxe(container)
      expect(violations, `status=${status}`).toEqual([])
      unmount()
    }
  })

  it('Tabs ARIA + painéis irmãos — zero violações (aria-controls válido)', async () => {
    const { container } = render(
      <>
        <Tabs tab="empresas" onChange={() => {}} counts={{ empresas: 5, processos: 10 }} />
        <div role="tabpanel" id="osint-panel-empresas" aria-labelledby="osint-tab-empresas" tabIndex={0}>
          conteúdo
        </div>
        <div role="tabpanel" id="osint-panel-processos" aria-labelledby="osint-tab-processos" tabIndex={0} hidden />
        <div role="tabpanel" id="osint-panel-relatorio" aria-labelledby="osint-tab-relatorio" tabIndex={0} hidden />
      </>,
    )
    const violations = await runAxe(container)
    expect(violations).toEqual([])
  })

  it('Login page completa — zero violações', async () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    const violations = await runAxe(container)
    expect(violations).toEqual([])
  })
})
