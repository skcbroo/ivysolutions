import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/osint', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/osint')>('../src/lib/osint')
  return {
    ...actual,
    osintApi: { ...actual.osintApi, listar: vi.fn() },
    getUser: () => ({ id: 1, email: 'tester@ivy.com' }),
    getToken: () => 'mock-token',
  }
})

import { Lista } from '../src/pages/osint/Lista'
import { osintApi } from '../src/lib/osint'

const listarMock = vi.mocked(osintApi.listar)

const inv = {
  id: '1',
  created_at: '2026-05-26T13:00:00Z',
  updated_at: '2026-05-26T13:00:00Z',
  nome: 'Alvo Mobile',
  cpf: '000.***.***.00',
  status: 'concluido',
  progresso: {},
  capital_total: '50000',
  pje_count: 12,
  erro_msg: null,
} as never

beforeEach(() => {
  listarMock.mockReset()
  listarMock.mockResolvedValue([inv])
})

describe('<Lista> responsive — desktop + mobile coexistem no DOM', () => {
  it('renderiza tanto a tabela (hidden md:block) quanto a lista mobile (md:hidden)', async () => {
    const { container } = render(
      <MemoryRouter>
        <Lista />
      </MemoryRouter>,
    )
    // Aguarda fetch resolver
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull()
    })

    // Desktop wrapper: tem classe 'hidden md:block'
    const desktopWrapper = container.querySelector('.hidden.md\\:block')
    expect(desktopWrapper).not.toBeNull()
    expect(desktopWrapper?.querySelector('table')).not.toBeNull()

    // Mobile wrapper: tem classe 'md:hidden' e renderiza <ul>
    const mobileWrapper = container.querySelector('ul.md\\:hidden')
    expect(mobileWrapper).not.toBeNull()
    expect(mobileWrapper?.querySelectorAll('li').length).toBeGreaterThanOrEqual(1)
  })

  it('mesmo conteúdo aparece em ambos (nome do alvo em desktop e mobile)', async () => {
    const { container } = render(
      <MemoryRouter>
        <Lista />
      </MemoryRouter>,
    )
    await waitFor(() => {
      const matches = container.querySelectorAll('table, ul.md\\:hidden')
      expect(matches.length).toBe(2)
    })
    // O nome aparece 2x — uma em cada renderização (tabela + lista mobile)
    const all = container.querySelectorAll(`*`)
    const nameOccurrences = Array.from(all).filter((el) =>
      el.textContent?.trim() === 'Alvo Mobile',
    ).length
    expect(nameOccurrences).toBeGreaterThanOrEqual(2)
  })
})
