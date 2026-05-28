import { describe, expect, it } from 'vitest'
import { resolverPlano, DEFAULT_OPCOES, type Capabilities, type Opcoes } from '../src/opcoes.js'

const tudoDisponivel: Capabilities = {
  processos: true,
  analiseLlm: true,
  internacional: true,
  opensanctions: true,
  companiesHouse: true,
  icij: true,
}

const op = (over: Partial<Opcoes> = {}): Opcoes => ({
  ...DEFAULT_OPCOES,
  ...over,
  internacional: { ...DEFAULT_OPCOES.internacional, ...(over.internacional ?? {}) },
})

describe('resolverPlano — dependências', () => {
  it('tudo ligado e disponível → roda tudo', () => {
    const p = resolverPlano(op(), tudoDisponivel)
    expect(p).toMatchObject({ processos: true, analiseLlm: true, opensanctions: true, companiesHouse: true })
    expect(p.internacional).toBe(true)
  })

  it('DEPENDÊNCIA: B3 (LLM) é desligado se B2 (processos) está off', () => {
    const p = resolverPlano(op({ processos: false }), tudoDisponivel)
    expect(p.processos).toBe(false)
    expect(p.analiseLlm).toBe(false) // não há processos para analisar
  })

  it('INDEPENDÊNCIA: B4 roda mesmo com B2 e B3 off', () => {
    const p = resolverPlano(op({ processos: false, analiseLlm: false }), tudoDisponivel)
    expect(p.internacional).toBe(true)
    expect(p.opensanctions).toBe(true)
    expect(p.companiesHouse).toBe(true)
  })

  it('fontes do B4 são independentes entre si', () => {
    const p = resolverPlano(
      op({ internacional: { opensanctions: false, companiesHouse: true, icij: false } }),
      tudoDisponivel,
    )
    expect(p.opensanctions).toBe(false)
    expect(p.companiesHouse).toBe(true)
    expect(p.icij).toBe(false)
    expect(p.internacional).toBe(true)
  })

  it('ICIJ sozinho mantém internacional ligado', () => {
    const p = resolverPlano(
      op({ internacional: { opensanctions: false, companiesHouse: false, icij: true } }),
      tudoDisponivel,
    )
    expect(p.opensanctions).toBe(false)
    expect(p.companiesHouse).toBe(false)
    expect(p.icij).toBe(true)
    expect(p.internacional).toBe(true)
  })
})

describe('resolverPlano — disponibilidade (capabilities)', () => {
  it('LLM indisponível (sem chave) força analiseLlm off mesmo se pedido', () => {
    const cap = { ...tudoDisponivel, analiseLlm: false }
    const p = resolverPlano(op(), cap)
    expect(p.analiseLlm).toBe(false)
    expect(p.processos).toBe(true)
  })

  it('Companies House indisponível força companiesHouse off', () => {
    const cap = { ...tudoDisponivel, companiesHouse: false }
    const p = resolverPlano(op(), cap)
    expect(p.companiesHouse).toBe(false)
    expect(p.opensanctions).toBe(true)
  })

  it('internacional indisponível (Block 4 off) zera todas as fontes', () => {
    const cap: Capabilities = {
      ...tudoDisponivel,
      internacional: false,
      opensanctions: false,
      companiesHouse: false,
      icij: false,
    }
    const p = resolverPlano(op(), cap)
    expect(p.internacional).toBe(false)
    expect(p.icij).toBe(false)
  })
})
