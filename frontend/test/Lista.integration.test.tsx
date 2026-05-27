import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock do cliente API antes do import da página
vi.mock('../src/lib/osint', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/osint')>('../src/lib/osint')
  return {
    ...actual,
    osintApi: {
      ...actual.osintApi,
      listar: vi.fn(),
    },
    getUser: () => ({ id: 1, email: 'tester@ivy.com' }),
    getToken: () => 'mock-token',
  }
})

import { Lista } from '../src/pages/osint/Lista'
import { osintApi } from '../src/lib/osint'

const listarMock = vi.mocked(osintApi.listar)

function makeInv(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: '1',
    created_at: '2026-05-26T13:00:00Z',
    updated_at: '2026-05-26T13:01:00Z',
    nome: 'Alvo Teste',
    cpf: '062.***.***.09',
    status: 'concluido',
    progresso: {},
    capital_total: '928800777',
    pje_count: 1454,
    erro_msg: null,
    ...over,
  } as never
}

beforeEach(() => {
  listarMock.mockReset()
})

afterEach(() => {
  listarMock.mockReset()
})

describe('<Lista> integração', () => {
  it('mostra estado vazio quando API retorna []', async () => {
    listarMock.mockResolvedValue([])
    render(
      <MemoryRouter>
        <Lista />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText(/nenhuma investigação registrada/i)).toBeInTheDocument(),
    )
  })

  it('renderiza linhas com nome, status e capital formatado', async () => {
    listarMock.mockResolvedValue([
      makeInv({ id: '7', nome: 'Sidnei Piva de Jesus', status: 'concluido', capital_total: '928800777', pje_count: 1454 }),
    ])
    render(
      <MemoryRouter>
        <Lista />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getAllByText('Sidnei Piva de Jesus').length).toBeGreaterThanOrEqual(1),
    )
    expect(screen.getAllByText(/R\$\s?928\.800\.777/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByLabelText(/status:\s*conclu/i).length).toBeGreaterThanOrEqual(1)
  })

  it('mostra erro e botão de retry quando listar rejeita', async () => {
    listarMock.mockRejectedValueOnce(new Error('Network down'))
    render(
      <MemoryRouter>
        <Lista />
      </MemoryRouter>,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Network down|erro/i)
    const retry = screen.getByRole('button', { name: /tentar novamente/i })
    expect(retry).toBeInTheDocument()

    // retry: aciona segundo fetch que dá sucesso
    listarMock.mockResolvedValueOnce([])
    await userEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
