import { describe, expect, it } from 'vitest'
import {
  dedupEmpresas,
  unificarEmpresas,
  normalizeNome,
  type EmpresaRow,
} from '../src/pages/osint/Relatorio/empresas'
import type { InvestigacaoFull } from '../src/lib/osint'

const row = (over: Partial<EmpresaRow> = {}): EmpresaRow => ({
  key: Math.random().toString(36),
  exterior: true,
  jurisdicao: 'Ilhas Virgens Britânicas',
  ident: '—',
  nome: 'SSG International Holdings Ltd.',
  situacao: null,
  ativa: true,
  capital: null,
  cargo: null,
  periodo: null,
  alertas: [],
  emails: [],
  telefones: [],
  url: null,
  origem: 'Reino Unido',
  ...over,
})

describe('dedupEmpresas — empresa repetida entre APIs', () => {
  it('mescla a MESMA empresa vinda de UK e ICIJ em uma linha, somando origens', () => {
    const out = dedupEmpresas([
      row({ origem: 'Reino Unido', url: 'https://uk/x', periodo: '2012 → ativo' }),
      row({ origem: 'ICIJ', url: 'https://icij/y', situacao: 'Inadimplente' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].origem).toBe('Reino Unido · ICIJ')
    // preserva o dado mais rico de cada fonte
    expect(out[0].url).toBe('https://uk/x')
    expect(out[0].periodo).toBe('2012 → ativo')
    expect(out[0].situacao).toBe('Inadimplente')
  })

  it('dedup é robusto a caixa/acentos/pontuação no nome', () => {
    const out = dedupEmpresas([
      row({ nome: 'SSG International Holdings Ltd.', origem: 'Reino Unido' }),
      row({ nome: 'ssg internÁtional  holdings ltd', origem: 'ICIJ' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].origem).toBe('Reino Unido · ICIJ')
  })

  it('empresas exterior DIFERENTES não são mescladas', () => {
    const out = dedupEmpresas([
      row({ nome: 'SSG International Holdings Ltd.' }),
      row({ nome: 'Fleg Trading Ltd' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('empresa BR (por CNPJ) não colide com exterior de mesmo nome', () => {
    const out = dedupEmpresas([
      row({ exterior: false, jurisdicao: 'BR', ident: '12.345.678/0001-90', nome: 'ACME', origem: 'Brasil' }),
      row({ exterior: true, nome: 'ACME', origem: 'ICIJ' }),
    ])
    expect(out).toHaveLength(2)
  })
})

describe('normalizeNome', () => {
  it('remove acentos, pontuação e normaliza espaços/caixa', () => {
    expect(normalizeNome('SSG  Internátional, Holdings Ltd.')).toBe('ssg international holdings ltd')
  })
})

describe('unificarEmpresas — todas as fontes + dedup', () => {
  it('junta BR + UK + ICIJ e deduplica a sociedade repetida entre UK e ICIJ', () => {
    const data = {
      empresas: [
        { id: '1', cnpj14: '12345678000190', nome: 'EMPRESA BR LTDA', situacao: 'ATIVA', capital: '1000', cargo: 'Sócio', alertas: [], emails: [], telefones: [] },
      ],
      empresas_exterior: [
        { officer: 'X', empresa: 'SSG International Holdings Ltd.', numero: '123', jurisdicao: 'GB', cargo: 'director', entrada: '2012-01-01', saida: null, url: 'https://uk/x', score: 0.9 },
      ],
      offshore: [
        {
          entidade: 'Fulano',
          tipo: 'Pessoa (officer)',
          dataset: 'panama-papers',
          score: 80,
          match: true,
          url: 'https://icij/node',
          conexoes: [
            { id: '10', categoria: 'Empresa offshore', nome: 'SSG International Holdings Ltd.', jurisdicao: 'Ilhas Virgens Britânicas', endereco: 'Miami', status: 'Inadimplente', incorporacao: '17/07/2012', url: 'https://icij/ssg' },
            { id: '11', categoria: 'Endereço', nome: 'Rua X', jurisdicao: null, endereco: 'Rua X', status: null, incorporacao: null, url: null },
          ],
        },
      ],
    } as unknown as InvestigacaoFull

    const out = unificarEmpresas(data)
    // 1 BR + 1 exterior (UK e ICIJ mesma empresa → mesclada). Endereço NÃO vira empresa.
    expect(out).toHaveLength(2)
    const ssg = out.find((r) => r.nome.startsWith('SSG'))!
    expect(ssg.origem).toBe('Reino Unido · ICIJ')
    expect(out.some((r) => r.nome === 'Rua X')).toBe(false)
  })

  // Regressão: alvo SEM empresas domésticas, com 1 entidade só via ICIJ
  // (caso Mauricio Macri → FLEG Trading) deve contar 1, não 0.
  it('conta empresa que veio SÓ do ICIJ (sem domésticas nem UK)', () => {
    const data = {
      empresas: [],
      empresas_exterior: [],
      offshore: [
        {
          entidade: 'Mauricio Macri',
          tipo: 'Pessoa (officer)',
          dataset: 'panama-papers',
          score: 70,
          match: false,
          url: 'https://icij/node',
          conexoes: [
            { id: '1', categoria: 'Empresa offshore', nome: 'FLEG TRADING LTD', jurisdicao: 'Bahamas', endereco: null, status: null, incorporacao: null, url: 'https://icij/fleg' },
          ],
        },
      ],
    } as unknown as InvestigacaoFull

    const out = unificarEmpresas(data)
    expect(out).toHaveLength(1)
    expect(out[0].nome).toBe('FLEG TRADING LTD')
    expect(out[0].origem).toBe('ICIJ')
  })

  it('inclui entidade offshore mesmo se a categoria não foi traduzida ("Entity")', () => {
    const data = {
      empresas: [],
      empresas_exterior: [],
      offshore: [
        {
          entidade: 'X', tipo: 'Officer', dataset: 'panama-papers', score: 50, match: false, url: null,
          conexoes: [
            { id: '9', categoria: 'Entity', nome: 'ACME OFFSHORE LTD', jurisdicao: null, endereco: null, status: null, incorporacao: null, url: null },
          ],
        },
      ],
    } as unknown as InvestigacaoFull
    const out = unificarEmpresas(data)
    expect(out).toHaveLength(1)
    expect(out[0].nome).toBe('ACME OFFSHORE LTD')
  })
})
