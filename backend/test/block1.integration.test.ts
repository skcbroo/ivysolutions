import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici'
import { runBlock1 } from '../src/blocks/block1.js'

let agent: MockAgent
let prevDispatcher: Dispatcher

const BFF = 'https://bff.cnpja.com'
const WS = 'https://publica.cnpj.ws'

beforeAll(() => {
  prevDispatcher = getGlobalDispatcher()
})

afterAll(() => {
  setGlobalDispatcher(prevDispatcher)
})

beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})

afterEach(async () => {
  agent.assertNoPendingInterceptors()
  await agent.close()
})

function wsResponse(opts: {
  cnpj: string
  razao: string
  capital: number
  situacao?: string
  email?: string | null
  ddd?: string
  telefone?: string
  ddd2?: string
  telefone2?: string
  logradouro?: string
  numero?: string
  bairro?: string
  cep?: string
}) {
  return {
    razao_social: opts.razao,
    capital_social: String(opts.capital),
    estabelecimento: {
      cnpj: opts.cnpj,
      situacao_cadastral: opts.situacao ?? 'INAPTA',
      data_inicio_atividade: '2021-08-19',
      atividade_principal: { id: '6190699', descricao: 'Atividades de telecomunicações' },
      email: opts.email ?? null,
      ddd1: opts.ddd ?? null,
      telefone1: opts.telefone ?? null,
      ddd2: opts.ddd2 ?? null,
      telefone2: opts.telefone2 ?? null,
      logradouro: opts.logradouro ?? null,
      numero: opts.numero ?? null,
      bairro: opts.bairro ?? null,
      cep: opts.cep ?? null,
      estado: { sigla: 'SP' },
      cidade: { nome: 'São Paulo' },
    },
    socios: [],
  }
}

describe('runBlock1 — mapeamento via publica.cnpj.ws', () => {
  it('happy path: 2 empresas, captura email/telefone/endereço', async () => {
    const personId = 'uuid-fake-1234'

    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Sidnei Piva de Jesus' } })
      .reply(200, {
        records: [
          {
            score: 9,
            index: 'person',
            person: { id: personId, type: 'NATURAL', name: 'Sidnei Piva de Jesus', taxId: '***567398**' },
          },
        ],
      })

    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      name: 'Sidnei Piva de Jesus',
      taxId: '***567398**',
      membership: [
        {
          since: '2021-08-19',
          role: { id: 5, text: 'Administrador' },
          company: { id: '43198710', name: 'ITAPEMIRIM TRANSPORTE URBANO LTDA', equity: 170000000 },
        },
        {
          since: '2014-01-20',
          role: { id: 49, text: 'Sócio-Administrador' },
          company: { id: '11047649', name: 'VIACAO CAICARA LTDA', equity: 15500000 },
        },
      ],
    })

    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '43198710' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '43198710000180', company: { name: 'ITAPEMIRIM TRANSPORTE URBANO LTDA' } } }],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '11047649' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '11047649000184', company: { name: 'VIACAO CAICARA LTDA' } } }],
    })

    agent.get(WS).intercept({ path: '/cnpj/43198710000180' }).reply(
      200,
      wsResponse({
        cnpj: '43198710000180',
        razao: 'ITAPEMIRIM TRANSPORTE URBANO LTDA',
        capital: 170000000,
        email: 'nfe.itapemirim@itapemirim.com.br',
        ddd: '11',
        telefone: '23401623',
        ddd2: '11',
        telefone2: '23401660',
      }),
    )
    agent.get(WS).intercept({ path: '/cnpj/11047649000184' }).reply(
      200,
      wsResponse({
        cnpj: '11047649000184',
        razao: 'VIACAO CAICARA LTDA',
        capital: 15500000,
        ddd: '11',
        telefone: '46891802',
      }),
    )

    const result = await runBlock1('Sidnei Piva de Jesus', '06256739809', async () => {})

    expect(result.uuid).toBe(personId)
    expect(result.cpfMasked).toBe('062.567.398-09')
    expect(result.empresas).toHaveLength(2)
    expect(result.totalCapital).toBe(170000000 + 15500000)

    const itapemirim = result.empresas.find((e) => e.cnpj14 === '43198710000180')!
    expect(itapemirim.nome).toBe('ITAPEMIRIM TRANSPORTE URBANO LTDA')
    expect(itapemirim.capital).toBe(170000000)
    expect(itapemirim.situacao).toBe('INAPTA')
    expect(itapemirim.emails).toEqual(['nfe.itapemirim@itapemirim.com.br'])
    expect(itapemirim.telefones).toEqual(['(11) 2340-1623', '(11) 2340-1660'])
    expect(itapemirim.email).toBe('nfe.itapemirim@itapemirim.com.br')

    const caicara = result.empresas.find((e) => e.cnpj14 === '11047649000184')!
    expect(caicara.emails).toEqual([])
    expect(caicara.telefones).toEqual(['(11) 4689-1802'])
  })

  it('filtro homônimo: CPF parcial bate → escolhe pessoa certa mesmo com score menor', async () => {
    // CPF 00012345670 → slice(3,9) = '123456'
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'João da Silva' } })
      .reply(200, {
        records: [
          { score: 10, index: 'person', person: { id: 'wrong-id', type: 'NATURAL', name: 'João da Silva', taxId: '***999999**' } },
          { score: 9, index: 'person', person: { id: 'right-id', type: 'NATURAL', name: 'João da Silva', taxId: '***123456**' } },
        ],
      })
    agent.get(BFF).intercept({ path: '/person/right-id', method: 'GET' }).reply(200, {
      id: 'right-id',
      membership: [],
    })

    const result = await runBlock1('João da Silva', '00012345670', async () => {})
    expect(result.uuid).toBe('right-id')
    expect(result.empresas).toHaveLength(0)
  })

  it('homônimo estrito: nenhum candidato com CPF compatível → rejeita SEM chutar', async () => {
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Gabriel Dantas' } })
      .reply(200, {
        records: [
          { score: 99999, index: 'person', person: { id: 'errado-1', name: 'Gabriel Dantas', taxId: '***224588**' } },
          { score: 88888, index: 'person', person: { id: 'errado-2', name: 'Gabriel Dantas', taxId: '***003188**' } },
        ],
      })

    const result = await runBlock1('Gabriel Dantas', '08361627146', async () => {})
    expect(result.uuid).toBeNull()
    expect(result.empresas).toHaveLength(0)
    expect(result.warnings.join(' ')).toMatch(/nenhuma tem CPF compatível/i)
  })

  it('BFF não acha pessoa → empresas vazia + warning', async () => {
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Sem Pessoa Aqui' } })
      .reply(200, { records: [] })

    const result = await runBlock1('Sem Pessoa Aqui', '11122233344', async () => {})
    expect(result.empresas).toEqual([])
    expect(result.uuid).toBeNull()
    expect(result.warnings.join(' ')).toMatch(/nenhuma pessoa.*encontrada/i)
  })

  it('cnpj.ws 404 não trava — dados não localizados', async () => {
    const personId = 'pid-1'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Fallback Test' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, type: 'NATURAL', name: 'Fallback Test', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { since: '2020-01-01', role: { text: 'Sócio' }, company: { id: '99999999', name: 'EMPRESA X LTDA', equity: 100 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '99999999' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '99999999000100', company: { name: 'EMPRESA X LTDA' } } }],
    })
    agent.get(WS).intercept({ path: '/cnpj/99999999000100' }).reply(404, { message: 'not found' })
    // Fallback scrape também falha — interceptamos cnpjbiz e publica.cnpj.ws scrape como 404.
    agent.get('https://cnpj.biz').intercept({ path: '/99999999000100' }).reply(404, '')
    agent.get('https://publica.cnpj.ws').intercept({ path: '/cnpj/99999999000100' }).reply(404, '')

    const result = await runBlock1('Fallback Test', '06256739809', async () => {})
    expect(result.empresas).toHaveLength(1)
    expect(result.empresas[0].alertas).toContain('dados não localizados')
  })

  it('detecta alerta de email pessoal em empresa de alto capital', async () => {
    const personId = 'pid-alert'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Alvo Alto' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, type: 'NATURAL', name: 'Alvo Alto', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { role: { text: 'Sócio' }, company: { id: '11111111', name: 'BIG CO LTDA', equity: 5_000_000 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '11111111' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '11111111000111', company: { name: 'BIG CO LTDA' } } }],
    })
    agent.get(WS).intercept({ path: '/cnpj/11111111000111' }).reply(
      200,
      wsResponse({
        cnpj: '11111111000111',
        razao: 'BIG CO LTDA',
        capital: 5_000_000,
        email: 'fulano@gmail.com',
      }),
    )

    const result = await runBlock1('Alvo Alto', '06256739809', async () => {})
    expect(result.empresas[0].alertas).toContain('email pessoal em empresa de alto capital')
  })

  it('detecta endereço compartilhado entre 2 empresas', async () => {
    const personId = 'pid-end'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Multiplo Lar' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, type: 'NATURAL', name: 'Multiplo Lar', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { role: { text: 'Sócio' }, company: { id: '22222222', name: 'A LTDA', equity: 100 } },
        { role: { text: 'Sócio' }, company: { id: '33333333', name: 'B LTDA', equity: 100 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '22222222' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '22222222000122', company: { name: 'A LTDA' } } }],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '33333333' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '33333333000133', company: { name: 'B LTDA' } } }],
    })
    const sameAddr = { logradouro: 'Rua das Flores', numero: '100', bairro: 'Centro', cep: '01001-000' }
    agent.get(WS).intercept({ path: '/cnpj/22222222000122' }).reply(
      200,
      wsResponse({ cnpj: '22222222000122', razao: 'A LTDA', capital: 100, ...sameAddr }),
    )
    agent.get(WS).intercept({ path: '/cnpj/33333333000133' }).reply(
      200,
      wsResponse({ cnpj: '33333333000133', razao: 'B LTDA', capital: 100, ...sameAddr }),
    )

    const result = await runBlock1('Multiplo Lar', '06256739809', async () => {})
    expect(result.empresas).toHaveLength(2)
    expect(result.empresas[0].alertas).toContain('endereço compartilhado em 2 empresas')
    expect(result.empresas[1].alertas).toContain('endereço compartilhado em 2 empresas')
  })
})
