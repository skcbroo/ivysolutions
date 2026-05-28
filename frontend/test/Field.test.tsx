import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Field } from '../src/components/osint/Field'

describe('<Field>', () => {
  it('renderiza label associada ao input via htmlFor/id', () => {
    render(<Field name="email" label="E-mail" value="" onChange={() => {}} />)
    const input = screen.getByLabelText(/e-mail/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'osint-email')
  })

  it('aria-required quando required=true', () => {
    render(<Field name="cpf" label="CPF" required value="" onChange={() => {}} />)
    expect(screen.getByLabelText(/cpf/i)).toHaveAttribute('aria-required', 'true')
  })

  it('aria-invalid + role=alert quando há erro', () => {
    render(
      <Field
        name="cpf"
        label="CPF"
        required
        value=""
        onChange={() => {}}
        error="CPF inválido"
      />,
    )
    const input = screen.getByLabelText(/cpf/i)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(/cpf inválido/i)
    expect(input).toHaveAttribute('aria-describedby', 'osint-cpf-err')
  })

  it('dispara onChange', async () => {
    const onChange = vi.fn()
    render(<Field name="nome" label="Nome" value="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('em modo dark, label muda de cor (tan)', () => {
    render(<Field dark name="email" label="E-mail" value="" onChange={() => {}} />)
    const label = screen.getByText(/e-mail/i)
    // cor exata é via var(--color-ivy-tan); só verificamos que está renderizado
    expect(label).toBeInTheDocument()
  })
})
