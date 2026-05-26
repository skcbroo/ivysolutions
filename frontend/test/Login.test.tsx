import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { Login } from '../src/pages/osint/Login'

beforeEach(() => {
  localStorage.clear()
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/osint/login']}>
      <Login />
    </MemoryRouter>,
  )
}

describe('<Login>', () => {
  it('mostra erro inline em email inválido após blur', async () => {
    renderLogin()
    const email = screen.getByLabelText(/e-mail/i)
    await userEvent.type(email, 'nao-eh-email')
    await userEvent.tab() // blur
    expect(screen.getByRole('alert')).toHaveTextContent(/e-mail inválido/i)
  })

  it('botão submit existe e aparece como Entrar', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('input de senha é type=password', () => {
    renderLogin()
    const senha = screen.getByLabelText(/^senha/i)
    expect(senha).toHaveAttribute('type', 'password')
    expect(senha).toHaveAttribute('autocomplete', 'current-password')
  })
})
