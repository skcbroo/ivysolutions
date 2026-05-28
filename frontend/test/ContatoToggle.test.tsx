import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContatoToggle, ContatoCell } from '../src/pages/osint/Relatorio'
import type { Empresa } from '../src/lib/osint'

function makeEmpresa(over: Partial<Empresa> = {}): Empresa {
  return {
    id: '1',
    cnpj14: '43198710000180',
    nome: 'ITAPEMIRIM TRANSPORTE URBANO LTDA',
    nome_fantasia: null,
    situacao: 'INAPTA',
    data_situacao: null,
    abertura: null,
    capital: '170000000',
    cnae: null,
    natureza: null,
    porte: null,
    cargo: 'Administrador',
    data_entrada: null,
    endereco: null,
    email: null,
    telefone: null,
    emails: ['nfe.itapemirim@itapemirim.com.br'],
    telefones: ['(11) 2340-1623', '(11) 2340-1660'],
    qsa: [],
    alertas: [],
    ...over,
  }
}

describe('<ContatoToggle>', () => {
  it('quando só há email, esconde toggle e mostra label "Email"', () => {
    render(
      <ContatoToggle value="ambos" onChange={() => {}} hasEmail={true} hasTel={false} />,
    )
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('quando só há telefone, esconde toggle e mostra label "Telefone"', () => {
    render(
      <ContatoToggle value="ambos" onChange={() => {}} hasEmail={false} hasTel={true} />,
    )
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Telefone')).toBeInTheDocument()
  })

  it('quando há ambos, mostra select com 3 opções', () => {
    render(
      <ContatoToggle value="ambos" onChange={() => {}} hasEmail={true} hasTel={true} />,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toEqual(['ambos', 'email', 'telefone'])
  })

  it('select dispara onChange com novo valor', async () => {
    const onChange = vi.fn()
    render(<ContatoToggle value="ambos" onChange={onChange} hasEmail={true} hasTel={true} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'email')
    expect(onChange).toHaveBeenCalledWith('email')
  })
})

describe('<ContatoCell>', () => {
  it('view="ambos" mostra email + telefone (primeiros), com +N indicador', () => {
    render(<ContatoCell row={makeEmpresa()} view="ambos" />)
    expect(screen.getByText('nfe.itapemirim@itapemirim.com.br')).toBeInTheDocument()
    expect(screen.getByText('(11) 2340-1623')).toBeInTheDocument()
    // +1 telefone extra
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('view="email" esconde telefone', () => {
    render(<ContatoCell row={makeEmpresa()} view="email" />)
    expect(screen.getByText('nfe.itapemirim@itapemirim.com.br')).toBeInTheDocument()
    expect(screen.queryByText('(11) 2340-1623')).toBeNull()
  })

  it('view="telefone" esconde email', () => {
    render(<ContatoCell row={makeEmpresa()} view="telefone" />)
    expect(screen.getByText('(11) 2340-1623')).toBeInTheDocument()
    expect(screen.queryByText('nfe.itapemirim@itapemirim.com.br')).toBeNull()
  })

  it('email vira link mailto: e telefone vira tel:', () => {
    render(<ContatoCell row={makeEmpresa()} view="ambos" />)
    const mail = screen.getByRole('link', { name: /nfe\.itapemirim/ })
    expect(mail).toHaveAttribute('href', 'mailto:nfe.itapemirim@itapemirim.com.br')
    const tel = screen.getByRole('link', { name: /\(11\) 2340-1623/ })
    expect(tel).toHaveAttribute('href', 'tel:1123401623')
  })

  it('empresa sem contatos mostra "—"', () => {
    render(
      <ContatoCell row={makeEmpresa({ emails: [], telefones: [] })} view="ambos" />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
