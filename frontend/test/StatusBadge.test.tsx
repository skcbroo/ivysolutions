import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from '../src/components/osint/StatusBadge'

describe('StatusBadge', () => {
  it('rotula cada status corretamente', () => {
    const { rerender } = render(<StatusBadge status="pendente" />)
    expect(screen.getByLabelText(/status:\s*pendente/i)).toBeInTheDocument()

    rerender(<StatusBadge status="rodando" />)
    expect(screen.getByLabelText(/status:\s*rodando/i)).toBeInTheDocument()

    rerender(<StatusBadge status="concluido" />)
    expect(screen.getByLabelText(/status:\s*conclu/i)).toBeInTheDocument()

    rerender(<StatusBadge status="erro" />)
    expect(screen.getByLabelText(/status:\s*erro/i)).toBeInTheDocument()
  })

  it('aplica role="status" quando live=true', () => {
    render(<StatusBadge status="rodando" live />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('sem live, não vira region live', () => {
    render(<StatusBadge status="rodando" />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
